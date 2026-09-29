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
   Réglages, mots sus et records sont gardés dans le localStorage,
   sous des clés préfixées par le nom du fichier.
   ========================================================================== */
(function () {
  "use strict";

  const BASE = window.APP_BASE ||
    decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.[^.]*$/, "") || "vocabulaire";

  /* ---------- Stockage local ---------- */
  const store = {
    get(k, def) {
      try { const v = localStorage.getItem(BASE + ":" + k); return v === null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set(k, v) { try { localStorage.setItem(BASE + ":" + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(BASE + ":" + k); } catch (e) { /* rien */ } }
  };

  const DEFAULTS = { legerQuestions: 10, travailMinutes: 5, defiSerie: 10, seuilSu: 3, decouverteCompte: false, prononcer: false, autoNext: true, autoDelay: 2, voixDE: "Katja", voixNom: "" };
  let settings = Object.assign({}, DEFAULTS, store.get("reglages", {}));

  /* ---------- Données ---------- */
  let DATA = null, WORDS = [], byId = {}, TGT = "en", CATS = [], GROUPS = {};
  /* Bibliothèque des listes de mots mémorisées dans ce navigateur :
       « listes »         → { id: { titre, sous_titre, fichier, date, n } }
       « json:<id> »      → contenu complet de la liste
       « listeCourante »  → id de la dernière liste utilisée (rechargée au démarrage)
     La progression (sélection, mots sus, séries, records) est rangée par liste. */
  let LID = "";
  const lstore = {
    get: (k, def) => store.get("L:" + LID + ":" + k, def),
    set: (k, v) => store.set("L:" + LID + ":" + k, v),
    del: k => store.del("L:" + LID + ":" + k)
  };
  let selection = new Set(), su = new Set(), streaks = {};
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
    { id: "7", nom: "Révision", desc: () => "Revoir les mots sus ; les oubliés retournent à l'étude", kind: "revision" }
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
    if (LID) { lstore.set("selection", [...selection]); lstore.set("sus", [...su]); lstore.set("series", streaks); }
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
        ["selection", "sus", "series", "records"].forEach(k => {
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
    const old = ["selection", "sus", "series", "records"].filter(k => store.get(k, null) !== null);
    if (!old.length || lstore.get("sus", null) !== null) return;
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
        (ou un fichier de mots au format .txt).
        Il sera gardé en mémoire dans ce navigateur : il n'y aura plus besoin de le recharger.</p>
        <label class="drop" id="drop">
          <input type="file" id="jsonFile" accept=".json,.txt,application/json,text/plain">
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
  function readFile(f) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const isTxt = /\.txt$/i.test(f.name) || !/^\s*[{[]/.test(r.result);
        const res = isTxt ? parseTxt(r.result) : { data: JSON.parse(r.result), warn: [] };
        if (!res.data || !Array.isArray(res.data.mots)) throw new Error(isTxt ? "aucune ligne de mot reconnue" : "la liste « mots » est absente");
        const d = normalize(res.data, f.name);
        if (!valid(d)) throw new Error("aucun mot complet (il faut au moins « fr » et « " + (d.langue_reponse || "en") + " »)");
        const id = remember(d, f.name);
        if (!id) throw new Error("la mémoire du navigateur est pleine : supprimez une liste mémorisée dans ⚙ Réglages");
        const dlg = document.getElementById("settings"); if (dlg && dlg.open) dlg.close();
        openList(id);
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

  /* ---------- Format texte (import / export) ----------
     # titre: …        # sous-titre: …        # langue: en
     ## Rubrique
     mot | traduction | type | crédible ; crédible ; crédible | faute ; faute ; faute | mot avec [l]ettres entre crochets | syllabe
     Seules les deux premières colonnes sont obligatoires. */
  const clean = v => String(v == null ? "" : v).replace(/\|/g, "/").trim();
  function markedLetters(w) {
    const L = w.lettres_difficiles, t = tgt(w);
    return L && Array.isArray(L.indices) ? [...t].map((c, i) => L.indices.includes(i) ? `[${c}]` : c).join("") : "";
  }
  function toTxt() {
    const out = [
      `# titre: ${clean(DATA.titre)}`, `# sous-titre: ${clean(DATA.sous_titre)}`, `# langue: ${TGT}`,
      ...(DATA.consigne ? [`# consigne: ${clean(DATA.consigne)}`] : []),
      "# format: mot | traduction | type | 3 détrompeurs crédibles (;) | 3 détrompeurs orthographiques (;) | mot avec 3 lettres difficiles entre [ ] | syllabe difficile"
    ];
    let cur = null;
    WORDS.forEach(w => {
      if ((w.rubrique || "Mots") !== cur) { cur = w.rubrique || "Mots"; out.push("", "## " + clean(cur)); }
      const f = [clean(tgt(w)), clean(w.fr), clean(w.type),
        (w.detrompeurs_credibles || []).map(clean).join(" ; "), (w.detrompeurs_orthographiques || []).map(clean).join(" ; "),
        clean(markedLetters(w)), clean(w.syllabe_difficile && w.syllabe_difficile.texte)];
      while (f.length > 2 && !f[f.length - 1]) f.pop();
      out.push(f.join(" | "));
    });
    return out.join("\r\n") + "\r\n";
  }
  function exportTxt() {
    const blob = new Blob(["\uFEFF" + toTxt()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = BASE + ".txt"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Liste exportée dans « ${BASE}.txt ».`);
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = (slug(DATA.id) || slug(DATA.titre) || BASE) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Liste exportée dans « ${a.download} ».`);
  }
  function parseTxt(text) {
    const d = { titre: "", sous_titre: "", langue_reponse: "en", mots: [] }, warn = [], used = new Set();
    let rub = "Mots";
    const deaccent = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    String(text).replace(/^\uFEFF/, "").split(/\r?\n/).forEach((raw, n) => {
      const line = raw.trim();
      if (!line) return;
      if (line.startsWith("##")) { rub = line.replace(/^#+/, "").trim() || "Mots"; return; }
      if (line.startsWith("#")) {
        const m = line.match(/^#\s*([^:]+):\s*(.*)$/); if (!m) return;
        const k = deaccent(m[1]).replace(/\s+/g, "-"), v = m[2].trim();
        if (k === "titre") d.titre = v; else if (k === "sous-titre") d.sous_titre = v;
        else if (k === "langue") d.langue_reponse = v.toLowerCase().slice(0, 5) || "en";
        else if (k === "consigne") d.consigne = v;
        return;
      }
      const f = line.split("|").map(x => x.trim());
      if (f.length < 2 || !f[0] || !f[1]) { warn.push(`ligne ${n + 1} ignorée`); return; }
      const word = f[0];
      let id = "w-" + deaccent(word).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      while (used.has(id)) id += "-b"; used.add(id);
      const w = { id, rubrique: rub, type: f[2] || "expression", _t: word, fr: f[1] };
      const list = v => (v || "").split(";").map(x => x.trim()).filter(Boolean);
      const cred = list(f[3]), orth = list(f[4]);
      if (f[3]) { if (cred.length >= 3 && !cred.includes(word)) w.detrompeurs_credibles = cred.slice(0, 3); else warn.push(`« ${word} » : 3 détrompeurs crédibles attendus`); }
      if (f[4]) { if (orth.length >= 3 && !orth.includes(word)) w.detrompeurs_orthographiques = orth.slice(0, 3); else warn.push(`« ${word} » : 3 détrompeurs orthographiques attendus`); }
      if (f[5]) {
        const idx = []; let plain = "", inb = false;
        for (const c of f[5]) { if (c === "[") { inb = true; continue; } if (c === "]") { inb = false; continue; } if (inb) idx.push(plain.length); plain += c; }
        if (plain === word && idx.length >= 1 && idx.length <= 3)
          w.lettres_difficiles = { indices: idx, lettres: idx.map(i => word[i]), modele: [...word].map((c, i) => idx.includes(i) ? "_" : c).join("") };
        else warn.push(`« ${word} » : lettres difficiles mal marquées`);
      }
      if (f[6]) {
        const i = word.indexOf(f[6]);
        if (i >= 0) w.syllabe_difficile = { texte: f[6], index: i }; else warn.push(`« ${word} » : syllabe absente du mot`);
      }
      d.mots.push(w);
    });
    const L = d.langue_reponse;
    d.mots.forEach(w => { w[L] = w._t; delete w._t; });
    d.rubriques = [...new Set(d.mots.map(w => w.rubrique))];
    return { data: d, warn };
  }

  const PROMPT = `Je te joins une page de vocabulaire d'un manuel scolaire (photo ou PDF). Crée à partir de cette page un fichier de mots pour un exercice d'entraînement destiné à des élèves francophones.

Réponds uniquement avec le contenu du fichier texte, sans aucun commentaire avant ou après, au format suivant :

# titre: <titre de la liste, ex. Active wordlist – Unit 1 : Free time>
# sous-titre: <classe ou niveau, ex. Anglais 9H>
# langue: <code de la langue apprise : en, de, it ou es>

## <nom de la rubrique, comme dans le manuel>
<mot> | <traduction française> | <type> | <détrompeur crédible 1> ; <détrompeur crédible 2> ; <détrompeur crédible 3> | <faute 1> ; <faute 2> ; <faute 3> | <mot avec les lettres difficiles entre crochets> | <syllabe difficile>

Règles :
1. Reprends tous les mots de la page, dans l'ordre, une ligne par mot, avec la traduction française du manuel. Garde les rubriques du manuel (lignes commençant par ##).
2. Type : nom, verbe, adjectif, expression, heure ou mot interrogatif.
3. Détrompeurs crédibles : 3 mots ou expressions de la langue apprise, plausibles pour un élève francophone (sens ou construction proches, faux-amis, calques du français), mais faux. Aucun ne doit être une traduction correcte du mot français, même dans une autre variante de la langue.
4. Fautes : 3 variantes mal orthographiées du mot, typiques d'un élève francophone (lettre oubliée, doublée ou inversée, graphie à la française). Elles doivent toutes être différentes du mot juste.
5. Lettres difficiles : recopie le mot à l'identique en entourant de crochets, une par une, les 3 lettres les plus difficiles à mémoriser pour un francophone (lettres muettes, doubles consonnes, voyelles qui ne se lisent pas comme en français). Exemple : do [h]ome[w][o]rk. Seulement 2 lettres si le mot n'a que 3 lettres. Sans les crochets, le mot doit être strictement identique à celui de la première colonne.
6. Syllabe difficile : un groupe de lettres qui figure tel quel dans le mot. Exemple : work.
7. Pour l'allemand, écris les noms comme dans le manuel, avec article et pluriel : die Schule, -n.
8. N'utilise jamais le caractère | à l'intérieur d'une colonne, et ; seulement pour séparer les détrompeurs.`;

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

  function init(d, id) {
    stopTimers(); G = null;
    LID = id || listId(d);
    migrateLegacy();
    selection = new Set(lstore.get("selection", []));
    su = new Set(lstore.get("sus", []));
    streaks = lstore.get("series", {});
    DATA = d; WORDS = d.mots; TGT = d.langue_reponse || "en";
    byId = Object.fromEntries(WORDS.map(w => [w.id, w]));
    GROUPS = {}; WORDS.forEach(w => (GROUPS[w.rubrique || "Mots"] ||= []).push(w));
    CATS = Object.keys(GROUPS);
    selection = new Set([...selection].filter(id => byId[id]));
    su = new Set([...su].filter(id => byId[id]));
    // Titre général de la page = titre de la série de mots chargée
    document.getElementById("title").textContent = d.titre || BASE;
    document.getElementById("subtitle").textContent = d.sous_titre || "";
    document.title = (d.titre || BASE) + " – entraînement";
    save();
    renderSelect();
  }

  /* ---------- Écran 1 : choisir les mots ---------- */
  function chip(w) {
    const on = selection.has(w.id), known = su.has(w.id);
    return `<button class="chip${on ? " on" : ""}${known ? " known" : ""}" data-act="toggle" data-arg="${esc(w.id)}" aria-pressed="${on}">
      <span class="t" ${LA()}>${esc(tgt(w))}</span><span class="f">${esc(w.fr)}</span>${known ? '<span class="ok" title="su">✓</span>' : ""}</button>`;
  }
  function renderSelect() {
    stopTimers(); G = null;
    const n = selection.size;
    const suList = WORDS.filter(w => su.has(w.id));
    app().innerHTML = `
    <div class="grid-select">
      <section class="panel">
        <h2><span class="num">1</span> Choisir des mots dans la liste</h2>
        <p class="hint">Cliquez sur les mots à apprendre. ✓ indique un mot déjà su.</p>
        <div class="wordlist">
          ${CATS.map((c, i) => `<div class="group"><h3>${esc(c)}
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
        <section class="panel">
          <h2>Mots sus <span class="badge">${su.size}</span></h2>
          ${suList.length ? `<div class="known-list">${suList.map(w => `<span class="kchip"><span ${LA()}>${esc(tgt(w))}</span>
              <button class="x" data-act="unsu" data-arg="${esc(w.id)}" title="Remettre à l'étude" aria-label="Remettre ${esc(tgt(w))} à l'étude">×</button></span>`).join("")}</div>
            <div class="bar"><button class="btn" data-act="startRevision">Réviser les mots sus</button>
            <button class="link" data-act="resetSu">Tout remettre à l'étude</button></div>`
          : `<p class="hint">Un mot devient « su » après ${plural(settings.seuilSu, "bonne réponse", "bonnes réponses")} d'affilée. Il quitte alors la liste à étudier.</p>`}
        </section>
      </div>
    </div>`;
  }
  function updateMemButton() {
    const b = document.getElementById("btnMem"); if (!b) return;
    b.textContent = `Mémoriser ces mots (${selection.size})`; b.disabled = selection.size === 0;
  }
  function draw(list, n) {
    const free = list.filter(w => !su.has(w.id));
    if (!free.length) { toast("Tous ces mots sont déjà sus. Faites une révision ou remettez-en à l'étude."); return; }
    const k = Math.max(1, Math.min(n || 1, free.length));
    if (k < n) toast(`Seulement ${plural(k, "mot disponible", "mots disponibles")} (les mots sus sont exclus).`);
    selection = new Set(shuffle(free.slice()).slice(0, k).map(w => w.id));
    save(); renderSetup();
  }

  /* ---------- Écran 2 : parcours et mode ---------- */
  const toLearn = (m) => [...selection].map(id => byId[id]).filter(w => w && !su.has(w.id) && (!m || modeOK(m, w)));

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
      if (m.kind === "revision") { n = su.size; disabled = n === 0; why = disabled ? "aucun mot su pour l'instant" : plural(n, "mot su", "mots sus"); }
      else { n = toLearn(m).length; disabled = n === 0; why = disabled ? (toLearn().length ? "données absentes du fichier" : "aucun mot à apprendre") : plural(n, "mot", "mots"); }
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
    const left = toLearn().length;
    app().innerHTML = `
    <section class="panel">
      <div class="head-row"><h2>Mots à mémoriser</h2><button class="link" data-act="goSelect">Changer les mots</button></div>
      <p>${plural(words.length, "mot choisi", "mots choisis")} : ${plural(left, "à apprendre", "à apprendre")}, ${words.length - left} déjà ${words.length - left > 1 ? "sus" : "su"}.</p>
      <div class="chips small">${words.map(w => `<span class="chip static${su.has(w.id) ? " known" : ""}"><span class="t" ${LA()}>${esc(tgt(w))}</span><span class="f">${esc(w.fr)}</span>${su.has(w.id) ? '<span class="ok">✓</span>' : ""}</span>`).join("")}</div>
      ${left === 0 && words.length ? `<p class="warn">Tous les mots choisis sont sus : choisissez d'autres mots ou faites une révision.</p>` : ""}
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
      lastId: null, locked: false, pendingEnd: null, newlySu: [], confirmed: [], back: [], q: null
    };
    if (mode.kind === "revision") {
      G.queue = shuffle(WORDS.filter(w => su.has(w.id)).map(w => w.id));
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
    left.textContent = G.mode.kind === "revision" ? `Remis à l'étude : ${G.back.length}` : `À apprendre : ${toLearn(G.mode).length} · Sus : ${su.size}`;
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

  /* Délai avant la question suivante (allongé si le mot est lu ou devient su) */
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
      else { su.delete(w.id); streaks[w.id] = 0; selection.add(w.id); G.back.push(w.id); }
    } else {
      const counts = k !== "qcm1" || settings.decouverteCompte;
      if (ok && counts) {
        streaks[w.id] = (streaks[w.id] || 0) + 1;
        if (streaks[w.id] >= settings.seuilSu && !su.has(w.id)) {
          su.add(w.id); G.newlySu.push(w.id);
          suMsg = `<span class="sumsg">« ${esc(tgt(w))} » est maintenant su ✓</span>`;
        }
      } else if (!ok) streaks[w.id] = 0;
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
    if (reason === "tous" && k !== "revision") title = "Tous les mots sont sus !";
    const rec = k === "revision" ? { better: false } : saveRecord(res);
    const recLine = rec.better ? `<p class="record">🏆 Nouveau record pour ce mode !</p>`
      : (rec.old ? `<p class="hint">Record : ${recordText(rec.old)}</p>` : "");
    const list = ids => `<div class="chips small">${ids.map(id => byId[id]).filter(Boolean).map(w => `<span class="chip static"><span class="t" ${LA()}>${esc(tgt(w))}</span><span class="f">${esc(w.fr)}</span></span>`).join("")}</div>`;
    const newly = G.newlySu.slice(), back = G.back.slice();
    G = null;
    const left = toLearn().length;
    app().innerHTML = `
    <section class="panel end">
      <h2>${title}</h2>
      <p class="big">${big}</p>${recLine}
      ${newly.length ? `<h3>Mots devenus sus</h3>${list(newly)}` : ""}
      ${back.length ? `<h3>Retour dans la liste à étudier</h3>${list(back)}` : ""}
      <p class="hint">${left ? `Il reste ${plural(left, "mot", "mots")} à apprendre dans la sélection.` : "Tous les mots de la sélection sont sus : choisissez-en d'autres, ou faites une révision."}</p>
    </section>
    <section class="panel">
      <div class="head-row"><h2>Continuer avec un autre mode</h2><button class="link" data-act="goSelect">Changer les mots</button></div>
      ${parcoursBlock()}${modeCards()}
    </section>`;
  }

  /* ---------- Réglages ---------- */
  function openSettings() {
    let dlg = document.getElementById("settings");
    if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "settings"; document.body.appendChild(dlg); }
    dlg.innerHTML = `<form method="dialog" class="settings">
      <h2>Réglages</h2>
      <label>Parcours léger : nombre de questions <input type="number" name="legerQuestions" min="1" max="100" value="${settings.legerQuestions}"></label>
      <label>Parcours travail : durée en minutes <input type="number" name="travailMinutes" min="1" max="60" step="0.5" value="${settings.travailMinutes}"></label>
      <label>Parcours défi : réponses justes d'affilée <input type="number" name="defiSerie" min="1" max="100" value="${settings.defiSerie}"></label>
      <label>Un mot est su après … bonnes réponses d'affilée <input type="number" name="seuilSu" min="1" max="20" value="${settings.seuilSu}"></label>
      <label class="check"><input type="checkbox" name="decouverteCompte" ${settings.decouverteCompte ? "checked" : ""}> Le mode Découverte compte pour rendre un mot « su »</label>
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
      <h3>Listes de mots</h3>
      <p class="hint">Liste ouverte : <strong>${esc(DATA ? DATA.titre : "")}</strong> (${plural(WORDS.length, "mot", "mots")}).
        Chaque liste chargée reste mémorisée dans ce navigateur, avec sa progression ; la dernière utilisée se rouvre au démarrage.</p>
      ${(() => { const lib = Object.entries(library()).sort((a, b) => (a[1].titre || a[0]).localeCompare(b[1].titre || b[0]));
        return lib.length > 1 ? `<div class="bar"><select id="libSel" aria-label="Listes mémorisées">${lib.map(([id, x]) =>
          `<option value="${esc(id)}" ${id === LID ? "selected" : ""}>${esc(x.titre || id)}${x.sous_titre ? " – " + esc(x.sous_titre) : ""} (${x.n || "?"} mots)</option>`).join("")}</select>
          <button class="btn" type="button" data-act="openLib">Ouvrir</button>
          <button class="btn danger" type="button" data-act="deleteLib">Supprimer</button></div>` : ""; })()}
      <div class="bar">
        <label class="btn filebtn">Charger un fichier de mots (.json ou .txt)
          <input type="file" id="importFile" accept=".json,.txt,application/json,text/plain" hidden></label>
        <button class="btn" type="button" data-act="exportTxt" ${WORDS.length ? "" : "disabled"}>Exporter la liste (.txt)</button>
        <button class="btn" type="button" data-act="exportJson" ${WORDS.length ? "" : "disabled"}>Exporter la liste (.json)</button>
      </div>
      <details class="doc"><summary>Format du fichier de mots</summary>
        <p>Un fichier texte (.txt, encodage UTF-8), une ligne par mot. Les colonnes sont séparées par <code>|</code>. Seules les deux premières sont obligatoires ; sans les autres, les modes 3, 3 bis, 4 et 5 sont désactivés pour ce mot.</p>
        <pre>${esc(`# titre: Active wordlist – Unit 1 : Free time
# sous-titre: Anglais 9H
# langue: en

## Daily routine verbs
do homework | faire ses devoirs | verbe | make homework ; do housework ; make housework | do homewrok ; do hommework ; do homwork | do [h]ome[w][o]rk | work
get up | se lever`)}</pre>
        <ol>
          <li><strong>mot</strong> dans la langue apprise ;</li>
          <li><strong>traduction</strong> française ;</li>
          <li><strong>type</strong> : nom, verbe, adjectif, expression… ;</li>
          <li><strong>3 détrompeurs crédibles</strong>, séparés par <code>;</code> ;</li>
          <li><strong>3 fautes d'orthographe</strong>, séparées par <code>;</code> ;</li>
          <li>le mot avec ses <strong>3 lettres difficiles entre crochets</strong> ;</li>
          <li>la <strong>syllabe difficile</strong>, telle qu'elle apparaît dans le mot.</li>
        </ol>
        <p><strong>Fichier .txt</strong> — les lignes <code># titre:</code> et <code># sous-titre:</code> donnent le titre affiché en haut de la page. Les lignes <code>## …</code> donnent les rubriques. <code># langue:</code> vaut en, de, it ou es. L'export .txt produit exactement ce format, et on peut le réimporter après l'avoir corrigé. Les fichiers .json au format de <strong>${esc(BASE)}.json</strong> sont aussi acceptés.</p>
      </details>
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
        <p>Donnez ce texte à Claude avec la photo ou le PDF de la page du manuel, puis enregistrez sa réponse dans un fichier .txt et importez-le.</p>
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
        settings.decouverteCompte = f.get("decouverteCompte") === "on";
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
    imp.onchange = () => { if (imp.files[0]) readFile(imp.files[0]); imp.value = ""; };
    dlg.showModal();
  }
  function rerender() {
    if (G) return; // pas de réaffichage pendant une partie
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
      case "unsu": su.delete(arg); streaks[arg] = 0; save(); renderSelect(); break;
      case "resetSu":
        if (confirm("Remettre tous les mots sus dans la liste à étudier ?")) { su.clear(); streaks = {}; save(); renderSelect(); }
        break;
      case "startRevision": startGame("7"); break;
      case "goSelect": renderSelect(); break;
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
        ["selection", "sus", "series", "records"].forEach(k => store.del("L:" + id + ":" + k));
        openSettings(); toast("Liste supprimée.");
        break;
      }
      case "exportJson": exportJson(); break;
      case "exportTxt": exportTxt(); break;
      case "forgetVoices": {
        store.del(okKey()); store.del(koKey()); store.del(lastKey());
        const i = document.getElementById("voiceInfo"); if (i) i.textContent = voiceInfo();
        toast("Historique des voix effacé."); break;
      }
      case "copyPrompt": copyText(PROMPT); break;
      case "resetAll":
        if (confirm("Effacer les mots sus, les séries et les records de cette liste ?")) {
          su.clear(); streaks = {}; lstore.del("records"); save();
          const d = document.getElementById("settings"); d && d.close(); renderSelect();
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

  document.getElementById("btnSettings").addEventListener("click", openSettings);
  document.getElementById("btnWords").addEventListener("click", () => { if (G && !confirm("Arrêter la partie en cours ?")) return; stopTimers(); G = null; if (DATA) renderSelect(); });
  boot();
})();
