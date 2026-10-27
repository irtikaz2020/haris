(function () {
  'use strict';
  var KEY = 'hr:state', app = document.getElementById('app'), toastEl = document.getElementById('toast'), tt;
  var DAYS = 7, S = load();

  function load() { try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && Array.isArray(v.projects)) return v; } catch (e) {} return { projects: [], autoBeat: true }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { say('تعذّر الحفظ في المتصفح', true); } }
  function say(t, bad) { clearTimeout(tt); toastEl.textContent = t; toastEl.className = 'toast show' + (bad ? ' bad' : ''); tt = setTimeout(function () { toastEl.className = 'toast'; }, 4500); }
  function add(n, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(n, x); }); else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { var v = attrs[k]; if (v == null || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'قبل لحظات'; if (m < 60) return 'قبل ' + m + ' دقيقة';
    var h = Math.round(m / 60); if (h < 48) return 'قبل ' + h + ' ساعة';
    return 'قبل ' + Math.round(h / 24) + ' يوم';
  }
  /* حماية: نمنع المفتاح السري تماماً */
  function keyProblem(k) {
    if (!k) return 'اكتب المفتاح العام.';
    if (/^sb_secret_/i.test(k)) return 'ده مفتاح سري. ممنوع. استخدم المفتاح العام (publishable أو anon).';
    if (/^eyJ/.test(k)) {
      try { var p = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (p.role && p.role !== 'anon') return 'المفتاح ده دوره ' + p.role + ' مش anon. ممنوع. استخدم المفتاح العام.'; } catch (e) { return 'شكل المفتاح مش مفهوم.'; }
    } else if (!/^sb_publishable_/i.test(k)) return 'المفتاح لازم يبدأ بـ sb_publishable_ أو يكون مفتاح anon.';
    return '';
  }
  function urlProblem(u) { return /^https:\/\/[a-z0-9]{8,30}\.supabase\.co\/?$/i.test(u) ? '' : 'الرابط لازم يكون بالشكل https://xxxx.supabase.co'; }

  function beat(p) {
    var t0 = Date.now(), ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 15000);
    var h = { apikey: p.key }; if (/^eyJ/.test(p.key)) h.Authorization = 'Bearer ' + p.key;
    return fetch(p.url.replace(/\/$/, '') + '/rest/v1/heartbeat?select=id&limit=1', { headers: h, cache: 'no-store', signal: ctl.signal }).then(function (r) {
      clearTimeout(to);
      var o = { t: Date.now(), ms: Date.now() - t0, code: r.status, ok: r.ok, msg: '' };
      if (r.ok) o.msg = 'نجح';
      else if (r.status === 404) o.msg = 'الجدول heartbeat مش موجود. شغّل ملف hr-setup.sql.';
      else if (r.status === 401 || r.status === 403) o.msg = 'المفتاح مرفوض أو الجدول من غير صلاحية قراءة.';
      else o.msg = 'رد غير متوقع (' + r.status + ').';
      return o;
    }).catch(function () { clearTimeout(to); return { t: Date.now(), ms: Date.now() - t0, code: 0, ok: false, msg: 'تعذّر الوصول. ممكن المشروع متوقف أو الإنترنت واقف.' }; })
      .then(function (o) { p.beats = (p.beats || []); p.beats.unshift(o); p.beats = p.beats.slice(0, 20); if (o.ok) p.lastOk = o.t; p.lastTry = o.t; save(); return o; });
  }
  function beatAll(force) {
    var list = S.projects.filter(function (p) { return force || !p.lastTry || Date.now() - p.lastTry > 30 * 60000; });
    return Promise.all(list.map(beat)).then(function () { render(); });
  }
  function status(p) {
    if (!p.lastTry) return ['none', 'لم يُنبَض بعد'];
    var last = p.beats && p.beats[0];
    if (last && last.ok) return ['ok', 'شغّال'];
    if (last && last.code === 0) return ['warn', 'تعذّر الوصول'];
    return ['bad', 'في مشكلة'];
  }
  function est(p) {
    if (!p.lastOk) return 'مفيش نبضة ناجحة لسه، فمقدرش أحسب.';
    var left = DAYS - (Date.now() - p.lastOk) / 864e5;
    if (left <= 0) return 'عدّت ' + DAYS + ' أيام على آخر نبضة ناجحة. ابعت نبضة دلوقتي. (ده تقدير، سوبابيز بيحكم بكمية النشاط مش بيوم محدد.)';
    return 'آخر نبضة ناجحة ' + ago(p.lastOk) + '. تقدير تقريبي: حوالي ' + Math.floor(left) + ' يوم قبل ما تبدأ نقطة الخطر. (تقدير مني، مش رقم رسمي من سوبابيز.)';
  }

  function card(p) {
    var st = status(p), busy = false;
    var b = el('button', { class: 'btn primary', text: 'نبض الآن' });
    b.addEventListener('click', function () { if (busy) return; busy = true; b.disabled = true; b.textContent = 'جاري النبض…'; beat(p).then(function (o) { say(o.ok ? 'نجحت النبضة' : o.msg, !o.ok); render(); }); });
    var log = el('div', { class: 'log' });
    (p.beats || []).slice(0, 5).forEach(function (o, i) { log.appendChild(el('div', { text: (i + 1) + '. ' + ago(o.t) + ' — ' + (o.ok ? 'نجحت' : o.msg) + (o.ms ? ' (' + o.ms + ' م.ث)' : '') })); });
    return el('div', { class: 'card' },
      el('div', { class: 'row', style: 'justify-content:space-between' }, el('h2', { text: p.name }), el('span', { class: 'pill ' + st[0], text: st[1] })),
      el('div', { class: 'hint', style: 'direction:ltr;text-align:left', text: p.url }),
      el('div', { class: 'est', text: est(p) }),
      el('div', { class: 'row' }, b, el('button', { class: 'btn danger', text: 'حذف', onclick: function () { if (confirm('حذف «' + p.name + '» من الأداة؟ (لا يحذف المشروع في سوبابيز)')) { S.projects = S.projects.filter(function (x) { return x !== p; }); save(); render(); } } })),
      (p.beats || []).length ? log : null);
  }

  function addForm() {
    var n = el('input', { type: 'text', placeholder: 'مثلاً: ارتكاز-حساب' }), u = el('input', { type: 'url', dir: 'ltr', placeholder: 'https://xxxx.supabase.co' }), k = el('input', { type: 'text', dir: 'ltr', placeholder: 'sb_publishable_…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }), err = el('div', { class: 'hint', style: 'color:var(--bad)' });
    return el('div', { class: 'card' }, el('h2', { text: 'إضافة مشروع' }),
      el('label', { text: '1. الاسم' }), n, el('label', { text: '2. رابط المشروع' }), u,
      el('label', { text: '3. المفتاح العام (publishable أو anon)' }), k,
      el('div', { class: 'hint', text: 'المفتاح العام ظاهر في كود أي موقع بطبيعته، فمفيش مشكلة. أما المفتاح السري (secret أو service_role) فالأداة هترفضه، وما تكتبوش في أي مكان.' }),
      err,
      el('div', { class: 'row', style: 'margin-top:10px' }, el('button', { class: 'btn primary', text: 'إضافة ونبض', onclick: function () {
        var name = n.value.trim(), url = u.value.trim(), key = k.value.trim();
        var e = !name ? 'اكتب اسم.' : (urlProblem(url) || keyProblem(key));
        if (e) { err.textContent = e; return; }
        var p = { id: Date.now().toString(36), name: name, url: url.replace(/\/$/, ''), key: key, added: Date.now(), beats: [] };
        S.projects.push(p); save(); say('أُضيف. بنبض دلوقتي…'); beat(p).then(function (o) { say(o.ok ? 'نجحت أول نبضة' : o.msg, !o.ok); render(); });
      } })));
  }

  function backup() {
    var ta = el('textarea', { 'aria-label': 'نسخة احتياطية' });
    ta.value = JSON.stringify({ projects: S.projects.map(function (p) { return { name: p.name, url: p.url, key: p.key }; }) }, null, 1);
    return el('details', { class: 'card' }, el('summary', { text: 'نسخة احتياطية واستيراد' }),
      el('div', { class: 'hint', text: 'انسخ النص ده واحفظه عندك. للاستيراد: الصق نص قديم مكانه واضغط استيراد. مفيهوش غير الأسماء والروابط والمفاتيح العامة.' }), ta,
      el('div', { class: 'row', style: 'margin-top:8px' }, el('button', { class: 'btn', text: 'استيراد', onclick: function () {
        try {
          var d = JSON.parse(ta.value), c = 0;
          (d.projects || []).forEach(function (q) { if (q && q.name && !urlProblem(q.url) && !keyProblem(q.key) && !S.projects.some(function (x) { return x.url === q.url; })) { S.projects.push({ id: Date.now().toString(36) + c, name: q.name, url: q.url.replace(/\/$/, ''), key: q.key, added: Date.now(), beats: [] }); c++; } });
          save(); say('استُورد ' + c + ' مشروع'); render();
        } catch (e) { say('النص مش صالح', true); }
      } })));
  }

  function render() {
    app.textContent = '';
    app.appendChild(el('div', { class: 'card' }, el('h2', { text: 'إزاي بتشتغل' }),
      el('div', { class: 'hint', text: 'الأداة بتبعت «نبضة»: طلب قراءة صغير جداً لقاعدة بيانات مشروعك. سوبابيز بيوقف المشروع المجاني لو نشاطه قليل أسبوع. النبضة بتحسب نشاط. الأداة بتنبض تلقائياً كل ما تفتحها، لكنها مش بتشتغل وهي مقفولة.' })));
    if (!S.projects.length) app.appendChild(el('div', { class: 'card hint', text: 'لسه ما أضفتش مشروع. شغّل ملف hr-setup.sql في سوبابيز الأول، وبعدها أضف المشروع تحت.' }));
    S.projects.forEach(function (p) { app.appendChild(card(p)); });
    if (S.projects.length > 1) app.appendChild(el('div', { class: 'row' }, el('button', { class: 'btn', text: 'نبض كل المشاريع', onclick: function () { say('جاري النبض…'); beatAll(true); } })));
    app.appendChild(addForm());
    var cb = el('input', { type: 'checkbox', id: 'ab' }); cb.checked = !!S.autoBeat; cb.addEventListener('change', function () { S.autoBeat = cb.checked; save(); });
    app.appendChild(el('div', { class: 'card' }, el('div', { class: 'row' }, cb, el('label', { for: 'ab', style: 'margin:0', text: 'نبض تلقائي لما أفتح الأداة' }))));
    app.appendChild(backup());
    app.appendChild(el('footer', { text: 'حارس — من ارتكاز' }));
  }

  render();
  if (S.autoBeat && S.projects.length) beatAll(false);
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('hr-sw.js').catch(function () {});
})();
