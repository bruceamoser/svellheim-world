# Svellheim: Character Options

> **Private repo** — developer & coding-agent reference for the `svellheim-character-options` Foundry VTT module.

A Foundry VTT module for the [Draw Steel](https://mcdmproductions.com/draw-steel) system providing the Svellheim campaign setting: character options, faith, downtime projects, imbuing projects, monsters, NPCs, items, journals, and encounter frameworks.

- **Module ID:** `svellheim-character-options`
- **Current version:** `0.2.16`
- **System:** Draw Steel (`draw-steel`)
- **Foundry compatibility:** v11+ (verified v13)
- **Release repo:** [bruceamoser/svellheim-character-options](https://github.com/bruceamoser/svellheim-character-options) (release-only, no source)
- **Source lives in:** [bruceamoser/Era-of-Embers](https://github.com/bruceamoser/Era-of-Embers) → `foundry-svellheim-character-options/`

---

## Repository Layout

This module lives inside the `Era-of-Embers` monorepo. The important paths relative to the monorepo root:

```
foundry-svellheim-character-options/
├── module.json                      # Top-level copy (may differ from module/module.json)
├── data/                            # SOURCE DATA — human-authored JSON, one file per entity
│   ├── director-journals/           #   4 GM director journals
│   ├── imbuing-projects/            #   36 imbuing treasures (lowercase dirs, used by build)
│   │   ├── Armor/                   #     1st-Level/ 5th-Level/ 9th-Level/ (4 each)
│   │   ├── Implement/               #     1st-Level/ 5th-Level/ 9th-Level/ (4 each)
│   │   └── Weapon/                  #     1st-Level/ 5th-Level/ 9th-Level/ (4 each)
│   ├── Imbuing Projects/            #   (legacy uppercase copy — kept for compat, same content)
│   ├── items/                       #   10 campaign treasures/rewards
│   ├── monsters/                    #   7 custom monsters
│   ├── montage-tests/               #   7 montage test encounters
│   ├── negotiation-tests/           #   5 negotiation test encounters
│   ├── npcs/                        #   5 campaign NPCs
│   ├── player-journals/             #   11 player handout journals
│   └── projects/                    #   37 downtime projects
│       ├── Crafting/                #     1st-Level(5) 5th-Level(4) 9th-Level(4) = 13
│       ├── Research/                #     1st-Level(4) 5th-Level(4) 9th-Level(4) = 12
│       └── Other/                   #     1st-Level(4) 5th-Level(4) 9th-Level(4) = 12
│
├── module/                          # DISTRIBUTABLE MODULE — shipped in the release zip
│   ├── module.json                  #   Foundry module manifest (canonical version)
│   ├── scripts/                     #   Runtime JS (loaded by Foundry)
│   │   ├── register-languages.js    #     Language injection into CONFIG
│   │   ├── register-faith.js        #     Domain injection into Conduit/Censor
│   │   ├── register-polyglot.js     #     Polyglot language provider
│   │   └── compendium-installer.js  #     GM settings menu for pack import
│   ├── data/                        #   Runtime JSON data
│   │   ├── languages.json           #     17 languages (7 major + 10 regional)
│   │   ├── faith.json               #     Full pantheon (gods + domains)
│   │   └── domain-manifest.json     #     4 custom domains → compendium UUIDs
│   ├── packs/                       #   LevelDB compendium packs (built, not hand-edited)
│   │   ├── svellheim-origins/
│   │   ├── svellheim-faith/
│   │   ├── svellheim-campaign/
│   │   ├── svellheim-handout-journals/
│   │   ├── svellheim-npcs/
│   │   ├── svellheim-monsters/
│   │   ├── svellheim-items/
│   │   ├── svellheim-projects/
│   │   ├── svellheim-montage-tests/
│   │   └── svellheim-negotiation-tests/
│   ├── assets/icons/                #   Custom icons
│   └── templates/                   #   Handlebars templates
│       └── compendium-installer.html
│
├── tools/                           # BUILD SCRIPTS — run from monorepo root
│   └── (see Build Scripts section)
│
└── dist/foundry/                    # BUILD OUTPUT (gitignored)
    ├── module.json                  #   Stamped manifest for release
    └── svellheim-character-options-vX.Y.Z.zip
```

### Key distinction: `data/` vs `module/packs/`

- **`data/`** contains the human-editable source JSON files. Each entity is one `.json` file. These are what you edit.
- **`module/packs/`** contains compiled LevelDB compendium databases. These are **generated** by build scripts and should never be hand-edited. They are committed to git because the release zip is built from `module/`.

---

## Compendium Packs

| Pack | Pack Name | Type | Item `type` | Source Dir | Count |
|------|-----------|------|-------------|------------|-------|
| Svellheim Origins | `svellheim-origins` | Item | ancestry, ancestryTrait, culture, career | *(built from code)* | varies |
| Svellheim Faith | `svellheim-faith` | Item | feature (domains) | *(built from faith.json)* | ~20 |
| Svellheim Campaign | `svellheim-campaign` | JournalEntry | — | *(built from code)* | ~30 |
| Svellheim Handout Journals | `svellheim-handout-journals` | JournalEntry | — | `data/player-journals/` | 11 |
| Svellheim NPCs | `svellheim-npcs` | Actor | npc | `data/npcs/` | 5 |
| Svellheim Monsters | `svellheim-monsters` | Actor | creature | `data/monsters/` | 7 |
| Svellheim Items & Treasures | `svellheim-items` | Item | treasure, feature, title | `data/items/` + inline | **61** |
| Svellheim Projects | `svellheim-projects` | Item | project | `data/projects/` + `data/imbuing-projects/` + inline | **88** |
| Svellheim Montage Tests | `svellheim-montage-tests` | Item | montageTest | `data/montage-tests/` | 7 |
| Svellheim Negotiation Tests | `svellheim-negotiation-tests` | Item | negotiationTest | `data/negotiation-tests/` | 5 |

### Projects vs Imbuing Projects — critical schema difference

| | Projects (`type: "project"`) | Imbuing Projects (`type: "treasure"`) |
|---|---|---|
| **Foundry item type** | `project` | `treasure` |
| **Tracker-compatible** | Yes (native) | Yes (via `createProject()` — see below) |
| **`system.type`** | `crafting` / `research` / `other` | *(absent)* |
| **`system.kind`** | *(absent)* | `weapon` / `armor` / `implement` |
| **`system.echelon`** | *(absent)* | `1` / `2` / `3` |
| **`system.goal`** | top-level | `system.project.goal` |
| **`system.points`** | top-level (tracker) | *(absent — tracked via project item)* |
| **`system.prerequisites`** | top-level string | `system.project.prerequisites` |
| **`system.projectSource`** | top-level string | `system.project.source` |
| **`system.rollCharacteristic`** | top-level array | `system.project.rollCharacteristic` |
| **ID prefix (build)** | `svp-item:` | `svi-item:` |

**How imbuing projects work with the project tracker:** The Draw Steel system's `TreasureModel` has a built-in `createProject(actor)` method. When called, it creates a `type: "project"` item on the actor with all the treasure's project data copied over and `system.yield.item` linked back to the treasure UUID. The [ds-project-tracker](https://github.com/bruceamoser/draw-steel-downtime-project-tracker) module (v0.2.10+) calls this automatically when an imbuing treasure is dropped on a hero card.

---

## Runtime Scripts

### register-languages.js
- **Hooks:** `init` → `setup` → `ready` → `renderApplication`
- **What it does:** Injects 17 Svellheim languages into `CONFIG.DRAW_STEEL.languages`. Supports *Extend* mode (add to Draw Steel base languages) or *Replace* mode (Svellheim only). Re-applies on `ready` as a safety net. Post-processes rendered UI elements to fix raw language ID display.
- **Settings:** `languageMode` (world, visible) — Extend or Replace

### register-faith.js
- **Hooks:** `setup` → `ready` → `preCreateItem`
- **What it does:** Injects 4 custom domains (Frost, Runes, Strength, Vengeance) into Conduit and Censor class items' "Deity and Domains" advancement pool. Patches both compendium (session-only) and world actor items (persistent). `preCreateItem` hook catches class drops onto character sheets.
- **Data:** Reads `data/domain-manifest.json` for UUIDs

### register-polyglot.js
- **Hooks:** `polyglot.init`
- **What it does:** Registers a `SvellheimLanguageProvider` with the Polyglot module. Maps all 17 Svellheim languages to thematic Norse/runic fonts (Floki, Dethek, Ny Stormning, etc.). Sets default language to `svellspraak`.
- **Dependency:** Requires Polyglot module (optional — fails silently if absent)

### compendium-installer.js
- **Hooks:** `init`
- **What it does:** Registers a GM-only settings menu ("Import Compendiums") that lists all 12 compendium packs with checkboxes. On click, imports selected packs via `pack.importAll({ folderName, keepId: true })`. Tracks imported packs in a hidden `importedPacks` world setting.

---

## Build Scripts

All scripts live in `foundry-svellheim-character-options/tools/` and are run from the **monorepo root** (`Era-of-Embers/`):

```bash
# ── Content packs ──
node foundry-svellheim-character-options/tools/build_svellheim_character_options_module.js   # Origins
node foundry-svellheim-character-options/tools/build_svellheim_faith_data.js                 # Faith JSON
node foundry-svellheim-character-options/tools/build_svellheim_faith_items_pack.js           # Faith pack
node foundry-svellheim-character-options/tools/build_svellheim_campaign_journals_pack.js     # Campaign journals
node foundry-svellheim-character-options/tools/build_svellheim_handout_journals_pack.js      # Handout journals
node foundry-svellheim-character-options/tools/build_svellheim_director_journals_pack.js     # Director journals
node foundry-svellheim-character-options/tools/build_svellheim_player_journals_pack.js       # Player journals
node foundry-svellheim-character-options/tools/build_svellheim_rewards_pack.js               # Rewards
node foundry-svellheim-character-options/tools/build_svellheim_projects_pack.js              # Projects (37)
node foundry-svellheim-character-options/tools/build_svellheim_imbuings_pack.js              # Imbuings (36)
node foundry-svellheim-character-options/tools/build_svellheim_npcs_pack.js                  # NPCs
node foundry-svellheim-character-options/tools/build_svellheim_monsters_pack.js              # Monsters
node foundry-svellheim-character-options/tools/build_svellheim_items_pack.js                 # Items
node foundry-svellheim-character-options/tools/build_svellheim_montage_tests_pack.js         # Montage tests
node foundry-svellheim-character-options/tools/build_svellheim_negotiation_tests_pack.js     # Negotiation tests

# ── Release ──
node foundry-svellheim-character-options/tools/build_foundry_release.js --version X.Y.Z
```

### Build script pattern

All pack build scripts follow the same pattern:
1. **Read** JSON source files from `data/<category>/<level>/`
2. **Generate deterministic IDs** via SHA-1 → base62 (`foundryId('prefix:dsid')`)
3. **Assign folder hierarchy** based on directory structure
4. **Write LevelDB** to `module/packs/<pack-name>/` using `classic-level`

The `_id` field in source JSON files is **ignored** — build scripts regenerate IDs from the `system._dsid` field. This means `_dsid` is the true stable identifier.

### Release build

`build_foundry_release.js` reads `module/module.json`, stamps `version`, `manifest`, and `download` URLs, then zips the `module/` directory into `dist/foundry/svellheim-character-options-vX.Y.Z.zip` alongside a stamped `dist/foundry/module.json`. Both files are uploaded as GitHub Release assets.

---

## Dependencies

```bash
npm install   # from monorepo root
```

| Package | Purpose |
|---------|---------|
| `classic-level` | LevelDB read/write for compendium packs |
| `archiver` | Release zip creation |
| `@asciidoctor/core` | AsciiDoc → HTML for journal content |
| `marked` | Markdown → HTML for journal content |

---

## Release Workflow

1. Make changes to source data in `data/` or runtime scripts in `module/scripts/`
2. Run relevant build script(s) to regenerate packs
3. Bump version in `module/module.json` (update both `version` and `download` URL)
4. Run `build_foundry_release.js --version X.Y.Z`
5. Commit & push to `Era-of-Embers` (source repo)
6. Create a GitHub Release on `bruceamoser/svellheim-character-options` with the zip + module.json as assets:
   ```
   gh release create vX.Y.Z \
     --repo bruceamoser/svellheim-character-options \
     --title "vX.Y.Z — Description" \
     --notes "Release notes" \
     dist/foundry/svellheim-character-options-vX.Y.Z.zip \
     dist/foundry/module.json
   ```
7. Foundry users update via the manifest URL automatically

---

## Related Modules

| Module | Repo | Relationship |
|--------|------|--------------|
| **ds-project-tracker** | [draw-steel-downtime-project-tracker](https://github.com/bruceamoser/draw-steel-downtime-project-tracker) | Tracks project progress; supports both `project` and `treasure` (imbuing) items |
| **Draw Steel system** | [mattd/draw-steel](https://github.com/mattd/draw-steel) | Required system; defines `ProjectModel`, `TreasureModel`, etc. |
| **Polyglot** | [League of Foundry Developers](https://github.com/League-of-Foundry-Developers/fvtt-module-polyglot) | Optional; register-polyglot.js provides language fonts |

---

## Agent Notes

Key facts for coding agents working in this repo:

- **Source of truth for entity data:** `data/` directory JSON files. Never edit `module/packs/` directly.
- **ID generation:** `_id` in source JSON is cosmetic. Build scripts use `foundryId('prefix:' + system._dsid)` to generate deterministic 16-char base62 IDs via SHA-1.
- **Two repos, one source:** Source code lives in `Era-of-Embers`. Releases go to `svellheim-character-options` (a separate repo with no source, only release assets).
- **Submodules:** `reference/draw-steel-downtime-project-tracker` is a git submodule in `Era-of-Embers`.
- **Pack rebuild required:** After changing any source JSON in `data/`, you must run the corresponding build script to regenerate the LevelDB pack before the changes appear in Foundry.
- **Project types:** `type: "project"` items are directly trackable. `type: "treasure"` items with `system.project` data are imbuing projects — they use `TreasureModel.createProject(actor)` to create a linked project item when dropped on an actor.
- **Version bumping:** Update `version` AND `download` URL in `module/module.json`. The build script stamps them into the zip.
- **Draw Steel data model reference:** Use the `mcp_draw-steel-fo_read_reference_file` tool with `category: "datamodels"` to inspect system schemas (e.g. `item/project.mjs`, `item/treasure.mjs`).
- **Icons:** Use `mcp_draw-steel-fo_search_icons` to find appropriate Foundry icons by keyword.
- **Rules lookup:** Use `mcp_draw-steel-fo_read_rules_section` and `mcp_draw-steel-fo_search_rules` to check Draw Steel rules.

## License

Content is setting-specific homebrew for Draw Steel by MCDM Productions. Draw Steel is a trademark of MCDM Productions, LLC.
