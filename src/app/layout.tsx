import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const title = "ArchMorph — Human + Agent Architecture Studio";
const description =
  "A browser-based architectural design studio where people and WebMCP agents shape, validate, and explore the same live building model.";

export const metadata: Metadata = {
  metadataBase: new URL("https://archmorph-studio.musfk.chatgpt.site"),
  applicationName: "ArchMorph",
  title,
  description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ArchMorph",
    title,
    description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ArchMorph architectural plan transitioning into a shared human-agent building model",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
