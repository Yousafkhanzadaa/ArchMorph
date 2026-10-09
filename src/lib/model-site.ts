import { roomContainsPoint, stairPlanOutline, wallLength, type Project } from "./architecture.ts";

export type SitePlant = { x: number; z: number; radius: number; height: number };
export type SiteApproach = { x: number; z: number; width: number; length: number; vehicle: boolean };

/** Optional presentation context, kept entirely outside the canonical project and its areas. */
export function presentationSite(project: Project) {
  const ground = [...project.floors].sort((a, b) => a.elevation - b.elevation)[0];
  const rooms = project.rooms.filter(room => room.floorId === ground?.id);
  const clear = (x: number, z: number, radius: number) => {
    if (x - radius < 0.7 || z - radius < 0.7 || x + radius > project.plot.width - 0.7 || z + radius > project.plot.length - 0.7) return false;
    for (const dx of [-radius, 0, radius]) for (const dz of [-radius, 0, radius]) {
      if (rooms.some(room => roomContainsPoint(room, { x: x + dx, y: z + dz }))) return false;
    }
    if (project.balconies.some(b => x + radius > b.x && x - radius < b.x + b.width && z + radius > b.y && z - radius < b.y + b.length)) return false;
    if (project.stairs.some(stair => {
      const points = stairPlanOutline(stair);
      return x + radius > Math.min(...points.map(p => p.x)) && x - radius < Math.max(...points.map(p => p.x))
        && z + radius > Math.min(...points.map(p => p.y)) && z - radius < Math.max(...points.map(p => p.y));
    })) return false;
    return !project.walls.some(wall => {
      if (wall.floorId !== ground?.id) return false;
      const length = wallLength(wall);
      const t = length ? Math.max(0, Math.min(1, ((x - wall.x1) * (wall.x2 - wall.x1) + (z - wall.y1) * (wall.y2 - wall.y1)) / length ** 2)) : 0;
      return Math.hypot(x - wall.x1 - t * (wall.x2 - wall.x1), z - wall.y1 - t * (wall.y2 - wall.y1)) < radius + wall.thickness / 2 + 0.6;
    });
  };
  const approaches: SiteApproach[] = [];
  // Only draw a direct approach when the front opening actually has a clear route to
  // the access edge. Side/rear doors do not acquire invented paths through the house.
  for (const opening of project.openings.filter(o => o.kind === "door" && o.floorId === ground?.id)) {
    const wall = project.walls.find(w => w.id === opening.wallId);
    if (!wall?.exterior || wall.roomSides[0]?.side !== "north" || Math.abs(wall.y2 - wall.y1) > 0.001) continue;
    const length = wallLength(wall);
    if (!length || wall.y1 < 1) continue;
    const x = wall.x1 + (wall.x2 - wall.x1) * opening.offset / length;
    const width = Math.max(2.5, opening.width);
    if (x - width / 2 < 0.5 || x + width / 2 > project.plot.width - 0.5) continue;
    if (project.siteBoundary.enabled && (!project.siteBoundary.gate.enabled
      || x - width / 2 < project.siteBoundary.gate.offset - project.siteBoundary.gate.width / 2
      || x + width / 2 > project.siteBoundary.gate.offset + project.siteBoundary.gate.width / 2)) continue;
    const lengthToDoor = wall.y1 - wall.thickness / 2;
    let blocked = false;
    for (let z = 0.85; z < lengthToDoor - 1.1; z += 0.5) for (const dx of [-width / 2, 0, width / 2]) {
      if (!clear(x + dx, z, 0.05)) blocked = true;
    }
    if (!blocked) approaches.push({ x, z: lengthToDoor / 2, width, length: lengthToDoor, vehicle: rooms.some(room => room.type === "Garage" && wall.roomSides.some(side => side.roomId === room.id)) });
  }
  const plants: SitePlant[] = [];
  for (const [x, z] of [[2.6, 3.2], [project.plot.width - 2.6, 3.2], [2.6, project.plot.length - 3.2], [project.plot.width - 2.6, project.plot.length - 3.2]]) {
    if (plants.length === 2) break;
    if (!clear(x, z, 1.65)) continue;
    if (approaches.some(a => Math.abs(x - a.x) < a.width / 2 + 3 && Math.abs(z - a.z) < a.length / 2 + 3)) continue;
    // Preserve an unobstructed gate and the approach to any exterior opening.
    if (project.siteBoundary.gate.enabled && z < 6 && Math.abs(x - project.siteBoundary.gate.offset) < project.siteBoundary.gate.width / 2 + 2) continue;
    if (project.openings.some(o => {
      const wall = project.walls.find(w => w.id === o.wallId);
      if (!wall?.exterior || o.kind !== "door") return false;
      const length = wallLength(wall), t = length ? o.offset / length : 0;
      return Math.hypot(x - wall.x1 - (wall.x2 - wall.x1) * t, z - wall.y1 - (wall.y2 - wall.y1) * t) < o.width / 2 + 4;
    })) continue;
    plants.push({ x, z, radius: 1.35, height: 5.8 });
  }
  return { plants, approaches };
}
