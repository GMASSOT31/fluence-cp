/* Faux client Supabase du LABO DE CALCUL (aucun appel réseau). Reproduit les règles de supabase/migrations/20261112_labo_calcul.sql :
   autorisation, interrupteur, tours idempotents, pièces de test calculées côté « serveur », plafond de 10 séries récompensées par jour.
   Options d'URL : ?who=ok (élève autorisé, défaut) | refuse (élève non autorisé) | none (pas de jeton) ; ?off=1 (interrupteur serveur coupé) ;
   ?role=admin (défaut) | teacher (autorisé) | refuse (enseignant non autorisé) | out (non connecté) ; ?fail=1 (le rangement d'une série échoue une fois).
   Expose window.__lab (journal des appels, état). */
(function () {
  var q = location.search, opt = function (k, d) { var m = new RegExp("[?&]" + k + "=(\\w+)").exec(q); return m ? m[1] : d; };
  var who = opt("who", "ok"), role = opt("role", "admin");
  var lab = window.__lab = {
    calls: [], enabled: !/[?&]off=1/.test(q), failOnce: /[?&]fail=1/.test(q),
    realWallet: { coins: 13, credits: 20 },   /* « vrais » soldes de lecture : ne doivent JAMAIS bouger */
    me: { coins: 0, credits: 0, levels: {}, hist: [] }, rounds: {}, ops: {}, rewardedToday: 0,
    settings: {}, enabledSwitch: true,
    access: [{ id: "x1", kind: "teacher", subject_id: "t1", scope: "self_and_students", note: "moi", label: "Enseignant de test" }],
    teachers: [{ id: "t1", label: "Enseignant de test" }, { id: "t2", label: "Autre enseignant" }],
    students: [{ id: "s1", label: "lea", class_name: "CP-A" }, { id: "s2", label: "leo", class_name: "CP-A" }]
  };
  function err(m) { return { message: m, code: "42501" }; }
  function studentAllowed() { return lab.enabled && who === "ok"; }
  function teacherAllowed() { return lab.enabled && (role === "admin" || role === "teacher"); }
  function needStudent() { if (!studentAllowed()) throw err("Accès refusé"); }
  function needTeacher() { if (!teacherAllowed()) throw err("Accès refusé"); }
  function needAdmin() { if (role !== "admin") throw err("Accès refusé"); }
  function st() { return { test_coins: lab.me.coins, test_credits: lab.me.credits }; }
  function mix(o) { var r = st(); for (var k in o) r[k] = o[k]; return r; }

  var api = {
    lab_my_access: function (a) {
      if (a && a.p_token) return { allowed: studentAllowed(), role: "student" };
      return { allowed: teacherAllowed(), role: role === "admin" ? "admin" : "teacher" };
    },
    lab_student_state: function () { needStudent(); return mix({ progress: { levels: lab.me.levels, hist: lab.me.hist }, settings: lab.settings }); },
    lab_student_submit_round: function (a) {
      needStudent();
      if (lab.failOnce) { lab.failOnce = false; throw { message: "Failed to fetch" }; }
      if (["nombres", "addition", "soustraction"].indexOf(a.p_activity) < 0 || !/^[a-z0-9_-]{1,20}$/.test(a.p_level) || a.p_total < 1 || a.p_total > 20 || a.p_correct < 0 || a.p_correct > a.p_total) throw { message: "Données invalides" };
      if (lab.rounds[a.p_round]) return mix({ inserted: false, coins: 0 });
      var pass = Math.min(Math.max(lab.settings.pass || 80, 50), 100), ok = a.p_correct * 100 >= pass * a.p_total, coins = 0;
      if (ok && a.p_total >= 5 && lab.rewardedToday < 10) { coins = a.p_correct === a.p_total ? 2 : 1; lab.rewardedToday++; }
      lab.rounds[a.p_round] = coins; lab.me.coins += coins;
      var key = a.p_activity + ":" + a.p_level, c = lab.me.levels[key] || {}, s = a.p_stats || {};
      lab.me.levels[key] = { r: (c.r || 0) + 1, q: (c.q || 0) + a.p_total, c: (c.c || 0) + a.p_correct, rp: (c.rp || 0) + (s.replays || 0), h: (c.h || 0) + (s.helps || 0), ms: s.ms || 0,
        ok: (c.ok || 0) + (ok ? 1 : 0), best: Math.max(c.best || 0, Math.floor(a.p_correct * 100 / a.p_total)), last: "2026-11-12T10:00:00+01:00" };
      lab.me.hist.push({ k: key, c: a.p_correct, n: a.p_total, ok: ok });
      return mix({ inserted: true, coins: coins, success: ok, level: lab.me.levels[key] });
    },
    lab_student_buy_play: function (a) {
      needStudent(); if (lab.ops[a.p_op]) return mix({ done: false });
      if (lab.me.coins < 3) return mix({ done: false, reason: "not_enough" });
      lab.ops[a.p_op] = 1; lab.me.coins -= 3; lab.me.credits += 1; return mix({ done: true });
    },
    lab_student_use_play: function (a) {
      needStudent(); if (lab.ops[a.p_op]) return mix({ done: false });
      if (lab.me.credits < 1) return mix({ done: false, reason: "no_play" });
      lab.ops[a.p_op] = 1; lab.me.credits -= 1; return mix({ done: true });
    },
    lab_teacher_settings_get: function () { needTeacher(); return lab.settings; },
    lab_teacher_settings_set: function (a) {
      needTeacher(); var s = a.p_settings, v = {};
      if (typeof s.pass === "number") v.pass = Math.min(Math.max(s.pass, 50), 100);
      if (typeof s.questions === "number") v.questions = Math.min(Math.max(s.questions, 5), 20);
      if (typeof s.voice === "boolean") v.voice = s.voice;
      if (s.levels) { v.levels = {}; ["nombres", "addition", "soustraction"].forEach(function (k) { if (Array.isArray(s.levels[k])) v.levels[k] = s.levels[k].filter(function (x) { return /^[a-z0-9_-]{1,20}$/.test(x); }); }); }
      lab.settings = v; return v;
    },
    lab_teacher_results: function () {
      needTeacher();
      return [{ student_id: "s1", nickname: "lea", class_id: "c1", class_name: "CP-A", progress: { levels: lab.me.levels, hist: lab.me.hist } },
              { student_id: "s2", nickname: "leo", class_id: "c1", class_name: "CP-A", progress: {} }];
    },
    lab_admin_state: function () { needAdmin(); return { enabled: lab.enabled, access: lab.access, teachers: lab.teachers, students: lab.students }; },
    lab_admin_grant: function (a) {
      needAdmin(); var list = a.p_kind === "teacher" ? lab.teachers : lab.students, x = list.filter(function (t) { return t.id === a.p_subject; })[0];
      if (!x) throw { message: "Compte introuvable" };
      lab.access = lab.access.filter(function (r) { return !(r.kind === a.p_kind && r.subject_id === a.p_subject); });
      lab.access.push({ id: "g" + lab.access.length + Date.now(), kind: a.p_kind, subject_id: a.p_subject, scope: a.p_scope || "self", note: a.p_note || null, label: x.label }); return "id";
    },
    lab_admin_revoke: function (a) { needAdmin(); lab.access = lab.access.filter(function (r) { return r.id !== a.p_id; }); return null; },
    lab_admin_set_enabled: function (a) { needAdmin(); lab.enabled = !!a.p_enabled; return null; }
  };
  var user = role === "out" ? null : { id: "t1", email: "enseignant@test.invalid" };
  window.supabase = { createClient: function () { return {
    rpc: function (name, args) {
      lab.calls.push(name);
      return new Promise(function (res) { setTimeout(function () {
        try { if (!api[name]) throw { message: "fonction inconnue : " + name }; res({ data: api[name](args), error: null }); } catch (e) { res({ data: null, error: e }); }
      }, 15); });
    },
    auth: { getUser: function () { return Promise.resolve({ data: { user: user }, error: null }); }, getSession: function () { return Promise.resolve({ data: { session: user ? { user: user } : null } }); },
            onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; } }
  }; } };
  if (who !== "none") sessionStorage.setItem("zoo_student_token", "a".repeat(64)); else sessionStorage.removeItem("zoo_student_token");
})();
