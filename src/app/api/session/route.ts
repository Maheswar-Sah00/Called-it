import { appKey, issueToken } from "@/lib/server/nexconn";
import { cleanName, newUserId, readSession, writeSession } from "@/lib/server/session";
import { clientIp, crossSite, fail, limited, ok, readBody } from "@/lib/server/http";
import { sadd } from "@/lib/server/store";
import { AVATARS } from "@/lib/game";

export const dynamic = "force-dynamic";

/** Who am I? Returns the session plus a fresh Nexconn access token. */
export async function GET() {
  const s = await readSession();
  if (!s) return ok({ session: null });
  const t = await issueToken(s.userId, s.name);
  return ok({ session: s, token: t.token, appKey: appKey(), tokenMs: t.ms });
}

/** Join with a nickname. No sign-up: the server mints an id and a Nexconn token. */
export async function POST(req: Request) {
  if (crossSite(req)) return fail(403, "Open Called It directly to join");
  const ip = clientIp(req);
  if (await limited(`session:${ip}`, 20, 60_000)) return fail(429, "Too many joins, try again in a minute");
  const body = (await readBody(req)) as { name?: string; demo?: boolean; avatar?: string };
  const avatar = (AVATARS as readonly string[]).includes(body.avatar ?? "") ? body.avatar : "student";
  const name = cleanName(body.name);
  if (!name) return fail(400, "Pick a nickname");
  const existing = await readSession();
  const userId = existing?.userId ?? newUserId();
  await writeSession({ userId, name, avatar });
  const t = await issueToken(userId, name);
  if (!body.demo) await sadd("impact:users", userId);
  return ok({ session: { userId, name, avatar }, token: t.token, appKey: appKey(), tokenMs: t.ms });
}
