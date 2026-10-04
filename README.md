# Dead Man's Hand — Hunt Chaos Loadouts

Double-click **[Dead-Mans-Hand.exe](dist/Dead-Mans-Hand.exe)** to launch the Windows desktop app. The executable embeds the complete app and opens its own window. Everything for this project stays inside this folder.

The desktop build targets Windows 10/11 x64 and uses .NET Framework 4.6.2 or later and Microsoft Edge WebView2 Runtime (already installed on this PC). App files and persistent desktop settings are stored in `%LOCALAPPDATA%\DeadMansHand`. Desktop settings are separate from settings in your regular browser. JSON exports use a Windows Save dialog.

You can also open **[Chaos-Loadout.html](Chaos-Loadout.html)** in a modern browser. Both versions work offline without a server or account connection.

## Node.js frontend + Uvicorn web server

The frontend is built with **Node.js 24+** using `npm run build`. **FastAPI + Uvicorn** serves the built webpage and its JavaScript/CSS assets. Node runs at build time; Uvicorn is the production server. The randomizer, mulligans and local saves still run in the browser, using the same app sources as the standalone Windows version.

Requirements: Node.js 24+ and Python 3.13+. From the project root:

```sh
npm ci
npm run build
python -m venv .venv
```

Install Python packages and start on Windows:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

On macOS/Linux:

```sh
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000**. `/api/health` returns `{"status":"ok"}`. Re-run `npm run build` after frontend changes; add `--reload` to the Uvicorn command when developing Python code. The server fails with a clear build instruction if the frontend is missing, and serves only `site/` assets rather than repository files.

For production, `python -m server` runs Uvicorn on `0.0.0.0`, using the host-provided `PORT` (default 8000). `HOST` can override the bind address. Host the app behind HTTPS for browser clipboard support. Settings and saved squads remain local to each browser/device; they do not sync to the Windows app.

### Shared multiplayer sessions

On the Uvicorn website, enter your name in **Hunt together**, choose Duo or Trio, and select **Create room**. Send **Copy invite link** (or the eight-character room code) to your friends. They enter their own names and join; each gets a hunter seat.

- By default each player edits their own hunter, including traits, holds, item mulligans and loadout mulligans. The host can edit the whole squad and change squad settings. **Everyone edits squad** is also available when creating a room.
- Loadouts, settings, ammo and mulligan losses synchronize about once a second. Changes carry a revision number: simultaneous conflicting writes are rejected and the latest room state is restored, with a message to retry.
- Reloading the same tab reconnects to your seat. Network loss pauses editing until the latest state is fetched. Room credentials stay in that tab's session storage, never in invite links.
- The host can remove a player to free a seat. If the host leaves, the next player becomes host. Leaving restores the personal squad you had before joining. The last player leaving deletes the room; rooms also expire after 24 hours without activity.
- Room size stays fixed until a new room is created. Browser favorites/history remain personal. Rooms are cooperative state sharing, not a server-enforced competitive rules or anti-cheat system.

Room state and membership are stored in SQLite at `runtime/sessions.sqlite3`. Set `SESSION_DB` to change its location. Use persistent storage for this file to retain rooms across deployments; a normal server restart preserves them. Run one service instance (multiple Uvicorn workers on that same machine can share the file). Separate host replicas need a shared database implementation before scaling across machines.

Shared rooms require the Uvicorn backend. The static GitHub Pages mirror cannot provide rooms, and the offline HTML/Windows version keeps its personal loadout workflow.

Run the real multi-browser checks after building and installing the development requirements:

```sh
python -m playwright install chromium
python tests/browser_sessions.py
```

### Docker hosting

The multi-stage Dockerfile builds with Node and runs with Python/Uvicorn:

```sh
docker build -t hunt-loadout-randomizer .
docker run --rm -p 8000:8000 -v hunt-sessions:/app/runtime hunt-loadout-randomizer
```

A Docker-capable host can deploy directly from this repository using `Dockerfile`, port 8000 (or its supplied `PORT`), and health-check path `/api/health`. Mount a writable persistent volume at `/app/runtime` for shared sessions. The runtime container does not need Node, build tools, or the research snapshots.

### Render deployment

The repository includes `render.yaml` for one **Free** Docker web service in Singapore, with temporary SQLite storage and no paid disk or database. Node builds the frontend; Uvicorn serves both the webpage and room API at the same HTTPS address. Updates deploy after GitHub checks pass.

[Deploy to Render](https://dashboard.render.com/select-repo?type=blueprint&repo=https%3A%2F%2Fgithub.com%2Fitzdjpsycho-ctrl%2Fhunt-loadout-randomizer)

Sign in to Render and deploy the Blueprint using the Free instance. To avoid usage charges, use a free workspace without a payment method: exceeding the included bandwidth suspends the service and exceeding build minutes pauses builds instead of billing overages. See [Render's free hosting limits](https://render.com/docs/free).

After deployment, use the service's assigned `onrender.com` URL for multiplayer. Verify `/api/health` and `/api/capabilities`, create a room, and join from another browser. Free services sleep after 15 minutes without inbound traffic and take about a minute to wake. **Rooms are lost whenever the server sleeps, restarts, or redeploys**; create a new room afterward. Active players can share loadouts and mulligans while the service is running. Browser saves and the standalone app are unaffected. The workspace includes 750 free instance hours per month, shared by its free web services.

### GitHub Pages compatibility

The existing [GitHub Pages website](https://itzdjpsycho-ctrl.github.io/hunt-loadout-randomizer/) remains a static frontend mirror. Its workflow now builds with Node and runs the engine and Python server tests before publishing. **GitHub Pages cannot run Python/Uvicorn**; deploying the full server requires a Python or Docker-capable host. The website/server build is prepared in the repository, but a Uvicorn hosting service must be configured separately.

`npm run build` also generates `Chaos-Loadout.html` for offline use and the Windows host. `scripts/build-site.ps1` and `scripts/build-app.ps1` are Windows wrappers around that same Node build, so the two versions stay aligned.

### Checks

```sh
npm ci
npm run build
npm test
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -p "test_*.py"
```

Pull requests run these checks and build the Docker image. Default-branch pushes run the checks before updating the static mirror.

## Windows executable

Rebuild the executable from this project folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-exe.ps1
```

With Node.js 24+ installed, the build script rebuilds the HTML app, downloads the pinned official WebView2 SDK if needed, and compiles the desktop host using the Windows .NET Framework compiler. Output and dependency notices are in `dist/`; desktop source and cached SDK files are in `desktop/`.

The roulette build passed **39 engine tests** (including the 500-seed sweep) and **89 desktop/UI checks**. See `artifacts/slot-machine-results.json`. Run its isolated self-test with an absolute report path:

```powershell
.\dist\Dead-Mans-Hand.exe --self-test "$PWD\artifacts\desktop-exe-results.json"
```

The test writes its browser profile beside the report and does not change your normal desktop settings. Export data and button availability are tested; the native Save dialog and clipboard interaction require manual use.

## Use the app

Choose **Solo**, **Duo**, or **Trio**. All selected hunters appear together. Each hunter has their own name, Bloodline rank, traits, role, equipment, ammunition and holds. The top hunter buttons select whose traits appear in the sidebar; **Traits** beneath a hunter's name opens their full trait editor.

- **Deal me in** deals a fresh squad and resets penalties. Each card's **M** replaces that item and loses one random item. Each hunter's **Loadout Mulligan** redraws their occupied positions and loses 1 item on the first use, 2 on the second, 3 on the third, and so on. Previous empty slots stay empty, holds cannot prevent losses, and the button disables when there are too few items to pay the next loss. Counters are separate per hunter and survive reloads, favorites and shared-room synchronization. Free item, ammunition and hunter reroll controls have been removed.
- **Playable chaos** includes a medkit and melee option. **Full chaos** removes those preferences. **Go Crazy** favors eccentric equipment. In **Squad options**, choose Mild (keeps essentials), Unhinged, or Cursed (stronger unusual-gear and repeated-consumable weighting).
- **Squad options** also contains challenges: no scopes, a Hunting Bow for every hunter, or a $300 limit per hunter including ammunition. Challenges are enforced across deals and mulligans. Incompatible held items, roles or bans cause a clear failure rather than silently changing other settings.
- Choose a role beneath each hunter's name, or use **Assign squad roles** for sniper / close range / support. Sniper requires a scoped primary; close range requires a shotgun or melee primary. Support favors healing, resupply and choke equipment. Roles do not override challenges or game limits.
- **Item bans** provides a searchable squad-wide exclusion list. Checked items cannot roll, including held gear. Clear a conflicting hold to proceed.
- **History & favorites** stores the last 30 successful squad builds and up to 50 named favorites locally. Restore recovers the whole squad and its settings; delete removes only the selected saved entry. Resetting the current squad leaves this library intact.
- **Randomize custom ammo** is opt-in: enable only if you have unlocked the supported custom ammo. It uses purchasable, priced options from cached pages for 132 weapon variants and supported dual pairs. Every split-reserve and combination-barrel ammo slot rolls separately, with an 85% custom / 15% standard chance before budget filtering. Custom choices share that 85% equally. All slot prices count toward the budget, and holds preserve every ammo slot. Scarce/retired ammo is excluded. See `data/custom-ammo.json` and `research/custom-ammo-audit.md`.

Rank, traits and role changes invalidate only that hunter. Squad settings invalidate all affected builds until dealt again. Copy and JSON export contain every selected hunter, including ammo, traits and role. Failed team rolls preserve every hand. Full-team seeds reproduce results with the same settings, holds and ammo; individual mulligans additionally use the hunter/slot and roll sequence.

The desktop layout stretches on large screens and shows trio columns together. Laptop (1366 × 768), 1080p, 1440p and 390px mobile layouts are covered by the packaged checks. Long trait notes and error messages can require vertical scrolling.

## Backup before the expansion

`backups/before-squad-expansion-20260924-232052.zip` contains the prior working app, executables, sources, equipment data, images, scripts and tests. Its three desktop source files are at the archive root; restore `Program.cs`, `desktop-smoke.js` and `app.manifest` into `desktop/` before rebuilding. The cached WebView2 SDK is not duplicated; the build script restores it if needed. Browser settings and saved squads are stored separately in the desktop app's local profile.

## Rules and traits

The engine enforces the audited two weapon positions, capacity 5/6, eight shared equipment slots, unique tools, four-per-consumable-category limits, purchase ranks, and full-purchase budget. The app assumes standard weapon unlocks; scarce, event-only, removed and unresolved equipment is excluded. A Size 5 weapon may leave a secondary position empty. All chaos modes obey the same game rules. An additional app preference caps melee tools at two, including throwing knives, axes and spears; melee weapons do not count. Held tools also obey this cap.

There are **23 loadout-related trait switches**. Trait selection represents already-equipped traits, so the app does not charge Upgrade Points or apply purchase rank restrictions to them. The maximum is 15 selected traits. Synergy weighting is a preference, not a guarantee that every trait will be used on every roll. Frontiersman's two-extra-use condition requires **solo + Catalyst**; it never adds equipment slots. Doctor shows the improved medkit healing.

The app generates **single weapons and supported dual-wield pairs with optional custom ammunition**. Split-reserve and combination-barrel weapons randomize every ammo slot. Exact per-variant weapon XP thresholds are not inferred: the app assumes all standard weapons are available instead. Catalog `family` labels are used for variety weighting, not unlock eligibility.

Research checked on **23 September 2026**, targeting **Update 2.9**. Recheck the data after game patches and verify availability in-game after Prestige.

## Source and checks

- `app/engine.js`: deterministic selection, challenge/role constraints, bans, rule validation and trait benefits.
- `app/expansion.js`: custom-ammo selection, held-ammo preservation and full kit budget accounting.
- `scripts/compile-ammo.ps1`: reproduces the 132-variant ammo catalog and ammo-slot compatibility from cached item pages.
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

Coverage is broad but is not a claim of a fully audited live game database. Custom ammo and supported dual-wield pairs use the cached catalog; availability should be checked after patches. The app assumes all standard weapon unlocks and always buys gear; rank requirements still apply to tools and consumables.

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



Challenge roulette & roll (in Squad options) tries the three challenges in seeded random order and deals the first feasible squad. Unique weapons prevents identical weapon variants across teammates, including item and loadout mulligans. Conflicting held weapons require releasing a hold. Ammo is randomized with weapon deals and mulligans; held weapons retain every ammo choice unless lost. Card reveals can be skipped with the button or Escape, disabled in Squad options, and respect reduced-motion preferences.

Slot-machine reveals cycle item images and names, decelerate and settle in sequence. Held cards stay still; individual item mulligans update that card and reveal the loss. Cosmetic reels do not change generated results. Validated with 48 engine tests, 102 packaged desktop checks, 11 server tests, desktop/mobile UI tests and shared-session browser checks.

## Mulligans

Each occupied card has an **M** button. It replaces that item and removes one random item from the same hunter. Each tool or consumable has 10 times a weapon's removal weight. Held items and the replacement itself can be lost. There is no usage cap while items remain. Each hunter also has a **Loadout Mulligan (Lose N)** button that redraws only occupied positions while retaining held gear, then removes N random items without replacement. N starts at 1 and increases after every successful loadout mulligan for that hunter. Previous losses stay empty, and insufficient remaining items disable the button. Item mulligans do not reset this counter. Holds cannot protect against either penalty. Failed mulligans leave all items and counters unchanged. A fresh squad deal restores a full hand and resets all counters. Saved squads, reloads and shared sessions preserve the counters.

## Dual-wield pistol rolls

Rolls can select 24 matched pistol pairs, displayed as Dual followed by the pistol name. A pair occupies one weapon position, uses the single pistol's capacity plus one, and costs two copies including supported custom ammunition. Stocked and scoped pistols and the Haymaker cannot roll as pairs. Holds, mulligans, exports and shared-room activity use the pair as one card; a mulligan losing that card removes the pair. Banning a pistol excludes its pair, and squad weapon uniqueness treats single and dual versions as the same weapon.

