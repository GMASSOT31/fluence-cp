/* Visite guidée de la démo : une bulle « Étape 3 sur 13 » met en lumière un élément de la page.
   Côté élève (zoo-connecte.html) puis côté enseignant (enseignants.html). L'étape en cours est gardée
   dans sessionStorage pour passer d'une page à l'autre. Chargé seulement en démo, par demo.js. */
(function () {
  "use strict";
  var KEY = "zoo_demo_tour";
  var onTeacher = /enseignants\.html$/.test(location.pathname);
  var T = { on: false, step: 0 };
  try { T = JSON.parse(sessionStorage.getItem(KEY) || "null") || T; } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(T)); } catch (e) {} }
  function $(s) { return document.querySelector(s); }
  function visible(e) { return !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); }
  function wait(test, ms) {
    return new Promise(function (ok) {
      var t0 = Date.now();
      (function loop() { var r = test(); if (r || Date.now() - t0 > (ms || 4000)) ok(r); else setTimeout(loop, 120); })();
    });
  }
  function sleep(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function app() { return window.zooDemoApp; }
  function go(v) { if (app()) app().goTo(v); }
  function click(sel) { var e = typeof sel === "string" ? $(sel) : sel; if (e) e.click(); return e; }
  function tab(name) { click('[data-tab="' + name + '"]'); }

  /* Étapes communes aux deux parcours */
  async function openReading() {
    go("lecture");
    await wait(function () { return visible($(".lire-eval")); });
    click(".lire-eval");
    var card = await wait(function () { var c = document.querySelectorAll("#lire-menu .zoo-card"); return c.length ? c[0] : null; });
    if (card) card.click();
    var open = await wait(function () { var b = $("#btn-open"); return visible(b) ? b : null; });
    if (open) open.click();
    var start = await wait(function () { var b = $("#btn-start"); return visible(b) ? b : null; });
    if (start && app() && app().phase() !== "running") start.click();
  }
  var WELCOME = { page: "zoo", center: true, welcome: true, title: "Bienvenue dans la démo 👋",
    text: "Vous êtes Léo, élève de CP dans la classe « CP des Tigres ». Rien n'est enregistré." };
  var THE_END = { page: "teacher", center: true, title: "C'est tout ! 🎉",
    text: "Créez votre compte gratuit pour votre classe : 3 élèves pour commencer, davantage sur simple demande.",
    primary: "Créer mon compte", secondary: "Continuer à explorer", third: "Recommencer la démo",
    run: function () { T.on = false; save(); if (window.zooDemo) window.zooDemo.exit("enseignants.html#inscription"); return new Promise(function () {}); } };
  if (window.zooDemo && window.zooDemo.member) {   /* compte déjà créé : retour à son espace */
    THE_END.text = "Tu as fait le tour du Zoo ! Retourne dans ton espace pour continuer à préparer ta classe.";
    THE_END.primary = "Retour à mon espace";
    THE_END.run = function () { T.on = false; save(); if (window.zooDemo) window.zooDemo.exit("enseignants.html"); return new Promise(function () {}); };
  }
  function toTeacher() { T.step++; save(); location.href = "enseignants.html?demo=1"; return new Promise(function () {}); }

  /* « Découvrir l'essentiel en 2 minutes » : 5 étapes */
  var SHORT = [
    WELCOME,
    { page: "zoo", stage: 1, enter: function () { go("home"); }, target: ".home-hero", title: "La prochaine activité",
      text: "Chaque jour, l'élève voit une seule action à faire, avec 🔊 pour entendre la consigne.",
      primary: "Lire", run: openReading },
    { page: "zoo", stage: 2, target: "#session", title: "Une lecture d'une minute",
      text: "L'élève lit à voix haute ; vous touchez les mots où il bute. Le score : les mots lus correctement par minute.",
      primary: "Montre-moi",
      run: async function () {
        if (app()) app().fakeRead();
        await wait(function () { return visible($("#result")); });
        await sleep(900);
        click("#btn-save");
        await wait(function () { return $(".evo-acts:not([hidden])"); }, 6000);
      } },
    { page: "zoo", stage: 3, target: ".evo-card", glass: true, title: "L'animal et la récompense",
      text: "Étape certifiée 🏅 : l'animal du son évolue, puis la roue offre des pièces ou des parties de jeu.",
      primary: "Lancer la roue",
      run: async function () {
        click(".evo-acts button");
        var b = await wait(function () { var x = $("#btn-spin"); return visible(x) && !x.disabled ? x : null; });
        if (b) b.click();
        await wait(function () { return visible($("#btn-wheel-done")); }, 10000);
        await sleep(1200);
      } },
    { page: "zoo", stage: 3, target: "#v-roue .wheel-card", title: "Pièces et parties de jeu",
      text: "Les pièces s'échangent à la boutique contre vos récompenses ; les parties se jouent dans la salle d'arcade, après la lecture.",
      primary: "Voir l'espace enseignant", run: toTeacher },
    { page: "teacher", stage: 4, enter: function () { tab("progression"); }, target: function () {
        return Array.prototype.filter.call(document.querySelectorAll(".progress-row"), function (r) { return /Léo/.test(r.textContent); })[0] || $(".progress-row");
      }, title: "Le suivi enseignant",
      text: "Un suivi détaillé de chaque élève, avec le détail de ses scores de fluence et de son activité d'entraînement et de jeux." },
    { page: "teacher", stage: 5, enter: function () { tab("eleves"); click('[data-sub-btn="classes"]'); }, target: "#classesSettings", title: "Créer votre classe",
      text: "Créez votre classe, ajoutez vos élèves (code secret de départ : 1234) et imprimez leurs fiches de connexion. Tout est prêt !" },
    THE_END
  ];

  /* Visite complète */
  var STEPS = [
    WELCOME,
    { page: "zoo", enter: function () { go("home"); }, target: ".home-hero", title: "Une seule chose à faire",
      text: "Chaque jour, l'élève voit sa prochaine action. Le bouton 🔊 lit la consigne à voix haute, pour ceux qui ne lisent pas encore." },
    { page: "zoo", enter: function () { go("lecture"); }, target: ".lire-choice", title: "Lire : s'entraîner ou faire valider",
      text: "Seul, l'élève s'entraîne autant qu'il veut. Avec vous, il fait valider (certifier 🏅) un son. Essayons « Valider un son ».",
      primary: "Valider un son",
      run: async function () {
        click(".lire-eval");
        var card = await wait(function () { var c = document.querySelectorAll("#lire-menu .zoo-card"); return c.length ? c[0] : null; });
        if (card) card.click();
        var open = await wait(function () { var b = $("#btn-open"); return visible(b) ? b : null; });
        if (open) open.click();
        await wait(function () { return visible($("#btn-start")); });
      } },
    { page: "zoo", enter: function () { var b = $("#btn-start"); if (visible(b) && app() && app().phase() !== "running") b.click(); }, target: "#session", title: "La lecture d'une minute",
      text: "L'élève lit à voix haute pendant 1 minute. Vous touchez les mots où il bute. Le score : les mots lus correctement par minute.",
      primary: "Montre-moi",
      run: async function () { if (app()) app().fakeRead(); await wait(function () { return visible($("#result")); }); } },
    { page: "zoo", target: "#result", title: "Le résultat",
      text: "Objectif atteint : l'étape est certifiée 🏅. Les objectifs (syllabes, mots, texte) se règlent dans votre espace.",
      primary: "Enregistrer",
      run: async function () { click("#btn-save"); await wait(function () { return $(".evo-acts:not([hidden])"); }, 6000); } },
    { page: "zoo", target: ".evo-card", glass: true, title: "L'animal évolue",
      text: "Chaque son est un animal : l'œuf éclot, puis l'animal grandit à chaque étape certifiée. Les élèves ont envie de retrouver leur zoo.",
      primary: "Lancer la roue",
      run: async function () { click(".evo-acts button"); await wait(function () { return visible($("#btn-spin")); }); } },
    { page: "zoo", target: "#v-roue .wheel-card", title: "La roue des récompenses",
      text: "Elle offre des pièces d'or ou des parties de jeu. À la boutique, les pièces s'échangent contre les récompenses que vous choisissez.",
      primary: "Faire tourner",
      run: async function () { var b = $("#btn-spin"); if (visible(b) && !b.disabled) b.click(); await wait(function () { return visible($("#btn-wheel-done")); }, 10000); await sleep(1200); } },
    { page: "zoo", enter: function () { go("jeux"); }, target: ".cabs", title: "La salle d'arcade",
      text: "8 jeux favorisant le renforcement positif de l'élève, avec des records personnels et collectifs de classe. C'est l'émulation ! Mais seulement après le travail de lecture !" },
    { page: "zoo", enter: function () { go("audition"); }, target: "#audition-body .zoo-card", title: "J'écoute",
      text: "Le deuxième exercice : l'élève entend le son, la syllabe ou le mot, et doit retrouver son écriture. Essayez-le !",
      primary: "Essayer l'écoute",
      run: async function () {
        var card = $("#audition-body .zoo-card"); if (card) card.click();
        await wait(function () { return visible($(".listen-choice")); }, 5000);
      } },
    { page: "zoo", target: "#audition-body .listen-choices", dock: "top", title: "Écoutez, puis touchez",
      text: "Le Zoo dit un son (🔊 pour réécouter) : touchez la bonne réponse. Chaque son réussi fait éclore une carte et donne un tour de roue.",
      primary: "Suivant",
      run: async function () {
        var stopB = Array.prototype.filter.call(document.querySelectorAll("#audition-body button"), function (b) { return /Arrêter/.test(b.textContent); })[0];
        if (stopB) stopB.click();
        document.body.classList.remove("listen-focus");
        await sleep(300);
      } },
    { page: "zoo", enter: function () { go("home"); }, center: true, title: "À vous, côté enseignant",
      text: "Voyons maintenant votre espace : la progression de Léo, que vous venez de certifier, y est déjà.",
      primary: "Ouvrir l'espace enseignant",
      run: function () { T.step++; save(); location.href = "enseignants.html?demo=1"; return new Promise(function () {}); } },
    { page: "teacher", enter: function () { tab("progression"); }, target: function () {
        return Array.prototype.filter.call(document.querySelectorAll(".progress-row"), function (r) { return /Léo/.test(r.textContent); })[0] || $(".progress-row") || $("#progressList");
      }, title: "Le suivi de la classe",
      text: "Un suivi détaillé de chaque élève, avec le détail de ses scores de fluence et de son activité d'entraînement et de jeux." },
    { page: "teacher", enter: function () { tab("eleves"); click('[data-sub-btn="ajout"]'); }, target: "#studentForm", title: "Ajouter vos élèves",
      text: "Un pseudo suffit : le code secret de départ est 1234. « Et maintenant ? » imprime les fiches de connexion à découper (PDF)." },
    { page: "teacher", enter: function () { tab("reglages"); }, target: '.sub-picker[data-section="reglages"]', title: "Vos réglages",
      text: "Vos réglages pédagogiques : vos progressions personnelles, faciles à paramétrer, les exercices à personnaliser à l'envie, ainsi que l'ordre des sons étudiés (par défaut, la progression de la méthode PIANO CP)." },
    THE_END
  ];
  function list() { return T.mode === "short" ? SHORT : STEPS; }
  function lastIndex() { return list().length - 1; }
  function firstTeacher() { return list().map(function (x) { return x.page; }).indexOf("teacher"); }

  /* ---------- Affichage ---------- */
  var css = document.createElement("style");
  css.textContent =
    "#tour-dim{position:fixed;inset:0;z-index:60;background:rgba(10,8,25,.55)}" +
    "#tour-spot{position:fixed;z-index:60;border-radius:16px;box-shadow:0 0 0 4px #ffe37c,0 0 0 9999px rgba(10,8,25,.5);pointer-events:none;transition:all .3s ease}" +
    "#tour-bubble{position:fixed;z-index:61;width:min(380px,calc(100vw - 24px));background:#fff;color:#1b2433;border-radius:18px;padding:16px 18px;" +
    "box-shadow:0 14px 40px rgba(0,0,0,.35);font:15px/1.45 Figtree,system-ui,sans-serif;transition:top .3s ease,left .3s ease}" +
    "#tour-bubble.tb-glass{background:rgba(255,255,255,.62);box-shadow:0 10px 30px rgba(0,0,0,.25)}#tour-bubble.tb-glass:hover{background:rgba(255,255,255,.95)}" +
    "#tour-bubble .tb-step{font-size:12px;font-weight:800;color:#7960d4;text-transform:uppercase;letter-spacing:.04em}" +
    "#tour-bubble h3{margin:4px 0 6px;font-size:18px;color:#1b2433}#tour-bubble p{margin:0 0 12px}" +
    "#tour-bubble .tb-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center}" +
    "#tour-bubble button{font:inherit;font-weight:800;border-radius:999px;padding:8px 14px;cursor:pointer;min-height:0;box-shadow:none}" +
    "#tour-bubble .tb-main{background:#6d5dfc;color:#fff;border:0}#tour-bubble .tb-main:disabled{opacity:.6;cursor:wait}" +
    "#tour-bubble .tb-alt{background:#f1effa;color:#3a3360;border:0}#tour-bubble .tb-skip{background:none;border:0;color:#7a7f8f;font-weight:600;text-decoration:underline;margin-right:auto;padding:8px 4px}" +
    "@media(max-width:600px){#tour-bubble{left:12px!important;right:12px;top:auto!important;bottom:12px;width:auto}#tour-bubble.tb-top{top:12px!important;bottom:auto}}";
  document.head.appendChild(css);
  var dim = document.createElement("div"); dim.id = "tour-dim";
  var spot = document.createElement("div"); spot.id = "tour-spot";
  var bubble = document.createElement("div"); bubble.id = "tour-bubble"; bubble.setAttribute("role", "dialog"); bubble.setAttribute("aria-live", "polite");
  var current = null, busy = false;

  function targetOf(s) {
    if (!s.target) return null;
    if (typeof s.target === "function") return s.target();
    var list = s.target.split(",");
    for (var i = 0; i < list.length; i++) { var e = $(list[i].trim()); if (visible(e)) return e; }
    return null;
  }
  var running = false;
  /* Téléphone : un espace en bas de page permet de faire remonter l'élément éclairé au-dessus de la bulle */
  var room = document.createElement("div"); room.id = "tour-room"; room.style.cssText = "pointer-events:none;width:1px";
  function fitSpace(h) { room.style.height = h + "px"; if (!room.parentNode) document.body.appendChild(room); }
  function hide() { if (room.parentNode) room.parentNode.removeChild(room); [dim, spot, bubble].forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); }); current = null; }
  function place() {
    if (!current || running) return;
    var s = list()[T.step], t = s.center ? null : targetOf(s);
    if (!t) {
      if (spot.parentNode) spot.parentNode.removeChild(spot);
      if (!dim.parentNode) document.body.appendChild(dim);
      bubble.classList.remove("tb-top");
      if (window.innerWidth > 600) { bubble.style.left = Math.max(12, (window.innerWidth - bubble.offsetWidth) / 2) + "px"; bubble.style.top = Math.max(12, (window.innerHeight - bubble.offsetHeight) / 2) + "px"; }
      return;
    }
    if (dim.parentNode) dim.parentNode.removeChild(dim);
    if (!spot.parentNode) document.body.appendChild(spot);
    var r = t.getBoundingClientRect(), pad = 8;
    if (r.top < 0 || r.bottom > window.innerHeight) { if (!t.__tourScrolled) { t.__tourScrolled = true; t.scrollIntoView({ block: "center", behavior: "smooth" }); } }
    spot.style.left = (r.left - pad) + "px"; spot.style.top = (r.top - pad) + "px";
    spot.style.width = (r.width + pad * 2) + "px"; spot.style.height = (r.height + pad * 2) + "px";
    if (window.innerWidth <= 600) {
      /* Téléphone : bulle en bas ; si elle recouvrirait l'élément éclairé, on la monte en haut (quand la place y est) */
      var pb = bubble.offsetHeight + 24;
      var hits = r.bottom + pad > window.innerHeight - pb, up = hits && r.top - pad > pb;
      bubble.classList.toggle("tb-top", up);
      /* Élément trop grand pour tenir au-dessus ou en dessous : on le remonte en haut de l'écran, au-dessus de la bulle */
      if (hits && !up && r.height + pad * 2 <= window.innerHeight - pb - 8 && !t.__tourFit) { t.__tourFit = true; fitSpace(pb); window.scrollBy(0, r.top - pad - 8); }
      return;
    }
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight, gap = 16;
    bubble.style.width = s.dock === "top" ? "min(640px, calc(100vw - 24px))" : "";
    bw = bubble.offsetWidth; bh = bubble.offsetHeight;
    if (s.dock === "top") { bubble.style.left = Math.max(12, (window.innerWidth - bw) / 2) + "px"; bubble.style.top = "12px"; return; }
    var top = r.bottom + gap + bh < window.innerHeight ? r.bottom + gap : (r.top - gap - bh > 0 ? r.top - gap - bh : window.innerHeight - bh - 12);
    var left = Math.min(window.innerWidth - bw - 12, Math.max(12, r.left + r.width / 2 - bw / 2));
    bubble.style.left = left + "px"; bubble.style.top = Math.max(12, top) + "px";
  }
  function button(cls, label, fn) { var b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; b.addEventListener("click", fn); return b; }
  function stop() { T.on = false; save(); hide(); }
  async function show() {
    if (!T.on) { hide(); return; }
    var L = list(), s = L[T.step], LAST = lastIndex(), FIRST_TEACHER = firstTeacher();
    if (!s) { stop(); return; }
    var page = onTeacher ? "teacher" : "zoo";
    if (s.page !== page) {
      /* Arrivée côté enseignant en cours de visite : on reprend à la première étape enseignant ; et inversement */
      if (onTeacher && T.step < FIRST_TEACHER) T.step = FIRST_TEACHER;
      else if (!onTeacher && T.step >= FIRST_TEACHER) { hide(); return; }
      save(); s = L[T.step];
    }
    current = s; running = false;
    bubble.style.visibility = "";
    if (s.enter) { try { s.enter(); } catch (e) {} }
    if (s.target && !s.center) await wait(function () { return targetOf(s); }, 3000);
    bubble.innerHTML = "";
    bubble.classList.toggle("tb-glass", !!s.glass);
    var st = document.createElement("div"); st.className = "tb-step";
    st.textContent = T.step === 0 ? "Visite guidée" : (T.mode === "short" ? (s.stage ? "L'essentiel · étape " + s.stage + " sur 5" : "L'essentiel") : "Étape " + T.step + " sur " + LAST);
    var h = document.createElement("h3"); h.textContent = s.title;
    var p = document.createElement("p"); p.textContent = s.text;
    var acts = document.createElement("div"); acts.className = "tb-acts";
    if (T.step > 0 && T.step < LAST) acts.appendChild(button("tb-skip", "Quitter la visite", stop));
    if (s.welcome) {
      /* Bienvenue : choisir le parcours */
      acts.appendChild(button("tb-skip", "Explorer seul", stop));
      acts.appendChild(button("tb-alt", "Visite complète (14 étapes)", function () { T.mode = "full"; T.step = 1; save(); show(); }));
      var quick = button("tb-main", "L'essentiel en 2 minutes", function () { T.mode = "short"; T.step = 1; save(); show(); });
      acts.appendChild(quick);
      bubble.appendChild(st); bubble.appendChild(h); bubble.appendChild(p); bubble.appendChild(acts);
      if (!bubble.parentNode) document.body.appendChild(bubble);
      place(); quick.focus({ preventScroll: true });
      return;
    }
    if (s.secondary) acts.appendChild(button("tb-alt", s.secondary, stop));
    if (s.third) acts.appendChild(button("tb-alt", s.third, function () { T.on = true; T.step = 0; T.mode = null; save(); if (window.zooDemo) window.zooDemo.restart(); }));
    var main = button("tb-main", s.primary || "Suivant", async function () {
      if (busy) return; busy = true; main.disabled = true;
      /* Pendant l'action (lecture, éclosion, roue…), la bulle s'efface pour laisser voir l'animation */
      if (s.run) { running = true; bubble.style.visibility = "hidden"; [dim, spot].forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); }); }
      try { if (s.run) await s.run(); } catch (e) {}
      busy = false;
      if (T.step === list().indexOf(s)) { T.step++; save(); }
      if (T.step > lastIndex()) stop(); else show();
    });
    acts.appendChild(main);
    bubble.appendChild(st); bubble.appendChild(h); bubble.appendChild(p); bubble.appendChild(acts);
    if (!bubble.parentNode) document.body.appendChild(bubble);
    place();
    main.focus({ preventScroll: true });
  }
  setInterval(place, 300);
  window.addEventListener("resize", place);

  /* Bouton « Visite guidée » dans le bandeau de la démo */
  function addBarButton() {
    var bar = document.getElementById("demo-bar");
    if (!bar || document.getElementById("tour-restart")) return;
    var b = button("", "🧭 Visite guidée", function () { T.on = true; if (onTeacher) { T.mode = "full"; T.step = firstTeacher(); } else { T.mode = null; T.step = 0; } save(); show(); });
    b.id = "tour-restart";
    bar.insertBefore(b, bar.children[1] || null);
  }
  function start() {
    addBarButton();
    /* Côté élève, la visite attend que le Zoo de Léo soit chargé */
    if (!onTeacher) wait(function () { return !document.documentElement.classList.contains("booting") && visible($(".home-hero")); }, 8000).then(function () { setTimeout(show, 300); });
    else wait(function () { return visible($("#space")); }, 8000).then(function () { setTimeout(show, 300); });
  }
  window.zooTour = { start: function (step, mode) { T.on = true; T.step = step || 0; if (mode) T.mode = mode; save(); show(); }, stop: stop, state: function () { return T; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
