"use client";

import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type XtermTerminalProps = {
  value: string;
  ariaLabel: string;
  className?: string;
  minHeight?: number;
  prompt?: string;
  disabled?: boolean;
  placeholder?: string;
  onCommand?: (command: string) => void;
};

const terminalTheme = {
  background: "#080d10",
  foreground: "#b7f7d0",
  cursor: "#81ecec",
  cursorAccent: "#080d10",
  selectionBackground: "#00cec955",
  black: "#080d10",
  brightBlack: "#6b7280",
  red: "#fca5a5",
  brightRed: "#fecaca",
  green: "#86efac",
  brightGreen: "#bbf7d0",
  yellow: "#fde68a",
  brightYellow: "#fef3c7",
  blue: "#74b9ff",
  brightBlue: "#bae6fd",
  magenta: "#c4b5fd",
  brightMagenta: "#ddd6fe",
  cyan: "#81ecec",
  brightCyan: "#b8ffff",
  white: "#e5e7eb",
  brightWhite: "#f9fafb",
} as const;

function terminalText(value: string) {
  return value.replace(/\r?\n/g, "\r\n");
}

export function XtermTerminal({
  value,
  ariaLabel,
  className,
  minHeight = 320,
  prompt = "> ",
  disabled = false,
  placeholder = "",
  onCommand,
}: XtermTerminalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const commandRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);
  const propsRef = useRef({ onCommand, prompt, disabled });
  const interactive = Boolean(onCommand);

  propsRef.current = { onCommand, prompt, disabled };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: interactive,
      cursorStyle: "bar",
      disableStdin: !interactive,
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.45,
      scrollback: 5_000,
      theme: terminalTheme,
    });
    terminal.open(host);
    terminalRef.current = terminal;

    const resize = () => {
      const cellWidth = 8;
      const cellHeight = 19;
      terminal.resize(
        Math.max(20, Math.floor((host.clientWidth - 24) / cellWidth)),
        Math.max(6, Math.floor((host.clientHeight - 24) / cellHeight)),
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const redrawInput = () => {
      terminal.write("\x1b[2K\r");
      terminal.write(`${propsRef.current.prompt}${commandRef.current}`);
    };
    const dataDisposable = terminal.onData((data) => {
      const current = propsRef.current;
      if (!current.onCommand || current.disabled) return;
      if (data === "\r") {
        const command = commandRef.current.trim();
        terminal.write("\r\n");
        if (command) {
          historyRef.current.push(command);
          historyIndexRef.current = historyRef.current.length;
          current.onCommand(command);
        }
        commandRef.current = "";
        terminal.write(current.prompt);
      } else if (data === "\u007f") {
        if (commandRef.current) {
          commandRef.current = commandRef.current.slice(0, -1);
          terminal.write("\b \b");
        }
      } else if (data === "\u001b[A" || data === "\u001b[B") {
        const direction = data === "\u001b[A" ? -1 : 1;
        historyIndexRef.current = Math.max(
          0,
          Math.min(
            historyRef.current.length,
            historyIndexRef.current + direction,
          ),
        );
        commandRef.current = historyRef.current[historyIndexRef.current] ?? "";
        redrawInput();
      } else if (data >= " " && data !== "\u007f") {
        commandRef.current += data;
        terminal.write(data);
      }
    });

    return () => {
      dataDisposable.dispose();
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.reset();
    const output = value || placeholder;
    if (output) terminal.write(terminalText(output));
    if (interactive) {
      if (output && !output.endsWith("\n")) terminal.write("\r\n");
      terminal.write(`${prompt}${commandRef.current}`);
    }
    if (interactive) terminal.focus();
  }, [interactive, placeholder, prompt, value]);

  return (
    <div
      ref={hostRef}
      role="application"
      aria-label={ariaLabel}
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.08] bg-[#080d10] p-3",
        className,
      )}
      style={{ minHeight }}
    />
  );
}
