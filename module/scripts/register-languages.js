/* eslint-disable no-console */

(() => {
  const MODULE_ID = 'svellheim';

  const SETTING_LANGUAGE_MODE = 'languageMode';

function toDisplayCase(label) {
  if (!label || typeof label !== 'string') return label;
  if (label !== label.toLowerCase()) return label;
  return label
    .split(/(\s+|[-–—])/g)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || /^[-–—]$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function addLanguagesToTarget(target, languages) {
  if (!target || typeof target !== 'object') return 0;

  // Draw Steel stores languages as { label: "..." } objects.
  // Detect the format from existing entries and match it.
  const firstValue = Object.values(target)[0];
  const useObjects = typeof firstValue === 'object' && firstValue !== null;

  let added = 0;
  for (const [id, label] of Object.entries(languages)) {
    if (!id || typeof label !== 'string') continue;
    if (target[id]) continue;
    const displayLabel = toDisplayCase(label);
    target[id] = useObjects ? { label: displayLabel } : displayLabel;
    added++;
  }
  return added;
}

function patchRenderedLanguageLabels(rootEl, languages) {
  // Some Draw Steel UIs appear to render the language *id* as the visible label
  // (e.g., "svellspraak") even when the config map contains a proper label.
  // This fixes the rendered UI without needing to reverse-engineer every internal registry.
  if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return 0;

  const ids = Object.keys(languages);
  if (!ids.length) return 0;
  const idSet = new Set(ids);

  let patched = 0;
  const candidates = rootEl.querySelectorAll('label, option, span, div, li');
  for (const el of candidates) {
    // Only patch leaf-ish nodes to avoid clobbering larger chunks of UI.
    if (!el || el.children?.length) continue;
    const raw = (el.textContent || '').trim();
    if (!raw || !idSet.has(raw)) continue;
    const desired = toDisplayCase(languages[raw]);
    if (desired && raw !== desired) {
      el.textContent = desired;
      patched++;
    }
  }

  return patched;
}

Hooks.once('init', () => {
  try {
    game.settings.register(MODULE_ID, SETTING_LANGUAGE_MODE, {
      name: 'Svellheim languages mode',
      hint:
        'Extend keeps Draw Steel languages and adds Svellheim. Replace removes all system languages and leaves only Svellheim (may break other content).',
      scope: 'world',
      config: true,
      type: String,
      choices: {
        extend: 'Extend (recommended)',
        replace: 'Replace (Svellheim only)',
      },
      default: 'extend',
    });
  } catch (e) {
    console.error(`[${MODULE_ID}] Failed to register settings`, e);
  }
});

Hooks.once('setup', async () => {
  try {
    // Use a stable URL; Module#path isn't present in some Foundry versions.
    const rel = `modules/${MODULE_ID}/data/languages.json`;
    const url = globalThis.foundry?.utils?.getRoute ? foundry.utils.getRoute(rel) : rel;

    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      console.warn(`[${MODULE_ID}] Could not load languages.json (${res.status})`);
      return;
    }

    const languages = await res.json();

    // Normalize labels defensively.
    for (const [k, v] of Object.entries(languages)) {
      if (typeof v === 'string') languages[k] = toDisplayCase(v);
    }

    const applyToKnownTargets = () => {
      const targets = [];
      if (CONFIG?.DRAW_STEEL?.languages) targets.push(CONFIG.DRAW_STEEL.languages);
      if (CONFIG?.['draw-steel']?.languages) targets.push(CONFIG['draw-steel'].languages);
      if (game.system?.config?.languages) targets.push(game.system.config.languages);

      const unique = Array.from(new Set(targets));
      const mode = game.settings.get(MODULE_ID, SETTING_LANGUAGE_MODE);
      let totalAdded = 0;
      for (const t of unique) {
        if (mode === 'replace') {
          // Detect format before clearing.
          const sample = Object.values(t)[0];
          const useObj = typeof sample === 'object' && sample !== null;
          for (const key of Object.keys(t)) delete t[key];
          for (const [id, label] of Object.entries(languages)) {
            const displayLabel = toDisplayCase(label);
            t[id] = useObj ? { label: displayLabel } : displayLabel;
          }
          totalAdded += Object.keys(languages).length;
        } else {
          totalAdded += addLanguagesToTarget(t, languages);
        }
      }
      return { uniqueCount: unique.length, totalAdded };
    };

    const initial = applyToKnownTargets();
    if (!initial.uniqueCount) {
      console.warn(`[${MODULE_ID}] No known Draw Steel language registry found to extend.`);
    }

    console.log(`[${MODULE_ID}] Language registration: added=${initial.totalAdded}.`);

    // Some systems finalize config late. Re-apply at ready and on app renders.
    Hooks.once('ready', () => {
      try {
        const again = applyToKnownTargets();
        console.log(`[${MODULE_ID}] Language patch (ready): added=${again.totalAdded}.`);
      } catch (e) {
        console.error(`[${MODULE_ID}] Failed language patch on ready`, e);
      }
    });

    Hooks.on('renderApplication', (app, html) => {
      try {
        const root = html?.[0] || app?.element?.[0] || app?.element || null;
        const patched = patchRenderedLanguageLabels(root, languages);
        if (patched) {
          console.log(`[${MODULE_ID}] Patched ${patched} rendered language labels.`);
        }
      } catch {
        // Ignore.
      }
    });
  } catch (e) {
    console.error(`[${MODULE_ID}] Failed to register languages`, e);
  }
});

})();
