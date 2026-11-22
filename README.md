<div align="center">

# Called It

### Watch apart. Call it together.

A live watch-party room where friends who watch the same match in different places **call what happens next**.<br>
The server locks every call the moment the ball is bowled, so "I called it" finally comes with proof.<br>
**Real matches, live scores, points only, never money.**

[**▶ Open the live app**](https://called-it-inky.vercel.app) · [**Try the 3-minute demo**](https://called-it-inky.vercel.app/try) · [**Demo video**](#demo-video) · [**Live traction counter**](https://called-it-inky.vercel.app/impact)

Built on the **Nexconn Chat SDK** for the **Nexconn Build Challenge 2026** · Track: **Gaming & Live Streams** · Nexconn App Key: `m7ua80gbmcxbm`

<img src="docs/screens/01-landing.jpg" alt="Called It landing page: the CALLED IT wordmark, 'Watch apart. Call it together.', Start a room and Try the 3-minute demo buttons, and a count of matches live right now" width="900">

</div>

---

## Contents

1. [In 30 seconds](#in-30-seconds)
2. [Judges: start here (3 minutes)](#judges-start-here-3-minutes)
3. [How Called It meets the judging criteria](#how-called-it-meets-the-judging-criteria)
4. [The problem](#the-problem)
5. [It is live. Really live.](#it-is-live-really-live)
6. [The app, screen by screen](#the-app-screen-by-screen)
7. [Why this only works on Nexconn](#why-this-only-works-on-nexconn)
8. [Architecture](#architecture)
9. [How one call works](#how-one-call-works)
10. [How the room stays clean](#how-the-room-stays-clean)
11. [Fair by construction](#fair-by-construction)
12. [Tests and quality](#tests-and-quality)
13. [Traction and business](#traction-and-business)
14. [Roadmap](#roadmap)
15. [Run it yourself](#run-it-yourself)
16. [Project structure](#project-structure)
17. [Credits and data](#credits-and-data)

---

## In 30 seconds

- **Who it's for:** friends, hostel floors and fan clubs who watch the same live match apart (a phone on the bus, a laptop at home, the hostel TV) and talk in a group chat.
- **What goes wrong today:** every stream runs at its own delay, so the group chat spoils every wicket and goal for whoever is behind, and "I called it!" is always typed after the fact, with no proof.
- **What Called It does:** one friend hosts a room for a **real live match** (the room follows its live score) and shares one link. Before each big moment the host asks "Next ball?"; everyone taps a call; **the server locks calls at the moment of play** (a late tap is refused and told by how much); the result settles points, streaks and the table. A **spoiler shield** holds results and chat until each person's stream catches up.
- **Why Nexconn:** the whole game is the chat room. Every moment, lock, tally and result is a Nexconn message, the live score reaches every phone through Nexconn channel metadata, and spam is refused in the app and deleted from the room by our server through a Nexconn webhook. [Nine Nexconn features, mapped to code](#why-this-only-works-on-nexconn).
- **Proof it's real:** deployed at [called-it-inky.vercel.app](https://called-it-inky.vercel.app), playable with no sign-up, following matches that are live right now across cricket, NBA, NHL, F1, football and tennis, with [8 automated tests](#tests-and-quality) for the rules that keep it fair.

## Judges: start here (3 minutes)

| Step | Do this | What you should see |
|---|---|---|
| 1 | Open **[called-it-inky.vercel.app/try](https://called-it-inky.vercel.app/try)** and pick a nickname. No sign-up. | A replay of the last overs of the **2024 T20 World Cup final** (real ball-by-ball data from Cricsheet) with five demo friends, each marked **BOT**. |
| 2 | Call each ball before it is bowled. Then try tapping **after** the lock. | The server refuses the late tap and tells you how late it was (for example "Locked · 0.71 s late"). Points, streaks and the table update after each ball. |
| 3 | Open **Nexconn inside** (bottom left on a laptop, the Table tab on a phone). | The live Nexconn SDK log: channel entered, custom cards received, metadata changes, participants. |
| 4 | Go back to the [home page](https://called-it-inky.vercel.app) and look at **Pick your match**. | Matches that are **live right now**, with real scores and LIVE badges. Open one: the room's score bar updates by itself ("Updated via Nexconn push"). |
| 5 | Open the same room link on your phone or in a second browser. | Two people in one room: the host opens a call on one screen and it appears on the other in about a second. |
| 6 | Type `join my telegram for betting tips` in the chat. | Refused before anyone else sees it. |

## How Called It meets the judging criteria

| Criterion (weight) | What we built | Check it here |
|---|---|---|
| **Completeness and user experience (50%)** | A finished product, not a prototype: deployed; no sign-up; works on phone and laptop; day and night themes; ten sports (live score feeds for six of them); host controls; spoiler shield; reconnects; empty, error and 404 states; a 3-minute judge demo with labelled bots. | [Live app](https://called-it-inky.vercel.app) · [Screens](#the-app-screen-by-screen) · [Tests](#tests-and-quality) |
| **Innovation in a real communication problem (30%)** | Group chats during live sport break in two ways: different stream delays spoil the moment, and predictions have no proof. Called It fixes both inside one chat room: server-locked calls give the proof, a per-person spoiler shield holds results and chat, and spam and forged result cards never reach the room (refused in the app, deleted by the server through a Nexconn webhook). | [The problem](#the-problem) · [How one call works](#how-one-call-works) |
| **Business potential and traction (20%)** | A room is free to start and spreads by its own invite link (every host brings their friends). There is a public live counter of people, rooms and calls on our Nexconn App Key, and the product is clear for sponsors, leagues and creators. | [/impact](https://called-it-inky.vercel.app/impact) · [Traction and business](#traction-and-business) |
| **Nexconn SDK at the core** | Open channels, custom message types, priority messages, channel metadata, participant events, messages and reactions, the message:send webhook (pre-messaging handler ready), mute and message delete, the signed Server API with failover. | [Why this only works on Nexconn](#why-this-only-works-on-nexconn) |

## The problem

Friends rarely watch a match in one place any more. They watch apart and talk in a group chat, and that chat breaks at exactly the moments that matter:

1. **Everyone is on a different delay.** App and smart-TV streams can run up to **45 seconds** behind broadcast TV ([Uswitch, 2024](https://www.uswitch.com/media-centre/2024/06/Match-Delay-almost-half-Brits-report-sports-spoilers-neighbours-phone-due-broadband-lag/)), and some streams of the 2026 Super Bowl ran up to **62 seconds** behind the field ([Stats Perform via SVG, 2026](https://www.sportsvideo.org/2026/02/11/stats-perform-2026-super-bowl-latency-report/)). Phone notifications are the most common way scores get spoiled ([Uswitch](https://www.uswitch.com/media-centre/2024/06/Match-Delay-almost-half-Brits-report-sports-spoilers-neighbours-phone-due-broadband-lag/)). So whoever is furthest ahead spoils every wicket and goal for everyone behind.
2. **"I called it" has no proof.** A prediction typed into a group chat after the ball proves nothing, so the most fun part of watching together, calling it before it happens, turns into an argument.
3. **The chat is the place fans already gather.** 62% of Gen Z fans say messaging apps make them feel more connected to other fans during matches ([Snap/OnePoll via SVG, 2026](https://www.sportsvideo.org/2026/06/15/fifa-world-cup-2026-mid-half-water-breaks-create-new-opportunities-to-engage-gen-z-on-smartphones/)). The fix has to live inside a chat room, not in a separate app.

**Called It in one line:** a chat room where calls are locked by the server at the moment of play, results wait for your own stream, and the live score is the same on every phone.

## It is live. Really live.

Called It is not a mock-up with a fake scoreboard. The home page lists the matches **on air right now** from a public live scoreboard feed: cricket, NBA, NHL, F1, football and tennis. Pick one, and the room follows its real score.

<table>
<tr>
<td width="50%"><img src="docs/screens/02-live-matches.jpg" alt="Pick your match: tickets for matches live right now with LIVE badges and real scores"><br><sub><b>Pick your match.</b> Real matches live right now, with LIVE badges and real scores.</sub></td>
<td width="50%"><img src="docs/screens/03-every-sport.jpg" alt="Search every match, filtered to one sport, showing live games and scores"><br><sub><b>Every sport.</b> Search every live match, filtered by sport.</sub></td>
</tr>
</table>

**How the live score reaches every phone:** our server reads the feed (cached for 30 s), and when the score changes it writes it once to the room's **Nexconn open-channel metadata**. Every phone in the room gets it through `onMetadataChanged`, at the same moment and with no refresh. The score bar says so: *"Updated via Nexconn push"*. In our demo film you can watch a real NZ v India Test score tick from 77/2 to 78/2 inside the room.

## The app, screen by screen

### 1. Host picks a match and opens a room

<table>
<tr>
<td width="33%"><img src="docs/screens/04-start-room.jpg" alt="Start room sheet after picking NZ v IND: nickname and pick your face"><br><sub><b>No sign-up.</b> A nickname and a face; the server issues the Nexconn token.</sub></td>
<td width="33%"><img src="docs/screens/04b-start-room-match.jpg" alt="Step 2: the picked live match with its score, then Open room"><br><sub><b>The real match</b>, with its live score, becomes the room.</sub></td>
<td width="33%"><img src="docs/screens/05-host-room.jpg" alt="Host room on a laptop: live scoreboard updated via Nexconn push, Dugout and host controls"><br><sub><b>The host's room.</b> Live scoreboard ("Updated via Nexconn push"), host controls, Dugout.</sub></td>
</tr>
</table>

### 2. Everyone calls, then the server locks

<table>
<tr>
<td width="50%"><img src="docs/screens/07-tally.jpg" alt="Host laptop while calls are open: live tally on each key, countdown, table and LOCK NOW"><br><sub><b>Calls open.</b> Live tally on every key, the countdown and LOCK NOW.</sub></td>
<td width="50%"><img src="docs/screens/08-locked.jpg" alt="The lock moment: LOCKED stamp, tally frozen, host asked what happened"><br><sub><b>Locked at the ball.</b> The tally freezes; the host enters what happened.</sub></td>
</tr>
</table>

<table>
<tr>
<td width="33%"><img src="docs/screens/06-calls-open-phone.png" alt="Phone: CALLS OPEN, Next ball?, countdown and six call keys with points"><br><sub><b>Calls open</b> on every phone at once (a Nexconn priority message).</sub></td>
<td width="33%"><img src="docs/screens/09-late-refused-phone.png" alt="Phone: a tap just after the buzzer refused: LOCKED 0.01 s late"><br><sub><b>Late is late.</b> Even 0.01 s after the lock, the server refuses the tap.</sub></td>
<td width="33%"><img src="docs/screens/10-result-phone.png" alt="Phone: CALLED IT celebration, +10 points, 1 of 2 called it"><br><sub><b>Called it.</b> +10 points, and now there's proof.</sub></td>
</tr>
</table>

### 3. Spoiler shield and a clean room

<table>
<tr>
<td width="33%"><img src="docs/screens/12-spoiler-shield-phone.png" alt="Phone: Dugout with the spoiler shield set to 20 seconds"><br><sub><b>Spoiler shield.</b> Each person sets their own delay (5, 10, 20, 30 or 45 s).</sub></td>
<td width="33%"><img src="docs/screens/12b-shield-holding-phone.png" alt="Phone: spoiler shield holding this result for 20 seconds"><br><sub><b>Held, not spoiled.</b> The result waits for your stream.</sub></td>
<td width="33%"><img src="docs/screens/13-spam-refused-phone.png" alt="Phone: betting spam refused, it won't be delivered"><br><sub><b>Betting spam refused</b> before anyone sees it.</sub></td>
</tr>
</table>

### 4. The judge demo: the 2024 T20 World Cup final, ball by ball

<table>
<tr>
<td width="50%"><img src="docs/screens/15-try-replay.jpg" alt="Try demo mid-ball: T20 WC final 2024 replay, SA 155/5 need 22 off 16, calls open, BOT friends' tally and table"><br><sub><b>/try.</b> Real Cricsheet ball-by-ball data; five friends marked BOT.</sub></td>
<td width="50%"><img src="docs/screens/16-full-time.jpg" alt="Full time: India win by 7 runs, you called 5 of 19 right, final table, Play again and Share my score"><br><sub><b>Full time.</b> Final table, your score, Play again and Share.</sub></td>
</tr>
</table>

### 5. The table, Nexconn inside, traction, phone and day theme

<table>
<tr>
<td width="50%"><img src="docs/screens/14-nexconn-inside.jpg" alt="Nexconn inside panel: people in room, cards, live SDK log and features in use"><br><sub><b>Nexconn inside.</b> The live SDK log (onMetadataChanged, CI:Moment, CI:Lock, CI:Result), in the app.</sub></td>
<td width="50%"><img src="docs/screens/17-impact.jpg" alt="Impact page with live counts of people, rooms, calls, callers and blocked messages"><br><sub><b>/impact.</b> Public live counter of people, rooms, calls and blocked messages.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screens/01-landing-day.jpg" alt="Landing page in the day theme"><br><sub><b>Day theme</b> (switches automatically by local time, or by hand).</sub></td>
<td width="50%"><table><tr>
<td><img src="docs/screens/11-table.png" alt="Phone: the room table, Ravi 10 points, Kabir 5"><br><sub><b>The table.</b> Points and streaks, never money.</sub></td>
<td><img src="docs/screens/18-landing-phone.png" alt="Landing page on a phone"><br><sub><b>Phone first.</b></sub></td>
</tr></table></td>
</tr>
</table>

## Why this only works on Nexconn

Called It *is* a chat room: the game state travels as chat messages. Remove Nexconn and there is no room, no cards, no live score push and no way to stop spam before it lands. These are the Nexconn features we use, and where:

| Nexconn feature | What it does in Called It | Code |
|---|---|---|
| **Open channels** | Every match room is a Nexconn open channel: created by our server, entered by each player with `OpenChannel.enterChannel` (which also loads the last 30 messages for late joiners). Idle channels are recycled to stay under the Free-plan cap. | [`src/lib/server/nexconn.ts`](src/lib/server/nexconn.ts), [`src/lib/client/live.ts`](src/lib/client/live.ts) |
| **Custom message types** | `CI:Moment`, `CI:Lock`, `CI:Tally`, `CI:Pending`, `CI:Result`, registered with `NCEngine.registerCustomMessages` before connect. They drive the whole game screen. Only our server bot may send them; the client ignores any CI card from anyone else. | [`src/lib/game.ts`](src/lib/game.ts), [`src/lib/client/live.ts`](src/lib/client/live.ts) |
| **High-priority messages** | The moment, lock and result cards go out at priority 2, so they cut through a busy chat at the big moment. | `sendToRoom` in [`nexconn.ts`](src/lib/server/nexconn.ts) |
| **Channel metadata** | The room's phase and the **live score**, written only when they change; every client updates from `onMetadataChanged`, and late joiners catch up at once. | `setRoomMetadata`, [`src/lib/server/rooms.ts`](src/lib/server/rooms.ts) |
| **Participant events** | The live head count from `onParticipantChanged`. | [`src/lib/client/live.ts`](src/lib/client/live.ts) |
| **Messages and reactions** | Room chat and sticker reactions through the message handler; the spoiler shield delays them per person. | [`src/components/room/Room.tsx`](src/components/room/Room.tsx) |
| **Webhooks + message delete** | `message:send` calls our [`/api/webhook`](src/app/api/webhook/route.ts) for every room message; anything that breaks the room rules (betting spam, links, phone numbers, off-app invites, forged CI cards) is deleted for everyone through the Server API and counted on `/impact`. The same handler already answers `open_channel:pre_messaging` with `pass: 0` to refuse before delivery; that event is greyed out on our Free plan in the Console, so it switches on when the plan allows. | [`src/app/api/webhook/route.ts`](src/app/api/webhook/route.ts), `deleteRoomMessage` |
| **Mute** | The host can mute a player for 10 minutes through the Server API; everyone sees `onParticipantMuted`. | `muteInRoom` |
| **Server API** | SHA1-signed calls (token issue, channel create, send, metadata, mute, delete) with automatic failover to the backup domain. | [`src/lib/server/nexconn.ts`](src/lib/server/nexconn.ts) |
| **Call SDK (next)** | Voice and video huddles inside the room. The code is in the repo ([`Huddle.tsx`](src/components/room/Huddle.tsx), [`huddle.ts`](src/lib/client/huddle.ts)) behind `CALLS_ENABLED`, switched on once Call is enabled on our plan. | [`src/lib/game.ts`](src/lib/game.ts) |

**What we measured on the live deployment (22 Nov 2026):** a Nexconn token issued in 118 ms, an open channel created in 101 ms, and chat from one phone arriving on another in about 1 second.

## Architecture

![Architecture: browsers with the Nexconn Web SDK talk to the Nexconn Chat hub; our Next.js server on Vercel uses the Nexconn Server API and webhooks, Upstash Redis and the ESPN scoreboard feed](docs/diagrams/architecture.svg)

**In words:**
- **Browsers.** The host's laptop and friends' phones run the Next.js UI with the **Nexconn Web SDK**. They connect with a token, enter the room's open channel, send chat and stickers, and receive game cards, the live score (metadata) and the head count from Nexconn.
- **Our server.** Next.js on Vercel (Mumbai region) has three parts:
  - API routes for session, rooms, live matches, the webhook and impact
  - the room engine: open, call, lock, settle, the replay clock and score sync
  - a signed **Nexconn Server API** client that fails over to a backup host
- **What the server sends and gets.** It sends tokens, channel setup, `CI:*` cards at priority 2, metadata and mutes through the Server API. It receives the `message:send` webhook (and is ready for `pre_messaging`).
- **Upstash Redis** holds room state and the table, the atomic Lua lock (`callIfOpen`), leases and rate limits.
- **ESPN public scoreboard** supplies live scores, cached for 30 s and shared across server instances.
- **Next:** the dashed box is Nexconn Call SDK voice and video huddles.

Editable sources for every diagram are in [`docs/diagrams/`](docs/diagrams/) as `.excalidraw` files (open them at excalidraw.com).

### The user's journey

![User flow: host picks a live match, shares a link, friends join with a nickname, host asks, everyone calls, calls lock, the result settles points, banter, next moment](docs/diagrams/user-flow.svg)

1. The host picks a real live match (or names their own) and shares one link.
2. Friends join with a nickname: no app, no sign-up.
3. The host asks "Next ball?"; everyone taps a call.
4. Calls lock at the ball; late taps are refused.
5. The result settles points, streaks and the table; banter follows; the next moment opens.
6. Optional: the spoiler shield holds results and chat for 5 to 45 s per person. The [/try](https://called-it-inky.vercel.app/try) demo replays the 2024 T20 World Cup final, with the server asking every ball.

## How one call works

![Sequence: host opens a moment, players call, the Lua lock accepts, the host locks, a late tap is refused, the result settles](docs/diagrams/call-lock-flow.svg)

1. **Open.** The host asks "Next ball?". The server saves the moment and its lock time in Redis and sends `CI:Moment` at priority 2.
2. **Call.** A player's tap goes to `POST /api/rooms/[id]/call`. The Lua script `callIfOpen` accepts it only if the moment is still open and the server clock is before the lock time. A `CI:Tally` with the live counts goes out.
3. **Lock.** The host taps LOCK (or the timer ends). The moment is marked locked and `CI:Lock` goes out at priority 2.
4. **Late tap.** `callIfOpen` answers `locked`, and the player sees "Locked · 0.70 s late".
5. **Result.** An optional DRS or VAR review sends `CI:Pending`. When the host confirms the result, the server adds points and streak bonuses and sends `CI:Result` at priority 2.

## How the room stays clean

![Moderation: a chat message is checked by our webhook; refused with pass 0 or delivered with pass 1; message:send re-checks and deletes; the host can mute](docs/diagrams/moderation-flow.svg)

Every message meets the same rules ([`BLOCK_PATTERNS`](src/lib/game.ts)) three times:
1. **In the sender's app, before it is sent.** A hit is refused on the spot ("Betting talk is blocked. It won't be delivered."), so it never reaches the room.
2. **In every receiver's app.** Game cards from anyone but our server bot are ignored, and text that breaks the rules is hidden.
3. **On our server, through the Nexconn `message:send` webhook.** Anything that got past a modified client is deleted for everyone through the Server API and counted on `/impact`.

The diagram shows the full design, including Nexconn's synchronous `open_channel:pre_messaging` hook, which our handler already supports (`pass: 0` refuses before delivery). That event is greyed out on our Free plan in the Console, so today steps 1 to 3 do the job. The server-side checks are:
- Is the request really signed by Nexconn?
- Is it a game card (CI:*) sent by anyone other than our bot?
- Does it contain a link or a phone number?
- Does it contain betting words or an off-app invite?

Any hit is deleted (with `message:send`) or refused before delivery (with `pre_messaging`, where the plan has it). The host can also mute a player. To use the webhook on your own deployment, set it in the Nexconn Console: URL `https://<your host>/api/webhook`, event `message:send` (plus `open_channel:pre_messaging` if your plan offers it).

## Fair by construction

The model is simple: **the host proposes, the server's code decides, and everyone sees the same decision.**

- **Atomic lock.** A Redis Lua script ([`callIfOpen`](src/lib/server/store.ts)) accepts a call only while the moment is open and the server time is before its lock time. Changing your pick before the lock is allowed; after it, nothing gets in.
- **Only the host** opens, locks and settles a moment, and the host cannot call their own moment.
- **Only the server** may send game cards. A result card sent by a player is ignored by every client and deleted by the server.
- **Points only.** No wallets, stakes or payments anywhere. Betting words, links and phone numbers are blocked in chat.
- **Abuse limits.** Rate limits shared through Redis, a cross-site POST guard, signed session cookies and webhook signature checks with a 5-minute replay window.
- **Demo bots are honest.** They exist only in `/try` rooms, are labelled BOT in the UI, never get Nexconn tokens and are excluded from every traction number.

## Tests and quality

```bash
npm test
```

```
ok 1 - refuses betting spam, links, phone numbers and off-app invites
ok 2 - lets normal match banter through
ok 3 - accepts a call while the moment is open
ok 4 - refuses a call after the host locks
ok 5 - refuses a tap that lands after the timer's lock time, even by 1 ms
ok 6 - refuses a call for an old moment
ok 7 - every sport has presets with at least two unique options and positive points
ok 8 - covers the ten sports the app advertises
# pass 8 · fail 0
```

The tests cover the rules that make the game fair: the lock ([`tests/lock.test.ts`](tests/lock.test.ts)), the clean-room filter ([`tests/guard.test.ts`](tests/guard.test.ts)) and the sport presets ([`tests/presets.test.ts`](tests/presets.test.ts)). They use Node's built-in test runner, with no extra dependencies.

Also:
- TypeScript in strict mode and ESLint.
- Several rounds of browser QA on phones and laptops (see the commit history), covering:
  - reconnects
  - the keyboard on phones
  - double taps
  - stale moments
  - channel recycling under the Free-plan cap
  - shield edge cases
  - empty and error states

## Traction and business

**Live counter:** [called-it-inky.vercel.app/impact](https://called-it-inky.vercel.app/impact) shows, in real time:
- people who joined
- rooms opened
- calls made
- messages blocked

All of these are on our Nexconn App Key `m7ua80gbmcxbm`. Demo sessions on `/try` and bots are never counted.

**Who uses it:**
- groups of friends watching apart
- college hostels
- office leagues
- fan clubs that already gather in group chats on match nights

**Why it can grow:**
- Every room spreads through its own link. A host brings four or five friends, and some of them host the next match.
- It works for any live sport (and "anything live": finals, award shows, elections).
- Live sport runs every day somewhere: at the moment we recorded our demo there were 35 matches live across six sports.

**How it can make money, without betting:**
- **Sponsored rooms** for leagues, brands and streamers ("call the next over with us").
- **Premium rooms** for clubs and creators: season tables, custom questions, branded cards.
- **White-label** game rooms for sports apps and broadcasters.

All of it runs on Nexconn, so every new room is new monthly active users for Nexconn.

## Roadmap

- **Voice and video calls in the room** with the Nexconn Call SDK. The huddle code is already in the repo behind `CALLS_ENABLED`.
- **Season leagues:** a fan club's table across matches, in a Nexconn community channel.
- **Translation** in mixed-language rooms.
- **More live feeds:** kabaddi, badminton and esports.

## Run it yourself

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
npm test                     # 8 tests, no network needed
```

| Variable | What |
|---|---|
| `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET` | From the Nexconn Console |
| `NEXCONN_API_HOST`, `NEXCONN_API_HOST_BACKUP` | Server API hosts for your app's data center (this app: `api.us-light-api.com`, `api-b.us-light-api.com`) |
| `NEXT_PUBLIC_NEXCONN_AREA` | Client data center code (this app: `NA`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Room state. Without them an in-memory store is used (one server only) |

In the Nexconn Console, point the webhook at `https://<your host>/api/webhook` with the event `message:send` (and `open_channel:pre_messaging` if your plan offers it).

## Project structure

```
src/
  app/
    page.tsx                  landing: live matches, start a room
    r/[id]/page.tsx           the match room
    try/page.tsx              3-minute judge demo (2024 T20 WC final replay)
    impact/page.tsx           public traction counter
    api/
      session/                nickname -> signed session + Nexconn token
      rooms/                  create a room (a Nexconn open channel)
      rooms/[id]/             state, join, call, host, tick, score, huddle
      live/                   matches live now (ESPN scoreboard, cached)
      webhook/                Nexconn pre_messaging + message:send
      impact/                 traction numbers
  components/room/            Room, HostBar, HostPanel, NexconnPanel, Celebration, Huddle
  lib/
    game.ts                   sports, presets, CI:* message types, block rules
    client/live.ts            Nexconn Web SDK: connect, enter channel, handlers
    server/nexconn.ts         signed Nexconn Server API client with failover
    server/rooms.ts           room engine: open, call, lock, pending, settle, replay
    server/store.ts           Upstash Redis + the atomic Lua lock
    server/live.ts            live score feed
  data/t20wc2024final.json    ball-by-ball replay data (Cricsheet)
tests/                        npm test
docs/
  screens/                    screenshots used above
  diagrams/                   Excalidraw sources (.excalidraw) + SVG/PNG renders
```

**Stack:**
- Next.js 15, React 19, TypeScript, Tailwind 4
- `@nexconn/chat` and `@nexconn/engine` 26.2.0, plus `@nexconn/call` 26.2.1 (behind a flag)
- Upstash Redis
- Vercel

## Credits and data

- **Replay data:** [Cricsheet](https://cricsheet.org) match 1415755 (2024 T20 World Cup final), under the ODC-BY licence.
- **Live scores:** the ESPN public scoreboard feed.
- **Art:** the mascot, stickers and pixel scenes were made for this project. No real players, team kits or logos.

## Demo video

**[Watch the demo (3 min)](#demo-video)**: the real app in use, recorded live: matches on air across six sports, three friends in one room, a live Test match score ticking inside the room, calls locked at the ball, a ball-by-ball replay of the 2024 T20 World Cup final, and the Nexconn features behind each moment.

---

<div align="center">

**Called It** · Watch apart. Call it together.<br>
Built on Nexconn by team **Equinox 2.0** for the Nexconn Build Challenge 2026.

</div>
