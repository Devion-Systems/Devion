"use client";

import {
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/hooks";
import { authClient } from "@/lib/auth-client";

export default function AccountPage() {
  const { data: session, isLoading } = useSession();
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (session?.user.name) setFullName(session.user.name);
  }, [session]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim();
    if (!name) {
      setProfileMessage("Bitte gib deinen vollständigen Namen ein.");
      return;
    }

    setProfileMessage(null);
    setIsSavingProfile(true);
    try {
      const { error } = await authClient.updateUser({ name });
      setProfileMessage(
        error
          ? (error.message ?? "Dein Profil konnte nicht gespeichert werden.")
          : "Dein vollständiger Name wurde gespeichert.",
      );
    } catch {
      setProfileMessage(
        "Der Authentifizierungsdienst ist gerade nicht erreichbar.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 12) {
      setPasswordMessage(
        "Das neue Passwort muss mindestens 12 Zeichen lang sein.",
      );
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setPasswordMessage("Die neuen Passwörter stimmen nicht überein.");
      return;
    }

    setPasswordMessage(null);
    setIsSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        setPasswordMessage(
          error.message ?? "Das Passwort konnte nicht geändert werden.",
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setPasswordMessage(
        "Passwort geändert. Andere Sitzungen wurden abgemeldet.",
      );
    } catch {
      setPasswordMessage(
        "Der Authentifizierungsdienst ist gerade nicht erreichbar.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Account-Einstellungen"
        description="Verwalte deine persönlichen Daten und den Zugang zu deinem Konto."
      />

      <section className="max-w-2xl rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#0984e3]/15 text-[#74b9ff]">
            <UserRound className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Persönliche Angaben</h2>
            <p className="text-sm text-zinc-500">
              Diese Angaben werden in deinen Organisationen angezeigt.
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={saveProfile}>
          <label
            className="block space-y-1.5 text-sm font-medium text-zinc-300"
            htmlFor="full-name"
          >
            Vollständiger Name
            <input
              id="full-name"
              type="text"
              autoComplete="name"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={80}
              disabled={isLoading || isSavingProfile}
              required
            />
          </label>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
            <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
              <Mail className="size-3.5" /> E-Mail-Adresse
            </p>
            <p className="mt-1 text-sm text-zinc-200">
              {session?.user.email ?? "Wird geladen …"}
            </p>
          </div>
          {profileMessage ? (
            <p className="flex items-center gap-2 text-sm text-[#81ecec]">
              <CheckCircle2 className="size-4" />
              {profileMessage}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || isSavingProfile}>
              {isSavingProfile ? "Speichere …" : "Name speichern"}
            </Button>
          </div>
        </form>
      </section>

      <section className="max-w-2xl rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#0984e3]/15 text-[#74b9ff]">
            <LockKeyhole className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Passwort ändern</h2>
            <p className="text-sm text-zinc-500">
              Aus Sicherheitsgründen werden andere Sitzungen danach beendet.
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={changePassword}>
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
              disabled={isSavingPassword}
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
              minLength={12}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={isSavingPassword}
              required
            />
          </label>
          <label
            className="block space-y-1.5 text-sm font-medium text-zinc-300"
            htmlFor="confirm-password"
          >
            Neues Passwort wiederholen
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              disabled={isSavingPassword}
              required
            />
          </label>
          {passwordMessage ? (
            <p className="flex items-center gap-2 text-sm text-[#81ecec]">
              <CheckCircle2 className="size-4" />
              {passwordMessage}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? "Ändere …" : "Passwort ändern"}
              <KeyRound />
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
