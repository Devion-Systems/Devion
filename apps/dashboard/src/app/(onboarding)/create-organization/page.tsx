"use client";

import { ArrowRight, Building2, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const suggestedSlug = useMemo(() => slugify(name), [name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSlug = slugify(slug || suggestedSlug);

    if (!name.trim() || !normalizedSlug) {
      setError(
        "Bitte gib einen Organisationsnamen und einen gültigen Slug an.",
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { data, error: createError } = await authClient.organization.create({
      name: name.trim(),
      slug: normalizedSlug,
      keepCurrentActiveOrganization: false,
    });
    setIsSubmitting(false);

    if (createError || !data) {
      setError(
        createError?.message ??
          "Die Organisation konnte nicht erstellt werden.",
      );
      return;
    }

    router.replace(`/${data.slug}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation erstellen"
        description="Lege den gemeinsamen Bereich für Projekte, Teams und Infrastruktur an."
      />

      <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_0.72fr]">
        <form
          className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Deine neue Organisation</h2>
              <p className="text-sm text-muted-foreground">
                Du wirst automatisch als Owner hinzugefügt.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="organization-name"
            >
              Name
              <input
                id="organization-name"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="z. B. Acme Engineering"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slugTouched) setSlug(slugify(event.target.value));
                }}
                maxLength={80}
                required
              />
            </label>

            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="organization-slug"
            >
              Workspace-Adresse
              <div className="flex h-11 overflow-hidden rounded-xl border border-input bg-background transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                <span className="flex items-center border-r border-border bg-muted px-3 text-sm text-muted-foreground">
                  /
                </span>
                <input
                  id="organization-slug"
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                  placeholder="acme-engineering"
                  value={slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(slugify(event.target.value));
                  }}
                  maxLength={48}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </div>
              <span className="block text-xs font-normal text-muted-foreground">
                Nur Kleinbuchstaben, Zahlen und Bindestriche. Diese Adresse kann
                später verwendet werden.
              </span>
            </label>
          </div>

          {error ? (
            <p className="mt-5 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-7 flex justify-end">
            <Button size="lg" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              Organisation erstellen
            </Button>
          </div>
        </form>

        <aside className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <Sparkles className="mb-4 size-5 text-cyan-500" />
          <h2 className="font-semibold">Bereit für Zusammenarbeit</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Eine Organisation bündelt Mitglieder, Projekte und Infrastruktur. Du
            kannst weitere Personen später über Einladungen hinzufügen.
          </p>
          <div className="mt-6 rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
            <p className="font-medium">Deine Rolle</p>
            <p className="mt-1 text-muted-foreground">
              Owner mit vollständiger Verwaltung der Organisation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
