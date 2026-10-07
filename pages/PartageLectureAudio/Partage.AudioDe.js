/* =====================================================
   Partage.AudioDe.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.AudioDe.js (prioritaire)
   Module audio allemand UNIFIÉ
   Remplace : voicesDE.js + dialogueVoixAlldSurligné.js

   Principes
   - UNE table de profils (Katja, KatjaM, KatjaN, KatjaRapide, Conrad)
   - UN choix de voix (allemand d'abord, puis nom, puis genre)
   - UNE attente du chargement des voix (délai maximal + avertissement)
   - UN seul propriétaire de la parole : toute nouvelle lecture
     invalide proprement la précédente (jeton de génération)

   API publique : window.AudioDE
     AudioDE.parler(texte, profil?, options?)      → Promise<boolean>
     AudioDE.lireDialogue(lignes, onHighlight?, { debut, onFin }?) → Promise
                                                     debut : index de la 1re phrase lue (0 par défaut)
                                                     onFin : appelée si la lecture va jusqu'au bout
     AudioDE.pauseOuReprendre()                    → "pause" | "lecture" | undefined
     AudioDE.arreter()
     AudioDE.etat()                                → "lecture" | "pause" | "arret"
     AudioDE.profils()                             → ["Katja", …]
     AudioDE.diagnostic()                          → tableau profil → voix (console)
     AudioDE.vitesse()                             → facteur de vitesse (0,5 à 1,5 ; 1 = normal)
     AudioDE.definirVitesse(v, memoriser?)         → règle le facteur (événement "audiode:vitesse")

   Vitesse : facteur global appliqué à toutes les voix (texte et quiz), en plus
   de la vitesse propre à chaque profil. Mémorisé dans ce navigateur, pour
   chaque exercice (NomdeRef::vitesse) ; défaut : "lecture.vitesse" du JSON, sinon 1.

   Compatibilité (anciens noms, toujours disponibles)
     lireDialogueVoixAllemandesAvecSurlignage(lignes, onHighlight)
     pauseOuReprendre()
     lireTexteAllemand(texte, "Conrad")  ou  lireTexteAllemand(texte, { voix, rate, pitch })
     lireTexteSimple(texte, nomVoix, rate, pitch)
     VoicesDE.createUtterance(texte, profil)

   ⚠️ Ne redéfinir AUCUNE de ces fonctions dans un autre fichier.
   ===================================================== */

const AudioDE = (function () {

  /* ===============================
     1. PROFILS – source unique
     nom   : morceau du nom de voix recherché en priorité
     genre : "f" ou "m" (voix de secours)
     =============================== */
  const PROFILS = {
    Katja:       { nom: "katja",  genre: "f", rate: 1.0,  pitch: 1.0  },
    KatjaM:      { nom: "katja",  genre: "f", rate: 1.1,  pitch: 1.25 },
    KatjaN:      { nom: "katja",  genre: "f", rate: 0.98, pitch: 0.95 },
    KatjaRapide: { nom: "katja",  genre: "f", rate: 1.2,  pitch: 1.05 },
    Conrad:      { nom: "conrad", genre: "m", rate: 1.0,  pitch: 0.9  }
  };

  // anciens noms acceptés
  const ALIAS = { KatjaNarratif: "KatjaN" };

  const PROFIL_DEFAUT = "Katja";

  // \b évite que "male" corresponde à "female"
  const MOTS_GENRE = {
    f: /\b(katja|hedda|anna|petra|helena|marlene|vicki|female|frau|weiblich)\b/i,
    m: /\b(conrad|stefan|markus|martin|yannick|hans|male|mann|männlich)\b/i
  };

  const PAUSES = { courte: 300, moyenne: 700, longue: 1200 };

  const DELAI_MAX_VOIX = 2000;   // attente maximale du chargement des voix (ms)
  const DELAI_APRES_CANCEL = 60; // évite certains silences après cancel()

  const synth = window.speechSynthesis || null;

  /* ===============================
     VITESSE GLOBALE (curseur de la page)
     =============================== */
  const VITESSE_MIN = 0.5, VITESSE_MAX = 1.5;
  const CLE_VITESSE = ((decodeURIComponent(location.pathname.split("/").pop() || "").split(".")[0]) || "index") + "::vitesse";
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
     2. PROFILS : résolution
     =============================== */
  const inconnusSignales = new Set();

  function resoudreProfil(nom) {
    const cle = ALIAS[nom] || nom || PROFIL_DEFAUT;
    if (PROFILS[cle]) return { cle, ...PROFILS[cle] };

    if (!inconnusSignales.has(cle)) {
      inconnusSignales.add(cle);
      console.warn(`[AudioDE] profil inconnu "${cle}" → réglages de ${PROFIL_DEFAUT}`);
    }
    // profil inconnu : on tente quand même une voix portant ce nom
    return { ...PROFILS[PROFIL_DEFAUT], cle, nom: String(cle).toLowerCase() };
  }

  /* ===============================
     3. VOIX : chargement + choix
     =============================== */
  let voixDE = [];      // voix allemandes, de-DE en premier
  let cacheChoix = {};  // profil → voix choisie
  let pretOK = false;
  let attenteEchouee = false;
  let promessePret = null;

  function estAllemande(v) {
    return (v.lang || "").replace("_", "-").toLowerCase().startsWith("de");
  }

  function rafraichirVoix() {
    if (!synth) return;
    const toutes = synth.getVoices() || [];
    voixDE = toutes.filter(estAllemande).sort((a, b) => {
      const da = (a.lang || "").replace("_", "-").toLowerCase() === "de-de" ? 0 : 1;
      const db = (b.lang || "").replace("_", "-").toLowerCase() === "de-de" ? 0 : 1;
      return da - db;
    });
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
          if (!voixDE.length) {
            console.warn("[AudioDE] aucune voix allemande installée → voix par défaut du navigateur");
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

  function choisirVoix(nomProfil) {
    const p = resoudreProfil(nomProfil);
    if (cacheChoix[p.cle] !== undefined) return cacheChoix[p.cle];

    const autreGenre = p.genre === "m" ? "f" : "m";
    const v =
      (p.nom && voixDE.find(x => (x.name || "").toLowerCase().includes(p.nom))) ||
      voixDE.find(x => MOTS_GENRE[p.genre].test(x.name || "")) ||
      voixDE.find(x => !MOTS_GENRE[autreGenre].test(x.name || "")) ||
      voixDE[0] ||
      null;

    cacheChoix[p.cle] = v;
    return v;
  }

  function creerUtterance(texte, nomProfil, options = {}) {
    const p = resoudreProfil(nomProfil);
    const u = new SpeechSynthesisUtterance(String(texte));
    u.lang = "de-DE";

    const v = choisirVoix(p.cle);
    if (v) {
      u.voice = v;
      u.lang = v.lang || "de-DE";
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
  function dire(texte, nomProfil, options, gen) {
    return new Promise(resolve => {
      if (!synth) return resolve(false);

      const u = creerUtterance(texte, nomProfil, options);
      let fini = false;
      let garde = null;

      function terminer(ok) {
        if (fini) return;
        fini = true;
        clearTimeout(garde);
        if (utteranceCourante === u) utteranceCourante = null;
        resolve(ok && gen === generation);
      }

      u.onend = () => terminer(true);
      u.onerror = e => {
        const interrompu = e && (e.error === "interrupted" || e.error === "canceled");
        if (!interrompu) console.warn("[AudioDE] erreur de synthèse :", e && e.error);
        // une vraie erreur ne doit pas bloquer le dialogue : on passe à la suite
        terminer(!interrompu);
      };

      setTimeout(() => {
        if (gen !== generation) return terminer(false);
        utteranceCourante = u;
        synth.speak(u);

        // filet de sécurité : certains navigateurs oublient parfois onend
        const dureeMax = 4000 + String(texte).length * 200 / (u.rate || 1);
        garde = setTimeout(() => terminer(true), dureeMax);
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
  async function parler(texte, nomProfil = PROFIL_DEFAUT, options = {}) {
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
    const tableau = Object.keys(PROFILS).map(nom => {
      const v = choisirVoix(nom);
      return {
        profil: nom,
        voix: v ? v.name : "(voix par défaut du navigateur)",
        langue: v ? v.lang : "de-DE",
        vitesse: PROFILS[nom].rate,
        hauteur: PROFILS[nom].pitch
      };
    });
    console.table(tableau);
    console.log("[AudioDE] voix allemandes disponibles :", voixDE.map(v => v.name + " (" + v.lang + ")"));
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
    profils: () => Object.keys(PROFILS),
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
//   lireTexteAllemand(texte, "Conrad")
//   lireTexteAllemand(texte, { voix: "Conrad", rate: 0.9, pitch: 1 })
window.lireTexteAllemand = function (texte, options) {
  if (typeof options === "string") return AudioDE.parler(texte, options);
  const o = options || {};
  return AudioDE.parler(texte, o.voix || "Katja", { rate: o.rate, pitch: o.pitch });
};

window.lireTexteSimple = (texte, nomVoix, rate, pitch) =>
  AudioDE.parler(texte, nomVoix || "Katja", { rate, pitch });

// ancien voicesDE.js
window.VoicesDE = {
  isReady: () => AudioDE.choisirVoix("Katja") !== null,
  getProfiles: () => AudioDE.profils(),
  createUtterance: (texte, profil) => AudioDE.creerUtterance(texte, profil)
};
