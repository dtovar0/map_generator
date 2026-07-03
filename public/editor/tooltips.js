// ════════════════════════════════════════════════════
// PREMIUM TOOLTIPS
// Upgrades native `title` attributes into a fast, styled tooltip.
// A title is migrated to data-tip the first time an element is hovered
// (and the attribute removed) so the slow native bubble never appears.
// Titles set later by other modules are re-captured on the next hover,
// which keeps toggled labels (e.g. tags, presentation) fresh.
// ════════════════════════════════════════════════════
(function initTooltips() {
  const tip = document.createElement('div');
  tip.id = 'ui-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);

  let showTimer = null;
  let pending = null;   // element we intend to describe
  let shown = null;     // element currently described

  function capture(el) {
    // Move a native title into data-tip so the OS tooltip never fires.
    const t = el.getAttribute('title');
    if (t) { el.dataset.tip = t; el.removeAttribute('title'); }
    return el.dataset.tip || '';
  }

  function position(el) {
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const gap = 9;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let placement = 'bottom';
    let top = r.bottom + gap;
    if (top + th > vh - 6) { placement = 'top'; top = r.top - gap - th; }
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, vw - tw - 8));
    tip.style.top = Math.round(top) + 'px';
    tip.style.left = Math.round(left) + 'px';
    const arrowX = r.left + r.width / 2 - left;
    tip.style.setProperty('--arrow-x', Math.max(12, Math.min(arrowX, tw - 12)) + 'px');
    tip.dataset.placement = placement;
  }

  function show(el) {
    const text = capture(el);
    if (!text) return;
    shown = el;
    tip.textContent = text;
    position(el);          // measurable: element is always laid out, only opacity toggles
    tip.classList.add('visible');
    tip.setAttribute('aria-hidden', 'false');
  }

  function hide() {
    clearTimeout(showTimer); showTimer = null;
    pending = shown = null;
    tip.classList.remove('visible');
    tip.setAttribute('aria-hidden', 'true');
  }

  function target(node) {
    return node && node.closest ? node.closest('[title],[data-tip]') : null;
  }

  document.addEventListener('mouseover', e => {
    const el = target(e.target);
    if (!el || el === pending) return;
    capture(el);                       // strip title now, before the native ~1s delay
    clearTimeout(showTimer);
    pending = el;
    showTimer = setTimeout(() => show(el), 320);
  });

  document.addEventListener('mouseout', e => {
    if (!pending && !shown) return;
    const to = e.relatedTarget;
    const anchor = shown || pending;
    if (to && anchor && anchor.contains(to)) return;   // moving within the same anchor
    hide();
  });

  document.addEventListener('focusin', e => {
    const el = target(e.target);
    if (el) show(el);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('mousedown', hide, true);
  document.addEventListener('ui-tooltip-hide', hide);
  window.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
})();
