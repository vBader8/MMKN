/* إدارة التقدم: حفظ محلي + رمز مزامنة + مزامنة سحابية اختيارية (Firebase) */
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
    if (!skipCloud && Cloud.user) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(Cloud.push, 1500);
    }
  }

  /* ===== Cloud (Firebase, optional) ===== */
  var Cloud = {
    enabled: false, ready: false, user: null, error: '', status: 'local',
    init: function () {
      var cfg = (window.IFCE_CONFIG || {}).firebase || {};
      if (!cfg.apiKey || !cfg.projectId) { Cloud.enabled = false; return Promise.resolve(false); }
      Cloud.enabled = true;
      var base = 'https://www.gstatic.com/firebasejs/10.12.2/';
      return loadScript(base + 'firebase-app-compat.js')
        .then(function () { return loadScript(base + 'firebase-auth-compat.js'); })
        .then(function () { return loadScript(base + 'firebase-firestore-compat.js'); })
        .then(function () {
          if (!firebase.apps.length) firebase.initializeApp(cfg);
          Cloud.ready = true;
          firebase.auth().getRedirectResult().catch(function (e) { Cloud.error = e.message; });
          firebase.auth().onAuthStateChanged(function (u) {
            Cloud.user = u || null;
            Cloud.status = u ? 'syncing' : 'local';
            notify();
            if (u) Cloud.pull();
          });
          return true;
        })
        .catch(function (e) { Cloud.error = 'تعذر تحميل خدمة المزامنة: ' + (e && e.message || e); Cloud.enabled = false; notify(); return false; });
    },
    signIn: function () {
      if (!Cloud.ready) return Promise.reject(new Error('المزامنة السحابية غير مفعّلة'));
      var p = new firebase.auth.GoogleAuthProvider();
      return firebase.auth().signInWithPopup(p).catch(function (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
          return firebase.auth().signInWithRedirect(p);
        }
        throw e;
      });
    },
    signOut: function () { return Cloud.ready ? firebase.auth().signOut() : Promise.resolve(); },
    doc: function () { return firebase.firestore().collection('users').doc(Cloud.user.uid); },
    pull: function () {
      if (!Cloud.user) return;
      Cloud.doc().get().then(function (snap) {
        var remote = snap.exists ? (snap.data() || {}).progress : null;
        if (remote) {
          try { remote = JSON.parse(remote); } catch (e) { remote = null; }
        }
        state = merge(state, remote);
        if (!state.profile.name && Cloud.user.displayName) state.profile.name = Cloud.user.displayName;
        persist(true);
        Cloud.push();
      }).catch(function (e) { Cloud.error = e.message; Cloud.status = 'error'; notify(); });
    },
    push: function () {
      if (!Cloud.user) return;
      Cloud.doc().set({ progress: JSON.stringify(state), updated: Date.now() }, { merge: true })
        .then(function () { Cloud.status = 'synced'; Cloud.error = ''; notify(); })
        .catch(function (e) { Cloud.error = e.message; Cloud.status = 'error'; notify(); });
    }
  };

  function notify() { listeners.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = function () { rej(new Error(src)); };
      document.head.appendChild(s);
    });
  }

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
