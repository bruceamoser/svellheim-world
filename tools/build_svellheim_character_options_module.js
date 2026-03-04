#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = process.cwd();

const MODULE_ID = 'svellheim';
const PACK_NAME = 'svellheim-origins';
const PACK_DIR = path.join(REPO_ROOT, 'module', 'packs', 'svellheim-origins');
const MODULE_DATA_DIR = path.join(REPO_ROOT, 'module', 'data');

const MODULE_ASSET_BASE = `modules/${MODULE_ID}/assets/icons`;
const TYPE_DEFAULT_ICONS = {
  ancestry: `${MODULE_ASSET_BASE}/ancestry.svg`,
  ancestryTrait: `${MODULE_ASSET_BASE}/trait.svg`,
  culture: `${MODULE_ASSET_BASE}/culture.svg`,
  career: `${MODULE_ASSET_BASE}/career.svg`,
};

const ENTRY_ICONS = {
  ancestry: {
    hearthborn: `${MODULE_ASSET_BASE}/ancestries/hearthborn.svg`,
    deepforged: `${MODULE_ASSET_BASE}/ancestries/deepforged.svg`,
    ashmarked: `${MODULE_ASSET_BASE}/ancestries/ashmarked.svg`,
    cragbound: `${MODULE_ASSET_BASE}/ancestries/cragbound.svg`,
    tonttu: `${MODULE_ASSET_BASE}/ancestries/tonttu.svg`,
    lumenkin: `${MODULE_ASSET_BASE}/ancestries/lumenkin.svg`,
    veilfolk: `${MODULE_ASSET_BASE}/ancestries/veilfolk.svg`,
    ormsbani: `${MODULE_ASSET_BASE}/ancestries/ormsbani.svg`,
    barrowbound: `${MODULE_ASSET_BASE}/ancestries/barrowbound.svg`,
    cinderbound: `${MODULE_ASSET_BASE}/ancestries/cinderbound.svg`,
  },
  culture: {
    'singing-island-vent-garden-circle': `${MODULE_ASSET_BASE}/cultures/singing-island-vent-garden-circle.svg`,
    'iron-bog-stilt-camp': `${MODULE_ASSET_BASE}/cultures/iron-bog-stilt-camp.svg`,
    'ashen-front-charcoal-company': `${MODULE_ASSET_BASE}/cultures/ashen-front-charcoal-company.svg`,
    'bone-field-firekeepers': `${MODULE_ASSET_BASE}/cultures/bone-field-firekeepers.svg`,
  },
  career: {
    'watcher-and-listener': `${MODULE_ASSET_BASE}/careers/watcher-and-listener.svg`,
    maker: `${MODULE_ASSET_BASE}/careers/maker.svg`,
    boathand: `${MODULE_ASSET_BASE}/careers/boathand.svg`,
    'ledger-keeper': `${MODULE_ASSET_BASE}/careers/ledger-keeper.svg`,
    'lantern-runner': `${MODULE_ASSET_BASE}/careers/lantern-runner.svg`,
    cutpurse: `${MODULE_ASSET_BASE}/careers/cutpurse.svg`,
    freeholder: `${MODULE_ASSET_BASE}/careers/freeholder.svg`,
    huscarl: `${MODULE_ASSET_BASE}/careers/huscarl.svg`,
    'bone-mender': `${MODULE_ASSET_BASE}/careers/bone-mender.svg`,
    'weald-stalker': `${MODULE_ASSET_BASE}/careers/weald-stalker.svg`,
    'ore-hand': `${MODULE_ASSET_BASE}/careers/ore-hand.svg`,
    outrider: `${MODULE_ASSET_BASE}/careers/outrider.svg`,
    'rune-reader': `${MODULE_ASSET_BASE}/careers/rune-reader.svg`,
    'red-rivet-hand': `${MODULE_ASSET_BASE}/careers/red-rivet-hand.svg`,
    'lore-keeper': `${MODULE_ASSET_BASE}/careers/lore-keeper.svg`,
  },
};

function iconForEntry({ type, dsid, name }) {
  const slug = dsid || slugify(name || '');
  const direct = ENTRY_ICONS?.[type]?.[slug];
  if (direct) return direct;
  return TYPE_DEFAULT_ICONS[type] || 'icons/svg/book.svg';
}

const ANCESTRIES_DOC = path.join(
  REPO_ROOT,
  'campaign',
  'docs',
  '02-Character-Options',
  '01-Ancestries',
  '01-Peoples-of-the-Ice.adoc'
);

const CULTURES_DOC = path.join(
  REPO_ROOT,
  'campaign',
  'docs',
  '02-Character-Options',
  '04-Backgrounds',
  '01-Cultures',
  '01-Overview.adoc'
);

const CAREERS_DIR = path.join(
  REPO_ROOT,
  'campaign',
  'docs',
  '02-Character-Options',
  '04-Backgrounds',
  '02-Careers',
  '01-Base-Careers'
);

const LANGUAGES_DOC = path.join(
  REPO_ROOT,
  'campaign',
  'docs',
  '01-The-World',
  '06-Society',
  '02-Languages.adoc'
);

function slugify(input) {
  return input
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

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function base62FromBuffer(buf, length) {
  // Convert to BigInt then base62 encode.
  let n = BigInt('0x' + buf.toString('hex'));
  if (n === 0n) return '0'.repeat(length);
  let out = '';
  while (n > 0n) {
    const r = n % 62n;
    out = BASE62_ALPHABET[Number(r)] + out;
    n = n / 62n;
  }
  // Pad or trim to requested length.
  if (out.length < length) out = out.padStart(length, '0');
  if (out.length > length) out = out.slice(0, length);
  return out;
}

function foundryIdFromSlug(slug) {
  // Foundry IDs are typically 16 chars [A-Za-z0-9].
  const digest = crypto.createHash('sha1').update(slug).digest();
  return base62FromBuffer(digest.subarray(0, 12), 16);
}

function htmlP(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped}</p>`;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function parseBulletValue(line) {
  // Example: "*   **Budget:** 3 Points"
  const m = /\*\*([^*]+):\*\*\s*(.+)\s*$/.exec(line);
  return m ? { key: m[1].trim(), value: m[2].trim() } : null;
}

function parseAncestries(adocText) {
  const lines = adocText.split('\n');

  const ancestries = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const header = /^===\s+(.+?)\s*(?:\((.+?)\))?\s*$/.exec(line);
    if (!header) continue;

    const displayName = header[1].trim();
    const parenthetical = header[2] ? header[2].trim() : null;

    const record = {
      name: displayName,
      subtitle: parenthetical,
      stereotype: null,
      size: null,
      speed: null,
      stability: null,
      budgetPoints: null,
      signatureTrait: null,
      purchasedTraits: [],
    };

    // Scan forward until next ancestry header or section boundary.
    let j = i + 1;

    // Parse the bullet stats block.
    // Stop once we reach the Signature Trait section, so we don't skip past it.
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (/^===\s+/.test(l) || /^==\s+/.test(l)) break;
      if (/^\.Signature Trait:/.test(l) || /^\.Purchased Traits\s*$/.test(l)) break;
      if (!/^\*\s+\*\*/.test(l)) continue;
      const kv = parseBulletValue(l);
      if (!kv) continue;
      if (kv.key === 'Stereotype') record.stereotype = kv.value.replace(/^\"|\"$/g, '');
      if (kv.key === 'Size') {
        // Example: "1M | **Speed:** 5 | **Stability:** 0"
        // We just keep the full value and parse pieces lightly.
        record.size = kv.value.split('|')[0].trim();
        const speedM = /\*\*Speed:\*\*\s*(\d+)/.exec(kv.value);
        const stabM = /\*\*Stability:\*\*\s*(-?\d+)/.exec(kv.value);
        if (speedM) record.speed = Number(speedM[1]);
        if (stabM) record.stability = Number(stabM[1]);
      }
      if (kv.key === 'Budget') {
        const m = /(\d+)/.exec(kv.value);
        record.budgetPoints = m ? Number(m[1]) : null;
      }
    }

    // Find signature trait paragraph and purchased trait table.
    // Signature block starts with ".Signature Trait:" line.
    let sigName = null;
    let sigTextLines = [];
    let inSig = false;

    for (; j < lines.length; j++) {
      const l = lines[j];
      if (/^===\s+/.test(l) || /^==\s+/.test(l)) break;

      const sig = /^\.Signature Trait:\s*(.+)\s*$/.exec(l);
      if (sig) {
        sigName = sig[1].trim();
        inSig = true;
        continue;
      }

      if (inSig) {
        if (/^\.Purchased Traits\s*$/.test(l)) {
          inSig = false;
          break;
        }
        if (l.trim() === '') continue;
        // Stop if we hit the Purchased Traits marker even if it isn't the exact dot-prefixed line.
        if (/^\.Purchased Traits/.test(l)) {
          inSig = false;
          break;
        }
        sigTextLines.push(l.trim());
      }
    }

    if (sigName) {
      record.signatureTrait = {
        name: sigName,
        description: sigTextLines.join('\n'),
      };
    }

    // Continue from current j to locate purchased trait table.
    // In this repo's AsciiDoc, the table rows are single-line: "| 1 | **Trait:** description".
    while (j < lines.length && !/^\.Purchased Traits\s*$/.test(lines[j])) {
      if (/^===\s+/.test(lines[j]) || /^==\s+/.test(lines[j])) break;
      j++;
    }

    // Scan for table start.
    while (j < lines.length && lines[j].trim() !== '|===') {
      if (/^===\s+/.test(lines[j]) || /^==\s+/.test(lines[j])) break;
      j++;
    }

    if (j < lines.length && lines[j].trim() === '|===') {
      j++; // after |===
      for (; j < lines.length; j++) {
        const l = lines[j].trim();
        if (l === '|===') break;
        if (!l.startsWith('|')) continue;
        if (l.includes('**Cost**') && l.includes('**Trait**')) continue;

        // Example: "| 1 | **Can't Take Hold:** Ignore ..."
        // Split on '|' and drop empty edges.
        const parts = l
          .split('|')
          .map((p) => p.trim())
          .filter((p) => p.length);
        if (parts.length < 2) continue;

        const cost = Number.parseInt(parts[0], 10);
        const rawTrait = parts.slice(1).join(' | ');

        // Handle both of these common patterns:
        // - "**Name**: description"
        // - "**Name:** description" (colon inside bold)
        let name = rawTrait;
        let desc = '';
        let nameM = /^\*\*(.+?)\*\*:\s*(.+)$/.exec(rawTrait);
        if (!nameM) nameM = /^\*\*(.+?):\*\*\s*(.+)$/.exec(rawTrait);
        if (nameM) {
          name = nameM[1].trim();
          desc = nameM[2].trim();
        } else {
          const simplified = rawTrait.replace(/\*\*/g, '');
          const splitM = /^([^:]+):\s*(.+)$/.exec(simplified);
          if (splitM) {
            name = splitM[1].trim();
            desc = splitM[2].trim();
          } else {
            name = simplified.trim();
          }
        }

        if (!Number.isNaN(cost) && name) record.purchasedTraits.push({ name, points: cost, description: desc });
      }
    }

    // Keep record if it has a budget and signature trait.
    if (record.budgetPoints != null && record.signatureTrait) ancestries.push(record);

    i = j;
  }

  return ancestries;
}

function parseCultureTemplates(adocText) {
  // Only parse "Svellheim-Unique Culture Templates" entries.
  const lines = adocText.split('\n');
  const templates = [];

  let inTemplates = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '== Svellheim-Unique Culture Templates') inTemplates = true;
    if (!inTemplates) continue;

    const header = /^===\s+(.+?)\s*$/.exec(l);
    if (!header) continue;

    const name = header[1].trim();
    const entry = { name, language: null, environment: null, organization: null, upbringing: null, blurb: '' };

    // Blurb line(s) until bullet list.
    let j = i + 1;
    const blurbLines = [];
    for (; j < lines.length; j++) {
      const x = lines[j];
      if (/^===\s+/.test(x) || /^==\s+/.test(x)) break;
      if (x.trim().startsWith('- *Language*') || x.trim().startsWith('- *Environment*')) break;
      if (x.trim() === '') continue;
      blurbLines.push(x.trim());
    }
    entry.blurb = blurbLines.join(' ');

    for (; j < lines.length; j++) {
      const x = lines[j].trim();
      if (/^===\s+/.test(x) || /^==\s+/.test(x)) break;
      const m = /^-\s+\*([^*]+)\*:\s*(.+)\s*$/.exec(x);
      if (!m) continue;
      const key = m[1].trim();
      const value = m[2].trim();
      if (key === 'Language') entry.language = value;
      if (key === 'Environment') entry.environment = value;
      if (key === 'Organization') entry.organization = value;
      if (key === 'Upbringing') entry.upbringing = value;
    }

    if (entry.language && entry.environment && entry.organization && entry.upbringing) templates.push(entry);
    // j currently points at the next section header (or boundary). Set i so the loop
    // will process that header next.
    i = j - 1;
  }

  return templates;
}

function listCareerFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.adoc'))
    .map((e) => path.join(dir, e.name))
    .sort();
}

function parseCareer(adocText) {
  const lines = adocText.split('\n');
  const title = lines.find((l) => l.startsWith('= '));
  const name = title ? title.replace(/^=\s+/, '').trim() : 'Career';

  // Benefits block keys we care about.
  const benefits = {
    skills: null,
    languages: null,
    renown: 0,
    wealth: 0,
    projectPoints: 0,
    perk: null,
    perkType: null,
  };

  let inBenefits = false;
  for (const l of lines) {
    if (l.trim() === '== Career Benefits') {
      inBenefits = true;
      continue;
    }
    if (inBenefits && l.startsWith('== ')) break;
    if (!inBenefits) continue;

    const m = /^\*\s+\*([^*]+)\*:\s*(.+)\s*$/.exec(l.trim());
    if (!m) continue;

    const key = m[1].trim();
    const value = m[2].trim();

    if (key === 'Skills') benefits.skills = value;
    if (key === 'Languages') benefits.languages = value;
    if (key === 'Renown') {
      const n = /([+-]?\d+)/.exec(value);
      benefits.renown = n ? Number(n[1]) : 0;
    }
    if (key === 'Wealth') {
      const n = /([+-]?\d+)/.exec(value);
      benefits.wealth = n ? Number(n[1]) : 0;
    }
    if (key === 'Project Points') {
      const n = /(\d+)/.exec(value);
      benefits.projectPoints = n ? Number(n[1]) : 0;
    }
    if (key.startsWith('Perk')) {
      // Example: "Perk (Intrigue)*: *Forgettable Face*. ..."
      benefits.perk = value;
      const pt = /\(([^)]+)\)/.exec(key);
      benefits.perkType = pt ? pt[1].trim().toLowerCase() : null;
    }
  }

  // Create a simple description from intro paragraph + benefits.
  const introLines = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === '' || l.startsWith('==')) break;
    if (l.startsWith('=')) continue;
    introLines.push(l);
  }

  const descriptionParts = [];
  if (introLines.length) descriptionParts.push(htmlP(introLines.join(' ')));

  // Keep a short summary; detailed skill/perk logic is expressed via advancements.
  if (benefits.skills) descriptionParts.push(htmlP(`Skills: ${benefits.skills}`));
  if (benefits.languages) descriptionParts.push(htmlP(`Languages: ${benefits.languages}`));
  descriptionParts.push(htmlP(`Renown: ${benefits.renown}; Wealth: ${benefits.wealth}; Project Points: ${benefits.projectPoints}`));
  if (benefits.perk) descriptionParts.push(htmlP(`Perk: ${benefits.perk}`));

  return { name, benefits, descriptionHtml: descriptionParts.join('') };
}

function mkItemBase({ name, type, dsid, img, descriptionHtml }) {
  const slug = dsid || slugify(name);
  const _id = foundryIdFromSlug(`${type}:${slug}`);

  return {
    _id,
    name,
    type,
    img: img || iconForEntry({ type, dsid: slug, name }) || 'icons/svg/book.svg',
    system: {
      description: {
        value: descriptionHtml || '',
        director: '',
      },
      source: {
        book: 'Svellheim Campaign',
        page: '',
        license: 'Homebrew',
      },
      _dsid: slug,
      advancements: {},
    },
    effects: [],
    folder: null,
    sort: 0,
    ownership: {
      default: 0,
    },
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

function mkEffectBase({ name, origin, img, changes, disabled = false, description = '' }) {
  return {
    name,
    origin,
    img,
    disabled,
    _id: foundryIdFromSlug(`effect:${origin}:${name}`),
    type: 'base',
    system: {
      end: {
        type: '',
        roll: '1d10 + @combat.save.bonus',
      },
    },
    changes,
    duration: {
      startTime: null,
      combat: null,
      seconds: null,
      rounds: null,
      turns: null,
      startRound: null,
      startTurn: null,
    },
    description,
    tint: '#ffffff',
    transfer: true,
    statuses: [],
    sort: 0,
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

function autoEffectsForAncestryTrait({ traitItem, rawText }) {
  if (!rawText) return [];
  const lower = String(rawText).toLowerCase();

  const changes = [];

  // Damage immunities (Draw Steel uses boolean-ish "1" to enable level-scaling immunities in several official traits).
  if (lower.includes('immun')) {
    const damageTypes = ['acid', 'cold', 'corruption', 'fire', 'lightning', 'poison', 'psychic'];
    const found = [];
    for (const t of damageTypes) {
      if (new RegExp(`\\b${t}\\b`, 'i').test(lower)) found.push(t);
    }

    // If the text implies the player chooses ONE type, don't grant all; generate one default and
    // add a director note so it can be customized in Foundry.
    const impliesChoice = /\bone\s+(?:of|type)\b/i.test(lower) || /\bchoose\s+one\b/i.test(lower);
    const toApply = impliesChoice && found.length > 1 ? [found[0]] : found;

    for (const t of toApply) {
      changes.push({ key: `system.damage.immunities.${t}`, mode: 4, value: '1', priority: null });
    }

    if (impliesChoice && found.length > 1) {
      traitItem.system.description.director = htmlP(
        `This trait grants immunity to ONE damage type. The generated effect defaults to ${toApply[0]}; edit the effect to match the chosen type.`
      );
    }
  }

  // Weaknesses (e.g., "fire weakness 5").
  {
    const m1 = /\b([a-z]+)\s+weakness\s+(\d+)\b/i.exec(lower);
    const m2 = /\bweakness\s+(\d+)\s+to\s+([a-z]+)\b/i.exec(lower);
    const m = m1 || m2;
    if (m) {
      const type = m1 ? m1[1] : m2[2];
      const value = m1 ? m1[2] : m2[1];
      if (type && value) changes.push({ key: `system.damage.weaknesses.${type}`, mode: 4, value: String(value), priority: null });
    }
  }

  // Speed modifications.
  {
    const add = /\+(\d+)\s*speed\b/i.exec(lower);
    if (add) {
      changes.push({ key: 'system.movement.value', mode: 2, value: String(add[1]), priority: null });
    } else {
      const set = /\bspeed\s+(\d+)\b/i.exec(lower);
      if (set) {
        changes.push({ key: 'system.movement.value', mode: 5, value: String(set[1]), priority: null });
      }
    }
  }

  if (!changes.length) return [];

  const origin = mkUuidForId(traitItem._id);
  const effect = mkEffectBase({
    name: traitItem.name,
    origin,
    img: traitItem.img,
    changes,
  });
  traitItem.effects = [effect._id];
  return [{ itemId: traitItem._id, effect }];
}

function mkFolderBase({ name, parentId = null, sorting = 'a', sort = 0 }) {
  const slug = slugify(name);
  const parentPart = parentId ? parentId : 'root';
  const _id = foundryIdFromSlug(`folder:${parentPart}:${slug}`);

  return {
    type: 'Item',
    folder: parentId,
    name,
    color: null,
    sorting,
    _id,
    description: '',
    sort,
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

function mkUuidForId(itemId) {
  return `Compendium.${MODULE_ID}.${PACK_NAME}.Item.${itemId}`;
}

function mkAncestryFromParsed(parsed) {
  const ancestrySlug = slugify(parsed.name);

  // Signature trait item
  const sigTrait = mkItemBase({
    name: parsed.signatureTrait.name,
    type: 'ancestryTrait',
    dsid: `${ancestrySlug}-${slugify(parsed.signatureTrait.name)}`,
    descriptionHtml: htmlP(parsed.signatureTrait.description || ''),
  });
  sigTrait.system.points = null;

  const sigEffects = autoEffectsForAncestryTrait({ traitItem: sigTrait, rawText: parsed.signatureTrait.description || '' });

  // Purchased trait items
  const purchased = parsed.purchasedTraits.map((t) => {
    const trait = mkItemBase({
      name: t.name,
      type: 'ancestryTrait',
      dsid: `${ancestrySlug}-${slugify(t.name)}`,
      descriptionHtml: htmlP(t.description || ''),
    });
    trait.system.points = t.points;

    const fx = autoEffectsForAncestryTrait({ traitItem: trait, rawText: t.description || '' });
    trait._generatedEffects = fx;
    return trait;
  });

  // Ancestry item
  const ancestryDesc = [
    parsed.subtitle ? htmlP(parsed.subtitle) : '',
    parsed.stereotype ? htmlP(`Stereotype: ${parsed.stereotype}`) : '',
    parsed.size || parsed.speed != null || parsed.stability != null
      ? htmlP(`Size: ${parsed.size || ''}; Speed: ${parsed.speed ?? ''}; Stability: ${parsed.stability ?? ''}`)
      : '',
  ].join('');

  const ancestry = mkItemBase({
    name: parsed.name,
    type: 'ancestry',
    dsid: ancestrySlug,
    img: iconForEntry({ type: 'ancestry', dsid: ancestrySlug, name: parsed.name }),
    descriptionHtml: ancestryDesc,
  });

  // Advancements for DS character creator.
  const sigAdvId = foundryIdFromSlug(`adv:${ancestrySlug}:signature`);
  ancestry.system.advancements[sigAdvId] = {
    name: 'Signature Trait',
    img: 'icons/magic/death/grave-tombstone-glow-tan.webp',
    type: 'itemGrant',
    requirements: { level: null },
    _id: sigAdvId,
    pool: [{ uuid: mkUuidForId(sigTrait._id) }],
  };

  const purchAdvId = foundryIdFromSlug(`adv:${ancestrySlug}:purchased`);
  ancestry.system.advancements[purchAdvId] = {
    name: 'Purchased Traits',
    img: 'icons/skills/social/trading-injustice-scale-gray.webp',
    type: 'itemGrant',
    requirements: { level: null },
    _id: purchAdvId,
    description: htmlP(`You have ${parsed.budgetPoints} ancestry points to spend on the following traits.`),
    additional: { type: 'ancestryTrait' },
    pool: purchased.map((t) => ({ uuid: mkUuidForId(t._id) })),
    chooseN: parsed.budgetPoints,
  };

  const effects = [];
  for (const x of sigEffects) effects.push(x);
  for (const t of purchased) {
    if (t._generatedEffects) effects.push(...t._generatedEffects);
    delete t._generatedEffects;
  }

  return { ancestry, sigTrait, purchasedTraits: purchased, effects };
}

function mkCultureFromTemplate(tpl) {
  const cultureSlug = slugify(tpl.name);
  const desc = [
    tpl.blurb ? htmlP(tpl.blurb) : '',
    htmlP(`Language: ${tpl.language}`),
    htmlP(`Environment: ${tpl.environment}; Organization: ${tpl.organization}; Upbringing: ${tpl.upbringing}`),
  ].join('');

  const culture = mkItemBase({
    name: tpl.name,
    type: 'culture',
    dsid: cultureSlug,
    img: iconForEntry({ type: 'culture', dsid: cultureSlug, name: tpl.name }),
    descriptionHtml: desc,
  });

  // Culture schema mirrors Draw Steel: language + 3 skill picks.
  // We keep this permissive (no hardcoded language IDs) to avoid mismatches with system registries.
  culture.system.advancements['anyLang000000000'] = {
    type: 'language',
    chooseN: 1,
    name: 'Language',
    description: htmlP(`Choose the culture language (${tpl.language}).`),
    requirements: { level: null },
    _id: 'anyLang000000000',
    img: null,
    languages: [slugify(tpl.language)],
  };

  const aspectToGroups = {
    nomadic: ['exploration', 'interpersonal'],
    rural: ['crafting', 'lore'],
    secluded: ['interpersonal', 'lore'],
    urban: ['interpersonal', 'intrigue'],
    wilderness: ['crafting', 'exploration'],
    bureaucratic: ['interpersonal', 'intrigue'],
    communal: ['crafting', 'exploration'],
    academic: ['lore'],
    creative: ['crafting', 'interpersonal'],
    labor: ['crafting', 'exploration', 'interpersonal'],
    lawless: ['intrigue'],
    martial: ['crafting', 'exploration', 'interpersonal', 'intrigue', 'lore'],
    noble: ['interpersonal'],
  };

  const envGroups = aspectToGroups[tpl.environment.toLowerCase()] || ['interpersonal'];
  const orgGroups = aspectToGroups[tpl.organization.toLowerCase()] || ['interpersonal'];
  const upGroups = aspectToGroups[tpl.upbringing.toLowerCase()] || ['interpersonal'];

  const mkSkillAdv = (id, name, groups) => ({
    type: 'skill',
    name,
    chooseN: 1,
    skills: { groups, choices: [] },
    _id: id,
  });

  // Use stable IDs so updates don't churn.
  culture.system.advancements[foundryIdFromSlug(`cult:${cultureSlug}:env`)] = mkSkillAdv(
    foundryIdFromSlug(`cult:${cultureSlug}:env`),
    'Environment',
    envGroups
  );
  culture.system.advancements[foundryIdFromSlug(`cult:${cultureSlug}:org`)] = mkSkillAdv(
    foundryIdFromSlug(`cult:${cultureSlug}:org`),
    'Organization',
    orgGroups
  );
  culture.system.advancements[foundryIdFromSlug(`cult:${cultureSlug}:up`)] = mkSkillAdv(
    foundryIdFromSlug(`cult:${cultureSlug}:up`),
    'Upbringing',
    upGroups
  );

  return culture;
}

function mkCareerFromParsed(parsedCareer) {
  const slug = slugify(parsedCareer.name);
  const career = mkItemBase({
    name: parsedCareer.name,
    type: 'career',
    dsid: slug,
    img: iconForEntry({ type: 'career', dsid: slug, name: parsedCareer.name }),
    descriptionHtml: parsedCareer.descriptionHtml,
  });

  // Required scalar fields for DS careers.
  career.system.projectPoints = parsedCareer.benefits.projectPoints || 0;
  career.system.renown = parsedCareer.benefits.renown || 0;
  career.system.wealth = parsedCareer.benefits.wealth || 0;

  // Skill selection: the campaign docs often list 2-3 suggested skills.
  // We express this as a pick from groups to keep compatibility with system skill IDs.
  const skillAdvId = foundryIdFromSlug(`car:${slug}:skills`);
  career.system.advancements[skillAdvId] = {
    name: 'Skills',
    img: null,
    type: 'skill',
    requirements: { level: null },
    _id: skillAdvId,
    chooseN: 2,
    skills: {
      groups: ['interpersonal', 'intrigue', 'exploration', 'crafting', 'lore'],
    },
  };

  const langAdvId = foundryIdFromSlug(`car:${slug}:lang`);
  career.system.advancements[langAdvId] = {
    name: 'Language',
    img: null,
    type: 'language',
    requirements: { level: null },
    _id: langAdvId,
    chooseN: 1,
  };

  // Perk pick (if specified).
  const perkType = parsedCareer.benefits.perkType || null;
  if (perkType) {
    const perkAdvId = foundryIdFromSlug(`car:${slug}:perk`);
    career.system.advancements[perkAdvId] = {
      name: 'Perk',
      img: 'icons/magic/symbols/fleur-de-lis-yellow.webp',
      type: 'itemGrant',
      requirements: { level: null },
      _id: perkAdvId,
      chooseN: 1,
      description: htmlP(`One ${perkType} perk.`),
      additional: {
        type: 'perk',
        perkType: [perkType],
      },
    };
  }

  return career;
}

async function writeLevelDb(items, outDir) {
  // Foundry v11+ uses a LevelDB folder for compendium packs.
  // This matches the structure we extracted from reference/draw-steel-packs/* packs.
  const { ClassicLevel } = require('classic-level');

  // Clean output to avoid stale documents.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const db = new ClassicLevel(outDir, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
  await db.open();

  for (const item of items) await db.put(`!items!${item._id}`, JSON.stringify(item));

  await db.compactRange('\x00', '\xff');
  await db.close();
}

async function writeLevelDbWithFolders({ items, folders, effects }, outDir) {
  const { ClassicLevel } = require('classic-level');

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const db = new ClassicLevel(outDir, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
  await db.open();

  for (const folder of folders) {
    await db.put(`!folders!${folder._id}`, JSON.stringify(folder));
  }
  for (const item of items) {
    await db.put(`!items!${item._id}`, JSON.stringify(item));
  }
  for (const e of effects || []) {
    await db.put(`!items.effects!${e.itemId}.${e.effect._id}`, JSON.stringify(e.effect));
  }

  await db.compactRange('\x00', '\xff');
  await db.close();
}

function parseLanguagesFromDoc(adocText) {
  const lines = adocText.split('\n');
  const names = [];

  // Ensure Svellspraak is included if referenced.
  if (/\*\*Svellspraak\*\*/.test(adocText) || /\bsvellspraak\b/i.test(adocText)) names.push('Svellspraak');

  let inLanguageLists = false;
  for (const l of lines) {
    const t = l.trim();

    const h2 = /^==\s+(.+?)\s*$/.exec(t);
    if (h2) {
      const title = h2[1];
      inLanguageLists = title === 'Ancestral Languages' || title === 'Regional Dialects';
      continue;
    }

    if (!inLanguageLists) continue;

    const m = /^-\s+\*\*([^*]+?)\*\*/.exec(t);
    if (!m) continue;
    const raw = m[1].trim();
    const cleaned = raw.replace(/[:\s]+$/g, '').trim();
    if (cleaned) names.push(cleaned);
  }

  // De-dup (case-insensitive).
  const seen = new Set();
  const out = [];
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

function buildLanguageMap(languageNames) {
  const toDisplayCase = (label) => {
    if (!label) return label;
    // If it's already mixed/upper case, keep it. Otherwise title-case words.
    if (label !== label.toLowerCase()) return label;
    return label
      .split(/(\s+|[-–—])/g)
      .map((part) => {
        if (!part || /^\s+$/.test(part) || /^[-–—]$/.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join('');
  };

  const map = {};
  for (const name of languageNames) {
    let id = slugify(name);
    if (!id) continue;
    if (map[id]) {
      let i = 2;
      while (map[`${id}-${i}`]) i++;
      id = `${id}-${i}`;
    }
    map[id] = toDisplayCase(name);
  }
  return map;
}

function parseBuildArgs(argv) {
  const args = {
    sections: ['ancestries', 'cultures', 'careers'],
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sections') {
      args.sections = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  // Normalize
  args.sections = Array.from(new Set(args.sections.map((s) => s.toLowerCase())));
  return args;
}

function buildUsage() {
  return [
    'Build the Svellheim character options compendium (LevelDB pack folder).',
    '',
    'Usage:',
    '  node tools/build_svellheim_character_options_module.js [--sections ancestries,cultures,careers]',
    '',
    'Examples:',
    '  node tools/build_svellheim_character_options_module.js',
    '  node tools/build_svellheim_character_options_module.js --sections ancestries',
    '  node tools/build_svellheim_character_options_module.js --sections ancestries,cultures',
    '',
    'Notes:',
    '  - The output pack is rebuilt from scratch each run (it overwrites the pack folder).',
    '  - "ancestries" includes ancestry items and their ancestryTrait items.',
  ].join('\n');
}

async function main() {
  const args = parseBuildArgs(process.argv);
  if (args.help) {
    console.log(buildUsage());
    return;
  }

  const include = {
    ancestries: args.sections.includes('ancestries'),
    cultures: args.sections.includes('cultures'),
    careers: args.sections.includes('careers'),
  };

  const folders = [];
  const items = [];
  const effects = [];

  let parsedAncestries = [];
  let cultureTemplates = [];
  let careerFiles = [];

  // Folder skeleton (mirrors Draw Steel's origins pack layout).
  let ancestriesRoot = null;
  let backgroundsRoot = null;
  let culturesFolder = null;
  let careersFolder = null;

  if (include.ancestries) {
    if (!fs.existsSync(ANCESTRIES_DOC)) {
      console.error(`Missing ancestries doc: ${ANCESTRIES_DOC}`);
      process.exit(2);
    }
    ancestriesRoot = mkFolderBase({ name: 'Ancestries', parentId: null, sorting: 'a', sort: 600000 });
    folders.push(ancestriesRoot);
  }

  if (include.cultures || include.careers) {
    backgroundsRoot = mkFolderBase({ name: 'Backgrounds', parentId: null, sorting: 'a', sort: 800000 });
    folders.push(backgroundsRoot);

    if (include.careers) {
      careersFolder = mkFolderBase({
        name: 'Careers',
        parentId: backgroundsRoot._id,
        sorting: 'a',
        sort: 100000,
      });
      folders.push(careersFolder);
    }
    if (include.cultures) {
      culturesFolder = mkFolderBase({
        name: 'Cultures',
        parentId: backgroundsRoot._id,
        sorting: 'a',
        sort: 200000,
      });
      folders.push(culturesFolder);
    }
  }

  // Build ancestries (+ traits)
  if (include.ancestries) {
    const ancestryText = readText(ANCESTRIES_DOC);
    parsedAncestries = parseAncestries(ancestryText);

    let idx = 0;
    for (const a of parsedAncestries) {
      idx++;
      const built = mkAncestryFromParsed(a);

      const ancestryFolder = mkFolderBase({
        name: a.name,
        parentId: ancestriesRoot._id,
        sorting: 'a',
        sort: idx * 100000,
      });
      const featuresFolder = mkFolderBase({
        name: 'Features',
        parentId: ancestryFolder._id,
        sorting: 'm',
        sort: 100000,
      });
      folders.push(ancestryFolder, featuresFolder);

      built.ancestry.folder = ancestryFolder._id;
      built.sigTrait.folder = featuresFolder._id;
      for (const t of built.purchasedTraits) t.folder = featuresFolder._id;

      items.push(built.ancestry, built.sigTrait, ...built.purchasedTraits);
      if (built.effects && built.effects.length) effects.push(...built.effects);
    }
  }

  // Build cultures
  if (include.cultures) {
    const cultureText = fs.existsSync(CULTURES_DOC) ? readText(CULTURES_DOC) : '';
    cultureTemplates = cultureText ? parseCultureTemplates(cultureText) : [];
    for (const c of cultureTemplates) {
      const item = mkCultureFromTemplate(c);
      item.folder = culturesFolder ? culturesFolder._id : null;
      items.push(item);
    }
  }

  // Build careers
  if (include.careers) {
    careerFiles = fs.existsSync(CAREERS_DIR) ? listCareerFiles(CAREERS_DIR) : [];
    for (const cf of careerFiles) {
      const txt = readText(cf);
      const parsed = parseCareer(txt);
      const item = mkCareerFromParsed(parsed);
      item.folder = careersFolder ? careersFolder._id : null;
      items.push(item);
    }
  }

  // Emit language config for the runtime module script to register.
  if (fs.existsSync(LANGUAGES_DOC)) {
    const langText = readText(LANGUAGES_DOC);
    const langNames = parseLanguagesFromDoc(langText);
    const langMap = buildLanguageMap(langNames);
    fs.mkdirSync(MODULE_DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MODULE_DATA_DIR, 'languages.json'), JSON.stringify(langMap, null, 2), 'utf8');
  }

  await writeLevelDbWithFolders({ items, folders, effects }, PACK_DIR);

  console.log(
    `Wrote ${items.length} items, ${folders.length} folders, and ${effects.length} effects to ${path.relative(REPO_ROOT, PACK_DIR)}\\`
  );
  if (include.ancestries) console.log(`- ancestries: ${parsedAncestries.length}`);
  if (include.cultures) console.log(`- cultures (templates): ${cultureTemplates.length}`);
  if (include.careers) console.log(`- careers: ${careerFiles.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
