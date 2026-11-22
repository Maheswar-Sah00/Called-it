import { createRoom } from "@/lib/server/rooms";
import { readSession } from "@/lib/server/session";
import { clientIp, crossSite, fail, limited, ok, readBody, str } from "@/lib/server/http";
import { SPORTS, type Sport } from "@/lib/game";

export const dynamic = "force-dynamic";


/** Create a match room (a Nexconn open channel). The creator is the host. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return fail(401, "Join with a nickname first");
  if (crossSite(req)) return fail(403, "Open Called It directly to make a room");
  if (await limited(`room:${s.userId}`, 6, 60_000)) return fail(429, "Slow down: too many rooms");
  if (await limited(`roomip:${clientIp(req)}`, 15, 10 * 60_000)) return fail(429, "Too many new rooms from here. Reuse your room link");
  const body = (await readBody(req)) as {
    name?: string;
    sport?: Sport;
    mode?: "host" | "replay";
    demo?: boolean;
    match?: { id?: string; sport?: string; title?: string; league?: string };
  };
  const sport = SPORTS.includes(body.sport as Sport) ? (body.sport as Sport) : "cricket";
  const mode = body.mode === "replay" ? "replay" : "host";
  const name = str(body.name, 60).trim().slice(0, 40) || (mode === "replay" ? "T20 WC Final 2024 replay" : "Match night");
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
        body.match && typeof body.match === "object" && str(body.match.id, 40) && mode === "host"
          ? {
              id: str(body.match.id, 40),
              sport,
              title: str(body.match.title, 80) || name,
              league: str(body.match.league, 60),
            }
          : null,
    });
    return ok({ room, channelMs });
  } catch (e) {
    console.error("room create failed", e);
    return fail(502, "Couldn't open the room right now. Try again in a moment.");
  }
}
