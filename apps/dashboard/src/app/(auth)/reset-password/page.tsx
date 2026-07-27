"use client";

import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
  PasswordMeter,
} from "../_components/AuthPrimitives";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");

  function previewOnly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Secure reset"
        title="Choose a new password."
        description="Create a unique password for your Devion account."
      />

      <form className="space-y-5" onSubmit={previewOnly}>
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
        />
        <AuthButton>
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
