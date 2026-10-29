(function(){
  'use strict';

  var ownScriptUrl = new URL(document.currentScript.src, window.location.href);
  var dataUrl = new URL(ownScriptUrl.href);
  dataUrl.hash = '';
  dataUrl.search = '';
  dataUrl.pathname = dataUrl.pathname.replace(/\.js$/i, '.json');
  var appId = decodeURIComponent(ownScriptUrl.pathname.split('/').pop()).replace(/\.js$/i, '');
  var dataStorageKey = 'donnees-locales:' + appId + ':' + decodeURIComponent(dataUrl.pathname.split('/').pop()) + ':v1';
  var isLocalFile = window.location.protocol === 'file:';
  var data = null;
  var currentLevel = 1;
  var state = null;
  var currentQuestion = null;
  var answerLocked = false;

  /* ---- planning : date sélectionnée et son périmètre ---- */
  var selectedDate = null;       // entrée de data.planning actuellement choisie
  var scopedPairs = [];          // [{verbe, tense}] couvert par cette date
  var scopedTensesByVerb = {};   // {verbe: [tense,...]} pour cette date

  var el = {};
  [
    'load-status','application','quiz-controls','screen-planning','screen-menu','screen-quiz','screen-end','level-help',
    'planning-list','planning-current','change-planning','reload-json','download-worksheet',
    'challenge-num','challenge-title','challenge-description','work-num','work-title','work-description',
    'open-settings','open-history','stat-score','stat-score-label','stat-progress','stat-progress-label',
    'stat-time','stat-time-label','quit-game','prompt-eyebrow','prompt-main','prompt-sub','answers','feedback',
    'end-title','end-big','end-sub','session-errors','replay','back-menu','settings-overlay','settings-level',
    'setting-goal','setting-duration','setting-anti-cheat','cancel-settings','save-settings','history-overlay','history-level',
    'history-list','clear-history','close-history'
  ].forEach(function(id){ el[id] = document.getElementById(id); });
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));

  function jsonFromXhr(url){
    return new Promise(function(resolve, reject){
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function(){
          if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)){
            try { resolve(JSON.parse(xhr.responseText)); }
            catch (error) { reject(error); }
          } else reject(new Error('Réponse JSON ' + xhr.status));
        };
        xhr.onerror = function(){ reject(new Error('Lecture locale du JSON refusée')); };
        xhr.send();
      } catch (error) { reject(error); }
    });
  }

  function loadData(){
    if (isLocalFile) {
      try {
        var cached = JSON.parse(localStorage.getItem(dataStorageKey) || 'null');
        validateData(cached);
        return Promise.resolve(cached);
      } catch (error) {
        return Promise.reject(new Error('Aucune copie locale valide n’est encore mémorisée'));
      }
    }
    return fetch(dataUrl.href, {cache:'no-store'})
      .then(function(response){ if (!response.ok) throw new Error('Réponse JSON ' + response.status); return response.json(); })
      .catch(function(){ return jsonFromXhr(dataUrl.href); });
  }

  function validateData(value){
    if (!value || !value.verbs || !value.persons || !value.tenseGroups || !Array.isArray(value.planning)){
      throw new Error('Structure du JSON incomplète (verbs/persons/tenseGroups/planning attendus)');
    }
    if (!value.planning.length) throw new Error('Le planning ne contient aucune date');
    value.planning.forEach(function(entry){
      if (!entry.date || !Array.isArray(entry.entries) || !entry.entries.length){
        throw new Error('Entrée de planning invalide : ' + JSON.stringify(entry).slice(0,80));
      }
      entry.entries.forEach(function(ve){
        var verb = value.verbs[ve.verbe];
        if (!verb) throw new Error('Planning : verbe inconnu « ' + ve.verbe + ' » (' + entry.date + ')');
        if (!Array.isArray(ve.temps) || !ve.temps.length) throw new Error('Planning : aucun temps pour ' + ve.verbe + ' (' + entry.date + ')');
        ve.temps.forEach(function(tense){
          var forms = verb.forms[tense];
          if (!Array.isArray(forms) || !forms.length) throw new Error('Conjugaison manquante : ' + ve.verbe + ' / ' + tense + ' (' + entry.date + ')');
          var expected = tense.indexOf('infinitif') === 0 ? 1 : value.persons.length;
          if (forms.length !== expected) throw new Error('Nombre de formes incorrect : ' + ve.verbe + ' / ' + tense);
        });
      });
    });
  }

  function rememberLocalData(value){
    try { localStorage.setItem(dataStorageKey, JSON.stringify(value)); return true; }
    catch (error) { return false; }
  }

  function setLocalStatus(message, isError){
    var status = document.getElementById('local-data-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', Boolean(isError));
  }

  function initializeData(value){
    validateData(value);
    data = value;
    state = null;
    currentQuestion = null;
    el['load-status'].hidden = true;
    el['load-status'].classList.remove('error');
    var loaderPanel = document.getElementById('local-data-loader');
    if (loaderPanel) loaderPanel.hidden = true; // masqué dès que le JSON est disponible
    el.application.hidden = false;
    renderPlanningList();
    var remembered = null;
    try { remembered = localStorage.getItem(appId + '.planning.lastDate'); } catch (error) { /* ignore */ }
    var fromHash = (window.location.hash.match(/date-([^&]+)/i) || [])[1];
    var wanted = fromHash ? decodeURIComponent(fromHash) : remembered;
    var entry = wanted && data.planning.filter(function(p){ return p.date === wanted; })[0];
    if (entry) selectPlanningDate(entry, false); else showScreen('planning');
  }

  function readLocalDataFile(file){
    var reader = new FileReader();
    reader.onload = function(){
      try {
        var value = JSON.parse(reader.result);
        validateData(value);
        rememberLocalData(value);
        initializeData(value); // masque le panneau : le changement d'écran confirme la réussite
      } catch (error) {
        setLocalStatus('Fichier refusé : ' + error.message + '. La dernière copie valide est conservée.', true);
      }
    };
    reader.onerror = function(){ setLocalStatus('Le fichier sélectionné n’a pas pu être lu.', true); };
    reader.readAsText(file, 'utf-8');
  }

  function setupLocalDataLoader(){
    if (!isLocalFile) return;
    var input = document.getElementById('local-data-file');
    input.addEventListener('change', function(){
      if (input.files[0]) readLocalDataFile(input.files[0]);
      input.value = '';
    });
    // bouton discret pour recharger un JSON modifié même quand une copie est déjà disponible
    if (el['reload-json']){
      el['reload-json'].hidden = false;
      el['reload-json'].addEventListener('click', function(){
        var panel = document.getElementById('local-data-loader');
        panel.hidden = false;
        setLocalStatus('Choisis le fichier ' + decodeURIComponent(dataUrl.pathname.split('/').pop()) + ' mis à jour.', false);
      });
    }
  }

  /* ---------- Formes à alternatives (ex. "je paie|je paye") ---------- */
  function altsOf(raw){ return String(raw).split('|'); }
  function canonical(raw){ return altsOf(raw)[0]; }

  function allTenses(){ return data.tenseGroups.simple.concat(data.tenseGroups.compound); }
  function shuffle(items){
    var out = items.slice();
    for (var i = out.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var hold = out[i]; out[i] = out[j]; out[j] = hold;
    }
    return out;
  }
  function formatTime(seconds){
    seconds = Math.max(0, Math.round(seconds));
    var minutes = Math.floor(seconds / 60), rest = seconds % 60;
    return minutes + ':' + (rest < 10 ? '0' : '') + rest;
  }
  function formatMinutes(seconds){
    var minutes = seconds / 60;
    return (minutes % 1 === 0 ? minutes : minutes.toFixed(1)) + ' minute' + (minutes === 1 ? '' : 's');
  }
  function normalize(value){
    return String(value || '').trim().toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');
  }
  function withoutTypography(value){
    var normalized = normalize(value).replace(/'/g, '');
    return normalized.normalize ? normalized.normalize('NFD').replace(/[̀-ͯ]/g, '') : normalized;
  }
  function gradeFreeAnswer(given, alts){
    var exact = alts.some(function(alt){ return normalize(given) === normalize(alt); });
    if (exact) return 'exact';
    var loose = alts.some(function(alt){ return withoutTypography(given) === withoutTypography(alt); });
    if (loose) return 'typography';
    return 'wrong';
  }
  function matchesAnyAlt(given, alts){ return alts.some(function(alt){ return normalize(given) === normalize(alt); }); }
  function capitalize(value){ return value.charAt(0).toUpperCase() + value.slice(1); }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  /* ---------- Écran « choisir une date » ---------- */
  function dateSortKey(dateStr){
    // format "jour.mois" ; année scolaire commençant en septembre
    var parts = String(dateStr).split('.');
    var day = Number(parts[0]) || 0, month = Number(parts[1]) || 0;
    var rank = month >= 9 ? month - 9 : month + 3; // sept=0 ... juin=9
    return rank * 100 + day;
  }
  function sortedPlanning(){
    return data.planning.slice().sort(function(a, b){ return dateSortKey(a.date) - dateSortKey(b.date); });
  }
  function renderPlanningList(){
    var list = el['planning-list']; list.innerHTML = '';
    sortedPlanning().forEach(function(entry){
      var card = document.createElement('button');
      card.type = 'button'; card.className = 'planning-card';
      var verbNames = entry.entries.map(function(ve){ return ve.verbe; }).join(', ');
      card.innerHTML = '<strong>' + escapeHtml(entry.label || entry.date) + '</strong><span>' + escapeHtml(verbNames) + '</span>';
      card.addEventListener('click', function(){ selectPlanningDate(entry, true); });
      list.appendChild(card);
    });
  }
  function selectPlanningDate(entry, updateHash){
    selectedDate = entry;
    scopedPairs = [];
    scopedTensesByVerb = {};
    entry.entries.forEach(function(ve){
      scopedTensesByVerb[ve.verbe] = ve.temps.slice();
      ve.temps.forEach(function(tense){ scopedPairs.push({verbe: ve.verbe, tense: tense}); });
    });
    try { localStorage.setItem(appId + '.planning.lastDate', entry.date); } catch (error) { /* ignore */ }
    if (updateHash) window.location.hash = 'date-' + encodeURIComponent(entry.date);
    questionPool = buildQuestionPool();
    var verbNames = entry.entries.map(function(ve){ return ve.verbe; }).join(', ');
    el['planning-current'].textContent = (entry.label || entry.date) + ' — ' + verbNames;
    var match = window.location.hash.match(/niveau-([123])/i);
    activateLevel(match ? Number(match[1]) : currentLevel, false);
  }

  /* ---------- Construction du pool de questions (limité à la date choisie) ---------- */
  function buildQuestionPool(){
    var pool = [];
    scopedPairs.forEach(function(pair){
      var forms = data.verbs[pair.verbe].forms[pair.tense];
      forms.forEach(function(raw, index){
        pool.push({
          verb: pair.verbe,
          tense: pair.tense,
          person: pair.tense.indexOf('infinitif') === 0 ? '' : data.persons[index],
          personIndex: pair.tense.indexOf('infinitif') === 0 ? 0 : index,
          form: canonical(raw),
          alts: altsOf(raw)
        });
      });
    });
    return pool;
  }
  var questionPool = [];

  function matchingTenses(question){
    var result = [];
    (scopedTensesByVerb[question.verb] || []).forEach(function(tense){
      var forms = data.verbs[question.verb].forms[tense];
      if (forms && forms.some(function(raw){ return normalize(canonical(raw)) === normalize(question.form); })) result.push(tense);
    });
    return result;
  }

  function questionIdentity(item, level){
    return level + '|' + item.verb + '|' + item.tense + '|' + item.personIndex;
  }

  function randomMainQuestion(level){
    var recent = (state && state.recentKeys) || [];
    var pool = questionPool;
    if (recent.length && pool.length > recent.length){
      var filtered = pool.filter(function(item){ return recent.indexOf(questionIdentity(item, level)) === -1; });
      if (filtered.length) pool = filtered;
    }
    var candidate = pool[Math.floor(Math.random() * pool.length)];
    var question = Object.assign({}, candidate);
    question.level = level;
    question.acceptedTenses = level === 1 ? matchingTenses(question) : [question.tense];
    question.ambiguityKey = question.verb + '|' + normalize(question.form);
    question.reviewKey = level + '|' + question.verb + '|' + (level === 1 ? normalize(question.form) : question.tense);
    question.identityKey = questionIdentity(candidate, level);
    return question;
  }

  function randomForVerbTense(verb, tense, level){
    var candidates = questionPool.filter(function(item){ return item.verb === verb && item.tense === tense; });
    var picked = candidates[Math.floor(Math.random() * candidates.length)];
    var chosen = Object.assign({}, picked);
    chosen.level = level;
    chosen.acceptedTenses = level === 1 ? matchingTenses(chosen) : [tense];
    chosen.ambiguityKey = chosen.verb + '|' + normalize(chosen.form);
    chosen.reviewKey = level + '|' + verb + '|' + (level === 1 ? normalize(chosen.form) : tense);
    chosen.identityKey = questionIdentity(picked, level);
    return chosen;
  }

  function scheduleReview(question){
    var existing = state.reviewQueue.filter(function(item){ return item.key === question.reviewKey; })[0];
    if (existing){
      existing.dueAt = state.questionIndex + data.settings.reviewInterval;
      existing.source = Object.assign({}, question);
      return;
    }
    state.reviewQueue.push({
      key: question.reviewKey,
      dueAt: state.questionIndex + data.settings.reviewInterval,
      source: Object.assign({}, question)
    });
  }

  function dueReviewQuestion(){
    if (!state.reviewQueue.length) return null;
    var entry = state.reviewQueue[0];
    if (entry.dueAt > state.questionIndex) return null;
    var source = entry.source;
    var question = currentLevel === 1
      ? Object.assign({}, source)
      : randomForVerbTense(source.verb, source.tense, currentLevel);
    question.isReview = true;
    question.reviewQueueKey = entry.key;
    return question;
  }

  function clearReview(question){
    if (!question.isReview) return;
    state.reviewQueue = state.reviewQueue.filter(function(item){ return item.key !== question.reviewQueueKey; });
  }

  function settingsKey(level){ return appId + '.level' + level + '.settings'; }
  function sessionsKey(level){ return appId + '.level' + level + '.sessions'; }
  function getSettings(level){
    var fallback = {goal:data.settings.defaultChallengeGoal, duration:data.settings.defaultWorkDurationSeconds, stopOnError:false};
    try {
      var saved = JSON.parse(localStorage.getItem(settingsKey(level)) || 'null');
      if (saved && saved.goal > 0 && saved.duration > 0) return {goal:saved.goal, duration:saved.duration, stopOnError:!!saved.stopOnError};
      return fallback;
    } catch (error) { return fallback; }
  }
  function saveSettings(level, settings){
    try { localStorage.setItem(settingsKey(level), JSON.stringify(settings)); } catch (error) { /* mémoire indisponible */ }
  }
  function getSessions(level){
    try {
      return JSON.parse(localStorage.getItem(sessionsKey(level)) || '[]') || [];
    } catch (error) { return []; }
  }
  function saveSessions(level, sessions){
    try { localStorage.setItem(sessionsKey(level), JSON.stringify(sessions)); } catch (error) { /* mémoire indisponible */ }
  }

  function showScreen(name){
    el['screen-planning'].hidden = name !== 'planning';
    el['quiz-controls'].hidden = name === 'planning';
    el['screen-menu'].hidden = name !== 'menu';
    el['screen-quiz'].hidden = name !== 'quiz';
    el['screen-end'].hidden = name !== 'end';
  }

  function renderMenu(){
    var settings = getSettings(currentLevel);
    var minutes = formatMinutes(settings.duration);
    var stopNote = settings.stopOnError ? ' L’exercice s’arrête à la première erreur (réglage activé).' : '';
    el['challenge-num'].textContent = settings.goal;
    el['challenge-title'].textContent = 'Mode défi — objectif ' + settings.goal + ' de suite';
    el['challenge-description'].textContent = 'Une erreur remet la série à zéro. Le temps nécessaire et toutes les erreurs sont enregistrés.' + stopNote;
    el['work-num'].textContent = settings.duration / 60 % 1 === 0 ? settings.duration / 60 + '′' : (settings.duration / 60).toFixed(1) + '′';
    el['work-title'].textContent = 'Mode travail — ' + minutes;
    el['work-description'].textContent = 'Donne le maximum de bonnes réponses pendant la durée choisie. Le score et les erreurs sont enregistrés.' + stopNote;
    showScreen('menu');
  }

  function activateLevel(level, updateHash){
    if (state && !state.ended && !el['screen-quiz'].hidden){
      if (!window.confirm('La partie en cours sera abandonnée. Changer de niveau ?')) return;
      stopTimer(); state = null;
    }
    currentLevel = level;
    tabs.forEach(function(tab){
      var selected = Number(tab.dataset.level) === level;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
    el.application.setAttribute('aria-labelledby', 'tab-' + level);
    if (updateHash && selectedDate) window.location.hash = 'date-' + encodeURIComponent(selectedDate.date) + '&niveau-' + level;
    renderMenu();
  }

  // un tirage aléatoire de personne pour chaque (verbe, temps) au programme de la date choisie,
  // une seule fois chacun — utilisé par la fiche imprimable d'auto-interrogation ci-dessous
  function drawOneQuestionPerPair(){
    var list = scopedPairs.map(function(pair){
      var forms = data.verbs[pair.verbe].forms[pair.tense];
      var index = Math.floor(Math.random() * forms.length);
      var raw = forms[index];
      return {
        verb: pair.verbe, tense: pair.tense,
        person: pair.tense.indexOf('infinitif') === 0 ? '' : data.persons[index],
        personIndex: pair.tense.indexOf('infinitif') === 0 ? 0 : index,
        form: canonical(raw), alts: altsOf(raw)
      };
    });
    return shuffle(list);
  }

  /* ------------------------------------------------------------------
     Fiche imprimable d'auto-interrogation (PDF à deux pages : feuille vierge
     + corrigé), sur le modèle de la fiche « Avoir & Être — Niveau 5 ».
     Construction manuelle du PDF (sans bibliothèque externe), comme dans
     l'outil « Conjugaison 9H » dont ce fichier dérive.
  ------------------------------------------------------------------ */
  var PDF_GLYPH_WIDTHS = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  var PDF_GLYPH_WIDTHS_BOLD = PDF_GLYPH_WIDTHS; // approximation suffisante pour la mise en page

  function pdfTextWidth(s, size, bold){
    var table = bold ? PDF_GLYPH_WIDTHS_BOLD : PDF_GLYPH_WIDTHS, total = 0;
    for (var i = 0; i < s.length; i++){
      var ch = s.charAt(i).normalize('NFD').charAt(0);
      var code = ch.charCodeAt(0);
      total += (code >= 32 && code <= 126) ? table[code - 32] : 556;
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
  function wrapPdfText(s, size, maxWidth, bold){
    var words = s.split(' '), lines = [], current = '';
    words.forEach(function(word){
      var candidate = current ? current + ' ' + word : word;
      if (pdfTextWidth(candidate, size, bold) > maxWidth && current){
        lines.push(current); current = word;
      } else current = candidate;
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
        var w = pdfTextWidth(s, size, bold);
        ops.push('BT 0 0 0 rg /' + (bold ? 'F3' : 'F1') + ' ' + num(size) + ' Tf ' + num(cx - w / 2) + ' ' + num(pageH - y) + ' Td (' + pdfEscape(s) + ') Tj ET');
      }
    };
  }

  function buildWorksheetTablePage(opts){
    // opts: {pageW, pageH, title, subtitle, instructions, columns:[{label,width}], rows:[[...]], footerLines, scoreOutOf}
    var margin = 40, pw = makePdfPage(opts.pageH);
    var y = margin + 20;
    pw.ctext(opts.title, opts.pageW / 2, y, 15, true); y += 22;
    if (opts.subtitle){ pw.ctext(opts.subtitle, opts.pageW / 2, y, 9.5); y += 18; }
    if (opts.instructions){
      wrapPdfText(opts.instructions, 9.5, opts.pageW - margin * 2).forEach(function(line){
        pw.text(line, margin, y, 9.5); y += 13;
      });
      y += 6;
    } else {
      y += 18;
    }
    var tableTop = y, headH = 20;

    // Work out how much footer text will take so the table can stretch down
    // to fill the rest of the page instead of leaving empty space below it.
    var footerLineCount = 0;
    if (opts.footerLines) opts.footerLines.forEach(function(line){
      footerLineCount += wrapPdfText(line, 10, opts.pageW - margin * 2).length;
    });
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

  function buildWorksheetPdf(verbNames, dateLabel, seriesNum, questions){
    var pageW = 595, pageH = 842;
    var columns = [
      {label:'N°', width:30},
      {label:'Verbe', width:85},
      {label:'Temps', width:150},
      {label:'Sujet', width:58},
      {label:'Ta réponse', width:pageW - 80 - 30 - 85 - 150 - 58}
    ];
    var titleVerbs = verbNames.join(' & ');
    var blankRows = questions.map(function(q, i){
      return [String(i + 1), q.verb, q.tense, q.person || '-', ''];
    });
    var page1 = buildWorksheetTablePage({
      pageW:pageW, pageH:pageH,
      title: titleVerbs + ' - Auto-interrogation',
      subtitle: 'Conjugaison 9H · ' + dateLabel + ' · réponse écrite (série ' + seriesNum + ')',
      instructions: '',
      columns: columns,
      rows: blankRows,
      footerLines: ['Nom : ______________________________________________   Date : ________________'],
      scoreOutOf: questions.length
    });
    var answerColumns = columns.slice(0, 4).concat([{label:'Réponse', width:columns[4].width}]);
    var answerRows = questions.map(function(q, i){
      var answerText = q.tense.indexOf('infinitif') === 0 ? q.form : q.form;
      return [String(i + 1), q.verb, q.tense, q.person || '-', answerText];
    });
    var page2 = buildWorksheetTablePage({
      pageW:pageW, pageH:pageH,
      title: 'Corrigé - ' + titleVerbs,
      subtitle: 'Mêmes ' + questions.length + ' questions, avec la réponse attendue.',
      instructions: '',
      columns: answerColumns,
      rows: answerRows,
      footerLines: ['D’après le planning de révision du ' + dateLabel + ' · questions tirées de l’exercice en ligne « Révision par planning » (ordre mélangé).']
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
    if (!selectedDate) return 1;
    var key = appId + '.feuille.' + selectedDate.date + '.compteur';
    var next = 1;
    try { next = (parseInt(localStorage.getItem(key), 10) || 0) + 1; localStorage.setItem(key, String(next)); } catch (error) { /* mémoire indisponible */ }
    return next;
  }

  function downloadWorksheet(){
    if (!selectedDate) return;
    var questions = drawOneQuestionPerPair();
    var verbNames = selectedDate.entries.map(function(ve){ return ve.verbe; });
    var seriesNum = nextWorksheetSeriesNumber();
    var bytes = buildWorksheetPdf(verbNames, selectedDate.label || selectedDate.date, seriesNum, questions);
    var blob = new Blob([bytes], {type:'application/pdf'});
    var url = URL.createObjectURL(blob);
    var slug = verbNames.join('-').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    var a = document.createElement('a');
    a.href = url; a.download = slug + '-auto-interrogation-serie' + seriesNum + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }

  function startGame(mode){
    var settings = getSettings(currentLevel);
    state = {
      level:currentLevel, mode:mode, goal:settings.goal, duration:settings.duration,
      score:0, attempts:0, streak:0, bestStreak:0, errors:[], reviewQueue:[], ambiguityChoices:{}, questionIndex:0, recentKeys:[],
      startTime:Date.now(), timer:null, ended:false,
      stopOnError: !!settings.stopOnError, interrupted:false
    };
    el['stat-score-label'].textContent = mode === 'challenge' ? 'série actuelle' : 'bonnes réponses';
    el['stat-progress-label'].textContent = mode === 'challenge' ? 'objectif' : 'taux de réussite';
    el['stat-time-label'].textContent = mode === 'challenge' ? 'temps écoulé' : 'temps restant';
    showScreen('quiz');
    tickTimer();
    state.timer = window.setInterval(tickTimer, 250);
    nextQuestion();
  }

  function stopTimer(){ if (state && state.timer){ clearInterval(state.timer); state.timer = null; } }
  function tickTimer(){
    if (!state || state.ended) return;
    var elapsed = (Date.now() - state.startTime) / 1000;
    if (state.mode === 'challenge') el['stat-time'].textContent = formatTime(elapsed);
    else {
      var left = state.duration - elapsed;
      el['stat-time'].textContent = formatTime(left);
      if (left <= 0) endGame();
    }
  }
  function updateStats(){
    el['stat-score'].textContent = state.mode === 'challenge' ? state.streak : state.score;
    el['stat-progress'].textContent = state.mode === 'challenge'
      ? state.streak + ' / ' + state.goal
      : (state.attempts ? Math.round(state.score * 100 / state.attempts) + ' %' : '—');
  }

  function nextQuestion(){
    if (!state || state.ended) return;
    answerLocked = false;
    state.questionIndex++;
    currentQuestion = dueReviewQuestion() || randomMainQuestion(currentLevel);
    if (currentQuestion.identityKey){
      state.recentKeys.push(currentQuestion.identityKey);
      // Keep roughly a quarter of the pool (at least a couple, at most a dozen)
      // so the same question can't resurface a question or two later, while
      // still letting it come back around once the pool has been through once.
      var historyLimit = Math.max(2, Math.min(12, Math.floor(questionPool.length / 4)));
      if (state.recentKeys.length > historyLimit) state.recentKeys.shift();
    }
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    renderQuestion(currentQuestion);
    updateStats();
  }

  function renderQuestion(question){
    el.answers.innerHTML = '';
    if (currentLevel === 1){
      el['prompt-eyebrow'].textContent = question.isReview ? 'Reprise d’une difficulté : quel est ce temps ?' : 'Quel est ce temps ?';
      el['prompt-main'].textContent = question.form;
      el['prompt-sub'].textContent = '(' + question.verb + ')';
      var grid = document.createElement('div'); grid.className = 'tense-grid';
      var usedTenses = [];
      if (question.acceptedTenses.length > 1){
        usedTenses = state.ambiguityChoices[question.ambiguityKey] || [];
        if (usedTenses.length >= question.acceptedTenses.length){
          usedTenses = [];
          state.ambiguityChoices[question.ambiguityKey] = [];
        }
      }
      question.availableTenses = question.acceptedTenses.filter(function(tense){ return usedTenses.indexOf(tense) === -1; });
      [
        {title:'Temps simples', tenses:data.tenseGroups.simple},
        {title:'Temps composés', tenses:data.tenseGroups.compound}
      ].forEach(function(group){
        var column = document.createElement('section'); column.className = 'tense-column';
        var title = document.createElement('h3'); title.textContent = group.title; column.appendChild(title);
        group.tenses.forEach(function(tense){
          var button = document.createElement('button'); button.className = 'answer-btn'; button.textContent = tense;
          if (usedTenses.indexOf(tense) !== -1){
            button.disabled = true;
            button.classList.add('used');
            button.title = 'Réponse déjà choisie pour cette forme ambiguë';
            button.setAttribute('aria-label', tense + ' — réponse déjà choisie');
          }
          button.addEventListener('click', function(){ answerLevel1(tense, button); });
          column.appendChild(button);
        });
        grid.appendChild(column);
      });
      el.answers.appendChild(grid);
    } else if (currentLevel === 2){
      el['prompt-eyebrow'].textContent = question.isReview ? 'Reprise d’une difficulté : quelle forme ?' : 'Quelle est la bonne forme ?';
      el['prompt-main'].textContent = capitalize(question.verb) + ' — ' + question.tense;
      el['prompt-sub'].textContent = question.person ? 'sujet : ' + question.person : 'sans sujet';
      var options = buildOptions(question);
      var optionsGrid = document.createElement('div'); optionsGrid.className = 'options-grid';
      options.forEach(function(option){
        var button = document.createElement('button'); button.className = 'answer-btn'; button.textContent = option;
        button.addEventListener('click', function(){ answerLevel2(option, button); });
        optionsGrid.appendChild(button);
      });
      el.answers.appendChild(optionsGrid);
    } else {
      el['prompt-eyebrow'].textContent = question.isReview ? 'Reprise d’une difficulté : écris la forme' : 'Écris la bonne forme';
      el['prompt-main'].textContent = capitalize(question.verb) + ' — ' + question.tense;
      el['prompt-sub'].textContent = question.person ? 'sujet : ' + question.person : 'sans sujet';
      var row = document.createElement('div'); row.className = 'free-row';
      var input = document.createElement('input'); input.type = 'text'; input.autocomplete = 'off'; input.placeholder = 'Écris ta réponse…';
      var submit = document.createElement('button'); submit.className = 'btn'; submit.textContent = 'Valider';
      function send(){ answerLevel3(input.value, input, submit); }
      submit.addEventListener('click', send);
      input.addEventListener('keydown', function(event){ if (event.key === 'Enter'){ event.preventDefault(); send(); } });
      row.appendChild(input); row.appendChild(submit); el.answers.appendChild(row); input.focus();
    }
  }

  /* distracteurs : d'abord d'autres temps du même verbe (dans le périmètre du jour),
     puis d'autres personnes du même temps, puis le même temps chez un autre verbe du jour */
  function buildOptions(question){
    var options = [question.form];
    var seen = function(candidate){ return options.every(function(item){ return normalize(item) !== normalize(candidate); }); };

    var ownTenses = (scopedTensesByVerb[question.verb] || []).filter(function(t){ return t !== question.tense; });
    var preferred = (data.confusions[question.tense] || []).filter(function(t){ return ownTenses.indexOf(t) !== -1; });
    preferred.concat(ownTenses).forEach(function(tense){
      if (options.length >= 4) return;
      var forms = data.verbs[question.verb].forms[tense];
      if (!forms) return;
      var index = tense.indexOf('infinitif') === 0 ? 0 : question.personIndex;
      var candidate = canonical(forms[index] || '');
      if (candidate && seen(candidate)) options.push(candidate);
    });

    if (options.length < 4){
      var ownForms = data.verbs[question.verb].forms[question.tense] || [];
      shuffle(ownForms.map(function(raw, i){ return {raw:raw, i:i}; }))
        .filter(function(item){ return item.i !== question.personIndex; })
        .forEach(function(item){
          if (options.length >= 4) return;
          var candidate = canonical(item.raw);
          if (seen(candidate)) options.push(candidate);
        });
    }

    if (options.length < 4){
      var others = Object.keys(scopedTensesByVerb).filter(function(v){ return v !== question.verb; });
      shuffle(others).forEach(function(otherVerb){
        if (options.length >= 4) return;
        var forms = data.verbs[otherVerb].forms[question.tense];
        if (!forms) return;
        var index = question.tense.indexOf('infinitif') === 0 ? 0 : question.personIndex;
        var candidate = canonical(forms[index] || '');
        if (candidate && seen(candidate)) options.push(candidate);
      });
    }

    return shuffle(options.slice(0,4));
  }

  function disableAnswerButtons(acceptedAlts, chosenButton, wasCorrect){
    Array.prototype.forEach.call(el.answers.querySelectorAll('button'), function(button){
      button.disabled = true;
      if (matchesAnyAlt(button.textContent, acceptedAlts)) button.classList.add('correct');
    });
    if (!wasCorrect && chosenButton) chosenButton.classList.add('wrong');
  }

  function recordResult(correct, given, expected, explanation){
    state.attempts++;
    if (correct){
      state.score++; state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      clearReview(currentQuestion);
    } else {
      state.streak = 0;
      state.errors.push({
        question: currentQuestion.verb + ' · ' + currentQuestion.tense + (currentQuestion.person ? ' · ' + currentQuestion.person : ''),
        shown: currentQuestion.form,
        given: given,
        expected: expected,
        explanation: explanation || ''
      });
      scheduleReview(currentQuestion);
    }
    updateStats();
    if (!correct && state.stopOnError){
      state.interrupted = true;
      window.setTimeout(function(){ endGame(); }, 1350);
      return;
    }
    var done = state.mode === 'challenge' && state.streak >= state.goal;
    window.setTimeout(function(){ if (done) endGame(); else nextQuestion(); }, correct ? 650 : 1350);
  }

  function answerLevel1(tense, button){
    if (answerLocked) return; answerLocked = true;
    var allAccepted = currentQuestion.acceptedTenses;
    var accepted = currentQuestion.availableTenses || allAccepted;
    var correct = accepted.indexOf(tense) !== -1;
    var ambiguous = allAccepted.length > 1;
    Array.prototype.forEach.call(el.answers.querySelectorAll('button'), function(item){
      item.disabled = true;
      if (!item.classList.contains('used') && accepted.indexOf(item.textContent) !== -1) item.classList.add('correct');
    });
    if (!correct) button.classList.add('wrong');
    if (correct && ambiguous){
      var choices = state.ambiguityChoices[currentQuestion.ambiguityKey] || [];
      if (choices.indexOf(tense) === -1) choices.push(tense);
      state.ambiguityChoices[currentQuestion.ambiguityKey] = choices;
      var remaining = allAccepted.filter(function(item){ return choices.indexOf(item) === -1; });
      el.feedback.textContent = remaining.length
        ? 'Bonne réponse. Au prochain passage, il faudra choisir : ' + remaining.join(' ou ') + '.'
        : 'Bonne réponse. Tous les temps possibles ont maintenant été utilisés.';
    } else el.feedback.textContent = correct ? 'Bonne réponse !' : 'Réponse attendue : ' + accepted.join(' ou ') + '.';
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    recordResult(correct, tense, accepted.join(' ou '), ambiguous ? 'Forme identique dans plusieurs temps.' : '');
  }

  function answerLevel2(given, button){
    if (answerLocked) return; answerLocked = true;
    var correct = matchesAnyAlt(given, currentQuestion.alts);
    disableAnswerButtons(currentQuestion.alts, button, correct);
    el.feedback.textContent = correct ? 'Bonne réponse !' : 'Réponse attendue : ' + currentQuestion.alts.join(' ou ') + '.';
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    recordResult(correct, given, currentQuestion.alts.join(' ou '), 'Le temps et la personne étaient indiqués.');
  }

  function answerLevel3(given, input, submit){
    if (answerLocked || !normalize(given)) return; answerLocked = true;
    var grade = gradeFreeAnswer(given, currentQuestion.alts);
    var correct = grade !== 'wrong';
    input.disabled = true; submit.disabled = true;
    input.style.borderColor = correct ? 'var(--good)' : 'var(--bad)';
    el.feedback.textContent = correct
      ? (grade === 'typography' ? 'Bonne conjugaison. Orthographe attendue : ' + currentQuestion.alts.join(' ou ') + '.' : 'Bonne réponse !')
      : 'Réponse attendue : ' + currentQuestion.alts.join(' ou ') + '.';
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    recordResult(correct, given, currentQuestion.alts.join(' ou '), grade === 'typography' ? 'Écart typographique accepté.' : '');
  }

  function endGame(){
    if (!state || state.ended) return;
    state.ended = true; stopTimer();
    var elapsed = Math.round((Date.now() - state.startTime) / 1000);
    var percentage = state.attempts ? Math.round(state.score * 100 / state.attempts) : 0;
    if (state.interrupted){
      el['end-title'].textContent = 'Partie interrompue';
      el['end-big'].textContent = state.score;
      el['end-sub'].textContent = 'Une erreur arrête l’exercice : ' + state.score + ' bonne(s) réponse(s) avant l’erreur, sur ' + state.attempts + ' essai(s). Recommence depuis le début pour faire un sans-faute.';
    } else if (state.mode === 'challenge'){
      el['end-title'].textContent = 'Défi réussi';
      el['end-big'].textContent = formatTime(elapsed);
      el['end-sub'].textContent = state.goal + ' réponses justes de suite · ' + state.score + ' bonnes réponses sur ' + state.attempts + ' essais (' + percentage + ' %).';
    } else {
      el['end-title'].textContent = 'Temps écoulé';
      el['end-big'].textContent = state.score;
      el['end-sub'].textContent = 'bonnes réponses en ' + formatTime(state.duration) + ' · ' + state.attempts + ' essais (' + percentage + ' %).';
    }
    var session = {
      level:state.level, mode:state.mode, score:state.score, attempts:state.attempts,
      bestStreak:state.bestStreak, goal:state.goal, durationSeconds:state.duration,
      interrupted: !!state.interrupted,
      elapsedSeconds:elapsed, errors:state.errors.slice(), unresolvedResiduals:state.reviewQueue.map(function(item){ return item.key; }),
      date: selectedDate ? selectedDate.date : null,
      endedAt:new Date().toISOString()
    };
    var sessions = getSessions(currentLevel); sessions.push(session); saveSessions(currentLevel, sessions);
    renderSessionErrors(session.errors);
    showScreen('end');
  }

  function renderSessionErrors(errors){
    el['session-errors'].innerHTML = '';
    if (!errors.length){ el['session-errors'].innerHTML = '<p class="feedback good">Aucune erreur dans cette partie.</p>'; return; }
    var title = document.createElement('h3'); title.textContent = 'Erreurs de cette partie (' + errors.length + ')'; el['session-errors'].appendChild(title);
    errors.forEach(function(error){
      var row = document.createElement('div'); row.className = 'error-row';
      row.innerHTML = '<strong>' + escapeHtml(error.question) + '</strong><small>Répondu : ' + escapeHtml(error.given) + ' · attendu : ' + escapeHtml(error.expected) + '</small>';
      el['session-errors'].appendChild(row);
    });
  }

  function renderHistory(){
    var sessions = getSessions(currentLevel).slice().reverse();
    el['history-level'].textContent = currentLevel;
    el['history-list'].innerHTML = '';
    if (!sessions.length){ el['history-list'].innerHTML = '<p>Aucune partie terminée pour ce niveau.</p>'; return; }
    sessions.forEach(function(session){
      var row = document.createElement('div'); row.className = 'history-row';
      var date = session.endedAt ? new Date(session.endedAt).toLocaleString('fr-CH') : 'ancienne partie';
      var errors = session.errors || [];
      var modeLabel = (session.mode === 'challenge' || session.mode === 'target') ? 'Défi' : 'Travail';
      if (session.interrupted) modeLabel += ' (interrompue)';
      row.innerHTML = '<div class="history-head"><strong>' + escapeHtml(modeLabel) + '</strong><span>' + escapeHtml(date) + '</span>' + (session.date ? '<span>' + escapeHtml(session.date) + '</span>' : '') + '<span>' + Number(session.score || 0) + ' bonne(s)</span><span>' + errors.length + ' erreur(s)</span></div>';
      var detail = document.createElement('div'); detail.className = 'history-detail'; detail.hidden = true;
      if (!errors.length) detail.innerHTML = '<span class="feedback good">Sans faute.</span>';
      else errors.forEach(function(error){
        var item = document.createElement('div'); item.className = 'error-row';
        item.innerHTML = '<strong>' + escapeHtml(error.question || error.f || 'Question') + '</strong><small>Répondu : ' + escapeHtml(error.given) + ' · attendu : ' + escapeHtml(error.expected || error.correct) + '</small>';
        detail.appendChild(item);
      });
      row.appendChild(detail); row.addEventListener('click', function(){ detail.hidden = !detail.hidden; }); el['history-list'].appendChild(row);
    });
  }

  function openSettings(){
    var settings = getSettings(currentLevel), limits = data.settings;
    el['settings-level'].textContent = currentLevel;
    el['setting-goal'].min = limits.minimumChallengeGoal; el['setting-goal'].max = limits.maximumChallengeGoal; el['setting-goal'].value = settings.goal;
    el['setting-duration'].min = limits.minimumWorkDurationMinutes; el['setting-duration'].max = limits.maximumWorkDurationMinutes; el['setting-duration'].value = settings.duration / 60;
    el['setting-anti-cheat'].checked = !!settings.stopOnError;
    el['settings-overlay'].hidden = false;
  }
  function saveCurrentSettings(){
    var goal = parseInt(el['setting-goal'].value, 10), minutes = parseFloat(el['setting-duration'].value), limits = data.settings;
    if (goal < limits.minimumChallengeGoal || goal > limits.maximumChallengeGoal) return;
    if (minutes < limits.minimumWorkDurationMinutes || minutes > limits.maximumWorkDurationMinutes) return;
    saveSettings(currentLevel, {goal:goal, duration:Math.round(minutes * 60), stopOnError: el['setting-anti-cheat'].checked});
    el['settings-overlay'].hidden = true; renderMenu();
  }

  tabs.forEach(function(tab, index){
    tab.addEventListener('click', function(){ activateLevel(Number(tab.dataset.level), true); });
    tab.addEventListener('keydown', function(event){
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      var next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index + tabs.length - 1) % tabs.length;
      tabs[next].focus(); activateLevel(Number(tabs[next].dataset.level), true);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.mode-card'), function(button){ button.addEventListener('click', function(){ startGame(button.dataset.mode); }); });
  el['quit-game'].addEventListener('click', function(){ stopTimer(); state = null; renderMenu(); });
  el.replay.addEventListener('click', function(){ startGame(state ? state.mode : 'challenge'); });
  el['back-menu'].addEventListener('click', function(){ state = null; renderMenu(); });
  el['open-settings'].addEventListener('click', openSettings);
  el['cancel-settings'].addEventListener('click', function(){ el['settings-overlay'].hidden = true; });
  el['save-settings'].addEventListener('click', saveCurrentSettings);
  el['open-history'].addEventListener('click', function(){ renderHistory(); el['history-overlay'].hidden = false; });
  el['download-worksheet'].addEventListener('click', downloadWorksheet);
  el['close-history'].addEventListener('click', function(){ el['history-overlay'].hidden = true; });
  el['clear-history'].addEventListener('click', function(){
    if (!window.confirm('Effacer les scores et les erreurs du niveau ' + currentLevel + ' ?')) return;
    saveSessions(currentLevel, []); renderHistory();
  });
  el['change-planning'].addEventListener('click', function(){
    if (state && !state.ended && !el['screen-quiz'].hidden){
      if (!window.confirm('La partie en cours sera abandonnée. Changer de date ?')) return;
      stopTimer(); state = null;
    }
    renderPlanningList();
    showScreen('planning');
  });

  setupLocalDataLoader();
  loadData().then(function(value){
    initializeData(value); // masque load-status ET le panneau de chargement manuel
  }).catch(function(error){
    if (isLocalFile) {
      // un seul message, dans le panneau de chargement manuel — pas de second encadré redondant
      el['load-status'].hidden = true;
      var panel = document.getElementById('local-data-loader');
      if (panel) panel.hidden = false;
      setLocalStatus('Aucune copie locale n’est encore mémorisée : choisis le fichier ' + decodeURIComponent(dataUrl.pathname.split('/').pop()) + ' ci-dessous.', true);
    } else {
      el['load-status'].textContent = 'Impossible de lire automatiquement le fichier de conjugaisons associé : ' + error.message;
      el['load-status'].classList.add('error');
    }
  });
})();
