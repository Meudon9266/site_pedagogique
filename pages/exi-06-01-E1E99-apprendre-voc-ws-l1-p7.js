/* ==========================================================================
   Entraînement au vocabulaire – moteur de jeu
   --------------------------------------------------------------------------
   Principe des noms : « nom.html » charge « nom.js », qui charge « nom.json ».
   Pour une autre liste : copier les trois fichiers et leur donner le même
   nouveau nom (seules les extensions diffèrent).

   Champs lus dans le JSON (par mot, dans « mots ») :
     id, rubrique, type, fr, <langue_reponse> (ex. « en »),
     detrompeurs_credibles [3], detrompeurs_orthographiques [3],
     lettres_difficiles {indices, lettres, modele},
     syllabe_difficile {texte, index}
   Les modes dont les champs manquent sont simplement désactivés.
   Réglages, mots appris et records sont gardés dans le localStorage,
   sous des clés préfixées par le nom du fichier.
   ========================================================================== */
(function () {
  "use strict";

  const BASE = window.APP_BASE ||
    decodeURIComponent(location.pathname.split("/").pop() || "").split(".")[0] || "vocabulaire";

  /* ---------- Stockage local ---------- */
  const store = {
    get(k, def) {
      try { const v = localStorage.getItem(BASE + ":" + k); return v === null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set(k, v) { try { localStorage.setItem(BASE + ":" + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(BASE + ":" + k); } catch (e) { /* rien */ } }
  };

  const DEFAULTS = { legerQuestions: 10, travailMinutes: 5, defiSerie: 10, seuilSu: 3, prononcer: true, autoNext: true, autoDelay: 2, voixDE: "Katja", voixNom: "" };
  let settings = Object.assign({}, DEFAULTS, store.get("reglages", {}));

  /* ---------- Données ---------- */
  let DATA = null, WORDS = [], byId = {}, TGT = "en", CATS = [], GROUPS = {};
  /* Bibliothèque des listes de mots mémorisées dans ce navigateur :
       « listes »         → { id: { titre, sous_titre, fichier, date, n } }
       « json:<id> »      → contenu complet de la liste
       « listeCourante »  → id de la dernière liste utilisée (rechargée au démarrage)
     La progression (sélection, mots appris par exercice, séries, records, dernier exercice) est rangée par liste. */
  let LID = "";
  const lstore = {
    get: (k, def) => store.get("L:" + LID + ":" + k, def),
    set: (k, v) => store.set("L:" + LID + ":" + k, v),
    del: k => store.del("L:" + LID + ":" + k)
  };
  /* « appris » dépend de l'exercice : un mot appris en mode 4 ne l'est pas forcément en mode 6.
       appris  → { idMode: Set(idsMots) }      series → { idMode: { idMot: bonnes réponses d'affilée } } */
  let selection = new Set(), appris = {}, streaks = {};
  const learnedIn = m => (appris[m] ||= new Set());
  const learnedAny = () => { const u = new Set(); Object.values(appris).forEach(st => st.forEach(id => u.add(id))); return u; };
  let parcours = store.get("parcours", "leger");
  let G = null; // partie en cours

  const LANG_NAME = { en: "anglais", de: "allemand", it: "italien", es: "espagnol" };
  const LANG_VOICE = { en: "en-GB", de: "de-DE", it: "it-IT", es: "es-ES" };
  const langName = () => LANG_NAME[TGT] || "étranger";

  const MODES = [
    { id: "1", nom: "Découverte", desc: () => `Mot ${langName()} → choisir le sens français`, kind: "qcm1" },
    { id: "2", nom: "Apprentissage", desc: () => `Mot français → choisir le mot ${langName()}`, kind: "qcm2" },
    { id: "3", nom: "Apprentissage +", desc: () => "Mot français → choisir parmi des mots ressemblants", kind: "qcm3", field: "detrompeurs_credibles" },
    { id: "3bis", nom: "Pièges d'orthographe", desc: () => "Mot français → trouver la bonne orthographe", kind: "qcmOrth", field: "detrompeurs_orthographiques" },
    { id: "4", nom: "Lettres difficiles", desc: () => "Compléter les lettres qui piègent", kind: "lettres", field: "lettres_difficiles" },
    { id: "5", nom: "Syllabe difficile", desc: () => "Compléter la syllabe qui piège", kind: "syllabe", field: "syllabe_difficile" },
    { id: "6", nom: "Taper la réponse", desc: () => `Mot français → écrire le mot ${langName()}`, kind: "taper" },
    { id: "7", nom: "Révision", desc: () => "Revoir les mots appris ; les oubliés retournent à l'étude", kind: "revision" }
  ];
  const PARCOURS = {
    leger: { nom: "Léger", desc: () => `${settings.legerQuestions} questions : erreurs et temps` },
    travail: { nom: "Travail", desc: () => `un maximum de réponses justes en ${settings.travailMinutes} min` },
    defi: { nom: "Défi", desc: () => `${settings.defiSerie} réponses justes d'affilée, le plus vite possible` }
  };

  /* ---------- Utilitaires ---------- */
  const app = () => document.getElementById("app");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tgt = w => (w && w[TGT] != null ? String(w[TGT]) : "");
  const LA = () => `lang="${esc(TGT)}"`;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function fmtClock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
  function fmtLong(ms) { const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`; }
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  function save() {
    if (LID) {
      lstore.set("selection", [...selection]);
      lstore.set("appris", Object.fromEntries(Object.entries(appris).map(([m, st]) => [m, [...st]])));
      lstore.set("series", streaks);
    }
    store.set("parcours", parcours);
  }
  function modeOK(m, w) { return !m.field || (w[m.field] != null); }

  function speakBtn(text) {
    if (!("speechSynthesis" in window)) return "";
    return `<button class="speak" data-act="speak" data-arg="${esc(text)}" title="Écouter" aria-label="Écouter la prononciation">🔊</button>`;
  }
  /* =====================================================
     voicesDE.js (intégré) – voix TTS allemandes Katja et Conrad
     Adaptations : pas d'erreur si la synthèse vocale est absente,
     préférence pour les voix « Online (Natural) » d'Edge,
     et « male » ne capte plus les voix « female ».
     ===================================================== */
  const VoicesDE = (function () {
    const synth = window.speechSynthesis;
    let voices = [], ready = false;
    function init() { if (!synth) return; voices = synth.getVoices() || []; ready = voices.length > 0; }
    if (synth) { if (synth.addEventListener) synth.addEventListener("voiceschanged", init); init(); }
    function findVoice(matchFn) {
      if (!ready) init();
      if (!ready) return null;
      const m = voices.filter(matchFn);
      return m.find(v => /online|natural|premium/i.test(v.name)) || m[0] || null;
    }
    const isDE = v => /^de/i.test(v.lang);
    function getFemaleDE() { return findVoice(v => isDE(v) && /katja|anna|female|frau/i.test(v.name)) || findVoice(isDE); }
    function getMaleDE() { return findVoice(v => isDE(v) && /conrad|markus|\bmale\b|mann/i.test(v.name) && !/female/i.test(v.name)) || findVoice(isDE); }
    const profiles = {
      Katja:         { voice: () => getFemaleDE(), rate: 1.0, pitch: 1.0,  volume: 1.0 },
      Conrad:        { voice: () => getMaleDE(),   rate: 1.0, pitch: 1.0,  volume: 1.0 },
      KatjaNarratif: { voice: () => getFemaleDE(), rate: 0.9, pitch: 0.95, volume: 1.0 },
      KatjaRapide:   { voice: () => getFemaleDE(), rate: 1.2, pitch: 1.05, volume: 1.0 }
    };
    function createUtterance(text, profileName = "Katja") {
      const profile = profiles[profileName] || profiles.Katja;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "de-DE"; u.rate = profile.rate; u.pitch = profile.pitch; u.volume = profile.volume;
      const v = profile.voice(); if (v) u.voice = v;
      return u;
    }
    return {
      isReady: () => ready,
      getProfiles: () => Object.keys(profiles),
      voiceFor: name => (profiles[name] || profiles.Katja).voice(),
      createUtterance
    };
  })();
  window.VoicesDE = window.VoicesDE || VoicesDE;

  /* Synthèse vocale : voix de la bonne langue (Katja/Conrad pour l'allemand),
     et court délai après cancel() (sinon Chrome et Edge annulent parfois la lecture). */
  let VOICES = [];
  function loadVoices() { try { VOICES = window.speechSynthesis.getVoices() || []; } catch (e) { VOICES = []; } }
  if ("speechSynthesis" in window) {
    loadVoices();
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  }
  /* Les voix « en ligne » (Edge : Online (Natural)) passent par un service Microsoft qui refuse
     une partie des demandes (« synthesis-failed »), au hasard. Stratégie :
       1. réessayer la même voix après un court délai ;
       2. puis passer aux voix qui ont déjà fonctionné sur cet ordinateur (mémorisées) ;
       3. puis aux voix installées, puis aux autres voix de la même variante.
     La dernière voix qui a fonctionné devient la voix préférée en mode automatique. */
  const isLocal = v => v && v.localService !== false;
  const langVoicesAll = () => {
    const pre = TGT.toLowerCase();
    return VOICES.filter(v => v.lang.toLowerCase().replace("_", "-").startsWith(pre));
  };
  const langVoices = () => langVoicesAll().filter(v => !excluded(v));
  const okKey = () => "voixOK:" + TGT, koKey = () => "voixKO:" + TGT, lastKey = () => "voixDerniere:" + TGT;
  const workedSet = () => new Set(store.get(okKey(), []));
  const failedMap = () => store.get(koKey(), {});
  function noteWorked(v) {
    const set = workedSet(); set.add(v.name);
    store.set(okKey(), [...set]); store.set(lastKey(), v.name);
    const m = failedMap(); if (m[v.name]) { delete m[v.name]; store.set(koKey(), m); }
  }
  function noteFailed(v) { const m = failedMap(); m[v.name] = (m[v.name] || 0) + 1; store.set(koKey(), m); }
  /* Voix écartée : a échoué au moins deux fois sans jamais fonctionner ici */
  const isBad = v => v && !workedSet().has(v.name) && (failedMap()[v.name] || 0) >= 2;
  /* Voix qui ont fonctionné lors du test sur l'ordinateur de classe (entendues « oui »),
     dans l'ordre de préférence : anglais britannique, puis canadien, australien, Hong Kong. */
  const TESTED_OK = { en: [/\bLibby\b/, /\bSonia\b/, /\bRyan Online/, /\bThomas\b/, /\bMaisie\b/, /\bLiam\b/,
    /\bNatasha\b/, /\bWilliam Online/, /\bWilliam Multilingual/, /\bYan\b/] };
  /* Voix refusées (qualité jugée insuffisante au test) : jamais utilisées automatiquement */
  const EXCLUDED = { en: [/\bClara\b/, /\bSam Online/] };
  const excluded = v => v && (EXCLUDED[TGT] || []).some(re => re.test(v.name));
  const testedOK = v => (TESTED_OK[TGT] || []).some(re => re.test(v.name));
  const hasWorked = v => v && !excluded(v) && (workedSet().has(v.name) || testedOK(v));
  /* Voix autorisées : seulement celles qui ont déjà fonctionné une fois.
     Si aucune n'a encore fonctionné (autre ordinateur), toutes les voix sont essayées pour en trouver une. */
  function allowedVoices() {
    const known = langVoices().filter(v => hasWorked(v) && !isBad(v));
    return known.length ? known : langVoices().filter(v => !isBad(v));
  }
  function orderOf(v) {
    const i = (TESTED_OK[TGT] || []).findIndex(re => re.test(v.name));
    return (workedSet().has(v.name) ? 0 : 1) * 100 + (i < 0 ? 50 : i);
  }
  const voiceRank = v => (hasWorked(v) ? 0 : 2) + (isLocal(v) ? 0 : 1) + (isBad(v) ? 20 : 0);

  function pickVoice() {
    const find = n => n && VOICES.find(x => x.name === n);
    if (settings.voixNom && find(settings.voixNom) && !excluded(find(settings.voixNom))) return find(settings.voixNom);          // choix manuel
    if (TGT === "de") { const v = VoicesDE.voiceFor(settings.voixDE); if (v && !isBad(v)) return v; } // Katja / Conrad
    const last = find(store.get(lastKey(), "")); if (last && !isBad(last) && !excluded(last)) return last;       // dernière voix qui a marché
    const allowed = allowedVoices();
    if (allowed.some(hasWorked)) return allowed.sort((a, b) => orderOf(a) - orderOf(b))[0];  // voix qui ont déjà marché
    const want = (LANG_VOICE[TGT] || TGT).toLowerCase(), l = v => v.lang.toLowerCase().replace("_", "-");
    const all = allowed, same = all.filter(v => l(v) === want);
    const pref = list => list.find(isLocal) || list.find(v => /natural|online/i.test(v.name)) || list[0];
    return pref(same) || pref(all) || null;
  }
  /* Liste ordonnée des voix à essayer pour une lecture */
  function voiceChain() {
    const first = pickVoice(); if (!first) return [];
    const want = first.lang.toLowerCase();
    const rank = v => voiceRank(v) + (v.lang.toLowerCase() === want ? 0 : 1);
    const pool = allowedVoices();
    const rest = pool.filter(v => v.name !== first.name)
      .sort((a, b) => pool.some(hasWorked) ? orderOf(a) - orderOf(b) : rank(a) - rank(b));
    return [first, first, ...rest].slice(0, 5);   // la 1re voix est essayée deux fois
  }
  function voiceInfo() {
    if (!("speechSynthesis" in window)) return "Ce navigateur ne sait pas lire à voix haute.";
    loadVoices();
    if (!VOICES.length) return "Les voix ne sont pas encore chargées (réessayez dans un instant).";
    const v = pickVoice();
    if (!v) return `Aucune voix ${langName()} sur cet ordinateur.`;
    const n = langVoices().filter(hasWorked).length;
    return `Voix utilisée : ${v.name}${isLocal(v) ? " (installée)" : " (en ligne)"}` +
      (langVoices().some(isLocal) ? "" : ` — aucune voix ${langName()} installée : seules les voix en ligne sont disponibles.`) +
      (n === 1 ? " Seule la voix ✓ (déjà entendue) est utilisée." : n ? ` Seules les ${n} voix ✓ (déjà entendues) sont utilisées.` : " Aucune voix n'a encore fonctionné : la page les essaie toutes.") +
      (Object.keys(failedMap()).length ? ` Les voix marquées ✗ ont échoué plusieurs fois et sont écartées.` : "");
  }
  let SPEAK_ID = 0;
  function speak(text) {
    if (!("speechSynthesis" in window)) { toast("Ce navigateur ne sait pas lire les mots à voix haute."); return; }
    const synth = window.speechSynthesis, id = ++SPEAK_ID;
    loadVoices();
    const chain = voiceChain();
    let said = String(text).replace(/[()]/g, "");
    if (TGT === "de") said = said.replace(/,\s*(?:[-¨"”]|\u00a8)[^,]*$/, ""); // « die Schule, -n » → « die Schule »
    const build = v => {
      let u;
      if (TGT === "de") u = VoicesDE.createUtterance(said, settings.voixDE);
      else { u = new SpeechSynthesisUtterance(said); u.rate = 0.9; u.volume = 1; }
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = LANG_VOICE[TGT] || TGT;
      return u;
    };
    function attempt(i) {
      if (id !== SPEAK_ID) return;                       // une lecture plus récente a été demandée
      const v = chain[i] || null;
      const u = build(v);
      let started = false, over = false;
      const fail = err => {
        if (over || id !== SPEAK_ID) return; over = true; clearTimeout(guard);
        if (v) noteFailed(v);
        if (i + 1 < chain.length) setTimeout(() => attempt(i + 1), i === 0 ? 500 : 250);
        else toast(`Lecture impossible (${err}). Le service de voix en ligne ne répond pas : réessayez dans un instant, ou installez une voix ${langName()} dans Windows.`);
      };
      u.onstart = () => { started = true; clearTimeout(guard); if (v) noteWorked(v); };
      u.onend = () => { over = true; clearTimeout(guard); };
      u.onerror = e => { if (e.error === "interrupted" || e.error === "canceled") { over = true; clearTimeout(guard); return; } fail(e.error || "erreur"); };
      const guard = setTimeout(() => { if (!started) { synth.cancel(); fail("pas de réponse"); } }, 6000);
      if (synth.paused) synth.resume();
      synth.speak(u);
    }
    synth.cancel();
    setTimeout(() => attempt(0), 80);
  }

  /* Réponses acceptées en mode « taper » : parenthèses facultatives, alternatives a/b */
  const norm = s => String(s).toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim();
  function accepted(ans) {
    const set = new Set([norm(ans), norm(ans.replace(/[()]/g, "")), norm(ans.replace(/\s*\([^)]*\)\s*/g, " "))]);
    const m = ans.match(/\(([^)]*\/[^)]*)\)/);
    if (m) m[1].split("/").forEach(alt => set.add(norm(ans.replace(m[0], alt))));
    set.delete("");
    return set;
  }

  /* ---------- Chargement du JSON ---------- */
  /* Identifiant d'une liste : champ « id » du fichier, sinon titre, sinon nom de fichier */
  const slug = x => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const listId = (d, fichier) => slug(d.id) || slug(d.titre) || slug(String(fichier || "").replace(/\.[^.]*$/, "")) || "liste";
  const library = () => store.get("listes", {});

  /* Complète un fichier JSON venu d'ailleurs : ids manquants, titre par défaut */
  function normalize(d, fichier) {
    const L = d.langue_reponse || "en", used = new Set();
    d.mots = d.mots.filter(w => w && w.fr != null && w[L] != null);
    d.mots.forEach(w => {
      let id = w.id != null && w.id !== "" ? String(w.id) : "w-" + slug(w[L]);
      while (used.has(id)) id += "-b";
      used.add(id); w.id = id;
    });
    if (!d.titre) d.titre = String(fichier || BASE).replace(/\.[^.]*$/, "");
    return d;
  }

  /* Range une liste dans la bibliothèque ; renvoie son id (ou null si la mémoire est pleine) */
  function remember(d, fichier) {
    const id = listId(d, fichier);
    if (!store.set("json:" + id, d)) return null;
    const lib = library();
    // même série déjà mémorisée sous un autre identifiant (ex. avant l'ajout du champ « id ») : on garde sa progression
    if (!lib[id] && d.titre) {
      const same = Object.keys(lib).find(k => k !== id && lib[k].titre === d.titre && (lib[k].sous_titre || "") === (d.sous_titre || ""));
      if (same) {
        ["selection", "appris", "series", "records", "derniere"].forEach(k => {
          const v = store.get("L:" + same + ":" + k, null);
          if (v !== null) { store.set("L:" + id + ":" + k, v); store.del("L:" + same + ":" + k); }
        });
        store.del("json:" + same); delete lib[same];
        if (store.get("listeCourante", null) === same) store.set("listeCourante", id);
      }
    }
    lib[id] = { titre: d.titre || "", sous_titre: d.sous_titre || "", fichier: fichier || "", date: new Date().toISOString(), n: d.mots.length };
    store.set("listes", lib);
    return id;
  }

  /* Ancienne version : progression stockée sans liste → rattachée à la première liste ouverte */
  function migrateLegacy() {
    const old = ["selection", "series", "records"].filter(k => store.get(k, null) !== null);
    store.del("sus");
    if (!old.length || lstore.get("selection", null) !== null) return;
    old.forEach(k => { lstore.set(k, store.get(k, null)); store.del(k); });
    store.del("json"); store.del("importe");
  }

  function openList(id) {
    const d = store.get("json:" + id, null);
    if (!d || !valid(d)) return false;
    store.set("listeCourante", id);
    init(d, id);
    return true;
  }

  async function boot() {
    // 1. la page lit « nom.json » quand elle le peut (site web) et met à jour la bibliothèque
    let fetched = null;
    try {
      const r = await fetch(encodeURIComponent(BASE) + ".json", { cache: "no-store" });
      if (r.ok) fetched = await r.json();
    } catch (e) { /* file:// : lecture directe impossible dans la plupart des navigateurs */ }
    let fetchedId = null;
    if (fetched && valid(fetched)) fetchedId = remember(normalize(fetched, BASE + ".json"), BASE + ".json");
    // 2. on rouvre la dernière liste utilisée ; sinon celle du fichier ; sinon la plus récente
    const cur = store.get("listeCourante", null);
    if (cur && openList(cur)) return;
    if (fetchedId && openList(fetchedId)) return;
    const legacy = store.get("json", null);            // ancienne version de la page
    if (legacy && valid(legacy)) { const id = remember(normalize(legacy, BASE + ".json"), BASE + ".json"); if (id && openList(id)) return; }
    const recent = Object.entries(library()).sort((a, b) => (b[1].date || "").localeCompare(a[1].date || ""));
    for (const [id] of recent) if (openList(id)) return;
    renderLoader();
  }
  function valid(d) { return d && Array.isArray(d.mots) && d.mots.length > 0; }

  function renderLoader(msg) {
    app().innerHTML = `
      <section class="panel loader">
        <h2>Charger la liste de mots</h2>
        <p>Choisissez le fichier <strong>${esc(BASE)}.json</strong>, qui doit se trouver à côté de cette page
        (ou un autre fichier de mots au format .json).
        Il sera gardé en mémoire dans ce navigateur : il n'y aura plus besoin de le recharger.</p>
        <label class="drop" id="drop">
          <input type="file" id="jsonFile" accept=".json,application/json">
          <span>Cliquez ici ou déposez le fichier</span>
        </label>
        ${msg ? `<p class="warn">${esc(msg)}</p>` : ""}
      </section>`;
    const input = document.getElementById("jsonFile"), drop = document.getElementById("drop");
    input.onchange = () => input.files[0] && readFile(input.files[0]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]); };
  }
  /* imported = vrai pour « Importer ma liste » (accueil ou réglages) : on arrive alors sur la sélection des mots ;
     au premier chargement du fichier du module, on arrive sur l'accueil. */
  function readFile(f, imported) {
    const r = new FileReader();
    r.onload = () => {
      try {
        let data;
        try { data = JSON.parse(r.result); } catch (e) { throw new Error("ce n'est pas un fichier JSON valide"); }
        const res = { data, warn: [] };
        if (!res.data || !Array.isArray(res.data.mots)) throw new Error("la liste « mots » est absente");
        const d = normalize(res.data, f.name);
        if (!valid(d)) throw new Error("aucun mot complet (il faut au moins « fr » et « " + (d.langue_reponse || "en") + " »)");
        const id = remember(d, f.name);
        if (!id) throw new Error("la mémoire du navigateur est pleine : supprimez une liste mémorisée dans ⚙ Réglages");
        const dlg = document.getElementById("settings"); if (dlg && dlg.open) dlg.close();
        openList(id);
        if (imported) renderSelect();
        const n = d.mots.length;
        toast(`« ${d.titre} » : ${plural(n, "mot chargé", "mots chargés")} et ${n > 1 ? "mémorisés" : "mémorisé"} dans ce navigateur.` +
          (res.warn.length ? ` ${res.warn.length} remarque(s) : ${res.warn.slice(0, 3).join(" · ")}${res.warn.length > 3 ? " …" : ""}` : ""));
      } catch (err) {
        if (DATA) toast("Ce fichier ne peut pas être lu : " + err.message + ".");
        else renderLoader("Ce fichier ne peut pas être lu : " + err.message + ".");
      }
    };
    r.readAsText(f, "utf-8");
  }

  /* Éditeur : celui du module (« racine.editeur.html ») s'il existe à côté de la page,
     sinon l'éditeur commun rangé dans le même dossier que les exercices. */
  const EDITEUR_COMMUN = "apprendreVoc.editeur.html";
  function fileExists(url) {
    if (location.protocol !== "file:")
      return fetch(url, { method: "HEAD", cache: "no-store" }).then(r => r.ok, () => false);
    // En local (file://), fetch est bloqué : on tente de charger le fichier comme script ;
    // « onload » s'il existe, « onerror » s'il manque (l'erreur de lecture du HTML est ignorée).
    return new Promise(res => {
      const sc = document.createElement("script"); let done = false;
      const stop = e => { if (e.filename && e.filename.indexOf(url) >= 0) e.preventDefault(); };
      const fin = v => { if (done) return; done = true; sc.remove(); setTimeout(() => window.removeEventListener("error", stop), 0); res(v); };
      window.addEventListener("error", stop);
      sc.onload = () => fin(true); sc.onerror = () => fin(false); setTimeout(() => fin(false), 3000);
      sc.src = url; document.head.appendChild(sc);
    });
  }
  async function openEditor() {
    // la fenêtre est ouverte tout de suite (sinon le navigateur bloque la fenêtre surgissante), puis dirigée
    const win = window.open("", "_blank");
    const specific = encodeURIComponent(BASE) + ".editeur.html";
    let file = specific;
    if (!(await fileExists(specific))) {
      file = EDITEUR_COMMUN;
      if (!(await fileExists(EDITEUR_COMMUN))) {
        if (win) win.close();
        toast(`Aucun éditeur trouvé : placez « ${EDITEUR_COMMUN} » dans le dossier des exercices.`);
        return;
      }
    }
    // La liste affichée est transmise à l'éditeur choisi (clé reconstruite à partir de SA racine)
    const edRoot = decodeURIComponent(file).split(".")[0], entry = library()[LID] || {};
    try {
      localStorage.setItem(edRoot + ".editeur:transfert", JSON.stringify({ date: Date.now(), name: entry.fichier || (LID + ".json"), doc: DATA }));
    } catch (e) { toast("Impossible de transmettre la liste à l'éditeur (mémoire du navigateur pleine)."); }
    const abs = new URL(file, location.href).href;
    if (win) win.location.href = abs;
    else if (!window.open(abs, "_blank")) toast(`Le navigateur a bloqué l'ouverture : ouvrez « ${decodeURIComponent(file)} » vous-même.`);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = (slug(DATA.id) || slug(DATA.titre) || BASE) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Liste exportée dans « ${a.download} ».`);
  }
  const PROMPT = `Je te joins une page de vocabulaire d'un manuel scolaire (photo ou PDF). Crée à partir de cette page un fichier de mots au format JSON pour un exercice d'entraînement destiné à des élèves francophones.

Réponds uniquement avec le contenu du fichier JSON, sans aucun commentaire avant ou après, en respectant exactement cette structure :

{
  "format": "liste-vocabulaire-1",
  "id": "<identifiant court de la série, ex. allemand-9h-kap1-wann>",
  "titre": "<titre de la série, ex. Wort-Schatz 9H – Kapitel 1 : Wann?>",
  "sous_titre": "<classe ou niveau, ex. Allemand 9H>",
  "langue_question": "fr",
  "langue_reponse": "<code de la langue apprise : en, de, it ou es>",
  "consigne": "<consigne, ex. Traduis en allemand. Pour les noms, écris l'article et le pluriel.>",
  "mots": [
    {
      "id": "<identifiant unique, ex. m-001>",
      "rubrique": "<rubrique du manuel>",
      "type": "<nom, verbe, adjectif, expression, heure ou mot interrogatif>",
      "<code de la langue apprise>": "<le mot, ex. die Woche, -n>",
      "fr": "<traduction française du manuel>",
      "detrompeurs_credibles": ["…", "…", "…"],
      "detrompeurs_orthographiques": ["…", "…", "…"],
      "lettres_difficiles": { "indices": [0, 0, 0] },
      "syllabe_difficile": { "texte": "…", "index": 0 }
    }
  ]
}

Règles :
1. Reprends tous les mots de la page, dans l'ordre, avec la traduction française du manuel. Garde les rubriques du manuel. Si deux entrées auraient la même traduction française, précise-la entre parenthèses pour qu'il n'y ait jamais d'ambiguïté.
2. Détrompeurs crédibles : 3 formes de la langue apprise, plausibles pour un élève francophone (sens ou construction proches, faux-amis, calques du français, erreur d'article ou de pluriel), mais fausses. Aucune ne doit être une traduction correcte, même dans une variante de la langue.
3. Détrompeurs orthographiques : 3 variantes mal orthographiées de la réponse, typiques d'un élève francophone (lettre oubliée, doublée ou inversée, graphie à la française), toutes différentes de la réponse.
4. Lettres difficiles : les positions (en partant de 0, espaces et ponctuation compris) des 3 lettres les plus difficiles à mémoriser pour un francophone ; seulement 2 si le mot a 3 lettres. Vérifie chaque position en comptant les caractères.
5. Syllabe difficile : un groupe de lettres qui figure tel quel dans le mot, et sa position (index du premier caractère, en partant de 0).
6. Pour l'allemand, écris les noms comme dans le manuel, avec article et pluriel : die Schule, -n.
7. Le fichier doit être un JSON valide (guillemets droits, pas de virgule finale).`;

  function copyText(txt) {
    const done = () => toast("Prompt copié. Collez-le dans Claude avec la page du manuel.");
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = document.getElementById("promptText"); if (!ta) return;
      ta.focus(); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Sélectionnez le texte puis copiez-le avec Ctrl+C."); }
    }
  }

  /* Module renommé : la progression d'une liste est rangée sous le nom du fichier.
     Si rien n'existe sous le nom actuel, on reprend celle de la même liste (même id)
     enregistrée sous un autre nom de fichier dans ce navigateur. */
  function adoptProgress() {
    const KEYS = ["selection", "appris", "series", "records", "derniere"];
    if (KEYS.some(k => lstore.get(k, null) !== null)) return;
    try {
      const own = BASE + ":L:" + LID + ":";
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const m = key && key.match(/^(.*):L:(.*):(selection|appris|series|records|derniere)$/);
        if (!m || m[2] !== LID || key.startsWith(own)) continue;
        const k = m[3];
        if (lstore.get(k, null) === null) lstore.set(k, JSON.parse(localStorage.getItem(key)));
      }
      // très ancienne version (une seule liste par fichier : « nom:json », « nom:sus »…)
      if (KEYS.every(k => lstore.get(k, null) === null)) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i), m = key && key.match(/^(.*):json$/);
          if (!m || m[1] === BASE) continue;
          let d = null; try { d = JSON.parse(localStorage.getItem(key)); } catch (e) { continue; }
          if (!d || listId(d) !== LID) continue;
          KEYS.forEach(k => { const v = localStorage.getItem(m[1] + ":" + k); if (v !== null && lstore.get(k, null) === null) lstore.set(k, JSON.parse(v)); });
        }
      }
    } catch (e) { /* stockage indisponible */ }
  }

  function init(d, id) {
    stopTimers(); G = null;
    LID = id || listId(d);
    migrateLegacy();
    adoptProgress();
    selection = new Set(lstore.get("selection", []));
    const ap = lstore.get("appris", {});
    appris = {}; Object.entries(ap && typeof ap === "object" && !Array.isArray(ap) ? ap : {}).forEach(([m, ids]) => { appris[m] = new Set(ids); });
    streaks = lstore.get("series", {});
    if (Object.values(streaks).some(v => typeof v === "number")) streaks = {};   // ancien format (séries globales)
    DATA = d; WORDS = d.mots; TGT = d.langue_reponse || "en";
    byId = Object.fromEntries(WORDS.map(w => [w.id, w]));
    GROUPS = {}; WORDS.forEach(w => (GROUPS[w.rubrique || "Mots"] ||= []).push(w));
    CATS = Object.keys(GROUPS);
    selection = new Set([...selection].filter(id => byId[id]));
    Object.keys(appris).forEach(m => { appris[m] = new Set([...appris[m]].filter(id => byId[id])); });
    // Titre général de la page = titre de la série de mots chargée
    document.getElementById("title").textContent = d.titre || BASE;
    document.getElementById("subtitle").textContent = d.sous_titre || "";
    document.title = (d.titre || BASE) + " – entraînement";
    save();
    renderHome();
  }

  /* ---------- Accueil : 4 accès simplifiés ---------- */
  const modeLabel = m => `${m.id === "3bis" ? "3 bis" : m.id}. ${m.nom}`;
  function whenText(t) {
    const d = new Date(t), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "aujourd'hui à " + d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === y.toDateString()) return "hier";
    return "le " + d.toLocaleDateString("fr-CH", { day: "numeric", month: "long" });
  }
  /* Dernier exercice fait avec cette liste : mode, parcours et mots */
  function lastActivity() {
    const d = lstore.get("derniere", null);
    if (!d || !Array.isArray(d.selection)) return null;
    const ids = d.selection.filter(id => byId[id]);
    return ids.length ? Object.assign({}, d, { selection: ids }) : null;
  }
  function renderHome() {
    stopTimers(); G = null;
    const last = lastActivity(), m = last && MODES.find(x => x.id === last.mode);
    const words = last ? last.selection.map(id => byId[id]) : [];
    const preview = words.slice(0, 6).map(w => esc(tgt(w))).join(", ") + (words.length > 6 ? ", …" : "");
    app().innerHTML = `
    <section class="home" aria-label="Accueil">
      <button class="htile h-resume" data-act="homeResume" ${last && m ? "" : "disabled"}>
        <span class="hicon" aria-hidden="true">▶</span><strong>Reprendre l'exercice précédent</strong>
        <span class="hdesc">${last && m ? `${esc(modeLabel(m))}${m.kind !== "revision" ? " · " + PARCOURS[last.parcours || "leger"].nom : ""} · ${plural(words.length, "mot", "mots")} · ${whenText(last.date)}` : "Aucun exercice fait pour l'instant avec cette liste."}</span>
      </button>
      <button class="htile h-same" data-act="homeSame" ${last ? "" : "disabled"}>
        <span class="hicon" aria-hidden="true">↻</span><strong>Mêmes mots, autre exercice</strong>
        <span class="hdesc">${last ? `${plural(words.length, "mot", "mots")} : <span ${LA()}>${preview}</span>` : "Disponible après un premier exercice."}</span>
      </button>
      <button class="htile h-new" data-act="homeNew">
        <span class="hicon" aria-hidden="true">✚</span><strong>Nouvelle sélection de mots</strong>
        <span class="hdesc">Choisir dans la liste de ${plural(WORDS.length, "mot", "mots")}, ou tirer au hasard.</span>
      </button>
      <div class="htile h-import">
        <button class="hmain" data-act="homeImport">
          <span class="hicon" aria-hidden="true">📂</span><strong>Importer ma liste de mots</strong>
          <span class="hdesc">Un fichier .json au format de l'exercice.</span>
        </button>
        <button class="hinfo" data-act="importInfo" title="Informations sur l'importation" aria-label="Informations sur l'importation">i</button>
      </div>
    </section>`;
  }

  /* ---------- Écran 1 : choisir les mots ---------- */
  /* Couleurs pastel des catégories : [fond, fond sélectionné, bordure, couleur foncée] */
  const PASTELS = [
    ["#fff8d6", "#ffe98a", "#e8cf6a", "#7a5f00"],   // jaune
    ["#e3f5e6", "#b9e6c2", "#9fd3aa", "#1d6b34"],   // vert
    ["#efe6fa", "#d6c2f2", "#c2a8e6", "#5b3a91"],   // violet
    ["#fde7ee", "#f8c3d4", "#eeaabf", "#9a2a52"],   // rose
    ["#ffeedd", "#ffd2a8", "#f2bb85", "#8f450a"],   // orange
    ["#dff5f2", "#b3e6de", "#93d2c8", "#0f6a60"],   // menthe
    ["#f3f0e4", "#e2dbbf", "#cfc49a", "#5e5428"],   // sable
    ["#fbe9f7", "#f1c6e8", "#e2a6d6", "#83306f"]    // mauve
  ];
  const catColor = rub => PASTELS[Math.max(0, CATS.indexOf(rub || "Mots")) % PASTELS.length];
  const catStyle = rub => { const c = catColor(rub); return `style="--cbg:${c[0]};--con:${c[1]};--cbd:${c[2]};--cdk:${c[3]}"`; };

  function chip(w) {
    const on = selection.has(w.id);
    return `<button class="chip${on ? " on" : ""}" ${catStyle(w.rubrique)} data-act="toggle" data-arg="${esc(w.id)}" aria-pressed="${on}">
      <span class="t" ${LA()}>${esc(tgt(w))}</span><span class="f">${esc(w.fr)}</span></button>`;
  }
  function renderSelect() {
    stopTimers(); G = null;
    const n = selection.size;
    app().innerHTML = `
    <div class="grid-select">
      <section class="panel">
        <h2><span class="num">1</span> Choisir des mots dans la liste</h2>
        <p class="hint">Cliquez sur les mots à apprendre : un mot choisi est marqué ✔.</p>
        <div class="wordlist">
          ${CATS.map((c, i) => `<div class="group" ${catStyle(c)}><h3><span class="catdot"></span>${esc(c)}
            <span class="grp"><button class="link" data-act="grpAll" data-arg="${i}">tout</button>
            <button class="link" data-act="grpNone" data-arg="${i}">aucun</button></span></h3>
            <div class="chips">${GROUPS[c].map(chip).join("")}</div></div>`).join("")}
        </div>
        <div class="bar">
          <button class="btn primary" id="btnMem" data-act="memoriser" ${n ? "" : "disabled"}>Mémoriser ces mots (${n})</button>
          <button class="btn" data-act="clearSel">Tout décocher</button>
        </div>
      </section>
      <div class="side">
        <h2 class="side-title">Autres modalités de tirage</h2>
        <section class="panel quiet">
          <div class="draw">
            <h3><span class="num sm">2</span> Au hasard dans une catégorie</h3>
            <div class="row"><input type="number" id="nCat" min="1" value="${store.get("nCat", 8)}" aria-label="Nombre de mots">
              <span>mots dans</span>
              <select id="cat" aria-label="Catégorie">${CATS.map((c, i) => `<option value="${i}" ${store.get("cat", 0) == i ? "selected" : ""}>${esc(c)} (${GROUPS[c].length})</option>`).join("")}</select></div>
            <button class="btn small" data-act="drawCat">Tirer et commencer</button>
          </div>
          <div class="draw">
            <h3><span class="num sm">3</span> Au hasard dans toutes les catégories</h3>
            <div class="row"><input type="number" id="nAll" min="1" value="${store.get("nAll", 10)}" aria-label="Nombre de mots"><span>mots parmi ${WORDS.length}</span></div>
            <button class="btn small" data-act="drawAll">Tirer et commencer</button>
          </div>
        </section>
      </div>
    </div>`;
  }
  function updateMemButton() {
    const b = document.getElementById("btnMem"); if (!b) return;
    b.textContent = `Mémoriser ces mots (${selection.size})`; b.disabled = selection.size === 0;
  }
  function draw(list, n) {
    if (!list.length) return;
    const k = Math.max(1, Math.min(n || 1, list.length));
    if (k < n) toast(`Seulement ${plural(k, "mot disponible", "mots disponibles")} dans cette catégorie.`);
    selection = new Set(shuffle(list.slice()).slice(0, k).map(w => w.id));
    save(); renderSetup();
  }

  /* ---------- Écran 2 : parcours et mode ---------- */
  const selWords = () => [...selection].map(id => byId[id]).filter(Boolean);
  const toLearn = m => selWords().filter(w => modeOK(m, w) && !learnedIn(m.id).has(w.id));
  const learnedHere = m => selWords().filter(w => learnedIn(m.id).has(w.id)).length;

  function parcoursBlock() {
    return `<div class="parcours" role="radiogroup" aria-label="Parcours">
      ${Object.entries(PARCOURS).map(([k, p]) => `<label class="pc${parcours === k ? " on" : ""}">
        <input type="radio" name="parcours" value="${k}" ${parcours === k ? "checked" : ""}>
        <strong>${p.nom}</strong><span>${p.desc()}</span></label>`).join("")}
    </div>`;
  }
  function modeCards() {
    const recs = lstore.get("records", {});
    return `<div class="modes">${MODES.map(m => {
      let n, disabled, why = "";
      if (m.kind === "revision") { n = learnedAny().size; disabled = n === 0; why = disabled ? "aucun mot appris pour l'instant" : plural(n, "mot appris à revoir", "mots appris à revoir"); }
      else {
        const usable = selWords().filter(w => modeOK(m, w)).length, k = learnedHere(m);
        n = toLearn(m).length; disabled = n === 0;
        why = !usable ? "données absentes du fichier" : !n ? "tous les mots sont appris ici" : plural(n, "mot à apprendre", "mots à apprendre") + (k ? ` · ${k} appris` : "");
      }
      const r = recs[m.id + "|" + parcours];
      const rec = r && m.kind !== "revision" ? `<span class="rec">Record : ${recordText(r)}</span>` : "";
      return `<button class="mode m-${m.id}" data-act="start" data-arg="${m.id}" ${disabled ? "disabled" : ""}>
        <span class="mnum">${m.id === "3bis" ? "3 bis" : m.id}</span><strong>${m.nom}</strong>
        <span class="mdesc">${m.desc()}</span><span class="mcount">${why}</span>${rec}</button>`;
    }).join("")}</div>`;
  }
  function renderSetup() {
    stopTimers(); G = null;
    const words = [...selection].map(id => byId[id]).filter(Boolean);
    app().innerHTML = `
    <section class="panel">
      <div class="head-row"><h2>Mots à mémoriser</h2><span><button class="link" data-act="goSelect">Changer les mots</button> <button class="link" data-act="goHome">Accueil</button></span></div>
      <p>${plural(words.length, "mot choisi", "mots choisis")}. Un mot est « appris » dans un exercice après ${plural(settings.seuilSu, "bonne réponse", "bonnes réponses")} d'affilée dans cet exercice.</p>
      <div class="chips small">${words.map(w => `<span class="chip static" ${catStyle(w.rubrique)}><span class="t" ${LA()}>${esc(tgt(w))}</span><span class="f">${esc(w.fr)}</span></span>`).join("")}</div>
    </section>
    <section class="panel">
      <h2>Parcours</h2>${parcoursBlock()}
      <h2 class="mt">Mode d'apprentissage</h2>${modeCards()}
    </section>`;
  }

  /* ---------- Partie ---------- */
  function stopTimers() {
    if (G) { clearInterval(G.tick); clearTimeout(G.auto); }
  }
  function startGame(modeId) {
    const mode = MODES.find(m => m.id === modeId);
    if (!mode) return;
    stopTimers();
    G = {
      mode, parcours: mode.kind === "revision" ? "revision" : parcours,
      t0: performance.now(), tEnd: null, answered: 0, correct: 0, errors: 0, streak: 0,
      lastId: null, locked: false, pendingEnd: null, newlyLearned: [], confirmed: [], back: [], q: null
    };
    lstore.set("derniere", { mode: mode.id, parcours, selection: [...selection], date: Date.now() });
    if (mode.kind === "revision") {
      const any = learnedAny();
      G.queue = shuffle(WORDS.filter(w => any.has(w.id)).map(w => w.id));
      G.total = G.queue.length;
    }
    app().innerHTML = `
    <section class="game m-${mode.id}">
      <div class="hud">
        <span class="hmode">${mode.id === "3bis" ? "3 bis" : mode.id}. ${esc(mode.nom)}${mode.kind !== "revision" ? " · " + PARCOURS[G.parcours].nom : ""}</span>
        <span id="hMain" class="hmain"></span>
        <span id="hTime" class="htime" aria-live="off"></span>
        <span id="hErr"></span>
        <span id="hLeft" class="hleft"></span>
        <button class="btn small" data-act="stop">Arrêter</button>
      </div>
      <div class="card" id="qcard"></div>
      <div id="feedback" aria-live="polite"></div>
    </section>`;
    G.tick = setInterval(tick, 250);
    nextQuestion();
  }
  function tick() {
    if (!G) return;
    const el = performance.now() - G.t0, h = document.getElementById("hTime");
    if (G.parcours === "travail") {
      const rest = settings.travailMinutes * 60000 - el;
      if (h) { h.textContent = "⏱ " + fmtClock(rest); h.classList.toggle("urgent", rest < 30000); }
      if (rest <= 0) finish("temps");
    } else if (h) h.textContent = "⏱ " + fmtClock(G.tEnd ? G.tEnd - G.t0 : el);
  }
  function hud() {
    const main = document.getElementById("hMain"), err = document.getElementById("hErr"), left = document.getElementById("hLeft");
    if (!main) return;
    if (G.parcours === "leger") main.textContent = `Question ${Math.min(G.answered + 1, settings.legerQuestions)} / ${settings.legerQuestions}`;
    else if (G.parcours === "travail") main.textContent = `Justes : ${G.correct}`;
    else if (G.parcours === "defi") main.textContent = `Série : ${G.streak} / ${settings.defiSerie}`;
    else main.textContent = `Mot ${Math.min(G.answered + 1, G.total)} / ${G.total}`;
    err.textContent = `Erreurs : ${G.errors}`;
    left.textContent = G.mode.kind === "revision" ? `Remis à l'étude : ${G.back.length}` : `À apprendre : ${toLearn(G.mode).length} · Appris : ${learnedHere(G.mode)}`;
  }

  function pickWord() {
    if (G.mode.kind === "revision") return G.queue.length ? byId[G.queue[0]] : null;
    const pool = toLearn(G.mode);
    if (!pool.length) return null;
    const cands = pool.length > 1 ? pool.filter(w => w.id !== G.lastId) : pool;
    return cands[Math.floor(Math.random() * cands.length)];
  }

  /* Choisit n autres valeurs, en préférant même type puis même rubrique */
  function others(w, getter, n) {
    const mine = getter(w), seen = new Set([norm(mine)]), out = [];
    const cands = shuffle(WORDS.filter(x => x.id !== w.id)).map(x => ({ x, s: (x.type === w.type ? 2 : 0) + (x.rubrique === w.rubrique ? 1 : 0) }))
      .sort((a, b) => b.s - a.s);
    for (const { x } of cands) { const v = getter(x); if (v && !seen.has(norm(v))) { seen.add(norm(v)); out.push(v); } if (out.length === n) break; }
    return out;
  }

  function nextQuestion() {
    clearTimeout(G.auto); G.auto = null;
    if (G.pendingEnd) return finish(G.pendingEnd);
    const w = pickWord();
    if (!w) return finish(G.mode.kind === "revision" ? "revision" : "tous");
    G.lastId = w.id; G.locked = false;
    document.getElementById("feedback").innerHTML = "";
    const card = document.getElementById("qcard"), k = G.mode.kind, en = tgt(w);
    const promptFR = `<div class="prompt">${esc(w.fr)}</div>`;

    if (k === "qcm1" || k === "qcm2" || k === "qcm3" || k === "qcmOrth") {
      let prompt, answer, opts, optLang = "";
      if (k === "qcm1") {
        prompt = `<div class="prompt" ${LA()}>${esc(en)} ${speakBtn(en)}</div>`;
        answer = w.fr; opts = [w.fr, ...others(w, x => x.fr, 3)];
      } else {
        prompt = promptFR; answer = en; optLang = LA();
        const dis = k === "qcm2" ? others(w, tgt, 3) : (k === "qcm3" ? w.detrompeurs_credibles : w.detrompeurs_orthographiques);
        opts = [en, ...dis.slice(0, 3)];
      }
      opts = shuffle(opts);
      G.q = { w, answer, opts };
      card.innerHTML = `<p class="consigne">${k === "qcm1" ? "Choisis le sens français." : k === "qcmOrth" ? "Choisis la bonne orthographe." : `Choisis le mot ${langName()}.`}</p>
        ${prompt}
        <div class="options">${opts.map((o, i) => `<button class="opt" data-act="choose" data-arg="${i}"><kbd>${i + 1}</kbd><span ${optLang}>${esc(o)}</span></button>`).join("")}</div>`;
      if (k === "qcm1" && settings.prononcer) speak(en);
    }
    else if (k === "lettres") {
      const idx = w.lettres_difficiles.indices;
      G.q = { w };
      card.innerHTML = `<p class="consigne">Complète les lettres manquantes.</p>${promptFR}
        <div class="tiles" ${LA()}>${[...en].map((ch, i) => idx.includes(i)
          ? `<input class="tile in" maxlength="1" data-k="${i}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="lettre manquante">`
          : ch === " " ? `<span class="gap"></span>` : `<span class="tile">${esc(ch)}</span>`).join("")}</div>
        <div class="bar center"><button class="btn primary" data-act="check">Valider</button></div>`;
      const ins = [...card.querySelectorAll("input.tile")];
      ins.forEach((inp, j) => {
        inp.addEventListener("input", () => { if (inp.value && ins[j + 1]) ins[j + 1].focus(); });
        inp.addEventListener("keydown", e => {
          if (e.key === "Backspace" && !inp.value && ins[j - 1]) ins[j - 1].focus();
          if (e.key === "Enter") { e.preventDefault(); if (!G.locked) { e.stopPropagation(); check(); } }
        });
      });
      ins[0] && ins[0].focus();
    }
    else if (k === "syllabe") {
      const S = w.syllabe_difficile, before = en.slice(0, S.index), after = en.slice(S.index + S.texte.length);
      G.q = { w };
      card.innerHTML = `<p class="consigne">Complète la syllabe manquante.</p>${promptFR}
        <div class="sylword" ${LA()}><span>${esc(before)}</span><input class="syl" id="syl" style="width:${S.texte.length + 1.5}ch" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="syllabe manquante"><span>${esc(after)}</span></div>
        <p class="hint center">${plural(S.texte.length, "lettre", "lettres")}</p>
        <div class="bar center"><button class="btn primary" data-act="check">Valider</button></div>`;
      const inp = document.getElementById("syl");
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (!G.locked) { e.stopPropagation(); check(); } } });
      inp.focus();
    }
    else { // taper, revision
      G.q = { w };
      card.innerHTML = `<p class="consigne">Écris le mot ${langName()}.</p>${promptFR}
        <div class="typebox"><input id="typed" ${LA()} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Ta réponse">
        <button class="btn primary" data-act="check">Valider</button></div>`;
      const inp = document.getElementById("typed");
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (!G.locked) { e.stopPropagation(); check(); } } });
      inp.focus();
    }
    hud();
  }

  /* Délai avant la question suivante (allongé si le mot est lu ou devient appris) */
  function autoDelayMs(newSu) {
    return Math.round((settings.autoDelay || 2) * 1000 + (settings.prononcer ? 1200 : 0) + (newSu ? 800 : 0));
  }
  function pauseAuto() {
    if (!G || !G.auto) return;
    clearTimeout(G.auto); G.auto = null;
    const bar = document.querySelector(".autobar"); if (bar) bar.remove();
    const b = document.getElementById("btnNext"); if (b) b.focus();
  }

  function markedWord(w, how) {
    const en = tgt(w);
    if (how === "lettres") { const idx = w.lettres_difficiles.indices; return [...en].map((c, i) => idx.includes(i) ? `<mark>${esc(c)}</mark>` : esc(c)).join(""); }
    if (how === "syllabe") { const S = w.syllabe_difficile; return esc(en.slice(0, S.index)) + `<mark>${esc(S.texte)}</mark>` + esc(en.slice(S.index + S.texte.length)); }
    return esc(en);
  }

  function choose(i) {
    if (!G || G.locked) return;
    const btns = [...document.querySelectorAll(".opt")], chosen = G.q.opts[i], ok = chosen === G.q.answer;
    btns.forEach((b, j) => { b.disabled = true; if (G.q.opts[j] === G.q.answer) b.classList.add("good"); else if (j === i) b.classList.add("bad"); });
    answer(ok);
  }
  function check() {
    if (!G || G.locked) return;
    const w = G.q.w, k = G.mode.kind, en = tgt(w);
    let ok;
    if (k === "lettres") {
      const ins = [...document.querySelectorAll("input.tile")];
      if (ins.some(i => !i.value.trim())) { toast("Complète toutes les cases."); return; }
      ok = true;
      ins.forEach(i => { const good = i.value.trim().toLowerCase() === en[+i.dataset.k].toLowerCase(); ok = ok && good;
        i.classList.add(good ? "good" : "bad"); if (!good) { i.title = "Tu as écrit « " + i.value + " »"; i.value = en[+i.dataset.k]; } i.readOnly = true; });
    } else if (k === "syllabe") {
      const i = document.getElementById("syl");
      if (!i.value.trim()) { toast("Écris la syllabe."); return; }
      ok = i.value.trim().toLowerCase() === w.syllabe_difficile.texte.toLowerCase();
      i.classList.add(ok ? "good" : "bad"); i.readOnly = true;
    } else {
      const i = document.getElementById("typed");
      if (!i.value.trim()) { toast("Écris ta réponse."); return; }
      ok = accepted(en).has(norm(i.value));
      i.classList.add(ok ? "good" : "bad"); i.readOnly = true;
    }
    const b = document.querySelector('[data-act="check"]'); if (b) b.disabled = true;
    answer(ok);
  }

  function answer(ok) {
    G.locked = true;
    const w = G.q.w, k = G.mode.kind, now = performance.now();
    G.answered++;
    let suMsg = "";
    if (ok) { G.correct++; G.streak++; } else { G.errors++; G.streak = 0; }

    if (k === "revision") {
      G.queue.shift();
      if (ok) G.confirmed.push(w.id);
      else {   // oublié : il redevient « à apprendre » dans tous les exercices
        Object.keys(appris).forEach(m => appris[m].delete(w.id));
        Object.keys(streaks).forEach(m => { if (streaks[m]) streaks[m][w.id] = 0; });
        selection.add(w.id); G.back.push(w.id);
      }
    } else {
      const mid = G.mode.id, ser = (streaks[mid] ||= {});
      if (ok) {
        ser[w.id] = (ser[w.id] || 0) + 1;
        if (ser[w.id] >= settings.seuilSu && !learnedIn(mid).has(w.id)) {
          learnedIn(mid).add(w.id); G.newlyLearned.push(w.id);
          suMsg = `<span class="sumsg">« ${esc(tgt(w))} » est maintenant appris dans cet exercice ✓</span>`;
        }
      } else ser[w.id] = 0;
    }
    save();

    // Fin de parcours ?
    if (k === "revision") { if (!G.queue.length) { G.pendingEnd = "revision"; G.tEnd = now; } }
    else if (G.parcours === "leger" && G.answered >= settings.legerQuestions) { G.pendingEnd = "leger"; G.tEnd = now; }
    else if (G.parcours === "defi" && G.streak >= settings.defiSerie) { G.pendingEnd = "defi"; G.tEnd = now; }
    else if (!toLearn(G.mode).length) { G.pendingEnd = "tous"; G.tEnd = now; }

    const fb = document.getElementById("feedback"), en = tgt(w);
    const shown = k === "lettres" ? markedWord(w, "lettres") : k === "syllabe" ? markedWord(w, "syllabe") : esc(en);
    if (ok) {
      fb.innerHTML = `<div class="fb ok">✓ Juste ! <strong ${LA()}>${shown}</strong> ${speakBtn(en)} ${k === "qcm1" ? "" : "= " + esc(w.fr)}
        <button class="btn small" data-act="next" id="btnNext">Continuer <kbd>Entrée</kbd></button>
        ${settings.autoNext ? `<span class="autobar" aria-hidden="true"><span style="animation-duration:${autoDelayMs(!!suMsg)}ms"></span></span>` : ""}
        ${suMsg}</div>`;
      if (settings.prononcer && k !== "qcm1") speak(en);
      if (settings.autoNext) G.auto = setTimeout(nextQuestion, autoDelayMs(!!suMsg));
    } else {
      fb.innerHTML = `<div class="fb ko">✗ La bonne réponse : <strong ${LA()}>${shown}</strong> ${speakBtn(en)} = ${esc(w.fr)}
        ${k === "revision" ? `<span class="sumsg back">Ce mot retourne dans la liste à étudier.</span>` : ""}
        <button class="btn primary" data-act="next" id="btnNext">Continuer <kbd>Entrée</kbd></button></div>`;
      if (settings.prononcer) speak(en);
      const b = document.getElementById("btnNext"); b && b.focus();
    }
    hud();
  }

  /* ---------- Fin de partie ---------- */
  function recordText(r) {
    if (r.p === "leger") return `${plural(r.errors, "erreur", "erreurs")} en ${fmtLong(r.ms)}`;
    if (r.p === "travail") return `${plural(r.correct, "réponse juste", "réponses justes")}`;
    return fmtLong(r.ms);
  }
  function saveRecord(res) {
    const recs = lstore.get("records", {}), key = G.mode.id + "|" + G.parcours, old = recs[key];
    let better = false;
    if (G.parcours === "leger" && res.complete) better = !old || res.errors < old.errors || (res.errors === old.errors && res.ms < old.ms);
    if (G.parcours === "travail" && res.complete) better = !old || res.correct > old.correct;
    if (G.parcours === "defi" && res.complete) better = !old || res.ms < old.ms;
    if (better) { recs[key] = { p: G.parcours, errors: res.errors, correct: res.correct, ms: res.ms }; lstore.set("records", recs); }
    return { old, better };
  }
  function finish(reason) {
    if (!G) return;
    stopTimers();
    const end = G.tEnd || performance.now();
    let ms = end - G.t0;
    if (G.parcours === "travail") ms = Math.min(ms, settings.travailMinutes * 60000);
    const res = {
      errors: G.errors, correct: G.correct, ms,
      complete: (G.parcours === "leger" && reason === "leger") || (G.parcours === "travail" && reason === "temps") || (G.parcours === "defi" && reason === "defi")
    };
    const k = G.mode.kind;
    let title, big;
    if (k === "revision") {
      title = "Révision terminée";
      big = `${plural(G.confirmed.length, "mot confirmé", "mots confirmés")}, ${plural(G.back.length, "mot remis", "mots remis")} à l'étude`;
    } else if (G.parcours === "leger") {
      title = res.complete ? "Parcours léger terminé" : "Parcours léger interrompu";
      big = `${plural(G.answered, "question", "questions")} · ${plural(G.errors, "erreur", "erreurs")} · ${fmtLong(ms)}`;
    } else if (G.parcours === "travail") {
      title = res.complete ? "Temps écoulé !" : "Parcours travail interrompu";
      big = `${plural(G.correct, "réponse juste", "réponses justes")} en ${fmtLong(ms)} · ${plural(G.errors, "erreur", "erreurs")}`;
    } else {
      title = res.complete ? "Défi réussi !" : "Défi interrompu";
      big = res.complete ? `Série de ${settings.defiSerie} en ${fmtLong(ms)} · ${plural(G.errors, "erreur", "erreurs")} en route`
        : `Meilleure série en cours : ${G.streak} / ${settings.defiSerie} · ${plural(G.errors, "erreur", "erreurs")}`;
    }
    if (reason === "tous" && k !== "revision") title = "Tous les mots sont appris dans cet exercice !";
    const rec = k === "revision" ? { better: false } : saveRecord(res);
    const recLine = rec.better ? `<p class="record">🏆 Nouveau record pour ce mode !</p>`
      : (rec.old ? `<p class="hint">Record : ${recordText(rec.old)}</p>` : "");
    const list = ids => `<div class="chips small">${ids.map(id => byId[id]).filter(Boolean).map(w => `<span class="chip static" ${catStyle(w.rubrique)}><span class="t" ${LA()}>${esc(tgt(w))}</span><span class="f">${esc(w.fr)}</span></span>`).join("")}</div>`;
    const newly = G.newlyLearned.slice(), back = G.back.slice(), endMode = G.mode;
    G = null;
    const left = endMode.kind === "revision" ? 0 : toLearn(endMode).length;
    app().innerHTML = `
    <section class="panel end">
      <h2>${title}</h2>
      <p class="big">${big}</p>${recLine}
      ${newly.length ? `<h3>Mots appris dans cet exercice</h3>${list(newly)}` : ""}
      ${back.length ? `<h3>Retour dans la liste à étudier</h3>${list(back)}` : ""}
      ${endMode.kind === "revision" ? "" : `<p class="hint">${left ? `Il reste ${plural(left, "mot", "mots")} à apprendre dans cet exercice.` : "Tous les mots de la sélection sont appris dans cet exercice : essayez un autre exercice, ou d'autres mots."}</p>`}
    </section>
    <section class="panel">
      <div class="head-row"><h2>Continuer avec un autre mode</h2><span><button class="link" data-act="goSelect">Changer les mots</button> <button class="link" data-act="goHome">Accueil</button></span></div>
      ${parcoursBlock()}${modeCards()}
    </section>`;
  }

  /* ---------- Réglages ---------- */
  function openSettings(focus) {
    let dlg = document.getElementById("settings");
    if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "settings"; document.body.appendChild(dlg); }
    dlg.innerHTML = `<form method="dialog" class="settings">
      <h2>Réglages</h2>
      <label>Parcours léger : nombre de questions <input type="number" name="legerQuestions" min="1" max="100" value="${settings.legerQuestions}"></label>
      <label>Parcours travail : durée en minutes <input type="number" name="travailMinutes" min="1" max="60" step="0.5" value="${settings.travailMinutes}"></label>
      <label>Parcours défi : réponses justes d'affilée <input type="number" name="defiSerie" min="1" max="100" value="${settings.defiSerie}"></label>
      <label>Un mot est appris dans un exercice après … bonnes réponses d'affilée <input type="number" name="seuilSu" min="1" max="20" value="${settings.seuilSu}"></label>
      <label class="check"><input type="checkbox" name="autoNext" ${settings.autoNext ? "checked" : ""}> Après une bonne réponse, passer seul à la question suivante</label>
      <label>… au bout de (secondes) <input type="number" name="autoDelay" min="0.5" max="10" step="0.5" value="${settings.autoDelay}"></label>
      <label class="check"><input type="checkbox" name="prononcer" ${settings.prononcer ? "checked" : ""}> Prononcer automatiquement le mot ${langName()}</label>
      <label>Voix ${langName()} <select name="voixNom"><option value="">Automatique${TGT === "de" ? " (profil ci-dessous)" : ""}</option>${(loadVoices(), langVoices().slice().sort((a, b) => voiceRank(a) - voiceRank(b) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))).map(v => `<option value="${esc(v.name)}" ${settings.voixNom === v.name ? "selected" : ""}>${hasWorked(v) ? "✓ " : isBad(v) ? "✗ " : ""}${esc(v.name.replace(/^Microsoft /, "").replace(/ - .*$/, ""))} (${esc(v.lang)}) ${isLocal(v) ? "· installée" : "· en ligne"}</option>`).join("")}</select></label>
      ${TGT === "de" ? `<label>Voix allemande <select name="voixDE">${VoicesDE.getProfiles().map(n => `<option value="${n}" ${settings.voixDE === n ? "selected" : ""}>${{ Katja: "Katja", Conrad: "Conrad", KatjaNarratif: "Katja – lente", KatjaRapide: "Katja – rapide" }[n] || n}</option>`).join("")}</select></label>` : ""}
      <div class="bar"><button class="btn" type="button" data-act="testVoice">🔊 Tester la voix</button>
        <button class="link" type="button" data-act="forgetVoices">oublier les voix testées</button>
        <span class="hint" id="voiceInfo">${esc(voiceInfo())}</span></div>
      <p class="hint">Ces réglages sont gardés dans ce navigateur.</p>
      <div class="bar">
        <button class="btn primary" value="save">Enregistrer</button>
        <button class="btn" value="cancel" formnovalidate>Annuler</button>
      </div>
      <hr>
      <h3 id="importInfoTitle">Listes de mots et importation</h3>
      <p class="hint">Liste ouverte : <strong>${esc(DATA ? DATA.titre : "")}</strong> (${plural(WORDS.length, "mot", "mots")}).
        Chaque liste chargée reste mémorisée dans ce navigateur, avec sa progression ; la dernière utilisée se rouvre au démarrage.</p>
      ${(() => { const lib = Object.entries(library()).sort((a, b) => (a[1].titre || a[0]).localeCompare(b[1].titre || b[0]));
        return lib.length > 1 ? `<div class="bar"><select id="libSel" aria-label="Listes mémorisées">${lib.map(([id, x]) =>
          `<option value="${esc(id)}" ${id === LID ? "selected" : ""}>${esc(x.titre || id)}${x.sous_titre ? " – " + esc(x.sous_titre) : ""} (${x.n || "?"} mots)</option>`).join("")}</select>
          <button class="btn" type="button" data-act="openLib">Ouvrir</button>
          <button class="btn danger" type="button" data-act="deleteLib">Supprimer</button></div>` : ""; })()}
      <div class="bar">
        <label class="btn filebtn">Charger un fichier de mots (.json)
          <input type="file" id="importFile" accept=".json,application/json" hidden></label>
        <button class="btn" type="button" data-act="exportJson" ${WORDS.length ? "" : "disabled"}>Exporter la liste (.json)</button>
      </div>
      <div class="bar"><button class="btn primary" type="button" data-act="openEditor" ${WORDS.length ? "" : "disabled"}>✎ Modifier cette liste dans l'éditeur</button></div>
      <p class="hint">Ouvre l'éditeur propre à ce module (<strong>${esc(BASE)}.editeur.html</strong>) s'il existe, sinon l'éditeur commun <strong>${esc(EDITEUR_COMMUN)}</strong> du dossier des exercices, avec la liste affichée.</p>
      <div class="bar" style="display:none">
      </div>
      <details class="doc"><summary>Format officiel du fichier .json</summary>
        <p>Le fichier .json contient d'abord la description de la série, puis la liste des mots. Seuls <code>mots</code>, et dans chaque mot <code>fr</code> et le mot dans la langue apprise, sont obligatoires.</p>
        <pre>${esc(`{
  "format": "liste-vocabulaire-1",
  "id": "anglais-9h-unit-1",
  "titre": "Active wordlist – Unit 1 : Free time",
  "sous_titre": "Anglais 9H",
  "langue_question": "fr",
  "langue_reponse": "en",
  "consigne": "Traduis en anglais.",
  "mots": [
    {
      "id": "u1-001",
      "rubrique": "Daily routine verbs",
      "type": "verbe",
      "en": "do homework",
      "fr": "faire ses devoirs",
      "detrompeurs_credibles": ["make homework", "do housework", "make housework"],
      "detrompeurs_orthographiques": ["do homewrok", "do hommework", "do homwork"],
      "lettres_difficiles": { "indices": [3, 7, 8], "lettres": ["h", "w", "o"], "modele": "do _ome__rk" },
      "syllabe_difficile": { "texte": "work", "index": 7 }
    }
  ]
}`)}</pre>
        <ul>
          <li><code>titre</code> et <code>sous_titre</code> : titre général affiché en haut de la page et dans l'onglet ; il caractérise la série. Sans titre, le nom du fichier est utilisé.</li>
          <li><code>id</code> : identifiant de la série (facultatif). Il garde la progression attachée à la liste même si le titre change ; sans lui, le titre sert d'identifiant.</li>
          <li><code>langue_reponse</code> : code de la langue apprise (en, de, it, es) ; c'est aussi le nom du champ qui porte le mot dans chaque entrée (ici <code>"en"</code>).</li>
          <li><code>consigne</code> : consigne par défaut (facultative).</li>
          <li>Dans chaque mot : <code>id</code> (créé automatiquement s'il manque), <code>rubrique</code>, <code>type</code>, les 3 <code>detrompeurs_credibles</code>, les 3 <code>detrompeurs_orthographiques</code>, les <code>lettres_difficiles</code> (positions dans le mot, en partant de 0) et la <code>syllabe_difficile</code> (texte et position).</li>
        </ul>
      </details>
      <details class="doc"><summary>Prompt pour obtenir un fichier de mots</summary>
        <p>Donnez ce texte à Claude avec la photo ou le PDF de la page du manuel. Enregistrez sa réponse dans un fichier .json, vérifiez-le dans l'éditeur, puis importez-le.</p>
        <textarea id="promptText" readonly rows="10">${esc(PROMPT)}</textarea>
        <div class="bar"><button class="btn" type="button" data-act="copyPrompt">Copier le prompt</button></div>
      </details>
      <hr>
      <div class="bar">
        <button class="btn danger" type="button" data-act="resetAll">Effacer la progression</button>
      </div>
    </form>`;
    dlg.querySelector("form").addEventListener("submit", e => {
      if (e.submitter && e.submitter.value === "save") {
        const f = new FormData(e.target);
        ["legerQuestions", "defiSerie", "seuilSu"].forEach(k => settings[k] = Math.max(1, parseInt(f.get(k), 10) || DEFAULTS[k]));
        settings.travailMinutes = Math.max(0.5, parseFloat(f.get("travailMinutes")) || DEFAULTS.travailMinutes);
        settings.prononcer = f.get("prononcer") === "on";
        settings.autoNext = f.get("autoNext") === "on";
        settings.autoDelay = Math.min(10, Math.max(0.5, parseFloat(f.get("autoDelay")) || DEFAULTS.autoDelay));
        if (f.get("voixDE")) settings.voixDE = f.get("voixDE");
        settings.voixNom = f.get("voixNom") || "";
        store.set("reglages", settings);
        rerender();
      }
    });
    const imp = dlg.querySelector("#importFile");
    imp.onchange = () => { if (imp.files[0]) readFile(imp.files[0], true); imp.value = ""; };
    dlg.showModal();
    if (focus === "import") {
      const doc = [...dlg.querySelectorAll("details.doc")];
      doc.forEach(d => { d.open = true; });
      const h = dlg.querySelector("#importInfoTitle"); if (h) h.scrollIntoView({ block: "start" });
    }
  }
  function rerender() {
    if (G) return; // pas de réaffichage pendant une partie
    if (document.querySelector(".home")) return renderHome();
    if (document.querySelector(".grid-select")) return renderSelect();
    const m = document.querySelector(".modes"), p = document.querySelector(".parcours");
    if (m) m.outerHTML = modeCards();
    if (p) p.outerHTML = parcoursBlock();
  }

  /* ---------- Messages ---------- */
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }

  /* ---------- Événements ---------- */
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
    const act = el.dataset.act, arg = el.dataset.arg;
    switch (act) {
      case "toggle":
        selection.has(arg) ? selection.delete(arg) : selection.add(arg);
        el.classList.toggle("on", selection.has(arg)); el.setAttribute("aria-pressed", selection.has(arg));
        save(); updateMemButton(); break;
      case "grpAll": GROUPS[CATS[arg]].forEach(w => selection.add(w.id)); save(); renderSelect(); break;
      case "grpNone": GROUPS[CATS[arg]].forEach(w => selection.delete(w.id)); save(); renderSelect(); break;
      case "clearSel": selection.clear(); save(); renderSelect(); break;
      case "memoriser": if (selection.size) renderSetup(); break;
      case "drawCat": {
        const n = parseInt(document.getElementById("nCat").value, 10) || 1, c = +document.getElementById("cat").value;
        store.set("nCat", n); store.set("cat", c); draw(GROUPS[CATS[c]], n); break;
      }
      case "drawAll": { const n = parseInt(document.getElementById("nAll").value, 10) || 1; store.set("nAll", n); draw(WORDS, n); break; }
      case "goSelect": renderSelect(); break;
      case "goHome": renderHome(); break;
      case "homeNew": renderSelect(); break;
      case "homeSame": { const l = lastActivity(); if (!l) break; selection = new Set(l.selection); save(); renderSetup(); break; }
      case "homeResume": {
        const l = lastActivity(), m = l && MODES.find(x => x.id === l.mode); if (!m) break;
        selection = new Set(l.selection);
        if (m.kind !== "revision") parcours = l.parcours || parcours;
        save();
        const ready = m.kind === "revision" ? learnedAny().size > 0 : toLearn(m).length > 0;
        if (!ready) { toast("Tous ces mots sont déjà appris dans cet exercice : choisissez-en un autre."); renderSetup(); break; }
        startGame(m.id); break;
      }
      case "homeImport": document.getElementById("headerImport").click(); break;
      case "importInfo": openSettings("import"); break;
      case "start": startGame(arg); break;
      case "choose": choose(+arg); break;
      case "check": check(); break;
      case "next": nextQuestion(); break;
      case "stop": if (G) { G.tEnd = G.tEnd || performance.now(); finish("stop"); } break;
      case "speak": if (G && G.locked) pauseAuto(); speak(arg); break;
      case "testVoice": {
        const sel = document.querySelector('select[name="voixDE"]'); if (sel) settings.voixDE = sel.value;
        const sn = document.querySelector('select[name="voixNom"]'); if (sn) settings.voixNom = sn.value;
        const w = WORDS[0]; speak(w ? tgt(w) : "hello");
        setTimeout(() => { const i = document.getElementById("voiceInfo"); if (i) i.textContent = voiceInfo(); }, 300);
        break;
      }
      case "settings": openSettings(); break;
      case "openLib": {
        const id = document.getElementById("libSel").value;
        const d = document.getElementById("settings"); d && d.close();
        if (!openList(id)) toast("Cette liste n'est plus disponible.");
        break;
      }
      case "deleteLib": {
        const id = document.getElementById("libSel").value, lib = library(), x = lib[id];
        if (!x) break;
        if (id === LID) { toast("Ouvrez d'abord une autre liste pour pouvoir supprimer celle-ci."); break; }
        if (!confirm(`Supprimer la liste « ${x.titre || id} » et sa progression de ce navigateur ?`)) break;
        delete lib[id]; store.set("listes", lib); store.del("json:" + id);
        ["selection", "appris", "series", "records", "derniere"].forEach(k => store.del("L:" + id + ":" + k));
        openSettings(); toast("Liste supprimée.");
        break;
      }
      case "exportJson": exportJson(); break;
      case "openEditor": openEditor(); break;
      case "forgetVoices": {
        store.del(okKey()); store.del(koKey()); store.del(lastKey());
        const i = document.getElementById("voiceInfo"); if (i) i.textContent = voiceInfo();
        toast("Historique des voix effacé."); break;
      }
      case "copyPrompt": copyText(PROMPT); break;
      case "resetAll":
        if (confirm("Effacer les mots appris, les séries, les records et le dernier exercice de cette liste ?")) {
          appris = {}; streaks = {}; lstore.del("records"); lstore.del("derniere"); save();
          const d = document.getElementById("settings"); d && d.close(); renderHome();
        }
        break;
    }
  });
  document.addEventListener("change", e => {
    if (e.target.name === "parcours") {
      parcours = e.target.value; save();
      document.querySelectorAll(".pc").forEach(l => l.classList.toggle("on", l.querySelector("input").checked));
      const m = document.querySelector(".modes"); if (m) m.outerHTML = modeCards();
    }
  });
  document.addEventListener("keydown", e => {
    if (!G) return;
    const tag = e.target && e.target.tagName;
    // Entrée : passe à la suite après une réponse (sur un bouton, c'est son propre clic qui agit)
    if (G.locked && e.key === "Enter" && tag !== "BUTTON" && document.getElementById("btnNext")) { e.preventDefault(); nextQuestion(); return; }
    if (tag === "INPUT" && !e.target.readOnly) return;
    if (!G.locked && G.q && G.q.opts && /^[1-4]$/.test(e.key)) choose(+e.key - 1);
  });

  document.getElementById("btnSettings").addEventListener("click", () => openSettings());
  /* Champ de fichier pour « Importer ma liste de mots » (créé s'il manque dans la page) */
  if (!document.getElementById("headerImport")) {
    const inp = document.createElement("input");
    inp.type = "file"; inp.id = "headerImport"; inp.accept = ".json,application/json"; inp.hidden = true;
    document.body.appendChild(inp);
  }
  const hdrImport = document.getElementById("headerImport");
  const oldImport = document.getElementById("btnImport");   // ancienne page : on retire ce bouton (il est sur l'accueil)
  if (oldImport) oldImport.remove();
  hdrImport.addEventListener("change", () => { if (hdrImport.files[0]) readFile(hdrImport.files[0], true); hdrImport.value = ""; });
  const homeBtn = document.getElementById("btnHome") || document.getElementById("btnWords");
  if (homeBtn) {
    homeBtn.textContent = "🏠 Accueil";
    homeBtn.addEventListener("click", () => { if (G && !confirm("Arrêter la partie en cours ?")) return; stopTimers(); G = null; if (DATA) renderHome(); });
  }
  boot();
})();
