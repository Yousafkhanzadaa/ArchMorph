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
export type PlanPoint = { x: number; y: number };
export type RoomShape = "rectangle" | "l-shape" | "t-shape" | "u-shape" | "custom";
export type StairRotation = 0 | 90 | 180 | 270;
export type ExteriorFinishId = "stucco" | "brick" | "concrete" | "timber" | "metal";

export const exteriorFinishPresets: Record<ExteriorFinishId, {
  label: string;
  description: string;
  color: string;
  roughness: number;
  metalness: number;
}> = {
  stucco: { label: "Mineral stucco", description: "Light, matte rendered exterior finish.", color: "#ddd5c7", roughness: 0.92, metalness: 0 },
  brick: { label: "Brick masonry", description: "Warm red-brown masonry finish.", color: "#9f6653", roughness: 0.9, metalness: 0 },
  concrete: { label: "Exposed concrete", description: "Neutral architectural concrete finish.", color: "#aaa79f", roughness: 0.82, metalness: 0 },
  timber: { label: "Timber cladding", description: "Warm natural timber rainscreen finish.", color: "#9a7150", roughness: 0.76, metalness: 0 },
  metal: { label: "Metal panel", description: "Muted standing-seam style metal finish.", color: "#69756f", roughness: 0.48, metalness: 0.58 },
};

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
  shape?: RoomShape;
  /** Ordered orthogonal boundary vertices. Rectangles omit this for compact compatibility. */
  vertices?: PlanPoint[];
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
export type GlazingType = "clear" | "low-e" | "privacy";

export const glazingPerformanceDefaults: Record<GlazingType, {
  label: string;
  solarHeatGainCoefficient: number;
  visibleTransmittance: number;
  uFactor: number;
}> = {
  clear: {
    label: "Clear double glazing",
    solarHeatGainCoefficient: 0.55,
    visibleTransmittance: 0.7,
    uFactor: 0.45,
  },
  "low-e": {
    label: "Low-e double glazing",
    solarHeatGainCoefficient: 0.35,
    visibleTransmittance: 0.62,
    uFactor: 0.3,
  },
  privacy: {
    label: "Obscure double glazing",
    solarHeatGainCoefficient: 0.4,
    visibleTransmittance: 0.35,
    uFactor: 0.45,
  },
};

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
  solarHeatGainCoefficient?: number;
  visibleTransmittance?: number;
  uFactor?: number;
  /** @deprecated Legacy concept input retained for imported projects and older tool clients. */
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
  rotation: StairRotation;
};

export type StairConnection = {
  stair: Stair;
  sourceFloor: Floor;
  targetFloor: Floor;
  lowerFloor: Floor;
  upperFloor: Floor;
  rise: number;
  riserCount: number;
  riserHeight: number;
  treadCount: number;
  treadDepth: number;
  recommendedRun: number;
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
  exteriorFinish: ExteriorFinishId;
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
    | "INVALID_STAIR_GEOMETRY"
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
  routesFromMainEntrance: Array<{
    roomId: string;
    roomName: string;
    nodePath: string[];
    elementPath: string[];
  }>;
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
      shape?: Exclude<RoomShape, "custom">;
    }
  | {
      type: "create_polygon_room";
      floorId: string;
      name: string;
      roomType: RoomType;
      vertices: PlanPoint[];
    }
  | { type: "move_room"; roomId: string; x: number; y: number }
  | { type: "resize_room"; roomId: string; width: number; length: number }
  | { type: "update_room_vertices"; roomId: string; vertices: PlanPoint[] }
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
      solarHeatGainCoefficient?: number;
      visibleTransmittance?: number;
      uFactor?: number;
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
      solarHeatGainCoefficient?: number;
      visibleTransmittance?: number;
      uFactor?: number;
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
      rotation?: StairRotation;
    }
  | {
      type: "update_stairs";
      stairId: string;
      x?: number;
      y?: number;
      width?: number;
      length?: number;
      direction?: "up" | "down";
      rotation?: StairRotation;
    }
  | { type: "set_exterior_finish"; finish: ExteriorFinishId }
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
    schemaVersion: 4,
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
    exteriorFinish: "stucco",
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
  const scaled = value * factor;
  // Stabilize decimal half values such as 67.725 that binary floating point stores just below the tie.
  return Math.round(scaled + Math.sign(scaled) * 1e-9) / factor;
}

export function roomVertices(room: Room): PlanPoint[] {
  if (room.vertices?.length) return room.vertices.map((point) => ({ ...point }));
  return [
    { x: room.x, y: room.y },
    { x: room.x + room.width, y: room.y },
    { x: room.x + room.width, y: room.y + room.length },
    { x: room.x, y: room.y + room.length },
  ];
}

export function roomBounds(room: Pick<Room, "x" | "y" | "width" | "length" | "vertices">) {
  const vertices = room.vertices?.length ? room.vertices : [
    { x: room.x, y: room.y },
    { x: room.x + room.width, y: room.y + room.length },
  ];
  const xs = vertices.map((point) => point.x);
  const ys = vertices.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, length: Math.max(...ys) - y };
}

export function roomCentroid(room: Room) {
  const vertices = roomVertices(room);
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  vertices.forEach((point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const cross = point.x * next.y - next.x * point.y;
    twiceArea += cross;
    x += (point.x + next.x) * cross;
    y += (point.y + next.y) * cross;
  });
  if (Math.abs(twiceArea) < 0.001) {
    const bounds = roomBounds(room);
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.length / 2 };
  }
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
}

export function roomArea(room: Room) {
  const vertices = roomVertices(room);
  const twiceArea = vertices.reduce((sum, point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return round(Math.abs(twiceArea) / 2);
}

export function roomPerimeter(room: Room) {
  const vertices = roomVertices(room);
  return round(vertices.reduce((sum, point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0));
}

export function roomContainsPoint(room: Room, point: PlanPoint) {
  const vertices = roomVertices(room);
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
    const a = vertices[index];
    const b = vertices[previous];
    const onEdge = Math.abs((point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)) < 0.01
      && point.x >= Math.min(a.x, b.x) - 0.01 && point.x <= Math.max(a.x, b.x) + 0.01
      && point.y >= Math.min(a.y, b.y) - 0.01 && point.y <= Math.max(a.y, b.y) + 0.01;
    if (onEdge) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function stairFootprint(stair: Pick<Stair, "x" | "y" | "width" | "length" | "rotation">) {
  const rotated = stair.rotation === 90 || stair.rotation === 270;
  return { x: stair.x, y: stair.y, width: rotated ? stair.length : stair.width, length: rotated ? stair.width : stair.length };
}

/** Maps width/run-local stair coordinates into plan coordinates. Local v=0 is the upper landing. */
export function stairPlanPoint(stair: Pick<Stair, "x" | "y" | "width" | "length" | "rotation">, u: number, v: number): PlanPoint {
  if (stair.rotation === 90) return { x: stair.x + v, y: stair.y + stair.width - u };
  if (stair.rotation === 180) return { x: stair.x + stair.width - u, y: stair.y + stair.length - v };
  if (stair.rotation === 270) return { x: stair.x + stair.length - v, y: stair.y + u };
  return { x: stair.x + u, y: stair.y + v };
}

export function stairLocalPoint(stair: Pick<Stair, "x" | "y" | "width" | "length" | "rotation">, point: PlanPoint) {
  if (stair.rotation === 90) return { u: stair.y + stair.width - point.y, v: point.x - stair.x };
  if (stair.rotation === 180) return { u: stair.x + stair.width - point.x, v: stair.y + stair.length - point.y };
  if (stair.rotation === 270) return { u: point.y - stair.y, v: stair.x + stair.length - point.x };
  return { u: point.x - stair.x, v: point.y - stair.y };
}

export function wallLength(wall: Wall) {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

const CONCEPT_MAX_RISER = 7.75 / 12;
const CONCEPT_MIN_TREAD = 10 / 12;

export function stairConnection(project: Project, stair: Stair): StairConnection | undefined {
  const floors = [...project.floors].sort((a, b) => a.level - b.level);
  const sourceIndex = floors.findIndex((floor) => floor.id === stair.floorId);
  if (sourceIndex < 0) return undefined;
  const sourceFloor = floors[sourceIndex];
  const targetFloor = stair.direction === "down" ? floors[sourceIndex - 1] : floors[sourceIndex + 1];
  if (!targetFloor) return undefined;
  const lowerFloor = sourceFloor.elevation <= targetFloor.elevation ? sourceFloor : targetFloor;
  const upperFloor = sourceFloor.elevation > targetFloor.elevation ? sourceFloor : targetFloor;
  const rise = Math.abs(upperFloor.elevation - lowerFloor.elevation);
  if (rise <= 0) return undefined;
  const riserCount = Math.max(1, Math.ceil(rise / CONCEPT_MAX_RISER));
  const treadCount = Math.max(1, riserCount - 1);
  return {
    stair,
    sourceFloor,
    targetFloor,
    lowerFloor,
    upperFloor,
    rise: round(rise, 3),
    riserCount,
    riserHeight: round(rise / riserCount, 3),
    treadCount,
    treadDepth: round(stair.length / treadCount, 3),
    recommendedRun: Math.ceil(treadCount * CONCEPT_MIN_TREAD * 2) / 2,
  };
}

export function recommendedStairRun(
  project: Project,
  floorId: string,
  direction: "up" | "down",
) {
  const placeholder: Stair = { id: "stair-preview", floorId, x: 0, y: 0, width: 3, length: 6, direction, rotation: 0 };
  return stairConnection(project, placeholder)?.recommendedRun ?? 10;
}

export function wallCardinalFacing(project: Project, wall: Wall) {
  if (!wall.exterior || wall.roomIds.length !== 1) return undefined;
  const side = wall.roomSides.find((item) => item.roomId === wall.roomIds[0])?.side;
  if (!side) return undefined;
  const directions = ["North", "East", "South", "West"] as const;
  const frontIndex = directions.indexOf(project.plot.orientation);
  const offset = { north: 0, east: 1, south: 2, west: 3 }[side];
  return directions[(frontIndex + offset) % directions.length];
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

function assertWindowPerformance(opening: Opening) {
  if (opening.kind !== "window") return;
  const bounded = [
    ["Solar heat-gain coefficient", opening.solarHeatGainCoefficient, 0, 1],
    ["Visible transmittance", opening.visibleTransmittance, 0, 1],
    ["U-factor", opening.uFactor, 0.1, 2],
  ] as const;
  for (const [label, value, minimum, maximum] of bounded) {
    if (value === undefined || value < minimum || value > maximum) {
      throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
    }
  }
}

function assertAllOpeningsValid(project: Project) {
  project.openings.forEach((opening) => assertOpeningPlacement(project, opening, opening.id));
}

function polygonIntervalsAtX(vertices: PlanPoint[], x: number) {
  const ys = vertices.flatMap((point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    if (Math.abs(point.y - next.y) > 0.01) return [];
    const left = Math.min(point.x, next.x);
    const right = Math.max(point.x, next.x);
    return x > left + 0.001 && x < right - 0.001 ? [point.y] : [];
  }).sort((a, b) => a - b);
  const intervals: Array<readonly [number, number]> = [];
  for (let index = 0; index + 1 < ys.length; index += 2) intervals.push([ys[index], ys[index + 1]]);
  return intervals;
}

function mergedIntervalLength(intervals: Array<readonly [number, number]>) {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let start = sorted[0][0];
  let end = sorted[0][1];
  let covered = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const [nextStart, nextEnd] = sorted[index];
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else { covered += end - start; start = nextStart; end = nextEnd; }
  }
  return covered + end - start;
}

function floorCoveredArea(project: Project, floorId: string) {
  const rooms = project.rooms.filter(
    (room) => room.floorId === floorId && room.type !== "Courtyard",
  );
  if (!rooms.length) return 0;

  const xs = Array.from(new Set(rooms.flatMap((room) => roomVertices(room).map((point) => point.x)))).sort((a, b) => a - b);
  let area = 0;

  for (let i = 0; i < xs.length - 1; i += 1) {
    const left = xs[i];
    const right = xs[i + 1];
    const width = right - left;
    if (width <= 0) continue;

    const intervals = rooms.flatMap((room) => polygonIntervalsAtX(roomVertices(room), (left + right) / 2));
    area += width * mergedIntervalLength(intervals);
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
    .flatMap((room) => {
      const vertices = roomVertices(room);
      const xs = Array.from(new Set(vertices.map((point) => point.x))).sort((a, b) => a - b);
      return xs.slice(0, -1).flatMap((left, index) => polygonIntervalsAtX(vertices, (left + xs[index + 1]) / 2).map(([top, bottom]) => ({ left, top, right: xs[index + 1], bottom })));
    });
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
      netRoomArea: "Usable internal room-polygon area, excluding wall thickness.",
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
  const vertices = roomVertices(room);
  return vertices.map((point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const horizontal = Math.abs(point.y - next.y) < 0.01;
    const side: WallSide = horizontal
      ? (next.x > point.x ? "north" : "south")
      : (next.y > point.y ? "east" : "west");
    return {
      floorId: room.floorId,
      orientation: horizontal ? "horizontal" : "vertical",
      coordinate: horizontal ? point.y : point.x,
      start: horizontal ? Math.min(point.x, next.x) : Math.min(point.y, next.y),
      end: horizontal ? Math.max(point.x, next.x) : Math.max(point.y, next.y),
      roomId: room.id,
      side,
    };
  });
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
    const center = openingCenter(wall, opening);
    targets.set(opening.id, {
      x: nextRoom.x + (center.x - room.x) / room.width * nextRoom.width,
      y: nextRoom.y + (center.y - room.y) / room.length * nextRoom.length,
    });
  });
  return targets;
}

function shapeVertices(shape: Exclude<RoomShape, "custom">, x: number, y: number, width: number, length: number) {
  if (shape === "rectangle") return undefined;
  if (shape === "l-shape") return [
    { x, y }, { x: x + width, y }, { x: x + width, y: y + length },
    { x: x + width * 0.55, y: y + length }, { x: x + width * 0.55, y: y + length * 0.55 },
    { x, y: y + length * 0.55 },
  ];
  if (shape === "t-shape") return [
    { x, y }, { x: x + width, y }, { x: x + width, y: y + length * 0.4 },
    { x: x + width * 0.65, y: y + length * 0.4 }, { x: x + width * 0.65, y: y + length },
    { x: x + width * 0.35, y: y + length }, { x: x + width * 0.35, y: y + length * 0.4 },
    { x, y: y + length * 0.4 },
  ];
  return [
    { x, y }, { x: x + width, y }, { x: x + width, y: y + length },
    { x: x + width * 0.65, y: y + length }, { x: x + width * 0.65, y: y + length * 0.45 },
    { x: x + width * 0.35, y: y + length * 0.45 }, { x: x + width * 0.35, y: y + length },
    { x, y: y + length },
  ];
}

function signedPolygonArea(vertices: PlanPoint[]) {
  return vertices.reduce((sum, point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function normalizedRoomVertices(vertices: PlanPoint[]) {
  const rounded = vertices.map((point) => ({ x: round(point.x), y: round(point.y) }));
  if (rounded.length > 1 && Math.hypot(rounded[0].x - rounded.at(-1)!.x, rounded[0].y - rounded.at(-1)!.y) < 0.01) rounded.pop();
  return signedPolygonArea(rounded) < 0 ? rounded.reverse() : rounded;
}

function segmentsIntersect(a: PlanPoint, b: PlanPoint, c: PlanPoint, d: PlanPoint) {
  const cross = (p: PlanPoint, q: PlanPoint, r: PlanPoint) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: PlanPoint, q: PlanPoint, r: PlanPoint) => Math.abs(cross(p, q, r)) < 0.001
    && r.x >= Math.min(p.x, q.x) - 0.001 && r.x <= Math.max(p.x, q.x) + 0.001
    && r.y >= Math.min(p.y, q.y) - 0.001 && r.y <= Math.max(p.y, q.y) + 0.001;
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function assertRoomVertices(project: Project, vertices: PlanPoint[]) {
  if (vertices.length < 4 || vertices.length > 12) throw new Error("Room polygons require 4–12 boundary vertices.");
  vertices.forEach((point, index) => {
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const horizontal = Math.abs(point.y - next.y) < 0.01;
    const vertical = Math.abs(point.x - next.x) < 0.01;
    if (!horizontal && !vertical) throw new Error("Room polygon edges must remain orthogonal (horizontal or vertical).");
    if (Math.hypot(next.x - point.x, next.y - point.y) < 1) throw new Error("Each room boundary segment must be at least 1 ft.");
    if ((Math.abs(previous.x - point.x) < 0.01 && Math.abs(point.x - next.x) < 0.01)
      || (Math.abs(previous.y - point.y) < 0.01 && Math.abs(point.y - next.y) < 0.01)) {
      throw new Error("Room polygon vertices cannot create redundant or reversing collinear edges.");
    }
  });
  vertices.forEach((a, firstIndex) => {
    const b = vertices[(firstIndex + 1) % vertices.length];
    vertices.forEach((c, secondIndex) => {
      if (secondIndex <= firstIndex + 1 || (firstIndex === 0 && secondIndex === vertices.length - 1)) return;
      const d = vertices[(secondIndex + 1) % vertices.length];
      if (segmentsIntersect(a, b, c, d)) throw new Error("Room polygon edges cannot cross, touch, or overlap outside adjacent corners.");
    });
  });
  const bounds = roomBounds({ x: 0, y: 0, width: 0, length: 0, vertices });
  if (bounds.width < 3 || bounds.length < 3 || Math.abs(signedPolygonArea(vertices)) < 9) throw new Error("Room polygons must span at least 3 × 3 ft and contain at least 9 sq ft.");
  if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > project.plot.width || bounds.y + bounds.length > project.plot.length) throw new Error("The room must remain inside the plot boundary.");
}

function roomFromVertices(room: Room, vertices: PlanPoint[], shape: RoomShape = "custom") {
  const normalized = normalizedRoomVertices(vertices);
  const bounds = roomBounds({ ...room, vertices: normalized });
  return { ...room, ...bounds, shape, vertices: normalized };
}

export function migrateProject(input: Project): Project {
  const project = cloneProject(input);
  project.schemaVersion = 4;
  project.exteriorFinish = exteriorFinishPresets[project.exteriorFinish] ? project.exteriorFinish : "stucco";
  project.rooms = (project.rooms ?? []).map((room) => {
    if (!room.vertices?.length) return { ...room, shape: room.shape ?? "rectangle", wallIds: room.wallIds ?? [] };
    const normalized = normalizedRoomVertices(room.vertices);
    return { ...room, ...roomBounds({ ...room, vertices: normalized }), shape: room.shape ?? "custom", vertices: normalized, wallIds: room.wallIds ?? [] };
  });
  project.walls = (project.walls ?? []).map((wall) => ({
    ...wall,
    roomIds: wall.roomIds ?? (wall.roomId ? [wall.roomId] : []),
    roomSides: wall.roomSides ?? (wall.roomId && wall.side ? [{ roomId: wall.roomId, side: wall.side }] : []),
    exterior: wall.exterior ?? Boolean(wall.roomId),
    connectedWallIds: wall.connectedWallIds ?? [],
  }));
  const normalizedOpenings = (project.openings ?? []).map((opening) => {
    if (opening.kind === "door") {
      return { ...opening, sillHeight: 0, hingeSide: opening.hingeSide ?? "start", handing: opening.handing ?? "left", swingDirection: opening.swingDirection ?? "inward", state: opening.state ?? "open" };
    }
    const glazing = opening.glazing ?? "clear";
    const defaults = glazingPerformanceDefaults[glazing];
    const legacySolarFactor = opening.solarTransmittance;
    return {
      ...opening,
      windowType: opening.windowType ?? "fixed",
      operable: opening.operable ?? false,
      glazing,
      solarHeatGainCoefficient: opening.solarHeatGainCoefficient ?? legacySolarFactor ?? defaults.solarHeatGainCoefficient,
      visibleTransmittance: opening.visibleTransmittance ?? defaults.visibleTransmittance,
      uFactor: opening.uFactor ?? defaults.uFactor,
    };
  });
  project.floors = (project.floors ?? []).map((floor, index) => ({ ...floor, level: floor.level ?? index, elevation: floor.elevation ?? index * (floor.height ?? 9), height: floor.height ?? 9 }));
  project.stairs = (project.stairs ?? []).map((stair) => ({ ...stair, rotation: stair.rotation ?? 0 }));
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

function assertRoomInsidePlot(project: Project, room: Pick<Room, "x" | "y" | "width" | "length"> & Partial<Pick<Room, "vertices">>) {
  if (room.vertices?.length) {
    assertRoomVertices(project, room.vertices);
    return;
  }
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

function assertStairInsidePlot(project: Project, stair: Pick<Stair, "x" | "y" | "width" | "length" | "rotation">) {
  if (stair.width < 3 || stair.length < 6) throw new Error("Straight stairs must be at least 3 × 6 ft.");
  const footprint = stairFootprint(stair);
  if (
    footprint.x < 0 || footprint.y < 0 ||
    footprint.x + footprint.width > project.plot.width ||
    footprint.y + footprint.length > project.plot.length
  ) throw new Error("The staircase must remain inside the plot.");
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
      let room: Room = {
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
        shape: operation.shape ?? "rectangle",
      };
      const vertices = shapeVertices(operation.shape ?? "rectangle", room.x, room.y, room.width, room.length);
      if (vertices) room = roomFromVertices(room, vertices, operation.shape);
      assertRoomInsidePlot(project, room);
      project.rooms.push(room);
      rebuildCanonicalTopology(project);
      const createdRoom = project.rooms.find((item) => item.id === room.id)!;
      project.view.focusElementId = room.id;
      description = `${who} added ${room.name} · ${room.width} × ${room.length} ft`;
      result = { room: createdRoom, area: roomArea(room), wallIds: createdRoom.wallIds };
      break;
    }
    case "create_polygon_room": {
      if (!project.floors.some((floor) => floor.id === operation.floorId)) throw new Error(`Floor ${operation.floorId} does not exist.`);
      const normalized = normalizedRoomVertices(operation.vertices);
      assertRoomVertices(project, normalized);
      const bounds = roomBounds({ x: 0, y: 0, width: 0, length: 0, vertices: normalized });
      const room = roomFromVertices({
        id: createId("room"), floorId: operation.floorId, name: operation.name.trim() || operation.roomType,
        type: operation.roomType, ...bounds, color: roomPalette[operation.roomType], wallIds: [], shape: "custom",
      }, normalized);
      project.rooms.push(room);
      rebuildCanonicalTopology(project);
      project.view.focusElementId = room.id;
      description = `${who} added polygonal ${room.name} · ${roomArea(room)} sq ft`;
      result = { room: project.rooms.find((item) => item.id === room.id), area: roomArea(room) };
      break;
    }
    case "move_room": {
      const index = project.rooms.findIndex((room) => room.id === operation.roomId);
      if (index < 0) throw new Error(`Room ${operation.roomId} does not exist.`);
      const previousRoom = project.rooms[index];
      const dx = round(operation.x) - previousRoom.x;
      const dy = round(operation.y) - previousRoom.y;
      const movedVertices = previousRoom.vertices?.map((point) => ({ x: round(point.x + dx), y: round(point.y + dy) }));
      const room = { ...previousRoom, x: round(operation.x), y: round(operation.y), vertices: movedVertices };
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
      const nextWidth = round(operation.width);
      const nextLength = round(operation.length);
      const resizedVertices = previousRoom.vertices?.map((point) => ({
        x: round(previousRoom.x + (point.x - previousRoom.x) * nextWidth / previousRoom.width),
        y: round(previousRoom.y + (point.y - previousRoom.y) * nextLength / previousRoom.length),
      }));
      const room = {
        ...previousRoom,
        width: nextWidth,
        length: nextLength,
        vertices: resizedVertices,
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
    case "update_room_vertices": {
      const index = project.rooms.findIndex((room) => room.id === operation.roomId);
      if (index < 0) throw new Error(`Room ${operation.roomId} does not exist.`);
      const normalized = normalizedRoomVertices(operation.vertices);
      assertRoomVertices(project, normalized);
      const previousRoom = project.rooms[index];
      const room = roomFromVertices(previousRoom, normalized);
      project.rooms[index] = room;
      rebuildCanonicalTopology(project);
      assertAllOpeningsValid(project);
      project.view.focusElementId = room.id;
      description = `${who} updated the polygon boundary of ${room.name}`;
      result = { room, area: roomArea(room), perimeter: roomPerimeter(room) };
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
          solarHeatGainCoefficient: operation.solarHeatGainCoefficient ?? operation.solarTransmittance ?? glazingPerformanceDefaults[operation.glazing ?? "clear"].solarHeatGainCoefficient,
          visibleTransmittance: operation.visibleTransmittance ?? glazingPerformanceDefaults[operation.glazing ?? "clear"].visibleTransmittance,
          uFactor: operation.uFactor ?? glazingPerformanceDefaults[operation.glazing ?? "clear"].uFactor,
        }),
      };
      assertOpeningPlacement(project, opening);
      assertWindowPerformance(opening);
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
        solarHeatGainCoefficient: operation.solarHeatGainCoefficient ?? operation.solarTransmittance ?? previous.solarHeatGainCoefficient,
        visibleTransmittance: operation.visibleTransmittance ?? previous.visibleTransmittance,
        uFactor: operation.uFactor ?? previous.uFactor,
        solarTransmittance: previous.solarTransmittance,
      };
      const length = wallLength(wall);
      assertOpeningPlacement(project, opening, opening.id);
      assertWindowPerformance(opening);
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
      if (!project.floors.some((floor) => floor.id === operation.floorId)) {
        throw new Error(`Floor ${operation.floorId} does not exist.`);
      }
      const stair: Stair = {
        id: createId("stair"),
        floorId: operation.floorId,
        x: round(operation.x),
        y: round(operation.y),
        width: round(operation.width),
        length: round(operation.length),
        direction: operation.direction ?? "up",
        rotation: operation.rotation ?? 0,
      };
      assertStairInsidePlot(project, stair);
      project.stairs.push(stair);
      project.view.focusElementId = stair.id;
      description = `${who} added a staircase`;
      result = { stair, connection: stairConnection(project, stair) ?? null };
      break;
    }
    case "update_stairs": {
      const index = project.stairs.findIndex((item) => item.id === operation.stairId);
      if (index < 0) throw new Error(`Stair ${operation.stairId} does not exist.`);
      const previous = project.stairs[index];
      const stair: Stair = {
        ...previous,
        x: round(operation.x ?? previous.x),
        y: round(operation.y ?? previous.y),
        width: round(operation.width ?? previous.width),
        length: round(operation.length ?? previous.length),
        direction: operation.direction ?? previous.direction,
        rotation: operation.rotation ?? previous.rotation,
      };
      assertStairInsidePlot(project, stair);
      project.stairs[index] = stair;
      project.view.focusElementId = stair.id;
      description = `${who} updated a staircase`;
      result = { stair, connection: stairConnection(project, stair) ?? null };
      break;
    }
    case "set_exterior_finish": {
      if (!exteriorFinishPresets[operation.finish]) throw new Error(`Exterior finish ${operation.finish} is not supported.`);
      project.exteriorFinish = operation.finish;
      const finish = exteriorFinishPresets[operation.finish];
      description = `${who} set the exterior finish to ${finish.label}`;
      result = { exteriorFinish: operation.finish, finish };
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
  const first = roomVertices(a);
  const second = roomVertices(b);
  const xs = Array.from(new Set([...first, ...second].map((point) => point.x))).sort((x, y) => x - y);
  let area = 0;
  for (let index = 0; index < xs.length - 1; index += 1) {
    const left = xs[index];
    const right = xs[index + 1];
    const firstIntervals = polygonIntervalsAtX(first, (left + right) / 2);
    const secondIntervals = polygonIntervalsAtX(second, (left + right) / 2);
    const overlapLength = firstIntervals.reduce((sum, [aStart, aEnd]) => sum + secondIntervals.reduce(
      (inner, [bStart, bEnd]) => inner + Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart)), 0,
    ), 0);
    area += (right - left) * overlapLength;
  }
  return { overlaps: area > 0.01, area: round(area) };
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
    const footprint = stairFootprint(stair);
    const point = { x: footprint.x + footprint.width / 2, y: footprint.y + footprint.length / 2 };
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
  const previousNode = new Map<string, { nodeId: string; edgeId: string }>();
  const queue = primaryEntryRoomId ? [primaryEntryRoomId] : [];
  while (queue.length) {
    const roomId = queue.shift()!;
    if (reachable.has(roomId)) continue;
    reachable.add(roomId);
    (adjacency.get(roomId) ?? []).forEach((next) => {
      if (!reachable.has(next) && !queue.includes(next)) {
        const edge = edges.find((item) => (item.from === roomId && item.to === next) || (item.to === roomId && item.from === next));
        if (edge) previousNode.set(next, { nodeId: roomId, edgeId: edge.openingId ?? edge.stairId ?? edge.id });
        queue.push(next);
      }
    });
  }
  const relevantRooms = project.rooms.filter((room) => room.type !== "Courtyard");
  const routesFromMainEntrance = relevantRooms.filter((room) => reachable.has(room.id)).map((room) => {
    const nodePath = [room.id];
    const elementPath: string[] = [];
    let cursor = room.id;
    while (previousNode.has(cursor)) {
      const previous = previousNode.get(cursor)!;
      nodePath.unshift(previous.nodeId);
      elementPath.unshift(previous.edgeId);
      cursor = previous.nodeId;
    }
    if (mainEntrance) elementPath.unshift(mainEntrance.opening.id);
    nodePath.unshift(exteriorId);
    return { roomId: room.id, roomName: room.name, nodePath, elementPath };
  });
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
    routesFromMainEntrance,
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
  project.stairs.filter((stair) => targetFloors.includes(stair.floorId)).forEach((stair) => {
    const connection = stairConnection(project, stair);
    if (!connection || stair.length + 0.01 >= connection.recommendedRun) return;
    issues.push({
      id: createId("issue"),
      code: "INVALID_STAIR_GEOMETRY",
      severity: "error",
      message: `The straight stair run is ${round(connection.recommendedRun - stair.length, 2)} ft too short for the current floor-to-floor rise.`,
      elementIds: [stair.id],
      evidence: {
        rise: connection.rise,
        riserCount: connection.riserCount,
        riserHeightInches: round(connection.riserHeight * 12, 2),
        treadDepthInches: round(connection.treadDepth * 12, 2),
        actualRun: stair.length,
        recommendedRun: connection.recommendedRun,
      },
      suggestion: `Extend the run to at least ${connection.recommendedRun} ft for this concept check, or develop a landing/turning stair outside this straight-flight model.`,
      possibleCorrection: "Resize the stair, then confirm landings, headroom, guards, and local code requirements separately.",
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
  const adjacentRoomIds = new Set(walls.flatMap((wall) => wall.roomIds).filter((roomId) => roomId !== room.id));
  const adjacentRooms = project.rooms.filter((other) => adjacentRoomIds.has(other.id)).map((other) => ({ id: other.id, name: other.name }));

  const circulation = buildCirculationGraph(project);
  return {
    room,
    netRoomArea: roomArea(room),
    area: roomArea(room),
    areaDefinition: "Usable internal room-polygon area, excluding wall thickness.",
    perimeter: roomPerimeter(room),
    vertices: roomVertices(room),
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
    exteriorFinish: wall.exterior ? { id: project.exteriorFinish, ...exteriorFinishPresets[project.exteriorFinish] } : null,
  };
}

export function inspectOpening(project: Project, openingId: string) {
  const opening = project.openings.find((item) => item.id === openingId);
  if (!opening) throw new Error(`Opening ${openingId} does not exist.`);
  const wall = project.walls.find((item) => item.id === opening.wallId);
  return {
    opening,
    hostWall: inspectWall(project, opening.wallId),
    facadeFacing: wall ? wallCardinalFacing(project, wall) ?? null : null,
    glazingPerformance: opening.kind === "window" ? {
      solarHeatGainCoefficient: opening.solarHeatGainCoefficient,
      visibleTransmittance: opening.visibleTransmittance,
      uFactor: opening.uFactor,
      status: "Concept input; verify against a rated product and project climate.",
    } : undefined,
  };
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
  if (room) return roomCentroid(room);
  const wall = project.walls.find((item) => item.id === ref.elementId);
  if (wall) {
    if (ref.anchor === "start") return { x: wall.x1, y: wall.y1 };
    if (ref.anchor === "end") return { x: wall.x2, y: wall.y2 };
    return { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 };
  }
  const stair = project.stairs.find((item) => item.id === ref.elementId);
  if (stair) {
    const footprint = stairFootprint(stair);
    return { x: footprint.x + footprint.width / 2, y: footprint.y + footprint.length / 2 };
  }
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
    exteriorFinish: { id: project.exteriorFinish, ...exteriorFinishPresets[project.exteriorFinish] },
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
