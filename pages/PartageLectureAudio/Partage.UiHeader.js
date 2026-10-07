/* =====================================================
   Partage.UiHeader.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.UiHeader.js (prioritaire)
   Titre éditable (déclaratif) + contrôles persistants
   VERSION EXPORT-SAFE — DOM NON DESTRUCTIF
   ===================================================== */

const uiHeader = (function(){

  let initialized = false;

  let headerEl;
  let titleEl;
  let pageConfigEl;

  let teleRapCheckbox;

  /* ===============================
     UTILITAIRES
     =============================== */

  function qs(id){
    return document.getElementById(id);
  }

  function readPageConfig(){
    if (!pageConfigEl) return {};
    try {
      return JSON.parse(pageConfigEl.textContent || "{}");
    } catch {
      return {};
    }
  }

  function writePageConfig(cfg){
    if (!pageConfigEl) return;
    pageConfigEl.textContent = JSON.stringify(cfg, null, 2);
  }

  /* ===============================
     INITIALISATION
     =============================== */

  function init(options = {}){

    if (initialized) return;
    initialized = true;

    headerEl = qs(options.headerTarget || "zone-header");
    titleEl  = qs("page-title");
    pageConfigEl = qs("page-config");

    if (!headerEl || !titleEl || !pageConfigEl){
      console.warn(
        "uiHeader: éléments requis manquants (zone-header, page-title, page-config)"
      );
      return;
    }

    initTitle();
    // TéléRap : désactivé (n'est créé que si la page le demande explicitement)
    if (options.teleRap === true) {
      initTeleRap(options.controlsTarget || "zone-navigation");
    }
  }

  /* ===============================
     TITRE (DÉCLARATIF)
     =============================== */

  function initTitle(){
    // titre lu dans #page-config ; il n'est pas modifiable depuis la page
    const cfg = readPageConfig();
    if (cfg.title){
      titleEl.textContent = cfg.title;
    }
    titleEl.removeAttribute("contenteditable");
  }


  /* ===============================
     TÉLÉRAP (LOCALSTORAGE OK)
     =============================== */

  function initTeleRap(targetId){

    const target = qs(targetId);
    if (!target) return;

    const wrapper = document.createElement("div");
    wrapper.className = "uiHeader-controls";

    teleRapCheckbox = document.createElement("input");
    teleRapCheckbox.type = "checkbox";
    teleRapCheckbox.checked =
      localStorage.getItem("uiHeader::teleRap") === "true";

    teleRapCheckbox.addEventListener("change", () => {
      localStorage.setItem(
        "uiHeader::teleRap",
        teleRapCheckbox.checked
      );
    });

    const label = document.createElement("label");
    label.appendChild(teleRapCheckbox);
    label.append(" TéléRap");

    wrapper.appendChild(label);
    target.appendChild(wrapper);
  }

  /* ===============================
     API PUBLIQUE
     =============================== */

  return {
    init,

    isTeleRapEnabled(){
      return teleRapCheckbox?.checked === true;
    }
  };

})();

/* ---------- exposition globale ---------- */
window.uiHeader = uiHeader;

/* ---------- initialisation ----------
   Appelée par initPage() (dans le HTML), une fois tous les modules
   chargés. Pas d'auto-init : elle entrerait en concurrence avec initPage. */
