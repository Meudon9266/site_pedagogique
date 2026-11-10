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
  function parler(txt) {
    if (!E || !E.reglages.voix || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt); u.lang = "de-DE"; u.rate = 0.9;
      const v = (speechSynthesis.getVoices() || []).find(v => /^de/i.test(v.lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* rien */ }
  }
  const audioBtn = txt => el("button", { class: "audio", type: "button", title: "Écouter", "aria-label": "Écouter", onclick: () => parler(txt) }, "🔊");
  const R = () => Object.assign({ reussitesPourSu: 2, contexteEtrangerElements: 5, echecsAvantRenvoi: 2, espacementMinEntreEssais: 3 }, (P && P.essaisSu) || {});

  /* ---------- données ---------- */
  async function lireJson(url) { const r = await fetch(url); if (!r.ok) throw 0; return r.json(); }
  async function charger() {
    try {
      const [b, p] = await Promise.all([lireJson(RACINE + ".banque.json"), lireJson(RACINE + ".pilotage.json")]);
      B = b; P = p; ls.set("cache", { b, p, date: Date.now() }); return true;
    } catch (e) { /* repli */ }
    const c = ls.get("cache", null);
    if (c) { B = c.b; P = c.p; return true; }
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
  function file() {
    return B.entrees.filter(e => e.type === "mot" && e.lot === E.lot && e.niveauLivre !== "connu")
      .sort((a, b) => vagueUtilisee(a.vague) - vagueUtilisee(b.vague) || (a.rang ?? 99) - (b.rang ?? 99) ||
        (a.niveauLivre === "actif" ? 0 : 1) - (b.niveauLivre === "actif" ? 0 : 1) || a.source.ordre - b.source.ordre);
  }
  const fenetre = () => file().filter(e => ["nouveau", "enCours"].includes(st(e.id).etat)).slice(0, P.tailleFenetre);
  const aConfirmer = () => file().filter(e => st(e.id).etat === "aConfirmer");
  const nbSu = () => file().filter(e => ["su", "reconnu"].includes(st(e.id).etat)).length;

  /* ---------- formes ---------- */
  const estNom = e => e.pos === "nom" && !!e.art;
  /* Pluriel demandé : celui du livre ; si le pilotage le demande, celui que l'IA propose (plPropose) pour les noms sans pluriel dans le livre. */
  const plEff = e => e.pl || ((P && P.pluriel && P.pluriel.absentDuLivre === "demander") ? e.plPropose : null) || null;
  const aPluriel = e => estNom(e) && !!plEff(e);
  /* ---------- domaines d'approfondissement (seul le domaine orthographique est disponible pour l'instant) ---------- */
  const DOMAINES = ["ortho"];
  const ACT_DOM = { ortho: "pieges" };
  const RD = () => Object.assign({ reussiteMin: 0.8, essaisMin: 3, derniersEssais: 5 }, (P && P.domaines) || {});
  const SEUIL_INV = () => (P && P.invitations && P.invitations.seuilMots) || 6;
  const reconnuF = e => { const s = st(e.id); return s.fait.mot >= 1 && (!aPluriel(e) || s.fait.pluriel >= 1); };   // le test « sens » est facultatif
  const domApplicable = (e, d) => d === "ortho" ? (e.distracteurs || []).length >= 2 : false;
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
    E.parties[clePartie(S.mode, S.modalite0)] = { id: S.id, mode: S.mode, modalite: S.modalite, modalite0: S.modalite0, t0: S.t0, questions: S.questions, bonnes: S.bonnes, serie: S.serie, score: S.score,
      erreurs: S.erreurs, su: S.su, force: S.force, recent: S.recent, restant: S.fin ? Math.max(0, S.fin - (S.pause || Date.now())) : null,
      etape: S.etape, precedent: S.precedent, faits: S.faits, reprises: S.reprises, reprisesFaites: S.reprisesFaites, reposent: S.reposent, tours: S.tours, sb: S.sb, sq: S.sq,
      q: avecQuestion && S.q && !S.q.repondu ? { id: S.q.e.id, act: S.q.act, etranger: !!S.q.etranger, serie: !!S.q.serie, rep: !!S.q.rep } : null };
    sauver();
  }
  function demarrerS(mode, modalite, p) {
    const serieVide = { etape: null, precedent: null, faits: [], reprises: [], reprisesFaites: [], reposent: [], tours: {}, sb: 0, sq: 0, pause: null };
    S = p ? Object.assign({}, serieVide, p, { fini: false, auto: null, enregistre: false, timer: null, q: null, pause: null, force: p.force || [] })
          : Object.assign({ id: "s" + Date.now(), mode, t0: Date.now(), questions: 0, bonnes: 0, serie: 0, score: 0, erreurs: [], su: [], force: [], recent: [], modalite, fini: false, q: null, timer: null }, serieVide);
    S.modalite0 = modalite;
    if (!p && modalite !== "auto") nouvelleSerie(modalite);
    if (mode === "7min") { S.fin = Date.now() + (p ? p.restant : P.modesApprentissage.minutes * 60000); S.timer = setInterval(tick, 1000); }
    if (p && p.q && byId[p.q.id]) { S.q = { e: byId[p.q.id], act: p.q.act, etranger: p.q.etranger, serie: p.q.serie, rep: p.q.rep }; dessiner(); }
    else if (p && S.mode === "7min" && S.fin <= Date.now()) terminer();
    else suivante();
  }
  function nouvelleSeance(mode, modalite, reprise) {
    abandonnerSeance();
    modalite = modalite || "auto";
    const p = E.parties && E.parties[clePartie(mode, modalite)];
    if (p && !reprise) return vueReprise(mode, modalite, p);
    demarrerS(mode, modalite, p || null);
  }
  function vueReprise(mode, modalite, p) {
    const reste = p.restant != null ? " · " + fmt(p.restant) + " restantes" : " · série de " + p.serie;
    vue(el("div", { class: "card center" }, el("h2", {}, "On reprend là où tu t'étais arrêté"),
      el("p", {}, "★ " + p.score + " points · " + p.bonnes + " bonne" + (p.bonnes > 1 ? "s" : "") + " réponse" + (p.bonnes > 1 ? "s" : "") + reste),
      el("button", { class: "big", onclick: () => nouvelleSeance(mode, modalite, true) }, "Reprendre"),
      el("button", { class: "soft", onclick: () => { demarrerS(mode, modalite, p); terminer(); } }, "Terminer cette partie"),
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
     En « Auto », les séries s'enchaînent dans l'ordre logique : sens, bon mot, pluriel (découverte), pièges (approfondissement), écriture (validation).
     Entre deux séries, un écran de fin propose l'activité suivante, les autres activités de la section, ou la section suivante. */
  const ETAPES = ["sens", "mot", "pluriel", "pieges", "saisie"];
  const SECTION = { sens: "Découverte", mot: "Découverte", pluriel: "Découverte", article: "Découverte", pieges: "Approfondissement", saisie: "Validation" };
  const NOM_ACT = { sens: "Sens du mot", mot: "Quel est le bon mot ?", pluriel: "Pluriel", article: "Der, Die ou Das ?", pieges: "Pièges d'orthographe", saisie: "Écrire le mot" };
  const MAX_TOURS = { pieges: 5 };        // nombre maximal de fois où un mot est posé dans une activité au cours d'une même séance (3 par défaut)
  const tours = (e, act) => S.tours[act + ":" + e.id] || 0;
  const libre = () => S.modalite !== "auto";
  const applicable = (e, act) => act === "pluriel" ? aPluriel(e) : act === "article" ? estNom(e) : act === "pieges" ? domApplicable(e, "ortho") : true;
  /* en parcours automatique, un mot n'est proposé que s'il a encore besoin de l'activité */
  function besoin(e, act) {
    const s = st(e.id);
    if (!applicable(e, act) || tours(e, act) >= (MAX_TOURS[act] || 3)) return false;
    switch (act) {
      case "sens": return s.fait.sens < 1 && !reconnuF(e);               // le test « sens » est facultatif
      case "mot": return s.fait.mot < 1;
      case "pluriel": return s.fait.pluriel < 1;
      case "pieges": return reconnuF(e) && !domValide(e, "ortho");
      case "saisie": return reconnuF(e) && domainesFaits(e) && !S.reposent.includes(e.id);
    }
    return false;
  }
  function nouvelleSerie(act) {
    S.etape = act; S.faits = []; S.reprises = []; S.reprisesFaites = []; S.sb = 0; S.sq = 0;
  }
  function reste(act) {
    const base = fenetre().concat(libre() && act === "saisie" ? aConfirmer() : []);
    return base.filter(e => (libre() ? applicable(e, act) : besoin(e, act)) && !S.faits.includes(e.id));
  }
  function prochaineEtape(apres) {
    const i0 = apres ? (ETAPES.includes(apres) ? ETAPES.indexOf(apres) : 2) : -1;     // « Der, Die ou Das ? » compte comme la fin de la découverte
    const ordre = ETAPES.slice(i0 + 1).concat(ETAPES.slice(0, i0 + 1));
    return ordre.find(a => fenetre().some(e => besoin(e, a))) || null;
  }
  const aucun = () => fenetre().length + aConfirmer().length ? { attente: true } : null;
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
  function suivante() {
    if (!S || S.fini) return;
    if (S.auto) { clearTimeout(S.auto); S.auto = null; }
    const c = choisir();
    if (c && c.vide) return terminer("Aucun mot de ta fenêtre ne se prête à cette activité pour l'instant : essaie-en une autre.");
    if (c && c.interlude) return vueInterlude(c.interlude);
    if (!c || c.attente) return terminer(c ? "Quelques mots se reposent : on les retrouve à ta prochaine séance, c'est le meilleur moyen de vérifier qu'ils sont bien installés." : "Tous les mots de ce lot sont sus. Bravo ! Tu peux passer au lot suivant dans les paramètres.", !c);
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
    const autres = (sect === "Découverte" ? ["sens", "mot", "pluriel", "article"] : sect === "Approfondissement" ? ["pieges"] : ["saisie"]).filter(a => a !== suivant && a !== fini);
    const changeSection = suivant && SECTION[suivant] !== sect;
    const n = S.sb;
    vue(el("div", { class: "card center" }, el("h2", {}, "Série terminée !"),
      el("p", {}, NOM_ACT[fini] + " : " + n + " bonne" + (n > 1 ? "s" : "") + " réponse" + (n > 1 ? "s" : "") + " sur " + S.sq + "."),
      el("p", { class: "prompt", style: "margin:0" }, "★ " + S.score),
      suivant ? el("p", { class: "mute small" }, changeSection ? "Prochaine étape : la section « " + SECTION[suivant] + " »." : "Prochaine activité de la section « " + SECTION[suivant] + " ».") : null,
      suivant ? el("button", { class: "big", id: "continuer", onclick: () => lancer("auto", suivant) }, "Continuer · " + NOM_ACT[suivant]) : null,
      autres.length ? el("div", { class: "small mute", style: "margin-top:10px" }, "Ou une autre activité :") : null,
      autres.length ? el("div", { class: "row" }, autres.map(a => el("button", { class: "soft", onclick: () => lancer(a, a) }, NOM_ACT[a]))) : null,
      sect === "Découverte" && !(suivant && SECTION[suivant] === "Approfondissement") ? el("button", { class: "soft", onclick: () => lancer("pieges", "pieges") }, "Passer à l'approfondissement") : null,
      el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "soft", onclick: () => reprendre(() => terminer()) }, "Terminer la séance"),
        el("button", { class: "soft", onclick: accueil }, "Retour à l'accueil"))));
  }
  function entete() {
    const but = P.modesApprentissage.challengeReponsesDAffilee;
    const seg = el("div", { class: "seg", role: "group", "aria-label": "Type d'activité" }, [["auto", "Auto"], ["sens", "Sens"], ["mot", "Bon mot"], ["pluriel", "Pluriel"], ["article", "Der Die Das"], ["pieges", "Pièges"], ["saisie", "Écrire"]].map(([k, n]) =>
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
    if (act === "saisie") questionSaisie(e, zone);
    else if (act === "recopier") questionRecopier(e, zone);
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
    if (act === "article") return { bon: e.art, liste: shuffle(["der", "die", "das"]) };
    const pool = B.entrees.filter(x => x.type === "mot" && x.lot === e.lot && x.id !== e.id && !tropProche(x, e));
    const memes = pool.filter(x => x.pos === e.pos), autres = pool.filter(x => x.pos !== e.pos);
    const prends = (f, n, deja) => { const out = [], vus = new Set(deja); for (const x of shuffle(memes).concat(shuffle(autres))) { const v = f(x); if (v && !vus.has(v)) { vus.add(v); out.push(v); if (out.length === n) break; } } return out; };
    if (act === "pieges") { const pre = e.art ? e.art + " " : "", bon = pre + e.de, d = shuffle(e.distracteurs || []).slice(0, 3); return { bon, liste: shuffle([bon, ...d.map(x => pre + x.forme)]), distr: d, pre }; }
    if (act === "sens") { const bon = e.fr[0]; return { bon, liste: shuffle([bon, ...prends(x => x.fr[0], 3, [bon])]) }; }
    if (act === "mot") { const bon = lib(e); return { bon, liste: shuffle([bon, ...prends(lib, 3, [bon])]) }; }
    const bon = "die " + plEff(e); return { bon, liste: shuffle([bon, ...pluriels(e).map(p => "die " + p)]) };
  }
  function questionQcm(e, act, zone) {
    const O = options(e, act), { bon, liste } = O;
    const consigne = { sens: "Que veut dire ce mot ?", mot: "Quel est le bon mot ?", pluriel: "Quel est le pluriel ?", article: "Der, die ou das ?", pieges: "Quelle est la bonne écriture ?" }[act];
    const francais = act === "mot" || act === "pieges";
    const texte = francais ? e.fr[0] : act === "article" ? e.de : lib(e);
    zone.append(el("div", { class: "sub" }, consigne),
      el("div", { class: "prompt" }, francais ? texte : de(texte), " ", (act === "sens" || act === "pluriel") ? audioBtn(lib(e)) : ""),
      act === "pluriel" || act === "article" ? el("div", { class: "sub" }, frs(e)) : null);
    if (act === "sens") parler(lib(e));
    const fb = el("div", { "aria-live": "polite" }); const opts = el("div", { class: "opts" });
    const boutons = liste.map(l => el("button", { class: "opt", type: "button", onclick: () => {
      boutons.forEach(b => b.disabled = true);
      const ok = l === bon;
      boutons.forEach(b => { if (b.textContent === bon) b.classList.add("good"); });
      if (!ok) boutons.find(b => b.textContent === l).classList.add("try");
      const mauvais = O.distr && O.distr.find(x => O.pre + x.forme === l);
      const expl = act === "sens" ? `« ${lib(e)} » veut dire « ${e.fr[0]} ».` : act === "mot" ? `En allemand : ${lib(e)}.`
        : act === "article" ? `On dit ${lib(e)}.` : act === "pieges" ? (ok ? `Bien vu : ${bon}.` : `${bon}.` + (mauvais && mauvais.expl ? ` Le piège : ${mauvais.expl}.` : ""))
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
    if (act === "pieges" && noterDomaine(e, "ortho", ok)) expl += " L'orthographe de ce mot est validée !";
    /* objectif « reconnu » : les tests « mot » et « pluriel » réussis suffisent (le test « sens » est facultatif) */
    if (e.objectif === "reconnu" && s.etat !== "su" && s.fait.mot >= 1 && (!aPluriel(e) || s.fait.pluriel >= 1)) s.etat = "reconnu";
    S.questions++;
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
  function noterSaisie(e, ok, diag, fb, a, v1, v2) {
    const s = st(e.id), r = R(), etr = !!(S.q && S.q.etranger);
    E.q++; s.dq = E.q; s.vus++; s.dern = "saisie"; s.essais++; S.questions++;
    let msg, gain = 0;
    if (ok) {
      S.bonnes++; S.serie++; s.echecsSuite = 0; gain = crediter("saisie");
      if (s.essais === 1) s.premier = true;
      s.reussites.push({ seance: S.id, q: E.q, etr });
      const deja = s.etat === "su";
      if (s.essais === 1 && etr) { s.etat = "su"; if (!deja) S.su.push(e.id); msg = "Mot su, du premier coup !"; }
      else if (s.reussites.length >= r.reussitesPourSu && s.reussites.some(x => x.etr)) { s.etat = "su"; if (!deja) S.su.push(e.id); msg = "Mot su, bravo !"; }
      else if (deja) msg = "Toujours bien su !";
      else { s.etat = "aConfirmer"; msg = etr ? "Très bien ! On le retrouvera une dernière fois pour bien le fixer." : "Juste ! On le retrouvera plus tard, quand tu ne l'auras plus sous les yeux."; }
      if (s.etat === "su" && !deja) {
        S.score += SC().motSu; gain += SC().motSu;
        s.audioAFaire = !(s.val && s.val.phon);     // la saisie ne teste pas l'oreille : la reconnaissance audio reste à faire
        if (s.audioAFaire && DOMAINES.includes("phon")) msg += " Il te reste à reconnaître ce mot à l'oreille.";
      }
    } else {
      S.serie = 0; s.etat = s.etat === "su" ? "su" : "enCours"; if (s.essais === 1) s.premier = false;
      s.echecsSuite++; S.erreurs.push({ id: e.id, act: "saisie", donne: (v1 + (v2 ? " / " + v2 : "")).trim(), attendu: a.mot + (a.variante ? " / " + a.variante : "") });
      const aide = { majuscule: "Les noms prennent une majuscule.", majuscules: "Regardons les majuscules et les minuscules.", article: "Regardons l'article de ce nom.", orthographe: "Regardons l'écriture du mot.", variante: "Regardons la forme demandée." }[diag];
      msg = `On le retient ensemble : ${a.mot}${a.variante ? " — " + a.variante : ""}. ${aide}`;
      if (s.echecsSuite >= r.echecsAvantRenvoi) {
        const act = diag === "article" ? "article" : diag === "variante" ? (aPluriel(e) ? "pluriel" : "recopier") : "recopier";
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
    const act = (k, n, aide) => el("button", { class: "soft", title: aide || "", onclick: () => { E.reglages.modalite = k; sauver(); nouvelleSeance("7min", k); } }, n);
    const bientot = n => el("button", { class: "soft off", disabled: "", "aria-disabled": "true" }, n + " (bientôt)");
    const section = (titre, note, ...btns) => el("div", { class: "card" }, el("h3", {}, titre), note ? el("div", { class: "small mute", style: "margin-bottom:6px" }, note) : null, el("div", { class: "row" }, btns));
    const inv = invitations().map(i => el("div", { class: "card inv", role: "status" }, el("div", {}, i.texte),
      el("div", { class: "row", style: "margin-top:8px" },
        el("button", { class: "soft on", onclick: () => { E.invit[i.cle] = 0; sauver(); nouvelleSeance("7min", i.modalite); } }, "On y va"),
        el("button", { class: "soft", onclick: () => { E.invit[i.cle] = i.n + SEUIL_INV(); sauver(); accueil(); } }, "Plus tard"))));
    vue(el("div", { class: "card center" },
      el("h2", {}, "Bonjour " + nom + " !"),
      el("div", { class: "mute" }, "Lot " + E.lot + " · " + titreLot(E.lot)),
      el("div", { class: "bar" }, el("i", { style: "width:" + (f.length ? Math.round(100 * su / f.length) : 0) + "%" })),
      el("div", { class: "small mute" }, su + " mot" + (su > 1 ? "s" : "") + " su" + (su > 1 ? "s" : "") + " sur " + f.length),
      el("button", { class: "big", onclick: () => nouvelleSeance("7min", "auto") }, "Continuer · " + P.modesApprentissage.minutes + " minutes"),
      el("button", { class: "soft", onclick: () => nouvelleSeance("challenge", "auto") }, "Le défi des " + P.modesApprentissage.challengeReponsesDAffilee)),
      ...inv,
      section("Découverte", "Comprendre et reconnaître les mots.", act("sens", "Sens du mot"), act("mot", "Quel est le bon mot ?"), act("pluriel", "Pluriel"), act("article", "Der, Die ou Das ?"), bientot("Phrases à trous")),
      section("Approfondissement", "Fixer l'écriture, les formes et le son.", act("pieges", "Pièges d'orthographe"), bientot("Dictée"), bientot("Formes du mot"), bientot("Reconnaissance audio")),
      section("Valider un mot", "Écrire le mot en allemand, quand tu te sens prêt.", bientot("Préparer la validation"), act("saisie", "Écrire le mot")),
      el("div", { class: "card" }, el("div", { class: "small mute", style: "text-align:center;margin-bottom:4px" }, "Les mots du moment"),
        el("div", { class: "row" }, w.map(e => el("span", { class: "chip s-" + st(e.id).etat, lang: "de", "aria-label": lib(e) + (reconnuF(e) ? ", reconnu" : "") + (st(e.id).val && st(e.id).val.ortho ? ", orthographe validée" : "") }, lib(e),
          reconnuF(e) ? el("sup", { class: "pas" }, " D") : null, (st(e.id).val && st(e.id).val.ortho) ? el("sup", { class: "pas" }, " O") : null))),
        el("div", { class: "small mute", style: "text-align:center;margin-top:6px" }, "D : découverte faite · O : orthographe validée"),
        aConfirmer().length ? el("div", { class: "small mute", style: "text-align:center;margin-top:6px" }, "À retrouver bientôt : " + aConfirmer().map(lib).join(", ")) : null));
  }
  /* Invitations à passer à la section suivante : positives, jamais bloquantes ; « Plus tard » repousse jusqu'à N nouveaux mots prêts. */
  function invitations() {
    const w = fenetre(), seuil = SEUIL_INV(), inv = E.invit = E.invit || { approf: 0, valid: 0 }, out = [];
    const nA = w.filter(e => reconnuF(e) && !domainesFaits(e)).length;
    if (nA >= Math.max(seuil, inv.approf || 0)) out.push({ cle: "approf", n: nA, texte: nA + " mots de ta liste sont reconnus. On les approfondit ?", modalite: "pieges" });
    const nV = w.filter(e => reconnuF(e) && domainesFaits(e)).length;
    if (nV >= Math.max(seuil, inv.valid || 0)) out.push({ cle: "valid", n: nV, texte: nV + " mots sont prêts pour la validation. On les écrit ?", modalite: "saisie" });
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
    window.APP_DEBUG = { etat: () => E, seance: () => S, B: () => B, P: () => P, pluriels, options };
    window.addEventListener("pagehide", () => { if (S && !S.fini && E) sauverPartie(true); });
    vueProfil();
  }
  (async function () {
    if (await charger()) demarrer(); else vueChargement();
  })();
})();
