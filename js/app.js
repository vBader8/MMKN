/* منصة IFCE — منطق التطبيق (بدون أطر عمل، يعمل على Chrome و Safari و Edge و Firefox) */
(function () {
  'use strict';

  var CH = (window.IFCE && IFCE.chapters ? IFCE.chapters.slice() : []).sort(function (a, b) { return a.id - b.id; });
  var CFG = window.IFCE_CONFIG || {};
  var TG = CFG.telegram || 'B1Ver';
  var main = document.getElementById('main');
  var LETTERS = ['أ', 'ب', 'ج', 'د'];

  /* نتيجة الاختبار الرسمي السابق للمستخدم (من صورة تفاصيل النتيجة) */
  var PRIOR = [
    { t: 'المشاركة والحلول', ch: 8, s: 4, n: 8 },
    { t: 'سوق التأمين', ch: 2, s: 7, n: 20 },
    { t: 'الخطر والتأمين', ch: 1, s: 14, n: 42 },
    { t: 'الوكالة والعقود', ch: 3, s: 6, n: 20 },
    { t: 'التعويض', ch: 7, s: 7, n: 24 },
    { t: 'عملية التأمين في المملكة', ch: 11, s: 11, n: 40 },
    { t: 'تنظيم قطاع التأمين', ch: 9, s: 7, n: 20 },
    { t: 'السلوك الأخلاقي والحوكمة', ch: 10, s: 3, n: 6 },
    { t: 'السبب المباشر', ch: 6, s: 1, n: 4 },
    { t: 'تقييم الإفصاح والتصريحات', ch: 5, s: 3, n: 10 },
    { t: 'المصلحة التأمينية', ch: 4, s: 1, n: 6 }
  ];

  /* ===== أدوات عامة ===== */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function strip(h) { return String(h || '').replace(/<[^>]+>/g, ''); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function chap(id) { for (var i = 0; i < CH.length; i++) if (CH[i].id === +id) return CH[i]; return null; }
  function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
  function ss(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function toast(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function ask(msg, okText, cb) {
    var d = document.createElement('div'); d.className = 'search-layer'; d.style.alignItems = 'center';
    d.innerHTML = '<div class="card" role="alertdialog" style="max-width:420px;width:100%"><p style="margin-top:0;font-weight:600">' + esc(msg) + '</p><div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-x="0">إلغاء</button><button class="btn sm" data-x="1">' + esc(okText) + '</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-x]'); if (e.target === d || b) { d.remove(); if (b && b.getAttribute('data-x') === '1') cb(); } });
    d.querySelector('[data-x="1"]').focus();
  }
  function fmtTime(s) { s = Math.max(0, Math.floor(s)); var m = Math.floor(s / 60), x = s % 60; return (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x; }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } document.body.removeChild(ta);
    });
  }
  function dateAr(ts) { try { return new Date(ts).toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return new Date(ts).toLocaleDateString(); } }

  /* ===== بنك الأسئلة ===== */
  var BANK = [];
  CH.forEach(function (c) {
    c.self.forEach(function (q, i) { BANK.push({ id: 'c' + c.id + '-s' + (i + 1), ch: c.id, kind: 'self', n: i + 1, q: q.q, o: q.o, a: q.a, e: q.e }); });
    c.lines.forEach(function (q, i) { BANK.push({ id: 'c' + c.id + '-l' + (i + 1), ch: c.id, kind: 'lines', n: i + 1, q: q.q, o: q.o, a: q.a, e: q.e }); });
  });
  var BYID = {}; BANK.forEach(function (q) { BYID[q.id] = q; });
  function pool(chs, kinds) { return BANK.filter(function (q) { return chs.indexOf(q.ch) > -1 && kinds.indexOf(q.kind) > -1; }); }

  /* ===== إحصاءات التقدم ===== */
  function chStats(id) {
    var st = Store.get(), qs = BANK.filter(function (q) { return q.ch === id; });
    var seen = 0, ok = 0, c = 0, w = 0;
    qs.forEach(function (q) { var a = st.answers[q.id]; if (a) { seen++; if (a.l === 1) ok++; c += a.c || 0; w += a.w || 0; } });
    var ch = chap(id), ld = 0;
    ch.lessons.forEach(function (l) { if (st.lessons[id + '-' + l.code]) ld++; });
    return { total: qs.length, seen: seen, ok: ok, acc: pct(c, c + w), lessons: ld, lessonsTotal: ch.lessons.length,
      done: Math.round((pct(seen, qs.length) * 0.6) + (pct(ld, ch.lessons.length) * 0.4)) };
  }
  function globalStats() {
    var st = Store.get(), c = 0, w = 0, seen = 0;
    Object.keys(st.answers).forEach(function (k) { if (BYID[k]) { seen++; c += st.answers[k].c || 0; w += st.answers[k].w || 0; } });
    var lt = 0, ld = 0; CH.forEach(function (ch) { ch.lessons.forEach(function (l) { lt++; if (st.lessons[ch.id + '-' + l.code]) ld++; }); });
    return { seen: seen, total: BANK.length, acc: pct(c, c + w), lessons: ld, lessonsTotal: lt, exams: st.exams.length };
  }

  /* ===== التوجيه ===== */
  var routes = {};
  function route(name, fn) { routes[name] = fn; }
  function parse() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { name: parts[0] || 'home', args: parts.slice(1) };
  }
  function render() {
    var r = parse();
    stopTimerUI();
    var fn = routes[r.name] || routes.home;
    main.innerHTML = '';
    try { fn.apply(null, r.args); } catch (e) { console.error(e); main.innerHTML = '<div class="empty card">حدث خطأ غير متوقع أثناء عرض الصفحة. <a href="#/">العودة للرئيسية</a></div>'; }
    var navKey = { ch: 'chapters', quiz: quizNav() }[r.name] || r.name;
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === navKey); });
    if (!render.first) { main.focus({ preventScroll: true }); }
    render.first = false;
    window.scrollTo(0, 0);
    updateAvatar();
  }
  render.first = true;
  function quizNav() { var s = Quiz.state(); return s ? (s.mode === 'exam' ? 'exam' : (s.nav || 'lines')) : 'home'; }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }

  function html(s) { main.insertAdjacentHTML('beforeend', s); }
  function crumbs(items) {
    return '<div class="crumbs"><a href="#/">الرئيسية</a>' + items.map(function (x) { return ' ‹ ' + (x[1] ? '<a href="' + x[1] + '">' + esc(x[0]) + '</a>' : esc(x[0])); }).join('') + '</div>';
  }

  /* ===== الرئيسية ===== */
  route('home', function () {
    var g = globalStats(), st = Store.get(), name = st.profile.name;
    var active = Quiz.state(); if (active && active.done) active = null;
    var plan = CH.map(function (c) {
      var p = PRIOR.filter(function (x) { return x.ch === c.id; })[0];
      var prior = p ? p.s / p.n : 0.5;
      var s = chStats(c.id), mine = s.seen >= 5 ? s.acc / 100 : null;
      var level = mine == null ? prior : (prior + mine * 2) / 3;
      return { c: c, score: c.examQ * (1 - level), level: Math.round(level * 100) };
    }).sort(function (a, b) { return b.score - a.score; });

    html(
      '<section class="hero"><div class="deco"></div>' +
      '<h1>' + (name ? 'أهلاً ' + esc(name) + ' 👋 ' : 'أهلاً بك 👋 ') + 'جاهز لاجتياز IFCE؟</h1>' +
      '<p>منصة مذاكرة مبنية بالكامل على النص الدراسي الرسمي «امتحان شهادة أساسيات التأمين — الإصدار 4». الاختبار الحقيقي يصوغ الأسئلة بطريقة مختلفة ومن بين السطور، لذلك ركّزنا على الفهم: ملخصات منظمة، خرائط ذهنية، جداول مقارنة، و' + BANK.length + ' سؤالاً مع شرح للإجابة الصحيحة بعد كل اختيار.</p>' +
      '<div class="row" style="margin-top:14px">' +
      '<div class="stat"><b>' + g.seen + '/' + g.total + '</b><span>سؤال تمت محاولته</span></div>' +
      '<div class="stat"><b>' + g.acc + '%</b><span>دقة إجاباتك</span></div>' +
      '<div class="stat"><b>' + g.lessons + '/' + g.lessonsTotal + '</b><span>درس تم فهمه</span></div>' +
      '<div class="stat"><b>' + g.exams + '</b><span>اختبار محاكي</span></div></div>' +
      '<div class="row" style="margin-top:16px">' +
      (active ? '<a class="btn accent" href="#/quiz">▶ متابعة: ' + esc(active.title) + '</a>' : '') +
      '<a class="btn white" href="#/lines">ابدأ أسئلة بين السطور</a><a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" href="#/exam">اختبار محاكي 100 سؤال</a></div></section>'
    );

    html('<div class="grid g2" style="margin-top:18px">' +
      '<div class="card"><div class="row between"><h3>نتيجتك في الاختبار الرسمي (تفاصيل النتيجة)</h3><span class="chip bad">' + pct(64, 200) + '% إجمالاً</span></div>' +
      '<p class="muted" style="margin-top:0;font-size:.88rem">من الصورة التي أرسلتها — نستخدمها لترتيب أولويات مذاكرتك.</p>' +
      PRIOR.slice().sort(function (a, b) { return a.s / a.n - b.s / b.n; }).map(function (p) {
        var v = pct(p.s, p.n), col = v < 30 ? 'var(--err)' : v < 40 ? 'var(--bad)' : 'var(--warn)';
        return '<a class="wk" style="text-decoration:none;color:inherit" href="#/ch/' + p.ch + '"><span>' + esc(p.t) + ' <small class="muted">(' + p.s + '/' + p.n + ')</small></span><div class="bar" style="--wc:' + col + '"><i style="width:' + v + '%"></i></div><b>' + v + '%</b></a>';
      }).join('') + '</div>' +
      '<div class="card"><h3>خطة المذاكرة الذكية</h3><p class="muted" style="margin-top:0;font-size:.88rem">ترتيب حسب: وزن الفصل في الاختبار × مستوى ضعفك (يتحدث تلقائياً مع تقدمك).</p><ol class="plan">' +
      plan.slice(0, 6).map(function (p) {
        return '<li><a href="#/ch/' + p.c.id + '"><b>الفصل ' + p.c.id + ': ' + esc(p.c.title) + '</b></a> — <span class="chip p">≈ ' + p.c.examQ + ' سؤال</span> <span class="chip ' + (p.level < 35 ? 'bad' : 'w') + '">مستواك ' + p.level + '%</span></li>';
      }).join('') + '</ol><div class="row"><a class="btn soft sm" href="#/lines/weak">تدريب على نقاط ضعفي</a><a class="btn ghost sm" href="#/maps">الخرائط والمقارنات</a></div></div></div>'
    );

    html('<h2>فصول الكتاب</h2><div class="grid g3">' + CH.map(chCard).join('') + '</div>');

    html('<div class="grid g2" style="margin-top:18px">' +
      '<div class="card"><h3>كيف تذاكر بهذه المنصة؟</h3><ol>' +
      '<li>اقرأ <b>الدروس</b> لكل فصل وعلّم «فهمته ✓».</li><li>راجع <b>الخريطة الذهنية</b> و<b>المصطلحات</b> لربط المفاهيم.</li>' +
      '<li>حل <b>أسئلة الامتحان الذاتي</b> (مُعاد صياغتها من الكتاب) ثم <b>أسئلة بين السطور</b> بالعدد الذي تريده.</li>' +
      '<li>راجع <b>أخطائي</b> حتى تختفي، ثم أجرِ <b>الاختبار المحاكي</b> (100 سؤال / ساعتان بتوزيع المنهج الرسمي).</li></ol></div>' +
      '<div class="card"><h3>توزيع أسئلة الاختبار الرسمي</h3>' +
      [['1. الخطر والتأمين', 18], ['2. سوق التأمين', 10], ['3. المبادئ القانونية (الفصول 3–8)', 36], ['4. التنظيم والرقابة', 12], ['5. الأخلاقيات والحوكمة', 2], ['6. إجراءات عملية التأمين', 10], ['7. المنتجات وخدمة العملاء', 12]].map(function (x) {
        return '<div class="kv"><span>' + x[0] + '</span><b>' + x[1] + ' سؤال</b></div>';
      }).join('') + '<p class="muted" style="font-size:.82rem;margin-bottom:0">± سؤال أو سؤالين لكل مخرج حسب مواصفات الامتحان.</p></div></div>');
  });

  function chCard(c) {
    var s = chStats(c.id);
    return '<a class="card ch-card" style="--c:' + c.color + '" href="#/ch/' + c.id + '">' +
      '<div class="row between"><span class="ch-num">' + c.id + '</span><span class="chip p">≈ ' + c.examQ + ' سؤال</span></div>' +
      '<h3>' + esc(c.title) + '</h3><p>' + esc(c.outcome) + '</p>' +
      '<div class="bar"><i style="width:' + s.done + '%"></i></div>' +
      '<small class="muted">' + s.lessons + '/' + s.lessonsTotal + ' دروس • ' + s.seen + '/' + s.total + ' أسئلة • دقة ' + s.acc + '%</small></a>';
  }

  route('chapters', function () {
    html(crumbs([['الفصول']]) + '<h1>فصول النص الدراسي</h1><p class="muted">11 فصلاً تغطي المخرجات التعليمية السبعة لمنهج IFCE.</p><div class="grid g3">' + CH.map(chCard).join('') + '</div>');
  });

  /* ===== صفحة الفصل ===== */
  var TABS = [['lessons', 'الدروس'], ['map', 'الخريطة الذهنية'], ['terms', 'المصطلحات والبطاقات'], ['self', 'أسئلة الامتحان الذاتي'], ['lines', 'أسئلة بين السطور']];
  route('ch', function (id, tab, open) {
    var c = chap(id); if (!c) return go('#/chapters');
    tab = tab || 'lessons';
    var s = chStats(c.id);
    var prev = chap(c.id - 1), next = chap(c.id + 1);
    html(crumbs([['الفصول', '#/chapters'], ['الفصل ' + c.id]]) +
      '<div class="card" style="border-top:5px solid ' + c.color + '"><div class="row"><span class="ch-num" style="background:' + c.color + ';width:52px;height:52px;font-size:1.3rem">' + c.id + '</span>' +
      '<div style="flex:1;min-width:200px"><h1 style="margin:0">' + esc(c.title) + '</h1><div class="muted" style="font-size:.9rem">مخرج المنهج: ' + esc(c.outcome) + '</div></div>' +
      '<div class="ring" style="--v:' + s.done + '"><span>' + s.done + '%</span></div></div>' +
      '<p style="margin-bottom:0">' + esc(c.intro) + '</p>' +
      '<div class="row" style="margin-top:10px"><span class="chip p">≈ ' + c.examQ + ' سؤالاً في الاختبار</span><span class="chip">' + c.lessons.length + ' دروس</span><span class="chip">' + c.terms.length + ' مصطلحاً</span><span class="chip a">' + (c.self.length + c.lines.length) + ' سؤالاً</span></div></div>' +
      '<div class="seg" style="margin-top:14px" role="tablist">' + TABS.map(function (t) { return '<button role="tab" data-tab="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="tabBody"></div>' +
      '<div class="row between" style="margin-top:24px">' + (prev ? '<a class="btn ghost" href="#/ch/' + prev.id + '">→ الفصل ' + prev.id + '</a>' : '<span></span>') + (next ? '<a class="btn ghost" href="#/ch/' + next.id + '">الفصل ' + next.id + ' ←</a>' : '<span></span>') + '</div>');
    main.querySelectorAll('.seg button').forEach(function (b) {
      b.onclick = function () { history.replaceState(null, '', '#/ch/' + c.id + '/' + b.getAttribute('data-tab')); main.querySelectorAll('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); }); chTab(c, b.getAttribute('data-tab')); };
    });
    chTab(c, tab, open);
  });

  function chTab(c, tab, open) {
    var body = document.getElementById('tabBody');
    var st = Store.get();
    if (tab === 'lessons') {
      body.innerHTML = c.lessons.map(function (l, i) {
        var key = c.id + '-' + l.code, done = !!st.lessons[key];
        var isOpen = open ? open === l.code : i === 0;
        return '<details class="card lesson" id="L-' + esc(l.code) + '" style="--c:' + c.color + '"' + (isOpen ? ' open' : '') + '><summary><span class="code">' + esc(l.code) + '</span>' + esc(l.title) + (done ? ' <span class="chip ok">✓ فهمته</span>' : '') + '<svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></summary>' +
          '<ul>' + l.points.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
          (l.tip ? '<div class="tip"><div>' + l.tip + '</div></div>' : '') +
          '<button class="btn ' + (done ? 'ghost' : 'soft') + ' sm done-btn" data-key="' + key + '">' + (done ? 'إلغاء علامة الفهم' : 'فهمت هذا الدرس ✓') + '</button></details>';
      }).join('') +
        '<div class="card" style="margin-top:14px"><div class="row between"><b>اختبر فهمك لهذا الفصل الآن</b><div class="row"><button class="btn sm" data-start="self">الامتحان الذاتي (' + c.self.length + ')</button><button class="btn soft sm" data-start="lines">بين السطور (' + c.lines.length + ')</button></div></div></div>';
      body.querySelectorAll('.done-btn').forEach(function (b) {
        b.onclick = function () { var k = b.getAttribute('data-key'); Store.markLesson(k, !Store.get().lessons[k]); chTab(c, 'lessons', k.split('-')[1]); toast(Store.get().lessons[k] ? 'أحسنت! تم تسجيل الدرس ✓' : 'تم إلغاء العلامة'); };
      });
      body.querySelectorAll('[data-start]').forEach(function (b) { b.onclick = function () { startChapterQuiz(c, b.getAttribute('data-start'), 0); }; });
      if (open) { var el = document.getElementById('L-' + open); if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
    } else if (tab === 'map') {
      body.innerHTML = '<div class="card" style="margin-top:14px">' + mindMapHTML(c.mind, c.color) + '</div>';
      wireMindMap(body);
    } else if (tab === 'terms') {
      renderFlash(body, c);
    } else if (tab === 'self' || tab === 'lines') {
      var list = tab === 'self' ? c.self : c.lines;
      var desc = tab === 'self'
        ? 'أسئلة الامتحان الذاتي الموجودة في نهاية الفصل، معاد صياغتها بأسلوب الاختبار مع الإبقاء على نفس الفكرة والإجابة المعتمدة في مفتاح الكتاب، وبعد كل إجابة يظهر شرح مبسط للإجابة الصحيحة.'
        : 'أسئلة متوقعة مستخرجة من بين سطور الفصل (تفاصيل، أمثلة، قضايا، أرقام، استثناءات) كما يفعل الاختبار الرسمي للتأكد من الفهم.';
      body.innerHTML = '<div class="card" style="margin-top:14px"><h3>' + (tab === 'self' ? 'أسئلة الامتحان الذاتي' : 'أسئلة بين سطور الكتاب المتوقعة') + ' — الفصل ' + c.id + '</h3><p class="muted">' + desc + '</p>' +
        '<div class="field"><label>عدد الأسئلة</label><div class="pills" id="cntP">' + countOpts(list.length).map(function (n, i) { return '<button class="pill' + (i === countOpts(list.length).length - 1 ? ' on' : '') + '" data-n="' + n + '">' + (n === list.length ? 'الكل (' + n + ')' : n) + '</button>'; }).join('') + '</div></div>' +
        '<button class="btn" id="goQ">ابدأ الآن</button></div>';
      var n = list.length;
      pillGroup(body.querySelector('#cntP'), function (v) { n = +v; });
      body.querySelector('#goQ').onclick = function () { startChapterQuiz(c, tab, n); };
    }
  }
  function countOpts(max) { var o = [5, 10, 20, 30, 50].filter(function (x) { return x < max; }); o.push(max); return o; }
  function pillGroup(el, cb) {
    el.querySelectorAll('.pill').forEach(function (p) { p.onclick = function () { el.querySelectorAll('.pill').forEach(function (x) { x.classList.remove('on'); }); p.classList.add('on'); cb(p.getAttribute('data-n') || p.getAttribute('data-v')); }; });
  }
  function startChapterQuiz(c, kind, n) {
    var p = pool([c.id], [kind]);
    if (kind === 'self') p = p.sort(function (a, b) { return a.n - b.n; }); else p = shuffle(p);
    if (n && n < p.length) p = p.slice(0, n);
    Quiz.start({ title: (kind === 'self' ? 'الامتحان الذاتي' : 'بين السطور') + ' — الفصل ' + c.id, items: p, mode: 'practice', nav: kind === 'self' ? 'self' : 'lines', back: '#/ch/' + c.id + '/' + kind });
  }

  /* ===== البطاقات التعليمية ===== */
  function renderFlash(body, c) {
    var deck = shuffle(c.terms), i = 0;
    body.innerHTML = '<div class="card" style="margin-top:14px"><div class="row between"><h3 style="margin:0">بطاقات المصطلحات</h3><span class="muted" id="fcCount"></span></div>' +
      '<div class="flash-wrap"><div class="flash" id="fc" tabindex="0" role="button" aria-label="اقلب البطاقة"><div class="face front" id="fcF"></div><div class="face back" id="fcB"></div></div></div>' +
      '<div class="row" style="justify-content:center"><button class="btn ghost sm" id="fcPrev">→ السابقة</button><button class="btn soft sm" id="fcFlip">اقلب البطاقة</button><button class="btn ghost sm" id="fcNext">التالية ←</button><button class="btn ghost sm" id="fcShuf">خلط</button></div></div>' +
      '<h3 style="margin-top:20px">قائمة المصطلحات الرئيسية</h3><div class="terms-list">' + c.terms.map(function (t) { return '<div class="term"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>'; }).join('') + '</div>';
    var fc = body.querySelector('#fc');
    function show() {
      fc.classList.remove('flip');
      body.querySelector('#fcF').innerHTML = esc(deck[i][0]) + '<small>اضغط لرؤية التعريف</small>';
      body.querySelector('#fcB').innerHTML = '<div><b style="color:var(--primary)">' + esc(deck[i][0]) + '</b><p>' + esc(deck[i][1]) + '</p></div>';
      body.querySelector('#fcCount').textContent = (i + 1) + ' / ' + deck.length;
    }
    function flip() { fc.classList.toggle('flip'); }
    fc.onclick = flip; fc.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
    body.querySelector('#fcFlip').onclick = flip;
    body.querySelector('#fcNext').onclick = function () { i = (i + 1) % deck.length; show(); };
    body.querySelector('#fcPrev').onclick = function () { i = (i - 1 + deck.length) % deck.length; show(); };
    body.querySelector('#fcShuf').onclick = function () { deck = shuffle(deck); i = 0; show(); };
    show();
  }

  /* ===== الخريطة الذهنية ===== */
  var PALETTE = ['#2563eb', '#0d9488', '#db2777', '#ea580c', '#7c3aed', '#16a34a', '#ca8a04', '#dc2626', '#0891b2'];
  function mindMapHTML(m, color, links) {
    return '<div class="mm"><svg class="links" aria-hidden="true"></svg><div class="mm-center" style="background:linear-gradient(135deg,' + (color || 'var(--primary)') + ',var(--accent))">' + esc(m.center) + '</div><div class="mm-branches">' +
      m.branches.map(function (b, i) {
        var col = b.color || PALETTE[i % PALETTE.length];
        return '<div class="mm-b" tabindex="0" role="button" aria-expanded="false" style="--bc:' + col + '"><h4>' + esc(b.t) + '</h4><ul>' + b.c.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
          (links && links[i] ? '<a class="btn sm soft" style="margin-top:8px" href="' + links[i] + '">افتح الفصل</a>' : '') + '</div>';
      }).join('') + '</div><div class="mm-hint">اضغط على أي فرع لعرض تفاصيله • «افتح الكل» لعرض الخريطة كاملة</div><div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost sm mm-all">افتح الكل / أغلق الكل</button></div></div>';
  }
  function wireMindMap(root) {
    root.querySelectorAll('.mm').forEach(function (mm) {
      var bs = mm.querySelectorAll('.mm-b');
      bs.forEach(function (b) {
        function t(e) { if (e && e.target.closest('a')) return; b.classList.toggle('open'); b.setAttribute('aria-expanded', b.classList.contains('open')); draw(); }
        b.onclick = t; b.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } };
      });
      mm.querySelector('.mm-all').onclick = function () { var anyClosed = Array.prototype.some.call(bs, function (b) { return !b.classList.contains('open'); }); bs.forEach(function (b) { b.classList.toggle('open', anyClosed); }); draw(); };
      function draw() {
        var svg = mm.querySelector('svg.links'), c = mm.querySelector('.mm-center');
        var R = mm.getBoundingClientRect(), C = c.getBoundingClientRect();
        var cx = C.left + C.width / 2 - R.left, cy = C.bottom - R.top;
        svg.setAttribute('viewBox', '0 0 ' + R.width + ' ' + R.height);
        svg.innerHTML = Array.prototype.map.call(bs, function (b) {
          var B = b.getBoundingClientRect(), bx = B.left + B.width / 2 - R.left, by = B.top - R.top;
          var my = (cy + by) / 2;
          return '<path d="M' + cx + ' ' + cy + ' C ' + cx + ' ' + my + ', ' + bx + ' ' + my + ', ' + bx + ' ' + by + '" style="stroke:' + getComputedStyle(b).getPropertyValue('--bc') + ';opacity:.45"/>';
        }).join('');
      }
      requestAnimationFrame(draw);
      window.addEventListener('resize', draw);
      mm._draw = draw;
    });
  }

  /* ===== الخرائط والمقارنات ===== */
  route('maps', function (sub) {
    sub = sub || 'all';
    var tabs = [['all', 'الخريطة الشاملة'], ['chapters', 'خرائط الفصول'], ['compare', 'جداول المقارنة'], ['facts', 'الأرقام والمدد']];
    html(crumbs([['الخرائط الذهنية والمقارنات']]) + '<h1>الخرائط الذهنية وأدوات الربط</h1><p class="muted">أدوات بصرية لتبسيط المفاهيم وربطها ببعضها: خريطة شاملة للمنهج، خريطة لكل فصل، جداول تمييز بين المفاهيم المتشابهة، وكل الأرقام والمدد التي يحبها الاختبار.</p>' +
      '<div class="seg" role="tablist">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (t[0] === sub ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="mapBody" style="margin-top:14px"></div>');
    main.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { history.replaceState(null, '', '#/maps/' + b.getAttribute('data-t')); main.querySelectorAll('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); }); mapsTab(b.getAttribute('data-t')); }; });
    mapsTab(sub);
  });
  function mapsTab(sub) {
    var body = document.getElementById('mapBody');
    if (sub === 'all') {
      var m = { center: 'IFCE — أساسيات التأمين', branches: CH.map(function (c) { return { t: c.id + '. ' + c.title, c: c.mind.branches.map(function (b) { return b.t; }), color: c.color }; }) };
      body.innerHTML = '<div class="card">' + mindMapHTML(m, 'var(--primary)', CH.map(function (c) { return '#/ch/' + c.id + '/map'; })) + '</div>' +
        '<div class="card" style="margin-top:14px"><h3>كيف ترتبط المبادئ القانونية الستة؟ (قلب الاختبار: 36 سؤالاً)</h3>' +
        '<div class="grid g3">' + [
          ['حسن النية (الفصل 5)', 'قبل العقد: أفصِح عن كل حقيقة جوهرية؛ وإلا قد تُبطل الوثيقة.', 5],
          ['المصلحة التأمينية (الفصل 4)', 'لا تأمين بلا علاقة مالية قانونية بالشيء — وإلا صار مقامرة.', 4],
          ['السبب المباشر (الفصل 6)', 'عند الخسارة: هل السبب المهيمن مسبب مؤمَّن ضده؟', 6],
          ['التعويض (الفصل 7)', 'أعِد المؤمَّن له لوضعه المالي قبل الخسارة — لا ربح ولا خسارة.', 7],
          ['المشاركة (الفصل 8)', 'تابع للتعويض: إذا تعددت الوثائق تتقاسم الشركات الخسارة بالحصة النسبية.', 8],
          ['الحلول (الفصل 8)', 'تابع للتعويض: بعد الدفع تسترد الشركة من المتسبب بحد ما دفعته.', 8]
        ].map(function (x, i) { return '<a class="card flat" style="text-decoration:none;color:inherit;border-inline-start:4px solid ' + PALETTE[i] + '" href="#/ch/' + x[2] + '"><b>' + (i + 1) + '. ' + x[0] + '</b><p class="muted" style="margin:.4em 0 0">' + x[1] + '</p></a>'; }).join('') + '</div>' +
        '<p class="muted" style="font-size:.88rem">التسلسل الزمني للمطالبة: إفصاح صحيح عند الطلب ← مصلحة تأمينية قائمة ← خسارة بسبب مباشر مغطى ← قياس التعويض (مع النسبية والتحمل) ← مشاركة الشركات الأخرى ← الحلول ضد المتسبب.</p></div>';
      wireMindMap(body);
    } else if (sub === 'chapters') {
      body.innerHTML = '<div class="field"><label for="mapSel">اختر الفصل</label><select id="mapSel" class="input">' + CH.map(function (c) { return '<option value="' + c.id + '">الفصل ' + c.id + ': ' + esc(c.title) + '</option>'; }).join('') + '</select></div><div id="mapOne"></div>';
      var sel = body.querySelector('#mapSel');
      function one() { var c = chap(sel.value); var t = body.querySelector('#mapOne'); t.innerHTML = '<div class="card">' + mindMapHTML(c.mind, c.color) + '</div>'; wireMindMap(t); }
      sel.onchange = one; one();
    } else if (sub === 'compare') {
      body.innerHTML = '<div class="grid g2">' + IFCE.compare.map(function (t) {
        return '<div class="card"><div class="row between"><h3 style="margin:0">' + esc(t.title) + '</h3><a class="chip p" href="#/ch/' + t.ch + '">الفصل ' + t.ch + '</a></div><div style="overflow-x:auto;margin-top:10px"><table class="tbl stack"><thead><tr>' + t.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          t.rows.map(function (r) { return '<tr>' + r.map(function (x, i) { return (i ? '<td data-l="' + esc(t.head[i]) + '">' : '<th scope="row">') + esc(x) + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
      }).join('') + '</div>';
    } else {
      body.innerHTML = '<div class="card"><div class="field"><label for="fq">ابحث في الأرقام والمدد</label><input id="fq" class="input" type="search" placeholder="مثال: 15 يوماً، رأس مال، المادة 44"></div><div style="overflow-x:auto"><table class="tbl stack"><thead><tr><th>الرقم / المدة</th><th>المعنى</th><th>الفصل</th></tr></thead><tbody id="ftb"></tbody></table></div></div>';
      var inp = body.querySelector('#fq');
      function fill() {
        var q = inp.value.trim();
        body.querySelector('#ftb').innerHTML = IFCE.facts.filter(function (f) { return !q || (f[0] + ' ' + f[1]).indexOf(q) > -1; }).map(function (f) {
          return '<tr><th scope="row">' + esc(f[0]) + '</th><td data-l="المعنى">' + esc(f[1]) + '</td><td data-l="الفصل">' + (f[2] ? '<a href="#/ch/' + f[2] + '">' + f[2] + '</a>' : 'المنهج') + '</td></tr>';
        }).join('') || '<tr><td colspan="3" class="muted">لا نتائج</td></tr>';
      }
      inp.oninput = fill; fill();
    }
  }

  /* ===== إعداد جلسات الأسئلة ===== */
  function chapterChecks(name, checked) {
    return '<div class="checks">' + CH.map(function (c) {
      return '<label class="check"><input type="checkbox" name="' + name + '" value="' + c.id + '"' + (checked(c) ? ' checked' : '') + '><span><b>' + c.id + '.</b> ' + esc(c.title) + '</span></label>';
    }).join('') + '</div>';
  }
  function getChecked(name) { return Array.prototype.map.call(main.querySelectorAll('input[name="' + name + '"]:checked'), function (x) { return +x.value; }); }
  function weakCh() { return PRIOR.filter(function (p) { return p.s / p.n < 0.36; }).map(function (p) { return p.ch; }); }

  function weightedPick(items, n) {
    if (n >= items.length) return shuffle(items);
    var by = {}; items.forEach(function (q) { (by[q.ch] = by[q.ch] || []).push(q); });
    var chs = Object.keys(by).map(Number), wsum = 0;
    chs.forEach(function (c) { wsum += chap(c).examQ; });
    var alloc = chs.map(function (c) { var exact = n * chap(c).examQ / wsum; return { c: c, k: Math.min(by[c].length, Math.floor(exact)), r: exact - Math.floor(exact) }; });
    var used = alloc.reduce(function (s, a) { return s + a.k; }, 0);
    alloc.sort(function (a, b) { return b.r - a.r; });
    var guard = 0;
    while (used < n && guard++ < 1000) {
      var moved = false;
      for (var i = 0; i < alloc.length && used < n; i++) { if (alloc[i].k < by[alloc[i].c].length) { alloc[i].k++; used++; moved = true; } }
      if (!moved) break;
    }
    var out = [];
    alloc.forEach(function (a) { out = out.concat(shuffle(by[a.c]).slice(0, a.k)); });
    return shuffle(out);
  }

  route('lines', function (preset) {
    var weak = weakCh();
    html(crumbs([['أسئلة بين السطور']]) + '<h1>أسئلة بين سطور الكتاب المتوقعة</h1>' +
      '<p class="muted">الاختبار الرسمي يأخذ أغلب أسئلته من تفاصيل النص: الأمثلة، القضايا، الاستثناءات، الأرقام، والمواد النظامية. هنا ' + pool(CH.map(function (c) { return c.id; }), ['lines']).length + ' سؤالاً من هذا النوع. اختر الفصول وعدد الأسئلة، وبعد كل اختيار ستظهر لك الإجابة الصحيحة وشرحها.</p>' +
      '<div class="card"><div class="row between"><h3 style="margin:0">١. اختر الفصول</h3><div class="row"><button class="btn ghost sm" data-sel="all">الكل</button><button class="btn ghost sm" data-sel="weak">نقاط ضعفي</button><button class="btn ghost sm" data-sel="none">إلغاء</button></div></div><div style="margin-top:10px">' +
      chapterChecks('lc', function (c) { return preset === 'weak' ? weak.indexOf(c.id) > -1 : true; }) + '</div>' +
      '<h3>٢. عدد الأسئلة</h3><div class="pills" id="lcN">' + [10, 20, 30, 50, 100].map(function (n, i) { return '<button class="pill' + (i === 1 ? ' on' : '') + '" data-n="' + n + '">' + n + '</button>'; }).join('') + '<button class="pill" data-n="0">الكل</button></div>' +
      '<div class="field" style="margin-top:10px;max-width:260px"><label for="lcCustom">أو اكتب عدداً مخصصاً</label><input id="lcCustom" class="input" type="number" min="1" max="999" inputmode="numeric" placeholder="مثال: 35"></div>' +
      '<h3>٣. خيارات</h3><label class="check" style="max-width:520px"><input type="checkbox" id="lcSkip"><span>استبعد الأسئلة التي أجبتها صحيحاً في آخر محاولة</span></label>' +
      '<label class="check" style="max-width:520px;margin-top:8px"><input type="checkbox" id="lcSelf" checked><span>أضف أسئلة الامتحان الذاتي المعاد صياغتها أيضاً</span></label>' +
      '<div class="row" style="margin-top:16px"><button class="btn" id="lcGo">ابدأ التدريب</button><span class="muted" id="lcInfo"></span></div></div>');
    var n = 20;
    pillGroup(main.querySelector('#lcN'), function (v) { n = +v; main.querySelector('#lcCustom').value = ''; info(); });
    main.querySelector('#lcCustom').oninput = function () { var v = parseInt(this.value, 10); if (v > 0) { n = v; main.querySelectorAll('#lcN .pill').forEach(function (x) { x.classList.remove('on'); }); } info(); };
    main.querySelectorAll('[data-sel]').forEach(function (b) {
      b.onclick = function () { var m = b.getAttribute('data-sel'); main.querySelectorAll('input[name="lc"]').forEach(function (x) { x.checked = m === 'all' || (m === 'weak' && weak.indexOf(+x.value) > -1); }); info(); };
    });
    main.querySelectorAll('input[name="lc"],#lcSkip,#lcSelf').forEach(function (x) { x.onchange = info; });
    function build() {
      var chs = getChecked('lc'), kinds = main.querySelector('#lcSelf').checked ? ['lines', 'self'] : ['lines'];
      var p = pool(chs, kinds), st = Store.get();
      if (main.querySelector('#lcSkip').checked) p = p.filter(function (q) { return !(st.answers[q.id] && st.answers[q.id].l === 1); });
      return p;
    }
    function info() { var p = build(); main.querySelector('#lcInfo').textContent = 'المتاح: ' + p.length + ' سؤالاً' + (n && n < p.length ? ' — سيتم اختيار ' + n + ' بتوزيع يتناسب مع أوزان الاختبار' : ''); }
    info();
    main.querySelector('#lcGo').onclick = function () {
      var p = build(); if (!p.length) return toast('اختر فصلاً واحداً على الأقل (أو ألغِ خيار الاستبعاد)');
      var items = n ? weightedPick(p, n) : shuffle(p);
      Quiz.start({ title: 'بين السطور — ' + items.length + ' سؤالاً', items: items, mode: 'practice', nav: 'lines', back: '#/lines' });
    };
  });

  route('self', function () {
    html(crumbs([['الامتحان الذاتي']]) + '<h1>أسئلة الامتحان الذاتي</h1><p class="muted">أسئلة نهاية كل فصل في الكتاب (' + pool(CH.map(function (c) { return c.id; }), ['self']).length + ' سؤالاً) مع الإجابات المعتمدة في مفتاح الكتاب، معاد صياغتها بأسلوب الاختبار ومع شرح مبسط بعد كل إجابة.</p>' +
      '<div class="grid g3">' + CH.map(function (c) {
        var st = Store.get(), done = c.self.filter(function (q, i) { var a = st.answers['c' + c.id + '-s' + (i + 1)]; return a && a.l === 1; }).length;
        return '<div class="card" style="border-top:4px solid ' + c.color + '"><b>الفصل ' + c.id + ': ' + esc(c.title) + '</b><div class="bar" style="margin:10px 0"><i style="width:' + pct(done, c.self.length) + '%"></i></div><div class="row between"><small class="muted">' + done + '/' + c.self.length + ' صحيحة</small><button class="btn sm" data-ch="' + c.id + '">ابدأ</button></div></div>';
      }).join('') + '</div>' +
      '<div class="card" style="margin-top:14px"><div class="row between"><b>كل أسئلة الامتحان الذاتي مخلوطة</b><button class="btn soft" id="selfAll">ابدأ الكل</button></div></div>');
    main.querySelectorAll('[data-ch]').forEach(function (b) { b.onclick = function () { startChapterQuiz(chap(b.getAttribute('data-ch')), 'self', 0); }; });
    main.querySelector('#selfAll').onclick = function () { var p = shuffle(pool(CH.map(function (c) { return c.id; }), ['self'])); Quiz.start({ title: 'الامتحان الذاتي — كل الفصول', items: p, mode: 'practice', nav: 'self', back: '#/self' }); };
  });

  route('exam', function () {
    var st = Store.get();
    html(crumbs([['الاختبار المحاكي']]) + '<h1>الاختبار المحاكي</h1><p class="muted">يحاكي الاختبار الرسمي: الأسئلة موزعة على الفصول بنفس أوزان منهج IFCE، مع مؤقت. اختر عرض الشرح بعد كل سؤال (للتعلم) أو في النهاية (لمحاكاة حقيقية).</p>' +
      '<div class="grid g2"><div class="card"><h3>إعداد الاختبار</h3>' +
      '<div class="field"><label>عدد الأسئلة</label><div class="pills" id="exN">' + [[25, '25 (30 دقيقة)'], [50, '50 (60 دقيقة)'], [100, '100 (ساعتان) — كالرسمي']].map(function (x, i) { return '<button class="pill' + (i === 2 ? ' on' : '') + '" data-n="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><label>طريقة عرض الشرح</label><div class="pills" id="exF"><button class="pill on" data-v="now">بعد كل سؤال</button><button class="pill" data-v="end">في النهاية فقط</button></div></div>' +
      '<label class="check"><input type="checkbox" id="exT" checked><span>تفعيل المؤقت (1.2 دقيقة لكل سؤال)</span></label>' +
      '<button class="btn" id="exGo" style="margin-top:14px">ابدأ الاختبار</button></div>' +
      '<div class="card"><h3>سجل اختباراتك</h3>' + (st.exams.length ? '<ul class="list-plain">' + st.exams.slice().reverse().slice(0, 10).map(function (e) {
        return '<li class="kv"><span>' + dateAr(e.date) + ' — ' + e.total + ' سؤال</span><b class="' + (e.pct >= 70 ? '' : '') + '" style="color:' + (e.pct >= 70 ? 'var(--ok)' : 'var(--err)') + '">' + e.pct + '%</b></li>';
      }).join('') + '</ul><p class="muted" style="font-size:.85rem">درجة النجاح المعتادة في اختبارات معهد التأمين القانوني تقارب 70% — اجعلها هدفك الأدنى.</p>' : '<p class="muted">لم تُجرِ أي اختبار محاكي بعد.</p>') + '</div></div>');
    var n = 100, fb = 'now';
    pillGroup(main.querySelector('#exN'), function (v) { n = +v; });
    pillGroup(main.querySelector('#exF'), function (v) { fb = v; });
    main.querySelector('#exGo').onclick = function () {
      var all = pool(CH.map(function (c) { return c.id; }), ['lines', 'self']);
      var items = weightedPick(all, n);
      Quiz.start({ title: 'اختبار محاكي — ' + n + ' سؤالاً', items: items, mode: 'exam', feedback: fb, minutes: main.querySelector('#exT').checked ? Math.round(n * 1.2) : 0, back: '#/exam' });
    };
  });

  route('review', function () {
    var st = Store.get();
    var wrong = BANK.filter(function (q) { var a = st.answers[q.id]; return a && a.l === 0; });
    var weakQ = BANK.filter(function (q) { var a = st.answers[q.id]; return a && a.l === 1 && a.w > 0; });
    var unseen = BANK.filter(function (q) { return !st.answers[q.id]; });
    html(crumbs([['مراجعة أخطائي']]) + '<h1>مراجعة أخطائي</h1><p class="muted">التكرار المتباعد: أعِد حل الأسئلة التي أخطأت فيها حتى تتقنها. كل سؤال تجيبه صحيحاً يخرج من القائمة تلقائياً.</p>' +
      '<div class="grid g3">' +
      revCard('أخطأت فيها آخر مرة', wrong.length, 'bad', 'rvW') +
      revCard('أصبتها لكن سبق أن أخطأت فيها', weakQ.length, 'w', 'rvK') +
      revCard('لم تحاول حلها بعد', unseen.length, 'p', 'rvU') + '</div>' +
      (wrong.length ? '<h2>الأسئلة التي أخطأت فيها</h2>' + wrong.slice(0, 60).map(function (q) {
        return '<div class="rev-item no"><div class="q">' + esc(q.q) + '</div><div class="a">✔ ' + esc(q.o[q.a]) + '</div><div class="muted" style="font-size:.85rem">' + esc(q.e) + '</div><small class="muted">الفصل ' + q.ch + '</small></div>';
      }).join('') : '<div class="empty card" style="margin-top:14px">🎉 لا توجد أخطاء مسجلة حالياً. استمر في التدريب!</div>'));
    function bind(id, list, title) { var b = main.querySelector('#' + id); if (b) b.onclick = function () { if (!list.length) return toast('لا توجد أسئلة في هذه القائمة'); Quiz.start({ title: title, items: shuffle(list).slice(0, 50), mode: 'practice', nav: 'review', back: '#/review' }); }; }
    bind('rvW', wrong, 'مراجعة الأخطاء'); bind('rvK', weakQ, 'تثبيت الأسئلة الصعبة'); bind('rvU', unseen, 'أسئلة جديدة');
  });
  function revCard(t, n, cls, id) { return '<div class="card"><span class="chip ' + cls + '">' + n + ' سؤال</span><h3>' + t + '</h3><button class="btn sm" id="' + id + '"' + (n ? '' : ' disabled') + '>تدرّب عليها</button></div>'; }

  /* ===== محرك الاختبار ===== */
  var Quiz = (function () {
    var S = null, tick = null;
    function save() { ss('ifce4_quiz', S); }
    function load() { if (!S) S = ss('ifce4_quiz'); return S; }
    function build(q) {
      var order = shuffle([0, 1, 2, 3]);
      return { id: q.id, ch: q.ch, kind: q.kind, q: q.q, o: order.map(function (k) { return q.o[k]; }), a: order.indexOf(q.a), e: q.e };
    }
    return {
      state: function () { return load(); },
      start: function (o) {
        if (!o.items || !o.items.length) return toast('لا توجد أسئلة متاحة');
        S = { title: o.title, mode: o.mode, nav: o.nav, back: o.back || '#/', feedback: o.feedback || 'now', items: o.items.map(build), ans: o.items.map(function () { return null; }), i: 0,
          started: Date.now(), end: o.minutes ? Date.now() + o.minutes * 60000 : 0, flags: [], done: false };
        save(); go('#/quiz');
      },
      answer: function (k) {
        if (!S || S.done || S.ans[S.i] != null) return;
        S.ans[S.i] = k; save();
        var it = S.items[S.i];
        Store.record(it.id, k === it.a, k);
      },
      move: function (d) { if (!S) return; S.i = Math.max(0, Math.min(S.items.length - 1, S.i + d)); save(); },
      jump: function (i) { if (!S) return; S.i = i; save(); },
      flag: function () { if (!S) return; var x = S.flags.indexOf(S.i); if (x > -1) S.flags.splice(x, 1); else S.flags.push(S.i); save(); },
      finish: function () {
        if (!S || S.done) return; S.done = true;
        var ok = 0; S.items.forEach(function (it, i) { if (S.ans[i] === it.a) ok++; });
        S.score = ok; S.secs = Math.round((Date.now() - S.started) / 1000);
        if (S.mode === 'exam') Store.addExam({ date: Date.now(), total: S.items.length, score: ok, pct: pct(ok, S.items.length), secs: S.secs });
        save();
      },
      clear: function () { S = null; ss('ifce4_quiz', null); },
      setTick: function (t) { clearInterval(tick); tick = t; },
      stopTick: function () { clearInterval(tick); tick = null; }
    };
  })();
  function stopTimerUI() { Quiz.stopTick(); }

  route('quiz', function () {
    var S = Quiz.state();
    if (!S) { html('<div class="empty card">لا يوجد اختبار جارٍ. <a href="#/lines">ابدأ تدريباً جديداً</a></div>'); return; }
    if (S.done) return renderResult(S);
    renderQ(S);
  });

  function renderQ(S) {
    var it = S.items[S.i], chosen = S.ans[S.i], answered = chosen != null;
    var showFb = answered && (S.mode !== 'exam' || S.feedback === 'now');
    var answeredN = S.ans.filter(function (x) { return x != null; }).length;
    var c = chap(it.ch);
    main.innerHTML =
      '<div class="qwrap">' + crumbs([[S.title]]) +
      '<div class="qhead"><b>سؤال ' + (S.i + 1) + ' من ' + S.items.length + '</b><div class="bar"><i style="width:' + pct(answeredN, S.items.length) + '%"></i></div>' +
      (S.end ? '<span class="timer" id="tmr">--:--</span>' : '') + '</div>' +
      '<div class="card qcard"><div class="qsrc"><span class="chip" style="background:' + c.color + '22;color:' + c.color + '">الفصل ' + c.id + ': ' + esc(c.title) + '</span> <span class="chip">' + (it.kind === 'self' ? 'امتحان ذاتي (معاد صياغته)' : 'بين السطور') + '</span>' +
      (S.mode === 'exam' ? ' <button class="chip flag" id="flagB" style="border:0">' + (S.flags.indexOf(S.i) > -1 ? '🚩 معلّم للمراجعة' : '⚑ علّم للمراجعة') + '</button>' : '') + '</div>' +
      '<p class="qtext">' + esc(it.q) + '</p><div class="opts">' +
      it.o.map(function (o, k) {
        var cls = '';
        if (showFb) { if (k === it.a) cls = 'correct'; else if (k === chosen) cls = 'wrong'; else cls = 'dim'; }
        else if (answered && k === chosen) cls = 'picked';
        return '<button class="opt ' + cls + '" data-k="' + k + '"' + (answered ? ' disabled' : '') + '><span class="k">' + LETTERS[k] + '</span><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>' +
      (showFb ? '<div class="explain"><div class="verdict ' + (chosen === it.a ? 'ok">✔ إجابة صحيحة، أحسنت!' : 'no">✘ إجابة غير صحيحة') + '</div>' +
        '<div class="ans">الإجابة الصحيحة: <span>(' + LETTERS[it.a] + ') ' + esc(it.o[it.a]) + '</span></div>' +
        (chosen !== it.a ? '<div class="muted" style="font-size:.9rem">اخترت: (' + LETTERS[chosen] + ') ' + esc(it.o[chosen]) + '</div>' : '') +
        '<p style="margin:.5em 0 0"><b>الشرح المبسط:</b> ' + esc(it.e) + '</p>' +
        '<a class="btn ghost sm" style="margin-top:8px" href="#/ch/' + it.ch + '/lessons">راجع الفصل ' + it.ch + '</a></div>' : '') +
      (answered && !showFb ? '<p class="muted" style="margin-top:12px">تم حفظ إجابتك. سيظهر الشرح في النهاية.</p>' : '') +
      '</div>' +
      '<div class="qnav"><button class="btn ghost" id="qPrev"' + (S.i === 0 ? ' disabled' : '') + '>→ السابق</button>' +
      '<div class="row"><a class="btn ghost" href="' + esc(S.back) + '">خروج مؤقت</a>' +
      '<button class="btn soft" id="qEnd">إنهاء وعرض النتيجة</button></div>' +
      '<button class="btn" id="qNext">' + (S.i === S.items.length - 1 ? 'إنهاء ✓' : 'التالي ←') + '</button></div>' +
      '<div class="dots" aria-label="خريطة الأسئلة">' + S.items.map(function (x, i) {
        var a = S.ans[i], cls = '';
        if (a != null) cls = (S.mode === 'exam' && S.feedback === 'end') ? 'ok' : (a === x.a ? 'ok' : 'no');
        return '<button class="' + cls + (i === S.i ? ' cur' : '') + '" data-j="' + i + '" title="سؤال ' + (i + 1) + '">' + (S.flags.indexOf(i) > -1 ? '🚩' : (i + 1)) + '</button>';
      }).join('') + '</div><p class="muted" style="font-size:.8rem;margin-top:10px">اختصارات: 1–4 لاختيار الإجابة • ← → للتنقل</p></div>';

    main.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { Quiz.answer(+b.getAttribute('data-k')); renderQ(Quiz.state()); }; });
    main.querySelector('#qPrev').onclick = function () { Quiz.move(-1); renderQ(Quiz.state()); scrollTop(); };
    main.querySelector('#qNext').onclick = function () {
      var s = Quiz.state();
      if (s.i === s.items.length - 1) return endQuiz();
      Quiz.move(1); renderQ(Quiz.state()); scrollTop();
    };
    main.querySelector('#qEnd').onclick = endQuiz;
    var fl = main.querySelector('#flagB'); if (fl) fl.onclick = function () { Quiz.flag(); renderQ(Quiz.state()); };
    main.querySelectorAll('.dots button').forEach(function (b) { b.onclick = function () { Quiz.jump(+b.getAttribute('data-j')); renderQ(Quiz.state()); }; });
    if (S.end) {
      var tm = main.querySelector('#tmr');
      var upd = function () {
        var left = (S.end - Date.now()) / 1000;
        if (tm) { tm.textContent = '⏱ ' + fmtTime(left); tm.classList.toggle('low', left < 300); }
        if (left <= 0) { Quiz.stopTick(); toast('انتهى الوقت!'); Quiz.finish(); renderResult(Quiz.state()); }
      };
      upd(); Quiz.setTick(setInterval(upd, 1000));
    }
  }
  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function endQuiz() {
    var S = Quiz.state(), left = S.ans.filter(function (x) { return x == null; }).length;
    function done() { Quiz.stopTick(); Quiz.finish(); renderResult(Quiz.state()); scrollTop(); }
    if (left) return ask('لم تُجب على ' + left + ' سؤالاً. هل تريد الإنهاء وعرض النتيجة؟', 'إنهاء وعرض النتيجة', done);
    done();
  }

  function renderResult(S) {
    var n = S.items.length, ok = S.score || 0, p = pct(ok, n);
    var per = {};
    S.items.forEach(function (it, i) { var r = per[it.ch] = per[it.ch] || { ok: 0, n: 0 }; r.n++; if (S.ans[i] === it.a) r.ok++; });
    var msg = p >= 85 ? 'ممتاز! مستواك يؤهلك للنجاح بثقة 🌟' : p >= 70 ? 'جيد جداً — أنت في منطقة النجاح، ثبّت نقاط الضعف 💪' : p >= 50 ? 'تقدّم جيد، راجع الفصول الأضعف أدناه ثم أعد المحاولة 📘' : 'لا بأس — ابدأ بالدروس والخرائط الذهنية للفصول الأضعف ثم أعد التدريب 🔁';
    main.innerHTML = '<div class="qwrap">' + crumbs([[S.title], ['النتيجة']]) +
      '<div class="card result-hero"><div class="big-score">' + p + '%</div><p style="font-size:1.1rem;margin:.4em 0">' + ok + ' إجابة صحيحة من ' + n + '</p><p class="muted">' + msg + '</p>' +
      '<p class="muted" style="font-size:.85rem">الوقت المستغرق: ' + fmtTime(S.secs || 0) + '</p>' +
      '<div class="row" style="justify-content:center"><button class="btn" id="rAgain">إعادة الأسئلة نفسها</button><button class="btn soft" id="rWrong"' + (ok === n ? ' disabled' : '') + '>أعد الأخطاء فقط</button><a class="btn ghost" href="' + esc(S.back) + '">رجوع</a></div></div>' +
      '<div class="card" style="margin-top:14px"><h3>أداؤك حسب الفصل</h3>' + Object.keys(per).sort(function (a, b) { return a - b; }).map(function (k) {
        var r = per[k], v = pct(r.ok, r.n), col = v >= 70 ? 'var(--ok)' : v >= 50 ? 'var(--warn)' : 'var(--err)';
        return '<a class="wk" style="text-decoration:none;color:inherit" href="#/ch/' + k + '"><span>الفصل ' + k + ': ' + esc(chap(k).title) + ' <small class="muted">(' + r.ok + '/' + r.n + ')</small></span><div class="bar" style="--wc:' + col + '"><i style="width:' + v + '%"></i></div><b>' + v + '%</b></a>';
      }).join('') + '</div>' +
      '<h2>مراجعة الإجابات مع الشرح</h2><div class="pills" id="rvF"><button class="pill on" data-v="all">الكل</button><button class="pill" data-v="no">الخاطئة فقط</button><button class="pill" data-v="ok">الصحيحة فقط</button></div><div id="rvList"></div></div>';
    function list(f) {
      main.querySelector('#rvList').innerHTML = S.items.map(function (it, i) {
        var a = S.ans[i], good = a === it.a;
        if ((f === 'no' && good) || (f === 'ok' && !good)) return '';
        return '<div class="rev-item ' + (good ? 'ok' : 'no') + '"><div class="q">' + (i + 1) + '. ' + esc(it.q) + '</div>' +
          '<div class="a">✔ الصحيحة: <b>' + esc(it.o[it.a]) + '</b></div>' + (good ? '' : '<div class="a" style="color:var(--err)">✘ إجابتك: ' + (a == null ? 'لم تُجب' : esc(it.o[a])) + '</div>') +
          '<div class="muted" style="font-size:.9rem;margin-top:4px">' + esc(it.e) + '</div></div>';
      }).join('') || '<div class="empty">لا توجد عناصر</div>';
    }
    pillGroup(main.querySelector('#rvF'), list); list('all');
    main.querySelector('#rAgain').onclick = function () { Quiz.start({ title: S.title, items: S.items.map(function (x) { return BYID[x.id]; }), mode: S.mode, feedback: S.feedback, nav: S.nav, minutes: S.end ? Math.round(S.items.length * 1.2) : 0, back: S.back }); };
    main.querySelector('#rWrong').onclick = function () { var w = S.items.filter(function (x, i) { return S.ans[i] !== x.a; }).map(function (x) { return BYID[x.id]; }); Quiz.start({ title: 'إعادة الأخطاء', items: w, mode: 'practice', nav: 'review', back: S.back }); };
  }

  /* ===== الاقتراحات والملاحظات ===== */
  route('feedback', function () {
    var st = Store.get();
    html(crumbs([['الاقتراحات والملاحظات']]) + '<h1>الاقتراحات والملاحظات</h1><p class="muted">ساعدنا في تحسين المنصة: اقتراح، ملاحظة على شرح، أو خطأ في سؤال. ستُرسل رسالتك مباشرة إلى حساب التيليجرام <b>@' + esc(TG) + '</b>.</p>' +
      '<div class="card" style="max-width:720px"><div class="field"><label for="fbName">الاسم (اختياري)</label><input id="fbName" class="input" value="' + esc(st.profile.name) + '"></div>' +
      '<div class="field"><label>نوع الرسالة</label><div class="pills" id="fbT"><button class="pill on" data-v="اقتراح">اقتراح</button><button class="pill" data-v="ملاحظة">ملاحظة</button><button class="pill" data-v="خطأ في سؤال أو شرح">خطأ في سؤال</button><button class="pill" data-v="استفسار">استفسار</button></div></div>' +
      '<div class="field"><label for="fbMsg">رسالتك</label><textarea id="fbMsg" class="input" placeholder="اكتب هنا… (إذا كان خطأً في سؤال، انسخ نص السؤال أو اذكر رقم الفصل)"></textarea></div>' +
      '<div class="row"><a class="btn" id="fbSend" href="https://t.me/' + esc(TG) + '" target="_blank" rel="noopener">إرسال عبر تيليجرام</a><button class="btn ghost" id="fbCopy">نسخ الرسالة فقط</button></div>' +
      '<p class="muted" style="font-size:.85rem">عند الضغط على «إرسال» يتم نسخ رسالتك تلقائياً وفتح محادثة @' + esc(TG) + ' — الصقها واضغط إرسال.</p></div>');
    var type = 'اقتراح';
    pillGroup(main.querySelector('#fbT'), function (v) { type = v; });
    function text() {
      var m = main.querySelector('#fbMsg').value.trim();
      if (!m) { toast('اكتب رسالتك أولاً'); return null; }
      var nm = main.querySelector('#fbName').value.trim();
      return '📩 [' + type + '] منصة IFCE\n' + (nm ? 'الاسم: ' + nm + '\n' : '') + 'الرسالة: ' + m + '\nالصفحة: ' + location.href.split('#')[0];
    }
    main.querySelector('#fbSend').onclick = function (ev) {
      var t = text(); if (!t) { ev.preventDefault(); return; }
      copy(t).then(function () { toast('تم نسخ الرسالة ✓ الصقها في محادثة التيليجرام @' + TG); }, function () { toast('افتح المحادثة والصق رسالتك'); });
    };
    main.querySelector('#fbCopy').onclick = function () { var t = text(); if (t) copy(t).then(function () { toast('تم النسخ ✓'); }, function () { toast('تعذر النسخ، انسخ يدوياً'); }); };
  });

  /* ===== الحساب والمزامنة ===== */
  route('account', function () {
    var st = Store.get(), C = Store.Cloud, g = globalStats();
    var cloudBox;
    if (C.enabled && C.ready) {
      cloudBox = C.user
        ? '<div class="row"><span class="avatar">' + (C.user.photoURL ? '<img src="' + esc(C.user.photoURL) + '" alt="">' : esc((C.user.displayName || '؟')[0])) + '</span><div><b>' + esc(C.user.displayName || '') + '</b><div class="muted" style="font-size:.85rem">' + esc(C.user.email || '') + '</div></div></div>' +
          '<p>حالة المزامنة: <span class="chip ' + (C.status === 'synced' ? 'ok' : C.status === 'error' ? 'bad' : 'w') + '">' + ({ synced: 'متزامن ✓', syncing: 'جارٍ المزامنة…', error: 'خطأ' }[C.status] || C.status) + '</span></p>' +
          (C.error ? '<p class="muted" style="color:var(--err)">' + esc(C.error) + '</p>' : '') +
          '<div class="row"><button class="btn soft" id="acSync">مزامنة الآن</button><button class="btn ghost" id="acOut">تسجيل الخروج</button></div>'
        : '<p>سجّل الدخول بحساب Google ليتزامن تقدمك تلقائياً بين جوالك وحاسوبك.</p><button class="btn" id="acIn"><svg viewBox="0 0 24 24" style="stroke:none;fill:currentColor"><path d="M21.35 11.1H12v2.9h5.35c-.25 1.5-1.7 4.4-5.35 4.4-3.2 0-5.85-2.65-5.85-5.9S8.8 6.6 12 6.6c1.85 0 3.05.8 3.75 1.45l2.55-2.45C16.7 4.1 14.6 3.2 12 3.2 7.05 3.2 3.1 7.15 3.1 12.1S7.05 21 12 21c5.15 0 8.55-3.6 8.55-8.7 0-.6-.05-1.05-.2-1.2z"/></svg> تسجيل الدخول عبر Google</button>' + (C.error ? '<p class="muted" style="color:var(--err)">' + esc(C.error) + '</p>' : '');
    } else if (C.enabled && !C.ready) {
      cloudBox = '<p class="muted">جارٍ تحميل خدمة تسجيل الدخول…</p>';
    } else {
      cloudBox = '<p>يعمل الموقع الآن في <b>الوضع المحلي</b>: يُحفظ تقدمك تلقائياً في هذا المتصفح (حتى بعد إغلاقه). للانتقال لجهاز آخر استخدم <b>رمز المزامنة</b> بالأسفل.</p>' +
        (C.error ? '<p class="muted" style="color:var(--err)">' + esc(C.error) + '</p>' : '') +
        '<p class="muted" style="font-size:.85rem">تسجيل الدخول عبر Google يتفعّل بمجرد أن يضيف مدير الموقع إعدادات Firebase في ملف js/config.js.</p>';
    }
    html(crumbs([['الحساب والمزامنة']]) + '<h1>حسابي وتقدمي</h1><div class="grid g2">' +
      '<div class="card"><h3>الملف الشخصي</h3><div class="field"><label for="acName">اسمك (يظهر في الترحيب)</label><input id="acName" class="input" value="' + esc(st.profile.name) + '" maxlength="40"></div><button class="btn soft sm" id="acSave">حفظ الاسم</button>' +
      '<div style="margin-top:14px"><div class="kv"><span>أسئلة تمت محاولتها</span><b>' + g.seen + ' / ' + g.total + '</b></div><div class="kv"><span>دقة الإجابات</span><b>' + g.acc + '%</b></div><div class="kv"><span>دروس تم فهمها</span><b>' + g.lessons + ' / ' + g.lessonsTotal + '</b></div><div class="kv"><span>اختبارات محاكية</span><b>' + g.exams + '</b></div></div></div>' +
      '<div class="card"><h3>تسجيل الدخول والمزامنة السحابية</h3>' + cloudBox + '</div>' +
      '<div class="card"><h3>رمز المزامنة (نقل التقدم بين الأجهزة)</h3><p class="muted" style="font-size:.9rem">انسخ الرمز من هذا الجهاز، ثم الصقه في صفحة «حسابي» على الجهاز الآخر. يتم <b>دمج</b> التقدم دون حذف أي شيء.</p>' +
      '<div class="row"><button class="btn soft sm" id="acCopy">نسخ رمز تقدمي</button><button class="btn ghost sm" id="acFile">تنزيل نسخة احتياطية</button></div>' +
      '<div class="field" style="margin-top:12px"><label for="acCode">لصق رمز من جهاز آخر</label><textarea id="acCode" class="input" style="min-height:80px;direction:ltr" placeholder="IFCE4:..."></textarea></div><div class="row"><button class="btn sm" id="acImp">دمج التقدم</button><label class="btn ghost sm" style="cursor:pointer">استيراد ملف<input type="file" id="acUp" accept=".txt,.json" hidden></label></div></div>' +
      '<div class="card"><h3>إعادة الضبط</h3><p class="muted">حذف كل تقدمك المحفوظ على هذا الجهاز (لا يمكن التراجع).</p><button class="btn ghost sm" id="acReset" style="color:var(--err)">حذف التقدم</button></div></div>');
    main.querySelector('#acSave').onclick = function () { Store.setName(main.querySelector('#acName').value.trim()); toast('تم الحفظ ✓'); updateAvatar(); };
    main.querySelector('#acCopy').onclick = function () { copy(Store.exportCode()).then(function () { toast('تم نسخ الرمز ✓'); }, function () { main.querySelector('#acCode').value = Store.exportCode(); toast('انسخ الرمز من المربع'); }); };
    main.querySelector('#acFile').onclick = function () {
      var blob = new Blob([Store.exportCode()], { type: 'text/plain' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'ifce-progress-' + new Date().toISOString().slice(0, 10) + '.txt'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    main.querySelector('#acImp').onclick = function () { try { Store.importCode(main.querySelector('#acCode').value); toast('تم دمج التقدم ✓'); render(); } catch (e) { toast('الرمز غير صالح'); } };
    main.querySelector('#acUp').onchange = function () {
      var f = this.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () { try { Store.importCode(r.result); toast('تم دمج التقدم ✓'); render(); } catch (e) { toast('الملف غير صالح'); } }; r.readAsText(f);
    };
    main.querySelector('#acReset').onclick = function () { ask('هل أنت متأكد من حذف كل التقدم على هذا الجهاز؟', 'حذف التقدم', function () { Store.reset(); Quiz.clear(); toast('تم الحذف'); render(); }); };
    var bi = main.querySelector('#acIn'); if (bi) bi.onclick = function () { Store.Cloud.signIn().then(function () { toast('تم تسجيل الدخول ✓'); render(); }).catch(function (e) { toast('تعذر تسجيل الدخول'); Store.Cloud.error = e && e.message || ''; render(); }); };
    var bo = main.querySelector('#acOut'); if (bo) bo.onclick = function () { Store.Cloud.signOut().then(render); };
    var bs = main.querySelector('#acSync'); if (bs) bs.onclick = function () { Store.Cloud.pull(); toast('جارٍ المزامنة…'); };
  });

  route('more', function () {
    html('<h1>المزيد</h1><div class="grid g2">' + [
      ['#/maps', 'الخرائط الذهنية والمقارنات', 'خريطة شاملة، خرائط الفصول، جداول التمييز، الأرقام والمدد'],
      ['#/self', 'أسئلة الامتحان الذاتي', 'أسئلة نهاية كل فصل مع الشرح'],
      ['#/review', 'مراجعة أخطائي', 'التكرار المتباعد للأسئلة التي أخطأت فيها'],
      ['#/feedback', 'الاقتراحات والملاحظات', 'تواصل عبر تيليجرام @' + TG],
      ['#/account', 'حسابي والمزامنة', 'تسجيل الدخول، رمز المزامنة، النسخ الاحتياطي'],
      ['#/chapters', 'كل الفصول', '11 فصلاً بالدروس والمصطلحات']
    ].map(function (x) { return '<a class="card" style="text-decoration:none;color:inherit" href="' + x[0] + '"><h3>' + x[1] + '</h3><p class="muted" style="margin:0">' + x[2] + '</p></a>'; }).join('') + '</div>');
  });

  /* ===== البحث ===== */
  var SIDX = [];
  CH.forEach(function (c) {
    SIDX.push({ t: 'الفصل ' + c.id + ': ' + c.title, s: c.intro, h: '#/ch/' + c.id });
    c.lessons.forEach(function (l) { SIDX.push({ t: l.code + ' — ' + l.title, s: strip(l.points.join(' • ')), h: '#/ch/' + c.id + '/lessons/' + l.code, ch: c.id }); });
    c.terms.forEach(function (t) { SIDX.push({ t: t[0], s: t[1], h: '#/ch/' + c.id + '/terms', ch: c.id }); });
  });
  (IFCE.facts || []).forEach(function (f) { SIDX.push({ t: f[0], s: f[1], h: '#/maps/facts', ch: f[2] }); });
  function norm(s) { return String(s).replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }
  var layer = document.getElementById('searchLayer'), sinp = document.getElementById('searchInput'), sres = document.getElementById('searchResults');
  function openSearch() { layer.hidden = false; sinp.value = ''; sres.innerHTML = '<div class="muted" style="padding:12px">اكتب كلمتين على الأقل…</div>'; setTimeout(function () { sinp.focus(); }, 30); }
  function closeSearch() { layer.hidden = true; }
  document.getElementById('btnSearch').onclick = openSearch;
  layer.addEventListener('click', function (e) { if (e.target === layer) closeSearch(); });
  sres.addEventListener('click', function (e) { if (e.target.closest('a')) closeSearch(); });
  sinp.oninput = function () {
    var q = norm(sinp.value.trim()); if (q.length < 2) { sres.innerHTML = ''; return; }
    var words = q.split(/\s+/);
    var hits = SIDX.filter(function (x) { var t = norm(x.t + ' ' + x.s); return words.every(function (w) { return t.indexOf(w) > -1; }); }).slice(0, 40);
    sres.innerHTML = hits.map(function (x) {
      var snip = x.s, k = norm(snip).indexOf(words[0]); snip = snip.slice(Math.max(0, k - 50), k + 110);
      return '<a class="sr" href="' + x.h + '"><b>' + esc(x.t) + '</b><small>' + (x.ch ? 'الفصل ' + x.ch + ' • ' : '') + esc(snip) + '…</small></a>';
    }).join('') || '<div class="muted" style="padding:12px">لا توجد نتائج</div>';
  };

  /* ===== عناصر عامة ===== */
  function updateAvatar() {
    var av = document.getElementById('acctAvatar'), C = Store.Cloud, n = Store.get().profile.name;
    if (C.user && C.user.photoURL) av.innerHTML = '<img src="' + esc(C.user.photoURL) + '" alt="">';
    else av.textContent = (n || (C.user && C.user.displayName) || '؟').trim().charAt(0) || '؟';
  }
  document.getElementById('btnTheme').onclick = function () {
    var root = document.documentElement, cur = root.getAttribute('data-theme');
    if (!cur) cur = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var nx = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', nx); ls('ifce4_theme', nx);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', nx === 'dark' ? '#0b1220' : '#0f3d91');
    main.querySelectorAll('.mm').forEach(function (m) { if (m._draw) m._draw(); });
  };
  document.getElementById('btnBack').onclick = function () { if (history.length > 1) history.back(); else go('#/'); };
  document.getElementById('btnFwd').onclick = function () { history.forward(); };
  document.getElementById('yr').textContent = new Date().getFullYear();

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !layer.hidden) return closeSearch();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return openSearch(); }
    if (parse().name !== 'quiz' || /input|textarea|select/i.test((e.target.tagName || ''))) return;
    var S = Quiz.state(); if (!S || S.done) return;
    if (/^[1-4]$/.test(e.key)) { Quiz.answer(+e.key - 1); renderQ(Quiz.state()); }
    else if (e.key === 'ArrowLeft') { var n = document.getElementById('qNext'); if (n) n.click(); }
    else if (e.key === 'ArrowRight') { var p = document.getElementById('qPrev'); if (p && !p.disabled) p.click(); }
  });

  Store.onChange(function () { updateAvatar(); });
  window.addEventListener('hashchange', render);
  Store.Cloud.init().then(function (on) { if (on && /^#\/account/.test(location.hash)) render(); });
  var lastCloud = '';
  Store.onChange(function () {
    var C = Store.Cloud, sig = (C.user ? C.user.uid : '') + '|' + C.status + '|' + C.error;
    if (sig === lastCloud) return; lastCloud = sig;
    var ae = document.activeElement;
    if (/^#\/account/.test(location.hash) && !(ae && /input|textarea/i.test(ae.tagName))) render();
  });
  render();
})();
