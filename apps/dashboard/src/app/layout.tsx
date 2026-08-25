import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/lib/provider'
import { ThemeScript } from '@/components/layout/theme-toggle'

// NOTE: This root layout intentionally stays a Server Component because
// `export const metadata` only works in Server Components.
export const metadata: Metadata = {
  title: 'Devion',
  description: 'Self-hosted Application Management & Hosting Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
