/**
 * @file Foundry Actor boundary for declaration reads and persistent mutations. Connects
 * pure evaluation to projected Endurance Push context and commits lock effects
 * together. Revisions detect stale controls, not simultaneous cross-client writes.
 */
import { editDeclaration, evaluateDeclaration, lockDeclaration, powerActionAdditionIssue, freshDeclaration } from "./evaluate.mjs";
import { endurancePushContext, enduranceSpendIssue } from "./endurance-push.mjs";

/**
 * Read-only service returning a saved snapshot when locked, otherwise evaluating
 * current Actions with projected Endurance Push. Locked reads never recalculate
 * from subsequently changed Actor or Item values.
 */
export function getDeclarationEvaluation(actor) {
  const declaration = actor.system.declaration.toObject();
  if (declaration.status === "locked") return { ...declaration.snapshot, locked: true, issues: [], canLock: false };
  const push = endurancePushContext(actor, declaration.enduranceSpend);
  return { ...evaluateDeclaration(declaration, actor.getAvailableActions(), actor.system,
    () => push.modifiers, push.actorState), locked: false };
}

/**
 * Revision checks reject stale rendered controls; Foundry handles ownership and persistence.
 *
 * Persistent operation dispatcher using the rendered revision and operation data.
 * Increments revision and replaces declaration in one Actor.update(), including
 * lock-time stance, Endurance cost and bandage break. Returns Promise<void>.
 * The revision check is client-side, not a server transaction or cross-client lock.
 */
export async function updateDeclaration(actor, revision, operation) {
  if (actor.type !== "fated" || !actor.isOwner) throw new Error("Only an owner of a Fated Actor can change its declaration.");
  const current = actor.system.declaration.toObject();
  if (revision !== current.revision) throw new Error("This declaration changed. Review the refreshed turn and try again.");
  let next;
  if (operation.type === "lock") {
    const push = endurancePushContext(actor, current.enduranceSpend);
    next = lockDeclaration(current, actor.getAvailableActions(), actor.system, {
      userId: game.user.id, additionalModifiers: () => push.modifiers, actorState: push.actorState });
  }
  else {
    if (operation.type === "endurance-spend") {
      const issue = enduranceSpendIssue(operation.enduranceSpend, actor.system);
      if (issue) throw new Error(issue);
    }
    if (operation.type === "add" && operation.kind === "action") {
      const actions = actor.getAvailableActions();
      const action = actions.find(a => a.id === operation.actionId && a.source.itemId === operation.itemId);
      if (!action) throw new Error("Action is no longer owned and enabled.");
      const issue = powerActionAdditionIssue(action, evaluateDeclaration(current, actions, actor.system));
      if (issue) throw new Error(issue);
    }
    next = operation.type === "clear" ? freshDeclaration(actor.system.currentStance, current.revision)
      : editDeclaration(current, operation, { id: foundry.utils.randomID() });
  }
  next.revision = current.revision + 1;
  // Snapshot calculations above use the intact bandage. Commit its break with
  // the lock, without re-evaluating the historical snapshot afterward.
  const breaksBandage = operation.type === "lock" && next.snapshot.multiActionPenalty > 0
    && actor.system.health.woundSeverity === 2 && actor.system.health.woundCare.care === "bandaged";
  // Replace the whole declaration and its lock costs in one Document operation.
  // Completing/clearing never recharges or refunds the locked Endurance spend.
  await actor.update({ "system.declaration": next,
    ...(operation.type === "lock" && next.enduranceSpend ? {
      "system.resources.endurance.value": actor.system.resources.endurance.value - next.enduranceSpend
    } : {}),
    ...(operation.type === "lock" ? { "system.currentStance": next.stance } : {}),
    ...(breaksBandage ? { "system.health.woundCare": { care: "none", daysRemaining: 0 } } : {}) });
}
