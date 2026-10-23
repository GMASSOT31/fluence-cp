/* Faux client Supabase (page enseignant + page élève) : reproduit les règles du code de classe, aucun appel réseau */
(function () {
  function norm(v) { return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(); }
  var st = window.__auth = {
    user: { id: "t1", email: "maitresse@test.invalid" },
    classes: [{ id: "c1", name: "cpE", access_code: "D2E0FC0B45", teacher_id: "t1", school_year: null },
              { id: "c2", name: "Autre", access_code: "CPAUTRE", teacher_id: "t2", school_year: null }],
    signIns: [], listeners: [],
    feedback: [{ id: "f1", teacher_id: "t2", kind: "bug", message: "Le bouton Lire ne réagit pas sur ma tablette.\nSamsung Tab A.", created_at: "2026-10-20T15:00:00Z", read_at: null },
               { id: "f2", teacher_id: "t2", kind: "fonction", message: "Pouvoir imprimer les textes.", created_at: "2026-10-19T10:00:00Z", read_at: null },
               { id: "f3", teacher_id: "t1", kind: "avis", message: "Super appli.", created_at: "2026-10-18T10:00:00Z", read_at: "2026-10-18T11:00:00Z", reply: "Merci beaucoup pour ton retour !", replied_at: "2026-10-19T08:00:00Z", reply_seen_at: null }],
    teachers: [{ id: "t1", email: "maitresse@test.invalid", student_limit: 10, role: /teacher/.test(location.search) ? "teacher" : "admin", seat_request: null, seat_request_at: null, ghosted_at: null }, { id: "t2", email: "autre@test.invalid", student_limit: 10, role: "teacher", seat_request: 15, seat_request_at: "2026-10-20T09:00:00Z", ghosted_at: null }],
    students: [{ id: "s1", nickname: "lea", class_id: "c1", teacher_id: "t1", pin_hash: "x" }, { id: "s2", nickname: "leo", class_id: "c1", teacher_id: "t1", pin_hash: "x" }, { id: "s3", nickname: "Zoé", class_id: "c2", teacher_id: "t2", pin_hash: "x" }],
    progress: { s1: { student_id: "s1", progress: { coins: 3, hi: { memory: { best: 12 }, catch: { best: 9 }, simon: { best: 5 }, order: { best: 20 } }, results: [{ src: "eval", mclm: 285, ts: 5, k: "s", sound: "l" }, { src: "eval", mclm: 200, ts: 4, k: "s", sound: "l" }, { src: "train", ts: 3 }, { src: "train", ts: 2 }, { src: "train", ts: 1 }], reviews: [], vouchers: [{ id: "v1", label: "Image surprise", icon: "🖼️", done: false }, { id: "v2", label: "Crayon magique", icon: "✏️", done: false }] }, updated_at: "2026-10-20T10:00:00Z", pending_coins: 0, given_vouchers: [] } }, gifts: []
  };
  function fixCode(v, isUpdate, old) {
    var c = v == null ? null : norm(v); if (c === "") c = null;
    if (c === null) return isUpdate ? old : "AB12CD34EF";
    if (!/^[A-Z0-9]{4,20}$/.test(c)) throw { code: "22023", message: "Le code de classe doit faire de 4 à 20 lettres ou chiffres." };
    if (st.classes.some(function (k) { return k.access_code === c; })) throw { code: "23505", message: 'duplicate key value violates unique constraint "classes_access_code_key"' };
    return c;
  }
  function q(table) {
    var op = "select", payload = null, filt = null, single = false, isNull = null;
    var b = {
      select: function () { return b; }, order: function () { return b; }, eq: function (k, v) { filt = [k, v]; return b; },
      single: function () { single = true; return b; }, maybeSingle: function () { single = true; return b; }, limit: function () { return b; }, is: function (k) { isNull = k; return b; }, in: function () { return b; }, upsert: function (p) { st.upserts = (st.upserts || []).concat([p]); if (st.failUpsert) { st.failUpsert = false; op = "fail"; } return b; },
      insert: function (p) { op = "insert"; payload = p; return b; }, delete: function () { op = "delete"; return b; }, update: function (p) { op = "update"; payload = p; return b; },
      then: function (res, rej) {
        var out;
        try {
          if (op === "fail") out = { data: null, error: { message: "Failed to fetch" } };
          else if (table === "teacher_feedback") {
            if (op === "insert") { if (/fail/.test(location.search)) throw { message: "Erreur réseau" }; st.feedback.unshift(Object.assign({ id: "f" + (st.feedback.length + 10), created_at: "2026-10-21T10:00:00Z", read_at: null }, payload)); out = { data: null, error: null }; }
            else if (op === "delete") { var gone = st.feedback.filter(function (x) { return x[filt[0]] === filt[1]; }); st.feedback = st.feedback.filter(function (x) { return gone.indexOf(x) < 0; }); out = { data: gone.map(function (x) { return { id: x.id }; }), error: null }; }
            else if (op === "update") { st.feedback.forEach(function (x) { if ((filt && x[filt[0]] === filt[1]) || (isNull && x[isNull] === null)) Object.assign(x, payload); }); out = { data: null, error: null }; }
            else { var rows = st.feedback.filter(function (x) { return !filt || x[filt[0]] === filt[1]; }).map(function (x) { var tt = st.teachers.filter(function (y) { return y.id === x.teacher_id; })[0]; return Object.assign({ teachers: tt ? { email: tt.email } : null }, x); }); out = { data: rows, error: null }; }
          }
          else if (table === "teachers") {
            if (op === "update") { var tr = st.teachers.filter(function (x) { return x[filt[0]] === filt[1]; })[0]; Object.assign(tr, payload); st.teacherUpdates = (st.teacherUpdates || []).concat([payload]); out = { data: null, error: null }; }
            else if (single) out = { data: Object.assign({}, st.teachers.filter(function (x) { return x[filt[0]] === filt[1]; })[0]), error: null };
            else out = { data: st.teachers.map(function (x) { return Object.assign({}, x); }), error: null };
          }
          else if (table === "students" && op === "insert") { var srow = Object.assign({ id: "n" + (st.students.length + 1), pin_hash: null }, payload); st.students.push(srow); out = { data: single ? { id: srow.id } : [srow], error: null }; }
          else if (table === "students") out = { data: (st.teachers[0].role === "admin" ? st.students : st.students.filter(function (x) { return x.teacher_id === st.user.id; })).map(function (x) { return Object.assign({ ghosted_at: null }, x); }), error: null };
          else if (table === "student_progress") out = { data: Object.keys(st.progress).map(function (k) { return st.progress[k]; }), error: null };
          else if (table !== "classes") out = { data: single ? null : [], error: null };
          else if (op === "insert") { var row = Object.assign({ id: "c" + (st.classes.length + 1), school_year: null }, payload); row.access_code = fixCode(payload.access_code, false); st.classes.push(row); out = { data: single ? row : [row], error: null }; }
          else if (op === "update" && payload.name !== undefined) { var kn = st.classes.filter(function (x) { return x[filt[0]] === filt[1]; })[0]; kn.name = payload.name; out = { data: single ? { id: kn.id } : [kn], error: null }; }
          else if (op === "update") { var k = st.classes.filter(function (x) { return x[filt[0]] === filt[1]; })[0]; var nc = fixCode(payload.access_code, true, k.access_code); if (nc === k.access_code) { } k.access_code = nc; out = { data: single ? k : [k], error: null }; }
          else out = { data: st.classes.slice(), error: null };
        } catch (e) { out = { data: null, error: e }; }
        return Promise.resolve(out).then(res, rej);
      }
    };
    return b;
  }
  window.supabase = { createClient: function () { return {
    auth: {
      getUser: function () { return Promise.resolve({ data: { user: /out/.test(location.search) ? null : st.user }, error: null }); },
      onAuthStateChange: function (f) { st.listeners.push(f); return { data: { subscription: { unsubscribe: function () {} } } }; },
      updateUser: function () { return Promise.resolve({ error: null }); }, resetPasswordForEmail: function () { return Promise.resolve({ error: null }); },
      signInWithPassword: function () { return Promise.resolve({ error: null }); }, signOut: function () { return Promise.resolve({}); }, signUp: function () { return Promise.resolve({ data: {} }); }, resend: function () { return Promise.resolve({ error: null }); }
    },
    from: q,
    rpc: function (name, a) {
      if (name === "admin_edit_class") { st.editOps = (st.editOps || []).concat([a]); if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "Réservé à l'administrateur" } }); var ke = st.classes.filter(function (x) { return x.id === a.p_class; })[0]; if (!ke) return Promise.resolve({ data: null, error: { message: "Classe introuvable" } }); if (a.p_name != null) { var nn = String(a.p_name).trim(); if (!nn || nn.length > 80) return Promise.resolve({ data: null, error: { code: "22023", message: "Le nom de la classe doit faire entre 1 et 80 caractères." } }); ke.name = nn; } if (a.p_access_code != null) { try { ke.access_code = fixCode(a.p_access_code, true, ke.access_code); } catch (e) { return Promise.resolve({ data: null, error: e }); } } return Promise.resolve({ data: "ok", error: null }); }
      if (name === "manage_class") { st.classOps = (st.classOps || []).concat([a]); var kc = st.classes.filter(function (x) { return x.id === a.p_class; })[0]; if (!kc) return Promise.resolve({ data: null, error: { message: "Classe introuvable" } }); if (a.p_action === "ghost") kc.ghosted_at = "2026-10-21T10:00:00Z"; else if (a.p_action === "unghost") kc.ghosted_at = null; else if (a.p_action === "delete") { st.classes = st.classes.filter(function (x) { return x !== kc; }); st.students = st.students.filter(function (x) { return x.class_id !== kc.id; }); } return Promise.resolve({ data: a.p_action, error: null }); }
      if (name === "set_student_pin") { st.pins = (st.pins || []).concat([a]); var sp = st.students.filter(function (x) { return x.id === a.p_student; })[0]; if (sp) sp.pin_hash = "x"; return Promise.resolve({ data: null, error: null }); }
      if (name === "student_sign_in") { st.signIns.push(a.p_code); var c = norm(a.p_code), ok = st.classes.some(function (k) { return k.access_code === c; }) && a.p_pin === "4321";
        return Promise.resolve(ok ? { data: { student_id: "s1", nickname: a.p_nickname }, error: null } : { data: null, error: { message: "Identifiants invalides" } }); }
      if (name === "student_session_profile") return Promise.resolve(a.p_token === "expire" ? { data: null, error: { message: "Session expirée" } } : { data: { student_id: "s1", nickname: "lea" }, error: null });
      if (name === "teacher_give_voucher") { var pr = st.progress[a.p_student]; if (!pr) return Promise.resolve({ data: null, error: { message: "Élève introuvable" } }); if (pr.given_vouchers.indexOf(a.p_voucher) < 0) pr.given_vouchers.push(a.p_voucher); return Promise.resolve({ data: pr.given_vouchers.length, error: null }); }
      if (name === "teacher_give_coins") { st.gifts.push(a);
        var stu = st.students.filter(function (x) { return x.id === a.p_student; })[0];
        if (!stu || stu.teacher_id !== st.user.id) return Promise.resolve({ data: null, error: { message: "Cet élève n'est pas dans tes classes" } });
        var row = st.progress[a.p_student] || (st.progress[a.p_student] = { student_id: a.p_student, progress: {}, updated_at: "2026-10-20T11:00:00Z", pending_coins: 0 });
        row.pending_coins += a.p_amount; return Promise.resolve({ data: row.pending_coins, error: null }); }
      if (name === "manage_student") { st.manage = (st.manage || []).concat([a]);
        var s0 = st.students.filter(function (x) { return x.id === a.p_student; })[0];
        if (!s0) return Promise.resolve({ data: null, error: { message: "Élève introuvable" } });
        if (a.p_action === "ghost") s0.ghosted_at = "2026-10-21T09:00:00Z"; else if (a.p_action === "unghost") s0.ghosted_at = null; else if (a.p_action === "delete") st.students = st.students.filter(function (x) { return x !== s0; });
        return Promise.resolve({ data: a.p_action, error: null }); }
      if (name === "admin_manage_teacher") { st.manageT = (st.manageT || []).concat([a]);
        var t0 = st.teachers.filter(function (x) { return x.id === a.p_teacher; })[0];
        if (a.p_action === "ghost") t0.ghosted_at = "2026-10-21T09:00:00Z"; else if (a.p_action === "unghost") t0.ghosted_at = null;
        else if (a.p_action === "delete") { st.teachers = st.teachers.filter(function (x) { return x !== t0; }); st.students = st.students.filter(function (x) { return x.teacher_id !== t0.id; }); st.classes = st.classes.filter(function (x) { return x.teacher_id !== t0.id; }); }
        return Promise.resolve({ data: a.p_action, error: null }); }
      if (name === "feedback_mark_replies_seen") { var nSeen = 0; st.feedback.forEach(function (x) { if (x.teacher_id === st.user.id && x.reply && !x.reply_seen_at) { x.reply_seen_at = "2026-10-21T12:00:00Z"; nSeen++; } }); return Promise.resolve({ data: nSeen, error: null }); }
      if (name === "teacher_request_seats") { var n = a.p_count; if (n && (n < 1 || n > 500)) return Promise.resolve({ data: null, error: { message: "Nombre de places invalide (1 à 500)" } });
        var me = st.teachers.filter(function (x) { return x.id === st.user.id; })[0]; me.seat_request = n || null; me.seat_request_at = n ? "2026-10-21T08:00:00Z" : null;
        return Promise.resolve({ data: { seat_request: me.seat_request, seat_request_at: me.seat_request_at }, error: null }); }
      return Promise.resolve({ data: {}, error: null });
    }
  }; } };
})();
