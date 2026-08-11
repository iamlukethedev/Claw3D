import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "../../../../src/app/globals.css";
import "@claw3d/visual-react/styles.css";
import "./upstream-office.css";

export const metadata: Metadata = {
  title: "Claw3D",
  description: "Autonomous visual office for JARVIS.",
};

const display = Bebas_Neue({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
