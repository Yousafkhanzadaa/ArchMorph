"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  DEFAULT_LANDING_LAYERS,
  LANDING_PRODUCT,
  LANDING_SCHEDULE,
  createLandingTools,
  describeLandingCall,
  type LandingLayer,
  type LandingLayers,
  type LandingModelView,
} from "@/lib/landing-webmcp-tools";
import HeroBuilding, { type HeroMode, type HeroSignal } from "./HeroBuilding";
import styles from "./Hero.module.css";

const ACTOR: Record<HeroSignal["actor"], string> = { system: "Sys", human: "Hum", agent: "Agt" };

/** The three level datums. 0% sits on the lower rule, 100% on the rule under the title. */
const LEVELS = [
  { label: "+7200", offset: "100%" },
  { label: "+3600", offset: "50%" },
  { label: "±0", offset: "0%" },
];

/** Whether a compatible browser took the page-scoped catalog, or the page is only holding it ready. */
type ToolStatus = "registering" | "native" | "preview" | "unavailable";

const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  registering: "Registering",
  native: "Agent tools live",
  preview: "Agent tools ready",
  unavailable: "Agent tools unavailable",
};

/** The last call through the landing pipeline, whichever actor made it. */
type LandingActivity = { actor: "human" | "agent"; detail: string };

const OPENING: HeroSignal = {
  actor: "system",
  code: "01",
  note: "Site set out",
  value: "3550",
  progress: 0,
  elevation: 0,
};

export default function Hero() {
  const router = useRouter();
  const [hovered, setHovered] = useState<"studio" | "section" | null>(null);
  const [sectionLocked, setSectionLocked] = useState(false);
  const [layers, setLayers] = useState<LandingLayers>(() => ({ ...DEFAULT_LANDING_LAYERS }));
  const [signal, setSignal] = useState<HeroSignal>(OPENING);
  const [toolStatus, setToolStatus] = useState<ToolStatus>("registering");
  const [activity, setActivity] = useState<LandingActivity | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const pending = useRef(0);
  const sectionLockedRef = useRef(false);
  const layersRef = useRef<LandingLayers>({ ...DEFAULT_LANDING_LAYERS });

  let mode: HeroMode = "idle";
  if (hovered === "studio") mode = "studio";
  else if (hovered === "section" || sectionLocked) mode = "section";


  const handleSignal = useCallback((next: HeroSignal) => setSignal(next), []);

  const getLandingState = useCallback(() => ({
    view: (sectionLockedRef.current ? "section" : "complete") as LandingModelView,
    layers: { ...layersRef.current },
  }), []);

  const setLandingView = useCallback((view: LandingModelView) => {
    const locked = view === "section";
    sectionLockedRef.current = locked;
    setSectionLocked(locked);
  }, []);

  const setLandingLayer = useCallback((layer: LandingLayer, visible: boolean) => {
    const next = { ...layersRef.current, [layer]: visible };
    layersRef.current = next;
    setLayers(next);
  }, []);

  // eslint-disable-next-line react-hooks/refs -- the runtime closures read the refs when a tool runs, never during render.
  const landingTools = useMemo(() => createLandingTools({
    getState: getLandingState,
    setView: setLandingView,
    setLayer: setLandingLayer,
    openStudio: () => router.push("/studio"),
  }), [getLandingState, router, setLandingLayer, setLandingView]);

  // One pipeline. A click on the page and a WebMCP call run the same definition,
  // so the title block can attribute whichever of the two moved the model.
  const runLandingTool = useCallback(async (
    name: string,
    input: Record<string, unknown> = {},
    actor: LandingActivity["actor"] = "agent",
    options?: { signal: AbortSignal },
  ) => {
    const definition = landingTools.find((tool) => tool.name === name);
    if (!definition) throw new Error(`Unknown ArchMorph landing tool: ${name}`);
    const output = await definition.execute(input, options);
    if (definition.annotations?.readOnlyHint !== true) {
      setActivity({ actor, detail: describeLandingCall(name, input) });
    }
    return output;
  }, [landingTools]);

  const toggleLandingView = useCallback(() => {
    void runLandingTool(
      "set_landing_model_view",
      { view: sectionLockedRef.current ? "complete" : "section" },
      "human",
    );
  }, [runLandingTool]);

  const toggleLandingLayer = useCallback((layer: LandingLayer) => {
    void runLandingTool(
      "set_landing_model_layer",
      { layer, visible: !layersRef.current[layer] },
      "human",
    );
  }, [runLandingTool]);

  useEffect(() => {
    let disposed = false;
    const registration = new AbortController();
    const register = async () => {
      const modelContext = document.modelContext;
      if (!modelContext?.registerTool) {
        setToolStatus("preview");
        return;
      }
      try {
        setToolStatus("registering");
        for (const tool of landingTools) {
          if (disposed) return;
          await modelContext.registerTool({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
            execute: (input, options) => runLandingTool(tool.name, input, "agent", options),
          }, { signal: registration.signal });
        }
        if (!disposed) setToolStatus("native");
      } catch (error) {
        if (disposed || registration.signal.aborted) return;
        // Release any tools registered before the rejection, so an agent never sees a partial catalog.
        registration.abort(error);
        setToolStatus("unavailable");
      }
    };
    window.__archMorphLanding = {
      getState: getLandingState,
      listTools: () => landingTools.map((tool) => tool.name),
      invokeTool: (name, input) => runLandingTool(name, input ?? {}, "agent"),
    };
    void register();
    // Aborting the registration signal hands the tools back when the visitor leaves the route.
    return () => {
      disposed = true;
      registration.abort();
      delete window.__archMorphLanding;
    };
  }, [getLandingState, landingTools, runLandingTool]);

  // Isolated, so a new reading from the model never re-renders the model itself.
  const model = useMemo(
    () => <HeroBuilding mode={mode} layers={layers} onLayerChange={toggleLandingLayer} onSignal={handleSignal} />,
    [handleSignal, layers, mode, toggleLandingLayer],
  );

  const trackPointer = (event: PointerEvent<HTMLElement>) => {
    const hero = heroRef.current;
    if (!hero || pending.current) return;
    const { clientX, clientY } = event;
    pending.current = requestAnimationFrame(() => {
      pending.current = 0;
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty("--px", ((clientX - bounds.left) / bounds.width).toFixed(4));
      hero.style.setProperty("--py", ((clientY - bounds.top) / bounds.height).toFixed(4));
    });
  };

  const view = mode === "section" ? "Section" : mode === "studio" ? "Studio" : "Complete";

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      data-mode={mode}
      aria-labelledby="hero-title"
      onPointerMove={trackPointer}
    >
      <div className={styles.head}>
        <p className={styles.eyebrow}>
          <span>WebMCP-native</span>
          Architecture in motion
        </p>
        <h1 id="hero-title">ArchMorph</h1>
        <p className={styles.tagline}>{LANDING_PRODUCT.tagline}</p>
      </div>

      <div className={styles.body}>
        <p className={styles.intro}>
          Draw with intent. Let an agent inspect, shape, measure, and validate the same
          live building model—then step inside the result.
        </p>

        <div className={styles.actions}>
          <a
            href="/studio"
            className={styles.primaryAction}
            onPointerEnter={() => setHovered("studio")}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered("studio")}
            onBlur={() => setHovered(null)}
          >
            Enter the live studio <ArrowUpRight size={17} strokeWidth={1.7} />
          </a>
          <button
            type="button"
            className={styles.secondaryAction}
            aria-pressed={sectionLocked}
            onPointerEnter={() => setHovered("section")}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered("section")}
            onBlur={() => setHovered(null)}
            onClick={toggleLandingView}
          >
            Explore the 3D model
          </button>
        </div>
      </div>

      <dl className={styles.schedule}>
        {LANDING_SCHEDULE.map((row) => (
          <div key={row.index}>
            <i>{row.index}</i>
            <dt>{row.term}</dt>
            <span>{row.detail}</span>
            <dd>{row.value}</dd>
          </div>
        ))}
        <div className={styles.liveRow} data-actor={signal.actor}>
          <i>04</i>
          <dt>Live dimension</dt>
          <span>
            <em />
            {ACTOR[signal.actor]} · {signal.note}
          </span>
          <dd>{signal.value}</dd>
        </div>
      </dl>

      <div className={styles.spineTop} aria-hidden="true">
        <span>Elevation</span>
      </div>

      <div className={styles.spine} aria-hidden="true">
        <div className={styles.spineRule}>
          {LEVELS.map((level) => (
            <b key={level.label} style={{ "--offset": level.offset } as CSSProperties}>
              {level.label}
            </b>
          ))}
          <i className={styles.spineNode} style={{ "--elevation": signal.elevation } as CSSProperties} />
        </div>
      </div>

      <div className={styles.spineFoot} data-actor={signal.actor} aria-hidden="true">
        <span>
          {ACTOR[signal.actor]} · {signal.note}
        </span>
      </div>

      <div className={styles.field} id="live-model">
        <div className={styles.fieldHead} aria-hidden="true">
          <span className={styles.sheetLabel}>Sheet AM-06 · Orthographic</span>
          <span
            className={styles.toolState}
            data-status={toolStatus}
            data-actor={toolStatus === "unavailable" ? "none" : activity?.actor ?? "none"}
          >
            <i />
            <b>
              {toolStatus === "unavailable"
                ? TOOL_STATUS_LABEL[toolStatus]
                : activity
                  ? `${ACTOR[activity.actor]} · ${activity.detail}`
                  : `${TOOL_STATUS_LABEL[toolStatus]} · ${landingTools.length}`}
            </b>
          </span>
          <span className={styles.viewState} data-view={view.toLowerCase()}>
            <i />
            {view} view
          </span>
        </div>
        {model}
      </div>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {toolStatus === "unavailable"
          ? "Page tools could not be registered in this browser."
          : activity
            ? `${activity.actor === "agent" ? "Agent" : "You"}: ${activity.detail}.`
            : `${landingTools.length} page tools available to agents.`}
      </p>

      <p className={styles.challengeNote}>
        Built for The WebMCP Challenge <span>·</span> Open web, shared intent
      </p>
    </section>
  );
}
