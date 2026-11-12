/* « Qui es-tu ? » : profils mémorisés sur l'appareil (comme le choix de compte de Netflix ou de Google).
   Partagé par eleve.html (élèves), enseignants.html (enseignants) et zoo-connecte.html (met l'avatar à jour).
   - Stockage : localStorage, clé « profiles » = tableau JSON, 8 profils maximum PAR GROUPE (élèves / enseignants, pour qu'un compte
     enseignant ne fasse jamais disparaître un élève), le plus récent en premier, sans doublon.
   - On ne mémorise QUE : prénom/pseudo, avatar, rôle et identifiant de connexion (élève : code de classe + prénom ; enseignant : e-mail).
     Jamais de mot de passe, jamais de code secret, jamais de jeton de session : les champs sont choisis un par un (liste blanche).
   - Tous les accès au stockage sont protégés par try/catch (navigation privée, stockage bloqué) : sans stockage, rien ne casse.
   Syntaxe volontairement ancienne (ES2018) pour rester lisible par Safari 12 (iPad iOS 12 de l'école). */
(function () {
  var KEY = "profiles", MAX = 8;

  /* ---------- stockage ---------- */
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function group(role) { return role === "student" ? "student" : "teacher"; }
  function str(v, n) { return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, n) : ""; }
  function valid(p) {
    return !!(p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string" && p.login && typeof p.login === "object" &&
      (p.role === "student" || p.role === "teacher" || p.role === "admin"));
  }
  function readAll() {
    var s = store();
    if (!s) return [];
    try {
      var a = JSON.parse(s.getItem(KEY) || "[]");
      return Array.isArray(a) ? a.filter(valid) : [];
    } catch (e) { return []; }
  }
  function writeAll(a) {
    var s = store();
    if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; }
  }
  /* Identité d'un profil : sert à éviter les doublons (la casse et les espaces ne comptent pas) */
  function keyOf(p) {
    return group(p.role) + "|" + (p.role === "student" ? str(p.login.code, 40) + "|" + str(p.login.nickname, 60) : str(p.login.email, 120)).toLowerCase();
  }
  /* Ne garde que les champs autorisés (liste blanche) : aucune donnée sensible ne peut passer */
  function clean(info) {
    var role = info && (info.role === "student" || info.role === "admin") ? info.role : "teacher";
    var l = (info && info.login) || {};
    var login = role === "student" ? { code: str(l.code, 40), nickname: str(l.nickname, 60) } : { email: str(l.email, 120) };
    var av = str(info && info.avatar, 12);
    return { role: role, name: str(info && info.name, 60), avatar: av || null, login: login };
  }
  function newId() {
    var a = "";
    try { var u = new Uint8Array(8); window.crypto.getRandomValues(u); for (var i = 0; i < u.length; i++) a += (u[i] + 256).toString(16).slice(1); } catch (e) { a = String(Math.random()).slice(2, 12); }
    return "p" + Date.now().toString(36) + a;
  }

  /* ---------- API ---------- */
  /* Profils d'un groupe : "student" ou "teacher" (les enseignants et l'admin sont dans le même groupe) */
  function list(g) {
    return readAll().filter(function (p) { return group(p.role) === g; });
  }
  /* Enregistre un profil après une connexion réussie ; renvoie le profil mémorisé (ou null si rien n'a pu être mémorisé) */
  function save(info) {
    var c = clean(info);
    if (!c.name || (c.role === "student" ? !c.login.code || !c.login.nickname : !c.login.email)) return null;
    var all = readAll(), k = keyOf(c), id = null, avatar = c.avatar;
    all = all.filter(function (p) {
      if (keyOf(p) !== k) return true;
      id = p.id; if (!avatar) avatar = p.avatar || null;   // on garde l'avatar déjà connu
      return false;
    });
    var prof = { id: id || newId(), role: c.role, name: c.name, avatar: avatar, login: c.login, ts: Date.now() };
    all.unshift(prof);
    var n = 0;   // 8 profils maximum par groupe : les plus anciens sortent
    all = all.filter(function (p) { if (group(p.role) !== group(prof.role)) return true; n++; return n <= MAX; });
    return writeAll(all) ? prof : null;
  }
  /* Quand le prénom ou l'avatar change : met à jour le profil mémorisé (sans rien écrire si rien n'a changé) */
  function update(id, patch) {
    var all = readAll(), changed = false;
    all.forEach(function (p) {
      if (p.id !== id) return;
      var nm = str(patch && patch.name, 60), av = str(patch && patch.avatar, 12);
      /* pour un élève, le prénom est aussi son identifiant de connexion : s'il est renommé, on suit le serveur */
      if (nm && nm !== p.name) { p.name = nm; changed = true; if (p.role === "student" && p.login) p.login.nickname = nm; }
      if (av && av !== p.avatar) { p.avatar = av; changed = true; }
    });
    return changed ? writeAll(all) : false;
  }
  function remove(id) { return writeAll(readAll().filter(function (p) { return p.id !== id; })); }
  function clear(g) { return writeAll(readAll().filter(function (p) { return group(p.role) !== g; })); }
  function available() {
    var s = store();
    if (!s) return false;
    try { s.setItem("profiles_test", "1"); s.removeItem("profiles_test"); return true; } catch (e) { return false; }
  }

  /* ---------- écrans ---------- */
  var COLORS = ["#6d4fc2", "#1f7a6d", "#b8470b", "#b02a6b", "#1b63c9", "#8a6d00", "#5b3fb0", "#0f766e"];   // blanc lisible dessus (contraste ≥ 4,5)
  function colorOf(name) { var h = 0, s = String(name || "?"); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return COLORS[h % COLORS.length]; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function avatarEl(p, big) {
    var a = el("span", "zp-av" + (big ? " zp-av-big" : ""));
    a.setAttribute("aria-hidden", "true");
    a.style.background = colorOf(p.name);
    a.textContent = p.avatar || (p.name.charAt(0) || "?").toUpperCase();
    return a;
  }
  var CSS = [
    ".zp{max-width:440px;margin:0 auto;color:var(--zp-ink,#fff)}",
    ".zp *{box-sizing:border-box}",
    ".zp [hidden]{display:none !important}",   /* sinon display:block des boutons annule l'attribut hidden */
    ".zp-title{margin:0 0 14px;text-align:center;font:800 1.5rem Fredoka,Figtree,system-ui,sans-serif;color:var(--zp-ink,#fff)}",
    ".zp-help{margin:0 0 14px;text-align:center;color:var(--zp-muted,#c3c9da);font-size:1rem}",
    ".zp-grid{list-style:none;margin:0 0 14px;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-gap:12px;gap:12px}",
    ".zp-item{display:flex;flex-direction:column;align-items:stretch;min-width:0}",
    ".zp-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-height:136px;margin:0;padding:14px 8px;border-radius:16px;border:2px solid var(--zp-line,#343b4f);background:var(--zp-tile,#262b3c);color:var(--zp-ink,#fff);font:700 1.1rem/1.2 Figtree,system-ui,sans-serif;cursor:pointer;word-break:break-word;text-align:center}",
    ".zp-tile:hover{border-color:var(--zp-accent,#ffe56c)}",
    ".zp-tile:focus,.zp-btn:focus,.zp-rm:focus,.zp-link:focus,.zp-input:focus{outline:3px solid var(--zp-focus,#4be5f0);outline-offset:2px}",
    ".zp-av{display:flex;align-items:center;justify-content:center;width:64px;height:64px;margin:0 0 8px;border-radius:50%;color:#fff;font:800 1.9rem/1 Fredoka,Figtree,system-ui,sans-serif}",
    ".zp-av-big{width:88px;height:88px;font-size:2.6rem;margin:0 auto 10px}",
    ".zp-name{display:block}",
    ".zp-rm{width:100%;min-height:48px;margin:6px 0 0;padding:6px 8px;border-radius:12px;border:2px solid var(--zp-line,#343b4f);background:transparent;color:var(--zp-muted,#c3c9da);font:700 .95rem Figtree,system-ui,sans-serif;cursor:pointer}",
    ".zp-btn{display:block;width:100%;min-height:52px;margin:8px 0 0;padding:12px 18px;border-radius:12px;border:0;background:var(--zp-accent,#ffe56c);color:var(--zp-accent-ink,#21104f);font:800 1.15rem Figtree,system-ui,sans-serif;cursor:pointer}",
    ".zp-btn.zp-secondary{background:transparent;color:var(--zp-ink,#fff);border:2px solid var(--zp-line,#343b4f)}",
    ".zp-link{display:block;width:100%;min-height:48px;margin:6px 0 0;padding:10px;border:0;background:transparent;color:var(--zp-muted,#c3c9da);font:700 .95rem Figtree,system-ui,sans-serif;text-decoration:underline;cursor:pointer}",
    ".zp-label{display:block;margin:0 0 6px;font-weight:700;color:var(--zp-ink,#fff);font-size:1.05rem}",
    ".zp-input{display:block;width:100%;min-height:52px;margin:0 0 10px;padding:12px 14px;border-radius:12px;border:2px solid var(--zp-line,#343b4f);background:var(--zp-input,#151823);color:var(--zp-ink,#fff);font-size:18px;font-family:inherit}",
    ".zp-err{margin:0 0 8px;padding:10px 12px;border-radius:12px;background:var(--zp-errbg,#4a1f2b);color:var(--zp-errink,#ffd9de);font-weight:700;font-size:1rem}",
    ".zp-who{text-align:center;margin:0 0 12px}.zp-who h2{margin:0;font:800 1.5rem Fredoka,Figtree,system-ui,sans-serif;color:var(--zp-ink,#fff)}.zp-who small{color:var(--zp-muted,#c3c9da);display:block;margin-top:4px;word-break:break-all}"
  ].join("\n");
  function ensureCss() {
    if (document.getElementById("zp-css")) return;
    var s = document.createElement("style"); s.id = "zp-css"; s.appendChild(document.createTextNode(CSS)); document.head.appendChild(s);
  }

  /* Écran « Qui es-tu ? » : grille de grosses pastilles (avatar + prénom).
     opts : group ("student"|"teacher"), title, onPick(profil), onOther() = « Autre profil / Nouvelle connexion », onChange() après un retrait */
  function pickerUI(host, opts) {
    ensureCss();
    host.innerHTML = "";
    var root = el("div", "zp");
    root.appendChild(el("h2", "zp-title", opts.title || "Qui es-tu ?"));
    var ul = el("ul", "zp-grid");
    list(opts.group).forEach(function (p) {
      var li = el("li", "zp-item");
      var b = el("button", "zp-tile"); b.type = "button";
      b.setAttribute("aria-label", "Me connecter comme " + p.name);
      b.appendChild(avatarEl(p, false)); b.appendChild(el("span", "zp-name", p.name));
      b.addEventListener("click", function () { opts.onPick(p); });
      var rm = el("button", "zp-rm", "Retirer"); rm.type = "button";
      rm.setAttribute("aria-label", "Retirer le profil de " + p.name + " de cet appareil");
      rm.addEventListener("click", function () { remove(p.id); if (opts.onChange) opts.onChange(); });
      li.appendChild(b); li.appendChild(rm); ul.appendChild(li);
    });
    root.appendChild(ul);
    var other = el("button", "zp-btn zp-secondary", "＋ Autre profil / Nouvelle connexion"); other.type = "button";
    other.addEventListener("click", function () { opts.onOther(); });
    root.appendChild(other);
    /* Effacer tous les profils : deux gestes (un premier pour demander, un second pour confirmer) ; pas de confirm() du navigateur, souvent bloqué */
    var clr = el("button", "zp-link", "Effacer tous les profils de cet appareil"); clr.type = "button";
    clr.addEventListener("click", function () {
      if (!clr.getAttribute("data-sure")) { clr.setAttribute("data-sure", "1"); clr.textContent = "Oui, tout effacer (touche encore pour confirmer)"; return; }
      clear(opts.group); if (opts.onChange) opts.onChange();
    });
    root.appendChild(clr);
    host.appendChild(root);
    return root;
  }

  /* Écran du secret seul : l'identifiant est déjà connu, on demande seulement le code secret (élève) ou le mot de passe (enseignant).
     opts : kind ("pin"|"password"), submit(secret) → Promise<{ok:true}|{ok:false, msg, removable}>, onBack(), onRemoved() */
  function secretUI(host, p, opts) {
    ensureCss();
    host.innerHTML = "";
    var root = el("div", "zp");
    var who = el("div", "zp-who");
    who.appendChild(avatarEl(p, true));
    who.appendChild(el("h2", "", opts.kind === "pin" ? "Bonjour " + p.name + " !" : p.name));
    if (opts.kind !== "pin" && p.login && p.login.email) who.appendChild(el("small", "", p.login.email));
    root.appendChild(who);
    var form = el("form"); form.setAttribute("novalidate", "novalidate");
    var lab = el("label", "zp-label", opts.kind === "pin" ? "Ton code secret" : "Votre mot de passe"); lab.setAttribute("for", "zp-secret");
    var inp = el("input", "zp-input"); inp.id = "zp-secret"; inp.type = "password"; inp.required = true; inp.setAttribute("autocomplete", opts.kind === "pin" ? "off" : "current-password");
    if (opts.kind === "pin") { inp.setAttribute("inputmode", "numeric"); inp.setAttribute("pattern", "[0-9]*"); inp.maxLength = 8; }
    var err = el("p", "zp-err"); err.hidden = true; err.setAttribute("role", "alert");
    var go = el("button", "zp-btn", opts.kind === "pin" ? "Entrer dans mon Zoo 🐾" : "Me connecter"); go.type = "submit";
    var back = el("button", "zp-btn zp-secondary", "← Choisir un autre profil"); back.type = "button";
    var rm = el("button", "zp-link", "Retirer ce profil de cet appareil"); rm.type = "button"; rm.hidden = true;
    form.appendChild(lab); form.appendChild(inp); form.appendChild(err); form.appendChild(go);
    root.appendChild(form); root.appendChild(back); root.appendChild(rm);
    function show(msg, removable) { err.textContent = msg; err.hidden = false; rm.hidden = !removable; }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = inp.value;
      if (!v) { show(opts.kind === "pin" ? "Écris ton code secret." : "Écrivez votre mot de passe.", false); inp.focus(); return; }
      err.hidden = true; rm.hidden = true; go.disabled = true;
      Promise.resolve().then(function () { return opts.submit(v); }).then(function (r) {
        go.disabled = false;
        if (r && r.ok) return;   // la page a pris le relais (connexion réussie)
        inp.value = ""; show((r && r.msg) || "Connexion impossible.", !!(r && r.removable)); inp.focus();
      }).catch(function () { go.disabled = false; inp.value = ""; show("Connexion impossible : vérifie internet, puis réessaie.", false); });
    });
    back.addEventListener("click", function () { opts.onBack(); });
    rm.addEventListener("click", function () { remove(p.id); if (opts.onRemoved) opts.onRemoved(); });
    host.appendChild(root);
    try { inp.focus(); } catch (e) {}
    return root;
  }

  window.ZooProfils = { list: list, save: save, update: update, remove: remove, clear: clear, available: available, pickerUI: pickerUI, secretUI: secretUI, KEY: KEY, MAX: MAX };
})();
