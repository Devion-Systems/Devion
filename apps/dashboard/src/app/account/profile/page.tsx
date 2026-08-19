"use client";

import { CheckCircle2, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/hooks";
import { authClient } from "@/lib/auth-client";

export default function AccountProfilePage() {
  const { data: session, isLoading } = useSession();
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session) return;
    setName(session.user.name ?? "");
    setImage(session.user.image ?? "");
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    const { error } = await authClient.updateUser({
      name: name.trim(),
      image: image.trim() || null,
    });
    setIsSubmitting(false);
    setMessage(
      error
        ? (error.message ?? "Profil konnte nicht gespeichert werden.")
        : "Profil gespeichert.",
    );
  }

  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Profil"
        description="Persönliche Angaben, Avatar und primäre E-Mail-Adresse."
      />
      <form
        className="max-w-2xl rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6"
        onSubmit={handleSubmit}
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#0984e3]/15 text-[#74b9ff]">
            <UserRound className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Persönliche Angaben</h2>
            <p className="text-sm text-zinc-500">
              Dein Name wird innerhalb deiner Organisationen angezeigt.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <label
            className="block space-y-1.5 text-sm font-medium text-zinc-300"
            htmlFor="profile-name"
          >
            Anzeigename
            <input
              id="profile-name"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              disabled={isLoading}
            />
          </label>
          <label
            className="block space-y-1.5 text-sm font-medium text-zinc-300"
            htmlFor="profile-image"
          >
            Avatar-URL{" "}
            <span className="font-normal text-zinc-600">(optional)</span>
            <input
              id="profile-image"
              type="url"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
              placeholder="https://…"
              value={image}
              onChange={(event) => setImage(event.target.value)}
              disabled={isLoading}
            />
          </label>
          <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-zinc-500">
            E-Mail:{" "}
            <span className="text-zinc-300">{session?.user.email ?? "—"}</span>
          </div>
        </div>
        {message ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#81ecec]">
            <CheckCircle2 className="size-4" />
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? "Speichere …" : "Profil speichern"}
          </Button>
        </div>
      </form>
    </div>
  );
}
