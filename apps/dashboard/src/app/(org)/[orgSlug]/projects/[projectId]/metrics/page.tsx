'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

type MetricPoint = { time: string; value: number }

type Metrics = {
  cpu: MetricPoint[]
  memory: MetricPoint[]
  requests: MetricPoint[]
  latency: MetricPoint[]
}

function generatePoints(base: number, noise: number, count = 24): MetricPoint[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(now - (count - i) * 60 * 60 * 1000).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
    value: Math.max(0, base + (Math.random() - 0.5) * noise),
  }))
}

function useMetrics(orgSlug: string, projectId: string, range: string) {
  return useQuery<Metrics>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'metrics', range],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/metrics?range=${range}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Metriken nicht verfügbar')
      return res.json()
    },
    placeholderData: {
      cpu:      generatePoints(42, 20),
      memory:   generatePoints(65, 15),
      requests: generatePoints(280, 120),
      latency:  generatePoints(45, 30),
    },
    refetchInterval: 30_000,
  })
}

const RANGES = [
  { label: '1h',  value: '1h' },
  { label: '6h',  value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d',  value: '7d' },
  { label: '30d', value: '30d' },
]

function MetricCard({
  title,
  unit,
  data,
  color,
  current,
}: {
  title: string
  unit: string
  data: MetricPoint[]
  color: string
  current?: number
}) {
  const peak = Math.max(...data.map((d) => d.value))
  const avg = data.reduce((s, d) => s + d.value, 0) / data.length

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-5">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
            {current !== undefined ? current.toFixed(1) : avg.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span>
          </p>
        </div>
        <div className="text-right text-xs text-zinc-600">
          <p>Peak: {peak.toFixed(1)}{unit}</p>
          <p>Avg: {avg.toFixed(1)}{unit}</p>
        </div>
      </div>
      <div className="mt-4 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} interval={5} />
            <YAxis tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e272e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#a1a1aa' }}
              formatter={(value) => [
                `${typeof value === 'number' ? value.toFixed(1) : '–'} ${unit}`,
                title,
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#gradient-${title})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function MetricsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const [range, setRange] = useState('24h')
  const { data: metrics, isLoading } = useMetrics(orgSlug, projectId, range)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="Metriken" description="CPU, RAM, Requests und Latenz dieses Projekts" />
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                range === r.value
                  ? 'bg-[#0984e3] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-white/[0.06] bg-[#1e272e]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title="CPU" unit="%" data={metrics?.cpu ?? []} color="#0984e3" />
          <MetricCard title="Arbeitsspeicher" unit="%" data={metrics?.memory ?? []} color="#00cec9" />
          <MetricCard title="Requests/min" unit="req/m" data={metrics?.requests ?? []} color="#74b9ff" />
          <MetricCard title="Latenz" unit="ms" data={metrics?.latency ?? []} color="#a29bfe" />
        </div>
      )}
    </div>
  )
}
