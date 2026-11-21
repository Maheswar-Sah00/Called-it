import { liveMatches } from "@/lib/server/live";
import { SPORTS, type Sport } from "@/lib/game";
import { ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Matches live right now (and starting soon), per sport or "all". Source: ESPN public scoreboard. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("sport") ?? "all";
  const sport = q === "all" ? "all" : SPORTS.includes(q as Sport) ? (q as Sport) : "all";
  const matches = await liveMatches(sport);
  return ok({ matches, sport, source: "ESPN scoreboard", at: Date.now() });
}
