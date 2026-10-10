import { balconyPolygon, roomContainsPoint, roomVertices, type PlanPoint, type Project } from "./architecture.ts";
import { buildSpatialModel, type CollisionSegment } from "./spatial3d.ts";

/** The same closed doors and railings used by the visible model block a walker. */
export function walkCollisionSegments(project: Project, floorId: string, modelSegments?: CollisionSegment[]): CollisionSegment[] {
  const segments = (modelSegments ?? buildSpatialModel(project).collisionSegments).filter(s => s.floorId === floorId);
  for (const b of project.balconies.filter(b => b.floorId === floorId && b.railing.enabled)) {
    const vertices = balconyPolygon(b);
    for (const [index, side] of ["north", "east", "south", "west"].entries()) if (b.railing.sides.includes(side as "north" | "east" | "south" | "west")) {
      const a = vertices[index], c = vertices[(index + 1) % 4];
      segments.push({ floorId, x1: a.x, z1: a.y, x2: c.x, z2: c.y, thickness: 0.12, wallIds: [b.id] });
    }
  }
  return segments;
}

function segmentDistance(point: PlanPoint, a: PlanPoint, b: PlanPoint) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

/** Upper storeys require a modeled surface. Ground-level site exploration stays available. */
export function walkSurfaceContains(project: Project, floorId: string, point: PlanPoint) {
  const floor = project.floors.find(f => f.id === floorId);
  if (!floor) return false;
  if (floor.elevation === Math.min(...project.floors.map(f => f.elevation))) return point.x >= 0 && point.y >= 0 && point.x <= project.plot.width && point.y <= project.plot.length;
  const polygons = [
    ...project.rooms.filter(r => r.floorId === floorId && r.type !== "Courtyard").map(roomVertices),
    ...project.balconies.filter(b => b.floorId === floorId).map(balconyPolygon),
  ];
  // Tolerate rounding at shared slab edges so door thresholds remain traversable.
  return polygons.some(vertices => roomContainsPoint({ id: "walk-surface", floorId, name: "Surface", type: "Custom", color: "", wallIds: [], vertices, x: 0, y: 0, width: 0, length: 0 }, point)
    || vertices.some((a, i) => segmentDistance(point, a, vertices[(i + 1) % vertices.length]) <= 0.02));
}
