"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** One piece of art from /public/art, e.g. "b3/pumped". */
export function Art({
  src,
  alt = "",
  className = "",
  style,
  size,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/art/${src}.webp`}
      alt={alt}
      draggable={false}
      width={size}
      height={size}
      className={`select-none ${className}`}
      style={style}
    />
  );
}

/** The CALLED IT! sticker wordmark (layered: outline/extrude, red rim, amber fill with a glint). */
export function Wordmark({ className = "", size = "text-7xl", stacked = true }: { className?: string; size?: string; stacked?: boolean }) {
  const lines = stacked ? ["CALLED", "IT!"] : ["CALLED IT!"];
  const body = (
    <>
      {lines.map((l, i) => (
        <span key={i} className="block">
          {l}
        </span>
      ))}
    </>
  );
  return (
    <div className={`wm ${size} ${className}`} role="img" aria-label="Called It!">
      <span className="wm-back" aria-hidden>
        {body}
      </span>
      <span className="wm-rim" aria-hidden>
        {body}
      </span>
      <span className="wm-front" aria-hidden>
        {body}
      </span>
    </div>
  );
}

export function Brand() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-orange shadow-[0_4px_0_#000] transition-transform group-hover:-rotate-6 group-hover:scale-105">
        <Art src="b3/pumped" className="h-8 w-8" />
      </span>
      <span className="wm-small whitespace-nowrap text-xl sm:text-2xl">CALLED IT!</span>
    </Link>
  );
}

export function Star({ className = "", color = "var(--yellow)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`twinkle ${className}`} aria-hidden>
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill={color} />
    </svg>
  );
}

/** A floodlight tower (pixel-ish) for the stadium skyline. */
export function Floodlight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 120" className={className} aria-hidden>
      <rect x="27" y="34" width="6" height="86" fill="#3e2619" stroke="#000" strokeWidth="2" />
      <rect x="6" y="4" width="48" height="30" rx="4" fill="#2c1a12" stroke="#000" strokeWidth="2.5" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}${c}`} x={10 + c * 11} y={8 + r * 8.5} width="8" height="6" rx="1.5" fill="#fff3a8" className="twinkle" style={{ animationDelay: `${(r + c) * 0.3}s` }} />
        )),
      )}
    </svg>
  );
}

/** The pitch: mown stripes receding into the distance. */
export function Pitch({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none overflow-hidden [perspective:420px] ${className}`} aria-hidden>
      <div className="turf absolute inset-x-[-40%] bottom-0 top-0 origin-bottom [transform:rotateX(58deg)]" />
      <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-stage to-transparent" />
    </div>
  );
}

/** LED scoreboard marquee. */
export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`marquee led relative z-10 py-2.5 !shadow-none ${className}`}>
      <div className="marquee-track">
        {row.map((t, i) => (
          <span key={i} className="font-led led-text mx-5 text-2xl uppercase">
            {t} <span className="mx-4 text-orange">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Avatar({ id, size = 36, ring = false, className = "" }: { id?: string; size?: number; ring?: boolean; className?: string }) {
  return (
    <Art
      src={`c1/${id || "student"}`}
      size={size}
      className={`shrink-0 rounded-full ${ring ? "ring-[3px] ring-orange ring-offset-2 ring-offset-paper" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function Modal({ open, onClose, children, wide = false }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-[3px] sm:items-center" onClick={onClose}>
      <div
        className={`rise brut-lg relative max-h-[92vh] w-full overflow-y-auto rounded-[22px] bg-paper p-6 text-ink ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="absolute inset-x-0 top-0 h-2 rounded-t-[19px] bg-[repeating-linear-gradient(90deg,var(--orange)_0_18px,var(--yellow)_18px_36px)]" />
        <button onClick={onClose} className="key key-paper key-sm absolute right-4 top-5 !h-9 !w-9 !p-0 text-lg" aria-label="Close">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export function Faq({ q, a, n }: { q: string; a: string; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b-2 border-dashed border-ink/25 transition-colors ${open ? "bg-k-butter/60" : "hover:bg-k-butter/30"}`}>
      <button className="flex w-full items-center gap-4 px-3 py-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-led w-8 shrink-0 text-2xl text-orange-d">{String(n).padStart(2, "0")}</span>
        <span className="flex-1 font-display text-lg font-bold">{q}</span>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-ink text-lg font-bold shadow-[0_3px_0_#000] transition-all ${open ? "rotate-45 bg-orange" : "bg-paper"}`}
        >
          +
        </span>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="pb-5 pl-15 pr-12 text-[15px] leading-relaxed text-muted">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Toast({ text, tone = "ink" }: { text: string | null; tone?: "ink" | "red" | "mint" }) {
  if (!text) return null;
  const bg = tone === "red" ? "bg-red text-white" : tone === "mint" ? "bg-lime text-ink" : "bg-paper text-ink";
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 lg:bottom-8">
      <div className={`rise brut-sm rounded-xl px-5 py-2.5 text-sm font-bold ${bg}`}>{text}</div>
    </div>
  );
}

export function useToast() {
  const [t, setT] = useState<{ text: string; tone: "ink" | "red" | "mint"; n: number } | null>(null);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(id);
  }, [t]);
  return {
    node: <Toast text={t?.text ?? null} tone={t?.tone} />,
    show: (text: string, tone: "ink" | "red" | "mint" = "ink") => setT({ text, tone, n: Date.now() }),
  };
}
