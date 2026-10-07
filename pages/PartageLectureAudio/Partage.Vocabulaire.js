/* =====================================================
   Partage.Vocabulaire.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.Vocabulaire.js (prioritaire)

   MOTS DIFFICILES : traduction française au survol (ou au toucher)
   - liste de base dans NomdeRef.json, bloc "vocabulaire" :
       "vocabulaire": [
         { "mot": "Katze", "traduction": "le chat (die Katze)" },
         { "mot": "heißen", "traduction": "s'appeler", "formes": ["heiße", "heißt"] }
       ]
     mot        mot ou expression tel qu'il apparaît dans le texte
     traduction texte affiché au survol
     formes     facultatif : autres formes à repérer dans le texte
     actif      facultatif : false = proposé mais DÉCOCHÉ au départ
                (l'enseignant le coche dans « 📖 Liste des mots »)
   - dans le menu ⚙️ Paramètres :
       « ➕ Ajouter un mot »      : mots ajoutés, mémorisés dans ce navigateur
       « 📖 Liste des mots »      : cocher / décocher chaque mot
                                    (traduit ou non), mémorisé dans ce navigateur
   - les mots sont repérés dans les phrases du texte (#zone-contenu .phrase),
     sans tenir compte des majuscules ; la lecture audio n'est pas modifiée
   - pendant la première écoute (texte masqué), aucune traduction ne s'affiche

   Dépend de : Partage.Quiz.js (Quiz.donnees(), événement "quiz:charge").
   ===================================================== */

(function () {
  "use strict";

  const fichier = decodeURIComponent(location.pathname.split("/").pop() || "");
  const RACINE = window.RACINE_EXERCICE || fichier.split(".")[0] || "index";   // exercice choisi (?exo=…) sinon nom de la page
  const CLE_AJOUTS = RACINE + "::vocab::ajouts";
  const CLE_ETATS = RACINE + "::vocab::etats";       // { mot: true/false } choisis dans la liste
  const CLE_INACTIFS = RACINE + "::vocab::inactifs"; // ancienne mémoire (liste des mots décochés)

  /* ===============================
     1. OUTILS
     =============================== */
  const $ = id => document.getElementById(id);

  function el(tag, attrs, ...enfants) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k === "value") e.value = v;
        else if (k === "checked") e.checked = !!v;
        else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? "" : v);
      }
    }
    enfants.flat().forEach(c => {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function lire(k, defaut) {
    try { const v = localStorage.getItem(k); return v === null ? defaut : JSON.parse(v); }
    catch (e) { return defaut; }
  }
  function ecrire(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ }
  }

  const cle = mot => String(mot || "").trim().toLowerCase();

  /* ===============================
     2. LISTE DES MOTS
     =============================== */
  let motsFichier = [];   // depuis le JSON

  function nettoyerEntree(e, source) {
    if (!e || typeof e !== "object") return null;
    const mot = String(e.mot || "").trim();
    const traduction = String(e.traduction || "").trim();
    if (!mot || !traduction) return null;
    const formes = Array.isArray(e.formes) ? e.formes.map(f => String(f).trim()).filter(Boolean) : [];
    return { mot, traduction, formes, source, parDefaut: e.actif !== false };
  }

  function ajouts() {
    const a = lire(CLE_AJOUTS, []);
    return Array.isArray(a) ? a.map(e => nettoyerEntree(e, "ajout")).filter(Boolean) : [];
  }
  // choix mémorisés dans ce navigateur : { "katze": true, "bruder": false, … }
  function etats() {
    let e = lire(CLE_ETATS, null);
    if (!e || typeof e !== "object" || Array.isArray(e)) {
      e = {};
      const anciens = lire(CLE_INACTIFS, []);            // reprise de l'ancienne mémoire
      if (Array.isArray(anciens)) anciens.forEach(k => { e[cle(k)] = false; });
    }
    return e;
  }
  function choisir(changements) {
    const e = Object.assign(etats(), changements);
    ecrire(CLE_ETATS, e);
  }

  // liste complète : fichier puis ajouts (un mot ajouté remplace celui du fichier s'il a le même nom)
  // état d'un mot : choix mémorisé dans ce navigateur, sinon valeur du fichier ("actif"), sinon coché
  function liste() {
    const choix = etats();
    const parCle = new Map();
    motsFichier.forEach(e => parCle.set(cle(e.mot), e));
    ajouts().forEach(e => parCle.set(cle(e.mot), e));
    return Array.from(parCle.values()).map(e => {
      const k = cle(e.mot);
      return Object.assign({}, e, { actif: typeof choix[k] === "boolean" ? choix[k] : e.parDefaut });
    });
  }

  /* ===============================
     3. REPÉRAGE DANS LE TEXTE
     =============================== */
  const LETTRE = "\\p{L}\\p{N}";

  function echapper(t) {
    return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  }

  function retirerMarques(zone) {
    zone.querySelectorAll("span.vocab").forEach(s => s.replaceWith(document.createTextNode(s.textContent)));
    zone.querySelectorAll(".phrase").forEach(p => p.normalize());
  }

  function compterOccurrences() {
    const n = new Map();
    document.querySelectorAll("#zone-contenu span.vocab").forEach(s => {
      const k = s.dataset.cle;
      n.set(k, (n.get(k) || 0) + 1);
    });
    return n;
  }

  function appliquer() {
    const zone = $("zone-contenu");
    if (!zone) return;
    retirerMarques(zone);

    const actifs = liste().filter(e => e.actif);
    if (!actifs.length) { majCompteur(); return; }

    // toutes les formes, les plus longues d'abord (expressions avant mots seuls)
    const formes = [];
    actifs.forEach(e => [e.mot].concat(e.formes).forEach(f => formes.push({ f, e })));
    formes.sort((a, b) => b.f.length - a.f.length);
    const parForme = new Map(formes.map(x => [cle(x.f).replace(/\s+/g, " "), x.e]));

    let re;
    try {
      re = new RegExp(`(?<![${LETTRE}])(${formes.map(x => echapper(x.f)).join("|")})(?![${LETTRE}])`, "giu");
    } catch (err) {
      console.warn("[Vocabulaire] repérage impossible :", err.message);
      return;
    }

    zone.querySelectorAll(".phrase").forEach(phrase => {
      const noeuds = [];
      const tw = document.createTreeWalker(phrase, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) noeuds.push(tw.currentNode);
      noeuds.forEach(n => {
        const t = n.nodeValue;
        re.lastIndex = 0;
        if (!re.test(t)) return;
        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let dernier = 0, m;
        while ((m = re.exec(t)) !== null) {
          if (m.index > dernier) frag.appendChild(document.createTextNode(t.slice(dernier, m.index)));
          const e = parForme.get(cle(m[0]).replace(/\s+/g, " "));
          frag.appendChild(el("span", {
            class: "vocab", tabindex: "0", "data-trad": e ? e.traduction : "",
            "data-cle": e ? cle(e.mot) : "", "aria-label": m[0] + " : " + (e ? e.traduction : "")
          }, m[0]));
          dernier = m.index + m[0].length;
        }
        if (dernier < t.length) frag.appendChild(document.createTextNode(t.slice(dernier)));
        n.replaceWith(frag);
      });
    });
    majCompteur();
  }

  // au toucher (téléphone, tablette) : un appui affiche la traduction, un autre la cache
  document.addEventListener("click", ev => {
    const v = ev.target.closest && ev.target.closest("span.vocab");
    document.querySelectorAll("span.vocab.ouvert").forEach(s => { if (s !== v) s.classList.remove("ouvert"); });
    if (v) v.classList.toggle("ouvert");
  });

  /* ===============================
     4. PARAMÈTRES : boutons + fenêtre
     =============================== */
  function majCompteur() {
    const b = $("btn-vocab-liste");
    if (b) {
      const l = liste();
      b.textContent = "📖 Liste des mots (" + l.filter(e => e.actif).length + "/" + l.length + ")";
    }
  }

  function installerBoutons() {
    let hote = $("vocab-params");
    if (!hote) {
      const box = $("quiz-filter-box");
      if (!box) return;
      hote = el("div", { id: "vocab-params", class: "params-section", "data-injecte-par": "Vocabulaire" });
      const avant = box.querySelector(":scope > .pied-params, :scope > #btn-corrige");
      box.insertBefore(hote, avant || null);
    }
    hote.textContent = "";
    hote.appendChild(el("div", { class: "params-titre", text: "Mots traduits au survol" }));
    hote.appendChild(el("button", { type: "button", id: "btn-vocab-ajout", class: "params-btn",
      onclick: () => ouvrirFenetre(true) }, "➕ Ajouter un mot"));
    hote.appendChild(el("button", { type: "button", id: "btn-vocab-liste", class: "params-btn",
      onclick: () => ouvrirFenetre(false) }, "📖 Liste des mots"));
    majCompteur();
  }

  function selectionDansLeTexte() {
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    const zone = $("zone-contenu");
    const n = sel.anchorNode;
    if (!zone || !n || !zone.contains(n)) return "";
    return sel.toString().replace(/\s+/g, " ").trim().slice(0, 60);
  }

  function fermerFenetre() {
    const f = $("vocab-fenetre");
    if (f) f.remove();
    document.removeEventListener("keydown", surEchap);
  }
  function surEchap(e) { if (e.key === "Escape") fermerFenetre(); }

  function ouvrirFenetre(focusAjout) {
    const preRempli = selectionDansLeTexte();
    fermerFenetre();

    const champMot = el("input", { type: "text", class: "vocab-champ", lang: "de", placeholder: "Mot allemand (ex. Katze)", value: preRempli });
    const champTrad = el("input", { type: "text", class: "vocab-champ", lang: "fr", placeholder: "Traduction (ex. le chat)" });
    const message = el("div", { class: "vocab-message", "aria-live": "polite" });
    const corps = el("div", { class: "vocab-liste" });

    function ajouter() {
      const mot = champMot.value.trim(), traduction = champTrad.value.trim();
      if (!mot || !traduction) { message.textContent = "Écris le mot et sa traduction."; return; }
      const a = lire(CLE_AJOUTS, []).filter(e => cle(e.mot) !== cle(mot));
      a.push({ mot, traduction });
      ecrire(CLE_AJOUTS, a);
      // un mot ajouté est coché
      choisir({ [cle(mot)]: true });
      appliquer();
      remplirListe();
      const n = compterOccurrences().get(cle(mot)) || 0;
      message.textContent = "✔ « " + mot + " » ajouté" + (n ? " (" + n + " fois dans le texte)." : " – attention : introuvable dans le texte.");
      champMot.value = ""; champTrad.value = ""; champMot.focus();
    }
    champTrad.addEventListener("keydown", e => { if (e.key === "Enter") ajouter(); });
    champMot.addEventListener("keydown", e => { if (e.key === "Enter") champTrad.focus(); });

    function basculer(e, actif) {
      choisir({ [cle(e.mot)]: actif });
      appliquer();
      remplirListe();
    }
    function tous(actif) {
      const c = {};
      liste().forEach(x => { c[cle(x.mot)] = actif; });
      choisir(c);
      appliquer();
      remplirListe();
    }

    function remplirListe() {
      corps.textContent = "";
      const l = liste().sort((a, b) => a.mot.localeCompare(b.mot, "de"));
      const occ = compterOccurrences();
      if (!l.length) {
        corps.appendChild(el("p", { class: "vocab-vide", text: "Aucun mot pour l'instant." }));
        return;
      }
      const table = el("table", { class: "vocab-table" },
        el("tr", null, el("th", { text: "Traduit" }), el("th", { text: "Mot" }), el("th", { text: "Traduction" }),
          el("th", { text: "Dans le texte" }), el("th", { text: "" })));
      l.forEach(e => {
        const cb = el("input", { type: "checkbox", checked: e.actif, "aria-label": "Traduire « " + e.mot + " »" });
        cb.addEventListener("change", () => basculer(e, cb.checked));
        const n = occ.get(cle(e.mot)) || 0;
        table.appendChild(el("tr", { class: e.actif ? "" : "inactif" },
          el("td", null, cb),
          el("td", { lang: "de" }, el("strong", { text: e.mot }), e.formes.length ? el("div", { class: "vocab-formes", text: e.formes.join(", ") }) : null),
          el("td", { text: e.traduction }),
          el("td", { class: "vocab-occ", text: e.actif ? (n ? n + "×" : "absent") : "—" }),
          el("td", null, e.source === "ajout"
            ? el("button", { type: "button", class: "vocab-suppr", title: "Supprimer ce mot ajouté",
                onclick: () => {
                  ecrire(CLE_AJOUTS, lire(CLE_AJOUTS, []).filter(x => cle(x.mot) !== cle(e.mot)));
                  appliquer(); remplirListe();
                } }, "🗑")
            : el("span", { class: "vocab-source", text: "fichier" }))
        ));
      });
      corps.appendChild(table);
      corps.appendChild(el("div", { class: "vocab-tous" },
        el("button", { type: "button", onclick: () => tous(true) }, "Tout cocher"),
        el("button", { type: "button", onclick: () => tous(false) }, "Tout décocher")));
    }

    const fenetre = el("div", { id: "vocab-fenetre", class: "vocab-fond", "data-injecte-par": "Vocabulaire",
        onclick: e => { if (e.target.id === "vocab-fenetre") fermerFenetre(); } },
      el("div", { class: "vocab-boite", role: "dialog", "aria-label": "Mots traduits au survol" },
        el("div", { class: "vocab-tete" },
          el("strong", { text: "📖 Mots traduits au survol" }),
          el("button", { type: "button", class: "vocab-fermer", onclick: fermerFenetre, "aria-label": "Fermer" }, "✕")),
        el("div", { class: "vocab-ajout" },
          el("div", { class: "vocab-soustitre", text: "Ajouter un mot" }),
          el("div", { class: "vocab-ligne" }, champMot, champTrad,
            el("button", { type: "button", class: "vocab-ajouter", onclick: ajouter }, "Ajouter")),
          el("div", { class: "vocab-aide", text: "Astuce : sélectionne un mot dans le texte avant d'ouvrir cette fenêtre, il sera déjà écrit. Les mots ajoutés sont mémorisés dans ce navigateur." }),
          message),
        el("div", { class: "vocab-soustitre", text: "Liste des mots – coche ceux qui doivent être traduits" }),
        corps)
    );
    document.body.appendChild(fenetre);
    document.addEventListener("keydown", surEchap);
    remplirListe();
    if (focusAjout || preRempli) (preRempli ? champTrad : champMot).focus();
  }

  /* ===============================
     5. CHARGEMENT
     =============================== */
  function charger(donnees) {
    const v = donnees && Array.isArray(donnees.vocabulaire) ? donnees.vocabulaire : [];
    motsFichier = v.map(e => nettoyerEntree(e, "fichier")).filter(Boolean);
    appliquer();
    majCompteur();
  }

  function demarrer() {
    installerBoutons();
    if (window.Quiz && typeof Quiz.donnees === "function" && Quiz.donnees()) charger(Quiz.donnees());
    else appliquer();                          // mots ajoutés seulement, en attendant le JSON
    document.addEventListener("quiz:charge", () => charger(window.Quiz && Quiz.donnees()));
  }

  window.Vocabulaire = {
    liste: () => liste(),
    appliquer,
    ouvrir: () => ouvrirFenetre(false)
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();

})();
