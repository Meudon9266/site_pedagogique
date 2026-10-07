/* =====================================================
   Partage.Editeur.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.Editeur.js (prioritaire)

   Éditeur des questions de quiz, chargé par Partage.editeur.html
   (un seul éditeur pour tous les exercices du dossier)
   - quel exercice ? la racine est trouvée, dans l'ordre :
       1) dans l'adresse :  Partage.editeur.html?Anna9H
                       ou   Partage.editeur.html?ex=Anna9H
       2) sinon dans le nom de la page (copie renommée Anna9H.editeur.html)
       3) sinon en choisissant le fichier : Anna9H.json → racine Anna9H
     → édite Anna9H.json, lien vers Anna9H.html
   - chargement automatique de NomdeRef.json ; si impossible
     (ouverture locale), un bouton de chargement manuel apparaît,
     masqué dès que le fichier est chargé
   - enregistrement : directement dans le fichier quand le navigateur
     le permet (Chrome, Edge), sinon téléchargement de NomdeRef.json
   - brouillon automatique dans le navigateur (rien n'est perdu
     si la page se ferme avant l'enregistrement)
   - aperçu élève : utilise le vrai module Quiz (Partage.Quiz.js)
   - écoute 🔊 : utilise AudioDE (Partage.AudioDe.js) s'il est chargé

   Format du JSON : voir Partage.Quiz.js (les champs inconnus
   d'une question sont conservés tels quels).
   ===================================================== */

(function () {
  "use strict";

  /* ===============================
     1. NOMS RECONSTRUITS
     =============================== */
  const fichierPage = decodeURIComponent(location.pathname.split("/").pop() || "");
  const racinePage = fichierPage.split(".")[0] || "index";

  // adresse : ?../Anna9H  ou  ?ex=../Anna9H  (chemin de l'exercice depuis le dossier de l'éditeur)
  function cheminDepuisAdresse() {
    const q = location.search.replace(/^\?/, "");
    if (!q) return null;
    const p = new URLSearchParams(q);
    let r = p.get("ex") || p.get("exercice");
    if (!r && !q.includes("=")) r = decodeURIComponent(q);
    return r ? r.trim() : null;
  }
  const cheminAdresse = cheminDepuisAdresse();

  // dossier de l'exercice, vu depuis l'éditeur :
  // chemin de l'adresse ; sinon, si l'éditeur est dans PartageLectureAudio, le dossier parent
  const dossierPage = decodeURIComponent(location.pathname.split("/").slice(-2, -1)[0] || "");
  let DOSSIER = cheminAdresse
    ? cheminAdresse.slice(0, cheminAdresse.lastIndexOf("/") + 1)
    : (dossierPage === "PartageLectureAudio" ? "../" : "");
  const racineAdresse = cheminAdresse ? cheminAdresse.slice(cheminAdresse.lastIndexOf("/") + 1).split(".")[0] : "";

  // null = aucun exercice choisi pour l'instant (Partage.editeur.html sans adresse)
  let RACINE = racineAdresse || (racinePage === "Partage" ? null : racinePage);
  const nomJSON = () => RACINE + ".json";
  const nomExercice = () => RACINE + ".html";
  const cheminJSON = () => DOSSIER + nomJSON();          // lecture automatique du JSON
  const cheminExercice = () => DOSSIER + nomExercice();  // lien « Ouvrir l'exercice »
  const cleBrouillon = () => RACINE + "::editeur::brouillon";

  function choisirRacine(r) {
    RACINE = r;
    document.title = "Éditeur – " + RACINE;
    const titre = document.getElementById("ed-titre-fichier");
    if (titre) titre.textContent = "— " + nomJSON();
    const lien = document.getElementById("ed-lien-exercice");
    if (lien) {
      lien.href = encodeURI(cheminExercice());
      lien.textContent = "▶ Ouvrir " + nomExercice();
      lien.hidden = false;
    }
    const bouton = document.getElementById("ed-bouton-charger");
    if (bouton) bouton.textContent = "📂 Charger " + nomJSON();
    if (racinePage === "Partage") {
      try { history.replaceState(null, "", "?" + encodeURI(DOSSIER + RACINE)); } catch (e) { /* file:// */ }
    }
  }

  /* ===============================
     2. TYPES DE QUIZ (mêmes valeurs par défaut que Partage.Quiz.js)
     =============================== */
  const TYPES = {
    1: { cle: "quizcomp", bouton: "QCM",
         titre: "🎧 Questions à choix multiple",
         consigne: "Écoute la question et coche la bonne réponse.", melange: "non",
         aide: "QCM écrit : l'élève écoute la question et coche une proposition écrite. Plutôt pour la compréhension orale." },
    2: { cle: "quizvoc", bouton: "QCM à l'oral",
         titre: "🔊 Choix à l'oral",
         consigne: "Écoute la question, puis chaque proposition, et clique sur la bonne réponse.",
         melange: "jamaisPremiere",
         aide: "QCM à l'oral : les propositions s'écoutent, elles ne sont pas écrites. Plutôt pour la définition d'un mot ou une information demandée." },
    3: { cle: "qmd", bouton: "Menus",
         titre: "📋 Choisis la bonne forme",
         consigne: "Choisis la bonne réponse dans chaque menu.", melange: "non",
         aide: "Menus déroulants dans une phrase. Plutôt pour la structure de la langue : conjugaison, grammaire." },
    4: { cle: "qchi", bouton: "Réponses libres",
         titre: "✍️ Réponses libres",
         consigne: "Écris ta réponse, ou complète le texte.",
         aide: "Réponses libres : réponse écrite à une question, ou texte à trous à compléter." }
  };
  const NUMEROS = [1, 2, 3, 4];

  function libelle(n) {
    const r = donnees && donnees.quiz && donnees.quiz[n];
    return (r && String(r.bouton || "").trim()) || TYPES[n].bouton;
  }
  const PREFIXES = { 1: "c", 2: "v", 3: "g", 4: "e" };

  const MELANGES = [
    ["non", "Ordre du fichier"],
    ["oui", "Ordre aléatoire"],
    ["jamaisPremiere", "Aléatoire, bonne réponse jamais en 1re position"]
  ];
  const VOIX = [
    ["", "Voix par défaut (Katja)"],
    ["Katja", "Katja"],
    ["KatjaM", "KatjaM (jeune)"],
    ["KatjaN", "KatjaN (narratrice)"],
    ["KatjaRapide", "KatjaRapide"],
    ["Conrad", "Conrad"]
  ];

  /* ===============================
     3. ÉTAT
     =============================== */
  let donnees = null;          // contenu du JSON en cours d'édition
  let filtre = "tous";         // "tous" | 1..4 | "erreurs"
  let modifie = false;
  let poignee = null;          // fichier choisi pour l'enregistrement direct
  let apercuActif = null;      // numéro du quiz affiché en aperçu
  let derniereSuppression = null;
  const cartes = new Map();    // question → élément de la carte
  let compteurUid = 0;

  /* ===============================
     4. OUTILS
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

  function uid() { return "ed" + (++compteurUid); }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* indisponible */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* indisponible */ } }

  function parler(texte, voix) {
    texte = String(texte || "").trim();
    if (!texte) return;
    if (window.AudioDE && typeof AudioDE.parler === "function") {
      AudioDE.parler(texte, voix || "Katja");
    } else if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = "de-DE";
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }

  function types(q) {
    return [].concat(q.quiz === undefined || q.quiz === null ? [] : q.quiz)
      .map(Number).filter(n => TYPES[n]);
  }

  function setTypes(q, liste) {
    liste = [...new Set(liste)].sort();
    q.quiz = liste.length === 1 ? liste[0] : liste;
  }

  function idUnique(prefixe) {
    const ids = new Set(donnees.questions.map(q => String(q.id)));
    let i = 1;
    while (ids.has(prefixe + i)) i++;
    return prefixe + i;
  }

  /* ===============================
     5. PHRASES À TROUS (même syntaxe que Partage.Quiz.js)
        "Es [*regnet|regnen] den ganzen Tag."
     =============================== */
  function analyserTrous(texte) {
    const morceaux = [];
    const re = /\[([^\]]+)\]/g;
    let dernier = 0, m;
    while ((m = re.exec(texte)) !== null) {
      if (m.index > dernier) morceaux.push({ texte: texte.slice(dernier, m.index) });
      const brut = m[1].split("|").map(s => s.trim());
      let bonne = brut.findIndex(s => s.startsWith("*"));
      if (bonne < 0) bonne = 0;
      morceaux.push({ options: brut.map(s => s.replace(/^\*/, "")), bonne });
      dernier = re.lastIndex;
    }
    if (dernier < texte.length) morceaux.push({ texte: texte.slice(dernier) });
    return morceaux;
  }

  function aDesTrous(q) {
    return typeof q.texte === "string" && /\[[^\]]*\]/.test(q.texte);
  }

  /* ===============================
     6. VÉRIFICATIONS
     renvoie null si la question est utilisable dans le quiz n,
     sinon un message court
     =============================== */
  function verifQCM(q) {
    const p = Array.isArray(q.propositions) ? q.propositions : [];
    if (p.length < 2) return "il faut au moins 2 propositions";
    if (p.some(s => !String(s).trim())) return "une proposition est vide";
    if (!Number.isInteger(q.bonne) || q.bonne < 0 || q.bonne >= p.length) return "bonne réponse non choisie";
    return null;
  }

  function verifTrous(t) {
    const ouv = (t.match(/\[/g) || []).length;
    const ferm = (t.match(/\]/g) || []).length;
    if (ouv !== ferm) return "crochets [ ] mal fermés";
    if (/\[\s*\]/.test(t)) return "un trou est vide : [ ]";
    const trous = analyserTrous(t).filter(m => m.options);
    for (let i = 0; i < trous.length; i++) {
      const o = trous[i].options;
      if (o.length < 2) return `trou ${i + 1} : il faut au moins 2 choix séparés par |`;
      if (o.some(s => !s)) return `trou ${i + 1} : un choix est vide`;
    }
    return null;
  }

  function verifier(q, n) {
    const question = String(q.question || "").trim();
    if (n === 1 || n === 2) {
      return verifQCM(q) || (!question ? "question vide" : null);
    }
    if (n === 3) {
      if (aDesTrous(q)) return verifTrous(q.texte);
      if (String(q.texte || "").trim()) return "la phrase n'a aucun trou [ ]";
      const m = verifQCM(q);
      if (m) return "phrase à trous vide";
      return !question ? "question vide" : null;
    }
    if (n === 4) {
      const libre = String(q.texteLibre || "").trim();
      if (libre) {
        if (!/\[[^\]]*\]/.test(libre)) return "le texte à compléter n'a aucun trou [ ]";
        const ouv = (libre.match(/\[/g) || []).length, ferm = (libre.match(/\]/g) || []).length;
        if (ouv !== ferm) return "crochets [ ] mal fermés";
        if (/\[\s*\]/.test(libre)) return "un trou est vide : [ ]";
        return null;
      }
      const r = (q.reponses || []).filter(s => String(s).trim());
      if (!r.length && verifQCM(q)) return "aucune réponse acceptée ni texte à compléter";
      return !question ? "question vide" : null;
    }
    return null;
  }

  function problemes(q) {
    const liste = [];
    const t = types(q);
    const id = String(q.id === undefined ? "" : q.id).trim();
    if (!id) liste.push("identifiant vide");
    else if (donnees.questions.filter(x => String(x.id).trim() === id).length > 1) liste.push("identifiant en double");
    if (!t.length) liste.push("cette question n'apparaît dans aucun quiz");
    return liste;
  }

  function aDesProblemes(q) {
    return problemes(q).length > 0 || types(q).some(n => verifier(q, n));
  }

  /* ===============================
     7. ENREGISTREMENT DU JSON
     Une question par ligne : lisible et facile à comparer.
     =============================== */
  const ORDRE_CHAMPS = ["id", "quiz", "question", "texte", "texteLibre", "propositions", "bonne", "reponses", "voix"];

  function nettoyer(q) {
    const o = Object.assign({}, q);
    if (typeof o.id === "string") o.id = o.id.trim();
    if (typeof o.question === "string") { o.question = o.question.trim(); if (!o.question) delete o.question; }
    if (typeof o.texte === "string") { o.texte = o.texte.trim(); if (!o.texte) delete o.texte; }
    if (typeof o.texteLibre === "string") { o.texteLibre = o.texteLibre.trim(); if (!o.texteLibre) delete o.texteLibre; }
    if (Array.isArray(o.propositions)) {
      o.propositions = o.propositions.map(x => String(x).trim());
      if (o.propositions.every(x => !x)) { delete o.propositions; delete o.bonne; }
    } else {
      delete o.bonne;
    }
    if (Array.isArray(o.reponses)) {
      o.reponses = o.reponses.map(x => String(x).trim()).filter(Boolean);
      if (!o.reponses.length) delete o.reponses;
    }
    if (!o.voix) delete o.voix;

    const r = {};
    ORDRE_CHAMPS.forEach(k => { if (k in o) r[k] = o[k]; });
    Object.keys(o).forEach(k => { if (!(k in r)) r[k] = o[k]; });
    return r;
  }

  function serialiser(d) {
    const parties = [];
    Object.keys(d).forEach(k => {
      if (k === "questions") return;
      parties.push("  " + JSON.stringify(k) + ": " + JSON.stringify(d[k], null, 2).replace(/\n/g, "\n  "));
    });
    const qs = d.questions.map(q => "    " + JSON.stringify(nettoyer(q)));
    parties.push('  "questions": [' + (qs.length ? "\n" + qs.join(",\n") + "\n  " : "") + "]");
    return "{\n" + parties.join(",\n") + "\n}\n";
  }

  async function enregistrer() {
    if (!donnees) return;
    const texte = serialiser(donnees);

    if (typeof window.showSaveFilePicker === "function") {
      try {
        if (!poignee) {
          poignee = await window.showSaveFilePicker({
            suggestedName: nomJSON(),
            types: [{ description: "Questions (JSON)", accept: { "application/json": [".json"] } }]
          });
        }
        const w = await poignee.createWritable();
        await w.write(texte);
        await w.close();
        apresEnregistrement(
          poignee.name === nomJSON()
            ? "✔ Enregistré dans " + poignee.name
            : "⚠ Enregistré sous " + poignee.name + " : l'exercice attend " + nomJSON()
        );
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;   // l'utilisateur a annulé
        console.warn("[Éditeur] enregistrement direct impossible → téléchargement", e);
        poignee = null;
      }
    }

    telecharger(texte);
    apresEnregistrement("✔ " + nomJSON() + " téléchargé : place-le dans le dossier de l'exercice (remplace l'ancien).");
  }

  function telecharger(texte) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
    a.download = nomJSON();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function apresEnregistrement(message) {
    modifie = false;
    lsDel(cleBrouillon());
    majStatut(message);
    notifier(message);
  }

  /* ===============================
     8. BROUILLON AUTOMATIQUE
     =============================== */
  let minuterieBrouillon = null;

  function ecrireBrouillon() {
    clearTimeout(minuterieBrouillon);
    if (!donnees || !modifie || !RACINE) return;
    lsSet(cleBrouillon(), JSON.stringify({ date: Date.now(), json: serialiser(donnees) }));
  }

  function sauverBrouillon() {
    clearTimeout(minuterieBrouillon);
    minuterieBrouillon = setTimeout(ecrireBrouillon, 250);
  }

  function verifierBrouillon(reference) {
    const zone = $("ed-brouillon");
    let b = null;
    try { b = JSON.parse(lsGet(cleBrouillon()) || "null"); } catch (e) { b = null; }
    if (!b || !b.json || b.json === reference) {
      lsDel(cleBrouillon());
      zone.hidden = true;
      return;
    }
    const date = new Date(b.date).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" });
    zone.textContent = "";
    zone.appendChild(el("span", { text: "📝 Des modifications non enregistrées du " + date + " ont été retrouvées. " }));
    zone.appendChild(el("button", {
      type: "button", class: "ed-btn ed-btn-principal",
      onclick: () => {
        try {
          ouvrirDonnees(JSON.parse(b.json), "brouillon du " + date, true);
          modifie = true;
          majStatut();
          sauverBrouillon();
        } catch (e) {
          notifier("Brouillon illisible.");
        }
        zone.hidden = true;
      }
    }, "Restaurer le brouillon"));
    zone.appendChild(el("button", {
      type: "button", class: "ed-btn",
      onclick: () => { lsDel(cleBrouillon()); zone.hidden = true; }
    }, "Ignorer"));
    zone.hidden = false;
  }

  /* ===============================
     9. MODIFICATIONS
     =============================== */
  function changement(q, structure, apres) {
    modifie = true;
    majStatut();
    sauverBrouillon();
    if (structure === "liste") rendreListe();
    else if (q && structure) majCarte(q, apres);
    else if (q) majEtat(q);
    rendreFiltres();
    planifierApercu();
  }

  function majStatut(message) {
    const s = $("ed-statut");
    if (!s) return;
    if (message) { s.textContent = message; s.className = "ed-statut"; return; }
    if (!donnees) { s.textContent = "Aucun fichier chargé"; s.className = "ed-statut"; return; }
    if (modifie) { s.textContent = "● Modifications non enregistrées"; s.className = "ed-statut ed-statut-modifie"; }
  }

  /* ===============================
     10. CARTE D'UNE QUESTION
     =============================== */
  function preparerChamps(q) {
    const t = types(q);
    if ((t.includes(1) || t.includes(2)) && !Array.isArray(q.propositions)) {
      q.propositions = ["", "", ""];
    }
    if (Array.isArray(q.propositions) && !Number.isInteger(q.bonne)) q.bonne = 0;
    if (t.includes(3) && typeof q.texte !== "string" && !Array.isArray(q.propositions)) q.texte = "";
    if (t.includes(4) && !Array.isArray(q.reponses) && typeof q.texteLibre !== "string") q.reponses = [""];
  }

  function visibles() {
    if (filtre === "tous") return donnees.questions.slice();
    if (filtre === "erreurs") return donnees.questions.filter(aDesProblemes);
    return donnees.questions.filter(q => types(q).includes(filtre));
  }

  function rendreCarte(q) {
    const t = types(q);
    const position = donnees.questions.indexOf(q) + 1;
    const carte = el("article", { class: "ed-carte" });

    /* ---- ligne du haut : n°, identifiant, quiz, voix, actions ---- */
    const idInput = el("input", {
      type: "text", class: "ed-id", value: q.id === undefined ? "" : String(q.id),
      "aria-label": "Identifiant de la question", title: "Identifiant (unique)"
    });
    idInput.addEventListener("input", () => { q.id = idInput.value.trim(); changement(q); });

    const typesBox = el("div", { class: "ed-types", role: "group", "aria-label": "Quiz où figure la question" },
      NUMEROS.map(n => {
        const cb = el("input", { type: "checkbox", checked: t.includes(n) });
        cb.addEventListener("change", () => {
          const l = types(q).filter(x => x !== n);
          if (cb.checked) l.push(n);
          setTypes(q, l);
          preparerChamps(q);
          changement(q, true);
        });
        return el("label", { class: "ed-type ed-type-" + n, title: TYPES[n].aide }, cb, " " + n + " " + libelle(n));
      })
    );

    const voixSel = el("select", { class: "ed-voix", "aria-label": "Voix de la question", title: "Voix qui lit la question" },
      VOIX.map(([v, lib]) => el("option", { value: v, text: lib })));
    voixSel.value = q.voix || "";
    voixSel.addEventListener("change", () => { q.voix = voixSel.value; changement(q); });

    const actions = el("div", { class: "ed-actions" },
      el("button", { type: "button", class: "ed-mini", title: "Monter", onclick: () => deplacer(q, -1) }, "↑"),
      el("button", { type: "button", class: "ed-mini", title: "Descendre", onclick: () => deplacer(q, 1) }, "↓"),
      el("button", { type: "button", class: "ed-mini", title: "Dupliquer", onclick: () => dupliquer(q) }, "⧉"),
      el("button", { type: "button", class: "ed-mini ed-danger", title: "Supprimer", onclick: () => supprimer(q) }, "🗑")
    );

    carte.appendChild(el("div", { class: "ed-carte-haut" },
      el("span", { class: "ed-num", text: "#" + position }), idInput, typesBox, voixSel, actions));

    /* ---- question lue ---- */
    const qInput = el("input", {
      type: "text", class: "ed-champ", lang: "de", value: q.question || "",
      placeholder: t.length === 1 && t[0] === 3 ? "(facultatif pour une phrase à trous)" : "Wie heißt das Mädchen?"
    });
    qInput.addEventListener("input", () => { q.question = qInput.value; changement(q); });
    carte.appendChild(el("div", { class: "ed-bloc" },
      el("label", { class: "ed-label" }, "Question (lue à voix haute)"),
      el("div", { class: "ed-ligne" }, qInput,
        el("button", { type: "button", class: "ed-mini", title: "Écouter la question",
          onclick: () => parler(q.question, q.voix) }, "🔊"))
    ));

    /* ---- blocs selon les quiz ---- */
    const avecPropositions = t.includes(1) || t.includes(2) ||
      (t.includes(3) && Array.isArray(q.propositions) && !String(q.texte || "").trim());
    if (avecPropositions) carte.appendChild(blocPropositions(q));
    if (t.includes(3)) carte.appendChild(blocTrous(q));
    if (t.includes(4)) {
      carte.appendChild(blocReponses(q));
      carte.appendChild(blocTexteLibre(q));
    }

    /* ---- état ---- */
    carte.appendChild(el("div", { class: "ed-etat", "aria-live": "polite" }));

    cartes.set(q, carte);
    remplirEtat(q, carte);
    return carte;
  }

  function blocPropositions(q) {
    if (!Array.isArray(q.propositions)) q.propositions = ["", "", ""];
    if (!Number.isInteger(q.bonne)) q.bonne = 0;
    const nom = uid();
    const bloc = el("div", { class: "ed-bloc" },
      el("div", { class: "ed-label" }, "Propositions — coche la bonne réponse"));

    q.propositions.forEach((p, i) => {
      const radio = el("input", { type: "radio", name: nom, checked: q.bonne === i, title: "Bonne réponse", "aria-label": "Bonne réponse : proposition " + (i + 1) });
      radio.addEventListener("change", () => { q.bonne = i; changement(q, true); });
      const inp = el("input", { type: "text", class: "ed-champ", lang: "de", value: p, placeholder: "Proposition " + (i + 1) });
      inp.addEventListener("input", () => { q.propositions[i] = inp.value; changement(q); });
      bloc.appendChild(el("div", { class: "ed-ligne" + (q.bonne === i ? " ed-bonne" : "") },
        radio, inp,
        el("button", { type: "button", class: "ed-mini", title: "Écouter", onclick: () => parler(q.propositions[i], q.voix) }, "🔊"),
        el("button", { type: "button", class: "ed-mini", title: "Supprimer cette proposition",
          onclick: () => {
            q.propositions.splice(i, 1);
            if (q.bonne === i) q.bonne = 0;
            else if (q.bonne > i) q.bonne--;
            changement(q, true);
          } }, "✕")
      ));
    });

    bloc.appendChild(el("button", {
      type: "button", class: "ed-ajout",
      onclick: () => {
        q.propositions.push("");
        changement(q, true, c => {
          const champs = c.querySelectorAll(".ed-bloc-prop .ed-champ");
          if (champs.length) champs[champs.length - 1].focus();
        });
      }
    }, "+ proposition"));
    bloc.classList.add("ed-bloc-prop");
    return bloc;
  }

  function blocTrous(q) {
    const ta = el("textarea", {
      class: "ed-champ ed-trous", rows: 2, lang: "de", spellcheck: "false",
      placeholder: "Es [*regnet|regnen|regne] den ganzen Tag."
    });
    ta.value = typeof q.texte === "string" ? q.texte : "";
    const apercu = el("div", { class: "ed-trous-apercu" });

    function majTrous() {
      apercu.textContent = "";
      const trous = analyserTrous(ta.value).filter(m => m.options);
      if (!trous.length) {
        apercu.appendChild(el("span", { class: "ed-discret", text: "Aucun trou pour l'instant." }));
        return;
      }
      trous.forEach((tr, k) => {
        const ligne = el("div", { class: "ed-trou" }, el("strong", { text: "Menu " + (k + 1) + " : " }));
        tr.options.forEach((o, i) => {
          if (i) ligne.appendChild(document.createTextNode(" · "));
          ligne.appendChild(el("span", { class: i === tr.bonne ? "ed-trou-bonne" : "", text: (i === tr.bonne ? "✔ " : "") + (o || "(vide)") }));
        });
        apercu.appendChild(ligne);
      });
    }

    ta.addEventListener("input", () => { q.texte = ta.value; majTrous(); changement(q); });

    const btnTrou = el("button", {
      type: "button", class: "ed-ajout",
      title: "Sélectionne un mot dans la phrase, puis clique : il devient la bonne réponse d'un menu",
      onclick: () => {
        const a = ta.selectionStart, b = ta.selectionEnd;
        const sel = ta.value.slice(a, b).trim();
        const insertion = "[*" + (sel || "bonne") + "|]";
        ta.setRangeText(insertion, a, b, "end");
        const curseur = a + insertion.length - 1;   // juste avant ]
        ta.focus();
        ta.setSelectionRange(curseur, curseur);
        q.texte = ta.value;
        majTrous();
        changement(q);
      }
    }, "⊕ Faire un menu avec le mot sélectionné");

    majTrous();
    return el("div", { class: "ed-bloc" },
      el("label", { class: "ed-label" }, "Phrase à trous (quiz 3)"),
      ta,
      el("div", { class: "ed-ligne ed-ligne-aide" }, btnTrou,
        el("span", { class: "ed-discret" },
          "Choix entre crochets, séparés par | ; l'astérisque * marque la bonne réponse. Ex. : Ich [*heiße|heißt|heißen] Anna.")),
      apercu
    );
  }

  function blocTexteLibre(q) {
    const ta = el("textarea", {
      class: "ed-champ ed-trous", rows: 2, lang: "de", spellcheck: "false",
      placeholder: "Ich [heiße] Anna. Ich bin [elf|11] Jahre alt."
    });
    ta.value = typeof q.texteLibre === "string" ? q.texteLibre : "";
    const apercu = el("div", { class: "ed-trous-apercu" });

    function majTrous() {
      apercu.textContent = "";
      const trous = analyserTrous(ta.value).filter(m => m.options);
      if (!trous.length) {
        apercu.appendChild(el("span", { class: "ed-discret", text: "Pas de texte à compléter : la question et les réponses acceptées ci-dessus sont utilisées." }));
        return;
      }
      trous.forEach((tr, k) => {
        apercu.appendChild(el("div", { class: "ed-trou" },
          el("strong", { text: "Trou " + (k + 1) + " : " }),
          el("span", { class: "ed-trou-bonne", text: tr.options[tr.bonne] || "(vide)" }),
          tr.options.length > 1 ? el("span", { class: "ed-discret", text: "  — accepté aussi : " +
            tr.options.filter((o, i) => i !== tr.bonne).join(" · ") }) : null));
      });
    }

    ta.addEventListener("input", () => { q.texteLibre = ta.value; majTrous(); changement(q); });

    const btnTrou = el("button", {
      type: "button", class: "ed-ajout",
      title: "Sélectionne un mot : il devient un trou que l'élève devra écrire",
      onclick: () => {
        const a = ta.selectionStart, b = ta.selectionEnd;
        const sel = ta.value.slice(a, b).trim();
        const insertion = "[" + (sel || "réponse") + "]";
        ta.setRangeText(insertion, a, b, "end");
        const curseur = a + insertion.length - 1;   // juste avant ] : on peut ajouter |variante
        ta.focus();
        ta.setSelectionRange(curseur, curseur);
        q.texteLibre = ta.value;
        majTrous();
        changement(q);
      }
    }, "⊕ Faire un trou avec le mot sélectionné");

    majTrous();
    return el("div", { class: "ed-bloc" },
      el("label", { class: "ed-label" }, "Ou : texte à trous à compléter (quiz 4)"),
      ta,
      el("div", { class: "ed-ligne ed-ligne-aide" }, btnTrou,
        el("span", { class: "ed-discret" },
          "Mot attendu entre crochets ; variantes acceptées séparées par |. Ex. : Ich bin [elf|11] Jahre alt. S'il est rempli, ce texte remplace les réponses ci-dessus.")),
      apercu
    );
  }

  function blocReponses(q) {
    if (!Array.isArray(q.reponses)) q.reponses = [""];
    const bloc = el("div", { class: "ed-bloc ed-bloc-rep" },
      el("div", { class: "ed-label" }, "Réponses acceptées à la question (quiz 4)"));

    q.reponses.forEach((r, i) => {
      const inp = el("input", { type: "text", class: "ed-champ", lang: "de", value: r,
        placeholder: i === 0 ? "Anna" : "Sie heißt Anna Müller" });
      inp.addEventListener("input", () => { q.reponses[i] = inp.value; changement(q); });
      bloc.appendChild(el("div", { class: "ed-ligne" + (i === q.reponses.length - 1 ? " ed-modele" : "") },
        inp,
        el("button", { type: "button", class: "ed-mini", title: "Écouter", onclick: () => parler(q.reponses[i], q.voix) }, "🔊"),
        el("button", { type: "button", class: "ed-mini", title: "Supprimer cette réponse",
          onclick: () => { q.reponses.splice(i, 1); changement(q, true); } }, "✕")
      ));
    });

    bloc.appendChild(el("div", { class: "ed-ligne ed-ligne-aide" },
      el("button", {
        type: "button", class: "ed-ajout",
        onclick: () => {
          q.reponses.push("");
          changement(q, true, c => {
            const champs = c.querySelectorAll(".ed-bloc-rep .ed-champ");
            if (champs.length) champs[champs.length - 1].focus();
          });
        }
      }, "+ réponse"),
      el("span", { class: "ed-discret",
        text: "Majuscules, espaces et ponctuation ne comptent pas. La dernière réponse (encadrée) est montrée comme modèle après correction." })
    ));
    return bloc;
  }

  function remplirEtat(q, carte) {
    const zone = carte.querySelector(".ed-etat");
    zone.textContent = "";
    let erreur = false;
    problemes(q).forEach(p => {
      erreur = true;
      zone.appendChild(el("span", { class: "ed-pastille ed-pastille-alerte", text: "⚠ " + p }));
    });
    types(q).forEach(n => {
      const m = verifier(q, n);
      if (m) erreur = true;
      zone.appendChild(el("span", {
        class: "ed-pastille " + (m ? "ed-pastille-alerte" : "ed-pastille-ok"),
        text: (m ? "⚠ " : "✔ ") + n + " " + libelle(n) + (m ? " : " + m : "")
      }));
    });
    carte.classList.toggle("ed-carte-erreur", erreur);
  }

  function majEtat(q) {
    const c = cartes.get(q);
    if (c) remplirEtat(q, c);
    // un identifiant modifié peut créer ou lever un doublon ailleurs
    cartes.forEach((carte, autre) => { if (autre !== q) remplirEtat(autre, carte); });
  }

  function majCarte(q, apres) {
    const ancienne = cartes.get(q);
    if (!ancienne) return rendreListe();
    const nouvelle = rendreCarte(q);
    ancienne.replaceWith(nouvelle);
    if (typeof apres === "function") apres(nouvelle);
    return nouvelle;
  }

  /* ===============================
     11. LISTE, FILTRES, ACTIONS
     =============================== */
  function rendreListe() {
    const liste = $("ed-liste");
    liste.textContent = "";
    cartes.clear();
    const vis = visibles();
    if (!vis.length) {
      liste.appendChild(el("p", { class: "ed-vide",
        text: filtre === "erreurs" ? "Aucune question à corriger. 👍" : "Aucune question ici pour l'instant." }));
    }
    vis.forEach(q => liste.appendChild(rendreCarte(q)));
  }

  function rendreFiltres() {
    const f = $("ed-filtres");
    if (!f || !donnees) return;
    f.textContent = "";
    const qs = donnees.questions;
    const items = [["tous", "Toutes", qs.length, 0]];
    NUMEROS.forEach(n => {
      const dans = qs.filter(q => types(q).includes(n));
      items.push([n, n + " · " + libelle(n), dans.length, dans.filter(q => verifier(q, n)).length]);
    });
    items.push(["erreurs", "⚠ À corriger", qs.filter(aDesProblemes).length, 0]);

    items.forEach(([cle, lib, nb, nbErr]) => {
      const b = el("button", {
        type: "button",
        class: "ed-filtre" + (filtre === cle ? " actif" : "") + (typeof cle === "number" ? " ed-filtre-" + cle : ""),
        "aria-pressed": filtre === cle ? "true" : "false",
        onclick: () => { filtre = cle; rendreFiltres(); rendreListe(); }
      }, lib + " ", el("span", { class: "ed-compte", text: String(nb) }));
      if (nbErr) b.appendChild(el("span", { class: "ed-compte ed-compte-alerte", text: "⚠ " + nbErr }));
      f.appendChild(b);
    });
  }

  function deplacer(q, sens) {
    const vis = visibles();
    const k = vis.indexOf(q);
    const autre = vis[k + sens];
    if (!autre) return;
    const A = donnees.questions;
    const i = A.indexOf(q), j = A.indexOf(autre);
    [A[i], A[j]] = [A[j], A[i]];
    changement(null, "liste");
    const c = cartes.get(q);
    if (c) c.scrollIntoView({ block: "nearest" });
  }

  function dupliquer(q) {
    const copie = JSON.parse(JSON.stringify(q));
    copie.id = idUnique(PREFIXES[types(q)[0]] || "q");
    const A = donnees.questions;
    A.splice(A.indexOf(q) + 1, 0, copie);
    changement(null, "liste");
    const c = cartes.get(copie);
    if (c) { c.scrollIntoView({ block: "center" }); c.classList.add("ed-flash"); }
  }

  function supprimer(q) {
    const A = donnees.questions;
    const i = A.indexOf(q);
    if (i < 0) return;
    A.splice(i, 1);
    derniereSuppression = { q, i };
    changement(null, "liste");
    notifier("Question « " + (q.id || "sans identifiant") + " » supprimée.", "Annuler", () => {
      if (!derniereSuppression) return;
      donnees.questions.splice(derniereSuppression.i, 0, derniereSuppression.q);
      derniereSuppression = null;
      changement(null, "liste");
    });
  }

  function ajouterQuestion(n) {
    n = TYPES[n] ? n : 1;
    const q = { id: idUnique(PREFIXES[n]), quiz: n, question: "" };
    preparerChamps(q);
    donnees.questions.push(q);
    if (filtre !== "tous" && filtre !== n) filtre = n;
    changement(null, "liste");
    const c = cartes.get(q);
    if (c) {
      c.scrollIntoView({ block: "center" });
      c.classList.add("ed-flash");
      const champ = c.querySelector(n === 3 ? "textarea" : ".ed-champ");
      if (champ) champ.focus();
    }
  }

  function ajouterPlusieurs(texte, liste) {
    if (!liste.length) liste = [1];
    const lignes = String(texte).split(/\r?\n/)
      .map(l => l.replace(/^\s*(?:[*\-•–]|\d+\s*[.)])\s*/, "").trim())
      .filter(Boolean);
    lignes.forEach(l => {
      const q = { id: idUnique(PREFIXES[liste[0]]), question: l };
      setTypes(q, liste);
      preparerChamps(q);
      donnees.questions.push(q);
    });
    if (lignes.length) {
      filtre = liste.length === 1 ? liste[0] : "tous";
      changement(null, "liste");
      notifier(lignes.length + " question(s) ajoutée(s). Complète maintenant les réponses (⚠).");
    }
    return lignes.length;
  }

  /* ===============================
     12. RÉGLAGES DES QUIZ
     =============================== */
  function reglage(n) {
    return (donnees.quiz && donnees.quiz[n]) || {};
  }

  function setReglage(n, cle, valeur) {
    donnees.quiz = donnees.quiz || {};
    const o = donnees.quiz[n] = donnees.quiz[n] || {};
    if (valeur === "" || valeur === undefined || valeur === null || valeur === false) delete o[cle];
    else o[cle] = valeur;
    if (!Object.keys(o).length) delete donnees.quiz[n];
    if (!Object.keys(donnees.quiz).length) delete donnees.quiz;
    if (cle === "bouton") {
      changement(null, "liste");
      document.querySelectorAll(".ed-apercu-btn").forEach(b => { b.textContent = b.dataset.n + " " + libelle(Number(b.dataset.n)); });
    } else {
      changement(null);
    }
  }

  function rendreReglages() {
    const grille = $("ed-reglages-grille");
    grille.textContent = "";
    NUMEROS.forEach(n => {
      const r = reglage(n);
      const d = TYPES[n];

      const bouton = el("input", { type: "text", class: "ed-champ", value: r.bouton || "", placeholder: d.bouton });
      bouton.addEventListener("input", () => setReglage(n, "bouton", bouton.value.trim()));
      bouton.addEventListener("change", () => { rendreReglages(); });

      const titre = el("input", { type: "text", class: "ed-champ", value: r.titre || "", placeholder: d.titre });
      titre.addEventListener("input", () => setReglage(n, "titre", titre.value.trim()));

      const consigne = el("textarea", { class: "ed-champ", rows: 2, placeholder: d.consigne });
      consigne.value = r.consigne || "";
      consigne.addEventListener("input", () => setReglage(n, "consigne", consigne.value.trim()));

      const carte = el("div", { class: "ed-reglage ed-reglage-" + n },
        el("h3", { text: n + " · " + libelle(n) }),
        el("p", { class: "ed-discret", text: d.aide }),
        el("label", { class: "ed-label" }, "Libellé du bouton (générique)", bouton),
        el("label", { class: "ed-label" }, "Titre du quiz", titre),
        el("label", { class: "ed-label" }, "Consigne", consigne)
      );

      if (n !== 4) {
        const defaut = MELANGES.find(m => m[0] === d.melange)[1];
        const sel = el("select", { class: "ed-champ" },
          el("option", { value: "", text: "Par défaut : " + defaut }),
          MELANGES.map(([v, lib]) => el("option", { value: v, text: lib })));
        sel.value = r.melange || "";
        sel.addEventListener("change", () => setReglage(n, "melange", sel.value));
        carte.appendChild(el("label", { class: "ed-label" }, "Ordre des propositions", sel));
      } else {
        const cb = el("input", { type: "checkbox", checked: r.casseStricte === true });
        cb.addEventListener("change", () => setReglage(n, "casseStricte", cb.checked));
        carte.appendChild(el("label", { class: "ed-case" }, cb, " Les majuscules comptent dans la correction"));
      }
      grille.appendChild(carte);
    });
  }

  /* ===============================
     12 bis. PAGE DE PRISE DE NOTES (bloc "fiche" du JSON)
     =============================== */
  function fiche() {
    return (donnees && donnees.fiche && typeof donnees.fiche === "object") ? donnees.fiche : null;
  }

  function ficheModifiee(structure) {
    const f = fiche();
    if (f) {
      ["titre", "consigne"].forEach(k => { if (f[k] === "") delete f[k]; });
      if (Array.isArray(f.rubriques) && !f.rubriques.length) delete f.rubriques;
      if (!Object.keys(f).length) delete donnees.fiche;
    }
    changement(null);
    if (structure) rendreFiche();
    else majResumeFiche();
  }

  function setFiche(cle, valeur) {
    donnees.fiche = donnees.fiche || {};
    if (valeur === undefined || valeur === null) delete donnees.fiche[cle];
    else donnees.fiche[cle] = valeur;
    ficheModifiee(false);
  }

  function rubriques() {
    donnees.fiche = donnees.fiche || {};
    if (!Array.isArray(donnees.fiche.rubriques)) donnees.fiche.rubriques = [];
    return donnees.fiche.rubriques;
  }

  function majResumeFiche() {
    const zone = $("ed-fiche-resume");
    if (!zone) return;
    zone.textContent = "";
    if (!window.Fiche || typeof Fiche.calculer !== "function") {
      zone.textContent = "Module Fiche non chargé : le calcul des pages n'est pas disponible ici.";
      return;
    }
    try {
      const d = JSON.parse(serialiser(donnees));
      const c = Fiche.calculer(d);
      const f = fiche();
      const source = f && Array.isArray(f.rubriques) && f.rubriques.length ? "" : " (rubriques tirées des questions du quiz 1)";
      zone.appendChild(el("strong", { text: c.pages.length + " page" + (c.pages.length > 1 ? "s" : "") + " A4" + source }));
      c.pages.forEach((pg, k) => {
        zone.appendChild(el("div", { class: "ed-discret",
          text: (c.pages.length > 1 ? "Page " + (k + 1) + " : " : "") +
            pg.map(r => r.rubriques.join(" + ") + " (" + r.lignes + " l.)").join(" · ") }));
      });
    } catch (e) {
      zone.textContent = "Calcul impossible : " + e.message;
    }
  }

  function telechargerEssaiFiche() {
    if (!window.Fiche || typeof Fiche.pdf !== "function") {
      notifier("Module Fiche (Partage.Fiche.js) non chargé.");
      return;
    }
    const octets = Fiche.pdf(JSON.parse(serialiser(donnees)), RACINE);
    if (!octets) { notifier("Aucune rubrique : ajoute des rubriques ou des questions au quiz 1."); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([octets], { type: "application/pdf" }));
    a.download = RACINE + ".fiche.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    notifier("✔ Essai téléchargé : " + RACINE + ".fiche.pdf");
  }

  function rendreFiche() {
    const zone = $("ed-fiche-contenu");
    if (!zone || !donnees) return;
    zone.textContent = "";
    const f = fiche() || {};

    /* réglages généraux */
    const titre = el("input", { type: "text", class: "ed-champ", value: f.titre || "", placeholder: "(titre de la page) – mes notes" });
    titre.addEventListener("input", () => setFiche("titre", titre.value.trim()));
    const consigne = el("textarea", { class: "ed-champ", rows: 2, placeholder: "Écoute le texte et note l'essentiel en mots-clés." });
    consigne.value = f.consigne || "";
    consigne.addEventListener("input", () => setFiche("consigne", consigne.value.trim()));
    const entete = el("input", { type: "text", class: "ed-champ",
      value: Array.isArray(f.entete) ? f.entete.join(", ") : "", placeholder: "Nom, Date, Classe" });
    entete.addEventListener("input", () => {
      const v = entete.value.trim();
      setFiche("entete", v ? v.split(",").map(x => x.trim()).filter(Boolean) : undefined);
    });
    const pages = el("select", { class: "ed-champ" },
      el("option", { value: "", text: "Automatique (estimé)" }),
      [1, 2, 3, 4].map(n => el("option", { value: n, text: n + " page" + (n > 1 ? "s" : "") })));
    pages.value = f.pages && f.pages !== "auto" ? String(f.pages) : "";
    pages.addEventListener("change", () => setFiche("pages", pages.value ? Number(pages.value) : undefined));
    const interligne = el("input", { type: "number", class: "ed-champ", min: 6, max: 15, step: 0.5,
      value: f.interligne || "", placeholder: "9" });
    interligne.addEventListener("input", () => setFiche("interligne", interligne.value ? Number(interligne.value) : undefined));

    zone.appendChild(el("div", { class: "ed-fiche-grille" },
      el("label", { class: "ed-label" }, "Titre de la page", titre),
      el("label", { class: "ed-label" }, "Champs en haut (séparés par des virgules)", entete),
      el("label", { class: "ed-label ed-fiche-large" }, "Consigne", consigne),
      el("label", { class: "ed-label" }, "Nombre de pages", pages),
      el("label", { class: "ed-label" }, "Interligne (mm) – 8 à 10 pour écrire vite", interligne)
    ));

    /* rubriques */
    const liste = el("div", { class: "ed-rubriques" });
    const rs = Array.isArray(f.rubriques) ? f.rubriques : [];
    if (!rs.length) {
      liste.appendChild(el("p", { class: "ed-discret",
        text: "Aucune rubrique : la page reprendra les questions du quiz 1. Ajoute des rubriques pour choisir toi-même." }));
    }
    rs.forEach((r, i) => {
      const t = el("input", { type: "text", class: "ed-champ", value: r.titre || "", placeholder: "Rubrique (ex. Name)", lang: "de" });
      t.addEventListener("input", () => { r.titre = t.value; ficheModifiee(false); });
      const aide = el("input", { type: "text", class: "ed-champ", value: r.aide || "", placeholder: "Aide (facultatif)", lang: "de" });
      aide.addEventListener("input", () => { if (aide.value.trim()) r.aide = aide.value; else delete r.aide; ficheModifiee(false); });
      const lignes = el("input", { type: "number", class: "ed-nombre", min: 1, max: 40, value: r.lignes || "", placeholder: "2", title: "Lignes minimum" });
      lignes.addEventListener("input", () => { if (lignes.value) r.lignes = Number(lignes.value); else delete r.lignes; ficheModifiee(false); });
      const poids = el("input", { type: "number", class: "ed-nombre", min: 0, max: 20, step: 0.5, value: r.poids === undefined ? "" : r.poids, placeholder: "1", title: "Part de la place restante (0 = fixe)" });
      poids.addEventListener("input", () => { if (poids.value !== "") r.poids = Number(poids.value); else delete r.poids; ficheModifiee(false); });
      const demi = el("input", { type: "checkbox", checked: r.largeur === "demi" });
      demi.addEventListener("change", () => { if (demi.checked) r.largeur = "demi"; else delete r.largeur; ficheModifiee(false); });
      const bouger = (sens) => {
        const j = i + sens; if (j < 0 || j >= rs.length) return;
        [rs[i], rs[j]] = [rs[j], rs[i]]; ficheModifiee(true);
      };
      liste.appendChild(el("div", { class: "ed-rubrique" },
        el("span", { class: "ed-num", text: String(i + 1) }),
        el("div", { class: "ed-rubrique-textes" }, t, aide),
        el("label", { class: "ed-mini-label" }, "Lignes", lignes),
        el("label", { class: "ed-mini-label" }, "Poids", poids),
        el("label", { class: "ed-mini-label ed-case-demi", title: "Deux rubriques ½ qui se suivent sont côte à côte" }, demi, " ½ largeur"),
        el("div", { class: "ed-actions" },
          el("button", { type: "button", class: "ed-mini", title: "Monter", onclick: () => bouger(-1) }, "↑"),
          el("button", { type: "button", class: "ed-mini", title: "Descendre", onclick: () => bouger(1) }, "↓"),
          el("button", { type: "button", class: "ed-mini ed-danger", title: "Supprimer", onclick: () => { rs.splice(i, 1); ficheModifiee(true); } }, "🗑"))
      ));
    });
    zone.appendChild(el("div", { class: "ed-label" }, "Rubriques à compléter à la main"));
    zone.appendChild(liste);

    zone.appendChild(el("div", { class: "ed-ligne ed-ligne-aide" },
      el("button", { type: "button", class: "ed-ajout", onclick: () => { rubriques().push({ titre: "", lignes: 2 }); ficheModifiee(true);
        const champs = zone.querySelectorAll(".ed-rubrique .ed-champ"); if (champs.length) champs[champs.length - 2].focus(); } }, "+ rubrique"),
      !rs.length ? el("button", { type: "button", class: "ed-ajout", onclick: () => {
        const qs = donnees.questions.filter(q => types(q).includes(1) && String(q.question || "").trim());
        qs.forEach(q => rubriques().push({ titre: q.question.trim(), lignes: 2 }));
        if (!qs.length) notifier("Aucune question dans le quiz 1.");
        ficheModifiee(true);
      } }, "Créer à partir des questions du quiz 1") : null,
      el("span", { class: "ed-discret", text: "Poids : part de la place restante (0 = taille fixe). La place libre de chaque page est répartie en lignes selon les poids." })
    ));

    /* résultat */
    zone.appendChild(el("div", { class: "ed-fiche-bas" },
      el("div", { id: "ed-fiche-resume", class: "ed-fiche-resume", "aria-live": "polite" }),
      el("button", { type: "button", class: "ed-btn", onclick: telechargerEssaiFiche }, "⬇ Télécharger un essai (PDF)")
    ));
    majResumeFiche();
  }

  /* ===============================
     12 quater. LECTURE DU TEXTE (bloc "lecture" du JSON)
     =============================== */
  function rendreLecture() {
    const zone = $("ed-lecture-contenu");
    if (!zone || !donnees) return;
    zone.textContent = "";
    const l = (donnees.lecture && typeof donnees.lecture === "object") ? donnees.lecture : {};

    function set(cle, v) {
      donnees.lecture = donnees.lecture || {};
      if (!v) delete donnees.lecture[cle]; else donnees.lecture[cle] = v;
      if (!Object.keys(donnees.lecture).length) delete donnees.lecture;
      changement(null);
    }
    const choixVoix = (cle, defaut) => {
      const sel = el("select", { class: "ed-champ" },
        el("option", { value: "", text: "Par défaut : " + defaut }),
        VOIX.filter(v => v[0]).map(([v, lib]) => el("option", { value: v, text: lib })));
      sel.value = l[cle] || "";
      sel.addEventListener("change", () => set(cle, sel.value));
      return sel;
    };
    const mode = el("select", { class: "ed-champ" },
      el("option", { value: "", text: "Par défaut : voix prévues dans la page" }),
      el("option", { value: "fichier", text: "Voix prévues dans la page (data-speaker)" }),
      el("option", { value: "une", text: "Une seule voix" }),
      el("option", { value: "dialogue", text: "Deux voix pour les dialogues" }));
    mode.value = l.mode || "";
    mode.addEventListener("change", () => set("mode", mode.value));

    zone.appendChild(el("p", { class: "ed-discret",
      text: "Mode de lecture au départ ; l'utilisateur peut le changer dans ⚙️ Paramètres de la page. En mode dialogue, les phrases qui commencent par un tiret ou un guillemet sont lues alternativement par la voix A et la voix B ; le reste par le narrateur." }));
    zone.appendChild(el("div", { class: "ed-fiche-grille" },
      el("label", { class: "ed-label ed-fiche-large" }, "Mode de lecture", mode),
      el("label", { class: "ed-label" }, "Voix A (1re réplique)", choixVoix("voixA", "KatjaM")),
      el("label", { class: "ed-label" }, "Voix B (2e réplique)", choixVoix("voixB", "Conrad")),
      el("label", { class: "ed-label" }, "Narrateur (récit)", choixVoix("narrateur", "KatjaN")),
      el("label", { class: "ed-label" }, "Voix unique", choixVoix("voixUnique", "Katja"))
    ));
    const vitesse = el("select", { class: "ed-champ" },
      el("option", { value: "", text: "Par défaut : normale (1×)" }),
      ["0.6", "0.7", "0.8", "0.9", "1.1", "1.2", "1.3"].map(v =>
        el("option", { value: v, text: v.replace(".", ",") + "×" + (Number(v) < 1 ? " (plus lent)" : " (plus rapide)") })));
    vitesse.value = l.vitesse !== undefined ? String(l.vitesse) : "";
    vitesse.addEventListener("change", () => set("vitesse", vitesse.value ? Number(vitesse.value) : ""));
    zone.appendChild(el("label", { class: "ed-label" }, "Vitesse de la voix au départ (l'élève peut la changer avec le curseur)", vitesse));
    const temps = el("input", { type: "text", class: "ed-champ", placeholder: "ex. 0 1.8 4.2 6.5 …" });
    temps.value = Array.isArray(l.temps) ? l.temps.join(" ") : "";
    temps.addEventListener("change", () => {
      const v = temps.value.replace(/,/g, ".").split(/[\s;]+/).filter(Boolean).map(Number).filter(x => isFinite(x) && x >= 0);
      set("temps", v.length ? v : "");
      temps.value = v.join(" ");
    });
    zone.appendChild(el("label", { class: "ed-label" },
      "Avec un MP3 : début de chaque phrase, en secondes (facultatif, une valeur par phrase, dans l'ordre ; sinon la position est estimée)", temps));
    const verrou = el("input", { type: "checkbox" });
    verrou.checked = l.verrouille === true;
    verrou.addEventListener("change", () => set("verrouille", verrou.checked));
    zone.appendChild(el("label", { class: "ed-label" }, verrou,
      " Texte verrouillé au départ : l'élève ne peut ni réécouter avec le texte ni le révéler"));
  }

  /* ===============================
     12 ter. MOTS TRADUITS AU SURVOL (bloc "vocabulaire" du JSON)
     =============================== */
  function vocabulaire() {
    if (!Array.isArray(donnees.vocabulaire)) donnees.vocabulaire = [];
    return donnees.vocabulaire;
  }

  function vocabModifie(structure) {
    if (Array.isArray(donnees.vocabulaire) && !donnees.vocabulaire.length) delete donnees.vocabulaire;
    changement(null);
    if (structure) rendreVocab();
  }

  function rendreVocab() {
    const zone = $("ed-vocab-contenu");
    if (!zone || !donnees) return;
    zone.textContent = "";
    const liste = Array.isArray(donnees.vocabulaire) ? donnees.vocabulaire : [];

    zone.appendChild(el("p", { class: "ed-discret",
      text: "Mots ou expressions du texte, traduits en français quand l'élève passe la souris dessus (ou les touche sur téléphone). « Autres formes » : formes conjuguées ou déclinées à repérer aussi, séparées par des virgules. « Coché » : mot traduit dès le départ ; décoché, il est seulement proposé dans la liste de la page." }));

    const table = el("div", { class: "ed-vocab-table" },
      el("div", { class: "ed-vocab-ligne ed-vocab-tete" },
        el("span", { text: "Mot (allemand)" }), el("span", { text: "Traduction (français)" }),
        el("span", { text: "Autres formes" }), el("span", { text: "Coché" }), el("span", { text: "" })));
    liste.forEach((e, i) => {
      const mot = el("input", { type: "text", class: "ed-champ", lang: "de", value: e.mot || "", placeholder: "Katze" });
      mot.addEventListener("input", () => { e.mot = mot.value; vocabModifie(false); });
      const trad = el("input", { type: "text", class: "ed-champ", lang: "fr", value: e.traduction || "", placeholder: "le chat (die Katze)" });
      trad.addEventListener("input", () => { e.traduction = trad.value; vocabModifie(false); });
      const formes = el("input", { type: "text", class: "ed-champ", lang: "de",
        value: Array.isArray(e.formes) ? e.formes.join(", ") : "", placeholder: "heiße, heißt" });
      formes.addEventListener("input", () => {
        const f = formes.value.split(",").map(x => x.trim()).filter(Boolean);
        if (f.length) e.formes = f; else delete e.formes;
        vocabModifie(false);
      });
      const actif = el("input", { type: "checkbox", checked: e.actif !== false,
        title: "Coché au départ : le mot est souligné et traduit tant que l'enseignant ne le décoche pas dans la page" });
      actif.addEventListener("change", () => { if (actif.checked) delete e.actif; else e.actif = false; vocabModifie(false); });
      table.appendChild(el("div", { class: "ed-vocab-ligne" }, mot, trad, formes, actif,
        el("button", { type: "button", class: "ed-mini ed-danger", title: "Supprimer",
          onclick: () => { liste.splice(i, 1); vocabModifie(true); } }, "🗑")));
    });
    zone.appendChild(table);

    // mots ajoutés par l'enseignant dans la page de l'exercice (mémorisés dans ce navigateur)
    let locaux = [];
    try { locaux = JSON.parse(localStorage.getItem(RACINE + "::vocab::ajouts") || "[]"); } catch (e) { locaux = []; }
    const dejaLa = new Set(liste.map(e => String(e.mot || "").trim().toLowerCase()));
    const nouveaux = (Array.isArray(locaux) ? locaux : []).filter(e => e && e.mot && !dejaLa.has(String(e.mot).trim().toLowerCase()));

    zone.appendChild(el("div", { class: "ed-ligne ed-ligne-aide" },
      el("button", { type: "button", class: "ed-ajout", onclick: () => {
        vocabulaire().push({ mot: "", traduction: "" }); vocabModifie(true);
        const champs = zone.querySelectorAll(".ed-vocab-ligne .ed-champ");
        if (champs.length) champs[champs.length - 3].focus();
      } }, "+ mot"),
      nouveaux.length ? el("button", { type: "button", class: "ed-ajout",
        title: "Mots ajoutés avec « ➕ Ajouter un mot » dans la page de l'exercice, sur cet ordinateur",
        onclick: () => {
          nouveaux.forEach(e => vocabulaire().push({ mot: String(e.mot).trim(), traduction: String(e.traduction || "").trim() }));   // coché
          vocabModifie(true);
          notifier(nouveaux.length + " mot(s) importé(s) dans le fichier.");
        } }, "⤓ Importer les " + nouveaux.length + " mot(s) ajouté(s) dans la page") : null,
      el("span", { class: "ed-discret", text: liste.length + " mot(s) dans le fichier." })
    ));
  }

  /* ===============================
     13. APERÇU ÉLÈVE (vrai module Quiz)
     =============================== */
  let minuterieApercu = null;

  function apercu(n) {
    const msg = $("ed-apercu-message");
    if (!window.Quiz || typeof Quiz.charger !== "function") {
      msg.textContent = "Aperçu indisponible : le module Quiz (Partage.Quiz.js) n'est pas chargé.";
      return;
    }
    msg.textContent = "";
    const zone = $("zone-" + TYPES[n].cle);

    if (apercuActif === n && zone.classList.contains("open")) {
      Quiz.ouvrir(n);           // referme
      apercuActif = null;
      majBoutonsApercu();
      return;
    }
    apercuActif = n;
    Quiz.charger(JSON.parse(serialiser(donnees)));
    if (!zone.classList.contains("open")) Quiz.ouvrir(n);
    majBoutonsApercu();
    if (!zone.querySelector(".quiz-question")) {
      msg.textContent = "Aucune question utilisable dans ce quiz pour l'instant.";
    }
  }

  function majBoutonsApercu() {
    document.querySelectorAll(".ed-apercu-btn").forEach(b => {
      const actif = Number(b.dataset.n) === apercuActif;
      b.classList.toggle("actif", actif);
      b.setAttribute("aria-pressed", actif ? "true" : "false");
    });
  }

  function planifierApercu() {
    if (!apercuActif) return;
    clearTimeout(minuterieApercu);
    minuterieApercu = setTimeout(() => {
      if (!apercuActif || !window.Quiz) return;
      Quiz.charger(JSON.parse(serialiser(donnees)));   // reconstruit la zone ouverte
    }, 700);
  }

  /* ===============================
     14. NOTIFICATIONS (sans boîte de dialogue)
     =============================== */
  let minuterieToast = null;

  function notifier(message, libelleAction, action) {
    const t = $("ed-toast");
    t.textContent = "";
    t.appendChild(el("span", { text: message }));
    if (libelleAction && action) {
      t.appendChild(el("button", {
        type: "button", class: "ed-btn",
        onclick: () => { action(); t.hidden = true; }
      }, libelleAction));
    }
    t.hidden = false;
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { t.hidden = true; }, libelleAction ? 8000 : 4500);
  }

  /* ===============================
     15. CHARGEMENT DU JSON
     =============================== */
  function ouvrirDonnees(d, origine, sansBrouillon) {
    if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
    if (!Array.isArray(d.questions)) d.questions = [];
    d.questions = d.questions.filter(q => q && typeof q === "object" && !Array.isArray(q));

    donnees = d;
    modifie = false;

    // identifiants manquants
    let complete = 0;
    d.questions.forEach(q => {
      if (q.id === undefined || String(q.id).trim() === "") {
        q.id = idUnique(PREFIXES[types(q)[0]] || "q");
        complete++;
      }
    });

    $("ed-boite-json").hidden = true;
    $("ed-contenu").hidden = false;
    $("ed-enregistrer").disabled = false;

    filtre = "tous";
    rendreReglages();
    rendreFiche();
    rendreVocab();
    rendreLecture();
    rendreFiltres();
    rendreListe();
    majStatut("Ouvert : " + origine + " — " + d.questions.length + " question(s)");

    if (complete) {
      modifie = true;
      majStatut();
      notifier(complete + " identifiant(s) manquant(s) ajouté(s) automatiquement.");
    }
    if (!sansBrouillon) verifierBrouillon(serialiser(d));
    if (apercuActif) planifierApercu();
  }

  function afficherBoiteJSON(message) {
    const boite = $("ed-boite-json");
    boite.querySelector(".ed-boite-message").textContent = message;
    boite.hidden = false;
    majStatut(RACINE ? "En attente de " + nomJSON() : "Aucun exercice choisi");
  }

  function chargerAuto() {
    if (!RACINE) {
      afficherBoiteJSON("Quel exercice modifier ? Choisis son fichier JSON (ex. Anna9H.json), " +
        "ou ouvre l'éditeur avec son nom dans l'adresse : Partage.editeur.html?Anna9H");
      return;
    }
    fetch(cheminJSON(), { cache: "no-cache" })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => ouvrirDonnees(d, nomJSON()))
      .catch(err => {
        console.warn("[Éditeur] chargement automatique de " + nomJSON() + " impossible :", err.message);
        afficherBoiteJSON(location.protocol === "file:"
          ? "Ouverture locale : le navigateur ne peut pas lire " + nomJSON() + " tout seul. Choisis-le ci-dessous."
          : nomJSON() + " est introuvable ou illisible. Choisis un fichier, ou commence un fichier vide.");
      });
  }

  /* ===============================
     16. STYLE DE L'ÉDITEUR
     =============================== */
  function injecterStyle() {
    const css = `
      :root{--ed-fond:#f3f5f8;--ed-carte:#fff;--ed-bord:#d6dce4;--ed-texte:#1f2933;--ed-doux:#5d6977;
        --ed-accent:#2f6fb2;--ed-ok:#2e7d4f;--ed-alerte:#a55d0b;--ed-danger:#b3261e;
        --ed-c1:#2f6fb2;--ed-c2:#3a8f5c;--ed-c3:#c47a2c;--ed-c4:#7a4aa5}
      body{background:var(--ed-fond);color:var(--ed-texte);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
      #ed-app{max-width:1440px;margin:0 auto;padding:12px 16px 80px}
      .ed-entete{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;
        background:var(--ed-carte);border:1px solid var(--ed-bord);border-radius:12px;padding:10px 14px;box-shadow:0 2px 6px rgba(0,0,0,.05)}
      .ed-entete h1{font-size:1.15rem;margin:0}
      .ed-entete h1 small{font-weight:400;color:var(--ed-doux)}
      .ed-entete-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .ed-statut{font-size:.9rem;color:var(--ed-doux)}
      .ed-statut-modifie{color:var(--ed-alerte);font-weight:600}
      .ed-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--ed-bord);border-radius:8px;
        background:#fff;color:var(--ed-texte);font:inherit;font-size:.92rem;cursor:pointer;text-decoration:none}
      .ed-btn:hover{background:#f0f4f9}
      .ed-btn:disabled{opacity:.5;cursor:not-allowed}
      .ed-btn-principal{background:var(--ed-accent);border-color:var(--ed-accent);color:#fff;font-weight:600}
      .ed-btn-principal:hover{background:#245a93}
      .ed-encadre{margin-top:12px;padding:12px 14px;border-radius:10px;border:1px dashed var(--ed-c3);background:#fff8ef;
        display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .ed-encadre[hidden]{display:none}
      .ed-grille{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,440px);gap:16px;align-items:start;margin-top:14px}
      @media (max-width:1050px){.ed-grille{grid-template-columns:1fr}#ed-apercu{position:static!important;max-height:none!important}}
      .ed-section{background:var(--ed-carte);border:1px solid var(--ed-bord);border-radius:12px;padding:12px 14px;margin-bottom:14px}
      .ed-section>summary{cursor:pointer;font-weight:600}
      .ed-section h2{font-size:1.05rem;margin:0 0 10px}
      #ed-reglages-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:10px}
      .ed-reglage{border:1px solid var(--ed-bord);border-radius:10px;padding:10px;border-top:4px solid var(--ed-accent)}
      .ed-reglage h3{margin:0 0 4px;font-size:.98rem}
      .ed-reglage-1{border-top-color:var(--ed-c1)}.ed-reglage-2{border-top-color:var(--ed-c2)}
      .ed-reglage-3{border-top-color:var(--ed-c3)}.ed-reglage-4{border-top-color:var(--ed-c4)}
      .ed-label{display:block;font-size:.82rem;font-weight:600;color:var(--ed-doux);margin:8px 0 4px}
      .ed-label .ed-champ{margin-top:4px;font-weight:400;color:var(--ed-texte)}
      .ed-case{display:flex;gap:6px;align-items:center;font-size:.9rem;margin-top:10px}
      .ed-champ{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--ed-bord);border-radius:7px;font:inherit;font-size:.98rem;background:#fff;color:var(--ed-texte)}
      .ed-champ:focus,.ed-id:focus{outline:2px solid var(--ed-accent);outline-offset:0;border-color:var(--ed-accent)}
      textarea.ed-champ{resize:vertical}
      .ed-barre{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
      #ed-filtres{display:flex;flex-wrap:wrap;gap:6px}
      .ed-filtre{padding:5px 10px;border-radius:999px;border:1px solid var(--ed-bord);background:#fff;cursor:pointer;font:inherit;font-size:.88rem}
      .ed-filtre.actif{background:var(--ed-texte);color:#fff;border-color:var(--ed-texte)}
      .ed-filtre-1.actif{background:var(--ed-c1);border-color:var(--ed-c1)}.ed-filtre-2.actif{background:var(--ed-c2);border-color:var(--ed-c2)}
      .ed-filtre-3.actif{background:var(--ed-c3);border-color:var(--ed-c3)}.ed-filtre-4.actif{background:var(--ed-c4);border-color:var(--ed-c4)}
      .ed-compte{display:inline-block;min-width:1.4em;padding:0 5px;border-radius:999px;background:rgba(0,0,0,.08);font-size:.8rem;text-align:center}
      .ed-compte-alerte{background:#fde9cc;color:var(--ed-alerte);margin-left:4px}
      .ed-carte{background:#fff;border:1px solid var(--ed-bord);border-left:5px solid var(--ed-ok);border-radius:10px;padding:10px 12px;margin-bottom:10px}
      .ed-carte-erreur{border-left-color:var(--ed-alerte)}
      .ed-flash{animation:edFlash 1.2s ease}
      @keyframes edFlash{from{box-shadow:0 0 0 4px rgba(47,111,178,.45)}to{box-shadow:none}}
      .ed-carte-haut{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .ed-num{font-weight:700;color:var(--ed-doux);min-width:2.2em}
      .ed-id{width:5.5em;padding:4px 6px;border:1px solid var(--ed-bord);border-radius:6px;font:inherit;font-size:.88rem;font-family:ui-monospace,Consolas,monospace}
      .ed-types{display:flex;flex-wrap:wrap;gap:4px}
      .ed-type{display:inline-flex;align-items:center;gap:3px;font-size:.82rem;padding:3px 8px;border-radius:999px;border:1px solid var(--ed-bord);cursor:pointer;user-select:none}
      .ed-type:has(input:checked){color:#fff}
      .ed-type-1:has(input:checked){background:var(--ed-c1);border-color:var(--ed-c1)}
      .ed-type-2:has(input:checked){background:var(--ed-c2);border-color:var(--ed-c2)}
      .ed-type-3:has(input:checked){background:var(--ed-c3);border-color:var(--ed-c3)}
      .ed-type-4:has(input:checked){background:var(--ed-c4);border-color:var(--ed-c4)}
      .ed-voix{font:inherit;font-size:.85rem;padding:3px 4px;border:1px solid var(--ed-bord);border-radius:6px}
      .ed-actions{margin-left:auto;display:flex;gap:4px}
      .ed-mini{min-width:32px;height:32px;border:1px solid var(--ed-bord);border-radius:7px;background:#fff;cursor:pointer;font-size:.95rem}
      .ed-mini:hover{background:#eef3f9}
      .ed-danger:hover{background:#fdecea;border-color:var(--ed-danger)}
      .ed-bloc{margin-top:8px}
      .ed-ligne{display:flex;gap:6px;align-items:center;margin-bottom:5px}
      .ed-ligne .ed-champ{flex:1}
      .ed-ligne-aide{flex-wrap:wrap}
      .ed-bonne .ed-champ{border-color:var(--ed-ok);background:#f1faf4}
      .ed-modele .ed-champ{border-color:var(--ed-c4);border-width:2px}
      .ed-ajout{border:1px dashed var(--ed-bord);background:none;border-radius:7px;padding:4px 10px;cursor:pointer;font:inherit;font-size:.86rem;color:var(--ed-accent)}
      .ed-ajout:hover{background:#eef3f9}
      .ed-discret{font-size:.82rem;color:var(--ed-doux)}
      .ed-trous{font-size:1.02rem}
      .ed-trous-apercu{font-size:.88rem;margin-top:4px}
      .ed-trou{padding:2px 0}
      .ed-trou-bonne{color:var(--ed-ok);font-weight:600}
      .ed-etat{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .ed-pastille{font-size:.8rem;padding:2px 8px;border-radius:999px}
      .ed-pastille-ok{background:#e6f4ea;color:var(--ed-ok)}
      .ed-pastille-alerte{background:#fde9cc;color:var(--ed-alerte)}
      .ed-vide{color:var(--ed-doux);text-align:center;padding:20px}
      #ed-multi[hidden]{display:none}
      #ed-multi{margin-bottom:12px;padding:10px;border:1px solid var(--ed-bord);border-radius:10px;background:#fafbfd}
      #ed-apercu{position:sticky;top:76px;max-height:calc(100vh - 92px);overflow:auto}
      .ed-apercu-boutons{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
      .ed-apercu-btn{flex:1 1 auto}
      .ed-apercu-btn.actif{background:var(--ed-texte);color:#fff;border-color:var(--ed-texte)}
      #ed-apercu .zone-quiz{margin:8px 0 0}
      #ed-apercu-message{font-size:.88rem;color:var(--ed-alerte)}
      .ed-fiche-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 12px;margin-top:6px}
      .ed-fiche-large{grid-column:1/-1}
      .ed-rubriques{display:flex;flex-direction:column;gap:6px}
      .ed-rubrique{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;padding:6px 8px;border:1px solid var(--ed-bord);border-radius:8px;background:#fafbfd}
      .ed-rubrique-textes{flex:1 1 240px;display:flex;flex-direction:column;gap:4px}
      .ed-nombre{width:4.2em;padding:4px 6px;border:1px solid var(--ed-bord);border-radius:6px;font:inherit}
      .ed-mini-label{display:flex;align-items:center;gap:4px;font-size:.8rem;color:var(--ed-doux)}
      .ed-fiche-bas{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--ed-bord)}
      .ed-fiche-resume{flex:1 1 300px;font-size:.88rem}
      .ed-vocab-table{display:flex;flex-direction:column;gap:6px;margin:6px 0}
      .ed-vocab-ligne{display:grid;grid-template-columns:1fr 1.3fr 1fr auto auto;gap:6px;align-items:center}
      .ed-vocab-tete{font-size:.78rem;font-weight:600;color:var(--ed-doux)}
      @media (max-width:700px){.ed-vocab-ligne{grid-template-columns:1fr 1fr}.ed-vocab-tete{display:none}}
      #ed-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:50;display:flex;gap:10px;align-items:center;
        background:#1f2933;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}
      #ed-toast[hidden]{display:none}
      #ed-toast .ed-btn{padding:4px 10px}
    `;
    const s = el("style", { id: "ed-style" });
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ===============================
     17. CONSTRUCTION DE LA PAGE
     =============================== */
  function construireUI() {
    document.title = RACINE ? "Éditeur – " + RACINE : "Éditeur des quiz";
    injecterStyle();

    const chargement = $("ed-chargement");
    if (chargement) chargement.remove();

    /* en-tête */
    const entete = el("header", { class: "ed-entete" },
      el("h1", null, "✏️ Éditeur des quiz ", el("small", { id: "ed-titre-fichier", text: RACINE ? "— " + nomJSON() : "" })),
      el("div", { class: "ed-entete-actions" },
        el("span", { id: "ed-statut", class: "ed-statut", text: RACINE ? "Chargement de " + nomJSON() + "…" : "Aucun exercice choisi" }),
        el("button", { type: "button", id: "ed-enregistrer", class: "ed-btn ed-btn-principal", disabled: true,
          title: "Ctrl+S", onclick: enregistrer }, "💾 Enregistrer"),
        el("a", { id: "ed-lien-exercice", class: "ed-btn", href: RACINE ? encodeURI(cheminExercice()) : "#",
          target: "_blank", rel: "noopener", hidden: !RACINE,
          title: "Enregistre d'abord pour voir les dernières modifications" }, RACINE ? "▶ Ouvrir " + nomExercice() : "")
      )
    );

    /* chargement manuel (masqué quand le JSON est chargé) */
    const entree = el("input", { type: "file", accept: ".json,application/json", style: "display:none" });
    entree.addEventListener("change", () => {
      const f = entree.files && entree.files[0];
      if (!f) return;
      const lecteur = new FileReader();
      lecteur.onload = () => {
        try {
          const d = JSON.parse(lecteur.result);
          if (!RACINE) choisirRacine(f.name.split(".")[0]);
          ouvrirDonnees(d, f.name);
          if (f.name !== nomJSON()) {
            notifier("Attention : fichier « " + f.name + " » ouvert ; l'exercice attend « " + nomJSON() + " ».");
          }
        } catch (e) {
          afficherBoiteJSON("Ce fichier n'est pas un JSON valide : " + e.message);
        }
        entree.value = "";
      };
      lecteur.readAsText(f, "utf-8");
    });
    const champNom = el("input", { type: "text", class: "ed-id", placeholder: "Anna9H", hidden: !!RACINE,
      "aria-label": "Nom de l'exercice", title: "Nom de l'exercice (sans .html)", style: "width:9em" });
    const boite = el("div", { id: "ed-boite-json", class: "ed-encadre", hidden: true },
      el("span", { class: "ed-boite-message" }),
      el("button", { type: "button", id: "ed-bouton-charger", class: "ed-btn ed-btn-principal", onclick: () => entree.click() },
        RACINE ? "📂 Charger " + nomJSON() : "📂 Choisir le fichier JSON de l'exercice"),
      champNom,
      el("button", { type: "button", class: "ed-btn",
        onclick: () => {
          if (!RACINE) {
            const r = champNom.value.trim().split(".")[0];
            if (!r) { champNom.hidden = false; champNom.focus(); notifier("Indique d'abord le nom de l'exercice (ex. Anna9H)."); return; }
            choisirRacine(r);
          }
          ouvrirDonnees({ version: 1, questions: [] }, "nouveau fichier " + nomJSON());
          modifie = true;
          majStatut();
        } }, "✚ Nouveau fichier vide"),
      entree
    );

    const brouillon = el("div", { id: "ed-brouillon", class: "ed-encadre", hidden: true });

    /* colonne d'édition */
    const multiTexte = el("textarea", { class: "ed-champ", rows: 6, lang: "de",
      placeholder: "* Wie heißt das Mädchen?\n* Wie alt ist Anna?\n* Wo wohnt sie?" });
    const multiTypes = NUMEROS.map(n => el("input", { type: "checkbox", checked: n === 1 }));
    const multi = el("div", { id: "ed-multi", hidden: true },
      el("label", { class: "ed-label" }, "Une question par ligne (puces, tirets et numéros sont retirés)", multiTexte),
      el("div", { class: "ed-ligne ed-ligne-aide" },
        el("span", { class: "ed-discret", text: "À ajouter dans :" }),
        NUMEROS.map((n, k) => el("label", { class: "ed-type ed-type-" + n }, multiTypes[k], " " + n + " " + libelle(n))),
        el("button", { type: "button", class: "ed-btn ed-btn-principal",
          onclick: () => {
            const choix = NUMEROS.filter((n, k) => multiTypes[k].checked);
            if (ajouterPlusieurs(multiTexte.value, choix)) { multiTexte.value = ""; multi.hidden = true; }
          } }, "Créer les questions"),
        el("button", { type: "button", class: "ed-btn", onclick: () => { multi.hidden = true; } }, "Fermer")
      )
    );

    const colonne = el("div", { id: "ed-colonne" },
      el("details", { class: "ed-section", id: "ed-reglages" },
        el("summary", { text: "⚙️ Réglages des 4 quiz (libellés des boutons, titres, consignes, ordre)" }),
        el("div", { id: "ed-reglages-grille" })
      ),
      el("details", { class: "ed-section", id: "ed-lecture" },
        el("summary", { text: "🔊 Lecture du texte (une voix, deux voix pour les dialogues)" }),
        el("div", { id: "ed-lecture-contenu" })
      ),
      el("details", { class: "ed-section", id: "ed-vocab" },
        el("summary", { text: "📖 Mots traduits au survol (vocabulaire)" }),
        el("div", { id: "ed-vocab-contenu" })
      ),
      el("details", { class: "ed-section", id: "ed-fiche" },
        el("summary", { text: "🖨 Page de prise de notes (rubriques, place, nombre de pages)" }),
        el("div", { id: "ed-fiche-contenu" })
      ),
      el("section", { class: "ed-section" },
        el("div", { class: "ed-barre" },
          el("div", { id: "ed-filtres", role: "toolbar", "aria-label": "Filtrer les questions" }),
          el("div", { class: "ed-entete-actions" },
            el("button", { type: "button", class: "ed-btn ed-btn-principal",
              onclick: () => ajouterQuestion(typeof filtre === "number" ? filtre : 1) }, "+ Question"),
            el("button", { type: "button", class: "ed-btn",
              onclick: () => {
                multiTypes.forEach((cb, k) => { cb.checked = typeof filtre === "number" ? NUMEROS[k] === filtre : k === 0; });
                multi.hidden = !multi.hidden;
                if (!multi.hidden) multiTexte.focus();
              } }, "+ Plusieurs questions")
          )
        ),
        multi,
        el("div", { id: "ed-liste" })
      )
    );

    /* colonne d'aperçu : zones utilisées par le module Quiz */
    const panneau = el("aside", { id: "ed-apercu", class: "ed-section" },
      el("h2", { text: "👁 Aperçu élève" }),
      el("div", { class: "ed-apercu-boutons" },
        NUMEROS.map(n => el("button", {
          type: "button", class: "ed-btn ed-apercu-btn", "data-n": n, "aria-pressed": "false",
          onclick: () => apercu(n)
        }, n + " " + libelle(n)))
      ),
      el("p", { class: "ed-discret", text: "L'aperçu se met à jour pendant que tu modifies. Les 🔊 fonctionnent." }),
      el("div", { id: "ed-apercu-message", "aria-live": "polite" }),
      el("section", { id: "zone-quiz" },
        NUMEROS.map(n => el("section", { id: "zone-" + TYPES[n].cle, class: "zone-quiz" })))
    );

    const contenu = el("div", { id: "ed-contenu", class: "ed-grille", hidden: true }, colonne, panneau);

    // reçoit le bouton de chargement propre au module Quiz : il reste caché
    const cacheQuiz = el("div", { id: "zone-quiz-sidebar", style: "display:none" });

    const toast = el("div", { id: "ed-toast", role: "status", hidden: true });

    document.body.appendChild(el("div", { id: "ed-app" }, entete, boite, brouillon, contenu, cacheQuiz, toast));
  }

  /* ===============================
     18. DÉMARRAGE
     =============================== */
  function demarrer() {
    construireUI();

    // fermeture, rechargement, changement d'onglet : le brouillon est écrit tout de suite
    window.addEventListener("pagehide", ecrireBrouillon);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") ecrireBrouillon();
    });
    window.addEventListener("beforeunload", e => {
      ecrireBrouillon();
      if (!modifie) return;
      e.preventDefault();
      e.returnValue = "";
    });

    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (donnees) enregistrer();
      }
    });

    chargerAuto();
  }

  /* API (pour la console) */
  window.Editeur = {
    racine: () => RACINE,
    fichierJSON: () => (RACINE ? nomJSON() : null),
    donnees: () => (donnees ? JSON.parse(serialiser(donnees)) : null),
    texteJSON: () => (donnees ? serialiser(donnees) : ""),
    ouvrir: d => ouvrirDonnees(d, "console"),
    enregistrer
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }

})();
