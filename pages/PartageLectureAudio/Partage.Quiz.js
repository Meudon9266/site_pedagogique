/* =====================================================
   Partage.Quiz.js  –  module de quiz UNIFIÉ (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.Quiz.js (prioritaire)
   Remplace : prototypeQuizcomp.js, prototypeQuizvoc.js,
              prototypeQmd.js, prototypeQchi.js,
              uiQuizSidebar.js, uiQuizZones.js, uiQuizToggles.js

   CONVENTION DE NOMMAGE (aucun nom codé en dur)
   - racine = nom du fichier HTML avant le premier point
       NomdeRef.html          → racine "NomdeRef"
       NomdeRef.editeur.html  → racine "NomdeRef"
   - données : racine + ".json"
   - le JSON est chargé automatiquement ; si c'est impossible
     (ouverture en file://), un bouton de chargement manuel
     apparaît dans la barre latérale, masqué dès que le JSON est là.

   LES 4 TYPES DE QUIZ (champ "quiz" de chaque question : 1, 2, 3, 4
   ou une liste, ex. [2, 3] pour figurer dans deux quiz)
   Les types décrivent une FORME, pas un thème : chaque quiz porte un
   libellé de bouton générique, modifiable dans le JSON ("bouton"),
   à côté de son titre ("titre") et de sa consigne ("consigne").
     1  quizcomp  QCM : propositions écrites, boutons radio
                  (plutôt : compréhension orale)
     2  quizvoc   QCM à l'oral : propositions à écouter (🔊), texte caché
                  (plutôt : définition d'un mot, information demandée)
     3  qmd       menus déroulants : phrase à trous "texte" avec
                  [*bonne|autre|autre]  ou  question + propositions
                  (plutôt : structure de la langue, conjugaison, grammaire)
     4  qchi      réponses libres :
                  - question + "reponses" acceptées
                  - ou texte à trous à compléter "texteLibre" :
                    "Ich [heiße] Anna. Ich bin [elf|11] Jahre alt."
                    (chaque trou : réponses acceptées séparées par | ;
                     la première, ou celle marquée *, sert de modèle)

   CONTRAT HTML utilisé (inchangé)
     .quiz-nav-btn[data-type]   boutons de la barre latérale
     #zone-<type> .zone-quiz    zones des quiz
     #quiz-filter-box input[data-quiz]   cases d'activation
     #zone-quiz-sidebar         accueille le bouton de chargement manuel
     #btn-ecouter               actionné par le bouton « Écouter le texte » du quiz 1

   API : window.Quiz
     Quiz.racine, Quiz.fichierJSON
     Quiz.charger(objetJSON)   (ex. depuis l'éditeur)
     Quiz.donnees()            copie des données chargées
     Quiz.ouvrir(typeOuNumero) Quiz.setEnabled(type, bool)
     Quiz.recommencer(numero)
   ===================================================== */

(function () {
  "use strict";

  /* ===============================
     1. NOMS RECONSTRUITS
     =============================== */
  function calculerRacine() {
    const fichier = decodeURIComponent(location.pathname.split("/").pop() || "");
    return window.RACINE_EXERCICE || fichier.split(".")[0] || "index";   // exercice choisi (?exo=…) sinon nom de la page
  }

  const RACINE = calculerRacine();
  const FICHIER_JSON = RACINE + ".json";

  /* ===============================
     2. TYPES DE QUIZ (réglages par défaut,
        surchargeables par "quiz" dans le JSON)
     =============================== */
  const TYPES = {
    1: { cle: "quizcomp", rendu: "qcm",
         bouton: "QCM",
         titre: "🎧 Questions à choix multiple",
         consigne: "Écoute la question et coche la bonne réponse.",
         melange: "non", voixQuestion: "Katja", questionVisible: false },
    2: { cle: "quizvoc", rendu: "ecoute",
         bouton: "QCM à l'oral",
         titre: "🔊 Choix à l'oral",
         consigne: "Écoute la question, puis chaque proposition, et clique sur la bonne réponse.",
         melange: "jamaisPremiere", voixQuestion: "Katja",
         voixPropositions: ["Katja", "Conrad"], questionVisible: false },
    3: { cle: "qmd", rendu: "menus",
         bouton: "Menus",
         titre: "📋 Choisis la bonne forme",
         consigne: "Choisis la bonne réponse dans chaque menu.",
         melange: "non", voixQuestion: "Katja", questionVisible: true },
    4: { cle: "qchi", rendu: "ecrit",
         bouton: "Réponses libres",
         titre: "✍️ Réponses libres",
         consigne: "Écris ta réponse, ou complète le texte.",
         voixQuestion: "Katja", questionVisible: false, casseStricte: false }
  };

  function numeroDepuisCle(cle) {
    for (const n in TYPES) if (TYPES[n].cle === cle) return Number(n);
    const n = Number(cle);
    return TYPES[n] ? n : null;
  }

  /* ===============================
     3. ÉTAT
     =============================== */
  let donnees = null;            // JSON chargé
  let reglages = {};             // TYPES fusionnés avec donnees.quiz
  const instances = {};          // numéro → { zone, questions, rendus }
  let boutons = [];

  /* ===============================
     4. OUTILS
     =============================== */
  function el(tag, attrs, ...enfants) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
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

  function lsGet(cle) {
    try { return localStorage.getItem(cle); } catch (e) { return null; }
  }
  function lsSet(cle, v) {
    try { localStorage.setItem(cle, v); } catch (e) { /* stockage indisponible */ }
  }

  function dire(texte, voix) {
    if (!texte) return;
    if (window.AudioDE && typeof AudioDE.parler === "function") {
      return AudioDE.parler(texte, voix || "Katja");
    }
    if (typeof window.lireTexteAllemand === "function") {
      return window.lireTexteAllemand(texte, voix || "Katja");
    }
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = "de-DE";
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }

  function melangerTableau(t) {
    const r = t.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }

  // Retourne l'ordre d'affichage (indices d'origine)
  //   "non"            : ordre du JSON
  //   "oui"            : ordre aléatoire
  //   "jamaisPremiere" : la bonne réponse n'est jamais en position 1
  //                      (l'élève doit écouter au moins deux propositions)
  function ordreAffichage(n, bonne, mode) {
    const base = Array.from({ length: n }, (_, i) => i);
    if (mode === "oui") return melangerTableau(base);
    if (mode === "jamaisPremiere" && n >= 2 && bonne >= 0) {
      const autres = melangerTableau(base.filter(i => i !== bonne));
      const pos = 1 + Math.floor(Math.random() * (n - 1));
      autres.splice(pos, 0, bonne);
      return autres;
    }
    return base;
  }

  function normaliser(s, casseStricte) {
    let r = String(s || "").normalize("NFC")
      .replace(/ß/g, "ss").replace(/ẞ/g, "SS")   // écriture suisse : « ss » accepté pour « ß »
      .replace(/[’‘`´]/g, "'")
      .replace(/[.!?;:,«»"„“”()]/g, " ")   // la ponctuation ne compte pas
      .replace(/\s+/g, " ")
      .trim();
    if (!casseStricte) r = r.toLowerCase();
    return r;
  }

  function appartient(q, n) {
    return [].concat(q.quiz).map(Number).includes(n);
  }

  /* ===============================
     5. ANALYSE DES PHRASES À TROUS
        "Es [*regnet|regnen] den ganzen Tag."
        * marque la bonne réponse (à défaut : la première)
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

  /* ===============================
     6. VALIDATION D'UNE QUESTION POUR UN TYPE
     =============================== */
  function estQCM(q) {
    return Array.isArray(q.propositions) && q.propositions.length >= 2 &&
           Number.isInteger(q.bonne) && q.bonne >= 0 && q.bonne < q.propositions.length;
  }

  function valide(q, n) {
    const rendu = TYPES[n].rendu;
    if (rendu === "qcm" || rendu === "ecoute") return estQCM(q);
    if (rendu === "menus") return (typeof q.texte === "string" && /\[[^\]]+\]/.test(q.texte)) || estQCM(q);
    if (rendu === "ecrit") return (typeof q.texteLibre === "string" && /\[[^\]]+\]/.test(q.texteLibre)) ||
      (Array.isArray(q.reponses) && q.reponses.length > 0) || estQCM(q);
    return false;
  }

  /* ===============================
     7. RENDUS DES QUESTIONS
     Chaque rendu retourne { bloc, verifier(), reinitialiser() }
     verifier() → true (juste), false (faux), null (sans réponse)
     =============================== */

  function enteteQuestion(numero, q, cfg) {
    const texteQ = q.question || "";
    const p = el("p", { class: "quiz-entete" }, el("strong", { text: numero + ". " }));
    if (!texteQ) return p;

    p.appendChild(el("button", {
      type: "button", class: "btn-audio-question", title: "Écouter la question",
      onclick: () => dire(q.audio || texteQ, q.voix || cfg.voixQuestion)
    }, "🔊"));

    if (cfg.questionVisible) {
      p.appendChild(el("span", { class: "texte-question", text: " " + texteQ }));
    } else {
      const cache = el("span", { class: "texte-cache", style: "display:none;", text: " " + texteQ });
      p.appendChild(el("button", {
        type: "button", class: "btn-texte-aide", title: "Afficher le texte",
        onclick: () => { cache.style.display = "inline"; }
      }, "📄"));
      p.appendChild(cache);
    }
    return p;
  }

  function marquer(bloc, ok) {
    bloc.classList.remove("quiz-correct", "quiz-faux", "quiz-sans-reponse");
    bloc.classList.add(ok === true ? "quiz-correct" : ok === false ? "quiz-faux" : "quiz-sans-reponse");
  }

  /* ---------- Type 1 : QCM radio ---------- */
  function renduQCM(q, numero, cfg, nomGroupe) {
    const ordre = ordreAffichage(q.propositions.length, q.bonne, q.melange || cfg.melange);
    const bloc = el("div", { class: "quiz-question", "data-id": q.id });
    bloc.appendChild(enteteQuestion(numero, q, cfg));

    const labels = ordre.map(i => {
      const input = el("input", { type: "radio", name: nomGroupe, value: i });
      const lab = el("label", null, input, " " + q.propositions[i]);
      bloc.appendChild(lab);
      return { lab, input, i };
    });

    return {
      bloc,
      verifier() {
        const choisi = labels.find(l => l.input.checked);
        labels.forEach(l => {
          l.lab.classList.toggle("reponse-correcte", l.i === q.bonne);
          l.lab.classList.toggle("reponse-fausse", !!choisi && l === choisi && l.i !== q.bonne);
        });
        const ok = choisi ? choisi.i === q.bonne : null;
        marquer(bloc, ok);
        this.infos = { donnee: choisi ? q.propositions[choisi.i] : "", attendue: q.propositions[q.bonne] };
        return ok;
      },
      reinitialiser() {
        labels.forEach(l => {
          l.input.checked = false;
          l.lab.classList.remove("reponse-correcte", "reponse-fausse");
        });
        bloc.classList.remove("quiz-correct", "quiz-faux", "quiz-sans-reponse");
      }
    };
  }

  /* ---------- Type 2 : QCM à l'écoute ---------- */
  function renduEcoute(q, numero, cfg) {
    const ordre = ordreAffichage(q.propositions.length, q.bonne, q.melange || cfg.melange);
    const voix = q.voixPropositions || cfg.voixPropositions || ["Katja"];
    const bloc = el("div", { class: "quiz-question", "data-id": q.id });
    bloc.appendChild(enteteQuestion(numero, q, cfg));

    const zoneRep = el("div", { class: "quiz-reponses" });
    let choisi = null;

    const items = ordre.map((i, pos) => {
      const btn = el("button", { type: "button", class: "btn-reponse" },
        el("span", { class: "fake-radio" }),
        el("span", {
          class: "btn-audio-reponse", title: "Écouter la proposition",
          onclick: e => { e.stopPropagation(); dire(q.propositions[i], voix[pos % voix.length]); }
        }, "🔊"),
        el("span", { class: "reponse-texte", text: "Proposition " + (pos + 1) })
      );
      btn.addEventListener("click", () => {
        items.forEach(it => it.btn.classList.remove("selected"));
        btn.classList.add("selected");
        choisi = item;
      });
      const item = { btn, i };
      zoneRep.appendChild(btn);
      return item;
    });

    bloc.appendChild(zoneRep);

    return {
      bloc,
      verifier() {
        items.forEach(it => {
          it.btn.classList.toggle("reponse-correcte", it.i === q.bonne);
          it.btn.classList.toggle("reponse-fausse", it === choisi && it.i !== q.bonne);
        });
        const ok = choisi ? choisi.i === q.bonne : null;
        marquer(bloc, ok);
        this.infos = { donnee: choisi ? q.propositions[choisi.i] : "", attendue: q.propositions[q.bonne] };
        return ok;
      },
      reinitialiser() {
        choisi = null;
        items.forEach(it => it.btn.classList.remove("selected", "reponse-correcte", "reponse-fausse"));
        bloc.classList.remove("quiz-correct", "quiz-faux", "quiz-sans-reponse");
      }
    };
  }

  /* ---------- Type 3 : menus déroulants ---------- */
  function creerMenu(options, ordre) {
    const sel = el("select", { class: "quiz-menu", "aria-label": "Choisis la bonne forme" },
      el("option", { value: "", text: "…" }));
    ordre.forEach(i => sel.appendChild(el("option", { value: i, text: options[i] })));
    sel.addEventListener("change", () => {
      sel.classList.toggle("rempli", sel.value !== "");
      sel.classList.remove("reponse-correcte", "reponse-fausse");
    });
    return sel;
  }

  // ligne de correction : ✔ / ✘ + phrase juste + écoute
  function ligneCorrection(retour, ok, texteJuste, voix) {
    retour.textContent = "";
    if (ok === null) return;
    retour.appendChild(el("span", { class: ok ? "quiz-retour-ok" : "quiz-retour-faux", text: ok ? "✔ Juste" : "✘ Correction :" }));
    if (!ok) retour.appendChild(el("span", { class: "quiz-retour-phrase", text: " " + texteJuste + " " }));
    retour.appendChild(el("button", {
      type: "button", class: "btn-audio-mini", title: "Écouter la phrase juste",
      onclick: () => dire(texteJuste, voix)
    }, "🔊"));
  }

  function renduMenus(q, numero, cfg) {
    const bloc = el("div", { class: "quiz-question quiz-q3", "data-id": q.id });
    const menus = []; // { sel, bonne }
    let morceaux = null; // phrase à trous : pour recomposer réponse donnée / attendue
    const retour = el("div", { class: "quiz-retour", "aria-live": "polite" });

    if (typeof q.texte === "string" && /\[[^\]]+\]/.test(q.texte)) {
      // une consigne ou question facultative au-dessus de la phrase
      if (q.question) bloc.appendChild(enteteQuestion(numero, q, cfg));
      const p = el("p", { class: "quiz-phrase", lang: "de" });
      if (!q.question) p.appendChild(el("span", { class: "quiz-num", text: String(numero) }));
      morceaux = analyserTrous(q.texte);
      morceaux.forEach(m => {
        if (m.texte !== undefined) { p.appendChild(document.createTextNode(m.texte)); return; }
        const sel = creerMenu(m.options, ordreAffichage(m.options.length, m.bonne, q.melange || cfg.melange));
        m.sel = sel;
        menus.push({ sel, bonne: m.bonne });
        p.appendChild(sel);
      });
      bloc.appendChild(p);
    } else {
      bloc.appendChild(enteteQuestion(numero, q, cfg));
      const sel = creerMenu(q.propositions, ordreAffichage(q.propositions.length, q.bonne, q.melange || cfg.melange));
      menus.push({ sel, bonne: q.bonne });
      bloc.appendChild(el("p", { class: "quiz-phrase", lang: "de" }, sel));
    }
    bloc.appendChild(retour);

    return {
      bloc,
      verifier() {
        let toutRepondu = true, toutJuste = true;
        menus.forEach(m => {
          m.sel.classList.remove("reponse-correcte", "reponse-fausse");
          if (m.sel.value === "") { toutRepondu = false; toutJuste = false; return; }
          const juste = Number(m.sel.value) === m.bonne;
          m.sel.classList.add(juste ? "reponse-correcte" : "reponse-fausse");
          if (!juste) toutJuste = false;
        });
        const auMoinsUn = menus.some(m => m.sel.value !== "");
        const ok = !auMoinsUn ? null : (toutRepondu && toutJuste);
        marquer(bloc, ok);
        const choix = sel => (sel.value === "" ? "…" : sel.options[sel.selectedIndex].text);
        if (morceaux) {
          this.infos = {
            question: morceaux.map(m => m.texte !== undefined ? m.texte : "[…]").join(""),
            donnee: morceaux.map(m => m.texte !== undefined ? m.texte : choix(m.sel)).join(""),
            attendue: morceaux.map(m => m.texte !== undefined ? m.texte : m.options[m.bonne]).join("")
          };
        } else {
          this.infos = { donnee: choix(menus[0].sel), attendue: q.propositions[q.bonne] };
        }
        ligneCorrection(retour, ok, this.infos.attendue, q.voix || cfg.voixQuestion);
        return ok;
      },
      reinitialiser() {
        menus.forEach(m => { m.sel.value = ""; m.sel.classList.remove("reponse-correcte", "reponse-fausse", "rempli"); });
        retour.textContent = "";
        bloc.classList.remove("quiz-correct", "quiz-faux", "quiz-sans-reponse");
      }
    };
  }

  /* ---------- Type 4 : réponse écrite ---------- */
  function renduEcrit(q, numero, cfg) {
    if (typeof q.texteLibre === "string" && /\[[^\]]+\]/.test(q.texteLibre)) {
      return renduTrousLibres(q, numero, cfg);
    }
    const acceptees = Array.isArray(q.reponses) && q.reponses.length
      ? q.reponses
      : [q.propositions[q.bonne]];
    const casse = q.casseStricte ?? cfg.casseStricte;
    const modele = acceptees[acceptees.length - 1]; // la plus complète en dernier

    const bloc = el("div", { class: "quiz-question", "data-id": q.id });
    bloc.appendChild(enteteQuestion(numero, q, cfg));

    const input = el("input", {
      type: "text", class: "quiz-saisie", autocomplete: "off",
      spellcheck: "false", lang: "de", "aria-label": "Ta réponse"
    });
    const retour = el("div", { class: "quiz-retour" });
    bloc.appendChild(el("p", null, input));
    bloc.appendChild(retour);

    return {
      bloc,
      verifier() {
        retour.textContent = "";
        const saisie = normaliser(input.value, casse);
        if (!saisie) { marquer(bloc, null); return null; }
        const ok = acceptees.some(a => normaliser(a, casse) === saisie);
        marquer(bloc, ok);
        this.infos = { donnee: input.value.trim(), attendue: modele };
        retour.appendChild(el("span", { text: ok ? "✔ " : "✘ Réponse attendue : " + modele + " " }));
        retour.appendChild(el("button", {
          type: "button", class: "btn-audio-question", title: "Écouter la réponse modèle",
          onclick: () => dire(modele, q.voix || cfg.voixQuestion)
        }, "🔊"));
        return ok;
      },
      reinitialiser() {
        input.value = "";
        retour.textContent = "";
        bloc.classList.remove("quiz-correct", "quiz-faux", "quiz-sans-reponse");
      }
    };
  }

  /* ---------- Type 4 (variante) : texte à trous à compléter ---------- */
  function renduTrousLibres(q, numero, cfg) {
    const casse = q.casseStricte ?? cfg.casseStricte;
    const bloc = el("div", { class: "quiz-question quiz-q4-trous", "data-id": q.id });
    if (q.question) bloc.appendChild(enteteQuestion(numero, q, cfg));
    const p = el("p", { class: "quiz-phrase", lang: "de" });
    if (!q.question) p.appendChild(el("span", { class: "quiz-num", text: String(numero) }));

    const morceaux = analyserTrous(q.texteLibre);
    const trous = [];
    morceaux.forEach(m => {
      if (m.texte !== undefined) { p.appendChild(document.createTextNode(m.texte)); return; }
      const modele = m.options[m.bonne];
      const plusLong = Math.max(...m.options.map(o => o.length));
      const input = el("input", {
        type: "text", class: "quiz-trou", autocomplete: "off", spellcheck: "false", lang: "de",
        size: String(Math.max(4, plusLong + 2)), "aria-label": "Mot à compléter"
      });
      input.addEventListener("input", () => input.classList.remove("reponse-correcte", "reponse-fausse"));
      m.input = input;
      trous.push({ input, acceptees: m.options, modele });
      p.appendChild(input);
    });
    bloc.appendChild(p);
    const retour = el("div", { class: "quiz-retour", "aria-live": "polite" });
    bloc.appendChild(retour);

    return {
      bloc,
      verifier() {
        let toutRepondu = true, toutJuste = true;
        trous.forEach(t => {
          t.input.classList.remove("reponse-correcte", "reponse-fausse");
          const saisie = normaliser(t.input.value, casse);
          if (!saisie) { toutRepondu = false; toutJuste = false; return; }
          const juste = t.acceptees.some(a => normaliser(a, casse) === saisie);
          t.input.classList.add(juste ? "reponse-correcte" : "reponse-fausse");
          if (!juste) toutJuste = false;
        });
        const auMoinsUn = trous.some(t => normaliser(t.input.value, casse));
        const ok = !auMoinsUn ? null : (toutRepondu && toutJuste);
        marquer(bloc, ok);
        this.infos = {
          question: q.question || morceaux.map(m => m.texte !== undefined ? m.texte : "[…]").join(""),
          donnee: morceaux.map(m => m.texte !== undefined ? m.texte : (m.input.value.trim() || "…")).join(""),
          attendue: morceaux.map(m => m.texte !== undefined ? m.texte : m.options[m.bonne]).join("")
        };
        ligneCorrection(retour, ok, this.infos.attendue, q.voix || cfg.voixQuestion);
        return ok;
      },
      reinitialiser() {
        trous.forEach(t => { t.input.value = ""; t.input.classList.remove("reponse-correcte", "reponse-fausse"); });
        retour.textContent = "";
        bloc.classList.remove("quiz-correct", "quiz-faux", "quiz-sans-reponse");
      }
    };
  }

  const RENDUS = { qcm: renduQCM, ecoute: renduEcoute, menus: renduMenus, ecrit: renduEcrit };

  /* ===============================
     8. CONSTRUCTION D'UN QUIZ DANS SA ZONE
     =============================== */
  function questionsDuType(n) {
    if (!donnees || !Array.isArray(donnees.questions)) return [];
    return donnees.questions.filter(q => {
      if (!q || !appartient(q, n)) return false;
      if (!valide(q, n)) {
        console.warn(`[Quiz] question "${q.id}" ignorée dans le quiz ${n} : format incomplet`);
        return false;
      }
      return true;
    });
  }

  function construire(n) {
    const cfg = reglages[n];
    const zone = document.getElementById("zone-" + cfg.cle);
    if (!zone) return null;

    const questions = questionsDuType(n);
    zone.textContent = "";

    // bouton « Écouter le texte » sous la consigne : il actionne le bouton général ▶️ Écouter
    // (par défaut dans le quiz 1 ; réglable par quiz avec "ecouteTexte": true/false dans le JSON)
    const avecEcoute = (cfg.ecouteTexte ?? (n === 1)) && document.getElementById("btn-ecouter");
    const boutonEcoute = avecEcoute ? el("button", {
      type: "button", class: "quiz-ecoute-texte",
      title: "Écouter le texte (même effet que ▶️ Écouter dans la barre latérale)",
      onclick: () => document.getElementById("btn-ecouter").click()
    }, el("span", { class: "quiz-ecoute-icone", "aria-hidden": "true" }, "▶"), " Écouter le texte") : null;

    const conteneur = el("div", { class: "quiz-comp quiz-type-" + n },
      el("h3", { text: cfg.titre }),
      cfg.consigne || boutonEcoute
        ? el("div", { class: "quiz-consigne-ligne" },
            cfg.consigne ? el("p", { class: "quiz-consigne", text: cfg.consigne }) : null,
            boutonEcoute)
        : null
    );
    const form = el("form", { class: "quiz-form", onsubmit: e => e.preventDefault() });
    const resultat = el("div", { class: "quiz-resultat", "aria-live": "polite" });

    const rendus = questions.map((q, idx) =>
      RENDUS[cfg.rendu](q, idx + 1, cfg, `${RACINE}-q${n}-${q.id}`)
    );
    rendus.forEach(r => form.appendChild(r.bloc));

    const btnVerifier = el("button", { type: "button", class: "quiz-valider" }, "Vérifier");
    const btnRecommencer = el("button", { type: "button", class: "quiz-recommencer" }, "Recommencer");

    btnVerifier.addEventListener("click", () => {
      let score = 0;
      rendus.forEach((r, idx) => {
        const ok = r.verifier();
        if (ok === true) {
          score++;
          crediter(n, questions[idx]);
        } else if (ok === false) {
          noterErreur(n, questions[idx], r.infos || {});
        }
      });
      resultat.textContent = "";
      resultat.appendChild(el("p", null, el("strong", { text: "Score : " }), score + " / " + rendus.length));
    });

    btnRecommencer.addEventListener("click", () => recommencer(n));

    conteneur.appendChild(form);
    conteneur.appendChild(el("div", { class: "quiz-actions" }, btnVerifier, " ", btnRecommencer));
    conteneur.appendChild(resultat);
    zone.appendChild(conteneur);

    instances[n] = { zone, questions, rendus };
    return instances[n];
  }

  function recommencer(n) {
    n = numeroDepuisCle(n);
    if (!n || !instances[n]) return;
    // reconstruit : nouvel ordre si mélange, champs vidés
    construire(n);
  }

  // Score global (scoreManager) : chaque question réussie compte une seule fois
  // Erreur notée pour la séance (une même mauvaise réponse ne compte qu'une fois)
  function noterErreur(n, q, infos) {
    if (!window.scoreManager || typeof scoreManager.erreur !== "function") return;
    const donnee = String(infos.donnee || "");
    scoreManager.erreur(`quiz${n}:${q.id}:${normaliser(donnee, false)}`, {
      quiz: n,
      titreQuiz: (reglages[n] && reglages[n].titre) || "",
      id: q.id,
      question: infos.question || q.question || q.texte || "",
      donnee,
      attendue: String(infos.attendue || "")
    });
  }

  function crediter(n, q) {
    if (!window.scoreManager || typeof scoreManager.add !== "function") return;
    const label = `quiz${n}:${q.id}`;
    const deja = typeof scoreManager.getLog === "function" &&
                 scoreManager.getLog().some(e => e.label === label);
    if (!deja) scoreManager.add(1, label);
  }

  /* ===============================
     9. BARRE LATÉRALE : boutons + zones
     =============================== */
  function fermerTout() {
    document.querySelectorAll(".zone-quiz.open").forEach(z => z.classList.remove("open"));
    boutons.forEach(b => b.classList.remove("active"));
  }

  function ouvrir(type) {
    const n = numeroDepuisCle(type);
    if (!n) return;
    const cle = reglages[n].cle;
    const btn = boutons.find(b => b.dataset.type === cle);
    const zone = document.getElementById("zone-" + cle);
    if (!zone) return;
    if (btn && btn.getAttribute("aria-disabled") === "true") return;

    const etaitOuvert = zone.classList.contains("open");
    fermerTout();
    if (etaitOuvert) return;

    if (!instances[n]) construire(n);
    zone.classList.add("open");
    if (btn) btn.classList.add("active");
  }

  function setEnabled(type, actif) {
    const n = numeroDepuisCle(type);
    if (!n) return;
    const cle = reglages[n].cle;
    const btn = boutons.find(b => b.dataset.type === cle);
    if (!btn) return;
    btn.setAttribute("aria-disabled", actif ? "false" : "true");
    if (!actif) {
      btn.classList.remove("active");
      document.getElementById("zone-" + cle)?.classList.remove("open");
    }
  }

  /* ===============================
     10. CASES D'ACTIVATION
     priorité : choix mémorisé (par page) > "actif" du JSON > activé
     Un quiz sans question reste toujours grisé.
     =============================== */
  function cleStockage(cle) {
    return RACINE + "::quiz::" + cle;
  }


  function etatCase(n) {
    const cle = reglages[n].cle;
    const memo = lsGet(cleStockage(cle));
    if (memo !== null) return memo === "true";
    if (typeof reglages[n].actif === "boolean") return reglages[n].actif;
    return true;
  }

  function appliquerEtats() {
    const box = document.getElementById("quiz-filter-box");
    Object.keys(TYPES).map(Number).forEach(n => {
      const cle = reglages[n].cle;
      const aDesQuestions = questionsDuType(n).length > 0;
      const coche = etatCase(n);
      const cb = box && box.querySelector(`input[type="checkbox"][data-quiz="${cle}"]`);
      if (cb) cb.checked = coche;
      setEnabled(n, coche && aDesQuestions);
    });
  }

  // libellés génériques des boutons et des cases, modifiables dans le JSON ("bouton")
  function appliquerLibelles() {
    const box = document.getElementById("quiz-filter-box");
    Object.keys(TYPES).map(Number).forEach(n => {
      const r = reglages[n] || TYPES[n];
      const libelle = String(r.bouton || TYPES[n].bouton).trim();
      boutons.filter(b => b.dataset.type === r.cle).forEach(b => {
        b.textContent = libelle;
        b.title = (r.titre || "").replace(/^\W+\s*/u, "") || libelle;
      });
      const cb = box && box.querySelector(`input[type="checkbox"][data-quiz="${r.cle}"]`);
      const lab = cb && cb.closest("label");
      if (lab) {
        Array.from(lab.childNodes).forEach(nd => { if (nd !== cb) nd.remove(); });
        lab.appendChild(document.createTextNode(" " + n + " · " + libelle));
      }
    });
  }

  function brancherCases() {
    const box = document.getElementById("quiz-filter-box");
    if (!box) return;
    box.querySelectorAll('input[type="checkbox"][data-quiz]').forEach(cb => {
      cb.addEventListener("change", () => {
        const n = numeroDepuisCle(cb.dataset.quiz);
        if (!n) return;
        lsSet(cleStockage(cb.dataset.quiz), cb.checked);
        setEnabled(n, cb.checked && questionsDuType(n).length > 0);
      });
    });
  }


  /* ===============================
     12. CHARGEMENT DU JSON
     =============================== */
  let boiteJSON = null;

  function afficherBoiteJSON(message) {
    const hote = document.getElementById("zone-quiz-sidebar") || document.body;
    if (!boiteJSON) {
      const input = el("input", { type: "file", accept: ".json,application/json", style: "display:none;" });
      input.addEventListener("change", () => {
        const f = input.files && input.files[0];
        if (!f) return;
        if (f.name !== FICHIER_JSON) {
          console.warn(`[Quiz] fichier choisi "${f.name}" ≠ "${FICHIER_JSON}" attendu`);
        }
        const lecteur = new FileReader();
        lecteur.onload = () => {
          try {
            charger(JSON.parse(lecteur.result));
          } catch (e) {
            afficherBoiteJSON("Fichier JSON invalide : " + e.message);
          }
          input.value = "";
        };
        lecteur.readAsText(f, "utf-8");
      });

      boiteJSON = el("div", { id: "quiz-json-box", class: "quiz-json-box", "data-injecte-par": "Quiz" },
        el("div", { class: "quiz-json-message" }),
        el("button", { type: "button", class: "quiz-json-bouton", onclick: () => input.click() },
          "📂 Charger " + FICHIER_JSON),
        input
      );
      hote.insertBefore(boiteJSON, hote.firstChild);
    }
    boiteJSON.querySelector(".quiz-json-message").textContent = message || "";
    boiteJSON.hidden = false;
    document.dispatchEvent(new CustomEvent("quiz:echec", { detail: { message: message || "" } }));
  }

  function masquerBoiteJSON() {
    if (boiteJSON) boiteJSON.hidden = true;
  }

  function charger(objet) {
    if (!objet || typeof objet !== "object" || (!Array.isArray(objet.questions) && !objet.texte)) {
      afficherBoiteJSON("Le fichier ne contient ni texte ni liste \"questions\".");
      return false;
    }
    if (!Array.isArray(objet.questions)) objet.questions = [];
    donnees = objet;

    // texte de l'exercice (bloc "texte") : construit AVANT l'événement "quiz:charge"
    if (window.Texte && typeof Texte.afficher === "function") Texte.afficher(objet);

    // fusion des réglages
    reglages = {};
    Object.keys(TYPES).forEach(n => {
      reglages[n] = Object.assign({}, TYPES[n], (objet.quiz && objet.quiz[n]) || {});
      reglages[n].cle = TYPES[n].cle;     // la clé reste liée au HTML
      reglages[n].rendu = TYPES[n].rendu; // le rendu reste lié au numéro
    });

    // reconstruire ce qui était déjà affiché
    Object.keys(instances).forEach(n => delete instances[n]);
    document.querySelectorAll(".zone-quiz").forEach(z => {
      const n = numeroDepuisCle(z.id.replace(/^zone-/, ""));
      if (n) { z.textContent = ""; if (z.classList.contains("open")) construire(n); }
    });

    appliquerLibelles();
    appliquerEtats();
    masquerBoiteJSON();

    // liste des questions pour le suivi de la séance (séance terminée = tout a été tenté)
    if (window.scoreManager && typeof scoreManager.definirQuestions === "function") {
      const cles = [];
      Object.keys(TYPES).map(Number).forEach(n => {
        questionsDuType(n).forEach(q => cles.push(`quiz${n}:${q.id}`));
      });
      scoreManager.definirQuestions(cles);
    }
    console.log(`[Quiz] ${FICHIER_JSON} chargé : ${objet.questions.length} question(s)`);
    document.dispatchEvent(new CustomEvent("quiz:charge", { detail: { racine: RACINE } }));
    return true;
  }

  function chargerAuto() {
    // en file://, certains navigateurs refusent fetch : le bouton manuel prend le relais
    fetch(FICHIER_JSON, { cache: "no-cache" })
      .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(charger)
      .catch(err => {
        console.warn(`[Quiz] chargement automatique de ${FICHIER_JSON} impossible :`, err.message);
        // fichier choisi dans la liste des exercices (local) ou dernier exercice gardé (Partage.Choix.js)
        const garde = window.ChoixExercices && ChoixExercices.contenuEnCache(RACINE);
        if (garde && charger(garde)) { console.log(`[Quiz] ${FICHIER_JSON} repris de la copie gardée`); return; }
        afficherBoiteJSON(`${FICHIER_JSON} introuvable ou illisible.`);
      });
  }

  /* ===============================
     13. STYLE MINIMAL DES CORRECTIONS
     (format.css peut tout redéfinir)
     =============================== */
  function injecterStyle() {
    if (document.getElementById("quiz-style-defaut")) return;
    const css = `
      .quiz-question{margin-bottom:14px;padding:6px 8px;border-radius:8px;border-left:4px solid transparent}
      .quiz-question.quiz-correct{border-left-color:#3a8f5c}
      .quiz-question.quiz-faux{border-left-color:#c0392b}
      .quiz-question.quiz-sans-reponse{border-left-color:#c47a2c}
      .reponse-correcte{outline:2px solid #3a8f5c;border-radius:6px}
      .reponse-fausse{outline:2px solid #c0392b;border-radius:6px}
      .quiz-menu{font-size:1em;margin:0 4px}
      .quiz-saisie{font-size:1.05em;padding:4px 8px;min-width:280px}
      .quiz-actions{margin-top:10px}
      .quiz-json-box{border:1px dashed #c47a2c;border-radius:8px;padding:8px;margin-bottom:10px;background:#fff8ef;font-size:.9rem}
      .quiz-json-bouton{width:100%;margin-top:6px;padding:6px;cursor:pointer}
    `;
    const s = el("style", { id: "quiz-style-defaut", "data-injecte-par": "Quiz" });
    s.textContent = css;
    document.head.insertBefore(s, document.head.firstChild);
  }

  /* ===============================
     14. DÉMARRAGE
     =============================== */
  function demarrer() {
    // réglages par défaut tant que le JSON n'est pas là
    Object.keys(TYPES).forEach(n => { reglages[n] = Object.assign({}, TYPES[n]); });

    injecterStyle();

    boutons = Array.from(document.querySelectorAll(".quiz-nav-btn[data-type]"));
    boutons.forEach(b => {
      b.setAttribute("aria-disabled", "true"); // grisés jusqu'au chargement
      b.addEventListener("click", () => ouvrir(b.dataset.type));
    });

    appliquerLibelles();
    brancherCases();
    // page d'accueil (liste des exercices, sans ?exo=) : rien à charger,
    // sauf si Partage.Choix.js ne trouve aucune série (ancien Racine.json)
    if (window.CHOIX_EXERCICES && !window.EXO) document.addEventListener("choix:aucun", chargerAuto, { once: true });
    else chargerAuto();
  }

  /* ===============================
     API PUBLIQUE
     =============================== */
  window.Quiz = {
    racine: RACINE,
    fichierJSON: FICHIER_JSON,
    charger,
    donnees: () => (donnees ? JSON.parse(JSON.stringify(donnees)) : null),
    ouvrir,
    setEnabled,
    recommencer
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }

})();
