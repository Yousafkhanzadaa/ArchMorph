import { openingCenter, roomContainsPoint, roomInteriorPoint, wallLength, type Opening, type PlanPoint, type Project } from "./architecture.ts";

export function doorSwingSign(project: Project, opening: Opening) {
  const wall = project.walls.find(w => w.id === opening.wallId);
  const room = project.rooms.find(r => r.id === opening.opensIntoRoomId);
  if (wall && room && wall.roomIds.includes(room.id)) {
    const length = wallLength(wall), nx = -(wall.y2 - wall.y1) / length, ny = (wall.x2 - wall.x1) / length;
    const center = openingCenter(wall, opening);
    if (roomContainsPoint(room, { x: center.x + nx * 0.5, y: center.y + ny * 0.5 })) return 1;
    if (roomContainsPoint(room, { x: center.x - nx * 0.5, y: center.y - ny * 0.5 })) return -1;
    const interior = roomInteriorPoint(room);
    return (interior.x - center.x) * nx + (interior.y - center.y) * ny >= 0 ? 1 : -1;
  }
  return (opening.swingDirection === "outward" ? 1 : -1) * (opening.handing === "right" ? -1 : 1);
}

/** SVG's clockwise flag also depends on which end hosts the hinge. */
export function doorArcSweepFlag(project: Project, opening: Opening) {
  return (opening.hingeSide === "end" ? -1 : 1) * doorSwingSign(project, opening) > 0 ? 1 : 0;
}

/** Occupied quarter-circle swept by a fully opened leaf, shared by checks and drawings. */
export function doorSweepPolygon(project: Project, opening: Opening): PlanPoint[] {
  const wall = project.walls.find(w => w.id === opening.wallId);
  if (!wall || opening.kind !== "door") return [];
  const length = wallLength(wall), dx = (wall.x2 - wall.x1) / length, dy = (wall.y2 - wall.y1) / length;
  const center = openingCenter(wall, opening), hinge = opening.hingeSide === "end" ? 1 : -1, sign = doorSwingSign(project, opening);
  const origin = { x: center.x + dx * hinge * opening.width / 2, y: center.y + dy * hinge * opening.width / 2 };
  return [origin, ...Array.from({ length: 17 }, (_, i) => {
    const t = i * Math.PI / 32;
    return { x: origin.x - dx * hinge * opening.width * Math.cos(t) - dy * sign * opening.width * Math.sin(t), y: origin.y - dy * hinge * opening.width * Math.cos(t) + dx * sign * opening.width * Math.sin(t) };
  })];
}
