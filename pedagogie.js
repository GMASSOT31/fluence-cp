/* Espace « Pédagogie » de l'espace enseignant (enseignants.html) : tableau de bord d'une classe.
   Fiche élève PDF : toile d’araignée des 7 compétences (bouton « 📄 Fiche » de chaque ligne, « 📄 Fiches de suivi » pour la classe).
   Écran « Ma classe » : 1. À faire aujourd’hui (lectures à écouter, élèves bloqués, exercices donnés, confusions, absents)
   2. Mes élèves : une ligne par élève (filtres, 🌍, 🎯 Donner un exercice, 📄 Fiche), « Détails » ouvre ses cartes sous la ligne (studentDetail d’enseignants.html)
   3. La classe en chiffres (7 derniers jours). Tous les chiffres d’un élève viennent d’analyse().
   Données : student_progress.progress (résultats, écoute, dictée, stats = mesures du Zoo, voir zoo-connecte.html statsClean).
   Le grand script de enseignants.html est fermé (fonction) : il donne ce qu’il faut par window.ZooPedaCtx() (client, utilisateur, rôle, élèves, classes, sons, voy2Fix, pl, showTab, printLoginCards, queueSave). */
(function () {
  "use strict";
  var LATE = 3, AHEAD = 3, INACTIVE_DAYS = 7, DAY = 864e5;
  var state = { classId: null, filter: "all", rows: [], open: {}, folded: {}, seq: 0, flash: null, focus: null, content: null }, C = {};
  function $(id) { return document.getElementById(id); }
  window.pedaAllo = window.pedaAllo || [];
  /* lectures enregistrées validées ou à refaire depuis la fiche (24/11/2026, demandé par Gabriel) : settings.recDec = { idLecture: {sid, ok, c?, ts} },
     appliquées par le Zoo de l'élève à sa prochaine connexion (zoo-connecte.html applyRecDecisions), puis retirées ici quand la lecture n'est plus en attente */
  window.pedaRecDec = window.pedaRecDec || {};   /* élèves allophones (réglage enseignant « allo ») */

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
    var now = Date.now(), week = [], secs = 0, exercises = 0, successes = 0, series = [0, 0, 0, 0];
    for (var i = 0; i < 7; i++) week.push(dayKey(now - i * DAY));
    week.forEach(function (k) { var d = days[k]; if (Array.isArray(d)) { secs += Number(d[0]) || 0; exercises += Number(d[6]) || 0; successes += Number(d[5]) || 0; for (var j = 1; j <= 4; j++) series[j - 1] += Number(d[j]) || 0; } });
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
      recs: recs.filter(function (x) { return !window.pedaRecDec[x.id]; }).length, recTabs: recs.filter(function (x) { return !window.pedaRecDec[x.id]; }).map(function (x) { return Number(x.tab) || 0; }).filter(function (n, i, a) { return n && a.indexOf(n) === i; }).sort(function (a, b) { return a - b; }), curSent: curSent, secs: secs, exercises: exercises, successes: successes, series: series, idle: idle, flu: flu, conf: st.conf && typeof st.conf === "object" ? st.conf : {}, measured: Object.keys(days).length > 0,
      allo: window.pedaAllo.indexOf(s.id) >= 0, asg: currentAssignment(s.id), remed: p.remed && typeof p.remed === "object" ? p.remed : null };
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

  /* ✏️ discret à côté du prénom (fiche de l'élève, Lecture et Calcul) : corriger une faute d'orthographe du prénom ; le serveur refuse un prénom déjà pris dans la classe */
  function renameBtn(st, own, done) {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    if (!C.renameStudent || !(own || C.currentRole === "admin")) return document.createTextNode("");
    var b = mk("button", "pb-rename", "✏️"); b.type = "button"; b.title = "Corriger le prénom de " + st.nickname; b.setAttribute("aria-label", b.title);
    b.onclick = function () { C.renameStudent(st, [b], done); };
    return b;
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
      var hasClass = classes.length > 0; if (hasClass) go.textContent = "🧒 Ajouter mes élèves";
      go.onclick = function () { if (C.openClassForm) C.openClassForm(hasClass ? "ajout" : "classes", hasClass ? classes[0] : null); else C.showTab("eleves"); };
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
    head.append(left);
    var acts = mk("div", "pb-acts");
    if (studs.length && C.printLoginCards) {
      var pr = mk("button", "secondary", "🖨️ QR codes"); pr.type = "button"; pr.title = "Fiches de connexion à donner aux familles";
      pr.onclick = function () { C.printLoginCards(cls, "pedaMsg", pr); };
      acts.append(pr);
    }
    /* Les résultats ne se rechargent pas tout seuls pendant qu'on reste sur l'écran : bouton « Actualiser » + heure de la dernière mise à jour
       (et rechargement automatique quand on revient sur la page, voir plus bas) */
    var rl = mk("button", "secondary pb-refresh", "↻"); rl.type = "button"; rl.title = "Actualiser les résultats"; rl.setAttribute("aria-label", rl.title);
    rl.onclick = function () { render(); };
    var when = mk("span", "pb-updated", ""); when.setAttribute("aria-live", "polite"); when.setAttribute("aria-label", "Heure de la dernière actualisation");
    left.append(rl);
    if (C.classMenu) left.append(C.classMenu(cls));   /* ⋯ Classe : code, ajouter un élève, créer une classe, renommer… (ancien onglet « Mes classes ») */
    head.append(when);
    head.append(acts);
    box.append(head, mk("p", "msg", null));
    box.lastChild.id = "pedaMsg"; box.lastChild.setAttribute("role", "status");
    if (state.notice) { box.lastChild.textContent = state.notice; state.notice = null; }

    if (!studs.length) { box.append(mk("p", "muted", "Aucun élève dans cette classe.")); return; }
    var wait = mk("p", "muted", "Chargement…"); box.append(wait);
    var seq = ++state.seq;
    var reads = await Promise.all([
      C.client.from("student_progress").select("student_id,progress,updated_at,pending_coins").in("student_id", studs.map(function (s) { return s.id; })),
      Promise.resolve(C.client.rpc("teacher_class_vocabulary", { p_class: cls.id })).catch(function () { return {}; })
    ]);
    var q = reads[0];
    if (seq !== state.seq) return;   /* un chargement plus récent a pris la main */
    wait.remove();
    if (q.error) { box.append(mk("p", "msg err", "Impossible de charger les résultats : " + (q.error.message || ""))); return; }
    state.loadedAt = Date.now(); when.textContent = hhmm(new Date());
    var map = {}; (q.data || []).forEach(function (r) { map[r.student_id] = r; });
    var rows = studs.map(function (s) { return analyse(s, map[s.id]); });
    classify(rows);
    state.rows = rows; state.cls = cls;
    /* décisions déjà prises en compte par le Zoo de l'élève (la lecture n'est plus en attente) : on les retire */
    Object.keys(window.pedaRecDec).forEach(function (id) {
      var d = window.pedaRecDec[id], row = rows.filter(function (x) { return x.s.id === d.sid; })[0];
      if (row && !pendingRecs(row.p || {}).some(function (v) { return v.id === id; })) delete window.pedaRecDec[id];
    });
    state.classVocab = Array.isArray(reads[1].data) ? reads[1].data : [];
    if (C.pdfMake) {
      var fa = mk("button", "secondary"); fa.append(mk("span", "pb-pdf-icon", "PDF"), document.createTextNode(" Araignées de suivi")); fa.type = "button"; fa.title = "Une fiche par élève, avec sa toile des 7 compétences";
      fa.onclick = function () { makeFiches(rows.slice().sort(function (a, b) { return String(a.s.nickname).localeCompare(b.s.nickname); }), cls, fa, "fiches-suivi-" + (C.pdfSlug(cls.name) || "classe")); };
      acts.append(fa);
    }
    state.content = mk("div", "pb-content"); box.append(state.content);
    draw();
  }
  /* Contenu sous l'en-tête : la fiche d'un élève (state.focus) ou la vue de la classe (chiffres, à faire, liste des élèves) */
  function draw() {
    var c = state.content, rows = state.rows || [];
    if (!c) return;
    c.replaceChildren();
    var r = state.focus && rows.find(function (x) { return x.s.id === state.focus; });
    if (r) { c.append(studentView(r, rows)); return; }
    state.focus = null;
    c.append(rhythm(rows), todo(rows), matrix(rows));
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
  function scrollToStudent(line) {
    if (!line) return;
    var row = line.getBoundingClientRect(), offset = 0;
    document.querySelectorAll("header.hero, .teacher-header").forEach(function (header) {
      var bounds = header.getBoundingClientRect(), style = window.getComputedStyle(header);
      if (style.position === "sticky" && bounds.right > row.left && bounds.left < row.right) {
        offset = Math.max(offset, (parseFloat(style.top) || 0) + bounds.height);
      }
    });
    window.scrollTo({
      top: window.scrollY + row.top - offset - 12,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
    });
  }
  function openDetail(id) {
    state.focus = id; draw();
    var top = document.getElementById("pedaBoard");
    if (top) scrollToStudent(top);
    return;
    state.open[id] = true;
    var r = (state.rows || []).find(function (x) { return x.s.id === id; });
    if (r && !keep(r, state.filter)) state.filter = "all";
    if (state.paint) state.paint();
    var students = document.querySelector("#pedaBoard .pb-students");
    if (students) students.open = true;
    var line = document.querySelector('#pedaBoard .pb-row[data-sid="' + id + '"]');
    scrollToStudent(line);
  }

  /* 1. À faire aujourd’hui : lectures à écouter, élèves bloqués, exercices donnés pas encore faits, confusions, inactifs */
  function todo(rows) {
    var sec = section("📌 À faire aujourd’hui", null);
    var grid = mk("div", "pb-alerts"), n = 0, groups = {};
    function card(cls, title, list, tip, btn) {
      var c = mk("div", "pb-alert " + cls); c.append(mk("strong", null, title), nameBtns(list));
      if (tip) c.append(mk("small", "pb-tip", tip));
      if (btn) c.append(btn);
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(c); n++;
    }
    /* lectures enregistrées à écouter */
    var recs = rows.filter(function (r) { return r.recs > 0; }), nRec = recs.reduce(function (a, r) { return a + r.recs; }, 0);
    if (nRec) {
      var byTab = {};
      recs.forEach(function (r) { (r.recTabs.length ? r.recTabs : [0]).forEach(function (t) { (byTab[t] = byTab[t] || []).push(r.s.nickname); }); });
      var where = Object.keys(byTab).sort(function (a, b) { return (Number(a) || 99) - (Number(b) || 99); }).map(function (t) { return (Number(t) ? "📱 Tablette " + t : "📱 Sans numéro") + " : " + byTab[t].join(", "); }).join(" · ");
      /* valider ou faire relire ici, sans ouvrir chaque fiche (24/11/2026, demandé par Gabriel) : mêmes lignes que dans la fiche (recItem) */
      var mine = recs.filter(function (r) { return C.currentUser && r.s.teacher_id === C.currentUser.id; }), panel = null;
      if (mine.length) {
        panel = mk("div", "pb-recpanel"); var tg = mk("button", "secondary", state.recOpen ? "▲ Masquer" : "✅ Valider ou faire relire ici"); tg.type = "button";
        tg.setAttribute("aria-expanded", String(!!state.recOpen));
        var ul = mk("ul", "pb-now"); ul.hidden = !state.recOpen;
        mine.forEach(function (r) {
          pendingRecs(r.p || {}).filter(function (v) { return !window.pedaRecDec[v.id]; }).forEach(function (v) {
            var li = recItem(r, v, true); li.firstChild.textContent = "👤 " + r.s.nickname + " · " + li.firstChild.textContent.replace(/ — à écouter.*$/, ""); ul.append(li);
          });
        });
        tg.onclick = function () { state.recOpen = !state.recOpen; ul.hidden = !state.recOpen; tg.textContent = state.recOpen ? "▲ Masquer" : "✅ Valider ou faire relire ici"; tg.setAttribute("aria-expanded", String(state.recOpen)); };
        panel.append(tg, ul);
      }
      card("a-rec", "🎧 " + plur(nRec, "lecture à écouter", "lectures à écouter") + " pour la médaille", recs, where + " — sur la tablette de l’élève : « 🎧 Mon maître(sse) écoute »" + (mine.length ? ", ou décidez ici." : "."), panel);
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
    var reminders = vocabularyReminders(rows);
    if (reminders.length) {
      var review = compactDetails("🗓️ Vocabulaire à réviser · " + reminders.length, "pb-alert-group", state.classId + ":vocab-review", state.folded);
      reminders.forEach(function (reminder) { review.append(vocabularyReminderCard(reminder)); });
      grid.append(review); n++;
    }
    [["a-asg","🎯 Exercices donnés"], ["a-conf","🔀 Confusions"], ["a-rec","🎧 Lectures à écouter"],
     ["a-block","⚠️ Élèves bloqués"], ["a-idle","💤 En sommeil"]].forEach(function (group) {
      if (!groups[group[0]]) return;
      var key = state.classId + ":" + group[0];
      var fold = compactDetails(group[1], "pb-alert-group", key, state.folded);
      groups[group[0]].forEach(function (c) { fold.append(c); });
      grid.append(fold);
    });
    if (!n) grid.append(mk("p", "pb-calm", "✅ Rien d’urgent aujourd’hui."));
    sec.append(grid);
    if (!rows.some(function (r) { return r.measured; })) sec.append(mk("p", "muted pb-note", "Les erreurs, les confusions et le temps de travail sont mesurés depuis le 17 novembre 2026 : ces informations se rempliront au fil des séances."));
    return sec;
  }

  /* 3. La classe en chiffres */
  function rhythm(rows) {
    var sec = section("📊 La classe en chiffres", "7 derniers jours");
    var active = rows.filter(function (r) { return r.secs > 0; });
    var avg = active.length ? Math.round(active.reduce(function (a, r) { return a + r.secs; }, 0) / active.length / 60) : null;
    var series = [0, 0, 0, 0]; rows.forEach(function (r) { for (var i = 0; i < 4; i++) series[i] += r.series[i]; });
    var practising = rows.filter(function (r) { return r.secs > 0 || r.exercises > 0 || r.series.slice(0, 3).some(Boolean); });
    var mean = practising.some(function (r) { return r.exercises > 0; }) ? Math.round(10 * practising.reduce(function (a, r) { return a + r.successes; }, 0) / practising.length) / 10 : null;
    var tiles = mk("div", "pb-tiles");
    [["⏱️", avg === null ? "—" : avg + " min", "Temps moyen par élève actif"],
     ["🏅", mean === null ? "—" : mean.toLocaleString("fr-FR"), "Exercices réussis en moyenne par élève actif"],
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
    var sec = compactDetails("🧒 Les élèves · " + rows.length, "pb-sec pb-students", state.classId + ":students", state.folded);
    var bar = mk("div", "pb-filters"); bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Filtrer les élèves");
    var list = mk("div", "pb-kids");
    function paint() {
      list.replaceChildren();
      var shown = rows.filter(function (r) { return keep(r, state.filter); });
      var rank = { red: 0, yellow: 1, green: 2, idle: 3 };
      shown.sort(function (a, b) { return String(a.s.nickname).localeCompare(b.s.nickname); });
      if (!shown.length) list.append(mk("p", "muted", "Aucun élève dans ce filtre."));
      var dots = { red: "🔴", yellow: "🟡", green: "🟢", idle: "⚪" };
      shown.forEach(function (r) {
        var b = mk("button", "pb-kid c-" + r.color); b.type = "button"; b.title = "Voir la fiche de " + r.s.nickname;
        b.append(mk("span", "pb-dot", dots[r.color]), mk("span", "pb-kname", r.s.nickname));
        if (trackOf(r.s.id) === "gs") { var tg = mk("span", "pb-gs", "GS"); tg.title = "Parcours de lecture : GS (les lettres)"; b.append(tg); }
        b.onclick = function () { openDetail(r.s.id); };
        list.append(b);
      });
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
    sec.append(bar, list, legend);
    var bulk = trackBulk(rows);
    if (bulk) sec.append(bulk);
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
    if (trackOf(r.s.id) === "gs") { var gsP = mk("span", "pb-gs", "GS"); gsP.title = "Parcours de lecture : GS (les lettres)"; who.append(gsP); }
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
      var fi = mk("button", "secondary pb-see", "📄 Fiche de suivi (PDF)"); fi.type = "button"; fi.title = "Fiche de suivi de " + r.s.nickname + " à imprimer : toile des 7 compétences";
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
    w.append(trackBox(r));
    if (trackOf(r.s.id) === "gs" || (r.p && r.p.gs && r.p.gs.series && r.p.gs.series.length)) w.append(gsCard(r));
    if (!C.studentDetail) return w;
    w.append(C.studentDetail(r.s, r.row, function (text, err, reload) {
      if (reload) { state.flash = { id: r.s.id, text: text, err: err }; render(); return; }
      m.textContent = text; m.classList.toggle("err", !!err);
    }));
    return w;
  }
  /* ===== Parcours GS / CP / CE1 (docs/parcours-gs) : réglage settings.tracks[élève] = {lecture:"gs"|"cp"} ; absent = CP ===== */
  window.pedaTracks = window.pedaTracks || {};
  /* dom = "lecture" (défaut) ou "calcul" ; settings.tracks[élève] = {lecture:"gs", calcul:"gs"} ; absent = CP */
  /* parcours prêts par matière : le CE1 n'existe pour l'instant qu'en calcul (docs/parcours-ce1) */
  var READY = { lecture: { gs: true, cp: true }, calcul: { gs: true, cp: true, ce1: true } };
  function trackOf(sid, dom) { var t = window.pedaTracks[sid], v = t && t[dom || "lecture"]; return v && v !== "cp" && READY[dom || "lecture"][v] ? v : "cp"; }
  function trkCls(v) { return v === "cp" ? "pb-cp" : v === "ce1" ? "pb-gs pb-ce1" : "pb-gs"; }
  function calcOn() { return !!window.CalcTeacher; }   /* le Zoo de Calcul n'est proposé qu'aux comptes qui y ont accès */
  function setTrack(sid, dom, to) {
    var t = window.pedaTracks[sid] || {};
    if (to === "cp") delete t[dom]; else t[dom] = to;
    if (Object.keys(t).length) window.pedaTracks[sid] = t; else delete window.pedaTracks[sid];
  }
  var DOM_NAME = { lecture: "lecture", calcul: "calcul" };
  /* Choix du parcours d'un élève (fiche Lecture et fiche Calcul). after : redessin (sinon celui de Ma classe Lecture) ; doms : domaines montrés */
  function trackBox(r, after, doms) {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    var box = mk("div", "pb-track pb-track2"), own = C.currentUser && r.s.teacher_id === C.currentUser.id;
    (doms || (calcOn() ? ["lecture", "calcul"] : ["lecture"])).forEach(function (dom) {
      var line = mk("div", "pb-trkline"), cur = trackOf(r.s.id, dom);
      line.append(mk("strong", null, "Parcours de " + DOM_NAME[dom] + " : "));
      [["gs", "GS"], ["cp", "CP"], ["ce1", READY[dom].ce1 ? "CE1" : "CE1 · à venir"]].forEach(function (o) {
        var b = mk("button", "pb-trk" + (cur === o[0] ? " on" : ""), o[1]); b.type = "button";
        b.setAttribute("aria-pressed", String(cur === o[0]));
        if (!READY[dom][o[0]] || !own) b.disabled = true;
        if (!own) b.title = "Seul l’enseignant de la classe peut changer le parcours";
        b.onclick = function () {
          if (cur === o[0]) return;
          setTrack(r.s.id, dom, o[0]);
          if (C.queueSave) C.queueSave("pedaSave");
          var text = "Parcours de " + DOM_NAME[dom] + " de " + r.s.nickname + " : " + o[1] + ". Ses résultats sont tous gardés.";
          if (after) after(text); else { state.flash = { id: r.s.id, text: text, err: false }; render(); }
        };
        line.append(b);
      });
      box.append(line);
    });
    return box;
  }
  /* Suivi GS « Les lettres » : paliers validés, palier en cours, aide, dernières séries */
  function gsCard(r) {
    var D = window.ZooGSData, card = mk("div", "pb-gscard"), g = (r.p && r.p.gs) || {};
    if (!D) return card;
    var cfg = D.config(window.pedaGsCfg), items = D.path(cfg, r.s.nickname), st = D.lecState(g.lecture);
    var series = Array.isArray(g.series) ? g.series.filter(function (x) { return x && D.COMP[x.c || "cap"]; }) : [], sm = D.pathSummary(st, items, series), cur = sm.item;
    var label = { nouveau: "pas encore commencé", en_cours: "en cours", maitrise: "toutes les lettres sont validées", difficulte: "en difficulté" }[sm.status];
    card.append(mk("h4", null, "🔤 Les lettres (parcours GS)"));
    card.append(mk("p", null, sm.done + " étape" + (sm.done > 1 ? "s" : "") + " validée" + (sm.done > 1 ? "s" : "") + " sur " + sm.total + " · " + label));
    var bar = mk("div", "pb-bar"), fill = mk("i"); fill.style.width = sm.pct + "%"; bar.append(fill); card.append(bar);
    if (cur) { var cs = st[cur.comp]; card.append(mk("p", "muted", "En cours : " + D.stepLabel(cur.step, cur.comp) + " (" + cur.step.targets.join(" ") + ")" + (cs.ok ? " · " + cs.ok + " série réussie sur " + cfg[cur.comp].series : "") + (cs.aid ? " · 🤝 aide activée" : ""))); }
    /* une ligne par activité : étapes validées / total */
    var acts = mk("ul", "pb-gsacts");
    D.COMPS.lecture.forEach(function (k) {
      var its = items.filter(function (x) { return x.comp === k.id; }); if (!its.length) return;
      var n = its.filter(function (x) { return st[k.id].val[x.step.key]; }).length;
      acts.append(mk("li", null, (n === its.length ? "✅ " : n ? "🟡 " : "⚪ ") + k.nom + " : " + n + " / " + its.length));
    });
    card.append(acts);
    var det = mk("details", "pb-gsdet"); det.append(mk("summary", null, "Voir le détail"));
    var vals = items.filter(function (x) { return st[x.comp].val[x.step.key]; });
    if (vals.length) { var ul = mk("ul"); vals.forEach(function (x) { ul.append(mk("li", null, "✅ " + D.stepLabel(x.step, x.comp) + " (" + x.step.targets.join(" ") + ") — " + new Date(st[x.comp].val[x.step.key]).toLocaleDateString("fr-FR"))); }); det.append(ul); }
    var last = series.slice(-8).reverse();
    if (last.length) { var ul2 = mk("ul"); last.forEach(function (x) { ul2.append(mk("li", null, (x.ok ? "✓ " : "✗ ") + (D.COMP[x.c || "cap"] || {}).court + " · " + x.g + "/" + x.q + (x.aid ? " avec aide" : "") + " — " + new Date(x.ts).toLocaleDateString("fr-FR") + " " + new Date(x.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))); }); det.append(mk("p", "muted", "Dernières séries :"), ul2); }
    else det.append(mk("p", "muted", "Aucune série pour l’instant."));
    card.append(det);
    return card;
  }
  function gsSum(r) {
    var D = window.ZooGSData; if (!D) return null;
    var g = (r.p && r.p.gs) || {}, items = D.path(D.config(window.pedaGsCfg), r.s.nickname), st = D.lecState(g.lecture), series = Array.isArray(g.series) ? g.series : [];
    return { D: D, st: st, series: series, sm: D.pathSummary(st, items, series) };
  }
  /* ===== Changement de parcours de plusieurs élèves à la fois (cahier 3.2, étape D) : cases à cocher, parcours visé, confirmation.
     Seulement ses propres élèves ; les élèves non cochés ne changent pas ; aucun résultat effacé (progress.gs et les résultats CP restent). ===== */
  state.bulk = { sel: {}, to: "gs", dom: "lecture" };
  function trackBulk(rows, afterBulk, scope) {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    var own = (rows || []).filter(function (r) { return C.currentUser && r.s.teacher_id === C.currentUser.id; })
      .sort(function (a, b) { return String(a.s.nickname).localeCompare(b.s.nickname); });
    if (!own.length) return null;
    var B = state.bulk, box = compactDetails("🔀 Changer le parcours de plusieurs élèves", "pb-bulk", (scope || state.classId) + ":bulk", state.folded);
    var body = mk("div", "pb-bulk-body"), msg = mk("p", "msg"); msg.setAttribute("role", "status");
    function paint() {
      body.replaceChildren();
      if (!calcOn()) B.dom = "lecture";
      var doms = B.dom === "both" ? ["lecture", "calcul"] : [B.dom], what = B.dom === "both" ? "de lecture et de calcul" : "de " + DOM_NAME[B.dom];
      function badges(r) { var f = document.createDocumentFragment(); f.append(mk("span", trkCls(trackOf(r.s.id)), (calcOn() ? "📖 " : "") + trackOf(r.s.id).toUpperCase())); if (calcOn()) f.append(mk("span", trkCls(trackOf(r.s.id, "calcul")), "🔢 " + trackOf(r.s.id, "calcul").toUpperCase())); return f; }
      if (!doms.every(function (d) { return READY[d][B.to]; })) B.to = "cp";   /* CE1 : seulement pour le calcul */
      function isTo(r) { return doms.every(function (d) { return trackOf(r.s.id, d) === B.to; }); }
      body.append(mk("p", "muted", "Cochez les élèves, choisissez " + (calcOn() ? "la matière et " : "") + "leur parcours, puis confirmez. Les élèves non cochés ne changent pas. Tous les résultats sont gardés."));
      var tools = mk("div", "pb-bulk-tools"), all = mk("button", "secondary", "Tout cocher"), none = mk("button", "secondary", "Tout décocher");
      all.type = none.type = "button";
      all.onclick = function () { own.forEach(function (r) { B.sel[r.s.id] = true; }); paint(); };
      none.onclick = function () { B.sel = {}; paint(); };
      tools.append(all, none); body.append(tools);
      var grid = mk("div", "pb-bulk-kids");
      own.forEach(function (r) {
        var lab = mk("label", "pb-bulk-kid"), cb = mk("input"); cb.type = "checkbox"; cb.checked = !!B.sel[r.s.id];
        cb.onchange = function () { if (cb.checked) B.sel[r.s.id] = true; else delete B.sel[r.s.id]; count(); };
        lab.append(cb, mk("span", "pb-kname", r.s.nickname), badges(r));
        grid.append(lab);
      });
      body.append(grid);
      if (calcOn()) {
        var dm = mk("div", "pb-track"); dm.append(mk("strong", null, "Matière : "));
        [["lecture", "Lecture seule"], ["calcul", "Calcul seul"], ["both", "Les deux"]].forEach(function (o) {
          var b = mk("button", "pb-trk" + (B.dom === o[0] ? " on" : ""), o[1]); b.type = "button"; b.setAttribute("aria-pressed", String(B.dom === o[0]));
          b.onclick = function () { B.dom = o[0]; paint(); };
          dm.append(b);
        });
        body.append(dm);
      }
      var to = mk("div", "pb-track"); to.append(mk("strong", null, "Nouveau parcours " + what + " : "));
      [["gs", "GS"], ["cp", "CP"], ["ce1", B.dom === "calcul" ? "CE1" : "CE1 · calcul seulement"]].forEach(function (o) {
        var b = mk("button", "pb-trk" + (B.to === o[0] ? " on" : ""), o[1]); b.type = "button"; b.setAttribute("aria-pressed", String(B.to === o[0]));
        if (!doms.every(function (d) { return READY[d][o[0]]; })) b.disabled = true;
        b.onclick = function () { B.to = o[0]; paint(); };
        to.append(b);
      });
      body.append(to);
      var go = mk("button", "primary", ""); go.type = "button";
      var confirmBox = mk("div", "pb-bulk-confirm");
      function count() { var n = own.filter(function (r) { return B.sel[r.s.id]; }).length; go.textContent = "Passer " + plur(n, "élève", "élèves") + " en " + B.to.toUpperCase() + "…"; go.disabled = !n; confirmBox.replaceChildren(); }
      go.onclick = function () {
        var picked = own.filter(function (r) { return B.sel[r.s.id]; }), change = picked.filter(function (r) { return !isTo(r); }), label = B.to.toUpperCase();
        confirmBox.replaceChildren();
        if (!change.length) { confirmBox.append(mk("p", "muted", (picked.length > 1 ? "Ces élèves sont déjà" : "Cet élève est déjà") + " en " + label + ".")); return; }
        confirmBox.append(mk("p", null, "Passer en " + label + " pour " + (B.dom === "both" ? "la lecture et le calcul" : B.dom === "lecture" ? "la lecture" : "le calcul") + " : " + change.map(function (r) { return r.s.nickname; }).join(", ") + " (" + plur(change.length, "élève", "élèves") + ")." + (picked.length > change.length ? " Déjà en " + label + " : " + picked.filter(function (r) { return change.indexOf(r) < 0; }).map(function (r) { return r.s.nickname; }).join(", ") + "." : "")),
          mk("p", "muted", "Les autres élèves ne changent pas. " + (change.length > 1 ? "Leurs" : "Ses") + " résultats sont tous gardés : vous pourrez revenir en arrière à tout moment."));
        var yes = mk("button", "primary", "✅ Oui, appliquer"), no = mk("button", "secondary", "Annuler"); yes.type = no.type = "button";
        no.onclick = function () { confirmBox.replaceChildren(); };
        yes.onclick = function () {
          change.forEach(function (r) { doms.forEach(function (d) { setTrack(r.s.id, d, B.to); }); });
          if (C.queueSave) C.queueSave("pedaSave");
          B.sel = {};
          state.bulkMsg = "✅ Parcours " + what + " " + label + " pour " + change.map(function (r) { return r.s.nickname; }).join(", ") + ". " + (change.length > 1 ? "Leurs" : "Ses") + " résultats sont tous gardés.";
          if (afterBulk) afterBulk(); else draw();
        };
        var row = mk("div", "pb-bulk-tools"); row.append(yes, no); confirmBox.append(row);
        yes.focus();
      };
      body.append(go, confirmBox);
      count();
    }
    paint();
    if (state.bulkMsg) { msg.textContent = state.bulkMsg; state.bulkMsg = null; box.open = true; }
    box.append(msg, body);
    return box;
  }
  /* ===== Réglages du parcours GS (Pédagogie › Les activités › Du parcours de GS) : settings.gs.lecture (gs-data.js config), enregistrés tout seuls.
     Rien n'est perdu quand on change : les validations restent rangées par activité et par étape (progress.gs). ===== */
  /* settings.gs = {lecture, calcul} : on ne remplace que la partie modifiée (la Lecture ne doit jamais effacer les réglages du Calcul, et inversement) */
  function gsPut(dom, val) {
    var g = window.pedaGsCfg && typeof window.pedaGsCfg === "object" ? JSON.parse(JSON.stringify(window.pedaGsCfg)) : {};
    if (val) g[dom] = val; else delete g[dom];
    window.pedaGsCfg = Object.keys(g).length ? g : undefined;
  }
  /* ===== Réglages du parcours GS du CALCUL (Pédagogie du Calcul › Les exercices › « Du parcours de GS ») : settings.gs.calcul, enregistrés tout seuls.
     Le serveur lit le seuil et le nombre de séries d'affilée de ces réglages (migration 20261209). ===== */
  function gsCalcSettings(host) {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    var D = window.ZooGSData; if (!host) return;
    host.replaceChildren();
    if (!D || !D.calcConfig) { host.append(mk("p", "muted", "Réglages indisponibles : actualisez la page.")); return; }
    var cfg = D.calcConfig(window.pedaGsCfg), msg = mk("p", "msg"); msg.setAttribute("role", "status");
    var save = mk("p", "save-state"); save.id = "gsCalcSave"; save.setAttribute("role", "status");
    function commit(text) { cfg = D.calcConfig({ calcul: cfg }); gsPut("calcul", JSON.parse(JSON.stringify(cfg))); if (C.queueSave) C.queueSave("gsCalcSave"); paint(); msg.textContent = text || ""; }
    function num(label, val, lo, hi, set) {
      var l = mk("div", "pb-gsnum"), i = mk("input"); i.type = "number"; i.min = lo; i.max = hi; i.value = val; i.inputMode = "numeric"; i.setAttribute("aria-label", label);
      i.onchange = function () { var v = Math.round(Number(i.value)); set(isFinite(v) && i.value !== "" ? Math.max(lo, Math.min(hi, v)) : val); commit(); };
      l.append(mk("span", null, label), i); return l;
    }
    function paint() {
      var keep = msg.textContent;
      host.replaceChildren();
      host.append(mk("p", "muted", "Pour les élèves en parcours GS de calcul. Les nombres arrivent par étapes : de 1 à 3, de 1 à 5, puis de 0 à 9 (le zéro est présenté avec un exemple). Pour chaque étape : les chiffres, l’ordre, compter, comparer, puis construire une collection. Une étape est validée après les séries réussies d’affilée demandées ; après deux séries ratées, l’aide s’active (une série aidée ne valide jamais)."));
      var acts = mk("div", "pb-gsacts-set");
      D.COMPS.calcul.forEach(function (k) {
        var c = cfg[k.id], card = mk("div", "pb-gsact" + (c.on ? "" : " off")), head = mk("label", "pb-gscheck"), cb = mk("input");
        cb.type = "checkbox"; cb.checked = c.on;
        cb.onchange = function () {
          var others = D.COMPS.calcul.some(function (o) { return o.id !== k.id && cfg[o.id].on; });
          if (!cb.checked && !others) { cb.checked = true; msg.textContent = "Gardez au moins une activité."; return; }
          c.on = cb.checked; commit();
        };
        head.append(cb, mk("strong", null, k.nom)); card.append(head);
        if (c.on) {
          var nums = mk("div", "pb-gsnums");
          if (c.props) {
            var ordre = k.act === "ordre", pi = mk("input"), pl2 = mk("div", "pb-gsnum"), lab = ordre ? "Nombres à ranger" : "Choix proposés";
            pi.type = "text"; pi.value = c.props.join(" "); pi.inputMode = "numeric"; pi.setAttribute("aria-label", lab);
            pi.onchange = function () { c.props = pi.value.split(/[^0-9]+/).filter(Boolean).map(Number); commit(); };
            pl2.title = ordre ? "Une étape par longueur (de 3 à 6 nombres)" : "Une étape par nombre de choix (de 2 à 4)";
            pl2.append(mk("span", null, lab), pi); nums.append(pl2);
          }
          nums.append(num("Questions", c.questions, 4, 20, function (v) { c.questions = v; }),
            num("Réussite (%)", c.seuil, 50, 100, function (v) { c.seuil = v; }),
            num("Séries d’affilée", c.series, 1, 4, function (v) { c.series = v; }));
          card.append(nums);
          if (k.id === "compare") {
            var al = mk("label", "pb-gscheck"), ac = mk("input"); ac.type = "checkbox"; ac.checked = c.autant;
            ac.onchange = function () { c.autant = ac.checked; commit(); };
            al.append(ac, mk("span", null, "Ajouter une dernière étape « autant » (de 1 à 5)")); card.append(al);
          }
        }
        acts.append(card);
      });
      host.append(acts);
      var its = D.calcPath(cfg), ns = its.reduce(function (a, x) { return a + cfg[x.comp].series; }, 0);
      host.append(mk("p", "pb-gssum", "Avec ces réglages : " + its.length + " étapes, soit au moins " + ns + " séries réussies pour finir le parcours."));
      var pv = mk("div", "exercise-preview-actions"), sel = mk("select"); sel.setAttribute("aria-label", "Activité à visualiser");
      D.COMPS.calcul.filter(function (k) { return cfg[k.id].on; }).forEach(function (k) { sel.append(new Option(k.nom, k.id)); });
      var vb = mk("button", null, "Visualiser"); vb.type = "button";
      vb.onclick = function () { if (window.ZooExercisePreview) window.ZooExercisePreview("labo-calcul.html", { act: "gs", id: sel.value, settings: { gs: { calcul: JSON.parse(JSON.stringify(cfg)) } } }); };
      pv.append(sel, vb); host.append(pv);
      var rs = mk("button", "secondary", "↩️ Valeurs recommandées"); rs.type = "button";
      rs.onclick = function () { gsPut("calcul", null); cfg = D.calcConfig(null); if (C.queueSave) C.queueSave("gsCalcSave"); paint(); msg.textContent = "Valeurs recommandées rétablies. Les résultats des élèves sont gardés."; };
      host.append(rs, msg, save);
      msg.textContent = keep;
    }
    paint();
  }
  /* ===== Réglages du parcours CE1 du CALCUL (Pédagogie du Calcul › Les exercices › « Du parcours de CE1 ») : settings.ce1.calcul.nombres = étapes cochées
     (absent = toutes) ; la révision « jusqu'à 99 » est toujours proposée (déjà réussie au CP = pas refaite). Enregistré tout seul (docs/parcours-ce1). ===== */
  function ce1CalcSettings(host) {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    var E = window.CalcEngine; if (!host) return;
    host.replaceChildren();
    if (!E || !E.CE1) { host.append(mk("p", "muted", "Réglages indisponibles : actualisez la page.")); return; }
    var all = E.CE1.nombres.map(function (l) { return l.id; }), msg = mk("p", "msg"), save = mk("p", "save-state"); msg.setAttribute("role", "status"); save.id = "ce1CalcSave"; save.setAttribute("role", "status");
    function cur() { var c = window.pedaCe1Cfg && window.pedaCe1Cfg.calcul && window.pedaCe1Cfg.calcul.nombres; c = Array.isArray(c) ? c.filter(function (id) { return all.indexOf(id) >= 0; }) : []; return c.length ? c : all.slice(); }
    function put(list) {
      var c = window.pedaCe1Cfg || {};
      if (!list || list.length === all.length) delete c.calcul; else c.calcul = { nombres: list };
      window.pedaCe1Cfg = Object.keys(c).length ? c : undefined;
      if (C.queueSave) C.queueSave("ce1CalcSave");
    }
    function paint() {
      var keep = msg.textContent, on = cur();
      host.replaceChildren();
      host.append(mk("p", "muted", "Pour les élèves en parcours CE1 de calcul. 👂 Écouter jusqu’à 1 000 : la voix dit un nombre, l’élève touche son écriture en chiffres parmi 6. Programme de CE1 : « La centaine est abordée dès le début de la période 1 » ; « Au plus tard en période 2, les élèves travaillent avec des quantités et des nombres allant jusqu’à mille. » Les additions, soustractions et tables de multiplication du CE1 arrivent ensuite."));
      var ol = mk("ol", "calc-order"), rev = E.levelInfo("nombres", E.CE1.review), li0 = mk("li", "calc-step"), l0 = mk("label"), c0 = mk("input");
      c0.type = "checkbox"; c0.checked = true; c0.disabled = true; l0.append(c0, document.createTextNode(" " + rev.animal.e + " Révision : " + rev.label + " (toujours proposée, sautée si déjà réussie au CP)")); li0.append(l0); ol.append(li0);
      E.CE1.nombres.forEach(function (lv) {
        var li = mk("li", "calc-step"), lab = mk("label"), cb = mk("input"); cb.type = "checkbox"; cb.checked = on.indexOf(lv.id) >= 0;
        cb.onchange = function () {
          var next = all.filter(function (id) { return id === lv.id ? cb.checked : on.indexOf(id) >= 0; });
          if (!next.length) { cb.checked = true; msg.textContent = "Gardez au moins une étape."; return; }
          put(next); msg.textContent = ""; paint();
        };
        lab.append(cb, document.createTextNode(" " + lv.animal.e + " " + lv.label)); li.append(lab); ol.append(li);
      });
      host.append(mk("h4", null, "👂 Écouter jusqu’à 1 000 — étapes proposées"), ol);
      host.append(mk("p", "pb-gssum", "Avec ces réglages : " + (on.length + 1) + " étapes. Une étoile (une série réussie) ouvre l’étape suivante ; l’ordre suit toujours le programme."));
      var pv = mk("div", "exercise-preview-actions"), sel = mk("select"); sel.setAttribute("aria-label", "Étape à visualiser");
      on.forEach(function (id) { sel.append(new Option(E.levelInfo("nombres", id).label, id)); });
      var vb = mk("button", null, "Visualiser"); vb.type = "button";
      vb.onclick = function () { if (window.ZooExercisePreview) window.ZooExercisePreview("labo-calcul.html", { act: "nombres", id: sel.value, settings: { questions: 10, pass: 80, voice: true } }); };
      pv.append(sel, vb); host.append(pv);
      var rs = mk("button", "secondary", "↩️ Toutes les étapes"); rs.type = "button";
      rs.onclick = function () { put(null); paint(); msg.textContent = "Toutes les étapes sont proposées. Les résultats des élèves sont gardés."; };
      host.append(rs, msg, save);
      msg.textContent = keep;
    }
    paint();
  }
  function gsSettings(host) {
    if (window.ZooPedaCtx) C = window.ZooPedaCtx();
    var D = window.ZooGSData; if (!host) return;
    host.replaceChildren();
    if (!D) { host.append(mk("p", "muted", "Réglages indisponibles : actualisez la page.")); return; }
    var cfg = D.config(window.pedaGsCfg), msg = mk("p", "msg"); msg.setAttribute("role", "status");
    var save = mk("p", "save-state"); save.id = "gsSave"; save.setAttribute("role", "status");
    function commit(text) {
      cfg = D.config({ lecture: cfg });
      gsPut("lecture", JSON.parse(JSON.stringify(cfg)));
      if (C.queueSave) C.queueSave("gsSave");
      paint(); msg.textContent = text || "";
    }
    function num(label, val, lo, hi, set) {
      var l = mk("div", "pb-gsnum"), i = mk("input"); i.type = "number"; i.min = lo; i.max = hi; i.value = val; i.inputMode = "numeric"; i.setAttribute("aria-label", label);
      i.onchange = function () { var v = Math.round(Number(i.value)); set(isFinite(v) && i.value !== "" ? Math.max(lo, Math.min(hi, v)) : val); commit(); };
      l.append(mk("span", null, label), i); return l;
    }
    function paint() {
      var keep = msg.textContent;
      host.replaceChildren();
      host.append(mk("p", "muted", "Pour les élèves en parcours GS : ils reconnaissent les lettres, groupe par groupe, dans les activités cochées. Une étape est validée après les séries réussies d’affilée demandées."));
      /* 1. prénom */
      var pr = mk("label", "pb-gscheck"), pc = mk("input"); pc.type = "checkbox"; pc.checked = cfg.prenom;
      pc.onchange = function () { cfg.prenom = pc.checked; commit(); };
      pr.append(pc, mk("span", null, "Commencer par les lettres du prénom de l’élève")); host.append(pr);
      /* 2. groupes de lettres */
      host.append(mk("h3", null, "Groupes de lettres, dans l’ordre"));
      var gl = mk("ol", "pb-gsgroups");
      cfg.groups.forEach(function (g, i) {
        var li = mk("li"), inp = mk("input"); inp.type = "text"; inp.value = g; inp.maxLength = 26; inp.autocapitalize = "characters"; inp.spellcheck = false;
        inp.setAttribute("aria-label", "Groupe " + (i + 1));
        inp.onchange = function () {
          var l = D.letters(inp.value).join("");
          if (l.length < 2) { inp.value = g; msg.textContent = "Un groupe compte au moins 2 lettres."; return; }
          cfg.groups[i] = l;
          cfg.groups = cfg.groups.map(function (x, j) { if (j === i) return x; return D.letters(x).filter(function (c) { return l.indexOf(c) < 0; }).join(""); });
          commit("Groupe " + (i + 1) + " enregistré.");
        };
        var up = mk("button", "secondary", "↑"), dn = mk("button", "secondary", "↓"), del = mk("button", "secondary", "✕");
        up.type = dn.type = del.type = "button"; up.title = "Monter"; dn.title = "Descendre"; del.title = "Retirer ce groupe (ses lettres passent à la fin)";
        up.setAttribute("aria-label", "Monter le groupe " + (i + 1)); dn.setAttribute("aria-label", "Descendre le groupe " + (i + 1)); del.setAttribute("aria-label", "Retirer le groupe " + (i + 1));
        up.disabled = i === 0; dn.disabled = i === cfg.groups.length - 1; del.disabled = cfg.groups.length < 2;
        up.onclick = function () { var t = cfg.groups[i - 1]; cfg.groups[i - 1] = cfg.groups[i]; cfg.groups[i] = t; commit(); };
        dn.onclick = function () { var t = cfg.groups[i + 1]; cfg.groups[i + 1] = cfg.groups[i]; cfg.groups[i] = t; commit(); };
        del.onclick = function () { cfg.groups.splice(i, 1); commit(); };
        var line = mk("div"); line.append(inp, up, dn, del); li.append(line); gl.append(li);
      });
      host.append(gl);
      var used = cfg.groups.join(""), rest = Object.keys(D.LETTER_SAY).filter(function (c) { return used.indexOf(c) < 0; });
      var add = mk("button", "secondary", "+ Ajouter un groupe"); add.type = "button";
      add.disabled = rest.length < 2;
      add.onclick = function () { cfg.groups.push(rest.join("")); commit("Groupe ajouté avec les lettres restantes : modifiez-le si besoin."); };
      host.append(mk("p", "muted", rest.length ? "Lettres vues à la fin : " + rest.join(" ") : "Toutes les lettres sont dans un groupe."), add);
      /* 3. activités */
      host.append(mk("h3", null, "Activités"));
      var acts = mk("div", "pb-gsacts-set");
      D.COMPS.lecture.forEach(function (k) {
        var c = cfg[k.id], card = mk("div", "pb-gsact" + (c.on ? "" : " off")), head = mk("label", "pb-gscheck"), cb = mk("input");
        cb.type = "checkbox"; cb.checked = c.on;
        cb.onchange = function () {
          var others = D.COMPS.lecture.some(function (o) { return o.id !== k.id && cfg[o.id].on; });
          if (!cb.checked && !others) { cb.checked = true; msg.textContent = "Gardez au moins une activité."; return; }
          c.on = cb.checked; commit();
        };
        head.append(cb, mk("strong", null, k.nom)); card.append(head);
        if (c.on) {
          var nums = mk("div", "pb-gsnums"), ordre = k.act === "ordre";
          var pi = mk("input"); pi.type = "text"; pi.value = c.props.join(" "); pi.inputMode = "numeric";
          pi.onchange = function () { c.props = pi.value.split(/[^0-9]+/).filter(Boolean).map(Number); commit(); };
          var pl = mk("div", "pb-gsnum"); pi.setAttribute("aria-label", ordre ? "Lettres à ranger" : "Choix proposés"); pl.append(mk("span", null, ordre ? "Lettres à ranger" : "Choix proposés"), pi);
          pl.title = ordre ? "Nombre de lettres à ranger, un nombre par groupe (de 3 à 8)" : "Une étape par nombre de choix (de 2 à 4)";
          nums.append(pl,
            num("Questions", c.questions, 4, 20, function (v) { c.questions = v; }),
            num("Réussite (%)", c.seuil, 50, 100, function (v) { c.seuil = v; }),
            num("Séries d’affilée", c.series, 1, 4, function (v) { c.series = v; }));
          card.append(nums);
        }
        acts.append(card);
      });
      host.append(acts);
      var its = D.path(cfg, ""), ns = its.reduce(function (a, x) { return a + cfg[x.comp].series; }, 0);
      host.append(mk("p", "pb-gssum", "Avec ces réglages : " + its.length + " étapes" + (cfg.prenom ? " (plus celles des lettres du prénom)" : "") + ", soit au moins " + ns + " séries réussies pour finir le parcours."));
      /* 4. aperçu + valeurs recommandées */
      var pv = mk("div", "exercise-preview-actions"), sel = mk("select"); sel.setAttribute("aria-label", "Activité à visualiser");
      D.COMPS.lecture.filter(function (k) { return cfg[k.id].on; }).forEach(function (k) { sel.append(new Option(k.nom, k.id)); });
      var vb = mk("button", null, "Visualiser"); vb.type = "button";
      vb.onclick = function () { if (window.ZooExercisePreview) window.ZooExercisePreview("zoo-connecte.html", { type: "gs", sound: sel.value, settings: { gs: { lecture: JSON.parse(JSON.stringify(cfg)) } } }); };
      pv.append(sel, vb); host.append(pv);
      var rs = mk("button", "secondary", "↩️ Valeurs recommandées"); rs.type = "button";
      rs.onclick = function () {
        gsPut("lecture", null); cfg = D.config(null);
        if (C.queueSave) C.queueSave("gsSave");
        paint(); msg.textContent = "Valeurs recommandées rétablies. Les résultats des élèves sont gardés.";
      };
      host.append(rs, msg, save);
      msg.textContent = keep;
    }
    paint();
  }
  /* ===== Fiche d'un élève (demandée par Gabriel le 23/11/2026) : tout l'écran pour lui, l'essentiel d'abord, le détail sur demande =====
     1 en-tête (statut, parcours, dernière venue) · 2 chiffres clés + toile · 3 « Pour lui maintenant » (lectures à écouter par tablette, alertes, exercice donné)
     · 4 actions regroupées · 5 tous les résultats (cartes de studentDetail, carte GS) repliés. Remplace l'onglet « À écouter ». */
  var STATUS = { red: ["🔴", "En difficulté"], yellow: ["🟡", "Avance normalement"], green: ["🟢", "En avance"], idle: ["⚪", "Pas venu depuis " + INACTIVE_DAYS + " jours ou plus"] };
  function pendingRecs(p) {
    var done = (Array.isArray(p.results) ? p.results : []).filter(function (x) { return x && (x.src === "rec" || x.reviewId); });
    return (Array.isArray(p.reviews) ? p.reviews : []).filter(function (v) {
      return v && v.sound && !done.some(function (x) { return x.reviewId ? x.reviewId === v.id : x.sid === v.sid && x.ts === v.ts && x.sound === v.sound && x.k === v.kind; });
    }).sort(function (a, b) { return (Number(a.tab) || 99) - (Number(b.tab) || 99) || (a.ts || 0) - (b.ts || 0); });
  }
  /* Toile en SVG (même axes que la fiche PDF) : 100 % = attendu à cette date (cercle vert), bord = 150 % */
  function svgWeb(list) {
    var NS = "http://www.w3.org/2000/svg", W = 380, cx = 190, cy = 130, R = 82, n = list.length;
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + W + " 260"); svg.setAttribute("class", "pb-web"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", list.map(function (a) { return a.name + " : " + (a.v === null ? "pas mesuré" : a.v + " %"); }).join(", "));
    function el(t, at) { var e = document.createElementNS(NS, t); Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); }); svg.appendChild(e); return e; }
    function pt(i, f) { var ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * R * f, cy + Math.sin(ang) * R * f]; }
    function poly(f) { return list.map(function (a, i) { return pt(i, f(a)).join(","); }).join(" "); }
    [0.5, 1].forEach(function (f) { el("polygon", { points: poly(function () { return f; }), fill: "none", stroke: "#e3e7ef", "stroke-width": 1 }); });
    list.forEach(function (a, i) { var e = pt(i, 1); el("line", { x1: cx, y1: cy, x2: e[0], y2: e[1], stroke: "#e3e7ef" }); });
    el("polygon", { points: poly(function () { return 100 / WEB_MAX; }), fill: "none", stroke: "#2e9b6a", "stroke-width": 1.5, "stroke-dasharray": "4 3" });
    el("polygon", { points: poly(function (a) { return Math.min(WEB_MAX, a.v || 0) / WEB_MAX; }), fill: "rgba(112,70,206,.25)", stroke: "#7046ce", "stroke-width": 2 });
    list.forEach(function (a, i) {
      var e = pt(i, 1.2), t = el("text", { x: e[0], y: e[1], "text-anchor": Math.abs(e[0] - cx) < 8 ? "middle" : e[0] < cx ? "end" : "start", "dominant-baseline": "middle", "font-size": 11, fill: a.v === null ? "#9aa3b2" : "#242044" });
      t.textContent = a.name + (a.v === null ? "" : " " + a.v + " %");
    });
    return svg;
  }
  /* Une lecture en attente : à écouter sur la tablette, OU validée / à refaire directement ici (le Zoo de l'élève l'applique à sa prochaine connexion) */
  function recItem(r, v, own) {
    var li = mk("li", "pb-now-rec"), d = window.pedaRecDec[v.id], unit = v.kind === "s" ? "syllabes" : "mots", thr = thrOf()[v.kind];
    li.append(mk("span", null, "🎧 " + (Number(v.tab) ? "📱 Tablette " + v.tab : "📱 Tablette sans numéro") + " · lecture des " + (KN[v.kind] || "syllabes") + " du son « " + soundName(v.sound) + " »" + (v.ts ? " · " + frDate(v.ts) : "") + (d ? "" : " — à écouter sur sa tablette (« 🎧 Mon maître(sse) écoute ») ou à décider ici")));
    if (!own) return li;
    var box = mk("div", "pb-recdec");
    function save(dec) {
      if (dec) window.pedaRecDec[v.id] = dec; else delete window.pedaRecDec[v.id];
      var left = (Array.isArray(r.p && r.p.reviews) ? r.p.reviews : []).filter(function (x) { return x && x.sound && !window.pedaRecDec[x.id]; });   /* compteurs « à écouter » à jour sans recharger */
      r.recs = left.length; r.recTabs = left.map(function (x) { return Number(x.tab) || 0; }).filter(function (n, i, a) { return n && a.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
      if (C.queueSave) C.queueSave("pedaSave"); draw();
    }
    if (d) {
      box.append(mk("span", "pb-tag " + (d.ok ? "ok" : "warn"), d.ok ? "✅ Validée" + (typeof d.c === "number" ? " · " + d.c + " " + unit + (v.kind === "s" ? " bien lues" : " bien lus") : " sans score") : "↩️ À relire"),
        mk("small", "muted", " L’élève la verra à sa prochaine connexion. "));
      var undo = mk("button", "secondary", "Annuler"); undo.type = "button"; undo.onclick = function () { save(null); };
      box.append(undo); li.append(box); return li;
    }
    var okb = mk("button", "primary", "✅ Valider"), no = mk("button", "secondary", "↩️ Faire relire"), form = mk("div", "pb-recform");
    okb.type = no.type = "button"; form.hidden = true;
    no.title = "Cette lecture n’est pas la bonne : l’élève devra se réenregistrer";
    no.onclick = function () { save({ sid: r.s.id, ok: false, ts: Date.now() }); };
    var inp = mk("input"); inp.type = "number"; inp.min = 0; inp.max = 300; inp.inputMode = "numeric"; inp.id = "recn-" + v.id;
    var lab = mk("label", null, (v.kind === "s" ? "Syllabes bien lues en " : "Mots bien lus en ") + (Number(v.secs) && v.secs < 60 ? v.secs + " s" : "1 minute") + " (facultatif) : "); lab.className = "pb-reclab"; lab.append(inp);   /* champ dans son titre (pas de « for ») : le titre reste visible sur téléphone */
    var go = mk("button", "primary", "Valider la lecture"), cancel = mk("button", "secondary", "Annuler"); go.type = cancel.type = "button";
    form.append(lab, go, cancel,
      mk("small", "muted pb-rechelp", "Avec un nombre, la fluence est calculée et ajoutée à sa courbe (objectif : " + thr + " " + unit + " par minute) ; la médaille est donnée si l’objectif est atteint. Sans nombre, la médaille est donnée sans score."));
    okb.onclick = function () { form.hidden = !form.hidden; if (!form.hidden) inp.focus(); };
    cancel.onclick = function () { form.hidden = true; };
    go.onclick = function () {
      var raw = String(inp.value).trim(), n = raw === "" ? null : Math.round(Number(raw));
      if (n !== null && !(n >= 0 && n <= 300)) { inp.setCustomValidity("Entre 0 et 300"); inp.reportValidity(); return; }
      save({ sid: r.s.id, ok: true, c: n === null ? undefined : n, ts: Date.now() });
    };
    box.append(okb, no); li.append(box, form); return li;
  }
  function studentView(r, rows) {
    var w = mk("div", "pb-fiche"), own = C.currentUser && r.s.teacher_id === C.currentUser.id, st = STATUS[r.color] || STATUS.yellow, gs = trackOf(r.s.id) === "gs";
    function again() { draw(); }
    /* navigation : retour à la classe, élève précédent / suivant (ordre alphabétique) */
    var order = rows.slice().sort(function (a, b) { return String(a.s.nickname).localeCompare(b.s.nickname); }), i = order.indexOf(r);
    var nav = mk("div", "pb-fnav"), back = mk("button", "secondary", "← Toute la classe"); back.type = "button";
    back.onclick = function () { state.focus = null; draw(); };
    nav.append(back);
    var pn = mk("span", "pb-fpn");
    [[-1, "‹ Précédent"], [1, "Suivant ›"]].forEach(function (d) {
      var o = order[(i + d[0] + order.length) % order.length], b = mk("button", "secondary", d[1]); b.type = "button"; b.title = o.s.nickname;
      b.onclick = function () { state.focus = o.s.id; draw(); };
      if (order.length > 1) pn.append(b);
    });
    nav.append(pn); w.append(nav);
    var m = mk("p", "msg pb-dmsg"); m.setAttribute("role", "status");
    if (state.flash && state.flash.id === r.s.id) { m.textContent = state.flash.text; m.classList.toggle("err", !!state.flash.err); state.flash = null; }
    w.append(m);
    /* 1. en-tête */
    var head = mk("div", "pb-fhead c-" + r.color);
    var h = mk("h3", null); h.append(mk("span", "pb-dot", st[0]), document.createTextNode(" " + r.s.nickname));
    h.append(renameBtn(r.s, own, function (text, err) { if (err) { m.textContent = text; m.classList.add("err"); return; } state.flash = { id: r.s.id, text: text, err: false }; render(); }));
    var chips = mk("div", "pb-tags");
    chips.append(mk("span", "pb-tag", st[1]), mk("span", "pb-tag" + (r.inactive ? " warn" : ""), "🕒 " + whenText(r)), mk("span", "pb-tag", "📖 Parcours " + (gs ? "GS" : "CP")));
    if (r.allo) chips.append(mk("span", "pb-tag", "🌍 Apprend le français"));
    head.append(h, chips); w.append(head);
    /* 2. chiffres clés + toile */
    var top = mk("div", "pb-ftop"), tiles = mk("div", "pb-tiles pb-ftiles");
    function tile(ico, val, lab) { var d = mk("div", "pb-tile"); d.append(mk("span", "pb-ico", ico), mk("b", null, val), mk("small", null, lab)); tiles.append(d); }
    if (gs && window.ZooGSData) {
      var D = window.ZooGSData, g = (r.p && r.p.gs) || {}, gl = D.path(D.config(window.pedaGsCfg), r.s.nickname), gst = D.lecState(g.lecture), sm = D.pathSummary(gst, gl, g.series || []), gc = sm.item;
      tile("🔤", sm.done + " / " + sm.total, "Étapes des lettres validées");
      tile("🎯", gc ? gc.step.targets.join(" ") : "✓", gc ? D.COMP[gc.comp].court + (gst[gc.comp].aid ? " · aide" : "") : "Toutes les lettres");
    } else {
      tile("📖", r.nValid + " / " + r.total, "Sons validés");
      tile("🔤", r.cur ? "« " + soundName(r.cur.id) + " »" : "🎉", r.cur ? (r.blocked ? "Son en cours · bloqué" : "Son en cours") : "Tous les sons validés");
    }
    tile("⚡", r.flu ? Math.round(Number(r.flu.mclm)) + "/min" : "—", r.flu ? (KN[r.flu.k] || "lecture") + " lus par minute" : "Pas encore de lecture validée");
    tile("⏱️", Math.round((r.secs || 0) / 60) + " min", "Travail sur 7 jours");
    top.append(tiles);
    var wl = webAxes(r, Date.now()).list;
    if (wl.length >= 3) { var web = mk("div", "pb-fweb"); web.append(svgWeb(wl), mk("small", "muted", "Pointillés verts : attendu à cette date")); top.append(web); }
    w.append(top);
    /* 3. pour lui maintenant */
    var now = section("📌 Pour " + r.s.nickname + " maintenant", null), items = mk("ul", "pb-now");
    function item(txt, cls) { items.append(mk("li", cls || null, txt)); }
    var recs = pendingRecs(r.p || {});
    recs.forEach(function (v) { items.append(recItem(r, v, own)); });
    if (!recs.length && r.canRec) item("🎙 Peut enregistrer sa lecture pour la médaille (« 🎙 Je m’enregistre » dans son Zoo).");
    if (r.blocked && r.cur) item("⚠️ Bloqué sur le son « " + soundName(r.cur.id) + " »" + (r.err !== null && r.answers >= 6 ? " (" + r.err + " % d’erreurs)" : " (" + r.readTries + " lectures sans réussite)") + " : un exercice peut l’aider.", "pb-now-warn");
    studentConf(r).forEach(function (c) { item("🔀 Confond « " + c[0].replace(" / ", " » et « ") + " » (" + c[1] + " fois)"); });
    if (r.asg) item("🎯 Exercice donné : " + asgLabel(r.asg) + " · " + asgStatusText(r.asg, r.remed), asgState(r.asg, r.remed).ok ? "pb-now-ok" : null);
    if (r.inactive) item("💤 Pas venu depuis " + (r.idle === null ? "le début" : r.idle + " jours"), "pb-now-warn");
    if (!items.children.length) item("✅ Rien de particulier pour le moment.", "pb-now-ok");
    now.append(items); w.append(now);
    /* 4. actions */
    var acts = section("⚡ Actions", null), row = mk("div", "pb-factions");
    if (own) {
      var asb = mk("button", "primary", r.asg && !asgState(r.asg, r.remed).ok ? "🎯 Gérer l’exercice" : "🎯 Donner un exercice"); asb.type = "button";
      var edSlot = mk("div");
      asb.onclick = function () { if (edSlot.firstChild) { edSlot.replaceChildren(); return; } edSlot.append(assignEditor(r, again)); };
      row.append(asb);
    }
    if (C.pdfMake) { var fi = mk("button", "secondary", "📄 Fiche de suivi (PDF)"); fi.type = "button"; fi.onclick = function () { makeFiches([r], state.cls, fi, "fiche-suivi-" + (C.pdfSlug(r.s.nickname) || "eleve")); }; row.append(fi); }
    if (own) {
      var al = mk("button", "secondary", r.allo ? "🌍 Ne plus marquer « apprend le français »" : "🌍 Apprend le français"); al.type = "button";
      al.onclick = function () { var k = window.pedaAllo.indexOf(r.s.id); if (k >= 0) window.pedaAllo.splice(k, 1); else window.pedaAllo.push(r.s.id); r.allo = k < 0; if (C.queueSave) C.queueSave("pedaSave"); draw(); };
      row.append(al);
    }
    if (C.studentActions && (C.currentRole === "admin" || own)) {
      row.append(C.studentActions(r.s, function (text, err) {
        if (err) { m.textContent = text; m.classList.add("err"); return; }
        if (window.ZooPedaCtx) C = window.ZooPedaCtx();
        var still = (C.allStudents || []).some(function (x) { return x.id === r.s.id && !x.ghosted_at && x.class_id === state.classId; });
        if (still) state.flash = { id: r.s.id, text: text, err: false }; else { state.focus = null; state.notice = text; }
        render();
      }));
    }
    acts.append(row);
    if (own) acts.append(edSlot);
    acts.append(trackBox(r));
    w.append(acts);
    /* 5. tous les résultats, sur demande */
    var all = mk("details", "pb-fold pb-fall"); all.append(mk("summary", null, "📈 Tous les résultats"));
    all.open = !!state.folded["all:" + r.s.id];
    all.addEventListener("toggle", function () { state.folded["all:" + r.s.id] = all.open; });
    if (gs || (r.p && r.p.gs && r.p.gs.series && r.p.gs.series.length)) all.append(gsCard(r));
    if (C.studentDetail) all.append(C.studentDetail(r.s, r.row, function (text, err, reload) {
      if (reload) { state.flash = { id: r.s.id, text: text, err: err }; render(); return; }
      m.textContent = text; m.classList.toggle("err", !!err);
    }));
    w.append(all);
    return w;
  }
  function compactDetails(title, cls, key, saved) {
    var details = mk("details", "pb-fold " + cls);
    details.append(mk("summary", null, title));
    details.open = !!saved[key];
    details.addEventListener("toggle", function () { saved[key] = details.open; });
    return details;
  }
  function section(title, sub) {
    var s = mk("section", "pb-sec");
    var h = mk("h3", "pb-h"); h.append(document.createTextNode(title));
    if (sub) h.append(mk("small", null, " · " + sub));
    s.append(h);
    return s;
  }

  /* ===== Fiche élève PDF (jalon 3) : toile d'araignée à 7 axes + points à travailler =====
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
  function expected(total, now) { return Math.max(1, Math.round(total * schoolWeeks(now) / YEAR_WEEKS)); }
  function doneCount(o, need) {
    o = o && typeof o === "object" ? o : {};
    var done = o.done && typeof o.done === "object" ? o.done : {}, passes = o.passes && typeof o.passes === "object" ? o.passes : {};
    var order = soundsOrder(), ir = order.findIndex(function (x) { return x.id === "r"; });
    return order.filter(function (x, i) { return done[x.id] || (need && (Number(passes[x.id]) || 0) >= need(i, ir)); }).length;
  }
  function vocabularyAxis(progress, now) {
    var catalog = ZooVocabulary.catalog;
    var mastered = progress.remed && progress.remed.vocabCompleted;
    var completed = catalog.filter(function (book) { return mastered && mastered[book.id]; }).length;
    var target = catalog.length ? expected(catalog.length, now) : 0;
    return { k: "vocabulaire", name: "Vocabulaire", v: target ? Math.round(completed * 100 / target) : null,
      txt: target ? completed + " sur " + target + " corpus attendus" : "aucun corpus disponible",
      tip: "Corpus terminés sur l’objectif à cette date" };
  }
  function axes(r, now) {
    var p = r.p, tot = Math.max(1, r.total), thr = thrOf();
    var lp = Number(C.listenPasses) || 2, dp = Number(C.dicteePasses) || 1;
    var nL = doneCount(p.listen, function (i, ir) { return lp + (ir >= 0 && i >= ir ? 1 : 0); });
    var nD = doneCount(p.dictee, function () { return dp; });
    var opt = function (o) { return o && typeof o === "object" && o.done && typeof o.done === "object" ? doneCount(o, null) : null; };
    var nP = opt(p.phono), nC = opt(p.compr);
    var flu = (Array.isArray(p.results) ? p.results : []).filter(function (x) { return x && !x.void && !x.short && !(Number(x.fraud) > 0) && x.src !== "adj" && x.src !== "train" && Number(x.mclm) > 0 && thr[x.k]; })
      .sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); });
    var last3 = flu.slice(0, 3), sp = last3.length ? Math.round(last3.reduce(function (a, x) { return a + Math.min(1, Number(x.mclm) / thr[x.k]); }, 0) * 100 / last3.length) : null;
    var exp = expected(tot, now), pct = function (n) { return n === null ? null : Math.round(n * 100 / exp); };
    var sons = function (n) { return n === null ? "pas encore mesuré" : n + " " + (n > 1 ? "sons" : "son") + " · " + exp + " attendus"; };
    return { flu: flu, exp: exp, list: [
      { k: "phono", name: "Phonologie", v: pct(nP), txt: sons(nP), tip: "Entendre un son dans un mot" },
      { k: "ecoute", name: "Écoute", v: pct(nL), txt: sons(nL), tip: "Reconnaître l'écriture d'un son entendu" },
      { k: "dictee", name: "Dictée", v: pct(nD), txt: sons(nD), tip: "Écrire un son, une syllabe, un mot entendus" },
      { k: "lecture", name: "Lecture", v: pct(r.nValid), txt: sons(r.nValid), tip: "Lecture validée par l'enseignant" },
      { k: "compr", name: "Compréhension", v: pct(nC), txt: sons(nC), tip: "Associer un mot lu à son image" },
      { k: "vitesse", name: "Vitesse", v: sp, txt: sp === null ? "pas encore de lecture" : sp + " % du seuil attendu", tip: "3 dernières lectures, par rapport au seuil de réussite de la classe" },
      vocabularyAxis(p, now)
    ] };
  }
  /* Toile du parcours GS (cahier 10.2) : une branche par activité des lettres proposée, en % des étapes attendues à cette date (gs-data.js radar) */
  var GS_TIP = { cap: "Reconnaître une capitale entendue", ordre: "Ranger des lettres dans l’ordre de l’alphabet", capscript: "Associer capitale et minuscule",
    script: "Reconnaître une minuscule entendue", scriptcurs: "Associer minuscule et lettre attachée", curs: "Reconnaître une lettre attachée entendue" };
  var GS_ST = { nouveau: "pas commencé", en_cours: "en cours", maitrise: "maîtrisé", difficulte: "en difficulté" };
  function gsAxes(r, now) {
    var D = window.ZooGSData, g = (r.p && r.p.gs) || {};
    if (!D) return { flu: [], exp: 0, list: [], gs: true };
    var cfg = D.config(window.pedaGsCfg), list = D.radar(cfg, r.s.nickname, D.lecState(g.lecture), Array.isArray(g.series) ? g.series : [], schoolWeeks(now) / YEAR_WEEKS);
    return { flu: [], exp: 0, gs: true, list: list.map(function (a) {
      return { k: a.k, name: a.name, v: a.v, txt: a.done + "/" + a.total + " étapes · attendu " + a.exp + " · " + GS_ST[a.status], tip: GS_TIP[a.k] || "" };
    }) };
  }
  /* Toile de l'élève selon son parcours : GS (les lettres) ou CP (les sons) */
  function webAxes(r, now) { return trackOf(r.s.id) === "gs" ? gsAxes(r, now) : axes(r, now); }
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
  function drawFiche(doc, r, cls, ref, now) {
    var T = C.pdfText, gs = trackOf(r.s.id) === "gs", ax = webAxes(r, now), W = 210, M = 16;
    doc.setFillColor(55, 36, 101); doc.roundedRect(M, 12, W - 2 * M, 14, 3, 3, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Zoo de Lecture", M + 5, 21.4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(T("Fiche de suivi · " + frDate(now)), W - M - 5, 21.2, { align: "right" });
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text(T(r.s.nickname) || "?", M, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(80);
    doc.text(T("Classe : " + cls.name).slice(0, 70), M, 47);
    var gsm = gs ? gsSum(r) : null;
    if (gsm) doc.text(T("Parcours GS · " + gsm.sm.done + " " + (gsm.sm.done > 1 ? "étapes des lettres validées" : "étape des lettres validée") + " sur " + gsm.sm.total + (gsm.sm.item ? " · En cours : " + gsm.D.stepLabel(gsm.sm.item.step, gsm.sm.item.comp).replace(/ ↔ /g, "/") + " (" + gsm.sm.item.step.targets.join(" ") + ")" : " · Toutes les lettres sont validées")).slice(0, 110), M, 53);
    else {
      var cur = r.cur ? "Son en cours : « " + soundName(r.cur.id) + " »" : "Tous les sons sont validés";
      doc.text(T(r.nValid + " " + (r.nValid > 1 ? "sons validés" : "son validé") + " en lecture sur " + r.total + " · " + cur), M, 53);
    }

    /* Toile d'araignée */
    if (ax.list.length >= 3) drawWeb(doc, T, ax.list, ref, W / 2, 108);

    /* légende */
    doc.setLineWidth(0.7); doc.setDrawColor(91, 33, 182); doc.line(M, 61, M + 8, 61);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(70); doc.text(T(r.s.nickname), M + 10, 62);
    if (ref) { doc.setLineWidth(0.4); doc.setDrawColor(150); doc.setLineDashPattern([1.2, 1.2], 0); doc.line(M, 66, M + 8, 66); doc.setLineDashPattern([], 0); doc.text(T("Élève moyen (sans absents ni extrêmes)"), M + 10, 67); }
    doc.setLineWidth(0.7); doc.setDrawColor(46, 155, 100); doc.line(M, 71, M + 8, 71); doc.setTextColor(70); doc.text(T("Attendu à cette date (semaine " + Math.round(schoolWeeks(now)) + " sur " + YEAR_WEEKS + ")"), M + 10, 72);

    /* Tableau des compétences */
    var y = 170;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text("Les " + ax.list.length + " compétences", M, y); y += 2;
    ax.list.forEach(function (a, i) {
      y += 7;
      if (i % 2 === 0) { doc.setFillColor(244, 241, 252); doc.rect(M, y - 4.6, W - 2 * M, 7, "F"); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(a.v === null ? 150 : 30); doc.text(T(a.name), M + 2, y);
      doc.setFont("helvetica", "normal"); doc.text(T(a.txt), M + (gs ? 34 : 36), y);
      doc.setTextColor(120); doc.setFontSize(8.5); doc.text(T(a.tip), M + (gs ? 104 : 86), y);
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
    if (gsm) {
      if (gsm.sm.item) work.push(gsm.D.COMP[gsm.sm.item.comp].nom + " : " + gsm.sm.item.step.targets.join(" ") + (gsm.st[gsm.sm.item.comp].aid ? " (aide activée)" : ""));
      var lastKo = (gsm.series || []).slice(-3).filter(function (x) { return !x.ok; }).length;
      if (lastKo >= 2) work.push(lastKo + " séries ratées parmi les 3 dernières");
    } else if (r.cur) work.push("Son « " + soundName(r.cur.id) + " »" + (r.blocked ? " : difficulté" + (r.err !== null && r.answers >= 6 ? " (" + r.err + " % d'erreurs)" : " (" + r.readTries + " lectures sans réussite)") : " : en cours"));
    if (!gsm) studentConf(r).forEach(function (c) { work.push("Confond « " + c[0].replace(" / ", " » et « ") + " » (" + c[1] + " fois)"); });
    if (!work.length) work.push("Rien de particulier.");
    var days = r.series, act = [
      "Temps de travail : " + Math.round(r.secs / 60) + " min",
      gsm ? "Séries des lettres : " + days[0] : "Séries d'écoute : " + days[0] + " · de dictée : " + days[1],
      gsm ? "Parties de jeu : " + days[3] : "Lectures : " + days[2] + " · parties de jeu : " + days[3],
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
    if (gsm) doc.text(T("zoodelecture.fr · 100 % = étapes attendues à cette date pour chaque activité des lettres (semaine " + Math.round(schoolWeeks(now)) + " sur " + YEAR_WEEKS + "). Une étape = deux séries réussies."), M, 290);
    else doc.text(T("zoodelecture.fr · 100 % = attendu à cette date : " + ax.exp + " sons sur les " + r.total + " de l’année (semaine " + Math.round(schoolWeeks(now)) + " sur " + YEAR_WEEKS + "). Vitesse : 3 dernières lectures / seuil."), M, 290);
  }
  function makeFiches(list, cls, btn, file) {
    if (!C.pdfMake) return;
    var now = Date.now();
    C.pdfMake({ btn: btn, msgId: "pedaMsg", wait: "Création de la fiche…", file: file,
      title: list.length > 1 ? "Fiches de « " + cls.name + " »" : "Fiche de " + list[0].s.nickname,
      ok: "📄 " + (list.length > 1 ? list.length + " fiches de suivi pour « " + cls.name + " »" : "Fiche de suivi de " + list[0].s.nickname) + " : le PDF s’ouvre (sinon, regardez dans vos téléchargements).",
      build: async function (doc) {
        if (C.refreshVocabularyCatalog) await C.refreshVocabularyCatalog().catch(function () {});
        var ref = classRef(now, false), refGs = classRef(now, true);
        list.forEach(function (r, i) { if (i) doc.addPage(); drawFiche(doc, r, cls, trackOf(r.s.id) === "gs" ? refGs : ref, now); });
      } });
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
  /* élève moyen parmi ceux du même parcours (les toiles GS et CP n'ont pas les mêmes branches) */
  function classRef(now, gs) {
    return refOf((state.rows || []).filter(function (r) { return !r.inactive && (trackOf(r.s.id) === "gs") === !!gs; }).map(function (r) { return webAxes(r, now).list; }));
  }


  /* ===== Remédiation (jalon 7) : « Donner un exercice » un exercice à un élève =====
     Réglage enseignant settings.assign[élève] = { type, sons, pair, ts } (enregistré avec les autres réglages, aucune migration).
     Le Zoo de l’élève le met en tête de sa mission jusqu’à réussite et note le résultat dans progress.remed = { ts, done, ok, tries, hist }. */
  window.pedaAssign = window.pedaAssign || {};
  window.pedaVocabGiven = window.pedaVocabGiven || {};
  function rememberVocabulary(sid, assignment) {
    if (!assignment || assignment.type !== "vocabulaire" || !ZooVocabulary.get(assignment.corpus)) return;
    var before = window.pedaVocabGiven[sid];
    var given = Array.isArray(before) ? before : [];
    if (given.indexOf(assignment.corpus) < 0) window.pedaVocabGiven[sid] = given.concat(assignment.corpus);
  }
  function setAssignment(sid, assignment) {
    rememberVocabulary(sid, window.pedaAssign[sid]);
    rememberVocabulary(sid, assignment);
    if (assignment) window.pedaAssign[sid] = assignment; else delete window.pedaAssign[sid];
  }
  function vocabularyStatus(r, book) {
    var p = r.remed || {}, current = currentAssignment(r.s.id), given = window.pedaVocabGiven[r.s.id];
    if ((p.vocabCompleted && p.vocabCompleted[book.id]) || ZooVocabulary.reviewHistory(p)[book.id]) return "✓ Réussi";
    if ((current && current.type === "vocabulaire" && current.corpus === book.id)
        || (Array.isArray(given) && given.indexOf(book.id) >= 0)
        || (state.classVocab || []).indexOf(book.id) >= 0) return "↻ Déjà attribué";
    return "＋ Nouveau";
  }
  function vocabularyReminders(rows) {
    var now = Date.now(), found = [];
    rows.forEach(function (r) {
      if (r.s.teacher_id !== C.currentUser.id) return;
      var history = ZooVocabulary.reviewHistory(r.remed);
      var active = r.asg && !asgState(r.asg, r.remed).ok;
      ZooVocabulary.catalog.forEach(function (book) {
        var entry = history[book.id], due = ZooVocabulary.reviewDue(entry);
        if (due !== null && due <= now && !(active && r.asg.type === "vocabulaire" && r.asg.corpus === book.id)) {
          found.push({ r: r, book: book, due: due, count: entry.count, blocked: active });
        }
      });
    });
    return found.sort(function (a, b) { return a.due - b.due || String(a.r.s.nickname).localeCompare(b.r.s.nickname); });
  }
  function vocabularyReminderCard(reminder) {
    var r = reminder.r, book = reminder.book, card = mk("div", "pb-alert a-asg");
    card.append(mk("strong", null, r.s.nickname + " · " + book.title));
    card.append(mk("small", "pb-tip", "Révision " + reminder.count + " sur 3 · prévue le " + frDate(reminder.due)));
    var assign = mk("button", "secondary", reminder.blocked ? "Exercice individuel déjà attribué" : "Attribuer la révision");
    assign.type = "button"; assign.disabled = !!reminder.blocked;
    assign.onclick = function () {
      var current = currentAssignment(r.s.id);
      if (current && !asgState(current, r.remed).ok) return;
      assign.disabled = true;
      setAssignment(r.s.id, { type: "vocabulaire", corpus: book.id, ts: Date.now() });
      if (C.queueSave) C.queueSave("pedaSave");
      state.notice = "🎯 Révision « " + book.title + " » donnée à " + r.s.nickname + ".";
      render();
    };
    card.append(assign);
    return card;
  }

  function currentAssignment(id) {
    var a = (window.pedaAssign || {})[id];
    return a && (a.type !== "vocabulaire" || ZooVocabulary.get(a.corpus)) ? a : null;
  }
  var RT = { phono: "🖼️ J’entends", listen: "👂 J’écoute", write: "✏️ J’écris", compr: "🧩 Je comprends", tiles: "🎹 Tuiles des sons", vocabulaire: "🖼️ Corpus de vocabulaire" };
  var RT_HELP = { phono: "trouver les images où l’on entend le son", listen: "reconnaître le son entendu parmi des écritures", write: "écrire ce que dit la voix", compr: "lire des mots et trouver leur image", tiles: "toucher une écriture et éviter celle qu’il confond (20 bonnes tuiles)", vocabulaire: "écouter et répéter les mots, puis reconnaître les images par blocs de six" };
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
    if (a.type === "vocabulaire") { var book = ZooVocabulary.get(a.corpus); return RT.vocabulaire + (book ? " · " + book.title : ""); }
    if (a.type === "tiles") return RT.tiles + " " + q2(a.pair[0]) + " et " + q2(a.pair[1]);
    return RT[a.type] + " · " + (a.sons || []).map(function (id) { return q2(soundName(id)); }).join(", ");
  }
  /* État d’un exercice donné : réussi (date), commencé (étapes faites), pas encore */
  function asgState(a, rm) {
    rm = rm && typeof rm === "object" ? rm : {};
    var same = a && Number(rm.ts) === Number(a.ts), done = same && rm.done && typeof rm.done === "object" ? Object.keys(rm.done).length : 0;
    var past = a && Array.isArray(rm.hist) && rm.hist.find(function (h) { return h && Number(h.ts) === Number(a.ts) && Number(h.ok) > 0; });
    var book = a && a.type === "vocabulaire" && ZooVocabulary.get(a.corpus);
    return { ok: same && Number(rm.ok) > 0 ? Number(rm.ok) : past ? Number(past.ok) : 0, done: done, total: book ? ZooVocabulary.blocks(book).length : a ? (a.type === "tiles" ? 1 : (a.sons || []).length) : 0, tries: same ? Number(rm.tries) || 0 : 0 };
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
    if (cur && cur.type === "vocabulaire" && !ZooVocabulary.get(cur.corpus)) cur = null;
    var pick = cur ? JSON.parse(JSON.stringify(cur)) : (prop ? JSON.parse(JSON.stringify(prop.a)) : { type: "listen", sons: [] });
    box.append(mk("h4", null, "🎯 Exercice pour " + r.s.nickname));
    if (prop) {
      var tip = mk("p", "pb-as-tip"); tip.append(mk("b", null, "💡 Proposé : "), document.createTextNode(asgLabel(prop.a) + " — " + prop.why + "."));
      box.append(tip);
    }
    var types = mk("div", "pb-chips"), what = mk("div", "pb-as-what"), help = mk("p", "muted pb-as-help");
    box.append(mk("p", "pb-as-lbl", "1. L’exercice"), types, help, what);
    Object.keys(RT).filter(function (t) { return t !== "vocabulaire" || ZooVocabulary.catalog.length; }).forEach(function (t) {
      var b = mk("button", "pb-chip", RT[t]); b.type = "button"; b.dataset.t = t;
      b.onclick = function () { if (pick.type === t) return; pick = t === "vocabulaire" ? { type: t, corpus: (ZooVocabulary.catalog.find(function (book) { return vocabularyStatus(r, book) === "＋ Nouveau"; }) || ZooVocabulary.catalog[0]).id } : t === "tiles" ? { type: t, pair: prop && prop.a.type === "tiles" ? prop.a.pair.slice() : ["b", "d"] } : { type: t, sons: (pick.sons || []).filter(function (id) { return remedCan(t, id); }) }; paint(); };
      types.append(b);
    });
    var msg = mk("p", "pb-as-msg"); msg.setAttribute("role", "status");
    function paint() {
      Array.prototype.forEach.call(types.children, function (b) { var on = b.dataset.t === pick.type; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
      help.textContent = "L’élève va " + RT_HELP[pick.type] + ". L’exercice passe en tête de sa mission jusqu’à ce qu’il soit réussi.";
      what.innerHTML = ""; msg.textContent = "";
      var chips = mk("div", "pb-chips");
      if (pick.type === "vocabulaire") {
        var books = mk("select"); books.setAttribute("aria-label", "Imagier");
        ZooVocabulary.catalog.forEach(function (book) { var option = mk("option", null, vocabularyStatus(r, book) + " · " + book.title + " (" + book.words.length + " mots)"); option.value = book.id; books.append(option); });
        books.value = pick.corpus; books.onchange = function () { pick.corpus = books.value; };
        what.append(mk("p", "pb-as-lbl", "2. Choisissez l’imagier"), books);
      } else if (pick.type === "tiles") {
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
      var a = pick.type === "vocabulaire" ? { type: pick.type, corpus: pick.corpus, ts: Date.now() } : pick.type === "tiles" ? { type: "tiles", pair: pick.pair.slice(0, 2), ts: Date.now() } : { type: pick.type, sons: (pick.sons || []).slice(0, 3), ts: Date.now() };
      if (a.type !== "tiles" && a.type !== "vocabulaire" && !a.sons.length) { msg.textContent = "Choisissez au moins un son."; return; }
      setAssignment(r.s.id, a);
      if (C.queueSave) C.queueSave("pedaSave");
      r.asg = a; repaint();
      var m = $("pedaMsg"); if (m) m.textContent = "🎯 Exercice donné à " + r.s.nickname + " : " + asgLabel(a) + ". Il apparaîtra en tête de sa mission à sa prochaine connexion.";
    };
    var no = mk("button", "secondary", "Annuler"); no.type = "button";
    no.onclick = function () { box.remove(); };
    acts.append(ok, no);
    if (cur) {
      var rm = mk("button", "secondary pb-as-del", "Retirer l’exercice"); rm.type = "button";
      rm.onclick = function () { setAssignment(r.s.id, null); if (C.queueSave) C.queueSave("pedaSave"); r.asg = null; repaint(); };
      acts.append(rm);
    }
    box.append(msg, acts);
    return box;
  }

  /* « Mes classes » › « Voir mes élèves » : ouvrir Ma classe sur cette classe */
  function pick(id) { if (id && id !== state.classId) { state.classId = id; state.open = {}; state.filter = "all"; } }
  window.ZooPeda = { renameBtn: renameBtn, svgWeb: svgWeb, gsSettings: gsSettings, gsCalcSettings: gsCalcSettings, ce1CalcSettings: ce1CalcSettings, trackBox: trackBox, trackBulk: trackBulk, GS_ST: GS_ST, gsAxes: gsAxes, trackOf: trackOf, compactDetails: compactDetails, pick: pick, asgLabel: asgLabel, asgState: asgState, asgStatusText: asgStatusText, render: render, openDetail: openDetail, scrollToStudent: scrollToStudent, tilePairs: TILE_PAIRS, analyse: analyse, classify: classify, axes: axes, drawFiche: drawFiche, drawWeb: drawWeb, refOf: refOf, schoolWeeks: schoolWeeks, YEAR_WEEKS: YEAR_WEEKS, state: state };
})();
