/* Lumo — Przyciski i MIDI
 *
 * Any keyboard key or MIDI controller button / knob → an action. Bindings are saved on the
 * server (config.json → "bindings"). "Naucz" = press the key / pad / turn the knob you want.
 * Modes: press (once) · hold (while held: flash, strobe, blackout) · knob (MIDI CC → master, dimmer, tempo).
 */
(() => {
  const PH = window.PH;
  const { S, send, t, toast, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'kb.add': 'Dodaj przycisk', 'kb.learn': 'Naciśnij klawisz lub przycisk MIDI…', 'kb.press': 'naciśnij', 'kb.hold': 'przytrzymaj',
      'kb.knob': 'pokrętło', 'kb.empty': 'Brak przypisanych przycisków — kliknij „Dodaj przycisk”.',
      'kb.midi': 'Połącz kontroler MIDI', 'kb.midiOn': 'MIDI: {n}', 'kb.midiNone': 'MIDI: brak urządzeń', 'kb.midiNo': 'Ta przeglądarka nie obsługuje MIDI',
      'kb.built': 'Stałe skróty', 'kb.taken': 'Ten klawisz jest zajęty przez stały skrót',
      'kb.set': 'Przypisano: {k}',
      'ka.blackout': 'Blackout', 'ka.flash': 'Flash', 'ka.strobe': 'Strobo', 'ka.full': 'Pełna jasność', 'ka.dark': 'Wygaś',
      'ka.home': 'Lampy na środek', 'ka.next_fixture': 'Następna lampa', 'ka.color': 'Kolor', 'ka.effect': 'Efekt (wł./wył.)',
      'ka.stop_effects': 'Zatrzymaj efekty', 'ka.spotlight': 'Reflektor na osobę', 'ka.autopilot': 'Autopilot / styl',
      'ka.master': 'Master (pokrętło)', 'ka.dimmer': 'Jasność lampy (pokrętło)', 'ka.fx_speed': 'Tempo efektów (pokrętło)',
      'kb.b': 'B = blackout', 'kb.h': 'H = lampy na środek', 'kb.n': '1–9 = wybór lampy', 'kb.m': 'G / T / M = gesty / śledzenie / ręcznie', 'kb.sp': 'Spacja = start / pauza utworu',
    },
    it: {
      'kb.add': 'Aggiungi tasto', 'kb.learn': 'Premi un tasto o un pulsante MIDI…', 'kb.press': 'premi', 'kb.hold': 'tieni premuto',
      'kb.knob': 'manopola', 'kb.empty': 'Nessun tasto assegnato — clicca „Aggiungi tasto”.',
      'kb.midi': 'Collega controller MIDI', 'kb.midiOn': 'MIDI: {n}', 'kb.midiNone': 'MIDI: nessun dispositivo', 'kb.midiNo': 'Questo browser non supporta il MIDI',
      'kb.built': 'Scorciatoie fisse', 'kb.taken': 'Questo tasto è già usato da una scorciatoia fissa',
      'kb.set': 'Assegnato: {k}',
      'ka.blackout': 'Blackout', 'ka.flash': 'Flash', 'ka.strobe': 'Strobo', 'ka.full': 'Luce piena', 'ka.dark': 'Spegni',
      'ka.home': 'Luci al centro', 'ka.next_fixture': 'Luce successiva', 'ka.color': 'Colore', 'ka.effect': 'Effetto (on/off)',
      'ka.stop_effects': 'Ferma effetti', 'ka.spotlight': 'Occhio di bue', 'ka.autopilot': 'Autopilota / stile',
      'ka.master': 'Master (manopola)', 'ka.dimmer': 'Luminosità luce (manopola)', 'ka.fx_speed': 'Tempo effetti (manopola)',
      'kb.b': 'B = blackout', 'kb.h': 'H = luci al centro', 'kb.n': '1–9 = scegli luce', 'kb.m': 'G / T / M = gesti / inseguimento / manuale', 'kb.sp': 'Spazio = play / pausa brano',
    },
  });

  const ACTIONS = ['blackout', 'flash', 'strobe', 'full', 'dark', 'home', 'next_fixture', 'color', 'effect', 'stop_effects',
    'spotlight', 'autopilot', 'master', 'dimmer', 'fx_speed'];
  const KNOB = new Set(['master', 'dimmer', 'fx_speed']);
  const BUILTIN = new Set(['KeyB', 'KeyH', 'KeyG', 'KeyT', 'KeyM', 'Space', 'Escape', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']);
  const K = { learn: null, list: [], midi: null, midiNames: [], held: new Set(), sig: '' };

  const bindings = () => (S.st && S.st.bindings) || [];
  const save = (list) => send({ type: 'bindings', list });
  const label = (b) => (!b.code ? '—' : b.code.startsWith('note:') ? `MIDI ♪ ${b.code.slice(5)}` : b.code.startsWith('cc:') ? `MIDI ⟲ ${b.code.slice(3)}`
    : b.code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num '));

  /* ------------------------------------------------------------ run an action */
  function fire(b, down, value) {
    const id = `key-${b.id}`, p = b.params || {};
    switch (b.action) {
      case 'blackout':
        if (b.mode === 'hold') send({ type: 'blackout', value: down });
        else if (down) send({ type: 'blackout', value: !(S.st && S.st.blackout) });
        break;
      case 'flash':
        if (b.mode === 'hold') { if (down) send({ type: 'fx_start', id, kind: 'hit', params: { strength: 1, curve: 0.01 }, targets: 'all', duration: 30 }); else send({ type: 'fx_stop', id }); }
        else if (down) send({ type: 'fx_start', id, kind: 'hit', params: { strength: 1, curve: 2 }, targets: 'all', duration: 0.6 });
        break;
      case 'strobe':
        if (b.mode === 'hold') { if (down) send({ type: 'fx_start', id, kind: 'strobe', params: { speed: 230 }, targets: 'all', duration: 30 }); else send({ type: 'fx_stop', id }); }
        else if (down) send({ type: 'fx_start', id, kind: 'strobe', params: { speed: 230 }, targets: 'all', duration: 2 });
        break;
      case 'master': if (value != null) send({ type: 'grand_master', value: Math.round(value * 255) }); break;
      case 'dimmer': if (value != null) { const f = PH.activeFx(); if (f) send({ type: 'set', id: f.id, param: 'dimmer', value: Math.round(value * 255) }); } break;
      case 'fx_speed': if (value != null) send({ type: 'fx_speed', value }); break;
      case 'color': if (down) send({ type: 'gesture_test', action: 'color', params: { rgb: p.rgb || [255, 0, 80] } }); break;
      case 'effect': if (down) send({ type: 'gesture_test', action: 'effect', params: { kind: p.kind || 'circle' } }); break;
      case 'autopilot': if (down) send({ type: 'gesture_test', action: 'autopilot', params: { mood: p.mood || null } }); break;
      default: if (down) send({ type: 'gesture_test', action: b.action, params: p });
    }
    const row = $(`.kb-row[data-id="${b.id}"]`);
    if (row && down !== false) { row.classList.remove('fired'); void row.offsetWidth; row.classList.add('fired'); }
  }
  function handleInput(code, down, value) {
    if (K.learn) {
      if (!down) return true;
      if (BUILTIN.has(code)) { toast(t('kb.taken'), 'warn'); return true; }
      const list = bindings().map((b) => (b.id === K.learn ? { ...b, code, mode: code.startsWith('cc:') ? 'knob' : (b.mode === 'knob' ? 'press' : b.mode), action: code.startsWith('cc:') && !KNOB.has(b.action) ? 'master' : b.action } : b));
      K.learn = null; save(list);
      toast(t('kb.set', { k: label({ code }) }));
      return true;
    }
    let used = false;
    for (const b of bindings()) {
      if (b.code !== code) continue;
      used = true;
      if (b.mode === 'knob') fire(b, true, value);
      else if (down) { if (!K.held.has(b.id)) { K.held.add(b.id); fire(b, true); } }
      else { K.held.delete(b.id); if (b.mode === 'hold') fire(b, false); }
    }
    return used;
  }

  /* ------------------------------------------------------------ keyboard */
  const typing = (e) => e.target.closest && e.target.closest('input, select, textarea, [contenteditable]');
  window.addEventListener('keydown', (e) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (K.learn && e.code === 'Escape') { K.learn = null; K.sig = ''; return; }
    if (handleInput(e.code, true)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('keyup', (e) => { if (!typing(e)) handleInput(e.code, false); }, true);

  /* ------------------------------------------------------------ MIDI */
  async function connectMidi(quiet) {
    if (!navigator.requestMIDIAccess) { if (!quiet) toast(t('kb.midiNo'), 'warn'); return; }
    try {
      K.midi = await navigator.requestMIDIAccess();
      const attach = () => {
        K.midiNames = [];
        for (const inp of K.midi.inputs.values()) { K.midiNames.push(inp.name); inp.onmidimessage = onMidi; }
        K.sig = '';
      };
      attach();
      K.midi.onstatechange = attach;
      try { localStorage.setItem('ph_midi', '1'); } catch (e) { /* ignore */ }
    } catch (e) { if (!quiet) toast(`MIDI: ${e.message}`, 'err'); }
  }
  function onMidi(ev) {
    const [st, d1, d2] = ev.data, type = st & 0xf0;
    if (type === 0x90 && d2 > 0) handleInput(`note:${d1}`, true);
    else if (type === 0x80 || (type === 0x90 && d2 === 0)) handleInput(`note:${d1}`, false);
    else if (type === 0xb0) handleInput(`cc:${d1}`, true, d2 / 127);
  }
  try { if (localStorage.getItem('ph_midi') === '1') connectMidi(true); } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------ editor (Konfiguracja → Przyciski i MIDI) */
  PH.renderKeys = (box, st, force) => {
    const list = bindings();
    const sig = JSON.stringify([list, K.learn, K.midiNames, PH.lang, (PH.fxCatalogue ? PH.fxCatalogue().length : 0)]);
    if (!force && sig === K.sig) return;
    if (box.contains(document.activeElement) && ['SELECT', 'INPUT'].includes(document.activeElement.tagName)) return;
    K.sig = sig;
    const fx = PH.fxCatalogue ? PH.fxCatalogue().filter(([k]) => !['position', 'dark', 'kicks'].includes(k)) : [];
    const param = (b) => {
      if (b.action === 'color') return `<input type="color" data-pc="${b.id}" value="#${(b.params && b.params.rgb ? b.params.rgb : [255, 0, 80]).map((v) => v.toString(16).padStart(2, '0')).join('')}">`;
      if (b.action === 'effect') return `<select data-pe="${b.id}">${fx.map(([k, n]) => `<option value="${esc(k)}" ${b.params && b.params.kind === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
      if (b.action === 'autopilot') return `<select data-pm="${b.id}"><option value="">—</option>${['calm', 'dynamic', 'dance', 'rave'].map((m) => `<option value="${m}" ${b.params && b.params.mood === m ? 'selected' : ''}>${esc(t(`mood.${m}`))}</option>`).join('')}</select>`;
      return '<span></span>';
    };
    const modes = (b) => (KNOB.has(b.action) ? `<span class="tagc">${esc(t('kb.knob'))}</span>`
      : `<select data-pmode="${b.id}"><option value="press" ${b.mode !== 'hold' ? 'selected' : ''}>${esc(t('kb.press'))}</option>${['blackout', 'flash', 'strobe'].includes(b.action) ? `<option value="hold" ${b.mode === 'hold' ? 'selected' : ''}>${esc(t('kb.hold'))}</option>` : ''}</select>`);
    box.innerHTML = `<div class="st-actions">
        <button class="btn primary" id="kb-add">${ic('plus')}<span>${esc(t('kb.add'))}</span></button>
        <button class="btn" id="kb-midi">${ic('midi')}<span>${esc(t('kb.midi'))}</span></button>
        <span class="midi-st ${K.midiNames.length ? 'on' : ''}"><i></i>${esc(K.midi ? (K.midiNames.length ? t('kb.midiOn', { n: K.midiNames.join(', ') }) : t('kb.midiNone')) : '')}</span></div>
      <div class="kb-list">${list.length ? list.map((b) => `<div class="kb-row" data-id="${b.id}">
          <button class="kb-key${K.learn === b.id ? ' learn' : ''}" data-learn="${b.id}">${K.learn === b.id ? esc(t('kb.learn')) : esc(label(b))}</button>
          <select data-pa="${b.id}">${ACTIONS.map((a) => `<option value="${a}" ${b.action === a ? 'selected' : ''}>${esc(t(`ka.${a}`))}</option>`).join('')}</select>
          ${param(b)}${modes(b)}
          <button class="btn sm danger-t" data-pdel="${b.id}">${ic('trash')}</button></div>`).join('') : `<div class="st-status">${ic('info')} ${esc(t('kb.empty'))}</div>`}</div>
      <div class="sec-t">${esc(t('kb.built'))}</div>
      <div class="pc-pts">${['kb.b', 'kb.h', 'kb.n', 'kb.m', 'kb.sp'].map((k) => `<span style="background:var(--well);color:var(--dim)">${esc(t(k))}</span>`).join('')}</div>`;
    const upd = (id, patch) => save(bindings().map((b) => (b.id === id ? { ...b, ...patch, params: { ...(b.params || {}), ...(patch.params || {}) } } : b)));
    $('#kb-add', box).onclick = () => {
      const id = Math.random().toString(36).slice(2, 8);
      K.learn = id;
      save([...bindings(), { id, code: '', action: 'flash', mode: 'press', params: {} }]);
    };
    $('#kb-midi', box).onclick = () => connectMidi(false);
    for (const el of $$('[data-learn]', box)) el.onclick = () => { K.learn = K.learn === el.dataset.learn ? null : el.dataset.learn; K.sig = ''; PH.renderKeys(box, st, true); };
    for (const el of $$('[data-pa]', box)) el.onchange = () => upd(el.dataset.pa, { action: el.value, mode: KNOB.has(el.value) ? 'knob' : 'press' });
    for (const el of $$('[data-pmode]', box)) el.onchange = () => upd(el.dataset.pmode, { mode: el.value });
    for (const el of $$('[data-pc]', box)) el.onchange = () => upd(el.dataset.pc, { params: { rgb: [1, 3, 5].map((i) => parseInt(el.value.slice(i, i + 2), 16)) } });
    for (const el of $$('[data-pe]', box)) el.onchange = () => upd(el.dataset.pe, { params: { kind: el.value } });
    for (const el of $$('[data-pm]', box)) el.onchange = () => upd(el.dataset.pm, { params: { mood: el.value || null } });
    for (const el of $$('[data-pdel]', box)) el.onclick = () => save(bindings().filter((b) => b.id !== el.dataset.pdel));
  };
})();
