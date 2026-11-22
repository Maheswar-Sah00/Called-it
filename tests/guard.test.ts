// The clean-room filter used by the pre-messaging webhook and the client guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockReason } from "../src/lib/game.ts";

test("refuses betting spam, links, phone numbers and off-app invites", () => {
  for (const msg of [
    "join my telegram for betting tips",
    "best odds here, 1xbet bonus",
    "satta khai lagai session rate",
    "check www.freebets.xyz",
    "https://t.me/fixedmatch",
    "call me on +91 98765 43210",
    "whatsapp group link inside",
  ]) assert.ok(blockReason(msg), `should block: ${msg}`);
});

test("lets normal match banter through", () => {
  for (const msg of [
    "WHAT A SHOT",
    "16 needed off the last over",
    "called it, told you FOUR",
    "Bumrah is unreal",
    "DRS! that's plumb",
    "come onnn 🔥🔥",
  ]) assert.equal(blockReason(msg), null, `should allow: ${msg}`);
});
