/* Tests du moteur du laboratoire de calcul : node tools/test_calcul_engine.js */
"use strict";
var E = require("../calcul/engine.js"), assert = require("assert"), fails = 0, checks = 0;
function ok(c, m) { checks++; if (!c) { fails++; console.log("ECHEC : " + m); } }

/* nombres en lettres */
var W = { 0: "zéro", 11: "onze", 16: "seize", 17: "dix-sept", 21: "vingt et un", 31: "trente et un", 60: "soixante", 70: "soixante-dix", 71: "soixante et onze", 72: "soixante-douze",
  77: "soixante-dix-sept", 79: "soixante-dix-neuf", 80: "quatre-vingts", 81: "quatre-vingt-un", 84: "quatre-vingt-quatre", 90: "quatre-vingt-dix", 91: "quatre-vingt-onze", 99: "quatre-vingt-dix-neuf", 100: "cent" };
Object.keys(W).forEach(function (n) { ok(E.words(+n) === W[n], "words(" + n + ") = " + E.words(+n) + " ≠ " + W[n]); });
ok(E.words(0) && Array.apply(null, Array(101)).every(function (_, n) { return /^[a-zéè -]+$/.test(E.words(n)); }), "100 nombres en lettres bien formés");

/* distracteurs : chaque nombre de chaque niveau, 200 tirages ; 6 propositions quand c'est possible, toutes prises parmi les nombres du niveau */
E.LEVELS.nombres.forEach(function (lv) {
  var seen = {};
  lv.pool.forEach(function (n) {
    for (var s = 0; s < 200; s++) {
      var q = E.makeRound("nombres", lv.id, 1, E.seeded(s * 131 + n))[0];
      var d = q.choices.filter(function (c) { return c !== q.answer; });
      ok(q.choices.length === Math.min(6, lv.allowed.length), lv.id + ": nombre de propositions (6 si possible) : " + q.choices.length);
      ok(new Set(q.choices).size === q.choices.length, lv.id + " n=" + q.answer + ": doublon " + q.choices);
      ok(q.choices.indexOf(q.answer) >= 0, lv.id + ": la bonne réponse manque");
      ok(q.choices.every(function (c) { return lv.allowed.indexOf(c) >= 0; }), lv.id + " n=" + q.answer + ": proposition hors des nombres du niveau " + q.choices);
      d.forEach(function (c) { seen[q.answer + ">" + c] = 1; });
    }
  });
  lv._seen = seen;
});
function sawConfusion(n, c) { return E.LEVELS.nombres.some(function (lv) { return lv._seen[n + ">" + c]; }); }
[[13, 30], [14, 40], [15, 50], [16, 60], [30, 13], [34, 43], [71, 61], [77, 67], [77, 17], [71, 81], [84, 44], [84, 24], [84, 48], [97, 87], [97, 79], [91, 81], [80, 20], [80, 60], [99, 100], [100, 10], [100, 90], [12, 21], [13, 3]]
  .forEach(function (p) { ok(sawConfusion(p[0], p[1]), "confusion attendue jamais proposée : " + p[0] + " → " + p[1]); });
/* tailles attendues : 6 propositions partout sauf « 17 à 20 » (4 nombres)
ok(E.LEVELS.nombres.map(function (l) { return l.choices; }).join() === "6,6,4,6,6,6,6,6,6,6,6", "propositions par niveau : " + E.LEVELS.nombres.map(function (l) { return l.choices; }));
/* les 101 nombres sont atteignables dans au moins un niveau */
var covered = {}; E.LEVELS.nombres.forEach(function (lv) { lv.pool.forEach(function (n) { covered[n] = 1; }); });
ok(Object.keys(covered).length === 101, "les 101 nombres sont travaillés (" + Object.keys(covered).length + ")");
/* sans répétition immédiate dans une série quand le niveau le permet */
var r = E.makeRound("nombres", "n4", 10, E.seeded(1));
ok(new Set(r.map(function (q) { return q.answer; })).size === 10, "série n4 sans répétition");

/* calcul */
["addition", "soustraction"].forEach(function (op) {
  E.LEVELS[op].forEach(function (lv) {
    for (var s = 0; s < 500; s++) {
      var q = E.makeRound(op, lv.id, 1, E.seeded(s))[0], tag = lv.id + " " + q.text;
      ok(q.answer >= 0 && q.answer <= lv.cap, tag + ": résultat hors champ");
      ok(q.hole ? q.a + q.answer === q.total : (op === "addition" ? q.a + q.b === q.answer : q.a - q.b === q.answer), tag + ": résultat faux");
      ok(new Set(q.choices).size === 4 && q.choices.indexOf(q.answer) >= 0, tag + ": propositions " + q.choices);
      ok(q.choices.every(function (c) { return c >= 0 && c <= lv.cap; }), tag + ": proposition hors champ");
      ok(q.a >= 0 && q.b >= 0 && q.a <= lv.cap && q.b <= lv.cap, tag + ": opérande hors champ");
      if (lv.id === "a1") ok(q.b <= 2, tag);
      if (lv.id === "a6") ok(q.a % 10 + q.b <= 9 && q.a + q.b <= 20, tag + ": a6 passe la dizaine");
      if (lv.id === "a7") ok(q.a < 10 && q.b < 10 && q.a + q.b > 10, tag + ": a7 ne passe pas la dizaine");
      if (lv.id === "a8") ok(q.a + q.b <= 100 && (q.a % 10 + q.b % 10 <= 9), tag + ": a8 retenue ou > 100");
      if (lv.id === "s3") ok(q.b <= q.a % 10, tag + ": s3 passe la dizaine");
      if (lv.id === "s4") ok(q.b > q.a % 10 && q.a > 10 && q.a < 20, tag + ": s4 ne passe pas la dizaine");
      if (lv.id === "s5") ok(q.answer >= 1 && q.answer <= 5, tag + ": s5 écart");
    }
  });
});
ok(E.suggestLevel("addition", [], {}) === "a1" && E.suggestLevel("addition", ["a1", "a2"], { "addition:a1": { ok: 1 } }) === "a2", "niveau suggéré");
ok(E.status(null) === "new" && E.status({ r: 1, ok: 0 }) === "todo" && E.status({ r: 2, ok: 1 }) === "done" && E.status({ r: 3, ok: 2 }) === "mastered", "statuts");
/* animaux : un par étape, vitesses strictement croissantes dans chaque activité, emojis tous différents */
var seenE = {};
Object.keys(E.LEVELS).forEach(function (act) {
  var prev = -1;
  E.LEVELS[act].forEach(function (lv) {
    ok(lv.animal && lv.animal.e && lv.animal.nom && lv.animal.kmh > prev, act + ":" + lv.id + " animal absent ou pas plus rapide que le précédent");
    ok(!seenE[lv.animal.e], "animal en double : " + lv.animal.e); seenE[lv.animal.e] = 1; prev = lv.animal.kmh;
  });
});
ok(E.animalOf("nombres", "n1").nom === "l’escargot" && E.animalOf("nombres", "n11").nom === "le guépard", "du plus lent (n1) au plus rapide (n11)");
/* étapes visibles : réussies + la suivante seulement */
ok(E.visibleLevels("nombres", [], {}).join() === "n1", "départ : seule la 1re étape");
ok(E.visibleLevels("nombres", [], { "nombres:n1": { ok: 1 } }).join() === "n1,n2", "n1 réussie → n1, n2");
ok(E.visibleLevels("nombres", [], { "nombres:n1": { ok: 1 }, "nombres:n2": { ok: 0, r: 2 } }).join() === "n1,n2", "n2 tentée sans réussite : la suite reste cachée");
ok(E.visibleLevels("addition", ["a1", "a2", "a3", "a4"], { "addition:a1": { ok: 2 }, "addition:a2": { ok: 1 }, "addition:a3": { ok: 1 }, "addition:a4": { ok: 1 } }).join() === "a1,a2,a3,a4", "tout réussi : toutes les étapes ouvertes");
ok(E.visibleLevels("addition", ["a3", "a4"], {}).join() === "a3", "ordre et choix de l’enseignant respectés");
ok(E.topAnimal({ "nombres:n3": { ok: 1 }, "addition:a2": { ok: 1 } }).e === "🐿️" && E.topAnimal({}) === null, "animal le plus rapide éclos : 🐿️ (20 km/h) devant 🦔 (7 km/h)");
console.log(fails ? fails + " ÉCHEC(S) sur " + checks + " contrôles" : "TOUS LES CONTRÔLES PASSENT (" + checks + ")");
process.exit(fails ? 1 : 0);
