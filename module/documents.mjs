export class FatedActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    if (this.type !== "fated") return;

    // Load is derived from physical carried Items. Weapon proficiencies and Features
    // are rules records, not carried objects, and therefore do not add Load.
    const loadTypes = new Set(["weapon", "armor", "equipment"]);
    const load = this.items.reduce((total, item) => {
      if (!loadTypes.has(item.type)) return total;
      return total + (Number(item.system.load) || 0);
    }, 0);

    this.system.load = Math.max(0, load);
  }
}

export class FatedItem extends Item {}
