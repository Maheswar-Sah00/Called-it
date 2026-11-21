"use client";

import { useEffect, useState } from "react";

/**
 * Day / night theme.
 * "auto" follows the viewer's local clock (their own time zone, e.g. IST in India):
 * night from 18:00 to 06:00. No location permission needed.
 */
export type ThemePref = "auto" | "day" | "night";
import { THEME_KEY as KEY } from "@/lib/theme-boot";

export function resolveTheme(pref: ThemePref, d = new Date()): "day" | "night" {
  if (pref !== "auto") return pref;
  const h = d.getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

export { themeBootScript } from "@/lib/theme-boot";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "day" || v === "night" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("auto");
  const [theme, setTheme] = useState<"day" | "night">("night");

  useEffect(() => {
    setPref(readPref());
  }, []);

  useEffect(() => {
    const apply = () => {
      const t = resolveTheme(pref);
      document.documentElement.dataset.theme = t;
      document.documentElement.dataset.themePref = pref;
      setTheme(t);
    };
    apply();
    if (pref !== "auto") return;
    const id = setInterval(apply, 60_000); // flips at 6 am / 6 pm on its own
    return () => clearInterval(id);
  }, [pref]);

  const choose = (p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* private mode: still works for this visit */
    }
    setPref(p);
  };
  return { pref, theme, choose };
}

function Icon({ k }: { k: ThemePref }) {
  if (k === "day")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
        <circle cx="8" cy="8" r="3.4" fill="currentColor" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
          <rect key={r} x="7.25" y="0.5" width="1.5" height="2.6" rx="0.7" fill="currentColor" transform={`rotate(${r} 8 8)`} />
        ))}
      </svg>
    );
  if (k === "night")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
        <path d="M10.8 1.5a6.5 6.5 0 1 0 3.7 10.6A5.5 5.5 0 0 1 10.8 1.5z" fill="currentColor" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
    </svg>
  );
}

/** Three-way keycap toggle: Day · Auto · Night. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { pref, theme, choose } = useTheme();
  const opts: { k: ThemePref; label: string }[] = [
    { k: "day", label: "Day" },
    { k: "auto", label: "Auto" },
    { k: "night", label: "Night" },
  ];
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl border-2 border-ink bg-stage-2 p-1 shadow-[0_3px_0_var(--shadow)] ${className}`}
      role="radiogroup"
      aria-label="Theme"
      title={pref === "auto" ? `Auto: ${theme} by your local time` : `${pref} mode`}
    >
      {opts.map((o) => {
        const on = pref === o.k;
        return (
          <button
            key={o.k}
            role="radio"
            aria-checked={on}
            onClick={() => choose(o.k)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-all ${
              on ? "bg-orange text-ink shadow-[0_2px_0_var(--shadow)]" : "text-on-muted hover:bg-stage-3 hover:text-on"
            }`}
          >
            <Icon k={o.k} />
            <span className={o.k === "auto" ? "" : "hidden sm:inline"}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
