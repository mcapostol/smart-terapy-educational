import test from "node:test";
import assert from "node:assert/strict";

import { calculateEstimate, normalizeSelection } from "../public/app.js";

test("calculates a single creative workshop at the base per-child rate", () => {
  const estimate = calculateEstimate({ type: "creativ", participants: 12, sessions: 1 });

  assert.equal(estimate.ok, true);
  assert.equal(estimate.unitPrice, 55);
  assert.equal(estimate.total, 660);
  assert.equal(estimate.discountRate, 0);
});

test("applies the 10% package discount across all four sessions", () => {
  const estimate = calculateEstimate({ type: "senzorial", participants: 10, sessions: 4 });

  assert.equal(estimate.ok, true);
  assert.equal(estimate.unitPrice, 54);
  assert.equal(estimate.total, 2160);
  assert.equal(estimate.discountRate, 0.1);
});

test("accepts exact participant boundaries for school workshops", () => {
  assert.equal(calculateEstimate({ type: "scoala", participants: 15, sessions: 1 }).ok, true);
  assert.equal(calculateEstimate({ type: "scoala", participants: 30, sessions: 1 }).ok, true);
});

test("rejects values outside workshop-specific participant boundaries", () => {
  const tooSmallSchool = calculateEstimate({ type: "scoala", participants: 14, sessions: 1 });
  const tooLargeParent = calculateEstimate({ type: "parinte", participants: 16, sessions: 1 });

  assert.equal(tooSmallSchool.ok, false);
  assert.equal(tooSmallSchool.code, "participants-out-of-range");
  assert.deepEqual([tooSmallSchool.min, tooSmallSchool.max], [15, 30]);
  assert.equal(tooLargeParent.ok, false);
  assert.equal(tooLargeParent.code, "participants-out-of-range");
  assert.deepEqual([tooLargeParent.min, tooLargeParent.max], [6, 15]);
});

test("rejects fractional counts, unsupported sessions, and unknown workshop types", () => {
  assert.equal(calculateEstimate({ type: "creativ", participants: "8.5", sessions: 1 }).code, "invalid-participants");
  assert.equal(calculateEstimate({ type: "creativ", participants: 8, sessions: 2 }).code, "invalid-sessions");
  assert.equal(calculateEstimate({ type: "inventat", participants: 8, sessions: 1 }).code, "unknown-type");
  assert.equal(calculateEstimate({ type: "__proto__", participants: 8, sessions: 1 }).code, "unknown-type");
  assert.equal(calculateEstimate({ type: "constructor", participants: 8, sessions: 1 }).code, "unknown-type");
});

test("calculates parent-child units as pairs", () => {
  const estimate = calculateEstimate({ type: "parinte", participants: 6, sessions: 4 });

  assert.equal(estimate.ok, true);
  assert.equal(estimate.unit, "pereche copil + adult");
  assert.equal(estimate.unitPrice, 76.5);
  assert.equal(estimate.total, 1836);
});

test("normalizes malformed saved state to safe defaults", () => {
  assert.deepEqual(normalizeSelection(null), { type: "creativ", participants: 12, sessions: 1 });
  assert.deepEqual(
    normalizeSelection({ type: "__proto__", participants: "abc", sessions: 99 }),
    { type: "creativ", participants: 12, sessions: 1 },
  );
});

test("normalizes valid string values and clamps stale saved boundaries", () => {
  assert.deepEqual(
    normalizeSelection({ type: "scoala", participants: "12", sessions: "4" }),
    { type: "scoala", participants: 15, sessions: 4 },
  );
  assert.deepEqual(
    normalizeSelection({ type: "parinte", participants: 999, sessions: 1 }),
    { type: "parinte", participants: 15, sessions: 1 },
  );
});
