/* Démo « Essayer sans compte » de Zoo de Lecture.
   Chargé à la place de la bibliothèque Supabase quand l'adresse contient ?demo : imite les fonctions
   utilisées par le Zoo élève (zoo-connecte.html) et l'espace enseignant (enseignants.html).
   Aucune donnée ne quitte le navigateur : tout vit dans sessionStorage (onglet en cours) et repart de zéro
   à chaque nouvelle démo. */
(function () {
  "use strict";
  var KEY = "zoo_demo_state", TOKEN = "demo";
  var DAY = 86400000, NOW = Date.now();
  var MODES = { memory: "min", order: "min", safari: "min", catch: "max", count: "max", flap: "max", simon: "max", stack: "max", ballons: "max", snake: "max" };
  var NOT_IN_DEMO = { message: "Pas disponible dans la démo : crée ton compte pour utiliser cette fonction." };

  /* ---------- Données de départ : la classe « CP des Tigres » ---------- */
  function res(sid, sound, k, mclm, daysAgo, src) {
    var n = Math.round(mclm * 0.95) + 2;
    return { id: "d" + sid + sound + k + (src || "e") + daysAgo, sid: sid, sound: sound, k: k, n: n, e: n - mclm, t: 60, mclm: mclm, ts: NOW - daysAgo * DAY, src: src };
  }
  function hi(best, daysAgo) { return { best: best, last: best, n: 3, bts: NOW - daysAgo * DAY }; }
  function seed() {
    var T = "t-demo", C = "c-demo";
    var kids = [
      { id: "s-leo", nickname: "Léo", avatar: "👦🏽" },
      { id: "s-ines", nickname: "Inès", avatar: "👧🏻" },
      { id: "s-noah", nickname: "Noah", avatar: "👦🏾" },
      { id: "s-jade", nickname: "Jade", avatar: "👧🏼" },
      { id: "s-malo", nickname: "Malo", avatar: "👦🏻" },
      { id: "s-lina", nickname: "Lina", avatar: "👧🏽" }
    ];
    var P = {
      "s-leo": { coins: 12, credits: 4, avatar: "👦🏽",
        results: [res("s-leo", "voy", "s", 34, 9), res("s-leo", "l", "s", 31, 7), res("s-leo", "l", "m", 24, 5), res("s-leo", "l", "t", 19, 3), res("s-leo", "f", "s", 27, 1, "train")],
        hi: { memory: hi(16, 4), simon: hi(6, 3), stack: hi(9, 2) },
        listen: { passes: { voy: 3 }, done: { voy: true }, tries: 4 } },
      "s-ines": { coins: 20, credits: 2, avatar: "👧🏻",
        results: [res("s-ines", "voy", "s", 40, 10), res("s-ines", "l", "s", 36, 8), res("s-ines", "l", "m", 27, 6), res("s-ines", "l", "t", 21, 4), res("s-ines", "f", "s", 33, 2), res("s-ines", "f", "m", 23, 1)],
        hi: { memory: hi(13, 2), simon: hi(8, 1), ballons: hi(11, 1) },
        listen: { passes: { voy: 3, l: 3 }, done: { voy: true, l: true }, tries: 7 } },
      "s-noah": { coins: 6, credits: 1, avatar: "👦🏾",
        results: [res("s-noah", "voy", "s", 29, 8), res("s-noah", "l", "s", 26, 4), res("s-noah", "l", "m", 17, 2, "train")],
        hi: { snake: hi(14, 2), stack: hi(12, 1) }, listen: { passes: { voy: 2 }, done: {}, tries: 3 } },
      "s-jade": { coins: 9, credits: 3, avatar: "👧🏼",
        results: [res("s-jade", "voy", "s", 31, 9), res("s-jade", "l", "s", 28, 5), res("s-jade", "l", "m", 21, 3)],
        hi: { order: hi(24, 2), flap: hi(32, 3) }, listen: { passes: { voy: 3 }, done: { voy: true }, tries: 3 } },
      "s-malo": { coins: 3, credits: 0, avatar: "👦🏻",
        results: [res("s-malo", "voy", "s", 22, 6, "train"), res("s-malo", "voy", "s", 27, 2)],
        hi: { memory: hi(22, 1) }, listen: { passes: {}, done: {}, tries: 1 } },
      "s-lina": { coins: 15, credits: 2, avatar: "👧🏽",
        results: [res("s-lina", "voy", "s", 38, 9), res("s-lina", "l", "s", 33, 6), res("s-lina", "l", "m", 25, 4), res("s-lina", "l", "t", 20, 2)],
        hi: { safari: hi(24310, 2), simon: hi(7, 2) }, listen: { passes: { voy: 3, l: 1 }, done: { voy: true }, tries: 5 } }
    };
    var progress = {};
    kids.forEach(function (k, i) {
      var p = P[k.id];
      p.vouchers = []; p.wheels = []; p.playLog = []; p.reviews = []; p.notes = [];
      progress[k.id] = { progress: p, version: 1, updated_at: new Date(NOW - (i + 1) * 3600000).toISOString(), pending_coins: 0, given_vouchers: [] };
    });
    return {
      v: 1, me: "s-leo",
      teacher: { id: T, email: "demo@zoodelecture.fr", display_name: "Démo", student_limit: 30, role: "teacher", seat_request: null, seat_request_at: null, ghosted_at: null },
      classes: [{ id: C, name: "CP des Tigres", access_code: "DEMO", teacher_id: T, school_year: null, ghosted_at: null }],
      students: kids.map(function (k) { return { id: k.id, nickname: k.nickname, class_id: C, teacher_id: T, pin_hash: "demo", ghosted_at: null }; }),
      progress: progress,
      settings: { reward: true, sfx: true, music: true, evalCode: false, allowRec: false, maxPlays: 6, lock: true },
      n: 0
    };
  }

  /* ---------- État de la démo (sessionStorage) ---------- */
  var params = new URLSearchParams(location.search);
  var S = null;
  try { if (!params.has("new")) S = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!S || S.v !== 1) S = seed();
  function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  persist();
  if (params.has("new")) { try { sessionStorage.setItem("zoo_demo_tour", JSON.stringify(params.get("tour") === "short" ? { on: true, step: 1, mode: "short" } : { on: true, step: 0 })); } catch (e) {} params.delete("new"); params.delete("tour"); try { history.replaceState(null, "", location.pathname + "?" + params.toString() + location.hash); } catch (e) {} }
  try { sessionStorage.setItem("zoo_student_token", TOKEN); sessionStorage.setItem("zoo_student_name", "Léo"); } catch (e) {}
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { S.n++; return p + S.n + "-" + Date.now().toString(36); }
  function student(id) { return S.students.filter(function (s) { return s.id === id; })[0] || null; }
  function row(id) { return S.progress[id] || (S.progress[id] = { progress: {}, version: 0, updated_at: new Date().toISOString(), pending_coins: 0, given_vouchers: [] }); }
  function classmates() {
    var me = student(S.me);
    return S.students.filter(function (s) { return me && s.class_id === me.class_id && !s.ghosted_at; });
  }
  function norm(v) { return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(); }

  /* ---------- Côté élève : les fonctions student_* ---------- */
  function bestOf(game) {
    var m = MODES[game], b = null;
    classmates().forEach(function (s) {
      var p = row(s.id).progress, h = p.hi && p.hi[game];
      if (!h || typeof h.best !== "number" || (m === "max" && h.best <= 0)) return;
      var ts = h.bts || 0;
      if (!b || (m === "min" ? h.best < b.value : h.best > b.value) || (h.best === b.value && ts < b.ts))
        b = { value: h.best, nickname: s.nickname, avatar: p.avatar || "", mine: s.id === S.me, ts: ts };
    });
    return b;
  }
  function checkVersion(v) { if (v !== row(S.me).version) throw { message: "SYNC_CONFLICT" }; }
  var studentApi = {
    student_session_profile: function () { var s = student(S.me); return { student_id: s.id, nickname: s.nickname }; },
    student_get_progress_v2: function () { var r = row(S.me); return { progress: copy(r.progress), version: r.version }; },
    student_get_progress: function () { return copy(row(S.me).progress); },
    student_save_progress_v2: function (a) {
      checkVersion(a.p_version);
      var r = row(S.me); r.progress = copy(a.p_progress || {}); r.version++; r.updated_at = new Date().toISOString();
      return r.version;
    },
    student_get_teacher_settings: function () { return copy(S.settings); },
    verify_evaluation_code: function (a) { return !!String(a.p_code || "").trim(); },   /* en démo, n'importe quel code */
    student_get_class_records: function () {
      var mates = classmates(), out = {};
      if (mates.length >= 2) Object.keys(MODES).forEach(function (g) { var b = bestOf(g); if (b) { delete b.ts; out[g] = b; } });
      return { classSize: mates.length, records: out };
    },
    student_claim_coins: function (a) {
      var r = row(S.me);
      if (!r.pending_coins) return { claimed: 0, version: r.version };
      checkVersion(a.p_version);
      var n = r.pending_coins; r.pending_coins = 0; r.progress.coins = (r.progress.coins || 0) + n; r.version++;
      return { claimed: n, coins: r.progress.coins, version: r.version };
    },
    student_claim_vouchers: function (a) {
      var r = row(S.me);
      if (!r.given_vouchers.length) return { claimed: 0, version: r.version };
      checkVersion(a.p_version);
      var ids = r.given_vouchers.slice(); r.given_vouchers = [];
      (r.progress.vouchers || []).forEach(function (v) { if (ids.indexOf(v.id) >= 0) v.done = true; });
      r.version++;
      return { claimed: ids.length, ids: ids, version: r.version };
    },
    /* Même règle que le serveur : 1 objectif (donné par le Zoo), 3 record perso battu, 10 record pris à un camarade */
    student_submit_score: function (a) {
      checkVersion(a.p_version);
      var m = MODES[a.p_game]; if (!m) throw { message: "Jeu inconnu" };
      var v = Number(a.p_value), r = row(S.me), p = r.progress, h = p.hi || (p.hi = {}), old = h[a.p_game] || {};
      var prev = typeof old.best === "number" ? old.best : null;
      var better = prev === null ? (m === "min" || v > 0) : (m === "min" ? v < prev : v > prev);
      var abs = null, absolute = false;
      if (better && classmates().length >= 2) { abs = bestOf(a.p_game); absolute = !!abs && (m === "min" ? v < abs.value : v > abs.value); }
      var gain = absolute && !abs.mine ? 10 : (better && prev !== null ? 3 : 0);
      var entry = { best: better ? v : prev, last: v, n: (old.n || 0) + 1, bts: better ? Date.now() : old.bts };
      h[a.p_game] = entry; p.coins = (p.coins || 0) + gain; r.version++; r.updated_at = new Date().toISOString();
      return { record: better, first: better && prev === null, prev: prev, absolute: absolute, gain: gain, coins: p.coins, entry: entry, version: r.version,
        prevAbs: absolute ? { value: abs.value, nickname: abs.nickname, avatar: abs.avatar, mine: abs.mine } : null };
    }
  };

  /* ---------- Côté enseignant : tables et fonctions ---------- */
  var teacherRpc = {
    set_student_pin: function (a) { var s = student(a.p_student); if (!s) throw { message: "Élève non autorisé" }; s.pin_hash = "demo"; return null; },
    manage_student: function (a) {
      var s = student(a.p_student); if (!s) throw { message: "Élève introuvable" };
      if (a.p_action === "ghost") s.ghosted_at = new Date().toISOString();
      else if (a.p_action === "unghost") s.ghosted_at = null;
      else if (a.p_action === "delete") { if (s.id === S.me) throw { message: "Dans la démo, Léo reste dans la classe : c'est l'élève que tu incarnes." }; S.students = S.students.filter(function (x) { return x !== s; }); delete S.progress[s.id]; }
      else throw { message: "Action inconnue" };
      return a.p_action;
    },
    manage_class: function (a) {
      var c = S.classes.filter(function (x) { return x.id === a.p_class; })[0]; if (!c) throw { message: "Classe introuvable" };
      if (a.p_action === "ghost") c.ghosted_at = new Date().toISOString();
      else if (a.p_action === "unghost") c.ghosted_at = null;
      else if (a.p_action === "delete") {
        if (S.students.some(function (s) { return s.class_id === c.id && s.id === S.me; })) throw { message: "Dans la démo, la classe de Léo ne peut pas être supprimée." };
        S.classes = S.classes.filter(function (x) { return x !== c; });
        S.students = S.students.filter(function (s) { return s.class_id !== c.id; });
      } else throw { message: "Action inconnue" };
      return a.p_action;
    },
    teacher_give_coins: function (a) { var r = row(a.p_student); r.pending_coins += Number(a.p_amount) || 0; return r.pending_coins; },
    teacher_give_voucher: function (a) { var r = row(a.p_student); if (r.given_vouchers.indexOf(a.p_voucher) < 0) r.given_vouchers.push(a.p_voucher); return r.given_vouchers.length; },
    feedback_mark_replies_seen: function () { return 0; },
    teacher_request_seats: function () { throw NOT_IN_DEMO; },
    admin_manage_teacher: function () { throw NOT_IN_DEMO; }
  };
  function progressRows() {
    return S.students.map(function (s) { var r = row(s.id); return { student_id: s.id, teacher_id: s.teacher_id, progress: copy(r.progress), updated_at: r.updated_at, pending_coins: r.pending_coins, given_vouchers: r.given_vouchers.slice() }; });
  }
  function tableRows(t) {
    if (t === "teachers") return [copy(S.teacher)];
    if (t === "classes") return copy(S.classes);
    if (t === "students") return copy(S.students);
    if (t === "student_progress") return progressRows();
    if (t === "teacher_zoo_settings") return [{ teacher_id: S.teacher.id, settings: copy(S.settings) }];
    return [];   /* teacher_feedback : vide en démo */
  }
  function query(table) {
    var op = "select", payload = null, filters = [], single = false, maybe = false;
    var q = {
      select: function () { return q; }, order: function () { return q; }, limit: function () { return q; }, in: function () { return q; },
      eq: function (k, v) { filters.push(function (x) { return x[k] === v; }); return q; },
      is: function (k, v) { filters.push(function (x) { return (x[k] === undefined ? null : x[k]) === v; }); return q; },
      single: function () { single = true; return q; }, maybeSingle: function () { single = true; maybe = true; return q; },
      insert: function (p) { op = "insert"; payload = p; return q; }, update: function (p) { op = "update"; payload = p; return q; },
      upsert: function (p) { op = "upsert"; payload = p; return q; }, delete: function () { op = "delete"; return q; },
      then: function (ok, ko) { return run().then(ok, ko); }
    };
    function keep(x) { return filters.every(function (f) { return f(x); }); }
    function run() {
      return new Promise(function (resolve) {
        setTimeout(function () {
          var out;
          try { out = { data: exec(), error: null }; persist(); } catch (e) { out = { data: null, error: e && e.message ? e : { message: String(e) } }; }
          resolve(out);
        }, 30);
      });
    }
    function exec() {
      if (op === "select") {
        var rows = tableRows(table).filter(keep);
        if (single) { if (!rows.length && !maybe) throw { message: "Aucune ligne" }; return rows[0] || null; }
        return rows;
      }
      if (table === "teacher_feedback") throw NOT_IN_DEMO;
      if (table === "teacher_zoo_settings" && op === "upsert") { S.settings = copy(payload.settings || {}); return null; }
      if (table === "classes" && op === "insert") {
        var code = payload.access_code ? norm(payload.access_code) : "";
        if (code && !/^[A-Z0-9]{4,20}$/.test(code)) throw { code: "22023", message: "Le code de classe doit faire de 4 à 20 lettres ou chiffres." };
        if (!code) code = "DEMO" + Math.random().toString(36).slice(2, 6).toUpperCase();
        if (S.classes.some(function (c) { return c.access_code === code; })) throw { code: "23505", message: 'duplicate key value violates unique constraint "classes_access_code_key"' };
        var c = { id: uid("c-"), name: payload.name, access_code: code, teacher_id: S.teacher.id, school_year: null, ghosted_at: null };
        S.classes.push(c); return single ? copy(c) : [copy(c)];
      }
      if (table === "classes" && op === "update") {
        var cls = S.classes.filter(keep)[0]; if (!cls) throw { message: "Classe introuvable" };
        if (payload.access_code !== undefined) {
          var nc = norm(payload.access_code);
          if (!/^[A-Z0-9]{4,20}$/.test(nc)) throw { code: "22023", message: "Le code de classe doit faire de 4 à 20 lettres ou chiffres." };
          if (S.classes.some(function (x) { return x !== cls && x.access_code === nc; })) throw { code: "23505", message: 'duplicate key value violates unique constraint "classes_access_code_key"' };
          cls.access_code = nc;
        }
        if (payload.name !== undefined) cls.name = payload.name;
        return single ? copy(cls) : [copy(cls)];
      }
      if (table === "students" && op === "insert") {
        if (S.students.length >= S.teacher.student_limit) throw { message: "Limite de " + S.teacher.student_limit + " élèves atteinte" };
        var s = { id: uid("s-"), nickname: payload.nickname, class_id: payload.class_id, teacher_id: S.teacher.id, pin_hash: null, ghosted_at: null };
        S.students.push(s); return single ? { id: s.id } : [copy(s)];
      }
      if (table === "teachers" && op === "update") { throw NOT_IN_DEMO; }
      throw NOT_IN_DEMO;
    }
    return q;
  }
  function rpc(name, args) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var fn = studentApi[name] || teacherRpc[name];
        if (!fn) return resolve({ data: null, error: NOT_IN_DEMO });
        try { var data = fn(args || {}); persist(); resolve({ data: data, error: null }); }
        catch (e) { resolve({ data: null, error: e && e.message ? e : { message: String(e) } }); }
      }, 40);
    });
  }
  var demoUser = { id: S.teacher.id, email: S.teacher.email, user_metadata: { display_name: "Démo" } };
  window.supabase = { createClient: function () { return {
    rpc: rpc,
    from: query,
    auth: {
      getUser: function () { return Promise.resolve({ data: { user: demoUser }, error: null }); },
      getSession: function () { return Promise.resolve({ data: { session: { user: demoUser } }, error: null }); },
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
      signInWithPassword: function () { return Promise.resolve({ data: null, error: NOT_IN_DEMO }); },
      signUp: function () { return Promise.resolve({ data: null, error: NOT_IN_DEMO }); },
      updateUser: function () { return Promise.resolve({ data: null, error: NOT_IN_DEMO }); },
      resetPasswordForEmail: function () { return Promise.resolve({ data: null, error: NOT_IN_DEMO }); },
      signOut: function () { zooDemo.exit(); return new Promise(function () {}); }
    }
  }; } };

  /* ---------- Bandeau « Démo » et navigation ---------- */
  var onTeacher = /enseignants\.html$/.test(location.pathname);
  var zooDemo = window.zooDemo = {
    state: function () { return S; },
    save: persist,
    restart: function () { try { sessionStorage.removeItem(KEY); } catch (e) {} location.href = "zoo-connecte.html?demo=1&new=1"; },   /* toujours depuis le Zoo de Léo, avec la visite au début */
    exit: function (to) {
      try { sessionStorage.removeItem(KEY); sessionStorage.removeItem("zoo_student_token"); sessionStorage.removeItem("zoo_student_name"); sessionStorage.removeItem("zoo_demo_tour"); } catch (e) {}
      location.href = to || (onTeacher ? "enseignants.html" : "eleve.html");
    }
  };
  function bar() {
    if (document.getElementById("demo-bar")) return;
    var css = document.createElement("style");
    css.textContent =
      "#demo-bar{position:relative;z-index:35;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 14px;padding:8px 12px;" +
      "background:linear-gradient(90deg,#ffe37c,#ffc861);color:#3b2a00;font:600 14px/1.3 Figtree,system-ui,sans-serif;text-align:center}" +
      "#demo-bar b{font-weight:800}#demo-bar a,#demo-bar button{font:inherit;font-weight:800;color:#3b2a00;background:rgba(255,255,255,.55);border:0;border-radius:999px;padding:4px 11px;text-decoration:none;cursor:pointer;box-shadow:none;min-height:0}" +
      "#demo-bar a:hover,#demo-bar button:hover{background:#fff}" +
      "body.playing #demo-bar,body.listen-focus #demo-bar,body.reading-focus #demo-bar{display:none}" +
      "@media(max-width:600px){#demo-bar{font-size:12.5px;gap:5px 8px;padding:6px 8px}#demo-bar .db-long{display:none}}";
    document.head.appendChild(css);
    var b = document.createElement("div");
    b.id = "demo-bar"; b.setAttribute("role", "region"); b.setAttribute("aria-label", "Mode démonstration");
    var t = document.createElement("span");
    t.innerHTML = "🧪 <b>Démo</b><span class=\"db-long\"> : rien n'est enregistré, tout repart de zéro à la prochaine visite</span>";
    b.appendChild(t);
    function link(text, href) { var a = document.createElement("a"); a.href = href; a.textContent = text; b.appendChild(a); return a; }
    function btn(text, fn) { var x = document.createElement("button"); x.type = "button"; x.textContent = text; x.addEventListener("click", fn); b.appendChild(x); return x; }
    if (onTeacher) link("🧒 Voir le Zoo de Léo", "zoo-connecte.html?demo=1");
    else link("🧑‍🏫 Espace enseignant", "enseignants.html?demo=1");
    btn("↺ Recommencer", zooDemo.restart);
    btn("✨ Créer mon compte", function () { zooDemo.exit("enseignants.html#inscription"); });
    btn("✕ Quitter", function () { zooDemo.exit(); });
    document.body.insertBefore(b, document.body.firstChild);
    /* Liens de la page qui mèneraient hors de la démo */
    var toStudent = document.getElementById("toStudent");
    if (toStudent) toStudent.href = "zoo-connecte.html?demo=1";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bar); else bar();
  /* Visite guidée (bulles pas à pas) */
  var tour = document.createElement("script"); tour.src = "demo-tour.js?v=8"; tour.defer = true;
  (document.head || document.documentElement).appendChild(tour);
})();
