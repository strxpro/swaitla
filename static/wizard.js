/* Lumo — Konfigurator: everything with one click.
 *
 * Ustawienia → Konfigurator → Start. The steps run one after another: program, DMX cable,
 * main camera, stage camera, devices (asks what is plugged in), light test, movement test,
 * gestures, save. Each step says what it does, what it found and what to do when something
 * does not work; questions ("did the lamp blink?") are answered with big buttons.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, toast, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'st.wizard.n': 'Konfigurator', 'st.wizard.s': 'wszystko jednym kliknięciem',
      'st.wizard.t': 'Konfigurator', 'st.wizard.d': 'Kliknij Start — program sam znajdzie kabel DMX i kamerę, połączy je, doda Twoją lampę i sprawdzi światło, ruch i gesty. Przy każdym kroku widzisz, co się dzieje i co zrobić, jeśli coś nie działa.',
      'cf.start': 'Start', 'cf.again': 'Uruchom jeszcze raz', 'cf.stop': 'Zatrzymaj', 'cf.running': 'Konfiguruję… krok {n} z {m}',
      'cf.idle': 'Gotowy do startu. Zajmie to około minuty.', 'cf.summaryOk': 'Wszystko działa!', 'cf.summaryBad': 'Gotowe. Do poprawienia: {n}',
      'cf.retry': 'Spróbuj jeszcze raz', 'cf.skip': 'Pomiń', 'cf.yes': 'Tak', 'cf.no': 'Nie', 'cf.repeat': 'Powtórz test', 'cf.next': 'Dalej',
      'cf.wait': 'czeka', 'cf.skipped': 'pominięte', 'cf.rerun': 'Sprawdź ponownie',
      'cf.server': 'Program', 'cf.server.w': 'Sprawdzam, czy okno jest połączone z programem i czy działa najnowsza wersja.',
      'cf.serverOk': 'Połączono z programem (najnowsza wersja).', 'cf.serverOld': 'Program działa, ale w starszej wersji.',
      'cf.serverOldT': 'Zamknij czarne okno programu i uruchom run.bat jeszcze raz — wtedy włączą się wszystkie nowe funkcje (kopia zapasowa, duplikowanie).',
      'cf.dmx': 'Kabel DMX', 'cf.dmx.w': 'Szukam interfejsu USB-DMX (FTDI Open DMX, ENTTEC, uDMX) i łączę go z programem.',
      'cf.dmxOk': 'Kabel połączony: {s} · {hz} Hz', 'cf.dmxFound': 'Znalazłem: {s} — łączę…', 'cf.dmxNone': 'Nie widzę kabla USB-DMX.',
      'cf.dmxNoneT': 'Podłącz kabel do portu USB i kliknij „Spróbuj jeszcze raz”. Kabel FTDI (Open DMX) Windows zwykle rozpoznaje sam; jeśli nie — zainstaluj sterownik FTDI CDM (ftdichip.com).',
      'cf.dmxFail': 'Nie udało się połączyć: {s}', 'cf.dmxFailT': 'Zamknij inne programy do świateł (QLC+, Freestyler, DMXControl) — tylko jeden program naraz może używać kabla. Potem odłącz i podłącz kabel.',
      'cf.cam': 'Kamera', 'cf.cam.w': 'Sprawdzam obraz z kamery, która widzi Twoje dłonie. Jeśli go nie ma, szukam działającej kamery i ją ustawiam.',
      'cf.camOk': 'Kamera działa: {s} · {f} kl./s', 'cf.camLow': 'Kamera daje mało klatek ({f}/s) — gesty będą wolniejsze. W aplikacji telefonu (Iriun) ustaw 30 fps i zadbaj o światło.',
      'cf.camScan': 'Brak obrazu — szukam kamer…', 'cf.camTry': 'Próbuję CAM {n}…', 'cf.camNone': 'Nie znalazłem działającej kamery.',
      'cf.camNoneT': 'Kamera USB: podłącz ją i kliknij „Spróbuj jeszcze raz”. Telefon (Iriun / DroidCam): uruchom aplikację na telefonie i na komputerze, oba w tej samej sieci Wi-Fi.',
      'cf.stage': 'Kamera sceny', 'cf.stage.w': 'Druga kamera jest opcjonalna. Jeśli jest ustawiona, a nie daje obrazu, wyłączam ją, żeby nie przeszkadzała.',
      'cf.stageNone': 'Nieużywana (opcjonalna).', 'cf.stageOk': 'Działa.', 'cf.stageOff': 'Kamera sceny (CAM {n}) nie dawała obrazu — wyłączyłem ją. Włączysz ją w Ustawienia → Kamery.',
      'cf.dev': 'Urządzenia', 'cf.dev.w': 'Sprawdzam, jakie lampy są w programie. Jeśli nie ma żadnej, wybierz tę, którą podłączyłeś, i wpisz jej adres.',
      'cf.devOk': 'Urządzeń: {n} ({s}).', 'cf.devAsk': 'Jaką lampę podłączyłeś? Kliknij model i wpisz adres DMX taki sam jak na lampie (np. A001 = 1).',
      'cf.devAddr': 'Adres DMX', 'cf.devAdd': 'Dodaj', 'cf.devPick': 'Najpierw kliknij model lampy.', 'cf.devAdded': 'Dodano {n} pod adresem {a}.',
      'cf.devMore': 'Dodać jeszcze jedno urządzenie?', 'cf.devMoreYes': 'Tak, dodaj', 'cf.devMoreNo': 'Nie, dalej', 'cf.devNone': 'Brak urządzeń — światło nie będzie działać.',
      'cf.devMode': 'Sprawdź na wyświetlaczu lampy tryb kanałów — musi być taki sam jak w programie ({s} kanałów). Np. Tomshine: tryb 9CH = model 9CH, tryb 11CH = model 11CH. Inny tryb = lampa robi dziwne rzeczy albo nie reaguje.',
      'cf.devConf': 'Adresy nachodzą na siebie: {s}. Ustawić po kolei?', 'cf.devConfOk': 'Adresy ustawione po kolei — ustaw te same na lampach.',
      'cf.light': 'Test światła', 'cf.light.w': 'Wszystkie lampy mrugną przez 3 sekundy. Popatrz na nie.',
      'cf.lightAsk': 'Czy lampa mrugnęła?', 'cf.lightOk': 'Światło działa.', 'cf.lightBo': 'Wyłączyłem blackout.', 'cf.lightGm': 'Master był prawie zero — ustawiłem 100%.',
      'cf.lightBad': 'Lampa nie reaguje.', 'cf.lightBadT': 'Sprawdź po kolei: 1) adres na lampie = adres w programie ({s}); 2) lampa w trybie DMX, a nie auto / muzyka / master-slave, z tą samą liczbą kanałów co w programie (np. 9CH albo 11CH); 3) kabel DMX idzie do gniazda DMX IN lampy; 4) inny program nie używa kabla. Potem „Powtórz test”.',
      'cf.openCh': 'Otwórz kanały lampy',
      'cf.move': 'Test ruchu', 'cf.move.w': 'Ruchome głowy powoli jadą w lewo i w prawo przez 4 sekundy. Popatrz, czy się ruszają.',
      'cf.moveAsk': 'Czy głowa się poruszyła?', 'cf.moveOk': 'Ruch działa.', 'cf.moveNone': 'Brak ruchomych głów — nic do sprawdzenia.',
      'cf.moveBad': 'Głowa się nie rusza.', 'cf.moveBadT': 'Otwórz „Kanały” i sprawdź, czy obrót (pan) i pochylenie (tilt) są na właściwych kanałach. Na lampie wyłącz tryb auto i blokadę ruchu.',
      'cf.hand': 'Gesty', 'cf.hand.w': 'Włączam tryb Gesty i sprawdzam, czy kamera widzi Twoją dłoń. Stań 1–3 m przed kamerą.',
      'cf.handShow': 'Pokaż otwartą dłoń do kamery… {s} s', 'cf.handPoint': 'Widzę dłoń! Teraz pokaż palec wskazujący… {s} s',
      'cf.handOk': 'Gesty działają — kamera widzi dłoń i palec.', 'cf.handPart': 'Kamera widzi dłoń, ale nie rozpoznała palca wskazującego.',
      'cf.handNo': 'Kamera nie widzi dłoni.', 'cf.handNoT': 'Dłoń cała w kadrze, 1–3 m od kamery, dobre światło na dłoń, bez mocnego światła za plecami. Kamera: {s}.',
      'cf.handSlow': 'Rozpoznawanie trwa {ms} ms na klatkę — zamknij inne programy, żeby gesty były szybsze.',
      'cf.done': 'Gotowe', 'cf.done.w': 'Zapisuję ustawienia i podpowiadam, co jeszcze warto zrobić.',
      'cf.saved': 'Ustawienia zapisane.', 'cf.calLamp': 'Kalibruj lampę', 'cf.calHand': 'Kalibruj dłoń', 'cf.toScene': 'Przejdź do sceny',
      'cf.calTip': 'Warto teraz skalibrować lampę (lewo/prawo/góra/dół), żeby wskazywanie palcem trafiało dokładnie.',
      'cf.qlcLook': 'Szukam Twoich lamp w pokazach QLC+…',
      'cf.qlcFound': 'Znalazłem lampy w QLC+ (plik {f}). Czy to te? Zaznacz i kliknij Dodaj.',
      'cf.qlcSure': 'pewne', 'cf.qlcGuess': 'do sprawdzenia', 'cf.qlcAddr': 'adres {a} · {n} kanałów', 'cf.qlcFrom': 'w QLC+: {s}',
      'cf.qlcReplace': 'zamieni: {s}', 'cf.qlcAdd': 'Dodaj zaznaczone', 'cf.qlcSelf': 'Wybiorę sam', 'cf.qlcNone': 'Zaznacz co najmniej jedną lampę.',
      'cf.qlcDone': 'Dodano z QLC+: {s}.',
      'cf.dmxRival': 'Kabel połączony ({s}), ale {r} też jest otwarty.', 'cf.dmxRivalT': 'Kabel może mieć naraz tylko jeden program. Teraz ma go Lumo, więc {r} nie steruje światłem. Najlepiej zamknij {r}, gdy używasz Lumo.',
      'cf.dmxBusy': 'Kabel zajęty przez {r}.', 'cf.dmxBusyT': 'Zamknij {r} (albo w nim wyłącz wyjście DMX USB) i kliknij „Spróbuj jeszcze raz”.',
      'cf.dmxWrong': 'Kabel był ustawiony jako „{a}”, a podłączony jest {b} — przełączam na właściwy tryb…',
      'cf.dmxRel': 'Kabel jest oddany innemu programowi. Przejąć go?', 'cf.dmxTake': 'Przejmij kabel', 'cf.dmxLeave': 'Zostaw',
      'rb.held': '{r} jest otwarty. Kabel DMX ma teraz Lumo, więc {r} nie może sterować światłem.',
      'rb.busy': '{r} jest otwarty i zajął kabel DMX — Lumo nie może sterować światłem. Zamknij {r} albo przejmij kabel.',
      'rb.rel': 'Kabel oddany programowi {r}. Lumo teraz nie steruje światłem. W {r} włącz wyjście: Wejście/Wyjście → Universe 1 → DMX USB.',
      'rb.give': 'Oddaj kabel programowi {r}', 'rb.take': 'Przejmij kabel', 'rb.ok': 'OK', 'rb.other': 'innemu programowi',
      'dev.rival': 'Wykryto {name} — kabel DMX może mieć naraz tylko jeden program.',
      'toast.dmxReleased': 'Kabel oddany — możesz sterować z innego programu.', 'toast.dmxTaken': 'Lumo znów steruje kablem DMX.',
      'dmx.wrongEnttec': 'Podłączony jest kabel FTDI Open DMX. Z protokołem Enttec Pro lampa dostanie błędne dane i nie będzie działać. Na pewno połączyć jako Enttec Pro?',
      'st.qlc': 'Wczytaj z QLC+', 'dg.rival': 'Inne programy do świateł', 'dg.rivalOff': 'brak — kabel tylko dla Lumo', 'dg.rivalOn': 'otwarty: {r}',
      'dg.rivalT': 'Kabel DMX może mieć naraz tylko jeden program. Zamknij {r} albo użyj „Oddaj kabel / Przejmij kabel”.',
      'cf.sceneBtn': 'Konfigurator — wszystko automatycznie', 'toast.spotOffMode': 'Reflektor na osobę wyłączony — możesz sterować gestami.',
    },
    it: {
      'st.wizard.n': 'Configuratore', 'st.wizard.s': 'tutto con un clic',
      'st.wizard.t': 'Configuratore', 'st.wizard.d': 'Premi Start — il programma trova da solo il cavo DMX e la camera, li collega, aggiunge la tua luce e prova luce, movimento e gesti. A ogni passo vedi cosa succede e cosa fare se qualcosa non va.',
      'cf.start': 'Start', 'cf.again': 'Avvia di nuovo', 'cf.stop': 'Ferma', 'cf.running': 'Configuro… passo {n} di {m}',
      'cf.idle': 'Pronto a partire. Ci vuole circa un minuto.', 'cf.summaryOk': 'Funziona tutto!', 'cf.summaryBad': 'Fatto. Da sistemare: {n}',
      'cf.retry': 'Riprova', 'cf.skip': 'Salta', 'cf.yes': 'Sì', 'cf.no': 'No', 'cf.repeat': 'Ripeti il test', 'cf.next': 'Avanti',
      'cf.wait': 'in attesa', 'cf.skipped': 'saltato', 'cf.rerun': 'Ricontrolla',
      'cf.server': 'Programma', 'cf.server.w': 'Controllo che la finestra sia collegata al programma e che giri l’ultima versione.',
      'cf.serverOk': 'Collegato al programma (ultima versione).', 'cf.serverOld': 'Il programma funziona, ma in una versione vecchia.',
      'cf.serverOldT': 'Chiudi la finestra nera del programma e avvia run.bat di nuovo — così si attivano tutte le nuove funzioni.',
      'cf.dmx': 'Cavo DMX', 'cf.dmx.w': 'Cerco l’interfaccia USB-DMX (FTDI Open DMX, ENTTEC, uDMX) e la collego al programma.',
      'cf.dmxOk': 'Cavo collegato: {s} · {hz} Hz', 'cf.dmxFound': 'Trovato: {s} — collego…', 'cf.dmxNone': 'Non vedo il cavo USB-DMX.',
      'cf.dmxNoneT': 'Collega il cavo a una porta USB e premi „Riprova”. Il cavo FTDI (Open DMX) di solito Windows lo riconosce da solo; se no, installa il driver FTDI CDM (ftdichip.com).',
      'cf.dmxFail': 'Collegamento non riuscito: {s}', 'cf.dmxFailT': 'Chiudi gli altri programmi per luci (QLC+, Freestyler, DMXControl) — un solo programma alla volta può usare il cavo. Poi scollega e ricollega il cavo.',
      'cf.cam': 'Camera', 'cf.cam.w': 'Controllo l’immagine della camera che vede le tue mani. Se non c’è, cerco una camera che funziona e la imposto.',
      'cf.camOk': 'La camera funziona: {s} · {f} fps', 'cf.camLow': 'La camera dà pochi fotogrammi ({f}/s) — i gesti saranno più lenti. Nell’app del telefono (Iriun) imposta 30 fps e buona luce.',
      'cf.camScan': 'Nessuna immagine — cerco le camere…', 'cf.camTry': 'Provo CAM {n}…', 'cf.camNone': 'Non ho trovato una camera funzionante.',
      'cf.camNoneT': 'Camera USB: collegala e premi „Riprova”. Telefono (Iriun / DroidCam): avvia l’app sul telefono e sul computer, entrambi sulla stessa rete Wi-Fi.',
      'cf.stage': 'Camera palco', 'cf.stage.w': 'La seconda camera è facoltativa. Se è impostata ma non dà immagine, la spengo perché non disturbi.',
      'cf.stageNone': 'Non usata (facoltativa).', 'cf.stageOk': 'Funziona.', 'cf.stageOff': 'La camera palco (CAM {n}) non dava immagine — l’ho spenta. La riaccendi in Impostazioni → Camere.',
      'cf.dev': 'Dispositivi', 'cf.dev.w': 'Controllo quali luci ci sono nel programma. Se non ce n’è nessuna, scegli quella che hai collegato e scrivi il suo indirizzo.',
      'cf.devOk': 'Dispositivi: {n} ({s}).', 'cf.devAsk': 'Quale luce hai collegato? Clicca il modello e scrivi lo stesso indirizzo DMX impostato sulla luce (es. A001 = 1).',
      'cf.devAddr': 'Indirizzo DMX', 'cf.devAdd': 'Aggiungi', 'cf.devPick': 'Prima clicca il modello della luce.', 'cf.devAdded': 'Aggiunto {n} all’indirizzo {a}.',
      'cf.devMore': 'Aggiungere un altro dispositivo?', 'cf.devMoreYes': 'Sì, aggiungi', 'cf.devMoreNo': 'No, avanti', 'cf.devNone': 'Nessun dispositivo — la luce non funzionerà.',
      'cf.devMode': 'Controlla sul display della luce la modalità canali — deve essere uguale al programma ({s} canali). Es. Tomshine: modalità 9CH = modello 9CH, 11CH = modello 11CH. Modalità diversa = la luce fa cose strane o non reagisce.',
      'cf.devConf': 'Indirizzi sovrapposti: {s}. Metterli in ordine?', 'cf.devConfOk': 'Indirizzi messi in ordine — imposta gli stessi sulle luci.',
      'cf.light': 'Test luce', 'cf.light.w': 'Tutte le luci lampeggiano per 3 secondi. Guardale.',
      'cf.lightAsk': 'La luce ha lampeggiato?', 'cf.lightOk': 'La luce funziona.', 'cf.lightBo': 'Ho tolto il blackout.', 'cf.lightGm': 'Il master era quasi a zero — l’ho messo al 100%.',
      'cf.lightBad': 'La luce non reagisce.', 'cf.lightBadT': 'Controlla: 1) indirizzo sulla luce = indirizzo nel programma ({s}); 2) luce in modalità DMX, non auto / musica / master-slave, con lo stesso numero di canali del programma (es. 9CH o 11CH); 3) il cavo DMX va nella presa DMX IN della luce; 4) nessun altro programma usa il cavo. Poi „Ripeti il test”.',
      'cf.openCh': 'Apri i canali della luce',
      'cf.move': 'Test movimento', 'cf.move.w': 'Le teste mobili vanno piano a sinistra e a destra per 4 secondi. Guarda se si muovono.',
      'cf.moveAsk': 'La testa si è mossa?', 'cf.moveOk': 'Il movimento funziona.', 'cf.moveNone': 'Nessuna testa mobile — niente da provare.',
      'cf.moveBad': 'La testa non si muove.', 'cf.moveBadT': 'Apri „Canali” e controlla che rotazione (pan) e inclinazione (tilt) siano sui canali giusti. Sulla luce spegni la modalità auto e il blocco del movimento.',
      'cf.hand': 'Gesti', 'cf.hand.w': 'Attivo la modalità Gesti e controllo che la camera veda la tua mano. Stai a 1–3 m dalla camera.',
      'cf.handShow': 'Mostra la mano aperta alla camera… {s} s', 'cf.handPoint': 'Vedo la mano! Ora mostra l’indice… {s} s',
      'cf.handOk': 'I gesti funzionano — la camera vede mano e dito.', 'cf.handPart': 'La camera vede la mano, ma non ha riconosciuto l’indice.',
      'cf.handNo': 'La camera non vede la mano.', 'cf.handNoT': 'Mano tutta nell’inquadratura, a 1–3 m, buona luce sulla mano, niente luce forte alle spalle. Camera: {s}.',
      'cf.handSlow': 'Il riconoscimento richiede {ms} ms per fotogramma — chiudi gli altri programmi per gesti più veloci.',
      'cf.done': 'Fatto', 'cf.done.w': 'Salvo le impostazioni e suggerisco cosa conviene ancora fare.',
      'cf.saved': 'Impostazioni salvate.', 'cf.calLamp': 'Calibra la luce', 'cf.calHand': 'Calibra la mano', 'cf.toScene': 'Vai al palco',
      'cf.calTip': 'Conviene calibrare ora la luce (sinistra/destra/alto/basso), così puntare con il dito è preciso.',
      'cf.qlcLook': 'Cerco le tue luci negli show di QLC+…',
      'cf.qlcFound': 'Ho trovato luci in QLC+ (file {f}). Sono queste? Seleziona e premi Aggiungi.',
      'cf.qlcSure': 'sicuro', 'cf.qlcGuess': 'da controllare', 'cf.qlcAddr': 'indirizzo {a} · {n} canali', 'cf.qlcFrom': 'in QLC+: {s}',
      'cf.qlcReplace': 'sostituisce: {s}', 'cf.qlcAdd': 'Aggiungi selezionate', 'cf.qlcSelf': 'Scelgo io', 'cf.qlcNone': 'Seleziona almeno una luce.',
      'cf.qlcDone': 'Aggiunto da QLC+: {s}.',
      'cf.dmxRival': 'Cavo collegato ({s}), ma anche {r} è aperto.', 'cf.dmxRivalT': 'Il cavo può averlo un solo programma alla volta. Ora ce l’ha Lumo, quindi {r} non controlla la luce. Meglio chiudere {r} quando usi Lumo.',
      'cf.dmxBusy': 'Cavo occupato da {r}.', 'cf.dmxBusyT': 'Chiudi {r} (o disattiva la sua uscita DMX USB) e premi „Riprova”.',
      'cf.dmxWrong': 'Il cavo era impostato come „{a}”, ma è collegato {b} — passo alla modalità giusta…',
      'cf.dmxRel': 'Il cavo è ceduto a un altro programma. Riprenderlo?', 'cf.dmxTake': 'Riprendi il cavo', 'cf.dmxLeave': 'Lascia',
      'rb.held': '{r} è aperto. Il cavo DMX ora ce l’ha Lumo, quindi {r} non può controllare la luce.',
      'rb.busy': '{r} è aperto e ha preso il cavo DMX — Lumo non può controllare la luce. Chiudi {r} o riprendi il cavo.',
      'rb.rel': 'Cavo ceduto a {r}. Lumo ora non controlla la luce. In {r} attiva l’uscita: Ingressi/Uscite → Universe 1 → DMX USB.',
      'rb.give': 'Cedi il cavo a {r}', 'rb.take': 'Riprendi il cavo', 'rb.ok': 'OK', 'rb.other': 'un altro programma',
      'dev.rival': 'Rilevato {name} — il cavo DMX può averlo un solo programma alla volta.',
      'toast.dmxReleased': 'Cavo ceduto — puoi controllare da un altro programma.', 'toast.dmxTaken': 'Lumo controlla di nuovo il cavo DMX.',
      'dmx.wrongEnttec': 'È collegato un cavo FTDI Open DMX. Con il protocollo Enttec Pro la luce riceve dati sbagliati e non funziona. Collegare davvero come Enttec Pro?',
      'st.qlc': 'Carica da QLC+', 'dg.rival': 'Altri programmi per luci', 'dg.rivalOff': 'nessuno — cavo solo per Lumo', 'dg.rivalOn': 'aperto: {r}',
      'dg.rivalT': 'Il cavo DMX può averlo un solo programma alla volta. Chiudi {r} o usa „Cedi / Riprendi il cavo”.',
      'cf.sceneBtn': 'Configuratore — tutto automatico', 'toast.spotOffMode': 'Occhio di bue spento — puoi usare i gesti.',
    },
  });

  const STEPS = [['server', 'plug'], ['dmx', 'usb'], ['cam', 'camera'], ['stage', 'camera'], ['dev', 'lamp'], ['light', 'sun'], ['move', 'move'], ['hand', 'hand'], ['done', 'check']];
  const CF = { steps: {}, running: false, abort: false, cur: null, finished: false };
  const reset = () => { for (const [id] of STEPS) CF.steps[id] = { state: 'wait', msg: '', tip: '', ask: null }; CF.finished = false; };
  reset();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = (pred, ms) => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      let ok = false; try { ok = !!(S.st && pred(S.st)); } catch (e) { ok = false; }
      if (ok) res(true); else if (CF.abort || performance.now() - t0 > ms) res(false); else setTimeout(tick, 200);
    };
    tick();
  });
  const set = (id, state, msg = '', tip = '') => { Object.assign(CF.steps[id], { state, msg, tip }); render(); };
  const heads = (st) => st.fixtures.filter((f) => (f.type || 'moving_head') === 'moving_head' && f.channels.includes('pan'));
  const lights = (st) => st.fixtures.filter((f) => f.type !== 'smoke' && f.type !== 'laser');
  // a question inside the step card; resolves with the chosen value
  const ask = (id, html, bind) => new Promise((resolve) => {
    CF.steps[id].ask = { html, bind: (box) => bind(box, (v) => { CF.steps[id].ask = null; resolve(v); render(); }) };
    render();
  });
  const buttons = (list) => `<div class="cf-btns">${list.map(([v, label, cls]) => `<button class="btn ${cls || ''}" data-v="${esc(v)}">${esc(label)}</button>`).join('')}</div>`;
  const askButtons = (id, list) => ask(id, buttons(list), (box, done) => { for (const b of $$('[data-v]', box)) b.onclick = () => done(b.dataset.v); });

  /* ------------------------------------------------------------ steps */
  async function stepServer() {
    const ok = await waitFor((st) => S.connected && st.fixtures, 5000);
    if (!ok) return set('server', 'err', t('cf.serverOld'), t('cf.serverOldT'));
    if (!('speed_scale' in (S.st.effects || {}))) return set('server', 'warn', t('cf.serverOld'), t('cf.serverOldT'));
    return set('server', 'ok', t('cf.serverOk'));
  }
  async function stepDmx() {
    const good = (st) => st.dmx.ok && st.dmx.config.backend !== 'sim';
    const rivals = () => (S.st.dmx_rivals || []).join(', ');
    if (PH.doctor && !S.st.dmx.released) await PH.doctor(true);
    if (S.st.dmx.released) {
      set('dmx', 'ask', t('cf.dmxRel'));
      if (await askButtons('dmx', [['take', t('cf.dmxTake'), 'primary'], ['leave', t('cf.dmxLeave')]]) !== 'take') return set('dmx', 'warn', t('rb.rel', { r: rivals() || t('rb.other') }));
      send({ type: 'dmx_take' });
      await waitFor(good, 7000);
    }
    const det = (S.st.devices || []).find((d) => d.kind === 'dmx' && d.backend);
    if (det && good(S.st) && S.st.dmx.config.backend !== det.backend && det.port === S.st.dmx.config.port) {
      // e.g. an FTDI Open DMX cable used with the ENTTEC Pro protocol: the lamp gets garbage
      set('dmx', 'run', t('cf.dmxWrong', { a: S.st.dmx.config.backend, b: det.name }));
      send({ type: 'dmx_output', backend: det.backend, port: det.port });
      await sleep(800); await waitFor(good, 7000);
    }
    if (good(S.st) && rivals()) return set('dmx', 'warn', t('cf.dmxRival', { s: S.st.dmx.label || S.st.dmx.status, r: rivals() }), t('cf.dmxRivalT', { r: rivals() }));
    if (good(S.st)) return set('dmx', 'ok', t('cf.dmxOk', { s: S.st.dmx.label || S.st.dmx.status, hz: Math.round(S.st.dmx.send_hz || 50) }));
    send({ type: 'list_ports' });
    await sleep(1500);
    const dev = (S.st.devices || []).find((d) => d.kind === 'dmx' && d.backend);
    if (!dev) return set('dmx', 'err', t('cf.dmxNone'), t('cf.dmxNoneT'));
    set('dmx', 'run', t('cf.dmxFound', { s: `${dev.name} (${dev.port})` }));
    send({ type: 'dmx_output', backend: dev.backend, port: dev.port === 'USB' ? undefined : dev.port });
    if (await waitFor(good, 7000)) return set('dmx', 'ok', t('cf.dmxOk', { s: S.st.dmx.label || S.st.dmx.status, hz: Math.round(S.st.dmx.send_hz || 50) }));
    if (rivals()) return set('dmx', 'err', t('cf.dmxBusy', { r: rivals() }), t('cf.dmxBusyT', { r: rivals() }));
    return set('dmx', 'err', t('cf.dmxFail', { s: S.st.dmx.status }), t('cf.dmxFailT'));
  }
  async function stepCam() {
    const online = (st) => st.video.state === 'online' && st.video.fps > 0.5;     // connected but no frames = not working
    const okMsg = () => {
      const v = S.st.video, low = v.fps < 15;
      set('cam', low ? 'warn' : 'ok', t('cf.camOk', { s: `${v.width}×${v.height}`, f: Math.round(v.fps) }), low ? t('cf.camLow', { f: Math.round(v.fps) }) : '');
    };
    if (await waitFor(online, 3000)) { await sleep(400); return okMsg(); }
    set('cam', 'run', t('cf.camScan'));
    const cams = await new Promise((resolve) => {
      const prev = PH.onCameras;
      const timer = setTimeout(() => { PH.onCameras = prev; resolve(S.cameras || []); }, 15000);
      PH.onCameras = () => { clearTimeout(timer); PH.onCameras = prev; if (prev) prev(); resolve(S.cameras || []); };
      send({ type: 'scan_cameras' });
    });
    const stageSrc = (S.st.stagecam || {}).source;
    for (const c of cams.filter((x) => x.ok && x.index !== stageSrc)) {
      set('cam', 'run', t('cf.camTry', { n: c.index }));
      send({ type: 'source', source: c.index });
      if (await waitFor(online, 8000)) { send({ type: 'save' }); return okMsg(); }
    }
    return set('cam', 'err', t('cf.camNone'), t('cf.camNoneT'));
  }
  async function stepStage() {
    const sc = S.st.stagecam || {};
    if (sc.source === null || sc.source === undefined) return set('stage', 'skip', t('cf.stageNone'));
    if (await waitFor((st) => (st.stagecam || {}).state === 'online', 4000)) return set('stage', 'ok', t('cf.stageOk'));
    send({ type: 'stagecam_source', source: null }); send({ type: 'save' });
    return set('stage', 'warn', t('cf.stageOff', { n: sc.source }));
  }
  const qlcScan = () => new Promise((resolve) => {
    const timer = setTimeout(() => { PH.onQlc = null; resolve({ fixtures: [] }); }, 8000);
    PH.onQlc = (m) => { clearTimeout(timer); PH.onQlc = null; resolve(m); };
    send({ type: 'qlc_scan' });
  });
  const overlaps = (f, a, n) => f.address <= a + n - 1 && a <= f.address + f.footprint - 1;
  async function fromQlc() {
    set('dev', 'run', t('cf.qlcLook'));
    const q = await qlcScan();
    const sugg = (q.fixtures || []).filter((x) => x.key && !S.st.fixtures.some((f) => f.address === x.address && f.library_key === x.key));
    if (!sugg.length) return false;
    set('dev', 'ask', t('cf.qlcFound', { f: sugg[0].file }));
    const pick = await ask('dev', `<div class="qlc-list">${sugg.map((x, i) => {
        const bad = S.st.fixtures.filter((f) => overlaps(f, x.address, x.channels));
        return `<label class="qlc-row"><input type="checkbox" data-i="${i}" ${x.sure ? 'checked' : ''}>
          <span class="dev-ic">${ic('lamp')}</span><span><b>${esc(x.model)}</b><small>${esc(t('cf.qlcAddr', { a: x.address, n: x.channels }))} · ${esc(t('cf.qlcFrom', { s: x.name }))}</small>
          ${bad.length ? `<small class="rep">${esc(t('cf.qlcReplace', { s: bad.map((f) => f.name).join(', ') }))}</small>` : ''}</span>
          <span class="tagc ${x.sure ? 'ok' : 'warn'}">${esc(t(x.sure ? 'cf.qlcSure' : 'cf.qlcGuess'))}</span></label>`;
      }).join('')}</div>
      <div class="cf-btns"><button class="btn primary" data-add>${ic('plus')}<span>${esc(t('cf.qlcAdd'))}</span></button><button class="btn" data-self>${esc(t('cf.qlcSelf'))}</button></div>`,
    (box, done) => {
      $('[data-add]', box).onclick = () => {
        const chosen = $$('input[data-i]', box).filter((c) => c.checked).map((c) => sugg[Number(c.dataset.i)]);
        if (!chosen.length) { toast(t('cf.qlcNone'), 'warn'); return; }
        done(chosen);
      };
      $('[data-self]', box).onclick = () => done(null);
    });
    if (!pick) return false;
    for (const x of pick) {                                  // the wrong lamp on the same channels goes away
      for (const f of S.st.fixtures.filter((ff) => overlaps(ff, x.address, x.channels))) send({ type: 'remove_fixture', id: f.id });
    }
    await sleep(500);
    for (const x of pick) {
      const e = (S.library || []).find((l) => l.key === x.key);
      const n0 = S.st.fixtures.length;
      send({ type: 'add_fixture', library_key: x.key, address: x.address, mount: (e && e.mount) || 'floor' });
      await waitFor((st) => st.fixtures.length > n0, 5000);
    }
    set('dev', 'run', t('cf.qlcDone', { s: pick.map((x) => `${x.model} ${x.address}`).join(', ') }));
    return true;
  }
  PH.qlcImport = () => { PH.setTab('setup'); PH.setupGo('wizard'); runOne('dev'); };
  async function stepDev() {
    const names = (st) => st.fixtures.map((f) => `${f.name} ${f.address}`).join(', ');
    await fromQlc();
    while (!S.st.fixtures.length || CF.addMore) {
      CF.addMore = false;
      set('dev', 'ask', t('cf.devAsk'));
      const lib = [...(S.library || [])].sort((a, b) => (a.key === 'mini-spot-9' ? -1 : b.key === 'mini-spot-9' ? 1 : 0) || (a.type === 'moving_head' ? -1 : 0));
      const next = S.st.fixtures.reduce((m, f) => Math.max(m, f.address + f.footprint), 1);
      const pick = await ask('dev', `<div class="cf-lib">${lib.map((e) => `<button class="lib-card" data-key="${esc(e.key)}"><span class="ico">${ic(e.type === 'smoke' ? 'smoke' : e.type === 'laser' ? 'laser' : e.type === 'par' ? 'par' : e.type === 'bar' ? 'bar' : 'lamp')}</span>
          <span><b>${esc(e.model)}</b><small>${e.channels.length} ch · ${esc(t('type.' + e.type))}</small></span></button>`).join('')}</div>
        <div class="cf-btns"><label class="lbl">${esc(t('cf.devAddr'))} <input type="number" id="cf-addr" min="1" max="512" value="${next}" style="width:90px"></label>
          <button class="btn primary" data-add>${ic('plus')}<span>${esc(t('cf.devAdd'))}</span></button><button class="btn" data-skip>${esc(t('cf.skip'))}</button></div>`,
      (box, done) => {
        let key = null;
        for (const c of $$('.lib-card', box)) c.onclick = () => { key = c.dataset.key; $$('.lib-card', box).forEach((x) => x.classList.toggle('on', x === c)); };
        $('[data-add]', box).onclick = () => { if (!key) { toast(t('cf.devPick'), 'warn'); return; } done({ key, addr: Number($('#cf-addr', box).value) || 1 }); };
        $('[data-skip]', box).onclick = () => done(null);
      });
      if (!pick) break;
      const e = (S.library || []).find((x) => x.key === pick.key);
      const n0 = S.st.fixtures.length;
      send({ type: 'add_fixture', library_key: pick.key, address: pick.addr, mount: (e && e.mount) || 'hang' });
      if (await waitFor((st) => st.fixtures.length > n0, 5000)) {
        const f = S.st.fixtures[S.st.fixtures.length - 1];
        set('dev', 'run', t('cf.devAdded', { n: f.name, a: f.address }));
        const more = await askButtons('dev', [['yes', t('cf.devMoreYes')], ['no', t('cf.devMoreNo'), 'primary']]);
        if (more === 'yes') CF.addMore = true;
      }
    }
    if (!S.st.fixtures.length) return set('dev', 'err', t('cf.devNone'));
    const conf = S.st.dmx.conflicts || [];
    if (conf.length) {
      set('dev', 'ask', t('cf.devConf', { s: conf.join(', ') }));
      if (await askButtons('dev', [['yes', t('cf.yes'), 'primary'], ['no', t('cf.no')]]) === 'yes') {
        let a = 1;
        for (const f of [...S.st.fixtures].sort((x, y) => x.address - y.address || x.id - y.id)) {
          if (f.address !== a) send({ type: 'update_fixture', id: f.id, address: a });
          a += f.footprint;
        }
        await sleep(600);
        return set('dev', 'ok', t('cf.devOk', { n: S.st.fixtures.length, s: names(S.st) }), t('cf.devConfOk'));
      }
      return set('dev', 'warn', t('cf.devOk', { n: S.st.fixtures.length, s: names(S.st) }), t('cf.devConf', { s: conf.join(', ') }));
    }
    return set('dev', 'ok', t('cf.devOk', { n: S.st.fixtures.length, s: names(S.st) }),
      t('cf.devMode', { s: S.st.fixtures.map((f) => `${f.name} = ${f.footprint}`).join(', ') }));
  }
  async function stepLight() {
    const L = lights(S.st);
    if (!L.length) return set('light', 'skip', t('cf.devNone'));
    const fixes = [];
    if (S.st.blackout) { send({ type: 'blackout', value: false }); fixes.push(t('cf.lightBo')); }
    if (S.st.grand_master < 60) { send({ type: 'grand_master', value: 255 }); fixes.push(t('cf.lightGm')); }
    for (;;) {
      set('light', 'run', [t('cf.light.w'), ...fixes].join(' '));
      send({ type: 'fx_start', id: 'cf-blink', kind: 'blink', params: { speed: 3 }, targets: 'all', duration: 3 });
      await sleep(900);
      set('light', 'ask', t('cf.lightAsk'));
      const a = await askButtons('light', [['yes', t('cf.yes'), 'primary'], ['no', t('cf.no')], ['again', t('cf.repeat')]]);
      if (a === 'yes') return set('light', 'ok', [t('cf.lightOk'), ...fixes].join(' '));
      if (a === 'again') continue;
      set('light', 'err', t('cf.lightBad'), t('cf.lightBadT', { s: L.map((f) => `${f.name} = ${f.address}`).join(', ') }));
      const b = await askButtons('light', [['again', t('cf.repeat'), 'primary'], ['ch', t('cf.openCh')], ['skip', t('cf.skip')]]);
      if (b === 'ch' && PH.openChannels) { PH.openChannels(L[0]); await askButtons('light', [['again', t('cf.repeat'), 'primary'], ['skip', t('cf.skip')]]).then((c) => { if (c === 'skip') CF.skipLight = true; }); if (CF.skipLight) { CF.skipLight = false; return; } continue; }
      if (b === 'skip') return;
    }
  }
  async function stepMove() {
    const H = heads(S.st);
    if (!H.length) return set('move', 'skip', t('cf.moveNone'));
    const ids = H.map((f) => f.id), before = H.map((f) => [f.id, f.values.dimmer]);
    for (;;) {
      set('move', 'run', t('cf.move.w'));
      send({ type: 'set', id: ids, param: 'dimmer', value: 200 });
      send({ type: 'fx_start', id: 'cf-move', kind: 'sweep', params: { speed: 0.5, size: 60 }, targets: ids, duration: 4 });
      await sleep(1200);
      set('move', 'ask', t('cf.moveAsk'));
      const a = await askButtons('move', [['yes', t('cf.yes'), 'primary'], ['no', t('cf.no')], ['again', t('cf.repeat')]]);
      for (const [id, v] of before) send({ type: 'set', id, param: 'dimmer', value: v });
      if (a === 'yes') return set('move', 'ok', t('cf.moveOk'));
      if (a === 'again') continue;
      set('move', 'err', t('cf.moveBad'), t('cf.moveBadT'));
      const b = await askButtons('move', [['again', t('cf.repeat'), 'primary'], ['ch', t('cf.openCh')], ['skip', t('cf.skip')]]);
      if (b === 'ch' && PH.openChannels) { PH.openChannels(H[0]); return; }
      if (b === 'skip') return;
    }
  }
  async function stepHand() {
    send({ type: 'mode', mode: 'gesture' });
    CF.preview = true; S.forceVideo = true;
    const hands = (st) => (st.vision.perception.hands || []);
    const count = async (key, pred, secs) => {
      const t0 = performance.now();
      for (;;) {
        const left = Math.max(0, Math.ceil(secs - (performance.now() - t0) / 1000));
        CF.steps.hand.msg = t(key, { s: left }); updateLive();
        if (S.st && pred(S.st)) return true;
        if (left <= 0 || CF.abort) return false;
        await sleep(200);
      }
    };
    set('hand', 'run', t('cf.handShow', { s: 15 }));
    const seen = await count('cf.handShow', (st) => hands(st).length > 0, 15);
    if (!seen) { CF.preview = false; return set('hand', 'err', t('cf.handNo'), t('cf.handNoT', { s: S.st.video.state === 'online' ? `${Math.round(S.st.video.fps)} kl./s` : t('cf.camNone') })); }
    const point = await count('cf.handPoint', (st) => hands(st).some((h) => h.gesture === 'point'), 12);
    CF.preview = false;
    const ms = Math.round(S.st.vision.proc_ms || 0);
    if (!point) return set('hand', 'warn', t('cf.handPart'), t('cf.handNoT', { s: `${Math.round(S.st.video.fps)} kl./s` }));
    return set('hand', ms > 60 ? 'warn' : 'ok', t('cf.handOk'), ms > 60 ? t('cf.handSlow', { ms }) : '');
  }
  async function stepDone() {
    send({ type: 'save' });
    set('done', 'ok', t('cf.saved'));
  }
  const RUN = { server: stepServer, dmx: stepDmx, cam: stepCam, stage: stepStage, dev: stepDev, light: stepLight, move: stepMove, hand: stepHand, done: stepDone };

  async function run() {
    if (CF.running) return;
    reset(); CF.running = true; CF.abort = false; render();
    try {
      for (const [id] of STEPS) {
        if (CF.abort) break;
        CF.cur = id; set(id, 'run', t(`cf.${id}.w`));
        for (;;) {
          await RUN[id]();
          const st = CF.steps[id].state;
          if (st === 'run' || st === 'ask') { set(id, 'skip', t('cf.skipped')); break; }
          if (st !== 'err' || CF.abort || id === 'light' || id === 'move' || id === 'hand') break;
          const a = await askButtons(id, [['retry', t('cf.retry'), 'primary'], ['skip', t('cf.skip')]]);
          if (a !== 'retry') break;
          set(id, 'run', t(`cf.${id}.w`));
        }
      }
    } finally {
      CF.running = false; CF.cur = null; CF.finished = true; CF.preview = false; render();
    }
  }

  async function runOne(id) {                // "Sprawdź ponownie" on a single step
    if (CF.running) return;
    CF.running = true; CF.abort = false; CF.cur = id; set(id, 'run', t(`cf.${id}.w`));
    try {
      await RUN[id]();
      if (['run', 'ask'].includes(CF.steps[id].state)) set(id, 'skip', t('cf.skipped'));
    } finally { CF.running = false; CF.cur = null; CF.preview = false; render(); }
  }
  PH.cfRunStep = runOne;

  /* ------------------------------------------------------------ view */
  const STATE_IC = { ok: 'check', warn: 'warn', err: 'close', skip: 'minus' };
  function render() {
    const box = $('#st-wizard'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.id === 'cf-addr') return;
    const n = STEPS.findIndex(([id]) => id === CF.cur) + 1;
    const bad = STEPS.filter(([id]) => ['err', 'warn'].includes(CF.steps[id].state)).length;
    const doneN = STEPS.filter(([id]) => ['ok', 'warn', 'err', 'skip'].includes(CF.steps[id].state)).length;
    const hs = S.st ? heads(S.st).filter((f) => !f.aim_pan) : [];
    box.innerHTML = `<div class="cf-hero">
        <div class="grow"><b>${esc(CF.running ? t('cf.running', { n, m: STEPS.length }) : CF.finished ? (bad ? t('cf.summaryBad', { n: bad }) : t('cf.summaryOk')) : t('cf.idle'))}</b>
          <div class="cf-bar"><i style="width:${Math.round(doneN / STEPS.length * 100)}%"></i></div></div>
        ${CF.running ? `<button class="btn" id="cf-stop">${ic('stop')}<span>${esc(t('cf.stop'))}</span></button>`
          : `<button class="btn primary big-btn" id="cf-go">${ic(CF.finished ? 'refresh' : 'play')}<span>${esc(t(CF.finished ? 'cf.again' : 'cf.start'))}</span></button>`}</div>
      <div class="cf-list">${STEPS.map(([id, icon]) => {
        const s = CF.steps[id];
        return `<div class="cf-step s-${s.state}${CF.cur === id ? ' cur' : ''}" data-step="${id}">
          <span class="cf-ic">${s.state === 'run' || s.state === 'ask' ? `<i class="cf-spin"></i>` : ic(STATE_IC[s.state] || icon)}</span>
          <div class="cf-body"><b>${esc(t(`cf.${id}`))}</b><p class="cf-what">${esc(t(`cf.${id}.w`))}</p>
            ${s.msg && s.msg !== t(`cf.${id}.w`) ? `<div class="cf-msg">${esc(s.msg)}</div>` : ''}${s.tip ? `<div class="cf-tip">${ic('info')}<span>${esc(s.tip)}</span></div>` : ''}
            ${id === 'hand' && CF.preview ? '<canvas id="cf-cv" class="cf-cv"></canvas>' : ''}
            ${s.ask ? `<div class="cf-ask">${s.ask.html}</div>` : ''}
            ${!CF.running && id !== 'done' && ['ok', 'warn', 'err', 'skip'].includes(s.state) ? `<button class="cf-again" data-rerun="${id}">${ic('refresh')}<span>${esc(t('cf.rerun'))}</span></button>` : ''}
            ${id === 'done' && CF.finished ? `<div class="cf-btns">${hs.length ? `<button class="btn primary" id="cf-cal">${ic('sparkle')}<span>${esc(t('cf.calLamp'))}</span></button>` : ''}
              <button class="btn" id="cf-hcal">${ic('hand')}<span>${esc(t('cf.calHand'))}</span></button>
              <button class="btn" id="cf-scene">${ic('scene')}<span>${esc(t('cf.toScene'))}</span></button></div>${hs.length ? `<div class="cf-tip">${ic('info')}<span>${esc(t('cf.calTip'))}</span></div>` : ''}` : ''}
          </div></div>`;
      }).join('')}</div>`;
    const go = $('#cf-go', box); if (go) go.onclick = run;
    for (const b of $$('[data-rerun]', box)) b.onclick = () => runOne(b.dataset.rerun);
    const stop = $('#cf-stop', box); if (stop) stop.onclick = () => { CF.abort = true; for (const [id] of STEPS) { const s = CF.steps[id]; if (s.ask) { const a = s.ask; s.ask = null; a.bind(document.createElement('div')); } } };
    for (const [id] of STEPS) { const s = CF.steps[id]; if (s.ask) s.ask.bind($(`.cf-step[data-step="${id}"] .cf-ask`, box)); }
    const cal = $('#cf-cal', box); if (cal) cal.onclick = () => PH.calibrate && PH.calibrate(hs.map((f) => f.id));
    const hcal = $('#cf-hcal', box); if (hcal) hcal.onclick = () => PH.setupGo('hand');
    const sc = $('#cf-scene', box); if (sc) sc.onclick = () => PH.setTab('scene');
    const cur = $('.cf-step.cur', box); if (cur && CF.running) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function updateLive() {                 // countdown text without rebuilding the card (keeps the preview canvas)
    const m = $('.cf-step[data-step="hand"] .cf-msg');
    if (m) m.textContent = CF.steps.hand.msg; else render();
  }
  function drawPreview() {
    const cv = $('#cf-cv');
    if (cv && CF.preview && S.st) {
      const [W, H, d] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
      ctx.fillStyle = '#16161d'; ctx.fillRect(0, 0, W, H);
      if (S.bitmap) { try { ctx.drawImage(S.bitmap, 0, 0, W, H); } catch (e) { /* not ready */ } }
      for (const h of S.st.vision.perception.hands || []) {
        if (!h.index_tip) continue;
        const [x, y] = h.index_tip;
        ctx.fillStyle = h.gesture === 'point' ? '#3ecf8e' : '#9b6cff';
        ctx.beginPath(); ctx.arc(x * W, y * H, 10 * d, 0, 7); ctx.fill();
      }
    }
    requestAnimationFrame(drawPreview);
  }
  requestAnimationFrame(drawPreview);

  PH.setupPanes = PH.setupPanes || {};
  PH.setupPanes.wizard = (st, force) => { if (force || !$('#st-wizard').innerHTML) render(); };
  PH.startConfigurator = () => { PH.setTab('setup'); PH.setupGo('wizard'); if (!CF.running) run(); };
  PH.onState.push(() => { if (CF.preview) S.forceVideo = true; });
  const sw = $('#scene-wiz'); if (sw) sw.onclick = () => PH.startConfigurator();

  /* ------------------------------------------------------------ another light program holds / wants the cable */
  const RB = { sig: '', hidden: '' };
  const bar = document.createElement('div'); bar.className = 'rival-bar'; bar.hidden = true; document.body.appendChild(bar);
  PH.onState.push((st) => {
    const r = (st.dmx_rivals || []).join(', '), rel = !!st.dmx.released;
    const kind = rel ? 'rel' : r ? (st.dmx.ok ? 'held' : 'busy') : '';
    const sig = `${kind}|${r}|${PH.lang}`;
    if (sig === RB.sig) return;
    RB.sig = sig;
    if (!kind || RB.hidden === sig) { bar.hidden = true; return; }
    const name = r || t('rb.other');
    const btns = kind === 'held' ? [['give', t('rb.give', { r: name }), ''], ['hide', t('rb.ok'), '']] : [['take', t('rb.take'), 'primary']];
    bar.innerHTML = `${ic(kind === 'held' ? 'info' : 'warn')}<span>${esc(t(`rb.${kind}`, { r: name }))}</span>
      ${btns.map(([v, l, c]) => `<button class="btn sm ${c}" data-rb="${v}">${esc(l)}</button>`).join('')}`;
    bar.className = `rival-bar ${kind}`; bar.hidden = false;
    for (const b of $$('[data-rb]', bar)) b.onclick = () => {
      if (b.dataset.rb === 'give') send({ type: 'dmx_release' });
      else if (b.dataset.rb === 'take') send({ type: 'dmx_take' });
      else { RB.hidden = sig; bar.hidden = true; }
    };
  });
})();
