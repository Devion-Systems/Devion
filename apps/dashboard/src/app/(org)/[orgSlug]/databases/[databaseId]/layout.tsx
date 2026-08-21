'use client'

import Link from "next/link";
import { useParams } from "next/navigation";

export default function DatabasesDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgSlug, databaseId } = useParams<{ orgSlug: string; databaseId: string }>();
  const base = `/${orgSlug}/databases/${databaseId}`;
  return (
    <div>
      <nav className="flex flex-wrap gap-1 border-b border-white/[0.07] bg-[#172128] px-5 py-2 text-sm text-zinc-400 sm:px-7">
        <Link className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] hover:text-white" href={base}>Overview</Link>
        <Link className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] hover:text-white" href={`${base}/console`}>Data Console</Link>
        <Link className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] hover:text-white" href={`${base}/settings/general`}>Settings</Link>
        <Link className="rounded-lg px-3 py-1.5 hover:bg-red-400/10 hover:text-red-200" href={`${base}/settings/danger-zone`}>Danger Zone</Link>
      </nav>
      {children}
    </div>
  )
}
