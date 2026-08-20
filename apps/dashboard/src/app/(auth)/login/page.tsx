"use client";

import { ArrowRight, AtSign, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Invalid email address or password.");
        return;
      }
      router.replace("/select-organization");
      router.refresh();
    } catch {
      setError("Unable to reach the authentication service. Please try again.");
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
              Forgot password?
            </Link>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200" role="alert">
            {error}
          </p>
        ) : null}

        <AuthButton disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
          <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
        </AuthButton>
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
