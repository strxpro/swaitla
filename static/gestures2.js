/* Lumo — Kreator własnego gestu (v2)
 *
 * 1 Rodzaj:   ✋ poza · ↔ poza + ruch dłoni (steruje suwakiem) · 🙌 dwie dłonie razem
 * 2 Nagraj:   podgląd z kamery ze szkieletem, odliczanie 3 s, potem trzymasz pozę 5 s
 * 3 Działanie: akcja (blackout, kolor, efekt, reflektor, autopilot …) albo co steruje ruch w poziomie / pionie
 * 4 Zapisz:   nazwa → gest działa od razu
 */
(() => {
  const PH = window.PH;
  const { S, send, t, toast, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'gc.title': 'Nowy gest', 'gc.s1': '1 Rodzaj', 'gc.s2': '2 Nagraj', 'gc.s3': '3 Działanie', 'gc.s4': '4 Zapisz',
      'gc.kind': 'Jaki gest chcesz utworzyć?',
      'gc.pose': 'Poza dłoni', 'gc.pose.d': 'Pokaż pozę jedną dłonią i przytrzymaj — wykona się akcja (np. blackout, kolor, efekt).',
      'gc.motion': 'Poza + ruch', 'gc.motion.d': 'Trzymaj pozę i przesuwaj dłoń: lewo / prawo i góra / dół sterują np. jasnością, ruchem lampy albo kolorem.',
      'gc.two': 'Dwie dłonie', 'gc.two.d': 'Każda dłoń pokazuje swoją pozę — dopiero razem wyzwalają akcję. Trudno o przypadek.',
      'gc.rec.i': 'Kliknij „Nagraj”, ustaw dłoń{s} przed kamerą. Po odliczaniu trzymaj pozę nieruchomo przez 5 sekund.',
      'gc.rec.both': ' (obie dłonie)',
      'gc.rec': 'Nagraj', 'gc.again': 'Nagraj jeszcze raz', 'gc.stop': 'Przerwij',
      'gc.ready': 'Przygotuj się…', 'gc.hold': 'Trzymaj!', 'gc.sec': 'sekund',
      'gc.need1': 'Pokaż dłoń kamerze', 'gc.need2': 'Pokaż obie dłonie',
      'gc.ok': '✓ Nagrano — jakość {q}%', 'gc.fail': 'Nie widziałem dłoni wystarczająco długo — nagraj jeszcze raz',
      'gc.act': 'Co ma się stać, gdy pokażesz ten gest?', 'gc.map': 'Co ma sterować ruch dłoni, gdy trzymasz pozę?',
      'gc.mapx': '↔ Ruch w lewo / prawo steruje', 'gc.mapy': '↕ Ruch w górę / dół steruje',
      'gc.maphint': 'Dłoń w prawo / w górę = więcej. Puść pozę, żeby zostawić ustawioną wartość.',
      'gc.name': 'Nazwa gestu', 'gc.namep': 'np. Rock, Refren, Suwak jasności', 'gc.save': 'Zapisz gest', 'gc.cancel': 'Anuluj',
      'gc.back': '← Wstecz', 'gc.next': 'Dalej →', 'gc.sum': 'Podsumowanie',
      'gc.color': 'Kolor', 'gc.effect': 'Efekt', 'gc.mood': 'Styl',
      'mo.none': '— nic —', 'mo.dimmer': 'Jasność', 'mo.pan': 'Ruch lampy w poziomie', 'mo.tilt': 'Ruch lampy w pionie',
      'mo.hue': 'Kolor', 'mo.strobe': 'Strobo', 'mo.master': 'Master (wszystkie)', 'mo.fx_speed': 'Tempo efektów',
      'ga.blackout': 'Blackout wł./wył.', 'ga.full': 'Pełna jasność', 'ga.dark': 'Wygaś', 'ga.flash': 'Flash',
      'ga.strobe': 'Strobo 2 s', 'ga.home': 'Lampy na środek', 'ga.next_fixture': 'Następna lampa', 'ga.color': 'Kolor…',
      'ga.effect': 'Efekt…', 'ga.stop_effects': 'Zatrzymaj efekty', 'ga.spotlight': 'Reflektor na osobę', 'ga.autopilot': 'Autopilot',
    },
    it: {
      'gc.title': 'Nuovo gesto', 'gc.s1': '1 Tipo', 'gc.s2': '2 Registra', 'gc.s3': '3 Azione', 'gc.s4': '4 Salva',
      'gc.kind': 'Che gesto vuoi creare?',
      'gc.pose': 'Posa della mano', 'gc.pose.d': 'Mostra una posa con una mano e tienila — parte un’azione (es. blackout, colore, effetto).',
      'gc.motion': 'Posa + movimento', 'gc.motion.d': 'Tieni la posa e muovi la mano: sinistra / destra e su / giù regolano es. luminosità, movimento o colore.',
      'gc.two': 'Due mani', 'gc.two.d': 'Ogni mano fa la sua posa — solo insieme fanno partire l’azione. Difficile per sbaglio.',
      'gc.rec.i': 'Premi „Registra”, metti la mano{s} davanti alla camera. Dopo il conto alla rovescia tieni la posa ferma per 5 secondi.',
      'gc.rec.both': ' (entrambe le mani)',
      'gc.rec': 'Registra', 'gc.again': 'Registra di nuovo', 'gc.stop': 'Interrompi',
      'gc.ready': 'Preparati…', 'gc.hold': 'Tieni!', 'gc.sec': 'secondi',
      'gc.need1': 'Mostra la mano alla camera', 'gc.need2': 'Mostra entrambe le mani',
      'gc.ok': '✓ Registrato — qualità {q}%', 'gc.fail': 'Non ho visto la mano abbastanza a lungo — registra di nuovo',
      'gc.act': 'Cosa deve succedere quando mostri questo gesto?', 'gc.map': 'Cosa regola il movimento della mano mentre tieni la posa?',
      'gc.mapx': '↔ Sinistra / destra regola', 'gc.mapy': '↕ Su / giù regola',
      'gc.maphint': 'Mano a destra / in alto = di più. Lascia la posa per mantenere il valore.',
      'gc.name': 'Nome del gesto', 'gc.namep': 'es. Rock, Ritornello, Cursore luce', 'gc.save': 'Salva gesto', 'gc.cancel': 'Annulla',
      'gc.back': '← Indietro', 'gc.next': 'Avanti →', 'gc.sum': 'Riepilogo',
      'gc.color': 'Colore', 'gc.effect': 'Effetto', 'gc.mood': 'Stile',
      'mo.none': '— niente —', 'mo.dimmer': 'Luminosità', 'mo.pan': 'Movimento orizzontale', 'mo.tilt': 'Movimento verticale',
      'mo.hue': 'Colore', 'mo.strobe': 'Strobo', 'mo.master': 'Master (tutte)', 'mo.fx_speed': 'Tempo degli effetti',
      'ga.blackout': 'Blackout on/off', 'ga.full': 'Luce piena', 'ga.dark': 'Spegni', 'ga.flash': 'Flash',
      'ga.strobe': 'Strobo 2 s', 'ga.home': 'Luci al centro', 'ga.next_fixture': 'Luce successiva', 'ga.color': 'Colore…',
      'ga.effect': 'Effetto…', 'ga.stop_effects': 'Ferma effetti', 'ga.spotlight': 'Occhio di bue sulla persona', 'ga.autopilot': 'Autopilota',
    },
  });

  const KINDS = [['pose', 'hand'], ['motion', 'arrows'], ['two', 'twohands']];
  const ACTIONS = [['blackout', 'blackout'], ['full', 'sun'], ['dark', 'dark'], ['flash', 'bolt'], ['strobe', 'pulse'], ['home', 'target'],
    ['next_fixture', 'next'], ['color', 'drop'], ['effect', 'sparkle'], ['stop_effects', 'stop'], ['spotlight', 'spot'], ['autopilot', 'auto']];
  const MOTION = ['none', 'dimmer', 'pan', 'tilt', 'hue', 'strobe', 'master', 'fx_speed'];
  PH.motionName = (k) => t(`mo.${k}`);
  const GC = { step: 0, kind: 'pose', action: 'blackout', color: '#ff0050', effect: 'circle', mood: 'dance',
    map: { x: 'hue', y: 'dimmer' }, name: '', recorded: false, wasRec: false, failed: false };

  function dialog() {
    let d = $('#gc-dialog');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'gc-dialog'; document.body.appendChild(d);
      d.addEventListener('close', () => {
        S.gcVideo = false;
        const cg = S.st && S.st.interaction.custom;
        if (cg && (cg.recording || cg.pending)) send({ type: 'gesture_cancel' });
      });
      d.addEventListener('cancel', (e) => { e.preventDefault(); d.close(); });
    }
    return d;
  }
  PH.openGestureCreator = () => {
    Object.assign(GC, { step: 0, kind: 'pose', action: 'blackout', name: '', recorded: false, wasRec: false, failed: false });
    S.gcVideo = true;
    render();
    dialog().showModal();
  };

  function render() {
    const d = dialog();
    const stepsHtml = ['gc.s1', 'gc.s2', 'gc.s3', 'gc.s4'].map((k, i) => `<span class="${i === GC.step ? 'on' : i < GC.step ? 'done' : ''}">${esc(t(k))}</span>`).join('');
    let body = '';
    if (GC.step === 0) {
      body = `<p><b>${esc(t('gc.kind'))}</b></p><div class="choice-grid">${KINDS.map(([k, icn]) => `<button class="choice${GC.kind === k ? ' on' : ''}" data-kind="${k}">
        ${ic(icn, 'big')}<b>${esc(t(`gc.${k}`))}</b><small>${esc(t(`gc.${k}.d`))}</small></button>`).join('')}</div>`;
    } else if (GC.step === 1) {
      body = `<p>${esc(t('gc.rec.i', { s: GC.kind === 'two' ? t('gc.rec.both') : '' }))}</p>
        <div class="gc-rec"><canvas class="gc-cam" id="gc-cam"></canvas>
          <div><div class="gc-ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" id="gc-fg" cx="60" cy="60" r="52" stroke-dasharray="326.7" stroke-dashoffset="326.7"/></svg>
            <div class="mid"><div><b id="gc-num">5</b><small id="gc-lab">${esc(t('gc.sec'))}</small></div></div></div>
            <p class="gc-note" id="gc-note"></p>
            <div class="st-actions" style="justify-content:center"><button class="btn primary big-btn" id="gc-rec">${ic(GC.recorded ? 'refresh' : 'rec')}<span>${esc(t(GC.recorded ? 'gc.again' : 'gc.rec'))}</span></button></div></div></div>`;
    } else if (GC.step === 2) {
      if (GC.kind === 'motion') {
        const opts = (cur) => MOTION.map((k) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(t(`mo.${k}`))}</option>`).join('');
        body = `<p><b>${esc(t('gc.map'))}</b></p><div class="gc-map">
          <label>${esc(t('gc.mapx'))}<select id="gc-mx">${opts(GC.map.x)}</select></label>
          <label>${esc(t('gc.mapy'))}<select id="gc-my">${opts(GC.map.y)}</select></label></div><p class="hint">${esc(t('gc.maphint'))}</p>`;
      } else {
        const fx = PH.fxCatalogue ? PH.fxCatalogue().filter(([k]) => !['position', 'dark', 'fade_in', 'fade_out', 'kicks', 'hit'].includes(k)) : [];
        body = `<p><b>${esc(t('gc.act'))}</b></p><div class="choice-grid">${ACTIONS.map(([k, icn]) => `<button class="choice sm${GC.action === k ? ' on' : ''}" data-act="${k}">
          ${ic(icn, 'big')}<b>${esc(t(`ga.${k}`))}</b></button>`).join('')}</div>
          <div class="gc-map">
            <label ${GC.action === 'color' ? '' : 'hidden'}>${esc(t('gc.color'))}<input type="color" id="gc-color" value="${GC.color}"></label>
            <label ${GC.action === 'effect' ? '' : 'hidden'}>${esc(t('gc.effect'))}<select id="gc-fx">${fx.map(([k, n]) => `<option value="${esc(k)}" ${GC.effect === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
            <label ${GC.action === 'autopilot' ? '' : 'hidden'}>${esc(t('gc.mood'))}<select id="gc-mood">${['calm', 'dynamic', 'dance', 'rave'].map((m) => `<option value="${m}" ${GC.mood === m ? 'selected' : ''}>${esc(t(`mood.${m}`))}</option>`).join('')}</select></label>
          </div>`;
      }
    } else {
      const what = GC.kind === 'motion'
        ? ['x', 'y'].filter((a) => GC.map[a] !== 'none').map((a) => `${a === 'x' ? '↔' : '↕'} ${t(`mo.${GC.map[a]}`)}`).join(' · ')
        : t(`ga.${GC.action}`);
      body = `<label class="cr-name">${esc(t('gc.name'))}<input id="gc-name" maxlength="30" value="${esc(GC.name)}" placeholder="${esc(t('gc.namep'))}"></label>
        <div class="st-status ok">${ic(KINDS.find((k) => k[0] === GC.kind)[1])} <span>${esc(t(`gc.${GC.kind}`))} → ${esc(what)}</span></div>`;
    }
    d.innerHTML = `<div class="gc"><div class="gc-top"><h3>${esc(t('gc.title'))}</h3><div class="gc-steps">${stepsHtml}</div></div>
      <div class="gc-body">${body}</div>
      <div class="gc-foot"><button class="btn" id="gc-cancel">${esc(t('gc.cancel'))}</button><span class="grow"></span>
        ${GC.step ? `<button class="btn" id="gc-back">${esc(t('gc.back'))}</button>` : ''}
        ${GC.step < 3 ? `<button class="btn primary" id="gc-next" ${GC.step === 1 && !GC.recorded ? 'disabled' : ''}>${esc(t('gc.next'))}</button>`
          : `<button class="btn primary" id="gc-save">${esc(t('gc.save'))}</button>`}</div></div>`;
    bind(d);
  }

  function bind(d) {
    const on = (id, fn) => { const el = $(`#${id}`, d); if (el) el.onclick = fn; };
    on('gc-cancel', () => d.close());
    on('gc-back', () => { GC.step--; render(); });
    on('gc-next', () => { GC.step++; render(); });
    for (const b of $$('[data-kind]', d)) b.onclick = () => { GC.kind = b.dataset.kind; GC.recorded = false; GC.step = 1; render(); };
    for (const b of $$('[data-act]', d)) b.onclick = () => { GC.action = b.dataset.act; render(); };
    on('gc-rec', () => {
      send({ type: 'mode', mode: 'gesture' });
      send({ type: 'gesture_record', kind: GC.kind });
      GC.recorded = false; GC.wasRec = true; GC.failed = false;
      $('#gc-next', d).disabled = true;
    });
    const sel = (id, fn) => { const el = $(`#${id}`, d); if (el) el.onchange = () => fn(el.value); };
    sel('gc-mx', (v) => { GC.map.x = v; });
    sel('gc-my', (v) => { GC.map.y = v; });
    sel('gc-fx', (v) => { GC.effect = v; });
    sel('gc-mood', (v) => { GC.mood = v; });
    const col = $('#gc-color', d); if (col) col.oninput = () => { GC.color = col.value; };
    const nm = $('#gc-name', d); if (nm) { nm.oninput = () => { GC.name = nm.value; }; setTimeout(() => nm.focus(), 50); nm.onkeydown = (e) => { if (e.key === 'Enter') save(); }; }
    on('gc-save', save);
  }
  function save() {
    const params = {};
    if (GC.action === 'color') params.rgb = [1, 3, 5].map((i) => parseInt(GC.color.slice(i, i + 2), 16));
    if (GC.action === 'effect') params.kind = GC.effect;
    if (GC.action === 'autopilot') params.mood = GC.mood;
    send({ type: 'gesture_save', name: GC.name.trim() || (GC.kind === 'motion' ? t('gc.motion') : t('gc.pose')),
           action: GC.kind === 'motion' ? 'motion' : GC.action, params, map: GC.kind === 'motion' ? GC.map : null });
    dialog().close();
    if (S.tab !== 'hand') PH.setTab('hand');
  }

  /* ------------------------------------------------------------ live recording view */
  function update(st) {
    const d = $('#gc-dialog'); if (!d || !d.open || GC.step !== 1) return;
    const cg = st.interaction.custom, rec = cg.recording;
    const num = $('#gc-num', d), lab = $('#gc-lab', d), fg = $('#gc-fg', d), note = $('#gc-note', d);
    if (!num) return;
    if (rec) {
      const wait = rec.phase === 'wait';
      PH.setText(num, wait ? String(Math.ceil(rec.left)) : rec.left.toFixed(1));
      PH.setText(lab, t(wait ? 'gc.ready' : 'gc.hold'));
      fg.style.stroke = wait ? '#f59e0b' : '#2b8cff';
      fg.setAttribute('stroke-dashoffset', String(326.7 * (1 - (wait ? 1 - rec.left / 3 : rec.progress))));
      PH.setText(note, rec.hint ? t(rec.hint === 'need2' ? 'gc.need2' : 'gc.need1') : '');
      note.className = `gc-note${rec.hint ? ' warn' : ''}`;
    } else if (GC.wasRec) {
      GC.wasRec = false;
      if (cg.pending) {
        GC.recorded = true;
        PH.setText(num, '✓'); PH.setText(lab, '');
        fg.style.stroke = '#22c55e'; fg.setAttribute('stroke-dashoffset', '0');
        PH.setText(note, t('gc.ok', { q: Math.round((cg.pending.quality ?? 1) * 100) })); note.className = 'gc-note';
        $('#gc-rec', d).innerHTML = `${ic('refresh')}<span>${esc(t('gc.again'))}</span>`;
        $('#gc-next', d).disabled = false;
      } else {
        PH.setText(note, t('gc.fail')); note.className = 'gc-note warn';
      }
    }
  }
  function drawCam() {
    const d = $('#gc-dialog'); if (!d || !d.open || GC.step !== 1) return;
    const cv = $('#gc-cam', d); if (!cv) return;
    const [W, H, dp] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
    ctx.fillStyle = '#070b12'; ctx.fillRect(0, 0, W, H);
    let R = { x: 0, y: 0, w: W, h: H };
    if (S.bitmap) {
      const ar = S.bitmap.width / S.bitmap.height; let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
      R = { x: (W - w) / 2, y: (H - h) / 2, w, h };
      ctx.globalAlpha = 0.75; ctx.drawImage(S.bitmap, R.x, R.y, R.w, R.h); ctx.globalAlpha = 1;
    }
    const hands = (S.st && S.st.vision.perception.hands) || [];
    const recording = S.st && S.st.interaction.custom.recording && S.st.interaction.custom.recording.phase === 'rec';
    for (const h of hands) {
      const P = h.landmarks.map(([x, y]) => [R.x + x * R.w, R.y + y * R.h]);
      ctx.strokeStyle = recording ? '#4da3ff' : '#e6f1ff'; ctx.lineWidth = 3 * dp; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [a, b] of PH.HAND_EDGES) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
      ctx.stroke();
      ctx.fillStyle = recording ? '#ffffff' : '#4da3ff';
      for (const p of P) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5 * dp, 0, 7); ctx.fill(); }
    }
  }
  PH.onState.push(update);
  const loop = () => { drawCam(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
})();
