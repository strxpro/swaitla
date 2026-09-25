/* Lumo — "Kamera sceny": a second camera that sees the whole stage.
 *
 * Every person gets a number and a colour, their feet are placed on the floor map
 * and in the 3-D scene.  Click a person → name them / follow them with light.
 * Drag a rectangle → mark an object (DJ desk, drum kit, a dancer the detector misses).
 */
(() => {
  const PH = window.PH;
  const { S, send, t, toast, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  PH.addI18n({
    pl: {
      'tab.stagecam': 'Kamera sceny',
      'sc.empty.title': 'Druga kamera — cała scena',
      'sc.empty.text': 'Postaw drugą kamerę (telefon, kamera USB) tak, żeby widziała całą scenę. Program pokaże, kto gdzie stoi, i może świecić na wybraną osobę.',
      'sc.pick': 'Wybierz kamerę', 'sc.url': 'albo adres telefonu (Wi-Fi)', 'sc.connect': 'Połącz',
      'sc.off': 'Wyłącz kamerę', 'sc.mirror': 'Lustro', 'sc.floor': 'Kalibruj podłogę',
      'sc.map': 'Mapa sceny (widok z góry)', 'sc.list': 'Osoby i obiekty', 'sc.none': 'Nikogo nie widać',
      'sc.hint': 'Kliknij osobę = oznacz / świeć na nią · przeciągnij prostokąt = oznacz przedmiot',
      'sc.floorHint': 'Kliknij róg {c} ({n}/4) · Esc anuluje',
      'sc.follow': 'Świeć na nią', 'sc.unfollow': 'Przestań świecić', 'sc.forget': 'Usuń',
      'sc.name': 'Nazwa', 'sc.target': 'Świeci', 'sc.tActive': 'aktywna lampa', 'sc.tAll': 'wszystkie lampy',
      'sc.det.hog': 'Wykrywanie ludzi: podstawowe (wbudowane)',
      'sc.det.mp': 'Wykrywanie ludzi i przedmiotów: dokładne (model AI)',
      'sc.det.get': 'Pobierz dokładniejsze wykrywanie (≈4 MB)', 'sc.det.getting': 'pobieram…',
      'sc.lost': 'poza kadrem', 'sc.person': 'Osoba', 'sc.object': 'Obiekt',
      'sc.same': 'To ta sama kamera co główna — wybierz inną',
      'toast.stagecamOn': 'Kamera sceny włączona', 'toast.stagecamOff': 'Kamera sceny wyłączona',
      'toast.stagecamQuad': 'Podłoga kamery sceny skalibrowana',
      'toast.modelOk': 'Pobrano dokładne wykrywanie ludzi', 'toast.modelFail': 'Nie udało się pobrać modelu: {err}',
    },
    it: {
      'tab.stagecam': 'Camera palco',
      'sc.empty.title': 'Seconda camera — tutto il palco',
      'sc.empty.text': 'Metti una seconda camera (telefono, webcam USB) che veda tutto il palco. Il programma mostra chi è dove e può illuminare la persona scelta.',
      'sc.pick': 'Scegli la camera', 'sc.url': 'oppure l’indirizzo del telefono (Wi-Fi)', 'sc.connect': 'Collega',
      'sc.off': 'Spegni camera', 'sc.mirror': 'Specchio', 'sc.floor': 'Calibra pavimento',
      'sc.map': 'Mappa del palco (dall’alto)', 'sc.list': 'Persone e oggetti', 'sc.none': 'Non vedo nessuno',
      'sc.hint': 'Clicca una persona = segna / illumina · trascina un rettangolo = segna un oggetto',
      'sc.floorHint': 'Clicca l’angolo {c} ({n}/4) · Esc annulla',
      'sc.follow': 'Illumina', 'sc.unfollow': 'Smetti di illuminare', 'sc.forget': 'Elimina',
      'sc.name': 'Nome', 'sc.target': 'Luce', 'sc.tActive': 'luce attiva', 'sc.tAll': 'tutte le luci',
      'sc.det.hog': 'Rilevamento persone: base (integrato)',
      'sc.det.mp': 'Rilevamento persone e oggetti: preciso (modello AI)',
      'sc.det.get': 'Scarica il rilevamento preciso (≈4 MB)', 'sc.det.getting': 'scarico…',
      'sc.lost': 'fuori inquadratura', 'sc.person': 'Persona', 'sc.object': 'Oggetto',
      'sc.same': 'È la stessa camera della principale — scegline un’altra',
      'toast.stagecamOn': 'Camera palco accesa', 'toast.stagecamOff': 'Camera palco spenta',
      'toast.stagecamQuad': 'Pavimento della camera palco calibrato',
      'toast.modelOk': 'Rilevamento preciso scaricato', 'toast.modelFail': 'Download del modello fallito: {err}',
    },
  });

  const SC = { sel: null, drag: null, floorCal: null, streaming: false, listSig: '', popFor: null };

  /* ------------------------------------------------------------ video stream (only while visible) */
  function stream(on) {
    const img = $('#sc-img');
    if (on && !SC.streaming) { img.src = `/stream/stage?t=${Date.now()}`; SC.streaming = true; }
    if (!on && SC.streaming) { img.removeAttribute('src'); SC.streaming = false; }
  }

  /* ------------------------------------------------------------ geometry */
  function viewRect() {             // where the camera image sits inside the view ("contain")
    const box = $('#sc-view').getBoundingClientRect(), img = $('#sc-img');
    const ar = img.naturalWidth ? img.naturalWidth / img.naturalHeight : 16 / 9;
    let w = box.width, h = w / ar;
    if (h > box.height) { h = box.height; w = h * ar; }
    return { x: (box.width - w) / 2, y: (box.height - h) / 2, w, h, box };
  }
  function norm(e) {
    const R = viewRect();
    return [(e.clientX - R.box.left - R.x) / R.w, (e.clientY - R.box.top - R.y) / R.h];
  }
  const tracks = () => (S.st && S.st.stagecam ? S.st.stagecam.tracks : []);
  function trackAt(x, y) {
    const hits = tracks().filter((tr) => x >= tr.box[0] && x <= tr.box[0] + tr.box[2] && y >= tr.box[1] && y <= tr.box[1] + tr.box[3]);
    return hits.sort((a, b) => a.box[2] * a.box[3] - b.box[2] * b.box[3])[0] || null;
  }

  /* ------------------------------------------------------------ overlay on the camera image */
  function drawOverlay() {
    const cv = $('#sc-canvas'); const [W, H, d] = PH.fitCanvas(cv); const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const sc = S.st && S.st.stagecam; if (!sc || !sc.on) return;
    const R = viewRect(), X = (x) => (R.x + x * R.w) * d, Y = (y) => (R.y + y * R.h) * d;
    ctx.font = `600 ${12 * d}px Inter, Segoe UI, sans-serif`; ctx.textBaseline = 'bottom';
    for (const tr of sc.tracks) {
      const [bx, by, bw, bh] = tr.box, followed = sc.follow === tr.id, sel = SC.sel === tr.id;
      ctx.globalAlpha = tr.ok ? 1 : 0.45;
      ctx.strokeStyle = tr.color; ctx.lineWidth = (followed ? 4 : sel ? 3 : 2) * d;
      ctx.setLineDash(tr.kind === 'object' ? [6 * d, 4 * d] : []);
      ctx.strokeRect(X(bx), Y(by), bw * R.w * d, bh * R.h * d);
      ctx.setLineDash([]);
      const label = `${followed ? '◎ ' : ''}${tr.name || `${t(tr.kind === 'object' ? 'sc.object' : 'sc.person')} ${tr.id}`}`;
      const tw = ctx.measureText(label).width + 12 * d;
      ctx.fillStyle = tr.color; ctx.fillRect(X(bx), Y(by) - 20 * d, tw, 20 * d);
      ctx.fillStyle = '#fff'; ctx.fillText(label, X(bx) + 6 * d, Y(by) - 4 * d);
      // feet marker
      ctx.beginPath(); ctx.arc(X(bx + bw / 2), Y(by + bh), 4 * d, 0, Math.PI * 2); ctx.fillStyle = tr.color; ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (SC.drag) {
      const { x0, y0, x1, y1 } = SC.drag;
      ctx.strokeStyle = '#2b8cff'; ctx.lineWidth = 2 * d; ctx.setLineDash([6 * d, 4 * d]);
      ctx.strokeRect(X(Math.min(x0, x1)), Y(Math.min(y0, y1)), Math.abs(x1 - x0) * R.w * d, Math.abs(y1 - y0) * R.h * d);
      ctx.setLineDash([]);
    }
    const quad = SC.floorCal || sc.quad;
    if (quad && (SC.floorCal || sc.quad.some((p, i) => p[0] !== [0, 1, 1, 0][i] || p[1] !== [1, 1, 0, 0][i]))) {
      ctx.strokeStyle = SC.floorCal ? '#e98a00' : 'rgba(43,140,255,.55)'; ctx.lineWidth = 2 * d; ctx.beginPath();
      quad.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      if (!SC.floorCal) ctx.closePath();
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------ top-down floor map */
  function drawMap() {
    const cv = $('#sc-map'); const [W, H, d] = PH.fitCanvas(cv); const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const st = S.st; if (!st) return;
    const sw = st.stage.width, sd = st.stage.depth, pad = 16 * d;
    const k = Math.min((W - 2 * pad) / sw, (H - 2 * pad - 14 * d) / sd);
    const ox = W / 2, oz = pad + (sd / 2) * k;
    const P = (X, Z) => [ox + X * k, oz + Z * k];          // +Z (audience) = bottom
    ctx.fillStyle = '#f7f7fa'; ctx.strokeStyle = '#d9dae3'; ctx.lineWidth = 1 * d;
    const [ax, az] = P(-sw / 2, -sd / 2); ctx.fillRect(ax, az, sw * k, sd * k); ctx.strokeRect(ax, az, sw * k, sd * k);
    ctx.strokeStyle = '#ececf2';
    for (let x = Math.ceil(-sw / 2); x <= sw / 2; x++) { const [px] = P(x, 0); ctx.beginPath(); ctx.moveTo(px, az); ctx.lineTo(px, az + sd * k); ctx.stroke(); }
    for (let z = Math.ceil(-sd / 2); z <= sd / 2; z++) { const [, pz] = P(0, z); ctx.beginPath(); ctx.moveTo(ax, pz); ctx.lineTo(ax + sw * k, pz); ctx.stroke(); }
    ctx.fillStyle = '#858996'; ctx.font = `${10 * d}px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(LANG_FRONT(), ox, az + sd * k + 12 * d);
    for (const f of st.fixtures) {              // lamps + where their beam lands
      const [fx, fz] = P(f.pos[0], f.pos[2]);
      const I = PH.intensity(f, performance.now() / 1000), [r, g, b] = PH.rgbOf(f);
      if (f.spot && f.spot.floor && I > 0.02) {
        const [sx, sz] = P(f.spot.floor[0], f.spot.floor[1]);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.25 + 0.5 * I})`; ctx.setLineDash([3 * d, 3 * d]);
        ctx.beginPath(); ctx.moveTo(fx, fz); ctx.lineTo(sx, sz); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.2 + 0.4 * I})`;
        ctx.beginPath(); ctx.arc(sx, sz, Math.max(5 * d, (f.spot.r || 0.3) * k), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = f.id === st.active_id ? '#2b8cff' : '#4a607b';
      ctx.fillRect(fx - 5 * d, fz - 5 * d, 10 * d, 10 * d);
    }
    const sc = st.stagecam;
    for (const tr of (sc && sc.on ? sc.tracks : [])) {
      if (!tr.floor) continue;
      const [px, pz] = P(clamp(tr.floor[0], -sw / 2 - 1, sw / 2 + 1), clamp(tr.floor[1], -sd / 2 - 1, sd / 2 + 1));
      ctx.globalAlpha = tr.ok ? 1 : 0.4;
      ctx.fillStyle = tr.color; ctx.beginPath(); ctx.arc(px, pz, (sc.follow === tr.id ? 9 : 7) * d, 0, Math.PI * 2); ctx.fill();
      if (sc.follow === tr.id) { ctx.strokeStyle = tr.color; ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.arc(px, pz, 14 * d, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#11243b'; ctx.font = `600 ${10.5 * d}px Inter, sans-serif`;
      ctx.fillText(tr.name || `#${tr.id}`, px, pz - 12 * d);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  const LANG_FRONT = () => (document.documentElement.lang === 'it' ? '▼ pubblico' : '▼ publiczność');

  /* ------------------------------------------------------------ list + popover */
  function renderList(sc) {
    const sig = JSON.stringify([sc.tracks.map((tr) => [tr.id, tr.name, tr.ok, tr.kind]), sc.follow, SC.sel, document.documentElement.lang]);
    if (sig === SC.listSig) return;
    const box = $('#sc-list');
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    SC.listSig = sig;
    if (!sc.tracks.length) { box.innerHTML = `<div class="sc-none">${esc(t('sc.none'))}</div>`; return; }
    box.innerHTML = sc.tracks.map((tr) => `
      <div class="sc-row${SC.sel === tr.id ? ' sel' : ''}${tr.ok ? '' : ' lost'}" data-id="${tr.id}">
        <i style="background:${tr.color}"></i>
        <input value="${esc(tr.name)}" placeholder="${esc(t(tr.kind === 'object' ? 'sc.object' : 'sc.person'))} ${tr.id}" maxlength="24" data-name="${tr.id}">
        <button class="btn sm${sc.follow === tr.id ? ' primary' : ''}" data-follow="${tr.id}">${ic('spot')}<span>${esc(t(sc.follow === tr.id ? 'sc.unfollow' : 'sc.follow'))}</span></button>
        <button class="icon" data-forget="${tr.id}" title="${esc(t('sc.forget'))}">✕</button>
        ${tr.ok ? '' : `<small>${esc(t('sc.lost'))}</small>`}
      </div>`).join('');
    for (const el of $$('[data-name]', box)) {
      el.onchange = () => send({ type: 'stagecam_name', id: Number(el.dataset.name), name: el.value.trim() });
      el.onfocus = () => { SC.sel = Number(el.dataset.name); };
    }
    for (const el of $$('[data-follow]', box)) el.onclick = () => toggleFollow(Number(el.dataset.follow));
    for (const el of $$('[data-forget]', box)) el.onclick = () => send({ type: 'stagecam_forget', id: Number(el.dataset.forget) });
  }
  function toggleFollow(id) {
    const sc = S.st.stagecam;
    send({ type: 'stagecam_follow', id: sc.follow === id ? null : id });
  }

  /* ------------------------------------------------------------ empty state: pick the camera */
  function renderEmpty(sc) {
    const box = $('#sc-cams');
    const main = S.st.video.source;
    const sig = `${main}|${sc.source}`;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<button class="btn${i === main ? ' dis' : ''}" data-sc="${i}" ${i === main ? `title="${esc(t('sc.same'))}"` : ''}>CAM ${i}</button>`).join('');
    for (const b of $$('[data-sc]', box)) b.onclick = () => {
      if (Number(b.dataset.sc) === S.st.video.source) { toast(t('sc.same'), 'warn'); return; }
      send({ type: 'stagecam_source', source: Number(b.dataset.sc) });
    };
  }

  /* ------------------------------------------------------------ per state */
  function update(st) {
    const sc = st.stagecam; if (!sc) return;
    const visible = S.tab === 'stagecam';
    stream(visible && sc.on);
    if (!visible) return;
    $('#sc-empty').hidden = sc.on;
    $('#sc-tools').hidden = !sc.on;
    renderEmpty(sc);
    renderList(sc);
    const hint = $('#sc-hint');
    let msg = t('sc.hint'), cls = '';
    if (SC.floorCal) { msg = t('sc.floorHint', { c: PH.floorCorners()[SC.floorCal.length], n: SC.floorCal.length + 1 }); cls = 'warn'; }
    else if (sc.on && sc.state !== 'online') { msg = `CAM ${sc.source}: ${sc.state}`; cls = sc.state === 'offline' ? 'err' : 'warn'; }
    else if (sc.on) msg += ` · ${sc.fps.toFixed(0)} fps`;
    PH.setText(hint, msg); hint.className = `float bl hint sc-hint ${cls}`;
    $('#sc-mirror').checked = sc.mirror;
    for (const b of $$('#sc-target button')) b.classList.toggle('on', b.dataset.v === sc.follow_target);
    const det = $('#sc-det');
    const dsig = `${sc.detector}|${sc.model_ready}|${document.documentElement.lang}`;
    if (det.dataset.sig !== dsig && !det.dataset.busy) {
      det.dataset.sig = dsig;
      det.innerHTML = sc.detector === 'mediapipe'
        ? `<span class="note ok">${esc(t('sc.det.mp'))}</span>`
        : `<span class="note">${esc(t('sc.det.hog'))}</span><button class="btn sm" id="sc-det-get">${esc(t('sc.det.get'))}</button>`;
      const g = $('#sc-det-get');
      if (g) g.onclick = () => { det.dataset.busy = '1'; g.disabled = true; g.textContent = t('sc.det.getting'); send({ type: 'detector_download' }); setTimeout(() => { delete det.dataset.busy; det.dataset.sig = ''; }, 8000); };
    }
  }

  /* ------------------------------------------------------------ pointer on the camera image */
  function initPointer() {
    const cv = $('#sc-canvas');
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !S.st || !S.st.stagecam.on) return;
      const [x, y] = norm(e);
      if (x < 0 || y < 0 || x > 1 || y > 1) return;
      if (SC.floorCal) {
        SC.floorCal.push([x, y]);
        if (SC.floorCal.length === 4) { send({ type: 'stagecam_quad', quad: SC.floorCal }); SC.floorCal = null; }
        return;
      }
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      SC.drag = { x0: x, y0: y, x1: x, y1: y };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!SC.drag) { const [x, y] = norm(e); cv.style.cursor = trackAt(x, y) ? 'pointer' : 'crosshair'; return; }
      const [x, y] = norm(e).map((v) => clamp(v, 0, 1));
      SC.drag.x1 = x; SC.drag.y1 = y;
    });
    const end = () => {
      if (!SC.drag) return;
      const { x0, y0, x1, y1 } = SC.drag, w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      SC.drag = null;
      if (w > 0.02 && h > 0.02) { send({ type: 'stagecam_mark', x: Math.min(x0, x1), y: Math.min(y0, y1), w, h, name: '' }); return; }
      const hit = trackAt(x0, y0);
      if (hit) {                         // click on a person: select it and light it
        SC.sel = hit.id;
        toggleFollow(hit.id);
        setTimeout(() => { const inp = $(`[data-name="${hit.id}"]`); if (inp && !inp.value) inp.focus(); }, 250);
      }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && SC.floorCal) SC.floorCal = null; });
  }

  function init() {
    $('#sc-go').onclick = () => { const u = $('#sc-url').value.trim(); if (u) send({ type: 'stagecam_source', source: u }); };
    $('#sc-url').onkeydown = (e) => { if (e.key === 'Enter') $('#sc-go').click(); };
    $('#sc-off').onclick = () => send({ type: 'stagecam_source', source: null });
    $('#sc-mirror').onchange = (e) => send({ type: 'stagecam_mirror', value: e.target.checked });
    $('#sc-floor').onclick = () => { SC.floorCal = SC.floorCal ? null : []; };
    for (const b of $$('#sc-target button')) b.onclick = () => send({ type: 'stagecam_follow', id: S.st.stagecam.follow, target: b.dataset.v });
    initPointer();
    PH.onState.push(update);
    const loop = () => { if (S.tab === 'stagecam') { drawOverlay(); drawMap(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  init();
})();
