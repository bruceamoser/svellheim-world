#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * build_svellheim_handout_journals_pack.js
 *
 * Reads hand-authored JournalEntry JSON files from data/Director-Journals/ and
 * data/Player-Journals/ and writes them into a single LevelDB compendium pack
 * at module/packs/svellheim-handout-journals/.
 *
 * Director journals get ownership { default: 0 } (GM-only).
 * Player journals get ownership { default: 2 } (Observer — player-visible).
 *
 * Embedded page _ids are preserved from the export files since they are internal
 * to each journal entry.
 *
 * Usage (from repo root):
 *   node tools/build_svellheim_handout_journals_pack.js
 *
 * Output:
 *   module/packs/svellheim-handout-journals/  (LevelDB)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ── Paths ──────────────────────────────────────────────────────────────
const REPO_ROOT   = process.cwd();
const MODULE_DIR  = path.join(REPO_ROOT, 'module');
const DATA_ROOT   = path.join(REPO_ROOT, 'data');
const PACK_NAME   = 'svellheim-handout-journals';
const PACK_DIR    = path.join(MODULE_DIR, 'packs', PACK_NAME);

// Path to the campaign pack built by build_svellheim_campaign_journals_pack.js
const CAMPAIGN_PACK_DIR = path.join(MODULE_DIR, 'packs', 'svellheim-campaign');

// Source categories — each becomes a top-level folder in the compendium.
// ownership sets the Foundry default permission level for all journals in that category.
const CATEGORIES = [
  { dir: 'Director-Journals', label: 'Director Handouts', ownership: 0, sort: 100000 },
  { dir: 'Player-Journals',   label: 'Player Handouts',   ownership: 2, sort: 200000 },
];

// ── Deterministic ID helpers ───────────────────────────────────────────
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function base62FromBuffer(buf, len) {
  let n = BigInt('0x' + buf.toString('hex'));
  if (n === 0n) return '0'.repeat(len);
  let out = '';
  while (n > 0n) { out = BASE62[Number(n % 62n)] + out; n = n / 62n; }
  if (out.length < len) out = out.padStart(len, '0');
  if (out.length > len) out = out.slice(0, len);
  return out;
}

function foundryId(seed) {
  return base62FromBuffer(crypto.createHash('sha1').update(String(seed)).digest().subarray(0, 12), 16);
}

// ── _stats block factory ───────────────────────────────────────────────
function mkStats() {
  return {
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null,
    coreVersion: '13',
    systemId: 'draw-steel',
    systemVersion: null,
    createdTime: Date.now(),
    modifiedTime: null,
    lastModifiedBy: null,
  };
}

// ── Folder factory ─────────────────────────────────────────────────────
function mkFolder({ id, name, parentId = null, sort = 0 }) {
  return {
    _id: id,
    name,
    type: 'JournalEntry',
    folder: parentId,
    color: null,
    sorting: 'a',
    sort,
    description: '',
    flags: {},
    _stats: mkStats(),
  };
}

// ── LevelDB writer ─────────────────────────────────────────────────────
async function writeLevelDb({ folders, journals }, outDir) {
  const { ClassicLevel } = require('classic-level');

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const db = new ClassicLevel(outDir, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
  await db.open();

  for (const f of folders)  await db.put(`!folders!${f._id}`, JSON.stringify(f));
  for (const j of journals) {
    // Store pages separately, then store the journal with just page IDs
    const pages = j.pages || [];
    const pageIds = pages.map(p => p._id);
    for (const p of pages) {
      await db.put(`!journal.pages!${j._id}.${p._id}`, JSON.stringify(p));
    }
    const journalEntry = { ...j, pages: pageIds };
    await db.put(`!journal!${j._id}`, JSON.stringify(journalEntry));
  }

  await db.compactRange('\x00', '\xff');
  await db.close();
}

// ── Import campaign journals from the campaign pack LevelDB ────────────
// Campaign folders are reparented under Player Handouts so players can
// browse them alongside the other player-visible content.
async function loadCampaignJournals(playerHandoutsFolderId) {
  if (!fs.existsSync(CAMPAIGN_PACK_DIR)) {
    console.warn('  ⚠  Campaign pack not found at', CAMPAIGN_PACK_DIR, '— skipping campaign merge.');
    console.warn('     Run build_svellheim_campaign_journals_pack.js first if you want campaign content.');
    return { folders: [], journals: [] };
  }

  const { ClassicLevel } = require('classic-level');
  let db;
  try {
    db = new ClassicLevel(CAMPAIGN_PACK_DIR, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
    await db.open();
  } catch (err) {
    console.warn(`  ⚠  Could not open campaign LevelDB: ${err.message}`);
    return { folders: [], journals: [] };
  }

  const folders  = [];
  const journals = [];

  // Read all folders — top-level campaign folders (no parent) are reparented
  // under the Player Handouts folder. Sub-folders keep their original parents.
  let topSort = 300000;
  for await (const [key, value] of db.iterator()) {
    if (!key.startsWith('!folders!')) continue;
    try {
      const f = JSON.parse(value);
      if (!f.folder) {
        f.folder = playerHandoutsFolderId;
        f.sort = topSort;
        topSort += 100000;
      }
      folders.push(f);
    } catch { /* skip */ }
  }

  // Read all journal entries and their pages
  const pagesByJournal = new Map();
  for await (const [key, value] of db.iterator()) {
    if (key.startsWith('!journal.pages!')) {
      try {
        const page = JSON.parse(value);
        const journalId = key.split('!')[2].split('.')[0];
        if (!pagesByJournal.has(journalId)) pagesByJournal.set(journalId, []);
        pagesByJournal.get(journalId).push(page);
      } catch { /* skip */ }
    } else if (key.startsWith('!journal!')) {
      try {
        const journal = JSON.parse(value);
        journal.pages = journal.pages || [];
        journals.push(journal);
      } catch { /* skip */ }
    }
  }

  // Attach page objects back to journals
  for (const j of journals) {
    const pages = pagesByJournal.get(j._id) || [];
    if (pages.length > 0) {
      j.pages = pages;
    }
  }

  await db.close();

  console.log(`  Loaded ${journals.length} campaign journals and ${folders.length} folders from campaign pack`);
  return { folders, journals };
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  const folders  = [];
  const journals = [];

  for (const cat of CATEGORIES) {
    const srcDir = path.join(DATA_ROOT, cat.dir);
    if (!fs.existsSync(srcDir)) {
      console.warn(`  ⚠  Skipping missing category dir: ${srcDir}`);
      continue;
    }

    // Create a folder for this category
    const folderId = foundryId(`handout-folder:${cat.dir}`);
    folders.push(mkFolder({ id: folderId, name: cat.label, sort: cat.sort }));

    const jsonFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.json')).sort();

    for (const file of jsonFiles) {
      const raw = JSON.parse(fs.readFileSync(path.join(srcDir, file), 'utf8'));
      const stem = path.basename(file, '.json').replace(/\.journal$/, '');

      // Deterministic top-level _id (page _ids are preserved)
      raw._id = foundryId(`journal:${PACK_NAME}:${stem}`);
      raw.folder = folderId;
      raw._stats = mkStats();
      raw.ownership = { default: cat.ownership };
      raw.flags = raw.flags || {};
      raw.sort = raw.sort ?? 0;

      journals.push(raw);
      console.log(`  [${cat.dir}] ${raw.name} → ${raw._id}`);
    }
  }

  // ── Merge campaign journals ──────────────────────────────────────
  // Player Handouts folder was created above — find it for reparenting.
  const playerHandoutsFolder = folders.find(f => f.name === 'Player Handouts');
  const campaign = await loadCampaignJournals(playerHandoutsFolder?._id || null);

  // Campaign content should be player-visible (Observer)
  for (const j of campaign.journals) {
    j.ownership = { default: 2 };
  }

  folders.push(...campaign.folders);
  journals.push(...campaign.journals);

  await writeLevelDb({ folders, journals }, PACK_DIR);

  console.log(`\nWrote pack: ${path.relative(REPO_ROOT, PACK_DIR)} (${journals.length} journals, ${folders.length} folders)`);
}

main().catch(e => { console.error(e); process.exit(1); });
