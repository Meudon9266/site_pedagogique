/* =====================================================
   Partage.ScoreManager.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.ScoreManager.js (prioritaire)

   SCORE ET HISTORIQUE DES SÉANCES – réussites ET erreurs
   - le score est enregistré à CHAQUE vérification dans l'historique
     de l'exercice (localStorage, clé = racine du fichier HTML) :
     recharger la page ou fermer l'onglet n'efface rien
   - une séance est « terminée » quand toutes les questions de tous
     les quiz ont reçu au moins une réponse vérifiée
   - à l'ouverture, si la dernière séance n'est PAS terminée, elle est
     REPRISE avec son score et ses erreurs (pas de nouveau départ à zéro) ;
     sinon une nouvelle séance commence
   - réussite : 1 point par question, une seule fois
   - erreur : chaque mauvaise réponse différente est notée
     (question, réponse donnée, réponse attendue) ; une même mauvaise
     réponse vérifiée deux fois ne compte qu'une fois
   - remise à zéro réservée à l'enseignant : scoreManager.reset() dans la console
     (efface tout l'historique de cet exercice sur cet ordinateur)
   ===================================================== */

const scoreManager = (function () {

  const MAX_SEANCES = 60;          // nombre de séances gardées dans l'historique

  /* ---------- clés ---------- */

  // racine = nom du fichier HTML avant le premier point
  function getPageId() {
    const fichier = decodeURIComponent(location.pathname.split("/").pop() || "");
    return fichier.split(".")[0] || "index";
  }
  const CLE_HISTORIQUE = () => getPageId() + "::historique";
  const CLE_SEANCE = () => getPageId() + "::seance::id";

  /* ---------- stockage protégé ---------- */

  function lire(stockage, k, defaut) {
    try {
      const v = stockage.getItem(k);
      return v === null ? defaut : JSON.parse(v);
    } catch (e) {
      return defaut;
    }
  }
  function ecrire(stockage, k, v) {
    try { stockage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  const local = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const session = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  // si localStorage est indisponible, l'historique ne vit que le temps de l'onglet
  const durable = local || session;

  /* ---------- état ---------- */

  let historique = [];   // [{ id, debut, maj, log, erreurs, total, faites, termine, reprises }]
  let seance = null;     // séance en cours (objet de l'historique)
  let initialized = false;
  let reprise = false;   // la séance en cours reprend une séance non terminée
  let cles = [];         // questions de l'exercice : "quizN:id"
  const abonnes = [];

  function nouvelleSeance() {
    const s = { id: Date.now().toString(36), debut: Date.now(), maj: Date.now(),
                log: [], erreurs: [], total: 0, faites: 0, termine: false, reprises: 0 };
    historique.push(s);
    if (historique.length > MAX_SEANCES) historique = historique.slice(-MAX_SEANCES);
    return s;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    historique = durable ? lire(durable, CLE_HISTORIQUE(), []) : [];
    if (!Array.isArray(historique)) historique = [];

    // même onglet (page rechargée) : on retrouve la séance en cours
    const id = session ? lire(session, CLE_SEANCE(), null) : null;
    seance = id ? historique.find(s => s.id === id) : null;

    if (!seance) {
      const derniere = historique[historique.length - 1];
      if (derniere && !derniere.termine) {
        // séance précédente non terminée : on la reprend
        seance = derniere;
        seance.reprises = (seance.reprises || 0) + 1;
        reprise = true;
      } else {
        seance = nouvelleSeance();
      }
    }
    ["log", "erreurs"].forEach(k => { if (!Array.isArray(seance[k])) seance[k] = []; });
    if (session) ecrire(session, CLE_SEANCE(), seance.id);
    enregistrer();
  }

  /* ---------- avancement ---------- */

  // "quizN:id:réponse" → "quizN:id"
  function cleQuestion(label) {
    return String(label || "").split(":").slice(0, 2).join(":");
  }

  function majAvancement() {
    if (!cles.length) return;
    const faites = new Set();
    seance.log.forEach(e => faites.add(cleQuestion(e.label)));
    seance.erreurs.forEach(e => faites.add(cleQuestion(e.label)));
    seance.total = cles.length;
    seance.faites = cles.filter(c => faites.has(c)).length;
    if (!seance.termine && seance.faites >= seance.total) {
      seance.termine = true;
      seance.fin = Date.now();
    }
  }

  function enregistrer() {
    seance.maj = Date.now();
    majAvancement();
    if (durable) ecrire(durable, CLE_HISTORIQUE(), historique);
  }

  function signaler() {
    const etat = getState();
    abonnes.forEach(f => { try { f(etat); } catch (e) { console.error(e); } });
  }

  /* ---------- API ---------- */

  function add(points, label = "") {
    init();
    if (typeof points !== "number") return;
    seance.log.push({ delta: points, label, time: Date.now() });
    enregistrer();
    signaler();
  }

  function penalty(points = 1, label = "") {
    add(-Math.abs(points), label);
  }

  // note une erreur ; renvoie false si cette erreur était déjà notée
  function erreur(label, details = {}) {
    init();
    if (seance.erreurs.some(e => e.label === label)) return false;
    seance.erreurs.push(Object.assign({ label, time: Date.now() }, details));
    enregistrer();
    signaler();
    return true;
  }

  // liste des questions de l'exercice (appelé par le module Quiz)
  function definirQuestions(liste) {
    init();
    cles = Array.isArray(liste) ? liste.slice() : [];
    enregistrer();
    signaler();
  }

  function get() { init(); return seance.log.reduce((a, e) => a + (Number(e.delta) || 0), 0); }
  function getErreurs() { init(); return seance.erreurs.map(e => Object.assign({}, e)); }
  function nbErreurs() { init(); return seance.erreurs.length; }
  function getLog() { init(); return seance.log.slice(); }
  function estReprise() { init(); return reprise; }

  function getHistorique() {
    init();
    return historique.map(s => ({
      id: s.id, debut: s.debut, maj: s.maj, fin: s.fin || null,
      reussites: s.log.reduce((a, e) => a + (Number(e.delta) || 0), 0),
      erreurs: s.erreurs.length, total: s.total || 0, faites: s.faites || 0,
      termine: !!s.termine, reprises: s.reprises || 0, enCours: s === seance
    }));
  }

  function getState() {
    init();
    return {
      page: getPageId(), score: get(), erreurs: seance.erreurs.length,
      total: seance.total || 0, faites: seance.faites || 0, termine: !!seance.termine,
      reprise, log: seance.log.slice(), detailErreurs: seance.erreurs.slice()
    };
  }

  // enseignant : efface tout l'historique de cet exercice sur cet ordinateur
  function reset() {
    init();
    historique = [];
    seance = nouvelleSeance();
    reprise = false;
    if (session) ecrire(session, CLE_SEANCE(), seance.id);
    enregistrer();
    signaler();
  }

  // appelé à chaque changement (affichage du score)
  function onChange(f) {
    if (typeof f === "function") abonnes.push(f);
  }

  return { init, add, penalty, erreur, definirQuestions, get, getErreurs, nbErreurs, getLog,
           getHistorique, estReprise, getState, reset, onChange };

})();

window.scoreManager = scoreManager;
