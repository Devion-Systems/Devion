import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/provider";
import { ThemeScript } from "@/components/layout/theme-toggle";
import { I18nProvider } from "@/lib/i18n";

// NOTE: This root layout intentionally stays a Server Component because
// `export const metadata` only works in Server Components.
export const metadata: Metadata = {
  title: "Devion",
  description: "Self-hosted Application Management & Hosting Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <I18nProvider>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
