/* Lumo — Pokaz → Efekty: pick the lamps, click an effect, it plays.
 *
 * The chosen lamps leave the show only for that layer (movement, colour, brightness …) and play the
 * effect; the other lamps (and the other layers) keep following the music.  Tempo / size / colours
 * change the effect at once.  "Zapisz jako scenę" keeps how the lamps look plus the running effects;
 * a click on the scene brings it all back.
 * Uses PH (app.js), ic (icons.js).  Server: my_fx, my_fx_stop, look_save.  Renders into #sh-fx (live.js).
 */
'use strict';
(() => {
  const PH = window.PH;
  const { S, send, t, esc, toast } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'mf.title': 'Efekty', 'mf.sub': 'Wybierz lampy i kliknij efekt — od razu gra. Te lampy grają efekt, reszta dalej gra pokaz w rytm.',
      'mf.g.move': 'Ruch', 'mf.g.color': 'Kolor', 'mf.g.dim': 'Jasność', 'mf.g.special': 'Specjalne',
      'mf.lamps': 'Lampy', 'mf.all': 'Wszystkie', 'mf.tempo': 'Tempo', 'mf.t0': 'wolno', 'mf.t1': 'średnio', 'mf.t2': 'szybko',
      'mf.size': 'Wielkość ruchu', 'mf.s0': 'mały', 'mf.s1': 'średni', 'mf.s2': 'duży', 'mf.c1': 'Kolor', 'mf.c2': 'Drugi kolor',
      'mf.running': 'Grają teraz', 'mf.none': 'Żaden efekt nie gra — kliknij któryś powyżej.', 'mf.stopAll': 'Zatrzymaj wszystkie (oddaj pokazowi)',
      'mf.save': 'Zapisz jako scenę', 'mf.name': 'Nazwa sceny (lampy + efekty):', 'mf.saved': 'Zapisano scenę „{n}” razem z efektami',
      'mf.noLamps': 'Zaznacz przynajmniej jedną lampę.', 'mf.on': '{e} → {n}', 'mf.stop': 'Zatrzymaj',
      'mf.circle': 'Koło', 'mf.figure8': 'Ósemka', 'mf.sweep': 'Przeczesywanie', 'mf.tilt_wave': 'Fala góra–dół', 'mf.fan': 'Wachlarz',
      'mf.ballyhoo': 'Szalony ruch', 'mf.searchlight': 'Szperacz', 'mf.crossfire': 'Krzyżowanie',
      'mf.rainbow': 'Tęcza', 'mf.chase': 'Pościg kolorów', 'mf.two_color': 'Dwa kolory na zmianę', 'mf.static_color': 'Jeden kolor',
      'mf.gradient': 'Przejście kolorów', 'mf.fire': 'Ogień', 'mf.ocean': 'Ocean', 'mf.aurora': 'Zorza', 'mf.police': 'Policja',
      'mf.wave': 'Fala światła', 'mf.beat': 'Błysk w rytm', 'mf.chase_beat': 'Pościg w rytm', 'mf.breathe': 'Oddech', 'mf.pulse': 'Pulsowanie',
      'mf.sparkle': 'Iskry', 'mf.strobe': 'Stroboskop', 'mf.gobo_spin': 'Gobo — obrót', 'mf.gobo_shake': 'Gobo — drganie', 'mf.motors': 'Obrót lamp efektowych',
    },
    it: {
      'mf.title': 'Effetti', 'mf.sub': 'Scegli le luci e clicca un effetto — parte subito. Quelle luci fanno l’effetto, le altre continuano lo show a tempo.',
      'mf.g.move': 'Movimento', 'mf.g.color': 'Colore', 'mf.g.dim': 'Luminosità', 'mf.g.special': 'Speciali',
      'mf.lamps': 'Luci', 'mf.all': 'Tutte', 'mf.tempo': 'Tempo', 'mf.t0': 'lento', 'mf.t1': 'medio', 'mf.t2': 'veloce',
      'mf.size': 'Ampiezza', 'mf.s0': 'piccola', 'mf.s1': 'media', 'mf.s2': 'grande', 'mf.c1': 'Colore', 'mf.c2': 'Secondo colore',
      'mf.running': 'In corso', 'mf.none': 'Nessun effetto — cliccane uno sopra.', 'mf.stopAll': 'Ferma tutti (torna allo show)',
      'mf.save': 'Salva come scena', 'mf.name': 'Nome della scena (luci + effetti):', 'mf.saved': 'Scena „{n}” salvata con gli effetti',
      'mf.noLamps': 'Scegli almeno una luce.', 'mf.on': '{e} → {n}', 'mf.stop': 'Ferma',
      'mf.circle': 'Cerchio', 'mf.figure8': 'Otto', 'mf.sweep': 'Spazzata', 'mf.tilt_wave': 'Onda su–giù', 'mf.fan': 'Ventaglio',
      'mf.ballyhoo': 'Movimento pazzo', 'mf.searchlight': 'Faro', 'mf.crossfire': 'Incrocio',
      'mf.rainbow': 'Arcobaleno', 'mf.chase': 'Inseguimento colori', 'mf.two_color': 'Due colori alternati', 'mf.static_color': 'Un colore',
      'mf.gradient': 'Sfumatura', 'mf.fire': 'Fuoco', 'mf.ocean': 'Oceano', 'mf.aurora': 'Aurora', 'mf.police': 'Polizia',
      'mf.wave': 'Onda di luce', 'mf.beat': 'Lampo a tempo', 'mf.chase_beat': 'Inseguimento a tempo', 'mf.breathe': 'Respiro', 'mf.pulse': 'Pulsazione',
      'mf.sparkle': 'Scintille', 'mf.strobe': 'Stroboscopio', 'mf.gobo_spin': 'Gobo — rotazione', 'mf.gobo_shake': 'Gobo — vibrazione', 'mf.motors': 'Rotazione luci effetto',
    },
  });

  const K = [0.5, 1, 2];                                        // tempo: slow / medium / fast
  const SIZE = [15, 35, 60];
  // [kind, icon, group, needs: 'c1' | 'c2' | 'size' | '', params(tempo, size, c1, c2)]
  const FX = [
    ['circle', 'refresh', 'move', 'size', (tp, sz) => ({ beats: [16, 8, 4][tp], speed: 0.35 * K[tp], size: SIZE[sz] })],
    ['figure8', 'move', 'move', 'size', (tp, sz) => ({ beats: [16, 8, 4][tp], speed: 0.3 * K[tp], size: SIZE[sz] })],
    ['sweep', 'arrows', 'move', 'size', (tp, sz) => ({ beats: [16, 8, 4][tp], speed: 0.25 * K[tp], size: SIZE[sz] * 2 })],
    ['tilt_wave', 'wave', 'move', 'size', (tp, sz) => ({ beats: [8, 4, 2][tp], speed: 0.4 * K[tp], size: SIZE[sz] })],
    ['fan', 'spot', 'move', 'size', (tp, sz) => ({ speed: 0.2 * K[tp], size: SIZE[sz] * 1.6 })],
    ['ballyhoo', 'bolt', 'move', 'size', (tp, sz) => ({ speed: 0.25 * K[tp], size: SIZE[sz] * 1.4 })],
    ['searchlight', 'crosshair', 'move', 'size', (tp, sz) => ({ speed: 0.1 * K[tp], size: SIZE[sz] })],
    ['crossfire', 'arrows', 'move', 'size', (tp, sz) => ({ speed: 0.3 * K[tp], size: SIZE[sz] * 1.3 })],
    ['rainbow', 'palette', 'color', '', (tp) => ({ beats: [16, 8, 4][tp], speed: 0.15 * K[tp], spread: 0.2 })],
    ['chase', 'next', 'color', '', (tp) => ({ beats: [4, 2, 1][tp], speed: 2 * K[tp], spread: 0.34 })],
    ['two_color', 'palette', 'color', 'c2', (tp, sz, a, b) => ({ beats: [4, 2, 1][tp], speed: K[tp], color_a: a, color_b: b })],
    ['static_color', 'drop', 'color', 'c1', (tp, sz, a) => ({ color_a: a })],
    ['gradient', 'wave', 'color', 'c2', (tp, sz, a, b) => ({ speed: 0.25 * K[tp], color_a: a, color_b: b, spread: 0.2 })],
    ['fire', 'flame', 'color', '', (tp) => ({ speed: K[tp] })],
    ['ocean', 'drop', 'color', '', (tp) => ({ speed: 0.2 * K[tp], spread: 0.3 })],
    ['aurora', 'sparkle', 'color', '', (tp) => ({ speed: 0.08 * K[tp], spread: 0.2 })],
    ['police', 'bolt', 'color', '', (tp) => ({ speed: K[tp] })],
    ['wave', 'wave', 'dim', '', (tp) => ({ beats: [4, 2, 1][tp], speed: K[tp], width: 0.35 })],
    ['beat', 'pulse', 'dim', '', (tp) => ({ beats: [2, 1, 0.5][tp] })],
    ['chase_beat', 'next', 'dim', '', (tp) => ({ rate: K[tp], floor: 0.12 })],
    ['breathe', 'moon', 'dim', '', (tp) => ({ beats: [8, 4, 2][tp], speed: 0.25 * K[tp] })],
    ['pulse', 'pulse', 'dim', '', (tp) => ({ beats: [4, 2, 1][tp], speed: K[tp] })],
    ['sparkle', 'sparkle', 'dim', '', (tp) => ({ speed: [4, 8, 14][tp] })],
    ['strobe', 'strobe', 'dim', '', (tp) => ({ speed: [120, 200, 245][tp] })],
    ['gobo_spin', 'gobo', 'special', '', (tp) => ({ speed: [20, 60, 120][tp] })],
    ['gobo_shake', 'gobo', 'special', '', () => ({})],
    ['motors', 'derby', 'special', '', (tp) => ({ energy: [0.2, 0.55, 0.9][tp], flip: tp > 0, aux: tp === 2, beats: 8 })],
  ];
  const BY = Object.fromEntries(FX.map((x) => [x[0], x]));
  const COLORS = [[255, 40, 160], [255, 140, 0], [255, 190, 110], [255, 255, 255], [255, 0, 0], [0, 60, 255], [150, 0, 255], [0, 220, 200], [0, 255, 60]];
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const MF = { group: 'move', sel: null, tempo: 1, size: 1, c1: COLORS[0], c2: COLORS[5], last: null };
  try { Object.assign(MF, JSON.parse(localStorage.getItem('ph_myfx') || '{}'), { sel: null, last: null }); } catch (e) { /* private */ }
  const remember = () => { try { localStorage.setItem('ph_myfx', JSON.stringify({ group: MF.group, tempo: MF.tempo, size: MF.size, c1: MF.c1, c2: MF.c2 })); } catch (e) { /* private */ } };

  const lamps = (st) => st.fixtures.filter((f) => f.type !== 'smoke' && f.type !== 'laser' && f.enabled !== false);
  const running = (st) => (st.effects.active || []).filter((a) => a.id.startsWith('my-'));
  function selIds(st) {
    const all = lamps(st).map((f) => f.id);
    if (!MF.sel) MF.sel = new Set(all);
    return all.filter((id) => MF.sel.has(id));
  }

  function play(kind) {
    const st = S.st; if (!st) return;
    const ids = selIds(st); if (!ids.length) { toast(t('mf.noLamps'), 'warn'); return; }
    const e = BY[kind]; if (!e) return;
    send({ type: 'my_fx', kind, ids, params: e[4](MF.tempo, MF.size, MF.c1, MF.c2) });
    MF.last = kind;
  }
  const replay = () => { if (MF.last && running(S.st).some((a) => a.kind === MF.last)) play(MF.last); };

  function render(st) {
    const box = $('#sh-fx'); if (!box) return;
    const ls = lamps(st), ids = selIds(st), run = running(st);
    const need = MF.last ? BY[MF.last][3] : '';
    const sig = JSON.stringify([ls.map((f) => [f.id, f.name]), ids, run.map((a) => [a.id, a.kind, a.ids]), MF.group, MF.tempo, MF.size, MF.c1, MF.c2, MF.last, PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const on = new Set(run.map((a) => a.kind));
    const name = (id) => (st.fixtures.find((f) => f.id === id) || {}).name || id;
    const swatches = (key, cur) => `<div class="mf-sw">${COLORS.map((c) => `<button data-${key}="${hex(c)}" class="${hex(c) === hex(cur) ? 'on' : ''}" style="--c:${hex(c)}"></button>`).join('')}</div>`;
    const seg = (key, n, cur) => `<div class="seg mf-seg">${[0, 1, 2].map((v) => `<button data-${key}="${v}" class="${cur === v ? 'on' : ''}">${esc(t(`mf.${n}${v}`))}</button>`).join('')}</div>`;
    box.innerHTML = `<div class="mn-h"><h4>${esc(t('mf.title'))}</h4><small>${esc(t('mf.sub'))}</small></div>
      <div class="mf-grid">
        <div class="mf-pick">
          <div class="seg mf-groups">${['move', 'color', 'dim', 'special'].map((g) => `<button data-g="${g}" class="${MF.group === g ? 'on' : ''}">${esc(t('mf.g.' + g))}</button>`).join('')}</div>
          <div class="mf-tiles">${FX.filter((x) => x[2] === MF.group).map(([k, icn]) => `<button class="mf-tile${on.has(k) ? ' on' : ''}" data-fx="${k}">${ic(icn)}<b>${esc(t('mf.' + k))}</b></button>`).join('')}</div>
        </div>
        <div class="mf-opts">
          <b class="mn-l">${esc(t('mf.lamps'))}</b>
          <div class="mn-lamps"><button class="mn-chip all${ids.length === ls.length ? ' on' : ''}" data-all>${esc(t('mf.all'))}</button>${ls.map((f) => `<button class="mn-chip${MF.sel.has(f.id) ? ' on' : ''}" data-id="${f.id}">${esc(ls.filter((x) => x.name === f.name).length > 1 ? `${f.name} · ${String(f.address).padStart(3, '0')}` : f.name)}</button>`).join('')}</div>
          <b class="mn-l">${esc(t('mf.tempo'))}</b>${seg('tp', 't', MF.tempo)}
          ${MF.group === 'move' ? `<b class="mn-l">${esc(t('mf.size'))}</b>${seg('sz', 's', MF.size)}` : ''}
          ${MF.group === 'color' ? `<b class="mn-l">${esc(t('mf.c1'))}</b>${swatches('c1', MF.c1)}${need === 'c2' || !need ? `<b class="mn-l">${esc(t('mf.c2'))}</b>${swatches('c2', MF.c2)}` : ''}` : ''}
        </div>
      </div>
      <div class="mf-run"><b class="mn-l">${esc(t('mf.running'))}</b>
        ${run.length ? `<div class="mf-chips">${run.map((a) => `<span class="mf-chip">${esc(t('mf.on', { e: t('mf.' + a.kind) === 'mf.' + a.kind ? a.kind : t('mf.' + a.kind), n: a.ids.map(name).join(', ') }))}<button data-stop="${esc(a.id)}" title="${esc(t('mf.stop'))}">${ic('close')}</button></span>`).join('')}</div>
          <div class="mn-act"><button class="btn" id="mf-stop">${esc(t('mf.stopAll'))}</button><button class="btn primary" id="mf-save">${ic('save')}<span>${esc(t('mf.save'))}</span></button></div>`
          : `<p class="sc-none">${esc(t('mf.none'))}</p>`}</div>`;
    for (const b of $$('[data-g]', box)) b.onclick = () => { MF.group = b.dataset.g; remember(); box.dataset.sig = ''; render(S.st); };
    for (const b of $$('[data-fx]', box)) b.onclick = () => play(b.dataset.fx);
    for (const b of $$('[data-id]', box)) b.onclick = () => { const id = Number(b.dataset.id); if (MF.sel.has(id)) MF.sel.delete(id); else MF.sel.add(id); box.dataset.sig = ''; render(S.st); };
    const all = $('[data-all]', box); if (all) all.onclick = () => { MF.sel = new Set(ids.length === ls.length ? [] : ls.map((f) => f.id)); box.dataset.sig = ''; render(S.st); };
    for (const b of $$('[data-tp]', box)) b.onclick = () => { MF.tempo = Number(b.dataset.tp); remember(); replay(); box.dataset.sig = ''; render(S.st); };
    for (const b of $$('[data-sz]', box)) b.onclick = () => { MF.size = Number(b.dataset.sz); remember(); replay(); box.dataset.sig = ''; render(S.st); };
    const pickC = (key) => (b) => { MF[key] = COLORS.find((c) => hex(c) === b.dataset[key]); remember(); replay(); box.dataset.sig = ''; render(S.st); };
    for (const b of $$('[data-c1]', box)) b.onclick = () => pickC('c1')(b);
    for (const b of $$('[data-c2]', box)) b.onclick = () => pickC('c2')(b);
    for (const b of $$('[data-stop]', box)) b.onclick = () => send({ type: 'my_fx_stop', id: b.dataset.stop });
    const stop = $('#mf-stop', box); if (stop) stop.onclick = () => { send({ type: 'my_fx_stop' }); MF.last = null; };
    const save = $('#mf-save', box);
    if (save) save.onclick = () => {
      const name = prompt(t('mf.name'), ''); if (!name || !name.trim()) return;
      const lampsUsed = [...new Set(run.flatMap((a) => a.ids))];
      send({ type: 'look_save', name: name.trim().slice(0, 24), ids: lampsUsed.length ? lampsUsed : 'all', fade: 1.0, color: hex(MF.c1) });
      toast(t('mf.saved', { n: name.trim() }));
    };
  }

  PH.onState.push((st) => { if (S.tab === 'show') render(st); });
  // for the AI helper: start an effect on these lamps with the current tempo / size / colours
  PH.playFx = (kind, ids) => {
    const e = BY[kind]; if (!e || !S.st) return false;
    const all = lamps(S.st).map((f) => f.id);
    const use = ids && ids.length ? ids.filter((i) => all.includes(i)) : all;
    if (!use.length) return false;
    send({ type: 'my_fx', kind, ids: use, params: e[4](MF.tempo, MF.size, MF.c1, MF.c2) });
    return true;
  };
  PH.FX_KINDS = FX.map((x) => x[0]);
})();
