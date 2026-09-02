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
export type StairType = "straight" | "l-shaped" | "u-shaped";
export type StairTurnSide = "left" | "right";
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
  /** Optional exterior finish override. Interior walls ignore this value. */
  finish?: ExteriorFinishId;
  /** @deprecated Compatibility fields for pre-topology projects. */
  roomId?: string;
  /** @deprecated Compatibility fields for pre-topology projects. */
  side?: WallSide;
};

export type RailingStyle = "horizontal" | "vertical" | "solid";
export type FacadeFeatureKind = "frame" | "canopy" | "sunshade";

export type RoofSettings = {
  type: "flat";
  parapetEnabled: boolean;
  parapetHeight: number;
  parapetThickness: number;
  finish: ExteriorFinishId;
};

export type SiteBoundarySettings = {
  enabled: boolean;
  height: number;
  thickness: number;
  finish: ExteriorFinishId;
  gate: {
    enabled: boolean;
    offset: number;
    width: number;
    height: number;
    style: "slatted" | "solid";
  };
};

export type Balcony = {
  id: string;
  floorId: string;
  name: string;
  kind: "balcony" | "terrace";
  x: number;
  y: number;
  width: number;
  length: number;
  slabThickness: number;
  finish: ExteriorFinishId;
  railing: {
    enabled: boolean;
    height: number;
    style: RailingStyle;
    sides: WallSide[];
  };
};

export type FacadeFeature = {
  id: string;
  kind: FacadeFeatureKind;
  wallId: string;
  offset: number;
  width: number;
  elevation: number;
  height: number;
  projection: number;
  thickness: number;
  finish: ExteriorFinishId;
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
  /** Clear width of one flight. */
  width: number;
  /** Horizontal run of one flight. */
  length: number;
  /** Horizontal run of the upper flight of an L-shaped stair. Retained on other types for reversible conversion. */
  upperFlightLength: number;
  direction: "up" | "down";
  rotation: StairRotation;
  stairType: StairType;
  /** Clear landing dimension in the direction of the lower flight. */
  landingDepth: number;
  /** Clear gap between the parallel flights of a U-shaped stair. */
  wellWidth: number;
  /** Left/right quarter turn or half-turn return when ascending the lower flight. */
  turnSide: StairTurnSide;
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
  /** Riser height in inches — the unit architects actually read. */
  riserHeightInches: number;
  treadCount: number;
  treadDepth: number;
  /** Worst-case tread depth in inches. */
  treadDepthInches: number;
  treadDepths: number[];
  recommendedRun: number;
  recommendedRuns: number[];
  flightCount: 1 | 2;
  risersPerFlight: number[];
  treadsPerFlight: number[];
  landingElevation?: number;
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
  balconies: Balcony[];
  facadeFeatures: FacadeFeature[];
  roof: RoofSettings;
  siteBoundary: SiteBoundarySettings;
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
    | "STAIR_ACCESS_CLEARANCE"
    | "STAIR_WALL_CLASH"
    | "DOOR_BLOCKED_BY_STAIR"
    | "OPENING_WITHOUT_ADJACENCY"
    | "OPENING_OVERLAP"
    | "WALL_OUTSIDE_PLOT"
    | "ROOM_BELOW_HABITABLE_MINIMUM"
    | "ROOM_DAYLIGHT_SHORTFALL"
    | "ROOM_NO_VENTILATION"
    | "BEDROOM_NO_EGRESS"
    | "INVALID_BALCONY"
    | "INVALID_SITE_BOUNDARY"
    | "INVALID_FACADE_FEATURE";
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
  | { type: "set_plot"; width?: number; length?: number; orientation?: Plot["orientation"]; setbacks?: Partial<Plot["setbacks"]> }
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
      upperFlightLength?: number;
      direction?: "up" | "down";
      rotation?: StairRotation;
      stairType?: StairType;
      landingDepth?: number;
      wellWidth?: number;
      turnSide?: StairTurnSide;
    }
  | {
      type: "update_stairs";
      stairId: string;
      x?: number;
      y?: number;
      width?: number;
      length?: number;
      upperFlightLength?: number;
      direction?: "up" | "down";
      rotation?: StairRotation;
      stairType?: StairType;
      landingDepth?: number;
      wellWidth?: number;
      turnSide?: StairTurnSide;
    }
  | { type: "set_wall_finish"; wallId: string; finish?: ExteriorFinishId }
  | {
      type: "set_roof";
      parapetEnabled?: boolean;
      parapetHeight?: number;
      parapetThickness?: number;
      finish?: ExteriorFinishId;
    }
  | {
      type: "set_site_boundary";
      enabled?: boolean;
      height?: number;
      thickness?: number;
      finish?: ExteriorFinishId;
      gateEnabled?: boolean;
      gateOffset?: number;
      gateWidth?: number;
      gateHeight?: number;
      gateStyle?: SiteBoundarySettings["gate"]["style"];
    }
  | {
      type: "add_balcony";
      floorId: string;
      name?: string;
      kind?: Balcony["kind"];
      x: number;
      y: number;
      width: number;
      length: number;
      slabThickness?: number;
      finish?: ExteriorFinishId;
      railingEnabled?: boolean;
      railingHeight?: number;
      railingStyle?: RailingStyle;
      railingSides?: WallSide[];
    }
  | {
      type: "update_balcony";
      balconyId: string;
      name?: string;
      kind?: Balcony["kind"];
      x?: number;
      y?: number;
      width?: number;
      length?: number;
      slabThickness?: number;
      finish?: ExteriorFinishId;
      railingEnabled?: boolean;
      railingHeight?: number;
      railingStyle?: RailingStyle;
      railingSides?: WallSide[];
    }
  | { type: "delete_balcony"; balconyId: string }
  | {
      type: "add_facade_feature";
      kind: FacadeFeatureKind;
      wallId: string;
      offset: number;
      width: number;
      elevation?: number;
      height?: number;
      projection?: number;
      thickness?: number;
      finish?: ExteriorFinishId;
    }
  | {
      type: "update_facade_feature";
      featureId: string;
      kind?: FacadeFeatureKind;
      wallId?: string;
      offset?: number;
      width?: number;
      elevation?: number;
      height?: number;
      projection?: number;
      thickness?: number;
      finish?: ExteriorFinishId;
    }
  | { type: "delete_facade_feature"; featureId: string }
  | { type: "set_exterior_finish"; finish: ExteriorFinishId }
  | { type: "create_floor"; name?: string; height?: number }
  | { type: "set_floor_height"; floorId: string; height: number }
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
    schemaVersion: 7,
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
    balconies: [],
    facadeFeatures: [],
    roof: {
      type: "flat",
      parapetEnabled: true,
      parapetHeight: 3,
      parapetThickness: 0.5,
      finish: "stucco",
    },
    siteBoundary: {
      enabled: false,
      height: 4,
      thickness: 0.5,
      finish: "stucco",
      gate: { enabled: true, offset: 15, width: 10, height: 5, style: "slatted" },
    },
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
        description: "Editable 30 × 60 ft residential site created",
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

/**
 * A point guaranteed to lie inside the room, used for labels, camera focus, walk-mode spawn,
 * and element anchors. The true area centroid of a U- or C-shaped polygon can fall in its
 * notch, so concave rooms fall back to the centre of their largest interior band.
 */
export function roomInteriorPoint(room: Room): PlanPoint {
  const centroid = roomCentroid(room);
  if (roomContainsPoint(room, centroid)) return centroid;
  const vertices = roomVertices(room);
  const xs = Array.from(new Set(vertices.map((point) => point.x))).sort((a, b) => a - b);
  let best: { point: PlanPoint; area: number } | undefined;
  for (let index = 0; index < xs.length - 1; index += 1) {
    const width = xs[index + 1] - xs[index];
    if (width <= 0.001) continue;
    const midX = (xs[index] + xs[index + 1]) / 2;
    for (const [top, bottom] of polygonIntervalsAtX(vertices, midX)) {
      const area = width * (bottom - top);
      if (!best || area > best.area) best = { point: { x: midX, y: (top + bottom) / 2 }, area };
    }
  }
  return best?.point ?? centroid;
}

/**
 * Finished floor area measured to the inside face of the bounding walls. Exact for orthogonal
 * rooms of uniform wall thickness: each convex corner adds t²/4 and each reflex corner removes it.
 */
export function roomCarpetArea(project: Project, room: Room) {
  const thicknesses = project.walls
    .filter((wall) => wall.roomIds.includes(room.id))
    .map((wall) => wall.thickness);
  const thickness = thicknesses.length
    ? thicknesses.reduce((sum, value) => sum + value, 0) / thicknesses.length
    : 0.5;
  const vertices = normalizedRoomVertices(roomVertices(room));
  let convex = 0;
  let reflex = 0;
  vertices.forEach((point, index) => {
    const previous = vertices[(index + vertices.length - 1) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const cross = (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x);
    if (cross > 0) convex += 1;
    else if (cross < 0) reflex += 1;
  });
  const inset = roomArea(room)
    - roomPerimeter(room) * thickness / 2
    + (convex - reflex) * thickness * thickness / 4;
  return round(Math.max(0, inset));
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

type StairGeometry = Pick<Stair, "x" | "y" | "width" | "length" | "upperFlightLength" | "rotation" | "stairType" | "landingDepth" | "wellWidth" | "turnSide">;

export type StairLocalPoint = { u: number; v: number };

export type StairFlightLayout = {
  id: "single" | "lower" | "upper";
  /** Ascending centerline start and end, in unrotated stair-local coordinates. */
  start: StairLocalPoint;
  end: StairLocalPoint;
  width: number;
  length: number;
  progressStart: number;
  progressEnd: number;
};

export type StairLayout = {
  localWidth: number;
  localLength: number;
  flights: StairFlightLayout[];
  /** True stairwell outline. L-shaped stairs use an L-shaped polygon rather than a bounding rectangle. */
  outline: StairLocalPoint[];
  landing?: { vertices: StairLocalPoint[]; progress: number };
  /** Continuous centerline route, including level travel across an intermediate landing. */
  route: Array<StairLocalPoint & { progress: number }>;
  lowerEntry: StairLocalPoint & { outwardU: number; outwardV: number };
  upperEntry: StairLocalPoint & { outwardU: number; outwardV: number };
};

function compactStairPolygon(points: StairLocalPoint[]) {
  return points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    return Math.abs(point.u - previous.u) > 0.001 || Math.abs(point.v - previous.v) > 0.001;
  });
}

function stairFlightPoint(flight: StairFlightLayout, along: number, lateral = 0): StairLocalPoint {
  const du = (flight.end.u - flight.start.u) / flight.length;
  const dv = (flight.end.v - flight.start.v) / flight.length;
  return {
    u: flight.start.u + du * along - dv * lateral,
    v: flight.start.v + dv * along + du * lateral,
  };
}

export function stairFlightCorners(flight: StairFlightLayout) {
  return [
    stairFlightPoint(flight, 0, -flight.width / 2),
    stairFlightPoint(flight, flight.length, -flight.width / 2),
    stairFlightPoint(flight, flight.length, flight.width / 2),
    stairFlightPoint(flight, 0, flight.width / 2),
  ];
}

export function stairLayout(stair: StairGeometry): StairLayout {
  if (stair.stairType === "straight") {
    const flight: StairFlightLayout = {
      id: "single",
      start: { u: stair.width / 2, v: stair.length },
      end: { u: stair.width / 2, v: 0 },
      width: stair.width,
      length: stair.length,
      progressStart: 0,
      progressEnd: 1,
    };
    return {
      localWidth: stair.width,
      localLength: stair.length,
      flights: [flight],
      outline: [{ u: 0, v: 0 }, { u: stair.width, v: 0 }, { u: stair.width, v: stair.length }, { u: 0, v: stair.length }],
      route: [{ ...flight.start, progress: 0 }, { ...flight.end, progress: 1 }],
      lowerEntry: { ...flight.start, outwardU: 0, outwardV: 1 },
      upperEntry: { ...flight.end, outwardU: 0, outwardV: -1 },
    };
  }

  if (stair.stairType === "l-shaped") {
    const landing = Math.max(stair.width, stair.landingDepth);
    const lowerU = stair.turnSide === "left" ? stair.upperFlightLength + landing - stair.width / 2 : stair.width / 2;
    const upperStartU = stair.turnSide === "left" ? stair.upperFlightLength : landing;
    const upperEndU = stair.turnSide === "left" ? 0 : landing + stair.upperFlightLength;
    const lower: StairFlightLayout = {
      id: "lower",
      start: { u: lowerU, v: landing + stair.length },
      end: { u: lowerU, v: landing },
      width: stair.width,
      length: stair.length,
      progressStart: 0,
      progressEnd: 0.5,
    };
    const upper: StairFlightLayout = {
      id: "upper",
      start: { u: upperStartU, v: stair.width / 2 },
      end: { u: upperEndU, v: stair.width / 2 },
      width: stair.width,
      length: stair.upperFlightLength,
      progressStart: 0.5,
      progressEnd: 1,
    };
    const landingU = stair.turnSide === "left" ? stair.upperFlightLength : 0;
    const landingCenter = { u: landingU + landing / 2, v: landing / 2 };
    const outline = stair.turnSide === "left"
      ? [
          { u: 0, v: 0 }, { u: stair.upperFlightLength + landing, v: 0 },
          { u: stair.upperFlightLength + landing, v: landing + stair.length },
          { u: stair.upperFlightLength + landing - stair.width, v: landing + stair.length },
          { u: stair.upperFlightLength + landing - stair.width, v: landing },
          { u: stair.upperFlightLength, v: landing }, { u: stair.upperFlightLength, v: stair.width },
          { u: 0, v: stair.width },
        ]
      : [
          { u: 0, v: 0 }, { u: landing + stair.upperFlightLength, v: 0 },
          { u: landing + stair.upperFlightLength, v: stair.width }, { u: landing, v: stair.width },
          { u: landing, v: landing }, { u: stair.width, v: landing },
          { u: stair.width, v: landing + stair.length }, { u: 0, v: landing + stair.length },
        ];
    return {
      localWidth: stair.upperFlightLength + landing,
      localLength: stair.length + landing,
      flights: [lower, upper],
      outline: compactStairPolygon(outline),
      landing: {
        vertices: [
          { u: landingU, v: 0 }, { u: landingU + landing, v: 0 },
          { u: landingU + landing, v: landing }, { u: landingU, v: landing },
        ],
        progress: 0.5,
      },
      route: [
        { ...lower.start, progress: 0 }, { ...lower.end, progress: 0.5 },
        { ...landingCenter, progress: 0.5 }, { ...upper.start, progress: 0.5 }, { ...upper.end, progress: 1 },
      ],
      lowerEntry: { ...lower.start, outwardU: 0, outwardV: 1 },
      upperEntry: {
        ...upper.end,
        outwardU: stair.turnSide === "left" ? -1 : 1,
        outwardV: 0,
      },
    };
  }

  const localWidth = stair.width * 2 + stair.wellWidth;
  const localLength = stair.length + stair.landingDepth;
  const lowerU = stair.turnSide === "right" ? 0 : stair.width + stair.wellWidth;
  const upperU = stair.turnSide === "right" ? stair.width + stair.wellWidth : 0;
  const lower: StairFlightLayout = {
    id: "lower",
    start: { u: lowerU + stair.width / 2, v: localLength },
    end: { u: lowerU + stair.width / 2, v: stair.landingDepth },
    width: stair.width,
    length: stair.length,
    progressStart: 0,
    progressEnd: 0.5,
  };
  const upper: StairFlightLayout = {
    id: "upper",
    start: { u: upperU + stair.width / 2, v: stair.landingDepth },
    end: { u: upperU + stair.width / 2, v: localLength },
    width: stair.width,
    length: stair.length,
    progressStart: 0.5,
    progressEnd: 1,
  };
  return {
    localWidth,
    localLength,
    flights: [lower, upper],
    outline: [{ u: 0, v: 0 }, { u: localWidth, v: 0 }, { u: localWidth, v: localLength }, { u: 0, v: localLength }],
    landing: {
      vertices: [{ u: 0, v: 0 }, { u: localWidth, v: 0 }, { u: localWidth, v: stair.landingDepth }, { u: 0, v: stair.landingDepth }],
      progress: 0.5,
    },
    route: [
      { ...lower.start, progress: 0 }, { ...lower.end, progress: 0.5 },
      { u: lower.start.u, v: stair.landingDepth / 2, progress: 0.5 },
      { u: upper.start.u, v: stair.landingDepth / 2, progress: 0.5 },
      { ...upper.start, progress: 0.5 }, { ...upper.end, progress: 1 },
    ],
    lowerEntry: { ...lower.start, outwardU: 0, outwardV: 1 },
    upperEntry: { ...upper.end, outwardU: 0, outwardV: 1 },
  };
}

export function stairFootprint(stair: StairGeometry) {
  const layout = stairLayout(stair);
  const rotated = stair.rotation === 90 || stair.rotation === 270;
  return { x: stair.x, y: stair.y, width: rotated ? layout.localLength : layout.localWidth, length: rotated ? layout.localWidth : layout.localLength };
}

export function stairPlanOutline(stair: StairGeometry) {
  return stairLayout(stair).outline.map((point) => stairPlanPoint(stair, point.u, point.v));
}

export function stairPlanFlightCorners(stair: StairGeometry, flight: StairFlightLayout) {
  return stairFlightCorners(flight).map((point) => stairPlanPoint(stair, point.u, point.v));
}

/** Maps stair-local coordinates into plan coordinates. */
export function stairPlanPoint(stair: StairGeometry, u: number, v: number): PlanPoint {
  const layout = stairLayout(stair);
  if (stair.rotation === 90) return { x: stair.x + v, y: stair.y + layout.localWidth - u };
  if (stair.rotation === 180) return { x: stair.x + layout.localWidth - u, y: stair.y + layout.localLength - v };
  if (stair.rotation === 270) return { x: stair.x + layout.localLength - v, y: stair.y + u };
  return { x: stair.x + u, y: stair.y + v };
}

export function stairLocalPoint(stair: StairGeometry, point: PlanPoint) {
  const layout = stairLayout(stair);
  if (stair.rotation === 90) return { u: stair.y + layout.localWidth - point.y, v: point.x - stair.x };
  if (stair.rotation === 180) return { u: stair.x + layout.localWidth - point.x, v: stair.y + layout.localLength - point.y };
  if (stair.rotation === 270) return { u: point.y - stair.y, v: stair.x + layout.localLength - point.x };
  return { u: point.x - stair.x, v: point.y - stair.y };
}

function localPolygonContains(vertices: StairLocalPoint[], point: StairLocalPoint) {
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
    const a = vertices[index];
    const b = vertices[previous];
    const onEdge = Math.abs((point.v - a.v) * (b.u - a.u) - (point.u - a.u) * (b.v - a.v)) < 0.001
      && point.u >= Math.min(a.u, b.u) - 0.001 && point.u <= Math.max(a.u, b.u) + 0.001
      && point.v >= Math.min(a.v, b.v) - 0.001 && point.v <= Math.max(a.v, b.v) + 0.001;
    if (onEdge) return true;
    if ((a.v > point.v) !== (b.v > point.v) && point.u < (b.u - a.u) * (point.v - a.v) / (b.v - a.v) + a.u) inside = !inside;
  }
  return inside;
}

/** Returns vertical progress only on a walkable flight or landing; wells and L-shaped inner voids are excluded. */
export function stairProgressAt(stair: StairGeometry, point: PlanPoint) {
  const local = stairLocalPoint(stair, point);
  const layout = stairLayout(stair);
  if (layout.landing && localPolygonContains(layout.landing.vertices, local)) return layout.landing.progress;
  for (const flight of layout.flights) {
    const du = (flight.end.u - flight.start.u) / flight.length;
    const dv = (flight.end.v - flight.start.v) / flight.length;
    const deltaU = local.u - flight.start.u;
    const deltaV = local.v - flight.start.v;
    const along = deltaU * du + deltaV * dv;
    const lateral = -deltaU * dv + deltaV * du;
    if (along < -0.001 || along > flight.length + 0.001 || Math.abs(lateral) > flight.width / 2 + 0.001) continue;
    return Math.max(0, Math.min(1, flight.progressStart + along / flight.length * (flight.progressEnd - flight.progressStart)));
  }
  return undefined;
}

export function stairEntryPoint(stair: StairGeometry, level: "lower" | "upper", clearance = 0) {
  const layout = stairLayout(stair);
  const entry = level === "lower" ? layout.lowerEntry : layout.upperEntry;
  return stairPlanPoint(stair, entry.u + entry.outwardU * clearance, entry.v + entry.outwardV * clearance);
}

/** Clear floor area required immediately outside the lower or upper stair entry. */
export function stairAccessPolygon(stair: StairGeometry, level: "lower" | "upper", depth = stair.width) {
  const layout = stairLayout(stair);
  const entry = level === "lower" ? layout.lowerEntry : layout.upperEntry;
  const crossU = -entry.outwardV;
  const crossV = entry.outwardU;
  return [
    stairPlanPoint(stair, entry.u - crossU * stair.width / 2, entry.v - crossV * stair.width / 2),
    stairPlanPoint(stair, entry.u + crossU * stair.width / 2, entry.v + crossV * stair.width / 2),
    stairPlanPoint(stair, entry.u + crossU * stair.width / 2 + entry.outwardU * depth, entry.v + crossV * stair.width / 2 + entry.outwardV * depth),
    stairPlanPoint(stair, entry.u - crossU * stair.width / 2 + entry.outwardU * depth, entry.v - crossV * stair.width / 2 + entry.outwardV * depth),
  ];
}

export function wallLength(wall: Wall) {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

const CONCEPT_MAX_RISER = 7.75 / 12;
const CONCEPT_MIN_TREAD = 10 / 12;

/**
 * Early-design habitability thresholds. These follow widely used residential concepts comparable to
 * the 2021 IRC (R303 light and ventilation, R304 minimum room areas, R310 emergency escape openings).
 * They are design guidance with stated assumptions, never a code-compliance determination.
 */
const HABITABLE_ROOM_TYPES: RoomType[] = ["Living Room", "Kitchen", "Bedroom", "Dining Room", "Office"];
const DAYLIGHT_GLAZING_RATIO = 0.08;
const VENTILATION_OPENABLE_RATIO = 0.04;
const HABITABLE_MIN_AREA = 70;
const HABITABLE_MIN_DIMENSION = 7;
const EGRESS_MIN_CLEAR_AREA = 5.7;
const EGRESS_MAX_SILL = 44 / 12;
const EGRESS_MIN_CLEAR_WIDTH = 20 / 12;
const EGRESS_MIN_CLEAR_HEIGHT = 24 / 12;
/** Share of a window's area that actually opens, by operating type. */
const WINDOW_OPENABLE_FRACTION: Record<WindowType, number> = { fixed: 0, casement: 0.9, sliding: 0.5, awning: 0.6 };

/** Walls that can admit daylight and air: exterior walls, plus walls facing an open courtyard. */
function daylightWallIds(project: Project, room: Room) {
  return new Set(
    project.walls
      .filter((wall) => wall.roomIds.includes(room.id))
      .filter((wall) => wall.exterior || wall.roomIds.some((id) => id !== room.id
        && project.rooms.find((item) => item.id === id)?.type === "Courtyard"))
      .map((wall) => wall.id),
  );
}

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
  let riserCount = Math.max(1, Math.ceil(rise / CONCEPT_MAX_RISER));
  if (stair.stairType !== "straight" && riserCount % 2) riserCount += 1;
  const flightCount = stair.stairType === "straight" ? 1 : 2;
  const risersPerFlight = flightCount === 2 ? [riserCount / 2, riserCount / 2] : [riserCount];
  const treadsPerFlight = risersPerFlight.map((count) => Math.max(1, count - 1));
  const treadCount = treadsPerFlight.reduce((total, count) => total + count, 0);
  const runs = stair.stairType === "l-shaped" ? [stair.length, stair.upperFlightLength] : treadsPerFlight.map(() => stair.length);
  const treadDepths = treadsPerFlight.map((count, index) => round(runs[index] / count, 3));
  const recommendedRuns = treadsPerFlight.map((count) => Math.ceil(count * CONCEPT_MIN_TREAD * 2) / 2);
  return {
    stair,
    sourceFloor,
    targetFloor,
    lowerFloor,
    upperFloor,
    rise: round(rise, 3),
    riserCount,
    riserHeight: round(rise / riserCount, 3),
    riserHeightInches: round((rise / riserCount) * 12, 2),
    treadCount,
    treadDepth: Math.min(...treadDepths),
    treadDepthInches: round(Math.min(...treadDepths) * 12, 2),
    treadDepths,
    recommendedRun: Math.max(...recommendedRuns),
    recommendedRuns,
    flightCount,
    risersPerFlight,
    treadsPerFlight,
    landingElevation: flightCount === 2 ? round(lowerFloor.elevation + rise / 2, 3) : undefined,
  };
}

export function recommendedStairRun(
  project: Project,
  floorId: string,
  direction: "up" | "down",
  stairType: StairType = "straight",
) {
  const placeholder: Stair = { id: "stair-preview", floorId, x: 0, y: 0, width: 3.5, length: 6, upperFlightLength: 6, direction, rotation: 0, stairType, landingDepth: 3.5, wellWidth: 0.5, turnSide: "left" };
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
  if (wall.roomIds.length > 2) {
    throw new Error(`The ${opening.kind} cannot be hosted by a wall shared by more than two rooms.`);
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
  const balconyArea = round(project.balconies
    .filter((balcony) => balcony.floorId === floorId && balcony.kind === "balcony")
    .reduce((sum, balcony) => sum + balcony.width * balcony.length, 0));
  const terraceArea = round(project.balconies
    .filter((balcony) => balcony.floorId === floorId && balcony.kind === "terrace")
    .reduce((sum, balcony) => sum + balcony.width * balcony.length, 0));
  const projectBalconyArea = round(project.balconies
    .filter((balcony) => balcony.kind === "balcony")
    .reduce((sum, balcony) => sum + balcony.width * balcony.length, 0));
  const projectTerraceArea = round(project.balconies
    .filter((balcony) => balcony.kind === "terrace")
    .reduce((sum, balcony) => sum + balcony.width * balcony.length, 0));
  const carpetArea = round(project.rooms
    .filter((room) => room.floorId === floorId && room.type !== "Courtyard")
    .reduce((sum, room) => sum + roomCarpetArea(project, room), 0));
  const totalCarpetArea = round(project.rooms
    .filter((room) => room.type !== "Courtyard")
    .reduce((sum, room) => sum + roomCarpetArea(project, room), 0));
  // Ground coverage and open site area are ground-floor ratios by definition; they must not change
  // with the floor the user happens to be viewing.
  const groundCoveragePercent = plotArea ? round((groundGrossArea / plotArea) * 100, 1) : 0;
  const openSiteArea = round(Math.max(0, plotArea - groundGrossArea));

  return {
    unit: "sq ft",
    plotArea,
    netRoomAreaTotal: roomAreaSum,
    totalNetFloorArea: roomAreaSum,
    totalNetBuildingArea,
    grossCoveredArea,
    carpetArea,
    totalCarpetArea,
    balconyArea,
    terraceArea,
    projectBalconyArea,
    projectTerraceArea,
    totalGrossCoveredArea,
    openSiteArea,
    groundCoveragePercent,
    floorAreaRatio: plotArea ? round(totalGrossCoveredArea / plotArea, 3) : 0,
    measurementDefinitions: {
      netRoomArea: "Room-polygon area measured to wall centrelines. This is not finished carpet area — see carpetArea.",
      carpetArea: "Finished floor area inside the bounding walls on the selected floor, excluding courtyards.",
      totalNetFloorArea: "Sum of centreline room areas on the selected floor, excluding courtyards.",
      grossCoveredArea: "Built-up area on the selected floor, measured to the outer face of the external walls.",
      openSiteArea: "Plot area remaining outside the gross ground-floor building footprint.",
      groundCoveragePercent: "Gross ground-floor footprint as a percentage of plot area. Always a ground-floor ratio.",
      floorAreaRatio: "Total gross covered area of all floors divided by plot area (FAR / FSI).",
      balconyArea: "Balcony slabs on the selected floor only; projectBalconyArea covers every floor.",
    },
    // Compatibility aliases retained so existing clients are not silently broken.
    floorCoveredArea: floorArea,
    totalConstructedArea,
    roomAreaSum,
    openArea: openSiteArea,
    coveragePercent: groundCoveragePercent,
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
  facadeFeatureTargets: Map<string, { x: number; y: number }> = new Map(),
) {
  const oldWalls = project.walls.map((wall) => ({ ...wall }));
  const oldFacadeFeatures = (project.facadeFeatures ?? []).map((feature) => ({ ...feature }));
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
      const id = canonicalWallId({ ...reference, start, end });
      topologyWalls.push({
        id,
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
        finish: oldWallById.get(id)?.finish,
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
      if (strict) throw new Error(`The ${opening.kind} ${opening.id} no longer fits a valid host wall.`);
      continue;
    }
    migratedOpenings.push({ ...opening, wallId: candidate.wall.id, offset: round(candidate.placement.offset) });
  }
  project.openings = migratedOpenings;
  const migratedFeatures: FacadeFeature[] = [];
  for (const feature of oldFacadeFeatures) {
    const oldWall = oldWallById.get(feature.wallId);
    if (!oldWall) {
      if (strict) throw new Error(`Façade feature ${feature.id} has no host wall.`);
      continue;
    }
    const length = wallLength(oldWall);
    const ratio = length ? feature.offset / length : 0;
    const target = facadeFeatureTargets.get(feature.id) ?? {
      x: oldWall.x1 + (oldWall.x2 - oldWall.x1) * ratio,
      y: oldWall.y1 + (oldWall.y2 - oldWall.y1) * ratio,
    };
    const candidate = project.walls
      .filter((wall) => wall.floorId === oldWall.floorId && wall.exterior)
      .map((wall) => ({ wall, placement: pointOnWall(wall, target) }))
      .filter((item): item is { wall: Wall; placement: { offset: number; distance: number } } => Boolean(item.placement))
      .filter(({ wall, placement }) => placement.distance < 0.05 && placement.offset >= feature.width / 2 - 0.01 && placement.offset <= wallLength(wall) - feature.width / 2 + 0.01)
      .sort((a, b) => a.placement.distance - b.placement.distance)[0];
    if (!candidate) {
      if (strict) throw new Error(`Façade feature ${feature.id} no longer fits a valid exterior wall.`);
      continue;
    }
    migratedFeatures.push({ ...feature, wallId: candidate.wall.id, offset: round(candidate.placement.offset) });
  }
  project.facadeFeatures = migratedFeatures;
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

function roomFacadeFeatureTargets(project: Project, room: Room, nextRoom: Room) {
  const targets = new Map<string, { x: number; y: number }>();
  project.facadeFeatures.forEach((feature) => {
    const wall = project.walls.find((item) => item.id === feature.wallId);
    if (!wall || wall.roomIds.length !== 1 || wall.roomIds[0] !== room.id) return;
    const length = wallLength(wall);
    const ratio = length ? feature.offset / length : 0;
    const center = { x: wall.x1 + (wall.x2 - wall.x1) * ratio, y: wall.y1 + (wall.y2 - wall.y1) * ratio };
    targets.set(feature.id, {
      x: nextRoom.x + (center.x - room.x) / room.width * nextRoom.width,
      y: nextRoom.y + (center.y - room.y) / room.length * nextRoom.length,
    });
  });
  return targets;
}

function roomWallFinishes(project: Project, roomId: string) {
  return new Map(project.walls
    .filter((wall) => wall.exterior && wall.finish && wall.roomIds.includes(roomId))
    .flatMap((wall) => wall.roomSides.filter((side) => side.roomId === roomId).map((side) => [side.side, wall.finish!] as const)));
}

function restoreRoomWallFinishes(project: Project, roomId: string, finishes: Map<WallSide, ExteriorFinishId>) {
  project.walls = project.walls.map((wall) => {
    const side = wall.exterior ? wall.roomSides.find((item) => item.roomId === roomId)?.side : undefined;
    return side && finishes.has(side) ? { ...wall, finish: finishes.get(side) } : wall;
  });
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
  project.schemaVersion = 7;
  project.exteriorFinish = exteriorFinishPresets[project.exteriorFinish] ? project.exteriorFinish : "stucco";
  project.roof = {
    type: "flat",
    parapetEnabled: project.roof?.parapetEnabled ?? true,
    parapetHeight: project.roof?.parapetHeight ?? 3,
    parapetThickness: project.roof?.parapetThickness ?? 0.5,
    finish: exteriorFinishPresets[project.roof?.finish] ? project.roof.finish : project.exteriorFinish,
  };
  project.siteBoundary = {
    enabled: project.siteBoundary?.enabled ?? false,
    height: project.siteBoundary?.height ?? 4,
    thickness: project.siteBoundary?.thickness ?? 0.5,
    finish: exteriorFinishPresets[project.siteBoundary?.finish] ? project.siteBoundary.finish : project.exteriorFinish,
    gate: {
      enabled: project.siteBoundary?.gate?.enabled ?? true,
      offset: project.siteBoundary?.gate?.offset ?? project.plot.width / 2,
      width: project.siteBoundary?.gate?.width ?? Math.min(10, project.plot.width - 2),
      height: project.siteBoundary?.gate?.height ?? 5,
      style: project.siteBoundary?.gate?.style === "solid" ? "solid" : "slatted",
    },
  };
  project.balconies = (project.balconies ?? []).map((balcony) => ({
    ...balcony,
    kind: balcony.kind ?? "balcony",
    name: balcony.name?.trim() || (balcony.kind === "terrace" ? "Terrace" : "Balcony"),
    slabThickness: balcony.slabThickness ?? 0.5,
    finish: exteriorFinishPresets[balcony.finish] ? balcony.finish : project.exteriorFinish,
    railing: {
      enabled: balcony.railing?.enabled ?? true,
      height: balcony.railing?.height ?? 3.5,
      style: balcony.railing?.style ?? "horizontal",
      sides: balcony.railing?.sides?.length ? balcony.railing.sides : ["north", "east", "south", "west"],
    },
  }));
  project.facadeFeatures = (project.facadeFeatures ?? []).map((feature) => ({
    ...feature,
    elevation: feature.elevation ?? 7,
    height: feature.height ?? (feature.kind === "frame" ? 8 : 0.5),
    projection: feature.projection ?? (feature.kind === "frame" ? 0.5 : 3),
    thickness: feature.thickness ?? 0.4,
    finish: exteriorFinishPresets[feature.finish] ? feature.finish : project.exteriorFinish,
  }));
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
    finish: wall.finish && exteriorFinishPresets[wall.finish] ? wall.finish : undefined,
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
  project.stairs = (project.stairs ?? []).map((stair) => ({
    ...stair,
    rotation: stair.rotation ?? 0,
    stairType: stair.stairType === "u-shaped" || stair.stairType === "l-shaped" ? stair.stairType : "straight",
    upperFlightLength: stair.upperFlightLength ?? stair.length ?? 6,
    landingDepth: stair.landingDepth ?? stair.width ?? 3.5,
    wellWidth: stair.wellWidth ?? 0.5,
    turnSide: stair.turnSide === "right" ? "right" : "left",
  }));
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

/**
 * Near-miss tolerance for latching new geometry onto existing edges. Two rooms meant to share a wall
 * but drawn 0.1 ft apart otherwise produce two separate exterior walls with a sliver between them,
 * which is what makes a plan look "not connected" in 2D and doubled in 3D.
 */
export const ALIGNMENT_TOLERANCE = 0.25;

/** Coordinates that new or edited geometry on a floor should latch onto. */
function alignmentGuides(project: Project, floorId: string, ignoreRoomId?: string) {
  const xs = new Set<number>([0, project.plot.width, project.plot.setbacks.left, round(project.plot.width - project.plot.setbacks.right)]);
  const ys = new Set<number>([0, project.plot.length, project.plot.setbacks.front, round(project.plot.length - project.plot.setbacks.rear)]);
  project.rooms
    .filter((room) => room.floorId === floorId && room.id !== ignoreRoomId)
    .forEach((room) => roomVertices(room).forEach((point) => { xs.add(point.x); ys.add(point.y); }));
  project.walls
    .filter((wall) => wall.floorId === floorId && !wall.roomIds.length)
    .forEach((wall) => { xs.add(wall.x1); xs.add(wall.x2); ys.add(wall.y1); ys.add(wall.y2); });
  project.stairs
    .filter((stair) => stair.floorId === floorId)
    .forEach((stair) => {
      const footprint = stairFootprint(stair);
      xs.add(footprint.x); xs.add(round(footprint.x + footprint.width));
      ys.add(footprint.y); ys.add(round(footprint.y + footprint.length));
    });
  return { xs: Array.from(xs), ys: Array.from(ys) };
}

function nearestGuide(value: number, guides: number[], tolerance = ALIGNMENT_TOLERANCE) {
  let best = value;
  let bestDistance = tolerance;
  for (const guide of guides) {
    const distance = Math.abs(guide - value);
    if (distance < bestDistance || (distance === bestDistance && guide !== value && best === value)) {
      bestDistance = distance;
      best = guide;
    }
  }
  return best;
}

/** Snap every distinct edge coordinate onto nearby existing geometry so rooms tile cleanly. */
export function alignVertices(project: Project, floorId: string, vertices: PlanPoint[], ignoreRoomId?: string) {
  const { xs, ys } = alignmentGuides(project, floorId, ignoreRoomId);
  const xMap = new Map<number, number>();
  const yMap = new Map<number, number>();
  vertices.forEach((point) => {
    if (!xMap.has(point.x)) xMap.set(point.x, round(nearestGuide(point.x, xs)));
    if (!yMap.has(point.y)) yMap.set(point.y, round(nearestGuide(point.y, ys)));
  });
  return vertices.map((point) => ({ x: xMap.get(point.x)!, y: yMap.get(point.y)! }));
}

/** The single translation that latches a moved room onto nearby geometry without resizing it. */
function alignTranslation(project: Project, floorId: string, vertices: PlanPoint[], ignoreRoomId?: string) {
  const { xs, ys } = alignmentGuides(project, floorId, ignoreRoomId);
  const pick = (values: number[], guides: number[]) => {
    let shift = 0;
    let bestDistance = ALIGNMENT_TOLERANCE;
    for (const value of values) {
      const guide = nearestGuide(value, guides);
      const distance = Math.abs(guide - value);
      if (guide !== value && distance < bestDistance) { bestDistance = distance; shift = round(guide - value); }
    }
    return shift;
  };
  return {
    dx: pick(Array.from(new Set(vertices.map((point) => point.x))), xs),
    dy: pick(Array.from(new Set(vertices.map((point) => point.y))), ys),
  };
}

/** Rooms may touch but never overlap. Prevented at the operation, not merely reported afterwards. */
function assertNoRoomOverlap(project: Project, candidate: Room, ignoreRoomId?: string) {
  for (const other of project.rooms) {
    if (other.id === ignoreRoomId || other.id === candidate.id || other.floorId !== candidate.floorId) continue;
    const overlap = rectanglesOverlap(candidate, other);
    if (overlap.overlaps) {
      throw new Error(`${candidate.name} would overlap ${other.name} by ${overlap.area} sq ft. Rooms may share a wall but cannot occupy the same floor area.`);
    }
  }
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

function assertStairInsidePlot(project: Project, stair: Stair) {
  if (stair.width < 3) throw new Error("Stair flights must be at least 3 ft wide.");
  if (stair.stairType === "straight" && stair.length < 6) throw new Error("Straight stairs must have at least a 6 ft run.");
  if (stair.stairType === "l-shaped") {
    if (stair.length < 3 || stair.upperFlightLength < 3) throw new Error("L-shaped stair flights must each have at least a 3 ft run.");
    if (stair.landingDepth < stair.width) throw new Error("An L-shaped stair landing must be at least as deep and wide as the clear flight width.");
  }
  if (stair.stairType === "u-shaped") {
    if (stair.length < 3) throw new Error("U-shaped stair flights must have at least a 3 ft run.");
    if (stair.landingDepth < stair.width) throw new Error("A U-shaped stair landing must be at least as deep as its clear flight width.");
    if (stair.wellWidth < 0 || stair.wellWidth > 8) throw new Error("The U-shaped stair center well must be between 0 and 8 ft wide.");
  }
  const footprint = stairFootprint(stair);
  if (
    footprint.x < 0 || footprint.y < 0 ||
    footprint.x + footprint.width > project.plot.width ||
    footprint.y + footprint.length > project.plot.length
  ) throw new Error("The staircase must remain inside the plot.");
}

function assertFinish(finish: ExteriorFinishId) {
  if (!exteriorFinishPresets[finish]) throw new Error(`Exterior finish ${finish} is not supported.`);
}

function assertBalcony(project: Project, balcony: Balcony) {
  if (!project.floors.some((floor) => floor.id === balcony.floorId)) throw new Error(`Floor ${balcony.floorId} does not exist.`);
  if (balcony.width < 3 || balcony.length < 3) throw new Error("Balconies and terraces must be at least 3 × 3 ft.");
  if (balcony.slabThickness < 0.25 || balcony.slabThickness > 2) throw new Error("Balcony slab thickness must be between 0.25 and 2 ft.");
  if (balcony.x < 0 || balcony.y < 0 || balcony.x + balcony.width > project.plot.width || balcony.y + balcony.length > project.plot.length) {
    throw new Error("The balcony or terrace must remain inside the plot boundary.");
  }
  if (balcony.railing.height < 2 || balcony.railing.height > 6) throw new Error("Railing height must be between 2 and 6 ft.");
  if (!balcony.railing.sides.length) throw new Error("Select at least one railing side.");
  assertFinish(balcony.finish);
}

function assertSiteBoundary(project: Project, boundary: SiteBoundarySettings) {
  if (boundary.height < 2 || boundary.height > 10) throw new Error("Boundary-wall height must be between 2 and 10 ft.");
  if (boundary.thickness < 0.2 || boundary.thickness > 2) throw new Error("Boundary-wall thickness must be between 0.2 and 2 ft.");
  if (boundary.enabled && boundary.gate.enabled) {
    if (boundary.gate.width < 3 || boundary.gate.width > project.plot.width - 1) throw new Error("Gate width must leave at least 0.5 ft of wall at both sides.");
    if (boundary.gate.offset < boundary.gate.width / 2 || boundary.gate.offset > project.plot.width - boundary.gate.width / 2) {
      throw new Error("The gate must fit within the front plot boundary.");
    }
  }
  if (boundary.gate.height < 3 || boundary.gate.height > 10) throw new Error("Gate height must be between 3 and 10 ft.");
  assertFinish(boundary.finish);
}

function assertFacadeFeature(project: Project, feature: FacadeFeature) {
  const wall = project.walls.find((item) => item.id === feature.wallId);
  if (!wall) throw new Error(`Wall ${feature.wallId} does not exist.`);
  if (!wall.exterior) throw new Error("Façade features require an exterior wall.");
  if (feature.width < 1 || feature.width > wallLength(wall)) throw new Error("Façade feature width must fit its host wall.");
  if (feature.offset < feature.width / 2 || feature.offset > wallLength(wall) - feature.width / 2) throw new Error("Façade feature must fit within its host wall.");
  if (feature.elevation < 0 || feature.elevation > wall.height + 3) throw new Error("Façade feature elevation is outside the supported wall zone.");
  if (feature.height <= 0 || feature.height > wall.height + 3) throw new Error("Façade feature height is outside the supported range.");
  if (feature.projection < 0.1 || feature.projection > 8) throw new Error("Façade feature projection must be between 0.1 and 8 ft.");
  if (feature.thickness < 0.1 || feature.thickness > 2) throw new Error("Façade feature thickness must be between 0.1 and 2 ft.");
  assertFinish(feature.finish);
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
    project.balconies.find((item) => item.id === id)?.name ??
    project.facadeFeatures.find((item) => item.id === id)?.kind?.concat(" façade feature") ??
    id
  );
}

/** Floors on which an element can be selected and edited. Connected stairs belong to both landings. */
export function elementFloorIds(project: Project, id: string) {
  const direct = [
    project.rooms.find((item) => item.id === id),
    project.walls.find((item) => item.id === id),
    project.openings.find((item) => item.id === id),
    project.balconies.find((item) => item.id === id),
  ].find(Boolean);
  if (direct) return [direct.floorId];
  const stair = project.stairs.find((item) => item.id === id);
  if (stair) {
    const connection = stairConnection(project, stair);
    return connection
      ? Array.from(new Set([connection.lowerFloor.id, connection.upperFloor.id]))
      : [stair.floorId];
  }
  const feature = project.facadeFeatures.find((item) => item.id === id);
  const hostWall = feature ? project.walls.find((item) => item.id === feature.wallId) : undefined;
  return hostWall ? [hostWall.floorId] : [];
}

export function elementIsOnFloor(project: Project, id: string, floorId: string) {
  return elementFloorIds(project, id).includes(floorId);
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
    balconies: current.balconies.map((item) => ({ ...item, railing: { ...item.railing, sides: [...item.railing.sides] } })),
    facadeFeatures: current.facadeFeatures.map((item) => ({ ...item })),
    roof: { ...current.roof },
    siteBoundary: { ...current.siteBoundary, gate: { ...current.siteBoundary.gate } },
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
        orientation: operation.orientation ?? project.plot.orientation,
        setbacks: { ...project.plot.setbacks, ...operation.setbacks },
      };
      const setbacks = project.plot.setbacks;
      if (Object.values(setbacks).some((value) => value < 0)) throw new Error("Setbacks cannot be negative.");
      if (setbacks.left + setbacks.right >= width || setbacks.front + setbacks.rear >= length) {
        throw new Error("Setbacks must leave a positive buildable envelope.");
      }
      assertSiteBoundary(project, project.siteBoundary);
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
      const requested = { x: room.x, y: room.y, width: room.width, length: room.length };
      const shape = shapeVertices(operation.shape ?? "rectangle", room.x, room.y, room.width, room.length);
      const aligned = alignVertices(project, operation.floorId, shape ?? [
        { x: room.x, y: room.y }, { x: room.x + room.width, y: room.y },
        { x: room.x + room.width, y: room.y + room.length }, { x: room.x, y: room.y + room.length },
      ]);
      room = roomFromVertices(room, aligned, operation.shape ?? "rectangle");
      if ((operation.shape ?? "rectangle") === "rectangle") room.vertices = undefined;
      assertRoomInsidePlot(project, room);
      assertNoRoomOverlap(project, room);
      project.rooms.push(room);
      rebuildCanonicalTopology(project);
      const createdRoom = project.rooms.find((item) => item.id === room.id)!;
      project.view.focusElementId = room.id;
      description = `${who} added ${room.name} · ${room.width} × ${room.length} ft`;
      const moved = requested.x !== room.x || requested.y !== room.y || requested.width !== room.width || requested.length !== room.length;
      result = {
        room: createdRoom, area: roomArea(room), wallIds: createdRoom.wallIds,
        ...(moved ? { alignment: { requested, applied: { x: room.x, y: room.y, width: room.width, length: room.length }, toleranceFt: ALIGNMENT_TOLERANCE, note: "Edges within the alignment tolerance were latched onto existing geometry so the rooms share one canonical wall." } } : {}),
      };
      break;
    }
    case "create_polygon_room": {
      if (!project.floors.some((floor) => floor.id === operation.floorId)) throw new Error(`Floor ${operation.floorId} does not exist.`);
      const normalized = alignVertices(project, operation.floorId, normalizedRoomVertices(operation.vertices));
      assertRoomVertices(project, normalized);
      const bounds = roomBounds({ x: 0, y: 0, width: 0, length: 0, vertices: normalized });
      const room = roomFromVertices({
        id: createId("room"), floorId: operation.floorId, name: operation.name.trim() || operation.roomType,
        type: operation.roomType, ...bounds, color: roomPalette[operation.roomType], wallIds: [], shape: "custom",
      }, normalized);
      assertNoRoomOverlap(project, room);
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
      const proposed = roomVertices({ ...previousRoom, x: round(operation.x), y: round(operation.y) })
        .map((point, index) => (previousRoom.vertices?.length
          ? { x: round(previousRoom.vertices[index].x + dx), y: round(previousRoom.vertices[index].y + dy) }
          : point));
      const latch = alignTranslation(project, previousRoom.floorId, proposed, previousRoom.id);
      const movedVertices = previousRoom.vertices?.map((point) => ({ x: round(point.x + dx + latch.dx), y: round(point.y + dy + latch.dy) }));
      const room = { ...previousRoom, x: round(operation.x + latch.dx), y: round(operation.y + latch.dy), vertices: movedVertices };
      assertRoomInsidePlot(project, room);
      assertNoRoomOverlap(project, room, previousRoom.id);
      const targets = roomOpeningTargets(project, previousRoom, room);
      const featureTargets = roomFacadeFeatureTargets(project, previousRoom, room);
      const wallFinishes = roomWallFinishes(project, previousRoom.id);
      project.rooms[index] = room;
      rebuildCanonicalTopology(project, targets, true, featureTargets);
      restoreRoomWallFinishes(project, room.id, wallFinishes);
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
      // A resize states an exact dimension, so it is never snapped — but it still cannot overlap.
      assertNoRoomOverlap(project, room, previousRoom.id);
      const targets = roomOpeningTargets(project, previousRoom, room);
      const featureTargets = roomFacadeFeatureTargets(project, previousRoom, room);
      const wallFinishes = roomWallFinishes(project, previousRoom.id);
      project.rooms[index] = room;
      rebuildCanonicalTopology(project, targets, true, featureTargets);
      restoreRoomWallFinishes(project, room.id, wallFinishes);
      assertAllOpeningsValid(project);
      project.view.focusElementId = room.id;
      description = `${who} resized ${room.name} to ${room.width} × ${room.length} ft`;
      result = { room, area: roomArea(room), metrics: projectMetrics(project, room.floorId) };
      break;
    }
    case "update_room_vertices": {
      const index = project.rooms.findIndex((room) => room.id === operation.roomId);
      if (index < 0) throw new Error(`Room ${operation.roomId} does not exist.`);
      const previousRoom = project.rooms[index];
      const normalized = alignVertices(project, previousRoom.floorId, normalizedRoomVertices(operation.vertices), previousRoom.id);
      assertRoomVertices(project, normalized);
      const room = roomFromVertices(previousRoom, normalized);
      assertNoRoomOverlap(project, room, previousRoom.id);
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
      project.facadeFeatures = project.facadeFeatures.filter((feature) => !roomWallIds.has(feature.wallId));
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
      const glazing = operation.glazing ?? previous.glazing;
      const glazingDefaults = previous.kind === "window" && operation.glazing
        ? glazingPerformanceDefaults[operation.glazing]
        : undefined;
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
        glazing,
        solarHeatGainCoefficient: operation.solarHeatGainCoefficient ?? operation.solarTransmittance ?? glazingDefaults?.solarHeatGainCoefficient ?? previous.solarHeatGainCoefficient,
        visibleTransmittance: operation.visibleTransmittance ?? glazingDefaults?.visibleTransmittance ?? previous.visibleTransmittance,
        uFactor: operation.uFactor ?? glazingDefaults?.uFactor ?? previous.uFactor,
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
        upperFlightLength: round(operation.upperFlightLength ?? operation.length),
        direction: operation.direction ?? "up",
        rotation: operation.rotation ?? 0,
        stairType: operation.stairType ?? "straight",
        landingDepth: round(operation.landingDepth ?? operation.width),
        wellWidth: round(operation.wellWidth ?? 0.5),
        turnSide: operation.turnSide ?? "left",
      };
      assertStairInsidePlot(project, stair);
      project.stairs.push(stair);
      project.view.focusElementId = stair.id;
      description = `${who} added a ${stair.stairType === "u-shaped" ? "U-shaped" : stair.stairType === "l-shaped" ? "L-shaped" : "straight"} staircase`;
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
        upperFlightLength: round(operation.upperFlightLength ?? previous.upperFlightLength),
        direction: operation.direction ?? previous.direction,
        rotation: operation.rotation ?? previous.rotation,
        stairType: operation.stairType ?? previous.stairType,
        landingDepth: round(operation.landingDepth ?? (operation.width !== undefined && (operation.stairType ?? previous.stairType) !== "straight" ? Math.max(previous.landingDepth, operation.width) : previous.landingDepth)),
        wellWidth: round(operation.wellWidth ?? previous.wellWidth),
        turnSide: operation.turnSide ?? previous.turnSide,
      };
      assertStairInsidePlot(project, stair);
      project.stairs[index] = stair;
      project.view.focusElementId = stair.id;
      description = `${who} updated a staircase`;
      result = { stair, connection: stairConnection(project, stair) ?? null };
      break;
    }
    case "set_wall_finish": {
      const index = project.walls.findIndex((wall) => wall.id === operation.wallId);
      if (index < 0) throw new Error(`Wall ${operation.wallId} does not exist.`);
      if (!project.walls[index].exterior) throw new Error("Finish overrides apply only to exterior walls.");
      if (operation.finish) assertFinish(operation.finish);
      project.walls[index] = { ...project.walls[index], finish: operation.finish };
      project.view.focusElementId = operation.wallId;
      description = operation.finish
        ? `${who} set a wall finish to ${exteriorFinishPresets[operation.finish].label}`
        : `${who} reset a wall to the project façade palette`;
      result = { wall: project.walls[index], effectiveFinish: operation.finish ?? project.exteriorFinish };
      break;
    }
    case "set_roof": {
      const roof: RoofSettings = {
        ...project.roof,
        parapetEnabled: operation.parapetEnabled ?? project.roof.parapetEnabled,
        parapetHeight: round(operation.parapetHeight ?? project.roof.parapetHeight),
        parapetThickness: round(operation.parapetThickness ?? project.roof.parapetThickness),
        finish: operation.finish ?? project.roof.finish,
      };
      if (roof.parapetHeight < 0.5 || roof.parapetHeight > 6) throw new Error("Parapet height must be between 0.5 and 6 ft.");
      if (roof.parapetThickness < 0.2 || roof.parapetThickness > 2) throw new Error("Parapet thickness must be between 0.2 and 2 ft.");
      assertFinish(roof.finish);
      project.roof = roof;
      description = `${who} updated the flat roof and parapet`;
      result = { roof };
      break;
    }
    case "set_site_boundary": {
      const siteBoundary: SiteBoundarySettings = {
        ...project.siteBoundary,
        enabled: operation.enabled ?? project.siteBoundary.enabled,
        height: round(operation.height ?? project.siteBoundary.height),
        thickness: round(operation.thickness ?? project.siteBoundary.thickness),
        finish: operation.finish ?? project.siteBoundary.finish,
        gate: {
          ...project.siteBoundary.gate,
          enabled: operation.gateEnabled ?? project.siteBoundary.gate.enabled,
          offset: round(operation.gateOffset ?? project.siteBoundary.gate.offset),
          width: round(operation.gateWidth ?? project.siteBoundary.gate.width),
          height: round(operation.gateHeight ?? project.siteBoundary.gate.height),
          style: operation.gateStyle ?? project.siteBoundary.gate.style,
        },
      };
      assertSiteBoundary(project, siteBoundary);
      project.siteBoundary = siteBoundary;
      description = `${who} updated the boundary wall and front gate`;
      result = { siteBoundary };
      break;
    }
    case "add_balcony": {
      const balcony: Balcony = {
        id: createId("balcony"),
        floorId: operation.floorId,
        name: operation.name?.trim() || (operation.kind === "terrace" ? "Terrace" : "Balcony"),
        kind: operation.kind ?? "balcony",
        x: round(operation.x), y: round(operation.y), width: round(operation.width), length: round(operation.length),
        slabThickness: round(operation.slabThickness ?? 0.5),
        finish: operation.finish ?? project.exteriorFinish,
        railing: {
          enabled: operation.railingEnabled ?? true,
          height: round(operation.railingHeight ?? 3.5),
          style: operation.railingStyle ?? "horizontal",
          sides: operation.railingSides?.length ? [...new Set(operation.railingSides)] : ["north", "east", "south", "west"],
        },
      };
      assertBalcony(project, balcony);
      project.balconies.push(balcony);
      project.view.activeFloorId = balcony.floorId;
      project.view.focusElementId = balcony.id;
      description = `${who} added ${balcony.name}`;
      result = { balcony, area: round(balcony.width * balcony.length) };
      break;
    }
    case "update_balcony": {
      const index = project.balconies.findIndex((item) => item.id === operation.balconyId);
      if (index < 0) throw new Error(`Balcony ${operation.balconyId} does not exist.`);
      const previous = project.balconies[index];
      const balcony: Balcony = {
        ...previous,
        name: operation.name?.trim() || previous.name,
        kind: operation.kind ?? previous.kind,
        x: round(operation.x ?? previous.x), y: round(operation.y ?? previous.y),
        width: round(operation.width ?? previous.width), length: round(operation.length ?? previous.length),
        slabThickness: round(operation.slabThickness ?? previous.slabThickness),
        finish: operation.finish ?? previous.finish,
        railing: {
          ...previous.railing,
          enabled: operation.railingEnabled ?? previous.railing.enabled,
          height: round(operation.railingHeight ?? previous.railing.height),
          style: operation.railingStyle ?? previous.railing.style,
          sides: operation.railingSides?.length ? [...new Set(operation.railingSides)] : previous.railing.sides,
        },
      };
      assertBalcony(project, balcony);
      project.balconies[index] = balcony;
      project.view.focusElementId = balcony.id;
      description = `${who} updated ${balcony.name}`;
      result = { balcony, area: round(balcony.width * balcony.length) };
      break;
    }
    case "delete_balcony": {
      const balcony = project.balconies.find((item) => item.id === operation.balconyId);
      if (!balcony) throw new Error(`Balcony ${operation.balconyId} does not exist.`);
      project.balconies = project.balconies.filter((item) => item.id !== balcony.id);
      if (project.view.focusElementId === balcony.id) project.view.focusElementId = undefined;
      description = `${who} deleted ${balcony.name}`;
      result = { deletedBalconyId: balcony.id };
      break;
    }
    case "add_facade_feature": {
      const defaults = operation.kind === "frame"
        ? { elevation: 1, height: 8, projection: 0.6, thickness: 0.45 }
        : operation.kind === "canopy"
          ? { elevation: 7, height: 0.45, projection: 3, thickness: 0.4 }
          : { elevation: 6.5, height: 0.3, projection: 2, thickness: 0.3 };
      const feature: FacadeFeature = {
        id: createId("facade"), kind: operation.kind, wallId: operation.wallId,
        offset: round(operation.offset), width: round(operation.width),
        elevation: round(operation.elevation ?? defaults.elevation),
        height: round(operation.height ?? defaults.height),
        projection: round(operation.projection ?? defaults.projection),
        thickness: round(operation.thickness ?? defaults.thickness),
        finish: operation.finish ?? project.exteriorFinish,
      };
      assertFacadeFeature(project, feature);
      project.facadeFeatures.push(feature);
      project.view.activeFloorId = project.walls.find((wall) => wall.id === feature.wallId)!.floorId;
      project.view.focusElementId = feature.id;
      description = `${who} added a ${feature.kind}`;
      result = { facadeFeature: feature };
      break;
    }
    case "update_facade_feature": {
      const index = project.facadeFeatures.findIndex((item) => item.id === operation.featureId);
      if (index < 0) throw new Error(`Façade feature ${operation.featureId} does not exist.`);
      const previous = project.facadeFeatures[index];
      const feature: FacadeFeature = {
        ...previous, kind: operation.kind ?? previous.kind, wallId: operation.wallId ?? previous.wallId,
        offset: round(operation.offset ?? previous.offset), width: round(operation.width ?? previous.width),
        elevation: round(operation.elevation ?? previous.elevation), height: round(operation.height ?? previous.height),
        projection: round(operation.projection ?? previous.projection), thickness: round(operation.thickness ?? previous.thickness),
        finish: operation.finish ?? previous.finish,
      };
      assertFacadeFeature(project, feature);
      project.facadeFeatures[index] = feature;
      project.view.focusElementId = feature.id;
      description = `${who} updated a ${feature.kind}`;
      result = { facadeFeature: feature };
      break;
    }
    case "delete_facade_feature": {
      const feature = project.facadeFeatures.find((item) => item.id === operation.featureId);
      if (!feature) throw new Error(`Façade feature ${operation.featureId} does not exist.`);
      project.facadeFeatures = project.facadeFeatures.filter((item) => item.id !== feature.id);
      if (project.view.focusElementId === feature.id) project.view.focusElementId = undefined;
      description = `${who} deleted a ${feature.kind}`;
      result = { deletedFacadeFeatureId: feature.id };
      break;
    }
    case "set_exterior_finish": {
      assertFinish(operation.finish);
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
      project.view.focusElementId = undefined;
      description = `${who} created ${floor.name}`;
      result = { floor };
      break;
    }
    case "set_floor_height": {
      const index = project.floors.findIndex((floor) => floor.id === operation.floorId);
      if (index < 0) throw new Error(`Floor ${operation.floorId} does not exist.`);
      const height = round(operation.height);
      if (height < 7 || height > 16) throw new Error("Storey height must be between 7 and 16 ft.");
      const blocking = project.openings.find((opening) => opening.floorId === operation.floorId
        && (opening.sillHeight ?? 0) + opening.height > height + 0.001);
      if (blocking) {
        throw new Error(`A ${blocking.kind} on this floor reaches ${round((blocking.sillHeight ?? 0) + blocking.height, 2)} ft and would not fit a ${height} ft storey. Resize or lower it first.`);
      }
      project.floors[index] = { ...project.floors[index], height };
      // Every storey above sits on the one below, so elevations and stair rises recompute together.
      const ordered = [...project.floors].sort((a, b) => a.level - b.level);
      let elevation = 0;
      const elevations = new Map<string, number>();
      ordered.forEach((floor) => { elevations.set(floor.id, round(elevation, 3)); elevation += floor.height; });
      project.floors = project.floors.map((floor) => ({ ...floor, elevation: elevations.get(floor.id) ?? floor.elevation }));
      project.walls = project.walls.map((wall) => (wall.floorId === operation.floorId ? { ...wall, height } : wall));
      const affectedStairs = project.stairs
        .flatMap((stair) => { const connection = stairConnection(project, stair); return connection ? [{ stairId: stair.id, rise: connection.rise, riserCount: connection.riserCount, riserHeightInches: connection.riserHeightInches, treadDepthInches: connection.treadDepthInches }] : []; });
      description = `${who} set ${project.floors[index].name} to a ${height} ft storey height`;
      result = { floor: project.floors[index], floors: project.floors, stairs: affectedStairs, metrics: projectMetrics(project) };
      break;
    }
    case "set_active_floor": {
      const floor = project.floors.find((item) => item.id === operation.floorId);
      if (!floor) throw new Error(`Floor ${operation.floorId} does not exist.`);
      project.view.activeFloorId = floor.id;
      if (project.view.focusElementId && !elementIsOnFloor(project, project.view.focusElementId, floor.id)) {
        project.view.focusElementId = undefined;
      }
      description = `${who} opened ${floor.name}`;
      result = { floor, view: project.view };
      break;
    }
    case "delete_element": {
      const wall = project.walls.find((item) => item.id === operation.elementId);
      const opening = project.openings.find((item) => item.id === operation.elementId);
      const stair = project.stairs.find((item) => item.id === operation.elementId);
      const balcony = project.balconies.find((item) => item.id === operation.elementId);
      const facadeFeature = project.facadeFeatures.find((item) => item.id === operation.elementId);
      if (wall?.roomIds.length) throw new Error("Canonical room-boundary walls are controlled by their rooms.");
      if (!wall && !opening && !stair && !balcony && !facadeFeature) throw new Error("This element cannot be deleted.");
      project.walls = project.walls.filter((item) => item.id !== operation.elementId);
      project.openings = project.openings.filter(
        (item) => item.id !== operation.elementId && item.wallId !== operation.elementId,
      );
      project.stairs = project.stairs.filter((item) => item.id !== operation.elementId);
      project.balconies = project.balconies.filter((item) => item.id !== operation.elementId);
      project.facadeFeatures = project.facadeFeatures.filter((item) => item.id !== operation.elementId && item.wallId !== operation.elementId);
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
        const exists = [project.rooms, project.walls, project.openings, project.stairs, project.balconies, project.facadeFeatures]
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
    if (!wall || wall.roomIds.length > 2) {
      invalidDoorIds.push(opening.id);
      return;
    }
    // A door in an independent wall (a garden gate, a screen wall) is a valid opening that simply
    // joins no two spaces, so it carries no circulation edge and is not a broken host.
    if (!wall.roomIds.length) return;
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
    const sourceFloor = floors[floorIndex];
    if (!sourceFloor) {
      invalidStairIds.push(stair.id);
      return;
    }
    const sourceLevel = targetFloor && sourceFloor.elevation <= targetFloor.elevation ? "lower" : "upper";
    const targetLevel = sourceLevel === "lower" ? "upper" : "lower";
    // Circulation belongs to the clear floor area outside the stair, not to a point buried in a tread.
    const sourcePoint = stairEntryPoint(stair, sourceLevel, stair.width / 2);
    const targetPoint = stairEntryPoint(stair, targetLevel, stair.width / 2);
    const sourceRoom = project.rooms.find((room) => room.floorId === stair.floorId && roomContainsPoint(room, sourcePoint));
    const targetRoom = targetFloor && project.rooms.find((room) => room.floorId === targetFloor.id && roomContainsPoint(room, targetPoint));
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
        severity: "error",
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
      message: "A staircase does not connect valid rooms at its lower and upper entries on adjacent floors.",
      elementIds: [stair.id],
      evidence: { stairId: stair.id, floorId: stair.floorId },
      suggestion: "Move the stair so both physical entries land inside valid rooms on adjacent floors, or add the missing destination floor/room.",
      possibleCorrection: "Create aligned stair halls on consecutive floors and validate both stair entries again.",
    });
  });
  project.stairs.filter((stair) => targetFloors.includes(stair.floorId)).forEach((stair) => {
    const connection = stairConnection(project, stair);
    if (!connection) return;
    const actualRuns = stair.stairType === "l-shaped" ? [stair.length, stair.upperFlightLength] : connection.recommendedRuns.map(() => stair.length);
    const shortFlights = actualRuns.flatMap((run, index) => run + 0.01 < connection.recommendedRuns[index]
      ? [{ index, actual: run, required: connection.recommendedRuns[index] }]
      : []);
    if (shortFlights.length) {
      const stairName = stair.stairType === "u-shaped" ? "U-shaped" : stair.stairType === "l-shaped" ? "L-shaped" : "straight";
      issues.push({
        id: createId("issue"),
        code: "INVALID_STAIR_GEOMETRY",
        severity: "error",
        message: `${stairName} stair ${shortFlights.length === 1 ? `flight ${shortFlights[0].index + 1} is` : "flights are"} too short for the current floor-to-floor rise.`,
        elementIds: [stair.id],
        evidence: {
          rise: connection.rise,
          riserCount: connection.riserCount,
          riserHeightInches: round(connection.riserHeight * 12, 2),
          treadDepthsInches: connection.treadDepths.map((depth) => round(depth * 12, 2)).join(" / "),
          actualRuns: actualRuns.join(" / "),
          recommendedRuns: connection.recommendedRuns.join(" / "),
        },
        suggestion: `Extend ${connection.flightCount === 2 ? "each undersized flight" : "the run"} to its recommended length: ${connection.recommendedRuns.join(" ft / ")} ft.`,
        possibleCorrection: "Resize the stair, then confirm landings, headroom, guards, and local code requirements separately.",
      });
    }

    (["lower", "upper"] as const).forEach((level) => {
      const floor = level === "lower" ? connection.lowerFloor : connection.upperFloor;
      const access = stairAccessPolygon(stair, level);
      const center = stairEntryPoint(stair, level, stair.width / 2);
      const accessRoom = project.rooms.find((room) => room.floorId === floor.id
        && roomContainsPoint(room, center)
        && access.every((point) => roomContainsPoint(room, point)));
      if (accessRoom) return;
      issues.push({
        id: createId("issue"),
        code: "STAIR_ACCESS_CLEARANCE",
        severity: "error",
        message: `The ${level}-floor stair entry does not have a clear ${round(stair.width, 2)} × ${round(stair.width, 2)} ft approach within one stair hall or room.`,
        elementIds: [stair.id],
        evidence: { stairId: stair.id, floorId: floor.id, level, requiredDepth: stair.width, accessPolygon: JSON.stringify(access) },
        suggestion: `Move or rotate the stair so its ${level} entry and full clear approach land inside one room.`,
        possibleCorrection: "Reserve a stair hall on both connected floors before finalizing adjacent walls and doors.",
      });
    });

    const outline = stairPlanOutline(stair);
    const connectedFloorIds = new Set([connection.lowerFloor.id, connection.upperFloor.id]);
    const crossingWallIds = project.walls.filter((wall) => connectedFloorIds.has(wall.floorId)).filter((wall) =>
      outline.some((point, index) => segmentsIntersect(
        { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 },
        point, outline[(index + 1) % outline.length],
      )),
    ).map((wall) => wall.id);
    if (crossingWallIds.length) {
      issues.push({
        id: createId("issue"),
        code: "STAIR_WALL_CLASH",
        severity: "error",
        message: `The stairwell crosses ${crossingWallIds.length} wall segment${crossingWallIds.length === 1 ? "" : "s"}.`,
        elementIds: [stair.id, ...crossingWallIds],
        evidence: { stairId: stair.id, wallIds: crossingWallIds.join(", ") },
        suggestion: "Move the stair inside a clear stair hall; walls must not pass through flights, landings, or the stairwell void.",
      });
    }
  });

  // A door must open onto clear floor. Stepping straight onto a flight, a landing, or into the
  // stairwell void is a real hazard, and the stair's own approach check cannot see it.
  const stairwells = project.stairs.flatMap((stair) => {
    const connection = stairConnection(project, stair);
    if (!connection) return [];
    return [{ stair, layout: stairLayout(stair), floorIds: new Set([connection.lowerFloor.id, connection.upperFloor.id]) }];
  });
  if (stairwells.length) {
    for (const opening of project.openings.filter((item) => item.kind === "door" && targetFloors.includes(item.floorId))) {
      const wall = project.walls.find((item) => item.id === opening.wallId);
      const length = wall ? wallLength(wall) : 0;
      if (!wall || !length) continue;
      const ux = (wall.x2 - wall.x1) / length;
      const uy = (wall.y2 - wall.y1) / length;
      const centerX = wall.x1 + ux * opening.offset;
      const centerY = wall.y1 + uy * opening.offset;
      const clashing = stairwells.filter((item) => item.floorIds.has(opening.floorId)).filter((item) => {
        for (const sign of [1, -1]) {
          for (const depth of [0.75, 1.5, 2.25, 3]) {
            for (const across of [-opening.width / 2 + 0.25, 0, opening.width / 2 - 0.25]) {
              const point = { x: centerX + ux * across - uy * sign * depth, y: centerY + uy * across + ux * sign * depth };
              if (localPolygonContains(item.layout.outline, stairLocalPoint(item.stair, point))) return true;
            }
          }
        }
        return false;
      });
      if (!clashing.length) continue;
      issues.push({
        id: createId("issue"),
        code: "DOOR_BLOCKED_BY_STAIR",
        severity: "error",
        message: `A ${opening.kind} opens directly onto the stairwell of ${clashing.map((item) => item.stair.id).join(", ")} with no clear landing in front of it.`,
        elementIds: [opening.id, ...clashing.map((item) => item.stair.id)],
        evidence: {
          openingId: opening.id, wallId: opening.wallId, floorId: opening.floorId,
          doorCentre: `${round(centerX, 2)}, ${round(centerY, 2)}`,
          requiredClearDepth: 3,
          stairIds: clashing.map((item) => item.stair.id).join(", "),
        },
        suggestion: "Move the stair or the door so at least 3 ft of clear floor separates them; a door must never open onto a flight or into the stairwell void.",
        possibleCorrection: "Use update_stairs to shift the stair, or update_opening to move the door along its wall.",
      });
    }
  }

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
    const invalid = !wall || wall.roomIds.length > 2 || opening.offset < opening.width / 2 || opening.offset > length - opening.width / 2 || verticalInvalid;
    if (invalid) {
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
    // Independent walls host openings legitimately, but a door in one is a gate rather than a
    // room-to-room connection, so it is reported as guidance instead of an error.
    if (!invalid && wall && !wall.roomIds.length && opening.kind === "door") {
      issues.push({
        id: createId("issue"),
        code: "OPENING_WITHOUT_ADJACENCY",
        severity: "warning",
        message: "A door on an independent wall does not connect two spaces.",
        elementIds: [opening.id, opening.wallId],
        affectedOpeningId: opening.id,
        evidence: { openingId: opening.id, wallId: opening.wallId, hostRoomCount: 0 },
        suggestion: "Keep it if the wall is a screen or gate, or rehost the door onto an exterior wall or a wall shared by two rooms.",
        possibleCorrection: "Use rehost_door with a canonical wall id and a valid offset if this opening should carry circulation.",
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

  // Habitability: the app knows each room's programmatic type, so it can check whether the space is
  // actually liveable, not merely geometrically valid. These are warnings — early-design guidance.
  for (const room of rooms) {
    const habitable = HABITABLE_ROOM_TYPES.includes(room.type);
    if (!habitable && room.type !== "Bathroom") continue;
    const area = roomArea(room);
    const bounds = roomBounds(room);
    const minDimension = round(Math.min(bounds.width, bounds.length), 2);

    if (habitable && (area < HABITABLE_MIN_AREA || minDimension < HABITABLE_MIN_DIMENSION)) {
      issues.push({
        id: createId("issue"),
        code: "ROOM_BELOW_HABITABLE_MINIMUM",
        severity: "warning",
        message: `${room.name} is ${area} sq ft with a least dimension of ${minDimension} ft, below the ${HABITABLE_MIN_AREA} sq ft / ${HABITABLE_MIN_DIMENSION} ft concept minimum for a habitable room.`,
        elementIds: [room.id],
        evidence: { roomType: room.type, area, minDimension, requiredArea: HABITABLE_MIN_AREA, requiredMinDimension: HABITABLE_MIN_DIMENSION, basis: "2021 IRC R304 concept" },
        suggestion: `Enlarge ${room.name} to at least ${HABITABLE_MIN_AREA} sq ft with no dimension under ${HABITABLE_MIN_DIMENSION} ft, or change its room type.`,
        possibleCorrection: "Use resize_room or set_exact_dimension, then validate again.",
      });
    }

    const hostIds = daylightWallIds(project, room);
    const windows = project.openings.filter((opening) => opening.kind === "window" && hostIds.has(opening.wallId));
    const glazedArea = round(windows.reduce((sum, opening) => sum + opening.width * opening.height, 0));
    const openableArea = round(windows.reduce((sum, opening) => sum + (opening.operable
      ? opening.width * opening.height * (WINDOW_OPENABLE_FRACTION[opening.windowType ?? "fixed"] ?? 0)
      : 0), 0));
    const requiredGlazing = round(area * DAYLIGHT_GLAZING_RATIO);
    const requiredOpenable = round(area * VENTILATION_OPENABLE_RATIO);

    if (habitable && area > 0 && glazedArea + 0.01 < requiredGlazing) {
      issues.push({
        id: createId("issue"),
        code: "ROOM_DAYLIGHT_SHORTFALL",
        severity: "warning",
        message: `${room.name} has ${glazedArea} sq ft of exterior glazing, ${round((glazedArea / area) * 100, 1)}% of its floor area, below the 8% concept daylight guideline.`,
        elementIds: [room.id, ...windows.map((opening) => opening.id)],
        evidence: { roomArea: area, glazedArea, glazingRatioPercent: round((glazedArea / area) * 100, 1), requiredGlazing, windowCount: windows.length, basis: "2021 IRC R303.1 concept" },
        suggestion: `Add or widen exterior windows in ${room.name} to reach about ${requiredGlazing} sq ft of glazing.`,
        possibleCorrection: "Use add_window on an exterior wall of this room, then validate again.",
      });
    }

    if (area > 0 && openableArea + 0.01 < requiredOpenable) {
      issues.push({
        id: createId("issue"),
        code: "ROOM_NO_VENTILATION",
        severity: "warning",
        message: openableArea === 0
          ? `${room.name} has no openable exterior window, so it has no natural ventilation.`
          : `${room.name} has ${openableArea} sq ft of openable glazing, below the 4% concept ventilation guideline.`,
        elementIds: [room.id, ...windows.map((opening) => opening.id)],
        evidence: { roomArea: area, openableArea, requiredOpenable, windowCount: windows.length, note: "Fixed windows contribute no openable area; mechanical ventilation is an accepted alternative not modelled here.", basis: "2021 IRC R303.1 concept" },
        suggestion: `Make a window in ${room.name} operable, or add an openable exterior window of about ${requiredOpenable} sq ft.`,
        possibleCorrection: "Use set_window_properties with operable true and a casement, sliding, or awning window type.",
      });
    }

    if (room.type === "Bedroom") {
      const escape = windows.find((opening) => opening.width * opening.height >= EGRESS_MIN_CLEAR_AREA
        && (opening.sillHeight ?? 0) <= EGRESS_MAX_SILL
        && opening.width >= EGRESS_MIN_CLEAR_WIDTH
        && opening.height >= EGRESS_MIN_CLEAR_HEIGHT);
      if (!escape) {
        issues.push({
          id: createId("issue"),
          code: "BEDROOM_NO_EGRESS",
          severity: "warning",
          message: `${room.name} has no window that meets the emergency escape concept: at least ${EGRESS_MIN_CLEAR_AREA} sq ft clear, 20 in wide, 24 in high, with a sill no higher than 44 in.`,
          elementIds: [room.id, ...windows.map((opening) => opening.id)],
          evidence: { windowCount: windows.length, requiredClearArea: EGRESS_MIN_CLEAR_AREA, maxSillInches: 44, minClearWidthInches: 20, minClearHeightInches: 24, basis: "2021 IRC R310 concept" },
          suggestion: `Provide one exterior window in ${room.name} of at least ${EGRESS_MIN_CLEAR_AREA} sq ft with its sill at or below 44 in.`,
          possibleCorrection: "Use add_window or set_window_properties to enlarge an exterior window and lower its sill.",
        });
      }
    }
  }

  for (const balcony of project.balconies.filter((item) => targetFloors.includes(item.floorId))) {
    const outside = balcony.width < 3 || balcony.length < 3 || balcony.x < 0 || balcony.y < 0
      || balcony.x + balcony.width > plot.width || balcony.y + balcony.length > plot.length;
    if (!outside) continue;
    issues.push({
      id: createId("issue"), code: "INVALID_BALCONY", severity: "error",
      message: `${balcony.name} does not fit within the editable site boundary.`,
      elementIds: [balcony.id],
      evidence: { x: balcony.x, y: balcony.y, width: balcony.width, length: balcony.length },
      suggestion: "Move or resize the balcony/terrace so its complete slab remains inside the plot.",
    });
  }

  for (const feature of project.facadeFeatures) {
    const wall = project.walls.find((item) => item.id === feature.wallId);
    if (wall && targetFloors.includes(wall.floorId) && wall.exterior && feature.width >= 1
      && feature.offset >= feature.width / 2 && feature.offset <= wallLength(wall) - feature.width / 2) continue;
    if (wall && !targetFloors.includes(wall.floorId)) continue;
    issues.push({
      id: createId("issue"), code: "INVALID_FACADE_FEATURE", severity: "error",
      message: `A ${feature.kind} is not hosted within a valid exterior wall segment.`,
      elementIds: [feature.id, feature.wallId],
      evidence: { wallId: feature.wallId, offset: feature.offset, width: feature.width },
      suggestion: "Rehost or resize the façade feature so it fits an exterior wall.",
    });
  }

  const gate = project.siteBoundary.gate;
  if (project.siteBoundary.enabled && gate.enabled
    && (gate.width < 3 || gate.offset < gate.width / 2 || gate.offset > plot.width - gate.width / 2)) {
    issues.push({
      id: createId("issue"), code: "INVALID_SITE_BOUNDARY", severity: "error",
      message: "The front gate does not fit within the current plot width.",
      elementIds: [],
      evidence: { plotWidth: plot.width, gateOffset: gate.offset, gateWidth: gate.width },
      suggestion: "Move or narrow the gate, or increase the plot width.",
    });
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
    carpetArea: roomCarpetArea(project, room),
    area: roomArea(room),
    areaDefinition: "netRoomArea is measured to wall centrelines; carpetArea is the finished area inside the bounding walls. The area alias is retained for compatibility.",
    perimeter: roomPerimeter(room),
    interiorPoint: roomInteriorPoint(room),
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
    exteriorFinish: wall.exterior ? {
      id: wall.finish ?? project.exteriorFinish,
      source: wall.finish ? "wall-override" : "project-default",
      ...exteriorFinishPresets[wall.finish ?? project.exteriorFinish],
    } : null,
    facadeFeatures: project.facadeFeatures.filter((feature) => feature.wallId === wall.id),
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

export function inspectFloor(project: Project, floorId: string, detail: "summary" | "full" = "summary") {
  const floor = project.floors.find((item) => item.id === floorId);
  if (!floor) throw new Error(`Floor ${floorId} does not exist.`);
  const stairDetails = project.stairs.flatMap((stair) => {
    const connection = stairConnection(project, stair);
    if (!connection || (connection.lowerFloor.id !== floorId && connection.upperFloor.id !== floorId)) return [];
    const layout = stairLayout(stair);
    return [{
      stair,
      roleOnFloor: connection.lowerFloor.id === floorId ? "lower-entry" : "upper-entry",
      connection,
      layout: {
        outline: stairPlanOutline(stair),
        flights: layout.flights,
        landing: layout.landing,
        route: layout.route,
      },
      lowerAccess: stairAccessPolygon(stair, "lower"),
      upperAccess: stairAccessPolygon(stair, "upper"),
    }];
  });
  const rooms = project.rooms.filter((room) => room.floorId === floorId);
  const walls = project.walls.filter((wall) => wall.floorId === floorId);
  const openings = project.openings.filter((opening) => opening.floorId === floorId);
  const balconies = project.balconies.filter((balcony) => balcony.floorId === floorId);
  const facadeFeatures = project.facadeFeatures.filter((feature) => project.walls.find((wall) => wall.id === feature.wallId)?.floorId === floorId);
  const circulation = buildCirculationGraph(project);
  const validation = validateLayout(project, floorId);
  const metrics = projectMetrics(project, floorId);

  if (detail === "full") {
    return {
      detail,
      floor,
      rooms: rooms.map((room) => ({ ...room, area: roomArea(room), carpetArea: roomCarpetArea(project, room), perimeter: roomPerimeter(room) })),
      walls,
      openings,
      stairs: project.stairs.filter((stair) => stair.floorId === floorId),
      stairDetails,
      balconies,
      facadeFeatures,
      metrics,
      circulation,
      validation,
    };
  }

  // Default summary keeps every stable ID and dimension an agent needs to plan an edit, but drops
  // derived geometry, deprecated compatibility fields, and the full circulation graph. Chrome's
  // WebMCP guidance budgets roughly 1.5K characters per tool result; the full payload is far larger.
  return {
    detail,
    floor,
    rooms: rooms.map((room) => ({
      id: room.id, name: room.name, type: room.type, shape: room.shape ?? "rectangle",
      x: room.x, y: room.y, width: room.width, length: room.length,
      area: roomArea(room), carpetArea: roomCarpetArea(project, room), perimeter: roomPerimeter(room),
    })),
    walls: walls.map((wall) => ({
      id: wall.id, x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
      length: round(wallLength(wall)), thickness: wall.thickness, height: wall.height,
      exterior: wall.exterior, roomIds: wall.roomIds,
      ...(wall.exterior ? { facing: wallCardinalFacing(project, wall) } : {}),
      ...(wall.finish ? { finish: wall.finish } : {}),
    })),
    openings: openings.map((opening) => ({
      id: opening.id, kind: opening.kind, wallId: opening.wallId, offset: opening.offset,
      width: opening.width, height: opening.height,
      ...(opening.kind === "window"
        ? { sillHeight: opening.sillHeight, windowType: opening.windowType, operable: opening.operable, glazing: opening.glazing }
        : { handing: opening.handing, swingDirection: opening.swingDirection, state: opening.state }),
    })),
    stairs: stairDetails.map((item) => ({
      id: item.stair.id, stairType: item.stair.stairType, roleOnFloor: item.roleOnFloor,
      x: item.stair.x, y: item.stair.y, width: item.stair.width, length: item.stair.length,
      rotation: item.stair.rotation, direction: item.stair.direction,
      connects: `${item.connection.lowerFloor.id} -> ${item.connection.upperFloor.id}`,
      rise: item.connection.rise, riserCount: item.connection.riserCount,
      riserHeightInches: item.connection.riserHeightInches, treadDepthInches: item.connection.treadDepthInches,
    })),
    balconies: balconies.map((balcony) => ({ id: balcony.id, name: balcony.name, kind: balcony.kind, x: balcony.x, y: balcony.y, width: balcony.width, length: balcony.length })),
    facadeFeatures: facadeFeatures.map((feature) => ({ id: feature.id, kind: feature.kind, wallId: feature.wallId, offset: feature.offset, width: feature.width })),
    metrics,
    circulation: {
      mainEntranceOpeningId: circulation.mainEntranceOpeningId,
      primaryEntryRoomId: circulation.primaryEntryRoomId,
      hasExteriorAccess: circulation.hasExteriorAccess,
      reachableRoomCount: circulation.reachableRoomIds.length,
      disconnectedRoomIds: circulation.disconnectedRoomIds,
      invalidDoorIds: circulation.invalidDoorIds,
      invalidStairIds: circulation.invalidStairIds,
    },
    validation: {
      status: validation.status, issueCount: validation.issueCount,
      errors: validation.errors, warnings: validation.warnings,
      issues: validation.issues.map((issue) => ({ code: issue.code, severity: issue.severity, message: issue.message, elementIds: issue.elementIds })),
    },
    hint: "Each wall lists the rooms it bounds, so a room's boundary walls are the walls whose roomIds include it. Call inspect_floor with detail 'full' for wall connectivity, stair layout geometry, and the complete circulation graph.",
  };
}

function elementPoint(project: Project, ref: PointRef) {
  if ("x" in ref) return { x: ref.x, y: ref.y };
  if (ref.elementId === "plot") return { x: project.plot.width / 2, y: project.plot.length / 2 };
  const room = project.rooms.find((item) => item.id === ref.elementId);
  if (room) return roomInteriorPoint(room);
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
  const balcony = project.balconies.find((item) => item.id === ref.elementId);
  if (balcony) return { x: balcony.x + balcony.width / 2, y: balcony.y + balcony.length / 2 };
  const facadeFeature = project.facadeFeatures.find((item) => item.id === ref.elementId);
  if (facadeFeature) {
    const facadeWall = project.walls.find((item) => item.id === facadeFeature.wallId);
    if (facadeWall) {
      const length = wallLength(facadeWall);
      const ratio = length ? facadeFeature.offset / length : 0;
      return { x: facadeWall.x1 + (facadeWall.x2 - facadeWall.x1) * ratio, y: facadeWall.y1 + (facadeWall.y2 - facadeWall.y1) * ratio };
    }
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
    roof: project.roof,
    siteBoundary: project.siteBoundary,
    balconies: project.balconies.map((balcony) => ({ id: balcony.id, floorId: balcony.floorId, name: balcony.name, kind: balcony.kind, x: balcony.x, y: balcony.y, width: balcony.width, length: balcony.length })),
    facadeFeatures: project.facadeFeatures.map((feature) => ({ id: feature.id, kind: feature.kind, wallId: feature.wallId, offset: feature.offset, width: feature.width })),
    floors: project.floors,
    counts: {
      floors: project.floors.length,
      rooms: project.rooms.length,
      walls: project.walls.length,
      doors: project.openings.filter((opening) => opening.kind === "door").length,
      windows: project.openings.filter((opening) => opening.kind === "window").length,
      stairs: project.stairs.length,
      balconies: project.balconies.filter((item) => item.kind === "balcony").length,
      terraces: project.balconies.filter((item) => item.kind === "terrace").length,
      facadeFeatures: project.facadeFeatures.length,
    },
    metrics: projectMetrics(project),
    currentView: project.view,
    // A summary only: the full graph, including every entrance route, comes from inspect_circulation.
    circulation: (() => {
      const graph = buildCirculationGraph(project);
      return {
        mainEntranceOpeningId: graph.mainEntranceOpeningId,
        primaryEntryRoomId: graph.primaryEntryRoomId,
        hasExteriorAccess: graph.hasExteriorAccess,
        reachableRoomCount: graph.reachableRoomIds.length,
        disconnectedRoomIds: graph.disconnectedRoomIds,
        invalidDoorIds: graph.invalidDoorIds,
        invalidStairIds: graph.invalidStairIds,
      };
    })(),
    validationSummary: (() => {
      const report = validateLayout(project);
      return {
        status: report.status, issues: report.issueCount, errors: report.errors, warnings: report.warnings,
        codes: Array.from(new Set(report.issues.map((issue) => issue.code))),
      };
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
