/* Partage de Zoo de Lecture : feuille de partage native si elle existe (téléphone, tablette),
   sinon WhatsApp, e-mail et « Copier le lien ». Rien ne part tout seul : tout se fait au clic. */
(function () {
  var URL_SITE = "https://zoodelecture.fr/";
  var TITRE = "Zoo de Lecture";
  var TEXTE = "Je viens de découvrir Zoo de Lecture 🦁, un outil gratuit créé par un professeur des écoles pour travailler la lecture au CP. Il aide à organiser des ateliers autonomes et à adapter les activités aux élèves. À découvrir :";
  /* Cible du partage : le site entier, ou (bouton data-share-page) la page du guide en cours */
  function cible(page) {
    if (!page) return { url: URL_SITE, titre: TITRE, texte: TEXTE, objet: "Un outil de lecture pour le CP : Zoo de Lecture" };
    var c = document.querySelector("link[rel=canonical]"), h = document.querySelector("h1");
    var titre = h ? h.textContent.replace(/\s+/g, " ").trim() : document.title;
    return { url: (c && c.href) || location.href.split("#")[0], titre: titre,
      texte: "Un guide pour les enseignants de CP, par le créateur de Zoo de Lecture : « " + titre + " ». À lire :",
      objet: "Guide CP : " + titre };
  }
  function init(box) {
    var btns = box.querySelectorAll("[data-share-btn]"), more = box.querySelector("[data-share-more]"), status = box.querySelector("[data-share-status]");
    if (!btns.length || !more) return;
    var wa = more.querySelector("[data-share-wa]"), mail = more.querySelector("[data-share-mail]"), copy = more.querySelector("[data-share-copy]");
    var cur = cible(false);
    function viser(page) {
      cur = cible(page);
      var msg = cur.texte + " " + cur.url;
      if (wa) { wa.href = "https://wa.me/?text=" + encodeURIComponent(msg); wa.target = "_blank"; wa.rel = "noopener noreferrer"; }
      if (mail) mail.href = "mailto:?subject=" + encodeURIComponent(cur.objet) + "&body=" + encodeURIComponent(msg);
    }
    viser(false);
    function say(t) { if (status) status.textContent = t; }
    Array.prototype.forEach.call(btns, function (btn) {
      var page = btn.hasAttribute("data-share-page");
      function showMore() { more.hidden = false; btn.setAttribute("aria-expanded", "true"); }
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        say(""); viser(page);
        if (navigator.share) {
          navigator.share({ title: cur.titre, text: cur.texte, url: cur.url }).catch(function (e) {
            if (e && e.name === "AbortError") return;   /* l’utilisateur a fermé la feuille : rien à faire */
            showMore();
          });
          return;
        }
        showMore();
      });
    });
    if (copy) copy.addEventListener("click", function () {
      var lien = cur.url;
      function ok() { say("Lien copié"); }
      function fallback() {
        try {
          var ta = document.createElement("textarea"); ta.value = lien; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;left:-999px";
          document.body.appendChild(ta); ta.select(); var done = document.execCommand("copy"); document.body.removeChild(ta);
          if (done) ok(); else say("Copie impossible : le lien est " + lien);
        } catch (e) { say("Copie impossible : le lien est " + lien); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lien).then(ok, fallback); else fallback();
    });
  }
  function start() { Array.prototype.forEach.call(document.querySelectorAll("[data-share]"), init); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
