import { roomContainsPoint, roomVertices, stairConnection, stairLayout, stairPlanOutline, stairPlanPoint, type CameraPreset, type ExteriorFinishId, type PlanPoint, type Project, type Room, type Stair, type Wall } from "./architecture.ts";
import { buildSpatialModel, type SpatialModel } from "./spatial3d.ts";

export type Vec3 = [number, number, number];
export type PresentationVolume = { min: Vec3; max: Vec3; elementIds: string[] };
export type SurfacePatch = { points: [Vec3, Vec3, Vec3, Vec3]; normal: Vec3; elementId?: string; finish?: ExteriorFinishId | "interior" };
export type PresentationBounds = { min: Vec3; max: Vec3 };
const EPS = 0.001;
const token = (value: number) => Math.round(value * 1000);
const unique = (values: number[]) => [...new Set(values.map(value => token(value) / 1000))].sort((a, b) => a - b);

/** Emit only the boundary of a volume union. Internal/coplanar box faces never reach the GPU. */
export function exposedVolumeSurfaces(
  volumes: PresentationVolume[],
  resolve?: (volume: PresentationVolume, center: Vec3, normal: Vec3) => Pick<SurfacePatch, "elementId" | "finish">,
  extraCuts?: (volume: PresentationVolume, axis: number) => number[],
): SurfacePatch[] {
  const planes = new Map<string, PresentationVolume[]>();
  for (const volume of volumes) for (let axis = 0; axis < 3; axis++) for (const side of [0, 1]) {
    const key = `${axis}:${token((side ? volume.max : volume.min)[axis])}:${side}`;
    const bucket = planes.get(key) ?? [];
    bucket.push(volume);
    planes.set(key, bucket);
  }
  const patches: SurfacePatch[] = [];
  for (const volume of volumes) for (let axis = 0; axis < 3; axis++) for (const side of [0, 1]) {
    const plane = (side ? volume.max : volume.min)[axis];
    const [u, v] = [0, 1, 2].filter(a => a !== axis);
    const neighbours = (planes.get(`${axis}:${token(plane)}:${1 - side}`) ?? []).filter(other => other !== volume
      && other.min[u] < volume.max[u] - EPS && other.max[u] > volume.min[u] + EPS
      && other.min[v] < volume.max[v] - EPS && other.max[v] > volume.min[v] + EPS);
    const cuts = (a: number) => unique([volume.min[a], volume.max[a], ...neighbours.flatMap(other => [other.min[a], other.max[a]]), ...(extraCuts?.(volume, a) ?? [])])
      .filter(value => value >= volume.min[a] - EPS && value <= volume.max[a] + EPS);
    const us = cuts(u), vs = cuts(v);
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
      const midU = (us[i] + us[i + 1]) / 2, midV = (vs[j] + vs[j + 1]) / 2;
      if (neighbours.some(other => midU > other.min[u] - EPS && midU < other.max[u] + EPS && midV > other.min[v] - EPS && midV < other.max[v] + EPS)) continue;
      const point = (a: number, b: number): Vec3 => {
        const result: Vec3 = [0, 0, 0]; result[axis] = plane; result[u] = a; result[v] = b; return result;
      };
      let points: SurfacePatch["points"] = [point(us[i], vs[j]), point(us[i + 1], vs[j]), point(us[i + 1], vs[j + 1]), point(us[i], vs[j + 1])];
      // The (u,v) basis points +X, -Y, +Z respectively.
      if ((axis === 1 ? -1 : 1) !== (side ? 1 : -1)) points = [points[3], points[2], points[1], points[0]];
      const normal: Vec3 = [0, 0, 0]; normal[axis] = side ? 1 : -1;
      const center = point(midU, midV);
      patches.push({ points, normal, elementId: volume.elementIds[0], ...resolve?.(volume, center, normal) });
    }
  }
  return patches;
}

function wallDistance(wall: Wall, point: Vec3, normal: Vec3) {
  const dx = wall.x2 - wall.x1, dz = wall.y2 - wall.y1, length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((point[0] - wall.x1) * dx + (point[2] - wall.y1) * dz) / length2)) : 0;
  const distance = Math.hypot(point[0] - wall.x1 - t * dx, point[2] - wall.y1 - t * dz);
  const parallel = normal[1] || Math.abs(normal[0] * dz - normal[2] * dx) / Math.max(0.001, Math.sqrt(length2));
  return distance + (parallel < 0.5 ? wall.thickness * 2 : 0);
}

/** Recover ownership per surface, even when the spatial union spans several canonical walls. */
export function buildWallSurfaces(project: Project, spatial: SpatialModel, ceiling = Infinity) {
  const walls = new Map(project.walls.map(wall => [wall.id, wall]));
  const levels = new Map(project.floors.map(floor => [floor.id, floor.elevation]));
  const volumes = spatial.wallVolumes.map((volume): PresentationVolume => ({
    min: [volume.x, (levels.get(volume.floorId) ?? 0) + volume.bottom, volume.z],
    max: [volume.x + volume.width, Math.min(ceiling, (levels.get(volume.floorId) ?? 0) + volume.top), volume.z + volume.length],
    elementIds: volume.wallIds,
  })).filter(volume => volume.max[1] > volume.min[1] + EPS);
  const candidates = (volume: PresentationVolume) => volume.elementIds.flatMap(id => walls.get(id) ? [walls.get(id)!] : []);
  return exposedVolumeSurfaces(volumes, (volume, point, normal) => {
    const wall = candidates(volume).sort((a, b) => wallDistance(a, point, normal) - wallDistance(b, point, normal))[0];
    const side = wall?.roomSides[0]?.side;
    const outward: Vec3 = side === "north" ? [0, 0, -1] : side === "south" ? [0, 0, 1] : side === "east" ? [1, 0, 0] : [-1, 0, 0];
    const exteriorFace = wall?.exterior && normal[0] * outward[0] + normal[2] * outward[2] >= -0.1;
    return { elementId: wall?.id, finish: exteriorFace ? wall.finish ?? project.exteriorFinish : "interior" };
  }, (volume, axis) => axis === 1 ? [] : candidates(volume).flatMap(wall => axis === 0 ? [wall.x1, wall.x2] : [wall.y1, wall.y2]));
}

function polygonContains(vertices: PlanPoint[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** One continuous ceiling/roof, including wall thickness and clipped stairwell voids. */
export function buildRoofDeck(project: Project, floorId: string, spatial: SpatialModel): SurfacePatch[] {
  const floor = project.floors.find(item => item.id === floorId);
  const rooms = project.rooms.filter(room => room.floorId === floorId && room.type !== "Courtyard");
  if (!floor || !rooms.length) return [];
  const polygons = rooms.map(roomVertices);
  for (const volume of spatial.wallVolumes.filter(volume => volume.floorId === floorId && volume.top >= floor.height - EPS)) {
    polygons.push([{ x: volume.x, y: volume.z }, { x: volume.x + volume.width, y: volume.z }, { x: volume.x + volume.width, y: volume.z + volume.length }, { x: volume.x, y: volume.z + volume.length }]);
  }
  const holes = project.stairs.filter(stair => stairConnection(project, stair)?.lowerFloor.id === floorId).map(stairPlanOutline);
  const deck = orthogonalSlabSurfaces(polygons, holes, floor.elevation + floor.height - 0.12, floor.elevation + floor.height + 0.06,
    (_volume, point) => ({ elementId: rooms.find(room => roomContainsPoint(room, { x: point[0], y: point[2] }))?.id }));
  // Slab edges buried in continuous walls must not compete with the façade at storey joins.
  return deck.flatMap(patch => {
    if (patch.normal[1]) {
      const point = patch.points.reduce((sum, p) => sum.map((value, axis) => value + p[axis] / 4) as Vec3, [0, 0, 0] as Vec3);
      const buried = spatial.wallVolumes.some(volume => {
        const elevation = project.floors.find(item => item.id === volume.floorId)?.elevation ?? 0;
        return point[0] > volume.x - EPS && point[0] < volume.x + volume.width + EPS
          && point[2] > volume.z - EPS && point[2] < volume.z + volume.length + EPS
          && point[1] > elevation + volume.bottom + EPS && point[1] < elevation + volume.top - EPS;
      });
      return buried ? [] : [patch];
    }
    const x = patch.points.reduce((sum, point) => sum + point[0], 0) / 4 - patch.normal[0] * 0.002;
    const z = patch.points.reduce((sum, point) => sum + point[2], 0) / 4 - patch.normal[2] * 0.002;
    const overlaps = spatial.wallVolumes.filter(volume => x > volume.x - EPS && x < volume.x + volume.width + EPS && z > volume.z - EPS && z < volume.z + volume.length + EPS);
    const levels = overlaps.map(volume => {
      const elevation = project.floors.find(item => item.id === volume.floorId)?.elevation ?? 0;
      return { bottom: elevation + volume.bottom, top: elevation + volume.top };
    });
    const bottom = Math.min(...patch.points.map(point => point[1])), top = Math.max(...patch.points.map(point => point[1]));
    const cuts = unique([bottom, top, ...levels.flatMap(level => [level.bottom, level.top])]).filter(y => y >= bottom - EPS && y <= top + EPS);
    return cuts.slice(0, -1).flatMap((low, index) => {
      const high = cuts[index + 1], middle = (low + high) / 2;
      if (levels.some(level => middle > level.bottom - EPS && middle < level.top + EPS)) return [];
      return [{ ...patch, points: patch.points.map(point => [point[0], Math.abs(point[1] - bottom) < EPS ? low : high, point[2]] as Vec3) as SurfacePatch["points"] }];
    });
  });
}

/** Clip stair voids against each room, including voids that cross several room boundaries. */
export function buildFloorSlab(project: Project, room: Room): SurfacePatch[] {
  const floor = project.floors.find(item => item.id === room.floorId);
  if (!floor) return [];
  const holes = project.stairs.filter(stair => stairConnection(project, stair)?.upperFloor.id === floor.id).map(stairPlanOutline);
  return orthogonalSlabSurfaces([roomVertices(room)], holes, floor.elevation, floor.elevation + 0.18, () => ({ elementId: room.id }));
}

function orthogonalSlabSurfaces(
  polygons: PlanPoint[][], holes: PlanPoint[][], bottom: number, top: number,
  resolve: NonNullable<Parameters<typeof exposedVolumeSurfaces>[1]>,
): SurfacePatch[] {
  const xs = unique([...polygons, ...holes].flatMap(polygon => polygon.map(point => point.x)));
  const zs = unique([...polygons, ...holes].flatMap(polygon => polygon.map(point => point.y)));
  const volumes: PresentationVolume[] = [];
  const extendable = new Map<string, PresentationVolume>();
  for (let i = 0; i < xs.length - 1; i++) {
    const spans: Array<{ start: number; end: number }> = [];
    for (let j = 0; j < zs.length - 1; j++) {
      const x = (xs[i] + xs[i + 1]) / 2, z = (zs[j] + zs[j + 1]) / 2;
      if (!polygons.some(polygon => polygonContains(polygon, x, z)) || holes.some(hole => polygonContains(hole, x, z))) continue;
      const previous = spans.at(-1);
      if (previous && Math.abs(previous.end - zs[j]) < EPS) previous.end = zs[j + 1];
      else spans.push({ start: zs[j], end: zs[j + 1] });
    }
    const active = new Set<string>();
    for (const span of spans) {
      const key = `${span.start}:${span.end}`; active.add(key);
      const previous = extendable.get(key);
      if (previous && Math.abs(previous.max[0] - xs[i]) < EPS) previous.max[0] = xs[i + 1];
      else {
        const volume: PresentationVolume = { min: [xs[i], bottom, span.start], max: [xs[i + 1], top, span.end], elementIds: [] };
        volumes.push(volume); extendable.set(key, volume);
      }
    }
    for (const key of extendable.keys()) if (!active.has(key)) extendable.delete(key);
  }
  return exposedVolumeSurfaces(volumes, resolve, (_volume, axis) => axis === 1 ? [] : polygons.flatMap(polygon => polygon.map(point => axis === 0 ? point.x : point.y)));
}

export function buildParapetSurfaces(project: Project, coping = false) {
  const floor = [...project.floors].sort((a, b) => b.level - a.level)[0];
  if (!floor || !project.roof.parapetEnabled) return [];
  const height = coping ? 0.12 : project.roof.parapetHeight;
  const walls = project.walls.filter(wall => wall.floorId === floor.id && wall.exterior).map(wall => ({ ...wall, height, thickness: project.roof.parapetThickness + (coping ? 0.16 : 0) }));
  const spatial = buildSpatialModel({ ...project, walls, openings: [], rooms: [] });
  const base = floor.elevation + floor.height + (coping ? project.roof.parapetHeight : 0);
  return exposedVolumeSurfaces(spatial.wallVolumes.map(volume => ({ min: [volume.x, base, volume.z], max: [volume.x + volume.width, base + height, volume.z + volume.length], elementIds: volume.wallIds })));
}

export function presentationBounds(project: Project, focusId?: string): PresentationBounds {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const include = (x: number, y: number, z: number) => { [x, y, z].forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }); };
  const level = (floorId: string) => project.floors.find(floor => floor.id === floorId);
  for (const room of project.rooms.filter(room => !focusId || room.id === focusId)) for (const point of roomVertices(room)) {
    const floor = level(room.floorId); include(point.x, floor?.elevation ?? 0, point.y); include(point.x, (floor?.elevation ?? 0) + (floor?.height ?? 9), point.y);
  }
  for (const wall of project.walls.filter(wall => !focusId || wall.id === focusId || project.openings.some(opening => opening.id === focusId && opening.wallId === wall.id))) {
    const floor = level(wall.floorId); include(Math.min(wall.x1, wall.x2) - wall.thickness / 2, floor?.elevation ?? 0, Math.min(wall.y1, wall.y2) - wall.thickness / 2);
    include(Math.max(wall.x1, wall.x2) + wall.thickness / 2, (floor?.elevation ?? 0) + wall.height, Math.max(wall.y1, wall.y2) + wall.thickness / 2);
  }
  for (const balcony of project.balconies.filter(item => !focusId || item.id === focusId)) {
    const elevation = level(balcony.floorId)?.elevation ?? 0; include(balcony.x, elevation, balcony.y); include(balcony.x + balcony.width, elevation + balcony.slabThickness + (balcony.railing.enabled ? balcony.railing.height : 0), balcony.y + balcony.length);
  }
  for (const feature of project.facadeFeatures.filter(item => !focusId || item.id === focusId)) {
    const wall = project.walls.find(item => item.id === feature.wallId);
    if (!wall) continue;
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    if (!length) continue;
    const tx = (wall.x2 - wall.x1) / length, tz = (wall.y2 - wall.y1) / length;
    const side = wall.roomSides[0]?.side;
    const normal = side === "north" ? [0, -1] : side === "south" ? [0, 1] : side === "east" ? [1, 0] : [-1, 0];
    const elevation = (level(wall.floorId)?.elevation ?? 0) + feature.elevation;
    for (const along of [-feature.width / 2 - feature.thickness, feature.width / 2 + feature.thickness]) for (const out of [0, feature.projection + wall.thickness / 2]) {
      const x = wall.x1 + tx * (feature.offset + along) + normal[0] * out;
      const z = wall.y1 + tz * (feature.offset + along) + normal[1] * out;
      include(x, elevation - feature.thickness / 2, z); include(x, elevation + feature.height + feature.thickness, z);
    }
  }
  for (const stair of project.stairs.filter(item => !focusId || item.id === focusId)) for (const point of stairPlanOutline(stair)) {
    const elevation = stairConnection(project, stair)?.lowerFloor.elevation ?? level(stair.floorId)?.elevation ?? 0;
    include(point.x, elevation, point.y); include(point.x, elevation + (stairConnection(project, stair)?.rise ?? 9), point.y);
  }
  if (!Number.isFinite(min[0])) return focusId ? presentationBounds(project) : { min: [0, 0, 0], max: [project.plot.width, 9, project.plot.length] };
  if (!focusId) { max[1] += project.roof.parapetEnabled ? project.roof.parapetHeight + 0.12 : 0.06; min[0] -= 3; min[2] -= 3; max[0] += 3; max[2] += 3; }
  if (!focusId && project.siteBoundary.enabled) { min[0] = Math.min(min[0], 0); min[2] = Math.min(min[2], 0); max[0] = Math.max(max[0], project.plot.width); max[2] = Math.max(max[2], project.plot.length); max[1] = Math.max(max[1], project.siteBoundary.height, project.siteBoundary.gate.height); }
  return { min, max };
}

/** Fit all eight corners against both FOV axes; narrow viewports and tall buildings remain framed. */
export function fitPerspectiveView(bounds: PresentationBounds, preset: CameraPreset, aspect: number, fov = 38, cutaway = false) {
  const directions: Record<CameraPreset, Vec3> = { front: [0, 0, -1], rear: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.0001], "front-left": [-1, 0.48, -1], "front-right": [1, 0.48, -1] };
  if (cutaway) { directions["front-left"] = [-1, 1.35, -1]; directions["front-right"] = [1, 1.35, -1]; }
  const normalize = (v: Vec3): Vec3 => { const length = Math.hypot(...v); return v.map(value => value / length) as Vec3; };
  const direction = normalize(directions[preset]);
  const right = normalize([direction[2], 0, -direction[0]]);
  const up: Vec3 = [direction[1] * right[2], direction[2] * right[0] - direction[0] * right[2], -direction[1] * right[0]];
  const target = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2) as Vec3;
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * Math.max(0.1, aspect);
  const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
  let distance = 7;
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const corner: Vec3 = [x - target[0], y - target[1], z - target[2]];
    distance = Math.max(distance, Math.abs(dot(corner, right)) * 1.16 / tanH + dot(corner, direction), Math.abs(dot(corner, up)) * 1.16 / tanV + dot(corner, direction));
  }
  // A shifted lens keeps elevation verticals parallel at a human eye height, while the
  // original bounding-box centre remains centred in the photograph.
  const street = ["front", "rear", "left", "right"].includes(preset);
  if (street) {
    const eyeOffset = target[1] - (bounds.min[1] + 5.4);
    for (let pass = 0; pass < 8; pass++) {
      let required = distance;
      for (const y of [bounds.min[1], bounds.max[1]]) for (const x of [bounds.min[0], bounds.max[0]]) for (const z of [bounds.min[2], bounds.max[2]]) {
        const depth = dot([x - target[0], y - target[1], z - target[2]], direction);
        required = Math.max(required, Math.abs(y - target[1] + eyeOffset * depth / distance) * 1.16 / tanV + depth);
      }
      distance = required;
    }
  }
  const lensShift = street ? (target[1] - (bounds.min[1] + 5.4)) / (distance * tanV) : 0;
  if (street) target[1] = bounds.min[1] + 5.4;
  return { target, position: target.map((value, axis) => value + direction[axis] * distance) as Vec3, distance, lensShift };
}

/** Closed wall caps are generated at the cut plane; the source design is never edited. */
export function cutawayCeiling(project: Project, floorId?: string) {
  const floor = project.floors.find(item => item.id === floorId);
  return floor ? floor.elevation + Math.min(3.5, floor.height * 0.55) : Infinity;
}

/** Bound pixel work independently of monitor size and device pixel ratio. */
export function presentationPixelRatio(width: number, height: number, deviceRatio: number, mode: "moving" | "settled" | "snapshot" = "settled") {
  const budget = mode === "moving" ? 1_800_000 : mode === "snapshot" ? 6_000_000 : 3_500_000;
  return Math.min(Math.max(1, deviceRatio), 2, Math.sqrt(budget / Math.max(1, width * height)));
}

/** Guard exposed landing edges while preserving the full width of adjoining flights. */
export function landingGuardSegments(stair: Stair): Array<{ start: PlanPoint; end: PlanPoint }> {
  const layout = stairLayout(stair);
  if (!layout.landing) return [];
  const vertices = layout.landing.vertices;
  return vertices.flatMap((a, index) => {
    const b = vertices[(index + 1) % vertices.length], du = b.u - a.u, dv = b.v - a.v, length = Math.hypot(du, dv);
    if (!length) return [];
    const openings = layout.flights.flatMap(flight => [flight.start, flight.end].flatMap(point => {
      const t = ((point.u - a.u) * du + (point.v - a.v) * dv) / length ** 2;
      if (t < -EPS || t > 1 + EPS || Math.hypot(point.u - a.u - t * du, point.v - a.v - t * dv) > EPS) return [];
      return [{ low: Math.max(0, t - flight.width / (2 * length)), high: Math.min(1, t + flight.width / (2 * length)) }];
    }));
    const cuts = unique([0, 1, ...openings.flatMap(opening => [opening.low, opening.high])]);
    return cuts.slice(0, -1).flatMap((low, i) => {
      const high = cuts[i + 1], middle = (low + high) / 2;
      if ((high - low) * length < 0.1 || openings.some(opening => middle > opening.low - EPS && middle < opening.high + EPS)) return [];
      return [{ start: stairPlanPoint(stair, a.u + low * du, a.v + low * dv), end: stairPlanPoint(stair, a.u + high * du, a.v + high * dv) }];
    });
  });
}
