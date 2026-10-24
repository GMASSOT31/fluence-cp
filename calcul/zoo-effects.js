/* GÉNÉRÉ par tools/extract_zoo_skin.py à partir de zoo-connecte.html : effets du Zoo de Lecture (sons, feu d'artifice) pour le Zoo de Calcul. */
(function (root) {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var data = { sfx: true }, S = { audio: null }, audioUnlocked = false;
  function audioCtx() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!S.audio) S.audio = new AC();
      if (S.audio.state === "suspended") S.audio.resume();
      return S.audio;
    } catch (e) { return null; }
  }
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    var ctx = audioCtx();
    if (!ctx) return;
    try {
      var b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch (e) {}
    if (!ctx.__zooState) { ctx.__zooState = true; ctx.onstatechange = function () { if (ctx.state === "running" && typeof Music !== "undefined") Music.sync(); }; }
    if (ctx.state === "running") audioUnlocked = true;
    if (typeof Music !== "undefined") Music.sync();
  }
  function tone(freq, start, dur, type, vol) {
    if (!data.sfx) return;
    var ctx = audioCtx();
    if (!ctx) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      var t0 = ctx.currentTime + (start || 0);
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function confetti(n, withCoins) {
    var box = $("confetti");
    box.innerHTML = "";
    var cv = document.createElement("canvas"), g = cv.getContext && cv.getContext("2d");
    if (!g) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight, small = W < 520;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
    g.scale(dpr, dpr);
    var night = document.createElement("div");
    night.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(8,6,32,.55);opacity:0";
    box.appendChild(night); box.appendChild(cv);
    var bursts = n >= 130 ? 7 : n >= 100 ? 5 : n >= 80 ? 4 : 3;
    var pals = [["#ffe66d", "#fff3b0", "#f5c542"], ["#ff7ac8", "#ffb3e1", "#ff4fb0"], ["#6bf6ff", "#b8fbff", "#35d6e6"], ["#9dff8f", "#d4ffc8", "#4fe36a"], ["#c4a1ff", "#e6d6ff", "#9b6bff"], ["#ffa24a", "#ffd0a0", "#ff7a1a"]];
    var rockets = [], parts = [], glows = [], launched = 0, T = 0, last = Date.now(), pi = Math.floor(Math.random() * pals.length);
    var plan = []; for (var k = 0; k < bursts; k++) plan.push(k * 16 + Math.random() * 8);
    function launch() {
      var tx = W * (0.14 + Math.random() * 0.72);
      rockets.push({ sx: tx + (Math.random() - 0.5) * 90, sy: H + 8, tx: tx, ty: H * (0.12 + Math.random() * 0.32), p: 0, dur: 32 + Math.random() * 10, pal: pals[pi++ % pals.length], px: 0, py: 0 });
      launched++;
    }
    function explode(x, y, pal) {
      var kind = Math.floor(Math.random() * 3), count = small ? 56 : 84, sp = small ? 0.75 : 1;
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2, v = (kind === 1 ? 4.2 : 1.4 + Math.random() * 4.4) * sp, coin = withCoins && i % 6 === 0;
        parts.push({ x: x, y: y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 2 ? 0.6 : 0), g: coin ? 0.14 : (kind === 2 ? 0.075 : 0.05),
          life: coin ? 110 : (kind === 2 ? 95 + Math.random() * 30 : 62 + Math.random() * 30), max: 0, col: coin ? "#ffd23f" : (kind === 2 ? "#ffd86b" : pal[i % pal.length]),
          sz: coin ? 6.5 : 1.6 + Math.random() * 1.4, coin: coin, spin: Math.random() * 6 });
        parts[parts.length - 1].max = parts[parts.length - 1].life;
      }
      glows.push({ x: x, y: y, a: 1, col: pal[0] });
      tone(130 + Math.random() * 90, 0, 0.16, "sawtooth", 0.04);
    }
    function step() {
      if (!cv.parentNode) return;
      var now = Date.now(), dt = Math.min(2.5, (now - last) / 16.667); last = now; T += dt;
      while (launched < bursts && T >= plan[launched]) launch();
      var done = launched >= bursts && !rockets.length;
      night.style.opacity = (Math.min(1, T / 12) * (done ? Math.max(0, Math.min(1, parts.length / 70)) : 1)).toFixed(3);
      g.globalCompositeOperation = "destination-out"; g.fillStyle = "rgba(0,0,0," + Math.min(0.7, 0.26 * dt).toFixed(3) + ")"; g.fillRect(0, 0, W, H);   /* les traînées s’estompent peu à peu */
      g.globalCompositeOperation = "lighter";
      rockets = rockets.filter(function (r) {
        r.p += dt / r.dur; var e = 1 - Math.pow(1 - Math.min(1, r.p), 2), x = r.sx + (r.tx - r.sx) * e, y = r.sy + (r.ty - r.sy) * e;
        g.strokeStyle = "rgba(255,240,190,.9)"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(r.px || x, r.py || y); g.lineTo(x, y); g.stroke(); r.px = x; r.py = y;
        if (r.p >= 1) { explode(x, y, r.pal); return false; } return true;
      });
      glows = glows.filter(function (o) {
        var gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, 150); gr.addColorStop(0, o.col); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = o.a * 0.14; g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, 150, 0, 6.3); g.fill(); g.globalAlpha = 1; o.a -= 0.06 * dt; return o.a > 0;
      });
      parts = parts.filter(function (q) {
        q.px = q.x; q.py = q.y; q.vx *= Math.pow(0.984, dt); q.vy = q.vy * Math.pow(0.984, dt) + q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
        var al = Math.max(0, q.life / q.max);
        if (q.coin) {
          g.globalCompositeOperation = "source-over"; g.globalAlpha = Math.min(1, al * 2); q.spin += 0.25 * dt;
          g.fillStyle = q.col; g.strokeStyle = "#b8860b"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(q.x, q.y, q.sz * Math.abs(Math.cos(q.spin)) + 0.8, q.sz, 0, 0, 6.3); g.fill(); g.stroke();
          g.globalAlpha = 1; g.globalCompositeOperation = "lighter";
        } else {
          g.globalAlpha = al; g.strokeStyle = q.col; g.fillStyle = q.col; g.lineWidth = q.sz; g.lineCap = "round"; g.beginPath(); g.moveTo(q.px, q.py); g.lineTo(q.x, q.y); g.stroke(); g.beginPath(); g.arc(q.x, q.y, q.sz * 0.9, 0, 6.3); g.fill(); g.globalAlpha = 1;
        }
        return q.life > 0 && q.y < H + 30;
      });
      if ((done && !parts.length && !glows.length) || T > 600) { if (cv.parentNode) cv.parentNode.removeChild(cv); if (night.parentNode) night.parentNode.removeChild(night); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  ["pointerdown", "touchend", "click", "keydown"].forEach(function (ev) { document.addEventListener(ev, function () { if (!audioUnlocked) unlockAudio(); }, { capture: true, passive: true }); });
  root.ZooFx = { tone: tone, confetti: confetti, setSfx: function (on) { data.sfx = on !== false; } };
})(window);
