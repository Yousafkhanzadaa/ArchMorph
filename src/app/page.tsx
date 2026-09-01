import { ArrowUpRight, Braces, Layers3, Ruler } from "lucide-react";
import HeroBuilding from "./components/HeroBuilding";
import styles from "./landing.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <div className={styles.brand} aria-label="ArchMorph home">
          <span className={styles.brandMark}>AM</span>
          <span>
            <strong>ArchMorph</strong>
            <small>Human + Agent Studio</small>
          </span>
        </div>

        <div className={styles.navMeta} aria-label="Application status">
          <span><i /> WebMCP live</span>
          <span>Concept model · 06</span>
        </div>

        <a href="/studio" className={styles.navCta}>
          Open studio <ArrowUpRight size={15} strokeWidth={1.7} />
        </a>
      </nav>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <span>WebMCP-native</span>
            Architecture in motion
          </p>

          <div>
            <h1 id="hero-title">ArchMorph</h1>
            <p className={styles.tagline}>Human + Agent Architecture Studio</p>
          </div>

          <p className={styles.intro}>
            Draw with intent. Let an agent inspect, shape, measure, and validate the
            same live building model—then step inside the result.
          </p>

          <div className={styles.actions}>
            <a href="/studio" className={styles.primaryAction}>
              Enter the live studio <ArrowUpRight size={17} strokeWidth={1.7} />
            </a>
            <a href="#live-model" className={styles.secondaryAction}>
              Explore the 3D model
            </a>
          </div>

          <dl className={styles.proof}>
            <div>
              <dt><Braces size={15} strokeWidth={1.5} /> Agent tools</dt>
              <dd>57</dd>
              <span>Typed architectural operations</span>
            </div>
            <div>
              <dt><Layers3 size={15} strokeWidth={1.5} /> Shared state</dt>
              <dd>2D + 3D</dd>
              <span>One canonical live model</span>
            </div>
            <div>
              <dt><Ruler size={15} strokeWidth={1.5} /> Geometry</dt>
              <dd>Exact</dd>
              <span>Measured, inspectable, validated</span>
            </div>
          </dl>
        </div>

        <div className={styles.visual} id="live-model">
          <HeroBuilding />
        </div>

        <p className={styles.challengeNote}>
          Built for The WebMCP Challenge <span>·</span> Open web, shared intent
        </p>
      </section>
    </main>
  );
}
