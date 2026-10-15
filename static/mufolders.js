/* Lumo — Muzyka: folders "Zapisane pokazy", "Moje efekty" and "Zaawansowane".
 * Uses the functions of music.js (tlLoad, tlDeleteShow, crOpen, crDelete, padToggle, TL, PAD, FX).
 */
(() => {
  const PH = window.PH;
  const { S, send, t, toast, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'ms.none': 'Nie masz jeszcze zapisanych pokazów.', 'ms.noneH': 'Ułóż pokaz na osi czasu, wpisz nazwę i kliknij Zapisz.',
      'ms.toTl': 'Przejdź do osi czasu', 'ms.open': 'Otwórz', 'ms.del': 'Usuń', 'ms.cues': 'klatek: {n}', 'ms.song': 'utwór: {s}', 'ms.nosong': 'bez utworu',
      'ms.refresh': 'Odśwież',
      'mm.none': 'Nie masz jeszcze własnych efektów.', 'mm.noneH': 'Zrób efekt: narysuj ruch, dodaj kolory i warstwy.',
      'mm.new': 'Nowy efekt', 'mm.play': 'Zagraj', 'mm.stop': 'Zatrzymaj', 'mm.edit': 'Zmień', 'mm.del': 'Usuń', 'mm.layers': 'warstw: {n}',
      'ma.sync': 'Przesunięcie światła', 'ma.sync.d': 'Gdy światło spóźnia się albo wyprzedza dźwięk: + = światło wcześniej, − = później.',
      'ma.bpm': 'Tempo (BPM)', 'ma.bpm.d': 'Efekty z długością w bitach chodzą w tym tempie. Wystukaj je albo wpisz.',
      'ma.tap': 'Wystukaj', 'ma.set': 'Ustaw', 'ma.now': 'teraz: {b}', 'ma.none': 'teraz: brak',
      'ma.tempo': 'Tempo efektów', 'ma.tempo.d': 'Szybkość wszystkich efektów naraz; 1× = normalnie.',
      'ma.sens': 'Czułość bitu (na żywo)', 'ma.sens.d': 'W lewo łapie więcej bitów, w prawo tylko mocne uderzenia.',
      'ma.magnet': 'Przyciąganie klatek', 'ma.magnet.d': 'Klatki na osi czasu same przyciągają się do kicków i bitów.',
      'ma.auto': 'Auto-show', 'ma.auto.d': 'Styl, kolory i efekty, z których Auto-show układa pokaz.', 'ma.autoBtn': 'Ustawienia auto-show',
      'ma.saved': 'Zapisano',
    },
    it: {
      'ms.none': 'Non hai ancora show salvati.', 'ms.noneH': 'Crea uno show nella timeline, scrivi il nome e premi Salva.',
      'ms.toTl': 'Vai alla timeline', 'ms.open': 'Apri', 'ms.del': 'Elimina', 'ms.cues': 'keyframe: {n}', 'ms.song': 'brano: {s}', 'ms.nosong': 'senza brano',
      'ms.refresh': 'Aggiorna',
      'mm.none': 'Non hai ancora effetti tuoi.', 'mm.noneH': 'Crea un effetto: disegna il movimento, aggiungi colori e livelli.',
      'mm.new': 'Nuovo effetto', 'mm.play': 'Suona', 'mm.stop': 'Ferma', 'mm.edit': 'Modifica', 'mm.del': 'Elimina', 'mm.layers': 'livelli: {n}',
      'ma.sync': 'Ritardo della luce', 'ma.sync.d': 'Se la luce è in ritardo o in anticipo sul suono: + = luce prima, − = dopo.',
      'ma.bpm': 'Tempo (BPM)', 'ma.bpm.d': 'Gli effetti con durata in beat seguono questo tempo. Battilo o scrivilo.',
      'ma.tap': 'Batti il tempo', 'ma.set': 'Imposta', 'ma.now': 'ora: {b}', 'ma.none': 'ora: nessuno',
      'ma.tempo': 'Tempo degli effetti', 'ma.tempo.d': 'Velocità di tutti gli effetti insieme; 1× = normale.',
      'ma.sens': 'Sensibilità del beat (dal vivo)', 'ma.sens.d': 'A sinistra prende più beat, a destra solo i colpi forti.',
      'ma.magnet': 'Aggancio dei keyframe', 'ma.magnet.d': 'I keyframe nella timeline si agganciano da soli a kick e beat.',
      'ma.auto': 'Auto-show', 'ma.auto.d': 'Stile, colori ed effetti con cui l’Auto-show crea lo show.', 'ma.autoBtn': 'Impostazioni auto-show',
      'ma.saved': 'Salvato',
    },
  });

  const srow = (key, ctl) => `<div class="srow"><div><b>${esc(t(key))}</b><small>${esc(t(key + '.d'))}</small></div><div class="ctl">${ctl}</div></div>`;
  const empty = (icon, title, hint, btn) => `<div class="fold-empty">${ic(icon)}<b>${esc(title)}</b><p>${esc(hint)}</p>${btn}</div>`;

  /* ---- saved shows */
  async function renderShows() {
    const box = $('#mu-shows'); if (!box) return;
    let list = [];
    try { list = await (await fetch('/api/shows')).json(); } catch (e) { /* offline */ }
    if (!list.length) {
      box.innerHTML = empty('film', t('ms.none'), t('ms.noneH'), `<button class="btn primary" id="ms-go">${ic('film')}<span>${esc(t('ms.toTl'))}</span></button>`);
      $('#ms-go', box).onclick = () => PH.foldGo('music', 'timeline');
      return;
    }
    box.innerHTML = `<div class="item-list">${list.map((s) => `<div class="item-row"><span class="dev-ic">${ic('film')}</span>
        <span><b>${esc(s.name)}</b><small>${esc(t('ms.cues', { n: s.cues ?? 0 }))} · ${esc(s.audio ? t('ms.song', { s: s.audio }) : t('ms.nosong'))}</small></span>
        <span class="acts"><button class="btn sm primary" data-open="${esc(s.name)}">${ic('play')}<span>${esc(t('ms.open'))}</span></button>
          <button class="btn sm danger-t" data-del="${esc(s.name)}">${ic('trash')}<span>${esc(t('ms.del'))}</span></button></span></div>`).join('')}</div>`;
    for (const b of $$('[data-open]', box)) b.onclick = async () => {
      await tlRefreshShows(); $('#tl-shows').value = b.dataset.open;
      await tlLoad(); PH.foldGo('music', 'timeline');
    };
    for (const b of $$('[data-del]', box)) b.onclick = async () => {
      await tlRefreshShows(); $('#tl-shows').value = b.dataset.del;
      await tlDeleteShow(); setTimeout(renderShows, 300);
    };
  }

  /* ---- my effects */
  function renderMine() {
    const box = $('#mu-mine'); if (!box) return;
    const names = Object.keys(FX.preset.kinds || {});
    const active = new Set(((S.st && S.st.effects.active) || []).map((a) => a.id));
    const sig = JSON.stringify([names, [...active].filter((x) => x.startsWith('pad-preset:')), PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const add = `<button class="btn primary" id="mm-new">${ic('plus')}<span>${esc(t('mm.new'))}</span></button>`;
    if (!names.length) {
      box.innerHTML = empty('layers', t('mm.none'), t('mm.noneH'), add);
    } else {
      box.innerHTML = `<div class="st-actions">${add}</div><div class="item-list">${names.map((n) => {
        const p = FX.preset.kinds[n][2] || {}, on = active.has(`pad-preset:${n}`);
        return `<div class="item-row${on ? ' playing' : ''}"><span class="dev-ic" style="--c:${esc(p.color || '#db2777')}">${ic('layers')}</span>
          <span><b>${esc(n)}</b><small>${esc(t('mm.layers', { n: (p.layers || []).length || 1 }))}</small></span>
          <span class="acts"><button class="btn sm ${on ? '' : 'primary'}" data-play="${esc(n)}">${ic(on ? 'stop' : 'play')}<span>${esc(t(on ? 'mm.stop' : 'mm.play'))}</span></button>
            <button class="btn sm" data-edit="${esc(n)}">${ic('edit')}<span>${esc(t('mm.edit'))}</span></button>
            <button class="btn sm danger-t" data-del="${esc(n)}">${ic('trash')}<span>${esc(t('mm.del'))}</span></button></span></div>`;
      }).join('')}</div>`;
    }
    $('#mm-new', box).onclick = () => crOpen(null);
    for (const b of $$('[data-play]', box)) b.onclick = () => padToggle(`preset:${b.dataset.play}`);
    for (const b of $$('[data-edit]', box)) b.onclick = () => crOpen(b.dataset.edit);
    for (const b of $$('[data-del]', box)) b.onclick = async () => { await crDelete(b.dataset.del); box.dataset.sig = ''; renderMine(); };
  }

  /* ---- advanced */
  const TAP = [];
  function renderAdv(force) {
    const box = $('#mu-adv'); if (!box) return;
    const st = S.st, bpm = st && st.effects.bpm, sc = (st && st.effects.speed_scale) || 1;
    const sig = JSON.stringify([Math.round(bpm || 0), sc, TL.magnet, PH.lang]);
    if (!force && (box.dataset.sig === sig || box.contains(document.activeElement))) return;
    box.dataset.sig = sig;
    const sens = $('#mu-sens');
    box.innerHTML = `<section class="sgroup">
        ${srow('ma.sync', `<input type="number" id="ma-sync" min="-300" max="300" step="5" value="${TL.sync}"><span class="unit">ms</span>`)}
        ${srow('ma.bpm', `<span class="tagc" id="ma-now">${esc(bpm ? t('ma.now', { b: Math.round(bpm) }) : t('ma.none'))}</span>
          <button class="btn" id="ma-tap">${ic('drum')}<span>${esc(t('ma.tap'))}</span></button>
          <input type="number" id="ma-bpm" min="40" max="220" step="0.5" value="${bpm ? Math.round(bpm * 10) / 10 : ''}" placeholder="120">
          <button class="btn primary" id="ma-set">${esc(t('ma.set'))}</button>`)}
        ${srow('ma.tempo', `<input type="range" id="ma-tempo" min="0" max="1" step="0.01" value="${(sc - 0.25) / 2.75}"><output>${sc.toFixed(2)}×</output>`)}
        ${sens && !sens.closest("[hidden]") ? srow('ma.sens', `<input type="range" id="ma-sens" min="${sens.min}" max="${sens.max}" step="${sens.step}" value="${sens.value}"><output>${Number(sens.value).toFixed(2)}</output>`) : ''}
        ${srow('ma.magnet', `<label class="switch"><input type="checkbox" id="ma-magnet" ${TL.magnet ? 'checked' : ''}><span></span></label>`)}
        ${srow('ma.auto', `<button class="btn" id="ma-auto">${ic('sparkle')}<span>${esc(t('ma.autoBtn'))}</span></button>`)}
      </section>`;
    $('#ma-sync', box).onchange = (e) => {
      TL.sync = Number(e.target.value) || 0; try { localStorage.setItem('ph_sync', TL.sync); } catch (err) { /* ignore */ }
      send({ type: 'sync', ms: TL.sync });
      const other = $('#tl-sync'); if (other) other.value = TL.sync;
      toast(t('ma.saved'));
    };
    $('#ma-tap', box).onclick = () => {
      const now = performance.now();
      if (TAP.length && now - TAP[TAP.length - 1] > 2000) TAP.length = 0;
      TAP.push(now); if (TAP.length > 9) TAP.shift();
      if (TAP.length >= 3) {
        const avg = (TAP[TAP.length - 1] - TAP[0]) / (TAP.length - 1);
        $('#ma-bpm', box).value = Math.round(60000 / avg * 10) / 10;
      }
      const b = $('#ma-tap', box); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120);
    };
    $('#ma-set', box).onclick = () => { const v = Number($('#ma-bpm', box).value); if (v >= 40 && v <= 220) { send({ type: 'bpm', value: v }); toast(t('ma.saved')); box.dataset.sig = ''; } };
    const tp = $('#ma-tempo', box);
    tp.oninput = () => { tp.nextElementSibling.textContent = `${(0.25 + Number(tp.value) * 2.75).toFixed(2)}×`; send({ type: 'fx_speed', value: Number(tp.value) }); };
    const ms = $('#ma-sens', box);
    if (ms) ms.oninput = () => { ms.nextElementSibling.textContent = Number(ms.value).toFixed(2); sens.value = ms.value; sens.dispatchEvent(new Event('input', { bubbles: true })); sens.dispatchEvent(new Event('change', { bubbles: true })); };
    $('#ma-magnet', box).onchange = (e) => { TL.magnet = e.target.checked; const b = $('#tl-magnet'); if (b) b.classList.toggle('on', TL.magnet); };
    $('#ma-auto', box).onclick = () => { PH.foldGo('music', 'timeline'); openAutoShow(); };
  }

  PH.onFold.push((page, id) => {
    if (page !== 'music') return;
    if (id === 'shows') renderShows();
    if (id === 'mine') { const b = $('#mu-mine'); if (b) b.dataset.sig = ''; renderMine(); }
    if (id === 'adv') renderAdv(true);
  });
  PH.onState.push(() => {
    if (S.tab !== 'music') return;
    const f = PH.foldOf('music');
    if (f === 'mine') renderMine();
    if (f === 'adv') renderAdv(false);
  });
})();
