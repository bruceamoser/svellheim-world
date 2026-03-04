/* eslint-disable no-console */

/**
 * Compendium Installer – Svellheim Character Options
 *
 * Adds a button in module settings that opens a dialog allowing the GM to
 * import all (or selected) compendium packs into the world.
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
  /*  Pack metadata (order matches module.json)                          */
  /* ------------------------------------------------------------------ */
  const PACKS = [
    { name: 'svellheim-origins',           label: 'Svellheim Origins',                      type: 'Item' },
    { name: 'svellheim-faith',             label: 'Svellheim Faith (Gods & Domains)',        type: 'Item' },
    { name: 'svellheim-rewards',           label: 'Svellheim Rewards (Projects & Treasures)',type: 'Item' },
    { name: 'svellheim-npcs',              label: 'Svellheim NPCs',                         type: 'Actor' },
    { name: 'svellheim-monsters',          label: 'Svellheim Monsters',                     type: 'Actor' },
    { name: 'svellheim-montage-tests',     label: 'Svellheim Montage Tests',                type: 'Item' },
    { name: 'svellheim-negotiation-tests', label: 'Svellheim Negotiation Tests',            type: 'Item' },
    { name: 'svellheim-handout-journals',  label: 'Svellheim Handout Journals',             type: 'JournalEntry' },
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
        width: 520,
        height: 'auto',
        closeOnSubmit: false,
      });
    }

    /** @override */
    getData() {
      const imported = this._getImportedSet();
      const packs = PACKS.map((p) => {
        const collection = game.packs.get(`${MODULE_ID}.${p.name}`);
        const count = collection?.index?.size ?? '?';
        return {
          name: p.name,
          label: p.label,
          type: p.type,
          count,
          imported: imported.has(p.name),
          checked: !imported.has(p.name),
        };
      });
      return { packs };
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
      const selected = PACKS.filter((p) => formData[p.name]);
      if (!selected.length) {
        ui.notifications.warn('No packs selected for import.');
        return;
      }

      // Confirm before importing
      const proceed = await Dialog.confirm({
        title: 'Confirm Import',
        content: `<p>Import <strong>${selected.length}</strong> compendium pack(s) into the world?</p>
                  <p>Each pack will be placed in its own folder. Existing documents will <em>not</em> be duplicated if they share the same ID.</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false,
      });
      if (!proceed) return;

      const imported = this._getImportedSet();
      let success = 0;
      let failed = 0;

      for (const p of selected) {
        const packKey = `${MODULE_ID}.${p.name}`;
        const pack = game.packs.get(packKey);
        if (!pack) {
          console.warn(`[${MODULE_ID}] Pack not found: ${packKey}`);
          ui.notifications.error(`Pack not found: ${p.label}`);
          failed++;
          continue;
        }

        try {
          ui.notifications.info(`Importing ${p.label}…`);
          await pack.importAll({ folderName: p.label, keepId: true });
          imported.add(p.name);
          success++;
          console.log(`[${MODULE_ID}] Imported pack: ${p.label}`);
        } catch (err) {
          console.error(`[${MODULE_ID}] Failed to import ${p.label}`, err);
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
        hint: 'Import all Svellheim compendium packs (origins, faith, NPCs, monsters, items, journals, etc.) into your world.',
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
