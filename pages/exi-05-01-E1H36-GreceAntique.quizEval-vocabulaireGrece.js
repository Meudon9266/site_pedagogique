/* Exercice de vocabulaire : logique et interface.
   Les données viennent du fichier JSON qui porte la même racine que la page HTML. */
(function () {
  'use strict';

  var racine = (typeof window !== 'undefined' && window.RACINE) || '';
  var app = null;
  var donnees = null;
  var idx = null;
  var etat = null;

  /* ---------- utilitaires ---------- */

  function melanger(a) {
    var b = a.slice();
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function arrondir(x) { return Math.round(x * 10) / 10; }

  function valider(data) {
    if (!data || !Array.isArray(data.termes) || !data.termes.length) {
      throw new Error('Le fichier doit contenir une liste « termes ».');
    }
    data.termes.forEach(function (t, i) {
      ['id', 'terme', 'definition'].forEach(function (k) {
        if (!t[k]) throw new Error('Terme n° ' + (i + 1) + ' : champ « ' + k + ' » manquant.');
      });
      if (!Array.isArray(t.detrompeurs) || t.detrompeurs.length < 2) {
        throw new Error('Terme « ' + t.terme + ' » : prévois au moins 2 détrompeurs.');
      }
    });
    return data;
  }

  function indexer(data) {
    var m = {};
    data.termes.forEach(function (t) { m[t.id] = t; });
    return m;
  }

  function retenir(t) { return 'À retenir : « ' + t.terme + ' » : ' + t.definition; }

  /* ---------- fabrication des questions ---------- */

  function choixTermes(t, index, data, n) {
    var ids = [t.id].concat(melanger((t.voisins || []).filter(function (v) { return index[v] && v !== t.id; })));
    ids = ids.slice(0, n);
    var autres = melanger(data.termes.map(function (x) { return x.id; }).filter(function (id) { return ids.indexOf(id) < 0; }));
    while (ids.length < n && autres.length) ids.push(autres.shift());
    return melanger(ids).map(function (id) { return { texte: index[id].terme, juste: id === t.id }; });
  }

  function questionAsso(t, index, data) {
    var ids = [t.id].concat(melanger((t.voisins || []).filter(function (v) { return index[v] && v !== t.id; }))).slice(0, 4);
    var autres = melanger(data.termes.map(function (x) { return x.id; }).filter(function (id) { return ids.indexOf(id) < 0; }));
    while (ids.length < 3 && autres.length) ids.push(autres.shift());
    if (ids.length < 3) return null;
    return {
      cle: 'asso:' + ids.slice().sort().join(','),
      type: 'asso', cat: 'asso', termes: ids,
      items: ids.map(function (id) { return { id: id, terme: index[id].terme }; }),
      defs: melanger(ids.map(function (id) { return { id: id, texte: index[id].definition }; }))
    };
  }

  function questionsDuTerme(t, index, data) {
    var qs = [];
    var detr = melanger(t.detrompeurs).slice(0, 3);

    qs.push({
      cle: t.id + ':def', type: 'qcm', cat: 'def', termes: [t.id],
      question: 'Que signifie « ' + t.terme + ' » ?',
      choix: melanger([{ texte: t.definition, juste: true }].concat(detr.map(function (d) { return { texte: d, juste: false }; }))),
      explication: retenir(t)
    });

    qs.push({
      cle: t.id + ':mot', type: 'qcm', cat: 'mot', termes: [t.id],
      question: 'Quel mot correspond à cette définition ?',
      citation: t.definition,
      choix: choixTermes(t, index, data, 4),
      explication: retenir(t)
    });

    (t.vrai_faux || []).forEach(function (v, i) {
      qs.push({
        cle: t.id + ':vf' + i, type: 'vf', cat: 'vf', termes: [t.id],
        enonce: v.enonce, vrai: !!v.vrai,
        explication: (v.explication ? v.explication + ' ' : '') + retenir(t)
      });
    });

    (t.situations || []).forEach(function (s, i) {
      qs.push({
        cle: t.id + ':sit' + i, type: 'qcm', cat: 'situation', termes: [t.id],
        question: s + ' Quel mot correspond ?',
        choix: choixTermes(t, index, data, 4),
        explication: retenir(t)
      });
    });

    (t.trous || []).forEach(function (tr, i) {
      qs.push({
        cle: t.id + ':trou' + i, type: 'qcm', cat: 'trou', termes: [t.id],
        question: 'Complète la phrase avec le bon mot.',
        phrase: tr.texte.replace('___', '_____'),
        phraseComplete: tr.texte.replace('___', tr.mot || t.terme),
        choix: choixTermes(t, index, data, 4),
        explication: retenir(t)
      });
    });

    if (t.ecrire) {
      qs.push({
        cle: t.id + ':ecrire', type: 'ecrire', cat: 'ecrire', termes: [t.id],
        consigne: t.ecrire.consigne || ('Explique avec tes mots : ' + t.terme + '.'),
        modele: t.definition
      });
    }
    return qs;
  }

  /* opts : { groupes: [...], ids: [...], nombre: n } */
  function composer(data, opts) {
    var index = indexer(data);
    var ts = data.termes.filter(function (t) {
      if (opts.ids) return opts.ids.indexOf(t.id) >= 0;
      return !opts.groupes || opts.groupes.indexOf(t.groupe) >= 0;
    });
    var pools = {};
    ts.forEach(function (t) {
      var pool = questionsDuTerme(t, index, data);
      var a = questionAsso(t, index, data);
      if (a) pool.push(a);
      pools[t.id] = melanger(pool);
    });

    var maxAsso = Math.max(1, Math.floor(opts.nombre / 6));
    var res = [], cles = {}, dernier = null, nbAsso = 0, rien = false;

    while (res.length < opts.nombre && !rien) {
      rien = true;
      melanger(ts).forEach(function (t) {
        if (res.length >= opts.nombre) return;
        var pool = pools[t.id];
        var k = -1, i;
        for (i = 0; i < pool.length; i++) {
          var q = pool[i];
          if (cles[q.cle]) continue;
          if (q.type === 'asso' && nbAsso >= maxAsso) continue;
          if (q.cat === dernier) continue;
          k = i; break;
        }
        if (k < 0) {
          for (i = 0; i < pool.length; i++) {
            var q2 = pool[i];
            if (cles[q2.cle]) continue;
            if (q2.type === 'asso' && nbAsso >= maxAsso) continue;
            k = i; break;
          }
        }
        if (k < 0) return;
        var choisie = pool.splice(k, 1)[0];
        cles[choisie.cle] = 1;
        if (choisie.type === 'asso') nbAsso++;
        res.push(choisie);
        dernier = choisie.cat;
        rien = false;
      });
    }
    return res;
  }

  /* ---------- interface ---------- */

  function groupesDe(data) {
    if (data.groupes && data.groupes.length) return data.groupes;
    var vus = {}, g = [];
    data.termes.forEach(function (t) {
      var id = t.groupe || 'tous';
      if (!vus[id]) { vus[id] = 1; g.push({ id: id, titre: id === 'tous' ? 'Tous les termes' : id }); }
    });
    return g;
  }

  function accueil() {
    var d = donnees;
    var h = '<h1>' + echapper(d.titre || 'Vocabulaire') + '</h1>';
    if (d.consigne) h += '<p class="consigne">' + echapper(d.consigne) + '</p>';
    h += '<fieldset><legend>Thèmes à réviser</legend>';
    groupesDe(d).forEach(function (g) {
      h += '<label class="case"><input type="checkbox" name="g" value="' + echapper(g.id) + '" checked> ' + echapper(g.titre) + '</label>';
    });
    h += '</fieldset>';
    h += '<p><label>Nombre de questions : <select id="nb"><option>10</option><option selected>15</option><option>20</option><option>30</option></select></label></p>';
    h += '<p><button class="primaire" id="go">Commencer</button></p><p id="msg" class="avert"></p>';
    app.innerHTML = h;
    document.getElementById('go').onclick = function () {
      var gs = Array.prototype.map.call(app.querySelectorAll('input[name=g]:checked'), function (c) { return c.value; });
      if (!gs.length) { document.getElementById('msg').textContent = 'Choisis au moins un thème.'; return; }
      var nb = parseInt(document.getElementById('nb').value, 10);
      lancer({ groupes: gs, nombre: nb });
    };
  }

  function lancer(opts) {
    var qs = composer(donnees, opts);
    if (!qs.length) { app.innerHTML = '<p>Aucune question disponible avec ces réglages.</p><p><button class="primaire" id="retour-accueil">Retour</button></p>'; document.getElementById('retour-accueil').onclick = accueil; return; }
    etat = { questions: qs, i: 0, score: 0, manques: {} };
    question();
  }

  function entete() {
    var n = etat.questions.length;
    return '<div class="progres">Question ' + (etat.i + 1) + ' / ' + n +
      '<span class="barre"><i style="width:' + Math.round(etat.i / n * 100) + '%"></i></span></div>';
  }

  function terminer(points, ok, texte, manques) {
    etat.score += points;
    (manques || []).forEach(function (id) { etat.manques[id] = true; });
    var dernierQ = etat.i === etat.questions.length - 1;
    var r = document.getElementById('retour');
    r.className = 'retour ' + (ok === true ? 'ok' : ok === false ? 'ko' : 'moyen');
    r.innerHTML = texte + '<p><button class="primaire" id="suite">' + (dernierQ ? 'Voir le bilan' : 'Question suivante') + '</button></p>';
    document.getElementById('suite').onclick = function () { etat.i++; if (etat.i >= etat.questions.length) bilan(); else question(); };
    document.getElementById('suite').focus();
  }

  function question() {
    var q = etat.questions[etat.i];
    var h = entete();
    var lettres = 'ABCDEFGH';

    if (q.type === 'qcm') {
      h += '<p class="enonce">' + echapper(q.question) + '</p>';
      if (q.citation) h += '<blockquote>' + echapper(q.citation) + '</blockquote>';
      if (q.phrase) h += '<p class="phrase">' + echapper(q.phrase) + '</p>';
      h += '<div class="choix">' + q.choix.map(function (c, k) {
        return '<button class="choix-btn" data-k="' + k + '">' + echapper(c.texte) + '</button>';
      }).join('') + '</div><div id="retour"></div>';
      app.innerHTML = h;
      Array.prototype.forEach.call(app.querySelectorAll('.choix-btn'), function (b) {
        b.onclick = function () {
          var k = +b.getAttribute('data-k');
          var ok = q.choix[k].juste;
          Array.prototype.forEach.call(app.querySelectorAll('.choix-btn'), function (x, j) {
            x.disabled = true;
            if (q.choix[j].juste) x.classList.add('juste');
            else if (x === b) x.classList.add('faux');
          });
          var txt = '<p><strong>' + (ok ? 'Bravo !' : 'Pas tout à fait.') + '</strong></p>';
          if (q.phraseComplete) txt += '<p>' + echapper(q.phraseComplete) + '</p>';
          txt += '<p>' + echapper(q.explication) + '</p>';
          terminer(ok ? 1 : 0, ok, txt, ok ? [] : q.termes);
        };
      });

    } else if (q.type === 'vf') {
      h += '<p class="enonce">Vrai ou faux ?</p><blockquote>' + echapper(q.enonce) + '</blockquote>';
      h += '<div class="choix deux"><button class="choix-btn" data-v="1">Vrai</button><button class="choix-btn" data-v="0">Faux</button></div><div id="retour"></div>';
      app.innerHTML = h;
      Array.prototype.forEach.call(app.querySelectorAll('.choix-btn'), function (b) {
        b.onclick = function () {
          var rep = b.getAttribute('data-v') === '1';
          var ok = rep === q.vrai;
          Array.prototype.forEach.call(app.querySelectorAll('.choix-btn'), function (x) {
            x.disabled = true;
            if ((x.getAttribute('data-v') === '1') === q.vrai) x.classList.add('juste');
            else if (x === b) x.classList.add('faux');
          });
          var txt = '<p><strong>' + (ok ? 'Bravo !' : 'Pas tout à fait.') + '</strong> L\'affirmation est ' + (q.vrai ? 'vraie' : 'fausse') + '.</p><p>' + echapper(q.explication) + '</p>';
          terminer(ok ? 1 : 0, ok, txt, ok ? [] : q.termes);
        };
      });

    } else if (q.type === 'asso') {
      h += '<p class="enonce">Associe chaque mot à sa définition.</p>';
      h += '<ol class="defs" type="A">' + q.defs.map(function (d) { return '<li>' + echapper(d.texte) + '</li>'; }).join('') + '</ol>';
      h += '<div class="asso">' + q.items.map(function (it, k) {
        return '<label><span>' + echapper(it.terme) + '</span> <select data-k="' + k + '"><option value="">…</option>' +
          q.defs.map(function (d, j) { return '<option value="' + j + '">' + lettres[j] + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div>';
      h += '<p><button class="primaire" id="valider">Valider</button></p><div id="retour"></div>';
      app.innerHTML = h;
      document.getElementById('valider').onclick = function () {
        var selects = app.querySelectorAll('select');
        var bons = 0, manques = [], lignes = '';
        Array.prototype.forEach.call(selects, function (s, k) {
          var it = q.items[k];
          var attendu = -1;
          q.defs.forEach(function (d, j) { if (d.id === it.id) attendu = j; });
          var ok = s.value !== '' && +s.value === attendu;
          if (ok) bons++; else manques.push(it.id);
          s.disabled = true;
          s.classList.add(ok ? 'juste' : 'faux');
          lignes += '<li>' + (ok ? '✓ ' : '✗ ') + '<strong>' + echapper(it.terme) + '</strong> : ' + lettres[attendu] + '</li>';
        });
        document.getElementById('valider').disabled = true;
        var ok = bons === q.items.length;
        var txt = '<p><strong>' + (ok ? 'Bravo !' : bons + ' bonne(s) association(s) sur ' + q.items.length + '.') + '</strong></p><ul class="liste">' + lignes + '</ul>';
        terminer(bons / q.items.length, ok ? true : (bons > 0 ? null : false), txt, manques);
      };

    } else if (q.type === 'ecrire') {
      var t = idx[q.termes[0]];
      h += '<p class="enonce">Explique avec tes mots</p><p>' + echapper(q.consigne) + '</p>';
      h += '<textarea id="rep" rows="4" placeholder="Écris ta réponse ici (sur ton cahier si tu préfères)."></textarea>';
      h += '<p><button class="primaire" id="voir">Voir la réponse attendue</button></p><div id="retour"></div>';
      app.innerHTML = h;
      document.getElementById('voir').onclick = function () {
        document.getElementById('voir').disabled = true;
        document.getElementById('rep').readOnly = true;
        var r = document.getElementById('retour');
        r.className = 'retour moyen';
        r.innerHTML = '<p><strong>« ' + echapper(t.terme) + ' »</strong> : ' + echapper(q.modele) + '</p><p>Compare avec ta réponse. Où te situes-tu ?</p>' +
          '<div class="choix trois"><button class="choix-btn" data-p="1">Je l\'avais</button><button class="choix-btn" data-p="0.5">En partie</button><button class="choix-btn" data-p="0">Pas vraiment</button></div>';
        Array.prototype.forEach.call(r.querySelectorAll('.choix-btn'), function (b) {
          b.onclick = function () {
            var p = parseFloat(b.getAttribute('data-p'));
            terminer(p, p === 1 ? true : (p === 0 ? false : null),
              '<p><strong>« ' + echapper(t.terme) + ' »</strong> : ' + echapper(q.modele) + '</p><p>' + (p === 1 ? 'Bien.' : 'Relis cette définition une fois de plus.') + '</p>',
              p === 1 ? [] : q.termes);
          };
        });
      };
    }
  }

  function bilan() {
    var n = etat.questions.length;
    var s = arrondir(etat.score);
    var pct = etat.score / n;
    var msg = pct >= 0.85 ? 'Très bien : tu maîtrises le vocabulaire.' : pct >= 0.6 ? 'Bon début : revois les mots ci-dessous.' : 'À retravailler : relis les définitions, puis recommence.';
    var ids = Object.keys(etat.manques);
    var h = '<h1>Bilan</h1><p class="score">' + s + ' / ' + n + '</p><p>' + msg + '</p>';
    if (ids.length) {
      h += '<h2>À revoir</h2><ul class="liste">' + ids.map(function (id) {
        var t = idx[id]; return '<li><strong>' + echapper(t.terme) + '</strong> : ' + echapper(t.definition) + '</li>';
      }).join('') + '</ul>';
    }
    h += '<p>';
    if (ids.length) h += '<button class="primaire" id="refaire">Refaire les mots ratés</button> ';
    h += '<button id="recommencer">Revenir au début</button></p>';
    app.innerHTML = h;
    if (ids.length) document.getElementById('refaire').onclick = function () {
      lancer({ ids: ids, nombre: Math.min(15, Math.max(6, ids.length * 3)) });
    };
    document.getElementById('recommencer').onclick = accueil;
  }

  /* ---------- chargement des données ---------- */

  var estLocal = typeof location !== 'undefined' && location.protocol === 'file:';
  var cleCache = 'site-pedagogique:' + racine + ':json';

  function memoriser(data) {
    try { localStorage.setItem(cleCache, JSON.stringify(data)); }
    catch (e) { /* Le chargement manuel restera disponible à chaque ouverture. */ }
  }

  function lireMemoire() {
    try {
      var texte = localStorage.getItem(cleCache);
      return texte ? JSON.parse(texte) : null;
    } catch (e) { return null; }
  }

  function demarrerAvec(data) {
    donnees = valider(data);
    idx = indexer(donnees);
    if (donnees.titre) document.title = donnees.titre;
    var m = document.getElementById('manuel');
    if (m) m.hidden = !estLocal;
    accueil();
  }

  function afficherManuel(raison) {
    var m = document.getElementById('manuel');
    if (!m || !estLocal) return;
    m.hidden = false;
    var nom = racine ? racine + '.json' : 'le fichier .json';
    document.getElementById('manuel-nom').textContent = nom;
    document.getElementById('manuel-raison').textContent = raison || '';
    var entree = document.getElementById('manuel-fichier');
    entree.onchange = function () {
      var f = entree.files && entree.files[0];
      if (!f) return;
      var lecteur = new FileReader();
      lecteur.onload = function () {
        try {
          var chargees = JSON.parse(lecteur.result);
          valider(chargees);
          memoriser(chargees);
          demarrerAvec(chargees);
        }
        catch (e) { document.getElementById('manuel-raison').textContent = 'Fichier non valide : ' + e.message; }
      };
      lecteur.readAsText(f);
    };
  }

  function demarrer() {
    app = document.getElementById('app');
    if (!racine) {
      app.innerHTML = '<p>Impossible de déduire le nom du fichier de données à partir de l\'adresse de la page.</p>';
      afficherManuel('');
      return;
    }
    app.innerHTML = '<p>Chargement…</p>';
    if (estLocal) {
      var copie = lireMemoire();
      afficherManuel(copie ? '' : 'Choisis le fichier JSON lors de cette première ouverture locale.');
      if (copie) {
        try { demarrerAvec(copie); return; }
        catch (e) {
          document.getElementById('manuel-raison').textContent = 'La copie mémorisée n’est plus valide : ' + e.message;
        }
      }
      app.innerHTML = '<p>Choisis le fichier de données avec le bouton placé en bas de la page.</p>';
      return;
    }
    fetch(racine + '.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(demarrerAvec)
      .catch(function (e) {
        app.innerHTML = '<p>Les données n\'ont pas pu être chargées automatiquement sur le site. Vérifie que le fichier JSON associé est bien présent.</p>';
      });
  }

  var api = { composer: composer, valider: valider, indexer: indexer };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else if (typeof document !== 'undefined') { demarrer(); }
})();
