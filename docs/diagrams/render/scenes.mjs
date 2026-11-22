// Scene definitions for the README diagrams, written as Excalidraw element skeletons.
// Excalidraw's own convertToExcalidrawElements (in index.html) turns them into full elements:
// it measures the text with Excalifont, binds labels to boxes and arrows to shapes.

const INK = "#1e1e1e";
const CREAM = "#fff4e0";
const CLAY = "#e06a3c";
const HUB = "#ffd43b";
const MINT = "#2fbf71";
const MINT_FILL = "#ddf6e8";
const RED = "#e03131";
const RED_FILL = "#ffe3e3";
const WHITE = "#ffffff";
const FONT = 5; // Excalifont, the hand-drawn font
const FS = 20;

let seed = 1000;
const base = () => ({ roughness: 1, strokeWidth: 2, strokeColor: INK, fillStyle: "solid", opacity: 100, seed: seed++ });

function box(id, x, y, w, h, text, o = {}) {
  return {
    type: o.shape || "rectangle",
    id,
    x,
    y,
    width: w,
    height: h,
    ...base(),
    backgroundColor: o.fill || CREAM,
    strokeColor: o.stroke || INK,
    strokeWidth: o.sw || 2,
    strokeStyle: o.dashed ? "dashed" : "solid",
    roundness: o.sharp ? null : { type: 3 },
    ...(text
      ? {
          label: {
            text,
            fontSize: o.fs || FS,
            fontFamily: FONT,
            strokeColor: o.color || INK,
            textAlign: o.align || "center",
            verticalAlign: o.valign || "middle",
          },
        }
      : {}),
  };
}

function text(id, x, y, t, o = {}) {
  return {
    type: "text",
    id,
    x,
    y,
    text: t,
    ...base(),
    fontSize: o.fs || FS,
    fontFamily: FONT,
    strokeColor: o.color || INK,
    textAlign: o.align || "left",
    verticalAlign: "top",
  };
}

/** Arrow through absolute points, optionally bound to shapes and labelled. */
function arrow(id, pts, o = {}) {
  const [x0, y0] = pts[0];
  const rel = pts.map(([x, y]) => [x - x0, y - y0]);
  const xs = rel.map((p) => p[0]);
  const ys = rel.map((p) => p[1]);
  return {
    type: o.line ? "line" : "arrow",
    id,
    x: x0,
    y: y0,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points: rel,
    ...base(),
    strokeColor: o.color || INK,
    strokeWidth: o.sw || 2,
    strokeStyle: o.dashed ? "dashed" : o.dotted ? "dotted" : "solid",
    roundness: o.curve ? { type: 2 } : null,
    ...(o.line ? {} : { startArrowhead: o.startHead || null, endArrowhead: o.endHead === undefined ? "arrow" : o.endHead }),
    ...(o.from ? { start: { id: o.from } } : {}),
    ...(o.to ? { end: { id: o.to } } : {}),
    ...(o.label
      ? { label: { text: o.label, fontSize: o.fs || FS, fontFamily: FONT, strokeColor: o.labelColor || o.color || INK } }
      : {}),
  };
}

// ---------------------------------------------------------------- 1. architecture
function architecture() {
  seed = 1000;
  const G = 6; // gap between an arrow tip and the box it binds to
  const els = [];
  // Browsers
  els.push(box("br", 0, 150, 250, 420, "Browsers", { valign: "top", fs: 24 }));
  els.push(box("host", 20, 210, 210, 150, "Host laptop\n\nNext.js UI +\nNexconn Web SDK", { fill: WHITE }));
  els.push(box("phones", 20, 390, 210, 160, "Friends' phones\n\nNext.js UI +\nNexconn Web SDK", { fill: WHITE }));
  // Nexconn hub
  els.push(box("nx", 480, 120, 340, 470, "NEXCONN CHAT", { fill: HUB, sw: 4, valign: "top", fs: 28 }));
  els.push(
    text(
      "nx-list",
      500,
      180,
      "• open channel per room\n• custom messages CI:*\n• priority 2 for big cards\n• channel metadata\n• participant events\n• webhooks: pre_messaging\n   and message:send\n• mute + message delete",
      { fs: 21 },
    ),
  );
  els.push(text("nx-tag", 500, 480, "Every moment, lock and\nresult is a Nexconn\nmessage.", { fs: 22 }));
  els.push(
    box("calls", 480, -10, 340, 80, "next: Nexconn Call SDK\nvoice/video huddles", { dashed: true, fill: WHITE }),
  );
  // Our server
  els.push(box("sv", 1060, 150, 340, 420, "Next.js server on Vercel", { fill: CLAY, valign: "top", fs: 24 }));
  els.push(box("api", 1080, 205, 300, 105, "API routes\n/api/session, rooms/*,\nlive, webhook, impact", { fill: WHITE }));
  els.push(box("eng", 1080, 330, 300, 105, "Room engine\nopen, call, lock, settle,\nreplay tick, score sync", { fill: WHITE }));
  els.push(box("cli", 1080, 455, 300, 95, "Server API client\nSHA1-signed, fails over\nto the backup host", { fill: WHITE }));
  // Data + feed
  els.push(box("espn", 1110, -10, 240, 80, "ESPN public\nscoreboard feed"));
  els.push(box("redis", 1140, 670, 260, 130, "Upstash Redis\nroom state + table\nLua lock callIfOpen\nleases, rate limits"));

  // Browser <-> Nexconn (WebSocket via the Web SDK)
  els.push(arrow("a-br-nx", [[250 + G, 270], [480 - G, 270]], { from: "br", to: "nx", label: "connect(token)\nenterChannel\nchat, stickers" }));
  els.push(arrow("a-nx-br", [[480 - G, 460], [250 + G, 460]], { from: "nx", to: "br", label: "CI:* cards\nmetadata:\nlive score\nhead count" }));
  // Server <-> Nexconn
  els.push(arrow("a-nx-api", [[820 + G, 255], [1080 - G, 255]], { from: "nx", to: "api", label: "webhooks\npre_messaging\n-> pass 0 / 1" }));
  els.push(
    arrow("a-cli-nx", [[1080 - G, 500], [820 + G, 500]], {
      from: "cli",
      to: "nx",
      label: "Server API:\ntokens, channels,\nCI:Moment\n@ priority 2,\nmetadata, mute",
    }),
  );
  // Browser -> our API (HTTPS), routed under the hub
  els.push(
    arrow("a-br-sv", [[125, 570 + G], [125, 720], [1100, 720], [1100, 570 + G]], {
      from: "br",
      to: "sv",
      label: "HTTPS /api/*: nickname -> token, join, call, host actions",
    }),
  );
  // Server -> data
  els.push(arrow("a-sv-redis", [[1270, 570 + G], [1270, 670 - G]], { from: "sv", to: "redis", label: "atomic Lua" }));
  els.push(arrow("a-sv-espn", [[1230, 150 - G], [1230, 70 + G]], { from: "sv", to: "espn", label: "cached 30 s" }));
  return els;
}

// ---------------------------------------------------------------- 2. call-lock-flow
function callLockFlow() {
  seed = 2000;
  const els = [];
  const X = { H: 270, S: 520, R: 770, N: 1070, P: 1310 };
  const heads = [
    ["H", "Host", CREAM],
    ["S", "Our server", CLAY],
    ["R", "Redis", CREAM],
    ["N", "Nexconn", HUB],
    ["P", "Players", CREAM],
  ];
  const TOP = 0;
  const ROW0 = 110;
  const STEP = 42;
  const rows = [];
  const add = (phase, segs) => rows.push({ phase, segs });
  // [from, to, label, colour, dashed]
  add("Open", [["H", "S", 'open "Next ball?"']]);
  add("Open", [["S", "R", "save: open, lockAt"]]);
  add("Open", [["S", "N", "CI:Moment @ priority 2"], ["N", "P", "card"]]);
  add("Call", [["P", "S", "tap: POST /call"]]);
  add("Call", [["S", "R", "Lua callIfOpen"]]);
  add("Call", [["R", "S", "ok", MINT, true]]);
  add("Call", [["S", "N", "CI:Tally"], ["N", "P", "live counts"]]);
  add("Lock", [["H", "S", "LOCK (or timer ends)"]]);
  add("Lock", [["S", "R", "state = locked"]]);
  add("Lock", [["S", "N", "CI:Lock @ priority 2", RED], ["N", "P", "locked", RED]]);
  add("Late", [["P", "S", "late tap: POST /call", RED]]);
  add("Late", [["S", "R", "Lua callIfOpen"]]);
  add("Late", [["R", "S", "locked", RED, true]]);
  add("Late", [["S", "P", '"Locked · 0.70s late"', RED]]);
  add("Settle", [["H", "S", "review? (DRS, VAR)"]]);
  add("Settle", [["S", "N", "CI:Pending @ priority 2"], ["N", "P", "on hold"]]);
  add("Settle", [["H", "S", "confirm the result"]]);
  add("Settle", [["S", "R", "points + streak"]]);
  add("Settle", [["S", "N", "CI:Result @ priority 2", MINT], ["N", "P", "points, table", MINT]]);

  const bottom = ROW0 + (rows.length - 1) * STEP + 40;
  for (const [k, name, fill] of heads) {
    els.push(box(`h-${k}`, X[k] - 90, TOP, 180, 64, name, { fill, fs: 22, sw: k === "N" ? 4 : 2 }));
    els.push(arrow(`life-${k}`, [[X[k], TOP + 64], [X[k], bottom]], { line: true, dashed: true, sw: 1.5 }));
  }
  rows.forEach((r, i) => {
    const y = ROW0 + i * STEP;
    r.segs.forEach(([a, b, label, color, dashed], j) => {
      const dir = X[b] > X[a] ? 1 : -1;
      // a label centred on a long arrow would sit on the Redis lifeline: add a middle point between Redis and Nexconn
      const spansRedis = Math.min(X[a], X[b]) < X.R && Math.max(X[a], X[b]) > X.R;
      const mid = spansRedis ? [[(X.R + X.N) / 2, y]] : [];
      els.push(arrow(`m${i}-${j}`, [[X[a] + dir * 4, y], ...mid, [X[b] - dir * 4, y]], { label, color, dashed }));
    });
  });
  // phase brackets on the left
  const phases = [
    ["Open", "1  Open"],
    ["Call", "2  Call"],
    ["Lock", "3  Lock"],
    ["Late", "4  Late tap"],
    ["Settle", "5  Result"],
  ];
  for (const [key, label] of phases) {
    const idx = rows.map((r, i) => (r.phase === key ? i : -1)).filter((i) => i >= 0);
    const y1 = ROW0 + idx[0] * STEP - 14;
    const y2 = ROW0 + idx[idx.length - 1] * STEP + 14;
    const color = key === "Late" ? RED : INK;
    els.push(arrow(`br-${key}`, [[150, y1], [140, y1], [140, y2], [150, y2]], { line: true, color, sw: 2 }));
    els.push(text(`ph-${key}`, 0, (y1 + y2) / 2 - 13, label, { fs: 22, color }));
  }
  els.push(
    text(
      "foot",
      180,
      bottom + 14,
      "callIfOpen answers ok, changed (switched pick), locked or stale (an old moment). Server clock decides.",
      { fs: 20 },
    ),
  );
  return els;
}

// ---------------------------------------------------------------- 3. user-flow
function userFlow() {
  seed = 3000;
  const els = [];
  const W = 230;
  const H = 110;
  const col = (c) => c * (W + 70);
  const r0 = 0;
  const r1 = 200;
  const r2 = 400;
  els.push(box("u1", col(0), r0, W, H, "Host picks a real\nlive match\n(or names one)"));
  els.push(box("u2", col(1), r0, W, H, "Shares one link"));
  els.push(box("u3", col(2), r0, W, H, "Friends join with\na nickname: no app,\nno sign-up"));
  els.push(box("u4", col(3), r0, W, H, 'Host asks\n"Next ball?"', { fill: CLAY }));
  els.push(box("u5", col(3), r1, W, H, "Everyone taps\na call"));
  els.push(box("u6", col(2), r1, W, H, "Locked at the ball:\nlate taps refused", { stroke: RED, fill: RED_FILL, sw: 3 }));
  els.push(box("u7", col(1), r1, W, H, "Result: points,\nstreaks, table", { stroke: MINT, fill: MINT_FILL, sw: 3 }));
  els.push(box("u8", col(0), r1, W, H, "Banter in chat\n+ stickers"));
  els.push(box("u9", col(1), r2, W, 120, "Spoiler shield\nholds results + chat\n5 to 45 s, per person", { dashed: false, fill: WHITE }));
  els.push(box("u10", col(3), r2, W, 120, "/try judge demo\n2024 T20 WC final\nreplay, BOT friends", { fill: HUB }));

  const g = 6;
  const midY = (y) => y + H / 2;
  els.push(arrow("e12", [[col(0) + W + g, midY(r0)], [col(1) - g, midY(r0)]], { from: "u1", to: "u2" }));
  els.push(arrow("e23", [[col(1) + W + g, midY(r0)], [col(2) - g, midY(r0)]], { from: "u2", to: "u3" }));
  els.push(arrow("e34", [[col(2) + W + g, midY(r0)], [col(3) - g, midY(r0)]], { from: "u3", to: "u4" }));
  els.push(arrow("e45", [[col(3) + 160, r0 + H + g], [col(3) + 160, r1 - g]], { from: "u4", to: "u5" }));
  els.push(arrow("e56", [[col(3) - g, midY(r1)], [col(2) + W + g, midY(r1)]], { from: "u5", to: "u6" }));
  els.push(arrow("e67", [[col(2) - g, midY(r1)], [col(1) + W + g, midY(r1)]], { from: "u6", to: "u7" }));
  els.push(arrow("e78", [[col(1) - g, midY(r1)], [col(0) + W + g, midY(r1)]], { from: "u7", to: "u8" }));
  // loop: next moment
  els.push(
    arrow("e84", [[col(0) + W / 2, r1 - g], [col(0) + W / 2, 155], [col(3) + 60, 155], [col(3) + 60, r0 + H + g]], {
      from: "u8",
      to: "u4",
      label: "next moment",
    }),
  );
  els.push(arrow("e79", [[col(1) + W / 2, r1 + H + g], [col(1) + W / 2, r2 - g]], { from: "u7", to: "u9", label: "optional" }));
  els.push(
    arrow("e105", [[col(3) + W / 2, r2 - g], [col(3) + W / 2, r1 + H + g]], { from: "u10", to: "u5", label: "server asks\nevery ball" }),
  );
  return els;
}

// ---------------------------------------------------------------- 4. moderation-flow
function moderationFlow() {
  seed = 4000;
  const els = [];
  const g = 6;
  els.push(box("m1", 0, 150, 190, 110, "Player sends\na chat message"));
  els.push(box("m2", 270, 130, 240, 150, "NEXCONN\nholds the message", { fill: HUB, sw: 4, fs: 22 }));
  els.push(box("m3", 750, 75, 290, 250, "/api/webhook (ours)", { fill: CLAY, valign: "top", fs: 24 }));
  els.push(
    text(
      "m3-list",
      768,
      125,
      "• signed by Nexconn?\n• game card (CI:*) not\n   sent by our bot?\n• link or phone number?\n• betting words?\n• off-app invite?",
      { fs: 20 },
    ),
  );
  els.push(
    box("m4", 1140, 20, 280, 140, "pass: 0\nrefused, never delivered\n(counted in /impact)", { stroke: RED, fill: RED_FILL, sw: 3 }),
  );
  els.push(box("m5", 1140, 250, 280, 120, "pass: 1\ndelivered to the room", { stroke: MINT, fill: MINT_FILL, sw: 3 }));
  els.push(
    box("m6", 1140, 460, 280, 130, "message:send webhook\nre-checks; a hit is\ndeleted for everyone"),
  );
  els.push(box("m7", 270, 440, 240, 150, "Host taps Mute\n(10 min): their sends\nare refused", { fill: CREAM }));

  els.push(arrow("f12", [[190 + g, 205], [270 - g, 205]], { from: "m1", to: "m2" }));
  els.push(arrow("f23", [[510 + g, 205], [750 - g, 205]], { from: "m2", to: "m3", label: "open_channel:\npre_messaging" }));
  els.push(arrow("f34", [[1040 + g, 150], [1140 - g, 90]], { from: "m3", to: "m4", label: "any hit", color: RED }));
  els.push(arrow("f35", [[1040 + g, 260], [1140 - g, 310]], { from: "m3", to: "m5", label: "clean", color: MINT }));
  els.push(arrow("f56", [[1280, 370 + g], [1280, 460 - g]], { from: "m5", to: "m6", label: "slipped through?" }));
  els.push(arrow("f72", [[390, 440 - g], [390, 280 + g]], { from: "m7", to: "m2", label: "mute via our\nServer API" }));
  return els;
}

export const scenes = {
  architecture,
  "call-lock-flow": callLockFlow,
  "user-flow": userFlow,
  "moderation-flow": moderationFlow,
};
