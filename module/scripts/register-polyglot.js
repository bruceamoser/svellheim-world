/* eslint-disable no-console */

/**
 * register-polyglot.js — Svellheim Language Provider for Polyglot
 *
 * Registers a custom LanguageProvider with the Polyglot module that adds
 * Svellheim's languages (with thematic Norse-inspired fonts) on top of the
 * base Draw Steel language set.
 *
 * This replaces the built-in Draw Steel provider shipped with Polyglot so
 * that Svellheim languages are first-class citizens with proper font
 * mappings.  The provider also handles both storage formats for
 * CONFIG.DRAW_STEEL.languages — { label: "..." } objects and plain strings
 * — so it is resilient to different versions of the Draw Steel system and
 * the register-languages.js injection order.
 *
 * Font choices follow a Norse / runic theme:
 *   Floki          – Default; Nordic explorer script
 *   Ny Stormning   – Bold Norse runes (giants, frozen wastes)
 *   Dethek         – Dense carved runes (dwarves)
 *   Espruar        – Flowing elvish script (light elves)
 *   Olde Espruar   – Ancient nature glyphs (ash / wood)
 *   Ophidian       – Serpentine script (serpent tongue)
 *   Davek          – Angular dwarven runes (mountain dialects)
 *   High Drowic    – Dark / underworld scripts
 *   Kargi          – Rough scratch marks (wild / harsh regions)
 *   Valmaric       – Graceful letterforms (temperate regions)
 *   Olde Thorass   – Weathered ancient script (island / mire dialects)
 */

Hooks.once('polyglot.init', (LanguageProvider) => {
  const MODULE_ID = 'svellheim';

  class SvellheimLanguageProvider extends LanguageProvider {
    /* ------------------------------------------------------------------ */
    /*  Configuration                                                     */
    /* ------------------------------------------------------------------ */

    /** Norse-runic default for any language without an explicit font. */
    defaultFont = 'Floki';

    /**
     * Delay getLanguages() until the "ready" hook so that
     * register-languages.js (which runs at "setup" and "ready") has time
     * to inject Svellheim languages into CONFIG.DRAW_STEEL.languages.
     */
    requiresReady = true;

    /* ------------------------------------------------------------------ */
    /*  Font map — Draw Steel base + Svellheim                            */
    /* ------------------------------------------------------------------ */

    languages = {
      // ── Draw Steel: Ancestry languages ────────────────────────────────
      caelian:          { font: 'Meroitic Demotic' },   // Common tongue
      anjali:           { font: 'High Drowic' },
      axiomatic:        { font: 'Miroslav Normal' },
      filliaric:        { font: 'Kargi' },
      highKuric:        { font: 'Maras Eye' },
      hyrallic:         { font: 'Ar Ciela' },
      illyvric:         { font: 'Ar Ciela' },
      kalliak:          { font: 'Kargi' },
      kethaic:          { font: 'Semphari' },
      khelt:            { font: 'Barazhad' },
      khoursirian:      { font: 'Meroitic Demotic' },
      lowKuric:         { font: 'Ork Glyphs' },
      mindspeech:       { font: 'Pulsian' },

      // ── Draw Steel: Creature / ancient languages ──────────────────────
      protoCtholl:      { font: 'Tengwar' },
      szetch:           { font: 'Kargi' },
      theFirstLanguage: { font: 'Mage Script' },
      tholl:            { font: 'Tengwar' },
      urollialic:       { font: 'Skaven' },
      variac:           { font: 'Skaven' },
      vastariax:        { font: 'Rellanic' },
      vhoric:           { font: 'Maras Eye' },
      voll:             { font: 'Celestial' },
      yllyric:          { font: 'Ar Ciela' },
      zahariax:         { font: 'Dark Eldar' },
      zaliac:           { font: 'Floki' },

      // ── Draw Steel: Human languages ───────────────────────────────────
      higaran:          { font: 'Meroitic Demotic' },
      khemharic:        { font: 'Meroitic Demotic' },
      oaxuatl:          { font: 'Meroitic Demotic' },
      phaedran:         { font: 'Meroitic Demotic' },
      riojan:           { font: 'Meroitic Demotic' },
      uvalic:           { font: 'Meroitic Demotic' },
      vaniric:          { font: 'Meroitic Demotic' },
      vasloria:         { font: 'Meroitic Demotic' },

      // ── Draw Steel: Dead languages ────────────────────────────────────
      highRhyvian:      { font: 'Ar Ciela' },
      khamish:          { font: 'Jungle Slang' },
      kheltivari:       { font: 'Barazhad' },
      lowRhivian:       { font: 'Ar Ciela' },
      oldVariac:        { font: 'Skaven' },
      phorialtic:       { font: 'Ork Glyphs' },
      rallarian:        { font: 'Floki' },
      ullorvic:         { font: 'Ar Ciela' },

      // ── Svellheim: Major languages ────────────────────────────────────
      svellspraak:      { font: 'Floki' },              // Common tongue of Svellheim
      dvergsmal:        { font: 'Dethek' },              // Dvergsmål — Dwarven
      tonttumal:        { font: 'Tengwar' },             // Tonttumál — Small-folk
      ljosamal:         { font: 'Espruar' },             // Ljósamál — Light Elf
      jotuntunga:       { font: 'Ny Stormning' },        // Jötuntunga — Giant
      askmal:           { font: 'Olde Espruar' },        // Askmál — Ash/tree speech
      ormstunga:        { font: 'Ophidian' },            // Ormstunga — Serpent tongue

      // ── Svellheim: Regional dialects ──────────────────────────────────
      fjordmal:         { font: 'Floki' },               // Fjordmål — Fjord region
      gratstrandsmal:   { font: 'Floki' },               // Gråtstrandsmål — Weeping coast
      sangoymal:        { font: 'Olde Thorass' },        // Sangøymål — Song-isle
      myrmal:           { font: 'Olde Thorass' },        // Myrmål — Mire-speech
      askeskogsmal:     { font: 'Olde Espruar' },        // Askeskogsmål — Ash-forest
      skjoldfjellsmal:  { font: 'Davek' },               // Skjoldfjellsmål — Shield-mountain
      beinmarksmal:     { font: 'High Drowic' },         // Beinmarksmål — Bone-march
      hvitviddemal:     { font: 'Ny Stormning' },        // Hvitviddemål — White-expanse
      strupemal:        { font: 'Kargi' },               // Strupemål — Throat-land
      sommerdalsmal:    { font: 'Valmaric' },            // Sommerdalsmål — Summer-vale
    };

    /* ------------------------------------------------------------------ */
    /*  Language loading                                                   */
    /* ------------------------------------------------------------------ */

    async getLanguages() {
      if (this.replaceLanguages) {
        this.languages = {};
        return;
      }

      const languagesSetting = game.settings.get('polyglot', 'Languages');
      const dsLanguages = CONFIG?.DRAW_STEEL?.languages ?? {};

      this.languages = Object.keys(dsLanguages).reduce((output, lang) => {
        const entry = dsLanguages[lang];
        // CONFIG.DRAW_STEEL.languages entries may be { label: "..." }
        // objects (Draw Steel system) or plain strings (older injection).
        const label =
          typeof entry === 'object' && entry !== null ? entry.label : entry;

        output[lang] = {
          label: label || lang,
          font:
            languagesSetting[lang]?.font ||
            this.languages[lang]?.font ||
            this.defaultFont,
          rng: languagesSetting[lang]?.rng ?? 'default',
        };

        return output;
      }, {});
    }

    /* ------------------------------------------------------------------ */
    /*  Actor language detection                                          */
    /* ------------------------------------------------------------------ */

    getUserLanguages(actor) {
      const knownLanguages = new Set();
      const literateLanguages = new Set();

      try {
        const actorLangs = actor.system?.biography?.languages;
        if (actorLangs) {
          for (const lang of actorLangs) {
            knownLanguages.add(lang);
          }
        }
      } catch {
        // Actor may not have languages; silently ignore.
      }

      return [knownLanguages, literateLanguages];
    }

    /* ------------------------------------------------------------------ */
    /*  Defaults & config helpers                                         */
    /* ------------------------------------------------------------------ */

    getSystemDefaultLanguage() {
      return 'svellspraak';
    }

    addToConfig(key, lang) {
      if (CONFIG?.DRAW_STEEL?.languages) {
        CONFIG.DRAW_STEEL.languages[key] = { label: lang };
      }
    }

    removeFromConfig(key) {
      if (CONFIG?.DRAW_STEEL?.languages) {
        delete CONFIG.DRAW_STEEL.languages[key];
      }
    }
  }

  // Register with Polyglot — this overrides the built-in Draw Steel provider.
  game.polyglot.api.registerModule(MODULE_ID, SvellheimLanguageProvider);
  console.log(`[${MODULE_ID}] Registered Svellheim Polyglot language provider.`);
});
