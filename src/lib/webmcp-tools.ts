import {
  type ArchitectureOperation,
  type CameraPreset,
  type OperationOutcome,
  type PointRef,
  type Project,
  type RoomType,
  type ValidationReport,
  inspectFloor,
  inspectRoom,
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
      annotations: { destructiveHint: true },
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
        "Place a door on a valid wall. Offset is the door center's distance in feet from the wall start point.",
      inputSchema: {
        type: "object",
        properties: { wallId, offset: { type: "number" }, width: { type: "number", minimum: 2, maximum: 8, default: 3 } },
        required: ["wallId", "offset"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "add_opening",
        kind: "door",
        wallId: requiredString(input, "wallId"),
        offset: requiredNumber(input, "offset"),
        width: optionalNumber(input, "width"),
      }).result,
    },
    {
      name: "add_window",
      category: "edit",
      description:
        "Place a window on a valid wall. Offset is the window center's distance in feet from the wall start point.",
      inputSchema: {
        type: "object",
        properties: { wallId, offset: { type: "number" }, width: { type: "number", minimum: 2, maximum: 12, default: 4 } },
        required: ["wallId", "offset"],
        additionalProperties: false,
      },
      execute: (input) => runtime.perform({
        type: "add_opening",
        kind: "window",
        wallId: requiredString(input, "wallId"),
        offset: requiredNumber(input, "offset"),
        width: optionalNumber(input, "width"),
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
      }).result,
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
      annotations: { destructiveHint: true },
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
      description: "Add a simple rectangular staircase to a floor using position and dimensions in feet.",
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
        return { roomId: room.id, name: room.name, width: room.width, length: room.length, area: roomArea(room), unit: "sq ft" };
      },
    },
    {
      name: "calculate_total_area",
      category: "calculate",
      description:
        "Calculate current floor coverage and total constructed area across all floors, using union area so overlaps are not double-counted.",
      inputSchema: emptyObject,
      annotations: readOnly,
      execute: () => {
        const metrics = projectMetrics(runtime.getProject());
        return { floorCoveredArea: metrics.floorCoveredArea, totalConstructedArea: metrics.totalConstructedArea, unit: metrics.unit };
      },
    },
    {
      name: "calculate_open_area",
      category: "calculate",
      description: "Calculate the current unbuilt ground-plot area and site coverage percentage.",
      inputSchema: emptyObject,
      annotations: readOnly,
      execute: () => {
        const metrics = projectMetrics(runtime.getProject());
        return { plotArea: metrics.plotArea, openArea: metrics.openArea, coveragePercent: metrics.coveragePercent, unit: metrics.unit };
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
        "Analyze the live layout for room overlaps, plot and setback violations, invalid openings, wall bounds, and rooms with no obvious door access. Returns structured, correctable findings—not final code certification.",
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
