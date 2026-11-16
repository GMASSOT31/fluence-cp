/* Invitation à installer l'appli (PWA) — chargé par index.html, enseignants.html et eleve.html.
   - Chrome / Edge / Android : bouton « Installer » (événement beforeinstallprompt), installation en un clic.
   - iPhone / iPad : petit mode d'emploi « Partager › Sur l'écran d'accueil » (Safari n'a pas de bouton d'installation).
   - Rien si l'appli est déjà installée, dans la démo, ou si la personne a répondu « Plus tard » (14 jours), fermé (90 jours) ou installé (180 jours, au cas où elle la retire).
   Syntaxe ancienne (iPad iOS 12) ; tout accès au stockage est protégé ; sans stockage, l'invitation ne s'affiche qu'une fois par visite. */
(function () {
  "use strict";
  var KEY = "zoo_install", DAY = 86400000, LATER = 14, CLOSED = 90, deferred = null, bar = null, shown = false;
  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function installed() {
    try { if (navigator.standalone) return true; } catch (e) {}
    try { return !!(window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches)); } catch (e) { return false; }
  }
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
  function write(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function snoozed() { var o = read(); return !!(o.until && Date.now() < o.until); }
  function snooze(days) { write({ until: Date.now() + days * DAY }); }
  if (installed() || /[?&]demo(=|&|$)/.test(location.search) || /[?&]integre=/.test(location.search)) return;
  if (window.top !== window.self) return;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function css() {
    if (document.getElementById("zi-css")) return;
    var s = el("style"); s.id = "zi-css";
    s.textContent =
      ".zi-bar{position:fixed;left:50%;bottom:14px;z-index:2147483000;width:calc(100% - 24px);max-width:440px;box-sizing:border-box;margin-left:0;-webkit-transform:translateX(-50%);transform:translateX(-50%);display:-webkit-box;display:flex;-webkit-box-align:center;align-items:center;padding:12px 40px 12px 12px;background:#fff;color:#1b2433;border:1.5px solid #dfe3f0;border-radius:18px;box-shadow:0 12px 34px rgba(10,12,40,.32);font-family:Figtree,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.3;text-align:left}" +
      ".zi-bar img{width:52px;height:52px;border-radius:12px;flex:0 0 auto;margin-right:12px}" +
      ".zi-txt{flex:1 1 auto;min-width:0}.zi-txt b{display:block;font-family:Fredoka,Figtree,sans-serif;font-weight:600;font-size:17px;color:#1b2433}.zi-txt span{display:block;color:#5b6480;font-size:13.5px}" +
      ".zi-btns{margin-top:8px}.zi-btn{font:inherit;font-weight:700;font-size:15px;min-height:40px;padding:8px 16px;border-radius:12px;border:1.5px solid #cfd5e6;background:#fff;color:#1b2433;cursor:pointer;margin:0 8px 0 0;box-shadow:none}" +
      ".zi-btn.zi-go{background:#16a34a;border-color:#15803d;color:#fff}" +
      ".zi-x{position:absolute;top:4px;right:4px;width:36px;height:36px;border:0;background:transparent;color:#5b6480;font-size:22px;line-height:1;cursor:pointer;border-radius:10px;padding:0;margin:0;box-shadow:none}" +
      ".zi-steps{margin:8px 0 0;padding:0;list-style:none}.zi-steps li{display:-webkit-box;display:flex;-webkit-box-align:center;align-items:center;margin:6px 0;font-size:15px;color:#1b2433}" +
      ".zi-steps .zi-n{flex:0 0 auto;width:26px;height:26px;margin-right:10px;border-radius:50%;background:#eef1fa;color:#1b2433;font-weight:800;font-size:14px;display:-webkit-box;display:flex;-webkit-box-align:center;align-items:center;-webkit-box-pack:center;justify-content:center}" +
      ".zi-steps svg{width:20px;height:20px;vertical-align:-4px;margin:0 3px}" +
      "@media (max-width:600px){.zi-bar{bottom:10px}}" +
      "@media print{.zi-bar{display:none}}";
    document.head.appendChild(s);
  }
  function close(days) { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); bar = null; if (days) snooze(days); }
  function show() {
    if (shown || snoozed() || installed()) return;
    if (!deferred && !isIOS) return;
    shown = true; css();
    bar = el("div", "zi-bar"); bar.setAttribute("role", "dialog"); bar.setAttribute("aria-label", "Installer l’appli Zoo de Lecture");
    var img = el("img"); img.src = "/img/icon-192.png"; img.alt = ""; img.width = 52; img.height = 52; bar.appendChild(img);
    var txt = el("div", "zi-txt");
    txt.appendChild(el("b", "", "Installer Zoo de Lecture"));
    txt.appendChild(el("span", "", "Un accès direct, en plein écran, comme une vraie appli."));
    var btns = el("div", "zi-btns");
    var go = el("button", "zi-btn zi-go", isIOS && !deferred ? "Voir comment" : "Installer"); go.type = "button";
    var later = el("button", "zi-btn", "Plus tard"); later.type = "button";
    btns.appendChild(go); btns.appendChild(later); txt.appendChild(btns); bar.appendChild(txt);
    var x = el("button", "zi-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); bar.appendChild(x);
    later.addEventListener("click", function () { close(LATER); });
    x.addEventListener("click", function () { close(CLOSED); });
    go.addEventListener("click", function () {
      if (deferred) {
        var ev = deferred; deferred = null;
        try {
          ev.prompt();
          if (ev.userChoice && ev.userChoice.then) ev.userChoice.then(function (r) { if (r && r.outcome === "accepted") { snooze(180); close(0); } else close(LATER); }, function () { close(LATER); });
          else close(0);
        } catch (e) { close(LATER); }
        return;
      }
      /* iPhone / iPad : mode d'emploi en 3 gestes, à la place des boutons */
      var share = '<svg viewBox="0 0 24 24" fill="none" stroke="#1d6fe0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
      var ol = el("ol", "zi-steps");
      [["Toucher le bouton Partager " + share, 1], ["Choisir « Sur l’écran d’accueil »", 0], ["Toucher « Ajouter »", 0]].forEach(function (s, i) {
        var li = el("li"); li.appendChild(el("span", "zi-n", String(i + 1)));
        var t = el("span"); if (s[1]) t.innerHTML = s[0]; else t.textContent = s[0];
        li.appendChild(t); ol.appendChild(li);
      });
      txt.querySelector("span").textContent = "Dans Safari, en 3 gestes :";
      btns.innerHTML = ""; txt.insertBefore(ol, btns);
      var ok = el("button", "zi-btn", "J’ai compris"); ok.type = "button";
      ok.addEventListener("click", function () { close(CLOSED); });
      btns.appendChild(ok);
    });
    document.body.appendChild(bar);
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    setTimeout(show, 1500);
  });
  window.addEventListener("appinstalled", function () { snooze(180); deferred = null; close(0); });
  /* iPhone / iPad : pas d'événement, on propose le mode d'emploi après un petit délai */
  if (isIOS) setTimeout(function () { if (document.body) show(); }, 3000);
  window.ZooInstall = { show: show, reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} shown = false; } };
})();
