import { createRoom } from "@/lib/server/rooms";
import { readSession } from "@/lib/server/session";
import { fail, limited, ok } from "@/lib/server/http";
import { SPORTS, type Sport } from "@/lib/game";

export const dynamic = "force-dynamic";


/** Create a match room (a Nexconn open channel). The creator is the host. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return fail(401, "Join with a nickname first");
  if (limited(`room:${s.userId}`, 6, 60_000)) return fail(429, "Slow down: too many rooms");
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sport?: Sport;
    mode?: "host" | "replay";
    demo?: boolean;
    match?: { id?: string; sport?: string; title?: string; league?: string };
  };
  const sport = SPORTS.includes(body.sport as Sport) ? (body.sport as Sport) : "cricket";
  const mode = body.mode === "replay" ? "replay" : "host";
  const name = (body.name ?? "").toString().trim().slice(0, 40) || (mode === "replay" ? "T20 WC Final 2024 replay" : "Match night");
  try {
    const { room, channelMs } = await createRoom({
      name,
      sport: mode === "replay" ? "cricket" : sport,
      mode,
      hostId: s.userId,
      hostName: s.name,
      hostAvatar: s.avatar,
      demo: !!body.demo,
      match:
        body.match?.id && mode === "host"
          ? {
              id: String(body.match.id).slice(0, 40),
              sport,
              title: String(body.match.title ?? name).slice(0, 80),
              league: String(body.match.league ?? "").slice(0, 60),
            }
          : null,
    });
    return ok({ room, channelMs });
  } catch (e) {
    return fail(502, "Could not create the room on Nexconn", { detail: String(e) });
  }
}
