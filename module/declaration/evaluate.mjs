/**
 * @file Target-agnostic declaration calculation layer. Evaluates draft legality and
 * constructs detached edits/snapshots; service.mjs owns Actor writes and costs.
 * No paths, targets, movement execution or physical-roll resolution are modeled.
 */
import { calculateActionFromActorData } from "../actions/actions.mjs";
import { healthLockIssue } from "../health.mjs";
import { enduranceSpendIssue } from "./endurance-push.mjs";

/**
 * Version stamped into draft and snapshot state; evaluator rejects other versions.
 */
export const DECLARATION_VERSION = 1;
/**
 * Accepted stored stance identifiers for draft editing/evaluation and planner UI.
 */
export const DECLARATION_STANCES = ["neutral", "offensive", "defensive", "ranged"];

/**
 * Pure turn-context provider returning separate dice/Threshold arrays with stance
 * provenance. Explicit attacks get Offensive -1 Threshold or Defensive -1 die;
 * Ranged adds one die only to ranged attacks. Other Actions receive no entries.
 */
export function stanceActionModifiers(action, stance) {
  const successDice = [];
  const successThreshold = [];

  if (!["melee", "ranged"].includes(action?.attackType)) {
    return { successDice, successThreshold };
  }

  const source = { type: "stance", stance };

  if (stance === "offensive") {
    successThreshold.push({
      id: "offensive-stance",
      label: "Offensive stance",
      value: -1,
      source
    });
  } else if (stance === "defensive") {
    successDice.push({
      id: "defensive-stance",
      label: "Defensive stance",
      value: -1,
      source
    });
  } else if (stance === "ranged" && action.attackType === "ranged") {
    successDice.push({
      id: "ranged-stance",
      label: "Ranged stance",
      value: 1,
      source
    });
  }

  return { successDice, successThreshold };
}

/**
 * Addition prevention only; existing invalid entries remain for evaluator review.
 *
 * Pure picker/service guard using current Main/Power counts; returns a blocking
 * message or null. It neither mutates the draft nor replaces full evaluation.
 */
export function powerActionAdditionIssue(action, { mainCount, powerCount }) {
  if (powerCount && ["main", "power"].includes(action.classification)) return "A Power Action is already declared; Main and additional Power Actions are unavailable.";
  if (mainCount && action.classification === "power") return "Main Actions are already declared; Power Actions are unavailable.";
  return null;
}

/**
 * Pure factory for empty editing state at the supplied stance/revision: no
 * snapshot, completion IDs or Endurance spend. Does not persist or reset resources.
 */
export function freshDeclaration(stance = "", revision = 0) {
  return { version: DECLARATION_VERSION, revision, status: "editing", stance, enduranceSpend: 0, entries: [], snapshot: null, completed: [] };
}

/**
 * Legality is separate from owned + enabled availability. No map or target inputs.
 *
 * Read-only calculation returning evaluated entries, issues/counts, original Main
 * penalty and canLock. The attributes argument accepts Actor system data for
 * source resolution/Endurance checks; additionalModifiers is a per-Action callback.
 * Only required-roll entries get calculations. No Document writes occur here.
 */
export function evaluateDeclaration(declaration, actions, attributes = {}, additionalModifiers = () => ({}), actorState = null) {
  const issues = [];
  const spendIssue = enduranceSpendIssue(declaration.enduranceSpend ?? 0, attributes);
  if (spendIssue) issues.push({ code: "endurance-spend", message: spendIssue, entryId: null, incomplete: false });
  const issue = (code, message, entryId = null, incomplete = false) => issues.push({ code, message, entryId, incomplete });
  const healthIssue = healthLockIssue(actorState);
  if (healthIssue) issue("incapacitated", healthIssue);
  if (declaration.version !== DECLARATION_VERSION) issue("version", "Unsupported declaration version.");
  if (!DECLARATION_STANCES.includes(declaration.stance)) issue("stance", "Choose a stance before declaring Actions.", null, true);
  const entries = declaration.entries.map(entry => ({ ...entry,
    action: entry.kind === "action" ? actions.find(a => a.id === entry.actionId && a.source.itemId === entry.itemId) : null }));
  // Count the original draft once. Completion later cannot reduce this penalty.
  const mainCount = entries.filter(e => e.action?.classification === "main").length;
  const powerCount = entries.filter(e => e.action?.classification === "power").length;
  const movementCount = entries.filter(e => e.kind === "movement").length;
  const multiActionPenalty = mainCount <= 3 ? Math.max(0, mainCount - 1) : null;
  if (mainCount > 3) issue("main-limit", "Declare no more than 3 Main Actions.");
  if (movementCount > 1) issue("movement-limit", "Declare only one continuous Movement segment.");
  if (powerCount > 1 || (powerCount && mainCount)) issue("power-exclusive", "A Power Action must be the only Main/Power Action this turn.");
  if (new Set(entries.map(e => e.id)).size !== entries.length) issue("entry-ids", "Declaration entry IDs must be unique.");

  for (const entry of entries) {
    if (entry.kind === "movement") continue;
    const action = entry.action;
    if (!action) { issue("missing-action", "Source Action is no longer owned and enabled. Remove or replace this entry.", entry.id); continue; }
    const name = action.name || "Unnamed Action";
    if (!["main", "free", "power"].includes(action.classification)) issue("classification", `${name}: Action classification is unspecified.`, entry.id, true);
    if (!action.allowedStances.length) issue("stances-unknown", `${name}: allowed stances are unspecified.`, entry.id, true);
    else if (declaration.stance && !action.allowedStances.includes(declaration.stance)) issue("stance-disallowed", `${name}: not allowed in ${declaration.stance} stance.`, entry.id);
    if (action.classification === "main" && mainCount > 1) {
      if (action.multiActionEligible === false) issue("multi-ineligible", `${name}: cannot participate in Multi-Action.`, entry.id);
      else if (action.multiActionEligible !== true) issue("multi-unknown", `${name}: Multi-Action eligibility is unspecified.`, entry.id, true);
    }
    if (action.rollRequirement !== "required" && action.rollRequirement !== "none") {
      issue("roll-unknown", `${name}: set Requires Roll or No Roll on the Item Action.`, entry.id, true);
    }
    // No-roll entries skip numeric completeness; unspecified is a separate error.
    if (action.rollRequirement === "required") {
  const extra = additionalModifiers(action, declaration, entry) ?? {};
  const stanceModifiers = stanceActionModifiers(action, declaration.stance);

  const successDice = [
    ...(extra.successDice ?? []),
    ...stanceModifiers.successDice
  ];

  const threshold = [
    ...(extra.successThreshold ?? []),
    ...stanceModifiers.successThreshold
  ];

  if (action.classification === "main") {
    threshold.push({
      id: "multi-action",
      label: "Multi-Action",
      value: multiActionPenalty,
      source: {
        type: "declaration",
        mainCount,
        stance: declaration.stance
      }
    });
  }

  entry.calculation = calculateActionFromActorData(
    action,
    attributes,
    {
      ...extra,
      successDice,
      successThreshold: threshold
    }
  );
      if (entry.calculation.successThreshold.reviewIssue) {
        issue("threshold-review", `${name}: ${entry.calculation.successThreshold.reviewIssue}`, entry.id, true);
      }
      if (!entry.calculation.successDice.complete || !entry.calculation.successThreshold.complete) {
        issue("roll-incomplete", `${name}: complete Success Dice and modifier values before locking.`, entry.id, true);
      }
    }
  }
  return { entries, issues, mainCount, powerCount, movementCount, multiActionPenalty, canLock: issues.length === 0 };
}

/**
 * Validates an editing draft, then returns a deep-cloned locked declaration with
 * Action/calculation snapshots, original counts, lock user/time and empty checklist.
 * Throws on issues; does not spend resources or update the Actor. Supply now for
 * deterministic results (the default reads the current clock).
 */
export function lockDeclaration(declaration, actions, attributes, { userId = "", now = new Date().toISOString(), additionalModifiers, actorState } = {}) {
  if (declaration.status !== "editing") throw new Error("Declaration is already locked.");
  const result = evaluateDeclaration(declaration, actions, attributes, additionalModifiers, actorState);
  if (!result.canLock) throw new Error(result.issues.map(i => i.message).join("\n"));
  const snapshot = { version: DECLARATION_VERSION, stance: declaration.stance, lockedAt: now, lockedBy: userId,
    mainCount: result.mainCount, multiActionPenalty: result.multiActionPenalty, enduranceSpend: declaration.enduranceSpend ?? 0,
    entries: result.entries.map(entry => ({ id: entry.id, kind: entry.kind, itemId: entry.itemId, actionId: entry.actionId,
      movementHexes: entry.kind === "movement" ? 3 : null,
      action: entry.action ?? null, calculation: entry.calculation ?? null })) };
  // Detach nested Actions and calculations before the service persists the snapshot.
  return structuredClone({ ...declaration, status: "locked", snapshot, completed: [] });
}

/**
 * All edits return new state; locked snapshots are never re-evaluated.
 *
 * Pure state transformation for clear, completion toggles and draft operations.
 * New entries require a caller-provided ID; returns detached state (or a fresh
 * draft) and throws on disallowed edits. Does not increment revision or persist.
 */
export function editDeclaration(declaration, operation, { id } = {}) {
  if (declaration.version !== DECLARATION_VERSION) throw new Error("Unsupported declaration version.");
  if (operation.type === "clear") return freshDeclaration(declaration.stance, declaration.revision);
  const next = structuredClone(declaration);
  if (operation.type === "complete") {
    if (next.status !== "locked" || !next.snapshot.entries.some(e => e.id === operation.entryId)) throw new Error("Locked entry not found.");
    next.completed = next.completed.includes(operation.entryId) ? next.completed.filter(e => e !== operation.entryId) : [...next.completed, operation.entryId];
    return next;
  }
  if (next.status !== "editing") throw new Error("End this declaration before editing the next turn.");
  switch (operation.type) {
    case "endurance-spend":
      if (!Number.isInteger(operation.enduranceSpend) || operation.enduranceSpend < 0 || operation.enduranceSpend > 2) throw new Error("Choose 0, 1 or 2 Endurance.");
      next.enduranceSpend = operation.enduranceSpend;
      break;
    case "stance":
      if (!DECLARATION_STANCES.includes(operation.stance)) throw new Error("Unknown stance.");
      next.stance = operation.stance;
      break;
    case "add":
      if (!next.stance) throw new Error("Choose stance first.");
      if (operation.kind === "movement" && next.entries.some(e => e.kind === "movement")) throw new Error("Movement is already declared.");
      if (!["action", "movement"].includes(operation.kind) || !id) throw new Error("Invalid declaration entry.");
      next.entries.push({ id, kind: operation.kind, itemId: operation.itemId ?? "", actionId: operation.actionId ?? "" });
      break;
    case "remove": next.entries = next.entries.filter(e => e.id !== operation.entryId); break;
    case "move": {
      const index = next.entries.findIndex(e => e.id === operation.entryId);
      const destination = index + operation.direction;
      if (![-1, 1].includes(operation.direction) || index < 0 || destination < 0 || destination >= next.entries.length) throw new Error("Cannot move that entry.");
      [next.entries[index], next.entries[destination]] = [next.entries[destination], next.entries[index]];
      break;
    }
    default: throw new Error("Unknown declaration edit.");
  }
  return next;
}
