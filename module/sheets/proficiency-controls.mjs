import { normalizeProficiencyKey, hasDuplicateKey } from "../helpers/proficiency-keys.mjs";

const pendingActors = new WeakSet();
const message = key => game.i18n.localize(`FATED.Validation.${key}`);

/** Rename only this Actor's proficiency and matching embedded Item references. */
export async function renameProficiency(sheet, oldKey, value) {
  if (!game.user.isGM || !sheet.isEditable) throw new Error(message("ProficiencyKeyPermission"));
  const actor = sheet.document;
  if (pendingActors.has(actor)) throw new Error(message("ProficiencyKeyPending"));
  const proficiencies = actor.system.proficiencies ?? [];
  if (!proficiencies.some(prof => prof.key === oldKey)) throw new Error(message("ProficiencyKeyMissing"));
  // Unchanged camelCase keys must not be normalized again (the helper lowercases words).
  if (value === oldKey) return oldKey;
  const key = normalizeProficiencyKey(value);
  if (!key) throw new Error(message("InvalidProficiencyKey"));
  if (key === oldKey) return oldKey;
  if (hasDuplicateKey(proficiencies, key)) {
    throw new Error(game.i18n.format("FATED.Validation.DuplicateProficiency", { key }));
  }
  const before = proficiencies.map(prof => ({ ...prof }));
  const after = before.map(prof => prof.key === oldKey ? { ...prof, key } : prof);
  const items = actor.items.contents.filter(item => item.system.proficiency === oldKey);
  pendingActors.add(actor);
  try {
    await actor.update({ "system.proficiencies": after }, { render: false });
    try {
      if (items.length) await actor.updateEmbeddedDocuments("Item",
        items.map(item => ({ _id: item.id, "system.proficiency": key })), { render: false });
    } catch (error) {
      // Embedded writes and Actor writes are separate operations. Restore both on failure.
      const results = await Promise.allSettled([
        actor.update({ "system.proficiencies": before }, { render: false }),
        actor.updateEmbeddedDocuments("Item",
          items.map(item => ({ _id: item.id, "system.proficiency": oldKey })), { render: false })
      ]);
      if (results.some(result => result.status === "rejected")) {
        throw new Error(message("ProficiencyKeyRecoveryFailed"), { cause: error });
      }
      throw error;
    }
    return key;
  } finally {
    pendingActors.delete(actor);
  }
}

export function captureProficiencyDetails(sheet) {
  // Keep character-section state while the mobile sheet displays another section.
  const details = sheet.element?.querySelectorAll("details[data-proficiency-key]") ?? [];
  if (details.length) sheet._openProficiencyKeys = new Set(
    Array.from(details).filter(element => element.open).map(element => element.dataset.proficiencyKey));
}

export function restoreProficiencyDetails(sheet) {
  for (const details of sheet.element?.querySelectorAll("details[data-proficiency-key]") ?? []) {
    details.open = sheet._openProficiencyKeys?.has(details.dataset.proficiencyKey) ?? false;
  }
}

/** Both sheets use the same guarded key-change route, separate from normal form updates. */
export function ProficiencySheetMixin(Base) {
  return class extends Base {
    _processFormData(event, form, formData) {
      const data = super._processFormData(event, form, formData);
      // Ordinary submissions may edit other fields, but never rename keys or bypass the handler.
      for (const [index, prof] of Object.entries(data.system?.proficiencies ?? {})) {
        const existing = this.document.system.proficiencies?.[index];
        if (existing) prof.key = existing.key;
      }
      return data;
    }

    async _onChangeForm(formConfig, event) {
      const input = event.target;
      if (!input.matches?.("input[data-proficiency-key-input]")) return super._onChangeForm(formConfig, event);
      if (this._proficiencyRenamePending) return;
      this._proficiencyRenamePending = true;
      const oldKey = input.dataset.proficiencyKeyInput;
      captureProficiencyDetails(this);
      try {
        const key = await renameProficiency(this, oldKey, input.value);
        // Remap the existing DOM before _preRender captures its state again.
        for (const element of this.element?.querySelectorAll("[data-proficiency-key]") ?? []) {
          if (element.dataset.proficiencyKey === oldKey) element.dataset.proficiencyKey = key;
        }
        if (this._openProficiencyKeys?.delete(oldKey)) this._openProficiencyKeys.add(key);
      } catch (error) {
        ui.notifications.warn(error.message);
      } finally {
        this._proficiencyRenamePending = false;
        await this.render({ force: true });
        // Refresh other open sheets only after the Actor and Item references agree.
        for (const app of Object.values(this.document.apps ?? {})) {
          if (app !== this) app.render({ force: true });
        }
      }
    }
  };
}
