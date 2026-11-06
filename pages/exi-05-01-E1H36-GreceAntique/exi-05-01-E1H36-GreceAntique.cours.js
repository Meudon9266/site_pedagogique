/* Moteur du cours : en plusieurs pages (convention de thème), ou en un seul fichier (option, voir UNIQUE).
   THEME = racine du thème ; RACINE (= window.CLE) = clé d'exercice « THEME.cours » ; FONCTION = page (intro, p1, concl…).
   Noms reconstruits : CLE.menu.json (plan), CLE.<fonction>.<n>.<ext> (images), CLE.<période>.carte.<ext> (carte d'une période), THEME.voc.json (vocabulaire du thème), THEME.listeQuiz.json (liste des quiz) et THEME.<suffixe>.html (quiz liés). */
(function () {
  'use strict';
  var RACINE = window.RACINE, FONCTION = window.FONCTION;
  /* ---------- option « cours en un seul fichier » ----------
     Si la page contient des <section data-page="p1"> dans #cours-page, toutes les pages du cours sont dans ce fichier :
     une seule est gardée selon l'adresse (#p2, ou #identifiant d'une étape), les autres sont retirées.
     Sans ces sections, le cours reste en plusieurs fichiers (THEME.cours.p1.html…) : rien ne change. */
  var UNIQUE = false, IDPAGE = {}, FICHIER = '';
  (function () {
    var art = document.getElementById('cours-page'), secs = art ? art.querySelectorAll(':scope > section[data-page]') : [];
    if (!secs.length) return;
    UNIQUE = true;
    FICHIER = decodeURIComponent(location.pathname.split('/').pop() || '') || (RACINE + '.html');
    Array.prototype.forEach.call(secs, function (sc) {
      var f = sc.getAttribute('data-page'); IDPAGE[f] = f;
      Array.prototype.forEach.call(sc.querySelectorAll('[id]'), function (n) { if (!IDPAGE[n.id]) IDPAGE[n.id] = f; });
    });
    var h = decodeURIComponent(location.hash.slice(1)), cible = IDPAGE[h] || secs[0].getAttribute('data-page');
    FONCTION = cible; window.FONCTION = cible;
    var garde = null;
    Array.prototype.forEach.call(secs, function (sc) { if (sc.getAttribute('data-page') === cible) garde = sc; });
    while (art.firstChild) art.removeChild(art.firstChild);
    while (garde.firstChild) art.appendChild(garde.firstChild);
    var h1 = art.querySelector('h1'), t = document.title.split(' — ');
    if (h1) document.title = h1.textContent.trim() + ' — ' + t[t.length - 1];
    if (!location.hash || IDPAGE[h] === h) window.scrollTo(0, 0);
    /* changer de page = recharger le fichier avec la nouvelle adresse ; rester dans la page = simple changement d'étape */
    window.addEventListener('hashchange', function () {
      var n = decodeURIComponent(location.hash.slice(1));
      if (IDPAGE[n] && IDPAGE[n] !== FONCTION) location.reload();
    });
  })();
  var EXTS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  /* ---------- images : RACINE.<fonction>.<n>.<ext> ---------- */
  function chercherImage(nomBase, ok, ko, i) {
    i = i || 0;
    /* d'abord le sous-dossier ressources/, puis le dossier de la page (repli) */
    if (i >= 2 * EXTS.length) return ko();
    var img = new Image();
    img.onload = function () { ok(img); };
    img.onerror = function () { chercherImage(nomBase, ok, ko, i + 1); };
    img.src = (i < EXTS.length ? 'ressources/' : '') + nomBase + '.' + EXTS[i % EXTS.length];
  }

  /* ---------- explications orales et vidéo (aside.explic[data-media][data-n]), noms reconstruits : RACINE.FONCTION.orale.N.mp3 / RACINE.FONCTION.video.N.mp4 ---------- */
  var MEDIAS = { orale: { exts: [['mp3', 'audio/mpeg'], ['m4a', 'audio/mp4'], ['ogg', 'audio/ogg'], ['wav', 'audio/wav']], balise: 'audio', texte: 'Enregistrement à ajouter' },
                 video: { exts: [['mp4', 'video/mp4'], ['webm', 'video/webm']], balise: 'video', texte: 'Vidéo à ajouter' } };
  function explications() {
    Array.prototype.forEach.call(document.querySelectorAll('aside.explic[data-media][data-n]'), function (a) {
      var t = MEDIAS[a.getAttribute('data-media')]; if (!t || a.querySelector('audio, video, .ph')) return;
      var base = RACINE + '.' + FONCTION + '.' + a.getAttribute('data-media') + '.' + a.getAttribute('data-n');
      var m = document.createElement(t.balise); m.controls = true; m.preload = 'metadata'; m.className = 'explic-media';
      var srcs = [];
      ['ressources/', ''].forEach(function (d) { t.exts.forEach(function (e) { srcs.push([d + base + '.' + e[0], e[1]]); }); });
      srcs.forEach(function (s, k) {
        var so = document.createElement('source'); so.src = s[0]; so.type = s[1];
        if (k === srcs.length - 1) so.addEventListener('error', function () {
          var ph = document.createElement('div'); ph.className = 'ph'; ph.textContent = t.texte + ' (' + base + ')';
          if (m.parentNode) m.parentNode.replaceChild(ph, m);
        });
        m.appendChild(so);
      });
      m.addEventListener('play', function () {
        try { if (window.AudioDE && window.AudioDE.arreter) window.AudioDE.arreter(); } catch (e) { /* ignoré */ }
        try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignoré */ }
        Array.prototype.forEach.call(document.querySelectorAll('.explic-media'), function (x) { if (x !== m) x.pause(); });
      });
      var titre = a.querySelector('.explic-titre');
      if (titre) titre.insertAdjacentElement('afterend', m); else a.insertBefore(m, a.firstChild);
    });
  }
  document.addEventListener('cours:ecran', function () { Array.prototype.forEach.call(document.querySelectorAll('.explic-media'), function (x) { x.pause(); }); });
  function figures() {
    var figs = document.querySelectorAll('figure.img[data-n]');
    Array.prototype.forEach.call(figs, function (f) {
      var base = RACINE + '.' + FONCTION + '.' + f.getAttribute('data-n');
      var cap = f.querySelector('figcaption');
      chercherImage(base, function (img) { img.alt = cap ? cap.textContent : ''; f.insertBefore(img, f.firstChild); },
        function () { f.insertBefore(el('div', { class: 'ph', text: 'Image à ajouter (' + base + '.png ou .jpg)' }), f.firstChild); });
    });
  }
  /* ---------- plan du cours ---------- */
  function perDe(menu, id) { for (var i = 0; i < menu.periodes.length; i++) if (menu.periodes[i].id === id) return menu.periodes[i]; return null; }
  function pageUrl(f) { return UNIQUE ? FICHIER + '#' + f : RACINE + '.' + f + '.html'; }
  function appliquerTeinte(node, per) { if (per) { node.classList.add('per'); node.style.setProperty('--h', per.teinte); } }
  function construire(menu) {
    var pages = menu.pages, idx = -1, i;
    for (i = 0; i < pages.length; i++) if (pages[i].fonction === FONCTION) idx = i;
    var page = pages[idx], per = page && page.periode ? perDe(menu, page.periode) : null;
    if (per) appliquerTeinte(document.body, per);
    /* haut : frise des cinq périodes, fil d'Ariane, bandeau de la période */
    var haut = document.getElementById('cours-haut');
    var frise = el('nav', { class: 'frise', 'aria-label': 'Les cinq périodes du cours' });
    menu.periodes.forEach(function (p, n) {
      var a = el('a', { href: pageUrl(p.page), title: p.titre }, ['Période ' + (n + 1)]);
      a.appendChild(el('span', { class: 'sous', text: p.dates }));
      appliquerTeinte(a, p);
      if (per && per.id === p.id) a.classList.add('actif');
      frise.appendChild(a);
    });
    haut.appendChild(frise);
    var fil = el('p', { class: 'fil' }, [el('a', { href: pageUrl(pages[0].fonction), text: menu.titre })]);
        haut.appendChild(fil); FIL = fil;
    /* la période est signalée par le titre de la page (cadre coloré) : plus de bandeau en petits caractères */
    haut.appendChild(planComplet(menu, idx));
    /* écrans : une page qui a des sections s'affiche un écran à la fois (tout reste dans le même fichier) */
    var secs = (menu.sections || []).filter(function (s) { return s.page === FONCTION; });
    var ecr = secs.length ? decouperEcrans(secs, per) : null;
    FIN = ecr ? ecr[ecr.length - 1].node : document.getElementById('cours-page');
    /* bas : précédent / suivant */
    var bas = document.getElementById('cours-bas'), nav = el('div', { class: 'pagination' });
    function lien(p, cls, lib) {
      var a = el('a', { href: pageUrl(p.fonction), class: cls }, [el('small', { text: lib }), p.titre]);
      appliquerTeinte(a, p.periode ? perDe(menu, p.periode) : null); return a;
    }
    function lienEcran(e, cls, lib) {
      var a = el('a', { href: '#' + e.id, class: cls }, [el('small', { text: lib }), e.titre]); appliquerTeinte(a, per); return a;
    }
    function rendreNav(n) {
      nav.textContent = '';
      var prec = ecr ? (n > 0 ? lienEcran(ecr[n - 1], 'prec', '← Étape précédente') : null) : null;
      var suiv = ecr ? (n < ecr.length - 1 ? lienEcran(ecr[n + 1], 'suiv', 'Étape suivante →') : null) : null;
      if (!prec && idx > 0) prec = lien(pages[idx - 1], 'prec', '← Page précédente');
      if (!suiv && idx >= 0 && idx < pages.length - 1) suiv = lien(pages[idx + 1], 'suiv', 'Page suivante →');
      if (prec) nav.appendChild(prec);
      if (suiv) nav.appendChild(suiv);
    }
    if (ecr) {
      var indic = el('p', { class: 'fil indic-ecran' }); document.getElementById('cours-haut').appendChild(indic);
      var afficher = function (premier) {
        var id = decodeURIComponent(location.hash.slice(1)), n = 0;
        ecr.forEach(function (e, k) { if (e.id === id) n = k; });
        ecr.forEach(function (e, k) { e.node.hidden = k !== n; });
        indic.textContent = 'Étape ' + (n + 1) + ' sur ' + ecr.length + ' · ' + ecr[n].titre;
        rendreNav(n);
        if (!premier) { document.getElementById('cours-haut').scrollIntoView({ behavior: 'smooth', block: 'start' }); document.dispatchEvent(new Event('cours:ecran')); }
      };
      window.addEventListener('hashchange', function () { afficher(false); });
      afficher(true);
      if (location.hash) { var cible = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (cible && cible.scrollIntoView) cible.scrollIntoView(); }
    } else rendreNav(0);
    bas.appendChild(nav);
    /* contenus dynamiques */
    var plan = document.querySelector('[data-plan]');
    if (plan) plan.appendChild(planPartie(menu, plan.getAttribute('data-plan')));
    var cartes = document.querySelector('[data-periodes]');
    if (cartes) cartesPeriodes(menu, cartes);
    Array.prototype.forEach.call(document.querySelectorAll('tr[data-periode]'), function (tr) { appliquerTeinte(tr, perDe(menu, tr.getAttribute('data-periode'))); });
    Array.prototype.forEach.call(document.querySelectorAll('.etiquette'), function (s) {
      var tr = s.closest('tr'); if (tr) appliquerTeinte(s, perDe(menu, tr.getAttribute('data-periode')));
    });
    afficherExo();
    lecteur();
    accueil(menu);
  }

  /* ---------- écran d'accueil : une seule fois par navigateur (mémoire locale), texte dans menu.json (« accueil ») ---------- */
  function accueil(menu) {
    var a = menu.accueil; if (!a || !a.message) return;
    var cle = 'accueil:' + RACINE;
    try { if (localStorage.getItem(cle)) return; } catch (e) { /* mémoire locale indisponible : l'écran s'affiche */ }
    var fond = el('div', { class: 'accueil-fond' }), boite = el('div', { class: 'accueil', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'accueil-titre' });
    boite.appendChild(el('h2', { id: 'accueil-titre', text: a.titre || menu.titre || '' }));
    String(a.message).split(/\n\s*\n|\n/).forEach(function (t) { if (t.trim()) boite.appendChild(el('p', { text: t.trim() })); });
    var ok = el('button', { type: 'button', class: 'accueil-ok', text: a.bouton || 'Compris' });
    function fermer() { try { localStorage.setItem(cle, '1'); } catch (e) { } fond.remove(); document.removeEventListener('keydown', touche); }
    function touche(ev) { if (ev.key === 'Escape') fermer(); }
    ok.addEventListener('click', fermer); document.addEventListener('keydown', touche);
    boite.appendChild(ok); fond.appendChild(boite); document.body.appendChild(fond); ok.focus();
  }

  /* ---------- exercices du thème (THEME.listeQuiz.json) : cartes de la conclusion + entrées du plan ---------- */
  var EXO = null, ulPlan = null, cartesFaites = false, planFait = false;
  var FIL = null, FIN = null, accesFait = false, finFait = false;
  function afficherExo() {
    if (!EXO) return;
    var T = EXO.types || {}, liste = EXO.exercices || [], S = EXO.section || {};
    var conteneur = document.querySelector('[data-exercices]');
    if (conteneur && !cartesFaites) {
      cartesFaites = true;
      if (S.titre) conteneur.appendChild(el('h2', { text: S.titre }));
      if (S.intro) conteneur.appendChild(el('p', { text: S.intro }));
      Object.keys(T).forEach(function (ty) {
        var items = liste.filter(function (x) { return x.type === ty; });
        if (!items.length) return;
        var groupe = el('section', { class: 'exo-groupe exo-' + ty }, [el('h3', { text: (T[ty].icone ? T[ty].icone + ' ' : '') + (T[ty].titre || '') })]), grille = el('div', { class: 'exo-grille' });
        items.forEach(function (x) {
          grille.appendChild(el('article', { class: 'exo-carte' }, [
            el('p', { class: 'exo-type', text: (T[ty].quiz || '') + (T[ty].note ? ' · ' + T[ty].note : '') }),
            el('h4', { text: x.titre }),
            el('p', { class: 'exo-contenu', text: x.contenu || '' }),
            el('a', { class: 'exo-bouton', href: window.THEME + '.' + x.suffixe + '.html', text: S.bouton || 'Commencer' })]));
        });
        groupe.appendChild(grille); conteneur.appendChild(groupe);
      });
    }
    if (ulPlan && !planFait && liste.length) {
      planFait = true;
      ulPlan.appendChild(el('li', { class: 'neutre groupe', text: S.plan || '' }));
      liste.forEach(function (x) {
        var ty = T[x.type] || {};
        ulPlan.appendChild(el('li', { class: 'neutre' }, [el('a', { href: window.THEME + '.' + x.suffixe + '.html', text: (ty.icone ? ty.icone + ' ' : '') + (ty.planEtiquette ? ty.planEtiquette + ' : ' : '') + x.titre })]));
      });
    }

    /* accès direct aux quiz : deux pastilles dans la ligne du fil d'Ariane + carte en fin de partie */
    if (FIL && !accesFait && liste.length) { accesFait = true; pastillesQuiz(T, liste); }
    if (FIN && !finFait && liste.length) {
      finFait = true;
      var miens = liste.filter(function (x) { return (x.parties || []).indexOf(FONCTION) >= 0; });
      if (miens.length) {
        var boite = el('aside', { class: 'quiz-fin' }, [el('p', { class: 'qf-titre', text: S.finTitre || 'Pour t\'entraîner sur cette partie' })]);
        miens.forEach(function (x) {
          var ty = T[x.type] || {};
          boite.appendChild(el('a', { class: 'qf-lien', href: window.THEME + '.' + x.suffixe + '.html', title: x.contenu || '' }, [
            el('span', { class: 'qf-titre-quiz', text: (ty.icone ? ty.icone + ' ' : '') + x.titre }),
            el('small', { text: (ty.quiz || '') + (ty.note ? ' · ' + ty.note : '') })]));
        });
        FIN.appendChild(boite);
      }
    }
  }
  function pastillesQuiz(T, liste) {
    var conteneur = el('span', { class: 'acces-quiz' }), ouverts = [];
    FIL.classList.add('avec-quiz');
    function fermer() { ouverts.forEach(function (o) { o.menu.hidden = true; o.btn.setAttribute('aria-expanded', 'false'); }); }
    ['decouverte', 'evaluation'].forEach(function (ty) {
      var items = liste.filter(function (x) { return x.type === ty; });
      if (!items.length) return;
      var t = T[ty] || {}, court = t.court || (ty === 'decouverte' ? 'Des quiz pour découvrir' : 'Me contrôler');
      var btn = el('button', { type: 'button', class: 'aq-btn aq-' + ty, 'aria-expanded': 'false', 'aria-haspopup': 'true', text: (t.icone ? t.icone + ' ' : '') + court });
      var menu = el('div', { class: 'aq-menu aq-menu-' + ty, role: 'menu' }, [el('p', { class: 'aq-titre', text: (t.quiz || court) + (t.note ? ' · ' + t.note : '') })]);
      items.forEach(function (x) { menu.appendChild(el('a', { href: window.THEME + '.' + x.suffixe + '.html', role: 'menuitem', title: x.contenu || '', text: x.titre })); });
      menu.hidden = true;
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var ouvrir = menu.hidden; fermer();
        if (ouvrir) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
      });
      ouverts.push({ btn: btn, menu: menu });
      conteneur.appendChild(btn); conteneur.appendChild(menu);
    });
    document.addEventListener('click', function (ev) { if (!conteneur.contains(ev.target)) fermer(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermer(); });
    FIL.appendChild(conteneur);
  }
  function chargerExo() {
    fetch(window.THEME + '.listeQuiz.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { EXO = d; afficherExo(); }).catch(function () { manquants.exo = true; boiteManuelle(); });
  }
  function decouperEcrans(secs, per) {
    var art = document.getElementById('cours-page'), kids = Array.prototype.slice.call(art.children);
    var ecr = [{ id: 'debut', titre: 'Présentation', node: el('section', { class: 'ecran' }) }], cur = ecr[0].node, enAttente = [];
    kids.forEach(function (k) {
      if (k.tagName === 'H1') return; /* le titre de la partie, avec son fond coloré, reste affiché à toutes les étapes */
      var s = null; secs.forEach(function (x) { if (k.id === x.id) s = x; }); /* une étape commence à un titre ou à tout autre bloc portant l'identifiant d'une section */
      if (s) {
        cur = el('section', { class: 'ecran' }); ecr.push({ id: s.id, titre: s.titre, node: cur });
        enAttente.forEach(function (h) { h.classList.add('groupe-titre'); cur.appendChild(h); }); enAttente = [];
      } else if (k.tagName === 'H2') { enAttente.push(k); return; }
      cur.appendChild(k);
    });
    if (ecr.length > 1 && !ecr[0].node.firstChild) ecr.shift(); /* titre directement suivi d'une étape : pas d'écran de présentation vide */
    ecr.forEach(function (e) { art.appendChild(e.node); });
    return ecr;
  }
  function planComplet(menu, idx) {
    var d = el('details', { class: 'plan' }, [el('summary', { title: 'Plan du cours', 'aria-label': 'Plan du cours' }, [el('span', { class: 'plan-ico', text: '☰' }), el('span', { class: 'plan-mot', text: 'Plan' })])]);
    var ul = el('ul'), panneau = el('div', { class: 'plan-panneau' }, [el('p', { class: 'plan-titre', text: 'Plan du cours' })]);
    document.addEventListener('click', function (ev) { if (d.open && !d.contains(ev.target)) d.open = false; });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && d.open) { d.open = false; } });
    menu.pages.forEach(function (p, n) {
      var per = p.periode ? perDe(menu, p.periode) : null;
      var li = el('li', { class: (n === idx ? 'courante' : '') + (per ? '' : ' neutre') }, [el('a', { href: pageUrl(p.fonction), text: p.titre })]);
      appliquerTeinte(li, per); ul.appendChild(li);
      (menu.sections || []).forEach(function (s) {
        if (s.page !== p.fonction || s.plan === false) return;
        var l2 = el('li', { class: 'sous-page' }, [el('a', { href: (n === idx || UNIQUE ? '' : pageUrl(p.fonction)) + '#' + s.id, text: s.titre })]);
        appliquerTeinte(l2, per); ul.appendChild(l2);
      });
    });
    ulPlan = ul;
    panneau.appendChild(ul); d.appendChild(panneau); return d;
  }
  function planPartie(menu, fonction) {
    var page = null; menu.pages.forEach(function (p) { if (p.fonction === fonction) page = p; });
    var per = page && page.periode ? perDe(menu, page.periode) : null, box = el('div', { class: 'plan' }), ul = null, g = null;
    (menu.sections || []).forEach(function (s) {
      if (s.page !== fonction || s.plan === false) return;
      if (s.groupe !== g) { g = s.groupe; box.appendChild(el('p', { class: 'groupe', text: g || '' })); ul = el('ul'); box.appendChild(ul); }
      var li = el('li', null, [el('a', { href: '#' + s.id, text: s.titre })]);
      appliquerTeinte(li, per); ul.appendChild(li);
    });
    appliquerTeinte(box, per); return box;
  }
  function cartesPeriodes(menu, conteneur) {
    menu.periodes.forEach(function (p, n) {
      var c = el('div', { class: 'carte-periode' }, [
        el('h4', null, [el('a', { href: pageUrl(p.page), text: 'Période ' + (n + 1) + ' : ' + p.titre })]),
        el('p', { class: 'dates', text: p.dates }),
        el('p', { text: p.resume })]);
      appliquerTeinte(c, p);
      var fig = el('figure');
      chercherImage(RACINE + '.' + p.id + '.carte', function (img) { img.alt = 'Carte de la période ' + (n + 1); fig.appendChild(img); },
        function () { fig.appendChild(el('div', { class: 'ph', text: 'Carte de la période à ajouter (' + RACINE + '.' + p.id + '.carte.png)' })); });
      c.appendChild(fig); conteneur.appendChild(c);
    });
  }

  /* ---------- lecture audio de la narration (module commun Partage.Audio.js, objet AudioDE) ---------- */
  var ORD = ['', 'premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième',
    'onzième', 'douzième', 'treizième', 'quatorzième', 'quinzième', 'seizième', 'dix-septième', 'dix-huitième', 'dix-neuvième', 'vingtième', 'vingt et unième'];
  function romain(r) { var v = { I: 1, V: 5, X: 10 }, n = 0; for (var i = 0; i < r.length; i++) { var a = v[r[i]], b = v[r[i + 1]] || 0; n += a < b ? -a : a; } return n; }
  function pourLaVoix(x) {
    return x.replace(/\b([IVX]+)(?:e|er)\s+s\./g, function (m, r) { return (ORD[romain(r)] || r) + ' siècle'; })
      .replace(/\b([IVX]+)(?:e|er)\b/g, function (m, r) { return ORD[romain(r)] || m; })
      .replace(/av\. J\.-C\./g, 'avant Jésus-Christ').replace(/J\.-C\./g, 'Jésus-Christ')
      .replace(/(\d)\s*[–\-]\s*(\d)/g, '$1 à $2').replace(/km²/g, 'kilomètres carrés').replace(/\s+/g, ' ').trim();
  }
  var SAUTER = '.explic, .legende, .retenir, .activite, .jeu, .consigne, table, figure, details, .cartes-periodes, .plan, [data-plan], h4';
  function blocsNarration() {
    var racine = document.getElementById('cours-page'), res = [];
    Array.prototype.forEach.call(racine.querySelectorAll('h1, h2, h3, p, li'), function (n) {
      if (n.closest(SAUTER) || n.closest('.ecran[hidden]')) return;
      var tx = pourLaVoix(n.textContent);
      if (tx) res.push({ el: n, titre: /^H/.test(n.tagName), texte: tx });
    });
    return res;
  }
  function phrases(tx) {
    var out = [], cur = '';
    tx.split(/(?<=[.!?…])\s+/).forEach(function (ph) {
      if (cur && (cur + ' ' + ph).length > 240) { out.push(cur); cur = ph; } else cur = cur ? cur + ' ' + ph : ph;
    });
    if (cur) out.push(cur); return out;
  }
  function chargerAudio(ok, ko) {
    if (window.AudioDE) return ok();
    var m = document.querySelector('meta[name="audio"]'), base = m ? new URL(m.content, location.href).href : '';
    function charger(url, suite) {
      var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = suite; document.body.appendChild(s);
    }
    /* version propre à ce cours d'abord, sinon le module commun */
    charger(RACINE + '.Audio.js', function () { charger(base + 'Partage.Audio.js', ko); });
  }
  var lecteurFait = false;
  function lecteur() {
    if (lecteurFait) return; lecteurFait = true;
    if (!blocsNarration().length) return;
    /* marque-page fixé sur le bord droit : ne prend aucune place dans la page */
    var etat = el('p', { class: 'lecteur-etat', 'aria-live': 'polite' });
    var bMain = el('button', { type: 'button', class: 'lecteur-main', title: 'Écouter cette page', 'aria-label': 'Écouter cette page', text: '🔊' });
    var bStop = el('button', { type: 'button', title: 'Arrêter la lecture', 'aria-label': 'Arrêter la lecture', text: '⏹', hidden: '' });
    var bVit = el('button', { type: 'button', title: 'Vitesse de lecture', 'aria-label': 'Vitesse de lecture', text: '⚙' });
    var vit = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: '1', 'aria-label': 'Vitesse de lecture' });
    var pop = el('div', { class: 'lecteur-pop', hidden: '' }, [el('label', null, ['Vitesse ', vit]), etat]);
    var boite = el('div', { class: 'lecteur' }, [pop, bMain, bStop, bVit]);
    document.body.appendChild(boite);
    var mode = 'repos', courant = null, lignesCour = null;
    function surligne(i, lignes) {
      if (courant) courant.classList.remove('lecture-en-cours');
      courant = (i === null || i === undefined) ? null : lignes[i].bloc.el;
      if (courant) { courant.classList.add('lecture-en-cours'); courant.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      /* voix en cours (ouvrir ⚙ pour la lire) : sert à repérer une voix qui ne convient pas */
      if (courant && lignes[i] && window.AudioDE && window.AudioDE.choisirVoix) {
        var vx = window.AudioDE.choisirVoix(lignes[i].role);
        etat.textContent = (lignes[i].bloc.titre ? 'Titre' : 'Paragraphe') + ' lu par : ' + (vx ? vx.name : 'voix par défaut du navigateur');
      }
    }
    function regler(m) {
      mode = m; boite.setAttribute('data-mode', m);
      bMain.textContent = m === 'lecture' ? '⏸' : m === 'pause' ? '▶' : '🔊';
      var lib = m === 'lecture' ? 'Pause' : m === 'pause' ? 'Reprendre la lecture' : 'Écouter cette page';
      bMain.title = lib; bMain.setAttribute('aria-label', lib); bStop.hidden = m === 'repos';
    }
    function demarrer(debut) {
      var A = window.AudioDE; A.definirLangue('fr');
      var roles = A.roles('fr'), voix = roles.propositions && roles.propositions.length > 1 ? roles.propositions : [roles.voixA, roles.voixB];
      var lignes = [], nb = 0, blocs = blocsNarration();
      blocs.forEach(function (b) {
        var role = b.titre ? roles.narrateur : voix[nb++ % voix.length];   // titres : narrateur ; paragraphes : alternance
        phrases(b.texte).forEach(function (ph) { lignes.push({ role: role, text: ph, bloc: b }); });
        if (b.titre) lignes.push({ type: 'pause', value: 'courte' });
      });
      lignesCour = lignes; regler('lecture'); etat.textContent = '';
      A.lireDialogue(lignes, function (i) { surligne(i, lignes); }, { debut: debut || 0, onFin: function () { regler('repos'); lignesCour = null; } });
    }
    bMain.addEventListener('click', function () {
      if (mode === 'repos') {
        etat.textContent = 'Chargement de la voix…'; pop.hidden = false;
        chargerAudio(function () { etat.textContent = ''; pop.hidden = true; demarrer(); },
          function () { etat.textContent = 'Module audio introuvable (' + RACINE + '.Audio.js ou Partage.Audio.js, voir <meta name="audio">).'; });
      } else { regler(window.AudioDE.pauseOuReprendre() === 'pause' ? 'pause' : 'lecture'); }
    });
    bStop.addEventListener('click', function () { window.AudioDE.arreter(); regler('repos'); lignesCour = null; });
    /* clic dans le texte pendant la lecture (ou la pause) : la lecture reprend à la phrase cliquée */
    function decalage(e, bloc) {
      var r = null;
      if (document.caretPositionFromPoint) { var p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
      else if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!r || !bloc.contains(r.startContainer)) return 0;
      var av = document.createRange(); av.selectNodeContents(bloc); av.setEnd(r.startContainer, r.startOffset);
      return pourLaVoix(av.toString()).length;
    }
    document.getElementById('cours-page').addEventListener('click', function (e) {
      if (mode === 'repos' || !lignesCour || !window.AudioDE) return;
      if (e.target.closest('a, button, summary, input, select, u.mot, .lecteur')) return;
      if (String(window.getSelection()).length) return;
      var n = e.target;
      while (n && n.id !== 'cours-page') {
        var idx = [], i;
        for (i = 0; i < lignesCour.length; i++) if (lignesCour[i].bloc && lignesCour[i].bloc.el === n) idx.push(i);
        if (idx.length) {
          var pos = decalage(e, n), cum = 0, choix = idx[0];
          for (i = 0; i < idx.length; i++) { var len = lignesCour[idx[i]].text.length; choix = idx[i]; if (pos <= cum + len) break; cum += len + 1; }
          var A = window.AudioDE;
          regler('lecture');
          A.lireDialogue(lignesCour, function (k) { surligne(k, lignesCour); }, { debut: choix, onFin: function () { regler('repos'); lignesCour = null; } });
          return;
        }
        n = n.parentElement;
      }
    });
    bVit.addEventListener('click', function () { pop.hidden = !pop.hidden; });
    vit.addEventListener('input', function () { if (window.AudioDE) window.AudioDE.definirVitesse(vit.value, true); });
    document.addEventListener('cours:ecran', function () { if (window.AudioDE) window.AudioDE.arreter(); regler('repos'); });
    window.addEventListener('pagehide', function () { if (window.AudioDE) window.AudioDE.arreter(); });
  }

  /* ---------- chargement du plan (menu.json) ---------- */
  var manquants = {}, boite = null, planCharge = false;
  function boiteManuelle() {
    if (!boite) {
      boite = el('div', { id: 'manuel' }, [el('p', { id: 'manuel-msg' }), el('input', { type: 'file', accept: '.json,application/json', multiple: '' })]);
      boite.querySelector('input').addEventListener('change', function (e) {
        Array.prototype.forEach.call(e.target.files, function (f) {
          var r = new FileReader();
          r.onload = function () {
            try {
              var d = JSON.parse(r.result);
              if (/\.menu\.json$/.test(f.name) && manquants.menu) { manquants.menu = false; construire(d); }
              else if (/\.voc\.json$/.test(f.name) && manquants.voc) { manquants.voc = false; appliquerVoc(d); }
              else if (/\.listeQuiz\.json$/.test(f.name) && manquants.exo) { manquants.exo = false; EXO = d; afficherExo(); }
              else return;
              boiteManuelle();
            } catch (x) { alert('Fichier illisible : ' + f.name); }
          };
          r.readAsText(f);
        });
      });
      document.getElementById('cours-haut').appendChild(boite);
    }
    var noms = [];
    if (manquants.menu) noms.push(RACINE + '.menu.json (plan, couleurs, navigation)');
    if (manquants.voc) noms.push(window.THEME + '.voc.json (définitions au survol)');
    if (manquants.exo) noms.push(window.THEME + '.listeQuiz.json (liste des quiz)');
    if (!noms.length) { boite.remove(); boite = null; return; }
    document.getElementById('manuel-msg').textContent = 'Fichier(s) non chargé(s) automatiquement (ouverture locale de la page, par exemple) : ' + noms.join(' et ') + '. Choisis-le(s) toi-même (tu peux en sélectionner plusieurs à la fois) :';
  }
  function manuel() { manquants.menu = true; boiteManuelle(); lecteur(); }
  /* ---------- définitions au survol (RACINE.voc.json) ---------- */
  function norm(x) { return x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[sx]$/, ''); }
  function appliquerVoc(v) {
    {
      var table = {};
      v.mots.forEach(function (m) { m.formes.forEach(function (f) { table[norm(f)] = m; }); });
      var bulle = el('div', { class: 'bulle-mot', role: 'tooltip', hidden: '' });
      document.body.appendChild(bulle);
      function montrer(u, m) {
        bulle.textContent = '';
        bulle.appendChild(el('b', { text: m.mot }));
        bulle.appendChild(document.createTextNode(' : ' + m.definition));
        bulle.hidden = false;
        var r = u.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
        bulle.style.maxWidth = w + 'px';
        var x = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
        bulle.style.left = x + window.scrollX + 'px';
        /* au-dessus du mot (le pointeur ne cache plus le début de la bulle) ; en dessous s'il n'y a pas la place */
        var haut = r.top - bulle.offsetHeight - 8;
        bulle.style.top = (haut >= 4 ? r.top + window.scrollY - bulle.offsetHeight - 8 : r.bottom + window.scrollY + 22) + 'px';
      }
      function cacher() { bulle.hidden = true; }
      Array.prototype.forEach.call(document.querySelectorAll('#cours-page u'), function (u) {
        if (u.closest('table.reperes')) return;
        var m = table[norm(u.textContent.trim())]; if (!m) return;
        u.classList.add('mot'); u.tabIndex = 0;
        u.addEventListener('mouseenter', function () { montrer(u, m); });
        u.addEventListener('mouseleave', cacher);
        u.addEventListener('focus', function () { montrer(u, m); });
        u.addEventListener('blur', cacher);
        u.addEventListener('click', function (e) { e.stopPropagation(); montrer(u, m); });
      });
      document.addEventListener('click', cacher);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cacher(); });
    }
  }
  function chargerVoc() {
    fetch(window.THEME + '.voc.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(appliquerVoc).catch(function () { manquants.voc = true; boiteManuelle(); });
  }
  figures();
  explications();
  chargerVoc();
  chargerExo();
  fetch(RACINE + '.menu.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(construire).catch(function (e) { manuel(String(e)); });
})();

/* Taille du texte : deux boutons A− / A+ (malvoyants), commun à tous les cours et quiz.
   Réglage mémorisé sur l'appareil (clé 'tailleTexte'), partagé par toutes les pages du site. */
(function (avecPlan) {
  if (window.__tailleTexte) return; window.__tailleTexte = true;
  var NIV = [1, 1.15, 1.3, 1.5, 1.75, 2], K = 'tailleTexte', n = 0, base = 0;
  function lire() { try { var v = parseInt(localStorage.getItem(K), 10); if (v >= 0 && v < NIV.length) n = v; } catch (e) { /* ignoré */ } }
  function ecrire() { try { localStorage.setItem(K, String(n)); } catch (e) { /* ignoré */ } }
  function init() {
    if (!document.body) return;
    lire();
    base = parseFloat(getComputedStyle(document.body).fontSize) || 17;
    var st = document.createElement('style');
    st.textContent = '.taille-texte{position:fixed;left:0;top:' + (avecPlan ? 'calc(38% + 3.15rem)' : '38%') + ';z-index:44;display:flex;flex-direction:column;gap:3px;font:.9rem system-ui,sans-serif}' +
      '.taille-texte button{width:2.9rem;height:2rem;padding:0;border:2px solid var(--accent,#8a3b12);border-left:none;border-radius:0 10px 10px 0;background:var(--fond,#fff);color:var(--accent,#8a3b12);font:700 .95rem system-ui,sans-serif;cursor:pointer;opacity:.85}' +
      '.taille-texte button:hover,.taille-texte button:focus-visible{opacity:1}' +
      '.taille-texte button[disabled]{opacity:.35;cursor:default}' +
      '@media print{.taille-texte{display:none}}';
    document.head.appendChild(st);
    var box = document.createElement('div'); box.className = 'taille-texte'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Taille du texte');
    function bouton(txt, titre, d) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = titre; b.setAttribute('aria-label', titre);
      b.onclick = function () { n = Math.max(0, Math.min(NIV.length - 1, n + d)); ecrire(); appliquer(); };
      box.appendChild(b); return b;
    }
    var plus = bouton('A+', 'Agrandir le texte', 1), moins = bouton('A−', 'Réduire le texte', -1);
    function appliquer() {
      document.documentElement.style.fontSize = (16 * NIV[n]) + 'px';
      document.body.style.fontSize = (base * NIV[n]) + 'px';
      plus.disabled = n >= NIV.length - 1; moins.disabled = n <= 0;
    }
    document.body.appendChild(box); appliquer();
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})(true);
