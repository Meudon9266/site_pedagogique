(function(){
  'use strict';

  var ownScriptUrl = new URL(document.currentScript.src, window.location.href);
  var dataUrl = new URL(ownScriptUrl.href);
  dataUrl.hash = '';
  dataUrl.search = '';
  dataUrl.pathname = dataUrl.pathname.replace(/\.js$/i, '.json');
  var appId = decodeURIComponent(ownScriptUrl.pathname.split('/').pop()).replace(/\.js$/i, '');
  var data = null;
  var currentLevel = 1;
  var state = null;
  var currentQuestion = null;
  var answerLocked = false;

  // Edge interdit la lecture d'un JSON voisin lorsqu'une page est ouverte
  // directement en file://. Cette copie de secours, synchronisée avec le JSON,
  // n'est utilisée que dans ce cas. Sur le site publié, le JSON reste prioritaire.
  var LOCAL_FILE_FALLBACK = {
    version:1,
    title:'Aimer et finir aux temps de l’indicatif',
    persons:['je','tu','il','nous','vous','ils'],
    tenseGroups:{
      simple:['présent','imparfait','futur simple','passé simple','infinitif présent'],
      compound:['passé composé','plus-que-parfait','futur antérieur','passé antérieur','infinitif passé']
    },
    settings:{defaultChallengeGoal:10,defaultWorkDurationSeconds:300,minimumChallengeGoal:3,maximumChallengeGoal:30,minimumWorkDurationMinutes:1,maximumWorkDurationMinutes:10,reviewInterval:2},
    confusions:{
      'présent':['imparfait','passé composé','passé simple'],
      'imparfait':['passé simple','présent','plus-que-parfait'],
      'futur simple':['présent','futur antérieur'],
      'passé simple':['imparfait','présent','passé composé'],
      'infinitif présent':['infinitif passé','passé composé'],
      'passé composé':['plus-que-parfait','passé antérieur'],
      'plus-que-parfait':['passé composé','passé antérieur'],
      'futur antérieur':['futur simple','passé composé'],
      'passé antérieur':['plus-que-parfait','passé composé'],
      'infinitif passé':['infinitif présent','passé composé']
    },
    residualProblems:{
      ambiguityPolicy:{level1:'accept-all-first-then-require-unused',level2:'target-tense-is-explicit',level3:'target-tense-is-explicit'},
      ambiguousForms:[
        {verb:'finir',form:'je finis',tenses:['présent','passé simple']},
        {verb:'finir',form:'tu finis',tenses:['présent','passé simple']},
        {verb:'finir',form:'il finit',tenses:['présent','passé simple']}
      ]
    },
    verbs:{
      aimer:{group:'1er groupe',participle:'aimé',forms:{
        'présent':['j’aime','tu aimes','il aime','nous aimons','vous aimez','ils aiment'],
        'imparfait':['j’aimais','tu aimais','il aimait','nous aimions','vous aimiez','ils aimaient'],
        'futur simple':['j’aimerai','tu aimeras','il aimera','nous aimerons','vous aimerez','ils aimeront'],
        'passé simple':['j’aimai','tu aimas','il aima','nous aimâmes','vous aimâtes','ils aimèrent'],
        'infinitif présent':['aimer'],
        'passé composé':['j’ai aimé','tu as aimé','il a aimé','nous avons aimé','vous avez aimé','ils ont aimé'],
        'plus-que-parfait':['j’avais aimé','tu avais aimé','il avait aimé','nous avions aimé','vous aviez aimé','ils avaient aimé'],
        'futur antérieur':['j’aurai aimé','tu auras aimé','il aura aimé','nous aurons aimé','vous aurez aimé','ils auront aimé'],
        'passé antérieur':['j’eus aimé','tu eus aimé','il eut aimé','nous eûmes aimé','vous eûtes aimé','ils eurent aimé'],
        'infinitif passé':['avoir aimé']
      }},
      finir:{group:'2e groupe',participle:'fini',forms:{
        'présent':['je finis','tu finis','il finit','nous finissons','vous finissez','ils finissent'],
        'imparfait':['je finissais','tu finissais','il finissait','nous finissions','vous finissiez','ils finissaient'],
        'futur simple':['je finirai','tu finiras','il finira','nous finirons','vous finirez','ils finiront'],
        'passé simple':['je finis','tu finis','il finit','nous finîmes','vous finîtes','ils finirent'],
        'infinitif présent':['finir'],
        'passé composé':['j’ai fini','tu as fini','il a fini','nous avons fini','vous avez fini','ils ont fini'],
        'plus-que-parfait':['j’avais fini','tu avais fini','il avait fini','nous avions fini','vous aviez fini','ils avaient fini'],
        'futur antérieur':['j’aurai fini','tu auras fini','il aura fini','nous aurons fini','vous aurez fini','ils auront fini'],
        'passé antérieur':['j’eus fini','tu eus fini','il eut fini','nous eûmes fini','vous eûtes fini','ils eurent fini'],
        'infinitif passé':['avoir fini']
      }}
    }
  };

  var el = {};
  [
    'load-status','application','screen-menu','screen-quiz','screen-end','level-help',
    'challenge-num','challenge-title','challenge-description','work-num','work-title','work-description',
    'open-settings','open-history','stat-score','stat-score-label','stat-progress','stat-progress-label',
    'stat-time','stat-time-label','quit-game','prompt-eyebrow','prompt-main','prompt-sub','answers','feedback',
    'end-title','end-big','end-sub','session-errors','replay','back-menu','settings-overlay','settings-level',
    'setting-goal','setting-duration','cancel-settings','save-settings','history-overlay','history-level',
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
    return fetch(dataUrl.href, {cache:'no-store'})
      .then(function(response){ if (!response.ok) throw new Error('Réponse JSON ' + response.status); return response.json(); })
      .catch(function(){ return jsonFromXhr(dataUrl.href); })
      .catch(function(error){
        if (window.location.protocol === 'file:') return LOCAL_FILE_FALLBACK;
        throw error;
      });
  }

  function validateData(value){
    if (!value || !value.verbs || !value.persons || !value.tenseGroups) throw new Error('Structure du JSON incomplète');
    var tenses = value.tenseGroups.simple.concat(value.tenseGroups.compound);
    Object.keys(value.verbs).forEach(function(verb){
      tenses.forEach(function(tense){
        var forms = value.verbs[verb].forms[tense];
        if (!Array.isArray(forms) || !forms.length) throw new Error('Conjugaison manquante : ' + verb + ', ' + tense);
        var expected = tense.indexOf('infinitif') === 0 ? 1 : value.persons.length;
        if (forms.length !== expected) throw new Error('Nombre de formes incorrect : ' + verb + ', ' + tense);
      });
    });
  }

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
    return normalized.normalize ? normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : normalized;
  }
  function gradeFreeAnswer(given, correct){
    if (normalize(given) === normalize(correct)) return 'exact';
    if (withoutTypography(given) === withoutTypography(correct)) return 'typography';
    return 'wrong';
  }
  function capitalize(value){ return value.charAt(0).toUpperCase() + value.slice(1); }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function buildQuestionPool(){
    var pool = [];
    Object.keys(data.verbs).forEach(function(verb){
      allTenses().forEach(function(tense){
        data.verbs[verb].forms[tense].forEach(function(form, index){
          pool.push({
            verb: verb,
            tense: tense,
            person: tense.indexOf('infinitif') === 0 ? '' : data.persons[index],
            personIndex: tense.indexOf('infinitif') === 0 ? 0 : index,
            form: form
          });
        });
      });
    });
    return pool;
  }
  var questionPool = [];

  function matchingTenses(question){
    var result = [];
    allTenses().forEach(function(tense){
      var forms = data.verbs[question.verb].forms[tense];
      if (forms.some(function(form){ return normalize(form) === normalize(question.form); })) result.push(tense);
    });
    return result;
  }

  function randomMainQuestion(level){
    var candidate = questionPool[Math.floor(Math.random() * questionPool.length)];
    var question = Object.assign({}, candidate);
    question.level = level;
    question.acceptedTenses = level === 1 ? matchingTenses(question) : [question.tense];
    question.ambiguityKey = question.verb + '|' + normalize(question.form);
    question.reviewKey = level + '|' + question.verb + '|' + (level === 1 ? normalize(question.form) : question.tense);
    return question;
  }

  function randomForVerbTense(verb, tense, level){
    var candidates = questionPool.filter(function(item){ return item.verb === verb && item.tense === tense; });
    var chosen = Object.assign({}, candidates[Math.floor(Math.random() * candidates.length)]);
    chosen.level = level;
    chosen.acceptedTenses = level === 1 ? matchingTenses(chosen) : [tense];
    chosen.ambiguityKey = chosen.verb + '|' + normalize(chosen.form);
    chosen.reviewKey = level + '|' + verb + '|' + (level === 1 ? normalize(chosen.form) : tense);
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
    try {
      var saved = JSON.parse(localStorage.getItem(settingsKey(level)) || 'null');
      return saved && saved.goal > 0 && saved.duration > 0
        ? saved
        : {goal:data.settings.defaultChallengeGoal,duration:data.settings.defaultWorkDurationSeconds};
    } catch (error) { return {goal:data.settings.defaultChallengeGoal,duration:data.settings.defaultWorkDurationSeconds}; }
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

  function levelDescription(level){
    if (level === 1) return 'Une forme conjuguée apparaît : retrouve son temps. Pour une forme ambiguë, toutes les réponses exactes sont d’abord acceptées, puis chaque réponse déjà choisie est grisée jusqu’au prochain cycle.';
    if (level === 2) return 'Le verbe, le temps et la personne sont indiqués : choisis la bonne forme parmi quatre propositions.';
    return 'Le verbe, le temps et la personne sont indiqués : écris toi-même la forme conjuguée. Les différences typographiques sans erreur de conjugaison sont tolérées.';
  }

  function showScreen(name){
    el['screen-menu'].hidden = name !== 'menu';
    el['screen-quiz'].hidden = name !== 'quiz';
    el['screen-end'].hidden = name !== 'end';
  }

  function renderMenu(){
    var settings = getSettings(currentLevel);
    var minutes = formatMinutes(settings.duration);
    el['level-help'].textContent = levelDescription(currentLevel);
    el['challenge-num'].textContent = settings.goal;
    el['challenge-title'].textContent = 'Mode défi — objectif ' + settings.goal + ' de suite';
    el['challenge-description'].textContent = 'Une erreur remet la série à zéro. Le temps nécessaire et toutes les erreurs sont enregistrés.';
    el['work-num'].textContent = settings.duration / 60 % 1 === 0 ? settings.duration / 60 + '′' : (settings.duration / 60).toFixed(1) + '′';
    el['work-title'].textContent = 'Mode travail — ' + minutes;
    el['work-description'].textContent = 'Donne le maximum de bonnes réponses pendant la durée choisie. Le score et les erreurs sont enregistrés.';
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
    if (updateHash) window.location.hash = 'niveau-' + level;
    renderMenu();
  }

  function startGame(mode){
    var settings = getSettings(currentLevel);
    state = {
      level:currentLevel, mode:mode, goal:settings.goal, duration:settings.duration,
      score:0, attempts:0, streak:0, bestStreak:0, errors:[], reviewQueue:[], ambiguityChoices:{}, questionIndex:0,
      startTime:Date.now(), timer:null, ended:false
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

  function buildOptions(question){
    var options = [question.form];
    var preferred = data.confusions[question.tense] || [];
    preferred.concat(allTenses()).forEach(function(tense){
      if (options.length >= 4) return;
      var forms = data.verbs[question.verb].forms[tense];
      var index = tense.indexOf('infinitif') === 0 ? 0 : question.personIndex;
      var candidate = forms[index];
      if (candidate && options.every(function(item){ return normalize(item) !== normalize(candidate); })) options.push(candidate);
    });
    return shuffle(options.slice(0,4));
  }

  function disableAnswerButtons(correctText, chosenButton, wasCorrect){
    Array.prototype.forEach.call(el.answers.querySelectorAll('button'), function(button){
      button.disabled = true;
      if (normalize(button.textContent) === normalize(correctText)) button.classList.add('correct');
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
    var correct = normalize(given) === normalize(currentQuestion.form);
    disableAnswerButtons(currentQuestion.form, button, correct);
    el.feedback.textContent = correct ? 'Bonne réponse !' : 'Réponse attendue : ' + currentQuestion.form + '.';
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    recordResult(correct, given, currentQuestion.form, 'Le temps et la personne étaient indiqués.');
  }

  function answerLevel3(given, input, submit){
    if (answerLocked || !normalize(given)) return; answerLocked = true;
    var grade = gradeFreeAnswer(given, currentQuestion.form);
    var correct = grade !== 'wrong';
    input.disabled = true; submit.disabled = true;
    input.style.borderColor = correct ? 'var(--good)' : 'var(--bad)';
    el.feedback.textContent = correct
      ? (grade === 'typography' ? 'Bonne conjugaison. Orthographe attendue : ' + currentQuestion.form + '.' : 'Bonne réponse !')
      : 'Réponse attendue : ' + currentQuestion.form + '.';
    el.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    recordResult(correct, given, currentQuestion.form, grade === 'typography' ? 'Écart typographique accepté.' : '');
  }

  function endGame(){
    if (!state || state.ended) return;
    state.ended = true; stopTimer();
    var elapsed = Math.round((Date.now() - state.startTime) / 1000);
    var percentage = state.attempts ? Math.round(state.score * 100 / state.attempts) : 0;
    if (state.mode === 'challenge'){
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
      elapsedSeconds:elapsed, errors:state.errors.slice(), unresolvedResiduals:state.reviewQueue.map(function(item){ return item.key; }),
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
      row.innerHTML = '<div class="history-head"><strong>' + (session.mode === 'challenge' || session.mode === 'target' ? 'Défi' : 'Travail') + '</strong><span>' + escapeHtml(date) + '</span><span>' + Number(session.score || 0) + ' bonne(s)</span><span>' + errors.length + ' erreur(s)</span></div>';
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
    el['settings-overlay'].hidden = false;
  }
  function saveCurrentSettings(){
    var goal = parseInt(el['setting-goal'].value, 10), minutes = parseFloat(el['setting-duration'].value), limits = data.settings;
    if (goal < limits.minimumChallengeGoal || goal > limits.maximumChallengeGoal) return;
    if (minutes < limits.minimumWorkDurationMinutes || minutes > limits.maximumWorkDurationMinutes) return;
    saveSettings(currentLevel, {goal:goal,duration:Math.round(minutes * 60)});
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
  el['close-history'].addEventListener('click', function(){ el['history-overlay'].hidden = true; });
  el['clear-history'].addEventListener('click', function(){
    if (!window.confirm('Effacer les scores et les erreurs du niveau ' + currentLevel + ' ?')) return;
    saveSessions(currentLevel, []); renderHistory();
  });

  loadData().then(function(value){
    validateData(value); data = value; questionPool = buildQuestionPool();
    el['load-status'].hidden = true; el.application.hidden = false;
    var match = window.location.hash.match(/niveau-([123])/i);
    activateLevel(match ? Number(match[1]) : 1, false);
  }).catch(function(error){
    el['load-status'].textContent = 'Impossible de lire le fichier de conjugaisons associé : ' + error.message;
    el['load-status'].classList.add('error');
  });
})();
