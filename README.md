# Svellheim World

A Foundry VTT module for the [Draw Steel](https://mcdm.gg/DrawSteel) system providing the Svellheim campaign setting — character options, campaign journals, faith system, and world reference material.

This is the **world module** in a multi-module ecosystem:

| Module | ID | Contents |
|---|---|---|
| **Svellheim World** (this repo) | `svellheim` | Character options, faith, campaign journals, handouts |
| **Svellheim Entities** | `svellheim-entities` | NPCs, monsters, items, projects, imbuings |
| **Svellheim Act 1** | `svellheim-act1` | Act 1 montage & negotiation encounters |
| **Svellheim Act 2** | `svellheim-act2` | Act 2 montage & negotiation encounters |
| **Svellheim Act 3** | `svellheim-act3` | Act 3 montage & negotiation encounters |

**Dependency chain:** `svellheim` → `svellheim-act1/act2/act3` → `svellheim-entities`

![Foundry VTT v13](https://img.shields.io/badge/Foundry_VTT-v13-informational)
![Draw Steel System](https://img.shields.io/badge/System-Draw_Steel-orange)

---

## Features

- **Runtime language registration** — Svellheim's 13 languages are injected into the Draw Steel language list and are available in character sheets and the Polyglot module.
- **Runtime faith registration** — Svellheim gods and custom domains (Frost, Runes, Strength, Vengeance) are registered into the Draw Steel faith system for Conduit and Censor subclasses.
- **Active Effects** — Ancestry traits with numeric modifiers (damage immunities, speed, etc.) generate proper Active Effects.
- **Compendium installer** — A GM-facing dialog that detects all active Svellheim modules and batch-imports their compendium packs into organised world folders.

## Compendium Packs

| Pack | Type | Contents |
|---|---|---|
| Svellheim Origins | Items | Ancestries, ancestry traits, cultures, careers |
| Svellheim Faith | Items | 16 gods, 16 domains (Aesir, Vanir, Jötnar, Spirits) |
| Svellheim Campaign | Journals | World atlas, character options reference |
| Svellheim Handout Journals | Journals | Player handouts, gazetteers, GM director cheatsheets |
| Svellheim Rewards | Items | Projects, treasures, titles, features |

## Requirements

| Requirement | Version |
|---|---|
| [Foundry VTT](https://foundryvtt.com/) | v11+ (verified v13) |
| [Draw Steel System](https://github.com/MetaMorphic-Digital/draw-steel) | Any |
| [Svellheim: Entities](https://github.com/bruceamoser/Svellheim-Entities) | v0.1.0+ |
| [Svellheim: Act 1](https://github.com/bruceamoser/Svellheim-Act1) | v0.1.0+ |
| [Svellheim: Act 2](https://github.com/bruceamoser/Svellheim-Act2) | v0.1.0+ |
| [Svellheim: Act 3](https://github.com/bruceamoser/Svellheim-Act3) | v0.1.0+ |

This module **only** works with the Draw Steel system.

## Installation

### Manifest URL (recommended)

1. In Foundry VTT, go to **Settings → Manage Modules → Install Module**.
2. Paste the manifest URL into the **Manifest URL** field:
   ```
   https://github.com/bruceamoser/svellheim-world/releases/latest/download/module.json
   ```
3. Click **Install**.

### Manual

1. Download the latest release zip from the [Releases](https://github.com/bruceamoser/svellheim-world/releases) page.
2. Extract the zip into your Foundry `Data/modules/` folder. The folder should be named `svellheim`.
3. Restart Foundry and enable the module in your Draw Steel world.

## File Structure

```
svellheim/
├── module.json                       # Module manifest
├── scripts/
│   ├── register-languages.js         # Runtime language registration
│   ├── register-faith.js             # Runtime faith/domain registration
│   ├── register-polyglot.js          # Polyglot module integration
│   └── compendium-installer.js       # Multi-module compendium importer
├── templates/
│   └── compendium-installer.html     # Installer dialog template
├── packs/                            # Compiled Foundry VTT LevelDB packs
├── assets/                           # Static assets (icons, images)
└── data/                             # Pack source data
```

## Building a Release

All build scripts are in the `tools/` directory. Run from the repository root:

```bash
# Build packs
node tools/build_svellheim_character_options_module.js   # Origins
node tools/build_svellheim_faith_data.js                 # Faith data
node tools/build_svellheim_faith_items_pack.js           # Faith items pack
node tools/build_svellheim_campaign_journals_pack.js     # Campaign journals
node tools/build_svellheim_handout_journals_pack.js      # Handout journals

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

## Acknowledgements

- [Foundry VTT](https://foundryvtt.com/) — Virtual tabletop platform.
- [Draw Steel](https://mcdm.gg/DrawSteel) by MCDM Productions — The RPG system this module supports.
- [MetaMorphic Digital](https://github.com/MetaMorphic-Digital/draw-steel) — Draw Steel system implementation for Foundry VTT.
