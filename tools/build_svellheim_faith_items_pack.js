#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = process.cwd();

const MODULE_ID = 'svellheim';
const MODULE_DIR = path.join(REPO_ROOT, 'module');

const PACK_NAME = 'svellheim-faith';
const PACK_DIR = path.join(MODULE_DIR, 'packs', PACK_NAME);

const FAITH_JSON_PATH = path.join(MODULE_DIR, 'data', 'faith.json');

const MODULE_ASSET_BASE = `modules/${MODULE_ID}/assets/icons`;
const DOMAIN_ICON = `${MODULE_ASSET_BASE}/faith/domain.svg`;
const GOD_ICON = `${MODULE_ASSET_BASE}/faith/god.svg`;

// ── The 12 core Draw Steel domains (already in draw-steel.classes) ────
const CORE_DOMAIN_IDS = new Set([
  'creation', 'death', 'fate', 'knowledge',
  'life', 'love', 'nature', 'protection',
  'storm', 'sun', 'trickery', 'war',
]);

// ── Mechanical descriptions for custom Svellheim domains ─────────────
// These mirror the exact HTML structure used by core domains:
//   <p><strong>Piety:</strong> …</p>
//   <p><strong>Prayer Effect:</strong> …</p>
//
// Conduit domains get Piety + Prayer Effect in their description.
// Censor domains have empty descriptions in core, so we add a brief
// thematic note only.

const CUSTOM_DOMAIN_CONDUIT_DESC = {
  frost: [
    '<p><strong>Piety:</strong> You gain 2 piety the first time in an encounter that an enemy within 10 squares takes cold damage or gains the slowed condition.</p>',
    '<p><strong>Prayer Effect:</strong> Choose a point within 10 squares. Each enemy in a 3-cube area centered on that point takes cold damage equal to two times your Intuition score and is slowed (EoT). Alternatively, you or one ally within 10 squares gains cold immunity until the end of their next turn and regains Stamina equal to your Intuition score. [[2*@I cold damage]] or [[/heal @I]]</p>',
  ].join(''),

  runes: [
    '<p><strong>Piety:</strong> You gain 2 piety the first time in an encounter that you or an ally within 10 squares gains an edge on a power roll or imposes a bane on an enemy&rsquo;s power roll.</p>',
    '<p><strong>Prayer Effect:</strong> Choose yourself or one ally within 10 squares. That character gains an edge on all power rolls until the end of their next turn and can immediately shift up to 3 squares. Alternatively, choose one enemy within 10 squares; that enemy suffers a bane on all power rolls until the end of their next turn and can&rsquo;t shift or use triggered actions during that time.</p>',
  ].join(''),

  strength: [
    '<p><strong>Piety:</strong> You gain 2 piety the first time in an encounter that you or an ally within 10 squares force moves an enemy 3 or more squares or knocks an enemy prone.</p>',
    '<p><strong>Prayer Effect:</strong> Choose yourself or one ally within 10 squares. That character gains temporary Stamina equal to three times your Intuition score and can push each adjacent enemy up to 3 squares. Alternatively, one enemy within 10 squares is knocked prone and takes damage equal to two times your Intuition score. [[/heal 3*@I type=temporary]] or [[2*@I damage]]</p>',
  ].join(''),

  vengeance: [
    '<p><strong>Piety:</strong> You gain 2 piety the first time in an encounter that you or an ally within 10 squares deals damage to an enemy who damaged an ally since the end of your last turn.</p>',
    '<p><strong>Prayer Effect:</strong> Choose one enemy within 10 squares who has dealt damage this encounter. That enemy takes holy damage equal to three times your Intuition score. If that enemy reduced an ally to 0 Stamina this encounter, this damage increases to four times your Intuition score instead. [[3*@I holy damage]] or [[4*@I holy damage]]</p>',
  ].join(''),
};

const CUSTOM_DOMAIN_CENSOR_DESC = {
  frost:
    '<p>The bitter cold of Niflheim flows through your judgment. Frost domains grant mastery over cold and endurance against the harshest conditions.</p>',
  runes:
    '<p>The inscribed secrets of the All-Father guide your hand. Runes domains grant insight into hidden truths and the power to name things into being.</p>',
  strength:
    '<p>The raw might of the Thunderer and the primordial titans runs in your veins. Strength domains grant overwhelming physical force and unyielding resolve.</p>',
  vengeance:
    '<p>The scales of justice must be balanced. Vengeance domains grant the power to repay harm in kind and shield the wronged.</p>',
};

// ── Censor domain advancement features (L1 / L4 / L7) ───────────────
// Each domain gets a skill group and three domain feature items that are
// granted via itemGrant advancements, mirroring core domains exactly.

const CENSOR_DOMAIN_SKILL_GROUP = {
  frost: 'exploration',
  runes: 'lore',
  strength: 'exploration',
  vengeance: 'interpersonal',
};

const CENSOR_DOMAIN_FEATURES = {
  frost: [
    {
      level: 1,
      name: 'Rime Condemnation',
      dsid: 'frost-censor-l1-rime-condemnation',
      description: [
        '<p>The cold of Niflheim answers your judgment. As a respite activity, you can bless a weapon or holy symbol. Any creature who wields it deals extra cold damage equal to your Presence score with abilities that use the item. This benefit lasts until you finish another respite.</p>',
        '<p>Additionally, whenever you use your My Life for Yours ability, the target gains cold immunity until the end of their next turn.</p>',
      ].join(''),
    },
    {
      level: 4,
      name: 'Hoarfrost Ward',
      dsid: 'frost-censor-l4-hoarfrost-ward',
      description: [
        '<p>Bitter cold radiates from your presence. Each time you use your My Life for Yours ability, you can also choose one enemy within distance of that ability. That enemy takes cold damage equal to twice your Presence score and is slowed (EoT). [[2*@P cold damage]]</p>',
        '<p>Additionally, your abilities deal an extra 5 damage to slowed creatures.</p>',
      ].join(''),
    },
    {
      level: 7,
      name: 'Breath of Niflheim',
      dsid: 'frost-censor-l7-breath-of-niflheim',
      description: [
        '<p>Each time you finish a respite, you can invoke the primordial frost of Niflheim. Choose one of the following effects, which lasts until you finish another respite:</p>',
        '<ul>',
        '<li><p><strong>Frozen Stillness:</strong> You and your allies within 10 squares of you gain cold immunity. Enemies who start their turn within 5 squares of you are slowed (EoT).</p></li>',
        '<li><p><strong>Glacial Reckoning:</strong> Whenever you deal cold damage to a creature, that creature can\'t regain Stamina until the end of their next turn. Your cold damage ignores immunity.</p></li>',
        '</ul>',
      ].join(''),
    },
  ],
  runes: [
    {
      level: 1,
      name: 'Runic Inscription',
      dsid: 'runes-censor-l1-runic-inscription',
      description: [
        '<p>You carve protective runes that ward your allies. As a respite activity, you can inscribe a rune on a willing creature or an object. The inscribed creature or the bearer of the object gains a +1 bonus to stability. You can maintain a number of active inscriptions equal to your Presence score. This benefit lasts until you finish another respite.</p>',
        '<p>Additionally, whenever you use your My Life for Yours ability, the target gains an edge on their next power roll.</p>',
      ].join(''),
    },
    {
      level: 4,
      name: 'Stave of Naming',
      dsid: 'runes-censor-l4-stave-of-naming',
      description: [
        '<p>You learn the secret names that bind reality. Each time you use your My Life for Yours ability, you can also choose one enemy within distance of that ability. That enemy takes a bane on their next power roll.</p>',
        '<p>Additionally, as a respite activity, you can inscribe a word of power on a weapon. A creature wielding the inscribed weapon deals extra holy damage equal to your Presence score to undead and fiends. This benefit lasts until you finish another respite.</p>',
      ].join(''),
    },
    {
      level: 7,
      name: 'Word of Unmaking',
      dsid: 'runes-censor-l7-word-of-unmaking',
      description: [
        '<p>You speak the words that undo enchantment and falsehood. Each time you finish a respite, you can choose one of the following effects, which lasts until you finish another respite:</p>',
        '<ul>',
        '<li><p><strong>Rune of Revelation:</strong> You and your allies within 10 squares of you can see invisible creatures and objects, and automatically detect illusions for what they are.</p></li>',
        '<li><p><strong>Rune of Unraveling:</strong> As a main action, you can touch a creature, object, or area affected by a magical effect and end that effect. If the effect was created by a creature of higher level than you, you must make a Presence test with a difficulty of 10 + the creator\'s level.</p></li>',
        '</ul>',
      ].join(''),
    },
  ],
  strength: [
    {
      level: 1,
      name: 'Sanctified Might',
      dsid: 'strength-censor-l1-sanctified-might',
      description: [
        '<p>Divine strength flows through your limbs. As a respite activity, you can bless a weapon. Any creature who wields the weapon gains a bonus to forced movement distance equal to your Presence score with abilities that use the weapon. This benefit lasts until you finish another respite.</p>',
        '<p>Additionally, whenever you use your My Life for Yours ability, the target gains temporary Stamina equal to twice your Presence score. [[/heal 2*@P type=temporary]]</p>',
      ].join(''),
    },
    {
      level: 4,
      name: 'Titan\'s Endurance',
      dsid: 'strength-censor-l4-titans-endurance',
      description: [
        '<p>The might of the Thunderer shields you. Each time you use your My Life for Yours ability, you can also choose one enemy within distance of that ability. That enemy is pushed a number of squares equal to your Presence score. [[push @P]]</p>',
        '<p>Additionally, while you have temporary Stamina, you can\'t be force moved or knocked prone.</p>',
      ].join(''),
    },
    {
      level: 7,
      name: 'Unyielding Judgment',
      dsid: 'strength-censor-l7-unyielding-judgment',
      description: [
        '<p>You channel the indomitable will of the gods. Each time you finish a respite, you can choose one of the following effects, which lasts until you finish another respite:</p>',
        '<ul>',
        '<li><p><strong>Titan\'s Gift:</strong> You and your allies within 10 squares of you gain a bonus to stability equal to your Presence score. Allies who start their turn adjacent to you gain temporary Stamina equal to your Presence score.</p></li>',
        '<li><p><strong>Wrathful Vigor:</strong> Whenever you deal damage with an ability while you are winded, the ability deals extra holy damage equal to twice your Presence score. When you would be reduced to 0 Stamina, you can instead be reduced to 1 Stamina (once per encounter).</p></li>',
        '</ul>',
      ].join(''),
    },
  ],
  vengeance: [
    {
      level: 1,
      name: 'Mark of Retribution',
      dsid: 'vengeance-censor-l1-mark-of-retribution',
      description: [
        '<p>You brand the guilty with divine light. Whenever an enemy within distance of your My Life for Yours ability deals damage to one of your allies, you can use a free triggered action to mark that enemy until the end of the encounter. You can maintain a number of marks equal to your Presence score.</p>',
        '<p>Your abilities deal extra holy damage equal to your Presence score against marked enemies.</p>',
      ].join(''),
    },
    {
      level: 4,
      name: 'Avenger\'s Reprisal',
      dsid: 'vengeance-censor-l4-avengers-reprisal',
      description: [
        '<p>Each time a marked enemy deals damage to one of your allies, you can shift up to 3 squares toward that enemy as a free triggered action. If you end this shift adjacent to the enemy, you can make a free strike against them.</p>',
        '<p>Additionally, your abilities deal an extra 5 damage to marked enemies who are winded.</p>',
      ].join(''),
    },
    {
      level: 7,
      name: 'Divine Reckoning',
      dsid: 'vengeance-censor-l7-divine-reckoning',
      description: [
        '<p>Divine judgment falls on those who harm the innocent. Each time you finish a respite, you can choose one of the following effects, which lasts until you finish another respite:</p>',
        '<ul>',
        '<li><p><strong>Nemesis:</strong> When an ally within 10 squares of you is reduced to 0 Stamina, you can use a free triggered action to deal holy damage equal to three times your Presence score to the creature that reduced them. [[3*@P holy damage]]</p></li>',
        '<li><p><strong>Righteous Fury:</strong> While at least one enemy within 10 squares of you is marked, you and your allies within 10 squares gain an edge on power rolls against marked enemies. Marked enemies take holy damage equal to your Presence score at the start of each of their turns.</p></li>',
        '</ul>',
      ].join(''),
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

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
  const digest = crypto.createHash('sha1').update(String(seed)).digest();
  return base62FromBuffer(digest.subarray(0, 12), 16);
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlP(text) {
  return `<p>${htmlEscape(text)}</p>`;
}

// ── Document builders ─────────────────────────────────────────────────

function mkFolder({ name, parentId = null, sorting = 'a', sort = 0 }) {
  const slug = slugify(name);
  const parentPart = parentId || 'root';
  const _id = foundryIdFromSeed(`folder:${parentPart}:${slug}`);

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

function mkFeatureItem({ name, dsid, img, descriptionHtml, folderId, advancements }) {
  const slug = dsid || slugify(name);
  const _id = foundryIdFromSeed(`feature:${slug}`);

  return {
    _id,
    name,
    type: 'feature',
    img: img || 'icons/svg/book.svg',
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
      advancements: advancements || {},
    },
    effects: [],
    folder: folderId || null,
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

/**
 * Build a subclass item for the Conduit domain pool.
 * Mirrors core domain subclass items (type: "subclass", classLink: "conduit").
 */
function mkSubclassItem({ name, dsid, img, descriptionHtml, folderId, classLink }) {
  const slug = dsid || slugify(name);
  const _id = foundryIdFromSeed(`subclass:${classLink}:${slug}`);

  return {
    _id,
    name,
    type: 'subclass',
    img: img || 'icons/svg/book.svg',
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
      classLink,
      advancements: {},
    },
    effects: [],
    folder: folderId || null,
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

// ── LevelDB writer ────────────────────────────────────────────────────

async function writeLevelDbWithFolders({ items, folders }, outDir) {
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

  await db.compactRange('\x00', '\xff');
  await db.close();
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(FAITH_JSON_PATH)) {
    console.error(`Missing faith.json at: ${FAITH_JSON_PATH}`);
    process.exit(2);
  }

  const faith = JSON.parse(fs.readFileSync(FAITH_JSON_PATH, 'utf8'));
  const domains = Array.isArray(faith.domains) ? faith.domains : [];
  const gods = Array.isArray(faith.gods) ? faith.gods : [];

  const folders = [];
  const items = [];

  // ── Folder hierarchy ──────────────────────────────────────────────
  const rootFolder = mkFolder({ name: 'Svellheim Faith' });
  const domainsFolder = mkFolder({ name: 'Domains', parentId: rootFolder._id, sort: 10 });
  const godsFolder = mkFolder({ name: 'Gods', parentId: rootFolder._id, sort: 20 });
  const conduitDomainsFolder = mkFolder({ name: 'Conduit Domains', parentId: rootFolder._id, sort: 30 });
  const censorDomainsFolder = mkFolder({ name: 'Censor Domains', parentId: rootFolder._id, sort: 40 });

  folders.push(rootFolder, domainsFolder, godsFolder, conduitDomainsFolder, censorDomainsFolder);

  // Precompute which gods belong to which domain.
  const godsByDomain = new Map();
  for (const g of gods) {
    for (const d of g?.domains || []) {
      if (!d?.id) continue;
      const list = godsByDomain.get(String(d.id)) || [];
      list.push(g);
      godsByDomain.set(String(d.id), list);
    }
  }

  // ── Custom domains (not in core Draw Steel) ───────────────────────
  const customDomains = domains.filter((d) => d?.id && !CORE_DOMAIN_IDS.has(d.id));

  const domainManifest = {
    conduit: [],
    censor: [],
  };

  for (const d of customDomains) {
    const id = String(d.id);
    const label = String(d.label);
    const related = godsByDomain.get(id) || [];
    const relatedNames = related.map((g) => g?.name).filter(Boolean);

    // Build Conduit description: use mechanical Piety/Prayer HTML if available,
    // otherwise fall back to generic text.
    let conduitDesc = CUSTOM_DOMAIN_CONDUIT_DESC[id] || '';
    if (!conduitDesc) {
      const parts = [htmlP(`Domain: ${label}.`)];
      if (relatedNames.length) parts.push(htmlP(`Associated deities: ${relatedNames.join(', ')}.`));
      conduitDesc = parts.join('');
    }

    // ── Conduit domain (subclass with classLink: "conduit") ─────────
    const conduitItem = mkSubclassItem({
      name: label,
      dsid: id,
      img: DOMAIN_ICON,
      descriptionHtml: conduitDesc,
      folderId: conduitDomainsFolder._id,
      classLink: 'conduit',
    });
    items.push(conduitItem);
    domainManifest.conduit.push({
      domainId: id,
      itemId: conduitItem._id,
      uuid: `Compendium.${MODULE_ID}.${PACK_NAME}.Item.${conduitItem._id}`,
    });

    // Build Censor description: brief thematic note (core domains use empty).
    const censorDesc = CUSTOM_DOMAIN_CENSOR_DESC[id] || '';

    // ── Censor domain feature items (L1 / L4 / L7) ─────────────────
    // Each domain gets 3 feature items granted via itemGrant advancements,
    // plus a skill advancement — mirroring core domain structure exactly.
    const featureDefs = CENSOR_DOMAIN_FEATURES[id] || [];
    const censorAdvancements = {};

    // 1. Skill advancement (level 1)
    const skillGroup = CENSOR_DOMAIN_SKILL_GROUP[id] || 'exploration';
    const skillAdvId = foundryIdFromSeed(`adv:censor:${id}:skill`);
    censorAdvancements[skillAdvId] = {
      name: `Skill (${skillGroup.charAt(0).toUpperCase() + skillGroup.slice(1)})`,
      type: 'skill',
      requirements: { level: 1 },
      chooseN: 1,
      skills: { groups: [skillGroup] },
    };

    // 2. Domain Feature itemGrants (L1, L4, L7)
    const levelLabels = { 1: 'Domain Feature', 4: '4th-Level Domain Feature', 7: '7th-Level Domain Feature' };
    for (const feat of featureDefs) {
      const featureItem = mkFeatureItem({
        name: feat.name,
        dsid: feat.dsid,
        img: DOMAIN_ICON,
        descriptionHtml: feat.description,
        folderId: censorDomainsFolder._id,
      });
      items.push(featureItem);

      const featureUuid = `Compendium.${MODULE_ID}.${PACK_NAME}.Item.${featureItem._id}`;
      const advId = foundryIdFromSeed(`adv:censor:${id}:l${feat.level}`);
      censorAdvancements[advId] = {
        name: levelLabels[feat.level] || `Level ${feat.level} Domain Feature`,
        type: 'itemGrant',
        requirements: { level: feat.level },
        pool: [{ uuid: featureUuid }],
      };
    }

    // ── Censor domain (feature with advancements) ───────────────────
    const censorItem = mkFeatureItem({
      name: label,
      dsid: `${id}-censor`,
      img: DOMAIN_ICON,
      descriptionHtml: censorDesc,
      folderId: censorDomainsFolder._id,
      advancements: censorAdvancements,
    });
    items.push(censorItem);
    domainManifest.censor.push({
      domainId: id,
      itemId: censorItem._id,
      uuid: `Compendium.${MODULE_ID}.${PACK_NAME}.Item.${censorItem._id}`,
    });
  }

  // ── Reference domain items (all domains, for browsing) ────────────
  for (const d of domains) {
    if (!d?.id || !d?.label) continue;
    const id = String(d.id);
    const label = String(d.label);

    const related = godsByDomain.get(id) || [];
    const relatedNames = related.map((g) => g?.name).filter(Boolean);

    const descParts = [htmlP(`Domain: ${label}.`)];
    if (relatedNames.length) descParts.push(htmlP(`Associated deities: ${relatedNames.join(', ')}.`));
    if (CORE_DOMAIN_IDS.has(id)) descParts.push(htmlP('(Core Draw Steel domain.)'));
    else descParts.push(htmlP('(Custom Svellheim domain.)'));

    items.push(
      mkFeatureItem({
        name: `Domain - ${label}`,
        dsid: `domain-ref-${id}`,
        img: DOMAIN_ICON,
        descriptionHtml: descParts.join(''),
        folderId: domainsFolder._id,
      })
    );
  }

  // ── God items ─────────────────────────────────────────────────────
  for (const g of gods) {
    if (!g?.id || !g?.name) continue;

    const domLabels = (g.domains || []).map((d) => d?.label).filter(Boolean);

    const descParts = [];
    if (g.epithet) descParts.push(htmlP(`Epithet: ${g.epithet}`));
    if (g.subtitle) descParts.push(htmlP(g.subtitle));
    if (g.group) descParts.push(htmlP(`Pantheon: ${g.group}`));
    if (domLabels.length) descParts.push(htmlP(`Domains: ${domLabels.join(', ')}`));

    items.push(
      mkFeatureItem({
        name: String(g.name),
        dsid: String(g.id),
        img: GOD_ICON,
        descriptionHtml: descParts.join(''),
        folderId: godsFolder._id,
      })
    );
  }

  // ── Write the LevelDB pack ────────────────────────────────────────
  await writeLevelDbWithFolders({ items, folders }, PACK_DIR);

  // ── Write domain manifest for register-faith.js ───────────────────
  const manifestPath = path.join(MODULE_DIR, 'data', 'domain-manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        customDomains: customDomains.map((d) => d.id),
        conduit: domainManifest.conduit,
        censor: domainManifest.censor,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(
    `Wrote pack: ${path.relative(REPO_ROOT, PACK_DIR)} (items=${items.length}, folders=${folders.length})`
  );
  console.log(
    `Wrote domain manifest: ${path.relative(REPO_ROOT, manifestPath)} (custom: ${customDomains.map((d) => d.id).join(', ')})`
  );
  console.log(
    `  Conduit: ${domainManifest.conduit.map((d) => `${d.domainId} → ${d.uuid}`).join(', ')}`
  );
  console.log(
    `  Censor: ${domainManifest.censor.map((d) => `${d.domainId} → ${d.uuid}`).join(', ')}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
