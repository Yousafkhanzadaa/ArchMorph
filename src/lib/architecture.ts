export type Actor = "human" | "agent" | "system";
export type ViewMode = "2d" | "3d";
export type NavigationMode = "orbit" | "walk";
export type CameraPreset =
  | "front"
  | "rear"
  | "left"
  | "right"
  | "top"
  | "front-left"
  | "front-right";

export const roomTypes = [
  "Living Room",
  "Kitchen",
  "Bedroom",
  "Bathroom",
  "Garage",
  "Office",
  "Dining Room",
  "Storage",
  "Courtyard",
  "Custom",
] as const;

export type RoomType = (typeof roomTypes)[number];
export type WallSide = "north" | "east" | "south" | "west";

export type Plot = {
  width: number;
  length: number;
  orientation: "North" | "East" | "South" | "West";
  setbacks: { front: number; rear: number; left: number; right: number };
};

export type Floor = {
  id: string;
  name: string;
  level: number;
  elevation: number;
  height: number;
};

export type Room = {
  id: string;
  floorId: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  length: number;
  color: string;
  wallIds: string[];
};

export type WallRoomSide = { roomId: string; side: WallSide };

export type Wall = {
  id: string;
  floorId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  height: number;
  roomIds: string[];
  roomSides: WallRoomSide[];
  exterior: boolean;
  connectedWallIds: string[];
  /** @deprecated Compatibility fields for pre-topology projects. */
  roomId?: string;
  /** @deprecated Compatibility fields for pre-topology projects. */
  side?: WallSide;
};

export type DoorHingeSide = "start" | "end";
export type DoorHanding = "left" | "right";
export type DoorSwingDirection = "inward" | "outward";
export type DoorState = "open" | "closed";
export type WindowType = "fixed" | "casement" | "sliding" | "awning";
export type GlazingType = "clear" | "privacy";

export type Opening = {
  id: string;
  floorId: string;
  kind: "door" | "window";
  wallId: string;
  offset: number;
  width: number;
  sillHeight?: number;
  height: number;
  hingeSide?: DoorHingeSide;
  handing?: DoorHanding;
  swingDirection?: DoorSwingDirection;
  state?: DoorState;
  windowType?: WindowType;
  operable?: boolean;
  glazing?: GlazingType;
  solarTransmittance?: number;
  /** Import-only world position used to migrate geometry-only legacy projects. */
  legacyPosition?: { x: number; y: number };
};

export type Stair = {
  id: string;
  floorId: string;
  x: number;
  y: number;
  width: number;
  length: number;
  direction: "up" | "down";
};

export type ActivityEntry = {
  id: string;
  actor: Actor;
  description: string;
  operation: string;
  timestamp: string;
  version: number;
};

export type Project = {
  schemaVersion: number;
  id: string;
  name: string;
  unit: "ft";
  plot: Plot;
  floors: Floor[];
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  stairs: Stair[];
  view: {
    mode: ViewMode;
    navigationMode: NavigationMode;
    activeFloorId: string;
    cameraPreset: CameraPreset;
    focusElementId?: string;
    walkStartRoomId?: string;
  };
  activity: ActivityEntry[];
  version: number;
  updatedAt: string;
};

export type ValidationIssue = {
  id: string;
  code:
    | "ROOM_OVERLAP"
    | "OUTSIDE_PLOT"
    | "SETBACK_VIOLATION"
    | "INVALID_OPENING"
    | "NO_ROOM_ACCESS"
    | "NO_EXTERIOR_ACCESS"
    | "DISCONNECTED_CIRCULATION"
    | "INVALID_STAIR_CONNECTION"
    | "OPENING_WITHOUT_ADJACENCY"
    | "OPENING_OVERLAP"
    | "WALL_OUTSIDE_PLOT";
  severity: "error" | "warning";
  message: string;
  elementIds: string[];
  evidence: Record<string, string | number | boolean>;
  suggestion: string;
  affectedRoomIds?: string[];
  affectedOpeningId?: string;
  possibleCorrection?: string;
};

export type CirculationNode = {
  id: string;
  type: "room" | "exterior";
  label: string;
  floorId?: string;
};

export type CirculationEdge = {
  id: string;
  type: "door" | "stair";
  from: string;
  to: string;
  openingId?: string;
  stairId?: string;
};

export type CirculationGraph = {
  nodes: CirculationNode[];
  edges: CirculationEdge[];
  mainEntranceOpeningId?: string;
  primaryEntryRoomId?: string;
  hasExteriorAccess: boolean;
  reachableRoomIds: string[];
  disconnectedRoomIds: string[];
  invalidDoorIds: string[];
  invalidStairIds: string[];
};

export type ValidationReport = {
  status: "pass" | "issues-found";
  checkedAt: string;
  projectVersion: number;
  floorId?: string;
  issueCount: number;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
};

export type PointRef =
  | { x: number; y: number }
  | { elementId: string; anchor?: "center" | "start" | "end" };

export type ArchitectureOperation =
  | { type: "rename_project"; name: string }
  | { type: "set_plot"; width?: number; length?: number; setbacks?: Partial<Plot["setbacks"]> }
  | { type: "set_plot_orientation"; orientation: Plot["orientation"] }
  | {
      type: "create_room";
      floorId: string;
      name: string;
      roomType: RoomType;
      x: number;
      y: number;
      width: number;
      length: number;
    }
  | { type: "move_room"; roomId: string; x: number; y: number }
  | { type: "resize_room"; roomId: string; width: number; length: number }
  | { type: "update_room"; roomId: string; name?: string; roomType?: RoomType }
  | { type: "delete_room"; roomId: string }
  | {
      type: "add_wall";
      floorId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      thickness?: number;
    }
  | {
      type: "move_wall";
      wallId: string;
      dx?: number;
      dy?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
    }
  | {
      type: "add_opening";
      kind: "door" | "window";
      wallId: string;
      offset: number;
      width?: number;
      height?: number;
      sillHeight?: number;
      hingeSide?: DoorHingeSide;
      handing?: DoorHanding;
      swingDirection?: DoorSwingDirection;
      state?: DoorState;
      windowType?: WindowType;
      operable?: boolean;
      glazing?: GlazingType;
      solarTransmittance?: number;
    }
  | {
      type: "update_opening";
      openingId: string;
      offset?: number;
      width?: number;
      height?: number;
      sillHeight?: number;
      hingeSide?: DoorHingeSide;
      handing?: DoorHanding;
      swingDirection?: DoorSwingDirection;
      state?: DoorState;
      windowType?: WindowType;
      operable?: boolean;
      glazing?: GlazingType;
      solarTransmittance?: number;
    }
  | { type: "rehost_opening"; openingId: string; wallId: string; offset: number }
  | {
      type: "add_stairs";
      floorId: string;
      x: number;
      y: number;
      width: number;
      length: number;
      direction?: "up" | "down";
    }
  | { type: "create_floor"; name?: string; height?: number }
  | { type: "set_active_floor"; floorId: string }
  | { type: "delete_element"; elementId: string }
  | { type: "switch_view"; mode: ViewMode }
  | { type: "set_navigation_mode"; mode: NavigationMode; roomId?: string }
  | { type: "set_camera"; preset: CameraPreset }
  | { type: "focus_element"; elementId?: string };

export type OperationOutcome = {
  project: Project;
  result: Record<string, unknown>;
  description: string;
};

const roomPalette: Record<RoomType, string> = {
  "Living Room": "#e8b39c",
  Kitchen: "#d8d2a7",
  Bedroom: "#a9c7c2",
  Bathroom: "#a9bfd2",
  Garage: "#c6c3bc",
  Office: "#b8b0cf",
  "Dining Room": "#d9b8a3",
  Storage: "#c9b99e",
  Courtyard: "#b9cba7",
  Custom: "#c7b7ae",
};

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createInitialProject(): Project {
  const now = new Date().toISOString();
  const groundFloor: Floor = {
    id: "floor-ground",
    name: "Ground Floor",
    level: 0,
    elevation: 0,
    height: 9,
  };

  return {
    schemaVersion: 2,
    id: "project-archmorph-home",
    name: "Untitled Residence",
    unit: "ft",
    plot: {
      width: 30,
      length: 60,
      orientation: "North",
      setbacks: { front: 10, rear: 8, left: 3, right: 3 },
    },
    floors: [groundFloor],
    rooms: [],
    walls: [],
    openings: [],
    stairs: [],
    view: {
      mode: "2d",
      navigationMode: "orbit",
      activeFloorId: groundFloor.id,
      cameraPreset: "front-right",
    },
    activity: [
      {
        id: "activity-created",
        actor: "system",
        description: "30 × 60 ft residential plot created",
        operation: "create_project",
        timestamp: now,
        version: 1,
      },
    ],
    version: 1,
    updatedAt: now,
  };
}

export function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function roomArea(room: Room) {
  return round(room.width * room.length);
}

export function wallLength(wall: Wall) {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

type Segment = { x1: number; y1: number; x2: number; y2: number };

function openingSegment(wall: Wall, opening: Opening): Segment {
  const length = wallLength(wall);
  const ux = length ? (wall.x2 - wall.x1) / length : 0;
  const uy = length ? (wall.y2 - wall.y1) / length : 0;
  const centerX = wall.x1 + ux * opening.offset;
  const centerY = wall.y1 + uy * opening.offset;
  return {
    x1: centerX - ux * opening.width / 2,
    y1: centerY - uy * opening.width / 2,
    x2: centerX + ux * opening.width / 2,
    y2: centerY + uy * opening.width / 2,
  };
}

function collinearOverlapLength(first: Segment, second: Segment) {
  const length = Math.hypot(first.x2 - first.x1, first.y2 - first.y1);
  const secondLength = Math.hypot(second.x2 - second.x1, second.y2 - second.y1);
  if (!length || !secondLength) return 0;
  const ux = (first.x2 - first.x1) / length;
  const uy = (first.y2 - first.y1) / length;
  const vx = (second.x2 - second.x1) / secondLength;
  const vy = (second.y2 - second.y1) / secondLength;
  if (Math.abs(ux * vy - uy * vx) > 0.01) return 0;
  const lineDistance = Math.abs((second.x1 - first.x1) * -uy + (second.y1 - first.y1) * ux);
  if (lineDistance > 0.05) return 0;
  const t1 = (second.x1 - first.x1) * ux + (second.y1 - first.y1) * uy;
  const t2 = (second.x2 - first.x1) * ux + (second.y2 - first.y1) * uy;
  return Math.max(0, Math.min(length, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)));
}

function openingTouchesWall(project: Project, opening: Opening, wall: Wall) {
  const sourceWall = project.walls.find((item) => item.id === opening.wallId);
  return Boolean(sourceWall && sourceWall.floorId === wall.floorId && collinearOverlapLength(wall, openingSegment(sourceWall, opening)) > 0.05);
}

function overlappingOpening(project: Project, candidate: Opening, ignoredId?: string) {
  const wall = project.walls.find((item) => item.id === candidate.wallId);
  if (!wall) return undefined;
  const segment = openingSegment(wall, candidate);
  return project.openings.find((opening) => {
    if (opening.id === ignoredId || opening.floorId !== candidate.floorId) return false;
    const otherWall = project.walls.find((item) => item.id === opening.wallId);
    return Boolean(otherWall && collinearOverlapLength(segment, openingSegment(otherWall, opening)) > 0.05);
  });
}

function assertOpeningPlacement(project: Project, opening: Opening, ignoredId?: string) {
  const wall = project.walls.find((item) => item.id === opening.wallId);
  if (!wall) throw new Error(`Wall ${opening.wallId} does not exist.`);
  if (wall.roomIds.length < 1 || wall.roomIds.length > 2) {
    throw new Error(`The ${opening.kind} must be hosted by an exterior wall or one canonical wall shared by two rooms.`);
  }
  const length = wallLength(wall);
  if (opening.width <= 0 || opening.offset < opening.width / 2 || opening.offset > length - opening.width / 2) {
    throw new Error(`The ${opening.kind} does not fit on this ${round(length, 1)} ft wall.`);
  }
  if ((opening.sillHeight ?? 0) < 0 || opening.height <= 0 || (opening.sillHeight ?? 0) + opening.height > wall.height) {
    throw new Error(`The ${opening.kind} must fit within the ${wall.height} ft wall height.`);
  }
  const conflict = overlappingOpening(project, opening, ignoredId);
  if (conflict) throw new Error(`The ${opening.kind} overlaps an existing ${conflict.kind}. Reposition or resize it first.`);
}

function assertAllOpeningsValid(project: Project) {
  project.openings.forEach((opening) => assertOpeningPlacement(project, opening, opening.id));
}

function floorCoveredArea(project: Project, floorId: string) {
  const rooms = project.rooms.filter(
    (room) => room.floorId === floorId && room.type !== "Courtyard",
  );
  if (!rooms.length) return 0;

  const xs = Array.from(
    new Set(rooms.flatMap((room) => [room.x, room.x + room.width])),
  ).sort((a, b) => a - b);
  let area = 0;

  for (let i = 0; i < xs.length - 1; i += 1) {
    const left = xs[i];
    const right = xs[i + 1];
    const width = right - left;
    if (width <= 0) continue;

    const intervals = rooms
      .filter((room) => room.x < right && room.x + room.width > left)
      .map((room) => [room.y, room.y + room.length] as const)
      .sort((a, b) => a[0] - b[0]);

    let coveredY = 0;
    let start = intervals[0]?.[0] ?? 0;
    let end = intervals[0]?.[1] ?? 0;
    for (let j = 1; j < intervals.length; j += 1) {
      const [nextStart, nextEnd] = intervals[j];
      if (nextStart <= end) end = Math.max(end, nextEnd);
      else {
        coveredY += end - start;
        start = nextStart;
        end = nextEnd;
      }
    }
    if (intervals.length) coveredY += end - start;
    area += width * coveredY;
  }
  return round(area);
}

type AreaRectangle = { left: number; top: number; right: number; bottom: number };

function rectangleUnionArea(rectangles: AreaRectangle[]) {
  const valid = rectangles.filter((item) => item.right > item.left && item.bottom > item.top);
  if (!valid.length) return 0;
  const xs = Array.from(new Set(valid.flatMap((item) => [item.left, item.right]))).sort((a, b) => a - b);
  let area = 0;
  for (let index = 0; index < xs.length - 1; index += 1) {
    const left = xs[index];
    const right = xs[index + 1];
    const intervals = valid
      .filter((item) => item.left < right && item.right > left)
      .map((item) => [item.top, item.bottom] as const)
      .sort((a, b) => a[0] - b[0]);
    if (!intervals.length) continue;
    let start = intervals[0][0];
    let end = intervals[0][1];
    let covered = 0;
    for (let cursor = 1; cursor < intervals.length; cursor += 1) {
      const [nextStart, nextEnd] = intervals[cursor];
      if (nextStart <= end) end = Math.max(end, nextEnd);
      else {
        covered += end - start;
        start = nextStart;
        end = nextEnd;
      }
    }
    covered += end - start;
    area += (right - left) * covered;
  }
  return round(area);
}

function wallFootprint(wall: Wall): AreaRectangle | undefined {
  const half = wall.thickness / 2;
  if (Math.abs(wall.y2 - wall.y1) < 0.01) {
    return { left: Math.min(wall.x1, wall.x2) - half, right: Math.max(wall.x1, wall.x2) + half, top: wall.y1 - half, bottom: wall.y1 + half };
  }
  if (Math.abs(wall.x2 - wall.x1) < 0.01) {
    return { left: wall.x1 - half, right: wall.x1 + half, top: Math.min(wall.y1, wall.y2) - half, bottom: Math.max(wall.y1, wall.y2) + half };
  }
  return undefined;
}

function floorGrossCoveredArea(project: Project, floorId: string) {
  const roomRectangles = project.rooms
    .filter((room) => room.floorId === floorId && room.type !== "Courtyard")
    .map((room) => ({ left: room.x, top: room.y, right: room.x + room.width, bottom: room.y + room.length }));
  const wallRectangles = project.walls
    .filter((wall) => wall.floorId === floorId && wall.roomIds.length > 0)
    .map(wallFootprint)
    .filter((item): item is AreaRectangle => Boolean(item));
  return rectangleUnionArea([...roomRectangles, ...wallRectangles]);
}

export function projectMetrics(project: Project, floorId = project.view.activeFloorId) {
  const plotArea = round(project.plot.width * project.plot.length);
  const floorArea = floorCoveredArea(project, floorId);
  const totalConstructedArea = round(
    project.floors.reduce((sum, floor) => sum + floorCoveredArea(project, floor.id), 0),
  );
  const roomAreaSum = round(
    project.rooms
      .filter((room) => room.floorId === floorId && room.type !== "Courtyard")
      .reduce((sum, room) => sum + roomArea(room), 0),
  );
  const grossCoveredArea = floorGrossCoveredArea(project, floorId);
  const totalNetBuildingArea = round(
    project.rooms.filter((room) => room.type !== "Courtyard").reduce((sum, room) => sum + roomArea(room), 0),
  );
  const totalGrossCoveredArea = round(
    project.floors.reduce((sum, floor) => sum + floorGrossCoveredArea(project, floor.id), 0),
  );
  const groundFloorId = [...project.floors].sort((a, b) => a.level - b.level)[0]?.id;
  const groundGrossArea = groundFloorId ? floorGrossCoveredArea(project, groundFloorId) : 0;
  const buildableWidth = Math.max(
    0,
    project.plot.width - project.plot.setbacks.left - project.plot.setbacks.right,
  );
  const buildableLength = Math.max(
    0,
    project.plot.length - project.plot.setbacks.front - project.plot.setbacks.rear,
  );

  return {
    unit: "sq ft",
    plotArea,
    netRoomAreaTotal: roomAreaSum,
    totalNetFloorArea: roomAreaSum,
    totalNetBuildingArea,
    grossCoveredArea,
    totalGrossCoveredArea,
    openSiteArea: round(Math.max(0, plotArea - groundGrossArea)),
    measurementDefinitions: {
      netRoomArea: "Usable internal rectangular room area, excluding wall thickness.",
      totalNetFloorArea: "Sum of usable internal room areas on the selected floor, excluding courtyards.",
      grossCoveredArea: "Union of room footprints and canonical wall footprints on the selected floor.",
      openSiteArea: "Plot area remaining outside the gross ground-floor building footprint.",
    },
    // Compatibility aliases retained so existing clients are not silently broken.
    floorCoveredArea: floorArea,
    totalConstructedArea,
    roomAreaSum,
    openArea: round(Math.max(0, plotArea - floorCoveredArea(project, project.floors[0]?.id))),
    coveragePercent: plotArea ? round((grossCoveredArea / plotArea) * 100, 1) : 0,
    buildableEnvelope: {
      x: project.plot.setbacks.left,
      y: project.plot.setbacks.front,
      width: buildableWidth,
      length: buildableLength,
      area: round(buildableWidth * buildableLength),
    },
  };
}

type TopologyEdge = {
  floorId: string;
  orientation: "horizontal" | "vertical";
  coordinate: number;
  start: number;
  end: number;
  roomId: string;
  side: WallSide;
};

function roomEdges(room: Room): TopologyEdge[] {
  return [
    { floorId: room.floorId, orientation: "horizontal", coordinate: room.y, start: room.x, end: room.x + room.width, roomId: room.id, side: "north" },
    { floorId: room.floorId, orientation: "vertical", coordinate: room.x + room.width, start: room.y, end: room.y + room.length, roomId: room.id, side: "east" },
    { floorId: room.floorId, orientation: "horizontal", coordinate: room.y + room.length, start: room.x, end: room.x + room.width, roomId: room.id, side: "south" },
    { floorId: room.floorId, orientation: "vertical", coordinate: room.x, start: room.y, end: room.y + room.length, roomId: room.id, side: "west" },
  ];
}

function coordinateToken(value: number) {
  return String(Math.round(value * 100)).replace("-", "m");
}

function canonicalWallId(edge: Pick<TopologyEdge, "floorId" | "orientation" | "coordinate" | "start" | "end">) {
  return `wall-${edge.floorId}-${edge.orientation[0]}-${coordinateToken(edge.coordinate)}-${coordinateToken(edge.start)}-${coordinateToken(edge.end)}`;
}

function pointOnWall(wall: Wall, point: { x: number; y: number }) {
  const length = wallLength(wall);
  if (!length) return undefined;
  const ux = (wall.x2 - wall.x1) / length;
  const uy = (wall.y2 - wall.y1) / length;
  const offset = (point.x - wall.x1) * ux + (point.y - wall.y1) * uy;
  const distance = Math.abs((point.x - wall.x1) * -uy + (point.y - wall.y1) * ux);
  return { offset, distance };
}

function openingCenter(wall: Wall, opening: Opening) {
  const length = wallLength(wall);
  const ratio = length ? opening.offset / length : 0;
  return {
    x: wall.x1 + (wall.x2 - wall.x1) * ratio,
    y: wall.y1 + (wall.y2 - wall.y1) * ratio,
  };
}

function connectWalls(walls: Wall[]) {
  const samePoint = (a: number, b: number) => Math.abs(a - b) < 0.01;
  return walls.map((wall) => ({
    ...wall,
    connectedWallIds: walls
      .filter((other) => other.id !== wall.id && other.floorId === wall.floorId)
      .filter((other) => [
        [wall.x1, wall.y1, other.x1, other.y1],
        [wall.x1, wall.y1, other.x2, other.y2],
        [wall.x2, wall.y2, other.x1, other.y1],
        [wall.x2, wall.y2, other.x2, other.y2],
      ].some(([ax, ay, bx, by]) => samePoint(ax, bx) && samePoint(ay, by)))
      .map((other) => other.id),
  }));
}

export function rebuildCanonicalTopology(
  project: Project,
  openingTargets: Map<string, { x: number; y: number }> = new Map(),
  strict = true,
) {
  const oldWalls = project.walls.map((wall) => ({ ...wall }));
  const oldWallById = new Map(oldWalls.map((wall) => [wall.id, wall]));
  const independentWalls = oldWalls
    .filter((wall) => !(wall.roomIds?.length || wall.roomId))
    .map((wall) => ({ ...wall, roomIds: [], roomSides: [], exterior: false, connectedWallIds: [], roomId: undefined, side: undefined }));
  const edges = project.rooms.flatMap(roomEdges);
  const groups = new Map<string, TopologyEdge[]>();
  edges.forEach((edge) => {
    const key = `${edge.floorId}:${edge.orientation}:${coordinateToken(edge.coordinate)}`;
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  });
  const topologyWalls: Wall[] = [];
  groups.forEach((group) => {
    const cuts = Array.from(new Set(group.flatMap((edge) => [edge.start, edge.end]))).sort((a, b) => a - b);
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const start = cuts[index];
      const end = cuts[index + 1];
      if (end - start < 0.01) continue;
      const covering = group.filter((edge) => edge.start <= start + 0.01 && edge.end >= end - 0.01);
      if (!covering.length) continue;
      const reference = covering[0];
      const floor = project.floors.find((item) => item.id === reference.floorId);
      const roomSides = covering.map((edge) => ({ roomId: edge.roomId, side: edge.side }));
      const roomIds = Array.from(new Set(roomSides.map((item) => item.roomId)));
      topologyWalls.push({
        id: canonicalWallId({ ...reference, start, end }),
        floorId: reference.floorId,
        x1: reference.orientation === "horizontal" ? start : reference.coordinate,
        y1: reference.orientation === "horizontal" ? reference.coordinate : start,
        x2: reference.orientation === "horizontal" ? end : reference.coordinate,
        y2: reference.orientation === "horizontal" ? reference.coordinate : end,
        thickness: 0.5,
        height: floor?.height ?? 9,
        roomIds,
        roomSides,
        exterior: roomIds.length === 1,
        connectedWallIds: [],
        roomId: roomIds.length === 1 ? roomIds[0] : undefined,
        side: roomIds.length === 1 ? roomSides[0]?.side : undefined,
      });
    }
  });
  project.walls = connectWalls([...topologyWalls, ...independentWalls]);
  project.rooms = project.rooms.map((room) => ({
    ...room,
    wallIds: project.walls.filter((wall) => wall.roomIds.includes(room.id)).map((wall) => wall.id),
  }));

  const migratedOpenings: Opening[] = [];
  for (const opening of project.openings) {
    const oldWall = oldWallById.get(opening.wallId);
    if (!oldWall) {
      if (strict) throw new Error(`Opening ${opening.id} has no host wall.`);
      continue;
    }
    const target = openingTargets.get(opening.id) ?? openingCenter(oldWall, opening);
    const candidates = project.walls
      .filter((wall) => wall.floorId === opening.floorId)
      .map((wall) => ({ wall, placement: pointOnWall(wall, target) }))
      .filter((item): item is { wall: Wall; placement: { offset: number; distance: number } } => Boolean(item.placement))
      .filter(({ wall, placement }) => placement.distance < 0.05 && placement.offset >= opening.width / 2 - 0.01 && placement.offset <= wallLength(wall) - opening.width / 2 + 0.01)
      .sort((a, b) => a.placement.distance - b.placement.distance || b.wall.roomIds.length - a.wall.roomIds.length);
    const candidate = candidates[0];
    if (!candidate) {
      if (strict) throw new Error(`The ${opening.kind} ${opening.id} no longer fits a valid canonical wall.`);
      continue;
    }
    migratedOpenings.push({ ...opening, wallId: candidate.wall.id, offset: round(candidate.placement.offset) });
  }
  project.openings = migratedOpenings;
  return project;
}

function roomOpeningTargets(project: Project, room: Room, nextRoom: Room) {
  const targets = new Map<string, { x: number; y: number }>();
  project.openings.forEach((opening) => {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    if (!wall || wall.roomIds.length !== 1 || wall.roomIds[0] !== room.id) return;
    const side = wall.roomSides.find((item) => item.roomId === room.id)?.side;
    if (!side) return;
    const center = openingCenter(wall, opening);
    const fraction = side === "north" || side === "south" ? (center.x - room.x) / room.width : (center.y - room.y) / room.length;
    if (side === "north") targets.set(opening.id, { x: nextRoom.x + nextRoom.width * fraction, y: nextRoom.y });
    if (side === "south") targets.set(opening.id, { x: nextRoom.x + nextRoom.width * fraction, y: nextRoom.y + nextRoom.length });
    if (side === "west") targets.set(opening.id, { x: nextRoom.x, y: nextRoom.y + nextRoom.length * fraction });
    if (side === "east") targets.set(opening.id, { x: nextRoom.x + nextRoom.width, y: nextRoom.y + nextRoom.length * fraction });
  });
  return targets;
}

export function migrateProject(input: Project): Project {
  const project = cloneProject(input);
  project.schemaVersion = 2;
  project.rooms = (project.rooms ?? []).map((room) => ({ ...room, wallIds: room.wallIds ?? [] }));
  project.walls = (project.walls ?? []).map((wall) => ({
    ...wall,
    roomIds: wall.roomIds ?? (wall.roomId ? [wall.roomId] : []),
    roomSides: wall.roomSides ?? (wall.roomId && wall.side ? [{ roomId: wall.roomId, side: wall.side }] : []),
    exterior: wall.exterior ?? Boolean(wall.roomId),
    connectedWallIds: wall.connectedWallIds ?? [],
  }));
  const normalizedOpenings = (project.openings ?? []).map((opening) => opening.kind === "door"
    ? { ...opening, sillHeight: 0, hingeSide: opening.hingeSide ?? "start", handing: opening.handing ?? "left", swingDirection: opening.swingDirection ?? "inward", state: opening.state ?? "open" }
    : { ...opening, windowType: opening.windowType ?? "fixed", operable: opening.operable ?? false, glazing: opening.glazing ?? "clear", solarTransmittance: opening.solarTransmittance ?? 0.7 });
  project.floors = (project.floors ?? []).map((floor, index) => ({ ...floor, level: floor.level ?? index, elevation: floor.elevation ?? index * (floor.height ?? 9), height: floor.height ?? 9 }));
  if (!project.view || !project.floors.some((floor) => floor.id === project.view.activeFloorId)) {
    project.view = { mode: "2d", navigationMode: "orbit", activeFloorId: project.floors[0]?.id ?? "floor-ground", cameraPreset: "front-right" };
  }
  const knownWallIds = new Set(project.walls.map((wall) => wall.id));
  const positionOnlyOpenings = normalizedOpenings.filter((opening) => !knownWallIds.has(opening.wallId) && opening.legacyPosition);
  project.openings = normalizedOpenings.filter((opening) => knownWallIds.has(opening.wallId));
  rebuildCanonicalTopology(project, new Map(), false);
  positionOnlyOpenings.forEach((opening) => {
    const position = opening.legacyPosition!;
    const candidate = project.walls
      .filter((wall) => wall.floorId === opening.floorId && wall.roomIds.length > 0)
      .map((wall) => ({ wall, placement: pointOnWall(wall, position) }))
      .filter((item): item is { wall: Wall; placement: { offset: number; distance: number } } => Boolean(item.placement))
      .filter(({ wall, placement }) => placement.distance < 0.08 && placement.offset >= opening.width / 2 - 0.01 && placement.offset <= wallLength(wall) - opening.width / 2 + 0.01)
      .sort((a, b) => a.placement.distance - b.placement.distance || b.wall.roomIds.length - a.wall.roomIds.length)[0];
    if (!candidate) return;
    const { legacyPosition: _legacyPosition, ...architecturalOpening } = opening;
    void _legacyPosition;
    project.openings.push({ ...architecturalOpening, wallId: candidate.wall.id, offset: round(candidate.placement.offset) });
  });
  return project;
}

function assertRoomInsidePlot(project: Project, room: Pick<Room, "x" | "y" | "width" | "length">) {
  if (room.width < 3 || room.length < 3) {
    throw new Error("Rooms must be at least 3 × 3 ft.");
  }
  if (
    room.x < 0 ||
    room.y < 0 ||
    room.x + room.width > project.plot.width ||
    room.y + room.length > project.plot.length
  ) {
    throw new Error("The room must remain inside the plot boundary.");
  }
}

function actorLabel(actor: Actor) {
  if (actor === "agent") return "Agent";
  if (actor === "human") return "You";
  return "System";
}

function withActivity(
  project: Project,
  actor: Actor,
  operation: string,
  description: string,
) {
  const version = project.version + 1;
  const updatedAt = new Date().toISOString();
  return {
    ...project,
    version,
    updatedAt,
    activity: [
      {
        id: createId("activity"),
        actor,
        description,
        operation,
        timestamp: updatedAt,
        version,
      },
      ...project.activity,
    ].slice(0, 100),
  };
}

function displayName(project: Project, id: string) {
  return (
    project.rooms.find((item) => item.id === id)?.name ??
    project.walls.find((item) => item.id === id)?.side?.concat(" wall") ??
    project.openings.find((item) => item.id === id)?.kind ??
    project.stairs.find((item) => item.id === id)?.id ??
    id
  );
}

export function applyOperation(
  current: Project,
  operation: ArchitectureOperation,
  actor: Actor,
): OperationOutcome {
  const who = actorLabel(actor);
  let project: Project = {
    ...current,
    plot: { ...current.plot, setbacks: { ...current.plot.setbacks } },
    floors: current.floors.map((item) => ({ ...item })),
    rooms: current.rooms.map((item) => ({ ...item, wallIds: [...(item.wallIds ?? [])] })),
    walls: current.walls.map((item) => ({ ...item, roomIds: [...(item.roomIds ?? [])], roomSides: (item.roomSides ?? []).map((side) => ({ ...side })), connectedWallIds: [...(item.connectedWallIds ?? [])] })),
    openings: current.openings.map((item) => ({ ...item })),
    stairs: current.stairs.map((item) => ({ ...item })),
    view: { ...current.view },
    activity: [...current.activity],
  };
  let result: Record<string, unknown> = {};
  let description = "Project updated";

  switch (operation.type) {
    case "rename_project": {
      const name = operation.name.trim();
      if (!name) throw new Error("Project name cannot be empty.");
      project.name = name;
      description = `${who} renamed the project to ${name}`;
      result = { projectId: project.id, name };
      break;
    }
    case "set_plot": {
      const width = operation.width ?? project.plot.width;
      const length = operation.length ?? project.plot.length;
      if (width < 15 || length < 15) throw new Error("Plot dimensions must be at least 15 ft.");
      project.plot = {
        ...project.plot,
        width,
        length,
        setbacks: { ...project.plot.setbacks, ...operation.setbacks },
      };
      description = `${who} updated the plot to ${width} × ${length} ft`;
      result = { plot: project.plot, metrics: projectMetrics(project) };
      break;
    }
    case "set_plot_orientation": {
      project.plot.orientation = operation.orientation;
      description = `${who} set the plot orientation to ${operation.orientation}`;
      result = { plot: project.plot, orientation: project.plot.orientation };
      break;
    }
    case "create_room": {
      if (!project.floors.some((floor) => floor.id === operation.floorId)) {
        throw new Error(`Floor ${operation.floorId} does not exist.`);
      }
      const room: Room = {
        id: createId("room"),
        floorId: operation.floorId,
        name: operation.name.trim() || operation.roomType,
        type: operation.roomType,
        x: round(operation.x),
        y: round(operation.y),
        width: round(operation.width),
        length: round(operation.length),
        color: roomPalette[operation.roomType],
        wallIds: [],
      };
      assertRoomInsidePlot(project, room);
      project.rooms.push(room);
      rebuildCanonicalTopology(project);
      const createdRoom = project.rooms.find((item) => item.id === room.id)!;
      project.view.focusElementId = room.id;
      description = `${who} added ${room.name} · ${room.width} × ${room.length} ft`;
      result = { room: createdRoom, area: roomArea(room), wallIds: createdRoom.wallIds };
      break;
    }
    case "move_room": {
      const index = project.rooms.findIndex((room) => room.id === operation.roomId);
      if (index < 0) throw new Error(`Room ${operation.roomId} does not exist.`);
      const previousRoom = project.rooms[index];
      const room = { ...previousRoom, x: round(operation.x), y: round(operation.y) };
      assertRoomInsidePlot(project, room);
      const targets = roomOpeningTargets(project, previousRoom, room);
      project.rooms[index] = room;
      rebuildCanonicalTopology(project, targets);
      assertAllOpeningsValid(project);
      project.view.focusElementId = room.id;
      description = `${who} moved ${room.name}`;
      result = { room, area: roomArea(room) };
      break;
    }
    case "resize_room": {
      const index = project.rooms.findIndex((room) => room.id === operation.roomId);
      if (index < 0) throw new Error(`Room ${operation.roomId} does not exist.`);
      const previousRoom = project.rooms[index];
      const room = {
        ...previousRoom,
        width: round(operation.width),
        length: round(operation.length),
      };
      assertRoomInsidePlot(project, room);
      const targets = roomOpeningTargets(project, previousRoom, room);
      project.rooms[index] = room;
      rebuildCanonicalTopology(project, targets);
      assertAllOpeningsValid(project);
      project.view.focusElementId = room.id;
      description = `${who} resized ${room.name} to ${room.width} × ${room.length} ft`;
      result = { room, area: roomArea(room), metrics: projectMetrics(project, room.floorId) };
      break;
    }
    case "update_room": {
      const index = project.rooms.findIndex((room) => room.id === operation.roomId);
      if (index < 0) throw new Error(`Room ${operation.roomId} does not exist.`);
      const previous = project.rooms[index];
      const room = {
        ...previous,
        name: operation.name?.trim() || previous.name,
        type: operation.roomType ?? previous.type,
        color: operation.roomType ? roomPalette[operation.roomType] : previous.color,
      };
      project.rooms[index] = room;
      description = `${who} updated ${room.name}`;
      result = { room };
      break;
    }
    case "delete_room": {
      const room = project.rooms.find((item) => item.id === operation.roomId);
      if (!room) throw new Error(`Room ${operation.roomId} does not exist.`);
      const roomWallIds = new Set(project.walls.filter((wall) => wall.roomIds.length === 1 && wall.roomIds[0] === room.id).map((wall) => wall.id));
      project.rooms = project.rooms.filter((item) => item.id !== room.id);
      project.openings = project.openings.filter((opening) => !roomWallIds.has(opening.wallId));
      rebuildCanonicalTopology(project);
      if (project.view.focusElementId === room.id) project.view.focusElementId = undefined;
      description = `${who} deleted ${room.name}`;
      result = { deletedRoomId: room.id, name: room.name };
      break;
    }
    case "add_wall": {
      if (!project.floors.some((floor) => floor.id === operation.floorId)) {
        throw new Error(`Floor ${operation.floorId} does not exist.`);
      }
      const wall: Wall = {
        id: createId("wall"),
        floorId: operation.floorId,
        x1: round(operation.x1),
        y1: round(operation.y1),
        x2: round(operation.x2),
        y2: round(operation.y2),
        thickness: operation.thickness ?? 0.5,
        height: project.floors.find((floor) => floor.id === operation.floorId)?.height ?? 9,
        roomIds: [],
        roomSides: [],
        exterior: false,
        connectedWallIds: [],
      };
      if (wallLength(wall) < 1) throw new Error("A wall must be at least 1 ft long.");
      project.walls.push(wall);
      project.view.focusElementId = wall.id;
      description = `${who} added a ${round(wallLength(wall), 1)} ft wall`;
      result = { wall, length: round(wallLength(wall), 2) };
      break;
    }
    case "move_wall": {
      const index = project.walls.findIndex((wall) => wall.id === operation.wallId);
      if (index < 0) throw new Error(`Wall ${operation.wallId} does not exist.`);
      const previous = project.walls[index];
      if (previous.roomIds.length) {
        throw new Error("This wall is controlled by its room. Move or resize the room instead.");
      }
      const dx = operation.dx ?? 0;
      const dy = operation.dy ?? 0;
      const wall = {
        ...previous,
        x1: round(operation.x1 ?? previous.x1 + dx),
        y1: round(operation.y1 ?? previous.y1 + dy),
        x2: round(operation.x2 ?? previous.x2 + dx),
        y2: round(operation.y2 ?? previous.y2 + dy),
      };
      project.walls[index] = wall;
      assertAllOpeningsValid(project);
      project.view.focusElementId = wall.id;
      description = `${who} moved a wall`;
      result = { wall, length: round(wallLength(wall), 2) };
      break;
    }
    case "add_opening": {
      const wall = project.walls.find((item) => item.id === operation.wallId);
      if (!wall) throw new Error(`Wall ${operation.wallId} does not exist.`);
      const width = operation.width ?? (operation.kind === "door" ? 3 : 4);
      const length = wallLength(wall);
      if (width <= 0 || operation.offset < width / 2 || operation.offset > length - width / 2) {
        throw new Error(`The ${operation.kind} does not fit on this ${round(length, 1)} ft wall.`);
      }
      const opening: Opening = {
        id: createId(operation.kind),
        floorId: wall.floorId,
        kind: operation.kind,
        wallId: wall.id,
        offset: round(operation.offset),
        width: round(width),
        height: round(operation.height ?? (operation.kind === "door" ? 7 : 4)),
        sillHeight: round(operation.sillHeight ?? (operation.kind === "window" ? 3 : 0)),
        ...(operation.kind === "door" ? {
          hingeSide: operation.hingeSide ?? "start",
          handing: operation.handing ?? "left",
          swingDirection: operation.swingDirection ?? "inward",
          state: operation.state ?? "open",
        } : {
          windowType: operation.windowType ?? "fixed",
          operable: operation.operable ?? false,
          glazing: operation.glazing ?? "clear",
          solarTransmittance: operation.solarTransmittance ?? 0.7,
        }),
      };
      assertOpeningPlacement(project, opening);
      project.openings.push(opening);
      project.view.focusElementId = opening.id;
      description = `${who} added a ${opening.width} ft ${opening.kind}`;
      result = { opening, wallLength: round(length, 2) };
      break;
    }
    case "update_opening": {
      const index = project.openings.findIndex((item) => item.id === operation.openingId);
      if (index < 0) throw new Error(`Opening ${operation.openingId} does not exist.`);
      const previous = project.openings[index];
      const wall = project.walls.find((item) => item.id === previous.wallId);
      if (!wall) throw new Error(`Wall ${previous.wallId} does not exist.`);
      const opening: Opening = {
        ...previous,
        offset: round(operation.offset ?? previous.offset),
        width: round(operation.width ?? previous.width),
        height: round(operation.height ?? previous.height),
        sillHeight: round(operation.sillHeight ?? previous.sillHeight ?? 0),
        hingeSide: operation.hingeSide ?? previous.hingeSide,
        handing: operation.handing ?? previous.handing,
        swingDirection: operation.swingDirection ?? previous.swingDirection,
        state: operation.state ?? previous.state,
        windowType: operation.windowType ?? previous.windowType,
        operable: operation.operable ?? previous.operable,
        glazing: operation.glazing ?? previous.glazing,
        solarTransmittance: operation.solarTransmittance ?? previous.solarTransmittance,
      };
      const length = wallLength(wall);
      assertOpeningPlacement(project, opening, opening.id);
      project.openings[index] = opening;
      project.view.focusElementId = opening.id;
      description = `${who} updated a ${opening.width} ft ${opening.kind}`;
      result = { opening, wallLength: round(length, 2) };
      break;
    }
    case "rehost_opening": {
      const index = project.openings.findIndex((item) => item.id === operation.openingId);
      if (index < 0) throw new Error(`Opening ${operation.openingId} does not exist.`);
      const wall = project.walls.find((item) => item.id === operation.wallId);
      if (!wall) throw new Error(`Wall ${operation.wallId} does not exist.`);
      const opening = { ...project.openings[index], wallId: wall.id, floorId: wall.floorId, offset: round(operation.offset) };
      assertOpeningPlacement(project, opening, opening.id);
      project.openings[index] = opening;
      project.view.activeFloorId = wall.floorId;
      project.view.focusElementId = opening.id;
      description = `${who} rehosted a ${opening.kind} onto a different wall`;
      result = { opening, hostWall: wall };
      break;
    }
    case "add_stairs": {
      const stair: Stair = {
        id: createId("stair"),
        floorId: operation.floorId,
        x: round(operation.x),
        y: round(operation.y),
        width: round(operation.width),
        length: round(operation.length),
        direction: operation.direction ?? "up",
      };
      if (stair.width < 3 || stair.length < 6) throw new Error("Stairs must be at least 3 × 6 ft.");
      if (
        stair.x < 0 || stair.y < 0 ||
        stair.x + stair.width > project.plot.width ||
        stair.y + stair.length > project.plot.length
      ) throw new Error("The staircase must remain inside the plot.");
      project.stairs.push(stair);
      project.view.focusElementId = stair.id;
      description = `${who} added a staircase`;
      result = { stair };
      break;
    }
    case "create_floor": {
      const previous = [...project.floors].sort((a, b) => b.level - a.level)[0];
      const level = (previous?.level ?? -1) + 1;
      const floor: Floor = {
        id: createId("floor"),
        name: operation.name?.trim() || (level === 1 ? "First Floor" : `Floor ${level + 1}`),
        level,
        elevation: round((previous?.elevation ?? 0) + (previous?.height ?? 9)),
        height: operation.height ?? 9,
      };
      project.floors.push(floor);
      project.view.activeFloorId = floor.id;
      description = `${who} created ${floor.name}`;
      result = { floor };
      break;
    }
    case "set_active_floor": {
      const floor = project.floors.find((item) => item.id === operation.floorId);
      if (!floor) throw new Error(`Floor ${operation.floorId} does not exist.`);
      project.view.activeFloorId = floor.id;
      description = `${who} opened ${floor.name}`;
      result = { floor, view: project.view };
      break;
    }
    case "delete_element": {
      const wall = project.walls.find((item) => item.id === operation.elementId);
      const opening = project.openings.find((item) => item.id === operation.elementId);
      const stair = project.stairs.find((item) => item.id === operation.elementId);
      if (wall?.roomIds.length) throw new Error("Canonical room-boundary walls are controlled by their rooms.");
      if (!wall && !opening && !stair) throw new Error("This element cannot be deleted.");
      project.walls = project.walls.filter((item) => item.id !== operation.elementId);
      project.openings = project.openings.filter(
        (item) => item.id !== operation.elementId && item.wallId !== operation.elementId,
      );
      project.stairs = project.stairs.filter((item) => item.id !== operation.elementId);
      description = `${who} deleted ${displayName(current, operation.elementId)}`;
      result = { deletedElementId: operation.elementId };
      break;
    }
    case "switch_view": {
      project.view.mode = operation.mode;
      description = `${who} switched to ${operation.mode === "2d" ? "floor plan" : "3D"} view`;
      result = { view: project.view };
      break;
    }
    case "set_navigation_mode": {
      if (operation.roomId) {
        const room = project.rooms.find((item) => item.id === operation.roomId);
        if (!room) throw new Error(`Room ${operation.roomId} does not exist.`);
        project.view.activeFloorId = room.floorId;
        project.view.focusElementId = room.id;
        project.view.walkStartRoomId = room.id;
      }
      project.view.mode = "3d";
      project.view.navigationMode = operation.mode;
      description = operation.mode === "walk"
        ? `${who} entered the interior walkthrough`
        : `${who} switched to the exterior orbit view`;
      result = { view: project.view, startRoomId: operation.roomId ?? null };
      break;
    }
    case "set_camera": {
      project.view.mode = "3d";
      project.view.navigationMode = "orbit";
      project.view.cameraPreset = operation.preset;
      description = `${who} set the camera to ${operation.preset}`;
      result = { view: project.view };
      break;
    }
    case "focus_element": {
      if (operation.elementId) {
        const exists = [project.rooms, project.walls, project.openings, project.stairs]
          .some((items) => items.some((item) => item.id === operation.elementId));
        if (!exists) throw new Error(`Element ${operation.elementId} does not exist.`);
      }
      project.view.focusElementId = operation.elementId;
      description = operation.elementId
        ? `${who} focused ${displayName(project, operation.elementId)}`
        : `${who} focused the whole project`;
      result = { focusElementId: operation.elementId ?? null, view: project.view };
      break;
    }
  }

  project = withActivity(project, actor, operation.type, description);
  return { project, result: { ...result, projectVersion: project.version }, description };
}

function rectanglesOverlap(a: Room, b: Room) {
  const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapLength = Math.min(a.y + a.length, b.y + b.length) - Math.max(a.y, b.y);
  return {
    overlaps: overlapWidth > 0.01 && overlapLength > 0.01,
    area: round(Math.max(0, overlapWidth) * Math.max(0, overlapLength)),
  };
}

function roomContainsPoint(room: Room, point: { x: number; y: number }) {
  return point.x >= room.x - 0.01 && point.x <= room.x + room.width + 0.01 && point.y >= room.y - 0.01 && point.y <= room.y + room.length + 0.01;
}

export function buildCirculationGraph(project: Project): CirculationGraph {
  const exteriorId = "exterior-site";
  const nodes: CirculationNode[] = [
    { id: exteriorId, type: "exterior", label: "Exterior / site access" },
    ...project.rooms.map((room) => ({ id: room.id, type: "room" as const, label: room.name, floorId: room.floorId })),
  ];
  const edges: CirculationEdge[] = [];
  const invalidDoorIds: string[] = [];
  const invalidStairIds: string[] = [];
  const exteriorDoors: Array<{ opening: Opening; roomId: string; point: { x: number; y: number }; floorLevel: number }> = [];

  project.openings.filter((opening) => opening.kind === "door").forEach((opening) => {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    if (!wall || wall.roomIds.length < 1 || wall.roomIds.length > 2) {
      invalidDoorIds.push(opening.id);
      return;
    }
    if (wall.roomIds.length === 2) {
      edges.push({ id: `circulation-${opening.id}`, type: "door", from: wall.roomIds[0], to: wall.roomIds[1], openingId: opening.id });
      return;
    }
    const point = openingCenter(wall, opening);
    const floorLevel = project.floors.find((floor) => floor.id === opening.floorId)?.level ?? 0;
    exteriorDoors.push({ opening, roomId: wall.roomIds[0], point, floorLevel });
    edges.push({ id: `circulation-${opening.id}`, type: "door", from: exteriorId, to: wall.roomIds[0], openingId: opening.id });
  });

  const floors = [...project.floors].sort((a, b) => a.level - b.level);
  project.stairs.forEach((stair) => {
    const floorIndex = floors.findIndex((floor) => floor.id === stair.floorId);
    const targetFloor = stair.direction === "down" ? floors[floorIndex - 1] : floors[floorIndex + 1];
    const point = { x: stair.x + stair.width / 2, y: stair.y + stair.length / 2 };
    const sourceRoom = project.rooms.find((room) => room.floorId === stair.floorId && roomContainsPoint(room, point));
    const targetRoom = targetFloor && project.rooms.find((room) => room.floorId === targetFloor.id && roomContainsPoint(room, point));
    if (!sourceRoom || !targetRoom) {
      invalidStairIds.push(stair.id);
      return;
    }
    edges.push({ id: `circulation-${stair.id}`, type: "stair", from: sourceRoom.id, to: targetRoom.id, stairId: stair.id });
  });

  const mainEntrance = [...exteriorDoors].sort((a, b) => a.floorLevel - b.floorLevel || a.point.y - b.point.y)[0];
  const primaryEntryRoomId = mainEntrance?.roomId;
  const adjacency = new Map<string, Set<string>>();
  edges.filter((edge) => edge.from !== exteriorId && edge.to !== exteriorId).forEach((edge) => {
    adjacency.set(edge.from, new Set([...(adjacency.get(edge.from) ?? []), edge.to]));
    adjacency.set(edge.to, new Set([...(adjacency.get(edge.to) ?? []), edge.from]));
  });
  const reachable = new Set<string>();
  const queue = primaryEntryRoomId ? [primaryEntryRoomId] : [];
  while (queue.length) {
    const roomId = queue.shift()!;
    if (reachable.has(roomId)) continue;
    reachable.add(roomId);
    (adjacency.get(roomId) ?? []).forEach((next) => {
      if (!reachable.has(next)) queue.push(next);
    });
  }
  const relevantRooms = project.rooms.filter((room) => room.type !== "Courtyard");
  return {
    nodes,
    edges,
    mainEntranceOpeningId: mainEntrance?.opening.id,
    primaryEntryRoomId,
    hasExteriorAccess: exteriorDoors.length > 0,
    reachableRoomIds: Array.from(reachable),
    disconnectedRoomIds: primaryEntryRoomId ? relevantRooms.filter((room) => !reachable.has(room.id)).map((room) => room.id) : relevantRooms.map((room) => room.id),
    invalidDoorIds,
    invalidStairIds,
  };
}

export function validateLayout(project: Project, floorId?: string): ValidationReport {
  const targetFloors = floorId ? [floorId] : project.floors.map((floor) => floor.id);
  const rooms = project.rooms.filter((room) => targetFloors.includes(room.floorId));
  const walls = project.walls.filter((wall) => targetFloors.includes(wall.floorId));
  const issues: ValidationIssue[] = [];
  const { plot } = project;
  const bounds = {
    left: plot.setbacks.left,
    right: plot.width - plot.setbacks.right,
    front: plot.setbacks.front,
    rear: plot.length - plot.setbacks.rear,
  };

  for (const room of rooms) {
    const outside =
      room.x < 0 || room.y < 0 ||
      room.x + room.width > plot.width || room.y + room.length > plot.length;
    if (outside) {
      issues.push({
        id: createId("issue"),
        code: "OUTSIDE_PLOT",
        severity: "error",
        message: `${room.name} extends beyond the plot boundary.`,
        elementIds: [room.id],
        evidence: { x: room.x, y: room.y, width: room.width, length: room.length },
        suggestion: "Move or resize the room so its full footprint is inside the plot.",
      });
    }
    const setbackViolation =
      room.x < bounds.left || room.y < bounds.front ||
      room.x + room.width > bounds.right || room.y + room.length > bounds.rear;
    if (setbackViolation && room.type !== "Courtyard") {
      issues.push({
        id: createId("issue"),
        code: "SETBACK_VIOLATION",
        severity: "warning",
        message: `${room.name} crosses the current buildable envelope.`,
        elementIds: [room.id],
        evidence: { ...bounds },
        suggestion: "Move the room within the dashed setback boundary or revise the project setbacks.",
      });
    }

    const roomWalls = walls.filter((wall) => wall.roomIds.includes(room.id));
    const roomDoors = project.openings.filter(
      (opening) => opening.kind === "door" && roomWalls.some((wall) => openingTouchesWall(project, opening, wall)),
    );
    if (!roomDoors.length && !["Courtyard", "Storage"].includes(room.type)) {
      issues.push({
        id: createId("issue"),
        code: "NO_ROOM_ACCESS",
        severity: "warning",
        message: `${room.name} has no placed door.`,
        elementIds: [room.id],
        evidence: { doorCount: 0 },
        suggestion: "Place a door on one of the room walls and confirm its circulation connection.",
      });
    }
  }

  const circulation = buildCirculationGraph(project);
  const targetRoomIds = new Set(rooms.map((room) => room.id));
  if (rooms.length && !circulation.hasExteriorAccess) {
    issues.push({
      id: createId("issue"),
      code: "NO_EXTERIOR_ACCESS",
      severity: "error",
      message: "The building has no valid door connecting an occupied room to the exterior/site.",
      elementIds: rooms.map((room) => room.id),
      affectedRoomIds: rooms.map((room) => room.id),
      evidence: { exteriorDoorCount: 0 },
      suggestion: "Place a door on an exterior canonical wall to define the main entrance.",
      possibleCorrection: "Add or rehost a door onto an exterior wall, then validate circulation again.",
    });
  }
  const disconnected = circulation.disconnectedRoomIds.filter((roomId) => targetRoomIds.has(roomId));
  if (circulation.hasExteriorAccess && disconnected.length) {
    issues.push({
      id: createId("issue"),
      code: "DISCONNECTED_CIRCULATION",
      severity: "error",
      message: `${disconnected.length} room${disconnected.length === 1 ? " is" : "s are"} disconnected from the main entrance circulation network.`,
      elementIds: disconnected,
      affectedRoomIds: disconnected,
      evidence: { disconnectedRoomCount: disconnected.length, mainEntranceOpeningId: circulation.mainEntranceOpeningId ?? "none" },
      suggestion: "Add or rehost doors so every occupied room can reach the primary entry room without using the exterior as a shortcut.",
      possibleCorrection: "Inspect circulation, then connect each isolated group to a reachable room with a valid interior door.",
    });
  }
  circulation.invalidDoorIds.forEach((openingId) => {
    const opening = project.openings.find((item) => item.id === openingId);
    if (!opening || !targetFloors.includes(opening.floorId)) return;
    issues.push({
      id: createId("issue"),
      code: "OPENING_WITHOUT_ADJACENCY",
      severity: "error",
      message: "A door is not hosted by a wall separating one or two valid spaces.",
      elementIds: [opening.id, opening.wallId],
      affectedOpeningId: opening.id,
      evidence: { openingId: opening.id, wallId: opening.wallId },
      suggestion: "Rehost the door onto an exterior wall or a shared wall between two rooms.",
      possibleCorrection: "Use rehost_door with a compatible canonical wall and a valid offset.",
    });
  });
  circulation.invalidStairIds.forEach((stairId) => {
    const stair = project.stairs.find((item) => item.id === stairId);
    if (!stair || !targetFloors.includes(stair.floorId)) return;
    issues.push({
      id: createId("issue"),
      code: "INVALID_STAIR_CONNECTION",
      severity: "error",
      message: "A staircase does not connect valid rooms on adjacent floors at the same plan position.",
      elementIds: [stair.id],
      evidence: { stairId: stair.id, floorId: stair.floorId },
      suggestion: "Move the stair within rooms that overlap vertically on adjacent floors, or add the missing destination floor/room.",
      possibleCorrection: "Create aligned stair landings on consecutive floors and validate floor connections again.",
    });
  });

  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      if (rooms[i].floorId !== rooms[j].floorId) continue;
      const overlap = rectanglesOverlap(rooms[i], rooms[j]);
      if (overlap.overlaps) {
        issues.push({
          id: createId("issue"),
          code: "ROOM_OVERLAP",
          severity: "error",
          message: `${rooms[i].name} overlaps ${rooms[j].name} by ${overlap.area} sq ft.`,
          elementIds: [rooms[i].id, rooms[j].id],
          evidence: { overlapArea: overlap.area },
          suggestion: "Move or resize one of the rooms until their footprints no longer overlap.",
        });
      }
    }
  }

  for (const wall of walls) {
    const outside = [wall.x1, wall.x2].some((x) => x < 0 || x > plot.width) ||
      [wall.y1, wall.y2].some((y) => y < 0 || y > plot.length);
    if (outside) {
      issues.push({
        id: createId("issue"),
        code: "WALL_OUTSIDE_PLOT",
        severity: "error",
        message: "A wall extends outside the plot.",
        elementIds: [wall.id],
        evidence: { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 },
        suggestion: "Move the wall endpoints inside the plot boundary.",
      });
    }
  }

  for (const opening of project.openings.filter((item) => targetFloors.includes(item.floorId))) {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    const length = wall ? wallLength(wall) : 0;
    const verticalInvalid = Boolean(wall && ((opening.sillHeight ?? 0) < 0 || opening.height <= 0 || (opening.sillHeight ?? 0) + opening.height > wall.height));
    if (!wall || wall.roomIds.length < 1 || wall.roomIds.length > 2 || opening.offset < opening.width / 2 || opening.offset > length - opening.width / 2 || verticalInvalid) {
      issues.push({
        id: createId("issue"),
        code: "INVALID_OPENING",
        severity: "error",
        message: `A ${opening.kind} is not positioned on a valid wall segment.`,
        elementIds: [opening.id, opening.wallId],
        evidence: { offset: opening.offset, width: opening.width, wallLength: round(length), height: opening.height, sillHeight: opening.sillHeight ?? 0, wallHeight: wall?.height ?? 0 },
        suggestion: `Reposition the ${opening.kind} within the wall or select another wall.`,
      });
    }
  }

  const targetOpenings = project.openings.filter((item) => targetFloors.includes(item.floorId));
  for (let firstIndex = 0; firstIndex < targetOpenings.length; firstIndex += 1) {
    const first = targetOpenings[firstIndex];
    const firstWall = project.walls.find((item) => item.id === first.wallId);
    if (!firstWall) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < targetOpenings.length; secondIndex += 1) {
      const second = targetOpenings[secondIndex];
      const secondWall = project.walls.find((item) => item.id === second.wallId);
      if (!secondWall || first.floorId !== second.floorId) continue;
      const overlap = collinearOverlapLength(openingSegment(firstWall, first), openingSegment(secondWall, second));
      if (overlap <= 0.05) continue;
      issues.push({
        id: createId("issue"),
        code: "OPENING_OVERLAP",
        severity: "error",
        message: `A ${first.kind} overlaps a ${second.kind} by ${round(overlap, 2)} ft.`,
        elementIds: [first.id, second.id],
        evidence: { overlapLength: round(overlap, 2), firstWallId: first.wallId, secondWallId: second.wallId },
        suggestion: "Move or resize one opening so each wall cutout has its own clear span.",
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  return {
    status: issues.length ? "issues-found" : "pass",
    checkedAt: new Date().toISOString(),
    projectVersion: project.version,
    floorId,
    issueCount: issues.length,
    errors,
    warnings,
    issues,
  };
}

export function inspectRoom(project: Project, roomId: string) {
  const room = project.rooms.find((item) => item.id === roomId);
  if (!room) throw new Error(`Room ${roomId} does not exist.`);
  const walls = project.walls.filter((wall) => wall.roomIds.includes(room.id));
  const openings = project.openings.filter((opening) => walls.some((wall) => openingTouchesWall(project, opening, wall)));
  const adjacentRooms = project.rooms
    .filter((other) => other.id !== room.id && other.floorId === room.floorId)
    .filter((other) => {
      const touchesX = Math.abs(room.x + room.width - other.x) < 0.05 ||
        Math.abs(other.x + other.width - room.x) < 0.05;
      const overlapsY = Math.min(room.y + room.length, other.y + other.length) - Math.max(room.y, other.y) > 0;
      const touchesY = Math.abs(room.y + room.length - other.y) < 0.05 ||
        Math.abs(other.y + other.length - room.y) < 0.05;
      const overlapsX = Math.min(room.x + room.width, other.x + other.width) - Math.max(room.x, other.x) > 0;
      return (touchesX && overlapsY) || (touchesY && overlapsX);
    })
    .map((other) => ({ id: other.id, name: other.name }));

  const circulation = buildCirculationGraph(project);
  return {
    room,
    netRoomArea: roomArea(room),
    area: roomArea(room),
    areaDefinition: "Usable internal rectangular room area, excluding wall thickness.",
    perimeter: round(2 * (room.width + room.length)),
    walls,
    openings,
    adjacentRooms,
    circulation: {
      reachableFromMainEntrance: circulation.reachableRoomIds.includes(room.id),
      connectedEdges: circulation.edges.filter((edge) => edge.from === room.id || edge.to === room.id),
    },
  };
}

export function inspectWall(project: Project, wallId: string) {
  const wall = project.walls.find((item) => item.id === wallId);
  if (!wall) throw new Error(`Wall ${wallId} does not exist.`);
  return {
    wall,
    length: round(wallLength(wall)),
    orientation: Math.abs(wall.y2 - wall.y1) < 0.01 ? "horizontal" : Math.abs(wall.x2 - wall.x1) < 0.01 ? "vertical" : "angled",
    adjacentRooms: wall.roomIds.map((roomId) => {
      const room = project.rooms.find((item) => item.id === roomId);
      return { id: roomId, name: room?.name ?? roomId, side: wall.roomSides.find((item) => item.roomId === roomId)?.side };
    }),
    openings: project.openings.filter((opening) => opening.wallId === wall.id),
    connectedWallIds: wall.connectedWallIds,
  };
}

export function inspectOpening(project: Project, openingId: string) {
  const opening = project.openings.find((item) => item.id === openingId);
  if (!opening) throw new Error(`Opening ${openingId} does not exist.`);
  return { opening, hostWall: inspectWall(project, opening.wallId) };
}

export function inspectFloor(project: Project, floorId: string) {
  const floor = project.floors.find((item) => item.id === floorId);
  if (!floor) throw new Error(`Floor ${floorId} does not exist.`);
  return {
    floor,
    rooms: project.rooms.filter((room) => room.floorId === floorId),
    walls: project.walls.filter((wall) => wall.floorId === floorId),
    openings: project.openings.filter((opening) => opening.floorId === floorId),
    stairs: project.stairs.filter((stair) => stair.floorId === floorId),
    metrics: projectMetrics(project, floorId),
    circulation: buildCirculationGraph(project),
    validation: validateLayout(project, floorId),
  };
}

function elementPoint(project: Project, ref: PointRef) {
  if ("x" in ref) return { x: ref.x, y: ref.y };
  if (ref.elementId === "plot") return { x: project.plot.width / 2, y: project.plot.length / 2 };
  const room = project.rooms.find((item) => item.id === ref.elementId);
  if (room) return { x: room.x + room.width / 2, y: room.y + room.length / 2 };
  const wall = project.walls.find((item) => item.id === ref.elementId);
  if (wall) {
    if (ref.anchor === "start") return { x: wall.x1, y: wall.y1 };
    if (ref.anchor === "end") return { x: wall.x2, y: wall.y2 };
    return { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 };
  }
  const stair = project.stairs.find((item) => item.id === ref.elementId);
  if (stair) return { x: stair.x + stair.width / 2, y: stair.y + stair.length / 2 };
  const opening = project.openings.find((item) => item.id === ref.elementId);
  if (opening) {
    const openingWall = project.walls.find((item) => item.id === opening.wallId);
    if (openingWall) {
      const length = wallLength(openingWall);
      const ratio = length ? opening.offset / length : 0;
      return {
        x: openingWall.x1 + (openingWall.x2 - openingWall.x1) * ratio,
        y: openingWall.y1 + (openingWall.y2 - openingWall.y1) * ratio,
      };
    }
  }
  throw new Error(`Element ${ref.elementId} does not exist.`);
}

export function measureDistance(project: Project, from: PointRef, to: PointRef) {
  const start = elementPoint(project, from);
  const end = elementPoint(project, to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    from: start,
    to: end,
    distance: round(Math.hypot(dx, dy)),
    horizontal: round(Math.abs(dx)),
    vertical: round(Math.abs(dy)),
    unit: "ft",
  };
}

export function projectInspection(project: Project) {
  return {
    project: {
      id: project.id,
      name: project.name,
      schemaVersion: project.schemaVersion,
      version: project.version,
      unit: project.unit,
      updatedAt: project.updatedAt,
    },
    plot: project.plot,
    floors: project.floors,
    counts: {
      floors: project.floors.length,
      rooms: project.rooms.length,
      walls: project.walls.length,
      doors: project.openings.filter((opening) => opening.kind === "door").length,
      windows: project.openings.filter((opening) => opening.kind === "window").length,
      stairs: project.stairs.length,
    },
    metrics: projectMetrics(project),
    currentView: project.view,
    circulation: buildCirculationGraph(project),
    validationSummary: (() => {
      const report = validateLayout(project);
      return { status: report.status, issues: report.issueCount, errors: report.errors, warnings: report.warnings };
    })(),
    floorsDetail: project.floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      roomIds: project.rooms.filter((room) => room.floorId === floor.id).map((room) => room.id),
    })),
  };
}

export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}
