/* « 🎙 Mes sons » (espace enseignant, admin seulement) : l'admin enregistre lui-même la prononciation des sons du Zoo.
   Liste = les « clips » d'audio/syllabes.json (une prononciation, plusieurs écritures : « o » = o, au, voy:o).
   Enregistrement : micro → Web Audio → WAV mono 16 kHz (lisible par les vieux iPad), silences coupés au début et à la fin, volume égalisé.
   Rangement : bucket public « voix-zoo » (écriture admin seulement) + app_settings.voice_overrides {clip: fichier}
   par admin_set_voice(clip, fichier|null) ; lecture : get_voice_overrides() (migration 20261130).
   Utilisation : window.ZooMesSons.open(client, boîte) — appelé par enseignants.html quand la tuile s'ouvre. */
(function () {
  "use strict";
  var BUCKET = "voix-zoo", MAX_MS = 4000, PAGE = 40;
  var S = { client: null, box: null, map: null, clips: [], over: {}, q: "", filter: "all", shown: PAGE, rec: null, take: null, open: "", busy: false, audio: null };

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, cls, fn, title) { var b = el("button", cls, txt); b.type = "button"; if (title) { b.title = title; b.setAttribute("aria-label", title); } b.onclick = fn; return b; }
  function fold(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function css() {
    if (document.getElementById("msStyle")) return;
    var s = el("style"); s.id = "msStyle";
    s.textContent = ".ms-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 12px}.ms-tools input{flex:1;min-width:180px;margin:0}" +
      ".ms-chip{padding:8px 13px;border-radius:999px;background:#fff;color:#3c3472;border:1px solid #cfd6e3;font-weight:650}.ms-chip.on{background:#3c3472;color:#fff;border-color:#3c3472}" +
      ".ms-list{display:flex;flex-direction:column;gap:6px}.ms-row{border:1px solid #e8e1fa;border-radius:14px;padding:8px 10px;background:#fff}.ms-row.mine{border-color:#7fc8a9;background:#f3fbf6}" +
      ".ms-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ms-w{font-size:1.35rem;font-weight:800;min-width:54px;color:#242044}.ms-alt{flex:1;min-width:90px;color:#6a6479;font-size:.88rem}" +
      ".ms-line button{padding:9px 12px;border-radius:12px;font-size:1rem;min-height:44px}.ms-play{background:#eee9fb;color:#503292}.ms-mic{background:#7046ce;color:#fff}" +
      ".ms-badge{font-size:.8rem;font-weight:700;color:#1e7a50;background:#dff3e8;border-radius:999px;padding:3px 8px}" +
      ".ms-rec{margin-top:8px;padding:10px;border-radius:12px;background:#f6f3ff;display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ms-rec button{min-height:48px;font-size:1rem}" +
      ".ms-stop{background:#c62f4a!important;color:#fff!important;animation:msPulse 1s infinite}@keyframes msPulse{50%{box-shadow:0 0 0 6px #c62f4a33}}" +
      ".ms-meter{flex:1;min-width:90px;height:12px;border-radius:6px;background:#e3dcf5;overflow:hidden}.ms-meter i{display:block;height:100%;width:0;background:#2e9b6a;transition:width .08s}" +
      ".ms-keep{background:#2e9b6a!important;color:#fff!important}.ms-msg{flex-basis:100%;margin:0;color:#3c3472;font-size:.92rem}.ms-msg.err{color:#a52239}.ms-more{margin-top:10px}";
    document.head.appendChild(s);
  }
  /* Lecteur du Zoo (Howler + audio-lecture.js) chargé seulement quand on ouvre « Mes sons » */
  function loadScript(src) { return new Promise(function (ok, ko) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
  function ensurePlayer() {
    if (window.ZooAudio) return Promise.resolve();
    return (window.Howl ? Promise.resolve() : loadScript("vendor/howler.core.min.js?v=2.2.4")).then(function () { return loadScript("audio-lecture.js?v=" + (window.ZOO_AUDIO_LECTURE_V || "3")); });
  }
  function loadMap() {
    return fetch("audio/syllabes.json?v=" + Date.now()).then(function (r) { return r.json(); }).then(function (m) {
      S.map = m; var g = {}, SONS = {}, n = {}, LI = (window.ZooExo && window.ZooExo.LISTEN_ITEMS) || [];
      /* « Sons » = ceux de l'exercice d'écoute (clés « ch », « voy:a »… comme tools/audio_liste.js) */
      LI.forEach(function (r) { n[r[0]] = (n[r[0]] || 0) + 1; });
      LI.forEach(function (r) { SONS[n[r[0]] > 1 ? r[0] + ":" + String(r[1]).split(",")[0] : r[0]] = 1; });
      Object.keys(m.keys).forEach(function (k) { var c = m.keys[k], w = k.replace(/^[a-z0-9]+:/, ""); (g[c] = g[c] || []); if (g[c].indexOf(w) < 0) g[c].push(w); });
      S.clips = Object.keys(m.sprite).map(function (c) {
        var ws = (g[c] || [c]).sort(function (a, b) { return a.length - b.length || a.localeCompare(b, "fr"); });
        var son = Object.keys(m.keys).some(function (k) { return m.keys[k] === c && SONS[k]; });
        return { c: c, ws: ws, son: son, f: fold(ws.join(" ") + " " + c) };
      }).sort(function (a, b) { return (b.son - a.son) || a.ws[0].length - b.ws[0].length || a.ws[0].localeCompare(b.ws[0], "fr"); });
    });
  }
  function loadOver() {
    return S.client.rpc("get_voice_overrides").then(function (r) { S.over = (r && r.data && typeof r.data === "object") ? r.data : {}; });
  }
  function urlOf(path) {
    try { return S.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; } catch (e) { return ""; }
  }

  /* ---------- écouter ---------- */
  function stopAll() {
    try { if (S.audio) { S.audio.pause(); S.audio = null; } } catch (e) {}
    try { if (window.ZooAudio) ZooAudio.stop(); } catch (e) {}
  }
  function playBlobOrUrl(src) { stopAll(); var a = new Audio(src); S.audio = a; a.play().catch(function () {}); }
  function playCurrent(c) {
    if (S.over[c]) return playBlobOrUrl(urlOf(S.over[c]));
    stopAll();
    if (!(window.ZooAudio && ZooAudio.play(c))) { if (window.playLectureAudio) window.playLectureAudio(c); }
  }

  /* ---------- enregistrer (Web Audio → WAV 16 kHz) ---------- */
  function recStart(c) {
    stopAll();
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { S.take = { c: c, err: "Ce navigateur ne peut pas enregistrer. Essayez Chrome, Edge ou Safari récent." }; render(); return; }
    var ac = new AC(); if (ac.state === "suspended" && ac.resume) ac.resume();
    var r = S.rec = { c: c, ac: ac, bufs: [], rate: ac.sampleRate, level: 0, t0: Date.now() };
    S.take = null; render();
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
      if (S.rec !== r) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      r.stream = stream; r.src = ac.createMediaStreamSource(stream); r.proc = ac.createScriptProcessor(4096, 1, 1);
      r.proc.onaudioprocess = function (e) {
        var d = e.inputBuffer.getChannelData(0), m = 0; r.bufs.push(new Float32Array(d));
        for (var i = 0; i < d.length; i += 8) m = Math.max(m, Math.abs(d[i]));
        var bar = S.box && S.box.querySelector(".ms-meter i"); if (bar) bar.style.width = Math.min(100, Math.round(m * 140)) + "%";
      };
      r.src.connect(r.proc); r.proc.connect(ac.destination);
      r.timer = setTimeout(function () { if (S.rec === r) recStop(); }, MAX_MS);
    }).catch(function () { recClean(r); S.rec = null; S.take = { c: c, err: "Le micro n'est pas autorisé. Autorisez-le pour ce site (icône 🔒 de la barre d'adresse), puis recommencez." }; render(); });
  }
  function recClean(r) {
    try { clearTimeout(r.timer); } catch (e) {}
    try { r.proc.onaudioprocess = null; r.src.disconnect(); r.proc.disconnect(); } catch (e) {}
    try { r.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { r.ac.close(); } catch (e) {}
  }
  function recCancel() { if (S.rec) recClean(S.rec); S.rec = null; S.take = null; S.open = ""; render(); }
  function recStop() {
    var r = S.rec; if (!r) return; S.rec = null; recClean(r);
    var len = 0; r.bufs.forEach(function (b) { len += b.length; });
    var all = new Float32Array(len), o = 0; r.bufs.forEach(function (b) { all.set(b, o); o += b.length; });
    var pcm = trim(down(all, r.rate, 16000), 16000);
    if (!pcm) { S.take = { c: r.c, err: "Je n'ai rien entendu. Parlez plus fort ou plus près, puis recommencez." }; render(); return; }
    var blob = wav(pcm, 16000);
    S.take = { c: r.c, blob: blob, url: URL.createObjectURL(blob), ms: Math.round(pcm.length / 16) };
    render(); playBlobOrUrl(S.take.url);   /* réécoute tout de suite */
  }
  /* 48 kHz → 16 kHz : moyenne de chaque groupe d'échantillons (comme wavStop du Zoo) */
  function down(x, from, to) {
    var step = from / to; if (step <= 1) return x;
    var n = Math.floor(x.length / step), y = new Float32Array(n);
    for (var i = 0; i < n; i++) { var a = Math.floor(i * step), b = Math.min(x.length, Math.floor((i + 1) * step)), s = 0; for (var j = a; j < b; j++) s += x[j]; y[i] = s / Math.max(1, b - a); }
    return y;
  }
  /* Silences coupés (fenêtres de 20 ms) + marge, petit fondu, volume égalisé (crête à 90 %, gain ×5 au plus) */
  function trim(x, rate) {
    var w = Math.round(rate * 0.02), nw = Math.floor(x.length / w), rms = [], top = 0, i, j;
    for (i = 0; i < nw; i++) { var s = 0; for (j = i * w; j < (i + 1) * w; j++) s += x[j] * x[j]; s = Math.sqrt(s / w); rms.push(s); if (s > top) top = s; }
    if (top < 0.01) return null;
    var th = Math.max(0.006, top * 0.12), a = -1, b = -1;
    for (i = 0; i < nw; i++) if (rms[i] > th) { if (a < 0) a = i; b = i; }
    if (a < 0) return null;
    var st = Math.max(0, a * w - Math.round(rate * 0.08)), en = Math.min(x.length, (b + 1) * w + Math.round(rate * 0.15));
    var y = x.slice(st, en), peak = 0;
    for (i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
    var g = Math.min(5, 0.9 / Math.max(peak, 1e-4)), f = Math.min(Math.round(rate * 0.01), y.length >> 2);
    for (i = 0; i < y.length; i++) { var k = g; if (i < f) k *= i / f; else if (i >= y.length - f) k *= (y.length - 1 - i) / f; y[i] *= k; }
    return y;
  }
  function wav(x, rate) {
    var n = x.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(p, t) { for (var i = 0; i < t.length; i++) v.setUint8(p + i, t.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var s = Math.max(-1, Math.min(1, x[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([buf], { type: "audio/wav" });
  }

  /* ---------- garder / revenir à la voix du Zoo ---------- */
  function slug(c) { return fold(c).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "son"; }
  function keep() {
    var t = S.take; if (!t || !t.blob || S.busy) return;
    S.busy = true; t.msg = "Enregistrement en cours…"; render();
    var path = slug(t.c) + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ".wav", old = S.over[t.c];
    S.client.storage.from(BUCKET).upload(path, t.blob, { contentType: "audio/wav", cacheControl: "31536000", upsert: false }).then(function (r) {
      if (r && r.error) throw r.error;
      return S.client.rpc("admin_set_voice", { p_clip: t.c, p_path: path });
    }).then(function (r) {
      if (r && r.error) throw r.error;
      S.over = r.data || S.over; if (!r.data) S.over[t.c] = path;
      if (old && old !== path) S.client.storage.from(BUCKET).remove([old]).catch(function () {});
      var next = nextOf(t.c); S.busy = false; S.take = null; S.open = ""; S.justSaved = t.c; S.next = next; render();
    }).catch(function (e) { S.busy = false; t.msg = ""; t.err = "Pas enregistré : " + ((e && e.message) || "problème de connexion") + ". Réessayez."; render(); });
  }
  function revert(c) {
    if (!S.over[c] || S.busy) return;
    if (!window.confirm("Revenir à la voix du Zoo pour « " + labelOf(c) + " » ? Votre enregistrement sera effacé.")) return;
    var old = S.over[c]; S.busy = true;
    S.client.rpc("admin_set_voice", { p_clip: c, p_path: null }).then(function (r) {
      if (r && r.error) throw r.error;
      S.over = r.data || {}; S.busy = false; S.client.storage.from(BUCKET).remove([old]).catch(function () {}); render();
    }).catch(function (e) { S.busy = false; window.alert("Pas modifié : " + ((e && e.message) || "problème de connexion")); });
  }
  function labelOf(c) { var k = S.clips.filter(function (x) { return x.c === c; })[0]; return k ? k.ws[0] : c; }
  function visible() {
    var q = fold(S.q).trim();
    return S.clips.filter(function (k) {
      if (S.filter === "mine" && !S.over[k.c]) return false;
      if (S.filter === "son" && !k.son) return false;
      if (S.filter === "syl" && k.son) return false;
      return !q || k.ws.some(function (w) { return fold(w).indexOf(q) === 0; }) || k.f.indexOf(q) >= 0;
    });
  }
  function nextOf(c) { var v = visible(), i = v.map(function (k) { return k.c; }).indexOf(c); return i >= 0 && v[i + 1] ? v[i + 1].c : ""; }

  /* ---------- affichage ---------- */
  function render() {
    var box = S.box; if (!box) return;
    var list = box.querySelector(".ms-list"), more = box.querySelector(".ms-more"), count = box.querySelector(".ms-count");
    var v = visible(), n = Object.keys(S.over).length;
    count.textContent = n ? "🎙 " + n + " son" + (n > 1 ? "s" : "") + " avec votre voix" : "Aucun son avec votre voix pour l'instant";
    list.innerHTML = "";
    if (!v.length) list.appendChild(el("p", "muted", S.filter === "mine" ? "Vous n'avez encore enregistré aucun son." : "Aucun son ne correspond à « " + S.q + " »."));
    v.slice(0, S.shown).forEach(function (k) { list.appendChild(row(k)); });
    more.innerHTML = "";
    if (v.length > S.shown) more.appendChild(btn("Voir plus (" + (v.length - S.shown) + ")", "secondary", function () { S.shown += PAGE * 2; render(); }));
  }
  function row(k) {
    var mine = !!S.over[k.c], r = el("div", "ms-row" + (mine ? " mine" : "")), line = el("div", "ms-line");
    r.dataset.clip = k.c;
    line.appendChild(el("span", "ms-w", k.ws[0]));
    var alt = k.ws.slice(1).join(" · ");
    line.appendChild(el("span", "ms-alt", (alt ? "aussi : " + alt : "") + (k.c !== k.ws[0] ? (alt ? " — " : "") + "dit « " + k.c + " »" : "")));
    if (mine) line.appendChild(el("span", "ms-badge", "🎙 Ma voix"));
    line.appendChild(btn("▶", "ms-play", function () { playCurrent(k.c); }, mine ? "Écouter ma voix" : "Écouter la voix du Zoo"));
    var busyHere = S.rec && S.rec.c === k.c, takeHere = S.take && S.take.c === k.c;
    if (!busyHere && !takeHere) line.appendChild(btn(mine ? "🎙 Refaire" : "🎙 M'enregistrer", "ms-mic" + (S.next === k.c ? " ms-keep" : ""), function () { S.open = k.c; S.next = ""; S.justSaved = ""; recStart(k.c); }));
    if (mine && !busyHere && !takeHere) line.appendChild(btn("↩️ Voix du Zoo", "secondary", function () { revert(k.c); }, "Revenir à la voix du Zoo"));
    r.appendChild(line);
    if (busyHere) {
      var p = el("div", "ms-rec");
      p.appendChild(btn("⏹ J'ai fini", "ms-stop", recStop));
      var m = el("div", "ms-meter"); m.appendChild(el("i")); p.appendChild(m);
      p.appendChild(btn("Annuler", "secondary", recCancel));
      p.appendChild(el("p", "ms-msg", "Dites « " + k.c + " » maintenant (4 secondes au plus)."));
      r.appendChild(p);
    } else if (takeHere) {
      var t = S.take, q = el("div", "ms-rec");
      if (t.blob) {
        q.appendChild(btn("▶ Réécouter", "ms-play", function () { playBlobOrUrl(t.url); }));
        var kb = btn("✅ Garder", "ms-keep", keep); kb.disabled = S.busy; q.appendChild(kb);
      }
      q.appendChild(btn("🔁 Recommencer", "secondary", function () { recStart(k.c); }));
      q.appendChild(btn("Annuler", "secondary", recCancel));
      if (t.msg) q.appendChild(el("p", "ms-msg", t.msg));
      if (t.err) q.appendChild(el("p", "ms-msg err", t.err));
      r.appendChild(q);
    } else if (S.justSaved === k.c) {
      r.appendChild(el("p", "ms-msg", "✅ Gardé : les élèves entendront votre voix." + (S.next ? " Son suivant : « " + labelOf(S.next) + " »." : "")));
    }
    return r;
  }
  function build(box) {
    box.innerHTML = "";
    var tools = el("div", "ms-tools"), inp = el("input");
    inp.type = "search"; inp.placeholder = "🔍 Chercher un son ou une syllabe (ex. on, ba, ch)"; inp.setAttribute("aria-label", "Chercher un son");
    inp.oninput = function () { S.q = inp.value; S.shown = PAGE; render(); };
    tools.appendChild(inp);
    [["all", "Tous"], ["son", "Sons"], ["syl", "Syllabes"], ["mine", "🎙 Ma voix"]].forEach(function (f) {
      var b = btn(f[1], "ms-chip" + (S.filter === f[0] ? " on" : ""), function () { S.filter = f[0]; S.shown = PAGE; Array.prototype.forEach.call(tools.querySelectorAll(".ms-chip"), function (x) { x.classList.toggle("on", x === b); }); render(); });
      tools.appendChild(b);
    });
    box.appendChild(el("p", "muted ms-count", ""));
    box.appendChild(tools);
    box.appendChild(el("div", "ms-list"));
    box.appendChild(el("div", "ms-more"));
    render();
  }
  window.ZooMesSons = {
    open: function (client, box) {
      css(); S.client = client;
      if (S.box === box && S.map) { loadOver().then(render); return; }
      S.box = box; box.innerHTML = ""; box.appendChild(el("p", "muted", "Chargement des sons…"));
      Promise.all([loadMap(), loadOver(), ensurePlayer().catch(function () {})]).then(function () { build(box); })
        .catch(function () { box.innerHTML = ""; box.appendChild(el("p", "msg err", "Impossible de charger la liste des sons. Vérifiez la connexion puis rouvrez cette page.")); });
    },
    /* pour les tests */
    _state: S, _trim: trim, _wav: wav, _down: down
  };
})();
