/* Espace « Pédagogie » de l'espace enseignant (enseignants.html) : tableau de bord d'une classe.
   Fiche élève PDF : toile d’araignée des 6 compétences (bouton « 📄 Fiche » de chaque ligne, « 📄 Fiches de suivi » pour la classe).
   1. Points de vigilance (élèves bloqués sur un son, confusions fréquentes, inactifs)
   2. Activité et rythme de la classe (7 derniers jours)
   3. Tableau de suivi individuel, avec filtres
   Lecture seule. Données : student_progress.progress (résultats, écoute, dictée, stats = mesures du Zoo, voir zoo-connecte.html statsClean).
   Le grand script de enseignants.html est fermé (fonction) : il donne ce qu’il faut par window.ZooPedaCtx() (client, utilisateur, rôle, élèves, classes, sons, voy2Fix, pl, showTab, printLoginCards, queueSave). */
(function () {
  "use strict";
  var LATE = 3, AHEAD = 3, INACTIVE_DAYS = 7, DAY = 864e5;
  var state = { classId: null, filter: "all", rows: [] }, C = {};
  function $(id) { return document.getElementById(id); }
  window.pedaAllo = window.pedaAllo || [];   /* élèves allophones (réglage enseignant « allo ») */

  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function plur(n, a, b) { return n + " " + (C.pl ? C.pl(n, a, b) : (n > 1 ? b : a)); }
  function soundsOrder() { return (C.cfgSounds || []).filter(function (x) { return x && x.id && x.id !== "h" && x.id !== "sz"; }); }
  function soundName(id) { var x = (C.cfgSounds || []).find(function (z) { return z && z.id === id; }); return x ? (x.label || x.id) : id; }
  function thrOf() { return { s: Number($("thrS").value) || 25, m: Number($("thrM").value) || 20, t: Number($("thrT").value) || 15 }; }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  /* « b|d » et « d|b » sont la même confusion */
  function pairKey(k) { var p = String(k).split("|"); if (p.length !== 2 || p[0] === "∅" || p[1] === "∅") return null; return p.slice().sort().join(" / "); }

  /* Tout ce que le tableau sait d'un élève */
  function analyse(s, row) {
    var p = C.voy2Fix((row && row.progress) || {}, thrOf().s), thr = thrOf(), order = soundsOrder();
    var res = Array.isArray(p.results) ? p.results.filter(function (r) { return r && r.sound; }) : [];
    var cert = {}, readOn = {};
    res.forEach(function (r) {
      if (r.void || r.short || Number(r.fraud) > 0 || !thr[r.k]) return;
      readOn[r.sound] = (readOn[r.sound] || 0) + 1;
      if (r.src !== "train" && (r.src === "adj" || (Number(r.mclm) || 0) >= thr[r.k])) cert[r.sound] = true;
    });
    var nValid = order.filter(function (x) { return cert[x.id]; }).length;
    var curIdx = order.findIndex(function (x) { return !cert[x.id]; }), cur = curIdx >= 0 ? order[curIdx] : null;
    var st = p.stats && typeof p.stats === "object" ? p.stats : {}, days = st.days && typeof st.days === "object" ? st.days : {}, snd = st.snd && typeof st.snd === "object" ? st.snd : {};
    var now = Date.now(), week = [], secs = 0, series = [0, 0, 0, 0];
    for (var i = 0; i < 7; i++) week.push(dayKey(now - i * DAY));
    week.forEach(function (k) { var d = days[k]; if (Array.isArray(d)) { secs += Number(d[0]) || 0; for (var j = 1; j <= 4; j++) series[j - 1] += Number(d[j]) || 0; } });
    /* dernière activité : jours mesurés, lectures, parties, dernière sauvegarde */
    var ts = [Date.parse((row && row.updated_at) || "") || 0];
    res.forEach(function (r) { ts.push(Number(r.ts) || 0); });
    Object.keys(days).forEach(function (k) { var d = days[k]; if (Array.isArray(d) && d.some(function (v) { return Number(v) > 0; })) ts.push(Date.parse(k + "T12:00:00") || 0); });
    var last = Math.max.apply(null, ts.filter(function (x) { return x > 1e11; }).concat([0]));
    var idle = last ? Math.floor((now - last) / DAY) : null;
    /* son en cours : taux d’erreur à « J’entends », à l’écoute et en dictée, lectures sans réussite */
    var err = null, answers = 0, readTries = 0;
    if (cur) {
      var c = snd[cur.id] || {}, ok = 0, ko = 0;
      ["l", "w", "p", "c"].forEach(function (a) { if (Array.isArray(c[a])) { ok += Number(c[a][0]) || 0; ko += Number(c[a][1]) || 0; } });
      answers = ok + ko; err = answers ? Math.round(ko * 100 / answers) : null;
      readTries = readOn[cur.id] || 0;
    }
    /* lectures enregistrées pour la médaille, en attente d'écoute (jalon 4) : le son en cours n'est pas « bloqué » s'il attend l'écoute */
    var recs = Array.isArray(p.reviews) ? p.reviews.filter(function (x) { return x && x.sound; }) : [];
    var curSent = !!cur && recs.some(function (x) { return x.sound === cur.id; });
    var blocked = !!cur && !curSent && ((answers >= 6 && err >= 40) || readTries >= 3);
    var flu = res.filter(function (r) { return !r.void && !r.short && !(Number(r.fraud) > 0) && r.src !== "adj" && Number(r.mclm) > 0; })
      .sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); })[0] || null;
    return { s: s, p: p, nValid: nValid, total: order.length, cur: cur, err: err, answers: answers, readTries: readTries, blocked: blocked,
      recs: recs.length, curSent: curSent, secs: secs, series: series, idle: idle, flu: flu, conf: st.conf && typeof st.conf === "object" ? st.conf : {}, measured: Object.keys(days).length > 0,
      allo: window.pedaAllo.indexOf(s.id) >= 0, asg: (window.pedaAssign || {})[s.id] || null, remed: p.remed && typeof p.remed === "object" ? p.remed : null };
  }
  function classify(rows) {
    var med = median(rows.map(function (r) { return r.nValid; }));
    rows.forEach(function (r) {
      r.late = med - r.nValid >= LATE; r.ahead = r.nValid - med >= AHEAD;
      r.inactive = r.idle === null || r.idle >= INACTIVE_DAYS;
      r.color = r.inactive ? "idle" : (r.late || r.blocked ? "red" : (r.ahead ? "green" : "yellow"));
    });
    return med;
  }

  function myClasses() {
    var own = (C.allClasses || []).filter(function (c) { return !c.ghosted_at && c.teacher_id === C.currentUser.id; });
    if (C.currentRole === "admin") own = own.concat((C.allClasses || []).filter(function (c) { return !c.ghosted_at && c.teacher_id !== C.currentUser.id; }));
    return own;
  }

  async function render() {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    var box = $("pedaBoard");
    if (!box || !C.currentUser) return;
    var classes = myClasses();
    box.replaceChildren();
    if (!classes.length || !(C.allStudents || []).length) {
      var empty = mk("div", "pb-empty");
      empty.append(mk("p", null, "Votre tableau de bord apparaîtra ici dès que vos élèves auront commencé à utiliser le Zoo."));
      var go = mk("button", "primary", "📚 Créer ma classe et mes élèves"); go.type = "button";
      go.onclick = function () { C.showTab("eleves"); };
      empty.append(go); box.append(empty); return;
    }
    if (!state.classId || !classes.some(function (c) { return c.id === state.classId; })) state.classId = classes[0].id;
    var cls = classes.find(function (c) { return c.id === state.classId; });
    var studs = C.allStudents.filter(function (s) { return s.class_id === cls.id && !s.ghosted_at; });

    /* En-tête : classe + actions */
    var head = mk("div", "pb-head");
    var left = mk("div", "pb-class");
    if (classes.length > 1) {
      var sel = mk("select", "pb-select"); sel.setAttribute("aria-label", "Classe");
      classes.forEach(function (c) { var o = mk("option", null, c.name + (c.teacher_id !== C.currentUser.id ? " (autre enseignant)" : "")); o.value = c.id; sel.append(o); });
      sel.value = cls.id; sel.onchange = function () { state.classId = sel.value; render(); };
      left.append(mk("span", "pb-lbl", "Classe"), sel);
    } else left.append(mk("strong", "pb-cname", "📚 " + cls.name));
    left.append(mk("span", "pb-count", plur(studs.length, "élève", "élèves")));
    head.append(left);
    var acts = mk("div", "pb-acts");
    if (studs.length && C.printLoginCards) {
      var pr = mk("button", "secondary", "🖨️ Codes pour la maison"); pr.type = "button"; pr.title = "Fiches de connexion à donner aux familles";
      pr.onclick = function () { C.printLoginCards(cls, "pedaMsg", pr); };
      acts.append(pr);
    }
    head.append(acts);
    box.append(head, mk("p", "msg", null));
    box.lastChild.id = "pedaMsg";

    if (!studs.length) { box.append(mk("p", "muted", "Aucun élève dans cette classe.")); return; }
    var wait = mk("p", "muted", "Chargement…"); box.append(wait);
    var q = await C.client.from("student_progress").select("student_id,progress,updated_at").in("student_id", studs.map(function (s) { return s.id; }));
    wait.remove();
    if (q.error) { box.append(mk("p", "msg err", "Impossible de charger les résultats : " + (q.error.message || ""))); return; }
    var map = {}; (q.data || []).forEach(function (r) { map[r.student_id] = r; });
    var rows = studs.map(function (s) { return analyse(s, map[s.id]); });
    var med = classify(rows);
    state.rows = rows; state.cls = cls;
    if (C.pdfMake) {
      var fa = mk("button", "secondary", "📄 Fiches de suivi (PDF)"); fa.type = "button"; fa.title = "Une fiche par élève, avec sa toile des 6 compétences";
      fa.onclick = function () { makeFiches(rows.slice().sort(function (a, b) { return String(a.s.nickname).localeCompare(b.s.nickname); }), cls, fa, "fiches-suivi-" + (C.pdfSlug(cls.name) || "classe")); };
      acts.append(fa);
    }
    box.append(vigilance(rows), rhythm(rows, med), matrix(rows));
  }

  /* 1. Points de vigilance */
  function vigilance(rows) {
    var sec = section("1", "Points de vigilance", "cette semaine");
    var grid = mk("div", "pb-alerts"), n = 0;
    /* élèves bloqués, regroupés par son */
    var bySound = {};
    rows.filter(function (r) { return r.blocked && !r.inactive; }).forEach(function (r) { (bySound[r.cur.id] = bySound[r.cur.id] || []).push(r); });
    Object.keys(bySound).sort(function (a, b) { return bySound[b].length - bySound[a].length; }).slice(0, 4).forEach(function (id) {
      var list = bySound[id];
      grid.append(alertCard("⚠️ " + plur(list.length, "élève bloque", "élèves bloquent") + " sur le son «\u00a0" + soundName(id) + "\u00a0»",
        list.map(function (r) { return r.s.nickname; }).join(", "),
        "Beaucoup d’erreurs à l’écoute ou en dictée, ou plusieurs lectures sans réussite."));
      n++;
    });
    /* confusions fréquentes dans la classe (écoute, dictée, tuiles) */
    var conf = {};
    rows.forEach(function (r) {
      Object.keys(r.conf).forEach(function (k) {
        var pk = pairKey(k), v = Number(r.conf[k]) || 0; if (!pk || !v) return;
        var c = conf[pk] || (conf[pk] = { total: 0, who: {} });
        c.total += v; c.who[r.s.nickname] = (c.who[r.s.nickname] || 0) + v;
      });
    });
    Object.keys(conf).map(function (k) {
      var who = Object.keys(conf[k].who).filter(function (w) { return conf[k].who[w] >= 2; });
      return { k: k, total: conf[k].total, who: who };
    }).filter(function (c) { return c.who.length; }).sort(function (a, b) { return b.who.length - a.who.length || b.total - a.total; }).slice(0, 3).forEach(function (c) {
      grid.append(alertCard("🔀 Confusion fréquente : " + c.k, c.who.join(", "), "Élèves qui ont confondu ces deux écritures au moins 2 fois."));
      n++;
    });
    var idle = rows.filter(function (r) { return r.inactive; });
    if (idle.length) { grid.append(alertCard("💤 " + plur(idle.length, "élève inactif", "élèves inactifs") + " depuis plus de " + INACTIVE_DAYS + " jours", idle.map(function (r) { return r.s.nickname; }).join(", "), null)); n++; }
    if (!n) grid.append(mk("p", "pb-calm", "✅ Rien d’inquiétant pour l’instant."));
    sec.append(grid);
    if (!rows.some(function (r) { return r.measured; })) sec.append(mk("p", "muted pb-note", "Les erreurs, les confusions et le temps de travail sont mesurés depuis le 17 novembre 2026 : ces informations se rempliront au fil des séances."));
    return sec;
  }
  function alertCard(title, names, tip) {
    var c = mk("div", "pb-alert"); c.append(mk("strong", null, title), mk("span", "pb-names", names));
    if (tip) c.title = tip;
    return c;
  }

  /* 2. Activité et rythme */
  function rhythm(rows, med) {
    var sec = section("2", "Activité et rythme de la classe", "7 derniers jours");
    var active = rows.filter(function (r) { return r.secs > 0; });
    var avg = active.length ? Math.round(rows.reduce(function (a, r) { return a + r.secs; }, 0) / rows.length / 60) : null;
    var series = [0, 0, 0, 0]; rows.forEach(function (r) { for (var i = 0; i < 4; i++) series[i] += r.series[i]; });
    var total = rows.length ? rows[0].total : 0;
    var tiles = mk("div", "pb-tiles");
    [["⏱️", avg === null ? "—" : avg + " min", "Temps de travail moyen par élève"],
     ["🏅", (Math.round(med * 10) / 10).toString().replace(".", ",") + " / " + total, "Sons validés (élève du milieu de la classe)"],
     ["💤", String(rows.filter(function (r) { return r.inactive; }).length), "Élèves inactifs (plus de " + INACTIVE_DAYS + " jours)"],
     ["📊", series[0] + " · " + series[1] + " · " + series[2], "Séances d’écoute · dictée · lecture"]
    ].forEach(function (t) { var d = mk("div", "pb-tile"); d.append(mk("span", "pb-ico", t[0]), mk("b", null, t[1]), mk("small", null, t[2])); tiles.append(d); });
    sec.append(tiles);
    return sec;
  }

  /* 3. Tableau de suivi individuel */
  var FILTERS = [["all", "Tous"], ["late", "En difficulté"], ["ahead", "En avance"], ["idle", "Inactifs"], ["allo", "Allophones"]];
  function keep(r, f) { return f === "all" || (f === "late" && r.color === "red") || (f === "ahead" && r.ahead && !r.inactive) || (f === "idle" && r.inactive) || (f === "allo" && r.allo); }
  function matrix(rows) {
    var sec = section("3", "Suivi individuel", null);
    var bar = mk("div", "pb-filters"); bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Filtrer les élèves");
    var list = mk("div", "pb-list");
    function paint() {
      list.replaceChildren();
      var shown = rows.filter(function (r) { return keep(r, state.filter); });
      var rank = { red: 0, yellow: 1, green: 2, idle: 3 };
      shown.sort(function (a, b) { return rank[a.color] - rank[b.color] || a.nValid - b.nValid || String(a.s.nickname).localeCompare(b.s.nickname); });
      if (!shown.length) list.append(mk("p", "muted", "Aucun élève dans ce filtre."));
      shown.forEach(function (r) { list.append(line(r, paint)); });
      Array.prototype.forEach.call(bar.children, function (b) { var on = b.dataset.f === state.filter; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
    }
    FILTERS.forEach(function (f) {
      var n = rows.filter(function (r) { return keep(r, f[0]); }).length;
      var b = mk("button", "pb-filter", f[1] + " (" + n + ")"); b.type = "button"; b.dataset.f = f[0];
      b.onclick = function () { state.filter = f[0]; paint(); };
      bar.append(b);
    });
    var legend = mk("p", "muted pb-legend", "🔴 en difficulté (bloqué, ou " + LATE + " sons de retard sur l’élève du milieu de la classe) · 🟡 avance normalement · 🟢 en avance de " + AHEAD + " sons ou plus · ⚪ inactif depuis " + INACTIVE_DAYS + " jours");
    sec.append(bar, legend, list);
    paint();
    return sec;
  }
  function line(r, repaint) {
    var dot = { red: "🔴", yellow: "🟡", green: "🟢", idle: "⚪" }[r.color];
    var d = mk("div", "pb-row c-" + r.color);
    var who = mk("div", "pb-who");
    who.append(mk("span", "pb-dot", dot), mk("strong", null, r.s.nickname));
    var al = mk("button", "pb-allo" + (r.allo ? " on" : ""), "🌍"); al.type = "button";
    al.title = r.allo ? "Élève allophone (toucher pour retirer)" : "Marquer comme élève allophone";
    al.setAttribute("aria-pressed", String(r.allo));
    al.onclick = function () {
      var i = window.pedaAllo.indexOf(r.s.id);
      if (i >= 0) window.pedaAllo.splice(i, 1); else window.pedaAllo.push(r.s.id);
      r.allo = i < 0;
      if (C.queueSave) C.queueSave("pedaSave");
      repaint();
    };
    who.append(al);
    var time = mk("div", "pb-time", r.secs ? Math.round(r.secs / 60) + " min" : "0 min"); time.title = "Temps de travail sur 7 jours";
    var prog = mk("div", "pb-prog");
    var pbar = mk("div", "pb-bar"), fill = document.createElement("i");
    fill.style.width = (r.total ? Math.round(r.nValid * 100 / r.total) : 0) + "%"; pbar.append(fill);
    pbar.setAttribute("role", "img"); pbar.setAttribute("aria-label", r.nValid + " sons validés sur " + r.total);
    var txt;
    if (r.inactive) txt = r.idle === null ? "Pas encore commencé" : "Inactif depuis " + r.idle + " jours";
    else if (!r.cur) txt = "Tous les sons validés 🎉";
    else txt = "Son «\u00a0" + soundName(r.cur.id) + "\u00a0» · " + (r.blocked ? (r.err !== null && r.answers >= 6 ? "bloqué (" + r.err + " % d’erreurs)" : "bloqué (" + r.readTries + " lectures sans réussite)") : (r.curSent ? "lecture enregistrée, à écouter" : "en cours"));
    if (r.recs) txt += " · 🎧 " + plur(r.recs, "lecture à écouter", "lectures à écouter");
    prog.append(pbar, mk("small", null, r.nValid + "/" + r.total + " · " + txt));
    if (r.asg) { var ast = asgState(r.asg, r.remed); prog.append(mk("small", "pb-asg" + (ast.ok ? " ok" : ""), "🎯 " + asgLabel(r.asg) + " · " + asgStatusText(r.asg, r.remed))); }
    var flu = mk("div", "pb-flu", r.flu ? Math.round(Number(r.flu.mclm)) + "/min" : "—");
    flu.title = r.flu ? "Dernière lecture : " + Math.round(Number(r.flu.mclm)) + " corrects par minute (" + ({ s: "syllabes", m: "mots", t: "texte" }[r.flu.k] || "lecture") + ")" : "Pas encore de lecture";
    var act = mk("button", "secondary pb-see", "Voir"); act.type = "button"; act.title = "Voir les détails de " + r.s.nickname;
    act.onclick = function () { openDetails(r.s); };
    var btns = mk("div", "pb-btns"); btns.append(act);
    /* « + Assigner » : seulement pour ses propres élèves (le réglage est celui de l’enseignant de la classe) */
    if (state.cls && C.currentUser && state.cls.teacher_id === C.currentUser.id) {
      var asb = mk("button", "secondary pb-see pb-asb", r.asg && !asgState(r.asg, r.remed).ok ? "🎯 Exercice" : "+ Assigner"); asb.type = "button";
      asb.title = "Donner un exercice à " + r.s.nickname + " (en tête de sa mission jusqu’à réussite)";
      asb.setAttribute("aria-expanded", "false");
      asb.onclick = function () {
        var nx = d.nextElementSibling;
        if (nx && nx.classList.contains("pb-assign")) { nx.remove(); asb.setAttribute("aria-expanded", "false"); return; }
        d.parentNode.insertBefore(assignEditor(r, repaint), d.nextSibling); asb.setAttribute("aria-expanded", "true");
      };
      btns.append(asb);
    }
    if (C.pdfMake) {
      var fi = mk("button", "secondary pb-see", "📄 Fiche"); fi.type = "button"; fi.title = "Fiche de suivi de " + r.s.nickname + " (PDF à imprimer)";
      fi.onclick = function () { makeFiches([r], state.cls, fi, "fiche-suivi-" + (C.pdfSlug(r.s.nickname) || "eleve")); };
      btns.append(fi);
    }
    d.append(who, time, prog, flu, btns);
    return d;
  }
  /* « Voir » : ouvre « Suivi par élève » sur cet élève, détails dépliés */
  function openDetails(s) {
    C.showTab("progression");
    var rows = document.querySelectorAll("#progressList .progress-row");
    for (var i = 0; i < rows.length; i++) {
      var n = rows[i].querySelector("strong");
      if (!n || n.textContent !== s.nickname) continue;
      var body = rows[i].closest(".cg-body");
      if (body && body.classList.contains("hidden")) { var h = body.previousElementSibling; if (h) h.click(); }
      var btn = Array.prototype.find.call(rows[i].querySelectorAll("button"), function (b) { return b.textContent === "Détails"; });
      if (btn && btn.getAttribute("aria-expanded") !== "true") btn.click();
      rows[i].scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
  }
  function section(num, title, sub) {
    var s = mk("section", "pb-sec");
    var h = mk("h3", "pb-h"); h.append(mk("span", "pb-num", num), document.createTextNode(title));
    if (sub) h.append(mk("small", null, " · " + sub));
    s.append(h);
    return s;
  }

  /* ===== Fiche élève PDF (jalon 3) : toile d'araignée à 6 axes + points à travailler =====
     Chaque axe va de 0 à 100 %. Phonologie et compréhension : null tant que ces exercices n'existent pas dans le Zoo
     (progress.phono.done / progress.compr.done, mêmes clés que l'écoute et la dictée, seront lues automatiquement). */
  var KN = { s: "syllabes", m: "mots", t: "texte" };
  function doneCount(o, need) {
    o = o && typeof o === "object" ? o : {};
    var done = o.done && typeof o.done === "object" ? o.done : {}, passes = o.passes && typeof o.passes === "object" ? o.passes : {};
    var order = soundsOrder(), ir = order.findIndex(function (x) { return x.id === "r"; });
    return order.filter(function (x, i) { return done[x.id] || (need && (Number(passes[x.id]) || 0) >= need(i, ir)); }).length;
  }
  function axes(r) {
    var p = r.p, tot = Math.max(1, r.total), thr = thrOf();
    var lp = Number(C.listenPasses) || 2, dp = Number(C.dicteePasses) || 1;
    var nL = doneCount(p.listen, function (i, ir) { return lp + (ir >= 0 && i >= ir ? 1 : 0); });
    var nD = doneCount(p.dictee, function () { return dp; });
    var opt = function (o) { return o && typeof o === "object" && o.done && typeof o.done === "object" ? doneCount(o, null) : null; };
    var nP = opt(p.phono), nC = opt(p.compr);
    var flu = (Array.isArray(p.results) ? p.results : []).filter(function (x) { return x && !x.void && !x.short && !(Number(x.fraud) > 0) && x.src !== "adj" && Number(x.mclm) > 0 && thr[x.k]; })
      .sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); });
    var last3 = flu.slice(0, 3), sp = last3.length ? Math.round(last3.reduce(function (a, x) { return a + Math.min(1, Number(x.mclm) / thr[x.k]); }, 0) * 100 / last3.length) : null;
    var pct = function (n) { return n === null ? null : Math.round(n * 100 / tot); };
    var sons = function (n) { return n === null ? "pas encore mesuré" : n + " / " + r.total + " sons"; };
    return { flu: flu, list: [
      { k: "phono", name: "Phonologie", v: pct(nP), txt: sons(nP), tip: "Entendre un son dans un mot" },
      { k: "ecoute", name: "Écoute", v: pct(nL), txt: sons(nL), tip: "Reconnaître l'écriture d'un son entendu" },
      { k: "dictee", name: "Dictée", v: pct(nD), txt: sons(nD), tip: "Écrire un son, une syllabe, un mot entendus" },
      { k: "lecture", name: "Lecture", v: pct(r.nValid), txt: sons(r.nValid), tip: "Lecture validée par l'enseignant" },
      { k: "compr", name: "Compréhension", v: pct(nC), txt: sons(nC), tip: "Associer un mot lu à son image" },
      { k: "vitesse", name: "Vitesse", v: sp, txt: sp === null ? "pas encore de lecture" : sp + " % du seuil attendu", tip: "3 dernières lectures, par rapport au seuil de réussite de la classe" }
    ] };
  }
  function studentConf(r) {
    var c = {};
    Object.keys(r.conf || {}).forEach(function (k) { var pk = pairKey(k), v = Number(r.conf[k]) || 0; if (pk && v) c[pk] = (c[pk] || 0) + v; });
    return Object.keys(c).map(function (k) { return [k, c[k]]; }).filter(function (x) { return x[1] >= 2; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
  }
  function frDate(ts) { var d = new Date(ts); return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear(); }

  /* Dessine une fiche (une page A4) */
  function drawFiche(doc, r, cls, ref) {
    var T = C.pdfText, ax = axes(r), W = 210, M = 16;
    doc.setFillColor(55, 36, 101); doc.roundedRect(M, 12, W - 2 * M, 14, 3, 3, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Zoo de Lecture", M + 5, 21.4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(T("Fiche de suivi · " + frDate(Date.now())), W - M - 5, 21.2, { align: "right" });
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text(T(r.s.nickname) || "?", M, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(80);
    doc.text(T("Classe : " + cls.name).slice(0, 70), M, 47);
    var cur = r.cur ? "Son en cours : « " + soundName(r.cur.id) + " »" : "Tous les sons sont validés";
    doc.text(T(r.nValid + " " + (r.nValid > 1 ? "sons validés" : "son validé") + " en lecture sur " + r.total + " · " + cur), M, 53);

    /* Toile d'araignée */
    var cx = W / 2, cy = 108, R = 39, n = ax.list.length;
    function pt(i, f) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; }
    function poly(pts, style) { var d = []; for (var i = 1; i < pts.length; i++) d.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]); doc.lines(d, pts[0][0], pts[0][1], [1, 1], style, true); }
    doc.setLineWidth(0.2); doc.setDrawColor(200);
    [0.25, 0.5, 0.75, 1].forEach(function (f) { var ps = []; for (var i = 0; i < n; i++) ps.push(pt(i, f)); poly(ps, "S"); });
    for (var i = 0; i < n; i++) { var e = pt(i, 1); doc.line(cx, cy, e[0], e[1]); }
    doc.setFontSize(7); doc.setTextColor(150); ["25", "50", "75", "100 %"].forEach(function (t, j) { doc.text(t, cx + 1, cy - R * (j + 1) / 4 - 0.8); });
    /* repère : l'élève du milieu de la classe, en pointillés */
    if (ref) {
      var rp = []; ref.forEach(function (v, i) { rp.push(pt(i, Math.max(0.03, (v || 0) / 100))); });
      doc.setDrawColor(150); doc.setLineWidth(0.4); doc.setLineDashPattern([1.2, 1.2], 0); poly(rp, "S"); doc.setLineDashPattern([], 0);
    }
    var vals = []; ax.list.forEach(function (a, i) { vals.push(pt(i, Math.max(0.03, (a.v || 0) / 100))); });
    doc.setFillColor(214, 200, 250); doc.setDrawColor(91, 33, 182); doc.setLineWidth(0.7); poly(vals, "FD");
    ax.list.forEach(function (a, i) {
      var p = vals[i]; if (a.v !== null) { doc.setFillColor(91, 33, 182); doc.circle(p[0], p[1], 1.1, "F"); }
      var l = pt(i, 1.17), al = Math.abs(l[0] - cx) < 2 ? "center" : (l[0] > cx ? "left" : "right");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(a.v === null ? 160 : 30);
      doc.text(T(a.name), l[0], l[1] + (l[1] < cy - 5 ? -2 : (l[1] > cy + 5 ? 4 : 1)), { align: al });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(a.v === null ? 160 : 90);
      doc.text(a.v === null ? "(bientôt)" : a.v + " %", l[0], l[1] + (l[1] < cy - 5 ? 2.2 : (l[1] > cy + 5 ? 8.2 : 5.2)), { align: al });
    });

    /* légende */
    doc.setLineWidth(0.7); doc.setDrawColor(91, 33, 182); doc.line(M, 66, M + 8, 66);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(70); doc.text(T(r.s.nickname), M + 10, 67);
    if (ref) { doc.setLineWidth(0.4); doc.setDrawColor(150); doc.setLineDashPattern([1.2, 1.2], 0); doc.line(M, 71, M + 8, 71); doc.setLineDashPattern([], 0); doc.text("Milieu de la classe", M + 10, 72); }

    /* Tableau des 6 axes */
    var y = 170;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text("Les 6 compétences", M, y); y += 2;
    ax.list.forEach(function (a, i) {
      y += 7;
      if (i % 2 === 0) { doc.setFillColor(244, 241, 252); doc.rect(M, y - 4.6, W - 2 * M, 7, "F"); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(a.v === null ? 150 : 30); doc.text(T(a.name), M + 2, y);
      doc.setFont("helvetica", "normal"); doc.text(T(a.txt), M + 36, y);
      doc.setTextColor(120); doc.setFontSize(8.5); doc.text(T(a.tip), M + 86, y);
    });

    /* À travailler + activité, en deux colonnes */
    y += 12; var colW = (W - 2 * M - 6) / 2, x2 = M + colW + 6, y0 = y;
    function box(x, title, lines) {
      var h = 9 + lines.length * 5.6 + 2;
      doc.setDrawColor(220); doc.setLineWidth(0.3); doc.roundedRect(x, y0 - 5, colW, h, 2.5, 2.5, "S");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(55, 36, 101); doc.text(title, x + 4, y0 + 1);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(50);
      lines.forEach(function (t, j) { doc.text(doc.splitTextToSize(T(t), colW - 8)[0], x + 4, y0 + 7.5 + j * 5.6); });
      return h;
    }
    var work = [];
    if (r.cur) work.push("Son « " + soundName(r.cur.id) + " »" + (r.blocked ? " : difficulté" + (r.err !== null && r.answers >= 6 ? " (" + r.err + " % d'erreurs)" : " (" + r.readTries + " lectures sans réussite)") : " : en cours"));
    studentConf(r).forEach(function (c) { work.push("Confond « " + c[0].replace(" / ", " » et « ") + " » (" + c[1] + " fois)"); });
    if (!work.length) work.push("Rien de particulier.");
    var days = r.series, act = [
      "Temps de travail : " + Math.round(r.secs / 60) + " min",
      "Séries d'écoute : " + days[0] + " · de dictée : " + days[1],
      "Lectures : " + days[2] + " · parties de jeu : " + days[3],
      r.idle === null ? "Pas encore d'activité" : "Dernière activité : " + (r.idle <= 0 ? "aujourd'hui" : r.idle === 1 ? "hier" : "il y a " + r.idle + " jours")
    ];
    var h1 = box(M, "À travailler", work), h2 = box(x2, "Activité (7 derniers jours)", act);
    y = y0 + Math.max(h1, h2) + 4;

    /* Lectures récentes */
    if (ax.flu.length && y < 270) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30); doc.text("Lectures récentes", M, y + 2); y += 3;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(60);
      ax.flu.slice(0, 5).forEach(function (x) {
        if (y > 280) return; y += 5.4;
        doc.text(T(frDate(Number(x.ts) || Date.now()) + "   Son « " + soundName(x.sound) + " » · " + (KN[x.k] || "lecture") + (x.src === "train" ? " (entraînement)" : "")), M + 2, y);
        doc.text(Math.round(Number(x.mclm)) + " corrects / min", W - M - 2, y, { align: "right" });
      });
    }
    doc.setFontSize(7.5); doc.setTextColor(140);
    doc.text(T("zoodelecture.fr · Phonologie, écoute, dictée, lecture, compréhension : part des " + r.total + " sons du programme de la classe. Vitesse : 3 dernières lectures."), M, 290);
  }
  function makeFiches(list, cls, btn, file) {
    if (!C.pdfMake) return;
    C.pdfMake({ btn: btn, msgId: "pedaMsg", wait: "Création de la fiche…", file: file,
      title: list.length > 1 ? "Fiches de « " + cls.name + " »" : "Fiche de " + list[0].s.nickname,
      ok: "📄 " + (list.length > 1 ? list.length + " fiches de suivi pour « " + cls.name + " »" : "Fiche de suivi de " + list[0].s.nickname) + " : le PDF s’ouvre (sinon, regardez dans vos téléchargements).",
      build: function (doc) { var ref = classRef(); list.forEach(function (r, i) { if (i) doc.addPage(); drawFiche(doc, r, cls, ref); }); } });
  }
  /* valeur médiane de chaque axe dans la classe (au moins 3 élèves) */
  function classRef() {
    var rows = state.rows || []; if (rows.length < 3) return null;
    var all = rows.map(function (r) { return axes(r).list; });
    return all[0].map(function (a, i) { return a.v === null ? null : median(all.map(function (l) { return l[i].v || 0; })); });
  }


  /* ===== Remédiation (jalon 7) : « + Assigner » un exercice à un élève =====
     Réglage enseignant settings.assign[élève] = { type, sons, pair, ts } (enregistré avec les autres réglages, aucune migration).
     Le Zoo de l’élève le met en tête de sa mission jusqu’à réussite et note le résultat dans progress.remed = { ts, done, ok, tries, hist }. */
  window.pedaAssign = window.pedaAssign || {};
  var RT = { phono: "🖼️ J’entends", listen: "👂 J’écoute", write: "✏️ J’écris", compr: "🧩 Je comprends", tiles: "🎹 Tuiles des sons" };
  var RT_HELP = { phono: "trouver les images où l’on entend le son", listen: "reconnaître le son entendu parmi des écritures", write: "écrire ce que dit la voix", compr: "lire des mots et trouver leur image", tiles: "toucher une écriture et éviter celle qu’il confond (20 bonnes tuiles)" };
  var TILE_PAIRS = [["b", "d"], ["p", "q"], ["m", "n"], ["f", "v"], ["t", "d"], ["ou", "on"], ["on", "an"], ["an", "in"], ["ch", "j"], ["é", "è"]];
  function exo() { return window.ZooExo || {}; }
  function remedCan(type, id) {
    var X = exo(), skip = X.LISTEN_SKIP || {};
    if (type === "tiles" || skip[id]) return false;
    if (type === "phono") return !!(X.phonoKey && X.phonoKey(id));
    if (type === "compr") return !!(X.comprHas && X.comprHas(id, soundsOrder().map(function (x) { return x.id; })));
    return true;
  }
  function q2(t) { return "« " + t + " »"; }
  function asgLabel(a) {
    if (!a) return "";
    if (a.type === "tiles") return RT.tiles + " " + q2(a.pair[0]) + " et " + q2(a.pair[1]);
    return RT[a.type] + " · " + (a.sons || []).map(function (id) { return q2(soundName(id)); }).join(", ");
  }
  /* État d’un exercice donné : réussi (date), commencé (étapes faites), pas encore */
  function asgState(a, rm) {
    rm = rm && typeof rm === "object" ? rm : {};
    var same = a && Number(rm.ts) === Number(a.ts), done = same && rm.done && typeof rm.done === "object" ? Object.keys(rm.done).length : 0;
    return { ok: same && Number(rm.ok) > 0 ? Number(rm.ok) : 0, done: done, total: a ? (a.type === "tiles" ? 1 : (a.sons || []).length) : 0, tries: same ? Number(rm.tries) || 0 : 0 };
  }
  function shortDate(ts) { var d = new Date(ts); return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function asgStatusText(a, rm) {
    var st = asgState(a, rm);
    if (st.ok) return "✅ réussi le " + shortDate(st.ok);
    if (st.done) return "⏳ commencé (" + st.done + "/" + st.total + ")";
    return st.tries ? "⏳ pas encore réussi (" + plur(st.tries, "essai", "essais") + ")" : "⏳ pas encore fait";
  }
  /* Proposition automatique : la confusion la plus fréquente (tuiles), sinon l’exercice où l’élève se trompe le plus sur son son en cours */
  function propose(r) {
    var best = null;
    Object.keys(r.conf || {}).forEach(function (k) {
      var p = String(k).split("|"), n = Number(r.conf[k]) || 0;
      if (p.length !== 2 || !p[0] || !p[1] || p[0] === "∅" || p[1] === "∅" || p[0] === p[1] || p[0].length > 4 || p[1].length > 4 || n < 2) return;
      if (!best || n > best.n) best = { n: n, pair: p };
    });
    if (best) return { a: { type: "tiles", pair: best.pair }, why: "confond " + q2(best.pair[0]) + " et " + q2(best.pair[1]) + " (" + plur(best.n, "fois", "fois") + ")" };
    var order = soundsOrder(), cur = r.cur || order[order.length - 1];
    if (!cur) return null;
    var c = (((r.p || {}).stats || {}).snd || {})[cur.id] || {}, top = null, NM = { p: "phono", l: "listen", w: "write", c: "compr" };
    ["p", "l", "w", "c"].forEach(function (k) {
      var v = Array.isArray(c[k]) ? c[k] : null, n = v ? (Number(v[0]) || 0) + (Number(v[1]) || 0) : 0, e = n >= 3 ? (Number(v[1]) || 0) / n : -1;
      if (e > 0 && remedCan(NM[k], cur.id) && (!top || e > top.e)) top = { e: e, t: NM[k] };
    });
    var t = top ? top.t : (remedCan("listen", cur.id) ? "listen" : null);
    if (!t) return null;
    return { a: { type: t, sons: [cur.id] }, why: top ? Math.round(top.e * 100) + " % d’erreurs à " + RT[t].slice(RT[t].indexOf(" ") + 1) + " sur le son " + q2(soundName(cur.id)) : "son en cours : " + q2(soundName(cur.id)) };
  }
  function assignEditor(r, repaint) {
    var box = mk("div", "pb-assign"), cur = window.pedaAssign[r.s.id], prop = propose(r);
    var pick = cur ? JSON.parse(JSON.stringify(cur)) : (prop ? JSON.parse(JSON.stringify(prop.a)) : { type: "listen", sons: [] });
    box.append(mk("h4", null, "🎯 Exercice pour " + r.s.nickname));
    if (prop) {
      var tip = mk("p", "pb-as-tip"); tip.append(mk("b", null, "💡 Proposé : "), document.createTextNode(asgLabel(prop.a) + " — " + prop.why + "."));
      box.append(tip);
    }
    var types = mk("div", "pb-chips"), what = mk("div", "pb-as-what"), help = mk("p", "muted pb-as-help");
    box.append(mk("p", "pb-as-lbl", "1. L’exercice"), types, help, what);
    Object.keys(RT).forEach(function (t) {
      var b = mk("button", "pb-chip", RT[t]); b.type = "button"; b.dataset.t = t;
      b.onclick = function () { if (pick.type === t) return; pick = t === "tiles" ? { type: t, pair: prop && prop.a.type === "tiles" ? prop.a.pair.slice() : ["b", "d"] } : { type: t, sons: (pick.sons || []).filter(function (id) { return remedCan(t, id); }) }; paint(); };
      types.append(b);
    });
    var msg = mk("p", "pb-as-msg"); msg.setAttribute("role", "status");
    function paint() {
      Array.prototype.forEach.call(types.children, function (b) { var on = b.dataset.t === pick.type; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
      help.textContent = "L’élève va " + RT_HELP[pick.type] + ". L’exercice passe en tête de sa mission jusqu’à ce qu’il soit réussi.";
      what.innerHTML = ""; msg.textContent = "";
      var chips = mk("div", "pb-chips");
      if (pick.type === "tiles") {
        what.append(mk("p", "pb-as-lbl", "2. Les écritures confondues"));
        var pairs = [];
        Object.keys(r.conf || {}).sort(function (a, b) { return r.conf[b] - r.conf[a]; }).forEach(function (k) { var p = k.split("|"); if (p.length === 2 && p[0] && p[1] && p[0] !== "∅" && p[1] !== "∅" && p[0].length <= 4 && p[1].length <= 4 && p[0] !== p[1]) pairs.push(p); });
        TILE_PAIRS.forEach(function (p) { pairs.push(p); });
        var seen = {}, shown = 0;
        pairs.forEach(function (p) {
          var key = p.slice().sort().join("|"); if (seen[key] || shown >= 10) return; seen[key] = 1; shown++;
          var on = pick.pair && pick.pair.slice().sort().join("|") === key;
          var b = mk("button", "pb-chip" + (on ? " on" : ""), (on ? pick.pair : p).join(" / ")); b.type = "button"; b.setAttribute("aria-pressed", String(on));
          b.onclick = function () { pick.pair = on ? pick.pair : p.slice(); paint(); };
          chips.append(b);
        });
        what.append(chips);
        var sw = mk("div", "pb-as-swap"), sb = mk("button", "secondary", "⇄ Inverser"); sb.type = "button";
        sw.append(mk("span", null, "L’élève touche " + q2(pick.pair[0]) + " ; " + q2(pick.pair[1]) + " est le piège."), sb);
        sb.onclick = function () { pick.pair = [pick.pair[1], pick.pair[0]]; paint(); };
        what.append(sw);
      } else {
        what.append(mk("p", "pb-as-lbl", "2. Le ou les sons (3 au plus)"));
        var order = soundsOrder(), ci = r.cur ? order.findIndex(function (x) { return x.id === r.cur.id; }) : order.length - 1;
        order.forEach(function (x, i) {
          if (!remedCan(pick.type, x.id)) return;
          var on = (pick.sons || []).indexOf(x.id) >= 0;
          if (i > ci + 1 && !on) return;   /* les sons déjà vus, le son en cours et le suivant */
          var b = mk("button", "pb-chip" + (on ? " on" : "") + (r.cur && x.id === r.cur.id ? " cur" : ""), x.label || x.id); b.type = "button"; b.setAttribute("aria-pressed", String(on));
          if (r.cur && x.id === r.cur.id) b.title = "Son en cours";
          b.onclick = function () {
            var l = pick.sons || (pick.sons = []), k = l.indexOf(x.id);
            if (k >= 0) l.splice(k, 1); else if (l.length >= 3) { msg.textContent = "3 sons au plus : retirez-en un d’abord."; return; } else l.push(x.id);
            paint();
          };
          chips.append(b);
        });
        if (!chips.children.length) what.append(mk("p", "muted", "Aucun son n’a encore cet exercice pour cet élève."));
        else what.append(chips);
      }
    }
    paint();
    var acts = mk("div", "pb-as-acts");
    var ok = mk("button", null, cur ? "✅ Remplacer l’exercice" : "✅ Donner l’exercice"); ok.type = "button";
    ok.onclick = function () {
      var a = pick.type === "tiles" ? { type: "tiles", pair: pick.pair.slice(0, 2), ts: Date.now() } : { type: pick.type, sons: (pick.sons || []).slice(0, 3), ts: Date.now() };
      if (a.type !== "tiles" && !a.sons.length) { msg.textContent = "Choisissez au moins un son."; return; }
      window.pedaAssign[r.s.id] = a;
      if (C.queueSave) C.queueSave("pedaSave");
      r.asg = a; repaint();
      var m = $("pedaMsg"); if (m) m.textContent = "🎯 Exercice donné à " + r.s.nickname + " : " + asgLabel(a) + ". Il apparaîtra en tête de sa mission à sa prochaine connexion.";
    };
    var no = mk("button", "secondary", "Annuler"); no.type = "button";
    no.onclick = function () { box.remove(); };
    acts.append(ok, no);
    if (cur) {
      var rm = mk("button", "secondary pb-as-del", "Retirer l’exercice"); rm.type = "button";
      rm.onclick = function () { delete window.pedaAssign[r.s.id]; if (C.queueSave) C.queueSave("pedaSave"); r.asg = null; repaint(); };
      acts.append(rm);
    }
    box.append(msg, acts);
    return box;
  }

  window.ZooPeda = { asgLabel: asgLabel, asgState: asgState, asgStatusText: asgStatusText, render: render, analyse: analyse, classify: classify, axes: axes, drawFiche: drawFiche, state: state };
})();
