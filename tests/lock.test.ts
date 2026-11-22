// The lock: a call is accepted only while the moment is open and before its lock time.
// Runs the in-memory path of src/lib/server/store.ts (same rules as the Redis Lua script).
import { test } from "node:test";
import assert from "node:assert/strict";
import { callIfOpen, setMoment, patchMoment } from "../src/lib/server/store.ts";

const M = "test:room:m", C = "test:room:c";

test("accepts a call while the moment is open", async () => {
  await setMoment(M, { mid: "m1", state: "open", lockAt: "0" });
  assert.equal(await callIfOpen(M, C, "m1", "ravi", "4", Date.now()), "ok");
});

test("refuses a call after the host locks", async () => {
  await setMoment(M, { mid: "m2", state: "open", lockAt: "0" });
  await patchMoment(M, { state: "locked" });
  assert.equal(await callIfOpen(M, C, "m2", "ravi", "6", Date.now()), "locked");
});

test("refuses a tap that lands after the timer's lock time, even by 1 ms", async () => {
  const lockAt = Date.now() + 5_000;
  await setMoment(M, { mid: "m3", state: "open", lockAt: String(lockAt) });
  assert.equal(await callIfOpen(M, C, "m3", "kabir", "W", lockAt - 1), "ok");
  assert.equal(await callIfOpen(M, C, "m3", "kabir", "W", lockAt), "locked");
  assert.equal(await callIfOpen(M, C, "m3", "kabir", "W", lockAt + 710), "locked");
});

test("refuses a call for an old moment", async () => {
  await setMoment(M, { mid: "m4", state: "open", lockAt: "0" });
  assert.equal(await callIfOpen(M, C, "m-old", "asha", "0", Date.now()), "stale");
});
