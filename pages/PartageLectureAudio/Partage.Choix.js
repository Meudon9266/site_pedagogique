/* =====================================================
   Partage.Choix.js  (commun à tous les exercices)
   Version propre possible : NomdeRef.Choix.js (prioritaire)

   PAGE D'ACCUEIL : LISTE DES EXERCICES D'UNE PAGE
   Une page Racine.html sert à toute une série d'exercices :
     Anna.1.Racine.json, Stundenplan.2.Racine.json, Wetter.3.Racine.json…
     (Nom.N.Racine.json : N = place dans la liste)
   - Racine.html                      → liste des exercices + « Reprendre l'exercice précédent »
   - Racine.html?exo=Anna.1.Racine    → l'exercice (texte, quiz, score… propres à cet exercice)

   Les noms de tout ce qui appartient à un exercice sont reconstruits à partir
   de son nom (window.RACINE_EXERCICE, posé par la page) :
     Anna.1.Racine.json, Anna.1.Racine.mp3, Anna.1.Racine.1.png, Anna.1.Racine.fiche.pdf…

   Liste des exercices :
   - sur un site : Racine.liste.json s'il existe, sinon l'API de GitHub (GitHub Pages),
     sinon la liste du dossier fournie par le serveur ;
   - en local (ou si le serveur ne donne pas la liste) : bouton
     « 📂 Choisir les fichiers des exercices » ; les fichiers choisis sont
     gardés pour la séance (onglet), le dernier exercice ouvert est gardé
     dans le navigateur pour « Reprendre ».
   Compatibilité : sans aucun fichier Nom.N.Racine.json mais avec Racine.json,
   la page ouvre Racine.json comme avant (événement "choix:aucun" → Quiz).

   Mémorisé (localStorage) : Racine::dernier (exercice et titre),
   Racine::dernier::contenu (copie du JSON, pour reprendre hors ligne),
   Racine::liste (ordre des exercices, pour « Exercice suivant »).
   ===================================================== */

(function () {
  "use strict";

  const fichierPage = decodeURIComponent(location.pathname.split("/").pop() || "");
  const PAGE = window.RACINE_PAGE || fichierPage.split(".")[0] || "index";
  const EXO = window.EXO || "";
  const CLE_DERNIER = PAGE + "::dernier";
  const CLE_CONTENU = PAGE + "::dernier::contenu";
  const CLE_LISTE = PAGE + "::liste";
  const echappeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const MOTIF = new RegExp("^(.+)\\.(\\d+)\\." + echappeRe(PAGE) + "\\.json$");   // majuscules comprises (GitHub y est sensible)

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage plein ou interdit */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* idem */ } }
  function lireJSON(k, defaut) { try { return JSON.parse(lsGet(k)) || defaut; } catch (e) { return defaut; } }

  // "Anna.1.Racine.json" → { exo: "Anna.1.Racine", nom: "Anna", ordre: 1 }
  function analyser(nomFichier) {
    const m = String(nomFichier).match(MOTIF);
    return m ? { exo: nomFichier.replace(/\.json$/i, ""), nom: m[1], ordre: Number(m[2]) } : null;
  }
  const trier = liste => liste.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
  const adresse = exo => location.pathname + "?exo=" + encodeURIComponent(exo);

  /* ===============================
     CONTENU GARDÉ (local ou hors ligne)
     =============================== */
  function contenuEnCache(exo) {
    const s = ssGet("contenu::" + exo);
    if (s) { try { return JSON.parse(s); } catch (e) { /* abîmé */ } }
    const d = lireJSON(CLE_DERNIER, null);
    if (d && d.exo === exo) { try { return JSON.parse(lsGet(CLE_CONTENU)); } catch (e) { return null; } }
    return null;
  }

  // exercice ouvert : il devient « l'exercice précédent »
  document.addEventListener("quiz:charge", () => {
    if (!EXO || !window.Quiz || typeof Quiz.donnees !== "function") return;
    const d = Quiz.donnees();
    const titre = (d && d.texte && d.texte.titre) || EXO;
    lsSet(CLE_DERNIER, JSON.stringify({ exo: EXO, titre, quand: Date.now() }));
    lsSet(CLE_CONTENU, JSON.stringify(d));
  });

  /* ===============================
     LISTE DU DOSSIER (serveur)
     =============================== */
  /* Trois façons de trouver les fichiers, essayées dans l'ordre :
     1) Racine.liste.json : liste écrite à côté de la page (par l'action GitHub
        fournie, ou à la main) : ["Anna.1.Racine.json", …] ou [{"fichier": …, "titre": …}]
     2) GitHub Pages (adresse en .github.io) : contenu du dossier lu par l'API de GitHub
        (sert aussi à vérifier la liste 1 : exercice oublié ajouté, fichier disparu retiré)
        (gardé 30 min dans le navigateur : l'API limite le nombre de demandes)
     3) liste du dossier affichée par le serveur (Apache, nginx, serveur local…) */
  async function depuisManifeste() {
    const r = await fetch(encodeURI(PAGE + ".liste.json"), { cache: "no-cache" });
    if (!r.ok) return null;
    const d = await r.json();
    const t = Array.isArray(d) ? d : (d && Array.isArray(d.exercices) ? d.exercices : []);
    return t.map(x => typeof x === "string" ? { nom: x } : { nom: x.fichier || x.nom || "", titre: x.titre });
  }

  async function depuisGitHub() {
    const hote = location.hostname;
    if (!/\.github\.io$/i.test(hote)) return null;
    const CLE_CACHE = PAGE + "::liste::github";
    try {
      const c = JSON.parse(ssGet(CLE_CACHE) || lsGet(CLE_CACHE) || "null");
      if (c && Date.now() - c.quand < 30 * 60 * 1000 && Array.isArray(c.noms)) return c.noms.map(nom => ({ nom }));
    } catch (e) { /* cache abîmé */ }
    const proprietaire = hote.split(".")[0];
    const dossiers = location.pathname.split("/").filter(Boolean).map(x => decodeURIComponent(x));
    dossiers.pop();                                         // le fichier de la page
    const essais = [];
    if (dossiers.length) essais.push({ depot: dossiers[0], chemin: dossiers.slice(1) });   // proprietaire.github.io/depot/…
    essais.push({ depot: hote, chemin: dossiers });          // site personnel : dépôt proprietaire.github.io
    for (const e of essais) {
      const url = "https://api.github.com/repos/" + encodeURIComponent(proprietaire) + "/" + encodeURIComponent(e.depot)
        + "/contents/" + e.chemin.map(encodeURIComponent).join("/");
      try {
        const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
        if (!r.ok) continue;
        const d = await r.json();
        if (!Array.isArray(d)) continue;
        const noms = d.filter(f => f && f.type === "file").map(f => f.name);
        lsSet(CLE_CACHE, JSON.stringify({ quand: Date.now(), noms }));
        return noms.map(nom => ({ nom }));
      } catch (err) { /* essai suivant */ }
    }
    return null;
  }

  async function depuisListeServeur() {
    const r = await fetch("./", { cache: "no-cache" });
    if (!r.ok) return null;
    const html = await r.text();
    const noms = [];
    const re = /href\s*=\s*["']([^"'#?]+)["']/gi;
    let m;
    while ((m = re.exec(html))) {
      let nom = m[1].split("/").filter(Boolean).pop() || "";
      try { nom = decodeURIComponent(nom); } catch (e) { /* tel quel */ }
      noms.push({ nom });
    }
    return noms;
  }

  let sourceListe = null;   // méthode qui a donné la liste affichée

  // noms trouvés → exercices triés, avec leur titre (lu dans le fichier s'il manque)
  async function preparer(trouves) {
    const vus = new Map();
    (trouves || []).forEach(x => {
      const a = analyser(x.nom);
      if (a && !vus.has(a.exo)) { if (x.titre) a.titre = x.titre; vus.set(a.exo, a); }
    });
    const liste = trier(Array.from(vus.values()));
    // titres manquants : lus dans chaque fichier (bloc "texte")
    await Promise.all(liste.filter(e => !e.titre).map(async e => {
      try {
        const d = await (await fetch(encodeURI(e.exo + ".json"), { cache: "no-cache" })).json();
        e.titre = d && d.texte && d.texte.titre;
      } catch (err) { /* titre absent : le nom suffit */ }
    }));
    return liste;
  }

  async function decouvrir() {
    let trouves = null;
    sourceListe = null;
    for (const methode of [depuisManifeste, depuisGitHub, depuisListeServeur]) {
      try { trouves = await methode(); } catch (e) { trouves = null; }
      if (trouves && trouves.some(x => analyser(x.nom))) { sourceListe = methode; console.log("[Choix] liste trouvée par " + methode.name); break; }
      trouves = null;
    }
    return preparer(trouves);
  }

  /* Double vérification sur GitHub Pages : la liste écrite (Racine.liste.json) est
     affichée tout de suite, puis comparée au contenu réel du dossier ; un exercice
     oublié est ajouté, un exercice dont le fichier a disparu est retiré. */
  async function verifierSurGitHub(liste) {
    if (sourceListe !== depuisManifeste) return;
    let reels = null;
    try { reels = await depuisGitHub(); } catch (e) { reels = null; }
    if (!reels) return;
    const presents = new Set(reels.map(x => x.nom).filter(n => analyser(n)));
    const affiches = new Set(liste.map(e => e.exo + ".json"));
    const manquants = [...presents].filter(n => !affiches.has(n));
    const disparus = [...affiches].filter(n => !presents.has(n));
    if (!manquants.length && !disparus.length) return;
    console.warn("[Choix] " + PAGE + ".liste.json n'est pas à jour : ajoutés " + manquants.join(", ") + " ; retirés " + disparus.join(", "));
    const titres = new Map(liste.map(e => [e.exo + ".json", e.titre]));
    const corrigee = await preparer([...presents].map(nom => ({ nom, titre: titres.get(nom) })));
    afficher(corrigee, null);
  }

  async function existe(nom) {
    try { const r = await fetch(encodeURI(nom), { cache: "no-cache" }); return r.ok; } catch (e) { return false; }
  }

  /* ===============================
     AFFICHAGE DE LA LISTE
     =============================== */
  function el(tag, attrs, ...enfants) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    enfants.flat().forEach(c => { if (c !== null && c !== undefined && c !== false) e.append(c); });
    return e;
  }

  function afficher(liste, message) {
    const zone = document.getElementById("zone-contenu");
    if (!zone) return;
    document.body.classList.add("mode-choix");
    const h1 = document.getElementById("page-title");
    if (h1 && !h1.textContent.trim()) h1.textContent = PAGE;
    document.title = (h1 && h1.textContent.trim()) || PAGE;
    if (liste.length) lsSet(CLE_LISTE, JSON.stringify(liste.map(e => e.exo)));

    zone.textContent = "";
    const boite = el("div", { class: "choix" });

    const dernier = lireJSON(CLE_DERNIER, null);
    if (dernier && dernier.exo) {
      boite.append(el("div", { class: "choix-reprise" },
        el("a", { class: "choix-reprendre", href: adresse(dernier.exo) }, "↻ Reprendre l'exercice précédent"),
        el("span", { class: "choix-reprise-titre", text: dernier.titre || dernier.exo })));
    }

    boite.append(el("h2", { class: "choix-titre", text: "Choisis un exercice" }));
    if (liste.length) {
      boite.append(el("ol", { class: "choix-liste" }, liste.map(e =>
        el("li", null, el("a", { href: adresse(e.exo), title: e.exo + ".json" },
          el("span", { class: "choix-num", text: String(e.ordre) }),
          el("span", { class: "choix-nom", text: e.titre || e.nom }),
          e.exo === (dernier && dernier.exo) ? el("span", { class: "choix-dernier", text: "dernier ouvert" }) : null)))));
    }
    if (message) boite.append(el("p", { class: "choix-message", text: message }));

    // fichiers choisis à la main (ouverture locale, ou serveur sans liste du dossier)
    const entree = el("input", { type: "file", accept: ".json,application/json", multiple: "", style: "display:none" });
    entree.addEventListener("change", async () => {
      const fichiers = Array.from(entree.files || []);
      const choisis = [];
      for (const f of fichiers) {
        const a = analyser(f.name) || { exo: f.name.replace(/\.json$/i, ""), nom: f.name.replace(/\.json$/i, ""), ordre: 999 };
        const texte = await f.text();
        try { const d = JSON.parse(texte); a.titre = d && d.texte && d.texte.titre; } catch (e) { continue; }
        ssSet("contenu::" + a.exo, texte);
        choisis.push(a);
      }
      entree.value = "";
      if (choisis.length === 1) { location.href = adresse(choisis[0].exo); return; }
      if (choisis.length) afficher(trier(choisis), null);
    });
    // inutile quand le site donne la liste : seulement en local, ou si la liste manque
    if (!liste.length || location.protocol === "file:") boite.append(el("div", { class: "choix-local" },
      el("button", { type: "button", class: "quiz-json-bouton", onclick: () => entree.click() }, "📂 Choisir les fichiers des exercices"),
      el("span", { class: "choix-aide", text: "fichiers " + "Nom.N." + PAGE + ".json" }),
      entree));

    zone.append(boite);
  }

  /* ===============================
     DÉMARRAGE (page sans ?exo=)
     =============================== */
  async function demarrer() {
    if (!window.CHOIX_EXERCICES || EXO) return;
    if (location.protocol === "file:") {
      afficher([], "Page ouverte depuis l'ordinateur : choisis les fichiers des exercices.");
      return;
    }
    let liste = [];
    try { liste = await decouvrir(); } catch (e) { console.warn("[Choix] liste du dossier indisponible :", e.message); }
    if (liste.length) { afficher(liste, null); verifierSurGitHub(liste); return; }
    // aucun exercice en série : ancien exercice unique Racine.json ?
    if (await existe(PAGE + ".json")) {
      document.dispatchEvent(new CustomEvent("choix:aucun"));
      return;
    }
    afficher([], "Aucun fichier " + "Nom.N." + PAGE + ".json n'a été trouvé (ni " + PAGE + ".liste.json, ni liste du dossier).");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();

  window.ChoixExercices = {
    contenuEnCache,
    liste: () => lireJSON(CLE_LISTE, []),
    adresse,
    analyser
  };
})();
