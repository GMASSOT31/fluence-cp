/* Lecteur des sons enregistrés du Zoo (syllabes, graphèmes, sons du CP) — audio/syllabes.mp3 + audio/syllabes.json,
   fabriqués par tools/build_audio_sprite.py (une seule voix, identique sur iPad, ordinateur, Chromebook et Android).
   Besoin : vendor/howler.core.min.js chargé avant. Syntaxe ES5 (anciens iPad iOS 12).

   window.ZooAudio.play(texte, fin)  → vrai si le son enregistré est joué ; faux s'il n'existe pas ou n'est pas encore chargé
   window.ZooAudio.has(texte)        → vrai si le texte a un son enregistré
   window.ZooAudio.stop()            → arrête le son en cours
   window.playLectureAudio(texte, fin) → son enregistré, sinon voix de l'appareil (fr-FR, vitesse 0,9)

   Le texte est cherché en minuscules, sans espaces autour : d'abord comme écriture (« ba », « ch », « voy:a »),
   puis comme texte dit (« l’eau »). Howler débloque le son au premier toucher (obligatoire sur iPad / iPhone). */
(function () {
  "use strict";
  var map = null, howl = null, loaded = false, failed = false, cur = null, BASE = "audio/";
  function norm(t) { return String(t == null ? "" : t).replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ").toLowerCase().replace(/'/g, "’"); }
  function clipOf(t) {
    if (!map) return null;
    var n = norm(t);
    if (map.keys.hasOwnProperty(n)) return map.keys[n];
    if (map.sprite.hasOwnProperty(n)) return n;
    return null;
  }
  function load() {
    if (!window.Howl || !window.XMLHttpRequest) { failed = true; return; }
    try {
      var x = new XMLHttpRequest();
      x.open("GET", BASE + "syllabes.json?v=" + (window.ZOO_AUDIO_V || "1"));
      x.onload = function () {
        if (x.status < 200 || x.status >= 300) { failed = true; return; }
        try { map = JSON.parse(x.responseText); } catch (e) { failed = true; return; }
        if (!map || !map.sprite || !map.keys) { failed = true; map = null; return; }
        var sprite = {};
        for (var k in map.sprite) if (map.sprite.hasOwnProperty(k)) sprite[k] = map.sprite[k];
        howl = new window.Howl({
          src: [map.src],
          sprite: sprite, preload: true, html5: false,
          onload: function () { loaded = true; },
          onloaderror: function () { failed = true; }
        });
      };
      x.onerror = function () { failed = true; };
      x.send();
    } catch (e) { failed = true; }
  }
  function stop() { try { if (howl) howl.stop(); } catch (e) {} cur = null; }
  function play(t, fin) {
    var c = clipOf(t);
    if (!c || !loaded || failed || !howl) return false;
    try {
      stop();
      var id = howl.play(c);
      cur = id;
      if (fin) {
        var done = false, end = function () { if (!done) { done = true; fin(); } };
        howl.once("end", end, id);
        howl.once("stop", end, id);
        howl.once("playerror", end, id);
      }
      return true;
    } catch (e) { return false; }
  }
  /* Voix de l'appareil, en secours (mots, phrases, ou fichier pas encore chargé) */
  function device(t, fin) {
    try {
      var S = window.speechSynthesis;
      if (!S || !window.SpeechSynthesisUtterance) { if (fin) fin(); return; }
      var u = new window.SpeechSynthesisUtterance(t);
      u.lang = "fr-FR"; u.rate = 0.9;
      var vs = S.getVoices ? S.getVoices() : [], fr = [], i;
      for (i = 0; i < vs.length; i++) if (/^fr[-_]FR/i.test(vs[i].lang)) fr.push(vs[i]);
      var best = null;
      for (i = 0; i < fr.length && !best; i++) if (fr[i].localService && /thomas|audrey|aurélie|amélie|marie|google/i.test(fr[i].name)) best = fr[i];
      u.voice = best || fr[0] || null;
      if (fin) { u.onend = fin; u.onerror = fin; }
      S.cancel();
      setTimeout(function () { try { S.speak(u); } catch (e) { if (fin) fin(); } }, 90);   /* Safari 12 : parler juste après cancel() perd la phrase */
    } catch (e) { if (fin) fin(); }
  }
  window.ZooAudio = {
    play: play, stop: stop, norm: norm,
    has: function (t) { return !!clipOf(t); },
    ready: function () { return loaded && !failed; },
    keys: function () { return map ? Object.keys(map.keys) : []; },
    map: function () { return map; }
  };
  window.playLectureAudio = function (t, fin) {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    if (play(t, fin)) return true;
    stop(); device(t, fin); return false;
  };
  /* Boutique / salle de jeux affichées dans le Zoo de Calcul (?integre=1) : pas d'exercice de lecture, on ne charge rien */
  if (!/[?&]integre=1/.test(location.search)) load();
})();
