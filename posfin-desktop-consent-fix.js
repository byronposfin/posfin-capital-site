<script id="posfin-desktop-consent-fix-20260922">
(function () {
  // Desktop safeguard for the React/Next-style Posfin multi-step forms.
  // Some built pages render the GDPR checkbox as sr-only with a custom square;
  // this bridge ensures mouse/trackpad clicks on the label/square update the
  // actual checkbox AND dispatch events React listens for before Continue runs.
  function textOf(el) {
    return (el && el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function isConsentLabel(label) {
    if (!label || label.dataset.posfinDesktopConsentFix === '1') return false;
    var txt = textOf(label);
    return txt.indexOf('i agree to be contacted by posfin capital') !== -1 ||
           txt.indexOf('agree to be contacted by posfin capital') !== -1 ||
           txt.indexOf('consent to posfin capital') !== -1;
  }
  function dispatchCheckboxEvents(input) {
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    try { input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
  }
  function hardSetChecked(input, checked) {
    var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    var desc = proto && Object.getOwnPropertyDescriptor(proto, 'checked');
    if (desc && desc.set) desc.set.call(input, checked);
    else input.checked = checked;
    dispatchCheckboxEvents(input);
  }
  function enhance(root) {
    (root || document).querySelectorAll('label').forEach(function (label) {
      if (!isConsentLabel(label)) return;
      var input = label.querySelector('input[type="checkbox"]');
      if (!input) return;
      label.dataset.posfinDesktopConsentFix = '1';
      label.style.cursor = 'pointer';
      input.setAttribute('aria-label', 'I agree to be contacted by Posfin Capital');
      input.setAttribute('data-posfin-consent', '1');
      // Make the checkbox technically focusable/clickable even if Tailwind sr-only is present.
      if ((input.className || '').indexOf('sr-only') !== -1) {
        input.style.position = 'absolute';
        input.style.width = '24px';
        input.style.height = '24px';
        input.style.opacity = '0.01';
        input.style.pointerEvents = 'auto';
        input.style.margin = '0';
      }
      label.addEventListener('pointerdown', function (event) {
        if (event.target && event.target.closest && event.target.closest('a')) return;
        // Let direct checkbox clicks pass; bridge all custom-square/text clicks.
        if (event.target === input) return;
        event.preventDefault();
        hardSetChecked(input, !input.checked);
      }, true);
      label.addEventListener('click', function (event) {
        if (event.target && event.target.closest && event.target.closest('a')) return;
        if (event.target === input) return;
        // Avoid double toggling after pointerdown; ensure current checked state emits React events.
        event.preventDefault();
        dispatchCheckboxEvents(input);
      }, true);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { enhance(document); });
  else enhance(document);
  try {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes || [], function (node) {
          if (node && node.nodeType === 1) enhance(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
</script>
