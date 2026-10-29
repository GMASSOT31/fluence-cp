/* Faux client Supabase : reproduit les règles de student_submit_score / student_get_class_records */
(function () {
  var MODES = { memory: "min", order: "min", safari: "min", catch: "max", count: "max", flap: "max", simon: "max", stack: "max", tiles: "max", snake: "max" };
  var srv = window.__srv = {
    offline: false, calls: [], pending: 10,
    version: 0,
    me: { id: "s-moi", nickname: "Moi", progress: { coins: 13, credits: 20, results: /lirecartes/.test(location.search) ? [{id:"r1",sid:"s-moi",sound:"voy",k:"s",mclm:60,ts:1,src:"eval"},{id:"r2",sid:"s-moi",sound:"l",k:"s",mclm:60,ts:2,src:"eval"},{id:"r3",sid:"s-moi",sound:"l",k:"m",mclm:60,ts:3,src:"train"},{id:"r4",sid:"s-moi",sound:"l",k:"t",mclm:60,ts:4,src:"train"},{id:"r5",sid:"s-moi",sound:"f",k:"s",mclm:60,ts:5,src:"train"}].concat(/fraude=1/.test(location.search) ? [{id:"r6",sid:"s-moi",sound:"f",k:"s",mclm:999,ts:6,src:"eval"}] : []) : (/entrainements=1/.test(location.search) ? [{id:"t1",sid:"s-moi",sound:"voy",k:"s",mclm:60,ts:1,src:"train"},{id:"t2",sid:"s-moi",sound:"voy",k:"m",mclm:60,ts:2,src:"train"},{id:"t3",sid:"s-moi",sound:"voy",k:"t",mclm:60,ts:3,src:"train"}].concat(/[?&]eval=(\w+)/.test(location.search) ? [{id:"e1",sid:"s-moi",sound:RegExp.$1,k:"s",mclm:60,ts:4,src:"eval"}] : []) : []), hi: {}, avatar: "🦊", vouchers: [{ id: "v1", sid: "s-moi", label: "Image surprise", icon: "🖼️", price: 5, done: false }, { id: "v2", sid: "s-moi", label: "Crayon magique", icon: "✏️", price: 8, done: false }] }, given: [] },
    others: [{ id: "s-lea", nickname: "Léa", avatar: "🐼", hi: { memory: { best: 14, bts: 1 }, catch: { best: 9, bts: 1 } } }]
  };
  function all() { return [{ id: srv.me.id, nickname: srv.me.nickname, avatar: srv.me.progress.avatar, hi: srv.me.progress.hi || {} }].concat(srv.others); }
  function best(game) {
    var m = MODES[game], b = null;
    all().forEach(function (s) {
      var h = s.hi[game]; if (!h || typeof h.best !== "number") return;
      if (m === "max" && h.best <= 0) return;
      if (!b || (m === "min" ? h.best < b.value : h.best > b.value) || (h.best === b.value && (h.bts || 0) < b.ts)) b = { value: h.best, nickname: s.nickname, avatar: s.avatar, mine: s.id === srv.me.id, ts: h.bts || 0 };
    });
    return b;
  }
  var api = {
    lab_my_access: function () { return { allowed: /[?&]labo=1/.test(location.search), role: "student" }; },
    student_get_progress_v2: function () { return { progress: JSON.parse(JSON.stringify(srv.me.progress)), version: srv.version }; },
    student_session_profile: function () { return { student_id: srv.me.id, nickname: srv.me.nickname }; },
    student_change_pin: function (a) {
      srv.pinCalls = (srv.pinCalls || []).concat([{ old: a.p_old_pin, neu: a.p_new_pin }]);
      if (srv.pinOff) throw { message: "Ton maître(sse) a désactivé ce changement." };
      if (!/^[0-9]{4,8}$/.test(a.p_new_pin || "")) throw { message: "Le code doit avoir de 4 à 8 chiffres." };
      if (a.p_old_pin === a.p_new_pin) throw { message: "Le nouveau code doit être différent de l'ancien." };
      srv.pin = srv.pin || "1234";
      if (srv.pinFails >= 5) return { ok: false, code: "locked" };
      if (a.p_old_pin !== srv.pin) { srv.pinFails = (srv.pinFails || 0) + 1; return { ok: false, code: "bad_old" }; }
      srv.pin = a.p_new_pin; srv.pinFails = 0; return { ok: true };
    },
    student_get_teacher_settings: function () { return { pinChange: !/sanspin/.test(location.search), reward: true, maxPlays: /illimite/.test(location.search) ? 0 : 50, wheelPrice: /prix4/.test(location.search) ? 4 : 7, evalCode: !/sanscode/.test(location.search) }; },
    student_get_class_records: function () {
      var r = {}; Object.keys(MODES).forEach(function (g) { var b = best(g); if (b) { delete b.ts; r[g] = b; } });
      return { classSize: all().length, records: all().length < 2 ? {} : r };
    },
    student_save_progress_v2: function (a) {
      if (a.p_version !== srv.version) throw { message: "SYNC_CONFLICT" };
      srv.me.progress = JSON.parse(JSON.stringify(a.p_progress)); return ++srv.version;
    },
    verify_evaluation_code: function (a) {
      srv.evalCodes = (srv.evalCodes || []).concat([a.p_code]);
      srv.fails = srv.fails || 0;
      if (srv.fails >= 5) throw { message: "Trop d'essais. Attends 10 minutes avant de réessayer." };
      if (a.p_code === "Secret-Test-42") { srv.fails = 0; return true; }
      srv.fails++; return false;
    },
    student_claim_vouchers: function (a) {
      if (!srv.me.given.length) return { claimed: 0, version: srv.version };
      if (a.p_version !== srv.version) throw { message: "SYNC_CONFLICT" };
      var ids = srv.me.given.slice(); srv.me.given = [];
      (srv.me.progress.vouchers || []).forEach(function (v) { if (ids.indexOf(v.id) >= 0) v.done = true; });
      srv.version++; return { claimed: ids.length, ids: ids, version: srv.version };
    },
    student_claim_coins: function (a) {
      if (!srv.pending) return { claimed: 0, version: srv.version };
      if (a.p_version !== srv.version) throw { message: "SYNC_CONFLICT" };
      var n = srv.pending; srv.pending = 0; srv.me.progress.coins = (srv.me.progress.coins || 0) + n; srv.version++;
      return { claimed: n, coins: srv.me.progress.coins, version: srv.version };
    },
    student_claim_credits: function () { return { claimed: 0, version: srv.version }; },
    student_submit_score: function (a) {
      if (a.p_version !== srv.version) throw { message: "SYNC_CONFLICT" };
      var m = MODES[a.p_game]; if (!m) throw { message: "Jeu inconnu" };
      var p = srv.me.progress, hi = p.hi || (p.hi = {}), old = hi[a.p_game] || {}, prev = typeof old.best === "number" ? old.best : null, v = a.p_value;
      var better = prev === null ? (m === "min" || v > 0) : (m === "min" ? v < prev : v > prev);
      var abs = null, absolute = false;
      if (better && all().length >= 2) { abs = best(a.p_game); absolute = !!abs && (m === "min" ? v < abs.value : v > abs.value); }
      var gain = (absolute && !abs.mine) ? 10 : (better && prev !== null) ? 3 : 0;
      var entry = { best: better ? v : prev, last: v, n: (old.n || 0) + 1, bts: better ? Date.now() : old.bts };
      hi[a.p_game] = entry; p.coins = (p.coins || 0) + gain; srv.version++;
      return { record: better, first: better && prev === null, prev: prev, absolute: absolute, gain: gain, coins: p.coins, entry: entry, version: srv.version,
        prevAbs: absolute ? { value: abs.value, nickname: abs.nickname, avatar: abs.avatar, mine: abs.mine } : null };
    }
  };
  window.supabase = { createClient: function () { return { rpc: function (name, args) {
    srv.calls.push(name);
    return new Promise(function (res) { setTimeout(function () {
      if (srv.offline) return res({ data: null, error: { message: "Failed to fetch" } });
      try { res({ data: api[name](args), error: null }); } catch (e) { res({ data: null, error: e }); }
    }, 20); });
  } }; } };
  sessionStorage.setItem("zoo_student_token", "faux-jeton-de-test");
})();
