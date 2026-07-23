import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { Home } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claw3D",
  description: "Focused operator studio for the OpenClaw gateway.",
};

const display = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t?t==='dark':m;document.documentElement.classList.toggle('dark',d);}catch(e){}})();",
          }}
        />
      </head>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
        <div className="h-screen w-screen overflow-x-hidden overflow-y-auto bg-background">
          <Link
            href="/office"
            className="fixed left-3 top-3 z-[100000] inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-border bg-card/92 px-3 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ir para o início"
            title="Início"
          >
            <Home size={16} aria-hidden="true" />
            <span>Início</span>
          </Link>
          {children}
        </div>
      </body>
    </html>
  );
}
