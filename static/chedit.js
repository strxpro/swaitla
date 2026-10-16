/* Lumo — Kanały urządzenia: what is on which DMX channel.
 *
 * Every channel has a role (dimmer, red, pan, strobe, smoke …) and a live test slider that
 * drives the real DMX channel right away. The roles are filled in automatically from the
 * device library / typical layouts for that channel count; move the sliders, look at the
 * device and correct whatever does not match. Save = the device uses this layout.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, toast, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const ROLES = [
    ['none', 'close'], ['dimmer', 'sun'], ['red', 'drop'], ['green', 'drop'], ['blue', 'drop'], ['white', 'drop'],
    ['shutter', 'pulse'], ['pan', 'arrows'], ['pan_fine', 'arrows'], ['tilt', 'move'], ['tilt_fine', 'move'],
    ['cwheel', 'palette'], ['gobo', 'gobo'], ['speed', 'gauge'], ['spin', 'refresh'], ['beam', 'layers'],
    ['strip', 'bar'], ['strip_speed', 'gauge'], ['macro', 'auto'], ['aux1', 'bolt'], ['aux2', 'bolt'],
    ['laser', 'laser'], ['laser_r', 'laser'], ['laser_g', 'laser'],
  ];
  const ICON = Object.fromEntries(ROLES);
  const TYPICAL = {
    1: ['dimmer'], 2: ['dimmer', 'shutter'], 3: ['red', 'green', 'blue'], 4: ['red', 'green', 'blue', 'white'],
    5: ['dimmer', 'red', 'green', 'blue', 'shutter'], 6: ['dimmer', 'red', 'green', 'blue', 'white', 'shutter'],
    7: ['dimmer', 'red', 'green', 'blue', 'white', 'shutter', 'macro'], 8: ['dimmer', 'red', 'green', 'blue', 'white', 'shutter', 'macro', 'speed'],
    9: ['pan', 'tilt', 'cwheel', 'gobo', 'shutter', 'dimmer', 'speed', 'macro', 'none'],
    11: ['pan', 'pan_fine', 'tilt', 'tilt_fine', 'cwheel', 'gobo', 'shutter', 'dimmer', 'speed', 'macro', 'none'],
  };
  PH.addI18n({
    pl: {
      'ce.title': 'Kanały urządzenia', 'ce.addr': 'Adres DMX', 'ce.count': 'Liczba kanałów', 'ce.tpl': 'Układ',
      'ce.tplAuto': 'dopasuj automatycznie', 'ce.tplTyp': 'typowy układ {n} kanałów', 'ce.hint': 'Przesuwaj suwaki i patrz na urządzenie. Jeśli kanał robi coś innego, wybierz właściwą funkcję z listy.',
      'ce.save': 'Zapisz kanały', 'ce.cancel': 'Anuluj', 'ce.saved': 'Kanały zapisane: {n}', 'ce.all0': 'Wszystkie na 0', 'ce.lightOn': 'Zapal (jasność 100%)',
      'ce.auto': 'Ustawiono automatycznie: {s}',
      'ro.none': '— nic —', 'ro.dimmer': 'Jasność', 'ro.red': 'Czerwony', 'ro.green': 'Zielony', 'ro.blue': 'Niebieski', 'ro.white': 'Biały',
      'ro.shutter': 'Strobo / migawka', 'ro.pan': 'Obrót (pan)', 'ro.pan_fine': 'Obrót — dokładnie', 'ro.tilt': 'Pochylenie (tilt)', 'ro.tilt_fine': 'Pochylenie — dokładnie',
      'ro.cwheel': 'Koło kolorów', 'ro.gobo': 'Gobo', 'ro.speed': 'Prędkość silników', 'ro.spin': 'Obrót ciągły', 'ro.beam': 'Wiązki / soczewki',
      'ro.strip': 'Pasek LED (program)', 'ro.strip_speed': 'Pasek LED — prędkość', 'ro.macro': 'Program / auto / dźwięk', 'ro.aux1': 'Dodatkowe strobo 1', 'ro.aux2': 'Dodatkowe strobo 2',
      'ro.laser': 'Laser (włącz / wzór)', 'ro.laser_r': 'Laser czerwony', 'ro.laser_g': 'Laser zielony', 'ro.smoke': 'Dym',
    },
    it: {
      'ce.title': 'Canali del dispositivo', 'ce.addr': 'Indirizzo DMX', 'ce.count': 'Numero di canali', 'ce.tpl': 'Schema',
      'ce.tplAuto': 'adatta automaticamente', 'ce.tplTyp': 'schema tipico {n} canali', 'ce.hint': 'Muovi i cursori e guarda il dispositivo. Se un canale fa altro, scegli la funzione giusta dalla lista.',
      'ce.save': 'Salva canali', 'ce.cancel': 'Annulla', 'ce.saved': 'Canali salvati: {n}', 'ce.all0': 'Tutti a 0', 'ce.lightOn': 'Accendi (luminosità 100%)',
      'ce.auto': 'Impostato automaticamente: {s}',
      'ro.none': '— niente —', 'ro.dimmer': 'Luminosità', 'ro.red': 'Rosso', 'ro.green': 'Verde', 'ro.blue': 'Blu', 'ro.white': 'Bianco',
      'ro.shutter': 'Strobo / otturatore', 'ro.pan': 'Rotazione (pan)', 'ro.pan_fine': 'Rotazione — fine', 'ro.tilt': 'Inclinazione (tilt)', 'ro.tilt_fine': 'Inclinazione — fine',
      'ro.cwheel': 'Ruota colori', 'ro.gobo': 'Gobo', 'ro.speed': 'Velocità motori', 'ro.spin': 'Rotazione continua', 'ro.beam': 'Fasci / lenti',
      'ro.strip': 'Striscia LED (programma)', 'ro.strip_speed': 'Striscia LED — velocità', 'ro.macro': 'Programma / auto / suono', 'ro.aux1': 'Strobo extra 1', 'ro.aux2': 'Strobo extra 2',
      'ro.laser': 'Laser (accendi / figura)', 'ro.laser_r': 'Laser rosso', 'ro.laser_g': 'Laser verde', 'ro.smoke': 'Fumo',
    },
  });
  const roleName = (r, f) => (r === 'dimmer' && f && f.type === 'smoke' ? t('ro.smoke') : t(`ro.${r}`));

  const CE = { f: null, roles: [], vals: [], addr: 1, tpl: 'current' };
  function dialog() {
    let d = $('#ch-dialog');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'ch-dialog'; document.body.appendChild(d);
      d.addEventListener('close', () => send({ type: 'test_clear' }));
    }
    return d;
  }
  function templates(n) {
    const lib = (S.library || []).filter((e) => e.channels.length === n);
    return lib.map((e) => ({ id: `lib:${e.key}`, name: e.model, ch: e.channels.map((c) => (c.startsWith('const') ? 'none' : c)) }))
      .concat(TYPICAL[n] ? [{ id: 'typ', name: t('ce.tplTyp', { n }), ch: TYPICAL[n] }] : []);
  }
  PH.openChannels = (f) => {
    if (!f) return;
    CE.f = f; CE.addr = f.address; CE.roles = f.channels.map((c) => (c.startsWith('const') ? 'none' : c === 'strobe' ? 'shutter' : c)); CE.tpl = 'current';
    CE.vals = CE.roles.map(() => 0);
    render();
    dialog().showModal();
  };
  function setCount(n) {
    n = Math.max(1, Math.min(48, n));
    const tp = templates(n)[0];
    CE.roles = tp ? tp.ch.slice() : Array.from({ length: n }, (_, i) => CE.roles[i] || 'none');
    CE.vals = CE.roles.map(() => 0);
    if (tp) toast(t('ce.auto', { s: tp.name }));
    render();
  }
  function render() {
    const d = dialog(), f = CE.f, n = CE.roles.length, tps = templates(n);
    d.innerHTML = `<div class="ch-top"><h3>${ic('channels')} ${esc(t('ce.title'))} — ${esc(f.name)}</h3>
        <button class="icon-btn" id="ce-x">${ic('close')}</button></div>
      <div class="ch-bar">
        <label>${esc(t('ce.addr'))}<input type="number" id="ce-addr" min="1" max="512" value="${CE.addr}" style="width:74px"></label>
        <label>${esc(t('ce.count'))}<input type="number" id="ce-n" min="1" max="48" value="${n}" style="width:64px"></label>
        <label>${esc(t('ce.tpl'))}<select id="ce-tpl"><option value="current">${esc(f.model || f.name)}</option>${tps.map((tp) => `<option value="${esc(tp.id)}">${esc(tp.name)}</option>`).join('')}</select></label>
        <span class="grow"></span>
        <button class="btn sm" id="ce-on">${ic('sun')}<span>${esc(t('ce.lightOn'))}</span></button>
        <button class="btn sm" id="ce-zero">${ic('refresh')}<span>${esc(t('ce.all0'))}</span></button></div>
      <div class="ch-list">${CE.roles.map((r, i) => `<div class="ch-row" data-i="${i}">
          <span class="n"><b>CH ${i + 1}</b>DMX ${String(CE.addr + i).padStart(3, '0')}</span>
          <span class="ch-role">${ic(ICON[r] || 'close')}<select data-role="${i}">${ROLES.map(([k]) => `<option value="${k}" ${k === r ? 'selected' : ''}>${esc(roleName(k, f))}</option>`).join('')}</select></span>
          <input type="range" min="0" max="255" value="${CE.vals[i]}" data-v="${i}">
          <output>${CE.vals[i]}</output>
          <span class="ch-q"><button class="btn sm" data-q="${i}:0">0</button><button class="btn sm" data-q="${i}:128">50%</button><button class="btn sm" data-q="${i}:255">100%</button></span>
        </div>`).join('')}</div>
      <div class="ch-foot"><span class="ch-hint">${esc(t('ce.hint'))}</span><span class="grow"></span>
        <button class="btn" id="ce-cancel">${esc(t('ce.cancel'))}</button>
        <button class="btn primary" id="ce-save">${ic('check')}<span>${esc(t('ce.save'))}</span></button></div>`;
    const setVal = (i, v) => {
      CE.vals[i] = v;
      const row = $(`.ch-row[data-i="${i}"]`, d);
      $('input[type=range]', row).value = v; $('output', row).textContent = v;
      row.classList.add('live'); clearTimeout(row._t); row._t = setTimeout(() => row.classList.remove('live'), 700);
      PH.S.out.set(`ce${i}`, { type: 'test_channel', channel: CE.addr + i, value: v });
    };
    for (const el of $$('[data-v]', d)) el.oninput = () => setVal(Number(el.dataset.v), Number(el.value));
    for (const el of $$('[data-q]', d)) el.onclick = () => { const [i, v] = el.dataset.q.split(':').map(Number); setVal(i, v); };
    for (const el of $$('[data-role]', d)) el.onchange = () => {
      const i = Number(el.dataset.role); CE.roles[i] = el.value;
      el.previousElementSibling.outerHTML = ic(ICON[el.value] || 'close');
    };
    $('#ce-n', d).onchange = (e) => setCount(Number(e.target.value));
    $('#ce-addr', d).onchange = (e) => { send({ type: 'test_clear' }); CE.addr = Math.max(1, Math.min(512, Number(e.target.value) || 1)); render(); };
    $('#ce-tpl', d).onchange = (e) => {
      const tp = tps.find((x) => x.id === e.target.value);
      CE.roles = tp ? tp.ch.slice() : CE.f.channels.map((c) => (c.startsWith('const') ? 'none' : c));
      CE.tpl = e.target.value; render();
      $('#ce-tpl', dialog()).value = e.target.value;
    };
    $('#ce-on', d).onclick = () => CE.roles.forEach((r, i) => {
      if (r === 'dimmer' || r === 'white') setVal(i, 255);
      else if (r === 'shutter') setVal(i, CE.f.shutter_open || 0);
      else if (r === 'red' || r === 'green' || r === 'blue') setVal(i, 255);
    });
    $('#ce-zero', d).onclick = () => CE.roles.forEach((_, i) => setVal(i, 0));
    $('#ce-x', d).onclick = () => d.close();
    $('#ce-cancel', d).onclick = () => d.close();
    $('#ce-save', d).onclick = () => {
      const ch = CE.roles, tp = CE.tpl.startsWith('lib:') ? (S.library || []).find((e) => `lib:${e.key}` === CE.tpl) : null;
      const patch = { type: 'update_fixture', id: CE.f.id, address: CE.addr, channels: ch.join(','),
        pan_16bit: ch.includes('pan_fine'), tilt_16bit: ch.includes('tilt_fine'), has_rgb: ch.includes('red') || ch.includes('green') || ch.includes('blue') };
      if (tp) Object.assign(patch, { model: tp.model, library_key: tp.key, shutter_open: tp.shutter_open ?? 0, strobe_min: tp.strobe_min ?? 1, strobe_max: tp.strobe_max ?? 255 });
      send(patch);
      toast(t('ce.saved', { n: ch.length }));
      d.close();
    };
  }
})();
