import { editDeclaration, evaluateDeclaration, lockDeclaration, powerActionAdditionIssue, freshDeclaration } from "./evaluate.mjs";
import { actorStateModifiers, getActorHealth } from "../health.mjs";

export function getDeclarationEvaluation(actor) {
  const declaration = actor.system.declaration.toObject();
  if (declaration.status === "locked") return { ...declaration.snapshot, locked: true, issues: [], canLock: false };
  return { ...evaluateDeclaration(declaration, actor.getAvailableActions(), actor.system.attributes,
    () => actorStateModifiers(actor), getActorHealth(actor)), locked: false };
}

/** Revision checks reject stale rendered controls; Foundry handles ownership and persistence. */
export async function updateDeclaration(actor, revision, operation) {
  if (actor.type !== "fated" || !actor.isOwner) throw new Error("Only an owner of a Fated Actor can change its declaration.");
  const current = actor.system.declaration.toObject();
  if (revision !== current.revision) throw new Error("This declaration changed. Review the refreshed turn and try again.");
  let next;
  if (operation.type === "lock") next = lockDeclaration(current, actor.getAvailableActions(), actor.system.attributes, {
    userId: game.user.id, additionalModifiers: () => actorStateModifiers(actor), actorState: getActorHealth(actor) });
  else {
    if (operation.type === "add" && operation.kind === "action") {
      const actions = actor.getAvailableActions();
      const action = actions.find(a => a.id === operation.actionId && a.source.itemId === operation.itemId);
      if (!action) throw new Error("Action is no longer owned and enabled.");
      const issue = powerActionAdditionIssue(action, evaluateDeclaration(current, actions, actor.system.attributes));
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
  await actor.update({ "system.declaration": next,
    ...(operation.type === "lock" ? { "system.currentStance": next.stance } : {}),
    ...(breaksBandage ? { "system.health.woundCare": { care: "none", daysRemaining: 0 } } : {}) });
}
