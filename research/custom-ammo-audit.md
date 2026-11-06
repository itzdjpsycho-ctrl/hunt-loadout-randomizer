# Custom ammunition audit

The optional ammo roller covers 135 weapon variants compiled from the Ammo Types sections of cached variant pages in sources/items/, plus supported dual-wield pairs during the frontend build. Reproduce with scripts/compile-ammo.ps1, then rebuild. Snapshot date remains 24 September 2026; this change does not claim refreshed live prices.

Every weapon with listed purchasable custom ammo has a slot definition. Split reserves are explicitly listed in `data/ammo-slot-layouts.json`; all other weapons default to one pool unless they have separate bullet/shell barrels. Exceptions such as Romero Alamo and Martini-Henry Ironside retain one ammo pool. LeMat, Haymaker and Drilling separate bullet options from shotgun options. Two-slot weapons use the prices already listed for each slot, without halving them again. Dual pairs double each slot?s purchase cost.

Scarce/retired types (Dumdum, Explosive, Spitzer and Frag, plus Dolch FMJ) remain excluded. Weapons without purchasable custom options use their standard ammunition; melee weapons have no ammo to randomize. Players must confirm custom ammo unlocks.

Each eligible ammo slot gives standard ammo and every compatible custom ammo type equal weight: 1 / (number of custom options + 1). Legal combinations are filtered by the complete kit budget and selected by their product weights, without prioritizing either weapon. Tight budgets can therefore increase standard ammo frequency. Free ammo reroll controls are removed; item mulligans can redraw weapon ammunition.

Ammo stays attached to each weapon. Holds preserve all its choices and reserve their total cost. Equipment mulligans preserve both weapons' ammo unless a weapon is lost; weapon mulligans preserve the other weapon's ammo unless it is lost. Loadout mulligans redraw ammunition for unheld weapons and preserve ammunition on surviving held weapons. Validation rejects incompatible slot lengths, wrong-barrel ammo, disabled custom ammo and over-budget kits. Cards, copy/JSON export, favorites, history and shared rooms retain every ammo slot. Existing scalar ammo saves remain supported.

Crytek?s [inventory slot rework](https://www.huntshowdown.com/news/inventory-slot-rework) confirms current scarce ammo categories and mixed Berthier ammo use. Cached per-variant pages provide option prices and compatibility.

Burgess, Burgess Bayonet and Burgess Trauma are included under the app assumption that their event unlocks are available. Their current event-unlock metadata remains unchanged. Each uses one ammo slot with Dragon Breath, Flechette, Penny Shot and Slug from its cached weapon page.

## Ammo-slot correction, 6 November 2026

Audited all 135 base weapon layouts with custom options. Four repeating sniper variants incorrectly had two pools: Centennial Sniper, Infantry 73L Sniper, Krag Sniper, and Mosin-Nagant Sniper. Their cached current Extra Ammo fields contain a single reserve, and their extracted game-data references each specify one slot: [Centennial](https://bayouindex.com/weapons/centennial-sniper/), [Infantry](https://bayouindex.com/weapons/infantry-73l-sniper/), [Krag](https://bayouindex.com/weapons/krag-sniper/), [Mosin](https://bayouindex.com/weapons/mosin-nagant-sniper/).

The previous importer searched entire HTML pages for the substring `per slot`. This matched `Sniper slot size changed` in historical patch notes. The compiler now reads an audited split-reserve list instead of inferring topology from arbitrary prose. Current cached Extra Ammo fields were checked for every listed split weapon, while LeMat, Drilling and Haymaker retain distinct bullet/shell pools. Genuine split-reserve sniper weapons (Sparks and Maynard) remain two-slot weapons; [Crytek's inventory rework](https://www.huntshowdown.com/news/inventory-slot-rework) also explicitly discusses mixed ammo on the Berthier.

Regeneration changes exactly these four slot counts. Compatible ammo options and listed prices are unchanged. The underlying price snapshot remains September 24, 2026; this audit does not claim a new price survey.

Invalid saved ammo is reset to standard at browser reload, history/favorite restore and shared-state entry points. Persisted hosted rooms likewise clear obsolete list lengths when loaded. Weapons, holds, settings and valid split/barrel ammo are preserved. New incompatible ammo submissions remain invalid.
