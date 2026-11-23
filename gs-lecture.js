/* Parcours GS — écran élève de la Lecture (prototype : « Les lettres capitales »). ES5/ES2018 (iPad iOS 12).
   Besoin : gs-data.js (window.ZooGSData) et le contexte du Zoo (window.ZooGSCtx(), défini dans zoo-connecte.html).
   Données : data.gs[élève] = { lecture: { cap: état (voir ZooGSData.compState) }, series: [60 dernières], rw: [ids de séries déjà récompensées] }
   enregistré dans progress.gs (cloudSnapshot) ; parcours de l'élève = data.tracks[élève].lecture (réglage enseignant settings.tracks, jamais modifiable par l'élève).
   Écran : vue « gs » (#gs-body). Voir docs/parcours-gs/avancement.md. */
(function () {
  "use strict";
  var D = window.ZooGSData, X = null, R = null, timers = [];
  function ctx() { if (!X) X = window.ZooGSCtx(); return X; }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function later(f, ms) { timers.push(setTimeout(f, ms)); }
  function css() {
    if (document.getElementById("gsStyle")) return;
    var s = document.createElement("style"); s.id = "gsStyle";
    s.textContent = ".gs-grid{display:flex;flex-wrap:wrap;justify-content:center;margin:14px -8px}" +
      ".gs-let{font-family:Andika,Figtree,sans-serif;font-weight:700;font-size:3.6rem;line-height:1;width:118px;height:118px;margin:8px;border-radius:24px;border:3px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}" +
      ".gs-let.lit{border-color:#2e9b6a;box-shadow:0 0 0 6px rgba(46,155,106,.25)}.gs-let.good{background:#dff3e8;border-color:#2e9b6a}" +
      ".gs-let.bad{background:#fde3e3;border-color:#c62f4a}.gs-let.bad:after{content:' ✗';font-size:1.6rem;color:#c62f4a}" +
      ".gs-let:disabled{cursor:default}.gs-demo{font-family:Andika,Figtree,sans-serif;font-weight:700;font-size:7rem;text-align:center;margin:18px 0}" +
      ".gs-stars{text-align:center;font-size:2.2rem;letter-spacing:6px}.gs-stars .on{color:#f2b705}.gs-stars span{color:#c9cdd6}" +
      ".gs-small{margin-top:14px;text-align:center}.gs-small button{font-size:1rem}" +
      "@media (max-width:600px){.gs-let{width:96px;height:96px;font-size:3rem;margin:6px}}";
    document.head.appendChild(s);
  }
  /* ---------- état de l'élève ---------- */
  function clean(p) {
    p = p && typeof p === "object" ? p : {};
    var lec = p.lecture && typeof p.lecture === "object" ? p.lecture : {};
    var series = Array.isArray(p.series) ? p.series.filter(function (x) { return x && typeof x.id === "string"; }).slice(-60) : [];
    var rw = Array.isArray(p.rw) ? p.rw.filter(function (x) { return typeof x === "string"; }).slice(-100) : [];
    return { lecture: { cap: D.compState(lec.cap) }, series: series, rw: rw, rituel: p.rituel && typeof p.rituel === "object" ? p.rituel : {} };
  }
  function mine(sid) { var d = ctx().data; d.gs = d.gs || {}; if (!d.gs[sid]) d.gs[sid] = clean(null); return d.gs[sid]; }
  function track(sid, dom) { var t = ctx().data.tracks && ctx().data.tracks[sid]; return t && t[dom] === "gs" ? "gs" : "cp"; }
  function cfg() { return D.config(ctx().data.gsCfg); }
  function stepList(sid) { var st = ctx().studentById(sid); return D.steps("cap", cfg(), st ? st.name : ""); }
  /* ---------- accueil GS : une seule grande action ---------- */
  function home(body, sid, st) {
    var C = ctx(), G = mine(sid), list = stepList(sid), i = D.current(G.lecture.cap, list), wheels = C.data.reward ? C.pendingWheels(sid).length : 0;
    css();
    var card = C.el("div", "card home-hero");
    card.appendChild(C.el("h2", "", "Bonjour " + st.name + " !"));
    var say, btn, go;
    if (wheels) { btn = "🎡 Lance ta roue !"; say = "Une roue t’attend. Touche le gros bouton pour la lancer."; go = function () { C.openWheel(sid); }; }
    else if (i < 0) { btn = "🔤 Je m’entraîne avec les lettres"; say = "Bravo, tu connais toutes les lettres ! Tu peux t’entraîner encore."; go = function () { start(sid); }; }
    else { btn = "🔤 Je joue avec les lettres"; say = "Ta mission : reconnaître les lettres. Touche le gros bouton."; go = function () { start(sid); }; }
    card.appendChild(C.el("p", "instruction", i < 0 ? "Tu connais toutes les lettres ! ⭐" : "Ma mission : les lettres"));
    var b = C.el("button", "primary big-btn go-next", btn); b.type = "button";
    b.addEventListener("click", function () { C.listenStopVoice(); go(); });
    var hear = C.el("button", "listen-play", "🔊"); hear.type = "button"; hear.setAttribute("aria-label", "Écouter la consigne");
    hear.addEventListener("click", function () { C.listenSpeak("Bonjour " + st.name + " ! " + say); });
    var row = C.el("div", "row"); row.appendChild(b); row.appendChild(hear);
    card.appendChild(row);
    body.appendChild(card);
  }
  /* ---------- une série ---------- */
  function start(sid) {
    var C = ctx(), G = mine(sid), list = stepList(sid), i = D.current(G.lecture.cap, list), free = i < 0;
    var step = list[free ? list.length - 1 : i], aid = !free && G.lecture.cap.aid;
    var s = D.buildSeries(step, cfg(), "cap", aid);
    R = { sid: sid, step: step, free: free, aid: aid, qs: s.qs, n: 0, good: 0, answers: [], id: C.uid() };
    C.goTo("gs");
  }
  function render() {
    var C = ctx(); clear();
    if (!R) { C.goTo("home"); return; }
    C.listenFocus(true);
    if (R.aid && !R.demoDone) { demo(); return; }
    question();
  }
  /* Aide : démonstration guidée des lettres du palier avant la série */
  function demo() {
    var C = ctx(), body = C.$("gs-body"), k = 0, letters = R.step.targets;
    body.innerHTML = "";
    var card = C.el("div", "card listen-card");
    card.appendChild(C.el("h2", "", "Regarde et écoute 👀"));
    var big = C.el("div", "gs-demo", "");
    card.appendChild(big);
    var skip = C.el("button", "primary big-btn go-next", "▶ À moi de jouer"); skip.type = "button";
    skip.addEventListener("click", function () { clear(); C.listenStopVoice(); R.demoDone = true; question(); });
    card.appendChild(skip);
    body.appendChild(card);
    function next() {
      if (!R || R.demoDone) return;
      if (k >= letters.length) { R.demoDone = true; later(question, 600); return; }
      var L = letters[k++]; big.textContent = L;
      C.listenSpeak(D.LETTER_SAY[L], function () { later(next, 700); });
    }
    C.listenSpeak("Je vais t’aider. Regarde bien les lettres et écoute leur nom.", function () { later(next, 400); });
  }
  function sayLetter(Q) { ctx().listenSpeak("Touche la lettre… " + D.LETTER_SAY[Q.t]); }
  function question() {
    var C = ctx(), body = C.$("gs-body");
    if (R.n >= R.qs.length) { end(); return; }
    var Q = R.qs[R.n], total = R.qs.length, over = false, btns = [];
    R.n++;
    body.innerHTML = "";
    var card = C.el("div", "card listen-card");
    var top = C.el("div", "listen-top");
    top.appendChild(C.el("span", "listen-count", R.n + " sur " + total));
    var quit = C.el("button", "secondary", "Arrêter"); quit.type = "button";
    quit.addEventListener("click", function () { C.quitAsk(card, R.n > 1, function () { stop(); C.goTo("home"); }); });
    top.appendChild(quit);
    card.appendChild(top);
    var bar = C.el("div", "listen-dots"); bar.setAttribute("aria-hidden", "true");
    for (var i = 0; i < total; i++) bar.appendChild(C.el("span", i < R.n - 1 ? "done" : (i === R.n - 1 ? "now" : ""), ""));
    card.appendChild(bar);
    var again = C.el("button", "listen-play", "🔊 Écouter"); again.type = "button";
    again.addEventListener("click", function () { sayLetter(Q); });
    card.appendChild(again);
    var grid = C.el("div", "gs-grid");
    Q.opts.forEach(function (L) {
      var b = C.el("button", "gs-let", L); b.type = "button"; b.setAttribute("aria-label", "Lettre " + D.LETTER_SAY[L]);
      b.addEventListener("click", function () {
        if (over) return; over = true; clear(); C.listenStopVoice();
        btns.forEach(function (x) { x.disabled = true; });
        var good = L === Q.t;
        R.answers.push(Q.t + (good ? "" : ">" + L));
        if (good) { R.good++; b.classList.add("good"); if (C.data.sfx) C.sfxGood(); later(question, 900); }
        else { b.classList.add("bad"); if (C.data.sfx) C.sfxBad(); C.listenSpeak("Ce n’est pas celle-là."); later(question, 1500); }   /* la bonne lettre n'est pas montrée */
      });
      btns.push(b); grid.appendChild(b);
    });
    card.appendChild(grid);
    body.appendChild(card);
    later(function () { sayLetter(Q); }, 300);
  }
  function end() {
    var C = ctx(), sid = R.sid, G = mine(sid), list = stepList(sid), c = cfg(), now = Date.now(), body = C.$("gs-body");
    var res = R.free ? { ok: R.good * 100 >= c.cap.seuil * R.qs.length, validated: false } : D.record(G.lecture.cap, list, c, "cap", R.good, R.qs.length, R.aid, now);
    G.series.push({ id: R.id, c: "cap", k: R.step.key, q: R.qs.length, g: R.good, th: c.cap.seuil, aid: R.aid, ts: now, ok: res.ok, a: R.answers.join(" ") });
    G.series = G.series.slice(-60);
    var wheel = false;
    if (res.ok && C.data.reward && G.rw.indexOf(R.id) < 0) {   /* une seule roue par série réussie (anti-doublon) */
      G.rw.push(R.id); G.rw = G.rw.slice(-100);
      C.data.wheels.push({ id: "gs:" + R.id, sid: sid, ts: now }); wheel = true;
    }
    C.statDay(sid, 1); C.statExercise(sid, res.ok);
    C.save(); C.renderPanels();
    C.listenFocus(false);
    body.innerHTML = "";
    var card = C.el("div", "card listen-card");
    card.appendChild(C.el("h2", "", res.validated ? "Bravo, tu as réussi ! 🎉" : (res.ok ? "Bravo ! 👏" : "Presque !")));
    card.appendChild(C.el("p", "instruction", "Tu as trouvé " + R.good + " lettres sur " + R.qs.length + "."));
    if (!R.free && !R.aid) {
      var need = c.cap.series, have = res.validated ? need : G.lecture.cap.ok, stars = C.el("div", "gs-stars"); stars.setAttribute("role", "img"); stars.setAttribute("aria-label", have + " étoiles sur " + need);
      for (var k = 0; k < need; k++) stars.appendChild(C.el("span", k < have ? "on" : "", "★"));
      card.appendChild(stars);
    }
    var say = res.validated ? "Bravo ! Tu as gagné toutes les étoiles." : res.ok ? "Bravo !" : (G.lecture.cap.aid ? "Ce n’est pas grave. Je vais t’aider." : "Presque ! On recommence ?");
    if (res.validated && C.confetti) C.confetti(60, false);
    var row = C.el("div", "row"), main;
    if (wheel) { main = C.el("button", "primary big-btn go-next wheel-go", "🎡 Lance ta roue !"); main.addEventListener("click", function () { C.openWheel(sid, res.validated ? "Bravo, tu connais ces lettres !" : "Bravo, série réussie !"); }); }
    else if (res.ok) { main = C.el("button", "primary big-btn go-next", "Continuer ➜"); main.addEventListener("click", function () { start(sid); }); }
    else { main = C.el("button", "primary big-btn go-next", "🔁 Je réessaie"); main.addEventListener("click", function () { start(sid); }); }
    main.type = "button"; row.appendChild(main); card.appendChild(row);
    var small = C.el("div", "gs-small"), hb = C.el("button", "secondary", "🏠 Accueil"); hb.type = "button";
    hb.addEventListener("click", function () { C.goTo("home"); }); small.appendChild(hb); card.appendChild(small);
    body.appendChild(card);
    C.listenSpeak(say);
    R = null;
  }
  function stop() { clear(); R = null; if (X) { X.listenStopVoice(); X.listenFocus(false); } }
  window.ZooGS = { clean: clean, track: track, home: home, start: start, render: render, stop: stop, _run: function () { return R; } };
})();
