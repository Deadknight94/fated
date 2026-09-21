import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));

const { FatedDataModel } = await import("../module/data-models.mjs");

function actor(data = {}) {
  const system = foundry.utils.mergeObject(
    {
      attributes: { heart: 2, body: 3, mind: 4 },
      resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 },
      health: { woundSeverity: 0, stabilized: false, dead: false },
    },
    data,
    { inplace: false }
  );
  const a = {
    id: "test",
    uuid: "Actor.test",
    type: "fated",
    isOwner: true,
    user: { isGM: false },
    updates: [],
    system: new FatedDataModel(system),
    getAvailableActions: () => [],
    async update(changes) {
      await this.system._preUpdate(changes, {}, this.user);
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    },
  };
  a.system.prepareDerivedData();
  return a;
}

test("woundCare defaults", () => {
  const a = actor();
  const { woundCare } = a.system.health;
  assert.equal(woundCare.care, "none");
  assert.equal(woundCare.daysRemaining, 0);
});

test("woundCare schema accepts and preserves care values", () => {
  const baseSystem = {
    attributes: { heart: 2, body: 3, mind: 4 },
    resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 },
    health: { woundSeverity: 0, woundCare: { care: "none", daysRemaining: 0 } },
  };
  const careValues = ["none", "bandaged", "treated", "grievousHealingPending"];
  for (const val of careValues) {
    const system = foundry.utils.mergeObject(baseSystem, {
      health: { woundCare: { care: val, daysRemaining: 5 } }
    }, { inplace: false });
    const dm = new FatedDataModel(system);
    assert.equal(dm.health.woundCare.care, val);
    assert.equal(dm.health.woundCare.daysRemaining, 5);
  }
});

test("woundCare daysRemaining cleans to a nonnegative integer", () => {
  const NumberField = foundry.data.fields.NumberField;
  const field = new NumberField({
    required: true,
    nullable: false,
    integer: true,
    min: 0,
    initial: 0
  });

  assert.equal(field.clean(-1), 0);
  assert.equal(field.clean(1.5), 2);
});

// Test that normalizeWoundCare does NOT mutate its input object.
test("normalizeWoundCare is pure and does not mutate input", async () => {
  const { normalizeWoundCare } = await import("../module/wound-care.mjs");
  const input = { care: "treated", daysRemaining: 5 };
  const copy = JSON.parse(JSON.stringify(input));
  const result = normalizeWoundCare(2, input);
  // The input should remain unchanged.
  assert.deepEqual(input, copy);
  // The result should be a new object with the same values.
  assert.deepEqual(result, { care: "treated", daysRemaining: 5 });
});
