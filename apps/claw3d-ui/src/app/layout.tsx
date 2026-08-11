import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@claw3d/visual-react/styles.css";

export const metadata: Metadata = {
  title: "Claw3D Visual UI",
  description: "Autonomous, read-only visual surface for JARVIS.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
