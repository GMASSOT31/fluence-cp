/* Liste de tout ce que la voix du Zoo dit dans les exercices d'écoute et de dictée (syllabes et sons), lue dans exo-data.js
   (source unique des exercices), plus les familles de syllabes demandées pour le CP (CV, CCV).
   Utilisé par tools/build_audio_sprite.py : node tools/audio_liste.js exo-data.js → JSON [[clé écrite, texte dit], ...] */
var fs = require("fs");
global.window = {};
eval(fs.readFileSync(process.argv[2] || "exo-data.js", "utf8"));
var Z = window.ZooExo, out = [], seen = {};
function add(k, say, src) { if (!k || seen[k]) return; seen[k] = 1; out.push([k, say, src]); }

/* 1. Syllabes de l'exercice (comme test-syllabes.html) : consonne + voyelle simple, puis consonne + voyelle-son (an, on, ou…) */
Z.sylConsAll().forEach(function (c) { Object.keys(Z.SYL_VOWELS).forEach(function (v) { if (Z.sylOK(c.g, v)) add(c.g + v, Z.sylSay(c.g, v), "zoo"); }); });
Z.sylConsAll().forEach(function (c) { Object.keys(Z.LISTEN_SYL_VOW).forEach(function (id) { Z.LISTEN_SYL_VOW[id].forEach(function (e) { if (Z.sylOK(c.g, e[0])) add(c.g + e[0], Z.sylSay(c.g, e[0]), "zoo"); }); }); });

/* 2. Sons de l'écoute (clé de l'exercice : « ch », « voy:a », « fr:pr »…) avec le texte dit par défaut */
var n = {};
Z.LISTEN_ITEMS.forEach(function (r) { n[r[0]] = (n[r[0]] || 0) + 1; });
Z.LISTEN_ITEMS.forEach(function (r) { add(n[r[0]] > 1 ? r[0] + ":" + r[1].split(",")[0] : r[0], r[2], "son"); });

/* 3. Familles demandées pour le CP : consonne (ou groupe de deux consonnes) + voyelle, dites comme sylSay les dirait */
var VOW = ["a", "e", "é", "è", "i", "o", "u", "ou", "on", "an", "in", "oi"];
function vsay(v) {
  var vs = Z.sylVowSay(v);
  if (v === "oi") vs = "oi";
  return vs;
}
function cv(cg, cs, v) {
  if (v === "e") return cs + "eu";
  if (v === "è") return cs + "ai";
  var vs = vsay(v);
  if (vs === "an") vs = "ant"; else if (vs === "in" || vs === "un") vs = "ain";
  var t = cs + vs;
  return Z.SYL_SAY_FIX[t] || t;
}
var CONS = [["l", "l"], ["r", "r"], ["m", "m"], ["n", "n"], ["s", "s"], ["f", "f"], ["v", "v"], ["ch", "ch"], ["p", "p"], ["t", "t"], ["b", "b"], ["d", "d"],
  ["c", "k"], ["k", "k"], ["g", "g"], ["j", "j"], ["z", "z"]];
CONS.forEach(function (c) {
  VOW.forEach(function (v) {
    if ((c[0] === "c" || c[0] === "g") && !/^[aou]/.test(v)) return;   /* ce, ci, ge, gi : autre son, pas dans cette famille */
    add(c[0] + v, cv(c[0], c[1], v), "cp");
  });
});
var CCV = [["bl", "bl"], ["br", "br"], ["cl", "kl"], ["cr", "kr"], ["dr", "dr"], ["fl", "fl"], ["fr", "fr"], ["gl", "gl"], ["gr", "gr"], ["pl", "pl"], ["pr", "pr"], ["tr", "tr"], ["vr", "vr"]];
CCV.forEach(function (c) { VOW.forEach(function (v) { add(c[0] + v, cv(c[0], c[1], v), "cp"); }); });

console.log(JSON.stringify(out));
