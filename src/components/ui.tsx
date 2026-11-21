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

export function Wordmark({ className = "", size = "text-7xl" }: { className?: string; size?: string }) {
  return (
    <div className={`wordmark text-center ${size} ${className}`} aria-label="Called It">
      <div>CALLED</div>
      <div className="-mt-[0.04em]">IT!</div>
    </div>
  );
}

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2">
      <Art src="b3/pumped" className="h-9 w-9 transition-transform group-hover:-rotate-12 group-hover:scale-110" />
      <span className={`font-slab text-xl tracking-wide ${dark ? "text-ink" : "text-cream"}`} style={{ WebkitTextStroke: dark ? "0" : "1px #111" }}>
        CALLED IT
      </span>
    </Link>
  );
}

export function Sparkle({ className = "", color = "#fff" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`twinkle ${className}`} aria-hidden>
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill={color} />
    </svg>
  );
}

/** Puffy cartoon cloud band (white with a soft cream underside). */
export function Clouds({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className={className} aria-hidden>
      <path
        d="M0 140 C60 60 170 70 210 120 C240 50 360 40 400 110 C450 40 560 60 580 120 C640 70 720 80 750 130 C800 60 930 60 960 125 C1010 70 1110 70 1140 120 C1190 60 1310 60 1340 115 C1380 80 1430 95 1440 110 L1440 220 L0 220Z"
        fill="#fff"
      />
      <path
        d="M0 175 C80 130 170 140 230 170 C300 130 400 140 450 170 C520 135 640 140 700 172 C780 135 880 140 940 170 C1010 135 1120 140 1180 170 C1250 140 1360 140 1440 168 L1440 220 L0 220Z"
        fill="var(--cream)"
      />
    </svg>
  );
}

export function Ticker({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="ticker relative z-10 -rotate-1 py-2.5">
      <div className="ticker-track">
        {row.map((t, i) => (
          <span key={i} className="mx-6 font-mono text-sm font-bold uppercase tracking-wider">
            {t} <span className="mx-4">·</span>
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
      className={`shrink-0 rounded-full ${ring ? "ring-2 ring-ink ring-offset-2 ring-offset-yellow" : ""} ${className}`}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-3 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className={`rise brut-lg relative max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-paper p-6 ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <button
          onClick={onClose}
          className="btn btn-white btn-sm absolute right-4 top-4 !h-9 !w-9 !p-0 text-lg"
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`brut-sm rounded-2xl bg-white transition-colors ${open ? "bg-t-butter" : "hover:bg-t-butter/50"}`}>
      <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink text-lg transition-transform ${open ? "rotate-45 bg-yellow" : ""}`}>+</span>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Toast({ text, tone = "ink" }: { text: string | null; tone?: "ink" | "red" | "mint" }) {
  if (!text) return null;
  const bg = tone === "red" ? "bg-red text-white" : tone === "mint" ? "bg-mint" : "bg-ink text-white";
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className={`rise brut-sm rounded-full px-5 py-2.5 text-sm font-bold ${bg}`}>{text}</div>
    </div>
  );
}

export function useToast() {
  const [t, setT] = useState<{ text: string; tone: "ink" | "red" | "mint" } | null>(null);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(id);
  }, [t]);
  return {
    node: <Toast text={t?.text ?? null} tone={t?.tone} />,
    show: (text: string, tone: "ink" | "red" | "mint" = "ink") => setT({ text, tone }),
  };
}
