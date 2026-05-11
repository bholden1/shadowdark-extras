/**
 * Backport of Shadowdark 4.0 active-effect suppression logic (PR #1297).
 *
 * In Shadowdark < 4.0 all active effects on an item are applied regardless
 * of whether the item is equipped, stashed, or identified.  The 4.0 fix
 * adds an `isSuppressed` getter on ActiveEffectSD that returns true for:
 *   – stashed items
 *   – equippable items that are not currently equipped
 *   – unidentified items
 *
 * We replicate that getter here by patching the prototype once during `init`,
 * after the system has registered its own document class.
 */

export function patchArmorActiveEffects() {
    const cls = CONFIG.ActiveEffect.documentClass;
    if (!cls) {
        console.warn("shadowdark-extras | ArmorAEPatch: CONFIG.ActiveEffect.documentClass not found, skipping patch.");
        return;
    }

    const proto = cls.prototype;

    // Capture whatever getter already exists up the chain so we can delegate to it.
    let originalGetter = null;
    let p = Object.getPrototypeOf(proto);
    while (p && p !== Object.prototype) {
        const desc = Object.getOwnPropertyDescriptor(p, "isSuppressed");
        if (desc?.get) { originalGetter = desc.get; break; }
        p = Object.getPrototypeOf(p);
    }

    Object.defineProperty(proto, "isSuppressed", {
        configurable: true,
        enumerable: false,
        get() {
            // Stashed items — effects never apply
            if (this.parent?.system?.stashed) return true;

            // Equippable items that are not currently equipped
            if (
                this.parent?.system?.canBeEquipped &&
                this.parent?.system?.equipped === false
            ) return true;

            // Unidentified items
            if (this.parent?.system?.identification?.identified === false) return true;

            // Fall back to whatever the system (or Foundry core) already provides
            return originalGetter ? originalGetter.call(this) : false;
        }
    });

    console.log("shadowdark-extras | ArmorAEPatch: isSuppressed patched — effects suppressed for stashed/unequipped/unidentified items.");
}
