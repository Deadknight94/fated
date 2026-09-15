import { ActionDataModel, STANCES } from "../actions/action-model.mjs";

const { ArrayField, BooleanField, EmbeddedDataField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;
const text = () => new StringField({ required: true, nullable: false, initial: "" });
const integer = (initial = 0) => new NumberField({ required: true, nullable: false, integer: true, min: 0, initial });
const optionalNumber = () => new NumberField({ required: true, nullable: true, initial: null });
const stance = () => new StringField({ required: true, blank: true, initial: "", choices: ["", ...STANCES] });
const identity = () => ({
  id: new StringField({ required: true, blank: false }),
  kind: new StringField({ required: true, choices: ["action", "movement"] }),
  itemId: text(), actionId: text()
});
const source = () => new SchemaField({ itemId: text(), itemUuid: text(), itemName: text(), itemType: text() });

class SnapshotAction extends ActionDataModel {
  static defineSchema() { return { ...super.defineSchema(), key: text(), source: source() }; }
}

const calculationValue = () => new SchemaField({
  base: optionalNumber(), total: optionalNumber(), complete: new BooleanField(),
  modifiers: new ArrayField(new SchemaField({ id: text(), label: text(), value: optionalNumber(), source: new ObjectField() }))
});

class SnapshotCalculation extends foundry.abstract.DataModel {
  static defineSchema() { return { successDice: calculationValue(), successThreshold: calculationValue() }; }
}

class DeclarationSnapshot extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      version: integer(1), stance: stance(), lockedAt: text(), lockedBy: text(),
      mainCount: integer(), multiActionPenalty: integer(),
      entries: new ArrayField(new SchemaField({ ...identity(), movementHexes: optionalNumber(),
        action: new EmbeddedDataField(SnapshotAction, { nullable: true, initial: null }),
        calculation: new EmbeddedDataField(SnapshotCalculation, { nullable: true, initial: null }) }))
    };
  }
}

export class DeclarationDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      version: integer(1), revision: integer(),
      status: new StringField({ required: true, initial: "editing", choices: ["editing", "locked"] }),
      stance: stance(), entries: new ArrayField(new SchemaField(identity())),
      snapshot: new EmbeddedDataField(DeclarationSnapshot, { nullable: true, initial: null }),
      completed: new ArrayField(new StringField({ blank: false }))
    };
  }

  static validateJoint(data) {
    if ((data.status === "locked") !== (data.snapshot !== null)) throw new Error("Locked declarations require a snapshot; editable declarations cannot retain one.");
    const entries = data.status === "locked" ? data.snapshot.entries : data.entries;
    if (new Set(entries.map(e => e.id)).size !== entries.length) throw new Error("Declaration entry IDs must be unique.");
    if (entries.some(e => e.kind === "action" && (!e.itemId || !e.actionId))) throw new Error("Action entries require Item and Action IDs.");
    if (data.completed.some(id => data.status !== "locked" || !entries.some(e => e.id === id))) throw new Error("Completion markers must reference locked entries.");
  }
}

export const declarationField = () => new EmbeddedDataField(DeclarationDataModel);
