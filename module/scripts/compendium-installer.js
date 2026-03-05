/* eslint-disable no-console */

/**
 * Compendium Installer – Svellheim Campaign
 *
 * Detects all installed Svellheim modules (world, entities, acts 1–3) and
 * provides a unified dialog for importing their compendium packs into the world.
 *
 * Uses:
 *   game.settings.registerMenu  → button in Module Settings
 *   FormApplication             → the import dialog
 *   CompendiumCollection#importAll({ folderName }) → actual import
 */
(() => {
  const MODULE_ID = 'svellheim';
  const SETTING_IMPORTED = 'importedPacks'; // hidden – tracks what was imported

  /* ------------------------------------------------------------------ */
  /*  Module → Pack definitions (auto-detected at runtime)               */
  /* ------------------------------------------------------------------ */
  const MODULE_GROUPS = [
    {
      moduleId: 'svellheim',
      label: 'Svellheim (World)',
      packs: [
        { name: 'svellheim-origins',                label: 'Origins (Ancestries, Cultures, Careers)', type: 'Item' },
        { name: 'svellheim-faith',                  label: 'Faith (Gods & Domains)',                  type: 'Item' },
        { name: 'svellheim-campaign',               label: 'Campaign Journals',                       type: 'JournalEntry' },
        { name: 'svellheim-world-director-journals', label: 'Director Journals (World)',                type: 'JournalEntry' },
        { name: 'svellheim-world-player-journals',   label: 'Player Journals (World)',                  type: 'JournalEntry' },
        { name: 'svellheim-handout-journals',        label: 'Handout Journals',                        type: 'JournalEntry' },
      ],
    },
    {
      moduleId: 'svellheim-entities',
      label: 'Svellheim Entities',
      packs: [
        { name: 'svellheim-npcs',      label: 'NPCs',                           type: 'Actor' },
        { name: 'svellheim-monsters',  label: 'Monsters',                       type: 'Actor' },
        { name: 'svellheim-items',     label: 'Items & Treasures',              type: 'Item' },
        { name: 'svellheim-projects',  label: 'Projects',                       type: 'Item' },
      ],
    },
    {
      moduleId: 'svellheim-act1',
      label: 'Act 1 — Restore the Flame',
      packs: [
        { name: 'svellheim-act1-director-journals', label: 'Director Journals', type: 'JournalEntry' },
        { name: 'svellheim-act1-player-journals',   label: 'Player Journals',   type: 'JournalEntry' },
        { name: 'svellheim-act1-montage-tests',     label: 'Montage Tests',     type: 'Item' },
        { name: 'svellheim-act1-negotiation-tests', label: 'Negotiation Tests', type: 'Item' },
      ],
    },
    {
      moduleId: 'svellheim-act2',
      label: 'Act 2 — The Deep Road',
      packs: [
        { name: 'svellheim-act2-director-journals', label: 'Director Journals', type: 'JournalEntry' },
        { name: 'svellheim-act2-player-journals',   label: 'Player Journals',   type: 'JournalEntry' },
        { name: 'svellheim-act2-montage-tests',     label: 'Montage Tests',     type: 'Item' },
        { name: 'svellheim-act2-negotiation-tests', label: 'Negotiation Tests', type: 'Item' },
      ],
    },
    {
      moduleId: 'svellheim-act3',
      label: 'Act 3 — The Burning',
      packs: [
        { name: 'svellheim-act3-director-journals', label: 'Director Journals', type: 'JournalEntry' },
        { name: 'svellheim-act3-player-journals',   label: 'Player Journals',   type: 'JournalEntry' },
        { name: 'svellheim-act3-montage-tests',     label: 'Montage Tests',     type: 'Item' },
        { name: 'svellheim-act3-negotiation-tests', label: 'Negotiation Tests', type: 'Item' },
      ],
    },
  ];

  /* ------------------------------------------------------------------ */
  /*  FormApplication – Import Dialog                                    */
  /* ------------------------------------------------------------------ */
  class SvellheimImporter extends FormApplication {
    /** @override */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: 'svellheim-compendium-installer',
        title: 'Svellheim Compendium Installer',
        template: `modules/${MODULE_ID}/templates/compendium-installer.html`,
        width: 560,
        height: 'auto',
        closeOnSubmit: false,
      });
    }

    /** @override */
    getData() {
      const imported = this._getImportedSet();
      const groups = [];

      for (const group of MODULE_GROUPS) {
        // Skip modules that aren't installed or active
        const mod = game.modules.get(group.moduleId);
        if (!mod?.active) continue;

        const packs = group.packs.map((p) => {
          const packKey = `${group.moduleId}.${p.name}`;
          const collection = game.packs.get(packKey);
          const count = collection?.index?.size ?? '?';
          const qualifiedName = `${group.moduleId}::${p.name}`;
          return {
            qualifiedName,
            packKey,
            label: p.label,
            type: p.type,
            count,
            imported: imported.has(qualifiedName),
            checked: !imported.has(qualifiedName),
          };
        });

        groups.push({
          moduleId: group.moduleId,
          label: group.label,
          packs,
        });
      }

      return { groups };
    }

    /** @override */
    activateListeners(html) {
      super.activateListeners(html);
      html.find('.select-all').on('click', () => {
        html.find('input[type="checkbox"]').prop('checked', true);
      });
      html.find('.select-none').on('click', () => {
        html.find('input[type="checkbox"]').prop('checked', false);
      });
    }

    /** @override */
    async _updateObject(_event, formData) {
      // Collect selected packs across all active module groups
      const allPacks = [];
      for (const group of MODULE_GROUPS) {
        const mod = game.modules.get(group.moduleId);
        if (!mod?.active) continue;
        for (const p of group.packs) {
          const qualifiedName = `${group.moduleId}::${p.name}`;
          if (formData[qualifiedName]) {
            allPacks.push({
              qualifiedName,
              packKey: `${group.moduleId}.${p.name}`,
              label: p.label,
              groupLabel: group.label,
            });
          }
        }
      }

      if (!allPacks.length) {
        ui.notifications.warn('No packs selected for import.');
        return;
      }

      // Confirm before importing
      const proceed = await Dialog.confirm({
        title: 'Confirm Import',
        content: `<p>Import <strong>${allPacks.length}</strong> compendium pack(s) into the world?</p>
                  <p>Each pack will be placed in its own folder. Existing documents will <em>not</em> be duplicated if they share the same ID.</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false,
      });
      if (!proceed) return;

      const imported = this._getImportedSet();
      let success = 0;
      let failed = 0;

      for (const p of allPacks) {
        const pack = game.packs.get(p.packKey);
        if (!pack) {
          console.warn(`[${MODULE_ID}] Pack not found: ${p.packKey}`);
          ui.notifications.error(`Pack not found: ${p.label} (${p.groupLabel})`);
          failed++;
          continue;
        }

        try {
          ui.notifications.info(`Importing ${p.groupLabel} → ${p.label}…`);
          await pack.importAll({ folderName: `${p.groupLabel}: ${p.label}`, keepId: true });
          imported.add(p.qualifiedName);
          success++;
          console.log(`[${MODULE_ID}] Imported pack: ${p.packKey}`);
        } catch (err) {
          console.error(`[${MODULE_ID}] Failed to import ${p.packKey}`, err);
          ui.notifications.error(`Failed to import ${p.label}. See console (F12) for details.`);
          failed++;
        }
      }

      // Persist which packs have been imported
      await game.settings.set(MODULE_ID, SETTING_IMPORTED, Array.from(imported));

      // Summary notification
      if (failed === 0) {
        ui.notifications.info(`Successfully imported ${success} pack(s).`);
      } else {
        ui.notifications.warn(`Imported ${success} pack(s), ${failed} failed.`);
      }

      // Refresh the form to show updated statuses
      this.render();
    }

    /* -- helpers -- */
    _getImportedSet() {
      try {
        const arr = game.settings.get(MODULE_ID, SETTING_IMPORTED);
        return new Set(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Registration (init hook)                                           */
  /* ------------------------------------------------------------------ */
  Hooks.once('init', () => {
    try {
      // Hidden setting to track imported packs
      game.settings.register(MODULE_ID, SETTING_IMPORTED, {
        scope: 'world',
        config: false,
        type: Array,
        default: [],
      });

      // Visible button in Module Settings
      game.settings.registerMenu(MODULE_ID, 'compendiumInstaller', {
        name: 'Compendium Installer',
        label: 'Import Compendiums',
        hint: 'Import compendium packs from all installed Svellheim modules (world, entities, acts 1–3) into your world.',
        icon: 'fas fa-download',
        type: SvellheimImporter,
        restricted: true, // GM only
      });

      console.log(`[${MODULE_ID}] Compendium installer registered.`);
    } catch (e) {
      console.error(`[${MODULE_ID}] Failed to register compendium installer`, e);
    }
  });
})();
