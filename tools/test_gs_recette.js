/* Recette du chantier GS (étape F) : critères d'acceptation T01–T18 du cahier des charges, joués dans un vrai navigateur sur les faux serveurs.
   Usage (depuis la racine) : python3 tools/build_test_pages.py && node tools/test_gs_recette.js
   Lance lui-même un petit serveur sur le port 8767 (tools/test-site), Chromium sans fenêtre (Playwright préinstallé).
   Chaque critère affiche OK / ÉCHEC ; ce qui ne se teste pas ici (vraie tablette, vraie base) est signalé « hors navigateur ».
   Les critères serveur (T10, T11, T15, T18 côté Calcul) sont aussi contrôlés sur une base locale jetable : sh tools/sql/run_gs_calcul_tests.sh. */
var path = require("path"), cp = require("child_process"), pw = require("playwright");
var ROOT = path.join(__dirname, ".."), PORT = 8767, BASE = "http://127.0.0.1:" + PORT + "/", results = [];
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function rec(id, ok, txt) { results.push([id, ok, txt]); console.log((ok === null ? "-- " : ok ? "OK " : "ÉCHEC ") + id + " · " + txt); }
async function page(b, url, opt) {
  opt = opt || {};
  var ctx = await b.newContext(Object.assign({ viewport: { width: 375, height: 667 }, reducedMotion: "reduce" }, opt.ctx || {}));
  var p = await ctx.newPage(); p.errs = [];
  p.on("pageerror", function (e) { p.errs.push(e.message); });
  await p.addInitScript(function (o) {
    window.speechSynthesis = undefined;   /* voix coupée : les tests n'attendent pas la fin des phrases */
    if (o.teacherCalc) { try { localStorage.setItem("zoo_matiere", "calcul"); localStorage.setItem("sb-test-auth-token", JSON.stringify({ access_token: "x" })); } catch (e) {} }
    if (o.noPointer) { try { delete window.PointerEvent; window.PointerEvent = undefined; } catch (e) {} }
  }, opt);
  await p.goto(BASE + url); await sleep(opt.wait || 900);
  return p;
}
function txt(p, sel) { return p.textContent(sel || "#view").then(function (t) { return String(t || "").replace(/\s+/g, " "); }); }
function clickText(p, sel, re) { return p.evaluate(function (a) { var b = [].slice.call(document.querySelectorAll(a[0])).filter(function (x) { return new RegExp(a[1]).test(x.textContent) && !x.disabled; })[0]; if (b) b.click(); return !!b; }, [sel, re]); }
/* une série GS du calcul : good = nombre de bonnes réponses (les premières) */
async function calcSerie(p, good) {
  if (await clickText(p, "button", "À moi de jouer")) await sleep(250);
  for (var i = 0; i < 30; i++) {
    var info = await p.evaluate(function () { var R = ZooGSCalc._run(); if (!R || R.rituel) return null; if (!document.querySelector(".gc-count")) return "wait"; return { act: R.act, Q: R.qs[R.n - 1], n: R.n }; });
    if (info === null) break; if (info === "wait") { await sleep(150); continue; }
    await p.evaluate(function (a) {
      var act = a[0], Q = a[1], ok = a[2], nums = [].slice.call(document.querySelectorAll(".gc-num"));
      if (act === "num" || act === "compte") (ok ? nums.filter(function (x) { return x.textContent == Q.t; }) : nums.filter(function (x) { return x.textContent != Q.t; }))[0].click();
      else if (act === "ordre") { if (!ok) nums.filter(function (x) { return x.textContent != Q.seq[0]; })[0].click(); Q.seq.forEach(function (v) { nums.filter(function (x) { return x.textContent == v; })[0].click(); }); }
      else if (act === "compare") document.querySelectorAll(".gc-pens .gc-pen")[ok ? Q.t : 1 - Q.t].click();
      else { var pen = document.querySelector(".gc-pen.build"); for (var k = 0; k < Q.t + (ok ? 0 : 1); k++) pen.click(); [].slice.call(document.querySelectorAll("button")).filter(function (x) { return /J’ai fini/.test(x.textContent); })[0].click(); }
    }, [info.act, info.Q, info.n <= good]);
    await sleep(1650);
  }
  await sleep(500);
}
/* une série GS de la lecture (lettres) */
async function lecSerie(p, good) {
  for (var i = 0; i < 30; i++) {
    var info = await p.evaluate(function () { var R = ZooGS._run(); if (!R || R.rituel) return null; if (!document.querySelector(".gs-let:not([disabled])")) return "wait"; var Q = R.qs[R.n - 1]; return { Q: Q, n: R.n, w: R.K.act === "assoc" ? (Q.dir ? R.K.a : R.K.b) : R.K.w }; });
    if (info === null) break; if (info === "wait") { await sleep(150); continue; }
    await p.evaluate(function (a) {
      var Q = a[0], ok = a[1], w = a[2], g = function (L) { return ZooGSData.glyph(L, w); }, bs = [].slice.call(document.querySelectorAll(".gs-grid .gs-let"));
      (ok ? bs.filter(function (b) { return b.textContent === g(Q.t); }) : bs.filter(function (b) { return b.textContent !== g(Q.t); }))[0].click();
    }, [info.Q, info.n <= good, info.w]);
    await sleep(ok15(info.n <= good));
  }
  await sleep(400);
}
function ok15(ok) { return ok ? 1050 : 1650; }

(async function () {
  var srv = cp.spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "tools", "test-site")], { stdio: "ignore" });
  await sleep(800);
  var b = await pw.chromium.launch(), p, t;
  try {
    /* T01 + T16 : un élève de CP (Lecture et Calcul) retrouve son accueil habituel */
    p = await page(b, "zoo-test.html");
    t = await txt(p, "body");
    rec("T01", /Ma mission/.test(t) && !/lettres/.test(await txt(p, "#home-body")), "élève CP en lecture : mission des sons, aucun écran GS");
    var q = await page(b, "labo-calcul-test.html");
    t = await txt(q);
    rec("T16", /Écouter/.test(t) && !(await q.evaluate(function () { return document.body.classList.contains("gs-track"); })) && !p.errs.length && !q.errs.length, "CP du Calcul : mission habituelle (Écouter), aucune erreur de page");
    /* T02 : GS en lecture et CP en calcul pour le même élève */
    p = await page(b, "zoo-test.html?gs=1");
    rec("T02", /comptine des lettres/i.test(await txt(p, "#home-body")) && /Écouter/.test(t), "lecture en GS (comptine des lettres) pendant que le calcul reste en CP");
    /* T05 : comptine à la 1re séance, puis petit bouton facultatif (lecture et calcul) */
    q = await page(b, "labo-calcul-test.html?gs=1");
    var first = /La comptine des nombres/.test(await txt(q, ".home-next"));
    await clickText(q, "button", "Plus tard"); await sleep(700);
    var after = await txt(q);
    rec("T05", first && /Je joue avec les nombres/.test(after) && /comptine des nombres/.test(after) && /comptine des lettres/i.test(await txt(p, "#home-body")), "1re séance : comptine en grosse action ; ensuite petit bouton facultatif");
    /* T06 + T17 : consignes orales (🔊) ; tablette tactile sans « pointer events » (anciens iPad) */
    var tab = await page(b, "labo-calcul-test.html?gs=1&gsrit=1", { ctx: { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }, noPointer: true });
    await tab.tap(".home-next"); await sleep(400);
    if (await tab.$("text=À moi de jouer")) { await tab.tap("text=À moi de jouer"); await sleep(300); }
    var hasSay = !!(await tab.$(".gc-say")), Q = await tab.evaluate(function () { var R = ZooGSCalc._run(); return R.qs[R.n - 1].t; });
    await tab.tap(".gc-num >> text=" + Q); await sleep(900);
    var n2 = await tab.evaluate(function () { var R = ZooGSCalc._run(); return R && R.n; });
    rec("T06", hasSay && (await tab.$$(".gc-num")).length >= 2, "consigne lue et réécoutable (🔊), réponses = gros chiffres à toucher, aucun texte à lire");
    rec("T17", n2 === 2 && !tab.errs.length, "tablette 1024 × 768 au doigt, sans Pointer Events : la réponse touchée fait passer à la question suivante");
    /* T07, T08, T09, T10 : Calcul (règle appliquée par le faux serveur = copie de lab__gs_round) */
    q = await page(b, "labo-calcul-test.html?gs=1&gsrit=1");
    await clickText(q, "button", "Je joue avec les nombres"); await sleep(400);
    await calcSerie(q, 10);
    var s1 = await q.evaluate(function () { return { st: __lab.me.gs["chiffres-r1-2"], w: __lab.me.gsw, view: document.getElementById("view").textContent }; });
    rec("T07", s1.st && !s1.st.val && s1.st.ok === 1, "une série réussie seule ne valide pas l’étape (1 étoile sur 2)");
    rec("T10a", s1.w === 1 && /Lance ta roue/.test(s1.view), "série réussie = une roue proposée");
    await q.evaluate(function () { ZooGSCalc.start(); }); await sleep(400);
    await calcSerie(q, 9);
    var s2 = await q.evaluate(function () { return { st: __lab.me.gs["chiffres-r1-2"], cur: ZooGSData.calcCurrent(ZooGSCalc._M.st, ZooGSData.calcPath(ZooGSCalc._M.cfg)) }; });
    rec("T08", !!(s2.st && s2.st.val) && s2.cur === 1, "deuxième série réussie d’affilée : étape validée, l’étape suivante s’ouvre");
    await q.evaluate(function () { ZooGSCalc.start(); }); await sleep(400); await calcSerie(q, 3);
    var wBefore = await q.evaluate(function () { return __lab.me.gsw; });
    await q.evaluate(function () { ZooGSCalc.start(); }); await sleep(400); await calcSerie(q, 3);
    var s3 = await q.evaluate(function () { return { st: __lab.me.gs["chiffres-r1-3"], w: __lab.me.gsw }; });
    await q.evaluate(function () { ZooGSCalc.start(); }); await sleep(500);
    var aid = await q.evaluate(function () { var R = ZooGSCalc._run(); return { aid: R.aid, demo: !!document.querySelector(".gc-card h2") && /aider/.test(document.querySelector(".gc-card h2").textContent) }; });
    rec("T09", s3.st && s3.st.aid && aid.aid && aid.demo, "deux séries ratées : aide automatique (exemple guidé, un choix de moins)");
    rec("T10b", s3.w === wBefore && wBefore === 2, "série ratée = pas de roue");
    await calcSerie(q, 10);
    var s4 = await q.evaluate(function () { return __lab.me.gs["chiffres-r1-3"]; });
    rec("T09b", !s4.aid && !s4.val && s4.ok === 0, "série aidée réussie : retour au niveau normal, jamais de validation");
    /* T11 + T18 : réponse perdue puis « Réessayer », arrêt en cours de série */
    q = await page(b, "labo-calcul-test.html?gs=1&gsrit=1&lost=1");
    await clickText(q, "button", "Je joue avec les nombres"); await sleep(400); await calcSerie(q, 10);
    var lost = await txt(q); await clickText(q, "button", "Réessayer"); await sleep(800);
    var l2 = await q.evaluate(function () { return { w: __lab.me.gsw, rounds: Object.keys(__lab.rounds).length, view: document.getElementById("view").textContent, wheels: ZooGSCalc._M && 1 }; });
    rec("T11", /pas encore rangé/.test(lost) && l2.w === 1 && l2.rounds === 1 && /Lance ta roue|Bravo/.test(l2.view), "réponse du serveur perdue puis « Réessayer » : la série n’est comptée qu’une fois, une seule roue");
    q = await page(b, "labo-calcul-test.html?gs=1&gsrit=1");
    await clickText(q, "button", "Je joue avec les nombres"); await sleep(400);
    if (await q.$("text=À moi de jouer")) { await clickText(q, "button", "À moi de jouer"); await sleep(300); }
    var Q1 = await q.evaluate(function () { var R = ZooGSCalc._run(); return R.qs[0].t; });
    await q.evaluate(function (v) { [].slice.call(document.querySelectorAll(".gc-num")).filter(function (x) { return x.textContent == v; })[0].click(); }, Q1); await sleep(1000);
    await clickText(q, "button", "Arrêter"); await sleep(200); await clickText(q, "button", "Oui, j’arrête"); await sleep(500);
    var stop = await q.evaluate(function () { return { calls: __lab.calls.filter(function (c) { return c === "lab_student_submit_round"; }).length, gs: __lab.me.gs, home: /Ma mission/.test(document.getElementById("view").textContent) }; });
    rec("T18", stop.calls === 0 && !Object.keys(stop.gs).length && stop.home, "arrêt en cours de série : rien n’est enregistré, les acquis restent, retour à la mission");
    /* T15 : aucun choix de parcours ni de récompense côté élève */
    var noTrack = !/Parcours|GS|CP/.test(await txt(q, "body")) && !/Parcours/.test(await txt(p, "body"));
    rec("T15", noTrack, "aucun écran élève ne propose de changer de parcours (le parcours vient des réglages de l’enseignant ; serveur : une roue par série, pièces et roues décidées par le serveur en Calcul)");
    /* Lecture GS : une série jouée de bout en bout (contrôle de non-régression de l'étape C) */
    p = await page(b, "zoo-test.html?gs=1");
    await clickText(p, "button", "Plus tard"); await sleep(500); await clickText(p, "button", "Je joue avec les lettres"); await sleep(600);
    if (await p.$("text=À moi de jouer")) { await clickText(p, "button", "À moi de jouer"); await sleep(300); }
    await lecSerie(p, 10);
    var lw = await p.evaluate(function () { var g = window.__srv.me.progress.gs, rw = g && g[Object.keys(g)[0]] && g[Object.keys(g)[0]].rw; return { view: document.getElementById("gs-body").textContent, w: (window.__srv.me.progress.wheels || []).filter(function (x) { return /^gs:/.test(x.id); }).length }; });
    rec("T10c", /Lance ta roue/.test(lw.view), "GS Lecture : série réussie = une roue");
    /* T03, T04, T12, T13, T14 : espace enseignant */
    var e = await page(b, "enseignants-test.html?teacher=1&pedago=1&gs=1", { ctx: { viewport: { width: 1200, height: 900 } }, wait: 2500 });
    var before = await e.evaluate(function () { return JSON.stringify(window.pedaTracks); });
    await e.evaluate(function () { var d = document.querySelector(".pb-bulk"); if (d) d.open = true; });
    var kids = await e.evaluate(function () { var ls = [].slice.call(document.querySelectorAll(".pb-bulk-kid")); ls.slice(0, 2).forEach(function (l) { var c = l.querySelector("input"); c.checked = true; c.dispatchEvent(new Event("change")); }); return ls.slice(0, 2).map(function (l) { return l.querySelector(".pb-kname").textContent; }); });
    await clickText(e, ".pb-bulk button", "Passer 2 élèves"); await sleep(200); await clickText(e, ".pb-bulk button", "Oui, appliquer"); await sleep(600);
    var afterT = await e.evaluate(function () { return window.pedaTracks; }), ids = await e.evaluate(function (names) { var C = window.ZooPedaCtx(); return C.allStudents.filter(function (s) { return names.indexOf(s.nickname) >= 0; }).map(function (s) { return s.id; }); }, kids);
    var others = Object.keys(JSON.parse(before)).filter(function (k) { return ids.indexOf(k) < 0; }).every(function (k) { return JSON.stringify(JSON.parse(before)[k]) === JSON.stringify(afterT[k]); });
    rec("T03", ids.length === 2 && ids.every(function (id) { return afterT[id] && afterT[id].lecture === "gs"; }) && others, "changement collectif : seuls les 2 élèves cochés passent en GS, les autres ne changent pas");
    /* T04 : CP → GS → CP depuis la fiche : seul le réglage change, la progression n'est jamais touchée */
    var r4 = await e.evaluate(function () {
      var C = window.ZooPedaCtx(), st = C.allStudents.filter(function (s) { return s.teacher_id === C.currentUser.id; })[0], prog = JSON.stringify(window.ZooPeda.state.rows ? (window.ZooPeda.state.rows.filter(function (r) { return r.s.id === st.id; })[0] || {}).p : null);
      var box = window.ZooPeda.trackBox({ s: { id: st.id, teacher_id: st.teacher_id, nickname: st.nickname } }, function () {}, ["lecture"]);
      var bt = function (l) { return [].slice.call(box.querySelectorAll("button")).filter(function (b) { return b.textContent === l; })[0]; };
      var was = (window.pedaTracks[st.id] || {}).lecture || "cp";
      bt("GS").click(); var mid = (window.pedaTracks[st.id] || {}).lecture;
      box = window.ZooPeda.trackBox({ s: { id: st.id, teacher_id: st.teacher_id, nickname: st.nickname } }, function () {}, ["lecture"]);
      [].slice.call(box.querySelectorAll("button")).filter(function (b) { return b.textContent === "CP"; })[0].click();
      var end = (window.pedaTracks[st.id] || {}).lecture || "cp", prog2 = JSON.stringify(window.ZooPeda.state.rows ? (window.ZooPeda.state.rows.filter(function (r) { return r.s.id === st.id; })[0] || {}).p : null);
      return { was: was, mid: mid, end: end, same: prog === prog2, ce1: box.querySelector("button[disabled]") && /CE1/.test(box.querySelector("button[disabled]").textContent) };
    });
    rec("T04", r4.mid === "gs" && r4.end === "cp" && r4.same, "CP → GS → CP : le parcours revient, les résultats de l’élève ne bougent pas (rien n’est effacé)");
    rec("T14", !!r4.ce1, "CE1 visible « à venir » et non activable");
    var r12 = await e.evaluate(function () {
      var D = window.ZooGSData, l = D.radar(D.config({ lecture: { curs: { on: false } } }), "Léo", D.lecState(null), [], 0.5).map(function (a) { return a.k; });
      var c = D.calcRadar(D.calcConfig({ calcul: { compare: { on: false } } }), {}, [], 0.5).map(function (a) { return a.k; });
      return l.indexOf("curs") < 0 && l.length === 5 && c.indexOf("compare") < 0 && c.length === 4;
    });
    rec("T12", r12, "toiles GS (lecture et calcul) : seulement les activités proposées par l’enseignant");
    /* T13 : réglages GS du calcul modifiés puis valeurs recommandées */
    var c = await page(b, "enseignants-test.html?role=teacher&teacher=1&pedago=1&gs=1", { ctx: { viewport: { width: 1200, height: 900 } }, teacherCalc: true, wait: 2500 });
    await c.evaluate(function () { document.querySelector('[data-tab="calc-reglages"]').click(); }); await sleep(800);
    await c.evaluate(function () { document.querySelector("#calcSettings details").open = true; [].slice.call(document.querySelectorAll("#calcSettings button")).filter(function (x) { return /parcours de GS/.test(x.textContent); })[0].click(); }); await sleep(300);
    await c.evaluate(function () { var i = document.querySelector('#calcSettings .gs-set input[aria-label="Séries d’affilée"]'); i.value = 3; i.dispatchEvent(new Event("change")); }); await sleep(1500);
    var mod = await c.evaluate(function () { return window.__auth.zooSettings.settings.gs.calcul.chiffres.series; });
    await clickText(c, "#calcSettings .gs-set button", "Valeurs recommandées"); await sleep(1500);
    var rst = await c.evaluate(function () { var g = window.__auth.zooSettings.settings.gs; return !g || !g.calcul; });
    rec("T13", mod === 3 && rst, "réglage enregistré tout seul (3 séries d’affilée), puis « Valeurs recommandées » le retire sans toucher aux résultats");
    var allErr = [p, q, e, c].reduce(function (a, x) { return a.concat(x.errs); }, []);
    rec("Pages", !allErr.length, allErr.length ? "erreurs : " + allErr.join(" | ") : "aucune erreur JavaScript dans les pages testées");
  } catch (err) { rec("Script", false, String(err && err.stack || err)); }
  await b.close(); srv.kill();
  var bad = results.filter(function (r) { return r[1] === false; });
  console.log(bad.length ? "\n" + bad.length + " CRITÈRE(S) EN ÉCHEC" : "\nRECETTE GS : TOUS LES CRITÈRES TESTÉS PASSENT (" + results.length + ")");
  process.exit(bad.length ? 1 : 0);
})();
