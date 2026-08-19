"use client";

import { ArrowRight, UsersRound } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function TeamsNewPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setIsSubmitting(true);
    const organizations = await authClient.organization.list();
    const currentOrganization = organizations.data?.find(
      (item) => item.slug === orgSlug,
    );
    if (!currentOrganization) {
      setIsSubmitting(false);
      setError("Die Organisation wurde nicht gefunden.");
      return;
    }

    const { data, error: createError } =
      await authClient.organization.createTeam({
        name: name.trim(),
        organizationId: currentOrganization.id,
      });
    setIsSubmitting(false);

    if (createError || !data) {
      setError(
        createError?.message ?? "Das Team konnte nicht erstellt werden.",
      );
      return;
    }

    router.replace(`/${orgSlug}/teams/${data.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Neues Team"
        description="Bündele Mitglieder und Projekte in einem klaren Arbeitsbereich."
      />
      <form
        className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UsersRound className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Team einrichten</h2>
            <p className="text-sm text-muted-foreground">
              Du wirst dem Team automatisch hinzugefügt.
            </p>
          </div>
        </div>
        <label
          className="block space-y-2 text-sm font-medium"
          htmlFor="team-name"
        >
          Teamname
          <input
            id="team-name"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="z. B. Platform Engineering"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        {error ? (
          <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-7 flex justify-end">
          <Button size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Erstelle …" : "Team erstellen"}
            <ArrowRight />
          </Button>
        </div>
      </form>
    </div>
  );
}
