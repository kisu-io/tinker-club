import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGroupAccess } from "../src/lib/group";
import type { Club, ClubMembership } from "../src/lib/types";

const club = { id: "c1", ownerId: "owner" } as Club;
const ownerMembership = { id: "m1", clubId: "c1", userId: "owner", role: "OWNER" } as ClubMembership;
const memberMembership = { id: "m2", clubId: "c1", userId: "bob", role: "MEMBER" } as ClubMembership;

test("missing club -> not-found", () => {
  assert.deepEqual(checkGroupAccess(undefined, undefined, "bob"), { ok: false, reason: "not-found" });
});

test("non-member -> not-member", () => {
  assert.deepEqual(checkGroupAccess(club, undefined, "bob"), { ok: false, reason: "not-member" });
});

test("member -> ok, not owner", () => {
  assert.deepEqual(checkGroupAccess(club, memberMembership, "bob"), { ok: true, isOwner: false });
});

test("owner -> ok, isOwner true", () => {
  assert.deepEqual(checkGroupAccess(club, ownerMembership, "owner"), { ok: true, isOwner: true });
});
