"use client";

import { ArrowRight, AtSign, Fingerprint, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const ssoEnabled = process.env.NEXT_PUBLIC_OIDC_ENABLED === "true";
  const ssoProviderId = process.env.NEXT_PUBLIC_OIDC_PROVIDER_ID || "oidc";
  const ssoProviderName =
    process.env.NEXT_PUBLIC_OIDC_PROVIDER_NAME || "Company SSO";
  const requestedNext = searchParams.get("next");
  const nextPath = requestedNext?.startsWith("/")
    ? requestedNext
    : "/select-organization";

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: nextPath,
      });
      if (signInError) {
        setError(signInError.message ?? "Invalid email address or password.");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Unable to reach the authentication service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInWithPasskey() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: passkeyError } = await authClient.signIn.passkey();
      if (passkeyError) {
        setError(
          passkeyError.message ??
            "Die Passkey-Anmeldung wurde nicht abgeschlossen.",
        );
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError(
        "Passkeys werden von diesem Browser oder Gerät nicht unterstützt.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInWithSso() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: ssoError } = await authClient.signIn.social({
        provider: ssoProviderId,
        callbackURL: nextPath,
      });
      if (ssoError)
        setError(
          ssoError.message ??
            "Die SSO-Anmeldung konnte nicht gestartet werden.",
        );
    } catch {
      setError("Der SSO-Anbieter ist gerade nicht erreichbar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Welcome back"
        title="Access your control panel."
        description="Sign in to manage projects, deployments and the infrastructure behind them."
      />

      <form className="space-y-5" onSubmit={login}>
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email"
          icon={AtSign}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <div>
          <AuthField
            id="password"
            name="password"
            type="password"
            label="Password"
            icon={KeyRound}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          <div className="mt-3 flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-white/35">
              <input
                type="checkbox"
                defaultChecked
                className="size-3.5 rounded border-white/15 bg-white/[0.04] accent-[#0984E3]"
              />
              Keep me signed in
            </label>
            <Link
              href="/forgot-password"
              className="text-[10px] text-[#0984E3] hover:text-[#00CEC9]"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
        </div>

        {error ? (
          <p
            className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <AuthButton disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
          <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
        </AuthButton>
        <button
          type="button"
          onClick={() => void signInWithPasskey()}
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] text-sm font-medium text-zinc-200 transition hover:border-[#00CEC9]/50 hover:bg-[#00CEC9]/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Fingerprint className="size-4" /> {t("auth.passkey")}
        </button>
        {ssoEnabled ? (
          <button
            type="button"
            onClick={() => void signInWithSso()}
            disabled={isSubmitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] text-sm font-medium text-zinc-200 transition hover:border-[#00CEC9]/50 hover:bg-[#00CEC9]/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound className="size-4" /> Mit {ssoProviderName} anmelden
          </button>
        ) : null}
      </form>

      <div className="mt-6 border-t border-white/[0.07] pt-5 text-center text-xs text-white/28">
        New to Devion?{" "}
        <Link
          href="/register"
          className="font-medium text-[#0984E3] hover:text-[#00CEC9]"
        >
          Create an account
        </Link>
      </div>
    </AuthPanel>
  );
}
