/* Lumo — Przewodnik: a short tour that highlights each part of the screen
 * and says what it does and how to use it.  Starts once on the first visit;
 * the  ?  button in the top bar starts it again.  ←/→ or Enter = next, Esc = close.
 */
(() => {
  const PH = window.PH;
  const { S, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);

  const STEPS = [
    { tab: 'scene', sel: '#tabs', ic: 'layers', k: 'tabs' },
    { sel: '#q-spot', ic: 'spot', k: 'spot' },
    { sel: '#q-auto', ic: 'auto', k: 'auto' },
    { sel: '#chain', ic: 'plug', k: 'chain' },
    { tab: 'scene', sel: '#stage3d', ic: 'scene', k: 'stage' },
    { tab: 'scene', sel: '#add-device', ic: 'plus', k: 'add' },
    { sel: '#rail', ic: 'mixer', k: 'rail' },
    { sel: '.dock', ic: 'lamp', k: 'dock' },
    { tab: 'hand', sel: '#mode-tabs', ic: 'hand', k: 'modes' },
    { tab: 'hand', sel: '#hand-stage', ic: 'hand', k: 'hand' },
    { tab: 'mixer', fold: 'desk', sel: '#fold-mixer', ic: 'layers', k: 'folders' },
    { tab: 'mixer', fold: 'desk', sel: '#desk-bank', ic: 'mixer', k: 'bank' },
    { tab: 'mixer', fold: 'desk', sel: '#desk-strips', ic: 'mixer', k: 'desk' },
    { tab: 'mixer', fold: 'looks', sel: '.looks-card', ic: 'sparkle', k: 'looks' },
    { tab: 'music', fold: 'auto', sel: '.ap-card', ic: 'auto', k: 'music' },
    { tab: 'music', fold: 'timeline', sel: '.mu-tl', ic: 'film', k: 'timeline' },
    { tab: 'setup', sel: '#steps', ic: 'setup', k: 'setup' },
    { sel: '#help-btn', ic: 'help', k: 'end' },
  ];
  PH.addI18n({
    pl: {
      'tr.next': 'Dalej', 'tr.back': 'Wstecz', 'tr.done': 'Zaczynamy', 'tr.skip': 'Zamknij',
      'tr.tabs.t': 'Widoki', 'tr.tabs.d': 'Sześć widoków programu: scena 3D, sterowanie dłonią, mikser, kamera sceny, muzyka i ustawienia.', 'tr.tabs.h': 'Kliknij zakładkę. Najedź na nią, żeby zobaczyć, do czego służy.',
      'tr.spot.t': 'Reflektor na osobę', 'tr.spot.d': 'Wszystkie lampy świecą białym, ostrym kołem na osobę i jadą za nią.', 'tr.spot.h': 'Kliknij, żeby włączyć. Dioda świeci, gdy reflektor działa.',
      'tr.auto.t': 'Autopilot', 'tr.auto.d': 'Światła same dopasowują ruch, kolory i jasność do muzyki — na żywo albo z utworu.', 'tr.auto.h': 'Styl i kolory wybierasz w zakładce Muzyka.',
      'tr.chain.t': 'Stan połączeń', 'tr.chain.d': 'Kamera → rozpoznawanie dłoni → kabel DMX → lampy. Zielone = działa, płynące kreski = sygnał idzie dalej.', 'tr.chain.h': 'Kliknij element, żeby przejść do jego ustawień.',
      'tr.stage.t': 'Scena 3D', 'tr.stage.d': 'Wirtualna scena pokazuje dokładnie to, co robią prawdziwe lampy: ruch, kolor, jasność.', 'tr.stage.h': '<b>Przeciągnij</b> lampę = przesuń · <b>Ctrl+klik</b> = zaznacz kilka · <b>dwuklik</b> = profil · <b>prawy przycisk</b> = obróć widok.',
      'tr.add.t': 'Dodaj urządzenie', 'tr.add.d': 'Głowice, PAR-y, belki, strobo, dym, lasery — z biblioteki gotowych profili.', 'tr.add.h': 'Wybierz model, kliknij na scenie, gdzie stoi. Kanały sprawdzisz w Ustawienia → Urządzenia.',
      'tr.rail.t': 'Aktywna lampa', 'tr.rail.d': 'Master całego światła, jasność i ruch wybranej lampy oraz szybkie kolory.', 'tr.rail.h': 'Przeciągnij suwak, kółko myszy = drobno, dwuklik = 0 / max.',
      'tr.dock.t': 'Dolny pasek', 'tr.dock.d': 'Lampy (klik = wybierz, Ctrl+klik = zaznacz kilka), master, dym, lasery i blackout.', 'tr.dock.h': '<b>B</b> = blackout z każdego miejsca. Dym: przytrzymaj albo kliknij = 3 s.',
      'tr.modes.t': 'Tryb sterowania', 'tr.modes.d': 'Gesty dłonią, śledzenie osoby albo ręczne celowanie myszą.', 'tr.modes.h': 'Klawisze: <b>G</b> gesty · <b>T</b> śledzenie · <b>M</b> ręcznie.',
      'tr.hand.t': 'Sterowanie dłonią', 'tr.hand.d': 'Kamera widzi Twoją dłoń i od razu zamienia gest na ruch i kolor światła.', 'tr.hand.h': '<b>Wskaż palcem</b> = celuj · <b>otwarta dłoń</b> góra/dół = jasność · <b>pięść</b> = strobo · <b>OK</b> + obrót = kolor · <b>kciuk</b> = pełne światło.',
      'tr.folders.t': 'Foldery', 'tr.folders.d': 'Duże zakładki są podzielone na foldery. Po lewej wybierasz folder, po prawej jest wszystko, co w nim jest.', 'tr.folders.h': 'Mikser: <b>Pulpit</b>, <b>Sceny świateł</b>, <b>Kolor i pozycja</b>. Muzyka: autopilot, na żywo, efekty, oś czasu, pokazy, moje efekty, zaawansowane.',
      'tr.bank.t': 'Wybór urządzenia', 'tr.bank.d': 'Przełączaj pulpit między wszystkimi urządzeniami naraz a jednym wybranym. Dioda świeci kolorem lampy.', 'tr.bank.h': 'Klik = pokaż tylko to urządzenie i zrób je aktywnym. <b>Wszystkie</b> = cały pulpit.',
      'tr.desk.t': 'Pulpit', 'tr.desk.d': 'Każde urządzenie ma swoją sekcję, a każdy kanał DMX swój suwak z nazwą i opisem. Suwaki same jadą za efektami i gestami.', 'tr.desk.h': '<b>FLASH</b> = pełna wartość, dopóki trzymasz · <b>dwuklik</b> na suwaku = 0 / max · sekcja <b>Wszystkie lampy</b> rusza wszystkim naraz.',
      'tr.looks.t': 'Sceny świateł', 'tr.looks.d': 'Zapisz obecny wygląd wszystkich lamp i przywróć go jednym kliknięciem z płynnym przejściem.', 'tr.looks.h': 'Ustaw lampy → <b>Zapisz obecny wygląd</b> → klik na scenę. Ołówek = nazwa, czas przejścia, kolor.',
      'tr.music.t': 'Autopilot i styl', 'tr.music.d': 'Wybierz styl (spokojny, dynamiczny, taneczny, rave) i kolory pokazu.', 'tr.music.h': 'Muzyka z miksera: „Na żywo” → Start. Albo wczytaj utwór na oś czasu.',
      'tr.timeline.t': 'Oś czasu', 'tr.timeline.d': 'Pokaz ułożony na utworze: klatki przyklejają się do kicków i bitów.', 'tr.timeline.h': 'Wybierz efekt → klik na osi · <b>przeciągnij puste miejsce</b> = zaznacz kilka · <b>Ctrl+C / Ctrl+V / Ctrl+D</b> · <b>Ctrl+Z</b> cofnij · Auto-show układa wszystko sam.',
      'tr.setup.t': 'Ustawienia', 'tr.setup.d': 'Wszystko w jednym miejscu: kabel, urządzenia i ich kanały, kalibracje, kamery, prędkość, przyciski i MIDI.', 'tr.setup.h': 'Zielony znak = gotowe. Pomarańczowy = warto sprawdzić.',
      'tr.end.t': 'Gotowe', 'tr.end.d': 'Pomoc i ten przewodnik są zawsze tutaj.', 'tr.end.h': 'Miłego pokazu!',
    },
    it: {
      'tr.next': 'Avanti', 'tr.back': 'Indietro', 'tr.done': 'Iniziamo', 'tr.skip': 'Chiudi',
      'tr.tabs.t': 'Viste', 'tr.tabs.d': 'Sei viste: palco 3D, controllo con la mano, mixer, camera palco, musica e impostazioni.', 'tr.tabs.h': 'Clicca una scheda. Passaci sopra per vedere a cosa serve.',
      'tr.spot.t': 'Occhio di bue', 'tr.spot.d': 'Tutte le luci illuminano la persona con un cerchio bianco netto e la seguono.', 'tr.spot.h': 'Clicca per accendere. Il LED si accende quando è attivo.',
      'tr.auto.t': 'Autopilota', 'tr.auto.d': 'Le luci adattano da sole movimento, colori e luminosità alla musica.', 'tr.auto.h': 'Stile e colori nella scheda Musica.',
      'tr.chain.t': 'Stato dei collegamenti', 'tr.chain.d': 'Camera → riconoscimento mano → cavo DMX → luci. Verde = funziona, trattini in movimento = il segnale passa.', 'tr.chain.h': 'Clicca un elemento per le sue impostazioni.',
      'tr.stage.t': 'Palco 3D', 'tr.stage.d': 'Il palco virtuale mostra esattamente cosa fanno le luci vere: movimento, colore, luminosità.', 'tr.stage.h': '<b>Trascina</b> una luce = sposta · <b>Ctrl+clic</b> = seleziona più luci · <b>doppio clic</b> = profilo · <b>tasto destro</b> = ruota la vista.',
      'tr.add.t': 'Aggiungi dispositivo', 'tr.add.d': 'Teste mobili, PAR, barre, strobo, fumo, laser — dalla libreria di profili.', 'tr.add.h': 'Scegli il modello e clicca sul palco. I canali si controllano in Impostazioni → Dispositivi.',
      'tr.rail.t': 'Luce attiva', 'tr.rail.d': 'Master generale, luminosità e movimento della luce scelta e colori rapidi.', 'tr.rail.h': 'Trascina il fader, rotella = fine, doppio clic = 0 / max.',
      'tr.dock.t': 'Barra in basso', 'tr.dock.d': 'Luci (clic = scegli, Ctrl+clic = più luci), master, fumo, laser e blackout.', 'tr.dock.h': '<b>B</b> = blackout ovunque. Fumo: tieni premuto o clic = 3 s.',
      'tr.modes.t': 'Modalità di controllo', 'tr.modes.d': 'Gesti con la mano, inseguimento di una persona o puntamento manuale.', 'tr.modes.h': 'Tasti: <b>G</b> gesti · <b>T</b> inseguimento · <b>M</b> manuale.',
      'tr.hand.t': 'Controllo con la mano', 'tr.hand.d': 'La camera vede la tua mano e trasforma subito il gesto in movimento e colore.', 'tr.hand.h': '<b>Indice</b> = punta · <b>mano aperta</b> su/giù = luminosità · <b>pugno</b> = strobo · <b>OK</b> + rotazione = colore · <b>pollice</b> = luce piena.',
      'tr.folders.t': 'Cartelle', 'tr.folders.d': 'Le schede grandi sono divise in cartelle. A sinistra scegli la cartella, a destra c’è tutto quello che contiene.', 'tr.folders.h': 'Mixer: <b>Banco</b>, <b>Scene luci</b>, <b>Colore e posizione</b>. Musica: autopilota, dal vivo, effetti, timeline, show, i miei effetti, avanzate.',
      'tr.bank.t': 'Scelta dispositivo', 'tr.bank.d': 'Passa il banco da tutti i dispositivi insieme a uno solo. Il LED ha il colore della luce.', 'tr.bank.h': 'Clic = mostra solo questo dispositivo e rendilo attivo. <b>Tutti</b> = banco completo.',
      'tr.desk.t': 'Banco', 'tr.desk.d': 'Ogni dispositivo ha la sua sezione e ogni canale DMX il suo fader con nome e descrizione. I fader seguono effetti e gesti.', 'tr.desk.h': '<b>FLASH</b> = valore pieno finché tieni premuto · <b>doppio clic</b> sul fader = 0 / max · la sezione <b>Tutte le luci</b> muove tutto insieme.',
      'tr.looks.t': 'Scene luci', 'tr.looks.d': 'Salva l’aspetto attuale di tutte le luci e richiamalo con un clic e una transizione morbida.', 'tr.looks.h': 'Imposta le luci → <b>Salva l’aspetto attuale</b> → clic sulla scena. Matita = nome, transizione, colore.',
      'tr.music.t': 'Autopilota e stile', 'tr.music.d': 'Scegli lo stile (calmo, dinamico, ballo, rave) e i colori dello show.', 'tr.music.h': 'Musica dal mixer: „Dal vivo” → Start. Oppure carica un brano nella timeline.',
      'tr.timeline.t': 'Timeline', 'tr.timeline.d': 'Lo show sul brano: i keyframe si agganciano a kick e beat.', 'tr.timeline.h': 'Scegli un effetto → clic sulla timeline · <b>trascina lo spazio vuoto</b> = seleziona più keyframe · <b>Ctrl+C / Ctrl+V / Ctrl+D</b> · <b>Ctrl+Z</b> annulla · Auto-show fa tutto da solo.',
      'tr.setup.t': 'Impostazioni', 'tr.setup.d': 'Tutto in un posto: cavo, dispositivi e canali, calibrazioni, camere, velocità, tasti e MIDI.', 'tr.setup.h': 'Segno verde = pronto. Arancione = da controllare.',
      'tr.end.t': 'Fatto', 'tr.end.d': 'L’aiuto e questa guida sono sempre qui.', 'tr.end.h': 'Buono show!',
    },
  });

  const T = { i: -1, shade: null, card: null, block: null };
  function close() {
    for (const el of [T.shade, T.card, T.block]) if (el) el.remove();
    T.shade = T.card = T.block = null; T.i = -1;
    try { localStorage.setItem('ph_tour3', '1'); } catch (e) { /* private mode */ }
  }
  function place() {
    if (T.i < 0) return;
    const st = STEPS[T.i], el = $(st.sel);
    if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(T.shade.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const cw = 340, ch = T.card.offsetHeight || 220, vw = innerWidth, vh = innerHeight;
    let top = r.bottom + 16, left = r.left + r.width / 2 - cw / 2;
    if (top + ch > vh - 10) top = r.top - ch - 16;
    if (top < 10) { top = Math.min(vh - ch - 10, r.top + 20); left = r.right + 16 > vw - cw ? r.left - cw - 16 : r.right + 16; }
    T.card.style.left = `${Math.max(10, Math.min(vw - cw - 10, left))}px`;
    T.card.style.top = `${Math.max(10, Math.min(vh - ch - 10, top))}px`;
  }
  function show(i) {
    T.i = Math.max(0, Math.min(STEPS.length - 1, i));
    const st = STEPS[T.i];
    if (st.tab && S.tab !== st.tab) PH.setTab(st.tab);
    if (st.fold && PH.foldGo) PH.foldGo(st.tab, st.fold);
    if (!T.shade) {
      T.block = document.createElement('div'); T.block.className = 'tour-block';
      T.shade = document.createElement('div'); T.shade.className = 'tour-shade';
      T.card = document.createElement('div'); T.card.className = 'tour-card';
      document.body.append(T.block, T.shade, T.card);
    }
    const last = T.i === STEPS.length - 1;
    T.card.innerHTML = `<h4>${ic(st.ic)}${esc(t(`tr.${st.k}.t`))}</h4><p>${esc(t(`tr.${st.k}.d`))}</p>
      <div class="how">${t(`tr.${st.k}.h`)}</div>
      <div class="tour-foot"><div class="tour-dots">${STEPS.map((_, j) => `<i class="${j === T.i ? 'on' : ''}"></i>`).join('')}</div>
        ${T.i ? `<button class="btn sm" id="tr-back">${esc(t('tr.back'))}</button>` : `<button class="btn sm" id="tr-skip">${esc(t('tr.skip'))}</button>`}
        <button class="btn sm primary" id="tr-next">${esc(t(last ? 'tr.done' : 'tr.next'))}</button></div>`;
    T.card.style.animation = 'none'; void T.card.offsetWidth; T.card.style.animation = '';
    $('#tr-next').onclick = () => (last ? close() : show(T.i + 1));
    const back = $('#tr-back'); if (back) back.onclick = () => show(T.i - 1);
    const skip = $('#tr-skip'); if (skip) skip.onclick = close;
    setTimeout(place, 30); setTimeout(place, 320);
  }
  PH.startTour = () => show(0);
  $('#tour-btn').onclick = () => PH.startTour();
  window.addEventListener('resize', place);
  window.addEventListener('keydown', (e) => {
    if (T.i < 0) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); if (T.i === STEPS.length - 1) close(); else show(T.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(T.i - 1); }
    e.stopImmediatePropagation();
  }, true);
  let first = false;
  try { first = !localStorage.getItem('ph_tour3'); } catch (e) { /* ignore */ }
  if (first) setTimeout(() => { if (S.st && T.i < 0) PH.startTour(); }, 1800);
})();
