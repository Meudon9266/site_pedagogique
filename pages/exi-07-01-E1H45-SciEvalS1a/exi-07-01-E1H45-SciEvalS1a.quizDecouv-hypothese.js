/* Moteur « Découverte » de la frise historique : événements propres à une période (frise)
   et phénomènes qui traversent les périodes (fils). Données : racine.json (racine = nom de la page). */
(function () {
  'use strict';

  var racine = (typeof window !== 'undefined' && window.RACINE) || '';
  var data = null, periodes = {}, idx = 0, app = null;
  var TYPES = ['intro', 'placer', 'multiple', 'choix', 'synthese'];
  var PRESENTATIONS = ['frise', 'fil', 'tri'];

  /* ---------- utilitaires ---------- */
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
  function melanger(a) {
    var c = a.slice();
    for (var i = c.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = c[i]; c[i] = c[j]; c[j] = t; }
    return c;
  }
  function indexerPeriodes(d) { var m = {}; (d.periodes || []).forEach(function (p) { m[p.id] = p; }); return m; }
  function teinte(z) { return (z && typeof z.teinte === 'number') ? z.teinte : null; }

  /* Une zone peut être un id de période ou un objet {id, titre, sous, teinte}. */
  function zonesDe(e) {
    var vus = {};
    (e.cartes || []).forEach(function (c) { vus[c.zone] = true; });
    return (e.zones || []).map(function (z) {
      var o;
      if (typeof z === 'string') {
        var p = periodes[z] || { id: z, titre: z };
        o = { id: p.id, numero: p.id.replace(/\D/g, ''), titre: p.titre, sous: p.dates || '', teinte: p.teinte, periode: true };
      } else o = { id: z.id, titre: z.titre, sous: z.sous || '', teinte: z.teinte };
      o.inerte = !vus[o.id];
      return o;
    });
  }

  /* ---------- validation ---------- */
  function valider(d) {
    var pb = [], per = indexerPeriodes(d), ids = {};
    if (!d || !Array.isArray(d.ecrans) || !d.ecrans.length) return ['Aucun écran dans le fichier de données.'];
    (d.periodes || []).forEach(function (p) { if (!p.id || !p.titre) pb.push('Une période n\'a pas d\'id ou de titre.'); });
    d.ecrans.forEach(function (e, i) {
      var ou = 'Écran ' + (i + 1) + ' (« ' + (e.id || '?') + ' »)';
      if (!e.id) pb.push(ou + ' : identifiant manquant.');
      if (ids[e.id]) pb.push(ou + ' : identifiant en double.'); ids[e.id] = true;
      if (TYPES.indexOf(e.type) < 0) { pb.push(ou + ' : type inconnu « ' + e.type + ' ».'); return; }
      if (e.type === 'placer') {
        if (PRESENTATIONS.indexOf(e.presentation) < 0) pb.push(ou + ' : présentation inconnue « ' + e.presentation + ' ».');
        var zs = {};
        (e.zones || []).forEach(function (z) {
          var id = typeof z === 'string' ? z : z.id;
          if (typeof z === 'string' && !per[z]) pb.push(ou + ' : période inconnue « ' + z + ' ».');
          zs[id] = true;
        });
        if (!(e.zones || []).length) pb.push(ou + ' : aucune zone.');
        if (!(e.cartes || []).length) pb.push(ou + ' : aucune carte.');
        (e.cartes || []).forEach(function (c) { if (!zs[c.zone]) pb.push(ou + ' : la carte « ' + (c.id || c.texte) + ' » pointe vers une zone absente.'); });
      } else if (e.type === 'choix') {
        if (!(e.options || []).some(function (o) { return o.id === e.bonne; })) pb.push(ou + ' : la bonne réponse ne correspond à aucune option.');
      } else if (e.type === 'multiple') {
        if (!(e.options || []).some(function (o) { return o.juste; })) pb.push(ou + ' : aucune option juste.');
      }
    });
    return pb;
  }

  /* ---------- réponse (mini-cours) ---------- */
  function carteReponse(r) {
    if (!r) return null;
    var c = el('div', { classe: 'reponse' });
    if (r.titre) c.appendChild(el('h2', { texte: r.titre }));
    (r.paragraphes || []).forEach(function (p) { c.appendChild(el('p', { texte: p })); });
    if (r.image) {
      var img = el('img', { classe: 'illus', alt: r.image.legende || '' });
      var essais = ['ressources/' + racine + '.' + r.image.n + '.png', racine + '.' + r.image.n + '.png'], k = 0;
      img.onerror = function () { k++; if (k < essais.length) img.src = essais[k]; else img.remove(); };
      img.src = essais[0];
      c.appendChild(img);
    }
    if (r.a_retenir) c.appendChild(el('div', { classe: 'retenir', texte: 'À retenir : ' + r.a_retenir }));
    return c;
  }
  function reveler(e, retour, verdict, details) {
    if (verdict) noterEcran(e, verdict.cls === 'ok');
    retour.textContent = '';
    if (verdict) retour.appendChild(el('div', { classe: 'verdict ' + verdict.cls, texte: verdict.texte }));
    (details || []).forEach(function (d) { retour.appendChild(d); });
    var c = carteReponse(e.reponse); if (c) retour.appendChild(c);
    var dernier = idx >= data.ecrans.length - 1;
    var suite = el('button', { type: 'button', classe: 'primaire', texte: dernier ? 'Voir ce que tu as découvert' : 'Écran suivant →' });
    suite.onclick = function () { suivant(); render(); window.scrollTo(0, 0); };
    retour.insertBefore(AUDIO.bouton(function () { return AUDIO.texteSans(retour, '.pied, .btn-audio'); }, 'Écouter le commentaire'), retour.firstChild);
    retour.appendChild(el('div', { classe: 'pied' }, [suite]));
    retour.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- frise d'ensemble (écran d'introduction) ---------- */
  function bandeauPeriodes(compact) {
    var b = el('div', { classe: 'periodes' + (compact ? ' compact' : '') });
    (data.periodes || []).forEach(function (p, i) {
      var c = el('div', { classe: 'periode' }, [
        el('div', { classe: 'periode-tete' }, [el('span', { classe: 'num', texte: 'Période ' + (i + 1) }), el('strong', { texte: p.titre }), el('span', { classe: 'dates', texte: p.dates || '' })]),
        compact ? null : el('p', { classe: 'periode-resume', texte: p.resume || '' })
      ]);
      c.style.setProperty('--h', teinte(p) == null ? 0 : p.teinte);
      b.appendChild(c);
    });
    return b;
  }

  /* ---------- placer : glisser des cartes dans des zones ---------- */
  function ecranPlacer(e, zone, retour) {
    var zs = zonesDe(e);
    var cartes = e.cartes.map(function (c, i) { return { d: c, id: c.id || ('c' + i), ou: null, dom: null }; });
    var choisie = null, fini = false;

    var wrap = el('div', { classe: 'placer ' + e.presentation });
    if (e.presentation === 'fil') {
      var rub = el('div', { classe: 'ruban' }, [el('span', { texte: 'Fil rouge : ' + (e.titre || '') })]);
      var tint = zs.filter(function (z) { return teinte(z) != null; }).map(function (z, i, a) { return 'hsl(' + z.teinte + ' 55% 55%) ' + Math.round(i / Math.max(1, a.length - 1) * 100) + '%'; });
      if (tint.length > 1) rub.style.background = 'linear-gradient(90deg,' + tint.join(',') + ')';
      wrap.appendChild(rub);
    } else if (e.presentation === 'frise' && zs.every(function (z) { return z.periode; })) {
      wrap.appendChild(el('div', { classe: 'axe', texte: 'Le temps passe →' }));
    }
    var grille = el('div', { classe: 'zones' }); wrap.appendChild(grille);

    var corps = {};
    zs.forEach(function (z) {
      var tete = el('div', { classe: 'zone-tete' }, [
        z.numero ? el('span', { classe: 'num', texte: 'Période ' + z.numero }) : null,
        el('strong', { texte: z.titre }),
        z.sous ? el('span', { classe: 'dates', texte: z.sous }) : null
      ]);
      var c = el('div', { classe: 'zone-corps', 'data-zone': z.id });
      if (z.inerte) c.appendChild(el('span', { classe: 'vide', texte: 'Rien dans le cours à cette période' }));
      var d = el('div', { classe: 'zone' + (z.inerte ? ' inerte' : ''), 'data-zone': z.id, tabindex: z.inerte ? '-1' : '0', role: 'group', 'aria-label': z.titre }, [tete, c]);
      if (teinte(z) != null) d.style.setProperty('--h', z.teinte);
      corps[z.id] = c;
      if (!z.inerte) {
        d.addEventListener('click', function (ev) { if (!ev.target.closest('.carte')) deposer(z.id); });
        d.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && !ev.target.closest('.carte')) { ev.preventDefault(); deposer(z.id); } });
      }
      grille.appendChild(d);
    });

    var pool = el('div', { classe: 'pool', 'data-zone': 'pool' });
    var okBtn = el('button', { type: 'button', classe: 'primaire', texte: 'Valider', disabled: 'disabled' });
    zone.appendChild(el('p', { classe: 'legende', texte: 'Glisse chaque carte dans une zone (ou touche une carte, puis la zone). Tu peux changer d\'avis avant de valider.' }));
    zone.appendChild(pool);
    zone.appendChild(wrap);
    zone.appendChild(el('div', { classe: 'pied' }, [okBtn]));

    function rafraichir() {
      cartes.forEach(function (c) {
        var cible = c.ou ? corps[c.ou] : pool;
        if (c.dom.parentNode !== cible) cible.appendChild(c.dom);
        c.dom.classList.toggle('choisie', c === choisie);
      });
      var vide = cartes.every(function (c) { return c.ou; });
      if (vide && !fini) okBtn.removeAttribute('disabled'); else okBtn.setAttribute('disabled', 'disabled');
      pool.classList.toggle('vide', cartes.every(function (c) { return c.ou; }));
      var vues = pool.querySelector('.carte'); pool.style.display = vues || !fini ? '' : 'none';
    }
    function placer(c, zoneId) {
      if (fini) return;
      if (zoneId !== 'pool' && corps[zoneId] === undefined) return;
      c.ou = zoneId === 'pool' ? null : zoneId; choisie = null; rafraichir();
    }
    function deposer(zoneId) { if (choisie) placer(choisie, zoneId); }

    melanger(cartes).forEach(function (c) {
      var d = el('div', { classe: 'carte', tabindex: '0', role: 'button', 'aria-label': c.d.texte }, [c.d.texte]);
      c.dom = d; pool.appendChild(d);
      d.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choisie = choisie === c ? null : c; rafraichir(); } });
      d.addEventListener('pointerdown', function (ev) {
        if (fini) return;
        var x0 = ev.clientX, y0 = ev.clientY, glisse = false, ghost = null, survol = null;
        try { d.setPointerCapture(ev.pointerId); } catch (x) { /* ignoré */ }
        function cibleSous(m) {
          if (ghost) ghost.style.display = 'none';
          var sous = document.elementFromPoint(m.clientX, m.clientY);
          if (ghost) ghost.style.display = '';
          if (!sous) return null;
          var z = sous.closest && sous.closest('.zone:not(.inerte)');
          if (z) return z.getAttribute('data-zone');
          if (sous.closest && sous.closest('.pool')) return 'pool';
          return null;
        }
        function bouger(m) {
          if (!glisse && Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) > 6) {
            glisse = true;
            ghost = d.cloneNode(true); ghost.classList.add('fantome'); ghost.style.width = d.offsetWidth + 'px';
            document.body.appendChild(ghost); d.classList.add('leve');
          }
          if (glisse) {
            ghost.style.left = (m.clientX - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (m.clientY - 20) + 'px';
            var s = cibleSous(m);
            if (s !== survol) {
              Array.prototype.forEach.call(document.querySelectorAll('.survol'), function (n) { n.classList.remove('survol'); });
              survol = s;
              if (s && s !== 'pool') { var zn = wrap.querySelector('.zone[data-zone="' + s.replace(/"/g, '') + '"]'); if (zn) zn.classList.add('survol'); }
            }
          }
        }
        function lacher(m) {
          d.removeEventListener('pointermove', bouger); d.removeEventListener('pointerup', lacher); d.removeEventListener('pointercancel', annuler);
          Array.prototype.forEach.call(document.querySelectorAll('.survol'), function (n) { n.classList.remove('survol'); });
          d.classList.remove('leve');
          if (glisse) {
            var s = cibleSous(m); if (ghost) ghost.remove();
            if (s) placer(c, s);
          } else { choisie = choisie === c ? null : c; rafraichir(); }
        }
        function annuler() { d.classList.remove('leve'); if (ghost) ghost.remove(); }
        d.addEventListener('pointermove', bouger); d.addEventListener('pointerup', lacher); d.addEventListener('pointercancel', annuler);
      });
    });
    rafraichir();

    okBtn.onclick = function () {
      fini = true; okBtn.setAttribute('disabled', 'disabled'); choisie = null; rafraichir();
      var titres = {}; zs.forEach(function (z) { titres[z.id] = (z.numero ? 'Période ' + z.numero + ' — ' : '') + z.titre; });
      var bons = 0, lignes = [];
      cartes.forEach(function (c) {
        var ok = c.ou === c.d.zone; if (ok) bons++;
        c.dom.classList.remove('choisie'); c.dom.classList.add(ok ? 'juste' : 'faux');
        lignes.push(el('li', { classe: ok ? 'juste' : 'faux' }, [
          el('strong', { texte: (ok ? '✓ ' : '✗ ') + c.d.texte }),
          ok ? null : el('span', { classe: 'corr', texte: ' → À placer : ' + titres[c.d.zone] }),
          el('span', { classe: 'expl', texte: c.d.explication || '' })
        ]));
      });
      var n = cartes.length;
      var v = bons === n ? { cls: 'ok', texte: 'Tout est à la bonne place !' } : { cls: bons * 2 >= n ? 'moyen' : 'ko', texte: bons + ' carte(s) sur ' + n + ' à la bonne place : lis les explications.' };
      var det = [el('h2', { texte: 'Correction, carte par carte' }), el('ul', { classe: 'correction' }, lignes)];
      reveler(e, retour, v, det);
    };
  }

  /* ---------- choix / multiple ---------- */
  function ecranChoix(e, zone, retour) {
    var box = el('div', { classe: 'choix' }); zone.appendChild(box);
    e.options.forEach(function (o) {
      var b = el('button', { type: 'button', texte: o.texte });
      b.onclick = function () {
        Array.prototype.forEach.call(box.children, function (x) { x.disabled = true; });
        var bon = o.id === e.bonne;
        b.classList.add('choisi'); b.classList.add(bon ? 'juste' : 'faux');
        if (!bon) e.options.forEach(function (x, i) { if (x.id === e.bonne) box.children[i].classList.add('juste'); });
        reveler(e, retour, bon ? { cls: 'ok', texte: 'Bien vu !' } : { cls: 'ko', texte: 'Pas tout à fait : la bonne réponse est surlignée en vert.' }, []);
      };
      box.appendChild(b);
    });
  }
  function ecranMultiple(e, zone, retour) {
    var box = el('div', { classe: 'choix' }); zone.appendChild(box);
    var opts = e.melanger === false ? e.options.slice() : melanger(e.options);
    var cases = opts.map(function (o) {
      var cb = el('input', { type: 'checkbox' });
      var etiq = el('span', {}, [o.texte]);
      var lab = el('label', { classe: 'opt' }, [cb, etiq]);
      box.appendChild(lab);
      return { o: o, cb: cb, lab: lab, etiq: etiq };
    });
    var ok = el('button', { type: 'button', classe: 'primaire', texte: 'Valider mes réponses' });
    zone.appendChild(ok);
    ok.onclick = function () {
      ok.disabled = true; var fautes = 0;
      cases.forEach(function (c) {
        c.cb.disabled = true; c.lab.classList.add('fige');
        var bien = c.cb.checked === !!c.o.juste; if (!bien) fautes++;
        c.lab.classList.add(bien ? 'juste' : 'faux');
        c.etiq.appendChild(el('span', { classe: 'note', texte: (c.o.juste ? 'Vrai' : 'Faux') + (c.o.note ? ' — ' + c.o.note : '') }));
      });
      reveler(e, retour, fautes === 0 ? { cls: 'ok', texte: 'Tout juste !' } : { cls: fautes <= 2 ? 'moyen' : 'ko', texte: fautes + ' réponse(s) à revoir : lis les explications sous chaque proposition.' }, []);
    };
  }

  /* ---------- synthèse : colonnes (périodes) et fils (lignes) ---------- */
  function synthese(e, zone) {
    var pers = data.periodes || [];
    function th(p, i) {
      var t = el('th', {}, [el('span', { classe: 'num', texte: 'Période ' + (i + 1) }), el('strong', { texte: p.titre }), el('span', { classe: 'dates', texte: p.dates || '' })]);
      t.style.setProperty('--h', p.teinte == null ? 0 : p.teinte); return t;
    }
    // 1. colonnes : ce qui est propre à une période
    var friseEcrans = data.ecrans.filter(function (x) { return x.type === 'placer' && x.presentation === 'frise'; });
    zone.appendChild(el('h2', { texte: 'En colonnes : ce qui appartient à une seule période' }));
    var t1 = el('table', { classe: 'synthese' });
    t1.appendChild(el('tr', {}, pers.map(th)));
    var ligne = el('tr');
    pers.forEach(function (p) {
      var td = el('td'), ul = el('ul');
      friseEcrans.forEach(function (x) { x.cartes.forEach(function (c) { if (c.zone === p.id) ul.appendChild(el('li', { texte: c.texte })); }); });
      if (!ul.children.length) td.appendChild(el('span', { classe: 'vide', texte: '—' })); else td.appendChild(ul);
      ligne.appendChild(td);
    });
    t1.appendChild(ligne);
    zone.appendChild(el('div', { classe: 'defile' }, [t1]));

    // 2. lignes : les fils qui traversent
    var fils = data.ecrans.filter(function (x) {
      return x.type === 'placer' && x.presentation === 'fil' && (x.zones || []).every(function (z) { return typeof z === 'string'; });
    });
    zone.appendChild(el('h2', { texte: 'En lignes : les fils qui traversent les périodes' }));
    var t2 = el('table', { classe: 'synthese' });
    var tete = el('tr', {}, [el('th', { classe: 'coin' })].concat(pers.map(th))); t2.appendChild(tete);
    fils.forEach(function (x) {
      var tr = el('tr', {}, [el('th', { classe: 'fil-nom', texte: x.titre })]);
      pers.forEach(function (p) {
        var cs = x.cartes.filter(function (c) { return c.zone === p.id; });
        var td = el('td');
        if (!cs.length) td.appendChild(el('span', { classe: 'vide', texte: '—' }));
        cs.forEach(function (c) { td.appendChild(el('p', { texte: c.texte })); });
        tr.appendChild(td);
      });
      t2.appendChild(tr);
    });
    zone.appendChild(el('div', { classe: 'defile' }, [t2]));
    zone.appendChild(el('p', { classe: 'legende', texte: 'Un « — » signifie que le cours n\'a rien à dire de ce fil à cette période : un fil peut s\'effacer, puis revenir.' }));
  }

  /* ---------- reprise : on retient l'écran atteint, dans le navigateur de l'élève ---------- */
  function cleSauvegarde() { return 'decouverte:' + racine; }
  function signature(d) { return (d.ecrans || []).map(function (e) { return e.id; }).join('|'); }
  function lireSauvegarde() {
    try {
      var o = JSON.parse(window.localStorage.getItem(cleSauvegarde()) || 'null');
      if (o && o.sig === signature(data) && o.idx > 0 && o.idx < data.ecrans.length) return o.idx;
    } catch (x) { /* stockage indisponible : on ignore */ }
    return 0;
  }
  function ecrireSauvegarde() {
    try {
      if (idx > 0 && idx < data.ecrans.length) window.localStorage.setItem(cleSauvegarde(), JSON.stringify({ sig: signature(data), idx: idx }));
      else window.localStorage.removeItem(cleSauvegarde());
    } catch (x) { /* stockage indisponible : le quiz marche comme avant */ }
  }

  /* ---------- écrans généraux ---------- */
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

  /* ---------- écrans à reprendre : les écrans où l'élève s'est trompé sont gardés d'une séance à l'autre ---------- */
  var aReprendre = [], modeReprise = false;
  function lireReprendre() { try { var l = JSON.parse(window.localStorage.getItem('reprendre:' + racine)); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function ecrireReprendre(l) { try { window.localStorage.setItem('reprendre:' + racine, JSON.stringify(l)); } catch (e) { /* stockage indisponible */ } }
  function noterEcran(e, juste) { var l = lireReprendre().filter(function (x) { return x !== e.id; }); if (!juste) l.push(e.id); ecrireReprendre(l); aReprendre = l; }
  function indicesReprendre() { var r = []; data.ecrans.forEach(function (e, k) { if (aReprendre.indexOf(e.id) >= 0) r.push(k); }); return r.slice(0, 5); }
  function suivant() {
    if (modeReprise) { var l = indicesReprendre().filter(function (k) { return k > idx; }); if (l.length) idx = l[0]; else { modeReprise = false; idx = data.ecrans.length; } }
    else idx++;
  }
  function boutonReprendre() {
    aReprendre = lireReprendre().filter(function (id) { return data.ecrans.some(function (e) { return e.id === id; }); });
    var ix = indicesReprendre(); if (!ix.length) return [];
    var b = el('button', { type: 'button', classe: 'primaire', texte: 'Revoir d\'abord ' + (ix.length > 1 ? ix.length + ' écrans' : 'un écran') + ' de la dernière fois' });
    b.onclick = function () { modeReprise = true; idx = ix[0]; render(); window.scrollTo(0, 0); };
    return [b];
  }
  function accueil() {
    app.textContent = '';
    app.appendChild(el('h1', { texte: data.titre || 'Découverte' }));
    if (data.consigne) app.appendChild(el('p', { classe: 'consigne', texte: data.consigne }));
    app.appendChild(bandeauPeriodes(true));
    var reprise = lireSauvegarde();
    if (reprise) {
      var r = el('button', { type: 'button', classe: 'primaire', texte: 'Reprendre à l\'écran ' + (reprise + 1) + ' sur ' + data.ecrans.length });
      r.onclick = function () { idx = reprise; render(); window.scrollTo(0, 0); };
      var r0 = el('button', { type: 'button', texte: 'Recommencer depuis le début' });
      r0.onclick = function () { idx = 0; render(); };
      app.appendChild(el('p', { classe: 'consigne', texte: 'Tu as déjà commencé ce quiz. Tu peux reprendre là où tu t\'étais arrêté.' }));
      app.appendChild(el('div', { classe: 'pied' }, [r, r0].concat(boutonReprendre())));
      return;
    }
    var b = el('button', { type: 'button', classe: 'primaire', texte: 'Commencer' });
    b.onclick = function () { idx = 0; render(); };
    var rp = boutonReprendre();
    if (rp.length) { app.appendChild(el('p', { classe: 'consigne', texte: 'Quelques écrans de la dernière fois méritent un deuxième regard. Tu peux commencer par eux.' })); app.appendChild(el('div', { classe: 'pied' }, rp.concat([b]))); }
    else app.appendChild(b);
  }
  function conclusion() {
    modeReprise = false;
    app.textContent = '';
    var c = data.conclusion || {};
    app.appendChild(el('h1', { texte: c.titre || 'Ce que tu as découvert' }));
    var ul = el('ul', { classe: 'points' });
    (c.points || []).forEach(function (p) { ul.appendChild(el('li', { texte: p })); });
    app.appendChild(ul);
    var b = el('button', { type: 'button', texte: 'Recommencer' });
    b.onclick = function () { idx = 0; render(); window.scrollTo(0, 0); };
    app.appendChild(b);
  }
  function render() {
    AUDIO.arreter();
    ecrireSauvegarde();
    if (idx >= data.ecrans.length) return conclusion();
    var e = data.ecrans[idx];
    app.textContent = '';
    aReprendre = lireReprendre();
    var nav = el('div', { classe: 'nav-ecrans', role: 'navigation', 'aria-label': 'Aller à un écran' });
    data.ecrans.forEach(function (x, k) {
      var p = el('button', { type: 'button', classe: 'pt' + (k === idx ? ' cour' : ''), texte: String(k + 1), title: x.titre || ('Écran ' + (k + 1)), 'aria-label': 'Écran ' + (k + 1) + ' : ' + (x.titre || '') });
      p.onclick = function () { idx = k; render(); window.scrollTo(0, 0); };
      if (aReprendre.indexOf(x.id) >= 0) { p.classList.add('reprendre'); p.title += ' (à revoir)'; }
      nav.appendChild(p);
    });
    var passer = el('button', { type: 'button', classe: 'passer', texte: 'Passer cet écran →' });
    passer.onclick = function () { idx++; render(); window.scrollTo(0, 0); };
    app.appendChild(el('div', { classe: 'progres' }, [
      el('span', { classe: 'prog-ligne' }, ['Écran ' + (idx + 1) + ' sur ' + data.ecrans.length, passer]),
      el('span', { classe: 'barre' }, [(function () { var i = el('i'); i.style.width = (idx / data.ecrans.length * 100) + '%'; return i; })()]),
      nav
    ]));
    aReprendre = lireReprendre();
    if (aReprendre.indexOf(e.id) >= 0) app.appendChild(el('p', { classe: 'essai-reprise', texte: 'À revoir : cet écran te revient de la dernière fois.' }));
    var zone = el('div'), retour = el('div');
    if (e.type === 'intro') {
      app.appendChild(el('h1', { texte: e.titre || '' }));
      app.appendChild(AUDIO.bouton(function () { return (e.titre || '') + '. ' + (e.paragraphes || []).join(' '); }, 'Écouter ce texte'));
      (e.paragraphes || []).forEach(function (p) { app.appendChild(el('p', { texte: p })); });
      if (e.afficher === 'frise') app.appendChild(bandeauPeriodes(false));
      var s = el('button', { type: 'button', classe: 'primaire', texte: 'Écran suivant →' });
      s.onclick = function () { idx++; render(); window.scrollTo(0, 0); };
      app.appendChild(el('div', { classe: 'pied' }, [s]));
      return;
    }
    if (e.type === 'synthese') {
      app.appendChild(el('h1', { texte: e.titre || 'Vue d\'ensemble' }));
      app.appendChild(AUDIO.bouton(function () { return (e.titre || '') + '. ' + (e.paragraphes || []).join(' '); }, 'Écouter ce texte'));
      (e.paragraphes || []).forEach(function (p) { app.appendChild(el('p', { texte: p })); });
      synthese(e, app);
      var s2 = el('button', { type: 'button', classe: 'primaire', texte: 'Voir ce que tu as découvert' });
      s2.onclick = function () { idx++; render(); window.scrollTo(0, 0); };
      app.appendChild(el('div', { classe: 'pied' }, [s2]));
      return;
    }
    app.appendChild(el('div', { classe: 'question-ligne' }, [el('div', { classe: 'question', texte: e.question || e.titre || '' }), AUDIO.bouton(function () { return (e.question || e.titre || '') + '. ' + textesZone(zone); }, 'Écouter la question')]));
    app.appendChild(zone); app.appendChild(retour);
    ({ placer: ecranPlacer, choix: ecranChoix, multiple: ecranMultiple })[e.type](e, zone, retour);
  }

  /* ---------- chargement ---------- */
  function demarrerAvec(obj) {
    var pb = valider(obj);
    if (pb.length) {
      app.textContent = '';
      app.appendChild(el('h1', { texte: 'Données incomplètes' }));
      var ul = el('ul'); pb.forEach(function (p) { ul.appendChild(el('li', { texte: p })); }); app.appendChild(ul);
      return;
    }
    data = obj; periodes = indexerPeriodes(obj);
    document.getElementById('manuel').hidden = true;
    if (data.titre) document.title = data.titre;
    accueil();
  }
  function afficherManuel(raison) {
    document.getElementById('manuel').hidden = false;
    document.getElementById('manuel-nom').textContent = racine + '.json';
    document.getElementById('manuel-raison').textContent = raison || '';
  }
  function demarrer() {
    app = document.getElementById('app');
    document.getElementById('manuel-fichier').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0]; if (!f) return;
      var l = new FileReader();
      l.onload = function () { try { demarrerAvec(JSON.parse(l.result)); } catch (err) { document.getElementById('manuel-raison').textContent = 'Fichier illisible : ' + err.message; } };
      l.readAsText(f);
    });
    fetch(racine + '.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(demarrerAvec)
      .catch(function (err) { app.textContent = 'Données non chargées.'; afficherManuel('Raison : ' + err.message); });
  }

  var api = { valider: valider, indexerPeriodes: indexerPeriodes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof document !== 'undefined') demarrer();
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
