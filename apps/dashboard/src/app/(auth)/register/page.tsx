"use client";

import { ArrowRight, AtSign, KeyRound, UserRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
  PasswordMeter,
} from "../_components/AuthPrimitives";

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
  const [password, setPassword] = useState("");

  function previewOnly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <AuthPanel wide>
      <AuthHeader
        eyebrow="New account"
        title="Create your Devion account."
        description="Create one account for projects, deployments and infrastructure."
      />

      <form className="space-y-4" onSubmit={previewOnly}>
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
              />
              <AuthField
                id="lastName"
                name="lastName"
                type="text"
                label="Last name"
                icon={UserRound}
                placeholder="Morgan"
                autoComplete="family-name"
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
            />
          </div>
        </div>

        <AuthButton>
          Create account
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
