import assert from "node:assert/strict";
import { applyOperation, createInitialProject, migrateProject, roomArea, upperFloorBaseFindings, validateLayout, type ArchitectureOperation, type Project } from "../src/lib/architecture.ts";
import { coveredPolygonArea, roomSplitCandidate, snapWallPoint, wallEnclosure } from "../src/lib/wall-planning.ts";
import { buildFloorSlab, buildRoofDeck, buildWallSurfaces } from "../src/lib/model-presentation.ts";
import { buildSpatialModel } from "../src/lib/spatial3d.ts";
import { restoreDesignSnapshot } from "../src/lib/design-history.ts";
import { createArchMorphTools } from "../src/lib/webmcp-tools.ts";

const edit = (project: Project, operation: ArchitectureOperation) => applyOperation(project, operation, "human").project;
const add = { type: "add_wall", floorId: "floor-ground", x1: 4.25, y1: 10.25, x2: 14.25, y2: 10.25 } as const;
let project = edit(createInitialProject(), add);
const id = project.walls[0].id;
for (const operation of [{ ...add }, { ...add, x1: add.x2, x2: add.x1 }, { ...add, x1: -2 }, { ...add, x2: Infinity }, { ...add, y2: NaN },
  ...[0, -1, 3].map(thickness => ({ ...add, thickness })), { type: "move_wall", wallId: id, x2: 4.25, y2: 10.25 },
  { type: "update_wall", wallId: id, length: Infinity }, { type: "update_wall", wallId: id, thickness: 0 }] as ArchitectureOperation[]) {
  const before = JSON.stringify(project);
  assert.throws(() => edit(project, operation));
  assert.equal(JSON.stringify(project), before, "rejected geometry cannot mutate the live draft");
}
assert.deepEqual(snapWallPoint({ x: 4.3, y: 10.3 }, project.walls), { x: 4.25, y: 10.25 });
assert.deepEqual(snapWallPoint({ x: 14.3, y: 10.3 }, project.walls, { x: 4, y: 9 }), { x: 14.25, y: 10.25 }, "an endpoint wins over an axis rule");
assert.deepEqual(snapWallPoint({ x: 18, y: 10.3 }, [], { x: 14.25, y: 10.25 }), { x: 18, y: 10.25 }, "axis constraint retains a fractional start");
assert.deepEqual(snapWallPoint({ x: 9, y: 10.4 }, project.walls), { x: 9, y: 10.25 }, "T junction snaps to the actual host line");
project = edit(project, { type: "add_wall", floorId: "floor-ground", x1: 9, y1: 10.25, x2: 9, y2: 20 });
assert.equal(project.walls[0].connectedWallIds.length, 1);
assert.equal(project.walls[1].connectedWallIds.length, 1);
const tId = project.walls[1].id;
project = edit(project, { type: "move_wall", wallId: tId, dx: 0, dy: 3 });
assert.equal(project.walls[0].connectedWallIds.length, 0);
project = edit(project, { type: "move_wall", wallId: tId, dx: 0, dy: -3 });
project = edit(project, { type: "delete_element", elementId: tId });
assert.deepEqual(project.walls[0].connectedWallIds, []);

project = edit(project, { type: "add_opening", wallId: id, kind: "door", offset: 5, width: 3 });
const doorId = project.openings[0].id;
assert.throws(() => edit(project, { type: "update_wall", wallId: id, length: 4 }), /fit|wall/i);
project = edit(project, { type: "update_wall", wallId: id, length: 11, thickness: 0.7 });
assert.equal(project.openings[0].id, doorId);
assert.equal(project.openings[0].wallId, id);
project = edit(project, { type: "set_wall_finish", wallId: id, finish: "brick" });
assert.ok(buildWallSurfaces(project, buildSpatialModel(project)).every(p => p.finish === "brick"), "independent finish applies on both sides");
const badImport = { ...project, walls: [{ ...project.walls[0], x2: project.walls[0].x1, y2: project.walls[0].y1 }] };
assert.ok(validateLayout(badImport).issues.some(i => i.code === "INVALID_WALL"));
assert.ok(validateLayout({ ...project, walls: [...project.walls, { ...project.walls[0], id: "duplicate" }] }).issues.some(i => i.code === "DUPLICATE_WALL"));
const canonicalFragment = { ...project.walls[0], x2: project.walls[0].x1 + 0.5, y2: project.walls[0].y1, roomIds: ["boundary-room"] };
assert.ok(!validateLayout({ ...project, walls: [canonicalFragment], openings: [] }).issues.some(i => i.code === "INVALID_WALL"), "short canonical boundary fragments remain valid");

// Reversed and segmented enclosure edges retain physical IDs, dimensions, openings and finishes.
let loop = createInitialProject();
for (const [x1, y1, x2, y2] of [[14, 10, 9, 10], [9, 10, 4, 10], [4, 10, 4, 22], [4, 22, 14, 22], [14, 22, 14, 10]]) {
  loop = edit(loop, { type: "add_wall", floorId: "floor-ground", x1, y1, x2, y2, thickness: 0.7 });
}
const loopIds = loop.walls.map(w => w.id);
assert.ok(loop.walls.every(w => w.connectedWallIds.length === 2));
assert.ok(wallEnclosure(loop, loopIds[0]));
loop = edit(loop, { type: "add_opening", wallId: loopIds[2], kind: "door", offset: 6, width: 3 });
loop = edit(loop, { type: "set_wall_finish", wallId: loopIds[2], finish: "timber" });
const beforeConversion = loop;
loop = edit(loop, { type: "create_room_from_walls", wallId: loopIds[0], name: "Enclosed room", roomType: "Custom" });
assert.equal(loop.rooms.length, 1);
assert.equal(loop.walls.length, 5, "conversion cannot leave duplicate independent walls");
assert.deepEqual(new Set(loop.walls.map(w => w.id)), new Set(loopIds));
assert.ok(loop.walls.every(w => w.thickness === 0.7 && w.roomIds.length === 1));
assert.equal(loop.walls.find(w => w.id === loopIds[2])!.finish, "timber");
assert.equal(loop.openings[0].wallId, loopIds[2]);
assert.ok(buildFloorSlab(loop, loop.rooms[0]).length);
assert.ok(buildRoofDeck(loop, "floor-ground", buildSpatialModel(loop)).length);
assert.deepEqual(new Set(migrateProject(loop).walls.map(w => w.id)), new Set(loopIds));
assert.equal(restoreDesignSnapshot(beforeConversion, loop).rooms.length, 0);

// Partition becomes a semantic shared boundary with a real room-to-room door.
let split = edit(createInitialProject(), { type: "create_room", floorId: "floor-ground", name: "Original", roomType: "Custom", x: 4, y: 10, width: 12, length: 12 });
const originalId = split.rooms[0].id;
const north = split.walls.find(w => w.y1 === 10 && w.y2 === 10)!;
split = edit(split, { type: "set_wall_finish", wallId: north.id, finish: "brick" });
split = edit(split, { type: "add_wall", floorId: "floor-ground", x1: 10, y1: 10, x2: 10, y2: 22 });
const partition = split.walls.at(-1)!;
split = edit(split, { type: "add_opening", kind: "door", wallId: partition.id, offset: 6, width: 3 });
const splitBefore = split;
assert.equal(roomSplitCandidate(split, partition.id)!.id, originalId);
split = edit(split, { type: "split_room_with_wall", roomId: originalId, wallId: partition.id, name: "Second" });
assert.equal(split.rooms.length, 2);
assert.equal(split.rooms.reduce((sum, r) => sum + roomArea(r), 0), 144);
assert.ok(split.rooms.some(r => r.id === originalId));
assert.equal(split.walls.find(w => w.id === partition.id)!.roomIds.length, 2);
assert.equal(split.openings[0].wallId, partition.id);
assert.ok(split.walls.filter(w => w.y1 === 10 && w.y2 === 10).every(w => w.finish === "brick"));
assert.equal(restoreDesignSnapshot(splitBefore, split).rooms.length, 1);
let blocked = edit(splitBefore, { type: "add_opening", kind: "window", wallId: north.id, offset: 6, width: 4 });
assert.throws(() => edit(blocked, { type: "split_room_with_wall", roomId: originalId, wallId: partition.id }), /fit|host/i);
assert.equal(blocked.rooms.length, 1);
blocked = edit(beforeConversion, { type: "add_wall", floorId: "floor-ground", x1: 14, y1: 10, x2: 18, y2: 10 });
assert.equal(wallEnclosure(blocked, loopIds[0]), undefined, "branched networks are never silently converted");

// Footprint guidance uses union area, partial coverage and stair voids, with exact angled intersections.
const rect = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
assert.equal(coveredPolygonArea(rect(0, 0, 10, 10), [rect(0, 0, 6, 10), rect(4, 0, 6, 10)], [rect(2, 2, 2, 2)]), 96);
assert.equal(coveredPolygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], [rect(0, 0, 5, 10)]), 12.5);
let upper = edit(createInitialProject(), { type: "create_room", floorId: "floor-ground", name: "Lower", roomType: "Custom", x: 4, y: 10, width: 12, length: 12 });
upper = edit(upper, { type: "create_floor", name: "Upper", height: 9 });
const upperId = upper.floors[1].id;
upper = edit(upper, { type: "create_room", floorId: upperId, name: "Aligned", roomType: "Custom", x: 4, y: 10, width: 12, length: 12 });
assert.equal(upperFloorBaseFindings(upper, upperId).length, 0);
upper = edit(upper, { type: "add_wall", floorId: upperId, x1: 20, y1: 35, x2: 27, y2: 35 });
assert.equal(upperFloorBaseFindings(upper, upperId).length, 1);
upper = edit(upper, { type: "create_room", floorId: upperId, name: "Beyond lower floor", roomType: "Custom", x: 4, y: 35, width: 10, length: 10 });
assert.equal(upperFloorBaseFindings(upper, upperId).length, 2);
upper = edit(upper, { type: "add_stairs", floorId: "floor-ground", x: 7, y: 12, width: 3, length: 6, direction: "up", rotation: 0 });
assert.ok(!upperFloorBaseFindings(upper, upperId).some(f => f.name === "Aligned"), "intentional stair voids are excluded from occupied support targets");
assert.ok(upperFloorBaseFindings(upper, upperId).some(f => f.name === "Beyond lower floor"), "real overhang guidance remains");
assert.equal(upper.floors[1].elevation, 9, "guidance never changes the intended floor elevation");

let agentProject = createInitialProject();
const tools = createArchMorphTools({ getProject: () => agentProject, perform: operation => { const out = applyOperation(agentProject, operation, "agent"); agentProject = out.project; return out; }, exportPlan: () => ({}), captureSnapshot: async () => ({}), noteActivity: () => {} });
assert.throws(() => tools.find(t => t.name === "add_wall")!.execute({ floorId: add.floorId, x1: add.x1, y1: add.y1, x2: Infinity, y2: add.y2 }), /finite/);
assert.throws(() => tools.find(t => t.name === "add_wall")!.execute({ floorId: add.floorId, x1: add.x1, y1: add.y1, x2: add.x2, y2: add.y2, thickness: -1 }), /thickness/);
assert.equal(tools.filter(t => ["update_wall", "create_room_from_walls", "split_room_with_wall"].includes(t.name)).length, 3);
console.log("Wall regression passed: finite geometry, duplicates, exact snapping, T-junctions, atomic host retention, finishes, enclosure conversion, room splitting, Undo, migration and upper-floor/void guidance.");
