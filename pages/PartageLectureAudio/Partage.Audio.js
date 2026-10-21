/* =====================================================
   Partage.Audio.js  (commun à tous les exercices, ALLEMAND, ANGLAIS, FRANÇAIS)
   Version propre à un exercice possible : NomdeRef.Audio.js (prioritaire)
   Remplace Partage.AudioDe.js (et la copie anglaise Partage.AudioEn.js).
   L'objet s'appelle toujours AudioDE (les autres modules l'appellent ainsi).

   Langue de l'exercice
   - "langue" du JSON : "de", "en" ou "fr" (Texte.afficher appelle AudioDE.definirLangue) ;
   - sans ce champ : déduite des voix du texte (Katja → de, Libby → en, Vivienne → fr),
     sinon allemand.
   - Un nom de voix est d'abord cherché dans la langue de l'exercice, puis dans ses
     anciens noms (Katja dans un texte anglais → Libby), puis dans les autres langues.

   Principes
   - UNE table de personnages par langue ; en anglais et en français,
     un personnage = une voix réelle (allemand : variantes de Katja + Conrad)
   - choix de la voix : la voix du personnage, puis les voix testées en classe
     du même genre, puis les autres voix de la langue (jamais les voix refusées)
   - voix « Online » d'Edge qui échoue au hasard : on réessaie, puis on passe
     à une autre voix (celle qui échoue deux fois est écartée pour la séance)
   - UNE attente du chargement des voix (délai maximal + avertissement)
   - UN seul propriétaire de la parole : toute nouvelle lecture
     invalide proprement la précédente (jeton de génération)

   API publique : window.AudioDE
     AudioDE.parler(texte, profil?, options?)      → Promise<boolean>
     AudioDE.lireDialogue(lignes, onHighlight?, { debut, onFin }?) → Promise
     AudioDE.pauseOuReprendre()                    → "pause" | "lecture" | undefined
     AudioDE.arreter()
     AudioDE.etat()                                → "lecture" | "pause" | "arret"
     AudioDE.langue()                              → "de" | "en" | "fr"
     AudioDE.definirLangue(code)                   → règle la langue (événement "audiode:langue")
     AudioDE.langueDuProfil(nom)                   → langue d'un nom de voix (ou null)
     AudioDE.roles(langue?)                        → voix par défaut : { defaut, jeune, narrateur,
                                                     homme, voixA, voixB, propositions }
     AudioDE.profils(langue?)                      → ["Katja", …]
     AudioDE.profilsDetail(langue?)                → [{ nom, role }, …]
     AudioDE.diagnostic()                          → tableau profil → voix (console)
     AudioDE.vitesse(), AudioDE.definirVitesse(v, memoriser?)

   Compatibilité (anciens noms, toujours disponibles)
     lireDialogueVoixAllemandesAvecSurlignage, pauseOuReprendre, lireTexteAllemand,
     lireTexteSimple, VoicesDE.createUtterance

   ⚠️ Ne redéfinir AUCUNE de ces fonctions dans un autre fichier.
   ===================================================== */

const AudioDE = (function () {

  /* ===============================
     1. LANGUES ET PERSONNAGES – source unique
     re     : nom de la voix réelle cherchée en priorité
     genre  : "f" ou "m"
     testees: voix entendues lors d'un test en classe, dans l'ordre de préférence
     exclues: voix refusées, jamais utilisées
     =============================== */
  const LANGUES = {
    de: {
      nom: "allemand", code: "de-DE",
      profils: {
        Katja:       { re: /\bkatja\b/i,  genre: "f", rate: 1.0,  pitch: 1.0,  role: "femme (voix par défaut)" },
        KatjaM:      { re: /\bkatja\b/i,  genre: "f", rate: 1.1,  pitch: 1.25, role: "fille, adolescente" },
        KatjaN:      { re: /\bkatja\b/i,  genre: "f", rate: 0.98, pitch: 0.95, role: "narratrice" },
        KatjaRapide: { re: /\bkatja\b/i,  genre: "f", rate: 1.2,  pitch: 1.05, role: "débit rapide" },
        Conrad:      { re: /\bconrad\b/i, genre: "m", rate: 1.0,  pitch: 0.9,  role: "homme, garçon" }
      },
      alias: { KatjaNarratif: "KatjaN", Libby: "Katja", Maisie: "KatjaM", Sonia: "KatjaN",
               Ryan: "Conrad", Denise: "Katja", Eloise: "KatjaM", Vivienne: "KatjaN", Henri: "Conrad" },
      roles: { defaut: "Katja", jeune: "KatjaM", narrateur: "KatjaN", homme: "Conrad",
               voixA: "KatjaM", voixB: "Conrad", propositions: ["Katja", "Conrad"] },
      testees: [],
      exclues: [],
      genre: {
        f: /\b(katja|amala|seraphina|hedda|anna|petra|helena|marlene|vicki|female|frau|weiblich)\b/i,
        m: /\b(conrad|killian|florian|stefan|markus|martin|yannick|hans|male|mann|männlich)\b/i
      }
    },
    en: {
      nom: "anglais", code: "en-GB",
      profils: {
        Libby:       { re: /\bLibby\b/i,   genre: "f", rate: 0.95, pitch: 1.0, role: "femme (voix par défaut)" },
        Sonia:       { re: /\bSonia\b/i,   genre: "f", rate: 0.95, pitch: 1.0, role: "narratrice, femme" },
        Maisie:      { re: /\bMaisie\b/i,  genre: "f", rate: 0.95, pitch: 1.0, role: "voix d'enfant très marquée (déconseillée)" },
        Natasha:     { re: /\bNatasha\b/i, genre: "f", rate: 0.95, pitch: 1.0, role: "femme, accent australien" },
        Yan:         { re: /\bYan\b/i,     genre: "f", rate: 0.95, pitch: 1.0, role: "femme, accent de Hong Kong" },
        Ryan:        { re: /\bRyan\b/i,    genre: "m", rate: 0.95, pitch: 1.0, role: "homme" },
        Thomas:      { re: /\bThomas\b/i,  genre: "m", rate: 0.95, pitch: 1.0, role: "homme" },
        Liam:        { re: /\bLiam\b/i,    genre: "m", rate: 0.95, pitch: 1.0, role: "garçon, jeune homme, accent canadien" },
        William:     { re: /\bWilliam\b/i, genre: "m", rate: 0.95, pitch: 1.0, role: "homme, accent australien" },
        LibbyRapide: { re: /\bLibby\b/i,   genre: "f", rate: 1.15, pitch: 1.0, role: "débit rapide" }
      },
      alias: { LibbyM: "Libby", LibbyN: "Sonia",
               Katja: "Libby", KatjaM: "Libby", KatjaN: "Sonia", KatjaNarratif: "Sonia",
               KatjaRapide: "LibbyRapide", Conrad: "Ryan",
               Denise: "Libby", Eloise: "Libby", Vivienne: "Sonia", Henri: "Ryan" },
      // pas de voix d'enfant par défaut (Maisie : trop caricaturale)
      roles: { defaut: "Libby", jeune: "Libby", narrateur: "Sonia", homme: "Ryan",
               voixA: "Libby", voixB: "Liam", propositions: ["Libby", "Thomas"] },
      // test en classe (VocEN_9H_unit1) : britannique, puis canadien, australien, Hong Kong
      testees: [
        { re: /\bLibby\b/i, genre: "f" }, { re: /\bSonia\b/i, genre: "f" },
        { re: /\bRyan Online/i, genre: "m" }, { re: /\bThomas\b/i, genre: "m" },
        { re: /\bLiam\b/i, genre: "m" },
        { re: /\bNatasha\b/i, genre: "f" }, { re: /\bWilliam Online/i, genre: "m" },
        { re: /\bWilliam Multilingual/i, genre: "m" }, { re: /\bYan\b/i, genre: "f" },
        { re: /\bMaisie\b/i, genre: "f" }
      ],
      exclues: [/\bClara\b/i, /\bSam Online/i],
      genre: {
        f: /\b(libby|sonia|maisie|natasha|yan|hazel|susan|jenny|aria|ava|emma|nancy|sara|samantha|karen|moira|tessa|serena|kate|zira|female|woman)\b/i,
        m: /\b(ryan|thomas|liam|william|george|guy|davis|tony|andrew|brian|daniel|oliver|arthur|alex|fred|mark|david|james|male|man)\b/i
      }
    },
    fr: {
      nom: "français", code: "fr-FR",
      // test en classe du 21.10.2026 (Edge) : une vraie voix par personnage
      profils: {
        Vivienne: { re: /\bVivienne\b/i,  genre: "f", rate: 1.0, pitch: 1.0, role: "femme (voix par défaut)" },
        Julie:    { re: /\bJulie\b/i,     genre: "f", rate: 1.0, pitch: 1.0, role: "narratrice, femme (voix installée)" },
        Eloise:   { re: /\bElo[iï]se\b/i, genre: "f", rate: 1.0, pitch: 1.0, role: "voix d'enfant très marquée (déconseillée)" },
        Denise:   { re: /\bDenise\b/i,    genre: "f", rate: 1.0, pitch: 1.0, role: "jeune femme, fille, adolescente" },
        Charline: { re: /\bCharline\b/i,  genre: "f", rate: 1.0, pitch: 1.0, role: "femme, accent belge" },
        Ariane:   { re: /\bAriane\b/i,    genre: "f", rate: 1.0, pitch: 1.0, role: "femme, accent suisse" },
        Henri:    { re: /\bHenri\b/i,     genre: "m", rate: 1.0, pitch: 1.0, role: "homme" },
        Remy:     { re: /\bR[eé]m[iy]\b/i, genre: "m", rate: 1.0, pitch: 1.0, role: "autre homme" },
        Gerard:   { re: /\bG[eé]rard\b/i, genre: "m", rate: 1.0, pitch: 1.0, role: "homme, accent belge" },
        Antoine:  { re: /\bAntoine\b/i,   genre: "m", rate: 1.0, pitch: 1.0, role: "homme, accent québécois" },
        Fabrice:  { re: /\bFabrice\b/i,   genre: "m", rate: 1.0, pitch: 1.0, role: "homme, accent suisse" }
      },
      alias: { Katja: "Vivienne", KatjaM: "Denise", KatjaN: "Julie", KatjaNarratif: "Julie",
               KatjaRapide: "Vivienne", Conrad: "Henri",
               Libby: "Vivienne", Maisie: "Denise", Sonia: "Julie", Ryan: "Henri", Thomas: "Remy",
               Liam: "Antoine", William: "Gerard", Natasha: "Charline", Yan: "Ariane", LibbyRapide: "Vivienne",
               Sylvie: "Denise", Jean: "Antoine", Thierry: "Antoine", Paul: "Henri", Hortense: "Julie", Guillaume: "Fabrice" },
      // pas de voix d'enfant par défaut (Eloise : trop caricaturale)
      roles: { defaut: "Vivienne", jeune: "Denise", narrateur: "Julie", homme: "Henri",
               voixA: "Denise", voixB: "Henri", propositions: ["Vivienne", "Henri"] },
      // entendues au test : « bonne » d'abord, puis « oui », puis « bof » (secours)
      testees: [
        { re: /\bVivienne\b/i, genre: "f" }, { re: /\bHenri\b/i, genre: "m" },
        { re: /\bJulie\b/i, genre: "f" }, { re: /\bR[eé]m[iy]\b/i, genre: "m" },
        { re: /\bCharline\b/i, genre: "f" }, { re: /\bG[eé]rard\b/i, genre: "m" },
        { re: /\bAntoine\b/i, genre: "m" }, { re: /\bDenise\b/i, genre: "f" },
        { re: /\bAriane\b/i, genre: "f" }, { re: /\bFabrice\b/i, genre: "m" },
        { re: /\bSylvie\b/i, genre: "f" },
        { re: /\bJean\b/i, genre: "m" }, { re: /\bThierry\b/i, genre: "m" },
        { re: /\bHortense\b/i, genre: "f" }, { re: /\bPaul\b/i, genre: "m" },
        { re: /\bGuillaume\b/i, genre: "m" },
        { re: /\bElo[iï]se\b/i, genre: "f" }
      ],
      // muettes au test (erreur « synthesis-failed ») : jamais utilisées
      exclues: [/\bAlain\b/i, /\bBrigitte\b/i, /\bC[eé]leste\b/i, /\bClaude\b/i, /\bCoralie\b/i,
                /\bJacqueline\b/i, /\bJ[eé]r[oô]me\b/i, /\bJos[eé]phine\b/i, /\bLucien\b/i,
                /\bMaurice\b/i, /\bYves\b/i, /\bYvette\b/i],
      genre: {
        f: /\b(vivienne|julie|elo[iï]se|denise|charline|ariane|sylvie|hortense|am[eé]lie|marie|google fran[cç]ais|female|femme)\b/i,
        m: /\b(henri|r[eé]m[iy]|g[eé]rard|antoine|fabrice|jean|thierry|paul|guillaume|male|homme)\b/i
      }
    }
  };
  const LANGUE_DEFAUT = "de";
  let langueCourante = LANGUE_DEFAUT;

  function codeLangue(l) {
    l = String(l || "").toLowerCase().slice(0, 2);
    return LANGUES[l] ? l : null;
  }
  function definirLangue(l) {
    const c = codeLangue(l) || LANGUE_DEFAUT;
    if (c !== langueCourante) {
      langueCourante = c;
      document.documentElement.setAttribute("data-langue", c);
    }
    document.dispatchEvent(new CustomEvent("audiode:langue", { detail: { langue: c } }));
    return c;
  }
  // langue d'un nom de voix : d'abord comme personnage, puis comme ancien nom
  function langueDuProfil(nom) {
    if (!nom) return null;
    for (const l in LANGUES) if (LANGUES[l].profils[nom]) return l;
    return null;
  }
  function roles(l) {
    return Object.assign({}, LANGUES[codeLangue(l) || langueCourante].roles);
  }

  const PAUSES = { courte: 300, moyenne: 700, longue: 1200 };

  const DELAI_MAX_VOIX = 2000;   // attente maximale du chargement des voix (ms)
  const DELAI_APRES_CANCEL = 60; // évite certains silences après cancel()

  const synth = window.speechSynthesis || null;

  /* ===============================
     VITESSE GLOBALE (curseur de la page)
     =============================== */
  const VITESSE_MIN = 0.5, VITESSE_MAX = 1.5;
  const CLE_VITESSE = (window.RACINE_EXERCICE || (decodeURIComponent(location.pathname.split("/").pop() || "").split(".")[0]) || "index") + "::vitesse";
  let facteurVitesse = 1;

  function bornerVitesse(v) {
    v = Number(v);
    if (!isFinite(v) || v <= 0) return 1;
    return Math.round(Math.min(VITESSE_MAX, Math.max(VITESSE_MIN, v)) * 100) / 100;
  }
  function vitesseMemorisee() {
    try {
      const v = localStorage.getItem(CLE_VITESSE);
      return v === null ? null : bornerVitesse(v);
    } catch (e) { return null; }
  }
  function definirVitesse(v, memoriser) {
    facteurVitesse = bornerVitesse(v);
    if (memoriser) {
      try { localStorage.setItem(CLE_VITESSE, String(facteurVitesse)); } catch (e) { /* mémo impossible */ }
    }
    document.dispatchEvent(new CustomEvent("audiode:vitesse", { detail: { vitesse: facteurVitesse } }));
    return facteurVitesse;
  }
  // valeur par défaut de l'exercice (JSON) : appliquée seulement sans choix mémorisé
  function vitesseParDefaut(v) {
    if (vitesseMemorisee() === null) definirVitesse(v === undefined ? 1 : v, false);
    return facteurVitesse;
  }
  { const m = vitesseMemorisee(); if (m !== null) facteurVitesse = m; }


  /* ===============================
     2. PERSONNAGES : résolution
     Ordre : personnage de la langue de l'exercice, ancien nom de cette langue,
     personnage d'une autre langue, sinon voix par défaut de la langue.
     =============================== */
  const inconnusSignales = new Set();

  function resoudreProfil(nom) {
    const L = LANGUES[langueCourante];
    if (!nom) nom = L.roles.defaut;
    if (L.profils[nom]) return { cle: nom, langue: langueCourante, ...L.profils[nom] };
    if (L.alias[nom] && L.profils[L.alias[nom]]) {
      const c = L.alias[nom];
      return { cle: c, langue: langueCourante, ...L.profils[c] };
    }
    const autre = langueDuProfil(nom);
    if (autre) return { cle: nom, langue: autre, ...LANGUES[autre].profils[nom] };
    if (!inconnusSignales.has(nom)) {
      inconnusSignales.add(nom);
      console.warn(`[AudioDE] voix inconnue "${nom}" → réglages de ${L.roles.defaut}`);
    }
    // nom inconnu : on tente quand même une voix portant ce nom
    const propre = String(nom).replace(/[^\w ]/g, "");
    return { ...L.profils[L.roles.defaut], cle: nom, langue: langueCourante,
             re: propre ? new RegExp("\\b" + propre + "\\b", "i") : null };
  }

  /* ===============================
     3. VOIX : chargement + choix
     =============================== */
  let voixParLangue = { de: [], en: [], fr: [] };  // voix utilisables, testées d'abord, puis variante principale
  const voixEchouees = new Set();   // voix qui ont échoué pendant cette séance
  let cacheChoix = {};              // "langue:personnage" → voix choisie
  let pretOK = false;
  let attenteEchouee = false;
  let promessePret = null;

  const langueDe = v => (v.lang || "").replace("_", "-").toLowerCase();
  function rangTeste(L, v) {
    const i = L.testees.findIndex(t => t.re.test(v.name || ""));
    return i < 0 ? 99 : i;
  }
  function genreTeste(L, v) {
    const t = L.testees.find(t => t.re.test(v.name || ""));
    return t ? t.genre : null;
  }

  function rafraichirVoix() {
    if (!synth) return;
    const toutes = synth.getVoices() || [];
    for (const l in LANGUES) {
      const L = LANGUES[l], principale = L.code.toLowerCase();
      const pr = v => langueDe(v) === principale ? 0 : 1;
      voixParLangue[l] = toutes
        .filter(v => langueDe(v).startsWith(l) && !L.exclues.some(re => re.test(v.name || "")))
        .sort((a, b) => (rangTeste(L, a) - rangTeste(L, b)) || (pr(a) - pr(b)));
    }
    cacheChoix = {};
    if (toutes.length) pretOK = true;
  }

  if (synth) {
    // addEventListener : ne remplace aucun autre écouteur
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", rafraichirVoix);
    }
    rafraichirVoix();
  }

  function pret() {
    if (!synth) {
      console.warn("[AudioDE] synthèse vocale non disponible dans ce navigateur");
      return Promise.resolve(false);
    }
    if (pretOK || attenteEchouee) return Promise.resolve(pretOK);
    if (promessePret) return promessePret;

    promessePret = new Promise(resolve => {
      const debut = Date.now();
      (function verifier() {
        rafraichirVoix();
        if (pretOK) {
          if (!voixParLangue[langueCourante].length) {
            console.warn("[AudioDE] aucune voix " + LANGUES[langueCourante].nom + " installée → voix par défaut du navigateur");
          }
          return resolve(true);
        }
        if (Date.now() - debut >= DELAI_MAX_VOIX) {
          attenteEchouee = true;
          console.warn("[AudioDE] aucune voix chargée après " + DELAI_MAX_VOIX +
                       " ms → lecture avec la voix par défaut du navigateur");
          return resolve(false);
        }
        setTimeout(verifier, 100);
      })();
    });
    return promessePret;
  }

  // voix possibles pour un personnage, dans l'ordre d'essai (celles qui ont échoué en dernier)
  function candidates(p) {
    const L = LANGUES[p.langue];
    const voix = voixParLangue[p.langue] || [];
    const autreGenre = p.genre === "m" ? "f" : "m";
    const genreDe = x => genreTeste(L, x) || (L.genre[p.genre].test(x.name || "") ? p.genre
                       : L.genre[autreGenre].test(x.name || "") ? autreGenre : null);
    const ok = voix.filter(x => !voixEchouees.has(x.name));
    const liste = [
      ...ok.filter(x => p.re && p.re.test(x.name || "")),                     // la voix du personnage
      ...ok.filter(x => rangTeste(L, x) < 99 && genreTeste(L, x) === p.genre), // testées, bon genre
      ...ok.filter(x => rangTeste(L, x) >= 99 && genreDe(x) === p.genre),     // autres, bon genre
      ...ok.filter(x => genreDe(x) === null),                                  // genre inconnu
      ...ok.filter(x => genreDe(x) === autreGenre),                            // autre genre, en dernier
      ...voix.filter(x => voixEchouees.has(x.name))
    ];
    return liste.filter((x, i) => liste.indexOf(x) === i);
  }

  function choisirVoix(nomProfil) {
    const p = resoudreProfil(nomProfil);
    const cle = p.langue + ":" + p.cle;
    if (cacheChoix[cle] !== undefined) return cacheChoix[cle];
    const v = candidates(p)[0] || null;
    cacheChoix[cle] = v;
    return v;
  }

  function creerUtterance(texte, nomProfil, options = {}) {
    const p = resoudreProfil(nomProfil);
    const code = LANGUES[p.langue].code;
    const u = new SpeechSynthesisUtterance(String(texte));
    u.lang = code;

    const v = (options.voix && options.voix.name) ? options.voix : choisirVoix(nomProfil);
    if (v) {
      u.voice = v;
      u.lang = v.lang || code;
    }

    u.rate   = Math.min(10, Math.max(0.1, (options.rate ?? p.rate) * facteurVitesse));
    u.pitch  = options.pitch  ?? p.pitch;
    u.volume = options.volume ?? 1;
    return u;
  }

  /* ===============================
     4. PROPRIÉTÉ DE LA PAROLE
     Chaque nouvelle action incrémente "generation".
     Les fins de phrase d'une génération périmée sont ignorées :
     une phrase annulée ne peut plus relancer la suivante.
     =============================== */
  let generation = 0;
  let utteranceCourante = null; // référence gardée (bug Chrome : onend perdu si l'objet est libéré)

  function nouvelleGeneration() {
    generation++;
    if (synth) synth.cancel();
    utteranceCourante = null;
    return generation;
  }

  function attendre(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Dit un texte. Résout true si la phrase est allée au bout,
  // false si elle a été interrompue par une autre action.
  /* Voix « Online (Natural) » d'Edge : le service refuse parfois une phrase
     (« synthesis-failed ») ou ne démarre pas. On réessaie la même voix une fois,
     puis on passe à la voix suivante de la liste ; une voix qui a échoué deux fois
     est écartée pour le reste de la séance. */
  const DELAI_DEMARRAGE = 6000;   // une phrase qui n'a pas commencé après ce délai = échec
  const echecsParVoix = {};

  async function dire(texte, nomProfil, options, gen) {
    if (!synth) return false;
    const p = resoudreProfil(nomProfil);
    const essais = [];
    const liste = candidates(p);
    if (liste[0]) essais.push(liste[0], liste[0]);
    liste.slice(1, 4).forEach(v => essais.push(v));
    if (!essais.length) essais.push(null);           // aucune voix de la langue : voix par défaut

    for (let i = 0; i < essais.length; i++) {
      if (gen !== generation) return false;
      const r = await direUneFois(texte, p.cle, Object.assign({}, options, { voix: essais[i] }), gen);
      if (r !== "echec") return r === "ok";
      const v = essais[i];
      if (v) {
        echecsParVoix[v.name] = (echecsParVoix[v.name] || 0) + 1;
        if (echecsParVoix[v.name] >= 2 && !voixEchouees.has(v.name)) {
          voixEchouees.add(v.name);
          cacheChoix = {};
          console.warn("[AudioDE] voix écartée pour la séance : " + v.name);
        }
      }
      await attendre(i === 0 ? 500 : 250);
    }
    console.warn("[AudioDE] phrase non lue (aucune voix n'a répondu) :", texte);
    return gen === generation;   // on passe à la suite sans bloquer le dialogue
  }

  // résout "ok", "interrompu" ou "echec"
  function direUneFois(texte, nomProfil, options, gen) {
    return new Promise(resolve => {
      const u = creerUtterance(texte, nomProfil, options);
      let fini = false, demarre = false;
      let garde = null, gardeDebut = null;

      function terminer(etat) {
        if (fini) return;
        fini = true;
        clearTimeout(garde); clearTimeout(gardeDebut);
        if (utteranceCourante === u) utteranceCourante = null;
        resolve(gen !== generation ? "interrompu" : etat);
      }

      u.onstart = () => { demarre = true; clearTimeout(gardeDebut); };
      u.onend = () => terminer("ok");
      u.onerror = e => {
        const interrompu = e && (e.error === "interrupted" || e.error === "canceled");
        if (interrompu) return terminer("interrompu");
        console.warn("[AudioDE] erreur de synthèse (" + (u.voice ? u.voice.name : "voix par défaut") + ") :", e && e.error);
        // échec avant le début : on essaie une autre voix ; après le début : on passe à la suite
        terminer(demarre ? "ok" : "echec");
      };

      setTimeout(() => {
        if (gen !== generation) return terminer("interrompu");
        utteranceCourante = u;
        if (synth.paused) synth.resume();
        synth.speak(u);

        gardeDebut = setTimeout(() => {
          if (!demarre && !fini) { synth.cancel(); terminer("echec"); }
        }, DELAI_DEMARRAGE);
        // filet de sécurité : certains navigateurs oublient parfois onend
        const dureeMax = DELAI_DEMARRAGE + String(texte).length * 200 / (u.rate || 1);
        garde = setTimeout(() => terminer("ok"), dureeMax);
      }, DELAI_APRES_CANCEL);
    });
  }

  /* ===============================
     5. DIALOGUE MULTI-VOIX + SURLIGNAGE
     lignes : [{ role, text }] ou { type: "pause", value: "courte|moyenne|longue" }
     =============================== */
  const dialogue = {
    lignes: [],
    onHighlight: null,
    index: 0,
    indexEnLecture: null,
    derniereTerminee: -1,
    resumeIndex: 0,
    onFin: null,
    etat: "arret"      // "lecture" | "pause" | "arret"
  };

  function surligner(i) {
    if (typeof dialogue.onHighlight === "function") {
      try { dialogue.onHighlight(i); } catch (e) { console.error("[AudioDE] onHighlight :", e); }
    }
  }

  async function boucle(gen) {
    const d = dialogue;

    while (gen === generation && d.index < d.lignes.length) {
      const l = d.lignes[d.index];

      if (!l) { d.index++; continue; }

      if (l.type === "pause") {
        surligner(null);
        await attendre(PAUSES[l.value] || PAUSES.courte);
        if (gen !== generation) return;
        d.index++;
        continue;
      }

      d.indexEnLecture = d.index;
      surligner(d.index);

      await dire(l.text, l.role, {}, gen);
      if (gen !== generation) return;

      d.derniereTerminee = d.index;
      d.indexEnLecture = null;
      d.index++;
    }

    if (gen === generation) {
      d.etat = "arret";
      d.indexEnLecture = null;
      surligner(null);
      if (typeof d.onFin === "function") {
        try { d.onFin(); } catch (e) { console.error("[AudioDE] onFin :", e); }
      }
    }
  }

  async function lireDialogue(lignes, onHighlight, options = {}) {
    // nettoie le surlignage de l'ancien dialogue éventuel
    if (dialogue.etat !== "arret") surligner(null);

    const gen = nouvelleGeneration();
    const liste = Array.isArray(lignes) ? lignes : [];
    const debut = Math.max(0, Math.min(liste.length, Math.floor(Number(options.debut) || 0)));
    Object.assign(dialogue, {
      lignes: liste,
      onHighlight: onHighlight || null,
      onFin: typeof options.onFin === "function" ? options.onFin : null,
      index: debut,
      indexEnLecture: null,
      derniereTerminee: -1,
      resumeIndex: 0,
      etat: Array.isArray(lignes) && lignes.length ? "lecture" : "arret"
    });

    if (dialogue.etat === "arret") return;

    await pret();
    if (gen !== generation) return;
    return boucle(gen);
  }

  /* -----------------------------------------------
     Pause / reprise pédagogique
     - phrase en cours → reprise au début de la phrase précédente
     - entre deux phrases → reprise à la dernière phrase terminée
     ----------------------------------------------- */
  function pauseOuReprendre() {
    const d = dialogue;
    if (!d.lignes.length) return;

    if (d.etat === "lecture") {
      d.resumeIndex = d.indexEnLecture !== null
        ? Math.max(0, d.indexEnLecture - 1)
        : Math.max(0, d.derniereTerminee);
      nouvelleGeneration();
      d.etat = "pause";
      d.indexEnLecture = null;
      surligner(null);
      return "pause";
    }

    if (d.etat === "pause") {
      const gen = nouvelleGeneration();
      d.etat = "lecture";
      d.index = d.resumeIndex;
      boucle(gen);
      return "lecture";
    }
  }

  function arreter() {
    nouvelleGeneration();
    if (dialogue.etat !== "arret") surligner(null);
    dialogue.etat = "arret";
    dialogue.indexEnLecture = null;
  }

  /* ===============================
     6. PAROLE SIMPLE (quiz, boutons 🔊)
     Si le dialogue est en cours, il est mis EN PAUSE
     (le bouton Pause permet ensuite de le reprendre).
     Un événement "audiode:parole" prévient les autres
     modules (ex. doubleEcoute met le MP3 en pause).
     =============================== */
  async function parler(texte, nomProfil, options = {}) {
    if (dialogue.etat === "lecture") {
      pauseOuReprendre();
    }
    const gen = nouvelleGeneration();

    document.dispatchEvent(new CustomEvent("audiode:parole", { detail: { texte, profil: nomProfil } }));

    await pret();
    if (gen !== generation) return false;
    return dire(texte, nomProfil, options || {}, gen);
  }

  /* ===============================
     7. DIAGNOSTIC (pour l'enseignant)
     Dans la console : AudioDE.diagnostic()
     =============================== */
  async function diagnostic() {
    await pret();
    const L = LANGUES[langueCourante];
    const tableau = Object.keys(L.profils).map(nom => {
      const v = choisirVoix(nom);
      return {
        langue: langueCourante,
        personnage: nom,
        role: L.profils[nom].role,
        voix: v ? v.name : "(voix par défaut du navigateur)",
        code: v ? v.lang : L.code,
        testee: v ? rangTeste(L, v) < 99 : false,
        vitesse: L.profils[nom].rate,
        hauteur: L.profils[nom].pitch
      };
    });
    console.table(tableau);
    console.log("[AudioDE] voix " + L.nom + " utilisables :", voixParLangue[langueCourante].map(v => v.name + " (" + v.lang + ")" + (rangTeste(L, v) < 99 ? " ✓" : "")));
    if (voixEchouees.size) console.log("[AudioDE] voix écartées (échecs) :", [...voixEchouees]);
    console.log("[AudioDE] autre langue : AudioDE.definirLangue(\"en\") puis AudioDE.diagnostic()");
    return tableau;
  }

  /* ===============================
     API PUBLIQUE
     =============================== */
  return {
    pret,
    parler,
    lireDialogue,
    pauseOuReprendre,
    arreter,
    etat: () => dialogue.etat,
    profils: l => Object.keys(LANGUES[codeLangue(l) || langueCourante].profils),
    profilsDetail: l => { const L = LANGUES[codeLangue(l) || langueCourante];
      return Object.keys(L.profils).map(nom => ({ nom, role: L.profils[nom].role })); },
    langue: () => langueCourante,
    definirLangue,
    langueDuProfil,
    roles,
    langues: () => Object.keys(LANGUES).map(c => ({ code: c, nom: LANGUES[c].nom })),
    choisirVoix,
    creerUtterance,
    diagnostic,
    vitesse: () => facteurVitesse,
    definirVitesse,
    vitesseParDefaut,
    vitesseMemorisee,
    VITESSE_MIN,
    VITESSE_MAX
  };

})();

/* =====================================================
   EXPOSITION GLOBALE + COMPATIBILITÉ
   ===================================================== */
window.AudioDE = AudioDE;

// ancien moteur de dialogue (utilisé par doubleEcoute.js)
window.lireDialogueVoixAllemandesAvecSurlignage = (lignes, onHighlight) =>
  AudioDE.lireDialogue(lignes, onHighlight);

window.pauseOuReprendre = () => AudioDE.pauseOuReprendre();

// accepte les DEUX anciennes signatures :
//   lireTexteAllemand(texte, "Ryan")
//   lireTexteAllemand(texte, { voix: "Ryan", rate: 0.9, pitch: 1 })
window.lireTexteAllemand = function (texte, options) {
  if (typeof options === "string") return AudioDE.parler(texte, options);
  const o = options || {};
  return AudioDE.parler(texte, o.voix, { rate: o.rate, pitch: o.pitch });
};

window.lireTexteSimple = (texte, nomVoix, rate, pitch) =>
  AudioDE.parler(texte, nomVoix, { rate, pitch });

// ancien voicesDE.js
window.VoicesDE = {
  isReady: () => AudioDE.choisirVoix() !== null,
  getProfiles: () => AudioDE.profils(),
  createUtterance: (texte, profil) => AudioDE.creerUtterance(texte, profil)
};
