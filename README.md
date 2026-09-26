# Dead Man's Hand — Hunt Chaos Loadouts

Double-click **[Dead-Mans-Hand.exe](dist/Dead-Mans-Hand.exe)** to launch the Windows desktop app. The executable embeds the complete app and opens its own window. Everything for this project stays inside this folder.

The desktop build targets Windows 10/11 x64 and uses .NET Framework 4.6.2 or later and Microsoft Edge WebView2 Runtime (already installed on this PC). App files and persistent desktop settings are stored in `%LOCALAPPDATA%\DeadMansHand`. Desktop settings are separate from settings in your regular browser. JSON exports use a Windows Save dialog.

You can also open **[Chaos-Loadout.html](Chaos-Loadout.html)** in a modern browser. Both versions work offline without a server or account connection.

## Website hosting (GitHub Pages)

The website and Windows app use the same `app/` sources. Mulligans, squad rolls, saves and exports work in both. Each browser/device stores its own settings and saved loadouts; these do not sync with the desktop app.

1. Push this project to your GitHub repository. Include `app/`, `assets/`, `data/`, `sources/`, `scripts/` and `.github/`; the site build uses the cached equipment research and images. The supplied `.gitignore` excludes local test profiles, backups, SDK downloads and packaged binaries.
2. In the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Open **Actions → Publish website → Run workflow** on the default branch. Future pushes to the default branch publish automatically.
4. The deployment exposes the website URL in the `github-pages` environment and repository Pages settings. A project site normally lives at `https://OWNER.github.io/REPOSITORY/`.

Build the website locally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-site.ps1
```

Publish the generated `site/` directory on any static host. Its `index.html` embeds all scripts, styles, data and equipment images, so it also works under a repository subpath. The Pages workflow publishes only that directory. No backend or API keys are required. Follow [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for hosting configuration.

Continue building the standalone executable with `scripts/build-exe.ps1`. Desktop binaries can be distributed separately, for example as GitHub Release downloads.

## Windows executable

Rebuild the executable from this project folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-exe.ps1
```

The build script rebuilds the HTML app, downloads the pinned official WebView2 SDK if needed, and compiles the desktop host using the Windows .NET Framework compiler. Output and dependency notices are in `dist/`; desktop source and cached SDK files are in `desktop/`.

The roulette build passed **39 engine tests** (including the 500-seed sweep) and **89 desktop/UI checks**. See `artifacts/slot-machine-results.json`. Run its isolated self-test with an absolute report path:

```powershell
.\dist\Dead-Mans-Hand.exe --self-test "$PWD\artifacts\desktop-exe-results.json"
```

The test writes its browser profile beside the report and does not change your normal desktop settings. Export data and button availability are tested; the native Save dialog and clipboard interaction require manual use.

## Use the app

Choose **Solo**, **Duo**, or **Trio**. All selected hunters appear together. Each hunter has their own name, Bloodline rank, traits, role, equipment, ammunition and holds. The top hunter buttons select whose traits appear in the sidebar; **Traits** beneath a hunter's name opens their full trait editor.

- **Deal me in** rolls the squad. **↻ Hunter** rerolls only that hunter, retaining held items. Each card's **↻** rerolls only that slot and preserves all other slots, including empty weapon positions. An impossible replacement leaves the build unchanged and explains why.
- **Playable chaos** includes a medkit and melee option. **Full chaos** removes those preferences. **Go Crazy** favors eccentric equipment. In **Squad options**, choose Mild (keeps essentials), Unhinged, or Cursed (stronger unusual-gear and repeated-consumable weighting).
- **Squad options** also contains challenges: no scopes, a Hunting Bow for every hunter, or a $300 limit per hunter including ammunition. Challenges are enforced across rolls and rerolls. Incompatible held items, roles or bans cause a clear failure rather than silently changing other settings.
- Choose a role beneath each hunter's name, or use **Assign squad roles** for sniper / close range / support. Sniper requires a scoped primary; close range requires a shotgun or melee primary. Support favors healing, resupply and choke equipment. Roles do not override challenges or game limits.
- **Item bans** provides a searchable squad-wide exclusion list. Checked items cannot roll, including held gear. Clear a conflicting hold to proceed.
- **History & favorites** stores the last 30 successful squad builds and up to 50 named favorites locally. Restore recovers the whole squad and its settings; delete removes only the selected saved entry. Resetting the current squad leaves this library intact.
- **Randomize custom ammo** is opt-in: enable only if you have unlocked the supported custom ammo. It uses purchasable, priced options verified for 91 single-pool weapon variants, includes their price in totals/budgets, and preserves ammo with held weapons. Scarce/retired ammo is excluded. Split-reserve and combination-barrel weapons keep standard ammo until their separate accounting is audited. See `data/custom-ammo.json` and `research/custom-ammo-audit.md`.

Rank, traits and role changes invalidate only that hunter. Squad settings invalidate all affected builds until rerolled. Copy and JSON export contain every selected hunter, including ammo, traits and role. Failed team rolls preserve every hand. Full-team seeds reproduce results with the same settings, holds and ammo; individual rerolls additionally use the hunter/slot and roll sequence.

The desktop layout stretches on large screens and shows trio columns together. Laptop (1366 × 768), 1080p, 1440p and 390px mobile layouts are covered by the packaged checks. Long trait notes and error messages can require vertical scrolling.

## Backup before the expansion

`backups/before-squad-expansion-20260924-232052.zip` contains the prior working app, executables, sources, equipment data, images, scripts and tests. Its three desktop source files are at the archive root; restore `Program.cs`, `desktop-smoke.js` and `app.manifest` into `desktop/` before rebuilding. The cached WebView2 SDK is not duplicated; the build script restores it if needed. Browser settings and saved squads are stored separately in the desktop app's local profile.

## Rules and traits

The engine enforces the audited two weapon positions, capacity 5/6, eight shared equipment slots, unique tools, four-per-consumable-category limits, purchase ranks, and full-purchase budget. The app assumes standard weapon unlocks; scarce, event-only, removed and unresolved equipment is excluded. A Size 5 weapon may leave a secondary position empty. All chaos modes obey the same game rules. An additional app preference caps melee tools at two, including throwing knives, axes and spears; melee weapons do not count. Held tools also obey this cap.

There are **23 loadout-related trait switches**. Trait selection represents already-equipped traits, so the app does not charge Upgrade Points or apply purchase rank restrictions to them. The maximum is 15 selected traits. Synergy weighting is a preference, not a guarantee that every trait will be used on every roll. Frontiersman's two-extra-use condition requires **solo + Catalyst**; it never adds equipment slots. Doctor shows the improved medkit healing.

The app generates **single weapons with optional verified custom ammunition**. Dual wield remains excluded; split-reserve and combination-barrel weapons use standard ammunition. Exact per-variant weapon XP thresholds are not inferred: the app assumes all standard weapons are available instead. Catalog `family` labels are used for variety weighting, not unlock eligibility.

Research checked on **23 September 2026**, targeting **Update 2.9**. Recheck the data after game patches and verify availability in-game after Prestige.

## Source and checks

- `app/engine.js`: deterministic selection, challenge/role constraints, bans, rule validation and trait benefits.
- `app/expansion.js`: custom-ammo selection, held-ammo preservation and full kit budget accounting.
- `scripts/compile-ammo.ps1`: reproduces the 91-variant ammo catalog from cached item pages.
- `app/app.js`, `app/styles.css`, `app/index.template.html`: interface and local persistence.
- `app/catalog.js`: generated compact data; `Chaos-Loadout.html` embeds it and all app code/styles.
- `data/traits.json`: trait descriptions; `sources/traits/`: individual reference snapshots.
- `scripts/build-app.ps1`: rebuild the standalone app from the audited catalog and app sources.
- `tests/engine-tests.html`: 39 rule tests, including 500 seeded loadouts, challenges, roles, bans and ammunition accounting.
- `tests/ui-tests.html`: browser interaction checks; append `?mobile` for an actual 390px app viewport.
- `artifacts/`: saved browser reports, screenshots, logs, and isolated test profiles.

Before the purchase-only simplification, Microsoft Edge passed **26 engine tests**, **23 desktop UI checks**, and **24 mobile UI checks**, including an exact-width assertion. The updated executable verification is recorded above. Desktop and mobile screenshots were visually inspected. The test profiles are separate from your browser profile.

Rebuild after changing app code or research data:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-app.ps1
```

Open the test HTML pages in a browser to run engine checks. The UI harness embeds a local file and needs the browser's file-to-file access option for automated testing. The standalone app itself requires no such option.

## Start here

- [Requirements audit](research/requirements-audit.md): recheck of current equip limits, Bloodline unlocks, ownership and unresolved options.
- [Equipment catalog](research/equipment-catalog.md): readable, linked inventory of 150 weapons/variants, 23 tools, and 54 consumables.
- [Loadout rules](research/loadout-rules.md): current capacity rules, patch changes, availability and source caveats.
- [App design](research/randomizer-design.md): proposed modes, themes, controls and selection logic.
- [Equipment JSON](data/equipment.json) and [CSV](data/equipment.csv): structured data for the eventual app.
- [Rules JSON](data/loadout-rules.json): versioned game constraints and proposed app defaults.
- `sources/`: downloaded reference pages, including an individual snapshot for every catalog entry.
- [Compilation script](scripts/compile-research.ps1): reproduces the catalog from saved indexes and cached item pages.

The 227 entries include restricted and historical equipment: 21 current tools plus two removed tools; 30 ordinary consumables, 14 scarce Tarot cards, and 10 event-specific consumables. Weapon variants are separate entries; cosmetic skins and dual-pistol configurations are not counted as new weapons. Four scarce weapons and three Burgess event unlocks are included and flagged.

## How to interpret the data

`standard-candidate` means listed as ordinary equipment by the reference pages, not proof that the player has unlocked it. `scarce-owned-only` requires ownership; `event-unlock-required` needs the current event unlock. `event-review-required` keeps event-specific/historical entries out of normal rolls until checked. `removed` is reference-only. Any other review flag must be resolved before enabling the item.

Each item has a source URL, saved snapshot and wiki revision. Schema version 2 adds a `requirements` object and readable `unlockSummary`: all 51 ordinary tools/consumables have Bloodline purchase ranks; weapons require exact arsenal unlock confirmation; scarce items require an owned equippable copy. Tool copies are limited to one per type. Purchase requirements are distinct from using already-owned gear. Prices explicitly changed in Update 2.9 use the official patch value and record that override. Unknown prices remain null. Base ammo labels are source labels and should not be used as a complete ammo-sharing model.

`group` is the wiki's browsing grouping, not a legality category. `consumableLimitCategory` maps current consumables to the new four-category inventory limits using page categories, shot names, and the Tarot overview. Six historical event consumables remain unclassified and excluded. These mappings should be checked in the game before release.

Coverage is broad but is not a claim of a fully audited live game database. Custom ammo matrices and dual-wield details remain prerequisites for enabling those optional generation modes. The app assumes all standard weapon unlocks and always buys gear; rank requirements still apply to tools and consumables.

## Rebuild

From this project folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/compile-research.ps1
```

This uses cached pages when present and fetches missing item pages. It **does not refresh** existing snapshots or advance the research date automatically. For a future patch, refresh the indexes and relevant item snapshots deliberately, reconcile official patch notes, and update the date/rules before publishing new data.

## Attribution

Game rules and patch changes: [Crytek player guide](https://www.huntshowdown.com/player-guide) and [release notes](https://www.huntshowdown.com/releasenotes).

Equipment reference: [Hunt: Showdown 1896 Wiki](https://huntshowdown.wiki.gg/), including [Weapons](https://huntshowdown.wiki.gg/wiki/Weapons), [Tools](https://huntshowdown.wiki.gg/wiki/Tools), and [Consumables](https://huntshowdown.wiki.gg/wiki/Consumables). Wiki text is offered under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) unless otherwise noted. Page snapshots retain source attribution; generated records link back to their individual sources. Equipment icons are sourced from the matching wiki item pages and embedded for offline use. Game artwork belongs to Crytek; the wiki text license does not imply ownership of that artwork. See `assets/equipment-manifest.json` for every source URL, original filename, dimensions and SHA-256 hash.


## Equipment images and backup

The pre-image app, executable, source, data and tests are saved in `backups/before-equipment-images-20260923-115859.zip`. Existing research snapshots and SDK downloads remain in the project folder.

All 227 catalog entries have matching local equipment icons in `assets/equipment/`. Run `scripts/fetch-equipment-images.ps1` to restore missing downloads, then rebuild the EXE. The build embeds the icons in both the standalone HTML and EXE; no image requests are made while using the app. Empty slots retain neutral placeholders.



Challenge roulette & roll (in Squad options) tries the three challenges in seeded random order and deals the first feasible squad. Unique weapons prevents identical weapon variants across teammates, including hunter and slot rerolls. Conflicting held weapons require releasing a hold. Ammo buttons reroll only ammunition within budget when custom ammo is enabled; held weapons retain their ammo. Card reveals can be skipped with the button or Escape, disabled in Squad options, and respect reduced-motion preferences.

Slot-machine reveals cycle item images and names, decelerate and settle in sequence. Held cards stay still; individual slot rerolls animate only that card. Cosmetic reels do not change generated results. Validated with 39 engine tests and 89 desktop checks.

## Mulligans

Each occupied card has an **M** button, separate from the normal reroll. It rerolls that item and removes one random item from the same hunter. Each tool or consumable has 10 times a weapon's removal weight. Held items and the replacement itself can be lost. There is no usage cap while items remain. Lost slots stay empty through individual rerolls and saved builds; a fresh hunter or squad roll restores a full hand. Failed replacements cost nothing.
