/* Bouton « Lecture | Calcul » du laboratoire privé — chargé par zoo-connecte.html et enseignants.html.
   * Ne fait RIEN si labo-config.js est absent ou `enabled:false`, en démo, ou sans connexion : aucune requête dans ces cas.
   * Sinon, UNE requête (fonction lab_my_access) ; le bouton n'apparaît que si le serveur répond « autorisé ».
   * N'utilise pas supabase-js (évite un second client d'authentification dans la page) ; n'écrit rien, ne casse rien : toute erreur est ignorée.
   * Retrait : supprimer ce fichier et les deux balises <script src="labo-switch.js…"> (voir labo-calcul/README.md). */
(function () {
  "use strict";
  try {
    var C = window.LABO_CALCUL;
    if (!C || !C.enabled || window.ZOO_DEMO || /[?&]demo(=|&|$)/.test(location.search)) return;
    var teacher = /enseignants/.test(location.pathname), token = null, bearer = null, i;
    if (teacher) {
      for (i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-[a-z0-9]+-auth-token$/.test(k)) { try { bearer = (JSON.parse(localStorage.getItem(k)) || {}).access_token || null; } catch (e) {} }
      }
      if (!bearer) return;
    } else {
      token = sessionStorage.getItem("zoo_student_token");
      if (!token || token === "demo") return;
    }
    function ask() {
      var headers = { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + (bearer || C.key) };
      fetch(C.url + "/rest/v1/rpc/lab_my_access", { method: "POST", headers: headers, body: JSON.stringify(token ? { p_token: token } : {}) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (a) { if (a && a.allowed === true) show(); })
        .catch(function () {});
    }
    function show() {
      if (document.getElementById("labo-switch")) return;
      var a = document.createElement("a");
      a.id = "labo-switch"; a.href = teacher ? "labo-calcul-enseignant.html" : "labo-calcul.html"; a.textContent = "➕ Calcul (test)";
      var st = document.createElement("style");   /* sur téléphone/tablette, au-dessus de la barre du bas (5 boutons) */
      st.textContent = "#labo-switch{position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:40;min-height:48px;display:inline-flex;align-items:center;" +
        "padding:8px 16px;border-radius:999px;background:#0b7f7d;color:#fff;font:800 16px Figtree,system-ui,sans-serif;text-decoration:none;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.3)}" +
        "@media (max-width:880px){#labo-switch{bottom:calc(92px + env(safe-area-inset-bottom,0px))}}" +
        "body.playing #labo-switch,body.listen-focus #labo-switch,body.reading-focus #labo-switch{display:none}";
      document.head.appendChild(st);
      document.body.appendChild(a);
    }
    if (document.readyState === "complete") setTimeout(ask, 1200); else window.addEventListener("load", function () { setTimeout(ask, 1200); });
  } catch (e) {}
})();
