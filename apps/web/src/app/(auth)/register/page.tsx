"use client";

import { ArrowRight, AtSign, KeyRound, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthNotice,
  AuthPanel,
  PasswordMeter,
} from "@/features/auth/components/AuthPrimitives";
import { authClient } from "@/lib/auth-client";

function FormSection({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-[#0984E3]/25 bg-[#0984E3]/10 font-mono text-[9px] font-bold text-[#0984E3]">
        {number}
      </span>
      <div>
        <h2 className="text-xs font-semibold text-[#F5F6FA]/80">{title}</h2>
        <p className="mt-0.5 text-[10px] text-[#F5F6FA]/28">{description}</p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8)
      return setError("Use at least 8 characters for your password.");
    if (password !== confirmation)
      return setError("The passwords do not match.");

    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email,
        password,
      });
      if (result.error)
        throw new Error(result.error.message ?? "Account creation failed.");
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not create your account.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel wide>
      <AuthHeader
        eyebrow="New account"
        title="Create your Devion account."
        description="Create one account for projects, deployments and infrastructure."
      />

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? <AuthNotice type="error">{error}</AuthNotice> : null}
        <div className="space-y-3">
          <FormSection
            number="01"
            title="Personal details"
            description="Tell us who owns this account."
          />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField
                id="firstName"
                name="firstName"
                type="text"
                label="First name"
                icon={UserRound}
                placeholder="Alex"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
              <AuthField
                id="lastName"
                name="lastName"
                type="text"
                label="Last name"
                icon={UserRound}
                placeholder="Morgan"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>
            <AuthField
              id="email"
              name="email"
              type="email"
              label="Email"
              hint="Used to sign in"
              icon={AtSign}
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-3 border-t border-[#F5F6FA]/[0.07] pt-3">
          <FormSection
            number="02"
            title="Account security"
            description="Use a unique password with at least 8 characters."
          />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div>
              <AuthField
                id="password"
                name="password"
                type="password"
                label="Password"
                hint="8+ characters"
                icon={KeyRound}
                placeholder="Create password"
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
              hint="Type it again"
              icon={KeyRound}
              placeholder="Repeat password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </div>
        </div>

        <AuthButton loading={loading}>
          Create account{" "}
          <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
        </AuthButton>
      </form>

      <div className="mt-4 border-t border-white/[0.07] pt-4 text-center text-xs text-white/28">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[#0984E3] hover:text-[#00CEC9]"
        >
          Sign in
        </Link>
      </div>
    </AuthPanel>
  );
}
