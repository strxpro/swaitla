/* Lumo — Muzyka
 * 1. Na żywo: wejście audio (kabel z miksera / line-in) → wykrywanie bitów i dropów → reakcje świateł
 * 2. Efekty: pad z efektami ruchu / koloru / jasności / gobo + własne efekty (serwer: effects.py)
 * 3. Oś czasu: utwór z pliku → bity, BPM i pojedyncze kicki → klatki kluczowe przyciągane magnetycznie
 *    do kicka / bitu, nagrywanie klawiszem K w trakcie odtwarzania, cofanie, kopiowanie, zapis pokazów
 * 4. Kreator efektu: narysowany ruch + sekwencja kolorów + 16-krokowy wzór jasności + gobo → zapis na serwerze
 * Uses globals from app.js: $, $$, send, S, toast, clamp, esc, setText, fitCanvas, dpr, t, LANG, PH
 */
'use strict';

PH.addI18n({
  pl: {
    'mu.cat.move': 'Ruch', 'mu.cat.color': 'Kolor', 'mu.cat.dim': 'Jasność', 'mu.cat.beam': 'Gobo', 'mu.cat.preset': 'Moje efekty',
    'mu.newfx': '+ Własny efekt', 'mu.magnet': 'Magnes', 'mu.kickfill': 'Na każdy kick', 'mu.tap': 'Wstaw (K)',
    'mu.undo': 'Cofnij', 'mu.zoomin': 'Przybliż', 'mu.zoomout': 'Oddal', 'mu.fit': 'Cały utwór',
    'mu.track': 'Utwór', 'mu.kicks': 'kicki', 'mu.empty': 'Wczytaj utwór (MP3 / WAV / FLAC) — bity i kicki pokażą się automatycznie',
    'mu.help': 'Wybierz efekt powyżej i kliknij na osi — klatka sama przyklei się do najbliższego kicka ( ▼ ) albo bitu. Przeciągnij, żeby przesunąć, prawy brzeg = długość. K = wstaw w trakcie grania · Ctrl+Z cofnij · Ctrl+C / Ctrl+V · Delete usuń · Spacja start/pauza · Alt = bez magnesu.',
    'mu.len': 'Długość', 'mu.rhythm': 'Rytm', 'mu.rfree': 'swobodny', 'mu.speed2': 'Prędkość', 'mu.size2': 'Zasięg',
    'mu.col1': 'Kolor', 'mu.col2': 'Kolor 2', 'mu.lamps': 'Lampy', 'mu.all': 'wszystkie', 'mu.dup': '⧉ Duplikuj', 'mu.delcue': 'Usuń klatkę',
    'mu.pan': 'Poziomo', 'mu.tilt': 'Pionowo', 'mu.here': 'Z obecnej pozycji', 'mu.gobo': 'Gobo',
    'mu.beats': '{n} bit.', 'mu.cycle': '1 cykl = {n} bit.',
    'mu.snapKick': 'KICK', 'mu.snapBeat': 'BIT', 'mu.snapBar': 'TAKT',
    'mu.kickfillDone': 'Dodano {n} klatek na kickach', 'mu.kickfillNone': 'Brak kicków na widocznym fragmencie',
    'mu.pickTool': 'Najpierw wybierz efekt z listy', 'mu.noSong': 'Najpierw wczytaj utwór',
    'cr.title': 'Kreator efektu', 'cr.name': 'Nazwa efektu', 'cr.move': 'Ruch', 'cr.color': 'Kolor', 'cr.dim': 'Jasność', 'cr.beam': 'Gobo',
    'cr.none': '— brak —', 'cr.draw': 'Narysuj własny ruch', 'cr.seq': 'Sekwencja kolorów', 'cr.pattern': 'Wzór 16 kroków',
    'cr.drawHint': 'Narysuj kształt myszką (albo palcem) — światło będzie po nim jeździć.',
    'cr.fade': 'płynne przejścia', 'cr.addColor': '+ kolor', 'cr.cycle': 'Jeden cykl trwa',
    'cr.preview': '▶ Podgląd na lampach', 'cr.stopPreview': '■ Zatrzymaj podgląd', 'cr.save': 'Zapisz efekt', 'cr.cancel': 'Anuluj',
    'cr.saved': 'Zapisano efekt „{n}”', 'cr.needName': 'Wpisz nazwę efektu', 'cr.needLayer': 'Wybierz co najmniej jedną warstwę',
    'cr.delete': 'Usunąć efekt „{n}”?', 'cr.deleted': 'Usunięto efekt „{n}”', 'cr.edit': 'Edytuj',
    'cr.p.four': 'Na każdy bit', 'cr.p.off': 'Pomiędzy bitami', 'cr.p.gallop': 'Galop', 'cr.p.build': 'Narastanie', 'cr.p.clear': 'Wyczyść',
    'ap.title': 'Autopilot i styl', 'ap.hint': 'Autopilot sam zmienia ruch, kolory i jasność w rytm muzyki (na żywo z miksera albo z utworu na osi czasu). Styl i paleta działają też dla Auto-show.',
    'ap.on': 'Autopilot: WŁĄCZONY', 'ap.off': 'Włącz autopilota', 'ap.style': 'Styl', 'ap.pal': 'Kolory pokazu',
    'ap.addc': '+ kolor', 'ap.spot': 'Czasem reflektor na osobę (w spokojniejszych momentach)', 'ap.nomusic': 'Czekam na muzykę — włącz wejście na żywo albo odtwórz utwór',
    'ap.bpm': 'Gra w rytmie {b} BPM',
    'md.calm': 'wolne ruchy, płynne kolory, oddech jasności', 'md.dynamic': 'ruch co takt, zmiany kolorów, strobo na dropie',
    'md.dance': 'błysk na każdy bit, podskoki, kolor co bit', 'md.rave': 'szybkie losowe ruchy, pościg kolorów, mocne strobo',
    'md.hits': 'światło zapala się na każde uderzenie i gaśnie — idealnie w bit',
    'md.auto': 'sam dobiera styl: cicho = płynnie, głośno = szybko, drop = uderzenia', 'ap.now': 'teraz: {m}',
    'ap.white': 'Tylko białe światło', 'ap.lasers': 'Lasery na szybkie fragmenty', 'ap.lasersS': 'pulsują w bit, gdy muzyka jest szybka (od 135 BPM) albo na dropie — tylko gdy lasery są uzbrojone',
    'as.white': 'Tylko białe światło', 'as.lasers': 'Lasery w bit na szybkich fragmentach', 'as.flashAll': 'Błysk na każde uderzenie (cały utwór)',
    'pp.neon': 'Neon', 'pp.warm': 'Ciepłe', 'pp.cold': 'Zimne', 'pp.rainbow': 'Tęcza', 'pp.club': 'Klub', 'pp.white': 'Biel',
    'mu.tgt': 'Efekty na', 'mu.tgtAll': 'wszystkie lampy', 'mu.tgtSel': 'zaznaczone',
    'mu.fadein': 'Wejście', 'mu.fadeout': 'Wyjście', 'mu.ease': 'Krzywa', 'mu.floor': 'Jasność między kickami', 'mu.decay': 'Zanik',
    'ease.linear': 'równo', 'ease.smooth': 'łagodnie', 'ease.in': 'powoli → szybko', 'ease.out': 'szybko → powoli',
    'mu.short': 'krótki', 'mu.long': 'długi', 'mu.selLamps': 'zaznaczone ({n})', 'mu.sync': 'Sync światła', 'mu.syncT': 'Przesuwa światło względem dźwięku (ms). Plus = światło wcześniej.',
    'mu.kicksCue': 'Kicki ({n})',
    'mu.play': 'Odtwórz', 'mu.pause': 'Pauza', 'mu.nSel': '{n} klatek', 'mu.spread': 'Rozłożenie na lampy', 'mu.order': 'Kolejność',
    'or.left': 'od lewej', 'or.right': 'od prawej', 'or.center': 'od środka', 'or.random': 'losowo',
    'mu.redo': 'Ponów', 'mu.selAll': 'Zaznacz wszystko', 'mu.copied': 'Skopiowano: {n}', 'mu.pasted': 'Wklejono: {n}',
    'mu.help2': 'Wybierz efekt i kliknij na osi. Przeciągnij puste miejsce = zaznacz kilka · Shift / Ctrl + klik = dodaj do zaznaczenia · Alt + przeciągnij = kopia · Ctrl+C / X / V / D / A · Ctrl+Z / Ctrl+Y · strzałki = przesuń o bit · K = wstaw w trakcie grania.',
    'as.title': 'Auto-show', 'as.style': 'Styl', 'as.colors': 'Kolory (kliknij, żeby wyłączyć)', 'as.move': 'Ruch', 'as.color': 'Kolor', 'as.dim': 'Jasność',
    'as.opts': 'Dodatki', 'as.kicks': 'Błysk na każdym kicku', 'as.drops': 'Strobo na dropach', 'as.gobo': 'Gobo na dropach',
    'as.energy': 'Energia', 'as.lamps': 'Lampy', 'as.go': 'Ułóż pokaz', 'as.cancel': 'Anuluj', 'as.keep': 'Zachowaj obecne klatki',
    'as.hint': 'Klatki zaczynają się dokładnie na bitach i kickach utworu, a tempo efektów idzie za BPM.',
  },
  it: {
    'mu.cat.move': 'Movimento', 'mu.cat.color': 'Colore', 'mu.cat.dim': 'Luminosità', 'mu.cat.beam': 'Gobo', 'mu.cat.preset': 'Miei effetti',
    'mu.newfx': '+ Effetto personale', 'mu.magnet': 'Magnete', 'mu.kickfill': 'Su ogni kick', 'mu.tap': 'Inserisci (K)',
    'mu.undo': 'Annulla', 'mu.zoomin': 'Ingrandisci', 'mu.zoomout': 'Riduci', 'mu.fit': 'Tutto il brano',
    'mu.track': 'Brano', 'mu.kicks': 'kick', 'mu.empty': 'Carica un brano (MP3 / WAV / FLAC) — beat e kick appaiono da soli',
    'mu.help': 'Scegli un effetto sopra e clicca sulla timeline — il keyframe si aggancia al kick ( ▼ ) o al beat più vicino. Trascina per spostare, bordo destro = durata. K = inserisci durante la riproduzione · Ctrl+Z annulla · Ctrl+C / Ctrl+V · Canc elimina · Spazio play/pausa · Alt = senza magnete.',
    'mu.len': 'Durata', 'mu.rhythm': 'Ritmo', 'mu.rfree': 'libero', 'mu.speed2': 'Velocità', 'mu.size2': 'Ampiezza',
    'mu.col1': 'Colore', 'mu.col2': 'Colore 2', 'mu.lamps': 'Luci', 'mu.all': 'tutte', 'mu.dup': '⧉ Duplica', 'mu.delcue': 'Elimina keyframe',
    'mu.pan': 'Orizzontale', 'mu.tilt': 'Verticale', 'mu.here': 'Dalla posizione attuale', 'mu.gobo': 'Gobo',
    'mu.beats': '{n} beat', 'mu.cycle': '1 ciclo = {n} beat',
    'mu.snapKick': 'KICK', 'mu.snapBeat': 'BEAT', 'mu.snapBar': 'BATTUTA',
    'mu.kickfillDone': 'Aggiunti {n} keyframe sui kick', 'mu.kickfillNone': 'Nessun kick nella parte visibile',
    'mu.pickTool': 'Prima scegli un effetto dalla lista', 'mu.noSong': 'Prima carica un brano',
    'cr.title': 'Crea effetto', 'cr.name': 'Nome dell’effetto', 'cr.move': 'Movimento', 'cr.color': 'Colore', 'cr.dim': 'Luminosità', 'cr.beam': 'Gobo',
    'cr.none': '— nessuno —', 'cr.draw': 'Disegna il movimento', 'cr.seq': 'Sequenza di colori', 'cr.pattern': 'Schema di 16 passi',
    'cr.drawHint': 'Disegna una forma con il mouse (o il dito) — la luce la seguirà.',
    'cr.fade': 'transizioni morbide', 'cr.addColor': '+ colore', 'cr.cycle': 'Un ciclo dura',
    'cr.preview': '▶ Anteprima sulle luci', 'cr.stopPreview': '■ Ferma anteprima', 'cr.save': 'Salva effetto', 'cr.cancel': 'Annulla',
    'cr.saved': 'Effetto „{n}” salvato', 'cr.needName': 'Scrivi il nome dell’effetto', 'cr.needLayer': 'Scegli almeno un livello',
    'cr.delete': 'Eliminare l’effetto „{n}”?', 'cr.deleted': 'Effetto „{n}” eliminato', 'cr.edit': 'Modifica',
    'cr.p.four': 'Su ogni beat', 'cr.p.off': 'Tra i beat', 'cr.p.gallop': 'Galoppo', 'cr.p.build': 'Crescendo', 'cr.p.clear': 'Svuota',
    'ap.title': 'Autopilota e stile', 'ap.hint': 'L’autopilota cambia da solo movimento, colori e luminosità a ritmo di musica (dal vivo dal mixer o dal brano nella timeline). Stile e palette valgono anche per Auto-show.',
    'ap.on': 'Autopilota: ACCESO', 'ap.off': 'Accendi l’autopilota', 'ap.style': 'Stile', 'ap.pal': 'Colori dello show',
    'ap.addc': '+ colore', 'ap.spot': 'A volte occhio di bue sulla persona (nei momenti più calmi)', 'ap.nomusic': 'Aspetto la musica — accendi l’ingresso dal vivo o riproduci un brano',
    'ap.bpm': 'Suona a {b} BPM',
    'md.calm': 'movimenti lenti, colori morbidi, luminosità che respira', 'md.dynamic': 'movimento a ogni battuta, cambi colore, strobo sul drop',
    'md.dance': 'flash su ogni beat, rimbalzi, colore a ogni beat', 'md.rave': 'movimenti veloci casuali, inseguimento colori, strobo forte',
    'md.hits': 'la luce si accende a ogni colpo e si spegne — perfettamente a tempo',
    'md.auto': 'sceglie da solo: piano = morbido, forte = veloce, drop = colpi', 'ap.now': 'ora: {m}',
    'ap.white': 'Solo luce bianca', 'ap.lasers': 'Laser nelle parti veloci', 'ap.lasersS': 'pulsano a tempo quando la musica è veloce (da 135 BPM) o sul drop — solo con i laser armati',
    'as.white': 'Solo luce bianca', 'as.lasers': 'Laser a tempo nelle parti veloci', 'as.flashAll': 'Flash su ogni colpo (tutto il brano)',
    'pp.neon': 'Neon', 'pp.warm': 'Caldi', 'pp.cold': 'Freddi', 'pp.rainbow': 'Arcobaleno', 'pp.club': 'Club', 'pp.white': 'Bianco',
    'mu.tgt': 'Effetti su', 'mu.tgtAll': 'tutte le luci', 'mu.tgtSel': 'selezionate',
    'mu.fadein': 'Entrata', 'mu.fadeout': 'Uscita', 'mu.ease': 'Curva', 'mu.floor': 'Luminosità tra i kick', 'mu.decay': 'Decadimento',
    'ease.linear': 'uniforme', 'ease.smooth': 'morbida', 'ease.in': 'lenta → veloce', 'ease.out': 'veloce → lenta',
    'mu.short': 'corto', 'mu.long': 'lungo', 'mu.selLamps': 'selezionate ({n})', 'mu.sync': 'Sync luce', 'mu.syncT': 'Sposta la luce rispetto al suono (ms). Più = luce prima.',
    'mu.kicksCue': 'Kick ({n})',
    'mu.play': 'Riproduci', 'mu.pause': 'Pausa', 'mu.nSel': '{n} keyframe', 'mu.spread': 'Distribuzione sulle luci', 'mu.order': 'Ordine',
    'or.left': 'da sinistra', 'or.right': 'da destra', 'or.center': 'dal centro', 'or.random': 'casuale',
    'mu.redo': 'Ripeti', 'mu.selAll': 'Seleziona tutto', 'mu.copied': 'Copiati: {n}', 'mu.pasted': 'Incollati: {n}',
    'mu.help2': 'Scegli un effetto e clicca sulla timeline. Trascina lo spazio vuoto = seleziona più keyframe · Shift / Ctrl + clic = aggiungi · Alt + trascina = copia · Ctrl+C / X / V / D / A · Ctrl+Z / Ctrl+Y · frecce = sposta di un beat · K = inserisci durante la riproduzione.',
    'as.title': 'Auto-show', 'as.style': 'Stile', 'as.colors': 'Colori (clicca per escluderli)', 'as.move': 'Movimento', 'as.color': 'Colore', 'as.dim': 'Luminosità',
    'as.opts': 'Extra', 'as.kicks': 'Flash su ogni kick', 'as.drops': 'Strobo sui drop', 'as.gobo': 'Gobo sui drop',
    'as.energy': 'Energia', 'as.lamps': 'Luci', 'as.go': 'Crea lo show', 'as.cancel': 'Annulla', 'as.keep': 'Mantieni i keyframe attuali',
    'as.hint': 'I keyframe iniziano esattamente su beat e kick del brano e il tempo degli effetti segue i BPM.',
  },
});

/* ============================================================ effect catalogue */
const FX = {
  move: { color: '#2b8cff', kinds: { circle: ['Koło', 'Cerchio'], figure8: ['Ósemka', 'Otto'], sweep: ['Wahadło', 'Pendolo'],
    tilt_wave: ['Fala', 'Onda'], square: ['Kwadrat', 'Quadrato'], triangle: ['Trójkąt', 'Triangolo'], spiral: ['Spirala', 'Spirale'],
    bounce: ['Odbicia', 'Rimbalzo'], fan: ['Wachlarz', 'Ventaglio'], random: ['Losowo', 'Casuale'], position: ['Pozycja', 'Posizione'] } },
  color: { color: '#a855f7', kinds: { rainbow: ['Tęcza', 'Arcobaleno'], chase: ['Pościg kolorów', 'Inseguimento'],
    two_color: ['Dwa kolory', 'Due colori'], gradient: ['Przejście', 'Sfumatura'], fire: ['Ogień', 'Fuoco'], ocean: ['Ocean', 'Oceano'],
    static_color: ['Kolor stały', 'Colore fisso'] } },
  dim: { color: '#f59e0b', kinds: { flash: ['Flash', 'Flash'], pulse: ['Puls', 'Pulsazione'], breathe: ['Oddech', 'Respiro'],
    blink: ['Miganie', 'Lampeggio'], heartbeat: ['Serce', 'Battito'], sparkle: ['Iskry', 'Scintille'], saw: ['Narastanie', 'Rampa'],
    strobe: ['Strobe', 'Strobo'], fade_in: ['Rozjaśnij', 'Dissolvi in'], fade_out: ['Wygaś', 'Dissolvi out'], dark: ['Ciemność', 'Buio'],
    hit: ['Uderzenie', 'Colpo'], wave: ['Fala przez lampy', 'Onda sulle luci'], beat: ['Błysk w bit', 'Flash a tempo'] } },
  beam: { color: '#0891b2', kinds: { gobo: ['Gobo', 'Gobo'], gobo_shake: ['Drżenie gobo', 'Gobo vibra'], gobo_spin: ['Obrót gobo', 'Gobo ruota'],
    laser_hit: ['Laser w bit', 'Laser a tempo'], laser_on: ['Laser włączony', 'Laser acceso'], spot: ['Reflektor na osobę', 'Occhio di bue'] } },
  preset: { color: '#db2777', kinds: {} },                       // user effects, loaded from /api/presets
};
const HIDDEN = { path: ['Własny ruch', 'Movimento personale'], sequence: ['Sekwencja', 'Sequenza'], pattern: ['Wzór', 'Schema'],
  kicks: ['Kicki', 'Kick'] };
const FX_CAT = { path: 'move', sequence: 'color', pattern: 'dim', kicks: 'dim' };
for (const [cat, c] of Object.entries(FX)) for (const k of Object.keys(c.kinds)) FX_CAT[k] = cat;
const catOf = (k) => (k.startsWith('preset:') ? 'preset' : FX_CAT[k] || 'dim');
const fxName = (k) => {
  if (k.startsWith('preset:')) return k.slice(7);
  const e = (FX[FX_CAT[k]] && FX[FX_CAT[k]].kinds[k]) || HIDDEN[k];
  return e ? e[LANG === 'it' ? 1 : 0] : k;
};
const catName = (c) => t(`mu.cat.${c}`);
const ONE_SHOT = { flash: 1.0, fade_in: 2.5, fade_out: 2.5, hit: 0.5 };
// natural cycle length in beats (used when the BPM is known: effects follow the music)
const DEF_BEATS = { circle: 8, figure8: 8, sweep: 8, tilt_wave: 4, square: 8, triangle: 6, spiral: 16, bounce: 4, fan: 8,
  random: 2, path: 8, rainbow: 16, chase: 1, two_color: 2, gradient: 8, ocean: 16, sequence: 1, pulse: 1, breathe: 4, blink: 1,
  heartbeat: 2, sparkle: 0.25, saw: 1, pattern: 4, wave: 2, beat: 1, laser_hit: 1 };
const DEF_PARAMS = { circle: { speed: 0.35, size: 35 }, figure8: { speed: 0.3, size: 35 }, sweep: { speed: 0.25, size: 70 },
  tilt_wave: { speed: 0.4, size: 30 }, square: { speed: 0.25, size: 35 }, triangle: { speed: 0.3, size: 35 }, spiral: { speed: 0.4, size: 40 },
  bounce: { speed: 0.5, size: 35 }, fan: { speed: 0.2, size: 60 }, random: { speed: 1, size: 45 }, position: { pan: 0.5, tilt: 0.5 },
  rainbow: { speed: 0.15 }, chase: { speed: 2 }, two_color: { speed: 1, color_a: [255, 0, 60], color_b: [0, 120, 255] },
  gradient: { speed: 0.25, color_a: [255, 0, 90], color_b: [0, 170, 255] }, fire: { speed: 1 }, ocean: { speed: 0.2 },
  static_color: { color_a: [0, 140, 255] }, pulse: { speed: 1 }, breathe: { speed: 0.25 }, blink: { speed: 2 }, heartbeat: { speed: 1 },
  sparkle: { speed: 8 }, saw: { speed: 1 }, flash: {}, strobe: { speed: 210 }, fade_in: {}, fade_out: {}, dark: {},
  gobo: { value: 12 }, gobo_shake: { value: 96 }, gobo_spin: { value: 192 }, hit: { strength: 1, curve: 2 }, wave: { speed: 1, width: 0.35 },
  beat: { floor: 0, curve: 2.4 }, laser_hit: { duty: 0.4 }, laser_on: {}, spot: {} };
const NO_FADE = new Set(['flash', 'hit', 'kicks', 'strobe', 'fade_in', 'fade_out', 'dark', 'beat', 'laser_hit', 'laser_on', 'spot']);
const LANES = ['move', 'color', 'dim', 'beam', 'preset'];
function fxCatalogue() {        // for other modules (custom gesture → effect)
  const out = [];
  for (const [cat, c] of Object.entries(FX)) for (const k of Object.keys(c.kinds)) out.push([cat === 'preset' ? `preset:${k}` : k, fxName(cat === 'preset' ? `preset:${k}` : k)]);
  return out;
}
PH.fxCatalogue = fxCatalogue;
const curBpm = () => (MU.running && MU.bpm ? MU.bpm : TL.bpm) || null;

/* ============================================================ 1. LIVE INPUT + BEAT DETECTION */
const MU = {
  ctx: null, stream: null, an: null, buf: null, running: false,
  hist: [], lastBeat: 0, beatTimes: [], bpm: null, level: 0, fastE: 0, slowE: 0, lastDrop: 0, flash: 0,
};
async function muDevices() {
  const sel = $('#mu-dev');
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const cur = sel.value;
    sel.innerHTML = devs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `Wejście audio ${i + 1}`)}</option>`).join('')
      || '<option value="">brak wejść audio</option>';
    if (cur) sel.value = cur;
  } catch (e) { sel.innerHTML = '<option value="">brak dostępu do audio</option>'; }
}
async function muStart() {
  if (MU.running) { muStop(); return; }
  try {
    const id = $('#mu-dev').value;
    MU.stream = await navigator.mediaDevices.getUserMedia({ audio: {
      deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0 } });
    MU.ctx = new AudioContext({ latencyHint: 'interactive' });
    const src = MU.ctx.createMediaStreamSource(MU.stream);
    MU.an = MU.ctx.createAnalyser(); MU.an.fftSize = 1024; MU.an.smoothingTimeConstant = 0.05;
    src.connect(MU.an);
    MU.buf = new Uint8Array(MU.an.frequencyBinCount);
    MU.running = true; MU.hist = []; MU.beatTimes = [];
    $('#mu-start').textContent = 'Stop'; $('#mu-start').classList.add('on');
    muDevices();
  } catch (e) {
    toast('Nie mogę otworzyć wejścia audio: ' + e.message, 'err');
  }
}
function muStop() {
  MU.running = false;
  if (MU.stream) MU.stream.getTracks().forEach((tr) => tr.stop());
  if (MU.ctx) MU.ctx.close();
  MU.ctx = MU.stream = MU.an = null;
  $('#mu-start').textContent = 'Start'; $('#mu-start').classList.remove('on');
}
function muTick(now) {
  if (!MU.running || !MU.an) return;
  MU.an.getByteFrequencyData(MU.buf);
  const binHz = MU.ctx.sampleRate / MU.an.fftSize;
  const lo = Math.max(1, Math.round(40 / binHz)), hi = Math.max(lo + 1, Math.round(160 / binHz));
  let e = 0; for (let i = lo; i <= hi; i++) e += (MU.buf[i] / 255) ** 2;
  e /= (hi - lo + 1);
  let lvl = 0; for (let i = 0; i < MU.buf.length; i++) lvl += MU.buf[i];
  MU.level = lvl / MU.buf.length / 255;
  MU.hist.push(e); if (MU.hist.length > 70) MU.hist.shift();
  const avg = MU.hist.reduce((a, b) => a + b, 0) / MU.hist.length;
  MU.fastE = MU.fastE * 0.9 + e * 0.1; MU.slowE = MU.slowE * 0.997 + e * 0.003;
  const sens = Number($('#mu-sens').value);
  if (e > avg * sens && e > 0.015 && now - MU.lastBeat > 280) {
    MU.lastBeat = now; MU.flash = 1;
    MU.beatTimes.push(now); if (MU.beatTimes.length > 17) MU.beatTimes.shift();
    if (MU.beatTimes.length > 4) {
      const iv = MU.beatTimes.slice(1).map((v, i) => v - MU.beatTimes[i]).sort((a, b) => a - b);
      let bpm = 60000 / iv[Math.floor(iv.length / 2)];
      while (bpm < 75) bpm *= 2; while (bpm > 185) bpm /= 2;
      MU.bpm = MU.bpm ? MU.bpm * 0.8 + bpm * 0.2 : bpm;
    }
    const drop = MU.fastE > MU.slowE * 1.9 && MU.slowE > 0.01 && now - MU.lastDrop > 8000;
    if (drop) MU.lastDrop = now;
    send({ type: 'beat', strength: clamp(e / Math.max(1e-4, avg) - 1, 0, 1), drop, bpm: MU.bpm ? Math.round(MU.bpm) : null });
  }
  MU.flash *= 0.88;
}
function muDraw() {
  const cv = $('#mu-spec'); if (!cv) return;
  const [W, H, d] = fitCanvas(cv), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f7f7fa'; ctx.fillRect(0, 0, W, H);
  if (MU.running && MU.buf) {
    const bars = 48, n = MU.buf.length;
    for (let b = 0; b < bars; b++) {
      const i0 = Math.floor(Math.pow(n, b / bars)), i1 = Math.max(i0 + 1, Math.floor(Math.pow(n, (b + 1) / bars)));
      let v = 0; for (let i = i0; i < i1 && i < n; i++) v = Math.max(v, MU.buf[i]);
      const h = (v / 255) * (H - 6 * d), x = (b / bars) * W;
      const g = ctx.createLinearGradient(0, H, 0, H - h);
      g.addColorStop(0, '#c9b5fb'); g.addColorStop(1, b < 6 ? '#7b3ff2' : '#14a9bd');
      ctx.fillStyle = g; ctx.fillRect(x + 1 * d, H - h, W / bars - 2 * d, h);
    }
  } else {
    ctx.fillStyle = '#858996'; ctx.font = `${12 * d}px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(tr('Wybierz wejście (kabel z miksera) i kliknij Start'), W / 2, H / 2 + 4 * d);
  }
  const led = $('#mu-led');
  led.style.background = `rgba(43,140,255,${0.15 + 0.85 * MU.flash})`;
  led.style.boxShadow = MU.flash > 0.3 ? `0 0 ${18 * MU.flash}px rgba(43,140,255,.9)` : 'none';
  const bpm = curBpm();
  setText($('#mu-bpm'), bpm ? `${Math.round(bpm)} BPM` : '— BPM');
  $('#mu-lvl').style.width = `${Math.round(Math.min(1, MU.level * 2.2) * 100)}%`;
}

/* ============================================================ 2. EFFECT PAD + REACTIONS */
const PAD = { speed: 1, size: 1, sig: '', target: 'all', spread: 0.25, order: 'left' };
function buildPad() {
  const box = $('#fx-pad'); box.innerHTML = '';
  for (const [cat, c] of Object.entries(FX)) {
    const col = document.createElement('div'); col.className = 'pad-col';
    col.innerHTML = `<div class="pad-t" style="--c:${c.color}">${esc(catName(cat))}</div>`;
    for (const k of Object.keys(c.kinds)) {
      const kind = cat === 'preset' ? `preset:${k}` : k;
      const b = document.createElement('button');
      b.className = 'fx-btn'; b.dataset.kind = kind; b.style.setProperty('--c', c.color);
      b.textContent = fxName(kind);
      b.onclick = () => padToggle(kind);
      if (cat === 'preset') {
        const wrap = document.createElement('div'); wrap.className = 'fx-own';
        const ed = document.createElement('button'); ed.className = 'icon'; ed.textContent = '✏️'; ed.title = t('cr.edit');
        ed.onclick = () => crOpen(k);
        const del = document.createElement('button'); del.className = 'icon'; del.textContent = '✕';
        del.onclick = () => crDelete(k);
        wrap.append(b, ed, del); col.appendChild(wrap);
      } else col.appendChild(b);
    }
    if (cat === 'preset') {
      const add = document.createElement('button'); add.className = 'fx-btn add'; add.style.setProperty('--c', c.color);
      add.textContent = t('mu.newfx'); add.onclick = () => crOpen(null);
      col.appendChild(add);
    }
    box.appendChild(col);
  }
}
function padParams(kind) {
  const p = { ...(DEF_PARAMS[kind] || {}) };
  if ('speed' in p && kind !== 'strobe') p.speed *= PAD.speed;
  if ('size' in p) p.size *= PAD.size;
  if (DEF_BEATS[kind]) p.beats = DEF_BEATS[kind] / PAD.speed;       // follows the music when a BPM is known
  if (kind === 'position') { const f = PH.activeFx(); if (f) { p.pan = f.values.pan / 65535; p.tilt = f.values.tilt / 65535; } }
  p.spread = PAD.spread; p.order = PAD.order;
  return p;
}
function padToggle(kind) {
  const id = 'pad-' + kind;
  const on = S.st && S.st.effects.active.some((a) => a.id === id);
  if (on) send({ type: 'fx_stop', id });
  else send({ type: 'fx_start', kind, id, params: kind.startsWith('preset:') ? {} : padParams(kind), targets: PAD.target, duration: ONE_SHOT[kind] || null });
}
function updatePad(st) {
  const sig = `${Object.keys(FX.preset.kinds).join('|')}|${LANG}`;
  if (sig !== PAD.sig) { PAD.sig = sig; buildPad(); buildTools(); tlProps(); tlDraw && tlDraw(); }
  const active = new Set(st.effects.active.map((a) => a.id));
  for (const b of $$('#fx-pad .fx-btn')) b.classList.toggle('on', active.has('pad-' + b.dataset.kind));
  const r = st.effects.reactions;
  for (const b of $$('#mu-react button')) b.classList.toggle('on', !!r[b.dataset.r]);
}
async function loadPresets() {
  try {
    const list = await (await fetch('/api/presets')).json();
    FX.preset.kinds = {};
    for (const [name, p] of Object.entries(list)) FX.preset.kinds[name] = [name, name, p];
  } catch (e) { /* offline */ }
}

/* ============================================================ 3. TIMELINE */
const TL = {
  audio: new Audio(), file: null, audioName: null, duration: 0, peaks: null, beats: [], kicks: [], energy: [], bpm: null,
  cues: [], sel: null, pps: 60, scroll: 0, tool: null, on: new Set(), lastT: 0, nextId: 1,
  drag: null, hover: null, magnet: true, hist: [], redo: [], clip: null, selSet: new Set(), marquee: null, sync: Number(localStorage.getItem('ph_sync') || 40),
  LABEL: 112, RULER: 28, WAVE: 84, LANE: 44,
};
TL.audio.preload = 'auto';

async function tlLoadFile(file) {
  TL.file = file; TL.audioName = file.name;
  const buf = await file.arrayBuffer();
  await tlDecode(buf);
  TL.audio.src = URL.createObjectURL(file);
  TL.cues = []; TL.sel = null; TL.hist = [];
  $('#tl-name').value = file.name.replace(/\.[^.]+$/, '');
  toast(`Wczytano: ${file.name} · ${Math.round(TL.bpm || 0)} BPM · ${TL.beats.length} bitów`);
}
async function tlDecode(arrayBuffer) {
  setText($('#tl-info'), 'analizuję utwór…');
  const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
  const ab = await ac.decodeAudioData(arrayBuffer.slice(0));
  TL.duration = ab.duration;
  const sr = ab.sampleRate, n = ab.length, ch = ab.numberOfChannels;
  const mono = new Float32Array(n);
  for (let c = 0; c < ch; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
  // waveform peaks (1 value per 256 samples)
  const P = 256, np = Math.ceil(n / P);
  TL.peaks = new Float32Array(np);
  for (let i = 0; i < np; i++) { let m = 0; for (let j = i * P; j < Math.min(n, (i + 1) * P); j++) m = Math.max(m, Math.abs(mono[j])); TL.peaks[i] = m; }
  TL.peakRate = sr / P;
  // low-band (kick) energy envelope, hop 256 (≈6 ms) for tight kick timing
  const hop = 256, nf = Math.floor(n / hop), a = 1 - Math.exp(-2 * Math.PI * 150 / sr);
  const env = new Float32Array(nf); let y = 0;
  for (let f = 0; f < nf; f++) {
    let e = 0;
    for (let j = f * hop; j < (f + 1) * hop; j++) { y += a * (mono[j] - y); e += y * y; }
    env[f] = Math.sqrt(e / hop);
  }
  const onset = new Float32Array(nf);
  for (let f = 2; f < nf; f++) onset[f] = Math.max(0, env[f] - env[f - 2]);
  const fps = sr / hop;
  // tempo: autocorrelation of the onset curve between 70 and 180 BPM
  let best = 0, bestLag = Math.round(fps * 0.5);
  for (let lag = Math.round(fps * 60 / 180); lag <= Math.round(fps * 60 / 70); lag++) {
    let s = 0; for (let f = lag; f < nf; f += 2) s += onset[f] * onset[f - lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  // refine the lag with a parabola through the neighbours (sub-frame BPM precision)
  const ac3 = (lag) => { let s = 0; for (let f = lag; f < nf; f += 2) s += onset[f] * onset[f - lag]; return s; };
  const l0 = ac3(bestLag - 1), l1 = best, l2 = ac3(bestLag + 1), den = l0 - 2 * l1 + l2;
  const lagF = bestLag + (den < 0 ? 0.5 * (l0 - l2) / den : 0);
  const period = lagF / fps;
  TL.bpm = 60 / period;
  // beat phase: offset with the strongest onsets on the grid
  let bestOff = 0, bestSum = -1;
  for (let o = 0; o < bestLag; o++) {
    let s = 0; for (let k = 0; ; k++) { const f = Math.round(o + k * lagF); if (f >= nf) break; s += onset[f]; }
    if (s > bestSum) { bestSum = s; bestOff = o; }
  }
  TL.beats = [];
  for (let tt = bestOff / fps; tt < TL.duration; tt += period) TL.beats.push(tt);
  // single kicks: local peaks of the bass onset above an adaptive threshold
  const pre = new Float64Array(nf + 1); for (let f = 0; f < nf; f++) pre[f + 1] = pre[f] + onset[f];
  let gmax = 0; for (let f = 0; f < nf; f++) gmax = Math.max(gmax, onset[f]);
  const win = Math.round(fps * 0.45), gap = Math.round(fps * 0.11);
  const kicks = []; let last = -1e9;
  for (let f = 3; f < nf - 3; f++) {
    const o = onset[f];
    if (o < onset[f - 1] || o < onset[f + 1] || o < onset[f - 2] || o < onset[f + 2]) continue;
    const a0 = Math.max(0, f - win), a1 = Math.min(nf, f + win), mean = (pre[a1] - pre[a0]) / (a1 - a0);
    if (o > mean * 2.4 && o > gmax * 0.06) {
      if (f - last < gap) { if (kicks.length && o > kicks[kicks.length - 1].s) { kicks[kicks.length - 1] = { t: f / fps, s: o }; last = f; } continue; }
      kicks.push({ t: f / fps, s: o }); last = f;
    }
  }
  const kmax = Math.max(1e-9, ...kicks.map((k) => k.s));
  TL.kicks = kicks.map((k) => ({ t: Math.max(0, k.t - 0.004), s: k.s / kmax }));
  // align the beat grid with the kicks (median phase error of kicks that sit on the grid)
  const offs = [];
  for (const k of TL.kicks) {
    const b = TL.beats[0] + Math.round((k.t - TL.beats[0]) / period) * period;
    if (Math.abs(k.t - b) < 0.06) offs.push(k.t - b);
  }
  if (offs.length > 8) {
    offs.sort((x, y) => x - y);
    const sh = offs[offs.length >> 1];
    TL.beats = TL.beats.map((b) => b + sh).filter((b) => b >= 0 && b < TL.duration);
  }
  // every beat that has a kick within 45 ms moves onto that kick (tempo drift, live drummers)
  if (TL.kicks.length) {
    let ki = 0;
    TL.beats = TL.beats.map((b) => {
      while (ki < TL.kicks.length - 1 && TL.kicks[ki + 1].t < b - 0.045) ki++;
      let best = null, bd = 0.045;
      for (let j = ki; j < TL.kicks.length && TL.kicks[j].t < b + 0.046; j++) {
        const dd = Math.abs(TL.kicks[j].t - b);
        if (dd < bd && TL.kicks[j].s > 0.3) { bd = dd; best = TL.kicks[j].t; }
      }
      return best ?? b;
    });
  }
  // loudness per beat (0..1) → used by auto-show and beat strength
  const rms = TL.beats.map((b, i) => {
    const f0 = Math.floor(b * fps), f1 = Math.floor((TL.beats[i + 1] || TL.duration) * fps);
    let s = 0, c = 0; for (let f = f0; f < f1 && f < nf; f++) { s += env[f]; c++; } return c ? s / c : 0;
  });
  const mx = Math.max(...rms, 1e-6);
  TL.energy = rms.map((v) => v / mx);
  tlFit();
  setText($('#tl-info'), `${fmtTime(TL.duration)} · ${Math.round(TL.bpm)} BPM · ${TL.beats.length} bitów`);
  send({ type: 'bpm', value: TL.bpm });
}
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtTimeMs = (s) => `${fmtTime(s)}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`;
const beatLen = () => (TL.bpm ? 60 / TL.bpm : 0.5);
const xOf = (tt) => TL.LABEL + (tt - TL.scroll) * TL.pps;
const tOf = (x) => TL.scroll + (x - TL.LABEL) / TL.pps;
const laneY = (cat) => TL.RULER + TL.WAVE + LANES.indexOf(cat) * TL.LANE;
const laneAt = (y) => { const i = Math.floor((y - TL.RULER - TL.WAVE) / TL.LANE); return i >= 0 && i < LANES.length ? LANES[i] : null; };
function tlFit() {
  const w = $('#tl-canvas').clientWidth - TL.LABEL - 10;
  TL.pps = Math.max(8, w / Math.max(10, TL.duration)); TL.scroll = 0;
}
function tlZoom(k, x) {
  const cvw = $('#tl-canvas').clientWidth, px = x ?? (TL.LABEL + (cvw - TL.LABEL) / 2), tAt = tOf(px);
  TL.pps = clamp(TL.pps * k, 8, 900);
  TL.scroll = clamp(tAt - (px - TL.LABEL) / TL.pps, 0, Math.max(0, TL.duration - 1));
}

/* ---------------------------------------------------------------- magnet: kicks › beats › half beats */
function magnet(tt, noSnap) {
  if (noSnap || !TL.magnet || !TL.beats.length) return { t: Math.max(0, Math.round(tt * 100) / 100), type: null };
  const R = 13 / TL.pps;                                   // 13 px catch radius at any zoom
  let bestK = null;
  for (const k of TL.kicks) { const d = Math.abs(k.t - tt); if (d < R && (!bestK || d < Math.abs(bestK.t - tt))) bestK = k; }
  if (bestK) return { t: bestK.t, type: 'kick' };
  let bi = 0, bd = 1e9;
  for (let i = 0; i < TL.beats.length; i++) { const d = Math.abs(TL.beats[i] - tt); if (d < bd) { bd = d; bi = i; } }
  if (bd < R) return { t: TL.beats[bi], type: bi % 4 === 0 ? 'bar' : 'beat' };
  const half = beatLen() / 2, hq = TL.beats[0] + Math.round((tt - TL.beats[0]) / half) * half;
  if (TL.pps * half > 18 && Math.abs(hq - tt) < R) return { t: hq, type: 'half' };
  return { t: Math.max(0, tt), type: null };
}
function snapLen(d, noSnap) {
  if (noSnap || !TL.magnet) return Math.max(0.05, d);
  const q = beatLen() / (TL.pps * beatLen() > 60 ? 4 : TL.pps * beatLen() > 25 ? 2 : 1);
  return Math.max(q, Math.round(d / q) * q);
}

/* ---------------------------------------------------------------- undo */
function snap() { TL.hist.push(JSON.stringify(TL.cues)); TL.redo = []; if (TL.hist.length > 120) TL.hist.shift(); }
function undo() {
  if (!TL.hist.length) return;
  tlStopCues();
  TL.redo.push(JSON.stringify(TL.cues));
  TL.cues = JSON.parse(TL.hist.pop()); select([]);
}
function redo() {
  if (!TL.redo.length) return;
  tlStopCues();
  TL.hist.push(JSON.stringify(TL.cues));
  TL.cues = JSON.parse(TL.redo.pop()); select([]);
}
const selCues = () => TL.cues.filter((c) => TL.selSet.has(c.id));
function select(ids, add = false) {
  if (!add) TL.selSet.clear();
  for (const id of ids) TL.selSet.add(id);
  TL.sel = ids.length ? ids[ids.length - 1] : (add ? TL.sel : null);
  if (TL.sel != null && !TL.selSet.has(TL.sel)) TL.sel = [...TL.selSet].pop() ?? null;
  tlProps();
}
function toggleCue(id) {
  if (TL.selSet.has(id)) TL.selSet.delete(id); else TL.selSet.add(id);
  TL.sel = TL.selSet.size ? [...TL.selSet].pop() : null;
  tlProps();
}
function tlCopy(cut = false) {
  const cs = selCues(); if (!cs.length) return;
  const t0 = Math.min(...cs.map((c) => c.t));
  TL.clip = JSON.stringify(cs.map((c) => ({ ...c, t: c.t - t0 })));
  toast(t('mu.copied', { n: cs.length }));
  if (cut) tlDelete();
}

/* ---------------------------------------------------------------- cues */
function newCue(kind, at, d) {
  const params = { ...(DEF_PARAMS[kind] || {}) };
  if (DEF_BEATS[kind]) params.beats = DEF_BEATS[kind];
  if (kind === 'position') { const f = PH.activeFx(); if (f) { params.pan = f.values.pan / 65535; params.tilt = f.values.tilt / 65535; } }
  const dur = d ?? (ONE_SHOT[kind] ? Math.min(ONE_SHOT[kind], beatLen() * 2) : beatLen() * (catOf(kind) === 'dim' ? 4 : 8));
  const c = { id: TL.nextId++, t: at, d: Math.max(0.05, dur), kind, params, targets: 'all' };
  TL.cues.push(c);
  return c;
}
function addAt(tt, kind, noSnap) {
  if (!kind) { toast(t('mu.pickTool'), 'warn'); return null; }
  snap();
  const m = magnet(tt, noSnap);
  const c = newCue(kind, m.t);
  select([c.id]);
  return c;
}
function tapInsert() {            // K while the song plays: keyframe at the playhead, snapped to the nearest kick / beat
  if (!TL.duration) { toast(t('mu.noSong'), 'warn'); return; }
  const kind = TL.tool || 'flash';
  const now = TL.audio.currentTime - 0.03;                 // human reaction: prefer the hit that just happened
  snap();
  const saved = TL.pps; TL.pps = Math.min(TL.pps, 13 / 0.12);  // catch radius ≈ 120 ms regardless of zoom
  const m = magnet(now); TL.pps = saved;
  const c = newCue(kind, m.t);
  if (!TL.audio.paused && c.t <= TL.audio.currentTime && c.t + c.d > TL.audio.currentTime) {
    TL.on.add(c.id); fireCue(c, TL.audio.currentTime);
  }
  select([c.id]);
}
function kickFill() {
  if (!TL.duration) { toast(t('mu.noSong'), 'warn'); return; }
  const w = $('#tl-canvas').clientWidth, t0 = Math.max(0, tOf(TL.LABEL)), t1 = Math.min(TL.duration, tOf(w));
  const ks = TL.kicks.filter((k) => k.t >= t0 && k.t <= t1 && k.s > 0.2);
  if (!ks.length) { toast(t('mu.kickfillNone'), 'warn'); return; }
  snap();
  const start = ks[0].t, end = Math.min(TL.duration, ks[ks.length - 1].t + beatLen());
  const c = newCue('kicks', start, end - start);
  c.params = { hits: ks.map((k) => [+(k.t - start).toFixed(4), +k.s.toFixed(3)]), floor: 0, curve: 2.2, max_len: Math.min(0.6, beatLen()) };
  select([c.id]);
  toast(t('mu.kickfillDone', { n: ks.length }));
}
function tlDelete() {
  const ids = new Set(selCues().map((c) => c.id)); if (!ids.size) return;
  snap();
  TL.cues = TL.cues.filter((c) => !ids.has(c.id));
  for (const id of ids) if (TL.on.has(id)) { send({ type: 'fx_stop', id: 'cue-' + id }); TL.on.delete(id); }
  select([]);
}
function tlDuplicate() {
  const cs = selCues(); if (!cs.length) return;
  snap();
  const t0 = Math.min(...cs.map((c) => c.t)), t1 = Math.max(...cs.map((c) => c.t + c.d));
  const shift = magnet(t0 + (t1 - t0), false).t - t0;
  const out = cs.map((c) => ({ ...JSON.parse(JSON.stringify(c)), id: TL.nextId++, t: c.t + shift }));
  TL.cues.push(...out); select(out.map((c) => c.id));
}
function tlPaste() {
  if (!TL.clip) return;
  snap();
  const base = magnet(TL.audio.currentTime || 0).t;
  const out = JSON.parse(TL.clip).map((c) => ({ ...c, id: TL.nextId++, t: base + c.t }));
  TL.cues.push(...out); select(out.map((c) => c.id));
  toast(t('mu.pasted', { n: out.length }));
}

/* ---------------------------------------------------------------- drawing */
function tlDraw() {
  const cv = $('#tl-canvas'); if (!cv) return;
  const want = TL.RULER + TL.WAVE + LANES.length * TL.LANE + 4;
  if (cv.style.height !== `${want}px`) cv.style.height = `${want}px`;
  const [W, H, d] = fitCanvas(cv), ctx = cv.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const w = W / d, h = H / d;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  LANES.forEach((cat, i) => {
    const y = laneY(cat);
    ctx.fillStyle = i % 2 ? '#fbfbfd' : '#ffffff'; ctx.fillRect(0, y, w, TL.LANE);
    ctx.fillStyle = '#f5f5f9'; ctx.fillRect(0, y, TL.LABEL, TL.LANE);
    ctx.fillStyle = '#ececf2'; ctx.fillRect(0, y + TL.LANE - 1, w, 1);
    ctx.fillStyle = FX[cat].color; roundRect(ctx, 12, y + TL.LANE / 2 - 5, 10, 10, 3); ctx.fill();
    ctx.fillStyle = '#16161d'; ctx.font = '650 13px Figtree, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(catName(cat), 30, y + TL.LANE / 2);
    if (TL.tool && catOf(TL.tool) === cat) { ctx.fillStyle = FX[cat].color + '18'; ctx.fillRect(4, y, w, TL.LANE); }
  });
  ctx.fillStyle = '#fafafc'; ctx.fillRect(0, 0, w, TL.RULER);
  ctx.fillStyle = '#e6e6ee'; ctx.fillRect(0, TL.RULER - 1, w, 1); ctx.fillRect(0, TL.RULER + TL.WAVE - 1, w, 1); ctx.fillRect(TL.LABEL - 1, 0, 1, h);
  ctx.fillStyle = '#f5f5f9'; ctx.fillRect(0, TL.RULER, TL.LABEL - 1, TL.WAVE - 1);
  ctx.fillStyle = '#16161d'; ctx.textBaseline = 'middle';
  if (TL.duration) {
    ctx.font = '650 13px Figtree, sans-serif'; ctx.fillText(t('mu.track'), 14, TL.RULER + TL.WAVE / 2 - 9);
    ctx.fillStyle = '#d9820a'; ctx.font = '600 11.5px Figtree, sans-serif'; ctx.fillText(`▼ ${t('mu.kicks')}`, 14, TL.RULER + TL.WAVE / 2 + 11);
  } else {
    ctx.fillStyle = '#858996'; ctx.textAlign = 'center'; ctx.font = '500 14px Figtree, sans-serif';
    ctx.fillText(t('mu.empty'), (w + TL.LABEL) / 2, TL.RULER + TL.WAVE / 2);
    return;
  }
  ctx.save(); ctx.beginPath(); ctx.rect(TL.LABEL, 0, w - TL.LABEL, h); ctx.clip();
  // beats + bars
  const bl = beatLen();
  TL.beats.forEach((b, i) => {
    const x = xOf(b); if (x < TL.LABEL - 2 || x > w + 2) return;
    const bar = i % 4 === 0;
    if (!bar && TL.pps * bl < 6) return;
    ctx.strokeStyle = bar ? 'rgba(123,63,242,.2)' : 'rgba(22,22,29,.05)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 0.5, TL.RULER - (bar ? 10 : 5)); ctx.lineTo(x + 0.5, h); ctx.stroke();
    if (bar && TL.pps * bl * 4 > 34) { ctx.fillStyle = '#858996'; ctx.font = '600 11px Figtree, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(i / 4 + 1), x + 4, 13); }
  });
  // waveform coloured by loudness
  const mid = TL.RULER + TL.WAVE / 2 - 6, amp = TL.WAVE / 2 - 12;
  for (let x = TL.LABEL; x < w; x++) {
    const t0 = tOf(x), t1 = tOf(x + 1);
    if (t0 > TL.duration) break;
    if (t1 < 0) continue;
    const i0 = Math.max(0, Math.floor(t0 * TL.peakRate)), i1 = Math.max(i0 + 1, Math.floor(t1 * TL.peakRate));
    let m = 0; for (let i = i0; i < i1 && i < TL.peaks.length; i++) m = Math.max(m, TL.peaks[i]);
    const bi = Math.min(TL.energy.length - 1, Math.max(0, Math.floor(t0 / bl)));
    const en = TL.energy[bi] || 0;
    ctx.fillStyle = `rgba(${Math.round(160 - 37 * en)},${Math.round(140 - 77 * en)},${Math.round(250 - 8 * en)},${0.45 + 0.5 * en})`;
    ctx.fillRect(x, mid - m * amp, 1, Math.max(1, 2 * m * amp));
  }
  // kicks: orange ticks under the waveform (height = strength)
  const ky = TL.RULER + TL.WAVE - 3;
  for (const k of TL.kicks) {
    const x = xOf(k.t); if (x < TL.LABEL - 4 || x > w + 4) continue;
    ctx.fillStyle = `rgba(232,144,12,${0.35 + 0.65 * k.s})`;
    ctx.beginPath(); ctx.moveTo(x - 4, ky - 10 * (0.4 + 0.6 * k.s)); ctx.lineTo(x + 4, ky - 10 * (0.4 + 0.6 * k.s)); ctx.lineTo(x, ky); ctx.fill();
  }
  // cues
  for (const c of TL.cues) {
    const cat = catOf(c.kind), y = laneY(cat) + 4, x0 = xOf(c.t), x1 = xOf(c.t + c.d);
    if (x1 < TL.LABEL || x0 > w) continue;
    const sel = TL.selSet.has(c.id), playing = TL.on.has(c.id);
    const col = cat === 'preset' ? ((FX.preset.kinds[c.kind.slice(7)] || [])[2] || {}).color || FX.preset.color : FX[cat].color;
    ctx.save(); ctx.shadowColor = 'rgba(22,22,29,.18)'; ctx.shadowBlur = sel ? 10 : 3; ctx.shadowOffsetY = 1;
    ctx.fillStyle = col + (sel || playing ? 'ff' : 'dd');
    roundRect(ctx, x0, y, Math.max(8, x1 - x0), TL.LANE - 8, 8); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; roundRect(ctx, x0, y, Math.max(8, x1 - x0), (TL.LANE - 8) / 2, 8); ctx.fill();
    if (sel) { ctx.strokeStyle = '#16161d'; ctx.lineWidth = 2; roundRect(ctx, x0 - 2, y - 2, Math.max(8, x1 - x0) + 4, TL.LANE - 4, 10); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; roundRect(ctx, x0 + 0.75, y + 0.75, Math.max(8, x1 - x0) - 1.5, TL.LANE - 9.5, 7.5); ctx.stroke(); }
    if (playing) { ctx.fillStyle = 'rgba(255,255,255,.55)'; roundRect(ctx, x0 + 4, y + TL.LANE - 14, Math.max(0, x1 - x0 - 8), 3, 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = '650 12.5px Figtree, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (x1 - x0 > 34) {
      const extra = c.params && c.params.beats && TL.pps * (x1 - x0) > 0 ? ` · ${+Number(c.params.beats).toFixed(2)}♩` : '';
      const nm = c.kind === 'kicks' ? t('mu.kicksCue', { n: (c.params.hits || []).length }) : fxName(c.kind);
      ctx.fillText(nm + (x1 - x0 > 120 ? extra : ''), Math.max(x0, TL.LABEL) + 9, y + (TL.LANE - 8) / 2);
    }
    if (x1 - x0 > 16) { ctx.fillStyle = 'rgba(255,255,255,.8)'; roundRect(ctx, x1 - 6, y + 10, 3, TL.LANE - 28, 1.5); ctx.fill(); }   // resize handle
    if (c.kind === 'kicks' && c.params.hits) {          // every kick = a bright tick fading to the right
      for (const [ht, hs] of c.params.hits) {
        const hx = xOf(c.t + ht); if (hx < TL.LABEL || hx > w) continue;
        const g = ctx.createLinearGradient(hx, 0, hx + Math.max(4, TL.pps * Math.min(0.6, beatLen()) * 0.9), 0);
        g.addColorStop(0, `rgba(255,255,255,${0.5 + 0.5 * hs})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(hx, y + 3, Math.max(4, TL.pps * Math.min(0.6, beatLen()) * 0.9), TL.LANE - 14);
      }
    }
    const fi = (c.params.fade_in || 0) * TL.pps, fo = (c.params.fade_out || 0) * TL.pps;
    if (fi > 3 || fo > 3) {                             // fade ramps drawn as white wedges
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      if (fi > 3) { ctx.beginPath(); ctx.moveTo(x0, y + TL.LANE - 8); ctx.lineTo(x0 + fi, y); ctx.lineTo(x0, y); ctx.fill(); }
      if (fo > 3) { ctx.beginPath(); ctx.moveTo(x1, y + TL.LANE - 8); ctx.lineTo(x1 - fo, y); ctx.lineTo(x1, y); ctx.fill(); }
    }
  }
  // magnet guide + ghost of the new keyframe
  const hv = TL.hover;
  if (hv && hv.m) {
    const x = xOf(hv.m.t);
    if (hv.m.type) {
      const cK = hv.m.type === 'kick' ? '#d9820a' : '#7b3ff2';
      ctx.strokeStyle = cK; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, TL.RULER); ctx.lineTo(x, h); ctx.stroke(); ctx.setLineDash([]);
      const lab = t(hv.m.type === 'kick' ? 'mu.snapKick' : hv.m.type === 'bar' ? 'mu.snapBar' : 'mu.snapBeat');
      ctx.font = '700 11px Figtree, sans-serif'; const tw = ctx.measureText(lab).width + 10;
      ctx.fillStyle = cK; roundRect(ctx, x + 3, TL.RULER + 3, tw, 17, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(lab, x + 8, TL.RULER + 11.5);
    }
    if (hv.ghost && TL.tool) {
      const cat = catOf(TL.tool), y = laneY(cat) + 4;
      const gd = ONE_SHOT[TL.tool] ? Math.min(ONE_SHOT[TL.tool], bl * 2) : bl * (cat === 'dim' ? 4 : 8);
      ctx.strokeStyle = (FX[cat] || FX.preset).color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      roundRect(ctx, x, y, Math.max(7, gd * TL.pps), TL.LANE - 8, 6); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // rubber-band selection
  if (TL.marquee) {
    const m = TL.marquee, rx = Math.min(m.x0, m.x1), ry = Math.min(m.y0, m.y1);
    ctx.fillStyle = 'rgba(123,63,242,.1)'; ctx.fillRect(rx, ry, Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
    ctx.strokeStyle = '#7b3ff2'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeRect(rx + 0.5, ry + 0.5, Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0)); ctx.setLineDash([]);
  }
  // playhead
  const px = xOf(TL.audio.currentTime || 0);
  ctx.strokeStyle = '#16161d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, TL.RULER); ctx.lineTo(px, h); ctx.stroke();
  const pt = fmtTime(TL.audio.currentTime || 0);
  ctx.font = '700 11.5px Figtree, sans-serif'; const pw = ctx.measureText(pt).width + 14;
  ctx.fillStyle = '#16161d'; roundRect(ctx, px - pw / 2, 3, pw, 20, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px - 5, 22); ctx.lineTo(px + 5, 22); ctx.lineTo(px, TL.RULER); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pt, px, 13.5); ctx.textAlign = 'left';
  ctx.restore();
  tlSyncScrub();
  setText($('#tl-time'), `${fmtTime(TL.audio.currentTime || 0)} / ${fmtTime(TL.duration)}`);
}
// bar under the timeline: scroll through the song and zoom with sliders (the mouse wheel works too)
const ZMIN = 8, ZMAX = 900;
function tlSyncScrub() {
  const sc = $('#tl-scroll'), zm = $('#tl-zoom'); if (!sc || !zm) return;
  const vis = ($('#tl-canvas').clientWidth - TL.LABEL) / TL.pps;
  sc.max = String(Math.max(0, TL.duration - vis)); sc.disabled = !TL.duration || TL.duration <= vis;
  if (document.activeElement !== sc) { sc.value = String(TL.scroll); sc.style.setProperty('--p', `${TL.duration > vis ? TL.scroll / (TL.duration - vis) * 100 : 0}%`); }
  if (document.activeElement !== zm) { const z = Math.log(TL.pps / ZMIN) / Math.log(ZMAX / ZMIN); zm.value = String(z); zm.style.setProperty('--p', `${z * 100}%`); }
}
function tlScrubBar() {
  if ($('#tl-scrub')) return;
  const bar = document.createElement('div'); bar.className = 'tl-scrub'; bar.id = 'tl-scrub';
  bar.innerHTML = `${ic('arrows')}<input type="range" id="tl-scroll" min="0" max="1" step="0.01" value="0" aria-label="scroll">
    <span class="zoom">${ic('minus')}<input type="range" id="tl-zoom" min="0" max="1" step="0.001" value="0.3" aria-label="zoom">${ic('plus')}</span>`;
  $('#tl-canvas').after(bar);
  $('#tl-scroll').oninput = (e) => { TL.scroll = Number(e.target.value); };
  $('#tl-zoom').oninput = (e) => {
    const cvw = $('#tl-canvas').clientWidth, px = TL.LABEL + (cvw - TL.LABEL) / 2, tAt = tOf(px);
    TL.pps = ZMIN * Math.pow(ZMAX / ZMIN, Number(e.target.value));
    TL.scroll = clamp(tAt - (px - TL.LABEL) / TL.pps, 0, Math.max(0, TL.duration - 1));
  };
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function cueAt(x, y) {
  for (const c of [...TL.cues].reverse()) {
    const ly = laneY(catOf(c.kind));
    if (y >= ly && y <= ly + TL.LANE && x >= xOf(c.t) - 3 && x <= xOf(c.t + c.d) + 3) return c;
  }
  return null;
}

/* ---------------------------------------------------------------- pointer */
function tlPointer() {
  const cv = $('#tl-canvas');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    if (!TL.duration || e.button === 2) return;
    const [x, y] = pos(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (y < TL.RULER + TL.WAVE && x > TL.LABEL) { tlSeek(tOf(x)); TL.drag = { mode: 'seek' }; return; }
    const c = cueAt(x, y);
    if (c) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleCue(c.id); return; }       // add / remove from the selection
      if (!TL.selSet.has(c.id)) select([c.id]); else { TL.sel = c.id; tlProps(); }
      snap();
      let grabbed = c;
      if (e.altKey) {                                                           // Alt + drag = drag copies
        const copies = selCues().map((q) => ({ ...JSON.parse(JSON.stringify(q)), id: TL.nextId++ }));
        TL.cues.push(...copies);
        const map = new Map(selCues().map((q, i) => [q.id, copies[i].id]));
        select(copies.map((q) => q.id));
        grabbed = TL.cues.find((q) => q.id === map.get(c.id));
      }
      const single = TL.selSet.size === 1;
      const edge = single && xOf(grabbed.t + grabbed.d) - x < 8 && xOf(grabbed.t + grabbed.d) - xOf(grabbed.t) > 14;
      TL.drag = { mode: edge ? 'resize' : 'move', c: grabbed, x0: x, t0: grabbed.t, d0: grabbed.d, moved: false, dup: e.altKey,
        starts: new Map(selCues().map((q) => [q.id, q.t])) };
      return;
    }
    if (x > TL.LABEL && laneAt(y)) {
      const tool = TL.tool;
      if (tool && !e.shiftKey && !e.ctrlKey) {
        const nc = addAt(tOf(x), tool, e.altKey);
        if (nc) TL.drag = { mode: 'resize', c: nc, x0: xOf(nc.t + nc.d), t0: nc.t, d0: nc.d, fresh: true };
      } else {                                                                  // empty space: rubber-band selection
        const add = e.shiftKey || e.ctrlKey || e.metaKey;
        TL.marquee = { x0: x, y0: y, x1: x, y1: y, base: add ? [...TL.selSet] : [] };
        if (!add) select([]);
      }
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const [x, y] = pos(e), dr = TL.drag;
    if (TL.marquee) {
      const m = TL.marquee; m.x1 = x; m.y1 = y;
      const t0 = tOf(Math.min(m.x0, x)), t1 = tOf(Math.max(m.x0, x)), y0 = Math.min(m.y0, y), y1 = Math.max(m.y0, y);
      const hit = TL.cues.filter((c) => { const ly = laneY(catOf(c.kind)); return c.t < t1 && c.t + c.d > t0 && ly + TL.LANE > y0 && ly < y1; }).map((c) => c.id);
      TL.selSet = new Set([...m.base, ...hit]); TL.sel = hit.length ? hit[hit.length - 1] : TL.sel;
      return;
    }
    if (!dr) {
      const over = TL.duration && x > TL.LABEL && laneAt(y) && !cueAt(x, y);
      TL.hover = over && TL.tool ? { m: magnet(tOf(x), e.altKey), ghost: true } : null;
      const cc = cueAt(x, y);
      cv.style.cursor = cc ? (TL.selSet.size <= 1 && xOf(cc.t + cc.d) - x < 8 ? 'ew-resize' : e.altKey ? 'copy' : 'grab') : TL.tool ? 'copy' : 'crosshair';
      return;
    }
    if (dr.mode === 'seek') { tlSeek(tOf(x)); return; }
    const dt = (x - dr.x0) / TL.pps;
    dr.moved = true;
    if (dr.mode === 'move') {
      const m = magnet(dr.t0 + dt, e.altKey && !dr.dup);
      let delta = m.t - dr.t0;
      const minStart = Math.min(...dr.starts.values());
      if (minStart + delta < 0) delta = -minStart;                              // the whole group stays inside the song
      for (const q of selCues()) if (dr.starts.has(q.id)) q.t = dr.starts.get(q.id) + delta;
      TL.hover = { m };
    } else {
      const end = magnet(dr.t0 + dr.d0 + dt, e.altKey);
      dr.c.d = Math.max(0.05, end.type ? end.t - dr.c.t : snapLen(dr.d0 + dt, e.altKey));
      TL.hover = { m: end };
    }
    tlProps();
  });
  const end = () => {
    if (TL.marquee) { TL.marquee = null; tlProps(); }
    if (TL.drag && !TL.drag.moved && !TL.drag.fresh && !TL.drag.dup && TL.drag.mode !== 'seek') TL.hist.pop();   // plain click: nothing changed
    TL.drag = null; TL.hover = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!TL.drag) TL.hover = null; });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); const [x, y] = pos(e); const c = cueAt(x, y); if (c) { if (!TL.selSet.has(c.id)) select([c.id]); tlDelete(); } });
  cv.addEventListener('dblclick', (e) => { const [x, y] = pos(e); const c = cueAt(x, y); if (c) { select([c.id]); tlDuplicate(); } });
  cv.addEventListener('wheel', (e) => {
    if (!TL.duration) return;
    e.preventDefault();
    const [x] = pos(e);
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      TL.scroll = clamp(TL.scroll + (e.deltaX || e.deltaY) / TL.pps, 0, TL.duration); return;
    }
    tlZoom(Math.pow(1.0015, -e.deltaY), x);
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (S.tab !== 'music' || (e.target.closest && e.target.closest('input, select, textarea, dialog'))) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if ((e.key === 'Delete' || e.key === 'Backspace') && TL.selSet.size) { tlDelete(); e.preventDefault(); }
    else if (e.key === ' ') { tlPlay(); e.preventDefault(); }
    else if (mod && k === 'z' && e.shiftKey) { redo(); e.preventDefault(); }
    else if (mod && k === 'z') { undo(); e.preventDefault(); }
    else if (mod && k === 'y') { redo(); e.preventDefault(); }
    else if (mod && k === 'c') { tlCopy(false); e.preventDefault(); }
    else if (mod && k === 'x') { tlCopy(true); e.preventDefault(); }
    else if (mod && k === 'v') { tlPaste(); e.preventDefault(); }
    else if (mod && k === 'd') { tlDuplicate(); e.preventDefault(); }
    else if (mod && k === 'a') { select(TL.cues.map((c) => c.id)); e.preventDefault(); }
    else if (e.key === 'Escape') { select([]); }
    else if (!mod && k === 'k') { tapInsert(); e.preventDefault(); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && TL.selSet.size) {
      const cs = selCues(), dt = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.01 : beatLen());
      if (Math.min(...cs.map((c) => c.t)) + dt < 0) return;
      snap(); for (const c of cs) c.t += dt; tlProps(); e.preventDefault();
    }
  });
}

/* ---------------------------------------------------------------- properties of the selected keyframe */
function tlProps() {
  const box = $('#tl-props');
  if (TL.selSet.size > 1) { tlPropsMulti(box); return; }
  const c = TL.cues.find((q) => q.id === TL.sel && TL.selSet.has(q.id));
  if (!c) { box.dataset.sel = ''; box.innerHTML = `<span class="hint">${esc(t('mu.help2'))}</span>`; return; }
  const bl = beatLen(), beats = +(c.d / bl).toFixed(2);
  const head = `<span class="tag" style="--c:${(FX[catOf(c.kind)] || FX.preset).color}">${esc(catName(catOf(c.kind)))} · ${esc(fxName(c.kind))}</span>
    <span class="mono" id="tlp-time">${fmtTimeMs(c.t)} · ${esc(t('mu.beats', { n: beats }))}</span>`;
  if (box.dataset.sel === `${c.id}:${PH.lang}`) { const tt = $('#tlp-time', box); if (tt) tt.textContent = `${fmtTimeMs(c.t)} · ${t('mu.beats', { n: beats })}`; return; }
  box.dataset.sel = `${c.id}:${PH.lang}`;
  const p = c.params;
  let extra = `<label>${esc(t('mu.len'))} <span class="seg sm" id="tlp-len">${[0.25, 0.5, 1, 2, 4, 8, 16, 32].map((n) =>
    `<button data-n="${n}" class="${Math.abs(beats - n) < 0.01 ? 'on' : ''}">${n < 1 ? (n === 0.25 ? '¼' : '½') : n}</button>`).join('')}</span></label>`;
  if (DEF_BEATS[c.kind]) {
    const cur = p.beats || 0;
    extra += `<label>${esc(t('mu.rhythm'))} <select data-p="beats">${[0.25, 0.5, 1, 2, 4, 8, 16, 32].map((n) =>
      `<option value="${n}" ${n === cur ? 'selected' : ''}>${esc(t('mu.cycle', { n }))}</option>`).join('')}
      <option value="0" ${!cur ? 'selected' : ''}>${esc(t('mu.rfree'))}</option></select></label>`;
    if (!cur && 'speed' in p) extra += `<label>${esc(t('mu.speed2'))} <input type="range" min="0.05" max="4" step="0.05" value="${p.speed}" data-p="speed"></label>`;
  }
  if (c.kind === 'strobe') extra += `<label>${esc(t('mu.speed2'))} <input type="range" min="20" max="255" step="1" value="${p.speed}" data-p="speed"></label>`;
  if ('size' in p) extra += `<label>${esc(t('mu.size2'))} <input type="range" min="5" max="120" step="1" value="${p.size}" data-p="size"></label>`;
  if (c.kind === 'position') {
    extra += `<label>${esc(t('mu.pan'))} <input type="range" min="0" max="1" step="0.005" value="${p.pan}" data-p="pan"></label>
      <label>${esc(t('mu.tilt'))} <input type="range" min="0" max="1" step="0.005" value="${p.tilt}" data-p="tilt"></label>
      <button class="btn sm" id="tlp-here">${esc(t('mu.here'))}</button>`;
  }
  if (c.kind === 'gobo' || c.kind === 'gobo_shake') {
    const f = PH.fixtures().find((x) => x.gobos && x.gobos.length);
    const opts = f ? f.gobos : [[0, 'open'], [12, '1'], [20, '2'], [28, '3'], [36, '4'], [44, '5'], [52, '6'], [60, '7']];
    extra += `<label>${esc(t('mu.gobo'))} <select data-p="value">${opts.filter(([v]) => (c.kind === 'gobo' ? v < 64 : v >= 64 && v < 128) || c.kind === 'gobo')
      .map(([v, n]) => `<option value="${v}" ${v === p.value ? 'selected' : ''}>${esc(/^\d+$/.test(n) ? `Gobo ${n}` : t(`gobo.${n}`))}</option>`).join('')}</select></label>`;
  }
  if ('color_a' in p) extra += `<label>${esc(t('mu.col1'))} <input type="color" value="${rgbHex(p.color_a)}" data-p="color_a"></label>`;
  if ('color_b' in p) extra += `<label>${esc(t('mu.col2'))} <input type="color" value="${rgbHex(p.color_b)}" data-p="color_b"></label>`;
  if (c.kind === 'kicks') {
    extra += `<label>${esc(t('mu.floor'))} <input type="range" min="0" max="0.6" step="0.02" value="${p.floor || 0}" data-p="floor"></label>
      <label>${esc(t('mu.decay'))} <select data-p="curve"><option value="3.2" ${p.curve >= 3 ? 'selected' : ''}>${esc(t('mu.short'))}</option>
        <option value="2.2" ${p.curve > 1.5 && p.curve < 3 ? 'selected' : ''}>·</option><option value="1.2" ${p.curve <= 1.5 ? 'selected' : ''}>${esc(t('mu.long'))}</option></select></label>`;
  }
  if (!NO_FADE.has(c.kind)) {
    const bl2 = beatLen(), opt = (k) => [0, 0.25, 0.5, 1, 2, 4, 8].map((n) => `<option value="${n}" ${Math.abs((p[k] || 0) - n * bl2) < 0.02 ? 'selected' : ''}>${n ? t('mu.beats', { n }) : '—'}</option>`).join('');
    extra += `<label>${esc(t('mu.fadein'))} <select data-fade="fade_in">${opt('fade_in')}</select></label>
      <label>${esc(t('mu.fadeout'))} <select data-fade="fade_out">${opt('fade_out')}</select></label>
      <label>${esc(t('mu.ease'))} <select data-ease="1">${['smooth', 'linear', 'in', 'out'].map((e) => `<option value="${e}" ${(p.ease || 'smooth') === e ? 'selected' : ''}>${esc(t(`ease.${e}`))}</option>`).join('')}</select></label>`;
  }
  const fx = PH.fixtures(), sel = (S.st && S.st.selection) || [];
  if (fx.length > 1 && !['position', 'dark'].includes(c.kind)) {
    extra += `<label>${esc(t('mu.spread'))} <input type="range" min="0" max="1" step="0.05" value="${p.spread ?? 0}" data-p="spread"></label>
      <label>${esc(t('mu.order'))} <select data-po="1">${['left', 'right', 'center', 'random'].map((o) => `<option value="${o}" ${(p.order || 'left') === o ? 'selected' : ''}>${esc(t(`or.${o}`))}</option>`).join('')}</select></label>`;
  }
  if (fx.length > 1) {
    const cur = Array.isArray(c.targets) ? 'list' : String(c.targets);
    extra += `<label>${esc(t('mu.lamps'))} <select id="tlp-tg"><option value="all">${esc(t('mu.all'))}</option>
      ${sel.length > 1 || cur === 'list' ? `<option value="list" ${cur === 'list' ? 'selected' : ''}>${esc(t('mu.selLamps', { n: Array.isArray(c.targets) ? c.targets.length : sel.length }))}</option>` : ''}
      ${fx.map((f) => `<option value="${f.id}" ${cur === String(f.id) ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>`;
  }
  box.innerHTML = `${head}${extra}<span class="grow"></span>
    <button class="btn sm" id="tl-dup">${esc(t('mu.dup'))}</button>
    <button class="btn sm danger-t" id="tl-del">${esc(t('mu.delcue'))}</button>`;
  let pushed = false;
  const touch = () => { if (!pushed) { snap(); pushed = true; } if (TL.on.has(c.id)) { TL.on.delete(c.id); send({ type: 'fx_stop', id: 'cue-' + c.id }); } };
  for (const inp of $$('[data-p]', box)) inp.oninput = inp.onchange = () => {
    touch();
    const k = inp.dataset.p;
    c.params[k] = inp.type === 'color' ? hexRgb(inp.value) : Number(inp.value);
    if (k === 'beats' && !c.params.beats) delete c.params.beats;
    if (k === 'beats') { box.dataset.sel = ''; tlProps(); }
  };
  for (const b of $$('#tlp-len button', box)) b.onclick = () => {
    touch(); c.d = Number(b.dataset.n) * beatLen();
    $$('#tlp-len button', box).forEach((x) => x.classList.toggle('on', x === b)); tlProps();
  };
  const here = $('#tlp-here', box);
  if (here) here.onclick = () => { const f = PH.activeFx(); if (!f) return; touch(); c.params.pan = f.values.pan / 65535; c.params.tilt = f.values.tilt / 65535; box.dataset.sel = ''; tlProps(); };
  const tg = $('#tlp-tg', box);
  if (tg) tg.onchange = () => {
    touch();
    c.targets = tg.value === 'all' ? 'all' : tg.value === 'list' ? (Array.isArray(c.targets) ? c.targets : [...((S.st && S.st.selection) || [])]) : Number(tg.value);
  };
  for (const el of $$('[data-fade]', box)) el.onchange = () => { touch(); c.params[el.dataset.fade] = Number(el.value) * beatLen(); if (!c.params[el.dataset.fade]) delete c.params[el.dataset.fade]; };
  for (const el of $$('[data-ease]', box)) el.onchange = () => { touch(); c.params.ease = el.value; };
  for (const el of $$('[data-po]', box)) el.onchange = () => { touch(); c.params.order = el.value; };
  $('#tl-del', box).onclick = tlDelete;
  $('#tl-dup', box).onclick = tlDuplicate;
}
function tlPropsMulti(box) {
  const cs = selCues(), sig = `multi:${PH.lang}:${cs.map((c) => c.id).join(',')}`;
  if (box.dataset.sel === sig) return;
  box.dataset.sel = sig;
  const bl = beatLen(), fx = PH.fixtures(), sel = (S.st && S.st.selection) || [];
  const t0 = Math.min(...cs.map((c) => c.t)), t1 = Math.max(...cs.map((c) => c.t + c.d));
  box.innerHTML = `<span class="multi">${esc(t('mu.nSel', { n: cs.length }))}</span>
    <span class="mono">${fmtTimeMs(t0)} → ${fmtTimeMs(t1)}</span>
    <label>${esc(t('mu.len'))} <span class="seg sm" id="tlm-len">${[0.25, 0.5, 1, 2, 4, 8, 16].map((n) => `<button data-n="${n}">${n < 1 ? (n === 0.25 ? '¼' : '½') : n}</button>`).join('')}</span></label>
    <label>${esc(t('mu.rhythm'))} <select id="tlm-beats"><option value="">—</option>${[0.25, 0.5, 1, 2, 4, 8, 16].map((n) => `<option value="${n}">${esc(t('mu.cycle', { n }))}</option>`).join('')}</select></label>
    <label>${esc(t('mu.fadein'))} <select id="tlm-fi"><option value="">—</option>${[0, 0.5, 1, 2, 4].map((n) => `<option value="${n}">${n ? esc(t('mu.beats', { n })) : '0'}</option>`).join('')}</select></label>
    <label>${esc(t('mu.fadeout'))} <select id="tlm-fo"><option value="">—</option>${[0, 0.5, 1, 2, 4].map((n) => `<option value="${n}">${n ? esc(t('mu.beats', { n })) : '0'}</option>`).join('')}</select></label>
    ${fx.length > 1 ? `<label>${esc(t('mu.spread'))} <input type="range" id="tlm-spread" min="0" max="1" step="0.05" value="0"></label>
      <label>${esc(t('mu.lamps'))} <select id="tlm-tg"><option value="">—</option><option value="all">${esc(t('mu.all'))}</option>${sel.length ? `<option value="list">${esc(t('mu.selLamps', { n: sel.length }))}</option>` : ''}</select></label>` : ''}
    <span class="grow"></span>
    <button class="btn sm" id="tlm-dup">${ic('copy')}<span>${esc(t('mu.dup'))}</span></button>
    <button class="btn sm danger-t" id="tlm-del">${ic('trash')}<span>${esc(t('mu.delcue'))}</span></button>`;
  const each = (fn) => { snap(); for (const c of selCues()) fn(c); tlStopCues(); };
  for (const b of $$('#tlm-len button', box)) b.onclick = () => each((c) => { c.d = Number(b.dataset.n) * bl; });
  $('#tlm-beats', box).onchange = (e) => { if (e.target.value) each((c) => { if (DEF_BEATS[c.kind]) c.params.beats = Number(e.target.value); }); };
  $('#tlm-fi', box).onchange = (e) => { if (e.target.value !== '') each((c) => { c.params.fade_in = Number(e.target.value) * bl; }); };
  $('#tlm-fo', box).onchange = (e) => { if (e.target.value !== '') each((c) => { c.params.fade_out = Number(e.target.value) * bl; }); };
  const sp = $('#tlm-spread', box); if (sp) sp.onchange = () => each((c) => { c.params.spread = Number(sp.value); });
  const tg = $('#tlm-tg', box); if (tg) tg.onchange = () => { if (tg.value) each((c) => { c.targets = tg.value === 'list' ? [...sel] : 'all'; }); };
  $('#tlm-dup', box).onclick = tlDuplicate;
  $('#tlm-del', box).onclick = tlDelete;
}
const rgbHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/* ---------------------------------------------------------------- playback */
function fireCue(c, now) {
  const off = Math.max(0, now - c.t);                  // start in phase even when the tick came a few ms late
  send({ type: 'fx_start', id: 'cue-' + c.id, kind: c.kind, params: { ...c.params, t_offset: off },
         targets: c.targets || 'all', duration: Math.max(0.05, c.d) });
}
function tlStopCues() {
  for (const id of TL.on) send({ type: 'fx_stop', id: 'cue-' + id });
  TL.on.clear();
}
function tlSeek(tt) {
  TL.audio.currentTime = clamp(tt, 0, TL.duration);
  TL.lastT = TL.audio.currentTime;
  tlStopCues();
}
function tlPlay() {
  if (!TL.duration) return;
  if (TL.audio.paused) {
    TL.lastT = TL.audio.currentTime; TL.audio.play();
    if (TL.bpm) send({ type: 'bpm', value: TL.bpm });
    playBtn(true);
  } else { TL.audio.pause(); tlStopCues(); playBtn(false); }
}
function playBtn(on) { $('#tl-play').innerHTML = `${ic(on ? 'pause' : 'play')}<span>${esc(t(on ? 'mu.pause' : 'mu.play'))}</span>`; }
function tlStop() { TL.audio.pause(); tlSeek(0); playBtn(false); }
TL.audio.addEventListener('ended', () => { tlStopCues(); playBtn(false); });

function tlTick() {
  if (!TL.duration || TL.audio.paused) return;
  const now = TL.audio.currentTime + TL.sync / 1000;   // look-ahead: DMX frame + lamp electronics lag a little
  for (const c of TL.cues) {
    const inside = now >= c.t && now < c.t + c.d;
    if (inside && !TL.on.has(c.id)) { TL.on.add(c.id); fireCue(c, now); }
    else if (!inside && TL.on.has(c.id)) { TL.on.delete(c.id); send({ type: 'fx_stop', id: 'cue-' + c.id }); }
  }
  // beats of the song drive the beat reactions (flash / colour / move on beat)
  TL.beats.forEach((b, i) => {
    if (b > TL.lastT && b <= now) {
      const en = TL.energy[i] || 0, prev = TL.energy[i - 4] || en;
      send({ type: 'beat', strength: en, drop: i % 4 === 0 && en - prev > 0.3, bpm: Math.round(TL.bpm) });
    }
  });
  TL.lastT = now;
  const x = xOf(now), w = $('#tl-canvas').clientWidth;
  if (!TL.drag && (x > w - 40 || x < TL.LABEL)) TL.scroll = Math.max(0, now - (w - TL.LABEL) * 0.15 / TL.pps);
}

/* ---------------------------------------------------------------- auto-show from beats, kicks and loudness */
const AUTO_POOLS = {
  calm: { move: [['tilt_wave', 16, 14], ['sweep', 16, 30], ['fan', 16, 40]], color: [['gradient', 16], ['sequence', 8, true]], dim: [['breathe', 8, 0.3]], kicks: 0, drop: null },
  dynamic: { move: [['figure8', 8, 40], ['square', 8, 35], ['sweep', 4, 60], ['circle', 8, 40]], color: [['sequence', 2], ['chase', 1], ['gradient', 8]], dim: [['pulse', 1, 0.45]], kicks: 0.7, drop: 2 },
  dance: { move: [['bounce', 2, 35], ['circle', 4, 45], ['triangle', 4, 40]], color: [['sequence', 1], ['chase', 1]], dim: [], kicks: 0.3, drop: 2 },
  rave: { move: [['random', 1, 60], ['spiral', 4, 55], ['bounce', 1, 45], ['sweep', 1, 70]], color: [['chase', 0.5], ['sequence', 0.5]], dim: [], kicks: 0.15, drop: 4 },
};
const AS_KINDS = {
  move: ['circle', 'figure8', 'sweep', 'tilt_wave', 'square', 'triangle', 'spiral', 'bounce', 'fan', 'random'],
  color: ['rainbow', 'chase', 'sequence', 'gradient', 'two_color', 'fire', 'ocean'],
  dim: ['pulse', 'breathe', 'blink', 'heartbeat', 'wave', 'sparkle'],
};
const AS_BEATS = { circle: 8, figure8: 8, sweep: 8, tilt_wave: 8, square: 8, triangle: 6, spiral: 16, bounce: 2, fan: 8, random: 1,
  rainbow: 16, chase: 1, sequence: 2, gradient: 8, two_color: 2, fire: 4, ocean: 16, pulse: 1, breathe: 8, blink: 1, heartbeat: 2, wave: 2, sparkle: 0.25 };
const AS_MOOD = {
  calm: { move: ['tilt_wave', 'sweep', 'fan', 'figure8'], color: ['gradient', 'ocean', 'sequence'], dim: ['breathe'], k: 0.6 },
  dynamic: { move: ['figure8', 'square', 'sweep', 'circle', 'triangle'], color: ['sequence', 'chase', 'gradient', 'two_color'], dim: ['pulse', 'breathe', 'wave'], k: 1 },
  dance: { move: ['bounce', 'circle', 'triangle', 'figure8'], color: ['sequence', 'chase', 'two_color'], dim: ['pulse', 'wave', 'blink'], k: 0.5 },
  rave: { move: ['random', 'spiral', 'bounce', 'sweep'], color: ['chase', 'sequence', 'fire'], dim: ['blink', 'sparkle', 'wave'], k: 0.25 },
  hits: { move: [], color: [], dim: [], k: 0, still: true },
  auto: { move: ['figure8', 'sweep', 'circle', 'bounce', 'tilt_wave'], color: ['sequence', 'chase', 'gradient'], dim: ['pulse', 'breathe'], k: 0.4 },
};
function asOptions() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem('ph_as') || '{}'); } catch (e) { /* ignore */ }
  const ap = (S.st && S.st.effects.autopilot) || {};
  return { mood: o.mood || ap.mood || 'dynamic', off: o.off || [], colorsOff: o.colorsOff || [], kicks: o.kicks ?? true, drops: o.drops ?? true,
    gobo: o.gobo ?? true, white: o.white ?? false, lasers: o.lasers ?? true, flashAll: o.flashAll ?? false, energy: o.energy ?? 0.6, spread: o.spread ?? 0.25, order: o.order || 'left', lamps: o.lamps || 'all', keep: o.keep ?? false };
}
function openAutoShow() {
  if (!TL.beats.length) { toast(t('mu.noSong'), 'warn'); return; }
  let d = $('#as-dialog');
  if (!d) { d = document.createElement('dialog'); d.id = 'as-dialog'; document.body.appendChild(d); }
  const o = asOptions(), pal = (S.st && S.st.effects.palette) || [];
  const chips = (cat) => AS_KINDS[cat].map((k) => `<button data-k="${k}" class="${o.off.includes(k) ? '' : 'on'}" style="--c:${FX[cat].color}">${esc(fxName(k))}</button>`).join('');
  d.innerHTML = `<div class="as"><h3>${ic('sparkle')} ${esc(t('as.title'))}</h3><p class="hint" style="margin:-8px 0 0">${esc(t('as.hint'))}</p>
    <div><div class="grpt">${esc(t('as.style'))}</div><div class="moods" id="as-mood">${Object.keys(MOOD_IC).map((m) => `<button class="mood${o.mood === m ? ' on' : ''}" data-mood="${m}">${MOOD_IC[m]}<b>${esc(t(`mood.${m}`))}</b><small>${esc(t(`md.${m}`))}</small></button>`).join('')}</div></div>
    <div><div class="grpt">${esc(t('as.colors'))}</div><div class="as-kinds" id="as-cols">${pal.map((c, i) => `<button data-ci="${i}" class="${o.colorsOff.includes(i) ? '' : 'on'}" style="--c:rgb(${c.join(',')})"><i style="display:inline-block;width:12px;height:12px;border-radius:50%;background:rgb(${c.join(',')});vertical-align:-2px"></i></button>`).join('')}</div></div>
    <div class="as-row"><div><div class="grpt">${esc(t('as.move'))}</div><div class="as-kinds" data-cat="move">${chips('move')}</div></div>
      <div><div class="grpt">${esc(t('as.color'))}</div><div class="as-kinds" data-cat="color">${chips('color')}</div></div></div>
    <div class="as-row"><div><div class="grpt">${esc(t('as.dim'))}</div><div class="as-kinds" data-cat="dim">${chips('dim')}</div></div>
      <div><div class="grpt">${esc(t('as.opts'))}</div>
        <label class="switch"><input type="checkbox" id="as-kicks" ${o.kicks ? 'checked' : ''}><span></span>${esc(t('as.kicks'))}</label><br>
        <label class="switch"><input type="checkbox" id="as-drops" ${o.drops ? 'checked' : ''}><span></span>${esc(t('as.drops'))}</label><br>
        <label class="switch"><input type="checkbox" id="as-gobo" ${o.gobo ? 'checked' : ''}><span></span>${esc(t('as.gobo'))}</label><br>
        <label class="switch"><input type="checkbox" id="as-keep" ${o.keep ? 'checked' : ''}><span></span>${esc(t('as.keep'))}</label><br>
        <label class="switch"><input type="checkbox" id="as-white" ${o.white ? 'checked' : ''}><span></span>${esc(t('as.white'))}</label><br>
        <label class="switch"><input type="checkbox" id="as-flashall" ${o.flashAll ? 'checked' : ''}><span></span>${esc(t('as.flashAll'))}</label><br>
        <label class="switch"><input type="checkbox" id="as-lasers" ${o.lasers ? 'checked' : ''}><span></span>${esc(t('as.lasers'))}</label></div></div>
    <div class="as-row"><label class="sl"><span>${esc(t('as.energy'))}</span><input type="range" id="as-energy" min="0" max="1" step="0.05" value="${o.energy}"><output>${Math.round(o.energy * 100)}%</output></label>
      <label class="sl"><span>${esc(t('mu.spread'))}</span><input type="range" id="as-spread" min="0" max="1" step="0.05" value="${o.spread}"><output>${Math.round(o.spread * 100)}%</output></label></div>
    <div class="rowp"><span class="lbl">${esc(t('mu.order'))}</span><select id="as-order">${['left', 'right', 'center', 'random'].map((x) => `<option value="${x}" ${o.order === x ? 'selected' : ''}>${esc(t(`or.${x}`))}</option>`).join('')}</select>
      <span class="lbl">${esc(t('as.lamps'))}</span><select id="as-lamps"><option value="all">${esc(t('mu.all'))}</option>${((S.st && S.st.selection) || []).length ? `<option value="sel" ${o.lamps === 'sel' ? 'selected' : ''}>${esc(t('mu.selLamps', { n: S.st.selection.length }))}</option>` : ''}</select></div>
  </div><div class="as-foot"><button class="btn" id="as-cancel">${esc(t('as.cancel'))}</button><button class="btn primary" id="as-go">${ic('sparkle')}<span>${esc(t('as.go'))}</span></button></div>`;
  for (const b of $$('#as-mood .mood', d)) b.onclick = () => { $$('#as-mood .mood', d).forEach((x) => x.classList.toggle('on', x === b)); };
  for (const b of $$('.as-kinds button', d)) b.onclick = () => b.classList.toggle('on');
  for (const r of $$('input[type=range]', d)) r.oninput = () => { r.nextElementSibling.textContent = `${Math.round(r.value * 100)}%`; };
  $('#as-cancel', d).onclick = () => d.close();
  $('#as-go', d).onclick = () => {
    const opts = {
      mood: $('#as-mood .mood.on', d).dataset.mood,
      off: $$('.as-kinds[data-cat] button:not(.on)', d).map((b) => b.dataset.k),
      colorsOff: $$('#as-cols button:not(.on)', d).map((b) => Number(b.dataset.ci)),
      kicks: $('#as-kicks', d).checked, drops: $('#as-drops', d).checked, gobo: $('#as-gobo', d).checked, keep: $('#as-keep', d).checked,
      white: $('#as-white', d).checked, flashAll: $('#as-flashall', d).checked, lasers: $('#as-lasers', d).checked,
      energy: Number($('#as-energy', d).value), spread: Number($('#as-spread', d).value), order: $('#as-order', d).value, lamps: $('#as-lamps', d).value,
    };
    try { localStorage.setItem('ph_as', JSON.stringify(opts)); } catch (e) { /* ignore */ }
    d.close(); tlAutoShow(opts);
  };
  d.showModal();
}
const MUSICAL = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16];
const qBeats = (b) => MUSICAL.reduce((a, m) => (Math.abs(Math.log(m / b)) < Math.abs(Math.log(a / b)) ? m : a), 1);
function tlAutoShow(o = asOptions()) {
  if (!TL.beats.length) { toast(t('mu.noSong'), 'warn'); return; }
  snap(); tlStopCues();
  if (!o.keep) TL.cues = [];
  const L = beatLen(), mood = AS_MOOD[o.mood] || AS_MOOD.dynamic;
  const palAll = (S.st && S.st.effects.palette) || [[255, 0, 90], [0, 170, 255]];
  const pal = palAll.filter((_, i) => !o.colorsOff.includes(i));
  const colors = o.white ? [[255, 255, 255]] : (pal.length ? pal : palAll);
  const still = !!mood.still || o.mood === 'hits';
  const ok = (k) => !o.off.includes(k);
  const pool = (cat) => { if (still) return []; const p1 = mood[cat].filter(ok); return p1.length ? p1 : AS_KINDS[cat].filter(ok); };
  const mv = pool('move'), co = pool('color'), di = pool('dim');
  const targets = o.lamps === 'sel' && S.st && S.st.selection.length ? [...S.st.selection] : 'all';
  const phrase = o.mood === 'calm' ? 16 : 8;
  const size = 20 + 40 * o.energy;
  // phrases start on the first loud beat
  let first = TL.energy.findIndex((e) => e > 0.25); if (first < 0) first = 0;
  first -= first % 4;
  const add = (kind, params, at, dur) => {
    const c = { id: TL.nextId++, t: at, d: dur, kind, targets,
      params: { ...(DEF_PARAMS[kind] || {}), ...params, spread: o.spread, order: o.order } };
    TL.cues.push(c); return c;
  };
  let n = 0;
  for (let i = first; i < TL.beats.length; i += phrase, n++) {
    const seg = TL.energy.slice(i, i + phrase), e = seg.reduce((a, b) => a + b, 0) / seg.length;
    const prev = i >= phrase ? TL.energy.slice(i - phrase, i).reduce((a, b) => a + b, 0) / phrase : e;
    const t0 = TL.beats[i], t1 = TL.beats[i + phrase] ?? TL.duration, d = t1 - t0;
    const hot = e > 0.62 - 0.2 * o.energy;
    const scale = (b) => qBeats(b * (hot ? 1 : 2) * (1.4 - 0.8 * o.energy));   // calmer parts and lower energy = slower cycles, always whole musical values
    if (mv.length) { const k = mv[n % mv.length]; add(k, { beats: Math.max(0.5, scale(AS_BEATS[k] || 4)), size: size * (hot ? 1.1 : 0.7), fade_in: L, ease: 'smooth' }, t0, d); }
    if (o.white || still) add('static_color', { color_a: colors[n % colors.length] }, t0, d);
    else if (co.length) { const k = co[(n + 1) % co.length]; add(k, { beats: Math.max(0.25, scale(AS_BEATS[k] || 2)), colors, color_a: colors[n % colors.length], color_b: colors[(n + 1) % colors.length], fade: o.mood === 'calm' }, t0, d); }
    const bpmNow = d > 0 ? (phrase * 60) / d : 0;
    if (o.lasers && (hot && bpmNow >= 125 || e - prev > 0.28)) {        // fast / loud part: lasers pulse exactly on the beats
      const bs = TL.beats.filter((b) => b >= t0 - 0.002 && b < t1);
      if (bs.length) add('laser_hit', { hits: bs.map((b) => [+(b - t0).toFixed(4), 1]), duty: 0.4 }, t0, d);
    }
    if (o.kicks && (hot || still || o.flashAll)) {
      const hits = TL.kicks.filter((k) => k.t >= t0 - 0.002 && k.t < t1 && k.s > 0.3);
      const src = hits.length ? hits : TL.beats.filter((b) => b >= t0 - 0.002 && b < t1).map((b) => ({ t: b, s: 0.8 }));
      if (src.length) add('kicks', { hits: src.map((k) => [+(k.t - t0).toFixed(4), +k.s.toFixed(3)]), floor: (still || o.flashAll) ? 0 : mood.k * (1 - o.energy * 0.6), curve: 2.2, max_len: Math.min(0.6, L) }, t0, d);
    } else if (di.length) { const k = di[n % di.length]; add(k, { beats: Math.max(0.25, scale(AS_BEATS[k] || 2)), min: 0.35 }, t0, d); }
    if (e - prev > 0.28) {                                   // drop
      if (o.drops && ok('strobe')) add('strobe', { speed: 225 + 30 * o.energy }, t0, Math.min(d, L * 2));
      if (o.gobo) add('gobo_shake', {}, t0, d);
    }
  }
  select([]);
  toast(`Auto-show: ${TL.cues.length} klatek kluczowych z ${TL.beats.length} bitów`);
}

/* ---------------------------------------------------------------- shows: save / load / delete */
async function tlRefreshShows() {
  try {
    const list = await (await fetch('/api/shows')).json();
    $('#tl-shows').innerHTML = '<option value="">— zapisane pokazy —</option>'
      + list.map((s) => `<option value="${esc(s.name)}">${esc(s.name)} · ${s.cues} klatek</option>`).join('');
  } catch (e) { /* offline */ }
}
async function tlSave() {
  const name = $('#tl-name').value.trim();
  if (!name || !TL.duration) { toast('Wczytaj utwór i wpisz nazwę pokazu', 'warn'); return; }
  try {
    if (TL.file) {                                         // keep the song next to the show
      await fetch(`/api/audio/${encodeURIComponent(TL.file.name)}`, { method: 'PUT', body: TL.file });
      TL.file = null;
    }
    const show = { name, audio: TL.audioName, duration: TL.duration, bpm: TL.bpm, beats: TL.beats, kicks: TL.kicks, energy: TL.energy,
                   cues: TL.cues.map(({ t: tt, d, kind, params, targets }) => ({ t: tt, d, kind, params, targets })) };
    await fetch(`/api/shows/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(show) });
    toast(`Zapisano pokaz „${name}”`); tlRefreshShows();
  } catch (e) { toast('Nie udało się zapisać: ' + e.message, 'err'); }
}
async function tlLoad() {
  const name = $('#tl-shows').value; if (!name) return;
  try {
    const show = await (await fetch(`/api/shows/${encodeURIComponent(name)}`)).json();
    tlStop();
    if (show.audio) {
      const buf = await (await fetch(`/audio/${encodeURIComponent(show.audio)}`)).arrayBuffer();
      await tlDecode(buf);
      TL.audio.src = `/audio/${encodeURIComponent(show.audio)}`;
    }
    TL.audioName = show.audio; TL.file = null;
    if (show.beats) { TL.beats = show.beats; TL.energy = show.energy || TL.energy; TL.bpm = show.bpm || TL.bpm; }
    if (show.kicks) TL.kicks = show.kicks;
    TL.cues = (show.cues || []).map((c) => ({ ...c, id: TL.nextId++, params: c.params || {}, targets: c.targets ?? 'all' }));
    TL.hist = [];
    $('#tl-name').value = show.name; select([]);
    toast(`Wczytano pokaz „${show.name}”`);
  } catch (e) { toast('Nie udało się wczytać: ' + e.message, 'err'); }
}
async function tlDeleteShow() {
  const name = $('#tl-shows').value; if (!name) return;
  if (!confirm(tr(`Usunąć pokaz „${name}”?`))) return;
  await fetch(`/api/shows/${encodeURIComponent(name)}`, { method: 'DELETE' });
  toast(`Usunięto „${name}”`, 'warn'); tlRefreshShows();
}

/* ---------------------------------------------------------------- tool palette for the timeline */
function buildTools() {
  const box = $('#tl-tools'); box.innerHTML = '';
  const row = (cls) => { const r = document.createElement('div'); r.className = cls; box.appendChild(r); return r; };
  const act = row('tl-acts');
  const mk = (id, txt, fn, icon, cls = 'btn sm') => { const b = document.createElement('button'); b.className = cls; b.id = id; b.innerHTML = `${icon ? ic(icon) : ''}<span>${esc(t(txt))}</span>`; b.onclick = fn; act.appendChild(b); return b; };
  mk('tl-magnet', 'mu.magnet', () => { TL.magnet = !TL.magnet; $('#tl-magnet').classList.toggle('on', TL.magnet); }, 'magnet').classList.toggle('on', TL.magnet);
  mk('tl-tap', 'mu.tap', tapInsert, 'rec');
  mk('tl-kickfill', 'mu.kickfill', kickFill, 'drum');
  mk('tl-undo', 'mu.undo', undo, 'undo');
  const sp = document.createElement('span'); sp.className = 'grow'; act.appendChild(sp);
  mk('tl-zo', 'mu.zoomout', () => tlZoom(1 / 1.5), 'minus');
  mk('tl-zi', 'mu.zoomin', () => tlZoom(1.5), 'plus');
  mk('tl-fit', 'mu.fit', tlFit, 'fit');
  for (const [cat, c] of Object.entries(FX)) {
    const grp = row('tl-grp');
    grp.innerHTML = `<span class="tl-gt" style="--c:${c.color}">${esc(catName(cat))}</span>`;
    for (const k of Object.keys(c.kinds)) {
      const kind = cat === 'preset' ? `preset:${k}` : k;
      const b = document.createElement('button');
      b.className = 'tool'; b.dataset.kind = kind; b.style.setProperty('--c', c.color);
      b.textContent = fxName(kind);
      b.onclick = () => { TL.tool = TL.tool === kind ? null : kind; for (const x of $$('#tl-tools .tool')) x.classList.toggle('on', x.dataset.kind === TL.tool); };
      if (kind === TL.tool) b.classList.add('on');
      grp.appendChild(b);
    }
    if (cat === 'preset') {
      const b = document.createElement('button'); b.className = 'tool add'; b.style.setProperty('--c', c.color);
      b.textContent = t('mu.newfx'); b.onclick = () => crOpen(null); grp.appendChild(b);
    }
  }
}

/* ============================================================ 4. EFFECT CREATOR */
const CR = { name: null, move: 'none', points: [], size: 40, moveBeats: 8, color: 'none', colors: [[255, 0, 60], [0, 120, 255]],
  fade: false, colorBeats: 1, dim: 'none', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], dimBeats: 4, beam: 'none',
  goboValue: 12, preview: false, drawing: false, t0: performance.now() };
function crDialog() {
  let dlg = $('#cr-dialog');
  if (dlg) return dlg;
  dlg = document.createElement('dialog'); dlg.id = 'cr-dialog';
  document.body.appendChild(dlg);
  dlg.addEventListener('close', crStopPreview);
  return dlg;
}
function crOpen(name) {
  const dlg = crDialog();
  Object.assign(CR, { name, move: 'none', points: [], size: 40, moveBeats: 8, color: 'none', colors: [[255, 0, 60], [0, 120, 255]], fade: false,
    colorBeats: 1, dim: 'none', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], dimBeats: 4, beam: 'none', goboValue: 12 });
  const pre = name && FX.preset.kinds[name] && FX.preset.kinds[name][2];
  if (pre) {
    for (const ly of pre.layers) {
      const cat = catOf(ly.kind), p = ly.params || {};
      if (cat === 'move') { CR.move = ly.kind; CR.points = p.points || []; CR.size = p.size || 40; CR.moveBeats = p.beats || 8; }
      if (cat === 'color') { CR.color = ly.kind; CR.colors = p.colors || [p.color_a || [255, 0, 60], p.color_b || [0, 120, 255]]; CR.fade = !!p.fade; CR.colorBeats = p.beats || 1; }
      if (cat === 'dim') { CR.dim = ly.kind; CR.steps = p.steps || CR.steps; CR.dimBeats = p.beats || 4; }
      if (cat === 'beam') { CR.beam = ly.kind; CR.goboValue = p.value ?? 12; }
    }
  }
  const beatOpts = (cur) => [0.5, 1, 2, 4, 8, 16, 32].map((n) => `<option value="${n}" ${n === cur ? 'selected' : ''}>${esc(t('mu.beats', { n }))}</option>`).join('');
  const kindOpts = (cat, cur, extraKind, extraLabel) => `<option value="none">${esc(t('cr.none'))}</option>`
    + (extraKind ? `<option value="${extraKind}" ${cur === extraKind ? 'selected' : ''}>${esc(t(extraLabel))}</option>` : '')
    + Object.keys(FX[cat].kinds).filter((k) => !['position', 'flash', 'fade_in', 'fade_out', 'dark'].includes(k))
      .map((k) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(fxName(k))}</option>`).join('');
  const hasGobo = PH.fixtures().some((f) => f.channels.includes('gobo'));
  dlg.innerHTML = `
    <div class="dlg-h">${esc(t('cr.title'))}</div>
    <div class="cr">
      <label class="cr-name">${esc(t('cr.name'))}<input id="cr-name" maxlength="30" value="${esc(name || '')}" placeholder="np. Mój refren"></label>
      <div class="cr-cols">
        <section class="cr-sec" style="--c:${FX.move.color}">
          <h4>${esc(t('cr.move'))}</h4>
          <select id="cr-move">${kindOpts('move', CR.move, 'path', 'cr.draw')}</select>
          <canvas id="cr-pad" width="220" height="220"></canvas>
          <p class="hint" id="cr-draw-hint">${esc(t('cr.drawHint'))}</p>
          <label>${esc(t('mu.size2'))} <b class="mono" id="cr-size-v">±${CR.size}°</b><input type="range" id="cr-size" min="5" max="120" value="${CR.size}"></label>
          <label>${esc(t('cr.cycle'))}<select id="cr-mbeats">${beatOpts(CR.moveBeats)}</select></label>
        </section>
        <section class="cr-sec" style="--c:${FX.color.color}">
          <h4>${esc(t('cr.color'))}</h4>
          <select id="cr-color">${kindOpts('color', CR.color, 'sequence', 'cr.seq')}</select>
          <div class="cr-swatches" id="cr-swatches"></div>
          <label class="chk"><input type="checkbox" id="cr-fade" ${CR.fade ? 'checked' : ''}> ${esc(t('cr.fade'))}</label>
          <label>${esc(t('cr.cycle'))}<select id="cr-cbeats">${beatOpts(CR.colorBeats)}</select></label>
        </section>
        <section class="cr-sec" style="--c:${FX.dim.color}">
          <h4>${esc(t('cr.dim'))}</h4>
          <select id="cr-dim">${kindOpts('dim', CR.dim, 'pattern', 'cr.pattern')}</select>
          <div class="cr-steps" id="cr-steps"></div>
          <div class="rowp cr-pp">
            <button class="btn sm" data-pp="four">${esc(t('cr.p.four'))}</button><button class="btn sm" data-pp="off">${esc(t('cr.p.off'))}</button>
            <button class="btn sm" data-pp="gallop">${esc(t('cr.p.gallop'))}</button><button class="btn sm" data-pp="build">${esc(t('cr.p.build'))}</button>
            <button class="btn sm" data-pp="clear">${esc(t('cr.p.clear'))}</button></div>
          <label>${esc(t('cr.cycle'))}<select id="cr-dbeats">${beatOpts(CR.dimBeats)}</select></label>
          ${hasGobo ? `<h4>${esc(t('cr.beam'))}</h4><select id="cr-beam"><option value="none">${esc(t('cr.none'))}</option>
            ${['gobo', 'gobo_shake', 'gobo_spin'].map((k) => `<option value="${k}" ${CR.beam === k ? 'selected' : ''}>${esc(fxName(k))}</option>`).join('')}</select>` : ''}
        </section>
      </div>
    </div>
    <div class="dlg-f">
      <button class="btn" id="cr-prev">${esc(t('cr.preview'))}</button>
      <span class="grow"></span>
      <button class="btn" id="cr-cancel">${esc(t('cr.cancel'))}</button>
      <button class="btn primary" id="cr-save">${esc(t('cr.save'))}</button>
    </div>`;
  const bindSel = (id, key, num) => { const el = $(`#${id}`, dlg); if (el) el.onchange = () => { CR[key] = num ? Number(el.value) : el.value; crSync(); }; };
  bindSel('cr-move', 'move'); bindSel('cr-mbeats', 'moveBeats', true); bindSel('cr-color', 'color'); bindSel('cr-cbeats', 'colorBeats', true);
  bindSel('cr-dim', 'dim'); bindSel('cr-dbeats', 'dimBeats', true); bindSel('cr-beam', 'beam');
  $('#cr-size', dlg).oninput = (e) => { CR.size = Number(e.target.value); $('#cr-size-v', dlg).textContent = `±${CR.size}°`; crLive(); };
  $('#cr-fade', dlg).onchange = (e) => { CR.fade = e.target.checked; crLive(); };
  for (const b of $$('[data-pp]', dlg)) b.onclick = () => {
    CR.steps = { four: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], off: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      gallop: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1], build: [0.2, 0, 0.3, 0, 0.45, 0, 0.6, 0, 0.75, 0, 0.9, 0, 1, 1, 1, 1],
      clear: new Array(16).fill(0) }[b.dataset.pp];
    if (CR.dim !== 'pattern') { CR.dim = 'pattern'; $('#cr-dim', dlg).value = 'pattern'; }
    crSync();
  };
  $('#cr-prev', dlg).onclick = () => (CR.preview ? crStopPreview() : crStartPreview());
  $('#cr-cancel', dlg).onclick = () => dlg.close();
  $('#cr-save', dlg).onclick = crSave;
  crPadPointer();
  crSync();
  dlg.showModal();
}
function crLayers() {
  const L = [];
  if (CR.move !== 'none') {
    const p = { size: CR.size, beats: CR.moveBeats, speed: 0.3 };
    if (CR.move === 'path') { if (CR.points.length < 2) return L; p.points = CR.points; }
    L.push({ kind: CR.move, params: p });
  }
  if (CR.color !== 'none') {
    const p = { beats: CR.colorBeats, speed: 1 };
    if (CR.color === 'sequence') { p.colors = CR.colors; p.fade = CR.fade; }
    else { p.color_a = CR.colors[0] || [255, 0, 60]; p.color_b = CR.colors[1] || [0, 120, 255]; p.colors = CR.colors; }
    L.push({ kind: CR.color, params: p });
  }
  if (CR.dim !== 'none') {
    const p = { beats: CR.dimBeats, speed: 1 };
    if (CR.dim === 'pattern') p.steps = CR.steps;
    L.push({ kind: CR.dim, params: p });
  }
  if (CR.beam !== 'none') L.push({ kind: CR.beam, params: { value: CR.beam === 'gobo' ? CR.goboValue : CR.beam === 'gobo_shake' ? 96 : 192 } });
  return L;
}
function crSync() {
  const dlg = $('#cr-dialog'); if (!dlg) return;
  $('#cr-draw-hint', dlg).hidden = CR.move !== 'path';
  $('#cr-size', dlg).parentElement.hidden = $('#cr-mbeats', dlg).parentElement.hidden = CR.move === 'none';
  // colour list
  const sw = $('#cr-swatches', dlg);
  const showCols = ['sequence', 'two_color', 'gradient', 'static_color', 'chase'].includes(CR.color);
  sw.hidden = !showCols; $('#cr-fade', dlg).parentElement.hidden = CR.color !== 'sequence';
  $('#cr-cbeats', dlg).parentElement.hidden = CR.color === 'none' || CR.color === 'static_color';
  if (showCols) {
    const max = CR.color === 'static_color' ? 1 : CR.color === 'two_color' || CR.color === 'gradient' ? 2 : 8;
    CR.colors = CR.colors.slice(0, max);
    sw.innerHTML = CR.colors.map((c, i) => `<span class="cr-sw"><input type="color" value="${rgbHex(c)}" data-ci="${i}">${CR.colors.length > 1 ? `<button class="icon" data-cx="${i}">✕</button>` : ''}</span>`).join('')
      + (CR.colors.length < max ? `<button class="btn sm" id="cr-addc">${esc(t('cr.addColor'))}</button>` : '');
    for (const inp of $$('[data-ci]', sw)) inp.oninput = () => { CR.colors[Number(inp.dataset.ci)] = hexRgb(inp.value); crLive(); };
    for (const b of $$('[data-cx]', sw)) b.onclick = () => { CR.colors.splice(Number(b.dataset.cx), 1); crSync(); };
    const add = $('#cr-addc', sw);
    if (add) add.onclick = () => { CR.colors.push(hsv2rgb(Math.random() * 360, 1, 1)); crSync(); };
  }
  // 16 steps
  const stp = $('#cr-steps', dlg);
  stp.hidden = CR.dim !== 'pattern'; $('.cr-pp', dlg).hidden = CR.dim !== 'pattern';
  $('#cr-dbeats', dlg).parentElement.hidden = CR.dim === 'none';
  stp.innerHTML = CR.steps.map((v, i) => `<button data-st="${i}" class="${i % 4 === 0 ? 'beat' : ''}" style="--v:${v}"><i></i></button>`).join('');
  for (const b of $$('[data-st]', stp)) b.onclick = () => {
    const i = Number(b.dataset.st), v = CR.steps[i];
    CR.steps[i] = v >= 1 ? 0.5 : v > 0 ? 0 : 1; b.style.setProperty('--v', CR.steps[i]); crLive();
  };
  crLive();
}
function crLive() { if (CR.preview) crStartPreview(); }
function crStartPreview() {
  const layers = crLayers();
  crStopPreview(true);
  if (!layers.length) { toast(t('cr.needLayer'), 'warn'); return; }
  layers.forEach((ly, i) => send({ type: 'fx_start', id: `crprev/${i}`, kind: ly.kind, params: ly.params, targets: 'all' }));
  CR.preview = true; CR.previewN = layers.length;
  const b = $('#cr-prev'); if (b) { b.textContent = t('cr.stopPreview'); b.classList.add('on'); }
}
function crStopPreview(keepFlag) {
  for (let i = 0; i < 4; i++) send({ type: 'fx_stop', id: `crprev/${i}` });
  if (keepFlag === true) return;
  CR.preview = false;
  const b = $('#cr-prev'); if (b) { b.textContent = t('cr.preview'); b.classList.remove('on'); }
}
async function crSave() {
  const name = $('#cr-name').value.trim();
  if (!name) { toast(t('cr.needName'), 'warn'); $('#cr-name').focus(); return; }
  const layers = crLayers();
  if (!layers.length) { toast(t('cr.needLayer'), 'warn'); return; }
  try {
    const res = await fetch(`/api/presets/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layers, color: FX.preset.color }) });
    if (!res.ok) throw new Error(await res.text());
    if (CR.name && CR.name !== name) await fetch(`/api/presets/${encodeURIComponent(CR.name)}`, { method: 'DELETE' });
    await loadPresets(); PAD.sig = '';
    $('#cr-dialog').close();
    toast(t('cr.saved', { n: name }));
  } catch (e) { toast('Nie udało się zapisać: ' + e.message, 'err'); }
}
async function crDelete(name) {
  if (!confirm(t('cr.delete', { n: name }))) return;
  await fetch(`/api/presets/${encodeURIComponent(name)}`, { method: 'DELETE' });
  await loadPresets(); PAD.sig = '';
  toast(t('cr.deleted', { n: name }), 'warn');
}
/* drawing pad: the user draws the movement; preview dot runs along it */
function shapePoint(kind, u) {
  const w = 2 * Math.PI * u;
  const poly = (pts) => { const v = (u % 1) * pts.length, i = Math.floor(v) % pts.length, f = v - Math.floor(v), a = pts[i], b = pts[(i + 1) % pts.length]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
  switch (kind) {
    case 'circle': return [Math.cos(w), 0.6 * Math.sin(w)];
    case 'figure8': return [Math.sin(w), 0.5 * Math.sin(2 * w)];
    case 'sweep': return [Math.sin(w), 0];
    case 'tilt_wave': return [0, Math.sin(w)];
    case 'square': return poly([[-1, -1], [1, -1], [1, 1], [-1, 1]]).map((v, i) => (i ? v * 0.6 : v));
    case 'triangle': return poly([[0, -1], [1, 1], [-1, 1]]).map((v, i) => (i ? v * 0.6 : v));
    case 'spiral': { const r = 0.2 + 0.8 * (0.5 - 0.5 * Math.cos(w / 4)); return [r * Math.cos(w), 0.6 * r * Math.sin(w)]; }
    case 'bounce': return [Math.sin(w / 2), -0.6 * Math.abs(Math.sin(w)) + 0.3];
    case 'fan': return [0.5 + 0.5 * Math.sin(w), 0];
    case 'path': return CR.points.length > 1 ? poly(CR.points) : [0, 0];
    default: return [0, 0];
  }
}
function crPadDraw() {
  const cv = $('#cr-pad'); if (!cv || !$('#cr-dialog').open) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, c = W / 2, R = W * 0.42;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1f2b3d'; ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo((W / 8) * i, 0); ctx.lineTo((W / 8) * i, H); ctx.moveTo(0, (H / 8) * i); ctx.lineTo(W, (H / 8) * i); ctx.stroke(); }
  if (CR.move === 'none') return;
  const k = 1;                                            // shape at full pad size; the slider sets the real range
  ctx.strokeStyle = '#2b8cff'; ctx.lineWidth = 2; ctx.beginPath();
  if (CR.move === 'path' && CR.drawing) CR.points.forEach(([x, y], i) => (i ? ctx.lineTo(c + x * R, c + y * R) : ctx.moveTo(c + x * R, c + y * R)));
  else for (let i = 0; i <= 120; i++) { const [x, y] = shapePoint(CR.move, i / 120); const X = c + x * R * k, Y = c + y * R * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.stroke();
  if (!CR.drawing) {
    const bpm = curBpm() || 120, u = ((performance.now() - CR.t0) / 1000) * (bpm / 60) / CR.moveBeats;
    const [x, y] = shapePoint(CR.move, u % 1);
    const g = ctx.createRadialGradient(c + x * R * k, c + y * R * k, 0, c + x * R * k, c + y * R * k, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(43,140,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c + x * R * k, c + y * R * k, 16, 0, Math.PI * 2); ctx.fill();
  }
}
function crPadPointer() {
  const cv = $('#cr-pad');
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [clamp(((e.clientX - r.left) / r.width - 0.5) / 0.42, -1, 1), clamp(((e.clientY - r.top) / r.height - 0.5) / 0.42, -1, 1)]; };
  cv.onpointerdown = (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (CR.move !== 'path') { CR.move = 'path'; $('#cr-move').value = 'path'; }
    CR.drawing = true; CR.points = [pt(e)];
  };
  cv.onpointermove = (e) => {
    if (!CR.drawing) return;
    const p = pt(e), l = CR.points[CR.points.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.06) CR.points.push(p);
  };
  cv.onpointerup = cv.onpointercancel = () => {
    if (!CR.drawing) return;
    CR.drawing = false;
    if (CR.points.length > 64) { const s = CR.points.length / 64; CR.points = Array.from({ length: 64 }, (_, i) => CR.points[Math.floor(i * s)]); }
    CR.points = CR.points.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
    // keep the natural size: scale the drawing so it uses the full range
    const mx = Math.max(0.05, ...CR.points.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
    CR.points = CR.points.map(([x, y]) => [x / mx, y / mx]);
    CR.t0 = performance.now();
    crSync();
  };
}

/* ============================================================ 5. AUTOPILOT + STYLE + PALETTE */
const MOOD_IC = { auto: ic('sparkle'), calm: ic('moon'), dynamic: ic('wave'), dance: ic('music'), hits: ic('bolt'), rave: ic('flame') };
const PAL_PRESETS = {
  neon: [[255, 0, 120], [0, 220, 255], [180, 0, 255], [0, 255, 120]], warm: [[255, 60, 0], [255, 140, 0], [255, 210, 40], [255, 0, 60]],
  cold: [[0, 80, 255], [0, 200, 255], [120, 0, 255], [255, 255, 255]], rainbow: [[255, 0, 0], [255, 140, 0], [255, 255, 0], [0, 255, 0], [0, 120, 255], [160, 0, 255]],
  club: [[255, 0, 60], [0, 120, 255], [255, 255, 255]], white: [[255, 255, 255], [180, 220, 255]],
};
const AP = { sig: '', lang: null };
function buildAutopilot() {
  buildApCard();
  // pad: which lamps the effects play on
  const tgt = document.createElement('div');
  tgt.className = 'rowp';
  tgt.innerHTML = `<span class="lbl" data-i18n="mu.tgt">${esc(t('mu.tgt'))}</span><span class="seg sm fx-target" id="pad-tgt"><button data-v="all" class="on" data-i18n="mu.tgtAll">${esc(t('mu.tgtAll'))}</button><button data-v="sel" data-i18n="mu.tgtSel">${esc(t('mu.tgtSel'))}</button></span>`;
  $('#fx-pad').after(tgt);
  for (const b of $$('#pad-tgt button')) b.onclick = () => { PAD.target = b.dataset.v; $$('#pad-tgt button').forEach((x) => x.classList.toggle('on', x === b)); };
  const spr = document.createElement('div');
  spr.className = 'rowp';
  spr.innerHTML = `<label class="sl" style="flex:1"><span data-i18n="mu.spread">${esc(t('mu.spread'))}</span><input type="range" id="pad-spread" min="0" max="1" step="0.05" value="${PAD.spread}"><output id="pad-spread-v">${Math.round(PAD.spread * 100)}%</output></label>
    <select id="pad-order">${['left', 'right', 'center', 'random'].map((o) => `<option value="${o}" data-i18n="or.${o}">${esc(t(`or.${o}`))}</option>`).join('')}</select>`;
  tgt.after(spr);
  $('#pad-spread').oninput = (e) => { PAD.spread = Number(e.target.value); $('#pad-spread-v').textContent = `${Math.round(PAD.spread * 100)}%`; };
  $('#pad-order').onchange = (e) => { PAD.order = e.target.value; };
  // light ↔ sound sync
  const sync = document.createElement('label');
  sync.className = 'lbl rowp'; sync.title = t('mu.syncT');
  sync.innerHTML = `<span data-i18n="mu.sync">${esc(t('mu.sync'))}</span> <input type="number" id="tl-sync" min="-300" max="300" step="5" value="${TL.sync}" style="width:70px"> ms`;
  $('#tl-auto').after(sync);
  $('#tl-sync').onchange = (e) => { TL.sync = Number(e.target.value) || 0; localStorage.setItem('ph_sync', TL.sync); };
}
function buildApCard() {
  const old = $('.ap-card'); if (old) old.remove();
  AP.lang = LANG; AP.sig = '';
  const card = document.createElement('div');
  card.className = 'card ap-card';
  card.innerHTML = `<div class="card-h"><span>${esc(t('ap.title'))}</span><span class="muted" id="ap-bpm"></span></div>
    <div class="card-b"><p class="hint" style="margin:0">${esc(t('ap.hint'))}</p>
      <div class="ap-row"><button class="btn big-toggle" id="ap-toggle"></button>
        <label class="switch"><input type="checkbox" id="ap-spot"><span></span>${esc(t('ap.spot'))}</label></div>
      <div class="ap-row"><label class="switch"><input type="checkbox" id="ap-white"><span></span>${esc(t('ap.white'))}</label>
        <label class="switch" title="${esc(t('ap.lasersS'))}"><input type="checkbox" id="ap-lasers"><span></span>${esc(t('ap.lasers'))}</label></div>
      <div class="lbl">${esc(t('ap.style'))}</div>
      <div class="moods" id="ap-moods">${Object.keys(MOOD_IC).map((m) => `<button class="mood" data-mood="${m}"><span class="ic">${MOOD_IC[m]}</span><b>${esc(t(`mood.${m}`))}</b><small>${esc(t(`md.${m}`))}</small></button>`).join('')}</div>
      <div class="lbl">${esc(t('ap.pal'))}</div>
      <div class="palette" id="ap-pal"></div>
      <div class="pal-presets">${Object.entries(PAL_PRESETS).map(([k, cols]) => `<button data-pp="${k}">${cols.map((c) => `<i style="background:rgb(${c.join(',')})"></i>`).join('')} ${esc(t(`pp.${k}`))}</button>`).join('')}</div>
    </div>`;
  const pane = $('.fold-pane[data-f="auto"]');
  if (pane) pane.appendChild(card); else $('.music').prepend(card);
  $('#ap-toggle').onclick = () => send({ type: 'autopilot', on: !(S.st && S.st.effects.autopilot.on) });
  $('#ap-spot').onchange = (e) => send({ type: 'autopilot', spot: e.target.checked });
  $('#ap-white').onchange = (e) => send({ type: 'autopilot', white: e.target.checked });
  $('#ap-lasers').onchange = (e) => send({ type: 'autopilot', lasers: e.target.checked });
  for (const b of $$('#ap-moods .mood')) b.onclick = () => send({ type: 'autopilot', mood: b.dataset.mood });
  for (const b of $$('.pal-presets button', card)) b.onclick = () => send({ type: 'palette', colors: PAL_PRESETS[b.dataset.pp] });
}
function updateAutopilot(st) {
  if (AP.lang !== LANG) buildApCard();
  const ap = st.effects.autopilot || {}, pal = st.effects.palette || [];
  const sig = JSON.stringify([ap, pal, LANG]);
  const beatAge = st.effects.beat_age;
  setText($('#ap-bpm'), ap.on ? (beatAge != null && beatAge < 3 && st.effects.bpm ? t('ap.bpm', { b: Math.round(st.effects.bpm) }) + (ap.mood === 'auto' && ap.now ? ` · ${t('ap.now', { m: t(`mood.${ap.now}`) })}` : '') : t('ap.nomusic')) : '');
  if (sig === AP.sig) return;
  AP.sig = sig;
  const tg = $('#ap-toggle');
  tg.innerHTML = `${ic('auto')}<span>${esc(t(ap.on ? 'ap.on' : 'ap.off'))}</span>`; tg.classList.toggle('on', !!ap.on);
  $('#ap-spot').checked = !!ap.spot;
  $('#ap-white').checked = !!ap.white;
  $('#ap-lasers').checked = ap.lasers !== false;
  for (const b of $$('#ap-moods .mood')) b.classList.toggle('on', b.dataset.mood === ap.mood);
  const box = $('#ap-pal');
  if (box.contains(document.activeElement)) return;
  box.innerHTML = pal.map((c, i) => `<span class="sw"><input type="color" value="${rgbHex(c)}" data-pi="${i}">${pal.length > 1 ? `<button data-px="${i}">✕</button>` : ''}</span>`).join('')
    + (pal.length < 8 ? `<button class="btn sm" id="ap-addc">${esc(t('ap.addc'))}</button>` : '');
  const push = (cols) => send({ type: 'palette', colors: cols });
  for (const inp of $$('[data-pi]', box)) inp.onchange = () => { const cols = pal.map((c) => c.slice()); cols[Number(inp.dataset.pi)] = hexRgb(inp.value); push(cols); };
  for (const b of $$('[data-px]', box)) b.onclick = () => push(pal.filter((_, i) => i !== Number(b.dataset.px)));
  const add = $('#ap-addc', box); if (add) add.onclick = () => push([...pal, hsv2rgb(Math.random() * 360, 1, 1)]);
}

/* ================================================================ init + loop */
async function musicInit() {
  await loadPresets();
  buildPad(); buildTools(); tlPointer(); tlScrubBar(); tlProps(); tlRefreshShows(); muDevices(); buildAutopilot();
  PAD.sig = `${Object.keys(FX.preset.kinds).join('|')}|${LANG}`;
  $('#mu-start').onclick = muStart;
  for (const b of $$('#mu-react button')) b.onclick = () => {
    const r = { ...((S.st && S.st.effects.reactions) || {}) }; r[b.dataset.r] = !r[b.dataset.r];
    send({ type: 'reactions', value: r });
  };
  $('#pad-stop').onclick = () => send({ type: 'fx_stop_all' });
  $('#pad-speed').oninput = (e) => { PAD.speed = Number(e.target.value); };
  $('#pad-size').oninput = (e) => { PAD.size = Number(e.target.value); };
  $('#tl-file').onchange = (e) => { if (e.target.files[0]) tlLoadFile(e.target.files[0]).catch((err) => toast('Nie mogę odczytać pliku: ' + err.message, 'err')); };
  $('#tl-play').onclick = tlPlay;
  $('#tl-stop').onclick = tlStop;
  $('#tl-auto').onclick = openAutoShow;
  playBtn(false);
  $('#tl-clear').onclick = () => { if (TL.cues.length && confirm(tr('Usunąć wszystkie klatki?'))) { snap(); tlStopCues(); TL.cues = []; select([]); } };
  $('#tl-save').onclick = tlSave;
  $('#tl-load').onclick = tlLoad;
  $('#tl-delete').onclick = tlDeleteShow;
  navigator.mediaDevices && navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', muDevices);
  // timing runs on its own clock so a show keeps playing while the window is in the background
  setInterval(() => { muTick(performance.now()); tlTick(); }, 10);
  const loop = () => {
    if (S.tab === 'music') { muDraw(); tlDraw(); }
    if ($('#cr-dialog') && $('#cr-dialog').open) crPadDraw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // texts / buttons follow the state (and the language) even while the window is in the background
  PH.onState.push((st) => { if (S.tab === 'music') { updatePad(st); updateAutopilot(st); } });
}
musicInit();
