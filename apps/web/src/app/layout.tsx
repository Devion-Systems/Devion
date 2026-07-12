// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/lib/provider'

export const metadata: Metadata = {
  title: 'Snyxe',
  description: 'Hosting Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}