"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Global search entry point.
 * Opens a command-palette-style modal on click or ⌘K / Ctrl+K.
 *
 * BACKEND REQUIREMENT: A global search endpoint is needed.
 * Endpoint suggestion: GET /organizations/:orgSlug/search?q=:query
 * Response: { results: SearchResult[] }
 *   SearchResult: { type: 'project'|'application'|'deployment'|'node'; id: string; label: string; href: string }
 *
 * Until the API exists, the modal shows the input but no results.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const router = useRouter();

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay lets the modal render first
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search (⌘K)"
        className="hidden h-8 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 text-xs text-zinc-500 transition hover:border-white/[0.12] hover:text-zinc-300 md:flex"
      >
        <Search className="size-3.5" aria-hidden="true" />
        Search
        <kbd className="ml-4 rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
          ⌘K
        </kbd>
      </button>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 md:hidden"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>

      {/* Modal overlay */}
      {open && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: escape is handled via document listener
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#1a2329] shadow-2xl">
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
              <Search
                className="size-4 shrink-0 text-zinc-500"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search projects, apps, deployments, nodes…"
                className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                // TODO: Wire to backend search API when available
                readOnly
              />
              <kbd className="shrink-0 rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                ESC
              </kbd>
            </div>

            {/* Empty state – until API is connected */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="mb-3 size-8 text-zinc-700" aria-hidden="true" />
              <p className="text-sm font-medium text-zinc-400">
                Search coming soon
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Global search requires a backend endpoint.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
