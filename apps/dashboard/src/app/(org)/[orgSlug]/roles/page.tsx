"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, UsersRound } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Permission = { key: string; category: string; name: string; description: string };
type Role = { id: string; name: string; description: string | null; permissions: string[]; memberCount: number };
type RoleState = { effectivePermissions: string[]; system: string[]; custom: Role[] };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function RolesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roles = useQuery<RoleState>({ queryKey: ["org", orgSlug, "roles"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/roles`), { credentials: "include" }); if (!response.ok) throw new Error("Rollen konnten nicht geladen werden."); return response.json(); } });
  const permissions = useQuery<Permission[]>({ queryKey: ["org", orgSlug, "permissions"], enabled: roles.isSuccess, queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/permissions`), { credentials: "include" }); if (!response.ok) throw new Error("Berechtigungen konnten nicht geladen werden."); return response.json(); } });
  const mayCreate = roles.data?.effectivePermissions.includes("roles.create") ?? false;
  const grouped = (permissions.data ?? []).reduce<Record<string, Permission[]>>((result, permission) => { (result[permission.category] ??= []).push(permission); return result; }, {});
  function toggle(permission: string) { setSelected((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]); }
  async function createRole(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); const response = await fetch(api(`/organizations/${orgSlug}/roles`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: description || null, permissions: selected }) }); if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.error ?? "Rolle konnte nicht erstellt werden."); return; } setName(""); setDescription(""); setSelected([]); setCreating(false); await client.invalidateQueries({ queryKey: ["org", orgSlug, "roles"] }); }
  return <div className="space-y-6 p-5 sm:p-7"><PageHeader title="Rollen & Rechte" description="Systemrollen sind fest definiert. Custom Roles erweitern sie gezielt für diese Organisation." primaryAction={mayCreate ? <Button onClick={() => setCreating((value) => !value)}><Plus className="size-4" />Custom Role</Button> : undefined} />
    {roles.isLoading ? <p className="text-sm text-zinc-500">Rollen werden geladen …</p> : null}{roles.isError ? <p className="rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{roles.error.message}</p> : null}
    <section className="grid gap-3 md:grid-cols-4">{roles.data?.system.map((role) => <article key={role} className="rounded-2xl border border-white/[0.07] bg-[#172128] p-4"><ShieldCheck className="size-5 text-[#81ecec]" /><p className="mt-3 font-semibold capitalize text-zinc-100">{role}</p><p className="mt-1 text-xs text-zinc-500">Systemrolle · unveränderlich</p></article>)}</section>
    {creating ? <form onSubmit={createRole} className="space-y-5 rounded-2xl border border-[#00cec9]/20 bg-[#172128] p-5"><div><h2 className="font-semibold text-zinc-100">Custom Role erstellen</h2><p className="mt-1 text-sm text-zinc-500">Wähle nur die Aktionen, die diese Rolle tatsächlich benötigt.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/[0.1] bg-[#0b1217] px-3" /></label><label className="text-sm text-zinc-300">Beschreibung<input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/[0.1] bg-[#0b1217] px-3" /></label></div><div className="grid gap-4 md:grid-cols-2">{Object.entries(grouped).map(([category, items]) => <fieldset key={category} className="rounded-xl border border-white/[0.08] p-4"><legend className="px-1 text-sm font-medium text-zinc-200">{category}</legend>{items.map((permission) => <label key={permission.key} className="mt-3 flex cursor-pointer gap-3 text-sm"><input type="checkbox" checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} className="mt-0.5 size-4 accent-[#00cec9]" /><span><span className="block text-zinc-200">{permission.name}</span><span className="block text-xs text-zinc-500">{permission.description}</span></span></label>)}</fieldset>)}</div>{error ? <p className="text-sm text-red-300">{error}</p> : null}<div className="flex gap-3"><Button type="submit">Rolle erstellen</Button><Button type="button" variant="outline" onClick={() => setCreating(false)}>Abbrechen</Button></div></form> : null}
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]">{roles.data?.custom.length ? roles.data.custom.map((role) => <article key={role.id} className="border-b border-white/[0.06] p-5 last:border-0"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 size-4 text-[#81ecec]" /><div className="min-w-0 flex-1"><p className="font-medium text-zinc-100">{role.name}</p><p className="mt-1 text-sm text-zinc-500">{role.description || "Keine Beschreibung"}</p><p className="mt-3 text-xs text-zinc-400">{role.memberCount} Mitglieder · {role.permissions.length} Berechtigungen</p></div></div></article>) : <p className="p-10 text-center text-sm text-zinc-500">Noch keine Custom Roles. Erstelle eine Rolle, wenn die Systemrollen nicht präzise genug sind.</p>}</section>
  </div>;
}
