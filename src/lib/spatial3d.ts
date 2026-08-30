import { type Opening, type Project, type Wall, wallLength } from "./architecture.ts";

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

export type WallVolume = {
  floorId: string;
  x: number;
  z: number;
  width: number;
  length: number;
  bottom: number;
  top: number;
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
  wallVolumes: WallVolume[];
  collisionSegments: CollisionSegment[];
  openingFrames: OpeningFrame[];
};

export type SpatialModelOptions = {
  doorMode?: "model" | "all-open";
};

export type SpatialPoint3 = {
  x: number;
  y: number;
  z: number;
};

export type OrientedSlopeFrame = {
  center: SpatialPoint3;
  length: number;
  xAxis: SpatialPoint3;
  yAxis: SpatialPoint3;
  zAxis: SpatialPoint3;
};

type AxisWallRectangle = {
  left: number;
  right: number;
  front: number;
  back: number;
  wallIds: string[];
};

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function orientedSlopeFrame(start: SpatialPoint3, end: SpatialPoint3): OrientedSlopeFrame | undefined {
  const delta = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  const horizontalLength = Math.hypot(delta.x, delta.z);
  if (length <= EPSILON || horizontalLength <= EPSILON) return undefined;

  const zAxis = { x: delta.x / length, y: delta.y / length, z: delta.z / length };
  const xAxis = { x: delta.z / horizontalLength, y: 0, z: -delta.x / horizontalLength };
  const yAxis = {
    x: zAxis.y * xAxis.z - zAxis.z * xAxis.y,
    y: zAxis.z * xAxis.x - zAxis.x * xAxis.z,
    z: zAxis.x * xAxis.y - zAxis.y * xAxis.x,
  };

  return {
    center: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: (start.z + end.z) / 2,
    },
    length,
    xAxis,
    yAxis,
    zAxis,
  };
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

function samePoint(first: { x: number; z: number }, second: { x: number; z: number }) {
  return Math.abs(first.x - second.x) <= EPSILON && Math.abs(first.z - second.z) <= EPSILON;
}

function pointKey(point: { x: number; z: number }) {
  return `${rounded(point.x)}:${rounded(point.z)}`;
}

function solidDirection(solid: WallSolid) {
  const length = Math.hypot(solid.x2 - solid.x1, solid.z2 - solid.z1);
  return length
    ? { x: (solid.x2 - solid.x1) / length, z: (solid.z2 - solid.z1) / length }
    : { x: 0, z: 0 };
}

function isAxisAligned(solid: WallSolid) {
  return Math.abs(solid.x2 - solid.x1) <= EPSILON || Math.abs(solid.z2 - solid.z1) <= EPSILON;
}

function isActualWallEndpoint(project: Project, solid: WallSolid, point: { x: number; z: number }) {
  return solid.wallIds.some((wallId) => {
    const wall = project.walls.find((item) => item.id === wallId);
    return Boolean(wall && (
      samePoint(point, { x: wall.x1, z: wall.y1 })
      || samePoint(point, { x: wall.x2, z: wall.y2 })
    ));
  });
}

function joinedEndpointRadii(project: Project, solids: WallSolid[]) {
  const endpoints = new Map<string, Array<{ solid: WallSolid; direction: { x: number; z: number } }>>();
  for (const solid of solids) {
    const direction = solidDirection(solid);
    for (const point of [{ x: solid.x1, z: solid.z1 }, { x: solid.x2, z: solid.z2 }]) {
      if (!isActualWallEndpoint(project, solid, point)) continue;
      const key = pointKey(point);
      endpoints.set(key, [...(endpoints.get(key) ?? []), { solid, direction }]);
    }
  }

  const radii = new Map<string, number>();
  endpoints.forEach((items, key) => {
    const hasCorner = items.some((item, index) => items.slice(index + 1).some((other) => (
      Math.abs(item.direction.x * other.direction.x + item.direction.z * other.direction.z) < 0.999
    )));
    if (hasCorner) radii.set(key, Math.max(...items.map(({ solid }) => solid.thickness / 2)));
  });
  return radii;
}

function rectangleForSolid(solid: WallSolid, joinedRadii: Map<string, number>): AxisWallRectangle {
  const startRadius = joinedRadii.get(pointKey({ x: solid.x1, z: solid.z1 })) ?? 0;
  const endRadius = joinedRadii.get(pointKey({ x: solid.x2, z: solid.z2 })) ?? 0;
  if (Math.abs(solid.z2 - solid.z1) <= EPSILON) {
    const leftIsStart = solid.x1 <= solid.x2;
    const left = Math.min(solid.x1, solid.x2) - (leftIsStart ? startRadius : endRadius);
    const right = Math.max(solid.x1, solid.x2) + (leftIsStart ? endRadius : startRadius);
    return {
      left,
      right,
      front: solid.z1 - solid.thickness / 2,
      back: solid.z1 + solid.thickness / 2,
      wallIds: solid.wallIds,
    };
  }
  const frontIsStart = solid.z1 <= solid.z2;
  const front = Math.min(solid.z1, solid.z2) - (frontIsStart ? startRadius : endRadius);
  const back = Math.max(solid.z1, solid.z2) + (frontIsStart ? endRadius : startRadius);
  return {
    left: solid.x1 - solid.thickness / 2,
    right: solid.x1 + solid.thickness / 2,
    front,
    back,
    wallIds: solid.wallIds,
  };
}

function unionAxisRectangles(
  floorId: string,
  bottom: number,
  top: number,
  rectangles: AxisWallRectangle[],
) {
  const xCoordinates = Array.from(new Set(rectangles.flatMap((rectangle) => [rounded(rectangle.left), rounded(rectangle.right)]))).sort((a, b) => a - b);
  const zCoordinates = Array.from(new Set(rectangles.flatMap((rectangle) => [rounded(rectangle.front), rounded(rectangle.back)]))).sort((a, b) => a - b);
  const volumes: WallVolume[] = [];
  const extendable = new Map<string, WallVolume>();

  for (let xIndex = 0; xIndex < xCoordinates.length - 1; xIndex += 1) {
    const left = xCoordinates[xIndex];
    const right = xCoordinates[xIndex + 1];
    if (right - left <= EPSILON) continue;
    const centerX = (left + right) / 2;
    const column: Array<{ front: number; back: number; wallIds: string[] }> = [];
    for (let zIndex = 0; zIndex < zCoordinates.length - 1; zIndex += 1) {
      const front = zCoordinates[zIndex];
      const back = zCoordinates[zIndex + 1];
      if (back - front <= EPSILON) continue;
      const centerZ = (front + back) / 2;
      const covering = rectangles.filter((rectangle) => (
        centerX >= rectangle.left - EPSILON
        && centerX <= rectangle.right + EPSILON
        && centerZ >= rectangle.front - EPSILON
        && centerZ <= rectangle.back + EPSILON
      ));
      if (!covering.length) continue;
      const wallIds = Array.from(new Set(covering.flatMap((rectangle) => rectangle.wallIds))).sort();
      const previous = column[column.length - 1];
      if (previous && Math.abs(previous.back - front) <= EPSILON) {
        previous.back = back;
        previous.wallIds = Array.from(new Set([...previous.wallIds, ...wallIds])).sort();
      } else {
        column.push({ front, back, wallIds });
      }
    }

    const activeKeys = new Set<string>();
    for (const cell of column) {
      const key = `${cell.front}:${cell.back}`;
      activeKeys.add(key);
      const previous = extendable.get(key);
      if (previous && Math.abs(previous.x + previous.width - left) <= EPSILON) {
        previous.width = rounded(right - previous.x);
        previous.wallIds = Array.from(new Set([...previous.wallIds, ...cell.wallIds])).sort();
      } else {
        const volume: WallVolume = {
          floorId,
          x: left,
          z: cell.front,
          width: rounded(right - left),
          length: rounded(cell.back - cell.front),
          bottom,
          top,
          wallIds: cell.wallIds,
        };
        volumes.push(volume);
        extendable.set(key, volume);
      }
    }
    [...extendable.keys()].forEach((key) => {
      if (!activeKeys.has(key)) extendable.delete(key);
    });
  }
  return volumes;
}

function buildWallVolumes(project: Project, solids: WallSolid[]) {
  const volumes: WallVolume[] = [];
  const floorIds = Array.from(new Set(solids.map((solid) => solid.floorId)));
  for (const floorId of floorIds) {
    const floorSolids = solids.filter((solid) => solid.floorId === floorId && isAxisAligned(solid));
    const elevations = Array.from(new Set(floorSolids.flatMap((solid) => [rounded(solid.bottom), rounded(solid.top)]))).sort((a, b) => a - b);
    for (let index = 0; index < elevations.length - 1; index += 1) {
      const bottom = elevations[index];
      const top = elevations[index + 1];
      if (top - bottom <= EPSILON) continue;
      const midpoint = (bottom + top) / 2;
      const activeSolids = floorSolids.filter((solid) => solid.bottom <= midpoint + EPSILON && solid.top >= midpoint - EPSILON);
      if (!activeSolids.length) continue;
      const joinedRadii = joinedEndpointRadii(project, activeSolids);
      const rectangles = activeSolids.map((solid) => rectangleForSolid(solid, joinedRadii));
      volumes.push(...unionAxisRectangles(floorId, bottom, top, rectangles));
    }
  }
  return volumes;
}

export function buildSpatialModel(project: Project, options: SpatialModelOptions = {}): SpatialModel {
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

      const hasTraversableDoor = activeOpenings.some(({ opening }) => (
        opening.kind === "door" && (options.doorMode === "all-open" || opening.state !== "closed")
      ));
      if (!hasTraversableDoor) {
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
    const frame = openingFrameFor(project, opening);
    return frame ? [frame] : [];
  });

  return {
    wallSolids: wallSolids.filter((solid) => !isAxisAligned(solid)),
    wallVolumes: buildWallVolumes(project, wallSolids),
    collisionSegments,
    openingFrames,
  };
}

export function openingFrameFor(project: Project, opening: Opening): OpeningFrame | undefined {
  const wall = project.walls.find((item) => item.id === opening.wallId);
  if (!wall) return undefined;
  const length = wallLength(wall);
  if (!length) return undefined;
  const point = positionOnWall(wall, opening.offset);
  const dirX = (wall.x2 - wall.x1) / length;
  const dirZ = (wall.y2 - wall.y1) / length;
  return {
    opening,
    wall,
    x: point.x,
    z: point.z,
    angle: Math.atan2(dirZ, dirX),
    dirX,
    dirZ,
    normalX: -dirZ,
    normalZ: dirX,
  };
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
