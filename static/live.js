/* Lumo — Pokaz: one button, the AI listens and the lights play in time.
 *
 * Audio:  input (mixer / line-in / microphone) → AudioWorklet (beatcore.js + beatworklet.js)
 *         → grid / onset / section / level events → server (rhythm.py clock, effects, director.py)
 *         → 16 kHz PCM (binary frames) → server music AI (musicai.py, YAMNet, optional song title)
 * Screen: beat ring, what is playing, song map, the light look now (with a live rig preview),
 *         show styles, morph / energy / colours, quick pads, light sync and a one-minute
 *         calibration of every light.
 * Uses PH (app.js), ic (icons.js), BeatCore (beatcore.js, fallback path only).
 */
'use strict';
(() => {
  const PH = window.PH;
  const { S, send, t, esc, toast } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const L = () => (PH.lang === 'it' ? 1 : 0);
  const clamp = PH.clamp;

  PH.addI18n({
    pl: {
      'tab.show': 'Pokaz', 'pg.show': 'Pokaz na żywo — Lumo słucha muzyki i prowadzi światła',
      'sh.start': 'Start pokazu', 'sh.startS': 'słuchaj muzyki i świeć', 'sh.stop': 'Zakończ pokaz', 'sh.stopS': 'światła wrócą do spokoju',
      'sh.src': 'Źródło dźwięku', 'sh.input': 'Wejście audio {n}', 'sh.noInput': 'brak wejść audio', 'sh.noAccess': 'brak dostępu do audio',
      'sh.wait': 'czekam na rytm', 'sh.locked': 'w rytmie', 'sh.free': 'trzymam rytm', 'sh.off': 'wyłączone',
      'sh.nowPlaying': 'Teraz gra', 'sh.listening': 'Słucham…', 'sh.idleT': 'Włącz muzykę', 'sh.idleS': 'Lumo usłyszy rytm, rozpozna styl utworu i sam poprowadzi światła — kinowo, koncertowo albo klubowo.',
      'sh.aiOn': 'AI słucha', 'sh.aiLoad': 'AI: wczytuję model', 'sh.aiErr': 'AI niedostępne', 'sh.aiOff': 'AI wyłączone', 'sh.vocals': 'wokal', 'sh.crowd': 'publiczność',
      'sh.energy': 'Energia', 'sh.onStage': 'Teraz na scenie', 'sh.nextLook': 'Następny wygląd', 'sh.freeze': 'Zatrzymaj wygląd', 'sh.unfreeze': 'Wznów zmiany',
      'sh.nextIn': 'zmiana za {n} bit.', 'sh.frozen': 'wygląd zatrzymany', 'sh.style': 'Styl pokazu', 'sh.tune': 'Charakter pokazu', 'sh.pads': 'Szybkie akcje',
      'sh.morph': 'Płynność przejść', 'sh.morphL': 'ostre cięcia', 'sh.morphR': 'długie morfingi',
      'sh.int': 'Energia świateł', 'sh.intL': 'spokojniej', 'sh.intR': 'mocniej',
      'sh.colors': 'Kolory', 'sh.colAi': 'Dobiera AI', 'sh.colMine': 'Moja paleta', 'sh.strobe': 'Strobo na dropach', 'sh.white': 'Tylko białe światło',
      'sh.lasers': 'Lasery w szybkich fragmentach', 'sh.spot': 'Czasem reflektor na osobę',
      'sh.blinder': 'Blinder', 'sh.blinderS': 'biały błysk', 'sh.strobeHold': 'Strobo', 'sh.strobeHoldS': 'przytrzymaj', 'sh.blackout': 'Blackout', 'sh.blackoutS': 'wszystko gaśnie',
      'sh.smoke': 'Dym', 'sh.smokeS': 'przytrzymaj', 'sh.spotPad': 'Reflektor', 'sh.spotPadS': 'na osobę',
      'sh.sync': 'Synchronizacja', 'sh.cal': 'Kalibracja świateł', 'sh.ai': 'Rozpoznawanie utworu',
      'sh.why.start': 'Pierwszy wygląd dla tego utworu', 'sh.why.phrase': 'Nowa fraza — nowy wygląd', 'sh.why.song': 'Nowy utwór — nowy pomysł',
      'sh.why.drop': 'Drop! Blinder i mocne wejście', 'sh.why.build': 'Narastanie — światła wspinają się do dropu', 'sh.why.breakdown': 'Wyciszenie — moment jak w kinie',
      'sh.why.quiet': 'Cicho — światło odpoczywa', 'sh.why.outro': 'Koniec utworu — wyciszam', 'sh.why.manual': 'Twój wybór', 'sh.why.style': 'Nowy styl',
      'sh.why.chorus': 'Refren — pełna energia', 'sh.why.verse': 'Zwrotka', 'sh.why.intro': 'Początek utworu',
      'sec.intro': 'Intro', 'sec.verse': 'Zwrotka', 'sec.chorus': 'Refren', 'sec.build': 'Narastanie', 'sec.drop': 'Drop', 'sec.breakdown': 'Wyciszenie', 'sec.quiet': 'Cisza', 'sec.outro': 'Outro',
      'fl.auto': 'Auto AI', 'fl.autoS': 'Słucha i sam dobiera styl do utworu', 'fl.cinema': 'Kino', 'fl.cinemaS': 'Długie morfingi, światło jak w filmie',
      'fl.concert': 'Koncert', 'fl.concertS': 'Ballyhoo, wachlarze, blindery', 'fl.club': 'Klub', 'fl.clubS': 'Pościgi w bit, strobo na dropach',
      'fl.chill': 'Chill', 'fl.chillS': 'Spokojny oddech, płynne kolory', 'fl.elegant': 'Elegancja', 'fl.elegantS': 'Ciepłe złoto, świece, gwiazdy',
      'fl.rave': 'Rave', 'fl.raveS': 'Najmocniej: stutter i burza strobo', 'fl.now': 'teraz: {f}',
      'sy.title': 'Synchronizacja światła z muzyką', 'sy.lead': 'Lampy i kabel DMX reagują z małym opóźnieniem. Puść muzykę z wyraźnym bitem: światła błyskają teraz na każde uderzenie. Przesuwaj, aż błysk i stopa perkusji będą w tym samym momencie.',
      'sy.earlier': 'Światło wcześniej', 'sy.later': 'Światło później', 'sy.ms': '{n} ms przed dźwiękiem', 'sy.msNeg': '{n} ms po dźwięku', 'sy.reset': 'Domyślnie (40 ms)',
      'sy.noMusic': 'Najpierw kliknij „Start pokazu” i puść muzykę — bez rytmu nie ma czego wyrównać.', 'sy.done': 'Gotowe', 'sy.beat': 'bit',
      'ai.title': 'Rozpoznawanie utworu', 'ai.lead': 'Gatunek, nastrój, wokal i instrumenty rozpoznaje lokalny model AI (Google YAMNet) — offline, za darmo. Tytuł i wykonawcę zna tylko serwis w internecie: z kluczem AudD Lumo wysyła 8 sekund nowego utworu do api.audd.io.',
      'ai.listen': 'Lokalna analiza AI (offline)', 'ai.recog': 'Rozpoznawaj tytuł (internet)', 'ai.key': 'Klucz AudD (api_token)', 'ai.keyPh': 'wklej klucz z dashboard.audd.io',
      'ai.keySaved': 'Klucz zapisany na tym komputerze', 'ai.getKey': 'Darmowy klucz: dashboard.audd.io', 'ai.save': 'Zapisz', 'ai.status': 'Stan: {s}',
      'ai.st.ok': 'rozpoznano', 'ai.st.unknown': 'nie znaleziono utworu', 'ai.st.asking': 'pytam serwis…',
      'cal.title': 'Kalibracja świateł', 'cal.lead': 'Minuta na lampę: znajdziemy każdą lampę, ustawimy środek parkietu, sprawdzimy kierunki i kolory. Pokaz zatrzyma się na ten czas.',
      'cal.start': 'Zaczynamy', 'cal.lamp': 'Lampa {i} z {n}', 'cal.find': 'Czy ta lampa świeci teraz na biało?', 'cal.findS': 'Pozostałe lampy są wygaszone.',
      'cal.yes': 'Tak', 'cal.no': 'Nie świeci', 'cal.noHint': 'Sprawdź kabel DMX, adres na wyświetlaczu lampy ({a}) i tryb kanałów. Możesz ją pominąć i wrócić później.',
      'cal.center': 'Skieruj światło na środek parkietu', 'cal.centerS': 'Przeciągaj po polu albo używaj strzałek (Shift = dokładnie). Wokół tego punktu będzie się toczył pokaz.',
      'cal.saveCenter': 'To jest środek', 'cal.right': 'Czy światło przesunęło się w PRAWO?', 'cal.rightS': 'Patrz od strony publiczności.',
      'cal.up': 'Czy światło podniosło się W GÓRĘ?', 'cal.upS': 'W stronę publiczności / nad głowy.', 'cal.wrong': 'Nie, w drugą stronę', 'cal.fixed': 'Poprawione — sprawdź jeszcze raz',
      'cal.color': 'Czy kolory zgadzają się z napisem?', 'cal.colorS': 'Lampa zmienia kolor: czerwony → zielony → niebieski.', 'cal.colorNo': 'Kolory się nie zgadzają',
      'cal.colorHint': 'Kanały koloru są w innej kolejności — popraw je w Ustawienia → Moje lampy → Edytuj profil.',
      'cal.shut': 'Szukam ustawienia, przy którym lampa świeci', 'cal.shutS': 'Tanie głowice często świecą dopiero przy konkretnej wartości „migawki” (shutter). Sprawdzam po kolei — kliknij, gdy tylko lampa zaświeci.',
      'cal.try': 'Próba {i} z {n}', 'cal.lit': 'Teraz świeci!', 'cal.litOk': 'Zapamiętane — lampa świeci (migawka = {v})',
      'cal.shutNone': 'Żadne ustawienie migawki nie zapaliło lampy. Najczęściej: zły adres na wyświetlaczu lampy, lampa w trybie Sound/Auto zamiast DMX albo inny układ kanałów niż w profilu.',
      'cal.channels': 'Rozpoznaj kanały krok po kroku', 'cal.again': 'Sprawdź jeszcze raz',
      'cal.skip': 'Pomiń lampę', 'cal.back': 'Wstecz', 'cal.done': 'Wszystkie lampy gotowe', 'cal.doneS': 'Pokaz będzie krążył wokół środka parkietu, a kierunki są prawidłowe.',
      'cal.toSync': 'Teraz synchronizacja z muzyką', 'cal.close': 'Zamknij', 'cal.none': 'Nie ma jeszcze lamp — dodaj je w Ustawieniach.',
      'c.red': 'czerwony', 'c.green': 'zielony', 'c.blue': 'niebieski',
      'nx.title': 'Co dalej?', 'nx.allDone': 'Wszystko gotowe — miłego pokazu!', 'nx.hide': 'Ukryj', 'nx.show': 'Pokaż kroki',
      'nx.cable': 'Kabel DMX', 'nx.cableOk': 'podłączony', 'nx.cableTodo': 'podłącz kabel USB-DMX', 'nx.cableSkip': 'bez kabla — podgląd na ekranie',
      'nx.cableGo': 'Sprawdź kabel', 'nx.cableNo': 'Gram bez kabla',
      'nx.lamps': 'Lampy', 'nx.lampsOk': '{n} lamp', 'nx.lampsTodo': 'dodaj swoje lampy', 'nx.lampsGo': 'Dodaj lampy',
      'nx.cal': 'Kalibracja', 'nx.calOk': 'gotowa', 'nx.calTodo': 'minuta na lampę', 'nx.calGo': 'Kalibruj światła', 'nx.calNone': 'nie trzeba',
      'nx.music': 'Muzyka', 'nx.musicOk': 'w rytmie · {b} BPM', 'nx.musicTodo': 'puść muzykę i kliknij Start', 'nx.musicGo': 'Start pokazu', 'nx.musicWait': 'słucham…',
      'nx.sync': 'Synchronizacja', 'nx.syncOk': 'ustawiona', 'nx.syncTodo': 'błysk równo z bitem', 'nx.syncGo': 'Ustaw',
      'sh.more': 'Więcej opcji pokazu', 'sh.moreS': 'płynność, energia, kolory, strobo, lasery',
      'hm.quickcal': 'Szybka kalibracja wszystkich świateł', 'hm.quickcalS': 'Minuta na lampę: znajdziemy lampę, ustawimy środek parkietu, sprawdzimy kierunki i kolory',
      'sh.micErr': 'Nie mogę otworzyć wejścia audio: {e}', 'sh.started': 'Pokaz ruszył — Lumo słucha muzyki', 'sh.stopped': 'Pokaz zakończony',
    },
    it: {
      'tab.show': 'Show', 'pg.show': 'Show dal vivo — Lumo ascolta la musica e guida le luci',
      'sh.start': 'Avvia lo show', 'sh.startS': 'ascolta la musica e illumina', 'sh.stop': 'Termina lo show', 'sh.stopS': 'le luci tornano calme',
      'sh.src': 'Sorgente audio', 'sh.input': 'Ingresso audio {n}', 'sh.noInput': 'nessun ingresso audio', 'sh.noAccess': 'nessun accesso all’audio',
      'sh.wait': 'aspetto il ritmo', 'sh.locked': 'a tempo', 'sh.free': 'tengo il ritmo', 'sh.off': 'spento',
      'sh.nowPlaying': 'In riproduzione', 'sh.listening': 'Ascolto…', 'sh.idleT': 'Fai partire la musica', 'sh.idleS': 'Lumo sente il ritmo, riconosce lo stile del brano e guida le luci da solo — come al cinema, a un concerto o in un club.',
      'sh.aiOn': 'L’AI ascolta', 'sh.aiLoad': 'AI: carico il modello', 'sh.aiErr': 'AI non disponibile', 'sh.aiOff': 'AI spenta', 'sh.vocals': 'voce', 'sh.crowd': 'pubblico',
      'sh.energy': 'Energia', 'sh.onStage': 'Ora sul palco', 'sh.nextLook': 'Prossimo look', 'sh.freeze': 'Blocca il look', 'sh.unfreeze': 'Riprendi i cambi',
      'sh.nextIn': 'cambio tra {n} beat', 'sh.frozen': 'look bloccato', 'sh.style': 'Stile dello show', 'sh.tune': 'Carattere dello show', 'sh.pads': 'Azioni rapide',
      'sh.morph': 'Fluidità dei passaggi', 'sh.morphL': 'tagli netti', 'sh.morphR': 'morph lunghi',
      'sh.int': 'Energia delle luci', 'sh.intL': 'più calmo', 'sh.intR': 'più forte',
      'sh.colors': 'Colori', 'sh.colAi': 'Li sceglie l’AI', 'sh.colMine': 'La mia palette', 'sh.strobe': 'Strobo sui drop', 'sh.white': 'Solo luce bianca',
      'sh.lasers': 'Laser nelle parti veloci', 'sh.spot': 'A volte occhio di bue sulla persona',
      'sh.blinder': 'Blinder', 'sh.blinderS': 'lampo bianco', 'sh.strobeHold': 'Strobo', 'sh.strobeHoldS': 'tieni premuto', 'sh.blackout': 'Blackout', 'sh.blackoutS': 'tutto si spegne',
      'sh.smoke': 'Fumo', 'sh.smokeS': 'tieni premuto', 'sh.spotPad': 'Occhio di bue', 'sh.spotPadS': 'sulla persona',
      'sh.sync': 'Sincronizzazione', 'sh.cal': 'Calibrazione luci', 'sh.ai': 'Riconoscimento brano',
      'sh.why.start': 'Primo look per questo brano', 'sh.why.phrase': 'Nuova frase — nuovo look', 'sh.why.song': 'Nuovo brano — nuova idea',
      'sh.why.drop': 'Drop! Blinder e ingresso forte', 'sh.why.build': 'Crescendo — le luci salgono verso il drop', 'sh.why.breakdown': 'Pausa — un momento da cinema',
      'sh.why.quiet': 'Silenzio — la luce riposa', 'sh.why.outro': 'Fine del brano — sfumo', 'sh.why.manual': 'Scelta tua', 'sh.why.style': 'Nuovo stile',
      'sh.why.chorus': 'Ritornello — piena energia', 'sh.why.verse': 'Strofa', 'sh.why.intro': 'Inizio del brano',
      'sec.intro': 'Intro', 'sec.verse': 'Strofa', 'sec.chorus': 'Ritornello', 'sec.build': 'Crescendo', 'sec.drop': 'Drop', 'sec.breakdown': 'Pausa', 'sec.quiet': 'Silenzio', 'sec.outro': 'Outro',
      'fl.auto': 'Auto AI', 'fl.autoS': 'Ascolta e sceglie lo stile del brano', 'fl.cinema': 'Cinema', 'fl.cinemaS': 'Morph lunghi, luce da film',
      'fl.concert': 'Concerto', 'fl.concertS': 'Ballyhoo, ventagli, blinder', 'fl.club': 'Club', 'fl.clubS': 'Inseguimenti a tempo, strobo sui drop',
      'fl.chill': 'Chill', 'fl.chillS': 'Respiro calmo, colori morbidi', 'fl.elegant': 'Eleganza', 'fl.elegantS': 'Oro caldo, candele, stelle',
      'fl.rave': 'Rave', 'fl.raveS': 'Il massimo: stutter e tempesta di strobo', 'fl.now': 'ora: {f}',
      'sy.title': 'Sincronizzare la luce con la musica', 'sy.lead': 'Le luci e il cavo DMX reagiscono con un piccolo ritardo. Fai partire musica con un beat chiaro: ora le luci lampeggiano su ogni colpo. Sposta finché il lampo e la cassa cadono nello stesso istante.',
      'sy.earlier': 'Luce prima', 'sy.later': 'Luce dopo', 'sy.ms': '{n} ms prima del suono', 'sy.msNeg': '{n} ms dopo il suono', 'sy.reset': 'Predefinito (40 ms)',
      'sy.noMusic': 'Prima clicca „Avvia lo show” e fai partire la musica — senza ritmo non c’è niente da allineare.', 'sy.done': 'Fatto', 'sy.beat': 'beat',
      'ai.title': 'Riconoscimento del brano', 'ai.lead': 'Genere, umore, voce e strumenti li riconosce un modello AI locale (Google YAMNet) — offline e gratis. Titolo e artista li conosce solo un servizio in internet: con una chiave AudD, Lumo invia 8 secondi del nuovo brano ad api.audd.io.',
      'ai.listen': 'Analisi AI locale (offline)', 'ai.recog': 'Riconosci il titolo (internet)', 'ai.key': 'Chiave AudD (api_token)', 'ai.keyPh': 'incolla la chiave da dashboard.audd.io',
      'ai.keySaved': 'Chiave salvata su questo computer', 'ai.getKey': 'Chiave gratuita: dashboard.audd.io', 'ai.save': 'Salva', 'ai.status': 'Stato: {s}',
      'ai.st.ok': 'riconosciuto', 'ai.st.unknown': 'brano non trovato', 'ai.st.asking': 'chiedo al servizio…',
      'cal.title': 'Calibrazione luci', 'cal.lead': 'Un minuto per luce: troviamo ogni luce, fissiamo il centro della pista, controlliamo direzioni e colori. Lo show si ferma nel frattempo.',
      'cal.start': 'Iniziamo', 'cal.lamp': 'Luce {i} di {n}', 'cal.find': 'Questa luce ora è accesa in bianco?', 'cal.findS': 'Le altre luci sono spente.',
      'cal.yes': 'Sì', 'cal.no': 'Non si accende', 'cal.noHint': 'Controlla il cavo DMX, l’indirizzo sul display della luce ({a}) e la modalità canali. Puoi saltarla e tornarci dopo.',
      'cal.center': 'Punta la luce al centro della pista', 'cal.centerS': 'Trascina sul riquadro o usa le frecce (Maiusc = fine). Lo show girerà attorno a questo punto.',
      'cal.saveCenter': 'Questo è il centro', 'cal.right': 'La luce si è spostata a DESTRA?', 'cal.rightS': 'Guarda dal lato del pubblico.',
      'cal.up': 'La luce si è alzata IN ALTO?', 'cal.upS': 'Verso il pubblico / sopra le teste.', 'cal.wrong': 'No, dall’altra parte', 'cal.fixed': 'Corretto — controlla di nuovo',
      'cal.color': 'I colori corrispondono alla scritta?', 'cal.colorS': 'La luce cambia colore: rosso → verde → blu.', 'cal.colorNo': 'I colori non corrispondono',
      'cal.colorHint': 'I canali colore sono in un altro ordine — correggili in Impostazioni → Le mie luci → Modifica profilo.',
      'cal.shut': 'Cerco l’impostazione con cui la luce si accende', 'cal.shutS': 'Le teste economiche spesso si accendono solo con un valore preciso dello „shutter”. Provo uno dopo l’altro — clicca appena la luce si accende.',
      'cal.try': 'Prova {i} di {n}', 'cal.lit': 'Ora si accende!', 'cal.litOk': 'Memorizzato — la luce si accende (shutter = {v})',
      'cal.shutNone': 'Nessuna impostazione dello shutter ha acceso la luce. Di solito: indirizzo sbagliato sul display, luce in modalità Sound/Auto invece di DMX o canali diversi dal profilo.',
      'cal.channels': 'Riconosci i canali passo passo', 'cal.again': 'Riprova',
      'cal.skip': 'Salta la luce', 'cal.back': 'Indietro', 'cal.done': 'Tutte le luci pronte', 'cal.doneS': 'Lo show girerà attorno al centro della pista e le direzioni sono corrette.',
      'cal.toSync': 'Ora la sincronizzazione con la musica', 'cal.close': 'Chiudi', 'cal.none': 'Non ci sono ancora luci — aggiungile nelle Impostazioni.',
      'c.red': 'rosso', 'c.green': 'verde', 'c.blue': 'blu',
      'nx.title': 'E adesso?', 'nx.allDone': 'Tutto pronto — buono show!', 'nx.hide': 'Nascondi', 'nx.show': 'Mostra i passi',
      'nx.cable': 'Cavo DMX', 'nx.cableOk': 'collegato', 'nx.cableTodo': 'collega il cavo USB-DMX', 'nx.cableSkip': 'senza cavo — anteprima a schermo',
      'nx.cableGo': 'Controlla il cavo', 'nx.cableNo': 'Suono senza cavo',
      'nx.lamps': 'Luci', 'nx.lampsOk': '{n} luci', 'nx.lampsTodo': 'aggiungi le tue luci', 'nx.lampsGo': 'Aggiungi luci',
      'nx.cal': 'Calibrazione', 'nx.calOk': 'pronta', 'nx.calTodo': 'un minuto per luce', 'nx.calGo': 'Calibra le luci', 'nx.calNone': 'non serve',
      'nx.music': 'Musica', 'nx.musicOk': 'a tempo · {b} BPM', 'nx.musicTodo': 'fai partire la musica e clicca Avvia', 'nx.musicGo': 'Avvia lo show', 'nx.musicWait': 'ascolto…',
      'nx.sync': 'Sincronizzazione', 'nx.syncOk': 'impostata', 'nx.syncTodo': 'il lampo insieme al beat', 'nx.syncGo': 'Imposta',
      'sh.more': 'Altre opzioni dello show', 'sh.moreS': 'fluidità, energia, colori, strobo, laser',
      'hm.quickcal': 'Calibrazione rapida di tutte le luci', 'hm.quickcalS': 'Un minuto per luce: troviamo la luce, fissiamo il centro della pista, controlliamo direzioni e colori',
      'sh.micErr': 'Non riesco ad aprire l’ingresso audio: {e}', 'sh.started': 'Lo show è partito — Lumo ascolta la musica', 'sh.stopped': 'Show terminato',
    },
  });

  const FLAVORS = ['auto', 'cinema', 'concert', 'club', 'chill', 'elegant', 'rave'];
  const FL_ICON = { auto: 'sparkle', cinema: 'film', concert: 'spot', club: 'pulse', chill: 'moon', elegant: 'diamond', rave: 'bolt' };
  const SEC_COLOR = { intro: '#b9c0d4', verse: '#8b93ff', chorus: '#6d4aff', build: '#f2a33a', drop: '#f0445a', breakdown: '#2bb7c9', quiet: '#d7d9e4', outro: '#b9c0d4' };

  /* ================================================================ audio engine */
  const LIVE = {
    ctx: null, stream: null, node: null, an: null, sink: null, proc: null, core: null,
    running: false, bpm: null, conf: 0, inBar: 0, beatAt: 0, period: 500, flash: 0, level: 0,
    bands: { low: 0, mid: 0, high: 0 }, section: '', energy: 0, map: [], inLatency: 0.02, lastLevelSent: 0,
    locked: false, lastGrid: 0,
  };
  PH.live = LIVE;

  async function listInputs(sel) {
    if (!sel) return;
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
      const cur = sel.value || localStorage.getItem('ph_audio_dev') || '';
      sel.innerHTML = devs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || t('sh.input', { n: i + 1 }))}</option>`).join('')
        || `<option value="">${esc(t('sh.noInput'))}</option>`;
      if (cur && devs.some((d) => d.deviceId === cur)) sel.value = cur;
    } catch (e) { sel.innerHTML = `<option value="">${esc(t('sh.noAccess'))}</option>`; }
  }
  LIVE.listInputs = listInputs;

  function sendBin(int16) {
    const ws = S.ws;
    if (!ws || ws.readyState !== 1 || ws.bufferedAmount > 1e6) return;
    const out = new Uint8Array(4 + int16.byteLength);
    out.set([76, 77, 65, 49]);                                   // "LMA1"
    out.set(new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength), 4);
    ws.send(out.buffer);
  }

  function onEvent(e) {
    const now = performance.now();
    switch (e.type) {
      case 'grid': {
        // the worklet's "next beat" counts from the newest sample; that sample left the speaker a little earlier
        const sent = e.at != null && LIVE.ctx ? Math.max(0, LIVE.ctx.currentTime - e.at) : 0;   // worklet → page delay
        const lead = e.nextIn - LIVE.inLatency - sent;
        LIVE.bpm = e.bpm; LIVE.conf = e.conf; LIVE.period = 60000 / e.bpm; LIVE.locked = true; LIVE.lastGrid = now;
        send({ type: 'grid', bpm: e.bpm, next_in: lead, beat_in_bar: e.beatInBar, confidence: e.conf, source: 'live' });
        break;
      }
      case 'beat':
        LIVE.beatAt = now - LIVE.inLatency * 1000; LIVE.inBar = e.inBar; LIVE.flash = 1; LIVE.period = 60000 / e.bpm;
        pulseBeat(e.inBar);
        break;
      case 'onset':
        send({ type: 'onset', strength: e.strength });
        break;
      case 'level':
        LIVE.level = e.rms; LIVE.bands = { low: e.low, mid: e.mid, high: e.high };
        if (now - LIVE.lastLevelSent > 100) {
          LIVE.lastLevelSent = now;
          send({ type: 'audio_level', level: e.abs < 0.0025 ? 0 : e.rms });
        }
        break;
      case 'section':
        LIVE.energy = e.energy;
        if (e.changed || e.name !== LIVE.section) {
          LIVE.section = e.name;
          LIVE.map.push({ name: e.name, t: now });
          if (LIVE.map.length > 24) LIVE.map.shift();
        }
        send({ type: 'section', name: e.name, energy: e.energy });
        break;
      case 'grid_off':
        LIVE.locked = false; LIVE.bpm = null;
        send({ type: 'grid_off' });
        break;
      case 'pcm':
        if (!S.st || !S.st.music_ai || S.st.music_ai.listen !== false) sendBin(e.data);
        break;
      default:
    }
  }

  async function start(devId) {
    if (LIVE.running) return true;
    try {
      const id = devId != null ? devId : (($('#sh-dev') && $('#sh-dev').value) || localStorage.getItem('ph_audio_dev') || '');
      LIVE.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0 } });
      const tr = LIVE.stream.getAudioTracks()[0];
      const st = tr && tr.getSettings ? tr.getSettings() : {};
      LIVE.inLatency = clamp(Number(st.latency) || 0.02, 0, 0.2);
      if (st.deviceId) { try { localStorage.setItem('ph_audio_dev', st.deviceId); } catch (err) { /* private */ } }
      tr.onended = () => { if (LIVE.running) stop(); };
      LIVE.ctx = new AudioContext({ latencyHint: 'interactive' });
      const src = LIVE.ctx.createMediaStreamSource(LIVE.stream);
      LIVE.an = LIVE.ctx.createAnalyser(); LIVE.an.fftSize = 2048; LIVE.an.smoothingTimeConstant = 0.6;
      src.connect(LIVE.an);
      LIVE.sink = LIVE.ctx.createGain(); LIVE.sink.gain.value = 0;
      LIVE.sink.connect(LIVE.ctx.destination);                 // keeps the graph pulled; silent
      try {
        await LIVE.ctx.audioWorklet.addModule('/static/beatcore.js?v=5.0');
        await LIVE.ctx.audioWorklet.addModule('/static/beatworklet.js?v=5.0');
        LIVE.node = new AudioWorkletNode(LIVE.ctx, 'lumo-beat', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        LIVE.node.port.onmessage = (ev) => onEvent(ev.data);
        src.connect(LIVE.node); LIVE.node.connect(LIVE.sink);
      } catch (err) {                                          // old browser: same tracker on the page
        console.warn('AudioWorklet unavailable, using ScriptProcessor', err);
        LIVE.core = new window.BeatCore(LIVE.ctx.sampleRate, onEvent);
        LIVE.proc = LIVE.ctx.createScriptProcessor(1024, 1, 1);
        LIVE.proc.onaudioprocess = (ev) => LIVE.core.process(ev.inputBuffer.getChannelData(0));
        src.connect(LIVE.proc); LIVE.proc.connect(LIVE.sink);
      }
      await LIVE.ctx.resume();
      LIVE.running = true; LIVE.map = []; LIVE.section = '';
      listInputs($('#sh-dev')); listInputs($('#mu-dev'));
      return true;
    } catch (e) {
      stop();
      toast(t('sh.micErr', { e: e.message || e.name }), 'err');
      return false;
    }
  }
  function stop() {
    const was = LIVE.running;
    LIVE.running = false; LIVE.locked = false; LIVE.bpm = null; LIVE.level = 0;
    if (LIVE.stream) LIVE.stream.getTracks().forEach((tr) => tr.stop());
    if (LIVE.node) LIVE.node.port.onmessage = null;
    if (LIVE.ctx) LIVE.ctx.close();
    LIVE.ctx = LIVE.stream = LIVE.node = LIVE.an = LIVE.proc = LIVE.core = LIVE.sink = null;
    if (was) { send({ type: 'audio_level', level: 0 }); send({ type: 'grid_off' }); }
  }
  LIVE.start = start; LIVE.stop = stop;
  LIVE.toggle = async (devId) => (LIVE.running ? (stop(), false) : start(devId));

  /* ================================================================ page */
  const flavorCard = (f) => `<button class="fl-card" data-fl="${f}"><span class="fl-art fl-${f}">${ic(FL_ICON[f])}</span>
      <b>${esc(t('fl.' + f))}</b><small>${esc(t('fl.' + f + 'S'))}</small><em class="fl-now"></em></button>`;
  const slider = (id, key, l, r) => `<div class="sh-sl"><div class="sh-sl-h"><b>${esc(t(key))}</b><span class="mono" id="${id}-v"></span></div>
      <input type="range" id="${id}" min="0" max="100" step="1"><div class="sh-sl-f"><small>${esc(t(l))}</small><small>${esc(t(r))}</small></div></div>`;
  const toggle = (id, key) => `<label class="sh-tg"><span>${esc(t(key))}</span><span class="switch"><input type="checkbox" id="${id}"><i></i></span></label>`;
  const pad = (id, icon, key, sub) => `<button class="sh-pad" id="${id}">${ic(icon)}<b>${esc(t(key))}</b><small>${esc(t(sub))}</small></button>`;

  function build() {
    const box = $('#show'); if (!box) return;
    box.innerHTML = `
      <section class="sh-steps" id="sh-steps"></section>
      <section class="sh-hero">
        <div class="sh-aura" id="sh-aura"><i></i><i></i><i></i></div>
        <div class="sh-ring" id="sh-ring">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle class="track" cx="100" cy="100" r="88"/>
            ${[0, 1, 2, 3].map((k) => `<path class="seg" data-k="${k}" d="${arc(100, 100, 88, k * 90 + 4, k * 90 + 86)}"/>`).join('')}
            <circle class="ph" id="sh-ph" cx="100" cy="12" r="5"/>
          </svg>
          <div class="sh-bpm"><b id="sh-bpm">—</b><small>BPM</small><em id="sh-lock"></em></div>
        </div>
        <div class="sh-now">
          <small class="eyebrow" id="sh-eyebrow"></small>
          <h1 id="sh-title"></h1>
          <p id="sh-sub"></p>
          <div class="sh-chips" id="sh-chips"></div>
          <div class="sh-map" id="sh-map"></div>
          <div class="sh-meter"><span>${esc(t('sh.energy'))}</span><div class="bar"><i id="sh-en"></i></div>
            <div class="bands"><i id="sh-b0"></i><i id="sh-b1"></i><i id="sh-b2"></i></div></div>
        </div>
        <div class="sh-go">
          <label class="sh-src"><span>${esc(t('sh.src'))}</span><select id="sh-dev"></select></label>
          <button class="sh-start" id="sh-start"><span class="halo"></span>${ic('play')}<span class="tx"><b id="sh-start-t"></b><small id="sh-start-s"></small></span></button>
          <div class="sh-links">
            <button class="sh-link" id="sh-sync">${ic('pulse')}<span>${esc(t('sh.sync'))}</span></button>
            <button class="sh-link" id="sh-cal">${ic('target')}<span>${esc(t('sh.cal'))}</span></button>
            <button class="sh-link" id="sh-ai">${ic('sparkle')}<span>${esc(t('sh.ai'))}</span></button>
          </div>
        </div>
      </section>
      <section class="sh-block sh-pads">
        <div class="pads">
          ${pad('sh-p-blinder', 'sun', 'sh.blinder', 'sh.blinderS')}${pad('sh-p-strobe', 'bolt', 'sh.strobeHold', 'sh.strobeHoldS')}
          ${pad('sh-p-blackout', 'blackout', 'sh.blackout', 'sh.blackoutS')}${pad('sh-p-smoke', 'smoke', 'sh.smoke', 'sh.smokeS')}
          ${pad('sh-p-spot', 'spot', 'sh.spotPad', 'sh.spotPadS')}
        </div>
      </section>
      <section class="sh-block sh-moments" id="sh-moments"></section>
      <section class="sh-block sh-fx" id="sh-fx"></section>
      <section class="sh-block sh-scenes" id="sh-scenes"></section>
      <section class="sh-block sh-manual" id="sh-manual"></section>
      <section class="sh-block sh-styles">
        <h4>${esc(t('sh.style'))}</h4>
        <div class="fl-cards" id="sh-cards">${FLAVORS.map(flavorCard).join('')}</div>
      </section>
      <section class="sh-stage">
        <div class="sh-look">
          <small class="eyebrow">${esc(t('sh.onStage'))}</small>
          <h3 id="sh-look">—</h3>
          <p id="sh-why"></p>
          <div class="sh-pal" id="sh-pal"></div>
          <div class="sh-look-b">
            <button class="btn" id="sh-next">${ic('next')}<span>${esc(t('sh.nextLook'))}</span></button>
            <button class="btn" id="sh-freeze">${ic('lock')}<span id="sh-freeze-t">${esc(t('sh.freeze'))}</span></button>
          </div>
        </div>
        <canvas id="sh-rig" aria-label="podgląd świateł"></canvas>
      </section>
      <details class="sh-block sh-more" id="sh-more">
        <summary>${ic('setup')}<span><b>${esc(t('sh.more'))}</b><small>${esc(t('sh.moreS'))}</small></span>${ic('chevron')}</summary>
        <div class="sh-tune">
          <div class="sh-tune-sl">${slider('sh-morph', 'sh.morph', 'sh.morphL', 'sh.morphR')}
          ${slider('sh-int', 'sh.int', 'sh.intL', 'sh.intR')}</div>
          <div class="sh-tune-tg"><div class="sh-row"><b>${esc(t('sh.colors'))}</b><div class="seg" id="sh-col"><button data-v="ai">${esc(t('sh.colAi'))}</button><button data-v="mine">${esc(t('sh.colMine'))}</button></div></div>
          ${toggle('sh-strobe', 'sh.strobe')}${toggle('sh-white', 'sh.white')}${toggle('sh-lasers', 'sh.lasers')}${toggle('sh-spot', 'sh.spot')}</div>
        </div>
      </details>`;
    listInputs($('#sh-dev'));
    $('#sh-dev').onchange = (e) => { try { localStorage.setItem('ph_audio_dev', e.target.value); } catch (err) { /* private */ } if (LIVE.running) { stop(); start(e.target.value); } };
    $('#sh-start').onclick = toggleShow;
    $('#sh-next').onclick = () => send({ type: 'look_next' });
    $('#sh-freeze').onclick = () => send({ type: 'freeze', value: !(S.st && S.st.effects.director.frozen) });
    for (const b of $$('#sh-cards .fl-card')) b.onclick = () => send({ type: 'director', flavor: b.dataset.fl });
    const sl = (id, key) => { const el = $('#' + id); el.oninput = () => { $('#' + id + '-v').textContent = `${el.value}%`; PH.S.out.set(id, { type: 'director', [key]: el.value / 100 }); }; };
    sl('sh-morph', 'morph'); sl('sh-int', 'intensity');
    for (const b of $$('#sh-col button')) b.onclick = () => send({ type: 'director', ai_colors: b.dataset.v === 'ai' });
    $('#sh-strobe').onchange = (e) => send({ type: 'director', strobe: e.target.checked });
    $('#sh-white').onchange = (e) => send({ type: 'autopilot', white: e.target.checked });
    $('#sh-lasers').onchange = (e) => send({ type: 'autopilot', lasers: e.target.checked });
    $('#sh-spot').onchange = (e) => send({ type: 'autopilot', spot: e.target.checked });
    $('#sh-p-blinder').onclick = () => send({ type: 'blinder' });
    hold($('#sh-p-strobe'), () => send({ type: 'fx_start', kind: 'strobe', id: 'pad-strobe', params: { speed: 235 }, targets: 'all' }),
      () => send({ type: 'fx_stop', id: 'pad-strobe' }));
    $('#sh-p-blackout').onclick = () => send({ type: 'blackout', value: !(S.st && S.st.blackout) });
    hold($('#sh-p-smoke'), () => send({ type: 'smoke', hold: true }), () => send({ type: 'smoke', hold: false }));
    $('#sh-p-spot').onclick = () => send({ type: 'spotlight', value: !(S.st && S.st.spotlight && S.st.spotlight.on) });
    $('#sh-sync').onclick = openSync;
    $('#sh-cal').onclick = () => openCal();
    $('#sh-ai').onclick = openAi;
    S.sig.showLang = PH.lang;
    S.sig.showPlaying = S.sig.showPal = S.sig.showChips = undefined;
    frame.on = undefined;
  }
  function hold(el, down, up) {
    let on = false;
    el.addEventListener('pointerdown', (e) => { on = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } down(); });
    const end = () => { if (!on) return; on = false; el.classList.remove('on'); up(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }
  function arc(cx, cy, r, a0, a1) {
    const p = (a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  async function toggleShow() {
    const on = S.st && S.st.effects.autopilot.on && S.st.effects.autopilot.mood === 'ai';
    if (LIVE.running || on) {
      stop(); send({ type: 'show_stop' }); toast(t('sh.stopped'));
      return;
    }
    if (await start()) { send({ type: 'show_start' }); toast(t('sh.started')); }
  }

  function pulseBeat(inBar) {
    const ring = $('#sh-ring'), aura = $('#sh-aura');
    if (ring) { ring.classList.remove('kick'); void ring.offsetWidth; ring.classList.add('kick'); ring.classList.toggle('one', inBar === 0); }
    if (aura) { aura.classList.remove('kick'); void aura.offsetWidth; aura.classList.add('kick'); }
    const dot = $('#sy-dot'); if (dot) { dot.classList.remove('kick'); void dot.offsetWidth; dot.classList.add('kick'); }
  }

  /* ---------------------------------------------------------------- state → page */
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  function update(st) {
    if (S.tab !== 'show' || !$('#sh-title')) return;
    if (S.sig.showLang !== PH.lang) build();                    // language switched: all labels anew
    const fx = st.effects, ap = fx.autopilot, dir = fx.director || {}, clk = fx.clock || {}, ai = st.music_ai || {};
    const showOn = ap.on && ap.mood === 'ai';
    const lang = L();
    // start button
    const playing = LIVE.running || showOn;
    if (S.sig.showPlaying !== playing) {
      S.sig.showPlaying = playing;
      $('#sh-start').classList.toggle('on', playing);
      $('#sh-start .ic').outerHTML = ic(playing ? 'stop' : 'play');
    }
    PH.setText($('#sh-start-t'), t(playing ? 'sh.stop' : 'sh.start'));
    PH.setText($('#sh-start-s'), t(playing ? 'sh.stopS' : 'sh.startS'));
    // now playing
    const song = ai.song;
    // what the AI heard stays for the whole song (a quiet bridge does not erase it)
    if (ai.song_seq !== S.sig.showSeq) { S.sig.showSeq = ai.song_seq; S.sig.showHeard = null; }
    if (ai.music > 0.3 && (ai.genre_pl || ai.family_pl)) {
      S.sig.showHeard = { t: [ai.genre_pl || ai.family_pl, ai.genre_it || ai.family_it],
        sub: [[ai.mood_pl, ...(ai.instruments || []).map((x) => x.pl)], [ai.mood_it, ...(ai.instruments || []).map((x) => x.it)]] };
    }
    const heard = S.sig.showHeard;
    let eyebrow = t('sh.nowPlaying'), title, sub;
    if (song && song.title) {
      title = song.title; sub = [song.artist, song.year, (song.genres || []).join(', ')].filter(Boolean).join(' · ');
    } else if (LIVE.running && heard) {
      title = heard.t[lang]; sub = heard.sub[lang].filter(Boolean).join(' · ');
    } else if (LIVE.running) { title = t('sh.listening'); sub = ''; }
    else { eyebrow = ''; title = t('sh.idleT'); sub = t('sh.idleS'); }
    PH.setText($('#sh-eyebrow'), eyebrow); PH.setText($('#sh-title'), title); PH.setText($('#sh-sub'), sub);
    // chips
    const chips = [];
    if (fx.section && fx.section.name && LIVE.running) chips.push([`sec ${fx.section.name}`, t('sec.' + fx.section.name)]);
    if (ai.vocals > 0.25) chips.push(['', t('sh.vocals')]);
    if (ai.crowd > 0.3) chips.push(['', t('sh.crowd')]);
    if (LIVE.running) chips.push(['ai', ai.status === 'listening' ? t('sh.aiOn') : ai.status === 'loading' ? t('sh.aiLoad') : ai.status === 'error' ? t('sh.aiErr') : ai.listen === false ? t('sh.aiOff') : t('sh.aiOn')]);
    const chipSig = JSON.stringify(chips);
    if (chipSig !== S.sig.showChips) {
      S.sig.showChips = chipSig;
      $('#sh-chips').innerHTML = chips.map(([c, txt]) => `<span class="chip ${c}">${c.startsWith('sec') ? '<i></i>' : ''}${esc(txt)}</span>`).join('');
    }
    // beat ring
    PH.setText($('#sh-bpm'), clk.locked && clk.bpm ? String(Math.round(clk.bpm)) : LIVE.bpm ? String(Math.round(LIVE.bpm)) : '—');
    PH.setText($('#sh-lock'), !LIVE.running && clk.source !== 'timeline' ? t('sh.off') : clk.locked ? t(LIVE.locked || clk.source === 'timeline' ? 'sh.locked' : 'sh.free') : t('sh.wait'));
    $('#sh-ring').classList.toggle('locked', !!clk.locked);
    // energy + bands
    $('#sh-en').style.width = `${Math.round((LIVE.running ? Math.max(LIVE.energy, LIVE.level * 0.8) : 0) * 100)}%`;
    ['low', 'mid', 'high'].forEach((k, i) => { $(`#sh-b${i}`).style.transform = `scaleY(${LIVE.running ? clamp(LIVE.bands[k], 0.04, 1) : 0.04})`; });
    // song map
    drawMap();
    // look
    PH.setText($('#sh-look'), showOn ? ((lang ? dir.look_it : dir.look_pl) || '—') : '—');
    const why = showOn ? [t('sh.why.' + (dir.reason || 'start')), t('fl.now', { f: lang ? dir.flavor_it : dir.flavor_pl }),
      dir.frozen ? t('sh.frozen') : t('sh.nextIn', { n: dir.next_in })].join(' · ') : '';
    PH.setText($('#sh-why'), why);
    const pal = (showOn && dir.palette) || [];
    const palSig = JSON.stringify(pal);
    if (palSig !== S.sig.showPal) {
      S.sig.showPal = palSig;
      $('#sh-pal').innerHTML = pal.map((c) => `<i style="--c:${rgb(c)}"></i>`).join('');
      const aura = $$('#sh-aura i');
      const cols = pal.length ? pal : [[123, 77, 255], [18, 181, 203], [255, 120, 180]];
      aura.forEach((el, i) => el.style.setProperty('--c', rgb(cols[i % cols.length])));
    }
    $('#sh-next').disabled = !showOn;
    $('#sh-freeze').disabled = !showOn;
    $('#sh-freeze').classList.toggle('on', !!dir.frozen);
    PH.setText($('#sh-freeze-t'), t(dir.frozen ? 'sh.unfreeze' : 'sh.freeze'));
    // style cards
    const cfg = dir.cfg || {};
    for (const b of $$('#sh-cards .fl-card')) {
      const sel = (cfg.flavor || 'auto') === b.dataset.fl;
      b.classList.toggle('on', sel);
      PH.setText($('.fl-now', b), sel && b.dataset.fl === 'auto' && showOn ? t('fl.now', { f: lang ? dir.flavor_it : dir.flavor_pl }) : '');
    }
    renderSteps(st);
    // tune (never fight the user's hand)
    const setR = (id, v) => { const el = $('#' + id); if (el && document.activeElement !== el && v != null) { el.value = Math.round(v * 100); $('#' + id + '-v').textContent = `${el.value}%`; } };
    setR('sh-morph', cfg.morph); setR('sh-int', cfg.intensity);
    for (const b of $$('#sh-col button')) b.classList.toggle('on', (b.dataset.v === 'ai') === (cfg.ai_colors !== false));
    $('#sh-strobe').checked = cfg.strobe !== false;
    $('#sh-white').checked = !!ap.white; $('#sh-lasers').checked = !!ap.lasers; $('#sh-spot').checked = !!ap.spot;
    $('#sh-p-blackout').classList.toggle('on', !!st.blackout);
    $('#sh-p-spot').classList.toggle('on', !!(st.spotlight && st.spotlight.on));
    $('#sh-p-smoke').hidden = !st.fixtures.some((f) => f.type === 'smoke');
  }

  /* ---------------------------------------------------------------- "what next": one button per step */
  const lget = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const STEP_IC = { cable: 'plug', lamps: 'lamp', cal: 'target', music: 'music', sync: 'pulse' };
  function stepState(st) {
    const lights = st.fixtures.filter((f) => f.type !== 'smoke' && f.type !== 'laser');
    const heads = lights.filter(isHead);
    const sim = st.dmx.config.backend === 'sim';
    const cable = !sim && st.dmx.state === 'online';
    const clk = st.effects.clock || {};
    return {
      cable: cable ? ['done', t('nx.cableOk')] : lget('ph_skip_cable') ? ['done', t('nx.cableSkip')] : ['todo', t('nx.cableTodo')],
      lamps: lights.length ? ['done', lampCount(lights.length)] : ['todo', t('nx.lampsTodo')],
      cal: !heads.length ? ['done', t(lights.length ? 'nx.calNone' : 'nx.calTodo')] : heads.every((f) => f.show_home) || lget('ph_cal_done') ? ['done', t('nx.calOk')] : ['todo', t('nx.calTodo')],
      music: LIVE.running && clk.locked ? ['done', t('nx.musicOk', { b: Math.round(clk.bpm || LIVE.bpm || 0) })] : LIVE.running ? ['todo', t('nx.musicWait')] : ['todo', t('nx.musicTodo')],
      sync: lget('ph_sync_done') ? ['done', t('nx.syncOk')] : ['todo', t('nx.syncTodo')],
    };
  }
  function lampCount(n) {
    if (PH.lang === 'it') return t('nx.lampsOk', { n });
    const w = n === 1 ? 'lampa' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'lampy' : 'lamp';
    return `${n} ${w}`;
  }
  function stepGo(id) {
    if (id === 'lamps' && PH.openRig) PH.openRig(S.st && S.st.fixtures.length ? 'list' : 'type');
    else if (id === 'cable' || id === 'lamps') { PH.setTab('setup'); if (PH.setupGo) PH.setupGo(id === 'cable' ? 'dmx' : 'lamps'); }
    else if (id === 'cal') openCal();
    else if (id === 'music') { if (!LIVE.running) toggleShow(); }
    else if (id === 'sync') openSync();
  }
  function renderSteps(st) {
    const box = $('#sh-steps'); if (!box) return;
    if (st.fixtures.length === 0) lset('ph_steps_hidden', '');           // no lamps: always show the way
    const s = stepState(st), ids = ['cable', 'lamps', 'cal', 'music', 'sync'];
    const cur = ids.find((id) => s[id][0] !== 'done');
    const hidden = !cur && lget('ph_steps_hidden') === '1';
    const sig = JSON.stringify([s, cur, hidden, PH.lang]);
    if (sig === box.dataset.sig) return;
    box.dataset.sig = sig;
    if (!cur) {
      box.className = 'sh-steps done' + (hidden ? ' mini' : '');
      box.innerHTML = `<span class="st-ok">${ic('check')}</span><b>${esc(t('nx.allDone'))}</b>
        <button class="sh-link" id="st-tg">${esc(t(hidden ? 'nx.show' : 'nx.hide'))}</button>`;
      if (!hidden) box.insertAdjacentHTML('beforeend', `<ol class="st-list">${ids.map((id, i) => stepLi(id, i, s, null)).join('')}</ol>`);
      $('#st-tg', box).onclick = () => { lset('ph_steps_hidden', hidden ? '' : '1'); box.dataset.sig = ''; renderSteps(st); };
    } else {
      box.className = 'sh-steps';
      box.innerHTML = `<h4>${esc(t('nx.title'))}</h4><ol class="st-list">${ids.map((id, i) => stepLi(id, i, s, cur)).join('')}</ol>`;
    }
    for (const b of $$('[data-go]', box)) b.onclick = () => stepGo(b.dataset.go);
    const skip = $('[data-skip]', box); if (skip) skip.onclick = () => { lset('ph_skip_cable', '1'); box.dataset.sig = ''; renderSteps(st); };
  }
  function stepLi(id, i, s, cur) {
    const [state, note] = s[id], now = id === cur;
    return `<li class="st ${state}${now ? ' now' : ''}">
      <button class="st-n" data-go="${id}" title="${esc(t('nx.' + id))}">${state === 'done' ? ic('check') : ic(STEP_IC[id])}</button>
      <span class="st-t"><b>${i + 1}. ${esc(t('nx.' + id))}</b><small>${esc(note)}</small></span>
      ${now ? `<span class="st-act"><button class="btn primary" data-go="${id}">${esc(t('nx.' + id + 'Go'))}</button>
        ${id === 'cable' ? `<button class="sh-link" data-skip>${esc(t('nx.cableNo'))}</button>` : ''}</span>` : ''}
    </li>`;
  }

  function drawMap() {
    const box = $('#sh-map'); if (!box) return;
    const now = performance.now(), segs = LIVE.map.slice(-10);
    if (!segs.length) { if (box.childElementCount) box.innerHTML = ''; return; }
    const total = Math.max(1, now - segs[0].t);
    const sig = segs.map((s) => s.name + s.t).join('|');
    if (sig !== box.dataset.sig) {
      box.dataset.sig = sig;
      box.innerHTML = segs.map((s, i) => `<span class="seg${i === segs.length - 1 ? ' cur' : ''}" style="--c:${SEC_COLOR[s.name] || '#ccc'}"><em>${esc(t('sec.' + s.name))}</em></span>`).join('');
    }
    [...box.children].forEach((el, i) => {
      const end = i + 1 < segs.length ? segs[i + 1].t : now;
      el.style.flexGrow = String(Math.max(0.04, (end - segs[i].t) / total));
    });
  }

  /* ---------------------------------------------------------------- per frame: ring phase + rig preview */
  function frame() {
    if (S.tab === 'show' && $('#sh-ring')) {
      const ph = $('#sh-ph');
      const p = LIVE.running && LIVE.locked ? clamp((performance.now() - LIVE.beatAt) / LIVE.period, 0, 1.2) : 0;
      const a = ((LIVE.inBar + Math.min(1, p)) % 4) / 4 * 2 * Math.PI;
      ph.setAttribute('cx', (100 + 88 * Math.sin(a)).toFixed(1)); ph.setAttribute('cy', (100 - 88 * Math.cos(a)).toFixed(1));
      const on = LIVE.locked ? LIVE.inBar : -1;
      if (on !== frame.on) { frame.on = on; for (const s of $$('#sh-ring .seg')) s.classList.toggle('on', Number(s.dataset.k) === on); }
      drawRig(performance.now() / 1000);
    }
    requestAnimationFrame(frame);
  }

  function drawRig(time) {
    const cv = $('#sh-rig'); if (!cv || !S.st) return;
    const [W, H, d] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0a15'); g.addColorStop(1, '#1a1631');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const floorY = H * 0.84;
    const fl = ctx.createLinearGradient(0, floorY, 0, H);
    fl.addColorStop(0, 'rgba(255,255,255,.06)'); fl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fl; ctx.fillRect(0, floorY, W, H - floorY);
    const lights = S.st.fixtures.filter((f) => f.type !== 'smoke' && f.enabled !== false).sort((a, b) => a.pos[0] - b.pos[0] || a.id - b.id);
    if (!lights.length) return;
    const glows = [];
    ctx.globalCompositeOperation = 'lighter';
    lights.forEach((f, i) => {
      const x = W * (i + 0.5) / lights.length, floorMount = f.mount === 'floor';
      const y0 = floorMount ? floorY : 14 * d;
      const I = PH.intensity(f, time), [r, gg, b] = PH.rgbOf(f);
      const isLaser = (f.channels || []).some((c) => c.startsWith('laser'));
      const pan = f.values.pan != null ? ((f.values.pan / 65535) - 0.5) * (f.pan_deg || 540) : 0;
      const tilt = f.values.tilt != null ? ((f.values.tilt / 65535) - 0.5) * (f.tilt_deg || 270) * (f.invert_tilt ? -1 : 1) : 0;
      const hasMove = (f.channels || []).some((c) => c === 'pan' || c === 'tilt');
      // a front view: tilt swings the beam sideways as pan turns it, pan alone moves it a little
      let ang = hasMove ? clamp(tilt * 0.6 * Math.cos(pan * Math.PI / 180) + pan * 0.06, -64, 64) : 0;
      if (floorMount) ang = 180 - ang;
      const rad = ang * Math.PI / 180, len = H * 1.15;
      const half = isLaser ? 0.004 : Math.max(0.05, ((f.beam_deg || 14) * Math.PI / 180) * 0.55);
      if (I > 0.01) {
        const cone = (spread, alpha) => {
          const gr = ctx.createLinearGradient(x, y0, x + Math.sin(rad) * len, y0 + Math.cos(rad) * len);
          gr.addColorStop(0, `rgba(${r},${gg},${b},${alpha * I})`);
          gr.addColorStop(0.75, `rgba(${r},${gg},${b},${alpha * I * 0.25})`);
          gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.moveTo(x - 2.5 * d, y0);
          ctx.lineTo(x + Math.sin(rad - spread) * len, y0 + Math.cos(rad - spread) * len);
          ctx.lineTo(x + Math.sin(rad + spread) * len, y0 + Math.cos(rad + spread) * len);
          ctx.lineTo(x + 2.5 * d, y0);
          ctx.fill();
        };
        cone(half * 2.4, 0.12);                                  // haze around the beam
        cone(half, 0.62);                                        // the beam
        if (!floorMount && Math.abs(ang) < 72) {                 // pool of light on the floor
          const px = x + Math.tan(rad) * (floorY - y0);
          if (px > -60 && px < W + 60) glows.push([px, floorY, r, gg, b, I]);
        }
      }
      glows.push([x, y0 + (floorMount ? 0 : 3 * d), r, gg, b, 0.25 + 0.75 * I, true]);
    });
    for (const [gx, gy, r, gg, b, I, lamp] of glows) {
      const rad = (lamp ? 14 : 54) * d;
      const pg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
      pg.addColorStop(0, `rgba(${r},${gg},${b},${(lamp ? 0.9 : 0.55) * I})`); pg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(gx, gy, rad, lamp ? rad : rad * 0.22, 0, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const f of lights) {                                  // the lamp bodies on top
      const i = lights.indexOf(f), x = W * (i + 0.5) / lights.length, floorMount = f.mount === 'floor';
      const y0 = floorMount ? floorY : 14 * d;
      ctx.fillStyle = '#2b2843';
      ctx.beginPath(); ctx.roundRect(x - 10 * d, y0 - (floorMount ? 2 * d : 12 * d), 20 * d, 10 * d, 4 * d); ctx.fill();
    }
  }

  /* ================================================================ light sync dialog */
  function dialog(id, html) {
    let dlg = $('#' + id);
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = id; dlg.className = 'lux-dlg'; document.body.appendChild(dlg); }
    dlg.innerHTML = html;
    return dlg;
  }
  function openSync() {
    const ms = () => (S.st && S.st.effects.clock ? S.st.effects.clock.offset_ms : 40);
    const dlg = dialog('sync-dlg', `<div class="ld-h"><b>${esc(t('sy.title'))}</b><button class="x" data-close>${ic('close')}</button></div>
      <p class="ld-lead">${esc(t('sy.lead'))}</p>
      <div class="sy-stage"><div class="sy-dot" id="sy-dot"></div><div class="sy-val"><b id="sy-ms"></b><small id="sy-txt"></small></div></div>
      <p class="ld-warn" id="sy-warn" hidden>${esc(t('sy.noMusic'))}</p>
      <div class="sy-ctl">
        <button class="btn" data-d="-10">−10</button><button class="btn" data-d="-2">−2</button>
        <input type="range" id="sy-range" min="-100" max="250" step="1">
        <button class="btn" data-d="2">+2</button><button class="btn" data-d="10">+10</button>
      </div>
      <div class="sy-lab"><small>${esc(t('sy.later'))}</small><small>${esc(t('sy.earlier'))}</small></div>
      <div class="ld-f"><button class="btn" id="sy-reset">${esc(t('sy.reset'))}</button><button class="btn primary" data-close>${esc(t('sy.done'))}</button></div>`);
    const show = (v) => {
      $('#sy-range').value = v;
      $('#sy-ms').textContent = `${v > 0 ? '+' : ''}${v} ms`;
      $('#sy-txt').textContent = v >= 0 ? t('sy.ms', { n: v }) : t('sy.msNeg', { n: -v });
    };
    const set = (v) => { v = clamp(Math.round(v), -100, 250); show(v); PH.S.out.set('sync', { type: 'sync', ms: v }); };
    show(ms());
    $('#sy-range').oninput = (e) => set(Number(e.target.value));
    for (const b of $$('[data-d]', dlg)) b.onclick = () => set(Number($('#sy-range').value) + Number(b.dataset.d));
    $('#sy-reset').onclick = () => set(40);
    $('#sy-warn').hidden = !!(S.st && S.st.effects.clock && S.st.effects.clock.locked);
    // lights flash on every beat of the grid while the dialog is open
    send({ type: 'fx_start', kind: 'beat', id: 'sync-test', params: { floor: 0, curve: 6, beats: 1 }, targets: 'all' });
    send({ type: 'fx_start', kind: 'static_color', id: 'sync-col', params: { color_a: [255, 255, 255] }, targets: 'all' });
    const close = () => {
      send({ type: 'fx_stop', id: 'sync-test' }); send({ type: 'fx_stop', id: 'sync-col' }); dlg.close();
      if (S.st && S.st.effects.clock && S.st.effects.clock.locked) lset('ph_sync_done', '1');   // set while the music played
    };
    for (const b of $$('[data-close]', dlg)) b.onclick = close;
    dlg.onclose = () => { send({ type: 'fx_stop', id: 'sync-test' }); send({ type: 'fx_stop', id: 'sync-col' }); };
    dlg.showModal();
  }

  /* ================================================================ AI / song recognition dialog */
  function openAi() {
    const ai = (S.st && S.st.music_ai) || {};
    const dlg = dialog('ai-dlg', `<div class="ld-h"><b>${esc(t('ai.title'))}</b><button class="x" data-close>${ic('close')}</button></div>
      <p class="ld-lead">${esc(t('ai.lead'))}</p>
      ${toggle('ai-listen', 'ai.listen')}${toggle('ai-recog', 'ai.recog')}
      <label class="ld-field"><span>${esc(t('ai.key'))}</span>
        <span class="row"><input type="password" id="ai-key" autocomplete="off" spellcheck="false" placeholder="${esc(ai.has_token ? '••••••••••••' : t('ai.keyPh'))}"><button class="btn" id="ai-save">${esc(t('ai.save'))}</button></span>
        <small>${esc(ai.has_token ? t('ai.keySaved') : t('ai.getKey'))}</small></label>
      <p class="ld-note" id="ai-st"></p>
      <div class="ld-f"><button class="btn primary" data-close>${esc(t('sy.done'))}</button></div>`);
    $('#ai-listen').checked = ai.listen !== false;
    $('#ai-recog').checked = !!ai.recognize;
    $('#ai-listen').onchange = (e) => send({ type: 'ai_cfg', listen: e.target.checked });
    $('#ai-recog').onchange = (e) => send({ type: 'ai_cfg', recognize: e.target.checked });
    $('#ai-save').onclick = () => {
      const v = $('#ai-key').value.trim(); if (!v) return;
      send({ type: 'ai_cfg', audd_token: v, recognize: true }); $('#ai-key').value = ''; $('#ai-recog').checked = true;
      toast(t('ai.keySaved'));
    };
    const st = ai.recog_status || '';
    $('#ai-st').textContent = st ? t('ai.status', { s: t('ai.st.' + st) !== 'ai.st.' + st ? t('ai.st.' + st) : st }) : '';
    for (const b of $$('[data-close]', dlg)) b.onclick = () => dlg.close();
    dlg.showModal();
  }

  /* ================================================================ quick calibration of every light */
  const CAL = { list: [], i: 0, step: 'intro', test: null };
  const isHead = (f) => (f.channels || []).some((c) => c === 'pan' || c === 'tilt');
  const hasRgb = (f) => (f.channels || []).some((c) => c === 'red' || c === 'green' || c === 'blue');
  function calFx() { return S.st && S.st.fixtures.find((f) => f.id === CAL.list[CAL.i]); }
  function openCal(onlyId, step) {
    CAL.list = S.st ? S.st.fixtures.filter((f) => f.type !== 'smoke' && f.type !== 'laser' && f.enabled !== false)
      .sort((a, b) => a.address - b.address).map((f) => f.id) : [];
    if (onlyId != null && CAL.list.includes(onlyId)) CAL.list = [onlyId];
    CAL.i = 0; CAL.step = 'intro';
    const dlg = dialog('cal-dlg', '<div id="cal-body"></div>');
    dlg.onclose = calEnd;
    dlg.showModal();
    if (onlyId != null && CAL.list.length === 1) {
      send({ type: 'show_stop' }); send({ type: 'fx_stop_all' }); send({ type: 'blackout', value: false });
      CAL.step = step || 'find'; calLight(CAL.list[0]);
    }
    calRender();
  }
  function calEnd() {
    clearInterval(CAL.test); CAL.test = null;
    send({ type: 'home', id: 'all' });
    for (const f of (S.st ? S.st.fixtures : [])) if (CAL.list.includes(f.id)) send({ type: 'set_many', id: f.id, values: { dimmer: 200, red: 255, green: 255, blue: 255, strobe: 0 } });
  }
  function calLight(only) {                                      // this lamp white and open, the others dark
    for (const id of CAL.list) {
      send({ type: 'set_many', id, values: id === only ? { dimmer: 255, red: 255, green: 255, blue: 255, strobe: 0 } : { dimmer: 0 } });
    }
    send({ type: 'select', id: only });
  }
  function nudge(f, dPanDeg, dTiltDeg) {
    // the lamp's reported values lag behind (smoothing): keep our own position while aiming
    const p = CAL.pos || (CAL.pos = { pan: f.values.pan || 32768, tilt: f.values.tilt || 32768 });
    p.pan = clamp(p.pan + dPanDeg / (f.pan_deg || 540) * 65535, 0, 65535);
    p.tilt = clamp(p.tilt + dTiltDeg / (f.tilt_deg || 270) * 65535, 0, 65535);
    PH.S.out.set('cal-move', { type: 'set_many', id: f.id, values: { pan: Math.round(p.pan), tilt: Math.round(p.tilt) } });
  }
  function upSign(f) {                                            // same rule as effects.EffectEngine._up
    const inv = f.invert_tilt ? -1 : 1;
    const te = ((f.values.tilt || 32768) / 65535 - 0.5) * (f.tilt_deg || 270) * inv;
    const s = te >= 0 ? 1 : -1;
    return (f.mount === 'floor' ? -s : s) * inv;
  }
  function calRender() {
    const body = $('#cal-body'); if (!body) return;
    clearInterval(CAL.test); CAL.test = null;
    const n = CAL.list.length, f = calFx();
    const head = `<div class="ld-h"><b>${esc(t('cal.title'))}</b><button class="x" data-close>${ic('close')}</button></div>`;
    const prog = n ? `<div class="cal-prog">${CAL.list.map((id, k) => `<i class="${k < CAL.i ? 'done' : k === CAL.i ? 'cur' : ''}"></i>`).join('')}</div>` : '';
    let html = '';
    if (!n) html = `<p class="ld-lead">${esc(t('cal.none'))}</p><div class="ld-f"><button class="btn primary" data-close>${esc(t('cal.close'))}</button></div>`;
    else if (CAL.step === 'intro') html = `<p class="ld-lead">${esc(t('cal.lead'))}</p><div class="ld-f"><button class="btn primary" id="cal-go">${esc(t('cal.start'))}</button></div>`;
    else if (CAL.step === 'done') html = `<div class="cal-done">${ic('check')}<b>${esc(t('cal.done'))}</b><p>${esc(t('cal.doneS'))}</p></div>
      <div class="ld-f"><button class="btn" data-close>${esc(t('cal.close'))}</button><button class="btn primary" id="cal-sync">${esc(t('cal.toSync'))}</button></div>`;
    else {
      const sub = `<div class="cal-who"><small>${esc(t('cal.lamp', { i: CAL.i + 1, n }))}</small><b>${esc(f ? f.name : '')}</b><span class="mono">DMX ${f ? String(f.address).padStart(3, '0') : ''}</span></div>`;
      if (CAL.step === 'find') html = `${sub}<h3>${esc(t('cal.find'))}</h3><p class="ld-note">${esc(t('cal.findS'))}</p><p class="ld-warn" id="cal-nohint" hidden>${esc(t('cal.noHint', { a: f ? f.address : '' }))}</p>
        <div class="ld-f"><button class="btn" id="cal-skip">${esc(t('cal.skip'))}</button><button class="btn" id="cal-no">${esc(t('cal.no'))}</button><button class="btn primary" id="cal-yes">${esc(t('cal.yes'))}</button></div>`;
      else if (CAL.step === 'shutter') html = `${sub}<h3>${esc(t('cal.shut'))}</h3><p class="ld-note">${esc(t('cal.shutS'))}</p>
        <div class="cal-try"><b id="cal-try-n"></b><span class="mono" id="cal-try-v"></span></div>
        <p class="ld-warn" id="cal-shut-none" hidden>${esc(t('cal.shutNone'))}</p>
        <div class="ld-f"><button class="btn" id="cal-skip">${esc(t('cal.skip'))}</button><button class="btn" id="cal-chan" hidden>${esc(t('cal.channels'))}</button>
          <button class="btn" id="cal-again" hidden>${esc(t('cal.again'))}</button><button class="btn primary" id="cal-lit">${esc(t('cal.lit'))}</button></div>`;
      else if (CAL.step === 'center') html = `${sub}<h3>${esc(t('cal.center'))}</h3><p class="ld-note">${esc(t('cal.centerS'))}</p>
        <div class="cal-pad" id="cal-pad" tabindex="0"><i class="cx"></i><i class="cy"></i><span>${ic('move')}</span></div>
        <div class="cal-arrows"><button class="btn" data-a="-1,0">${ic('chevron')}</button><button class="btn up" data-a="0,1">${ic('chevron')}</button><button class="btn dn" data-a="0,-1">${ic('chevron')}</button><button class="btn rt" data-a="1,0">${ic('chevron')}</button></div>
        <div class="ld-f"><button class="btn" id="cal-skip">${esc(t('cal.skip'))}</button><button class="btn primary" id="cal-home">${esc(t('cal.saveCenter'))}</button></div>`;
      else if (CAL.step === 'right' || CAL.step === 'up') html = `${sub}<h3>${esc(t(CAL.step === 'right' ? 'cal.right' : 'cal.up'))}</h3><p class="ld-note">${esc(t(CAL.step === 'right' ? 'cal.rightS' : 'cal.upS'))}</p>
        <div class="cal-anim ${CAL.step}"><i></i></div>
        <div class="ld-f"><button class="btn" id="cal-wrong">${esc(t('cal.wrong'))}</button><button class="btn primary" id="cal-yes">${esc(t('cal.yes'))}</button></div>`;
      else if (CAL.step === 'color') html = `${sub}<h3>${esc(t('cal.color'))}</h3><p class="ld-note">${esc(t('cal.colorS'))}</p>
        <div class="cal-color" id="cal-color"><i></i><b></b></div><p class="ld-warn" id="cal-colhint" hidden>${esc(t('cal.colorHint'))}</p>
        <div class="ld-f"><button class="btn" id="cal-cno">${esc(t('cal.colorNo'))}</button><button class="btn primary" id="cal-yes">${esc(t('cal.yes'))}</button></div>`;
    }
    body.innerHTML = head + prog + html;
    for (const b of $$('[data-close]', body)) b.onclick = () => $('#cal-dlg').close();
    const next = () => calNext();
    if (CAL.step === 'intro' && n) $('#cal-go').onclick = () => {
      send({ type: 'show_stop' }); send({ type: 'fx_stop_all' }); send({ type: 'blackout', value: false });
      CAL.step = 'find'; calLight(CAL.list[0]); calRender();
    };
    if (CAL.step === 'done') $('#cal-sync').onclick = () => { $('#cal-dlg').close(); openSync(); };
    if (!f) return;
    if (CAL.step === 'find') {
      $('#cal-yes').onclick = () => { CAL.step = isHead(f) ? 'center' : hasRgb(f) ? 'color' : 'next'; if (CAL.step === 'next') next(); else calRender(); };
      $('#cal-no').onclick = () => {
        const hasShutter = (f.channels || []).some((c) => c === 'shutter' || c === 'strobe');
        if (hasShutter) { CAL.step = 'shutter'; calRender(); } else $('#cal-nohint').hidden = false;
      };
      $('#cal-skip').onclick = next;
      // blink so it is easy to spot
      let on = true;
      CAL.test = setInterval(() => { on = !on; send({ type: 'set_many', id: f.id, values: { dimmer: on ? 255 : 30 } }); }, 450);
    }
    if (CAL.step === 'shutter') {
      const tries = [...new Set([f.shutter_open ?? 0, 8, 16, 32, 64, 128, 200, 255, 0, 10, 4, 100])];
      const orig = f.shutter_open ?? 0;
      let k = -1, prev = orig, at = 0;
      const step = () => {
        k++;
        if (k >= tries.length) {
          clearInterval(CAL.test); CAL.test = null;
          send({ type: 'update_fixture', id: f.id, shutter_open: orig });
          $('#cal-shut-none').hidden = false; $('#cal-chan').hidden = false; $('#cal-again').hidden = false; $('#cal-lit').hidden = true;
          return;
        }
        prev = k ? tries[k - 1] : orig; at = performance.now();
        send({ type: 'update_fixture', id: f.id, shutter_open: tries[k] });
        send({ type: 'set_many', id: f.id, values: { dimmer: 255, red: 255, green: 255, blue: 255, strobe: 0 } });
        PH.setText($('#cal-try-n'), t('cal.try', { i: k + 1, n: tries.length }));
        PH.setText($('#cal-try-v'), `shutter = ${tries[k]}`);
      };
      step();
      CAL.test = setInterval(step, 1500);
      $('#cal-lit').onclick = () => {
        clearInterval(CAL.test); CAL.test = null;
        const v = performance.now() - at < 500 ? prev : tries[k];      // a click right after a change meant the one before
        send({ type: 'update_fixture', id: f.id, shutter_open: v });
        toast(t('cal.litOk', { v }));
        CAL.step = isHead(f) ? 'center' : hasRgb(f) ? 'color' : 'next';
        if (CAL.step === 'next') next(); else calRender();
      };
      $('#cal-again').onclick = () => calRender();
      $('#cal-chan').onclick = () => { $('#cal-dlg').close(); if (PH.startCalibration) PH.startCalibration({}); else { PH.setTab('setup'); if (PH.setupGo) PH.setupGo('dmxcal'); } };
      $('#cal-skip').onclick = () => { clearInterval(CAL.test); CAL.test = null; send({ type: 'update_fixture', id: f.id, shutter_open: orig }); next(); };
    }
    if (CAL.step === 'center') {
      const padEl = $('#cal-pad');
      let last = null;
      padEl.onpointerdown = (e) => { last = [e.clientX, e.clientY]; padEl.setPointerCapture(e.pointerId); padEl.classList.add('drag'); };
      padEl.onpointermove = (e) => {
        if (!last) return;
        const k = e.shiftKey ? 0.05 : 0.25;
        nudge(calFx(), (e.clientX - last[0]) * k, -(e.clientY - last[1]) * k * upSign(calFx()));
        last = [e.clientX, e.clientY];
      };
      padEl.onpointerup = padEl.onpointercancel = () => { last = null; padEl.classList.remove('drag'); };
      const arrow = (ax, ay, fine) => { const s = fine ? 0.5 : 3; nudge(calFx(), ax * s, ay * s * upSign(calFx())); };
      for (const b of $$('[data-a]', body)) b.onclick = (e) => { const [ax, ay] = b.dataset.a.split(',').map(Number); arrow(ax, ay, e.shiftKey); };
      padEl.onkeydown = (e) => {
        const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
        if (m) { e.preventDefault(); arrow(m[0], m[1], e.shiftKey); }
        if (e.key === 'Enter') $('#cal-home').click();
      };
      padEl.focus();
      $('#cal-home').onclick = () => {
        const p = CAL.pos || { pan: f.values.pan, tilt: f.values.tilt };
        PH.S.out.delete('cal-move');                            // no late move after this
        send({ type: 'set_many', id: f.id, values: { pan: Math.round(p.pan), tilt: Math.round(p.tilt) } });
        send({ type: 'show_home', id: f.id, pan: Math.round(p.pan), tilt: Math.round(p.tilt) });
        CAL.home = { pan: p.pan, tilt: p.tilt }; CAL.step = 'right'; calRender();
      };
      $('#cal-skip').onclick = next;
    }
    if (CAL.step === 'right' || CAL.step === 'up') {
      const home = CAL.home || { pan: f.values.pan, tilt: f.values.tilt };
      const move = (k) => {
        const g = calFx() || f;
        const pan = CAL.step === 'right' ? clamp(home.pan + k * 15 / (g.pan_deg || 540) * 65535 * (g.invert_pan ? -1 : 1), 0, 65535) : home.pan;
        const tilt = CAL.step === 'up' ? clamp(home.tilt + k * 12 / (g.tilt_deg || 270) * 65535 * upSign({ ...g, values: { tilt: home.tilt } }), 0, 65535) : home.tilt;
        send({ type: 'set_many', id: g.id, values: { pan, tilt } });
      };
      let k = 1;
      move(k);
      CAL.test = setInterval(() => { k = k ? 0 : 1; move(k); }, 1300);
      $('#cal-yes').onclick = () => { send({ type: 'set_many', id: f.id, values: { pan: home.pan, tilt: home.tilt } }); CAL.step = CAL.step === 'right' ? 'up' : hasRgb(f) ? 'color' : 'next'; if (CAL.step === 'next') next(); else calRender(); };
      $('#cal-wrong').onclick = () => {
        send({ type: 'flip', id: f.id, axis: CAL.step === 'right' ? 'x' : 'y' });
        toast(t('cal.fixed'));
        setTimeout(calRender, 350);                              // test again with the corrected direction
      };
    }
    if (CAL.step === 'color') {
      const cols = [[[255, 0, 0], 'c.red'], [[0, 255, 0], 'c.green'], [[0, 0, 255], 'c.blue']];
      let k = 0;
      const showC = () => {
        const [c, key] = cols[k % 3];
        send({ type: 'set_many', id: f.id, values: { red: c[0], green: c[1], blue: c[2], dimmer: 255 } });
        const box = $('#cal-color'); if (box) { box.style.setProperty('--c', rgb(c)); $('b', box).textContent = t(key); }
        k++;
      };
      showC();
      CAL.test = setInterval(showC, 1100);
      $('#cal-yes').onclick = next;
      $('#cal-cno').onclick = () => { $('#cal-colhint').hidden = false; };
    }
  }
  function calNext() {
    CAL.home = null; CAL.pos = null;
    if (CAL.i + 1 >= CAL.list.length) { CAL.step = 'done'; lset('ph_cal_done', '1'); calEnd(); calRender(); return; }
    CAL.i++; CAL.step = 'find';
    calLight(CAL.list[CAL.i]);
    calRender();
  }

  /* ================================================================ init */
  function init() {
    build();
    PH.onState.push((st) => { if (S.tab === 'show') update(st); });
    navigator.mediaDevices && navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', () => listInputs($('#sh-dev')));
    requestAnimationFrame(frame);
    // first start of this version: open on the new show screen once
    try {
      if (!localStorage.getItem('ph_v5')) { localStorage.setItem('ph_v5', '1'); setTimeout(() => PH.setTab('show'), 120); }
    } catch (e) { /* private mode */ }
  }
  PH.openSync = openSync; PH.openLightCal = openCal;
  PH.showStart = async () => {                       // a moment button: music on (if possible) + the AI director
    if (!LIVE.running) await start();
    send({ type: 'show_start' });
  };
  init();
})();
