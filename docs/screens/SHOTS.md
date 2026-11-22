# README screenshots

Taken on Sun 22 Nov 2026 on the deployed app (https://called-it-inky.vercel.app). Night theme unless noted. Laptop 1440x900, phones 390x844 at 2x.
Cast: Asha hosts on a laptop; Ravi and Kabir join on phones. All three are in one real room on the live New Zealand v India Test. The /try replay uses the labelled demo BOT friends.

| File | What it shows |
|---|---|
| `01-landing.jpg` | Landing hero (night): "Watch apart. Call it together.", Start a room / Try the 3-minute demo, "35 matches live right now". |
| `01-landing-day.jpg` | The same hero in the day theme. |
| `02-live-matches.jpg` | "Pick your match": real live match tickets from the ESPN feed with LIVE/BREAK badges and real scores (NZ v IND Test, Indian domestic T20s, NBA Celtics v Kings). |
| `03-every-sport.jpg` | "Can't see yours? Search every match" opened on Ice hockey: 4 live NHL/college games with scores, plus the no-feed sports (Kabaddi, Badminton, Esports, Anything live). |
| `04-start-room.jpg` | Start-room sheet after picking NZ v IND: "Calling NZ v IND?", nickname (Asha) and pick-your-face grid. No sign-up. |
| `04b-start-room-match.jpg` | Step 2 of 2: the picked live match with its score, "The score updates itself from the live feed", Open room: NZ v IND. |
| `05-host-room.jpg` | Asha's room on the laptop: LED scoreboard with the live NZ v IND score ("UPDATED VIA NEXCONN PUSH", LIVE · 3), warm-up card, Dugout, and the host controls (pick the moment). |
| `06-calls-open-phone.png` | Ravi's phone: CALLS OPEN, "Next ball?", the countdown to the buzzer and the six call keys with their points. |
| `07-tally.jpg` | Host laptop while calls are open: live tally on each key (Dot 1 · 50%, Six 1 · 50%), countdown, the table, and the red LOCK NOW button. |
| `08-locked.jpg` | The moment the calls lock: LOCKED stamp on the host laptop, tally frozen, host controls switch to "What happened?". |
| `09-late-refused-phone.png` | Ravi taps Six just after the buzzer: the server refuses it with "LOCKED · 0.01S LATE"; his locked-in call (Four) stands. |
| `10-result-phone.png` | Asha calls the result (Four): "CALLED IT!" celebration on Ravi's phone, +10 PTS, "1 of 2 called it", Brag: I called it. |
| `11-table.png` | Ravi's Table tab after two balls: Ravi (you) 10, Kabir 5; 1/2 right; "Nexconn inside: live SDK log" entry. |
| `12-spoiler-shield-phone.png` | Kabir's Dugout with the spoiler shield set to 20 s (his stream runs behind). |
| `12b-shield-holding-phone.png` | Kabir's Play tab after the result: "SPOILER SHIELD HOLDING THIS RESULT FOR 20S"; the result stays hidden until his stream catches up. |
| `13-spam-refused-phone.png` | Betting spam ("join my telegram for betting tips") refused in the Dugout: red box, "Betting talk is blocked. It won't be delivered." |
| `14-nexconn-inside.jpg` | "Nexconn inside" panel on the host laptop: 3 in room, 13 cards, the live SDK log (onMetadataChanged, onMessageReceived CI:Moment / CI:Lock / CI:Result as priority cards) and the features in use. |
| `15-try-replay.jpg` | /try judge demo mid-ball: 2024 T20 World Cup final replay (SA 155/5, need 22 off 16, ball 3/19, real Cricsheet data), CALLS OPEN on Bumrah to Miller, the BOT friends' tally and table. |
| `16-full-time.jpg` | /try at full time: "India win by 7 runs. World champions.", "You called 5 of 19 right · 45 pts", final table, Play again / Share my score, BOT banter in the Dugout. |
| `17-impact.jpg` | /impact live traction page: people who joined, real match rooms, calls made, people who called, spam stopped (taken before this session's room: 96 / 52 / 13 / 13 / 0). |
| `18-landing-phone.png` | Landing hero on a phone. |

Retake: `tools/e2e/readme-shots.mjs` (driver) + `tools/e2e/readme-steps/*.mjs` (steps 01 to 09), then `python tools/e2e/readme-post.py`.
