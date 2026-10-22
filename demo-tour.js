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

  var STEPS = [
    { page: "zoo", center: true, title: "Bienvenue dans la démo 👋",
      text: "Vous êtes Léo, élève de CP dans la classe « CP des Tigres ». En 3 minutes : son Zoo de Lecture, puis votre espace enseignant. Rien n'est enregistré.",
      primary: "C'est parti !", secondary: "Explorer seul" },
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
    { page: "zoo", target: ".evo-card", title: "L'animal évolue",
      text: "Chaque son est un animal : l'œuf éclot, puis l'animal grandit à chaque étape certifiée. Les élèves ont envie de retrouver leur zoo.",
      primary: "Lancer la roue",
      run: async function () { click(".evo-acts button"); await wait(function () { return visible($("#btn-spin")); }); } },
    { page: "zoo", target: "#v-roue .wheel-card", title: "La roue des récompenses",
      text: "Elle offre des pièces d'or ou des parties de jeu. À la boutique, les pièces s'échangent contre les récompenses que vous choisissez.",
      primary: "Faire tourner",
      run: async function () { var b = $("#btn-spin"); if (visible(b) && !b.disabled) b.click(); await wait(function () { return visible($("#btn-wheel-done")); }, 10000); await sleep(1200); } },
    { page: "zoo", enter: function () { go("jeux"); }, target: ".cabs", title: "La salle d'arcade",
      text: "8 jeux pour dépenser ses parties. 1 pièce si l'objectif est atteint, 3 pour un record personnel, 10 si on prend le record d'un camarade." },
    { page: "zoo", enter: function () { go("audition"); }, target: "#audition-body .zoo-card, #audition-body", title: "J'écoute",
      text: "L'élève entend un son et retrouve la bonne syllabe. Chaque son réussi fait éclore une carte « reconnue »… et donne un tour de roue." },
    { page: "zoo", enter: function () { go("home"); }, center: true, title: "À vous, côté enseignant",
      text: "Voyons maintenant votre espace : la progression de Léo, que vous venez de certifier, y est déjà.",
      primary: "Ouvrir l'espace enseignant",
      run: function () { T.step++; save(); location.href = "enseignants.html?demo=1"; return new Promise(function () {}); } },
    { page: "teacher", enter: function () { tab("progression"); }, target: function () {
        return Array.prototype.filter.call(document.querySelectorAll(".progress-row"), function (r) { return /Léo/.test(r.textContent); })[0] || $(".progress-row") || $("#progressList");
      }, title: "Le suivi de la classe",
      text: "Pour chaque élève : étapes certifiées 🏅, entraînements, dernière fluence, pièces. Léo vient d'être certifié." },
    { page: "teacher", enter: function () { tab("eleves"); click('[data-sub-btn="ajout"]'); }, target: "#studentForm", title: "Ajouter vos élèves",
      text: "Un pseudo suffit : le code secret de départ est 1234. « Et maintenant ? » imprime les fiches de connexion à découper (PDF)." },
    { page: "teacher", enter: function () { tab("reglages"); }, target: '.sub-picker[data-section="reglages"]', title: "Vos réglages",
      text: "Modifiez les exercices, l'ordre des sons et l'évaluation. Ils ne s'appliquent qu'à vos élèves." },
    { page: "teacher", center: true, title: "C'est tout ! 🎉",
      text: "Créez votre compte gratuit pour votre classe : 3 élèves pour commencer, davantage sur simple demande.",
      primary: "Créer mon compte", secondary: "Continuer à explorer", third: "Recommencer la démo",
      run: function () { T.on = false; save(); if (window.zooDemo) window.zooDemo.exit("enseignants.html"); return new Promise(function () {}); } }
  ];
  var LAST = STEPS.length - 1;

  /* ---------- Affichage ---------- */
  var css = document.createElement("style");
  css.textContent =
    "#tour-dim{position:fixed;inset:0;z-index:60;background:rgba(10,8,25,.55)}" +
    "#tour-spot{position:fixed;z-index:60;border-radius:16px;box-shadow:0 0 0 4px #ffe37c,0 0 0 9999px rgba(10,8,25,.5);pointer-events:none;transition:all .3s ease}" +
    "#tour-bubble{position:fixed;z-index:61;width:min(380px,calc(100vw - 24px));background:#fff;color:#1b2433;border-radius:18px;padding:16px 18px;" +
    "box-shadow:0 14px 40px rgba(0,0,0,.35);font:15px/1.45 Figtree,system-ui,sans-serif;transition:top .3s ease,left .3s ease}" +
    "#tour-bubble .tb-step{font-size:12px;font-weight:800;color:#7960d4;text-transform:uppercase;letter-spacing:.04em}" +
    "#tour-bubble h3{margin:4px 0 6px;font-size:18px;color:#1b2433}#tour-bubble p{margin:0 0 12px}" +
    "#tour-bubble .tb-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center}" +
    "#tour-bubble button{font:inherit;font-weight:800;border-radius:999px;padding:8px 14px;cursor:pointer;min-height:0;box-shadow:none}" +
    "#tour-bubble .tb-main{background:#6d5dfc;color:#fff;border:0}#tour-bubble .tb-main:disabled{opacity:.6;cursor:wait}" +
    "#tour-bubble .tb-alt{background:#f1effa;color:#3a3360;border:0}#tour-bubble .tb-skip{background:none;border:0;color:#7a7f8f;font-weight:600;text-decoration:underline;margin-right:auto;padding:8px 4px}" +
    "@media(max-width:600px){#tour-bubble{left:12px!important;right:12px;top:auto!important;bottom:12px;width:auto}}";
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
  function hide() { [dim, spot, bubble].forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); }); current = null; }
  function place() {
    if (!current) return;
    var s = STEPS[T.step], t = s.center ? null : targetOf(s);
    if (!t) {
      if (spot.parentNode) spot.parentNode.removeChild(spot);
      if (!dim.parentNode) document.body.appendChild(dim);
      if (window.innerWidth > 600) { bubble.style.left = Math.max(12, (window.innerWidth - bubble.offsetWidth) / 2) + "px"; bubble.style.top = Math.max(12, (window.innerHeight - bubble.offsetHeight) / 2) + "px"; }
      return;
    }
    if (dim.parentNode) dim.parentNode.removeChild(dim);
    if (!spot.parentNode) document.body.appendChild(spot);
    var r = t.getBoundingClientRect(), pad = 8;
    if (r.top < 0 || r.bottom > window.innerHeight) { if (!t.__tourScrolled) { t.__tourScrolled = true; t.scrollIntoView({ block: "center", behavior: "smooth" }); } }
    spot.style.left = (r.left - pad) + "px"; spot.style.top = (r.top - pad) + "px";
    spot.style.width = (r.width + pad * 2) + "px"; spot.style.height = (r.height + pad * 2) + "px";
    if (window.innerWidth <= 600) return;
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight, gap = 16;
    var top = r.bottom + gap + bh < window.innerHeight ? r.bottom + gap : (r.top - gap - bh > 0 ? r.top - gap - bh : window.innerHeight - bh - 12);
    var left = Math.min(window.innerWidth - bw - 12, Math.max(12, r.left + r.width / 2 - bw / 2));
    bubble.style.left = left + "px"; bubble.style.top = Math.max(12, top) + "px";
  }
  function button(cls, label, fn) { var b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; b.addEventListener("click", fn); return b; }
  function stop() { T.on = false; save(); hide(); }
  async function show() {
    if (!T.on) { hide(); return; }
    var s = STEPS[T.step];
    if (!s) { stop(); return; }
    var page = onTeacher ? "teacher" : "zoo";
    if (s.page !== page) {
      /* Arrivée côté enseignant en cours de visite : on reprend à la première étape enseignant ; et inversement */
      if (onTeacher && T.step < 10) T.step = 10;
      else if (!onTeacher && T.step >= 10) { hide(); return; }
      save(); s = STEPS[T.step];
    }
    current = s;
    if (s.enter) { try { s.enter(); } catch (e) {} }
    if (s.target && !s.center) await wait(function () { return targetOf(s); }, 3000);
    bubble.innerHTML = "";
    var st = document.createElement("div"); st.className = "tb-step"; st.textContent = T.step === 0 ? "Visite guidée" : "Étape " + T.step + " sur " + LAST;
    var h = document.createElement("h3"); h.textContent = s.title;
    var p = document.createElement("p"); p.textContent = s.text;
    var acts = document.createElement("div"); acts.className = "tb-acts";
    if (T.step > 0 && T.step < LAST) acts.appendChild(button("tb-skip", "Quitter la visite", stop));
    if (s.secondary) acts.appendChild(button("tb-alt", s.secondary, stop));
    if (s.third) acts.appendChild(button("tb-alt", s.third, function () { T.on = true; T.step = 0; save(); if (window.zooDemo) window.zooDemo.restart(); }));
    var main = button("tb-main", s.primary || "Suivant", async function () {
      if (busy) return; busy = true; main.disabled = true;
      try { if (s.run) await s.run(); } catch (e) {}
      busy = false;
      if (T.step === STEPS.indexOf(s)) { T.step++; save(); }
      if (T.step > LAST) stop(); else show();
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
    var b = button("", "🧭 Visite guidée", function () { T.on = true; T.step = onTeacher ? 10 : 0; save(); show(); });
    b.id = "tour-restart";
    bar.insertBefore(b, bar.children[1] || null);
  }
  function start() {
    addBarButton();
    /* Côté élève, la visite attend que le Zoo de Léo soit chargé */
    if (!onTeacher) wait(function () { return !document.documentElement.classList.contains("booting") && visible($(".home-hero")); }, 8000).then(function () { setTimeout(show, 300); });
    else wait(function () { return visible($("#space")); }, 8000).then(function () { setTimeout(show, 300); });
  }
  window.zooTour = { start: function (step) { T.on = true; T.step = step || 0; save(); show(); }, stop: stop, state: function () { return T; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
