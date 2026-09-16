const { ArrayField, BooleanField, EmbeddedDataField, NumberField, SchemaField, StringField } = foundry.data.fields;

const text = () => new StringField({ required: true, nullable: false, initial: "" });
const choice = choices => new StringField({ required: true, blank: true, initial: "", choices: ["", ...choices] });
const optionalNumber = () => new NumberField({ required: true, nullable: true, initial: null, integer: true });
const identifier = () => new StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() });

export const STANCES = ["neutral", "offensive", "defensive", "ranged"];
export const BASE_SUCCESS_THRESHOLD = 4;

/** Unknown configuration remains unspecified; Success Threshold has a universal base. */
export class ActionDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const modifiers = () => new ArrayField(new SchemaField({
      id: identifier(), label: text(), value: optionalNumber()
    }));
    return {
      id: identifier(),
      enabled: new BooleanField({ initial: true }),
      name: text(),
      classification: choice(["main", "free", "power"]),
      rollRequirement: new StringField({ required: true, nullable: true, initial: null, choices: ["required", "none"] }),
      successDice: new SchemaField({ source: choice(["fixed", "heart", "body", "mind"]), base: optionalNumber() }),
      // Retained for lossless legacy review. Calculations never use this as their base.
      successThreshold: new NumberField({ required: true, nullable: true, initial: BASE_SUCCESS_THRESHOLD, integer: true }),
      attackType: choice(["melee", "ranged"]),
      range: new SchemaField({ min: optionalNumber(), max: optionalNumber(), units: text() }),
      effect: text(),
      rules: text(),
      allowedStances: new ArrayField(new StringField({ choices: STANCES, blank: false })),
      multiActionEligible: new BooleanField({ required: true, nullable: true, initial: null }),
      modifiers: new SchemaField({ successDice: modifiers(), successThreshold: modifiers() })
    };
  }

  static validateJoint(data) {
    if (data.range.min !== null && data.range.max !== null && data.range.min > data.range.max) {
      throw new Error("Minimum range cannot exceed maximum range.");
    }
  }
}

export const actionsField = () => new ArrayField(new EmbeddedDataField(ActionDataModel));

/** Read-time, idempotent migration. Saving an Item persists the migrated array. */
export function migrateLegacyAction(source) {
  if (Object.hasOwn(source, "actions")) return source;
  source.actions = [];
  const legacy = source.action;
  if (!legacy) return source;
  source.actions.push({
    id: "legacy-action",
    enabled: legacy.enabled === true,
    name: legacy.name ?? "",
    classification: ["main", "free", "power"].includes(legacy.type) ? legacy.type : "",
    allowedStances: legacy.stance === "any" ? [...STANCES] : STANCES.filter(s => s === legacy.stance),
    range: { min: legacy.range?.min ?? null, max: legacy.range?.max ?? null, units: "" },
    rules: legacy.type === "passive" ? "Legacy action type: passive (classification requires review)." : ""
  });
  return source;
}
