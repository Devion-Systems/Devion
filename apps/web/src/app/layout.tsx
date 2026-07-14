import type { Metadata, Viewport } from "next";
import { Providers } from "@/lib/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Devion — Deine Infrastruktur. Deine Kontrolle.",
    template: "%s · Devion",
  },
  description:
    "Die self-hosted Plattform zur Verwaltung, Bereitstellung und Überwachung von Anwendungen auf eigener Hardware.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#11191F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
