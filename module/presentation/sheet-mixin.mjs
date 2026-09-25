import { isSystemMessage, systemMessage } from "./text.mjs";

/** Translate only the display of rejected sheet submissions; validation stays in the DataModels. */
export function localizedError(error, i18n) {
  // Foundry wraps joint-validation messages in a tree of field paths. Present recognized
  // system messages without exposing that developer-oriented wrapper to the player.
  const lines = error.message.split("\n");
  const wrapped = lines.some(line => /validation errors:|#_validateRecursive/.test(line));
  const leafMessages = wrapped ? lines.map(line => line.trim().replace(/^[\w.]+: /, "")) : lines;
  const translatedLeaves = leafMessages.map(message => systemMessage(message, i18n));
  const recognized = leafMessages.some(isSystemMessage);
  const message = recognized
    ? translatedLeaves.filter(line => !/validation errors:|#_validateRecursive/.test(line)).join("\n")
    : systemMessage(error.message, i18n);
  if (!recognized && message === error.message) return error;
  return new Error(message, { cause: error });
}

export function LocalizedSheetMixin(Base) {
  return class extends Base {
    _prepareSubmitData(...args) {
      try { return super._prepareSubmitData(...args); }
      catch (error) { throw localizedError(error); }
    }

    async _processSubmitData(...args) {
      try { return await super._processSubmitData(...args); }
      catch (error) { throw localizedError(error); }
    }
  };
}
