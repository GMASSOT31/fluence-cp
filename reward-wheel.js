/* Les deux parcours partagent l’animation. Chaque parcours conserve son tirage et sa sauvegarde. */
(function () {
  "use strict";
  var duration = 4000, pause = 520;
  function reduce() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function active(stage) { return document.documentElement.contains(stage); }
  function spin(o) {
    var stage = o.stage, disc = o.disc, reduced = reduce();
    var step = 360 / o.count, from = o.from || 0;
    var rest = ((from % 360) + 360) % 360;
    var final = 360 - (o.index + .5) * step + (Math.random() - .5) * step * .35;
    var delta = 360 * 4 + (final - rest + 360) % 360;
    var target = from + delta, timer, begin = Date.now();
    stage.setAttribute("data-phase", "spin");
    var old = disc.querySelector(".reward-wheel-winner");
    if (old) old.classList.remove("reward-wheel-winner");
    disc.style.transition = reduced ? "none" : "transform " + duration + "ms cubic-bezier(.333333,1,.666667,1)";
    disc.style.transform = "rotate(" + target + "deg)";
    /* Les clics suivent les passages sous la flèche, sans écrire dans la page à chaque image. */
    var ticks = [], end = reduced ? 0 : duration;
    if (!reduced && o.tick) {
      for (var angle = (Math.floor(from / step) + 1) * step; angle < target; angle += step) {
        var at = duration * (1 - Math.pow(1 - (angle - from) / delta, 1 / 3));
        if (at > 70 && (!ticks.length || at - ticks[ticks.length - 1] >= 72)) ticks.push(at);
      }
    }
    function next() {
      if (!active(stage)) return;
      var elapsed = Date.now() - begin;
      while (ticks.length && ticks[0] <= elapsed) {
        var at = ticks.shift();
        if (elapsed - at < 65) o.tick();
      }
      if (elapsed < end) {
        timer = setTimeout(next, Math.max(1, (ticks.length ? ticks[0] : end) - elapsed));
        return;
      }
      stage.setAttribute("data-phase", "pause");
      o.stopped();
      timer = setTimeout(function () {
        if (!active(stage)) return;
        var selected = disc.querySelectorAll("svg path")[o.index];
        if (selected) selected.classList.add("reward-wheel-winner");
        stage.setAttribute("data-phase", "win");
        o.reveal();
      }, pause);
    }
    timer = setTimeout(next, ticks.length ? ticks[0] : end);
    return { angle: target, cancel: function () { clearTimeout(timer); } };
  }
  window.ZooRewardWheel = { spin: spin, reduce: reduce };
})();
