import "server-only";
import type { Option } from "@/lib/game";

/**
 * Demo friends for the judge demo only. They exist only in demo rooms, are
 * labelled "🤖 demo" in the UI, never get Nexconn tokens, and are excluded from
 * every traction number. Their calls go through the same code path as people's.
 */
export const BOT_NAMES: Record<string, string> = {
  bot_aman: "Aman 🤖",
  bot_priya: "Priya 🤖",
  bot_kabir: "Kabir 🤖",
  bot_meera: "Meera 🤖",
  bot_dev: "Dev 🤖",
};

export const BOT_AVATARS: Record<string, string> = {
  bot_aman: "chai-uncle",
  bot_priya: "facepaint",
  bot_kabir: "gamer",
  bot_meera: "grandma",
  bot_dev: "popcorn",
};

const WEIGHTS: Record<string, number> = { "0": 30, "1-3": 32, "4": 14, "6": 8, W: 11, EX: 5 };

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

export function botCall(options: Option[], botId: string): string {
  const r = hash(botId + Date.now().toString().slice(0, -3)) * 0.5 + Math.random() * 0.5;
  const ws = options.map((o) => WEIGHTS[o.id] ?? 10);
  const sum = ws.reduce((a, b) => a + b, 0);
  let x = r * sum;
  for (let i = 0; i < options.length; i++) {
    x -= ws[i];
    if (x <= 0) return options[i].id;
  }
  return options[0].id;
}

export function botLine(outcome: string, detail?: string): string | null {
  if (outcome === "W" && detail?.includes("Yadav")) return "SKY WHAT A CATCH 😱😱😱";
  if (outcome === "W") return "GONE!! 🔥 Called it 😎";
  if (outcome === "6") return "That's out of the ground 🚀";
  if (outcome === "4") return "Four! Pressure's back on 😬";
  if (outcome === "0" && Math.random() < 0.3) return "Bumrah is unreal 🙌";
  return null;
}
