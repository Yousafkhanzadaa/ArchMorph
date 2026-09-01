import { ArrowUpRight } from "lucide-react";
import Hero from "./components/Hero";
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

      <Hero />
    </main>
  );
}
