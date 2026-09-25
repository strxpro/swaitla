/* Lumo — Mikser as a real lighting desk.
 *
 * One module per device, one fader per DMX channel, every fader says what it does.
 * Bank keys on top switch between "all devices at once" and a single device; the
 * group module on the left drives every light together. Faders are motorised: they
 * follow what the effects, gestures and the tracker do, and stop following while touched.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'dk.all': 'Wszystkie', 'dk.allS': 'urządzenia naraz', 'dk.group': 'Wszystkie lampy', 'dk.groupS': 'grupa — rusza każdą lampą',
      'dk.pick': 'Wybierz', 'dk.picked': 'Aktywna', 'dk.flash': 'Flash', 'dk.center': 'Środek', 'dk.hold': 'Trzymaj', 'dk.burst': 'Dym 3 s',
      'dk.empty': 'Brak urządzeń na pulpicie', 'dk.emptyS': 'Dodaj lampę, dym albo laser w Ustawieniach → Urządzenia. Każde urządzenie dostanie tu swoją sekcję z suwakami.',
      'dk.add': 'Dodaj urządzenie', 'dk.ch': 'kan.', 'dk.unused': 'nieużywany', 'dk.fixed': 'stała wartość', 'dk.locked': 'zablokowany',
      'dk.auto': 'z RGB', 'dk.tools': 'Aktywna lampa', 'dk.none': 'Kliknij sekcję urządzenia, żeby nim sterować tutaj.',
      'dk.zeroAll': 'Zeruj pulpit', 'dk.mode': 'Pokaż', 'dk.open': 'otwarte', 'dk.zeroQ': 'Wyzerować wszystkie urządzenia?', 'dk.compact': 'Kompakt', 'dk.sideT': 'Panel boczny', 'dk.grp': 'grupa',
      'dk.pan': 'Pan', 'dk.pan_fine': 'Pan fine', 'dk.tilt': 'Tilt', 'dk.tilt_fine': 'Tilt fine', 'dk.dimmer': 'Jasność', 'dk.shutter': 'Strobo',
      'dk.strobe': 'Strobo', 'dk.red': 'Czerwony', 'dk.green': 'Zielony', 'dk.blue': 'Niebieski', 'dk.white': 'Biały', 'dk.cwheel': 'Kolory',
      'dk.gobo': 'Gobo', 'dk.speed': 'Silniki', 'dk.spin': 'Obrót', 'dk.beam': 'Wiązka', 'dk.macro': 'Program', 'dk.strip': 'Pasek',
      'dk.strip_speed': 'Pasek tempo', 'dk.aux1': 'Aux 1', 'dk.aux2': 'Aux 2', 'dk.laser_r': 'Laser R', 'dk.laser_g': 'Laser G', 'dk.laser': 'Laser',
      'dk.none': '—', 'dk.const': 'Stały', 'dk.smoke': 'Dym', 'dk.smokeS': 'moc dymu', 'dk.man': 'ręcznie',
    },
    it: {
      'dk.all': 'Tutti', 'dk.allS': 'dispositivi insieme', 'dk.group': 'Tutte le luci', 'dk.groupS': 'gruppo — muove ogni luce',
      'dk.pick': 'Scegli', 'dk.picked': 'Attiva', 'dk.flash': 'Flash', 'dk.center': 'Centro', 'dk.hold': 'Tieni', 'dk.burst': 'Fumo 3 s',
      'dk.empty': 'Nessun dispositivo sul banco', 'dk.emptyS': 'Aggiungi una luce, il fumo o un laser in Impostazioni → Dispositivi. Ogni dispositivo avrà qui la sua sezione di fader.',
      'dk.add': 'Aggiungi dispositivo', 'dk.ch': 'can.', 'dk.unused': 'non usato', 'dk.fixed': 'valore fisso', 'dk.locked': 'bloccato',
      'dk.auto': 'da RGB', 'dk.tools': 'Luce attiva', 'dk.none': 'Clicca la sezione di un dispositivo per controllarlo qui.',
      'dk.zeroAll': 'Azzera banco', 'dk.mode': 'Mostra', 'dk.open': 'aperto', 'dk.zeroQ': 'Azzerare tutti i dispositivi?', 'dk.compact': 'Compatto', 'dk.sideT': 'Pannello laterale', 'dk.grp': 'gruppo',
      'dk.pan': 'Pan', 'dk.pan_fine': 'Pan fine', 'dk.tilt': 'Tilt', 'dk.tilt_fine': 'Tilt fine', 'dk.dimmer': 'Luce', 'dk.shutter': 'Strobo',
      'dk.strobe': 'Strobo', 'dk.red': 'Rosso', 'dk.green': 'Verde', 'dk.blue': 'Blu', 'dk.white': 'Bianco', 'dk.cwheel': 'Colori',
      'dk.gobo': 'Gobo', 'dk.speed': 'Motori', 'dk.spin': 'Rotaz.', 'dk.beam': 'Fasci', 'dk.macro': 'Progr.', 'dk.strip': 'Striscia',
      'dk.strip_speed': 'Striscia V', 'dk.aux1': 'Aux 1', 'dk.aux2': 'Aux 2', 'dk.laser_r': 'Laser R', 'dk.laser_g': 'Laser G', 'dk.laser': 'Laser',
      'dk.none': '—', 'dk.const': 'Fisso', 'dk.smoke': 'Fumo', 'dk.smokeS': 'potenza fumo', 'dk.man': 'manuale',
    },
  });

  // colour of each kind of channel (fader cap line, LCD, LED)
  const CAT = {
    pan: 'pos', pan_fine: 'pos', tilt: 'pos', tilt_fine: 'pos', speed: 'pos', dimmer: 'int', shutter: 'str', strobe: 'str',
    aux1: 'str', aux2: 'str', red: 'red', green: 'grn', blue: 'blu', white: 'wht', cwheel: 'col', gobo: 'beam', spin: 'beam',
    beam: 'beam', macro: 'misc', strip: 'misc', strip_speed: 'misc', laser: 'las', laser_r: 'las', laser_g: 'las',
  };
  const COL = { pos: '#5cb8ff', int: '#ffb020', str: '#ff5f52', red: '#ff4a4a', grn: '#3ee08a', blu: '#5b8cff', wht: '#f3eee2',
    col: '#c890ff', beam: '#e4d9c3', misc: '#9ea6ae', las: '#ff3d7f', smoke: '#b9c7cf' };
  const PARAM = { pan: 'pan_coarse', tilt: 'tilt_coarse', shutter: 'strobe', laser_r: 'laser', laser_g: 'laser' };
  const NON_LIGHT = ['smoke', 'laser'];
  const GROUP = ['dimmer', 'shutter', 'red', 'green', 'blue', 'pan', 'tilt', 'speed'];

  const DK = { sig: '', mods: {}, group: null, mode: 'all', lastState: null, compact: null, side: true };
  try {
    DK.mode = localStorage.getItem('ph_desk') || 'all';
    const c = localStorage.getItem('ph_desk_compact'); DK.compact = c === null ? null : c === '1';
    DK.side = localStorage.getItem('ph_desk_side') !== '0';
  } catch (e) { /* private window */ }

  const coarse = (f, axis) => (f[`${axis}_16bit`] ? f.values[axis] >> 8 : Math.round(f.values[axis] / 257));
  const lights = () => PH.fixtures().filter((f) => !NON_LIGHT.includes(f.type));
  function readVal(f, role) {
    const v = f.values;
    if (role === 'pan' || role === 'tilt') return coarse(f, role);
    if (role === 'pan_fine') return v.pan & 255;
    if (role === 'tilt_fine') return v.tilt & 255;
    if (role === 'shutter' || role === 'strobe') return v.strobe || 0;
    if (role === 'white') return Math.min(v.red, v.green, v.blue);
    if (role.startsWith('laser')) return v.laser || 0;
    return v[role] ?? 0;
  }
  // white = the part of the colour all three LEDs share; moving it only moves the channels at that level
  function whiteValues(f, w) {
    const v = f.values, m = Math.min(v.red, v.green, v.blue), out = {};
    for (const c of ['red', 'green', 'blue']) if (v[c] - m < 3) out[c] = w;
    return out;
  }
  function sendRole(ids, role, value, key) {
    if (role === 'white') {
      for (const id of ids) { const f = PH.fixtures().find((x) => x.id === id); if (f) sendT(`dk:${id}:white`, { type: 'set_many', id, values: whiteValues(f, value) }); }
      return;
    }
    const id = ids.length === 1 ? ids[0] : ids;
    sendT(key, { type: 'set', id, param: PARAM[role] || role, value });
  }
  const pct = (v) => `${Math.round(v / 2.55)}%`;
  function subText(f, role, v, st) {
    if (role.startsWith('laser') && !st.lasers_enabled) return t('dk.locked');
    if (role === 'dimmer' || role === 'red' || role === 'green' || role === 'blue') return pct(v);
    if (role === 'shutter' || role === 'strobe') return v ? pct(v) : t('dk.open');
    if (role === 'white') return t('dk.auto');
    if (role === 'cwheel' && f.wheel) {
      const slot = f.wheel.reduce((a, b) => (Math.abs(b[0] - v) < Math.abs(a[0] - v) ? b : a));
      return v > f.wheel[f.wheel.length - 1][0] + 8 ? '∞' : t(`wc.${slot[2]}`).slice(0, 9);
    }
    return String(v);
  }
  const roleLabel = (role, f) => (f && f.type === 'smoke' && role === 'dimmer' ? t('dk.smoke') : t(`dk.${role}`));
  const roleDesc = (role, f) => (f && f.type === 'smoke' && role === 'dimmer' ? t('dk.smokeS') : t(`ro.${role}`));

  /* ---------------------------------------------------------------- building */
  function channelStrip(f, role, i) {
    const col = document.createElement('div');
    col.className = 'dch';
    const addr = f.address + i;
    const head = `<div class="dch-n"><b>${i + 1}</b><small>${String(addr).padStart(3, '0')}</small></div>`;
    if (role === 'none' || role.startsWith('const:')) {
      const fixed = role.startsWith('const:');
      col.classList.add('blank');
      col.innerHTML = `${head}<div class="dch-blank"><span>${fixed ? role.slice(6) : '—'}</span></div>
        <div class="dch-l"><b>${esc(fixed ? t('dk.const') : t('dk.none'))}</b><small>${esc(fixed ? t('dk.fixed') : t('dk.unused'))}</small></div><div class="dch-k"></div>`;
      return { el: col };
    }
    const cat = f.type === 'smoke' && role === 'dimmer' ? 'smoke' : CAT[role] || 'misc';
    // repeated roles (4 beam motors, 2x RGBW) and the white LED get their own channel: moving one never drags the others
    const own = isOwn(f, role);
    const fader = new Fader({ label: esc(roleLabel(role, f)), color: COL[cat],
      onChange: (v) => (own ? sendT(`dk:${f.id}:#${i}`, { type: 'chan_set', id: f.id, index: i, value: v })
        : sendRole([f.id], role, v, `dk:${f.id}:${role}`)) });
    if (own) fader.el.addEventListener('dblclick', () => send({ type: 'chan_auto', id: f.id, index: i }));
    fader.el.title = roleDesc(role, f);
    col.style.setProperty('--fc', COL[cat]);
    col.innerHTML = head;
    col.appendChild(fader.el);
    const desc = document.createElement('div'); desc.className = 'dch-d'; desc.textContent = roleDesc(role, f);
    col.appendChild(desc);
    const key = document.createElement('button'); key.className = 'dkey';
    const pos = role === 'pan' || role === 'tilt';
    key.innerHTML = `<i></i><span>${esc(t(pos ? 'dk.center' : f.type === 'smoke' ? 'dk.hold' : 'dk.flash'))}</span>`;
    if (pos) key.onclick = () => sendRole([f.id], role, 128, `dk:${f.id}:${role}`);
    else if (f.type === 'smoke') momentary(key, () => send({ type: 'smoke', hold: true }), () => send({ type: 'smoke', hold: false }));
    else if (own) {
      let was = null;
      momentary(key, () => { const cur = PH.fixtures().find((x) => x.id === f.id) || f; was = (cur.overrides || {})[i]; send({ type: 'chan_set', id: f.id, index: i, value: 255 }); },
        () => send(was == null ? { type: 'chan_auto', id: f.id, index: i } : { type: 'chan_set', id: f.id, index: i, value: was }));
    } else {
      let was = 0;
      momentary(key, () => { was = readVal(PH.fixtures().find((x) => x.id === f.id) || f, role); send({ type: 'set', id: f.id, param: PARAM[role] || role, value: role === 'shutter' ? 230 : 255 }); },
        () => send({ type: 'set', id: f.id, param: PARAM[role] || role, value: was }));
    }
    col.appendChild(key);
    return { el: col, fader, key, own };
  }
  function isOwn(f, role) {
    if (role === 'white') return true;
    if (role === 'pan_fine' || role === 'tilt_fine') return false;
    return f.channels.filter((r) => r === role).length > 1;
  }
  function chanVal(f, c) {
    const o = f.overrides && f.overrides[c.idx];
    return o != null ? o : readVal(f, c.role);
  }
  function momentary(btn, down, up) {
    let on = false;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } on = true; btn.classList.add('down'); down(); });
    const end = () => { if (!on) return; on = false; btn.classList.remove('down'); up(); };
    btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end); btn.addEventListener('lostpointercapture', end);
  }
  function moduleFor(f) {
    const m = document.createElement('section');
    m.className = `dmod t-${f.type}`; m.dataset.id = f.id;
    const last = f.address + f.footprint - 1;
    m.innerHTML = `<header class="dmod-h">
        <span class="lamp"><i></i></span>
        <span class="tape"><b>${esc(f.name)}</b></span>
        <span class="dmod-m"><small>${esc(f.model || f.type)}</small><small class="mono">DMX ${String(f.address).padStart(3, '0')}–${String(last).padStart(3, '0')} · ${f.footprint} ${esc(t('dk.ch'))}</small></span>
        <button class="dpick"><i></i><span>${esc(t('dk.pick'))}</span></button>
      </header><div class="dmod-c"></div>`;
    const body = $('.dmod-c', m), chans = [];
    f.channels.forEach((role, i) => { const c = channelStrip(f, role, i); c.role = role; c.idx = i; chans.push(c); body.appendChild(c.el); });
    if (f.type === 'smoke') {
      const b = document.createElement('div'); b.className = 'dch smoke-keys';
      b.innerHTML = `<button class="dkey big" data-burst><i></i><span>${esc(t('dk.burst'))}</span></button>`;
      $('[data-burst]', b).onclick = () => send({ type: 'smoke', burst: 3 });
      body.appendChild(b);
    }
    $('.dpick', m).onclick = () => { send({ type: 'select', id: f.id }); if (DK.mode !== 'all') setMode(String(f.id)); };
    $('.dmod-h', m).addEventListener('dblclick', () => setMode(DK.mode === 'all' ? String(f.id) : 'all'));
    return { el: m, chans, lamp: $('.lamp i', m), pick: $('.dpick', m) };
  }
  function groupModule() {
    const m = document.createElement('section');
    m.className = 'dmod group';
    m.innerHTML = `<header class="dmod-h"><span class="lamp all"><i></i></span><span class="tape"><b>${esc(t('dk.group'))}</b></span>
      <span class="dmod-m"><small>${esc(t('dk.groupS'))}</small></span></header><div class="dmod-c"></div>`;
    const body = $('.dmod-c', m), chans = [];
    for (const role of GROUP) {
      const cat = CAT[role] || 'misc';
      const fader = new Fader({ label: esc(t(`dk.${role}`)), color: COL[cat],
        onChange: (v) => { const ids = lights().map((f) => f.id); if (ids.length) sendRole(ids, role, v, `dk:grp:${role}`); } });
      const col = document.createElement('div'); col.className = 'dch'; col.style.setProperty('--fc', COL[cat]);
      col.innerHTML = `<div class="dch-n"><b>∑</b><small>${esc(t('dk.grp'))}</small></div>`;
      col.appendChild(fader.el);
      const desc = document.createElement('div'); desc.className = 'dch-d'; desc.textContent = t(`ro.${role}`); col.appendChild(desc);
      const key = document.createElement('button'); key.className = 'dkey';
      const pos = role === 'pan' || role === 'tilt';
      key.innerHTML = `<i></i><span>${esc(t(pos ? 'dk.center' : 'dk.flash'))}</span>`;
      if (pos) key.onclick = () => { const ids = lights().map((f) => f.id); if (ids.length) sendRole(ids, role, 128, `dk:grp:${role}`); };
      else {
        let was = [];
        momentary(key, () => {
          was = lights().map((f) => [f.id, readVal(f, role)]);
          if (was.length) send({ type: 'set', id: was.map((w) => w[0]), param: PARAM[role] || role, value: role === 'shutter' ? 230 : 255 });
        }, () => { for (const [id, v] of was) send({ type: 'set', id, param: PARAM[role] || role, value: v }); });
      }
      col.appendChild(key);
      body.appendChild(col);
      chans.push({ role, fader, el: col });
    }
    return { el: m, chans };
  }

  function bankKeys(st) {
    const box = $('#desk-bank'); if (!box) return;
    const mk = (id, name, sub) => `<button class="bkey${DK.mode === id ? ' on' : ''}" data-mode="${id}"><i class="led"></i><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></button>`;
    box.innerHTML = mk('all', t('dk.all'), `${st.fixtures.length} · ${t('dk.allS')}`)
      + st.fixtures.map((f) => mk(String(f.id), f.name, `DMX ${String(f.address).padStart(3, '0')}`)).join('');
    for (const b of $$('.bkey', box)) b.onclick = () => { setMode(b.dataset.mode); if (b.dataset.mode !== 'all') send({ type: 'select', id: Number(b.dataset.mode) }); };
  }
  function setMode(mode) {
    DK.mode = mode;
    try { localStorage.setItem('ph_desk', mode); } catch (e) { /* ignore */ }
    DK.sig = '';
    if (DK.lastState) update(DK.lastState);
  }

  function build(st) {
    const box = $('#desk-strips'); if (!box) return;
    if (DK.mode !== 'all' && !st.fixtures.some((f) => String(f.id) === DK.mode)) DK.mode = 'all';
    bankKeys(st);
    box.innerHTML = ''; DK.mods = {}; DK.group = null;
    $('#desk').classList.toggle('single', DK.mode !== 'all');
    if (!st.fixtures.length) {
      box.innerHTML = `<div class="desk-empty">${ic('mixer')}<b>${esc(t('dk.empty'))}</b><p>${esc(t('dk.emptyS'))}</p>
        <button class="btn primary" id="desk-add">${ic('plus')}<span>${esc(t('dk.add'))}</span></button></div>`;
      $('#desk-add').onclick = () => { PH.setTab('setup'); if (PH.setupGo) PH.setupGo('lamps'); };
      return;
    }
    const list = DK.mode === 'all' ? st.fixtures : st.fixtures.filter((f) => String(f.id) === DK.mode);
    if (DK.mode === 'all' && lights().length > 1) { DK.group = groupModule(); box.appendChild(DK.group.el); }
    for (const f of list) { const m = moduleFor(f); DK.mods[f.id] = m; box.appendChild(m.el); }
    applyLayout();
    requestAnimationFrame(() => box.classList.add('in'));
  }

  function update(st) {
    DK.lastState = st;
    if (S.tab !== 'mixer') return;
    const sig = JSON.stringify([st.fixtures.map((f) => [f.id, f.name, f.address, f.channels, f.type, f.model, !!f.wheel]), DK.mode, PH.lang]);
    if (sig !== DK.sig) { DK.sig = sig; build(st); }
    const fx = st.fixtures;
    for (const f of fx) {
      const m = DK.mods[f.id]; if (!m) continue;
      const [r, g, b] = PH.rgbOf(f), I = PH.intensity(f, performance.now() / 1000);
      m.lamp.style.setProperty('--c', `rgb(${r},${g},${b})`); m.lamp.style.opacity = (0.18 + 0.82 * I).toFixed(2);
      const act = f.id === st.active_id;
      m.el.classList.toggle('active', act);
      m.pick.classList.toggle('on', act);
      $('span', m.pick).textContent = t(act ? 'dk.picked' : 'dk.pick');
      for (const c of m.chans) {
        if (!c.fader) continue;
        const v = chanVal(f, c), man = f.overrides && f.overrides[c.idx] != null;
        c.fader.setValue(v); c.fader.setSub(man ? `${pct(v)} · ${t('dk.man')}` : subText(f, c.role, c.fader.value, st));
        c.el.classList.toggle('man', !!man);
        c.el.classList.toggle('lit', c.fader.value > 0);
      }
    }
    if (DK.group) {
      const L = lights(); const f0 = fx.find((f) => f.id === st.active_id && !NON_LIGHT.includes(f.type)) || L[0];
      for (const c of DK.group.chans) {
        if (!f0) break;
        const vals = L.map((f) => readVal(f, c.role)), v = readVal(f0, c.role);
        const same = vals.every((x) => Math.abs(x - v) < 2);
        c.fader.setValue(v); c.fader.setSub(same ? subText(f0, c.role, v, st) : '≠');
        c.el.classList.toggle('lit', v > 0);
      }
    }
    for (const b of $$('#desk-bank .bkey')) {
      const f = fx.find((x) => String(x.id) === b.dataset.mode);
      const led = $('.led', b);
      if (f) { const [r, g, bl] = PH.rgbOf(f), I = PH.intensity(f, performance.now() / 1000); led.style.setProperty('--c', `rgb(${r},${g},${bl})`); led.style.opacity = (0.25 + 0.75 * I).toFixed(2); }
      b.classList.toggle('act', !!f && f.id === st.active_id);
    }
  }

  // compact: narrow strips without descriptions. Automatic (null) = compact when the desk does not fit.
  function applyLayout() {
    const desk = $('#desk'), strips = $('#desk-strips'); if (!desk || !strips) return;
    desk.classList.toggle('noside', !DK.side);
    let compact = DK.compact;
    if (compact === null) {
      desk.classList.remove('compact');
      compact = strips.scrollWidth > strips.clientWidth + 40;
    }
    desk.classList.toggle('compact', compact);
    $('#desk-compact').classList.toggle('on', compact);
    $('#desk-compact').classList.toggle('auto', DK.compact === null);
    const sideT = $('#desk-side-t'); if (sideT) sideT.classList.toggle('on', DK.side);
  }
  function init() {
    $('#desk-compact').onclick = () => {
      const cur = $('#desk').classList.contains('compact');
      DK.compact = !cur;
      try { localStorage.setItem('ph_desk_compact', DK.compact ? '1' : '0'); } catch (e) { /* ignore */ }
      applyLayout();
    };
    // v4.1: the side panel became the folders "Sceny świateł" and "Kolor i pozycja"
    DK.side = false;
    (PH.onFold = PH.onFold || []).push((page, id) => { if (page === 'mixer' && id === 'desk') { DK.sig = ''; if (DK.lastState) update(DK.lastState); } });
    const strips = $('#desk-strips');
    strips.addEventListener('wheel', (e) => {       // wheel over the desk scrolls it sideways; over a fader it moves the fader
      if (e.defaultPrevented || e.shiftKey || strips.scrollWidth <= strips.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { strips.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    window.addEventListener('resize', () => { if (S.tab === 'mixer') applyLayout(); });
    const z = $('#desk-zero');
    if (z) z.onclick = () => { if (confirm(t('dk.zeroQ'))) send({ type: 'zero' }); };
    PH.onState.push(update);
    const tabBtn = $('#tabs button[data-tab=mixer]');
    if (tabBtn) tabBtn.addEventListener('click', () => { DK.sig = ''; if (DK.lastState) requestAnimationFrame(() => update(DK.lastState)); });
  }
  PH.deskMode = setMode;
  init();
})();
