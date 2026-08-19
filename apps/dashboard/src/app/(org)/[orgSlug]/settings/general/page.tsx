"use client";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
export default function SettingsGeneralPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [org, setOrg] = useState<{ id: string } | null>(null);
  useEffect(() => {
    authClient.organization.list().then(({ data }) => {
      const current = data?.find((item) => item.slug === orgSlug);
      if (current) {
        setOrg(current);
        setName(current.name);
        setSlug(current.slug);
      }
    });
  }, [orgSlug]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!org) return;
    const { error } = await authClient.organization.update({
      organizationId: org.id,
      data: { name, slug },
    });
    setMessage(
      error
        ? (error.message ?? "Einstellungen konnten nicht gespeichert werden.")
        : "Organisation gespeichert.",
    );
  }
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Organisationseinstellungen"
        description="Name und Workspace-Adresse deiner Organisation verwalten."
      />
      <form
        className="max-w-2xl space-y-4 rounded-2xl border border-white/[0.07] bg-[#172128] p-6"
        onSubmit={submit}
      >
        <label
          className="block space-y-2 text-sm text-zinc-300"
          htmlFor="org-name"
        >
          Name
          <input
            id="org-name"
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label
          className="block space-y-2 text-sm text-zinc-300"
          htmlFor="org-slug"
        >
          Workspace-Adresse
          <input
            id="org-slug"
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3"
            value={slug}
            onChange={(event) =>
              setSlug(
                event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              )
            }
            required
          />
        </label>
        {message ? <p className="text-sm text-[#81ecec]">{message}</p> : null}
        <Button type="submit">Änderungen speichern</Button>
      </form>
    </div>
  );
}
