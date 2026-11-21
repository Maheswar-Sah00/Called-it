"use client";

import { useState } from "react";
import { SPORT_ART, SPORT_LABEL, type LiveMatch, type Sport } from "@/lib/game";
import { Art, Brand, Faq, Wordmark } from "@/components/ui";
import { StartRoom } from "@/components/StartRoom";
import { HeroScoreboard } from "@/components/HeroScoreboard";
import { ThemeToggle } from "@/components/Theme";
import { LiveBrowser, MatchRow, useLive } from "@/components/LiveMatches";

const FAQS = [
  { q: "Is this betting?", a: "No. Called It is points only, never money. No stakes, no wallets, no odds. Betting talk, links and phone numbers are blocked before they reach the room." },
  { q: "Do I need to sign up?", a: "No. Pick a nickname and a face. Share the room link and your friends are in within seconds." },
  { q: "Where do we watch the match?", a: "Wherever you already do: TV, a streaming app, the radio. Called It is the second screen that sits next to it." },
  { q: "How does the lock work?", a: "The server stamps every call when it arrives. Once the host taps Lock (or the timer runs out), a late call is refused, with proof of how late it was." },
  { q: "My stream is behind my friends'. Spoilers?", a: "Turn on the spoiler shield in the room. It holds back results and chat for you by the delay you pick." },
  { q: "What about DRS and VAR?", a: "The host marks the moment 'under review'. Points wait until the decision is in, so nobody celebrates early." },
  { q: "Which sports work?", a: "Any live sport. Cricket, football, basketball, tennis, badminton, kabaddi, hockey, F1 and esports have ready-made questions. For anything else, type your own." },
  { q: "Can I try it with nobody online?", a: "Yes. The 60-second demo replays the last five overs of the 2024 T20 World Cup final, ball by ball, with labelled demo bots." },
];

/** The eleven Nexconn features Called It uses, laid out as a 4-3-3. */
const NEXCONN_XI = [
  { k: "Server API + tokens", pos: "GK", art: "b2/lock", x: 50, y: 88, d: "Signed server calls (SHA1 signature) with automatic failover to the backup domain; mints each player's access token from just a nickname." },
  { k: "Open channels", pos: "LB", art: "b2/scoreboard", x: 16, y: 68, d: "Every match room is a Nexconn open channel, made for live crowds and created on the fly." },
  { k: "Web SDK connect", pos: "CB", art: "b1/controller", x: 38, y: 72, d: "NCEngine connects each browser to the North America data centre; one shared connection per player." },
  { k: "Custom message types", pos: "CB", art: "b2/check", x: 62, y: 72, d: "CI:Moment, CI:Lock, CI:Pending and CI:Result game cards, registered before connect." },
  { k: "High-priority messages", pos: "RB", art: "b2/megaphone", x: 84, y: 68, d: "Lock and result cards go out at priority 2, so they cut through a busy chat." },
  { k: "Status messages", pos: "CM", art: "b2/foam-finger", x: 28, y: 47, d: "Live tallies and sticker reactions travel as status messages: instant, never stored." },
  { k: "Channel metadata", pos: "CM", art: "b2/replay", x: 50, y: 50, d: "The real match score is written into open-channel metadata only when it changes, and Nexconn pushes it to every phone in the room. No polling. Late joiners get it on entry." },
  { k: "Participant events", pos: "CM", art: "c1/student", x: 72, y: 47, d: "onParticipantChanged powers the live head count on the scoreboard." },
  { k: "Pre-messaging webhook", pos: "LW", art: "b2/cross", x: 20, y: 24, d: "open_channel:pre_messaging refuses betting spam, links, phone numbers and forged result cards before delivery ({pass: 0})." },
  { k: "Mute + message delete", pos: "ST", art: "b1/whistle", x: 50, y: 18, d: "The host mutes a participant; the message:send webhook deletes anything that slips through." },
  { k: "Open-channel chat", pos: "RW", art: "b5/heart", x: 80, y: 24, d: "The dugout: real-time banter with message history for anyone who walks in mid-match." },
];

const OVER = [
  { n: "1", t: "Start a room", d: "Pick the sport. You're the host." },
  { n: "2", t: "Share the link", d: "Friends join with a nickname. No sign-up." },
  { n: "3", t: "Call it", d: "The host opens a moment. Everyone taps an answer." },
  { n: "", art: "b2/lock", t: "Locked", d: "Calls close the instant it happens. Late taps bounce.", hot: true },
  { n: "", art: "b2/replay", t: "Under review", d: "DRS or VAR? Points wait for the decision." },
  { n: "", art: "b2/crown", t: "Settle & brag", d: "Points, streaks and a live table, all at once.", win: true },
];

export default function Home() {
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState<Sport | undefined>();
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const featured = useLive("all");
  const liveNow = (featured ?? []).filter((m) => m.status === "live");
  const start = (s?: Sport, m?: LiveMatch | null) => {
    setSport(s);
    setMatch(m ?? null);
    setOpen(true);
  };

  return (
    <main className="overflow-x-hidden">
      {/* ================= HERO ================= */}
      <section className="flood relative">
        <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5">
          <Brand />
          <div className="hidden items-center gap-7 text-sm font-bold text-on-muted md:flex">
            <a href="#live" className="transition hover:text-orange">
              Live now
            </a>
            <a href="#how" className="transition hover:text-orange">
              How it works
            </a>
            <a href="#nexconn" className="transition hover:text-orange">
              Built on Nexconn
            </a>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <button className="key key-sm hidden sm:inline-flex" onClick={() => start()}>
              Start a room
            </button>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <a
              href="#nexconn"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-stage-2/70 py-1 pl-1 pr-3 text-xs font-bold text-on-muted backdrop-blur transition hover:text-on"
            >
              <span className="rounded-full bg-orange px-2 py-0.5 text-[11px] font-extrabold text-ink">NEW</span>
              Built on Nexconn for the Build Challenge 2026
            </a>
            <h1 className="font-display mt-6 text-[3.1rem] font-extrabold leading-[0.98] tracking-[-0.035em] sm:text-[4.6rem]">
              Watch apart.
              <br />
              <span className="text-orange">Call it together.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-on-muted">
              Pick the match you&apos;re watching, bring your friends, and call the next ball, penalty or point. The server locks it the
              moment it happens.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button className="key text-lg" onClick={() => start()}>
                Start a room
              </button>
              <a href="/try" className="group inline-flex items-center gap-2 px-2 py-3 text-base font-bold text-on transition hover:text-orange">
                <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-current transition-transform group-hover:scale-110">
                  <svg viewBox="0 0 12 12" className="ml-0.5 h-3 w-3" aria-hidden>
                    <path d="M2 1l9 5-9 5z" fill="currentColor" />
                  </svg>
                </span>
                60-second demo
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-on-muted">
              <span className="flex items-center gap-2">
                <span className="live-dot" />
                <b className="text-on">{featured ? liveNow.length : "…"}</b> matches live now
              </span>
              <span className="hidden h-4 w-px bg-line sm:block" />
              <span>No sign-up</span>
              <span className="hidden h-4 w-px bg-line sm:block" />
              <span>Points, never money</span>
            </div>
          </div>

          {/* live right now */}
          <div className="relative">
            <Art src="b3/pumped" className="absolute -right-3 -top-12 z-10 hidden w-24 rotate-6 sm:block" />
            <div className="brut-lg rounded-[26px] bg-stage-2 p-4 sm:p-5">
              <div className="flex items-center justify-between px-1">
                <p className="font-display text-lg font-extrabold">Live right now</p>
                <a href="#live" className="text-xs font-bold text-on-muted transition hover:text-orange">
                  See all →
                </a>
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {featured === null &&
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[7.5rem] animate-pulse rounded-2xl border-2 border-line bg-stage-3/60" />)}
                {(liveNow.length ? liveNow : featured ?? []).slice(0, 3).map((m) => (
                  <MatchRow key={m.sport + m.id} m={m} onPick={(x) => start(x.sport, x)} />
                ))}
              </div>
              <p className="mt-3 px-1 text-[11px] text-on-muted">Scores update every 30 seconds. Tap a match to open a room for it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LIVE NOW ================= */}
      <section id="live" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange">Live now</p>
            <h2 className="font-display mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Pick your match</h2>
          </div>
          <p className="max-w-sm text-on-muted">Every match on air right now, from Test cricket to the Premier League. Search for yours and open a room.</p>
        </div>
        <div className="mt-8">
          <LiveBrowser onPick={(m) => start(m.sport, m)} limit={9} />
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-line p-4">
          <p className="mr-2 text-sm font-bold">Kabaddi, badminton, esports or your gully final?</p>
          {(["kabaddi", "badminton", "esports", "other"] as Sport[]).map((s) => (
            <button key={s} onClick={() => start(s)} className="chip">
              <Art src={SPORT_ART[s].bolo} className="h-5 w-5" /> {SPORT_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="scroll-mt-6 bg-stage-2 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange">How it works</p>
            <h2 className="font-display mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">One over, start to finish</h2>
            <ol className="mt-8 flex flex-col gap-5">
              {OVER.map((b, i) => (
                <li key={b.t} className="group flex gap-4">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-ink font-display text-base font-extrabold shadow-[0_3px_0_var(--shadow)] transition-transform group-hover:-translate-y-0.5 ${
                      b.hot ? "bg-red text-white" : b.win ? "bg-lime text-ink" : "bg-paper text-ink"
                    }`}
                  >
                    {b.art ? <Art src={b.art} className="h-7 w-7" /> : i + 1}
                  </span>
                  <div>
                    <p className="font-display text-lg font-extrabold">{b.t}</p>
                    <p className="text-sm text-on-muted">{b.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <HeroScoreboard />
        </div>
      </section>

      {/* ================= HOUSE RULES: tactics board ================= */}
      <section className="px-4 py-10">
        <div className="chalkboard relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border-[3px] border-ink p-6 text-paper shadow-[8px_8px_0_var(--shadow)] sm:p-10">
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden>
            <rect x="20" y="20" width="760" height="360" fill="none" stroke="#fff" strokeWidth="3" />
            <line x1="400" y1="20" x2="400" y2="380" stroke="#fff" strokeWidth="3" />
            <circle cx="400" cy="200" r="60" fill="none" stroke="#fff" strokeWidth="3" />
            <path d="M120 300 C 220 220, 300 260, 360 170" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="10 8" />
            <path d="M350 160 l18 6 -8 17" fill="none" stroke="#fff" strokeWidth="3" />
            <text x="100" y="320" fill="#fff" fontSize="34" fontFamily="sans-serif">X</text>
            <circle cx="620" cy="120" r="14" fill="none" stroke="#fff" strokeWidth="3" />
            <circle cx="680" cy="250" r="14" fill="none" stroke="#fff" strokeWidth="3" />
          </svg>
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange">THE GAME PLAN</p>
              <h2 className="font-display mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">House rules</h2>
              <p className="mt-5 text-lg font-bold">
                Not a <s className="decoration-red decoration-[3px]">betting app</s>. Not a <s className="decoration-red decoration-[3px]">poll</s>. Not a{" "}
                <s className="decoration-red decoration-[3px]">group chat</s>.
              </p>
              <p className="mt-3 max-w-md text-paper/75">It&apos;s the sofa you used to share, rebuilt for friends who watch from different places.</p>
              <Art src="c2/cricket-umpire" className="mt-6 hidden w-36 lg:block" />
            </div>
            <div className="flex flex-col gap-4">
              {[
                { n: "01", t: "The lock is real.", d: "Calls close the moment it happens, on the server's clock. A late tap gets “Locked” and the exact delay.", art: "b2/lock", c: "bg-yellow" },
                { n: "02", t: "Only the server posts results.", d: "Forged result cards and betting spam are refused before they're delivered to anyone.", art: "b2/check", c: "bg-k-leaf" },
                { n: "03", t: "Points, never money.", d: "Bragging rights, streak bonuses and a live table. No stakes, no odds, no wallets.", art: "b2/crown", c: "bg-k-rose" },
              ].map((r, i) => (
                <div
                  key={r.n}
                  className={`group flex items-center gap-4 rounded-2xl border-[2.5px] border-ink ${r.c} p-4 text-ink shadow-[5px_5px_0_var(--shadow)] transition-transform duration-200 hover:-translate-y-1 hover:rotate-[-0.6deg] ${i === 1 ? "lg:ml-10" : i === 2 ? "lg:ml-4" : ""}`}
                >
                  <span className="font-led text-4xl text-ink/40">{r.n}</span>
                  <div className="flex-1">
                    <p className="font-display text-xl font-extrabold">{r.t}</p>
                    <p className="mt-0.5 text-sm text-ink/75">{r.d}</p>
                  </div>
                  <Art src={r.art} className="h-14 w-14 shrink-0 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= BUILT ON NEXCONN: the team sheet ================= */}
      <section className="mx-auto max-w-6xl px-4 pt-24" id="nexconn">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange">BUILT FOR THE NEXCONN BUILD CHALLENGE 2026</p>
            <h2 className="font-display mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">The starting XI</h2>
            <p className="mt-2 max-w-xl text-on-muted">
              Every live moment in Called It runs on Nexconn. Here&apos;s the team sheet: eleven Nexconn features, and the job each one plays.
            </p>
          </div>
          <div className="led rounded-xl px-4 py-3 text-center">
            <p className="font-led text-lg text-paper/60">POWERED BY</p>
            <p className="font-arcade text-2xl text-yellow">NEXCONN CHAT</p>
            <p className="font-led text-lg text-paper/60">WEB SDK 26.2 · SERVER API</p>
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          {/* formation */}
          <div className="turf relative aspect-[4/5] overflow-hidden rounded-[24px] border-[3px] border-ink shadow-[8px_8px_0_var(--shadow)]">
            <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full" aria-hidden>
              <rect x="5" y="5" width="90" height="115" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <line x1="5" y1="62.5" x2="95" y2="62.5" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <circle cx="50" cy="62.5" r="11" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <rect x="30" y="5" width="40" height="16" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <rect x="30" y="104" width="40" height="16" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
            </svg>
            {NEXCONN_XI.map((p, i) => (
              <a
                key={p.k}
                href={`#nx-${i + 1}`}
                className="group absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-ink bg-orange font-arcade text-sm text-ink shadow-[0_3px_0_var(--shadow)] transition-transform hover:z-10 hover:scale-125"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                title={p.k}
              >
                {i + 1}
                <span className="pointer-events-none absolute top-full mt-1 hidden whitespace-nowrap rounded-md border-2 border-ink bg-paper px-1.5 text-[11px] font-bold group-hover:block">
                  {p.k}
                </span>
              </a>
            ))}
            <span className="font-led absolute bottom-2 left-3 rounded bg-black/50 px-2 text-lg text-paper">FORMATION 4-3-3 · CALLED IT FC</span>
          </div>
          {/* team sheet */}
          <div className="paper brut-lg overflow-hidden rounded-[24px]">
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-orange px-5 py-3">
              <p className="font-arcade text-lg">TEAM SHEET</p>
              <p className="font-led text-xl">NEXCONN XI</p>
            </div>
            <ol>
              {NEXCONN_XI.map((p, i) => (
                <li
                  key={p.k}
                  id={`nx-${i + 1}`}
                  className="group flex items-start gap-3 border-b-2 border-dashed border-ink/20 px-5 py-3 transition-colors last:border-0 hover:bg-k-butter/60"
                >
                  <span className="font-led w-7 shrink-0 text-3xl leading-none text-orange-d">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-extrabold">
                      {p.k} <span className="font-led ml-1 text-lg font-normal text-muted">· {p.pos}</span>
                    </p>
                    <p className="text-sm text-muted">{p.d}</p>
                  </div>
                  <Art src={p.art} className="h-9 w-9 shrink-0 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-3 border-t-[3px] border-ink bg-k-butter px-5 py-3">
              <span className="font-led shrink-0 rounded border-2 border-ink bg-orange px-1 text-xl leading-tight">SUB</span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-extrabold">
                  Nexconn Call SDK <span className="font-led ml-1 text-lg font-normal text-muted">· voice + video huddles</span>
                </p>
                <p className="text-sm text-muted">
                  Multi-party voice and video in every room: one tap to start, the room gets a priority “huddle is live” card, friends pick up or join late.
                </p>
              </div>
              <Art src="b1/controller" className="h-9 w-9 shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= ASK THE UMPIRE ================= */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.6fr]">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange">FAQ</p>
            <h2 className="font-display mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Questions, answered</h2>
            <Art src="c2/football-referee" className="mt-6 w-40" />
          </div>
          <div className="paper brut-lg overflow-hidden rounded-[24px] px-3 py-2 sm:px-6">
            {FAQS.map((f, i) => (
              <Faq key={f.q} n={i + 1} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="flood relative px-4 pb-14 pt-24 text-center">
        <div className="flex justify-center">
          <Wordmark size="text-6xl sm:text-8xl" stacked={false} />
        </div>
        <p className="font-display mt-6 text-xl font-bold">Watch apart. Call it together.</p>
        <button className="key mt-8 text-lg" onClick={() => start()}>
          Start a room
        </button>
        <div className="mx-auto mt-14 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-on-muted">
          <span>Built on Nexconn Chat for the Nexconn Build Challenge 2026 · Points only, never money</span>
          <span className="flex items-center gap-4">
            <a className="hover:text-orange" href="/impact">
              Live impact
            </a>
            <a className="hover:text-orange" href="/try">
              Demo
            </a>
            <ThemeToggle />
          </span>
        </div>
      </footer>

      <StartRoom open={open} onClose={() => setOpen(false)} sport={sport} match={match} />
    </main>
  );
}
