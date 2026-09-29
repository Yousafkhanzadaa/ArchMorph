import { ArrowUpRight } from "lucide-react";
import Hero from "./components/Hero";
import styles from "./landing.module.css";

const socialLinks = [
  { label: "X", handle: "@xmusfk", href: "https://x.com/xmusfk" },
  { label: "Instagram", handle: "@musfk", href: "https://www.instagram.com/musfk/" },
  { label: "LinkedIn", handle: "musfk", href: "https://www.linkedin.com/in/musfk/" },
];

export default function Home() {
  return (
    <div className={styles.page}>
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

      <main>
        <Hero />
      </main>

      <footer className={styles.footer}>
        <p>Connect with the creator</p>
        <nav className={styles.socialLinks} aria-label="Creator social profiles">
          {socialLinks.map(({ label, handle, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label}: ${handle} (opens in a new tab)`}
            >
              <strong>{label}</strong>
              <span>{handle}</span>
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
