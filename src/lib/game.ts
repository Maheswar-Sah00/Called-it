/** Shared game definitions (client + server). */

export type Sport = "cricket" | "football" | "tennis" | "kabaddi" | "other";

export type Option = { id: string; label: string; points: number };

export type Preset = { key: string; q: string; options: Option[] };

export const CRICKET_BALL: Option[] = [
  { id: "0", label: "Dot", points: 5 },
  { id: "1-3", label: "1–3 runs", points: 5 },
  { id: "4", label: "Four", points: 10 },
  { id: "6", label: "Six", points: 15 },
  { id: "W", label: "Wicket", points: 20 },
  { id: "EX", label: "Extra", points: 10 },
];

export const PRESETS: Record<Sport, Preset[]> = {
  cricket: [
    { key: "ball", q: "Next ball?", options: CRICKET_BALL },
    {
      key: "over",
      q: "Runs this over?",
      options: [
        { id: "0-5", label: "0–5", points: 5 },
        { id: "6-10", label: "6–10", points: 5 },
        { id: "11+", label: "11+", points: 10 },
        { id: "W", label: "A wicket falls", points: 10 },
      ],
    },
    {
      key: "review",
      q: "Review: out or not out?",
      options: [
        { id: "out", label: "Out", points: 10 },
        { id: "notout", label: "Not out", points: 10 },
      ],
    },
  ],
  football: [
    {
      key: "pen",
      q: "Penalty: scored or saved?",
      options: [
        { id: "goal", label: "Scored", points: 5 },
        { id: "saved", label: "Saved", points: 15 },
        { id: "miss", label: "Missed", points: 15 },
      ],
    },
    {
      key: "next10",
      q: "Goal in the next 10 minutes?",
      options: [
        { id: "home", label: "Home scores", points: 10 },
        { id: "away", label: "Away scores", points: 10 },
        { id: "none", label: "No goal", points: 5 },
      ],
    },
    {
      key: "var",
      q: "VAR check: stands or overturned?",
      options: [
        { id: "stands", label: "Stands", points: 10 },
        { id: "over", label: "Overturned", points: 10 },
      ],
    },
  ],
  tennis: [
    {
      key: "point",
      q: "Who wins this point?",
      options: [
        { id: "p1", label: "Server", points: 5 },
        { id: "p2", label: "Returner", points: 10 },
      ],
    },
    {
      key: "game",
      q: "Break of serve this game?",
      options: [
        { id: "hold", label: "Holds", points: 5 },
        { id: "break", label: "Broken", points: 15 },
      ],
    },
  ],
  kabaddi: [
    {
      key: "raid",
      q: "This raid?",
      options: [
        { id: "point", label: "Raid point", points: 5 },
        { id: "tackle", label: "Tackled", points: 10 },
        { id: "empty", label: "Empty raid", points: 5 },
        { id: "super", label: "Super raid", points: 20 },
      ],
    },
  ],
  other: [
    {
      key: "yesno",
      q: "Does it happen?",
      options: [
        { id: "yes", label: "Yes", points: 10 },
        { id: "no", label: "No", points: 10 },
      ],
    },
  ],
};

export const SPORT_LABEL: Record<Sport, string> = {
  cricket: "Cricket",
  football: "Football",
  tennis: "Tennis",
  kabaddi: "Kabaddi",
  other: "Anything live",
};

export const STREAK_BONUS = 5;

/** Message types. Only the server bot may send CI:* cards. */
export const MT = {
  Moment: "CI:Moment",
  Lock: "CI:Lock",
  Tally: "CI:Tally",
  Pending: "CI:Pending",
  Result: "CI:Result",
  React: "CI:React",
} as const;

export const CARD_TYPES: string[] = [MT.Moment, MT.Lock, MT.Tally, MT.Pending, MT.Result];

export type BallInfo = { over: string; bowler: string; batter: string; score: string; need?: string };

export type MomentCard = {
  mid: string;
  q: string;
  options: Option[];
  openAt: number;
  lockAt: number | null; // null = host locks by hand
  ball?: BallInfo;
};

export type LockCard = { mid: string; at: number };
export type TallyCard = { mid: string; counts: Record<string, number>; total: number };
export type PendingCard = { mid: string; reason: string };
export type ResultCard = {
  mid: string;
  outcome: string;
  label: string;
  detail?: string;
  winners: string[];
  total: number;
  board: { name: string; points: number }[];
  scoreline?: string;
  at: number;
};

export type RoomPublic = {
  id: string;
  name: string;
  sport: Sport;
  mode: "host" | "replay";
  hostId: string;
  channelId: string;
  demo: boolean;
  createdAt: number;
};

export type RoomState = {
  room: RoomPublic;
  moment: (MomentCard & { state: "open" | "locked" | "pending" | "settled" }) | null;
  lastResult: ResultCard | null;
  tally: TallyCard | null;
  board: { name: string; points: number }[];
  myCall: string | null;
  scoreline: string | null;
  replay?: { index: number; total: number; title: string; setup: string } | null;
};

/** Words and patterns blocked before delivery (betting spam, off-app contact). */
export const BLOCK_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|io|net|xyz|bet|app|link|top)\b)/i, reason: "Links are blocked in match rooms" },
  { re: /(\+?\d[\d\s-]{8,}\d)/, reason: "Phone numbers are blocked" },
  { re: /\b(bet|betting|satta|odds|tip(s|ster)?|fixed match|session rate|lagai|khai|1xbet|dafabet|stake\.com)\b/i, reason: "Betting talk is blocked" },
  { re: /(t\.me\/|telegram|wa\.me|whatsapp group)/i, reason: "Off-app invites are blocked" },
];

export function blockReason(text: string): string | null {
  for (const p of BLOCK_PATTERNS) if (p.re.test(text)) return p.reason;
  return null;
}
