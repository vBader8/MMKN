/* إدارة التقدم: حفظ محلي + رمز نقل يدوي + مزامنة سحابية عبر Supabase */
(function () {
  var KEY = 'ifce4_progress';
  var listeners = [];

  function blank() {
    return { v: 1, updated: 0, answers: {}, lessons: {}, exams: [], profile: { name: '' } };
  }

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  function normalize(s) {
    var b = blank();
    if (!s || typeof s !== 'object') return b;
    b.updated = +s.updated || 0;
    b.answers = (s.answers && typeof s.answers === 'object') ? s.answers : {};
    b.lessons = (s.lessons && typeof s.lessons === 'object') ? s.lessons : {};
    b.exams = Array.isArray(s.exams) ? s.exams.slice(-50) : [];
    b.profile = (s.profile && typeof s.profile === 'object') ? s.profile : { name: '' };
    return b;
  }

  var state = blank();
  try { state = normalize(JSON.parse(safeGet(KEY) || 'null')); } catch (e) { state = blank(); }

  /* دمج نسختين من التقدم دون فقدان أي بيانات */
  function merge(a, b) {
    a = normalize(a); b = normalize(b);
    var out = blank();
    out.updated = Math.max(a.updated, b.updated);
    var ids = Object.keys(a.answers).concat(Object.keys(b.answers));
    ids.forEach(function (id) {
      var x = a.answers[id] || { c: 0, w: 0, t: 0, l: null };
      var y = b.answers[id] || { c: 0, w: 0, t: 0, l: null };
      var newer = (x.t || 0) >= (y.t || 0) ? x : y;
      out.answers[id] = { c: Math.max(x.c || 0, y.c || 0), w: Math.max(x.w || 0, y.w || 0), t: newer.t || 0, l: newer.l };
    });
    Object.keys(a.lessons).concat(Object.keys(b.lessons)).forEach(function (k) {
      out.lessons[k] = Math.max(a.lessons[k] || 0, b.lessons[k] || 0);
    });
    var seen = {};
    a.exams.concat(b.exams).forEach(function (e) {
      if (e && !seen[e.date]) { seen[e.date] = 1; out.exams.push(e); }
    });
    out.exams.sort(function (p, q) { return p.date - q.date; });
    out.exams = out.exams.slice(-50);
    out.profile = (b.updated > a.updated ? b.profile : a.profile) || { name: '' };
    return out;
  }

  var syncTimer = null;
  function persist(skipCloud) {
    state.updated = Date.now();
    safeSet(KEY, JSON.stringify(state));
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
    if (!skipCloud && (Cloud.user || Cloud.syncKey)) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(Cloud.push, 1500);
    }
  }

  /* ===== Cloud (Supabase via REST) =====
     1) تسجيل الدخول (Google أو رمز عبر البريد) ← جدول progress خاص بكل مستخدم
     2) مفتاح مزامنة شخصي بدون تسجيل ← الدالتان sync_save / sync_load */
  var SK = 'ifce4_session', KK = 'ifce4_synckey';
  function cfg() { return (window.IFCE_CONFIG || {}).supabase || {}; }
  function api(path, opt) {
    opt = opt || {};
    var h = { 'apikey': cfg().key, 'Content-Type': 'application/json' };
    if (opt.auth && Cloud.session) h.Authorization = 'Bearer ' + Cloud.session.access_token;
    for (var k in (opt.headers || {})) h[k] = opt.headers[k];
    return fetch(cfg().url + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .catch(function () { throw new Error('تعذر الاتصال بخدمة المزامنة. تحقق من الإنترنت؛ تقدمك محفوظ على هذا الجهاز.'); })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var m = (j && (j.msg || j.message || j.error_description || j.error)) || ('HTTP ' + r.status); throw new Error(m); }
          return j;
        });
      });
  }
  function saveSession(sess) {
    Cloud.session = sess || null;
    if (sess) { sess.expires_at = sess.expires_at || Math.floor(Date.now() / 1000) + (sess.expires_in || 3600); safeSet(SK, JSON.stringify(sess)); }
    else { try { localStorage.removeItem(SK); } catch (e) {} }
  }
  function fresh() {
    var s = Cloud.session; if (!s) return Promise.resolve(null);
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s);
    return api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
      .then(function (n) { saveSession(n); return n; })
      .catch(function (e) { saveSession(null); Cloud.user = null; throw e; });
  }
  var Cloud = {
    enabled: false, ready: false, user: null, session: null, error: '', status: 'local', syncKey: '',
    init: function () {
      var c = cfg();
      if (!c.url || !c.key) return Promise.resolve(false);
      Cloud.enabled = true;
      Cloud.syncKey = safeGet(KK) || '';
      // نتيجة تسجيل الدخول عبر Google تعود في الرابط: #access_token=...
      var h = location.hash || '';
      if (h.indexOf('access_token=') > -1) {
        var q = {}; h.replace(/^#/, '').split('&').forEach(function (kv) { var a = kv.split('='); q[a[0]] = decodeURIComponent(a[1] || ''); });
        saveSession({ access_token: q.access_token, refresh_token: q.refresh_token, expires_in: +q.expires_in || 3600 });
        try { history.replaceState(null, '', location.pathname + location.search + '#/account'); } catch (e) { location.hash = '#/account'; }
      } else if (h.indexOf('error_description=') > -1) {
        Cloud.error = decodeURIComponent((h.match(/error_description=([^&]*)/) || [])[1] || '').replace(/\+/g, ' ');
        try { history.replaceState(null, '', location.pathname + '#/account'); } catch (e) {}
      } else {
        try { Cloud.session = JSON.parse(safeGet(SK) || 'null'); } catch (e) { Cloud.session = null; }
      }
      Cloud.ready = true;
      var jobs = [];
      if (Cloud.session) jobs.push(fresh().then(function () { return api('/auth/v1/user', { auth: true }); })
        .then(function (u) { Cloud.user = Cloud.mapUser(u); Cloud.status = 'syncing'; notify(); return Cloud.pull(); })
        .catch(function (e) { Cloud.error = 'انتهت الجلسة، سجّل الدخول مجدداً'; saveSession(null); notify(); }));
      if (Cloud.syncKey) jobs.push(Cloud.pullKey());
      notify();
      return Promise.all(jobs).then(function () { return true; });
    },
    mapUser: function (u) {
      var m = (u && u.user_metadata) || {};
      return { uid: u.id, email: u.email || '', displayName: m.full_name || m.name || '', photoURL: m.avatar_url || m.picture || '' };
    },
    signInGoogle: function () {
      var back = location.origin + location.pathname;
      location.href = cfg().url + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(back);
    },
    sendCode: function (email) {
      return api('/auth/v1/otp', { method: 'POST', body: { email: email, create_user: true } });
    },
    verifyCode: function (email, code) {
      return api('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: email, token: String(code).trim() } })
        .then(function (sess) { saveSession(sess); Cloud.user = Cloud.mapUser(sess.user); Cloud.error = ''; notify(); return Cloud.pull(); });
    },
    signOut: function () {
      var p = Cloud.session ? api('/auth/v1/logout', { method: 'POST', auth: true }).catch(function () {}) : Promise.resolve();
      return p.then(function () { saveSession(null); Cloud.user = null; Cloud.status = 'local'; notify(); });
    },
    signIn: function () { return Promise.resolve(Cloud.signInGoogle()); },
    pull: function () {
      if (!Cloud.user) return Promise.resolve();
      return fresh().then(function () { return api('/rest/v1/progress?select=data&user_id=eq.' + Cloud.user.uid, { auth: true }); })
        .then(function (rows) {
          state = merge(state, rows && rows[0] ? rows[0].data : null);
          if (!state.profile.name && Cloud.user.displayName) state.profile.name = Cloud.user.displayName;
          persist(true);
          return Cloud.push();
        }).catch(function (e) { Cloud.error = e.message; Cloud.status = 'error'; notify(); });
    },
    push: function () {
      var jobs = [];
      if (Cloud.user) jobs.push(fresh().then(function () {
        return api('/rest/v1/progress?on_conflict=user_id', { method: 'POST', auth: true, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: { user_id: Cloud.user.uid, data: state, updated_at: new Date().toISOString() } });
      }));
      if (Cloud.syncKey) jobs.push(api('/rest/v1/rpc/sync_save', { method: 'POST', body: { p_key: Cloud.syncKey, p_data: state } }));
      if (!jobs.length) return Promise.resolve();
      return Promise.all(jobs).then(function () { Cloud.status = 'synced'; Cloud.error = ''; Cloud.lastSync = Date.now(); notify(); })
        .catch(function (e) { Cloud.error = e.message; Cloud.status = 'error'; notify(); });
    },
    newKey: function () {
      var a = new Uint8Array(18); (window.crypto || window.msCrypto).getRandomValues(a);
      var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k = '';
      for (var i = 0; i < a.length; i++) k += abc[a[i] % abc.length];
      k = k.match(/.{1,6}/g).join('-');
      Cloud.syncKey = k; safeSet(KK, k);
      return Cloud.push().then(function () { return k; });
    },
    useKey: function (k) {
      k = String(k || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}(-[A-Z0-9]{6}){2}$/.test(k)) return Promise.reject(new Error('صيغة المفتاح غير صحيحة'));
      Cloud.syncKey = k; safeSet(KK, k);
      return Cloud.pullKey();
    },
    forgetKey: function () { Cloud.syncKey = ''; try { localStorage.removeItem(KK); } catch (e) {} notify(); },
    pullKey: function () {
      if (!Cloud.syncKey) return Promise.resolve();
      Cloud.status = 'syncing'; notify();
      return api('/rest/v1/rpc/sync_load', { method: 'POST', body: { p_key: Cloud.syncKey } })
        .then(function (d) { state = merge(state, d); persist(true); return Cloud.push(); })
        .catch(function (e) { Cloud.error = e.message; Cloud.status = 'error'; notify(); });
    },
    feedback: function (row) {
      if (!Cloud.enabled) return Promise.reject(new Error('off'));
      return fresh().catch(function () {}).then(function () {
        return api('/rest/v1/feedback', { method: 'POST', auth: !!Cloud.session, headers: { Prefer: 'return=minimal' }, body: row });
      });
    }
  };

  function notify() { listeners.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  function b64e(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64d(str) { return decodeURIComponent(escape(atob(str))); }

  window.Store = {
    get: function () { return state; },
    onChange: function (fn) { listeners.push(fn); },
    record: function (qid, correct, chosen) {
      var a = state.answers[qid] || { c: 0, w: 0, t: 0, l: null };
      if (correct) a.c++; else a.w++;
      a.t = Date.now(); a.l = correct ? 1 : 0; a.ch = chosen;
      state.answers[qid] = a;
      persist();
    },
    markLesson: function (key, on) {
      if (on) state.lessons[key] = Date.now(); else delete state.lessons[key];
      persist();
    },
    addExam: function (e) { state.exams.push(e); state.exams = state.exams.slice(-50); persist(); },
    setName: function (n) { state.profile.name = String(n || '').slice(0, 40); persist(); },
    reset: function () { state = blank(); persist(); },
    exportCode: function () { return 'IFCE4:' + b64e(JSON.stringify(state)); },
    importCode: function (code) {
      code = String(code || '').trim();
      if (code.indexOf('IFCE4:') !== 0) throw new Error('الرمز غير صالح');
      var data = JSON.parse(b64d(code.slice(6)));
      state = merge(state, data);
      persist();
      return true;
    },
    Cloud: Cloud
  };
})();
