import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/provider";

// HINWEIS — Ausnahme von unserer "immer use client"-Konvention:
// Dieses Root-Layout bleibt bewusst eine Server Component, weil
// `export const metadata` nur in Server Components funktioniert.
// Es enthält selbst keine Hooks und lädt keine Daten — nur <html>/<body>
// plus den Providers-Wrapper (der intern 'use client' ist). Alle
// Routen darunter folgen weiterhin konsequent der 'use client'-Regel.
export const metadata: Metadata = {
  title: "Devion",
  description: "Self-hosted Application Management & Hosting Platform",
  icons: {
    icon: "/devion-logo.png",
    apple: "/devion-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
