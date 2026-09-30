(function () {
  "use strict";

  const htmlFile = decodeURIComponent(window.location.pathname.split("/").pop() || "calcul-mental-10ans.html");
  const baseName = htmlFile.replace(/\.html?$/i, "");
  const dataFile = `${encodeURIComponent(baseName)}.json`;
  const storageKey = `calcul-mental-adaptatif:${baseName}:v5`;
  const dataStorageKey = `donnees-locales:${baseName}:${dataFile}:v1`;
  const isLocalFile = window.location.protocol === "file:";

  const elements = {
    loading: document.getElementById("loading"),
    content: document.getElementById("gameContent"),
    startScreen: document.getElementById("startScreen"),
    resultScreen: document.getElementById("resultScreen"),
    playModeButtons: [...document.querySelectorAll("[data-play-mode]")],
    levelTabs: [...document.querySelectorAll(".level-tab")],
    modeButtons: [...document.querySelectorAll(".mode-button")],
    levelBadge: document.getElementById("levelBadge"),
    reviewBadge: document.getElementById("reviewBadge"),
    expression: document.getElementById("expression"),
    answerArea: document.getElementById("answerArea"),
    feedback: document.getElementById("feedback"),
    nextRow: document.getElementById("nextRow"),
    nextButton: document.getElementById("nextButton"),
    homeButton: document.getElementById("homeButton"),
    resetButton: document.getElementById("resetButton"),
    roundTarget: document.getElementById("roundTarget"),
    evaluationRecord: document.getElementById("evaluationRecord"),
    challengeRecord: document.getElementById("challengeRecord"),
    playModeBadge: document.getElementById("playModeBadge"),
    sessionProgress: document.getElementById("sessionProgress"),
    sessionErrors: document.getElementById("sessionErrors"),
    sessionTime: document.getElementById("sessionTime"),
    successRate: document.getElementById("successRate"),
    answerCount: document.getElementById("answerCount"),
    successMeter: document.getElementById("successMeter"),
    fragileCount: document.getElementById("fragileCount"),
    reviewCount: document.getElementById("reviewCount"),
    qcmTime: document.getElementById("qcmTime"),
    freeTime: document.getElementById("freeTime"),
    fastStreak: document.getElementById("fastStreak"),
    localDataLoader: document.getElementById("localDataLoader"),
    localDataFile: document.getElementById("localDataFile"),
    localDataStatus: document.getElementById("localDataStatus")
  };

  let bank = null;
  let currentCard = null;
  let startedAt = 0;
  let answered = false;
  let session = null;
  let state = {
    selectedLevel: 1,
    selectedMode: "qcm",
    lastCardId: null,
    totals: { attempts: 0, correct: 0 },
    records: { evaluation: {}, challenge: {} },
    cards: {}
  };

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const shuffle = list => {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  function blankModeStats() {
    return { attempts: 0, correct: 0, totalMs: 0, lastMs: 0 };
  }

  function blankCardStats() {
    return {
      personalDifficulty: 20,
      errors: 0,
      successes: 0,
      fastSuccessStreak: 0,
      lastSeen: 0,
      modes: { qcm: blankModeStats(), libre: blankModeStats() }
    };
  }

  function cardStats(cardId) {
    if (!state.cards[cardId]) state.cards[cardId] = blankCardStats();
    return state.cards[cardId];
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || saved.version !== 1 || !saved.cards) return;
      state.selectedLevel = clamp(Number(saved.selectedLevel) || 1, 1, 3);
      state.selectedMode = saved.selectedMode === "libre" ? "libre" : "qcm";
      state.lastCardId = saved.lastCardId || null;
      state.totals = {
        attempts: Math.max(0, Number(saved.totals?.attempts) || 0),
        correct: Math.max(0, Number(saved.totals?.correct) || 0)
      };
      state.records = saved.records || { evaluation: {}, challenge: {} };
      state.records.evaluation ||= {};
      state.records.challenge ||= {};
      state.cards = saved.cards;
    } catch (_) {
      // Une sauvegarde abîmée ne doit jamais empêcher de jouer.
    }
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...state }));
    } catch (_) {
      // Le jeu reste utilisable même si le stockage local est bloqué.
    }
  }

  function recordKey() {
    return `niveau-${state.selectedLevel}:${state.selectedMode}`;
  }

  function formatTime(milliseconds) {
    return `${(milliseconds / 1000).toFixed(1).replace(".", ",")} s`;
  }

  function renderRecords() {
    if (!bank) return;
    const key = recordKey();
    const evaluation = state.records.evaluation[key];
    const challenge = state.records.challenge[key];
    elements.roundTarget.textContent = bank.settings.questionsPerRound;
    elements.evaluationRecord.textContent = evaluation
      ? `Record · ${evaluation.bestErrors} erreur${evaluation.bestErrors > 1 ? "s" : ""} · ${formatTime(evaluation.bestTimeMs)}`
      : "Aucune évaluation enregistrée";
    elements.challengeRecord.textContent = challenge?.bestTimeMs
      ? `Record sans erreur · ${formatTime(challenge.bestTimeMs)}`
      : "Aucun défi réussi";
  }

  function isFragile(card) {
    return cardStats(card.id).personalDifficulty >= bank.settings.fragileThreshold;
  }

  function activePool() {
    const nativeCards = bank.cards.filter(card => card.originLevel === state.selectedLevel);
    if (state.selectedLevel === 1) return nativeCards;
    const reviewCards = bank.cards.filter(card => card.originLevel === state.selectedLevel - 1 && isFragile(card));
    return [...nativeCards, ...reviewCards];
  }

  function cardWeight(card) {
    const stats = cardStats(card.id);
    const difficultyBonus = stats.personalDifficulty / 22;
    const errorBonus = Math.min(1.2, stats.errors * .16);
    const neverSeenBonus = stats.modes.qcm.attempts + stats.modes.libre.attempts === 0 ? .8 : 0;
    return Math.min(bank.settings.maxWeight, 1 + difficultyBonus + errorBonus + neverSeenBonus);
  }

  function chooseWeightedCard() {
    const pool = activePool();
    const varied = pool.length > 1 ? pool.filter(card => card.id !== state.lastCardId) : pool;
    const candidates = varied.length ? varied : pool;
    const total = candidates.reduce((sum, card) => sum + cardWeight(card), 0);
    let cursor = Math.random() * total;
    for (const card of candidates) {
      cursor -= cardWeight(card);
      if (cursor <= 0) return card;
    }
    return candidates[candidates.length - 1];
  }

  function showStartScreen() {
    session = null;
    currentCard = null;
    elements.loading.hidden = true;
    elements.startScreen.hidden = false;
    elements.content.hidden = true;
    elements.resultScreen.hidden = true;
    elements.homeButton.hidden = true;
    syncControls();
    renderRecords();
    renderSummary();
  }

  function startRound(type) {
    const target = Math.max(1, Number(bank.settings.questionsPerRound) || 10);
    session = {
      type: type === "challenge" ? "challenge" : "evaluation",
      target,
      answered: 0,
      errors: 0,
      timeMs: 0,
      pendingFinish: false,
      level: state.selectedLevel,
      responseMode: state.selectedMode
    };
    state.lastCardId = null;
    elements.startScreen.hidden = true;
    elements.resultScreen.hidden = true;
    elements.content.hidden = false;
    elements.homeButton.hidden = false;
    syncControls();
    renderQuestion();
  }

  function renderSessionStatus() {
    if (!session) return;
    elements.playModeBadge.textContent = session.type === "challenge" ? "⚡ Défi" : "📝 Évaluation";
    elements.sessionProgress.textContent = `${Math.min(session.answered + 1, session.target)} / ${session.target}`;
    elements.sessionErrors.textContent = session.errors;
    elements.sessionTime.textContent = formatTime(session.timeMs);
  }

  function advanceSession() {
    if (!session) return showStartScreen();
    if (session.pendingFinish) return finishSession();
    renderQuestion();
  }

  function finishSession() {
    const key = `niveau-${session.level}:${session.responseMode}`;
    const successfulChallenge = session.type === "challenge" && session.errors === 0 && session.answered === session.target;
    let newRecord = false;

    if (session.type === "evaluation" && session.answered === session.target) {
      const previous = state.records.evaluation[key];
      newRecord = !previous || session.errors < previous.bestErrors || (session.errors === previous.bestErrors && session.timeMs < previous.bestTimeMs);
      state.records.evaluation[key] = {
        bestErrors: newRecord ? session.errors : previous.bestErrors,
        bestTimeMs: newRecord ? session.timeMs : previous.bestTimeMs,
        completedRounds: (previous?.completedRounds || 0) + 1
      };
    }

    if (session.type === "challenge") {
      const previous = state.records.challenge[key] || { attempts: 0, bestTimeMs: null, completedRuns: 0 };
      newRecord = successfulChallenge && (!previous.bestTimeMs || session.timeMs < previous.bestTimeMs);
      state.records.challenge[key] = {
        attempts: previous.attempts + 1,
        bestTimeMs: newRecord ? session.timeMs : previous.bestTimeMs,
        completedRuns: previous.completedRuns + (successfulChallenge ? 1 : 0)
      };
    }

    saveState();
    elements.content.hidden = true;
    elements.startScreen.hidden = true;
    elements.resultScreen.hidden = false;
    const title = session.type === "challenge"
      ? successfulChallenge ? "Défi réussi !" : "Défi interrompu"
      : "Évaluation terminée";
    const mainScore = session.type === "challenge"
      ? successfulChallenge ? formatTime(session.timeMs) : `${session.errors} erreur`
      : `${session.errors} erreur${session.errors > 1 ? "s" : ""}`;
    const detail = session.type === "challenge"
      ? successfulChallenge ? `Tu as réussi ${session.target} calculs sans erreur.` : "Une réponse fausse arrête le défi. Tu peux recommencer immédiatement."
      : `Temps total : ${formatTime(session.timeMs)}. Le nombre d’erreurs compte avant le temps.`;
    elements.resultScreen.innerHTML = `
      <h2>${title}</h2>
      <p>${detail}</p>
      <div class="result-score"><strong>${mainScore}</strong><span>${newRecord ? "Nouveau record !" : "Résultat de cette partie"}</span></div>
      <div class="result-actions">
        <button class="primary" id="replayButton" type="button">Rejouer ce mode</button>
        <button class="quiet-button" id="chooseButton" type="button">Choisir une autre partie</button>
      </div>`;
    document.getElementById("replayButton").addEventListener("click", () => startRound(session.type));
    document.getElementById("chooseButton").addEventListener("click", showStartScreen);
  }

  function renderQuestion() {
    if (!session) return showStartScreen();
    currentCard = chooseWeightedCard();
    answered = false;
    startedAt = performance.now();
    state.lastCardId = currentCard.id;
    elements.levelBadge.textContent = `Niveau ${state.selectedLevel}`;
    const review = currentCard.originLevel < state.selectedLevel;
    elements.reviewBadge.hidden = !review;
    elements.reviewBadge.textContent = review ? `Révision du niveau ${currentCard.originLevel}` : "";
    elements.expression.textContent = currentCard.expression;
    elements.feedback.className = "feedback";
    elements.feedback.innerHTML = "";
    elements.nextRow.className = "next-row";
    elements.answerArea.innerHTML = "";

    if (state.selectedMode === "qcm") renderChoices();
    else renderFreeAnswer();

    renderSessionStatus();
    renderSummary();
    saveState();
  }

  function renderChoices() {
    const grid = document.createElement("div");
    grid.className = "choices";
    const values = shuffle([currentCard.answer, ...distractorsFor(currentCard)]);
    values.forEach(value => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = formatNumber(value);
      button.dataset.value = String(value);
      button.addEventListener("click", () => {
        if (answered) return;
        const correct = Number(value) === Number(currentCard.answer);
        button.classList.add(correct ? "correct" : "wrong");
        grid.querySelectorAll("button").forEach(item => {
          item.disabled = true;
          if (Number(item.dataset.value) === Number(currentCard.answer)) item.classList.add("correct");
        });
        evaluate(correct, value);
      });
      grid.appendChild(button);
    });
    elements.answerArea.appendChild(grid);
  }

  function distractorsFor(card) {
    const answer = Number(card.answer);
    const candidates = card.operator === "+"
      ? [Math.abs(card.a - card.b), answer - 1, answer + 1, answer - 2, answer + 2, card.a, card.b]
      : [card.a + card.b, answer - 1, answer + 1, answer + 2, card.b, card.a];
    const unique = [];
    candidates.forEach(value => {
      const number = Number(value);
      if (Number.isFinite(number) && number >= 0 && number !== answer && !unique.includes(number)) unique.push(number);
    });
    for (let offset = 3; unique.length < 3; offset += 1) {
      const candidate = answer + offset;
      if (!unique.includes(candidate)) unique.push(candidate);
    }
    return unique.slice(0, 3);
  }

  function explanationFor(card) {
    return `${card.a} ${card.operator} ${card.b} = ${formatNumber(card.answer)}.`;
  }

  function renderFreeAnswer() {
    const row = document.createElement("div");
    row.className = "free-row";
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.placeholder = "Écris le résultat";
    input.setAttribute("aria-label", "Résultat du calcul");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Valider";
    const submit = () => {
      if (answered || !input.value.trim()) return;
      const parsed = parseFrenchNumber(input.value);
      evaluate(Number.isFinite(parsed) && Math.abs(parsed - currentCard.answer) < 0.000001, input.value);
      input.disabled = true;
      button.disabled = true;
    };
    button.addEventListener("click", submit);
    input.addEventListener("keydown", event => { if (event.key === "Enter") submit(); });
    row.append(input, button);
    elements.answerArea.appendChild(row);
    window.setTimeout(() => input.focus(), 0);
  }

  function parseFrenchNumber(value) {
    return Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 4 }).format(value);
  }

  function evaluate(correct, given) {
    if (answered) return;
    answered = true;
    const elapsed = Math.max(250, Math.round(performance.now() - startedAt));
    const stats = cardStats(currentCard.id);
    const modeStats = stats.modes[state.selectedMode];
    const levelIndex = currentCard.originLevel - 1;
    const fastLimit = bank.settings.fastTimeMs[state.selectedMode][levelIndex];
    const slowLimit = bank.settings.slowTimeMs[state.selectedMode][levelIndex];
    const wasFast = correct && elapsed <= fastLimit;
    const wasSlow = correct && elapsed >= slowLimit;

    session.answered += 1;
    session.timeMs += elapsed;
    if (!correct) session.errors += 1;

    state.totals.attempts += 1;
    modeStats.attempts += 1;
    modeStats.totalMs += elapsed;
    modeStats.lastMs = elapsed;
    stats.lastSeen = Date.now();

    if (correct) {
      state.totals.correct += 1;
      modeStats.correct += 1;
      stats.successes += 1;
      stats.fastSuccessStreak = wasFast ? stats.fastSuccessStreak + 1 : 0;
      const change = wasFast ? -9 - Math.min(4, stats.fastSuccessStreak) : wasSlow ? 5 : -4;
      stats.personalDifficulty = clamp(stats.personalDifficulty + change, 0, 100);
    } else {
      stats.errors += 1;
      stats.fastSuccessStreak = 0;
      stats.personalDifficulty = clamp(stats.personalDifficulty + 22, 0, 100);
    }

    const timeLabel = `${(elapsed / 1000).toFixed(1).replace(".", ",")} s`;
    const answerLabel = formatNumber(currentCard.answer);
    elements.feedback.className = `feedback show ${correct ? "good" : "bad"}`;
    elements.feedback.innerHTML = correct
      ? `<strong>Bravo, c’est juste !</strong>${escapeHtml(explanationFor(currentCard))} Temps : ${timeLabel}${wasFast ? " · Réponse rapide !" : wasSlow ? " · Tu peux encore automatiser ce calcul." : ""}`
      : `<strong>Pas encore : la réponse est ${answerLabel}.</strong>${escapeHtml(explanationFor(currentCard))} Ta réponse : ${escapeHtml(String(given))}. Cette carte reviendra un peu plus souvent.`;
    session.pendingFinish = session.answered >= session.target || (session.type === "challenge" && !correct);
    elements.nextButton.textContent = session.pendingFinish ? "Voir le résultat" : "Calcul suivant";
    elements.nextRow.className = "next-row show";
    renderSessionStatus();
    renderSummary();
    saveState();
    elements.nextButton.focus();
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  function averageForMode(mode) {
    let attempts = 0;
    let totalMs = 0;
    Object.values(state.cards).forEach(stats => {
      const modeStats = stats.modes?.[mode];
      if (!modeStats) return;
      attempts += Number(modeStats.attempts) || 0;
      totalMs += Number(modeStats.totalMs) || 0;
    });
    return attempts ? totalMs / attempts : null;
  }

  function renderSummary() {
    const attempts = state.totals.attempts;
    const rate = attempts ? Math.round((state.totals.correct / attempts) * 100) : 0;
    const fragile = bank.cards.filter(isFragile).length;
    const reviews = activePool().filter(card => card.originLevel < state.selectedLevel).length;
    const qcmAverage = averageForMode("qcm");
    const freeAverage = averageForMode("libre");
    elements.successRate.textContent = attempts ? `${rate} %` : "—";
    elements.answerCount.textContent = attempts;
    elements.successMeter.style.width = `${rate}%`;
    elements.fragileCount.textContent = fragile;
    elements.reviewCount.textContent = reviews;
    elements.qcmTime.textContent = qcmAverage ? `${(qcmAverage / 1000).toFixed(1).replace(".", ",")} s` : "—";
    elements.freeTime.textContent = freeAverage ? `${(freeAverage / 1000).toFixed(1).replace(".", ",")} s` : "—";
    elements.fastStreak.textContent = currentCard ? cardStats(currentCard.id).fastSuccessStreak : 0;
  }

  function syncControls() {
    const locked = Boolean(session);
    elements.levelTabs.forEach(button => {
      button.setAttribute("aria-selected", String(Number(button.dataset.level) === state.selectedLevel));
      button.disabled = locked;
    });
    elements.modeButtons.forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.selectedMode));
      button.disabled = locked;
    });
  }

  function selectLevel(level) {
    if (session) return;
    state.selectedLevel = clamp(level, 1, 3);
    state.lastCardId = null;
    syncControls();
    renderRecords();
    renderSummary();
    saveState();
  }

  function selectMode(mode) {
    if (session) return;
    state.selectedMode = mode === "libre" ? "libre" : "qcm";
    syncControls();
    renderRecords();
    saveState();
  }

  function resetProgress() {
    if (!window.confirm("Effacer toute la progression enregistrée pour ce jeu ?")) return;
    try { localStorage.removeItem(storageKey); } catch (_) {}
    state = {
      selectedLevel: 1,
      selectedMode: "qcm",
      lastCardId: null,
      totals: { attempts: 0, correct: 0 },
      records: { evaluation: {}, challenge: {} },
      cards: {}
    };
    session = null;
    syncControls();
    bank.cards.forEach(card => cardStats(card.id));
    showStartScreen();
  }

  function validateBank(value) {
    if (!value || !Array.isArray(value.cards) || !value.cards.length) throw new Error("Banque vide");
    const ids = new Set(value.cards.map(card => card.id));
    if (ids.size !== value.cards.length) throw new Error("Identifiants de cartes en double");
    return value;
  }

  function installBank(value) {
    bank = validateBank(value);
    session = null;
    loadState();
    bank.cards.forEach(card => cardStats(card.id));
    syncControls();
    elements.loading.hidden = true;
    showStartScreen();
  }

  function cachedBank() {
    try { return validateBank(JSON.parse(localStorage.getItem(dataStorageKey))); }
    catch (_) { return null; }
  }

  function rememberBank(value) {
    try { localStorage.setItem(dataStorageKey, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function setLocalStatus(message, isError = false) {
    if (!elements.localDataStatus) return;
    elements.localDataStatus.textContent = message;
    elements.localDataStatus.classList.toggle("error", isError);
  }

  function readLocalBank(file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const value = validateBank(JSON.parse(reader.result));
        const remembered = rememberBank(value);
        installBank(value);
        setLocalStatus(remembered
          ? `Données locales actualisées avec « ${file.name} ».`
          : `« ${file.name} » est chargé, mais le navigateur n’a pas permis de le mémoriser.`);
      } catch (error) {
        setLocalStatus(`Fichier refusé : ${error.message}. La dernière copie valide est conservée.`, true);
      }
    });
    reader.addEventListener("error", () => setLocalStatus("Le fichier sélectionné n’a pas pu être lu.", true));
    reader.readAsText(file, "utf-8");
  }

  async function start() {
    if (isLocalFile) {
      elements.localDataLoader.hidden = false;
      elements.localDataFile.addEventListener("change", () => {
        if (elements.localDataFile.files[0]) readLocalBank(elements.localDataFile.files[0]);
        elements.localDataFile.value = "";
      });
      const saved = cachedBank();
      if (saved) {
        installBank(saved);
        setLocalStatus("Application démarrée avec la copie locale mémorisée. Recharge le JSON ici après une modification.");
      } else {
        elements.loading.classList.add("error");
        elements.loading.innerHTML = `Le navigateur ne peut pas lire automatiquement <b>${escapeHtml(dataFile)}</b> en ouverture locale.<br>Charge-le avec le bouton placé en bas de la page.`;
      }
      return;
    }

    try {
      const response = await fetch(dataFile, { cache: "no-store" });
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      installBank(await response.json());
    } catch (error) {
      elements.loading.classList.add("error");
      elements.loading.innerHTML = `Impossible de charger automatiquement <b>${escapeHtml(dataFile)}</b>.`;
      console.error(error);
    }
  }

  elements.levelTabs.forEach(button => button.addEventListener("click", () => selectLevel(Number(button.dataset.level))));
  elements.modeButtons.forEach(button => button.addEventListener("click", () => selectMode(button.dataset.mode)));
  elements.playModeButtons.forEach(button => button.addEventListener("click", () => startRound(button.dataset.playMode)));
  elements.nextButton.addEventListener("click", advanceSession);
  elements.homeButton.addEventListener("click", showStartScreen);
  elements.resetButton.addEventListener("click", resetProgress);

  start();
})();
