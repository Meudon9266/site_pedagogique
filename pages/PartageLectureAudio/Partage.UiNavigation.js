/* =====================================================
   Partage.UiNavigation.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.UiNavigation.js (prioritaire)
   Navigation standard partagée
   Compatible file://
   ===================================================== */

const uiNavigation = (function(){

  /* ---------- utilitaires ---------- */

  function qs(id){
    return document.getElementById(id);
  }

  function getCurrentFile(){
    return location.pathname.split("/").pop();
  }

  /* ---------- boutons ---------- */

  function buildHomeButton(navEl){
    const btn = document.createElement("button");
    btn.textContent = "Accueil";

    btn.addEventListener("click", () => {
      // logique simple compatible file://
      if(getCurrentFile() === "index.html"){
        return;
      }
      location.href = "./index.html";
    });

    navEl.appendChild(btn);
  }

  function buildNextButton(navEl){
    const current = getCurrentFile();

    // Pas de suivant pour les pages racines
    if(current === "index.html" || current === "prototype.html"){
      return;
    }

    const match = current.match(/^(.*?)(N(\d+))\.html$/);
    if(!match) return;

    const base = match[1];
    const currentN = parseInt(match[3], 10);
    const nextN = currentN + 1;
    const nextFile = base + "N" + nextN + ".html";

    const btn = document.createElement("button");
    btn.textContent = "Exercice suivant";

    btn.addEventListener("click", () => {
      location.href = nextFile;
    });

    navEl.appendChild(btn);
  }

  function buildScore(navEl){
    if(typeof window.scoreManager === "undefined"){
      console.warn("uiNavigation: scoreManager indisponible");
      return;
    }

    // score de la séance : réussites et erreurs
    const scoreEl = document.createElement("span");
    scoreEl.className = "uiNavigation-score";

    const btnErreurs = document.createElement("button");
    btnErreurs.type = "button";
    btnErreurs.className = "uiNavigation-btn-erreurs";
    btnErreurs.setAttribute("aria-expanded", "false");

    // liste des erreurs, sous la barre de navigation
    const panneau = document.createElement("div");
    panneau.className = "uiNavigation-erreurs";
    panneau.setAttribute("data-injecte-par", "uiNavigation");
    panneau.hidden = true;

    function ligne(tag, cls, texte){
      const e = document.createElement(tag);
      if(cls) e.className = cls;
      if(texte !== undefined) e.textContent = texte;
      return e;
    }

    function remplirPanneau(){
      const liste = scoreManager.getErreurs ? scoreManager.getErreurs() : [];
      panneau.textContent = "";
      const tete = ligne("div", "uiNavigation-erreurs-tete");
      tete.appendChild(ligne("strong", "", "Mes erreurs de la séance en cours (" + liste.length + ")"));
      const fermer = ligne("button", "", "Fermer");
      fermer.type = "button";
      fermer.addEventListener("click", () => basculer(false));
      tete.appendChild(fermer);
      panneau.appendChild(tete);

      if(!liste.length){
        panneau.appendChild(ligne("p", "", "Aucune erreur pour l'instant. 👍"));
        ajouterHistorique();
        return;
      }
      const ol = ligne("ol");
      liste.forEach(e => {
        const li = ligne("li");
        li.appendChild(ligne("div", "uiNavigation-erreur-q",
          (e.quiz ? "Quiz " + e.quiz + " · " : "") + (e.question || e.id || "")));
        const d = ligne("div", "uiNavigation-erreur-donnee");
        d.appendChild(ligne("span", "", "✘ Ma réponse : "));
        d.appendChild(ligne("em", "", e.donnee || "—"));
        li.appendChild(d);
        const r = ligne("div", "uiNavigation-erreur-attendue");
        r.appendChild(ligne("span", "", "✔ Réponse attendue : "));
        r.appendChild(ligne("em", "", e.attendue || "—"));
        li.appendChild(r);
        ol.appendChild(li);
      });
      panneau.appendChild(ol);
      ajouterHistorique();
    }

    // historique des séances de cet exercice sur cet ordinateur
    function ajouterHistorique(){
      if(typeof scoreManager.getHistorique !== "function") return;
      const seances = scoreManager.getHistorique();
      if(!seances.length) return;
      panneau.appendChild(ligne("div", "uiNavigation-erreurs-tete", ""))
        .appendChild(ligne("strong", "", "Mes séances (" + seances.length + ")"));
      const table = ligne("table", "uiNavigation-historique");
      const tete = ligne("tr");
      ["Début", "✔", "✘", "Questions faites", "État"].forEach(t => tete.appendChild(ligne("th", "", t)));
      table.appendChild(tete);
      const fmt = t => new Date(t).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" });
      seances.slice().reverse().forEach(sea => {
        const tr = ligne("tr", sea.enCours ? "en-cours" : "");
        tr.appendChild(ligne("td", "", fmt(sea.debut)));
        tr.appendChild(ligne("td", "", String(sea.reussites)));
        tr.appendChild(ligne("td", "", String(sea.erreurs)));
        tr.appendChild(ligne("td", "", sea.total ? sea.faites + " / " + sea.total : "—"));
        let etat = sea.termine ? "terminée" : "non terminée";
        if(sea.reprises) etat += " · reprise " + sea.reprises + "×";
        if(sea.enCours) etat += " · en cours";
        tr.appendChild(ligne("td", "", etat));
        table.appendChild(tr);
      });
      panneau.appendChild(table);
    }

    function basculer(ouvrir){
      panneau.hidden = !ouvrir;
      btnErreurs.setAttribute("aria-expanded", ouvrir ? "true" : "false");
      if(ouvrir) remplirPanneau();
    }

    // avertissement : séance précédente non terminée, reprise avec son score
    const avis = document.createElement("span");
    avis.className = "uiNavigation-reprise";
    avis.hidden = true;

    function update(){
      const etat = scoreManager.getState ? scoreManager.getState() : { erreurs: 0, total: 0 };
      const nbErr = etat.erreurs || 0;
      let texte = "Score : ✔ " + scoreManager.get() + " · ✘ " + nbErr;
      if(etat.total) texte += " · " + etat.faites + "/" + etat.total + (etat.termine ? " ✅" : "");
      scoreEl.textContent = texte;
      scoreEl.title = etat.total
        ? "Questions réussies · erreurs · questions déjà tentées sur le total"
        : "Questions réussies · erreurs";
      btnErreurs.textContent = "Mes erreurs (" + nbErr + ")";
      btnErreurs.disabled = false;
      if(etat.reprise && !etat.termine){
        avis.hidden = false;
        avis.textContent = "↻ Séance précédente non terminée : le score continue.";
      } else {
        avis.hidden = true;
      }
      if(!panneau.hidden) remplirPanneau();
    }

    btnErreurs.addEventListener("click", () => basculer(panneau.hidden));

    update();
    if(typeof scoreManager.onChange === "function") scoreManager.onChange(update);
    else setInterval(update, 500);

    navEl.appendChild(scoreEl);
    navEl.appendChild(btnErreurs);
    navEl.appendChild(avis);
    navEl.insertAdjacentElement("afterend", panneau);
  }

  /* ---------- Téléportation TéléRap + Export ---------- */

  function attachHeaderControls(navEl){
    const controls = document.getElementById("uiHeader-controls");
    if(!controls) return false;

    navEl.appendChild(controls);
    return true;
  }

  /* ---------- initialisation ---------- */

  function init(){
    const navEl = qs("zone-navigation");
    if(!navEl){
      console.warn("uiNavigation: #zone-navigation introuvable");
      return;
    }

    navEl.innerHTML = "";
    // mise en page : voir #zone-navigation dans format.css (ordinateur et téléphone)

    buildHomeButton(navEl);
    buildNextButton(navEl);
    buildScore(navEl);

    // déplacement TéléRap + Export (robuste)
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if(attachHeaderControls(navEl) || tries > 20){
        clearInterval(timer);
      }
    }, 100);
  }

  return { init };

})();

/* ---------- exposition globale ---------- */
window.uiNavigation = uiNavigation;
