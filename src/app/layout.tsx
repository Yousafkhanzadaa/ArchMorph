import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "ArchMorph — Human + Agent Architecture Studio",
  description:
    "A browser-based residential design studio where people and WebMCP agents shape the same building.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
