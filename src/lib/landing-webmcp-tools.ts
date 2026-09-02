/**
 * The landing route's own WebMCP surface.
 *
 * The studio registers the full architectural catalog; `/` registers this much smaller
 * one, so an agent that lands on the marketing page can still read what the product is,
 * drive the presentation the visitor is looking at, and walk itself into the studio.
 * The definitions stay free of React and DOM APIs so the regression suite can execute them.
 */

/** The studio's tool surface. The WebMCP regression suite pins this to `createArchMorphTools().length`. */
export const STUDIO_TOOL_COUNT = 57;

export const LANDING_LAYER_KEYS = ["plan", "structure", "envelope", "dimensions"] as const;
export const LANDING_MODEL_VIEWS = ["complete", "section"] as const;

export type LandingLayer = (typeof LANDING_LAYER_KEYS)[number];
export type LandingModelView = (typeof LANDING_MODEL_VIEWS)[number];
export type LandingLayers = Record<LandingLayer, boolean>;
export type LandingState = {
  view: LandingModelView;
  layers: LandingLayers;
};

export const DEFAULT_LANDING_LAYERS: LandingLayers = {
  plan: true,
  structure: true,
  envelope: true,
  dimensions: true,
};

/** Agent-facing layer names. The title block abbreviates some of these for space. */
export const LANDING_LAYER_LABELS: Record<LandingLayer, string> = {
  plan: "Plan",
  structure: "Structure",
  envelope: "Envelope",
  dimensions: "Dimensions",
};

export const LANDING_PRODUCT = {
  name: "ArchMorph",
  tagline: "Human + Agent Architecture Studio",
  summary: "A browser-based architectural concept-design environment where a person and an agent shape one measured, inspectable building model.",
} as const;

/**
 * The specification schedule in the hero title block. The page renders these rows and
 * `inspect_landing_page` returns them, so what an agent reports matches what a visitor sees.
 */
export const LANDING_SCHEDULE = [
  { index: "01", term: "Agent tools", detail: "Typed architectural operations", value: String(STUDIO_TOOL_COUNT) },
  { index: "02", term: "Shared state", detail: "One canonical live model", value: "2D + 3D" },
  { index: "03", term: "Geometry", detail: "Measured, inspectable, validated", value: "Exact" },
] as const;

export type LandingToolRuntime = {
  getState: () => LandingState;
  setView: (view: LandingModelView) => void;
  setLayer: (layer: LandingLayer, visible: boolean) => void;
  openStudio: () => void;
};

export type LandingTool = WebMCPToolDefinition & {
  category: "inspect" | "present" | "navigate";
};

/** A fresh schema per tool, so no two definitions share one mutable object. */
function noInput() {
  return { type: "object", properties: {}, additionalProperties: false };
}

function requiredEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  values: readonly T[],
): T {
  const value = input[key];
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${key} must be one of: ${values.join(", ")}.`);
  }
  return value as T;
}

function requiredBoolean(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "boolean") throw new Error(`${key} must be true or false.`);
  return value;
}

/** A short human-readable record of one landing call, shown on the page beside the model. */
export function describeLandingCall(name: string, input: Record<string, unknown> = {}) {
  if (name === "set_landing_model_view") {
    const view = input.view === "section" ? "Section" : "Complete";
    return `${view} view`;
  }
  if (name === "set_landing_model_layer") {
    const layer = input.layer as LandingLayer;
    const label = LANDING_LAYER_LABELS[layer] ?? String(input.layer ?? "layer");
    return `${label} ${input.visible === false ? "hidden" : "shown"}`;
  }
  if (name === "inspect_landing_page") return "Page inspected";
  if (name === "open_studio") return "Opening studio";
  return name;
}

export function createLandingTools(runtime: LandingToolRuntime): LandingTool[] {
  const tools: LandingTool[] = [
    {
      name: "inspect_landing_page",
      description: "Inspect ArchMorph's landing page: what the product is, the claims on the page, how its live architectural model is currently presented, and which tools can change it. Use this before changing the landing model or opening the studio.",
      category: "inspect",
      inputSchema: noInput(),
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (_input, options) => {
        options?.signal.throwIfAborted();
        return {
          route: "/",
          product: LANDING_PRODUCT,
          schedule: LANDING_SCHEDULE.map((row) => ({ term: row.term, detail: row.detail, value: row.value })),
          state: runtime.getState(),
          capabilities: {
            landingTools: tools.length,
            studioTools: STUDIO_TOOL_COUNT,
            studio: ["inspect", "edit", "calculate", "validate", "navigate", "present"],
          },
          tools: tools.map((tool) => ({
            name: tool.name,
            category: tool.category,
            description: tool.description,
          })),
        };
      },
    },
    {
      name: "set_landing_model_view",
      description: "Set the landing page's live architectural model to the complete-building view or the exploded section view. This updates the same presentation visible to the user.",
      category: "present",
      inputSchema: {
        type: "object",
        properties: {
          view: {
            type: "string",
            enum: LANDING_MODEL_VIEWS,
            description: "The complete view shows the assembled building; the section view separates its levels.",
          },
        },
        required: ["view"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input, options) => {
        options?.signal.throwIfAborted();
        const view = requiredEnum(input, "view", LANDING_MODEL_VIEWS);
        const previous = runtime.getState().view;
        runtime.setView(view);
        return { changed: previous !== view, previousView: previous, state: runtime.getState() };
      },
    },
    {
      name: "set_landing_model_layer",
      description: "Show or hide one layer in the landing page's live architectural model. Available layers are plan, structure, envelope, and dimensions.",
      category: "present",
      inputSchema: {
        type: "object",
        properties: {
          layer: {
            type: "string",
            enum: LANDING_LAYER_KEYS,
            description: "The architectural drawing or building layer to change.",
          },
          visible: {
            type: "boolean",
            description: "Whether the selected layer should be visible.",
          },
        },
        required: ["layer", "visible"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input, options) => {
        options?.signal.throwIfAborted();
        const layer = requiredEnum(input, "layer", LANDING_LAYER_KEYS);
        const visible = requiredBoolean(input, "visible");
        const previous = runtime.getState().layers[layer];
        runtime.setLayer(layer, visible);
        return { changed: previous !== visible, layer, state: runtime.getState() };
      },
    },
    {
      name: "open_studio",
      description: `Open the ArchMorph design studio, where ${STUDIO_TOOL_COUNT} WebMCP tools can inspect, edit, measure, validate, navigate, and present the user's live architectural project. The landing tools are replaced by that catalog once the studio loads.`,
      category: "navigate",
      inputSchema: noInput(),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (_input, options) => {
        options?.signal.throwIfAborted();
        runtime.openStudio();
        return { navigating: true, route: "/studio", availableTools: STUDIO_TOOL_COUNT };
      },
    },
  ];

  return tools;
}
