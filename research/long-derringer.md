# Long Derringer catalog addition

Researched 2026-11-06. This is a targeted catalog update, not a full re-audit of all equipment.

Crytek identifies Long Derringer as a single-shot **tool** firing Long Ammo in the [Blood Testament Chapter 2 notes](https://www.huntshowdown.com/releasenotes/en_US/blood-testament-chapter-2-patch-notes). The [Blood Testament event record](https://huntshowdown.wiki.gg/wiki/Events/Blood_Testament) records Stage V completing on October 27, 2026, unlocking it community-wide. The [current tools list](https://huntshowdown.wiki.gg/wiki/Tools) includes it among pocket pistols.

The [Bayou Index entry](https://bayouindex.com/weapons/long-derringer/) supplies the $100 price, native game artwork, and references Crack Shot and Frontiersman. Its [Frontiersman entry](https://bayouindex.com/traits/frontiersman/) records reserve ammunition changing from 2 to 4 rounds, or 6 with solo Catalyst. The randomizer therefore displays +2 reserve rounds, or +4 with solo Catalyst. No weapon custom-ammo options are added for this tool.

The official page and Bayou Index item page are preserved under `sources/`. Artwork is retained as a 128?128 WebP under `assets/equipment/`, with its source URL and hash in the image manifest. The wiki item page could not be retrieved, so no wiki revision is claimed.

No personal Bloodline unlock rank was established. After the global community unlock, the app assumes availability at all ranks (rank 1 minimum). This is an explicit randomizer availability choice, not a verified personal rank requirement. The tool occupies one equipment position, cannot be duplicated within a hand, and consumes no weapon capacity. Normal budgets and bans apply. It is not treated as a melee tool or a secondary weapon.

The researched record is maintained in `data/equipment-additions.json` and mirrored in the main JSON, CSV and readable catalog. The compilation script merges these additions after its older wiki index import, preserving their reviewed requirements. Crack Shot is documented by the source but is not part of the app's existing selectable trait catalog; unsupported trait IDs are filtered during the build.
