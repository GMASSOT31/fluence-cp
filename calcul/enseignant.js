/* Zoo de Calcul — espace enseignant INTÉGRÉ à enseignants.html (laboratoire privé).
   Chargé à la demande par labo-switch.js, seulement pour un compte autorisé (lab_my_access). N'ajoute rien aux autres comptes.
   * Bascule « 📖 Lecture | ➕ Calcul » en haut du menu. En mode Calcul, les rubriques « Ma classe » et « Pédagogie » montrent le calcul
     (mêmes composants et mêmes classes que la lecture) ; les rubriques communes (classes, élèves, réglages généraux…) ne changent pas.
   * On n'a pas accès au code interne de la page : on réutilise ses boutons de menu (data-tab) et sa propre fonction d'affichage des panneaux
     (data-section), sans rien modifier de la lecture. Retour en « Lecture » = menu et panneaux exactement comme avant.
   * Données : fonctions lab_* (réservées aux comptes autorisés côté serveur), jamais d'accès direct aux tables. */
(function () {
  "use strict";
  if (window.CalcTeacher) return;
  var C = window.LABO_CALCUL || {}, E = window.CalcEngine, role = "teacher", mode = "lecture", settings = {}, saved = null, saveTimer = null;
  var ACT = { nombres: { icon: "👂", title: "Écouter" }, addition: { icon: "➕", title: "Addition" }, soustraction: { icon: "➖", title: "Soustraction" } };   /* mêmes mots que chez l’élève */
  var COLORS = ["#7960d4", "#3f7fd0", "#2e9b91", "#d48b2d", "#d0508f", "#5b8a2e"];
  var origTitle = null, orig = {};   /* textes et attributs d'origine, pour revenir exactement à la lecture */

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function pl(n, one, many) { return n > 1 ? many : one; }
  function token() {
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sb-[a-z0-9]+-auth-token$/.test(k)) { try { var t = (JSON.parse(localStorage.getItem(k)) || {}).access_token; if (t) return t; } catch (e) {} } }
    return null;
  }
  function rpc(name, args) {
    return fetch(C.url + "/rest/v1/rpc/" + name, { method: "POST", headers: { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + (token() || C.key) }, body: JSON.stringify(args || {}) })
      .then(function (r) { return r.text().then(function (txt) { var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {} if (!r.ok) throw new Error((j && j.message) || ("HTTP " + r.status)); return j; }); });
  }
  function enabled(act) { return E.missionLevels(act, settings.levels && settings.levels[act]); }

  /* ===== Style : accent vert du calcul (la lecture reste violette) ===== */
  function css() {
    var s = el("style"); s.id = "calc-teacher-css";
    s.textContent = "body.calc-mode #guide,body.calc-mode .share-teacher{display:none!important}#teachersAdminTab{position:relative}#calcReqBadge{position:absolute;top:-7px;right:-3px;margin:0;box-shadow:0 0 0 2px #fff}#calcAccess h3{margin:16px 0 8px}" +
      ".calc-switch{display:flex;margin:2px 0 12px;border:2px solid #0b7f7d;border-radius:999px;overflow:hidden}" +
      ".calc-switch button{flex:1;border:0;border-radius:0;background:#fff;color:#0b7f7d;font-weight:800;padding:9px 6px;font-size:.92rem;cursor:pointer;min-height:40px;box-shadow:none}" +
      ".calc-switch button.on{background:#0b7f7d;color:#fff}" +
      "body.calc-mode .teacher-nav button.active{background:#075f5d}" +
      /* fond vert d’eau : on voit tout de suite qu’on est dans l’espace Calcul (la lecture garde son fond gris-violet) */
      "body.calc-mode{background:#dff3ec}body.calc-mode .teacher-content>.panel{background:#f4fcf9;border-color:#9fdcc8}" +
      "body.calc-mode #calcProgress .pb-scope{border-color:#9fdcc8}body.calc-mode #calcProgress .pb-head{background:#e2f6f2;border-color:#9fdcc8}body.calc-mode #calcProgress .pb-lbl{color:#0b7f7d}body.calc-mode #calcProgress .pb-select{border-color:#7fd3bb}body.calc-mode #calcProgress .pb-count,body.calc-mode #calcProgress .pb-acts .secondary{border-color:#9fdcc8;color:#075f5d}body.calc-mode #calcProgress .pb-detail-btn{background:#0b7f7d;border-color:#0b7f7d;color:#fff}body.calc-mode #calcProgress .pb-filter.active{background:#075f5d;border-color:#075f5d;color:#fff}" +
      "body.calc-mode .calc-card{--accent:#0b7f7d;--soft:#e2f6f2}" +
      "body.calc-mode .calc-card .section-icon{background:#e2f6f2}" +
      "body.calc-mode header .zoo-hero{border-color:#7ff0c6;background:radial-gradient(circle at 83% 18%,rgba(255,196,69,.42),transparent 32%),radial-gradient(circle at 22% 120%,rgba(60,230,170,.42),transparent 45%),linear-gradient(125deg,#053b36 0%,#0a6a5c 57%,#06353a 100%);box-shadow:0 7px 0 #04302b,0 15px 30px rgba(5,60,50,.22)}" +
      "body.calc-mode header .zoo-hero .brand .sub{color:#c6fff0}body.calc-mode header .zoo-llama{background:linear-gradient(145deg,#c6fff0,#7fd9c3)}body.calc-mode header .zoo-owl{background:linear-gradient(145deg,#fff0a8,#ffb96a)}" +
      "body.calc-mode header .zoo-pad{background:#04302b;border-color:#7ff0c6;color:#c6fff0}" +
      "@media (prefers-reduced-motion:no-preference){body.calc-mode header .zoo-owl{animation:zoo-float 4.2s ease-in-out -2s infinite}}" +
      ".calc-card .pg-chip.mastered{background:#e2f6f2;border-color:#7ddfc0;color:#075f5d}" +
      ".calc-fields{display:grid;gap:14px;margin-top:10px}.calc-fields label{font-weight:700;display:block;margin-bottom:4px}.calc-fields input[type=number]{max-width:140px}" +
      ".calc-toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:60;padding:10px 20px;border-radius:999px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,.3);color:#fff;background:#0b7f7d}.calc-toast.err{background:#b42318}.calc-toast.pending{background:#5a6476}.calc-toast.hidden{display:none}" +
      ".calc-order{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px}.calc-step{display:flex;align-items:center;gap:8px}.calc-step label{flex:1;display:flex;gap:8px;align-items:center;font-weight:600;margin:0;min-height:40px}.calc-step .n{min-width:2.2em;font-weight:800;color:#0b7f7d}.calc-step input{width:20px;height:20px}.calc-step .mv{min-width:44px;min-height:40px;padding:0 10px;font-weight:800}.calc-step .mv:disabled{opacity:.35}" +
      ".calc-levels{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;margin-top:6px}.calc-levels label{display:flex;gap:8px;align-items:center;font-weight:600;margin:0;min-height:38px}" +
      ".calc-levels input{width:20px;height:20px}.calc-legend{margin-top:14px}.calc-legend dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:8px 0 0}.calc-legend dt{font-weight:800}.calc-legend dd{margin:0}" +
      "@media (max-width:600px){.calc-legend dl{grid-template-columns:1fr}.calc-legend dd{margin-bottom:6px}}";
    document.head.appendChild(s);
  }

  /* ===== Construction de la page ===== */
  var nav, bProg, bReg, bEcou, content;
  function build() {
    nav = $("nav.teacher-nav"); content = $(".teacher-content"); if (!nav || !content) return false;
    bProg = $('[data-tab="pedagogie"]', nav); bReg = $('[data-tab="reglages"]', nav); bEcou = $('[data-tab="ecouter"]', nav);
    if (!bProg || !bReg) return false;
    /* bascule */
    var sw = el("div", "calc-switch"), bl = el("button", "", "📖 Lecture"), bc = el("button", "", "➕ Calcul"); bl.type = bc.type = "button";
    sw.setAttribute("role", "group"); sw.setAttribute("aria-label", "Matière"); sw.appendChild(bl); sw.appendChild(bc); nav.parentNode.insertBefore(sw, nav);
    bl.addEventListener("click", function () { setMode("lecture"); }); bc.addEventListener("click", function () { setMode("calcul"); });
    window.CalcTeacher.sw = { l: bl, c: bc };
    /* panneaux (affichés par la fonction d'affichage de la page grâce à data-section) */
    var prog = el("section", "panel feature-card calc-card hidden"); prog.setAttribute("data-section", "calc-progression"); prog.id = "calcProgress";
    var reg = el("section", "panel feature-card calc-card hidden"); reg.setAttribute("data-section", "calc-reglages"); reg.id = "calcSettings";
    content.appendChild(prog); content.appendChild(reg);
    [bProg, bReg].forEach(function (b) { b.addEventListener("click", function () { if (mode === "calcul") render(b.dataset.tab); }); });
    var adminPanel = $("#adminPanel");
    if (role === "admin" && adminPanel) {
      var access = el("details", "admin-fold"), holder = el("div");
      holder.id = "calcAccess";
      access.appendChild(el("summary", "", "Accès au laboratoire Calcul"));
      access.appendChild(holder); adminPanel.appendChild(access);
      access.addEventListener("toggle", function () {
        if (access.open && !holder.firstChild) renderAccess();
      });
    }
    return true;
  }
  function head(icon, title, sub) {
    var h = el("div", "section-head"), i = el("div", "section-icon", icon), d = el("div"); d.appendChild(el("h2", "", title)); if (sub) d.appendChild(el("p", "muted", sub)); h.appendChild(i); h.appendChild(d); return h;
  }

  /* ===== Bascule Lecture / Calcul ===== */
  function setMode(m, quiet) {
    if (m === mode && !quiet) return;
    var active = $("nav.teacher-nav button.active"), cur = active ? active.dataset.tab : null, banner = $("header .zoo-hero");
    mode = m; try { localStorage.setItem("zoo_matiere", m); } catch (e) {}
    window.CalcTeacher.sw.l.classList.toggle("on", m === "lecture"); window.CalcTeacher.sw.c.classList.toggle("on", m === "calcul");
    document.body.classList.toggle("calc-mode", m === "calcul");
    swapTexts(m === "calcul");
    if (m === "calcul") {
      bProg.dataset.tab = "calc-progression"; bReg.dataset.tab = "calc-reglages"; if (bEcou) bEcou.classList.add("hidden");
      skin(true, banner);
      if (cur === "pedagogie" || cur === "ecouter") bProg.click(); else if (cur === "reglages") bReg.click();
    } else {
      bProg.dataset.tab = "pedagogie"; bReg.dataset.tab = "reglages"; if (bEcou) bEcou.classList.remove("hidden");
      skin(false, banner);
      if (cur === "calc-progression") bProg.click(); else if (cur === "calc-reglages") bReg.click();
    }
  }
  /* Textes propres à la matière : le guide de démarrage et le partage parlent de Zoo de Lecture (le calcul est un labo privé : on ne le partage pas) ; le pied de page ne parle pas de lectures au micro */
  function swapTexts(on) {
    var fn = $(".teacher-footnote");
    if (fn) { if (fn.getAttribute("data-lec") === null) fn.setAttribute("data-lec", fn.textContent); fn.textContent = on ? "☁️ Les progrès de vos élèves en calcul sont sauvegardés en ligne automatiquement : vous les retrouvez dans l’onglet « Progression »." : fn.getAttribute("data-lec"); }
    if (origTitle === null) origTitle = document.title;
    document.title = on ? "Espace enseignant · Zoo de Calcul (test)" : origTitle;
  }
  /* Bandeau du haut : « Zoo de Calcul » avec les animaux de la 1re, de la 2e moitié et de la dernière étape */
  function skin(on, banner) {
    if (!banner) return;
    var k = $(".zoo-kicker", banner), h = $(".brand h1 span", banner), t = $(".zoo-hero-tag", banner), m = [$(".zoo-bee", banner), $(".zoo-llama", banner), $(".zoo-owl", banner)];
    if (!orig.k) orig = { k: k && k.textContent, h: h && h.textContent, t: t && t.textContent, m: m.map(function (x) { return x && x.textContent; }) };
    var l = E.LEVELS.nombres, pick = [l[0], l[Math.floor((l.length - 1) / 2)], l[l.length - 1]];
    if (k) k.textContent = on ? "✦ LE GRAND JEU DU CALCUL ✦" : orig.k; if (h) h.textContent = on ? "Calcul" : orig.h; if (t) t.textContent = on ? "➕ Compte · 🏆 Progresse · 🎮 Joue !" : orig.t;
    m.forEach(function (x, i) { if (x) x.textContent = on ? pick[i].animal.e : orig.m[i]; });
  }

  function render(tab) {
    if (tab === "calc-progression") renderProgress(); else if (tab === "calc-reglages") renderSettings();
  }

  /* ===== Progression (même structure que la lecture : classes, élèves, pastilles, Détails) ===== */
  function dayText(ts) {
    if (!ts) return "aucune activité"; var d = Math.floor((Date.now() - ts) / 864e5);
    return d <= 0 ? "aujourd’hui" : d === 1 ? "hier" : d < 31 ? "il y a " + d + " jours" : new Date(ts).toLocaleDateString("fr-FR");
  }
  /* le serveur écrit l’heure « 2026-11-18T10:00:00+00 » : sans « :00 » à la fin, les navigateurs ne savent pas la lire (élèves vus « jamais venus ») */
  function tsOf(v) { var t = Date.parse(v); if (!t && typeof v === "string") t = Date.parse(v.replace(/([+-]\d\d)$/, "$1:00")); return t || 0; }
  function lastTs(p) { var h = Array.isArray(p.hist) && p.hist.length ? p.hist[p.hist.length - 1] : null; return h ? tsOf(h.t) : 0; }
  function nextStep(levels) {
    var route = E.mission(settings.levels, levels), best = route.next;
    if (!best) return route.blocked ? "Reconnaissance des nombres à compléter" : "toutes faites 🎉";
    var lv = E.levelInfo(best.act, best.id); return ACT[best.act].icon + " " + lv.label;
  }
  /* ===== Ma classe (calcul) : même écran que la lecture — choix de la classe, À faire aujourd’hui, Mes élèves (Tous / En difficulté / En avance / Pas venus), La classe en chiffres ===== */
  var LATE = 3, AHEAD = 3, IDLE_DAYS = 7, DAY = 864e5, view = { classId: null, filter: "all", open: {}, folded: {}, rows: [] };
  function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function totalSteps() { return Object.keys(ACT).reduce(function (n, a) { return n + enabled(a).length; }, 0); }
  /* Un élève : étapes réussies (dans les étapes proposées), étape où il bloque (3 séries ou plus sans réussite), séries des 7 derniers jours, dernière venue */
  function analyse(s) {
    var p = s.progress || {}, lv = p.levels || {}, done = 0, won = 0, stuck = null, week = { nombres: 0, addition: 0, soustraction: 0 }, now = Date.now();
    Object.keys(ACT).forEach(function (a) {
      enabled(a).forEach(function (id) { var e = lv[a + ":" + id] || {}; if (e.ok >= 1) done++; else if ((e.r || 0) >= 3 && !stuck) stuck = { act: a, id: id, r: e.r }; });
    });
    (Array.isArray(p.hist) ? p.hist : []).forEach(function (h) { var t = tsOf(h && h.t), a = String(h && h.k || "").split(":")[0]; if (t && now - t < 7 * DAY && week[a] != null) { week[a]++; if (h.ok === true) won++; } });
    var ts = lastTs(p), idle = ts ? Math.floor((now - ts) / DAY) : null;
    return { s: s, lv: lv, done: done, won: won, stuck: stuck, week: week, series: week.nombres + week.addition + week.soustraction, idle: idle, ts: ts,
             nums: Object.keys(p.nums || {}).length, calcs: Object.keys(p.calcs || {}).length };
  }
  function classify(rows) {
    var med = median(rows.map(function (r) { return r.done; }));
    rows.forEach(function (r) {
      r.inactive = r.idle === null || r.idle >= IDLE_DAYS; r.late = med - r.done >= LATE; r.ahead = r.done - med >= AHEAD;
      r.color = r.inactive ? "idle" : (r.late || r.stuck ? "red" : (r.ahead ? "green" : "yellow"));
    });
    return med;
  }
  function section(title, sub) { var x = el("section", "pb-sec"), h = el("h3", "pb-h", title); if (sub) h.appendChild(el("small", "", " · " + sub)); x.appendChild(h); return x; }
  /* Retour sur la page : « Ma classe » du calcul visible et chargée il y a plus d'une minute → on recharge (sinon : bouton « Actualiser ») */
  document.addEventListener("visibilitychange", function () {
    var box = $("#calcProgress");
    if (document.visibilityState !== "visible" || !box || !box.offsetParent || !view.loadedAt || Date.now() - view.loadedAt < 60000) return;
    renderProgress();
  });
  function renderProgress() {
    var box = $("#calcProgress"); clear(box);
    box.appendChild(head("🏫", "Ma classe · calcul", "Écouter les nombres, additions et soustractions : ce qui demande votre attention, puis chaque élève. Les résultats de lecture sont dans l’espace Lecture."));
    var msg = el("p", "msg", "Chargement…"); msg.id = "calcMsg"; msg.setAttribute("role", "status"); box.appendChild(msg);
    var board = el("div", "calc-board pb-scope"); box.appendChild(board);
    Promise.all([rpc("lab_teacher_settings_get").catch(function () { return {}; }), rpc("lab_teacher_results"), rpc("lab_teacher_assignments").catch(function () { return null; })]).then(function (r) {
      settings = r[0] || {}; view.assignments = r[2]; msg.textContent = ""; view.all = r[1] || []; view.loadedAt = new Date(); paintBoard(board);
    }).catch(function () { msg.className = "msg err"; msg.textContent = "Impossible de charger les résultats de calcul. Réessayez dans un instant."; });
  }
  function paintBoard(board) {
    clear(board);
    var all = view.all || [];
    if (!all.length) { board.appendChild(el("p", "muted", "Aucun élève pour l’instant : créez votre classe dans « Mes classes »." )); return; }
    var classes = [], seen = {}; all.forEach(function (x) { if (!seen[x.class_id]) { seen[x.class_id] = 1; classes.push({ id: x.class_id, name: x.class_name }); } });
    if (!seen[view.classId]) view.classId = classes[0].id;
    var studs = all.filter(function (x) { return x.class_id === view.classId; }), cls = classes.filter(function (c) { return c.id === view.classId; })[0];
    /* en-tête : classe (sélecteur s’il y en a plusieurs) + nombre d’élèves */
    var hd = el("div", "pb-head"), left = el("div", "pb-class");
    if (classes.length > 1) {
      var sel = el("select", "pb-select"); sel.setAttribute("aria-label", "Classe");
      classes.forEach(function (c) { var o = el("option", "", c.name); o.value = c.id; sel.appendChild(o); });
      sel.value = cls.id; sel.addEventListener("change", function () { view.classId = sel.value; view.open = {}; view.filter = "all"; paintBoard(board); });
      left.appendChild(el("span", "pb-lbl", "Classe")); left.appendChild(sel);
    } else { left.appendChild(el("span", "pb-lbl", "Classe")); left.appendChild(el("strong", "pb-cname", "📚 " + cls.name)); }
    var acts = el("div", "pb-acts"), rl = el("button", "secondary pb-refresh", "↻"); rl.type = "button"; rl.title = "Actualiser les résultats"; rl.setAttribute("aria-label", rl.title); rl.addEventListener("click", renderProgress); left.appendChild(rl);
    var pc = ctx().allClasses && ctx().printLoginCards ? ctx().allClasses.filter(function (x) { return x.id === cls.id; })[0] : null;
    if (pc) { var cm = el("button", "secondary", "🖨️ QR codes"); cm.type = "button"; cm.title = "Fiches de connexion au Zoo de Calcul (adresse zoodelecture.fr/calcul et QR code), à donner aux familles"; cm.addEventListener("click", function () { ctx().printLoginCards(pc, "calcMsg", cm, true); }); acts.appendChild(cm); }
    if (ficheOK()) { var fa = el("button", "secondary"); fa.appendChild(el("span", "pb-pdf-icon", "PDF")); fa.appendChild(document.createTextNode(" Araignées de suivi")); fa.type = "button"; fa.title = "Une fiche par élève, avec sa toile des 6 compétences"; fa.addEventListener("click", function () { makeFiches(view.rows.slice().sort(function (a, b) { return String(a.s.nickname).localeCompare(b.s.nickname); }), cls.name, fa, "fiches-calcul-" + (ctx().pdfSlug(cls.name) || "classe")); }); acts.appendChild(fa); }
    hd.appendChild(left);
    if (view.loadedAt) {
      var tm = el("span", "pb-updated", view.loadedAt.getHours() + " h " + ("0" + view.loadedAt.getMinutes()).slice(-2));
      tm.setAttribute("aria-label", "Heure de la dernière actualisation"); hd.appendChild(tm);
    }
    hd.appendChild(acts); board.appendChild(hd);
    var rows = studs.map(analyse); classify(rows); view.rows = rows;
    board.appendChild(figuresCalc(rows)); board.appendChild(todoCalc(rows)); board.appendChild(listCalc(rows));
    board.querySelector(".pb-students").appendChild(legend());
  }
  function nameBtns(list) {
    var w = el("span", "pb-names");
    list.forEach(function (r) { var b = el("button", "pb-name", r.s.nickname); b.type = "button"; b.title = "Voir les résultats de " + r.s.nickname; b.addEventListener("click", function () { openDetail(r.s.student_id); }); w.appendChild(b); });
    return w;
  }
  function openDetail(id) {
    view.open[id] = true; var r = view.rows.filter(function (x) { return x.s.student_id === id; })[0];
    if (r && !keepRow(r, view.filter)) view.filter = "all";
    if (view.paint) view.paint();
    var students = document.querySelector("#calcProgress .pb-students");
    if (students) students.open = true;
    var line = document.querySelector('#calcProgress .pb-row[data-sid="' + id + '"]'); if (window.ZooPeda) window.ZooPeda.scrollToStudent(line);
  }
  /* 1. À faire aujourd’hui : élèves bloqués (par étape), élèves en retard, élèves absents */
  function todoCalc(rows) {
    var sec = section("📌 À faire aujourd’hui"), grid = el("div", "pb-alerts"), n = 0, groups = {};
    function card(cls, title, list, tip) { var c = el("div", "pb-alert " + cls); c.appendChild(el("strong", "", title)); c.appendChild(nameBtns(list)); if (tip) c.appendChild(el("small", "pb-tip", tip)); if (!groups[cls]) groups[cls] = []; groups[cls].push(c); n++; }
    var by = {}; rows.filter(function (r) { return r.stuck && !r.inactive; }).forEach(function (r) { var k = r.stuck.act + ":" + r.stuck.id; (by[k] = by[k] || []).push(r); });
    Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; }).slice(0, 4).forEach(function (k) {
      var a = k.split(":"), lvi = E.levelInfo(a[0], a[1]);
      card("a-block", "🧱 Bloqués : " + ACT[a[0]].icon + " " + (lvi ? lvi.label : a[1]), by[k], "3 séries ou plus sans réussite. Montrez « 🧩 Je m’aide », ou proposez de rejouer l’étape d’avant.");
    });
    var late = rows.filter(function (r) { return r.late && !r.stuck && !r.inactive; });
    if (late.length) card("a-block", "🐢 " + late.length + " " + pl(late.length, "élève a", "élèves ont") + " " + LATE + " étapes de retard ou plus", late, "Par rapport à l’élève du milieu de la classe.");
    var idle = rows.filter(function (r) { return r.inactive; });
    if (idle.length) card("a-idle", "💤 " + idle.length + " " + pl(idle.length, "élève n’est pas venu", "élèves ne sont pas venus") + " depuis " + IDLE_DAYS + " jours ou plus", idle);
    var assigned = rows.filter(function (r) { var a = (view.assignments || {})[r.s.student_id]; return a && !a.done; });
    if (assigned.length) card("a-asg", assigned.length + " " + pl(assigned.length,"exercice donné","exercices donnés"), assigned);
    [["a-asg","🎯 Exercices donnés"],["a-block","⚠️ Élèves bloqués ou en retard"],["a-idle","💤 En sommeil"]].forEach(function (group) {
      if (!groups[group[0]]) return;
      var fold = window.ZooPeda.compactDetails(group[1], "pb-alert-group", view.classId + ":" + group[0], view.folded);
      groups[group[0]].forEach(function (c) { fold.appendChild(c); }); grid.appendChild(fold);
    });
    if (!n) grid.appendChild(el("p", "pb-calm", "✅ Rien d’urgent aujourd’hui."));
    sec.appendChild(grid); return sec;
  }
  /* 2. Mes élèves : filtres, une ligne par élève, « Détails » sous la ligne */
  var FILTERS = [["all", "Tous"], ["late", "En difficulté"], ["ahead", "En avance"], ["idle", "Pas venus"]];
  function keepRow(r, f) { return f === "all" || (f === "late" && r.color === "red") || (f === "ahead" && r.ahead && !r.inactive) || (f === "idle" && r.inactive); }
  function listCalc(rows) {
    var sec = window.ZooPeda.compactDetails("🧒 Les élèves · " + rows.length, "pb-sec pb-students", view.classId + ":students", view.folded), bar = el("div", "pb-filters"), list = el("div", "pb-list"), tot = totalSteps();
    bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Filtrer les élèves");
    function paint() {
      clear(list);
      var rank = { red: 0, yellow: 1, green: 2, idle: 3 }, shown = rows.filter(function (r) { return keepRow(r, view.filter); });
      shown.sort(function (a, b) { return rank[a.color] - rank[b.color] || a.done - b.done || String(a.s.nickname).localeCompare(b.s.nickname); });
      if (!shown.length) list.appendChild(el("p", "muted", "Aucun élève dans ce filtre."));
      shown.forEach(function (r) { list.appendChild(lineCalc(r, tot, paint)); if (view.open[r.s.student_id]) { var d = el("div", "pb-detail calc-detail"); d.appendChild(detailGrid(r.lv)); d.appendChild(chiffres(r)); if (ficheOK()) { var fi = el("button", "secondary pb-see", "📄 Fiche de suivi (PDF)"); fi.type = "button"; fi.style.marginTop = "10px"; fi.title = "Fiche de suivi de " + r.s.nickname + " à imprimer : toile des 6 compétences"; (function (r, fi) { fi.addEventListener("click", function () { var c = view.all.filter(function (x) { return x.class_id === view.classId; })[0]; makeFiches([r], c ? c.class_name : "", fi, "fiche-calcul-" + (ctx().pdfSlug(r.s.nickname) || "eleve")); }); })(r, fi); d.appendChild(fi); } list.appendChild(d); } });
      Array.prototype.forEach.call(bar.children, function (b) { var on = b.getAttribute("data-f") === view.filter; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
    }
    view.paint = paint;
    FILTERS.forEach(function (f) {
      var n = rows.filter(function (r) { return keepRow(r, f[0]); }).length, b = el("button", "pb-filter", f[1] + " (" + n + ")"); b.type = "button"; b.setAttribute("data-f", f[0]);
      b.addEventListener("click", function () { view.filter = f[0]; paint(); }); bar.appendChild(b);
    });
    sec.appendChild(bar);
    sec.appendChild(el("p", "muted pb-legend", "🔴 en difficulté (bloqué sur une étape, ou " + LATE + " étapes de retard sur l’élève du milieu de la classe) · 🟡 avance normalement · 🟢 en avance de " + AHEAD + " étapes ou plus · ⚪ pas venu depuis " + IDLE_DAYS + " jours"));
    sec.appendChild(list); paint(); return sec;
  }
  function whenTxt(r) { return r.idle === null ? "jamais venu" : r.idle <= 0 ? "aujourd’hui" : r.idle === 1 ? "hier" : "il y a " + r.idle + " jours"; }
  function assignmentEditor(r, current) {
    var box = el("form", "pb-assign"), title = el("h4", "", "🎯 Exercice pour " + r.s.nickname);
    var activities = el("select"), levels = el("select"), feedback = el("p", "msg");
    activities.setAttribute("aria-label", "Activité de calcul"); levels.setAttribute("aria-label", "Étape de calcul");
    feedback.setAttribute("role", "status");
    Object.keys(ACT).forEach(function (act) {
      var option = el("option", "", ACT[act].title); option.value = act; activities.appendChild(option);
    });
    if (current) activities.value = current.activity;
    function fill() {
      clear(levels);
      E.missionLevels(activities.value).forEach(function (id) {
        var option = el("option", "", E.levelInfo(activities.value, id).label);
        option.value = id; levels.appendChild(option);
      });
      if (current && current.activity === activities.value) levels.value = current.level;
    }
    fill(); activities.addEventListener("change", fill);
    var actions = el("div", "pb-as-acts"), give = el("button", "primary", current ? "Donner un nouvel exercice" : "Donner l’exercice");
    var cancel = el("button", "secondary", "Annuler"), remove = el("button", "secondary", "Retirer l’exercice");
    cancel.type = remove.type = "button"; give.type = "submit";
    function save(act, level) {
      give.disabled = remove.disabled = cancel.disabled = true;
      rpc("lab_teacher_assign", { p_student: r.s.student_id, p_activity: act, p_level: level }).then(renderProgress).catch(function () {
        feedback.textContent = "Impossible d’enregistrer. Réessayez.";
        give.disabled = remove.disabled = cancel.disabled = false;
      });
    }
    box.addEventListener("submit", function (event) { event.preventDefault(); save(activities.value, levels.value); });
    remove.addEventListener("click", function () { save(null, null); });
    cancel.addEventListener("click", function () { if (box.previousElementSibling) box.previousElementSibling.querySelector(".pb-asb").click(); });
    actions.appendChild(give); if (current) actions.appendChild(remove); actions.appendChild(cancel);
    box.appendChild(title); box.appendChild(el("p", "muted", "L’élève verra cette série en tête de sa mission jusqu’à sa réussite."));
    box.appendChild(activities); box.appendChild(levels); box.appendChild(actions); box.appendChild(feedback);
    return box;
  }
  function lineCalc(r, tot, repaint) {
    var d = el("div", "pb-row c-" + r.color); d.setAttribute("data-sid", r.s.student_id);
    var who = el("div", "pb-who"); who.appendChild(el("span", "pb-dot", { red: "🔴", yellow: "🟡", green: "🟢", idle: "⚪" }[r.color])); who.appendChild(el("strong", "", r.s.nickname));
    var time = el("div", "pb-time", r.series + " " + pl(r.series, "série", "séries")); time.title = "Séries faites ces 7 derniers jours";
    var prog = el("div", "pb-prog"), bar = el("div", "pb-bar"), fill = el("i"); fill.style.width = (tot ? Math.round(r.done * 100 / tot) : 0) + "%"; bar.appendChild(fill);
    bar.setAttribute("role", "img"); bar.setAttribute("aria-label", r.done + " étapes réussies sur " + tot);
    var txt = r.idle === null ? "Pas encore commencé" : r.stuck ? "bloqué : " + ACT[r.stuck.act].icon + " " + (E.levelInfo(r.stuck.act, r.stuck.id) || {}).label + " (" + r.stuck.r + " séries sans réussite)" : "prochaine étape : " + nextStep(r.lv);
    prog.appendChild(bar); prog.appendChild(el("small", "", r.done + " " + pl(r.done, "étape réussie", "étapes réussies") + " sur " + tot + " · " + txt));
    var tags = el("div", "pb-tags"); tags.appendChild(el("span", "pb-tag" + (r.inactive ? " warn" : ""), "🕒 " + whenTxt(r)));
    if (r.series) tags.appendChild(el("span", "pb-tag", "👂 " + r.week.nombres + " · ➕ " + r.week.addition + " · ➖ " + r.week.soustraction));
    prog.appendChild(tags);
    var nums = el("div", "pb-flu", "🔢 " + r.nums); nums.title = r.nums + " " + pl(r.nums, "nombre reconnu", "nombres reconnus") + " du premier coup";
    var open = !!view.open[r.s.student_id], btn = el("button", "pb-see pb-detail-btn" + (open ? " on" : ""), open ? "▲ Masquer" : "▼ Détails"); btn.type = "button"; btn.setAttribute("aria-expanded", String(open));
    btn.addEventListener("click", function () {
      /* la liste est redessinée : on garde la ligne de l’élève au même endroit de l’écran (avant : la page remontait) */
      var sid = r.s.student_id, top = d.getBoundingClientRect().top;
      if (view.open[sid]) delete view.open[sid]; else view.open[sid] = true; repaint();
      var nl = document.querySelector('#calcProgress .pb-row[data-sid="' + sid + '"]');
      if (nl) { window.scrollBy(0, nl.getBoundingClientRect().top - top); var nb = nl.querySelector(".pb-detail-btn"); if (nb) try { nb.focus({ preventScroll: true }); } catch (e) {} }
    });
    var btns = el("div", "pb-btns"); btns.appendChild(btn);
    var C = ctx(), student = (C.allStudents || []).find(function (s) { return s.id === r.s.student_id; });
    if (view.assignments && student && C.currentUser && student.teacher_id === C.currentUser.id) {
      var current = view.assignments[r.s.student_id];
      var info = current && E.levelInfo(current.activity, current.level);
      if (info) tags.appendChild(el("span", "pb-tag " + (current.done ? "ok" : "asg"),
        (current.done ? "✅ Exercice réussi · " : "🎯 Exercice donné · ") + info.label));
      var assign = el("button", "secondary pb-see pb-asb", current && !current.done ? "🎯 Gérer l’exercice" : "🎯 Donner un exercice");
      assign.type = "button"; assign.setAttribute("aria-expanded", "false");
      assign.addEventListener("click", function () {
        var next = d.nextElementSibling;
        if (next && next.classList.contains("pb-assign")) {
          next.remove(); assign.setAttribute("aria-expanded", "false");
        } else {
          d.parentNode.insertBefore(assignmentEditor(r, current), next);
          assign.setAttribute("aria-expanded", "true");
        }
      });
      btns.appendChild(assign);
    }
    [who, time, prog, nums, btns].forEach(function (x) { d.appendChild(x); }); return d;
  }
  function chiffres(r) {
    var w = el("div"); w.appendChild(el("div", "pd-foot", "En chiffres :")); var chips = el("div", "pd-chips");
    [["🔢 " + r.nums + " " + pl(r.nums, "nombre reconnu", "nombres reconnus") + " sur 101", "Nombres trouvés du premier coup dans Écouter"], ["🧮 " + r.calcs + " " + pl(r.calcs, "calcul gagné", "calculs gagnés"), "Additions et soustractions réussies du premier coup"]]
      .forEach(function (x) { var c = el("span", "pd-chip", x[0]); c.title = x[1]; chips.appendChild(c); });
    w.appendChild(chips); return w;
  }
  /* 3. La classe en chiffres (7 derniers jours) */
  function figuresCalc(rows) {
    var sec = section("📊 La classe en chiffres", "7 derniers jours"), tiles = el("div", "pb-tiles"), w = { nombres: 0, addition: 0, soustraction: 0 };
    rows.forEach(function (r) { Object.keys(w).forEach(function (a) { w[a] += r.week[a]; }); });
    var active = rows.filter(function (r) { return r.series > 0; });
    var nums = active.length ? Math.round(active.reduce(function (a, r) { return a + r.nums; }, 0) / active.length) : null;
    var mean = active.length ? Math.round(10 * active.reduce(function (a, r) { return a + r.won; }, 0) / active.length) / 10 : null;
    [["📊", String(w.nombres + w.addition + w.soustraction), "Séries faites : 👂 " + w.nombres + " écouter · ➕ " + w.addition + " addition · ➖ " + w.soustraction + " soustraction"],
     ["🏅", mean === null ? "—" : mean.toLocaleString("fr-FR"), "Exercices réussis en moyenne par élève actif"],
     ["🔢", nums === null ? "—" : String(nums), "Nombres reconnus en moyenne par élève actif (sur 101)"],
     ["💤", String(rows.filter(function (r) { return r.inactive; }).length), "Élèves pas venus depuis " + IDLE_DAYS + " jours ou plus"]
    ].forEach(function (t) { var d = el("div", "pb-tile"); d.appendChild(el("span", "pb-ico", t[0])); d.appendChild(el("b", "", t[1])); d.appendChild(el("small", "", t[2])); tiles.appendChild(d); });
    sec.appendChild(tiles); return sec;
  }
  /* ===== Fiche de suivi PDF du calcul : même toile que la lecture (ZooPeda.drawWeb), 100 % = attendu à cette date =====
     Écouter / Addition / Soustraction : étapes réussies ÷ (étapes proposées × semaines d’école / 36).
     Du premier coup : bonnes réponses du premier coup, objectif 80 %. Rapidité : temps médian par réponse, objectif 5 s. Sans aide : réponses sans « Je m’aide » ni réécoute, objectif 90 %. */
  var GOAL = { first: 80, ms: 5000, alone: 90 };
  function ctx() { return window.ZooPedaCtx ? window.ZooPedaCtx() : {}; }
  function ficheOK() { return !!(window.ZooPeda && window.ZooPeda.drawWeb && ctx().pdfMake); }
  function calcAxes(r) {
    var P = window.ZooPeda, wk = P.schoolWeeks(), lv = r.lv, q = 0, c = 0, h = 0, ms = [], list = [];
    Object.keys(ACT).forEach(function (a) {
      var ids = enabled(a), done = ids.filter(function (id) { return (lv[a + ":" + id] || {}).ok >= 1; }).length, exp = Math.max(1, Math.round(ids.length * wk / P.YEAR_WEEKS));
      ids.forEach(function (id) { var e = lv[a + ":" + id]; if (!e || !e.q) return; q += e.q; c += e.c || 0; h += (e.h || 0) + (e.rp || 0); if (e.ms > 0) ms.push(e.ms); });
      list.push({ name: ACT[a].title, v: Math.round(done * 100 / exp), txt: done + " " + pl(done, "étape", "étapes") + " · " + exp + " " + pl(exp, "attendue", "attendues"), tip: ids.length + " étapes dans l’année" });
    });
    var first = q ? Math.round(c * 100 / q) : null, alone = q ? Math.max(0, 100 - Math.round(h * 100 / q)) : null, med = ms.length ? median(ms) : null;
    list.push({ name: "Du premier coup", v: first === null ? null : Math.round(first * 100 / GOAL.first), txt: first === null ? "pas encore mesuré" : first + " % des réponses", tip: "Objectif : " + GOAL.first + " % de bonnes réponses du premier coup" });
    list.push({ name: "Rapidité", v: med === null ? null : Math.round(GOAL.ms * 100 / med), txt: med === null ? "pas encore mesuré" : String(Math.round(med / 100) / 10).replace(".", ",") + " s par réponse", tip: "Objectif : " + GOAL.ms / 1000 + " s par réponse ou moins" });
    list.push({ name: "Sans aide", v: alone === null ? null : Math.round(alone * 100 / GOAL.alone), txt: alone === null ? "pas encore mesuré" : alone + " % sans aide", tip: "Sans « Je m’aide » ni réécoute ; objectif " + GOAL.alone + " %" });
    return { list: list, wk: wk };
  }
  function ascii(t) { var T = ctx().pdfText; return T ? T(t) : String(t); }
  function drawCalcFiche(doc, r, clsName, ref) {
    var P = window.ZooPeda, ax = calcAxes(r), W = 210, M = 16, T = ascii, now = new Date(), y;
    var dd = ("0" + now.getDate()).slice(-2) + "/" + ("0" + (now.getMonth() + 1)).slice(-2) + "/" + now.getFullYear();
    doc.setFillColor(7, 95, 93); doc.roundedRect(M, 12, W - 2 * M, 14, 3, 3, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Zoo de Calcul", M + 5, 21.4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(T("Fiche de suivi · " + dd), W - M - 5, 21.2, { align: "right" });
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text(T(r.s.nickname) || "?", M, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(80);
    doc.text(T("Classe : " + clsName).slice(0, 70), M, 47);
    doc.text(T(r.done + " " + pl(r.done, "étape réussie", "étapes réussies") + " sur " + totalSteps() + " · prochaine étape : " + nextStep(r.lv)), M, 53);
    P.drawWeb(doc, T, ax.list, ref, W / 2, 108);
    doc.setLineWidth(0.7); doc.setDrawColor(91, 33, 182); doc.line(M, 66, M + 8, 66);
    doc.setFontSize(8.5); doc.setTextColor(70); doc.text(T(r.s.nickname), M + 10, 67);
    if (ref) { doc.setLineWidth(0.4); doc.setDrawColor(150); doc.setLineDashPattern([1.2, 1.2], 0); doc.line(M, 71, M + 8, 71); doc.setLineDashPattern([], 0); doc.text(T("Élève moyen (sans absents ni extrêmes)"), M + 10, 72); }
    doc.setLineWidth(0.7); doc.setDrawColor(46, 155, 100); doc.line(M, 76, M + 8, 76); doc.text(T("Attendu à cette date (semaine " + Math.round(ax.wk) + " sur " + P.YEAR_WEEKS + ")"), M + 10, 77);
    y = 170; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text(T("Les 6 compétences"), M, y); y += 2;
    ax.list.forEach(function (a, i) {
      y += 7; if (i % 2 === 0) { doc.setFillColor(226, 246, 242); doc.rect(M, y - 4.6, W - 2 * M, 7, "F"); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(a.v === null ? 150 : 30); doc.text(T(a.name), M + 2, y);
      doc.setFont("helvetica", "normal"); doc.text(T(a.txt), M + 40, y); doc.setTextColor(120); doc.setFontSize(8.5); doc.text(T(a.tip), M + 92, y);
    });
    y += 12; var colW = (W - 2 * M - 6) / 2, y0 = y;
    function box(x, title, lines) {
      var hh = 9 + lines.length * 5.6 + 2; doc.setDrawColor(220); doc.setLineWidth(0.3); doc.roundedRect(x, y0 - 5, colW, hh, 2.5, 2.5, "S");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(7, 95, 93); doc.text(T(title), x + 4, y0 + 1);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(50);
      lines.forEach(function (t, j) { doc.text(doc.splitTextToSize(T(t), colW - 8)[0], x + 4, y0 + 7.5 + j * 5.6); }); return hh;
    }
    var work = [];
    if (r.stuck) work.push("Bloqué : " + ACT[r.stuck.act].title + " · " + ((E.levelInfo(r.stuck.act, r.stuck.id) || {}).label || r.stuck.id) + " (" + r.stuck.r + " séries sans réussite)");
    ax.list.slice(3).forEach(function (a) { if (a.v !== null && a.v < 100) work.push(a.name + " : " + a.txt); });
    if (!work.length) work.push("Rien de particulier.");
    var act = ["Séries : " + r.series + " (Écouter " + r.week.nombres + " · Addition " + r.week.addition + " · Soustraction " + r.week.soustraction + ")",
      r.nums + " " + pl(r.nums, "nombre reconnu", "nombres reconnus") + " · " + r.calcs + " " + pl(r.calcs, "calcul gagné", "calculs gagnés"),
      r.idle === null ? "Pas encore d'activité" : "Dernière activité : " + whenTxt(r)];
    box(M, "À travailler", work.slice(0, 4)); box(M + colW + 6, "Activité (7 derniers jours)", act);
    doc.setFontSize(7.5); doc.setTextColor(140);
    doc.text(T("zoodelecture.fr · 100 % = attendu à cette date (semaine " + Math.round(ax.wk) + " sur " + P.YEAR_WEEKS + ") ou objectif indiqué. Bord de la toile : 150 %."), M, 290);
  }
  function makeFiches(list, clsName, btn, file) {
    var C2 = ctx(); if (!C2.pdfMake || !list.length) return;
    var ref = null;
    ref = window.ZooPeda.refOf(view.rows.filter(function (r) { return !r.inactive; }).map(function (r) { return calcAxes(r).list; }));   /* sans les absents ni les extrêmes */
    C2.pdfMake({ btn: btn, msgId: "calcMsg", wait: "Création de la fiche…", file: file,
      title: list.length > 1 ? "Fiches de calcul de « " + clsName + " »" : "Fiche de calcul de " + list[0].s.nickname,
      ok: "📄 " + (list.length > 1 ? list.length + " fiches de suivi pour « " + clsName + " »" : "Fiche de suivi de " + list[0].s.nickname) + " : le PDF s’ouvre (sinon, regardez dans vos téléchargements).",
      build: function (doc) { list.forEach(function (r, i) { if (i) doc.addPage(); drawCalcFiche(doc, r, clsName, ref); }); } });
  }
  function statusTxt(e) { var s = E.status(e); return s === "mastered" ? "⭐ maîtrisé" : s === "done" ? "✓ réussi" : s === "todo" ? "🕒 à travailler" : "pas encore commencé"; }
  function detailGrid(lv) {
    var grid = el("div", "pd-grid");
    Object.keys(ACT).forEach(function (a) {
      var ids = enabled(a), done = ids.filter(function (id) { return (lv[a + ":" + id] || {}).ok >= 1; }), tot = Math.max(1, ids.length);
      var c = el("div", "pd-card"); c.appendChild(el("h5", "", ACT[a].icon + " " + ACT[a].title));
      var big = el("div", "pd-big", String(done.length)); big.appendChild(el("small", "", " / " + ids.length + " " + pl(ids.length, "étape réussie", "étapes réussies"))); c.appendChild(big);
      var bar = el("div", "pd-bar"), fill = el("i"); fill.style.width = Math.round(done.length * 100 / tot) + "%"; fill.style.background = "#2e9b91"; bar.appendChild(fill); c.appendChild(bar);
      var fast = null; done.forEach(function (id) { var an = E.animalOf(a, id); if (an.kmh != null && (!fast || an.kmh > fast.kmh)) fast = an; });
      c.appendChild(el("div", "pd-note", fast ? "🐾 Animal le plus rapide : " + fast.e + " " + fast.nom + " (environ " + String(fast.kmh).replace(".", ",") + " km/h)" : done.length ? "" : "Aucun animal éclos pour l’instant"));
      var ul = el("ul", "pd-list hidden");
      ids.forEach(function (id) {
        var e = lv[a + ":" + id], l = E.levelInfo(a, id), t = (e && e.ok ? l.animal.e : "🥚") + " " + l.label + " : " + statusTxt(e);
        if (e && e.q) t += " · " + e.r + " " + pl(e.r, "série", "séries") + " · " + Math.round(e.c * 100 / e.q) + " % du premier coup" + (a === "nombres" ? " · " + e.rp + " " + pl(e.rp, "réécoute", "réécoutes") : "") + " · " + e.h + " " + pl(e.h, "aide", "aides");
        ul.appendChild(el("li", "", t));
      });
      var more = el("button", "pd-more", "Voir le détail"); more.type = "button"; more.addEventListener("click", function () { var h = ul.classList.toggle("hidden"); more.textContent = h ? "Voir le détail" : "Masquer le détail"; });
      c.appendChild(more); c.appendChild(ul); grid.appendChild(c);
    });
    return grid;
  }
  function legend() {
    var d = el("details", "calc-legend"), sm = el("summary", "", "Ce que mesurent ces résultats"), dl = el("dl");
    [["Séries", "Nombre de séries terminées dans une étape."], ["Premier coup", "Part des questions réussies sans erreur : c’est l’indicateur principal."],
     ["Réécoutes", "Nombre de réécoutes d’un nombre dans ÉCOUTER : un repère, pas une note."], ["Aides", "Questions où l’élève a ouvert la bande des nombres (« Je m’aide »)."],
     ["Statut", "À travailler : séries faites, aucune réussie. Réussi : au moins une série au seuil réglé. Maîtrisé : au moins deux séries réussies."],
     ["Vitesse", "Aucune vitesse n’est notée en phase de découverte ; le temps de réponse n’est pas affiché."]]
      .forEach(function (r) { dl.appendChild(el("dt", "", r[0])); dl.appendChild(el("dd", "", r[1])); });
    d.appendChild(sm); d.appendChild(dl); return d;
  }

  /* ===== Réglages péda du calcul (enregistrement automatique, comme en lecture) ===== */
  function renderSettings() {
    var box = $("#calcSettings"); clear(box);
    box.appendChild(head("🎓", "Pédagogie du calcul", "Ces réglages de Calcul s’appliquent à vos classes qui utilisent vos réglages personnels."));
    var content = el("section", "panel"), detached = el("button", "secondary", "🎯 Exercices décrochés");
    content.appendChild(el("h2", "", "Paramétrer le contenu des exercices"));
    detached.type = "button"; detached.setAttribute("aria-expanded", "false");
    var detachedList = el("div"); detachedList.hidden = true;
    detachedList.appendChild(el("p", "muted", "Aucun exercice collectif de Calcul n’est disponible pour le moment."));
    detached.addEventListener("click", function () {
      detachedList.hidden = !detachedList.hidden; detached.setAttribute("aria-expanded", String(!detachedList.hidden));
    });
    content.appendChild(detached); content.appendChild(detachedList); box.appendChild(content);
    var st = el("span", "save-state", ""); st.id = "calcSave"; st.setAttribute("role", "status"); box.appendChild(st);
    var f = el("div", "calc-fields"); box.appendChild(f);
    rpc("lab_teacher_settings_get").then(function (s) {
      settings = s || {}; saved = JSON.stringify(settings);
      var q = el("input"), qd = el("div"), p = el("input"), pd = el("div"), vd = el("div"), v = el("input");
      q.type = "number"; q.id = "calcQ"; q.min = 5; q.max = 20; q.value = settings.questions || 10; p.type = "number"; p.id = "calcP"; p.min = 50; p.max = 100; p.value = settings.pass || 80; v.type = "checkbox"; v.id = "calcV"; v.checked = settings.voice !== false;
      var lq = el("label", "", "Nombre de questions par série (5 à 20)"); lq.setAttribute("for", "calcQ"); qd.appendChild(lq); qd.appendChild(q); f.appendChild(qd);
      var lp = el("label", "", "Une série est réussie à partir de … % de bonnes réponses du premier coup (50 à 100)"); lp.setAttribute("for", "calcP"); pd.appendChild(lp); pd.appendChild(p); f.appendChild(pd);
      var lv = el("label", "", ""); lv.style.display = "flex"; lv.style.gap = "8px"; lv.style.alignItems = "center"; v.style.width = v.style.height = "20px"; lv.appendChild(v); lv.appendChild(document.createTextNode("Lire automatiquement le nombre à voix haute (ÉCOUTER)")); vd.appendChild(lv); f.appendChild(vd);
      var boxes = {}, orders = {};
      /* Les choix s’insèrent dans l’ordre commun de la mission. */
      Object.keys(ACT).forEach(function (a) {
        var fs = el("fieldset"), lg = el("legend", "", ACT[a].icon + " " + ACT[a].title + " — étapes proposées"), list = el("ol", "calc-order"), on = enabled(a);
        fs.style.border = "0"; fs.style.padding = "0"; fs.style.margin = "0"; lg.style.fontWeight = "800"; fs.appendChild(lg);
        orders[a] = E.missionLevels(a); boxes[a] = {};
        orders[a].forEach(function (id) { boxes[a][id] = on.indexOf(id) >= 0; });
        fs.appendChild(list); f.appendChild(fs);
        orders[a].forEach(function (id) {
          var lv2 = E.levelInfo(a, id), li = el("li", "calc-step"), cb = el("input"), lab = el("label");
          cb.type = "checkbox"; cb.value = id; cb.checked = !!boxes[a][id]; cb.disabled = E.isRequired(id); cb.addEventListener("change", function () { boxes[a][id] = cb.checked; });
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(" " + lv2.animal.e + " " + lv2.label + (cb.disabled ? " (obligatoire)" : "")));
          li.appendChild(lab); list.appendChild(li);
        });
      });
      f.appendChild(el("p", "muted", "La mission alterne reconnaissance des nombres et calcul. Une première étoile ouvre la suite. Les paliers jusqu’à 5 et jusqu’à 10 font partie du parcours de tous les élèves. Les soustractions s’ouvrent après la reconnaissance des nombres jusqu’à 16. Si vous décochez une étape de reconnaissance, les calculs qui en dépendent attendront que les mêmes nombres soient validés dans une autre étape."));
      function collect() {
        var levels = {}; Object.keys(orders).forEach(function (a) { levels[a] = orders[a].filter(function (id) { return boxes[a][id]; }); if (levels[a].length) levels[a] = levels[a].concat(E.marks(a)); });
        return { questions: +q.value, pass: +p.value, voice: v.checked, levels: levels };
      }
      var okTimer = null;
      /* bulle fixe en bas de l'écran (visible même quand on règle une étape plus bas) : « ✓ Enregistré » 2 s, erreur rouge qui reste */
      var bubble = el("div", "calc-toast hidden"); bubble.setAttribute("role", "status"); bubble.setAttribute("aria-live", "polite"); box.appendChild(bubble);
      function setState(t, cls) {
        st.textContent = t; st.className = "save-state " + (cls || "");
        if (cls === "ok") { bubble.textContent = "✓ Enregistré"; bubble.className = "calc-toast ok"; }
        else if (cls === "err") { bubble.textContent = "Pas enregistré, réessayez"; bubble.className = "calc-toast err"; }
        else if (cls === "pending") { bubble.textContent = "Enregistrement…"; bubble.className = "calc-toast pending"; }
        else bubble.className = "calc-toast hidden";
      }
      function flush() {
        clearTimeout(saveTimer);
        var s2 = collect(); if (Object.keys(s2.levels).some(function (k) { return !s2.levels[k].length; })) { setState("⚠️ Gardez au moins une étape par activité.", "err"); return Promise.resolve({message:"Gardez au moins une étape par activité."}); }
        return rpc("lab_teacher_settings_set", { p_settings: s2 }).then(function (r) { settings = r || {}; setState("✓ Enregistré", "ok"); clearTimeout(okTimer); okTimer = setTimeout(function () { if (st.className.indexOf("ok") >= 0) setState("", ""); }, 2000); }).catch(function (error) { setState("⚠️ Non enregistré : vérifiez la connexion. Nouvel essai dans quelques secondes.", "err"); saveTimer = setTimeout(flush, 5000); return error; });
      }
      function queue() { setState("Modifications en cours…", "pending"); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 1000); }
      f.addEventListener("input", queue); f.addEventListener("change", queue);
      if (role === "admin" && window.ZooClassPedagogy) {
        var share = el("section", "panel", ""); share.setAttribute("data-admin-surface", "");
        share.appendChild(el("span", "admin-scope-label", "Administration"));
        share.appendChild(el("h2", "", "Partager mes réglages de Calcul"));
        share.appendChild(el("p", "muted", "Vos réglages servent aussi de modèle lors des nouvelles inscriptions."));
        var target = el("div"); share.appendChild(target); box.insertBefore(share, f);
        window.ZooClassPedagogy(target, "calcul", flush);
      }
    }).catch(function () { st.textContent = "⚠️ Impossible de charger les réglages."; st.className = "save-state err"; });
  }

  /* Pastille « demandes du laboratoire » sur l'onglet Enseignants (admin) */
  function setReqBadge(n) {
    var tab = $('[data-tab="enseignants"]'); if (!tab) return;
    var b = $("#calcReqBadge"); if (!b) { b = el("span", "nav-badge", ""); b.id = "calcReqBadge"; tab.appendChild(b); }
    b.textContent = "🧪 " + n; b.classList.toggle("hidden", !n); b.setAttribute("aria-label", n + (n > 1 ? " demandes d’accès au Zoo de Calcul" : " demande d’accès au Zoo de Calcul"));
  }
  function checkRequests() { rpc("lab_admin_state").then(function (st) { setReqBadge((st.requests || []).length); }).catch(function () {}); }

  /* ===== Accès au laboratoire (administrateur) ===== */
  function renderAccess() {
    var box = $("#calcAccess"); clear(box);
    var holder = el("div"); box.appendChild(holder); holder.appendChild(el("p", "muted", "Chargement…"));
    function load() { rpc("lab_admin_state").then(paint).catch(function () { clear(holder); holder.appendChild(el("p", "msg err", "Impossible de charger les accès.")); }); }
    function paint(st) {
      clear(holder);
      var sw = el("div", "calc-fields"); sw.appendChild(el("p", st.enabled ? "msg" : "msg err", st.enabled ? "Le laboratoire est ACTIVÉ pour les comptes de la liste." : "Le laboratoire est DÉSACTIVÉ : personne n’y a accès."));
      var tg = el("button", st.enabled ? "danger" : "", st.enabled ? "Désactiver tout le laboratoire" : "Activer le laboratoire"); tg.type = "button";
      tg.addEventListener("click", function () { tg.disabled = true; rpc("lab_admin_set_enabled", { p_enabled: !st.enabled }).then(load).catch(function () { tg.disabled = false; }); });
      sw.appendChild(tg); holder.appendChild(sw);
      setReqBadge((st.requests || []).length);
      if ((st.requests || []).length) {
        holder.appendChild(el("h3", "", "🧪 Demandes d’accès (" + st.requests.length + ")"));
        st.requests.forEach(function (q) {
          var line = el("div", "row seat-alert"), t = el("div"); t.style.flex = "1"; t.style.minWidth = "200px";
          t.appendChild(el("strong", "", "👩‍🏫 " + q.label)); t.appendChild(el("div", "muted", "Demande du " + new Date(q.requested_at).toLocaleDateString("fr-FR") + " · accès pour lui et ses élèves"));
          var ok = el("button", "", "Accepter"), no = el("button", "danger", "Refuser"); ok.type = no.type = "button";
          ok.addEventListener("click", function () { ok.disabled = no.disabled = true; rpc("lab_admin_grant", { p_kind: "teacher", p_subject: q.teacher_id, p_scope: "self_and_students", p_note: "Sur demande" }).then(load).catch(function () { ok.disabled = no.disabled = false; }); });
          no.addEventListener("click", function () { ok.disabled = no.disabled = true; rpc("lab_admin_decline", { p_teacher: q.teacher_id }).then(load).catch(function () { ok.disabled = no.disabled = false; }); });
          line.appendChild(t); line.appendChild(ok); line.appendChild(no); holder.appendChild(line);
        });
      }
      holder.appendChild(el("h3", "", "Comptes autorisés (" + st.access.length + ")"));
      if (!st.access.length) holder.appendChild(el("p", "muted", "Aucun compte autorisé."));
      st.access.forEach(function (r) {
        var line = el("div", "row"), t = el("div"); t.style.flex = "1"; t.style.minWidth = "200px";
        t.appendChild(el("strong", "", (r.kind === "teacher" ? "👩‍🏫 " : "🧒 ") + (r.label || "(compte supprimé)")));
        t.appendChild(el("div", "muted", (r.kind === "teacher" ? "Enseignant" : "Élève") + (r.scope === "self_and_students" ? " · et tous ses élèves" : "") + (r.note ? " · " + r.note : "")));
        var rv = el("button", "danger", "Retirer"); rv.type = "button"; rv.addEventListener("click", function () { rv.disabled = true; rpc("lab_admin_revoke", { p_id: r.id }).then(load).catch(function () { rv.disabled = false; }); });
        line.appendChild(t); line.appendChild(rv); holder.appendChild(line);
      });
      holder.appendChild(el("h3", "", "Autoriser un compte"));
      var ad = el("div", "calc-fields"), kind = el("select"), who = el("select"), scope = el("input"), scopeL = el("label"), note = el("input"), msg = el("div", "msg");
      kind.id = "calcKind"; who.id = "calcWho"; note.id = "calcNote"; note.type = "text"; note.maxLength = 200; note.placeholder = "Note (facultatif)"; scope.type = "checkbox"; scope.style.width = scope.style.height = "20px";
      [["teacher", "Un enseignant"], ["student", "Un élève"]].forEach(function (o) { var x = el("option", "", o[1]); x.value = o[0]; kind.appendChild(x); });
      scopeL.style.display = "flex"; scopeL.style.gap = "8px"; scopeL.style.alignItems = "center"; scopeL.appendChild(scope); scopeL.appendChild(document.createTextNode("Autoriser aussi tous les élèves de cet enseignant"));
      function fill() { clear(who); (kind.value === "teacher" ? st.teachers : st.students).forEach(function (x) { var o = el("option", "", x.label + (x.class_name ? " — " + x.class_name : "")); o.value = x.id; who.appendChild(o); }); scopeL.style.display = kind.value === "teacher" ? "flex" : "none"; }
      kind.addEventListener("change", fill); fill();
      var go = el("button", "", "Autoriser"); go.type = "button";
      go.addEventListener("click", function () {
        if (!who.value) return; go.disabled = true;
        rpc("lab_admin_grant", { p_kind: kind.value, p_subject: who.value, p_scope: kind.value === "teacher" && scope.checked ? "self_and_students" : "self", p_note: note.value || null }).then(load)
          .catch(function (e) { go.disabled = false; msg.className = "msg err"; msg.textContent = (e && e.message) || "Échec."; });
      });
      [kind, who, scopeL, note, go, msg].forEach(function (n) { ad.appendChild(n); }); holder.appendChild(ad);
    }
    load();
  }

  window.CalcTeacher = {
    pickClass: function (id) {
      if (id !== view.classId) { view.classId = id; view.open = {}; view.filter = "all"; }
    },
    _fiche: { draw: function (d, r, n, f) { drawCalcFiche(d, r, n, f); }, view: view },
    init: function (a) {
      if (document.getElementById("calc-teacher-css") || !E || !C.url) return;
      role = a && a.role === "admin" ? "admin" : "teacher"; css();
      if (!build()) return;
      var want = "lecture"; try { want = localStorage.getItem("zoo_matiere") === "calcul" ? "calcul" : "lecture"; } catch (e) {}
      mode = "lecture"; window.CalcTeacher.sw.l.classList.add("on"); if (want === "calcul") setMode("calcul");
      if (role === "admin") checkRequests();
    }
  };
})();
