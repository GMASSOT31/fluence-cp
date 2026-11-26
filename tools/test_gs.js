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
t("paliers : groupe × 2 puis 4 propositions (réglage par défaut A, 24/11/2026)", function () { assert.strictEqual(list[0].key, "prenom-2"); assert.strictEqual(list[1].n, 3); assert.strictEqual(list.length, G.groupsFor(cfg, "Léo").length * 2); assert.deepStrictEqual(list.slice(0, 3).map(function (s) { return s.key; }), ["prenom-2", "prenom-3", "g1-2"]); });
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
t("aide : une proposition de moins (au moins 2)", function () { assert.strictEqual(G.buildSeries(list[3], cfg, "cap", true).n, list[3].n - 1); assert.strictEqual(G.buildSeries(list[0], cfg, "cap", true).n, 2); });
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
t("parcours : pour chaque groupe capitales → capitale/script → script → script/cursive → cursive → ordre", function () {
  var it = G.path(cfg, "Léo"), first = it.filter(function (x) { return x.step.group === 1; }).map(function (x) { return x.comp; });
  assert.deepStrictEqual(first.filter(function (c, i) { return first.indexOf(c) === i; }), ["cap", "capscript", "script", "scriptcurs", "curs", "ordre"]);
  assert.strictEqual(it[0].comp, "cap"); assert.ok(it.some(function (x) { return x.step.group === 2 && x.comp === "cap"; }));
  var st = G.lecState(null); assert.strictEqual(G.pathCurrent(st, it), 0);
  it.filter(function (x) { return x.comp === "cap" && x.step.group === 1; }).forEach(function (x) { st.cap.val[x.step.key] = 1; });
  assert.strictEqual(it[G.pathCurrent(st, it)].comp, "capscript");
});
t("activité désactivée : absente du parcours", function () { var c = G.config({ lecture: { curs: { on: false }, scriptcurs: { on: false } } }); assert.ok(G.path(c, "Léo").every(function (x) { return x.comp !== "curs" && x.comp !== "scriptcurs"; })); });
t("association : les deux sens, bonne réponse proposée", function () {
  var st = G.steps("capscript", cfg, "Léo")[2], s = G.buildSeries(st, cfg, "capscript", false), dirs = {};
  s.qs.forEach(function (q) { dirs[q.dir] = 1; assert.ok(q.opts.indexOf(q.t) >= 0); }); assert.deepStrictEqual(Object.keys(dirs).sort(), ["0", "1"]);
});
t("ordre : 3 lettres au 1er groupe, 4 puis 5, jamais présentées déjà rangées", function () {
  var o = G.steps("ordre", cfg, "Léo"); assert.deepStrictEqual(o.map(function (x) { return x.n; }), [3, 4, 5]);
  for (var k = 0; k < 30; k++) G.buildSeries(o[1], cfg, "ordre", false).qs.forEach(function (q) {
    assert.strictEqual(q.seq.length, 4); assert.notStrictEqual(q.opts.join(""), q.seq.join("")); assert.deepStrictEqual(q.seq.slice().sort(), q.seq);
    assert.ok(q.seq.some(function (c) { return o[1].targets.indexOf(c) >= 0; }));
  });
  assert.strictEqual(G.buildSeries(o[0], cfg, "ordre", true).qs[0].seq.length, 2);
});
t("écritures : capitale, script et cursive", function () { assert.strictEqual(G.glyph("B", "cap"), "B"); assert.strictEqual(G.glyph("B", "curs"), "b"); });
t("T12 : la toile ne montre que les activités proposées, dans l'ordre du cahier", function () {
  var c = G.config({ lecture: { curs: { on: false }, scriptcurs: { on: false } } }), r = G.radar(c, "Léo", G.lecState(null), [], 0.5);
  assert.deepStrictEqual(r.map(function (a) { return a.k; }), ["cap", "ordre", "capscript", "script"]);
  r.forEach(function (a) { assert.strictEqual(a.v, 0); assert.strictEqual(a.status, "nouveau"); assert.ok(a.exp >= 1 && a.exp <= a.total); });
});
t("toile : une seule série réussie ne compte pas, deux séries valident une étape", function () {
  var st = G.lecState(null), its = G.steps("cap", cfg, "Léo");
  G.record(st.cap, its, cfg, "cap", 10, 10, false, 1);
  var a = G.radar(cfg, "Léo", st, [{ c: "cap", ok: true }], 1)[0]; assert.strictEqual(a.done, 0); assert.strictEqual(a.status, "en_cours");
  G.record(st.cap, its, cfg, "cap", 10, 10, false, 2);
  a = G.radar(cfg, "Léo", st, [], 1)[0]; assert.strictEqual(a.done, 1); assert.strictEqual(a.v, Math.round(100 / its.length));
});
t("T13 : réglages modifiés puis valeurs recommandées", function () {
  var c = G.config({ lecture: { prenom: false, groups: ["abc", "CDE", "x"], cap: { questions: 99, seuil: 90, series: 3, props: [4, 2, 2, 9] } } });
  assert.strictEqual(c.prenom, false); assert.deepStrictEqual(c.groups, ["ABC", "DE"]); assert.strictEqual(c.cap.questions, 10); assert.strictEqual(c.cap.seuil, 90); assert.strictEqual(c.cap.series, 3); assert.deepStrictEqual(c.cap.props, [2, 4]);
  assert.deepStrictEqual(G.config(undefined), G.config(null)); assert.deepStrictEqual(G.config(undefined).groups, G.DEFAULTS.lecture.groups);
});
/* ===== GS Calcul (étape E) ===== */
var cc = G.calcConfig(null), cpath = G.calcPath(cc);
t("calcul : paliers 1–3, 1–5, 0–9 dans l'ordre chiffres → ordre → dénombrement → comparaison → construction", function () {
  assert.deepStrictEqual(cpath.slice(0, 2).map(function (x) { return x.step.key; }), ["chiffres-r1-2", "chiffres-r1-3"]);
  var r1 = cpath.filter(function (x) { return x.step.range === 1; }).map(function (x) { return x.comp; });
  assert.deepStrictEqual(r1.filter(function (c, i) { return r1.indexOf(c) === i; }), ["chiffres", "ordre", "denombre", "compare", "collec"]);
  assert.ok(cpath.every(function (x) { return x.step.key.length <= 20 && /^[a-z]+-[a-z0-9-]{1,14}$/.test(x.step.key); }));
  assert.strictEqual(new Set(cpath.map(function (x) { return x.step.key; })).size, cpath.length);
  assert.strictEqual(cpath[cpath.length - 1].step.key, "compare-eq");   /* « autant » : un palier prévu, à la fin */
  assert.ok(cpath.some(function (x) { return x.step.key === "ordre-r3-3x" && x.step.consec === false; }));
});
t("calcul : le zéro n'arrive qu'au 3e palier et y est toujours demandé", function () {
  cpath.forEach(function (x) { if (x.step.range < 3 || x.step.eq) assert.ok(x.step.lo >= 1); });
  ["chiffres-r3-4", "denombre-r3-4", "collec-r3"].forEach(function (k) {
    var s = cpath.filter(function (x) { return x.step.key === k; })[0].step;
    assert.ok(G.buildCalcSeries(s, cc, false).qs.some(function (q) { return q.t === 0; }), k);
  });
});
t("calcul : séries justes (bonne réponse proposée, choix distincts, ordre jamais rangé, comparaisons jamais égales)", function () {
  for (var k = 0; k < 40; k++) cpath.forEach(function (x) {
    var s = G.buildCalcSeries(x.step, cc, k % 3 === 0), a = G.CCOMP[x.comp].act;
    assert.strictEqual(s.qs.length, cc[x.comp].questions);
    s.qs.forEach(function (q) {
      if (a === "num" || a === "compte") { assert.ok(q.opts.indexOf(q.t) >= 0); assert.strictEqual(new Set(q.opts).size, q.opts.length); assert.ok(q.opts.every(function (v) { return v >= x.step.lo && v <= x.step.hi; })); }
      if (a === "ordre") { assert.notStrictEqual(q.opts.join(","), q.seq.join(",")); q.seq.forEach(function (v, i) { if (i) assert.ok(v > q.seq[i - 1]); }); if (x.step.consec === false) assert.ok(q.seq[q.seq.length - 1] - q.seq[0] > q.seq.length - 1); }
      if (a === "compare") { assert.notStrictEqual(q.a, q.b); if (q.ask === "autant") assert.strictEqual([q.a, q.b][q.t], q.model); else assert.strictEqual([q.a, q.b][q.t], q.ask === "plus" ? Math.max(q.a, q.b) : Math.min(q.a, q.b)); }
      if (a === "collec") assert.ok(q.t >= x.step.lo && q.t <= x.step.hi);
    });
  });
});
t("calcul T07/T08/T09 : même règle que le serveur", function () {
  var st = {}, key = "chiffres-r1-2", c = cc.chiffres;
  var r = G.calcRecord(st, key, c, 8, 10, false, "t1"); assert.ok(r.ok && !r.validated);
  r = G.calcRecord(st, key, c, 9, 10, false, "t2"); assert.ok(r.validated); assert.strictEqual(st[key].val, "t2");
  assert.strictEqual(G.calcCurrent(st, cpath), 1);
  var k2 = "chiffres-r1-3"; G.calcRecord(st, k2, c, 9, 10, false, "t3"); G.calcRecord(st, k2, c, 6, 10, false, "t4"); assert.ok(!st[k2].val && st[k2].ok === 0);
  r = G.calcRecord(st, k2, c, 5, 10, false, "t5"); assert.ok(r.aidOn && st[k2].aid);
  r = G.calcRecord(st, k2, c, 10, 10, false, "t6"); assert.ok(r.aid && r.aidOff && !r.validated && !st[k2].aid && st[k2].ok === 0);   /* l'aide ne valide jamais */
  assert.strictEqual(G.buildCalcSeries(cpath[1].step, cc, true).n, 2);
});
t("calcul T12 : la toile ne montre que les activités proposées ; une série seule ne compte pas", function () {
  var c2 = G.calcConfig({ calcul: { compare: { on: false } } }), r = G.calcRadar(c2, {}, [], 0.5);
  assert.deepStrictEqual(r.map(function (a) { return a.k; }), ["chiffres", "ordre", "denombre", "collec"]);
  var st = {}; G.calcRecord(st, "chiffres-r1-2", c2.chiffres, 10, 10, false, "x");
  assert.strictEqual(G.calcRadar(c2, st, [{ k: "chiffres-r1-2", ok: true }], 1)[0].done, 0);
});
t("calcul T13 : réglages bornés, valeurs recommandées", function () {
  var c = G.calcConfig({ calcul: { chiffres: { questions: 2, seuil: 30, series: 9, props: [9, 3] }, compare: { autant: false } } });
  assert.strictEqual(c.chiffres.questions, 10); assert.strictEqual(c.chiffres.seuil, 80); assert.strictEqual(c.chiffres.series, 2); assert.deepStrictEqual(c.chiffres.props, [3]);
  assert.ok(G.calcPath(c).every(function (x) { return !x.step.eq; }));
  assert.deepStrictEqual(G.calcConfig(undefined), G.calcConfig({ lecture: {} }));
});

t("défi des capitales : quatre choix, une seule cible et parcours adapté uniquement en capitales", function () {
  var alphabet = Object.keys(G.LETTER_SAY), answers = {};
  alphabet.forEach(function (letter) {
    var q = G.diagnosticQuestion(letter);
    assert.strictEqual(new Set(q.opts).size, 4);
    assert(q.opts.indexOf(letter) >= 0);
    answers[letter] = 1;
  });
  var all = G.diagnosticState({done:true, answers:answers}), path = G.path(cfg, "Léo");
  assert.deepStrictEqual(G.path(cfg, "Léo", all), path.filter(function (x) { return x.comp !== "cap"; }));
  all.answers.E = 0;
  var caps = G.path(cfg, "Léo", all).filter(function (x) { return x.comp === "cap"; });
  assert(caps.length && caps.every(function (x) { return x.step.targets.join("") === "E"; }));
  assert.strictEqual(G.buildSeries(caps[0].step, cfg, "cap", false).qs.length, 4);
  delete answers.E;
  assert.strictEqual(G.diagnosticState({done:true, answers:answers}).done, false);
});
console.log("TOUS LES TESTS GS PASSENT (" + n + ")");
