"use client";

import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthNotice,
  AuthPanel,
  PasswordMeter,
} from "@/features/auth/components/AuthPrimitives";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token)
      return setError("This reset link is missing its security token.");
    if (password.length < 8)
      return setError("Use at least 8 characters for your password.");
    if (password !== confirmation)
      return setError("The passwords do not match.");

    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error)
        throw new Error(result.error.message ?? "Password reset failed.");
      setComplete(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not reset your password.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <AuthPanel>
        <AuthHeader
          eyebrow="Password updated"
          title="You are secure again."
          description="Your new password is active. You can now return to Devion and sign in."
        />
        <div className="grid size-14 place-items-center rounded-2xl border border-[#00CEC9]/25 bg-[#00CEC9]/[0.07] text-[#00CEC9]">
          <ShieldCheck className="size-6" />
        </div>
        <div className="mt-6">
          <AuthNotice type="success">
            Your password was updated successfully.
          </AuthNotice>
        </div>
        <Link
          href="/login"
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00CEC9] text-sm font-semibold text-[#1E272E] transition hover:bg-[#0984E3] hover:text-[#F5F6FA]"
        >
          Continue to sign in <ArrowRight className="size-4" />
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Secure reset"
        title="Choose a new password."
        description="Create a password that is unique to Devion. Your existing sessions remain protected."
      />
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? <AuthNotice type="error">{error}</AuthNotice> : null}
        <div>
          <AuthField
            id="password"
            name="password"
            type="password"
            label="New password"
            hint="8+ characters"
            icon={KeyRound}
            placeholder="Enter a new password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <PasswordMeter password={password} />
        </div>
        <AuthField
          id="confirmation"
          name="confirmation"
          type="password"
          label="Confirm password"
          icon={KeyRound}
          placeholder="Repeat your new password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        <AuthButton loading={loading}>
          Update password <ArrowRight className="size-4" />
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
