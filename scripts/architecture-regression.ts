import assert from "node:assert/strict";
import {
  applyOperation,
  buildCirculationGraph,
  createInitialProject,
  inspectRoom,
  migrateProject,
  projectMetrics,
  recommendedStairRun,
  round,
  roomArea,
  roomPerimeter,
  roomVertices,
  stairFootprint,
  stairLocalPoint,
  stairPlanPoint,
  stairConnection,
  validateLayout,
  wallLength,
  type ArchitectureOperation,
  type ExteriorFinishId,
  type Project,
} from "../src/lib/architecture.ts";
import { buildSpatialModel, type SpatialModel } from "../src/lib/spatial3d.ts";

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
perform({ type: "update_opening", openingId: window.id, windowType: "casement", operable: true, glazing: "privacy", solarHeatGainCoefficient: 0.4, visibleTransmittance: 0.35, uFactor: 0.45 });
assert.equal(project.openings.find((opening) => opening.id === window.id)?.glazing, "privacy");
assert.equal(project.openings.find((opening) => opening.id === window.id)?.visibleTransmittance, 0.35);

const metrics = projectMetrics(project);
assert.ok(metrics.grossCoveredArea > metrics.totalNetFloorArea, "gross area should include canonical wall footprints");
assert.equal(metrics.openSiteArea, metrics.plotArea - projectMetrics(project).grossCoveredArea);

persistence.saveProjectLocally(project);
const restored = persistence.loadLatestProject()!;
assert.equal(restored.id, project.id);
assert.equal(restored.schemaVersion, 4);
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

let multiFloor = createInitialProject();
const performMultiFloor = (operation: ArchitectureOperation) => {
  multiFloor = applyOperation(multiFloor, operation, "agent").project;
};
performMultiFloor({ type: "create_room", floorId: "floor-ground", name: "Ground Hall", roomType: "Custom", x: 3, y: 10, width: 12, length: 12 });
performMultiFloor({ type: "create_floor", name: "First Floor", height: 9 });
const firstFloor = multiFloor.floors.find((floor) => floor.level === 1)!;
performMultiFloor({ type: "create_room", floorId: firstFloor.id, name: "Upper Hall", roomType: "Custom", x: 3, y: 10, width: 12, length: 12 });
const stairRun = recommendedStairRun(multiFloor, "floor-ground", "up");
performMultiFloor({ type: "add_stairs", floorId: "floor-ground", x: 5, y: 10, width: 3.5, length: stairRun, direction: "up" });
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
assert.deepEqual(stairFootprint(rotatedStair), { x: 5, y: 10, width: stairRun, length: 3.5 }, "90-degree stair rotation should swap its plan footprint dimensions");
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

let legacyProject = createInitialProject();
legacyProject = applyOperation(legacyProject, { type: "create_room", floorId: "floor-ground", name: "Legacy Room", roomType: "Custom", x: 3, y: 8, width: 12, length: 14 }, "agent").project;
legacyProject = applyOperation(legacyProject, { type: "create_floor", name: "Legacy Upper" }, "agent").project;
legacyProject = applyOperation(legacyProject, { type: "add_stairs", floorId: "floor-ground", x: 6, y: 9, width: 3.5, length: 11, direction: "up" }, "agent").project;
const legacyDocument = JSON.parse(JSON.stringify(legacyProject)) as Record<string, unknown>;
legacyDocument.schemaVersion = 3;
delete legacyDocument.exteriorFinish;
delete (legacyDocument.rooms as Array<Record<string, unknown>>)[0].shape;
delete (legacyDocument.stairs as Array<Record<string, unknown>>)[0].rotation;
const migratedLegacy = migrateProject(legacyDocument as unknown as Project);
assert.equal(migratedLegacy.schemaVersion, 4, "legacy projects should migrate to schema v4");
assert.equal(migratedLegacy.exteriorFinish, "stucco", "legacy projects should receive a stable default facade finish");
assert.equal(migratedLegacy.rooms[0].shape, "rectangle", "legacy rooms should migrate as rectangles");
assert.equal(migratedLegacy.stairs[0].rotation, 0, "legacy stairs should migrate to zero rotation");

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

console.log(JSON.stringify({
  project: { id: project.id, schemaVersion: project.schemaVersion, rooms: project.rooms.length, walls: project.walls.length, openings: project.openings.length },
  topology: { sharedWalls: project.walls.filter((wall) => wall.roomIds.length === 2).length, duplicateWallIds: project.walls.length - new Set(project.walls.map((wall) => wall.id)).size },
  circulation: graph,
  areas: { net: metrics.totalNetFloorArea, gross: metrics.grossCoveredArea, openSite: metrics.openSiteArea },
  persistence: { savedProjects: persistence.listSavedProjects().length, restoredVersion: restored.version, importedProjectId: imported.id },
  multiFloor: { floors: multiFloor.floors.length, firstFloorElevation: firstFloor.elevation, stairEdges: floorGraph.edges.filter((edge) => edge.type === "stair").length },
  spatial: { wallVolumes: walkSpatial.wallVolumes.length, designDoorBlocked: collisionAtDoor(designSpatial), walkDoorBlocked: collisionAtDoor(walkSpatial), renderedFloorIds: Array.from(new Set(multiFloorSpatial.openingFrames.map(({ opening }) => opening.floorId))) },
}, null, 2));
