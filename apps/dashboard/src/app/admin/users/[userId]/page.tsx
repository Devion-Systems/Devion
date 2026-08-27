"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Laptop, UserRound } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

type Detail = {
  user: { name: string; email: string; emailVerified: boolean; role?: string | null; canCreateOrganizations: boolean; banned?: boolean | null };
  memberships: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: string;
  }[];
  sessions: { id: string }[];
};

export default function AdminUsersDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics", "users", userId],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/analytics/users/${userId}`,
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Nutzeranalyse konnte nicht geladen werden.");
      return response.json() as Promise<Detail>;
    },
  });
  if (isLoading)
    return (
      <div className="p-6 text-sm text-zinc-500">
        Nutzeranalyse wird geladen …
      </div>
    );
  if (!data) return null;
  async function update(payload: { role?: string; canCreateOrganizations?: boolean; banned?: boolean }) { await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/analytics/users/${userId}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); void client.invalidateQueries({ queryKey: ["admin", "analytics", "users", userId] }); }
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader title={data.user.name} description={data.user.email} />
      <div className="flex flex-wrap gap-2"><Button onClick={() => update({ role: data.user.role === "admin" ? "user" : "admin" })}>{data.user.role === "admin" ? "Adminrechte entfernen" : "Zum Admin machen"}</Button><Button variant="outline" onClick={() => update({ canCreateOrganizations: !data.user.canCreateOrganizations })}>{data.user.canCreateOrganizations ? "Org-Erstellung sperren" : "Org-Erstellung erlauben"}</Button><Button variant="destructive" onClick={() => update({ banned: !data.user.banned })}>{data.user.banned ? "Konto entsperren" : "Konto sperren"}</Button></div>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5">
          <UserRound className="size-5 text-[#74b9ff]" />
          <p className="mt-4 text-sm text-zinc-500">E-Mail-Status</p>
          <p className="mt-1 font-medium text-zinc-100">
            {data.user.emailVerified ? "Verifiziert" : "Unbestätigt"}
          </p>
        </section>
        <section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5">
          <Building2 className="size-5 text-[#81ecec]" />
          <p className="mt-4 text-sm text-zinc-500">Organisationen</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">
            {data.memberships.length}
          </p>
        </section>
        <section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5">
          <Laptop className="size-5 text-violet-300" />
          <p className="mt-4 text-sm text-zinc-500">Sitzungen</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">
            {data.sessions.length}
          </p>
        </section>
      </div>
      <section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5">
        <h2 className="font-semibold text-zinc-100">Organisationszugriffe</h2>
        <div className="mt-4 space-y-3">
          {data.memberships.map((membership) => (
            <div
              className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-0"
              key={membership.organizationId}
            >
              <span>
                <span className="block text-sm text-zinc-200">
                  {membership.organizationName}
                </span>
                <span className="text-xs text-zinc-600">
                  /{membership.organizationSlug}
                </span>
              </span>
              <span className="text-xs text-[#81ecec]">{membership.role}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
