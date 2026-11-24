/* Parcours GS — définitions pédagogiques DÉCLARATIVES et moteur de progression (aucun accès réseau, aucun écran).
   Chargé par zoo-connecte.html (élève) et enseignants.html (suivi) ; testable sous Node (tools/test_gs.js). Syntaxe ES2018 (iPad iOS 12).
   Voir docs/parcours-gs/avancement.md : stockage progress.gs (élève) et settings.gs / settings.tracks (enseignant).

   Vocabulaire : compétence (ex. « cap » = nom des lettres en capitales) → paliers (groupe de lettres × nombre de propositions)
   → séries de questions. Un palier est validé après `series` séries réussies D'AFFILÉE (≥ `seuil` %) sans aide ;
   2 séries ratées d'affilée → mode aide (moins de propositions + démonstration) ; une série réussie avec aide fait
   revenir au niveau normal mais ne valide jamais. */
(function (root) {
  "use strict";
  /* Nom oral des lettres (texte donné à la voix de l'appareil ; écrit comme il se prononce) */
  var LETTER_SAY = { A: "a", B: "bé", C: "cé", D: "dé", E: "e", F: "èf", G: "jé", H: "ache", I: "i", J: "ji", K: "ka", L: "èl", M: "èm",
    N: "ènne", O: "o", P: "pé", Q: "ku", R: "èr", S: "èss", T: "té", U: "u", V: "vé", W: "double vé", X: "iks", Y: "i grec", Z: "zèd" };
  /* Lettres qui se confondent (forme ou nom) : jamais dans le même groupe au début, distracteurs « pertinents » à partir de 3 propositions */
  var CONFUS = { B: "DPR", D: "BPOT", P: "BDQR", Q: "PO", M: "NW", N: "MUH", U: "NV", V: "UY", W: "MV", E: "F", F: "EP", C: "GO", G: "CJ", O: "QCD",
    I: "JL", J: "IG", L: "I", T: "DI", K: "X", X: "K", Y: "V", H: "N", R: "PB", S: "Z", Z: "S", A: "" };
  /* Confusions propres aux minuscules (script) et à la cursive, ajoutées aux précédentes quand l'activité montre ces écritures */
  var CONFUS_W = { script: { I: "LJ", L: "IT", H: "N", A: "O", O: "A", G: "Q", F: "T", T: "F", U: "N" },
    curs: { E: "L", L: "EB", B: "LF", F: "B", A: "OD", O: "A", N: "MU", U: "NI", R: "S", S: "R", I: "U" } };
  /* Progression par défaut (choisie le 23/11/2026 d'après eduscol : partir des lettres du prénom, travailler nom/forme en aller-retour,
     séparer les lettres proches b/d/p/q, m/n, n/u, t/d ; lettres rares h k q w x y z en dernier). Modifiable par l'enseignant (settings.gs). */
  /* 24/11/2026, choisi par Gabriel (réglage « A ») : 2 puis 4 choix (le niveau « 3 choix » est sauté) → lettres 53 étapes, nombres 23 ; avant : 73 et 29 */
  var DEFAULTS = {
    lecture: {
      prenom: true,                      /* 1er groupe = lettres du prénom de l'élève (si au moins 2 lettres différentes) */
      groups: ["AIORLS", "EUMTFB", "PNCVJZ", "DGQKHYXW"],
      cap: { on: true, props: [2, 4], questions: 10, seuil: 80, series: 2 },
      capscript: { on: true, props: [2, 4], questions: 10, seuil: 80, series: 2 },
      script: { on: true, props: [2, 4], questions: 10, seuil: 80, series: 2 },
      scriptcurs: { on: true, props: [2, 4], questions: 10, seuil: 80, series: 2 },
      curs: { on: true, props: [2, 4], questions: 10, seuil: 80, series: 2 },
      ordre: { on: true, props: [3, 4, 5], questions: 6, seuil: 80, series: 2 }
    }
  };
  /* Compétences de la Lecture GS (cahier des charges 4.2 à 4.7), dans l'ordre du parcours de CHAQUE groupe de lettres (4.8) :
     capitales → capitale/script → script → script/cursive → cursive, puis l'ordre alphabétique (transversal, lettres déjà vues).
     act : « nom » = la voix dit une lettre, l'élève la touche dans l'écriture w ; « assoc » = une lettre écrite en a (ou b), la trouver en b (ou a) ;
     « ordre » = toucher les lettres dans l'ordre de l'alphabet. Écritures : cap = capitale, script = minuscule d'imprimerie (Andika), curs = cursive (Marelle). */
  var COMPS = {
    lecture: [
      { id: "cap", nom: "Les lettres capitales", court: "Capitales", act: "nom", w: "cap", mission: "les lettres capitales" },
      { id: "capscript", nom: "Capitales et minuscules", court: "Capitale ↔ script", act: "assoc", a: "cap", b: "script", mission: "les capitales et les minuscules" },
      { id: "script", nom: "Les lettres minuscules (script)", court: "Script", act: "nom", w: "script", mission: "les lettres minuscules" },
      { id: "scriptcurs", nom: "Minuscules et lettres attachées", court: "Script ↔ cursive", act: "assoc", a: "script", b: "curs", mission: "les minuscules et les lettres attachées" },
      { id: "curs", nom: "Les lettres attachées (cursive)", court: "Cursive", act: "nom", w: "curs", mission: "les lettres attachées" },
      { id: "ordre", nom: "L’ordre alphabétique", court: "Ordre alphabétique", act: "ordre", w: "cap", mission: "l’ordre des lettres" }
    ]
  };
  var COMP = {}; COMPS.lecture.forEach(function (c) { COMP[c.id] = c; });
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clampInt(v, a, b, d) { v = Math.round(Number(v)); return isFinite(v) && v >= a && v <= b ? v : d; }
  function letters(s) { var out = []; String(s || "").toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "").split("").forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); }); return out; }
  /* Réglages effectifs = défauts complétés par ceux de l'enseignant (settings.gs), valeurs hors limites ramenées aux défauts */
  function config(own) {
    var d = clone(DEFAULTS.lecture), o = own && own.lecture && typeof own.lecture === "object" ? own.lecture : {};
    if (typeof o.prenom === "boolean") d.prenom = o.prenom;
    if (Array.isArray(o.groups)) {
      var seen = {}, gs = o.groups.map(function (g) { return letters(g).filter(function (c) { if (seen[c]) return false; seen[c] = 1; return true; }).join(""); }).filter(function (g) { return g.length >= 2; });
      if (gs.length) d.groups = gs;
    }
    COMPS.lecture.forEach(function (k) {
      var id = k.id, c = o[id] && typeof o[id] === "object" ? o[id] : {}, lo = k.act === "ordre" ? 3 : 2, hi = k.act === "ordre" ? 8 : 4;
      if (typeof c.on === "boolean") d[id].on = c.on;
      if (Array.isArray(c.props)) { var p = c.props.map(function (n) { return clampInt(n, lo, hi, 0); }).filter(Boolean).sort(function (x, y) { return x - y; }); if (p.length) d[id].props = p.filter(function (n, i) { return p.indexOf(n) === i; }); }
      d[id].questions = clampInt(c.questions, 4, 20, d[id].questions);
      d[id].seuil = clampInt(c.seuil, 50, 100, d[id].seuil);
      d[id].series = clampInt(c.series, 1, 4, d[id].series);
    });
    if (!COMPS.lecture.some(function (k) { return d[k.id].on; })) d.cap.on = true;   /* au moins une activité */
    return d;
  }
  /* Groupes de l'élève : son prénom d'abord (lettres retirées des groupes suivants), puis les groupes du réglage ; toutes les lettres restantes à la fin */
  function groupsFor(cfg, prenom) {
    var first = cfg.prenom ? letters(prenom) : [], out = [];
    if (first.length >= 2) out.push({ id: "prenom", letters: first });
    var used = first.slice();
    cfg.groups.forEach(function (g, i) { var l = letters(g).filter(function (c) { return used.indexOf(c) < 0; }); used = used.concat(l); if (l.length) out.push({ id: "g" + (i + 1), letters: l }); });
    var rest = Object.keys(LETTER_SAY).filter(function (c) { return used.indexOf(c) < 0; });
    if (rest.length) { if (rest.length === 1 && out.length) out[out.length - 1].letters.push(rest[0]); else out.push({ id: "fin", letters: rest }); }
    return out;
  }
  /* Paliers d'une compétence : chaque groupe × chaque nombre de propositions. Les lettres des groupes déjà vus servent aussi de distracteurs. */
  function steps(comp, cfg, prenom) {
    var gs = groupsFor(cfg, prenom), c = cfg[comp], out = [], seen = [], lastO = 0;
    gs.forEach(function (g, gi) {
      seen = seen.concat(g.letters);
      if (COMP[comp].act === "ordre") {   /* un palier par groupe : 3 lettres au 1er groupe, 4 au 2e, 5 ensuite (props) ; toujours les lettres déjà vues */
        var o = Math.min(c.props[Math.min(gi, c.props.length - 1)], seen.length);
        if (o >= 3 && o !== lastO) { lastO = o; out.push({ key: g.id + "-" + o, group: gi + 1, groupId: g.id, targets: g.letters.slice(), pool: seen.slice(), n: o }); }
        return;
      }
      var lastN = 0;
      c.props.forEach(function (n) {
        var m = Math.min(n, seen.length);
        if (m === lastN) return;   /* petit groupe au début : pas deux paliers identiques */
        lastN = m;
        out.push({ key: g.id + "-" + m, group: gi + 1, groupId: g.id, targets: g.letters.slice(), pool: seen.slice(), n: m });
      });
    });
    return out;
  }
  function shuffle(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  /* Une série : chaque lettre du groupe revient à peu près autant de fois, jamais deux fois de suite ; distracteurs pris dans les lettres déjà vues
     (une lettre « proche » parmi eux dès 3 propositions) ; place de la bonne réponse variable. aid = moins de propositions. */
  function buildSeries(step, cfg, comp, aid, rnd) {
    rnd = rnd || Math.random;
    var nq = cfg[comp].questions, n = aid ? Math.max(2, step.n - 1) : step.n, targets = [], last = null, qs = [], K = COMP[comp] || COMP.cap;
    if (K.act === "ordre") return buildOrder(step, nq, aid ? Math.max(2, step.n - 1) : step.n, rnd, aid);
    while (targets.length < nq) {
      var round = shuffle(step.targets.slice(), rnd);
      if (targets.length && round.length > 1 && round[0] === targets[targets.length - 1]) round.push(round.shift());
      targets = targets.concat(round);
    }
    targets = targets.slice(0, nq);
    targets.forEach(function (t) {
      var wx = CONFUS_W[K.w || K.b] || {}, others = step.pool.filter(function (c) { return c !== t; }), near = ((CONFUS[t] || "") + (wx[t] || "")).split("").filter(function (c) { return others.indexOf(c) >= 0; });
      var pick = [];
      if (n >= 3 && near.length) pick.push(near[Math.floor(rnd() * near.length)]);
      shuffle(others.filter(function (c) { return pick.indexOf(c) < 0; }), rnd).forEach(function (c) { if (pick.length < n - 1) pick.push(c); });
      var opts = shuffle(pick.concat([t]), rnd);
      if (last !== null && opts.indexOf(t) === last && opts.length > 1) { var j = (last + 1) % opts.length; opts[last] = opts[j]; opts[j] = t; }
      last = opts.indexOf(t);
      qs.push({ t: t, opts: opts });
    });
    if (K.act === "assoc") { var d0 = rnd() < 0.5 ? 0 : 1; qs.forEach(function (q, i) { q.dir = (i + d0) % 2; }); }   /* dir 0 : modèle en a, réponses en b ; 1 : l'inverse */
    return { n: n, aid: !!aid, qs: qs };
  }
  /* Ordre alphabétique : n lettres parmi celles déjà vues (au moins une du groupe en cours), présentées mélangées (jamais déjà rangées) */
  function buildOrder(step, nq, n, rnd, aid) {
    var qs = [], prev = "";
    for (var k = 0; k < nq; k++) {
      var seq, key, tries = 0;
      do {
        var t = step.targets[Math.floor(rnd() * step.targets.length)];
        seq = [t].concat(shuffle(step.pool.filter(function (c) { return c !== t; }), rnd).slice(0, n - 1)).sort();
        key = seq.join("");
      } while (key === prev && ++tries < 8);
      prev = key;
      var opts = shuffle(seq.slice(), rnd);
      if (opts.join("") === key) opts.push(opts.shift());
      qs.push({ t: key, seq: seq, opts: opts });
    }
    return { n: n, aid: !!aid, qs: qs };
  }
  /* Parcours complet de l'élève : pour chaque groupe, les paliers de chaque activité active dans l'ordre de COMPS (4.8).
     Chaque élément = { comp, step } ; le palier en cours est le premier non validé (validations rangées par activité). */
  function path(cfg, prenom) {
    var lists = {}, out = [], ng = groupsFor(cfg, prenom).length;
    COMPS.lecture.forEach(function (k) { if (cfg[k.id].on) lists[k.id] = steps(k.id, cfg, prenom); });
    for (var g = 1; g <= ng; g++) COMPS.lecture.forEach(function (k) { (lists[k.id] || []).forEach(function (s) { if (s.group === g) out.push({ comp: k.id, step: s }); }); });
    return out;
  }
  function lecState(lec) { lec = lec && typeof lec === "object" ? lec : {}; var o = {}; COMPS.lecture.forEach(function (k) { o[k.id] = compState(lec[k.id]); }); return o; }
  function pathCurrent(st, items) { for (var i = 0; i < items.length; i++) if (!(st[items[i].comp] && st[items[i].comp].val[items[i].step.key])) return i; return -1; }
  /* Avancement global (enseignant) : étapes validées sur tout le parcours, étape en cours, statut */
  function pathSummary(st, items, series) {
    var done = items.filter(function (x) { return st[x.comp] && st[x.comp].val[x.step.key]; }).length, i = pathCurrent(st, items), last = (series || []).slice(-3), cur = i >= 0 ? items[i] : null;
    var status = done === 0 && !(series || []).length ? "nouveau" : (!cur ? "maitrise" : ((st[cur.comp] && st[cur.comp].aid) || (last.length >= 2 && last.every(function (x) { return !x.ok; }))) ? "difficulte" : "en_cours");
    return { done: done, total: items.length, pct: items.length ? Math.round(done * 100 / items.length) : 0, current: i, item: cur, status: status };
  }
  /* État d'une compétence dans progress.gs.lecture[comp] = { i, ok, ko, aid, val:{clé:ts} } */
  function compState(p) {
    p = p && typeof p === "object" ? p : {};
    var val = {};
    if (p.val && typeof p.val === "object") Object.keys(p.val).forEach(function (k) { if (typeof p.val[k] === "number") val[k] = p.val[k]; });
    return { i: clampInt(p.i, 0, 999, 0), ok: clampInt(p.ok, 0, 9, 0), ko: clampInt(p.ko, 0, 99, 0), aid: !!p.aid, val: val };
  }
  /* Palier en cours = le premier non validé (la liste des paliers peut changer si l'enseignant change les groupes : on se repère aux clés validées) */
  function current(st, list) { for (var i = 0; i < list.length; i++) if (!st.val[list[i].key]) return i; return -1; }
  /* Fin de série : applique la règle de validation et renvoie ce qui s'est passé */
  function record(st, list, cfg, comp, good, total, aid, now) {
    var c = cfg[comp], ok = total > 0 && good * 100 >= c.seuil * total, i = current(st, list), res = { ok: ok, validated: false, aidOn: false, aidOff: false, step: i };
    if (i < 0) return res;   /* tout est validé : série d'entraînement libre */
    if (st.i !== i) { st.i = i; st.ok = 0; st.ko = 0; st.aid = false; }
    if (aid) {
      if (ok) { st.aid = false; st.ko = 0; res.aidOff = true; }
      return res;   /* une série aidée ne valide jamais */
    }
    if (ok) {
      st.ko = 0; st.ok++;
      if (st.ok >= c.series) { st.val[list[i].key] = now; st.ok = 0; st.i = current(st, list); res.validated = true; }
    } else {
      st.ok = 0; st.ko++;
      if (st.ko >= 2) { st.aid = true; res.aidOn = true; }
    }
    return res;
  }
  /* Avancement pour l'enseignant : paliers validés / total (jamais 100 % pour une seule série), statut */
  function summary(st, list, series) {
    var done = list.filter(function (s) { return st.val[s.key]; }).length, i = current(st, list), last = (series || []).slice(-3);
    var status = done === 0 && !(series || []).length ? "nouveau" : (i < 0 ? "maitrise" : (st.aid || (last.length >= 2 && last.every(function (x) { return !x.ok; })) ? "difficulte" : "en_cours"));
    return { done: done, total: list.length, pct: list.length ? Math.round(done * 100 / list.length) : 0, current: i, status: status };
  }
  function stepLabel(s, comp) {
    var g = s.groupId === "prenom" ? "Lettres du prénom" : s.groupId === "fin" ? "Dernières lettres" : "Groupe " + s.group;
    if (comp && COMP[comp] && COMP[comp].act === "ordre") return COMP[comp].court + " · " + s.n + " lettres";
    return (comp && COMP[comp] ? COMP[comp].court + " · " : "") + g + " · " + s.n + " choix";
  }
  /* Toile d'araignée GS (cahier 10.2–10.3) : un axe par activité PROPOSÉE (les activités désactivées n'apparaissent pas, T12), dans l'ordre du cahier.
     v = étapes validées ÷ étapes attendues à cette date (frac = semaines d'école écoulées / 36 ; au moins 1 attendue) × 100 ; une série seule ne valide jamais une étape.
     status : nouveau (rien fait), en_cours, maitrise (toutes validées), difficulte (aide activée sur l'étape en cours de l'activité). */
  var WEB = [["cap", "Capitales"], ["ordre", "Alphabet"], ["capscript", "Capitales/script"], ["script", "Script"], ["scriptcurs", "Script/cursive"], ["curs", "Cursive"]];
  function radar(cfg, prenom, st, series, frac) {
    var items = path(cfg, prenom), f = Math.max(0, Math.min(1, Number(frac) || 0)), ser = Array.isArray(series) ? series : [];
    return WEB.filter(function (w) { return cfg[w[0]] && cfg[w[0]].on; }).map(function (w) {
      var id = w[0], its = items.filter(function (x) { return x.comp === id; }), s = st[id] || compState(null);
      var done = its.filter(function (x) { return s.val[x.step.key]; }).length, total = its.length, exp = total ? Math.max(1, Math.min(total, Math.round(total * f))) : 0;
      var tried = ser.some(function (x) { return x && (x.c || "cap") === id; });
      var status = total && done >= total ? "maitrise" : s.aid ? "difficulte" : done || tried ? "en_cours" : "nouveau";
      return { k: id, name: w[1], nom: COMP[id].nom, done: done, total: total, exp: exp, v: exp ? Math.round(done * 100 / exp) : null, status: status };
    });
  }
  /* Une lettre dans une écriture (capitale, script, cursive) : le texte à afficher ; la police est donnée par la classe CSS w-<écriture> */
  function glyph(L, w) { return w === "cap" ? L : L.toLowerCase(); }
  /* ===================== GS CALCUL (cahier 5.1 à 5.6, étape E) =====================
     Même règle que les lettres : palier validé après `series` séries réussies D'AFFILÉE (≥ seuil %) sans aide ; 2 séries ratées d'affilée → aide ;
     une série aidée réussie fait revenir au niveau normal sans valider. Différence : l'état est rangé PAR PALIER et tenu par le SERVEUR
     (lab_student_submit_round, activité « gs », niveau = clé du palier « chiffres-r1-2 » ; migration 20261209), dans lab_calc_progress.progress :
     gs = { clé: {r, q, c, h, n, ok, ko, aid, val, last} } · gsh = 60 dernières séries · gsw = roues gagnées (une par série réussie) · gsr = date de la comptine.
     `calcRecord` reproduit exactement la règle du serveur (affichage immédiat, tests). Paliers numériques obligatoires : 1–3, 1–5, 0–9 (zéro au 3e). */
  var RANGES = [[1, 3], [1, 5], [0, 9]];
  DEFAULTS.calcul = {
    chiffres: { on: true, props: [2, 4], questions: 10, seuil: 80, series: 2 },
    ordre: { on: true, props: [3], questions: 6, seuil: 80, series: 2 },
    denombre: { on: true, props: [2, 4], questions: 10, seuil: 80, series: 2 },
    compare: { on: true, autant: true, questions: 8, seuil: 80, series: 2 },
    collec: { on: true, questions: 6, seuil: 80, series: 2 }
  };
  /* act : « num » = la voix dit un nombre, toucher le chiffre ; « ordre » = toucher les nombres du plus petit au plus grand ; « compte » = combien d'animaux ?
     « compare » = où y en a-t-il le plus / le moins / autant ; « collec » = mettre n animaux dans l'enclos puis valider. */
  COMPS.calcul = [
    { id: "chiffres", nom: "Reconnaître les chiffres", court: "Chiffres", act: "num", mission: "les chiffres" },
    { id: "ordre", nom: "L’ordre des nombres", court: "Ordre numérique", act: "ordre", mission: "l’ordre des nombres" },
    { id: "denombre", nom: "Compter une collection", court: "Dénombrement", act: "compte", mission: "compter les animaux" },
    { id: "compare", nom: "Comparer deux collections", court: "Comparaison", act: "compare", mission: "comparer les collections" },
    { id: "collec", nom: "Construire une collection", court: "Construction", act: "collec", mission: "remplir l’enclos" }
  ];
  var CCOMP = {}; COMPS.calcul.forEach(function (c) { CCOMP[c.id] = c; });
  var NUM_SAY = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf", "vingt"];
  var CONFUS_NUM = { 6: [9], 9: [6], 1: [7], 7: [1], 2: [5], 5: [2], 3: [8], 8: [3, 0], 0: [8] };
  var CALC_ANIMALS = ["🐥", "🐸", "🐢", "🐞", "🐟", "🐰", "🦊", "🐼", "🐷", "🐮"];
  function calcConfig(own) {
    var d = clone(DEFAULTS.calcul), o = own && own.calcul && typeof own.calcul === "object" ? own.calcul : {};
    COMPS.calcul.forEach(function (k) {
      var id = k.id, c = o[id] && typeof o[id] === "object" ? o[id] : {}, lo = k.act === "ordre" ? 3 : 2, hi = k.act === "ordre" ? 6 : 4;
      if (typeof c.on === "boolean") d[id].on = c.on;
      if (d[id].props && Array.isArray(c.props)) { var p = c.props.map(function (n) { return clampInt(n, lo, hi, 0); }).filter(Boolean).sort(function (x, y) { return x - y; }); if (p.length) d[id].props = p.filter(function (n, i) { return p.indexOf(n) === i; }); }
      if (id === "compare" && typeof c.autant === "boolean") d[id].autant = c.autant;
      d[id].questions = clampInt(c.questions, 4, 20, d[id].questions);
      d[id].seuil = clampInt(c.seuil, 50, 100, d[id].seuil);   /* mêmes bornes que le serveur */
      d[id].series = clampInt(c.series, 1, 4, d[id].series);
    });
    if (!COMPS.calcul.some(function (k) { return d[k.id].on; })) d.chiffres.on = true;
    return d;
  }
  function range(lo, hi) { var a = []; for (var i = lo; i <= hi; i++) a.push(i); return a; }
  /* Paliers d'une activité du calcul ; key = clé du serveur (comp + "-" + palier, au plus 20 caractères) */
  function calcSteps(comp, cfg) {
    var c = cfg[comp], act = CCOMP[comp].act, out = [];
    RANGES.forEach(function (r, ri) {
      var pool = range(r[0], r[1]), base = comp + "-r" + (ri + 1), last = 0;
      function add(suffix, n, extra) { var s = { key: base + suffix, comp: comp, range: ri + 1, lo: r[0], hi: r[1], pool: pool, n: n }; for (var k in extra || {}) s[k] = extra[k]; out.push(s); }
      if (act === "num" || act === "compte" || act === "ordre") {
        c.props.forEach(function (n) { var m = Math.min(n, pool.length); if (m === last) return; last = m; add("-" + m, m, act === "ordre" ? { consec: true } : null); });
        if (act === "ordre" && pool.length >= 6) add("-" + last + "x", last, { consec: false });   /* dernier palier : nombres non consécutifs */
      } else add("", 2, null);
    });
    if (comp === "compare" && c.autant) { var r3 = RANGES[1]; out.push({ key: "compare-eq", comp: comp, range: 4, lo: r3[0], hi: r3[1], pool: range(r3[0], r3[1]), n: 2, eq: true }); }   /* « autant » : seulement dans ce palier */
    return out;
  }
  /* Parcours du calcul : pour chaque intervalle 1–3, 1–5, 0–9 : chiffres → ordre → dénombrement → comparaison → construction */
  function calcPath(cfg) {
    var lists = {}, out = [];
    COMPS.calcul.forEach(function (k) { if (cfg[k.id].on) lists[k.id] = calcSteps(k.id, cfg); });
    for (var g = 1; g <= RANGES.length + 1; g++) COMPS.calcul.forEach(function (k) { (lists[k.id] || []).forEach(function (s) { if (s.range === g) out.push({ comp: k.id, step: s }); }); });
    return out;
  }
  /* État de progress.gs du calcul (venu du serveur) : { clé: {ok, ko, aid, val, r, n, …} } nettoyé */
  function calcState(p) {
    p = p && typeof p === "object" && !Array.isArray(p) ? p : {};
    var o = {};
    Object.keys(p).forEach(function (k) {
      var x = p[k]; if (!x || typeof x !== "object" || !/^[a-z]+-[a-z0-9-]{1,14}$/.test(k)) return;
      o[k] = { r: clampInt(x.r, 0, 1e6, 0), q: clampInt(x.q, 0, 1e7, 0), c: clampInt(x.c, 0, 1e7, 0), h: clampInt(x.h, 0, 1e6, 0), n: clampInt(x.n, 0, 1e6, 0),
        ok: clampInt(x.ok, 0, 9, 0), ko: clampInt(x.ko, 0, 99, 0), aid: x.aid === true, val: typeof x.val === "string" && x.val ? x.val : null, last: typeof x.last === "string" ? x.last : null };
    });
    return o;
  }
  function calcItem(st, key) { return st[key] || { r: 0, q: 0, c: 0, h: 0, n: 0, ok: 0, ko: 0, aid: false, val: null, last: null }; }
  function calcCurrent(st, items) { for (var i = 0; i < items.length; i++) if (!calcItem(st, items[i].step.key).val) return i; return -1; }
  /* Règle de fin de série (copie exacte de public.lab__gs_round) ; modifie st[key] et renvoie ce qui s'est passé */
  function calcRecord(st, key, c, good, total, aid, now, helps) {
    var x = st[key] = clone(calcItem(st, key)), ok = total > 0 && good * 100 >= c.seuil * total, wasAid = x.aid || !!aid, res = { ok: ok, validated: false, aidOn: false, aidOff: false, aid: wasAid };
    x.r++; x.q += total; x.c += good; x.h += helps || 0; if (ok) x.n++; x.last = now;
    if (!x.val) {
      if (wasAid) { if (ok) { x.aid = false; x.ko = 0; res.aidOff = true; } }
      else if (ok) { x.ko = 0; x.ok++; if (x.ok >= c.series) { x.val = now; x.ok = 0; res.validated = true; } }
      else { x.ok = 0; x.ko++; if (x.ko >= 2) { x.aid = true; res.aidOn = true; } }
    }
    return res;
  }
  function calcSummary(st, items, series) {
    var done = items.filter(function (x) { return calcItem(st, x.step.key).val; }).length, i = calcCurrent(st, items), cur = i >= 0 ? items[i] : null, last = (series || []).slice(-3);
    var status = done === 0 && !(series || []).length ? "nouveau" : (!cur ? "maitrise" : (calcItem(st, cur.step.key).aid || (last.length >= 2 && last.every(function (x) { return !x.ok; }))) ? "difficulte" : "en_cours");
    return { done: done, total: items.length, pct: items.length ? Math.round(done * 100 / items.length) : 0, current: i, item: cur, status: status };
  }
  function calcStepLabel(s) {
    var r = s.eq ? "autant" : s.lo + " à " + s.hi, k = CCOMP[s.comp];
    if (k.act === "ordre") return k.court + " · " + r + " · " + s.n + " nombres" + (s.consec ? "" : " dans le désordre");
    if (k.act === "num" || k.act === "compte") return k.court + " · " + r + " · " + s.n + " choix";
    return k.court + " · " + r;
  }
  /* Choix : la bonne réponse + des nombres proches (voisins, 6/9…), place variable, jamais deux fois la même cible de suite */
  function numQs(step, nq, n, rnd) {
    var targets = [], qs = [], last = -1;
    while (targets.length < nq) { var round = shuffle(step.pool.slice(), rnd); if (targets.length && round.length > 1 && round[0] === targets[targets.length - 1]) round.push(round.shift()); targets = targets.concat(round); }
    targets = targets.slice(0, nq);
    if (step.lo === 0 && targets.indexOf(0) < 0) {   /* palier avec zéro : il est toujours demandé au moins une fois */
      for (var z = Math.floor(rnd() * targets.length), tries = 0; tries < targets.length; tries++, z = (z + 1) % targets.length) {
        if (targets[z - 1] !== 0 && targets[z + 1] !== 0 && targets[z] !== 0) { targets[z] = 0; break; }
      }
    }
    targets.forEach(function (t) {
      var others = step.pool.filter(function (x) { return x !== t; }), near = [t - 1, t + 1].concat(CONFUS_NUM[t] || []).filter(function (x) { return others.indexOf(x) >= 0; }), pick = [];
      if (n >= 3 && near.length) pick.push(near[Math.floor(rnd() * near.length)]);
      shuffle(others.filter(function (x) { return pick.indexOf(x) < 0; }), rnd).forEach(function (x) { if (pick.length < n - 1) pick.push(x); });
      var opts = shuffle(pick.concat([t]), rnd);
      if (last >= 0 && opts.indexOf(t) === last && opts.length > 1) { var j = (last + 1) % opts.length; opts[last] = opts[j]; opts[j] = t; }
      last = opts.indexOf(t);
      qs.push({ t: t, opts: opts });
    });
    return qs;
  }
  var LAYOUTS = ["ligne", "vrac", "serre", "espace", "de"];
  function buildCalcSeries(step, cfg, aid, rnd) {
    rnd = rnd || Math.random;
    var comp = step.comp, act = CCOMP[comp].act, nq = cfg[comp].questions, qs = [], n = aid ? Math.max(2, step.n - 1) : step.n, prev = "";
    function animal() { return CALC_ANIMALS[Math.floor(rnd() * CALC_ANIMALS.length)]; }
    if (act === "num" || act === "compte") {
      qs = numQs(step, nq, n, rnd);
      if (act === "compte") qs.forEach(function (q, i) { q.e = animal(); q.lay = aid ? "ligne" : LAYOUTS[(i + Math.floor(rnd() * LAYOUTS.length)) % LAYOUTS.length]; });
    } else if (act === "ordre") {
      var len = aid ? Math.max(2, step.n - 1) : step.n;
      for (var k = 0; k < nq; k++) {
        var seq, key, tries = 0;
        do {
          if (step.consec !== false) { var s0 = step.lo + Math.floor(rnd() * (step.hi - step.lo - len + 2)); seq = range(s0, s0 + len - 1); }
          else { seq = shuffle(step.pool.slice(), rnd).slice(0, len).sort(function (a, b) { return a - b; }); if (seq[len - 1] - seq[0] === len - 1) seq = null; }
          key = seq ? seq.join(",") : "";
        } while ((!seq || key === prev) && ++tries < 20);
        if (!seq) seq = [step.lo, step.lo + 2, step.hi].slice(0, len);
        prev = key;
        var opts = shuffle(seq.slice(), rnd); if (opts.join(",") === seq.join(",")) opts.push(opts.shift());
        qs.push({ t: seq.join(","), seq: seq, opts: opts });
      }
      n = len;
    } else if (act === "compare") {
      for (var m = 0; m < nq; m++) {
        var a, b, ask, t;
        if (step.eq) {   /* modèle + deux enclos : l'un en a autant, l'autre non */
          var mod = step.lo + Math.floor(rnd() * (step.hi - step.lo + 1)), other;
          do { other = step.lo + Math.floor(rnd() * (step.hi - step.lo + 1)); } while (other === mod);
          t = rnd() < 0.5 ? 0 : 1; a = t === 0 ? mod : other; b = t === 0 ? other : mod;
          qs.push({ ask: "autant", model: mod, a: a, b: b, t: t, e: animal(), lay: [LAYOUTS[Math.floor(rnd() * 4)], LAYOUTS[Math.floor(rnd() * 4)]] });
          continue;
        }
        var tries2 = 0;
        do { a = step.lo + Math.floor(rnd() * (step.hi - step.lo + 1)); b = step.lo + Math.floor(rnd() * (step.hi - step.lo + 1)); } while ((a === b || a + "," + b === prev) && ++tries2 < 30);
        if (a === b) b = a === step.hi ? a - 1 : a + 1;
        prev = a + "," + b;
        ask = rnd() < 0.5 ? "plus" : "moins";
        t = ask === "plus" ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
        /* pas de réponse « à la surface » : la collection la plus nombreuse est souvent dessinée plus petite ou plus serrée */
        var bigSide = a > b ? 0 : 1, trick = rnd() < 0.6, sizes = [1, 1];
        if (!aid && trick) { sizes[bigSide] = 0.8; sizes[1 - bigSide] = 1.15; }
        qs.push({ ask: ask, a: a, b: b, t: t, e: animal(), sizes: sizes, lay: aid ? ["ligne", "ligne"] : [LAYOUTS[Math.floor(rnd() * 4)], LAYOUTS[Math.floor(rnd() * 4)]] });
      }
    } else {   /* construction : chaque nombre de l'intervalle revient, zéro compris au 3e palier */
      qs = numQs(step, nq, 1, rnd).map(function (q) { return { t: q.t, e: animal() }; });
    }
    return { n: n, aid: !!aid, qs: qs };
  }
  var WEB_CALC = [["chiffres", "Chiffres"], ["ordre", "Ordre"], ["denombre", "Compter"], ["compare", "Comparer"], ["collec", "Construire"]];
  /* Toile GS du calcul (cahier 10.2) : une branche par activité proposée, % des paliers attendus à cette date (frac = semaines / 36) */
  function calcRadar(cfg, st, series, frac) {
    var items = calcPath(cfg), f = Math.max(0, Math.min(1, Number(frac) || 0)), ser = Array.isArray(series) ? series : [];
    return WEB_CALC.filter(function (w) { return cfg[w[0]] && cfg[w[0]].on; }).map(function (w) {
      var id = w[0], its = items.filter(function (x) { return x.comp === id; }), done = its.filter(function (x) { return calcItem(st, x.step.key).val; }).length, total = its.length;
      var exp = total ? Math.max(1, Math.min(total, Math.round(total * f))) : 0, tried = ser.some(function (x) { return x && String(x.k || "").split("-")[0] === id; });
      var aidNow = its.some(function (x) { var s = calcItem(st, x.step.key); return s.aid && !s.val; });
      var status = total && done >= total ? "maitrise" : aidNow ? "difficulte" : done || tried ? "en_cours" : "nouveau";
      return { k: id, name: w[1], nom: CCOMP[id].nom, done: done, total: total, exp: exp, v: exp ? Math.round(done * 100 / exp) : null, status: status };
    });
  }
  var api = { LETTER_SAY: LETTER_SAY, NUM_SAY: NUM_SAY, RANGES: RANGES, CCOMP: CCOMP, WEB_CALC: WEB_CALC, calcConfig: calcConfig, calcSteps: calcSteps, calcPath: calcPath, calcState: calcState, calcItem: calcItem,
    calcCurrent: calcCurrent, calcRecord: calcRecord, calcSummary: calcSummary, calcStepLabel: calcStepLabel, buildCalcSeries: buildCalcSeries, calcRadar: calcRadar, CONFUS: CONFUS, DEFAULTS: DEFAULTS, COMPS: COMPS, TRACKS: ["gs", "cp", "ce1"], TRACK_READY: { gs: true, cp: true, ce1: false },
    COMP: COMP, WEB: WEB, radar: radar, config: config, groupsFor: groupsFor, steps: steps, path: path, lecState: lecState, pathCurrent: pathCurrent, pathSummary: pathSummary, glyph: glyph, buildSeries: buildSeries, compState: compState, current: current, record: record, summary: summary, stepLabel: stepLabel, letters: letters };
  root.ZooGSData = api;
})(typeof window === "undefined" ? module.exports : window);
