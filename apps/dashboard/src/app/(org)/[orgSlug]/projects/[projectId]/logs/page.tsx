'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw, Download, Filter, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

type LogEntry = {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  source?: string
}

const LEVEL_STYLE: Record<LogLevel, { label: string; color: string; dot: string }> = {
  info:  { label: 'INFO',  color: 'text-blue-400',    dot: 'text-blue-400' },
  warn:  { label: 'WARN',  color: 'text-amber-400',   dot: 'text-amber-400' },
  error: { label: 'ERROR', color: 'text-red-400',     dot: 'text-red-400' },
  debug: { label: 'DEBUG', color: 'text-zinc-500',    dot: 'text-zinc-500' },
}

const MOCK_LOGS: LogEntry[] = [
  { id: '1',  timestamp: '2026-08-18 18:34:01.234', level: 'info',  message: 'Server listening on :3000', source: 'server' },
  { id: '2',  timestamp: '2026-08-18 18:34:01.891', level: 'info',  message: 'Connected to PostgreSQL database', source: 'db' },
  { id: '3',  timestamp: '2026-08-18 18:34:02.012', level: 'debug', message: 'Cache initialized with TTL=300s', source: 'cache' },
  { id: '4',  timestamp: '2026-08-18 18:34:15.441', level: 'info',  message: 'GET /api/health 200 2ms', source: 'http' },
  { id: '5',  timestamp: '2026-08-18 18:34:22.003', level: 'info',  message: 'POST /api/auth/login 200 45ms', source: 'http' },
  { id: '6',  timestamp: '2026-08-18 18:35:01.780', level: 'warn',  message: 'High memory usage detected: 78%', source: 'monitor' },
  { id: '7',  timestamp: '2026-08-18 18:35:15.221', level: 'info',  message: 'GET /api/users/me 200 8ms', source: 'http' },
  { id: '8',  timestamp: '2026-08-18 18:36:02.119', level: 'error', message: 'Unhandled error in worker thread: ECONNREFUSED 127.0.0.1:6379', source: 'worker' },
  { id: '9',  timestamp: '2026-08-18 18:36:02.124', level: 'error', message: 'Redis connection failed – retrying in 5s', source: 'cache' },
  { id: '10', timestamp: '2026-08-18 18:36:07.551', level: 'info',  message: 'Redis reconnected successfully', source: 'cache' },
  { id: '11', timestamp: '2026-08-18 18:37:00.001', level: 'info',  message: 'Cron job: cleanup_sessions started', source: 'cron' },
  { id: '12', timestamp: '2026-08-18 18:37:00.441', level: 'info',  message: 'Cron job: cleanup_sessions done — 42 sessions removed', source: 'cron' },
  { id: '13', timestamp: '2026-08-18 18:38:14.883', level: 'warn',  message: 'Slow query detected (420ms): SELECT * FROM events WHERE ...', source: 'db' },
  { id: '14', timestamp: '2026-08-18 18:39:01.010', level: 'info',  message: 'GET /api/projects 200 12ms', source: 'http' },
  { id: '15', timestamp: '2026-08-18 18:40:33.771', level: 'debug', message: 'WebSocket client connected: usr_j8K2x1', source: 'ws' },
]

function useLogs(orgSlug: string, projectId: string, level: string) {
  return useQuery<LogEntry[]>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'logs', level],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/logs?level=${level}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Logs nicht verfügbar')
      return res.json()
    },
    placeholderData: MOCK_LOGS,
    refetchInterval: 5_000,
  })
}

export default function ProjectLogsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const [level, setLevel] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [follow, setFollow] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: logs = [], isLoading, refetch } = useLogs(orgSlug, projectId, level)

  const filtered = logs.filter((l) => {
    const levelMatch = level === 'all' || l.level === level
    const searchMatch = !search || l.message.toLowerCase().includes(search.toLowerCase())
    return levelMatch && searchMatch
  })

  useEffect(() => {
    if (follow) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filtered, follow])

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Logs" description="Runtime-Logs in Echtzeit" />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'info', 'warn', 'error', 'debug'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLevel(l)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              level === l
                ? 'bg-[#0984e3] text-white'
                : 'border border-white/[0.08] text-zinc-400 hover:text-zinc-200'
            )}
          >
            {l === 'all' ? 'Alle' : l.toUpperCase()}
          </button>
        ))}

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="In Logs suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-[#0984e3]/40 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setFollow(!follow)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
            follow
              ? 'border-[#0984e3]/40 bg-[#0984e3]/10 text-[#0984e3]'
              : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Circle className={cn('h-2 w-2 fill-current', follow && 'animate-pulse')} />
          Live
        </button>

        <button
          type="button"
          onClick={() => refetch()}
          className="rounded p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Log Output */}
      <div className="h-[60vh] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0d1519] p-4 font-mono text-xs leading-relaxed">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-zinc-600">
            Logs werden geladen …
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-600">
            Keine Logs gefunden
          </div>
        ) : (
          filtered.map((log) => {
            const s = LEVEL_STYLE[log.level]
            return (
              <div key={log.id} className="flex gap-3 py-0.5 hover:bg-white/[0.02]">
                <span className="shrink-0 text-zinc-600">{log.timestamp}</span>
                <span className={`w-12 shrink-0 font-semibold ${s.color}`}>{s.label}</span>
                {log.source && (
                  <span className="shrink-0 text-zinc-600">[{log.source}]</span>
                )}
                <span className="text-zinc-300">{log.message}</span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <p className="text-right text-xs text-zinc-600">{filtered.length} Einträge</p>
    </div>
  )
}
