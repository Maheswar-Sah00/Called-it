# Called It: watch apart, call it together

A private room where friends who watch the same live match in different places call what happens next, together.
The server locks every call the moment the ball is bowled, so "I called it" finally comes with proof.
Points only, never money.

Built for the **Nexconn Build Challenge 2026** (track: Gaming & Live Streams) on the **Nexconn Chat SDK**.
Nexconn App Key: `m7ua80gbmcxbm`.

## Judges: start here

1. Open the live app: **https://called-it-inky.vercel.app**
2. Tap **Try the 3-minute demo** (`/try`). Pick a nickname: no sign-up.
3. You are dropped into a replay of the last three overs of the **2024 T20 World Cup final**, ball by ball from Cricsheet
   data, with five demo friends marked BOT. Call each ball before it is bowled. Try tapping late: the server refuses it
   and tells you by how much.
4. Open **Nexconn inside** (bottom left on a laptop, the Table tab on a phone) to watch the live SDK log.
5. To see a real room: go back to the home page, pick a live match (or name your own), open it in a second browser or on
   your phone, and play host.

Demo video: **[VIDEO URL]**

## The problem

Friends rarely watch a match in one place: one on the hostel TV, one on a phone on the bus, one on a laptop at home.
Every stream runs at its own delay. They react in a group chat, so whoever is furthest ahead spoils every wicket and
boundary for everyone behind, and "I called it!" is always typed after the ball, with no proof.

## What it does

- **One friend hosts.** They pick the match from a list of real live matches (the room then follows its live score) or
  name their own, and share one link. Friends join with a nickname.
- **The host asks** before a big moment ("Next ball?", "Runs this over?", "Penalty: scored or saved?" or their own
  question). Everyone taps a call.
- **Calls lock at the ball.** The host taps Lock, or a timer locks it. The server's clock decides; a late tap is refused
  and told how late it was.
- **The result settles** points, streaks and the table. DRS or VAR shows "under review" until the host confirms.
- **Spoiler shield.** Each person sets their own delay (5 to 45 s). Results and chat wait until their stream catches up.
- **Clean room.** Links, phone numbers, betting talk and forged result cards are refused before delivery. The host can
  mute anyone.
- Cricket, football, basketball, tennis, badminton, kabaddi, hockey, F1, esports, or anything live.

## Why this only works on Nexconn

The whole game is the chat room. Every moment, lock and result is a Nexconn message, and every rule that keeps the room
fair runs through a Nexconn feature:

| Nexconn feature | Where Called It uses it | Code |
|---|---|---|
| Open channels | Every match room is an open channel, created by the server and entered by each player with `OpenChannel.enterChannel` (which also loads the last 30 messages for late joiners). | `src/lib/server/nexconn.ts`, `src/lib/client/live.ts` |
| Custom message types | `CI:Moment`, `CI:Lock`, `CI:Result` and the other call cards, registered with `NCEngine.registerCustomMessages` before connect. They drive the game screen. | `src/lib/game.ts` |
| High-priority messages | Lock and result cards are sent at priority 2, so they cut through a busy chat at the big moment. | `sendToRoom` |
| Channel metadata | Room phase and live score, read by every client from `onMetadataChanged`; late joiners catch up at once. | `setRoomMetadata` |
| Participant events | The live head count from `onParticipantChanged`. | `src/lib/client/live.ts` |
| Messages | Room chat and sticker reactions through `MessageHandler`; the spoiler shield delays them per person. | `src/components/room/Room.tsx` |
| Pre-messaging webhook | `open_channel:pre_messaging` answers `pass:0` for betting spam and forged cards, so they are never delivered; a `message:send` webhook deletes anything that slips through. | `src/app/api/webhook/route.ts` |
| Mute and message delete | The host mutes a participant (everyone sees `onParticipantMuted`); the server deletes refused messages. | `muteInRoom`, `deleteRoomMessage` |
| Server API | Signed calls (tokens, channels, sends, metadata, mute, delete) with failover to the backup domain. | `src/lib/server/nexconn.ts` |

## Rules the server enforces

- **Atomic lock:** a Redis Lua script (`callIfOpen` in `src/lib/server/store.ts`) accepts a call only while the moment
  is open and the server time is before its lock time.
- **Only the host** opens, locks and settles a moment, and cannot call their own moment.
- **Only the server** may send game cards; a result card typed by a player is refused before delivery.
- **Points only:** no wallets or stakes; betting words, links and phone numbers are blocked in chat.

## Run it locally

```bash
npm install
# create .env.local with the variables below
npm run dev    # http://localhost:3000
```

Environment variables:

| Name | What |
|---|---|
| `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET` | From the Nexconn Console |
| `NEXCONN_API_HOST`, `NEXCONN_API_HOST_BACKUP` | Server API hosts for your app's data center |
| `NEXT_PUBLIC_NEXCONN_AREA` | Client data center code (this app: `NA`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Room state; without them an in-memory store is used (one server only) |

In the Nexconn Console, point the webhook at `https://<your host>/api/webhook` and turn on
`open_channel:pre_messaging` and `message:send`.

## Stack

Next.js 15, TypeScript, Tailwind 4, `@nexconn/chat` and `@nexconn/engine` 26.2.0, Upstash Redis. Replay data: Cricsheet
match 1415755 (2024 T20 World Cup final). Live scores: a public sports score feed.
