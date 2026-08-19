"use client";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="app-surface relative min-h-screen overflow-hidden bg-[#0b1217] px-5 py-8 text-zinc-100 sm:px-8">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-[#0984e3]/10 blur-[140px]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[1.5rem] border border-white/[0.09] bg-[#172128]/90 p-6 shadow-[0_28px_90px_rgba(0,0,0,.32)] backdrop-blur-xl sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#0984e3] to-[#00cec9] text-xs font-black text-[#0b1217]">
              D
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-zinc-50">
                Devion
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#81ecec]">
                Erste Schritte
              </p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
