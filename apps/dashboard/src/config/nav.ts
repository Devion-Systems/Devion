// config/nav.ts
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Server,
  Database,
  Gauge,
  Share2,
  UserCog,
  ShieldCheck,
  ScrollText,
  Settings,
  Building2,
  RefreshCw,
} from 'lucide-react'
import type { Permission } from '@/features/permissions/constants'

export type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  permission?: Permission          // undefined = für alle Rollen sichtbar
}

export type NavGroup = {
  title: string
  icon: React.ElementType
  items: NavItem[]
  defaultOpen?: boolean
}

// orgSlug wird beim Rendern in die href injiziert, hier nur Platzhalter-Pfade
export function getOrgNavGroups(orgSlug: string): NavGroup[] {
  const base = `/${orgSlug}`

  return [
    {
      title: 'Übersicht',
      icon: LayoutDashboard,
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: `${base}`, icon: LayoutDashboard },
      ],
    },
    {
      title: 'Projekte',
      icon: FolderKanban,
      defaultOpen: true,
      items: [
        { label: 'Alle Projekte', href: `${base}/projects`, icon: FolderKanban },
      ],
    },
    {
      title: 'Teams',
      icon: Users,
      items: [
        { label: 'Alle Teams', href: `${base}/teams`, icon: Users },
      ],
    },
    {
      title: 'Infrastruktur',
      icon: Server,
      defaultOpen: true,
      items: [
        { label: 'Hardware', href: `${base}/hardware`, icon: Server },
        { label: 'Datenbanken', href: `${base}/databases`, icon: Database },
        {
          label: 'Ressourcen-Limits',
          href: `${base}/resources/limits`,
          icon: Gauge,
          permission: 'hardware:manage',
        },
        {
          label: 'Shared Resources',
          href: `${base}/resources/shared`,
          icon: Share2,
          permission: 'hardware:manage',
        },
      ],
    },
    {
      title: 'Verwaltung',
      icon: UserCog,
      items: [
        { label: 'Mitglieder', href: `${base}/members`, icon: UserCog },
        {
          label: 'Rollen',
          href: `${base}/roles`,
          icon: ShieldCheck,
          permission: 'team:invite',
        },
        {
          label: 'Audit Log',
          href: `${base}/audit-log`,
          icon: ScrollText,
          permission: 'hardware:manage',
        },
      ],
    },
    {
      title: 'Einstellungen',
      icon: Settings,
      items: [
        { label: 'Organisation', href: `${base}/settings/general`, icon: Building2 },
      ],
    },
  ]
}

export const adminNavGroups: NavGroup[] = [
  {
    title: 'Plattform',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { label: 'Übersicht', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Verwaltung',
    icon: Building2,
    defaultOpen: true,
    items: [
      { label: 'Organisationen', href: '/admin/organizations', icon: Building2 },
      { label: 'Nutzer', href: '/admin/users', icon: Users },
      { label: 'Hardware-Pool', href: '/admin/hardware', icon: Server },
    ],
  },
  {
    title: 'System',
    icon: Gauge,
    items: [
      { label: 'System-Health', href: '/admin/system', icon: Gauge },
      { label: 'Updates', href: '/admin/system/updates', icon: RefreshCw },
      { label: 'Audit Log', href: '/admin/logs', icon: ScrollText },
      { label: 'TLS-Zertifikate', href: '/admin/settings/certificates', icon: ShieldCheck },
      { label: 'Einstellungen', href: '/admin/settings/plans', icon: Settings },
    ],
  },
]
