import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDelete } from "./sqlFilter.js";

test("an empty id list matches nothing instead of deleting the whole table", () => {
  const d = buildDelete("holds", { id: [] });
  assert.match(d.text, /WHERE FALSE/);
  assert.deepEqual(d.values, []);
});

test("a non-empty id list still filters by ANY()", () => {
  const d = buildDelete("holds", { id: ["a"] });
  assert.match(d.text, /id = ANY\(\$1::uuid\[\]\)/);
});
