import {
  Activity,
  AppWindow,
  BarChart3,
  BookOpen,
  Box,
  Brain,
  Building2,
  Clock,
  Cpu,
  Database,
  FolderKanban,
  Globe,
  HardDrive,
  LayoutDashboard,
  Network,
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { Permission } from "@/features/permissions/constants";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: Permission;
};

export type NavGroup = {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
};

export function getOrgNavGroups(orgSlug: string): NavGroup[] {
  const base = `/${orgSlug}`;
  return [
    {
      title: "Overview",
      icon: LayoutDashboard,
      defaultOpen: true,
      items: [{ label: "Overview", href: base, icon: LayoutDashboard }],
    },
    {
      title: "Workspace",
      icon: FolderKanban,
      defaultOpen: true,
      items: [
        { label: "Projects", href: `${base}/projects`, icon: FolderKanban },
        {
          label: "Applications",
          href: `${base}/applications`,
          icon: AppWindow,
        },
        {
          label: "Deployments",
          href: `${base}/deployments`,
          icon: Zap,
        },
        { label: "Builds", href: `${base}/builds`, icon: Box },
      ],
    },
    {
      title: "Infrastructure",
      icon: Server,
      defaultOpen: true,
      items: [
        { label: "Nodes", href: `${base}/hardware`, icon: Server },
        {
          label: "Networking",
          href: `${base}/networking`,
          icon: Network,
        },
        { label: "Storage", href: `${base}/storage`, icon: HardDrive },
        { label: "Databases", href: `${base}/databases`, icon: Database },
      ],
    },
    {
      title: "Operations",
      icon: Activity,
      items: [
        { label: "Logs", href: `${base}/logs`, icon: ScrollText },
        { label: "Metrics", href: `${base}/metrics`, icon: BarChart3 },
        { label: "Events", href: `${base}/events`, icon: Clock },
        {
          label: "Audit Logs",
          href: `${base}/audit-log`,
          icon: BookOpen,
          permission: "hardware:manage",
        },
      ],
    },
    {
      title: "AI",
      icon: Sparkles,
      items: [
        {
          label: "Providers",
          href: `${base}/ai/providers`,
          icon: Brain,
        },
        { label: "Models", href: `${base}/ai/models`, icon: Cpu },
      ],
    },
    {
      title: "Organization",
      icon: Building2,
      items: [
        {
          label: "Members",
          href: `${base}/members`,
          icon: Users,
        },
        {
          label: "Settings",
          href: `${base}/settings/general`,
          icon: Settings,
        },
      ],
    },
  ];
}

export const adminNavGroups: NavGroup[] = [
  {
    title: "Platform",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Management",
    icon: Building2,
    defaultOpen: true,
    items: [
      { label: "Organizations", href: "/admin/organizations", icon: Building2 },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Hardware Pool", href: "/admin/hardware", icon: Server },
    ],
  },
  {
    title: "System",
    icon: ShieldCheck,
    items: [
      { label: "System Health", href: "/admin/system", icon: Activity },
      { label: "Updates", href: "/admin/system/updates", icon: RefreshCw },
      { label: "Audit Log", href: "/admin/logs", icon: BookOpen },
      {
        label: "TLS Certificates",
        href: "/admin/settings/certificates",
        icon: Globe,
      },
      { label: "Settings", href: "/admin/settings/plans", icon: Settings },
    ],
  },
];
