(function(){
  "use strict";

  /* ------------------------------------------------------------------
     Avoir & Être — tous niveaux
     Fusion des 4 exercices autonomes (tous les temps / temps composés +
     sujet / QCM / réponse libre) en un seul fichier à onglets, sur le
     modèle de « Révision par planning » (tabs, réglages par niveau,
     historique, feuille PDF téléchargeable).
     Fichier .js reconstruit à partir de la racine du .html (convention
     « échanges codifiés avec noms reconstruits »).
  ------------------------------------------------------------------ */

  // Identifiant d'application (sert uniquement à préfixer le compteur de
  // séries de la feuille PDF — les autres données utilisent les clés
  // d'origine de chaque exercice, voir LEVEL_SPECS).
  var appId = 'avoir-etre-tous-temps';

  var PERSONS = ["je", "tu", "il", "nous", "vous", "ils"];

  /* ---------- Niveau 1 : « Tous les temps » (correspondance simple/composé) ---------- */
  var SIMPLE_TENSES  = ["présent", "imparfait", "futur simple", "passé simple", "infinitif présent"];
  var COMPOSE_TENSES = ["passé composé", "plus-que-parfait", "futur antérieur", "passé antérieur", "infinitif passé"];

  var AVOIR_SIMPLE = {
    "présent":       ["j'ai", "tu as", "il a", "nous avons", "vous avez", "ils ont"],
    "imparfait":     ["j'avais", "tu avais", "il avait", "nous avions", "vous aviez", "ils avaient"],
    "futur simple":  ["j'aurai", "tu auras", "il aura", "nous aurons", "vous aurez", "ils auront"],
    "passé simple":  ["j'eus", "tu eus", "il eut", "nous eûmes", "vous eûtes", "ils eurent"]
  };
  var ETRE_SIMPLE = {
    "présent":       ["je suis", "tu es", "il est", "nous sommes", "vous êtes", "ils sont"],
    "imparfait":     ["j'étais", "tu étais", "il était", "nous étions", "vous étiez", "ils étaient"],
    "futur simple":  ["je serai", "tu seras", "il sera", "nous serons", "vous serez", "ils seront"],
    "passé simple":  ["je fus", "tu fus", "il fut", "nous fûmes", "vous fûtes", "ils furent"]
  };
  var SIMPLE_ORDER  = ["présent", "imparfait", "futur simple", "passé simple"];
  var COMPOSE_ORDER = ["passé composé", "plus-que-parfait", "futur antérieur", "passé antérieur"];

  function buildPairSet(inf, simpleTable, participle){
    var out = [];
    SIMPLE_ORDER.forEach(function(t){
      simpleTable[t].forEach(function(f){ out.push({f:f, inf:inf, t:t}); });
    });
    out.push({f:inf, inf:inf, t:"infinitif présent"});
    SIMPLE_ORDER.forEach(function(t, idx){
      AVOIR_SIMPLE[t].forEach(function(aux){
        out.push({f:aux + " " + participle, inf:inf, t:COMPOSE_ORDER[idx]});
      });
    });
    out.push({f:"avoir " + participle, inf:inf, t:"infinitif passé"});
    return out;
  }
  var VERBS_PAIR = buildPairSet("avoir", AVOIR_SIMPLE, "eu").concat(buildPairSet("être", ETRE_SIMPLE, "été"));

  /* ---------- Niveau 2 : « Temps composés + sujet » ---------- */
  var AUX_BARE = {
    "présent":      ["ai", "as", "a", "avons", "avez", "ont"],
    "futur simple": ["aurai", "auras", "aura", "aurons", "aurez", "auront"]
  };
  var BARE_TENSE_MAP = { "présent": "passé composé", "futur simple": "futur antérieur" };
  var PRONOUN_MERGED_BARE = {
    "imparfait": [
      { form: "avais",   persons: ["je", "tu"] },
      { form: "avait",   persons: ["il"] },
      { form: "avions",  persons: ["nous"] },
      { form: "aviez",   persons: ["vous"] },
      { form: "avaient", persons: ["ils"] }
    ],
    "passé simple": [
      { form: "eus",    persons: ["je", "tu"] },
      { form: "eut",    persons: ["il"] },
      { form: "eûmes",  persons: ["nous"] },
      { form: "eûtes",  persons: ["vous"] },
      { form: "eurent", persons: ["ils"] }
    ]
  };
  var PRONOUN_TENSE_MAP = { "imparfait": "plus-que-parfait", "passé simple": "passé antérieur" };

  function buildComposeSujetSet(inf, participle){
    var out = [];
    Object.keys(BARE_TENSE_MAP).forEach(function(simpleT){
      var composeT = BARE_TENSE_MAP[simpleT];
      AUX_BARE[simpleT].forEach(function(bare, idx){
        out.push({ f: bare + " " + participle, inf: inf, t: composeT, personAccept: [PERSONS[idx]], needsPerson: true });
      });
    });
    Object.keys(PRONOUN_TENSE_MAP).forEach(function(simpleT){
      var composeT = PRONOUN_TENSE_MAP[simpleT];
      PRONOUN_MERGED_BARE[simpleT].forEach(function(entry){
        out.push({ f: entry.form + " " + participle, inf: inf, t: composeT, personAccept: entry.persons.slice(), needsPerson: true });
      });
    });
    out.push({ f: "avoir " + participle, inf: inf, t: "infinitif passé", personAccept: null, needsPerson: false });
    return out;
  }
  var VERBS_COMPOSE_SUJET = buildComposeSujetSet("avoir", "eu").concat(buildComposeSujetSet("être", "été"));

  /* ---------- Niveaux 3 & 4 : banque fixe de 20 questions (QCM / libre) ---------- */
  var QUESTIONS = [
    { inf:"avoir", tense:"présent", person:"tu", correct:"tu as",
      distractors:["tu à", "tu avais", "tu auras"] },
    { inf:"avoir", tense:"imparfait", person:"je", correct:"j'avais",
      distractors:["j'eus", "j'avai", "j'ai eu"] },
    { inf:"avoir", tense:"futur simple", person:"nous", correct:"nous aurons",
      distractors:["nous avons", "nous avions", "nous auront"] },
    { inf:"avoir", tense:"passé simple", person:"je", correct:"j'eus",
      distractors:["j'avais", "j'eû", "j'ai eu"] },
    { inf:"avoir", tense:"infinitif passé", person:"", correct:"avoir eu",
      distractors:["avoir", "eu", "ayant"] },
    { inf:"avoir", tense:"passé composé", person:"il", correct:"il a eu",
      distractors:["il eut", "il avait eu", "il eut eu"] },
    { inf:"avoir", tense:"plus-que-parfait", person:"il", correct:"il avait eu",
      distractors:["il a eu", "il eut eu", "il avai eu"] },
    { inf:"avoir", tense:"futur antérieur", person:"vous", correct:"vous aurez eu",
      distractors:["vous avez eu", "vous aviez eu", "vous auriez eu"] },
    { inf:"avoir", tense:"passé antérieur", person:"ils", correct:"ils eurent eu",
      distractors:["ils avaient eu", "ils ont eu", "ils eûrent eu"] },
    { inf:"avoir", tense:"infinitif passé", person:"", correct:"avoir eu",
      distractors:["ayant eu", "eu", "avoir"] },

    { inf:"être", tense:"présent", person:"tu", correct:"tu es",
      distractors:["tu étais", "tu seras", "tu été"] },
    { inf:"être", tense:"imparfait", person:"je", correct:"j'étais",
      distractors:["je fus", "j'ai été", "j'été"] },
    { inf:"être", tense:"futur simple", person:"nous", correct:"nous serons",
      distractors:["nous sommes", "nous étions", "nous serions"] },
    { inf:"être", tense:"passé simple", person:"je", correct:"je fus",
      distractors:["j'étais", "j'ai été", "je fut"] },
    { inf:"être", tense:"infinitif présent", person:"", correct:"être",
      distractors:["été", "ètre", "avoir été"] },
    { inf:"être", tense:"passé composé", person:"il", correct:"il a été",
      distractors:["il fut", "il avait été", "il à été"] },
    { inf:"être", tense:"plus-que-parfait", person:"il", correct:"il avait été",
      distractors:["il a été", "il eut été", "il avais été"] },
    { inf:"être", tense:"futur antérieur", person:"vous", correct:"vous aurez été",
      distractors:["vous avez été", "vous aviez été", "vous auriez été"] },
    { inf:"être", tense:"passé antérieur", person:"ils", correct:"ils eurent été",
      distractors:["ils avaient été", "ils ont été", "ils eûrent été"] },
    { inf:"être", tense:"infinitif passé", person:"", correct:"avoir été",
      distractors:["être eu", "ayant été", "étant été"] }
  ];

  function shuffle(arr){
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmtTime(sec){
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Tolérance typographique (niveau 4 — réponse libre) : casse, espaces en
  // trop, apostrophe droite ou courbe, accent manquant ou mal placé sont
  // acceptés ; une terminaison, un temps ou une personne différents non.
  function normSpace(s){ return String(s || '').trim().replace(/\s+/g, ' '); }
  function stripApos(s){ return s.replace(/[’‘`´']/g, ''); }
  function stripAccents(s){ return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; }
  function gradeAnswer(given, correct){
    var a = stripApos(normSpace(given).toLowerCase());
    var b = stripApos(normSpace(correct).toLowerCase());
    if (a === b) return 'exact';
    if (stripAccents(a) === stripAccents(b)) return 'typo';
    return 'wrong';
  }

  /* ------------------------------------------------------------------
     Réglages par niveau (les 4 onglets gardent chacun leur mécanique et
     leurs clés de stockage d'origine, pour que la progression déjà
     enregistrée sur un appareil avec les anciens fichiers autonomes reste
     valable une fois fusionnée ici).
  ------------------------------------------------------------------ */
  var LEVEL_SPECS = {
    1: {
      title: 'Tous les temps',
      tag: 'Indicatif · les deux auxiliaires, toutes les personnes',
      intro: 'Une forme conjuguée d’<em>avoir</em> ou d’<em>être</em> apparaît, à n’importe quelle personne. Clique sur le temps qui correspond, dans la bonne colonne : temps simple à gauche, temps composé correspondant à droite — exactement comme dans la fiche.',
      legend: ['<span><i class="dot simple"></i> temps simples</span>', '<span><i class="dot compose"></i> temps composés</span>'],
      goalMode: 'cumulative', fixedGoal: 10, fixedDuration: 180,
      targetTitle: 'Objectif 10 bonnes réponses',
      targetDesc: 'Réponds jusqu’à obtenir 10 bonnes réponses. Le chronomètre tourne : vise le temps le plus court.',
      timedTitle: 'Chrono 3 minutes',
      timedDesc: 'Trois minutes pour enchaîner un maximum de bonnes réponses. Le score s’arrête quand le temps est écoulé.',
      hasSettings: false, keyPrefix: 'lbt-avoir-etre', credit: 'verbes avoir et être uniquement'
    },
    2: {
      title: 'Temps composés + sujet',
      tag: 'Indicatif · les 5 temps composés + le sujet à deviner',
      intro: 'Une forme conjuguée d’<em>avoir</em> ou d’<em>être</em> apparaît, toujours à un temps composé et sans son pronom : il faut retrouver le temps dans la colonne de gauche et le sujet dans la colonne de droite. Au plus-que-parfait et au passé antérieur, quand la forme sans pronom est la même pour « je » et « tu » (par exemple « avais » ou « eus »), les deux réponses sont acceptées.',
      legend: ['<span><i class="dot compose"></i> le temps (les 5 temps composés)</span>', '<span><i class="dot" style="background:var(--accent)"></i> le sujet (masqué partout sauf à l’infinitif passé)</span>'],
      goalMode: 'cumulative', fixedGoal: 10, fixedDuration: 180,
      targetTitle: 'Objectif 10 bonnes réponses',
      targetDesc: 'Réponds jusqu’à obtenir 10 bonnes réponses. Le chronomètre tourne : vise le temps le plus court.',
      timedTitle: 'Chrono 3 minutes',
      timedDesc: 'Trois minutes pour enchaîner un maximum de bonnes réponses. Le score s’arrête quand le temps est écoulé.',
      hasSettings: false, keyPrefix: 'lbt-niveau1-sujet', credit: 'verbes avoir et être, temps composés + sujet'
    },
    3: {
      title: 'QCM',
      tag: 'QCM · pièges de temps et d’orthographe',
      intro: 'On demande la forme d’<em>avoir</em> ou d’<em>être</em> à un temps et une personne donnés. Quatre réponses proposées, une seule est correcte : les autres sont soit le bon verbe à un autre temps qu’on confond facilement, soit une orthographe qui a l’air juste mais qui ne l’est pas.',
      legend: ['<span>20 questions, avoir et être, tous temps confondus</span>', '<span>ordre des questions et des réponses mélangé à chaque partie</span>'],
      goalMode: 'streak', defaultGoal: 5, defaultDuration: 120, autoLevelUp: true,
      hasSettings: true, keyPrefix: 'lbt-niveau2', credit: 'QCM avoir et être'
    },
    4: {
      title: 'Réponse libre',
      tag: 'Réponse à taper · tous temps',
      intro: 'On demande la forme d’<em>avoir</em> ou d’<em>être</em> à un temps et une personne donnés, mais cette fois il n’y a plus de choix proposés : il faut taper la réponse soi-même. Les majuscules, les espaces en trop, l’apostrophe droite ou courbe et un accent manquant ou mal placé sont tolérés. En revanche, une terminaison, un temps ou une personne différents restent comptés comme une erreur.',
      legend: ['<span>20 questions, avoir et être, tous temps confondus</span>', '<span>réponse à taper au clavier, tolérance typographique seulement</span>'],
      goalMode: 'streak', defaultGoal: 5, defaultDuration: 120, autoLevelUp: true,
      hasSettings: true, keyPrefix: 'lbt-niveau3', credit: 'saisie libre avoir et être'
    }
  };
  var GOAL_STEPS_TO_LEVEL_UP = 3;

  /* ---------- Stockage local, générique par préfixe de niveau ---------- */
  function getCount(prefix){
    try { return parseInt(localStorage.getItem(prefix + '-completions'), 10) || 0; }
    catch (e) { return 0; }
  }
  function incrementCount(prefix){
    try { localStorage.setItem(prefix + '-completions', String(getCount(prefix) + 1)); }
    catch (e) { /* mémoire indisponible */ }
  }
  function resetCount(prefix){
    try { localStorage.setItem(prefix + '-completions', '0'); }
    catch (e) { /* mémoire indisponible */ }
  }
  function getStreakGoal(prefix, def){
    try { var v = parseInt(localStorage.getItem(prefix + '-streak-goal'), 10); return v > 0 ? v : def; }
    catch (e) { return def; }
  }
  function getStreakProgress(prefix){
    try { return parseInt(localStorage.getItem(prefix + '-streak-progress'), 10) || 0; }
    catch (e) { return 0; }
  }
  function setStreakGoal(prefix, goal){
    try { localStorage.setItem(prefix + '-streak-goal', String(goal)); localStorage.setItem(prefix + '-streak-progress', '0'); }
    catch (e) { /* mémoire indisponible */ }
  }
  function recordStreakSuccess(prefix){
    var goal = getStreakGoal(prefix, 5);
    var progress = getStreakProgress(prefix) + 1;
    var leveledUp = false;
    if (progress >= GOAL_STEPS_TO_LEVEL_UP){ goal += 1; progress = 0; leveledUp = true; }
    try { localStorage.setItem(prefix + '-streak-goal', String(goal)); localStorage.setItem(prefix + '-streak-progress', String(progress)); }
    catch (e) { /* mémoire indisponible */ }
    return { goal: goal, progress: progress, leveledUp: leveledUp };
  }
  function getTimedDuration(prefix, def){
    try { var v = parseInt(localStorage.getItem(prefix + '-timed-duration'), 10); return v > 0 ? v : def; }
    catch (e) { return def; }
  }
  function setTimedDuration(prefix, sec){
    try { localStorage.setItem(prefix + '-timed-duration', String(sec)); }
    catch (e) { /* mémoire indisponible */ }
  }
  function loadAttempts(prefix){
    try { return JSON.parse(localStorage.getItem(prefix + '-attempts')) || []; }
    catch (e) { return []; }
  }
  function saveAttempts(prefix, list){
    try { localStorage.setItem(prefix + '-attempts', JSON.stringify(list.slice(-30))); }
    catch (e) { /* mémoire indisponible */ }
  }
  function recordAttempt(prefix, entry){
    var list = loadAttempts(prefix);
    list.push(entry);
    saveAttempts(prefix, list);
    return list;
  }
  function resetAttempts(prefix){ saveAttempts(prefix, []); }

  function modeLabel(level, m){
    var spec = LEVEL_SPECS[level];
    if (spec.goalMode === 'cumulative') return m === 'target' ? 'Objectif ' + spec.fixedGoal : 'Chrono ' + fmtMinutesShort(spec.fixedDuration);
    return m === 'target' ? 'Objectif' : 'Chrono';
  }
  function fmtMinutesShort(sec){
    var m = sec / 60;
    return (m % 1 === 0 ? m : m.toFixed(1)) + '′';
  }

  function rankRow(level, a, rank, isCurrent){
    var row = document.createElement('div');
    row.className = 'ranking-row' + (isCurrent ? ' current' : '');
    row.innerHTML =
      '<span class="ranking-rank">' + rank + '.</span>' +
      '<span class="ranking-score">' + a.score + ' bonne' + (a.score === 1 ? '' : 's') + ' réponse' + (a.score === 1 ? '' : 's') + '</span>' +
      '<span class="ranking-mode">' + modeLabel(level, a.mode) + ' · ' + fmtTime(a.timeSec) + '</span>';
    return row;
  }
  function renderRanking(level, allAttempts, current){
    var sorted = allAttempts.slice().sort(function(a, b){
      if (b.score !== a.score) return b.score - a.score;
      return a.timeSec - b.timeSec;
    });
    var rank = sorted.indexOf(current) + 1;
    var total = sorted.length;
    var listEl = document.getElementById('ranking-list');
    listEl.innerHTML = '';
    var top = sorted.slice(0, 5);
    top.forEach(function(a, i){ listEl.appendChild(rankRow(level, a, i + 1, a === current)); });
    if (top.indexOf(current) === -1){
      var sep = document.createElement('div');
      sep.className = 'ranking-sep';
      sep.textContent = '···';
      listEl.appendChild(sep);
      listEl.appendChild(rankRow(level, current, rank, true));
    }
    document.getElementById('ranking-note').textContent =
      'Cette tentative : ' + rank + (rank === 1 ? 're' : 'e') + ' sur ' + total + '.';
  }
  function errorRow(err){
    var row = document.createElement('div');
    row.className = 'error-row';
    row.innerHTML =
      '<span class="form">' + err.f + '</span>' +
      '<span class="swap">répondu : ' + err.given + ' — correct : ' + err.correct + '</span>';
    return row;
  }
  function renderAttemptErrors(entry){
    var block = document.getElementById('errors-block');
    var title = document.getElementById('errors-title');
    var list = document.getElementById('errors-list');
    list.innerHTML = '';
    block.hidden = false;
    if (!entry.errors.length){
      title.textContent = 'Erreurs de cette tentative';
      var ok = document.createElement('div');
      ok.className = 'errors-empty';
      ok.textContent = 'Aucune erreur — sans faute !';
      list.appendChild(ok);
      return;
    }
    title.textContent = 'Erreurs de cette tentative (' + entry.errors.length + ')';
    entry.errors.forEach(function(err){ list.appendChild(errorRow(err)); });
  }
  function fmtWhen(ts){
    if (!ts) return '';
    var d = new Date(ts);
    var pad = function(n){ return (n < 10 ? '0' : '') + n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function renderScoreTable(level){
    var host = document.getElementById('score-table');
    host.innerHTML = '';
    var prefix = LEVEL_SPECS[level].keyPrefix;
    var list = loadAttempts(prefix).slice().reverse();
    if (!list.length){
      var empty = document.createElement('div');
      empty.className = 'score-empty';
      empty.textContent = 'Aucune tentative enregistrée pour l’instant.';
      host.appendChild(empty);
      return;
    }
    list.forEach(function(entry){
      var errs = entry.errors || [];
      var row = document.createElement('div');
      row.className = 'score-row';
      var head = document.createElement('div');
      head.className = 'score-row-head';
      head.innerHTML =
        '<span class="when">' + fmtWhen(entry.ts) + '</span>' +
        '<span class="mode">' + modeLabel(level, entry.mode) + '</span>' +
        '<span class="score">' + entry.score + ' bonnes</span>' +
        '<span class="errcount ' + (errs.length ? 'some' : 'zero') + '">' + errs.length + ' erreur' + (errs.length === 1 ? '' : 's') + '</span>' +
        '<span class="when">' + fmtTime(entry.timeSec) + '</span>';
      row.appendChild(head);
      var detail = document.createElement('div');
      detail.className = 'score-row-detail';
      detail.hidden = true;
      if (errs.length){
        errs.forEach(function(err){ detail.appendChild(errorRow(err)); });
      } else {
        var ok = document.createElement('div');
        ok.className = 'errors-empty';
        ok.textContent = 'Sans faute !';
        detail.appendChild(ok);
      }
      row.appendChild(detail);
      row.addEventListener('click', function(){ detail.hidden = !detail.hidden; });
      host.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------
     Éléments DOM et machine d'état
  ------------------------------------------------------------------ */
  var el = {};
  ['wrap','site-title','site-tag','screen-menu','menu-intro','menu-legend','btn-settings',
   'mode-target-num','mode-target-title','mode-target-desc','mode-target-progress',
   'mode-timed-num','mode-timed-title','mode-timed-desc',
   'settings-overlay','setting-goal','setting-duration','btn-settings-cancel','btn-settings-save',
   'screen-quiz','stat-score','stat-score-label','stat-progress','stat-progress-label',
   'stat-timer','stat-timer-label','btn-quit',
   'prompt-eyebrow','prompt-main','prompt-sub','prompt-hint','answers','feedback',
   'screen-end','end-title','end-big','end-sub','ranking-list','ranking-note',
   'errors-block','errors-title','errors-list','btn-replay','btn-menu',
   'footer-credit','btn-teacher','btn-table','btn-worksheet',
   'teacher-overlay','teacher-count','btn-teacher-reset','btn-teacher-close',
   'table-overlay','score-table','btn-table-close'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  var currentLevel = 1;
  var state = null;
  var currentItem = null;
  var currentOptionButtons = [];
  var tenseButtons = {}, personButtons = {};

  function showScreen(name){
    el['screen-menu'].hidden = name !== 'menu';
    el['screen-quiz'].hidden = name !== 'quiz';
    el['screen-end'].hidden = name !== 'end';
    el.wrap.classList.toggle('is-quiz', name === 'quiz');
  }

  function renderModeCards(level){
    var spec = LEVEL_SPECS[level];
    if (spec.goalMode === 'cumulative'){
      el['mode-target-num'].textContent = spec.fixedGoal;
      el['mode-target-title'].textContent = spec.targetTitle;
      el['mode-target-desc'].textContent = spec.targetDesc;
      el['mode-target-progress'].textContent = '';
      el['mode-timed-num'].textContent = fmtMinutesShort(spec.fixedDuration);
      el['mode-timed-title'].textContent = spec.timedTitle;
      el['mode-timed-desc'].textContent = spec.timedDesc;
    } else {
      var goal = getStreakGoal(spec.keyPrefix, spec.defaultGoal);
      var progress = getStreakProgress(spec.keyPrefix);
      var duration = getTimedDuration(spec.keyPrefix, spec.defaultDuration);
      var minutes = duration / 60;
      var minutesLabel = (minutes % 1 === 0 ? minutes : minutes.toFixed(1)) + ' minute' + (minutes === 1 ? '' : 's');
      el['mode-target-num'].textContent = goal;
      el['mode-target-title'].textContent = 'Objectif ' + goal + ' de suite';
      el['mode-target-desc'].textContent = 'Réponds juste ' + goal + ' fois d’affilée. Une erreur relance la série à zéro. Le chronomètre tourne : vise le temps le plus court.';
      el['mode-target-progress'].textContent = 'Palier actuel : ' + progress + '/' + GOAL_STEPS_TO_LEVEL_UP + ' réussite(s) avant objectif ' + (goal + 1) + '.';
      el['mode-timed-num'].textContent = minutes % 1 === 0 ? minutes + '′' : minutes.toFixed(1) + '′';
      el['mode-timed-title'].textContent = 'Chrono ' + minutesLabel;
      el['mode-timed-desc'].textContent = 'Pendant ' + minutesLabel + ', vise la plus longue série de bonnes réponses d’affilée. Une erreur relance la série à zéro, le chrono continue.';
    }
  }

  function renderMenu(level){
    var spec = LEVEL_SPECS[level];
    el['site-tag'].textContent = spec.tag;
    el['menu-intro'].innerHTML = spec.intro;
    el['menu-legend'].innerHTML = spec.legend.join('');
    el['footer-credit'].textContent = 'D’après la fiche « Conjugaison 9H — Temps simples / temps composés » · ' + spec.credit;
    el['btn-settings'].hidden = !spec.hasSettings;
    renderModeCards(level);
    showScreen('menu');
  }

  function switchTab(level){
    if (state && state.timerId){ clearInterval(state.timerId); state.timerId = null; }
    state = null;
    currentLevel = level;
    tabButtons.forEach(function(btn){ btn.classList.toggle('is-active', parseInt(btn.dataset.level, 10) === level); });
    renderMenu(level);
  }

  function deckFor(level){
    if (level === 1) return VERBS_PAIR;
    if (level === 2) return VERBS_COMPOSE_SUJET;
    return QUESTIONS;
  }
  function nextDeckItem(){
    if (!state.deck.length || state.deckPos >= state.deck.length){
      state.deck = shuffle(deckFor(state.level));
      state.deckPos = 0;
    }
    var item = state.deck[state.deckPos];
    state.deckPos++;
    return item;
  }

  function startGame(mode){
    var spec = LEVEL_SPECS[currentLevel];
    state = {
      level: currentLevel, mode: mode,
      deck: shuffle(deckFor(currentLevel)), deckPos: 0,
      score: 0, attempts: 0, streak: 0, bestStreak: 0,
      goal: spec.goalMode === 'streak' ? getStreakGoal(spec.keyPrefix, spec.defaultGoal) : spec.fixedGoal,
      duration: spec.goalMode === 'streak' ? getTimedDuration(spec.keyPrefix, spec.defaultDuration) : spec.fixedDuration,
      errors: [], startTs: Date.now(), timerId: null, locked: false,
      selTense: null, selPerson: null
    };
    if (spec.goalMode === 'cumulative'){
      el['stat-score-label'].textContent = 'bonnes réponses';
      el['stat-progress-label'].textContent = mode === 'target' ? 'progression' : 'bonnes réponses';
    } else {
      el['stat-score-label'].textContent = 'série actuelle';
      el['stat-progress-label'].textContent = mode === 'target' ? 'objectif' : 'meilleure série';
    }
    el['stat-timer-label'].textContent = mode === 'target' ? 'temps écoulé' : 'temps restant';
    showScreen('quiz');
    tickTimer();
    state.timerId = setInterval(tickTimer, 250);
    nextQuestion();
  }

  function tickTimer(){
    if (!state) return;
    if (state.mode === 'target'){
      el['stat-timer'].textContent = fmtTime((Date.now() - state.startTs) / 1000);
    } else {
      var left = state.duration - (Date.now() - state.startTs) / 1000;
      if (left <= 0){ el['stat-timer'].textContent = '0:00'; endGame(); return; }
      el['stat-timer'].textContent = fmtTime(left);
    }
  }

  function updateStats(){
    var spec = LEVEL_SPECS[state.level];
    if (spec.goalMode === 'cumulative'){
      el['stat-score'].textContent = state.score;
      el['stat-progress'].textContent = state.mode === 'target'
        ? Math.min(state.score, state.goal) + ' / ' + state.goal
        : (state.attempts ? Math.round(100 * state.score / state.attempts) + ' %' : '—');
    } else {
      el['stat-score'].textContent = state.streak;
      el['stat-progress'].textContent = state.mode === 'target' ? (state.streak + ' / ' + state.goal) : state.bestStreak;
    }
  }

  function questionLabel(item){
    return item.inf + ', ' + item.tense + (item.person ? ' (' + item.person + ')' : '');
  }

  function clearAnswerButtons(){
    el.answers.innerHTML = '';
    tenseButtons = {}; personButtons = {}; currentOptionButtons = [];
  }

  function renderQuestion(){
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    clearAnswerButtons();
    state.locked = false;
    state.selTense = null; state.selPerson = null;
    currentItem = nextDeckItem();

    if (state.level === 1){
      el['prompt-eyebrow'].textContent = 'Quel est ce temps ?';
      el['prompt-main'].textContent = currentItem.f;
      el['prompt-sub'].textContent = '(' + currentItem.inf + ')';
      el['prompt-hint'].textContent = ' ';
      var grid1 = document.createElement('div'); grid1.className = 'tense-col-grid';
      [{title:'Temps simples', cls:'simple', tenses:SIMPLE_TENSES}, {title:'Temps composés', cls:'compose', tenses:COMPOSE_TENSES}]
        .forEach(function(group){
          var col = document.createElement('div'); col.className = 'tense-col-wrap';
          var label = document.createElement('div'); label.className = 'tense-col-label ' + group.cls; label.textContent = group.title;
          col.appendChild(label);
          var list = document.createElement('div'); list.className = 'tense-col';
          group.tenses.forEach(function(tense){
            var b = document.createElement('button');
            b.className = 'tense-btn ' + group.cls + '-side';
            b.textContent = tense;
            b.addEventListener('click', function(){ answerLevel1(tense, b); });
            tenseButtons[tense] = b;
            list.appendChild(b);
          });
          col.appendChild(list);
          grid1.appendChild(col);
        });
      el.answers.appendChild(grid1);

    } else if (state.level === 2){
      el['prompt-eyebrow'].textContent = 'Quel est ce temps ? (et son sujet, si besoin)';
      el['prompt-main'].textContent = currentItem.f;
      el['prompt-sub'].textContent = '(' + currentItem.inf + ')';
      el['prompt-hint'].textContent = currentItem.needsPerson ? 'Le sujet est masqué : choisis aussi la personne à droite.' : ' ';
      var dual = document.createElement('div'); dual.className = 'dual-grid';
      var colT = document.createElement('div');
      colT.innerHTML = '<div class="col-label">Le temps</div>';
      var listT = document.createElement('div'); listT.className = 'tense-col';
      COMPOSE_TENSES.forEach(function(tense){
        var b = document.createElement('button'); b.className = 'tense-btn'; b.textContent = tense;
        b.addEventListener('click', function(){ selectTense(tense); });
        tenseButtons[tense] = b;
        listT.appendChild(b);
      });
      colT.appendChild(listT);
      var colP = document.createElement('div');
      colP.className = currentItem.needsPerson ? '' : 'col-disabled';
      colP.innerHTML = '<div class="col-label">' + (currentItem.needsPerson ? 'Le sujet' : 'Le sujet (non demandé ici)') + '</div>';
      var listP = document.createElement('div'); listP.className = 'tense-col';
      PERSONS.forEach(function(person){
        var b = document.createElement('button'); b.className = 'tense-btn person-btn'; b.textContent = person;
        b.addEventListener('click', function(){ selectPerson(person); });
        personButtons[person] = b;
        listP.appendChild(b);
      });
      colP.appendChild(listP);
      dual.appendChild(colT); dual.appendChild(colP);
      el.answers.appendChild(dual);

    } else if (state.level === 3){
      el['prompt-eyebrow'].textContent = 'Quelle est la bonne forme ?';
      el['prompt-main'].textContent = capitalize(currentItem.inf) + ' — ' + currentItem.tense;
      el['prompt-sub'].textContent = currentItem.person ? 'sujet : ' + currentItem.person : ' ';
      el['prompt-hint'].textContent = ' ';
      var optionsGrid = document.createElement('div'); optionsGrid.className = 'options-grid';
      var options = shuffle([currentItem.correct].concat(currentItem.distractors));
      currentOptionButtons = options.map(function(text){
        var btn = document.createElement('button'); btn.className = 'option-btn'; btn.textContent = text;
        btn.addEventListener('click', function(){ answerLevel3(text, btn); });
        optionsGrid.appendChild(btn);
        return btn;
      });
      el.answers.appendChild(optionsGrid);

    } else {
      el['prompt-eyebrow'].textContent = 'Tape la bonne forme';
      el['prompt-main'].textContent = capitalize(currentItem.inf) + ' — ' + currentItem.tense;
      el['prompt-sub'].textContent = currentItem.person ? 'sujet : ' + currentItem.person : ' ';
      el['prompt-hint'].textContent = ' ';
      var row = document.createElement('div'); row.className = 'answer-row';
      var input = document.createElement('input'); input.type = 'text'; input.className = 'answer-input';
      input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
      input.placeholder = 'Écris ta réponse ici…';
      var submit = document.createElement('button'); submit.className = 'answer-submit'; submit.textContent = 'Valider';
      function send(){ answerLevel4(input.value, input, submit); }
      submit.addEventListener('click', send);
      input.addEventListener('keydown', function(ev){ if (ev.key === 'Enter'){ ev.preventDefault(); send(); } });
      row.appendChild(input); row.appendChild(submit);
      el.answers.appendChild(row);
      input.focus();
    }
    updateStats();
  }

  function nextQuestion(){ renderQuestion(); }

  function finishAnswer(correct, errorEntry){
    state.attempts++;
    var spec = LEVEL_SPECS[state.level];
    if (correct){
      state.score++;
      if (spec.goalMode === 'streak'){ state.streak++; if (state.streak > state.bestStreak) state.bestStreak = state.streak; }
    } else {
      state.errors.push(errorEntry);
      if (spec.goalMode === 'streak') state.streak = 0;
    }
    updateStats();
    var done = spec.goalMode === 'cumulative'
      ? (state.mode === 'target' && state.score >= state.goal)
      : (state.mode === 'target' && state.streak >= state.goal);
    setTimeout(function(){ if (done) endGame(); else nextQuestion(); }, correct ? 650 : 1400);
  }

  /* ---- Niveau 1 : un seul bouton (le temps) ---- */
  function answerLevel1(tense, btnEl){
    if (!state || state.locked) return;
    state.locked = true;
    var correct = tense === currentItem.t;
    Object.keys(tenseButtons).forEach(function(k){ tenseButtons[k].disabled = true; });
    btnEl.classList.add(correct ? 'is-correct' : 'is-wrong');
    if (!correct) tenseButtons[currentItem.t].classList.add('is-correct');
    el.feedback.textContent = correct ? 'Bonne réponse !' : 'C’était : ' + currentItem.t;
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    finishAnswer(correct, { f: currentItem.f, correct: currentItem.t, given: tense });
  }

  /* ---- Niveau 2 : deux boutons (le temps, puis le sujet si besoin) ---- */
  function selectTense(tense){
    if (!state || state.locked) return;
    state.selTense = tense;
    Object.keys(tenseButtons).forEach(function(k){ tenseButtons[k].classList.toggle('is-selected', k === tense); });
    maybeEvaluateLevel2();
  }
  function selectPerson(person){
    if (!state || state.locked || !currentItem.needsPerson) return;
    state.selPerson = person;
    Object.keys(personButtons).forEach(function(k){ personButtons[k].classList.toggle('is-selected', k === person); });
    maybeEvaluateLevel2();
  }
  function maybeEvaluateLevel2(){
    if (state.selTense == null) return;
    if (currentItem.needsPerson && state.selPerson == null) return;
    evaluateLevel2();
  }
  function evaluateLevel2(){
    state.locked = true;
    var tenseOk = state.selTense === currentItem.t;
    var personOk = !currentItem.needsPerson || currentItem.personAccept.indexOf(state.selPerson) !== -1;
    var correct = tenseOk && personOk;
    var correctPersonLabel = currentItem.needsPerson ? currentItem.personAccept.join(' ou ') : '';
    var correctLabel = currentItem.needsPerson ? (correctPersonLabel + ' · ' + currentItem.t) : currentItem.t;
    var givenLabel = currentItem.needsPerson ? ((state.selPerson || '?') + ' · ' + state.selTense) : state.selTense;

    Object.keys(tenseButtons).forEach(function(k){ tenseButtons[k].disabled = true; });
    tenseButtons[state.selTense].classList.add(tenseOk ? 'is-correct' : 'is-wrong');
    if (!tenseOk) tenseButtons[currentItem.t].classList.add('is-correct');
    if (currentItem.needsPerson){
      Object.keys(personButtons).forEach(function(k){ personButtons[k].disabled = true; });
      personButtons[state.selPerson].classList.add(personOk ? 'is-correct' : 'is-wrong');
      if (!personOk) currentItem.personAccept.forEach(function(p){ personButtons[p].classList.add('is-correct'); });
    }
    el.feedback.textContent = correct ? 'Bonne réponse !' : 'C’était : ' + correctLabel;
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    finishAnswer(correct, { f: currentItem.f, correct: correctLabel, given: givenLabel });
  }

  /* ---- Niveau 3 : QCM ---- */
  function answerLevel3(given, btnEl){
    if (!state || state.locked) return;
    state.locked = true;
    var correct = given === currentItem.correct;
    currentOptionButtons.forEach(function(btn){
      btn.disabled = true;
      if (btn.textContent === currentItem.correct) btn.classList.add('is-correct');
    });
    if (!correct) btnEl.classList.add('is-wrong');
    el.feedback.textContent = correct ? 'Bonne réponse !' : 'C’était : ' + currentItem.correct;
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    finishAnswer(correct, { f: questionLabel(currentItem), correct: currentItem.correct, given: given });
  }

  /* ---- Niveau 4 : réponse libre ---- */
  function answerLevel4(given, inputEl, submitEl){
    if (!state || state.locked) return;
    if (!normSpace(given)) return;
    state.locked = true;
    var grade = gradeAnswer(given, currentItem.correct);
    var correct = grade !== 'wrong';
    inputEl.disabled = true; submitEl.disabled = true;
    inputEl.classList.add(correct ? 'is-correct' : 'is-wrong');
    el.feedback.textContent = correct
      ? (grade === 'typo' ? 'Bonne réponse ! (accent à revoir : ' + currentItem.correct + ')' : 'Bonne réponse !')
      : 'C’était : ' + currentItem.correct;
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    finishAnswer(correct, { f: questionLabel(currentItem), correct: currentItem.correct, given: given });
  }

  function endGame(){
    if (state.timerId){ clearInterval(state.timerId); state.timerId = null; }
    var level = state.level, spec = LEVEL_SPECS[level];
    incrementCount(spec.keyPrefix);
    var elapsed = (Date.now() - state.startTs) / 1000;
    var entryScore;

    if (spec.goalMode === 'cumulative'){
      if (state.mode === 'target'){
        entryScore = state.score;
        el['end-title'].textContent = 'Objectif atteint';
        el['end-big'].textContent = fmtTime(elapsed);
        var pct = state.attempts ? Math.round(100 * state.score / state.attempts) : 100;
        el['end-sub'].textContent = state.goal + ' bonnes réponses sur ' + state.attempts + ' essais (' + pct + ' % de réussite)';
      } else {
        entryScore = state.score;
        el['end-title'].textContent = 'Temps écoulé';
        el['end-big'].textContent = state.score;
        var pct2 = state.attempts ? Math.round(100 * state.score / state.attempts) : 0;
        el['end-sub'].textContent = 'bonnes réponses en ' + fmtMinutesShort(state.duration) + ', sur ' + state.attempts + ' essais (' + pct2 + ' % de réussite)';
      }
    } else {
      if (state.mode === 'target'){
        var levelUp = recordStreakSuccess(spec.keyPrefix);
        entryScore = state.goal;
        el['end-title'].textContent = 'Objectif atteint';
        el['end-big'].textContent = fmtTime(elapsed);
        var pct3 = state.attempts ? Math.round(100 * state.score / state.attempts) : 100;
        var sub = state.goal + ' bonnes réponses d’affilée sur ' + state.attempts + ' essais (' + pct3 + ' % de réussite)';
        sub += levelUp.leveledUp ? (' — objectif augmenté à ' + levelUp.goal + ' de suite !') : (' — palier ' + levelUp.progress + '/' + GOAL_STEPS_TO_LEVEL_UP + ' avant objectif ' + levelUp.goal + '+1');
        el['end-sub'].textContent = sub;
      } else {
        entryScore = state.bestStreak;
        el['end-title'].textContent = 'Temps écoulé';
        el['end-big'].textContent = state.bestStreak;
        var pct4 = state.attempts ? Math.round(100 * state.score / state.attempts) : 0;
        el['end-sub'].textContent = 'meilleure série de bonnes réponses d’affilée en ' + fmtTime(state.duration) +
          ' (' + state.score + ' bonnes réponses au total sur ' + state.attempts + ' essais, ' + pct4 + ' % de réussite)';
      }
    }

    var entry = { score: entryScore, timeSec: Math.round(elapsed), mode: state.mode, errors: state.errors.slice(), ts: Date.now() };
    var allAttempts = recordAttempt(spec.keyPrefix, entry);
    renderRanking(level, allAttempts, entry);
    renderAttemptErrors(entry);
    renderModeCards(level);
    showScreen('end');
  }

  function quitToMenu(){
    if (state && state.timerId){ clearInterval(state.timerId); state.timerId = null; }
    state = null;
    renderModeCards(currentLevel);
    showScreen('menu');
  }

  /* ------------------------------------------------------------------
     Feuille d'auto-interrogation téléchargeable (PDF, 20 questions,
     table vierge + corrigé) — mécanique reprise telle quelle de
     « Révision par planning » (construction manuelle du PDF).
  ------------------------------------------------------------------ */
  var PDF_GLYPH_WIDTHS = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];

  function pdfTextWidth(s, size){
    var total = 0;
    for (var i = 0; i < s.length; i++){
      var ch = s.charAt(i).normalize('NFD').charAt(0);
      var code = ch.charCodeAt(0);
      total += (code >= 32 && code <= 126) ? PDF_GLYPH_WIDTHS[code - 32] : 556;
    }
    return total * size / 1000;
  }
  function pdfEscape(s){
    var out = '';
    for (var i = 0; i < s.length; i++){
      var ch = s.charAt(i), code = ch.charCodeAt(0);
      if (code === 0x2019 || code === 0x2018) ch = "'";
      else if (code > 255) ch = '?';
      if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch; else out += ch;
    }
    return out;
  }
  function wrapPdfText(s, size, maxWidth){
    var words = s.split(' '), lines = [], current = '';
    words.forEach(function(word){
      var candidate = current ? current + ' ' + word : word;
      if (pdfTextWidth(candidate, size) > maxWidth && current){ lines.push(current); current = word; }
      else current = candidate;
    });
    if (current) lines.push(current);
    return lines;
  }
  function makePdfPage(pageH){
    var ops = [];
    function num(x){ return (Math.round(x * 100) / 100).toString(); }
    return {
      ops: ops,
      line: function(x1, y1, x2, y2, w){ ops.push(num(w || 0.8) + ' w ' + num(x1) + ' ' + num(pageH - y1) + ' m ' + num(x2) + ' ' + num(pageH - y2) + ' l S'); },
      rect: function(x, y, w, h){ ops.push('0.8 w ' + num(x) + ' ' + num(pageH - y - h) + ' ' + num(w) + ' ' + num(h) + ' re S'); },
      text: function(s, x, y, size, bold){ ops.push('BT 0 0 0 rg /' + (bold ? 'F3' : 'F1') + ' ' + num(size) + ' Tf ' + num(x) + ' ' + num(pageH - y) + ' Td (' + pdfEscape(s) + ') Tj ET'); },
      ctext: function(s, cx, y, size, bold){
        var w = pdfTextWidth(s, size);
        ops.push('BT 0 0 0 rg /' + (bold ? 'F3' : 'F1') + ' ' + num(size) + ' Tf ' + num(cx - w / 2) + ' ' + num(pageH - y) + ' Td (' + pdfEscape(s) + ') Tj ET');
      }
    };
  }
  function buildWorksheetTablePage(opts){
    var margin = 40, pw = makePdfPage(opts.pageH);
    var y = margin + 20;
    pw.ctext(opts.title, opts.pageW / 2, y, 15, true); y += 22;
    if (opts.subtitle){ pw.ctext(opts.subtitle, opts.pageW / 2, y, 9.5); y += 18; }
    y += 18;
    var tableTop = y, headH = 20;
    var footerLineCount = 0;
    if (opts.footerLines) opts.footerLines.forEach(function(line){ footerLineCount += wrapPdfText(line, 10, opts.pageW - margin * 2).length; });
    var footerHeight = footerLineCount * 14 + (opts.scoreOutOf != null ? 14 : 0);
    var gapBeforeFooter = 26;
    var available = opts.pageH - margin - footerHeight - gapBeforeFooter - tableTop - headH;
    var rowH = opts.rows.length ? Math.floor(available / opts.rows.length) : available;
    rowH = Math.max(20, Math.min(90, rowH));
    var tableWidth = opts.columns.reduce(function(sum, c){ return sum + c.width; }, 0);
    var tableHeight = headH + rowH * opts.rows.length;
    pw.rect(margin, tableTop, tableWidth, tableHeight);
    pw.line(margin, tableTop + headH, margin + tableWidth, tableTop + headH);
    var colX = margin;
    opts.columns.forEach(function(col, i){
      if (i > 0) pw.line(colX, tableTop, colX, tableTop + tableHeight);
      pw.text(col.label, colX + 6, tableTop + 14, 10, true);
      colX += col.width;
    });
    var textBaseline = Math.min(rowH - 6, rowH / 2 + 4);
    opts.rows.forEach(function(row, r){
      var rowY = tableTop + headH + rowH * r;
      if (r > 0) pw.line(margin, rowY, margin + tableWidth, rowY);
      var cx = margin;
      opts.columns.forEach(function(col, i){
        var value = String(row[i] == null ? '' : row[i]);
        if (value){
          var size = 9.5;
          while (size > 6.5 && pdfTextWidth(value, size) > col.width - 10) size -= 0.5;
          pw.text(value, cx + 6, rowY + textBaseline, size);
        }
        cx += col.width;
      });
    });
    y = tableTop + tableHeight + gapBeforeFooter;
    if (opts.footerLines) opts.footerLines.forEach(function(line){
      wrapPdfText(line, 10, opts.pageW - margin * 2).forEach(function(wrapped){ pw.text(wrapped, margin, y, 10); y += 14; });
    });
    if (opts.scoreOutOf != null){ pw.text('Score : _______ / ' + opts.scoreOutOf, margin, y, 10); }
    return pw.ops.join('\n');
  }
  function buildWorksheetPdf(seriesNum, questions){
    var pageW = 595, pageH = 842;
    var columns = [
      {label:'N°', width:30},
      {label:'Verbe', width:70},
      {label:'Temps', width:150},
      {label:'Sujet', width:58},
      {label:'Ta réponse', width:pageW - 80 - 30 - 70 - 150 - 58}
    ];
    var blankRows = questions.map(function(q, i){ return [String(i + 1), q.inf, q.tense, q.person || '-', '']; });
    var page1 = buildWorksheetTablePage({
      pageW:pageW, pageH:pageH,
      title: 'Avoir & être - Auto-interrogation',
      subtitle: 'Conjugaison 9H · tous temps de l’indicatif · réponse écrite (série ' + seriesNum + ')',
      columns: columns, rows: blankRows,
      footerLines: ['Nom : ______________________________________________   Date : ________________'],
      scoreOutOf: questions.length
    });
    var answerColumns = columns.slice(0, 4).concat([{label:'Réponse', width:columns[4].width}]);
    var answerRows = questions.map(function(q, i){ return [String(i + 1), q.inf, q.tense, q.person || '-', q.correct]; });
    var page2 = buildWorksheetTablePage({
      pageW:pageW, pageH:pageH,
      title: 'Corrigé - Avoir & être',
      subtitle: 'Mêmes ' + questions.length + ' questions, avec la réponse attendue.',
      columns: answerColumns, rows: answerRows,
      footerLines: ['Questions tirées de l’exercice en ligne « Avoir & Être, tous niveaux » (ordre mélangé).']
    });
    var objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /Font << /F1 7 0 R /F3 8 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /Font << /F1 7 0 R /F3 8 0 R >> >> /Contents 6 0 R >>',
      '<< /Length ' + page1.length + ' >>\nstream\n' + page1 + '\nendstream',
      '<< /Length ' + page2.length + ' >>\nstream\n' + page2 + '\nendstream',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ];
    var out = '%PDF-1.4\n', offsets = [];
    objs.forEach(function(o, i){ offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xrefStart = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach(function(o){ out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }
  function nextWorksheetSeriesNumber(){
    var key = appId + '.feuille.compteur';
    var next = 1;
    try { next = (parseInt(localStorage.getItem(key), 10) || 0) + 1; localStorage.setItem(key, String(next)); }
    catch (error) { /* mémoire indisponible */ }
    return next;
  }
  function downloadWorksheet(){
    var questions = shuffle(QUESTIONS);
    var seriesNum = nextWorksheetSeriesNumber();
    var bytes = buildWorksheetPdf(seriesNum, questions);
    var blob = new Blob([bytes], {type:'application/pdf'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'avoir-etre-auto-interrogation-serie' + seriesNum + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }

  /* ---------- Câblage des évènements ---------- */
  tabButtons.forEach(function(btn){
    btn.addEventListener('click', function(){ switchTab(parseInt(btn.dataset.level, 10)); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.mode-card'), function(cardEl){
    cardEl.addEventListener('click', function(){ startGame(this.dataset.mode); });
  });
  el['btn-quit'].addEventListener('click', quitToMenu);
  el['btn-menu'].addEventListener('click', quitToMenu);
  el['btn-replay'].addEventListener('click', function(){ startGame(state ? state.mode : 'target'); });

  el['btn-teacher'].addEventListener('click', function(){
    el['teacher-count'].textContent = getCount(LEVEL_SPECS[currentLevel].keyPrefix);
    el['teacher-overlay'].hidden = false;
  });
  el['btn-teacher-close'].addEventListener('click', function(){ el['teacher-overlay'].hidden = true; });
  el['btn-teacher-reset'].addEventListener('click', function(){
    var prefix = LEVEL_SPECS[currentLevel].keyPrefix;
    resetCount(prefix); resetAttempts(prefix);
    el['teacher-count'].textContent = '0';
    renderScoreTable(currentLevel);
  });
  el['btn-table'].addEventListener('click', function(){ renderScoreTable(currentLevel); el['table-overlay'].hidden = false; });
  el['btn-table-close'].addEventListener('click', function(){ el['table-overlay'].hidden = true; });

  el['btn-settings'].addEventListener('click', function(){
    var spec = LEVEL_SPECS[currentLevel];
    el['setting-goal'].value = getStreakGoal(spec.keyPrefix, spec.defaultGoal);
    el['setting-duration'].value = getTimedDuration(spec.keyPrefix, spec.defaultDuration) / 60;
    el['settings-overlay'].hidden = false;
  });
  el['btn-settings-cancel'].addEventListener('click', function(){ el['settings-overlay'].hidden = true; });
  el['btn-settings-save'].addEventListener('click', function(){
    var spec = LEVEL_SPECS[currentLevel];
    var goal = parseInt(el['setting-goal'].value, 10);
    var minutes = parseFloat(el['setting-duration'].value);
    if (goal >= 3 && goal <= 30) setStreakGoal(spec.keyPrefix, goal);
    if (minutes >= 1 && minutes <= 10) setTimedDuration(spec.keyPrefix, Math.round(minutes * 60));
    renderModeCards(currentLevel);
    el['settings-overlay'].hidden = true;
  });

  el['btn-worksheet'].addEventListener('click', downloadWorksheet);

  switchTab(1);
})();
