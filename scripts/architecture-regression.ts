import assert from "node:assert/strict";
import {
  applyOperation,
  buildCirculationGraph,
  createInitialProject,
  inspectFloor,
  inspectRoom,
  migrateProject,
  projectMetrics,
  recommendedStairRun,
  round,
  roomArea,
  roomCarpetArea,
  roomCentroid,
  roomContainsPoint,
  roomInteriorPoint,
  roomPerimeter,
  roomVertices,
  stairFootprint,
  stairEntryPoint,
  stairLayout,
  stairLocalPoint,
  stairPlanPoint,
  stairProgressAt,
  stairConnection,
  validateLayout,
  wallLength,
  type ArchitectureOperation,
  type ExteriorFinishId,
  type Project,
} from "../src/lib/architecture.ts";
import { buildSpatialModel, orientedSlopeFrame, type SpatialModel } from "../src/lib/spatial3d.ts";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
      key: (index: number) => Array.from(memory.keys())[index] ?? null,
      get length() { return memory.size; },
    },
  },
});

const persistence = await import("../src/lib/persistence.ts");
assert.equal(round(67.725), 67.73, "decimal half values should round predictably despite binary floating-point representation");
assert.equal(round(-67.725), -67.73, "negative decimal half values should round symmetrically");

const dot3 = (first: { x: number; y: number; z: number }, second: { x: number; y: number; z: number }) => (
  first.x * second.x + first.y * second.y + first.z * second.z
);
for (const end of [
  { x: 8, y: 4, z: 0 },
  { x: -8, y: 4, z: 0 },
  { x: 0, y: 4, z: 8 },
  { x: 0, y: 4, z: -8 },
]) {
  const frame = orientedSlopeFrame({ x: 0, y: 0, z: 0 }, end)!;
  const expectedLength = Math.hypot(end.x, end.y, end.z);
  assert.ok(Math.abs(frame.length - expectedLength) < 0.001, "a sloped support frame should preserve its full 3D length");
  assert.ok(Math.abs(frame.zAxis.x - end.x / expectedLength) < 0.001
    && Math.abs(frame.zAxis.y - end.y / expectedLength) < 0.001
    && Math.abs(frame.zAxis.z - end.z / expectedLength) < 0.001,
  "a sloped support's local length axis should follow its flight in every plan direction");
  assert.ok(Math.abs(dot3(frame.xAxis, frame.yAxis)) < 0.001
    && Math.abs(dot3(frame.xAxis, frame.zAxis)) < 0.001
    && Math.abs(dot3(frame.yAxis, frame.zAxis)) < 0.001,
  "a sloped support frame should remain orthogonal after a stair turns");
  const handedness = {
    x: frame.xAxis.y * frame.yAxis.z - frame.xAxis.z * frame.yAxis.y,
    y: frame.xAxis.z * frame.yAxis.x - frame.xAxis.x * frame.yAxis.z,
    z: frame.xAxis.x * frame.yAxis.y - frame.xAxis.y * frame.yAxis.x,
  };
  assert.ok(dot3(handedness, frame.zAxis) > 0.999, "a sloped support frame should remain right-handed");
}

function assertOperationRejectedWithoutMutation(
  source: Project,
  operation: ArchitectureOperation,
  expected: RegExp,
) {
  const snapshot = JSON.stringify(source);
  assert.throws(() => applyOperation(source, operation, "agent"), expected);
  assert.equal(JSON.stringify(source), snapshot, `Rejected ${operation.type} must not mutate its source project.`);
}
let project = createInitialProject();
const perform = (operation: ArchitectureOperation) => {
  project = applyOperation(project, operation, "agent").project;
  return project;
};

perform({ type: "rename_project", name: "Canonical House Regression" });
perform({ type: "create_room", floorId: "floor-ground", name: "Living", roomType: "Living Room", x: 3, y: 10, width: 12, length: 12 });
perform({ type: "create_room", floorId: "floor-ground", name: "Dining", roomType: "Dining Room", x: 15, y: 10, width: 12, length: 12 });
perform({ type: "create_room", floorId: "floor-ground", name: "Kitchen", roomType: "Kitchen", x: 15, y: 22, width: 12, length: 10 });

assert.equal(project.walls.filter((wall) => wall.roomIds.length === 2).length, 2, "adjacent rooms should share canonical walls");
assert.equal(new Set(project.walls.map((wall) => wall.id)).size, project.walls.length, "canonical wall IDs must be unique");
project.rooms.forEach((room) => assert.ok(room.wallIds.length >= 4, `${room.name} should reference its boundary segments`));

const living = project.rooms.find((room) => room.name === "Living")!;
const dining = project.rooms.find((room) => room.name === "Dining")!;
const kitchen = project.rooms.find((room) => room.name === "Kitchen")!;
const livingDiningWall = project.walls.find((wall) => wall.roomIds.includes(living.id) && wall.roomIds.includes(dining.id))!;
const diningKitchenWall = project.walls.find((wall) => wall.roomIds.includes(dining.id) && wall.roomIds.includes(kitchen.id))!;
const livingFrontWall = project.walls.find((wall) => wall.exterior && wall.roomSides.some((side) => side.roomId === living.id && side.side === "north"))!;
const kitchenExteriorWall = project.walls.find((wall) => wall.exterior && wall.roomIds.includes(kitchen.id) && wallLength(wall) >= 5)!;
const kitchenRehostWall = project.walls.find((wall) => wall.exterior && wall.roomIds.includes(kitchen.id) && wall.id !== kitchenExteriorWall.id && wallLength(wall) >= 5)!;

perform({ type: "add_opening", kind: "door", wallId: livingFrontWall.id, offset: 6, width: 3, hingeSide: "start", handing: "left", swingDirection: "inward", state: "open" });
perform({ type: "add_opening", kind: "door", wallId: livingDiningWall.id, offset: 6, width: 3, hingeSide: "end", handing: "right", swingDirection: "inward", state: "open" });
perform({ type: "add_opening", kind: "door", wallId: diningKitchenWall.id, offset: 6, width: 3 });
perform({ type: "add_opening", kind: "window", wallId: kitchenExteriorWall.id, offset: wallLength(kitchenExteriorWall) / 2, width: 4, height: 4, sillHeight: 3, windowType: "sliding", operable: true, glazing: "low-e", solarHeatGainCoefficient: 0.35, visibleTransmittance: 0.62, uFactor: 0.3 });

let graph = buildCirculationGraph(project);
assert.deepEqual(new Set(graph.reachableRoomIds), new Set([living.id, dining.id, kitchen.id]), "all rooms should reach the main entrance");
assert.equal(graph.routesFromMainEntrance.find((route) => route.roomId === kitchen.id)?.elementPath.length, 3, "circulation should expose the exact entrance-to-kitchen element path");
assert.equal(validateLayout(project).issues.filter((issue) => issue.code.includes("CIRCULATION") || issue.code === "NO_EXTERIOR_ACCESS").length, 0);

const interiorDoor = project.openings.find((opening) => opening.kind === "door" && opening.wallId === livingDiningWall.id)!;
perform({ type: "rehost_opening", openingId: interiorDoor.id, wallId: kitchenRehostWall.id, offset: Math.min(4, wallLength(kitchenRehostWall) - interiorDoor.width / 2) });
graph = buildCirculationGraph(project);
assert.ok(graph.disconnectedRoomIds.includes(dining.id), "rehosting a circulation door should be reflected by graph reachability");
assert.ok(validateLayout(project).issues.some((issue) => issue.code === "DISCONNECTED_CIRCULATION"));

const window = project.openings.find((opening) => opening.kind === "window")!;
perform({ type: "update_opening", openingId: window.id, windowType: "casement", operable: true, glazing: "privacy" });
assert.equal(project.openings.find((opening) => opening.id === window.id)?.glazing, "privacy");
assert.equal(project.openings.find((opening) => opening.id === window.id)?.solarHeatGainCoefficient, 0.4);
assert.equal(project.openings.find((opening) => opening.id === window.id)?.visibleTransmittance, 0.35);
assert.equal(project.openings.find((opening) => opening.id === window.id)?.uFactor, 0.45);

const metrics = projectMetrics(project);
assert.ok(metrics.grossCoveredArea > metrics.totalNetFloorArea, "gross area should include canonical wall footprints");
assert.equal(metrics.openSiteArea, metrics.plotArea - projectMetrics(project).grossCoveredArea);

persistence.saveProjectLocally(project);
const restored = persistence.loadLatestProject()!;
assert.equal(restored.id, project.id);
assert.equal(restored.schemaVersion, 7);
assert.equal(restored.walls.length, project.walls.length);
assert.equal(restored.openings.length, project.openings.length);
assert.equal(restored.view.focusElementId, undefined, "temporary focus state should not be persisted");

const exported = persistence.exportProjectDocument(project);
const imported = persistence.importProjectDocument(exported);
assert.notEqual(imported.id, project.id);
assert.equal(imported.rooms.length, project.rooms.length);
const duplicate = persistence.duplicateLocalProject(project);
assert.notEqual(duplicate.id, project.id);
assert.ok(persistence.listSavedProjects().length >= 3);
const next = persistence.deleteLocalProject(duplicate.id);
assert.ok(next, "deleting one saved project should leave another loadable project");
const customSiteProject = persistence.createNewLocalProject("Custom Site", { width: 42, length: 75, orientation: "South", setbacks: { front: 7, rear: 5, left: 4, right: 4 } });
assert.deepEqual(customSiteProject.plot, { width: 42, length: 75, orientation: "South", setbacks: { front: 7, rear: 5, left: 4, right: 4 } }, "new projects should accept their own site dimensions instead of sharing a fixed plot");

let multiFloor = createInitialProject();
const performMultiFloor = (operation: ArchitectureOperation) => {
  multiFloor = applyOperation(multiFloor, operation, "agent").project;
};
performMultiFloor({ type: "create_room", floorId: "floor-ground", name: "Ground Hall", roomType: "Custom", x: 2, y: 4, width: 24, length: 24 });
performMultiFloor({ type: "create_floor", name: "First Floor", height: 9 });
const firstFloor = multiFloor.floors.find((floor) => floor.level === 1)!;
performMultiFloor({ type: "create_room", floorId: firstFloor.id, name: "Upper Hall", roomType: "Custom", x: 2, y: 4, width: 24, length: 24 });
const stairRun = recommendedStairRun(multiFloor, "floor-ground", "up");
performMultiFloor({ type: "add_stairs", floorId: "floor-ground", x: 4, y: 10, width: 3.5, length: stairRun, direction: "up" });
const floorGraph = buildCirculationGraph(multiFloor);
assert.ok(floorGraph.edges.some((edge) => edge.type === "stair"), "aligned rooms on consecutive floors should create a circulation stair edge");
assert.equal(firstFloor.elevation, 9, "upper-floor elevation should derive from the floor below");
const stair = multiFloor.stairs[0];
const connection = stairConnection(multiFloor, stair)!;
assert.equal(connection.targetFloor.id, firstFloor.id, "stair should resolve its adjacent destination floor");
assert.ok(connection.riserHeight * 12 <= 7.75, "concept stair risers should not exceed 7 3/4 inches");
assert.ok(connection.treadDepth * 12 >= 10, "concept stair treads should be at least 10 inches at the recommended run");
assert.ok(!validateLayout(multiFloor).issues.some((issue) => issue.code === "INVALID_STAIR_GEOMETRY"));
performMultiFloor({ type: "update_stairs", stairId: stair.id, rotation: 90 });
const rotatedStair = multiFloor.stairs[0];
assert.deepEqual(stairFootprint(rotatedStair), { x: 4, y: 10, width: stairRun, length: 3.5 }, "90-degree stair rotation should swap its plan footprint dimensions");
for (const rotation of [0, 90, 180, 270] as const) {
  performMultiFloor({ type: "update_stairs", stairId: stair.id, rotation });
  const currentStair = multiFloor.stairs[0];
  const rotatedPoint = stairPlanPoint(currentStair, 1.25, 4.5);
  const rotatedLocal = stairLocalPoint(currentStair, rotatedPoint);
  assert.ok(Math.abs(rotatedLocal.u - 1.25) < 0.001 && Math.abs(rotatedLocal.v - 4.5) < 0.001, `stair world/local transforms should remain inverse at ${rotation} degrees`);
  const footprint = stairFootprint(currentStair);
  for (const corner of [
    stairPlanPoint(currentStair, 0, 0), stairPlanPoint(currentStair, currentStair.width, 0),
    stairPlanPoint(currentStair, currentStair.width, currentStair.length), stairPlanPoint(currentStair, 0, currentStair.length),
  ]) {
    assert.ok(corner.x >= footprint.x - 0.001 && corner.x <= footprint.x + footprint.width + 0.001
      && corner.y >= footprint.y - 0.001 && corner.y <= footprint.y + footprint.length + 0.001,
    `the ${rotation}-degree stair corners should fit its derived footprint`);
  }
  assert.ok(buildCirculationGraph(multiFloor).edges.some((edge) => edge.type === "stair"), `the ${rotation}-degree stair should preserve its aligned floor connection`);
}
performMultiFloor({ type: "update_stairs", stairId: stair.id, length: 6 });
assert.ok(validateLayout(multiFloor).issues.some((issue) => issue.code === "INVALID_STAIR_GEOMETRY"), "short straight stair runs should be flagged");

let uStairProject = createInitialProject();
const performUStair = (operation: ArchitectureOperation) => { uStairProject = applyOperation(uStairProject, operation, "agent").project; };
performUStair({ type: "create_room", floorId: "floor-ground", name: "Ground U Stair Hall", roomType: "Custom", x: 2, y: 4, width: 24, length: 24 });
performUStair({ type: "create_floor", name: "U Stair Upper", height: 9 });
const uUpperFloor = uStairProject.floors.find((floor) => floor.level === 1)!;
performUStair({ type: "create_room", floorId: uUpperFloor.id, name: "Upper U Stair Hall", roomType: "Custom", x: 2, y: 4, width: 24, length: 24 });
const uFlightRun = recommendedStairRun(uStairProject, "floor-ground", "up", "u-shaped");
performUStair({ type: "add_stairs", floorId: "floor-ground", x: 5, y: 11, width: 3.5, length: uFlightRun, direction: "up", stairType: "u-shaped", landingDepth: 3.5, wellWidth: 0.5, turnSide: "left" });
const uStair = uStairProject.stairs[0];
const uLayout = stairLayout(uStair);
const uConnection = stairConnection(uStairProject, uStair)!;
assert.equal(uConnection.flightCount, 2, "a U-shaped stair should expose two connected flights");
assert.deepEqual(uConnection.risersPerFlight, [uConnection.riserCount / 2, uConnection.riserCount / 2], "a U-shaped stair should divide rise evenly across both flights");
assert.deepEqual(stairFootprint(uStair), { x: 5, y: 11, width: 7.5, length: uFlightRun + 3.5 }, "U-shaped stair footprint should include two flights, the center well, and half landing");
assert.equal(stairProgressAt(uStair, stairEntryPoint(uStair, "lower", -0.1))! < 0.05, true, "lower U-shaped entry should begin near zero vertical progress");
assert.equal(stairProgressAt(uStair, stairPlanPoint(uStair, uLayout.localWidth / 2, uStair.landingDepth / 2)), 0.5, "half landing should sit at half the floor-to-floor rise");
assert.equal(stairProgressAt(uStair, stairEntryPoint(uStair, "upper", -0.1))! > 0.95, true, "upper U-shaped entry should finish near full vertical progress");
assert.equal(stairProgressAt(uStair, stairPlanPoint(uStair, uStair.width + uStair.wellWidth / 2, uStair.landingDepth + 1)), undefined, "the center well must not be treated as a walkable U-stair surface");
assert.ok(buildCirculationGraph(uStairProject).edges.some((edge) => edge.stairId === uStair.id), "one U-shaped stair should create one semantic circulation edge");
assert.ok(!validateLayout(uStairProject).issues.some((issue) => issue.code.startsWith("STAIR_") || issue.code === "INVALID_STAIR_CONNECTION" || issue.code === "INVALID_STAIR_GEOMETRY"), "a correctly sized and placed U-shaped stair should validate its geometry, approaches, walls, and connection");
for (const rotation of [0, 90, 180, 270] as const) {
  performUStair({ type: "update_stairs", stairId: uStair.id, rotation });
  const rotatedUStair = uStairProject.stairs[0];
  const rotatedLayout = stairLayout(rotatedUStair);
  const lowerFlight = rotatedLayout.flights[0];
  const localPoint = { u: (lowerFlight.start.u + lowerFlight.end.u) / 2, v: (lowerFlight.start.v + lowerFlight.end.v) / 2 };
  const worldPoint = stairPlanPoint(rotatedUStair, localPoint.u, localPoint.v);
  const restoredLocalPoint = stairLocalPoint(rotatedUStair, worldPoint);
  assert.ok(Math.abs(restoredLocalPoint.u - localPoint.u) < 0.001 && Math.abs(restoredLocalPoint.v - localPoint.v) < 0.001, `U-shaped stair transforms should remain inverse at ${rotation} degrees`);
  assert.ok(buildCirculationGraph(uStairProject).edges.some((edge) => edge.stairId === uStair.id), `U-shaped stair should preserve one circulation edge at ${rotation} degrees`);
}
performUStair({ type: "update_stairs", stairId: uStair.id, rotation: 0 });
const lowerEntryBeforeTurn = stairEntryPoint(uStair, "lower", -0.1);
performUStair({ type: "update_stairs", stairId: uStair.id, turnSide: "right" });
assert.notDeepEqual(stairEntryPoint(uStairProject.stairs[0], "lower", -0.1), lowerEntryBeforeTurn, "changing the return side should swap the lower flight without replacing the stair");
assertOperationRejectedWithoutMutation(uStairProject, { type: "update_stairs", stairId: uStair.id, landingDepth: 3 }, /landing must be at least as deep/i);
performUStair({ type: "update_stairs", stairId: uStair.id, length: 3 });
assert.ok(validateLayout(uStairProject).issues.some((issue) => issue.code === "INVALID_STAIR_GEOMETRY"), "short U-shaped flights should be flagged against the per-flight recommended run");

let lStairProject = createInitialProject();
const performLStair = (operation: ArchitectureOperation) => { lStairProject = applyOperation(lStairProject, operation, "agent").project; };
performLStair({ type: "create_room", floorId: "floor-ground", name: "Ground L Stair Hall", roomType: "Custom", x: 2, y: 4, width: 26, length: 25 });
performLStair({ type: "create_floor", name: "L Stair Upper", height: 9 });
const lUpperFloor = lStairProject.floors.find((floor) => floor.level === 1)!;
performLStair({ type: "create_room", floorId: lUpperFloor.id, name: "Upper L Stair Hall", roomType: "Custom", x: 2, y: 4, width: 26, length: 25 });
const lFlightRun = recommendedStairRun(lStairProject, "floor-ground", "up", "l-shaped");
performLStair({ type: "add_stairs", floorId: "floor-ground", x: 6, y: 9, width: 3.5, length: lFlightRun, upperFlightLength: lFlightRun + 1, direction: "up", stairType: "l-shaped", landingDepth: 3.5, turnSide: "left" });
const lStair = lStairProject.stairs[0];
const lLayout = stairLayout(lStair);
const lConnection = stairConnection(lStairProject, lStair)!;
assert.equal(lConnection.flightCount, 2, "an L-shaped stair should expose two connected flights");
assert.equal(lLayout.outline.length, 6, "a square-landing L stair should have a true six-corner stairwell outline");
const lLower = lLayout.flights[0];
const lUpper = lLayout.flights[1];
const lowerVector = { u: lLower.end.u - lLower.start.u, v: lLower.end.v - lLower.start.v };
const upperVector = { u: lUpper.end.u - lUpper.start.u, v: lUpper.end.v - lUpper.start.v };
assert.ok(Math.abs(lowerVector.u * upperVector.u + lowerVector.v * upperVector.v) < 0.001, "L-shaped stair flights should be perpendicular");
assert.equal(stairProgressAt(lStair, stairEntryPoint(lStair, "lower", -0.1))! < 0.05, true, "lower L-shaped entry should begin near zero progress");
assert.equal(stairProgressAt(lStair, stairEntryPoint(lStair, "upper", -0.1))! > 0.95, true, "upper L-shaped entry should finish near full progress");
assert.equal(stairProgressAt(lStair, stairPlanPoint(lStair, 1, lStair.landingDepth + 1)), undefined, "the inside corner of an L stair's bounding box must remain void, not walkable stair");
assert.ok(buildCirculationGraph(lStairProject).edges.some((edge) => edge.stairId === lStair.id), "one L-shaped stair should create one semantic circulation edge");
assert.ok(!validateLayout(lStairProject).issues.some((issue) => issue.code.startsWith("STAIR_") || issue.code === "INVALID_STAIR_CONNECTION" || issue.code === "INVALID_STAIR_GEOMETRY"), "a correctly placed L-shaped stair should have valid flights, approaches, walls, and circulation");
for (const rotation of [0, 90, 180, 270] as const) {
  performLStair({ type: "update_stairs", stairId: lStair.id, rotation });
  const rotatedL = lStairProject.stairs[0];
  const rotatedLayout = stairLayout(rotatedL);
  const point = rotatedLayout.route[2];
  const world = stairPlanPoint(rotatedL, point.u, point.v);
  const restored = stairLocalPoint(rotatedL, world);
  assert.ok(Math.abs(restored.u - point.u) < 0.001 && Math.abs(restored.v - point.v) < 0.001, `L-shaped stair transforms should remain inverse at ${rotation} degrees`);
}
performLStair({ type: "update_stairs", stairId: lStair.id, rotation: 0 });
const lUpperEntryBeforeTurn = stairEntryPoint(lStairProject.stairs[0], "upper", 0.5);
performLStair({ type: "update_stairs", stairId: lStair.id, turnSide: "right" });
assert.notDeepEqual(stairEntryPoint(lStairProject.stairs[0], "upper", 0.5), lUpperEntryBeforeTurn, "changing an L stair's turn side should move its perpendicular upper exit");
performLStair({ type: "update_stairs", stairId: lStair.id, upperFlightLength: 3 });
assert.ok(validateLayout(lStairProject).issues.some((issue) => issue.code === "INVALID_STAIR_GEOMETRY"), "an undersized L upper flight should be identified independently");
performLStair({ type: "update_stairs", stairId: lStair.id, upperFlightLength: lFlightRun + 1, turnSide: "left", x: 3 });
assert.ok(validateLayout(lStairProject).issues.some((issue) => issue.code === "STAIR_ACCESS_CLEARANCE"), "a stair exit without a full-width upper-floor approach should be rejected as unusable");
performLStair({ type: "update_stairs", stairId: lStair.id, x: 6 });
performLStair({ type: "add_wall", floorId: "floor-ground", x1: 4, y1: 12, x2: 18, y2: 12 });
assert.ok(validateLayout(lStairProject).issues.some((issue) => issue.code === "STAIR_WALL_CLASH"), "a wall crossing the stairwell must remain a real architectural clash");

let edgeStairProject = createInitialProject();
edgeStairProject = applyOperation(edgeStairProject, { type: "create_floor", name: "Upper" }, "agent").project;
edgeStairProject = applyOperation(edgeStairProject, { type: "add_stairs", floorId: "floor-ground", x: 26, y: 5, width: 3.5, length: 11, direction: "up", rotation: 0 }, "agent").project;
assertOperationRejectedWithoutMutation(edgeStairProject, { type: "update_stairs", stairId: edgeStairProject.stairs[0].id, rotation: 90 }, /inside the plot/);

let shapeProject = createInitialProject();
const performShape = (operation: ArchitectureOperation) => { shapeProject = applyOperation(shapeProject, operation, "agent").project; };
performShape({ type: "set_exterior_finish", finish: "brick" });
assert.equal(shapeProject.exteriorFinish, "brick", "the facade finish should be canonical project state");
performShape({ type: "create_room", floorId: "floor-ground", name: "L Studio", roomType: "Office", x: 2, y: 4, width: 10, length: 10, shape: "l-shape" });
const lRoom = shapeProject.rooms[0];
assert.equal(roomVertices(lRoom).length, 6, "L-shaped rooms should produce six orthogonal boundary vertices");
assert.equal(roomArea(lRoom), 75.25, "L-shaped room area should use its polygon, not its bounding box");
assert.equal(lRoom.wallIds.length, 6, "canonical topology should derive all six L-shaped boundary segments");
performShape({ type: "create_polygon_room", floorId: "floor-ground", name: "Polygon Room", roomType: "Custom", vertices: [
  { x: 16, y: 4 }, { x: 27, y: 4 }, { x: 27, y: 14 }, { x: 22, y: 14 }, { x: 22, y: 10 }, { x: 16, y: 10 },
] });
assert.equal(shapeProject.rooms[1].shape, "custom");
assert.equal(roomArea(shapeProject.rooms[1]), 86);
assert.ok(!validateLayout(shapeProject).issues.some((issue) => issue.code === "ROOM_OVERLAP"), "disjoint irregular rooms should not create bounding-box overlap errors");

const presetExpectations = [
  { shape: "rectangle", vertices: 4, area: 100, perimeter: 40 },
  { shape: "l-shape", vertices: 6, area: 75.25, perimeter: 40 },
  { shape: "t-shape", vertices: 8, area: 58, perimeter: 40 },
  { shape: "u-shape", vertices: 8, area: 83.5, perimeter: 51 },
] as const;
for (const expectation of presetExpectations) {
  let presetProject = createInitialProject();
  presetProject = applyOperation(presetProject, {
    type: "create_room", floorId: "floor-ground", name: expectation.shape, roomType: "Custom",
    x: 4, y: 8, width: 10, length: 10, shape: expectation.shape,
  }, "agent").project;
  const room = presetProject.rooms[0];
  assert.equal(roomVertices(room).length, expectation.vertices, `${expectation.shape} should have the intended boundary vertex count`);
  assert.equal(roomArea(room), expectation.area, `${expectation.shape} should have an exact polygon area`);
  assert.equal(roomPerimeter(room), expectation.perimeter, `${expectation.shape} should have an exact polygon perimeter`);
  assert.equal(room.wallIds.length, expectation.vertices, `${expectation.shape} should derive one canonical wall per unsplit edge`);
  assert.equal(inspectRoom(presetProject, room.id).area, expectation.area, `${expectation.shape} inspection should report polygon area`);
}
let decimalShapeProject = createInitialProject();
decimalShapeProject = applyOperation(decimalShapeProject, {
  type: "create_room", floorId: "floor-ground", name: "Decimal L", roomType: "Custom",
  x: 3.5, y: 11, width: 9, length: 10, shape: "l-shape",
}, "agent").project;
assert.equal(roomArea(decimalShapeProject.rooms[0]), 67.73, "room polygon areas at decimal half ties should round consistently");

let transformedShape = createInitialProject();
const transform = (operation: ArchitectureOperation) => { transformedShape = applyOperation(transformedShape, operation, "agent").project; };
transform({ type: "create_room", floorId: "floor-ground", name: "Editable L", roomType: "Office", x: 3, y: 7, width: 10, length: 10, shape: "l-shape" });
let editableRoom = transformedShape.rooms[0];
const editableNorthWall = transformedShape.walls.find((wall) => wall.roomIds.includes(editableRoom.id) && wall.roomSides.some((side) => side.roomId === editableRoom.id && side.side === "north"))!;
transform({ type: "add_opening", kind: "window", wallId: editableNorthWall.id, offset: 5, width: 3, height: 4, sillHeight: 3 });
const transformedOpeningId = transformedShape.openings[0].id;
const initialVertices = roomVertices(editableRoom);
transform({ type: "move_room", roomId: editableRoom.id, x: 5, y: 9 });
editableRoom = transformedShape.rooms[0];
assert.deepEqual(roomVertices(editableRoom), initialVertices.map((point) => ({ x: point.x + 2, y: point.y + 2 })), "moving an irregular room should translate every vertex");
assert.equal(transformedShape.openings[0]?.id, transformedOpeningId, "moving an irregular room should preserve hosted openings");
transform({ type: "resize_room", roomId: editableRoom.id, width: 12, length: 14 });
editableRoom = transformedShape.rooms[0];
assert.equal(roomArea(editableRoom), 126.42, "resizing an L room should scale its polygon area");
assert.equal(transformedShape.openings[0]?.id, transformedOpeningId, "resizing an irregular room should preserve hosted openings");
assert.equal(validateLayout(transformedShape).issues.filter((issue) => issue.code === "INVALID_OPENING").length, 0, "transformed irregular-room openings should remain valid");

const invalidBase = createInitialProject();
assertOperationRejectedWithoutMutation(invalidBase, {
  type: "create_polygon_room", floorId: "floor-ground", name: "Diagonal", roomType: "Custom",
  vertices: [{ x: 2, y: 2 }, { x: 9, y: 2 }, { x: 8, y: 9 }, { x: 2, y: 9 }],
}, /orthogonal/);
assertOperationRejectedWithoutMutation(invalidBase, {
  type: "create_polygon_room", floorId: "floor-ground", name: "Crossing", roomType: "Custom",
  vertices: [{ x: 1, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 8 }, { x: 3, y: 8 }, { x: 3, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 10 }, { x: 1, y: 10 }],
}, /cross|touch|overlap/);
assertOperationRejectedWithoutMutation(invalidBase, {
  type: "create_polygon_room", floorId: "floor-ground", name: "Overlapping edge", roomType: "Custom",
  vertices: [{ x: 1, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 8 }, { x: 1, y: 8 }, { x: 1, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 1, y: 6 }],
}, /cross|touch|overlap|collinear/);
assertOperationRejectedWithoutMutation(invalidBase, {
  type: "create_polygon_room", floorId: "floor-ground", name: "Outside", roomType: "Custom",
  vertices: [{ x: 25, y: 2 }, { x: 34, y: 2 }, { x: 34, y: 10 }, { x: 25, y: 10 }],
}, /inside the plot/);

let finishProject = createInitialProject();
for (const finish of ["stucco", "brick", "concrete", "timber", "metal"] satisfies ExteriorFinishId[]) {
  finishProject = applyOperation(finishProject, { type: "set_exterior_finish", finish }, "agent").project;
  assert.equal(finishProject.exteriorFinish, finish, `${finish} should be stored as canonical facade state`);
}

let exteriorProject = createInitialProject();
const performExterior = (operation: ArchitectureOperation) => { exteriorProject = applyOperation(exteriorProject, operation, "agent").project; };
performExterior({ type: "set_plot", width: 40, length: 80, orientation: "East", setbacks: { front: 8, rear: 6, left: 4, right: 4 } });
assert.deepEqual(exteriorProject.plot, { width: 40, length: 80, orientation: "East", setbacks: { front: 8, rear: 6, left: 4, right: 4 } }, "site geometry must be editable project state");
performExterior({ type: "set_roof", parapetEnabled: true, parapetHeight: 3.5, parapetThickness: 0.6, finish: "concrete" });
performExterior({ type: "set_site_boundary", enabled: true, height: 5, gateOffset: 20, gateWidth: 12, gateHeight: 6, gateStyle: "slatted", finish: "stucco" });
performExterior({ type: "create_floor", name: "Upper Exterior" });
const exteriorFloor = exteriorProject.floors.find((floor) => floor.level === 1)!;
performExterior({ type: "create_room", floorId: exteriorFloor.id, name: "Upper Suite", roomType: "Bedroom", x: 6, y: 8, width: 16, length: 14 });
const exteriorWall = exteriorProject.walls.find((wall) => wall.floorId === exteriorFloor.id && wall.exterior && wallLength(wall) >= 8)!;
performExterior({ type: "set_wall_finish", wallId: exteriorWall.id, finish: "brick" });
performExterior({ type: "add_balcony", floorId: exteriorFloor.id, name: "Front Balcony", x: 8, y: 1, width: 12, length: 6, finish: "concrete", railingStyle: "vertical", railingSides: ["north", "east", "west"] });
performExterior({ type: "add_facade_feature", kind: "canopy", wallId: exteriorWall.id, offset: 6, width: 6, projection: 3, finish: "metal" });
assert.equal(exteriorProject.roof.parapetHeight, 3.5);
assert.equal(exteriorProject.siteBoundary.gate.width, 12);
assert.equal(exteriorProject.walls.find((wall) => wall.id === exteriorWall.id)?.finish, "brick");
assert.equal(projectMetrics(exteriorProject, exteriorFloor.id).balconyArea, 72);
assert.equal(exteriorProject.facadeFeatures[0].wallId, exteriorWall.id);
performExterior({ type: "move_room", roomId: exteriorProject.rooms.find((room) => room.floorId === exteriorFloor.id)!.id, x: 7, y: 9 });
assert.equal(exteriorProject.facadeFeatures.length, 1, "hosted façade features should follow their room-controlled wall when it moves");
assert.ok(exteriorProject.walls.some((wall) => wall.exterior && wall.finish === "brick"), "per-wall finish overrides should survive room-controlled topology movement");
assertOperationRejectedWithoutMutation(exteriorProject, { type: "update_balcony", balconyId: exteriorProject.balconies[0].id, width: 80 }, /inside the plot/);
const exteriorRoundTrip = persistence.importProjectDocument(persistence.exportProjectDocument(exteriorProject));
assert.equal(exteriorRoundTrip.schemaVersion, 7);
assert.equal(exteriorRoundTrip.balconies.length, 1);
assert.equal(exteriorRoundTrip.facadeFeatures.length, 1);
assert.equal(exteriorRoundTrip.siteBoundary.enabled, true);

let legacyProject = createInitialProject();
legacyProject = applyOperation(legacyProject, { type: "create_room", floorId: "floor-ground", name: "Legacy Room", roomType: "Custom", x: 3, y: 8, width: 12, length: 14 }, "agent").project;
legacyProject = applyOperation(legacyProject, { type: "create_floor", name: "Legacy Upper" }, "agent").project;
legacyProject = applyOperation(legacyProject, { type: "add_stairs", floorId: "floor-ground", x: 6, y: 9, width: 3.5, length: 11, direction: "up" }, "agent").project;
const legacyDocument = JSON.parse(JSON.stringify(legacyProject)) as Record<string, unknown>;
legacyDocument.schemaVersion = 3;
delete legacyDocument.exteriorFinish;
delete legacyDocument.roof;
delete legacyDocument.siteBoundary;
delete legacyDocument.balconies;
delete legacyDocument.facadeFeatures;
delete (legacyDocument.rooms as Array<Record<string, unknown>>)[0].shape;
delete (legacyDocument.stairs as Array<Record<string, unknown>>)[0].rotation;
delete (legacyDocument.stairs as Array<Record<string, unknown>>)[0].stairType;
delete (legacyDocument.stairs as Array<Record<string, unknown>>)[0].upperFlightLength;
delete (legacyDocument.stairs as Array<Record<string, unknown>>)[0].landingDepth;
delete (legacyDocument.stairs as Array<Record<string, unknown>>)[0].wellWidth;
delete (legacyDocument.stairs as Array<Record<string, unknown>>)[0].turnSide;
const migratedLegacy = migrateProject(legacyDocument as unknown as Project);
assert.equal(migratedLegacy.schemaVersion, 7, "legacy projects should migrate to schema v7");
assert.equal(migratedLegacy.exteriorFinish, "stucco", "legacy projects should receive a stable default facade finish");
assert.equal(migratedLegacy.rooms[0].shape, "rectangle", "legacy rooms should migrate as rectangles");
assert.equal(migratedLegacy.stairs[0].rotation, 0, "legacy stairs should migrate to zero rotation");
assert.equal(migratedLegacy.stairs[0].stairType, "straight", "legacy stairs should migrate as straight flights");
assert.equal(migratedLegacy.stairs[0].upperFlightLength, migratedLegacy.stairs[0].length, "legacy stairs should gain a reversible upper-flight run");
assert.equal(migratedLegacy.stairs[0].landingDepth, migratedLegacy.stairs[0].width, "legacy stairs should gain a reversible default landing depth");
assert.equal(migratedLegacy.roof.type, "flat", "legacy projects should gain the lightweight flat-roof model");
assert.equal(migratedLegacy.siteBoundary.enabled, false, "legacy projects should not unexpectedly show a boundary wall");
assert.deepEqual(migratedLegacy.balconies, []);
assert.deepEqual(migratedLegacy.facadeFeatures, []);

let spatialProject = createInitialProject();
const performSpatial = (operation: ArchitectureOperation) => {
  spatialProject = applyOperation(spatialProject, operation, "agent").project;
};
performSpatial({ type: "create_room", floorId: "floor-ground", name: "Walk Test", roomType: "Custom", x: 3, y: 10, width: 12, length: 12 });
const spatialRoom = spatialProject.rooms[0];
const spatialNorthWall = spatialProject.walls.find((wall) => wall.roomSides.some((side) => side.roomId === spatialRoom.id && side.side === "north"))!;
performSpatial({ type: "add_opening", kind: "door", wallId: spatialNorthWall.id, offset: 6, width: 3, state: "closed" });

const designSpatial = buildSpatialModel(spatialProject);
const walkSpatial = buildSpatialModel(spatialProject, { doorMode: "all-open" });
const closedDoorFrame = designSpatial.openingFrames.find(({ opening }) => opening.kind === "door")!;
const distanceToSegment = (x: number, z: number, segment: SpatialModel["collisionSegments"][number]) => {
  const dx = segment.x2 - segment.x1;
  const dz = segment.z2 - segment.z1;
  const lengthSquared = dx * dx + dz * dz;
  const ratio = lengthSquared ? Math.max(0, Math.min(1, ((x - segment.x1) * dx + (z - segment.z1) * dz) / lengthSquared)) : 0;
  return Math.hypot(x - (segment.x1 + dx * ratio), z - (segment.z1 + dz * ratio));
};
const collisionAtDoor = (model: SpatialModel) => model.collisionSegments.some((segment) => (
  segment.floorId === closedDoorFrame.opening.floorId && distanceToSegment(closedDoorFrame.x, closedDoorFrame.z, segment) < 0.01
));
assert.ok(collisionAtDoor(designSpatial), "a closed design door should remain collidable outside Walk Mode");
assert.ok(!collisionAtDoor(walkSpatial), "Walk Mode should treat every door opening as traversable");
assert.equal(spatialProject.openings[0].state, "closed", "the Walk Mode collision policy must not mutate canonical door state");

const northEastCorner = { x: spatialRoom.x + spatialRoom.width + 0.2, z: spatialRoom.y - 0.2, height: 4 };
const cornerVolumes = walkSpatial.wallVolumes.filter((volume) => (
  northEastCorner.x >= volume.x && northEastCorner.x <= volume.x + volume.width
  && northEastCorner.z >= volume.z && northEastCorner.z <= volume.z + volume.length
  && northEastCorner.height >= volume.bottom && northEastCorner.height <= volume.top
));
assert.equal(cornerVolumes.length, 1, "orthogonal wall corners should be closed by one non-overlapping derived volume");

performSpatial({ type: "create_floor", name: "Upper Test" });
const spatialUpperFloor = spatialProject.floors.find((floor) => floor.level === 1)!;
performSpatial({ type: "create_room", floorId: spatialUpperFloor.id, name: "Upper Walk Test", roomType: "Custom", x: 3, y: 10, width: 12, length: 12 });
const upperRoom = spatialProject.rooms.find((room) => room.floorId === spatialUpperFloor.id)!;
const upperNorthWall = spatialProject.walls.find((wall) => wall.roomSides.some((side) => side.roomId === upperRoom.id && side.side === "north"))!;
performSpatial({ type: "add_opening", kind: "window", wallId: upperNorthWall.id, offset: 6, width: 4, height: 4, sillHeight: 3 });
const multiFloorSpatial = buildSpatialModel(spatialProject, { doorMode: "all-open" });
assert.deepEqual(
  new Set(multiFloorSpatial.openingFrames.map(({ opening }) => opening.floorId)),
  new Set(["floor-ground", spatialUpperFloor.id]),
  "the spatial model should expose opening frames from every floor while walking",
);

// ---------------------------------------------------------------------------
// Habitability, interior anchors, and measurement scoping
// ---------------------------------------------------------------------------
let habitat = createInitialProject();
const performHabitat = (operation: ArchitectureOperation) => {
  habitat = applyOperation(habitat, operation, "human").project;
};
performHabitat({ type: "create_room", floorId: "floor-ground", name: "Lounge", roomType: "Living Room", x: 3, y: 10, width: 14, length: 16 });
performHabitat({ type: "create_room", floorId: "floor-ground", name: "Bedroom 1", roomType: "Bedroom", x: 17, y: 10, width: 10, length: 13 });
performHabitat({ type: "create_room", floorId: "floor-ground", name: "Bath 1", roomType: "Bathroom", x: 17, y: 23, width: 10, length: 5 });
const habitatCodes = () => new Set(validateLayout(habitat).issues.map((issue) => issue.code));

assert.ok(habitatCodes().has("ROOM_DAYLIGHT_SHORTFALL"), "a room with no windows should fail the daylight guideline");
assert.ok(habitatCodes().has("ROOM_NO_VENTILATION"), "a room with no openable window should fail the ventilation guideline");
assert.ok(habitatCodes().has("BEDROOM_NO_EGRESS"), "a bedroom with no escape window should be reported");

const loungeRoom = habitat.rooms.find((room) => room.name === "Lounge")!;
const loungeWall = habitat.walls.find((wall) => wall.exterior && wall.roomIds.includes(loungeRoom.id))!;
performHabitat({ type: "add_opening", kind: "window", wallId: loungeWall.id, offset: 7, width: 6, height: 5, sillHeight: 3, windowType: "casement", operable: true });
const loungeIssues = validateLayout(habitat).issues.filter((issue) => issue.elementIds.includes(loungeRoom.id));
assert.ok(!loungeIssues.some((issue) => issue.code === "ROOM_DAYLIGHT_SHORTFALL"), "30 sq ft of glazing satisfies 8% daylight for a 224 sq ft room");
assert.ok(!loungeIssues.some((issue) => issue.code === "ROOM_NO_VENTILATION"), "an operable casement satisfies the 4% ventilation guideline");

// A fixed window admits light but no air, which the checks must distinguish.
const bedroom = habitat.rooms.find((room) => room.name === "Bedroom 1")!;
const bedroomWall = habitat.walls.find((wall) => wall.exterior && wall.roomIds.includes(bedroom.id))!;
performHabitat({ type: "add_opening", kind: "window", wallId: bedroomWall.id, offset: 5, width: 4, height: 4, sillHeight: 3, windowType: "fixed", operable: false });
const bedroomIssues = validateLayout(habitat).issues.filter((issue) => issue.elementIds.includes(bedroom.id));
assert.ok(!bedroomIssues.some((issue) => issue.code === "ROOM_DAYLIGHT_SHORTFALL"), "16 sq ft of glazing satisfies daylight for a 130 sq ft bedroom");
assert.ok(bedroomIssues.some((issue) => issue.code === "ROOM_NO_VENTILATION"), "a fixed window contributes no openable area");
assert.ok(!bedroomIssues.some((issue) => issue.code === "BEDROOM_NO_EGRESS"), "a 4 x 4 ft window with a 3 ft sill satisfies the escape concept");

performHabitat({ type: "create_room", floorId: "floor-ground", name: "Box Room", roomType: "Bedroom", x: 3, y: 30, width: 6, length: 8 });
assert.ok(
  validateLayout(habitat).issues.some((issue) => issue.code === "ROOM_BELOW_HABITABLE_MINIMUM"),
  "a 48 sq ft bedroom is below the habitable minimum",
);

// Non-habitable service space must not be dragged into the habitability rules.
performHabitat({ type: "create_room", floorId: "floor-ground", name: "Store", roomType: "Storage", x: 3, y: 42, width: 6, length: 6 });
const store = habitat.rooms.find((room) => room.name === "Store")!;
assert.equal(
  validateLayout(habitat).issues.filter((issue) => issue.elementIds.includes(store.id)
    && ["ROOM_DAYLIGHT_SHORTFALL", "ROOM_NO_VENTILATION", "ROOM_BELOW_HABITABLE_MINIMUM"].includes(issue.code)).length,
  0,
  "storage is not a habitable room and must not raise habitability findings",
);

// A setback breach is a legal line, not a drawing hint.
assert.equal(
  validateLayout(habitat).issues.find((issue) => issue.code === "SETBACK_VIOLATION")?.severity ?? "error",
  "error",
  "a setback breach must be reported as an error",
);

// A U-shaped room's area centroid lands in its notch; anchors must stay inside the room.
let anchors = createInitialProject();
anchors = applyOperation(anchors, { type: "create_room", floorId: "floor-ground", name: "U Room", roomType: "Living Room", x: 4, y: 12, width: 20, length: 20, shape: "u-shape" }, "human").project;
const uRoom = anchors.rooms[0];
assert.equal(roomContainsPoint(uRoom, roomCentroid(uRoom)), false, "the U-shape centroid is expected to fall outside the room");
assert.equal(roomContainsPoint(uRoom, roomInteriorPoint(uRoom)), true, "roomInteriorPoint must always land inside the room");
for (const shape of ["rectangle", "l-shape", "t-shape", "u-shape"] as const) {
  let sample = createInitialProject();
  sample = applyOperation(sample, { type: "create_room", floorId: "floor-ground", name: shape, roomType: "Office", x: 4, y: 12, width: 18, length: 18, shape: shape === "rectangle" ? undefined : shape }, "human").project;
  assert.ok(roomContainsPoint(sample.rooms[0], roomInteriorPoint(sample.rooms[0])), `${shape} interior point must be inside the room`);
}

// Carpet area is exact for orthogonal rooms of uniform wall thickness.
let carpet = createInitialProject();
carpet = applyOperation(carpet, { type: "create_room", floorId: "floor-ground", name: "Rect", roomType: "Living Room", x: 3, y: 12, width: 14, length: 16 }, "human").project;
carpet = applyOperation(carpet, { type: "create_polygon_room", floorId: "floor-ground", name: "Ell", roomType: "Office", vertices: [{ x: 3, y: 32 }, { x: 23, y: 32 }, { x: 23, y: 44 }, { x: 15, y: 44 }, { x: 15, y: 52 }, { x: 3, y: 52 }] }, "human").project;
assert.equal(roomCarpetArea(carpet, carpet.rooms[0]), 209.25, "a 14 x 16 ft room with 6 in walls has 13.5 x 15.5 ft of carpet");
assert.equal(roomCarpetArea(carpet, carpet.rooms[1]), 316.25, "carpet area must stay exact across a reflex corner");
assert.ok(roomCarpetArea(carpet, carpet.rooms[0]) < roomArea(carpet.rooms[0]), "carpet area is always smaller than centreline area");

// Ground coverage and open site area are ground-floor ratios and must not follow the active floor.
let scoped = createInitialProject();
scoped = applyOperation(scoped, { type: "create_room", floorId: "floor-ground", name: "Ground", roomType: "Living Room", x: 3, y: 12, width: 24, length: 30 }, "human").project;
scoped = applyOperation(scoped, { type: "create_floor", name: "Upper", height: 9 }, "human").project;
const scopedUpper = scoped.floors[1].id;
scoped = applyOperation(scoped, { type: "create_room", floorId: scopedUpper, name: "Upper", roomType: "Bedroom", x: 3, y: 12, width: 10, length: 10 }, "human").project;
scoped = applyOperation(scoped, { type: "add_balcony", floorId: scopedUpper, name: "Balcony", kind: "balcony", x: 5, y: 6, width: 12, length: 5 }, "human").project;
const groundMetrics = projectMetrics(scoped, "floor-ground");
const upperMetrics = projectMetrics(scoped, scopedUpper);
assert.equal(groundMetrics.groundCoveragePercent, upperMetrics.groundCoveragePercent, "ground coverage must not change with the selected floor");
assert.equal(groundMetrics.openSiteArea, upperMetrics.openSiteArea, "open site area must not change with the selected floor");
assert.equal(groundMetrics.openArea, groundMetrics.openSiteArea, "the openArea alias must agree with openSiteArea");
assert.equal(groundMetrics.coveragePercent, groundMetrics.groundCoveragePercent, "the coveragePercent alias must be the ground coverage ratio");
assert.equal(groundMetrics.projectBalconyArea, 60, "project balcony area must count balconies on every floor");
assert.equal(groundMetrics.balconyArea, 0, "the floor-scoped balcony area stays floor-scoped");
assert.equal(groundMetrics.floorAreaRatio, round(groundMetrics.totalGrossCoveredArea / groundMetrics.plotArea, 3), "FAR is total gross covered area over plot area");

// The compact floor summary keeps stable IDs and areas while dropping derived geometry.
const summaryFloor = inspectFloor(scoped, "floor-ground") as { rooms: Array<{ id: string; area: number; carpetArea: number }>; walls: Array<{ id: string }> };
const fullFloor = inspectFloor(scoped, "floor-ground", "full");
assert.ok(JSON.stringify(summaryFloor).length < JSON.stringify(fullFloor).length, "the floor summary must be smaller than full detail");
assert.equal(summaryFloor.rooms.length, 1);
assert.ok(summaryFloor.rooms[0].area > 0 && summaryFloor.rooms[0].carpetArea > 0, "the floor summary reports both area measures per room");
assert.ok(summaryFloor.walls.every((wall) => wall.id.length > 0), "the floor summary keeps every stable wall ID");

// Stair geometry is reported in the unit architects read.
const stairUnits = stairConnection(multiFloor, multiFloor.stairs[0])!;
// Converted from the exact rise, not from the display-rounded feet value, so it does not inherit that error.
assert.equal(stairUnits.riserHeightInches, round((stairUnits.rise / stairUnits.riserCount) * 12, 2), "riser height must be reported in inches from the exact rise");
assert.equal(stairUnits.treadDepthInches, round(stairUnits.treadDepth * 12, 2), "tread depth must also be reported in inches");
assert.ok(stairUnits.riserHeightInches <= 7.75, "concept stair risers should not exceed 7 3/4 inches");

// ---------------------------------------------------------------------------
// Alignment, overlap prevention, and editable storey height
// ---------------------------------------------------------------------------
let align = createInitialProject();
const performAlign = (operation: ArchitectureOperation) => {
  align = applyOperation(align, operation, "human").project;
};

// Two rooms meant to share a party wall but drawn a near-miss apart must still produce one wall.
performAlign({ type: "create_room", floorId: "floor-ground", name: "Left", roomType: "Custom", x: 3, y: 10, width: 14, length: 16 });
performAlign({ type: "create_room", floorId: "floor-ground", name: "Right", roomType: "Custom", x: 17.1, y: 10, width: 9, length: 16 });
assert.equal(align.walls.filter((wall) => wall.roomIds.length === 2).length, 1, "a near-miss edge must latch onto its neighbour and form one shared wall");
assert.equal(align.walls.filter((wall) => wall.exterior).length, 6, "two tiled rooms have six exterior walls, not eight");
assert.equal(align.rooms.find((room) => room.name === "Right")!.x, 17, "the latched edge must land exactly on its neighbour");
assert.ok(
  buildSpatialModel(align, { doorMode: "model" }).wallVolumes.length === 7,
  "a cleanly shared wall must not produce a doubled 3D volume",
);

// A latch is reported, never silent.
let reported = createInitialProject();
reported = applyOperation(reported, { type: "create_room", floorId: "floor-ground", name: "A", roomType: "Custom", x: 3, y: 10, width: 12, length: 12 }, "agent").project;
const latchOutcome = applyOperation(reported, { type: "create_room", floorId: "floor-ground", name: "B", roomType: "Custom", x: 15.03, y: 10.02, width: 9, length: 12 }, "agent");
assert.ok(latchOutcome.result.alignment, "an applied alignment must be reported back to the caller");
reported = latchOutcome.project;
assert.equal(reported.walls.filter((wall) => wall.roomIds.length === 2).length, 1, "agent-supplied coordinates must align the same way as human drags");

// An exact dimension is never silently snapped.
const exact = applyOperation(align, { type: "resize_room", roomId: align.rooms[0].id, width: 13.75, length: 15.25 }, "human");
assert.equal(exact.result.room && (exact.result.room as { width: number }).width, 13.75, "a stated exact dimension must be preserved");

// Rooms may touch but never overlap, and a refusal must not mutate the project.
const beforeOverlap = JSON.stringify(align);
assert.throws(
  () => applyOperation(align, { type: "create_room", floorId: "floor-ground", name: "Clash", roomType: "Custom", x: 8, y: 14, width: 10, length: 10 }, "human"),
  /cannot occupy the same floor area/,
  "an overlapping room must be refused at the operation",
);
assert.equal(JSON.stringify(align), beforeOverlap, "a refused overlap must leave the project untouched");
assert.throws(
  () => applyOperation(align, { type: "move_room", roomId: align.rooms[1].id, x: 5, y: 10 }, "human"),
  /cannot occupy the same floor area/,
  "a move that would overlap must be refused",
);
assert.doesNotThrow(
  () => applyOperation(align, { type: "move_room", roomId: align.rooms[1].id, x: 17, y: 26 }, "human"),
  "rooms that only touch remain legal",
);
assert.equal(validateLayout(align).issues.filter((issue) => issue.code === "ROOM_OVERLAP").length, 0, "prevention should make overlap findings unreachable in normal use");

// A door must never open straight onto a flight or into the stairwell void.
let hazard = createInitialProject();
const performHazard = (operation: ArchitectureOperation) => { hazard = applyOperation(hazard, operation, "human").project; };
performHazard({ type: "create_room", floorId: "floor-ground", name: "Lobby", roomType: "Custom", x: 3, y: 10, width: 12, length: 6 });
performHazard({ type: "create_room", floorId: "floor-ground", name: "Stair Hall", roomType: "Custom", x: 3, y: 16, width: 12, length: 16 });
performHazard({ type: "create_floor", name: "Upper", height: 9 });
const hazardUpper = hazard.floors[1].id;
performHazard({ type: "create_room", floorId: hazardUpper, name: "Upper Hall", roomType: "Custom", x: 3, y: 16, width: 12, length: 16 });
performHazard({ type: "add_stairs", floorId: "floor-ground", x: 4, y: 16.5, width: 3.5, length: 7, direction: "up", stairType: "u-shaped", landingDepth: 3.5, wellWidth: 0.5, turnSide: "left" });
const hazardWall = hazard.walls.find((wall) => wall.roomIds.length === 2 && Math.abs(wall.y1 - 16) < 0.01)!;
// centred on the shared wall, this door lands square on the lower flight
performHazard({ type: "add_opening", kind: "door", wallId: hazardWall.id, offset: 3, width: 3, height: 7 });
assert.ok(
  validateLayout(hazard).issues.some((issue) => issue.code === "DOOR_BLOCKED_BY_STAIR"),
  "a door opening onto a stairwell must be reported",
);
// the same door moved to the clear end of the wall is fine
const clearDoor = hazard.openings.find((opening) => opening.kind === "door")!;
hazard = applyOperation(hazard, { type: "update_opening", openingId: clearDoor.id, offset: 10.5 }, "human").project;
assert.equal(
  validateLayout(hazard).issues.filter((issue) => issue.code === "DOOR_BLOCKED_BY_STAIR").length,
  0,
  "a door with clear floor in front of it must not be reported",
);

// Storey height is editable and re-levels everything above it.
let storey = createInitialProject();
storey = applyOperation(storey, { type: "create_room", floorId: "floor-ground", name: "Hall", roomType: "Custom", x: 3, y: 10, width: 10, length: 24 }, "human").project;
storey = applyOperation(storey, { type: "create_floor", name: "Upper", height: 9 }, "human").project;
const storeyUpper = storey.floors[1].id;
storey = applyOperation(storey, { type: "create_room", floorId: storeyUpper, name: "Upper Hall", roomType: "Custom", x: 3, y: 10, width: 10, length: 24 }, "human").project;
storey = applyOperation(storey, { type: "add_stairs", floorId: "floor-ground", x: 4, y: 12, width: 3.5, length: 11, direction: "up" }, "human").project;
const beforeRise = stairConnection(storey, storey.stairs[0])!;
storey = applyOperation(storey, { type: "set_floor_height", floorId: "floor-ground", height: 12 }, "human").project;
const afterRise = stairConnection(storey, storey.stairs[0])!;
assert.equal(storey.floors[0].height, 12, "the storey height must change");
assert.equal(storey.floors.find((floor) => floor.id === storeyUpper)!.elevation, 12, "floors above must be re-levelled");
assert.ok(afterRise.rise > beforeRise.rise, "a taller storey must increase the stair rise");
assert.ok(afterRise.riserCount > beforeRise.riserCount, "a taller storey must add risers");
assert.ok(afterRise.riserHeightInches <= 7.75, "risers must stay within the concept maximum after a height change");
assert.ok(storey.walls.filter((wall) => wall.floorId === "floor-ground").every((wall) => wall.height === 12), "walls must follow their floor's height");
assert.ok(
  validateLayout(storey).issues.some((issue) => issue.code === "INVALID_STAIR_GEOMETRY"),
  "a stair left too short for a taller storey must be reported rather than silently accepted",
);
assert.throws(
  () => applyOperation(storey, { type: "set_floor_height", floorId: "floor-ground", height: 5 }, "human"),
  /between 7 and 16 ft/,
  "an unbuildable storey height must be refused",
);

console.log(JSON.stringify({
  project: { id: project.id, schemaVersion: project.schemaVersion, rooms: project.rooms.length, walls: project.walls.length, openings: project.openings.length },
  topology: { sharedWalls: project.walls.filter((wall) => wall.roomIds.length === 2).length, duplicateWallIds: project.walls.length - new Set(project.walls.map((wall) => wall.id)).size },
  circulation: graph,
  areas: { net: metrics.totalNetFloorArea, gross: metrics.grossCoveredArea, openSite: metrics.openSiteArea },
  persistence: { savedProjects: persistence.listSavedProjects().length, restoredVersion: restored.version, importedProjectId: imported.id },
  multiFloor: { floors: multiFloor.floors.length, firstFloorElevation: firstFloor.elevation, stairEdges: floorGraph.edges.filter((edge) => edge.type === "stair").length },
  alignment: { sharedWalls: align.walls.filter((wall) => wall.roomIds.length === 2).length, exteriorWalls: align.walls.filter((wall) => wall.exterior).length },
  storey: { groundHeight: storey.floors[0].height, upperElevation: storey.floors[1].elevation, rise: stairConnection(storey, storey.stairs[0])!.rise },
  habitability: { codes: Array.from(new Set(validateLayout(habitat).issues.map((issue) => issue.code))) },
  measurement: { carpet: roomCarpetArea(carpet, carpet.rooms[0]), net: roomArea(carpet.rooms[0]), far: groundMetrics.floorAreaRatio },
  spatial: { wallVolumes: walkSpatial.wallVolumes.length, designDoorBlocked: collisionAtDoor(designSpatial), walkDoorBlocked: collisionAtDoor(walkSpatial), renderedFloorIds: Array.from(new Set(multiFloorSpatial.openingFrames.map(({ opening }) => opening.floorId))) },
}, null, 2));
