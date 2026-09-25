/* Lumo — connection map: computer → USB-DMX cable → devices 1, 2, 3 … (DMX chain order), camera.
 * Signal dots flow along the links while data goes out; a new device pops in with a "connect" pulse.
 * Click a device: it is selected and blinks, so you see which lamp is which. Power and address at hand.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: { 'cm.pc': 'Komputer', 'cm.cable': 'Kabel DMX', 'cm.cam': 'Kamera', 'cm.none': 'Brak urządzeń — dodaj pierwsze', 'cm.add': 'Dodaj',
      'cm.off': 'wyłączone', 'cm.clash': 'konflikt adresu', 'cm.noCable': 'nie podłączony', 'cm.noCam': 'brak obrazu', 'cm.hint': 'Kliknij urządzenie — mrugnie i zostanie wybrane' },
    it: { 'cm.pc': 'Computer', 'cm.cable': 'Cavo DMX', 'cm.cam': 'Camera', 'cm.none': 'Nessun dispositivo — aggiungi il primo', 'cm.add': 'Aggiungi',
      'cm.off': 'spento', 'cm.clash': 'conflitto indirizzo', 'cm.noCable': 'non collegato', 'cm.noCam': 'nessuna immagine', 'cm.hint': 'Clicca un dispositivo — lampeggia e viene scelto' },
  });
  const TYPE_IC = { moving_head: 'lamp', par: 'par', bar: 'bar', derby: 'derby', strobe: 'bolt', laser: 'laser', smoke: 'smoke' };
  const pad3 = (n) => String(n).padStart(3, '0');
  const known = new Set();

  function clashes(fx) {
    const out = new Set();
    for (const a of fx) for (const b of fx) if (a.id !== b.id && a.address < b.address + b.footprint && b.address < a.address + a.footprint) out.add(a.id);
    return out;
  }
  function render(box, st) {
    const fx = [...st.fixtures].sort((a, b) => a.address - b.address || a.id - b.id);
    const clash = clashes(fx);
    const dmxOk = st.dmx.ok && st.dmx.config.backend !== 'sim';
    const camOk = st.video.state === 'online';
    const sig = JSON.stringify([fx.map((f) => [f.id, f.name, f.address, f.footprint, f.enabled !== false, f.type]), dmxOk, camOk, st.dmx.label, [...clash], PH.lang]);
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.innerHTML = `<div class="cm ${dmxOk ? 'live' : 'down'}">
        <div class="cm-row">
          <div class="cm-node pc"><span class="cm-ic">${ic('setup')}</span><b>${esc(t('cm.pc'))}</b></div>
          <i class="cm-link ${dmxOk ? 'on' : ''}"></i>
          <button class="cm-node cable ${dmxOk ? 'ok' : 'bad'}" data-go="dmx"><span class="cm-ic">${ic('usb')}</span><b>${esc(t('cm.cable'))}</b><small>${esc(dmxOk ? (st.dmx.label || '') : t('cm.noCable'))}</small></button>
          ${fx.length ? fx.map((f, i) => `<i class="cm-link ${dmxOk && f.enabled !== false ? 'on' : ''}" style="--d:${i * 0.18}s"></i>
            <button class="cm-node dev${f.enabled === false ? ' off' : ''}${clash.has(f.id) ? ' clash' : ''}${known.has(f.id) ? '' : ' new'}" data-id="${f.id}" title="${esc(t('cm.hint'))}">
              <span class="cm-num">${i + 1}</span><span class="cm-ic lamp" data-glow="${f.id}">${ic(TYPE_IC[f.type] || 'lamp')}</span>
              <b>${esc(f.name)}</b><small>${f.enabled === false ? esc(t('cm.off')) : clash.has(f.id) ? esc(t('cm.clash')) : `DMX ${pad3(f.address)}–${pad3(f.address + f.footprint - 1)}`}</small>
              <span class="cm-pw" data-pw="${f.id}" title="${esc(t(f.enabled === false ? 'dock.on' : 'dock.off'))}"><svg viewBox="0 0 24 24" class="ic"><path d="M12 3v8M6.3 7.2a8 8 0 1 0 11.4 0"/></svg></span></button>`).join('')
            : `<i class="cm-link"></i><button class="cm-node add" data-add><span class="cm-ic">${ic('plus')}</span><b>${esc(t('cm.none'))}</b></button>`}
          ${fx.length ? `<i class="cm-link short"></i><button class="cm-node add small" data-add><span class="cm-ic">${ic('plus')}</span><b>${esc(t('cm.add'))}</b></button>` : ''}
        </div>
        <div class="cm-cam ${camOk ? 'ok' : 'bad'}"><i class="cm-vlink ${camOk ? 'on' : ''}"></i><button class="cm-node cam" data-go="camera"><span class="cm-ic">${ic('camera')}</span><b>${esc(t('cm.cam'))}</b><small>${esc(camOk ? `${st.video.width}×${st.video.height} · ${Math.round(st.video.fps)} fps` : t('cm.noCam'))}</small></button></div>
      </div>`;
      for (const f of fx) known.add(f.id);
      for (const b of $$('[data-id]', box)) b.onclick = (e) => {
        const id = Number(b.dataset.id);
        if (e.target.closest('[data-pw]')) { const f = S.st.fixtures.find((x) => x.id === id); send({ type: 'update_fixture', id, enabled: f.enabled === false }); send({ type: 'save' }); return; }
        send({ type: 'select', id });
        send({ type: 'fx_start', id: `cm-blink-${id}`, kind: 'blink', params: { speed: 5 }, targets: id, duration: 1.6 });
        b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping');
      };
      for (const b of $$('[data-go]', box)) b.onclick = () => PH.setupGo(b.dataset.go);
      for (const b of $$('[data-add]', box)) b.onclick = () => PH.setupGo('library');
    }
    // live: colour + glow of every device, selected one
    for (const el of $$('[data-glow]', box)) {
      const f = st.fixtures.find((x) => x.id === Number(el.dataset.glow)); if (!f) continue;
      const [r, g, b] = PH.rgbOf(f), I = PH.intensity(f, performance.now() / 1000);
      el.style.setProperty('--c', `rgb(${r},${g},${b})`); el.style.setProperty('--i', I.toFixed(2));
      el.closest('.cm-node').classList.toggle('sel', f.id === st.active_id);
    }
  }
  PH.onState.push((st) => {
    if (S.tab !== 'setup') return;
    for (const id of ['cm-home', 'cm-lamps']) {
      let box = document.getElementById(id);
      const host = id === 'cm-home' ? $('#st-home') : $('#st-addr');
      if (!host) continue;
      if (!box) { box = document.createElement('div'); box.id = id; box.className = 'cm-wrap'; host.parentElement.insertBefore(box, host); }
      if (box.offsetParent) render(box, st);
    }
  });
})();
