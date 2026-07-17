"use client";

import Image from "next/image";
import Link from "next/link";

function Brand() {
  return (
    <Link
      href="/"
      className="group inline-flex flex-col items-center gap-3"
      aria-label="Devion Control Panel"
    >
      <span className="relative grid size-14 place-items-center overflow-hidden rounded-2xl border border-[#00CEC9]/25 bg-[#1E272E] shadow-[0_18px_55px_rgba(9,132,227,.2)] transition-transform duration-300 group-hover:-translate-y-0.5">
        <Image
          src="/devion-logo.png"
          alt=""
          width={48}
          height={48}
          priority
          className="size-12"
        />
      </span>
      <span className="text-center [@media(max-height:820px)]:hidden">
        <span className="block text-xl font-black tracking-[-0.055em] text-[#F5F6FA]">
          DEVION
        </span>
        <span className="mt-1 block font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-[#0984E3]">
          Control Panel
        </span>
      </span>
    </Link>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative h-dvh overflow-hidden bg-[#1E272E] text-[#F5F6FA]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(245,246,250,.075)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-[#0984E3]/8 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-[-220px] left-1/2 size-[460px] -translate-x-1/2 rounded-full bg-[#00CEC9]/5 blur-[130px]" />

      <div className="relative h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-full items-center justify-center px-5 py-4 sm:px-8">
          <div className="w-full max-w-[620px] py-2">
            <div className="mb-5 flex justify-center [@media(max-height:820px)]:mb-3">
              <Brand />
            </div>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
