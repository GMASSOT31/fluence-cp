/* Zoo de Calcul — moteur de questions (laboratoire privé). Pur : aucune page, aucun réseau ; testable sous Node (tools/test_calcul_engine.js).
   Fournit : nombre en lettres, distracteurs pédagogiques, niveaux de reconnaissance de nombres, d'additions et de soustractions. */
(function (root) {
  "use strict";

  /* ===== Nombre en lettres (0 à 100), orthographe d'avant 1990 : « quatre-vingts », « soixante et onze » ===== */
  var UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  var TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
  function words(n) {
    if (n < 0 || n > 100 || n !== Math.floor(n)) throw new Error("nombre hors 0–100 : " + n);
    if (n < 20) return UNITS[n];
    if (n === 100) return "cent";
    if (n === 80) return "quatre-vingts";
    if (n >= 80) return "quatre-vingt-" + UNITS[n - 80];
    if (n >= 70) return n === 71 ? "soixante et onze" : "soixante-" + UNITS[n - 60];
    var t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t] : u === 1 ? TENS[t] + " et un" : TENS[t] + "-" + UNITS[u];
  }

  /* ===== Hasard : générateur à graine (tests reproductibles) ou Math.random ===== */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rnd(rng) { return (rng || Math.random)(); }
  function pick(arr, rng) { return arr[Math.floor(rnd(rng) * arr.length)]; }
  function between(lo, hi, rng) { return lo + Math.floor(rnd(rng) * (hi - lo + 1)); }
  function shuffle(arr, rng) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(rnd(rng) * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function range(lo, hi) { var r = [], i; for (i = lo; i <= hi; i++) r.push(i); return r; }
  function add(list, v, cap, not) { if (v >= 0 && v <= cap && v !== not && list.indexOf(v) < 0) list.push(v); }

  /* ===== Distracteurs : jamais au hasard, toujours une vraie confusion d'élève de CP =====
     g1 = ressemblances à l'oral ; g2 = structure du nombre (unités/dizaines) ; g3 = nombres voisins ; g4 = même chiffre des unités ; g5 = complément */
  function numberDistractors(n, cap, k, rng) {
    var g1 = [], g2 = [], g3 = [], g4 = [], g5 = [], t = Math.floor(n / 10), u = n % 10, i;
    /* oral : -ze / -te (treize/trente…), soixante-dix-sept (17 dedans), quatre-vingt-quatre (quatre, vingt), quatre-vingt-dix-sept */
    if (n >= 13 && n <= 16) add(g1, (n - 10) * 10, cap, n);
    if (n === 30 || n === 40 || n === 50 || n === 60) add(g1, n / 10 + 10, cap, n);
    if (n >= 70 && n <= 79) { add(g1, n - 10, cap, n); add(g1, n - 60, cap, n); add(g1, n + 10, cap, n); }
    if (n >= 81 && n <= 89) { add(g1, 40 + u, cap, n); add(g1, 20 + u, cap, n); add(g1, n - 10, cap, n); }
    if (n === 80) { add(g1, 20, cap, n); add(g1, 60, cap, n); add(g1, 40, cap, n); }
    if (n >= 91 && n <= 99) { add(g1, n - 10, cap, n); add(g1, n - 20, cap, n); add(g1, n - 80, cap, n); }
    if (n === 90) { add(g1, 80, cap, n); add(g1, 70, cap, n); add(g1, 10, cap, n); }
    if (n === 100) { add(g1, 10, cap, n); add(g1, 90, cap, n); add(g1, 99, cap, n); }
    if (n === 99) { add(g1, 100, cap, n); add(g1, 90, cap, n); }
    if (n >= 11 && n <= 16) { add(g1, n + 10, cap, n); add(g1, n - 10, cap, n); }
    if (n >= 17 && n <= 19) { add(g1, n + 60, cap, n); add(g1, n + 70, cap, n); }
    /* structure : inversion unités/dizaines, dizaine voisine */
    if (n >= 10 && n < 100 && u !== 0 && u !== t) add(g2, u * 10 + t, cap, n);
    add(g2, n - 10, cap, n); add(g2, n + 10, cap, n);
    /* voisins */
    add(g3, n - 1, cap, n); add(g3, n + 1, cap, n); add(g3, n - 2, cap, n); add(g3, n + 2, cap, n);
    /* même chiffre des unités, autre dizaine */
    if (n >= 10) for (i = 0; i * 10 + u <= cap; i++) add(g4, i * 10 + u, cap, n);
    /* secours : tout le champ du niveau */
    for (i = 0; i <= cap; i++) add(g5, i, cap, n);
    var groups = [shuffle(g1, rng), shuffle(g2, rng), shuffle(g3, rng), shuffle(g4, rng), shuffle(g5, rng)];
    var order = [0, 1, 0, 2, 1, 3, 4], out = [], guard = 0;
    while (out.length < k && guard++ < 500) {
      var g = groups[order[guard % order.length]];
      while (g.length && out.indexOf(g[0]) >= 0) g.shift();
      if (g.length) out.push(g.shift());
    }
    return out;
  }

  /* ===== Niveaux : reconnaître un nombre entendu ===== */
  /* cap = plus grand nombre autorisé dans les propositions (on ne montre pas à un élève de 0–10 un « 73 ») */
  var NOMBRES = [
    { id: "n1", label: "0 à 10", emoji: "🔟", pool: range(0, 10), cap: 10, choices: 3 },
    { id: "n2", label: "11 à 16", emoji: "🧒", pool: range(11, 16), cap: 20, choices: 4 },
    { id: "n3", label: "17 à 20", emoji: "🖐️", pool: range(17, 20), cap: 20, choices: 4 },
    { id: "n4", label: "20 à 59", emoji: "🔢", pool: range(20, 59), cap: 59, choices: 4 },
    { id: "n5", label: "13 ou 30 ? 14 ou 40 ?", emoji: "👂", pool: [13, 14, 15, 16, 30, 40, 50, 60], cap: 69, choices: 4 },
    { id: "n6", label: "60 à 69", emoji: "6️⃣", pool: range(60, 69), cap: 79, choices: 4 },
    { id: "n7", label: "70 à 79", emoji: "7️⃣", pool: range(70, 79), cap: 99, choices: 4 },
    { id: "n8", label: "80 à 89", emoji: "8️⃣", pool: range(80, 89), cap: 99, choices: 4 },
    { id: "n9", label: "90 à 99", emoji: "9️⃣", pool: range(90, 99), cap: 99, choices: 4 },
    { id: "n10", label: "Tous les nombres jusqu’à 99", emoji: "🌟", pool: range(0, 99), cap: 99, choices: 4 },
    { id: "n11", label: "Jusqu’à 100", emoji: "💯", pool: [89, 90, 91, 98, 99, 100, 99, 100, 100, 10, 90], cap: 100, choices: 4 }
  ];

  /* ===== Niveaux : calculer ===== */
  /* aid : see = les animaux sont dessinés · mental = il faut calculer dans sa tête (la bande des nombres reste disponible) */
  function nbSum(a, b) { return { a: a, b: b, answer: a + b }; }
  var ADDITION = [
    { id: "a1", label: "+1 et +2 (jusqu’à 10)", emoji: "🐣", aid: "see", cap: 10, gen: function (r) { var b = between(1, 2, r), a = between(0, 10 - b, r); return nbSum(a, b); } },
    { id: "a2", label: "Additions jusqu’à 10", emoji: "🐥", aid: "see", cap: 10, gen: function (r) { var a = between(1, 8, r), b = between(1, 10 - a, r); return nbSum(a, b); } },
    { id: "a3", label: "Jusqu’à 10 dans ma tête", emoji: "🧠", aid: "mental", cap: 10, gen: function (r) { var a = between(0, 9, r), b = between(0, 10 - a, r); return nbSum(a, b); } },
    { id: "a4", label: "Pour arriver à 10", emoji: "🎯", aid: "see", cap: 10, hole: true, gen: function (r) { var a = between(0, 9, r); return { a: a, b: 10 - a, answer: 10 - a, total: 10 }; } },
    { id: "a5", label: "Les doubles", emoji: "👯", aid: "see", cap: 20, gen: function (r) { var a = between(1, 10, r); return nbSum(a, a); } },
    { id: "a6", label: "Jusqu’à 20, sans passer la dizaine", emoji: "🪜", aid: "mental", cap: 20, gen: function (r) { var a = between(10, 18, r), b = between(1, 9 - (a % 10), r); return nbSum(a, b); } },
    { id: "a7", label: "Passer la dizaine", emoji: "🌉", aid: "mental", cap: 20, gen: function (r) { var a = between(6, 9, r), b = between(11 - a, 9, r); return nbSum(a, b); } },
    { id: "a8", label: "Dizaines et unités", emoji: "🏔️", aid: "mental", cap: 100, gen: function (r) {
      var t = between(1, 8, r);
      if (rnd(r) < 0.5) return nbSum(t * 10, between(1, 10 - t, r) * 10);   /* dizaines entières : 20 + 30 */
      var u = between(1, 8, r);
      return nbSum(t * 10 + u, between(1, 9 - u, r)); } }   /* dizaines + unités sans retenue : 34 + 5 */
  ];
  function nbSub(a, b) { return { a: a, b: b, answer: a - b }; }
  var SOUSTRACTION = [
    { id: "s1", label: "−1 et −2 (jusqu’à 10)", emoji: "🐾", aid: "see", cap: 10, gen: function (r) { var b = between(1, 2, r), a = between(b, 10, r); return nbSub(a, b); } },
    { id: "s2", label: "Soustractions jusqu’à 10", emoji: "🦒", aid: "see", cap: 10, gen: function (r) { var a = between(3, 10, r), b = between(1, a - 1, r); return nbSub(a, b); } },
    { id: "s3", label: "Jusqu’à 20, sans passer la dizaine", emoji: "🪜", aid: "mental", cap: 20, gen: function (r) { var a = between(11, 19, r), b = between(1, a % 10, r); return nbSub(a, b); } },
    { id: "s4", label: "Passer la dizaine", emoji: "🌉", aid: "mental", cap: 20, gen: function (r) { var a = between(11, 18, r), b = between(a % 10 + 1, 9, r); return nbSub(a, b); } },
    { id: "s5", label: "Combien d’écart ?", emoji: "↔️", aid: "see", cap: 20, gen: function (r) { var d = between(1, 5, r), b = between(5, 15, r); return nbSub(b + d, b); } }
  ];

  var LEVELS = { nombres: NOMBRES, addition: ADDITION, soustraction: SOUSTRACTION };
  /* Niveaux ouverts par défaut (l'enseignant les règle) : tout pour les nombres, le début de l'addition et de la soustraction */
  var DEFAULT_LEVELS = {
    nombres: NOMBRES.map(function (l) { return l.id; }),
    addition: ["a1", "a2", "a3", "a4"],
    soustraction: ["s1", "s2"]
  };
  function levelInfo(activity, id) {
    var list = LEVELS[activity] || [], i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Propositions d'un calcul : confusions fréquentes (mauvaise opération, ±1, un des deux nombres, ±10) */
  function calcDistractors(op, q, cap, k, rng) {
    var g1 = [], g2 = [], g3 = [], g4 = [], g5 = [], ans = q.answer, i;
    if (op === "addition") { add(g1, Math.abs(q.a - q.b), cap, ans); } else { add(g1, q.a + q.b, cap, ans); }
    add(g2, ans - 1, cap, ans); add(g2, ans + 1, cap, ans);
    add(g3, q.a, cap, ans); add(g3, q.b, cap, ans);
    add(g4, ans - 2, cap, ans); add(g4, ans + 2, cap, ans); add(g4, ans - 10, cap, ans); add(g4, ans + 10, cap, ans);
    for (i = 0; i <= cap; i++) add(g5, i, cap, ans);
    var groups = [shuffle(g1, rng), shuffle(g2, rng), shuffle(g3, rng), shuffle(g4, rng), shuffle(g5, rng)];
    var order = [1, 0, 2, 1, 3, 4], out = [], guard = 0;
    while (out.length < k && guard++ < 500) {
      var g = groups[order[guard % order.length]];
      while (g.length && out.indexOf(g[0]) >= 0) g.shift();
      if (g.length) out.push(g.shift());
    }
    return out;
  }

  /* ===== Questions ===== */
  function nombresQuestion(level, rng, avoid) {
    var n = pick(level.pool, rng), tries = 0;
    while (avoid && avoid.indexOf(n) >= 0 && tries++ < 20) n = pick(level.pool, rng);
    var choices = shuffle([n].concat(numberDistractors(n, level.cap, level.choices - 1, rng)), rng);
    return { type: "nombres", level: level.id, answer: n, choices: choices, say: words(n), key: "n" + n };
  }
  function calcQuestion(op, level, rng, avoid) {
    var q = level.gen(rng), tries = 0, key = function (x) { return x.a + (op === "addition" ? "+" : "-") + x.b; };
    while (avoid && avoid.indexOf(key(q)) >= 0 && tries++ < 20) q = level.gen(rng);
    var sign = op === "addition" ? "+" : "−", sayOp = op === "addition" ? "plus" : "moins", text, say;
    if (level.hole) {
      text = q.a + " + ? = " + q.total; say = words(q.a) + " plus combien pour faire " + words(q.total) + " ?";
    } else {
      text = q.a + " " + sign + " " + q.b; say = words(q.a) + " " + sayOp + " " + words(q.b) + " ?";
    }
    var choices = shuffle([q.answer].concat(calcDistractors(op, q, level.cap, 3, rng)), rng);
    return { type: op, level: level.id, a: q.a, b: q.b, total: q.total || null, hole: !!level.hole, answer: q.answer, choices: choices, text: text, say: say,
             aid: level.aid, key: key(q) };
  }
  /* Une série : `count` questions, sans répéter la même question tant que le niveau le permet */
  function makeRound(activity, levelId, count, rng) {
    var level = levelInfo(activity, levelId);
    if (!level) throw new Error("niveau inconnu : " + activity + ":" + levelId);
    var out = [], used = [], i, q;
    for (i = 0; i < count; i++) {
      q = activity === "nombres" ? nombresQuestion(level, rng, used.map(function (k) { return +k.slice(1); })) : calcQuestion(activity, level, rng, used);
      used.push(q.key); out.push(q);
    }
    return out;
  }
  /* Niveau suggéré : le premier niveau ouvert qui n'est pas encore réussi (levels = progression serveur) */
  function suggestLevel(activity, enabled, levels) {
    var list = (enabled && enabled.length ? enabled : DEFAULT_LEVELS[activity]).filter(function (id) { return levelInfo(activity, id); }), i;
    for (i = 0; i < list.length; i++) if (!((levels || {})[activity + ":" + list[i]] || {}).ok) return list[i];
    return list[list.length - 1] || null;
  }
  /* Statut d'un niveau d'après le compteur serveur `ok` (séries réussies) : 0 = à travailler, 1 = réussi, 2+ = maîtrisé */
  function status(entry) {
    if (!entry || !entry.r) return "new";
    return entry.ok >= 2 ? "mastered" : entry.ok >= 1 ? "done" : "todo";
  }

  root.CalcEngine = {
    words: words, seeded: seeded, shuffle: shuffle, numberDistractors: numberDistractors, calcDistractors: calcDistractors,
    LEVELS: LEVELS, DEFAULT_LEVELS: DEFAULT_LEVELS, levelInfo: levelInfo, makeRound: makeRound, suggestLevel: suggestLevel, status: status
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CalcEngine;
})(typeof window !== "undefined" ? window : this);
