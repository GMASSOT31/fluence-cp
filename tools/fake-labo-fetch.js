/* Fait répondre les appels « /rest/v1/rpc/lab_* » de la page enseignant par l'API factice de tools/fake-labo.js (aucun réseau).
   À charger APRÈS fake-labo.js (avec window.__labNoClient = 1 avant, pour ne pas remplacer le faux client de la page). */
(function () {
  var real = window.fetch, api = window.__labApi;
  window.fetch = function (url, opt) {
    var m = /\/rest\/v1\/rpc\/(lab_[a-z_]+)/.exec(String(url));
    if (!m || !api) return real.apply(this, arguments);
    var name = m[1], args = {}; try { args = JSON.parse((opt && opt.body) || "{}"); } catch (e) {}
    window.__lab.calls.push(name);
    return new Promise(function (res) { setTimeout(function () {
      try { if (!api[name]) throw { message: "fonction inconnue : " + name }; var out = api[name](args); res(new Response(JSON.stringify(out === undefined ? null : out), { status: 200, headers: { "Content-Type": "application/json" } })); }
      catch (e) { res(new Response(JSON.stringify({ message: e.message || "Erreur" }), { status: 400, headers: { "Content-Type": "application/json" } })); }
    }, 15); });
  };
})();
