/* =====================================================
   Partage.MicroRepetition.js  (commun à tous les exercices)
   Version propre à un exercice possible : NomdeRef.MicroRepetition.js (prioritaire)
   Enregistrement simple de la voix élève
   - Voyant 🔴 REC
   - Arrêt automatique après 15 secondes
   - Sans reconnaissance vocale
   - Sans score
   ===================================================== */

/* ============================
   Paramètres
   ============================ */
const MAX_RECORD_DURATION = 15000; // 15 secondes

/* ============================
   Variables globales
   ============================ */
let mediaRecorder = null;
let audioChunks = [];
let audioEleveURL = null;
let isRecording = false;
let recordTimeout = null;

/* ============================
   Voyant REC
   ============================ */
function showRecIndicator() {
  const rec = document.getElementById("voyant-rec");
  if (rec) rec.classList.remove("hidden");
}

function hideRecIndicator() {
  const rec = document.getElementById("voyant-rec");
  if (rec) rec.classList.add("hidden");
}

/* ============================
   Enregistrement audio
   ============================ */
async function toggleRecording() {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        audioEleveURL = URL.createObjectURL(blob);

        const btnEcoute = document.getElementById("btn-ecoute-eleve");
        if (btnEcoute) btnEcoute.disabled = false;

        hideRecIndicator();

        if (recordTimeout) {
          clearTimeout(recordTimeout);
          recordTimeout = null;
        }
      };

      mediaRecorder.start();
      isRecording = true;
      showRecIndicator();

      // ⏱️ arrêt automatique après 15 secondes
      recordTimeout = setTimeout(() => {
        if (isRecording && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          isRecording = false;
        }
      }, MAX_RECORD_DURATION);

    } catch (err) {
      console.error("Micro inaccessible :", err);
      alert("Le micro n’est pas accessible.");
    }

  } else {
    mediaRecorder.stop();
    isRecording = false;
  }
}

/* ============================
   Lecture audio élève
   ============================ */
function playStudentRecording() {
  if (!audioEleveURL) return;
  const audio = new Audio(audioEleveURL);
  audio.play();
}

/* ============================
   Initialisation globale
   ============================ */
function initMicroRepetition() {
  const btnMicro = document.getElementById("btn-micro");
  const btnEcoute = document.getElementById("btn-ecoute-eleve");

  if (btnMicro) {
    btnMicro.addEventListener("click", toggleRecording);
  }

  if (btnEcoute) {
    btnEcoute.addEventListener("click", playStudentRecording);
  }
}

/* ============================
   Exposition globale
   ============================ */
window.initMicroRepetition = initMicroRepetition;
