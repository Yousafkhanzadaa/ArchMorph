import assert from "node:assert/strict";
import {
  applyOperation,
  createInitialProject,
  type ArchitectureOperation,
  type OperationOutcome,
} from "../src/lib/architecture.ts";
import {
  createArchMorphTools,
  type ToolRuntime,
} from "../src/lib/webmcp-tools.ts";
import {
  DEFAULT_LANDING_LAYERS,
  LANDING_LAYER_KEYS,
  LANDING_SCHEDULE,
  STUDIO_TOOL_COUNT,
  createLandingTools,
  describeLandingCall,
  type LandingState,
  type LandingToolRuntime,
} from "../src/lib/landing-webmcp-tools.ts";

let landingState: LandingState = {
  view: "complete",
  layers: { ...DEFAULT_LANDING_LAYERS },
};
let studioNavigationCalls = 0;
const landingRuntime: LandingToolRuntime = {
  getState: () => ({ ...landingState, layers: { ...landingState.layers } }),
  setView: (view) => {
    landingState = { ...landingState, view };
  },
  setLayer: (layer, visible) => {
    landingState = { ...landingState, layers: { ...landingState.layers, [layer]: visible } };
  },
  openStudio: () => {
    studioNavigationCalls += 1;
  },
};
const landingTools = createLandingTools(landingRuntime);
const landingNames = landingTools.map((tool) => tool.name);

assert.equal(landingTools.length, 4, "the landing page should expose four focused WebMCP tools");
assert.equal(new Set(landingNames).size, landingTools.length, "landing WebMCP tool names must be unique");
for (const tool of landingTools) {
  assert.match(tool.name, /^[A-Za-z0-9_.-]{1,128}$/, `${tool.name} must use a specification-compatible name`);
  assert.ok(tool.description.length > 0 && tool.description.length <= 500, `${tool.name} needs a concise description`);
  assert.equal(tool.inputSchema.type, "object", `${tool.name} must accept an object input`);
  assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} must reject undeclared top-level properties`);
}
const landingCategories = new Set(landingTools.map((tool) => tool.category));
assert.deepEqual([...landingCategories].sort(), ["inspect", "navigate", "present"], "the landing catalog should stay inspect/present/navigate");
assert.equal(landingTools.find((tool) => tool.name === "inspect_landing_page")!.annotations?.readOnlyHint, true);
for (const tool of landingTools) {
  if (tool.name === "inspect_landing_page") continue;
  assert.equal(tool.annotations?.readOnlyHint, false, `${tool.name} changes what the visitor sees and must not claim to be read-only`);
}

const landingInspection = await landingTools.find((tool) => tool.name === "inspect_landing_page")!.execute({}) as {
  state: LandingState;
  capabilities: { landingTools: number; studioTools: number };
  schedule: { value: string }[];
  tools: { name: string; category: string; description: string }[];
};
assert.equal(landingInspection.state.view, "complete");
assert.equal(landingInspection.capabilities.landingTools, landingTools.length, "inspection should report the catalog it belongs to");
assert.deepEqual(landingInspection.tools.map((tool) => tool.name), landingNames, "inspection should advertise every landing tool");
assert.equal(
  landingInspection.schedule[0]!.value,
  String(STUDIO_TOOL_COUNT),
  "the schedule an agent reads should quote the same tool count the page renders",
);

const viewResult = await landingTools.find((tool) => tool.name === "set_landing_model_view")!.execute({ view: "section" }) as { changed: boolean };
assert.equal(landingState.view, "section", "the landing view tool should update the visible hero state");
assert.equal(viewResult.changed, true, "a real presentation change should be reported as changed");
const repeatedView = await landingTools.find((tool) => tool.name === "set_landing_model_view")!.execute({ view: "section" }) as { changed: boolean };
assert.equal(repeatedView.changed, false, "re-setting the current view should report no change");
await landingTools.find((tool) => tool.name === "set_landing_model_layer")!.execute({ layer: "dimensions", visible: false });
assert.equal(landingState.layers.dimensions, false, "the landing layer tool should update the visible hero state");
for (const layer of LANDING_LAYER_KEYS) {
  const result = await landingTools.find((tool) => tool.name === "set_landing_model_layer")!.execute({ layer, visible: true }) as { state: LandingState };
  assert.equal(result.state.layers[layer], true, `${layer} should be an addressable landing layer`);
}
assert.throws(
  () => landingTools.find((tool) => tool.name === "set_landing_model_layer")!.execute({ layer: "furniture", visible: false }),
  /layer must be one of/,
  "landing tools should reject unknown layers",
);
assert.throws(
  () => landingTools.find((tool) => tool.name === "set_landing_model_layer")!.execute({ layer: "envelope" }),
  /visible must be true or false/,
  "landing tools should require an explicit visibility",
);
assert.throws(
  () => landingTools.find((tool) => tool.name === "set_landing_model_view")!.execute({}),
  /view must be one of/,
  "landing tools should require a declared view",
);
assert.equal(describeLandingCall("set_landing_model_view", { view: "section" }), "Section view");
assert.equal(describeLandingCall("set_landing_model_layer", { layer: "envelope", visible: false }), "Envelope hidden");
assert.equal(describeLandingCall("inspect_landing_page"), "Page inspected");
assert.equal(LANDING_SCHEDULE.length, 3, "the hero schedule should keep its three specification rows");
const cancelledLandingNavigation = new AbortController();
cancelledLandingNavigation.abort(new DOMException("Landing navigation cancelled", "AbortError"));
assert.throws(
  () => landingTools.find((tool) => tool.name === "open_studio")!.execute({}, { signal: cancelledLandingNavigation.signal }),
  /Landing navigation cancelled/,
  "landing navigation should respect native cancellation",
);
assert.equal(studioNavigationCalls, 0, "cancelled landing navigation must not open the studio");
await landingTools.find((tool) => tool.name === "open_studio")!.execute({});
assert.equal(studioNavigationCalls, 1, "the landing navigation tool should open the studio");

let project = createInitialProject();
let snapshotCalls = 0;
let exportCalls = 0;

const runtime: ToolRuntime = {
  getProject: () => project,
  perform: (operation: ArchitectureOperation): OperationOutcome => {
    const outcome = applyOperation(project, operation, "agent");
    project = outcome.project;
    return outcome;
  },
  captureSnapshot: async (options) => {
    options?.signal?.throwIfAborted();
    snapshotCalls += 1;
    return { format: "png", projectVersion: project.version };
  },
  exportPlan: (format, download, signal) => {
    signal?.throwIfAborted();
    exportCalls += 1;
    return { format, download: download === true, projectVersion: project.version };
  },
  noteActivity: () => undefined,
};

const tools = createArchMorphTools(runtime);
const names = tools.map((tool) => tool.name);

assert.equal(tools.length, 57, "ArchMorph should expose exactly 57 canonical tools");
assert.equal(new Set(names).size, tools.length, "WebMCP tool names must be unique");
assert.deepEqual(
  Object.fromEntries(["inspect", "edit", "calculate", "present"].map((category) => [category, tools.filter((tool) => tool.category === category).length])),
  { inspect: 8, edit: 37, calculate: 5, present: 7 },
  "the documented category counts must match the live catalog",
);

for (const tool of tools) {
  assert.match(tool.name, /^[A-Za-z0-9_.-]{1,128}$/, `${tool.name} must use a specification-compatible name`);
  assert.ok(tool.description.length > 0 && tool.description.length <= 500, `${tool.name} needs a concise description`);
  assert.equal(tool.inputSchema.type, "object", `${tool.name} must accept an object input`);
  assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} must reject undeclared top-level properties`);
}

const expectedReadOnly = new Set([
  "inspect_project",
  "inspect_plot",
  "inspect_floor",
  "inspect_room",
  "inspect_wall",
  "inspect_opening",
  "inspect_circulation",
  "inspect_exterior",
  "calculate_room_area",
  "calculate_total_area",
  "calculate_open_area",
  "measure_distance",
]);

for (const tool of tools) {
  assert.equal(tool.annotations?.readOnlyHint === true, expectedReadOnly.has(tool.name), `${tool.name} has an unexpected read-only annotation`);
}

for (const name of ["set_active_floor", "set_floor_height", "rename_project", "update_room", "delete_stairs", "delete_wall"]) {
  assert.ok(names.includes(name), `${name} must be reachable by an agent, not only from the human UI`);
}

const inspectProject = tools.find((tool) => tool.name === "inspect_project")!;
const inspection = await inspectProject.execute({}) as { project: { id: string }; version: number };
assert.equal(inspection.project.id, project.id, "inspection should return the live project");
const versionBeforeInspection = project.version;
await inspectProject.execute({});
assert.equal(project.version, versionBeforeInspection, "read-only inspection must not change the project version");

const createRoom = tools.find((tool) => tool.name === "create_room")!;
await createRoom.execute({
  floorId: project.view.activeFloorId,
  name: "WebMCP Test Room",
  roomType: "Office",
  x: 3,
  y: 12,
  width: 10,
  length: 10,
});
assert.equal(project.rooms.length, 1, "create_room should mutate the shared canonical project");
assert.equal(project.rooms[0].name, "WebMCP Test Room");

await tools.find((tool) => tool.name === "configure_plot")!.execute({ width: 40, length: 70, orientation: "West", frontSetback: 8, rearSetback: 6, leftSetback: 4, rightSetback: 4 });
assert.equal(project.plot.width, 40, "configure_plot should edit per-project land geometry");
assert.equal(project.plot.orientation, "West");

const createdFloor = await tools.find((tool) => tool.name === "create_floor")!.execute({ name: "WebMCP Upper", height: 9 }) as { floor: { id: string } };
await createRoom.execute({ floorId: createdFloor.floor.id, name: "WebMCP Upper Hall", roomType: "Custom", x: 3, y: 12, width: 10, length: 10 });
const addStairs = tools.find((tool) => tool.name === "add_stairs")!;
const addStairsSchema = addStairs.inputSchema as { properties: { stairType: { enum: string[] } } };
assert.deepEqual(addStairsSchema.properties.stairType.enum, ["straight", "l-shaped", "u-shaped"], "WebMCP should advertise all three architectural stair configurations");
const addedUStair = await addStairs.execute({ floorId: "floor-ground", x: 4, y: 13, width: 3, length: 5, direction: "up", stairType: "u-shaped", landingDepth: 3, wellWidth: 0.5, turnSide: "left" }) as { stair: { id: string; stairType: string } };
assert.equal(addedUStair.stair.stairType, "u-shaped", "WebMCP should create one semantic U-shaped stair");
const updatedUStair = await tools.find((tool) => tool.name === "update_stairs")!.execute({ stairId: addedUStair.stair.id, turnSide: "right", wellWidth: 1 }) as { stair: { turnSide: string; wellWidth: number } };
assert.deepEqual({ turnSide: updatedUStair.stair.turnSide, wellWidth: updatedUStair.stair.wellWidth }, { turnSide: "right", wellWidth: 1 }, "WebMCP should configure U-shaped return side and center well");
const convertedLStair = await tools.find((tool) => tool.name === "update_stairs")!.execute({ stairId: addedUStair.stair.id, stairType: "l-shaped", upperFlightLength: 6, landingDepth: 3, turnSide: "left" }) as { stair: { stairType: string; upperFlightLength: number; turnSide: string } };
assert.deepEqual({ stairType: convertedLStair.stair.stairType, upperFlightLength: convertedLStair.stair.upperFlightLength, turnSide: convertedLStair.stair.turnSide }, { stairType: "l-shaped", upperFlightLength: 6, turnSide: "left" }, "WebMCP should convert a stable stair to a configured quarter-turn L shape");
const upperStairSummary = await tools.find((tool) => tool.name === "inspect_floor")!.execute({ floorId: createdFloor.floor.id }) as { stairs: Array<{ roleOnFloor: string; stairType: string; riserHeightInches: number }> };
assert.equal(upperStairSummary.stairs[0]?.roleOnFloor, "upper-entry", "the floor summary should identify the stair's architectural role on the selected floor");
assert.equal(upperStairSummary.stairs[0]?.stairType, "l-shaped");
assert.ok(upperStairSummary.stairs[0]?.riserHeightInches > 0, "the summary should report riser height in inches");
const inspectedUpperStairs = await tools.find((tool) => tool.name === "inspect_floor")!.execute({ floorId: createdFloor.floor.id, detail: "full" }) as { stairDetails: Array<{ roleOnFloor: string; stair: { stairType: string }; layout: { flights: unknown[]; route: unknown[] } }> };
assert.equal(inspectedUpperStairs.stairDetails[0]?.roleOnFloor, "upper-entry", "full detail should identify the stair's architectural role on the selected floor");
assert.equal(inspectedUpperStairs.stairDetails[0]?.stair.stairType, "l-shaped");
assert.equal(inspectedUpperStairs.stairDetails[0]?.layout.flights.length, 2, "full detail should expose explicit L-stair flights and route geometry");

const exteriorWall = project.walls.find((wall) => wall.exterior && wall.roomIds.includes(project.rooms[0].id))!;
await tools.find((tool) => tool.name === "set_wall_finish")!.execute({ wallId: exteriorWall.id, finish: "brick" });
await tools.find((tool) => tool.name === "set_roof")!.execute({ parapetEnabled: true, parapetHeight: 3.5, finish: "concrete" });
await tools.find((tool) => tool.name === "configure_site_boundary")!.execute({ enabled: true, height: 5, gateOffset: 20, gateWidth: 10, gateStyle: "slatted" });
const balconyResult = await tools.find((tool) => tool.name === "add_balcony")!.execute({ floorId: project.view.activeFloorId, name: "WebMCP Terrace", kind: "terrace", x: 15, y: 1, width: 10, length: 6, railingStyle: "horizontal" }) as { balcony: { id: string } };
await tools.find((tool) => tool.name === "update_balcony")!.execute({ balconyId: balconyResult.balcony.id, railingHeight: 4, finish: "concrete" });
const featureResult = await tools.find((tool) => tool.name === "add_facade_feature")!.execute({ kind: "canopy", wallId: exteriorWall.id, offset: 5, width: 4, projection: 3 }) as { facadeFeature: { id: string } };
await tools.find((tool) => tool.name === "update_facade_feature")!.execute({ featureId: featureResult.facadeFeature.id, finish: "metal" });
const exteriorInspection = await tools.find((tool) => tool.name === "inspect_exterior")!.execute({}) as { balconies: unknown[]; facadeFeatures: unknown[]; siteBoundary: { enabled: boolean } };
assert.equal(exteriorInspection.balconies.length, 1);
assert.equal(exteriorInspection.facadeFeatures.length, 1);
assert.equal(exteriorInspection.siteBoundary.enabled, true);
const addWindow = tools.find((tool) => tool.name === "add_window")!;
const addedWindow = await addWindow.execute({
  wallId: exteriorWall.id,
  offset: 5,
  width: 4,
  glazing: "clear",
}) as { opening: { id: string } };
const setWindowProperties = tools.find((tool) => tool.name === "set_window_properties")!;
const lowEWindow = await setWindowProperties.execute({
  openingId: addedWindow.opening.id,
  glazing: "low-e",
}) as { opening: { glazing: string; solarHeatGainCoefficient: number; visibleTransmittance: number; uFactor: number } };
assert.deepEqual(
  {
    glazing: lowEWindow.opening.glazing,
    solarHeatGainCoefficient: lowEWindow.opening.solarHeatGainCoefficient,
    visibleTransmittance: lowEWindow.opening.visibleTransmittance,
    uFactor: lowEWindow.opening.uFactor,
  },
  { glazing: "low-e", solarHeatGainCoefficient: 0.35, visibleTransmittance: 0.62, uFactor: 0.3 },
  "selecting the low-e preset should apply its performance defaults",
);

const overlapSnapshot = JSON.stringify(project);
assert.throws(
  () => createRoom.execute({ floorId: "floor-ground", name: "Overlapping", roomType: "Office", x: 4, y: 13, width: 8, length: 8 }),
  /cannot occupy the same floor area/,
  "a room that would overlap an existing room must be refused, not merely reported later",
);
assert.equal(JSON.stringify(project), overlapSnapshot, "a refused overlap must not mutate the project");

const snapshotBeforeFailure = JSON.stringify(project);
assert.throws(
  () => createRoom.execute({
    floorId: project.view.activeFloorId,
    name: "Invalid Room",
    roomType: "Office",
    x: 4,
    y: 20,
    width: "ten",
    length: 8,
  }),
  /width must be a number/,
  "invalid arguments should fail with an actionable error",
);
assert.equal(JSON.stringify(project), snapshotBeforeFailure, "a rejected tool call must not mutate the project");

const invalidHostSnapshot = JSON.stringify(project);
const invalidHostVersion = project.version;
assert.throws(
  () => tools.find((tool) => tool.name === "add_window")!.execute({
    wallId: "wall-does-not-exist",
    offset: 4,
    width: 3,
  }),
  /wall-does-not-exist.*does not exist/i,
  "a nonexistent window host should return a specific error",
);
assert.equal(project.version, invalidHostVersion, "an invalid window host must not change the project version");
assert.equal(JSON.stringify(project), invalidHostSnapshot, "an invalid window host must not mutate the project");

const cancelledSnapshot = new AbortController();
cancelledSnapshot.abort(new DOMException("Native snapshot cancelled", "AbortError"));
await assert.rejects(
  () => Promise.resolve(tools.find((tool) => tool.name === "take_snapshot")!.execute(
    { download: false },
    { signal: cancelledSnapshot.signal },
  )),
  /Native snapshot cancelled/,
  "take_snapshot should forward a native cancellation signal",
);
assert.equal(snapshotCalls, 0, "a cancelled snapshot must stop before capture begins");

const cancelledExport = new AbortController();
cancelledExport.abort(new DOMException("Native export cancelled", "AbortError"));
assert.throws(
  () => tools.find((tool) => tool.name === "export_plan")!.execute(
    { format: "json", download: false },
    { signal: cancelledExport.signal },
  ),
  /Native export cancelled/,
  "export_plan should forward a native cancellation signal",
);
assert.equal(exportCalls, 0, "a cancelled export must stop before serialization begins");

await tools.find((tool) => tool.name === "rename_project")!.execute({ name: "WebMCP Regression House" });
assert.equal(project.name, "WebMCP Regression House", "rename_project should rename the shared project");
await tools.find((tool) => tool.name === "update_room")!.execute({ roomId: project.rooms[0].id, name: "Renamed Room", roomType: "Bedroom" });
assert.deepEqual(
  { name: project.rooms[0].name, type: project.rooms[0].type },
  { name: "Renamed Room", type: "Bedroom" },
  "update_room should rename and retype a room",
);
await tools.find((tool) => tool.name === "set_active_floor")!.execute({ floorId: "floor-ground" });
const raised = await tools.find((tool) => tool.name === "set_floor_height")!.execute({ floorId: "floor-ground", height: 12 }) as { floors: Array<{ id: string; elevation: number; height: number }>; stairs: Array<{ rise: number }> };
assert.equal(raised.floors.find((floor) => floor.id === "floor-ground")!.height, 12, "set_floor_height should change the storey height");
assert.equal(raised.floors.find((floor) => floor.id === createdFloor.floor.id)!.elevation, 12, "storeys above must be re-levelled");
assert.ok(project.walls.filter((wall) => wall.floorId === "floor-ground").every((wall) => wall.height === 12), "walls on the floor must follow its new height");
assert.throws(
  () => tools.find((tool) => tool.name === "set_floor_height")!.execute({ floorId: "floor-ground", height: 6 }),
  /between 7 and 16 ft/,
  "an unbuildable storey height must be refused",
);
assert.equal(project.view.activeFloorId, "floor-ground", "set_active_floor should switch the visible storey");
const stairsBefore = project.stairs.length;
await tools.find((tool) => tool.name === "delete_stairs")!.execute({ stairId: project.stairs[0].id });
assert.equal(project.stairs.length, stairsBefore - 1, "delete_stairs should remove the staircase");
assert.throws(
  () => tools.find((tool) => tool.name === "delete_wall")!.execute({ wallId: project.walls.find((wall) => wall.roomIds.length > 0)!.id }),
  /room-boundary walls are controlled by their rooms/i,
  "delete_wall must refuse canonical room-boundary walls",
);

// Chrome's WebMCP guidance budgets roughly 1.5K characters per tool result. The default summary must
// stay far below the unbounded full payload on a realistic floor.
const inspectFloorTool = tools.find((tool) => tool.name === "inspect_floor")!;
const summary = JSON.stringify(await inspectFloorTool.execute({ floorId: "floor-ground" }));
const full = JSON.stringify(await inspectFloorTool.execute({ floorId: "floor-ground", detail: "full" }));
assert.ok(summary.length < full.length * 0.75, `inspect_floor summary (${summary.length}) should be materially smaller than full (${full.length})`);
const summaryRooms = (JSON.parse(summary) as { rooms: Array<{ area: number; carpetArea: number }> }).rooms;
assert.ok(summaryRooms.every((room) => typeof room.area === "number" && typeof room.carpetArea === "number"),
  "inspect_floor should report each room's area without a second round trip");

assert.equal(
  tools.length,
  STUDIO_TOOL_COUNT,
  "STUDIO_TOOL_COUNT is quoted on the landing page and in open_studio; it must match the real studio catalog",
);

const exported = await tools.find((tool) => tool.name === "export_plan")!.execute({ format: "json", download: false }) as { projectVersion: number };
assert.equal(exported.projectVersion, project.version, "exports should identify the current project version");

console.log(`WebMCP regression passed: ${landingTools.length} landing tools, ${tools.length} studio tools, ${expectedReadOnly.size} read-only studio tools, inspect_floor summary ${summary.length} vs full ${full.length} chars, representative execution verified.`);
