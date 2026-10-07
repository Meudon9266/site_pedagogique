/* =====================================================
   Partage.Texte.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.Texte.js (prioritaire)

   LE TEXTE DE L'EXERCICE, STOCKÉ DANS NomdeRef.json (bloc "texte")
   La page NomdeRef.html n'est plus qu'une coquille commune : ce module
   construit le titre et le texte dans #zone-contenu dès que le JSON est lu.

   "texte": {
     "titre": "Anna stellt sich vor",
     "voix": "KatjaM",                          voix par défaut des phrases
     "blocs": [
       "Hallo! | Ich heiße Anna. | Ich bin elf.",          un paragraphe ; | sépare les phrases
       { "texte": "– Und du? | Wie heißt du?", "voix": "Conrad" },   paragraphe avec sa voix
       { "phrases": ["Heute ist Montag.", { "texte": "Es regnet.", "voix": "Conrad" }] },  une voix par phrase
       { "type": "intertitre", "texte": "Am Montag" },
       { "type": "tableau", "titre": "Stundenplan", "entete": 1,
         "lignes": [["Uhrzeit", "Montag"], ["8.00", "**Deutsch**\n_Klassenzimmer_"],
                    [{ "texte": "Pause", "largeur": 2, "style": "background:#f1f1f1" }]] },
       { "type": "image", "fichier": 1, "legende": "…", "largeur": "60%" },   → NomdeRef.1.png
       { "type": "html", "html": "<p>…</p>" }                                 mise en forme libre
     ]
   }

   Mise en forme dans les textes : **gras**, *italique*, _petit_, \n (retour à la ligne).
   Seules les phrases des paragraphes sont lues à voix haute (classe .phrase) ;
   intertitres, tableaux, images et HTML libre sont affichés sans être lus.


   Ordre : Partage.Quiz.js lit le JSON et appelle Texte.afficher(donnees)
   AVANT l'événement "quiz:charge" ; ce module envoie "texte:pret".
   En cas d'échec du chargement (événement "quiz:echec"), un bouton
   « Charger NomdeRef.json » apparaît à la place du texte.

   API : Texte.afficher(donnees)          construit le texte dans #zone-contenu
         Texte.construire(texte, racine)   → fragment DOM (aperçu de l'éditeur)
         Texte.paragraphes(texte)          → ["phrase phrase…", …] (corrigé PDF)
         Texte.phrases(bloc)               → liste des phrases d'un paragraphe
   ===================================================== */

(function () {
  "use strict";

  const fichierPage = decodeURIComponent(location.pathname.split("/").pop() || "");
  const RACINE = window.RACINE_EXERCICE || fichierPage.split(".")[0] || "index";   // exercice choisi (?exo=…) sinon nom de la page
  const VOIX_DEFAUT = "Katja";

  /* ===============================
     OUTILS
     =============================== */
  function echapper(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // **gras**, *italique*, _petit_, \n → HTML (le texte est échappé d'abord)
  function miseEnForme(s) {
    return echapper(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.+?)\*/g, "<i>$1</i>")
      .replace(/(^|[\s(>])_(.+?)_(?=$|[\s.,;:!?)<])/g, "$1<small>$2</small>")
      .replace(/\r?\n/g, "<br>");
  }

  // texte sans marques de mise en forme (lecture, PDF)
  function texteBrut(s) {
    return String(s)
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/(^|[\s(])_(.+?)_(?=$|[\s.,;:!?)])/g, "$1$2")
      .replace(/\s*\r?\n\s*/g, " ");
  }

  function estParagraphe(b) {
    return typeof b === "string" || (b && typeof b === "object" && !b.type && (typeof b.texte === "string" || Array.isArray(b.phrases)));
  }

  // phrases d'un paragraphe, avec leur voix :
  //   "a | b | c"   ·   { texte: "a | b", voix }   ·   { phrases: ["a", { texte: "b", voix: "Conrad" }], voix }
  function phrasesDetaillees(b, voixDefaut) {
    const voixPar = (b && typeof b === "object" && b.voix) || voixDefaut || VOIX_DEFAUT;
    let liste = [];
    if (typeof b === "string") liste = b.split("|").map(t => ({ texte: t, voix: voixPar }));
    else if (b && Array.isArray(b.phrases)) liste = b.phrases.map(x => (x && typeof x === "object")
      ? { texte: String(x.texte || ""), voix: x.voix || voixPar }
      : { texte: String(x), voix: voixPar });
    else if (b && typeof b.texte === "string") liste = b.texte.split("|").map(t => ({ texte: t, voix: voixPar }));
    return liste.map(x => ({ texte: x.texte.trim(), voix: x.voix })).filter(x => x.texte);
  }
  function phrases(b) {
    return phrasesDetaillees(b).map(x => x.texte);
  }

  function blocs(t) {
    return t && Array.isArray(t.blocs) ? t.blocs : [];
  }

  // découpe un texte en phrases (aide de l'éditeur ; le résultat est à relire) :
  // coupe après . ! ? … (et un guillemet fermant éventuel) suivi d'une majuscule, d'un chiffre,
  // d'un tiret ou d'un guillemet ouvrant ; pas après une abréviation courante (z. B., Dr., usw.)
  // ni après un nombre suivi d'un point (11. Mai)
  const ABREVIATIONS = /(?:^|\s)(?:z|B|d|h|u|a|Dr|Hr|Fr|Nr|St|Str|ca|usw|bzw|vgl|evtl|etc|Mio|Mrd|ggf|inkl|Prof)\.$/;
  function decouper(texte) {
    const t = String(texte || "").replace(/\s+/g, " ").trim();
    if (!t) return [];
    const res = [];
    const re = /([.!?…]+["“”»«'’]?)\s+(?=["„“«»‹'‚–—-]?\s*[A-ZÄÖÜ0-9])/g;
    let debut = 0, m;
    while ((m = re.exec(t))) {
      const fin = m.index + m[1].length;
      const morceau = t.slice(debut, fin);
      if (ABREVIATIONS.test(morceau) || /\d\.$/.test(morceau)) continue;   // abréviation, ou nombre ordinal (11. Mai)
      res.push(morceau.trim());
      debut = fin;
    }
    const reste = t.slice(debut).trim();
    if (reste) res.push(reste);
    return res;
  }

  /* ===============================
     CONSTRUCTION
     =============================== */
  function cheminImage(fichier, racine) {
    if (typeof fichier === "number" || /^\d+$/.test(String(fichier))) return (racine || RACINE) + "." + fichier + ".png";
    return String(fichier || "");
  }

  function construireParagraphe(b, voixDefaut) {
    const p = document.createElement("p");
    phrasesDetaillees(b, voixDefaut).forEach((ph, i) => {
      if (i) p.appendChild(document.createTextNode(" "));
      const s = document.createElement("span");
      s.className = "phrase";
      s.dataset.speaker = ph.voix;
      s.innerHTML = miseEnForme(ph.texte);
      p.appendChild(s);
    });
    return p;
  }

  function construireTableau(b) {
    const boite = document.createElement("div");
    boite.className = "texte-tableau-boite";
    const table = document.createElement("table");
    table.className = "texte-tableau";
    if (b.titre) {
      const c = document.createElement("caption");
      c.innerHTML = miseEnForme(b.titre);
      table.appendChild(c);
    }
    const nEntete = b.entete === undefined ? 1 : Math.max(0, Number(b.entete) || 0);
    (Array.isArray(b.lignes) ? b.lignes : []).forEach((ligne, r) => {
      const tr = document.createElement("tr");
      (Array.isArray(ligne) ? ligne : [ligne]).forEach(cellule => {
        const c = (cellule && typeof cellule === "object") ? cellule : { texte: cellule };
        const td = document.createElement(r < nEntete || c.entete ? "th" : "td");
        td.innerHTML = miseEnForme(c.texte === undefined || c.texte === null ? "" : c.texte);
        if (c.largeur > 1) td.colSpan = c.largeur;
        if (c.hauteur > 1) td.rowSpan = c.hauteur;
        if (c.style) td.setAttribute("style", String(c.style));
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    boite.appendChild(table);
    return boite;
  }

  function construireImage(b, racine) {
    const fig = document.createElement("figure");
    fig.className = "texte-image";
    const img = document.createElement("img");
    img.src = encodeURI(cheminImage(b.fichier, racine));
    img.alt = b.legende || "";
    if (b.largeur) img.style.width = String(b.largeur);
    fig.appendChild(img);
    if (b.legende) {
      const fc = document.createElement("figcaption");
      fc.innerHTML = miseEnForme(b.legende);
      fig.appendChild(fc);
    }
    return fig;
  }

  // texte → fragment DOM
  function construire(t, racine) {
    const frag = document.createDocumentFragment();
    const voixDefaut = (t && t.voix) || VOIX_DEFAUT;
    blocs(t).forEach(b => {
      try {
        if (estParagraphe(b)) { frag.appendChild(construireParagraphe(b, voixDefaut)); return; }
        if (!b || typeof b !== "object") return;
        if (b.type === "intertitre") {
          const h = document.createElement("h2");
          h.className = "texte-intertitre";
          h.innerHTML = miseEnForme(b.texte || "");
          frag.appendChild(h);
        } else if (b.type === "tableau") {
          frag.appendChild(construireTableau(b));
        } else if (b.type === "image") {
          frag.appendChild(construireImage(b, racine));
        } else if (b.type === "html") {
          const d = document.createElement("div");
          d.className = "texte-html";
          d.innerHTML = String(b.html || "");
          frag.appendChild(d);
        }
      } catch (e) {
        console.warn("[Texte] bloc ignoré :", b, e);
      }
    });
    return frag;
  }

  // paragraphes en texte brut (corrigé PDF)
  function paragraphes(t) {
    return blocs(t).filter(estParagraphe).map(b => phrases(b).map(texteBrut).join(" ")).filter(Boolean);
  }

  /* ===============================
     AFFICHAGE DANS LA PAGE
     =============================== */
  function majTitre(titre) {
    if (!titre) return;
    document.title = titre;
    const h1 = document.getElementById("page-title");
    if (h1) h1.textContent = titre;
    const cfgEl = document.getElementById("page-config");
    if (cfgEl) {
      let cfg = {};
      try { cfg = JSON.parse(cfgEl.textContent || "{}"); } catch (e) { cfg = {}; }
      cfg.title = titre;
      cfgEl.textContent = JSON.stringify(cfg, null, 2);
    }
  }

  function afficher(donnees) {
    const t = donnees && donnees.texte;
    const zone = document.getElementById("zone-contenu");
    if (!zone || !t || typeof t !== "object") return false;   // ancien exercice : texte de la page
    majTitre(t.titre);
    zone.textContent = "";
    zone.appendChild(construire(t, RACINE));
    zone.dataset.source = "json";
    document.dispatchEvent(new CustomEvent("texte:pret", { detail: { racine: RACINE } }));
    console.log("[Texte] texte construit depuis le JSON : " + zone.querySelectorAll(".phrase").length + " phrase(s)");
    return true;
  }

  // échec du chargement automatique : bouton de chargement manuel à la place du texte
  document.addEventListener("quiz:echec", e => {
    const zone = document.getElementById("zone-contenu");
    if (!zone || zone.dataset.source === "json" || !zone.querySelector(".texte-attente")) return;
    zone.textContent = "";
    const boite = document.createElement("div");
    boite.className = "texte-echec";
    const msg = document.createElement("p");
    msg.textContent = "Le texte de l'exercice n'a pas pu être chargé automatiquement"
      + (location.protocol === "file:" ? " (page ouverte depuis l'ordinateur)." : ".")
      + (e.detail && e.detail.message ? " " + e.detail.message : "");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "quiz-json-bouton";
    bouton.textContent = "📂 Charger " + RACINE + ".json";
    bouton.addEventListener("click", () => {
      const b = document.querySelector("#quiz-json-box .quiz-json-bouton");
      if (b) b.click();
    });
    boite.append(msg, bouton);
    zone.appendChild(boite);
  });

  window.Texte = { decouper, afficher, construire, paragraphes, phrases, phrasesDetaillees, texteBrut, miseEnForme, estParagraphe };
})();
