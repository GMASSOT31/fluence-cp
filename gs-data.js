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
  /* Progression par défaut (choisie le 23/11/2026 d'après eduscol : partir des lettres du prénom, travailler nom/forme en aller-retour,
     séparer les lettres proches b/d/p/q, m/n, n/u, t/d ; lettres rares h k q w x y z en dernier). Modifiable par l'enseignant (settings.gs). */
  var DEFAULTS = {
    lecture: {
      prenom: true,                      /* 1er groupe = lettres du prénom de l'élève (si au moins 2 lettres différentes) */
      groups: ["AIORLS", "EUMTFB", "PNCVJZ", "DGQKHYXW"],
      cap: { on: true, props: [2, 3, 4], questions: 10, seuil: 80, series: 2 }
    }
  };
  var COMPS = {
    lecture: [{ id: "cap", nom: "Les lettres capitales", axe: "Capitales", act: "nom" }]
  };
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
    var c = o.cap && typeof o.cap === "object" ? o.cap : {};
    if (typeof c.on === "boolean") d.cap.on = c.on;
    if (Array.isArray(c.props)) { var p = c.props.map(function (n) { return clampInt(n, 2, 4, 0); }).filter(Boolean).sort(); if (p.length) d.cap.props = p.filter(function (n, i) { return p.indexOf(n) === i; }); }
    d.cap.questions = clampInt(c.questions, 4, 20, d.cap.questions);
    d.cap.seuil = clampInt(c.seuil, 50, 100, d.cap.seuil);
    d.cap.series = clampInt(c.series, 1, 4, d.cap.series);
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
    var gs = groupsFor(cfg, prenom), c = cfg[comp], out = [], seen = [];
    gs.forEach(function (g, gi) {
      seen = seen.concat(g.letters);
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
    var nq = cfg[comp].questions, n = aid ? Math.max(2, step.n - 1) : step.n, targets = [], last = null, qs = [];
    while (targets.length < nq) {
      var round = shuffle(step.targets.slice(), rnd);
      if (targets.length && round.length > 1 && round[0] === targets[targets.length - 1]) round.push(round.shift());
      targets = targets.concat(round);
    }
    targets = targets.slice(0, nq);
    targets.forEach(function (t) {
      var others = step.pool.filter(function (c) { return c !== t; }), near = (CONFUS[t] || "").split("").filter(function (c) { return others.indexOf(c) >= 0; });
      var pick = [];
      if (n >= 3 && near.length) pick.push(near[Math.floor(rnd() * near.length)]);
      shuffle(others.filter(function (c) { return pick.indexOf(c) < 0; }), rnd).forEach(function (c) { if (pick.length < n - 1) pick.push(c); });
      var opts = shuffle(pick.concat([t]), rnd);
      if (last !== null && opts.indexOf(t) === last && opts.length > 1) { var j = (last + 1) % opts.length; opts[last] = opts[j]; opts[j] = t; }
      last = opts.indexOf(t);
      qs.push({ t: t, opts: opts });
    });
    return { n: n, aid: !!aid, qs: qs };
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
  function stepLabel(s) { return (s.groupId === "prenom" ? "Lettres du prénom" : s.groupId === "fin" ? "Dernières lettres" : "Groupe " + s.group) + " · " + s.n + " choix"; }
  var api = { LETTER_SAY: LETTER_SAY, CONFUS: CONFUS, DEFAULTS: DEFAULTS, COMPS: COMPS, TRACKS: ["gs", "cp", "ce1"], TRACK_READY: { gs: true, cp: true, ce1: false },
    config: config, groupsFor: groupsFor, steps: steps, buildSeries: buildSeries, compState: compState, current: current, record: record, summary: summary, stepLabel: stepLabel, letters: letters };
  root.ZooGSData = api;
})(typeof window === "undefined" ? module.exports : window);
