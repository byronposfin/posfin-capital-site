<script id="posfin-desktop-autofill-fix-20260922">
(function () {
  // Desktop autofill safeguard. Browsers can visually autofill React-controlled
  // fields without firing the input/change events used for step validation.
  // This gently re-emits events after autofill/page focus so Continue can work.
  function emit(el) {
    if (!el || el.disabled || el.type === 'hidden') return;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }
  function sync(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('input, textarea, select'), function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) emit(el);
        return;
      }
      if ((el.value || '').trim && (el.value || '').trim() !== '') emit(el);
    });
  }
  function scheduleSync() {
    [60, 180, 450, 900, 1500].forEach(function (ms) { setTimeout(function () { sync(document); }, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync);
  else scheduleSync();
  window.addEventListener('pageshow', scheduleSync);
  window.addEventListener('focus', function () { setTimeout(function () { sync(document); }, 100); });
  document.addEventListener('animationstart', function (e) {
    if (e && /auto/i.test(e.animationName || '')) scheduleSync();
  }, true);
  document.addEventListener('click', function () { setTimeout(function () { sync(document); }, 30); }, true);
})();
</script>
