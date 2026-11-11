/* Moteur de la page de lancement « Illustrer : les constructions géométriques ».
   Aucune donnée de contenu ici : tout vient de RACINE + '.json'. */
(function () {
  'use strict';
  var RACINE = window.RACINE;
  var app = document.getElementById('app');
  var manuel = document.getElementById('manuel');

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* ---------- Croquis (dessins constants, aucune donnée de l'utilisateur) ---------- */
  var rad = function (a) { return a * Math.PI / 180; };
  var P = function (c, r, a) { return { x: c.x + r * Math.cos(rad(a)), y: c.y - r * Math.sin(rad(a)) }; };
  var f = function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); };
  var seg = function (a, b, cls) { return '<path class="' + cls + '" d="M' + f(a) + ' L' + f(b) + '"/>'; };
  var arc = function (c, r, a1, a2, cls) {
    return '<path class="' + cls + '" d="M' + f(P(c, r, a1)) + ' A' + r + ' ' + r + ' 0 ' +
      (Math.abs(a2 - a1) > 180 ? 1 : 0) + ' ' + (a2 > a1 ? 0 : 1) + ' ' + f(P(c, r, a2)) + '"/>';
  };
  var poly = function (pts, cls) { return '<path class="' + cls + '" d="M' + pts.map(f).join(' L') + ' Z"/>'; };
  var dot = function (p) { return '<circle class="p" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.6"/>'; };
  var circ = function (c, r, cls) { return '<circle class="' + cls + '" cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="' + r.toFixed(1) + '"/>'; };
  var dist = function (p, q) { return Math.hypot(p.x - q.x, p.y - q.y); };
  var mid = function (p, q) { return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; };
  var tick = function (p, nx, ny) { return seg({ x: p.x - nx, y: p.y - ny }, { x: p.x + nx, y: p.y + ny }, 'm'); };

  var CROQUIS = {
    bissectrice: function () {
      var O = { x: 30, y: 112 }, R = 40;
      var C = P(O, R, 0), D = P(O, R, 60), r = 40;
      var d = R * Math.cos(rad(30)) + Math.sqrt(r * r - Math.pow(R * Math.sin(rad(30)), 2));
      var E = P(O, d, 30);
      return seg(O, P(O, 160, 0), 't') + seg(O, P(O, 130, 60), 't') +
        arc(O, R, -6, 66, 'c') +
        arc(C, r, 90, 150, 'c') + arc(D, r, -30, 30, 'c') +
        seg(O, P(O, 150, 30), 'v') +
        arc(O, 22, 0, 30, 'm') + arc(O, 28, 30, 60, 'm') + dot(O) + dot(E);
    },
    mediatrice: function () {
      var A = { x: 38, y: 70 }, B = { x: 162, y: 70 }, M = { x: 100, y: 70 }, r = 80;
      return seg(A, B, 't') +
        arc(A, r, -52, 52, 'c') + arc(B, r, 128, 232, 'c') +
        seg({ x: 100, y: 6 }, { x: 100, y: 134 }, 'v') +
        '<path class="m" d="M100 58 L112 58 L112 70"/>' +
        tick(mid(A, M), 0, 5) + tick(mid(M, B), 0, 5) + dot(A) + dot(B) + dot(M);
    },
    mediane: function () {
      var A = { x: 72, y: 16 }, B = { x: 28, y: 118 }, C = { x: 172, y: 118 }, M = mid(B, C);
      return poly([A, B, C], 't') + seg(A, M, 'v') +
        tick(mid(B, M), 0, 5) + tick(mid(M, C), 0, 5) + dot(A) + dot(B) + dot(C) + dot(M);
    },
    cercleCirconscrit: function () {
      var A = { x: 95, y: 30 }, B = { x: 45, y: 108 }, C = { x: 160, y: 108 };
      var d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
      var n = function (p) { return p.x * p.x + p.y * p.y; };
      var O = {
        x: (n(A) * (B.y - C.y) + n(B) * (C.y - A.y) + n(C) * (A.y - B.y)) / d,
        y: (n(A) * (C.x - B.x) + n(B) * (A.x - C.x) + n(C) * (B.x - A.x)) / d
      };
      return circ(O, dist(O, A), 'v') + poly([A, B, C], 't') +
        seg(O, A, 'c') + seg(O, B, 'c') + seg(O, C, 'c') + dot(A) + dot(B) + dot(C) + dot(O);
    },
    cercleInscrit: function () {
      var A = { x: 95, y: 14 }, B = { x: 25, y: 122 }, C = { x: 175, y: 122 };
      var a = dist(B, C), b = dist(A, C), c = dist(A, B), s = a + b + c;
      var I = { x: (a * A.x + b * B.x + c * C.x) / s, y: (a * A.y + b * B.y + c * C.y) / s };
      var r = C.y - I.y, H = { x: I.x, y: C.y };
      return poly([A, B, C], 't') + circ(I, r, 'v') + seg(A, I, 'c') + seg(B, I, 'c') + seg(C, I, 'c') +
        seg(I, H, 'm') + dot(I) + dot(H);
    }
  };

  function croquisSvg(nom) {
    var fn = CROQUIS[nom];
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 140');
    svg.setAttribute('class', 'croquis');
    svg.setAttribute('aria-hidden', 'true');
    if (fn) svg.innerHTML = fn(); /* dessin construit par ce fichier, jamais par le JSON */
    return svg;
  }

  /* ---------- Image facultative : RACINE.N.ext (essai en cascade) ---------- */
  function chargerImage(n, svg, titre) {
    var exts = ['png', 'jpg', 'jpeg', 'webp', 'svg'], i = 0;
    (function essai() {
      if (i >= exts.length) return; /* aucune image : le croquis reste */
      var img = new Image();
      img.onload = function () {
        img.className = 'image';
        img.alt = '';
        if (svg.parentNode) svg.parentNode.replaceChild(img, svg);
      };
      img.onerror = function () { i++; essai(); };
      img.src = RACINE + '.' + n + '.' + exts[i];
    })();
  }

  /* ---------- Lecture audio (bouton 🔊, un second clic arrête) ---------- */
  var lectureEnCours = null;
  function arreterLecture() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (lectureEnCours) { lectureEnCours.setAttribute('aria-pressed', 'false'); lectureEnCours = null; }
  }
  function boutonAudio(texte, etiquette) {
    var b = el('button', { type: 'button', class: 'btn-audio', 'aria-pressed': 'false', 'aria-label': etiquette, title: etiquette, text: '🔊' });
    if (!('speechSynthesis' in window)) { b.hidden = true; return b; }
    b.addEventListener('click', function () {
      if (lectureEnCours === b) { arreterLecture(); return; }
      arreterLecture();
      var u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      u.onend = u.onerror = function () { if (lectureEnCours === b) { b.setAttribute('aria-pressed', 'false'); lectureEnCours = null; } };
      b.setAttribute('aria-pressed', 'true');
      lectureEnCours = b;
      window.speechSynthesis.speak(u);
    });
    return b;
  }

  /* ---------- Validation ---------- */
  function valider(data) {
    var pb = [];
    if (!data || !Array.isArray(data.constructions) || !data.constructions.length) { pb.push('Aucune construction dans le JSON.'); return pb; }
    var vus = {};
    data.constructions.forEach(function (c, i) {
      var nom = '#' + (i + 1);
      if (!c.suffixe) pb.push(nom + ' : suffixe manquant.');
      else if (vus[c.suffixe]) pb.push(nom + ' : suffixe en double (' + c.suffixe + ').');
      vus[c.suffixe] = true;
      if (!c.titre) pb.push(nom + ' : titre manquant.');
      if (c.croquis && !CROQUIS[c.croquis]) pb.push(nom + ' : croquis inconnu (' + c.croquis + ').');
    });
    return pb;
  }

  /* ---------- Rendu ---------- */
  function rendre(data) {
    var pb = valider(data);
    app.textContent = '';
    manuel.hidden = true;
    document.title = data.titre || document.title;
    var intro = [data.titre, data.consigne].filter(Boolean).join('. ');
    app.appendChild(el('div', { class: 'tag', text: data.tag || '' }));
    app.appendChild(el('h1', { text: data.titre || '' }));
    app.appendChild(el('div', { class: 'lecture' }, [
      el('p', { class: 'consigne', text: data.consigne || '' }),
      boutonAudio(intro, 'Écouter la consigne')
    ]));
    if (pb.length) app.appendChild(el('div', { class: 'manque', role: 'status', text: 'À vérifier dans le JSON : ' + pb.join(' ') }));

    var liste = el('ul', { class: 'grille' });
    (data.constructions || []).forEach(function (c) {
      if (!c.suffixe) return;
      var vignette = croquisSvg(c.croquis);
      var lien = el('a', { class: 'lien', href: RACINE + '.' + c.suffixe + '.html' }, [
        vignette,
        el('h2', { text: c.titre || c.suffixe }),
        el('p', { text: c.description || '' }),
        el('span', { class: 'ouvrir', text: data.libelleOuvrir || 'Ouvrir →' })
      ]);
      if (c.image && c.image.n) chargerImage(c.image.n, vignette, c.titre);
      liste.appendChild(el('li', { class: 'fiche' }, [
        lien,
        boutonAudio((c.titre || '') + '. ' + (c.description || ''), 'Écouter : ' + (c.titre || c.suffixe))
      ]));
    });
    app.appendChild(liste);
    if (data.note) app.appendChild(el('p', { class: 'note', text: data.note }));
  }

  /* ---------- Chargement : automatique, sinon bouton manuel ---------- */
  function chargementManuel(msg) {
    app.textContent = '';
    app.appendChild(el('p', { text: msg }));
    manuel.textContent = '';
    var lab = el('label', { for: 'fichierJson', text: 'Choisir le fichier ' + RACINE + '.json : ' });
    var inp = el('input', { type: 'file', id: 'fichierJson', accept: '.json,application/json' });
    inp.addEventListener('change', function () {
      var fichier = inp.files && inp.files[0];
      if (!fichier) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { rendre(JSON.parse(rd.result)); } catch (e) { app.textContent = 'Ce fichier JSON ne peut pas être lu.'; }
      };
      rd.readAsText(fichier);
    });
    manuel.appendChild(lab); manuel.appendChild(inp);
    app.appendChild(manuel);
    manuel.hidden = false;
  }

  fetch(RACINE + '.json')
    .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(rendre)
    .catch(function () { chargementManuel('Le fichier de données n\'a pas pu être chargé automatiquement (ouverture locale ?).'); });
})();

/* ---------- Taille du texte (A− / A+), fonction isolée, réglage valable pour tout le site ---------- */
(function () {
  'use strict';
  if (window.SITE && window.SITE.tailleTexte) return;
  var NIVEAUX = [100, 120, 140, 160, 180, 200], CLE = 'tailleTexte', n = 0;
  try { var v = parseInt(localStorage.getItem(CLE), 10); if (v >= 0 && v < NIVEAUX.length) n = v; } catch (e) {}
  var conteneur = document.createElement('div');
  conteneur.className = 'taille-texte';
  conteneur.setAttribute('role', 'group');
  conteneur.setAttribute('aria-label', 'Taille du texte');
  var moins = document.createElement('button'), plus = document.createElement('button');
  moins.type = plus.type = 'button';
  moins.textContent = 'A−'; plus.textContent = 'A+';
  moins.setAttribute('aria-label', 'Réduire le texte'); plus.setAttribute('aria-label', 'Agrandir le texte');
  function appliquer() {
    document.documentElement.style.fontSize = NIVEAUX[n] + '%';
    moins.disabled = n === 0; plus.disabled = n === NIVEAUX.length - 1;
    try { localStorage.setItem(CLE, String(n)); } catch (e) {}
  }
  moins.onclick = function () { if (n > 0) { n--; appliquer(); } };
  plus.onclick = function () { if (n < NIVEAUX.length - 1) { n++; appliquer(); } };
  conteneur.appendChild(plus); conteneur.appendChild(moins);
  document.body.appendChild(conteneur);
  appliquer();
})();
