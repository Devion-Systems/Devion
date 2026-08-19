"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { type FormEvent, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function AccountSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 12) {
      setMessage("Das neue Passwort muss mindestens 12 Zeichen enthalten.");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setIsSubmitting(false);
    if (error) {
      setMessage(error.message ?? "Passwort konnte nicht geändert werden.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMessage("Passwort geändert. Andere Sitzungen wurden abgemeldet.");
  }

  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Sicherheit"
        description="Passwort, Zwei-Faktor-Authentifizierung und Zugriffsrichtlinien."
      />
      <form
        className="max-w-2xl rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6"
        onSubmit={handleSubmit}
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#0984e3]/15 text-[#74b9ff]">
            <LockKeyhole className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Passwort ändern</h2>
            <p className="text-sm text-zinc-500">
              Andere Sitzungen werden nach der Änderung automatisch beendet.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <label
            className="block space-y-1.5 text-sm font-medium text-zinc-300"
            htmlFor="current-password"
          >
            Aktuelles Passwort
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label
            className="block space-y-1.5 text-sm font-medium text-zinc-300"
            htmlFor="new-password"
          >
            Neues Passwort
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              required
            />
          </label>
        </div>
        {message ? (
          <p className="mt-4 text-sm text-[#81ecec]">{message}</p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Ändere …" : "Passwort ändern"}
            <KeyRound />
          </Button>
        </div>
      </form>
    </div>
  );
}
