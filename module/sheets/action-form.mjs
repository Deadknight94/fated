/** Turn indexed form objects into arrays without letting field edits replace sibling Actions. */
export function readActionForm(submitted, current) {
  return current.map((action, index) => {
    const input = submitted[index];
    if (!input) return action;
    const merged = { ...action, ...input,
      successDice: { ...action.successDice, ...input.successDice },
      range: { ...action.range, ...input.range },
      modifiers: { ...action.modifiers } };
    const number = value => value === "" || value === null || value === undefined ? null : Number(value);
    merged.successDice.base = number(merged.successDice.base);
    // This legacy field is not editable; unrelated form edits must preserve it.
    merged.successThreshold = action.successThreshold;
    merged.rollRequirement = merged.rollRequirement || null;
    merged.range.min = number(merged.range.min);
    merged.range.max = number(merged.range.max);
    merged.multiActionEligible = input.multiActionEligible === "" ? null
      : input.multiActionEligible === "true" || input.multiActionEligible === true ? true
      : input.multiActionEligible === "false" || input.multiActionEligible === false ? false : action.multiActionEligible;
    if (input.stances) merged.allowedStances = Object.keys(input.stances).filter(key => input.stances[key]);
    delete merged.stances;
    for (const kind of ["successDice", "successThreshold"]) {
      merged.modifiers[kind] = action.modifiers[kind].map((modifier, i) => ({
        ...modifier, ...input.modifiers?.[kind]?.[i],
        value: number(input.modifiers?.[kind]?.[i] && Object.hasOwn(input.modifiers[kind][i], "value")
          ? input.modifiers[kind][i].value : modifier.value)
      }));
    }
    return merged;
  });
}
