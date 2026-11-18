/* Lecteur des sons enregistrés du Zoo (syllabes, graphèmes, sons du CP) — audio/syllabes.mp3 + audio/syllabes.json,
   fabriqués par tools/build_audio_sprite.py (une seule voix, identique sur iPad, ordinateur, Chromebook et Android).
   Besoin : vendor/howler.core.min.js chargé avant. Syntaxe ES5 (anciens iPad iOS 12).

   window.ZooAudio.play(texte, fin)  → vrai si le son enregistré est joué ; faux s'il n'existe pas ou n'est pas encore chargé
   window.ZooAudio.has(texte)        → vrai si le texte a un son enregistré
   window.ZooAudio.stop()            → arrête le son en cours
   window.playLectureAudio(texte, fin) → son enregistré, sinon voix de l'appareil (fr-FR, vitesse 0,9)

   Le texte est cherché en minuscules, sans espaces autour : d'abord comme écriture (« ba », « ch », « voy:a »),
   puis comme texte dit (« l’eau »). Howler débloque le son au premier toucher (obligatoire sur iPad / iPhone).

   « 🎙 Mes sons » (18/11/2026) : la voix enregistrée par l'admin (espace enseignant › Réglages généraux) passe d'abord.
   Liste lue par get_voice_overrides() ({clip: fichier.wav}), fichiers WAV du bucket public « voix-zoo ». Ordre : voix de l'admin,
   sinon son du Zoo, sinon voix de l'appareil. Tests : window.ZOO_VOICES = {map: {...}, base: "dossier/"} remplace l'appel au serveur. */
(function () {
  "use strict";
  var map = null, howl = null, loaded = false, failed = false, cur = null, BASE = "audio/";
  var SUPA = "https://pcxpazpflnlwmhyuozdx.supabase.co", KEY = "sb_publishable_j65mDpDNsuwwaL6uRjsMtA_U_OXQXlL";
  var VO = {}, VBASE = SUPA + "/storage/v1/object/public/voix-zoo/", VH = {};   /* voix de l'admin : clip → fichier ; Howl par clip */
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
  function stop() {
    try { if (howl) howl.stop(); } catch (e) {}
    for (var k in VH) if (VH.hasOwnProperty(k) && VH[k].h) { try { VH[k].h.stop(); } catch (e) {} }
    cur = null;
  }
  /* Voix de l'admin : liste demandée au serveur (lecture seule, sans compte), puis chaque fichier préchargé (≈ 30 Ko) */
  function loadVoices() {
    var T = window.ZOO_VOICES;
    if (T && T.map) { if (T.base) VBASE = T.base; setVoices(T.map); return; }
    if (!window.XMLHttpRequest) return;
    try {
      var x = new XMLHttpRequest();
      x.open("POST", SUPA + "/rest/v1/rpc/get_voice_overrides");
      x.setRequestHeader("apikey", KEY); x.setRequestHeader("Authorization", "Bearer " + KEY); x.setRequestHeader("Content-Type", "application/json");
      x.onload = function () { if (x.status >= 200 && x.status < 300) { try { setVoices(JSON.parse(x.responseText)); } catch (e) {} } };
      x.send("{}");
    } catch (e) {}
  }
  function setVoices(m) {
    if (!m || typeof m !== "object") return;
    VO = {};
    for (var c in m) if (m.hasOwnProperty(c) && /^[a-z0-9_-]{1,60}\.wav$/.test(String(m[c]))) VO[c] = m[c];
    var n = 0;
    for (var k in VO) if (VO.hasOwnProperty(k) && n++ < 120) voiceHowl(k);
  }
  function voiceHowl(c) {
    if (VH[c] && VH[c].file === VO[c]) return VH[c];
    var v = VH[c] = { file: VO[c], ok: false, bad: false, h: null };
    try {
      v.h = new window.Howl({ src: [VBASE + VO[c]], format: ["wav"], preload: true, html5: false,
        onload: function () { v.ok = true; }, onloaderror: function () { v.bad = true; } });
    } catch (e) { v.bad = true; }
    return v;
  }
  /* Voix de l'admin prête pour ce clip ? (pas encore chargée ou en panne → son du Zoo) */
  function voiceOf(c) { if (!c || !VO[c] || !window.Howl) return null; var v = voiceHowl(c); return v.ok && !v.bad ? v : null; }
  /* Le son de la tablette peut être « endormi » (iPad : après la voix de l'appareil, un appel, l'écran verrouillé…) : Howler joue alors
     sans rien faire entendre. On le réveille d'abord ; s'il ne se réveille pas vite, la voix de l'appareil dit le texte (constaté le 18/11/2026 : « on » muet dans J'entends). */
  function ctxState() { try { return window.Howler && Howler.ctx ? Howler.ctx.state : "running"; } catch (e) { return "running"; } }
  function play(t, fin) {
    var c = clipOf(t), v = voiceOf(c);
    if (!c || (!v && (!loaded || failed || !howl))) return false;
    if (ctxState() !== "running") {
      var ok = false, gone = false;
      stop();
      try { Howler.ctx.resume().then(function () { if (gone) return; ok = true; start(c, fin); }, function () {}); } catch (e) {}
      setTimeout(function () { if (!ok) { gone = true; device(t, fin); } }, 400);
      return true;
    }
    return start(c, fin);
  }
  function start(c, fin) {
    try {
      stop();
      var v = voiceOf(c), h = v ? v.h : howl;
      if (!h || (!v && (!loaded || failed))) return false;
      var id = v ? h.play() : h.play(c);
      cur = id;
      if (fin) {
        var done = false, end = function () { if (!done) { done = true; fin(); } };
        h.once("end", end, id);
        h.once("stop", end, id);
        h.once("playerror", end, id);
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
    voices: function () { return VO; },
    voiceReady: function (t) { return !!voiceOf(clipOf(t)); },
    map: function () { return map; }
  };
  window.playLectureAudio = function (t, fin) {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    if (play(t, fin)) return true;
    stop(); device(t, fin); return false;
  };
  /* Boutique / salle de jeux affichées dans le Zoo de Calcul (?integre=1) : pas d'exercice de lecture, on ne charge rien */
  if (!/[?&]integre=1/.test(location.search)) { load(); loadVoices(); }
})();
