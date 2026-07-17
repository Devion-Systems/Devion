"use client";

import { ArrowRight, AtSign, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthNotice,
  AuthPanel,
} from "@/features/auth/components/AuthPrimitives";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe,
      });
      if (result.error)
        throw new Error(result.error.message ?? "Sign in failed.");
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Welcome back"
        title="Access your control panel."
        description="Sign in to manage projects, deployments and the infrastructure behind them."
      />

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? <AuthNotice type="error">{error}</AuthNotice> : null}

        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email"
          icon={AtSign}
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <div className="mt-3 flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-white/35">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
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

        <AuthButton loading={loading}>
          Sign in{" "}
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
