/* =====================================================
   Partage.DoubleEcoute.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.DoubleEcoute.js (prioritaire)
   Arbitre Audio / TTS – principe de la double écoute
   - Écouter   : NomdeRef.mp3 (ou TTS si absent), TEXTE MASQUÉ, toujours depuis le début
   - Réécouter : TTS + surlignage, TEXTE VISIBLE (le MP3 est arrêté)
   - Barre de lecture (en haut, sous le titre, toujours visible) :
       ⏮ / ⏭ phrase précédente / suivante, ⏹ arrêt instantané,
       ▶ reprise au curseur, ligne graduée (une graduation par phrase)
       dont le curseur se glisse à la main
   - Révéler   : révélation volontaire du texte masqué (body.revelation-active)
   - Lecture   : voix du fichier, une seule voix ou deux voix pour les dialogues (LectureVoix)
   - Verrou    : interrupteur discret (⚙️ Paramètres, à côté de « corrigé ») ; sur ON,
                 le texte reste masqué : Réécouter et Révéler sont désactivés.
                 Défaut : "lecture": { "verrouille": true } dans NomdeRef.json, sinon OFF ;
                 le choix fait avec l'interrupteur est mémorisé dans ce navigateur.

   Masquage : classe .masquee posée sur chaque .phrase (stylée dans format.css)
   IDs contractuels : audio-player, btn-ecouter, btn-reecouter, btn-reveler,
   zone-header (la barre #barre-lecture y est ajoutée) ; classe .phrase + data-speaker
   (l'ancien btn-pause est masqué s'il existe)
   ===================================================== */

(function () {

  /* ===============================
     RÉVÉLATION VOLONTAIRE (btn-reveler)
     Indépendante de l'audio et du surlignage
     =============================== */
  const btnReveler = document.getElementById("btn-reveler");

  function setRevelation(actif) {
    document.body.classList.toggle("revelation-active", actif);
    if (btnReveler) {
      btnReveler.textContent = actif ? "Cacher le texte" : "Révéler le texte";
      btnReveler.setAttribute("aria-pressed", actif ? "true" : "false");
    }
  }

  btnReveler?.addEventListener("click", () => {
    if (document.body.classList.contains("texte-verrouille")) return;
    setRevelation(!document.body.classList.contains("revelation-active"));
  });


  /* ===============================
     INITIALISATION
     =============================== */
  /* ===============================
     MODE DE LECTURE : voix du fichier, une seule voix, ou deux voix (dialogue)
     - "fichier"  : chaque phrase est lue avec son data-speaker (défaut)
     - "une"      : tout le texte avec une seule voix (voixUnique)
     - "dialogue" : les répliques – paragraphes ou phrases qui commencent par
                    un tiret (- – —) ou un guillemet (" „ “ « ‹ ') – sont lues
                    alternativement par voixA et voixB ; le reste par le narrateur
     Réglage par défaut dans NomdeRef.json :
       "lecture": { "mode": "dialogue", "voixA": "KatjaM", "voixB": "Conrad",
                    "narrateur": "KatjaN", "voixUnique": "Katja" }
     Choix de l'utilisateur (⚙️ Paramètres → Lecture du texte) mémorisé dans ce navigateur.
     =============================== */
  const LectureVoix = (function () {
    const fichierPage = decodeURIComponent(location.pathname.split("/").pop() || "");
    const CLE = (window.RACINE_EXERCICE || fichierPage.split(".")[0] || "index") + "::lecture::mode";
    const MARQUE = /^\s*[-–—―"„“”«»‹›‚‘']/;
    const MODES = [
      ["fichier", "Voix prévues dans la page"],
      ["une", "Une seule voix"],
      ["dialogue", "Deux voix pour les dialogues"]
    ];

    function config() {
      const d = window.Quiz && typeof Quiz.donnees === "function" ? Quiz.donnees() : null;
      const l = (d && d.lecture && typeof d.lecture === "object") ? d.lecture : {};
      return {
        mode: l.mode,
        voixA: l.voixA || "KatjaM",
        voixB: l.voixB || "Conrad",
        narrateur: l.narrateur || "KatjaN",
        voixUnique: l.voixUnique || "Katja"
      };
    }

    function mode() {
      let m = null;
      try { m = localStorage.getItem(CLE); } catch (e) { m = null; }
      if (!MODES.some(x => x[0] === m)) m = config().mode;
      return MODES.some(x => x[0] === m) ? m : "fichier";
    }

    // une voix par phrase, selon le mode
    function roles(spans) {
      const c = config(), m = mode();
      if (m === "une") return spans.map(() => c.voixUnique);
      if (m !== "dialogue") return spans.map(s => s.dataset.speaker || "Katja");
      let tour = 1, courant = c.narrateur, paragraphe = null, enReplique = false;
      return spans.map(s => {
        const p = s.closest("p") || s.parentElement;
        const texte = s.textContent || "";
        if (MARQUE.test(texte)) {
          tour = 1 - tour;
          courant = tour === 0 ? c.voixA : c.voixB;
          enReplique = true;
        } else if (p !== paragraphe) {
          enReplique = false;
          courant = c.narrateur;
        }
        paragraphe = p;
        return enReplique ? courant : c.narrateur;
      });
    }

    // repère visuel : un trait de couleur devant les répliques de chaque voix
    function marquer() {
      const spans = Array.from(document.querySelectorAll("#zone-contenu .phrase"));
      spans.forEach(s => s.classList.remove("voix-a", "voix-b", "voix-n"));
      if (mode() !== "dialogue") return 0;
      const c = config();
      const r = roles(spans);
      let repliques = 0;
      spans.forEach((s, i) => {
        if (!MARQUE.test(s.textContent || "")) return;       // trait seulement en début de réplique
        repliques++;
        s.classList.add(r[i] === c.voixA ? "voix-a" : r[i] === c.voixB ? "voix-b" : "voix-n");
      });
      return repliques;
    }

    function installer() {
      const box = document.getElementById("quiz-filter-box");
      if (!box) return;
      let hote = document.getElementById("lecture-params");
      if (!hote) {
        hote = document.createElement("div");
        hote.id = "lecture-params";
        hote.className = "params-section";
        hote.setAttribute("data-injecte-par", "DoubleEcoute");
        const avant = document.getElementById("vocab-params")
          || box.querySelector(":scope > .pied-params, :scope > #btn-corrige");
        box.insertBefore(hote, avant || null);
      }
      hote.textContent = "";
      const titre = document.createElement("div");
      titre.className = "params-titre";
      titre.textContent = "Lecture du texte";
      hote.appendChild(titre);
      const info = document.createElement("div");
      info.className = "params-info";
      MODES.forEach(([v, lib]) => {
        const lab = document.createElement("label");
        lab.className = "params-radio";
        const r = document.createElement("input");
        r.type = "radio";
        r.name = "lecture-mode";
        r.value = v;
        r.checked = mode() === v;
        r.addEventListener("change", () => {
          try { localStorage.setItem(CLE, v); } catch (e) { /* stockage indisponible */ }
          maj();
        });
        lab.appendChild(r);
        lab.appendChild(document.createTextNode(" " + lib));
        hote.appendChild(lab);
      });
      hote.appendChild(info);

      function maj() {
        hote.querySelectorAll('input[name="lecture-mode"]').forEach(r => { r.checked = r.value === mode(); });
        const n = marquer();
        const c = config();
        info.textContent = mode() === "dialogue"
          ? (n ? n + " réplique(s) repérée(s) : " + c.voixA + " / " + c.voixB + ", récit : " + c.narrateur
               : "Aucune réplique repérée (tiret ou guillemet en début de phrase).")
          : mode() === "une" ? "Voix : " + c.voixUnique : "";
      }
      maj();
      document.addEventListener("quiz:charge", maj);
    }

    return { mode, roles, marquer, installer };
  })();
  window.LectureVoix = LectureVoix;

  function initDoubleEcoute(config = {}) {

    const selecteur    = config.phrasesSelector || ".phrase";
    const btnEcouter   = document.getElementById(config.btnEcouter   || "btn-ecouter");
    const btnReecouter = document.getElementById(config.btnReecouter || "btn-reecouter");

    // ancien bouton Pause (pages plus anciennes) : remplacé par ⏹ / ▶ de la barre de lecture
    const btnPauseAncien = document.getElementById(config.btnPause || "btn-pause");
    if (btnPauseAncien) btnPauseAncien.style.display = "none";

    /* ---------- ÉTAT DE LA LECTURE ----------
       source     : "mp3" ou "tts" (dernière façon de lire ; null au départ)
       enLecture  : true pendant que la voix parle
       pos        : phrase du curseur, de 0 à n (n = fin du texte) ;
                    avec le MP3, nombre décimal (avancée dans la phrase)
       tempsExact : MP3 arrêté → instant exact de reprise, tant que le curseur n'a pas bougé */
    let source = null;
    let enLecture = false;
    let pos = 0;
    let tempsExact = null;

    console.log("[INIT] doubleEcoute initialisé");
    LectureVoix.installer();

    function phrases() {
      return Array.from(document.querySelectorAll(selecteur));
    }
    // phrases réellement lues (les .phrase vides sont ignorées)
    function lues() {
      return phrases().filter(s => s.textContent.trim());
    }
    function donneesJSON() {
      return window.Quiz && typeof Quiz.donnees === "function" ? Quiz.donnees() : null;
    }

    /* ---------- AUDIO MP3 (optionnel) ----------
       Nom reconstruit : NomdeRef.html → NomdeRef.mp3 (même dossier).
       Si le fichier n'existe pas, Écouter passe directement
       à la synthèse vocale. */
    let audio = null;
    let mp3Absent = false;
    const a = document.getElementById(config.audioId || "audio-player");
    if (a instanceof HTMLAudioElement) {
      audio = a;
      const fichier = decodeURIComponent(location.pathname.split("/").pop() || "");
      const racine  = window.RACINE_EXERCICE || fichier.split(".")[0] || "index";   // exercice choisi (?exo=…) sinon nom de la page
      const nomMP3  = racine + ".mp3";

      audio.addEventListener("error", () => {
        mp3Absent = true;
        console.log("[AUDIO] " + nomMP3 + " absent → synthèse vocale");
      });
      audio.addEventListener("ended", () => {
        if (source !== "mp3") return;
        enLecture = false;
        tempsExact = null;
        pos = lues().length;
        marquer();
        majBarre();
      });
      audio.addEventListener("timeupdate", () => {
        if (source !== "mp3" || !enLecture) return;
        pos = posDepuisTemps(audio.currentTime);
        if (tempsFournis()) marquer();
        majBarre();
      });

      audio.preload = "auto";
      audio.src = encodeURI(nomMP3);
      console.log("[AUDIO] fichier audio attendu : " + nomMP3);
    }

    /* ---------- MP3 : DÉBUT DE CHAQUE PHRASE ----------
       Exact si "lecture": { "temps": [0, 2.4, 5.1, …] } est donné dans le JSON
       (en secondes, une valeur par phrase) ; sinon estimé d'après la longueur
       des phrases. */
    function tempsFournis() {
      const d = donneesJSON();
      const t = d && d.lecture && Array.isArray(d.lecture.temps) ? d.lecture.temps : null;
      return t && t.length >= lues().length && t.every(v => isFinite(Number(v))) ? t.map(Number) : null;
    }
    function debutsMP3() {
      const n = lues().length;
      const t = tempsFournis();
      if (t) return t.slice(0, n);
      const D = audio && isFinite(audio.duration) ? audio.duration : 0;
      const longueurs = lues().map(s => s.textContent.trim().length + 8); // +8 : petite pause
      const total = longueurs.reduce((x, y) => x + y, 0) || 1;
      let cumul = 0;
      return longueurs.map(l => { const v = D * cumul / total; cumul += l; return v; });
    }
    function posDepuisTemps(t) {
      const deb = debutsMP3();
      if (!deb.length) return 0;
      const D = audio && isFinite(audio.duration) ? audio.duration : 0;
      let i = deb.length - 1;
      while (i > 0 && t < deb[i]) i--;
      const fin = i + 1 < deb.length ? deb[i + 1] : D;
      const frac = fin > deb[i] ? (t - deb[i]) / (fin - deb[i]) : 0;
      return i + Math.max(0, Math.min(0.999, frac));
    }

    /* ---------- MASQUAGE / AFFICHAGE ---------- */
    function masquerTexte() {
      phrases().forEach(p => p.classList.add("masquee"));
      setRevelation(false);
      console.log("[UI] texte masqué");
    }

    function afficherTexte() {
      phrases().forEach(p => p.classList.remove("masquee"));
      setRevelation(false);
      console.log("[UI] texte affiché");
    }

    function effacerSurlignage() {
      phrases().forEach(p => p.classList.remove("phrase-active", "phrase-reperee"));
    }

    // repère la phrase du curseur : surlignée pendant la lecture,
    // simplement soulignée quand la lecture est arrêtée
    function marquer() {
      effacerSurlignage();
      const liste = lues();
      const i = Math.floor(pos);
      if (i < 0 || i >= liste.length) return;
      if (enLecture) {
        if (source === "tts" || tempsFournis()) liste[i].classList.add("phrase-active");
      } else if (source !== null) {
        liste[i].classList.add("phrase-reperee");
      }
    }

    /* ---------- ARRÊTS PROPRES ---------- */
    function arreterMP3() {
      if (!audio) return;
      audio.pause();
      try { audio.currentTime = 0; } catch (e) { /* MP3 absent */ }
    }

    function arreterTTS() {
      if (window.AudioDE) {
        AudioDE.arreter();
      } else if (window.speechSynthesis) {
        speechSynthesis.cancel();
      }
    }

    function toutArreter() {
      arreterMP3();
      arreterTTS();
      enLecture = false;
      tempsExact = null;
      effacerSurlignage();
    }

    /* ---------- CONSTRUCTION DES LIGNES TTS ---------- */
    function construireLignes(spans) {
      const lignes = [];
      const spansLus = spans.filter(span => span.textContent.trim());
      // voix de chaque phrase selon le mode de lecture (fichier / une voix / dialogue)
      const voix = LectureVoix.roles(spansLus);

      spansLus.forEach((span, i) => {
        lignes.push({ role: voix[i] || "Katja", text: span.textContent.trim() });
      });

      console.log("[TTS] lignes construites :", lignes.length);
      return { lignes, spansLus };
    }

    /* ---------- LANCEMENTS ---------- */
    // voix de synthèse à partir de la phrase "debut"
    function lancerTTS(debut) {
      if (!window.AudioDE) {
        console.warn("[TTS] moteur TTS indisponible");
        return;
      }
      const { lignes } = construireLignes(phrases());
      if (!lignes.length) {
        console.warn("[TTS] aucune phrase " + selecteur + " trouvée");
        return;
      }
      if (audio) audio.pause();
      source = "tts";
      enLecture = true;
      tempsExact = null;
      pos = Math.max(0, Math.min(lignes.length - 1, Math.floor(debut || 0)));
      marquer();
      majBarre();

      AudioDE.lireDialogue(lignes, function (i) {
        if (i === null) return;
        pos = i;
        marquer();
        majBarre();
        if (typeof config.onHighlight === "function") config.onHighlight(i);
      }, {
        debut: pos,
        onFin: () => {
          enLecture = false;
          pos = lignes.length;
          marquer();
          majBarre();
        }
      });
    }

    // MP3 à partir de l'instant t (secondes) ; false si impossible
    async function lancerMP3(t) {
      if (!audio || mp3Absent) return false;
      arreterTTS();
      try {
        audio.currentTime = Math.max(0, t || 0);
        await audio.play();
        source = "mp3";
        enLecture = true;
        tempsExact = null;
        pos = posDepuisTemps(audio.currentTime);
        marquer();
        majBarre();
        console.log("[AUDIO] lecture MP3 à " + audio.currentTime.toFixed(1) + " s");
        return true;
      } catch (e) {
        console.warn("[AUDIO] MP3 indisponible → synthèse vocale");
        return false;
      }
    }

    /* ---------- ACTION : ÉCOUTER (texte masqué, depuis le début) ---------- */
    async function actionEcouter() {
      console.log("[BTN] Écouter cliqué");
      toutArreter();
      masquerTexte();
      pos = 0;
      if (await lancerMP3(0)) return;
      lancerTTS(0);
    }

    /* ---------- ACTION : RÉÉCOUTER (texte visible, surlignage) ---------- */
    function actionReecouter() {
      console.log("[BTN] Réécouter cliqué");
      if (document.body.classList.contains("texte-verrouille")) return;
      toutArreter();
      afficherTexte();
      lancerTTS(0);
    }

    /* ---------- ACTION : ARRÊT INSTANTANÉ ⏹ ---------- */
    function actionStop() {
      if (!enLecture) return;
      console.log("[BTN] Arrêt");
      if (source === "mp3" && audio) {
        audio.pause();
        tempsExact = audio.currentTime;
        pos = posDepuisTemps(audio.currentTime);
      } else {
        arreterTTS();
      }
      enLecture = false;
      marquer();
      majBarre();
    }

    /* ---------- ACTION : REPRISE AU CURSEUR ▶ ---------- */
    async function actionReprendre() {
      if (enLecture) return;
      console.log("[BTN] Reprise au curseur");
      const n = lues().length;
      if (!n) return;
      if (pos >= n) { pos = 0; tempsExact = null; }
      if (source === null) source = (audio && !mp3Absent) ? "mp3" : "tts";
      if (source === "mp3") {
        const t = tempsExact !== null ? tempsExact : debutsMP3()[Math.floor(pos)];
        if (await lancerMP3(t)) return;
      }
      lancerTTS(Math.floor(pos));
    }

    /* ---------- DÉPLACEMENT DU CURSEUR (⏮ ⏭, glisser, flèches) ---------- */
    function deplacer(i) {
      const n = lues().length;
      if (!n) return;
      i = Math.max(0, Math.min(n - 1, Math.round(i)));
      tempsExact = null;
      pos = i;
      if (enLecture) {
        if (source === "mp3" && audio) {
          audio.currentTime = debutsMP3()[i];
          pos = posDepuisTemps(audio.currentTime);
        } else {
          lancerTTS(i);
          return;
        }
      } else if (source === null) {
        source = (audio && !mp3Absent) ? "mp3" : "tts";
      }
      marquer();
      majBarre();
    }

    /* ---------- BARRE DE LECTURE (en haut, sous le titre, toujours visible) ----------
       ⏮ phrase précédente · ⏹ arrêt · ▶ reprise au curseur · ⏭ phrase suivante
       ligne graduée : une graduation par phrase ; le curseur se glisse à la main
       (il se cale sur la graduation la plus proche). */
    const ICONES = {
      recul:  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v10H3zM13 3v10L6 8z"/></svg>',
      stop:   '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4h8v8H4z"/></svg>',
      lecture:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10l8-5z"/></svg>',
      avance: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3h2v10h-2zM3 3v10l7-5z"/></svg>'
    };
    let barre = null, piste = null, curseurEl = null, rempli = null, compteur = null, grads = null;
    let btnStop = null, btnReprendre = null, btnRecul = null, btnAvance = null;
    let glisse = null;   // position pendant qu'on glisse le curseur

    function installerBarre() {
      barre = document.getElementById("barre-lecture");
      if (!barre) {
        const entete = document.getElementById("zone-header");
        if (!entete) return;
        barre = document.createElement("div");
        barre.id = "barre-lecture";
        entete.appendChild(barre);
      }
      barre.className = "barre-lecture";
      barre.setAttribute("role", "group");
      barre.setAttribute("aria-label", "Position dans le texte");
      barre.innerHTML =
        '<div id="piste-lecture" class="bl-piste" role="slider" tabindex="0" aria-label="Phrase en cours">' +
          '<div class="bl-rail"></div><div class="bl-rempli"></div>' +
          '<div class="bl-grads"></div>' +
          '<div class="bl-curseur"></div>' +
        '</div>' +
        '<span class="bl-compteur" aria-live="off"></span>';

      // boutons de commande : en haut à droite, à gauche de « Ma prononciation »,
      // ronds et de la même taille que les boutons d'enregistrement
      let commandes = document.getElementById("zone-commandes");
      if (!commandes) {
        commandes = document.createElement("div");
        commandes.id = "zone-commandes";
        const entete = document.getElementById("zone-header");
        const micro = document.getElementById("zone-micro");
        if (micro && micro.parentNode === entete) entete.insertBefore(commandes, micro);
        else entete.insertBefore(commandes, barre);
      }
      commandes.className = "ecoute-groupe";
      commandes.setAttribute("role", "group");
      commandes.setAttribute("aria-label", "Commandes de lecture");
      const bouton = (id, icone, lib, titre, classe) =>
        '<button type="button" id="' + id + '" class="ecoute-btn' + (classe ? " " + classe : "") + '" title="' + titre + '">' +
          '<span class="ecoute-icone">' + icone + '</span><span class="ecoute-lib">' + lib + '</span></button>';
      commandes.innerHTML =
        '<span class="ecoute-titre">Lecture</span>' +
        bouton("btn-recul", ICONES.recul, "Reculer", "Phrase précédente") +
        bouton("btn-stop", ICONES.stop, "Arrêter", "Arrêter la lecture") +
        bouton("btn-reprendre", ICONES.lecture, "Reprendre", "Reprendre au curseur", "ecoute-play") +
        bouton("btn-avance", ICONES.avance, "Avancer", "Phrase suivante");

      piste = barre.querySelector(".bl-piste");
      curseurEl = barre.querySelector(".bl-curseur");
      rempli = barre.querySelector(".bl-rempli");
      grads = barre.querySelector(".bl-grads");
      compteur = barre.querySelector(".bl-compteur");
      btnRecul = commandes.querySelector("#btn-recul");
      btnStop = commandes.querySelector("#btn-stop");
      btnReprendre = commandes.querySelector("#btn-reprendre");
      btnAvance = commandes.querySelector("#btn-avance");

      btnRecul.addEventListener("click", () => deplacer(Math.floor(pos) - 1));
      btnAvance.addEventListener("click", () => deplacer(Math.floor(pos) + 1));
      btnStop.addEventListener("click", actionStop);
      btnReprendre.addEventListener("click", actionReprendre);

      // glisser le curseur à la main
      function indiceDepuisPointeur(e) {
        const r = piste.getBoundingClientRect();
        const n = lues().length;
        const x = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
        return Math.max(0, Math.min(n - 1, Math.round(x * n)));
      }
      piste.addEventListener("pointerdown", e => {
        if (!lues().length) return;
        e.preventDefault();
        piste.setPointerCapture(e.pointerId);
        piste.focus({ preventScroll: true });
        glisse = indiceDepuisPointeur(e);
        majBarre();
      });
      piste.addEventListener("pointermove", e => {
        if (glisse === null) return;
        glisse = indiceDepuisPointeur(e);
        majBarre();
      });
      function lacher() {
        if (glisse === null) return;
        const i = glisse;
        glisse = null;
        deplacer(i);
      }
      piste.addEventListener("pointerup", lacher);
      piste.addEventListener("pointercancel", () => { glisse = null; majBarre(); });
      piste.addEventListener("keydown", e => {
        const i = Math.floor(pos);
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") deplacer(i - 1);
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") deplacer(i + 1);
        else if (e.key === "Home") deplacer(0);
        else if (e.key === "End") deplacer(lues().length - 1);
        else return;
        e.preventDefault();
      });

      // la barre latérale (fixe) commence sous l'en-tête, quelle que soit sa hauteur
      const entete = document.getElementById("zone-header");
      if (entete && window.ResizeObserver) {
        new ResizeObserver(() => {
          document.documentElement.style.setProperty("--haut-entete", entete.offsetHeight + "px");
        }).observe(entete);
      }

      dessinerGraduations();
      majBarre();

      // texte reconstruit depuis le JSON (Partage.Texte.js) : on repart de zéro
      document.addEventListener("texte:pret", () => {
        toutArreter();
        source = null;
        pos = 0;
        dessinerGraduations();
        majBarre();
      });
    }

    // numéro discret de la première phrase de chaque paragraphe (même numéro que la ligne graduée)
    function numeroterParagraphes() {
      document.querySelectorAll("#zone-contenu .num-phrase").forEach(n => n.remove());
      document.querySelectorAll("#zone-contenu p.avec-num").forEach(p => p.classList.remove("avec-num"));
      const vus = new Set();
      lues().forEach((s, i) => {
        const p = s.closest("p");
        if (!p || vus.has(p)) return;
        vus.add(p);
        p.classList.add("avec-num");
        const n = document.createElement("span");
        n.className = "num-phrase";
        n.setAttribute("aria-hidden", "true");
        n.textContent = String(i + 1);
        p.insertBefore(n, p.firstChild);
      });
    }

    function dessinerGraduations() {
      numeroterParagraphes();
      if (!grads) return;
      const n = lues().length;
      barre.hidden = n === 0;
      const commandes = document.getElementById("zone-commandes");
      if (commandes) commandes.hidden = n === 0;
      grads.textContent = "";
      for (let i = 0; i <= n; i++) {
        const g = document.createElement("span");
        g.className = i === n ? "bl-grad bl-grad-fin" : "bl-grad";
        g.style.left = (n ? i / n * 100 : 0) + "%";
        grads.appendChild(g);
      }
    }

    function majBarre() {
      if (!barre || !curseurEl) return;
      const n = lues().length;
      if (!n) return;
      const p = glisse !== null ? glisse : Math.max(0, Math.min(n, pos));
      const x = p / n * 100;
      curseurEl.style.left = x + "%";
      rempli.style.width = x + "%";
      barre.classList.toggle("bl-en-lecture", enLecture);
      barre.classList.toggle("bl-glisse", glisse !== null);
      const fin = p >= n;
      const num = Math.min(n, Math.floor(p) + 1);
      compteur.textContent = fin ? "fin" : num + "/" + n;
      piste.setAttribute("aria-valuemin", "1");
      piste.setAttribute("aria-valuemax", String(n));
      piste.setAttribute("aria-valuenow", String(num));
      piste.setAttribute("aria-valuetext", fin ? "fin du texte" : "phrase " + num + " sur " + n);
      btnStop.disabled = !enLecture;
      btnReprendre.disabled = enLecture;
      btnRecul.disabled = Math.floor(p) <= 0;
      btnAvance.disabled = Math.floor(p) >= n - 1;
    }

    /* ---------- PAROLE D'UN QUIZ (AudioDE) ----------
       Un bouton 🔊 de quiz arrête la lecture du texte ;
       ▶ la reprend ensuite au curseur. */
    document.addEventListener("audiode:parole", () => {
      if (!enLecture) return;
      if (source === "mp3" && audio) {
        audio.pause();
        tempsExact = audio.currentTime;
        console.log("[AUDIO] MP3 arrêté par un quiz");
      }
      enLecture = false;
      marquer();
      majBarre();
    });

    /* ---------- VERROU DU TEXTE (interrupteur discret de l'enseignant) ----------
       ON  : texte toujours masqué ; Réécouter et Révéler désactivés.
       OFF : fonctionnement normal (défaut).
       Mémo local "on"/"off" prioritaire, sinon "lecture.verrouille" du JSON. */
    const racinePage = window.RACINE_EXERCICE || (decodeURIComponent(location.pathname.split("/").pop() || "").split(".")[0]) || "index";
    const CLE_VERROU = racinePage + "::texte::verrou";
    let interrupteur = null;

    function verrouJSON() {
      const d = window.Quiz && typeof Quiz.donnees === "function" ? Quiz.donnees() : null;
      return !!(d && d.lecture && d.lecture.verrouille === true);
    }
    function estVerrouille() {
      let v = null;
      try { v = localStorage.getItem(CLE_VERROU); } catch (e) { v = null; }
      if (v === "on") return true;
      if (v === "off") return false;
      return verrouJSON();
    }
    function appliquerVerrou() {
      const on = estVerrouille();
      document.body.classList.toggle("texte-verrouille", on);
      if (btnReecouter) btnReecouter.disabled = on;
      if (btnReveler) btnReveler.disabled = on;
      if (interrupteur) {
        interrupteur.setAttribute("aria-checked", on ? "true" : "false");
        interrupteur.title = on ? "Texte verrouillé (ON)" : "Texte libre (OFF)";
      }
      if (on) masquerTexte();
      console.log("[VERROU] texte " + (on ? "verrouillé" : "libre"));
    }
    function installerVerrou() {
      interrupteur = document.getElementById("btn-verrou");
      if (!interrupteur) {
        const corrige = document.getElementById("btn-corrige");
        if (!corrige || !corrige.parentNode) return;
        let pied = corrige.closest(".pied-params");
        if (!pied) {
          pied = document.createElement("div");
          pied.className = "pied-params";
          corrige.parentNode.insertBefore(pied, corrige);
          pied.appendChild(corrige);
        }
        interrupteur = document.createElement("button");
        interrupteur.type = "button";
        interrupteur.id = "btn-verrou";
        interrupteur.className = "btn-verrou";
        interrupteur.setAttribute("role", "switch");
        pied.insertBefore(interrupteur, corrige);
      }
      interrupteur.addEventListener("click", () => {
        const on = !estVerrouille();
        try { localStorage.setItem(CLE_VERROU, on ? "on" : "off"); } catch (e) { /* mémo impossible */ }
        appliquerVerrou();
      });
      appliquerVerrou();
      document.addEventListener("quiz:charge", appliquerVerrou);
    }

    /* ---------- LIEN DISCRET VERS L'ÉDITEUR (⚙️ Paramètres, à côté de « corrigé ») ----------
       L'éditeur est dans le dossier commun (window.DOSSIER_PARTAGE, trouvé par le chargeur) ;
       il reçoit le chemin de l'exercice depuis ce dossier : Partage.editeur.html?../Anna9H */
    function installerLienEditeur() {
      const corrige = document.getElementById("btn-corrige");
      const pied = corrige && corrige.closest(".pied-params");
      if (!pied || document.getElementById("lien-editeur")) return;
      try {
        const dossier = window.DOSSIER_PARTAGE !== undefined ? window.DOSSIER_PARTAGE : "";
        const editeur = new URL(dossier + "Partage.editeur.html", location.href);
        const dirEd = editeur.pathname.split("/").slice(0, -1);
        const dirEx = location.pathname.split("/").slice(0, -1);
        let k = 0;
        while (k < dirEd.length && k < dirEx.length && dirEd[k] === dirEx[k]) k++;
        const chemin = "../".repeat(dirEd.length - k) + dirEx.slice(k).map(x => x + "/").join("");
        const lien = document.createElement("a");
        lien.id = "lien-editeur";
        lien.className = "btn-corrige";
        lien.textContent = "éditeur";
        lien.title = "Ouvrir l'éditeur des questions (enseignant)";
        lien.target = "_blank";
        lien.href = editeur.href + "?" + chemin + encodeURIComponent(racinePage);
        pied.insertBefore(lien, corrige);
      } catch (e) {
        console.warn("[Éditeur] lien impossible :", e.message);
      }
    }

    /* ---------- CURSEUR DE VITESSE DE LA VOIX ----------
       Placé sous les boutons d'écoute (créé s'il manque dans la page).
       Agit sur la voix de synthèse (AudioDE, texte et quiz) et sur le MP3.
       Double-clic sur le curseur : retour à la vitesse normale (1×). */
    function appliquerVitesseMP3(v) {
      if (!audio) return;
      audio.playbackRate = v;
      try { audio.preservesPitch = true; audio.webkitPreservesPitch = true; } catch (e) { /* ancien navigateur */ }
    }
    function installerVitesse() {
      if (!window.AudioDE || typeof AudioDE.vitesse !== "function") return;
      let boite = document.getElementById("vitesse-voix");
      if (!boite) {
        const hote = document.querySelector(".audio-controls");
        if (!hote) return;
        boite = document.createElement("div");
        boite.id = "vitesse-voix";
        boite.className = "vitesse-voix";
        boite.innerHTML =
          '<label for="curseur-vitesse"><span>Vitesse de la voix</span> <output id="valeur-vitesse"></output></label>' +
          '<div class="vitesse-ligne"><span aria-hidden="true">🐢</span>' +
          '<input type="range" id="curseur-vitesse" min="' + AudioDE.VITESSE_MIN + '" max="' + AudioDE.VITESSE_MAX + '" step="0.1">' +
          '<span aria-hidden="true">🐇</span></div>';
        hote.appendChild(boite);
      }
      const curseur = document.getElementById("curseur-vitesse");
      const valeur = document.getElementById("valeur-vitesse");
      if (!curseur) return;
      curseur.title = "Double-clic : vitesse normale";

      function afficher(v) {
        curseur.value = String(v);
        if (valeur) valeur.textContent = v.toFixed(1).replace(".", ",") + "×";
        appliquerVitesseMP3(v);
      }
      curseur.addEventListener("input", () => AudioDE.definirVitesse(curseur.value, true));
      curseur.addEventListener("dblclick", () => AudioDE.definirVitesse(1, true));
      document.addEventListener("audiode:vitesse", e => afficher(e.detail.vitesse));
      // défaut de l'exercice : "lecture": { "vitesse": 0.8 } dans NomdeRef.json
      function defautJSON() {
        const d = window.Quiz && typeof Quiz.donnees === "function" ? Quiz.donnees() : null;
        if (d && d.lecture && d.lecture.vitesse !== undefined) AudioDE.vitesseParDefaut(d.lecture.vitesse);
      }
      document.addEventListener("quiz:charge", defautJSON);
      defautJSON();
      afficher(AudioDE.vitesse());
      // le navigateur remet playbackRate à 1 au chargement du fichier
      audio?.addEventListener("loadedmetadata", () => appliquerVitesseMP3(AudioDE.vitesse()));
      audio?.addEventListener("play", () => appliquerVitesseMP3(AudioDE.vitesse()));
    }

    /* ---------- BRANCHEMENT BOUTONS ---------- */
    btnEcouter?.addEventListener("click", actionEcouter);
    btnReecouter?.addEventListener("click", actionReecouter);
    installerVerrou();
    installerVitesse();
    installerBarre();
    installerLienEditeur();
  }

  window.initDoubleEcoute = initDoubleEcoute;

})();
