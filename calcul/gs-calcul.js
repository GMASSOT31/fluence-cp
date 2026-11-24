/* Parcours GS — écran élève du Zoo de Calcul (étape E) : comptine numérique 1–20 + cinq activités (chiffres, ordre des nombres, dénombrement,
   comparaison de collections, construction d'une collection), enchaînées par intervalle 1–3, 1–5, 0–9 (ZooGSData.calcPath). ES2018 (iPad iOS 12).
   Besoin : gs-data.js (window.ZooGSData), vendor/howler (sons enregistrés « N:3 », « c:… » d'audio/gs.json, facultatif) et le contexte donné par
   labo-calcul.html (ZooGSCalc.init). Données : tenues par le SERVEUR (lab_student_submit_round, activité « gs », migration 20261209) :
   progress.gs (paliers), gsh (séries), gsw (roues), gsr (comptine). Parcours = settings.tracks[élève].calcul (réglage enseignant). */
(function () {
  "use strict";
  var D = window.ZooGSData, X = null, R = null, M = { st: {}, gsh: [], gsr: null, cfg: null, track: "cp" }, timers = [], GS_AUDIO_V = "3";
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function later(f, ms) { timers.push(setTimeout(f, ms)); }
  function el(t, c, x) { return X.el(t, c, x); }
  function btn(cls, txt, fn) { var b = el("button", cls, txt); b.type = "button"; if (fn) b.addEventListener("click", fn); return b; }
  function css() {
    if (document.getElementById("gcStyle")) return;
    var s = document.createElement("style"); s.id = "gcStyle";
    s.textContent = ".gc-card{text-align:center}.gc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.gc-count{font-weight:700;color:var(--muted)}" +
      ".gc-dots{display:flex;justify-content:center;flex-wrap:wrap;margin:4px 0 10px}.gc-dots span{width:12px;height:12px;border-radius:50%;background:#d8dde6;margin:0 3px}.gc-dots span.done{background:#2e9b6a}.gc-dots span.now{background:#f2b705}" +
      ".gc-say{min-width:150px;min-height:56px;font-size:1.3rem;border-radius:18px;border:3px solid #2e9b6a;background:#f2faf6;color:#1d6b45;font-weight:800;margin:4px auto 8px;cursor:pointer;font-family:Fredoka,Figtree,sans-serif}" +
      ".gc-grid{display:flex;flex-wrap:wrap;justify-content:center;margin:10px -6px}" +
      ".gc-num{font-family:Fredoka,Figtree,sans-serif;font-weight:700;font-size:3.6rem;line-height:1;width:112px;height:112px;margin:8px;border-radius:24px;border:3px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}" +
      ".gc-num.good{background:#dff3e8;border-color:#2e9b6a}.gc-num.bad{background:#fde3e3;border-color:#c62f4a}.gc-num.used{visibility:hidden}.gc-num:disabled{cursor:default}" +
      ".gc-big{font-family:Fredoka,Figtree,sans-serif;font-weight:700;font-size:6.5rem;line-height:1.1;margin:6px 0;color:#1d6b45}" +
      ".gc-pens{display:flex;justify-content:center;flex-wrap:wrap;margin:6px -6px}" +
      ".gc-pen{position:relative;display:block;width:300px;max-width:92%;height:190px;margin:6px auto;border:4px solid #8bbf9f;border-radius:26px;background:#eef8f1;padding:0;cursor:default;overflow:hidden}" +
      ".gc-pens .gc-pen{width:46%;max-width:300px;margin:6px 2%}.gc-pens .gc-pen span{font-size:2.1rem}button.gc-pen{cursor:pointer}.gc-pen.good{border-color:#2e9b6a;box-shadow:0 0 0 6px rgba(46,155,106,.25)}.gc-pen.bad{border-color:#c62f4a;background:#fde3e3}" +
      ".gc-pen.model{border-style:dashed;background:#f7f7fb;height:150px}.gc-pen.build{cursor:pointer;height:230px}" +
      ".gc-pen span{position:absolute;line-height:1;transform:translate(-50%,-50%);font-size:2.4rem;pointer-events:none}.gc-pen.build span{pointer-events:auto;cursor:pointer}" +
      ".gc-slots{display:flex;justify-content:center;flex-wrap:wrap;margin:10px 0 2px}.gc-slot{font-family:Fredoka,Figtree,sans-serif;font-weight:700;font-size:2.6rem;width:76px;height:84px;line-height:78px;margin:5px;border:3px dashed #b8c0cc;border-radius:18px;color:#1d6b45}" +
      ".gc-slot.full{border-style:solid;border-color:#2e9b6a;background:#dff3e8}" +
      ".gc-strip{display:flex;flex-wrap:wrap;justify-content:center;margin:6px -3px 12px}.gc-strip span{font-family:Fredoka,Figtree,sans-serif;font-weight:700;font-size:1.3rem;width:38px;height:42px;line-height:42px;margin:3px;border-radius:10px;background:#eef1f6;color:#8a93a3}" +
      ".gc-strip span.seen{background:#dff3e8;color:#1d6b45}.gc-strip span.now{background:#2e9b6a;color:#fff}" +
      ".gc-stars{font-size:2.2rem;letter-spacing:6px}.gc-stars .on{color:#f2b705}.gc-stars span{color:#c9cdd6}.gc-small{margin-top:14px}.gc-small button{font-size:1rem;margin:4px}.gc-hint{font-size:1.6rem;font-weight:700;color:#1d6b45;min-height:1.2em}" +
      ".gc-done{min-height:64px;font-size:1.3rem;background:#2e9b6a!important;border-color:#1d6b45!important;color:#fff!important}" +
      "@media (max-width:600px){.gc-num{width:92px;height:92px;font-size:3rem;margin:6px}.gc-pen{height:160px}.gc-pen.build{height:200px}.gc-pen span{font-size:2rem}.gc-pens .gc-pen{width:92%;height:128px;margin:5px 4%}.gc-pens .gc-pen span{font-size:1.9rem}.gc-pen.model{height:120px}.gc-big{font-size:5rem}.gc-slot{width:60px;height:70px;line-height:64px;font-size:2.1rem;margin:4px}}";
    document.head.appendChild(s);
  }
  /* ---------- sons enregistrés (audio/gs.json) sinon voix de l'appareil ---------- */
  var A = { map: null, howl: null, ok: false, asked: false };
  function audioLoad() {
    if (A.asked || !window.Howl || !window.XMLHttpRequest) return;
    A.asked = true;
    try {
      var x = new XMLHttpRequest(); x.open("GET", "audio/gs.json?v=" + GS_AUDIO_V);
      x.onload = function () {
        if (x.status < 200 || x.status >= 300) return;
        try { A.map = JSON.parse(x.responseText); } catch (e) { return; }
        if (!A.map || !A.map.sprite || !A.map.src) { A.map = null; return; }
        A.howl = new window.Howl({ src: [A.map.src], sprite: A.map.sprite, preload: true, html5: false, onload: function () { A.ok = true; } });
      };
      x.send();
    } catch (e) {}
  }
  function audioStop() { try { if (A.howl) A.howl.stop(); } catch (e) {} }
  function running() { try { return !window.Howler || !Howler.ctx || Howler.ctx.state === "running"; } catch (e) { return true; } }
  function voiceOn() { return !(X.settings() && X.settings().voice === false); }
  function say(key, text, done) {
    if (!voiceOn()) { if (done) later(done, 300); return; }
    if (A.ok && A.map.sprite[key]) {
      if (!running()) { try { Howler.ctx.resume(); } catch (e) {} }
      if (running()) {
        try {
          X.V.stop(); audioStop();
          var id = A.howl.play(key), fin = false, end = function () { if (fin) return; fin = true; if (done) done(); };
          A.howl.once("end", end, id); A.howl.once("stop", end, id); A.howl.once("playerror", end, id);
          return;
        } catch (e) {}
      }
    }
    var fired = false, f = function () { if (fired) return; fired = true; if (done) done(); };
    if (!X.V.speak(text, f)) later(f, 400); else if (done) later(f, 6000 + text.length * 60);
  }
  function sayAll(parts, done) {
    var i = 0, tok = {}; sayAll.tok = tok;
    function next() { if (sayAll.tok !== tok) return; if (i >= parts.length) { if (done) done(); return; } var p = parts[i++]; say(p[0], p[1], function () { later(next, 150); }); }
    next();
  }
  function hush() { clear(); sayAll.tok = null; audioStop(); X.V.stop(); }
  function num(n) { return ["N:" + n, D.NUM_SAY[n] || String(n)]; }
  /* ---------- état ---------- */
  function load(progress, teacherSettings, sid) {
    var p = progress || {}, t = teacherSettings && teacherSettings.tracks && teacherSettings.tracks[sid];
    M.st = D.calcState(p.gs); M.gsh = Array.isArray(p.gsh) ? p.gsh.slice(-60) : []; M.gsr = typeof p.gsr === "string" ? p.gsr : null;
    M.cfg = D.calcConfig(teacherSettings && teacherSettings.gs); M.track = t && t.calcul === "gs" ? "gs" : "cp";
  }
  function items() { return D.calcPath(M.cfg); }
  /* ---------- accueil : une seule grande action ---------- */
  function home(box) {
    css(); audioLoad(); X.setPath("nombres");
    var its = items(), i = D.calcCurrent(M.st, its), wheels = X.wheels(), first = !M.gsr, card = el("div", "card home-hero gc-card");
    card.appendChild(el("h2", "", "🎯 Ma mission"));
    var label, key, text, go;
    if (wheels) { label = "🎡 Lance ta roue !"; key = "c:roue"; text = "Une roue t’attend. Touche le gros bouton pour la lancer."; go = function () { X.goTo("roue"); }; }
    else if (first) { label = "🎵 La comptine des nombres"; key = "c:ritc"; text = "D’abord, écoute la comptine des nombres. Touche le gros bouton."; go = function () { rituel(); }; }
    else if (i < 0) { label = "🔢 Je m’entraîne avec les nombres"; key = "c:finc"; text = "Bravo, tu as tout réussi ! Tu peux t’entraîner encore."; go = function () { start(); }; }
    else { label = "🔢 Je joue avec les nombres"; key = "c:missionc"; text = "Ta mission : jouer avec les nombres. Touche le gros bouton."; go = function () { start(); }; }
    card.appendChild(el("p", "instruction", i < 0 ? "Tu as tout réussi ! ⭐" : "Ma mission : " + D.CCOMP[its[i].comp].mission));
    var row = el("div", "home-step"), col = el("div", "home-col"), acts = el("div", "home-act-row"), b = btn("primary big-btn home-next go-next" + (wheels ? " wheel-go" : " go-nombres"), label, function () { hush(); go(); });
    acts.appendChild(b); acts.appendChild(btn("secondary home-say", "🔊", function () { say(key, text); }));
    acts.lastChild.setAttribute("aria-label", "Écouter la consigne");
    col.appendChild(acts); row.appendChild(col); card.appendChild(row);
    var small = el("div", "gc-small");
    if (first && !wheels) small.appendChild(btn("secondary", "Plus tard", function () { saveRituel(function () { X.goTo("home"); }); }));
    else if (!first) small.appendChild(btn("secondary", "🎵 La comptine des nombres", function () { rituel(); }));
    if (small.children.length) card.appendChild(small);
    box.appendChild(card);
  }
  /* ---------- comptine numérique 1–20 (cahier 5.1 : ≈ 25 s, facultative ensuite, ne valide rien, pas de roue) ---------- */
  function rituel() { R = { rituel: true }; X.goTo("gs"); }
  function saveRituel(done) {
    if (M.gsr || X.preview) { if (done) done(); return; }
    M.gsr = new Date().toISOString();
    X.rpc("lab_student_submit_round", { p_token: X.token(), p_round: X.uuid(), p_activity: "gs", p_level: "rituel", p_correct: 0, p_total: 1, p_stats: {} })
      .then(function (r) { if (r && r.rituel) M.gsr = r.rituel; }, function () { M.gsr = null; }).then(function () { if (done) done(); });
  }
  function renderRituel(box) {
    var run = R, k = 1, card = el("div", "card calc-card gc-card"), big = el("div", "gc-big", "1"), strip = el("div", "gc-strip"), cells = [];
    card.appendChild(el("h2", "", "🎵 La comptine des nombres"));
    for (var n = 1; n <= 20; n++) { var c = el("span", "", String(n)); cells.push(c); strip.appendChild(c); }
    card.appendChild(big); card.appendChild(strip);
    var main = btn("primary big-btn go-next", "▶ J’écoute"), small = el("div", "gc-small"), skip = btn("secondary", "Passer ⏭", function () { finish(); });
    small.appendChild(skip); card.appendChild(main); card.appendChild(small); box.appendChild(card);
    function finish() {
      if (R !== run) return;
      hush(); saveRituel();
      cells.forEach(function (c) { c.className = "seen"; });
      main.hidden = false; main.textContent = "🔢 Je joue avec les nombres"; main.onclick = function () { start(); };
      skip.textContent = "🔁 Encore"; skip.onclick = function () { rituel(); };
      say("c:comptinefin", "Bravo ! Tu as compté jusqu’à vingt.");
    }
    function next() {
      if (R !== run) return;
      if (k > 20) { later(finish, 500); return; }
      if (k > 1) cells[k - 2].className = "seen";
      cells[k - 1].className = "now"; big.textContent = String(k);
      var n = k++; say("N:" + n, D.NUM_SAY[n], function () { later(next, 220); });
    }
    main.onclick = function () { main.hidden = true; say("c:comptine", "Écoute la comptine des nombres !", function () { later(next, 300); }); };
  }
  /* ---------- une série ---------- */
  function start(only) {
    var its = items(); if (only) its = its.filter(function (x) { return x.comp === only; });
    if (!its.length) { X.goTo("home"); return; }
    var i = only ? 0 : D.calcCurrent(M.st, its), free = i < 0 || !!X.preview, it = i < 0 ? its[Math.floor(Math.random() * its.length)] : its[i], step = it.step;
    var aid = !free && D.calcItem(M.st, step.key).aid, s = D.buildCalcSeries(step, M.cfg, aid);
    var seenComp = M.gsh.some(function (x) { return String(x.k).split("-")[0] === step.comp; }), seenZero = M.gsh.some(function (x) { return String(x.k).indexOf(step.comp + "-r3") === 0; });
    R = { step: step, comp: step.comp, act: D.CCOMP[step.comp].act, free: free, aid: aid, qs: s.qs, n: 0, good: 0, helps: 0, id: X.uuid(), answers: 0,
      demo: aid || !seenComp || (step.lo === 0 && !seenZero) };   /* exemple guidé : activité nouvelle, arrivée du zéro, ou aide */
    audioLoad(); X.goTo("gs");
  }
  function render(box) {
    css(); clear();
    if (!R) { X.goTo("home"); return; }
    if (R.rituel) { renderRituel(box); return; }
    document.body.classList.add("listen-focus");
    if (R.demo && !R.demoDone) { demo(box); return; }
    question(box);
  }
  /* ---------- collections d'animaux : dispositions variées (cahier 5.4) ---------- */
  var GRID = []; (function () { for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) GRID.push([14 + c * 24, 20 + r * 30]); })();
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function spots(n, lay) {
    var DIE = { 1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[30, 28], [70, 28], [30, 72], [70, 72]], 5: [[28, 26], [72, 26], [50, 50], [28, 74], [72, 74]], 6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]] };
    if (!n) return [];
    if (lay === "de" && DIE[n]) return DIE[n];
    if (lay === "ligne" || lay === "de") { var out = [], rows = n > 5 ? 2 : 1, per = Math.ceil(n / rows); for (var i = 0; i < n; i++) { var r = Math.floor(i / per), c = i % per, cnt = r === rows - 1 ? n - per * (rows - 1) : per; out.push([50 + (c - (cnt - 1) / 2) * Math.min(18, 84 / Math.max(1, per - 1 || 1)), rows === 1 ? 50 : 32 + r * 36]); } return out; }
    var cells = shuffle(GRID.slice()).slice(0, n), k = lay === "serre" ? 0.74 : lay === "espace" ? 1.05 : 0.92;
    return cells.map(function (p) { var j = lay === "vrac" ? 4 : 1.5; return [50 + (p[0] - 50) * k + (Math.random() * 2 - 1) * j, 50 + (p[1] - 50) * k + (Math.random() * 2 - 1) * j]; });
  }
  function pen(n, e, lay, size, tag, cls) {
    var p = el(tag || "div", "gc-pen" + (cls ? " " + cls : ""));
    if (tag === "button") p.type = "button";
    p.setAttribute("aria-label", n === 0 ? "Enclos vide" : "Enclos");
    spots(n, lay).forEach(function (s) { var a = el("span", "", e); a.style.left = s[0] + "%"; a.style.top = s[1] + "%"; if (size && size !== 1) a.style.transform = "translate(-50%,-50%) scale(" + size + ")"; p.appendChild(a); });
    return p;
  }
  /* ---------- exemple guidé / aide ---------- */
  function demo(box) {
    var run = R, st = R.step, card = el("div", "card calc-card gc-card"), list = [], k = 0;
    for (var n = st.lo; n <= st.hi; n++) list.push(n);
    card.appendChild(el("h2", "", R.aid ? "Je vais t’aider 👀" : "Regarde et écoute 👀"));
    var big = el("div", "gc-big", ""), holder = el("div"), strip = null, cells = {};
    card.appendChild(big); card.appendChild(holder);
    if (R.act === "ordre") { strip = el("div", "gc-strip"); for (var m = 0; m <= 9; m++) { cells[m] = el("span", "", String(m)); strip.appendChild(cells[m]); } card.appendChild(strip); }
    card.appendChild(btn("primary big-btn go-next", "▶ À moi de jouer", function () { hush(); R.demoDone = true; question(X.view()); }));
    box.appendChild(card);
    function next() {
      if (R !== run || R.demoDone) return;
      if (k >= list.length) { R.demoDone = true; later(function () { if (R === run) question(X.view()); }, 700); return; }
      var v = list[k++]; big.textContent = String(v);
      if (strip) { Object.keys(cells).forEach(function (c) { if (cells[c].className === "now") cells[c].className = "seen"; }); cells[v].className = "now"; }
      else { holder.innerHTML = ""; holder.appendChild(pen(v, "🐥", "ligne", 1)); }
      if (v === 0) sayAll([num(0), ["c:zero", "Zéro, c’est quand il n’y a rien : l’enclos est vide."]], function () { later(next, 700); });
      else say("N:" + v, D.NUM_SAY[v], function () { later(next, 650); });
    }
    say(R.aid ? "c:aidec" : "c:regarde", R.aid ? "Je vais t’aider. Regarde et écoute bien." : "Regarde et écoute bien.", function () { later(next, 350); });
  }
  /* ---------- questions ---------- */
  function frame(box, Q) {
    var card = el("div", "card calc-card gc-card"), top = el("div", "gc-top"), total = R.qs.length;
    top.appendChild(btn("exo-quit", "← Arrêter", function () { quit(card); }));
    top.appendChild(el("span", "gc-count", R.n + " sur " + total));
    card.appendChild(top);
    var dots = el("div", "gc-dots"); dots.setAttribute("aria-hidden", "true");
    for (var i = 0; i < total; i++) dots.appendChild(el("span", i < R.n - 1 ? "done" : i === R.n - 1 ? "now" : ""));
    card.appendChild(dots);
    card.appendChild(btn("gc-say", "🔊 Écouter", function () { R.helps++; instr(Q); }));
    box.appendChild(card);
    return card;
  }
  function quit(card) {
    if (!R.answers) { stop(); X.goTo("home"); return; }
    if (card.querySelector(".gc-quit")) return;
    var w = el("div", "gc-quit card"); w.appendChild(el("p", "instruction", "Tu arrêtes ? Cette série ne sera pas gardée."));
    w.appendChild(btn("primary", "▶ Je continue", function () { w.remove(); }));
    w.appendChild(btn("secondary", "Oui, j’arrête", function () { stop(); X.goTo("home"); }));
    card.insertBefore(w, card.children[1]);
  }
  function instr(Q) {
    var a = R.act;
    if (a === "num") sayAll([["c:nombre", "Touche le nombre"], num(Q.t)]);
    else if (a === "compte") say("c:combien", "Combien y a-t-il d’animaux ?");
    else if (a === "ordre") say("c:ordren", "Touche les nombres du plus petit au plus grand.");
    else if (a === "compare") say("c:" + Q.ask, Q.ask === "plus" ? "Où y en a-t-il le plus ?" : Q.ask === "moins" ? "Où y en a-t-il le moins ?" : "Touche l’enclos où il y en a autant.");
    else if (Q.t === 0) say("c:mets0", "Laisse l’enclos vide : zéro animal. Puis touche le bouton vert.");
    else if (Q.t === 1) say("c:mets1", "Mets un animal dans l’enclos.");
    else sayAll([["c:mets", "Mets"], num(Q.t), ["c:animaux", "animaux dans l’enclos."]]);
  }
  function answer(good, next) {
    R.answers++;
    if (good) { R.good++; if (window.ZooFx && X.sfx()) ZooFx.tone(784, 0, 0.12, "triangle", 0.12), ZooFx.tone(1047, 0.1, 0.18, "triangle", 0.12); later(next, 800); }
    else { if (window.ZooFx && X.sfx()) ZooFx.tone(196, 0, 0.25, "sine", 0.12); say("c:pasn", "Ce n’est pas ça."); later(next, 1500); }   /* la bonne réponse n'est pas montrée */
  }
  function question(box) {
    box = box || X.view(); X.clear(box); clear();
    if (R.n >= R.qs.length) { end(box); return; }
    var Q = R.qs[R.n]; R.n++;
    var card = frame(box, Q), a = R.act, over = false;
    function lock(list) { list.forEach(function (x) { x.disabled = true; }); }
    function next() { if (R) question(X.view()); }
    if (a === "num" || a === "compte") {
      if (a === "compte") card.appendChild(pen(Q.t, Q.e, Q.lay, 1));
      var grid = el("div", "gc-grid"), bs = [];
      Q.opts.forEach(function (v) {
        var b = btn("gc-num", String(v), function () {
          if (over) return; over = true; hush(); lock(bs);
          var g = v === Q.t; b.classList.add(g ? "good" : "bad"); answer(g, next);
        });
        b.setAttribute("aria-label", "Nombre " + v); bs.push(b); grid.appendChild(b);
      });
      card.appendChild(grid);
    } else if (a === "ordre") {
      var k = 0, err = false, slots = [], row = el("div", "gc-slots"), grid2 = el("div", "gc-grid");
      if (R.aid) { var strip = el("div", "gc-strip"); for (var m = 0; m <= 9; m++) strip.appendChild(el("span", Q.seq.indexOf(m) >= 0 ? "seen" : "", String(m))); card.appendChild(strip); }
      Q.seq.forEach(function () { var d = el("div", "gc-slot", ""); slots.push(d); row.appendChild(d); });
      card.appendChild(row);
      Q.opts.forEach(function (v) {
        var b = btn("gc-num", String(v), function () {
          if (over || b.classList.contains("used")) return; hush();
          if (v === Q.seq[k]) {
            slots[k].textContent = String(v); slots[k].className = "gc-slot full"; b.classList.add("used"); k++;
            say("N:" + v, D.NUM_SAY[v]);
            if (k >= Q.seq.length) { over = true; R.answers++; if (!err) { R.good++; if (window.ZooFx && X.sfx()) ZooFx.tone(1047, 0, 0.18, "triangle", 0.12); } later(next, 1200); }
          } else { err = true; b.classList.add("bad"); if (window.ZooFx && X.sfx()) ZooFx.tone(196, 0, 0.25, "sine", 0.12); later(function () { b.classList.remove("bad"); }, 800); }
        });
        grid2.appendChild(b);
      });
      card.appendChild(grid2);
    } else if (a === "compare") {
      if (Q.ask === "autant") card.appendChild(pen(Q.model, Q.e, "ligne", 1, "div", "model"));
      var pens = el("div", "gc-pens"), ps = [];
      [Q.a, Q.b].forEach(function (v, side) {
        var p = pen(v, Q.e, Q.lay[side], Q.sizes ? Q.sizes[side] : 1, "button");
        p.setAttribute("aria-label", side ? "Enclos de droite" : "Enclos de gauche");
        p.addEventListener("click", function () { if (over) return; over = true; hush(); lock(ps); var g = side === Q.t; p.classList.add(g ? "good" : "bad"); answer(g, next); });
        ps.push(p); pens.appendChild(p);
      });
      card.appendChild(pens);
    } else {   /* construction */
      var n = 0, hint = el("div", "gc-hint", ""), big = el("div", "gc-big", String(Q.t)), box2 = pen(0, Q.e, "ligne", 1, "div", "build"), cellsFree = GRID.slice(), placed = [];
      card.insertBefore(big, card.querySelector(".gc-say"));
      function draw() { hint.textContent = R.aid ? String(n) : ""; }
      box2.addEventListener("click", function (ev) {
        if (over) return;
        if (ev.target !== box2) return;   /* toucher l'enclos = ajouter (au plus 10) */
        if (placed.length >= 10) return;
        var c = cellsFree.splice(Math.floor(Math.random() * cellsFree.length), 1)[0] || [50, 50], s = el("span", "", Q.e);
        s.style.left = c[0] + "%"; s.style.top = c[1] + "%"; s.setAttribute("role", "button"); s.setAttribute("aria-label", "Retirer un animal");
        s.addEventListener("click", function (e2) { e2.stopPropagation(); if (over) return; s.remove(); cellsFree.push(c); placed.splice(placed.indexOf(s), 1); n = placed.length; draw(); if (R.aid && n) say("N:" + n, D.NUM_SAY[n]); });
        placed.push(s); box2.appendChild(s); n = placed.length; draw();
        if (R.aid) say("N:" + n, D.NUM_SAY[n]); else if (window.ZooFx && X.sfx()) ZooFx.tone(660, 0, 0.06, "sine", 0.06);
      });
      box2.setAttribute("aria-label", "Enclos : touche pour ajouter un animal, touche un animal pour le retirer");
      card.appendChild(box2); card.appendChild(hint);
      var ok = btn("primary big-btn gc-done", "✅ J’ai fini", function () { if (over) return; over = true; hush(); ok.disabled = true; var g = n === Q.t; box2.classList.add(g ? "good" : "bad"); answer(g, next); });
      card.appendChild(ok); draw();
    }
    later(function () { if (R && R.qs[R.n - 1] === Q) instr(Q); }, 300);
  }
  /* ---------- fin de série : le serveur range le résultat et décide de la roue ---------- */
  function end(box) {
    var run = R, key = R.step.key, card = el("div", "card calc-card gc-card");
    document.body.classList.remove("listen-focus");
    if (X.preview) {
      var pass = M.cfg[R.comp].seuil;
      card.appendChild(el("h2", "", "Série terminée !"));
      card.appendChild(el("p", "", R.good + " bonnes réponses sur " + R.qs.length + " · " + (R.good * 100 >= pass * R.qs.length ? "Série réussie" : "Seuil de réussite : " + pass + " %")));
      var comp = R.comp; card.appendChild(btn("primary big-btn", "Rejouer", function () { start(comp); }));
      box.appendChild(card); R = null; return;
    }
    var info = el("p", "msg", "Je range ton résultat…"), row = el("div", "crow");
    card.appendChild(el("h2", "", "Bravo, tu as fini !")); card.appendChild(info); card.appendChild(row); box.appendChild(card);
    function send() {
      X.rpc("lab_student_submit_round", { p_token: X.token(), p_round: run.id, p_activity: "gs", p_level: key, p_correct: run.good, p_total: run.qs.length, p_stats: { aid: !!run.aid, helps: run.helps } })
        .then(function (res) {
          if (res && res.inserted === false) return X.rpc("lab_student_state", { p_token: X.token() }).then(function (st) { load(st.progress, X.teacher(), X.sid()); X.setWheels(st.wheels); return { success: null, reload: true }; });
          return res;
        })
        .then(function (res) { if (R === run) result(box, run, res || {}); })
        .catch(function () {
          info.className = "msg bad"; info.textContent = "Ton résultat n’est pas encore rangé. Vérifie la connexion puis touche « Réessayer ».";
          X.clear(row); row.appendChild(btn("primary big-btn go-next", "Réessayer", function () { info.className = "msg"; info.textContent = "Je range ton résultat…"; X.clear(row); send(); }));
        });
    }
    send();
  }
  function result(box, run, res) {
    var key = run.step.key, c = M.cfg[run.comp];
    if (!res.reload) {
      if (res.gs) M.st[key] = D.calcState((function () { var o = {}; o[key] = res.gs; return o; })())[key];
      M.gsh.push({ k: key, c: run.good, n: run.qs.length, ok: !!res.success, aid: !!run.aid }); M.gsh = M.gsh.slice(-60);
      if (typeof res.wheels === "number") X.setWheels(res.wheels);
    }
    var ok = res.reload ? run.good * 100 >= c.seuil * run.qs.length : !!res.success, st = D.calcItem(M.st, key);
    X.clear(box); R = null;
    var card = el("div", "card calc-card gc-card");
    card.appendChild(el("h2", "", res.validated ? "Bravo, tu as réussi ! 🎉" : ok ? "Bravo ! 👏" : "Presque !"));
    card.appendChild(el("p", "instruction", "Tu as trouvé " + run.good + " fois sur " + run.qs.length + "."));
    if (!run.free && !run.aid) {
      var need = c.series, have = res.validated ? need : st.ok, stars = el("div", "gc-stars"); stars.setAttribute("role", "img"); stars.setAttribute("aria-label", have + " étoiles sur " + need);
      for (var k = 0; k < need; k++) stars.appendChild(el("span", k < have ? "on" : "", "★"));
      card.appendChild(stars);
    }
    var voice = res.validated ? ["c:valide", "Bravo ! Tu as gagné toutes les étoiles."] : ok ? ["c:bravo", "Bravo !"] : st.aid ? ["c:aideok", "Ce n’est pas grave. Je vais t’aider."] : ["c:presque", "Presque ! On recommence ?"];
    if (res.validated && window.ZooFx && ZooFx.confetti) ZooFx.confetti(60, false);
    var row = el("div", "row"), wheel = ok && X.wheels() > 0;
    if (wheel) row.appendChild(btn("primary big-btn go-next wheel-go", "🎡 Lance ta roue !", function () { X.goTo("roue"); }));
    else row.appendChild(btn("primary big-btn go-next", ok ? "Continuer ➜" : "🔁 Je réessaie", function () { start(); }));
    card.appendChild(row);
    var small = el("div", "gc-small"); small.appendChild(btn("secondary", "🏠 Ma mission", function () { X.goTo("home"); })); card.appendChild(small);
    box.appendChild(card); X.renderPanels();
    say(voice[0], voice[1]);
  }
  function stop() { hush(); R = null; document.body.classList.remove("listen-focus"); }
  /* aperçu enseignant (Pédagogie › Visualiser) : une série de la 1re étape de l'activité, rien n'est envoyé */
  function preview(comp, settings) { M.cfg = D.calcConfig(settings && settings.gs); M.gsr = "x"; css(); start(comp); }
  function init(ctx) { X = ctx; }
  window.ZooGSCalc = { init: init, load: load, active: function () { return M.track === "gs"; }, home: home, render: render, start: start, rituel: rituel, preview: preview, stop: stop, _run: function () { return R; }, _M: M };
})();
