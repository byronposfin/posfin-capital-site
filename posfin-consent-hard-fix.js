<script id="posfin-consent-hard-fix-20260922">
(function () {
  // HARD FIX: make Posfin consent reliable on desktop/mobile/autofill.
  // Some pages use a React sr-only checkbox plus decorative square. On desktop,
  // the visual square/text can fail to update React state until repeated clicks or repaint.
  // This inserts a real visible proxy checkbox and one-way syncs it to the real input.
  var CONSENT_RE = /(i\s+agree\s+to\s+be\s+contacted\s+by\s+posfin\s+capital|agree\s+to\s+be\s+contacted\s+by\s+posfin\s+capital|consent\s+to\s+posfin\s+capital)/i;
  function textOf(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function emit(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }
  function setNativeChecked(input, checked) {
    if (!input) return;
    var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    var desc = proto && Object.getOwnPropertyDescriptor(proto, 'checked');
    if (desc && desc.set) desc.set.call(input, checked);
    else input.checked = checked;
    emit(input);
  }
  function findRealInput(label) {
    return label && label.querySelector && label.querySelector('input[type="checkbox"]');
  }
  function styleProxy(proxy) {
    proxy.type = 'checkbox';
    proxy.setAttribute('aria-label', 'I agree to be contacted by Posfin Capital');
    proxy.style.width = '22px';
    proxy.style.height = '22px';
    proxy.style.minWidth = '22px';
    proxy.style.flexShrink = '0';
    proxy.style.margin = '1px 0 0 0';
    proxy.style.accentColor = '#00B5B0';
    proxy.style.cursor = 'pointer';
    proxy.style.appearance = 'auto';
    proxy.style.webkitAppearance = 'checkbox';
  }
  function enhanceLabel(label) {
    if (!label || label.dataset.posfinConsentHardFix === '1') return;
    if (!CONSENT_RE.test(textOf(label))) return;
    var real = findRealInput(label);
    if (!real) return;

    label.dataset.posfinConsentHardFix = '1';
    label.style.cursor = 'pointer';
    label.style.userSelect = 'none';
    label.style.webkitUserSelect = 'none';
    label.style.alignItems = 'flex-start';
    label.style.position = label.style.position || 'relative';

    // Keep real input in DOM for React/state, but remove it from the visual/click battle.
    real.setAttribute('data-posfin-real-consent', '1');
    real.setAttribute('aria-label', 'I agree to be contacted by Posfin Capital');
    real.style.position = 'absolute';
    real.style.left = '-9999px';
    real.style.width = '1px';
    real.style.height = '1px';
    real.style.opacity = '0';
    real.style.pointerEvents = 'none';

    // Hide decorative fake checkbox span if present.
    var n = real.nextElementSibling;
    if (n && !n.matches('span,svg')) n = null;
    if (n && (n.textContent || '').trim() === '') {
      n.style.display = 'none';
      n.setAttribute('aria-hidden', 'true');
    }

    var proxy = document.createElement('input');
    proxy.setAttribute('data-posfin-consent-proxy', '1');
    styleProxy(proxy);
    proxy.checked = !!real.checked;
    label.insertBefore(proxy, label.firstChild);

    function syncFromProxy() {
      setNativeChecked(real, proxy.checked);
      // Extra delayed emissions help React-controlled state and browser autofill races.
      setTimeout(function () { setNativeChecked(real, proxy.checked); }, 0);
      setTimeout(function () { setNativeChecked(real, proxy.checked); }, 60);
    }
    function tickTrue() {
      proxy.checked = true;
      syncFromProxy();
    }

    proxy.addEventListener('click', function (e) {
      e.stopPropagation();
      syncFromProxy();
    }, true);
    proxy.addEventListener('change', syncFromProxy, true);

    // Any click on the consent sentence means the user is consenting: tick it once.
    label.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('a')) return;
      if (e.target === proxy) return;
      e.preventDefault();
      tickTrue();
    }, true);
    label.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('a')) return;
      if (e.target === proxy) return;
      e.preventDefault();
      tickTrue();
    }, true);
  }
  function enhance(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('label'), enhanceLabel);
  }
  function autofillSync(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('input, textarea, select'), function (el) {
      if (!el || el.disabled || el.type === 'hidden') return;
      if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) emit(el); return; }
      if (String(el.value || '').trim() !== '') emit(el);
    });
  }
  function schedule() {
    enhance(document); autofillSync(document);
    [80, 200, 500, 1000, 1800].forEach(function (ms) {
      setTimeout(function () { enhance(document); autofillSync(document); }, ms);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  window.addEventListener('pageshow', schedule);
  window.addEventListener('focus', function () { setTimeout(schedule, 80); });
  document.addEventListener('click', function () { setTimeout(function () { autofillSync(document); }, 30); }, true);
  try {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes || [], function (node) {
          if (node && node.nodeType === 1) { enhance(node); autofillSync(node); }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
</script>
