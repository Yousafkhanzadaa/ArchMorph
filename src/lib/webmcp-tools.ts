import {
  type ArchitectureOperation,
  type CameraPreset,
  type OperationOutcome,
  type PointRef,
  type Project,
  type RoomType,
  type ValidationReport,
  buildCirculationGraph,
  inspectFloor,
  inspectOpening,
  inspectRoom,
  inspectWall,
  measureDistance,
  projectInspection,
  projectMetrics,
  roomArea,
  validateLayout,
} from "./architecture";

export type ToolRuntime = {
  getProject: () => Project;
  perform: (operation: ArchitectureOperation) => OperationOutcome;
  captureSnapshot: (options?: { download?: boolean }) => Promise<Record<string, unknown>>;
  exportPlan: (format: "json" | "svg", download?: boolean) => Record<string, unknown>;
  noteActivity: (description: string, operation: string) => void;
};

export type ArchMorphTool = WebMCPToolDefinition & {
  category: "inspect" | "edit" | "calculate" | "present";
};

const emptyObject = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const floorId = {
  type: "string",
  description: "Stable floor identifier returned by inspect_project.",
};

const roomId = {
  type: "string",
  description: "Stable room identifier returned by inspect_floor or create_room.",
};

const wallId = {
  type: "string",
  description: "Stable wall identifier returned by inspect_floor, inspect_room, or add_wall.",
};

const openingId = {
  type: "string",
  description: "Stable door or window identifier returned by inspect_floor.",
};

function requiredString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required.`);
  return value;
}

function requiredNumber(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`${key} must be a number.`);
  return value;
}

function optionalNumber(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`${key} must be a number.`);
  return value;
}

function optionalString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  return value;
}

function optionalBoolean(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${key} must be true or false.`);
  return value;
}

function pointReference(input: unknown, label: string): PointRef {
  if (!input || typeof input !== "object") throw new Error(`${label} must be a coordinate or element reference.`);
  const value = input as Record<string, unknown>;
  if (typeof value.elementId === "string") {
    return {
      elementId: value.elementId,
      anchor: value.anchor as "center" | "start" | "end" | undefined,
    };
  }
  if (typeof value.x === "number" && typeof value.y === "number") return { x: value.x, y: value.y };
  throw new Error(`${label} requires either elementId or x and y coordinates.`);
}

const readOnly = { readOnlyHint: true };

export function createArchMorphTools(runtime: ToolRuntime): ArchMorphTool[] {
  return [
    {
      name: "inspect_project",
      category: "inspect",
      description:
        "Inspect the complete live ArchMorph project: plot, floors, element counts, current metrics, view state, and validation summary. Call this before planning edits.",
      inputSchema: emptyObject,
      annotations: readOnly,
      execute: () => projectInspection(runtime.getProject()),
    },
    {
      name: "inspect_plot",
      category: "inspect",
      description:
        "Inspect the live plot dimensions, setbacks, buildable envelope, available area, orientation, and current ground-floor coverage.",
      inputSchema: emptyObject,
      annotations: readOnly,
      execute: () => {
        const project = runtime.getProject();
        return { plot: project.plot, metrics: projectMetrics(project), unit: project.unit };
      },
    },
    {
      name: "inspect_floor",
      category: "inspect",
      description:
        "Inspect all rooms, room-boundary and independent walls, doors, windows, stairs, measurements, and validation findings on one floor.",
      inputSchema: {
        type: "object",
        properties: { floorId },
        required: ["floorId"],
        additionalProperties: false,
      },
      annotations: readOnly,
      execute: (input) => inspectFloor(runtime.getProject(), requiredString(input, "floorId")),
    },
    {
      name: "set_plot_orientation",
      category: "edit",
      description:
        "Set the cardinal direction faced by the plot's front/access edge. The site plan and north arrow update immediately without changing plot dimensions or setbacks.",
      inputSchema: {
        type: "object",
        properties: {
          orientation: {
            type: "string",
            enum: ["North", "East", "South", "West"],
            description: "Cardinal direction faced by the front/access edge of the plot.",
          },
        },
        required: ["orientation"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "set_plot_orientation",
        orientation: requiredString(input, "orientation") as Project["plot"]["orientation"],
      }).result,
    },
    {
      name: "inspect_room",
      category: "inspect",
      description:
        "Inspect one room's exact geometry, area, perimeter, boundary walls, openings, and directly adjacent rooms.",
      inputSchema: {
        type: "object",
        properties: { roomId },
        required: ["roomId"],
        additionalProperties: false,
      },
      annotations: readOnly,
      execute: (input) => inspectRoom(runtime.getProject(), requiredString(input, "roomId")),
    },
    {
      name: "inspect_wall",
      category: "inspect",
      description: "Inspect one canonical physical wall, its endpoints, length, exterior/interior status, adjacent rooms, connected wall segments, and hosted openings.",
      inputSchema: { type: "object", properties: { wallId }, required: ["wallId"], additionalProperties: false },
      annotations: readOnly,
      execute: (input) => inspectWall(runtime.getProject(), requiredString(input, "wallId")),
    },
    {
      name: "inspect_opening",
      category: "inspect",
      description: "Inspect one door or window together with its full architectural configuration and canonical host wall.",
      inputSchema: { type: "object", properties: { openingId }, required: ["openingId"], additionalProperties: false },
      annotations: readOnly,
      execute: (input) => inspectOpening(runtime.getProject(), requiredString(input, "openingId")),
    },
    {
      name: "inspect_circulation",
      category: "inspect",
      description: "Inspect the traversable room graph, main entrance, room-to-room door edges, stair edges, unreachable rooms, and invalid circulation elements.",
      inputSchema: emptyObject,
      annotations: readOnly,
      execute: () => buildCirculationGraph(runtime.getProject()),
    },
    {
      name: "create_room",
      category: "edit",
      description:
        "Create one rectangular residential room on a floor using real dimensions in feet. The room and its four boundary walls appear immediately in the shared editor.",
      inputSchema: {
        type: "object",
        properties: {
          floorId,
          name: { type: "string", description: "Visible room name, such as Bedroom 2." },
          roomType: {
            type: "string",
            enum: ["Living Room", "Kitchen", "Bedroom", "Bathroom", "Garage", "Office", "Dining Room", "Storage", "Courtyard", "Custom"],
          },
          x: { type: "number", description: "Horizontal position in feet from the plot's left edge." },
          y: { type: "number", description: "Position in feet from the front plot boundary." },
          width: { type: "number", minimum: 3, description: "Room width in feet." },
          length: { type: "number", minimum: 3, description: "Room length in feet." },
        },
        required: ["floorId", "name", "roomType", "x", "y", "width", "length"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "create_room",
        floorId: requiredString(input, "floorId"),
        name: requiredString(input, "name"),
        roomType: requiredString(input, "roomType") as RoomType,
        x: requiredNumber(input, "x"),
        y: requiredNumber(input, "y"),
        width: requiredNumber(input, "width"),
        length: requiredNumber(input, "length"),
      }).result,
    },
    {
      name: "move_room",
      category: "edit",
      description:
        "Move one existing room to an exact x/y position in feet. Its walls, openings, metrics, 2D plan, and 3D model update from the same transaction.",
      inputSchema: {
        type: "object",
        properties: {
          roomId,
          x: { type: "number", description: "New left-edge position in feet." },
          y: { type: "number", description: "New front-edge position in feet." },
        },
        required: ["roomId", "x", "y"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "move_room",
        roomId: requiredString(input, "roomId"),
        x: requiredNumber(input, "x"),
        y: requiredNumber(input, "y"),
      }).result,
    },
    {
      name: "resize_room",
      category: "edit",
      description:
        "Resize one room to an exact width and length in feet while preserving its current position.",
      inputSchema: {
        type: "object",
        properties: {
          roomId,
          width: { type: "number", minimum: 3 },
          length: { type: "number", minimum: 3 },
        },
        required: ["roomId", "width", "length"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "resize_room",
        roomId: requiredString(input, "roomId"),
        width: requiredNumber(input, "width"),
        length: requiredNumber(input, "length"),
      }).result,
    },
    {
      name: "delete_room",
      category: "edit",
      description:
        "Delete one room and its derived boundary walls and openings. The transaction is recorded and can be undone in the editor.",
      inputSchema: {
        type: "object",
        properties: { roomId },
        required: ["roomId"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "delete_room",
        roomId: requiredString(input, "roomId"),
      }).result,
    },
    {
      name: "add_wall",
      category: "edit",
      description:
        "Add one straight independent wall segment using start and end coordinates in feet.",
      inputSchema: {
        type: "object",
        properties: {
          floorId,
          x1: { type: "number" }, y1: { type: "number" },
          x2: { type: "number" }, y2: { type: "number" },
          thickness: { type: "number", minimum: 0.2, maximum: 2, default: 0.5 },
        },
        required: ["floorId", "x1", "y1", "x2", "y2"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "add_wall",
        floorId: requiredString(input, "floorId"),
        x1: requiredNumber(input, "x1"), y1: requiredNumber(input, "y1"),
        x2: requiredNumber(input, "x2"), y2: requiredNumber(input, "y2"),
        thickness: optionalNumber(input, "thickness"),
      }).result,
    },
    {
      name: "move_wall",
      category: "edit",
      description:
        "Move an independent wall by a horizontal and vertical delta in feet. Room-controlled walls must be changed by moving or resizing their room.",
      inputSchema: {
        type: "object",
        properties: {
          wallId,
          dx: { type: "number", default: 0 },
          dy: { type: "number", default: 0 },
        },
        required: ["wallId", "dx", "dy"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "move_wall",
        wallId: requiredString(input, "wallId"),
        dx: requiredNumber(input, "dx"),
        dy: requiredNumber(input, "dy"),
      }).result,
    },
    {
      name: "add_door",
      category: "edit",
      description:
        "Place a configured door on a canonical wall. Offset is the door center's distance in feet from the wall start point; the same handing, swing, and state drive 2D and 3D.",
      inputSchema: {
        type: "object",
        properties: {
          wallId,
          offset: { type: "number" },
          width: { type: "number", minimum: 2, maximum: 8, default: 3 },
          height: { type: "number", minimum: 6, maximum: 9, default: 7 },
          hingeSide: { type: "string", enum: ["start", "end"], default: "start" },
          handing: { type: "string", enum: ["left", "right"], default: "left" },
          swingDirection: { type: "string", enum: ["inward", "outward"], default: "inward" },
          state: { type: "string", enum: ["open", "closed"], default: "open" },
        },
        required: ["wallId", "offset"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "add_opening",
        kind: "door",
        wallId: requiredString(input, "wallId"),
        offset: requiredNumber(input, "offset"),
        width: optionalNumber(input, "width"),
        height: optionalNumber(input, "height"),
        hingeSide: optionalString(input, "hingeSide") as "start" | "end" | undefined,
        handing: optionalString(input, "handing") as "left" | "right" | undefined,
        swingDirection: optionalString(input, "swingDirection") as "inward" | "outward" | undefined,
        state: optionalString(input, "state") as "open" | "closed" | undefined,
      }).result,
    },
    {
      name: "add_window",
      category: "edit",
      description:
        "Place a configured window on a canonical wall. Width, height, sill, type, operation, and glazing are shared by the 2D and 3D representations.",
      inputSchema: {
        type: "object",
        properties: {
          wallId,
          offset: { type: "number" },
          width: { type: "number", minimum: 2, maximum: 12, default: 4 },
          height: { type: "number", minimum: 1, maximum: 8, default: 4 },
          sillHeight: { type: "number", minimum: 0, maximum: 8, default: 3 },
          windowType: { type: "string", enum: ["fixed", "casement", "sliding", "awning"], default: "fixed" },
          operable: { type: "boolean", default: false },
          glazing: { type: "string", enum: ["clear", "low-e", "privacy"], default: "clear" },
          solarHeatGainCoefficient: { type: "number", minimum: 0, maximum: 1, description: "Concept SHGC input; verify against a rated product." },
          visibleTransmittance: { type: "number", minimum: 0, maximum: 1, description: "Concept visible-transmittance input; verify against a rated product." },
          uFactor: { type: "number", minimum: 0.1, maximum: 2, description: "Concept U-factor in Btu/(h·ft²·°F); verify against a rated product." },
        },
        required: ["wallId", "offset"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "add_opening",
        kind: "window",
        wallId: requiredString(input, "wallId"),
        offset: requiredNumber(input, "offset"),
        width: optionalNumber(input, "width"),
        height: optionalNumber(input, "height"),
        sillHeight: optionalNumber(input, "sillHeight"),
        windowType: optionalString(input, "windowType") as "fixed" | "casement" | "sliding" | "awning" | undefined,
        operable: optionalBoolean(input, "operable"),
        glazing: optionalString(input, "glazing") as "clear" | "low-e" | "privacy" | undefined,
        solarHeatGainCoefficient: optionalNumber(input, "solarHeatGainCoefficient"),
        visibleTransmittance: optionalNumber(input, "visibleTransmittance"),
        uFactor: optionalNumber(input, "uFactor"),
      }).result,
    },
    {
      name: "update_opening",
      category: "edit",
      description:
        "Move or resize a door or window using the same opening state consumed by both the 2D plan and exact 3D wall geometry. Omitted properties remain unchanged.",
      inputSchema: {
        type: "object",
        properties: {
          openingId,
          offset: { type: "number", description: "Opening center distance from the wall start, in feet." },
          width: { type: "number", minimum: 0.5, maximum: 16 },
          height: { type: "number", minimum: 0.5, maximum: 12 },
          sillHeight: { type: "number", minimum: 0, maximum: 10 },
          hingeSide: { type: "string", enum: ["start", "end"] },
          handing: { type: "string", enum: ["left", "right"] },
          swingDirection: { type: "string", enum: ["inward", "outward"] },
          state: { type: "string", enum: ["open", "closed"] },
          windowType: { type: "string", enum: ["fixed", "casement", "sliding", "awning"] },
          operable: { type: "boolean" },
          glazing: { type: "string", enum: ["clear", "low-e", "privacy"] },
          solarHeatGainCoefficient: { type: "number", minimum: 0, maximum: 1 },
          visibleTransmittance: { type: "number", minimum: 0, maximum: 1 },
          uFactor: { type: "number", minimum: 0.1, maximum: 2 },
        },
        required: ["openingId"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "update_opening",
        openingId: requiredString(input, "openingId"),
        offset: optionalNumber(input, "offset"),
        width: optionalNumber(input, "width"),
        height: optionalNumber(input, "height"),
        sillHeight: optionalNumber(input, "sillHeight"),
        hingeSide: optionalString(input, "hingeSide") as "start" | "end" | undefined,
        handing: optionalString(input, "handing") as "left" | "right" | undefined,
        swingDirection: optionalString(input, "swingDirection") as "inward" | "outward" | undefined,
        state: optionalString(input, "state") as "open" | "closed" | undefined,
        windowType: optionalString(input, "windowType") as "fixed" | "casement" | "sliding" | "awning" | undefined,
        operable: optionalBoolean(input, "operable"),
        glazing: optionalString(input, "glazing") as "clear" | "low-e" | "privacy" | undefined,
        solarHeatGainCoefficient: optionalNumber(input, "solarHeatGainCoefficient"),
        visibleTransmittance: optionalNumber(input, "visibleTransmittance"),
        uFactor: optionalNumber(input, "uFactor"),
      }).result,
    },
    {
      name: "set_door_properties",
      category: "edit",
      description: "Set architectural door width, height, hinge, handing, swing direction, and open/closed state without creating a separate rendering model.",
      inputSchema: {
        type: "object",
        properties: {
          openingId,
          width: { type: "number", minimum: 2, maximum: 8 },
          height: { type: "number", minimum: 6, maximum: 9 },
          hingeSide: { type: "string", enum: ["start", "end"] },
          handing: { type: "string", enum: ["left", "right"] },
          swingDirection: { type: "string", enum: ["inward", "outward"] },
          state: { type: "string", enum: ["open", "closed"] },
        },
        required: ["openingId"],
        additionalProperties: false,
      },
      execute: (input) => {
        const id = requiredString(input, "openingId");
        const opening = runtime.getProject().openings.find((item) => item.id === id);
        if (opening?.kind !== "door") throw new Error(`${id} is not a door.`);
        return runtime.perform({
          type: "update_opening",
          openingId: id,
          width: optionalNumber(input, "width"),
          height: optionalNumber(input, "height"),
          hingeSide: optionalString(input, "hingeSide") as "start" | "end" | undefined,
          handing: optionalString(input, "handing") as "left" | "right" | undefined,
          swingDirection: optionalString(input, "swingDirection") as "inward" | "outward" | undefined,
          state: optionalString(input, "state") as "open" | "closed" | undefined,
        }).result;
      },
    },
    {
      name: "rehost_door",
      category: "edit",
      description: "Move an existing door onto another compatible canonical wall at an exact center offset.",
      inputSchema: { type: "object", properties: { openingId, wallId, offset: { type: "number" } }, required: ["openingId", "wallId", "offset"], additionalProperties: false },
      execute: (input) => {
        const id = requiredString(input, "openingId");
        if (runtime.getProject().openings.find((item) => item.id === id)?.kind !== "door") throw new Error(`${id} is not a door.`);
        return runtime.perform({ type: "rehost_opening", openingId: id, wallId: requiredString(input, "wallId"), offset: requiredNumber(input, "offset") }).result;
      },
    },
    {
      name: "set_window_properties",
      category: "edit",
      description: "Set window size, sill height, type, operability, and concept-stage NFRC-style glazing inputs in the shared architectural model.",
      inputSchema: {
        type: "object",
        properties: {
          openingId,
          width: { type: "number", minimum: 1, maximum: 16 },
          height: { type: "number", minimum: 1, maximum: 8 },
          sillHeight: { type: "number", minimum: 0, maximum: 8 },
          windowType: { type: "string", enum: ["fixed", "casement", "sliding", "awning"] },
          operable: { type: "boolean" },
          glazing: { type: "string", enum: ["clear", "low-e", "privacy"] },
          solarHeatGainCoefficient: { type: "number", minimum: 0, maximum: 1 },
          visibleTransmittance: { type: "number", minimum: 0, maximum: 1 },
          uFactor: { type: "number", minimum: 0.1, maximum: 2 },
        },
        required: ["openingId"],
        additionalProperties: false,
      },
      execute: (input) => {
        const id = requiredString(input, "openingId");
        const opening = runtime.getProject().openings.find((item) => item.id === id);
        if (opening?.kind !== "window") throw new Error(`${id} is not a window.`);
        return runtime.perform({
          type: "update_opening",
          openingId: id,
          width: optionalNumber(input, "width"),
          height: optionalNumber(input, "height"),
          sillHeight: optionalNumber(input, "sillHeight"),
          windowType: optionalString(input, "windowType") as "fixed" | "casement" | "sliding" | "awning" | undefined,
          operable: optionalBoolean(input, "operable"),
          glazing: optionalString(input, "glazing") as "clear" | "low-e" | "privacy" | undefined,
          solarHeatGainCoefficient: optionalNumber(input, "solarHeatGainCoefficient"),
          visibleTransmittance: optionalNumber(input, "visibleTransmittance"),
          uFactor: optionalNumber(input, "uFactor"),
        }).result;
      },
    },
    {
      name: "rehost_window",
      category: "edit",
      description: "Move an existing window onto another compatible canonical wall at an exact center offset.",
      inputSchema: { type: "object", properties: { openingId, wallId, offset: { type: "number" } }, required: ["openingId", "wallId", "offset"], additionalProperties: false },
      execute: (input) => {
        const id = requiredString(input, "openingId");
        if (runtime.getProject().openings.find((item) => item.id === id)?.kind !== "window") throw new Error(`${id} is not a window.`);
        return runtime.perform({ type: "rehost_opening", openingId: id, wallId: requiredString(input, "wallId"), offset: requiredNumber(input, "offset") }).result;
      },
    },
    {
      name: "set_exact_dimension",
      category: "edit",
      description: "Set one exact dimension or position on a room, opening, or the plot. The change uses the same operation pipeline as manual inspector input.",
      inputSchema: {
        type: "object",
        properties: {
          elementId: { type: "string", description: "Room/opening ID, or the literal 'plot'." },
          property: { type: "string", enum: ["width", "length", "x", "y", "offset", "height", "sillHeight"] },
          value: { type: "number", description: "Exact value in feet." },
        },
        required: ["elementId", "property", "value"],
        additionalProperties: false,
      },
      execute: (input) => {
        const elementId = requiredString(input, "elementId");
        const property = requiredString(input, "property");
        const value = requiredNumber(input, "value");
        const project = runtime.getProject();
        if (elementId === "plot") {
          if (property !== "width" && property !== "length") throw new Error("Plot supports width or length.");
          return runtime.perform({ type: "set_plot", [property]: value }).result;
        }
        const room = project.rooms.find((item) => item.id === elementId);
        if (room) {
          if (property === "width" || property === "length") return runtime.perform({ type: "resize_room", roomId: room.id, width: property === "width" ? value : room.width, length: property === "length" ? value : room.length }).result;
          if (property === "x" || property === "y") return runtime.perform({ type: "move_room", roomId: room.id, x: property === "x" ? value : room.x, y: property === "y" ? value : room.y }).result;
          throw new Error("Rooms support width, length, x, or y.");
        }
        const opening = project.openings.find((item) => item.id === elementId);
        if (opening && ["width", "offset", "height", "sillHeight"].includes(property)) {
          return runtime.perform({ type: "update_opening", openingId: opening.id, [property]: value }).result;
        }
        throw new Error(`Element ${elementId} does not support ${property}.`);
      },
    },
    {
      name: "delete_opening",
      category: "edit",
      description:
        "Delete a door or window from the shared plan. Its 2D symbol, real 3D wall cutout, frame or panel, and navigable opening update together.",
      inputSchema: {
        type: "object",
        properties: { openingId },
        required: ["openingId"],
        additionalProperties: false,
      },
      execute: (input) => {
        const id = requiredString(input, "openingId");
        const opening = runtime.getProject().openings.find((item) => item.id === id);
        if (!opening) throw new Error(`Opening ${id} does not exist.`);
        return runtime.perform({ type: "delete_element", elementId: id }).result;
      },
    },
    {
      name: "add_stairs",
      category: "edit",
      description: "Add a straight stair flight between adjacent floors. The same footprint, connection, and dimensions drive plan, 3D, validation, and Walk Mode.",
      inputSchema: {
        type: "object",
        properties: {
          floorId,
          x: { type: "number" }, y: { type: "number" },
          width: { type: "number", minimum: 3 }, length: { type: "number", minimum: 6 },
          direction: { type: "string", enum: ["up", "down"], default: "up" },
        },
        required: ["floorId", "x", "y", "width", "length"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "add_stairs",
        floorId: requiredString(input, "floorId"),
        x: requiredNumber(input, "x"), y: requiredNumber(input, "y"),
        width: requiredNumber(input, "width"), length: requiredNumber(input, "length"),
        direction: input.direction as "up" | "down" | undefined,
      }).result,
    },
    {
      name: "update_stairs",
      category: "edit",
      description: "Move or resize an existing straight stair flight, or reverse which adjacent floor it connects to.",
      inputSchema: {
        type: "object",
        properties: {
          stairId: { type: "string", description: "Stable staircase ID." },
          x: { type: "number" }, y: { type: "number" },
          width: { type: "number", minimum: 3 }, length: { type: "number", minimum: 6 },
          direction: { type: "string", enum: ["up", "down"] },
        },
        required: ["stairId"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "update_stairs",
        stairId: requiredString(input, "stairId"),
        x: optionalNumber(input, "x"), y: optionalNumber(input, "y"),
        width: optionalNumber(input, "width"), length: optionalNumber(input, "length"),
        direction: optionalString(input, "direction") as "up" | "down" | undefined,
      }).result,
    },
    {
      name: "create_floor",
      category: "edit",
      description:
        "Create the next building storey and make it active. Use only after the ground-floor layout is established.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          height: { type: "number", minimum: 7, maximum: 16, default: 9 },
        },
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "create_floor",
        name: typeof input.name === "string" ? input.name : undefined,
        height: optionalNumber(input, "height"),
      }).result,
    },
    {
      name: "calculate_room_area",
      category: "calculate",
      description: "Calculate the exact rectangular area and dimensions of one room from the live project model.",
      inputSchema: { type: "object", properties: { roomId }, required: ["roomId"], additionalProperties: false },
      annotations: readOnly,
      execute: (input) => {
        const room = runtime.getProject().rooms.find((item) => item.id === requiredString(input, "roomId"));
        if (!room) throw new Error("Room does not exist.");
        return { roomId: room.id, name: room.name, width: room.width, length: room.length, netRoomArea: roomArea(room), area: roomArea(room), areaDefinition: "Usable internal rectangular area excluding wall thickness. The area alias is retained for compatibility.", unit: "sq ft" };
      },
    },
    {
      name: "calculate_total_area",
      category: "calculate",
      description:
        "Return explicitly named net and gross architectural areas for the active floor and whole building, with definitions that avoid ambiguous coverage values.",
      inputSchema: emptyObject,
      annotations: readOnly,
      execute: () => {
        const metrics = projectMetrics(runtime.getProject());
        return {
          totalNetFloorArea: metrics.totalNetFloorArea,
          totalNetBuildingArea: metrics.totalNetBuildingArea,
          grossCoveredArea: metrics.grossCoveredArea,
          totalGrossCoveredArea: metrics.totalGrossCoveredArea,
          plotArea: metrics.plotArea,
          definitions: metrics.measurementDefinitions,
          compatibility: {
            floorCoveredArea: metrics.floorCoveredArea,
            totalConstructedArea: metrics.totalConstructedArea,
            note: "Legacy union-of-room-footprints values retained for existing clients; prefer the explicitly named net/gross fields.",
          },
          unit: metrics.unit,
        };
      },
    },
    {
      name: "calculate_open_area",
      category: "calculate",
      description: "Calculate open site area outside the gross ground-floor building footprint and the gross site coverage percentage.",
      inputSchema: emptyObject,
      annotations: readOnly,
      execute: () => {
        const metrics = projectMetrics(runtime.getProject());
        return { plotArea: metrics.plotArea, openSiteArea: metrics.openSiteArea, grossCoveragePercent: metrics.coveragePercent, definition: metrics.measurementDefinitions.openSiteArea, unit: metrics.unit };
      },
    },
    {
      name: "measure_distance",
      category: "calculate",
      description:
        "Measure exact straight, horizontal, and vertical distances between two coordinates or element centers/endpoints.",
      inputSchema: {
        type: "object",
        properties: {
          from: {
            type: "object",
            description: "Either {x,y} or {elementId, anchor}. All coordinates are feet.",
            properties: { x: { type: "number" }, y: { type: "number" }, elementId: { type: "string" }, anchor: { type: "string", enum: ["center", "start", "end"] } },
            additionalProperties: false,
          },
          to: {
            type: "object",
            description: "Either {x,y} or {elementId, anchor}. All coordinates are feet.",
            properties: { x: { type: "number" }, y: { type: "number" }, elementId: { type: "string" }, anchor: { type: "string", enum: ["center", "start", "end"] } },
            additionalProperties: false,
          },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
      annotations: readOnly,
      execute: (input) => measureDistance(runtime.getProject(), pointReference(input.from, "from"), pointReference(input.to, "to")),
    },
    {
      name: "validate_layout",
      category: "calculate",
      description:
        "Analyze geometry, canonical openings, exterior access, main-entrance reachability, disconnected room groups, and stair connections. Returns structured, correctable findings—not final code certification.",
      inputSchema: {
        type: "object",
        properties: { floorId: { ...floorId, description: "Optional floor to validate; omit to validate the entire project." } },
        additionalProperties: false,
      },
      execute: (input) => {
        const report: ValidationReport = validateLayout(runtime.getProject(), typeof input.floorId === "string" ? input.floorId : undefined);
        runtime.noteActivity(`Agent validated the layout · ${report.issueCount} ${report.issueCount === 1 ? "issue" : "issues"}`, "validate_layout");
        return report;
      },
    },
    {
      name: "switch_view",
      category: "present",
      description: "Visibly switch the shared ArchMorph canvas between 2D floor-plan and 3D building modes.",
      inputSchema: {
        type: "object",
        properties: { mode: { type: "string", enum: ["2d", "3d"] } },
        required: ["mode"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({ type: "switch_view", mode: requiredString(input, "mode") as "2d" | "3d" }).result,
    },
    {
      name: "set_camera",
      category: "present",
      description: "Switch to 3D and visibly move the camera to a standard architectural view.",
      inputSchema: {
        type: "object",
        properties: { preset: { type: "string", enum: ["front", "rear", "left", "right", "top", "front-left", "front-right"] } },
        required: ["preset"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({ type: "set_camera", preset: requiredString(input, "preset") as CameraPreset }).result,
    },
    {
      name: "set_navigation_mode",
      category: "present",
      description:
        "Switch the live 3D canvas between exterior orbit controls and first-person walkthrough controls. Optionally enter a specific room by stable ID.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["orbit", "walk"] },
          roomId: { type: "string", description: "Optional room to start inside when entering walk mode." },
        },
        required: ["mode"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "set_navigation_mode",
        mode: requiredString(input, "mode") as "orbit" | "walk",
        roomId: typeof input.roomId === "string" ? input.roomId : undefined,
      }).result,
    },
    {
      name: "focus_element",
      category: "present",
      description: "Visibly focus the current 2D or 3D view on a room, wall, door, window, or stair by stable ID. Omit the ID to fit the whole project.",
      inputSchema: {
        type: "object",
        properties: { elementId: { type: "string" } },
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({ type: "focus_element", elementId: typeof input.elementId === "string" ? input.elementId : undefined }).result,
    },
    {
      name: "take_snapshot",
      category: "present",
      description:
        "Capture the current live 2D plan or 3D canvas after any requested view and camera changes. Returns image metadata and a PNG data URL.",
      inputSchema: {
        type: "object",
        properties: { download: { type: "boolean", default: false, description: "Also download the PNG in the human's browser." } },
        additionalProperties: false,
      },
      execute: (input) => runtime.captureSnapshot({ download: input.download === true }),
    },
    {
      name: "export_plan",
      category: "present",
      description:
        "Export the current shared design as structured ArchMorph JSON or a clean SVG floor plan. The export identifies the exact project version.",
      inputSchema: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["json", "svg"], default: "json" },
          download: { type: "boolean", default: false },
        },
        additionalProperties: false,
      },
      execute: (input) => runtime.exportPlan(input.format === "svg" ? "svg" : "json", input.download === true),
    },
  ];
}
