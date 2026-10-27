/* نبضة جاهزة تتضاف لأي موقع يستخدم مشروع سوبابيز.
   قبل هذا الملف في الصفحة:
   <script>window.HR_BEAT = { url: 'https://xxxx.supabase.co', key: 'المفتاح العام' };</script>
   <script src="hr-beat.js"></script>
   بتبعت طلب صغير مرة واحدة كل 24 ساعة لكل متصفح. المفتاح العام فقط، ممنوع المفتاح السري. */
(function () {
  var C = window.HR_BEAT;
  if (!C || !C.url || !C.key) return;
  if (/^sb_secret_/.test(C.key)) return;
  try {
    var k = 'hr-beat:' + C.url, last = Number(localStorage.getItem(k)) || 0;
    if (Date.now() - last < 864e5) return;
    localStorage.setItem(k, String(Date.now()));
    var h = { apikey: C.key };
    if (/^eyJ/.test(C.key)) h.Authorization = 'Bearer ' + C.key;
    fetch(C.url.replace(/\/$/, '') + '/rest/v1/heartbeat?select=id&limit=1', { headers: h, cache: 'no-store' }).catch(function () {});
  } catch (e) {}
})();
