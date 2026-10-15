/* Lumo — Ustawienia (v4)
 *
 * A settings page like in a normal app: sections on the left in groups (Start · Sprzęt ·
 * Kalibracja · Sterowanie · Inne), on the right every parameter as a row "name + one sentence
 * what it does + control". Each device has its own editor with every parameter and its own
 * "Kalibruj" button. Status dots come from the live state (green = ready, orange = check it).
 */
(() => {
  const PH = window.PH;
  const { S, send, t, toast, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  PH.addI18n({
    pl: {
      'nav.start': 'Start', 'nav.hw': 'Sprzęt', 'nav.cal': 'Kalibracja', 'nav.ctl': 'Sterowanie', 'nav.other': 'Inne',
      'st.overview.n': 'Przegląd', 'st.overview.s': 'co jest gotowe',
      'st.overview.t': 'Przegląd', 'st.overview.d': 'Wszystkie ustawienia w jednym miejscu. Kliknij kafelek, żeby przejść dalej. Zielony znaczy gotowe, pomarańczowy — warto sprawdzić.',
      'st.dmx.n': 'Kabel DMX', 'st.dmx.s': 'połączenie z lampami',
      'st.dmx.t': 'Kabel DMX', 'st.dmx.d': 'Podłącz interfejs USB-DMX do komputera, a kabel DMX do pierwszej lampy. Wybierz rodzaj interfejsu i kliknij Połącz.',
      'st.lamps.n': 'Urządzenia', 'st.lamps.s': 'lampy, dym, lasery',
      'st.lamps.t': 'Urządzenia', 'st.lamps.d': 'Kliknij model w bibliotece, żeby go dodać. Przy każdym urządzeniu: Edytuj (wszystkie parametry), Kanały (co jest na którym kanale) i Kalibruj.',
      'st.camera.n': 'Kamery', 'st.camera.s': 'gesty i widok sceny',
      'st.camera.t': 'Kamery', 'st.camera.d': 'Każdej kamerze nadaj rolę: główna widzi Twoje dłonie, kamera sceny widzi całą scenę i ludzi na niej.',
      'st.lampcal.n': 'Kalibracja lamp', 'st.lampcal.s': 'ruch i kierunek',
      'st.lampcal.t': 'Kalibracja lamp', 'st.lampcal.d': 'Każde urządzenie ma swój przycisk Kalibruj. Kreator sprawdzi ruch i światło i nauczy się, gdzie jest lewo, prawo, góra i dół.',
      'st.hand.n': 'Kalibracja dłoni', 'st.hand.s': 'zasięg palca',
      'st.hand.t': 'Kalibracja dłoni', 'st.hand.d': 'Stań tam, skąd będziesz sterować. Kliknij Kalibruj, pokaż palec wskazujący i przez 6 sekund dotknij nim czterech rogów swojego wygodnego zasięgu.',
      'st.track.n': 'Światło na osobę', 'st.track.s': 'celność śledzenia',
      'st.track.t': 'Światło na osobę', 'st.track.d': 'Stań w kilku miejscach sceny, naprowadź światło dokładnie na siebie i potwierdź. Potem światło trafia w osobę w każdym miejscu.',
      'st.stage.n': 'Scena', 'st.stage.s': 'wymiary i podłoga',
      'st.stage.t': 'Scena', 'st.stage.d': 'Wymiary sceny i mapa podłogi z kamery. Potrzebne do celowania w punkt na podłodze i do śledzenia ludzi.',
      'st.control.n': 'Gesty i śledzenie', 'st.control.s': 'co steruje światłem',
      'st.control.t': 'Gesty i śledzenie', 'st.control.d': 'Jak dłoń i śledzenie sterują lampami: tryb, zasięg ruchu, czułość dłoni i lustro kamery.',
      'st.speed.n': 'Ruch i płynność', 'st.speed.s': 'szybkość reakcji',
      'st.speed.t': 'Ruch i płynność', 'st.speed.d': 'Jak szybko światło reaguje i jak płynnie się porusza. Wybierz gotowy profil albo ustaw suwakami.',
      'st.keys.n': 'Przyciski i MIDI', 'st.keys.s': 'skróty i kontroler',
      'st.keys.t': 'Przyciski i MIDI', 'st.keys.d': 'Przypisz klawisze albo przyciski i pokrętła kontrolera MIDI do akcji: blackout, flash, efekty, kolory, autopilot, reflektor.',
      'st.effects.n': 'Dym i lasery', 'st.effects.s': 'maszyna dymna, bezpieczeństwo',
      'st.effects.t': 'Dym i lasery', 'st.effects.d': 'Maszyna dymna: moc, automatyczny dym i test. Lasery: zawsze wyłączone po starcie, włączasz je tylko tutaj albo na dolnym pasku.',
      'st.general.n': 'Ogólne', 'st.general.s': 'język, master, zapis',
      'st.general.t': 'Ogólne', 'st.general.d': 'Język, jasność całego światła, tempo efektów, zapis ustawień i przewodnik.',
      'st.adv.n': 'Zaawansowane', 'st.adv.s': 'test kanałów, monitor DMX',
      'st.adv.t': 'Zaawansowane', 'st.adv.d': 'Test pojedynczych kanałów DMX i podgląd tego, co program wysyła do lamp.',
      'st.guide': 'Przewodnik po programie', 'st.ch': 'Kanały', 'st.edit': 'Edytuj', 'st.close': 'Zamknij', 'st.cal': 'Kalibruj',
      'st.dmx.ok': 'Połączono: {s}', 'st.dmx.sim': 'Tryb wirtualny — lampy nie dostają sygnału', 'st.dmx.err': 'Brak połączenia: {s}',
      'st.dmx.blink': 'Mrugnij wszystkimi lampami',
      'st.lamps.none': 'Nie ma jeszcze żadnego urządzenia. Wybierz model z biblioteki poniżej.', 'st.lamps.addr': 'Adres',
      'st.lamps.ch': '{n} kanałów', 'st.lamps.blink': 'Mrugnij', 'st.lamps.del': 'Usuń', 'st.lamps.delQ': 'Usunąć urządzenie „{n}”?',
      'st.lamps.conflict': 'Adresy nachodzą na siebie: {s}', 'st.lamps.in3d': 'Pokaż w 3D',
      'st.cal.all': 'Kalibruj wszystkie po kolei', 'st.cal.home': 'Wszystkie na środek',
      'st.cal.ok': 'skalibrowana', 'st.cal.no': 'nieskalibrowana', 'st.cal.inv': 'odwrócony {a}',
      'st.cal.none': 'Nie ma ruchomych głów — ten krok możesz pominąć.', 'st.cal.next': 'Następna lampa: {n}', 'st.cal.test': 'test funkcji',
      'st.cam.ok': 'Kamera działa: {s}', 'st.cam.err': 'Brak obrazu: {s}', 'st.cam.main': 'Kamera główna — ustawienia',
      'st.hand.start': 'Kalibruj (6 s)', 'st.hand.reset': 'Przywróć domyślny', 'st.hand.test': 'Wypróbuj: celuj palcem',
      'st.hand.ok': 'Zasięg dłoni zapisany', 'st.hand.def': 'Zasięg domyślny (cały kadr bez marginesów)',
      'st.hand.go': 'Dotknij palcem czterech rogów… {s} s', 'st.hand.small': 'Za mały ruch — spróbuj jeszcze raz, szerzej',
      'st.hand.nohand': 'Nie widzę palca wskazującego', 'st.hand.hui': 'Kalibruj kursor dłoni (sterowanie programem)',
      'st.hand.tip1': 'Kamera na wysokości klatki piersiowej, 1,5–3 m od Ciebie.',
      'st.hand.tip2': 'Dobre światło na dłonie, bez mocnego światła za plecami.',
      'st.hand.tip3': 'Pokazuj palec spokojnie; ramię może być lekko zgięte.',
      'sp.instant': 'Błyskawicznie', 'sp.instant.d': 'Zero wygładzania. Do szybkich efektów, trochę drży.',
      'sp.fast': 'Szybko (zalecane)', 'sp.fast.d': 'Natychmiastowa reakcja, bez drgań.',
      'sp.smooth': 'Płynnie', 'sp.smooth.d': 'Miękkie, eleganckie ruchy. Mała bezwładność.',
      'sp.cinema': 'Kinowo', 'sp.cinema.d': 'Wolne, filmowe przejazdy. Do spokojnych momentów.',
      'sp.pos': 'Płynność ruchu', 'sp.pos.d': 'W lewo płynniej, w prawo natychmiast.',
      'sp.val': 'Płynność jasności i koloru', 'sp.val.d': 'Jak szybko zmieniają się jasność i kolor.',
      'sp.motor': 'Silniki lampy', 'sp.motor.d': 'Kanał prędkości ruchu lampy: 0 = najszybciej, 255 = najwolniej.',
      'sp.test': 'Test ruchu (4 s)', 'sp.custom': 'Własne ustawienia', 'sp.profile': 'Profil',
      'stg.floor': 'Kalibruj podłogę', 'stg.floorReset': 'Przywróć domyślną', 'stg.stagecam': 'Kamera sceny',
      'stg.w': 'Szerokość sceny', 'stg.w.d': 'Od lewej do prawej krawędzi, w metrach.',
      'stg.dp': 'Głębokość sceny', 'stg.dp.d': 'Od przodu do tyłu, w metrach.',
      'stg.h': 'Wysokość konstrukcji', 'stg.h.d': 'Na jakiej wysokości wiszą lampy (truss).',
      'stg.a': 'Wysokość celu', 'stg.a.d': 'Na jaką wysokość celuje śledzenie osoby (np. 1,2 m = tułów).',
      'stg.floorT': 'Mapa podłogi z kamery', 'stg.floorD': 'Zaznacz cztery rogi podłogi na obrazie kamery — wtedy celowanie w punkt i śledzenie trafiają dokładnie.',
      'stg.floorOk': 'Podłoga skalibrowana', 'stg.floorNo': 'Mapa domyślna (cały kadr = scena)',
      'ctl.mode': 'Tryb sterowania', 'ctl.mode.d': 'Gesty dłonią, śledzenie osoby albo ręczne celowanie myszą.',
      'ctl.m.gesture': 'Gesty', 'ctl.m.track': 'Śledzenie', 'ctl.m.manual': 'Ręcznie',
      'ctl.scope': 'Gesty sterują', 'ctl.scope.d': 'Tylko wybraną lampą albo wszystkimi lampami naraz.',
      'ctl.follow': 'Śledzenie steruje', 'ctl.follow.d': 'Która lampa jedzie za śledzoną osobą.',
      'ctl.active': 'Wybraną lampą', 'ctl.all': 'Wszystkimi',
      'ctl.aim': 'Celowanie palcem', 'ctl.aim.d': 'Proste: palec pokazuje kierunek. W punkt: światło trafia w miejsce na podłodze (po kalibracji podłogi).',
      'ctl.aim.direct': 'Proste', 'ctl.aim.stage': 'W punkt na scenie',
      'ctl.span': 'Zakres ruchu', 'ctl.span.d': 'Ile stopni obrotu (pan) i pochylenia (tilt) daje pełny ruch dłoni.',
      'ctl.sens': 'Czułość dłoni', 'ctl.sens.d': 'W lewo stabilniej, w prawo szybciej (może lekko drgać).',
      'ctl.beta': 'Nadążanie za szybkim ruchem', 'ctl.beta.d': 'Jak mocno program dogania szybki ruch dłoni.',
      'ctl.mirror': 'Lustro kamery', 'ctl.mirror.d': 'Obraz jak w lustrze: ruch dłoni w prawo = w prawo na ekranie.',
      'ctl.handcal': 'Zasięg dłoni', 'ctl.handcal.d': 'Mały ruch dłoni obejmuje całą scenę po kalibracji zasięgu.',
      'sm.title': 'Maszyna dymna', 'sm.none': 'Nie masz maszyny dymnej. Dodasz ją w Urządzeniach (biblioteka → Dym).',
      'sm.level': 'Moc dymu', 'sm.level.d': 'Ile dymu daje przycisk Dym i automat.',
      'sm.auto': 'Dym automatycznie', 'sm.auto.d': 'Krótki dym co kilka minut, żeby światło było widać w powietrzu.',
      'sm.every': 'Co ile', 'sm.every.d': 'Odstęp między automatycznymi dymami.', 'sm.dur': 'Na jak długo', 'sm.dur.d': 'Czas jednego automatycznego dymu.',
      'sm.test': 'Dym 3 s', 'sm.min': 'min', 'sm.s': 's',
      'ls.title': 'Lasery', 'ls.arm': 'Lasery uzbrojone', 'ls.arm.d': 'Po starcie programu lasery są zawsze wyłączone. Włącz tylko, gdy nikt nie patrzy w wiązkę.',
      'ls.none': 'Nie masz laserów.',
      'gn.lang': 'Język', 'gn.lang.d': 'Język całego programu.',
      'gn.master': 'Master', 'gn.master.d': 'Jasność całego światła naraz (to samo co suwak Master na dole).',
      'gn.tempo': 'Tempo efektów', 'gn.tempo.d': 'Szybkość wszystkich efektów naraz; 1× = normalnie.',
      'gn.save': 'Zapisz ustawienia', 'gn.save.d': 'Ustawienia zapisują się same, ale możesz zapisać je teraz ręcznie.',
      'gn.guide': 'Przewodnik', 'gn.guide.d': 'Krótka wycieczka po programie: co jest gdzie i do czego służy.',
      'gn.show': 'Pokaz testowy', 'gn.show.d': '10 sekund ruchu, kolorów i jasności na wszystkich lampach.',
      'ov.ready': 'Gotowe {n} z {m}', 'ov.allOk': 'Wszystko gotowe — miłego pokazu!', 'ov.left': 'Zostało do sprawdzenia: {n}',
      'ov.dmxSim': 'Tryb wirtualny', 'ov.dmxErr': 'Brak połączenia', 'ov.devs': 'Urządzeń: {n}', 'ov.noDevs': 'Brak urządzeń',
      'ov.calN': 'Skalibrowane {n} z {m}', 'ov.noHeads': 'Brak ruchomych głów', 'ov.camOk': 'Obraz {s}', 'ov.camNo': 'Brak obrazu',
      'ov.handOk': 'Zasięg zapisany', 'ov.handNo': 'Zasięg domyślny', 'ov.trackN': 'Zapisane miejsca: {n}', 'ov.trackNo': 'Nie skalibrowano',
      'ov.keysN': 'Przypisane: {n}', 'ov.keysNo': 'Brak przycisków', 'ov.stage': '{w} × {d} m', 'ov.floor': 'podłoga skalibrowana',
      'lib.title': 'Biblioteka urządzeń — kliknij, żeby dodać', 'lib.mine': 'Twoje urządzenia', 'lib.all': 'Wszystkie',
      'lib.moving_head': 'Głowice', 'lib.par': 'PAR / wash', 'lib.bar': 'Belki / efekty', 'lib.strobe': 'Strobo', 'lib.smoke': 'Dym', 'lib.laser': 'Lasery',
      'lib.custom': 'Własny profil…', 'lib.added': 'Dodano: {n} (adres {a})',
      'cam.scan': 'Szukaj kamer', 'cam.scanning': 'Szukam kamer…', 'cam.main': 'Główna (gesty)', 'cam.stage': 'Sceny', 'cam.none': 'Nie używaj',
      'cam.win': 'Windows widzi: {s}', 'cam.inuse': 'w użyciu', 'cam.url': 'Kamera IP albo telefon przez Wi-Fi', 'cam.asMain': 'Jako główna', 'cam.asStage': 'Jako sceny',
      'cam.needMain': 'Kamera główna musi zostać — najpierw wybierz inną kamerę jako główną',
      'cam.mainIsStage': 'Ta kamera jest główna. Ustaw inną jako główną, a tę jako kamerę sceny.',
      'pc.src': 'Kamera', 'pc.srcMain': 'główna', 'pc.srcStage': 'sceny', 'pc.lamp': 'Lampa',
      'pc.see': 'Widzę Cię — stopy w punkcie {x}, {y}', 'pc.nosee': 'Nie widzę osoby — stań w kadrze całą sylwetką',
      'pc.aim': 'Naprowadź światło na siebie', 'pc.aimH': 'Strzałki na ekranie albo na klawiaturze (Shift = dokładnie).',
      'pc.ok': 'Światło jest na mnie — zapisz', 'pc.okH': 'Albo Enter, albo kciuk w górę przez 1 s.',
      'pc.pts': 'Zapisane miejsca: {n}', 'pc.err': 'dokładność ± {e}°', 'pc.need': 'Potrzeba co najmniej 3 miejsc (najlepiej 5: cztery rogi i środek).',
      'pc.clear': 'Wyczyść miejsca tej lampy', 'pc.test': 'Test: światło za mną', 'pc.testStop': 'Zakończ test',
      'pc.saved': 'Zapisano miejsce {n}', 'pc.fine': 'dokładnie',
      'de.basic': 'Podstawowe', 'de.name': 'Nazwa', 'de.name.d': 'Jak urządzenie nazywa się w programie.',
      'de.addr': 'Adres DMX', 'de.addr.d': 'Taki sam jak ustawiony na urządzeniu (np. A001 = 1).',
      'de.type': 'Rodzaj', 'de.type.d': 'Od rodzaju zależy wygląd w 3D i co robią efekty.',
      'de.mount': 'Montaż', 'de.mount.d': 'Wisi na konstrukcji czy stoi na podłodze.', 'de.hang': 'Wisząca', 'de.floor': 'Stojąca',
      'de.place': 'Pozycja na scenie', 'de.pos': 'Miejsce', 'de.pos.d': 'X w lewo/prawo, wysokość, Z do tyłu (−) / do przodu (+), w metrach.',
      'de.yaw': 'Obrót podstawy', 'de.yaw.d': 'O ile stopni lampa jest obrócona względem przodu sceny.',
      'de.move': 'Ruch', 'de.pan': 'Zakres obrotu (pan)', 'de.pan.d': 'Z instrukcji lampy, zwykle 540°.', 'de.tilt': 'Zakres pochylenia (tilt)', 'de.tilt.d': 'Z instrukcji lampy, zwykle 180–270°.',
      'de.invp': 'Odwróć obrót', 'de.invp.d': 'Gdy lampa jedzie w prawo, a powinna w lewo.', 'de.invt': 'Odwróć pochylenie', 'de.invt.d': 'Gdy lampa jedzie w górę, a powinna w dół.',
      'de.p16': 'Dokładny obrót (16 bit)', 'de.p16.d': 'Lampa ma kanał „pan fine”.', 'de.t16': 'Dokładne pochylenie (16 bit)', 'de.t16.d': 'Lampa ma kanał „tilt fine”.',
      'de.light': 'Światło', 'de.beam': 'Kąt wiązki', 'de.beam.d': 'Szerokość snopu światła (tylko wygląd w 3D).',
      'de.rgb': 'Kolory RGB', 'de.rgb.d': 'Urządzenie ma diody czerwoną, zieloną i niebieską.',
      'de.shut': 'Migawka otwarta', 'de.shut.d': 'Wartość kanału strobo, przy której światło świeci bez migania.',
      'de.strobe': 'Strobo: wolno … szybko', 'de.strobe.d': 'Zakres wartości kanału strobo z instrukcji.',
      'de.saved': 'Zapisano', 'de.model': 'Model',
      'st.ui.n': 'Wygląd i start', 'st.ui.s': 'wielkość, animacje, start',
      'st.ui.t': 'Wygląd i start', 'st.ui.d': 'Jak program wygląda i co widzisz po uruchomieniu. Te ustawienia są zapisane w tej przeglądarce.',
      'st.backup.n': 'Kopia zapasowa', 'st.backup.s': 'pobierz i wczytaj ustawienia',
      'st.backup.t': 'Kopia zapasowa', 'st.backup.d': 'Zapisz wszystkie ustawienia do pliku i wczytaj je później albo na innym komputerze.',
      'st.diag.n': 'Diagnostyka', 'st.diag.s': 'czy wszystko działa',
      'st.diag.t': 'Diagnostyka', 'st.diag.d': 'Stan każdej części programu na żywo, z podpowiedzią, co zrobić, gdy coś nie działa.',
      'ui.zoom': 'Wielkość interfejsu', 'ui.zoom.d': 'Większe napisy i przyciski na dużym ekranie, mniejsze na laptopie.',
      'ui.motion': 'Animacje', 'ui.motion.d': 'Ograniczone = bez ruchomych przejść (spokojniej i szybciej na słabszym komputerze).',
      'ui.full': 'Pełne', 'ui.calm': 'Ograniczone',
      'ui.start': 'Zakładka po uruchomieniu', 'ui.start.d': 'Co widzisz zaraz po otwarciu programu.', 'ui.last': 'Ostatnio używana',
      'ui.hints': 'Podpowiedzi na ekranie', 'ui.hints.d': 'Krótkie wskazówki na scenie 3D i na obrazie kamery.',
      'ui.cam': 'Obraz kamery w zakładce Dłoń', 'ui.cam.d': 'Pokazuj obraz z kamery pod szkieletem dłoni.',
      'ui.tour': 'Przewodnik przy następnym starcie', 'ui.tour.d': 'Przewodnik pokaże się sam przy następnym otwarciu programu.', 'ui.tourBtn': 'Pokaż przy starcie', 'ui.tourOk': 'Przewodnik pokaże się przy następnym starcie',
      'bk.down': 'Pobierz kopię ustawień', 'bk.down.d': 'Urządzenia, kalibracje, gesty, przyciski, sceny i wszystkie ustawienia w jednym pliku .json.', 'bk.downBtn': 'Pobierz plik',
      'bk.up': 'Wczytaj kopię z pliku', 'bk.up.d': 'Zastępuje obecne ustawienia ustawieniami z pliku. Obecne zostają zachowane jako „poprzednie”.', 'bk.upBtn': 'Wybierz plik…',
      'bk.confirm': 'Wczytać ustawienia z pliku „{n}”? Urządzeń w pliku: {d}. Obecne ustawienia zostaną zachowane jako poprzednie.',
      'bk.bad': 'To nie jest plik ustawień Lumo',
      'bk.prev': 'Przywróć poprzednie ustawienia', 'bk.prev.d': 'Cofa ostatnie wczytanie kopii.', 'bk.prevBtn': 'Przywróć', 'bk.prevQ': 'Wrócić do ustawień sprzed ostatniego wczytania kopii?',
      'bk.other': 'Pokazy i własne efekty', 'bk.other.d': 'Pokazy są w folderze „shows”, własne efekty w pliku „presets.json”. Przenosząc program, skopiuj je razem z kopią.',
      'bk.pack': 'Program na inny komputer', 'bk.pack.d': 'Uruchom „pakuj.bat” w folderze programu — zrobi plik ZIP, który instalujesz przez „instaluj.bat”.',
      'dg.cam': 'Kamera główna', 'dg.hand': 'Rozpoznawanie dłoni', 'dg.dmx': 'Kabel DMX', 'dg.dev': 'Urządzenia', 'dg.stage': 'Kamera sceny', 'dg.ws': 'Połączenie z programem', 'dg.las': 'Lasery',
      'dg.camOk': '{s} · {f} kl./s', 'dg.camLow': 'Mało klatek na sekundę: gesty reagują wolniej. W aplikacji telefonu (Iriun) ustaw 30 fps i zadbaj o dobre światło.',
      'dg.camOff': 'Brak obrazu', 'dg.camOffT': 'Sprawdź kamerę w Ustawienia → Kamery albo podłącz ją ponownie.',
      'dg.handOk': '{ms} ms na klatkę', 'dg.handSlow': 'Komputer nie nadąża z rozpoznawaniem — zamknij inne programy.', 'dg.handNo': 'Model dłoni się nie wczytał.',
      'dg.dmxSim': 'Tryb wirtualny', 'dg.dmxSimT': 'Lampy nie dostają sygnału — połącz kabel w Ustawienia → Kabel DMX.', 'dg.dmxErr': 'Brak połączenia', 'dg.dmxErrT': 'Podłącz kabel USB-DMX i kliknij Połącz w Kabel DMX. Tylko jeden program naraz może używać kabla.',
      'dg.devN': '{n} · adresy w porządku', 'dg.devNone': 'Brak urządzeń', 'dg.devNoneT': 'Dodaj urządzenia w Ustawienia → Urządzenia.', 'dg.devConf': 'Adresy nachodzą: {s}', 'dg.devConfT': 'Użyj „Ustaw adresy po kolei” w Urządzeniach albo popraw adresy ręcznie.',
      'dg.stageOff': 'nieużywana', 'dg.stageT': 'Kamera sceny nie daje obrazu — sprawdź ją w Kamery albo ustaw „Nie używaj”.',
      'dg.wsOk': '{n} aktualizacji na sekundę', 'dg.wsLow': 'Program odświeża się wolno — zamknij inne karty z programem.',
      'dg.lasOff': 'wyłączone (bezpiecznie)', 'dg.lasOn': 'uzbrojone', 'dg.lasOnT': 'Wyłącz, gdy ktoś może patrzeć w wiązkę.',
      'dg.test': 'Test systemu', 'dg.copy': 'Kopiuj raport', 'dg.copied': 'Raport skopiowany do schowka', 'dg.testing': 'Testuję… lampy mrugną przez 2 s',
      'dg.resOk': 'Wszystko działa', 'dg.resBad': 'Do sprawdzenia: {n}',
      'st.autoAddr': 'Ustaw adresy po kolei', 'st.autoAddrQ': 'Nadać adresy po kolei od 1, bez nakładania? Potem ustaw te same adresy na urządzeniach (menu albo przełączniki DIP).',
      'st.autoAddrOk': 'Nowe adresy: {s}', 'st.dup': 'Duplikuj',
    },
    it: {
      'nav.start': 'Inizio', 'nav.hw': 'Hardware', 'nav.cal': 'Calibrazione', 'nav.ctl': 'Controllo', 'nav.other': 'Altro',
      'st.overview.n': 'Panoramica', 'st.overview.s': 'cosa è pronto',
      'st.overview.t': 'Panoramica', 'st.overview.d': 'Tutte le impostazioni in un posto. Clicca una scheda per andare avanti. Verde = pronto, arancione = da controllare.',
      'st.dmx.n': 'Cavo DMX', 'st.dmx.s': 'collegamento alle luci',
      'st.dmx.t': 'Cavo DMX', 'st.dmx.d': 'Collega l’interfaccia USB-DMX al computer e il cavo DMX alla prima luce. Scegli il tipo di interfaccia e premi Collega.',
      'st.lamps.n': 'Dispositivi', 'st.lamps.s': 'luci, fumo, laser',
      'st.lamps.t': 'Dispositivi', 'st.lamps.d': 'Clicca un modello nella libreria per aggiungerlo. Per ogni dispositivo: Modifica (tutti i parametri), Canali (cosa c’è su ogni canale) e Calibra.',
      'st.camera.n': 'Camere', 'st.camera.s': 'gesti e vista del palco',
      'st.camera.t': 'Camere', 'st.camera.d': 'Dai un ruolo a ogni camera: la principale vede le tue mani, la camera palco vede tutto il palco e le persone.',
      'st.lampcal.n': 'Calibrazione luci', 'st.lampcal.s': 'movimento e direzione',
      'st.lampcal.t': 'Calibrazione luci', 'st.lampcal.d': 'Ogni dispositivo ha il suo pulsante Calibra. La procedura prova movimento e luce e impara dove sono sinistra, destra, alto e basso.',
      'st.hand.n': 'Calibrazione mano', 'st.hand.s': 'raggio del dito',
      'st.hand.t': 'Calibrazione mano', 'st.hand.d': 'Mettiti dove controllerai le luci. Premi Calibra, mostra l’indice e per 6 secondi tocca i quattro angoli del tuo raggio comodo.',
      'st.track.n': 'Luce sulla persona', 'st.track.s': 'precisione inseguimento',
      'st.track.t': 'Luce sulla persona', 'st.track.d': 'Mettiti in alcuni punti del palco, porta la luce esattamente su di te e conferma. Poi la luce colpisce la persona ovunque.',
      'st.stage.n': 'Palco', 'st.stage.s': 'misure e pavimento',
      'st.stage.t': 'Palco', 'st.stage.d': 'Misure del palco e mappa del pavimento dalla camera. Servono per puntare un punto a terra e per seguire le persone.',
      'st.control.n': 'Gesti e inseguimento', 'st.control.s': 'cosa controlla la luce',
      'st.control.t': 'Gesti e inseguimento', 'st.control.d': 'Come la mano e l’inseguimento controllano le luci: modalità, ampiezza, sensibilità e specchio della camera.',
      'st.speed.n': 'Movimento e fluidità', 'st.speed.s': 'velocità di reazione',
      'st.speed.t': 'Movimento e fluidità', 'st.speed.d': 'Quanto velocemente reagisce la luce e quanto è fluido il movimento. Scegli un profilo o usa i cursori.',
      'st.keys.n': 'Tasti e MIDI', 'st.keys.s': 'scorciatoie e controller',
      'st.keys.t': 'Tasti e MIDI', 'st.keys.d': 'Assegna tasti o pulsanti e manopole MIDI alle azioni: blackout, flash, effetti, colori, autopilota, occhio di bue.',
      'st.effects.n': 'Fumo e laser', 'st.effects.s': 'macchina del fumo, sicurezza',
      'st.effects.t': 'Fumo e laser', 'st.effects.d': 'Macchina del fumo: potenza, fumo automatico e prova. Laser: sempre spenti all’avvio, si accendono solo qui o nella barra in basso.',
      'st.general.n': 'Generale', 'st.general.s': 'lingua, master, salvataggio',
      'st.general.t': 'Generale', 'st.general.d': 'Lingua, luminosità generale, tempo degli effetti, salvataggio e guida.',
      'st.adv.n': 'Avanzate', 'st.adv.s': 'test canali, monitor DMX',
      'st.adv.t': 'Avanzate', 'st.adv.d': 'Test dei singoli canali DMX e anteprima di ciò che il programma invia alle luci.',
      'st.guide': 'Guida al programma', 'st.ch': 'Canali', 'st.edit': 'Modifica', 'st.close': 'Chiudi', 'st.cal': 'Calibra',
      'st.dmx.ok': 'Collegato: {s}', 'st.dmx.sim': 'Modalità virtuale — le luci non ricevono segnale', 'st.dmx.err': 'Nessuna connessione: {s}',
      'st.dmx.blink': 'Fai lampeggiare tutte le luci',
      'st.lamps.none': 'Non c’è ancora nessun dispositivo. Scegli un modello dalla libreria qui sotto.', 'st.lamps.addr': 'Indirizzo',
      'st.lamps.ch': '{n} canali', 'st.lamps.blink': 'Lampeggia', 'st.lamps.del': 'Elimina', 'st.lamps.delQ': 'Eliminare il dispositivo „{n}”?',
      'st.lamps.conflict': 'Indirizzi sovrapposti: {s}', 'st.lamps.in3d': 'Mostra in 3D',
      'st.cal.all': 'Calibra tutte in fila', 'st.cal.home': 'Tutte al centro',
      'st.cal.ok': 'calibrata', 'st.cal.no': 'non calibrata', 'st.cal.inv': '{a} invertito',
      'st.cal.none': 'Nessuna testa mobile — puoi saltare questo passo.', 'st.cal.next': 'Prossima luce: {n}', 'st.cal.test': 'prova funzioni',
      'st.cam.ok': 'La camera funziona: {s}', 'st.cam.err': 'Nessuna immagine: {s}', 'st.cam.main': 'Camera principale — impostazioni',
      'st.hand.start': 'Calibra (6 s)', 'st.hand.reset': 'Ripristina predefinito', 'st.hand.test': 'Prova: punta con il dito',
      'st.hand.ok': 'Raggio della mano salvato', 'st.hand.def': 'Raggio predefinito (tutta l’immagine senza margini)',
      'st.hand.go': 'Tocca i quattro angoli con il dito… {s} s', 'st.hand.small': 'Movimento troppo piccolo — riprova, più ampio',
      'st.hand.nohand': 'Non vedo l’indice', 'st.hand.hui': 'Calibra il cursore della mano (controllo del programma)',
      'st.hand.tip1': 'Camera all’altezza del petto, a 1,5–3 m da te.',
      'st.hand.tip2': 'Buona luce sulle mani, niente luce forte alle spalle.',
      'st.hand.tip3': 'Mostra il dito con calma; il braccio può restare un po’ piegato.',
      'sp.instant': 'Istantaneo', 'sp.instant.d': 'Nessuna attenuazione. Per effetti veloci, trema un po’.',
      'sp.fast': 'Veloce (consigliato)', 'sp.fast.d': 'Reazione immediata, senza tremolio.',
      'sp.smooth': 'Fluido', 'sp.smooth.d': 'Movimenti morbidi ed eleganti. Poca inerzia.',
      'sp.cinema': 'Cinema', 'sp.cinema.d': 'Movimenti lenti da film. Per i momenti calmi.',
      'sp.pos': 'Fluidità del movimento', 'sp.pos.d': 'A sinistra più fluido, a destra immediato.',
      'sp.val': 'Fluidità di luminosità e colore', 'sp.val.d': 'Quanto velocemente cambiano luminosità e colore.',
      'sp.motor': 'Motori della luce', 'sp.motor.d': 'Canale velocità movimento: 0 = il più veloce, 255 = il più lento.',
      'sp.test': 'Prova movimento (4 s)', 'sp.custom': 'Impostazioni personali', 'sp.profile': 'Profilo',
      'stg.floor': 'Calibra pavimento', 'stg.floorReset': 'Ripristina predefinita', 'stg.stagecam': 'Camera palco',
      'stg.w': 'Larghezza palco', 'stg.w.d': 'Dal bordo sinistro al destro, in metri.',
      'stg.dp': 'Profondità palco', 'stg.dp.d': 'Da davanti a dietro, in metri.',
      'stg.h': 'Altezza struttura', 'stg.h.d': 'A che altezza sono appese le luci (truss).',
      'stg.a': 'Altezza del bersaglio', 'stg.a.d': 'A che altezza punta l’inseguimento (es. 1,2 m = busto).',
      'stg.floorT': 'Mappa del pavimento dalla camera', 'stg.floorD': 'Segna i quattro angoli del pavimento nell’immagine — così puntamento e inseguimento sono precisi.',
      'stg.floorOk': 'Pavimento calibrato', 'stg.floorNo': 'Mappa predefinita (tutta l’immagine = palco)',
      'ctl.mode': 'Modalità di controllo', 'ctl.mode.d': 'Gesti con la mano, inseguimento della persona o puntamento manuale col mouse.',
      'ctl.m.gesture': 'Gesti', 'ctl.m.track': 'Inseguimento', 'ctl.m.manual': 'Manuale',
      'ctl.scope': 'I gesti controllano', 'ctl.scope.d': 'Solo la luce scelta o tutte le luci insieme.',
      'ctl.follow': 'L’inseguimento controlla', 'ctl.follow.d': 'Quale luce segue la persona.',
      'ctl.active': 'La luce scelta', 'ctl.all': 'Tutte',
      'ctl.aim': 'Puntare con il dito', 'ctl.aim.d': 'Semplice: il dito indica la direzione. Sul punto: la luce colpisce un punto a terra (dopo la calibrazione del pavimento).',
      'ctl.aim.direct': 'Semplice', 'ctl.aim.stage': 'Sul punto del palco',
      'ctl.span': 'Ampiezza del movimento', 'ctl.span.d': 'Quanti gradi di rotazione (pan) e inclinazione (tilt) per il movimento completo della mano.',
      'ctl.sens': 'Sensibilità della mano', 'ctl.sens.d': 'A sinistra più stabile, a destra più veloce (può tremare un po’).',
      'ctl.beta': 'Seguire i movimenti veloci', 'ctl.beta.d': 'Quanto il programma insegue un movimento rapido della mano.',
      'ctl.mirror': 'Specchio della camera', 'ctl.mirror.d': 'Immagine a specchio: mano a destra = destra sullo schermo.',
      'ctl.handcal': 'Raggio della mano', 'ctl.handcal.d': 'Dopo la calibrazione basta un piccolo movimento per coprire il palco.',
      'sm.title': 'Macchina del fumo', 'sm.none': 'Non hai una macchina del fumo. Aggiungila in Dispositivi (libreria → Fumo).',
      'sm.level': 'Potenza fumo', 'sm.level.d': 'Quanto fumo danno il pulsante Fumo e l’automatico.',
      'sm.auto': 'Fumo automatico', 'sm.auto.d': 'Un po’ di fumo ogni qualche minuto, per vedere la luce nell’aria.',
      'sm.every': 'Ogni quanto', 'sm.every.d': 'Intervallo tra i fumi automatici.', 'sm.dur': 'Per quanto', 'sm.dur.d': 'Durata di un fumo automatico.',
      'sm.test': 'Fumo 3 s', 'sm.min': 'min', 'sm.s': 's',
      'ls.title': 'Laser', 'ls.arm': 'Laser armati', 'ls.arm.d': 'All’avvio i laser sono sempre spenti. Accendili solo se nessuno guarda il raggio.',
      'ls.none': 'Non hai laser.',
      'gn.lang': 'Lingua', 'gn.lang.d': 'La lingua di tutto il programma.',
      'gn.master': 'Master', 'gn.master.d': 'Luminosità di tutta la luce insieme (come il cursore Master in basso).',
      'gn.tempo': 'Tempo degli effetti', 'gn.tempo.d': 'Velocità di tutti gli effetti insieme; 1× = normale.',
      'gn.save': 'Salva le impostazioni', 'gn.save.d': 'Le impostazioni si salvano da sole, ma puoi salvarle ora.',
      'gn.guide': 'Guida', 'gn.guide.d': 'Un breve giro del programma: cosa c’è e a cosa serve.',
      'gn.show': 'Show di prova', 'gn.show.d': '10 secondi di movimento, colori e luminosità su tutte le luci.',
      'ov.ready': 'Pronto {n} su {m}', 'ov.allOk': 'Tutto pronto — buono show!', 'ov.left': 'Da controllare: {n}',
      'ov.dmxSim': 'Modalità virtuale', 'ov.dmxErr': 'Nessuna connessione', 'ov.devs': 'Dispositivi: {n}', 'ov.noDevs': 'Nessun dispositivo',
      'ov.calN': 'Calibrate {n} su {m}', 'ov.noHeads': 'Nessuna testa mobile', 'ov.camOk': 'Immagine {s}', 'ov.camNo': 'Nessuna immagine',
      'ov.handOk': 'Raggio salvato', 'ov.handNo': 'Raggio predefinito', 'ov.trackN': 'Punti salvati: {n}', 'ov.trackNo': 'Non calibrato',
      'ov.keysN': 'Assegnati: {n}', 'ov.keysNo': 'Nessun tasto', 'ov.stage': '{w} × {d} m', 'ov.floor': 'pavimento calibrato',
      'lib.title': 'Libreria dispositivi — clicca per aggiungere', 'lib.mine': 'I tuoi dispositivi', 'lib.all': 'Tutti',
      'lib.moving_head': 'Teste mobili', 'lib.par': 'PAR / wash', 'lib.bar': 'Barre / effetti', 'lib.strobe': 'Strobo', 'lib.smoke': 'Fumo', 'lib.laser': 'Laser',
      'lib.custom': 'Profilo personalizzato…', 'lib.added': 'Aggiunto: {n} (indirizzo {a})',
      'cam.scan': 'Cerca camere', 'cam.scanning': 'Cerco le camere…', 'cam.main': 'Principale (gesti)', 'cam.stage': 'Palco', 'cam.none': 'Non usare',
      'cam.win': 'Windows vede: {s}', 'cam.inuse': 'in uso', 'cam.url': 'Camera IP o telefono via Wi-Fi', 'cam.asMain': 'Come principale', 'cam.asStage': 'Come palco',
      'cam.needMain': 'Serve una camera principale — prima scegline un’altra come principale',
      'cam.mainIsStage': 'Questa è la camera principale. Imposta un’altra come principale e questa come camera palco.',
      'pc.src': 'Camera', 'pc.srcMain': 'principale', 'pc.srcStage': 'palco', 'pc.lamp': 'Luce',
      'pc.see': 'Ti vedo — piedi nel punto {x}, {y}', 'pc.nosee': 'Non vedo nessuno — mettiti in inquadratura per intero',
      'pc.aim': 'Porta la luce su di te', 'pc.aimH': 'Frecce sullo schermo o sulla tastiera (Shift = preciso).',
      'pc.ok': 'La luce è su di me — salva', 'pc.okH': 'Oppure Invio, oppure pollice su per 1 s.',
      'pc.pts': 'Punti salvati: {n}', 'pc.err': 'precisione ± {e}°', 'pc.need': 'Servono almeno 3 punti (meglio 5: quattro angoli e centro).',
      'pc.clear': 'Cancella i punti di questa luce', 'pc.test': 'Prova: la luce mi segue', 'pc.testStop': 'Fine prova',
      'pc.saved': 'Punto {n} salvato', 'pc.fine': 'preciso',
      'de.basic': 'Base', 'de.name': 'Nome', 'de.name.d': 'Come si chiama il dispositivo nel programma.',
      'de.addr': 'Indirizzo DMX', 'de.addr.d': 'Lo stesso impostato sul dispositivo (es. A001 = 1).',
      'de.type': 'Tipo', 'de.type.d': 'Dal tipo dipendono l’aspetto in 3D e cosa fanno gli effetti.',
      'de.mount': 'Montaggio', 'de.mount.d': 'Appeso alla struttura o a terra.', 'de.hang': 'Appesa', 'de.floor': 'A terra',
      'de.place': 'Posizione sul palco', 'de.pos': 'Posto', 'de.pos.d': 'X sinistra/destra, altezza, Z indietro (−) / avanti (+), in metri.',
      'de.yaw': 'Rotazione della base', 'de.yaw.d': 'Di quanti gradi la luce è girata rispetto al fronte del palco.',
      'de.move': 'Movimento', 'de.pan': 'Ampiezza rotazione (pan)', 'de.pan.d': 'Dal manuale, di solito 540°.', 'de.tilt': 'Ampiezza inclinazione (tilt)', 'de.tilt.d': 'Dal manuale, di solito 180–270°.',
      'de.invp': 'Inverti rotazione', 'de.invp.d': 'Quando la luce va a destra invece che a sinistra.', 'de.invt': 'Inverti inclinazione', 'de.invt.d': 'Quando la luce va su invece che giù.',
      'de.p16': 'Rotazione precisa (16 bit)', 'de.p16.d': 'La luce ha il canale „pan fine”.', 'de.t16': 'Inclinazione precisa (16 bit)', 'de.t16.d': 'La luce ha il canale „tilt fine”.',
      'de.light': 'Luce', 'de.beam': 'Angolo del fascio', 'de.beam.d': 'Larghezza del fascio (solo aspetto in 3D).',
      'de.rgb': 'Colori RGB', 'de.rgb.d': 'Il dispositivo ha LED rosso, verde e blu.',
      'de.shut': 'Otturatore aperto', 'de.shut.d': 'Valore del canale strobo con luce fissa, senza lampeggio.',
      'de.strobe': 'Strobo: lento … veloce', 'de.strobe.d': 'Intervallo del canale strobo dal manuale.',
      'de.saved': 'Salvato', 'de.model': 'Modello',
      'st.ui.n': 'Aspetto e avvio', 'st.ui.s': 'dimensione, animazioni, avvio',
      'st.ui.t': 'Aspetto e avvio', 'st.ui.d': 'Come appare il programma e cosa vedi all’avvio. Queste impostazioni sono salvate in questo browser.',
      'st.backup.n': 'Copia di sicurezza', 'st.backup.s': 'scarica e carica le impostazioni',
      'st.backup.t': 'Copia di sicurezza', 'st.backup.d': 'Salva tutte le impostazioni in un file e caricale più tardi o su un altro computer.',
      'st.diag.n': 'Diagnostica', 'st.diag.s': 'funziona tutto?',
      'st.diag.t': 'Diagnostica', 'st.diag.d': 'Lo stato di ogni parte del programma dal vivo, con un consiglio quando qualcosa non va.',
      'ui.zoom': 'Dimensione dell’interfaccia', 'ui.zoom.d': 'Testi e pulsanti più grandi su uno schermo grande, più piccoli sul portatile.',
      'ui.motion': 'Animazioni', 'ui.motion.d': 'Ridotte = senza transizioni (più calmo e veloce su un computer lento).',
      'ui.full': 'Complete', 'ui.calm': 'Ridotte',
      'ui.start': 'Scheda all’avvio', 'ui.start.d': 'Cosa vedi appena apri il programma.', 'ui.last': 'Ultima usata',
      'ui.hints': 'Suggerimenti sullo schermo', 'ui.hints.d': 'Brevi consigli sul palco 3D e sull’immagine della camera.',
      'ui.cam': 'Immagine della camera in Mano', 'ui.cam.d': 'Mostra l’immagine della camera sotto lo scheletro della mano.',
      'ui.tour': 'Guida al prossimo avvio', 'ui.tour.d': 'La guida si aprirà da sola al prossimo avvio del programma.', 'ui.tourBtn': 'Mostra all’avvio', 'ui.tourOk': 'La guida si aprirà al prossimo avvio',
      'bk.down': 'Scarica la copia', 'bk.down.d': 'Dispositivi, calibrazioni, gesti, tasti, scene e tutte le impostazioni in un file .json.', 'bk.downBtn': 'Scarica il file',
      'bk.up': 'Carica una copia da file', 'bk.up.d': 'Sostituisce le impostazioni attuali con quelle del file. Le attuali restano come „precedenti”.', 'bk.upBtn': 'Scegli il file…',
      'bk.confirm': 'Caricare le impostazioni dal file „{n}”? Dispositivi nel file: {d}. Le impostazioni attuali restano come precedenti.',
      'bk.bad': 'Questo non è un file di impostazioni Lumo',
      'bk.prev': 'Ripristina le impostazioni precedenti', 'bk.prev.d': 'Annulla l’ultimo caricamento di una copia.', 'bk.prevBtn': 'Ripristina', 'bk.prevQ': 'Tornare alle impostazioni di prima dell’ultimo caricamento?',
      'bk.other': 'Show ed effetti tuoi', 'bk.other.d': 'Gli show sono nella cartella „shows”, i tuoi effetti nel file „presets.json”. Se sposti il programma, copiali insieme alla copia.',
      'bk.pack': 'Il programma su un altro computer', 'bk.pack.d': 'Avvia „pakuj.bat” nella cartella del programma — crea uno ZIP da installare con „instaluj.bat”.',
      'dg.cam': 'Camera principale', 'dg.hand': 'Riconoscimento mano', 'dg.dmx': 'Cavo DMX', 'dg.dev': 'Dispositivi', 'dg.stage': 'Camera palco', 'dg.ws': 'Collegamento al programma', 'dg.las': 'Laser',
      'dg.camOk': '{s} · {f} fps', 'dg.camLow': 'Pochi fotogrammi al secondo: i gesti reagiscono più lentamente. Nell’app del telefono (Iriun) imposta 30 fps e buona luce.',
      'dg.camOff': 'Nessuna immagine', 'dg.camOffT': 'Controlla la camera in Impostazioni → Camere o ricollegala.',
      'dg.handOk': '{ms} ms per fotogramma', 'dg.handSlow': 'Il computer non ce la fa — chiudi gli altri programmi.', 'dg.handNo': 'Il modello della mano non si è caricato.',
      'dg.dmxSim': 'Modalità virtuale', 'dg.dmxSimT': 'Le luci non ricevono segnale — collega il cavo in Impostazioni → Cavo DMX.', 'dg.dmxErr': 'Nessuna connessione', 'dg.dmxErrT': 'Collega il cavo USB-DMX e premi Collega. Un solo programma alla volta può usare il cavo.',
      'dg.devN': '{n} · indirizzi a posto', 'dg.devNone': 'Nessun dispositivo', 'dg.devNoneT': 'Aggiungi i dispositivi in Impostazioni → Dispositivi.', 'dg.devConf': 'Indirizzi sovrapposti: {s}', 'dg.devConfT': 'Usa „Indirizzi in ordine” in Dispositivi o correggi a mano.',
      'dg.stageOff': 'non usata', 'dg.stageT': 'La camera palco non dà immagine — controllala in Camere o imposta „Non usare”.',
      'dg.wsOk': '{n} aggiornamenti al secondo', 'dg.wsLow': 'Il programma si aggiorna lentamente — chiudi le altre schede del programma.',
      'dg.lasOff': 'spenti (sicuro)', 'dg.lasOn': 'armati', 'dg.lasOnT': 'Spegnili se qualcuno può guardare il raggio.',
      'dg.test': 'Test del sistema', 'dg.copy': 'Copia il rapporto', 'dg.copied': 'Rapporto copiato negli appunti', 'dg.testing': 'Test… le luci lampeggiano per 2 s',
      'dg.resOk': 'Funziona tutto', 'dg.resBad': 'Da controllare: {n}',
      'st.autoAddr': 'Indirizzi in ordine', 'st.autoAddrQ': 'Dare indirizzi in ordine da 1, senza sovrapposizioni? Poi imposta gli stessi indirizzi sui dispositivi (menu o DIP).',
      'st.autoAddrOk': 'Nuovi indirizzi: {s}', 'st.dup': 'Duplica',
    },
  });

  // navigation: groups of sections
  const NAV = [
    ['nav.start', [['home', 'scene'], ['wizard', 'sparkle'], ['overview', 'target']]],
    ['nav.hw', [['dmx', 'plug'], ['lamps', 'lamp'], ['library', 'layers'], ['dmxcal', 'channels'], ['camera', 'camera']]],
    ['nav.cal', [['lampcal', 'sparkle'], ['hand', 'hand'], ['track', 'person'], ['stage', 'scene']]],
    ['nav.ctl', [['control', 'point'], ['speed', 'gauge'], ['keys', 'keys'], ['effects', 'smoke']]],
    ['nav.other', [['general', 'setup'], ['ui', 'eye'], ['backup', 'save'], ['diag', 'pulse'], ['adv', 'channels']]],
  ];
  const SIMPLE_NAV = ['home', 'dmx', 'lamps', 'dmxcal', 'camera', 'diag'];
  const STEPS = NAV.flatMap(([, items]) => items.map(([id]) => id));
  const NAV_IC = Object.fromEntries(NAV.flatMap(([, items]) => items));
  const MAIN = ['dmx', 'lamps', 'camera', 'lampcal', 'hand', 'track', 'speed', 'stage', 'keys'];
  const PROFILES = {
    instant: { ic: 'bolt', position_smoothing: 0.85, value_smoothing: 0.9, motor: 0, filter: { mincutoff: 3.2, beta: 0.25 } },
    fast: { ic: 'target', position_smoothing: 0.5, value_smoothing: 0.6, motor: 0, filter: { mincutoff: 2.0, beta: 0.09 } },
    smooth: { ic: 'wave', position_smoothing: 0.22, value_smoothing: 0.35, motor: 30, filter: { mincutoff: 1.3, beta: 0.05 } },
    cinema: { ic: 'film', position_smoothing: 0.08, value_smoothing: 0.15, motor: 110, filter: { mincutoff: 0.8, beta: 0.03 } },
  };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; };
  const ST = {
    cur: STEPS.includes(ls('ph_step')) ? ls('ph_step') : 'home',
    visited: new Set(JSON.parse(ls('ph_visited') || '[]')),
    sig: {}, cal: null, queue: [], edit: null,
  };

  /* ------------------------------------------------------------ building blocks */
  // a setting row: name + one sentence + control
  const srow = (key, ctl, d = true) => `<div class="srow"><div><b>${esc(t(key))}</b>${d ? `<small>${esc(t(key + '.d'))}</small>` : ''}</div><div class="ctl">${ctl}</div></div>`;
  const group = (title, icon, rows, foot = '') => `<section class="sgroup">${title ? `<h3>${icon ? ic(icon) : ''}${esc(title)}</h3>` : ''}${rows}${foot ? `<div class="sfoot">${foot}</div>` : ''}</section>`;
  const segCtl = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${esc(String(v))}" class="${String(v) === String(cur) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
  const swCtl = (attr, on) => `<label class="switch"><input type="checkbox" ${attr} ${on ? 'checked' : ''}><span></span></label>`;
  const rangeCtl = (id, min, max, step, v, out) => `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${out}</output>`;
  const numCtl = (attr, v, min, max, step, unit) => `<input type="number" ${attr} value="${v}" min="${min}" max="${max}" step="${step}">${unit ? `<span class="unit">${esc(unit)}</span>` : ''}`;
  const segBind = (box, id, fn) => { for (const b of $$(`#${id} button`, box)) b.onclick = () => { $$(`#${id} button`, box).forEach((x) => x.classList.toggle('on', x === b)); fn(b.dataset.v); }; };
  const busy = (box) => box.contains(document.activeElement) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) && document.activeElement.type !== 'checkbox';

  /* ------------------------------------------------------------ status from the live state */
  const heads = (st) => st.fixtures.filter((f) => (f.type || 'moving_head') === 'moving_head' && f.channels.includes('pan'));
  function status(id, st) {
    switch (id) {
      case 'dmx': return st.dmx.ok && st.dmx.config.backend !== 'sim' ? 'done' : 'warn';
      case 'lamps': return !st.fixtures.length ? 'warn' : (st.dmx.conflicts || []).length ? 'warn' : 'done';
      case 'lampcal': { const h = heads(st); return !h.length ? (st.fixtures.length ? 'done' : '') : h.every((f) => f.aim_pan) ? 'done' : 'warn'; }
      case 'camera': return st.video.state === 'online' ? 'done' : 'warn';
      case 'hand': return st.aim_box ? 'done' : ST.visited.has('hand') ? 'warn' : '';
      case 'speed': return ST.visited.has('speed') ? 'done' : '';
      case 'track': { const h = heads(st); if (!h.length) return st.fixtures.length ? 'done' : '';
        return h.every((f) => Object.values(f.aim_points || {}).some((n) => n >= 3)) ? 'done' : ST.visited.has('track') ? 'warn' : ''; }
      case 'keys': return (st.bindings || []).length || ST.visited.has('keys') ? 'done' : '';
      case 'stage': return st.stage.calibrated || ST.visited.has('stage') ? 'done' : '';
      case 'overview': return MAIN.every((s) => status(s, st) === 'done') ? 'done' : '';
      default: return '';
    }
  }

  /* ------------------------------------------------------------ left navigation */
  function renderNav(st) {
    const box = $('#steps');
    const sts = STEPS.map((id) => status(id, st));
    const sig = `${sts.join(',')}|${ST.cur}|${PH.lang}|${PH.simple}`;
    if (sig === ST.sig.nav) return;
    ST.sig.nav = sig;
    box.innerHTML = `<button class="btn guide-btn" id="st-guide">${ic('help')}<span>${esc(t('st.guide'))}</span></button>`
      + NAV.map(([g, list]) => [g, list.filter(([id]) => !PH.simple || SIMPLE_NAV.includes(id) || id === ST.cur)]).filter(([, items]) => items.length)
        .map(([g, items]) => `<div class="nav-grp">${esc(t(g))}</div>` + items.map(([id, icon]) => {
        const s = status(id, st);
        return `<button class="step-item ${s}${id === ST.cur ? ' on' : ''}" data-step="${id}"><span class="num">${ic(icon)}</span>
          <span><b>${esc(t(`st.${id}.n`))}</b><small>${esc(t(`st.${id}.s`))}</small></span><i class="st-dot"></i></button>`;
      }).join('')).join('')
      + `<button class="btn sm ghost nav-more" id="st-more">${ic(PH.simple ? 'plus' : 'minus')}<span>${esc(t(PH.simple ? 'sm2.more' : 'sm2.less'))}</span></button>`;
    $('#st-more', box).onclick = () => PH.setSimple(!PH.simple);
    for (const b of $$('.step-item', box)) b.onclick = () => show(b.dataset.step);
    $('#st-guide', box).onclick = () => PH.startTour && PH.startTour();
  }
  function show(id) {
    if (id === 'done') id = 'overview';
    if (!STEPS.includes(id)) id = 'overview';
    if (ST.cur === 'hand' && id !== 'hand') ST.cal = null;
    ST.cur = id; ls('ph_step', id);
    ST.visited.add(id); ls('ph_visited', JSON.stringify([...ST.visited]));
    for (const p of $$('.step-pane')) p.classList.toggle('on', p.dataset.step === id);
    S.forceVideo = id === 'camera' || id === 'track' || id === 'hand';
    send({ type: 'people_detect', value: id === 'track' });
    if (id === 'camera' && !ST.scanned) { ST.scanned = true; send({ type: 'scan_cameras' }); }
    ST.sig = {};
    const pane = $('.step-pane.on'); if (pane) pane.scrollTop = 0;
    if (S.st) { renderNav(S.st); renderPane(S.st, true); }
  }
  PH.setupGo = show;

  /* ------------------------------------------------------------ panes */
  function renderPane(st, force) {
    const fn = { overview: paneOverview, dmx: paneDmx, lamps: paneLamps, lampcal: paneCal, camera: paneCamera, hand: paneHand, track: paneTrack,
      speed: paneSpeed, stage: paneStage, keys: paneKeys, control: paneControl, effects: paneEffects, general: paneGeneral,
      ui: paneUi, backup: paneBackup, diag: paneDiag }[ST.cur] || (PH.setupPanes || {})[ST.cur];
    if (fn) fn(st, force);
  }
  const once = (key, sig, force) => { if (!force && ST.sig[key] === sig) return false; ST.sig[key] = sig; return true; };

  /* ---- overview: what is ready, one click to go there */
  function overviewText(id, st) {
    const h = heads(st);
    switch (id) {
      case 'dmx': return st.dmx.config.backend === 'sim' ? t('ov.dmxSim') : st.dmx.ok ? (st.dmx.label || st.dmx.status) : t('ov.dmxErr');
      case 'lamps': return st.fixtures.length ? t('ov.devs', { n: st.fixtures.length }) : t('ov.noDevs');
      case 'camera': return st.video.state === 'online' ? t('ov.camOk', { s: `${st.video.width}×${st.video.height} · ${Math.round(st.video.fps)} fps` }) : t('ov.camNo');
      case 'lampcal': return h.length ? t('ov.calN', { n: h.filter((f) => f.aim_pan).length, m: h.length }) : t('ov.noHeads');
      case 'hand': return st.aim_box ? t('ov.handOk') : t('ov.handNo');
      case 'track': { if (!h.length) return t('ov.noHeads'); const n = Math.max(0, ...h.map((f) => Math.max(0, ...Object.values(f.aim_points || {})))); return n ? t('ov.trackN', { n }) : t('ov.trackNo'); }
      case 'speed': { const p = currentProfile(st); return p === 'custom' ? t('sp.custom') : t(`sp.${p}`); }
      case 'stage': return `${t('ov.stage', { w: st.stage.width, d: st.stage.depth })}${st.stage.calibrated ? ' · ' + t('ov.floor') : ''}`;
      case 'keys': return (st.bindings || []).length ? t('ov.keysN', { n: st.bindings.length }) : t('ov.keysNo');
      default: return '';
    }
  }
  function paneOverview(st, force) {
    const items = MAIN.map((id) => [id, status(id, st), overviewText(id, st)]);
    if (!once('ov', JSON.stringify([items, PH.lang]), force)) return;
    const done = items.filter((x) => x[1] === 'done').length, left = MAIN.length - done;
    const C = 2 * Math.PI * 26;
    $('#st-overview').innerHTML = `<div class="ov-hero">
        <div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="7"/>
          <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - done / MAIN.length)}" style="transition:stroke-dashoffset .8s"/></svg>
          <em>${done}/${MAIN.length}</em></div>
        <div class="grow"><b>${esc(left ? t('ov.ready', { n: done, m: MAIN.length }) : t('ov.allOk'))}</b><small>${esc(left ? t('ov.left', { n: left }) : t('ov.ready', { n: done, m: MAIN.length }))}</small></div>
        <button class="btn" id="ov-wiz">${ic('sparkle')}<span>${esc(t('st.wizard.n'))}</span></button>
        <button class="btn" id="ov-show">${ic('play')}<span>${esc(t('gn.show'))}</span></button></div>
      <div class="ov-grid">${items.map(([id, s, txt]) => `<button class="ov-card ${s}" data-go="${id}"><span class="ci">${ic(s === 'done' ? 'check' : NAV_IC[id])}</span>
        <b>${esc(t(`st.${id}.n`))}</b><small>${esc(txt)}</small></button>`).join('')}</div>`;
    for (const b of $$('[data-go]', $('#st-overview'))) b.onclick = () => show(b.dataset.go);
    $('#ov-show').onclick = testShow;
    $('#ov-wiz').onclick = () => show('wizard');
  }
  const testShow = () => {
    send({ type: 'fx_start', id: 'demo-move', kind: 'circle', params: { speed: 0.3, size: 40 }, targets: 'all', duration: 10 });
    send({ type: 'fx_start', id: 'demo-color', kind: 'rainbow', params: { speed: 0.2 }, targets: 'all', duration: 10 });
    send({ type: 'fx_start', id: 'demo-dim', kind: 'pulse', params: { speed: 1, min: 0.4 }, targets: 'all', duration: 10 });
  };

  /* ---- DMX cable */
  function paneDmx(st, force) {
    const d = st.dmx, sim = d.config.backend === 'sim';
    const cls = sim ? 'warn' : d.ok ? 'ok' : 'warn';
    const msg = sim ? t('st.dmx.sim') : d.ok ? t('st.dmx.ok', { s: d.label }) : t('st.dmx.err', { s: d.status });
    if (!once('dmx', `${cls}|${msg}|${PH.lang}`, force)) return;
    $('#st-dmx').innerHTML = `<div class="st-status ${cls}">${ic(d.ok && !sim ? 'check' : 'warn')} <span>${esc(msg)}</span><span class="grow"></span>
      <button class="btn" id="std-blink">${ic('sun')}<span>${esc(t('st.dmx.blink'))}</span></button></div>`;
    $('#std-blink').onclick = blinkAll;
  }
  const blinkAll = () => send({ type: 'fx_start', id: 'setup-blink', kind: 'blink', params: { speed: 4 }, targets: 'all', duration: 2 });
  const blink = (id) => send({ type: 'fx_start', id: `setup-blink-${id}`, kind: 'blink', params: { speed: 4 }, targets: id, duration: 2 });

  /* ---- devices: list, full editor per device, library */
  const TYPE_IC = { moving_head: 'lamp', bar: 'bar', derby: 'derby', par: 'par', strobe: 'bolt', laser: 'laser', smoke: 'smoke' };
  const TYPES = ['moving_head', 'par', 'bar', 'derby', 'strobe', 'laser', 'smoke'];
  const LIB_GROUPS = { moving_head: ['moving_head'], par: ['par'], bar: ['bar', 'derby'], strobe: ['strobe'], smoke: ['smoke'], laser: ['laser'] };
  const EDIT_KEYS = ['name', 'address', 'type', 'mount', 'pos', 'yaw', 'pan_deg', 'tilt_deg', 'invert_pan', 'invert_tilt', 'pan_16bit', 'tilt_16bit', 'beam_deg', 'has_rgb', 'shutter_open', 'strobe_min', 'strobe_max', 'channels'];
  function devEditor(f) {
    const moving = f.channels.includes('pan') || f.channels.includes('tilt');
    const hasStrobe = f.channels.includes('shutter') || f.channels.includes('strobe');
    const r1 = (n) => Math.round(n * 10) / 10;
    const k = (name) => `data-k="${name}"`;
    const basic = srow('de.name', `<input type="text" ${k('name')} value="${esc(f.name)}" maxlength="24">`)
      + srow('de.addr', numCtl(k('address'), f.address, 1, 512, 1, `DMX ${String(f.address).padStart(3, '0')}–${String(f.address + f.footprint - 1).padStart(3, '0')}`))
      + srow('de.type', `<select ${k('type')}>${TYPES.map((x) => `<option value="${x}" ${x === f.type ? 'selected' : ''}>${esc(t('type.' + x))}</option>`).join('')}</select>`)
      + srow('de.mount', segCtl(`de-mount-${f.id}`, [['hang', t('de.hang')], ['floor', t('de.floor')]], f.mount));
    const place = srow('de.pos', `<input type="number" data-pos="0" value="${r1(f.pos[0])}" step="0.1" title="X"><input type="number" data-pos="1" value="${r1(f.pos[1])}" step="0.1" min="0" title="Y"><input type="number" data-pos="2" value="${r1(f.pos[2])}" step="0.1" title="Z"><span class="unit">m</span>`)
      + srow('de.yaw', numCtl(k('yaw'), f.yaw, -180, 180, 5, '°'));
    const move = moving ? srow('de.pan', numCtl(k('pan_deg'), f.pan_deg, 90, 720, 10, '°'))
      + srow('de.tilt', numCtl(k('tilt_deg'), f.tilt_deg, 90, 360, 10, '°'))
      + srow('de.invp', swCtl(k('invert_pan'), f.invert_pan))
      + srow('de.invt', swCtl(k('invert_tilt'), f.invert_tilt))
      + srow('de.p16', swCtl(k('pan_16bit'), f.pan_16bit))
      + srow('de.t16', swCtl(k('tilt_16bit'), f.tilt_16bit)) : '';
    const light = srow('de.beam', numCtl(k('beam_deg'), f.beam_deg, 1, 60, 0.5, '°'))
      + srow('de.rgb', swCtl(k('has_rgb'), f.has_rgb))
      + (hasStrobe ? srow('de.shut', numCtl(k('shutter_open'), f.shutter_open, 0, 255, 1, ''))
        + srow('de.strobe', `<input type="number" ${k('strobe_min')} value="${f.strobe_min}" min="0" max="255"><span class="unit">…</span><input type="number" ${k('strobe_max')} value="${f.strobe_max}" min="0" max="255">`) : '');
    return `<div class="dev-edit" data-edit="${f.id}">
      <div class="dev-edit-h"><span class="lamp"><i data-dot="${f.id}"></i></span><div><b>${esc(f.name)}</b><div class="muted">${esc(t('de.model'))}: ${esc(f.model || '—')} · ${esc(t('st.lamps.ch', { n: f.footprint }))}</div></div>
        <span class="grow"></span>
        <button class="btn" data-ch="${f.id}">${ic('channels')}<span>${esc(t('st.ch'))}</span></button>
        <button class="btn primary" data-cal="${f.id}">${ic('sparkle')}<span>${esc(t('st.cal'))}</span></button>
        <button class="btn" data-close>${ic('close')}<span>${esc(t('st.close'))}</span></button></div>
      <div class="dev-cols">
        ${group(t('de.basic'), 'edit', basic)}
        ${group(t('de.place'), 'scene', place)}
        ${move ? group(t('de.move'), 'move', move) : ''}
        ${group(t('de.light'), 'sun', light)}
      </div></div>`;
  }
  function bindEditor(box, f) {
    const ed = $(`[data-edit="${f.id}"]`, box); if (!ed) return;
    const upd = (patch) => send({ type: 'update_fixture', id: f.id, ...patch });
    for (const el of $$('[data-k]', ed)) {
      el.onchange = () => {
        const key = el.dataset.k;
        const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
        if (key === 'name' && !String(v).trim()) return;
        upd({ [key]: v });
      };
    }
    for (const el of $$('[data-pos]', ed)) el.onchange = () => upd({ pos: $$('[data-pos]', ed).map((x) => Number(x.value)) });
    segBind(ed, `de-mount-${f.id}`, (v) => upd({ mount: v }));
    $('[data-close]', ed).onclick = () => { ST.edit = null; paneLamps(S.st, true); };
  }
  function paneLamps(st, force) {
    const lib = S.library || [];
    const ef = st.fixtures.find((f) => f.id === ST.edit);
    const sig = JSON.stringify([st.fixtures.map((f) => [f.id, f.name, f.address, f.model, f.footprint, f.type, !!f.aim_pan]), ef && EDIT_KEYS.map((key) => ef[key]),
      st.dmx.conflicts, PH.lang, lib.length, ST.libF, ST.edit]);
    const box = $('#st-lamps');
    if (!force && busy(box)) return;
    if (!once('lamps', sig, force)) return;
    const hs = heads(st);
    const rows = st.fixtures.map((f) => `<div class="lrow${f.id === ST.edit ? ' editing' : ''}" data-id="${f.id}">
        <span class="dev-ic">${ic(TYPE_IC[f.type] || 'lamp')}</span>
        <span><b>${esc(f.name)}</b><small>${esc(f.model || t('type.' + f.type))}</small></span>
        <label class="lbl">${esc(t('st.lamps.addr'))} <input type="number" min="1" max="512" value="${f.address}" data-addr="${f.id}" style="width:78px"></label>
        <span class="tags"><span class="tagc">DMX ${String(f.address).padStart(3, '0')}–${String(f.address + f.footprint - 1).padStart(3, '0')}</span>${hs.includes(f) ? `<span class="tagc ${f.aim_pan ? 'ok' : 'warn'}">${esc(t(f.aim_pan ? 'st.cal.ok' : 'st.cal.no'))}</span>` : ''}</span>
        <span class="acts"><button class="btn sm" data-blink="${f.id}" title="${esc(t('st.lamps.blink'))}">${ic('sun')}</button>
          <button class="btn sm" data-edit-btn="${f.id}">${ic('edit')}<span>${esc(t('st.edit'))}</span></button>
          <button class="btn sm" data-ch="${f.id}">${ic('channels')}<span>${esc(t('st.ch'))}</span></button>
          <button class="btn sm primary" data-cal="${f.id}">${ic('sparkle')}<span>${esc(t('st.cal'))}</span></button>
          <button class="btn sm" data-dup="${f.id}" title="${esc(t('st.dup'))}">${ic('copy')}</button>
          <button class="btn sm danger-t" data-del="${f.id}" title="${esc(t('st.lamps.del'))}">${ic('trash')}</button></span></div>
        ${f.id === ST.edit ? devEditor(f) : ''}`).join('');
    const conf = (st.dmx.conflicts || []).length ? `<div class="st-status warn">${ic('warn')} ${esc(t('st.lamps.conflict', { s: st.dmx.conflicts.join(', ') }))}</div>` : '';
    const f0 = ST.libF || 'all';
    const shown = lib.filter((e) => f0 === 'all' || (LIB_GROUPS[f0] || []).includes(e.type));
    box.innerHTML = `${conf}${st.fixtures.length ? `<div class="sec-row"><div class="sec-t">${esc(t('lib.mine'))}</div><span class="row"><button class="btn sm" id="stl-qlc">${ic('plug')}<span>${esc(t('st.qlc'))}</span></button><button class="btn sm" id="stl-auto">${ic('refresh')}<span>${esc(t('st.autoAddr'))}</span></button></span></div><div class="lamp-rows">${rows}</div>` : `<div class="st-status warn">${ic('info')} <span>${esc(t('st.lamps.none'))}</span><span class="grow"></span><button class="btn sm primary" id="stl-qlc">${ic('plug')}<span>${esc(t('st.qlc'))}</span></button></div>`}
      <div class="sec-t">${esc(t('lib.title'))}</div>
      <div class="lib-filter seg">${['all', ...Object.keys(LIB_GROUPS)].map((key) => `<button data-lf="${key}" class="${f0 === key ? 'on' : ''}">${esc(t(`lib.${key}`))}</button>`).join('')}</div>
      <div class="lib-grid">${shown.map((e) => `<button class="lib-card" data-key="${esc(e.key)}"><span class="ico">${ic(TYPE_IC[e.type] || 'lamp')}</span>
        <span><b>${esc(e.model)}</b><small>${e.channels.length} ch · ${esc(t('type.' + e.type))}</small></span></button>`).join('')}
        <button class="lib-card" id="stl-custom"><span class="ico">${ic('plus')}</span><span><b>${esc(t('lib.custom'))}</b><small>DMX</small></span></button></div>`;
    for (const el of $$('[data-lf]', box)) el.onclick = () => { ST.libF = el.dataset.lf; paneLamps(S.st, true); };
    for (const el of $$('.lib-card[data-key]', box)) el.onclick = () => {
      const e = lib.find((x) => x.key === el.dataset.key); if (!e) return;
      const n = st.fixtures.filter((f) => f.library_key === e.key).length;
      send({ type: 'add_fixture', library_key: e.key, mount: e.mount || 'floor', name: n ? `${e.model.split(' ').slice(0, 3).join(' ')} ${n + 1}` : undefined });
      ST.pendingAdd = { ids: new Set(st.fixtures.map((f) => f.id)), t: performance.now() };
      el.classList.add('added'); setTimeout(() => el.classList.remove('added'), 600);
    };
    $('#stl-custom', box).onclick = () => PH.openFixtureDialog(null);
    const fx = (el, key) => PH.fixtures().find((x) => x.id === Number(el.dataset[key]));
    for (const el of $$('[data-ch]', box)) el.onclick = () => { const f = fx(el, 'ch'); if (f && PH.openChannels) PH.openChannels(f); };
    for (const el of $$('[data-cal]', box)) el.onclick = () => calibrate([Number(el.dataset.cal)]);
    for (const el of $$('[data-edit-btn]', box)) el.onclick = () => { const id = Number(el.dataset.editBtn); ST.edit = ST.edit === id ? null : id; paneLamps(S.st, true); };
    for (const el of $$('[data-addr]', box)) el.onchange = () => send({ type: 'update_fixture', id: Number(el.dataset.addr), address: Number(el.value) });
    for (const el of $$('[data-blink]', box)) el.onclick = () => blink(Number(el.dataset.blink));
    for (const el of $$('[data-del]', box)) el.onclick = () => { const f = fx(el, 'del'); if (f && confirm(t('st.lamps.delQ', { n: f.name }))) { if (ST.edit === f.id) ST.edit = null; send({ type: 'remove_fixture', id: f.id }); } };
    for (const el of $$('[data-dup]', box)) el.onclick = () => send({ type: 'duplicate_fixture', id: Number(el.dataset.dup) });
    const qb = $('#stl-qlc', box); if (qb) qb.onclick = () => PH.qlcImport && PH.qlcImport();
    const auto = $('#stl-auto', box);
    if (auto) auto.onclick = () => {
      if (!confirm(t('st.autoAddrQ'))) return;
      let next = 1; const done = [];
      for (const f of [...st.fixtures].sort((a, b) => a.address - b.address || a.id - b.id)) {
        if (f.address !== next) send({ type: 'update_fixture', id: f.id, address: next });
        done.push(`${f.name} ${next}`); next += f.footprint;
      }
      toast(t('st.autoAddrOk', { s: done.join(', ') }));
    };
    if (ef) bindEditor(box, ef);
  }
  PH.editDevice = (id) => { ST.edit = id; PH.setTab('setup'); show('lamps'); };

  /* ---- calibration of devices: one "Kalibruj" per device */
  function paneCal(st, force) {
    const all = st.fixtures, hs = heads(st);
    const sig = JSON.stringify([all.map((f) => [f.id, f.name, !!f.aim_pan, f.invert_pan, f.invert_tilt, f.type]), PH.lang]);
    if (!once('cal', sig, force)) return;
    const box = $('#st-lampcal');
    if (!all.length) { box.innerHTML = `<div class="st-status">${ic('info')} ${esc(t('st.lamps.none'))}</div>`; return; }
    box.innerHTML = `<div class="st-actions"><button class="btn primary big-btn" id="stc-all">${ic('sparkle')}<span>${esc(t('st.cal.all'))}</span></button>
      <button class="btn big-btn" id="stc-home">${ic('target')}<span>${esc(t('st.cal.home'))}</span></button></div>
      <div class="lamp-rows">${all.map((f) => { const head = hs.includes(f); return `<div class="lrow">
        <span class="dev-ic">${ic(TYPE_IC[f.type] || 'lamp')}</span><span><b>${esc(f.name)}</b><small>DMX ${String(f.address).padStart(3, '0')} · ${esc(f.model || '')}</small></span>
        <span></span>
        <span class="tags">${head ? `<span class="tagc ${f.aim_pan ? 'ok' : 'warn'}">${esc(t(f.aim_pan ? 'st.cal.ok' : 'st.cal.no'))}</span>` : `<span class="tagc">${esc(t('st.cal.test'))}</span>`}
          ${f.invert_pan ? `<span class="tagc">${esc(t('st.cal.inv', { a: 'pan' }))}</span>` : ''}${f.invert_tilt ? `<span class="tagc">${esc(t('st.cal.inv', { a: 'tilt' }))}</span>` : ''}</span>
        <span class="acts"><button class="btn sm" data-blink="${f.id}">${ic('sun')}<span>${esc(t('st.lamps.blink'))}</span></button>
          <button class="btn sm primary" data-cal="${f.id}">${ic('sparkle')}<span>${esc(t('st.cal'))}</span></button></span></div>`; }).join('')}</div>`;
    for (const el of $$('[data-blink]', box)) el.onclick = () => blink(Number(el.dataset.blink));
    for (const el of $$('[data-cal]', box)) el.onclick = () => calibrate([Number(el.dataset.cal)]);
    $('#stc-all').onclick = () => calibrate((hs.length ? hs : all).map((f) => f.id));
    $('#stc-home').onclick = () => send({ type: 'home', id: 'all' });
  }
  function calibrate(ids) {
    ST.queue = ids.slice();
    const next = () => {
      const id = ST.queue.shift(); if (id === undefined) { ST.sig.cal = null; return; }
      const f = PH.fixtures().find((x) => x.id === id); if (!f) { next(); return; }
      PH.onWizardClose = (ok) => { if (ok && ST.queue.length) { const n = PH.fixtures().find((x) => x.id === ST.queue[0]); if (n) toast(t('st.cal.next', { n: n.name })); setTimeout(next, 400); } else ST.queue = []; };
      PH.openWizard(f);
    };
    next();
  }
  PH.calibrate = calibrate;

  /* ---- cameras */
  function paneCamera(st, force) {
    const cams = S.cameras || [], sc = st.stagecam || {}, main = st.video.source;
    const winCams = (st.devices || []).filter((d) => d.kind === 'camera').map((d) => d.name);
    const sig = JSON.stringify([cams, main, sc.source, sc.state, st.video.state, winCams, PH.lang, ST.scanning]);
    if (!once('cams', sig, force)) return;
    const idx = new Set(cams.filter((c) => c.ok || c.in_use).map((c) => c.index));
    if (typeof main === 'number') idx.add(main);
    if (typeof sc.source === 'number') idx.add(sc.source);
    const urls = [main, sc.source].filter((x) => typeof x === 'string' && x);
    const card = (src) => {
      const role = src === main ? 'main' : src === sc.source ? 'stage' : 'none';
      const info = cams.find((c) => c.index === src);
      const sub = role === 'main' ? (st.video.state === 'online' ? `${st.video.width}×${st.video.height} · ${Math.round(st.video.fps)} fps` : st.video.state)
        : role === 'stage' ? `${sc.state} · ${Math.round(sc.fps || 0)} fps` : info && info.ok ? `${info.width}×${info.height}` : info && info.in_use ? t('cam.inuse') : '—';
      return `<div class="cam-card ${role}"><div class="ch"><span class="ico">${ic('camera')}</span>
        <span><b>${typeof src === 'number' ? `CAM ${src}` : esc(String(src).slice(0, 28))}</b><small>${esc(sub)}</small></span></div>
        <div class="role seg" data-src="${esc(String(src))}"><button data-r="main" class="${role === 'main' ? 'on' : ''}">${esc(t('cam.main'))}</button>
          <button data-r="stage" class="${role === 'stage' ? 'on' : ''}">${esc(t('cam.stage'))}</button>
          <button data-r="none" class="${role === 'none' ? 'on' : ''}">${esc(t('cam.none'))}</button></div></div>`;
    };
    const box = $('#st-cams');
    box.innerHTML = `<div class="st-actions"><button class="btn" id="stk-scan">${ic('refresh')}<span>${esc(t(ST.scanning ? 'cam.scanning' : 'cam.scan'))}</span></button>
        ${winCams.length ? `<span class="muted" style="align-self:center">${esc(t('cam.win', { s: winCams.join(', ') }))}</span>` : ''}</div>
      <div class="cam-grid">${[...idx].sort((a, b) => a - b).map(card).join('')}${urls.map(card).join('')}
        <div class="cam-card"><div class="ch"><span class="ico">${ic('usb')}</span><span><b>${esc(t('cam.url'))}</b><small>http://192.168.1.X:8080/video</small></span></div>
          <input type="text" id="stk-url" placeholder="http://…/video"><div class="role"><button class="btn sm" id="stk-url-main">${esc(t('cam.asMain'))}</button><button class="btn sm" id="stk-url-stage">${esc(t('cam.asStage'))}</button></div></div></div>`;
    $('#stk-scan').onclick = () => { ST.scanning = true; ST.sig.cams = null; send({ type: 'scan_cameras' }); };
    const setRole = (src, r) => {
      const s2 = /^\d+$/.test(src) ? Number(src) : src;
      if (r === 'main') {
        if (sc.source === s2) send({ type: 'stagecam_source', source: null });
        send({ type: 'source', source: s2 });
      } else if (r === 'stage') {
        if (main === s2) { toast(t('cam.mainIsStage'), 'warn'); return; }
        send({ type: 'stagecam_source', source: s2 }); send({ type: 'save' });
      } else if (main === s2) toast(t('cam.needMain'), 'warn');
      else if (sc.source === s2) send({ type: 'stagecam_source', source: null });
    };
    for (const g of $$('.role[data-src]', box)) for (const b of $$('button', g)) b.onclick = () => setRole(g.dataset.src, b.dataset.r);
    const url = () => $('#stk-url', box).value.trim();
    $('#stk-url-main').onclick = () => { if (url()) setRole(url(), 'main'); };
    $('#stk-url-stage').onclick = () => { if (url()) setRole(url(), 'stage'); };
  }
  PH.onCameras = () => { ST.scanning = false; ST.sig.cams = null; if (S.st && ST.cur === 'camera') paneCamera(S.st, true); };
  function drawCamera() {
    const cv = $('#st-cam'); if (!cv || !cv.offsetParent) return;
    const [W, H, d] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
    ctx.fillStyle = '#16161d'; ctx.fillRect(0, 0, W, H);
    const v = S.st && S.st.video;
    if (S.bitmap && v && v.state === 'online') {
      const ar = S.bitmap.width / S.bitmap.height; let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
      ctx.drawImage(S.bitmap, (W - w) / 2, (H - h) / 2, w, h);
    }
    const msg = v ? (v.state === 'online' ? t('st.cam.ok', { s: `${v.width}×${v.height} · ${Math.round(v.fps)} fps` }) : t('st.cam.err', { s: v.status })) : '';
    ctx.font = `600 ${13 * d}px Figtree, sans-serif`;
    const tw = ctx.measureText(msg).width;
    ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.fillRect(10 * d, H - 36 * d, tw + 20 * d, 26 * d);
    ctx.fillStyle = v && v.state === 'online' ? '#0d6b3c' : '#b42318'; ctx.fillText(msg, 20 * d, H - 18 * d);
  }

  /* ---- hand reach calibration: record the index fingertip for 6 s, take its bounding box */
  function paneHand(st, force) {
    const box = $('#st-hand');
    const sig = `${JSON.stringify(st.aim_box)}|${!!ST.cal}|${PH.lang}|${st.vision.mode}`;
    if (!once('hand', sig, force)) return;
    const b = st.aim_box;
    box.innerHTML = `<div class="hand-cal-box">
        <canvas id="sth-cv" class="st-preview"></canvas>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="st-status ${b ? 'ok' : ''}" id="sth-status">${ic(b ? 'check' : 'info')} <span>${esc(t(b ? 'st.hand.ok' : 'st.hand.def'))}</span></div>
          <div class="st-actions"><button class="btn primary big-btn" id="sth-start">${ic('sparkle')}<span>${esc(t('st.hand.start'))}</span></button>
            <button class="btn big-btn" id="sth-reset">${esc(t('st.hand.reset'))}</button></div>
          <button class="btn" id="sth-test">${ic('point')}<span>${esc(t('st.hand.test'))}</span></button>
          <ul class="hint" style="margin:0;padding-left:18px;line-height:1.8">
            <li>${esc(t('st.hand.tip1'))}</li><li>${esc(t('st.hand.tip2'))}</li><li>${esc(t('st.hand.tip3'))}</li></ul>
          <button class="btn sm" id="sth-hui">${ic('cursor')}<span>${esc(t('st.hand.hui'))}</span></button>
        </div></div>`;
    $('#sth-start').onclick = () => { send({ type: 'mode', mode: 'gesture' }); ST.cal = { t0: performance.now(), pts: [] }; };
    $('#sth-reset').onclick = () => send({ type: 'aim_box', box: null });
    $('#sth-test').onclick = () => { send({ type: 'mode', mode: 'gesture' }); PH.setTab('hand'); };
    $('#sth-hui').onclick = () => PH.huiCalibrate();
  }
  function tipNow() {
    const hands = (S.st && S.st.vision.perception.hands) || [];
    const h = hands.find((x) => x.gesture === 'point') || hands[0];
    return h ? h.index_tip : null;
  }
  function drawHand() {
    const cv = $('#sth-cv'); if (!cv || !cv.offsetParent || !S.st) return;
    const [W, H, d] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
    ctx.fillStyle = '#16161d'; ctx.fillRect(0, 0, W, H);
    if (S.bitmap) { try { ctx.globalAlpha = 0.45; ctx.drawImage(S.bitmap, 0, 0, W, H); ctx.globalAlpha = 1; } catch (e) { /* not ready */ } }
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo((W / 8) * i, 0); ctx.lineTo((W / 8) * i, H); ctx.stroke(); }
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, (H / 5) * i); ctx.lineTo(W, (H / 5) * i); ctx.stroke(); }
    const rect = (b, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 2.5 * d; ctx.setLineDash(dash); ctx.strokeRect(b[0] * W, b[1] * H, (b[2] - b[0]) * W, (b[3] - b[1]) * H); ctx.setLineDash([]); };
    rect(S.st.aim_box || [0.15, 0.15, 0.85, 0.85], S.st.aim_box ? '#3ecf8e' : 'rgba(255,255,255,.35)', [8 * d, 6 * d]);
    const tip = tipNow();
    const cal = ST.cal;
    if (cal) {
      const left = 6 - (performance.now() - cal.t0) / 1000;
      if (tip) cal.pts.push(tip);
      ctx.fillStyle = 'rgba(155,108,255,.6)';
      for (const p of cal.pts) ctx.fillRect(p[0] * W - 2 * d, p[1] * H - 2 * d, 4 * d, 4 * d);
      if (cal.pts.length > 4) {
        const xs = cal.pts.map((p) => p[0]), ys = cal.pts.map((p) => p[1]);
        rect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], '#9b6cff', []);
      }
      ctx.fillStyle = '#fff'; ctx.font = `700 ${17 * d}px Figtree, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(tip ? t('st.hand.go', { s: Math.max(0, Math.ceil(left)) }) : t('st.hand.nohand'), W / 2, 30 * d); ctx.textAlign = 'left';
      if (left <= 0) finishCal();
    }
    if (tip) {
      const g = ctx.createRadialGradient(tip[0] * W, tip[1] * H, 0, tip[0] * W, tip[1] * H, 18 * d);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(155,108,255,.9)'); g.addColorStop(1, 'rgba(155,108,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tip[0] * W, tip[1] * H, 18 * d, 0, 7); ctx.fill();
    }
  }
  function finishCal() {
    const pts = ST.cal.pts; ST.cal = null; ST.sig.hand = null;
    if (pts.length < 10) { toast(t('st.hand.nohand'), 'warn'); return; }
    const xs = pts.map((p) => p[0]).sort((a, b) => a - b), ys = pts.map((p) => p[1]).sort((a, b) => a - b);
    const q = (arr, k) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(k * (arr.length - 1))))];
    const box = [q(xs, 0.02), q(ys, 0.02), q(xs, 0.98), q(ys, 0.98)];          // ignore stray outliers
    if (box[2] - box[0] < 0.12 || box[3] - box[1] < 0.1) { toast(t('st.hand.small'), 'warn'); return; }
    const pad = 0.02;
    send({ type: 'aim_box', box: [clamp(box[0] + pad, 0, 1), clamp(box[1] + pad, 0, 1), clamp(box[2] - pad, 0, 1), clamp(box[3] - pad, 0, 1)] });
  }

  /* ---- person calibration: stand, bring the light onto yourself, confirm - several spots */
  const PC = { lamp: null, cam: 'main', thumb: 0, testing: false };
  function pcPerson(st) {
    if (PC.cam === 'stage') {
      const tr = ((st.stagecam || {}).tracks || []).filter((x) => x.kind === 'person' && x.ok);
      const p = tr.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
      return p ? { box: p.box } : null;
    }
    const pp = (st.vision.tracking.people || []);
    const tgt = pp.find((x) => x.target) || pp.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
    return tgt ? { box: tgt.box } : null;
  }
  const feet = (p) => [p.box[0] + p.box[2] / 2, p.box[1] + p.box[3]];
  function paneTrack(st, force) {
    const hs = heads(st), box = $('#st-track');
    if (!hs.length) { if (once('track', 'none' + PH.lang, force)) box.innerHTML = `<div class="st-status">${ic('info')} ${esc(t('st.cal.none'))}</div>`; return; }
    if (!hs.some((f) => f.id === PC.lamp)) PC.lamp = (hs.find((f) => f.id === st.active_id) || hs[0]).id;
    const f = hs.find((x) => x.id === PC.lamp);
    const n = (f.aim_points || {})[PC.cam] || 0, err = (f.aim_err || {})[PC.cam];
    const sig = JSON.stringify([hs.map((x) => [x.id, x.name]), PC, n, err, (st.stagecam || {}).on, PH.lang, st.vision.mode]);
    if (once('track', sig, force)) {
      box.innerHTML = `<div class="pc-grid"><div class="pc-view"><canvas id="pc-cv"></canvas></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="rowp"><span class="lbl">${esc(t('pc.src'))}</span><span class="seg sm" id="pc-src"><button data-v="main" class="${PC.cam === 'main' ? 'on' : ''}">${esc(t('pc.srcMain'))}</button>
            <button data-v="stage" class="${PC.cam === 'stage' ? 'on' : ''}" ${(st.stagecam || {}).on ? '' : 'disabled'}>${esc(t('pc.srcStage'))}</button></span></div>
          <div class="rowp"><span class="lbl">${esc(t('pc.lamp'))}</span><span class="seg sm" id="pc-lamp">${hs.map((x) => `<button data-id="${x.id}" class="${x.id === PC.lamp ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</span></div>
          <div class="st-status" id="pc-see">…</div>
          <div><b>${esc(t('pc.aim'))}</b><div class="kbd-hint">${esc(t('pc.aimH'))}</div></div>
          <div class="pc-pad"><span></span><button class="btn" data-mv="0,-1">↑</button><span></span><button class="btn" data-mv="-1,0">←</button>
            <label class="switch" title="${esc(t('pc.fine'))}" style="justify-content:center"><input type="checkbox" id="pc-fine"><span></span></label><button class="btn" data-mv="1,0">→</button>
            <span></span><button class="btn" data-mv="0,1">↓</button><span></span></div>
          <button class="btn primary pc-big big-btn" id="pc-ok">${ic('check')}<span>${esc(t('pc.ok'))}</span></button>
          <div class="kbd-hint">${esc(t('pc.okH'))}</div>
          <div class="st-status ${n >= 3 ? 'ok' : ''}">${ic(n >= 3 ? 'check' : 'info')} <span>${esc(t('pc.pts', { n }))}${err != null && n >= 3 ? ' · ' + esc(t('pc.err', { e: err })) : ''}</span></div>
          ${n < 3 ? `<div class="kbd-hint">${esc(t('pc.need'))}</div>` : ''}
          <div class="st-actions"><button class="btn" id="pc-test">${ic(PC.testing ? 'stop' : 'person')}<span>${esc(t(PC.testing ? 'pc.testStop' : 'pc.test'))}</span></button>
            <button class="btn danger-t" id="pc-clear">${ic('trash')}<span>${esc(t('pc.clear'))}</span></button></div>
        </div></div>`;
      for (const b of $$('#pc-src button', box)) b.onclick = () => { PC.cam = b.dataset.v; ST.sig.track = null; };
      for (const b of $$('#pc-lamp button', box)) b.onclick = () => { PC.lamp = Number(b.dataset.id); send({ type: 'select', id: PC.lamp }); ST.sig.track = null; };
      for (const b of $$('[data-mv]', box)) b.onclick = () => { const [x, y] = b.dataset.mv.split(',').map(Number); pcNudge(x, y, $('#pc-fine').checked); };
      $('#pc-ok').onclick = pcConfirm;
      $('#pc-clear').onclick = () => send({ type: 'aim_point_clear', ids: [PC.lamp], cam: PC.cam });
      $('#pc-test').onclick = () => {
        PC.testing = !PC.testing; ST.sig.track = null;
        if (PC.testing) { if (PC.cam === 'stage') { const p = ((st.stagecam || {}).tracks || []).find((x) => x.kind === 'person'); if (p) send({ type: 'stagecam_follow', id: p.id, target: 'all' }); } else send({ type: 'track_auto' }); }
        else { send({ type: 'track_clear' }); send({ type: 'stagecam_follow', id: null }); send({ type: 'mode', mode: 'gesture' }); }
      };
    }
    const p = pcPerson(st), see = $('#pc-see', box);
    if (see) {
      const txt = p ? t('pc.see', { x: feet(p)[0].toFixed(2), y: feet(p)[1].toFixed(2) }) : t('pc.nosee');
      see.className = `st-status ${p ? 'ok' : 'warn'}`;
      if (see.dataset.t !== txt) { see.dataset.t = txt; see.innerHTML = `${ic(p ? 'person' : 'warn')} <span>${esc(txt)}</span>`; }
    }
    // thumbs-up held 1 s = confirm (hands-free while standing on the stage)
    const thumb = (st.vision.perception.hands || []).some((h) => h.gesture === 'full');
    if (thumb) { if (!PC.thumb) PC.thumb = performance.now(); else if (PC.thumb > 0 && performance.now() - PC.thumb > 1000) { PC.thumb = -1; pcConfirm(); } }
    else PC.thumb = 0;
  }
  function pcNudge(dx, dy, fine) {
    const f = PH.fixtures().find((x) => x.id === PC.lamp); if (!f) return;
    const deg = fine ? 0.6 : 3;
    const pan = clamp(f.values.pan + dx * deg / f.pan_deg * 65535, 0, 65535), tilt = clamp(f.values.tilt + dy * deg / f.tilt_deg * 65535, 0, 65535);
    f.values.pan = pan; f.values.tilt = tilt;
    send({ type: 'set_many', id: f.id, values: { pan, tilt, dimmer: 255, strobe: 0 } });
  }
  function pcConfirm() {
    const p = S.st && pcPerson(S.st);
    if (!p) { toast(t('pc.nosee'), 'warn'); return; }
    const [x, y] = feet(p);
    send({ type: 'aim_point', ids: [PC.lamp], x, y, cam: PC.cam });
    const f = PH.fixtures().find((z) => z.id === PC.lamp);
    toast(t('pc.saved', { n: (((f && f.aim_points) || {})[PC.cam] || 0) + 1 }));
  }
  function drawTrack() {
    const cv = $('#pc-cv'); if (!cv || !cv.offsetParent || !S.st) return;
    const [W, H, d] = PH.fitCanvas(cv), ctx = cv.getContext('2d');
    ctx.fillStyle = '#16161d'; ctx.fillRect(0, 0, W, H);
    const st = S.st;
    const img = PC.cam === 'stage' ? $('#sc-img') : S.bitmap;
    if (img && (img.width || img.naturalWidth)) {
      try { ctx.globalAlpha = 0.9; ctx.drawImage(img, 0, 0, W, H); ctx.globalAlpha = 1; } catch (e) { /* stream not ready */ }
    }
    const people = PC.cam === 'stage' ? ((st.stagecam || {}).tracks || []).filter((x) => x.kind === 'person') : (st.vision.tracking.people || []);
    const main = pcPerson(st);
    for (const q of people) {
      const [x, y, w, h] = q.box, isMain = main && main.box[0] === q.box[0] && main.box[1] === q.box[1];
      ctx.strokeStyle = isMain ? '#3ecf8e' : 'rgba(255,255,255,.5)'; ctx.lineWidth = (isMain ? 3 : 1.5) * d;
      ctx.strokeRect(x * W, y * H, w * W, h * H);
    }
    if (main) {
      const [fx, fy] = feet(main), r = (10 + 4 * Math.sin(performance.now() / 180)) * d;
      ctx.strokeStyle = '#3ecf8e'; ctx.lineWidth = 2 * d;
      ctx.beginPath(); ctx.ellipse(fx * W, fy * H, r * 2, r * 0.7, 0, 0, 7); ctx.stroke();
    }
    const f = st.fixtures.find((x) => x.id === PC.lamp);
    const n = f ? ((f.aim_points || {})[PC.cam] || 0) : 0;
    ctx.fillStyle = '#fff'; ctx.font = `600 ${13 * d}px Figtree, sans-serif`;
    ctx.fillText(`${f ? f.name : ''} · ${t('pc.pts', { n })}`, 12 * d, H - 12 * d);
  }
  window.addEventListener('keydown', (e) => {                  // arrows / Enter while calibrating
    if (S.tab !== 'setup' || ST.cur !== 'track' || e.target.closest('input, select, textarea, dialog')) return;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (mv) { pcNudge(mv[0], mv[1], e.shiftKey); e.preventDefault(); e.stopImmediatePropagation(); }
    else if (e.key === 'Enter') { pcConfirm(); e.preventDefault(); }
  }, true);

  /* ---- buttons / MIDI (keys.js renders the editor) */
  function paneKeys(st, force) {
    if (PH.renderKeys) PH.renderKeys($('#st-keys'), st, force);
  }

  /* ---- movement and smoothness */
  function currentProfile(st) {
    let best = 'custom', bd = 0.04;
    for (const [k, p] of Object.entries(PROFILES)) {
      const dd = Math.abs(p.position_smoothing - st.position_smoothing) + Math.abs(p.value_smoothing - (st.value_smoothing ?? 0.55));
      if (dd < bd) { bd = dd; best = k; }
    }
    return best;
  }
  const pct = (v) => `${Math.round(v * 100)}%`;
  function paneSpeed(st, force) {
    const box = $('#st-speed');
    const sig = `${st.position_smoothing}|${st.value_smoothing}|${st.motor_speed}|${PH.lang}`;
    if (!force && busy(box)) return;
    if (!once('speed', sig, force)) return;
    const cur = currentProfile(st);
    box.innerHTML = `<div class="choice-grid">${Object.entries(PROFILES).map(([k, p]) => `<button class="choice${cur === k ? ' on' : ''}" data-prof="${k}">
        ${ic(p.ic, 'big')}<b>${esc(t(`sp.${k}`))}</b><small>${esc(t(`sp.${k}.d`))}</small></button>`).join('')}</div>
      ${group(cur === 'custom' ? t('sp.custom') : '', '', srow('sp.pos', rangeCtl('sp-pos', 0.03, 1, 0.01, st.position_smoothing, pct(st.position_smoothing)))
        + srow('sp.val', rangeCtl('sp-val', 0.05, 1, 0.01, st.value_smoothing ?? 0.55, pct(st.value_smoothing ?? 0.55)))
        + srow('sp.motor', rangeCtl('sp-motor', 0, 255, 1, st.motor_speed ?? 0, st.motor_speed ?? 0)),
      `<button class="btn" id="sps-test">${ic('play')}<span>${esc(t('sp.test'))}</span></button>`)}`;
    for (const b of $$('[data-prof]', box)) b.onclick = () => {
      const p = PROFILES[b.dataset.prof];
      send({ type: 'speed_profile', position_smoothing: p.position_smoothing, value_smoothing: p.value_smoothing, motor: p.motor, filter: p.filter });
    };
    const live = (id, fmt, fn) => { const el = $(`#${id}`, box); el.oninput = () => { el.nextElementSibling.textContent = fmt(Number(el.value)); }; el.onchange = () => fn(Number(el.value)); };
    live('sp-pos', pct, (v) => send({ type: 'speed_profile', position_smoothing: v }));
    live('sp-val', pct, (v) => send({ type: 'speed_profile', value_smoothing: v }));
    live('sp-motor', (v) => String(Math.round(v)), (v) => send({ type: 'speed_profile', motor: v }));
    $('#sps-test').onclick = () => send({ type: 'fx_start', id: 'setup-move', kind: 'sweep', params: { speed: 0.5, size: 60 }, targets: 'all', duration: 4 });
  }

  /* ---- stage: dimensions and floor map */
  function paneStage(st, force) {
    const sg = st.stage, box = $('#st-stage');
    if (!force && busy(box)) return;
    if (!once('stage', JSON.stringify([sg.width, sg.depth, sg.truss_height, sg.aim_height, sg.calibrated, PH.lang]), force)) return;
    box.innerHTML = group('', '', srow('stg.w', numCtl('id="stg-w"', sg.width, 2, 60, 0.5, 'm'))
        + srow('stg.dp', numCtl('id="stg-d"', sg.depth, 2, 60, 0.5, 'm'))
        + srow('stg.h', numCtl('id="stg-h"', sg.truss_height, 1, 20, 0.1, 'm'))
        + srow('stg.a', numCtl('id="stg-a"', sg.aim_height, 0, 3, 0.1, 'm')))
      + group(t('stg.floorT'), 'scene', `<p>${esc(t('stg.floorD'))}</p><div class="srow"><div><b>${esc(t(sg.calibrated ? 'stg.floorOk' : 'stg.floorNo'))}</b></div>
          <div class="ctl"><button class="btn primary" id="stg-floor">${ic('sparkle')}<span>${esc(t('stg.floor'))}</span></button>
          <button class="btn" id="stg-reset">${esc(t('stg.floorReset'))}</button></div></div>`,
        `<button class="btn" id="stg-cam2">${ic('camera')}<span>${esc(t('stg.stagecam'))}</span></button>`);
    for (const [id, key] of [['stg-w', 'width'], ['stg-d', 'depth'], ['stg-h', 'truss_height'], ['stg-a', 'aim_height']]) {
      $(`#${id}`, box).onchange = (e) => { const v = Number(e.target.value); if (v > 0 || key === 'aim_height') send({ type: 'stage', [key]: v }); };
    }
    $('#stg-floor', box).onclick = () => { PH.setTab('hand'); PH.startFloorCal(); };
    $('#stg-reset', box).onclick = () => send({ type: 'camera_quad', quad: null });
    $('#stg-cam2', box).onclick = () => PH.setTab('stagecam');
  }

  /* ---- gestures and tracking */
  function paneControl(st, force) {
    const box = $('#st-control'), hf = st.hand_filter || { mincutoff: 2, beta: 0.09 };
    const sig = JSON.stringify([st.vision.mode, st.interaction.scope, st.interaction.follow_all, st.aim_mode, st.aim_span, hf, st.video.mirror, !!st.aim_box, PH.lang]);
    if (!force && busy(box)) return;
    if (!once('control', sig, force)) return;
    box.innerHTML = group('', '', srow('ctl.mode', segCtl('ctl-mode', [['gesture', t('ctl.m.gesture')], ['track', t('ctl.m.track')], ['manual', t('ctl.m.manual')]], st.vision.mode))
        + srow('ctl.scope', segCtl('ctl-scope', [['active', t('ctl.active')], ['sel', PH.lang === 'it' ? 'Selezionate' : 'Zaznaczone'], ['all', t('ctl.all')]], st.interaction.scope))
        + srow('ctl.follow', segCtl('ctl-follow', [['active', t('ctl.active')], ['all', t('ctl.all')]], st.interaction.follow_all ? 'all' : 'active'))
        + srow('ctl.aim', segCtl('ctl-aim', [['direct', t('ctl.aim.direct')], ['stage', t('ctl.aim.stage')]], st.aim_mode))
        + srow('ctl.span', `<span class="unit">pan</span>${numCtl('id="ctl-sp"', st.aim_span[0], 20, 540, 10, '°')}<span class="unit">tilt</span>${numCtl('id="ctl-st"', st.aim_span[1], 20, 270, 10, '°')}`))
      + group('', '', srow('ctl.sens', rangeCtl('ctl-sens', 0.5, 4, 0.1, hf.mincutoff, Number(hf.mincutoff).toFixed(1)))
        + srow('ctl.beta', rangeCtl('ctl-beta', 0.01, 0.3, 0.01, hf.beta, Number(hf.beta).toFixed(2)))
        + srow('ctl.mirror', swCtl('id="ctl-mirror"', st.video.mirror))
        + srow('ctl.handcal', `<span class="tagc ${st.aim_box ? 'ok' : ''}">${esc(t(st.aim_box ? 'st.hand.ok' : 'st.hand.def'))}</span><button class="btn primary" id="ctl-hcal">${ic('sparkle')}<span>${esc(t('st.cal'))}</span></button>`));
    segBind(box, 'ctl-mode', (v) => send({ type: 'mode', mode: v }));
    segBind(box, 'ctl-scope', (v) => send({ type: 'scope', value: v }));
    segBind(box, 'ctl-follow', (v) => send({ type: 'follow_all', value: v === 'all' }));
    segBind(box, 'ctl-aim', (v) => send({ type: 'aim_mode', value: v }));
    const span = () => send({ type: 'aim_mode', value: S.st.aim_mode, span: [Number($('#ctl-sp', box).value), Number($('#ctl-st', box).value)] });
    $('#ctl-sp', box).onchange = span; $('#ctl-st', box).onchange = span;
    const filt = () => send({ type: 'speed_profile', filter: { mincutoff: Number($('#ctl-sens', box).value), beta: Number($('#ctl-beta', box).value) } });
    for (const [id, dig] of [['ctl-sens', 1], ['ctl-beta', 2]]) {
      const el = $(`#${id}`, box);
      el.oninput = () => { el.nextElementSibling.textContent = Number(el.value).toFixed(dig); };
      el.onchange = filt;
    }
    $('#ctl-mirror', box).onchange = (e) => send({ type: 'mirror', value: e.target.checked });
    $('#ctl-hcal', box).onclick = () => show('hand');
  }

  /* ---- smoke and lasers */
  function paneEffects(st, force) {
    const box = $('#st-effects'), sm = st.smoke || {};
    const lasers = st.fixtures.filter((f) => f.type === 'laser' || f.channels.some((c) => c.startsWith('laser')));
    const sig = JSON.stringify([sm.level, sm.auto, sm.machines, st.lasers_enabled, lasers.length, PH.lang]);
    if (!force && busy(box)) return;
    if (!once('effects', sig, force)) return;
    const a = sm.auto || {};
    const smoke = sm.machines ? group(t('sm.title'), 'smoke', srow('sm.level', rangeCtl('sm-level', 10, 255, 1, sm.level, `${Math.round(sm.level / 2.55)}%`))
        + srow('sm.auto', swCtl('id="sm-auto"', a.on))
        + srow('sm.every', `<select id="sm-every">${[1, 2, 3, 5, 10].map((v) => `<option value="${v * 60}" ${a.every === v * 60 ? 'selected' : ''}>${v} ${esc(t('sm.min'))}</option>`).join('')}</select>`)
        + srow('sm.dur', `<select id="sm-dur">${[2, 3, 4, 5, 8].map((v) => `<option value="${v}" ${a.dur === v ? 'selected' : ''}>${v} ${esc(t('sm.s'))}</option>`).join('')}</select>`),
      `<button class="btn primary" id="sm-test">${ic('smoke')}<span>${esc(t('sm.test'))}</span></button>`)
      : group(t('sm.title'), 'smoke', `<p>${esc(t('sm.none'))}</p>`);
    const laser = group(t('ls.title'), 'laser', lasers.length ? srow('ls.arm', swCtl('id="ls-arm"', st.lasers_enabled)) : `<p>${esc(t('ls.none'))}</p>`);
    box.innerHTML = smoke + laser;
    if (sm.machines) {
      const lv = $('#sm-level', box);
      lv.oninput = () => { lv.nextElementSibling.textContent = `${Math.round(lv.value / 2.55)}%`; };
      lv.onchange = () => send({ type: 'smoke', level: Number(lv.value) });
      $('#sm-test', box).onclick = () => send({ type: 'smoke', burst: 3 });
      $('#sm-auto', box).onchange = (e) => send({ type: 'smoke', auto: { on: e.target.checked } });
      $('#sm-every', box).onchange = (e) => send({ type: 'smoke', auto: { every: Number(e.target.value) } });
      $('#sm-dur', box).onchange = (e) => send({ type: 'smoke', auto: { dur: Number(e.target.value) } });
    }
    if ($('#ls-arm', box)) $('#ls-arm', box).onchange = (e) => send({ type: 'lasers', value: e.target.checked });
  }

  /* ---- general */
  function paneGeneral(st, force) {
    const box = $('#st-general'), sc = (st.effects && st.effects.speed_scale) || 1;
    const tempo = (sc - 0.25) / 2.75;
    if (!force && busy(box)) return;
    if (!once('general', JSON.stringify([st.grand_master, sc, PH.lang]), force)) return;
    box.innerHTML = group('', '', srow('gn.lang', segCtl('gn-lang', [['pl', 'Polski'], ['it', 'Italiano']], PH.lang))
        + srow('gn.master', rangeCtl('gn-master', 0, 255, 1, st.grand_master, `${Math.round(st.grand_master / 2.55)}%`))
        + srow('gn.tempo', rangeCtl('gn-tempo', 0, 1, 0.01, tempo, `${sc.toFixed(2)}×`)))
      + group('', '', srow('gn.save', `<button class="btn primary" id="gn-save">${ic('save')}<span>${esc(t('gn.save'))}</span></button>`)
        + srow('gn.guide', `<button class="btn" id="gn-guide">${ic('help')}<span>${esc(t('gn.guide'))}</span></button>`)
        + srow('gn.show', `<button class="btn" id="gn-show">${ic('play')}<span>${esc(t('gn.show'))}</span></button>`));
    segBind(box, 'gn-lang', (v) => { const b = $(`#lang button[data-lang="${v}"]`); if (b) b.click(); });
    const m = $('#gn-master', box);
    m.oninput = () => { m.nextElementSibling.textContent = `${Math.round(m.value / 2.55)}%`; send({ type: 'grand_master', value: Number(m.value) }); };
    const tp = $('#gn-tempo', box);
    tp.oninput = () => { tp.nextElementSibling.textContent = `${(0.25 + Number(tp.value) * 2.75).toFixed(2)}×`; send({ type: 'fx_speed', value: Number(tp.value) }); };
    $('#gn-save', box).onclick = () => send({ type: 'save' });
    $('#gn-guide', box).onclick = () => PH.startTour && PH.startTour();
    $('#gn-show', box).onclick = testShow;
  }

  /* ---- look and start (saved in this browser) */
  const TABS = ['show', 'scene', 'hand', 'mixer', 'stagecam', 'music', 'setup'];
  function paneUi(st, force) {
    const box = $('#st-ui');
    const z = ls('ph_zoom') || '100', calm = ls('ph_calm') === '1', start = ls('ph_start_tab') || 'last', hints = ls('ph_hints') !== '0', cam = ls('ph_showcam') === '1';
    if (!once('ui', JSON.stringify([z, calm, start, hints, cam, PH.lang]), force)) return;
    box.innerHTML = group('', '', srow('ui.zoom', segCtl('ui-zoom', [['90', '90%'], ['100', '100%'], ['110', '110%'], ['125', '125%']], z))
        + srow('ui.motion', segCtl('ui-motion', [['full', t('ui.full')], ['calm', t('ui.calm')]], calm ? 'calm' : 'full'))
        + srow('ui.start', `<select id="ui-start"><option value="last" ${start === 'last' ? 'selected' : ''}>${esc(t('ui.last'))}</option>${TABS.map((x) => `<option value="${x}" ${start === x ? 'selected' : ''}>${esc(t('tab.' + x))}</option>`).join('')}</select>`)
        + srow('ui.hints', swCtl('id="ui-hints"', hints))
        + srow('ui.cam', swCtl('id="ui-cam"', cam))
        + srow('ui.tour', `<button class="btn" id="ui-tour">${ic('help')}<span>${esc(t('ui.tourBtn'))}</span></button>`));
    segBind(box, 'ui-zoom', (v) => { ls('ph_zoom', v); document.documentElement.style.zoom = v === '100' ? '' : `${Number(v) / 100}`; window.dispatchEvent(new Event('resize')); });
    segBind(box, 'ui-motion', (v) => { ls('ph_calm', v === 'calm' ? '1' : '0'); document.documentElement.classList.toggle('calm', v === 'calm'); });
    $('#ui-start', box).onchange = (e) => ls('ph_start_tab', e.target.value);
    $('#ui-hints', box).onchange = (e) => { ls('ph_hints', e.target.checked ? '1' : '0'); document.documentElement.classList.toggle('nohints', !e.target.checked); };
    $('#ui-cam', box).onchange = (e) => { ls('ph_showcam', e.target.checked ? '1' : '0'); const c = $('#show-cam'); if (c) { c.checked = e.target.checked; c.dispatchEvent(new Event('change')); } };
    $('#ui-tour', box).onclick = () => { try { localStorage.removeItem('ph_tour3'); } catch (e) { /* ignore */ } toast(t('ui.tourOk')); };
  }

  /* ---- backup: download / load / previous */
  function paneBackup(st, force) {
    const box = $('#st-backup');
    if (!once('backup', PH.lang, force)) return;
    box.innerHTML = group('', '', srow('bk.down', `<a class="btn primary" href="/api/config" download>${ic('save')}<span>${esc(t('bk.downBtn'))}</span></a>`)
        + srow('bk.up', `<input type="file" id="bk-file" accept=".json,application/json" hidden><button class="btn" id="bk-pick">${ic('plus')}<span>${esc(t('bk.upBtn'))}</span></button>`)
        + srow('bk.prev', `<button class="btn" id="bk-prev">${ic('undo')}<span>${esc(t('bk.prevBtn'))}</span></button>`))
      + group('', '', srow('bk.other', '') + srow('bk.pack', ''));
    const file = $('#bk-file', box);
    $('#bk-pick', box).onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      let data = null;
      try { data = JSON.parse(await f.text()); } catch (e) { data = null; }
      if (!data || typeof data !== 'object' || !('fixtures' in data || 'engine' in data)) { toast(t('bk.bad'), 'err'); return; }
      if (!confirm(t('bk.confirm', { n: f.name, d: (data.fixtures || []).length }))) return;
      send({ type: 'config_import', data });
    };
    $('#bk-prev', box).onclick = () => { if (confirm(t('bk.prevQ'))) send({ type: 'config_restore' }); };
  }

  /* ---- diagnostics: live state of every part, with a tip */
  const DG = { n: 0, t0: performance.now(), rate: 0, res: null };
  function diagItems(st) {
    const v = st.video, vis = st.vision, d = st.dmx, sc = st.stagecam || {}, conf = d.conflicts || [];
    const items = [];
    if (v.state === 'online') items.push(['cam', v.fps < 15 ? 'warn' : 'ok', t('dg.camOk', { s: `${v.width}×${v.height}`, f: Math.round(v.fps) }), v.fps < 15 ? t('dg.camLow') : '']);
    else items.push(['cam', 'err', t('dg.camOff'), t('dg.camOffT')]);
    if (vis.hand_ready) items.push(['hand', vis.proc_ms > 50 ? 'warn' : 'ok', t('dg.handOk', { ms: Math.round(vis.proc_ms) }), vis.proc_ms > 50 ? t('dg.handSlow') : '']);
    else items.push(['hand', 'err', vis.hand_status || '—', t('dg.handNo')]);
    if (d.config.backend === 'sim') items.push(['dmx', 'warn', t('dg.dmxSim'), t('dg.dmxSimT')]);
    else if (d.ok && (st.devices || []).some((x) => x.kind === 'dmx' && x.backend && x.port === d.config.port && x.backend !== d.config.backend))
      items.push(['dmx', 'err', `${d.label || d.status}`, t('cf.dmxWrong', { a: d.config.backend, b: ((st.devices || []).find((x) => x.kind === 'dmx') || {}).name || '' })]);
    else if (d.ok) items.push(['dmx', 'ok', `${d.label || d.status} · ${Math.round(d.send_hz || d.refresh_hz || 0)} Hz`, '']);
    else items.push(['dmx', 'err', t('dg.dmxErr'), t('dg.dmxErrT')]);
    if (!st.fixtures.length) items.push(['dev', 'warn', t('dg.devNone'), t('dg.devNoneT')]);
    else if (conf.length) items.push(['dev', 'warn', t('dg.devConf', { s: conf.join(', ') }), t('dg.devConfT')]);
    else items.push(['dev', 'ok', t('dg.devN', { n: st.fixtures.length }), '']);
    if (sc.source === null || sc.source === undefined) items.push(['stage', '', t('dg.stageOff'), '']);
    else items.push(['stage', sc.state === 'online' || sc.on ? 'ok' : 'warn', `${sc.state || '—'}${sc.fps ? ` · ${Math.round(sc.fps)} kl./s` : ''}`, sc.state === 'online' || sc.on ? '' : t('dg.stageT')]);
    items.push(['ws', DG.rate && DG.rate < 8 ? 'warn' : 'ok', t('dg.wsOk', { n: DG.rate || '…' }), DG.rate && DG.rate < 8 ? t('dg.wsLow') : '']);
    const rv = (st.dmx_rivals || []).join(', ');
    items.push(['rival', rv ? 'warn' : 'ok', rv ? t('dg.rivalOn', { r: rv }) : t('dg.rivalOff'), rv ? t('dg.rivalT', { r: rv }) : '']);
    items.push(['las', st.lasers_enabled ? 'warn' : 'ok', t(st.lasers_enabled ? 'dg.lasOn' : 'dg.lasOff'), st.lasers_enabled ? t('dg.lasOnT') : '']);
    return items;
  }
  function report(st) {
    const lines = [`Lumo 4.1 · ${new Date().toLocaleString()}`];
    for (const [k, s2, val, tip] of diagItems(st)) lines.push(`${s2 === 'ok' ? 'OK ' : s2 === 'warn' ? '!  ' : s2 === 'err' ? 'X  ' : '-  '}${t('dg.' + k)}: ${val}${tip ? ` — ${tip}` : ''}`);
    lines.push(`DMX: ${st.dmx.status} · ramka ${st.frame_len || '?'} kanałów`);
    for (const f of st.fixtures) lines.push(`  ${f.name} · ${f.model || f.type} · DMX ${f.address}-${f.address + f.footprint - 1}`);
    return lines.join('\n');
  }
  function paneDiag(st, force) {
    const box = $('#st-diag');
    const items = diagItems(st);
    const sig = JSON.stringify([items, DG.res, PH.lang]);
    if (!once('diag', sig, force)) return;
    box.innerHTML = `<section class="sgroup"><div class="diag">${items.map(([k, s2, val, tip]) => `<div class="diag-row ${s2}"><i></i><b>${esc(t('dg.' + k))}</b>
        <span><span class="v">${esc(val)}</span>${tip ? `<span class="tip">${esc(tip)}</span>` : ''}</span></div>`).join('')}</div>
        <div class="sfoot"><button class="btn primary" id="dg-test">${ic('play')}<span>${esc(t('dg.test'))}</span></button>
          <button class="btn" id="dg-copy">${ic('copy')}<span>${esc(t('dg.copy'))}</span></button>
          ${DG.res ? `<span class="st-status ${DG.res.bad ? 'warn' : 'ok'}" style="padding:8px 12px">${ic(DG.res.bad ? 'warn' : 'check')} ${esc(DG.res.bad ? t('dg.resBad', { n: DG.res.bad }) : t('dg.resOk'))}</span>` : ''}</div></section>`;
    $('#dg-test', box).onclick = () => {
      toast(t('dg.testing'));
      blinkAll();
      setTimeout(() => {
        const bad = diagItems(S.st).filter((x) => x[1] === 'warn' || x[1] === 'err').length;
        DG.res = { bad }; ST.sig.diag = null;
      }, 2200);
    };
    $('#dg-copy', box).onclick = async () => {
      try { await navigator.clipboard.writeText(report(S.st)); toast(t('dg.copied')); } catch (e) { toast(report(S.st).slice(0, 200)); }
    };
  }
  PH.onState.push(() => {                        // how many state updates arrive per second
    DG.n++;
    const now = performance.now();
    if (now - DG.t0 >= 1000) { DG.rate = Math.round(DG.n * 1000 / (now - DG.t0)); DG.n = 0; DG.t0 = now; }
  });

  /* ------------------------------------------------------------ wiring */
  function update(st) {
    if (ST.pendingAdd) {                        // a device was just added: open its channels right away
      const nf = st.fixtures.find((f) => !ST.pendingAdd.ids.has(f.id));
      if (nf && PH.openChannels) { ST.pendingAdd = null; setTimeout(() => PH.openChannels(nf), 250); }
      else if (performance.now() - ST.pendingAdd.t > 4000) ST.pendingAdd = null;
    }
    if (S.tab !== 'setup') {
      if (S.forceVideo) S.forceVideo = false;
      if (st.people_on && !PC.testing) send({ type: 'people_detect', value: false });
      return;
    }
    S.forceVideo = ST.cur === 'camera' || ST.cur === 'track' || ST.cur === 'hand';
    if (ST.cur === 'track' && !st.people_on) send({ type: 'people_detect', value: true });
    renderNav(st);
    renderPane(st, false);
    for (const i of $$('[data-dot]')) {
      const f = st.fixtures.find((x) => x.id === Number(i.dataset.dot));
      if (f) { const c = PH.rgbOf(f), I = PH.intensity(f, performance.now() / 1000); i.style.setProperty('--c', `rgba(${c.join(',')},${0.2 + 0.8 * I})`); }
    }
  }
  PH.onState.push(update);
  show(ST.cur);
  const loop = () => {
    if (S.tab === 'setup') { if (ST.cur === 'camera') drawCamera(); if (ST.cur === 'hand') drawHand(); if (ST.cur === 'track') drawTrack(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
