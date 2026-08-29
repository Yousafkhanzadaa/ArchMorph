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

assert.equal(tools.length, 40, "ArchMorph should expose exactly 40 submission tools");
assert.equal(new Set(names).size, tools.length, "WebMCP tool names must be unique");
assert.deepEqual(
  Object.fromEntries(["inspect", "edit", "calculate", "present"].map((category) => [category, tools.filter((tool) => tool.category === category).length])),
  { inspect: 7, edit: 22, calculate: 5, present: 6 },
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
  "calculate_room_area",
  "calculate_total_area",
  "calculate_open_area",
  "measure_distance",
]);

for (const tool of tools) {
  assert.equal(tool.annotations?.readOnlyHint === true, expectedReadOnly.has(tool.name), `${tool.name} has an unexpected read-only annotation`);
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

const exteriorWall = project.walls.find((wall) => wall.exterior && wall.roomIds.includes(project.rooms[0].id))!;
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
  tools.find((tool) => tool.name === "take_snapshot")!.execute(
    { download: false },
    { signal: cancelledSnapshot.signal },
  ),
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

const exported = await tools.find((tool) => tool.name === "export_plan")!.execute({ format: "json", download: false }) as { projectVersion: number };
assert.equal(exported.projectVersion, project.version, "exports should identify the current project version");

console.log(`WebMCP regression passed: ${tools.length} tools, ${expectedReadOnly.size} read-only tools, representative execution verified.`);
