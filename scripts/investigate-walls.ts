/** Current diagnostic snapshot. The original pre-fix findings remain in docs/verification/walls-investigation-data.json. */
import assert from "node:assert/strict";
import { applyOperation, createInitialProject, migrateProject, validateLayout, type ArchitectureOperation, type Project } from "../src/lib/architecture.ts";
import { buildSpatialModel } from "../src/lib/spatial3d.ts";
import { buildFloorSlab, buildRoofDeck, buildWallSurfaces } from "../src/lib/model-presentation.ts";

const edit = (project: Project, operation: ArchitectureOperation) => applyOperation(project, operation, "human").project;
const issues = (project: Project, floorId?: string) => validateLayout(project, floorId).issues.map(issue => issue.code);
const findings: Record<string, unknown> = {};
let project = createInitialProject();
project = edit(project, { type: "create_room", floorId: "floor-ground", name: "Lower", roomType: "Custom", x: 4, y: 10, width: 12, length: 12 });
project = edit(project, { type: "create_floor", name: "Upper", height: 9 });
const upper = project.floors[1];
assert.equal(upper.elevation, 9);
assert.equal(project.rooms.filter(room => room.floorId === upper.id).length, 0);
findings.floorCreation = { elevation: upper.elevation, copiesLowerFootprint: false, hasExplicitSlabEntity: false };

project = edit(project, { type: "add_wall", floorId: upper.id, x1: 20, y1: 35, x2: 27, y2: 35 });
const firstWall = project.walls.at(-1)!;
const surfaces = buildWallSurfaces(project, buildSpatialModel(project)).filter(patch => patch.elementId === firstWall.id);
const heights = surfaces.flatMap(patch => patch.points.map(point => point[1]));
assert.equal(Math.min(...heights), 9);
assert.equal(Math.max(...heights), 18);
findings.upperWall = { base: Math.min(...heights), top: Math.max(...heights), issueCodes: issues(project, upper.id), roofSurfaces: buildRoofDeck(project, upper.id, buildSpatialModel(project)).length };

for (const [x1, y1, x2, y2] of [[27, 35, 27, 45], [27, 45, 20, 45], [20, 45, 20, 35]]) {
  project = edit(project, { type: "add_wall", floorId: upper.id, x1, y1, x2, y2 });
}
const upperWalls = project.walls.filter(wall => wall.floorId === upper.id);
const migrated = migrateProject(project);
findings.closedLoop = {
  wallCount: upperWalls.length,
  rooms: project.rooms.filter(room => room.floorId === upper.id).length,
  issueCodes: issues(project, upper.id),
  liveConnectionCounts: upperWalls.map(wall => wall.connectedWallIds.length),
  afterMigrationConnectionCounts: migrated.walls.filter(wall => wall.floorId === upper.id).map(wall => wall.connectedWallIds.length),
  roofSurfaces: buildRoofDeck(project, upper.id, buildSpatialModel(project)).length,
};
assert.equal(migrated.walls.filter(wall => wall.floorId === upper.id).length, 4, "reload retains independent walls");
assert.equal(migrated.floors[1].elevation, 9, "reload does not lower upper-floor elements");

project = edit(project, { type: "create_room", floorId: upper.id, name: "Over empty ground", roomType: "Custom", x: 4, y: 35, width: 10, length: 10 });
const floatingRoom = project.rooms.at(-1)!;
const slabs = buildFloorSlab(project, floatingRoom);
const slabHeights = slabs.flatMap(patch => patch.points.map(point => point[1]));
assert.equal(Math.min(...slabHeights), 9);
findings.upperRoom = { base: Math.min(...slabHeights), slabTop: Math.max(...slabHeights), slabSurfaces: slabs.length, roofSurfaces: buildRoofDeck(project, upper.id, buildSpatialModel(project)).length, issueCodes: issues(project, upper.id) };
project = edit(project, { type: "set_floor_height", floorId: "floor-ground", height: 12 });
findings.heightChange = { upperElevation: project.floors[1].elevation, independentWallHeight: project.walls.find(wall => wall.id === firstWall.id)!.height };
assert.equal(project.floors[1].elevation, 12);

const add = { type: "add_wall", floorId: "floor-ground", x1: 4, y1: 10, x2: 14, y2: 10 } as const;
const first = edit(createInitialProject(), add);
const invalidOperations: Record<string, { project: Project; operation: ArchitectureOperation }> = {
  duplicateWall: { project: first, operation: add },
  collapsedWall: { project: first, operation: { type: "move_wall", wallId: first.walls[0].id, x2: 4, y2: 10 } },
  outsidePlot: { project: createInitialProject(), operation: { ...add, x1: -2 } },
};
for (const thickness of [0, -0.5, 3]) invalidOperations[`thickness${thickness}`] = { project: createInitialProject(), operation: { ...add, thickness } };
for (const coordinate of [NaN, Infinity]) invalidOperations[`coordinate${String(coordinate)}`] = { project: createInitialProject(), operation: { ...add, x2: coordinate } };
for (const [name, attempt] of Object.entries(invalidOperations)) {
  try {
    edit(attempt.project, attempt.operation);
    findings[name] = { accepted: true };
  } catch (error) { findings[name] = { accepted: false, error: String(error) }; }
  assert.equal((findings[name] as { accepted: boolean }).accepted, false, `${name} must be rejected`);
}

let hosts = edit(createInitialProject(), add);
const host = hosts.walls[0];
hosts = edit(hosts, { type: "add_opening", kind: "door", wallId: host.id, offset: 5, width: 3 });
const openingId = hosts.openings[0].id;
hosts = edit(hosts, { type: "move_wall", wallId: host.id, dx: 2, dy: 2 });
assert.equal(hosts.openings[0].wallId, host.id);
assert.equal(hosts.openings[0].offset, 5);
assert.equal(hosts.openings[0].id, openingId);
findings.hostedOpeningMove = { hostRetained: true, offsetRetained: true, openingIdRetained: true };

let tJunction = edit(createInitialProject(), add);
tJunction = edit(tJunction, { type: "add_wall", floorId: "floor-ground", x1: 9, y1: 10, x2: 9, y2: 20 });
findings.tJunction = { liveConnectionCounts: tJunction.walls.map(wall => wall.connectedWallIds.length), afterMigrationConnectionCounts: migrateProject(tJunction).walls.map(wall => wall.connectedWallIds.length) };
console.log(JSON.stringify(findings, null, 2));
