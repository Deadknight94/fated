import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWoundCare } from "../module/wound-care.mjs";

// Severity undefined
const testUndefinedSeverity = () => {
  const input = { care: "bandaged", daysRemaining: 2 };
  const res = normalizeWoundCare(undefined, input);
  assert.deepEqual(res, { care: "none", daysRemaining: 0 });
};

test("normalizeWoundCare - undefined severity", testUndefinedSeverity);
