import assert from "node:assert/strict";
import { test } from "node:test";
import { generateInviteCode } from "./inviteCode.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

test("generateInviteCode is 8 chars from the invite alphabet", () => {
  const code = generateInviteCode();
  assert.equal(code.length, 8);
  for (const ch of code) {
    assert.ok(ALPHABET.includes(ch), `unexpected char ${ch}`);
  }
});

test("generateInviteCode is not a constant (CSPRNG)", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    seen.add(generateInviteCode());
  }
  assert.ok(seen.size > 1);
});
