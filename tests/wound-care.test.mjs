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

test("woundCare round-trip values", async () => {
  const a = actor();
  const careValues = ["none", "bandaged", "treated", "grievousHealingPending"];
  for (const val of careValues) {
    const changes = { "system.health.woundCare.care": val, "system.health.woundCare.daysRemaining": 5 };
    await a.update(changes);
    const updated = a.system.health.woundCare;
    assert.equal(updated.care, val);
    assert.equal(updated.daysRemaining, 5);
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