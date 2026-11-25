/* Aide automatique à l'écoute des lectures enregistrées (prototype, 25/11/2026).
   100 % sur l'appareil : l'enregistrement ne quitte jamais la tablette.
   Reconnaissance vocale hors ligne : vosk-browser 0.0.8 (Apache-2.0, vendor/vosk/vosk.js)
   + modèle français vosk-model-small-fr-0.22 (Apache-2.0, vendor/vosk/modele-fr.tar.gz, ≈ 42 Mo,
   téléchargé seulement quand le maître(sse) touche « Proposer automatiquement », puis gardé par le navigateur).
   Le vocabulaire est limité aux mots de l'exercice (grammaire) : la machine choisit parmi ces mots.
   Ce n'est qu'une PROPOSITION : le maître(sse) vérifie, corrige et valide toujours.
   Écrit en ES5 : le fichier est lu sans erreur par les anciens iPad, qui n'affichent pas le bouton. */
(function () {
  "use strict";
  var V = "1";
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^\/]*$/, "") : "";
  })();
  var modelP = null, vocabP = null, voskP = null;

  function url(p) { try { return new URL(p, BASE || location.href).href; } catch (e) { return p; } }

  /* L'appareil peut-il le faire ?
     supported()          : calcul automatique après l'enregistrement → tablettes récentes seulement (iOS 14 et plus).
     supported("demande") : bouton « Proposer automatiquement » de l'écoute → aussi les anciens iPad (iOS 11 à 13, essai du 25/11/2026 :
                            EventTarget remplacé, son décodé et ramené à 16 kHz à la main). Risque : mémoire (1 Go) → la page peut se recharger. */
  function ancien() {
    var ios = /(iPhone|iPad|iPod).* OS (\d+)_/.exec(navigator.userAgent);
    return !!ios && parseInt(ios[2], 10) < 14;
  }
  function supported(mode) {
    try {
      if (mode === "demande" && ancien()) {
        var AC0 = window.AudioContext || window.webkitAudioContext, v = /(iPhone|iPad|iPod).* OS (\d+)_/.exec(navigator.userAgent);
        return parseInt(v[2], 10) >= 11 && typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function" &&
          !!window.Worker && !!AC0 && !!window.fetch && !!window.Promise && !!window.indexedDB && !!window.FileReader &&
          typeof Float32Array.prototype.map === "function" && typeof window.TextDecoder === "function";
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (typeof WebAssembly !== "object" || typeof WebAssembly.instantiate !== "function") return false;
      if (!window.Worker || !AC || !OAC || !window.fetch || !window.Promise || !window.indexedDB) return false;
      if (typeof Float32Array.prototype.map !== "function") return false;
      var ios = /(iPhone|iPad|iPod).* OS (\d+)_/.exec(navigator.userAgent);
      if (ios && parseInt(ios[2], 10) < 14) return false;
      if (navigator.deviceMemory && navigator.deviceMemory < 2) return false;
      new EventTarget();   /* vosk-browser en a besoin (absent avant Safari 14) */
      return true;
    } catch (e) { return false; }
  }

  function loadScript(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { ok(); };
      s.onerror = function () { ko(new Error("script")); };
      document.head.appendChild(s);
    });
  }
  /* Safari < 14 : « new EventTarget() » impossible, or vosk-browser en dérive ses objets → petit remplaçant (anciens iPad seulement) */
  function etFix() {
    try { new EventTarget(); return; } catch (e) {}
    var ET = function () { this.__l = {}; };
    ET.prototype.addEventListener = function (t, f) { if (f) (this.__l[t] = this.__l[t] || []).push(f); };
    ET.prototype.removeEventListener = function (t, f) { var a = this.__l[t]; if (a) this.__l[t] = a.filter(function (x) { return x !== f; }); };
    ET.prototype.dispatchEvent = function (ev) {
      var self = this;
      (this.__l[ev.type] || []).slice().forEach(function (f) {
        try { if (typeof f === "function") f.call(self, ev); else if (f && f.handleEvent) f.handleEvent(ev); }
        catch (er) { setTimeout(function () { throw er; }, 0); }
      });
      return true;
    };
    window.EventTarget = ET;
  }
  function vosk() {
    if (window.Vosk) return Promise.resolve(window.Vosk);
    etFix();
    if (!voskP) voskP = loadScript(url("vendor/vosk/vosk.js?v=" + V)).then(function () {
      if (!window.Vosk) throw new Error("vosk");
      return window.Vosk;
    }, function (e) { voskP = null; throw e; });
    return voskP;
  }
  /* Liste des mots que connaît le modèle (135 770 mots) : un mot inconnu n'est ni proposé ni jugé */
  function vocab() {
    if (!vocabP) vocabP = fetch(url("vendor/vosk/mots-fr.txt?v=" + V)).then(function (r) {
      if (!r.ok) throw new Error("vocab");
      return r.text();
    }).then(function (t) {
      var set = Object.create(null);
      t.split("\n").forEach(function (w) { if (w) set[w] = 1; });
      return set;
    }, function (e) { vocabP = null; throw e; });
    return vocabP;
  }
  function model() {
    if (!modelP) modelP = vosk().then(function (Vk) {
      return Vk.createModel(url("vendor/vosk/modele-fr.tar.gz?v=" + V), -2);
    }).then(function (m) {
      if (!m || !m.ready) throw new Error("model");
      return m;
    }, function (e) { modelP = null; throw e; });
    return modelP;
  }

  /* ---------- Mots de l'exercice ---------- */
  function clean(w) {
    w = String(w || "").toLowerCase().replace(/[’ʼ`]/g, "'");
    if (w.normalize) w = w.normalize("NFC");
    return w.replace(/^[^a-z0-9àâäçéèêëîïôöùûüÿœæ']+|[^a-z0-9àâäçéèêëîïôöùûüÿœæ']+$/g, "").replace(/^'+|'+$/g, "");
  }
  /* Code « phonétique » grossier : deux mots qui se prononcent pareil (« lu »/« lue », « fée »/« fé », « a »/« à ») se valent */
  function phon(w) {
    w = String(w).replace(/['-]/g, "");
    w = w.replace(/eaux?$|aux$/, "o").replace(/(er|ez)$/, "é").replace(/et$/, "è");
    w = w.replace(/eau|au|ô/g, "o").replace(/ai|ei|ê|è/g, "è").replace(/à|â/g, "a").replace(/[îï]/g, "i").replace(/[ûù]/g, "u");
    w = w.replace(/ph/g, "f").replace(/qu/g, "k").replace(/c(?=[aou])/g, "k").replace(/ç/g, "s").replace(/h/g, "");
    if (w.length > 2) w = w.replace(/([^aeiouyéè])?(e|es|ent)$/, "$1").replace(/([aeiouyéè])[stxdp]$/, "$1");
    if (w.length > 1) w = w.replace(/e$/, "");
    return w.replace(/(.)\1+/g, "$1");
  }
  /* Écritures de secours pour une syllabe que le modèle ne connaît pas : « lè » → « lait », « fè » → « fait »… */
  function alts(w) {
    var a = [w];
    if (/è$/.test(w)) { var s = w.slice(0, -1); a.push(s + "ait", s + "ai", s + "ès", s + "et", s + "ê"); }
    if (/^[^aeiouyéèêàâîôû]+e$/.test(w)) a.push(w.slice(0, -1) + "eu", w.slice(0, -1) + "eux");
    return a;
  }
  /* Lectures fautives plausibles d'un mot (voyelle ou consonne confondue : « fiche » → « fuche », « bon » → « ban », « dé » → « bé »).
     Ajoutées à la grammaire comme mots possibles : sans elles, un mot mal lu est « tiré » vers le bon mot. */
  var VG = ["ou", "on", "an", "in", "oi", "eu", "a", "e", "i", "o", "u", "é", "è"];
  var CS = { b: "dp", d: "bt", p: "bt", t: "dp", f: "v", v: "f", s: "z", z: "s", m: "n", n: "m", j: "ch", g: "j", l: "r", r: "l", ch: "j" };
  function voisins(w, voc) {
    var out = {}, re = /ou|on|an|in|oi|eu|ch|[aeiouéè]|[bdptfvszmnjglr]/g, mm;
    while ((mm = re.exec(w))) {
      var a = mm[0], i = mm.index, rest = w.slice(i + a.length), pre = w.slice(0, i);
      var rep = VG.indexOf(a) >= 0 ? VG : (CS[a] ? (a === "j" ? ["ch"] : CS[a].split("")) : []);
      if (a === "ch") rep = ["j", "s"];
      rep.forEach(function (b) { if (b !== a && voc[pre + b + rest]) out[pre + b + rest] = 1; });
    }
    return Object.keys(out).filter(function (x) { return x !== w; }).slice(0, 8);
  }
  /* Chaque mot du texte → une ou plusieurs « unités » reconnaissables (« l'âne » reste entier s'il est connu, sinon « l' » + « âne ») */
  function units(words, voc) {
    var out = [];
    words.forEach(function (raw, ti) {
      var w = clean(raw);
      if (!w) return;
      var parts = [w];
      if (!voc[w] && /['-]/.test(w)) parts = w.replace(/'/g, "'|").split(/[|-]/).filter(Boolean);
      parts.forEach(function (p) {
        var keys = alts(p).filter(function (k) { return voc[k]; });
        /* un mot d'une seule lettre (« a », « y ») dit seul est très mal reconnu : il n'est jamais proposé comme erreur */
        out.push({ ti: ti, keys: keys, ph: keys.map(phon), tiny: p.replace(/'/g, "").length < 2, near: keys.length ? voisins(keys[0], voc) : [] });
      });
    });
    return out;
  }

  /* ---------- Son : décoder puis passer à 16 kHz mono ---------- */
  /* ramène le son à 16 kHz « à la main » (moyenne par paquets) : anciens Safari, qui refusent un rendu hors ligne à 16 kHz */
  function to16k(ab) {
    var x = ab.getChannelData(0), r = ab.sampleRate / 16000, n = Math.floor(x.length / r), out = new Float32Array(n), i, j, a, b, sum;
    for (i = 0; i < n; i++) {
      a = Math.floor(i * r); b = Math.max(a + 1, Math.floor((i + 1) * r)); sum = 0;
      for (j = a; j < b && j < x.length; j++) sum += x[j];
      out[i] = sum / (b - a);
    }
    return out;
  }
  function readBlob(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (ok, ko) {
      var fr = new FileReader();
      fr.onload = function () { ok(fr.result); };
      fr.onerror = function () { ko(fr.error); };
      fr.readAsArrayBuffer(blob);
    });
  }
  function decode(blob) {
    var AC = window.AudioContext || window.webkitAudioContext;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    return readBlob(blob).then(function (buf) {
      var ctx = new AC();
      return new Promise(function (ok, ko) {
        ctx.decodeAudioData(buf, ok, ko);
      }).then(function (ab) {
        try { if (ctx.close) ctx.close(); } catch (e) {}
        if (ab.sampleRate === 16000) return ab.getChannelData(0);
        if (!OAC || ancien()) return to16k(ab);
        try {
          var len = Math.max(1, Math.ceil(ab.duration * 16000));
          var off = new OAC(1, len, 16000);
          var src = off.createBufferSource();
          src.buffer = ab; src.connect(off.destination); src.start(0);
          return new Promise(function (ok, ko) {
            off.oncomplete = function (e) { ok(e.renderedBuffer.getChannelData(0)); };
            var p = off.startRendering();
            if (p && p.then) p.then(function (b) { ok(b.getChannelData(0)); }, ko);
          }).then(null, function () { return to16k(ab); });
        } catch (e) { return to16k(ab); }
      });
    });
  }

  /* ---------- Reconnaissance (dans le Worker de vosk) ---------- */
  function recognize(m, samples, grammar, onProgress) {
    return new Promise(function (ok, ko) {
      var rec = new m.KaldiRecognizer(16000, JSON.stringify(grammar));
      rec.setWords(true);
      var words = [], CH = 8000, n = Math.ceil(samples.length / CH), got = 0, done = false;
      function finish(err) {
        if (done) return; done = true;
        try { rec.remove(); } catch (e) {}
        if (err) ko(err); else ok(words);
      }
      function count() {
        got++;
        if (onProgress && got <= n) onProgress(got / n);
        if (got >= n + 1) finish();
      }
      rec.on("result", function (msg) {
        var r = msg && msg.result && msg.result.result;
        if (r) r.forEach(function (x) { words.push({ w: x.word, c: x.conf, s: x.start, e: x.end }); });
        count();
      });
      rec.on("partialresult", count);
      rec.on("error", function (msg) { finish(new Error(msg && msg.error || "reco")); });
      for (var i = 0; i < n; i++) rec.acceptWaveformFloat(samples.slice(i * CH, (i + 1) * CH), 16000);
      rec.retrieveFinalResult();
    });
  }

  /* ---------- Alignement : ce qui est entendu ↔ mots du texte ----------
     Programmation dynamique : début imposé (l'élève commence au début), fin libre (il s'arrête où il veut).
     Correspondance +2, mot du texte sauté ou remplacé −1, mot entendu en plus (répétition, hésitation) −0,5. */
  function align(U, R) {
    var n = U.length, m = R.length, i, j;
    var MATCH = 2, SKIP = -1, SUB = -1, INS = -0.5;
    var S = [], B = [];
    for (i = 0; i <= n; i++) { S.push(new Float64Array(m + 1)); B.push(new Uint8Array(m + 1)); }
    for (i = 1; i <= n; i++) { S[i][0] = S[i - 1][0] + SKIP; B[i][0] = 1; }
    for (j = 1; j <= m; j++) { S[0][j] = S[0][j - 1] + INS; B[0][j] = 2; }
    function eq(u, r) { return u.keys.indexOf(r.w) >= 0 || u.ph.indexOf(r.p || (r.p = phon(r.w))) >= 0; }
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        var d = S[i - 1][j - 1] + (eq(U[i - 1], R[j - 1]) ? MATCH : SUB);
        var up = S[i - 1][j] + SKIP, lf = S[i][j - 1] + INS;
        if (d >= up && d >= lf) { S[i][j] = d; B[i][j] = 0; }
        else if (up >= lf) { S[i][j] = up; B[i][j] = 1; }
        else { S[i][j] = lf; B[i][j] = 2; }
      }
    }
    /* fin libre dans le texte : meilleur i pour j = m */
    var bi = 0;
    for (i = 1; i <= n; i++) if (S[i][m] > S[bi][m]) bi = i;
    var st = []; /* état de chaque unité : 0 non lue, 1 juste, 2 fausse/sautée */
    for (i = 0; i < n; i++) st.push(0);
    var conf = [];
    i = bi; j = m;
    while (i > 0 || j > 0) {
      var b = B[i][j];
      if (i > 0 && j > 0 && b === 0) {
        var okm = eq(U[i - 1], R[j - 1]);
        st[i - 1] = okm ? 1 : 2; conf[i - 1] = okm ? R[j - 1].c : 0; i--; j--;
      } else if (i > 0 && (j === 0 || b === 1)) { st[i - 1] = 2; i--; }
      else j--;
    }
    return { st: st, conf: conf, end: bi - 1 };
  }

  /* Proposition : dernier mot lu (priorité) + mots à vérifier.
     words = mots affichés au maître(sse) (RV.words). Renvoie des indices de ces mots. */
  function proposeFrom(words, heard, voc) {
    var U = units(words, voc);
    var K = U.filter(function (u) { return u.keys.length && !u.tiny; });
    var A = align(K, heard);
    var last = -1, doubt = {}, matched = 0;
    K.forEach(function (u, k) { if (A.st[k] === 1) { last = Math.max(last, u.ti); matched++; } });
    /* mots que le modèle ne connaît pas : ni proposés ni jugés (« non vérifiés ») */
    var unknown = {};
    U.forEach(function (u) { if (!u.keys.length && !u.tiny && u.ti <= last) unknown[u.ti] = true; });
    K.forEach(function (u, k) { if (u.ti <= last && A.st[k] === 2 && !u.tiny) doubt[u.ti] = true; });
    /* un signe seul (« ! », « – ») juste après le dernier mot lu est compté avec lui */
    while (last >= 0 && last + 1 < words.length && !clean(words[last + 1])) last++;
    var errs = Object.keys(doubt).map(Number).sort(function (a, b) { return a - b; });
    return {
      endIdx: last,
      errs: errs,
      unknown: Object.keys(unknown).map(Number),
      matched: matched,
      heard: heard.map(function (h) { return h.w; }).join(" ")
    };
  }

  /* Point d'entrée : blob de l'enregistrement + mots de l'exercice → proposition */
  function propose(blob, words, opts) {
    opts = opts || {};
    var step = opts.onStep || function () {};
    var t0 = Date.now();
    step("load", 0);
    return Promise.all([model(), vocab()]).then(function (mv) {
      step("decode", 0);
      return decode(blob).then(function (samples) {
        var voc = mv[1], U = units(words, voc), g = {};
        U.forEach(function (u) { u.keys.forEach(function (k) { g[k] = 1; }); });
        var near = {};
        if (opts.near !== false) U.forEach(function (u) { u.near.forEach(function (k) { if (!g[k]) near[k] = 1; }); });
        /* suites de 2 à N mots dans l'ordre du texte : la machine préfère alors « a lu » à « ali » ; les mots seuls restent possibles (erreurs, sauts) */
        var K = U.filter(function (u) { return u.keys.length; }), N = opts.ngram == null ? 3 : opts.ngram, i, n;
        for (n = 2; n <= N; n++) for (i = 0; i + n <= K.length; i++) {
          g[K.slice(i, i + n).map(function (u) { return u.keys[0]; }).join(" ")] = 1;
        }
        var grammar = Object.keys(g).concat(Object.keys(near).slice(0, 400));
        if (!grammar.length) throw new Error("aucun mot connu");
        grammar.push("[unk]");
        step("listen", 0);
        return recognize(mv[0], samples, grammar, function (p) { step("listen", p); }).then(function (heard) {
          /* mots entendus trop brefs ou trop incertains : souvent une autre voix (classe bruyante) → écartés */
          var minC = opts.minConf == null ? 0.5 : opts.minConf, minD = opts.minDur == null ? 0.12 : opts.minDur;
          var res = proposeFrom(words, heard.filter(function (h) { return h.w !== "[unk]" && h.c >= minC && h.e - h.s >= minD; }), voc);
          if (opts.raw) res.raw = heard;
          res.ms = Date.now() - t0;
          res.secs = samples.length / 16000;
          return res;
        });
      });
    });
  }

  window.ZooAideEcoute = {
    supported: supported,
    ancien: ancien,
    propose: propose,
    /* pour les tests : */
    _units: units, _align: align, _proposeFrom: proposeFrom, _vocab: vocab, _clean: clean
  };
})();
