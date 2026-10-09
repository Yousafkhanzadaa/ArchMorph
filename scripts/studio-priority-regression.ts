import assert from "node:assert/strict";
import { applyOperation, cloneProject, createInitialProject, migrateProject, validateLayout, sharedRoomBoundary, wallLength, type Project } from "../src/lib/architecture.ts";
import { restoreDesignSnapshot } from "../src/lib/design-history.ts";
import * as persistence from "../src/lib/persistence.ts";
import { createArchMorphTools } from "../src/lib/webmcp-tools.ts";

const memory = new Map<string, string>();
let refuseWrite = false;
const store = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { if (refuseWrite) throw new Error("QuotaExceededError"); memory.set(key, value); },
};
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: store } });
let transaction = Promise.resolve();
let lockCount = 0;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: (_key: string, action: () => unknown) => {
  lockCount += 1;
  const result = transaction.then(action);
  transaction = result.then(() => undefined, () => undefined);
  return result;
} } } });

let saved = await persistence.createNewLocalProject("Revision QA");
const tabA = cloneProject(saved);
const tabB = cloneProject(saved);
const results = await Promise.allSettled([
  persistence.saveProjectLocally(applyOperation(tabA, { type: "rename_project", name: "Tab A" }, "human").project),
  persistence.saveProjectLocally(applyOperation(tabB, { type: "rename_project", name: "Tab B" }, "human").project),
]);
assert.equal(results.filter(result => result.status === "fulfilled").length, 1, "only one tab can save from a shared base revision");
const rejection = results.find(result => result.status === "rejected") as PromiseRejectedResult;
assert.equal(rejection.reason.code, "conflict");
saved = persistence.loadSavedProject(saved.id);
assert.equal(saved.name, "Tab A");
assert.notEqual(saved.revisionId, tabA.revisionId);
const staleActivity = cloneProject(tabB);
staleActivity.activity.unshift({ ...staleActivity.activity[0], id: "stale-validation", description: "Validated stale layout" });
await assert.rejects(persistence.saveProjectLocally(staleActivity), { code: "conflict" }, "activity-only stale saves cannot overwrite geometry");
assert.equal(persistence.loadSavedProject(saved.id).name, "Tab A");
const copy = await persistence.duplicateLocalProject(staleActivity);
assert.equal(copy.name, "Revision QA Copy", "conflicting draft remains recoverable as a distinct project");
assert.equal(persistence.loadSavedProject(saved.id).name, "Tab A");

const beforeQuota = memory.get(persistence.PROJECT_STORAGE_KEY);
refuseWrite = true;
await assert.rejects(persistence.saveProjectLocally(applyOperation(saved, { type: "rename_project", name: "Unsaved draft" }, "human").project), { code: "quota" });
assert.equal(memory.get(persistence.PROJECT_STORAGE_KEY), beforeQuota, "failed write leaves saved data intact");
refuseWrite = false;
const checkpoint = await persistence.createProjectCheckpoint(saved, "Preferred arrangement");
assert.equal(persistence.listProjectCheckpoints(saved.id)[0].name, checkpoint.name);
saved = await persistence.saveProjectLocally(applyOperation(saved, { type: "rename_project", name: "Later arrangement" }, "human").project);
assert.equal(persistence.listProjectCheckpoints(saved.id)[0].project.name, "Tab A", "checkpoint stays frozen while design changes");
const restored = restoreDesignSnapshot(checkpoint.project, saved);
assert.equal(restored.version, saved.version + 1);
assert.equal(restored.revisionId, saved.revisionId, "restore saves from the current base, not an old revision");
assert.equal(restored.name, "Tab A");
const restoredSaved = await persistence.saveProjectLocally(restored);
assert.notEqual(restoredSaved.revisionId, saved.revisionId);
for (let index = 1; index < persistence.MAX_CHECKPOINTS; index++) await persistence.createProjectCheckpoint(restoredSaved, `Option ${index}`);
await assert.rejects(persistence.createProjectCheckpoint(restoredSaved, "Too many"), /Remove one/, "checkpoint limit never evicts a named design silently");
await persistence.deleteProjectCheckpoint(saved.id, checkpoint.id);
assert.equal(persistence.listProjectCheckpoints(saved.id).length, persistence.MAX_CHECKPOINTS - 1);
const raw = memory.get(persistence.PROJECT_STORAGE_KEY)!;
memory.set(persistence.PROJECT_STORAGE_KEY, "{invalid");
await assert.rejects(persistence.saveProjectLocally(createInitialProject()), { code: "corrupt" });
assert.equal(memory.get(persistence.PROJECT_STORAGE_KEY), "{invalid", "corrupt libraries are never replaced with empty data");
memory.set(persistence.PROJECT_STORAGE_KEY, raw);
Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("SecurityError"); } } });
await assert.rejects(persistence.saveProjectLocally(createInitialProject()), { code: "unavailable" });
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: store } });
assert.ok(lockCount > 10);

let geometry = createInitialProject();
const perform = (operation: Parameters<typeof applyOperation>[1]) => { geometry = applyOperation(geometry, operation, "human").project; };
perform({ type: "create_room", floorId: geometry.view.activeFloorId, name: "Living", roomType: "Living Room", x: 3, y: 10, width: 12, length: 14 });
perform({ type: "create_room", floorId: geometry.view.activeFloorId, name: "Kitchen", roomType: "Kitchen", x: 15, y: 10, width: 9, length: 14 });
const [living, kitchen] = geometry.rooms;
const shared = geometry.walls.find(wall => wall.roomIds.includes(living.id) && wall.roomIds.includes(kitchen.id))!;
perform({ type: "add_opening", kind: "door", wallId: shared.id, offset: wallLength(shared) / 2 });
const doorId = geometry.openings[0].id;
const initial = cloneProject(geometry);
perform({ type: "adjust_shared_boundary", roomId: living.id, neighborRoomId: kitchen.id, position: 16 });
assert.equal(geometry.version, initial.version + 1, "two-room boundary edit is a single canonical operation");
assert.equal(geometry.rooms[0].width, 13);
assert.equal(geometry.rooms[1].width, 8);
assert.equal(geometry.rooms[1].x, 16);
assert.equal(geometry.openings[0].id, doorId);
const movedHost = geometry.walls.find(wall => wall.id === geometry.openings[0].wallId)!;
assert.equal(movedHost.x1, 16);
assert.equal(movedHost.roomIds.length, 2);
const beforeReject = JSON.stringify(geometry);
assert.throws(() => applyOperation(geometry, { type: "adjust_shared_boundary", roomId: living.id, neighborRoomId: kitchen.id, position: 23 }, "human"), /at least 3 ft/);
assert.equal(JSON.stringify(geometry), beforeReject, "invalid compound edit leaves original geometry and opening hosts intact");
assert.ok(sharedRoomBoundary(geometry, living.id, kitchen.id));

let stacked = createInitialProject();
const stackEdit = (operation: Parameters<typeof applyOperation>[1]) => { stacked = applyOperation(stacked, operation, "human").project; };
stackEdit({ type: "create_room", floorId: stacked.view.activeFloorId, name: "Front", roomType: "Living Room", x: 3, y: 10, width: 12, length: 14 });
stackEdit({ type: "create_room", floorId: stacked.view.activeFloorId, name: "Rear", roomType: "Bedroom", x: 3, y: 24, width: 12, length: 13 });
const sharedHorizontal = stacked.walls.find(wall => wall.roomIds.length === 2)!;
stackEdit({ type: "add_opening", kind: "door", wallId: sharedHorizontal.id, offset: 6 });
const facadeWall = stacked.walls.find(wall => wall.exterior && wall.y1 === 10 && wall.y2 === 10)!;
stackEdit({ type: "set_wall_finish", wallId: facadeWall.id, finish: "brick" });
stackEdit({ type: "add_facade_feature", kind: "sunshade", wallId: facadeWall.id, offset: 6, width: 4 });
const featureId = stacked.facadeFeatures[0].id;
const horizontalDoorId = stacked.openings[0].id;
stackEdit({ type: "adjust_shared_boundary", roomId: stacked.rooms[0].id, neighborRoomId: stacked.rooms[1].id, position: 25 });
assert.equal(stacked.rooms[0].length, 15);
assert.equal(stacked.rooms[1].y, 25);
assert.equal(stacked.rooms[1].length, 12);
assert.equal(stacked.openings[0].id, horizontalDoorId);
assert.equal(stacked.walls.find(wall => wall.id === stacked.openings[0].wallId)!.y1, 25);
assert.equal(stacked.facadeFeatures[0].id, featureId, "compound changes retain facade identities");
assert.equal(stacked.walls.find(wall => wall.id === stacked.facadeFeatures[0].wallId)!.finish, "brick", "compound changes retain exterior material overrides");

let detached = createInitialProject();
detached = applyOperation(detached, { type: "create_room", floorId: detached.view.activeFloorId, name: "Bedroom", roomType: "Bedroom", x: 7, y: 15, width: 10, length: 12 }, "human").project;
for (const [anchor, x, y] of [["north-west", 7, 15], ["north-east", 6, 15], ["south-west", 7, 14], ["south-east", 6, 14]] as const) {
  const next = applyOperation(detached, { type: "resize_room", roomId: detached.rooms[0].id, width: 11, length: 13, anchor }, "human").project;
  assert.equal(next.rooms[0].x, x); assert.equal(next.rooms[0].y, y);
  assert.equal(detached.rooms[0].width, 10, "corner resize does not mutate source snapshots");
}
const wall = detached.walls.find(wall => wall.exterior && wall.roomIds.includes(detached.rooms[0].id))!;
assert.throws(() => applyOperation(detached, { type: "resize_room", roomId: detached.rooms[0].id, width: NaN, length: 12 }, "human"), /finite numbers/);
detached = applyOperation(detached, { type: "add_opening", kind: "window", wallId: wall.id, offset: 5, width: 4, height: 4, sillHeight: 3 }, "human").project;
const windowId = detached.openings[0].id;
const egressCodes = (project: Project) => validateLayout(project).issues.filter(issue => issue.code.startsWith("BEDROOM_")).map(issue => issue.code);
assert.ok(egressCodes(detached).includes("BEDROOM_NO_EGRESS"), "fixed nominally large glazing cannot count as an escape window");
detached = applyOperation(detached, { type: "update_opening", openingId: windowId, windowType: "casement" }, "human").project;
assert.equal(detached.openings[0].operable, true);
assert.ok(egressCodes(detached).includes("BEDROOM_EGRESS_UNVERIFIED"), "unknown clear size remains unverified");
detached = applyOperation(detached, { type: "update_opening", openingId: windowId, clearWidth: 2, clearHeight: 3 }, "human").project;
assert.deepEqual(egressCodes(detached), [], "known clear size can satisfy the implemented concept threshold");
assert.throws(() => applyOperation(detached, { type: "update_opening", openingId: windowId, clearWidth: 5 }, "human"), /nominal/);
detached = applyOperation(detached, { type: "update_opening", openingId: windowId, clearWidth: null }, "human").project;
assert.ok(egressCodes(detached).includes("BEDROOM_EGRESS_UNVERIFIED"));
assert.throws(() => applyOperation(detached, { type: "update_opening", openingId: windowId, windowType: "fixed", operable: true }, "human"), /fixed window cannot be operable/);
const legacy = cloneProject(detached); legacy.openings[0].windowType = "fixed"; legacy.openings[0].operable = true;
assert.equal(migrateProject(legacy).openings[0].windowType, "casement", "legacy inconsistent windows retain operability with a consistent type");
const walked = cloneProject(saved);
walked.view = { ...walked.view, mode: "3d", navigationMode: "walk", walkStartRoomId: "missing-room" };
const restoreWhileWalking = restoreDesignSnapshot(checkpoint.project, walked);
assert.equal(restoreWhileWalking.view.mode, "3d", "Undo and checkpoint restores retain the user's display mode");
assert.equal(restoreWhileWalking.view.walkStartRoomId, undefined, "restore clears references to rooms that no longer exist");

let agentProject = initial;
const tools = createArchMorphTools({ getProject: () => agentProject, perform: operation => { const outcome = applyOperation(agentProject, operation, "agent"); agentProject = outcome.project; return outcome; }, noteActivity: () => undefined, captureSnapshot: async () => ({}), exportPlan: () => ({}) });
await tools.find(tool => tool.name === "adjust_shared_boundary")!.execute({ roomId: living.id, neighborRoomId: kitchen.id, position: 16 });
assert.deepEqual(agentProject.rooms, geometry.rooms, "human and agent shared-boundary edits produce the same geometry");
console.log("Studio priorities passed: serialized conflicting saves, stale activity, quota/unavailable/corrupt storage, durable checkpoint limits, new restore revisions, four resize anchors, atomic shared boundary, opening hosts, escape uncertainty and agent parity.");
