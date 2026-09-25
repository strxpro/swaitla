/* Lumo — hand view tools.
 *
 * - Click a gesture in the list: switch it on / off, set its strength and what it controls.
 * - "Kierunek": finger to the right but the lamp turns left? Flip left/right or up/down per lamp.
 * - "Kalibruj na mnie": stand in front of the camera, the lamp finds you, thumbs up 3 s = yes,
 *   thumbs down = no -> point with a finger to correct. Lamp by lamp, three spots each.
 * - Fewer buttons: the rarely used ones sit behind "Więcej".
 */
(() => {
  const PH = window.PH;
  const { S, send, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'ht.tg.none': '— nic (tylko dodatki)', 'ht.extra': 'Dodatkowo — łącz akcje i efekty', 'ht.extraS': 'wszystko z listy rusza razem z tym gestem',
      'ht.addPick': '+ Dodaj efekt albo akcję…', 'ht.gFx': 'Efekty', 'ht.gAct': 'Akcje', 'ht.gCol': 'Kolor', 'ht.gLook': 'Sceny świateł', 'ht.none': 'nic jeszcze',
      'ht.mHold': 'Tylko gdy trzymam gest', 'ht.mOnce': 'Raz, przy starcie', 'ht.try': 'Wypróbuj teraz',
      'ht.a.flash': 'Flash', 'ht.a.strobe': 'Strobo', 'ht.a.smoke': 'Dym', 'ht.a.blackout': 'Blackout', 'ht.a.full': 'Pełna jasność', 'ht.a.dark': 'Wygaś',
      'ht.a.home': 'Lampy na środek', 'ht.a.next_fixture': 'Następna lampa', 'ht.a.spotlight': 'Reflektor na osobę', 'ht.a.autopilot': 'Autopilot', 'ht.a.stop_effects': 'Zatrzymaj efekty',
      'ht.c.red': 'Czerwony', 'ht.c.green': 'Zielony', 'ht.c.blue': 'Niebieski', 'ht.c.white': 'Biały', 'ht.c.violet': 'Fioletowy', 'ht.c.amber': 'Bursztynowy',
      'ht.dir': 'Kierunek', 'ht.flipX': 'Odwróć lewo ↔ prawo', 'ht.flipY': 'Odwróć góra ↕ dół', 'ht.more': 'Więcej', 'ht.me': 'Kalibruj na mnie',
      'ht.dirT': 'Palec w prawo, a lampa w lewo? Kliknij „↔”. Góra i dół odwrotnie? Kliknij „↕”. Działa dla wybranej lampy.',
      'ht.on': 'Gest włączony', 'ht.gain': 'Siła', 'ht.gainS': 'jak mocno ruch dłoni zmienia wartość', 'ht.target': 'Steruje', 'ht.rel': 'Płynnie od obecnej wartości',
      'ht.relS': 'jasność i inne wartości zmieniają się od miejsca, w którym są — bez skoków', 'ht.close': 'Gotowe', 'ht.fixed': 'ten gest ma stałą funkcję',
      'ht.tg.aim': 'celowanie', 'ht.tg.dimmer': 'jasność', 'ht.tg.master': 'master (wszystko)', 'ht.tg.zoom': 'zoom', 'ht.tg.focus': 'focus', 'ht.tg.speed': 'prędkość silników',
      'ht.tg.strobe': 'strobo', 'ht.tg.white': 'biały LED', 'ht.tg.spin': 'obrót', 'ht.tg.pan': 'obrót lewo/prawo', 'ht.tg.tilt': 'ruch góra/dół', 'ht.tg.hue': 'kolor',
      'ht.tg.fx_speed': 'tempo efektów', 'ht.tg.crossfade': 'przejście między lampami', 'ht.tg.full': 'pełna jasność',
      'mc.t': 'Kalibracja na mnie', 'mc.lamp': 'Lampa {i} z {n}', 'mc.spot': 'Miejsce {i} z {n}',
      'mc.spot.center': 'Stań na środku, przodem do kamery', 'mc.spot.left': 'Przejdź w lewo i stań', 'mc.spot.right': 'Przejdź w prawo i stań',
      'mc.find': 'Szukam Twojej sylwetki…', 'mc.confirm': 'Czy światło pada na Ciebie?', 'mc.confirmS': 'Kciuk w górę przez 3 s = TAK · kciuk w dół = NIE',
      'mc.adjust': 'Wskaż palcem, gdzie ma świecić', 'mc.adjustS': 'Lampa idzie za palcem. Kciuk w górę 3 s = zapisz · kciuk w dół = pomiń to miejsce',
      'mc.yes': 'Tak, pada na mnie', 'mc.no': 'Nie — poprawiam', 'mc.skip': 'Pomiń', 'mc.stop': 'Zakończ', 'mc.done': 'Gotowe! Zapisano miejsc: {n}',
      'mc.doneS': 'Teraz „Reflektor” i śledzenie trafiają dokładnie w Ciebie. Lasery nie są celowane w ludzi — sprawdzisz je przyciskiem Test w Mikserze.',
      'mc.start': 'Stań 2–4 m od kamery tak, żeby było Cię widać całego. Lampy po kolei same Cię znajdą — kamera widzi, kiedy Twoja sylwetka robi się jasna.',
      'mc.quick': 'Szybko — tylko środek', 'mc.quickS': 'stań na środku, każda lampa znajdzie Cię sama (ok. 20 s na lampę)',
      'mc.exact': 'Dokładnie — 3 miejsca', 'mc.exactS': 'środek, lewo, prawo — reflektor i śledzenie trafią w Ciebie wszędzie',
      'mc.base': 'Stój spokojnie — mierzę światło na Tobie', 'mc.search': 'Szukam Cię światłem…', 'mc.searchS': 'Lampa przesuwa się po kolei. Gdy Twoja sylwetka rozbłyśnie, zapiszę to sama.',
      'mc.refine': 'Prawie! Dopasowuję dokładnie…', 'mc.found': 'Mam Cię! Zapisuję…', 'mc.bright': 'Jasność sylwetki', 'mc.tried': 'Sprawdzone: {a} z {b}',
      'mc.manual': 'Nie widzę wyraźnie światła na Tobie — powiedz mi kciukiem.',
      'mc.go': 'Zaczynamy', 'mc.hold': 'Trzymaj…', 'mc.noperson': 'Nie widzę Cię — stań w kadrze',
      'toast.flipX': 'Kierunek lewo/prawo odwrócony', 'toast.flipY': 'Kierunek góra/dół odwrócony', 'toast.mecal.nolamps': 'Brak lamp z obrotem (pan i tilt) do kalibracji',
      'dock.off': 'Wyłącz urządzenie', 'dock.on': 'Włącz urządzenie',
      'sp.t': 'Reflektor', 'sp.auto': 'Śledź osobę', 'sp.man': 'Ustaw ręcznie', 'sp.click': 'Kliknij na obrazie, gdzie stoi osoba (możesz przeciągać)', 'sp.off': 'Wyłącz',
    },
    it: {
      'ht.tg.none': '— niente (solo extra)', 'ht.extra': 'In più — combina azioni ed effetti', 'ht.extraS': 'tutto nella lista parte con questo gesto',
      'ht.addPick': '+ Aggiungi effetto o azione…', 'ht.gFx': 'Effetti', 'ht.gAct': 'Azioni', 'ht.gCol': 'Colore', 'ht.gLook': 'Scene luci', 'ht.none': 'ancora niente',
      'ht.mHold': 'Solo mentre tengo il gesto', 'ht.mOnce': 'Una volta, all’inizio', 'ht.try': 'Prova ora',
      'ht.a.flash': 'Flash', 'ht.a.strobe': 'Strobo', 'ht.a.smoke': 'Fumo', 'ht.a.blackout': 'Blackout', 'ht.a.full': 'Luce piena', 'ht.a.dark': 'Spegni',
      'ht.a.home': 'Luci al centro', 'ht.a.next_fixture': 'Luce successiva', 'ht.a.spotlight': 'Riflettore sulla persona', 'ht.a.autopilot': 'Autopilota', 'ht.a.stop_effects': 'Ferma effetti',
      'ht.c.red': 'Rosso', 'ht.c.green': 'Verde', 'ht.c.blue': 'Blu', 'ht.c.white': 'Bianco', 'ht.c.violet': 'Viola', 'ht.c.amber': 'Ambra',
      'ht.dir': 'Direzione', 'ht.flipX': 'Inverti sinistra ↔ destra', 'ht.flipY': 'Inverti su ↕ giù', 'ht.more': 'Altro', 'ht.me': 'Calibra su di me',
      'ht.dirT': 'Dito a destra ma la luce va a sinistra? Clicca „↔”. Su e giù al contrario? Clicca „↕”. Vale per la luce scelta.',
      'ht.on': 'Gesto attivo', 'ht.gain': 'Forza', 'ht.gainS': 'quanto il movimento della mano cambia il valore', 'ht.target': 'Controlla', 'ht.rel': 'Morbido dal valore attuale',
      'ht.relS': 'luminosità e altri valori cambiano da dove sono — senza salti', 'ht.close': 'Fatto', 'ht.fixed': 'questo gesto ha una funzione fissa',
      'ht.tg.aim': 'puntamento', 'ht.tg.dimmer': 'luminosità', 'ht.tg.master': 'master (tutto)', 'ht.tg.zoom': 'zoom', 'ht.tg.focus': 'focus', 'ht.tg.speed': 'velocità motori',
      'ht.tg.strobe': 'strobo', 'ht.tg.white': 'LED bianco', 'ht.tg.spin': 'rotazione', 'ht.tg.pan': 'rotazione sx/dx', 'ht.tg.tilt': 'movimento su/giù', 'ht.tg.hue': 'colore',
      'ht.tg.fx_speed': 'tempo effetti', 'ht.tg.crossfade': 'passaggio tra luci', 'ht.tg.full': 'luce piena',
      'mc.t': 'Calibra su di me', 'mc.lamp': 'Luce {i} di {n}', 'mc.spot': 'Posto {i} di {n}',
      'mc.spot.center': 'Mettiti al centro, di fronte alla camera', 'mc.spot.left': 'Spostati a sinistra e fermati', 'mc.spot.right': 'Spostati a destra e fermati',
      'mc.find': 'Cerco la tua sagoma…', 'mc.confirm': 'La luce ti colpisce?', 'mc.confirmS': 'Pollice su per 3 s = SÌ · pollice giù = NO',
      'mc.adjust': 'Indica col dito dove deve illuminare', 'mc.adjustS': 'La luce segue il dito. Pollice su 3 s = salva · pollice giù = salta questo posto',
      'mc.yes': 'Sì, mi colpisce', 'mc.no': 'No — correggo', 'mc.skip': 'Salta', 'mc.stop': 'Termina', 'mc.done': 'Fatto! Posti salvati: {n}',
      'mc.doneS': 'Ora „Riflettore” e l’inseguimento colpiscono esattamente te. I laser non si puntano sulle persone — provali con Test nel Mixer.',
      'mc.start': 'Mettiti a 2–4 m dalla camera, visibile per intero. Le luci ti trovano da sole a turno — la camera vede quando la tua sagoma si illumina.',
      'mc.quick': 'Veloce — solo il centro', 'mc.quickS': 'mettiti al centro, ogni luce ti trova da sola (circa 20 s per luce)',
      'mc.exact': 'Preciso — 3 posti', 'mc.exactS': 'centro, sinistra, destra — riflettore e inseguimento ti colpiscono ovunque',
      'mc.base': 'Stai fermo — misuro la luce su di te', 'mc.search': 'Ti cerco con la luce…', 'mc.searchS': 'La luce si sposta a passi. Quando la tua sagoma si illumina, salvo da sola.',
      'mc.refine': 'Quasi! Regolo con precisione…', 'mc.found': 'Trovato! Salvo…', 'mc.bright': 'Luminosità della sagoma', 'mc.tried': 'Provati: {a} di {b}',
      'mc.manual': 'Non vedo bene la luce su di te — dimmelo col pollice.',
      'mc.go': 'Iniziamo', 'mc.hold': 'Tieni…', 'mc.noperson': 'Non ti vedo — entra nell’inquadratura',
      'toast.flipX': 'Direzione sinistra/destra invertita', 'toast.flipY': 'Direzione su/giù invertita', 'toast.mecal.nolamps': 'Nessuna luce con pan e tilt da calibrare',
      'dock.off': 'Spegni dispositivo', 'dock.on': 'Accendi dispositivo',
      'sp.t': 'Occhio di bue', 'sp.auto': 'Segui la persona', 'sp.man': 'Imposta a mano', 'sp.click': 'Clicca sull’immagine dove sta la persona (puoi trascinare)', 'sp.off': 'Spegni',
    },
  });

  const CONFIGURABLE = ['point', 'dimmer', 'crossfade', 'strobe', 'color', 'spin', 'full'];
  const TARGETABLE = ['dimmer', 'crossfade', 'color', 'spin'];

  /* ---------------------------------------------------------------- toolbar: fewer buttons */
  function buildToolbar() {
    const tr = $('#hand-stage .float.tr'); if (!tr || $('#ht-dir')) return;
    const keep = ['handui', 'handui-cal', 'floor-cal'].map((id) => $('#' + id)).filter(Boolean);
    const more = document.createElement('div');
    more.className = 'ht-more';
    more.innerHTML = `<button class="btn sm" id="ht-more-b">${ic('setup')}<span>${esc(t('ht.more'))}</span></button><div class="ht-menu" id="ht-menu" hidden></div>`;
    tr.appendChild(more);
    for (const b of keep) $('#ht-menu', more).appendChild(b);
    $('#ht-more-b', more).onclick = (e) => { e.stopPropagation(); const m = $('#ht-menu'); m.hidden = !m.hidden; };
    document.addEventListener('click', (e) => { if (!e.target.closest('.ht-more')) $('#ht-menu').hidden = true; });
    const dir = document.createElement('div');
    dir.className = 'seg ht-dir'; dir.id = 'ht-dir'; dir.title = t('ht.dirT');
    dir.innerHTML = `<span class="ht-dl">${esc(t('ht.dir'))}</span><button data-ax="x" title="${esc(t('ht.flipX'))}">↔</button><button data-ax="y" title="${esc(t('ht.flipY'))}">↕</button>`;
    tr.insertBefore(dir, more);
    for (const b of $$('[data-ax]', dir)) b.onclick = () => { if (S.st && S.st.active_id != null) send({ type: 'flip', id: S.st.active_id, axis: b.dataset.ax }); };
    const me = document.createElement('button');
    me.className = 'btn sm primary'; me.id = 'ht-me';
    me.innerHTML = `${ic('person')}<span>${esc(t('ht.me'))}</span>`;
    me.onclick = () => openMeStart();
    tr.insertBefore(me, dir);
  }

  /* ---------------------------------------------------------------- gesture settings (click a gesture) */
  /* extra actions: several effects / actions on one gesture */
  const COLORS = [['#ff2a2a', 'ht.c.red'], ['#2bd46b', 'ht.c.green'], ['#2a5bff', 'ht.c.blue'], ['#ffffff', 'ht.c.white'], ['#8a2bff', 'ht.c.violet'], ['#ffb000', 'ht.c.amber']];
  const SIMPLE_ACTS = ['flash', 'strobe', 'smoke', 'blackout', 'full', 'dark', 'home', 'next_fixture', 'spotlight', 'autopilot', 'stop_effects'];
  function addOptions() {
    const fx = PH.fxCatalogue ? PH.fxCatalogue().filter(([k]) => !['position', 'dark', 'fade_in', 'fade_out', 'kicks', 'hit'].includes(k)) : [];
    const looks = (S.st && S.st.looks) || [];
    return `<option value="">${esc(t('ht.addPick'))}</option>
      <optgroup label="${esc(t('ht.gFx'))}">${fx.map(([k, n]) => `<option value="effect:${esc(k)}">${esc(n)}</option>`).join('')}</optgroup>
      <optgroup label="${esc(t('ht.gAct'))}">${SIMPLE_ACTS.map((a) => `<option value="${a}">${esc(t('ht.a.' + a))}</option>`).join('')}</optgroup>
      <optgroup label="${esc(t('ht.gCol'))}">${COLORS.map(([h, k]) => `<option value="color:${h}">${esc(t(k))}</option>`).join('')}</optgroup>
      ${looks.length ? `<optgroup label="${esc(t('ht.gLook'))}">${looks.map((l) => `<option value="look:${esc(l.id)}">${esc(l.name || l.id)}</option>`).join('')}</optgroup>` : ''}`;
  }
  function parseAdd(v) {
    if (v.startsWith('effect:')) return { action: 'effect', params: { kind: v.slice(7) } };
    if (v.startsWith('color:')) { const h = v.slice(6); return { action: 'color', params: { rgb: [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) } }; }
    if (v.startsWith('look:')) return { action: 'look', params: { id: v.slice(5) } };
    return { action: v, params: {} };
  }
  function extraName(x) {
    if (x.action === 'effect') { const c = PH.fxCatalogue ? PH.fxCatalogue().find(([k]) => k === (x.params || {}).kind) : null; return c ? c[1] : (x.params || {}).kind; }
    if (x.action === 'color') { const rgb = (x.params || {}).rgb || [255, 255, 255]; const h = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join(''); const c = COLORS.find(([k]) => k === h); return c ? t(c[1]) : h; }
    if (x.action === 'look') { const l = ((S.st && S.st.looks) || []).find((q) => String(q.id) === String((x.params || {}).id)); return l ? l.name : t('ht.gLook'); }
    return t('ht.a.' + x.action);
  }
  function extrasBlock(list, mode, showMode) {
    return `<div class="gp-ex"><b>${esc(t('ht.extra'))}</b><small>${esc(t('ht.extraS'))}</small>
      <div class="gp-chips" id="gp-chips">${list.map((x, i) => `<span class="chip on">${x.action === 'effect' ? ic('sparkle') : x.action === 'color' ? ic('palette') : ic('bolt')}${esc(extraName(x))}<button data-rm="${i}" title="✕">✕</button></span>`).join('') || `<small class="muted">${esc(t('ht.none'))}</small>`}</div>
      <select id="gp-add">${addOptions()}</select>
      ${showMode ? `<div class="seg" id="gp-mode"><button data-m="hold" class="${mode !== 'once' ? 'on' : ''}">${esc(t('ht.mHold'))}</button><button data-m="once" class="${mode === 'once' ? 'on' : ''}">${esc(t('ht.mOnce'))}</button></div>` : ''}
      ${list.length ? `<button class="btn sm" id="gp-try">${ic('play')}<span>${esc(t('ht.try'))}</span></button>` : ''}</div>`;
  }
  function bindExtras(pop, list, save, rerender) {
    for (const b of $$('[data-rm]', pop)) b.onclick = () => { list.splice(Number(b.dataset.rm), 1); save(list); rerender(); };
    $('#gp-add', pop).onchange = (e) => { if (!e.target.value) return; list.push(parseAdd(e.target.value)); save(list); rerender(); };
    const tr = $('#gp-try', pop); if (tr) tr.onclick = () => send({ type: 'gesture_try', actions: list });
  }
  function place(pop, el) {
    const r = (el || $('#glist')).getBoundingClientRect();
    pop.style.left = `${Math.min(window.innerWidth - 350, r.right + 10)}px`;
    pop.style.top = `${Math.max(70, Math.min(window.innerHeight - pop.offsetHeight - 10, r.top - 10))}px`;
  }

  function openGesture(g, keepPos) {
    const st = S.st; if (!st || !st.interaction.gcfg) return;
    const old = $('#gpop'), pos = keepPos && old ? [old.style.left, old.style.top] : null;
    closePop();
    const c = st.interaction.gcfg[g]; if (!c) return;
    const el = $(`#glist .gitem[data-g="${g}"]`);
    const pop = document.createElement('div');
    pop.className = 'gpop'; pop.id = 'gpop';
    const def = { point: 'aim', dimmer: 'dimmer', crossfade: 'crossfade', strobe: 'strobe', color: 'hue', spin: 'spin', full: 'full' }[g];
    const opts = TARGETABLE.includes(g) ? [def, ...st.interaction.targets.filter((x) => x !== def), 'none'] : [def, 'none'];
    const list = (c.extra || []).map((x) => ({ ...x, params: { ...(x.params || {}) } }));
    pop.innerHTML = `<div class="gpop-h"><b>${esc(PH.gestureName(g))}</b><label class="switch"><input type="checkbox" id="gp-on" ${c.on ? 'checked' : ''}><span></span></label></div>
      <label class="gp-row"><span><b>${esc(t('ht.target'))}</b></span>
        <select id="gp-t">${opts.map((x) => `<option value="${x}" ${x === c.target ? 'selected' : ''}>${esc(t('ht.tg.' + x))}</option>`).join('')}</select></label>
      <label class="gp-row"><span><b>${esc(t('ht.gain'))}</b><small>${esc(t('ht.gainS'))}</small></span>
        <input type="range" id="gp-gain" min="0.2" max="3" step="0.1" value="${c.gain}"><output id="gp-gv">${Number(c.gain).toFixed(1)}×</output></label>
      ${extrasBlock(list, c.extra_mode, true)}
      <label class="gp-row gp-rel"><span><b>${esc(t('ht.rel'))}</b><small>${esc(t('ht.relS'))}</small></span><label class="switch"><input type="checkbox" id="gp-rel" ${st.interaction.relative ? 'checked' : ''}><span></span></label></label>
      <button class="btn primary sm" id="gp-x">${esc(t('ht.close'))}</button>`;
    document.body.appendChild(pop);
    if (pos) { pop.style.left = pos[0]; pop.style.top = pos[1]; } else place(pop, el);
    $('#gp-on', pop).onchange = (e) => send({ type: 'gesture_cfg', g, on: e.target.checked });
    $('#gp-gain', pop).oninput = (e) => { $('#gp-gv', pop).textContent = `${Number(e.target.value).toFixed(1)}×`; };
    $('#gp-gain', pop).onchange = (e) => send({ type: 'gesture_cfg', g, gain: Number(e.target.value) });
    $('#gp-t', pop).onchange = (e) => send({ type: 'gesture_cfg', g, target: e.target.value });
    $('#gp-rel', pop).onchange = (e) => send({ type: 'gesture_relative', value: e.target.checked });
    for (const b of $$('#gp-mode [data-m]', pop)) b.onclick = () => { send({ type: 'gesture_cfg', g, extra_mode: b.dataset.m }); for (const x of $$('#gp-mode [data-m]', pop)) x.classList.toggle('on', x === b); };
    const redraw = () => setTimeout(() => openGesture(g, true), 150);
    bindExtras(pop, list, (l) => { c.extra = l; send({ type: 'gesture_cfg', g, extra: l }); }, redraw);
    $('#gp-x', pop).onclick = closePop;
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
  }
  /* own (recorded) gestures: extra actions too */
  function openCustom(id, keepPos) {
    const st = S.st; const g = ((st && st.interaction.custom && st.interaction.custom.list) || []).find((x) => x.id === id); if (!g) return;
    const old = $('#gpop'), pos = keepPos && old ? [old.style.left, old.style.top] : null;
    closePop();
    const list = (g.extra || []).map((x) => ({ ...x, params: { ...(x.params || {}) } }));
    const pop = document.createElement('div');
    pop.className = 'gpop'; pop.id = 'gpop';
    pop.innerHTML = `<div class="gpop-h"><b>${esc(g.name)}</b></div>${extrasBlock(list, 'once', false)}<button class="btn primary sm" id="gp-x">${esc(t('ht.close'))}</button>`;
    document.body.appendChild(pop);
    if (pos) { pop.style.left = pos[0]; pop.style.top = pos[1]; } else place(pop, $(`#g-mine .mine-row[data-id="${id}"]`));
    bindExtras(pop, list, (l) => { g.extra = l; send({ type: 'gesture_extra', id, extra: l }); }, () => setTimeout(() => openCustom(id, true), 150));
    $('#gp-x', pop).onclick = closePop;
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
  }
  const outside = (e) => { if (!e.target.closest('#gpop') && !e.target.closest('.gitem') && !e.target.closest('.mine-row')) closePop(); };
  function closePop() { const p = $('#gpop'); if (p) p.remove(); document.removeEventListener('pointerdown', outside); }
  document.addEventListener('click', (e) => {
    const it = e.target.closest('#glist .gitem');
    if (it && CONFIGURABLE.includes(it.dataset.g)) openGesture(it.dataset.g);
    const mr = e.target.closest('#g-mine .mine-row');
    if (mr && !e.target.closest('button')) openCustom(mr.dataset.id);
  });
  function markGestures(st) {
    const cfg = st.interaction.gcfg || {};
    for (const el of $$('#glist .gitem')) {
      const c = cfg[el.dataset.g];
      el.classList.toggle('cfg', !!c);
      el.classList.toggle('off', !!c && !c.on);
    }
  }

  /* ---------------------------------------------------------------- calibration on me */
  function openMeStart() {
    PH.setTab('hand');
    const ov = ensureOverlay();
    ov.hidden = false;
    ov.innerHTML = `<div class="mc-card"><div class="mc-h">${ic('person')}<b>${esc(t('mc.t'))}</b></div>
      <p class="mc-big">${esc(t('mc.start'))}</p>
      <div class="mc-gest"><span class="mc-g yes">${ic('check')} ${esc(t('mc.confirmS').split('·')[0])}</span><span class="mc-g no">${ic('close')} ${esc(t('mc.confirmS').split('·')[1] || '')}</span></div>
      <div class="mc-modes"><button class="hm-tile accent" data-sp="1"><span class="hm-ic">${ic('bolt')}</span><b>${esc(t('mc.quick'))}</b><small>${esc(t('mc.quickS'))}</small></button>
        <button class="hm-tile" data-sp="3"><span class="hm-ic">${ic('target')}</span><b>${esc(t('mc.exact'))}</b><small>${esc(t('mc.exactS'))}</small></button></div>
      <div class="lm-btns"><button class="btn ghost" id="mc-x">${esc(t('lb.cancel'))}</button></div></div>`;
    $('#mc-x', ov).onclick = () => { ov.hidden = true; };
    for (const b of $$('[data-sp]', ov)) b.onclick = () => { ov.dataset.sig = ''; send({ type: 'mecal_start', spots: Number(b.dataset.sp) }); };
  }
  PH.openMeCal = openMeStart;
  function ensureOverlay() {
    let ov = $('#mc-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'mc-ov'; ov.className = 'mc-ov'; ov.hidden = true; ($('#hand-stage') || document.body).appendChild(ov); }
    return ov;
  }
  let doneShown = false;
  function renderMe(st) {
    const m = st.interaction.mecal, ov = ensureOverlay();
    if (!m) return;
    if (!m.active) {
      if (m.phase === 'done' && !doneShown && ov.dataset.run === '1') {
        doneShown = true; ov.dataset.run = '0'; ov.hidden = false;
        ov.innerHTML = `<div class="mc-card"><div class="mc-h ok">${ic('check')}<b>${esc(t('mc.done', { n: m.saved }))}</b></div><p class="muted">${esc(t('mc.doneS'))}</p>
          <div class="lm-btns"><span class="grow"></span><button class="btn primary" id="mc-ok">${esc(t('ht.close'))}</button></div></div>`;
        $('#mc-ok', ov).onclick = () => { ov.hidden = true; };
      } else if (ov.dataset.run === '1') { ov.dataset.run = '0'; ov.hidden = true; }
      return;
    }
    doneShown = false; ov.dataset.run = '1'; ov.hidden = false;
    const sig = JSON.stringify([m.phase, m.lamp_i, m.spot_i, m.lamp && m.lamp.name, PH.lang]);
    if (ov.dataset.sig !== sig) {
      ov.dataset.sig = sig;
      const BIG = { find: t(`mc.spot.${m.spot}`), base: t('mc.base'), search: t('mc.search'), refine: t('mc.refine'), found: t('mc.found'), confirm: t('mc.confirm'), adjust: t('mc.adjust') };
      const SUB = { find: t('mc.find'), base: t(`mc.spot.${m.spot}`), search: t('mc.searchS'), refine: t('mc.searchS'), found: '', confirm: `${t('mc.manual')} ${t('mc.confirmS')}`, adjust: t('mc.adjustS') };
      const big = BIG[m.phase] || '', sub = SUB[m.phase] || '';
      ov.innerHTML = `<div class="mc-card run ph-${m.phase}">
        <div class="mc-h">${ic('person')}<b>${esc(t('mc.t'))}</b><span class="grow"></span>
          <span class="cl-pill">${esc(t('mc.lamp', { i: m.lamp_i + 1, n: m.lamps_n }))} · <b>${esc(m.lamp ? m.lamp.name : '')}</b></span></div>
        <div class="mc-steps">${Array.from({ length: m.spots_n }, (_, k) => `<i class="${k < m.spot_i ? 'done' : k === m.spot_i ? 'cur' : ''}"></i>`).join('')}<small>${esc(t('mc.spot', { i: m.spot_i + 1, n: m.spots_n }))}</small></div>
        <div class="mc-main"><div class="mc-ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" class="bg"/><circle cx="32" cy="32" r="28" class="fg" id="mc-fg"/></svg><span id="mc-ic">${ic({ find: 'person', base: 'person', search: 'target', refine: 'target', found: 'check', confirm: 'help', adjust: 'point' }[m.phase] || 'person')}</span></div>
          <div><p class="mc-big">${esc(big)}</p><p class="muted">${esc(sub)}</p>
            ${['search', 'refine', 'found'].includes(m.phase) ? `<div class="mc-bright"><small>${esc(t('mc.bright'))}</small><div class="bar"><i id="mc-bb"></i></div><small id="mc-tr"></small></div>` : ''}</div></div>
        <div class="mc-btns">
          ${['confirm', 'adjust'].includes(m.phase) ? `<div class="mc-arrows"><button class="btn" data-n="0:-1">↑</button><button class="btn" data-n="-1:0">←</button><button class="btn" data-n="1:0">→</button><button class="btn" data-n="0:1">↓</button></div>` : ''}
          <span class="grow"></span>
          ${!['find', 'base'].includes(m.phase) ? `<button class="btn primary" id="mc-yes">${ic('check')}<span>${esc(t('mc.yes'))}</span></button>` : ''}
          ${m.phase === 'confirm' ? `<button class="btn" id="mc-no">${esc(t('mc.no'))}</button>` : ''}
          <button class="btn ghost" id="mc-skip">${esc(t('mc.skip'))}</button><button class="btn ghost danger-t" id="mc-stop">${esc(t('mc.stop'))}</button></div></div>`;
      for (const b of $$('[data-n]', ov)) b.onclick = () => { const [dx, dy] = b.dataset.n.split(':').map(Number); send({ type: 'mecal_nudge', dx, dy }); };
      const y = $('#mc-yes', ov); if (y) y.onclick = () => send({ type: 'mecal_yes' });
      const n = $('#mc-no', ov); if (n) n.onclick = () => send({ type: 'mecal_no' });
      $('#mc-skip', ov).onclick = () => send({ type: 'mecal_skip' });
      $('#mc-stop', ov).onclick = () => send({ type: 'mecal_stop' });
    }
    const fg = $('#mc-fg', ov);
    const ring = m.hold_kind ? m.hold : ['search', 'refine'].includes(m.phase) && m.total ? m.tried / m.total : m.phase === 'found' ? 1 : 0;
    if (fg) { fg.style.strokeDashoffset = String(176 - 176 * (ring || 0)); fg.classList.toggle('no', m.hold_kind === 'no'); }
    const bb = $('#mc-bb', ov); if (bb) bb.style.width = `${Math.round((m.bright || 0) * 100)}%`;
    const tr = $('#mc-tr', ov); if (tr) tr.textContent = m.total ? t('mc.tried', { a: m.tried, b: m.total }) : '';
  }

  /* ---------------------------------------------------------------- spotlight: follow a person or place it by hand */
  const SP = { placing: false, drag: false };
  function spotPanel(st) {
    const sp = st.spotlight || {}, stage = $('#hand-stage'); if (!stage) return;
    let el = $('#sp-panel');
    if (!sp.active) { if (el) el.remove(); SP.placing = false; return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'sp-panel'; el.className = 'sp-panel';
      stage.appendChild(el);
    }
    const man = !!sp.manual || SP.placing;
    const sig = JSON.stringify([man, PH.lang]);
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig;
      el.innerHTML = `<b>${ic('spot')} ${esc(t('sp.t'))}</b><div class="seg"><button data-sp="auto" class="${man ? '' : 'on'}">${esc(t('sp.auto'))}</button><button data-sp="man" class="${man ? 'on' : ''}">${esc(t('sp.man'))}</button></div>
        ${man ? `<small>${esc(t('sp.click'))}</small>` : ''}<button class="btn sm ghost" data-sp="off">${esc(t('sp.off'))}</button>`;
      for (const b of $$('[data-sp]', el)) b.onclick = () => {
        if (b.dataset.sp === 'auto') { SP.placing = false; send({ type: 'spotlight', point: null }); }
        else if (b.dataset.sp === 'man') { SP.placing = true; el.dataset.sig = ''; }
        else { SP.placing = false; send({ type: 'spotlight', value: false, point: null }); }
      };
    }
    SP.placing = man;
  }
  function spotPoint(e) {
    const cv = $('#video-canvas'), r = cv.getBoundingClientRect(), R = PH.frameRect(r.width, r.height);
    return [Math.max(0, Math.min(1, (e.clientX - r.left - R.x) / R.w)), Math.max(0, Math.min(1, (e.clientY - r.top - R.y) / R.h))];
  }
  document.addEventListener('pointerdown', (e) => {
    if (!SP.placing || e.target.id !== 'video-canvas') return;
    e.stopPropagation(); e.preventDefault(); SP.drag = true;
    send({ type: 'spotlight', point: spotPoint(e) });
  }, true);
  document.addEventListener('pointermove', (e) => { if (SP.drag) send({ type: 'spotlight', point: spotPoint(e) }); }, true);
  document.addEventListener('pointerup', () => { SP.drag = false; }, true);

  /* ---------------------------------------------------------------- live state */
  PH.onState.push((st) => {
    if (S.tab !== 'hand' && !(st.interaction.mecal && st.interaction.mecal.active)) return;
    buildToolbar();
    const f = st.fixtures.find((x) => x.id === st.active_id);
    for (const b of $$('#ht-dir [data-ax]')) b.classList.toggle('on', !!f && (b.dataset.ax === 'x' ? f.flip_x : f.flip_y));
    const d = $('#ht-dir'); if (d) d.classList.toggle('dis', !f);
    markGestures(st);
    renderMe(st);
    spotPanel(st);
  });
})();
