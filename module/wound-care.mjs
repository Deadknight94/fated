export function normalizeWoundCare(woundSeverity, woundCare) {
  // Default result
  const result = { care: "none", daysRemaining: 0 };
  // Validate woundSeverity
  if (typeof woundSeverity !== "number" || !Number.isFinite(woundSeverity)) return result;
  const sev = Math.floor(woundSeverity);
  // Terminal severities: 3 or 4 and beyond
  if (sev >= 3) return result;
  // Valid care types per severity
  const validCares = {
    0: ["none"],
    1: ["bandaged"],
    2: ["bandaged", "treated", "grievousHealingPending"],
  };
  const allowed = validCares[sev] ?? [];
  if (!woundCare) return result;
  const care = woundCare.care;
  if (!care || !allowed.includes(care)) return result;
  // Normalize daysRemaining
  const days = woundCare.daysRemaining;
  let daysInt = 0;
  if (typeof days === "number" && Number.isFinite(days) && days >= 0 && Number.isInteger(days)) {
    daysInt = days;
  }
  return { care, daysRemaining: care === "none" ? 0 : daysInt };
}
