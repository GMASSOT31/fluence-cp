/* Parcours GS — écran élève de la Lecture : rituel « comptine des lettres » + les six activités des lettres (capitales, capitale ↔ script,
   script, script ↔ cursive, cursive, ordre alphabétique), enchaînées par groupe de lettres (ZooGSData.path). ES2018 (iPad iOS 12).
   Cursive : police officielle eduscol « Marelle » (variante Bâton, licence OFL, fonts/marelle/).
   Besoin : gs-data.js (window.ZooGSData), vendor/howler (sons enregistrés, facultatif) et le contexte du Zoo (window.ZooGSCtx(), zoo-connecte.html).
   Données : data.gs[élève] = { lecture: { cap|capscript|script|scriptcurs|curs|ordre: état (ZooGSData.compState) }, series: [60 dernières], rw: [ids de séries récompensées], rituel: { lecture: date } }
   enregistré dans progress.gs (cloudSnapshot) ; parcours = data.tracks[élève].lecture (réglage enseignant settings.tracks, jamais modifiable par l'élève).
   Sons : audio/gs.json + audio/gs.mp3 (tools/build_gs_audio.py : lettres « L:A », nombres « N:3 », consignes « c:… ») ; sans eux, voix de l'appareil.
   Écran : vue « gs » (#gs-body). Voir docs/parcours-gs/avancement.md. */
(function () {
  "use strict";
  var D = window.ZooGSData, X = null, R = null, timers = [], GS_AUDIO_V = "3";
  function ctx() { if (!X) X = window.ZooGSCtx(); return X; }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function later(f, ms) { timers.push(setTimeout(f, ms)); }
  function css() {
    if (document.getElementById("gsStyle")) return;
    var s = document.createElement("style"); s.id = "gsStyle";
    s.textContent = "@font-face{font-family:'Marelle GS';src:url(fonts/marelle/MarelleBaton.woff2?v=1) format('woff2');font-display:block}" +
      ".w-script{font-family:Andika,Figtree,sans-serif!important;font-weight:400!important}.w-curs{font-family:'Marelle GS',cursive!important;font-weight:400!important}" +
      ".gs-let.w-curs{height:166px;font-size:3.2rem;line-height:1;padding:0}.gs-demo.w-curs{font-size:6rem;line-height:1.6}" +
      ".gs-model{display:flex;justify-content:center;margin:6px 0}.gs-model .gs-let{width:150px;height:150px;font-size:4.6rem;border-color:#2e9b6a;background:#f2faf6;cursor:default}.gs-model .gs-let.w-curs{height:190px;font-size:3.8rem}" +
      ".gs-slots{display:flex;justify-content:center;flex-wrap:wrap;margin:10px 0 2px}.gs-slot{font-family:Andika,Figtree,sans-serif;font-weight:700;font-size:2.6rem;width:78px;height:86px;line-height:80px;margin:5px;text-align:center;border:3px dashed #b8c0cc;border-radius:18px;color:#1d6b45}" +
      ".gs-slot.full{border-style:solid;border-color:#2e9b6a;background:#dff3e8}.gs-let.used{visibility:hidden}.gs-pair{font-family:Andika,Figtree,sans-serif;font-weight:700;font-size:5rem;text-align:center;margin:10px 0}" +
      ".gs-pair span{display:inline-block;min-width:1.2em}.gs-pair i{font-style:normal;color:#8a93a3;font-size:3rem;margin:0 .4em;vertical-align:middle}" +
      ".gs-grid{display:flex;flex-wrap:wrap;justify-content:center;margin:14px -8px}" +
      ".gs-let{font-family:Andika,Figtree,sans-serif;font-weight:700;font-size:3.6rem;line-height:1;width:118px;height:118px;margin:8px;border-radius:24px;border:3px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}" +
      ".gs-let.lit{border-color:#2e9b6a;box-shadow:0 0 0 6px rgba(46,155,106,.25)}.gs-let.good{background:#dff3e8;border-color:#2e9b6a}" +
      ".gs-let.bad{background:#fde3e3;border-color:#c62f4a}.gs-let.bad:after{content:' ✗';font-size:1.6rem;color:#c62f4a}" +
      ".gs-let:disabled{cursor:default}.gs-demo{font-family:Andika,Figtree,sans-serif;font-weight:700;font-size:7rem;line-height:1.1;text-align:center;margin:14px 0;min-height:1.1em}" +
      ".gs-stars{text-align:center;font-size:2.2rem;letter-spacing:6px}.gs-stars .on{color:#f2b705}.gs-stars span{color:#c9cdd6}" +
      ".gs-small{margin-top:14px;text-align:center}.gs-small button{font-size:1rem;margin:4px}" +
      ".gs-abc{display:flex;flex-wrap:wrap;justify-content:center;margin:6px -3px 12px}.gs-abc span{font-family:Andika,Figtree,sans-serif;font-weight:700;font-size:1.25rem;width:34px;height:40px;line-height:40px;margin:3px;text-align:center;border-radius:10px;background:#eef1f6;color:#8a93a3;transition:background .2s,color .2s}" +
      ".gs-abc span.seen{background:#dff3e8;color:#1d6b45}.gs-abc span.now{background:#2e9b6a;color:#fff}" +
      "@media (prefers-reduced-motion:reduce){.gs-abc span{transition:none}}" +
      "@media (max-width:600px){.gs-let{width:96px;height:96px;font-size:3rem;margin:6px}.gs-let.w-curs{height:136px;font-size:2.6rem}.gs-model .gs-let.w-curs{height:156px;font-size:3.1rem}.gs-demo{font-size:5.5rem}.gs-model .gs-let{width:120px;height:120px;font-size:3.8rem}.gs-slot{width:62px;height:72px;line-height:66px;font-size:2.1rem;margin:4px}.gs-pair{font-size:3.8rem}}";
    document.head.appendChild(s);
    try { if (document.fonts && document.fonts.load) document.fonts.load("40px 'Marelle GS'"); } catch (e) {}   /* la cursive est prête avant la 1re question */
  }
  /* bouton-lettre dans une écriture (cap, script, curs) */
  function letBtn(L, w, cls) { var b = ctx().el("button", "gs-let w-" + w + (cls ? " " + cls : ""), D.glyph(L, w)); b.type = "button"; b.setAttribute("aria-label", "Lettre " + D.LETTER_SAY[L]); return b; }
  /* ---------- sons enregistrés (facultatifs) ---------- */
  var A = { map: null, howl: null, ok: false, asked: false, cur: null };
  function audioLoad() {
    if (A.asked || !window.Howl || !window.XMLHttpRequest) return;
    A.asked = true;
    try {
      var x = new XMLHttpRequest();
      x.open("GET", "audio/gs.json?v=" + GS_AUDIO_V);
      x.onload = function () {
        if (x.status < 200 || x.status >= 300) return;
        try { A.map = JSON.parse(x.responseText); } catch (e) { return; }
        if (!A.map || !A.map.sprite || !A.map.src) { A.map = null; return; }
        A.howl = new window.Howl({ src: [A.map.src], sprite: A.map.sprite, preload: true, html5: false, onload: function () { A.ok = true; } });
      };
      x.send();
    } catch (e) {}
  }
  function audioStop() { try { if (A.howl) A.howl.stop(); } catch (e) {} A.cur = null; }
  function running() { try { return !window.Howler || !Howler.ctx || Howler.ctx.state === "running"; } catch (e) { return true; } }
  /* dit la clé enregistrée si elle existe (et si le son de la tablette est réveillé), sinon le texte avec la voix de l'appareil */
  function say(key, text, done) {
    var C = ctx();
    if (A.ok && A.map.sprite[key]) {
      if (!running()) { try { Howler.ctx.resume(); } catch (e) {} }
      if (running()) {
        try {
          C.listenStopVoice(); audioStop();
          var id = A.howl.play(key), fin = false; A.cur = id;
          var end = function () { if (fin) return; fin = true; if (done) done(); };
          A.howl.once("end", end, id); A.howl.once("stop", end, id); A.howl.once("playerror", end, id);
          return;
        } catch (e) {}
      }
    }
    C.listenSpeak(text, done);
  }
  /* plusieurs morceaux à la suite : [[clé, texte], …] */
  function sayAll(parts, done) {
    var i = 0, tok = {}; sayAll.tok = tok;
    function next() { if (sayAll.tok !== tok) return; if (i >= parts.length) { if (done) done(); return; } var p = parts[i++]; say(p[0], p[1], function () { later(next, 180); }); }
    next();
  }
  function letterPart(L) { return ["L:" + L, D.LETTER_SAY[L]]; }
  /* ---------- état de l'élève ---------- */
  function clean(p) {
    p = p && typeof p === "object" ? p : {};
    var lec = p.lecture && typeof p.lecture === "object" ? p.lecture : {};
    var series = Array.isArray(p.series) ? p.series.filter(function (x) { return x && typeof x.id === "string"; }).slice(-60) : [];
    var rw = Array.isArray(p.rw) ? p.rw.filter(function (x) { return typeof x === "string"; }).slice(-100) : [];
    var rit = {}; if (p.rituel && typeof p.rituel.lecture === "number") rit.lecture = p.rituel.lecture;
    return { lecture: D.lecState(lec), series: series, rw: rw, rituel: rit };
  }
  function mine(sid) { var d = ctx().data; d.gs = d.gs || {}; if (!d.gs[sid]) d.gs[sid] = clean(null); return d.gs[sid]; }
  function track(sid, dom) { var t = ctx().data.tracks && ctx().data.tracks[sid]; return t && t[dom] === "gs" ? "gs" : "cp"; }
  function cfg() { return D.config(ctx().data.gsCfg); }
  function pathOf(sid) { var st = ctx().studentById(sid); return D.path(cfg(), st ? st.name : ""); }
  function stepList(sid, comp) { var st = ctx().studentById(sid); return D.steps(comp, cfg(), st ? st.name : ""); }
  /* ---------- accueil GS : une seule grande action ---------- */
  function home(body, sid, st) {
    var C = ctx(), G = mine(sid), items = pathOf(sid), i = D.pathCurrent(G.lecture, items), wheels = C.data.reward ? C.pendingWheels(sid).length : 0, first = !G.rituel.lecture;
    css(); audioLoad();
    var card = C.el("div", "card home-hero");
    card.appendChild(C.el("h2", "", "Bonjour " + st.name + " !"));
    var key, text, btn, go;
    if (wheels) { btn = "🎡 Lance ta roue !"; key = "c:roue"; text = "Une roue t’attend. Touche le gros bouton pour la lancer."; go = function () { C.openWheel(sid); }; }
    else if (first) { btn = "🎵 La comptine des lettres"; key = "c:rituel"; text = "D’abord, écoute la comptine des lettres. Touche le gros bouton."; go = function () { rituel(sid); }; }
    else if (i < 0) { btn = "🔤 Je m’entraîne avec les lettres"; key = "c:fini"; text = "Bravo, tu connais toutes les lettres ! Tu peux t’entraîner encore."; go = function () { start(sid); }; }
    else { btn = "🔤 Je joue avec les lettres"; key = "c:mission"; text = "Ta mission : reconnaître les lettres. Touche le gros bouton."; go = function () { start(sid); }; }
    card.appendChild(C.el("p", "instruction", i < 0 ? "Tu connais toutes les lettres ! ⭐" : "Ma mission : " + D.COMP[items[i].comp].mission));
    var b = C.el("button", "primary big-btn go-next", btn); b.type = "button";
    b.addEventListener("click", function () { C.listenStopVoice(); audioStop(); go(); });
    var hear = C.el("button", "listen-play", "🔊"); hear.type = "button"; hear.setAttribute("aria-label", "Écouter la consigne");
    hear.addEventListener("click", function () { C.listenSpeak("Bonjour " + st.name + " !", function () { say(key, text); }); });
    var row = C.el("div", "row"); row.appendChild(b); row.appendChild(hear);
    card.appendChild(row);
    var small = C.el("div", "gs-small");
    if (first && !wheels) { var skip = C.el("button", "secondary", "Plus tard"); skip.type = "button"; skip.addEventListener("click", function () { G.rituel.lecture = Date.now(); C.save(); C.goTo("home"); }); small.appendChild(skip); }
    else if (!first) { var rb = C.el("button", "secondary", "🎵 La comptine des lettres"); rb.type = "button"; rb.addEventListener("click", function () { rituel(sid); }); small.appendChild(rb); }
    if (small.children.length) card.appendChild(small);
    body.appendChild(card);
  }
  /* ---------- rituel : comptine des lettres (≈ 25 s, facultative après la 1re fois, ne valide rien, pas de roue) ---------- */
  function rituel(sid) { R = { rituel: true, sid: sid }; ctx().goTo("gs"); }
  function renderRituel() {
    var C = ctx(), body = C.$("gs-body"), G = mine(R.sid), letters = Object.keys(D.LETTER_SAY), k = 0, run = R;
    body.innerHTML = "";
    var card = C.el("div", "card listen-card");
    card.appendChild(C.el("h2", "", "🎵 La comptine des lettres"));
    var big = C.el("div", "gs-demo", "A"), strip = C.el("div", "gs-abc"), cells = [];
    letters.forEach(function (L) { var c = C.el("span", "", L); cells.push(c); strip.appendChild(c); });
    card.appendChild(big); card.appendChild(strip);
    var main = C.el("button", "primary big-btn go-next", "▶ J’écoute"); main.type = "button";
    var small = C.el("div", "gs-small"), skip = C.el("button", "secondary", "Passer ⏭"); skip.type = "button";
    skip.addEventListener("click", function () { finish(); });
    small.appendChild(skip);
    card.appendChild(main); card.appendChild(small);
    body.appendChild(card);
    function finish() {
      if (R !== run) return;
      clear(); sayAll.tok = null; audioStop(); C.listenStopVoice();
      G.rituel.lecture = Date.now(); C.save();
      cells.forEach(function (c) { c.className = "seen"; });
      main.textContent = "🔤 Je joue avec les lettres"; main.hidden = false; main.onclick = function () { start(run.sid); };
      skip.textContent = "🔁 Encore"; skip.onclick = function () { rituel(run.sid); };
      say("c:alphafin", "Bravo ! Tu as écouté toutes les lettres.");
    }
    function next() {
      if (R !== run) return;
      if (k >= letters.length) { later(finish, 500); return; }
      var L = letters[k];
      if (k) cells[k - 1].className = "seen";
      cells[k].className = "now"; big.textContent = L; k++;
      say("L:" + L, D.LETTER_SAY[L], function () { later(next, 260); });
    }
    main.onclick = function () { main.hidden = true; say("c:alpha", "Écoute la comptine des lettres !", function () { later(next, 300); }); };
  }
  /* ---------- une série ---------- */
  function start(sid) {
    var C = ctx(), G = mine(sid), items = pathOf(sid), i = D.pathCurrent(G.lecture, items), free = i < 0;
    if (!items.length) return;
    var it = free ? items[Math.floor(Math.random() * items.length)] : items[i], comp = it.comp, step = it.step, aid = !free && G.lecture[comp].aid;   /* tout validé : entraînement libre sur une étape au hasard */
    var s = D.buildSeries(step, cfg(), comp, aid);
    R = { sid: sid, comp: comp, K: D.COMP[comp], step: step, free: free, aid: aid, qs: s.qs, n: 0, good: 0, answers: [], id: C.uid() };
    audioLoad();
    C.goTo("gs");
  }
  /* Aperçu enseignant (Pédagogie › Visualiser) : une série de la 1re étape de l'activité, en entraînement libre (rien n'est validé ni enregistré) */
  function preview(sid, comp) {
    var items = pathOf(sid).filter(function (x) { return x.comp === comp; });
    if (!items.length) return false;
    var it = items[0], s = D.buildSeries(it.step, cfg(), comp, false);
    R = { sid: sid, comp: comp, K: D.COMP[comp], step: it.step, free: true, aid: false, qs: s.qs, n: 0, good: 0, answers: [], id: ctx().uid() };
    audioLoad(); ctx().goTo("gs"); return true;
  }
  function render() {
    var C = ctx(); clear(); css();
    if (!R) { C.goTo("home"); return; }
    if (R.rituel) { renderRituel(); return; }
    C.listenFocus(true);
    if (R.aid && !R.demoDone) { demo(); return; }
    question();
  }
  /* Aide : démonstration guidée des lettres du palier avant la série */
  function demo() {
    var C = ctx(), body = C.$("gs-body"), k = 0, K = R.K, letters = K.act === "ordre" ? R.qs[0].seq : R.step.targets, run = R;
    body.innerHTML = "";
    var card = C.el("div", "card listen-card");
    card.appendChild(C.el("h2", "", "Regarde et écoute 👀"));
    var big = C.el("div", K.act === "assoc" ? "gs-pair" : "gs-demo w-" + (K.w || "cap"), ""), strip = null, cells = {};
    card.appendChild(big);
    if (K.act === "ordre") {   /* l'alphabet en bande, les lettres de la série s'allument dans l'ordre */
      strip = C.el("div", "gs-abc"); Object.keys(D.LETTER_SAY).forEach(function (L) { cells[L] = C.el("span", "", L); strip.appendChild(cells[L]); }); card.appendChild(strip);
    }
    var skip = C.el("button", "primary big-btn go-next", "▶ À moi de jouer"); skip.type = "button";
    skip.addEventListener("click", function () { clear(); sayAll.tok = null; audioStop(); C.listenStopVoice(); R.demoDone = true; question(); });
    card.appendChild(skip);
    body.appendChild(card);
    function next() {
      if (R !== run || R.demoDone) return;
      if (k >= letters.length) { R.demoDone = true; later(question, 600); return; }
      var L = letters[k++];
      if (K.act === "assoc") { big.innerHTML = ""; var a = C.el("span", "w-" + K.a, D.glyph(L, K.a)), b = C.el("span", "w-" + K.b, D.glyph(L, K.b)); big.appendChild(a); big.appendChild(C.el("i", "", "↔")); big.appendChild(b); }
      else big.textContent = D.glyph(L, K.w);
      if (strip) { Object.keys(cells).forEach(function (c) { if (cells[c].className === "now") cells[c].className = "seen"; }); cells[L].className = "now"; }
      say("L:" + L, D.LETTER_SAY[L], function () { later(next, 700); });
    }
    say("c:aide", "Je vais t’aider. Regarde bien les lettres et écoute leur nom.", function () { later(next, 400); });
  }
  function sayLetter(Q) {
    if (R.K.act === "assoc") say("c:meme", "Touche la même lettre.");
    else if (R.K.act === "ordre") say("c:ordre", "Range les lettres dans l’ordre de l’alphabet.");
    else sayAll([["c:touche", "Touche la lettre"], letterPart(Q.t)]);
  }
  function question() {
    var C = ctx(), body = C.$("gs-body");
    if (R.n >= R.qs.length) { end(); return; }
    if (R.K.act === "ordre") { orderQuestion(); return; }
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
    var K = R.K, wOpt = K.act === "assoc" ? (Q.dir ? K.a : K.b) : K.w;
    if (K.act === "assoc") { var model = C.el("div", "gs-model"), mb = letBtn(Q.t, Q.dir ? K.b : K.a); mb.disabled = true; model.appendChild(mb); card.appendChild(model); }
    var grid = C.el("div", "gs-grid");
    Q.opts.forEach(function (L) {
      var b = letBtn(L, wOpt);
      if (K.act === "assoc") b.setAttribute("aria-label", "Choix " + (Q.opts.indexOf(L) + 1));
      b.addEventListener("click", function () {
        if (over) return; over = true; clear(); sayAll.tok = null; audioStop(); C.listenStopVoice();
        btns.forEach(function (x) { x.disabled = true; });
        var good = L === Q.t;
        R.answers.push(Q.t + (good ? "" : ">" + L));
        if (good) { R.good++; b.classList.add("good"); if (C.data.sfx) C.sfxGood(); later(question, 900); }
        else { b.classList.add("bad"); if (C.data.sfx) C.sfxBad(); say("c:pas", "Ce n’est pas celle-là."); later(question, 1500); }   /* la bonne lettre n'est pas montrée */
      });
      btns.push(b); grid.appendChild(b);
    });
    card.appendChild(grid);
    body.appendChild(card);
    later(function () { sayLetter(Q); }, 300);
  }
  /* Ordre alphabétique : toucher les lettres dans l'ordre ; une erreur fait rater la question (la lettre reste à sa place, on continue) */
  function orderQuestion() {
    var C = ctx(), body = C.$("gs-body"), Q = R.qs[R.n], total = R.qs.length, k = 0, err = false, over = false, slots = [];
    R.n++;
    body.innerHTML = "";
    var card = C.el("div", "card listen-card"), top = C.el("div", "listen-top");
    top.appendChild(C.el("span", "listen-count", R.n + " sur " + total));
    var quit = C.el("button", "secondary", "Arrêter"); quit.type = "button";
    quit.addEventListener("click", function () { C.quitAsk(card, R.n > 1, function () { stop(); C.goTo("home"); }); });
    top.appendChild(quit); card.appendChild(top);
    var bar = C.el("div", "listen-dots"); bar.setAttribute("aria-hidden", "true");
    for (var i = 0; i < total; i++) bar.appendChild(C.el("span", i < R.n - 1 ? "done" : (i === R.n - 1 ? "now" : ""), ""));
    card.appendChild(bar);
    var again = C.el("button", "listen-play", "🔊 Écouter"); again.type = "button";
    again.addEventListener("click", function () { sayLetter(Q); });
    card.appendChild(again);
    if (R.aid) { var strip = C.el("div", "gs-abc"); Object.keys(D.LETTER_SAY).forEach(function (L) { strip.appendChild(C.el("span", Q.seq.indexOf(L) >= 0 ? "seen" : "", L)); }); card.appendChild(strip); }
    var row = C.el("div", "gs-slots");
    Q.seq.forEach(function () { var d = C.el("div", "gs-slot", ""); slots.push(d); row.appendChild(d); });
    card.appendChild(row);
    var grid = C.el("div", "gs-grid");
    Q.opts.forEach(function (L) {
      var b = letBtn(L, "cap");
      b.addEventListener("click", function () {
        if (over || b.classList.contains("used")) return;
        clear(); sayAll.tok = null; audioStop(); C.listenStopVoice();
        if (L === Q.seq[k]) {
          slots[k].textContent = L; slots[k].className = "gs-slot full"; b.classList.add("used"); k++;
          if (k >= Q.seq.length) {
            over = true; R.answers.push(Q.t + (err ? "!" : ""));
            if (!err) { R.good++; if (C.data.sfx) C.sfxGood(); }
            say("L:" + L, D.LETTER_SAY[L]); later(question, 1300);
          } else say("L:" + L, D.LETTER_SAY[L]);
        } else {
          err = true; b.classList.add("bad"); if (C.data.sfx) C.sfxBad(); say("c:pas", "Ce n’est pas celle-là.");
          later(function () { b.classList.remove("bad"); }, 900);
        }
      });
      grid.appendChild(b);
    });
    card.appendChild(grid);
    body.appendChild(card);
    later(function () { sayLetter(Q); }, 300);
  }
  function end() {
    var C = ctx(), sid = R.sid, G = mine(sid), comp = R.comp, list = stepList(sid, comp), c = cfg(), now = Date.now(), body = C.$("gs-body");
    var res = R.free ? { ok: R.good * 100 >= c[comp].seuil * R.qs.length, validated: false } : D.record(G.lecture[comp], list, c, comp, R.good, R.qs.length, R.aid, now);
    G.series.push({ id: R.id, c: comp, k: R.step.key, q: R.qs.length, g: R.good, th: c[comp].seuil, aid: R.aid, ts: now, ok: res.ok, a: R.answers.join(" ") });
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
    card.appendChild(C.el("p", "instruction", (R.K.act === "ordre" ? "Tu as bien rangé " + R.good + " fois sur " : "Tu as trouvé " + R.good + " lettres sur ") + R.qs.length + "."));
    if (!R.free && !R.aid) {
      var need = c[comp].series, have = res.validated ? need : G.lecture[comp].ok, stars = C.el("div", "gs-stars"); stars.setAttribute("role", "img"); stars.setAttribute("aria-label", have + " étoiles sur " + need);
      for (var k = 0; k < need; k++) stars.appendChild(C.el("span", k < have ? "on" : "", "★"));
      card.appendChild(stars);
    }
    var voice = res.validated ? ["c:valide", "Bravo ! Tu as gagné toutes les étoiles."] : res.ok ? ["c:bravo", "Bravo !"] : (G.lecture[comp].aid ? ["c:aideok", "Ce n’est pas grave. Je vais t’aider."] : ["c:presque", "Presque ! On recommence ?"]);
    if (res.validated && C.confetti) C.confetti(60, false);
    var row = C.el("div", "row"), main;
    if (wheel) { main = C.el("button", "primary big-btn go-next wheel-go", "🎡 Lance ta roue !"); main.addEventListener("click", function () { C.openWheel(sid, res.validated ? "Bravo, tu connais ces lettres !" : "Bravo, série réussie !"); }); }
    else if (res.ok) { main = C.el("button", "primary big-btn go-next", "Continuer ➜"); main.addEventListener("click", function () { start(sid); }); }
    else { main = C.el("button", "primary big-btn go-next", "🔁 Je réessaie"); main.addEventListener("click", function () { start(sid); }); }
    main.type = "button"; row.appendChild(main); card.appendChild(row);
    var small = C.el("div", "gs-small"), hb = C.el("button", "secondary", "🏠 Accueil"); hb.type = "button";
    hb.addEventListener("click", function () { C.goTo("home"); }); small.appendChild(hb); card.appendChild(small);
    body.appendChild(card);
    say(voice[0], voice[1]);
    R = null;
  }
  function stop() { clear(); sayAll.tok = null; audioStop(); R = null; if (X) { X.listenStopVoice(); X.listenFocus(false); } }
  window.ZooGS = { clean: clean, track: track, home: home, start: start, preview: preview, rituel: rituel, render: render, stop: stop, _run: function () { return R; }, _audio: A };
})();
