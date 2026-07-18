"use client";

import { ArrowRight, AtSign, KeyRound } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

export default function LoginPage() {
  function previewOnly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Welcome back"
        title="Access your control panel."
        description="Sign in to manage projects, deployments and the infrastructure behind them."
      />

      <form className="space-y-5" onSubmit={previewOnly}>
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

        <AuthButton>
          Sign in
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
