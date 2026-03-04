#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const asciidoctor = require('@asciidoctor/core')();
const { marked } = require('marked');

const REPO_ROOT = process.cwd();

const MODULE_ID = 'svellheim';
const MODULE_DIR = path.join(REPO_ROOT, 'module');

// Cross-repo: reads campaign source from Era-of-Embers sibling repo
const CAMPAIGN_ROOT = path.join(REPO_ROOT, '..', 'Era-of-Embers', 'campaign', 'docs');

const PACK_NAME = 'svellheim-campaign';
const PACK_DIR = path.join(MODULE_DIR, 'packs', PACK_NAME);

const ORIGINS_PACK_NAME = 'svellheim-origins';
const ORIGINS_PACK_DIR = path.join(MODULE_DIR, 'packs', ORIGINS_PACK_NAME);

const FAITH_PACK_NAME = 'svellheim-faith';
const FAITH_PACK_DIR = path.join(MODULE_DIR, 'packs', FAITH_PACK_NAME);

const DRAW_STEEL_PACKAGE_ID = 'draw-steel';
// Cross-repo: reads Draw Steel reference packs from MCP sibling repo
const DRAW_STEEL_PACKS_DIR = path.join(REPO_ROOT, '..', 'draw-steel-foundry-vtt-mcp', 'reference', 'draw-steel-packs');
const DRAW_STEEL_PACK_NAMES = ['origins', 'character-options', 'classes', 'abilities'];

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function base62FromBuffer(buf, length) {
  let n = BigInt('0x' + buf.toString('hex'));
  if (n === 0n) return '0'.repeat(length);
  let out = '';
  while (n > 0n) {
    const r = n % 62n;
    out = BASE62_ALPHABET[Number(r)] + out;
    n = n / 62n;
  }
  if (out.length < length) out = out.padStart(length, '0');
  if (out.length > length) out = out.slice(0, length);
  return out;
}

function foundryIdFromSeed(seed) {
  const digest = crypto.createHash('sha1').update(seed).digest();
  return base62FromBuffer(digest.subarray(0, 12), 16);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeLookupKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

function isInternalDocHref(href) {
  if (!href) return false;
  const h = String(href).trim();
  if (!h) return false;
  if (/^(https?:)?\/\//i.test(h)) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(h)) return false;
  // Asciidoctor xref links commonly end in .html when converting.
  if (/\.(html|adoc|md)(#.*)?$/i.test(h)) return true;
  // Common relative paths in our doc tree.
  if (h.includes('01-Base-Careers/')) return true;
  return false;
}

function lookupKeyFromHref(href) {
  if (!href) return '';
  const h = String(href).split('#')[0].trim();
  if (!h) return '';
  const base = path.posix.basename(h);
  const noExt = base.replace(/\.(html|adoc|md)$/i, '');
  // Strip leading numeric ordering like "04-Ledger-Keeper".
  const cleaned = noExt.replace(/^\d{2,3}-/, '');
  return normalizeLookupKey(cleaned);
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, '');
}

function rewriteHtmlLinksToUuids(html, { linkIndex }) {
  if (!html || !linkIndex || !linkIndex.size) return html;

  return String(html).replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs, inner) => {
    const hrefMatch = /\bhref\s*=\s*"([^"]+)"/i.exec(attrs) || /\bhref\s*=\s*'([^']+)'/i.exec(attrs);
    const href = hrefMatch ? hrefMatch[1] : '';
    if (!isInternalDocHref(href)) return full;

    const text = stripTags(inner).trim();
    const keyByText = normalizeLookupKey(text);
    const keyByHref = lookupKeyFromHref(href);
    const uuid = linkIndex.get(keyByText) || (keyByHref ? linkIndex.get(keyByHref) : undefined);
    const label = text || stripTags(inner) || 'Link';
    if (!uuid) {
      // Avoid leaving dead internal links pointing at non-existent .html files.
      return label;
    }

    // Replace the whole link with Foundry's UUID link syntax.
    return `@UUID[${uuid}]{${label}}`;
  });
}

/**
 * Words that are too common / ambiguous to auto-link as item references.
 * These are item names that also appear as ordinary English words.
 */
const SKIP_PLAIN_TEXT_NAMES = new Set([
  'frost', 'runes', 'strength', 'vengeance', 'wings', 'swift',
  'maker', 'relentless', 'fearless', 'grounded', 'determination',
  'perseverance', 'creation', 'death', 'fate', 'knowledge', 'life',
  'love', 'nature', 'protection', 'storm', 'sun', 'trickery', 'war',
]);

/**
 * Scan HTML for plain-text mentions of known item names and wrap them
 * in @UUID links.  Only matches whole-word occurrences that appear
 * *outside* of existing HTML tags and @UUID blocks.
 *
 * `nameIndex` is a Map<displayName, uuid> with original-cased names.
 */
function injectPlainTextUuidLinks(html, { nameIndex }) {
  if (!html || !nameIndex || !nameIndex.size) return html;

  // Build list of names to search for, sorted longest first.
  const entries = [];
  for (const [name, uuid] of nameIndex.entries()) {
    if (name.length < 4) continue;
    if (SKIP_PLAIN_TEXT_NAMES.has(name.toLowerCase())) continue;
    entries.push({ name, uuid });
  }
  entries.sort((a, b) => b.name.length - a.name.length);
  if (!entries.length) return html;

  // Build a single combined regex with longest-first alternation.
  // JS regex alternation is ordered: the first matching alternative wins,
  // and .replace() never re-scans replacement text — preventing nesting.
  const combined = new RegExp(
    '\\b(' + entries.map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
    'gi'
  );
  const lookup = new Map();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (!lookup.has(key)) lookup.set(key, e);
  }

  // Split HTML into tags/uuids (keep) vs text (scan).
  const TAG_OR_UUID = /(<[^>]+>|@UUID\[[^\]]*\]\{[^}]*\})/g;
  const parts = html.split(TAG_OR_UUID);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Skip tags and existing @UUID links.
    if (!part || part.startsWith('<') || part.startsWith('@UUID[')) continue;

    parts[i] = part.replace(combined, (match) => {
      const e = lookup.get(match.toLowerCase());
      if (!e) return match;
      return `@UUID[${e.uuid}]{${match}}`;
    });
  }

  return parts.join('');
}

async function loadOriginsLinkIndex() {
  const { ClassicLevel } = require('classic-level');

  if (!fs.existsSync(ORIGINS_PACK_DIR)) return { index: new Map(), nameIndex: new Map() };

  const db = new ClassicLevel(ORIGINS_PACK_DIR, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
  await db.open();

  const index = new Map();
  const nameIndex = new Map(); // displayName → uuid

  for await (const [key, value] of db.iterator()) {
    if (!String(key).startsWith('!items!')) continue;
    let item;
    try {
      item = JSON.parse(value);
    } catch {
      continue;
    }
    if (!item || !item._id || !item.name) continue;

    const uuid = `Compendium.${MODULE_ID}.${ORIGINS_PACK_NAME}.Item.${item._id}`;
    index.set(normalizeLookupKey(item.name), uuid);
    nameIndex.set(item.name, uuid); // original display name

    const dsid = item?.system?._dsid;
    if (dsid) index.set(normalizeLookupKey(dsid), uuid);

    // Add a few helpful aliases (hyphen/space differences are common in prose).
    const noHyphen = String(item.name).replace(/-/g, ' ');
    index.set(normalizeLookupKey(noHyphen), uuid);
    nameIndex.set(noHyphen, uuid);

    const withHyphen = String(item.name).replace(/\s+/g, '-');
    index.set(normalizeLookupKey(withHyphen), uuid);
  }

  await db.close();
  return { index, nameIndex };
}

async function loadLevelDbItemIndex({ packDir, packageId, packName }) {
  const { ClassicLevel } = require('classic-level');
  if (!fs.existsSync(packDir)) return { index: new Map(), nameIndex: new Map() };

  const db = new ClassicLevel(packDir, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
  await db.open();

  const index = new Map();
  const nameIndex = new Map();
  for await (const [key, value] of db.iterator()) {
    if (!String(key).startsWith('!items!')) continue;
    let item;
    try {
      item = JSON.parse(value);
    } catch {
      continue;
    }
    if (!item || !item._id || !item.name) continue;

    const uuid = `Compendium.${packageId}.${packName}.Item.${item._id}`;
    index.set(normalizeLookupKey(item.name), uuid);
    nameIndex.set(item.name, uuid);

    const dsid = item?.system?._dsid;
    if (dsid) index.set(normalizeLookupKey(dsid), uuid);

    const noHyphen = String(item.name).replace(/-/g, ' ');
    index.set(normalizeLookupKey(noHyphen), uuid);
    nameIndex.set(noHyphen, uuid);

    const withHyphen = String(item.name).replace(/\s+/g, '-');
    index.set(normalizeLookupKey(withHyphen), uuid);
  }

  await db.close();
  return { index, nameIndex };
}

async function loadDrawSteelLinkIndex() {
  const mergedIndex = new Map();
  const mergedNames = new Map();
  if (!fs.existsSync(DRAW_STEEL_PACKS_DIR)) return { index: mergedIndex, nameIndex: mergedNames };

  for (const packName of DRAW_STEEL_PACK_NAMES) {
    const packDir = path.join(DRAW_STEEL_PACKS_DIR, packName);
    const { index: idx, nameIndex: names } = await loadLevelDbItemIndex({ packDir, packageId: DRAW_STEEL_PACKAGE_ID, packName });
    for (const [k, v] of idx.entries()) mergedIndex.set(k, v);
    for (const [k, v] of names.entries()) mergedNames.set(k, v);
  }

  return { index: mergedIndex, nameIndex: mergedNames };
}

async function loadCombinedLinkIndex() {
  // Load core Draw Steel items first, then Svellheim so homebrew can override collisions.
  const ds = await loadDrawSteelLinkIndex();
  const index = ds.index;
  const nameIndex = ds.nameIndex;

  const sv = await loadOriginsLinkIndex();
  for (const [k, v] of sv.index.entries()) index.set(k, v);
  for (const [k, v] of sv.nameIndex.entries()) nameIndex.set(k, v);

  // Include faith pack items (gods, domains).
  const faith = await loadLevelDbItemIndex({
    packDir: FAITH_PACK_DIR,
    packageId: MODULE_ID,
    packName: FAITH_PACK_NAME,
  });
  for (const [k, v] of faith.index.entries()) index.set(k, v);
  for (const [k, v] of faith.nameIndex.entries()) nameIndex.set(k, v);

  return { index, nameIndex };
}

function prettySegment(seg) {
  // Directory names are like 01-The-World / 04-Campaign etc.
  const m = /^(\d{2})-(.+)$/.exec(seg);
  if (m) return `${m[1]} - ${m[2].replace(/-/g, ' ')}`;
  return seg.replace(/-/g, ' ');
}

function isHiddenPath(rel) {
  const parts = rel.split('/');
  return parts.some((p) => p.startsWith('.') || p.startsWith('_'));
}

function* walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkFiles(full);
      continue;
    }
    if (!e.isFile()) continue;
    yield full;
  }
}

function extractTitleFromMarkdown(md, fallback) {
  // Basic YAML front matter support (used by some bestiary files).
  const lines = md.split('\n');
  if (lines[0] === '---') {
    for (let i = 1; i < Math.min(lines.length, 60); i++) {
      const l = lines[i];
      if (l === '---') break;
      const m = /^Name:\s*(.+)\s*$/.exec(l);
      if (m) return m[1].trim();
    }
  }

  for (const l of lines) {
    const h = /^#\s+(.+?)\s*$/.exec(l);
    if (h) return h[1].trim();
  }

  return fallback;
}

function convertAdocToHtml({ filePath, relPath }) {
  const source = readText(filePath);

  const doc = asciidoctor.load(source, {
    safe: 'unsafe',
    base_dir: path.dirname(filePath),
    header_footer: false,
    attributes: {
      // Foundry already renders the page title; avoid double titles.
      showtitle: false,
      // Avoid TOC generation inside a single journal page.
      toc: false,
      // Avoid adding visible anchor icons next to headings.
      sectanchors: false,
    },
  });

  const title = (doc.getDocumentTitle && doc.getDocumentTitle()) || path.basename(filePath, '.adoc');
  const html = doc.convert();
  const sourceNote = `<hr/><p><em>Source:</em> ${htmlEscape(relPath)}</p>`;
  return { title, html: `${html}${sourceNote}` };
}

function stripFirstHtmlHeading(html) {
  const openIdx = html.search(/<h[1-6][^>]*>/i);
  if (openIdx === -1) return html;
  const openTag = /<h([1-6])[^>]*>/i.exec(html.slice(openIdx, openIdx + 64));
  if (!openTag) return html;
  const level = openTag[1];
  const closeTag = `</h${level}>`;
  const closeIdx = html.toLowerCase().indexOf(closeTag, openIdx);
  if (closeIdx === -1) return html;
  return html.slice(0, openIdx) + html.slice(closeIdx + closeTag.length);
}

function convertAdocToPages({ filePath, relPath, linkIndex, nameIndex }) {
  const source = readText(filePath);

  const doc = asciidoctor.load(source, {
    safe: 'unsafe',
    base_dir: path.dirname(filePath),
    header_footer: false,
    attributes: {
      // Foundry already renders the page title; avoid double titles.
      showtitle: false,
      toc: false,
      sectanchors: false,
    },
  });

  const title = (doc.getDocumentTitle && doc.getDocumentTitle()) || path.basename(filePath, '.adoc');
  const sections = (doc.getSections && doc.getSections()) || [];

  const pages = [];
  if (sections.length) {
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const pageName = (sec.getTitle && sec.getTitle()) || `Section ${i + 1}`;
      let html = rewriteHtmlLinksToUuids(stripFirstHtmlHeading(sec.convert()), { linkIndex });
      html = injectPlainTextUuidLinks(html, { nameIndex });
      pages.push({ name: pageName, html });
    }
  } else {
    let html = rewriteHtmlLinksToUuids(doc.convert(), { linkIndex });
    html = injectPlainTextUuidLinks(html, { nameIndex });
    pages.push({ name: title, html });
  }

  const sourceNote = `<hr/><p><em>Source:</em> ${htmlEscape(relPath)}</p>`;
  pages[pages.length - 1].html = `${pages[pages.length - 1].html}${sourceNote}`;
  return { title, pages };
}

function stripLeadingMarkdownTitle(md, title) {
  const lines = md.split('\n');
  let i = 0;

  // Skip YAML front matter if present.
  if (lines[0] === '---') {
    i++;
    for (; i < lines.length; i++) {
      if (lines[i] === '---') {
        i++;
        break;
      }
    }
  }

  // Remove a leading H1 that matches the extracted title.
  const h1 = /^#\s+(.+?)\s*$/.exec(lines[i] || '');
  if (h1 && title && h1[1].trim().toLowerCase() === title.trim().toLowerCase()) {
    lines.splice(i, 1);
    // Also remove a single blank line immediately after.
    if ((lines[i] || '').trim() === '') lines.splice(i, 1);
  }

  return lines.join('\n');
}

function stripLeadingMarkdownHeading(md, headingText) {
  const lines = md.split('\n');
  let i = 0;

  // Skip YAML front matter if present.
  if (lines[0] === '---') {
    i++;
    for (; i < lines.length; i++) {
      if (lines[i] === '---') {
        i++;
        break;
      }
    }
  }

  const h = /^##\s+(.+?)\s*$/.exec(lines[i] || '');
  if (h && headingText && h[1].trim().toLowerCase() === headingText.trim().toLowerCase()) {
    lines.splice(i, 1);
    if ((lines[i] || '').trim() === '') lines.splice(i, 1);
  }

  return lines.join('\n');
}

function splitMarkdownIntoH2Sections(md) {
  const lines = md.split('\n');
  const sections = [];

  let inFence = false;
  let currentTitle = null;
  let currentLines = [];

  const flush = () => {
    if (!currentTitle) return;
    const body = currentLines.join('\n').trim();
    sections.push({ title: currentTitle, body });
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
    }

    const m = !inFence ? /^##\s+(.+?)\s*$/.exec(line) : null;
    if (m) {
      flush();
      currentTitle = m[1].trim();
      currentLines = [line];
      continue;
    }

    if (currentTitle) currentLines.push(line);
  }

  flush();
  return sections;
}

function convertMarkdownToPages({ filePath, relPath, linkIndex, nameIndex }) {
  const source = readText(filePath);
  const title = extractTitleFromMarkdown(source, path.basename(filePath, '.md'));
  const normalized = stripLeadingMarkdownTitle(source, title);

  const h2Sections = splitMarkdownIntoH2Sections(normalized);

  const pages = [];
  if (h2Sections.length) {
    for (const sec of h2Sections) {
      const body = stripLeadingMarkdownHeading(sec.body, sec.title);
      let html = rewriteHtmlLinksToUuids(marked.parse(body, { gfm: true, breaks: false }), { linkIndex });
      html = injectPlainTextUuidLinks(html, { nameIndex });
      pages.push({ name: sec.title, html });
    }
  } else {
    let html = rewriteHtmlLinksToUuids(marked.parse(normalized, { gfm: true, breaks: false }), { linkIndex });
    html = injectPlainTextUuidLinks(html, { nameIndex });
    pages.push({ name: title, html });
  }

  const sourceNote = `<hr/><p><em>Source:</em> ${htmlEscape(relPath)}</p>`;
  pages[pages.length - 1].html = `${pages[pages.length - 1].html}${sourceNote}`;
  return { title, pages };
}

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

function mkJournalEntry({ name, folderId, seed, pageIds }) {
  const _id = foundryIdFromSeed(seed);
  return {
    name,
    _id,
    pages: pageIds,
    folder: folderId || null,
    categories: [],
    sort: 0,
    ownership: { default: 0 },
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

function mkJournalPage({ name, seed, sort, html }) {
  return {
    sort,
    name,
    type: 'text',
    _id: foundryIdFromSeed(seed),
    system: {},
    title: { show: true, level: 1 },
    image: {},
    text: {
      format: 2,
      markdown: '',
      content: html,
    },
    video: { controls: true, volume: 0.5 },
    src: null,
    category: null,
    ownership: { default: 0 },
    flags: {
      core: {
        sheetClass: 'core.JournalEntryPageMarkdownSheet',
      },
    },
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

async function writeJournalPack({ outDir, journals, pages, folders }) {
  const { ClassicLevel } = require('classic-level');

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const db = new ClassicLevel(outDir, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
  await db.open();

  for (const f of folders) await db.put(`!folders!${f._id}`, JSON.stringify(f));
  for (const j of journals) await db.put(`!journal!${j._id}`, JSON.stringify(j));
  for (const p of pages) await db.put(`!journal.pages!${p.journalId}.${p.page._id}`, JSON.stringify(p.page));

  await db.compactRange('\x00', '\xff');
  await db.close();
}

function buildFolderTree({ relDirPaths }) {
  const folders = [];
  const folderIdByRel = new Map();

  const rootName = 'Svellheim Campaign';
  const rootRel = '';
  const rootId = foundryIdFromSeed(`folder:${PACK_NAME}:${rootRel}:${rootName}`);
  folderIdByRel.set(rootRel, rootId);
  folders.push(mkFolder({ name: rootName, type: 'JournalEntry', folder: null, seed: `folder:${PACK_NAME}:${rootRel}:${rootName}` }));

  // Ensure deterministic ordering.
  const sorted = Array.from(new Set(relDirPaths)).sort((a, b) => a.localeCompare(b));
  for (const rel of sorted) {
    if (!rel) continue;
    const parts = rel.split('/');
    let acc = '';
    for (const part of parts) {
      const next = acc ? `${acc}/${part}` : part;
      if (!folderIdByRel.has(next)) {
        const parentRel = acc;
        const parentId = folderIdByRel.get(parentRel) || rootId;
        const displayName = prettySegment(part);
        const seed = `folder:${PACK_NAME}:${next}`;
        const _id = foundryIdFromSeed(seed);
        folderIdByRel.set(next, _id);
        folders.push(mkFolder({ name: displayName, type: 'JournalEntry', folder: parentId, seed }));
      }
      acc = next;
    }
  }

  return { folders, folderIdByRel, rootId };
}

async function main() {
  if (!fs.existsSync(MODULE_DIR)) {
    console.error(`Missing module dir: ${MODULE_DIR}`);
    process.exit(2);
  }
  if (!fs.existsSync(CAMPAIGN_ROOT)) {
    console.error(`Missing campaign docs dir: ${CAMPAIGN_ROOT}`);
    process.exit(2);
  }

  // Only ship the chapters that are ready for use in Foundry.
  // Everything else is considered WIP and excluded from the journal pack.
  const ALLOWED_TOP_DIRS = new Set(['01-The-World', '02-Character-Options']);

  const { index: linkIndex, nameIndex } = await loadCombinedLinkIndex();
  if (!linkIndex.size) {
    console.warn(
      `Warning: Could not build link index from core Draw Steel packs or ${path.relative(
        REPO_ROOT,
        ORIGINS_PACK_DIR
      )}; journal links will remain as-is.`
    );
  }

  const files = [];
  for (const full of walkFiles(CAMPAIGN_ROOT)) {
    const rel = path.relative(CAMPAIGN_ROOT, full).split(path.sep).join('/');
    if (isHiddenPath(rel)) continue;
    const ext = path.extname(full).toLowerCase();
    if (ext !== '.adoc' && ext !== '.md') continue;
    // Skip the combined include file; we generate per-page journals.
    if (rel === 'svellheim-campaign.adoc') continue;

    const top = rel.split('/')[0];
    if (!ALLOWED_TOP_DIRS.has(top)) continue;

    files.push({ full, rel, ext });
  }

  files.sort((a, b) => a.rel.localeCompare(b.rel));

  const dirPaths = files.map((f) => path.posix.dirname(f.rel)).filter((d) => d !== '.');
  const { folders, folderIdByRel, rootId } = buildFolderTree({ relDirPaths: dirPaths });

  const journals = [];
  const pages = [];

  let pageSort = 0;
  for (const f of files) {
    const dirRel = path.posix.dirname(f.rel);
    const folderId = dirRel === '.' ? rootId : folderIdByRel.get(dirRel) || rootId;

    const conv =
      f.ext === '.adoc'
        ? convertAdocToPages({ filePath: f.full, relPath: `campaign/docs/${f.rel}`, linkIndex, nameIndex })
        : convertMarkdownToPages({ filePath: f.full, relPath: `campaign/docs/${f.rel}`, linkIndex, nameIndex });

    const journalSeed = `journal:${PACK_NAME}:${f.rel}`;
    const journalId = foundryIdFromSeed(journalSeed);

    const pageDocs = [];
    for (let i = 0; i < conv.pages.length; i++) {
      const p = conv.pages[i];
      const pageSeed = `journalPage:${PACK_NAME}:${f.rel}:${i}:${p.name}`;
      const page = mkJournalPage({ name: p.name, seed: pageSeed, sort: pageSort, html: p.html });
      pageSort += 10_000;
      pageDocs.push(page);
      pages.push({ journalId, page });
    }

    const entry = mkJournalEntry({ name: conv.title, folderId, seed: journalSeed, pageIds: pageDocs.map((p) => p._id) });
    entry._id = journalId;
    journals.push(entry);
  }

  await writeJournalPack({ outDir: PACK_DIR, journals, pages, folders });

  console.log(
    `Wrote ${journals.length} journal entries, ${pages.length} pages, and ${folders.length} folders to ${path.relative(
      REPO_ROOT,
      PACK_DIR
    )}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
