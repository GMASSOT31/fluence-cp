/* Zoo de Calcul — espace enseignant INTÉGRÉ à enseignants.html (laboratoire privé).
   Chargé à la demande par labo-switch.js, seulement pour un compte autorisé (lab_my_access). N'ajoute rien aux autres comptes.
   * Bascule « 📖 Lecture | ➕ Calcul » en haut du menu. En mode Calcul, les rubriques « Progression » et « Réglages péda » montrent le calcul
     (mêmes composants et mêmes classes que la lecture) ; les rubriques communes (classes, élèves, réglages généraux…) ne changent pas.
   * On n'a pas accès au code interne de la page : on réutilise ses boutons de menu (data-tab) et sa propre fonction d'affichage des panneaux
     (data-section), sans rien modifier de la lecture. Retour en « Lecture » = menu et panneaux exactement comme avant.
   * Données : fonctions lab_* (réservées aux comptes autorisés côté serveur), jamais d'accès direct aux tables. */
(function () {
  "use strict";
  if (window.CalcTeacher) return;
  var C = window.LABO_CALCUL || {}, E = window.CalcEngine, role = "teacher", mode = "lecture", settings = {}, saved = null, saveTimer = null;
  var ACT = { nombres: { icon: "👂", title: "ÉCOUTER" }, addition: { icon: "➕", title: "ADDITION" }, soustraction: { icon: "➖", title: "SOUSTRACTION" } };
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
  function enabled(act) { var l = settings.levels && settings.levels[act]; return (l && l.length ? l : E.DEFAULT_LEVELS[act]).filter(function (id) { return E.levelInfo(act, id); }); }

  /* ===== Style : accent vert du calcul (la lecture reste violette) ===== */
  function css() {
    var s = el("style"); s.id = "calc-teacher-css";
    s.textContent = "body.calc-mode #guide,body.calc-mode .share-teacher{display:none!important}#teachersAdminTab{position:relative}#calcReqBadge{position:absolute;top:-7px;right:-3px;margin:0;box-shadow:0 0 0 2px #fff}#calcAccess h3{margin:16px 0 8px}" +
      ".calc-switch{display:flex;margin:2px 0 12px;border:2px solid #0b7f7d;border-radius:999px;overflow:hidden}" +
      ".calc-switch button{flex:1;border:0;border-radius:0;background:#fff;color:#0b7f7d;font-weight:800;padding:9px 6px;font-size:.92rem;cursor:pointer;min-height:40px;box-shadow:none}" +
      ".calc-switch button.on{background:#0b7f7d;color:#fff}" +
      "body.calc-mode .teacher-nav button.active{background:#075f5d}" +
      "body.calc-mode .calc-card{--accent:#0b7f7d;--soft:#e2f6f2}" +
      "body.calc-mode .calc-card .section-icon{background:#e2f6f2}" +
      "body.calc-mode header .zoo-hero{border-color:#7ff0c6;background:radial-gradient(circle at 83% 18%,rgba(255,196,69,.42),transparent 32%),radial-gradient(circle at 22% 120%,rgba(60,230,170,.42),transparent 45%),linear-gradient(125deg,#053b36 0%,#0a6a5c 57%,#06353a 100%);box-shadow:0 7px 0 #04302b,0 15px 30px rgba(5,60,50,.22)}" +
      "body.calc-mode header .zoo-hero .brand .sub{color:#c6fff0}body.calc-mode header .zoo-llama{background:linear-gradient(145deg,#c6fff0,#7fd9c3)}body.calc-mode header .zoo-owl{background:linear-gradient(145deg,#fff0a8,#ffb96a)}" +
      "body.calc-mode header .zoo-pad{background:#04302b;border-color:#7ff0c6;color:#c6fff0}" +
      "@media (prefers-reduced-motion:no-preference){body.calc-mode header .zoo-owl{animation:zoo-float 4.2s ease-in-out -2s infinite}}" +
      ".calc-card .pg-chip.mastered{background:#e2f6f2;border-color:#7ddfc0;color:#075f5d}" +
      ".calc-fields{display:grid;gap:14px;margin-top:10px}.calc-fields label{font-weight:700;display:block;margin-bottom:4px}.calc-fields input[type=number]{max-width:140px}" +
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
    bProg = $('[data-tab="progression"]', nav); bReg = $('[data-tab="reglages"]', nav); bEcou = $('[data-tab="ecouter"]', nav);
    if (!bProg || !bReg) return false;
    /* bascule */
    var sw = el("div", "calc-switch"), bl = el("button", "", "📖 Lecture"), bc = el("button", "", "➕ Calcul"); bl.type = bc.type = "button";
    sw.setAttribute("role", "group"); sw.setAttribute("aria-label", "Matière"); sw.appendChild(bl); sw.appendChild(bc); nav.parentNode.insertBefore(sw, nav);
    bl.addEventListener("click", function () { setMode("lecture"); }); bc.addEventListener("click", function () { setMode("calcul"); });
    window.CalcTeacher.sw = { l: bl, c: bc };
    /* panneaux (affichés par la fonction d'affichage de la page grâce à data-section) */
    var prog = el("section", "panel feature-card calc-card hidden"); prog.setAttribute("data-section", "calc-progression"); prog.id = "calcProgress";
    var reg = el("section", "panel feature-card calc-card hidden"); reg.setAttribute("data-section", "calc-reglages"); reg.id = "calcSettings";
    var acc = el("section", "panel feature-card calc-card hidden"); acc.setAttribute("data-section", "enseignants"); acc.setAttribute("data-role", "admin"); acc.id = "calcAccess";
    content.appendChild(prog); content.appendChild(reg); content.appendChild(acc);
    [bProg, bReg].forEach(function (b) { b.addEventListener("click", function () { if (mode === "calcul") render(b.dataset.tab); }); });
    var bEns = $('[data-tab="enseignants"]', nav);
    if (role === "admin" && bEns) bEns.addEventListener("click", renderAccess);
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
      if (cur === "progression" || cur === "ecouter") bProg.click(); else if (cur === "reglages") bReg.click();
    } else {
      bProg.dataset.tab = "progression"; bReg.dataset.tab = "reglages"; if (bEcou) bEcou.classList.remove("hidden");
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
  function lastTs(p) { var h = Array.isArray(p.hist) && p.hist.length ? p.hist[p.hist.length - 1] : null, t = h && Date.parse(h.t); return t || 0; }
  function nextStep(levels) {
    var best = null;
    Object.keys(ACT).forEach(function (a) {
      var ids = enabled(a), id = E.suggestLevel(a, ids, levels), e = levels[a + ":" + id] || {};
      if (!id || (e.ok >= 1 && ids.indexOf(id) === ids.length - 1)) return;
      var score = (e.ok || 0) * 100 + (e.r || 0); if (!best || score < best.score) best = { act: a, id: id, score: score };
    });
    if (!best) return "toutes faites 🎉";
    var lv = E.levelInfo(best.act, best.id); return "🥚 " + ACT[best.act].title + " · " + lv.label;
  }
  function renderProgress() {
    var box = $("#calcProgress"); clear(box);
    box.appendChild(head("📈", "Progression en calcul", "Reconnaissance des nombres (ÉCOUTER), additions et soustractions : étapes réussies, animaux éclos et résultats. Les résultats de lecture restent dans l’onglet Lecture."));
    var acts = el("div", "actions section-actions"), rl = el("button", "secondary", "↻ Actualiser les résultats"); rl.type = "button"; acts.appendChild(rl); box.appendChild(acts);
    var msg = el("p", "msg"); msg.setAttribute("role", "status"); box.appendChild(msg);
    var list = el("div", "content-list"); box.appendChild(list); box.appendChild(legend());
    rl.addEventListener("click", renderProgress);
    msg.textContent = "Chargement des résultats…";
    Promise.all([rpc("lab_teacher_settings_get").catch(function () { return {}; }), rpc("lab_teacher_results")]).then(function (r) {
      settings = r[0] || {}; msg.textContent = ""; var rows = r[1] || [];
      if (!rows.length) { list.appendChild(el("p", "muted", "Aucun élève pour l’instant : créez une classe dans « Ajout d’élèves et création de classe ».")); return; }
      var order = [], by = {}; rows.forEach(function (x) { if (!by[x.class_id]) { by[x.class_id] = { name: x.class_name, students: [] }; order.push(x.class_id); } by[x.class_id].students.push(x); });
      order.forEach(function (cid, ci) {
        var g = by[cid], card = el("div", "class-group"), hd = el("div", "class-group-head"); card.style.setProperty("--cg", COLORS[ci % COLORS.length]);
        hd.appendChild(el("h4", "", "📚 " + g.name)); hd.appendChild(el("span", "", g.students.length + (g.students.length > 1 ? " élèves" : " élève"))); card.appendChild(hd);
        g.students.forEach(function (s) { card.appendChild(studentRow(s)); }); list.appendChild(card);
      });
    }).catch(function () { msg.className = "msg err"; msg.textContent = "Impossible de charger les résultats de calcul. Réessayez dans un instant."; });
  }
  function statusTxt(e) { var s = E.status(e); return s === "mastered" ? "⭐ maîtrisé" : s === "done" ? "✓ réussi" : s === "todo" ? "🕒 à travailler" : "pas encore commencé"; }
  function studentRow(s) {
    var p = s.progress || {}, lv = p.levels || {}, nums = Object.keys(p.nums || {}).length, calcs = Object.keys(p.calcs || {}).length;
    function scoped(k) { var a = k.split(":"); return enabled(a[0]).indexOf(a[1]) >= 0; }   /* périmètre = étapes activées dans vos réglages ; les réussites des autres restent acquises */
    var okAll = Object.keys(lv).filter(function (k) { return lv[k].ok >= 1; }), ok = okAll.filter(scoped).length, hid = okAll.length - ok, mast = Object.keys(lv).filter(function (k) { return lv[k].ok >= 2 && scoped(k); }).length, ts = lastTs(p), days = ts ? Math.floor((Date.now() - ts) / 864e5) : null;
    var wrap = el("div", "row progress-row"), info = el("div"), glance = el("div", "pg-row");
    function chip(cls, t, tip) { var c = el("span", "pg-chip " + cls, t); if (tip) c.title = tip; return c; }
    info.appendChild(el("strong", "", s.nickname));
    glance.appendChild(chip(days === null || days >= 7 ? "warn" : "ok", "🕒 Dernière activité : " + dayText(ts)));
    glance.appendChild(chip("next", "➡️ Prochaine étape : " + nextStep(lv)));
    glance.appendChild(chip(ok ? "ok" : "", "✓ " + ok + " " + pl(ok, "étape réussie", "étapes réussies") + (mast ? " · ⭐ " + mast + " " + pl(mast, "maîtrisée", "maîtrisées") : "") + (hid ? " (+ " + hid + " hors étapes proposées)" : ""), hid ? (okAll.length + " étapes réussies au total, dont " + hid + " désactivée" + (hid > 1 ? "s" : "") + " dans vos réglages : ces réussites sont conservées.") : null));
    info.appendChild(glance); wrap.appendChild(info);
    var btn = el("button", "secondary", "Détails"); btn.type = "button"; btn.setAttribute("aria-expanded", "false"); btn.title = "Voir les détails de " + s.nickname;
    var details = el("div", "muted hidden"); details.style.cssText = "width:100%";
    details.appendChild(detailGrid(lv));
    details.appendChild(el("div", "pd-foot", "En chiffres :"));
    var chips = el("div", "pd-chips");
    [["🔢 " + nums + " " + pl(nums, "nombre reconnu", "nombres reconnus") + " sur 101", "Nombres trouvés du premier coup dans ÉCOUTER"], ["🧮 " + calcs + " " + pl(calcs, "calcul gagné", "calculs gagnés"), "Additions et soustractions réussies du premier coup"]]
      .forEach(function (x) { var c = el("span", "pd-chip", x[0]); c.title = x[1]; chips.appendChild(c); });
    details.appendChild(chips);
    details.appendChild(el("div", "pd-foot", "Une étape = un niveau d’un exercice. « Réussi » : au moins une série au seuil réglé (bonnes réponses du premier coup, sans compter les aides) ; « maîtrisé » : au moins deux séries réussies. Les compteurs ne comptent que les étapes activées dans vos réglages ; les réussites des étapes désactivées restent conservées."));
    btn.addEventListener("click", function () { details.classList.toggle("hidden"); var open = !details.classList.contains("hidden"); btn.textContent = open ? "Masquer" : "Détails"; btn.setAttribute("aria-expanded", String(open)); });
    var acts = el("div", "row-actions"); acts.appendChild(btn); wrap.appendChild(acts); wrap.appendChild(details); return wrap;
  }
  function detailGrid(lv) {
    var grid = el("div", "pd-grid");
    Object.keys(ACT).forEach(function (a) {
      var ids = enabled(a), done = ids.filter(function (id) { return (lv[a + ":" + id] || {}).ok >= 1; }), tot = Math.max(1, ids.length);
      var c = el("div", "pd-card"); c.appendChild(el("h5", "", ACT[a].icon + " " + ACT[a].title));
      var big = el("div", "pd-big", String(done.length)); big.appendChild(el("small", "", " / " + ids.length + " " + pl(ids.length, "étape réussie", "étapes réussies"))); c.appendChild(big);
      var bar = el("div", "pd-bar"), fill = el("i"); fill.style.width = Math.round(done.length * 100 / tot) + "%"; fill.style.background = "#2e9b91"; bar.appendChild(fill); c.appendChild(bar);
      var fast = null; done.forEach(function (id) { var an = E.animalOf(a, id); if (!fast || an.kmh > fast.kmh) fast = an; });
      c.appendChild(el("div", "pd-note", fast ? "🐾 Animal le plus rapide : " + fast.e + " " + fast.nom + " (environ " + String(fast.kmh).replace(".", ",") + " km/h)" : "Aucun animal éclos pour l’instant"));
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
    box.appendChild(head("✏️", "Réglages péda du calcul", "Ces réglages ne concernent que le calcul : ils n’ont aucun effet sur la lecture."));
    var st = el("span", "save-state", ""); st.id = "calcSave"; st.setAttribute("role", "status"); box.appendChild(st);
    var f = el("div", "calc-fields"); box.appendChild(f);
    rpc("lab_teacher_settings_get").then(function (s) {
      settings = s || {}; saved = JSON.stringify(settings);
      var q = el("input"), qd = el("div"), p = el("input"), pd = el("div"), vd = el("div"), v = el("input");
      q.type = "number"; q.id = "calcQ"; q.min = 5; q.max = 20; q.value = settings.questions || 10; p.type = "number"; p.id = "calcP"; p.min = 50; p.max = 100; p.value = settings.pass || 80; v.type = "checkbox"; v.id = "calcV"; v.checked = settings.voice !== false;
      var lq = el("label", "", "Nombre de questions par série (5 à 20)"); lq.setAttribute("for", "calcQ"); qd.appendChild(lq); qd.appendChild(q); f.appendChild(qd);
      var lp = el("label", "", "Une série est réussie à partir de … % de bonnes réponses du premier coup (50 à 100)"); lp.setAttribute("for", "calcP"); pd.appendChild(lp); pd.appendChild(p); f.appendChild(pd);
      var lv = el("label", "", ""); lv.style.display = "flex"; lv.style.gap = "8px"; lv.style.alignItems = "center"; v.style.width = v.style.height = "20px"; lv.appendChild(v); lv.appendChild(document.createTextNode("Lire automatiquement le nombre à voix haute (ÉCOUTER)")); vd.appendChild(lv); f.appendChild(vd);
      var boxes = {}, orders = {}, lists = {};
      /* Une colonne par domaine : étapes numérotées dans l'ordre où les élèves les verront, avec ▲ / ▼ ; ordre = étapes cochées d'abord (dans l'ordre enregistré), les autres ensuite */
      Object.keys(ACT).forEach(function (a) {
        var fs = el("fieldset"), lg = el("legend", "", ACT[a].icon + " " + ACT[a].title + " — étapes proposées aux élèves, dans l’ordre"), list = el("ol", "calc-order"), on = enabled(a);
        fs.style.border = "0"; fs.style.padding = "0"; fs.style.margin = "0"; lg.style.fontWeight = "800"; fs.appendChild(lg);
        orders[a] = on.concat(E.LEVELS[a].map(function (l) { return l.id; }).filter(function (id) { return on.indexOf(id) < 0; })); boxes[a] = {}; lists[a] = list;
        orders[a].forEach(function (id) { boxes[a][id] = on.indexOf(id) >= 0; });
        fs.appendChild(list); f.appendChild(fs); paint(a);
      });
      function paint(a) {
        var list = lists[a], ord = orders[a]; clear(list);
        ord.forEach(function (id, i) {
          var lv2 = E.levelInfo(a, id), li = el("li", "calc-step"), cb = el("input"), lab = el("label"), up = el("button", "secondary mv", "▲"), dn = el("button", "secondary mv", "▼");
          cb.type = "checkbox"; cb.value = id; cb.checked = !!boxes[a][id]; cb.addEventListener("change", function () { boxes[a][id] = cb.checked; });
          lab.appendChild(el("span", "n", (i + 1) + ".")); lab.appendChild(cb); lab.appendChild(document.createTextNode(" " + lv2.animal.e + " " + lv2.label));
          up.type = dn.type = "button"; up.setAttribute("aria-label", "Monter l’étape " + lv2.label); dn.setAttribute("aria-label", "Descendre l’étape " + lv2.label); up.disabled = i === 0; dn.disabled = i === ord.length - 1;
          up.addEventListener("click", function () { ord.splice(i, 1); ord.splice(i - 1, 0, id); paint(a); queue(); }); dn.addEventListener("click", function () { ord.splice(i, 1); ord.splice(i + 1, 0, id); paint(a); queue(); });
          li.appendChild(lab); li.appendChild(up); li.appendChild(dn); list.appendChild(li);
        });
      }
      f.appendChild(el("p", "muted", "L’élève ne voit que les étapes déjà réussies et la suivante : l’ordre des étapes est celui de cette liste (cochez celles que vous proposez)."));
      function collect() {
        var levels = {}; Object.keys(orders).forEach(function (a) { levels[a] = orders[a].filter(function (id) { return boxes[a][id]; }); });
        return { questions: +q.value, pass: +p.value, voice: v.checked, levels: levels };
      }
      var okTimer = null;
      function setState(t, cls) { st.textContent = t; st.className = "save-state " + (cls || ""); }
      function flush() {
        var s2 = collect(); if (Object.keys(s2.levels).some(function (k) { return !s2.levels[k].length; })) { setState("⚠️ Gardez au moins une étape par activité.", "err"); return; }
        rpc("lab_teacher_settings_set", { p_settings: s2 }).then(function (r) { settings = r || {}; setState("✓ Enregistré", "ok"); clearTimeout(okTimer); okTimer = setTimeout(function () { if (st.className.indexOf("ok") >= 0) setState("", ""); }, 2000); }).catch(function () { setState("⚠️ Non enregistré : vérifiez la connexion. Nouvel essai dans quelques secondes.", "err"); saveTimer = setTimeout(flush, 5000); });
      }
      function queue() { setState("Modifications en cours…", "pending"); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 1000); }
      f.addEventListener("input", queue); f.addEventListener("change", queue);
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
    box.appendChild(head("🔐", "Accès au laboratoire de calcul", "Réservé à l’administrateur : qui voit le Zoo de Calcul."));
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
