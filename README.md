# Svellheim World

A **Foundry VTT** module (`svellheim`) for the [Draw Steel](https://mcdmproductions.com/draw-steel) system, providing the Svellheim campaign setting — character options, campaign journals, and world reference material.

This is the **world module** in a multi-module ecosystem:

| Module | ID | Contents |
|--------|----|----------|
| **Svellheim World** (this repo) | `svellheim` | Character options, faith, campaign journals, handouts |
| **Svellheim Entities** | `svellheim-entities` | NPCs, monsters, items, projects, imbuings |
| **Svellheim Act 1** | `svellheim-act1` | Act 1 montage & negotiation encounters |
| **Svellheim Act 2** | `svellheim-act2` | Act 2 montage & negotiation encounters |
| **Svellheim Act 3** | `svellheim-act3` | Act 3 montage & negotiation encounters |

**Dependency chain:** `svellheim` → `svellheim-act1/act2/act3` → `svellheim-entities`

## Requirements

- **Foundry VTT** v11+ (verified on v13)
- **Draw Steel** system

## Installation

### Automatic (Recommended)

1. In Foundry VTT, go to **Settings → Manage Modules → Install Module**
2. Paste the manifest URL:
   ```
   https://github.com/bruceamoser/svellheim-world/releases/latest/download/module.json
   ```
3. Click **Install**

### Manual

1. Download the latest release zip from [Releases](https://github.com/bruceamoser/svellheim-world/releases)
2. Extract it into your Foundry `Data/modules/` directory
3. The folder should be named `svellheim`

## Compendium Packs

| Pack | Type | Contents |
|------|------|----------|
| **Svellheim Origins** | Items | Ancestries, ancestry traits, cultures, careers |
| **Svellheim Faith** | Items | 16 gods, 16 domains (Aesir, Vanir, Jötnar, Spirits) |
| **Svellheim Campaign** | Journals | World atlas, character options reference |
| **Svellheim Handout Journals** | Journals | Player handouts, gazetteers, GM director cheatsheets |
| **Svellheim Rewards** | Items | Projects, treasures, titles, features |

## Features

- **Runtime language registration** — Svellheim's 13 languages are injected into the Draw Steel language list and are available in character sheets and the Polyglot module.
- **Runtime faith registration** — Svellheim gods and custom domains (Frost, Runes, Strength, Vengeance) are registered into the Draw Steel faith system for Conduit and Censor subclasses.
- **Active Effects** — Ancestry traits with numeric modifiers (damage immunities, speed, etc.) generate proper Active Effects.

## For Developers

### Building from Source

All build scripts are in the `tools/` directory. Run from the repository root:

```bash
# Build packs
node tools/build_svellheim_character_options_module.js   # Origins
node tools/build_svellheim_faith_data.js                 # Faith data
node tools/build_svellheim_faith_items_pack.js           # Faith items pack
node tools/build_svellheim_campaign_journals_pack.js     # Campaign journals
node tools/build_svellheim_handout_journals_pack.js      # Handout journals
node tools/build_svellheim_rewards_pack.js               # Rewards

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
