/* eslint-disable no-console */

/**
 * register-faith.js — Svellheim Domain Injection for Draw Steel
 *
 * Draw Steel does NOT use a CONFIG registry for domains.
 * Domains are compendium Items referenced by UUID in the class item's
 * "Deity and Domains" itemGrant advancement pool:
 *   - Conduit: pool of `subclass` items with classLink: "conduit"
 *   - Censor:  pool of `feature` items
 *
 * Strategy (three-prong, to cover every scenario):
 *   1. At "ready" → patch Conduit & Censor in the draw-steel.classes
 *      compendium **in memory** (non-destructive, session-only) so any
 *      future drop from the compendium already includes custom domains.
 *   2. At "ready" → patch class items already embedded on existing actors
 *      (persistent update via item.update).
 *   3. "preCreateItem" hook → safety net for class drops that happen
 *      before the ready-hook completes.
 */

(() => {
  const MODULE_ID = 'svellheim';
  const DS_CLASSES_PACK = 'draw-steel.classes';

  let manifest = null;
  let manifestLoaded = null; // Promise

  // ── Load manifest ───────────────────────────────────────────────────

  Hooks.once('setup', () => {
    manifestLoaded = (async () => {
      try {
        const rel = `modules/${MODULE_ID}/data/domain-manifest.json`;
        const url = globalThis.foundry?.utils?.getRoute
          ? foundry.utils.getRoute(rel)
          : rel;

        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) {
          console.warn(`[${MODULE_ID}] domain-manifest.json not found (${res.status})`);
          return;
        }

        manifest = await res.json();
        console.log(
          `[${MODULE_ID}] Domain manifest loaded — custom domains: ${(manifest.customDomains || []).join(', ')}`
        );
      } catch (e) {
        console.error(`[${MODULE_ID}] Failed to load domain manifest`, e);
      }
    })();
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Convert advancements (which might be a Foundry Collection, Map,
   * DataModel proxy, or plain object) into a plain [key, value] array.
   */
  function advancementEntries(advancements) {
    if (!advancements || typeof advancements !== 'object') return [];

    // 1. If it has a toObject() method (Foundry DataModel / EmbeddedCollection)
    if (typeof advancements.toObject === 'function') {
      return Object.entries(advancements.toObject());
    }
    // 2. If it's a Map or has .entries() returning an iterator
    if (advancements instanceof Map) {
      return [...advancements.entries()];
    }
    // 3. Foundry Collection extends Map — also has .entries()
    if (typeof advancements.entries === 'function' && typeof advancements.size === 'number') {
      return [...advancements.entries()];
    }
    // 4. Plain object
    return Object.entries(advancements);
  }

  /**
   * Search advancements for the "Deity and Domains" itemGrant.
   * Returns { key, adv } or null.
   */
  function findDeityAdvancement(advancements) {
    const entries = advancementEntries(advancements);
    if (!entries.length) {
      console.warn(
        `[${MODULE_ID}] advancementEntries returned 0 entries.`,
        'type:', typeof advancements,
        'constructor:', advancements?.constructor?.name,
        'keys (Object.keys):', Object.keys(advancements ?? {})
      );
    }

    for (const [key, adv] of entries) {
      // adv may itself be a DataModel — convert if needed
      const a = (typeof adv?.toObject === 'function') ? adv.toObject() : adv;
      if (
        a?.type === 'itemGrant' &&
        typeof a.name === 'string' &&
        /deity|domain/i.test(a.name)
      ) {
        return { key, adv: a };
      }
    }
    return null;
  }

  /** Return an array of compendium UUIDs for a given class _dsid. */
  function getUuidsForClass(dsid) {
    if (!manifest) return [];
    if (dsid === 'conduit') return (manifest.conduit || []).map((d) => d.uuid).filter(Boolean);
    if (dsid === 'censor') return (manifest.censor || []).map((d) => d.uuid).filter(Boolean);
    return [];
  }

  /**
   * Add UUIDs to a pool array (in-place). Returns number added.
   * Pool entries are objects like { uuid: "Compendium.…" }.
   */
  function injectIntoPool(pool, uuids) {
    if (!Array.isArray(pool)) return 0;
    const existing = new Set(pool.map((p) => (typeof p === 'string' ? p : p?.uuid)));
    let added = 0;
    for (const uuid of uuids) {
      if (!uuid || existing.has(uuid)) continue;
      pool.push({ uuid });
      existing.add(uuid);
      added++;
    }
    return added;
  }

  // ── 3. preCreateItem — safety-net for class drops ───────────────────

  Hooks.on('preCreateItem', (item, data, options, userId) => {
    if (!manifest) return;
    if (item?.type !== 'class') return;

    const dsid = item?.system?._dsid ?? data?.system?._dsid;
    if (!dsid || !['conduit', 'censor'].includes(dsid)) return;

    try {
      const sysRaw = (typeof item?.system?.toObject === 'function')
        ? item.system.toObject()
        : (item?.system ?? data?.system ?? {});
      const advancements = foundry.utils.deepClone(sysRaw.advancements ?? {});

      const found = findDeityAdvancement(advancements);
      if (!found) return;
      if (!Array.isArray(found.adv.pool)) found.adv.pool = [];

      const uuids = getUuidsForClass(dsid);
      const added = injectIntoPool(found.adv.pool, uuids);

      if (added > 0) {
        item.updateSource({ 'system.advancements': advancements });
        console.log(
          `[${MODULE_ID}] preCreateItem: injected ${added} domain(s) into ${dsid} pool`
        );
      }
    } catch (e) {
      console.error(`[${MODULE_ID}] preCreateItem injection failed`, e);
    }
  });

  // ── 1 + 2. ready — patch compendium + existing actors ───────────────

  Hooks.once('ready', async () => {
    // Wait for manifest to finish loading (it started in setup).
    if (manifestLoaded) await manifestLoaded;

    if (!manifest) {
      console.warn(`[${MODULE_ID}] No domain manifest — faith registration skipped.`);
      return;
    }

    // ── 1. Patch compendium class items in memory ─────────────────────
    try {
      const pack = game.packs.get(DS_CLASSES_PACK);
      if (pack) {
        const index = await pack.getIndex();

        for (const className of ['Conduit', 'Censor']) {
          // Find the class entry in the index.
          const entry = index.find((e) => e.name === className);
          if (!entry) {
            console.warn(`[${MODULE_ID}] ${className} not found in ${DS_CLASSES_PACK}`);
            continue;
          }

          // Load the full document (this caches it in the pack's collection).
          const doc = await pack.getDocument(entry._id);
          if (!doc) continue;

          const dsid = doc.system?._dsid;
          const uuids = getUuidsForClass(dsid);
          if (!uuids.length) continue;

          // Get raw data — doc.system.advancements may be a proxy/Collection.
          const rawSystem = (typeof doc.system.toObject === 'function')
            ? doc.system.toObject()
            : doc.system;
          const advancements = foundry.utils.deepClone(rawSystem.advancements || {});
          console.log(
            `[${MODULE_ID}] ${className} advancements keys:`,
            Object.keys(advancements),
            'count:', Object.keys(advancements).length
          );
          const found = findDeityAdvancement(advancements);
          if (!found) {
            console.warn(`[${MODULE_ID}] ${className}: no Deity and Domains advancement found`);
            continue;
          }
          if (!Array.isArray(found.adv.pool)) found.adv.pool = [];

          const added = injectIntoPool(found.adv.pool, uuids);
          if (added > 0) {
            // updateSource modifies in-memory source without persisting to disk.
            doc.updateSource({ 'system.advancements': advancements });
            console.log(
              `[${MODULE_ID}] Compendium ${className}: +${added} domain(s) ` +
                `(pool now ${found.adv.pool.length})`
            );
          }
        }
      } else {
        console.warn(`[${MODULE_ID}] Compendium pack ${DS_CLASSES_PACK} not found`);
      }
    } catch (e) {
      console.error(`[${MODULE_ID}] Failed to patch compendium classes`, e);
    }

    // ── 2. Patch class items already embedded on world actors ─────────
    try {
      let totalPatched = 0;

      for (const actor of game.actors) {
        for (const item of actor.items) {
          if (item.type !== 'class') continue;

          const dsid = item.system?._dsid;
          if (!['conduit', 'censor'].includes(dsid)) continue;

          const uuids = getUuidsForClass(dsid);
          if (!uuids.length) continue;

          const rawSys = (typeof item.system.toObject === 'function')
            ? item.system.toObject()
            : item.system;
          const advs = rawSys.advancements || {};
          const found = findDeityAdvancement(advs);
          if (!found) continue;
          if (!Array.isArray(found.adv.pool)) continue;

          // Check which UUIDs are missing.
          const existing = new Set(
            found.adv.pool.map((p) => (typeof p === 'string' ? p : p?.uuid))
          );
          const newEntries = uuids
            .filter((u) => !existing.has(u))
            .map((uuid) => ({ uuid }));

          if (newEntries.length > 0) {
            const newPool = [...found.adv.pool, ...newEntries];
            // Use targeted dot-notation path for reliable persistence.
            await item.update({
              [`system.advancements.${found.key}.pool`]: newPool,
            });
            totalPatched += newEntries.length;
            console.log(
              `[${MODULE_ID}] Actor "${actor.name}" ${dsid}: +${newEntries.length} domain(s)`
            );
          }
        }
      }

      if (totalPatched) {
        console.log(`[${MODULE_ID}] Patched ${totalPatched} domain(s) on existing actors.`);
      }
    } catch (e) {
      console.error(`[${MODULE_ID}] Failed to patch actor class items`, e);
    }

    console.log(`[${MODULE_ID}] Faith registration complete.`);
  });
})();
