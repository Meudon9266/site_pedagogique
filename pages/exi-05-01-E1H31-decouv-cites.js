/* Moteur « Découverte » : l'élève fait un pari, puis lit la réponse rédigée comme un mini-cours.
   Données : racine.json (lu à partir de window.RACINE, jamais de nom écrit en dur). */
(function () {
  var LOCAL = typeof location !== 'undefined' && location.protocol === 'file:';
  var CACHE = 'donnees-v1:' + (typeof location !== 'undefined' ? decodeURIComponent(location.pathname.split('/').pop()) : 'test');
  function memoriser(obj) { if (LOCAL) { try { localStorage.setItem(CACHE, JSON.stringify(obj)); } catch(e) {} } }
  function lireDonnees(url, options) {
    if (LOCAL) { try { var c = localStorage.getItem(CACHE); if(c) return Promise.resolve({ok:true,json:function(){return Promise.resolve(JSON.parse(c));}}); } catch(e) {} }
    return fetch(url, options);
  }

  'use strict';

  var racine = (typeof window !== 'undefined' && window.RACINE) || '';
  var data = null, faits = {}, idx = 0, app = null;
  var TOL = { juste: 1.5, proche: 4 };
  var TYPES = ['repere', 'estimation', 'classement', 'choix', 'multiple'];

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
  function nf(v) { return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 2 : 0 }); }
  function arrondi(v) { return Number(Number(v).toPrecision(2)); }
  function indexer(d) { var f = {}; ((d && d.faits) || []).forEach(function (x) { f[x.id] = x; }); return f; }
  function fmtFait(f) { return (f.approx ? '≈ ' : '') + nf(f.valeur) + (f.unite ? ' ' + f.unite : ''); }
  function facteur(a, b) { return Math.max(a / b, b / a); }
  function melanger(a) {
    var c = a.slice();
    for (var i = c.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = c[i]; c[i] = c[j]; c[j] = t; }
    return c;
  }
  function tolerance() {
    var t = (data && data.reglages && data.reglages.tolerance) || {};
    return { juste: t.juste || TOL.juste, proche: t.proche || TOL.proche };
  }
  function verdictPour(ratio) {
    var t = tolerance();
    if (ratio <= t.juste) return { cls: 'ok', texte: 'Dans le mille !' };
    if (ratio <= t.proche) return { cls: 'moyen', texte: 'Pas loin.' };
    return { cls: 'ko', texte: 'Loin du compte : c\'est normal, on a tous de mauvaises intuitions sur les tailles. C\'est pour ça qu\'on regarde les chiffres.' };
  }

  /* ---------- validation des données ---------- */
  function valider(d) {
    var pb = [], f = indexer(d), ids = {};
    if (!d || !Array.isArray(d.ecrans) || !d.ecrans.length) return ['Aucun écran dans le fichier de données.'];
    function fait(id, ou) { if (!f[id]) pb.push(ou + ' : fait inconnu « ' + id + ' ».'); }
    (d.faits || []).forEach(function (x) {
      if (typeof x.valeur !== 'number' || !(x.valeur > 0)) pb.push('Fait « ' + x.id + ' » : valeur numérique positive requise.');
    });
    d.ecrans.forEach(function (e, i) {
      var ou = 'Écran ' + (i + 1) + ' (« ' + (e.id || '?') + ' »)';
      if (!e.id) pb.push(ou + ' : identifiant manquant.');
      if (ids[e.id]) pb.push(ou + ' : identifiant en double.'); ids[e.id] = true;
      if (TYPES.indexOf(e.type) < 0) { pb.push(ou + ' : type inconnu « ' + e.type + ' ».'); return; }
      if (!e.question) pb.push(ou + ' : question vide.');
      if (e.type === 'repere') {
        fait(e.sujet, ou); if (!Array.isArray(e.reperes) || e.reperes.length < 2) pb.push(ou + ' : au moins 2 repères.');
        (e.reperes || []).forEach(function (r) { fait(r, ou); });
      } else if (e.type === 'estimation') {
        fait(e.fait, ou);
        if (!e.echelle || !(e.echelle.min > 0) || !(e.echelle.max > e.echelle.min)) pb.push(ou + ' : échelle invalide (0 < min < max).');
      } else if (e.type === 'classement') {
        if (!Array.isArray(e.faits) || e.faits.length < 3) pb.push(ou + ' : au moins 3 éléments à classer.');
        else {
          var vals = {};
          e.faits.forEach(function (x) { fait(x, ou); if (f[x]) { if (vals[f[x].valeur]) pb.push(ou + ' : deux éléments ont la même valeur.'); vals[f[x].valeur] = true; } });
        }
      } else if (e.type === 'choix') {
        if (!Array.isArray(e.options) || e.options.length < 2) pb.push(ou + ' : au moins 2 options.');
        else if (!e.options.some(function (o) { return o.id === e.bonne; })) pb.push(ou + ' : la bonne réponse ne correspond à aucune option.');
      } else if (e.type === 'multiple') {
        if (!Array.isArray(e.options) || e.options.length < 3) pb.push(ou + ' : au moins 3 options.');
        else if (!e.options.some(function (o) { return o.juste; })) pb.push(ou + ' : aucune option juste.');
      }
      var r = e.reponse;
      if (r) {
        (r.chiffres || []).forEach(function (c) { if (c.fait) fait(c.fait, ou); });
        if (r.illustration && r.illustration.type === 'surfaces') (r.illustration.elements || []).forEach(function (x) { fait(x.fait, ou); });
      }
    });
    return pb;
  }

  /* ---------- affichage de la réponse (mini-cours) ---------- */
  function illustration(il) {
    if (!il) return null;
    if (il.type === 'image') {
      var img = el('img', { classe: 'illus', alt: il.alt || il.legende || '', src: racine + '.' + il.n + '.png' });
      img.onerror = function () { img.remove(); };
      return el('figure', {}, [img, il.legende ? el('figcaption', { classe: 'legende', texte: il.legende }) : null]);
    }
    if (il.type === 'surfaces') {
      var els = (il.elements || []).map(function (x) { return { f: faits[x.fait], accent: !!x.accent }; }).filter(function (x) { return x.f; });
      if (!els.length) return null;
      els.sort(function (a, b) { return b.f.valeur - a.f.valeur; });
      var max = els[0].f.valeur, cote = 220, trop = false;
      var zone = el('div', { classe: 'surfaces', role: 'img', 'aria-label': 'Carrés à l\'échelle : ' + els.map(function (x) { return x.f.nom + ' ' + fmtFait(x.f); }).join(', ') });
      els.forEach(function (x) {
        var c = Math.sqrt(x.f.valeur / max) * cote, forme;
        if (c < 4) { forme = el('div', { classe: 'point' }); trop = true; }
        else { forme = el('div', { classe: 'carre' + (x.accent ? ' accent' : '') }); forme.style.width = c + 'px'; forme.style.height = c + 'px'; }
        var fig = el('figure', {}, [forme, el('figcaption', { texte: x.f.nom + ' — ' + fmtFait(x.f) })]);
        fig.style.width = Math.max(c, 110) + 'px';
        zone.appendChild(fig);
      });
      return el('div', {}, [zone, el('p', { classe: 'legende', texte: 'Surfaces dessinées à l\'échelle (la surface de chaque carré est proportionnelle au territoire).' + (trop ? ' Les plus petits sont trop petits pour être vus à cette échelle.' : '') })]);
    }
    return null;
  }
  function carteReponse(r) {
    if (!r) return null;
    var c = el('div', { classe: 'reponse' });
    if (r.titre) c.appendChild(el('h2', { texte: r.titre }));
    (r.paragraphes || []).forEach(function (p) { c.appendChild(el('p', { texte: p })); });
    if (r.chiffres && r.chiffres.length) {
      var t = el('table', { classe: 'chiffres' });
      r.chiffres.forEach(function (x) {
        var f = x.fait ? faits[x.fait] : null;
        t.appendChild(el('tr', {}, [el('td', { texte: x.libelle || (f && f.nom) || '' }), el('td', { texte: f ? fmtFait(f) : (nf(x.valeur) + (x.unite ? ' ' + x.unite : '')) })]));
      });
      c.appendChild(t);
    }
    var il = illustration(r.illustration); if (il) c.appendChild(il);
    if (r.a_retenir) c.appendChild(el('div', { classe: 'retenir', texte: 'À retenir : ' + r.a_retenir }));
    return c;
  }
  function reveler(e, retour, verdict, details) {
    retour.textContent = '';
    if (verdict) retour.appendChild(el('div', { classe: 'verdict ' + verdict.cls, texte: verdict.texte }));
    (details || []).forEach(function (d) { retour.appendChild(d); });
    var c = carteReponse(e.reponse); if (c) retour.appendChild(c);
    var dernier = idx >= data.ecrans.length - 1;
    var suite = el('button', { type: 'button', classe: 'primaire', texte: dernier ? 'Voir ce que tu as découvert' : 'Question suivante →' });
    suite.onclick = function () { idx++; render(); window.scrollTo(0, 0); };
    retour.appendChild(el('div', { classe: 'pied' }, [suite]));
    retour.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- les cinq types d'écrans ---------- */
  function ecranRepere(e, zone, retour) {
    var sujet = faits[e.sujet];
    var rep = e.reperes.map(function (id) { return faits[id]; }).sort(function (a, b) { return a.valeur - b.valeur; });
    var proche = rep.reduce(function (m, r) { return facteur(sujet.valeur, r.valeur) < facteur(sujet.valeur, m.valeur) ? r : m; });
    var box = el('div', { classe: 'choix repere' }); zone.appendChild(box);
    rep.forEach(function (r) {
      var b = el('button', { type: 'button', texte: r.nom });
      b.onclick = function () {
        var v = verdictPour(facteur(sujet.valeur, r.valeur));
        Array.prototype.forEach.call(box.children, function (x) { x.disabled = true; });
        b.classList.add('choisi');
        box.children[rep.indexOf(proche)].classList.add('juste');
        if (r !== proche && v.cls !== 'ok') b.classList.add('faux');
        reveler(e, retour, v, [el('p', {}, ['Ton pari : ', el('strong', { texte: r.nom }), ' (' + fmtFait(r) + ').  Réponse : ', el('strong', { texte: sujet.nom }), ' (' + fmtFait(sujet) + ').'])]);
      };
      box.appendChild(b);
    });
  }

  function ecranEstimation(e, zone, retour) {
    var f = faits[e.fait], mn = e.echelle.min, mx = e.echelle.max;
    function val(t) { return mn * Math.pow(mx / mn, t / 1000); }
    var aff = el('div', { classe: 'valeur' });
    var cur = el('input', { type: 'range', min: 0, max: 1000, value: 500, 'aria-label': 'Ton estimation' });
    function maj() { aff.textContent = nf(arrondi(val(Number(cur.value)))) + (f.unite ? ' ' + f.unite : ''); }
    cur.addEventListener('input', maj); maj();
    var ok = el('button', { type: 'button', classe: 'primaire', texte: 'Valider mon pari' });
    zone.appendChild(el('div', { classe: 'curseur' }, [aff, cur, el('p', { classe: 'legende', texte: 'Échelle de ' + nf(mn) + ' à ' + nf(mx) + ' ' + (f.unite || '') + ' (chaque graduation multiplie la valeur, elle ne l\'additionne pas).' })]));
    zone.appendChild(ok);
    ok.onclick = function () {
      var pari = arrondi(val(Number(cur.value)));
      cur.disabled = true; ok.disabled = true;
      reveler(e, retour, verdictPour(facteur(pari, f.valeur)), [el('p', {}, ['Ton pari : ', el('strong', { texte: nf(pari) + (f.unite ? ' ' + f.unite : '') }), '.  Réponse : ', el('strong', { texte: fmtFait(f) }), '.'])]);
    };
  }

  function ecranClassement(e, zone, retour) {
    var fs = e.faits.map(function (id) { return faits[id]; });
    var teinte = {};
    e.faits.forEach(function (id, i) { teinte[id] = Math.round((i * 137.508) % 360); });   /* une couleur distincte par carte */
    var tries = fs.slice().sort(function (a, b) { return a.valeur - b.valeur; });
    var ordre = melanger(fs);
    for (var k = 0; k < 10 && ordre.every(function (x, i) { return x === tries[i]; }); k++) ordre = melanger(fs);

    function carte(f, avecValeur) {
      var c = el('div', { classe: 'rang', role: 'listitem', 'data-id': f.id }, [
        el('span', { classe: 'nom', texte: f.nom }),
        avecValeur ? el('span', { classe: 'val', texte: fmtFait(f) }) : null
      ]);
      c.style.setProperty('--h', teinte[f.id]);
      return c;
    }
    zone.appendChild(el('p', { classe: 'legende', texte: 'Attrape une carte par la poignée ⠿ et fais-la glisser : le plus petit en haut, le plus grand en bas. Au clavier : choisis une carte (Tab), puis flèches haut / bas.' }));
    var liste = el('div', { classe: 'rangs', role: 'list' });
    zone.appendChild(liste);

    ordre.forEach(function (f) {
      var c = carte(f, false);
      var prise = el('span', { classe: 'prise', 'aria-hidden': 'true', texte: '⠿' });
      c.insertBefore(prise, c.firstChild);
      c.setAttribute('tabindex', '0');
      c.setAttribute('aria-label', f.nom + ' : déplace avec les flèches haut et bas');
      c.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowUp' && c.previousElementSibling) { liste.insertBefore(c, c.previousElementSibling); c.focus(); ev.preventDefault(); }
        if (ev.key === 'ArrowDown' && c.nextElementSibling) { liste.insertBefore(c.nextElementSibling, c); c.focus(); ev.preventDefault(); }
      });
      prise.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        var r0 = c.getBoundingClientRect(), decal = ev.clientY - (r0.top + r0.height / 2);
        c.classList.add('glisse');
        try { prise.setPointerCapture(ev.pointerId); } catch (x) { /* sans capture : on continue */ }
        function bouger(m) {
          var y = m.clientY - decal;
          c.style.transform = '';
          var cible = null, freres = Array.prototype.filter.call(liste.children, function (x) { return x !== c; });
          for (var i = 0; i < freres.length; i++) { var r = freres[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { cible = freres[i]; break; } }
          if (cible !== c.nextElementSibling) liste.insertBefore(c, cible);
          var r2 = c.getBoundingClientRect();
          c.style.transform = 'translateY(' + (y - (r2.top + r2.height / 2)) + 'px)';
        }
        function lacher() {
          c.style.transform = ''; c.classList.remove('glisse');
          prise.removeEventListener('pointermove', bouger); prise.removeEventListener('pointerup', lacher); prise.removeEventListener('pointercancel', lacher);
        }
        prise.addEventListener('pointermove', bouger); prise.addEventListener('pointerup', lacher); prise.addEventListener('pointercancel', lacher);
      });
      liste.appendChild(c);
    });

    var ok = el('button', { type: 'button', classe: 'primaire', texte: 'Valider cet ordre' });
    zone.appendChild(ok);
    ok.onclick = function () {
      ok.disabled = true;
      var final = Array.prototype.map.call(liste.children, function (c) { return faits[c.getAttribute('data-id')]; });
      liste.textContent = '';
      var bons = 0;
      final.forEach(function (f, i) {
        var juste = f === tries[i]; if (juste) bons++;
        var c = carte(f, true);
        c.classList.add(juste ? 'juste' : 'faux');
        c.insertBefore(el('span', { classe: 'prise', 'aria-hidden': 'true', texte: juste ? '✓' : '✗' }), c.firstChild);
        liste.appendChild(c);
      });
      var v = bons === final.length ? { cls: 'ok', texte: 'Tout est dans le bon ordre !' } : { cls: bons * 2 >= final.length ? 'moyen' : 'ko', texte: bons + ' carte(s) sur ' + final.length + ' à la bonne place.' };
      var det = [];
      if (bons !== final.length) {
        var bon = el('div', { classe: 'rangs', role: 'list' });
        tries.forEach(function (f) { bon.appendChild(carte(f, true)); });
        det.push(el('p', {}, [el('strong', { texte: 'Le bon ordre, du plus petit au plus grand :' })]));
        det.push(bon);
      }
      reveler(e, retour, v, det);
    };
  }

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
    var opts = e.melanger === false ? e.options.slice() : melanger(e.options);   /* vrais et faux mélangés à chaque partie */
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

  /* ---------- écrans généraux ---------- */
  function accueil() {
    app.textContent = '';
    app.appendChild(el('h1', { texte: data.titre || 'Découverte' }));
    if (data.consigne) app.appendChild(el('p', { classe: 'consigne', texte: data.consigne }));
    var b = el('button', { type: 'button', classe: 'primaire', texte: 'Commencer' });
    b.onclick = function () { idx = 0; render(); };
    app.appendChild(b);
  }
  function conclusion() {
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
    if (idx >= data.ecrans.length) return conclusion();
    var e = data.ecrans[idx];
    app.textContent = '';
    app.appendChild(el('div', { classe: 'progres' }, [
      'Question ' + (idx + 1) + ' sur ' + data.ecrans.length,
      el('span', { classe: 'barre' }, [(function () { var i = el('i'); i.style.width = (idx / data.ecrans.length * 100) + '%'; return i; })()])
    ]));
    app.appendChild(el('div', { classe: 'question', texte: e.question }));
    var zone = el('div'), retour = el('div');
    app.appendChild(zone); app.appendChild(retour);
    ({ repere: ecranRepere, estimation: ecranEstimation, classement: ecranClassement, choix: ecranChoix, multiple: ecranMultiple })[e.type](e, zone, retour);
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
    memoriser(obj);
    data = obj; faits = indexer(obj);
    document.getElementById('manuel').hidden = !LOCAL;
    if (data.titre) document.title = data.titre;
    accueil();
  }
  function afficherManuel(raison) {
    if(!LOCAL){ var erreur=document.createElement('p'); erreur.textContent='Erreur : données non chargées. '+(raison||''); document.body.appendChild(erreur); return; }
    document.getElementById('manuel').hidden = false;
    document.getElementById('manuel-nom').textContent = racine + '.json';
    document.getElementById('manuel-raison').textContent = raison || '';
  }
  function demarrer() {
    app = document.getElementById('app');
    document.getElementById('manuel-fichier').addEventListener('change', function (ev) {
      var fichier = ev.target.files && ev.target.files[0]; if (!fichier) return;
      var lecteur = new FileReader();
      lecteur.onload = function () {
        try { demarrerAvec(JSON.parse(lecteur.result)); }
        catch (err) { document.getElementById('manuel-raison').textContent = 'Fichier illisible : ' + err.message; }
      };
      lecteur.readAsText(fichier);
    });
    lireDonnees(racine + '.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(demarrerAvec)
      .catch(function (err) { app.textContent = 'Données non chargées.'; afficherManuel('Raison : ' + err.message); });
  }

  var api = { valider: valider, indexer: indexer, verdictPour: verdictPour, facteur: facteur };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof document !== 'undefined') demarrer();
})();
