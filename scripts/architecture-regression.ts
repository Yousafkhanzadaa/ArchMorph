import assert from "node:assert/strict";
import {
  applyOperation,
  buildCirculationGraph,
  createInitialProject,
  projectMetrics,
  recommendedStairRun,
  stairConnection,
  validateLayout,
  wallLength,
  type ArchitectureOperation,
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
assert.equal(restored.schemaVersion, 3);
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
performMultiFloor({ type: "update_stairs", stairId: stair.id, length: 6 });
assert.ok(validateLayout(multiFloor).issues.some((issue) => issue.code === "INVALID_STAIR_GEOMETRY"), "short straight stair runs should be flagged");

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
