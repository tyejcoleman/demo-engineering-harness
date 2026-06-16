import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Demo Engineering Harness",
  description: "The harness that builds demos, manages demos, and is the demo.",
};

// Mobile: render at device width with no initial zoom so the platform is legible/usable on iPhone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
