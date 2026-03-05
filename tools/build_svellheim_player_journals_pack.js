#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * build_svellheim_player_journals_pack.js
 *
 * Reads pre-built Foundry VTT journal JSON files from data/player-journals/
 * and writes them into a LevelDB compendium pack at
 * module/packs/svellheim-player-journals/.
 *
 * Each journal gets a deterministic _id derived from its filename so that
 * compendium UUIDs remain stable across rebuilds.  Existing _id values in
 * the source JSON are replaced with the deterministic ones.
 *
 * Usage:
 *   node tools/build_svellheim_player_journals_pack.js
 *   npm run build:svellheim-player-journals
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ── Paths ──────────────────────────────────────────────────────────────
const REPO_ROOT = process.cwd();
const MODULE_DIR = path.join(REPO_ROOT, 'module');
const SOURCE_DIR = path.join(REPO_ROOT, 'data', 'player-journals');
const PACK_NAME = 'svellheim-world-player-journals';
const PACK_DIR = path.join(MODULE_DIR, 'packs', PACK_NAME);

// ── Deterministic ID helpers ───────────────────────────────────────────
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function base62FromBuffer(buf, length) {
  let n = BigInt('0x' + Buffer.from(buf).toString('hex'));
  const base = BigInt(B62.length);
  let out = '';
  while (n > 0n) {
    out = B62[Number(n % base)] + out;
    n /= base;
  }
  if (out.length < length) out = out.padStart(length, '0');
  if (out.length > length) out = out.slice(0, length);
  return out;
}

function foundryIdFromSeed(seed) {
  const digest = crypto.createHash('sha1').update(String(seed)).digest();
  return base62FromBuffer(digest.subarray(0, 12), 16);
}

// ── LevelDB writer ─────────────────────────────────────────────────────

async function writePack({ journals, pages, folders, outDir }) {
  const { ClassicLevel } = require('classic-level');

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const db = new ClassicLevel(outDir, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
  await db.open();

  for (const f of folders) {
    await db.put(`!folders!${f._id}`, JSON.stringify(f));
  }
  for (const j of journals) {
    await db.put(`!journal!${j._id}`, JSON.stringify(j));
  }
  for (const { journalId, page } of pages) {
    await db.put(`!journal.pages!${journalId}.${page._id}`, JSON.stringify(page));
  }

  await db.compactRange('\x00', '\xff');
  await db.close();
}

// ── Foundry document constructors ─────────────────────────────────────

function mkFolder({ name, type, folder, seed, sort = 0 }) {
  return {
    name,
    sorting: 'a',
    folder: folder || null,
    type,
    _id: foundryIdFromSeed(seed),
    description: '',
    sort,
    color: null,
    flags: {},
    _stats: {
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null,
      coreVersion: '13',
      systemId: 'draw-steel',
      systemVersion: null,
      createdTime: Date.now(),
      modifiedTime: null,
      lastModifiedBy: null,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const jsonFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith('.journal.json'))
    .sort();

  console.log(`Found ${jsonFiles.length} journal files in ${path.relative(REPO_ROOT, SOURCE_DIR)}/\n`);

  // Create a root folder for all player journals.
  const rootFolderSeed = `folder:${PACK_NAME}:root:Player Journals`;
  const rootFolderId = foundryIdFromSeed(rootFolderSeed);
  const folders = [
    mkFolder({
      name: 'Player Journals',
      type: 'JournalEntry',
      folder: null,
      seed: rootFolderSeed,
    }),
  ];

  const journals = [];
  const pages = [];

  for (const file of jsonFiles) {
    const filePath = path.join(SOURCE_DIR, file);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const stem = path.basename(file, '.journal.json');

    // Deterministic journal ID from filename
    const journalId = foundryIdFromSeed(`journal:${PACK_NAME}:${stem}`);

    // Build the page list with deterministic IDs
    const rawPages = Array.isArray(raw.pages) ? raw.pages : [];
    const journalPageIds = [];

    for (let i = 0; i < rawPages.length; i++) {
      const rp = rawPages[i];
      const pageName = rp.name || `Page ${i + 1}`;
      const pageId = foundryIdFromSeed(`journalPage:${PACK_NAME}:${stem}:${i}:${pageName}`);

      const page = {
        sort: rp.sort ?? i * 10000,
        name: pageName,
        type: rp.type || 'text',
        _id: pageId,
        system: rp.system || {},
        title: rp.title || { show: true, level: 1 },
        image: rp.image || {},
        text: rp.text || { format: 1, content: '' },
        video: rp.video || { controls: true, volume: 0.5 },
        src: rp.src || null,
        category: rp.category || null,
        ownership: { default: -1 },
        flags: rp.flags || {},
        _stats: {
          compendiumSource: null,
          duplicateSource: null,
          exportSource: null,
          coreVersion: '13',
          systemId: 'draw-steel',
          systemVersion: null,
          createdTime: Date.now(),
          modifiedTime: null,
          lastModifiedBy: null,
        },
      };

      journalPageIds.push(pageId);
      pages.push({ journalId, page });
    }

    // Build journal entry — default ownership allows observer access
    const journal = {
      name: raw.name || stem,
      _id: journalId,
      pages: journalPageIds,
      folder: rootFolderId,
      categories: [],
      sort: raw.sort ?? 0,
      ownership: { default: -1 },
      flags: raw.flags || {},
      _stats: {
        compendiumSource: null,
        duplicateSource: null,
        exportSource: null,
        coreVersion: '13',
        systemId: 'draw-steel',
        systemVersion: null,
        createdTime: Date.now(),
        modifiedTime: null,
        lastModifiedBy: null,
      },
    };

    journals.push(journal);
    console.log(`  ${raw.name || stem}  (${rawPages.length} pages)`);
  }

  await writePack({ journals, pages, folders, outDir: PACK_DIR });

  console.log(
    `\nWrote ${journals.length} journal entries, ${pages.length} pages, ` +
    `${folders.length} folder(s) to ${path.relative(REPO_ROOT, PACK_DIR)}/`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
