import { type Opening, type Project, type Wall, wallLength } from "./architecture";

const EPSILON = 0.001;

type WallSpan = {
  wall: Wall;
  start: number;
  end: number;
};

type OpeningSpan = {
  opening: Opening;
  start: number;
  end: number;
};

type WallGroup = {
  floorId: string;
  dirX: number;
  dirZ: number;
  normalX: number;
  normalZ: number;
  lineOffset: number;
  walls: WallSpan[];
  openings: OpeningSpan[];
};

export type WallSolid = {
  floorId: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  bottom: number;
  top: number;
  thickness: number;
  wallIds: string[];
};

export type CollisionSegment = {
  floorId: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thickness: number;
  wallIds: string[];
};

export type OpeningFrame = {
  opening: Opening;
  wall: Wall;
  x: number;
  z: number;
  angle: number;
  dirX: number;
  dirZ: number;
  normalX: number;
  normalZ: number;
};

export type SpatialModel = {
  wallSolids: WallSolid[];
  collisionSegments: CollisionSegment[];
  openingFrames: OpeningFrame[];
};

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

function wallDirection(wall: Wall) {
  const length = wallLength(wall);
  if (!length) return undefined;
  let dirX = (wall.x2 - wall.x1) / length;
  let dirZ = (wall.y2 - wall.y1) / length;
  if (dirX < -EPSILON || (Math.abs(dirX) <= EPSILON && dirZ < 0)) {
    dirX *= -1;
    dirZ *= -1;
  }
  const normalX = -dirZ;
  const normalZ = dirX;
  return { dirX, dirZ, normalX, normalZ };
}

function positionOnWall(wall: Wall, offset: number) {
  const length = wallLength(wall);
  const ratio = length ? offset / length : 0;
  return {
    x: wall.x1 + (wall.x2 - wall.x1) * ratio,
    z: wall.y1 + (wall.y2 - wall.y1) * ratio,
  };
}

function groupWalls(project: Project) {
  const groups = new Map<string, WallGroup>();
  const openingsByWall = new Map<string, Opening[]>();
  for (const opening of project.openings) {
    const items = openingsByWall.get(opening.wallId) ?? [];
    items.push(opening);
    openingsByWall.set(opening.wallId, items);
  }

  for (const wall of project.walls) {
    const direction = wallDirection(wall);
    if (!direction) continue;
    const { dirX, dirZ, normalX, normalZ } = direction;
    const lineOffset = normalX * wall.x1 + normalZ * wall.y1;
    const key = [wall.floorId, rounded(dirX), rounded(dirZ), rounded(lineOffset)].join(":");
    const group = groups.get(key) ?? {
      floorId: wall.floorId,
      dirX,
      dirZ,
      normalX,
      normalZ,
      lineOffset,
      walls: [],
      openings: [],
    };
    const t1 = wall.x1 * dirX + wall.y1 * dirZ;
    const t2 = wall.x2 * dirX + wall.y2 * dirZ;
    group.walls.push({ wall, start: Math.min(t1, t2), end: Math.max(t1, t2) });
    for (const opening of openingsByWall.get(wall.id) ?? []) {
      const centerPoint = positionOnWall(wall, opening.offset);
      const center = centerPoint.x * dirX + centerPoint.z * dirZ;
      group.openings.push({ opening, start: center - opening.width / 2, end: center + opening.width / 2 });
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

function mergeCuts(cuts: Array<[number, number]>) {
  const ordered = cuts
    .filter(([start, end]) => end - start > EPSILON)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const cut of ordered) {
    const previous = merged[merged.length - 1];
    if (previous && cut[0] <= previous[1] + EPSILON) previous[1] = Math.max(previous[1], cut[1]);
    else merged.push([...cut]);
  }
  return merged;
}

export function buildSpatialModel(project: Project): SpatialModel {
  const wallSolids: WallSolid[] = [];
  const collisionSegments: CollisionSegment[] = [];

  for (const group of groupWalls(project)) {
    const breakpoints = new Set<number>();
    for (const wall of group.walls) {
      breakpoints.add(rounded(wall.start));
      breakpoints.add(rounded(wall.end));
    }
    for (const opening of group.openings) {
      breakpoints.add(rounded(opening.start));
      breakpoints.add(rounded(opening.end));
    }
    const points = [...breakpoints].sort((a, b) => a - b);

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (end - start <= EPSILON) continue;
      const midpoint = (start + end) / 2;
      const coveringWalls = group.walls.filter((span) => span.start <= midpoint && span.end >= midpoint);
      if (!coveringWalls.length) continue;
      const wallIds = coveringWalls.map((span) => span.wall.id);
      const height = Math.max(...coveringWalls.map((span) => span.wall.height));
      const thickness = Math.max(...coveringWalls.map((span) => span.wall.thickness));
      const activeOpenings = group.openings.filter(
        (span) => span.start <= midpoint + EPSILON && span.end >= midpoint - EPSILON,
      );
      const cuts = mergeCuts(
        activeOpenings.map(({ opening }) => [
          Math.max(0, opening.sillHeight ?? 0),
          Math.min(height, (opening.sillHeight ?? 0) + opening.height),
        ] as [number, number]),
      );
      let cursor = 0;
      const addSolid = (bottom: number, top: number) => {
        if (top - bottom <= EPSILON) return;
        wallSolids.push({
          floorId: group.floorId,
          x1: group.dirX * start + group.normalX * group.lineOffset,
          z1: group.dirZ * start + group.normalZ * group.lineOffset,
          x2: group.dirX * end + group.normalX * group.lineOffset,
          z2: group.dirZ * end + group.normalZ * group.lineOffset,
          bottom,
          top,
          thickness,
          wallIds,
        });
      };
      for (const [cutBottom, cutTop] of cuts) {
        addSolid(cursor, cutBottom);
        cursor = Math.max(cursor, cutTop);
      }
      addSolid(cursor, height);

      const isDoorOpening = activeOpenings.some(({ opening }) => opening.kind === "door");
      if (!isDoorOpening) {
        collisionSegments.push({
          floorId: group.floorId,
          x1: group.dirX * start + group.normalX * group.lineOffset,
          z1: group.dirZ * start + group.normalZ * group.lineOffset,
          x2: group.dirX * end + group.normalX * group.lineOffset,
          z2: group.dirZ * end + group.normalZ * group.lineOffset,
          thickness,
          wallIds,
        });
      }
    }
  }

  const openingFrames = project.openings.flatMap((opening) => {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    if (!wall) return [];
    const length = wallLength(wall);
    if (!length) return [];
    const point = positionOnWall(wall, opening.offset);
    const dirX = (wall.x2 - wall.x1) / length;
    const dirZ = (wall.y2 - wall.y1) / length;
    return [{
      opening,
      wall,
      x: point.x,
      z: point.z,
      angle: Math.atan2(dirZ, dirX),
      dirX,
      dirZ,
      normalX: -dirZ,
      normalZ: dirX,
    }];
  });

  return { wallSolids, collisionSegments, openingFrames };
}

export function resolveWalkPosition(
  x: number,
  z: number,
  radius: number,
  segments: CollisionSegment[],
) {
  let nextX = x;
  let nextZ = z;
  for (let pass = 0; pass < 4; pass += 1) {
    for (const segment of segments) {
      const dx = segment.x2 - segment.x1;
      const dz = segment.z2 - segment.z1;
      const lengthSquared = dx * dx + dz * dz;
      const ratio = lengthSquared
        ? Math.max(0, Math.min(1, ((nextX - segment.x1) * dx + (nextZ - segment.z1) * dz) / lengthSquared))
        : 0;
      const closestX = segment.x1 + dx * ratio;
      const closestZ = segment.z1 + dz * ratio;
      const offsetX = nextX - closestX;
      const offsetZ = nextZ - closestZ;
      const distance = Math.hypot(offsetX, offsetZ);
      const clearance = radius + segment.thickness / 2;
      if (distance >= clearance) continue;
      let normalX = distance > EPSILON ? offsetX / distance : -dz / Math.max(Math.hypot(dx, dz), 1);
      let normalZ = distance > EPSILON ? offsetZ / distance : dx / Math.max(Math.hypot(dx, dz), 1);
      if (!Number.isFinite(normalX) || !Number.isFinite(normalZ)) {
        normalX = 1;
        normalZ = 0;
      }
      nextX = closestX + normalX * clearance;
      nextZ = closestZ + normalZ * clearance;
    }
  }
  return { x: nextX, z: nextZ };
}
