/* Lumo — people strip in the "Dłoń" view while tracking:
 * every detected person with a live photo, a stable number and who is being followed;
 * people who left the picture stay greyed for a while. Click = follow that person.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);

  PH.addI18n({
    pl: { 'tl.people': 'Widoczne osoby: {n}', 'tl.person': 'Osoba {n}', 'tl.follow': 'Śledź', 'tl.tracking': 'ŚLEDZĘ',
      'tl.searching': 'szukam…', 'tl.gone': 'wyszła z kadru · {s} s', 'tl.none': 'Nikogo nie widać', 'tl.conf': 'pewność {p}%' },
    it: { 'tl.people': 'Persone visibili: {n}', 'tl.person': 'Persona {n}', 'tl.follow': 'Segui', 'tl.tracking': 'SEGUO',
      'tl.searching': 'cerco…', 'tl.gone': 'uscita · {s} s fa', 'tl.none': 'Non vedo nessuno', 'tl.conf': 'sicurezza {p}%' },
  });

  const box = document.createElement('div');
  box.className = 'people-strip'; box.hidden = true;
  $('#hand-stage').appendChild(box);
  let sig = '', lastThumb = 0;
  const snaps = new Map();                  // last photo of everyone (kept after they leave)

  function update(st) {
    const vis = st.vision, tr = vis.tracking || {};
    const on = S.tab === 'hand' && (vis.mode === 'track' || st.people_on);
    box.hidden = !on;
    if (!on) return;
    const people = tr.people || [], recent = (tr.recent || []).filter((r) => !people.some((p) => p.id === r.id));
    const s2 = JSON.stringify([people.map((p) => [p.id, p.target]), recent.map((r) => r.id), tr.status, PH.lang]);
    if (s2 !== sig) {
      sig = s2;
      box.innerHTML = `<h5>${esc(people.length ? t('tl.people', { n: people.length }) : t('tl.none'))}</h5>`
        + people.map((p) => `<div class="pp${p.target ? ' target' : ''}" data-id="${p.id}"><canvas width="92" height="116"></canvas>
            <span><b>${esc(t('tl.person', { n: p.id }))}</b><small>${esc(p.target ? t('tl.tracking') : t('tl.conf', { p: Math.round(p.score * 100) }))}</small></span>
            ${p.target ? '' : `<button class="btn sm primary">${esc(t('tl.follow'))}</button>`}</div>`).join('')
        + recent.map((r) => `<div class="pp gone"><canvas width="92" height="116"></canvas><span><b>${esc(t('tl.person', { n: r.id }))}</b>
            <small data-gone="${r.t}">${esc(t('tl.gone', { s: Math.round(Date.now() / 1000 - r.t) }))}</small></span><span></span></div>`).join('');
      for (const el of box.querySelectorAll('.pp[data-id]')) el.onclick = () => {
        const p = (S.st.vision.tracking.people || []).find((x) => x.id === Number(el.dataset.id)); if (!p) return;
        send({ type: 'track_point', x: p.box[0] + p.box[2] / 2, y: p.box[1] + p.box[3] / 2 });
      };
      lastThumb = 0;
      for (const el of box.querySelectorAll('.pp.gone')) {
        const id = Number((el.querySelector('b').textContent.match(/\d+/) || [0])[0]), img = snaps.get(id);
        if (img) el.querySelector('canvas').getContext('2d').drawImage(img, 0, 0);
      }
    }
    for (const el of box.querySelectorAll('[data-gone]')) el.textContent = t('tl.gone', { s: Math.round(Date.now() / 1000 - Number(el.dataset.gone)) });
    // live photos of every person (cropped from the camera frame)
    const now = performance.now();
    if (now - lastThumb > 250 && S.bitmap) {
      lastThumb = now;
      const W = S.bitmap.width, H = S.bitmap.height;
      for (const el of box.querySelectorAll('.pp[data-id]')) {
        const p = people.find((x) => x.id === Number(el.dataset.id)); if (!p) continue;
        const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
        const [x, y, w, h] = p.box, sx = Math.max(0, x * W), sy = Math.max(0, y * H), sw = Math.min(W - sx, w * W), sh = Math.min(H - sy, h * H);
        if (sw > 2 && sh > 2) {
          const k = Math.min(cv.width / sw, cv.height / sh), dw = sw * k, dh = sh * k;
          ctx.fillStyle = '#111c2e'; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(S.bitmap, sx, sy, sw, sh, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
          let c2 = snaps.get(p.id);
          if (!c2) { c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; snaps.set(p.id, c2); }
          c2.getContext('2d').drawImage(cv, 0, 0);
        }
      }
    }
  }
  PH.onState.push(update);
})();
