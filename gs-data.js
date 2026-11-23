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
  var DEFAULTS = {
    lecture: {
      prenom: true,                      /* 1er groupe = lettres du prénom de l'élève (si au moins 2 lettres différentes) */
      groups: ["AIORLS", "EUMTFB", "PNCVJZ", "DGQKHYXW"],
      cap: { on: true, props: [2, 3, 4], questions: 10, seuil: 80, series: 2 },
      capscript: { on: true, props: [2, 3, 4], questions: 10, seuil: 80, series: 2 },
      script: { on: true, props: [2, 3, 4], questions: 10, seuil: 80, series: 2 },
      scriptcurs: { on: true, props: [2, 3, 4], questions: 10, seuil: 80, series: 2 },
      curs: { on: true, props: [2, 3, 4], questions: 10, seuil: 80, series: 2 },
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
  /* Une lettre dans une écriture (capitale, script, cursive) : le texte à afficher ; la police est donnée par la classe CSS w-<écriture> */
  function glyph(L, w) { return w === "cap" ? L : L.toLowerCase(); }
  var api = { LETTER_SAY: LETTER_SAY, CONFUS: CONFUS, DEFAULTS: DEFAULTS, COMPS: COMPS, TRACKS: ["gs", "cp", "ce1"], TRACK_READY: { gs: true, cp: true, ce1: false },
    COMP: COMP, config: config, groupsFor: groupsFor, steps: steps, path: path, lecState: lecState, pathCurrent: pathCurrent, pathSummary: pathSummary, glyph: glyph, buildSeries: buildSeries, compState: compState, current: current, record: record, summary: summary, stepLabel: stepLabel, letters: letters };
  root.ZooGSData = api;
})(typeof window === "undefined" ? module.exports : window);
