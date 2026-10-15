/* Lumo — find, identify and calibrate any DMX lamp.
 *
 * Settings → Start (six big tiles), Biblioteka urządzeń (search every source: my profiles, Lumo,
 * Open Fixture Library, GDTF, QLC+), Konfiguracja / Kalibracja (unknown lamp, channel by channel),
 * Moje lampy (address manager + profile editor). Nothing is applied without the user's click;
 * probing never sends more than 192 and never touches reset / lamp control / laser channels.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'st.lamps.n': 'Moje lampy', 'st.dmx.n': 'Interfejs DMX',
      'sm2.more': 'Pokaż wszystkie ustawienia', 'sm2.less': 'Tylko najważniejsze', 'sm2.mode': 'Tryb prosty', 'sm2.modeS': 'chowa rzadko używane opcje — nic nie jest usuwane',
      'st.home.n': 'Start', 'st.home.s': 'najważniejsze w jednym miejscu', 'st.home.t': 'Ustawienia', 'st.home.d': 'Wybierz, co chcesz zrobić. Wszystkie pozostałe opcje są w menu po lewej.',
      'st.library.n': 'Biblioteka urządzeń', 'st.library.s': 'znajdź model lampy', 'st.library.t': 'Biblioteka urządzeń', 'st.library.d': 'Wpisz nazwę lampy — Lumo przeszuka moje profile, bibliotekę Lumo, Open Fixture Library, GDTF i QLC+.',
      'st.dmxcal.n': 'Konfiguracja / Kalibracja', 'st.dmxcal.s': 'nieznana lampa krok po kroku', 'st.dmxcal.t': 'Konfiguracja / Kalibracja DMX', 'st.dmxcal.d': 'Lampa bez nazwy albo z AliExpress? Sprawdzimy kanały jeden po drugim i zapiszemy ją jako Twoje urządzenie.',
      'hm.dmx': 'Interfejs DMX', 'hm.lamps': 'Moje lampy', 'hm.lib': 'Biblioteka urządzeń', 'hm.cal': 'Konfiguracja / Kalibracja', 'hm.lang': 'Język', 'hm.diag': 'Diagnostyka',
      'hm.dmxOk': 'Połączony: {s}', 'hm.dmxBad': 'Nie działa — kliknij, żeby naprawić', 'hm.lampsN': '{n} urządzeń', 'hm.lamps0': 'Brak — dodaj pierwszą lampę', 'hm.libN': '{n} profili, działa offline',
      'hm.libBuild': 'Buduję indeks…', 'hm.calS': 'nieznana lampa, kanał po kanale', 'hm.diagS': 'co działa, a co nie', 'hm.wiz': 'Konfigurator jednym kliknięciem', 'hm.conflict': 'Konflikt adresów!',
      'lb.find': 'Znajdź model lampy', 'lb.ph': 'np. Mini Gobo Moving Head, LED Spot 30W, MH-3…', 'lb.man': 'Producent', 'lb.ch': 'Kanały', 'lb.cat': 'Rodzaj', 'lb.any': 'wszystkie',
      'lb.unknown': 'Nie znam modelu', 'lb.link': 'Wklej link do produktu', 'lb.pdf': 'Importuj instrukcję', 'lb.photo': 'Dodaj zdjęcie tabeli DMX', 'lb.gdtf': 'Plik GDTF', 'lb.rdm': 'Wykryj urządzenia (RDM)',
      'lb.mine': 'Moje urządzenia', 'lb.mineS': 'zapisane raz — dodajesz jednym kliknięciem', 'lb.none': 'Nic nie znalazłem. Spróbuj krótszej nazwy albo kliknij „Nie znam modelu”.',
      'lb.status': '{n} profili · {src}', 'lb.ofl.updated': 'Open Fixture Library aktualna', 'lb.ofl.cached': 'Open Fixture Library z pamięci', 'lb.ofl.offline': 'offline — działa z pamięci',
      'lb.ofl.none': 'Open Fixture Library pobierze się w tle', 'lb.ofl.error': 'bez Open Fixture Library (brak internetu)', 'lb.update': 'Odśwież bazę',
      'lb.details': 'Szczegóły', 'lb.modes': 'Pokaż tryby', 'lb.add': 'Dodaj', 'lb.addT': 'Dodaj urządzenie', 'lb.addr': 'Adres DMX', 'lb.name': 'Nazwa', 'lb.alias': 'Zapamiętaj „{q}” jako nazwę tej lampy',
      'lb.lampSet': 'Na lampie ustaw adres {a} i tryb {n}CH.', 'lb.check': 'Nie jestem pewien — sprawdźmy (30 s)', 'lb.cancel': 'Anuluj', 'lb.close': 'Zamknij', 'lb.del': 'Usuń',
      'lb.src.mine': 'Moje', 'lb.src.spotly': 'Lumo', 'lb.src.ofl': 'Open Fixture Library', 'lb.src.gdtf': 'GDTF', 'lb.src.qlc': 'QLC+', 'lb.src.rdm': 'RDM',
      'lb.linkT': 'Link do produktu', 'lb.linkS': 'AliExpress, Amazon albo strona producenta. Lumo odczyta nazwę i poszuka instrukcji.', 'lb.linkGo': 'Szukaj', 'lb.linkFound': 'Na stronie: „{t}”',
      'lb.linkPdf': 'Instrukcje na stronie', 'lb.read': 'Czytaj', 'lb.noData': 'Brak pewnych danych o kanałach — najlepiej sprawdzić lampę krok po kroku.', 'lb.goCal': 'Kalibracja krok po kroku',
      'lb.charts': 'Znalazłem tabelę kanałów', 'lb.chartUse': 'Sprawdź i użyj', 'lb.pdfNone': 'W tym PDF nie ma tekstu z tabelą kanałów (może to skan). Wpisz kanały ręcznie — zdjęcie zostanie obok.',
      'lb.rdmNo.opendmx': 'Twój kabel (Open DMX) tylko wysyła dane — nie umie odebrać odpowiedzi lampy, więc RDM jest niemożliwe. Potrzebny jest interfejs z RDM (np. ENTTEC DMX USB Pro Mk2) i lampa z RDM.',
      'lb.rdmNo.nocable': 'Nie ma podłączonego kabla DMX.', 'lb.rdmNo.backend': 'Ten interfejs w Lumo nie odczytuje jeszcze RDM.', 'lb.rdmFound': 'Znalezione przez RDM', 'lb.useProfile': 'Użyj profilu',
      'lb.gdtfOk': 'Wczytano {m} z pliku GDTF', 'lb.cats.moving_head': 'Głowa ruchoma', 'lb.cats.par': 'PAR / reflektor', 'lb.cats.bar': 'Belka / listwa', 'lb.cats.derby': 'Efekt / derby',
      'lb.cats.strobe': 'Stroboskop', 'lb.cats.laser': 'Laser', 'lb.cats.smoke': 'Dym', 'lb.cats.spider': 'Spider', 'lb.cats.other': 'Inne',
      'pr.t': 'Który to profil?', 'pr.s': 'Mam {n} możliwe profile {c}CH. Podniosę po kolei kilka kanałów — powiedz, co robi lampa.', 'pr.addr': 'Adres lampy', 'pr.start': 'Zaczynamy',
      'pr.ch': 'Testuję kanał {c}…', 'pr.q': 'Co zrobiła lampa?', 'pr.left': 'Pasuje jeszcze: {n}', 'pr.done': 'Pasuje: {m}', 'pr.none': 'Żaden profil nie pasuje — zrób kalibrację krok po kroku.',
      'pr.a.pan': 'Obrót w poziomie', 'pr.a.tilt': 'Ruch góra–dół', 'pr.a.light': 'Zapaliła się / jaśniej', 'pr.a.color': 'Zmienił się kolor', 'pr.a.gobo': 'Wzór / gobo', 'pr.a.strobe': 'Miga',
      'pr.a.auto': 'Sama coś robi (program)', 'pr.a.nothing': 'Nic', 'pr.a.skip': 'Nie wiem', 'pr.apply': 'Zastosuj',
      'cl.left': '← W lewo', 'cl.right': 'W prawo →', 'cl.mid': 'Środek', 'cl.up': '↑ Do góry', 'cl.down': '↓ W dół',
      'cl.dirPan': 'Po kliknięciu „W prawo →” lampa obróciła się w prawo?', 'cl.dirTilt': 'Po kliknięciu „↑ Do góry” lampa podniosła się do góry?',
      'cl.dirYes': 'Tak, zgadza się', 'cl.dirNo': 'Nie — odwróć kierunek', 'cl.dirInv': 'kierunek odwrócony', 'cl.dirOk': 'kierunek zgodny',
      'cl.quick': 'Szybki test', 'cl.max': 'max', 'cl.viewStep': 'Krok po kroku', 'cl.viewAll': 'Wszystkie kanały naraz',
      'cl.allT': 'Wszystkie kanały — testuj i zmieniaj', 'cl.allS': 'Przesuń suwak albo kliknij wartość — lampa reaguje od razu. Funkcję kanału zmienisz z listy.',
      'cl.all0': 'Wszystko na 0', 'cl.allOn': 'Zapal (jasność 100%)', 'cl.done': 'Gotowe → zapisz', 'cl.quickTest': 'Szybki test',
      'ro2.panS': 'lewo ↔ prawo', 'ro2.tiltS': 'góra ↕ dół',
      'cl.t': 'Kalibracja lampy', 'cl.addr': 'Adres', 'cl.mode': 'Tryb', 'cl.s1': 'Adres DMX lampy', 'cl.s1d': 'Taki, jak na wyświetlaczu lampy (np. A001 albo d001).', 'cl.next': 'Dalej', 'cl.back': 'Wstecz',
      'cl.s2': 'Ile kanałów ma lampa?', 'cl.s2d': 'Zwykle widać to w menu lampy (np. 9CH, 11CH). Nie wiesz? Użyj testu.', 'cl.auto': 'Test kanałów', 'cl.manual': 'wpisz',
      'cl.ch': 'Kanał {i} / {n}', 'cl.q': 'Co robi ten kanał?', 'cl.probe': 'Automatycznie sprawdź kanał', 'cl.probing': 'Sprawdzam kanał {i} (bezpiecznie, maks. 192)…',
      'cl.moved': 'Czy lampa się poruszyła albo zmieniła?', 'cl.yes': 'Tak', 'cl.no': 'Nie', 'cl.what': 'Co się stało?', 'cl.whatColor': 'Jaki kolor?',
      'cl.warn': 'Wysokie wartości na nieznanym kanale mogą zresetować lampę albo włączyć laser — przesuwaj powoli.', 'cl.locked': 'Kanał zablokowany (reset / laser) — Lumo nie wysyła na niego nic.',
      'cl.match': '{p}% pasuje: {m}', 'cl.matchMany': 'Pasuje kilka profili — oznacz jeszcze parę kanałów.', 'cl.apply': 'Zastosuj',
      'cl.sum': 'Gotowe — sprawdź tabelę', 'cl.name': 'Nazwa urządzenia', 'cl.save': 'Zapisz jako moje urządzenie', 'cl.saved': 'Zapisano „{m}” — następnym razem wybierzesz ją jednym kliknięciem.',
      'cl.autoT': 'Test kanałów', 'cl.autoQ': 'Czy lampa zareagowała na kanał {i}?', 'cl.autoEnd': 'To już koniec', 'cl.autoRes': 'Lampa reagowała do kanału {n}. Ustawiam {n} kanałów.',
      'cl.fromChart': 'Tabela z instrukcji — sprawdź każdy kanał i potwierdź.', 'cl.have': 'Mam lampę na liście', 'cl.haveS': 'znajdź model w bibliotece', 'cl.dont': 'Nie znam modelu', 'cl.dontS': 'sprawdzimy kanały po kolei',
      'cl.meS': 'stań przed kamerą, kciuk w górę = zapisz', 'cl.aim': 'Kalibracja celowania', 'cl.aimS': 'żeby lampa trafiała tam, gdzie wskazujesz', 'cl.edit': 'Popraw profil urządzenia', 'cl.editS': 'kanały lampy, która już jest na scenie',
      'ro2.pan': 'PAN', 'ro2.tilt': 'TILT', 'ro2.dim': 'JASNOŚĆ', 'ro2.red': 'CZERWONY', 'ro2.green': 'ZIELONY', 'ro2.blue': 'NIEBIESKI', 'ro2.white': 'BIAŁY', 'ro2.strobe': 'STROBE',
      'ro2.gobo': 'GOBO', 'ro2.color': 'KOLOR', 'ro2.speed': 'PRĘDKOŚĆ', 'ro2.laser': 'LASER', 'ro2.auto': 'AUTO', 'ro2.sound': 'SOUND', 'ro2.reset': 'RESET', 'ro2.other': 'INNE',
      'ro2.more': 'Więcej:', 'ro2.panf': 'Pan fine', 'ro2.tiltf': 'Tilt fine', 'ro2.gobor': 'Obrót gobo', 'ro2.prism': 'Pryzmat', 'ro2.zoom': 'Zoom', 'ro2.focus': 'Focus', 'ro2.amber': 'Bursztyn', 'ro2.uv': 'UV', 'ro2.none': 'Nic',
      'ad.addrT': 'Adres startowy — wpisz albo klikaj − / +. Na lampie ustaw ten sam.', 'ad.t': 'Adresy DMX', 'ad.conf': 'KONFLIKT DMX', 'ad.confS': 'Kanały {a}–{b} są już używane przez „{o}”.', 'ad.free': 'Znajdź wolny adres', 'ad.edit': 'Edytuj profil', 'ad.ok': 'Adresy się nie nakładają.',
      'pe.t': 'Profil: {m}', 'pe.ch': 'CH', 'pe.fn': 'Funkcja', 'pe.def': 'Domyślnie', 'pe.rng': 'Zakresy', 'pe.rngPh': '0-15 White\n16-31 Red', 'pe.drag': 'Przeciągnij wiersz, żeby zmienić kolejność.',
      'pe.add': '+ kanał', 'pe.save': 'Zapisz profil', 'pe.learn': 'Zapisz jako moje urządzenie', 'pe.saved': 'Profil zapisany',
      'toast.libAdded': 'Dodano {name} @ DMX {a} ({n} kan.)', 'toast.freeAddr': '{name} → adres {a}', 'toast.noFree': 'Brak wolnego miejsca w uniwersum',
    },
    it: {
      'st.lamps.n': 'Le mie luci', 'st.dmx.n': 'Interfaccia DMX',
      'sm2.more': 'Mostra tutte le impostazioni', 'sm2.less': 'Solo l’essenziale', 'sm2.mode': 'Modalità semplice', 'sm2.modeS': 'nasconde le opzioni usate di rado — nulla viene eliminato',
      'st.home.n': 'Inizio', 'st.home.s': 'l’essenziale in un posto', 'st.home.t': 'Impostazioni', 'st.home.d': 'Scegli cosa vuoi fare. Tutte le altre opzioni sono nel menu a sinistra.',
      'st.library.n': 'Libreria dispositivi', 'st.library.s': 'trova il modello', 'st.library.t': 'Libreria dispositivi', 'st.library.d': 'Scrivi il nome della luce — Lumo cerca nei miei profili, nella libreria Lumo, Open Fixture Library, GDTF e QLC+.',
      'st.dmxcal.n': 'Configurazione / Calibrazione', 'st.dmxcal.s': 'luce sconosciuta passo passo', 'st.dmxcal.t': 'Configurazione / Calibrazione DMX', 'st.dmxcal.d': 'Luce senza nome o da AliExpress? Controlliamo i canali uno per uno e la salviamo come tuo dispositivo.',
      'hm.dmx': 'Interfaccia DMX', 'hm.lamps': 'Le mie luci', 'hm.lib': 'Libreria dispositivi', 'hm.cal': 'Configurazione / Calibrazione', 'hm.lang': 'Lingua', 'hm.diag': 'Diagnostica',
      'hm.dmxOk': 'Collegato: {s}', 'hm.dmxBad': 'Non funziona — clicca per riparare', 'hm.lampsN': '{n} dispositivi', 'hm.lamps0': 'Nessuno — aggiungi la prima luce', 'hm.libN': '{n} profili, funziona offline',
      'hm.libBuild': 'Creo l’indice…', 'hm.calS': 'luce sconosciuta, canale per canale', 'hm.diagS': 'cosa funziona e cosa no', 'hm.wiz': 'Configuratore con un clic', 'hm.conflict': 'Conflitto di indirizzi!',
      'lb.find': 'Trova modello luce', 'lb.ph': 'es. Mini Gobo Moving Head, LED Spot 30W, MH-3…', 'lb.man': 'Produttore', 'lb.ch': 'Canali', 'lb.cat': 'Tipo', 'lb.any': 'tutti',
      'lb.unknown': 'Non conosco il modello', 'lb.link': 'Incolla link del prodotto', 'lb.pdf': 'Importa manuale', 'lb.photo': 'Aggiungi foto tabella DMX', 'lb.gdtf': 'File GDTF', 'lb.rdm': 'Rileva dispositivi (RDM)',
      'lb.mine': 'I miei dispositivi', 'lb.mineS': 'salvati una volta — li aggiungi con un clic', 'lb.none': 'Non ho trovato nulla. Prova un nome più corto o clicca „Non conosco il modello”.',
      'lb.status': '{n} profili · {src}', 'lb.ofl.updated': 'Open Fixture Library aggiornata', 'lb.ofl.cached': 'Open Fixture Library dalla memoria', 'lb.ofl.offline': 'offline — funziona dalla memoria',
      'lb.ofl.none': 'Open Fixture Library si scarica in background', 'lb.ofl.error': 'senza Open Fixture Library (niente internet)', 'lb.update': 'Aggiorna',
      'lb.details': 'Dettagli', 'lb.modes': 'Mostra modalità', 'lb.add': 'Aggiungi', 'lb.addT': 'Aggiungi dispositivo', 'lb.addr': 'Indirizzo DMX', 'lb.name': 'Nome', 'lb.alias': 'Ricorda „{q}” come nome di questa luce',
      'lb.lampSet': 'Sulla luce imposta l’indirizzo {a} e la modalità {n}CH.', 'lb.check': 'Non sono sicuro — controlliamo (30 s)', 'lb.cancel': 'Annulla', 'lb.close': 'Chiudi', 'lb.del': 'Elimina',
      'lb.src.mine': 'Mie', 'lb.src.spotly': 'Lumo', 'lb.src.ofl': 'Open Fixture Library', 'lb.src.gdtf': 'GDTF', 'lb.src.qlc': 'QLC+', 'lb.src.rdm': 'RDM',
      'lb.linkT': 'Link del prodotto', 'lb.linkS': 'AliExpress, Amazon o il sito del produttore. Lumo legge il nome e cerca il manuale.', 'lb.linkGo': 'Cerca', 'lb.linkFound': 'Sulla pagina: „{t}”',
      'lb.linkPdf': 'Manuali sulla pagina', 'lb.read': 'Leggi', 'lb.noData': 'Nessun dato sicuro sui canali — meglio controllare la luce passo passo.', 'lb.goCal': 'Calibrazione passo passo',
      'lb.charts': 'Ho trovato una tabella dei canali', 'lb.chartUse': 'Controlla e usa', 'lb.pdfNone': 'In questo PDF non c’è testo con la tabella (forse è una scansione). Scrivi i canali a mano — la foto resta accanto.',
      'lb.rdmNo.opendmx': 'Il tuo cavo (Open DMX) invia soltanto — non può ricevere la risposta della luce, quindi RDM è impossibile. Serve un’interfaccia con RDM (es. ENTTEC DMX USB Pro Mk2) e una luce con RDM.',
      'lb.rdmNo.nocable': 'Nessun cavo DMX collegato.', 'lb.rdmNo.backend': 'Questa interfaccia in Lumo non legge ancora RDM.', 'lb.rdmFound': 'Trovati con RDM', 'lb.useProfile': 'Usa profilo',
      'lb.gdtfOk': 'Caricato {m} dal file GDTF', 'lb.cats.moving_head': 'Testa mobile', 'lb.cats.par': 'PAR / proiettore', 'lb.cats.bar': 'Barra', 'lb.cats.derby': 'Effetto / derby',
      'lb.cats.strobe': 'Strobo', 'lb.cats.laser': 'Laser', 'lb.cats.smoke': 'Fumo', 'lb.cats.spider': 'Spider', 'lb.cats.other': 'Altro',
      'pr.t': 'Quale profilo è?', 'pr.s': 'Ho {n} profili possibili da {c}CH. Alzo alcuni canali uno per volta — dimmi cosa fa la luce.', 'pr.addr': 'Indirizzo della luce', 'pr.start': 'Iniziamo',
      'pr.ch': 'Provo il canale {c}…', 'pr.q': 'Cosa ha fatto la luce?', 'pr.left': 'Ancora possibili: {n}', 'pr.done': 'Corrisponde: {m}', 'pr.none': 'Nessun profilo corrisponde — fai la calibrazione passo passo.',
      'pr.a.pan': 'Rotazione orizzontale', 'pr.a.tilt': 'Movimento su–giù', 'pr.a.light': 'Si è accesa / più luce', 'pr.a.color': 'Cambia colore', 'pr.a.gobo': 'Disegno / gobo', 'pr.a.strobe': 'Lampeggia',
      'pr.a.auto': 'Fa qualcosa da sola (programma)', 'pr.a.nothing': 'Niente', 'pr.a.skip': 'Non so', 'pr.apply': 'Applica',
      'cl.left': '← A sinistra', 'cl.right': 'A destra →', 'cl.mid': 'Centro', 'cl.up': '↑ Su', 'cl.down': '↓ Giù',
      'cl.dirPan': 'Dopo „A destra →” la luce è girata a destra?', 'cl.dirTilt': 'Dopo „↑ Su” la luce si è alzata?',
      'cl.dirYes': 'Sì, giusto', 'cl.dirNo': 'No — inverti la direzione', 'cl.dirInv': 'direzione invertita', 'cl.dirOk': 'direzione giusta',
      'cl.quick': 'Test rapido', 'cl.max': 'max', 'cl.viewStep': 'Passo passo', 'cl.viewAll': 'Tutti i canali insieme',
      'cl.allT': 'Tutti i canali — prova e cambia', 'cl.allS': 'Muovi il cursore o clicca un valore — la luce reagisce subito. La funzione si cambia dalla lista.',
      'cl.all0': 'Tutto a 0', 'cl.allOn': 'Accendi (luminosità 100%)', 'cl.done': 'Fatto → salva', 'cl.quickTest': 'Test rapido',
      'ro2.panS': 'sinistra ↔ destra', 'ro2.tiltS': 'su ↕ giù',
      'cl.t': 'Calibrazione luce', 'cl.addr': 'Indirizzo', 'cl.mode': 'Modalità', 'cl.s1': 'Indirizzo DMX della luce', 'cl.s1d': 'Come sul display della luce (es. A001 o d001).', 'cl.next': 'Avanti', 'cl.back': 'Indietro',
      'cl.s2': 'Quanti canali ha la luce?', 'cl.s2d': 'Di solito si vede nel menu della luce (es. 9CH, 11CH). Non lo sai? Usa il test.', 'cl.auto': 'Test canali', 'cl.manual': 'scrivi',
      'cl.ch': 'Canale {i} / {n}', 'cl.q': 'Cosa controlla questo canale?', 'cl.probe': 'Controlla il canale da solo', 'cl.probing': 'Controllo il canale {i} (in sicurezza, max 192)…',
      'cl.moved': 'La luce si è mossa o è cambiata?', 'cl.yes': 'Sì', 'cl.no': 'No', 'cl.what': 'Cosa è successo?', 'cl.whatColor': 'Quale colore?',
      'cl.warn': 'Valori alti su un canale sconosciuto possono resettare la luce o accendere il laser — muovi piano.', 'cl.locked': 'Canale bloccato (reset / laser) — Lumo non invia nulla.',
      'cl.match': '{p}% corrisponde: {m}', 'cl.matchMany': 'Corrispondono più profili — segna ancora qualche canale.', 'cl.apply': 'Applica',
      'cl.sum': 'Fatto — controlla la tabella', 'cl.name': 'Nome del dispositivo', 'cl.save': 'Salva come mio dispositivo', 'cl.saved': 'Salvato „{m}” — la prossima volta la scegli con un clic.',
      'cl.autoT': 'Test canali', 'cl.autoQ': 'La luce ha reagito al canale {i}?', 'cl.autoEnd': 'È finita', 'cl.autoRes': 'La luce reagiva fino al canale {n}. Imposto {n} canali.',
      'cl.fromChart': 'Tabella dal manuale — controlla ogni canale e conferma.', 'cl.have': 'La mia luce è in lista', 'cl.haveS': 'trova il modello nella libreria', 'cl.dont': 'Non conosco il modello', 'cl.dontS': 'controlliamo i canali uno per uno',
      'cl.meS': 'mettiti davanti alla camera, pollice su = salva', 'cl.aim': 'Calibrazione della mira', 'cl.aimS': 'perché la luce colpisca dove indichi', 'cl.edit': 'Correggi il profilo', 'cl.editS': 'canali di una luce già sul palco',
      'ro2.pan': 'PAN', 'ro2.tilt': 'TILT', 'ro2.dim': 'LUMINOSITÀ', 'ro2.red': 'ROSSO', 'ro2.green': 'VERDE', 'ro2.blue': 'BLU', 'ro2.white': 'BIANCO', 'ro2.strobe': 'STROBO',
      'ro2.gobo': 'GOBO', 'ro2.color': 'COLORE', 'ro2.speed': 'VELOCITÀ', 'ro2.laser': 'LASER', 'ro2.auto': 'AUTO', 'ro2.sound': 'SOUND', 'ro2.reset': 'RESET', 'ro2.other': 'ALTRO',
      'ro2.more': 'Altro:', 'ro2.panf': 'Pan fine', 'ro2.tiltf': 'Tilt fine', 'ro2.gobor': 'Rotazione gobo', 'ro2.prism': 'Prisma', 'ro2.zoom': 'Zoom', 'ro2.focus': 'Focus', 'ro2.amber': 'Ambra', 'ro2.uv': 'UV', 'ro2.none': 'Niente',
      'ad.addrT': 'Indirizzo iniziale — scrivilo o clicca − / +. Sulla luce imposta lo stesso.', 'ad.t': 'Indirizzi DMX', 'ad.conf': 'CONFLITTO DMX', 'ad.confS': 'I canali {a}–{b} sono già usati da „{o}”.', 'ad.free': 'Trova indirizzo libero', 'ad.edit': 'Modifica profilo', 'ad.ok': 'Gli indirizzi non si sovrappongono.',
      'pe.t': 'Profilo: {m}', 'pe.ch': 'CH', 'pe.fn': 'Funzione', 'pe.def': 'Default', 'pe.rng': 'Intervalli', 'pe.rngPh': '0-15 White\n16-31 Red', 'pe.drag': 'Trascina una riga per cambiare l’ordine.',
      'pe.add': '+ canale', 'pe.save': 'Salva profilo', 'pe.learn': 'Salva come mio dispositivo', 'pe.saved': 'Profilo salvato',
      'toast.libAdded': 'Aggiunto {name} @ DMX {a} ({n} can.)', 'toast.freeAddr': '{name} → indirizzo {a}', 'toast.noFree': 'Nessuno spazio libero nell’universo',
    },
  });

  /* ------------------------------------------------------------ server replies */
  const L = { res: [], q: '', st: null, waiters: {}, lastQ: null };
  PH.onLib = (m) => {
    if (m.op === 'state' || m.op === 'search') L.st = m;
    const w = L.waiters[m.op]; if (w) { delete L.waiters[m.op]; w(m); }
  };
  const ask = (msg, op, ms = 25000) => new Promise((res) => {
    L.waiters[op] = res; send(msg);
    setTimeout(() => { if (L.waiters[op] === res) { delete L.waiters[op]; res(null); } }, ms);
  });
  const pad3 = (n) => String(n).padStart(3, '0');
  const CAT_IC = { moving_head: 'lamp', par: 'par', bar: 'bar', derby: 'derby', strobe: 'strobe', laser: 'laser', smoke: 'smoke', spider: 'derby', other: 'lamp' };
  const srcName = (s) => t(`lb.src.${s}`);

  /* ------------------------------------------------------------ modal helper */
  function modal(html, cls = '') {
    const ov = document.createElement('div'); ov.className = 'lib-ov';
    ov.innerHTML = `<div class="lib-modal ${cls}">${html}</div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); if (ov.onclose) ov.onclose(); };
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
    for (const b of $$('[data-x]', ov)) b.onclick = close;
    return { el: $('.lib-modal', ov), close, ov };
  }

  /* ============================================================ SETTINGS: START (six tiles) */
  function paneHome(st, force) {
    const box = $('#st-home'); if (!box) return;
    const d = st.dmx, n = st.fixtures.length, conf = (d.conflicts || []).length;
    const libN = L.st ? L.st.count : 0;
    const sig = JSON.stringify([d.ok, d.label, n, conf, libN, L.st && L.st.ready, PH.lang, PH.simple]);
    if (!force && box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const tile = (id, icon, title, sub, cls = '') => `<button class="hm-tile ${cls}" data-go="${id}"><span class="hm-ic">${ic(icon)}</span><b>${esc(title)}</b><small>${esc(sub)}</small></button>`;
    box.innerHTML = `<button class="hm-hero" data-quickcal><span class="hm-ic">${ic('target')}</span>
        <span><b>${esc(t('hm.quickcal'))}</b><small>${esc(t('hm.quickcalS'))}</small></span>${ic('chevron')}</button>
      <div class="hm-grid">
      ${tile('dmx', 'plug', t('hm.dmx'), d.ok && d.config.backend !== 'sim' ? t('hm.dmxOk', { s: d.label || d.status }) : t('hm.dmxBad'), d.ok ? 'ok' : 'bad')}
      ${tile('lamps', 'lamp', t('hm.lamps'), conf ? t('hm.conflict') : n ? t('hm.lampsN', { n }) : t('hm.lamps0'), conf ? 'bad' : '')}
      ${tile('library', 'layers', t('hm.lib'), L.st && L.st.ready ? t('hm.libN', { n: libN }) : t('hm.libBuild'))}
      ${tile('dmxcal', 'channels', t('hm.cal'), t('hm.calS'), 'accent')}
      <div class="hm-tile lang-tile"><span class="hm-ic">${ic('help')}</span><b>${esc(t('hm.lang'))}</b>
        <div class="seg"><button data-l="pl" class="${PH.lang === 'pl' ? 'on' : ''}">Polski</button><button data-l="it" class="${PH.lang === 'it' ? 'on' : ''}">Italiano</button></div></div>
      ${tile('diag', 'pulse', t('hm.diag'), t('hm.diagS'))}
    </div>
    <div class="hm-foot"><button class="btn hm-wiz" data-go="wizard">${ic('sparkle')}<span>${esc(t('hm.wiz'))}</span></button>
      <label class="hm-simple"><span><b>${esc(t('sm2.mode'))}</b><small>${esc(t('sm2.modeS'))}</small></span><label class="switch"><input type="checkbox" id="hm-simple" ${PH.simple ? 'checked' : ''}><span></span></label></label></div>`;
    $('#hm-simple', box).onchange = (e) => PH.setSimple(e.target.checked);
    for (const b of $$('[data-go]', box)) b.onclick = () => PH.setupGo(b.dataset.go);
    $('[data-quickcal]', box).onclick = () => PH.openLightCal && PH.openLightCal();
    for (const b of $$('[data-l]', box)) b.onclick = () => { const x = $(`#lang button[data-lang="${b.dataset.l}"]`); if (x) x.click(); paneHome(S.st, true); };
  }

  /* ============================================================ SETTINGS: LIBRARY */
  let searchTimer = null;
  function paneLibrary(st, force) {
    const box = $('#st-library'); if (!box) return;
    if (!box.firstChild || force === 'rebuild' || box.dataset.lang !== PH.lang) buildLibrary(box);
    renderStatus();
  }
  function buildLibrary(box) {
    box.dataset.lang = PH.lang;
    const cats = ['moving_head', 'par', 'bar', 'derby', 'spider', 'strobe', 'laser', 'smoke'];
    box.innerHTML = `<div class="lib">
      <label class="lib-q">${ic('target')}<input id="lib-q" type="search" placeholder="${esc(t('lb.ph'))}" autocomplete="off"></label>
      <div class="lib-filters">
        <input id="lib-man" placeholder="${esc(t('lb.man'))}">
        <select id="lib-ch"><option value="">${esc(t('lb.ch'))}: ${esc(t('lb.any'))}</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 21, 24, 26].map((n) => `<option value="${n}">${n}CH</option>`).join('')}</select>
        <select id="lib-cat"><option value="">${esc(t('lb.cat'))}: ${esc(t('lb.any'))}</option>${cats.map((c) => `<option value="${c}">${esc(t('lb.cats.' + c))}</option>`).join('')}</select>
      </div>
      <div class="lib-actions">
        <button class="btn primary" data-a="unknown">${ic('channels')}<span>${esc(t('lb.unknown'))}</span></button>
        <button class="btn" data-a="link">${ic('plug')}<span>${esc(t('lb.link'))}</span></button>
        <label class="btn">${ic('layers')}<span>${esc(t('lb.pdf'))}</span><input type="file" accept="application/pdf,.pdf" data-a="pdf" hidden></label>
        <label class="btn">${ic('camera')}<span>${esc(t('lb.photo'))}</span><input type="file" accept="image/*" data-a="photo" hidden></label>
        <label class="btn">${ic('save')}<span>${esc(t('lb.gdtf'))}</span><input type="file" accept=".gdtf" data-a="gdtf" hidden></label>
        <button class="btn" data-a="rdm">${ic('refresh')}<span>${esc(t('lb.rdm'))}</span></button>
      </div>
      <div class="lib-status" id="lib-status"></div>
      <section id="lib-mine"></section>
      <div class="lib-grid" id="lib-res"></div>
    </div>`;
    const q = $('#lib-q', box);
    const run = () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 220); };
    q.oninput = run; $('#lib-man', box).oninput = run; $('#lib-ch', box).onchange = run; $('#lib-cat', box).onchange = run;
    $('[data-a="unknown"]', box).onclick = () => { PH.setupGo('dmxcal'); startCal({}); };
    $('[data-a="link"]', box).onclick = openLink;
    $('[data-a="rdm"]', box).onclick = doRdm;
    $('[data-a="pdf"]', box).onchange = (e) => e.target.files[0] && importPdf(e.target.files[0]);
    $('[data-a="photo"]', box).onchange = (e) => { const f = e.target.files[0]; if (f) { PH.setupGo('dmxcal'); startCal({ image: URL.createObjectURL(f) }); } };
    $('[data-a="gdtf"]', box).onchange = (e) => e.target.files[0] && importGdtf(e.target.files[0]);
    q.value = L.q || '';
    doSearch();
    renderMine();
  }
  async function doSearch() {
    const box = $('#st-library'); if (!box) return;
    const msg = { type: 'lib_search', q: $('#lib-q').value.trim(), manufacturer: $('#lib-man').value.trim(), channels: $('#lib-ch').value, category: $('#lib-cat').value };
    const key = JSON.stringify(msg);
    if (key === L.lastQ) return;
    L.lastQ = key; L.q = msg.q;
    if (!msg.q && !msg.manufacturer && !msg.channels && !msg.category) { L.res = []; renderResults(); return; }
    const m = await ask(msg, 'search');
    if (!m || JSON.stringify(msg) !== L.lastQ) return;
    L.res = m.results; renderResults(); renderStatus();
  }
  function renderStatus() {
    const el = $('#lib-status'); if (!el || !L.st) { if (!L.st) send({ type: 'lib_state' }); return; }
    el.innerHTML = `${ic('check')}<span>${esc(t('lb.status', { n: L.st.count, src: t('lb.ofl.' + (L.st.ofl || 'none')) }))}</span>
      <button class="btn sm" id="lib-upd">${ic('refresh')}<span>${esc(t('lb.update'))}</span></button>`;
    $('#lib-upd').onclick = async () => { await ask({ type: 'lib_update' }, 'state', 60000); renderStatus(); L.lastQ = null; doSearch(); };
  }
  function card(e, extra = '') {
    const modes = e.modes || [];
    const q = $('#lib-q') ? $('#lib-q').value.trim() : '';
    return `<div class="lcard" data-id="${esc(e.id)}">
      <div class="lc-h"><span class="lc-ic">${ic(CAT_IC[e.category] || 'lamp')}</span>
        <div class="lc-t"><b>${esc(e.model)}</b><small>${esc(e.manufacturer || '')}${e.category && e.category !== 'other' ? ' · ' + esc(t('lb.cats.' + e.category)) : ''}</small></div>
        <span class="lc-src s-${esc(e.source)}">${esc(srcName(e.source))}</span></div>
      <div class="lc-modes">${modes.length ? modes.map(([name, n]) => `<button class="mode" data-mode="${esc(name)}" data-n="${n}" title="${esc(name)}">${n}CH</button>`).join('')
        : `<button class="btn sm" data-load>${esc(t('lb.modes'))}</button>`}
        <span class="grow"></span><button class="btn sm ghost" data-det>${esc(t('lb.details'))}</button>${extra}</div>
      ${e.alias ? `<div class="lc-alias">${ic('check')} „${esc(q)}”</div>` : ''}</div>`;
  }
  function bindCards(root, list) {
    for (const c of $$('.lcard', root)) {
      const e = list.find((x) => x.id === c.dataset.id); if (!e) continue;
      for (const b of $$('[data-mode]', c)) b.onclick = () => openAdd(e, b.dataset.mode, Number(b.dataset.n));
      const det = $('[data-det]', c); if (det) det.onclick = () => openDetails(e);
      const ld = $('[data-load]', c);
      if (ld) ld.onclick = async () => { const m = await ask({ type: 'lib_details', id: e.id }, 'details'); if (m && m.fixture) { e.modes = m.fixture.modes.map((x) => [x.name, x.count]); c.outerHTML = card(e); bindCards(root, list); } };
      const del = $('[data-del]', c); if (del) del.onclick = async () => { await ask({ type: 'lib_delete', id: e.id }, 'deleted'); renderMine(); };
    }
  }
  function renderResults() {
    const box = $('#lib-res'); if (!box) return;
    const q = $('#lib-q').value.trim();
    if (!L.res.length) { box.innerHTML = q ? `<div class="lib-empty">${ic('help')}<p>${esc(t('lb.none'))}</p><button class="btn primary" id="lib-unk">${esc(t('lb.unknown'))}</button></div>` : ''; const u = $('#lib-unk'); if (u) u.onclick = () => { PH.setupGo('dmxcal'); startCal({ name: q }); }; return; }
    box.innerHTML = L.res.map((e) => card(e)).join('');
    bindCards(box, L.res);
  }
  async function renderMine() {
    const box = $('#lib-mine'); if (!box) return;
    const mine = await mineList();
    if (!mine.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<h4>${ic('save')} ${esc(t('lb.mine'))} <small>${esc(t('lb.mineS'))}</small></h4><div class="lib-grid">${mine.map((e) => card(e, `<button class="btn sm ghost danger-t" data-del>${esc(t('lb.del'))}</button>`)).join('')}</div>`;
    bindCards(box, mine);
  }
  async function mineList() {
    const m = await ask({ type: 'lib_mine' }, 'mine');
    return m ? m.results : [];
  }

  function openAdd(e, modeName, n) {
    const st = S.st, q = $('#lib-q') ? $('#lib-q').value.trim() : '';
    const free = freeAddr(n);
    const md = modal(`<h3>${ic('plus')} ${esc(t('lb.addT'))}</h3>
      <div class="lm-sub"><b>${esc(e.model)}</b> · ${n}CH <small>${esc(modeName)}</small> · ${esc(srcName(e.source))}</div>
      <div class="lm-row"><label>${esc(t('lb.addr'))}<input type="number" id="la-addr" min="1" max="512" value="${free}"></label>
        <label>${esc(t('lb.name'))}<input id="la-name" value="${esc(e.model.slice(0, 24))}" maxlength="24"></label></div>
      <p class="lm-tip" id="la-tip"></p>
      ${q && e.source !== 'mine' ? `<label class="lm-check"><input type="checkbox" id="la-alias"> ${esc(t('lb.alias', { q }))}</label>` : ''}
      <div class="lm-btns"><button class="btn ghost" data-x>${esc(t('lb.cancel'))}</button><span class="grow"></span>
        <button class="btn" id="la-check">${ic('help')}<span>${esc(t('lb.check'))}</span></button>
        <button class="btn primary" id="la-go">${ic('plus')}<span>${esc(t('lb.add'))}</span></button></div>`);
    const tip = () => { $('#la-tip', md.el).textContent = t('lb.lampSet', { a: 'A' + pad3($('#la-addr', md.el).value || 1), n }); };
    $('#la-addr', md.el).oninput = tip; tip();
    $('#la-go', md.el).onclick = () => {
      const al = $('#la-alias', md.el);
      send({ type: 'lib_add', id: e.id, mode: modeName, address: Number($('#la-addr', md.el).value) || undefined, name: $('#la-name', md.el).value.trim(), alias: al && al.checked ? q : undefined });
      md.close();
    };
    $('#la-check', md.el).onclick = () => { const a = Number($('#la-addr', md.el).value) || free; md.close(); openProbe(q || e.model, n, a); };
    void st;
  }
  function freeAddr(n) {
    const used = new Set();
    for (const f of S.st.fixtures) for (let c = f.address; c < f.address + f.footprint; c++) used.add(c);
    for (let a = 1; a + n - 1 <= 512; a++) { let ok = true; for (let c = a; c < a + n; c++) if (used.has(c)) { ok = false; break; } if (ok) return a; }
    return 1;
  }
  async function openDetails(e) {
    const m = await ask({ type: 'lib_details', id: e.id }, 'details');
    if (!m || !m.fixture) { PH.toast(m ? m.error : 'offline', 'warn'); return; }
    const f = m.fixture;
    const md = modal(`<h3>${ic(CAT_IC[f.category] || 'lamp')} ${esc(f.model)}</h3>
      <div class="lm-sub">${esc(f.manufacturer)} · ${esc(srcName(f.source))}${f.source_url && /^https?:/.test(f.source_url) ? ` · <a href="${esc(f.source_url)}" target="_blank" rel="noopener">${esc(t('lb.details'))}</a>` : ''}</div>
      <div class="lm-modes">${f.modes.map((mo, i) => `<button class="mode${i ? '' : ' on'}" data-i="${i}">${mo.count}CH <small>${esc(mo.name)}</small></button>`).join('')}</div>
      <div class="lm-table" id="ld-t"></div>
      <div class="lm-btns"><button class="btn ghost" data-x>${esc(t('lb.close'))}</button><span class="grow"></span><button class="btn primary" id="ld-add">${ic('plus')}<span>${esc(t('lb.add'))}</span></button></div>`, 'wide');
    let cur = 0;
    const draw = () => {
      const mo = f.modes[cur];
      $('#ld-t', md.el).innerHTML = `<table><tr><th>CH</th><th>${esc(t('pe.fn'))}</th><th>${esc(t('pe.rng'))}</th></tr>${mo.channels.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.name)}</b><small>${esc(c.type)}</small></td>
        <td class="caps">${(c.capabilities || []).slice(0, 8).map((x) => `<span>${x.color ? `<i style="background:${esc(x.color)}"></i>` : ''}${x.min}–${x.max} ${esc(x.name)}</span>`).join('')}${(c.capabilities || []).length > 8 ? '<span>…</span>' : ''}</td></tr>`).join('')}</table>`;
      for (const b of $$('[data-i]', md.el)) b.classList.toggle('on', Number(b.dataset.i) === cur);
    };
    for (const b of $$('[data-i]', md.el)) b.onclick = () => { cur = Number(b.dataset.i); draw(); };
    $('#ld-add', md.el).onclick = () => { md.close(); openAdd(e, f.modes[cur].name, f.modes[cur].count); };
    draw();
  }

  /* ---- "which of these 11CH profiles is it?" - safe probing of a few channels */
  async function openProbe(q, count, address) {
    const m = await ask({ type: 'lib_disambiguate', q, count }, 'disambiguate');
    if (!m || !m.candidates.length) { PH.toast(t('pr.none'), 'warn'); return; }
    let left = m.candidates.slice();
    const asked = new Set();
    const ANS = ['pan', 'tilt', 'light', 'color', 'gobo', 'strobe', 'auto', 'nothing'];
    const md = modal(`<h3>${ic('help')} ${esc(t('pr.t'))}</h3><p class="lm-sub">${esc(t('pr.s', { n: left.length, c: count }))}</p>
      <div class="lm-row"><label>${esc(t('pr.addr'))}<input type="number" id="pr-a" min="1" max="512" value="${address}"></label></div>
      <div id="pr-body"></div>
      <div class="lm-btns"><button class="btn ghost" data-x>${esc(t('lb.close'))}</button></div>`);
    let timer = null;
    md.ov.onclose = () => { clearInterval(timer); send({ type: 'test_clear' }); };
    const nextOffset = () => {
      let best = null, bestScore = 1e9;
      for (let off = 0; off < count; off++) {
        if (asked.has(off) || m.base[String(off)] !== undefined) continue;
        if (left.some((c) => c.danger.includes(off)) || m.candidates.some((c) => c.danger.includes(off))) continue;
        const groups = {};
        for (const c of left) (groups[c.seen[off]] = groups[c.seen[off]] || []).push(c);
        const n = Object.keys(groups).length; if (n < 2) continue;
        const worst = Math.max(...Object.values(groups).map((g) => g.length));
        if (worst < bestScore) { bestScore = worst; best = off; }
      }
      return best;
    };
    const finish = () => {
      clearInterval(timer); send({ type: 'test_clear' });
      const body = $('#pr-body', md.el);
      if (!left.length) { body.innerHTML = `<p class="lm-tip">${esc(t('pr.none'))}</p><button class="btn primary" id="pr-cal">${esc(t('lb.goCal'))}</button>`; $('#pr-cal', md.el).onclick = () => { md.close(); PH.setupGo('dmxcal'); startCal({ address: Number($('#pr-a', md.el).value), count, name: q }); }; return; }
      body.innerHTML = `<p class="lm-ok">${ic('check')} ${esc(t(left.length === 1 ? 'pr.done' : 'pr.left', { m: left[0].model, n: left.length }))}</p>
        ${left.map((c) => `<div class="pr-c"><b>${esc(c.model)}</b><small>${esc(c.manufacturer)} · ${esc(c.mode)} · ${esc(srcName(c.source))}</small><button class="btn primary sm" data-k="${esc(c.key)}">${esc(t('pr.apply'))}</button></div>`).join('')}`;
      for (const b of $$('[data-k]', body)) b.onclick = () => { const c = left.find((x) => x.key === b.dataset.k); send({ type: 'lib_add', id: c.id, mode: c.mode, address: Number($('#pr-a', md.el).value) }); md.close(); };
    };
    const step = () => {
      const off = nextOffset();
      if (off === null || left.length <= 1) return finish();
      asked.add(off);
      const a = Number($('#pr-a', md.el).value) || 1;
      let on = false;
      clearInterval(timer);
      const tick = () => { on = !on; send({ type: 'probe', address: a, count, base: m.base, offset: off, value: on ? 160 : 0 }); };
      tick(); timer = setInterval(tick, 900);
      $('#pr-body', md.el).innerHTML = `<div class="pr-now"><span class="pulse-dot"></span>${esc(t('pr.ch', { c: off + 1 }))} <small>${esc(t('pr.left', { n: left.length }))}</small></div>
        <p class="lm-q">${esc(t('pr.q'))}</p><div class="pr-ans">${ANS.map((x) => `<button class="btn" data-ans="${x}">${esc(t('pr.a.' + x))}</button>`).join('')}<button class="btn ghost" data-ans="skip">${esc(t('pr.a.skip'))}</button></div>`;
      for (const b of $$('[data-ans]', md.el)) b.onclick = () => {
        const ans = b.dataset.ans;
        if (ans !== 'skip') left = left.filter((c) => c.seen[off] === ans || (ans === 'light' && c.seen[off] === 'color'));
        step();
      };
    };
    const body = $('#pr-body', md.el);
    body.innerHTML = `<button class="btn primary big" id="pr-go">${ic('play')}<span>${esc(t('pr.start'))}</span></button>`;
    $('#pr-go', md.el).onclick = step;
  }

  /* ---- product link, manuals, GDTF, RDM */
  function openLink() {
    const md = modal(`<h3>${ic('plug')} ${esc(t('lb.linkT'))}</h3><p class="lm-sub">${esc(t('lb.linkS'))}</p>
      <div class="lm-row"><input id="lk-u" type="url" placeholder="https://…" style="flex:1"><button class="btn primary" id="lk-go">${esc(t('lb.linkGo'))}</button></div>
      <div id="lk-r"></div><div class="lm-btns"><button class="btn ghost" data-x>${esc(t('lb.close'))}</button></div>`, 'wide');
    $('#lk-go', md.el).onclick = async () => {
      const r = $('#lk-r', md.el); r.innerHTML = `<p class="lm-tip">…</p>`;
      const m = await ask({ type: 'lib_link', url: $('#lk-u', md.el).value.trim() }, 'link', 40000);
      if (!m || m.error) { r.innerHTML = `<p class="lm-tip warn">${esc(m ? m.error : 'timeout')}</p>${goCalBtn()}`; bindGoCal(r, md); return; }
      r.innerHTML = `${m.title ? `<p class="lm-sub">${esc(t('lb.linkFound', { t: m.title }))}</p>` : ''}
        ${chartsHtml(m.charts)}
        ${m.pdfs.length ? `<h4>${esc(t('lb.linkPdf'))}</h4>${m.pdfs.map((u, i) => `<div class="pr-c"><small>${esc(u.split('/').pop().slice(0, 60))}</small><button class="btn sm" data-pdf="${i}">${esc(t('lb.read'))}</button></div>`).join('')}` : ''}
        <div class="lib-grid">${m.results.map((e) => card(e)).join('')}</div>
        ${!m.results.length && !m.charts.length ? `<p class="lm-tip">${esc(t('lb.noData'))}</p>` : ''}${goCalBtn()}`;
      bindCards(r, m.results); bindCharts(r, m.charts, md); bindGoCal(r, md);
      for (const b of $$('[data-pdf]', r)) b.onclick = async () => {
        const p = await ask({ type: 'lib_pdf_url', url: m.pdfs[Number(b.dataset.pdf)] }, 'pdf', 60000);
        if (!p || p.error || !p.charts.length) { PH.toast(p && p.error ? p.error : t('lb.pdfNone'), 'warn'); return; }
        const holder = document.createElement('div'); holder.innerHTML = chartsHtml(p.charts); b.closest('.pr-c').after(holder); bindCharts(holder, p.charts, md);
      };
    };
  }
  const goCalBtn = () => `<div class="lm-btns"><button class="btn" data-gocal>${ic('channels')}<span>${esc(t('lb.goCal'))}</span></button></div>`;
  const bindGoCal = (r, md) => { const b = $('[data-gocal]', r); if (b) b.onclick = () => { md.close(); PH.setupGo('dmxcal'); startCal({}); }; };
  const chartsHtml = (charts) => (charts && charts.length ? `<h4>${ic('check')} ${esc(t('lb.charts'))}</h4>${charts.map((c, i) => `<div class="pr-c"><b>${c.channels.length}CH</b><small>${esc(c.channels.slice(0, 6).map((x) => x.name).join(' · '))}${c.channels.length > 6 ? ' …' : ''}</small><button class="btn sm primary" data-chart="${i}">${esc(t('lb.chartUse'))}</button></div>`).join('')}` : '');
  const bindCharts = (r, charts, md) => { for (const b of $$('[data-chart]', r)) b.onclick = () => { md && md.close(); PH.setupGo('dmxcal'); startCal({ chart: charts[Number(b.dataset.chart)] }); }; };
  async function importPdf(file) {
    const r = await fetch(`/api/upload?kind=pdf&name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    if (r.error || !r.charts || !r.charts.length) {
      PH.toast(r.error || t('lb.pdfNone'), 'warn');
      PH.setupGo('dmxcal'); startCal({ pdf: URL.createObjectURL(file) });
      return;
    }
    const md = modal(`<h3>${ic('layers')} ${esc(file.name)}</h3>${chartsHtml(r.charts)}<div class="lm-btns"><button class="btn ghost" data-x>${esc(t('lb.close'))}</button></div>`);
    bindCharts(md.el, r.charts, md);
  }
  async function importGdtf(file) {
    const r = await fetch(`/api/upload?kind=gdtf&name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    if (r.error) { PH.toast(r.error, 'err'); return; }
    PH.toast(t('lb.gdtfOk', { m: r.fixture.model }));
    const e = { id: r.fixture.id, model: r.fixture.model, manufacturer: r.fixture.manufacturer, category: r.fixture.category, source: 'gdtf', modes: r.fixture.modes.map((m) => [m.name, m.count]) };
    L.res = [e, ...L.res.filter((x) => x.id !== e.id)]; renderResults();
  }
  async function doRdm() {
    const m = await ask({ type: 'rdm_discover' }, 'rdm', 30000);
    if (!m) return;
    if (!m.supported) { modal(`<h3>${ic('refresh')} RDM</h3><p class="lm-tip warn">${esc(t('lb.rdmNo.' + m.why))}</p><p class="lm-sub">${esc(m.interface || '')}</p><div class="lm-btns"><button class="btn ghost" data-x>${esc(t('lb.close'))}</button><span class="grow"></span><button class="btn primary" data-f>${esc(t('lb.find'))}</button></div>`).el.querySelector('[data-f]').onclick = function () { this.closest('.lib-ov').remove(); $('#lib-q').focus(); }; return; }
    const md = modal(`<h3>${ic('refresh')} ${esc(t('lb.rdmFound'))}</h3>${m.devices.map((d) => `<div class="pr-c"><b>${esc(d.manufacturer_label)} ${esc(d.model_description)}</b>
      <small>UID ${esc(d.uid)} · ${d.footprint}CH · ${esc(t('lb.addr'))} ${pad3(d.start_address || 1)}${d.matches[0] ? ` · ${Math.round(d.matches[0].confidence * 100)}% ${esc(d.matches[0].model)}` : ''}</small>
      ${d.matches[0] ? `<button class="btn sm primary" data-u="${esc(d.uid)}">${esc(t('lb.useProfile'))}</button>` : ''}</div>`).join('')}
      <div class="lm-btns"><button class="btn ghost" data-x>${esc(t('lb.close'))}</button></div>`);
    for (const b of $$('[data-u]', md.el)) b.onclick = () => { const d = m.devices.find((x) => x.uid === b.dataset.u); send({ type: 'lib_add', id: d.matches[0].id, mode: d.matches[0].mode, address: d.start_address }); md.close(); };
  }

  /* ============================================================ SETTINGS: CONFIGURATION / CALIBRATION */
  const ROLES = [['pan', 'Pan', 'arrows'], ['tilt', 'Tilt', 'move'], ['dim', 'Dimmer', 'sun'], ['red', 'Red', 'drop'], ['green', 'Green', 'drop'], ['blue', 'Blue', 'drop'],
    ['white', 'White', 'drop'], ['strobe', 'Strobe', 'strobe'], ['gobo', 'GoboWheel', 'gobo'], ['color', 'ColorWheel', 'palette'], ['speed', 'PanTiltSpeed', 'gauge'],
    ['laser', 'LaserRed', 'laser'], ['auto', 'AutoProgram', 'auto'], ['sound', 'SoundProgram', 'wave'], ['reset', 'Reset', 'refresh'], ['other', 'Other', 'channels']];
  const MORE = [['panf', 'PanFine'], ['tiltf', 'TiltFine'], ['gobor', 'GoboRotation'], ['prism', 'Prism'], ['zoom', 'Zoom'], ['focus', 'Focus'], ['amber', 'Amber'], ['uv', 'UV'], ['none', 'Unknown']];
  const TYPE_LABEL = Object.fromEntries([...ROLES.map(([k, v]) => [v, `ro2.${k}`]), ...MORE.map(([k, v]) => [v, `ro2.${k}`]),
    ['MasterDimmer', 'ro2.dim'], ['Shutter', 'ro2.strobe'], ['MotorSpeed', 'ro2.speed'], ['LaserGreen', 'ro2.laser'], ['LaserBlue', 'ro2.laser'], ['Macro', 'ro2.auto'],
    ['LampControl', 'ro2.reset'], ['Iris', 'ro2.other'], ['Cyan', 'ro2.other'], ['Magenta', 'ro2.other'], ['Yellow', 'ro2.other'], ['PrismRotation', 'ro2.prism']]);
  const LOCKED = ['Reset', 'LampControl', 'LaserRed', 'LaserGreen', 'LaserBlue'];
  const CAL = { step: 'menu' };

  function startCal(o) {
    clearInterval(CAL.timer);
    Object.assign(CAL, { step: 'addr', address: o.address || freeAddr(o.count || 9), count: o.count || 9, idx: 0, types: [], vals: [], names: [], name: o.name || '',
      image: o.image || null, pdf: o.pdf || null, chart: null, match: null, timer: null, replace: o.replace || null,
      inv: { pan: !!o.invPan, tilt: !!o.invTilt }, dirAsked: {} });
    if (o.view === 'all') CAL.step = 'all';
    if (o.chart) {
      CAL.chart = o.chart; CAL.count = o.chart.channels.length;
      CAL.types = o.chart.channels.map((c) => c.type); CAL.names = o.chart.channels.map((c) => c.name);
      CAL.step = 'addr';
    }
    if (o.types) { CAL.types = o.types.slice(); CAL.count = o.types.length; }
    renderCal();
  }
  function paneCalib(st, force) {
    const box = $('#st-dmxcal'); if (!box) return;
    if (!box.firstChild || force || box.dataset.lang !== PH.lang) renderCal();
  }
  function stopProbe() { clearInterval(CAL.timer); CAL.timer = null; send({ type: 'test_clear' }); }
  function base() {                           // light the lamp with what we already know (never reset / laser)
    const b = {};
    CAL.types.forEach((ty, i) => {
      if (i === CAL.idx) return;
      if (ty === 'Dimmer' || ty === 'MasterDimmer') b[i] = 255;
      else if ((ty === 'Strobe' || ty === 'Shutter') && CAL.vals[i] !== undefined) b[i] = CAL.vals[i];
      else if (['Red', 'Green', 'Blue', 'White'].includes(ty)) b[i] = 200;
    });
    return b;
  }
  function out(value) {
    if (LOCKED.includes(CAL.types[CAL.idx])) return;
    send({ type: 'probe', address: CAL.address, count: CAL.count, base: base(), offset: CAL.idx, value });
  }
  function renderCal() {
    const box = $('#st-dmxcal'); if (!box) return;
    box.dataset.lang = PH.lang;
    const head = CAL.step === 'menu' ? '' : `<div class="cl-head"><div><small>${esc(t('cl.t'))}</small><b>${esc(CAL.name || t('cl.t'))}</b></div>
      <span class="cl-pill">${esc(t('cl.addr'))} <b>${pad3(CAL.address)}</b></span><span class="cl-pill">${esc(t('cl.mode'))} <b>${CAL.count}CH</b></span></div>`;
    const side = CAL.image || CAL.pdf ? `<aside class="cl-side">${CAL.image ? `<img src="${CAL.image}" alt="">` : `<iframe src="${CAL.pdf}"></iframe>`}</aside>` : '';
    let body = '';
    if (CAL.step === 'menu') {
      const fx = S.st ? S.st.fixtures : [];
      body = `<div class="cl-menu">
        <button class="hm-tile" data-m="have"><span class="hm-ic">${ic('layers')}</span><b>${esc(t('cl.have'))}</b><small>${esc(t('cl.haveS'))}</small></button>
        <button class="hm-tile" data-m="dont"><span class="hm-ic">${ic('channels')}</span><b>${esc(t('cl.dont'))}</b><small>${esc(t('cl.dontS'))}</small></button>
        <button class="hm-tile accent" data-m="me"><span class="hm-ic">${ic('person')}</span><b>${esc(t('ht.me'))}</b><small>${esc(t('cl.meS'))}</small></button>
        <button class="hm-tile" data-m="aim"><span class="hm-ic">${ic('target')}</span><b>${esc(t('cl.aim'))}</b><small>${esc(t('cl.aimS'))}</small></button></div>
        ${fx.length ? `<h4 class="cl-h4">${esc(t('cl.edit'))} <small>${esc(t('cl.editS'))}</small></h4><div class="cl-fx">${fx.map((f) => `<span class="cl-fxi"><b>${esc(f.name)} · ${pad3(f.address)}</b><button class="btn sm primary" data-qt2="${f.id}">${ic('play')}<span>${esc(t('cl.quickTest'))}</span></button><button class="btn sm" data-pe="${f.id}">${ic('edit')}<span>${esc(t('ad.edit'))}</span></button></span>`).join('')}</div>` : ''}`;
    } else if (CAL.step === 'addr') {
      body = `<div class="cl-card"><h3>${esc(t('cl.s1'))}</h3><p class="muted">${esc(t('cl.s1d'))}</p>
        <div class="cl-big"><button class="btn" data-d="-1">−</button><input type="number" id="cl-a" min="1" max="512" value="${CAL.address}"><button class="btn" data-d="1">+</button></div>
        <label class="cl-lbl">${esc(t('cl.name'))}<input id="cl-n" value="${esc(CAL.name)}" placeholder="Mini Gobo 11CH" maxlength="40"></label>
        ${CAL.chart ? `<p class="lm-ok">${ic('check')} ${esc(t('cl.fromChart'))}</p>` : ''}
        <div class="lm-btns"><button class="btn ghost" data-go="menu">${esc(t('cl.back'))}</button><span class="grow"></span><button class="btn primary" data-go="${CAL.chart ? 'chan' : 'count'}">${esc(t('cl.next'))} →</button></div></div>`;
    } else if (CAL.step === 'count') {
      body = `<div class="cl-card"><h3>${esc(t('cl.s2'))}</h3><p class="muted">${esc(t('cl.s2d'))}</p>
        <div class="cl-counts">${[3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 21].map((n) => `<button class="mode${n === CAL.count ? ' on' : ''}" data-c="${n}">${n}CH</button>`).join('')}
          <input type="number" id="cl-c" min="1" max="64" value="${CAL.count}" title="${esc(t('cl.manual'))}"></div>
        <button class="btn" id="cl-auto">${ic('play')}<span>${esc(t('cl.auto'))}</span></button>
        <div id="cl-autobox"></div>
        <div class="lm-btns"><button class="btn ghost" data-go="addr">${esc(t('cl.back'))}</button><span class="grow"></span><button class="btn primary" data-go="chan">${esc(t('cl.next'))} →</button></div></div>`;
    } else if (CAL.step === 'chan') {
      const i = CAL.idx, ty = CAL.types[i], v = CAL.vals[i] ?? 0, locked = LOCKED.includes(ty);
      body = `<div class="cl-card cl-chan">
        ${viewSeg('step')}
        <div class="cl-chh"><b>${esc(t('cl.ch', { i: i + 1, n: CAL.count }))}</b><small>DMX ${pad3(CAL.address + i)}${CAL.names[i] ? ' · ' + esc(CAL.names[i]) : ''}</small>
          <div class="cl-dots">${Array.from({ length: CAL.count }, (_, k) => `<i class="${k === i ? 'cur' : CAL.types[k] ? 'done' : ''}" data-j="${k}" title="${k + 1}"></i>`).join('')}</div></div>
        <div class="cl-val"><button class="btn" data-v="-10" ${locked ? 'disabled' : ''}>−</button><div><output id="cl-vo">${v}</output><small>VALUE</small></div><button class="btn" data-v="10" ${locked ? 'disabled' : ''}>+</button></div>
        <input type="range" id="cl-v" min="0" max="255" value="${v}" ${locked ? 'disabled' : ''}>
        ${locked ? '' : quickRow(i)}
        <p class="lm-tip ${locked ? 'warn' : ''}">${esc(t(locked ? 'cl.locked' : 'cl.warn'))}</p>
        <button class="btn" id="cl-probe" ${locked ? 'disabled' : ''}>${ic('sparkle')}<span>${esc(t('cl.probe'))}</span></button>
        <div id="cl-pbox"></div>
        <h3 class="cl-q">${esc(t('cl.q'))}</h3>
        <div class="cl-roles">${ROLES.map(([k, typ, icon]) => `<button class="role${ty === typ ? ' on' : ''} r-${k}" data-t="${typ}">${ic(icon)}<span>${esc(t('ro2.' + k))}</span>${k === 'pan' || k === 'tilt' ? `<small>${esc(t(`ro2.${k}S`))}</small>` : ''}</button>`).join('')}</div>
        <div class="cl-more"><small>${esc(t('ro2.more'))}</small>${MORE.map(([k, typ]) => `<button class="chip${ty === typ ? ' on' : ''}" data-t="${typ}">${esc(t('ro2.' + k))}</button>`).join('')}</div>
        <div class="cl-match" id="cl-match"></div>
        <div class="lm-btns"><button class="btn ghost" data-nav="-1">← ${esc(t('cl.back'))}</button><span class="grow"></span><button class="btn primary" data-nav="1">${esc(t('cl.next'))} →</button></div></div>`;
    } else if (CAL.step === 'all') {
      body = `<div class="cl-card">${viewSeg('all')}<h3>${esc(t('cl.allT'))}</h3><p class="muted">${esc(t('cl.allS'))}</p>
        <div class="qa">${Array.from({ length: CAL.count }, (_, k) => {
          const ty = CAL.types[k] || 'Unknown', v = CAL.vals[k] ?? 0, lk = LOCKED.includes(ty), pos = ty === 'Pan' || ty === 'Tilt';
          return `<div class="qa-r${lk ? ' lk' : ''}"><div class="qa-n"><b>${k + 1}</b><small>${pad3(CAL.address + k)}</small></div>
            <select data-qt="${k}">${TYPE_OPTS.map(([typ, key]) => `<option value="${typ}" ${typ === ty ? 'selected' : ''}>${esc(t(key))}</option>`).join('')}</select>
            <input type="range" min="0" max="255" value="${v}" data-qv="${k}" ${lk ? 'disabled' : ''}><output data-qo="${k}">${v}</output>
            <div class="qa-b">${lk ? `<small class="muted">${esc(t('cl.locked').split(' — ')[0])}</small>` : pos
              ? `<button class="btn sm" data-qd="${k}:lo">${esc(t(ty === 'Pan' ? 'cl.left' : 'cl.up'))}</button><button class="btn sm" data-qb="${k}:128">${esc(t('cl.mid'))}</button><button class="btn sm" data-qd="${k}:hi">${esc(t(ty === 'Pan' ? 'cl.right' : 'cl.down'))}</button>
                 <button class="chip${CAL.inv[ty === 'Pan' ? 'pan' : 'tilt'] ? ' on' : ''}" data-qi="${ty === 'Pan' ? 'pan' : 'tilt'}">⇄</button>`
              : `<button class="btn sm" data-qb="${k}:0">0</button><button class="btn sm" data-qb="${k}:128">128</button><button class="btn sm" data-qb="${k}:${safeMax(ty)}">${safeMax(ty) === 255 ? esc(t('cl.max')) : 192}</button>`}</div></div>`;
        }).join('')}</div>
        <div class="lm-btns"><button class="btn" id="qa-0">${esc(t('cl.all0'))}</button><button class="btn" id="qa-on">${ic('sun')}<span>${esc(t('cl.allOn'))}</span></button>
          <span class="grow"></span><button class="btn primary" data-go="sum">${esc(t('cl.done'))}</button></div>
        <div class="cl-match" id="cl-match"></div></div>`;
    } else if (CAL.step === 'sum') {
      body = `<div class="cl-card"><h3>${ic('check')} ${esc(t('cl.sum'))}</h3>
        <table class="cl-tab">${CAL.types.map((ty, i) => `<tr data-j="${i}"><td>${i + 1}</td><td>${pad3(CAL.address + i)}</td><td><b>${esc(t(TYPE_LABEL[ty] || 'ro2.none'))}</b>${CAL.names[i] ? `<small>${esc(CAL.names[i])}</small>` : ''}${ty === 'Pan' || ty === 'Tilt' ? `<small>${esc(t(CAL.inv[ty === 'Pan' ? 'pan' : 'tilt'] ? 'cl.dirInv' : 'cl.dirOk'))}</small>` : ''}</td></tr>`).join('')}</table>
        <label class="cl-lbl">${esc(t('cl.name'))}<input id="cl-n2" value="${esc(CAL.name || `Moja lampa ${CAL.count}CH`)}" maxlength="40"></label>
        <div class="cl-match" id="cl-match"></div>
        <div class="lm-btns"><button class="btn ghost" data-go="chan">← ${esc(t('cl.back'))}</button><span class="grow"></span><button class="btn primary" id="cl-save">${ic('save')}<span>${esc(t('cl.save'))}</span></button></div></div>`;
    }
    box.innerHTML = `<div class="cl ${side ? 'with-side' : ''}"><div class="cl-main">${head}${body}</div>${side}</div>`;
    bindCal(box);
    if (CAL.step === 'chan' || CAL.step === 'sum' || CAL.step === 'all') refreshMatch();
    if (CAL.step === 'all') sendAll();
  }
  function bindCal(box) {
    for (const b of $$('[data-m]', box)) b.onclick = () => {
      if (b.dataset.m === 'have') { PH.setupGo('library'); setTimeout(() => { const q = $('#lib-q'); if (q) q.focus(); }, 50); }
      else if (b.dataset.m === 'dont') startCal({});
      else if (b.dataset.m === 'me') PH.openMeCal();
      else PH.setupGo('lampcal');
    };
    for (const b of $$('[data-pe]', box)) b.onclick = () => openProfile(Number(b.dataset.pe));
    for (const b of $$('[data-qt2]', box)) b.onclick = () => quickTest(Number(b.dataset.qt2));
    for (const b of $$('[data-go]', box)) b.onclick = () => {
      const a = $('#cl-a', box); if (a) CAL.address = Math.max(1, Math.min(512, Number(a.value) || 1));
      const n = $('#cl-n', box); if (n) CAL.name = n.value.trim();
      const c = $('#cl-c', box); if (c) CAL.count = Math.max(1, Math.min(64, Number(c.value) || CAL.count));
      if (b.dataset.go === 'menu') stopProbe();
      CAL.step = b.dataset.go;
      if (CAL.step === 'chan') { CAL.types.length = CAL.count; CAL.idx = Math.min(CAL.idx, CAL.count - 1); out(CAL.vals[CAL.idx] || 0); }
      renderCal();
    };
    for (const b of $$('[data-d]', box)) b.onclick = () => { const a = $('#cl-a', box); a.value = Math.max(1, Math.min(512, Number(a.value) + Number(b.dataset.d))); };
    for (const b of $$('[data-c]', box)) b.onclick = () => { CAL.count = Number(b.dataset.c); $('#cl-c', box).value = CAL.count; for (const x of $$('[data-c]', box)) x.classList.toggle('on', x === b); };
    const auto = $('#cl-auto', box); if (auto) auto.onclick = autoCount;
    const v = $('#cl-v', box);
    if (v) {
      const set = (val) => { val = Math.max(0, Math.min(255, val)); CAL.vals[CAL.idx] = val; v.value = val; $('#cl-vo', box).textContent = val; out(val); };
      v.oninput = () => set(Number(v.value));
      for (const b of $$('[data-v]', box)) b.onclick = () => set((CAL.vals[CAL.idx] || 0) + Number(b.dataset.v));
      for (const b of $$('[data-t]', box)) b.onclick = () => { CAL.types[CAL.idx] = b.dataset.t; if (LOCKED.includes(b.dataset.t)) { CAL.vals[CAL.idx] = 0; out(0); } renderCal(); };
      for (const b of $$('[data-nav]', box)) b.onclick = () => {
        stopProbe();
        const ni = CAL.idx + Number(b.dataset.nav);
        if (ni < 0) { CAL.step = 'count'; renderCal(); return; }
        if (ni >= CAL.count) { CAL.step = 'sum'; renderCal(); return; }
        CAL.idx = ni; renderCal(); out(CAL.vals[ni] || 0);
      };
      for (const d of $$('[data-j]', box)) d.onclick = () => { stopProbe(); CAL.idx = Number(d.dataset.j); renderCal(); out(CAL.vals[CAL.idx] || 0); };
      $('#cl-probe', box).onclick = autoProbe;
    }
    for (const r of $$('.cl-tab tr', box)) r.onclick = () => { CAL.idx = Number(r.dataset.j); CAL.step = 'chan'; renderCal(); };
    const save = $('#cl-save', box); if (save) save.onclick = saveCal;
    bindQuick(box);
  }
  // safe automatic probe of the current channel: 0 → 192 in steps, then ask
  function autoProbe() {
    const box = $('#cl-pbox'); if (!box) return;
    const steps = [0, 32, 64, 96, 128, 160, 192];
    let k = 0;
    clearInterval(CAL.timer);
    box.innerHTML = `<div class="pr-now"><span class="pulse-dot"></span>${esc(t('cl.probing', { i: CAL.idx + 1 }))}</div>`;
    CAL.timer = setInterval(() => {
      out(steps[k % steps.length]); k++;
      if (k === steps.length) {
        box.innerHTML = `<div class="pr-now"><span class="pulse-dot"></span>${esc(t('cl.probing', { i: CAL.idx + 1 }))}</div>
          <p class="lm-q">${esc(t('cl.moved'))}</p><div class="pr-ans"><button class="btn primary" data-y="1">${esc(t('cl.yes'))}</button><button class="btn" data-y="0">${esc(t('cl.no'))}</button></div>`;
        for (const b of $$('[data-y]', box)) b.onclick = () => (b.dataset.y === '1' ? askWhat(box) : (stopProbe(), CAL.types[CAL.idx] = CAL.types[CAL.idx] || 'Other', renderCal()));
      }
    }, 650);
  }
  function askWhat(box) {
    const A = [['Pan', 'pr.a.pan'], ['Tilt', 'pr.a.tilt'], ['GoboRotation', 'ro2.gobor'], ['_color', 'pr.a.color'], ['Dimmer', 'pr.a.light'], ['Strobe', 'pr.a.strobe'], ['GoboWheel', 'pr.a.gobo'], ['AutoProgram', 'pr.a.auto'], ['Other', 'ro2.other']];
    box.innerHTML = `<p class="lm-q">${esc(t('cl.what'))}</p><div class="pr-ans">${A.map(([v, k]) => `<button class="btn" data-w="${v}">${esc(t(k))}</button>`).join('')}</div>`;
    for (const b of $$('[data-w]', box)) b.onclick = () => {
      if (b.dataset.w === '_color') {
        const C = [['Red', 'ro2.red'], ['Green', 'ro2.green'], ['Blue', 'ro2.blue'], ['White', 'ro2.white'], ['ColorWheel', 'ro2.color']];
        box.innerHTML = `<p class="lm-q">${esc(t('cl.whatColor'))}</p><div class="pr-ans">${C.map(([v, k]) => `<button class="btn" data-w2="${v}">${esc(t(k))}</button>`).join('')}</div>`;
        for (const c of $$('[data-w2]', box)) c.onclick = () => { stopProbe(); CAL.types[CAL.idx] = c.dataset.w2; renderCal(); };
        return;
      }
      stopProbe(); CAL.types[CAL.idx] = b.dataset.w; renderCal();
    };
  }
  // helper for an unknown channel count: channels one by one, the user says where the lamp stops reacting
  function autoCount() {
    const box = $('#cl-autobox'); if (!box) return;
    const a = $('#cl-a'); void a;
    let i = 0, last = 0, misses = 0;
    const show = () => {
      let on = false; clearInterval(CAL.timer);
      CAL.timer = setInterval(() => { on = !on; send({ type: 'probe', address: CAL.address, count: 32, offset: i, value: on ? 160 : 0 }); }, 800);
      box.innerHTML = `<div class="pr-now"><span class="pulse-dot"></span>${esc(t('cl.autoQ', { i: i + 1 }))}</div>
        <div class="pr-ans"><button class="btn primary" data-r="1">${esc(t('cl.yes'))}</button><button class="btn" data-r="0">${esc(t('cl.no'))}</button><button class="btn ghost" data-r="end">${esc(t('cl.autoEnd'))}</button></div>`;
      for (const b of $$('[data-r]', box)) b.onclick = () => {
        if (b.dataset.r === '1') { last = i + 1; misses = 0; } else if (b.dataset.r === '0') misses++;
        if (b.dataset.r === 'end' || misses >= 3 || i >= 31) { stopProbe(); CAL.count = Math.max(1, last || CAL.count); box.innerHTML = `<p class="lm-ok">${esc(t('cl.autoRes', { n: CAL.count }))}</p>`; const c = $('#cl-c'); if (c) c.value = CAL.count; for (const x of $$('[data-c]')) x.classList.toggle('on', Number(x.dataset.c) === CAL.count); return; }
        i++; show();
      };
    };
    show();
  }
  let matchTimer = null;
  function refreshMatch() {
    clearTimeout(matchTimer);
    matchTimer = setTimeout(async () => {
      const known = {}; CAL.types.forEach((ty, i) => { if (ty && ty !== 'Unknown') known[i] = ty; });
      const box = $('#cl-match');
      if (!box || Object.keys(known).length < 3) { if (box) box.innerHTML = ''; return; }
      const m = await ask({ type: 'lib_match', count: CAL.count, known, text: CAL.name }, 'match');
      const b2 = $('#cl-match'); if (!m || !b2) return;
      const top = m.results[0];
      if (!top || top.confidence < 0.8) { b2.innerHTML = ''; return; }
      const many = m.results.filter((r) => r.confidence >= top.confidence - 0.02).length > 1;
      b2.innerHTML = many && Object.keys(known).length < CAL.count ? `<span class="muted">${esc(t('cl.matchMany'))}</span>`
        : `<div class="pr-c"><b>${esc(t('cl.match', { p: Math.round(top.confidence * 100), m: top.model }))}</b><small>${esc(top.manufacturer)} · ${esc(top.mode)} · ${esc(srcName(top.source))}</small>
          <button class="btn sm primary" id="cl-apply">${esc(t('cl.apply'))}</button></div>`;
      const ap = $('#cl-apply'); if (ap) ap.onclick = () => { stopProbe(); send({ type: 'lib_add', id: top.id, mode: top.mode, address: CAL.address }); CAL.step = 'menu'; renderCal(); PH.setupGo('lamps'); };
    }, 350);
  }
  async function saveCal() {
    stopProbe();
    const name = ($('#cl-n2').value || '').trim() || `Moja lampa ${CAL.count}CH`;
    const types = CAL.types.slice(0, CAL.count).map((x) => x || 'Unknown');
    const cat = types.includes('Pan') && types.includes('Tilt') ? 'moving_head' : types.some((x) => x.startsWith('Laser')) ? 'laser'
      : types.includes('Pan') || types.includes('Tilt') ? 'derby' : 'par';
    const profile = { manufacturer: 'Moje', model: name, category: cat, source: 'mine',
      modes: [{ name: `${CAL.count}CH`, channels: types.map((ty, i) => ({ name: CAL.names[i] || t(TYPE_LABEL[ty] || 'ro2.none'), type: ty,
        default: (ty === 'Strobe' || ty === 'Shutter') && CAL.vals[i] ? CAL.vals[i] : 0 })) }] };
    const m = await ask({ type: 'lib_save', profile, name, add: true, address: CAL.address, replace: CAL.replace,
      extra: { invert_pan: CAL.inv.pan, invert_tilt: CAL.inv.tilt } }, 'saved');
    if (m) PH.toast(t('cl.saved', { m: name }));
    CAL.step = 'menu'; renderCal(); PH.setupGo('lamps');
  }

  /* ---- quick tests: left / right, up / down (with direction check), fixed values, all channels at once */
  const TYPE_OPTS = [...ROLES.map(([k, typ]) => [typ, `ro2.${k}`]), ...MORE.map(([k, typ]) => [typ, `ro2.${k}`])];
  const SAFE_FULL = ['Pan', 'Tilt', 'PanFine', 'TiltFine', 'Dimmer', 'MasterDimmer', 'Red', 'Green', 'Blue', 'White', 'Amber', 'UV', 'ColorWheel', 'GoboWheel', 'GoboRotation',
    'PanTiltSpeed', 'Zoom', 'Focus', 'Prism', 'Strobe', 'Shutter'];
  const safeMax = (ty) => (SAFE_FULL.includes(ty) ? 255 : 192);         // unknown channels never above 192 from a button
  const viewSeg = (cur) => `<div class="seg cl-view"><button data-view="step" class="${cur === 'step' ? 'on' : ''}">${esc(t('cl.viewStep'))}</button><button data-view="all" class="${cur === 'all' ? 'on' : ''}">${esc(t('cl.viewAll'))}</button></div>`;
  const dirVal = (axis, hi) => ((hi !== CAL.inv[axis]) ? 255 : 0);
  function quickRow(i) {
    const ty = CAL.types[i];
    if (ty === 'Pan' || ty === 'Tilt') {
      const axis = ty === 'Pan' ? 'pan' : 'tilt';
      return `<div class="cl-dir"><small>${esc(t('cl.quick'))}</small>
        <button class="btn big" data-dir="${axis}:lo">${esc(t(axis === 'pan' ? 'cl.left' : 'cl.up'))}</button>
        <button class="btn" data-qv1="128">${esc(t('cl.mid'))}</button>
        <button class="btn big" data-dir="${axis}:hi">${esc(t(axis === 'pan' ? 'cl.right' : 'cl.down'))}</button></div>
        <div class="cl-inv"><span>${esc(t(axis === 'pan' ? 'cl.dirPan' : 'cl.dirTilt'))}</span>
        <button class="chip${CAL.dirAsked[axis] && !CAL.inv[axis] ? ' on' : ''}" data-inv="${axis}:0">${esc(t('cl.dirYes'))}</button>
        <button class="chip${CAL.inv[axis] ? ' on' : ''}" data-inv="${axis}:1">${esc(t('cl.dirNo'))}</button></div>`;
    }
    return `<div class="cl-dir"><small>${esc(t('cl.quick'))}</small>${[0, 64, 128, 192].map((v) => `<button class="btn" data-qv1="${v}">${v}</button>`).join('')}
      ${safeMax(ty) === 255 ? `<button class="btn" data-qv1="255">${esc(t('cl.max'))}</button>` : ''}</div>`;
  }
  let allTimer = null;
  function sendAll() {
    clearTimeout(allTimer);
    allTimer = setTimeout(() => {
      const b = {};
      for (let k = 0; k < CAL.count; k++) b[k] = LOCKED.includes(CAL.types[k]) ? 0 : (CAL.vals[k] || 0);
      send({ type: 'probe', address: CAL.address, count: CAL.count, base: b });
    }, 30);
  }
  function bindQuick(box) {
    for (const b of $$('[data-view]', box)) b.onclick = () => { stopProbe(); CAL.step = b.dataset.view === 'all' ? 'all' : 'chan'; renderCal(); if (CAL.step === 'chan') out(CAL.vals[CAL.idx] || 0); };
    const setCur = (v) => { CAL.vals[CAL.idx] = v; const s = $('#cl-v', box); if (s) s.value = v; const o = $('#cl-vo', box); if (o) o.textContent = v; out(v); };
    for (const b of $$('[data-qv1]', box)) b.onclick = () => setCur(Number(b.dataset.qv1));
    for (const b of $$('[data-dir]', box)) b.onclick = () => { const [axis, w] = b.dataset.dir.split(':'); setCur(dirVal(axis, w === 'hi')); };
    for (const b of $$('[data-inv]', box)) b.onclick = () => { const [axis, v] = b.dataset.inv.split(':'); CAL.inv[axis] = v === '1'; CAL.dirAsked[axis] = true; renderCal(); out(CAL.vals[CAL.idx] || 0); };
    // all-channels view
    for (const s of $$('[data-qv]', box)) s.oninput = () => { const k = Number(s.dataset.qv); CAL.vals[k] = Number(s.value); $(`[data-qo="${k}"]`, box).textContent = s.value; sendAll(); };
    const setK = (k, v) => { CAL.vals[k] = v; const s = $(`[data-qv="${k}"]`, box); if (s) s.value = v; const o = $(`[data-qo="${k}"]`, box); if (o) o.textContent = v; sendAll(); };
    for (const b of $$('[data-qb]', box)) b.onclick = () => { const [k, v] = b.dataset.qb.split(':').map(Number); setK(k, v); };
    for (const b of $$('[data-qd]', box)) b.onclick = () => { const [k, w] = b.dataset.qd.split(':'); const axis = CAL.types[k] === 'Pan' ? 'pan' : 'tilt'; setK(Number(k), dirVal(axis, w === 'hi')); };
    for (const b of $$('[data-qi]', box)) b.onclick = () => { const axis = b.dataset.qi; CAL.inv[axis] = !CAL.inv[axis]; renderCal(); };
    for (const s of $$('[data-qt]', box)) s.onchange = () => { const k = Number(s.dataset.qt); CAL.types[k] = s.value; if (LOCKED.includes(s.value)) CAL.vals[k] = 0; renderCal(); };
    const z = $('#qa-0', box); if (z) z.onclick = () => { CAL.vals = []; renderCal(); };
    const on = $('#qa-on', box); if (on) on.onclick = () => {
      CAL.types.forEach((ty, k) => { if (['Dimmer', 'MasterDimmer', 'Red', 'Green', 'Blue', 'White'].includes(ty)) CAL.vals[k] = 255; });
      renderCal();
    };
  }
  // "Szybki test" of a lamp that is already on the stage: its channels in the all-at-once view
  function quickTest(id) {
    const f = S.st.fixtures.find((x) => x.id === id); if (!f) return;
    const types = f.channels.map((r) => ROLE_TYPE[r] || (r.startsWith('const:') ? 'Other' : 'Unknown'));
    PH.setupGo('dmxcal');
    startCal({ address: f.address, count: types.length, types, name: f.name, replace: f.id, view: 'all', invPan: f.invert_pan, invTilt: f.invert_tilt });
  }
  PH.quickTest = quickTest;

  /* ---- start address: type it or click -/+ ; applies at once (e.g. a laser that starts on another channel) */
  const addrCtl = (f) => `<span class="ad-addr" title="${esc(t('ad.addrT'))}"><button data-ad="${f.id}:-1">−</button><input type="number" min="1" max="${513 - f.footprint}" value="${f.address}" data-adi="${f.id}"><button data-ad="${f.id}:1">+</button><span>–${pad3(f.address + f.footprint - 1)}</span></span>`;
  function bindAddr(box) {
    const setA = (id, a) => {
      const f = S.st.fixtures.find((x) => x.id === id); if (!f) return;
      a = Math.max(1, Math.min(513 - f.footprint, a));
      send({ type: 'update_fixture', id, address: a }); send({ type: 'save' });
      const inp = $(`[data-adi="${id}"]`, box); if (inp) inp.value = a;
    };
    for (const b of $$('[data-ad]', box)) b.onclick = () => { const [id, d] = b.dataset.ad.split(':').map(Number); const inp = $(`[data-adi="${id}"]`, box); setA(id, Number(inp.value) + d); };
    for (const i of $$('[data-adi]', box)) { i.onchange = () => setA(Number(i.dataset.adi), Number(i.value) || 1); i.onkeydown = (e) => { if (e.key === 'Enter') i.blur(); }; }
  }
  PH.addrCtl = addrCtl; PH.bindAddr = bindAddr;

  /* ============================================================ MOJE LAMPY: address manager */
  function renderAddr(st) {
    const box = $('#st-addr'); if (!box) return;
    const fx = [...st.fixtures].sort((a, b) => a.address - b.address);
    const sig = JSON.stringify([fx.map((f) => [f.id, f.name, f.address, f.footprint, f.enabled !== false]), PH.lang]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    if (!fx.length) { box.innerHTML = `<div class="ad-top"><button class="btn primary" data-lib>${ic('layers')}<span>${esc(t('lb.find'))}</span></button></div>`; $('[data-lib]', box).onclick = () => PH.setupGo('library'); return; }
    const end = Math.max(64, ...fx.map((f) => f.address + f.footprint + 8)), span = Math.min(512, Math.ceil(end / 32) * 32);
    const conflictOf = (f) => fx.find((o) => o.id !== f.id && o.address < f.address + f.footprint && f.address < o.address + o.footprint && (o.address < f.address || (o.address === f.address && o.id < f.id)));
    const cols = ['#7b3ff2', '#14a9bd', '#f08a24', '#12a05a', '#e5484d', '#4f6cf0', '#c2410c', '#0e7490'];
    box.innerHTML = `<div class="ad-top"><button class="btn primary" data-lib>${ic('layers')}<span>${esc(t('lb.find'))}</span></button>
      <button class="btn" data-cal>${ic('channels')}<span>${esc(t('lb.unknown'))}</span></button></div>
      <section class="sgroup ad"><h3>${ic('channels')}${esc(t('ad.t'))}<span class="grow"></span><small>1–${span}</small></h3>
      <div class="ad-bar">${fx.map((f, i) => `<i style="left:${((f.address - 1) / span) * 100}%;width:${(f.footprint / span) * 100}%;background:${cols[i % cols.length]}" title="${esc(f.name)} ${pad3(f.address)}–${pad3(f.address + f.footprint - 1)}"></i>`).join('')}</div>
      ${fx.map((f, i) => { const c = conflictOf(f); return `<div class="ad-row${c ? ' bad' : ''}"><span class="ad-sw" style="background:${cols[i % cols.length]}"></span>
        <div><b>${esc(f.name)}</b><small>${esc(f.model || '')}</small></div>${addrCtl(f)}
        ${c ? `<span class="ad-c">${ic('warn')} ${esc(t('ad.conf'))}<small>${esc(t('ad.confS', { a: Math.max(f.address, c.address), b: Math.min(f.address + f.footprint, c.address + c.footprint) - 1, o: c.name }))}</small></span>
          <button class="btn sm primary" data-free="${f.id}">${esc(t('ad.free'))}</button>` : '<span class="grow"></span>'}
        <label class="switch" title="${esc(t(f.enabled !== false ? 'dock.off' : 'dock.on'))}"><input type="checkbox" data-en="${f.id}" ${f.enabled !== false ? 'checked' : ''}><span></span></label>
        <button class="btn sm" data-qt2="${f.id}">${ic('play')}<span>${esc(t('cl.quickTest'))}</span></button>
        <button class="btn sm ghost" data-pe="${f.id}">${ic('edit')}<span>${esc(t('ad.edit'))}</span></button></div>`; }).join('')}
    </section>`;
    for (const b of $$('[data-free]', box)) b.onclick = () => send({ type: 'free_address', id: Number(b.dataset.free) });
    for (const b of $$('[data-pe]', box)) b.onclick = () => openProfile(Number(b.dataset.pe));
    for (const b of $$('[data-qt2]', box)) b.onclick = () => quickTest(Number(b.dataset.qt2));
    bindAddr(box);
    $('[data-lib]', box).onclick = () => PH.setupGo('library');
    $('[data-cal]', box).onclick = () => PH.startCalibration({});
    for (const b of $$('[data-en]', box)) b.onchange = () => { send({ type: 'update_fixture', id: Number(b.dataset.en), enabled: b.checked }); send({ type: 'save' }); };
  }

  /* ============================================================ profile editor (fixture on stage) */
  const EROLES = ['pan', 'pan_fine', 'tilt', 'tilt_fine', 'speed', 'dimmer', 'shutter', 'red', 'green', 'blue', 'white', 'amber', 'uv', 'cwheel', 'gobo', 'gobo_rot',
    'prism', 'prism_rot', 'zoom', 'focus', 'iris', 'macro', 'auto', 'sound', 'spin', 'beam', 'strip', 'strip_speed', 'aux1', 'aux2', 'laser_r', 'laser_g', 'laser_b', 'reset', 'lamp', 'other', 'none'];
  const ROLE_TYPE = { pan: 'Pan', pan_fine: 'PanFine', tilt: 'Tilt', tilt_fine: 'TiltFine', speed: 'PanTiltSpeed', dimmer: 'Dimmer', shutter: 'Shutter', red: 'Red', green: 'Green', blue: 'Blue',
    white: 'White', amber: 'Amber', uv: 'UV', cwheel: 'ColorWheel', gobo: 'GoboWheel', gobo_rot: 'GoboRotation', prism: 'Prism', prism_rot: 'PrismRotation', zoom: 'Zoom', focus: 'Focus',
    iris: 'Iris', macro: 'Macro', auto: 'AutoProgram', sound: 'SoundProgram', spin: 'GoboRotation', beam: 'Other', strip: 'Macro', strip_speed: 'MotorSpeed', aux1: 'Strobe', aux2: 'Strobe',
    laser_r: 'LaserRed', laser_g: 'LaserGreen', laser_b: 'LaserBlue', reset: 'Reset', lamp: 'LampControl', other: 'Other', none: 'Unknown' };
  const roleName = (r) => { const k = `ro.${r}`, v = t(k); return v === k ? r : v; };
  function openProfile(id) {
    const f = S.st.fixtures.find((x) => x.id === id); if (!f) return;
    let rows = f.channels.map((r, i) => ({ role: r.startsWith('const:') ? 'other' : r, def: (f.defaults || {})[i] ?? (r.startsWith('const:') ? Number(r.slice(6)) : 0),
      caps: ((f.caps || {})[i] || []).map((c) => `${c[0]}-${c[1]} ${c[2]}`).join('\n') }));
    const md = modal(`<h3>${ic('edit')} ${esc(t('pe.t', { m: f.name }))}</h3><p class="lm-sub">${esc(t('pe.drag'))}</p>
      <div class="pe-t" id="pe-t"></div>
      <div class="lm-btns"><button class="btn" id="pe-add">${esc(t('pe.add'))}</button><span class="grow"></span><button class="btn ghost" data-x>${esc(t('lb.cancel'))}</button>
        <button class="btn" id="pe-learn">${ic('save')}<span>${esc(t('pe.learn'))}</span></button><button class="btn primary" id="pe-save">${esc(t('pe.save'))}</button></div>`, 'wide');
    let drag = null;
    const draw = () => {
      $('#pe-t', md.el).innerHTML = `<div class="pe-h"><span>${esc(t('pe.ch'))}</span><span>${esc(t('pe.fn'))}</span><span>${esc(t('pe.def'))}</span><span>${esc(t('pe.rng'))}</span><span></span></div>`
        + rows.map((r, i) => `<div class="pe-r" draggable="true" data-i="${i}"><span class="pe-n">⋮⋮ ${i + 1}</span>
          <select data-k="role">${EROLES.map((x) => `<option value="${x}" ${x === r.role ? 'selected' : ''}>${esc(roleName(x))}</option>`).join('')}</select>
          <input type="number" data-k="def" min="0" max="255" value="${r.def}"><textarea data-k="caps" rows="${Math.min(4, Math.max(1, r.caps.split('\n').length))}" placeholder="${esc(t('pe.rngPh'))}">${esc(r.caps)}</textarea>
          <button class="btn sm ghost" data-rm="${i}">✕</button></div>`).join('');
      for (const el of $$('.pe-r', md.el)) {
        const i = Number(el.dataset.i);
        for (const inp of $$('[data-k]', el)) inp.oninput = () => { rows[i][inp.dataset.k] = inp.dataset.k === 'def' ? Number(inp.value) || 0 : inp.value; };
        el.addEventListener('dragstart', () => { drag = i; el.classList.add('drag'); });
        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => { e.preventDefault(); if (drag === null || drag === i) return; const [x] = rows.splice(drag, 1); rows.splice(i, 0, x); drag = null; draw(); });
      }
      for (const b of $$('[data-rm]', md.el)) b.onclick = () => { rows.splice(Number(b.dataset.rm), 1); draw(); };
    };
    draw();
    $('#pe-add', md.el).onclick = () => { rows.push({ role: 'other', def: 0, caps: '' }); draw(); };
    const parseCaps = (txt) => txt.split('\n').map((l) => l.match(/^\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(.*)$/)).filter(Boolean)
      .map((m) => [Number(m[1]), Number(m[2]), m[3].trim(), /strob/i.test(m[3]) ? 'strobe' : /open|otwart/i.test(m[3]) ? 'open' : /sound|dźwi/i.test(m[3]) ? 'sound' : /auto|program/i.test(m[3]) ? 'auto' : /prism/i.test(m[3]) ? 'prism' : '', null]);
    $('#pe-save', md.el).onclick = () => {
      const caps = {}, defaults = {};
      rows.forEach((r, i) => { const c = parseCaps(r.caps); if (c.length) caps[i] = c; if (r.def && !['reset', 'lamp', 'laser_r', 'laser_g', 'laser_b'].includes(r.role)) defaults[i] = r.def; });
      send({ type: 'update_fixture', id: f.id, channels: rows.map((r) => r.role), caps, defaults });
      send({ type: 'save' });
      PH.toast(t('pe.saved')); md.close();
    };
    $('#pe-learn', md.el).onclick = async () => {
      const profile = { manufacturer: 'Moje', model: f.name, category: f.type, modes: [{ name: `${rows.length}CH`, channels: rows.map((r) => ({ name: roleName(r.role), type: ROLE_TYPE[r.role] || 'Other', default: r.def,
        capabilities: parseCaps(r.caps).map(([a, b, n, s]) => ({ min: a, max: b, name: n, semantic: s })) })) }] };
      await ask({ type: 'lib_save', profile, name: f.name }, 'saved');
      PH.toast(t('cl.saved', { m: f.name }));
    };
  }
  PH.openProfile = openProfile;
  PH.startCalibration = (o) => { PH.setupGo('dmxcal'); startCal(o || {}); };

  /* ------------------------------------------------------------ simple mode: only what most people need */
  const lsg = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  PH.simple = lsg('ph_simple') !== '0';
  PH.setSimple = (on) => {
    PH.simple = !!on;
    try { localStorage.setItem('ph_simple', on ? '1' : '0'); } catch (e) { /* private mode */ }
    document.body.classList.toggle('simple', PH.simple);
    if (PH.simple && S.tab === 'stagecam') PH.setTab('scene');
    if (PH.refreshSetup) PH.refreshSetup();
    if (PH.foldRender) PH.foldRender();
    const h = $('#st-home'); if (h) { h.dataset.sig = ''; if (S.st) paneHome(S.st, true); }
  };
  document.body.classList.toggle('simple', PH.simple);

  /* ------------------------------------------------------------ hooks */
  PH.setupPanes = PH.setupPanes || {};
  PH.setupPanes.home = paneHome;
  PH.setupPanes.library = paneLibrary;
  PH.setupPanes.dmxcal = paneCalib;
  PH.onState.push((st) => {
    if (!L.st && S.connected && !L.asked) { L.asked = true; send({ type: 'lib_state' }); }
    if (S.tab === 'setup') renderAddr(st);
  });
  // leaving the calibration pane never leaves test values on the lamp
  document.addEventListener('click', (e) => { const b = e.target.closest('.step-item'); if (b && b.dataset.step !== 'dmxcal' && CAL.timer) stopProbe(); }, true);
})();
