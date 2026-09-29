/**
 * @file Client-only Companion shell lifecycle. Reuses FatedMobileSheet and Foundry
 * User.character; serializes shell refreshes after ready, resize and Document hooks.
 * Local DOM/CSS suppression never mutates shared Scenes or replaces Actor storage.
 */
import { uiText, systemMessage } from "./presentation/text.mjs";
import { FatedMobileSheet } from "./sheets/mobile-sheet.mjs";
import { shouldActivateCompanion, companionCharacterState } from "./companion-state.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Persistent frameless mobile shell; only explicit disposal may close it. */
class CompanionSheet extends FatedMobileSheet {
  static DEFAULT_OPTIONS = { classes: ["fated-companion"], window: { frame: false, positioned: false } };

  // The primary surface cannot be dismissed by Escape or Foundry's close-all command.
  async close(options = {}) {
    if (options.companionDispose) return super.close(options);
    return this;
  }
}

/** Same shell lifecycle when the linked character is missing or inaccessible. */
class CompanionFallback extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = { classes: ["fated", "fated-mobile", "fated-companion"], window: { frame: false, positioned: false } };
  static PARTS = { main: { template: "systems/fated/templates/companion-fallback.hbs" } };
  async _prepareContext() { const state = companionCharacterState(game.user); return { ...state, message: systemMessage(state.message) }; }
  async close(options = {}) {
    if (options.companionDispose) return super.close(options);
    return this;
  }
}

/**
 * Client-only controller; documents and synchronization remain entirely Foundry-owned.
 *
 * Installs DOM listeners and Foundry hooks, creates a menu, and queues shell
 * synchronization. Returns no state; local activation persists across resize
 * until GM status clears it. Does not persist settings or Actor changes.
 */
export function initializeCompanionMode() {
  // Session-local latch: rotation/resizing does not eject an activated player.
  let active = false;
  let shell;
  let actorId;
  // Serialize asynchronous render/dispose work; this is not a Document-write queue.
  let pending = Promise.resolve();
  const menu = document.createElement("details");
  menu.className = "fated-companion-menu";
  menu.innerHTML = `
    <summary>${uiText("Companion menu")}</summary>
    <button type="button" data-companion="return">${uiText("Open character interface")}</button>
    <button type="button" data-companion="settings">${uiText("Foundry settings")}</button>
    <button type="button" data-companion="refresh">${uiText("Refresh / reconnect")}</button>
    <button type="button" data-companion="logout">${uiText("Log out")}</button>
  `;
  /** Reconcile linked-character/GM changes with local shell and CSS state. */
  async function synchronize() {
    if (game.user.isGM) {
      active = false;
      await shell?.close({ companionDispose: true });
      shell = undefined;
      menu.remove();
      document.body.classList.remove("fated-companion-active");
      return;
    }
    active ||= shouldActivateCompanion({ isGM: false, width: window.innerWidth, height: window.innerHeight,
      touch: navigator.maxTouchPoints > 0, coarse: window.matchMedia("(pointer: coarse)").matches });
    if (!active) return;
    document.body.classList.add("fated-companion-active");
    if (!menu.isConnected) document.body.append(menu);
    const { actor } = companionCharacterState(game.user);
    if (!shell || actorId !== actor?.id) {
      await shell?.close({ companionDispose: true });
      actorId = actor?.id;
      shell = actor ? new CompanionSheet({ document: actor }) : new CompanionFallback();
    }
    await shell.render({ force: true });
    shell.bringToFront();
  }
  /** Queue reconciliation and recover the queue after a render failure. */
  function refresh() {
    pending = pending.then(synchronize).catch(error => {
      console.error("Fated | Companion Mode", error);
      ui.notifications.error(uiText("Companion Mode could not open. Use Refresh / reconnect in the Companion menu."));
    });
  }
  menu.addEventListener("click", async event => {
    const action = event.target.closest("[data-companion]")?.dataset.companion;
    if (action === "return") {
      menu.open = false;
      // Frameless applications cannot bringToFront in v14. Dismiss this character's
      // Item editors through their normal close lifecycle instead of leaving them over the shell.
      for (const item of game.user.character?.items.contents ?? []) {
        for (const app of Object.values(item.apps)) if (app.rendered) await app.close();
      }
      refresh();
    }
    if (action === "refresh") window.location.reload();
    if (action === "logout") game.logOut();
    if (action === "settings") {
      menu.open = false;
      await game.settings.sheet.render({ force: true });
      game.settings.sheet.bringToFront?.();
    }
  });
  window.addEventListener("resize", refresh);
  // Core Escape opens a modal menu inside the suppressed interface, making the shell inert.
  // Companion has its own visible menu; keep that hidden core dialog from opening.
  for (const type of ["keydown", "keyup"]) window.addEventListener(type, event => {
    if (active && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      menu.open = false;
    }
  }, { capture: true });
  Hooks.on("updateUser", user => { if (user.id === game.user.id) refresh(); });
  Hooks.on("updateActor", actor => { if (actor.id === game.user.character?.id) refresh(); });
  Hooks.on("deleteActor", actor => { if (actor.id === actorId) refresh(); });
  refresh();
}
