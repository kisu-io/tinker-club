import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "../src/lib/slug";

test("slugify lowercases and dashes non-alphanumerics", () => {
  assert.equal(slugify("Mountain  Drivers!"), "mountain-drivers");
});

test("slugify strips accents and trims dashes", () => {
  assert.equal(slugify("  Café Crüe  "), "cafe-crue");
});

test("slugify falls back to 'group' for empty input", () => {
  assert.equal(slugify("!!!"), "group");
});

test("uniqueSlug appends a counter when taken", async () => {
  const taken = new Set(["mountain-drivers", "mountain-drivers-2"]);
  assert.equal(
    await uniqueSlug("Mountain Drivers", (s) => taken.has(s)),
    "mountain-drivers-3",
  );
});
