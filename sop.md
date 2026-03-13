# Standard Operating Procedure — Svellheim GitHub Project Workflow

> How to take a task from the project board through to merge. Follow this process for every change across all Svellheim repositories.

---

## 1. GitHub Project Board

All work is tracked on the **Svellheim GitHub Project** board. Tasks (issues) live in the repository they affect. Cross-repo work gets one issue per repo.

### Task States

| State | Meaning |
|-------|---------|
| **Backlog** | Identified but not scheduled |
| **Ready** | Refined, has acceptance criteria, ready to pick up |
| **In Progress** | Actively being worked — assigned to someone |
| **In Review** | Pull request open, awaiting review |
| **Done** | Merged and verified |

---

## 2. Creating Tasks

### Where to Create

Create the issue in the **repository the change lives in**:

| Change Type | Repository |
|-------------|-----------|
| Adoc beat write-ups, campaign docs, VP tracking | `Era-of-Embers` |
| Act 1 Foundry journals, montages, negotiations | `Svellheim-Act1` |
| Act 2 Foundry journals, montages, negotiations | `Svellheim-Act2` |
| Act 3 Foundry journals, montages, negotiations | `Svellheim-Act3` |
| World gazetteer, geographic data | `svellheim-world` |
| NPCs, monsters, items, projects | `Svellheim-Entities` |

### Tags (Labels)

Apply appropriate labels to every issue:

| Label | Use When |
|-------|----------|
| `rename` | Naming changes (e.g., Great Green → Greenweald) |
| `new-beat` | Writing a new beat (20a, 20b, 23a, etc.) |
| `side-quest` | Side quest content |
| `plot-fix` | Plot hole corrections |
| `vp-expansion` | VP balancing changes |
| `npc` | NPC creation or update |
| `monster` | Monster creation or update |
| `encounter` | Encounter design |
| `negotiation` | Negotiation test design |
| `montage` | Montage test design |
| `priority:critical` | Blocks other work |
| `priority:important` | Should be done soon |
| `priority:nice-to-have` | Can wait |

### Sub-Tasks

Use GitHub task lists (checkboxes) inside an issue for sub-tasks when:

- A single issue involves multiple files
- A change has distinct steps that benefit from individual tracking
- You want to show incremental progress without creating separate issues

**Example:**
```markdown
## Tasks
- [ ] Update adoc file title
- [ ] Update internal references (×3 locations)
- [ ] Update cross-reference in overview adoc
- [ ] Update Foundry journal entry
```

For truly independent pieces of work that could be done by different people or at different times, create **separate issues** rather than sub-tasks.

---

## 3. Picking Up a Task

1. **Find a task** in the **Ready** column on the project board
2. **Assign yourself** immediately — do not start unassigned work
3. **Move the task** to **In Progress** on the project board
4. These two steps happen together, at the same time — never leave a task in progress without an assignee

---

## 4. Branching

### Branch Naming

```
<type>/<issue-number>-<short-description>
```

**Examples:**
```
rename/12-greenweald-rename
new-beat/15-beat-20a-keepers-confession
side-quest/23-drowned-messenger
plot-fix/8-tunnel-collapse-dialogue
monster/31-rot-forged-sentinel
```

### Creating the Branch

```bash
git checkout main
git pull origin main
git checkout -b <branch-name>
```

Always branch from an up-to-date `main`.

---

## 5. Making Changes

1. Make your changes on the branch
2. Commit frequently with clear messages referencing the issue:
   ```
   git commit -m "Update Beat 6 title to The Greenweald (#12)"
   ```
3. Include the issue number (`#N`) in commit messages so GitHub links them
4. Keep commits focused — one logical change per commit

### Commit Message Format

```
<short summary> (#<issue-number>)

Optional longer description if the change is complex.
```

---

## 6. Push and Pull Request

### Push the Branch

```bash
git push origin <branch-name>
```

### Create the Pull Request

1. Open a PR from your branch → `main`
2. **Title:** Match the issue title or summarize the change
3. **Description:** Include:
   - `Closes #<issue-number>` (this auto-closes the issue on merge)
   - A brief summary of what changed
   - Any testing notes or things to verify
4. **Labels:** Apply the same labels as the issue
5. **Link the PR** to the project board (GitHub usually does this automatically via `Closes #N`)

**Example PR description:**
```markdown
Closes #12

Renames all "Great Green" references to "Greenweald" in Beat 6 adoc,
director journal, montage test filenames, and player handouts.

## Changes
- Renamed `06-The-Great-Green.adoc` → `06-The-Greenweald.adoc`
- Updated 7 internal text references
- Renamed 2 montage test JSON files
- Updated VERIFICATION-PLAN.md references
```

---

## 7. Review and Merge

1. Review the PR diff — verify all changes are correct
2. Confirm any sub-tasks in the linked issue are checked off
3. **Merge** using **Squash and Merge** (keeps main history clean) or **Merge Commit** (preserves individual commits) — pick one convention and stick with it
4. **Delete the branch** after merge — GitHub offers this automatically; always accept it
5. The issue should auto-close from the `Closes #N` keyword. If not, close it manually
6. Verify the task moves to **Done** on the project board

---

## 8. Multi-Repo Changes

When a single logical change spans multiple repositories (e.g., renaming "Great Green" touches `Era-of-Embers`, `Svellheim-Act1`, `svellheim-world`, and `Svellheim-Entities`):

1. Create **one issue per repo**, each describing that repo's portion of the work
2. Link the issues to each other in their descriptions:
   ```markdown
   Part of the Greenweald rename. Related issues:
   - Era-of-Embers#12
   - Svellheim-Act1#5
   - svellheim-world#3
   - Svellheim-Entities#8
   ```
3. Create a branch and PR in each repo independently
4. Merge order: start with the **source of truth** (`Era-of-Embers` adocs) first, then Foundry data repos, then entities

---

## 9. Build, Release, and Deploy

After all PRs are merged for a batch of changes, build and release every affected Foundry module.

### 9.1 Build All Changed Modules

Each repo has build scripts in `tools/` that compile source JSON into LevelDB compendium packs. Run **every** `build_*.js` script in the repo, not just the ones you think changed — this ensures packs stay consistent.

```powershell
# From the repo root
node tools/build_svellheim_director_journals_pack.js
node tools/build_svellheim_player_journals_pack.js
node tools/build_svellheim_montage_tests_pack.js
node tools/build_svellheim_negotiation_tests_pack.js
```

**Per-repo build scripts:**

| Repo | Scripts to run |
|------|---------------|
| `Svellheim-Act1` | `build_svellheim_director_journals_pack.js`, `build_svellheim_player_journals_pack.js`, `build_svellheim_montage_tests_pack.js`, `build_svellheim_negotiation_tests_pack.js` |
| `Svellheim-Act2` | Same 4 scripts as Act 1 |
| `Svellheim-Act3` | Same 4 scripts as Act 1 |
| `Svellheim-Entities` | `build_svellheim_monsters_pack.js`, `build_svellheim_npcs_pack.js`, `build_svellheim_items_pack.js`, `build_svellheim_projects_pack.js` |
| `svellheim-world` | `build_svellheim_director_journals_pack.js`, `build_svellheim_player_journals_pack.js`, `build_svellheim_campaign_journals_pack.js`, `build_svellheim_handout_journals_pack.js`, `build_svellheim_faith_data.js`, `build_svellheim_faith_items_pack.js`, `build_svellheim_classes.js`, `build_svellheim_character_options_module.js` |

### 9.2 Commit Build Output

After builds complete, commit the generated LevelDB pack files:

```bash
git add -A
git commit -m "Build packs for v<version>"
git push origin main
```

### 9.3 Create Patch Release

Use `do-release.ps1` in `Era-of-Embers` to create a patch release for each changed module. The script handles:

1. **Version bump** — increments the patch segment (e.g. `0.1.12` → `0.1.13`)
2. **Stamps both `module.json` files** — updates `version`, `download` URL, and zip filename in both root `module.json` and `module/module.json` (these must always match)
3. **Builds all packs** — runs every `tools/build_*.js` script
4. **Creates release zip** — packages `module/` into `dist/foundry/<id>-v<version>.zip`
5. **Git commit + tag** — commits version bump, tags `v<version>`
6. **Git push** — pushes commit and tag to origin
7. **GitHub Release** — uses `gh release create` to publish the zip and manifest

```powershell
# Edit the MAIN section of do-release.ps1 to list the modules to release, then run:
cd D:\Repos\Era-of-Embers
.\do-release.ps1
```

### 9.4 Release Order

Modules have dependencies — release in this order:

1. **`Svellheim-Entities`** (no module dependencies)
2. **`Svellheim-Act1`**, **`Svellheim-Act2`**, **`Svellheim-Act3`** (depend on Entities)
3. **`svellheim-world`** (depends on all of the above)

### 9.5 Post-Release Verification

1. Confirm each GitHub Release page has the correct zip and `module.json` assets
2. In Foundry VTT, use **Update Module** to pull the new versions
3. Spot-check that renamed/new content appears correctly in the compendiums

---

## 10. Quick Reference — Full Workflow

```
 1. Pick task from Ready column
 2. Assign yourself + move to In Progress
 3. git checkout main && git pull
 4. git checkout -b <type>/<issue>-<desc>
 5. Make changes, commit with (#N) references
 6. git push origin <branch>
 7. Open PR with "Closes #N" in description
 8. Review, merge, delete branch
 9. Verify issue closed + task at Done
10. Build packs: node tools/build_*.js (all scripts)
11. Commit + push build output
12. Run do-release.ps1 for patch release (Entities → Acts → World)
13. Verify release assets + update in Foundry
```
