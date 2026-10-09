import { cloneProject, createId, elementIsOnFloor, type Project } from "./architecture.ts";

/** Restore design data without replaying the old snapshot's temporary camera, floor, or mode. */
export function restoreDesignSnapshot(snapshot: Project, current: Project, preferredSelection?: string) {
  const restored = cloneProject(snapshot);
  const activeFloorId = restored.floors.some((floor) => floor.id === current.view.activeFloorId)
    ? current.view.activeFloorId
    : restored.view.activeFloorId;
  const focusElementId = [preferredSelection, current.view.focusElementId, restored.view.focusElementId]
    .find((id): id is string => Boolean(id && elementIsOnFloor(restored, id, activeFloorId)));
  const walkStartRoomId = current.view.walkStartRoomId
    && restored.rooms.some((room) => room.id === current.view.walkStartRoomId)
    ? current.view.walkStartRoomId
    : undefined;
  return {
    ...restored,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    revisionId: current.revisionId,
    activity: [{ id: createId("activity"), actor: "human" as const, description: `Restored earlier design (v${snapshot.version})`, operation: "restore_design", timestamp: new Date().toISOString(), version: current.version + 1 }, ...current.activity].slice(0, 100),
    view: { ...current.view, activeFloorId, focusElementId, walkStartRoomId },
  };
}

