/* =====================================================
   Partage.Fiche.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.Fiche.js (prioritaire)

   PAGE DE PRISE DE NOTES – téléchargée directement en PDF
   - bouton « 🖨 Obtenir une page de prise de notes » (#btn-fiche)
     → le fichier NomdeRef.fiche.pdf est téléchargé tout de suite,
       sans passer par l'impression du navigateur
   - le PDF est fabriqué dans le navigateur, sans bibliothèque externe :
     fonctionne hors ligne et en ouverture locale (file://)
   - contenu et gestion de la place décrits dans NomdeRef.json, bloc "fiche"
   - le nombre de pages est estimé automatiquement, puis chaque page
     est remplie : la place restante est répartie en lignes
     supplémentaires entre les rubriques, selon leur "poids"

   Bloc "fiche" du JSON (tout est facultatif sauf les rubriques) :
   "fiche": {
     "titre": "Anna stellt sich vor – mes notes",
     "consigne": "Écoute le texte et note l'essentiel en mots-clés.",
     "entete": ["Nom", "Date", "Classe"],      // champs à remplir en haut
     "pages": "auto",                           // ou 1, 2, 3…
     "interligne": 9,                           // en mm (8 à 10 : écriture rapide)
     "rubriques": [
       { "titre": "Name", "aide": "Wie heißt sie?", "lignes": 1,
         "largeur": "demi", "poids": 1 },
       { "titre": "Weitere Informationen", "lignes": 3, "poids": 4 }
     ]
   }
   Rubrique :
     titre    texte de la rubrique (obligatoire)
     aide     petite question ou indication sous le titre
     lignes   nombre de lignes au minimum (défaut 2)
     largeur  "pleine" (défaut) ou "demi" : deux rubriques "demi"
              qui se suivent sont placées côte à côte
     poids    part de la place restante (défaut 1 ; 0 = taille fixe)
   Sans bloc "fiche", les rubriques sont tirées des questions du quiz 1.
   Les émojis ne sont pas repris dans le PDF (polices standard).

   CORRIGÉ POUR L'ENSEIGNANT (bouton discret #btn-corrige, dans la rubrique
   repliable « Afficher les quiz ») : NomdeRef.corrige.pdf avec le texte,
   les 4 quiz, les questions et les réponses attendues.

   Dépend de : Partage.Quiz.js (Quiz.donnees()), chargé avant.
   ===================================================== */

(function () {
  "use strict";

  const fichier = decodeURIComponent(location.pathname.split("/").pop() || "");
  const RACINE = window.RACINE_EXERCICE || fichier.split(".")[0] || "index";   // exercice choisi (?exo=…) sinon nom de la page

  /* ===============================
     1. DIMENSIONS (en mm, format A4 portrait)
     Toutes les hauteurs affichées sont fixées en mm :
     le calcul de la place est donc exact.
     =============================== */
  const MM = {
    pageL: 210, pageH: 297,
    marge: 12,
    titre: 10,           // titre de la fiche
    entete: 11,          // ligne Nom / Date / Classe
    ligneConsigne: 5,    // une ligne de consigne
    sepEntete: 4,        // espace sous l'en-tête de la page 1
    enteteSuite: 11,     // rappel du titre sur les pages suivantes (+ espace)
    pied: 6,             // numéro de page
    titreRubrique: 7,
    aide: 4.5,
    ecart: 4,            // espace entre deux rangées de rubriques
    gouttiere: 8         // espace entre deux rubriques côte à côte
  };
  const INTERLIGNE_DEFAUT = 9;
  const LIGNES_DEFAUT = 2;

  /* ===============================
     2. OUTILS
     =============================== */
  function el(tag, attrs, ...enfants) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k === "style") e.setAttribute("style", v);
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

  const nombre = (v, defaut, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return defaut;
    return Math.min(max, Math.max(min, n));
  };

  /* ===============================
     2 bis. TEXTE : mesure, coupure, encodage PDF
     =============================== */
  const PT = 72 / 25.4;                 // 1 mm en points PDF
  const TAILLE = { titre: 16, entete: 10.5, consigne: 10, suite: 9.5, rubrique: 11.5, aide: 9, pied: 8 };
  let ctxMesure = null;

  function nettoyerTexte(t) {
    // garde les caractères imprimables avec les polices PDF standard
    let r = "";
    for (const ch of String(t || "").normalize("NFC")) {
      const c = ch.codePointAt(0);
      if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WINANSI[ch]) r += ch;
      else if (/\s/.test(ch)) r += " ";
    }
    return r.replace(/\s+/g, " ").trim();
  }

  // largeur d'un texte en points (Arial ≈ Helvetica)
  function largeur(texte, taille, style) {
    if (!ctxMesure) {
      const c = document.createElement("canvas");
      ctxMesure = c.getContext && c.getContext("2d");
    }
    if (!ctxMesure) return texte.length * taille * 0.5;
    ctxMesure.font = (style ? style + " " : "") + taille + "px Helvetica, Arial, sans-serif";
    return ctxMesure.measureText(texte).width;
  }

  function couper(texte, taille, style, max) {
    const mots = nettoyerTexte(texte).split(" ").filter(Boolean);
    const lignes = [];
    let courante = "";
    mots.forEach(m => {
      const essai = courante ? courante + " " + m : m;
      if (courante && largeur(essai, taille, style) > max) { lignes.push(courante); courante = m; }
      else courante = essai;
    });
    if (courante) lignes.push(courante);
    return lignes;
  }

  function raccourcir(texte, taille, style, max) {
    let t = nettoyerTexte(texte);
    if (largeur(t, taille, style) <= max) return t;
    while (t.length > 1 && largeur(t + "…", taille, style) > max) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }

  /* ===============================
     3. LECTURE DU BLOC "fiche"
     =============================== */
  function lireFiche(donnees, racine) {
    const f = (donnees && typeof donnees.fiche === "object" && donnees.fiche) || {};
    let rubriques = Array.isArray(f.rubriques) ? f.rubriques : null;

    // repli : une rubrique par question du quiz 1 (ou par question tout court)
    if (!rubriques || !rubriques.length) {
      const qs = (donnees && Array.isArray(donnees.questions)) ? donnees.questions : [];
      const dans1 = qs.filter(q => [].concat(q.quiz).map(Number).includes(1) && q.question);
      const source = dans1.length ? dans1 : qs.filter(q => q.question);
      rubriques = source.map(q => ({ titre: q.question, lignes: LIGNES_DEFAUT }));
    }

    const titrePage = (donnees && donnees.texte && donnees.texte.titre) || (document.getElementById("page-config") &&
      (() => { try { return JSON.parse(document.getElementById("page-config").textContent).title; } catch (e) { return ""; } })())
      || racine || RACINE;

    return {
      titre: f.titre || titrePage + " – mes notes",
      consigne: f.consigne === undefined ? "Écoute le texte et note l'essentiel en mots-clés." : String(f.consigne || ""),
      entete: Array.isArray(f.entete) ? f.entete : ["Nom", "Date", "Classe"],
      pages: f.pages === undefined || f.pages === "auto" ? "auto" : Math.round(nombre(f.pages, 1, 1, 20)),
      interligne: nombre(f.interligne, INTERLIGNE_DEFAUT, 6, 15),
      rubriques: rubriques
        .filter(r => r && String(r.titre || "").trim())
        .map(r => ({
          titre: String(r.titre).trim(),
          aide: r.aide ? String(r.aide).trim() : "",
          lignes: Math.round(nombre(r.lignes, LIGNES_DEFAUT, 1, 60)),
          demi: r.largeur === "demi",
          poids: nombre(r.poids, 1, 0, 100)
        }))
    };
  }

  /* ===============================
     4. MISE EN PAGE
     =============================== */

  // rangées : une rubrique pleine, ou deux rubriques "demi" côte à côte
  function faireRangees(rubriques) {
    const rangees = [];
    for (let i = 0; i < rubriques.length; i++) {
      const r = rubriques[i];
      if (r.demi && rubriques[i + 1] && rubriques[i + 1].demi) {
        rangees.push({ items: [r, rubriques[i + 1]] });
        i++;
      } else {
        rangees.push({ items: [r] });
      }
    }
    rangees.forEach(rg => {
      rg.lignes = Math.max(...rg.items.map(r => r.lignes));
      rg.aide = rg.items.some(r => r.aide);
      rg.poids = Math.max(...rg.items.map(r => r.poids));
    });
    return rangees;
  }

  function hauteurRangee(rg, lignes, interligne) {
    return MM.titreRubrique + (rg.aide ? MM.aide : 0) + lignes * interligne;
  }

  function lignesConsigne(fiche) {
    if (!fiche.consigne) return 0;
    return couper(fiche.consigne, TAILLE.consigne, "italic", (MM.pageL - 2 * MM.marge) * PT).length;
  }

  function capacite(fiche, numeroPage) {
    const utile = MM.pageH - 2 * MM.marge - MM.pied;
    if (numeroPage === 0) {
      return utile - MM.titre - (fiche.entete.length ? MM.entete : 0) -
        lignesConsigne(fiche) * MM.ligneConsigne - MM.sepEntete;
    }
    return utile - MM.enteteSuite;
  }

  // une rangée trop haute pour une page est raccourcie
  function borner(rangees, fiche) {
    const cap = Math.min(capacite(fiche, 0), capacite(fiche, 1));
    rangees.forEach(rg => {
      const max = Math.floor((cap - MM.titreRubrique - (rg.aide ? MM.aide : 0)) / fiche.interligne);
      if (rg.lignes > max) rg.lignes = Math.max(1, max);
    });
  }

  // répartition en pages ; "cible" = hauteur visée par page (équilibrage)
  function paginer(rangees, fiche, nbPagesVoulu) {
    const h = rangees.map(rg => hauteurRangee(rg, rg.lignes, fiche.interligne) + MM.ecart);
    const total = h.reduce((a, b) => a + b, 0);
    const pages = [];
    let i = 0;
    while (i < rangees.length) {
      const p = pages.length;
      const cap = capacite(fiche, p) + MM.ecart;
      const restantes = nbPagesVoulu ? Math.max(1, nbPagesVoulu - p) : 1;
      const resteTotal = h.slice(i).reduce((a, b) => a + b, 0);
      const cible = nbPagesVoulu ? resteTotal / restantes : Infinity;
      const page = [];
      let cumul = 0;
      while (i < rangees.length) {
        const suivant = cumul + h[i];
        if (page.length && suivant > cap) break;
        if (page.length && nbPagesVoulu && p < nbPagesVoulu - 1 && cumul + h[i] / 2 > cible) break;
        page.push(rangees[i]);
        cumul = suivant;
        i++;
      }
      pages.push(page);
    }
    while (nbPagesVoulu && pages.length < nbPagesVoulu) pages.push([]);
    return { pages, total };
  }

  // la place restante de chaque page devient des lignes en plus,
  // réparties selon les poids (méthode des plus forts restes)
  function remplir(page, fiche, numeroPage) {
    page.forEach(rg => { rg.lignesFinales = rg.lignes; });
    if (!page.length) return;
    const utilise = page.reduce((a, rg) => a + hauteurRangee(rg, rg.lignes, fiche.interligne), 0) +
      MM.ecart * (page.length - 1);
    const libre = capacite(fiche, numeroPage) - utilise;
    let enPlus = Math.floor(libre / fiche.interligne + 1e-6);
    if (enPlus <= 0) return;

    let candidats = page.filter(rg => rg.poids > 0);
    if (!candidats.length) candidats = [page[page.length - 1]];   // tout fixe : la dernière rubrique prend la place
    const somme = candidats.reduce((a, rg) => a + (rg.poids || 1), 0);

    const parts = candidats.map(rg => {
      const exact = enPlus * (rg.poids || 1) / somme;
      return { rg, entier: Math.floor(exact), reste: exact - Math.floor(exact) };
    });
    let distribue = parts.reduce((a, x) => a + x.entier, 0);
    parts.sort((a, b) => b.reste - a.reste);
    for (let k = 0; distribue < enPlus; k = (k + 1) % parts.length) {
      parts[k].entier++;
      distribue++;
    }
    parts.forEach(x => { x.rg.lignesFinales = x.rg.lignes + x.entier; });
  }

  function calculer(fiche) {
    const rangees = faireRangees(fiche.rubriques);
    borner(rangees, fiche);

    // estimation : combien de pages au minimum ?
    const essai = paginer(rangees, fiche, 0);
    const minimum = Math.max(1, essai.pages.length);
    let nb = minimum;
    if (fiche.pages !== "auto") {
      if (fiche.pages < minimum) {
        console.warn(`[Fiche] ${fiche.pages} page(s) demandée(s), mais il en faut ${minimum} pour les lignes minimales.`);
      } else {
        nb = fiche.pages;
      }
    }
    // une seule page : telle quelle ; plusieurs pages : contenu équilibré entre les pages
    const { pages } = nb === 1 ? essai : paginer(rangees, fiche, nb);
    pages.forEach((page, n) => remplir(page, fiche, n));
    return { pages, minimum };
  }

  /* ===============================
     5. ÉCRITURE DU PDF (A4, polices standard Helvetica)
     =============================== */
  const WINANSI = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
    "‰": 0x89, "Š": 0x8A, "‹": 0x8B, "Œ": 0x8C, "Ž": 0x8E, "‘": 0x91, "’": 0x92, "“": 0x93,
    "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9A, "›": 0x9B,
    "œ": 0x9C, "ž": 0x9E, "Ÿ": 0x9F
  };

  // texte → chaîne PDF (octets WinAnsi, parenthèses et \ protégés)
  function chainePDF(t) {
    let r = "";
    for (const ch of nettoyerTexte(t)) {
      const c = ch.codePointAt(0);
      const b = WINANSI[ch] || c;
      if (b === 0x28 || b === 0x29 || b === 0x5C) r += "\\";
      r += String.fromCharCode(b);
    }
    return "(" + r + ")";
  }

  const f2 = n => (Math.round(n * 100) / 100).toString();
  const X = mm => f2(mm * PT);
  const Y = mm => f2((MM.pageH - mm) * PT);      // mm depuis le haut → points depuis le bas

  const COUL = {
    noir: "0 0 0", texte: "0.12 0.12 0.12", gris: "0.33 0.33 0.33", grisClair: "0.47 0.47 0.47",
    ligne: "0.54 0.58 0.62", bleu: "0.184 0.435 0.698"
  };
  const POLICE = { normal: "/F1", gras: "/F2", italique: "/F3" };

  function texte(ops, xmm, ymm, chaine, taille, police, couleur, alignDroite) {
    let x = xmm * PT;
    if (alignDroite) x -= largeur(nettoyerTexte(chaine), taille, police === "/F2" ? "bold" : police === "/F3" ? "italic" : "");
    ops.push(`BT ${police} ${taille} Tf ${couleur} rg ${f2(x)} ${Y(ymm)} Td ${chainePDF(chaine)} Tj ET`);
  }
  function trait(ops, x1, y1, x2, y2, epaisseurMm, couleur) {
    ops.push(`${couleur} RG ${f2(epaisseurMm * PT)} w ${X(x1)} ${Y(y1)} m ${X(x2)} ${Y(y2)} l S`);
  }
  function rectangle(ops, x, y, l, h, couleur) {
    ops.push(`${couleur} rg ${X(x)} ${f2((MM.pageH - y - h) * PT)} ${f2(l * PT)} ${f2(h * PT)} re f`);
  }

  function dessinerPages(fiche, calcul, racine) {
    const nb = calcul.pages.length;
    const L = MM.pageL - 2 * MM.marge;            // largeur utile (mm)
    const x0 = MM.marge;

    return calcul.pages.map((page, n) => {
      const ops = [];
      let y = MM.marge;

      if (n === 0) {
        // titre + filet
        texte(ops, x0, y + 7, raccourcir(fiche.titre, TAILLE.titre, "bold", L * PT), TAILLE.titre, POLICE.gras, COUL.noir);
        trait(ops, x0, y + MM.titre - 0.5, x0 + L, y + MM.titre - 0.5, 0.6, COUL.noir);
        y += MM.titre;

        // champs Nom / Date / Classe
        if (fiche.entete.length) {
          const ecartChamps = 6;
          const lc = (L - ecartChamps * (fiche.entete.length - 1)) / fiche.entete.length;
          fiche.entete.forEach((champ, k) => {
            const xc = x0 + k * (lc + ecartChamps);
            const lib = nettoyerTexte(champ) + " :";
            const lLib = largeur(lib, TAILLE.entete, "") / PT;
            texte(ops, xc, y + MM.entete - 2.5, lib, TAILLE.entete, POLICE.normal, COUL.texte);
            trait(ops, xc + lLib + 2, y + MM.entete - 1.8, xc + lc, y + MM.entete - 1.8, 0.3, COUL.gris);
          });
          y += MM.entete;
        }

        // consigne
        couper(fiche.consigne, TAILLE.consigne, "italic", L * PT).forEach(lig => {
          texte(ops, x0, y + 3.8, lig, TAILLE.consigne, POLICE.italique, COUL.gris);
          y += MM.ligneConsigne;
        });
        y += MM.sepEntete;
      } else {
        texte(ops, x0, y + 4.8, raccourcir(fiche.titre, TAILLE.suite, "", L * PT), TAILLE.suite, POLICE.normal, COUL.grisClair);
        trait(ops, x0, y + MM.enteteSuite - 4, x0 + L, y + MM.enteteSuite - 4, 0.3, COUL.ligne);
        y += MM.enteteSuite;
      }

      page.forEach((rg, k) => {
        if (k) y += MM.ecart;
        const double = rg.items.length === 2;
        const lc = double ? (L - MM.gouttiere) / 2 : L;

        rg.items.forEach((r, c) => {
          const xc = x0 + c * (lc + MM.gouttiere);
          let yy = y;
          // titre de rubrique avec barre de couleur
          rectangle(ops, xc, yy + 0.8, 1.4, MM.titreRubrique - 1.6, COUL.bleu);
          texte(ops, xc + 3.9, yy + 5.1, raccourcir(r.titre, TAILLE.rubrique, "bold", (lc - 4) * PT),
            TAILLE.rubrique, POLICE.gras, COUL.noir);
          yy += MM.titreRubrique;
          if (rg.aide) {
            if (r.aide) {
              texte(ops, xc + 4, yy + 3.2, raccourcir(r.aide, TAILLE.aide, "", (lc - 4) * PT),
                TAILLE.aide, POLICE.normal, COUL.gris);
            }
            yy += MM.aide;
          }
          // lignes d'écriture
          for (let i = 1; i <= rg.lignesFinales; i++) {
            const yl = yy + i * fiche.interligne;
            trait(ops, xc, yl, xc + lc, yl, 0.3, COUL.ligne);
          }
        });
        y += hauteurRangee(rg, rg.lignesFinales, fiche.interligne);
      });

      // pied de page
      texte(ops, MM.pageL - MM.marge, MM.pageH - MM.marge / 2,
        (racine || RACINE) + (nb > 1 ? " · page " + (n + 1) + " / " + nb : ""), TAILLE.pied, POLICE.normal, COUL.grisClair, true);

      return ops.join("\n");
    });
  }

  function assemblerPDF(contenus, titre) {
    const objs = [];
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique"].forEach((f, i) => {
      objs[3 + i] = `<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`;
    });
    // titre du document (propriétés du PDF) : en UTF-16, pour garder tous les caractères
    let hex = "FEFF";
    for (const u of String(titre)) {
      const c = u.codePointAt(0);
      if (c > 0xFFFF) continue;                       // émojis ignorés
      hex += c.toString(16).toUpperCase().padStart(4, "0");
    }
    objs[6] = `<< /Title <${hex}> /Producer (Partage.Fiche.js) >>`;
    const kids = [];
    let n = 7;
    contenus.forEach(c => {
      const pid = n++, cid = n++;
      kids.push(pid);
      objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${X(MM.pageL)} ${X(MM.pageH)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${cid} 0 R >>`;
      objs[cid] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
    });
    objs[2] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;

    let out = "%PDF-1.4\n%âãÏÓ\n";
    const pos = [];
    for (let i = 1; i < objs.length; i++) {
      pos[i] = out.length;
      out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) out += String(pos[i]).padStart(10, "0") + " 00000 n \n";
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const octets = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) octets[i] = out.charCodeAt(i) & 0xff;
    return octets;
  }

  function fabriquerPDF(donnees, racine) {
    const fiche = lireFiche(donnees, racine);
    if (!fiche.rubriques.length) return null;
    const calcul = calculer(fiche);
    return { octets: assemblerPDF(dessinerPages(fiche, calcul, racine), fiche.titre), pages: calcul.pages.length };
  }

  /* ===============================
     5 bis. CORRIGÉ POUR L'ENSEIGNANT (texte + quiz + réponses attendues)
     Document en flux sur autant de pages A4 que nécessaire.
     =============================== */
  const LIBELLES_QUIZ = { 1: "QCM", 2: "QCM à l'oral", 3: "Menus", 4: "Réponses libres" };
  const VERT = "0.15 0.47 0.29";

  function appartientA(q, n) {
    return [].concat(q.quiz === undefined ? [] : q.quiz).map(Number).includes(n);
  }

  // texte de l'exercice tel qu'il est dans la page : un paragraphe par <p>
  function texteDeLaPage(donnees) {
    // texte stocké dans le JSON (bloc "texte") : lu directement
    if (donnees && donnees.texte && window.Texte && typeof Texte.paragraphes === "function") {
      const p = Texte.paragraphes(donnees.texte);
      if (p.length) return p;
    }
    const paragraphes = [];
    const vus = new Set();
    document.querySelectorAll("#zone-contenu .phrase").forEach(span => {
      const parent = span.closest("p") || span.parentElement;
      if (!vus.has(parent)) {
        vus.add(parent);
        const phrases = Array.from(parent.querySelectorAll(".phrase")).map(s => s.textContent.trim()).filter(Boolean);
        if (phrases.length) paragraphes.push(phrases.join(" "));
      }
    });
    return paragraphes;
  }

  // Format : feuille A4 PAYSAGE partagée en deux colonnes A5 (148,5 × 210 mm),
  // pour plier la feuille en deux. Le texte coule colonne gauche → colonne droite → feuille suivante.
  function fabriquerCorrige(donnees, racine) {
    const avant = { L: MM.pageL, H: MM.pageH };
    MM.pageL = 297; MM.pageH = 210;               // A4 paysage le temps de la fabrication
    try { return corrigeA5(donnees, racine); }
    finally { MM.pageL = avant.L; MM.pageH = avant.H; }
  }

  function corrigeA5(donnees, racine) {
    const nom = racine || RACINE;
    const COL = MM.pageL / 2;                   // largeur d'une colonne A5 (148,5 mm)
    const M = 11;                               // marge dans chaque colonne (mm)
    const L = COL - 2 * M;                      // largeur utile d'une colonne
    const BAS = MM.pageH - M - 6;               // limite basse avant le pied de colonne
    const hLigne = taille => taille * 0.3528 * 1.38;  // hauteur d'une ligne (mm)
    const style = police => police === POLICE.gras ? "bold" : police === POLICE.italique ? "italic" : "";

    const pages = [];
    const colonnes = [];                        // { page, c } dans l'ordre de lecture
    let ops = [];
    let c = 0;                                  // 0 = colonne gauche, 1 = colonne droite
    let y = M;
    const X0 = () => c * COL + M;               // bord gauche de la colonne en cours
    colonnes.push({ page: 0, c: 0 });

    function nouvellePage() {
      if (c === 0) { c = 1; }
      else { pages.push(ops); ops = []; c = 0; }
      y = M;
      colonnes.push({ page: pages.length, c });
    }

    /* un bloc = suite d'éléments dessinés ensemble (jamais coupé, sauf s'il dépasse une page) */
    function lignes(t, taille, police, retrait) {
      return couper(t, taille, style(police), (L - retrait) * PT);
    }
    function hauteur(bloc) {
      return bloc.reduce((h, e) => h + (e.avant || 0) + (e.lignes ? e.lignes.length * hLigne(e.taille) : e.h || 0), 0);
    }
    function dessiner(bloc) {
      const h = hauteur(bloc);
      if (y + h > BAS && h < BAS - M) nouvellePage();
      bloc.forEach(e => {
        y += e.avant || 0;
        if (e.lignes) {
          e.lignes.forEach(l => {
            if (y + hLigne(e.taille) > BAS) nouvellePage();
            const x = X0() + (e.retrait || 0);
            if (e.case !== undefined) {
              // petite case : pleine et verte pour la bonne réponse
              const c = 2.6, yc = y + hLigne(e.taille) * 0.5 - c / 2 - 0.4;
              if (e.case) rectangle(ops, x - 5, yc, c, c, VERT);
              else ops.push(`${COUL.gris} RG ${f2(0.25 * PT)} w ${X(x - 5)} ${f2((MM.pageH - yc - c) * PT)} ${f2(c * PT)} ${f2(c * PT)} re S`);
              e.case = undefined;             // seulement sur la première ligne
            }
            texte(ops, x, y + hLigne(e.taille) * 0.75, l, e.taille, e.police, e.couleur);
            y += hLigne(e.taille);
          });
        } else if (e.filet) {
          trait(ops, X0(), y + 1, X0() + L, y + 1, e.filet, COUL.ligne);
          y += e.h || 3;
        } else {
          y += e.h || 0;
        }
      });
    }
    const T = (t, o = {}) => {
      const taille = o.taille || 10, police = o.police || POLICE.normal, retrait = o.retrait || 0;
      return { lignes: lignes(t, taille, police, retrait), taille, police, retrait,
               couleur: o.couleur || COUL.texte, avant: o.avant || 0, case: o.case };
    };

    const qs = Array.isArray(donnees.questions) ? donnees.questions : [];
    const reglage = n => (donnees.quiz && donnees.quiz[n]) || {};
    const titrePage = (donnees.texte && donnees.texte.titre) || (() => {
      try { return JSON.parse(document.getElementById("page-config").textContent).title || nom; } catch (e) { return nom; }
    })();

    /* ---- en-tête ---- */
    dessiner([
      T("Corrigé – " + titrePage, { taille: 14, police: POLICE.gras, couleur: COUL.noir }),
      T(nom + " · document pour l'enseignant · " + new Date().toLocaleDateString("fr-CH"),
        { taille: 9, couleur: COUL.grisClair, avant: 1 }),
      { filet: 0.6, h: 5 }
    ]);

    /* ---- texte ---- */
    const paragraphes = texteDeLaPage(donnees);
    if (paragraphes.length) {
      dessiner([T("Texte", { taille: 12, police: POLICE.gras, couleur: COUL.noir })]);
      paragraphes.forEach(p => dessiner([T(p, { taille: 10.5, avant: 1.5 })]));
      dessiner([{ h: 4 }]);
    }

    /* ---- mots traduits (bloc "vocabulaire" + mots ajoutés, seulement ceux cochés) ---- */
    const vocab = (window.Vocabulaire && typeof Vocabulaire.liste === "function")
      ? Vocabulaire.liste().filter(e => e.actif)
      : (Array.isArray(donnees.vocabulaire) ? donnees.vocabulaire : []);
    if (vocab.length) {
      let tete = [T("Mots traduits", { taille: 12, police: POLICE.gras, couleur: COUL.noir }), { h: 1 }];
      vocab.slice().sort((a, b) => String(a.mot).localeCompare(String(b.mot), "de")).forEach(e => {
        dessiner(tete.concat([T(e.mot + " : " + e.traduction, { taille: 9.5, avant: 0.4 })]));
        tete = [];
      });
      dessiner([{ h: 4 }]);
    }

    /* ---- quiz ---- */
    [1, 2, 3, 4].forEach(n => {
      const liste = qs.filter(q => q && appartientA(q, n));
      if (!liste.length) return;
      const r = reglage(n);
      const titre = "Quiz " + n + " · " + (r.bouton || LIBELLES_QUIZ[n]) + (r.titre ? " – " + r.titre : "");
      // le titre du quiz est dessiné avec sa première question (jamais seul en bas de page)
      let entete = [
        { filet: 0.3, h: 3 },
        T(titre + " (" + liste.length + " question" + (liste.length > 1 ? "s" : "") + ")",
          { taille: 11.5, police: POLICE.gras, couleur: COUL.noir }),
        r.consigne ? T(r.consigne, { taille: 9, police: POLICE.italique, couleur: COUL.gris, avant: 0.5 }) : { h: 0 },
        { h: 2 }
      ];

      liste.forEach((q, i) => {
        const num = (i + 1) + ". ";
        const bloc = [];
        const trous = champ => (typeof q[champ] === "string" && /\[[^\]]+\]/.test(q[champ])) ? analyserTrousPDF(q[champ]) : null;

        if ((n === 1 || n === 2) || (n === 3 && !trous("texte"))) {
          // QCM ou menu unique
          bloc.push(T(num + (q.question || ""), { police: POLICE.gras, avant: 1.5 }));
          (q.propositions || []).forEach((p, k) => {
            const juste = k === q.bonne;
            bloc.push(T(p, { retrait: 11, police: juste ? POLICE.gras : POLICE.normal,
              couleur: juste ? VERT : COUL.texte, case: juste, avant: 0.3 }));
          });
        } else if (n === 3) {
          const m = trous("texte");
          if (q.question) bloc.push(T(num + q.question, { police: POLICE.gras, avant: 1.5 }));
          bloc.push(T((q.question ? "" : num) + m.juste, { police: POLICE.gras, couleur: VERT, avant: q.question ? 0.3 : 1.5 }));
          m.trous.forEach((t, k) => {
            const autres = t.options.filter((o, j) => j !== t.bonne);
            bloc.push(T("Menu " + (k + 1) + " : " + t.options[t.bonne] +
              (autres.length ? "   (proposés aussi : " + autres.join(", ") + ")" : ""),
              { taille: 9.5, couleur: COUL.gris, retrait: 6, avant: 0.2 }));
          });
        } else {
          const m = trous("texteLibre");
          if (m) {
            bloc.push(T(num + (q.question || "Texte à compléter"), { police: POLICE.gras, avant: 1.5 }));
            bloc.push(T(m.juste, { couleur: VERT, police: POLICE.gras, retrait: 6, avant: 0.3 }));
            bloc.push(T("Trous : " + m.trous.map(t => t.options[t.bonne] +
              (t.options.length > 1 ? " (aussi : " + t.options.filter((o, j) => j !== t.bonne).join(", ") + ")" : "")).join(" ; "),
              { taille: 9.5, couleur: COUL.gris, retrait: 6, avant: 0.2 }));
          } else {
            const acceptees = (Array.isArray(q.reponses) && q.reponses.length) ? q.reponses
              : (Array.isArray(q.propositions) ? [q.propositions[q.bonne]] : []);
            const modele = acceptees[acceptees.length - 1] || "";
            bloc.push(T(num + (q.question || ""), { police: POLICE.gras, avant: 1.5 }));
            bloc.push(T("Réponse modèle : " + modele, { couleur: VERT, police: POLICE.gras, retrait: 6, avant: 0.3 }));
            if (acceptees.length > 1) {
              bloc.push(T("Acceptées aussi : " + acceptees.slice(0, -1).join(" · "),
                { taille: 9.5, couleur: COUL.gris, retrait: 6, avant: 0.2 }));
            }
          }
        }
        dessiner(entete.concat(bloc));
        entete = [];
      });
      dessiner([{ h: 5 }]);
    });

    pages.push(ops);

    /* ---- repères de pliage + numéro de chaque demi-page A5 ---- */
    const nbCol = colonnes.length;
    pages.forEach(o => {
      trait(o, COL, 0, COL, 6, 0.25, COUL.ligne);                    // repère de pli en haut
      trait(o, COL, MM.pageH - 6, COL, MM.pageH, 0.25, COUL.ligne);  // repère de pli en bas
    });
    colonnes.forEach((col, k) => {
      texte(pages[col.page], col.c * COL + COL - M, MM.pageH - 5,
        nom + " · corrigé · " + (k + 1) + " / " + nbCol, TAILLE.pied, POLICE.normal, COUL.grisClair, true);
    });
    const contenus = pages.map(o => o.join("\n"));
    return { octets: assemblerPDF(contenus, "Corrigé – " + titrePage), pages: pages.length, demiPages: nbCol };
  }

  // phrase à trous → phrase juste + liste des trous
  function analyserTrousPDF(t) {
    const trous = [];
    const juste = String(t).replace(/\[([^\]]+)\]/g, (tout, dedans) => {
      const brut = dedans.split("|").map(s => s.trim());
      let bonne = brut.findIndex(s => s.startsWith("*"));
      if (bonne < 0) bonne = 0;
      const options = brut.map(s => s.replace(/^\*/, ""));
      trous.push({ options, bonne });
      return options[bonne];
    });
    return { juste, trous };
  }

  /* ===============================
     6. TÉLÉCHARGEMENT
     =============================== */
  function signaler(message, erreur) {
    const b = document.getElementById("btn-fiche");
    if (erreur) console.warn("[Fiche] " + message);
    if (!b) return;
    const avant = b.dataset.libelle || b.textContent;
    b.dataset.libelle = avant;
    b.textContent = message;
    b.classList.toggle("fiche-erreur", !!erreur);
    b.classList.toggle("fiche-ok", !erreur);
    clearTimeout(b._minuterie);
    b._minuterie = setTimeout(() => {
      b.textContent = avant;
      b.classList.remove("fiche-erreur", "fiche-ok");
    }, erreur ? 4000 : 2500);
  }

  function telecharger() {
    const donnees = window.Quiz && typeof Quiz.donnees === "function" ? Quiz.donnees() : null;
    if (!donnees) {
      signaler("Charge d'abord " + RACINE + ".json", true);
      return;
    }
    let r;
    try {
      r = fabriquerPDF(donnees);
    } catch (e) {
      console.error("[Fiche] fabrication du PDF impossible :", e);
      signaler("Erreur : PDF non créé", true);
      return;
    }
    if (!r) {
      signaler("Aucune rubrique dans le bloc \"fiche\"", true);
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([r.octets], { type: "application/pdf" }));
    a.download = RACINE + ".fiche.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    signaler("✔ " + RACINE + ".fiche.pdf téléchargé (" + r.pages + " page" + (r.pages > 1 ? "s" : "") + ")");
  }

  function telechargerCorrige() {
    const donnees = window.Quiz && typeof Quiz.donnees === "function" ? Quiz.donnees() : null;
    const b = document.getElementById("btn-corrige");
    const dire = (m) => { if (b) { const av = b.dataset.libelle || b.textContent; b.dataset.libelle = av; b.textContent = m;
      setTimeout(() => { b.textContent = av; }, 2500); } };
    if (!donnees) { dire("JSON non chargé"); return; }
    let r;
    try { r = fabriquerCorrige(donnees); }
    catch (e) { console.error("[Fiche] corrigé impossible :", e); dire("Erreur"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([r.octets], { type: "application/pdf" }));
    a.download = RACINE + ".corrige.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    dire("✔ téléchargé");
  }

  /* ===============================
     7. BOUTON
     =============================== */
  function demarrer() {
    let btn = document.getElementById("btn-fiche");
    if (!btn) {
      const hote = document.getElementById("zone-quiz-sidebar");
      if (!hote) return;
      btn = el("button", { id: "btn-fiche", type: "button", class: "btn-fiche", "data-injecte-par": "Fiche" },
        "🖨 Obtenir une page de prise de notes");
      hote.appendChild(btn);
    }
    btn.addEventListener("click", telecharger);

    // bouton discret du corrigé (dans la rubrique repliable « Afficher les quiz »)
    const corrige = document.getElementById("btn-corrige");
    if (corrige) corrige.addEventListener("click", telechargerCorrige);
  }

  window.Fiche = {
    telecharger,
    telechargerCorrige,
    corrige: (donnees, racine) => { const r = fabriquerCorrige(donnees, racine); return r ? r.octets : null; },
    ouvrir: telecharger,            // ancien nom
    // PDF sous forme d'octets (tests, intégration)
    pdf: (donnees, racine) => { const r = fabriquerPDF(donnees, racine); return r ? r.octets : null; },
    // mise en page sans fabrication du PDF
    calculer: donnees => {
      const fiche = lireFiche(donnees);
      const c = calculer(fiche);
      return {
        minimum: c.minimum,
        pages: c.pages.map(p => p.map(rg => ({ rubriques: rg.items.map(r => r.titre), lignes: rg.lignesFinales })))
      };
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();

})();
