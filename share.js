/* Partage de Zoo de Lecture : feuille de partage native si elle existe (téléphone, tablette),
   sinon WhatsApp, e-mail et « Copier le lien ». Rien ne part tout seul : tout se fait au clic. */
(function () {
  var URL_SITE = "https://zoodelecture.fr/";
  var TITRE = "Zoo de Lecture";
  var TEXTE = "Je viens de découvrir Zoo de Lecture 🦁, un outil gratuit créé par un professeur des écoles pour travailler la lecture au CP. Il aide à organiser des ateliers autonomes et à adapter les activités aux élèves. À découvrir :";
  function init(box) {
    var btn = box.querySelector("[data-share-btn]"), more = box.querySelector("[data-share-more]"), status = box.querySelector("[data-share-status]");
    if (!btn || !more) return;
    var wa = more.querySelector("[data-share-wa]"), mail = more.querySelector("[data-share-mail]"), copy = more.querySelector("[data-share-copy]");
    var msg = TEXTE + " " + URL_SITE;
    if (wa) { wa.href = "https://wa.me/?text=" + encodeURIComponent(msg); wa.target = "_blank"; wa.rel = "noopener noreferrer"; }
    if (mail) mail.href = "mailto:?subject=" + encodeURIComponent("Un outil de lecture pour le CP : Zoo de Lecture") + "&body=" + encodeURIComponent(msg);
    function say(t) { if (status) status.textContent = t; }
    function showMore() { more.hidden = false; btn.setAttribute("aria-expanded", "true"); }
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", function () {
      say("");
      if (navigator.share) {
        navigator.share({ title: TITRE, text: TEXTE, url: URL_SITE }).catch(function (e) {
          if (e && e.name === "AbortError") return;   /* l’utilisateur a fermé la feuille : rien à faire */
          showMore();
        });
        return;
      }
      showMore();
    });
    if (copy) copy.addEventListener("click", function () {
      function ok() { say("Lien copié"); }
      function fallback() {
        try {
          var ta = document.createElement("textarea"); ta.value = URL_SITE; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;left:-999px";
          document.body.appendChild(ta); ta.select(); var done = document.execCommand("copy"); document.body.removeChild(ta);
          if (done) ok(); else say("Copie impossible : le lien est " + URL_SITE);
        } catch (e) { say("Copie impossible : le lien est " + URL_SITE); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(URL_SITE).then(ok, fallback); else fallback();
    });
  }
  function start() { Array.prototype.forEach.call(document.querySelectorAll("[data-share]"), init); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
