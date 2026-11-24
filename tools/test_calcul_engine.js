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
ok(E.LEVELS.nombres.map(function (l) { return l.choices; }).join() === "6,6,4,6,6,6,6,6,6,6,6,6,6,6,6", "propositions par niveau : " + E.LEVELS.nombres.map(function (l) { return l.choices; }));
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
    ok(lv.animal && lv.animal.e && lv.animal.nom && (lv.animal.kmh == null || lv.animal.kmh > prev), act + ":" + lv.id + " animal absent ou pas plus rapide que le précédent");
    ok(!seenE[lv.animal.e], "animal en double : " + lv.animal.e); seenE[lv.animal.e] = 1; if (lv.animal.kmh != null) prev = lv.animal.kmh;
  });
});
ok(E.animalOf("nombres", "n1").nom === "l’escargot" && E.animalOf("nombres", "n11").nom === "le guépard", "du plus lent (n1) au plus rapide (n11)");
/* étapes visibles : réussies + la suivante seulement */
ok(E.visibleLevels("nombres", [], {}).join() === "n1", "départ : seule la 1re étape");
ok(E.visibleLevels("nombres", [], { "nombres:n1": { ok: 1 } }).join() === "n1,n2", "n1 réussie → n1, n2");
ok(E.visibleLevels("nombres", [], { "nombres:n1": { ok: 1 }, "nombres:n2": { ok: 0, r: 2 } }).join() === "n1,n2", "n2 tentée sans réussite : la suite reste cachée");
ok(E.visibleLevels("addition", ["a1", "a2", "a3", "a4"], { "addition:a1": { ok: 2 }, "addition:a2": { ok: 1 }, "addition:a3": { ok: 1 }, "addition:a4": { ok: 1 } }).join() === "a1,a2,a3,a4", "tout réussi : toutes les étapes ouvertes");
ok(E.visibleLevels("nombres", [], { "nombres:n1": { ok: 1 }, "nombres:n4": { ok: 1 } }).join() === "n1,n2,n4", "une étape réussie après un trou reste visible (n1, n2 à faire, n4 réussie)");
ok(E.visibleLevels("addition", ["a3", "a4"], {}).join() === "a3", "ordre et choix de l’enseignant respectés");
ok(E.topAnimal({ "nombres:n3": { ok: 1 }, "addition:a2": { ok: 1 } }).e === "🐿️" && E.topAnimal({}) === null, "animal le plus rapide éclos : 🐿️ (20 km/h) devant 🦔 (7 km/h)");
/* étapes par dizaine (17/11/2026) : 20–29, 30–39, 40–49, 50–59 entre « 17 à 20 » et « 20 à 59 » */
ok(E.DEFAULT_LEVELS.nombres.join() === "n1,n2,n3,d20,d30,d40,d50,n4,n5,n6,n7,n8,n9,n10,n11", "ordre par défaut : " + E.DEFAULT_LEVELS.nombres);
["d20", "d30", "d40", "d50"].forEach(function (id, i) {
  var lv = E.levelInfo("nombres", id), lo = 20 + 10 * i;
  ok(lv.allowed.join() === Array.apply(null, Array(10)).map(function (_, k) { return lo + k; }).join() && lv.choices === 6, id + " : nombres " + lo + " à " + (lo + 9) + ", 6 propositions");
});
ok(E.visibleLevels("nombres", [], { "nombres:n1": { ok: 1 }, "nombres:n2": { ok: 1 }, "nombres:n3": { ok: 1 } }).join() === "n1,n2,n3,d20", "après 17 à 20 : 20 à 29");
ok(E.suggestLevel("nombres", [], { "nombres:n1": { ok: 1 }, "nombres:n2": { ok: 1 }, "nombres:n3": { ok: 1 }, "nombres:d20": { ok: 1 } }) === "d30", "étape suivante après 20 à 29 : 30 à 39");
ok(E.levelsOf("nombres", ["n1", "n2", "n3", "n4", "n5"]).join() === "n1,n2,n3,d20,d30,d40,d50,n4,n5", "ancien réglage : nouvelles étapes insérées après 17 à 20");
ok(E.levelsOf("nombres", ["n3", "n1", "n2", "n4"]).join() === "n3,d20,d30,d40,d50,n1,n2,n4", "ancien réglage dans un autre ordre : insérées après 17 à 20");
ok(E.levelsOf("nombres", ["n1", "n2", "n4"]).join() === "n1,n2,d20,d30,d40,d50,n4", "17 à 20 décochée : insérées avant 20 à 59");
ok(E.levelsOf("nombres", ["n1", "n2", "n3", "n4", "v2"]).join() === "n1,n2,n3,n4", "réglage enregistré après l'ajout (repère v2) : étapes décochées respectées");
ok(E.levelsOf("nombres", ["n1", "d30", "n3"]).join() === "n1,d30,n3", "une nouvelle étape déjà présente : rien d'ajouté");
ok(E.levelsOf("addition", ["a1", "a2"]).join() === "a1,a2" && E.marks("nombres").join() === "v2", "addition inchangée ; repère v2");
ok(E.animalOf("nombres", "n4").e === "🐕", "« 20 à 59 » garde le chien (animal du milieu du bandeau)");
var seen20 = {}; for (var s20 = 0; s20 < 300; s20++) E.makeRound("nombres", "d20", 10, E.seeded(s20)).forEach(function (q) { seen20[q.answer] = 1; q.choices.forEach(function (c) { ok(c >= 20 && c <= 29, "d20 : proposition hors 20–29 : " + c); }); });
ok(Object.keys(seen20).length === 10, "d20 : les 10 nombres sont demandés");
/* Une seule prochaine étape ; une première étoile suffit et aucun calcul ne propose un nombre inconnu. */
var missionProgress = {}, knownNumbers = {}, missionOrder = [];
for (var step = E.mission(null, missionProgress).next; step; step = E.mission(null, missionProgress).next) {
  var stepKey = step.act + ":" + step.id, stepInfo = E.levelInfo(step.act, step.id);
  if (missionProgress[stepKey]) { ok(false, "étape répétée dans la mission"); break; }
  missionOrder.push(step.id);
  missionProgress[stepKey] = { ok: 0, r: 1 };
  ok(E.mission(null, missionProgress).next.id === step.id, "un échec ne débloque pas la suite : " + step.id);
  if (step.act === "nombres") stepInfo.allowed.forEach(function (n) { knownNumbers[n] = true; });
  else {
    for (var trial = 0; trial < 20; trial++) E.makeRound(step.act, step.id, 10, E.seeded(trial)).forEach(function (q) {
      var usedNumbers = q.choices.concat([q.a, q.b, q.answer]);
      if (q.hole) usedNumbers.push(q.total);
      ok(usedNumbers.every(function (n) { return knownNumbers[n]; }), "nombres déjà reconnus : " + q.key);
      if (q.level === "a2") ok(q.answer > 5, "palier addition deux mains : le total dépasse 5");
      if (q.level === "s2") ok(q.a > 5, "palier soustraction deux mains : le départ dépasse 5");
      var limit = /^(a0|s0)$/.test(q.level) ? 5 : /^(a2|s2)$/.test(q.level) ? 10 : 100;
      ok(usedNumbers.every(function (n) { return n <= limit; }), "termes, résultat et choix bornés à " + limit + " : " + q.key);
    });
  }
  missionProgress[stepKey].ok = 1;
}
ok(missionOrder.slice(0, 12).join() === "n0,a0,n1,a1,a2,ad10,a3,a4,n2,s0,s1,s2", "paliers obligatoires dans l’ordre");
ok(missionOrder.indexOf("ap20") > missionOrder.indexOf("d20") && missionOrder.indexOf("ac30") > missionOrder.indexOf("d30"), "calculs déverrouillés après reconnaissance de la dizaine");
ok(!E.mission(null, missionProgress).blocked, "tout le parcours par défaut est accessible");
ok(E.missionLevels("addition", ["a8"]).join() === "a0,a2,a8", "anciens réglages : les paliers obligatoires restent proposés");
var partial = E.mission({ nombres: ["n1", "v2"], addition: ["a8"], soustraction: ["s2"] }, missionProgressWithoutHigherNumbers());
ok(partial.next && partial.next.id === "n2" && partial.blocked && !partial.replay.some(function (s) { return s.id === "a8" || s.act === "soustraction"; }), "11–16 est proposé avec les anciens réglages et les calculs restent fermés avant leurs prérequis, même déjà réussis");
var after16 = missionProgressWithoutHigherNumbers();
after16["nombres:n2"] = { ok: 1 };
var unlocked = E.mission({ nombres: ["n1", "v2"], addition: ["a8"], soustraction: ["s2"] }, after16);
ok(unlocked.replay.some(function (s) { return s.id === "s0"; }) && unlocked.replay.some(function (s) { return s.id === "s2"; }), "les anciennes soustractions réapparaissent après une étoile de reconnaissance jusqu’à 16");
function missionProgressWithoutHigherNumbers() {
  return Object.fromEntries(["nombres:n0", "nombres:n1", "addition:a0", "addition:a2", "addition:a8", "soustraction:s0", "soustraction:s2"].map(function (key) { return [key, { ok: 1 }]; }));
}

/* ===== CE1 : nombres jusqu'à 1 000 (docs/parcours-ce1/plan.md) ===== */
var W3 = { 101: "cent un", 200: "deux cents", 203: "deux cent trois", 230: "deux cent trente", 280: "deux cent quatre-vingts", 371: "trois cent soixante et onze", 999: "neuf cent quatre-vingt-dix-neuf", 1000: "mille" };
Object.keys(W3).forEach(function (n) { ok(E.words(+n) === W3[n], "words(" + n + ") = " + E.words(+n) + " ≠ " + W3[n]); });
ok(Array.apply(null, Array(1001)).every(function (_, n) { return /^[a-zéè -]+$/.test(E.words(n)); }), "1 001 nombres en lettres bien formés");
var ce1Ids = E.CE1.nombres.map(function (l) { return l.id; });
ok(ce1Ids.join() === "c100,c1,c2,c3,c4,c5,c6,c7,c8,c9,cpos,c1000", "étapes CE1 : " + ce1Ids);
ok(E.LEVELS.nombres.every(function (l) { return ce1Ids.indexOf(l.id) < 0; }) && E.DEFAULT_LEVELS.nombres.join() === "n1,n2,n3,d20,d30,d40,d50,n4,n5,n6,n7,n8,n9,n10,n11", "le parcours CP ne change pas");
var rng3 = E.seeded(7);
E.CE1.nombres.forEach(function (lv) {
  ok(E.levelInfo("nombres", lv.id) === lv && lv.animal && lv.animal.e, "étape " + lv.id + " connue avec un animal");
  for (var k = 0; k < 15; k++) {
    var r = E.makeRound("nombres", lv.id, 10, rng3);
    r.forEach(function (q) {
      ok(q.choices.length === 6 && q.choices.indexOf(q.answer) >= 0 && new Set(q.choices).size === 6, lv.id + " : 6 propositions distinctes avec la réponse");
      ok(q.choices.every(function (c) { return lv.allowed.indexOf(c) >= 0; }), lv.id + " : propositions prises dans l’étape");
      ok(q.say === E.words(q.answer), lv.id + " : la voix dit le nombre");
    });
  }
});
var d = E.bigDistractors(203, E.levelInfo("nombres", "c2").allowed, 5, E.seeded(1));
ok(d.indexOf(230) >= 0, "203 : 230 proposé (erreur de position) : " + d);
var d2 = E.bigDistractors(235, E.levelInfo("nombres", "c2").allowed, 5, E.seeded(2));
ok(d2.indexOf(253) >= 0, "235 : 253 proposé (chiffres inversés) : " + d2);
ok(E.ce1Levels(null).join() === "n10," + ce1Ids.join(), "mission CE1 : révision jusqu’à 99 puis les 12 étapes");
ok(E.ce1Levels(["c1", "c2", "zz"]).join() === "n10,c1,c2", "étapes cochées par l’enseignant, identifiants inconnus ignorés");
ok(E.ce1Levels(["c2", "c1"]).join() === "n10,c1,c2", "ordre du programme toujours respecté");
var pr = {}; ok(E.ce1Mission(null, pr).next.id === "n10", "début : révision jusqu’à 99");
pr["nombres:n10"] = { ok: 1 }; ok(E.ce1Mission(null, pr).next.id === "c100", "révision déjà réussie (au CP) : pas refaite, on commence par les centaines");
pr["nombres:c100"] = { ok: 0, r: 2 }; ok(E.ce1Mission(null, pr).next.id === "c100", "un échec ne débloque pas la suite");
ce1Ids.forEach(function (id) { pr["nombres:" + id] = { ok: 1 }; });
var endM = E.ce1Mission(null, pr); ok(!endM.next && endM.replay.length === 13 && !endM.blocked, "parcours CE1 terminé : tout se rejoue");
console.log(fails ? fails + " ÉCHEC(S) sur " + checks + " contrôles" : "TOUS LES CONTRÔLES PASSENT (" + checks + ")");
process.exit(fails ? 1 : 0);
