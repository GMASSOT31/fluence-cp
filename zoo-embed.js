/* Mode « intégré » du Zoo de Lecture : zoo-connecte.html?vue=boutique|jeux&integre=1, ouvert dans un cadre du Zoo de Calcul.
   Le cadre ne montre que le panneau central (boutique, salle d'arcade… : le vrai code, les vrais effets, le même portefeuille) ;
   le bandeau, les panneaux et la barre du bas restent ceux du Zoo de Calcul.
   Sans ?integre=1 ou hors d'un cadre, ce fichier ne fait rien : le Zoo de Lecture reste exactement comme avant.
   Il prévient la page parente (même origine seulement) : pièces et parties à jour, partie en cours (le cadre passe alors en plein écran). */
(function () {
  "use strict";
  try {
    if (window.parent === window || !/[?&]integre=1(&|$)/.test(location.search)) return;
    document.documentElement.classList.add("embed");
    var st = document.createElement("style");
    st.textContent = "html.embed,html.embed body{background:transparent!important}" +
      "html.embed header,html.embed #panel-left,html.embed #panel-right,html.embed .bottom-nav,html.embed #cloud-status,html.embed #btn-pin,html.embed .me-menu,html.embed #labo-switch{display:none!important}" +
      "html.embed main,html.embed body.mode-student main{max-width:none!important;margin:0!important;padding:0!important}" +
      "html.embed .layout,html.embed body.mode-student .layout{display:block!important}" +
      "html.embed body.playing main{padding:8px!important}";
    document.head.appendChild(st);
    var origin = location.origin;
    function post(m) { m.zooEmbed = 1; try { window.parent.postMessage(m, origin); } catch (e) {} }
    function start() {
      var coins = document.getElementById("top-coins"), games = document.getElementById("top-games"), last = "";
      function wallet() {
        if (!coins || !games) return;
        var c = parseInt(coins.textContent, 10) || 0, g = parseInt(games.textContent, 10) || 0, k = c + "/" + g;
        if (k !== last) { last = k; post({ coins: c, credits: g }); }
      }
      function playing() { post({ playing: document.body.classList.contains("playing") }); }
      [coins, games].forEach(function (n) { if (n && window.MutationObserver) new MutationObserver(wallet).observe(n, { childList: true, characterData: true, subtree: true }); });
      if (window.MutationObserver) new MutationObserver(playing).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      window.addEventListener("load", function () { wallet(); playing(); });
      setTimeout(function () { wallet(); }, 1500);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  } catch (e) {}
})();
