/* Zoo de Calcul — voix. Même solution que le Zoo de Lecture (listenSpeak dans zoo-connecte.html) : synthèse vocale du navigateur,
   gratuite, en français de France, un peu lente pour les enfants. Aucun service payant ni fichier audio.
   (Copie volontaire d'une quinzaine de lignes pour ne pas toucher à la page de lecture ; à mutualiser plus tard.) */
(function (root) {
  "use strict";
  function ok() { return !!(root.speechSynthesis && root.SpeechSynthesisUtterance); }
  function pickVoice() {
    var voices = root.speechSynthesis.getVoices ? root.speechSynthesis.getVoices() : [];
    var frs = voices.filter(function (v) { return /^fr/i.test(v.lang); });
    var frFR = frs.filter(function (v) { return /^fr[-_]FR/i.test(v.lang); });
    /* Voix de France d'abord (Thomas sur Mac et iPad, puis toute voix fr-FR) ; une voix canadienne seulement à défaut */
    return frFR.filter(function (v) { return /thomas|audrey|aurélie|marie|google/i.test(v.name); })[0] || frFR[0] || frs[0] || null;
  }
  function stop() { try { if (ok()) root.speechSynthesis.cancel(); } catch (e) {} }
  function speak(text, onend) {
    try {
      if (!ok()) return false;
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = "fr-FR"; u.rate = 0.8; u.pitch = 1; u.volume = 1;
      var v = pickVoice(); if (v) u.voice = v;
      if (onend) { u.onend = onend; u.onerror = onend; }
      root.speechSynthesis.cancel();
      root.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  root.CalcVoice = { available: ok, speak: speak, stop: stop };
})(typeof window !== "undefined" ? window : this);
