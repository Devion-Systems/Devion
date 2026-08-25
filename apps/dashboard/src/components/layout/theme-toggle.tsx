"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Toggles between dark and light mode by toggling the `dark` class on <html>.
 * Persists the preference to localStorage.
 *
 * NOTE: The root layout must NOT hard-code `class="dark"` on <html>
 * for this toggle to work. The initial theme should be set by an inline
 * script to avoid FOUC (see ThemeScript component).
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Read persisted preference or fall back to system
    const stored = localStorage.getItem("devion-theme");
    if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("devion-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("devion-theme", "light");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200 light:hover:bg-zinc-100 light:hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Inline script to set the initial theme before React hydrates,
 * preventing flash of unstyled content (FOUC).
 * Place inside <head> in layout.tsx.
 */
export function ThemeScript() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled inline script to prevent FOUC
      dangerouslySetInnerHTML={{
        __html: `
(function(){
  try {
    var t = localStorage.getItem('devion-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`,
      }}
    />
  );
}
