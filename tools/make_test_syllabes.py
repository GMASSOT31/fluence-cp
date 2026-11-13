#!/usr/bin/env python3
"""Fabrique test-syllabes.html : page (noindex) qui lit toutes les syllabes de l'exercice d'écoute avec la voix de l'appareil,
pour repérer celles qui sont épelées. Les règles des syllabes viennent de exo-data.js (source unique, partagée avec le Zoo et l'espace enseignant) :
la page les charge directement, il n'y a plus de copie à garder à jour."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
block = ("var SYL_VOWELS = ZooExo.SYL_VOWELS, LISTEN_SYL_VOW = ZooExo.LISTEN_SYL_VOW, sylConsAll = ZooExo.sylConsAll, sylOK = ZooExo.sylOK, sylSay = ZooExo.sylSay;\n")
page = '''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Test des syllabes</title>
<style>
body { font-family: Figtree, system-ui, sans-serif; margin: 0; padding: 16px; background: #f4f6fb; color: #1b2433; }
h1 { font-size: 1.3rem; margin: 0 0 6px; } p { margin: 4px 0 10px; }
.bar { position: sticky; top: 0; background: #f4f6fb; padding: 8px 0; display: flex; gap: 8px; flex-wrap: wrap; z-index: 2; }
button { font: inherit; font-weight: 700; padding: 10px 14px; border-radius: 12px; border: 2px solid #1b2433; background: #fff; cursor: pointer; }
button.go { background: #16a34a; color: #fff; border-color: #15803d; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.s { display: flex; align-items: center; gap: 6px; background: #fff; border: 2px solid #d8dee9; border-radius: 12px; padding: 6px 8px; }
.s.now { border-color: #16a34a; background: #effcf3; } .s.bad { border-color: #d6486b; background: #ffe9ee; }
.s b { font-size: 1.2rem; min-width: 3.2rem; } .s small { color: #5b6577; flex: 1; } .s input { width: 22px; height: 22px; }
.s button { padding: 4px 9px; }
#res { width: 100%; min-height: 90px; margin-top: 10px; font: inherit; }
</style></head><body>
<h1>Test des syllabes</h1>
<p>Touchez <b>▶ Tout lire</b> et écoutez. Quand une syllabe est <b>épelée</b> (lettre par lettre) ou mal dite, cochez sa case (ou touchez-la après coup pour la relire).</p>
<div class="bar"><button class="go" id="all">▶ Tout lire</button><button id="stop">⏹ Stop</button><button id="copy">📋 Copier la liste cochée</button><span id="cnt"></span></div>
<div class="grid" id="grid"></div>
<textarea id="res" readonly placeholder="La liste des syllabes cochées apparaît ici."></textarea>
<script src="exo-data.js?v=2"></script>
<script>
(function () {
  function $(i) { return document.getElementById(i); }
  /* ===== règles des syllabes : exo-data.js ===== */
  ''' + block + '''
  var voices = [];
  function speak(text) {
    try {
      var u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR"; u.rate = 0.8;
      var frs = (speechSynthesis.getVoices() || []).filter(function (v) { return /^fr/i.test(v.lang); }), frFR = frs.filter(function (v) { return /^fr[-_]FR/i.test(v.lang); });
      var fr = frFR.filter(function (v) { return /thomas|audrey|aurélie|marie|google/i.test(v.name); })[0] || frFR[0] || frs[0]; if (fr) u.voice = fr;
      speechSynthesis.cancel(); speechSynthesis.speak(u); return u;
    } catch (e) { return null; }
  }
  /* toutes les syllabes de l'exercice : consonne + voyelle simple, puis consonne + voyelle-son (an, on, ou…) */
  var items = [], seen = {};
  function add(cg, v) { var w = cg + v; if (seen[w] || !sylOK(cg, v)) return; seen[w] = 1; items.push({ w: w, say: sylSay(cg, v) }); }
  sylConsAll().forEach(function (c) { Object.keys(SYL_VOWELS).forEach(function (v) { add(c.g, v); }); });
  sylConsAll().forEach(function (c) { Object.keys(LISTEN_SYL_VOW).forEach(function (id) { LISTEN_SYL_VOW[id].forEach(function (e) { add(c.g, e[0]); }); }); });
  var grid = $("grid"), cur = -1, playing = false, rows = [];
  items.forEach(function (it, i) {
    var r = document.createElement("div"); r.className = "s";
    r.innerHTML = '<input type="checkbox" aria-label="mal dite"><b></b><small></small><button type="button">▶</button>';
    r.querySelector("b").textContent = it.w; r.querySelector("small").textContent = it.say === it.w ? "" : "dit « " + it.say + " »";
    r.querySelector("input").addEventListener("change", function () { r.classList.toggle("bad", this.checked); count(); });
    r.querySelector("button").addEventListener("click", function () { playing = false; speak(it.say); });
    grid.appendChild(r); rows.push(r);
  });
  function count() {
    var bad = items.filter(function (x, i) { return rows[i].querySelector("input").checked; });
    $("cnt").textContent = items.length + " syllabes · " + bad.length + " cochée" + (bad.length > 1 ? "s" : "");
    $("res").value = bad.map(function (x) { return x.w + " (dit « " + x.say + " »)"; }).join("\\n");
  }
  count();
  function next() {
    if (!playing) return; cur++; rows.forEach(function (r) { r.classList.remove("now"); });
    if (cur >= items.length) { playing = false; return; }
    rows[cur].classList.add("now"); rows[cur].scrollIntoView({ block: "center" });
    var u = speak(items[cur].say); if (u) u.onend = function () { setTimeout(next, 900); }; else setTimeout(next, 1800);
  }
  $("all").addEventListener("click", function () { playing = true; cur = -1; next(); });
  $("stop").addEventListener("click", function () { playing = false; speechSynthesis.cancel(); });
  $("copy").addEventListener("click", function () { $("res").select(); try { document.execCommand("copy"); } catch (e) {} });
})();
</script></body></html>
'''
open(os.path.join(ROOT, "test-syllabes.html"), "w", encoding="utf-8").write(page)
print("OK test-syllabes.html")
