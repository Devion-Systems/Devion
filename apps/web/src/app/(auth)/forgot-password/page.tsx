"use client";

import { ArrowLeft, ArrowRight, AtSign } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

export default function ForgotPasswordPage() {
  function previewOnly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Account recovery"
        title="Reset your password."
        description="Enter your account email to request a secure password reset link."
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
        <AuthButton>
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
