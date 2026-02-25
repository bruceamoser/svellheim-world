# Svellheim: Character Options

A **Foundry VTT** module for the [Draw Steel](https://mcdmproductions.com/draw-steel) system, providing the complete Svellheim campaign setting â€” character options, campaign journals, monsters, NPCs, items, and encounter frameworks.

## Requirements

- **Foundry VTT** v11+ (verified on v13)
- **Draw Steel** system

## Installation

### Automatic (Recommended)

1. In Foundry VTT, go to **Settings â†’ Manage Modules â†’ Install Module**
2. Paste the manifest URL:
   ```
   https://github.com/bruceamoser/svellheim-character-options/releases/latest/download/module.json
   ```
3. Click **Install**

### Manual

1. Download the latest release zip from [Releases](https://github.com/bruceamoser/svellheim-character-options/releases)
2. Extract it into your Foundry `Data/modules/` directory
3. The folder should be named `svellheim-character-options`

## Compendium Packs

| Pack | Type | Contents |
|------|------|----------|
| **Svellheim Origins** | Items | Ancestries, ancestry traits, cultures, careers |
| **Svellheim Faith** | Items | 16 gods, 16 domains (Aesir, Vanir, JÃ¶tnar, Spirits) |
| **Svellheim Campaign** | Journals | World atlas, character options reference (30 journals) |
| **Svellheim Handout Journals** | Journals | Player handouts, gazetteers, GM director cheatsheets (15 journals) |
| **Svellheim Rewards** | Items | Projects, treasures, titles, features |
| **Svellheim Projects** | Items | 36 downtime projects (crafting, research, other) |
| **Svellheim Imbuing Projects** | Items | 36 imbuing enhancements across 3 echelons |
| **Svellheim NPCs** | Actors | 4 campaign NPCs with portraits |
| **Svellheim Monsters** | Actors | 7 custom monsters with portraits |
| **Svellheim Items** | Items | 10 campaign treasures and rewards |
| **Svellheim Montage Tests** | Items | 7 montage test encounters |
| **Svellheim Negotiation Tests** | Items | 5 negotiation test encounters |

## Features

- **Runtime language registration** â€” Svellheim's 13 languages are injected into the Draw Steel language list and are available in character sheets and the Polyglot module.
- **Runtime faith registration** â€” Svellheim gods and custom domains (Frost, Runes, Strength, Vengeance) are registered into the Draw Steel faith system for Conduit and Censor subclasses.
- **Active Effects** â€” Ancestry traits with numeric modifiers (damage immunities, speed, etc.) generate proper Active Effects.

## For Developers

### Building from Source

All build scripts are in the `tools/` directory at the repository root. Run from the repository root:

```bash
# Build all packs
node tools/build_svellheim_character_options_module.js   # Origins
node tools/build_svellheim_faith_data.js                 # Faith data
node tools/build_svellheim_faith_items_pack.js           # Faith items pack
node tools/build_svellheim_campaign_journals_pack.js     # Campaign journals
node tools/build_svellheim_handout_journals_pack.js      # Handout journals
node tools/build_svellheim_rewards_pack.js               # Rewards
node tools/build_svellheim_projects_pack.js              # Projects
node tools/build_svellheim_imbuings_pack.js              # Imbuings
node tools/build_svellheim_npcs_pack.js                  # NPCs
node tools/build_svellheim_monsters_pack.js              # Monsters
node tools/build_svellheim_items_pack.js                 # Items
node tools/build_svellheim_montage_tests_pack.js         # Montage tests
node tools/build_svellheim_negotiation_tests_pack.js     # Negotiation tests

# Build release zip
node tools/build_foundry_release.js --version X.Y.Z
```

### Dependencies

```bash
npm install
```

Requires `classic-level`, `archiver`, `@asciidoctor/core`, and `marked`.

## License

Content is setting-specific homebrew for Draw Steel by MCDM Productions. Draw Steel is a trademark of MCDM Productions, LLC.
