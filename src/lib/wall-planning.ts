import type { PlanPoint, Project, Wall } from "./architecture.ts";

const EPS = 0.001;
export const samePoint = (a: PlanPoint, b: PlanPoint) => Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
export const wallEnds = (wall: Wall): [PlanPoint, PlanPoint] => [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }];
export const sameWallSpan = (a: Wall, b: Wall) => a.floorId === b.floorId && (
  samePoint(wallEnds(a)[0], wallEnds(b)[0]) && samePoint(wallEnds(a)[1], wallEnds(b)[1])
  || samePoint(wallEnds(a)[0], wallEnds(b)[1]) && samePoint(wallEnds(a)[1], wallEnds(b)[0]));
export function pointOnSegment(point: PlanPoint, a: PlanPoint, b: PlanPoint) {
  const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
  if (!squared) return samePoint(point, a);
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared;
  return t >= -EPS && t <= 1 + EPS && Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) < 0.01;
}
export function wallsTouch(a: Wall, b: Wall) {
  return a.floorId === b.floorId && (wallEnds(a).some(p => pointOnSegment(p, ...wallEnds(b)))
    || wallEnds(b).some(p => pointOnSegment(p, ...wallEnds(a))));
}
export function wallFootprintPolygon(wall: Wall): PlanPoint[] {
  const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (!length || !Number.isFinite(length) || wall.thickness <= 0) return [];
  const x = -(wall.y2 - wall.y1) / length * wall.thickness / 2;
  const y = (wall.x2 - wall.x1) / length * wall.thickness / 2;
  return [{ x: wall.x1 + x, y: wall.y1 + y }, { x: wall.x2 + x, y: wall.y2 + y },
    { x: wall.x2 - x, y: wall.y2 - y }, { x: wall.x1 - x, y: wall.y1 - y }];
}
export const polygonArea = (points: PlanPoint[]) => Math.abs(points.reduce((sum, p, i) => {
  const next = points[(i + 1) % points.length]; return sum + p.x * next.y - next.x * p.y;
}, 0)) / 2;
export const roomPolygon = (room: Project["rooms"][number]): PlanPoint[] => room.vertices ?? [
  { x: room.x, y: room.y }, { x: room.x + room.width, y: room.y },
  { x: room.x + room.width, y: room.y + room.length }, { x: room.x, y: room.y + room.length },
];
export function lowerFloorReference(project: Project, floorId: string) {
  const floor = project.floors.find(f => f.id === floorId);
  return floor ? project.floors.filter(f => f.elevation < floor.elevation - EPS).sort((a, b) => b.elevation - a.elevation)[0] : undefined;
}

/** Endpoints and projections win over grid/angle constraints, including precise imported geometry. */
export function snapWallPoint(point: PlanPoint, walls: Wall[], start?: PlanPoint, tolerance = 0.55): PlanPoint {
  const endpoints = walls.flatMap(wallEnds);
  const end = endpoints.map(p => ({ p, distance: Math.hypot(p.x - point.x, p.y - point.y) }))
    .filter(hit => hit.distance <= tolerance).sort((a, b) => a.distance - b.distance)[0];
  if (end) return { ...end.p };
  const projections = walls.flatMap(wall => {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, squared = dx * dx + dy * dy;
    if (!squared) return [];
    const t = ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / squared;
    if (t <= 0 || t >= 1) return [];
    const p = { x: wall.x1 + t * dx, y: wall.y1 + t * dy };
    return [{ p, distance: Math.hypot(p.x - point.x, p.y - point.y) }];
  }).filter(hit => hit.distance <= tolerance).sort((a, b) => a.distance - b.distance);
  if (projections[0]) return { x: Math.round(projections[0].p.x * 100) / 100, y: Math.round(projections[0].p.y * 100) / 100 };
  const grid = (value: number) => Math.round(value * 2) / 2;
  if (!start) return { x: grid(point.x), y: grid(point.y) };
  const dx = point.x - start.x, dy = point.y - start.y, angle = Math.atan2(dy, dx);
  const target = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
  if (Math.abs(Math.atan2(Math.sin(angle - target), Math.cos(angle - target))) <= Math.PI / 18) {
    if (Math.abs(Math.sin(target)) < EPS) return { x: grid(point.x), y: start.y };
    if (Math.abs(Math.cos(target)) < EPS) return { x: start.x, y: grid(point.y) };
    const distance = grid((Math.abs(dx) + Math.abs(dy)) / 2);
    return { x: start.x + Math.sign(dx) * distance, y: start.y + Math.sign(dy) * distance };
  }
  return { x: grid(point.x), y: grid(point.y) };
}

/** A simple orthogonal independent-wall component; ambiguous branches stay independent. */
export function wallEnclosure(project: Project, wallId: string) {
  const first = project.walls.find(w => w.id === wallId && !w.roomIds.length);
  if (!first) return undefined;
  const walls = project.walls.filter(w => w.floorId === first.floorId && !w.roomIds.length);
  const component = [first];
  for (let i = 0; i < component.length; i++) for (const wall of walls) {
    if (!component.some(w => w.id === wall.id) && wallsTouch(component[i], wall)) component.push(wall);
  }
  if (component.length < 4 || component.length > 12 || component.some(w => Math.abs(w.x2 - w.x1) > EPS && Math.abs(w.y2 - w.y1) > EPS)) return undefined;
  const vertices = [wallEnds(first)[0]], ids = [first.id];
  let current = wallEnds(first)[1];
  while (!samePoint(current, vertices[0])) {
    vertices.push(current);
    const next = component.filter(w => !ids.includes(w.id) && wallEnds(w).some(p => samePoint(p, current)));
    if (next.length !== 1) return undefined;
    ids.push(next[0].id);
    const ends = wallEnds(next[0]); current = samePoint(ends[0], current) ? ends[1] : ends[0];
    if (vertices.length > 12) return undefined;
  }
  if (ids.length !== component.length || polygonArea(vertices) < 9) return undefined;
  const corners = vertices.filter((p, i) => {
    const a = vertices[(i - 1 + vertices.length) % vertices.length], b = vertices[(i + 1) % vertices.length];
    return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > EPS;
  });
  return { floorId: first.floorId, wallIds: ids, vertices: corners, area: polygonArea(corners) };
}

export function roomSplitCandidate(project: Project, wallId: string) {
  const wall = project.walls.find(w => w.id === wallId && !w.roomIds.length);
  if (!wall) return undefined;
  const horizontal = Math.abs(wall.y2 - wall.y1) < EPS;
  const vertical = Math.abs(wall.x2 - wall.x1) < EPS;
  return project.rooms.find(room => room.floorId === wall.floorId && (!room.vertices || room.vertices.length === 4 && Math.abs(polygonArea(room.vertices) - room.width * room.length) < EPS) && (
    horizontal && Math.abs(Math.min(wall.x1, wall.x2) - room.x) < EPS && Math.abs(Math.max(wall.x1, wall.x2) - room.x - room.width) < EPS
      && wall.y1 - room.y >= 3 && room.y + room.length - wall.y1 >= 3
    || vertical && Math.abs(Math.min(wall.y1, wall.y2) - room.y) < EPS && Math.abs(Math.max(wall.y1, wall.y2) - room.y - room.length) < EPS
      && wall.x1 - room.x >= 3 && room.x + room.width - wall.x1 >= 3));
}

type Interval = [number, number];
function intervals(points: PlanPoint[], x: number): Interval[] {
  const ys: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x)) ys.push(a.y + (x - a.x) * (b.y - a.y) / (b.x - a.x));
  }
  ys.sort((a, b) => a - b);
  return ys.filter((_, i) => i % 2 === 0).map((y, i) => [y, ys[i * 2 + 1]]);
}
function union(items: Interval[]) {
  const merged: Interval[] = [];
  for (const [low, high] of items.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && low <= last[1]) last[1] = Math.max(last[1], high); else merged.push([low, high]);
  }
  return merged;
}
function subtract(items: Interval[], holes: Interval[]) {
  return holes.reduce((parts, [low, high]) => parts.flatMap(([a, b]): Interval[] => high <= a || low >= b ? [[a, b]]
    : [...(low > a ? [[a, low] as Interval] : []), ...(high < b ? [[high, b] as Interval] : [])]), items);
}
/** Exact planar overlap by vertical sweep, including slanted walls, concave rooms and stair voids. */
export function coveredPolygonArea(target: PlanPoint[], footprints: PlanPoint[][], holes: PlanPoint[][] = []) {
  if (!target.length || !footprints.length) return 0;
  const all = [target, ...footprints, ...holes];
  const edges = all.flatMap(points => points.map((a, i) => [a, points[(i + 1) % points.length]]));
  const xs = all.flatMap(points => points.map(p => p.x));
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const [a, b] = edges[i], [c, d] = edges[j];
    const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y;
    const cross = dx * ey - dy * ex;
    if (Math.abs(cross) < EPS) continue;
    const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / cross;
    const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / cross;
    if (t > 0 && t < 1 && u > 0 && u < 1) xs.push(a.x + t * dx);
  }
  const cuts = [...new Set(xs)].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const x = (cuts[i] + cuts[i + 1]) / 2;
    const base = subtract(union(footprints.flatMap(p => intervals(p, x))), union(holes.flatMap(p => intervals(p, x))));
    const length = intervals(target, x).reduce((sum, [a, b]) => sum + base.reduce((s, [c, d]) => s + Math.max(0, Math.min(b, d) - Math.max(a, c)), 0), 0);
    area += length * (cuts[i + 1] - cuts[i]);
  }
  return Math.min(polygonArea(target), Math.max(0, area));
}
