/* Espace « Pédagogie » de l'espace enseignant (enseignants.html) : tableau de bord d'une classe.
   Fiche élève PDF : toile d’araignée des 6 compétences (bouton « 📄 Fiche » de chaque ligne, « 📄 Fiches de suivi » pour la classe).
   Écran « Ma classe » : 1. À faire aujourd’hui (lectures à écouter, élèves bloqués, exercices donnés, confusions, absents)
   2. Mes élèves : une ligne par élève (filtres, 🌍, + Assigner, 📄 Fiche), « Détails » ouvre ses cartes sous la ligne (studentDetail d’enseignants.html)
   3. La classe en chiffres (7 derniers jours). Tous les chiffres d’un élève viennent d’analyse().
   Données : student_progress.progress (résultats, écoute, dictée, stats = mesures du Zoo, voir zoo-connecte.html statsClean).
   Le grand script de enseignants.html est fermé (fonction) : il donne ce qu’il faut par window.ZooPedaCtx() (client, utilisateur, rôle, élèves, classes, sons, voy2Fix, pl, showTab, printLoginCards, queueSave). */
(function () {
  "use strict";
  var LATE = 3, AHEAD = 3, INACTIVE_DAYS = 7, DAY = 864e5;
  var state = { classId: null, filter: "all", rows: [], open: {}, seq: 0, flash: null }, C = {};
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
    /* son en cours réussi en entraînement (⭐) mais pas encore envoyé : l’élève peut s’enregistrer pour la médaille */
    var canRec = !!cur && !curSent && res.some(function (r) { return r.sound === cur.id && r.src === "train" && !r.void && !r.short && !(Number(r.fraud) > 0) && thr[r.k] && (Number(r.mclm) || 0) >= thr[r.k]; });
    var flu = res.filter(function (r) { return !r.void && !r.short && !(Number(r.fraud) > 0) && r.src !== "adj" && r.src !== "train" && Number(r.mclm) > 0; })
      .sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); })[0] || null;
    return { s: s, row: row || null, canRec: canRec, p: p, nValid: nValid, total: order.length, cur: cur, err: err, answers: answers, readTries: readTries, blocked: blocked,
      recs: recs.length, recTabs: recs.map(function (x) { return Number(x.tab) || 0; }).filter(function (n, i, a) { return n && a.indexOf(n) === i; }).sort(function (a, b) { return a - b; }), curSent: curSent, secs: secs, series: series, idle: idle, flu: flu, conf: st.conf && typeof st.conf === "object" ? st.conf : {}, measured: Object.keys(days).length > 0,
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

  function hhmm(d) { return d.getHours() + " h " + ("0" + d.getMinutes()).slice(-2); }
  /* Retour sur la page (autre onglet, tablette remise en marche…) : « Ma classe » visible et chargée il y a plus d'une minute → on recharge */
  document.addEventListener("visibilitychange", function () {
    var box = document.getElementById("pedaBoard");
    if (document.visibilityState !== "visible" || !box || !box.offsetParent || !state.loadedAt || Date.now() - state.loadedAt < 60000) return;
    render().catch(function () {});
  });
  async function render() {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    var box = $("pedaBoard");
    if (!box || !C.currentUser) return;
    var classes = myClasses();
    box.replaceChildren();
    box.classList.remove("pb-scope");
    if (!classes.length || !(C.allStudents || []).length) {
      var empty = mk("div", "pb-empty");
      empty.append(mk("p", null, "Vos élèves apparaîtront ici dès que vous aurez créé votre classe et inscrit vos élèves."));
      var go = mk("button", "primary", "📚 Créer ma classe et mes élèves"); go.type = "button";
      go.onclick = function () { var b = document.querySelector('[data-sub-btn="classes"]'); if (b) b.click(); else C.showTab("eleves"); };
      empty.append(go); box.append(empty); return;
    }
    if (!state.classId || !classes.some(function (c) { return c.id === state.classId; })) state.classId = classes[0].id;
    var cls = classes.find(function (c) { return c.id === state.classId; });
    var studs = C.allStudents.filter(function (s) { return s.class_id === cls.id && !s.ghosted_at; });

    /* En-tête : classe + actions */
    var head = mk("div", "pb-head"); box.classList.add("pb-scope");
    var left = mk("div", "pb-class");
    if (classes.length > 1) {
      var sel = mk("select", "pb-select"); sel.setAttribute("aria-label", "Classe");
      classes.forEach(function (c) { var o = mk("option", null, c.name + (c.teacher_id !== C.currentUser.id ? " (autre enseignant)" : "")); o.value = c.id; sel.append(o); });
      sel.value = cls.id; sel.onchange = function () { state.classId = sel.value; state.open = {}; render(); };
      left.append(mk("span", "pb-lbl", "Classe"), sel);
    } else left.append(mk("span", "pb-lbl", "Classe"), mk("strong", "pb-cname", "📚 " + cls.name));
    left.append(mk("span", "pb-count", plur(studs.length, "élève", "élèves")));
    head.append(left);
    var acts = mk("div", "pb-acts");
    if (studs.length && C.printLoginCards) {
      var pr = mk("button", "secondary", "🖨️ Codes pour la maison"); pr.type = "button"; pr.title = "Fiches de connexion à donner aux familles";
      pr.onclick = function () { C.printLoginCards(cls, "pedaMsg", pr); };
      acts.append(pr);
    }
    /* Les résultats ne se rechargent pas tout seuls pendant qu'on reste sur l'écran : bouton « Actualiser » + heure de la dernière mise à jour
       (et rechargement automatique quand on revient sur la page, voir plus bas) */
    var rl = mk("button", "secondary", "↻ Actualiser"); rl.type = "button"; rl.title = "Recharger les derniers résultats des élèves";
    rl.onclick = function () { render(); };
    var when = mk("span", "pb-updated", ""); when.setAttribute("aria-live", "polite"); when.style.cssText = "font-size:.85em;align-self:center;white-space:nowrap";
    acts.prepend(rl, when);
    head.append(acts);
    box.append(head, mk("p", "msg", null));
    box.lastChild.id = "pedaMsg"; box.lastChild.setAttribute("role", "status");
    if (state.notice) { box.lastChild.textContent = state.notice; state.notice = null; }

    if (!studs.length) { box.append(mk("p", "muted", "Aucun élève dans cette classe.")); return; }
    var wait = mk("p", "muted", "Chargement…"); box.append(wait);
    var seq = ++state.seq;
    var q = await C.client.from("student_progress").select("student_id,progress,updated_at,pending_coins").in("student_id", studs.map(function (s) { return s.id; }));
    if (seq !== state.seq) return;   /* un chargement plus récent a pris la main */
    wait.remove();
    if (q.error) { box.append(mk("p", "msg err", "Impossible de charger les résultats : " + (q.error.message || ""))); return; }
    state.loadedAt = Date.now(); when.textContent = "À jour à " + hhmm(new Date());
    var map = {}; (q.data || []).forEach(function (r) { map[r.student_id] = r; });
    var rows = studs.map(function (s) { return analyse(s, map[s.id]); });
    var med = classify(rows);
    state.rows = rows; state.cls = cls;
    if (C.pdfMake) {
      var fa = mk("button", "secondary", "📄 Fiches de suivi (PDF)"); fa.type = "button"; fa.title = "Une fiche par élève, avec sa toile des 6 compétences";
      fa.onclick = function () { makeFiches(rows.slice().sort(function (a, b) { return String(a.s.nickname).localeCompare(b.s.nickname); }), cls, fa, "fiches-suivi-" + (C.pdfSlug(cls.name) || "classe")); };
      acts.append(fa);
    }
    box.append(todo(rows), matrix(rows), rhythm(rows, med));
  }

  /* Nom d’élève cliquable : ouvre son détail sous sa ligne */
  function nameBtns(list) {
    var w = mk("span", "pb-names");
    list.forEach(function (r) {
      var b = mk("button", "pb-name", r.s.nickname); b.type = "button"; b.title = "Voir les résultats de " + r.s.nickname;
      b.onclick = function () { openDetail(r.s.id); };
      w.append(b);
    });
    return w;
  }
  function openDetail(id) {
    state.open[id] = true;
    var r = (state.rows || []).find(function (x) { return x.s.id === id; });
    if (r && !keep(r, state.filter)) state.filter = "all";
    if (state.paint) state.paint();
    var line = document.querySelector('.pb-row[data-sid="' + id + '"]');
    if (line) line.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  /* 1. À faire aujourd’hui : lectures à écouter, élèves bloqués, exercices donnés pas encore faits, confusions, inactifs */
  function todo(rows) {
    var sec = section("📌 À faire aujourd’hui", null);
    var grid = mk("div", "pb-alerts"), n = 0;
    function card(cls, title, list, tip, btn) {
      var c = mk("div", "pb-alert " + cls); c.append(mk("strong", null, title), nameBtns(list));
      if (tip) c.append(mk("small", "pb-tip", tip));
      if (btn) c.append(btn);
      grid.append(c); n++;
    }
    /* lectures enregistrées à écouter */
    var recs = rows.filter(function (r) { return r.recs > 0; }), nRec = recs.reduce(function (a, r) { return a + r.recs; }, 0);
    if (nRec) {
      var eb = mk("button", "pb-alert-btn", "🎧 Écouter maintenant"); eb.type = "button";
      eb.onclick = function () { C.showTab("ecouter"); };
      var where = recs.map(function (r) { return r.s.nickname + " : " + (r.recTabs.length ? "📱 tablette " + r.recTabs.join(", ") : "tablette sans numéro"); }).join(" · ");
      card("a-rec", "🎧 " + plur(nRec, "lecture à écouter", "lectures à écouter") + " pour la médaille", recs, where, eb);
    }
    /* élèves bloqués, regroupés par son */
    var bySound = {};
    rows.filter(function (r) { return r.blocked && !r.inactive; }).forEach(function (r) { (bySound[r.cur.id] = bySound[r.cur.id] || []).push(r); });
    Object.keys(bySound).sort(function (a, b) { return bySound[b].length - bySound[a].length; }).slice(0, 4).forEach(function (id) {
      var list = bySound[id];
      card("a-block", "⚠️ " + plur(list.length, "élève bloque", "élèves bloquent") + " sur le son « " + soundName(id) + " »", list,
        "Beaucoup d’erreurs, ou plusieurs lectures sans réussite. Vous pouvez lui donner un exercice (« Donner un exercice »).");
    });
    /* exercices donnés, pas encore réussis */
    var asg = rows.filter(function (r) { return r.asg && !asgState(r.asg, r.remed).ok; });
    if (asg.length) card("a-asg", "🎯 " + plur(asg.length, "exercice donné pas encore réussi", "exercices donnés pas encore réussis"), asg, null);
    /* confusions fréquentes dans la classe (écoute, dictée, tuiles) */
    var conf = {};
    rows.forEach(function (r) {
      Object.keys(r.conf).forEach(function (k) {
        var pk = pairKey(k), v = Number(r.conf[k]) || 0; if (!pk || !v) return;
        var c = conf[pk] || (conf[pk] = { total: 0, who: {} });
        c.total += v; c.who[r.s.id] = (c.who[r.s.id] || 0) + v;
      });
    });
    Object.keys(conf).map(function (k) {
      var who = rows.filter(function (r) { return (conf[k].who[r.s.id] || 0) >= 2; });
      return { k: k, total: conf[k].total, who: who };
    }).filter(function (c) { return c.who.length; }).sort(function (a, b) { return b.who.length - a.who.length || b.total - a.total; }).slice(0, 3).forEach(function (c) {
      card("a-conf", "🔀 Confondent « " + c.k.replace(" / ", " » et « ") + " »", c.who, "Au moins 2 fois. Un exercice « Tuiles des sons » peut aider (« Donner un exercice »).");
    });
    var idle = rows.filter(function (r) { return r.inactive; });
    if (idle.length) card("a-idle", "💤 " + plur(idle.length, "élève n’est pas venu", "élèves ne sont pas venus") + " depuis " + INACTIVE_DAYS + " jours ou plus", idle, null);
    if (!n) grid.append(mk("p", "pb-calm", "✅ Rien d’urgent aujourd’hui."));
    sec.append(grid);
    if (!rows.some(function (r) { return r.measured; })) sec.append(mk("p", "muted pb-note", "Les erreurs, les confusions et le temps de travail sont mesurés depuis le 17 novembre 2026 : ces informations se rempliront au fil des séances."));
    return sec;
  }

  /* 3. La classe en chiffres */
  function rhythm(rows, med) {
    var sec = section("📊 La classe en chiffres", "7 derniers jours");
    var active = rows.filter(function (r) { return r.secs > 0; });
    var avg = active.length ? Math.round(rows.reduce(function (a, r) { return a + r.secs; }, 0) / rows.length / 60) : null;
    var series = [0, 0, 0, 0]; rows.forEach(function (r) { for (var i = 0; i < 4; i++) series[i] += r.series[i]; });
    var total = rows.length ? rows[0].total : 0;
    var tiles = mk("div", "pb-tiles");
    [["⏱️", avg === null ? "—" : avg + " min", "Temps de travail moyen par élève"],
     ["🏅", Math.round(med) + " sur " + total, "Sons validés par l’élève du milieu de la classe"],
     ["💤", String(rows.filter(function (r) { return r.inactive; }).length), "Élèves pas venus depuis " + INACTIVE_DAYS + " jours ou plus"],
     ["📊", String(series[0] + series[1] + series[2]), "Exercices faits : 👂 " + series[0] + " écoute · ✏️ " + series[1] + " dictée · 📖 " + series[2] + " lecture"]
    ].forEach(function (t) { var d = mk("div", "pb-tile"); d.append(mk("span", "pb-ico", t[0]), mk("b", null, t[1]), mk("small", null, t[2])); tiles.append(d); });
    sec.append(tiles);
    return sec;
  }

  /* 2. Mes élèves : une ligne par élève, le détail s’ouvre sous la ligne */
  var FILTERS = [["all", "Tous"], ["late", "En difficulté"], ["ahead", "En avance"], ["idle", "Pas venus"], ["allo", "Apprennent le français"]];
  function keep(r, f) { return f === "all" || (f === "late" && r.color === "red") || (f === "ahead" && r.ahead && !r.inactive) || (f === "idle" && r.inactive) || (f === "allo" && r.allo); }
  function matrix(rows) {
    var sec = section("🧒 Mes élèves", null);
    var bar = mk("div", "pb-filters"); bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Filtrer les élèves");
    var list = mk("div", "pb-list");
    function paint() {
      list.replaceChildren();
      var shown = rows.filter(function (r) { return keep(r, state.filter); });
      var rank = { red: 0, yellow: 1, green: 2, idle: 3 };
      shown.sort(function (a, b) { return rank[a.color] - rank[b.color] || a.nValid - b.nValid || String(a.s.nickname).localeCompare(b.s.nickname); });
      if (!shown.length) list.append(mk("p", "muted", "Aucun élève dans ce filtre."));
      shown.forEach(function (r) { var ln = line(r, paint); list.append(ln); if (state.open[r.s.id]) list.append(detail(r)); });
      Array.prototype.forEach.call(bar.children, function (b) { var on = b.dataset.f === state.filter; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
    }
    state.paint = paint;
    FILTERS.forEach(function (f) {
      var n = rows.filter(function (r) { return keep(r, f[0]); }).length;
      if (f[0] === "allo" && !n) return;   /* filtre affiché seulement s’il sert */
      var b = mk("button", "pb-filter", f[1] + " (" + n + ")"); b.type = "button"; b.dataset.f = f[0];
      b.onclick = function () { state.filter = f[0]; paint(); };
      bar.append(b);
    });
    var legend = mk("p", "muted pb-legend", "🔴 en difficulté (bloqué, ou " + LATE + " sons de retard sur l’élève du milieu de la classe) · 🟡 avance normalement · 🟢 en avance de " + AHEAD + " sons ou plus · ⚪ pas venu depuis " + INACTIVE_DAYS + " jours");
    if (rows.some(function (r) { return r.s.teacher_id === C.currentUser.id; })) {
      sec.append(mk("p", "muted", "Pour réviser ou travailler une difficulté, choisissez « Donner un exercice » sur la ligne de l’élève."));
    }
    sec.append(bar, legend, list);
    paint();
    return sec;
  }
  function whenText(r) { return r.idle === null ? "jamais venu" : r.idle <= 0 ? "aujourd’hui" : r.idle === 1 ? "hier" : "il y a " + r.idle + " jours"; }
  function line(r, repaint) {
    var dot = { red: "🔴", yellow: "🟡", green: "🟢", idle: "⚪" }[r.color];
    var d = mk("div", "pb-row c-" + r.color); d.dataset.sid = r.s.id;
    var who = mk("div", "pb-who");
    who.append(mk("span", "pb-dot", dot), mk("strong", null, r.s.nickname));
    var al = mk("button", "pb-allo" + (r.allo ? " on" : ""), "🌍"); al.type = "button";
    al.title = r.allo ? "Élève qui apprend le français (toucher pour retirer)" : "Marquer : élève qui apprend le français";
    al.setAttribute("aria-label", al.title);
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
    if (r.idle === null) txt = "Pas encore commencé";
    else if (!r.cur) txt = "Tous les sons validés 🎉";
    else txt = "Son « " + soundName(r.cur.id) + " » · " + (r.blocked ? (r.err !== null && r.answers >= 6 ? "bloqué (" + r.err + " % d’erreurs)" : "bloqué (" + r.readTries + " lectures sans réussite)") : "en cours");
    prog.append(pbar, mk("small", null, r.nValid + " " + (r.nValid > 1 ? "sons validés" : "son validé") + " sur " + r.total + " · " + txt));
    /* pastilles : dernière venue, lectures à écouter, peut s’enregistrer, exercice donné */
    var chips = mk("div", "pb-tags");
    chips.append(mk("span", "pb-tag" + (r.inactive ? " warn" : ""), "🕒 " + whenText(r)));
    if (r.recs) chips.append(mk("span", "pb-tag alert", "🎧 " + plur(r.recs, "lecture à écouter", "lectures à écouter") + (r.recTabs.length ? " · 📱 " + r.recTabs.join(", ") : "")));
    else if (r.canRec) { var cr = mk("span", "pb-tag next", "🎙 Peut enregistrer sa lecture"); cr.title = "Réussi en entraînement : " + r.s.nickname + " peut s’enregistrer (« 🎙 Je m’enregistre » dans son Zoo) pour gagner sa médaille 🏅."; chips.append(cr); }
    if (r.asg) { var ast = asgState(r.asg, r.remed); chips.append(mk("span", "pb-tag " + (ast.ok ? "ok" : "asg"), "🎯 " + asgLabel(r.asg) + " · " + asgStatusText(r.asg, r.remed))); }
    prog.append(chips);
    var flu = mk("div", "pb-flu", r.flu ? Math.round(Number(r.flu.mclm)) + "/min" : "—");
    flu.title = r.flu ? "Dernière lecture validée : " + Math.round(Number(r.flu.mclm)) + " " + (r.flu.k === "s" ? "syllabes lues" : "mots lus") + " par minute (" + ({ s: "syllabes", m: "mots", t: "texte" }[r.flu.k] || "lecture") + ")" : "Aucune lecture validée pour l’instant";
    var open = !!state.open[r.s.id];
    var act = mk("button", "pb-see pb-detail-btn" + (open ? " on" : ""), open ? "▲ Masquer" : "▼ Détails"); act.type = "button"; act.title = "Résultats de " + r.s.nickname;
    act.setAttribute("aria-expanded", String(open));
    act.onclick = function () { if (state.open[r.s.id]) delete state.open[r.s.id]; else state.open[r.s.id] = true; repaint(); };
    var btns = mk("div", "pb-btns"); btns.append(act);
    /* « Donner un exercice » : seulement pour ses propres élèves (le réglage est celui de l’enseignant de la classe) */
    if (C.currentUser && r.s.teacher_id === C.currentUser.id) {
      var asb = mk("button", "secondary pb-see pb-asb", r.asg && !asgState(r.asg, r.remed).ok ? "🎯 Gérer l’exercice" : "🎯 Donner un exercice"); asb.type = "button";
      asb.title = "Donner un exercice à " + r.s.nickname + " (en tête de sa mission jusqu’à réussite)";
      asb.setAttribute("aria-expanded", "false");
      asb.onclick = function () {
        var nx = d.nextElementSibling;
        if (nx && nx.classList.contains("pb-assign")) { nx.remove(); asb.setAttribute("aria-expanded", "false"); return; }
        d.parentNode.insertBefore(assignEditor(r, repaint), d.nextSibling); asb.setAttribute("aria-expanded", "true");
      };
      btns.append(asb);
    }
    d.append(who, time, prog, flu, btns);
    return d;
  }
  /* Détail d’un élève, sous sa ligne : les cartes d’enseignants.html (studentDetail) */
  function detail(r) {
    var w = mk("div", "pb-detail"); w.dataset.sid = r.s.id;
    var m = mk("p", "msg pb-dmsg"); m.setAttribute("role", "status");
    if (state.flash && state.flash.id === r.s.id) { m.textContent = state.flash.text; m.classList.toggle("err", !!state.flash.err); state.flash = null; }
    w.append(m);
    var fa = mk("div", "pd-actions pb-dacts");
    if (C.pdfMake) {
      var fi = mk("button", "secondary pb-see", "📄 Fiche de suivi (PDF)"); fi.type = "button"; fi.title = "Fiche de suivi de " + r.s.nickname + " à imprimer : toile des 6 compétences";
      fi.onclick = function () { makeFiches([r], state.cls, fi, "fiche-suivi-" + (C.pdfSlug(r.s.nickname) || "eleve")); };
      fa.append(fi);
    }
    /* Un seul endroit par élève : renommer, suspendre, supprimer (et, pour l'admin, changer de classe) sont ici, dans « ⋯ » */
    if (C.studentActions && (C.currentRole === "admin" || r.s.teacher_id === C.currentUser.id)) {
      fa.append(C.studentActions(r.s, function (text, err) {
        if (err) { m.textContent = text; m.classList.add("err"); return; }
        if (window.ZooPedaCtx) C = window.ZooPedaCtx();
        var still = (C.allStudents || []).some(function (x) { return x.id === r.s.id && !x.ghosted_at && x.class_id === state.classId; });
        if (still) state.flash = { id: r.s.id, text: text, err: false }; else { delete state.open[r.s.id]; state.notice = text; }
        render();
      }));
    }
    if (fa.children.length) w.append(fa);
    if (!C.studentDetail) return w;
    w.append(C.studentDetail(r.s, r.row, function (text, err, reload) {
      if (reload) { state.flash = { id: r.s.id, text: text, err: err }; render(); return; }
      m.textContent = text; m.classList.toggle("err", !!err);
    }));
    return w;
  }
  function section(title, sub) {
    var s = mk("section", "pb-sec");
    var h = mk("h3", "pb-h"); h.append(document.createTextNode(title));
    if (sub) h.append(mk("small", null, " · " + sub));
    s.append(h);
    return s;
  }

  /* ===== Fiche élève PDF (jalon 3) : toile d'araignée à 6 axes + points à travailler =====
     Chaque axe va de 0 à 100 %. Phonologie et compréhension : null tant que ces exercices n'existent pas dans le Zoo
     (progress.phono.done / progress.compr.done, mêmes clés que l'écoute et la dictée, seront lues automatiquement). */
  var KN = { s: "syllabes", m: "mots", t: "texte" };
  /* Semaines d’école depuis la rentrée (1er septembre), sur 36 : vacances approchées (Toussaint, Noël, hiver, printemps ; l’écart entre zones est d’une semaine au plus).
     La toile compare l’élève à ce qui est attendu à cette date (demandé par Gabriel le 18/11/2026) : 100 % = programme suivi au rythme de l’année. */
  var YEAR_WEEKS = 36, WEB_MAX = 150;
  function schoolWeeks(now) {
    var d = new Date(now || Date.now()), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1, n = 0;
    var off = [[new Date(y, 9, 17), new Date(y, 10, 2)], [new Date(y, 11, 19), new Date(y + 1, 0, 4)], [new Date(y + 1, 1, 13), new Date(y + 1, 2, 1)], [new Date(y + 1, 3, 10), new Date(y + 1, 3, 26)]];
    for (var t = new Date(y, 8, 1); t <= d; t.setDate(t.getDate() + 1)) {
      var wd = t.getDay(); if (wd === 0 || wd === 6) continue;
      if (off.some(function (o) { return t >= o[0] && t < o[1]; })) continue; n++;
    }
    return Math.max(1, Math.min(YEAR_WEEKS, n / 5));
  }
  function expected(total) { return Math.max(1, Math.round(total * schoolWeeks() / YEAR_WEEKS)); }
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
    var flu = (Array.isArray(p.results) ? p.results : []).filter(function (x) { return x && !x.void && !x.short && !(Number(x.fraud) > 0) && x.src !== "adj" && x.src !== "train" && Number(x.mclm) > 0 && thr[x.k]; })
      .sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); });
    var last3 = flu.slice(0, 3), sp = last3.length ? Math.round(last3.reduce(function (a, x) { return a + Math.min(1, Number(x.mclm) / thr[x.k]); }, 0) * 100 / last3.length) : null;
    var exp = expected(tot), pct = function (n) { return n === null ? null : Math.round(n * 100 / exp); };
    var sons = function (n) { return n === null ? "pas encore mesuré" : n + " " + (n > 1 ? "sons" : "son") + " · " + exp + " attendus"; };
    return { flu: flu, exp: exp, list: [
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

  /* Toile d’araignée (partagée avec la fiche du calcul) : list = [{ name, v }] avec v en % de l’attendu ; bord = 150 %, cercle vert = 100 % (attendu) */
  function drawWeb(doc, T, list, ref, cx, cy) {
    var R = 39, n = list.length, F = function (v) { return Math.max(0.03, Math.min(WEB_MAX, v || 0) / WEB_MAX); };
    function pt(i, f) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; }
    function poly(pts, style) { var d = []; for (var i = 1; i < pts.length; i++) d.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]); doc.lines(d, pts[0][0], pts[0][1], [1, 1], style, true); }
    doc.setLineWidth(0.2); doc.setDrawColor(200);
    [50, 150].forEach(function (v) { var ps = []; for (var i = 0; i < n; i++) ps.push(pt(i, v / WEB_MAX)); poly(ps, "S"); });
    for (var i = 0; i < n; i++) { var e = pt(i, 1); doc.line(cx, cy, e[0], e[1]); }
    /* surface de l’élève d’abord, en transparence : le cercle vert et les pointillés restent visibles par-dessus */
    var vals = []; list.forEach(function (a, i) { vals.push(pt(i, F(a.v))); });
    var gs = doc.GState ? function (o) { try { doc.setGState(new doc.GState({ opacity: o, "stroke-opacity": 1 })); } catch (e) {} } : function () {};
    gs(0.55); doc.setFillColor(190, 170, 245); poly(vals, "F"); gs(1);
    var att = []; for (var j = 0; j < n; j++) att.push(pt(j, 100 / WEB_MAX));
    doc.setDrawColor(46, 155, 100); doc.setLineWidth(0.7); poly(att, "S");
    doc.setFontSize(7); doc.setTextColor(150); doc.text("50", cx + 1, cy - R / 3 - 0.8); doc.text("150 %", cx + 1, cy - R - 0.8);
    doc.setTextColor(46, 125, 80); doc.text("attendu", cx + 1, cy - R * 2 / 3 - 0.8);
    if (ref) {
      var rp = []; ref.forEach(function (v, i) { rp.push(pt(i, F(v))); });
      doc.setDrawColor(150); doc.setLineWidth(0.4); doc.setLineDashPattern([1.2, 1.2], 0); poly(rp, "S"); doc.setLineDashPattern([], 0);
    }
    doc.setDrawColor(91, 33, 182); doc.setLineWidth(0.7); poly(vals, "S");
    list.forEach(function (a, i) {
      var p = vals[i]; if (a.v !== null) { doc.setFillColor(91, 33, 182); doc.circle(p[0], p[1], 1.1, "F"); }
      var l = pt(i, 1.17), al = Math.abs(l[0] - cx) < 2 ? "center" : (l[0] > cx ? "left" : "right");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(a.v === null ? 160 : 30);
      doc.text(T(a.name), l[0], l[1] + (l[1] < cy - 5 ? -2 : (l[1] > cy + 5 ? 4 : 1)), { align: al });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(a.v === null ? 160 : 90);
      doc.text(a.v === null ? "(bientôt)" : a.v > WEB_MAX ? "> " + WEB_MAX + " %" : a.v + " %", l[0], l[1] + (l[1] < cy - 5 ? 2.2 : (l[1] > cy + 5 ? 8.2 : 5.2)), { align: al });
    });
  }

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
    drawWeb(doc, T, ax.list, ref, W / 2, 108);

    /* légende */
    doc.setLineWidth(0.7); doc.setDrawColor(91, 33, 182); doc.line(M, 66, M + 8, 66);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(70); doc.text(T(r.s.nickname), M + 10, 67);
    if (ref) { doc.setLineWidth(0.4); doc.setDrawColor(150); doc.setLineDashPattern([1.2, 1.2], 0); doc.line(M, 71, M + 8, 71); doc.setLineDashPattern([], 0); doc.text(T("Élève moyen (sans absents ni extrêmes)"), M + 10, 72); }
    doc.setLineWidth(0.7); doc.setDrawColor(46, 155, 100); doc.line(M, 76, M + 8, 76); doc.setTextColor(70); doc.text(T("Attendu à cette date (semaine " + Math.round(schoolWeeks()) + " sur " + YEAR_WEEKS + ")"), M + 10, 77);

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
        doc.text(T(frDate(Number(x.ts) || Date.now()) + "   Son « " + soundName(x.sound) + " » · " + (KN[x.k] || "lecture")), M + 2, y);
        doc.text(Math.round(Number(x.mclm)) + (x.k === "s" ? " syllabes / min" : " mots / min"), W - M - 2, y, { align: "right" });
      });
    }
    doc.setFontSize(7.5); doc.setTextColor(140);
    doc.text(T("zoodelecture.fr · 100 % = attendu à cette date : " + ax.exp + " sons sur les " + r.total + " de l’année (semaine " + Math.round(schoolWeeks()) + " sur " + YEAR_WEEKS + "). Vitesse : 3 dernières lectures / seuil."), M, 290);
  }
  function makeFiches(list, cls, btn, file) {
    if (!C.pdfMake) return;
    C.pdfMake({ btn: btn, msgId: "pedaMsg", wait: "Création de la fiche…", file: file,
      title: list.length > 1 ? "Fiches de « " + cls.name + " »" : "Fiche de " + list[0].s.nickname,
      ok: "📄 " + (list.length > 1 ? list.length + " fiches de suivi pour « " + cls.name + " »" : "Fiche de suivi de " + list[0].s.nickname) + " : le PDF s’ouvre (sinon, regardez dans vos téléchargements).",
      build: function (doc) { var ref = classRef(); list.forEach(function (r, i) { if (i) doc.addPage(); drawFiche(doc, r, cls, ref); }); } });
  }
  /* Élève moyen de la classe (demandé par Gabriel le 18/11/2026) : sans les absents (pas venus depuis 7 jours ou jamais), puis, pour chaque axe,
     sans les 2 plus faibles ni les 2 plus forts (1 et 1 de 5 à 7 élèves) ; moyenne du reste. Au moins 3 élèves présents. Sert aussi au calcul. */
  function trimMean(v) {
    v = v.filter(function (x) { return x !== null && x !== undefined; }).sort(function (a, b) { return a - b; });
    if (!v.length) return null; var k = v.length >= 8 ? 2 : v.length >= 5 ? 1 : 0, w = v.slice(k, v.length - k);
    return Math.round(w.reduce(function (a, x) { return a + x; }, 0) / w.length);
  }
  function refOf(lists) {
    if (lists.length < 3) return null;
    return lists[0].map(function (a, i) { return trimMean(lists.map(function (l) { return l[i].v; })); });
  }
  function classRef() {
    return refOf((state.rows || []).filter(function (r) { return !r.inactive; }).map(function (r) { return axes(r).list; }));
  }


  /* ===== Remédiation (jalon 7) : « Donner un exercice » un exercice à un élève =====
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
    if (!top) return null;
    return { a: { type: top.t, sons: [cur.id] }, why: Math.round(top.e * 100) + " % d’erreurs à " + RT[top.t].slice(RT[top.t].indexOf(" ") + 1) + " sur le son " + q2(soundName(cur.id)) };
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

  /* « Mes classes » › « Voir mes élèves » : ouvrir Ma classe sur cette classe */
  function pick(id) { if (id && id !== state.classId) { state.classId = id; state.open = {}; state.filter = "all"; } }
  window.ZooPeda = { pick: pick, asgLabel: asgLabel, asgState: asgState, asgStatusText: asgStatusText, render: render, openDetail: openDetail, analyse: analyse, classify: classify, axes: axes, drawFiche: drawFiche, drawWeb: drawWeb, refOf: refOf, schoolWeeks: schoolWeeks, YEAR_WEEKS: YEAR_WEEKS, state: state };
})();
