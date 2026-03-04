#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();

const MODULE_ID = 'svellheim';
const MODULE_DIR = path.join(REPO_ROOT, 'module');

// Cross-repo: reads pantheon source from Era-of-Embers sibling repo
const PANTHEON_ADOC = path.join(REPO_ROOT, '..', 'Era-of-Embers', 'campaign', 'docs', '01-The-World', '03-Pantheon', '01-The-Pantheon.adoc');

const OUT_PATH = path.join(MODULE_DIR, 'data', 'faith.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseDomainsCell(cell) {
  // Cell looks like: "**Death, Runes*, Trickery, War**"
  const bold = /\*\*(.+?)\*\*/.exec(cell);
  const raw = (bold ? bold[1] : cell).trim();
  if (!raw) return [];

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((d) => {
      // Strip asterisk markers (e.g. Runes*, Vengeance***).
      const label = d.replace(/\*+/g, '').trim();
      return { id: slugify(label), label };
    });
}

function parsePantheon(adoc) {
  const lines = adoc.split('\n');

  const gods = [];
  const domainsById = new Map();

  let currentGroup = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const group = /^==\s+(.+?)\s*$/.exec(line);
    if (group) {
      currentGroup = group[1].trim();
      continue;
    }

    const godHeader = /^===\s+(.+?)\s*$/.exec(line);
    if (!godHeader) continue;

    const headerText = godHeader[1].trim();
    const m = /^(.+?)\s*\((.+)\)\s*$/.exec(headerText);
    const name = (m ? m[1] : headerText).trim();
    const epithet = (m ? m[2] : '').trim();

    // Optional italic subtitle on the following line.
    const next = (lines[i + 1] || '').trim();
    const subtitle = /^_(.+)_$/.exec(next)?.[1]?.trim() || '';

    // Scan forward until next god or group for the Domains row.
    let domains = [];
    let sawDomainsRow = false;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^===\s+/.test(l) || /^==\s+/.test(l)) break;

      const dm = /^\|\s*Domains\s*\|\s*(.+?)\s*$/.exec(l);
      if (dm) {
        domains = parseDomainsCell(dm[1]);
        sawDomainsRow = true;
        break;
      }
    }

    // Only include actual deities: we require an explicit Domains table row.
    // This avoids accidentally treating domain reference sections as gods.
    if (!sawDomainsRow || !domains.length) continue;

    for (const d of domains) {
      if (!d.id) continue;
      if (!domainsById.has(d.id)) domainsById.set(d.id, { id: d.id, label: d.label });
    }

    gods.push({
      id: slugify(name),
      name,
      epithet,
      subtitle,
      group: currentGroup,
      domains: domains.map((d) => ({ id: d.id, label: d.label })),
    });
  }

  const domains = Array.from(domainsById.values()).sort((a, b) => a.label.localeCompare(b.label));
  gods.sort((a, b) => a.name.localeCompare(b.name));

  return { gods, domains };
}

function main() {
  if (!fs.existsSync(MODULE_DIR)) {
    console.error(`Missing module dir: ${MODULE_DIR}`);
    process.exit(2);
  }
  if (!fs.existsSync(PANTHEON_ADOC)) {
    console.error(`Missing pantheon doc: ${PANTHEON_ADOC}`);
    process.exit(2);
  }

  const adoc = readText(PANTHEON_ADOC);
  const { gods, domains } = parsePantheon(adoc);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        source: 'campaign/docs/01-The-World/03-Pantheon/01-The-Pantheon.adoc',
        generatedAt: new Date().toISOString(),
        gods,
        domains,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log(`Wrote ${gods.length} gods and ${domains.length} domains to ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

main();
