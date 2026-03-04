#!/usr/bin/env node
/**
 * Split Restore-the-Flame.journal.json into:
 * 1. Campaign-global pages (stay in Svellheim-World)
 * 2. Act 1 beat pages (move to Svellheim-Act1)
 *
 * Enhances beat pages to match Act 2/3 page structure (adds _stats, src, system, title, ownership).
 */

const fs = require('fs');
const path = require('path');

// Paths
const rtfPath = path.join(__dirname, '..', 'data', 'director-journals', 'Restore-the-Flame.journal.json');
const act1Dir = path.resolve(__dirname, '..', '..', 'Svellheim-Act1', 'data', 'director-journals');
const act1Path = path.join(act1Dir, 'Act-1-Restore-the-Flame-Director-Journal.journal.json');

// Read the source
const rtf = JSON.parse(fs.readFileSync(rtfPath, 'utf-8'));

// Beat page IDs (Beat 1 through Beat 9)
const beatIds = new Set([
  'RTFPAGE000000018', // Beat 1
  'RTFPAGE000000019', // Beat 2
  'RTFPAGE000000020', // Beat 3
  'RTFPAGE000000021', // Beat 4
  'RTFPAGE000000022', // Beat 5
  'RTFPAGE000000023', // Beat 6
  'RTFPAGE000000024', // Beat 7
  'RTFPAGE000000025', // Beat 8
  'RTFPAGE000000026', // Beat 9
]);

// Split pages
const globalPages = rtf.pages.filter(p => !beatIds.has(p._id));
const beatPages = rtf.pages.filter(p => beatIds.has(p._id));

console.log(`Global pages: ${globalPages.length}`);
console.log(`Beat pages: ${beatPages.length}`);
globalPages.forEach(p => console.log(`  [global] ${p._id} — ${p.name} (sort: ${p.sort})`));
beatPages.forEach(p => console.log(`  [beat]   ${p._id} — ${p.name} (sort: ${p.sort})`));

// Stats block matching Act 2/3 structure
const statsBlock = {
  compendiumSource: null,
  duplicateSource: null,
  exportSource: null,
  coreVersion: "13.351",
  systemId: "draw-steel",
  systemVersion: "0.10.0",
  createdTime: 0,
  modifiedTime: 0,
  lastModifiedBy: null
};

// Enhance beat pages to match Act 2/3 structure
const enhancedBeatPages = beatPages.map((page, index) => {
  // Ensure text has markdown field
  const text = { ...page.text };
  if (!('markdown' in text)) {
    text.markdown = null;
  }

  return {
    _id: page._id,
    name: page.name,
    type: page.type,
    text: text,
    src: page.src || null,
    system: page.system || {},
    title: page.title || { show: true, level: 1 },
    sort: (index + 1) * 10, // 10, 20, 30, ... 90
    flags: page.flags || {},
    ownership: page.ownership || { default: 0 },
    _stats: page._stats || { ...statsBlock }
  };
});

// Enhance global pages too for consistency
const enhancedGlobalPages = globalPages.map((page, index) => {
  const text = { ...page.text };
  if (!('markdown' in text)) {
    text.markdown = null;
  }

  return {
    _id: page._id,
    name: page.name,
    type: page.type,
    text: text,
    src: page.src || null,
    system: page.system || {},
    title: page.title || { show: true, level: 1 },
    sort: (index + 1) * 10, // Re-sort: 10, 20, 30, ... 90
    flags: page.flags || {},
    ownership: page.ownership || { default: 0 },
    _stats: page._stats || { ...statsBlock }
  };
});

// Create Act 1 director journal
const act1Journal = {
  _id: "SVH1DJRN00000001",
  name: "Act 1 — Restore the Flame (Director Journal)",
  pages: enhancedBeatPages,
  sort: 0,
  ownership: { default: 0 },
  flags: {},
  _stats: { ...statsBlock }
};

// Update the RTF journal (campaign-global only)
const updatedRtf = {
  ...rtf,
  pages: enhancedGlobalPages
};

// Write Act 1 director journal
fs.mkdirSync(act1Dir, { recursive: true });
fs.writeFileSync(act1Path, JSON.stringify(act1Journal, null, 2) + '\n', 'utf-8');
console.log(`\nWrote Act 1 journal: ${act1Path}`);
console.log(`  Pages: ${enhancedBeatPages.length}`);

// Write updated RTF journal
fs.writeFileSync(rtfPath, JSON.stringify(updatedRtf, null, 2) + '\n', 'utf-8');
console.log(`\nUpdated RTF journal: ${rtfPath}`);
console.log(`  Pages: ${enhancedGlobalPages.length}`);

console.log('\nDone!');
