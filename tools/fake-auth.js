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
    progress: { s1: { student_id: "s1", progress: { coins: 3, dictee: { passes: { voy: 1, l: 1 }, done: { voy: true, l: true }, tries: 4 }, hi: { memory: { best: 12 }, catch: { best: 9 }, simon: { best: 5 }, order: { best: 20 } }, results: [{ src: "eval", mclm: 285, ts: 5, k: "s", sound: "l" }, { src: "eval", mclm: 200, ts: 4, k: "s", sound: "l" }, { src: "train", ts: 3 }, { src: "train", ts: 2 }, { src: "train", ts: 1 }], reviews: [], vouchers: [{ id: "v1", label: "Image surprise", icon: "🖼️", done: false }, { id: "v2", label: "Crayon magique", icon: "✏️", done: false }] }, updated_at: "2026-10-20T10:00:00Z", pending_coins: 0, given_vouchers: [] } }, gifts: []
  };
  /* ?vide=1 : nouvel enseignant sans classe ni élève (Ma classe propose de créer sa classe) */
  if (/[?&]vide=1/.test(location.search)) { st.classes = (st.classes || []).filter(function (c) { return c.teacher_id !== "t1"; }); st.students = st.students.filter(function (x) { return x.teacher_id !== "t1"; }); }
  /* ?imagiers=1 : trois imagiers ; le 2e est déjà dans la file de la classe cpE (repères « Nouveau » / « Déjà attribué ») */
  if (/[?&]imagiers=1/.test(location.search)) {
    var W = ["chat", "lune", "vélo", "pomme", "robe", "moto"];
    st.corpora = [1, 2, 3].map(function (n) { return { id: "20000000-0000-0000-0000-00000000000" + n, title: "Imagier " + n, words: W.slice() }; });
    st.vocabQueue = new Set(["c1:20000000-0000-0000-0000-000000000002"]);
  }
  /* ?pedago=1 : une classe de 12 élèves avec des mesures (tableau de bord Pédagogie) */
  if (/[?&]pedago=1/.test(location.search)) (function () {
    var order = ["voy", "voy2", "l", "f", "ch", "s", "m", "r", "n", "v", "j", "z", "p", "t", "c", "b", "d"];
    var now = Date.now(), DAY = 864e5;
    function key(ts) { var d = new Date(ts); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
    var kids = [["Lucas", 3, 1, { f: [[6, 9]] }, { "b|d": 5, "d|b": 2 }, 18], ["Inaya", 6, 0, { m: [[8, 7]] }, { "on|an": 3, "b|d": 2 }, 32], ["Amine", 6, 1, { m: [[5, 6]] }, { "b|d": 3 }, 25],
      ["Mostafa", 6, 0, null, { "ou|on": 2 }, 28], ["Alya", 10, 0, null, {}, 29], ["Karim", 4, 12, null, {}, 0], ["Teninke", 7, 2, null, { "d|b": 4 }, 20], ["Andrei", 7, 0, null, { "b|d": 2, "f|v": 3 }, 35],
      ["Jade", 7, 1, null, {}, 26], ["Noah", 7, 0, null, { "f|v": 2 }, 30], ["Lina", 8, 3, null, {}, 22], ["Sacha", 11, 0, null, {}, 40]];
    st.students = st.students.concat(kids.map(function (k, i) { return { id: "p" + i, nickname: k[0], class_id: "c1", teacher_id: "t1", pin_hash: "x" }; }));
    kids.forEach(function (k, i) {
      var res = [], days = {}, snd = {}, lis = {}, dic = {};
      order.slice(0, Math.min(order.length, k[1] + 2)).forEach(function (o) { lis[o] = true; });
      order.slice(0, Math.max(0, k[1] - (i % 3))).forEach(function (o) { dic[o] = true; });
      for (var j = 0; j < k[1]; j++) res.push({ id: "r" + i + j, sound: order[j], k: "s", src: "eval", mclm: 30 + j * 3, ts: now - (k[2] + 3 + (k[1] - j)) * DAY });
      if (k[5]) res.push({ id: "f" + i, sound: order[k[1]], k: "s", src: "train", mclm: k[5], ts: now - k[2] * DAY });
      if (k[3]) Object.keys(k[3]).forEach(function (s2) { snd[s2] = { l: k[3][s2][0], w: [2, 3] }; });
      if (k[2] < 7) for (var d = k[2]; d < 7; d += 2) days[key(now - d * DAY)] = [300 + i * 60, 2, 1, 1, 2];
      st.progress["p" + i] = { student_id: "p" + i, updated_at: new Date(now - k[2] * DAY).toISOString(), pending_coins: 0, progress: { results: res, reviews: i === 1 ? [{ id: "rv1", sid: "p1", sound: order[k[1]], kind: "s", ts: now - DAY, secs: 60, tab: 3, auto: /[?&]aide=1/.test(location.search) ? { v: 1, end: 31, errs: [], n: 32, c: 32, mclm: 32, at: now - DAY } : undefined }] : [], listen: { done: lis }, dictee: { done: dic }, stats: { snd: snd, conf: k[4], days: days } } };
    });
    /* remédiation : Lucas a réussi « Tuiles b / d », Inaya a un exercice d’écoute pas encore fait */
    var T = now - 3 * DAY;
    st.progress.p0.progress.remed = { ts: T, done: { tiles: 1 }, ok: now - DAY, tries: 2, hist: [{ type: "tiles", pair: ["b", "d"], ts: T, ok: now - DAY, tries: 2 }] };
    if (!st.zooSettings) st.zooSettings = { settings: { assign: { p0: { type: "tiles", pair: ["b", "d"], ts: T }, p1: { type: "listen", sons: ["m"], ts: now - DAY } } } };
    /* ?gs=1 : Alya (p4) est en parcours GS en lecture, avec une étape validée, une série réussie et l'aide en cours */
    if (/[?&]gs=1/.test(location.search)) {
      st.zooSettings.settings.tracks = { p4: { lecture: "gs" } };
      st.progress.p4.progress.gs = { lecture: { cap: { i: 1, ok: 0, ko: 2, aid: true, val: { "prenom-2": now - 2 * DAY } } },
        series: [{ id: "a1", c: "cap", k: "prenom-2", q: 10, g: 9, th: 80, aid: false, ts: now - 3 * DAY, ok: true }, { id: "a2", c: "cap", k: "prenom-2", q: 10, g: 10, th: 80, aid: false, ts: now - 2 * DAY, ok: true },
          { id: "a3", c: "cap", k: "prenom-3", q: 10, g: 6, th: 80, aid: false, ts: now - DAY, ok: false }, { id: "a4", c: "cap", k: "prenom-3", q: 10, g: 5, th: 80, aid: false, ts: now - DAY + 600000, ok: false }], rw: ["a1", "a2"] };
    }
  })();
  function fixCode(v, isUpdate, old) {
    var c = v == null ? null : norm(v); if (c === "") c = null;
    if (c === null) return isUpdate ? old : "AB12CD34EF";
    if (!/^[A-Z0-9]{3,20}$/.test(c)) throw { code: "22023", message: "Le code de classe doit faire de 3 à 20 lettres ou chiffres." };
    if (st.classes.some(function (k) { return k.access_code === c; })) throw { code: "23505", message: 'duplicate key value violates unique constraint "classes_access_code_key"' };
    return c;
  }
  function q(table) {
    var op = "select", payload = null, filt = null, single = false, isNull = null;
    var b = {
      select: function () { return b; }, order: function () { return b; }, eq: function (k, v) { filt = [k, v]; return b; },
      single: function () { single = true; return b; }, maybeSingle: function () { single = true; return b; }, limit: function () { return b; }, is: function (k) { isNull = k; return b; }, in: function () { return b; }, upsert: function (p) { st.upserts = (st.upserts || []).concat([p]); if (st.failUpsert) { st.failUpsert = false; op = "fail"; } return b; },
      insert: function (p) { op = "insert"; payload = p; return b; }, delete: function () { op = "delete"; return b; }, update: function (p) { op = "update"; payload = p; return b; }, upsert: function (p) { op = "upsert"; payload = p; return b; },
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
          else if (table === "contact_messages") {
            st.contact = st.contact || [{ id: "c1", email: "collegue@ecole.fr", message: "Bonjour, comment avoir ma classe entière ?", created_at: "2026-10-23T09:00:00Z", read_at: null }];
            if (op === "delete") { var g = st.contact.filter(function (x) { return x[filt[0]] === filt[1]; }); st.contact = st.contact.filter(function (x) { return x[filt[0]] !== filt[1]; }); out = { data: g, error: null }; }
            else if (op === "update") { st.contact.forEach(function (x) { if (filt && x[filt[0]] === filt[1]) Object.assign(x, payload); }); out = { data: null, error: null }; }
            else out = { data: st.contact.slice(), error: null };
          }
          else if (table === "teachers") {
            if (op === "update") { var tr = st.teachers.filter(function (x) { return x[filt[0]] === filt[1]; })[0]; Object.assign(tr, payload); st.teacherUpdates = (st.teacherUpdates || []).concat([payload]); out = { data: null, error: null }; }
            else if (single) out = { data: Object.assign({}, st.teachers.filter(function (x) { return x[filt[0]] === filt[1]; })[0]), error: null };
            else out = { data: st.teachers.map(function (x) { return Object.assign({}, x); }), error: null };
          }
          else if (table === "app_settings") {
            st.appSettings = st.appSettings || { auto_seats: { enabled: true, max: 25 } };
            if (op === "upsert" || op === "update") { var pl = Array.isArray(payload) ? payload[0] : payload; st.appSettings[pl.key || "auto_seats"] = pl.value; out = { data: null, error: null }; }
            else out = { data: single ? { key: "auto_seats", value: st.appSettings.auto_seats } : [{ key: "auto_seats", value: st.appSettings.auto_seats }], error: null };
          }
          else if (table === "teacher_zoo_settings") {   // réglages de l'enseignant : l'upsert est gardé dans window.__auth.zooSettings (relu au rechargement de la page dans le même test)
            if (op === "upsert") { st.zooSettings = payload; out = { data: null, error: null }; }
            else out = { data: single ? (st.zooSettings ? { settings: st.zooSettings.settings } : null) : (st.zooSettings ? [{ settings: st.zooSettings.settings }] : []), error: null };
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
      getUser: function () { return Promise.resolve({ data: { user: /out/.test(location.search) && !st.signedIn ? null : st.user }, error: null }); },
      onAuthStateChange: function (f) { st.listeners.push(f); return { data: { subscription: { unsubscribe: function () {} } } }; },
      updateUser: function () { return Promise.resolve({ error: null }); }, resetPasswordForEmail: function () { return Promise.resolve({ error: null }); },
      signInWithPassword: function () { if (/badpw/.test(location.search)) return Promise.resolve({ error: { code: "invalid_credentials", message: "Invalid login credentials" } }); st.signedIn = true; return Promise.resolve({ error: null }); }, signOut: function () { return Promise.resolve({}); }, signUp: function () { return Promise.resolve({ data: {} }); }, resend: function () { return Promise.resolve({ error: null }); }
    },
    from: q,
    /* « Mes sons » : faux rangement des enregistrements (st.voiceFiles = {fichier: Blob}) */
    storage: { from: function (bucket) { return {
      upload: function (path, blob) { st.voiceFiles = st.voiceFiles || {}; if (st.voiceFiles[path]) return Promise.resolve({ data: null, error: { message: "Le fichier existe déjà" } }); if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "new row violates row-level security policy" } }); st.voiceFiles[path] = blob; return Promise.resolve({ data: { path: path }, error: null }); },
      remove: function (paths) { (paths || []).forEach(function (x) { if (st.voiceFiles) delete st.voiceFiles[x]; }); st.voiceRemoved = (st.voiceRemoved || []).concat(paths); return Promise.resolve({ data: paths, error: null }); },
      getPublicUrl: function (path) { var b = st.voiceFiles && st.voiceFiles[path]; return { data: { publicUrl: b ? URL.createObjectURL(b) : "https://example.invalid/storage/v1/object/public/" + bucket + "/" + path } }; }
    }; } },
    rpc: function (name, a) {
      if (name === "get_vocabulary_corpora") return Promise.resolve({ data: st.corpora || [], error: null });
      if (name === "admin_create_vocabulary_corpus") {
        if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "Accès refusé" } });
        st.corpora = (st.corpora || []).concat([{ id: a.p_id, title: a.p_title, words: a.p_words.map(function (card) { return card.label; }) }]);
        return Promise.resolve({ data: a.p_id, error: null });
      }
      if (name === "admin_update_vocabulary_corpus") {
        if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "Accès refusé" } });
        var book = (st.corpora || []).find(function (entry) { return entry.id === a.p_id; });
        if (!book || (book.revision || 0) !== a.p_revision) return Promise.resolve({ data: null, error: { message: "Rechargez la page avant de réessayer." } });
        book.title = a.p_title;
        book.words = a.p_words.slice();
        book.images = Object.assign({}, book.images, a.p_images);
        book.revision = a.p_revision + 1;
        return Promise.resolve({ data: book, error: null });
      }
      if (name === "teacher_class_vocabulary") {
        var prefix = a.p_class + ":";
        return Promise.resolve({data: Array.from(st.vocabQueue || []).filter(function (key) { return key.indexOf(prefix) === 0; }).map(function (key) { return key.slice(prefix.length); }), error: null});
      }
      if (name === "teacher_remove_class_vocabulary") {
        var owner = st.classes.find(function (item) { return item.id === a.p_class; });
        if (!owner || (owner.teacher_id !== st.user.id && st.teachers[0].role !== "admin")) return Promise.resolve({data:null,error:{message:"Accès refusé"}});
        var assignment = a.p_class + ":" + a.p_corpus;
        if (!st.vocabQueue || !st.vocabQueue.has(assignment)) return Promise.resolve({data:false,error:null});
        st.vocabExclusions = st.vocabExclusions || new Set();
        if (a.p_student) {
          if (!st.students.some(function (s) { return s.id === a.p_student && s.class_id === a.p_class && !s.ghosted_at; })) return Promise.resolve({data:null,error:{message:"Cet élève ne fait pas partie de cette classe"}});
          var exclusion = assignment + ":" + a.p_student;
          if (st.vocabExclusions.has(exclusion)) return Promise.resolve({data:false,error:null});
          st.vocabExclusions.add(exclusion);
        } else {
          st.vocabQueue.delete(assignment);
          st.vocabExclusions.forEach(function (key) { if (key.indexOf(assignment + ":") === 0) st.vocabExclusions.delete(key); });
        }
        return Promise.resolve({data:true,error:null});
      }
      if (name === "teacher_queue_vocabulary") {
        var c = st.classes.find(function (item) { return item.id === a.p_class; });
        if (!c || (c.teacher_id !== st.user.id && st.teachers[0].role !== "admin")) return Promise.resolve({ data: null, error: { message: "Accès refusé" } });
        st.vocabQueue = st.vocabQueue || new Set();
        var key = a.p_class + ":" + a.p_corpus, added = !st.vocabQueue.has(key);
        st.vocabQueue.add(key);
        return Promise.resolve({ data: added, error: null });
      }
      if (name === "get_comprehension_exercises") return Promise.resolve({ data: JSON.parse(JSON.stringify(st.comprehension || {})), error: null });
      if (name === "admin_save_comprehension_exercise") {
        if (st.teachers[0].role !== "admin") return Promise.resolve({ error: { message: "Réservé à l’administrateur" } });
        st.comprehension = st.comprehension || {};
        if (JSON.stringify(st.comprehension[a.p_sound] || []) !== JSON.stringify(a.p_previous)) return Promise.resolve({ error: { message: "Cet exercice a changé ailleurs." } });
        st.comprehension[a.p_sound] = a.p_entries;
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "get_voice_overrides") return Promise.resolve({ data: JSON.parse(JSON.stringify(st.voices || (st.voices = /voix=1/.test(location.search) ? { o: "o-test.wav" } : {}))), error: null });
      if (name === "admin_set_voice") { if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "Réservé à l'administrateur" } }); if (a.p_path != null && !/^[a-z0-9_-]{1,60}\.wav$/.test(a.p_path)) return Promise.resolve({ data: null, error: { message: "Fichier invalide" } }); st.voices = st.voices || {}; if (a.p_path == null) delete st.voices[a.p_clip]; else st.voices[a.p_clip] = a.p_path; return Promise.resolve({ data: JSON.parse(JSON.stringify(st.voices)), error: null }); }
      if (name === "admin_edit_class") { st.editOps = (st.editOps || []).concat([a]); if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "Réservé à l'administrateur" } }); var ke = st.classes.filter(function (x) { return x.id === a.p_class; })[0]; if (!ke) return Promise.resolve({ data: null, error: { message: "Classe introuvable" } }); if (a.p_name != null) { var nn = String(a.p_name).trim(); if (!nn || nn.length > 80) return Promise.resolve({ data: null, error: { code: "22023", message: "Le nom de la classe doit faire entre 1 et 80 caractères." } }); ke.name = nn; } if (a.p_access_code != null) { try { ke.access_code = fixCode(a.p_access_code, true, ke.access_code); } catch (e) { return Promise.resolve({ data: null, error: e }); } } return Promise.resolve({ data: "ok", error: null }); }
      if (name === "manage_class") { st.classOps = (st.classOps || []).concat([a]); var kc = st.classes.filter(function (x) { return x.id === a.p_class; })[0]; if (!kc) return Promise.resolve({ data: null, error: { message: "Classe introuvable" } }); if (a.p_action === "ghost") kc.ghosted_at = "2026-10-21T10:00:00Z"; else if (a.p_action === "unghost") kc.ghosted_at = null; else if (a.p_action === "delete") { st.classes = st.classes.filter(function (x) { return x !== kc; }); st.students = st.students.filter(function (x) { return x.class_id !== kc.id; }); } return Promise.resolve({ data: a.p_action, error: null }); }
      if (name === "set_student_pin") { st.pins = (st.pins || []).concat([a]); var sp = st.students.filter(function (x) { return x.id === a.p_student; })[0]; if (sp) sp.pin_hash = "x"; return Promise.resolve({ data: null, error: null }); }
      if (name === "student_sign_in") { st.signIns.push(a.p_code); var c = norm(a.p_code), ok = st.classes.some(function (k) { return k.access_code === c; }) && a.p_pin === "4321";
        st.fails = st.fails || 0; if (st.fails >= 5) return Promise.resolve({ data: { ok: false, reason: "locked", retry_after: 900 }, error: null });
        if (ok) { st.fails = 0; return Promise.resolve({ data: { ok: true, student_id: "s1", nickname: a.p_nickname }, error: null }); }
        st.fails++; return Promise.resolve({ data: { ok: false, reason: "bad_pin" }, error: null }); }
      if (name === "student_session_profile") return Promise.resolve(a.p_token === "expire" ? { data: null, error: { message: "Session expirée" } } : { data: { student_id: "s1", nickname: "lea" }, error: null });
      if (name === "admin_set_class_pedagogy") {
        if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "Accès refusé" } });
        st.classPedagogy = st.classPedagogy || {};
        var classKey = a.p_class + ":" + a.p_subject;
        if (a.p_apply) st.classPedagogy[classKey] = true;
        else delete st.classPedagogy[classKey];
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "get_exo_defaults") return Promise.resolve({ data: (st.appSettings && st.appSettings.exo_defaults) || (/exodefaut=1/.test(location.search) ? { texts: { "s:l": "la li lo lu" }, dictee: { syl: 3, words: 1, items: { l: { syl: ["la", "lo"], words: [] } } }, listenCfg: { questions: 5, items: { l: { syl: ["la", "lu"], words: [] } } }, sounds: [{ id: "l", label: "l" }, { id: "f", label: "f" }, { id: "ou", label: "ou" }] } : {}), error: null });
      if (name === "get_dictee_defaults") return Promise.resolve({ data: (st.appSettings && st.appSettings.dictee_defaults) || (/dicteedefaut=1/.test(location.search) ? { syl: 3, words: 1, items: { l: { syl: ["la", "lo"], words: [] } } } : {}), error: null });
      if (name === "teacher_give_voucher") { var pr = st.progress[a.p_student]; if (!pr) return Promise.resolve({ data: null, error: { message: "Élève introuvable" } }); if (pr.given_vouchers.indexOf(a.p_voucher) < 0) pr.given_vouchers.push(a.p_voucher); return Promise.resolve({ data: pr.given_vouchers.length, error: null }); }
      if (name === "teacher_adjust_level") { st.levelOps = (st.levelOps || []).concat([a]);
        var sl = st.students.filter(function (x) { return x.id === a.p_student; })[0];
        if (!sl || sl.teacher_id !== st.user.id) return Promise.resolve({ data: null, error: { message: "Cet élève n'est pas dans tes classes" } });
        var rl = st.progress[a.p_student] || (st.progress[a.p_student] = { student_id: a.p_student, progress: {}, updated_at: "2026-10-20T11:00:00Z", pending_coins: 0 });
        rl.progress.results = rl.progress.results || [];
        a.p_steps.forEach(function (e) { if (e.k === "l") { var LL = rl.progress.listen = rl.progress.listen || { passes: {}, done: {}, tries: 0 }; if (e.on) LL.done[e.sound] = true; else { delete LL.done[e.sound]; LL.passes[e.sound] = 0; } return; } if (e.on) rl.progress.results.push({ id: "adj" + rl.progress.results.length, sid: a.p_student, sound: e.sound, k: e.k, n: 0, e: 0, t: 0, mclm: e.mclm, ts: Date.now(), src: "adj", adj: true }); else rl.progress.results.forEach(function (r) { if (r.sound === e.sound && r.k === e.k && r.src !== "train") r.void = true; }); });
        return Promise.resolve({ data: a.p_steps.length, error: null }); }
      if (name === "teacher_give_credits") {
        var recipient = st.students.find(function (x) { return x.id === a.p_student && (x.teacher_id === st.user.id || st.teachers[0].role === "admin") && !x.ghosted_at; });
        if (!recipient || !Number.isInteger(a.p_amount) || a.p_amount < 1 || a.p_amount > 20) return Promise.resolve({ data: null, error: { message: "Don invalide" } });
        var progress = st.progress[recipient.id] || (st.progress[recipient.id] = { student_id: recipient.id, progress: {}, updated_at: "2026-10-20T11:00:00Z" });
        var pending = (progress.pending_credits || 0) + a.p_amount;
        if (pending > 1000) return Promise.resolve({ data: null, error: { message: "Trop de parties en attente" } });
        progress.pending_credits = pending;
        return Promise.resolve({ data: pending, error: null });
      }
      if (name === "teacher_give_coins") { st.gifts.push(a);
        var stu = st.students.filter(function (x) { return x.id === a.p_student; })[0];
        if (!stu || (stu.teacher_id !== st.user.id && st.teachers[0].role !== "admin")) return Promise.resolve({ data: null, error: { message: "Cet élève n'est pas dans tes classes" } });
        var row = st.progress[a.p_student] || (st.progress[a.p_student] = { student_id: a.p_student, progress: {}, updated_at: "2026-10-20T11:00:00Z", pending_coins: 0 });
        row.pending_coins = (row.pending_coins || 0) + a.p_amount; return Promise.resolve({ data: row.pending_coins, error: null }); }
      if (name === "manage_student") { st.manage = (st.manage || []).concat([a]);
        var s0 = st.students.filter(function (x) { return x.id === a.p_student; })[0];
        if (!s0) return Promise.resolve({ data: null, error: { message: "Élève introuvable" } });
        if (a.p_action === "ghost") s0.ghosted_at = "2026-10-21T09:00:00Z"; else if (a.p_action === "unghost") s0.ghosted_at = null; else if (a.p_action === "delete") st.students = st.students.filter(function (x) { return x !== s0; });
        return Promise.resolve({ data: a.p_action, error: null }); }
      if (name === "rename_student") { st.renamed = (st.renamed || []).concat([a]);
        var s1 = st.students.filter(function (x) { return x.id === a.p_student; })[0], nm = String(a.p_nickname || "").trim();
        if (!s1) return Promise.resolve({ data: null, error: { message: "Élève introuvable" } });
        if (!nm || nm.length > 60) return Promise.resolve({ data: null, error: { message: "Le prénom doit faire de 1 à 60 caractères" } });
        if (st.students.some(function (x) { return x !== s1 && x.class_id === s1.class_id && x.nickname.toLowerCase() === nm.toLowerCase(); })) return Promise.resolve({ data: null, error: { message: "Un autre élève de cette classe a déjà ce prénom" } });
        s1.nickname = nm; return Promise.resolve({ data: nm, error: null }); }
      /* invitation d'un collègue (?invite=<jeton>&out=1 : page d'inscription ; jeton « dead » / « beef » : lien déjà servi / expiré) */
      if (name === "admin_create_invite") { var tk = "ab12cd34ef56ab12cd34ef56ab12cd34"; st.invites = [{ token: tk, created_at: "2026-11-17T10:00:00Z", expires_at: "2026-12-17T10:00:00Z", used_at: null }].concat(st.invites || []); return Promise.resolve({ data: { token: tk, expires_at: "2026-12-17T10:00:00Z" }, error: null }); }
      if (name === "admin_list_invites") return Promise.resolve({ data: (st.invites || []).concat([{ token: "ff", created_at: "2026-11-10T10:00:00Z", expires_at: "2026-12-10T10:00:00Z", used_at: "2026-11-11T10:00:00Z", used_email: "collegue@test.invalid" }]), error: null });
      if (name === "invite_check") return Promise.resolve({ data: a.p_token === "dead" || a.p_token === "beef" ? { ok: false, reason: a.p_token === "beef" ? "expired" : "used" } : { ok: true }, error: null });
      if (name === "invite_signup") { st.inviteSignups = (st.inviteSignups || []).concat([a]); if (/pris@/.test(a.p_email)) return Promise.resolve({ data: { ok: false, reason: "email_taken" }, error: null });
        st.user = { id: "t9", email: a.p_email.toLowerCase() }; st.teachers.push({ id: "t9", email: st.user.email, student_limit: 15, role: "teacher", seat_request: null, seat_request_at: null, ghosted_at: null }); return Promise.resolve({ data: { ok: true, email: st.user.email }, error: null }); }
      if (name === "admin_move_student") { st.moves = (st.moves || []).concat([a]); if (st.teachers[0].role !== "admin") return Promise.resolve({ data: null, error: { message: "Réservé à l'administrateur" } });
        var sm = st.students.filter(function (x) { return x.id === a.p_student; })[0], km = st.classes.filter(function (x) { return x.id === a.p_class; })[0];
        if (!sm || !km) return Promise.resolve({ data: null, error: { message: "Élève ou classe introuvable" } });
        if (st.students.some(function (x) { return x !== sm && x.class_id === km.id && x.nickname.toLowerCase() === sm.nickname.toLowerCase(); })) return Promise.resolve({ data: null, error: { message: "Un élève de cette classe a déjà ce prénom : renommez-le d'abord" } });
        sm.class_id = km.id; sm.teacher_id = km.teacher_id; return Promise.resolve({ data: { ok: true, class: km.name, access_code: km.access_code }, error: null }); }
      if (name === "admin_manage_teacher") { st.manageT = (st.manageT || []).concat([a]);
        var t0 = st.teachers.filter(function (x) { return x.id === a.p_teacher; })[0];
        if (a.p_action === "ghost") t0.ghosted_at = "2026-10-21T09:00:00Z"; else if (a.p_action === "unghost") t0.ghosted_at = null;
        else if (a.p_action === "delete") { st.teachers = st.teachers.filter(function (x) { return x !== t0; }); st.students = st.students.filter(function (x) { return x.teacher_id !== t0.id; }); st.classes = st.classes.filter(function (x) { return x.teacher_id !== t0.id; }); }
        return Promise.resolve({ data: a.p_action, error: null }); }
      if (name === "feedback_mark_replies_seen") { var nSeen = 0; st.feedback.forEach(function (x) { if (x.teacher_id === st.user.id && x.reply && !x.reply_seen_at) { x.reply_seen_at = "2026-10-21T12:00:00Z"; nSeen++; } }); return Promise.resolve({ data: nSeen, error: null }); }
      if (name === "teacher_request_seats") { var n = a.p_count; if (n && (n < 1 || n > 500)) return Promise.resolve({ data: null, error: { message: "Nombre de places invalide (1 à 500)" } });
        var me = st.teachers.filter(function (x) { return x.id === st.user.id; })[0]; var cfg = (st.appSettings || { auto_seats: { enabled: true, max: 25 } }).auto_seats;
        if (n && cfg.enabled && me.role !== "admin" && me.student_limit > 0 && me.student_limit + n <= cfg.max) { me.student_limit += n; me.seat_request = null; me.seat_request_at = null; return Promise.resolve({ data: { seat_request: null, seat_request_at: null, granted: true, student_limit: me.student_limit }, error: null }); }
        me.seat_request = n || null; me.seat_request_at = n ? "2026-10-21T08:00:00Z" : null;
        return Promise.resolve({ data: { seat_request: me.seat_request, seat_request_at: me.seat_request_at }, error: null }); }
      return Promise.resolve({ data: {}, error: null });
    }
  }; } };
})();
