/* Lumo — micro-interactions: press ripples, sliding navigation indicator, animated page title. */
(() => {
  const SEL = '.btn, .choice, .mood, .fx-btn, .tool, .key, .step-item, .pick-card, .lib-card, .seg button, .react button, '
    + '.wslots button, .chain .node, .role button, .side .tabs button, .fx-chip, .kb-key, .blackout, .pp';
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(SEL);
    if (!el || el.disabled || e.button > 0) return;
    const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span');
    s.className = 'rip';
    s.style.width = s.style.height = `${size}px`;
    s.style.left = `${e.clientX - r.left - size / 2}px`;
    s.style.top = `${e.clientY - r.top - size / 2}px`;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    if (cs.overflow !== 'hidden') el.style.overflow = 'hidden';
    el.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }, { passive: true });

  // navigation: one highlight that springs to the active tab
  const tabs = document.querySelector('.side .tabs');
  if (tabs) {
    const ind = document.createElement('span');
    ind.className = 'nav-ind';
    tabs.prepend(ind);
    const move = () => {
      const b = tabs.querySelector('button.on'); if (!b) return;
      ind.style.transform = `translateY(${b.offsetTop}px)`;
      ind.style.height = `${b.offsetHeight}px`;
    };
    new MutationObserver(move).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
    window.addEventListener('resize', move);
    setTimeout(move, 60);
  }

  // page title slides in again whenever the page changes
  const title = document.querySelector('#pg-title'), pg = document.querySelector('.pg');
  if (title && pg) {
    new MutationObserver(() => {
      for (const el of pg.children) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    }).observe(title, { childList: true, characterData: true, subtree: true });
  }
})();

/* sliders: the part left of the thumb is filled (CSS reads --p) */
(() => {
  const fill = (el) => {
    const min = Number(el.min) || 0, max = Number(el.max) || 100, v = Number(el.value);
    el.style.setProperty('--p', `${Math.max(0, Math.min(100, ((v - min) / ((max - min) || 1)) * 100))}%`);
  };
  document.addEventListener('input', (e) => { if (e.target.type === 'range') fill(e.target); }, true);
  const all = () => { for (const el of document.querySelectorAll('input[type=range]')) fill(el); };
  setInterval(all, 350);
  all();
})();
