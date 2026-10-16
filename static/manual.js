/* Lumo — Pokaz: the parts of the show run by hand.
 *
 * Sceny:            saved looks; one click puts a scene on top of the running show (its lamps are
 *                   held, the other lamps keep playing), "Puść" hands them back to the show.
 * Reflektor ręczny: the stage seen from above.  Click where the person stands (a saxophonist, a
 *                   speech, the cake) → the chosen lamps aim there (3-D inverse kinematics) and stay;
 *                   colour and brightness for them; "Zapisz jako scenę" keeps it for later.
 *                   "Rozstaw lampy": drag every lamp to where it really hangs - then the aim is right.
 * Uses PH (app.js), ic (icons.js).  Renders into #sh-scenes and #sh-manual (built by live.js).
 */
'use strict';
(() => {
  const PH = window.PH;
  const { S, send, t, esc, toast } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const HOLD = 86400;                                  // "until I say so"

  PH.addI18n({
    pl: {
      'scn.title': 'Sceny', 'scn.sub': 'Jedno kliknięcie = zapisany wygląd świateł. Pokaz gra dalej na pozostałych lampach.',
      'scn.save': 'Zapisz obecny wygląd', 'scn.name': 'Nazwa sceny (np. Pierwszy taniec, Tort, Saksofonista):', 'scn.saved': 'Zapisano scenę „{n}”',
      'scn.del': 'Usunąć scenę „{n}”?', 'scn.none': 'Nie masz jeszcze scen. Ustaw światła (np. reflektorem poniżej) i kliknij „Zapisz obecny wygląd”.',
      'scn.held': 'Ręcznie trzymasz {n} — pokaz ich nie rusza', 'scn.release': 'Puść wszystko — wróć do pokazu', 'scn.on': 'Scena „{n}”',
      'mn.title': 'Reflektor ręczny', 'mn.sub': 'Kliknij na planie, gdzie stoi osoba — wybrane lampy tam pojadą i zostaną. Kliknij lampę na planie, żeby ją dodać albo odjąć.',
      'mn.aim': 'Celuj', 'mn.place': 'Rozstaw lampy', 'mn.placeHint': 'Przeciągnij lampę tam, gdzie naprawdę stoi lub wisi. Dzięki temu celowanie trafia.',
      'mn.lamps': 'Które lampy', 'mn.allHeads': 'Wszystkie głowice', 'mn.color': 'Kolor', 'mn.fromShow': 'z pokazu', 'mn.dim': 'Jasność',
      'mn.saveScene': 'Zapisz jako scenę', 'mn.release': 'Puść — wróć do pokazu', 'mn.none': 'Najpierw dodaj lampy (Ustawienia → Moje lampy).',
      'mn.back': 'tył sceny', 'mn.front': 'publiczność', 'mn.mount': 'Montaż', 'mn.hang': 'wisząca', 'mn.floor': 'stojąca', 'mn.height': 'Wysokość',
      'mn.noHeads': 'Wybierz przynajmniej jedną lampę.', 'mn.sceneName': 'Nazwa sceny:', 'mn.solo': 'Solo',
      'fix.title': 'Popraw celowanie', 'fix.sub': 'Lampy celują teraz w zaznaczone miejsce (krzyżyk na planie). Któraś nie trafia? Wybierz ją, przesuń jej światło strzałkami dokładnie na to miejsce i kliknij „Zapisz poprawkę”. Zrób to w 2–3 miejscach sali (środek, lewo, prawo) — kliknięcie na planie zmienia miejsce.',
      'fix.pick': 'Zaznacz u góry („Które lampy”) przynajmniej jedną głowicę.', 'fix.step': 'krok', 'fix.fine': 'dokładnie',
      'fix.mid': 'Celuj w środek sali i poprawiaj', 'fix.l1': '1. Która lampa nie trafia?', 'fix.l2': '2. Przesuń jej światło na miejsce:', 'fix.where': 'Miejsce: {x} m w bok, {z} m w głąb (kliknij na planie, żeby zmienić)',
      'fix.off': 'przesunięte: {s}', 'fix.r': '{n} cm w prawo', 'fix.l': '{n} cm w lewo', 'fix.b': '{n} cm do tyłu', 'fix.f': '{n} cm do przodu', 'fix.none0': 'bez przesunięcia', 'fix.save': 'Zapisz poprawkę', 'fix.clear': 'Usuń poprawki ({n})',
      'fix.saved': 'Zapamiętane — {n} poprawek dla „{l}”', 'fix.cleared': 'Poprawki usunięte', 'fix.n': '{n} popr.',
      'scn.menuOn': 'Włącz scenę', 'scn.menuUpd': 'Nadpisz tym, co teraz świeci', 'scn.menuRen': 'Zmień nazwę…', 'scn.menuDel': 'Usuń scenę', 'scn.updated': 'Scena „{n}” zaktualizowana',
      'scn.fx': 'z efektami', 'scn.hint': 'Prawy przycisk na scenie: nadpisz, zmień nazwę, usuń.',
      'mn.move': 'Ruch wokół osoby', 'mn.mv0': 'brak', 'mn.mv1': 'delikatny', 'mn.mv2': 'mocniejszy', 'mn.gobo': 'Obracające się gobo',
      'mo.title': 'Momenty', 'mo.sub': 'Jedno kliknięcie ustawia nastrój na dany moment imprezy.',
      'mo.dinner': 'Kolacja', 'mo.dinnerS': 'ciepło i spokojnie', 'mo.first': 'Pierwszy taniec', 'mo.firstS': 'kinowo, powoli',
      'mo.floor': 'Parkiet', 'mo.floorS': 'AI dopasuje do muzyki', 'mo.party': 'Szaleństwo', 'mo.partyS': 'klubowo, mocno',
      'mo.cake': 'Tort / toast', 'mo.cakeS': 'ciepłe białe światło', 'mo.calm': 'Wyciszenie', 'mo.calmS': 'na koniec, delikatnie',
      'c.pink': 'różowy', 'c.amber': 'bursztyn', 'c.warm': 'ciepła biel', 'c.white': 'biały', 'c.red': 'czerwony', 'c.blue': 'niebieski',
      'c.violet': 'fiolet', 'c.teal': 'turkus', 'c.green': 'zielony',
    },
    it: {
      'scn.title': 'Scene', 'scn.sub': 'Un clic = un look salvato. Lo show continua sulle altre luci.',
      'scn.save': 'Salva il look attuale', 'scn.name': 'Nome della scena (es. Primo ballo, Torta, Sassofonista):', 'scn.saved': 'Scena „{n}” salvata',
      'scn.del': 'Eliminare la scena „{n}”?', 'scn.none': 'Non hai ancora scene. Prepara le luci (es. con l’occhio di bue qui sotto) e clicca „Salva il look attuale”.',
      'scn.held': 'Stai tenendo {n} a mano — lo show non le muove', 'scn.release': 'Rilascia tutto — torna allo show', 'scn.on': 'Scena „{n}”',
      'mn.title': 'Occhio di bue manuale', 'mn.sub': 'Clicca sulla pianta dove sta la persona — le luci scelte ci vanno e restano. Clicca una luce sulla pianta per aggiungerla o toglierla.',
      'mn.aim': 'Punta', 'mn.place': 'Posiziona le luci', 'mn.placeHint': 'Trascina ogni luce dove sta davvero. Così il puntamento è giusto.',
      'mn.lamps': 'Quali luci', 'mn.allHeads': 'Tutte le teste', 'mn.color': 'Colore', 'mn.fromShow': 'dallo show', 'mn.dim': 'Luminosità',
      'mn.saveScene': 'Salva come scena', 'mn.release': 'Rilascia — torna allo show', 'mn.none': 'Prima aggiungi le luci (Impostazioni → Le mie luci).',
      'mn.back': 'fondo palco', 'mn.front': 'pubblico', 'mn.mount': 'Montaggio', 'mn.hang': 'appesa', 'mn.floor': 'a terra', 'mn.height': 'Altezza',
      'mn.noHeads': 'Scegli almeno una luce.', 'mn.sceneName': 'Nome della scena:', 'mn.solo': 'Solo',
      'fix.title': 'Correggi la mira', 'fix.sub': 'Le luci puntano il punto segnato (croce sulla pianta). Una non colpisce? Sceglila, sposta la sua luce con le frecce esattamente sul punto e clicca „Salva correzione”. Fallo in 2–3 punti della sala — un clic sulla pianta cambia il punto.',
      'fix.pick': 'Seleziona in alto („Quali luci”) almeno una testa.', 'fix.step': 'passo', 'fix.fine': 'preciso',
      'fix.mid': 'Punta al centro della sala e correggi', 'fix.l1': '1. Quale luce non colpisce?', 'fix.l2': '2. Sposta la sua luce sul punto:', 'fix.where': 'Punto: {x} m di lato, {z} m in profondità (clic sulla pianta per cambiarlo)',
      'fix.off': 'spostata: {s}', 'fix.r': '{n} cm a destra', 'fix.l': '{n} cm a sinistra', 'fix.b': '{n} cm indietro', 'fix.f': '{n} cm avanti', 'fix.none0': 'senza spostamento', 'fix.save': 'Salva correzione', 'fix.clear': 'Elimina correzioni ({n})',
      'fix.saved': 'Memorizzato — {n} correzioni per „{l}”', 'fix.cleared': 'Correzioni eliminate', 'fix.n': '{n} corr.',
      'scn.menuOn': 'Accendi la scena', 'scn.menuUpd': 'Sovrascrivi con ciò che si vede ora', 'scn.menuRen': 'Rinomina…', 'scn.menuDel': 'Elimina la scena', 'scn.updated': 'Scena „{n}” aggiornata',
      'scn.fx': 'con effetti', 'scn.hint': 'Tasto destro sulla scena: sovrascrivi, rinomina, elimina.',
      'mn.move': 'Movimento intorno alla persona', 'mn.mv0': 'nessuno', 'mn.mv1': 'leggero', 'mn.mv2': 'più forte', 'mn.gobo': 'Gobo che ruota',
      'mo.title': 'Momenti', 'mo.sub': 'Un clic imposta l’atmosfera per quel momento della festa.',
      'mo.dinner': 'Cena', 'mo.dinnerS': 'caldo e tranquillo', 'mo.first': 'Primo ballo', 'mo.firstS': 'da cinema, lento',
      'mo.floor': 'Pista', 'mo.floorS': 'l’AI segue la musica', 'mo.party': 'Scatenati', 'mo.partyS': 'da club, forte',
      'mo.cake': 'Torta / brindisi', 'mo.cakeS': 'luce bianca calda', 'mo.calm': 'Chiusura', 'mo.calmS': 'alla fine, delicato',
      'c.pink': 'rosa', 'c.amber': 'ambra', 'c.warm': 'bianco caldo', 'c.white': 'bianco', 'c.red': 'rosso', 'c.blue': 'blu',
      'c.violet': 'viola', 'c.teal': 'turchese', 'c.green': 'verde',
    },
  });

  const COLORS = [['pink', [255, 40, 160]], ['amber', [255, 140, 0]], ['warm', [255, 190, 110]], ['white', [255, 255, 255]],
    ['red', [255, 0, 0]], ['blue', [0, 60, 255]], ['violet', [150, 0, 255]], ['teal', [0, 220, 200]], ['green', [0, 255, 60]]];
  const lampWord = (n) => (PH.lang === 'it' ? `${n} ${n === 1 ? 'luce' : 'luci'}`
    : `${n} ${n === 1 ? 'lampę' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'lampy' : 'lamp'}`);
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const isHead = (f) => (f.channels || []).some((c) => c === 'pan' || c === 'tilt');
  const lamps = (st) => st.fixtures.filter((f) => f.type !== 'smoke' && f.enabled !== false);
  const heads = (st) => lamps(st).filter((f) => isHead(f) && f.type !== 'laser');
  const MN = { sel: null, mode: 'aim', pt: null, drag: null, placeSel: null, color: null, dim: 100, lang: null, local: {}, move: 0, gobo: false,
    fix: null, fine: false };                                // fix: {id, ox, oz} - the lamp being corrected and its offset (m)

  /* ================================================================ scenes */
  function renderScenes(st) {
    const box = $('#sh-scenes'); if (!box) return;
    const held = st.held || [];
    const sig = JSON.stringify([st.looks, held.length, PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const looks = st.looks || [];
    box.innerHTML = `<div class="mn-h"><h4>${esc(t('scn.title'))}</h4><small>${esc(t('scn.sub'))}</small></div>
      <div class="sc-list">${looks.map((lk) => `<span class="sc-item"><button class="sc-btn" data-look="${esc(lk.id)}" style="--c:${esc(lk.color || '#5a3ee8')}"><i></i><b>${esc(lk.name)}</b>${(lk.effects || []).length ? `<em title="${esc(t('scn.fx'))}">${ic('sparkle')}</em>` : ''}</button>
        <button class="sc-x" data-del="${esc(lk.id)}" title="${esc(t('scn.del', { n: lk.name }))}">${ic('close')}</button></span>`).join('')}
        <button class="sc-add" id="sc-add">${ic('plus')}<span>${esc(t('scn.save'))}</span></button></div>
      ${looks.length ? `<small class="sc-tip">${esc(t('scn.hint'))}</small>` : `<p class="sc-none">${esc(t('scn.none'))}</p>`}
      ${held.length ? `<div class="sc-held"><span>${ic('lock')}${esc(t('scn.held', { n: lampWord(held.length) }))}</span><button class="btn primary" id="sc-release">${esc(t('scn.release'))}</button></div>` : ''}`;
    for (const b of $$('[data-look]', box)) b.onclick = () => {
      const lk = looks.find((x) => x.id === b.dataset.look); if (!lk) return;
      send({ type: 'look_recall', id: lk.id, keep_show: true, hold: HOLD });
      toast(t('scn.on', { n: lk.name }));
    };
    for (const b of $$('[data-del]', box)) b.onclick = () => {
      const lk = looks.find((x) => x.id === b.dataset.del);
      if (lk && confirm(t('scn.del', { n: lk.name }))) send({ type: 'look_delete', id: lk.id });
    };
    for (const b of $$('[data-look]', box)) b.oncontextmenu = (e) => {
      const lk = looks.find((x) => x.id === b.dataset.look); if (!lk || !PH.ctxMenu) return;
      e.preventDefault();
      PH.ctxMenu(e.clientX, e.clientY, [
        { head: lk.name, sub: (lk.effects || []).length ? t('scn.fx') : '' },
        { icon: 'play', label: t('scn.menuOn'), fn: () => { send({ type: 'look_recall', id: lk.id, keep_show: true, hold: HOLD }); toast(t('scn.on', { n: lk.name })); } },
        { icon: 'save', label: t('scn.menuUpd'), fn: () => { send({ type: 'look_update', id: lk.id, recapture: true }); send({ type: 'save' }); toast(t('scn.updated', { n: lk.name })); } },
        { icon: 'edit', label: t('scn.menuRen'), fn: () => { const n = prompt(t('scn.name'), lk.name); if (n && n.trim()) { send({ type: 'look_update', id: lk.id, name: n.trim().slice(0, 24) }); send({ type: 'save' }); } } },
        '-',
        { icon: 'trash', label: t('scn.menuDel'), danger: true, fn: () => { if (confirm(t('scn.del', { n: lk.name }))) send({ type: 'look_delete', id: lk.id }); } },
      ]);
    };
    $('#sc-add', box).onclick = () => {
      const name = prompt(t('scn.name'), ''); if (!name || !name.trim()) return;
      send({ type: 'look_save', name: name.trim().slice(0, 24), ids: 'all', fade: 1.5, color: MN.color ? hex(MN.color) : '#5a3ee8' });
      toast(t('scn.saved', { n: name.trim() }));
    };
    const rel = $('#sc-release', box); if (rel) rel.onclick = () => send({ type: 'release' });
  }

  /* ================================================================ moments of the party */
  const MOMENTS = [
    ['dinner', 'moon', { flavor: 'elegant', intensity: 0.25, morph: 0.85 }], ['first', 'sparkle', { flavor: 'cinema', intensity: 0.3, morph: 1 }],
    ['floor', 'music', { flavor: 'auto', intensity: 0.6, morph: 0.5 }], ['party', 'bolt', { flavor: 'club', intensity: 0.9, morph: 0.3 }],
    ['cake', 'sun', null], ['calm', 'dark', { flavor: 'chill', intensity: 0.12, morph: 1 }],
  ];
  let moment = null;
  try { moment = localStorage.getItem('ph_moment'); } catch (e) { /* private */ }
  function renderMoments(st) {
    const box = $('#sh-moments'); if (!box) return;
    const ap = st.effects.autopilot, cake = st.effects.active.some((a) => a.id === 'mom-col');
    const cur = cake ? 'cake' : ap.on && ap.mood === 'ai' ? moment : null;
    const sig = JSON.stringify([cur, PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = `<div class="mn-h"><h4>${esc(t('mo.title'))}</h4><small>${esc(t('mo.sub'))}</small></div>
      <div class="mo-list">${MOMENTS.map(([k, icn]) => `<button class="mo-btn${cur === k ? ' on' : ''}" data-mo="${k}">${ic(icn)}<b>${esc(t('mo.' + k))}</b><small>${esc(t('mo.' + k + 'S'))}</small></button>`).join('')}</div>`;
    for (const b of $$('[data-mo]', box)) b.onclick = () => playMoment(b.dataset.mo);
  }
  PH.playMoment = (k) => playMoment(k);
  async function playMoment(k) {
    const m = MOMENTS.find(([n]) => n === k); if (!m) return;
    moment = k;
    try { localStorage.setItem('ph_moment', k); } catch (e) { /* private */ }
    send({ type: 'fx_stop', id: 'mom-col' }); send({ type: 'fx_stop', id: 'mom-dim' });
    if (!m[2]) {                                              // cake / toast: everybody warm white, steady
      send({ type: 'show_stop' }); send({ type: 'release' });
      send({ type: 'fx_start', kind: 'static_color', id: 'mom-col', params: { color_a: [255, 190, 110] }, targets: 'all' });
      send({ type: 'fx_start', kind: 'glow', id: 'mom-dim', params: { level: 1 }, targets: 'all' });
    } else {
      send({ type: 'director', ...m[2] });
      send({ type: 'autopilot', lasers: k === 'floor' || k === 'party' });   // no lasers at dinner / slow dances
      if (PH.showStart) await PH.showStart(); else send({ type: 'show_start' });
    }
    toast(t('mo.' + k));
    const box = $('#sh-moments'); if (box) box.dataset.sig = '';
  }

  /* ================================================================ hand-run spot */
  function buildManual(box, st) {
    MN.lang = PH.lang;
    box.innerHTML = `<div class="mn-h"><h4>${esc(t('mn.title'))}</h4><small>${esc(t('mn.sub'))}</small></div>
      <div class="mn-grid">
        <div class="mn-plan-wrap">
          <canvas id="mn-plan" aria-label="plan sceny"></canvas>
          <div class="seg mn-mode" id="mn-mode"><button data-m="aim">${ic('target')}<span>${esc(t('mn.aim'))}</span></button><button data-m="place">${ic('move')}<span>${esc(t('mn.place'))}</span></button></div>
          <p class="mn-place-hint" id="mn-place-hint" hidden>${esc(t('mn.placeHint'))}</p>
        </div>
        <div class="mn-side">
          <div id="mn-aim-side">
            <b class="mn-l">${esc(t('mn.lamps'))}</b><div class="mn-lamps" id="mn-lamps"></div>
            <b class="mn-l">${esc(t('mn.color'))}</b>
            <div class="mn-colors">${COLORS.map(([k, c]) => `<button data-c="${k}" title="${esc(t('c.' + k))}" style="--c:${hex(c)}"><i></i><small>${esc(t('c.' + k))}</small></button>`).join('')}
              <button data-c="show" class="from-show"><i></i><small>${esc(t('mn.fromShow'))}</small></button></div>
            <b class="mn-l">${esc(t('mn.dim'))} <span class="mono" id="mn-dim-v">100%</span></b>
            <input type="range" id="mn-dim" min="0" max="100" value="${MN.dim}">
            <b class="mn-l">${esc(t('mn.move'))}</b>
            <div class="seg mn-move" id="mn-move">${[0, 1, 2].map((v) => `<button data-mv="${v}" class="${MN.move === v ? 'on' : ''}">${esc(t('mn.mv' + v))}</button>`).join('')}</div>
            <label class="sh-tg mn-gobo"><span>${esc(t('mn.gobo'))}</span><span class="switch"><input type="checkbox" id="mn-gobo" ${MN.gobo ? 'checked' : ''}><i></i></span></label>
            <div class="mn-act"><button class="btn" id="mn-save">${ic('save')}<span>${esc(t('mn.saveScene'))}</span></button>
              <button class="btn primary" id="mn-release">${ic('next')}<span>${esc(t('mn.release'))}</span></button></div>
            <details class="mn-fix" id="mn-fix"><summary>${ic('crosshair')}<b>${esc(t('fix.title'))}</b></summary>
              <p>${esc(t('fix.sub'))}</p><div id="mn-fix-body"></div></details>
          </div>
          <div id="mn-place-side" hidden></div>
        </div>
      </div>`;
    for (const b of $$('#mn-mode button', box)) b.onclick = () => { MN.mode = b.dataset.m; MN.placeSel = null; syncMode(); };
    for (const b of $$('[data-c]', box)) b.onclick = () => pickColor(b.dataset.c);
    $('#mn-dim', box).oninput = (e) => {
      MN.dim = Number(e.target.value);
      $('#mn-dim-v').textContent = `${MN.dim}%`;
      const ids = selIds(); if (!ids.length) return;
      for (const id of ids) PH.S.out.set('mn-dim' + id, { type: 'set_many', id, values: { dimmer: Math.round(MN.dim * 2.55), strobe: 0 }, hold: HOLD });
    };
    for (const b of $$('#mn-move button', box)) b.onclick = () => {
      MN.move = Number(b.dataset.mv);
      for (const x of $$('#mn-move button', box)) x.classList.toggle('on', x === b);
      soloMotion();
    };
    $('#mn-gobo', box).onchange = (e) => { MN.gobo = e.target.checked; soloMotion(); };
    $('#mn-save', box).onclick = () => {
      const ids = selIds(); if (!ids.length) { toast(t('mn.noHeads'), 'warn'); return; }
      const name = prompt(t('mn.sceneName'), t('mn.solo')); if (!name || !name.trim()) return;
      send({ type: 'look_save', name: name.trim().slice(0, 24), ids, fade: 1.5, color: MN.color ? hex(MN.color) : '#ff28a0' });
      toast(t('scn.saved', { n: name.trim() }));
    };
    $('#mn-release', box).onclick = () => { const ids = selIds(); send({ type: 'release', ids: ids.length ? ids : undefined }); MN.pt = null; };
    planEvents($('#mn-plan', box));
    $('#mn-fix', box).ontoggle = () => {
      if ($('#mn-fix').open && !MN.pt && selIds().length) aimSpot(0, 0);   // nothing aimed yet: the middle of the room
      $('#mn-fix-body').dataset.sig = ''; renderFix(S.st);
    };
    syncMode();
  }
  // ---- "Popraw celowanie": the arrows move this lamp's light spot on the floor, "Zapisz" keeps the correction
  function aimSpot(x, z) {                                   // the chosen heads aim at this floor spot and stay lit
    const ids = selIds(); if (!ids.length || !S.st) return;
    MN.pt = [x, z];
    send({ type: 'aim', ids, x, y: S.st.stage.aim_height || 1.2, z, hold: HOLD });
    for (const id of ids) send({ type: 'set_many', id, values: { dimmer: Math.round(MN.dim * 2.55), strobe: 0, ...(MN.color ? { red: MN.color[0], green: MN.color[1], blue: MN.color[2] } : {}) }, hold: HOLD });
  }
  // a lamp's name, with its address when several lamps share the name ("Głowice lewe · 010")
  function lampLabel(f, list) {
    return list.filter((x) => x.name === f.name).length > 1 ? `${f.name} · ${String(f.address).padStart(3, '0')}` : f.name;
  }
  function renderFix(st) {
    const box = $('#mn-fix-body'); if (!box || !st || !$('#mn-fix').open) return;
    const hs = heads(st).filter((f) => selIds().includes(f.id));
    if (MN.fix && !hs.some((f) => f.id === MN.fix.id)) MN.fix = null;
    if (!MN.fix && hs.length) MN.fix = { id: hs[0].id, ox: 0, oz: 0 };      // the arrows are there at once
    const n = (f) => ((f.aim_points || {}).floor) || 0;
    const sig = JSON.stringify([MN.pt && MN.pt.map((v) => v.toFixed(2)), hs.map((f) => [f.id, f.name, n(f)]), MN.fix, MN.fine, PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    if (!hs.length) { box.innerHTML = `<p class="sc-none">${esc(t('fix.pick'))}</p>`; return; }
    if (!MN.pt) {
      box.innerHTML = `<button class="btn primary" id="fix-mid">${ic('crosshair')}<span>${esc(t('fix.mid'))}</span></button>`;
      $('#fix-mid', box).onclick = () => { aimSpot(0, 0); box.dataset.sig = ''; renderFix(S.st); };
      return;
    }
    const cur = MN.fix && hs.find((f) => f.id === MN.fix.id);
    const cm = (v) => Math.abs(Math.round(v * 100));
    const parts = MN.fix ? [MN.fix.ox ? t(MN.fix.ox > 0 ? 'fix.r' : 'fix.l', { n: cm(MN.fix.ox) }) : '', MN.fix.oz ? t(MN.fix.oz > 0 ? 'fix.f' : 'fix.b', { n: cm(MN.fix.oz) }) : ''].filter(Boolean) : [];
    const off = parts.length ? t('fix.off', { s: parts.join(', ') }) : t('fix.none0');
    box.innerHTML = `<small class="fix-where">${esc(t('fix.where', { x: MN.pt[0].toFixed(1), z: MN.pt[1].toFixed(1) }))}</small>
      <b class="mn-l">${esc(t('fix.l1'))}</b>
      <div class="mn-lamps">${hs.map((f) => `<button class="mn-chip${cur && cur.id === f.id ? ' on' : ''}" data-fix="${f.id}">${esc(lampLabel(f, hs))}${n(f) ? ` <small>${esc(t('fix.n', { n: n(f) }))}</small>` : ''}</button>`).join('')}</div>
      ${cur ? `<b class="mn-l">${esc(t('fix.l2'))}</b><div class="fix-pad" tabindex="0" id="fix-pad">
          <button data-d="0,-1" class="up" title="↑">${ic('chevron')}</button><button data-d="-1,0" class="lt" title="←">${ic('chevron')}</button>
          <span>${ic('crosshair')}</span><button data-d="1,0" class="rt" title="→">${ic('chevron')}</button><button data-d="0,1" class="dn" title="↓">${ic('chevron')}</button></div>
        <label class="sh-tg fix-fine"><span>${esc(t('fix.fine'))}</span><span class="switch"><input type="checkbox" id="fix-fine" ${MN.fine ? 'checked' : ''}><i></i></span></label>
        <small class="fix-off">${esc(off)}</small>
        <div class="mn-act"><button class="btn primary" id="fix-save">${ic('save')}<span>${esc(t('fix.save'))}</span></button>
          ${n(cur) ? `<button class="btn" id="fix-clear">${esc(t('fix.clear', { n: n(cur) }))}</button>` : ''}</div>` : ''}`;
    for (const b of $$('[data-fix]', box)) b.onclick = () => {
      MN.fix = { id: Number(b.dataset.fix), ox: 0, oz: 0 };
      send({ type: 'solo_stop', ids: [MN.fix.id] });            // the circling stops while it is being corrected
      PH.blinkLamp && PH.blinkLamp(MN.fix.id);
      box.dataset.sig = ''; renderFix(S.st);
    };
    if (!cur) return;
    const nudge = (dx, dz) => {
      const step = MN.fine ? 0.02 : 0.1;
      MN.fix.ox = Math.round((MN.fix.ox + dx * step) * 100) / 100;
      MN.fix.oz = Math.round((MN.fix.oz + dz * step) * 100) / 100;
      send({ type: 'aim', ids: [cur.id], x: MN.pt[0] + MN.fix.ox, y: S.st.stage.aim_height || 1.2, z: MN.pt[1] + MN.fix.oz, hold: HOLD });
      box.dataset.sig = ''; renderFix(S.st);
      const p = $('#fix-pad'); if (p) p.focus({ preventScroll: true });
    };
    for (const b of $$('[data-d]', box)) b.onclick = () => { const [dx, dz] = b.dataset.d.split(',').map(Number); nudge(dx, dz); };
    $('#fix-pad', box).onkeydown = (e) => {
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (m) { e.preventDefault(); nudge(m[0], m[1]); }
    };
    $('#fix-fine', box).onchange = (e) => { MN.fine = e.target.checked; };
    $('#fix-save', box).onclick = () => {
      send({ type: 'aim_fix', id: cur.id, x: MN.pt[0], y: S.st.stage.aim_height || 1.2, z: MN.pt[1] });
      toast(t('fix.saved', { n: n(cur) + 1, l: cur.name }));
      MN.fix = { id: cur.id, ox: 0, oz: 0 };
      box.dataset.sig = '';
    };
    const c = $('#fix-clear', box);
    if (c) c.onclick = () => {
      send({ type: 'aim_fix_clear', id: cur.id });
      send({ type: 'aim', ids: [cur.id], x: MN.pt[0], y: S.st.stage.aim_height || 1.2, z: MN.pt[1], hold: HOLD });
      MN.fix = { id: cur.id, ox: 0, oz: 0 };
      toast(t('fix.cleared'));
    };
  }
  function syncMode() {
    for (const b of $$('#mn-mode button')) b.classList.toggle('on', b.dataset.m === MN.mode);
    $('#mn-place-hint').hidden = MN.mode !== 'place';
    $('#mn-aim-side').hidden = MN.mode !== 'aim';
    $('#mn-place-side').hidden = MN.mode !== 'place';
    if (MN.mode === 'place') renderPlaceSide(S.st);
  }
  function selIds() {
    if (!S.st) return [];
    const all = heads(S.st).map((f) => f.id);
    if (!MN.sel) MN.sel = new Set(all);                       // first time: every moving head
    return all.filter((id) => MN.sel.has(id));
  }
  function renderLamps(st) {
    const box = $('#mn-lamps'); if (!box) return;
    const hs = heads(st), ids = selIds();
    const sig = JSON.stringify([hs.map((f) => [f.id, f.name]), ids, PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = hs.length ? `<button class="mn-chip all${ids.length === hs.length ? ' on' : ''}" data-all>${esc(t('mn.allHeads'))}</button>`
      + hs.map((f) => `<button class="mn-chip${MN.sel.has(f.id) ? ' on' : ''}" data-id="${f.id}">${esc(lampLabel(f, hs))}</button>`).join('')
      : `<p class="sc-none">${esc(t('mn.none'))}</p>`;
    for (const b of $$('[data-id]', box)) b.onclick = () => { const id = Number(b.dataset.id); if (MN.sel.has(id)) MN.sel.delete(id); else MN.sel.add(id); box.dataset.sig = ''; renderLamps(S.st); };
    const a = $('[data-all]', box); if (a) a.onclick = () => { MN.sel = new Set(ids.length === hs.length ? [] : hs.map((f) => f.id)); box.dataset.sig = ''; renderLamps(S.st); };
  }
  function soloMotion() {
    const ids = selIds(); if (!ids.length || !S.st) return;
    send({ type: 'solo_stop', ids });
    const held = new Set(S.st.held || []);
    for (const id of ids) {
      if (!held.has(id) && !MN.pt) continue;                   // nothing aimed yet: no movement on its own
      if (MN.move) send({ type: 'fx_start', kind: 'circle', id: `solo-move-${id}`, targets: [id], params: { solo: true, size: MN.move === 1 ? 3.5 : 8, beats: 8, speed: 0.18 } });
      const f = S.st.fixtures.find((x) => x.id === id);
      if (MN.gobo && f && (f.channels || []).includes('gobo')) {
        send({ type: 'set_many', id, values: { gobo: 0 }, hold: HOLD });
        send({ type: 'fx_start', kind: 'gobo_spin', id: `solo-gobo-${id}`, targets: [id], params: { solo: true, speed: 50 } });
      }
    }
    if (!MN.gobo) send({ type: 'release', ids, groups: ['beam'] });
  }
  function pickColor(k) {
    const ids = selIds(); if (!ids.length) { toast(t('mn.noHeads'), 'warn'); return; }
    for (const b of $$('[data-c]')) b.classList.toggle('on', b.dataset.c === k);
    if (k === 'show') { MN.color = null; send({ type: 'release', ids, groups: ['color'] }); return; }
    const c = COLORS.find(([n]) => n === k)[1];
    MN.color = c;
    for (const id of ids) send({ type: 'set_many', id, values: { red: c[0], green: c[1], blue: c[2], dimmer: Math.round(MN.dim * 2.55), strobe: 0 }, hold: HOLD });
  }

  /* ---------------------------------------------------------------- the plan (top view) */
  function geom(cv) {
    const st = S.st, [W, H, d] = PH.fitCanvas(cv);
    const sw = st.stage.width || 10, sd = st.stage.depth || 8, m = 1.1;
    const s = Math.min((W - 30 * d) / (sw + 2 * m), (H - 40 * d) / (sd + 2 * m));
    const ox = W / 2, oy = 20 * d + (sd / 2 + m) * s;
    return { W, H, d, s, sw, sd, toPx: (x, z) => [ox + x * s, oy + z * s], toWorld: (px, py) => [(px - ox) / s, (py - oy) / s] };
  }
  function lampAt(g, px, py) {
    let best = null, bd = 16 * g.d;
    for (const f of lamps(S.st)) {
      const pos = MN.local[f.id] || f.pos, [x, y] = g.toPx(pos[0], pos[2]);
      const dd = Math.hypot(px - x, py - y);
      if (dd < bd) { bd = dd; best = f; }
    }
    return best;
  }
  function planEvents(cv) {
    const at = (e) => { const r = cv.getBoundingClientRect(), d = PH.fitCanvas(cv)[2]; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d]; };
    const aimAt = (px, py, first) => {
      const g = geom(cv), [x, z] = g.toWorld(px, py), ids = selIds();
      if (!ids.length) { if (first) toast(t('mn.noHeads'), 'warn'); return; }
      MN.pt = [x, z];
      if (MN.fix) { MN.fix.ox = 0; MN.fix.oz = 0; }
      PH.S.out.set('mn-aim', { type: 'aim', ids, x, y: S.st.stage.aim_height || 1.2, z, hold: HOLD });
      if (first) for (const id of ids) send({ type: 'set_many', id, values: { dimmer: Math.round(MN.dim * 2.55), strobe: 0, ...(MN.color ? { red: MN.color[0], green: MN.color[1], blue: MN.color[2] } : {}) }, hold: HOLD });
    };
    cv.onpointerdown = (e) => {
      if (!S.st) return;
      const [px, py] = at(e), g = geom(cv), f = lampAt(g, px, py);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (MN.mode === 'place') {
        if (f) { MN.drag = f.id; MN.placeSel = f.id; renderPlaceSide(S.st); }
        return;
      }
      if (f && isHead(f)) { selIds(); if (MN.sel.has(f.id)) MN.sel.delete(f.id); else MN.sel.add(f.id); $('#mn-lamps').dataset.sig = ''; renderLamps(S.st); return; }
      MN.drag = 'aim';
      send({ type: 'solo_stop', ids: selIds() });
      aimAt(px, py, true);
    };
    cv.onpointermove = (e) => {
      if (!MN.drag) return;
      const [px, py] = at(e), g = geom(cv);
      if (MN.drag === 'aim') { aimAt(px, py, false); return; }
      const f = S.st.fixtures.find((x) => x.id === MN.drag); if (!f) return;
      const [x, z] = g.toWorld(px, py);
      MN.local[f.id] = [Math.round(x * 10) / 10, f.pos[1], Math.round(z * 10) / 10];
      PH.S.out.set('mn-pos' + f.id, { type: 'update_fixture', id: f.id, pos: MN.local[f.id] });
    };
    const end = () => {
      if (MN.drag === 'aim' && MN.pt) {                       // the last position goes out now, then the movement around it
        const msg = PH.S.out.get('mn-aim'); PH.S.out.delete('mn-aim'); if (msg) send(msg);
        soloMotion();
      }
      if (MN.drag && MN.drag !== 'aim') setTimeout(() => { delete MN.local[MN.drag]; }, 600);
      MN.drag = null;
    };
    cv.onpointerup = end; cv.onpointercancel = end;
  }
  function renderPlaceSide(st) {
    const box = $('#mn-place-side'); if (!box || !st) return;
    const f = st.fixtures.find((x) => x.id === MN.placeSel);
    const sig = JSON.stringify([f && [f.id, f.mount, f.pos[1]], PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    if (!f) { box.innerHTML = `<p class="sc-none">${esc(t('mn.placeHint'))}</p>`; return; }
    box.innerHTML = `<b class="mn-l">${esc(f.name)}</b>
      <b class="mn-l">${esc(t('mn.mount'))}</b><div class="seg" id="mn-mount"><button data-m="hang" class="${f.mount !== 'floor' ? 'on' : ''}">${esc(t('mn.hang'))}</button><button data-m="floor" class="${f.mount === 'floor' ? 'on' : ''}">${esc(t('mn.floor'))}</button></div>
      <b class="mn-l">${esc(t('mn.height'))} <span class="mono" id="mn-h-v">${f.pos[1].toFixed(1)} m</span></b>
      <input type="range" id="mn-h" min="0" max="8" step="0.1" value="${f.pos[1]}">`;
    for (const b of $$('#mn-mount button', box)) b.onclick = () => send({ type: 'update_fixture', id: f.id, mount: b.dataset.m });
    $('#mn-h', box).oninput = (e) => {
      const y = Number(e.target.value); $('#mn-h-v').textContent = `${y.toFixed(1)} m`;
      PH.S.out.set('mn-h' + f.id, { type: 'update_fixture', id: f.id, pos: [f.pos[0], y, f.pos[2]] });
    };
  }
  function drawPlan() {
    const cv = $('#mn-plan'); if (!cv || !S.st || cv.offsetParent === null) return;
    const g = geom(cv), ctx = cv.getContext('2d'), d = g.d, time = performance.now() / 1000;
    ctx.fillStyle = '#121027'; ctx.fillRect(0, 0, g.W, g.H);
    const [x0, y0] = g.toPx(-g.sw / 2, -g.sd / 2), [x1, y1] = g.toPx(g.sw / 2, g.sd / 2);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1 * d;
    ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 10 * d); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    for (let x = Math.ceil(-g.sw / 2); x <= g.sw / 2; x++) { const [px] = g.toPx(x, 0); ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y1); ctx.stroke(); }
    for (let z = Math.ceil(-g.sd / 2); z <= g.sd / 2; z++) { const [, py] = g.toPx(0, z); ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x1, py); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = `600 ${11 * d}px Figtree, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(t('mn.back'), (x0 + x1) / 2, y0 - 6 * d);
    ctx.fillText(`▼ ${t('mn.front')} ▼`, (x0 + x1) / 2, y1 + 15 * d);
    const ids = MN.mode === 'aim' ? new Set(selIds()) : new Set();
    const held = new Set(S.st.held || []);
    if (MN.pt && MN.mode === 'aim') {                       // beams from the chosen lamps to the person
      const [ax, ay] = g.toPx(MN.pt[0], MN.pt[1]);
      for (const f of lamps(S.st)) {
        if (!ids.has(f.id) || !held.has(f.id)) continue;
        const [lx, ly] = g.toPx(f.pos[0], f.pos[2]), [r, gg, b] = PH.rgbOf(f);
        const gr = ctx.createLinearGradient(lx, ly, ax, ay);
        gr.addColorStop(0, `rgba(${r},${gg},${b},.55)`); gr.addColorStop(1, `rgba(${r},${gg},${b},.15)`);
        ctx.strokeStyle = gr; ctx.lineWidth = 3 * d; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ax, ay); ctx.stroke();
      }
      if (MN.fix && (MN.fix.ox || MN.fix.oz)) {            // where the lamp being corrected points now
        const [fx, fy] = g.toPx(MN.pt[0] + MN.fix.ox, MN.pt[1] + MN.fix.oz);
        ctx.save(); ctx.setLineDash([4 * d, 3 * d]); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2 * d;
        ctx.beginPath(); ctx.arc(fx, fy, 9 * d, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(fx, fy); ctx.stroke(); ctx.restore();
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * d;
      ctx.beginPath(); ctx.arc(ax, ay, 12 * d, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax - 18 * d, ay); ctx.lineTo(ax + 18 * d, ay); ctx.moveTo(ax, ay - 18 * d); ctx.lineTo(ax, ay + 18 * d); ctx.stroke();
    }
    for (const f of lamps(S.st)) {
      const pos = MN.local[f.id] || f.pos, [px, py] = g.toPx(pos[0], pos[2]);
      const I = PH.intensity(f, time), [r, gg, b] = PH.rgbOf(f), head = isHead(f);
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 22 * d);
      glow.addColorStop(0, `rgba(${r},${gg},${b},${0.15 + 0.6 * I})`); glow.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, 22 * d, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2843'; ctx.beginPath();
      if (head) ctx.arc(px, py, 9 * d, 0, 7); else ctx.roundRect(px - 8 * d, py - 8 * d, 16 * d, 16 * d, 4 * d);
      ctx.fill();
      ctx.fillStyle = `rgba(${r},${gg},${b},${0.35 + 0.65 * I})`; ctx.beginPath(); ctx.arc(px, py, 4 * d, 0, 7); ctx.fill();
      if (ids.has(f.id) || MN.placeSel === f.id) { ctx.strokeStyle = held.has(f.id) ? '#ff9ad5' : '#9c88ff'; ctx.lineWidth = 2.5 * d; ctx.beginPath(); ctx.arc(px, py, 13 * d, 0, 7); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `600 ${10.5 * d}px Figtree, sans-serif`;
      ctx.fillText(f.name.length > 18 ? f.name.slice(0, 17) + '…' : f.name, px, py + 24 * d);
    }
  }

  /* ================================================================ wiring */
  PH.onState.push((st) => {
    if (S.tab !== 'show') return;
    renderMoments(st);
    renderScenes(st);
    const box = $('#sh-manual'); if (!box) return;
    if (MN.lang !== PH.lang || !$('#mn-plan', box)) buildManual(box, st);
    renderLamps(st);
    renderFix(st);
    if (MN.mode === 'place') renderPlaceSide(st);
  });
  const loop = () => { if (S.tab === 'show') drawPlan(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  PH.manualRebuild = () => { MN.lang = null; const s = $('#sh-scenes'); if (s) s.dataset.sig = ''; };
})();
