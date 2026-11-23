/* Tests du moteur GS (gs-data.js) : node tools/test_gs.js — critères T07, T08, T09 du cahier des charges, séries, groupes */
var G = require("../gs-data.js").ZooGSData, assert = require("assert"), n = 0;
function t(name, f) { f(); n++; console.log("ok - " + name); }
var cfg = G.config(null), list = G.steps("cap", cfg, "Léo");
t("groupes : prénom d'abord, puis les groupes sans doublon, 26 lettres", function () {
  var gs = G.groupsFor(cfg, "Léo"), all = [].concat.apply([], gs.map(function (g) { return g.letters; }));
  assert.deepStrictEqual(gs[0].letters, ["L", "E", "O"]);
  assert.strictEqual(all.length, 26); assert.strictEqual(new Set(all).size, 26);
});
t("prénom d'une seule lettre : pas de groupe prénom", function () { assert.notStrictEqual(G.groupsFor(cfg, "Aa")[0].id, "prenom"); });
t("paliers : groupe × 2, 3, 4 propositions", function () { assert.strictEqual(list[0].key, "prenom-2"); assert.strictEqual(list[1].n, 3); assert.strictEqual(list.length, G.groupsFor(cfg, "Léo").length * 3 - 1); assert.deepStrictEqual(list.slice(0, 3).map(function (s) { return s.key; }), ["prenom-2", "prenom-3", "g1-2"]); });
t("série : 10 questions, bonne réponse toujours proposée, jamais deux fois la même lettre de suite, propositions distinctes", function () {
  for (var k = 0; k < 50; k++) {
    var s = G.buildSeries(list[2], cfg, "cap", false);
    assert.strictEqual(s.qs.length, 10);
    s.qs.forEach(function (q, i) {
      assert.ok(q.opts.indexOf(q.t) >= 0); assert.strictEqual(q.opts.length, list[2].n); assert.strictEqual(new Set(q.opts).size, q.opts.length);
      if (i) assert.notStrictEqual(q.t, s.qs[i - 1].t);
    });
  }
});
t("aide : une proposition de moins (au moins 2)", function () { assert.strictEqual(G.buildSeries(list[4], cfg, "cap", true).n, list[4].n - 1); assert.strictEqual(G.buildSeries(list[0], cfg, "cap", true).n, 2); });
t("T07 : une seule série à 80 % ne valide pas", function () { var st = G.compState(null); var r = G.record(st, list, cfg, "cap", 8, 10, false, 1); assert.ok(r.ok && !r.validated); assert.strictEqual(st.ok, 1); });
t("T08 : deux séries réussies d'affilée valident et ouvrent le palier suivant", function () {
  var st = G.compState(null); G.record(st, list, cfg, "cap", 8, 10, false, 1); var r = G.record(st, list, cfg, "cap", 9, 10, false, 2);
  assert.ok(r.validated); assert.strictEqual(st.val[list[0].key], 2); assert.strictEqual(G.current(st, list), 1);
});
t("contre-exemple : 9/10 puis 6/10 ne valide pas", function () { var st = G.compState(null); G.record(st, list, cfg, "cap", 9, 10, false, 1); var r = G.record(st, list, cfg, "cap", 6, 10, false, 2); assert.ok(!r.validated && st.ok === 0); });
t("T09 : deux séries ratées → aide ; série aidée réussie → retour normal sans validation", function () {
  var st = G.compState(null); G.record(st, list, cfg, "cap", 5, 10, false, 1); var r = G.record(st, list, cfg, "cap", 6, 10, false, 2);
  assert.ok(r.aidOn && st.aid);
  r = G.record(st, list, cfg, "cap", 10, 10, true, 3); assert.ok(r.aidOff && !st.aid && !r.validated); assert.strictEqual(st.ok, 0);
});
t("réglages : valeurs hors limites ramenées aux défauts, groupes de l'enseignant", function () {
  var c = G.config({ lecture: { groups: ["ab", "cd", "x"], cap: { questions: 99, seuil: 90, props: [4, 2] } } });
  assert.strictEqual(c.cap.questions, 10); assert.strictEqual(c.cap.seuil, 90); assert.deepStrictEqual(c.cap.props, [2, 4]); assert.deepStrictEqual(c.groups, ["AB", "CD"]);
});
t("résumé : jamais 100 % après une série", function () { var st = G.compState(null); G.record(st, list, cfg, "cap", 10, 10, false, 1); assert.strictEqual(G.summary(st, list, [{ ok: true }]).pct, 0); });
console.log("TOUS LES TESTS GS PASSENT (" + n + ")");
