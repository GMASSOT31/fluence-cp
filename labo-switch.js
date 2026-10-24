/* Accès au laboratoire privé de calcul — chargé par zoo-connecte.html (bascule « Lecture | Calcul » dans le bandeau pour l'élève) et enseignants.html (bascule Lecture | Calcul intégrée au menu, via calcul/enseignant.js).
   * Ne fait RIEN si labo-config.js est absent ou `enabled:false`, en démo, ou sans connexion : aucune requête dans ces cas.
   * Sinon, UNE requête (fonction lab_my_access) ; le bouton n'apparaît que si le serveur répond « autorisé ».
   * N'utilise pas supabase-js (évite un second client d'authentification dans la page) ; n'écrit rien, ne casse rien : toute erreur est ignorée.
   * Retrait : supprimer ce fichier et les deux balises <script src="labo-switch.js…"> (voir labo-calcul/README.md). */
(function () {
  "use strict";
  try {
    if (window.parent !== window) return;   /* dans un cadre du Zoo de Calcul (mode intégré) : pas de bouton */
    var C = window.LABO_CALCUL;
    if (!C || !C.enabled || window.ZOO_DEMO || /[?&]demo(=|&|$)/.test(location.search)) return;
    var teacher = /enseignants/.test(location.pathname), token = null, bearer = null, i, asked = false;
    function readBearer() {
      for (i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-[a-z0-9]+-auth-token$/.test(k)) { try { var t = (JSON.parse(localStorage.getItem(k)) || {}).access_token; if (t) return t; } catch (e) {} }
      }
      return null;
    }
    if (teacher) bearer = readBearer();
    else {
      token = sessionStorage.getItem("zoo_student_token");
      if (!token || token === "demo") return;
    }
    function ask() {
      if (asked) return;
      if (teacher) { bearer = readBearer(); if (!bearer) return; }
      asked = true;
      var headers = { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + (bearer || C.key) };
      fetch(C.url + "/rest/v1/rpc/lab_my_access", { method: "POST", headers: headers, body: JSON.stringify(token ? { p_token: token } : {}) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (a) { if (a && a.allowed === true) { if (teacher) loadTeacher(a); else show(); } else if (a && teacher && (a.requestable === true || a.requested === true)) showRequest(a); })
        .catch(function () {});
    }
    /* Espace enseignant : le calcul s'intègre au menu de la page (bascule Lecture | Calcul), module chargé seulement pour un compte autorisé */
    function loadTeacher(a) {
      function add(src, cb) { var s = document.createElement("script"); s.src = src; s.onload = cb; document.head.appendChild(s); }
      add("calcul/engine.js?v=4", function () { add("calcul/enseignant.js?v=3", function () { try { window.CalcTeacher.init(a); } catch (e) {} }); });
    }
    /* Enseignant sans accès : un bouton pour le demander à l'administrateur (au-dessus du menu) */
    function showRequest(a) {
      var nav = document.querySelector("nav.teacher-nav"); if (!nav || document.getElementById("labo-request")) return;
      var b = document.createElement("button"); b.id = "labo-request"; b.type = "button";
      var st = document.createElement("style");
      st.textContent = "#labo-request{display:block;width:100%;margin:2px 0 12px;padding:10px 12px;min-height:44px;border-radius:14px;border:2px dashed #0b7f7d;background:#fff;color:#0b7f7d;font:800 .92rem Figtree,system-ui,sans-serif;cursor:pointer;box-shadow:none}#labo-request:disabled{border-style:solid;cursor:default;opacity:1}";
      document.head.appendChild(st);
      function done() { b.textContent = "✓ Demande envoyée"; b.disabled = true; b.title = "L’administrateur a été prévenu."; }
      if (a.requested) done(); else b.textContent = "➕ Essayer le Zoo de Calcul";
      b.addEventListener("click", function () {
        b.disabled = true;
        fetch(C.url + "/rest/v1/rpc/lab_request_access", { method: "POST", headers: { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + (bearer || C.key) }, body: "{}" })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { if (j && j.requested) done(); else throw 0; })
          .catch(function () { b.disabled = false; b.textContent = "Échec, réessayer"; });
      });
      nav.parentNode.insertBefore(b, nav);
    }
    function show() {
      if (document.getElementById("labo-switch")) return;
      var host = document.querySelector("header .zoo-hero-copy"); if (!host) return;
      var n = document.createElement("div"); n.id = "labo-switch"; n.setAttribute("role", "group"); n.setAttribute("aria-label", "Matière");
      n.innerHTML = '<span class="on">📖 Lecture</span><a href="labo-calcul.html" aria-label="Zoo de Calcul" title="Zoo de Calcul">➕<b> Calcul</b></a>';
      var st = document.createElement("style");
      st.textContent = "#labo-switch{display:inline-flex;height:26px;margin-top:0;border:2px solid rgba(255,255,255,.75);border-radius:999px;overflow:hidden;background:rgba(0,0,0,.25)}#labo-switch a,#labo-switch span{display:inline-flex;align-items:center;flex-direction:row;white-space:nowrap;gap:4px;line-height:1;padding:0 11px;font:800 14px Figtree,system-ui,sans-serif;color:#fff;text-decoration:none}#labo-switch .on{background:#fff;color:#201049}body.mode-student #labo-switch{display:inline-flex!important}header .zoo-hero .brand .sub{display:none}@media (max-width:650px){#labo-switch{height:24px}#labo-switch a:not(.on) b{display:none}#labo-switch a{min-width:38px;justify-content:center;padding:0 9px}#labo-switch span{padding:0 10px;font-size:13.5px}}";
      document.head.appendChild(st); host.appendChild(n);
    }
    /* Enseignant : la connexion peut avoir lieu après le chargement de la page ; on attend que l'espace s'affiche (une seule question au serveur) */
    function watchLogin() {
      var space = document.getElementById("space"); if (!space || !window.MutationObserver) return;
      var mo = new MutationObserver(function () { if (asked) { mo.disconnect(); return; } if (!space.classList.contains("hidden")) { ask(); if (asked) mo.disconnect(); } });
      mo.observe(space, { attributes: true, attributeFilter: ["class"] });
    }
    function start() { if (teacher) { ask(); if (!asked) watchLogin(); } else ask(); }
    if (document.readyState === "complete") setTimeout(start, 1200); else window.addEventListener("load", function () { setTimeout(start, 1200); });
  } catch (e) {}
})();
