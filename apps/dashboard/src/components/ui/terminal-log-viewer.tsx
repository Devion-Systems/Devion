"use client";

import { Check, Copy, Download, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { XtermTerminal } from "@/components/ui/xterm-terminal";

type TerminalLogViewerProps = {
  value?: string;
  ariaLabel: string;
  emptyMessage: string;
  fileName?: string;
  isFetching?: boolean;
  onRefresh?: () => void;
};

export function TerminalLogViewer({
  value = "",
  ariaLabel,
  emptyMessage,
  fileName = "devion-logs.txt",
  isFetching = false,
  onRefresh,
}: TerminalLogViewerProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const filteredValue = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return value;
    return value
      .split(/\r?\n/)
      .filter((line) => line.toLocaleLowerCase().includes(normalizedQuery))
      .join("\n");
  }, [query, value]);

  const copy = async () => {
    if (!filteredValue) return;
    await navigator.clipboard.writeText(filteredValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const download = () => {
    if (!filteredValue) return;
    const url = URL.createObjectURL(
      new Blob([filteredValue], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
        <label className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
          <span className="sr-only">Logs filtern</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Logs filtern …"
            className="h-9 w-full rounded-lg border border-white/[0.1] bg-[#080d10] pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#81ecec]/70 focus:ring-2 focus:ring-[#81ecec]/20"
          />
        </label>
        <div className="ml-auto flex items-center gap-1">
          {onRefresh ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onRefresh}
              disabled={isFetching}
              aria-label="Logs aktualisieren"
            >
              <RefreshCw className={isFetching ? "animate-spin" : ""} />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => void copy()}
            disabled={!filteredValue}
            aria-label="Logs kopieren"
          >
            {copied ? <Check className="text-emerald-300" /> : <Copy />}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={download}
            disabled={!filteredValue}
            aria-label="Logs herunterladen"
          >
            <Download />
          </Button>
        </div>
      </div>
      <XtermTerminal
        className="h-[32rem] rounded-none border-0"
        minHeight={512}
        ariaLabel={ariaLabel}
        value={filteredValue}
        placeholder={
          query && value
            ? "Keine Logzeile entspricht dem Filter."
            : emptyMessage
        }
      />
      <footer className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-2 text-[11px] text-zinc-500">
        <span>
          {query
            ? `${filteredValue ? filteredValue.split(/\r?\n/).length : 0} Treffer`
            : `${value ? value.split(/\r?\n/).length : 0} Zeilen`}
        </span>
        <span>{isFetching ? "Wird aktualisiert …" : "xterm.js"}</span>
      </footer>
    </section>
  );
}
