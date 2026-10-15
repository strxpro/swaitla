/* Lumo — Mikser → Proste: controls generated from the lamp's profile.
 *
 * Pan + tilt → a big XY pad, RGB → colour picker (+ white slider for RGBW), dimmer → brightness,
 * shutter → strobe, gobo / colour wheel → tiles, zoom / focus / iris → sliders, prism → on/off,
 * laser → one big button (off by default, arming asks first), sound / auto programmes → buttons.
 * Five simple controls instead of twenty faders; "Zaawansowane / RAW DMX" opens the full desk.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'sm.pick': 'Lampa', 'sm.move': 'Ruch', 'sm.center': 'Środek', 'sm.color': 'Kolor', 'sm.white': 'Biały', 'sm.dim': 'Jasność', 'sm.strobe': 'Strobo', 'sm.off': 'wył.',
      'sm.gobo': 'Gobo', 'sm.wheel': 'Koło kolorów', 'sm.zoom': 'Zoom', 'sm.focus': 'Focus', 'sm.iris': 'Przysłona', 'sm.prism': 'Pryzmat', 'sm.laser': 'LASER',
      'sm.laserArm': 'Lasery są zablokowane. Uzbroić? Nie patrz w wiązkę.', 'sm.sound': 'SOUND', 'sm.auto': 'AUTO', 'sm.speed': 'Prędkość ruchu', 'sm.raw': 'Zaawansowane / RAW DMX',
      'sm.none': 'Dodaj lampę w Ustawieniach → Moje lampy.', 'sm.lz': 'Laser', 'sm.lzOn': 'Włącz laser', 'sm.lzOff': 'Wyłącz laser', 'sm.lzArm': 'Uzbrój lasery',
      'sm.lzRed': 'Czerwony', 'sm.lzGreen': 'Zielony', 'sm.lzBoth': 'Żółty (oba)', 'sm.lzBlue': 'Niebieski', 'sm.lzProg': 'Program lasera', 'sm.lzLocked': 'Lasery są zablokowane — najpierw „Uzbrój”. Nie patrz w wiązkę.', 'sm.open': 'otwarte', 'sm.fast': 'szybko', 'sm.slow': 'wolno', 'sm.all': 'Wszystkie',
    },
    it: {
      'sm.pick': 'Luce', 'sm.move': 'Movimento', 'sm.center': 'Centro', 'sm.color': 'Colore', 'sm.white': 'Bianco', 'sm.dim': 'Luminosità', 'sm.strobe': 'Strobo', 'sm.off': 'off',
      'sm.gobo': 'Gobo', 'sm.wheel': 'Ruota colori', 'sm.zoom': 'Zoom', 'sm.focus': 'Focus', 'sm.iris': 'Iride', 'sm.prism': 'Prisma', 'sm.laser': 'LASER',
      'sm.laserArm': 'I laser sono bloccati. Armarli? Non guardare il raggio.', 'sm.sound': 'SOUND', 'sm.auto': 'AUTO', 'sm.speed': 'Velocità movimento', 'sm.raw': 'Avanzato / RAW DMX',
      'sm.none': 'Aggiungi una luce in Impostazioni → Le mie luci.', 'sm.lz': 'Laser', 'sm.lzOn': 'Accendi laser', 'sm.lzOff': 'Spegni laser', 'sm.lzArm': 'Arma i laser',
      'sm.lzRed': 'Rosso', 'sm.lzGreen': 'Verde', 'sm.lzBoth': 'Giallo (entrambi)', 'sm.lzBlue': 'Blu', 'sm.lzProg': 'Programma laser', 'sm.lzLocked': 'I laser sono bloccati — prima „Arma”. Non guardare il raggio.', 'sm.open': 'aperto', 'sm.fast': 'veloce', 'sm.slow': 'lento', 'sm.all': 'Tutte',
    },
  });

  const NON_LIGHT = ['smoke'];
  // names from the lamp's profile are often English codes: say them in plain words
  const NICE = { white: ['biały', 'bianco'], red: ['czerwony', 'rosso'], green: ['zielony', 'verde'], blue: ['niebieski', 'blu'],
    yellow: ['żółty', 'giallo'], orange: ['pomarańczowy', 'arancione'], purple: ['fioletowy', 'viola'], violet: ['fioletowy', 'viola'],
    pink: ['różowy', 'rosa'], magenta: ['purpurowy', 'magenta'], cyan: ['turkusowy', 'ciano'], amber: ['bursztynowy', 'ambra'],
    light_blue: ['jasnoniebieski', 'azzurro'], dark_blue: ['granatowy', 'blu scuro'], light_green: ['jasnozielony', 'verde chiaro'],
    uv: ['UV', 'UV'], open: ['otwarte', 'aperto'], shake: ['drżenie', 'vibrazione'], rotate: ['obrót', 'rotazione'], rainbow: ['tęcza', 'arcobaleno'] };
  const nice = (name) => { const k = String(name).trim().toLowerCase().replace(/[\s-]+/g, '_'); return NICE[k] ? NICE[k][PH.lang === 'it' ? 1 : 0] : String(name); };
  const laserIdx = (f, role) => f.channels.map((r, i) => (r === role ? i : -1)).filter((i) => i >= 0);
  function laserBlock(f, st) {
    const ov = f.overrides || {}, on = (f.values.laser || 0) > 0;
    const has = (r) => laserIdx(f, r).length > 0;
    const colOn = (r) => laserIdx(f, r).some((i) => (ov[i] == null ? on : ov[i] > 0));
    const cur = has('laser_r') && colOn('laser_r') && has('laser_g') && colOn('laser_g') ? 'both' : has('laser_r') && colOn('laser_r') ? 'r' : has('laser_g') && colOn('laser_g') ? 'g' : 'b';
    const colors = [has('laser_r') && ['r', 'sm.lzRed', '#ff3b3b'], has('laser_g') && ['g', 'sm.lzGreen', '#2bd46b'], has('laser_r') && has('laser_g') && ['both', 'sm.lzBoth', '#ffd400'], has('laser_b') && ['b', 'sm.lzBlue', '#3b6bff']].filter(Boolean);
    const progIdx = f.channels.findIndex((r) => ['macro', 'auto', 'other'].includes(r) && ((f.caps || {})[f.channels.indexOf(r)] || []).length);
    const prog = progIdx >= 0 ? ((f.caps || {})[progIdx] || []).filter((c) => c[3] !== 'nofunction').slice(0, 12) : [];
    return `<section class="sm-b laserp${st.lasers_enabled ? '' : ' locked'}"><h4>${esc(t('sm.lz'))}</h4>
      ${st.lasers_enabled ? '' : `<p class="lm-tip warn">${esc(t('sm.lzLocked'))}</p><button class="btn primary" data-lzarm>${ic('laser')}<span>${esc(t('sm.lzArm'))}</span></button>`}
      <button class="sm-laser big${on && st.lasers_enabled ? ' on' : ''}" data-lzon ${st.lasers_enabled ? '' : 'disabled'}>${ic('laser')}<span>${esc(t(on ? 'sm.lzOff' : 'sm.lzOn'))}</span></button>
      ${colors.length > 1 ? `<div class="lz-cols">${colors.map(([k, key, c]) => `<button class="lz-c${cur === k ? ' on' : ''}" data-lzc="${k}" style="--c:${c}"><i></i>${esc(t(key))}</button>`).join('')}</div>` : ''}
      ${prog.length ? `<small class="muted">${esc(t('sm.lzProg'))}</small><div class="sm-tiles">${prog.map((c) => `<button data-lzp="${progIdx}:${Math.round((c[0] + c[1]) / 2)}"><small>${esc(String(c[2]).slice(0, 14))}</small></button>`).join('')}</div>` : ''}
      </section>`;
  }
  function bindLaser(box, f) {
    const arm = $('[data-lzarm]', box); if (arm) arm.onclick = () => { if (confirm(t('sm.laserArm'))) send({ type: 'lasers', value: true }); };
    const on = $('[data-lzon]', box); if (on) on.onclick = () => send({ type: 'set', id: f.id, param: 'laser', value: (f.values.laser || 0) > 0 ? 0 : 255 });
    for (const b of $$('[data-lzc]', box)) b.onclick = () => {
      const k = b.dataset.lzc;
      const want = { r: k === 'r' || k === 'both', g: k === 'g' || k === 'both', b: k === 'b' };
      for (const [role, flag] of [['laser_r', want.r], ['laser_g', want.g], ['laser_b', want.b]]) {
        for (const i of laserIdx(f, role)) send(flag ? { type: 'chan_auto', id: f.id, index: i } : { type: 'chan_set', id: f.id, index: i, value: 0 });
      }
    };
    for (const b of $$('[data-lzp]', box)) b.onclick = () => { const [i, v] = b.dataset.lzp.split(':').map(Number); send({ type: 'chan_set', id: f.id, index: i, value: v }); };
  }
  const SW = ['#ffffff', '#ff2a2a', '#ff8a00', '#ffd400', '#2bd46b', '#00d0ff', '#2a5bff', '#8a2bff', '#ff2bd6', '#ffb3c6'];
  const pend = new Map();
  let raf = 0;
  const sendT = (key, msg) => { pend.set(key, msg); if (!raf) raf = requestAnimationFrame(() => { raf = 0; for (const m of pend.values()) send(m); pend.clear(); }); };
  const SM = { sig: '', touch: 0 };

  function features(f) {
    const r = f.channels, caps = f.caps || {};
    const all = (role) => r.map((x, i) => (x === role ? i : -1)).filter((i) => i >= 0);
    const capOf = (i, sem) => (caps[i] || []).find((c) => c[3] === sem);
    const findSem = (sem, roles) => { for (const role of roles) for (const i of all(role)) { const c = capOf(i, sem); if (c) return [i, c]; } return null; };
    return {
      pt: r.includes('pan') && r.includes('tilt'), pan: r.includes('pan') && !r.includes('tilt'), tilt: r.includes('tilt') && !r.includes('pan'),
      rgb: r.includes('red') && r.includes('green') && r.includes('blue'), white: all('white'), dim: r.includes('dimmer'), strobe: r.includes('shutter') || r.includes('strobe'),
      gobo: r.includes('gobo') ? (f.gobos && f.gobos.length ? f.gobos : (caps[all('gobo')[0]] || []).filter((c) => c[3] === 'gobo').map((c) => [Math.round((c[0] + c[1]) / 2), c[2]])) : null,
      wheel: r.includes('cwheel') && f.wheel && f.wheel.length ? f.wheel : null,
      zoom: all('zoom')[0], focus: all('focus')[0], iris: all('iris')[0],
      prism: all('prism')[0] !== undefined ? [all('prism')[0], capOf(all('prism')[0], 'prism')] : null,
      laser: r.some((x) => x.startsWith('laser')),
      sound: all('sound')[0] !== undefined ? [all('sound')[0], capOf(all('sound')[0], 'sound')] : findSem('sound', ['macro', 'auto']),
      auto: all('auto')[0] !== undefined ? [all('auto')[0], capOf(all('auto')[0], 'auto')] : findSem('auto', ['macro']),
      speed: r.includes('speed'),
    };
  }
  const mid = (c, dflt) => (c ? Math.round((c[0] + c[1]) / 2) : dflt);

  function build(st) {
    const box = $('#simple-ctl'); if (!box) return;
    const L = st.fixtures.filter((f) => !NON_LIGHT.includes(f.type));
    if (!L.length) { box.innerHTML = `<div class="fold-empty">${ic('lamp')}<p>${esc(t('sm.none'))}</p></div>`; return; }
    const f = L.find((x) => x.id === st.active_id) || L[0];
    const F = features(f);
    const blk = (title, inner, cls = '') => `<section class="sm-b ${cls}"><h4>${esc(title)}</h4>${inner}</section>`;
    const slider = (key, v, lo = '', hi = '') => `<div class="sm-sl"><input type="range" min="0" max="255" value="${v}" data-s="${key}"><div class="sm-lh"><small>${esc(lo)}</small><output data-o="${key}">${v}</output><small>${esc(hi)}</small></div></div>`;
    const html = [];
    html.push(`<div class="sm-pick"><small>${esc(t('sm.pick'))}</small>${L.map((x) => `<button class="chip${x.id === f.id ? ' on' : ''}" data-f="${x.id}"><i style="--c:rgb(${PH.rgbOf(x).join(',')})"></i>${esc(x.name)}</button>`).join('')}
      ${PH.addrCtl ? `<span class="sm-addr">DMX ${PH.addrCtl(f)}</span>` : ''}</div>`);
    const left = [], right = [];
    if (F.pt || F.pan || F.tilt) left.push(blk(t('sm.move'), `<canvas class="sm-xy" id="sm-xy"></canvas><div class="sm-row"><button class="btn sm" data-c="center">${ic('target')}<span>${esc(t('sm.center'))}</span></button>
      <span class="mono muted" id="sm-xyv"></span></div>${F.speed ? `<div class="sm-sub"><small>${esc(t('sm.speed'))}</small>${slider('speed', f.values.speed || 0, t('sm.fast'), t('sm.slow'))}</div>` : ''}`, 'big'));
    if (F.dim) right.push(blk(t('sm.dim'), slider('dimmer', f.values.dimmer || 0, '0%', '100%'), 'dim'));
    if (F.rgb) right.push(blk(t('sm.color'), `<div class="sm-sw">${SW.map((c) => `<button data-rgb="${c}" style="--c:${c}"></button>`).join('')}<label class="sm-pickc"><input type="color" id="sm-color" value="#ffffff">${ic('palette')}</label></div>
      ${F.white.length ? `<div class="sm-sub"><small>${esc(t('sm.white'))}</small>${slider('white', (f.overrides || {})[F.white[0]] ?? 0)}</div>` : ''}`));
    if (F.wheel) right.push(blk(t('sm.wheel'), `<div class="sm-tiles">${F.wheel.map(([v, rgb, name]) => `<button data-set="cwheel:${v}" title="${esc(name)}"><i style="background:rgb(${rgb.join(',')})"></i><small>${esc(nice(name).slice(0, 14))}</small></button>`).join('')}</div>`));
    if (F.strobe) right.push(blk(t('sm.strobe'), slider('strobe', f.values.strobe || 0, t('sm.off'), t('sm.fast'))));
    if (F.gobo && F.gobo.length) right.push(blk(t('sm.gobo'), `<div class="sm-tiles">${F.gobo.map(([v, name]) => `<button data-set="gobo:${v}" title="${esc(name)}">${ic('gobo')}<small>${esc(nice(name).slice(0, 14))}</small></button>`).join('')}</div>`));
    for (const [k, i] of [['zoom', F.zoom], ['focus', F.focus], ['iris', F.iris]]) if (i !== undefined) right.push(blk(t('sm.' + k), slider(`ch:${i}`, (f.overrides || {})[i] ?? 0)));
    const btns = [];
    if (F.prism) btns.push(`<button class="sm-tog${(f.overrides || {})[F.prism[0]] ? ' on' : ''}" data-tog="${F.prism[0]}:${mid(F.prism[1], 128)}">${ic('diamond')}<span>${esc(t('sm.prism'))}</span></button>`);
    if (F.sound) btns.push(`<button class="sm-tog${(f.overrides || {})[F.sound[0]] ? ' on' : ''}" data-tog="${F.sound[0]}:${mid(F.sound[1], 200)}">${ic('wave')}<span>${esc(t('sm.sound'))}</span></button>`);
    if (F.auto) btns.push(`<button class="sm-tog${(f.overrides || {})[F.auto[0]] ? ' on' : ''}" data-tog="${F.auto[0]}:${mid(F.auto[1], 128)}">${ic('auto')}<span>${esc(t('sm.auto'))}</span></button>`);
    if (F.laser) right.unshift(laserBlock(f, st));
    if (false) btns.push(`<button class="sm-laser${st.lasers_enabled && (f.values.laser || 0) > 0 ? ' on' : ''}" data-laser>${ic('laser')}<span>${esc(t('sm.laser'))}</span><small>${esc(st.lasers_enabled ? '' : t('dk.locked'))}</small></button>`);
    if (btns.length) right.push(blk('', `<div class="sm-btns">${btns.join('')}</div>`));
    html.push(`<div class="sm-grid${left.length ? '' : ' one'}"><div class="sm-l">${left.join('')}</div><div class="sm-r">${right.join('')}</div></div>
      <div class="sm-foot"><button class="btn" data-raw>${ic('mixer')}<span>${esc(t('sm.raw'))}</span></button></div>`);
    box.innerHTML = html.join('');
    bind(box, f, F);
  }
  function bind(box, f, F) {
    for (const b of $$('[data-f]', box)) b.onclick = () => send({ type: 'select', id: Number(b.dataset.f) });
    if (PH.bindAddr) PH.bindAddr(box);
    for (const s of $$('[data-s]', box)) s.oninput = () => {
      SM.touch = performance.now();
      const k = s.dataset.s, v = Number(s.value); $(`[data-o="${k}"]`, box).textContent = v;
      if (k.startsWith('ch:')) sendT(k, { type: 'chan_set', id: f.id, index: Number(k.slice(3)), value: v });
      else if (k === 'white') for (const i of F.white) sendT(`w${i}`, { type: 'chan_set', id: f.id, index: i, value: v });
      else sendT(k, { type: 'set', id: f.id, param: k, value: v });
    };
    for (const b of $$('[data-rgb]', box)) b.onclick = () => { const h = b.dataset.rgb; send({ type: 'set', id: f.id, param: 'rgb', value: [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) }); };
    const col = $('#sm-color', box); if (col) col.oninput = () => { const h = col.value; sendT('rgb', { type: 'set', id: f.id, param: 'rgb', value: [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) }); };
    for (const b of $$('[data-set]', box)) b.onclick = () => { const [p, v] = b.dataset.set.split(':'); send({ type: 'set', id: f.id, param: p, value: Number(v) }); };
    for (const b of $$('[data-tog]', box)) b.onclick = () => {
      const [i, v] = b.dataset.tog.split(':').map(Number);
      const on = !b.classList.contains('on'); b.classList.toggle('on', on);
      send(on ? { type: 'chan_set', id: f.id, index: i, value: v } : { type: 'chan_auto', id: f.id, index: i });
    };
    bindLaser(box, f);
    const lz = $('[data-laser]', box);
    if (lz) lz.onclick = () => {
      if (!S.st.lasers_enabled) { if (confirm(t('sm.laserArm'))) send({ type: 'lasers', value: true }); return; }
      send({ type: 'set', id: f.id, param: 'laser', value: (f.values.laser || 0) > 0 ? 0 : 255 });
    };
    const c = $('[data-c="center"]', box); if (c) c.onclick = () => send({ type: 'set_many', id: f.id, values: { pan: 32768, tilt: 32768 } });
    $('[data-raw]', box).onclick = () => PH.foldGo('mixer', 'desk');
    const cv = $('#sm-xy', box);
    if (cv) {
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
      let down = false;
      const go = (e) => { const [x, y] = pos(e); SM.xy = [x, y]; SM.touch = performance.now(); sendT('xy', { type: 'set_many', id: f.id, values: { ...(F.tilt ? {} : { pan: Math.round(x * 65535) }), ...(F.pan ? {} : { tilt: Math.round(y * 65535) }) } }); };
      cv.addEventListener('pointerdown', (e) => { down = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } go(e); });
      cv.addEventListener('pointermove', (e) => { if (down) go(e); });
      cv.addEventListener('pointerup', () => { down = false; });
    }
  }
  function drawXY(f) {
    const cv = $('#sm-xy'); if (!cv || !cv.offsetParent) return;
    const [W, H, d] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#f6f3ff'); g.addColorStop(1, '#eaf6fb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(123,63,242,.12)'; ctx.lineWidth = 1 * d; ctx.beginPath();
    for (let k = 1; k < 8; k++) { ctx.moveTo((W * k) / 8, 0); ctx.lineTo((W * k) / 8, H); ctx.moveTo(0, (H * k) / 8); ctx.lineTo(W, (H * k) / 8); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(123,63,242,.3)'; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    const x = (f.values.pan / 65535) * W, y = (f.values.tilt / 65535) * H, [r, gg, b] = PH.rgbOf(f);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 34 * d); rg.addColorStop(0, `rgba(${r},${gg},${b},.55)`); rg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 34 * d, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7b3ff2'; ctx.lineWidth = 3 * d; ctx.beginPath(); ctx.arc(x, y, 10 * d, 0, 7); ctx.fill(); ctx.stroke();
    const v = $('#sm-xyv'); if (v) v.textContent = `PAN ${Math.round((f.values.pan / 65535) * 100)}% · TILT ${Math.round((f.values.tilt / 65535) * 100)}%`;
  }
  function update(st) {
    if (S.tab !== 'mixer' || PH.foldOf('mixer') !== 'simple') return;
    const L = st.fixtures.filter((f) => !NON_LIGHT.includes(f.type));
    const f = L.find((x) => x.id === st.active_id) || L[0];
    const sig = JSON.stringify([L.map((x) => [x.id, x.name, x.channels, x.address, x.caps ? Object.keys(x.caps).length : 0]), f && f.id, st.lasers_enabled, PH.lang,
      f && (f.channels.some((r) => r.startsWith('laser')) ? [f.values.laser, f.overrides] : 0)]);
    if (sig !== SM.sig) { SM.sig = sig; build(st); }
    if (!f) return;
    drawXY(f);
    if (performance.now() - SM.touch < 600) return;               // the user is moving a control: do not fight it
    for (const s of $$('#simple-ctl [data-s]')) {
      const k = s.dataset.s;
      const v = k.startsWith('ch:') ? (f.overrides || {})[k.slice(3)] ?? 0 : k === 'white' ? null : Math.round(f.values[k] ?? 0);
      if (v === null || v === undefined || document.activeElement === s) continue;
      if (Number(s.value) !== v) { s.value = v; const o = $(`#simple-ctl [data-o="${k}"]`); if (o) o.textContent = v; }
    }
  }
  PH.simpleFeatures = features;
  PH.onState.push(update);
  PH.onFold = PH.onFold || [];
  PH.onFold.push((page, id) => { if (page === 'mixer' && id === 'simple') { SM.sig = ''; if (S.st) update(S.st); } });
})();
