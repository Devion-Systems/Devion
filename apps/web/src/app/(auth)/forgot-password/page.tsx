"use client";

import { ArrowLeft, ArrowRight, AtSign, MailCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthNotice,
  AuthPanel,
} from "@/features/auth/components/AuthPrimitives";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error)
        throw new Error(result.error.message ?? "Reset request failed.");
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not send the reset email.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthPanel>
        <AuthHeader
          eyebrow="Email sent"
          title="Check your inbox."
          description="If an account exists for this address, a secure reset link is on its way."
        />
        <div className="grid size-14 place-items-center rounded-2xl border border-[#00CEC9]/25 bg-[#00CEC9]/[0.07] text-[#00CEC9]">
          <MailCheck className="size-6" />
        </div>
        <p className="mt-6 text-sm leading-7 text-white/40">
          We sent password reset instructions to{" "}
          <strong className="font-medium text-white/75">{email}</strong>. The
          link expires automatically for your security.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-left text-xs text-[#0984E3] hover:text-[#00CEC9]"
          >
            Use a different email address
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs text-white/35 hover:text-white/70"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Account recovery"
        title="Reset your password."
        description="Enter your account email and we will send you a secure link to choose a new password."
      />
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? <AuthNotice type="error">{error}</AuthNotice> : null}
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Account email"
          icon={AtSign}
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <AuthButton loading={loading}>
          Send reset link <ArrowRight className="size-4" />
        </AuthButton>
      </form>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-2 text-xs text-white/30 hover:text-white/65"
      >
        <ArrowLeft className="size-3.5" /> Back to sign in
      </Link>
    </AuthPanel>
  );
}
