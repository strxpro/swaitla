/* Lumo — browser console (single viewport, tabs)
 * WebSocket: binary = JPEG frame, text = JSON (state / toast / cameras / ports)
 * Tabs: Scena 3D (stage3d.js) · Dłoń (depth hand view) · Mikser (faders) · Ustawienia
 */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const pad3 = (n) => String(Math.round(n)).padStart(3, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const C = { cyan: '#06b6d4', hand: '#00f3ff', amber: '#f59e0b', green: '#10b981', red: '#ef4444', dim: '#8d94a1', mute: '#59606c', line: '#262b34', grid: '#1c2027' };
const HAND_EDGES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const BONE_W = { 1: 1.1, 2: 0.95, 3: 0.8, 4: 0.68 };       // thickness by joint index inside a finger
const GESTURE_PL = { point: 'Wskaż', dimmer: 'Dłoń', crossfade: 'Bokiem', strobe: 'Pięść', color: 'OK', none: '—' };
const GESTURE_COLOR = { point: C.cyan, dimmer: C.amber, crossfade: C.green, strobe: C.red, color: '#ffffff', none: C.mute };
const FLOOR_CORNERS_PL = ['Przód, lewo', 'Przód, prawo', 'Tył, prawo', 'Tył, lewo'];
const FLOOR_CORNERS_IT = ['Avanti, sinistra', 'Avanti, destra', 'Dietro, destra', 'Dietro, sinistra'];

/* ---------------------------------------------------------------- i18n (PL / IT) */
const I18N = {
  pl: {
    'tab.scene': 'Scena 3D', 'tab.hand': 'Dłoń', 'tab.mixer': 'Mikser', 'tab.setup': 'Ustawienia', 'tab.music': 'Muzyka',
    'mu.live': 'Muzyka na żywo z miksera', 'mu.sens': 'Czułość bitu', 'mu.react': 'Reakcja świateł na bit',
    'mu.r.flash': 'Flash na bit', 'mu.r.color': 'Kolor na bit', 'mu.r.move': 'Ruch na bit', 'mu.r.drop': 'Strobe na dropie',
    'mu.hint': 'Podłącz wyjście miksera (REC / BOOTH / AUX) do wejścia liniowego komputera albo karty dźwiękowej, wybierz je na liście i kliknij Start.',
    'mu.fx': 'Efekty — kliknij, żeby włączyć albo wyłączyć', 'mu.stopall': 'Zatrzymaj wszystkie', 'mu.speed': 'Tempo', 'mu.size': 'Zasięg ruchu',
    'mu.tl': 'Oś czasu pokazu', 'mu.load': 'Wczytaj utwór', 'mu.auto': 'Auto-show z bitów',
    'mu.clear': 'Wyczyść', 'mu.save': 'Zapisz', 'mu.open': 'Otwórz', 'mu.del': 'Usuń',
    'pill.camera': 'Kamera', 'pill.vision': 'Wizja', 'pill.dmx': 'DMX', 'pill.fixture': 'Lampa',
    'scene.add': '+ Dodaj urządzenie', 'scene.hint': 'Przeciągnij lampę = przesuń · klik = wybierz · Shift+klik na podłogę = celuj',
    'scene.empty.title': 'Scena jest pusta', 'scene.empty.text': 'Wybierz model urządzenia, a potem kliknij na scenie, gdzie stoi albo wisi.',
    'scene.placing': 'Kliknij na scenie, gdzie ma stać urządzenie',
    'view.front': 'Przód', 'view.top': 'Góra', 'view.side': 'Bok', 'view.fx': 'Lampa',
    'dir.front': 'Przód', 'dir.right': 'Prawo', 'dir.back': 'Tył', 'dir.left': 'Lewo',
    'insp.address': 'Adres DMX', 'insp.mount': 'Montaż', 'insp.hang': 'Wisząca', 'insp.floor': 'Stojąca',
    'insp.height': 'Wysokość', 'insp.yaw': 'Obrót', 'insp.pos': 'Pozycja', 'insp.profile': 'Wszystkie ustawienia', 'insp.delete': 'Usuń',
    'mode.gesture': 'Gesty', 'mode.track': 'Śledzenie', 'mode.manual': 'Ręcznie',
    'hand.camera': 'Obraz kamery', 'hand.floorcal': 'Kalibruj podłogę',
    'dock.blackout': 'Blackout', 'dock.add': '+ Dodaj urządzenie', 'dock.master': 'Master',
    'dock.lasersOff': 'Lasery wyłączone', 'dock.lasersOn': 'Lasery włączone',
    'handui.off': 'Sterowanie dłonią', 'handui.on': 'Dłoń steruje programem',
    'handui.cal': 'Kalibruj', 'handui.calTitle': 'Kalibracja dłoni',
    'handui.calMsg': 'Pokaż palec wskazujący i przesuń nim do wszystkich czterech rogów, tak daleko jak wygodnie sięgasz.',
    'handui.calDone': 'Kalibracja dłoni zapisana', 'handui.calFail': 'Nie widzę dłoni — spróbuj jeszcze raz',
    'toast.aimSaved': 'Zapisano róg {n}/2', 'toast.aimReset': 'Kalibracja kierunku usunięta',
    'toast.gestureSaved': 'Gest zapisany — pokaż go, żeby użyć', 'toast.gestureFail': 'Nie widziałem dłoni — nagraj jeszcze raz',
    'toast.gestureDeleted': 'Gest usunięty',
    'bo.title': 'Blackout — światła są wygaszone', 'bo.hint': 'Kliknij tutaj albo naciśnij B, żeby włączyć światło',
    'test.title': 'Test kanałów DMX — sprawdź, co robi każdy kanał lampy', 'test.start': 'Adres startowy',
    'test.count': 'Kanałów', 'test.fromfx': 'Z aktywnej lampy', 'test.clear': 'Zakończ test',
    'test.hint': 'Przesuwaj po kolei suwak każdego kanału i patrz na lampę. Zapisz, co się dzieje (np. CH3 = kolor, CH6 = jasność). Test nadpisuje sterowanie lampami do czasu „Zakończ test”.',
    'pick.title': 'Wybierz urządzenie', 'pick.custom': 'Własny profil…', 'btn.cancel': 'Anuluj',
    'rail.master': 'Master', 'rail.dimmer': 'Jasność', 'rail.x': 'Ruch X', 'rail.y': 'Ruch Y', 'rail.none': 'Brak lampy',
    'g.single': 'Gesty jedną ręką', 'g.both': 'Dwie ręce razem',
    'hand.noHands': 'Pokaż dłoń kamerze', 'hand.hands': 'Dłonie: {n} · każda ręka może robić inny gest',
    'hand.trackHint': 'Przeciągnij prostokąt wokół osoby · prawy klik = zwolnij cel',
    'hand.spotOn': 'Reflektor na osobę jest włączony — dlatego program śledzi osobę. Kliknij „Gesty”, żeby go wyłączyć.',
    'hand.manualHint': 'Kliknij lub przeciągnij na obrazie = skieruj lampę',
    'hand.noCam': 'Kamera: {s} — wybierz źródło w Ustawieniach',
    'type.moving_head': 'Głowica', 'type.bar': 'Belka / bee-eye', 'type.derby': 'Derby / efekt',
    'type.par': 'PAR / wash', 'type.strobe': 'Stroboskop', 'type.laser': 'Laser', 'type.smoke': 'Dym',
    'trk.auto': 'Śledź osobę', 'trk.clear': 'Zwolnij', 'trk.hint': 'Kliknij osobę albo przeciągnij prostokąt wokół przedmiotu · prawy klik = zwolnij',
    'trk.tracking': 'Śledzę', 'trk.coasting': 'Przewiduję ruch', 'trk.searching': 'Zgubiony — szukam {s} s', 'trk.reacquired': 'Odnaleziony',
    'trk.noPerson': 'Nie widzę nikogo — stań w kadrze albo zaznacz prostokątem', 'trk.people': 'Widzę osób: {n} — kliknij, kogo śledzić',
    'wheel.title': 'Koło kolorów', 'wheel.rainbow': 'Tęcza', 'gobo.title': 'Gobo', 'gobo.open': 'Otwarte',
    'gobo.shake': 'Drżenie', 'gobo.rotate': 'Obrót',
    'wc.white': 'Biały', 'wc.red': 'Czerwony', 'wc.yellow': 'Żółty', 'wc.light_blue': 'Błękitny', 'wc.green': 'Zielony',
    'wc.orange': 'Pomarańczowy', 'wc.purple': 'Fioletowy', 'wc.dark_blue': 'Granatowy',
  },
  it: {
    'tab.scene': 'Palco 3D', 'tab.hand': 'Mano', 'tab.mixer': 'Mixer', 'tab.setup': 'Impostazioni', 'tab.music': 'Musica',
    'mu.live': 'Musica dal vivo dal mixer', 'mu.sens': 'Sensibilità beat', 'mu.react': 'Reazione delle luci al beat',
    'mu.r.flash': 'Flash sul beat', 'mu.r.color': 'Colore sul beat', 'mu.r.move': 'Movimento sul beat', 'mu.r.drop': 'Strobo sul drop',
    'mu.hint': 'Collega l’uscita del mixer (REC / BOOTH / AUX) all’ingresso di linea del computer o della scheda audio, sceglilo nella lista e premi Start.',
    'mu.fx': 'Effetti — clicca per accendere o spegnere', 'mu.stopall': 'Ferma tutti', 'mu.speed': 'Tempo', 'mu.size': 'Ampiezza movimento',
    'mu.tl': 'Timeline dello show', 'mu.load': 'Carica brano', 'mu.auto': 'Auto-show dai beat',
    'mu.clear': 'Svuota', 'mu.save': 'Salva', 'mu.open': 'Apri', 'mu.del': 'Elimina',
    'pill.camera': 'Camera', 'pill.vision': 'Visione', 'pill.dmx': 'DMX', 'pill.fixture': 'Luce',
    'scene.add': '+ Aggiungi dispositivo', 'scene.hint': 'Trascina la luce = sposta · clic = seleziona · Shift+clic sul pavimento = punta',
    'scene.empty.title': 'Il palco è vuoto', 'scene.empty.text': 'Scegli il modello del dispositivo, poi clicca sul palco dove si trova.',
    'scene.placing': 'Clicca sul palco dove mettere il dispositivo',
    'view.front': 'Fronte', 'view.top': 'Alto', 'view.side': 'Lato', 'view.fx': 'Luce',
    'dir.front': 'Avanti', 'dir.right': 'Destra', 'dir.back': 'Dietro', 'dir.left': 'Sinistra',
    'insp.address': 'Indirizzo DMX', 'insp.mount': 'Montaggio', 'insp.hang': 'Appesa', 'insp.floor': 'A terra',
    'insp.height': 'Altezza', 'insp.yaw': 'Rotazione', 'insp.pos': 'Posizione', 'insp.profile': 'Tutte le impostazioni', 'insp.delete': 'Elimina',
    'mode.gesture': 'Gesti', 'mode.track': 'Inseguimento', 'mode.manual': 'Manuale',
    'hand.camera': 'Immagine camera', 'hand.floorcal': 'Calibra pavimento',
    'dock.blackout': 'Blackout', 'dock.add': '+ Aggiungi dispositivo', 'dock.master': 'Master',
    'dock.lasersOff': 'Laser spenti', 'dock.lasersOn': 'Laser accesi',
    'handui.off': 'Controllo con la mano', 'handui.on': 'La mano controlla il programma',
    'handui.cal': 'Calibra', 'handui.calTitle': 'Calibrazione mano',
    'handui.calMsg': 'Mostra l’indice e portalo nei quattro angoli, fin dove arrivi comodamente.',
    'handui.calDone': 'Calibrazione salvata', 'handui.calFail': 'Non vedo la mano — riprova',
    'toast.aimSaved': 'Angolo {n}/2 salvato', 'toast.aimReset': 'Calibrazione della direzione rimossa',
    'toast.gestureSaved': 'Gesto salvato — mostralo per usarlo', 'toast.gestureFail': 'Non ho visto la mano — registra di nuovo',
    'toast.gestureDeleted': 'Gesto eliminato',
    'bo.title': 'Blackout — le luci sono spente', 'bo.hint': 'Clicca qui o premi B per riaccendere',
    'test.title': 'Test canali DMX — scopri cosa fa ogni canale', 'test.start': 'Indirizzo iniziale',
    'test.count': 'Canali', 'test.fromfx': 'Dalla luce attiva', 'test.clear': 'Fine test',
    'test.hint': 'Muovi uno alla volta il cursore di ogni canale e guarda la luce. Annota cosa succede (es. CH3 = colore, CH6 = luminosità). Il test sovrascrive il controllo delle luci fino a „Fine test”.',
    'pick.title': 'Scegli il dispositivo', 'pick.custom': 'Profilo personalizzato…', 'btn.cancel': 'Annulla',
    'rail.master': 'Master', 'rail.dimmer': 'Luminosità', 'rail.x': 'Movim. X', 'rail.y': 'Movim. Y', 'rail.none': 'Nessuna luce',
    'g.single': 'Gesti con una mano', 'g.both': 'Due mani insieme',
    'hand.noHands': 'Mostra la mano alla camera', 'hand.hands': 'Mani: {n} · ogni mano può fare un gesto diverso',
    'hand.trackHint': 'Trascina un rettangolo attorno alla persona · tasto destro = rilascia',
    'hand.spotOn': 'L’occhio di bue è acceso — per questo il programma segue una persona. Clicca „Gesti” per spegnerlo.',
    'hand.manualHint': 'Clicca o trascina sull’immagine = punta la luce',
    'hand.noCam': 'Camera: {s} — scegli la sorgente in Impostazioni',
    'type.moving_head': 'Testa mobile', 'type.bar': 'Barra / bee-eye', 'type.derby': 'Derby / effetto',
    'type.par': 'PAR / wash', 'type.strobe': 'Strobo', 'type.laser': 'Laser', 'type.smoke': 'Fumo',
    'trk.auto': 'Segui persona', 'trk.clear': 'Rilascia', 'trk.hint': 'Clicca una persona o trascina un rettangolo attorno a un oggetto · tasto destro = rilascia',
    'trk.tracking': 'Seguo', 'trk.coasting': 'Prevedo il movimento', 'trk.searching': 'Perso — cerco {s} s', 'trk.reacquired': 'Ritrovato',
    'trk.noPerson': 'Non vedo nessuno — entra nell’inquadratura o segna un rettangolo', 'trk.people': 'Persone: {n} — clicca chi seguire',
    'wheel.title': 'Ruota colori', 'wheel.rainbow': 'Arcobaleno', 'gobo.title': 'Gobo', 'gobo.open': 'Aperto',
    'gobo.shake': 'Vibrazione', 'gobo.rotate': 'Rotazione',
    'wc.white': 'Bianco', 'wc.red': 'Rosso', 'wc.yellow': 'Giallo', 'wc.light_blue': 'Azzurro', 'wc.green': 'Verde',
    'wc.orange': 'Arancione', 'wc.purple': 'Viola', 'wc.dark_blue': 'Blu scuro',
  },
};
const V2_TEXT = {
  pl: {
    'tab.hand': 'Dłoń', 'tab.music': 'Muzyka i pokazy', 'tab.setup': 'Konfiguracja', 'tab.stagecam': 'Kamera sceny',
    'tabd.scene': 'lampy i podgląd na żywo', 'tabd.hand': 'gesty i śledzenie', 'tabd.mixer': 'pulpit: każdy kanał osobno',
    'tabd.stagecam': 'kto gdzie stoi', 'tabd.music': 'efekty, autopilot, klatki', 'tabd.setup': 'krok po kroku',
    'pg.scene': 'Ustaw lampy tam, gdzie stoją naprawdę. Klik = wybierz lampę, Ctrl+klik = zaznacz kilka naraz, przeciągnij = przesuń.',
    'pg.hand': 'Steruj światłem dłonią. Wybierz tryb: gesty, śledzenie osoby albo ręcznie. Po prawej lista gestów i Twoje własne gesty.',
    'pg.mixer': 'Pulpit: każde urządzenie ma swoją sekcję, każdy kanał DMX swój podpisany suwak. Wybierz urządzenie albo widok Wszystkie.',
    'pg.stagecam': 'Druga kamera widzi całą scenę: pokazuje, kto gdzie stoi, pozwala oznaczać osoby i świecić na nie.',
    'pg.music': 'Światło z muzyką: autopilot na żywo, pad efektów, własne efekty i edytor pokazu z klatkami kluczowymi.',
    'pg.setup': 'Ustawienia: kabel, urządzenia i kanały, kalibracje, kamery, dłoń, prędkość, przyciski i MIDI. Zielony znak = gotowe.',
    'q.spot': 'Reflektor', 'q.auto': 'Autopilot', 'q.spotS': 'na osobę', 'q.autoS': 'z muzyką',
    'tab.scene': 'Scena', 'tab.music': 'Muzyka', 'tab.setup': 'Ustawienia',
    'dock.smoke': 'Dym', 'dock.smokeS': 'przytrzymaj', 'dock.smokeLeft': 'jeszcze {s} s', 'dock.smokeAuto': 'auto za {s} s',
    'lk.title': 'Sceny świateł', 'lk.hint': 'klik = przywróć z płynnym przejściem', 'lk.save': 'Zapisz obecny wygląd',
    'lk.empty': 'Ustaw lampy (kolor, pozycja, jasność) i kliknij „Zapisz obecny wygląd”. Potem jednym kliknięciem wracasz do tej sceny.',
    'lk.name': 'Nazwa', 'lk.fade': 'Przejście', 'lk.color': 'Kolor', 'lk.over': 'Nadpisz obecnym wyglądem', 'lk.del': 'Usuń', 'lk.close': 'Gotowe',
    'lk.lamps': '{n} lamp', 'lk.one': 'Scena', 'toast.lookSaved': 'Zapisano scenę „{name}”', 'guide': 'Przewodnik — pokaż, co gdzie jest',
    'pill.fixture': 'Lampy',
    'wz.check': 'Wskaż palcem w prawo i w dół — albo kliknij w polu poniżej. Czy światło idzie w to samo miejsce?',
    'wz.ok': 'Tak, zgadza się', 'wz.bad': 'Nie działa', 'wz.fixT': 'Co jest nie tak?',
    'wz.fx.lr': 'Lewo i prawo są odwrócone', 'wz.fx.ud': 'Góra i dół są odwrócone',
    'wz.fx.axes': 'Ruch w bok daje ruch w górę / dół (zamienione osie)', 'wz.fx.corners': 'Światło nie dochodzi do rogów — ustaw rogi jeszcze raz',
    'wz.fx.still': 'Lampa w ogóle się nie rusza', 'wz.fixed': 'Poprawione — sprawdź jeszcze raz',
    'wz.pad': 'Kliknij albo przeciągnij tutaj = lampa celuje w ten punkt',
    'dt.title': 'Test urządzenia', 'dt.intro': 'Sprawdzimy po kolei, co to urządzenie potrafi. Patrz na nie i odpowiadaj Tak / Nie.',
    'dt.light': 'Światło', 'dt.light.q': 'Czy urządzenie świeci?', 'dt.light.h': 'Sprawdź adres DMX na urządzeniu i tryb kanałów (profil). Spróbuję innych ustawień migawki.',
    'dt.color': 'Kolory', 'dt.color.q': 'Czy zmienia kolory: czerwony → zielony → niebieski?', 'dt.color.h': 'Kolejność kanałów kolorów może być inna — popraw ją w „Profil DMX…”.',
    'dt.strobe': 'Strobo', 'dt.strobe.q': 'Czy miga?', 'dt.strobe.h': 'Ustaw w profilu wartości strobo z instrukcji urządzenia.',
    'dt.motor': 'Ruch / obrót', 'dt.motor.q': 'Czy się porusza albo obraca?', 'dt.motor.h': 'Kanał silnika może mieć inny numer — sprawdź w Teście kanałów.',
    'dt.smoke': 'Dym', 'dt.smoke.q': 'Czy poszedł dym? (maszyna musi być rozgrzana 3–5 min)', 'dt.smoke.h': 'Rozgrzej maszynę, ustaw na niej tryb DMX i adres. Test daje dym przez 3 s.',
    'dt.laser': 'Laser', 'dt.laser.q': 'Laser jest zablokowany dla bezpieczeństwa — odblokuj „Lasery” na dole, jeśli chcesz go sprawdzić.',
    'dt.run': 'Uruchom test', 'dt.yes': 'Tak', 'dt.no': 'Nie', 'dt.skip': 'Dalej mimo to', 'dt.done': 'Urządzenie sprawdzone',
    'dt.chtest': 'Otwórz test kanałów',
    'q.spotTip': 'Wszystkie lampy świecą białym, ostrym kołem na osobę i jadą za nią',
    'q.autoTip': 'Światła same dopasowują ruch, kolor i jasność do muzyki',
    'scene.selAll': 'Zaznacz wszystkie', 'scene.selNone': 'Odznacz', 'scene.selN': 'Zaznaczone: {n}',
    'mood.calm': 'Spokojny', 'mood.dynamic': 'Dynamiczny', 'mood.dance': 'Taneczny', 'mood.rave': 'Rave', 'mood.hits': 'Uderzenia', 'mood.auto': 'Automatyczny',
    'toast.spotOn': 'Reflektor włączony — szukam osoby', 'toast.spotOff': 'Reflektor wyłączony',
    'toast.gesturePending': 'Gest nagrany — teraz wybierz, co ma robić', 'toast.gestureSaved2': 'Zapisano gest „{name}”',
    'toast.handCal': 'Zasięg dłoni zapisany', 'toast.handCalReset': 'Zasięg dłoni: domyślny',
    'toast.aimPoint': 'Zapisano miejsce (lamp: {n})', 'toast.aimPointClear': 'Usunięto miejsca kalibracji',
    'dev.dmxAuto': 'Podłączono {name} ({port}) — połączono automatycznie', 'dev.dmxNew': 'Wykryto {name} ({port})',
    'dev.dmxGone': 'Odłączono {name}', 'dev.dmxFail': 'Nie udało się połączyć {name}: {err}',
    'dev.camNew': 'Podłączono kamerę: {name} — nadaj jej rolę w Konfiguracja → Kamery', 'dev.camGone': 'Odłączono kamerę: {name}',
  },
  it: {
    'tab.hand': 'Mano', 'tab.music': 'Musica e show', 'tab.setup': 'Configurazione', 'tab.stagecam': 'Camera palco',
    'tabd.scene': 'luci e anteprima dal vivo', 'tabd.hand': 'gesti e inseguimento', 'tabd.mixer': 'banco: ogni canale a parte',
    'tabd.stagecam': 'chi è dove', 'tabd.music': 'effetti, autopilota, keyframe', 'tabd.setup': 'passo dopo passo',
    'pg.scene': 'Metti le luci dove sono davvero. Clic = scegli, Ctrl+clic = seleziona più luci, trascina = sposta.',
    'pg.hand': 'Controlla la luce con la mano. Modalità: gesti, inseguimento o manuale. A destra i gesti e i tuoi gesti personali.',
    'pg.mixer': 'Banco: ogni dispositivo ha la sua sezione, ogni canale DMX un fader con nome. Scegli un dispositivo o la vista Tutti.',
    'pg.stagecam': 'La seconda camera vede tutto il palco: chi è dove, segna le persone e illuminale.',
    'pg.music': 'Luce con la musica: autopilota dal vivo, pad effetti, effetti personali ed editor dello show con keyframe.',
    'pg.setup': 'Impostazioni: cavo, dispositivi e canali, calibrazioni, camere, mano, velocità, tasti e MIDI. Segno verde = pronto.',
    'q.spot': 'Occhio di bue', 'q.auto': 'Autopilota', 'q.spotS': 'sulla persona', 'q.autoS': 'con la musica',
    'tab.scene': 'Palco', 'tab.music': 'Musica', 'tab.setup': 'Impostazioni',
    'dock.smoke': 'Fumo', 'dock.smokeS': 'tieni premuto', 'dock.smokeLeft': 'ancora {s} s', 'dock.smokeAuto': 'auto tra {s} s',
    'lk.title': 'Scene luci', 'lk.hint': 'clic = richiama con transizione morbida', 'lk.save': 'Salva l’aspetto attuale',
    'lk.empty': 'Imposta le luci (colore, posizione, luminosità) e clicca „Salva l’aspetto attuale”. Poi torni a questa scena con un clic.',
    'lk.name': 'Nome', 'lk.fade': 'Transizione', 'lk.color': 'Colore', 'lk.over': 'Sovrascrivi con l’aspetto attuale', 'lk.del': 'Elimina', 'lk.close': 'Fatto',
    'lk.lamps': '{n} luci', 'lk.one': 'Scena', 'toast.lookSaved': 'Scena „{name}” salvata', 'guide': 'Guida — mostra cosa c’è e dove',
    'pill.fixture': 'Luci',
    'wz.check': 'Punta il dito a destra e in basso — oppure clicca nel riquadro qui sotto. La luce va nello stesso punto?',
    'wz.ok': 'Sì, è giusto', 'wz.bad': 'Non funziona', 'wz.fixT': 'Cosa non va?',
    'wz.fx.lr': 'Sinistra e destra sono invertite', 'wz.fx.ud': 'Alto e basso sono invertiti',
    'wz.fx.axes': 'Il movimento laterale muove su / giù (assi scambiati)', 'wz.fx.corners': 'La luce non arriva agli angoli — reimposta gli angoli',
    'wz.fx.still': 'La luce non si muove affatto', 'wz.fixed': 'Corretto — controlla di nuovo',
    'wz.pad': 'Clicca o trascina qui = la luce punta in questo punto',
    'dt.title': 'Test del dispositivo', 'dt.intro': 'Controlliamo una cosa alla volta. Guarda il dispositivo e rispondi Sì / No.',
    'dt.light': 'Luce', 'dt.light.q': 'Il dispositivo si accende?', 'dt.light.h': 'Controlla l’indirizzo DMX e la modalità canali (profilo). Provo altre impostazioni dello shutter.',
    'dt.color': 'Colori', 'dt.color.q': 'Cambia colore: rosso → verde → blu?', 'dt.color.h': 'L’ordine dei canali colore può essere diverso — correggilo in „Profilo DMX…”.',
    'dt.strobe': 'Strobo', 'dt.strobe.q': 'Lampeggia?', 'dt.strobe.h': 'Imposta nel profilo i valori strobo del manuale.',
    'dt.motor': 'Movimento / rotazione', 'dt.motor.q': 'Si muove o ruota?', 'dt.motor.h': 'Il canale motore può avere un altro numero — controlla nel Test canali.',
    'dt.smoke': 'Fumo', 'dt.smoke.q': 'È uscito il fumo? (la macchina deve essere calda, 3–5 min)', 'dt.smoke.h': 'Scalda la macchina, imposta modalità DMX e indirizzo. Il test dà fumo per 3 s.',
    'dt.laser': 'Laser', 'dt.laser.q': 'Il laser è bloccato per sicurezza — sblocca „Laser” in basso se vuoi provarlo.',
    'dt.run': 'Avvia test', 'dt.yes': 'Sì', 'dt.no': 'No', 'dt.skip': 'Avanti comunque', 'dt.done': 'Dispositivo controllato',
    'dt.chtest': 'Apri il test canali',
    'q.spotTip': 'Tutte le luci illuminano la persona con un cerchio bianco netto e la seguono',
    'q.autoTip': 'Le luci adattano da sole movimento, colore e luminosità alla musica',
    'scene.selAll': 'Seleziona tutte', 'scene.selNone': 'Deseleziona', 'scene.selN': 'Selezionate: {n}',
    'mood.calm': 'Calmo', 'mood.dynamic': 'Dinamico', 'mood.dance': 'Ballo', 'mood.rave': 'Rave', 'mood.hits': 'Colpi', 'mood.auto': 'Automatico',
    'toast.spotOn': 'Occhio di bue acceso — cerco una persona', 'toast.spotOff': 'Occhio di bue spento',
    'toast.gesturePending': 'Gesto registrato — ora scegli cosa deve fare', 'toast.gestureSaved2': 'Gesto „{name}” salvato',
    'toast.handCal': 'Raggio della mano salvato', 'toast.handCalReset': 'Raggio della mano: predefinito',
    'toast.aimPoint': 'Punto salvato (luci: {n})', 'toast.aimPointClear': 'Punti di calibrazione eliminati',
    'dev.dmxAuto': '{name} collegato ({port}) — connesso automaticamente', 'dev.dmxNew': 'Rilevato {name} ({port})',
    'dev.dmxGone': '{name} scollegato', 'dev.dmxFail': 'Impossibile collegare {name}: {err}',
    'dev.camNew': 'Camera collegata: {name} — dalle un ruolo in Configurazione → Camere', 'dev.camGone': 'Camera scollegata: {name}',
  },
};
for (const l of ['pl', 'it']) Object.assign(I18N[l], V2_TEXT[l]);
const GESTURES = {
  point: { icon: '☝', pl: ['Wskaż', 'palec wskazujący celuje światłem'], it: ['Punta', 'l’indice punta la luce'] },
  dimmer: { icon: '✋', pl: ['Otwarta dłoń', 'góra / dół = jasność'], it: ['Mano aperta', 'su / giù = luminosità'] },
  crossfade: { icon: '🤚', pl: ['Dłoń bokiem', 'lewo / prawo = przejście między lampami'], it: ['Mano di taglio', 'sx / dx = dissolvenza tra luci'] },
  strobe: { icon: '✊', pl: ['Pięść', 'mocniej zaciśnięta = szybszy strobe'], it: ['Pugno', 'più stretto = strobo più veloce'] },
  color: { icon: '👌', pl: ['OK / szczypta', 'przechył dłoni = kolor'], it: ['OK / pinza', 'inclina la mano = colore'] },
  spin: { icon: '✌', pl: ['Dwa palce', 'lewo / prawo = obrót i prędkość'], it: ['Due dita', 'sx / dx = rotazione e velocità'] },
  full: { icon: '👍', pl: ['Kciuk w górę', 'pełna jasność'], it: ['Pollice su', 'luminosità massima'] },
};
const GESTURE_EXTRA = { thumbdown: { pl: ['Kciuk w dół', 'nie / popraw (kalibracja)'], it: ['Pollice giù', 'no / correggi (calibrazione)'] } };
const COMBOS = {
  master: { icon: '🙌', pl: ['Dwie otwarte dłonie', 'rozsuń ręce = master całego setu'], it: ['Due mani aperte', 'allarga = master generale'] },
  strobe_all: { icon: '✊✊', pl: ['Dwie pięści', 'strobe na wszystkich lampach'], it: ['Due pugni', 'strobo su tutte le luci'] },
  color_all: { icon: '👌👌', pl: ['Dwa OK', 'kolor na wszystkich lampach'], it: ['Due OK', 'colore su tutte le luci'] },
  aim_two: { icon: '☝☝', pl: ['Dwa wskazania', 'lewa ręka = lewa lampa, prawa = prawa'], it: ['Due indici', 'mano sx = luce sx, dx = luce dx'] },
};
let LANG = localStorage.getItem('ph_lang') === 'it' ? 'it' : 'pl';
const t = (k, vars) => {
  let v = (I18N[LANG] && I18N[LANG][k]) || I18N.pl[k] || k;
  if (vars) for (const [n, val] of Object.entries(vars)) v = v.split(`{${n}}`).join(val);
  return v;
};
/* tr(): Polish UI text → Italian (static HTML, dynamic templates, canvas labels, toasts) */
function tr(s) {
  if (LANG !== 'it' || s == null || typeof TR_IT === 'undefined') return s;
  const str = String(s), k = str.trim();
  if (!k) return str;
  const v = TR_IT.get(k);
  if (v) return str.replace(k, v);
  for (const [re, rep] of TR_RE) if (re.test(k)) return str.replace(k, k.replace(re, rep));
  return str;
}
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'TEXTAREA']);
function trNode(n) {
  if (n.nodeType !== 3 || !n.parentElement || SKIP_TAGS.has(n.parentElement.tagName)) return;
  if (n.__it !== n.data) n.__pl = n.data;                  // text changed from outside → new original
  const out = LANG === 'it' ? tr(n.__pl) : n.__pl;
  if (out !== n.data) n.data = out;
  n.__it = n.data;
}
function trAttrs(el) {
  for (const a of ['placeholder', 'title']) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const key = '__pl_' + a, cur = el.getAttribute(a);
    if (el['__it_' + a] !== cur) el[key] = cur;
    const out = LANG === 'it' ? tr(el[key]) : el[key];
    if (out !== cur) el.setAttribute(a, out);
    el['__it_' + a] = out;
  }
}
function trTree(root) {
  if (root.nodeType === 3) { trNode(root); return; }
  if (root.nodeType !== 1 || SKIP_TAGS.has(root.tagName)) return;
  trAttrs(root);
  for (const el of root.querySelectorAll('[placeholder],[title]')) trAttrs(el);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) trNode(n);
}
new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.type === 'characterData') trNode(m.target);
    else for (const n of m.addedNodes) trTree(n);
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

const gName = (k) => (GESTURES[k] || COMBOS[k] || GESTURE_EXTRA[k] || { pl: [k, ''], it: [k, ''] })[LANG][0];
const gDesc = (k) => (GESTURES[k] || COMBOS[k] || { pl: [k, ''], it: [k, ''] })[LANG][1];
function applyI18n() {
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  trTree(document.body);
  for (const b of $$('#lang button')) b.classList.toggle('on', b.dataset.lang === LANG);
  document.documentElement.lang = LANG;
  buildGestureList();
  if (RAIL.master) {
    const labels = { master: 'rail.master', dimmer: 'rail.dimmer', pan: 'rail.x', tilt: 'rail.y' };
    for (const [k, key] of Object.entries(labels)) $('.fader-label', RAIL[k].el).textContent = t(key);
  }
  S.sig.cards = {}; refreshSetup(true);
  if ($('#pg-title')) setPageHead();
  $('#q-spot').title = t('q.spotTip'); $('#q-auto').title = t('q.autoTip');
}
function setLang(l) { LANG = l; localStorage.setItem('ph_lang', l); applyI18n();
huiSet(localStorage.getItem('ph_handui') === '1'); }
const floorCorners = () => (LANG === 'it' ? FLOOR_CORNERS_IT : FLOOR_CORNERS_PL);
const SWATCHES = [[255,0,0],[255,96,0],[255,190,0],[128,255,0],[0,255,64],
                  [0,230,255],[0,64,255],[128,0,255],[255,0,160],[255,255,255]];

const S = {
  ws: null, connected: false, st: null,
  bitmap: null, decoding: false, nextBlob: null,
  out: new Map(), roi: null, manualDrag: false, floorCal: null,
  tab: 'scene', showCam: false,
  hands: new Map(),            // slot → {lm, alpha, data}
  sig: { chips: null, bank: null, mon: null, cards: {} },
  hz: 0, hzCount: 0, ports: null,
  inspClosedFor: null, calWasRunning: false,
};

/* ================================================================ network */
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.binaryType = 'blob';
  if (window.LumoBoot) window.LumoBoot.step('ws', 35);
  ws.onopen = () => { S.connected = true; S.wantVideo = null; send({ type: 'library' }); if (window.LumoBoot) window.LumoBoot.step('state', 70); };
  ws.onclose = () => { S.connected = false; setTimeout(connect, 1000); };
  ws.onmessage = (ev) => (typeof ev.data === 'string' ? onJSON(JSON.parse(ev.data)) : onFrame(ev.data));
  S.ws = ws;
}
function send(msg) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(msg)); }
function sendT(key, msg) { S.out.set(key, msg); }           // throttled, latest value wins
setInterval(() => { for (const m of S.out.values()) send(m); S.out.clear(); }, 33);
setInterval(() => { S.hz = S.hzCount; S.hzCount = 0; }, 1000);

async function onFrame(blob) {
  if (S.decoding) { S.nextBlob = blob; return; }
  S.decoding = true;
  try {
    const bmp = await createImageBitmap(blob);
    if (S.bitmap) S.bitmap.close();
    S.bitmap = bmp;
  } catch (e) { /* skip corrupt frame */ }
  S.decoding = false;
  if (S.nextBlob) { const b = S.nextBlob; S.nextBlob = null; onFrame(b); }
}
function onJSON(m) {
  if (m.type === 'state') {
    S.st = m; S.hzCount++; updateUI(m);
    if (window.LumoBoot && !S.booted) { S.booted = true; setTimeout(() => window.LumoBoot.done(), 0); }
  }
  else if (m.type === 'toast') toast(m.key && I18N.pl[m.key] ? t(m.key, m.params) : m.text, m.level);
  else if (m.type === 'cameras') onCameras(m.cameras);
  else if (m.type === 'ports') { S.ports = m.ports; fillPorts(); }
  else if (m.type === 'library') { S.library = m.fixtures; }
  else if (m.type === 'qlc') { if (PH.onQlc) PH.onQlc(m); }
  else if (m.type === 'doctor') { if (PH.onDoctor) PH.onDoctor(m); }
  else if (m.type === 'lib') { if (PH.onLib) PH.onLib(m); }
}

/* ================================================================ helpers */
const fixtures = () => (S.st ? S.st.fixtures : []);
const activeFx = () => fixtures().find((f) => S.st && f.id === S.st.active_id) || null;
function laserRgb(f) {
  const ch = f.channels || [], ov = f.overrides || {};
  const on = (role) => ch.some((r, i) => r === role && (ov[i] == null ? (f.values.laser || 0) > 0 : ov[i] > 0));
  const r = on('laser_r'), g = on('laser_g'), b = on('laser_b');
  if (!r && !g && !b) return [255, 60, 60];
  return [r ? 255 : 0, g ? 230 : 0, b ? 255 : 0];
}
function rgbOf(f) {
  if ((f.channels || []).some((r) => r.startsWith('laser'))) return laserRgb(f);
  if (f.has_rgb) return [f.values.red, f.values.green, f.values.blue];
  if (f.wheel && f.wheel.length && f.channels.includes('cwheel')) {
    const v = f.values.cwheel || 0, last = f.wheel[f.wheel.length - 1][0];
    if (v > last + 8) return hsv2rgb((performance.now() / 1000 * (40 + (v - last) * 2)) % 360, 1, 1);   // wheel spinning
    return f.wheel.reduce((a, b) => (Math.abs(b[0] - v) < Math.abs(a[0] - v) ? b : a))[1];
  }
  return [255, 255, 255];
}
const coarse = (f, axis) => (f[`${axis}_16bit`] ? f.values[axis] >> 8 : Math.round(f.values[axis] / 257));

function floorToImg(X, Z) {   // floor metres → normalised camera image (server's inverse homography)
  const H = S.st && S.st.stage.H_inv; if (!H) return null;
  const w = H[2][0] * X + H[2][1] * Z + H[2][2];
  if (w <= 1e-9) return null;
  return [(H[0][0] * X + H[0][1] * Z + H[0][2]) / w, (H[1][0] * X + H[1][1] * Z + H[1][2]) / w];
}
function strobeFactor(s, t) {
  if (s <= 0) return 1;
  if (s < 90) { const f = 0.4 + (s / 90) * 2.6; return 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(2 * Math.PI * f * t)); }
  const f = 3 + ((s - 90) / 165) * 22;
  return ((t * f) % 1) < 0.3 ? 1 : 0.03;
}
function intensity(f, t) {
  const st = S.st;
  if (!st || st.blackout || f.enabled === false) return 0;
  if ((f.channels || []).some((r) => r.startsWith('laser'))) {           // a laser shows only when armed and on
    const ov = f.overrides || {}, any = f.channels.some((r, i) => r.startsWith('laser') && (ov[i] != null ? ov[i] > 0 : (f.values.laser || 0) > 0));
    return st.lasers_enabled && any ? 1 : 0;
  }
  return (f.values.dimmer / 255) * (st.grand_master / 255) * strobeFactor(f.values.strobe, t + f.id * 0.137);
}
function hsv2rgb(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function toast(text, level = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${level}`;
  el.innerHTML = `${ic(level === 'err' ? 'close' : level === 'warn' ? 'warn' : 'check')}<span></span><i class="tp"></i>`;
  el.querySelector('span').textContent = tr(text);
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3600);
}
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), d = dpr();
  const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return [w, h, d];
}
function setText(el, txt) { txt = tr(txt); if (el && el.textContent !== txt) el.textContent = txt; }
function fxColorCss(f, t) {
  const I = intensity(f, t), [r, g, b] = rgbOf(f);
  return { css: `rgba(${r},${g},${b},${0.1 + 0.9 * I})`, glow: I > 0.05 ? `0 0 ${4 + 10 * I}px rgba(${r},${g},${b},${I})` : 'none' };
}

/* ================================================================ tabs */
function setTab(tab) {
  if (S.tab === 'setup' && tab !== 'setup' && S.st && Object.keys(S.st.test_channels || {}).length) {
    send({ type: 'test_clear' });
    toast('Test kanałów zakończony — lampa znów słucha gestów i suwaków');
  }
  S.tab = tab;
  try { localStorage.setItem('ph_tab', tab); } catch (e) { /* private mode */ }
  for (const b of $$('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  setPageHead();
  for (const p of $$('.tab-page')) p.classList.toggle('on', p.dataset.page === tab);
  moveInk();
  if (tab === 'setup') {
    refreshSetup(true);
    const f = activeFx();
    if (f && !(S.st && Object.keys(S.st.test_channels || {}).length)) {
      $('#test-start').value = f.address; $('#test-count').value = Math.min(32, f.footprint); buildTestGrid();
    }
  }
  if (tab !== 'scene' && window.PH3D) window.PH3D.cancelPlacement();
}
function setPageHead() {
  for (const b of $$('#tabs button')) b.title = t(`pg.${b.dataset.tab}`);
  moveInk();
}
function moveInk() {
  const b = $(`#tabs button[data-tab="${S.tab}"]`), ink = $('#tab-ink');
  if (!b || !ink) return;
  ink.style.width = `${b.offsetWidth}px`;
  ink.style.transform = `translateX(${b.offsetLeft}px)`;
}
window.addEventListener('resize', moveInk);

/* ================================================================ fader */
class Fader {
  constructor({ label, max = 255, color = C.cyan, onChange, height, narrow }) {
    this.max = max; this.value = 0; this.dragging = false; this.lastUser = 0; this.onChange = onChange;
    const el = document.createElement('div');
    el.className = 'fader' + (narrow ? ' narrow' : '');
    el.style.setProperty('--fc', color);
    if (height) el.style.setProperty('--fh', height);
    const scale = [255, 192, 128, 64, 0].map((v) => `<span style="bottom:${(v / 255) * 100}%">${v}</span>`).join('');
    el.innerHTML = `<div class="fader-val">000</div>
      <div class="fader-body"><div class="fader-scale">${scale}</div>
        <div class="fader-track" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}">
          <div class="fader-fill"></div><div class="fader-knob"></div></div></div>
      <div class="fader-label">${label}</div><div class="fader-sub"></div>`;
    this.el = el;
    this.track = $('.fader-track', el); this.fill = $('.fader-fill', el); this.knob = $('.fader-knob', el);
    this.valEl = $('.fader-val', el); this.subEl = $('.fader-sub', el);
    const t = this.track;
    t.addEventListener('pointerdown', (e) => { try { t.setPointerCapture(e.pointerId); } catch (err) {} this.dragging = true; el.classList.add('dragging'); this._fromEvent(e); });
    t.addEventListener('pointermove', (e) => { if (this.dragging) this._fromEvent(e); });
    const end = () => { this.dragging = false; el.classList.remove('dragging'); this.lastUser = performance.now(); };
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
    t.addEventListener('wheel', (e) => { e.preventDefault(); this._set(this.value + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1), true); }, { passive: false });
    t.addEventListener('keydown', (e) => {
      const st = e.shiftKey ? 10 : 1;
      const map = { ArrowUp: st, ArrowRight: st, ArrowDown: -st, ArrowLeft: -st, PageUp: 32, PageDown: -32 };
      if (e.key in map) { e.preventDefault(); this._set(this.value + map[e.key], true); }
      else if (e.key === 'Home') this._set(0, true);
      else if (e.key === 'End') this._set(this.max, true);
    });
    t.addEventListener('dblclick', () => this._set(this.value > 0 ? 0 : this.max, true));
    this._render();
  }
  _fromEvent(e) { const r = this.track.getBoundingClientRect(); this._set((1 - (e.clientY - r.top) / r.height) * this.max, true); }
  _set(v, user) {
    v = Math.round(clamp(v, 0, this.max));
    if (user) this.lastUser = performance.now();
    if (v === this.value) return;
    this.value = v; this._render();
    if (user && this.onChange) this.onChange(v);
  }
  setValue(v) {   // motorized: ignored while the fader is being touched
    if (this.dragging || performance.now() - this.lastUser < 400) return;
    v = Math.round(clamp(v, 0, this.max));
    if (v !== this.value) { this.value = v; this._render(); }
  }
  setSub(txt) { setText(this.subEl, txt); }
  _render() {
    const pct = (this.value / this.max) * 100;
    this.fill.style.height = `${pct}%`;
    this.knob.style.bottom = `${pct}%`;
    this.valEl.textContent = pad3(this.value);
    this.track.setAttribute('aria-valuenow', this.value);
  }
}

/* ================================================================ gesture list */
function buildGestureList() {
  const box = $('#glist'); if (!box) return;
  box.innerHTML = `<h4>Moje gesty</h4><div class="mine" id="g-mine"></div>
    <button class="btn sm primary rec-btn" id="g-new">+ Utwórz gest</button>
    <h4>${t('g.single')}</h4>`
    + Object.keys(GESTURES).map((k) => gitem(k)).join('')
    + `<h4>${t('g.both')}</h4>`
    + Object.keys(COMBOS).map((k) => gitem(k)).join('');
  $('#g-new').onclick = () => (PH.openGestureCreator ? PH.openGestureCreator() : openGestureDialog());
  S.sig.mine = null;
}
const ACTION_PL = { blackout: 'Blackout (wł./wył.)', full: 'Pełna jasność', dark: 'Wygaś', flash: 'Flash', strobe: 'Strobe (2 s)',
  home: 'Pozycja środkowa', next_fixture: 'Następna lampa', color: 'Kolor…', effect: 'Efekt…', stop_effects: 'Zatrzymaj efekty',
  spotlight: 'Reflektor na osobę', autopilot: 'Autopilot', motion: 'Ruch dłoni steruje' };
const KIND_ICON = { pose: ic('hand'), motion: ic('arrows'), two: ic('twohands') };
function updateCustomGestures(st) {
  const cg = st.interaction.custom, box = $('#g-mine'); if (!box || !cg) return;
  const sig = JSON.stringify(cg.list);
  if (sig !== S.sig.mine) {
    S.sig.mine = sig;
    box.innerHTML = cg.list.length ? cg.list.map((g) => `<div class="mine-row" data-id="${g.id}">
        <b>${KIND_ICON[g.kind || 'pose'] || ''} ${esc(g.name)}</b>${g.kind === 'motion' ? '<span></span>' : `<button data-test="${g.id}" title="Testuj">▶</button>`}<button data-del="${g.id}" title="Usuń">✕</button>
        <small>${esc(tr(ACTION_PL[g.action] || g.action).replace('…', ''))}${g.action === 'effect' ? ': ' + esc(g.params.kind) : ''}${g.map ? ': ' + esc(['x', 'y'].filter((a) => g.map[a] && g.map[a] !== 'none').map((a) => `${a === 'x' ? '↔' : '↕'} ${PH.motionName ? PH.motionName(g.map[a]) : g.map[a]}`).join(' · ')) : ''}</small></div>`).join('')
      : `<span class="hint">Brak własnych gestów</span>`;
    for (const b of $$('[data-del]', box)) b.onclick = () => send({ type: 'gesture_delete', id: b.dataset.del });
    for (const b of $$('[data-test]', box)) b.onclick = () => {
        const g = cg.list.find((x) => x.id === b.dataset.test); if (g) send({ type: 'gesture_test', action: g.action, params: g.params });
    };
  }
  const last = cg.last, fresh = last && Date.now() / 1000 - last.t < 1.2;
  for (const row of $$('.mine-row', box)) row.classList.toggle('on', !!(fresh && row.querySelector('b').textContent === last.name));
  if (fresh) { const big = $('#gbig'); big.hidden = false; setText($('b', big), last.name.toUpperCase()); setText($('small', big), tr(ACTION_PL[last.action] || '')); }
  // recording overlay
  const ov = $('#rec-ov'), rec = cg.recording;
  ov.hidden = !rec || !!($('#gc-dialog') && $('#gc-dialog').open);
  if (rec) {
    setText($('#rec-title'), rec.phase === 'wait' ? 'Przygotuj gest przed kamerą…' : 'Nagrywam — trzymaj dłoń nieruchomo…');
    setText($('#rec-left'), rec.left.toFixed(1));
  }
}
function openGestureDialog() {
  const dlg = $('#gest-dialog');
  const sync = () => { $('#g-color-row').hidden = $('#g-action').value !== 'color'; $('#g-effect-row').hidden = $('#g-action').value !== 'effect'; };
  const cat = PH.fxCatalogue ? PH.fxCatalogue().filter(([k]) => !['position', 'dark', 'fade_in', 'fade_out'].includes(k))
    : ['circle', 'figure8', 'sweep', 'rainbow', 'pulse', 'strobe'].map((k) => [k, k]);
  $('#g-effect').innerHTML = cat.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('');
  $('#g-action').onchange = sync; sync();
  $('#g-cancel').onclick = () => dlg.close();
  $('#g-rec').onclick = () => {
    const action = $('#g-action').value, params = {};
    if (action === 'color') { const h = $('#g-color').value; params.rgb = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
    if (action === 'effect') params.kind = $('#g-effect').value;
    send({ type: 'gesture_record', name: $('#g-name').value || 'gest', action, params });
    dlg.close();
    if (S.tab !== 'hand') setTab('hand');
  };
  dlg.showModal();
}
const gitem = (k) => `<div class="gitem" data-g="${k}" title="${esc(gDesc(k))}"><i>${poseSVG(k)}</i>`
  + `<b>${esc(gName(k))}</b><em></em><small>${esc(gDesc(k))}</small></div>`;

function updateGestures(st) {
  updateCustomGestures(st);
  const vis = st.vision, hands = (vis.perception.hands || []);
  const used = {};
  for (const h of hands) {
    if (!h.gesture || h.gesture === 'none') continue;
    (used[h.gesture] = used[h.gesture] || []).push(h.handedness === 'Left' ? 'L' : 'P');
  }
  const combo = st.interaction.combo;
  for (const el of $$('#glist .gitem')) {
    const k = el.dataset.g, on = vis.mode === 'gesture' && (k === combo || (!combo && used[k]));
    el.classList.toggle('on', !!on);
    setText($('em', el), used[k] && !combo ? used[k].join(' ') : '');
  }
  // big live readout of what the gesture is doing right now
  const big = $('#gbig'), f = activeFx();
  let title = null, sub = '';
  if (vis.mode === 'gesture' && combo) {
    title = gName(combo);
    if (combo === 'master') sub = `MASTER ${Math.round(st.grand_master / 2.55)}%`;
  } else if (vis.mode === 'gesture' && hands.length) {
    const g = hands.find((h) => h.gesture !== 'none');
    if (g) {
      title = gName(g.gesture);
      if (g.gesture === 'dimmer' && f) sub = `${Math.round(f.values.dimmer / 2.55)}%`;
      else if (g.gesture === 'strobe') sub = `${Math.round(g.tightness * 100)}%`;
      else if (g.gesture === 'color') sub = `HUE ${Math.round(g.hue)}°`;
      else if (g.gesture === 'point' && f) sub = f.name;
      else if (g.gesture === 'spin' && f) sub = `SPIN ${pad3(f.values.spin || 0)}`;
    }
  }
  const cg = st.interaction.custom, customShown = cg && cg.last && Date.now() / 1000 - cg.last.t < 1.2;
  if (customShown) return;
  big.hidden = !title;
  if (title) { setText($('b', big), title.toUpperCase()); setText($('small', big), sub); }
}

/* ================================================================ side rail (visible in every tab) */
const RAIL = {};
const RAIL_SW = [[255,255,255],[255,0,0],[255,120,0],[0,255,80],[0,180,255],[180,0,255]];
function buildRail() {
  const box = $('#rail-faders');
  RAIL.master = new Fader({ label: t('rail.master'), color: '#e5e7eb', onChange: (v) => sendT('gm', { type: 'grand_master', value: v }) });
  RAIL.dimmer = new Fader({ label: t('rail.dimmer'), color: C.amber, onChange: (v) => setActive('dimmer', v) });
  RAIL.pan = new Fader({ label: t('rail.x'), color: C.cyan, onChange: (v) => setActive('pan_coarse', v) });
  RAIL.tilt = new Fader({ label: t('rail.y'), color: C.cyan, onChange: (v) => setActive('tilt_coarse', v) });
  for (const k of ['master', 'dimmer', 'pan', 'tilt']) box.appendChild(RAIL[k].el);
  for (const [r, g, b] of RAIL_SW) {
    const bt = document.createElement('button');
    bt.style.background = `rgb(${r},${g},${b})`; bt.title = `${r},${g},${b}`;
    bt.onclick = () => { const f = activeFx(); if (f) send({ type: 'set_many', id: f.id, values: { red: r, green: g, blue: b } }); };
    $('#rail-sw').appendChild(bt);
  }
}
function setActive(param, value) {
  const f = activeFx(); if (!f) return;
  sendT(`rail:${f.id}:${param}`, { type: 'set', id: f.id, param, value });
}
function updateRail(st) {
  const f = activeFx();
  setText($('#rail-name'), f ? f.name : t('rail.none'));
  setText($('#rail-addr'), f ? `DMX ${pad3(f.address)}` : '—');
  RAIL.master.setValue(st.grand_master);
  RAIL.master.setSub(`${Math.round(st.grand_master / 2.55)}%`);
  for (const k of ['dimmer', 'pan', 'tilt']) RAIL[k].el.classList.toggle('hidden', !f);
  if (!f) return;
  RAIL.dimmer.setValue(f.values.dimmer); RAIL.dimmer.setSub(`${Math.round(f.values.dimmer / 2.55)}%`);
  RAIL.pan.setValue(coarse(f, 'pan'));
  RAIL.tilt.setValue(coarse(f, 'tilt'));
}

/* ================================================================ mixer: programmer */
const PROG = {};
const PROG_DEFS = [
  ['#g-pos', 'pan', 'Pan', C.cyan, 'pan_coarse'], ['#g-pos', 'pan_fine', 'Fine', C.cyan, 'pan_fine', true],
  ['#g-pos', 'tilt', 'Tilt', C.cyan, 'tilt_coarse'], ['#g-pos', 'tilt_fine', 'Fine', C.cyan, 'tilt_fine', true],
  ['#g-int', 'dimmer', 'Dimmer', C.amber, 'dimmer'], ['#g-int', 'strobe', 'Strobe', C.red, 'strobe'],
  ['#g-col', 'red', 'R', '#ef4444', 'red', true], ['#g-col', 'green', 'G', '#10b981', 'green', true],
  ['#g-col', 'blue', 'B', '#3b82f6', 'blue', true],
  ['#g-col', 'cwheel', 'Koło', '#e5e7eb', 'cwheel'], ['#g-col', 'gobo', 'Gobo', '#e5e7eb', 'gobo'],
];
function buildProgrammer() {      // v3.1: the desk (desk.js) replaced these faders; kept for older layouts
  for (const [grp, key, label, color, param, narrow] of PROG_DEFS) {
    if (!$(grp)) continue;
    PROG[key] = new Fader({
      label, color, narrow,
      onChange: (v) => { const f = activeFx(); if (f) sendT(`set:${f.id}:${param}`, { type: 'set', id: f.id, param, value: v }); },
    });
    $(grp).appendChild(PROG[key].el);
  }
}
function updateProgrammer() {
  const f = activeFx();
  setText($('#prog-title'), f ? f.name : '—');
  setText($('#prog-sub'), f ? `DMX ${pad3(f.address)}–${pad3(f.address + f.footprint - 1)}` : '');
  if (!f) return;
  const v = f.values;
  if (!PROG.pan) { setText($('#xy-read'), `PAN ${pad3(coarse(f, 'pan'))} · TILT ${pad3(coarse(f, 'tilt'))}`); updateWheelSlots(f); return; }
  PROG.pan.setValue(coarse(f, 'pan')); PROG.pan.setSub(String(v.pan));
  PROG.pan_fine.setValue(v.pan & 255);
  PROG.tilt.setValue(coarse(f, 'tilt')); PROG.tilt.setSub(String(v.tilt));
  PROG.tilt_fine.setValue(v.tilt & 255);
  PROG.pan_fine.el.classList.toggle('hidden', !f.pan_16bit);
  PROG.tilt_fine.el.classList.toggle('hidden', !f.tilt_16bit);
  PROG.dimmer.setValue(v.dimmer); PROG.dimmer.setSub(`${Math.round(v.dimmer / 2.55)}%`);
  PROG.strobe.setValue(v.strobe); PROG.strobe.setSub(v.strobe ? 'strobe' : 'otwarty');
  for (const c of ['red', 'green', 'blue']) { PROG[c].setValue(v[c]); PROG[c].el.classList.toggle('hidden', !f.has_rgb); }
  for (const c of ['cwheel', 'gobo']) { PROG[c].setValue(v[c] || 0); PROG[c].el.classList.toggle('hidden', !f.channels.includes(c)); }
  setText($('#xy-read'), `PAN ${pad3(coarse(f, 'pan'))} · TILT ${pad3(coarse(f, 'tilt'))}`);
  updateWheelSlots(f);
}
function updateWheelSlots(f) {
  const box = $('#wheel-slots'); if (!box) return;
  const wheel = f.channels.includes('cwheel') && f.wheel ? f.wheel : null, gobos = f.channels.includes('gobo') && f.gobos ? f.gobos : null;
  const sig = `${f.id}|${JSON.stringify(wheel)}|${JSON.stringify(gobos)}|${LANG}`;
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    const gname = (n) => (/^\d+$/.test(n) ? `Gobo ${n}` : t(`gobo.${n}`));
    box.innerHTML = (wheel ? `<div class="fg-t">${t('wheel.title')}</div><div class="wslots">${wheel.map(([v, rgb, n]) =>
      `<button data-cw="${v}" style="--c:rgb(${rgb.join(',')})" title="${esc(t('wc.' + n))} · ${v}"><i></i>${esc(t('wc.' + n))}</button>`).join('')}
      <button data-cw="200" class="rainbow"><i></i>${t('wheel.rainbow')}</button></div>` : '')
      + (gobos ? `<div class="fg-t">${t('gobo.title')}</div><div class="wslots gobos">${gobos.map(([v, n]) =>
      `<button data-gb="${v}">${esc(gname(n))}</button>`).join('')}</div>` : '');
    for (const b of $$('[data-cw]', box)) b.onclick = () => {
      const a = activeFx(); if (!a) return;
      const v = Number(b.dataset.cw), slot = (a.wheel || []).find((w) => w[0] === v);
      send({ type: 'set_many', id: a.id, values: slot ? { red: slot[1][0], green: slot[1][1], blue: slot[1][2], cwheel: v } : { cwheel: v } });
    };
    for (const b of $$('[data-gb]', box)) b.onclick = () => { const a = activeFx(); if (a) send({ type: 'set', id: a.id, param: 'gobo', value: Number(b.dataset.gb) }); };
  }
  box.hidden = !wheel && !gobos;
  const cw = f.values.cwheel || 0, gb = f.values.gobo || 0;
  const near = (list, v) => (list && list.length ? list.reduce((a, b) => (Math.abs(b[0] - v) < Math.abs(a[0] - v) ? b : a))[0] : null);
  const wOn = wheel ? (cw > wheel[wheel.length - 1][0] + 8 ? 200 : near(wheel, cw)) : null, gOn = near(gobos, gb);
  for (const b of $$('[data-cw]', box)) b.classList.toggle('on', Number(b.dataset.cw) === wOn);
  for (const b of $$('[data-gb]', box)) b.classList.toggle('on', Number(b.dataset.gb) === gOn);
}

/* ---------------------------------------------------------------- XY pad */
const XY = { drag: false, local: null, t: 0 };
function initXY() {
  const cv = $('#xy-pad');
  const set = (e) => {
    const f = activeFx(); if (!f) return;
    const r = cv.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp((e.clientY - r.top) / r.height, 0, 1);
    XY.local = [x, y]; XY.t = performance.now();
    sendT(`xy:${f.id}`, { type: 'set_many', id: f.id, values: { pan: Math.round(x * 65535), tilt: Math.round(y * 65535) } });
  };
  cv.addEventListener('pointerdown', (e) => { try { cv.setPointerCapture(e.pointerId); } catch (err) {} XY.drag = true; set(e); });
  cv.addEventListener('pointermove', (e) => { if (XY.drag) set(e); });
  cv.addEventListener('pointerup', () => { XY.drag = false; });
  cv.addEventListener('pointercancel', () => { XY.drag = false; });
}
function drawXY() {
  const cv = $('#xy-pad'); const [W, H, d] = fitCanvas(cv); const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f7f7fa'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e6e6ee'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 1; i < 8; i++) { const p = Math.round((i / 8) * W) + 0.5; ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.moveTo(0, p); ctx.lineTo(W, p); }
  ctx.stroke();
  const f = activeFx(); if (!f) return;
  for (const o of fixtures()) {
    if (o.id === f.id) continue;
    ctx.fillStyle = '#b9bac8'; ctx.beginPath(); ctx.arc(o.values.pan / 65535 * W, o.values.tilt / 65535 * H, 3 * d, 0, 7); ctx.fill();
  }
  let x = f.values.pan / 65535, y = f.values.tilt / 65535;
  if ((XY.drag || performance.now() - XY.t < 300) && XY.local) [x, y] = XY.local;
  ctx.strokeStyle = 'rgba(123,63,242,.45)'; ctx.lineWidth = 1.5 * d; ctx.beginPath(); ctx.moveTo(x * W, 0); ctx.lineTo(x * W, H); ctx.moveTo(0, y * H); ctx.lineTo(W, y * H); ctx.stroke();
  const [r, g, b] = rgbOf(f);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x * W, y * H, 9 * d, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7b3ff2'; ctx.lineWidth = 2.5 * d; ctx.stroke();
  ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.beginPath(); ctx.arc(x * W, y * H, 5 * d, 0, 7); ctx.fill();
}

/* ---------------------------------------------------------------- colour wheel */
const WHEEL = { img: null, size: 0, drag: false, local: null, t: 0 };
function initWheel() {
  const cv = $('#color-wheel');
  const set = (e) => {
    const f = activeFx(); if (!f) return;
    const r = cv.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
    const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s = clamp(Math.hypot(dx, dy) / 0.47, 0, 1);
    const [R, G, B] = hsv2rgb(h, s, 1);
    WHEEL.local = [h, s]; WHEEL.t = performance.now();
    sendT(`rgb:${f.id}`, { type: 'set_many', id: f.id, values: { red: R, green: G, blue: B } });
  };
  cv.addEventListener('pointerdown', (e) => { try { cv.setPointerCapture(e.pointerId); } catch (err) {} WHEEL.drag = true; set(e); });
  cv.addEventListener('pointermove', (e) => { if (WHEEL.drag) set(e); });
  cv.addEventListener('pointerup', () => { WHEEL.drag = false; });
  cv.addEventListener('pointercancel', () => { WHEEL.drag = false; });
  for (const [r, g, b] of SWATCHES) {
    const bt = document.createElement('button');
    bt.style.background = `rgb(${r},${g},${b})`; bt.title = `${r},${g},${b}`;
    bt.onclick = () => { const f = activeFx(); if (f) send({ type: 'set_many', id: f.id, values: { red: r, green: g, blue: b } }); };
    $('#swatches').appendChild(bt);
  }
}
function drawWheel() {
  const cv = $('#color-wheel'); const [W, H, d] = fitCanvas(cv); const ctx = cv.getContext('2d');
  if (WHEEL.size !== W) {
    const img = ctx.createImageData(W, H), R = W * 0.47, c = W / 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), i = (y * W + x) * 4;
      if (r > R + 1) continue;
      const [cr, cg, cb] = hsv2rgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, Math.min(1, r / R), 1);
      img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = 255 * clamp(R + 1 - r, 0, 1);
    }
    WHEEL.img = img; WHEEL.size = W;
  }
  ctx.putImageData(WHEEL.img, 0, 0);
  const f = activeFx(); if (!f) return;
  let [h, s] = rgb2hsv(f.values.red, f.values.green, f.values.blue);
  if ((WHEEL.drag || performance.now() - WHEEL.t < 300) && WHEEL.local) [h, s] = WHEEL.local;
  const R = W * 0.47, a = h * Math.PI / 180, x = W / 2 + Math.cos(a) * s * R, y = H / 2 + Math.sin(a) * s * R;
  ctx.lineWidth = 2 * d; ctx.strokeStyle = '#000'; ctx.strokeRect(x - 5 * d, y - 5 * d, 10 * d, 10 * d);
  ctx.lineWidth = 1 * d; ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 5 * d, y - 5 * d, 10 * d, 10 * d);
}

/* ---------------------------------------------------------------- bank */
const BANK = { cols: {}, gm: null };
function updateBank(st) {
  const sig = st.fixtures.map((f) => `${f.id}:${f.name}:${f.address}`).join('|');
  const box = $('#bank');
  if (!box) return;
  if (sig !== S.sig.bank) {
    S.sig.bank = sig; box.innerHTML = ''; BANK.cols = {};
    if (!st.fixtures.length) box.innerHTML = '<div class="bank-empty">Brak lamp. Dodaj je w zakładce Scena 3D.</div>';
    for (const f of st.fixtures) {
      const col = document.createElement('div'); col.className = 'bank-col';
      const sel = document.createElement('button'); sel.className = 'bank-sel';
      sel.innerHTML = `<span class="lamp"></span><b>${esc(f.name)}</b><small>${pad3(f.address)}</small>`;
      sel.onclick = () => send({ type: 'select', id: f.id });
      const fader = new Fader({ label: 'Dimmer', color: C.amber, height: '120px',
        onChange: (v) => sendT(`set:${f.id}:dimmer`, { type: 'set', id: f.id, param: 'dimmer', value: v }) });
      col.append(sel, fader.el); box.appendChild(col);
      BANK.cols[f.id] = { col, lamp: $('.lamp', sel), fader };
    }
  }
  for (const f of st.fixtures) {
    const c = BANK.cols[f.id]; if (!c) continue;
    c.col.classList.toggle('on', f.id === st.active_id);
    c.fader.setValue(f.values.dimmer);
    c.fader.setSub(`${Math.round(f.values.dimmer / 2.55)}%`);
  }
  setText($('#bank-meta'), `${st.fixtures.length} lamp`);
}

/* ---------------------------------------------------------------- dock */
function updateDock(st) {
  const sig = st.fixtures.map((f) => `${f.id}:${f.name}:${f.address}:${f.enabled !== false}`).join('|') + LANG;
  const box = $('#fx-chips');
  if (sig !== S.sig.chips) {
    S.sig.chips = sig; box.innerHTML = '';
    st.fixtures.forEach((f, i) => {
      const b = document.createElement('button');
      b.className = 'fx-chip'; b.dataset.id = f.id; b.title = `Klawisz ${i + 1}`;
      const on = f.enabled !== false;
      b.classList.toggle('off', !on);
      b.innerHTML = `<i></i>${esc(f.name)}<small>${pad3(f.address)}</small><span class="pw" title="${esc(t(on ? 'dock.off' : 'dock.on'))}"><svg viewBox="0 0 24 24" class="ic"><path d="M12 3v8M6.3 7.2a8 8 0 1 0 11.4 0"/></svg></span>`;
      b.onclick = (e) => {
        if (e.target.closest('.pw')) { send({ type: 'update_fixture', id: f.id, enabled: !on }); send({ type: 'save' }); return; }
        return e.ctrlKey || e.shiftKey || e.metaKey ? toggleSel(f.id) : send({ type: 'select', id: f.id });
      };
      box.appendChild(b);
    });
    const add = document.createElement('button');
    add.className = 'fx-chip add'; add.textContent = t('dock.add');
    add.onclick = openPicker;
    box.appendChild(add);
  }
  const sel = new Set(st.selection || []);
  for (const b of $$('.fx-chip[data-id]', box)) {
    b.classList.toggle('on', Number(b.dataset.id) === st.active_id);
    b.classList.toggle('sel', sel.has(Number(b.dataset.id)));
    b.classList.toggle('fx', (st.effects.active || []).some((a) => (a.ids || []).includes(Number(b.dataset.id))));
  }
  const n = sel.size, all = st.fixtures.length;
  setText($('#sel-info'), n ? t('scene.selN', { n }) : '');
  setText($('#sel-all'), n && n === all ? t('scene.selNone') : t('scene.selAll'));
  $('#sel-all').hidden = all < 2;
  const sm = st.smoke || {}, sk = $('#smoke-key');
  sk.hidden = !sm.machines;
  if (sm.machines) {
    sk.classList.toggle('on', !!sm.active);
    setText($('#smoke-sub'), sm.active && sm.left ? t('dock.smokeLeft', { s: Math.ceil(sm.left) }) : sm.auto && sm.auto.on && sm.next != null ? t('dock.smokeAuto', { s: sm.next }) : t('dock.smokeS'));
  }
  updateLooks(st);
  const sp = st.spotlight || {}, ap = (st.effects && st.effects.autopilot) || {};
  $('#q-spot').classList.toggle('on', !!sp.active);
  $('#q-auto').classList.toggle('on', !!ap.on);
  setText($('#q-mood'), ap.on ? t(`mood.${ap.mood}`) : t('q.autoS'));
  const gm = $('#gm');
  if (document.activeElement !== gm) gm.value = st.grand_master;
  setText($('#gm-v'), `${Math.round(st.grand_master / 2.55)}%`);
  $('#blackout').classList.toggle('on', st.blackout);
  $('#bo-banner').hidden = !st.blackout;
  const las = $('#lasers');
  las.classList.toggle('on', st.lasers_enabled);
  setText(las, st.lasers_enabled ? t('dock.lasersOn') : t('dock.lasersOff'));
}
const LK = { sig: '', edit: null };
function updateLooks(st) {
  const box = $('#looks'); if (!box) return;
  const looks = st.looks || [];
  const sig = JSON.stringify([looks, LK.edit, LANG]);
  if (sig === LK.sig || (box.parentElement.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) return;
  LK.sig = sig;
  box.innerHTML = looks.length ? looks.map((l) => `<div class="look" data-id="${l.id}" style="--c:${esc(l.color || '#2f7bff')}"><i></i>
      <span><b>${esc(l.name)}</b><small>${l.fade || 0} s</small></span><button class="more" data-edit="${l.id}">${ic('edit')}</button></div>`).join('')
    : `<span class="look-empty">${esc(t('lk.empty'))}</span>`;
  const old = $('.look-edit'); if (old) old.remove();
  const ed = looks.find((l) => l.id === LK.edit);
  if (ed) {
    const div = document.createElement('div');
    div.className = 'look-edit';
    div.innerHTML = `<label class="lbl rowp">${esc(t('lk.name'))}<input id="lk-name" maxlength="24" value="${esc(ed.name)}"></label>
      <label class="lbl rowp">${esc(t('lk.fade'))}<select id="lk-fade">${[0, 0.5, 1, 2, 4, 8].map((v) => `<option value="${v}" ${v === ed.fade ? 'selected' : ''}>${v} s</option>`).join('')}</select></label>
      <label class="lbl rowp">${esc(t('lk.color'))}<input type="color" id="lk-color" value="${esc(ed.color || '#2f7bff')}"></label>
      <button class="btn sm" id="lk-over">${ic('refresh')}<span>${esc(t('lk.over'))}</span></button>
      <button class="btn sm danger-t" id="lk-del">${ic('trash')}<span>${esc(t('lk.del'))}</span></button>
      <span class="grow"></span><button class="btn sm primary" id="lk-done">${ic('check')}<span>${esc(t('lk.close'))}</span></button>`;
    box.after(div);
    $('#lk-name').onchange = (e) => send({ type: 'look_update', id: ed.id, name: e.target.value.trim() || ed.name });
    $('#lk-fade').onchange = (e) => send({ type: 'look_update', id: ed.id, fade: Number(e.target.value) });
    $('#lk-color').onchange = (e) => send({ type: 'look_update', id: ed.id, color: e.target.value });
    $('#lk-over').onclick = () => send({ type: 'look_update', id: ed.id, recapture: true });
    $('#lk-del').onclick = () => { send({ type: 'look_delete', id: ed.id }); LK.edit = null; };
    $('#lk-done').onclick = () => { LK.edit = null; LK.sig = ''; updateLooks(S.st); };
  }
  for (const el of $$('.look', box)) el.onclick = (e) => {
    if (e.target.closest('.more')) { LK.edit = LK.edit === el.dataset.id ? null : el.dataset.id; LK.sig = ''; updateLooks(S.st); return; }
    send({ type: 'look_recall', id: el.dataset.id });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  };
}
function toggleSel(id) {
  const cur = new Set((S.st && S.st.selection) || []);
  if (cur.has(id)) cur.delete(id); else cur.add(id);
  send({ type: 'selection', ids: [...cur] });
}
function animateLamps(t) {
  for (const f of fixtures()) {
    const { css, glow } = fxColorCss(f, t);
    const chip = $(`.fx-chip[data-id="${f.id}"] i`); if (chip) { chip.style.background = css; chip.style.boxShadow = glow; }
    const c = BANK.cols[f.id]; if (c) c.lamp.style.background = css;
  }
  const f = activeFx(), dot = $('#insp-dot');
  if (f && dot) { const { css, glow } = fxColorCss(f, t); dot.style.background = css; dot.style.boxShadow = glow; }
}

/* ---------------------------------------------------------------- DMX monitor */
const MON = { cells: [] };
function updateMonitor(st) {
  const u = st.dmx.universe, act = activeFx();
  const sig = `${u.length}|${st.fixtures.map((f) => `${f.id}@${f.address}:${f.channels.join(',')}`).join('|')}|${st.active_id}`;
  if (sig !== S.sig.mon) {
    S.sig.mon = sig;
    const own = new Array(u.length).fill(null);
    for (const f of st.fixtures) f.channels.forEach((n, i) => { const ch = f.address - 1 + i; if (ch < own.length) own[ch] = [f, n]; });
    const box = $('#monitor'); box.innerHTML = ''; MON.cells = [];
    for (let i = 0; i < u.length; i++) {
      const o = own[i], c = document.createElement('div');
      c.className = 'cell' + (o ? ' own' : '') + (o && act && o[0].id === act.id ? ' act' : '');
      c.title = o ? `CH ${i + 1} · ${o[0].name} · ${o[1]}` : `CH ${i + 1}`;
      c.innerHTML = `<i></i><b>${i + 1}</b><span></span>`;
      box.appendChild(c); MON.cells.push([$('i', c), $('span', c)]);
    }
  }
  if (S.tab !== 'setup') return;
  for (let i = 0; i < u.length; i++) { MON.cells[i][0].style.height = `${(u[i] / 255) * 100}%`; setText(MON.cells[i][1], String(u[i])); }
  const conf = st.dmx.conflicts.length ? ` · KONFLIKT: ${st.dmx.conflicts[0]}` : '';
  setText($('#mon-meta'), `${st.dmx.send_hz.toFixed(0)} Hz${conf}`);
}

/* ================================================================ DMX channel test */
const TEST = { sig: '' };
const ROLE_PL = { pan: 'pan', pan_fine: 'pan fine', tilt: 'tilt', tilt_fine: 'tilt fine', dimmer: 'jasność',
  shutter: 'strobe', red: 'czerwony', green: 'zielony', blue: 'niebieski', white: 'biały', speed: 'prędkość',
  cwheel: 'koło kolorów', gobo: 'gobo', macro: 'auto / makro', none: '—', spin: 'obrót', beam: 'beam' };
function buildTestGrid() {
  const start = clamp(Number($('#test-start').value) || 1, 1, 512);
  const count = clamp(Number($('#test-count').value) || 1, 1, 32);
  const sig = `${start}:${count}:${S.st ? S.st.fixtures.map((f) => f.address + f.channels.join()).join('|') : ''}`;
  if (sig === TEST.sig) return;
  TEST.sig = sig;
  const box = $('#test-grid'); box.innerHTML = '';
  for (let ch = start; ch < Math.min(513, start + count); ch++) {
    let role = '';
    for (const f of fixtures()) {
      const i = ch - f.address;
      if (i >= 0 && i < f.channels.length) role = `${f.name}: ${ROLE_PL[f.channels[i]] || f.channels[i]}`;
    }
    const row = document.createElement('div');
    row.className = 'trow'; row.dataset.ch = ch;
    row.innerHTML = `<label>CH ${ch}<small>${esc(role)}</small></label><input type="range" min="0" max="255" value="0"><b>0</b>`;
    const inp = $('input', row);
    inp.oninput = () => {
      setText($('b', row), inp.value); row.classList.add('on');
      sendT(`test:${ch}`, { type: 'test_channel', channel: ch, value: Number(inp.value) });
    };
    box.appendChild(row);
  }
}
function updateTestGrid(st) {
  if (S.tab !== 'setup') return;
  buildTestGrid();
  for (const row of $$('#test-grid .trow')) {
    const v = st.test_channels[row.dataset.ch], inp = $('input', row);
    if (v === undefined) { row.classList.remove('on'); if (document.activeElement !== inp && inp.value !== '0') { inp.value = 0; setText($('b', row), '0'); } }
  }
}

/* ================================================================ link status */
function nodeStates(st) {
  const v = st.video, vis = st.vision, d = st.dmx, f = activeFx();
  const src = typeof v.source === 'number' ? `CAM ${v.source}` : 'IP';
  const video = v.state === 'online' ? { s: 'online', tele: `${src} · ${v.width}x${v.height} @ ${v.fps.toFixed(0)} fps` }
    : v.state === 'connecting' ? { s: 'connecting', tele: `łączę z ${src}…` } : { s: 'offline', tele: `${src}: brak obrazu` };
  let vision;
  const cv = `${vis.proc_fps.toFixed(0)} fps · ${vis.proc_ms.toFixed(0)} ms`;
  if (vis.mode === 'manual') vision = { s: 'online', tele: 'tryb ręczny' };
  else if (vis.mode === 'gesture' && vis.hand_failed) vision = { s: 'offline', tele: vis.hand_status };
  else if (vis.mode === 'gesture' && !vis.hand_ready) vision = { s: 'connecting', tele: vis.hand_status };
  else if (video.s !== 'online') vision = { s: 'connecting', tele: 'czekam na obraz' };
  else if (vis.mode === 'track' && vis.tracking.error) vision = { s: 'offline', tele: vis.tracking.error };
  else vision = { s: 'online', tele: `${vis.mode === 'track' ? 'tracker' : 'MediaPipe'} · ${cv}` };
  const dmx = d.state === 'online' ? { s: 'online', tele: `${d.label} @ ${d.send_hz.toFixed(0)} Hz` }
    : d.state === 'connecting' ? { s: 'connecting', tele: `${d.label}…` } : { s: 'offline', tele: d.status };
  let fixture;
  if (!f) fixture = { s: 'offline', tele: 'brak lamp' };
  else if (dmx.s !== 'online') fixture = { s: dmx.s, tele: `${f.name} · DMX ${pad3(f.address)}` };
  else fixture = { s: 'online', tele: `${f.name} · DMX ${pad3(f.address)}${st.blackout ? ' · blackout' : ''}` };
  return { video, vision, dmx, fixture };
}
function updatePills(st) {
  const ns = nodeStates(st), v = st.video, vis = st.vision, d = st.dmx;
  const metric = {
    video: v.state === 'online' ? `${Math.round(v.fps)} fps` : v.state === 'connecting' ? '…' : '—',
    vision: vis.mode === 'manual' ? 'manual' : ns.vision.s === 'online' ? `${Math.round(vis.proc_ms)} ms` : '…',
    dmx: d.state === 'online' ? `${Math.round(d.send_hz)} Hz` : d.config.backend === 'sim' ? 'virtual' : '—',
    fixture: `${st.fixtures.length}${st.blackout ? ' · BO' : ''}`,
  };
  const order = ['video', 'vision', 'dmx', 'fixture'];
  order.forEach((k, i) => {
    const n = ns[k], el = $(`.chain .node[data-node="${k}"]`); if (!el) return;
    const cls = `node ${n.s}`;
    if (el.className !== cls) el.className = cls;
    el.title = tr(n.tele);
    setText($(`#cn-${k}`), metric[k]);
    const link = el.nextElementSibling;
    if (link && link.classList.contains('link')) link.classList.toggle('on', n.s === 'online' && ns[order[i + 1]].s === 'online');
  });
  return ns;
}

/* ================================================================ setup cards */
const CARD = {
  video: (st) => {
    const v = st.video;
    const cams = [0, 1, 2, 3, 4, 5].map((i) => `<button class="btn sm${v.source === i ? ' on' : ''}" data-cam="${i}">CAM ${i}</button>`).join('');
    return `<div class="grp"><span class="lbl">Kamera USB / Iriun / DroidCam</span><div class="rowp">${cams}</div>
        <div class="rowp"><button class="btn sm" id="pp-scan">Szukaj kamer</button><span class="note" id="pp-cams"></span></div></div>
      <div class="grp"><span class="lbl">Telefon przez Wi-Fi (IP Webcam / DroidCam)</span>
        <div class="rowp"><input type="text" id="pp-url" style="flex:1" placeholder="http://192.168.1.X:8080/video" value="${typeof v.source === 'string' ? esc(v.source) : ''}">
        <button class="btn sm" id="pp-url-go">Połącz</button></div></div>
      <div class="rowp"><label class="switch"><input type="checkbox" id="pp-mirror" ${v.mirror ? 'checked' : ''}><span></span>Lustro</label></div>
      <span class="note ${v.state === 'online' ? 'ok' : v.state === 'offline' ? 'err' : ''}">${esc(v.state === 'online' ? `${v.width}x${v.height} @ ${v.fps.toFixed(0)} fps` : v.status)}</span>`;
  },
  dmx: (st) => {
    const c = st.dmx.config;
    const bk = [['sim', 'Wirtualny'], ['udmx', 'uDMX USB'], ['artnet', 'Art-Net'], ['enttec', 'Enttec Pro'], ['opendmx', 'Open DMX']];
    return `<div class="grp"><span class="lbl">Interfejs</span><div class="seg" id="pp-bk">${bk.map(([v, l]) => `<button data-v="${v}" class="${v === c.backend ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="grp" data-for="enttec opendmx"><span class="lbl">Port adaptera USB-DMX</span>
        <div class="rowp"><select id="pp-port" style="flex:1"><option value="${esc(c.port)}">${esc(c.port)}</option></select><button class="btn sm" id="pp-ports">Odśwież</button></div>
        <span class="note" id="pp-port-warn"></span></div>
      <div class="grp" data-for="artnet"><span class="lbl">Art-Net IP · universe</span>
        <div class="rowp"><input type="text" id="pp-ip" style="flex:1" value="${esc(c.ip)}"><input type="number" id="pp-uni" style="width:70px" min="0" max="32767" value="${c.universe}"></div></div>
      <span class="note" data-for="udmx">Kabel uDMX (VID 16C0 PID 05DC) wymaga jednorazowo sterownika WinUSB z programu Zadig.</span>
      <span class="note err" data-for="enttec">Enttec Pro to inny protokół. Kabel FT232R / „USB Serial Converter” to <b>Open DMX</b> — z Enttec Pro lampa dostaje śmieci i wariuje.</span>
      <span class="note ok" data-for="opendmx">Open DMX = kabel FTDI FT232R. Sterowanie przez natywny sterownik FTDI (D2XX), w razie braku przez port COM.</span>
      <div class="rowp"><button class="btn primary sm" id="pp-apply">Połącz</button></div>
      <span class="note ${st.dmx.ok ? 'ok' : 'err'}">${esc(st.dmx.status)}</span>`;
  },
  vision: (st) => {
    const vis = st.vision, it = st.interaction;
    const seg = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return `<div class="grp"><span class="lbl">Tryb</span>${seg('pp-mode', [['gesture', 'Gesty'], ['track', 'Śledzenie'], ['manual', 'Ręcznie']], vis.mode)}</div>
      <div class="grp"><span class="lbl">Celowanie palcem</span>${seg('pp-aim', [['direct', 'Proste — palec = kierunek'], ['stage', 'Scena 3D (po kalibracji)']], st.aim_mode)}
        <div class="rowp"><span class="lbl">Zakres ruchu</span>
          <label class="lbl">pan <input type="number" id="pp-span-p" value="${st.aim_span[0]}" min="20" max="540" step="10" style="width:64px">°</label>
          <label class="lbl">tilt <input type="number" id="pp-span-t" value="${st.aim_span[1]}" min="20" max="270" step="10" style="width:64px">°</label></div></div>
      <div class="grp"><span class="lbl">Gesty sterują</span>${seg('pp-scope', [['active', 'Aktywną lampą'], ['all', 'Wszystkimi']], it.scope)}</div>
      <div class="grp"><span class="lbl">Śledzenie steruje</span>${seg('pp-follow', [['active', 'Aktywną lampą'], ['all', 'Wszystkimi']], it.follow_all ? 'all' : 'active')}</div>
      <div class="grp"><span class="lbl">Płynność ruchu <span class="mono" id="pp-sm-v">${st.position_smoothing.toFixed(2)}</span></span>
        <input type="range" id="pp-smooth" min="0.03" max="1" step="0.01" value="${st.position_smoothing}"></div>
      <span class="note ${vis.hand_failed ? 'err' : ''}">${esc(vis.hand_status)}</span>`;
  },
  fixture: (st) => {
    const sg = st.stage;
    const num = (id, key, step, min) => `<label class="lbl">${key}<input type="number" id="${id}" step="${step}" min="${min}" value="${sg[{ 'st-w': 'width', 'st-d': 'depth', 'st-h': 'truss_height', 'st-a': 'aim_height' }[id]]}" style="width:80px"></label>`;
    return `<div class="grp"><span class="lbl">Wymiary sceny [m]</span><div class="rowp">
        ${num('st-w', 'Szerokość', 0.5, 2)}${num('st-d', 'Głębokość', 0.5, 2)}${num('st-h', 'Truss', 0.1, 1)}${num('st-a', 'Cel trackera', 0.1, 0)}</div></div>
      <div class="grp"><span class="lbl">Kamera → podłoga</span>
        <div class="rowp"><button class="btn sm" id="pp-floor">Kalibruj podłogę</button><button class="btn sm" id="pp-floor-reset">Reset</button></div>
        <span class="note ${sg.calibrated ? 'ok' : ''}">${sg.calibrated ? 'podłoga skalibrowana' : 'domyślna mapa (cały kadr = scena)'}</span></div>
      <div class="rowp"><button class="btn sm" id="pp-save">Zapisz teraz</button><span class="note">zmiany zapisują się też automatycznie</span></div>`;
  },
};
const CARD_SIG = {
  video: (st) => `${st.video.source}|${st.video.mirror}|${st.video.state}|${st.video.status}`,
  dmx: (st) => `${JSON.stringify(st.dmx.config)}|${st.dmx.status}|${st.dmx.ok}`,
  vision: (st) => `${st.vision.mode}|${st.interaction.scope}|${st.interaction.follow_all}|${st.vision.hand_status}|${st.aim_mode}|${st.aim_span}`,
  fixture: (st) => `${JSON.stringify(st.stage.quad)}|${st.stage.width}|${st.stage.depth}|${st.stage.truss_height}|${st.stage.aim_height}`,
};
const CARD_BIND = {
  video: (p) => {
    for (const b of $$('[data-cam]', p)) b.onclick = () => send({ type: 'source', source: b.dataset.cam });
    $('#pp-scan', p).onclick = () => { setText($('#pp-cams', p), 'szukam…'); send({ type: 'scan_cameras' }); };
    const go = () => { const u = $('#pp-url', p).value.trim(); if (u) send({ type: 'source', source: u }); };
    $('#pp-url-go', p).onclick = go;
    $('#pp-url', p).onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('#pp-mirror', p).onchange = (e) => send({ type: 'mirror', value: e.target.checked });
  },
  dmx: (p, st) => {
    let bk = st.dmx.config.backend;
    const show = () => { for (const g of $$('[data-for]', p)) g.style.display = g.dataset.for.split(' ').includes(bk) ? '' : 'none'; };
    for (const b of $$('#pp-bk button', p)) b.onclick = () => { bk = b.dataset.v; $$('#pp-bk button', p).forEach((x) => x.classList.toggle('on', x === b)); show(); };
    show();
    $('#pp-ports', p).onclick = () => send({ type: 'list_ports' });
    $('#pp-port', p).onchange = fillPorts;
    send({ type: 'list_ports' });
    $('#pp-apply', p).onclick = () => {
      const det = (S.st.devices || []).find((d) => d.kind === 'dmx' && d.port === $('#pp-port', p).value);
      if (det && det.backend === 'opendmx' && bk === 'enttec' && !confirm(t('dmx.wrongEnttec'))) return;   // FTDI cable + Enttec protocol = garbage
      send({ type: 'dmx_output', backend: bk, port: $('#pp-port', p).value, ip: $('#pp-ip', p).value.trim(), universe: Number($('#pp-uni', p).value) });
    };
    fillPorts();
  },
  vision: (p) => {
    const segBind = (id, fn) => { for (const b of $$(`#${id} button`, p)) b.onclick = () => { $$(`#${id} button`, p).forEach((x) => x.classList.toggle('on', x === b)); fn(b.dataset.v); }; };
    segBind('pp-mode', (v) => send({ type: 'mode', mode: v }));
    segBind('pp-scope', (v) => send({ type: 'scope', value: v }));
    segBind('pp-aim', (v) => send({ type: 'aim_mode', value: v }));
    const span = () => send({ type: 'aim_mode', value: S.st.aim_mode, span: [Number($('#pp-span-p', p).value), Number($('#pp-span-t', p).value)] });
    $('#pp-span-p', p).onchange = span; $('#pp-span-t', p).onchange = span;
    segBind('pp-follow', (v) => send({ type: 'follow_all', value: v === 'all' }));
    $('#pp-smooth', p).oninput = (e) => { setText($('#pp-sm-v', p), Number(e.target.value).toFixed(2)); sendT('smooth', { type: 'smoothing', value: Number(e.target.value) }); };
  },
  fixture: (p) => {
    for (const [id, key] of [['st-w', 'width'], ['st-d', 'depth'], ['st-h', 'truss_height'], ['st-a', 'aim_height']]) {
      $(`#${id}`, p).onchange = (e) => { const v = Number(e.target.value); if (v > 0 || key === 'aim_height') send({ type: 'stage', [key]: v }); };
    }
    $('#pp-floor', p).onclick = () => { setTab('hand'); startFloorCal(); };
    $('#pp-floor-reset', p).onclick = () => send({ type: 'camera_quad', quad: null });
    $('#pp-save', p).onclick = () => send({ type: 'save' });
  },
};
function refreshSetup(force) {
  const st = S.st; if (!st || S.tab !== 'setup') return;
  for (const k of Object.keys(CARD)) {
    const box = $(`#card-${k}`); if (!box) continue;           // v4: stage + vision cards live in setup.js now
    const sig = CARD_SIG[k](st);
    if (!force && sig === S.sig.cards[k]) continue;
    if (!force && box.contains(document.activeElement) && document.activeElement !== document.body) continue;
    S.sig.cards[k] = sig;
    box.innerHTML = CARD[k](st);
    CARD_BIND[k](box, st);
  }
}
function fillPorts() {
  const sel = $('#pp-port'); if (!sel || !S.st) return;
  const cur = S.st.dmx.config.port;
  const list = S.ports && S.ports.length ? S.ports : [{ device: cur, description: '' }];
  // preselect the USB adapter, never a motherboard COM port
  const best = list.find((p) => p.recommended) || list.find((p) => p.usb) || list[0];
  const pick = list.some((p) => p.device === cur && (p.usb || list.length === 1)) ? cur : best.device;
  sel.innerHTML = list.map((pt) => {
    const tag = pt.recommended ? ' ✔ USB-DMX' : pt.usb ? ' · USB' : ' · płyta główna (nie nadaje się)';
    return `<option value="${esc(pt.device)}" ${pt.device === pick ? 'selected' : ''}>${esc(pt.device)} ${esc(pt.description)}${tag}</option>`;
  }).join('');
  const warn = $('#pp-port-warn');
  if (warn) {
    const chosen = list.find((p) => p.device === sel.value);
    warn.textContent = chosen && !chosen.usb ? 'To port płyty głównej — DMX wymaga adaptera USB (FTDI).' : '';
    warn.className = 'note' + (chosen && !chosen.usb ? ' err' : '');
  }
}
function onCameras(list) {
  S.cameras = list;
  if (typeof PH.onCameras === 'function') PH.onCameras(list);
  const txt = list.map((c) => `${c.index}: ${c.in_use ? t('cam.inuse') : c.ok ? `${c.width}x${c.height}` : '—'}`).join('  ');
  setText($('#pp-cams'), txt);
  toast(`Kamery: ${list.filter((c) => c.ok).map((c) => `CAM ${c.index}`).join(', ') || 'nie znaleziono'}`, list.some((c) => c.ok) ? 'ok' : 'warn');
}

/* ================================================================ inspector (Scena 3D) */
function updateInspector(st) {
  const f = activeFx(), box = $('#inspector');
  const placing = window.PH3D && window.PH3D.placing;
  const show = f && S.tab === 'scene' && !placing && S.inspClosedFor !== f.id;
  box.hidden = !show;
  if (!show) return;
  const focus = document.activeElement;
  const setVal = (el, v) => { if (focus !== el) el.value = v; };
  setVal($('#insp-name'), f.name);
  setVal($('#insp-addr'), f.address);
  setVal($('#insp-h'), f.pos[1]);
  setText($('#insp-h-v'), `${f.pos[1].toFixed(1)} m`);
  setText($('#insp-pos'), `X ${f.pos[0].toFixed(1)} · Z ${f.pos[2].toFixed(1)} m`);
  for (const b of $$('#insp-mount button')) b.classList.toggle('on', b.dataset.m === f.mount);
  for (const b of $$('#insp-yaw button')) b.classList.toggle('on', Math.round(f.yaw) === Number(b.dataset.y));
}
function initInspector() {
  const upd = (patch, key) => { const f = activeFx(); if (!f) return; const m = { type: 'update_fixture', id: f.id, ...patch }; key ? sendT(key, m) : send(m); };
  $('#insp-name').onchange = (e) => { if (e.target.value.trim()) upd({ name: e.target.value.trim() }); };
  $('#insp-addr').onchange = (e) => upd({ address: Number(e.target.value) });
  $('#insp-h').oninput = (e) => { const f = activeFx(); if (f) { setText($('#insp-h-v'), `${Number(e.target.value).toFixed(1)} m`); upd({ pos: [f.pos[0], Number(e.target.value), f.pos[2]] }, 'insp-h'); } };
  for (const b of $$('#insp-mount button')) b.onclick = () => {
    const f = activeFx(); if (!f || !S.st) return;
    upd({ mount: b.dataset.m, pos: [f.pos[0], b.dataset.m === 'hang' ? S.st.stage.truss_height : 0.4, f.pos[2]] });
  };
  for (const b of $$('#insp-yaw button')) b.onclick = () => upd({ yaw: Number(b.dataset.y) });
  $('#insp-close').onclick = () => { const f = activeFx(); S.inspClosedFor = f ? f.id : null; $('#inspector').hidden = true; };
  $('#insp-more').onclick = () => { const f = activeFx(); if (f) { if (PH.editDevice) PH.editDevice(f.id); else openFixtureDialog(f); } };
  $('#insp-del').onclick = () => { const f = activeFx(); if (f && confirm(`Usunąć ${f.name}?`)) send({ type: 'remove_fixture', id: f.id }); };
}

/* ================================================================ per-state UI update */
let lastActive = null;
const ON_STATE = [];
function updateUI(st) {
  if (st.active_id !== lastActive) { lastActive = st.active_id; S.inspClosedFor = null; }
  updatePills(st);
  updateDock(st);
  updateRail(st);
  updateInspector(st);
  const empty = !st.fixtures.length && !(window.PH3D && window.PH3D.placing);
  $('#scene-empty').hidden = !empty;
  $('#scene-hint').hidden = !st.fixtures.length;
  $('#placing').hidden = !(window.PH3D && window.PH3D.placing);

  const vis = st.vision, v = st.video;
  for (const b of $$('#mode-tabs button')) b.classList.toggle('on', b.dataset.mode === vis.mode);
  $('#track-tools').hidden = vis.mode !== 'track';
  $('#glist').hidden = vis.mode !== 'gesture';
  const cam = $('#show-cam');
  cam.checked = S.showCam || vis.mode !== 'gesture' || !!S.floorCal;
  const wantVideo = (S.tab === 'hand' && cam.checked) || !!S.forceVideo || !!S.gcVideo;
  if (wantVideo !== S.wantVideo) { S.wantVideo = wantVideo; send({ type: 'video', value: wantVideo }); }
  cam.disabled = vis.mode !== 'gesture';

  // hand hint
  const hint = $('#hand-hint');
  let msg, cls = '';
  if (S.floorCal) { msg = `Kliknij róg ${floorCorners()[S.floorCal.length]} (${S.floorCal.length + 1}/4) · Esc anuluje`; cls = 'warn'; }
  else if (!v.connected) { msg = t('hand.noCam', { s: v.status }); cls = v.state === 'connecting' ? 'warn' : 'err'; }
  else if (st.calibration.running) { msg = `Auto-kalibracja: ${st.calibration.message}`; cls = 'warn'; }
  else if (vis.mode === 'gesture' && !vis.hand_ready) { msg = vis.hand_status; cls = vis.hand_failed ? 'err' : 'warn'; }
  else if (vis.mode === 'gesture') {
    const n = (vis.perception.hands || []).length;
    msg = n ? t('hand.hands', { n }) : t('hand.noHands');
  } else if (vis.mode === 'track' && st.spotlight && st.spotlight.active) { msg = t('hand.spotOn'); cls = 'warn';
  } else if (vis.mode === 'track') {
    const tk = vis.tracking, n = (tk.people || []).length;
    msg = tk.error === 'no_person' && !tk.active ? t('trk.noPerson') : !tk.active && n ? t('trk.people', { n }) : t('trk.hint');
  }
  else msg = t('hand.manualHint');
  setText(hint, msg); hint.className = `float bl hint mono ${cls}`;

  updateGestures(st);

  if (S.tab === 'mixer') { updateProgrammer(); updateBank(st); }
  updateMonitor(st);
  updateTestGrid(st);
  refreshSetup(false);

  for (const fn of ON_STATE) { try { fn(st); } catch (e) { console.error(e); } }

  const cal = st.calibration;
  if (S.calWasRunning && !cal.running && cal.message) toast(`Auto-kalibracja: ${cal.message}`, cal.ok ? 'ok' : 'err');
  S.calWasRunning = cal.running;
}

/* ================================================================ hand view */
function frameRect(W, H) {   // camera image placed "contain" in the canvas
  const st = S.st;
  const ar = S.bitmap ? S.bitmap.width / S.bitmap.height : (st && st.video.width ? st.video.width / st.video.height : 16 / 9);
  let w = W, h = W / ar;
  if (h > H) { h = H; w = H * ar; }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function syncHands(dt) {
  const st = S.st, seen = new Set();
  const list = st && st.vision.mode === 'gesture' ? (st.vision.perception.hands || []) : [];
  for (const h of list) {
    seen.add(h.slot);
    let e = S.hands.get(h.slot);
    if (!e) { e = { lm: h.landmarks.map((p) => p.slice()), alpha: 0, data: h, trail: [], tTrail: 0 }; S.hands.set(h.slot, e); }
    const fresh = e.data !== h;
    if (fresh) {                                   // new sample: estimate velocity for prediction
      const now = performance.now();
      if (e.prev && e.tPrev) {
        const sdt = Math.max(0.01, (now - e.tPrev) / 1000);
        e.gap = e.gap ? e.gap * 0.8 + sdt * 0.2 : sdt;               // real time between camera samples
        const v = h.landmarks.map((q, i) => [(q[0] - e.prev[i][0]) / sdt, (q[1] - e.prev[i][1]) / sdt]);
        e.vel = e.vel ? e.vel.map((o, i) => [o[0] * 0.4 + v[i][0] * 0.6, o[1] * 0.4 + v[i][1] * 0.6]) : v;
      }
      e.prev = h.landmarks; e.tPrev = now;
    }
    e.data = h;
    const gap = clamp(e.gap || 0.033, 0.016, 0.2);
    const k = 1 - Math.exp(-dt / Math.max(0.02, gap * 0.45));   // follows slow cameras without stalls
    const ahead = e.vel ? Math.min(gap * 0.8, (performance.now() - e.tPrev) / 1000) : 0;
    e.lm.forEach((p, i) => {
      const q = h.landmarks[i], v = e.vel ? e.vel[i] : [0, 0];
      p[0] = lerp(p[0], q[0] + v[0] * ahead, k); p[1] = lerp(p[1], q[1] + v[1] * ahead, k); p[2] = lerp(p[2], q[2], k);
    });
    e.alpha = Math.min(1, e.alpha + dt * 5);
    e.tTrail += dt;
    if (e.tTrail > 0.045) {                       // holographic after-image
      e.tTrail = 0;
      e.trail.push(e.lm.map((p) => [p[0], p[1]]));
      if (e.trail.length > 6) e.trail.shift();
    }
  }
  for (const [slot, e] of S.hands) {
    if (!seen.has(slot)) { e.alpha -= dt * 3; if (e.alpha <= 0) S.hands.delete(slot); }
  }
}
function hudLabel(ctx, text, x, y, d, color = C.dim) {
  text = String(text).split('\n').map(tr).join('\n');
  ctx.save();
  ctx.font = `600 ${10.5 * d}px JetBrains Mono, Consolas, monospace`;
  const lines = text.split('\n'), lh = 13 * d, w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 10 * d;
  ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.shadowColor = 'rgba(40,30,110,.18)'; ctx.shadowBlur = 8 * d;
  ctx.beginPath(); ctx.roundRect(x, y, w, lines.length * lh + 5 * d, 6 * d); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = color === C.dim ? '#4b4863' : color; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 5 * d, y + 3 * d + i * lh));
  ctx.restore();
}
function drawGestureOverlay(ctx, R, d, e, P, t) {
  const h = e.data, g = h.gesture, act = activeFx(), zones = S.st.interaction.zones;
  const pc = [R.x + h.palm_center[0] * R.w, R.y + h.palm_center[1] * R.h];
  ctx.save(); ctx.globalAlpha = e.alpha; ctx.lineWidth = 1.5 * d;
  if (g === 'point') {
    const [x5, y5] = P[5], [x8, y8] = P[8], dx = x8 - x5, dy = y8 - y5, len = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = C.hand; ctx.setLineDash([6 * d, 5 * d]); ctx.lineDashOffset = -t * 40 * d;
    ctx.beginPath(); ctx.moveTo(x8, y8); ctx.lineTo(x8 + dx / len * R.h * 0.2, y8 + dy / len * R.h * 0.2); ctx.stroke(); ctx.setLineDash([]);
    const cr = (14 + 2 * Math.sin(t * 6)) * d;
    ctx.beginPath(); ctx.arc(x8, y8, cr, 0, 7);
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x8 + ax * cr * 0.45, y8 + ay * cr * 0.45); ctx.lineTo(x8 + ax * cr * 1.6, y8 + ay * cr * 1.6); }
    ctx.stroke();
    hudLabel(ctx, `X ${h.index_tip[0].toFixed(2)}  Y ${h.index_tip[1].toFixed(2)}${act ? `\nPAN ${pad3(coarse(act, 'pan'))}  TILT ${pad3(coarse(act, 'tilt'))}` : ''}`, x8 + cr * 1.8, y8 - cr * 2.4, d, C.hand);
  } else if (g === 'dimmer') {
    const x = R.x + R.w - 26 * d, y0 = R.y + zones.dimmer[0] * R.h, y1 = R.y + zones.dimmer[1] * R.h, lvl = act ? act.values.dimmer / 255 : 0;
    ctx.fillStyle = 'rgba(109,91,255,.14)'; ctx.fillRect(x - 4 * d, y0, 8 * d, y1 - y0);
    ctx.fillStyle = C.amber; ctx.fillRect(x - 4 * d, y1 - (y1 - y0) * lvl, 8 * d, (y1 - y0) * lvl);
    ctx.strokeStyle = C.amber; ctx.setLineDash([3 * d, 4 * d]);
    ctx.beginPath(); ctx.moveTo(pc[0], pc[1]); ctx.lineTo(x - 8 * d, pc[1]); ctx.stroke(); ctx.setLineDash([]);
    hudLabel(ctx, `Jasność ${Math.round(lvl * 100)}%`, x - 120 * d, y0 - 24 * d, d, C.amber);
  } else if (g === 'crossfade') {
    const y = R.y + R.h - 80 * d, x0 = R.x + zones.crossfade[0] * R.w, x1 = R.x + zones.crossfade[1] * R.w;
    ctx.fillStyle = 'rgba(109,91,255,.14)'; ctx.fillRect(x0, y - 2 * d, x1 - x0, 4 * d);
    const fx = [...S.st.fixtures].sort((a, b) => a.pos[0] - b.pos[0] || a.id - b.id), n = fx.length;
    fx.forEach((f, i) => {
      const x = n > 1 ? x0 + (x1 - x0) * i / (n - 1) : (x0 + x1) / 2, I = f.values.dimmer / 255;
      ctx.fillStyle = `rgba(16,185,129,${0.25 + 0.75 * I})`; ctx.fillRect(x - 5 * d, y - 5 * d - 16 * d * I, 10 * d, 10 * d + 16 * d * I);
    });
    const mx = clamp(pc[0], x0, x1);
    ctx.strokeStyle = C.green; ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.moveTo(mx, y - 28 * d); ctx.lineTo(mx, y + 10 * d); ctx.stroke();
  } else if (g === 'strobe') {
    const r = 44 * d;
    ctx.strokeStyle = 'rgba(239,68,68,.18)'; ctx.lineWidth = 4 * d; ctx.beginPath(); ctx.arc(pc[0], pc[1], r, 0, 7); ctx.stroke();
    ctx.strokeStyle = C.red; ctx.beginPath(); ctx.arc(pc[0], pc[1], r, -Math.PI / 2, -Math.PI / 2 + h.tightness * Math.PI * 2); ctx.stroke();
    hudLabel(ctx, `STROBE ${Math.round(h.tightness * 100)}%`, pc[0] - 48 * d, pc[1] + r + 8 * d, d, C.red);
  } else if (g === 'color') {
    const r = 50 * d;
    for (let a = 0; a < 360; a += 10) {
      ctx.strokeStyle = `hsl(${a},100%,50%)`; ctx.lineWidth = 4 * d;
      ctx.beginPath(); ctx.arc(pc[0], pc[1], r, (a - 90) * Math.PI / 180, (a - 81) * Math.PI / 180); ctx.stroke();
    }
    const a = (h.hue - 90) * Math.PI / 180, mx = pc[0] + Math.cos(a) * r, my = pc[1] + Math.sin(a) * r;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * d; ctx.strokeRect(mx - 5 * d, my - 5 * d, 10 * d, 10 * d);
  }
  ctx.restore();
}
function drawFloorGrid(ctx, R, d, st, alpha) {
  const sg = st.stage, hw = sg.width / 2, hd = sg.depth / 2;
  const line = (a, b) => {
    let prev = null;
    for (let k = 0; k <= 12; k++) {
      const p = floorToImg(a[0] + (b[0] - a[0]) * k / 12, a[1] + (b[1] - a[1]) * k / 12);
      if (p && prev) { ctx.moveTo(R.x + prev[0] * R.w, R.y + prev[1] * R.h); ctx.lineTo(R.x + p[0] * R.w, R.y + p[1] * R.h); }
      prev = p;
    }
  };
  ctx.save(); ctx.lineWidth = 1 * d;
  ctx.strokeStyle = `rgba(6,182,212,${0.08 * alpha})`; ctx.beginPath();
  for (let X = Math.ceil(-hw) + 1; X < hw; X++) line([X, -hd], [X, hd]);
  for (let Z = Math.ceil(-hd) + 1; Z < hd; Z++) line([-hw, Z], [hw, Z]);
  ctx.stroke();
  ctx.strokeStyle = `rgba(6,182,212,${0.3 * alpha})`; ctx.beginPath();
  line([-hw, hd], [hw, hd]); line([hw, hd], [hw, -hd]); line([hw, -hd], [-hw, -hd]); line([-hw, -hd], [-hw, hd]);
  ctx.stroke(); ctx.restore();
}
function drawSpots(ctx, R, d, t, st) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const f of st.fixtures) {
    const sp = f.spot, I = intensity(f, t);
    if (!sp || !sp.img || I < 0.01) continue;
    const x = R.x + sp.img[0] * R.w, y = R.y + sp.img[1] * R.h, rad = clamp((sp.r_img || 0.05) * R.w * 1.5, 8 * d, R.w * 0.35), [r, g, b] = rgbOf(f);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${r},${g},${b},${0.45 * I})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.lineWidth = 1 * d; ctx.font = `${9.5 * d}px JetBrains Mono, Consolas, monospace`;
  for (const f of st.fixtures) {
    const sp = f.spot; if (!sp || !sp.img) continue;
    const x = R.x + sp.img[0] * R.w, y = R.y + sp.img[1] * R.h, rad = clamp((sp.r_img || 0.05) * R.w, 6 * d, R.w * 0.25), on = f.id === st.active_id;
    ctx.strokeStyle = on ? C.cyan : 'rgba(141,148,161,.35)';
    if (on) { ctx.setLineDash([4 * d, 4 * d]); ctx.lineDashOffset = -t * 20 * d; }
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = on ? C.cyan : C.dim; ctx.fillText(f.name, x + rad + 4 * d, y);
  }
  ctx.restore();
}
function drawIcons(ctx, R, d, t, st) {
  const ir = st.interaction.icon_radius * R.h, bw = ir * 1.5, bh = ir * 0.95;
  ctx.save(); ctx.font = `600 ${9.5 * d}px JetBrains Mono, Consolas, monospace`; ctx.textAlign = 'center';
  for (const f of st.fixtures) {
    const x = R.x + f.icon[0] * R.w, y = R.y + f.icon[1] * R.h, [r, g, b] = rgbOf(f), I = intensity(f, t), on = f.id === st.active_id;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.strokeStyle = on ? '#6d5bff' : 'rgba(109,91,255,.25)'; ctx.lineWidth = (on ? 2 : 1) * d; ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.fillStyle = `rgba(${r},${g},${b},${0.12 + 0.88 * I})`;
    ctx.beginPath(); ctx.arc(x, y, bh * 0.28, 0, 7); ctx.fill();
    if (st.interaction.hover_id === f.id) {
      ctx.fillStyle = C.amber; ctx.fillRect(x - bw / 2, y + bh / 2 + 3 * d, bw * st.interaction.hover_progress, 3 * d);
    }
    ctx.fillStyle = on ? '#6d5bff' : '#6b6885'; ctx.fillText(f.name, x, y + bh / 2 + 17 * d);
  }
  ctx.restore();
}
function drawTracking(ctx, R, d, st) {
  const tr = st.vision.tracking;
  if (st.vision.mode !== 'track') return;
  for (const p of tr.people || []) {            // everyone the detector sees: click to follow
    const [px, py, pw, ph] = p.box;
    if (tr.bbox && Math.abs(px - tr.bbox[0]) < 0.03 && Math.abs(py - tr.bbox[1]) < 0.05) continue;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5 * d; ctx.setLineDash([5 * d, 4 * d]);
    ctx.strokeRect(R.x + px * R.w, R.y + py * R.h, pw * R.w, ph * R.h); ctx.restore();
  }
  if (!tr.active || !tr.bbox) return;
  const [bx, by, bw, bh] = tr.bbox, x = R.x + bx * R.w, y = R.y + by * R.h, w = bw * R.w, h = bh * R.h;
  const col = tr.status === 'searching' ? C.red : tr.status === 'coasting' ? '#e98a00' : C.green, L = Math.min(w, h) * 0.22;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2 * d; ctx.beginPath();
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L);
  }
  ctx.stroke(); ctx.restore();
  hudLabel(ctx, t(`trk.${tr.status || 'tracking'}`, { s: Math.round(tr.lost_s || 0) }), x, Math.max(R.y, y - 22 * d), d, col);
}
let lastT = 0;
function drawHandView(t) {
  const cv = $('#video-canvas'); const [W, H, d] = fitCanvas(cv); const ctx = cv.getContext('2d');
  const dt = Math.min(0.1, t - lastT); lastT = t;
  syncHands(dt);
  const st = S.st;
  const R = frameRect(W, H);
  const showCam = !!st && (S.showCam || st.vision.mode !== 'gesture' || !!S.floorCal || !!(st.interaction.mecal && st.interaction.mecal.active));
  PH.holo.drawBackground(ctx, W, H, R, d, showCam);
  PH.holo.frame(t);
  if (!st) return;
  if (showCam && S.bitmap) { ctx.save(); ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, 14 * d); ctx.clip(); ctx.drawImage(S.bitmap, R.x, R.y, R.w, R.h); ctx.restore(); }
  ctx.strokeStyle = 'rgba(109,91,255,.35)'; ctx.lineWidth = 2 * d; const cl = 20 * d;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[R.x, R.y, 1, 1], [R.x + R.w, R.y, -1, 1], [R.x, R.y + R.h, 1, -1], [R.x + R.w, R.y + R.h, -1, -1]]) {
    ctx.moveTo(x + sx * cl, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * cl);
  }
  ctx.stroke();
  drawFloorGrid(ctx, R, d, st, showCam ? 1 : 0.6);
  drawSpots(ctx, R, d, t, st);
  const man = st.spotlight && st.spotlight.active && st.spotlight.manual;
  if (man) {                                   // manual spotlight: where the person stands
    const x = R.x + man[0] * R.w, y = R.y + man[1] * R.h, r = (16 + 3 * Math.sin(t * 5)) * d;
    ctx.save(); ctx.strokeStyle = '#f5a524'; ctx.lineWidth = 3 * d; ctx.shadowColor = 'rgba(245,165,36,.8)'; ctx.shadowBlur = 14 * d;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, 7); ctx.stroke(); ctx.restore();
  }
  if (st.vision.mode === 'gesture') drawIcons(ctx, R, d, t, st);
  drawTracking(ctx, R, d, st);
  for (const e of S.hands.values()) { const P = PH.holo.drawHand(ctx, R, d, e, t); drawGestureOverlay(ctx, R, d, e, P, t); }
  if (S.roi) {
    const { x0, y0, x1, y1 } = S.roi;
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5 * d; ctx.setLineDash([5 * d, 4 * d]);
    ctx.strokeRect(R.x + Math.min(x0, x1) * R.w, R.y + Math.min(y0, y1) * R.h, Math.abs(x1 - x0) * R.w, Math.abs(y1 - y0) * R.h);
    ctx.setLineDash([]);
  }
  if (S.floorCal) {
    ctx.strokeStyle = C.amber; ctx.fillStyle = C.amber; ctx.lineWidth = 2 * d; ctx.beginPath();
    S.floorCal.forEach(([x, y], i) => (i ? ctx.lineTo(R.x + x * R.w, R.y + y * R.h) : ctx.moveTo(R.x + x * R.w, R.y + y * R.h)));
    ctx.stroke();
    S.floorCal.forEach(([x, y], i) => { ctx.fillRect(R.x + x * R.w - 4 * d, R.y + y * R.h - 4 * d, 8 * d, 8 * d); hudLabel(ctx, floorCorners()[i], R.x + x * R.w + 6 * d, R.y + y * R.h + 6 * d, d, C.amber); });
  }

}

/* ---------------------------------------------------------------- hand view pointer */
function normPos(e) {
  const cv = $('#video-canvas'), r = cv.getBoundingClientRect(), R = frameRect(r.width, r.height);
  return [(e.clientX - r.left - R.x) / R.w, (e.clientY - r.top - R.y) / R.h];
}
function hitIcon(x, y) {
  const st = S.st; if (!st) return null;
  const cv = $('#video-canvas'), R = frameRect(cv.clientWidth, cv.clientHeight), aspect = R.w / R.h, rad = st.interaction.icon_radius;
  for (const f of st.fixtures) if (Math.hypot((x - f.icon[0]) * aspect, y - f.icon[1]) < rad) return f.id;
  return null;
}
function startFloorCal() { S.floorCal = []; toast('Kliknij 4 rogi sceny: przód-lewo, przód-prawo, tył-prawo, tył-lewo'); }
function initHandPointer() {
  const cv = $('#video-canvas');
  cv.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !S.st) return;
    const [x, y] = normPos(e);
    if (x < 0 || y < 0 || x > 1 || y > 1) return;
    if (S.floorCal) {
      S.floorCal.push([x, y]);
      if (S.floorCal.length === 4) { send({ type: 'camera_quad', quad: S.floorCal }); S.floorCal = null; }
      return;
    }
    const mode = S.st.vision.mode, hit = mode === 'gesture' ? hitIcon(x, y) : null;
    if (hit !== null && !e.shiftKey) { send({ type: 'select', id: hit }); return; }
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    if (mode === 'track' || e.shiftKey) { S.roi = { x0: x, y0: y, x1: x, y1: y }; return; }
    if (mode === 'manual') { S.manualDrag = true; sendT('pos', { type: 'position', x, y }); }
  });
  cv.addEventListener('pointermove', (e) => {
    const [x, y] = normPos(e).map((v) => clamp(v, 0, 1));
    if (S.roi) { S.roi.x1 = x; S.roi.y1 = y; } else if (S.manualDrag) sendT('pos', { type: 'position', x, y });
  });
  const end = () => {
    if (S.roi) {
      const { x0, y0, x1, y1 } = S.roi, w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (w > 0.015 && h > 0.015) send({ type: 'track_roi', x: Math.min(x0, x1), y: Math.min(y0, y1), w, h });
      else if (S.st && S.st.vision.mode === 'track') send({ type: 'track_point', x: x0, y: y0 });
      S.roi = null;
    }
    S.manualDrag = false;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); send({ type: 'track_clear' }); });
}

/* ================================================================ device picker */
const TYPE_ICON = { moving_head: ic('lamp'), bar: ic('bar'), derby: ic('derby'), par: ic('par'), strobe: ic('bolt'), laser: ic('laser'), smoke: ic('smoke') };
function openPicker() {
  const dlg = $('#pick-dialog'), box = $('#picker');
  const lib = S.library || [];
  box.innerHTML = lib.length ? lib.map((e) => `
    <button class="pick-card" data-key="${esc(e.key)}">
      <span class="ico">${TYPE_ICON[e.type] || ic('lamp')}</span>
      <b>${esc(e.model)}</b>
      <small>${e.channels.length} kan. · ${esc(t('type.' + e.type))}</small>
    </button>`).join('') : '<p class="hint">…</p>';
  for (const b of $$('.pick-card', box)) b.onclick = () => {
    const e = lib.find((x) => x.key === b.dataset.key);
    dlg.close();
    setTab('scene');
    if (window.PH3D) window.PH3D.startPlacement(e.mount || 'floor', e.key);
  };
  $('#pick-custom').onclick = () => { dlg.close(); openFixtureDialog(null); };
  $('#pick-cancel').onclick = () => dlg.close();
  dlg.showModal();
}

/* ================================================================ lamp wizard: movement, light, direction */
const WIZ = { step: 0, f: null, shutterTry: 0, corner: 'a', fine: false };
const SHUTTER_BASE = [10, 0, 8, 255, 32, 128, 64];
const shutterTries = (f) => [...new Set([f.shutter_open ?? 0, ...SHUTTER_BASE])];
function wizFx() { return fixtures().find((x) => WIZ.f && x.id === WIZ.f.id) || WIZ.f; }
function openWizard(f0) {
  const f = (f0 && f0.id ? f0 : null) || activeFx(); if (!f) { toast('Brak lampy – dodaj ją w zakładce Scena 3D', 'warn'); return; }
  send({ type: 'select', id: f.id });
  WIZ.f = f; WIZ.step = 0; WIZ.shutterTry = 0; WIZ.corner = 'a';
  send({ type: 'test_clear' }); send({ type: 'fx_stop_all' });
  send({ type: 'blackout', value: false });
  WIZ.padPt = null;
  const head = (f.type || 'moving_head') === 'moving_head' && f.channels.includes('pan') && f.channels.includes('tilt');
  if (head) wizRender();
  else { WIZ.tests = devTests(f); WIZ.dt = 0; wizDeviceRender(); if (WIZ.tests.length) setTimeout(() => WIZ.tests[0].run(), 300); }
  $('#wiz-dialog').showModal();
  requestAnimationFrame(wizPadDraw);
}
function wizClose() {
  send({ type: 'fx_stop_all' }); $('#wiz-dialog').close();
  if (typeof PH.onWizardClose === 'function') { const fn = PH.onWizardClose; PH.onWizardClose = null; fn(WIZ.step >= 5); }
}
function wizProfile(key) {
  const f = wizFx(), lib = (S.library || []).find((e) => e.key === key); if (!f || !lib) return;
  send({ type: 'update_fixture', id: f.id, channels: lib.channels.join(','), pan_16bit: !!lib.pan_16bit, tilt_16bit: !!lib.tilt_16bit,
         model: lib.model, library_key: lib.key });
  toast(lib.model);
}
function wizTest(kind) {
  const f = wizFx(); if (!f) return;
  send({ type: 'set_many', id: f.id, values: { dimmer: 255, strobe: 0 } });
  send({ type: 'fx_start', id: 'wiz', kind, targets: f.id, duration: 4, params: kind === 'sweep' ? { speed: 0.35, size: 80 } : { speed: 0.4, size: 40 } });
}
function wizNudge(dx, dy) {
  const f = wizFx(); if (!f) return;
  const deg = WIZ.fine ? 1 : 6;
  const pan = clamp(f.values.pan + dx * deg / f.pan_deg * 65535, 0, 65535), tilt = clamp(f.values.tilt + dy * deg / f.tilt_deg * 65535, 0, 65535);
  f.values.pan = pan; f.values.tilt = tilt;
  send({ type: 'set_many', id: f.id, values: { pan, tilt, dimmer: 255, strobe: 0 } });
}
function wizRender() {
  const box = $('#wiz'), f = wizFx(), n = 5, s = WIZ.step;
  const steps = `<div class="wiz-steps">${Array.from({ length: n }, (_, i) => `<i class="${i <= s ? 'done' : ''}"></i>`).join('')}</div>`;
  const foot = (next = true) => `<div class="foot"><button class="btn" id="w-close">Zamknij</button>${next ? '<button class="btn primary" id="w-next">Dalej</button>' : ''}</div>`;
  const profiles = `<p>Sprawdź na wyświetlaczu lampy tryb kanałów i wybierz ten sam:</p>
    <div class="big"><button class="btn" data-prof="mini-spot-9">9 kanałów</button><button class="btn" data-prof="mini-spot-11">11 kanałów</button></div>`;
  let html = '';
  if (s === 0) {
    html = `<h3>${ic('sparkle')} ${tr('Kalibracja lampy')}</h3><p><b>${esc(f.name)}</b> · DMX ${pad3(f.address)}</p>
      <p>Przejdziemy razem przez 4 krótkie testy: ruch w poziomie, ruch w pionie, światło i kierunek.</p>${foot()}`;
  } else if (s === 1 || s === 2) {
    const horiz = s === 1;
    html = `<h3>${horiz ? 'Ruch w poziomie' : 'Ruch w pionie'}</h3>
      <div class="big"><button class="btn primary" id="w-run">▶ Uruchom test</button></div>
      <p class="q">${horiz ? 'Czy lampa obraca się w lewo i w prawo?' : 'Czy lampa pochyla się w górę i w dół?'}</p>
      <div class="big"><button class="btn" id="w-yes">Tak</button><button class="btn" id="w-no">Nie</button></div>
      <div id="w-help" hidden>${profiles}</div>${foot(false)}`;
  } else if (s === 3) {
    html = `<h3>Światło</h3><p class="q">Czy lampa teraz świeci?</p>
      <div class="big"><button class="btn" id="w-yes">Tak</button><button class="btn" id="w-no">Nie</button></div>
      <p id="w-help" class="hint"></p>${foot(false)}`;
  } else if (s === 4) {
    html = `<h3>Kierunek</h3>
      <p>${WIZ.corner === 'a' ? 'Użyj strzałek, żeby skierować światło w lewy górny róg obszaru, który chcesz oświetlać.' : WIZ.corner === 'b' ? 'Teraz skieruj światło w prawy dolny róg tego obszaru.' : esc(t('wz.check'))}</p>
      ${WIZ.corner !== 'check' ? `<div class="arrows">
        <span></span><button class="btn" data-mv="0,-1">↑</button><span></span>
        <button class="btn" data-mv="-1,0">←</button><label class="switch" style="justify-content:center"><input type="checkbox" id="w-fine" ${WIZ.fine ? 'checked' : ''}><span></span></label><button class="btn" data-mv="1,0">→</button>
        <span></span><button class="btn" data-mv="0,1">↓</button><span></span></div>
        <div class="big" style="justify-content:center"><span class="hint">Precyzyjnie</span><button class="btn primary" id="w-corner">Zapisz ten róg</button></div>`
      : `<canvas id="w-pad" class="w-pad" title="${esc(t('wz.pad'))}"></canvas><p class="hint">${esc(t('wz.pad'))}</p>
        <div class="big"><button class="btn primary" id="w-ok">${ic('check')}<span>${esc(t('wz.ok'))}</span></button><button class="btn" id="w-bad">${ic('warn')}<span>${esc(t('wz.bad'))}</span></button></div>
        <div class="wfix" id="w-fix" hidden><b>${esc(t('wz.fixT'))}</b>
          <button class="btn" data-fix="lr">${ic('arrows')}<span>${esc(t('wz.fx.lr'))}</span></button>
          <button class="btn" data-fix="ud">${ic('arrows')}<span>${esc(t('wz.fx.ud'))}</span></button>
          <button class="btn" data-fix="axes">${ic('move')}<span>${esc(t('wz.fx.axes'))}</span></button>
          <button class="btn" data-fix="corners">${ic('crosshair')}<span>${esc(t('wz.fx.corners'))}</span></button>
          <button class="btn" data-fix="still">${ic('warn')}<span>${esc(t('wz.fx.still'))}</span></button></div>`}
      ${foot(false)}`;
  } else {
    html = `<h3>${ic('check', 'ok')} Gotowe</h3><p>Lampa jest skonfigurowana. Możesz sterować nią palcem.</p>
      <div class="foot"><span></span><button class="btn primary" id="w-close">Gotowe</button></div>`;
  }
  box.innerHTML = steps + html;
  const on = (id, fn) => { const el = $('#' + id, box); if (el) el.onclick = fn; };
  on('w-close', wizClose);
  on('w-next', () => { WIZ.step++; wizRender(); if (WIZ.step === 3) wizLight(); });
  on('w-run', () => wizTest(s === 1 ? 'sweep' : 'tilt_wave'));
  on('w-yes', () => { send({ type: 'fx_stop', id: 'wiz' }); WIZ.step++; wizRender(); if (WIZ.step === 3) wizLight(); });
  on('w-no', () => {
    if (s === 3) { WIZ.shutterTry++; wizLight(); return; }
    $('#w-help', box).hidden = false;
  });
  for (const b of $$('[data-prof]', box)) b.onclick = () => { wizProfile(b.dataset.prof); setTimeout(() => wizTest(s === 1 ? 'sweep' : 'tilt_wave'), 600); };
  for (const b of $$('[data-mv]', box)) b.onclick = () => { const [x, y] = b.dataset.mv.split(',').map(Number); wizNudge(x, y); };
  const fine = $('#w-fine', box); if (fine) fine.onchange = () => { WIZ.fine = fine.checked; };
  on('w-corner', () => {
    send({ type: 'aim_cal', id: f.id, corner: WIZ.corner });
    WIZ.corner = WIZ.corner === 'a' ? 'b' : 'check'; wizRender();
  });
  on('w-ok', () => { WIZ.step = 5; wizRender(); });
  on('w-bad', () => { const fx = $('#w-fix', box); fx.hidden = !fx.hidden; });
  for (const b of $$('[data-fix]', box)) b.onclick = () => wizFix(b.dataset.fix);
  const pad = $('#w-pad', box);
  if (pad) {
    const aim = (e) => {
      const r = pad.getBoundingClientRect(), u = clamp((e.clientX - r.left) / r.width, 0, 1), v = clamp((e.clientY - r.top) / r.height, 0, 1);
      const bx = (S.st && S.st.aim_box) || [0.15, 0.15, 0.85, 0.85];
      WIZ.padPt = [u, v];
      sendT('wizpad', { type: 'position', id: f.id, x: bx[0] + u * (bx[2] - bx[0]), y: bx[1] + v * (bx[3] - bx[1]) });
      wizPadDraw();
    };
    pad.onpointerdown = (e) => { try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } WIZ.padDrag = true; aim(e); };
    pad.onpointermove = (e) => { if (WIZ.padDrag) aim(e); };
    pad.onpointerup = () => { WIZ.padDrag = false; };
    requestAnimationFrame(() => requestAnimationFrame(wizPadDraw));
  }
  on('w-swapx', () => { const g = wizFx(); if (g.aim_pan) send({ type: 'update_fixture', id: g.id, aim_pan: [g.aim_pan[1], g.aim_pan[0]] }); toast('Odwróć lewo / prawo'); });
  on('w-swapy', () => { const g = wizFx(); if (g.aim_tilt) send({ type: 'update_fixture', id: g.id, aim_tilt: [g.aim_tilt[1], g.aim_tilt[0]] }); toast('Odwróć górę / dół'); });
}
function wizPadDraw() {
  const cv = $('#w-pad'); if (!cv) return;
  const [W, H, d] = fitCanvas(cv), ctx = cv.getContext('2d');
  ctx.fillStyle = '#f7f7fa'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e6e6ee'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo((W / 6) * i, 0); ctx.lineTo((W / 6) * i, H); ctx.stroke(); }
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke(); }
  ctx.fillStyle = '#858996'; ctx.font = `600 ${12 * d}px Figtree, sans-serif`;
  ctx.fillText('↖', 6 * d, 16 * d); ctx.textAlign = 'right'; ctx.fillText('↘', W - 6 * d, H - 8 * d); ctx.textAlign = 'left';
  if (WIZ.padPt) {
    const [u, v] = WIZ.padPt, x = u * W, y = v * H;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 26 * d);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(123,63,242,.85)'); g.addColorStop(1, 'rgba(123,63,242,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26 * d, 0, 7); ctx.fill();
  }
}
function wizFix(kind) {
  const g = wizFx(); if (!g) return;
  if (kind === 'lr' && g.aim_pan) send({ type: 'update_fixture', id: g.id, aim_pan: [g.aim_pan[1], g.aim_pan[0]] });
  else if (kind === 'ud' && g.aim_tilt) send({ type: 'update_fixture', id: g.id, aim_tilt: [g.aim_tilt[1], g.aim_tilt[0]] });
  else if (kind === 'axes') {                    // pan and tilt channels swapped in the profile
    const map = { pan: 'tilt', tilt: 'pan', pan_fine: 'tilt_fine', tilt_fine: 'pan_fine' };
    send({ type: 'update_fixture', id: g.id, channels: g.channels.map((c) => map[c] || c).join(','),
           pan_16bit: g.tilt_16bit, tilt_16bit: g.pan_16bit, aim_pan: null, aim_tilt: null });
    WIZ.corner = 'a'; wizRender(); toast(t('wz.fixed')); return;
  } else if (kind === 'corners') { send({ type: 'aim_cal', id: g.id, reset: true }); WIZ.corner = 'a'; wizRender(); return; }
  else if (kind === 'still') { WIZ.step = 1; wizRender(); return; }
  toast(t('wz.fixed'));
}

/* ---- device test for everything that is not a moving head (PAR, bar, strobe, smoke, laser, derby) */
function devTests(f) {
  const ch = f.channels, has = (...k) => k.some((c) => ch.includes(c)), T = [];
  const smoke = f.type === 'smoke';
  if (smoke) T.push({ k: 'smoke', run: () => send({ type: 'fx_start', id: 'wiz', kind: 'hit', params: { strength: 1, curve: 0.01 }, targets: f.id, duration: 3 }) });
  else if (has('dimmer', 'red', 'white', 'aux1')) T.push({ k: 'light', run: () => { send({ type: 'set_many', id: f.id, values: { dimmer: 255, strobe: 0, red: 255, green: 255, blue: 255 } }); } });
  if (!smoke && has('red') && has('green')) T.push({ k: 'color', run: () => send({ type: 'fx_start', id: 'wiz', kind: 'sequence', params: { colors: [[255, 0, 0], [0, 255, 0], [0, 0, 255]], speed: 1 }, targets: f.id, duration: 4 }) });
  if (!smoke && has('shutter', 'strobe')) T.push({ k: 'strobe', run: () => send({ type: 'fx_start', id: 'wiz', kind: 'strobe', params: { speed: 200 }, targets: f.id, duration: 3 }) });
  if (has('pan', 'spin') && !(f.type === 'moving_head' && has('tilt'))) T.push({ k: 'motor', run: () => send({ type: 'set_many', id: f.id, values: { spin: 200, pan_coarse: 200 } }) });
  if (has('laser', 'laser_r', 'laser_g')) T.push({ k: 'laser', run: () => {} });
  return T;
}
function wizDeviceRender() {
  const box = $('#wiz'), f = wizFx(), tests = WIZ.tests, i = WIZ.dt;
  const steps = `<div class="wiz-steps">${tests.map((_, j) => `<i class="${j <= i ? 'done' : ''}"></i>`).join('')}</div>`;
  let html;
  if (i >= tests.length) {
    html = `<h3>${ic('check', 'ok')} ${esc(t('dt.done'))}</h3><p><b>${esc(f.name)}</b> · DMX ${pad3(f.address)}</p>
      <div class="foot"><span></span><button class="btn primary" id="w-close">OK</button></div>`;
  } else {
    const k = tests[i].k;
    html = `<h3>${esc(t('dt.title'))} · ${esc(t(`dt.${k}`))}</h3><p><b>${esc(f.name)}</b> · DMX ${pad3(f.address)}</p>
      ${i === 0 ? `<p class="hint">${esc(t('dt.intro'))}</p>` : ''}
      ${k === 'laser' ? `<p class="q">${esc(t('dt.laser.q'))}</p>` : `<div class="big"><button class="btn primary" id="w-run">${ic('play')}<span>${esc(t('dt.run'))}</span></button></div>
      <p class="q">${esc(t(`dt.${k}.q`))}</p>
      <div class="big"><button class="btn" id="w-yes">${esc(t('dt.yes'))}</button><button class="btn" id="w-no">${esc(t('dt.no'))}</button></div>`}
      <div id="w-help" class="wfix" hidden><p>${esc(t(`dt.${k}.h`))}</p><div class="big"><button class="btn" id="w-skip">${esc(t('dt.skip'))}</button><button class="btn" id="w-ch">${esc(t('dt.chtest'))}</button></div></div>
      <div class="foot"><button class="btn" id="w-close">Zamknij</button>${k === 'laser' ? '<button class="btn primary" id="w-skip">Dalej</button>' : ''}</div>`;
  }
  box.innerHTML = steps + html;
  const on = (id, fn) => { const el = $('#' + id, box); if (el) el.onclick = fn; };
  on('w-close', wizClose);
  on('w-run', () => tests[i].run());
  const next = () => { send({ type: 'fx_stop', id: 'wiz' }); WIZ.dt++; wizDeviceRender(); if (WIZ.dt < tests.length) setTimeout(() => tests[WIZ.dt].run(), 300); };
  on('w-yes', next);
  on('w-skip', next);
  on('w-no', () => {
    $('#w-help', box).hidden = false;
    if (tests[i].k === 'light' && f.channels.includes('shutter')) { WIZ.shutterTry++; wizLight(); }
  });
  on('w-ch', () => { wizClose(); setTab('setup'); if (PH.setupGo) PH.setupGo('adv'); const tt = $('#test-start'); if (tt) { tt.value = f.address; $('#test-count').value = Math.min(32, f.footprint); buildTestGrid(); } });
}
function wizLight() {
  const f = wizFx(), help = $('#w-help');
  const tries = shutterTries(f);
  if (WIZ.shutterTry >= tries.length) {
    if (help) help.textContent = tr('Nie udało się znaleźć ustawienia, przy którym lampa świeci. Sprawdź w Teście kanałów, który kanał zapala światło.');
    return;
  }
  const v = tries[WIZ.shutterTry];
  send({ type: 'update_fixture', id: f.id, shutter_open: v });
  send({ type: 'set_many', id: f.id, values: { dimmer: 255, strobe: 0, cwheel: 0, gobo: 0 } });
  if (help && WIZ.shutterTry > 0) help.textContent = `${tr('Sprawdzam kolejne ustawienie migawki…')} (shutter = ${v})`;
}

/* ================================================================ fixture dialog */
const DLG = { f: null, mount: 'hang' };
function planDraw() {
  const cv = $('#place-plan'), E = $('#fx-form').elements; if (!S.st) return;
  const [W, H, d] = fitCanvas(cv), ctx = cv.getContext('2d'), sg = S.st.stage;
  const sc = Math.min((W - 20 * d) / (sg.width + 2), (H - 24 * d) / (sg.depth + 2));
  const tx = (X) => W / 2 + X * sc, tz = (Z) => H / 2 + Z * sc;
  ctx.fillStyle = '#f7f7fa'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e6e6ee'; ctx.lineWidth = 1; ctx.beginPath();
  for (let X = Math.ceil(-sg.width / 2); X <= sg.width / 2; X++) { ctx.moveTo(tx(X), tz(-sg.depth / 2)); ctx.lineTo(tx(X), tz(sg.depth / 2)); }
  for (let Z = Math.ceil(-sg.depth / 2); Z <= sg.depth / 2; Z++) { ctx.moveTo(tx(-sg.width / 2), tz(Z)); ctx.lineTo(tx(sg.width / 2), tz(Z)); }
  ctx.stroke();
  ctx.strokeStyle = '#c9cad6'; ctx.strokeRect(tx(-sg.width / 2), tz(-sg.depth / 2), sg.width * sc, sg.depth * sc);
  ctx.font = `600 ${11 * d}px Figtree, sans-serif`; ctx.fillStyle = '#858996'; ctx.textAlign = 'center';
  ctx.fillText(tr('Tył'), W / 2, tz(-sg.depth / 2) - 4 * d); ctx.fillText(tr('Publiczność / kamera'), W / 2, tz(sg.depth / 2) + 11 * d);
  const mark = (X, Z, yaw, col, big) => {
    const r = (big ? 5 : 3.5) * d, a = yaw * Math.PI / 180;
    ctx.fillStyle = col; ctx.fillRect(tx(X) - r, tz(Z) - r, 2 * r, 2 * r);
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(tx(X), tz(Z)); ctx.lineTo(tx(X) + Math.sin(a) * 12 * d, tz(Z) + Math.cos(a) * 12 * d); ctx.stroke();
  };
  for (const o of fixtures()) if (!DLG.f || o.id !== DLG.f.id) mark(o.pos[0], o.pos[2], o.yaw, '#b9bac8', false);
  mark(Number(E.px.value), Number(E.pz.value), Number(E.yaw.value), '#7b3ff2', true);
}
function openFixtureDialog(f) {
  const dlg = $('#fx-dialog'), E = $('#fx-form').elements, sg = S.st.stage;
  DLG.f = f;
  setText($('#fx-title'), f ? `Lampa · ${f.name}` : 'Nowa lampa');
  const next = fixtures().reduce((m, o) => Math.max(m, o.address + o.footprint), 1), n = fixtures().length;
  E.name.value = f ? f.name : `MH-${n + 1}`;
  E.address.value = f ? f.address : Math.min(512, next);
  E.pan_16bit.checked = f ? f.pan_16bit : true;
  E.tilt_16bit.checked = f ? f.tilt_16bit : true;
  E.has_rgb.checked = f ? f.has_rgb : true;
  E.channels.value = f && f.custom_channels ? f.channels.join(',') : '';
  E.shutter_open.value = f ? f.shutter_open : 0;
  E.strobe_min.value = f ? f.strobe_min : 1;
  E.strobe_max.value = f ? f.strobe_max : 255;
  E.pan_deg.value = f ? f.pan_deg : 540;
  E.tilt_deg.value = f ? f.tilt_deg : 270;
  E.invert_pan.checked = f ? f.invert_pan : false;
  E.invert_tilt.checked = f ? f.invert_tilt : false;
  E.beam_deg.value = f ? f.beam_deg : 14;
  E.px.value = f ? f.pos[0] : 0;
  E.py.value = f ? f.pos[1] : sg.truss_height;
  E.pz.value = f ? f.pos[2] : -2.5;
  E.yaw.value = f ? f.yaw : 0;
  DLG.mount = f ? f.mount : 'hang';
  const syncMount = () => $$('#mount-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === DLG.mount));
  syncMount();
  $('#autocal-box').style.display = f ? '' : 'none';
  for (const b of $$('#mount-tabs button')) b.onclick = () => { DLG.mount = b.dataset.m; syncMount(); E.py.value = DLG.mount === 'hang' ? sg.truss_height : 0.4; planDraw(); };
  for (const k of ['px', 'pz', 'yaw']) E[k].oninput = planDraw;
  const plan = $('#place-plan');
  plan.onpointerdown = (e) => {
    const r = plan.getBoundingClientRect(), dd = dpr(), W = r.width * dd, H = r.height * dd;
    const sc = Math.min((W - 20 * dd) / (sg.width + 2), (H - 24 * dd) / (sg.depth + 2));
    E.px.value = Math.round(((e.clientX - r.left) * dd - W / 2) / sc * 10) / 10;
    E.pz.value = Math.round(((e.clientY - r.top) * dd - H / 2) / sc * 10) / 10;
    planDraw();
  };
  $('#autocal-btn').onclick = () => { if (f) { send({ type: 'autocal', id: f.id }); dlg.close('cancel'); setTab('hand'); } };
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const msg = {
      type: f ? 'update_fixture' : 'add_fixture', name: E.name.value.trim(), address: Number(E.address.value),
      pan_16bit: E.pan_16bit.checked, tilt_16bit: E.tilt_16bit.checked, has_rgb: E.has_rgb.checked,
      channels: E.channels.value.trim(),
      shutter_open: Number(E.shutter_open.value), strobe_min: Number(E.strobe_min.value), strobe_max: Number(E.strobe_max.value),
      pan_deg: Number(E.pan_deg.value), tilt_deg: Number(E.tilt_deg.value),
      invert_pan: E.invert_pan.checked, invert_tilt: E.invert_tilt.checked, beam_deg: Number(E.beam_deg.value),
      pos: [Number(E.px.value), Number(E.py.value), Number(E.pz.value)], mount: DLG.mount, yaw: Number(E.yaw.value),
    };
    if (f) msg.id = f.id;
    send(msg);
  };
  dlg.showModal();
  requestAnimationFrame(planDraw);
}

/* ================================================================ controls */
function initControls() {
  for (const b of $$('#tabs button')) b.onclick = () => setTab(b.dataset.tab);
  for (const p of $$('.chain .node')) p.onclick = () => {
    setTab('setup');
    if (PH.setupGo) PH.setupGo({ video: 'camera', vision: 'hand', dmx: 'dmx', fixture: 'lamps' }[p.dataset.node] || 'dmx');
  };
  $('#q-spot').onclick = () => send({ type: 'spotlight', value: !(S.st && S.st.spotlight && S.st.spotlight.on) });
  $('#lk-save').onclick = () => send({ type: 'look_save', name: `${t('lk.one')} ${((S.st && S.st.looks) || []).length + 1}`, fade: 1 });
  const sk = $('#smoke-key');
  let skDown = 0;
  sk.onpointerdown = (e) => { skDown = performance.now(); try { sk.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } send({ type: 'smoke', hold: true }); };
  sk.onpointerup = () => { send({ type: 'smoke', hold: false }); if (performance.now() - skDown < 280) send({ type: 'smoke', burst: 3 }); };
  sk.onpointercancel = () => send({ type: 'smoke', hold: false });
  $('#tour-btn').title = t('guide');
  $('#q-auto').onclick = () => send({ type: 'autopilot', on: !(S.st && S.st.effects.autopilot && S.st.effects.autopilot.on) });
  $('#sel-all').onclick = () => {
    const all = fixtures().map((f) => f.id), cur = (S.st && S.st.selection) || [];
    send({ type: 'selection', ids: cur.length === all.length ? [] : all });
  };
  for (const b of $$('#mode-tabs button')) b.onclick = () => send({ type: 'mode', mode: b.dataset.mode });
  $('#trk-auto').onclick = () => send({ type: 'track_auto' });
  $('#trk-clear').onclick = () => send({ type: 'track_clear' });
  $('#show-cam').onchange = (e) => { S.showCam = e.target.checked; };
  $('#floor-cal').onclick = () => (S.floorCal ? (S.floorCal = null) : startFloorCal());
  for (const id of ['#add-device', '#add-device-2']) $(id).onclick = openPicker;
  for (const b of $$('#lang button')) b.onclick = () => setLang(b.dataset.lang);
  $('#lasers').onclick = () => send({ type: 'lasers', value: !(S.st && S.st.lasers_enabled) });
  $('#handui').onclick = () => huiSet(!HUI.on);
  $('#handui-cal').onclick = huiCalibrate;
  $('#bo-banner').onclick = () => send({ type: 'blackout', value: false });
  $('#insp-wiz').onclick = () => openWizard();
  $('#test-wiz').onclick = () => openWizard();
  $('#test-start').oninput = buildTestGrid;
  $('#test-count').oninput = buildTestGrid;
  $('#test-clear').onclick = () => send({ type: 'test_clear' });
  $('#test-fill').onclick = () => {
    const f = activeFx(); if (!f) return;
    $('#test-start').value = f.address; $('#test-count').value = Math.min(32, f.footprint); buildTestGrid();
  };
  $('#blackout').onclick = () => send({ type: 'blackout', value: !(S.st && S.st.blackout) });
  $('#gm').oninput = (e) => sendT('gm', { type: 'grand_master', value: Number(e.target.value) });
  $('#home-active').onclick = () => { const f = activeFx(); if (f) send({ type: 'home', id: f.id }); };
  $('#home-all').onclick = () => send({ type: 'home', id: 'all' });
  $('#zero').onclick = () => send({ type: 'zero' });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.floorCal) { S.floorCal = null; return; }
      if (window.PH3D && window.PH3D.placing) { window.PH3D.cancelPlacement(); return; }
    }
    if ((e.target.closest && e.target.closest('input, select, textarea, dialog')) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b') send({ type: 'blackout', value: !(S.st && S.st.blackout) });
    else if (k === 'h') send({ type: 'home', id: 'all' });
    else if (k === 'g') send({ type: 'mode', mode: 'gesture' });
    else if (k === 't') send({ type: 'mode', mode: 'track' });
    else if (k === 'm') send({ type: 'mode', mode: 'manual' });
    else if (/^[1-9]$/.test(k)) { const f = fixtures()[Number(k) - 1]; if (f) send({ type: 'select', id: f.id }); }
  });
}

/* ================================================================ main loop */
let huiLast = 0;
function frame(now) {
  const t = now / 1000;
  huiUpdate(Math.min(0.1, t - huiLast)); huiLast = t;
  if (S.tab === 'hand') drawHandView(t); else lastT = t;
  if (S.tab === 'mixer') { drawXY(); drawWheel(); }
  animateLamps(t);
  requestAnimationFrame(frame);
}

/* ================================================================ hand cursor: drive the UI with the hand
 * index fingertip = cursor, thumb+index pinch = press / drag / click,
 * two pinching hands = zoom (wheel), quick horizontal flick = switch tab.
 * Synthetic pointer events are dispatched, so faders, buttons and the 3-D view
 * behave exactly as with a mouse.  Light gestures are paused while this is on.
 */
const HUI = {
  on: false, el: null, ring: null,
  x: 0, y: 0, tx: 0, ty: 0, has: false,
  pinch: false, downEl: null, downAt: 0, downPos: [0, 0], moved: 0,
  hist: [], lastSwipe: 0, zoomBase: null, pid: 9001,
  zone: JSON.parse(localStorage.getItem('ph_hui_zone') || 'null') || { x: [0.18, 0.82], y: [0.18, 0.82] },
  dwellPos: [0, 0], dwellT0: 0, dwellArmed: true, DWELL_MS: 900,
  cal: null,
};
const CLICKABLE = 'button, a, [role=tab], .pick-card, .fx-chip, label.switch, select, input[type=checkbox], .gitem';
function huiCalibrate() {
  if (!HUI.on) huiSet(true);
  HUI.cal = { t0: performance.now(), xs: [], ys: [] };
  $('#hui-cal').hidden = false;
  setText($('#hui-cal-msg'), t('handui.calMsg'));
}
function huiCalStep(h) {
  const c = HUI.cal, left = 5 - (performance.now() - c.t0) / 1000;
  setText($('#hui-cal-t'), left > 0 ? left.toFixed(1) : '');
  if (h) { c.xs.push(h.index_tip[0]); c.ys.push(h.index_tip[1]); }
  if (left > 0) return;
  $('#hui-cal').hidden = true; HUI.cal = null;
  if (c.xs.length < 20) { toast(t('handui.calFail'), 'warn'); return; }
  const span = (a) => { const s = a.slice().sort((p, q) => p - q), lo = s[Math.floor(s.length * 0.03)], hi = s[Math.floor(s.length * 0.97)];
    const pad = (hi - lo) * 0.04; return [Math.max(0, lo + pad), Math.min(1, hi - pad)]; };
  const x = span(c.xs), y = span(c.ys);
  if (x[1] - x[0] < 0.12 || y[1] - y[0] < 0.1) { toast(t('handui.calFail'), 'warn'); return; }
  HUI.zone = { x, y };
  localStorage.setItem('ph_hui_zone', JSON.stringify(HUI.zone));
  toast(t('handui.calDone'));
}
function huiSet(on) {
  HUI.on = on;
  localStorage.setItem('ph_handui', on ? '1' : '0');
  $('#handui').classList.toggle('on', on);
  setText($('#handui span'), t(on ? 'handui.on' : 'handui.off'));
  $('#hand-cursor').hidden = !on;
  send({ type: 'gestures', value: !on });          // light gestures off while steering the UI
  if (!on) huiRelease();
}
function huiPoint(e, type, extra = {}) {
  if (!e) return;
  e.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: HUI.pid, pointerType: 'mouse',
    isPrimary: true, clientX: HUI.x, clientY: HUI.y, buttons: type === 'pointerup' ? 0 : 1, button: 0, ...extra,
  }));
}
function huiRelease() {
  if (HUI.downEl) { huiPoint(HUI.downEl, 'pointerup'); huiPoint(window, 'pointerup'); }
  HUI.downEl = null; HUI.pinch = false;
  $('#hand-cursor').classList.remove('pinch');
}
function huiUpdate(dt) {
  if (!HUI.on || !S.st) return;
  const hands = (S.st.vision.perception.hands || []);
  if (HUI.cal) { huiCalStep(hands[0]); return; }
  if (!hands.length) { if (HUI.pinch) huiRelease(); HUI.has = false; return; }
  const h = hands.find((q) => q.pinch < 0.34) || hands[0];
  const zx = HUI.zone.x, zy = HUI.zone.y;
  HUI.tx = clamp((h.index_tip[0] - zx[0]) / (zx[1] - zx[0]), 0, 1) * window.innerWidth;
  HUI.ty = clamp((h.index_tip[1] - zy[0]) / (zy[1] - zy[0]), 0, 1) * window.innerHeight;
  const k = HUI.has ? 1 - Math.exp(-dt / 0.03) : 1;     // 30 ms time constant
  HUI.x = lerp(HUI.x, HUI.tx, k); HUI.y = lerp(HUI.y, HUI.ty, k);
  HUI.has = true;
  $('#hand-cursor').style.transform = `translate(${HUI.x}px, ${HUI.y}px)`;

  // ---- two pinching hands = zoom the 3-D view
  const pinching = hands.filter((q) => q.pinch < 0.34);
  if (pinching.length === 2) {
    const d = Math.hypot(pinching[0].palm_center[0] - pinching[1].palm_center[0],
                         pinching[0].palm_center[1] - pinching[1].palm_center[1]);
    if (HUI.zoomBase === null) HUI.zoomBase = d;
    const el = document.elementFromPoint(HUI.x, HUI.y);
    if (el) el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: (HUI.zoomBase - d) * 900, clientX: HUI.x, clientY: HUI.y }));
    HUI.zoomBase = d;
    if (HUI.downEl) huiRelease();
    return;
  }
  HUI.zoomBase = null;

  // ---- one hand: pinch = press / drag / click
  const pinch = h.pinch < 0.32 || (HUI.pinch && h.pinch < 0.42);   // hysteresis
  if (pinch && !HUI.pinch) {
    HUI.pinch = true; HUI.moved = 0; HUI.downAt = performance.now(); HUI.downPos = [HUI.x, HUI.y];
    HUI.downEl = document.elementFromPoint(HUI.x, HUI.y);
    $('#hand-cursor').classList.add('pinch');
    huiPoint(HUI.downEl, 'pointerdown');
  } else if (pinch && HUI.pinch) {
    HUI.moved = Math.max(HUI.moved, Math.hypot(HUI.x - HUI.downPos[0], HUI.y - HUI.downPos[1]));
    huiPoint(HUI.downEl, 'pointermove');
    huiPoint(window, 'pointermove');
  } else if (!pinch && HUI.pinch) {
    const el = HUI.downEl, quick = HUI.moved < 14;   // released without dragging = click
    huiRelease();
    if (quick && el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: HUI.x, clientY: HUI.y }));
  }

  // ---- dwell click: keep the fingertip still over a button ~0.9 s
  const cur = $('#hand-cursor'), ring = $('#hand-cursor s');
  if (!HUI.pinch) {
    const now = performance.now();
    if (Math.hypot(HUI.x - HUI.dwellPos[0], HUI.y - HUI.dwellPos[1]) > 22) {
      HUI.dwellPos = [HUI.x, HUI.y]; HUI.dwellT0 = now; HUI.dwellArmed = true;
    }
    const target = document.elementFromPoint(HUI.x, HUI.y);
    const clickable = target && target.closest(CLICKABLE);
    const p = clickable && HUI.dwellArmed ? clamp((now - HUI.dwellT0) / HUI.DWELL_MS, 0, 1) : 0;
    ring.style.setProperty('--p', Math.round(p * 100));
    if (p >= 1) {
      HUI.dwellArmed = false;                      // move away before the next click
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: HUI.x, clientY: HUI.y }));
      if (clickable.matches('label.switch')) { const inp = $('input', clickable); if (inp) { inp.checked = !inp.checked; inp.dispatchEvent(new Event('change', { bubbles: true })); } }
      cur.classList.add('clicked'); setTimeout(() => cur.classList.remove('clicked'), 220);
      ring.style.setProperty('--p', 0);
    }
  } else ring.style.setProperty('--p', 0);

  // ---- flick with an OPEN palm = change tab (pointing / pinching never switches tabs)
  if (!HUI.pinch && h.gesture === 'dimmer') {
    const now = performance.now();
    HUI.hist.push([now, HUI.tx, HUI.ty]);
    while (HUI.hist.length && now - HUI.hist[0][0] > 320) HUI.hist.shift();
    if (HUI.hist.length > 3 && now - HUI.lastSwipe > 1200) {
      const dx = HUI.tx - HUI.hist[0][1], dy = Math.abs(HUI.ty - HUI.hist[0][2]);
      if (Math.abs(dx) > window.innerWidth * 0.45 && dy < window.innerHeight * 0.2) {
        const tabs = ['scene', 'hand', 'mixer', 'music', 'setup'];
        const i = clamp(tabs.indexOf(S.tab) + (dx > 0 ? 1 : -1), 0, tabs.length - 1);
        setTab(tabs[i]); HUI.lastSwipe = now; HUI.hist.length = 0;
        toast(`▸ ${t('tab.' + tabs[i])}`);
      }
    }
  } else if (HUI.pinch) HUI.hist.length = 0;
}

window.PH = {
  S, send, activeFx, fixtures, intensity, rgbOf, openFixtureDialog, setTab, t, tr, toast, esc, fitCanvas, setText,
  floorCorners, onState: ON_STATE, get lang() { return LANG; },
  CARD, CARD_BIND, refreshSetup, openPicker, openWizard, startFloorCal, huiCalibrate, frameRect, toggleSel, setPageHead,
  clamp, lerp, hsv2rgb, rgb2hsv, HAND_EDGES, I18N, gestureName: (g) => gName(g),
  addI18n(add) {             // other modules register their texts (pl + it)
    for (const l of Object.keys(add)) Object.assign(I18N[l], add[l]);
    for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  },
};

buildProgrammer();
buildRail();
applyI18n();
initXY();
initWheel();
initHandPointer();
initInspector();
initControls();
connect();
moveInk();
requestAnimationFrame(frame);
