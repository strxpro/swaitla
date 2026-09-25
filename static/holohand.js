/* Lumo — holographic 3-D hand.
 *
 * On the camera view every hand is drawn as a glass hologram: tapered bone tubes lit from the
 * top-left, glowing joint spheres, a translucent palm with a wire mesh, scan lines and a soft
 * shadow. Bones closer to the camera are thicker and brighter (depth from MediaPipe's z).
 * The card in the corner shows the same hand in real 3-D (world landmarks, metres):
 * drag to turn it, double-click to reset. It also shows the distance to the camera,
 * the recognised gesture, the fingers and the camera frame rate.
 */
(() => {
  const PH = window.PH;
  const { S, t, esc, send } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const EDGES = PH.HAND_EDGES;
  const PALM = [0, 1, 2, 5, 9, 13, 17];
  const MESH = [[0, 5], [0, 9], [0, 13], [0, 17], [1, 5], [2, 5], [5, 9], [9, 13], [13, 17]];
  const VIO = [109, 91, 255], CYA = [20, 200, 230];

  PH.addI18n({
    pl: {
      'hh.far': 'daleko', 'hh.near': 'blisko', 'hh.dist': '≈ {d} m od kamery', 'hh.none': 'Pokaż dłoń do kamery',
      'hh.drag': 'Przeciągnij, żeby obrócić', 'hh.fps': '{f} kl/s', 'hh.slow': 'Kamera daje tylko {f} kl/s — gesty będą szarpać. Doświetl dłoń albo w aplikacji Iriun ustaw 30 FPS.',
      'hh.cam': 'Kamera do gestów', 'hh.handcal': 'Kalibruj dłoń', 'hh.scan': 'Szukaj kamer…', 'hh.camN': 'Kamera {n}', 'hh.camUse': 'w użyciu', 'hh.left': 'Lewa', 'hh.right': 'Prawa',
    },
    it: {
      'hh.far': 'lontano', 'hh.near': 'vicino', 'hh.dist': '≈ {d} m dalla camera', 'hh.none': 'Mostra la mano alla camera',
      'hh.drag': 'Trascina per ruotare', 'hh.fps': '{f} fps', 'hh.slow': 'La camera dà solo {f} fps — i gesti scatteranno. Illumina la mano o in Iriun imposta 30 FPS.',
      'hh.cam': 'Camera per i gesti', 'hh.handcal': 'Calibra mano', 'hh.scan': 'Cerca camere…', 'hh.camN': 'Camera {n}', 'hh.camUse': 'in uso', 'hh.left': 'Sinistra', 'hh.right': 'Destra',
    },
  });

  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  function tint(h) {
    if (!h || !h.gesture || h.gesture === 'none') return null;
    if (h.gesture === 'color') { const [r, g, b] = PH.hsv2rgb(h.hue / 360, 1, 1); return [r, g, b]; }
    return hexRgb({ point: '#14c8e6', dimmer: '#f5a524', crossfade: '#12b981', strobe: '#ef4444', spin: '#a855f7', full: '#f5c518' }[h.gesture]);
  }

  /* one bone: tapered glass tube, highlight along the lit edge */
  function tube(ctx, a, b, ra, rb, col, A) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1) return;
    const nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * ra, a[1] + ny * ra);
    ctx.lineTo(b[0] + nx * rb, b[1] + ny * rb);
    ctx.arc(b[0], b[1], rb, an, an - Math.PI, true);
    ctx.lineTo(a[0] - nx * ra, a[1] - ny * ra);
    ctx.arc(a[0], a[1], ra, an + Math.PI, an, true);
    ctx.closePath();
    const r = Math.max(ra, rb), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const lit = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1;
    const g = ctx.createLinearGradient(mx + nx * r * lit, my + ny * r * lit, mx - nx * r * lit, my - ny * r * lit);
    g.addColorStop(0, rgba(mix(col, [255, 255, 255], 0.35), 0.75 * A));
    g.addColorStop(0.28, rgba([255, 255, 255], 0.95 * A));
    g.addColorStop(0.55, rgba(col, 0.85 * A));
    g.addColorStop(1, rgba(mix(col, [30, 20, 90], 0.45), 0.9 * A));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(0.6, r * 0.12); ctx.strokeStyle = rgba(mix(col, [40, 30, 110], 0.5), 0.55 * A); ctx.stroke();
  }
  function joint(ctx, p, r, col, A) {
    const g = ctx.createRadialGradient(p[0] - r * 0.35, p[1] - r * 0.4, r * 0.08, p[0], p[1], r);
    g.addColorStop(0, rgba([255, 255, 255], A));
    g.addColorStop(0.45, rgba(mix(col, [255, 255, 255], 0.3), 0.95 * A));
    g.addColorStop(1, rgba(mix(col, [30, 20, 90], 0.4), 0.9 * A));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill();
  }
  const boneR = (j) => (j <= 4 ? [0.1, 0.095, 0.085, 0.075, 0.065][j] : [0.085, 0.08, 0.07, 0.06][(j - 5) % 4]);

  /* draw a hand from projected points P (px), per-point depth z01 (0 far … 1 near), unit size s (px) */
  function drawSkeleton(ctx, P, z01, s, A, gcol, time) {
    const colOf = (i) => mix(VIO, CYA, clamp(z01[i], 0, 1));
    // palm: translucent glass + wire mesh
    const pg = ctx.createLinearGradient(P[0][0], P[0][1], P[9][0], P[9][1]);
    pg.addColorStop(0, rgba(VIO, 0.26 * A)); pg.addColorStop(1, rgba(CYA, 0.2 * A));
    ctx.fillStyle = pg; ctx.beginPath();
    PALM.forEach((k, n) => (n ? ctx.lineTo(P[k][0], P[k][1]) : ctx.moveTo(P[k][0], P[k][1])));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(VIO, 0.35 * A); ctx.lineWidth = Math.max(0.8, s * 0.012);
    ctx.beginPath(); for (const [i, j] of MESH) { ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); } ctx.stroke();
    // bones far → near
    const order = EDGES.map(([i, j]) => ({ i, j, z: (z01[i] + z01[j]) / 2 })).sort((a, b) => a.z - b.z);
    for (const { i, j, z } of order) {
      const k = s * (0.8 + 0.45 * z);
      tube(ctx, P[i], P[j], boneR(i) * k * 0.55, boneR(j) * k * 0.5, mix(colOf(i), colOf(j), 0.5), A);
    }
    // joints and glowing fingertips
    const ord = P.map((p, i) => i).sort((a, b) => z01[a] - z01[b]);
    for (const i of ord) joint(ctx, P[i], boneR(i) * s * (0.8 + 0.45 * z01[i]) * 0.62, colOf(i), A);
    for (const tip of [4, 8, 12, 16, 20]) {
      const r = s * 0.11 * (0.8 + 0.4 * z01[tip]);
      const g = ctx.createRadialGradient(P[tip][0], P[tip][1], 0, P[tip][0], P[tip][1], r);
      g.addColorStop(0, rgba(gcol || CYA, 0.55 * A)); g.addColorStop(1, rgba(gcol || CYA, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P[tip][0], P[tip][1], r, 0, 7); ctx.fill();
    }
    // recognised gesture: energy running to the fingertips
    if (gcol) {
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = rgba(gcol, 1);
      for (const [i, j] of EDGES) {
        const w = 0.5 + 0.5 * Math.sin(time * 7 - j * 0.45);
        ctx.globalAlpha = (0.15 + 0.35 * w) * A; ctx.lineWidth = Math.max(1, s * 0.022);
        ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* hologram finish: scan lines + moving light band, then composited with a coloured glow */
  const OFF = document.createElement('canvas');
  function hologram(ctx, box, d, time, paint) {
    const w = Math.ceil(box.w), h = Math.ceil(box.h);
    if (w < 4 || h < 4) return;
    if (OFF.width !== w || OFF.height !== h) { OFF.width = w; OFF.height = h; }
    const o = OFF.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, w, h);
    o.translate(-box.x, -box.y);
    paint(o);
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-atop';
    o.fillStyle = 'rgba(255,255,255,.16)';
    for (let y = (time * 30 * d) % (4 * d); y < h; y += 4 * d) o.fillRect(0, y, w, 1.2 * d);
    const band = ((time * 0.45) % 1.4 - 0.2) * h;
    const g = o.createLinearGradient(0, band - 30 * d, 0, band + 30 * d);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    o.fillStyle = g; o.fillRect(0, band - 30 * d, w, 60 * d);
    o.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.shadowColor = 'rgba(109,91,255,.45)'; ctx.shadowBlur = 16 * d;
    ctx.drawImage(OFF, box.x, box.y);
    ctx.restore();
  }

  /* ---- hand on the camera view */
  function drawHand(ctx, R, d, e, time) {
    const h = e.data, L = e.lm, aspect = R.w / R.h;
    const P = L.map(([x, y]) => [R.x + x * R.w, R.y + y * R.h]);
    const palmN = Math.hypot((L[0][0] - L[9][0]) * aspect, L[0][1] - L[9][1]) || 0.1;
    const s = Math.hypot(P[0][0] - P[9][0], P[0][1] - P[9][1]) || 40;
    const z01 = L.map((p) => clamp(0.5 - p[2] / (palmN * 1.2), 0, 1));
    const A = e.alpha * (h.held ? 0.85 : 1);
    const gcol = tint(h);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const m = s * 0.5;
    // soft shadow under the hand (reads as depth on the light background)
    ctx.save();
    const sy = y1 + s * 0.35, sg = ctx.createRadialGradient((x0 + x1) / 2, sy, 0, (x0 + x1) / 2, sy, (x1 - x0) * 0.6 + 10);
    sg.addColorStop(0, `rgba(60,50,140,${0.16 * A})`); sg.addColorStop(1, 'rgba(60,50,140,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, sy, (x1 - x0) * 0.6 + 10, s * 0.18, 0, 0, 7); ctx.fill();
    ctx.restore();
    // after-image while moving
    ctx.save(); ctx.lineCap = 'round';
    e.trail.forEach((tr, k) => {
      ctx.strokeStyle = rgba(VIO, 0.07 * A * ((k + 1) / e.trail.length)); ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      for (const [i, j] of EDGES) { ctx.moveTo(R.x + tr[i][0] * R.w, R.y + tr[i][1] * R.h); ctx.lineTo(R.x + tr[j][0] * R.w, R.y + tr[j][1] * R.h); }
      ctx.stroke();
    });
    ctx.restore();
    hologram(ctx, { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m }, d, time,
      (o) => drawSkeleton(o, P, z01, s, A, gcol, time));
    return P;
  }

  /* ---- background of the hand view: light studio gradient with a soft perspective grid (no black) */
  function drawBackground(ctx, W, H, R, d, showCam) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f3f1ff'); g.addColorStop(0.55, '#eaf2ff'); g.addColorStop(1, '#e4f6fb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (showCam) return;
    ctx.save();
    const hz = R.y + R.h * 0.42, cx = R.x + R.w / 2;
    ctx.strokeStyle = 'rgba(109,91,255,.10)'; ctx.lineWidth = 1 * d; ctx.beginPath();
    for (let k = -12; k <= 12; k++) { ctx.moveTo(cx + k * R.w * 0.02, hz); ctx.lineTo(cx + k * R.w * 0.16, R.y + R.h); }
    for (let k = 1; k <= 9; k++) { const y = hz + (R.y + R.h - hz) * Math.pow(k / 9, 1.8); ctx.moveTo(R.x, y); ctx.lineTo(R.x + R.w, y); }
    ctx.stroke();
    const rg = ctx.createRadialGradient(cx, hz + R.h * 0.2, 0, cx, hz + R.h * 0.2, R.w * 0.45);
    rg.addColorStop(0, 'rgba(255,255,255,.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.restore();
  }

  /* ---- 3-D card: world landmarks, drag to rotate */
  const V = { yaw: 0.35, pitch: -0.3, drag: null, user: 0 };
  function buildCard() {
    const stage = $('#hand-stage'); if (!stage || $('#holo-card')) return;
    const c = document.createElement('div');
    c.className = 'holo-card'; c.id = 'holo-card';
    c.innerHTML = `<canvas id="holo3d" title=""></canvas>
      <div class="holo-meta">
        <div class="holo-g"><i></i><b id="holo-g">—</b><small id="holo-side"></small></div>
        <div class="holo-depth"><span id="holo-far"></span><div class="bar"><i id="holo-dm"></i></div><span id="holo-near"></span></div>
        <small id="holo-dist" class="muted"></small>
        <div class="holo-fing" id="holo-f">${'<i></i>'.repeat(5)}</div>
      </div>
      <div class="holo-warn" id="holo-warn" hidden></div>`;
    stage.appendChild(c);
    const cv = $('#holo3d', c);
    cv.addEventListener('pointerdown', (ev) => { V.drag = [ev.clientX, ev.clientY, V.yaw, V.pitch]; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } });
    cv.addEventListener('pointermove', (ev) => {
      if (!V.drag) return;
      V.yaw = V.drag[2] + (ev.clientX - V.drag[0]) * 0.012;
      V.pitch = clamp(V.drag[3] + (ev.clientY - V.drag[1]) * 0.01, -1.3, 1.3);
      V.user = performance.now();
    });
    const up = () => { V.drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', () => { V.yaw = 0.35; V.pitch = -0.3; V.user = 0; });
    // camera picker next to the other buttons
    const tr = $('#hand-stage .float.tr');
    if (tr && !$('#hand-cam')) {
      const l = document.createElement('label');
      l.className = 'camsel'; l.title = t('hh.cam');
      l.innerHTML = `${ic('camera')}<select id="hand-cam"></select>`;
      tr.prepend(l);
      const sel = $('select', l);
      sel.onfocus = () => { if (!(S.cameras || []).length) send({ type: 'scan_cameras' }); };
      sel.onchange = () => {
        if (sel.value === 'scan') { send({ type: 'scan_cameras' }); fillCams(true); return; }
        send({ type: 'source', source: Number(sel.value) });
      };
    }
  }
  let camSig = '';
  function fillCams(force) {
    const sel = $('#hand-cam'); if (!sel || !S.st) return;
    const cur = S.st.video.source, names = (S.st.devices || []).filter((x) => x.kind === 'camera').map((x) => x.name);
    const list = (S.cameras || []).filter((c) => c.ok);
    if (!list.some((c) => c.index === cur) && typeof cur === 'number') list.unshift({ index: cur, ok: true, in_use: true });
    const sig = JSON.stringify([cur, list.map((c) => c.index), names, PH.lang]);
    if (!force && (sig === camSig || document.activeElement === sel)) return;
    camSig = sig;
    const label = (c) => (list.length === 1 && names.length === 1 ? names[0] : `${t('hh.camN', { n: c.index })}${names[c.index] && names.length === list.length ? ` · ${names[c.index]}` : ''}`)
      + (c.width ? ` · ${c.width}×${c.height}` : '');
    sel.innerHTML = list.map((c) => `<option value="${c.index}" ${c.index === cur ? 'selected' : ''}>${esc(label(c))}</option>`).join('')
      + `<option value="scan">${esc(t('hh.scan'))}</option>`;
  }

  function project(Wp, cx, cy, sc) {
    const cyw = Math.cos(V.yaw), syw = Math.sin(V.yaw), cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
    return Wp.map(([x, y, z]) => {
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const f = 1 / (1 + z2 * 2.2);
      return [cx + x1 * sc * f, cy + y2 * sc * f, z2];
    });
  }
  function drawCard(time) {
    const cv = $('#holo3d'); if (!cv || !cv.offsetParent) return;
    const [W, H, d] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const e = [...S.hands.values()].sort((a, b) => b.alpha - a.alpha)[0];
    // platform
    const cx = W / 2, cy = H * 0.5;
    ctx.save();
    const pg = ctx.createRadialGradient(cx, H * 0.86, 0, cx, H * 0.86, W * 0.42);
    pg.addColorStop(0, 'rgba(109,91,255,.22)'); pg.addColorStop(1, 'rgba(109,91,255,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(cx, H * 0.86, W * 0.42, H * 0.08, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(109,91,255,.35)'; ctx.lineWidth = 1 * d;
    for (const k of [1, 0.66, 0.33]) { ctx.beginPath(); ctx.ellipse(cx, H * 0.86, W * 0.4 * k, H * 0.075 * k, 0, 0, 7); ctx.stroke(); }
    ctx.restore();
    if (!e) {
      ctx.fillStyle = '#8b87a8'; ctx.font = `600 ${12 * d}px Figtree, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(t('hh.none'), cx, cy);
      return;
    }
    if (!V.drag && performance.now() - V.user > 4000) V.yaw = 0.35 + 0.35 * Math.sin(time * 0.5);
    let Wp = e.world;
    if (!Wp) { const a = e.lm; Wp = a.map(([x, y, z]) => [x * 0.3, y * 0.3, z * 0.3]); }
    const c = [0, 5, 9, 13, 17].reduce((acc, i) => [acc[0] + Wp[i][0] / 5, acc[1] + Wp[i][1] / 5, acc[2] + Wp[i][2] / 5], [0, 0, 0]);
    const Pw = Wp.map(([x, y, z]) => [x - c[0], y - c[1], z - c[2]]);
    const span = Math.max(...Pw.map((p) => Math.hypot(p[0], p[1], p[2]))) || 0.1;
    const sc = Math.min(W, H) * 0.4 / span;
    const P3 = project(Pw, cx, cy * 0.95, sc);
    const zs = P3.map((p) => p[2]), zmin = Math.min(...zs), zmax = Math.max(...zs);
    const z01 = zs.map((z) => 1 - (z - zmin) / ((zmax - zmin) || 1));
    const s = Math.hypot(P3[0][0] - P3[9][0], P3[0][1] - P3[9][1]) || 40;
    hologram(ctx, { x: 0, y: 0, w: W, h: H }, d, time, (o) => drawSkeleton(o, P3.map((p) => [p[0], p[1]]), z01, s, e.alpha, tint(e.data), time));
  }
  function updateMeta() {
    const e = [...S.hands.values()].sort((a, b) => b.alpha - a.alpha)[0];
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
    set('holo-far', t('hh.far')); set('holo-near', t('hh.near'));
    const card = $('#holo-card'); if (!card) return;
    card.classList.toggle('nohand', !e);
    const v = S.st && S.st.video, warn = $('#holo-warn');
    const slow = v && v.state === 'online' && v.fps > 0 && v.fps < 15;
    if (warn) { warn.hidden = !slow; if (slow) set('holo-warn', t('hh.slow', { f: Math.round(v.fps) })); }
    if (!e) { set('holo-g', '—'); set('holo-dist', ''); set('holo-side', ''); return; }
    const h = e.data, R = { w: (S.st.video.width || 16), h: (S.st.video.height || 9) }, a = R.w / R.h, L = e.lm;
    const palmN = Math.hypot((L[0][0] - L[9][0]) * a, L[0][1] - L[9][1]) || 0.1;
    const dist = clamp(0.095 / (palmN * 0.73), 0.15, 4);             // palm ≈ 9.5 cm, phone camera ≈ 40° vertical
    const near = clamp(1 - (dist - 0.25) / 1.5, 0, 1);
    set('holo-g', PH.gestureName ? PH.gestureName(h.gesture) : h.gesture);
    set('holo-side', h.handedness === 'Left' ? t('hh.left') : h.handedness === 'Right' ? t('hh.right') : '');
    set('holo-dist', t('hh.dist', { d: dist.toFixed(2) }));
    const dm = $('#holo-dm'); if (dm) dm.style.left = `${(near * 100).toFixed(1)}%`;
    const col = tint(h); const gi = $('.holo-g i', card); if (gi) gi.style.background = col ? rgba(col, 1) : '#c9c6dd';
    const ext = [h.thumb ? 1 : 0, ...(h.fingers || [])];
    [...$('#holo-f').children].forEach((el, i) => el.classList.toggle('on', !!ext[i]));
  }

  // client-side smoothing of the world landmarks (the 2-D ones are smoothed in syncHands)
  function syncWorld(dt) {
    for (const e of S.hands.values()) {
      const w = e.data && e.data.world; if (!w) { e.world = null; continue; }
      if (!e.world) { e.world = w.map((p) => p.slice()); continue; }
      const k = 1 - Math.exp(-dt / 0.06);
      e.world.forEach((p, i) => { for (let j = 0; j < 3; j++) p[j] += (w[i][j] - p[j]) * k; });
    }
  }

  let last = 0;
  PH.holo = {
    drawHand, drawBackground,
    frame(time) {
      buildCard();
      const dt = Math.min(0.1, time - last); last = time;
      syncWorld(dt); drawCard(time); updateMeta(); fillCams(false);
    },
  };
})();
