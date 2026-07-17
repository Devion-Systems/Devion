"use client";

import { ArrowRight, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";

import {
  AuthButton,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

export default function VerifyEmailPage() {
  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Inbox check"
        title="Verify your email."
        description="Open the verification link in your inbox to activate your Devion account."
      />

      <div className="grid size-14 place-items-center rounded-2xl border border-[#00CEC9]/25 bg-[#00CEC9]/[0.07] text-[#00CEC9]">
        <Mail className="size-6" />
      </div>

      <div className="mt-6 rounded-xl border border-[#F5F6FA]/[0.07] bg-[#F5F6FA]/[0.025] px-4 py-3 text-xs leading-5 text-[#F5F6FA]/40">
        Check the inbox for the email address used during registration. The
        verification link may take a moment to arrive.
      </div>

      <div className="mt-6 space-y-3">
        <AuthButton type="button">
          <RefreshCw className="size-4" /> Request a new link
        </AuthButton>
        <Link
          href="/login"
          className="flex h-11 items-center justify-center gap-2 text-xs text-[#0984E3] hover:text-[#00CEC9]"
        >
          Continue to sign in <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </AuthPanel>
  );
}
