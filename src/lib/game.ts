/** Shared game definitions (client + server). */

export type Sport =
  | "cricket"
  | "football"
  | "basketball"
  | "tennis"
  | "badminton"
  | "kabaddi"
  | "hockey"
  | "f1"
  | "esports"
  | "other";

export const SPORTS: Sport[] = ["cricket", "football", "basketball", "tennis", "badminton", "kabaddi", "hockey", "f1", "esports", "other"];

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
  basketball: [
    {
      key: "poss",
      q: "This possession?",
      options: [
        { id: "3", label: "Three", points: 15 },
        { id: "2", label: "Two", points: 5 },
        { id: "ft", label: "Free throws", points: 10 },
        { id: "to", label: "Turnover / miss", points: 5 },
      ],
    },
    {
      key: "ft",
      q: "Free throws: how many go in?",
      options: [
        { id: "0", label: "None", points: 15 },
        { id: "1", label: "One", points: 10 },
        { id: "2", label: "Both", points: 5 },
      ],
    },
  ],
  badminton: [
    {
      key: "rally",
      q: "Who wins this rally?",
      options: [
        { id: "server", label: "Server", points: 5 },
        { id: "receiver", label: "Receiver", points: 10 },
      ],
    },
    {
      key: "smash",
      q: "Rally ends on a smash?",
      options: [
        { id: "yes", label: "Smash winner", points: 10 },
        { id: "no", label: "Something else", points: 5 },
      ],
    },
  ],
  hockey: [
    {
      key: "pc",
      q: "Penalty corner: goal?",
      options: [
        { id: "goal", label: "Goal", points: 10 },
        { id: "saved", label: "Saved", points: 5 },
        { id: "wide", label: "Wide", points: 10 },
      ],
    },
    {
      key: "referral",
      q: "Video referral: stands or overturned?",
      options: [
        { id: "stands", label: "Stands", points: 10 },
        { id: "over", label: "Overturned", points: 10 },
      ],
    },
  ],
  f1: [
    {
      key: "lap1",
      q: "Who leads after lap 1?",
      options: [
        { id: "pole", label: "Pole sitter", points: 5 },
        { id: "p2", label: "P2 starter", points: 10 },
        { id: "other", label: "Someone else", points: 15 },
      ],
    },
    {
      key: "sc",
      q: "Safety car in the next 10 laps?",
      options: [
        { id: "yes", label: "Yes", points: 15 },
        { id: "no", label: "No", points: 5 },
      ],
    },
    {
      key: "pit",
      q: "Undercut works?",
      options: [
        { id: "yes", label: "Gains the place", points: 10 },
        { id: "no", label: "Stays behind", points: 10 },
      ],
    },
  ],
  esports: [
    {
      key: "round",
      q: "Who takes this round?",
      options: [
        { id: "a", label: "Team A", points: 10 },
        { id: "b", label: "Team B", points: 10 },
      ],
    },
    {
      key: "clutch",
      q: "1v2: clutch or not?",
      options: [
        { id: "clutch", label: "Clutch!", points: 20 },
        { id: "no", label: "Falls", points: 5 },
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
  basketball: "Basketball",
  badminton: "Badminton",
  kabaddi: "Kabaddi",
  hockey: "Hockey",
  f1: "F1",
  esports: "Esports",
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
  Huddle: "CI:Huddle",
} as const;

export const CARD_TYPES: string[] = [MT.Moment, MT.Lock, MT.Tally, MT.Pending, MT.Result, MT.Huddle];

/** A live voice/video huddle in a room (Nexconn Call SDK, multi-party). */
/** Voice/video huddles (Nexconn Call SDK). Off until Call is subscribed in the Nexconn Console. */
export const CALLS_ENABLED = false;

export type HuddleInfo = { callId: string; media: "voice" | "video"; by: string; byName: string; at: number } | null;

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
  board: { id: string; name: string; points: number }[];
  scoreline?: string;
  at: number;
};

/** A real match from the live feed. */
export type LiveMatch = {
  id: string;
  sport: Sport;
  league: string;
  title: string;
  short: string;
  status: "live" | "soon" | "done";
  statusText: string;
  detail: string;
  startsAt: number;
  /** in progress but at a break (stumps, lunch, rain, half time) */
  paused?: boolean;
  venue: string;
  teams: { name: string; abbr: string; score: string; logo: string; winner: boolean }[];
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
  /** the real match this room follows, if picked from the live list */
  match?: { id: string; sport: Sport; title: string; league: string } | null;
};

export type RoomState = {
  room: RoomPublic;
  moment: (MomentCard & { state: "open" | "locked" | "pending" | "settled" }) | null;
  lastResult: ResultCard | null;
  tally: TallyCard | null;
  board: { id: string; name: string; points: number }[];
  myCall: string | null;
  names: Record<string, { name: string; avatar: string }>;
  amHost: boolean;
  scoreline: string | null;
  huddle: HuddleInfo;
  /** latest from the live feed when the room follows a real match */
  live?: LiveMatch | null;
  replay?: { index: number; nextAt: number; phase: string; total: number; title: string; setup: string } | null;
};

/** Words and patterns blocked before delivery (betting spam, off-app contact). */
/**
 * Room rules. Tuned for match banter: "I bet Kohli hits a six" and "what are the odds" are fine;
 * betting promotion, links, phone numbers and off-app invites are not.
 */
export const BLOCK_PATTERNS: { re: RegExp; reason: string }[] = [
  {
    re: /(https?:\/\/|www\.|bit\.ly|t\.co\/|\b[a-z0-9-]{2,}\.(com|in|io|net|org|xyz|bet|app|link|top|cc|live|vip|me|co|ly|club|site|online|win|pro|store|shop)\b)/i,
    reason: "Links are blocked in match rooms",
  },
  { re: /(^|[^\d])(\+?91)?[6-9]\d{9}(?!\d)/, reason: "Phone numbers are blocked" },
  {
    re: /(betting|satta|सट्टा|khaiwal|khaiwaal|bookie|fixed match|match fix|session rate|lagai khai|khai lagai|book ?id|betting id|cricket id|online id|\bid (chahiye|lelo|le lo|bano)|1xbet|dafabet|stake\.com|parimatch|melbet|bet365|betway|10cric|sure ?shot|100 ?% ?(sure|win|fix)|paid tips|tipster|bet (karo|lagao|laga|lagaye)|place (a |your )?bets?)/i,
    reason: "Betting talk is blocked",
  },
  { re: /(t\.me\/|telegram|wa\.me|whatsapp group|join (my )?channel|insta ?@|dm (me )?for)/i, reason: "Off-app invites are blocked" },
];

// Look-alike letters people use to dodge filters (Cyrillic and Greek).
const CONFUSABLE: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", ѕ: "s", і: "i", ј: "j", к: "k", м: "m", т: "t", н: "h", в: "b", ԁ: "d", ӏ: "l",
  α: "a", ε: "e", ο: "o", ρ: "p", τ: "t", κ: "k", ι: "i", ν: "v",
};

function normalise(text: string) {
  const base = text
    .normalize("NFKC")
    .replace(/[\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[Ͱ-ϿЀ-ӿ]/g, (c) => CONFUSABLE[c] ?? c);
  // "s a t t a", "s.a.t.t.a", "9.8.7.6…": join runs of single characters split by spaces or dots
  return base.replace(/(?:(?<![\p{L}\p{N}])[\p{L}\p{N}][\s.\-_*]+){2,}[\p{L}\p{N}](?![\p{L}\p{N}])/gu, (m) => m.replace(/[\s.\-_*]+/g, ""));
}

export function blockReason(text: string): string | null {
  const n = normalise(text);
  const digits = n.replace(/(\d)[\s.\-()]+(?=\d)/g, "$1");
  for (const p of BLOCK_PATTERNS) if (p.re.test(n) || (p.reason.startsWith("Phone") && p.re.test(digits))) return p.reason;
  return null;
}

/** Art per sport (files in /public/art). */
export const SPORT_ART: Record<Sport, { bolo: string; gear: string; official: string }> = {
  cricket: { bolo: "b4/cricket", gear: "b1/cricket", official: "c2/cricket-umpire" },
  football: { bolo: "b4/football", gear: "b1/football", official: "c2/football-referee" },
  basketball: { bolo: "b4/basketball", gear: "b1/basketball", official: "c2/basketball-referee" },
  tennis: { bolo: "b4/tennis", gear: "b1/tennis", official: "c2/tennis-umpire" },
  badminton: { bolo: "b4/badminton", gear: "b1/badminton", official: "c2/badminton-judge" },
  kabaddi: { bolo: "b4/kabaddi", gear: "b1/whistle", official: "c2/kabaddi-referee" },
  hockey: { bolo: "b4/hockey", gear: "b1/hockey", official: "c2/hockey-umpire" },
  f1: { bolo: "b4/racing", gear: "b1/racing-helmet", official: "c2/race-marshal" },
  esports: { bolo: "b4/esports", gear: "b1/controller", official: "c2/esports-caster" },
  other: { bolo: "b3/pumped", gear: "b2/megaphone", official: "c2/cricket-umpire" },
};

export const AVATARS = [
  "student", "chai-uncle", "grandma", "office", "facepaint", "driver",
  "gym", "popcorn", "dad-baby", "nurse", "gamer", "radio-grandpa",
] as const;

/** Reactions are our own stickers, sent as keys (never system emoji). */
export const REACTIONS = ["fire", "whoa", "cheer", "party", "ouch", "love"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_ART: Record<Reaction, { art: string; label: string }> = {
  fire: { art: "b2/flame", label: "On fire" },
  whoa: { art: "b5/bolt", label: "Whoa" },
  cheer: { art: "b2/foam-finger", label: "Come on!" },
  party: { art: "b2/popper", label: "Party" },
  ouch: { art: "b3/facepalm", label: "Ouch" },
  love: { art: "b5/heart", label: "Love it" },
};
