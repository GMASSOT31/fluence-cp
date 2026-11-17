/* Espace « Pédagogie » de l'espace enseignant (enseignants.html) : tableau de bord d'une classe.
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
    /* son en cours : taux d'erreur à l'écoute et en dictée, lectures sans réussite */
    var err = null, answers = 0, readTries = 0;
    if (cur) {
      var c = snd[cur.id] || {}, ok = 0, ko = 0;
      ["l", "w"].forEach(function (a) { if (Array.isArray(c[a])) { ok += Number(c[a][0]) || 0; ko += Number(c[a][1]) || 0; } });
      answers = ok + ko; err = answers ? Math.round(ko * 100 / answers) : null;
      readTries = readOn[cur.id] || 0;
    }
    var blocked = !!cur && ((answers >= 6 && err >= 40) || readTries >= 3);
    var flu = res.filter(function (r) { return !r.void && !r.short && !(Number(r.fraud) > 0) && r.src !== "adj" && Number(r.mclm) > 0; })
      .sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); })[0] || null;
    return { s: s, p: p, nValid: nValid, total: order.length, cur: cur, err: err, answers: answers, readTries: readTries, blocked: blocked,
      secs: secs, series: series, idle: idle, flu: flu, conf: st.conf && typeof st.conf === "object" ? st.conf : {}, measured: Object.keys(days).length > 0,
      allo: window.pedaAllo.indexOf(s.id) >= 0 };
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
    state.rows = rows;
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
    else txt = "Son «\u00a0" + soundName(r.cur.id) + "\u00a0» · " + (r.blocked ? (r.err !== null && r.answers >= 6 ? "bloqué (" + r.err + " % d’erreurs)" : "bloqué (" + r.readTries + " lectures sans réussite)") : "en cours");
    prog.append(pbar, mk("small", null, r.nValid + "/" + r.total + " · " + txt));
    var flu = mk("div", "pb-flu", r.flu ? Math.round(Number(r.flu.mclm)) + "/min" : "—");
    flu.title = r.flu ? "Dernière lecture : " + Math.round(Number(r.flu.mclm)) + " corrects par minute (" + ({ s: "syllabes", m: "mots", t: "texte" }[r.flu.k] || "lecture") + ")" : "Pas encore de lecture";
    var act = mk("button", "secondary pb-see", "Voir"); act.type = "button"; act.title = "Voir les détails de " + r.s.nickname;
    act.onclick = function () { openDetails(r.s); };
    d.append(who, time, prog, flu, act);
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

  window.ZooPeda = { render: render, analyse: analyse, classify: classify, state: state };
})();
