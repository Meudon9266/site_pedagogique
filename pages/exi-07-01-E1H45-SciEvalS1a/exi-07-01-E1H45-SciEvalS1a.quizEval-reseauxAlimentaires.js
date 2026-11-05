/* Évaluation : les réseaux alimentaires. Banque de questions + essais pénalisés. */
(function () {
  var LOCAL = typeof location !== 'undefined' && location.protocol === 'file:';
  var CACHE = 'donnees-v1:' + (typeof location !== 'undefined' ? decodeURIComponent(location.pathname.split('/').pop()) : 'test');
  function memoriser(obj) { if (LOCAL) { try { localStorage.setItem(CACHE, JSON.stringify(obj)); } catch(e) {} } }
  function lireDonnees(url, options) {
    if (LOCAL) { try { var c = localStorage.getItem(CACHE); if(c) return Promise.resolve({ok:true,json:function(){return Promise.resolve(JSON.parse(c));}}); } catch(e) {} }
    return fetch(url, options);
  }

  'use strict';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'texte') e.textContent = attrs[k];
      else if (k === 'classe') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function melanger(t, alea) {
    alea = alea || Math.random;
    var a = t.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(alea() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  /* ---- validation : renvoie la liste des problèmes ---- */
  function valider(d) {
    var pb = [], ids = {}, per = {}, grp = {};
    (d.periodes || []).forEach(function (p) { per[p.id] = true; });
    (d.groupes || []).forEach(function (g) { grp[g.id] = true; });
    (d.questions || []).forEach(function (q, i) {
      var n = 'Question ' + (q.id || '#' + (i + 1)) + ' : ';
      if (!q.id) pb.push(n + 'identifiant vide.');
      else if (ids[q.id]) pb.push(n + 'identifiant en double.');
      ids[q.id] = true;
      if (!q.enonce) pb.push(n + 'énoncé vide.');
      if (!grp[q.groupe]) pb.push(n + 'groupe inconnu « ' + q.groupe + ' ».');
      if (q.type === 'qcm') {
        if (!q.options || q.options.length < 2) pb.push(n + 'au moins 2 options.');
        else if (!(q.bonne >= 0 && q.bonne < q.options.length)) pb.push(n + 'bonne réponse hors des options.');
      } else if (q.type === 'vf') {
        if (typeof q.vrai !== 'boolean') pb.push(n + '« vrai » doit être vrai ou faux.');
      } else if (q.type === 'periode') {
        if (!per[q.bonne]) pb.push(n + 'période inconnue « ' + q.bonne + ' ».');
      } else if (q.type === 'portee') {
        if (q.bonne !== 'une' && q.bonne !== 'plusieurs') pb.push(n + '« bonne » doit être « une » ou « plusieurs ».');
      } else if (q.type === 'nature') {
        if (q.bonne !== 'evenement' && q.bonne !== 'pilier') pb.push(n + '« bonne » doit être « evenement » ou « pilier ».');
      } else if (q.type === 'asso') {
        if (!q.paires || q.paires.length < 2) pb.push(n + 'au moins 2 paires.');
      } else if (q.type === 'saisie') {
        if (!q.phrase || q.phrase.indexOf('___') < 0) pb.push(n + 'la phrase doit contenir ___ à l\'endroit du mot.');
        if (!q.reponse) pb.push(n + 'mot attendu vide.');
      } else pb.push(n + 'type inconnu « ' + q.type + ' ».');
      if (q.image && !(q.image.n >= 1)) pb.push(n + 'image : numéro manquant.');
      if (!q.explication) pb.push(n + 'explication vide.');
    });
    return pb;
  }

  /* ---------- lecture audio des questions et des commentaires (élèves dyslexiques) ---------- */
  var AUDIO = (function () {
    var ORD = ['', 'premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième',
      'onzième', 'douzième', 'treizième', 'quatorzième', 'quinzième', 'seizième', 'dix-septième', 'dix-huitième', 'dix-neuvième', 'vingtième', 'vingt et unième'];
    function romain(r) { var v = { I: 1, V: 5, X: 10 }, n = 0; for (var i = 0; i < r.length; i++) { var a = v[r[i]], b = v[r[i + 1]] || 0; n += a < b ? -a : a; } return n; }
    function pourLaVoix(x) {
      return String(x).replace(/[✓✗✔✘]/g, ' ').replace(/[→←]/g, ', ').replace(/_{2,}/g, ' blanc ')
        .replace(/\b([IVX]+)(?:e|er)\s+s\./g, function (m, r) { return (ORD[romain(r)] || r) + ' siècle'; })
        .replace(/\b([IVX]+)(?:e|er)\b/g, function (m, r) { return ORD[romain(r)] || m; })
        .replace(/av\. J\.-C\./g, 'avant Jésus-Christ').replace(/J\.-C\./g, 'Jésus-Christ')
        .replace(/(\d)\s*[–\-]\s*(\d)/g, '$1 à $2').replace(/km²/g, 'kilomètres carrés').replace(/([.!?…:])(\s*\.)+/g, '$1').replace(/\s+/g, ' ').trim();
    }
    function phrases(tx) {
      var out = [], cur = '';
      tx.split(/(?<=[.!?…])\s+/).forEach(function (ph) { if (cur && (cur + ' ' + ph).length > 240) { out.push(cur); cur = ph; } else cur = cur ? cur + ' ' + ph : ph; });
      if (cur) out.push(cur); return out;
    }
    var courant = null;
    function charger(ok, ko) {
      if (window.AudioDE) return ok();
      var m = document.querySelector('meta[name="audio"]'), base = new URL(m && m.content ? m.content : 'PartageLectureAudio/', location.href).href;
      function s(url, suite) { var x = document.createElement('script'); x.src = url; x.onload = ok; x.onerror = suite; document.body.appendChild(x); }
      var r = window.RACINE || window.RACINE_EXERCICE;
      if (r) s(r + '.Audio.js', function () { s(base + 'Partage.Audio.js', ko); }); else s(base + 'Partage.Audio.js', ko);
    }
    function arreter() {
      try { if (window.AudioDE && window.AudioDE.arreter) window.AudioDE.arreter(); } catch (e) { /* ignoré */ }
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignoré */ }
      if (courant) { courant.classList.remove('lit'); courant.setAttribute('aria-pressed', 'false'); courant = null; }
    }
    function lire(texte, btn) {
      if (courant === btn) { arreter(); return; }
      arreter();
      var tx = pourLaVoix(texte); if (!tx) return;
      courant = btn; btn.classList.add('lit'); btn.setAttribute('aria-pressed', 'true');
      function fin() { if (courant === btn) arreter(); }
      charger(function () {
        var A = window.AudioDE; A.definirLangue('fr'); var r = A.roles('fr');
        A.lireDialogue(phrases(tx).map(function (p) { return { role: r.narrateur, text: p }; }), function () {}, { debut: 0, onFin: fin });
      }, function () {
        if (!window.speechSynthesis) return fin();
        var u = new SpeechSynthesisUtterance(tx); u.lang = 'fr-FR'; u.onend = fin; u.onerror = fin; window.speechSynthesis.speak(u);
      });
    }
    function bouton(texteFn, libelle) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-audio'; b.textContent = '🔊';
      b.title = libelle || 'Écouter'; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function (ev) { ev.preventDefault(); lire(texteFn(), b); });
      return b;
    }
    /* texte d'un bloc sans ses boutons (ni ceux de lecture, ni « suivant ») */
    function texteSans(noeud, retirer) {
      var c = noeud.cloneNode(true);
      Array.prototype.forEach.call(c.querySelectorAll('p, div, li, strong, h1, h2, h3, td, th'), function (x) { x.appendChild(document.createTextNode('. ')); });
      Array.prototype.forEach.call(c.querySelectorAll(retirer || 'button, .pied'), function (x) { x.remove(); });
      Array.prototype.forEach.call(c.querySelectorAll('input.mot'), function (x) { x.replaceWith(document.createTextNode(' blanc ')); });
      return c.textContent;
    }
    window.addEventListener('pagehide', arreter);
    return { bouton: bouton, arreter: arreter, texteSans: texteSans };
  })();
  /* texte à lire pour les propositions d'une question : boutons de choix, cartes, listes déroulantes, phrases à compléter */
  function textesZone(z) {
    var t = [];
    Array.prototype.forEach.call(z.querySelectorAll('.choix-btn, .asso label span, .phrase, .carte, .zone-tete, .cases label, label'), function (n) {
      if (n.closest('.phrase') && n !== n.closest('.phrase')) return;
      t.push(n.classList.contains('phrase') ? AUDIO.texteSans(n, 'button') : n.textContent.trim());
    });
    var s = z.querySelector('select');
    if (s) t.push('Propositions : ' + Array.prototype.map.call(s.options, function (o) { return o.value ? o.textContent : ''; }).filter(Boolean).join(', '));
    return t.filter(Boolean).join('. ');
  }

  /* ---- composition : tirage de n questions (une par id) ---- */
  function composer(d, opts) {
    opts = opts || {};
    var alea = opts.alea || Math.random;
    var pool = d.questions.filter(function (q) { return !opts.groupes || !opts.groupes.length || opts.groupes.indexOf(q.groupe) >= 0; });
    if (opts.ids) pool = d.questions.filter(function (q) { return opts.ids.indexOf(q.id) >= 0; });
    /* questions ratées à la série précédente : jusqu'à 5, mélangées aux nouvelles */
    var prio = opts.ids ? [] : (opts.prioritaires || []);
    var pri = melanger(d.questions.filter(function (q) { return prio.indexOf(q.id) >= 0; }), alea).slice(0, 5); /* au plus 5 questions reprises, les autres attendront la série suivante */
    var reste = pool.filter(function (q) { return pri.indexOf(q) < 0; });
    var n = Math.min(opts.nombre || (pool.length + pri.length), pool.length + pri.length);
    /* reprises et nouvelles questions sont mélangées : l'élève ne sait pas lesquelles reviennent */
    return melanger(pri.concat(melanger(reste, alea).slice(0, Math.max(0, n - pri.length))), alea);
  }

  /* ---- saisie : tolérance sur les accents, articles, pluriels, une faute de frappe ---- */
  function normMot(x) {
    return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, '')
      .replace(/^(le|la|les|l|un|une|des|du|de|d)\s+/, '').replace(/\s+/g, '').replace(/(s|x)$/, '');
  }
  function distance(a, b) {
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) m[i] = [i];
    for (j = 0; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  function jugerMot(saisi, q) {
    var s = normMot(saisi); if (!s) return 'vide';
    var bons = [q.reponse].concat(q.formes || []).map(normMot);
    if (bons.indexOf(s) >= 0) return 'juste';
    for (var i = 0; i < bons.length; i++) if (bons[i].length >= 5 && distance(s, bons[i]) <= 1) return 'presque';
    return 'faux';
  }
  function figureImage(im) {
    var F = ['png', 'jpg', 'jpeg', 'webp', 'svg'], k = 0, fg = el('figure', { classe: 'schema' });
    var img = el('img', { classe: 'schema-img', alt: im.legende || '' });
    img.onerror = function () { k++; if (k < 2 * F.length) img.src = (k < F.length ? 'ressources/' : '') + window.RACINE + '.' + im.n + '.' + F[k % F.length]; else fg.remove(); };
    img.src = 'ressources/' + window.RACINE + '.' + im.n + '.' + F[0];
    fg.appendChild(img);
    if (im.legende) fg.appendChild(el('figcaption', { classe: 'legende', texte: im.legende }));
    return fg;
  }

  /* ---- correction d'une réponse ---- */
  function corriger(q, rep) {
    if (q.type === 'qcm') return rep === q.bonne;
    if (q.type === 'vf') return rep === q.vrai;
    if (q.type === 'periode' || q.type === 'portee' || q.type === 'nature') return rep === q.bonne;
    if (q.type === 'asso') return q.paires.every(function (p, i) { return rep && rep[i] === p[1]; });
    if (q.type === 'saisie') return jugerMot(rep, q) !== 'faux' && jugerMot(rep, q) !== 'vide';
    return false;
  }

  /* ---- mémoire des essais (anti-recommencement) ---- */
  function parametres(d) {
    var e = ((d.reglages || {}).essais) || {};
    return { actif: e.actif !== false, coef: typeof e.coefficient === 'number' ? e.coefficient : 0.5, delai: e.delai_jours || 0, reinitFin: e.reinit_fin !== false, message: e.message || "Réponse juste mais déjà vue dans ce quiz." };
  }
  function memoire(racine, stockage, maintenant) {
    var cle = 'eval:' + racine, st = stockage;
    function lire() { try { return JSON.parse(st.getItem(cle)) || {}; } catch (e) { return {}; } }
    function ecrire(o) { try { st.setItem(cle, JSON.stringify(o)); } catch (e) { /* stockage indisponible */ } }
    return {
      deja: function (id, delai) {
        var r = lire()[id]; if (!r) return 0;
        if (delai && maintenant() - r.t > delai * 86400000) return 0;
        return r.n;
      },
      noter: function (id) { var o = lire(), r = o[id] || { n: 0 }; o[id] = { n: r.n + 1, t: maintenant() }; ecrire(o); },
      reinit: function () { try { st.removeItem(cle); } catch (e) { /* rien */ } },
      /* questions ratées, gardées d'une séance à l'autre (reposées en premier à la séance suivante) */
      lireRatees: function () { try { var l = JSON.parse(st.getItem('ratees:' + racine)); return Array.isArray(l) ? l : []; } catch (e) { return []; } },
      ecrireRatees: function (l) { try { st.setItem('ratees:' + racine, JSON.stringify(l)); } catch (e) { /* stockage indisponible */ } }
    };
  }
  /* points = 1 au premier passage, coef si déjà répondu avant, 0 si faux */
  function points(juste, dejaVu, par) { return !juste ? 0 : (par.actif && dejaVu > 0 ? par.coef : 1); }

  /* ---- interface ---- */
  var D = null, MEM = null, PAR = null, app = null;
  var serie = [], pos = 0, total = 0, rates = [], retries = 0, reprise = {};

  function accueil() {
    app.textContent = '';
    app.appendChild(el('h1', { texte: D.titre }));
    app.appendChild(el('p', { classe: 'consigne', texte: D.consigne }));
    var fs = el('fieldset', {}, [el('legend', { texte: 'Parties à réviser' })]);
    var cases = [];
    D.groupes.forEach(function (g) {
      var c = el('input', { type: 'checkbox', checked: 'checked' }); c.value = g.id; cases.push(c);
      fs.appendChild(el('label', { classe: 'case' }, [c, ' ' + g.titre]));
    });
    app.appendChild(fs);
    var PRI = ((D.reglages || {}).reprise || {}).actif === false ? [] : MEM.lireRatees().filter(function (id) { return D.questions.some(function (q) { return q.id === id; }); });
    reprise = {}; PRI.forEach(function (id) { reprise[id] = true; });
    app.appendChild(el('button', { classe: 'primaire', type: 'button', texte: 'Commencer', onclick: function () {
      var g = cases.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      lancer(composer(D, { groupes: g, nombre: (D.reglages || {}).nombre || 12, prioritaires: PRI }));
    } }));
  }

  function lancer(qs) {
    if (!qs.length) { accueil(); return; }
    serie = qs; pos = 0; total = 0; rates = []; retries = 0; question();
  }

  function entete() {
    AUDIO.arreter();
    app.textContent = '';
    app.appendChild(el('div', { classe: 'progres' }, [
      'Question ' + (pos + 1) + ' sur ' + serie.length + ' — ' + (Math.round(total * 10) / 10) + ' point(s)',
      el('span', { classe: 'barre' }, [el('i', { style: 'width:' + Math.round(100 * pos / serie.length) + '%' })])]));
  }
  function periodeDe(id) { return D.periodes.filter(function (p) { return p.id === id; })[0]; }

  function question() {
    var q = serie[pos];
    entete();
    var dejaVu = MEM.deja(q.id, PAR.delai);
    app.appendChild(el('span', { classe: 'etiq', texte: (D.groupes.filter(function (g) { return g.id === q.groupe; })[0] || {}).titre || '' }));
    var hote = app;
    if (q.image) { var cg = el('div', { classe: 'qimg' }), cote = el('div', { classe: 'qcote' }); cg.appendChild(figureImage(q.image)); cg.appendChild(cote); app.appendChild(cg); hote = cote; }
    var zone = el('div'), retour = el('div');
    hote.appendChild(el('div', { classe: 'enonce-ligne' }, [el('p', { classe: 'enonce', texte: q.enonce }), AUDIO.bouton(function () { return q.enonce + '. ' + textesZone(zone); }, 'Écouter la question')]));
    hote.appendChild(zone); hote.appendChild(retour);

    function repondre(rep, juste) {
      var dv = reprise[q.id] ? 0 : MEM.deja(q.id, PAR.delai); /* question reposée d'une séance précédente : tous les points */
      MEM.noter(q.id);
      var lr = MEM.lireRatees().filter(function (x) { return x !== q.id; }); if (!juste) lr.push(q.id); MEM.ecrireRatees(lr); /* enregistré tout de suite : recharger la page ne permet pas de recommencer */
      var pts = points(juste, dv, PAR);
      total += pts; if (dv > 0) retries++;
      if (!juste) rates.push(q.id);
      var msg = [el('strong', { texte: juste ? (pts < 1 ? 'Juste, mais demi-point.' : 'Juste.') : 'Pas tout à fait.' })];
      retour.className = 'retour ' + (juste ? (pts < 1 ? 'moyen' : 'ok') : 'ko');
      retour.textContent = '';
      retour.appendChild(AUDIO.bouton(function () { return AUDIO.texteSans(retour); }, 'Écouter le commentaire'));
      msg.forEach(function (m) { retour.appendChild(m); });
      if (juste && pts < 1) retour.appendChild(el('p', { classe: 'essai', texte: PAR.message }));
      if (!juste && q.type === 'qcm') retour.appendChild(el('p', { texte: 'Bonne réponse : ' + q.options[q.bonne] }));
      if (!juste && q.type === 'periode') retour.appendChild(el('p', { texte: 'Bonne réponse : ' + periodeDe(q.bonne).titre }));
      if (!juste && q.type === 'portee') retour.appendChild(el('p', { texte: 'Bonne réponse : ' + (q.bonne === 'une' ? 'une seule période' : 'plusieurs périodes') }));
      if (!juste && q.type === 'nature') retour.appendChild(el('p', { texte: 'Bonne réponse : ' + (q.bonne === 'evenement' ? 'un événement' : 'un pilier de la culture grecque') }));
      if (q.type === 'saisie') { var jm = jugerMot(rep, q); if (jm === 'presque') retour.appendChild(el('p', { texte: 'Attention à l\'orthographe : écris « ' + q.reponse + ' ».' })); else if (!juste) retour.appendChild(el('p', { texte: 'Le mot attendu est « ' + q.reponse + ' ».' })); }
      if (!juste && q.type === 'vf') retour.appendChild(el('p', { texte: 'Bonne réponse : ' + (q.vrai ? 'vrai' : 'faux') }));
      retour.appendChild(el('p', { texte: q.explication }));
      retour.appendChild(el('button', { classe: 'primaire', type: 'button', texte: pos + 1 < serie.length ? 'Question suivante' : 'Voir mon bilan', onclick: function () { pos++; if (pos < serie.length) question(); else bilan(); } }));
      Array.prototype.forEach.call(zone.querySelectorAll('button,select'), function (b) { b.disabled = true; });
    }
    function boutons(libelles, bon, classeGrille) {
      var g = el('div', { classe: 'choix ' + (classeGrille || '') });
      libelles.forEach(function (l, i) {
        var b = el('button', { classe: 'choix-btn', type: 'button', texte: l[1], 'data-v': String(l[0]) });
        b.addEventListener('click', function () {
          var juste = l[0] === bon;
          b.classList.add(juste ? 'juste' : 'faux');
          if (!juste) Array.prototype.forEach.call(g.children, function (x, k) { if (libelles[k][0] === bon) x.classList.add('juste'); });
          repondre(l[0], juste);
        });
        g.appendChild(b);
      });
      zone.appendChild(g);
    }
    if (q.type === 'qcm') {
      var ordre = melanger(q.options.map(function (o, i) { return [i, o]; }));
      boutons(ordre, q.bonne);
    } else if (q.type === 'vf') boutons([[true, 'Vrai'], [false, 'Faux']], q.vrai, 'deux');
    else if (q.type === 'periode') boutons(D.periodes.map(function (p) { return [p.id, p.titre + ' (' + p.dates + ')']; }), q.bonne);
    else if (q.type === 'portee') boutons([['une', 'Une seule période'], ['plusieurs', 'Plusieurs périodes']], q.bonne, 'deux');
    else if (q.type === 'nature') boutons([['evenement', 'Un événement historique'], ['pilier', 'Un pilier de la culture grecque']], q.bonne, 'deux');
    else if (q.type === 'asso') {
      var droites = melanger(q.paires.map(function (p) { return p[1]; }).filter(function (x, i, t) { return t.indexOf(x) === i; })), sels = [], box = el('div', { classe: 'asso' });
      q.paires.forEach(function (p) {
        var s = el('select'); s.appendChild(el('option', { value: '', texte: '— choisir —' }));
        droites.forEach(function (x) { s.appendChild(el('option', { value: x, texte: x })); });
        sels.push(s); box.appendChild(el('label', {}, [el('span', { texte: p[0] }), s]));
      });
      zone.appendChild(box);
      zone.appendChild(el('button', { classe: 'primaire', type: 'button', texte: 'Valider', onclick: function () {
        var rep = sels.map(function (s) { return s.value; });
        if (rep.some(function (r) { return !r; })) return;
        sels.forEach(function (s, i) { s.classList.add(s.value === q.paires[i][1] ? 'juste' : 'faux'); });
        repondre(rep, corriger(q, rep));
      } }));
    }
    else if (q.type === 'saisie') {
      var parts = q.phrase.split('___'), champ = el('input', { type: 'text', classe: 'mot', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'mot à écrire' });
      zone.appendChild(el('div', { classe: 'phrase' }, [parts[0], champ, parts.slice(1).join('___')]));
      var okb = el('button', { classe: 'primaire', type: 'button', texte: 'Valider', disabled: 'disabled' });
      champ.addEventListener('input', function () { if (champ.value.trim()) okb.removeAttribute('disabled'); else okb.setAttribute('disabled', 'disabled'); });
      champ.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && champ.value.trim() && !okb.disabled) okb.click(); });
      okb.onclick = function () { var r = jugerMot(champ.value, q); champ.disabled = true; champ.classList.add(r === 'faux' ? 'faux' : 'juste'); repondre(champ.value, r === 'juste' || r === 'presque'); };
      zone.appendChild(okb);
    }
  }

  /* ---- évaluation papier : PDF élève, téléchargeable en permanence et mis en avant au bilan ---- */
  var PAPIER = null; /* null = pas encore vérifié ; '' = introuvable ; sinon adresse du PDF */
  function reglagePapier() {
    var p = (D && D.reglages && D.reglages.papier) || {};
    return { actif: p.actif !== false, libelle: p.libelle || '📄 Télécharger l\'évaluation papier (PDF)',
      titreFin: p.titre_fin || 'Et maintenant, à toi d\'écrire !',
      texteFin: p.texte_fin || 'Ce quiz vérifie ce que tu sais. L\'évaluation papier te demande d\'écrire un raisonnement avec tes mots. Télécharge-la, imprime-la (ou recopie les questions sur une feuille) et essaie-toi.' };
  }
  function adressesPapier() {
    var f = String(window.RACINE || '').split('.')[0] + '.evalPapier.eleve.pdf';
    return ['ressources/' + f, f];
  }
  function verifierPapier(fin) {
    var a = adressesPapier();
    if (PAPIER !== null) return fin(PAPIER);
    if (typeof location === 'undefined' || location.protocol === 'file:' || typeof fetch !== 'function') { PAPIER = a[0]; return fin(PAPIER); }
    fetch(a[0], { method: 'HEAD' }).then(function (r) { if (!r.ok) throw 0; PAPIER = a[0]; fin(PAPIER); })
      .catch(function () { fetch(a[1], { method: 'HEAD' }).then(function (r) { if (!r.ok) throw 0; PAPIER = a[1]; fin(PAPIER); }).catch(function () { PAPIER = ''; fin(''); }); });
  }
  function lienPapier(classe, libelle) {
    var l = el('a', { classe: classe, href: adressesPapier()[0], download: '', target: '_blank', rel: 'noopener', texte: libelle });
    verifierPapier(function (url) { if (url) l.href = url; else l.hidden = true; });
    return l;
  }
  function installerPapier() {
    var r = reglagePapier(); if (!r.actif || document.getElementById('papier-fixe')) return;
    var b = el('div', { id: 'papier-fixe', classe: 'papier-bandeau' }, [lienPapier('papier-lien', r.libelle)]);
    app.parentNode.insertBefore(b, app);
    verifierPapier(function (url) { if (!url) b.hidden = true; });
  }
  function blocPapier() {
    var r = reglagePapier(); if (!r.actif) return document.createTextNode('');
    var c = el('section', { classe: 'papier-fin' }, [el('h2', { texte: r.titreFin }), el('p', { texte: r.texteFin }), lienPapier('papier-gros', r.libelle)]);
    verifierPapier(function (url) { if (!url) c.hidden = true; });
    return c;
  }

  function bilan() {
    AUDIO.arreter();
    /* essai terminé : la mémoire des essais est remise à zéro (seules les séries interrompues pénalisent) */
    if (PAR.reinitFin) MEM.reinit();
    app.textContent = '';
    var n = serie.length, t = Math.round(total * 10) / 10;
    app.appendChild(el('h1', { texte: 'Ton bilan' }));
    app.appendChild(el('div', { classe: 'score', texte: t + ' / ' + n }));
    app.appendChild(blocPapier());
    if (retries) app.appendChild(el('p', { classe: 'essai', texte: retries + ' question(s) avaient déjà été traitées avant que tu quittes l\'exercice : leurs bonnes réponses ne comptent que pour moitié.' }));
    if (rates.length) {
      app.appendChild(el('h2', { texte: 'À revoir' }));
      app.appendChild(el('p', { classe: 'essai', texte: 'Quelques-unes reviendront la prochaine fois : tu pourras les réussir.' }));
      var ul = el('ul', { classe: 'liste' });
      rates.forEach(function (id) {
        var q = D.questions.filter(function (x) { return x.id === id; })[0];
        ul.appendChild(el('li', {}, [q.enonce, el('br'), el('em', { texte: q.explication })]));
      });
      app.appendChild(ul);
      app.appendChild(el('button', { type: 'button', texte: 'Refaire les questions ratées', onclick: function () { lancer(composer(D, { ids: rates.slice() })); } }));
      app.appendChild(document.createTextNode(' '));
    } else app.appendChild(el('p', { texte: 'Aucune erreur : bravo !' }));
    app.appendChild(el('button', { classe: 'primaire', type: 'button', texte: 'Recommencer avec de nouvelles questions', onclick: accueil }));
  }

  /* ---- démarrage ---- */
  function demarrerAvec(obj) {
    var pb = valider(obj);
    if (pb.length) { app.textContent = ''; app.appendChild(el('p', { texte: 'Le fichier de données contient des erreurs :' })); app.appendChild(el('ul', {}, pb.map(function (x) { return el('li', { texte: x }); }))); return; }
    memoriser(obj);
    D = obj; PAR = parametres(D);
    installerPapier();
    var st; try { st = window.localStorage; st.getItem('x'); } catch (e) { st = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} }; }
    MEM = memoire(window.RACINE, st, Date.now);
    if (/[?&]reinit\b/.test(location.search)) MEM.reinit();
    $m().hidden = !LOCAL; accueil();
  }
  function $m() { return document.getElementById('manuel'); }
  function afficherManuel(raison) {
    if(!LOCAL){ var erreur=document.createElement('p'); erreur.textContent='Erreur : données non chargées. '+(raison||''); document.body.appendChild(erreur); return; }
    $m().hidden = false;
    document.getElementById('manuel-nom').textContent = window.RACINE + '.json';
    document.getElementById('manuel-raison').textContent = raison || '';
    document.getElementById('manuel-fichier').onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0]; if (!f) return;
      var l = new FileReader();
      l.onload = function () { try { demarrerAvec(JSON.parse(l.result)); } catch (e) { document.getElementById('manuel-raison').textContent = 'Fichier illisible : ' + e.message; } };
      l.readAsText(f);
    };
  }
  function demarrer() {
    app = document.getElementById('app');
    app.textContent = 'Chargement…'; if(LOCAL) afficherManuel('');
    lireDonnees(window.RACINE + '.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(demarrerAvec)
      .catch(function (e) { app.textContent = 'Données non chargées.'; afficherManuel('Raison : ' + e.message); });
  }

  var api = { valider: valider, composer: composer, corriger: corriger, points: points, parametres: parametres, memoire: memoire };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  }
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
})(false);
