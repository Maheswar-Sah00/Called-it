// Every sport ships with at least one ready-made question the host can ask in one tap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, SPORTS, SPORT_LABEL } from "../src/lib/game.ts";

test("every sport has presets with at least two unique options and positive points", () => {
  for (const s of SPORTS) {
    assert.ok(SPORT_LABEL[s], `label for ${s}`);
    assert.ok(PRESETS[s]?.length >= 1, `presets for ${s}`);
    for (const p of PRESETS[s]) {
      assert.ok(p.options.length >= 2, `${s}/${p.key} has 2+ options`);
      assert.equal(new Set(p.options.map((o) => o.id)).size, p.options.length, `${s}/${p.key} unique ids`);
      for (const o of p.options) assert.ok(o.points > 0, `${s}/${p.key}/${o.id} points`);
    }
  }
});

test("covers the ten sports the app advertises", () => {
  assert.deepEqual(
    [...SPORTS].sort(),
    ["badminton", "basketball", "cricket", "esports", "f1", "football", "hockey", "kabaddi", "other", "tennis"],
  );
});
