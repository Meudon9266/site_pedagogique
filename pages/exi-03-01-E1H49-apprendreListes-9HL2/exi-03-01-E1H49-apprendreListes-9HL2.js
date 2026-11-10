/* Apprentissage du vocabulaire d'allemand 9H — socle : accueil, profil, lot de l'élève, fenêtre glissante,
   découverte (sens, mot, pluriel) et validation « su » par la saisie du mot, en contexte étranger.
   Noms reconstruits à partir de la page : « racine.apprendre.html » → « racine.apprendre.js » ;
   lit « racine.banque.json » et « racine.pilotage.json » (jamais codés en dur). */
(function () {
  "use strict";
  const RACINE = (window.APP_BASE || "x").split(".")[0];
  const K = s => RACINE + ":" + s;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(K(k)); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(K(k), JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  let B = null, P = null, byId = {}, nom = null, E = null, S = null;

  /* ---------- outils ---------- */
  const $ = s => document.querySelector(s);
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v ?? "";
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    kids.flat(9).forEach(c => { if (c === false || c == null) return; e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const lib = e => (e.art ? e.art + " " : "") + e.de;
  const frs = e => (e.fr || []).join(" ; ");
  const de = t => el("span", { lang: "de" }, t);          // texte allemand (lecteurs d'écran)
  const ymd = d => { d = new Date(d); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); }
  const vue = (...n) => { const a = $("#app"); a.replaceChildren(...n); window.scrollTo(0, 0); };
  function telecharger(nomFichier, obj) {
    const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" })), download: nomFichier });
    document.body.append(a); a.click(); a.remove();
  }
  /* Voix : on utilise le module commun Partage.Audio.js (window.AudioDE) quand il est chargé ;
     sinon, repli sur la synthèse vocale du navigateur (code plus simple, moins robuste). */
  const AD = () => window.AudioDE || null;
  let jetonSuite = 0;
  /* Vitesse de la voix : réglée par l'élève (0,5 à 1,5), mémorisée avec ses réglages, appliquée au module commun (AudioDE.definirVitesse) ou aux voix du navigateur */
  const vitesse = () => Math.min(1.5, Math.max(0.5, Number(E && E.reglages.vitesse) || 1));
  function ajusterVitesse() { const ad = AD(); if (ad && ad.definirVitesse && Math.abs(ad.vitesse() - vitesse()) > 0.001) { try { ad.definirVitesse(vitesse(), false); } catch (e) { /* rien */ } } }
  function curseurVitesse(apres) {
    const sortie = el("span", { class: "small mute", "aria-live": "polite" }, "×" + vitesse().toFixed(2).replace(/0$/, ""));
    const r = el("input", { type: "range", min: "0.5", max: "1.5", step: "0.05", value: String(vitesse()), "aria-label": "Vitesse de la voix",
      oninput: ev => { sortie.textContent = "×" + Number(ev.target.value).toFixed(2).replace(/0$/, ""); },
      onchange: ev => { E.reglages.vitesse = Number(ev.target.value); sauver(); ajusterVitesse(); if (apres) apres(); } });
    return el("label", { class: "row vit", style: "margin-top:10px;gap:8px" }, el("span", { "aria-hidden": "true" }, "🐢"), r, el("span", { "aria-hidden": "true" }, "🐇"), sortie, el("span", { class: "small mute" }, "vitesse de la voix"));
  }
  function parler(txt) {
    if (!E || !E.reglages.voix) return;
    jetonSuite++;
    const ad = AD(); ajusterVitesse();
    if (ad) { try { ad.parler(txt, "Katja"); } catch (e) { /* rien */ } return; }
    if (!("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt); u.lang = "de-DE"; u.rate = 0.9 * vitesse();
      const v = (speechSynthesis.getVoices() || []).find(v => /^de/i.test(v.lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* rien */ }
  }
  /* Lit plusieurs mots l'un après l'autre, avec une courte pause (reconnaissance audio : « Tout écouter »). */
  async function parlerSuite(mots) {
    if (!E || !E.reglages.voix) return;
    const mien = ++jetonSuite;
    const ad = AD(); ajusterVitesse();
    if (ad) {
      try {
        for (let i = 0; i < mots.length; i++) {
          if (mien !== jetonSuite) return;
          await ad.parler(mots[i], "Katja");
          if (mien !== jetonSuite) return;
          await new Promise(r => setTimeout(r, 450));
        }
      } catch (e) { /* rien */ }
      return;
    }
    if (!("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const v = (speechSynthesis.getVoices() || []).find(v => /^de/i.test(v.lang));
      const lire = i => {
        if (i >= mots.length || mien !== jetonSuite) return;
        let suite = false; const aller = () => { if (!suite) { suite = true; setTimeout(() => lire(i + 1), 450); } };
        const u = new SpeechSynthesisUtterance(mots[i]); u.lang = "de-DE"; u.rate = 0.85 * vitesse(); if (v) u.voice = v;
        u.onend = aller; u.onerror = aller; setTimeout(aller, 4000);
        speechSynthesis.speak(u);
      };
      lire(0);
    } catch (e) { /* rien */ }
  }
  try { if ("speechSynthesis" in window) { speechSynthesis.getVoices(); speechSynthesis.addEventListener("voiceschanged", () => {}); } } catch (e) { /* rien */ }      // lance le chargement des voix (asynchrone dans Chrome et Edge)
  const audioBtn = txt => el("button", { class: "audio", type: "button", title: "Écouter", "aria-label": "Écouter", onclick: () => parler(txt) }, "🔊");
  const R = () => Object.assign({ reussitesPourSu: 2, contexteEtrangerElements: 5, echecsAvantRenvoi: 2, espacementMinEntreEssais: 3 }, (P && P.essaisSu) || {});

  /* ---------- données ---------- */
  const VERSION_APP = "2026-11-10 22:20";     // à changer à chaque livraison : s'affiche dans ⚙ pour savoir quelle version du moteur tourne
  async function lireJson(url) { const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) throw 0; return r.json(); }
  let depuisCache = false;     // vrai si les données viennent de la copie mémorisée (page ouverte hors serveur, où le navigateur bloque la lecture des fichiers)
  async function charger() {
    try {
      const [b, p] = await Promise.all([lireJson(RACINE + ".banque.json"), lireJson(RACINE + ".pilotage.json")]);
      B = b; P = p; ls.set("cache", { b, p, date: Date.now() }); return true;
    } catch (e) { /* repli */ }
    const c = ls.get("cache", null);
    if (c) { B = c.b; P = c.p; depuisCache = true; return true; }
    return false;
  }
  async function lireFichiers(fichiers) {
    let b = null, p = null;
    for (const f of fichiers) {
      try { const j = JSON.parse(await f.text()); if (f.name.endsWith(".banque.json")) b = j; else if (f.name.endsWith(".pilotage.json")) p = j; else toast("Fichier inconnu : " + f.name); }
      catch (e) { toast("Ce fichier n'a pas pu être lu : " + f.name); }
    }
    return { b, p };
  }
  function vueChargement() {
    vue(el("div", { class: "card center" }, el("h2", {}, "Bienvenue"),
      el("p", { class: "mute" }, "Choisis les deux fichiers du vocabulaire (une seule fois par ordinateur) :"),
      el("p", { class: "small" }, RACINE + ".banque.json et " + RACINE + ".pilotage.json"),
      el("input", { type: "file", accept: ".json", multiple: "", "aria-label": "Choisir les fichiers du vocabulaire", onchange: async ev => {
        const { b, p } = await lireFichiers(ev.target.files); if (b) B = b; if (p) P = p;
        if (B && P) { ls.set("cache", { b: B, p: P, date: Date.now() }); demarrer(); } else toast("Il manque encore un fichier.");
      } })));
  }
  function indexer() { byId = {}; B.entrees.forEach(e => byId[e.id] = e); }
  const lots = () => [...new Set(B.entrees.map(e => e.lot))].sort((a, b) => a - b);
  function titreLot(l) { const x = (B.meta.listes || []).find(x => x.lot === l); return x ? (x.titre || x.id) : "Lot " + l; }

  /* ---------- profils et état ---------- */
  const profils = () => ls.get("profils", []);
  function chargerEtat(n) {
    nom = n; ls.set("profilCourant", n);
    E = ls.get("e:" + n, null) || { lot: null, mots: {}, seances: [], q: 0, reglages: { voix: true, modalite: "auto", fs: 17 } };
    E.reglages = Object.assign({ voix: true, modalite: "auto", fs: 17 }, E.reglages);
    appliquerTaille();
  }
  /* Avant d'écrire, on relit ce qu'un autre onglet a pu enregistrer : pour chaque mot, on garde la version la plus travaillée. */
  function fusionner(autre) {
    if (!autre || !autre.mots) return;
    for (const [id, m] of Object.entries(autre.mots)) { const mien = E.mots[id]; if (!mien || (m.vus || 0) > (mien.vus || 0)) E.mots[id] = m; }
    const ids = new Set((E.seances || []).map(s => s.id));
    (autre.seances || []).forEach(s => { if (!ids.has(s.id)) E.seances.push(s); });
    E.seances.sort((a, b) => a.t0 - b.t0); E.seances = E.seances.slice(-80);
    E.q = Math.max(E.q || 0, autre.q || 0);
  }
  function sauver() { fusionner(ls.get("e:" + nom, null)); ls.set("e:" + nom, E); }
  function appliquerTaille() { document.documentElement.style.setProperty("--fs", E.reglages.fs + "px"); }
  const st = id => (E.mots[id] ||= { etat: "nouveau", fait: { sens: 0, mot: 0, pluriel: 0 }, essais: 0, premier: null, reussites: [], echecsSuite: 0, dq: -99, vus: 0, dern: null });

  /* ---------- file d'attente et fenêtre ---------- */
  function vagueUtilisee(g) {
    if (g == null) return 99;
    if (P.vaguesNonValideesUtilisees !== false) return g;
    const v = B.meta.validations && B.meta.validations.vagues;
    return v && typeof v === "object" && v[g] ? g : 99;
  }
  /* Niveau de priorité du lot : seuil réglé sur cet appareil (mémoire locale, par lot), sinon celui du pilotage, sinon tout (4).
     Un mot de niveau supérieur au seuil n'est pas appris, sauf si l'enseignant l'a rehaussé (priorité haute). */
  const NIV_NOM = { 1: "Niveau 1 : mots en gras", 2: "Niveau 2 : + mots du symbole « Niveau 2 et 3 »", 3: "Niveau 3 : + mots du symbole « Niveau 3 »", 4: "Tous les mots du lot" };
  function seuilLot(l) {
    const loc = ls.get("seuilsLot", {}), pil = (P && P.niveauMaxParLot) || {};
    const v = Number(loc[l] ?? pil[l] ?? 4);
    return v >= 1 && v <= 4 ? v : 4;
  }
  const retenu = e => e.niveauPriorite == null || e.niveauPriorite <= seuilLot(e.lot) || e.priorite === "haute";
  /* Vagues trop peu nombreuses (après le seuil de niveau) : une vague de moins de seuilInsuffisance éléments est regroupée avec la voisine
     (précédente ou suivante) qui a le moins d'éléments ; à égalité, avec la précédente. Se répète tant qu'une vague reste insuffisante. */
  function regrouperVagues(es) {
    const seuil = Number((P.vagues || {}).seuilInsuffisance) || 0;
    const taille = new Map(); es.forEach(e => { const g = vagueUtilisee(e.vague); if (g !== 99) taille.set(g, (taille.get(g) || 0) + 1); });
    const gs = [...taille.keys()].sort((x, y) => x - y), rep = new Map(gs.map(g => [g, g]));
    while (seuil > 0 && gs.length > 1) {
      const p = gs.filter(g => taille.get(g) < seuil).sort((x, y) => taille.get(x) - taille.get(y) || x - y)[0];
      if (p == null) break;
      const i = gs.indexOf(p), prev = gs[i - 1], next = gs[i + 1];
      const vers = prev == null ? next : next == null ? prev : (taille.get(next) < taille.get(prev) ? next : prev);
      taille.set(vers, taille.get(vers) + taille.get(p)); gs.splice(i, 1);
      for (const [k, v] of rep) if (v === p) rep.set(k, vers);
    }
    return g => rep.has(g) ? rep.get(g) : g;
  }
  function file() {
    const anc = !!(S && S.anciens);                  // « coup de pouce » : mots des lots précédents commencés mais pas encore sus
    const es = B.entrees.filter(e => (e.type === "mot" || (e.type === "phrase" && e.qcm)) && (anc ? e.lot < E.lot && st(e.id).etat === "enCours" : e.lot === E.lot) && e.niveauLivre !== "connu" && retenu(e));
    const eff = regrouperVagues(es);
    return es.sort((a, b) => (a.lot - b.lot) || eff(vagueUtilisee(a.vague)) - eff(vagueUtilisee(b.vague)) || vagueUtilisee(a.vague) - vagueUtilisee(b.vague) || (a.rang ?? 99) - (b.rang ?? 99) ||
        (a.niveauLivre === "actif" ? 0 : 1) - (b.niveauLivre === "actif" ? 0 : 1) || a.source.ordre - b.source.ordre);
  }
  const fenetre = () => file().filter(e => ["nouveau", "enCours"].includes(st(e.id).etat)).slice(0, P.tailleFenetre);
  /* Zone grise du livre (« Das kennst du schon ») : mots supposés connus ; ils passent par le rappel (lettres) puis la saisie, quand l'élève entre dans leur vague. */
  const grises = () => S && S.anciens ? [] : B.entrees.filter(e => e.type === "mot" && e.niveauLivre === "connu" && e.lot === E.lot);
  function rappel() {
    const g = grises().filter(e => lettresOk(e) && ["nouveau", "enCours"].includes(st(e.id).etat));
    if (!g.length) return [];
    const es = file(), eff = regrouperVagues(es), vg = e => eff(vagueUtilisee(e.vague));
    const w = fenetre(), cur = w.length ? Math.min(...w.map(vg)) : Infinity;
    return g.filter(e => { const m = es.filter(x => x.source.liste === e.source.liste && x.source.section === e.source.section).map(vg); return !m.length || Math.min(...m) <= cur; });
  }
  const anciensMots = () => B.entrees.filter(e => (e.type === "mot" || (e.type === "phrase" && e.qcm)) && e.lot < E.lot && e.niveauLivre !== "connu" && retenu(e) && st(e.id).etat === "enCours");
  const aConfirmer = () => file().concat(grises()).filter(e => st(e.id).etat === "aConfirmer");
  const nbSu = () => file().filter(e => ["su", "reconnu"].includes(st(e.id).etat)).length;

  /* ---------- formes ---------- */
  const estNom = e => e.pos === "nom" && !!e.art;
  /* Pluriel demandé : celui du livre ; si le pilotage le demande, celui que l'IA propose (plPropose) pour les noms sans pluriel dans le livre. */
  const plEff = e => e.pl || ((P && P.pluriel && P.pluriel.absentDuLivre === "demander") ? e.plPropose : null) || null;
  const aPluriel = e => estNom(e) && !!plEff(e);
  /* ---------- domaines d'approfondissement (seul le domaine orthographique est disponible pour l'instant) ---------- */
  const DOMAINES = ["ortho", "lex"];
  const ACT_DOM = { ortho: "pieges" };
  const RD = () => Object.assign({ reussiteMin: 0.8, essaisMin: 3, derniersEssais: 5 }, (P && P.domaines) || {});
  const SEUIL_INV = () => (P && P.invitations && P.invitations.seuilMots) || 6;
  const reconnuF = e => { const s = st(e.id); return s.fait.mot >= 1 && (!aPluriel(e) || s.fait.pluriel >= 1); };   // le test « sens » est facultatif
  const domApplicable = (e, d) => d === "ortho" ? (e.distracteurs || []).length >= 2 || composesOk(e) : d === "lex" ? variantesOk(e) || particOk(e) : d === "phon" ? sonOk(e) : false;
  const domValide = (e, d) => !domApplicable(e, d) || !!(st(e.id).val || {})[d];
  const domainesFaits = e => DOMAINES.every(d => domValide(e, d));
  /* Un domaine est validé quand le taux de réussite aux derniers exercices préparatoires du mot atteint le seuil (réglages du pilotage). */
  function noterDomaine(e, d, ok) {
    const s = st(e.id), D = RD(); s.dom = s.dom || {}; s.val = s.val || {};
    const h = s.dom[d] = s.dom[d] || []; h.push(ok ? 1 : 0); while (h.length > D.derniersEssais) h.shift();
    if (!s.val[d] && h.length >= D.essaisMin && h.reduce((a, b) => a + b, 0) / h.length >= D.reussiteMin) { s.val[d] = true; return true; }
    return false;
  }
  /* Position où l'Umlaut est possible : première voyelle a, o, u (ou au) du dernier élément du mot. */
  function posUmlaut(e) {
    const s = e.de, comps = (e.composants && e.composants.join("") === s) ? e.composants : [s];
    let dernier = comps[comps.length - 1];
    const tiret = dernier.lastIndexOf("-"); if (tiret >= 0) dernier = dernier.slice(tiret + 1);
    const debut = s.length - dernier.length;
    const m = /[aeiouäöüy]+/i.exec(dernier); if (!m) return null;
    const g = m[0].toLowerCase();
    if (g === "a" || g === "o" || g === "u") return { i: debut + m.index, len: 1 };
    if (g === "au") return { i: debut + m.index, len: 2 };
    return null;
  }
  function avecUmlaut(s, p) {
    if (!p) return s;
    const c = s[p.i], maj = c !== c.toLowerCase();
    const t = p.len === 2 ? "äu" : ({ a: "ä", o: "ö", u: "ü" })[c.toLowerCase()];
    return s.slice(0, p.i) + (maj ? t.toUpperCase() : t) + s.slice(p.i + p.len);
  }
  const sansUmlaut = w => w.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/Ä/g, "A").replace(/Ö/g, "O").replace(/Ü/g, "U");
  /* Mauvais pluriels plausibles : terminaisons possibles pour ce type de mot, Umlaut à la bonne place, jamais le pluriel d'un homonyme. */
  function pluriels(e) {
    const s = e.de, pl = plEff(e);
    const p = /[aiouy]$/i.test(s) ? null : posUmlaut(e), U = p ? avecUmlaut(s, p) : null;
    const interdits = new Set([pl, s]);
    B.entrees.forEach(x => { if (x.id !== e.id && x.de === s && plEff(x)) interdits.add(plEff(x)); });
    const prio = [];
    if (/[äöüÄÖÜ]/.test(pl)) prio.push(sansUmlaut(pl)); else if (U && pl.startsWith(s.slice(0, p.i))) prio.push(avecUmlaut(pl, p));
    const avecS = b => /[sßxz]$/i.test(b) ? [] : [b + "s"];
    let c = [];
    if (/e$/.test(s)) c = [s + "s"].concat(U ? [U, U + "n"] : []);
    else if (/in$/.test(s)) c = [s + "en", s + "e", s + "s", s + "nen"];
    else if (/(ung|heit|keit|schaft|tät|ion|ik|ur)$/i.test(s)) c = [s + "e", s + "s", s + "er"];
    else if (/(er|el|en)$/.test(s)) c = [s + "s"].concat(/n$/.test(s) ? [] : [s + "n"], U ? [U] : []);
    else if (/[aiouy]$/i.test(s)) c = [s + "s", s + "n", s + "en", s + "e"];
    else [s].concat(U ? [U] : []).forEach(b => { c.push(b + "e", b + "en", b + "er"); c.push(...avecS(b)); });
    const out = [];
    for (const x of prio.concat(shuffle(c))) if (!interdits.has(x) && !out.includes(x)) out.push(x);
    const res = out.slice(0, 3);
    if (res.length < 3 && s !== pl && !res.includes(s)) res.push(s);   // « pluriel inchangé » : dernier recours
    return res;
  }

  /* ---------- séance ---------- */
  /* Score et reprise : une partie interrompue (page fermée, retour à l'accueil, changement de lot) est gardée avec son score ;
     relancer la même activité la reprend là où on l'avait laissée, pour qu'on ne puisse pas recommencer afin d'améliorer son score. */
  const SC = () => Object.assign({ qcm: 10, saisie: 20, recopier: 5, motSu: 50, serieMin: 5, bonusSerie: 5 }, (P && P.score) || {});
  function crediter(act) {
    const c = SC(); let g = act === "saisie" ? c.saisie : act === "recopier" ? c.recopier : c.qcm;
    if (S.serie >= c.serieMin) g += c.bonusSerie;
    S.score += g; return g;
  }
  const clePartie = (mode, modalite) => mode + ":" + modalite;
  function sauverPartie(avecQuestion) {
    if (!S || S.fini || !S.questions) return;
    E.parties = E.parties || {};
    E.parties[clePartie(S.mode, S.modalite0)] = { id: S.id, mode: S.mode, modalite: S.modalite, modalite0: S.modalite0, anciens: !!S.anciens, t0: S.t0, questions: S.questions, bonnes: S.bonnes, serie: S.serie, score: S.score,
      erreurs: S.erreurs, su: S.su, force: S.force, recent: S.recent, restant: S.fin ? Math.max(0, S.fin - (S.pause || Date.now())) : null,
      credL: S.credL, etape: S.etape, precedent: S.precedent, faits: S.faits, reprises: S.reprises, reprisesFaites: S.reprisesFaites, reposent: S.reposent, tours: S.tours, sb: S.sb, sq: S.sq,
      q: avecQuestion && S.q && !S.q.repondu && byId[S.q.e.id] ? { id: S.q.e.id, act: S.q.act, etranger: !!S.q.etranger, serie: !!S.q.serie, rep: !!S.q.rep } : null };
    sauver();
  }
  function demarrerS(mode, modalite, p, anc) {
    const serieVide = { credL: null, etape: null, precedent: null, faits: [], reprises: [], reprisesFaites: [], reposent: [], tours: {}, sb: 0, sq: 0, pause: null };
    S = p ? Object.assign({}, serieVide, p, { fini: false, auto: null, enregistre: false, timer: null, q: null, pause: null, force: p.force || [] })
          : Object.assign({ id: "s" + Date.now(), mode, t0: Date.now(), questions: 0, bonnes: 0, serie: 0, score: 0, erreurs: [], su: [], force: [], recent: [], modalite, fini: false, q: null, timer: null }, serieVide);
    S.modalite0 = modalite + (anc ? "+anc" : ""); S.anciens = !!anc;
    if (!p && modalite !== "auto") nouvelleSerie(modalite);
    if (mode === "7min") { S.fin = Date.now() + (p ? p.restant : P.modesApprentissage.minutes * 60000); S.timer = setInterval(tick, 1000); }
    if (p && p.q && byId[p.q.id]) { S.q = { e: byId[p.q.id], act: p.q.act, etranger: p.q.etranger, serie: p.q.serie, rep: p.q.rep }; dessiner(); }
    else if (p && S.mode === "7min" && S.fin <= Date.now()) terminer();
    else suivante();
  }
  function nouvelleSeance(mode, modalite, reprise, anc) {
    abandonnerSeance();
    modalite = modalite || "auto";
    const p = E.parties && E.parties[clePartie(mode, modalite + (anc ? "+anc" : ""))];
    if (p && !reprise) return vueReprise(mode, modalite, p, anc);
    demarrerS(mode, modalite, p || null, anc);
  }
  function vueReprise(mode, modalite, p, anc) {
    const reste = p.restant != null ? " · " + fmt(p.restant) + " restantes" : " · série de " + p.serie;
    vue(el("div", { class: "card center" }, el("h2", {}, "On reprend là où tu t'étais arrêté"),
      el("p", {}, "★ " + p.score + " points · " + p.bonnes + " bonne" + (p.bonnes > 1 ? "s" : "") + " réponse" + (p.bonnes > 1 ? "s" : "") + reste),
      el("button", { class: "big", onclick: () => nouvelleSeance(mode, modalite, true, anc) }, "Reprendre"),
      el("button", { class: "soft", onclick: () => { demarrerS(mode, modalite, p, anc); terminer(); } }, "Terminer cette partie"),
      el("button", { class: "soft", onclick: accueil }, "Retour à l'accueil")));
  }
  /* La minuterie n'interrompt jamais une question : la séance se termine à la réponse suivante. */
  function tick() { if (!S || S.fini) return; const h = $("#chrono"); if (h) h.textContent = fmt(S.fin - Date.now()); }
  const majScore = () => { const h = $("#score"); if (h) h.textContent = S.score; };
  const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function enregistrer() {
    if (!S || S.enregistre || S.questions === 0) return;
    S.enregistre = true;
    const duree = S.mode === "7min" ? Math.round(P.modesApprentissage.minutes * 60 - Math.max(0, (S.fin - Date.now()) / 1000)) : Math.round((Date.now() - S.t0) / 1000);
    const complete = S.mode === "7min" ? duree >= 0.8 * P.modesApprentissage.minutes * 60 : S.serie >= P.modesApprentissage.challengeReponsesDAffilee;
    E.seances.push({ id: S.id, date: ymd(S.t0), t0: S.t0, mode: S.mode, duree, complete, q: S.questions, bonnes: S.bonnes, score: S.score, erreurs: S.erreurs, su: S.su });
    E.seances = E.seances.slice(-80); sauver();
  }
  function abandonnerSeance() {
    if (!S || S.fini) return;
    sauverPartie(true);
    S.fini = true; clearInterval(S.timer); if (S.auto) clearTimeout(S.auto);
  }

  const elementsPrecedents = () => R().contexteEtrangerElements;
  const loin = e => !S.recent.slice(-elementsPrecedents()).includes(e.id);   // le mot n'est pas apparu dans les derniers éléments

  /* ---------- parcours par séries ----------
     Une série = une activité posée une fois à chaque mot concerné de la fenêtre (les mots ratés reviennent une fois à la fin).
     Dans la « visite guidée » (modalité interne « auto »), les séries s'enchaînent dans l'ordre logique : sens, bon mot, pluriel (découverte), pièges (approfondissement), écriture (validation).
     Entre deux séries, un écran de fin propose l'activité suivante, les autres activités de la section, ou la section suivante. */
  const ETAPES = ["sens", "mot", "pluriel", "pieges", "syllabe", "lettres", "composes", "dictee", "variantes", "partic", "son", "preparer", "saisie"];
  const ORTHO = ["pieges", "syllabe", "lettres", "composes", "dictee"];        // activités du domaine orthographique
  const LEX = ["variantes", "partic"];                                                  // activités du domaine lexical
  const PHON = ["son"];                                                                        // activité du domaine phonétique (reconnaissance à l'oreille ; ne conditionne pas la validation)
  const domDe = act => ORTHO.includes(act) ? "ortho" : LEX.includes(act) ? "lex" : PHON.includes(act) ? "phon" : null;
  const SECTION = { sens: "Découverte", mot: "Découverte", pluriel: "Découverte", article: "Découverte", trous: "Découverte", pieges: "Approfondissement", syllabe: "Approfondissement", lettres: "Approfondissement", composes: "Approfondissement", majuscule: "Approfondissement", dictee: "Approfondissement", variantes: "Approfondissement", genre: "Approfondissement", partic: "Approfondissement", son: "Approfondissement", preparer: "Validation", saisie: "Validation" };
  const NOM_ACT = { sens: "Comment dit-on en français ?", mot: "Quel est le bon mot ?", pluriel: "Pluriel", article: "Der, Die ou Das ?", trous: "Texte et phrases à trous", pieges: "Pièges d'orthographe", syllabe: "Syllabe difficile", lettres: "Lettres difficiles", composes: "Mots composés", majuscule: "Majuscule", dictee: "Dictée", variantes: "Variantes du mot", genre: "Der, die ou das ? (genre)", partic: "Particularités des mots", son: "Reconnaissance audio", preparer: "Préparer la validation", saisie: "Écrire le mot" };
  const MAX_TOURS = { pieges: 5, syllabe: 2, lettres: 2, composes: 2, majuscule: 2, dictee: 2, variantes: 3, genre: 3, partic: 4, son: 3, preparer: 1 };        // nombre maximal de fois où un mot est posé dans une activité au cours d'une même séance (3 par défaut)
  const tours = (e, act) => S.tours[act + ":" + e.id] || 0;
  const libre = () => S.modalite !== "auto";
  const applicable = (e, act) => act === "pluriel" ? aPluriel(e) : act === "article" ? estNom(e) : act === "pieges" ? (e.distracteurs || []).length >= 2 : act === "syllabe" ? !!syllabeInfo(e) : act === "lettres" ? !!lettresInfo(e) : act === "composes" ? composesOk(e) : act === "majuscule" ? false : act === "dictee" ? dicteeOk(e) : act === "variantes" ? variantesOk(e) : act === "genre" ? false : act === "cas" ? false : act === "partic" ? particKinds(e, !(S && S.modalite === "partic")).length > 0 : act === "son" ? sonOk(e) : act === "preparer" ? lettresOk(e) : act === "saisie" && e.type === "phrase" ? !!(e.pointsDifficiles || []).length : true;
  /* en parcours automatique, un mot n'est proposé que s'il a encore besoin de l'activité */
  function besoin(e, act) {
    const s = st(e.id);
    if (!applicable(e, act) || tours(e, act) >= (MAX_TOURS[act] || 3)) return false;
    switch (act) {
      case "sens": return s.fait.sens < 1 && !reconnuF(e);               // le test « sens » est facultatif
      case "mot": return s.fait.mot < 1;
      case "pluriel": return s.fait.pluriel < 1;
      case "pieges": case "syllabe": case "lettres": case "majuscule": case "dictee": return reconnuF(e) && !domValide(e, "ortho");
      case "variantes": case "genre": case "partic": return reconnuF(e) && !domValide(e, "lex");
      case "son": return reconnuF(e) && !domValide(e, "phon");
      case "composes": return reconnuF(e) && !domValide(e, "ortho") && (s.cdone || 0) < sequenceComposes(e).length;
      case "preparer": if (e.niveauLivre === "connu") return !s.rappel && !S.reposent.includes(e.id);
        return e.objectif !== "reconnu" && reconnuF(e) && domainesFaits(e) && !S.reposent.includes(e.id);
      case "saisie": if (e.niveauLivre === "connu") return !!s.rappel && !S.reposent.includes(e.id);
        return e.objectif !== "reconnu" && reconnuF(e) && domainesFaits(e) && !S.reposent.includes(e.id);
    }
    return false;
  }
  function nouvelleSerie(act) {
    S.etape = act; S.credL = act === "preparer" ? budgetLettres() : null; S.faits = []; S.reprises = []; S.reprisesFaites = []; S.sb = 0; S.sq = 0; S.exo = null;
  }
  function reste(act) {
    const base = fenetre().concat(act === "preparer" || act === "saisie" ? rappel() : [], libre() && act === "saisie" ? aConfirmer() : []);
    return base.filter(e => (libre() ? applicable(e, act) : besoin(e, act)) && !S.faits.includes(e.id));
  }
  /* L'activité a-t-elle au moins un mot dans la fenêtre ? (sinon son bouton est grisé) */
  const RAISON = {
    pieges: "aucun mot de ta fenêtre n'a de fausses écritures prévues", syllabe: "aucun mot de ta fenêtre n'a plusieurs syllabes avec une syllabe difficile (les mots d'une syllabe n'en ont pas)",
    lettres: "aucun mot de ta fenêtre n'a de lettres difficiles", composes: "aucun mot composé dans ta fenêtre", dictee: "aucun mot de ta fenêtre ne se dicte", variantes: "aucun nom avec pluriel ni verbe avec forme « er » dans ta fenêtre",
    son: "aucun mot de ta fenêtre n'a de mots aux sons voisins", partic: "aucun mot concerné dans ta fenêtre", trous: "pas de texte à trous pour ce lot" };
  /* groupe de couleur et caractère obligatoire de chaque activité (obligatoire = compte pour valider le mot : reconnaissance, orthographe, formes, écriture) */
  const GROUPE = { sens: ["dec", "fac"], mot: ["dec", "obl"], pluriel: ["dec", "obl"], article: ["dec", "fac"], trous: ["dec", "fac"],
    pieges: ["ort", "obl"], syllabe: ["ort", "obl"], lettres: ["ort", "obl"], composes: ["ort", "obl"], dictee: ["ort", "obl"],
    variantes: ["lex", "obl"], partic: ["lex", "obl"], son: ["pho", "fac"], preparer: ["val", "obl"], saisie: ["val", "obl"] };
  const classeAct = a => GROUPE[a] ? " g-" + GROUPE[a][0] + " " + GROUPE[a][1] : "";
  const raisonGris = act => (act === "son" || act === "dictee") && !(E && E.reglages.voix) ? "la voix est désactivée (⚙)" : (act === "son" || act === "dictee") && !voixAllemande() ? "ce navigateur n'a pas de voix allemande" : (RAISON[act] || "aucun mot de ta fenêtre ne s'y prête");
  const dispoAct = act => {
    if (act === "trous") return exosTrous().length > 0;
    if (act === "partic") return fenetre().some(e => particKinds(e, true).length > 0);
    const base = fenetre().concat(act === "preparer" || act === "saisie" ? rappel() : [], act === "saisie" ? aConfirmer() : []);
    return base.some(e => applicable(e, act));
  };
  function prochaineEtape(apres) {
    const i0 = apres ? (ETAPES.includes(apres) ? ETAPES.indexOf(apres) : 2) : -1;     // « Der, Die ou Das ? » compte comme la fin de la découverte
    const ordre = ETAPES.slice(i0 + 1).concat(ETAPES.slice(0, i0 + 1));
    return ordre.find(a => fenetre().concat(a === "preparer" || a === "saisie" ? rappel() : []).some(e => besoin(e, a))) || null;
  }
  const aucun = () => fenetre().length + aConfirmer().length + rappel().length ? { attente: true } : null;
  /* Exercice « à trous » : une seule activité par vague, écrite par l'IA dans la banque (banque.exercicesTrous).
     À chaque mot correspond un trou soit dans le texte, soit dans une phrase isolée : tout est visible en une fois.
     Activité facultative de la découverte : elle ne change jamais l'état d'un mot. */
  function exosTrous() {
    const ex = B.exercicesTrous || [], cle = x => x.groupe != null ? x.groupe : x.vague;      // lot sans vagues : exercices par groupe thématique
    const vagues = [...new Set(ex.map(cle))];
    return vagues.map((v, i) => {
      const t = ex.find(x => cle(x) === v && x.type === "texte"), p = ex.find(x => cle(x) === v && x.type === "phrases");
      const dansTexte = new Set(t ? t.texte.trous.map(g => g.mot) : []);
      const phrases = p ? p.items.filter(it => !it.trous.some(g => dansTexte.has(g.mot))) : [];
      const items = (t ? [Object.assign({ texte: true }, t.texte)] : []).concat(phrases);
      return { id: typeof v === "number" ? "trous-v" + v : "trous-" + v, vague: i, titre: (t || p).titre, items, mots: [...new Set(items.flatMap(it => it.trous.map(g => g.mot)))] };
    }).filter(x => x.items.length && x.mots.some(m => byId[m] && byId[m].lot === E.lot && retenu(byId[m])));
  }
  function choisirExo() {
    const w = fenetre().map(e => e.id), fait = (E.trous = E.trous || {});
    const liste = exosTrous(); if (!liste.length) return null;
    const score = x => [(fait[x.id] || {}).n || 0, -x.mots.filter(m => w.includes(m)).length, x.vague];
    return liste.slice().sort((a, b) => { const A = score(a), Bs = score(b); return A[0] - Bs[0] || A[1] - Bs[1] || A[2] - Bs[2]; })[0];
  }
  function prochaineTrous() {
    if (S.exo) return null;                       // l'exercice entier tient en une question
    S.exo = choisirExo(); if (!S.exo) return "vide";
    E.trous = E.trous || {}; E.trous[S.exo.id] = { n: ((E.trous[S.exo.id] || {}).n || 0) + 1, date: ymd(Date.now()) };
    return { e: { id: "trous:" + S.exo.id, type: "trous", de: S.exo.titre, fr: [] }, act: "trous", trous: { ex: S.exo } };
  }
  function noterSerie(ok) {
    const q = S.q; if (!q) return;
    q.repondu = true;
    if (!q.serie) return;
    S.sq++; if (ok) S.sb++;
    else if (!S.reprisesFaites.includes(q.e.id)) { S.reprises.push(q.e.id); S.reprisesFaites.push(q.e.id); }
  }
  /* Choix du prochain élément. Une saisie n'est proposée qu'en contexte étranger (sauf contrôle de reprise après détour).
     Retourne null (plus rien à travailler), {attente:true} (les mots restants doivent se reposer), {vide:true},
     {interlude:{fini,suivant}} (écran de fin de série) ou {e, act}. */
  function choisir() {
    if (S.force.length) { const f = S.force.shift(); return { e: byId[f.id], act: f.act }; }
    const gap = R().espacementMinEntreEssais;
    /* révision espacée : un mot « à confirmer » revient en contexte étranger */
    const conf = aConfirmer().filter(e => loin(e) && E.q - st(e.id).dq > gap);
    if (conf.length && !libre() && Math.random() < 0.35) return { e: shuffle(conf)[0], act: "saisie" };
    for (let tour = 0; tour < 8; tour++) {
      if (!S.etape) {
        const suiv = prochaineEtape(S.precedent);
        if (!suiv) { if (S.precedent && S.sq > 0 && libre()) return { interlude: { fini: S.precedent, suivant: null } }; return aucun(); }
        if (S.precedent && S.sq > 0 && !(suiv === S.precedent && !libre())) return { interlude: { fini: S.precedent, suivant: suiv } };
        nouvelleSerie(suiv); S.precedent = null;
      }
      const act = S.etape;
      if (act === "preparer" && S.credL <= 0) { S.precedent = act; S.etape = null; S.reprises = []; continue; }   // budget épuisé : la série s'arrête là
      if (act === "trous") {
        const t = prochaineTrous();
        if (t === "vide") return { vide: true };
        if (t) return t;
        S.precedent = act; S.etape = null; S.exo = null; continue;
      }
      const tous = reste(act).concat(S.reprises.map(i => byId[i]));
      const ok = act === "saisie" ? tous.filter(loin) : tous;
      if (!ok.length) {
        if (!tous.length && S.sq === 0 && libre()) return { vide: true };
        if (act === "saisie") tous.forEach(e => S.reposent.push(e.id));             // ils se reposent : on les retrouvera dans un autre contexte
        S.precedent = act; S.etape = null; S.reprises = []; continue;
      }
      let ecart = ok.filter(e => E.q - st(e.id).dq > gap);
      if (!ecart.length) ecart = ok.filter(e => !S.recent.slice(-1).includes(e.id));
      if (!ecart.length) ecart = ok;
      const e = shuffle(ecart)[0], rep = S.reprises.includes(e.id);
      if (rep) S.reprises = S.reprises.filter(i => i !== e.id); else S.faits.push(e.id);
      S.tours[act + ":" + e.id] = tours(e, act) + 1;
      return { e, act, serie: true, rep };
    }
    return aucun();
  }
  /* Pourquoi aucune question ? Pour les activités sonores, on dit si c'est la voix, ou le manque de mots, qui est en cause. */
  function messageVide(act) {
    if ((act === "son" || act === "dictee") && !(E.reglages.voix)) return "Cette activité utilise le son, et la voix est désactivée dans les réglages (⚙). Active-la, ou essaie une autre activité.";
    if ((act === "son" || act === "dictee") && !voixAllemande()) return "Cette activité a besoin d'une voix allemande, et ce navigateur n'en propose pas pour l'instant. Les autres activités restent disponibles.";
    if (S && S.nAct && S.nAct[act]) return "Tu as fait le tour des mots de cette activité pour l'instant : les autres mots se reposent ou sont déjà bien installés. Essaie une autre activité.";
    if (act === "son") return "Aucun mot de ta fenêtre n'a de mots aux sons voisins pour cette activité : essaies-en une autre.";
    return "Aucun mot de ta fenêtre ne se prête à cette activité pour l'instant : essaie-en une autre.";
  }
  function suivante() {
    if (!S || S.fini) return;
    if (S.auto) { clearTimeout(S.auto); S.auto = null; }
    const c = choisir();
    if (c && c.vide) return terminer(messageVide(S.etape));
    if (c && c.interlude) return vueInterlude(c.interlude);
    if (!c || c.attente) return terminer(c ? "Quelques mots se reposent : on les retrouve à ta prochaine séance, c'est le meilleur moyen de vérifier qu'ils sont bien installés." : (S.anciens ? "Tes anciens mots sont bien installés. Bravo !" : "Tous les mots de ce lot sont sus. Bravo ! Tu peux passer au lot suivant dans les paramètres."), !c);
    c.etranger = loin(c.e);
    S.q = c; S.recent.push(c.e.id); if (S.recent.length > 12) S.recent.shift();
    sauverPartie(true);
    dessiner();
  }
  /* Écran de fin de série : le chronomètre est en pause. */
  function vueInterlude({ fini, suivant }) {
    S.pause = Date.now(); sauverPartie(false);
    const reprendre = f => { if (S.pause) { if (S.fin) S.fin += Date.now() - S.pause; S.pause = null; } f(); };
    const lancer = (modalite, etape) => reprendre(() => { S.modalite = modalite; E.reglages.modalite = modalite; S.force = []; S.precedent = null; nouvelleSerie(etape); sauver(); suivante(); });
    const sect = SECTION[fini];
    const autres = (sect === "Découverte" ? ["sens", "mot", "pluriel", "article"].concat(exosTrous().length ? ["trous"] : []) : sect === "Approfondissement" ? ORTHO.concat(LEX, PHON) : ["preparer", "saisie"]).filter(a => a !== suivant && a !== fini && dispoAct(a));
    const changeSection = suivant && SECTION[suivant] !== sect;
    const n = S.sb;
    const record = E.recordLettres || 0;
    if (fini === "preparer") { E.recordLettres = Math.max(record, n); sauver(); }
    vue(el("div", { class: "card center" }, el("h2", {}, "Série terminée !"),
      fini === "preparer" ? el("p", {}, "Avec tes " + budgetLettres() + " crédits, tu as réussi " + n + " mot" + (n > 1 ? "s" : "") + (S.credL > 0 ? " : tous les mots de la série sont faits, il te reste " + S.credL + " crédit" + (S.credL > 1 ? "s" : "") + "." : " avant la fin de ton budget.") + (n > 0 && n > record ? " C'est ton meilleur résultat !" : (record ? " Ton meilleur résultat : " + Math.max(record, n) + "." : "")))
        : el("p", {}, NOM_ACT[fini] + " : " + n + " bonne" + (n > 1 ? "s" : "") + " réponse" + (n > 1 ? "s" : "") + " sur " + S.sq + "."),
      el("p", { class: "prompt", style: "margin:0" }, "★ " + S.score),
      suivant ? el("p", { class: "mute small" }, changeSection ? "Prochaine étape : la section « " + SECTION[suivant] + " »." : "Prochaine activité de la section « " + SECTION[suivant] + " ».") : null,
      suivant ? el("button", { class: "big", id: "continuer", onclick: () => lancer("auto", suivant) }, "Continuer · " + NOM_ACT[suivant]) : null,
      autres.length ? el("div", { class: "small mute", style: "margin-top:10px" }, "Ou une autre activité :") : null,
      autres.length ? el("div", { class: "row" }, autres.map(a => el("button", { class: "soft" + classeAct(a), onclick: () => lancer(a, a) }, NOM_ACT[a]))) : null,
      sect === "Découverte" && !(suivant && SECTION[suivant] === "Approfondissement") ? el("button", { class: "soft", onclick: () => lancer("pieges", "pieges") }, "Passer à l'approfondissement") : null,
      el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "soft", onclick: () => reprendre(() => terminer()) }, "Terminer la séance"),
        el("button", { class: "soft", onclick: accueil }, "Retour à l'accueil"))));
  }
  function entete() {
    const but = P.modesApprentissage.challengeReponsesDAffilee;
    const seg = el("div", { class: "seg", role: "group", "aria-label": "Type d'activité" }, [["auto", "Visite guidée"], ["sens", "En français"], ["mot", "Bon mot"], ["pluriel", "Pluriel"], ["article", "Der Die Das"], ["trous", "À trous"], ["pieges", "Pièges"], ["syllabe", "Syllabe"], ["lettres", "Lettres"], ["composes", "Composés"], ["dictee", "Dictée"], ["variantes", "Variantes"], ["partic", "Particularités"], ["son", "Audio"], ["preparer", "Préparer"], ["saisie", "Écrire"]].map(([k, n]) =>
      el("button", { type: "button", class: S.modalite === k ? "on" : "", "aria-pressed": S.modalite === k ? "true" : "false", onclick: () => { S.modalite = k; E.reglages.modalite = k; S.force = []; S.precedent = null; if (k === "auto") S.etape = null; else nouvelleSerie(k); sauver(); suivante(); } }, n)));
    return el("div", {}, el("div", { class: "hud" },
      el("button", { class: "ib", onclick: () => terminer() }, "Terminer"),
      S.mode === "7min" ? el("span", {}, "⏱ ", el("b", { id: "chrono" }, fmt(S.fin - Date.now()))) : el("span", {}, "Série : ", el("b", {}, S.serie + " / " + but)),
      el("span", {}, "★ ", el("b", { id: "score" }, S.score))), seg,
      S.etape && S.q && S.q.serie ? el("div", { class: "small mute", style: "text-align:center;margin:4px 0" }, NOM_ACT[S.etape] + " · " + S.faits.length + " / " + (S.faits.length + reste(S.etape).length)) : null);
  }

  /* ---------- questions ---------- */
  function dessiner() {
    const { e, act } = S.q;
    const cadre = el("div", { class: "card" }); const zone = el("div", {});
    cadre.append(zone);
    if (act === "saisie") (e.type === "phrase" ? questionSaisiePhrase : questionSaisie)(e, zone);
    else if (act === "recopier") questionRecopier(e, zone);
    else if (act === "trous") questionTrous(S.q, zone);
    else if (act === "preparer") questionLettres(e, zone);
    else if (act === "lettres") questionLettresDiff(e, zone);
    else if (act === "composes") questionComposes(e, zone);
    else if (act === "dictee") questionDictee(e, zone);
    else if (act === "majuscule") questionMajuscule(e, zone);
    else if (act === "variantes") questionVariantes(e, zone);
    else if (act === "partic") questionPartic(e, zone);
    else if (act === "son") questionSon(e, zone);
    else questionQcm(e, act, zone);
    vue(entete(), cadre);
  }
  const normF = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  /* x ne doit jamais servir de leurre pour e : même mot allemand (homonyme) ou traduction française commune (synonyme). */
  function tropProche(x, e) {
    if (x.de === e.de) return true;
    const fe = (e.fr || []).map(normF);
    return (x.fr || []).some(f => fe.includes(normF(f)));
  }
  function options(e, act) {
    if (act === "article" || act === "genre") return { bon: e.art, liste: shuffle(["der", "die", "das"]) };
    if (e.type === "phrase") {
      const q = e.qcm || {};
      if (act === "sens") { const bon = e.fr[0]; return { bon, liste: shuffle([bon, ...(q.fr || []).slice(0, 3)]) }; }
      const bon = e.de; return { bon, liste: shuffle([bon, ...(q.de || []).slice(0, 3)]) };
    }
    const pool = B.entrees.filter(x => x.type === "mot" && x.lot === e.lot && x.id !== e.id && !tropProche(x, e));
    const memes = pool.filter(x => x.pos === e.pos), autres = pool.filter(x => x.pos !== e.pos);
    const prends = (f, n, deja) => { const out = [], vus = new Set(deja); for (const x of shuffle(memes).concat(shuffle(autres))) { const v = f(x); if (v && !vus.has(v)) { vus.add(v); out.push(v); if (out.length === n) break; } } return out; };
    if (act === "syllabe") { const I = syllabeInfo(e); return { bon: I.bonne, liste: shuffle([I.bonne, ...shuffle(I.fausses).slice(0, 3).map(x => x.forme)]), fausses: I.fausses, I }; }
    if (act === "pieges") { const pre = e.art ? e.art + " " : "", bon = pre + e.de, d = shuffle(e.distracteurs || []).slice(0, 3); return { bon, liste: shuffle([bon, ...d.map(x => pre + x.forme)]), distr: d, pre }; }
    if (act === "sens") { const bon = e.fr[0]; return { bon, liste: shuffle([bon, ...prends(x => x.fr[0], 3, [bon])]) }; }
    if (act === "mot") { const bon = lib(e); return { bon, liste: shuffle([bon, ...prends(lib, 3, [bon])]) }; }
    const bon = "die " + plEff(e); return { bon, liste: shuffle([bon, ...pluriels(e).map(p => "die " + p)]) };
  }
  function questionQcm(e, act, zone) {
    const O = options(e, act), { bon, liste } = O;
    const ph = e.type === "phrase";
    const consigne = { sens: ph ? "Comment dit-on cette phrase en français ?" : "Comment dit-on en français ?", mot: ph ? "Comment dit-on cela en allemand ?" : "Quel est le bon mot ?", pluriel: "Quel est le pluriel ?", article: "Der, die ou das ?", genre: "Quel est l'article (le genre) ?", pieges: "Quelle est la bonne écriture ?", syllabe: "Quelle syllabe manque ?" }[act];
    const francais = act === "mot" || act === "pieges" || act === "syllabe";
    const texte = francais ? e.fr[0] : (act === "article" || act === "genre") ? e.de : lib(e);
    const motTrou = act === "syllabe" ? (e.art ? e.art + " " : "") + O.I.syllabes.map((x, i) => i === O.I.k ? "▢▢▢" : x).join("") : null;
    zone.append(el("div", { class: "sub" }, consigne),
      el("div", { class: "prompt" }, francais ? texte : de(texte), " ", (act === "sens" || act === "pluriel") ? audioBtn(lib(e)) : ""),
      ...(act === "pluriel" || act === "article" || act === "genre" ? [el("div", { class: "sub" }, frs(e))] : []),
      ...(motTrou ? [el("div", { class: "prompt", lang: "de", style: "letter-spacing:.04em" }, motTrou)] : []));
    if (act === "sens") parler(lib(e));
    const fb = el("div", { "aria-live": "polite" }); const opts = el("div", { class: "opts" });
    const boutons = liste.map(l => el("button", { class: "opt", type: "button", onclick: () => {
      boutons.forEach(b => b.disabled = true);
      const ok = l === bon;
      boutons.forEach(b => { if (b.textContent === bon) b.classList.add("good"); });
      if (!ok) boutons.find(b => b.textContent === l).classList.add("try");
      const mauvais = O.distr && O.distr.find(x => O.pre + x.forme === l);
      const fausse = O.fausses && O.fausses.find(x => x.forme === l);
      const expl = act === "sens" ? `« ${lib(e)} » veut dire « ${e.fr[0]} ».` : act === "mot" ? `En allemand : ${lib(e)}.`
        : act === "article" ? `On dit ${lib(e)}.` : act === "genre" ? expliquerGenre(e) : act === "pieges" ? (ok ? `Bien vu : ${bon}.` : `${bon}.` + (mauvais && mauvais.expl ? ` Le piège : ${mauvais.expl}.` : ""))
        : act === "syllabe" ? `${lib(e)} : « ${bon} ».` + (!ok && fausse && fausse.expl ? ` À retenir : ${fausse.expl}.` : "")
        : `Le pluriel de ${lib(e)} est die ${plEff(e)}.`;
      if (act !== "sens") parler(act === "pluriel" ? "die " + plEff(e) : lib(e));
      repondre(e, act, ok, bon, l, expl, fb);
    } }, act === "sens" ? l : de(l)));
    boutons.forEach(b => opts.append(b));
    zone.append(opts, fb);
  }
  function repondre(e, act, ok, attendu, donne, expl, fb) {
    const s = st(e.id);
    E.q++; s.dq = E.q; s.vus++; s.dern = act; if (ok && s.fait[act] != null) s.fait[act]++;
    if (s.etat === "nouveau") s.etat = "enCours";
    if (domDe(act) && domApplicable(e, domDe(act)) && noterDomaine(e, domDe(act), ok)) expl += domDe(act) === "ortho" ? " L'orthographe de ce mot est validée !" : domDe(act) === "lex" ? " Les formes de ce mot sont validées !" : " Tu reconnais bien ce mot à l'oreille !";
    /* objectif « reconnu » : les tests « mot » et « pluriel » réussis suffisent (le test « sens » est facultatif) */
    if (e.objectif === "reconnu" && s.etat !== "su" && s.fait.mot >= 1 && (!aPluriel(e) || s.fait.pluriel >= 1)) s.etat = "reconnu";
    if (act === "preparer" && ok && e.niveauLivre === "connu") s.rappel = true;      // zone grise : le rappel est fait, la saisie peut suivre
    S.questions++;
    S.nAct = S.nAct || {}; S.nAct[act] = (S.nAct[act] || 0) + 1;
    let gain = 0;
    if (ok) { S.bonnes++; S.serie++; gain = crediter(act); } else { S.serie = 0; S.erreurs.push({ id: e.id, act, donne, attendu }); }
    noterSerie(ok);
    majScore(); sauver(); sauverPartie(false);
    fb.replaceChildren(el("div", { class: "fb " + (ok ? "ok" : "try") }, ok ? "Bravo ! " : "On le retient ensemble : ", el("b", {}, expl), ok ? el("span", { class: "gain" }, " +" + gain) : null,
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "soft", type: "button", id: "suite", onclick: apresReponse }, "Suite →"))));
    $("#suite").focus();
    S.auto = ok ? setTimeout(apresReponse, 1100) : null;
  }
  function apresReponse() {
    if (S && S.auto) { clearTimeout(S.auto); S.auto = null; }
    if (!S || S.fini) return;
    if (S.mode === "challenge" && S.serie >= P.modesApprentissage.challengeReponsesDAffilee) return terminer();
    if (S.mode === "7min" && Date.now() >= S.fin) return terminer();
    suivante();
  }

  /* ---------- préparer la validation : lettres en étoile (mot court) ou lettres à deviner (mot long) ----------
     Dernier entraînement avant l'écriture du mot : il compte comme une apparition du mot (contexte étranger) mais ne décide jamais du statut « su ». */
  const estLettre = c => /\p{L}/u.test(c);
  const lettresMot = e => [...e.de].filter(estLettre);
  const lettresOk = e => e.type === "mot" && !e.de.includes(",") && lettresMot(e).length >= 2 && lettresMot(e).length <= 22;
  const motCourt = () => (P.rappelBase && P.rappelBase.seuilMotCourt) || 6;
  const budgetLettres = () => (P.jeuDesLettres && P.jeuDesLettres.credits) || 40;
  const artSpan = e => estNom(e) ? el("span", { class: "artl" }, e.art + " ") : "";
  /* Budget global de la série (jeuDesLettres.credits, 40 par défaut) : chaque lettre fausse ou achetée coûte 1 crédit.
     Le score est le nombre de mots réussis avec ce budget : la série s'arrête quand il est épuisé. */
  function questionLettres(e, zone) {
    const Q = S.q;
    if (S.credL == null) S.credL = budgetLettres();
    Q.mode = Q.mode || E.reglages.modeLettres || (lettresMot(e).length <= motCourt() ? "etoile" : "deviner");      // la bascule choisie par l'élève est conservée pour les mots suivants
    const autre = Q.mode === "etoile" ? "deviner" : "etoile";
    const fb = el("div", { "aria-live": "polite" });
    const bascule = el("button", { class: "soft", type: "button", id: "bascule", onclick: () => { Q.mode = autre; E.reglages.modeLettres = autre; sauver(); dessiner(); } }, autre === "etoile" ? "Plutôt les lettres en étoile" : "Plutôt deviner les lettres");
    const total = budgetLettres(), barre = el("div", { class: "cbar", "aria-hidden": "true" }, el("i")), txt = el("div", { class: "small mute center", id: "credits", "aria-live": "polite" });
    const majCred = () => { txt.textContent = "Crédits restants : " + S.credL + " / " + total + " · mots réussis dans la série : " + S.sb; barre.firstChild.style.width = Math.max(0, 100 * S.credL / total) + "%"; };
    /* dépenser : retourne vrai quand le budget est épuisé */
    const depenser = () => { S.credL = Math.max(0, S.credL - 1); sauverPartie(true); majCred(); return S.credL <= 0; };
    const fin = (ok, donne) => {
      bascule.disabled = true;
      const epuise = S.credL <= 0;
      repondre(e, "preparer", ok, lib(e), donne, lib(e) + "." + (epuise ? " Ton budget est épuisé : la série s'arrête ici." : ""), fb); parler(lib(e));
    };
    zone.append(el("div", { class: "sub" }, Q.mode === "etoile" ? "Remets les lettres dans l'ordre" : "Devine les lettres du mot (une lettre qui revient se touche chaque fois)"), el("div", { class: "prompt" }, frs(e)), barre, txt);
    majCred();
    (Q.mode === "etoile" ? jeuEtoile : jeuDeviner)(e, zone, fin, depenser);
    zone.append(fb, el("div", { class: "row" }, bascule));
  }
  /* lettres en étoile : la bonne lettre se place dans la prochaine case ; une mauvaise lettre coûte 1 crédit */
  function jeuEtoile(e, zone, fin, depenser) {
    const chars = [...e.de], cible = chars.filter(estLettre), posees = [];
    const bas = c => c.toLowerCase();     // l'étoile n'a que des minuscules : la majuscule du début ne doit pas dire quelle lettre commence le mot
    const besoinL = {}; cible.forEach(c => besoinL[bas(c)] = (besoinL[bas(c)] || 0) + 1);
    const distinctes = shuffle(Object.keys(besoinL));
    const cases = el("div", { class: "cells", "aria-label": "Ta réponse" }), etoile = el("div", { class: "star", role: "group", "aria-label": "Lettres à placer" });
    let fini = false, faux = null;
    function dessinerEtoile() {
      let k = 0;
      cases.replaceChildren(artSpan(e), ...chars.map(c => {
        if (!estLettre(c)) return el("span", { class: "fixe" }, c === " " ? "  " : c);
        const j = k++, p = posees[j];
        return el("span", { class: "cell" + (p ? " full" : "") + (fini && !p ? " try" : ""), lang: "de" }, p || (fini ? cible[j] : " "));
      }));
      const reste = Object.assign({}, besoinL); posees.forEach(p => reste[bas(p)]--);
      etoile.replaceChildren(...distinctes.map((c, i) => {
        const a = 2 * Math.PI * i / distinctes.length - Math.PI / 2;
        return el("button", { type: "button", class: "sb" + (faux === c ? " try" : ""), lang: "de", style: `left:${50 + 36 * Math.cos(a)}%;top:${50 + 36 * Math.sin(a)}%`, hidden: reste[c] > 0 ? false : "",
          onclick: () => {
            if (fini) return;
            if (c === bas(cible[posees.length])) { faux = null; posees.push(cible[posees.length]); if (posees.length === cible.length) { fini = true; dessinerEtoile(); return fin(true, posees.join("")); } }
            else { faux = c; if (depenser()) { fini = true; dessinerEtoile(); return fin(false, posees.join("")); } }
            dessinerEtoile();
          } }, c);
      }));
      etoile.hidden = fini;
    }
    zone.append(cases, etoile); dessinerEtoile();
  }
  function jeuDeviner(e, zone, fin, depenser) {
    const chars = [...e.de], bas = c => c.toLowerCase(), rev = new Set(), trouvees = new Set();     // rev : positions révélées ; trouvees : positions révélées par l'échec, montrées sans reproche
    const cases = el("div", { class: "cells", "aria-label": "Le mot à deviner" }), touches = el("div", { class: "lk" });
    let fini = false;
    const visible = i => !estLettre(chars[i]) || rev.has(i);
    const complet = () => chars.every((c, i) => visible(i));
    const btns = {};
    const premiere = l => chars.findIndex((c, i) => estLettre(c) && bas(c) === l && !rev.has(i));     // prochaine place de cette lettre
    const maj = () => cases.replaceChildren(artSpan(e), ...chars.map((c, i) => !estLettre(c) ? el("span", { class: "fixe" }, c === " " ? "  " : c)
      : el("span", { class: "cell" + (visible(i) ? " full" : "") + (trouvees.has(i) ? " try" : ""), lang: "de" }, visible(i) ? c : " ")));
    const rafraichir = () => Object.keys(btns).forEach(l => { if (premiere(l) < 0) btns[l].disabled = true; });
    const terminer_ = ok => {
      fini = true; Object.values(btns).forEach(b => b.disabled = true); acheter.disabled = true;
      if (!ok) chars.forEach((c, i) => { if (estLettre(c) && !rev.has(i)) { rev.add(i); trouvees.add(i); } });
      maj(); fin(ok, [...rev].sort((x, y) => x - y).map(i => bas(chars[i])).join(""));
    };
    const verifier = epuise => { if (complet()) terminer_(true); else if (epuise) terminer_(false); };
    const acheter = el("button", { class: "soft", type: "button", id: "acheter", onclick: () => {
      if (fini) return; const i = chars.findIndex((x, k) => estLettre(x) && !rev.has(k)); if (i < 0) return;
      rev.add(i); rafraichir();
      const epuise = depenser(); maj(); verifier(epuise);
    } }, "Acheter une lettre (−1)");
    "abcdefghijklmnopqrstuvwxyzäöüß".split("").forEach(l => {
      btns[l] = el("button", { type: "button", lang: "de", onclick: () => {
        if (fini) return;
        let epuise = false;
        const i = premiere(l);
        if (i >= 0) rev.add(i);                                  // une lettre en double ou en triple se choisit à chaque fois
        else { btns[l].disabled = true; epuise = depenser(); }  // lettre absente du mot (ou déjà toute placée)
        rafraichir(); maj(); verifier(epuise);
      } }, l);
      touches.append(btns[l]);
    });
    zone.append(cases, touches, el("div", { class: "row" }, acheter)); maj();
  }

  /* ---------- approfondissement orthographique : tout vient des fausses écritures (distracteurs) écrites dans la banque ----------
     Chaque fausse écriture est alignée sur le mot juste (distance d'édition) : les positions où elles se trompent sont les « lettres difficiles » ;
     la syllabe qui en contient le plus est la « syllabe difficile ». Rien n'est tiré au hasard ; François peut corriger à la main dans l'éditeur
     (syllabes, difficile.syllabe, difficile.lettres). */
  function aligner(w, f) {
    const n = w.length, m = f.length, D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) D[i][0] = i; for (let j = 0; j <= m; j++) D[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (w[i - 1] === f[j - 1] ? 0 : 1));
    const seg = new Array(n).fill(""), ins = new Array(n + 1).fill("");
    let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (w[i - 1] === f[j - 1] ? 0 : 1)) { seg[i - 1] = f[j - 1]; i--; j--; }
      else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { seg[i - 1] = ""; i--; }
      else { ins[i] = f[j - 1] + ins[i]; j--; }
    }
    return { seg, ins };
  }
  /* positions fautives d'un alignement + lettres en trop ou à la place de la bonne (intrus) */
  function fautes(w, al) {
    const pos = [], intrus = [];
    for (let i = 0; i < w.length; i++) if (al.seg[i] !== w[i]) { pos.push(i); if (al.seg[i]) intrus.push(...al.seg[i]); }
    al.ins.forEach((x, g) => { if (!x) return; intrus.push(...x); pos.push(x[0] === w[g - 1] ? g - 1 : x[0] === w[g] ? g : Math.min(g, w.length - 1)); });
    return { pos, intrus };
  }
  const memoOrtho = {};
  function analyseOrtho(e) {
    if (memoOrtho[e.id]) return memoOrtho[e.id];
    const w = e.de, cnt = new Array(w.length).fill(0), cntOrt = new Array(w.length).fill(0), intrus = [], als = [];
    (e.distracteurs || []).forEach(d => { const al = aligner(w, d.forme), F = fautes(w, al); als.push({ al, d }); F.pos.forEach(p => { cnt[p]++; if (d.type !== "phonetique") cntOrt[p]++; }); intrus.push(...F.intrus); });
    return memoOrtho[e.id] = { cnt, cntOrt, intrus, als };
  }
  function lettresInfo(e) {
    if (e.type !== "mot" || e.de.includes(" ") || e.de.includes(",")) return null;
    const A = analyseOrtho(e), w = e.de;
    let pos = e.difficile && Array.isArray(e.difficile.lettres) && e.difficile.lettres.length ? e.difficile.lettres.slice() : null;
    if (!pos) {
      if (w.length < 4) return null;
      const cnt = A.cntOrt.some(c => c > 0) ? A.cntOrt : A.cnt;                 // on évite les fautes de prononciation pour choisir les lettres à placer
      pos = cnt.map((c, i) => ({ c, i })).filter(x => x.c > 0 && estLettre(w[x.i])).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, Math.min(3, Math.max(1, Math.floor(w.length / 2)))).map(x => x.i).sort((a, b) => a - b);
    }
    if (!pos.length) return null;
    const bonnes = pos.map(i => w[i]);
    const intrus = [...new Set(A.intrus.filter(l => estLettre(l) && !bonnes.includes(l)))].slice(0, 2);
    return { pos, bonnes, intrus };
  }
  function syllabeInfo(e) {
    if (e.type !== "mot" || e.de.includes(" ") || e.de.includes(",")) return null;
    const sy = Array.isArray(e.syllabes) && e.syllabes.join("") === e.de ? e.syllabes : null;
    if (!sy || sy.length < 2) return null;
    const A = analyseOrtho(e), deb = [], fin = []; let c = 0;
    sy.forEach(x => { deb.push(c); c += x.length; fin.push(c); });
    let k = e.difficile && e.difficile.syllabe ? e.difficile.syllabe - 1 : -1;
    if (k < 0) { let best = 0; sy.forEach((x, i) => { const t = A.cnt.slice(deb[i], fin[i]).reduce((a, b) => a + b, 0); if (t > best) { best = t; k = i; } }); }
    if (k < 0) return null;
    const a = deb[k], b = fin[k], fausses = [];
    A.als.forEach(({ al, d }) => {
      let t = ""; for (let g = a; g < b; g++) { if (g > a) t += al.ins[g]; t += al.seg[g]; }
      if (al.ins[b] && al.ins[b][0] === e.de[b - 1]) t += al.ins[b];
      if (t && t !== sy[k] && !fausses.some(x => x.forme === t)) fausses.push({ forme: t, expl: d.expl || "" });
    });
    if (fausses.length < 2) return null;
    return { syllabes: sy, k, bonne: sy[k], fausses };
  }
  /* trous partiels sur les mots composés : seconde racine, une autre question, puis première racine ; dans une famille, seul le premier mot suit ce déroulement */
  const composesOk = e => e.type === "mot" && !!e.composants && e.composants.length >= 2 && e.composants.join("") === e.de;
  function sequenceComposes(e) {
    const n = e.composants.length, fam = e.famille, pion = fam && (E.familles || {})[fam];
    if (fam && pion && pion !== e.id) { const i = e.composants.findIndex(c => c.toLowerCase() !== fam.toLowerCase()); return [i < 0 ? 0 : i]; }
    return [n - 1, 0].concat(Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1));
  }
  const aMaj = x => x.de[0] !== x.de[0].toLowerCase();
  const majusculeOk = e => e.type === "mot" && !e.de.includes(" ") && !e.de.includes(",") && /^\p{L}{2,}/u.test(e.de) && !/[-.]/.test(e.de) && (e.pos === "nom") === aMaj(e);   // mots dont la majuscule suit la règle (pas « Sie », etc.)
  const voixAllemande = () => {
    if (!(E && E.reglages.voix)) return false;
    const ad = AD();
    if (ad) { try { const v = ad.choisirVoix("Katja"); return !!v && /^de/i.test(v.lang || ""); } catch (e) { return false; } }
    return !!("speechSynthesis" in window && (speechSynthesis.getVoices() || []).some(v => /^de/i.test(v.lang)));
  };
  const sonOk = e => e.type === "mot" && !e.de.includes(",") && (e.voisins || []).length >= 2 && voixAllemande();
  const dicteeOk = e => e.type === "mot" && !e.de.includes(",") && e.de.length >= 3 && voixAllemande();

  function questionLettresDiff(e, zone) {
    const I = lettresInfo(e), chars = [...e.de], plac = I.pos.map(() => null);
    const tray = shuffle(I.bonnes.concat(I.intrus).map((l, i) => ({ l, i })));
    const cases = el("div", { class: "cells", "aria-label": "Le mot à compléter" }), bac = el("div", { class: "lk" }), fb = el("div", { "aria-live": "polite" });
    let fini = false;
    const valider = el("button", { class: "big", type: "button", id: "valider-lettres", disabled: "", onclick: () => {
      if (fini || plac.some(p => p == null)) return;
      fini = true; valider.disabled = true;
      const donne = plac.map(p => tray.find(t => t.i === p).l), ok = donne.every((l, k) => l === I.bonnes[k]);
      dessinerL(); bac.hidden = true;
      repondre(e, "lettres", ok, lib(e), donne.join(""), lib(e) + "." + (ok ? "" : " Lettres à retenir : " + I.bonnes.join(", ") + "."), fb); parler(lib(e));
    } }, "Valider");
    function dessinerL() {
      cases.replaceChildren(artSpan(e), ...chars.map((c, i) => {
        const k = I.pos.indexOf(i);
        if (k < 0) return el("span", { class: "lt" }, c);
        const p = plac[k], l = p == null ? " " : tray.find(t => t.i === p).l;
        return el("button", { type: "button", class: "cell" + (p != null ? " full" : "") + (fini ? (l === I.bonnes[k] ? " ok" : " try") : ""), "aria-label": "Lettre difficile " + (k + 1) + (p != null ? " : " + l : " vide"),
          onclick: () => { if (fini || plac[k] == null) return; plac[k] = null; dessinerL(); } }, fini && l !== I.bonnes[k] ? I.bonnes[k] : l);
      }));
      bac.replaceChildren(...tray.map(t => el("button", { type: "button", lang: "de", disabled: plac.includes(t.i) ? "" : false,
        onclick: () => { const k = plac.indexOf(null); if (k < 0 || fini) return; plac[k] = t.i; dessinerL(); } }, t.l)));
      valider.disabled = fini || plac.some(p => p == null);
    }
    zone.append(el("div", { class: "sub" }, "Place les " + I.pos.length + " lettres difficiles"), el("div", { class: "prompt" }, frs(e)), cases, bac, valider, fb);
    dessinerL();
  }
  function questionComposes(e, zone) {
    const Q = S.q, s = st(e.id), comps = e.composants;
    if (e.famille) { E.familles = E.familles || {}; if (!E.familles[e.famille]) E.familles[e.famille] = e.id; }
    const seq = sequenceComposes(e), h = (Q.rep && s.clast != null) ? s.clast : seq[(s.cdone || 0) % seq.length];
    const f = champ("", "c1"); f.i.size = Math.max(4, comps[h].length + 1); f.i.setAttribute("aria-label", "La partie qui manque");
    zone.append(el("div", { class: "sub" }, "Complète le mot composé"), el("div", { class: "prompt" }, frs(e)),
      el("div", { class: "cells", lang: "de" }, artSpan(e), ...comps.map((c, i) => i === h ? f.i : el("span", { class: "lt" }, c))));
    const fb = el("div", { "aria-live": "polite" });
    const valider = () => {
      if (f.i.disabled) return; f.i.disabled = true;
      const v = norm(f.i.value), att = norm(comps[h]), ok = v === att;
      if (!Q.rep) s.cdone = (s.cdone || 0) + 1; s.clast = h;
      let aide = "";
      if (!ok && v.toLowerCase() === att.toLowerCase()) aide = comps[h][0] === comps[h][0].toUpperCase() ? " Le mot commence par une majuscule." : " Ici, pas de majuscule : seul le début du mot en prend une.";
      f.i.classList.add(ok ? "ok" : "try");
      repondre(e, "composes", ok, comps[h], v, lib(e) + "." + aide, fb);
      parler(lib(e));
    };
    f.i.addEventListener("keydown", ev => { if (ev.key === "Enter") valider(); });
    zone.append(clavier(), el("button", { class: "big", type: "button", onclick: valider }, "Valider"), fb);
    setTimeout(() => f.i.focus(), 50);
  }
  /* Majuscule : quatre mots écrits en minuscules (le mot travaillé et trois autres du lot, noms et autres mots mélangés) ;
     l'élève touche ceux qui doivent prendre une majuscule. La règle (les noms) se lit sur la banque : majuscule dans le livre = nom. */
  function motsMajuscule(e) {
    const pool = B.entrees.filter(x => x.id !== e.id && x.lot === e.lot && majusculeOk(x));
    const autres = shuffle(pool.filter(x => aMaj(x) !== aMaj(e))), memes = shuffle(pool.filter(x => aMaj(x) === aMaj(e)));
    const choix = [e].concat(autres.slice(0, 2), memes.slice(0, 1));
    shuffle(pool).forEach(x => { if (choix.length < 4 && !choix.includes(x)) choix.push(x); });
    return shuffle(choix);
  }
  function questionMajuscule(e, zone) {
    const mots = motsMajuscule(e), etat = mots.map(() => false), fb = el("div", { "aria-live": "polite" });
    const bas = x => x.de[0].toLowerCase() + x.de.slice(1);
    let fini = false;
    const cases = el("div", { class: "maj" });
    const dessinerM = () => cases.replaceChildren(...mots.map((x, i) => el("button", { type: "button", class: "mj" + (etat[i] ? " on" : "") + (fini ? (etat[i] === aMaj(x) ? " ok" : " try") : ""), lang: "de", "data-maj": aMaj(x) ? "1" : "0", "aria-pressed": String(etat[i]),
      onclick: () => { if (fini) return; etat[i] = !etat[i]; dessinerM(); } }, el("span", { class: "mw" }, etat[i] || (fini && aMaj(x)) ? x.de[0].toUpperCase() + x.de.slice(1) : bas(x)), el("span", { class: "mf" }, frs(x)))));
    const valider = el("button", { class: "big", type: "button", id: "valider-maj", onclick: () => {
      if (fini) return; fini = true; valider.disabled = true;
      const ok = mots.every((x, i) => etat[i] === aMaj(x));
      dessinerM();
      const noms = mots.filter(aMaj).map(x => x.de), autres = mots.filter(x => !aMaj(x)).map(x => x.de);
      repondre(e, "majuscule", ok, aMaj(e) ? "majuscule" : "minuscule", etat.map((v, i) => (v ? "M " : "m ") + mots[i].de).join(" ; "),
        (noms.length ? "Majuscule : " + noms.join(", ") + " (les noms)." : "") + (autres.length ? " Minuscule : " + autres.join(", ") + " (pas des noms)." : ""), fb);
    } }, "Valider");
    zone.append(el("div", { class: "sub" }, "Touche les mots qui prennent une majuscule"), el("div", { class: "sub" }, "Les mots sont écrits en minuscules ; touche pour mettre la majuscule."), cases, valider, fb);
    dessinerM();
  }
  /* Reconnaissance audio : le mot est affiché, l'élève écoute quatre sons proches (le mot et trois mots de sons voisins) et choisit celui du mot. */
  function questionSon(e, zone) {
    const choix = shuffle([e.de].concat(shuffle(e.voisins).slice(0, 3))), fb = el("div", { "aria-live": "polite" });
    const boutons = [];
    zone.append(el("div", { class: "sub" }, "Écoute les sons : lequel dit ce mot en allemand ?"), el("div", { class: "prompt" }, frs(e)));       // le mot écrit n'est pas montré : seule l'oreille décide
    const lignes = el("div", { class: "sons" }, choix.map((m, i) => {
      const b = el("button", { class: "opt", type: "button", "data-bon": m === e.de ? "1" : "0", onclick: () => {
        boutons.forEach((x, j) => { x.disabled = true; x.textContent = (j + 1) + " · " + choix[j]; if (choix[j] === e.de) x.classList.add("good"); });
        const ok = m === e.de; if (!ok) b.classList.add("try");
        const autres = choix.filter(x => x !== e.de);
        repondre(e, "son", ok, e.de, m, `C'était « ${e.de} ». À ne pas confondre avec : ${autres.join(", ")}.` + ((e.voisinsInventes || []).some(x => autres.includes(x)) ? ` (Mot inventé, qui n'existe pas : ${(e.voisinsInventes || []).filter(x => autres.includes(x)).join(", ")}.)` : ""), fb);
        parler(e.de);
      } }, "Son " + (i + 1));
      boutons.push(b);
      return el("div", { class: "son" }, el("button", { class: "audio", type: "button", title: "Écouter le son " + (i + 1), "aria-label": "Écouter le son " + (i + 1), onclick: () => parler(m) }, "🔊"), b);
    }));
    zone.append(lignes, el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "soft", type: "button", id: "tout-ecouter", onclick: () => parlerSuite(choix) }, "🔊 Tout écouter")), curseurVitesse(() => parlerSuite(choix)), fb);
    setTimeout(() => parlerSuite(choix), 300);
  }
  function questionDictee(e, zone) {
    const att = lib(e);
    zone.append(el("div", { class: "sub" }, "Écoute, puis écris le mot" + (estNom(e) ? " avec son article" : "")), el("div", { class: "prompt" }, audioBtn(att)));       // pas de traduction française : elle donnerait le mot
    const f = champ("Ton écriture", "c1"); zone.append(f.w, clavier());
    const fb = el("div", { "aria-live": "polite" });
    const valider = () => {
      if (f.i.disabled) return; f.i.disabled = true;
      const v = norm(f.i.value), a = norm(att), ok = v === a;
      let aide = "", marques = new Set();
      if (!ok) {
        if (v.toLowerCase() === a.toLowerCase()) aide = "Regarde les majuscules : les noms en prennent une.";
        else { const F = fautes(a, aligner(a, v)); F.pos.forEach(p => marques.add(p)); aide = "Les lettres à retenir sont en couleur."; }
      }
      repondre(e, "dictee", ok, att, v, att + ".", fb);
      const b = fb.querySelector(".fb b");
      if (b && !ok && marques.size) b.replaceChildren(...[...a].map((c, i) => marques.has(i) ? el("mark", { class: "dl" }, c) : c), ".");
      if (aide && !ok) fb.querySelector(".fb").insertBefore(el("div", { style: "margin-top:4px" }, aide), fb.querySelector(".fb .row"));
      parler(att);
    };
    f.i.addEventListener("keydown", ev => { if (ev.key === "Enter") valider(); });
    zone.append(el("button", { class: "big", type: "button", onclick: valider }, "Valider"), curseurVitesse(() => { parler(att); f.i.focus(); }), fb);
    setTimeout(() => { parler(att); f.i.focus(); }, 300);
  }

  /* ---------- approfondissement lexical : variantes, genre, particularités grammaticales ---------- */
  const variantesOk = e => e.type === "mot" && (aPluriel(e) || (e.pos === "verbe" && !!e.er));
  /* Particularités des mots : participe passé, formes des adjectifs, article après une préposition (le pluriel des noms et la forme « er » restent dans « Variantes du mot ») */
  const casType = e => { const c = String(e.cas || ""); return /wechsel/i.test(c) ? "wechsel" : /dat/i.test(c) ? "dat" : /akk|acc/i.test(c) ? "acc" : null; };
  const casOk = e => e.type === "mot" && e.pos === "préposition" && !!casType(e);
  const PARTIC = [
    { id: "participe", nom: "Participe passé des verbes", ok: e => e.type === "mot" && e.pos === "verbe" && !!e.participe },
    { id: "femAdj", nom: "Féminin des adjectifs", ok: e => e.type === "mot" && e.pos === "adjectif" && !!e.feminin },
    { id: "plurAdj", nom: "Pluriel des adjectifs", ok: e => e.type === "mot" && e.pos === "adjectif" && !!e.pluralAdj },
    { id: "cas", nom: "Article après une préposition", ok: casOk }
  ];
  const particOk = e => PARTIC.some(P => P.ok(e));
  const particSel = () => { const v = E && E.reglages && E.reglages.partic; return Array.isArray(v) ? v : PARTIC.map(P => P.id); };
  const particKinds = (e, tous) => { const sel = tous ? null : particSel(); return PARTIC.filter(P => P.ok(e) && (!sel || sel.includes(P.id))).map(P => P.id); };
  /* Genre : pour un composé, l'article vient du dernier composant ; on le montre dans l'explication. */
  function expliquerGenre(e) {
    if (e.composants && e.composants.length > 1) {
      const dernier = e.composants[e.composants.length - 1], m = B.entrees.find(x => x.type === "mot" && x.art && x.de.toLowerCase() === dernier.toLowerCase());
      if (m) return `${lib(e)} : l'article vient du dernier élément, ${m.art} ${m.de}.`;
    }
    return `On dit ${lib(e)}.`;
  }
  /* Variantes : on écrit le pluriel du nom ou la forme « er … » du verbe (les formes viennent du livre). */
  function questionVariantes(e, zone) {
    const a = attenduSaisie(e), nom = aPluriel(e);
    zone.append(el("div", { class: "sub" }, nom ? "Écris le pluriel" : "Écris la forme conjuguée"), el("div", { class: "prompt" }, de(lib(e)), " ", audioBtn(lib(e))), el("div", { class: "sub" }, frs(e)));
    const f = champ(nom ? "Le pluriel (die …)" : a.lab, "c1"); zone.append(f.w, clavier());
    const fb = el("div", { "aria-live": "polite" });
    const valider = () => {
      if (f.i.disabled) return; f.i.disabled = true;
      const v = norm(f.i.value), ok = varianteJuste(e, v, a.variante);
      let aide = "";
      if (!ok) {
        const att = norm(a.variante).replace(PRONOM, "");
        if (sansUmlaut(v.toLowerCase()) === sansUmlaut(att.toLowerCase()) && v.toLowerCase() !== att.toLowerCase()) aide = " Regarde l'Umlaut (ä, ö, ü).";
        else if (v.toLowerCase().replace(/^die /, "") === att.toLowerCase()) aide = " Regarde les majuscules.";
      }
      f.i.classList.add(ok ? "ok" : "try");
      repondre(e, "variantes", ok, a.variante, v, (nom ? "die " + a.variante : a.variante) + "." + aide, fb);
      parler(nom ? "die " + a.variante : a.variante);
    };
    f.i.addEventListener("keydown", ev => { if (ev.key === "Enter") valider(); });
    zone.append(el("button", { class: "big", type: "button", onclick: valider }, "Valider"), fb);
    setTimeout(() => f.i.focus(), 50);
  }
  /* Article après une préposition à double régime : on ne garde que les formes sans ambiguïté
     (datif féminin « der », accusatif masculin « den », accusatif neutre « das ») ; le nom caché est révélé après la réponse. */
  const GENRE_NOM = { der: "masculin (der)", die: "féminin (die)", das: "neutre (das)" };
  function genererCas(e) {
    const noms = B.entrees.filter(x => estNom(x) && x.lot <= (E.lot || 99) && /^[A-ZÄÖÜ][\p{L}]+$/u.test(x.de) && ["der", "die", "das"].includes(x.art) && !x.plurielSeul);
    const t = casType(e), p = e.de;
    const genre = (t === "dat" ? ["die"] : t === "acc" ? shuffle(["der", "das"]) : shuffle(["die", "der", "das"])).find(g => noms.some(x => x.art === g)) || "die";
    const nom = shuffle(noms.filter(x => x.art === genre))[0];
    const dat = t === "dat" ? true : t === "acc" ? false : genre === "die";
    const art = dat ? "der" : genre === "der" ? "den" : "das";
    let sujet, regle;
    if (t === "wechsel") {
      sujet = shuffle(dat ? ["Das Buch liegt", "Das Heft liegt", "Der Ball liegt"] : ["Ich lege das Buch", "Ich lege das Heft", "Ich lege den Ball"])[0];
      regle = dat ? `« liegt » dit où se trouve l'objet (position, question wo ?) : on emploie le datif. Au datif, « der » devant un nom veut dire féminin.`
        : `« lege » dit vers où on met l'objet (mouvement, question wohin ?) : on emploie l'accusatif. À l'accusatif, « ${art} » veut dire ${genre === "der" ? "masculin" : "neutre"}.`;
    } else {
      sujet = "Das ist";
      regle = dat ? `« ${p} » est toujours suivi du datif. Au datif, « der » devant un nom veut dire féminin.`
        : `« ${p} » est toujours suivi de l'accusatif. À l'accusatif, « ${art} » veut dire ${genre === "der" ? "masculin" : "neutre"}.`;
    }
    return { phrase: `${sujet} ${p} ${art} ▢▢▢.`, nom, genre, bon: GENRE_NOM[genre], regle, complet: `${sujet} ${p} ${art} ${nom.de}.` };
  }
  /* Une question « Particularités » : une des particularités cochées qui concerne ce mot (tirée au hasard, puis gardée tant que la question dure). */
  function questionPartic(e, zone) {
    const Q = S.q;
    Q.pk = Q.pk || shuffle(particKinds(e, S.modalite !== "partic"))[0];
    if (Q.pk === "cas") return questionCas(e, zone);
    const fb = el("div", { "aria-live": "polite" });
    let consigne, prompt, champLabel, attendu, complet, expl, accepte;
    if (Q.pk === "participe") {
      const aux = e.auxiliaire || "hat", alt = e.auxiliaireAlt;
      attendu = aux + " " + e.participe; complet = attendu;
      accepte = v => { const w = v.toLowerCase(); return w === attendu.toLowerCase() || (!!alt && w === (alt + " " + e.participe).toLowerCase()); };
      consigne = "Écris l'auxiliaire et le participe passé"; champLabel = "Le participe passé (hat … / ist …)";
      prompt = [de(e.de), " ", audioBtn(e.de)];
      expl = `${attendu}.` + (alt ? ` (« ${alt} ${e.participe} » est aussi possible.)` : "") + (e.auxiliaire === "ist" ? " Ce verbe se conjugue avec « sein »." : "");
    } else {
      const fem = Q.pk === "femAdj";
      Q.pctx = Q.pctx || (() => {
        const pool = B.entrees.filter(x => estNom(x) && x.lot <= (E.lot || 99) && /^[A-ZÄÖÜ][\p{L}]+$/u.test(x.de) && !x.plurielSeul && (fem ? x.art === "die" : aPluriel(x)));
        const nom = shuffle(pool)[0]; return nom ? { nom: nom.de, pl: nom.art && aPluriel(nom) ? plEff(nom) : null } : null;
      })();
      const n = Q.pctx; attendu = fem ? e.feminin : e.pluralAdj;
      const nomTxt = n ? (fem ? n.nom : n.pl) : (fem ? "Stadt" : "Häuser");
      consigne = fem ? "Écris l'adjectif au féminin" : "Écris l'adjectif au pluriel";
      prompt = [el("span", { lang: "de" }, fem ? "Das ist eine ▢▢▢ " : "Das sind die ▢▢▢ "), el("b", { lang: "de" }, "(" + e.de + ")"), el("span", { lang: "de" }, " " + nomTxt + ".")];
      champLabel = fem ? "L'adjectif devant « eine … »" : "L'adjectif devant « die … »";
      complet = (fem ? "Das ist eine " : "Das sind die ") + attendu + " " + nomTxt + ".";
      accepte = v => v.toLowerCase() === attendu.toLowerCase();
      expl = `${complet.replace(/\.$/, "")}. ` + (fem ? "Devant un nom féminin, l'adjectif prend -e." : "Après « die » au pluriel, l'adjectif prend -en.");
    }
    Q.pexp = attendu;
    zone.append(el("div", { class: "sub" }, consigne), el("div", { class: "prompt" }, ...prompt), el("div", { class: "sub" }, frs(e)));
    const f = champ(champLabel, "c1"); zone.append(f.w, clavier());
    const valider = () => {
      if (f.i.disabled) return; f.i.disabled = true;
      const v = norm(f.i.value), ok = accepte(v);
      let aide = "";
      if (!ok) {
        const att = norm(attendu).toLowerCase(), w = v.toLowerCase();
        if (Q.pk === "participe" && w === (e.participe || "").toLowerCase()) aide = " N'oublie pas l'auxiliaire (hat ou ist).";
        else if (Q.pk === "participe" && w.replace(/^(hat|ist) /, "") === att.replace(/^(hat|ist) /, "")) aide = " Attention à l'auxiliaire : hat ou ist ?";
        else if (sansUmlaut(w) === sansUmlaut(att) && w !== att) aide = " Regarde l'Umlaut (ä, ö, ü).";
        else if (Q.pk !== "participe") aide = " Regarde la terminaison.";
      }
      f.i.classList.add(ok ? "ok" : "try");
      repondre(e, "partic", ok, attendu, v, expl + aide, fb);
      parler(complet);
    };
    f.i.addEventListener("keydown", ev => { if (ev.key === "Enter") valider(); });
    zone.append(el("button", { class: "big", type: "button", onclick: valider }, "Valider"), fb);
    setTimeout(() => f.i.focus(), 50);
  }
  function questionCas(e, zone) {
    const Q = S.q; Q.cas = Q.cas || genererCas(e); const C = Q.cas;
    zone.append(el("div", { class: "sub" }, "Quel est le genre du mot caché ?"), el("div", { class: "prompt", lang: "de" }, C.phrase),
      el("div", { class: "sub" }, "Réfléchis au verbe et à la forme de l'article."));
    const fb = el("div", { "aria-live": "polite" }), opts = el("div", { class: "opts" });
    const boutons = ["der", "die", "das"].map(g => el("button", { class: "opt", type: "button", onclick: () => {
      boutons.forEach(b => b.disabled = true);
      const ok = GENRE_NOM[g] === C.bon;
      boutons.forEach(b => { if (b.textContent === C.bon) b.classList.add("good"); });
      if (!ok) boutons.find(b => b.textContent === GENRE_NOM[g]).classList.add("try");
      repondre(e, "partic", ok, C.bon, GENRE_NOM[g], C.regle + " Par exemple : " + C.complet, fb);
      parler(C.complet);
    } }, GENRE_NOM[g]));
    boutons.forEach(b => opts.append(b));
    zone.append(opts, fb);
    if (e.grammaire) zone.append(el("div", { class: "small", style: "margin-top:8px" }, el("a", { href: e.grammaire, target: "_blank", rel: "noopener" }, "Exercice de grammaire sur le datif et l'accusatif")));
  }

  /* ---------- saisie du mot (validation « su ») ---------- */
  const eszettSS = () => !(P && P.orthographe && P.orthographe.eszettAccepteCommeSS === false);
  const norm = s => { s = s.trim().replace(/\s+/g, " "); return eszettSS() ? s.replace(/ß/g, "ss") : s; };
  let champActif = null;
  function clavier() {
    const lettres = (P.orthographe && P.orthographe.boutonsClavier) || ["ä", "ö", "ü", "ß"];
    let maj = false;
    const forme = c => (maj && c !== "ß") ? c.toUpperCase() : c;
    const btns = lettres.map(c => el("button", { type: "button", "aria-label": c, onmousedown: ev => ev.preventDefault(), onclick: ev => {
      const i = champActif; if (!i) return; const ch = forme(c), a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a;
      i.value = i.value.slice(0, a) + ch + i.value.slice(b); i.focus(); i.setSelectionRange(a + 1, a + 1);
    } }, c));
    const maj_ = el("button", { type: "button", title: "Majuscules", "aria-label": "Majuscules", "aria-pressed": "false", onmousedown: ev => ev.preventDefault(), onclick: () => {
      maj = !maj; maj_.setAttribute("aria-pressed", String(maj)); maj_.classList.toggle("on", maj);
      btns.forEach((b, k) => { b.textContent = forme(lettres[k]); b.setAttribute("aria-label", forme(lettres[k])); });
    } }, "⇧");
    return el("div", { class: "kb" }, btns, maj_);
  }
  function champ(label, id) {
    const i = el("input", { id, type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", lang: "de", onfocus: ev => champActif = ev.target });
    return { i, w: el("label", { class: "field" }, label, i) };
  }
  const PRONOM = /^(er|sie|es) /;
  function attenduSaisie(e) {
    const mot = estNom(e) ? e.art + " " + e.de : e.de;
    let variante = null, lab = null;
    if (aPluriel(e)) { variante = plEff(e); lab = "Le pluriel (die …)"; }
    else if (e.pos === "verbe" && e.er) { variante = e.er; const pr = e.er.split(" ")[0]; lab = /^(er|sie|es)$/.test(pr) ? `La forme avec « ${pr} »` + (pr === "er" ? " (il/elle)" : "") : "La forme conjuguée"; }
    return { mot, variante, lab };
  }
  function varianteJuste(e, v2, variante) {
    const att = norm(variante), queue = att.replace(PRONOM, "");
    if (v2 === att || v2 === "die " + att) return true;
    if (e.pos === "verbe") return v2 === queue || (PRONOM.test(v2) && v2.replace(PRONOM, "") === queue);
    return false;
  }
  function questionSaisie(e, zone) {
    const a = attenduSaisie(e);
    zone.append(el("div", { class: "sub" }, "Écris le mot en allemand" + (estNom(e) ? ", avec son article" : "")), el("div", { class: "prompt" }, frs(e)));
    const f1 = champ("Le mot", "c1"); zone.append(f1.w);
    const f2 = a.variante ? champ(a.lab, "c2") : null; if (f2) zone.append(f2.w);
    const fb = el("div", { "aria-live": "polite" });
    const valider = () => {
      if (f1.i.disabled) return;
      const v1 = norm(f1.i.value), ok1 = v1 === norm(a.mot);
      let ok2 = true, v2 = "";
      if (f2) { v2 = norm(f2.i.value); ok2 = varianteJuste(e, v2, a.variante); }
      f1.i.disabled = true; if (f2) f2.i.disabled = true;
      let diag = null;
      if (!ok1) {
        const att = norm(a.mot);
        if (v1.toLowerCase() === att.toLowerCase()) {
          const nom_ = estNom(e) ? v1.split(" ").slice(1).join(" ") : v1;
          diag = estNom(e) && nom_ && nom_[0] === nom_[0].toLowerCase() ? "majuscule" : "majuscules";
        } else diag = (estNom(e) && v1.split(" ")[0] !== e.art && v1.split(" ").slice(1).join(" ") === e.de) ? "article" : "orthographe";
      } else if (!ok2) diag = "variante";
      noterSaisie(e, !diag, diag, fb, a, v1, v2);
    };
    const bouton = el("button", { class: "big", type: "button", onclick: valider }, "Valider");
    [f1.i, f2 && f2.i].filter(Boolean).forEach(i => i.addEventListener("keydown", ev => { if (ev.key === "Enter") valider(); }));
    zone.append(clavier(), bouton, fb);
    setTimeout(() => f1.i.focus(), 50);
    /* pas d'audio ici : entendre le mot avant de l'écrire serait une dictée. La lecture vient après la validation. */
  }
  function noterSaisie(e, ok, diag, fb, a, v1, v2, aideTexte) {
    const ph = e.type === "phrase";
    const s = st(e.id), r = R(), etr = !!(S.q && S.q.etranger);
    E.q++; s.dq = E.q; s.vus++; s.dern = "saisie"; s.essais++; S.questions++;
    let msg, gain = 0;
    if (ok) {
      S.bonnes++; S.serie++; s.echecsSuite = 0; gain = crediter("saisie");
      if (s.essais === 1) s.premier = true;
      s.reussites.push({ seance: S.id, q: E.q, etr });
      const deja = s.etat === "su";
      if (s.essais === 1 && etr) { s.etat = "su"; if (!deja) S.su.push(e.id); msg = (ph ? "Phrase sue" : "Mot su") + ", du premier coup !"; }
      else if (s.reussites.length >= r.reussitesPourSu && s.reussites.some(x => x.etr)) { s.etat = "su"; if (!deja) S.su.push(e.id); msg = (ph ? "Phrase sue" : "Mot su") + ", bravo !"; }
      else if (deja) msg = "Toujours bien su !";
      else { s.etat = "aConfirmer"; msg = etr ? "Très bien ! On le retrouvera une dernière fois pour bien le fixer." : "Juste ! On le retrouvera plus tard, quand tu ne l'auras plus sous les yeux."; }
      if (s.etat === "su" && !deja) {
        S.score += SC().motSu; gain += SC().motSu;
        s.audioAFaire = !ph && e.niveauLivre !== "connu" && !(s.val && s.val.phon);     // la saisie ne teste pas l'oreille : la reconnaissance audio reste à faire
        if (s.audioAFaire && e.niveauLivre !== "connu" && domApplicable(e, "phon")) msg += " Il te reste à reconnaître ce mot à l'oreille.";
      }
    } else {
      S.serie = 0; s.etat = s.etat === "su" ? "su" : "enCours"; if (s.essais === 1) s.premier = false;
      s.echecsSuite++; S.erreurs.push({ id: e.id, act: "saisie", donne: (v1 + (v2 ? " / " + v2 : "")).trim(), attendu: a.mot + (a.variante ? " / " + a.variante : "") });
      const aide = { phrase: "", majuscule: "Les noms prennent une majuscule.", majuscules: "Regardons les majuscules et les minuscules.", article: "Regardons l'article de ce nom.", orthographe: "Regardons l'écriture du mot.", variante: "Regardons la forme demandée." }[diag];
      msg = `On le retient ensemble : ${a.mot}${a.variante ? " — " + a.variante : ""}. ${aideTexte || aide[diag] || ""}`;
      if (s.echecsSuite >= r.echecsAvantRenvoi) {
        const act = ph ? "mot" : diag === "article" ? "article" : diag === "variante" ? (aPluriel(e) ? "pluriel" : "recopier") : "recopier";
        S.force.push({ id: e.id, act }, { id: e.id, act: "saisie" }); s.echecsSuite = 0; msg += " Prenons un petit détour pour fixer ça, puis on réessaie.";
      }
    }
    noterSerie(ok);
    majScore(); sauver(); sauverPartie(false);
    fb.replaceChildren(el("div", { class: "fb " + (ok ? "ok" : "try") }, msg, ok ? el("span", { class: "gain" }, " +" + gain) : null,
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "soft", id: "suite", type: "button", onclick: apresReponse }, "Suite →"))));
    $("#suite").focus();
    parler(lib(e));                      // lecture du mot après la validation, juste ou non
    S.auto = ok ? setTimeout(apresReponse, 1300) : null;
  }
  function questionTrous(c, zone) {
    const ex = c.trous.ex, banque = shuffle(ex.mots.map(m => byId[m]).filter(Boolean).map(lib));
    zone.append(el("div", { class: "sub" }, "Complète le texte et les phrases avec les mots de la liste"), el("div", { class: "prompt", style: "font-size:1.1em" }, ex.titre));
    if (banque.length) zone.append(el("div", { class: "row small", style: "margin:4px 0" }, banque.map(m => el("span", { class: "chip", lang: "de" }, m))));
    const champs = [];
    ex.items.forEach((item, k) => {
      if (k === 0 || (k === 1 && ex.items[0].texte)) zone.append(el("h3", { style: "margin:14px 0 2px" }, item.texte ? "Le texte" : "Les phrases"));
      const ligne = el("div", { class: "tl", lang: "de" }), mes = [];
      item.de.split(/\{(\d+)\}/).forEach((t, j) => {
        if (j % 2 === 0) { ligne.append(t); return; }
        const trou = item.trous.find(x => x.n === Number(t));
        const inp = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", lang: "de", size: Math.max(3, trou.reponse.length), "aria-label": "Mot à écrire " + (champs.length + 1), onfocus: ev => champActif = ev.target });
        const c1 = { inp, trou, item }; champs.push(c1); mes.push(c1); ligne.append(inp);
      });
      const fr = el("div", { class: "sub" }, item.fr);
      zone.append(ligne);
      if (item.traduction === "affichee") zone.append(fr);
      else { fr.hidden = true; zone.append(el("button", { class: "soft", type: "button", onclick: ev => { fr.hidden = false; ev.target.remove(); } }, "Voir la traduction"), fr); }
    });
    const fb = el("div", { "aria-live": "polite" });
    const complet = item => item.de.replace(/\{(\d+)\}/g, (_, n) => item.trous.find(t => t.n === Number(n)).reponse);
    const valider = () => {
      if (champs[0].inp.disabled) return;
      champs.forEach(x => x.inp.disabled = true);
      E.q++; S.questions += champs.length;
      let gain = 0;
      champs.forEach(x => {
        x.ok = norm(x.inp.value) === norm(x.trou.reponse); x.inp.classList.add(x.ok ? "ok" : "try");
        const m = byId[x.trou.mot]; S.sq++;
        if (m) { const s = st(m.id); s.vus++; s.dq = E.q; S.recent.push(m.id); }
        if (x.ok) { S.bonnes++; S.sb++; S.serie++; gain += crediter("qcm"); }
        else { S.serie = 0; S.erreurs.push({ id: x.trou.mot, act: "trous", donne: norm(x.inp.value), attendu: x.trou.reponse }); }
      });
      S.recent = S.recent.slice(-12); S.q.repondu = true;
      const nb = champs.filter(x => x.ok).length, rates = champs.filter(x => !x.ok);
      const casse = rates.some(x => norm(x.inp.value).toLowerCase() === norm(x.trou.reponse).toLowerCase());
      const aCorriger = [...new Set(rates.map(x => x.item))];
      majScore(); sauver(); sauverPartie(false);
      fb.replaceChildren(el("div", { class: "fb " + (rates.length ? "try" : "ok") },
        rates.length ? nb + " mot" + (nb > 1 ? "s" : "") + " sur " + champs.length + ". On retient ensemble :" : "Très bien ! Tout est juste. ",
        aCorriger.map(it => el("div", { lang: "de", style: "margin-top:4px" }, el("b", {}, complet(it)))),
        casse ? el("div", {}, "Les noms prennent une majuscule.") : null, gain ? el("span", { class: "gain" }, "+" + gain) : null,
        el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "soft", id: "suite", type: "button", onclick: apresReponse }, "Suite →"))));
      $("#suite").focus();
      const t0 = ex.items[0]; if (t0 && t0.texte) parler(complet(t0));
    };
    champs.forEach((x, k) => x.inp.addEventListener("keydown", ev => { if (ev.key === "Enter") { if (k + 1 < champs.length) champs[k + 1].inp.focus(); else valider(); } }));
    zone.append(clavier(), el("button", { class: "big", type: "button", onclick: valider }, "Valider"), fb);
    setTimeout(() => champs[0].inp.focus(), 50);
  }
  /* Saisie d'une phrase longue : on n'écrit que les points difficiles (pointsDifficiles), le reste de la phrase est affiché. */
  function questionSaisiePhrase(e, zone) {
    const toks = e.de.split(/\s+/), nets = toks.map(t => t.replace(/^[¿¡"«]+|[.,;:!?»"]+$/g, ""));
    const couvert = toks.map(() => false), trous = [];
    (e.pointsDifficiles || []).forEach(p => p.mot.split("…").map(x => x.trim()).filter(Boolean).forEach(part => {
      const t = part.split(/\s+/);
      for (let i = 0; i + t.length <= toks.length; i++) {
        if (t.every((x, k) => nets[i + k] === x && !couvert[i + k])) { for (let k = 0; k < t.length; k++) couvert[i + k] = true; trous.push({ i, n: t.length, att: t.join(" "), p }); break; }
      }
    }));
    if (!trous.length) trous.push({ i: 0, n: toks.length, att: nets.join(" "), p: null });   // repli : toute la phrase
    trous.sort((x, y) => x.i - y.i);
    zone.append(el("div", { class: "sub" }, "Complète la phrase en allemand"), el("div", { class: "prompt" }, frs(e)));
    const ligne = el("div", { class: "phr", lang: "de" }), champs = [];
    for (let i = 0; i < toks.length; i++) {
      const t = trous.find(x => x.i === i);
      if (!t) { ligne.append(toks[i] + " "); continue; }
      const pre = (/^[¿¡"«]*/.exec(toks[i]) || [""])[0], post = (/[.,;:!?»"]*$/.exec(toks[i + t.n - 1]) || [""])[0];
      const inp = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", lang: "de", size: Math.max(3, t.att.length), "aria-label": "Mot à écrire " + (champs.length + 1), onfocus: ev => champActif = ev.target });
      champs.push({ inp, t });
      ligne.append(pre, inp, post + " "); i += t.n - 1;
    }
    zone.append(ligne);
    const fb = el("div", { "aria-live": "polite" });
    const valider = () => {
      if (champs[0].inp.disabled) return;
      champs.forEach(c => c.inp.disabled = true);
      const ratees = champs.filter(c => norm(c.inp.value) !== norm(c.t.att));
      const aide = ratees.map(c => c.t.p ? c.t.p.expl : "").filter(Boolean).join(" ");
      noterSaisie(e, !ratees.length, ratees.length ? "phrase" : null, fb, { mot: e.de, variante: null }, champs.map(c => norm(c.inp.value)).join(" / "), "", aide);
    };
    champs.forEach(c => c.inp.addEventListener("keydown", ev => { if (ev.key === "Enter") valider(); }));
    zone.append(clavier(), el("button", { class: "big", type: "button", onclick: valider }, "Valider"), fb);
    setTimeout(() => champs[0].inp.focus(), 50);
  }
  function questionRecopier(e, zone) {
    zone.append(el("div", { class: "sub" }, "Recopie le mot, doucement"), el("div", { class: "prompt" }, de(lib(e)), " ", audioBtn(lib(e))), el("div", { class: "sub" }, frs(e)));
    const f = champ("Ton écriture", "c1"); zone.append(f.w, clavier());
    const fb = el("div", { "aria-live": "polite" });
    const valider = () => {
      if (f.i.disabled) return; f.i.disabled = true;
      const ok = norm(f.i.value) === norm(lib(e));
      const s = st(e.id); E.q++; s.dq = E.q; s.vus++; S.questions++;
      let gain = 0; if (ok) { S.bonnes++; S.serie++; gain = crediter("recopier"); } else S.serie = 0;
      noterSerie(ok); majScore(); sauver(); sauverPartie(false);
      fb.replaceChildren(el("div", { class: "fb " + (ok ? "ok" : "try") }, ok ? "Bien écrit !" : `Presque : ${lib(e)}. Regarde chaque lettre.`, ok ? el("span", { class: "gain" }, " +" + gain) : null,
        el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "soft", id: "suite", type: "button", onclick: apresReponse }, "Suite →"))));
      $("#suite").focus(); S.auto = ok ? setTimeout(apresReponse, 1100) : null;
    };
    f.i.addEventListener("keydown", ev => { if (ev.key === "Enter") valider(); });
    zone.append(el("button", { class: "big", type: "button", onclick: valider }, "Valider"), fb);
    setTimeout(() => f.i.focus(), 50);
  }

  /* ---------- fin de séance ---------- */
  function terminer(message, lotFini) {
    if (!S || S.fini) return;
    S.fini = true; clearInterval(S.timer); if (S.auto) clearTimeout(S.auto);
    if (E.parties) delete E.parties[clePartie(S.mode, S.modalite0)];
    if (S.questions === 0) {      // rien n'a été travaillé : pas de bilan, pas de séance enregistrée
      sauver();
      return vue(el("div", { class: "card center" }, el("h2", {}, lotFini ? "Lot terminé !" : "Pour l'instant, c'est tout"),
        el("p", {}, message || "Il n'y a pas encore de mot à travailler."),
        el("button", { class: "big", onclick: accueil }, "Retour à l'accueil")));
    }
    enregistrer();
    E.records = E.records || {};
    const ancien = E.records[S.mode] || 0, record = S.score > ancien && ancien > 0;
    E.records[S.mode] = Math.max(ancien, S.score); sauver();
    const aRetrouver = [...new Set(S.erreurs.map(x => x.id))].map(i => lib(byId[i]));
    vue(el("div", { class: "card center" }, el("h2", {}, "Belle séance !"),
      el("p", { class: "prompt", style: "margin:0" }, "★ " + S.score),
      record ? el("p", { style: "color:var(--ok);font-weight:600" }, "Nouveau record personnel !") : el("p", { class: "mute small" }, "Ton meilleur score : " + E.records[S.mode]),
      el("p", {}, `${S.bonnes} réponse${S.bonnes > 1 ? "s" : ""} juste${S.bonnes > 1 ? "s" : ""} sur ${S.questions}.`),
      S.su.length ? el("p", { class: "ok", style: "color:var(--ok)" }, "Mots sus aujourd'hui : " + S.su.map(i => lib(byId[i])).join(", ")) : null,
      aRetrouver.length ? el("p", { class: "mute small" }, "À retrouver au prochain tour : " + aRetrouver.join(", ")) : null,
      message ? el("p", {}, message) : null,
      el("button", { class: "big", onclick: accueil }, "Retour à l'accueil")));
  }

  /* ---------- écrans ---------- */
  function vueProfil() {
    abandonnerSeance();
    const l = profils();
    const i = el("input", { type: "text", placeholder: "Ton prénom", "aria-label": "Ton prénom", style: "font-size:1.1em;padding:8px 12px;border:2px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink)" });
    const ajouter = () => {
      const n = i.value.trim(); if (!n) return;
      const t = profils(), deja = t.find(x => x.toLowerCase() === n.toLowerCase());
      if (deja) return entrer(deja);
      t.push(n); ls.set("profils", t); entrer(n);
    };
    i.addEventListener("keydown", ev => { if (ev.key === "Enter") ajouter(); });
    vue(el("div", { class: "card center" }, el("h2", {}, "Qui travaille ?"),
      el("div", { class: "row" }, l.map(n => el("button", { class: "soft", onclick: () => entrer(n) }, n))),
      el("p", { class: "mute small" }, l.length ? "ou un nouvel élève :" : "Écris ton prénom :"), el("div", { class: "row" }, i, el("button", { class: "soft", onclick: ajouter }, "Commencer"))));
  }
  function entrer(n) { chargerEtat(n); if (E.lot == null) vueLot(true); else accueil(); }
  function vueLot(premier) {
    abandonnerSeance();
    const sel = E.lot ?? P.lotActif;
    vue(el("div", { class: "card center" }, el("h2", {}, premier ? "Où en es-tu ?" : "Changer de lot"),
      el("p", { class: "mute" }, "Choisis le lot que tu travailles en ce moment. Tu pourras le changer quand tu veux."),
      el("div", { class: "row", style: "flex-direction:column;align-items:stretch" }, lots().map(l => el("button", { class: "soft" + (l === sel ? " on" : ""), onclick: () => { E.lot = l; sauver(); accueil(); } },
        "Lot " + l + " · " + titreLot(l) + (l === P.lotActif ? "  (proposé par ton enseignant)" : ""))))));
  }
  function accueil() {
    abandonnerSeance(); S = null;
    const f = file(), su = nbSu(), w = fenetre();
    $("#outils").replaceChildren(
      el("button", { class: "ib", title: "Réduire la taille des caractères", "aria-label": "Réduire la taille des caractères", onclick: () => { E.reglages.fs = Math.max(13, E.reglages.fs - 2); appliquerTaille(); sauver(); } }, "A−"),
      el("button", { class: "ib", title: "Augmenter la taille des caractères", "aria-label": "Augmenter la taille des caractères", onclick: () => { E.reglages.fs = Math.min(28, E.reglages.fs + 2); appliquerTaille(); sauver(); } }, "A+"),
      " ", el("button", { class: "ib", title: "Réglages", "aria-label": "Réglages", onclick: parametres }, "⚙"));
    const act = (k, n, aide) => !dispoAct(k) ? el("button", { class: "soft off" + classeAct(k), type: "button", disabled: "", "aria-disabled": "true", title: "Grisé : " + raisonGris(k) + "." }, n) : el("button", { class: "soft" + classeAct(k), title: aide || "", onclick: () => { E.reglages.modalite = k; sauver(); nouvelleSeance("7min", k); } }, n);
    const bientot = n => el("button", { class: "soft off", disabled: "", "aria-disabled": "true" }, n + " (bientôt)");
    const section = (titre, note, ...btns) => el("div", { class: "card" }, el("h3", {}, titre), note ? el("div", { class: "small mute", style: "margin-bottom:6px" }, note) : null, el("div", { class: "row" }, btns));
    const inv = invitations().map(i => el("div", { class: "card inv", role: "status" }, el("div", {}, i.texte),
      el("div", { class: "row", style: "margin-top:8px" },
        el("button", { class: "soft on", onclick: () => { E.invit[i.cle] = 0; sauver(); nouvelleSeance("7min", i.modalite); } }, "On y va"),
        el("button", { class: "soft", onclick: () => { E.invit[i.cle] = i.n + SEUIL_INV(); sauver(); accueil(); } }, "Plus tard"))));
    const NOMS = { pieges: "Pièges d'orthographe", syllabe: "Syllabe difficile", lettres: "Lettres difficiles", composes: "Mots composés", dictee: "Dictée", variantes: "Variantes du mot", son: "Reconnaissance audio" };
    const grisAppro = Object.keys(NOMS).filter(k => !dispoAct(k)).map(k => " " + NOMS[k] + " : " + raisonGris(k) + ".").join("");
    const fen = fenetre();
    const choixP = new Set(particSel());
    const caseP = PARTIC.map(P => {
      const n = fen.filter(P.ok).length;
      const cb = el("input", { type: "checkbox", id: "pc-" + P.id, ...(n ? {} : { disabled: "" }), onchange: () => { n && (cb.checked ? choixP.add(P.id) : choixP.delete(P.id)); E.reglages.partic = [...choixP]; sauver(); majBtn(); } });
      cb.checked = n ? choixP.has(P.id) : false;
      return el("label", { style: "display:flex;align-items:center;gap:8px;padding:5px 0;" + (n ? "" : "opacity:.55") }, cb, " " + P.nom, n ? el("span", { class: "mute small" }, " (" + n + ")") : el("span", { class: "mute small" }, " — aucun mot concerné"));
    });
    const btnP = el("button", { class: "soft on" + classeAct("partic"), type: "button", id: "partic-go", onclick: () => { E.reglages.partic = PARTIC.filter(P => fen.some(P.ok) && choixP.has(P.id)).map(P => P.id); E.reglages.modalite = "partic"; sauver(); nouvelleSeance("7min", "partic"); } }, "Commencer");
    const majBtn = () => { btnP.disabled = !PARTIC.some(P => fen.some(P.ok) && choixP.has(P.id)); };
    majBtn();
    const cartePartic = el("div", { class: "card", id: "particularites" }, el("h3", {}, "Particularités des mots"),
      el("div", { class: "small mute", style: "margin-bottom:6px" }, "Coche ce que tu veux travailler avec les mots du moment :"), ...caseP, el("div", { class: "row", style: "margin-top:6px" }, btnP));
    vue(el("div", { class: "card center" },
      el("h2", {}, "Bonjour " + nom + " !"),
      el("div", { class: "mute" }, "Lot " + E.lot + " · " + titreLot(E.lot)),
      seuilLot(E.lot) < 4 ? el("div", { class: "small mute" }, NIV_NOM[seuilLot(E.lot)]) : null,
      el("div", { class: "bar" }, el("i", { style: "width:" + (f.length ? Math.round(100 * su / f.length) : 0) + "%" })),
      el("div", { class: "small mute" }, su + " mot" + (su > 1 ? "s" : "") + " su" + (su > 1 ? "s" : "") + " sur " + f.length),
      el("button", { class: "big", onclick: () => nouvelleSeance("7min", "auto") }, "Continuer · " + P.modesApprentissage.minutes + " minutes"),
      el("button", { class: "soft", onclick: () => nouvelleSeance("challenge", "auto") }, "Le défi des " + P.modesApprentissage.challengeReponsesDAffilee)),
      ...(depuisCache ? [el("div", { class: "card small mute", role: "note" }, "Ces données sont une copie mémorisée dans ce navigateur (banque construite le " + ((B.meta && B.meta.construit) || "? : version ancienne") + "). Si les fichiers ont changé : ⚙ Paramètres → « Recharger les fichiers ».")] : []),
      ...inv,
      el("div", { class: "small mute legende", role: "note" },
        el("span", {}, el("i", { class: "g-dec" }), "Découverte"), el("span", {}, el("i", { class: "g-ort" }), "Orthographe"), el("span", {}, el("i", { class: "g-lex" }), "Formes du mot"), el("span", {}, el("i", { class: "g-pho" }), "Oreille"), el("span", {}, el("i", { class: "g-val" }), "Valider"),
        el("span", { style: "flex-basis:100%;text-align:center" }, "Foncé : nécessaire pour valider le mot · clair : facultatif")),
      section("Découverte", "Comprendre et reconnaître les mots.", act("sens", "Comment dit-on en français ?"), act("mot", "Quel est le bon mot ?"), act("pluriel", "Pluriel"), act("article", "Der, Die ou Das ?"), exosTrous().length ? act("trous", "Texte et phrases à trous") : bientot("Texte et phrases à trous (pas pour ce lot)")),
      ...(anciensMots().length ? [section("Coup de pouce", "Des mots des lots précédents n'ont pas encore trouvé leur place : on les reprend sans pression.", el("button", { class: "soft on", id: "coup-de-pouce", onclick: () => nouvelleSeance("7min", "auto", false, true) }, "Coup de pouce sur les anciens mots (" + anciensMots().length + ")"))] : []),
      section("Approfondissement", "Fixer l'écriture, les formes et le son." + grisAppro, act("pieges", "Pièges d'orthographe"), act("syllabe", "Syllabe difficile"), act("lettres", "Lettres difficiles"), act("composes", "Mots composés"), act("dictee", "Dictée"), act("variantes", "Variantes du mot"), act("son", "Reconnaissance audio")),
      cartePartic,
      section("Valider un mot", "Écrire le mot en allemand, quand tu te sens prêt.", act("preparer", "Préparer la validation"), act("saisie", "Écrire le mot")),
      el("div", { class: "card" }, el("div", { class: "small mute", style: "text-align:center;margin-bottom:4px" }, "Les mots du moment"),
        el("div", { class: "row" }, w.map(e => el("span", { class: "chip s-" + st(e.id).etat, lang: "de", "aria-label": lib(e) + (reconnuF(e) ? ", reconnu" : "") + (st(e.id).val && st(e.id).val.ortho ? ", orthographe validée" : "") }, lib(e),
          reconnuF(e) ? el("sup", { class: "pas" }, " D") : null, (st(e.id).val && st(e.id).val.ortho) ? el("sup", { class: "pas" }, " O") : null, (st(e.id).val && st(e.id).val.lex) ? el("sup", { class: "pas" }, " L") : null, (st(e.id).val && st(e.id).val.phon) ? el("sup", { class: "pas" }, " P") : null))),
        el("div", { class: "small mute", style: "text-align:center;margin-top:6px" }, "D : découverte faite · O : orthographe validée · L : formes validées · P : reconnu à l'oreille"),
        aConfirmer().length ? el("div", { class: "small mute", style: "text-align:center;margin-top:6px" }, "À retrouver bientôt : " + aConfirmer().map(lib).join(", ")) : null));
  }
  /* Invitations à passer à la section suivante : positives, jamais bloquantes ; « Plus tard » repousse jusqu'à N nouveaux mots prêts. */
  function invitations() {
    const w = fenetre(), seuil = SEUIL_INV(), inv = E.invit = E.invit || { approf: 0, valid: 0 }, out = [];
    const nR = rappel().length;
    if (nR >= Math.max(1, inv.rappel || 0)) out.push({ cle: "rappel", n: nR, texte: nR + " mot" + (nR > 1 ? "s" : "") + " que tu connais déjà " + (nR > 1 ? "sont" : "est") + " à rappeler. On y va ?", modalite: "preparer" });
    const nA = w.filter(e => reconnuF(e) && !domainesFaits(e)).length;
    if (nA >= Math.max(seuil, inv.approf || 0)) out.push({ cle: "approf", n: nA, texte: nA + " mots de ta liste sont reconnus. On les approfondit ?", modalite: "pieges" });
    const nV = w.filter(e => reconnuF(e) && domainesFaits(e)).length;
    if (nV >= Math.max(seuil, inv.valid || 0)) out.push({ cle: "valid", n: nV, texte: nV + " mots sont prêts pour la validation. On s'y prépare ?", modalite: "preparer" });
    return out;
  }
  function parametres() {
    const d = el("dialog", { "aria-label": "Paramètres" });
    const nj = (P.historiqueSessions && P.historiqueSessions.joursAffiches) || 3;
    const jours = Array.from({ length: nj }, (_, n) => { const t = new Date(); t.setDate(t.getDate() - n); return { n, d: ymd(t) }; });
    const nomJour = n => n === 0 ? "Aujourd'hui" : n === 1 ? "Hier" : n === 2 ? "Avant-hier" : "Il y a " + n + " jours";
    const hist = jours.map(j => {
      const ss = E.seances.filter(s => s.date === j.d), sept = ss.filter(s => s.mode === "7min" && s.complete !== false);
      return el("details", {}, el("summary", {}, `${nomJour(j.n)} : ${sept.length} séance${sept.length > 1 ? "s" : ""} de ${P.modesApprentissage.minutes} minutes`),
        ss.length ? ss.map(s => el("div", { class: "small", style: "margin:6px 0" },
          el("b", {}, new Date(s.t0).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }) + " · " + (s.mode === "7min" ? (s.complete === false ? "séance courte" : "séance") : "défi") + " · ★ " + (s.score ?? 0) + " · " + s.bonnes + "/" + s.q),
          s.erreurs.length ? el("ul", { style: "margin:2px 0" }, s.erreurs.map(x => el("li", {}, `${lib(byId[x.id] || { de: x.id })} (${x.act}) : ${x.donne || "—"} → ${x.attendu}`))) : el("div", { class: "mute" }, "Aucune difficulté, bravo !"))) : el("div", { class: "mute small" }, "Pas de séance."));
    });
    d.append(el("div", { class: "pad" }, el("h2", {}, "Paramètres"),
      el("div", {}, el("b", {}, "Mon travail"), hist),
      Object.keys(E.parties || {}).length ? el("div", { class: "small" }, el("b", {}, "Parties en pause : "), Object.values(E.parties).map(p => (p.mode === "7min" ? "7 minutes" : "défi") + " (★ " + p.score + ")").join(", "), " — elles se reprennent depuis l'accueil.") : null,
      E.records && Object.keys(E.records).length ? el("div", { class: "small" }, el("b", {}, "Mes meilleurs scores : "), Object.entries(E.records).map(([m, v]) => (m === "7min" ? "7 minutes" : "défi") + " ★ " + v).join(" · ")) : null,
      el("div", {}, el("b", {}, "Mots du lot à apprendre"),
        el("div", { class: "small mute" }, "Ce choix ne concerne que le lot " + E.lot + " et reste mémorisé sur cet appareil."),
        el("select", { "aria-label": "Mots du lot à apprendre", onchange: ev => { const m = ls.get("seuilsLot", {}); m[E.lot] = Number(ev.target.value); ls.set("seuilsLot", m); toast("Choix enregistré."); d.close(); accueil(); } },
          [1, 2, 3, 4].map(n => {
            const nb = B.entrees.filter(x => (x.type === "mot" || (x.type === "phrase" && x.qcm)) && x.lot === E.lot && x.niveauLivre !== "connu" && (x.niveauPriorite == null || x.niveauPriorite <= n || x.priorite === "haute")).length;
            return el("option", { value: n, ...(seuilLot(E.lot) === n ? { selected: "" } : {}) }, NIV_NOM[n] + " (" + nb + ")");
          }))),
      el("div", {}, el("b", {}, "Fichiers du vocabulaire"),
        el("div", { class: "small mute" }, "Moteur du " + VERSION_APP + " · banque construite le " + ((B.meta && B.meta.construit) || "(date inconnue : version ancienne)") + (depuisCache ? " · copie mémorisée dans ce navigateur" : " · lue dans le dossier")),
        el("label", { class: "soft" }, "Recharger les fichiers (banque.json et pilotage.json)", el("input", { type: "file", accept: ".json", multiple: "", hidden: "", onchange: async ev => {
          const { b, p } = await lireFichiers(ev.target.files); if (!b && !p) return;
          ls.set("cache", { b: b || B, p: p || P, date: Date.now() }); toast("Fichiers rechargés."); setTimeout(() => location.reload(), 600);
        } }))),
      curseurVitesse(() => parler("Guten Tag")),
      el("label", {}, el("input", { type: "checkbox", ...(E.reglages.voix ? { checked: "" } : {}), onchange: ev => { E.reglages.voix = ev.target.checked; sauver(); } }), " Lire les mots à voix haute"),
      el("div", { class: "row" }, el("button", { class: "soft", onclick: () => { d.close(); vueLot(false); } }, "Changer de lot"),
        el("button", { class: "soft", onclick: () => { d.close(); vueProfil(); } }, "Changer d'élève")),
      el("div", { class: "row" },
        el("button", { class: "soft", onclick: () => telecharger(RACINE + ".progression-" + nom + ".json", E) }, "Exporter ma progression"),
        el("label", { class: "soft" }, "Importer ma progression", el("input", { type: "file", accept: ".json", hidden: "", onchange: async ev => {
          try { const j = JSON.parse(await ev.target.files[0].text()); if (!j || !j.mots) throw 0; fusionner(j); sauver(); toast("Progression importée."); d.close(); accueil(); }
          catch (e) { toast("Ce fichier de progression n'a pas pu être lu."); }
        } }))),
      el("div", { class: "small mute" }, "Fichiers du vocabulaire : version " + (B.meta.version ?? "?") + ". ", el("label", { class: "soft", style: "display:inline-block" }, "Recharger les fichiers", el("input", { type: "file", accept: ".json", multiple: "", hidden: "", onchange: async ev => {
        const { b, p } = await lireFichiers(ev.target.files); if (!b && !p) return; if (b) B = b; if (p) P = p;
        ls.set("cache", { b: B, p: P, date: Date.now() }); indexer(); toast("Fichiers rechargés."); d.close(); accueil();
      } }))),
      el("button", { class: "soft", onclick: () => d.close() }, "Fermer")));
    document.body.append(d); d.addEventListener("close", () => d.remove()); d.showModal();
  }

  /* ---------- démarrage ---------- */
  async function demarrer() {
    indexer();
    window.APP_DEBUG = { son: { sonOk }, rappel, anciensMots, grises, partic: { PARTIC, particKinds, casType }, diag: () => Object.keys(RAISON).concat(["preparer", "saisie"]).map(a => ({ act: a, dispo: dispoAct(a), mots: fenetre().filter(e => applicable(e, a)).map(e => e.de) })).concat([{ voix: !!(E && E.reglages.voix), voixAllemande: voixAllemande(), fenetre: fenetre().map(e => e.de) }]), ortho: { syllabeInfo, lettresInfo, composesOk, majusculeOk, dicteeOk, sequenceComposes, analyseOrtho }, file, regrouperVagues, etat: () => E, seance: () => S, B: () => B, P: () => P, pluriels, options };
    window.addEventListener("pagehide", () => { if (S && !S.fini && E) sauverPartie(true); });
    vueProfil();
  }
  (async function () {
    try { if (AD()) await Promise.race([AD().pret(), new Promise(r => setTimeout(r, 3000))]); } catch (e) { /* rien */ }      // voix prêtes avant le premier écran
    if (await charger()) demarrer(); else vueChargement();
  })();
})();
