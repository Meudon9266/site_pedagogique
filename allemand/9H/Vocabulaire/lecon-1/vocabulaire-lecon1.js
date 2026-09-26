(function () {
  "use strict";

  const STORAGE_KEY = "site_pedagogique:allemand:9H:vocabulaire:lecon-1:selection:v1";
  const EVENT_NAME = "vocabulaire-lecon1:changed";
  const VERSION = 1;

  const WORDS = Object.freeze([
    { id: "bonjour", allemand: "Guten Tag!", francais: "Bonjour !", categorie: "expression" },
    { id: "au-revoir", allemand: "Auf Wiedersehen!", francais: "Au revoir !", categorie: "expression" },
    { id: "comment-ca-va", allemand: "Wie geht es dir?", francais: "Comment vas-tu ?", categorie: "expression" },
    { id: "ca-va-bien", allemand: "Mir geht es gut.", francais: "Je vais bien.", categorie: "expression" },
    { id: "ecole", allemand: "die Schule", francais: "l’école", categorie: "nom" },
    { id: "cahier", allemand: "das Heft", francais: "le cahier", categorie: "nom" },
    { id: "crayon", allemand: "der Bleistift", francais: "le crayon", categorie: "nom" },
    { id: "apprendre", allemand: "lernen", francais: "apprendre", categorie: "verbe" },
    { id: "ecrire", allemand: "schreiben", francais: "écrire", categorie: "verbe" },
    { id: "lire", allemand: "lesen", francais: "lire", categorie: "verbe" },
    { id: "facile", allemand: "einfach", francais: "facile", categorie: "adjectif" },
    { id: "difficile", allemand: "schwierig", francais: "difficile", categorie: "adjectif" }
  ]);

  const knownIds = new Set(WORDS.map((word) => word.id));

  function emptySelection() {
    return { version: VERSION, updatedAt: null, items: {} };
  }

  function normalizeSelection(raw) {
    const normalized = emptySelection();
    if (!raw || typeof raw !== "object" || !raw.items || typeof raw.items !== "object") {
      return normalized;
    }

    for (const [id, value] of Object.entries(raw.items)) {
      if (!knownIds.has(id) || !value || typeof value !== "object") continue;
      const prioritaire = Boolean(value.prioritaire);
      const choisi = prioritaire || Boolean(value.choisi);
      if (choisi || prioritaire) normalized.items[id] = { choisi, prioritaire };
    }

    normalized.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : null;
    return normalized;
  }

  function readSelection() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? normalizeSelection(JSON.parse(stored)) : emptySelection();
    } catch (error) {
      console.warn("Sélection de vocabulaire illisible :", error);
      return emptySelection();
    }
  }

  function writeSelection(selection) {
    const normalized = normalizeSelection(selection);
    normalized.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: getItems() }));
    return normalized;
  }

  function getItems(options) {
    const settings = Object.assign({ choisisSeulement: false, prioritairesSeulement: false, prioritesEnPremier: false }, options);
    const selection = readSelection();
    let items = WORDS.map((word) => {
      const state = selection.items[word.id] || { choisi: false, prioritaire: false };
      return Object.assign({}, word, state);
    });

    if (settings.choisisSeulement) items = items.filter((item) => item.choisi);
    if (settings.prioritairesSeulement) items = items.filter((item) => item.prioritaire);
    if (settings.prioritesEnPremier) items.sort((a, b) => Number(b.prioritaire) - Number(a.prioritaire));
    return items;
  }

  function setItemState(id, patch) {
    if (!knownIds.has(id)) throw new Error("Identifiant de vocabulaire inconnu : " + id);
    const selection = readSelection();
    const current = selection.items[id] || { choisi: false, prioritaire: false };
    const next = {
      choisi: patch && "choisi" in patch ? Boolean(patch.choisi) : current.choisi,
      prioritaire: patch && "prioritaire" in patch ? Boolean(patch.prioritaire) : current.prioritaire
    };

    const explicitementDecoche = patch && "choisi" in patch && !Boolean(patch.choisi);
    if (explicitementDecoche) {
      next.choisi = false;
      next.prioritaire = false;
    } else if (next.prioritaire) {
      next.choisi = true;
    }
    if (next.choisi || next.prioritaire) selection.items[id] = next;
    else delete selection.items[id];
    writeSelection(selection);
    return getItems().find((item) => item.id === id);
  }

  function resetSelection() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: getItems() }));
  }

  function subscribe(callback) {
    const onCustomEvent = (event) => callback(event.detail || getItems());
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) callback(getItems());
    };
    window.addEventListener(EVENT_NAME, onCustomEvent);
    window.addEventListener("storage", onStorage);
    return function unsubscribe() {
      window.removeEventListener(EVENT_NAME, onCustomEvent);
      window.removeEventListener("storage", onStorage);
    };
  }

  window.VocabulaireLecon1 = Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    eventName: EVENT_NAME,
    words: WORDS,
    getItems,
    readSelection,
    setItemState,
    resetSelection,
    subscribe
  });
})();
