import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { ActionDataModel } = await import("../module/actions/action-model.mjs");
const { DeclarationDataModel } = await import("../module/declaration/data-model.mjs");
const { FatedDataModel, EquipmentDataModel } = await import("../module/data-models.mjs");
const { getItemActions } = await import("../module/actions/actions.mjs");
const { freshDeclaration, evaluateDeclaration, lockDeclaration, editDeclaration, powerActionAdditionIssue } = await import("../module/declaration/evaluate.mjs");
const { updateDeclaration, getDeclarationEvaluation } = await import("../module/declaration/service.mjs");

function action(overrides = {}) {
  return { ...new ActionDataModel({ id: "strike", name: "Strike", classification: "main", rollRequirement: "required",
    successDice: { source: "fixed", base: 4 }, successThreshold: 4, allowedStances: ["neutral", "offensive"],
    multiActionEligible: true, ...overrides }).toObject(), source: { itemId: "item", itemUuid: "Actor.actor.Item.item", itemName: "Test Item", itemType: "weapon" }, key: "Actor.actor.Item.item#strike" };
}
const entry = (id, actionId = "strike") => ({ id, kind: "action", itemId: "item", actionId });
const move = { id: "movement", kind: "movement", itemId: "", actionId: "" };
const draft = entries => ({ ...freshDeclaration("neutral"), entries });
const codes = result => result.issues.map(i => i.code);

test("one/two/three Main Actions add only 0/1/2 Threshold and recalculate on removal", () => {
  for (const count of [1, 2, 3]) {
    const d = draft(Array.from({ length: count }, (_, i) => entry(`e${i}`)));
    const result = evaluateDeclaration(d, [action()]);
    assert.equal(result.canLock, true);
    assert.equal(result.multiActionPenalty, count - 1);
    for (const e of result.entries) {
      assert.equal(e.calculation.successDice.total, 4);
      assert.equal(e.calculation.successThreshold.total, 4 + count - 1);
      assert.equal(e.calculation.successThreshold.modifiers[0].source.mainCount, count);
    }
    if (count > 1) {
      const changed = editDeclaration(d, { type: "remove", entryId: "e0" });
      assert.equal(evaluateDeclaration(changed, [action()]).multiActionPenalty, count - 2);
    }
  }
});

test("stances apply the canonical attack roll modifiers", () => {
  const cases = [
    {
      stance: "neutral",
      attackType: "melee",
      expectedDice: 4,
      expectedThreshold: 4
    },
    {
      stance: "offensive",
      attackType: "melee",
      expectedDice: 4,
      expectedThreshold: 3
    },
    {
      stance: "offensive",
      attackType: "ranged",
      expectedDice: 4,
      expectedThreshold: 3
    },
    {
      stance: "defensive",
      attackType: "melee",
      expectedDice: 3,
      expectedThreshold: 4
    },
    {
      stance: "defensive",
      attackType: "ranged",
      expectedDice: 3,
      expectedThreshold: 4
    },
    {
      stance: "ranged",
      attackType: "ranged",
      expectedDice: 5,
      expectedThreshold: 4
    },
    {
      stance: "ranged",
      attackType: "melee",
      expectedDice: 4,
      expectedThreshold: 4
    }
  ];

  for (const { stance, attackType, expectedDice, expectedThreshold } of cases) {
    const a = action({
      attackType,
      allowedStances: ["neutral", "offensive", "defensive", "ranged"]
    });

    const declaration = {
      ...freshDeclaration(stance),
      entries: [entry(`${stance}-${attackType}`)]
    };

    const result = evaluateDeclaration(declaration, [a]);

    assert.equal(result.canLock, true, `${stance} ${attackType} should be legal`);
    assert.equal(
      result.entries[0].calculation.successDice.total,
      expectedDice,
      `${stance} ${attackType} Success Dice`
    );
    assert.equal(
      result.entries[0].calculation.successThreshold.total,
      expectedThreshold,
      `${stance} ${attackType} Success Threshold`
    );
  }
});

test("stance roll modifiers are traceable and only apply to attacks", () => {
  const offensive = evaluateDeclaration(
    {
      ...freshDeclaration("offensive"),
      entries: [entry("offensive")]
    },
    [
      action({
        attackType: "melee",
        allowedStances: ["offensive"]
      })
    ]
  );

  const offensiveThreshold =
    offensive.entries[0].calculation.successThreshold.modifiers.find(
      modifier => modifier.source?.type === "stance"
    );

  assert.equal(offensiveThreshold.value, -1);
  assert.equal(offensiveThreshold.source.stance, "offensive");

  const defensive = evaluateDeclaration(
    {
      ...freshDeclaration("defensive"),
      entries: [entry("defensive")]
    },
    [
      action({
        attackType: "melee",
        allowedStances: ["defensive"]
      })
    ]
  );

  const defensiveDie =
    defensive.entries[0].calculation.successDice.modifiers.find(
      modifier => modifier.source?.type === "stance"
    );

  assert.equal(defensiveDie.value, -1);
  assert.equal(defensiveDie.source.stance, "defensive");

  const nonAttack = evaluateDeclaration(
    {
      ...freshDeclaration("offensive"),
      entries: [entry("non-attack")]
    },
    [
      action({
        attackType: null,
        allowedStances: ["offensive"]
      })
    ]
  );

  assert.equal(
    nonAttack.entries[0].calculation.successDice.modifiers.some(
      modifier => modifier.source?.type === "stance"
    ),
    false
  );

  assert.equal(
    nonAttack.entries[0].calculation.successThreshold.modifiers.some(
      modifier => modifier.source?.type === "stance"
    ),
    false
  );
});

test("Defensive stance cannot reduce a valid Success Die pool below 1", () => {
  const a = action({
    attackType: "melee",
    successDice: { source: "fixed", base: 1 },
    allowedStances: ["defensive"]
  });

  const declaration = {
    ...freshDeclaration("defensive"),
    entries: [entry("defensive-floor")]
  };

  const result = evaluateDeclaration(declaration, [a]);

  assert.equal(result.canLock, true);
  assert.equal(result.entries[0].calculation.successDice.total, 1);
});

test("Free Actions and Movement preserve order without increasing Main count", () => {
  const free = action({ id: "free", classification: "free", rollRequirement: "none" });
  const d = draft([entry("a"), move, entry("f", "free"), entry("b")]);
  const r = evaluateDeclaration(d, [action(), free]);
  assert.equal(r.mainCount, 2); assert.equal(r.multiActionPenalty, 1); assert.equal(r.canLock, true);
  assert.equal(r.entries[2].calculation, undefined);
  assert.deepEqual(r.entries.map(e => e.id), ["a", "movement", "f", "b"]);
});

test("determinable limits and explicit Multi-Action eligibility block locking", () => {
  assert.ok(codes(evaluateDeclaration(draft([move, { ...move, id: "m2" }]), [])).includes("movement-limit"));
  assert.throws(() => editDeclaration(draft([move]), { type: "add", kind: "movement" }, { id: "m2" }));
  assert.ok(codes(evaluateDeclaration(draft([1, 2, 3, 4].map(String).map(id => entry(id))), [action()])).includes("main-limit"));
  assert.ok(codes(evaluateDeclaration(draft([entry("a"), entry("b")]), [action({ multiActionEligible: false })])).includes("multi-ineligible"));
  assert.ok(codes(evaluateDeclaration(draft([entry("a"), entry("b")]), [action({ multiActionEligible: null })])).includes("multi-unknown"));
  assert.equal(evaluateDeclaration(draft([entry("a")]), [action({ multiActionEligible: false })]).canLock, true);
});

test("Power excludes other Main/Power Actions but permits Free Actions and Movement", () => {
  const power = action({ id: "power", classification: "power" });
  const free = action({ id: "free", classification: "free", rollRequirement: "none" });
  const available = [action(), power, free];
  assert.equal(evaluateDeclaration(draft([move, entry("p", "power"), entry("f", "free")]), available).canLock, true);
  const powerOnly = evaluateDeclaration(draft([entry("p", "power")]), available);
  assert.equal(powerOnly.multiActionPenalty, 0);
  assert.deepEqual(powerOnly.entries[0].calculation.successThreshold.modifiers, []);
  assert.ok(codes(evaluateDeclaration(draft([entry("a"), entry("p", "power")]), available)).includes("power-exclusive"));
  assert.ok(codes(evaluateDeclaration(draft([entry("p", "power"), entry("p2", "power")]), available)).includes("power-exclusive"));
});

test("picker and persistence service prevent conflicting Power additions without changing existing data", async () => {
  const power = action({ id: "power", classification: "power" });
  const free = action({ id: "free", classification: "free", rollRequirement: "none" });
  const available = [action(), power, free];
  for (const [existing, requested] of [["power", "strike"], ["power", "power"], ["strike", "power"]]) {
    const declaration = draft([entry("existing", existing)]);
    const before = structuredClone(declaration);
    const actor = { type: "fated", isOwner: true, system: { declaration: new DeclarationDataModel(declaration), attributes: {} },
      getAvailableActions: () => available, update: async () => assert.fail("Rejected additions must not update the Actor") };
    assert.ok(powerActionAdditionIssue(available.find(a => a.id === requested), evaluateDeclaration(declaration, available)));
    await assert.rejects(updateDeclaration(actor, 0, { type: "add", kind: "action", itemId: "item", actionId: requested }), /unavailable/);
    assert.deepEqual(actor.system.declaration.toObject(), new DeclarationDataModel(before).toObject());
  }
});

test("Power additions retain Movement and Free Actions and do not repair stored illegal combinations", async () => {
  const power = action({ id: "power", classification: "power" });
  const free = action({ id: "free", classification: "free", rollRequirement: "none" });
  const available = [action(), power, free];
  for (const existing of [[entry("power", "power")], [entry("power", "power"), entry("main")]]) {
    const actor = { type: "fated", isOwner: true, system: { declaration: new DeclarationDataModel(draft(existing)), attributes: {} },
      getAvailableActions: () => available, update: async changes => {
        assert.deepEqual(Object.keys(changes), ["system.declaration"]);
        actor.system.declaration = new DeclarationDataModel(changes["system.declaration"]);
      } };
    assert.equal(powerActionAdditionIssue(free, evaluateDeclaration(draft(existing), available)), null);
    await updateDeclaration(actor, 0, { type: "add", kind: "movement" });
    await updateDeclaration(actor, 1, { type: "add", kind: "action", itemId: "item", actionId: "free" });
    const saved = actor.system.declaration.toObject();
    assert.deepEqual(saved.entries.slice(0, existing.length), existing);
    assert.equal(saved.entries.at(-2).kind, "movement");
    assert.equal(saved.entries.at(-1).actionId, "free");
    const result = evaluateDeclaration(saved, available);
    assert.equal(result.canLock, existing.length === 1);
    if (existing.length > 1) assert.ok(codes(result).includes("power-exclusive"));
  }
});

test("stance changes evaluate restrictions; unknown metadata is never presumed legal", () => {
  const d = draft([entry("a")]);
  assert.equal(evaluateDeclaration(d, [action()]).canLock, true);
  const changed = editDeclaration(d, { type: "stance", stance: "defensive" });
  assert.ok(codes(evaluateDeclaration(changed, [action()])).includes("stance-disallowed"));
  assert.ok(codes(evaluateDeclaration(d, [action({ allowedStances: [] })])).includes("stances-unknown"));
  assert.ok(codes(evaluateDeclaration(d, [action({ classification: "" })])).includes("classification"));
  assert.ok(codes(evaluateDeclaration(d, [])).includes("missing-action"));
  assert.throws(() => editDeclaration(freshDeclaration(), { type: "add", kind: "movement" }, { id: "m" }));
});

test("roll requirement remains three-state including legacy numeric data", () => {
  const legacy = new EquipmentDataModel({ action: { enabled: true, type: "main", range: { min: 0, max: 1 } } });
  assert.equal(legacy.actions[0].rollRequirement, null);
  assert.equal(new ActionDataModel({ successDice: { source: "fixed", base: 4 }, successThreshold: 4 }).rollRequirement, null);
  const d = draft([entry("a")]);
  assert.ok(codes(evaluateDeclaration(d, [action({ rollRequirement: null })])).includes("roll-unknown"));
  assert.equal(evaluateDeclaration(d, [action({ successThreshold: null })]).canLock, true);
  assert.ok(codes(evaluateDeclaration(d, [action({ modifiers: { successThreshold: [{ value: null }] } })])).includes("roll-incomplete"));
  assert.ok(codes(evaluateDeclaration(d, [action({ successDice: { source: "", base: 4 } })])).includes("roll-incomplete"));
  assert.equal(evaluateDeclaration(d, [action({ rollRequirement: "none", successThreshold: null, successDice: { source: "", base: null } })]).canLock, true);
  assert.throws(() => new ActionDataModel({ rollRequirement: false }, { strict: true }));
});

test("additional modifiers remain separate and traceable without accumulated totals", () => {
  const a = action({ modifiers: { successDice: [{ id: "equipment", label: "Configured", value: 1 }] } });
  const provider = () => ({ successDice: [{ id: "other", label: "Other source", value: -1, source: { type: "test" } }],
    successThreshold: [{ id: "threshold", label: "Configured threshold", value: -1, source: { type: "test" } }] });
  const r = evaluateDeclaration(draft([entry("a"), entry("b")]), [a], {}, provider);
  assert.equal(r.entries[0].calculation.successDice.total, 4);
  assert.equal(r.entries[0].calculation.successThreshold.total, 4);
  assert.equal(r.entries[0].calculation.successDice.modifiers[1].source.type, "test");
  assert.equal(evaluateDeclaration(draft([entry("a")]), [a]).entries[0].calculation.successDice.total, 5);
});

test("lock creates a deep snapshot with stable references and persisted calculations", () => {
  const a = action({ successDice: { source: "heart", base: null }, rules: "Original rule", effect: "Original effect" });
  const attrs = { heart: 4 };
  const d = draft([entry("a"), move, entry("b")]);
  const locked = lockDeclaration(d, [a], attrs, { userId: "user", now: "2026-09-15T12:00:00.000Z" });
  const before = structuredClone(locked);
  a.name = "Changed"; a.rules = "Changed rule"; a.successThreshold = 100; a.source.itemName = "Changed Item"; attrs.heart = 99;
  assert.deepEqual(locked, before);
  const saved = new DeclarationDataModel(locked, { strict: true }).toObject();
  const reloaded = new DeclarationDataModel(JSON.parse(JSON.stringify(saved)), { strict: true }).toObject();
  assert.deepEqual(reloaded, saved);
  assert.equal(reloaded.snapshot.entries[0].actionId, "strike");
  assert.equal(reloaded.snapshot.entries[0].itemId, "item");
  assert.equal(reloaded.snapshot.entries[0].calculation.successDice.total, 4);
  assert.equal(reloaded.snapshot.entries[0].calculation.successThreshold.total, 5);
  assert.equal(reloaded.snapshot.entries[0].calculation.successThreshold.modifiers[0].source.mainCount, 2);
  assert.equal(reloaded.snapshot.entries[1].movementHexes, 3);
  assert.equal(getDeclarationEvaluation({ system: { declaration: new DeclarationDataModel(locked) }, getAvailableActions() { throw new Error("Locked display must not read Items"); } }).locked, true);
  assert.throws(() => editDeclaration(locked, { type: "remove", entryId: "a" }));
  assert.throws(() => lockDeclaration(draft([entry("a")]), [action({ rollRequirement: null })], {}));
});

test("ordering, completion and clearing preserve snapshot and Actor resources", () => {
  const d = editDeclaration(draft([entry("a"), move]), { type: "move", entryId: "movement", direction: -1 });
  assert.deepEqual(d.entries.map(e => e.id), ["movement", "a"]);
  const locked = lockDeclaration(d, [action()], {});
  const completed = editDeclaration(locked, { type: "complete", entryId: "a" });
  assert.deepEqual(completed.snapshot, locked.snapshot); assert.deepEqual(completed.completed, ["a"]);
  const actor = new FatedDataModel({ attributes: { heart: 2, body: 3, mind: 4 }, resources: { power: 3 }, declaration: completed });
  const oldResources = actor.toObject().resources;
  const cleared = editDeclaration(completed, { type: "clear" });
  assert.equal(cleared.stance, "neutral"); assert.equal(cleared.status, "editing");
  assert.deepEqual(cleared.entries, []); assert.equal(cleared.snapshot, null); assert.deepEqual(cleared.completed, []);
  actor.updateSource({ declaration: cleared });
  assert.deepEqual(actor.toObject().resources, oldResources);
});

test("required rolls with valid dice and no stored Threshold lock at universal 4 plus Multi-Action", () => {
  const a = action({ successThreshold: undefined, modifiers: { successThreshold: [{ id: "specific", label: "Specific deviation", value: -1 }] } });
  delete a.successThreshold;
  for (const count of [1, 2, 3]) {
    const d = draft(Array.from({ length: count }, (_, i) => entry(String(i))));
    const result = evaluateDeclaration(d, [a]);
    assert.equal(result.canLock, true);
    const locked = lockDeclaration(d, [a], {});
    const saved = new DeclarationDataModel(locked, { strict: true }).toObject();
    for (const e of saved.snapshot.entries) {
      assert.equal(e.calculation.successThreshold.base, 4);
      assert.equal(e.calculation.successThreshold.total, 3 + count - 1);
      assert.equal(e.calculation.successThreshold.complete, true);
      assert.deepEqual(e.calculation.successThreshold.modifiers.map(m => m.id), ["specific", "multi-action"]);
    }
  }
});

test("non-4 source data blocks required-roll locking without migration; historical snapshots remain unchanged", () => {
  const a = action({ successThreshold: 8 });
  assert.ok(codes(evaluateDeclaration(draft([entry("a")]), [a])).includes("threshold-review"));
  assert.throws(() => lockDeclaration(draft([entry("a")]), [a], {}), /requires review/);
  assert.equal(a.successThreshold, 8);
  const historical = lockDeclaration(draft([entry("a")]), [action()], {});
  historical.snapshot.entries[0].action.successThreshold = 8;
  historical.snapshot.entries[0].calculation.successThreshold.base = 8;
  historical.snapshot.entries[0].calculation.successThreshold.total = 8;
  const model = new DeclarationDataModel(historical, { strict: true });
  assert.equal(model.snapshot.entries[0].calculation.successThreshold.total, 8);
  assert.equal(new DeclarationDataModel(JSON.parse(JSON.stringify(model.toObject()))).snapshot.entries[0].action.successThreshold, 8);
});

test("Actor persistence service rejects stale controls and touches only declaration", async () => {
  const actor = { type: "fated", isOwner: true, system: { currentStance: "neutral", declaration: new DeclarationDataModel(freshDeclaration()) },
    getAvailableActions: () => [], update: async changes => { assert.deepEqual(Object.keys(changes), ["system.declaration"]); actor.system.declaration = new DeclarationDataModel(changes["system.declaration"]); } };
  await updateDeclaration(actor, 0, { type: "stance", stance: "offensive" });
  assert.equal(actor.system.declaration.revision, 1);
  await assert.rejects(updateDeclaration(actor, 0, { type: "clear" }), /changed/);
  await updateDeclaration(actor, 1, { type: "clear" });
  assert.equal(actor.system.declaration.stance, "neutral");
  actor.type = "npc";
  await assert.rejects(updateDeclaration(actor, 2, { type: "clear" }), /Fated/);
});
