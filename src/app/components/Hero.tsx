"use client";

import { ArrowUpRight } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import HeroBuilding, { type HeroMode, type HeroSignal } from "./HeroBuilding";
import styles from "./Hero.module.css";

const ACTOR: Record<HeroSignal["actor"], string> = { system: "Sys", human: "Hum", agent: "Agt" };

/** The three level datums. 0% sits on the lower rule, 100% on the rule under the title. */
const LEVELS = [
  { label: "+7200", offset: "100%" },
  { label: "+3600", offset: "50%" },
  { label: "±0", offset: "0%" },
];

/** A specification schedule attached to the title block; line 04 is read off the live model. */
const SCHEDULE = [
  { index: "01", term: "Agent tools", detail: "Typed architectural operations", value: "57" },
  { index: "02", term: "Shared state", detail: "One canonical live model", value: "2D + 3D" },
  { index: "03", term: "Geometry", detail: "Measured, inspectable, validated", value: "Exact" },
];

const OPENING: HeroSignal = {
  actor: "system",
  code: "01",
  note: "Site set out",
  value: "5640",
  progress: 0,
  elevation: 0,
};

export default function Hero() {
  const [hovered, setHovered] = useState<"studio" | "section" | null>(null);
  const [sectionLocked, setSectionLocked] = useState(false);
  const [signal, setSignal] = useState<HeroSignal>(OPENING);
  const heroRef = useRef<HTMLElement>(null);
  const pending = useRef(0);

  let mode: HeroMode = "idle";
  if (hovered === "studio") mode = "studio";
  else if (hovered === "section" || sectionLocked) mode = "section";


  const handleSignal = useCallback((next: HeroSignal) => setSignal(next), []);

  // Isolated, so a new reading from the model never re-renders the model itself.
  const model = useMemo(() => <HeroBuilding mode={mode} onSignal={handleSignal} />, [mode, handleSignal]);

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
        <p className={styles.tagline}>Human + Agent Architecture Studio</p>
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
            onClick={() => setSectionLocked((locked) => !locked)}
          >
            Explore the 3D model
          </button>
        </div>
      </div>

      <dl className={styles.schedule}>
        {SCHEDULE.map((row) => (
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
          <span>Sheet AM-06 · Orthographic</span>
          <span className={styles.viewState} data-view={view.toLowerCase()}>
            <i />
            {view} view
          </span>
        </div>
        {model}
      </div>

      <p className={styles.challengeNote}>
        Built for The WebMCP Challenge <span>·</span> Open web, shared intent
      </p>
    </section>
  );
}
