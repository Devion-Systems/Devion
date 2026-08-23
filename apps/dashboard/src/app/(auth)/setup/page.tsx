"use client";

import {
  ArrowRight,
  AtSign,
  Building2,
  Globe2,
  KeyRound,
  Network,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export default function SetupPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenRequired, setTokenRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/api/setup/status`, { cache: "no-store" })
      .then((response) => response.json())
      .then((status) => {
        setTokenRequired(Boolean(status.tokenRequired));
        if (!status.required) router.replace("/login");
      })
      .catch(() => setError("Der Setup-Status konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    if (password !== String(values.get("confirmation") ?? ""))
      return setError("Die Passwörter stimmen nicht überein.");
    if (password.length < 12)
      return setError("Das Passwort muss mindestens 12 Zeichen lang sein.");

    const ldap = ldapEnabled
      ? {
          url: String(values.get("ldapUrl") ?? "").trim(),
          baseDn: String(values.get("baseDn") ?? "").trim(),
          bindDn: String(values.get("bindDn") ?? "").trim() || undefined,
          bindPassword: String(values.get("bindPassword") ?? "") || undefined,
          userSearchFilter:
            String(values.get("userSearchFilter") ?? "").trim() ||
            "(mail={{username}})",
          startTls: values.get("startTls") === "on",
        }
      : undefined;
    const email = String(values.get("email") ?? "").trim();
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/api/setup/install`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company.trim(),
          organizationSlug: slugify(String(values.get("slug") || company)),
          setupToken: String(values.get("setupToken") ?? "") || undefined,
          administrator: {
            name: String(values.get("name") ?? "").trim(),
            email,
            password,
          },
          primaryDomain:
            String(values.get("domain") ?? "")
              .trim()
              .toLowerCase() || undefined,
          ldap,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Installation fehlgeschlagen.");
      const signIn = await authClient.signIn.email({ email, password });
      if (signIn.error) return router.replace("/login");
      router.replace(`/${result.organizationSlug}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Installation fehlgeschlagen.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPanel wide>
      <AuthHeader
        eyebrow="Erstinstallation"
        title="Devion für deine Firma einrichten."
        description="Dieser Vorgang erstellt die Firma und den ersten, systemweiten Administrator. Er kann nur einmal ausgeführt werden."
      />
      {loading ? (
        <p className="text-sm text-white/50">Setup-Status wird geprüft …</p>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          {tokenRequired ? (
            <AuthField
              id="setupToken"
              name="setupToken"
              label="Installations-Token"
              icon={KeyRound}
              type="password"
              hint="Aus der Server-Konfiguration"
              required
              autoComplete="off"
            />
          ) : null}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-[#0984E3]" /> Firma
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField
                id="company"
                name="company"
                label="Firmenname"
                icon={Building2}
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
              <AuthField
                id="slug"
                name="slug"
                label="Workspace-Kürzel"
                icon={Building2}
                type="text"
                placeholder={slugify(company) || "meine-firma"}
              />
              <AuthField
                id="domain"
                name="domain"
                label="Primäre Domain (optional)"
                icon={Globe2}
                type="text"
                placeholder="devion.example.com"
              />
            </div>
          </section>
          <section className="space-y-3 border-t border-white/[0.07] pt-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-[#00CEC9]" /> Administrator
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField
                id="name"
                name="name"
                label="Vollständiger Name"
                icon={UserRound}
                type="text"
                required
              />
              <AuthField
                id="email"
                name="email"
                label="E-Mail"
                icon={AtSign}
                type="email"
                required
                autoComplete="email"
              />
              <AuthField
                id="password"
                name="password"
                label="Passwort"
                type="password"
                icon={KeyRound}
                hint="Mindestens 12 Zeichen"
                required
                autoComplete="new-password"
              />
              <AuthField
                id="confirmation"
                name="confirmation"
                label="Passwort bestätigen"
                type="password"
                icon={KeyRound}
                required
                autoComplete="new-password"
              />
            </div>
          </section>
          <section className="space-y-3 border-t border-white/[0.07] pt-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={ldapEnabled}
                onChange={(e) => setLdapEnabled(e.target.checked)}
              />
              <Network className="size-4" /> LDAP-Verzeichnis jetzt
              konfigurieren (optional)
            </label>
            {ldapEnabled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthField
                  id="ldapUrl"
                  name="ldapUrl"
                  label="LDAP URL"
                  icon={Network}
                  type="text"
                  placeholder="ldaps://ldap.example.com:636"
                  required
                />
                <AuthField
                  id="baseDn"
                  name="baseDn"
                  label="Base DN"
                  icon={Network}
                  type="text"
                  placeholder="dc=example,dc=com"
                  required
                />
                <AuthField
                  id="bindDn"
                  name="bindDn"
                  label="Bind DN"
                  icon={UserRound}
                  type="text"
                  placeholder="cn=devion,ou=service,dc=example,dc=com"
                />
                <AuthField
                  id="bindPassword"
                  name="bindPassword"
                  label="Bind-Passwort"
                  icon={KeyRound}
                  type="password"
                  autoComplete="off"
                />
                <AuthField
                  id="userSearchFilter"
                  name="userSearchFilter"
                  label="Benutzerfilter"
                  icon={Network}
                  type="text"
                  placeholder="(mail={{username}})"
                />
                <label className="flex items-center gap-2 self-end pb-3 text-xs text-white/60">
                  <input name="startTls" type="checkbox" /> STARTTLS verwenden
                </label>
              </div>
            ) : null}
          </section>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
            >
              {error}
            </p>
          ) : null}
          <AuthButton disabled={submitting}>
            {submitting ? "Installation läuft …" : "Firma einrichten"}
            <ArrowRight className="size-4" />
          </AuthButton>
        </form>
      )}
    </AuthPanel>
  );
}
