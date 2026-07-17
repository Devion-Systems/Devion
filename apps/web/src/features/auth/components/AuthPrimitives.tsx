"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function AuthHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7 text-center">
      <div className="mb-3 flex items-center justify-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#0984E3]">
        <span className="h-px w-5 bg-[#0984E3]/70" /> {eyebrow}
        <span className="h-px w-5 bg-[#0984E3]/70" />
      </div>
      <h1 className="text-balance text-[2rem] font-bold leading-[1.08] tracking-[-0.05em] text-white sm:text-[2.35rem]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/38">
        {description}
      </p>
    </div>
  );
}

type AuthFieldProps = ComponentProps<"input"> & {
  label: string;
  icon: LucideIcon;
  hint?: string;
};

export function AuthField({
  label,
  icon: Icon,
  hint,
  id,
  type,
  className,
  ...props
}: AuthFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center justify-between text-[11px] font-medium text-white/55">
        {label}
        {hint ? (
          <span className="font-normal text-white/20">{hint}</span>
        ) : null}
      </span>
      <span className="relative mt-2 block">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/22" />
        <input
          id={id}
          type={isPassword && passwordVisible ? "text" : type}
          className={cn(
            "h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.025] pl-10 pr-4 text-sm text-white/80 outline-none transition placeholder:text-white/16 hover:border-white/[0.14] focus:border-[#00CEC9]/70 focus:bg-[#00CEC9]/[0.035] focus:ring-4 focus:ring-[#00CEC9]/10",
            isPassword && "pr-11",
            className,
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            className="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-white/22 transition hover:bg-white/[0.04] hover:text-white/60"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
          >
            {passwordVisible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        ) : null}
      </span>
    </label>
  );
}

export function AuthButton({
  loading,
  children,
  ...props
}: ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      className="group/button flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00CEC9] px-5 text-sm font-semibold text-[#1E272E] shadow-[0_14px_36px_rgba(0,206,201,.2)] transition hover:bg-[#0984E3] hover:text-[#F5F6FA] hover:shadow-[0_18px_48px_rgba(9,132,227,.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00CEC9]/25 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function AuthNotice({
  type,
  children,
}: {
  type: "error" | "success" | "info";
  children: ReactNode;
}) {
  const success = type === "success";
  const error = type === "error";
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-5",
        success && "border-[#00CEC9]/25 bg-[#00CEC9]/[0.06] text-[#00CEC9]",
        error && "border-red-400/20 bg-red-400/[0.06] text-red-200/80",
        type === "info" &&
          "border-[#0984E3]/25 bg-[#0984E3]/[0.06] text-[#0984E3]",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function PasswordMeter({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^\w]/.test(password),
  ].filter(Boolean).length;
  const labels = ["Very weak", "Weak", "Good", "Strong", "Excellent"];

  return (
    <div className="mt-3">
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1 rounded-full bg-white/[0.07] transition-colors",
              score >= level && (score < 3 ? "bg-[#0984E3]" : "bg-[#00CEC9]"),
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[9px] text-white/20">
        <span>Password strength</span>
        <span>{labels[score]}</span>
      </div>
    </div>
  );
}

export function AuthPanel({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto rounded-[1.4rem] border border-[#F5F6FA]/10 bg-[#1E272E]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-7",
        wide ? "max-w-[620px] sm:p-6" : "max-w-[460px]",
      )}
    >
      {children}
    </div>
  );
}
