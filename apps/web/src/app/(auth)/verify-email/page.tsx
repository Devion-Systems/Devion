"use client";

import {
  ArrowRight,
  Check,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  AuthHeader,
  AuthNotice,
  AuthPanel,
} from "@/features/auth/components/AuthPrimitives";
import { authClient } from "@/lib/auth-client";

type VerificationState = "waiting" | "checking" | "verified" | "error";

export default function VerifyEmailPage() {
  const [state, setState] = useState<VerificationState>("checking");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const token = search.get("token");
    setEmail(search.get("email") ?? "");

    if (!token) {
      setState("waiting");
      return;
    }

    let active = true;
    authClient
      .verifyEmail({ query: { token } })
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setMessage(
            result.error.message ??
              "This verification link is invalid or expired.",
          );
          setState("error");
          return;
        }
        setState("verified");
      })
      .catch(() => {
        if (!active) return;
        setMessage(
          "We could not verify this email address. Please request a new link.",
        );
        setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function resendEmail() {
    if (!email) {
      setMessage("Return to registration and enter your email address again.");
      setState("error");
      return;
    }

    setResending(true);
    setMessage("");
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/verify-email`,
      });
      if (result.error)
        throw new Error(result.error.message ?? "Could not send a new email.");
      setMessage("A fresh verification link is on its way.");
      setState("waiting");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Could not send a new email.",
      );
      setState("error");
    } finally {
      setResending(false);
    }
  }

  const content = {
    waiting: {
      eyebrow: "Inbox check",
      title: "Verify your email.",
      description:
        "Open the secure link we sent to your inbox to activate your Devion account.",
      icon: Mail,
    },
    checking: {
      eyebrow: "Identity verification",
      title: "Checking your link.",
      description:
        "We are validating the email verification token. This only takes a moment.",
      icon: LoaderCircle,
    },
    verified: {
      eyebrow: "Identity confirmed",
      title: "Email verified.",
      description:
        "Your account is ready. Continue to Devion and start setting up your workspace.",
      icon: Check,
    },
    error: {
      eyebrow: "Verification issue",
      title: "This link did not work.",
      description:
        "The verification link may be invalid or expired. Request a new one below.",
      icon: ShieldAlert,
    },
  } as const;

  const current = content[state];
  const Icon = current.icon;

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow={current.eyebrow}
        title={current.title}
        description={current.description}
      />
      <div
        className={`grid size-14 place-items-center rounded-2xl border ${state === "error" ? "border-red-400/20 bg-red-400/[0.06] text-red-300" : "border-[#00CEC9]/25 bg-[#00CEC9]/[0.07] text-[#00CEC9]"}`}
      >
        <Icon
          className={`size-6 ${state === "checking" ? "animate-spin" : ""}`}
        />
      </div>

      <div className="mt-6 space-y-4">
        {email ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="text-[9px] uppercase tracking-[0.12em] text-white/20">
              Email address
            </div>
            <div className="mt-1 truncate text-sm text-white/65">{email}</div>
          </div>
        ) : null}
        {message ? (
          <AuthNotice type={state === "error" ? "error" : "success"}>
            {message}
          </AuthNotice>
        ) : null}
      </div>

      {state === "verified" ? (
        <Link
          href="/login"
          className="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#00CEC9] text-sm font-semibold text-[#1E272E] transition hover:bg-[#0984E3] hover:text-[#F5F6FA]"
        >
          Continue to sign in <ArrowRight className="size-4" />
        </Link>
      ) : state !== "checking" ? (
        <button
          type="button"
          onClick={resendEmail}
          disabled={resending}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] text-sm font-medium text-white/65 transition hover:border-[#0984E3]/40 hover:bg-[#0984E3]/[0.06] hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${resending ? "animate-spin" : ""}`} />{" "}
          Send a new link
        </button>
      ) : null}
    </AuthPanel>
  );
}
