# Changelog

All notable changes to this fork of `shadowdark-extras` are documented here.

Format based loosely on [Keep a Changelog](https://keepachangelog.com/).

## [6.9.2] — 2026-05-15 — v14 polish & follow-up fixes

Follow-up release that cleans up issues surfaced after 6.9.1.

### Fixed — Runtime correctness

- **Audit cleanup**: removed three dead-code prototype patches targeting
  ActorSD methods that no longer exist in SD 4.x (`buildWeaponDisplay`
  ×2, `getExtraDamageDiceForWeapon`). They were silently no-op'ing
  behind guards; deleted ~190 lines of unreachable code.
- **`applyDamage` socket call fixed**: an old call site invoked
  `executeAsGM("applyDamage", tokenId, damage, actorName)` against a
  handler name that was never registered. Routed through the existing
  `applyTokenDamage` handler with the proper `{ tokenId, damage,
  actorName }` shape so player damage-application actually reaches
  the GM in multiplayer.
- **Freya's Omen reroll button migrated** to v14's
  `renderChatMessageHTML` hook. The previous chat-hook migration
  pass missed this one; vanilla DOM rewrite of the jQuery-based
  handler.
- **jQuery method calls on HTMLElement** fixed in three more chat
  hook handlers that the v14 hook-name migration left half-finished:
  - `shadowdark-extras.mjs` weapon-macro chat trigger — vanilla DOM
    rewrite of `html.find('.chat-card').data()`.
  - `CombatSettingsSD.mjs` `injectDamageCard` — re-wrap with `$()` at
    function entry so the existing 30+ jQuery calls inside keep
    working (pragmatic minimal-change fix vs rewriting them all).
  - `FocusSpellTrackerSD.mjs` `handleWandUsesTracking` — vanilla DOM
    rewrite of chat-card lookup.

### Fixed — Console noise

- **Restored GSAP + PixiPlugin** (`greensock/dist/gsap.min.js` and
  `PixiPlugin.min.js`, version 3.12.5). An earlier "GSAP cleanup"
  commit removed the bundled library but left five `gsap.*` call
  sites in `JournalPinsSD.mjs` (ripple, scale, brightness tweens) —
  every journal pin click threw `ReferenceError: gsap is not
  defined`.
- **Migrated 12 v13-deprecated global namespaces** that fire
  per-boot deprecation warnings and will hard-break in Foundry v15:
  - `Actors` / `Items` (sheet registrations) →
    `foundry.documents.collections.Actors` / `.Items`
  - `WallsLayer` / `Wall` (libWrapper paths in WallContextMenuSD) →
    `foundry.canvas.layers.WallsLayer` / `foundry.canvas.placeables.Wall`
  - `FilePicker` (HexPainter custom tile loading) →
    `foundry.applications.apps.FilePicker.implementation`
- **Three SDX-emitted info-level warnings downgraded** to
  `console.log`: TomSocketHandler init message and HexPainter's
  graceful-fallback messages when FilePicker permission isn't
  available during early boot.
- **HexPainter custom tile loaders now early-return for non-GMs**.
  FilePicker.browse requires GM permission; non-GMs were previously
  hitting a try/catch fallback that produced two warnings each load.

### Cleanup

- Removed stale `// TODO: Update this if ItemSD.prototype.rollItem
  signature changed in 4.x` comment after verifying the signature
  matches SD 4.x's `async rollItem(parts, data, options={})`.

### Known remaining

Boot console will still show ~10 warnings, all third-party:
- PixiJS DisplacementFilter deprecation (library internal)
- Shadowdark system's own V1 Application warnings (LightSourceTrackerSD,
  EffectPanelSD) and ActiveEffect mode-vs-type deprecations
- TokenMagic 0.8.1's `autoTemplateSettings` regression
- obs-utils manifest `manifestPlusVersion` key warning

Zero SDX-attributed warnings on a fresh world load.

---

## [6.9.1] — 2026-05-15 — Foundry v14 / Shadowdark 4.0.x compatibility

This series of changes brings the module forward from its last upstream release
(6.90, verified Foundry 13 / Shadowdark 3.x) to run on Foundry 14.361 and
Shadowdark 4.0.4. Upstream `gmdima/shadowdark-extras` appears unmaintained, so
this fork carries the migration.

### Fixed — Boot & init blockers

- **`canUseMagicItems` patch** — retargeted from removed `ActorSD.prototype`
  method to the `PlayerSD` data-model getter. Replaced libWrapper (which lacks
  clean cross-version getter support) with a direct property-descriptor
  override.
- **`buildNpcAttackDisplays` / `buildNpcSpecialDisplays`** — retargeted from
  `ActorSD.prototype` to the `NpcSD` data model. Inside the wrapped method
  `this` is now the data model; the actor is reached via `this.parent`.
- **`setupWandUsesBlocker`** — retargeted the `castSpell` wrap to both
  `PlayerSD` and `NpcSD` data models; handles UUID-or-id first arg.
- **`buildWeaponDisplay`** — removed in Shadowdark 4.x; the patch now skips
  cleanly behind a presence guard.
- **`TraySD.getPartyTokens` item-piles guard** — Foundry v14 now throws when
  `getFlag` is called against an inactive module's scope. Added an
  `item-piles` module-active check before reading the flag.
- **`CONFIG.SHADOWDARK.EFFECT_ASK_INPUT` guard** — removed in SD 4.x; SDX's
  spell-disadvantage wiring previously crashed init with `Cannot read
  properties of undefined (reading 'includes')`. Guarded with
  `Array.isArray()`.
- **Three silent ESM syntax errors** in a checkpoint commit broke init for
  the whole module without producing any console error (Foundry's ESM loader
  swallows parse failures). Fixed:
  - Duplicate inline import of `getPromptableHitBonuses` / `getPromptableDamageBonuses`.
  - Orphan `});` from a deleted `Hooks.once("ready", () => {` wrapper.
  - `await` inside a non-async arrow function in the itemacro migration hook.
- **`setupRollConfigPatches` timing fix** — `Hooks.once("ready", …)` was
  registered from inside an outer `ready` callback that had already fired, so
  the inner wrap never ran. Switched to direct iteration since the registration
  point is already past `ready`.
- **`generateDungeon` missing `gridSize` local** — function referenced bare
  `gridSize` in 20+ places (configureScene, fitToContent, scene padding,
  renderFloor/Walls/Doors helper calls, stairs, clutter) but never declared
  it. Added `const gridSize = GRID_SIZE;` at function entry plus the missing
  `const GRID_SIZE = 100;` module-level declaration.

### Fixed — Runtime correctness

- **Chat card `_renderChatMessage` monkeypatch** — removed. SD 4.x renamed
  `type` → `style` on chat data; SDX's patch was overriding the new renderer
  with broken legacy code that omitted the field entirely.
- **`ArmorAEPatchSD` simplification** — SD 4.x natively suppresses Active
  Effects for stashed and unequipped items. SDX's patch is no longer needed
  for those cases; trimmed to keep only the unidentified-item suppression
  (still SDX-specific) and delegates the rest to SD's native getter.
- **Rolling logic migration** — `rollAttack`, `rollAbility`, advantage /
  disadvantage prototype patches were dead code in SD 4.x (methods removed or
  relocated). Migrated to wrap each actor's `actor.system.rollConfigGenerators`
  on instance creation (with backfill on `ready` for existing actors), and
  inject promptable bonuses via a `renderRollDialogSD` hook compatible with
  ApplicationV2.
- **Roll-config wrap targets the instance, not the prototype** — `rollConfigGenerators`
  is declared as a class instance field in SD 4.x, so prototype-targeted patches
  early-returned silently. Wrap each actor's generators per-instance.
- **Weapon animation button now injects** — SD 4.x ships a native `tab-bonuses`
  on weapon sheets, which made SDX's `injectWeaponBonusTab` short-circuit
  before reaching `injectWeaponAnimationButton`. When a native bonuses tab is
  detected, still inject the animation button, then bail out of the SDX
  bonus-content injection.
- **Dungeon tile rendering offset** — Foundry v14 changed the default tile
  texture anchor to `(0.5, 0.5)` = center. Tiles created without an explicit
  anchor rendered half a cell up-left of their document position; the wall
  builder placed walls correctly, producing the visible "tiles shifted
  up-left" symptom on every painted/generated dungeon. Painter and generator
  now set `texture.anchorX: 0, texture.anchorY: 0` on every tile (floors,
  stairs, clutter, probes).
- **Tray toggle button chevron** — direction now updates with collapsed /
  expanded state. The panel was sliding off-screen correctly; only the
  visual cue was stuck, which read as "tray won't close."

### Changed — Dependencies

- **`itemacro` decoupled from runtime path.** The module previously hard-
  required `itemacro` for every spell / scroll / wand / potion / class-ability
  trigger macro: gated each execution on `game.modules.get("itemacro")?.active`
  and called `item.executeMacro()` (an itemacro prototype injection). With
  itemacro uninstalled (its v14 status is uncertain), every trigger macro
  silently no-op'd. Native executor `executeItemMacro(item, scope)` now
  handles execution; reads `flags.shadowdark-extras.macroCommand` first with
  a fallback read of legacy `flags.itemacro.macro.command` for unmigrated
  worlds. One-time data migration runs on first `ready` after upgrade.
  `itemacro` removed from `module.json` `requires`.
- **`autoanimations` added to `recommends`** in `module.json`. SDX's
  `AutoAnimationsSD` only filters AA's animations (suppresses on failed
  rolls); it doesn't generate them. Without AA installed, attack/spell
  animations don't fire — and the previous manifest never declared the
  relationship.
- **`module.json` compatibility** — `verified: "14"`, system
  `verified: "4.0.4"`.

### Known remaining work

- The wider feature surface inside `executeSpellItemMacro`-style call sites
  still exposes the rich legacy scope (`target`, `targets`, `isSuccess`,
  etc.) to macro authors. Preserved for back-compat with existing user
  macros. Future macros can use the simpler `(actor, token, item, scope)`
  shape the native executor exposes.
- `WeaponBonusConfig.mjs` still references `game.modules.get("itemacro")?.active`
  for the weapon-macro UI hint. Cosmetic only — runtime works without
  itemacro.
- Pre-existing socket handler `executeSpellItemMacroAsGM` is called but
  never registered (line 18807). Run-as-GM for spell macros has never worked
  on this module; only matters in multiplayer.
