/* Client de secours pour les anciens appareils (iPad sous iOS 12, Safari 12…) sur lesquels la vraie bibliothèque
   (vendor/supabase.js, écrite avec une syntaxe récente) ne peut pas se charger.
   Il ne fait que .rpc() — c'est tout ce qu'utilisent les pages élèves (eleve.html, zoo-connecte.html, labo-calcul.html) —
   et ne s'active QUE si window.supabase n'existe pas : sur un appareil récent, rien ne change.
   Syntaxe volontairement ancienne (pas de ?. ni ??) pour rester lisible par Safari 12. */
(function () {
  if (window.supabase && window.supabase.createClient) return;
  function createClient(url, key) {
    url = String(url).replace(/\/+$/, "");
    function rpc(name, args) {
      return fetch(url + "/rest/v1/rpc/" + encodeURIComponent(name), {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(args || {})
      }).then(function (r) {
        return r.text().then(function (t) {
          var body = null;
          try { body = t ? JSON.parse(t) : null; } catch (e) { body = null; }
          if (r.ok) return { data: body, error: null };
          return { data: null, error: { message: (body && (body.message || body.error)) || ("Erreur " + r.status), code: body && body.code, details: body && body.details, hint: body && body.hint, status: r.status } };
        });
      }).catch(function (e) {
        return { data: null, error: { message: (e && e.message) || "Connexion au serveur impossible" } };
      });
    }
    return { rpc: rpc };
  }
  window.supabase = { createClient: createClient, lite: true };
})();
