# Lumo — pełna rozpiska: co jest w programie i jak to zbudowałem

Wersja 4.1 · wrzesień 2026 · dawniej PHOTON/HAND

Ten dokument opisuje cały program: jak działa, z jakich części się składa, jak jest zrobiony wygląd,
co jest w każdej zakładce i w każdym folderze, co robi każde ustawienie, jak go instalować i jak go
testowałem. Instrukcja obsługi „krok po kroku” jest w `README.md` i w przewodniku w programie (przycisk **?**).

---

## 1. Program w jednym akapicie

Lumo to program na komputer z Windows, który steruje światłem scenicznym przez **DMX**
(ruchome głowy, PAR-y, belki, strobo, dym, lasery). Światłem sterujesz **dłonią przed kamerą**
(gesty), **śledzeniem osoby** (światło jedzie za człowiekiem), **pulpitem** z suwakami,
**muzyką** (autopilot, efekty w rytm, pokazy na osi czasu) albo **przyciskami / kontrolerem MIDI**.
Program działa lokalnie: serwer w Pythonie + okno w przeglądarce (bez internetu).

```
 kamera (USB / telefon Iriun)                                     lampy DMX
      │ obraz                                                          ▲
      ▼                                                                │ 50 razy na sekundę
 ┌──────────────┐  punkty dłoni / osoby  ┌──────────────┐  wartości ┌──────────────┐
 │ rozpoznawanie │ ─────────────────────▶ │  sterowanie  │ ────────▶ │  silnik DMX   │──▶ kabel FTDI Open DMX (COM3)
 │ MediaPipe,    │                        │ gesty, efekty,│           │ wygładzanie,  │    albo Art-Net / ENTTEC / uDMX
 │ OpenCV        │                        │ autopilot     │           │ bezpieczeństwo│
 └──────────────┘                         └──────────────┘           └──────────────┘
                      ▲  polecenia (JSON)          │ stan (JSON) + obraz (JPEG)
                      └──────── przeglądarka: Lumo (index.html + moduły .js) ◀┘
```

---

## 2. Z czego jest zrobiony

| część | technologia | dlaczego tak |
|---|---|---|
| serwer | Python 3.10+, FastAPI + WebSocket, uvicorn | jeden proces, szybki, działa bez internetu |
| obraz i dłoń | OpenCV, MediaPipe Hand Landmarker (21 punktów dłoni w 3D) | dokładne punkty palców, działa na zwykłym komputerze |
| osoby | OpenCV (HOG / detektor), tracker CSRT + kolor ubrania | łapie osobę i odnajduje ją, gdy zniknie |
| DMX | własny silnik 50 Hz, sterownik FTDI D2XX dla kabla Open DMX | stabilny sygnał, krótka ramka = szybsza reakcja |
| okno programu | czysty HTML + JavaScript (bez Node/npm, bez budowania) | łatwa instalacja, każdy plik da się poprawić ręcznie |
| scena 3D | three.js (dołączony w `static/vendor`, działa offline) | podgląd tego, co robią lampy |
| wygląd | własny arkusz `static/ui.css` (czcionka Figtree z Google Fonts) | jasny, prosty styl jak w Canvie |
| instalacja | `instaluj.bat` + `make_package.py` (paczka ZIP) | przeniesienie na inny komputer dwoma kliknięciami |

---

## 3. Mapa plików

### Serwer (folder główny)

| plik | co robi |
|---|---|
| `main.py` | serwer: uruchamia wszystko (klasa `Rig`), przyjmuje polecenia z przeglądarki, wysyła stan, zapisuje `config.json`, kopia zapasowa (eksport / import na żywo / przywrócenie) |
| `dmx_controller.py` | silnik DMX: urządzenia (`Fixture`), kanały, wygładzanie ruchu i jasności, wysyłanie 50×/s, zapis konfiguracji, kalibracja kierunku, dopasowanie „światło na osobę” |
| `vision.py` | kamera (przełączanie w locie, ponawianie połączenia, ekran „Brak obrazu”), rozpoznawanie dłoni i gestów, filtr wygładzający dłoń |
| `interaction.py` | zamiana gestów, śledzenia i akcji (blackout, flash, kolor…) na ruch i światło lamp |
| `custom_gestures.py` | własne gesty: nagranie pozy (3 s odliczania + 5 s trzymania), poza + ruch, dwie dłonie |
| `effects.py` | 36 efektów (ruch, kolor, jasność, gobo), autopilot i style, palety, własne efekty (`presets.json`) |
| `tracking.py` | śledzenie osoby z odnajdywaniem, lista osób, druga kamera „Kamera sceny” z mapą podłogi |
| `spotlight.py` | reflektor na osobę: wszystkie lampy białe, ostre koło, jadą za osobą |
| `smoke.py` | maszyna dymna: dym na chwilę, przytrzymanie, automat co kilka minut |
| `devices.py` | podłącz i działa: rozpoznaje kable USB-DMX i kamery, łączy od razu; wykrywa otwarty QLC+ i inne programy do świateł |
| `qlcimport.py` | czyta lampy z pokazów QLC+ (`.qxw`) i dopasowuje je do biblioteki Lumo |
| `stage.py` | model sceny 3D: kamera → podłoga, obliczanie pan/tilt do punktu |
| `calibration.py` | auto-kalibracja pozycji lampy kamerą |
| `fixture_library.json` | biblioteka urządzeń (m.in. Tomshine Mini LED Spot 9CH / 11CH, PAR RGBW, dym, laser) |
| `config.json` | Twoje ustawienia (zapisuje się samo) · `config.previous.json` = ustawienia sprzed ostatniego wczytania kopii |
| `make_package.py`, `pakuj.bat`, `instaluj.bat`, `odinstaluj.bat`, `run.bat`, `tools/shortcut.ps1` | paczka, instalacja, skróty, uruchamianie |
| `lumo.ico` | ikona programu (rysowana przez `make_package.py`) |

### Okno programu (`static/`)

| plik | co robi |
|---|---|
| `index.html` | cały układ strony, ekran ładowania, logo |
| `style.css` | stare warstwy stylów (v1–v3), dziś głównie układ |
| `ui.css` | **wygląd wersji 4**: kolory, czcionka, przyciski, karty, foldery, pulpit, oś czasu, ustawienia |
| `app.js` | serce okna: połączenie z serwerem, zakładki, szkielet dłoni, kreator lampy, pasek dolny, suwaki, teksty PL/IT |
| `folders.js` | **foldery**: lista po lewej, jeden folder otwarty, program pamięta ostatni; zakładka po uruchomieniu |
| `mufolders.js` | foldery Muzyki: Zapisane pokazy, Moje efekty, Zaawansowane |
| `desk.js` | Mikser — pulpit: sekcja na każde urządzenie, suwak na każdy kanał, FLASH, grupa „Wszystkie lampy” |
| `music.js` | Muzyka: autopilot, na żywo, pad efektów, oś czasu (jak After Effects), auto-show, kreator efektów |
| `wizard.js` | Konfigurator: wszystko po kolei jednym kliknięciem, z testami i pytaniami |
| `setup.js` | Ustawienia: menu w grupach, wszystkie parametry, edytor urządzenia, kalibracje, kopia, diagnostyka |
| `chedit.js` | okno „Kanały urządzenia”: co jest na którym kanale + suwaki testowe |
| `stage3d.js` | scena 3D: lampy, wiązki, plamy na podłodze, dym, osoby |
| `stagecam.js` | zakładka Kamera sceny |
| `gestures2.js` | kreator własnego gestu |
| `keys.js` | przyciski klawiatury i MIDI |
| `tracklist.js` | pasek osób ze zdjęciami podczas śledzenia |
| `tour.js` | przewodnik (podświetla elementy i mówi, co robią) |
| `icons.js` | ikony (linie, bez emoji) |
| `fx.js` | drobne animacje (fala po kliknięciu, wypełnienie suwaków) |
| `i18n_it.js` | tłumaczenie na włoski |

---

## 4. Jak działa serwer

1. **Start** (`Rig`): wczytuje `config.json`, łączy kabel DMX wybrany ostatnio, otwiera kamerę,
   ładuje model dłoni, urządzenia, gesty, sceny, przyciski i ustawienia dymu.
2. **Pętla DMX 50×/s**: przed każdą ramką liczą się efekty, reflektor na osobę i dym; potem wartości
   są wygładzane (osobno ruch i jasność/kolor) i wysyłane. Dla Open DMX ramka ma tyle kanałów,
   ile używasz (min. 128) — krótsza ramka = szybsza lampa.
3. **Obraz**: każda klatka z kamery idzie do rozpoznawania; wynik (dłonie, gest, osoby) trafia do
   sterowania i do przeglądarki. Obraz JPEG jest wysyłany tylko wtedy, gdy przeglądarka go pokazuje.
4. **Zapis**: każda zmiana urządzeń, kalibracji, gestów, przycisków itd. zapisuje `config.json` sama.
   Uszkodzony wpis urządzenia nie jest kasowany (zostaje w pliku).
5. **Bezpieczeństwo (zawsze)**:
   - lasery po starcie są **wyłączone**; włącza je tylko przycisk (także po wczytaniu kopii zostają wyłączone),
   - kanał resetu lampy (Tomshine 250–255) nigdy nie jest wysyłany przypadkiem,
   - tylko jeden program naraz może używać kabla FTDI; `run.bat` nie uruchomi drugiej kopii.
6. **Kamera**: gdy kamery nie ma, program sprawdza ją rzadko (co 30 s), żeby nie przycinać drugiej
   kamery; gdy Windows zgłosi nową kamerę — łączy od razu.

### Polecenia przeglądarka → serwer (WebSocket `/ws`, JSON)

| grupa | polecenia |
|---|---|
| lampy | `set`, `set_many`, `position`, `aim`, `select`, `selection`, `home`, `zero`, `blackout`, `grand_master`, `smoothing`, `speed_profile` |
| urządzenia | `add_fixture`, `update_fixture`, `duplicate_fixture`, `remove_fixture`, `library`, `test_channel`, `test_clear` |
| kalibracja | `aim_cal`, `aim_box`, `aim_point`, `aim_point_clear`, `camera_quad`, `autocal`, `stage` |
| kamera i wizja | `source`, `mirror`, `mode`, `scope`, `follow_all`, `aim_mode`, `scan_cameras`, `people_detect`, `track_*` |
| kamera sceny | `stagecam_source`, `stagecam_mirror`, `stagecam_quad`, `stagecam_follow`, `stagecam_name`, `stagecam_mark`, `stagecam_forget` |
| efekty i muzyka | `fx_start`, `fx_stop`, `fx_stop_all`, `fx_speed`, `bpm`, `beat`, `reactions`, `palette`, `autopilot`, `spotlight` |
| dym i lasery | `smoke` (burst / hold / auto / level), `lasers` |
| sceny świateł | `look_save`, `look_recall`, `look_update`, `look_delete` |
| gesty, przyciski | `gesture_record`, `gesture_save`, `gesture_delete`, `gesture_test`, `gestures`, `bindings` |
| DMX i zapis | `dmx_output`, `list_ports`, `save`, `config_import`, `config_restore` |

Adresy HTTP: `/api/state` (stan), `/api/config` (pobranie kopii ustawień), `/api/shows` (pokazy),
`/api/presets` (własne efekty), `/audio/…` (utwory pokazów), `/stream/stage` (obraz kamery sceny).

---

## 5. Dłoń i gesty

- MediaPipe daje 21 punktów dłoni w 3D. Zgięcie palców liczę z **kątów stawów w 3D**, więc gest działa
  też, gdy celujesz palcem w kamerę; „Wskaż” nie myli się z pięścią.
- Gest wchodzi po kilku klatkach (Wskaż i Jasność: 1 klatka = natychmiast; kolor, obrót, bokiem: 2;
  strobo i pełne światło: 5, żeby nie włączyły się przypadkiem). Histereza trzyma gest stabilnie.
- Filtr wygładzający dłoń (One Euro): „Czułość dłoni” i „Nadążanie za szybkim ruchem” w Ustawieniach.
- **Kalibracja dłoni**: przez 6 s dotykasz palcem czterech rogów wygodnego zasięgu — mały ruch dłoni
  obejmuje potem całą scenę.
- **Własne gesty**: poza (trzymasz 5 s), poza + ruch (lewo/prawo, góra/dół sterują jasnością, ruchem,
  kolorem, strobo, masterem, tempem), dwie dłonie naraz.
- Opóźnienie: przetwarzanie dłoni trwa ok. 2–5 ms; większość opóźnienia to **kamera** (Iriun w słabym
  świetle daje 8–9 klatek/s — w aplikacji telefonu ustaw 30 fps).

## 6. Osoby, kamera sceny, „światło na osobę”

- Śledzenie: tracker + kolor ubrania; gdy osoba zniknie, program przewiduje ruch i szuka jej sam.
- Kamera sceny: druga kamera widzi całą scenę, numeruje osoby, zna ich miejsce na podłodze.
- **Światło na osobę** (Ustawienia → Kalibracja): stajesz w kilku miejscach, naprowadzasz światło na
  siebie i potwierdzasz (przycisk, Enter albo kciuk w górę przez 1 s). Z 3 miejsc program liczy
  płaszczyznę, z 4–5 dopasowanie dwuliniowe, z 6+ kwadratowe; pokazuje dokładność w stopniach.

## 7. Efekty, autopilot, muzyka

- **36 efektów** w 4 grupach (ruch, kolor, jasność, gobo), każdy z wejściem/wyjściem i krzywą;
  „Rozłożenie na lampy” i „Kolejność” (od lewej, od prawej, od środka, losowo).
- **Autopilot**: style Spokojny / Dynamiczny / Taneczny / Rave i paleta kolorów; zmienia ruch, kolor
  i jasność co frazę, błyska na bity, na dropie strobo.
- **Analiza utworu** (w przeglądarce): tempo, bity, **kicki** (dokładność ok. ±3 ms), energia.
- **Oś czasu** (jak After Effects): zaznaczanie ramką, Shift/Ctrl+klik, Ctrl+C/X/V/D/A/Z/Y,
  Ctrl+Shift+Z, Delete, strzałki = przesuń o bit (Shift = 10 ms), Alt+przeciągnij = kopia,
  dwuklik = duplikat, prawy klik = usuń, K = wstaw klatkę w rytm, Spacja = start/pauza.
  **Magnes** przyciąga klatki: kick > bit > pół bitu (promień 13 px przy każdym powiększeniu).
- **Auto-show**: układa cały pokaz z bitów; wybierasz styl, kolory, efekty, błysk na kickach, strobo
  na dropach, energię; długości cykli są zawsze muzyczne (¼…16 bitów).

---

## 8. Wygląd (jak jest zrobiony)

Zasady, które trzymam w całym programie:

- **Jasno i prosto**: białe karty na jasnoszarym tle, zaokrąglenia 10–14 px, delikatne cienie.
- **Jeden kolor przewodni**: fiolet `#7b3ff2` (wybrane, ważne przyciski), turkus `#14a9bd` tylko
  w gradiencie logo; zielony = gotowe, pomarańczowy = do sprawdzenia, czerwony = błąd/blackout.
- **Czcionka Figtree**, cyfry o stałej szerokości (wartości nie skaczą).
- **Pisownia zwykła**: żadnych WIELKICH LITER w etykietach (wymuszone w CSS dla całego programu).
- **Każda opcja = nazwa + jedno zdanie, co robi + kontrolka** (wiersz ustawień `srow`).
- **Bez emoji** — tylko ikony liniowe z `icons.js`.
- **Foldery** na dużych stronach: lista po lewej, jeden folder po prawej, ostatni zapamiętany.
- **Ekran ładowania**: logo, pasek postępu i komunikat (łączenie → wczytywanie → gotowe);
  gdy serwer nie odpowiada 9 s — podpowiedź.
- **Logo**: fioletowo-turkusowy kafelek z lampą i snopem światła (SVG w stronie, ICO dla skrótu).

Najważniejsze klasy w `ui.css`: `.btn` / `.btn.primary` (przyciski), `.seg` (przełącznik kilku
opcji), `.switch` (włącz/wyłącz), `.card`, `.sgroup` + `.srow` (grupy i wiersze ustawień),
`.fold` / `.fold-nav` / `.fold-pane` (foldery), `.dmod` / `.dch` (pulpit), `.item-row` (listy),
`.diag-row` (diagnostyka), `.ov-card` (przegląd).

---

## 9. Zakładki i foldery

| zakładka | co tam jest |
|---|---|
| **Scena 3D** | lampy w 3D, klik = wybierz, Ctrl+klik = zaznacz kilka, Shift+klik w podłogę = celuj; panel lampy: adres, montaż, wysokość, obrót, **Kalibruj**, **Wszystkie ustawienia**, Usuń |
| **Dłoń** | obraz kamery i szkielet dłoni; tryby Gesty / Śledzenie / Ręcznie; lista gestów i Moje gesty |
| **Mikser** | foldery: **Pulpit** (sekcja na urządzenie, suwak na każdy kanał, FLASH, ŚRODEK, widok Wszystkie / jedno urządzenie, Kompakt), **Sceny świateł** (zapisz obecny wygląd, klik = przywróć płynnie), **Kolor i pozycja** (pad pan/tilt, koło barw, gotowe kolory, koło kolorów i gobo lampy, środek, zeruj) |
| **Kamera sceny** | druga kamera, mapa sceny z góry, osoby i obiekty, świecenie na wybraną osobę |
| **Muzyka** | foldery: **Autopilot i styl**, **Muzyka na żywo** (wejście z miksera, bity, reakcje), **Efekty** (pad, lampy, rozłożenie, tempo, zasięg), **Oś czasu** (utwór, klatki, auto-show, zapis), **Zapisane pokazy** (otwórz / usuń), **Moje efekty** (zagraj / zmień / usuń / nowy), **Zaawansowane** (przesunięcie światła, tempo BPM z wystukiwaniem, tempo efektów, czułość bitu, przyciąganie klatek, ustawienia auto-show) |
| **Ustawienia** | patrz niżej |

Dolny pasek (zawsze widoczny): urządzenia (klik = wybierz), Master, Dym, Lasery, **Blackout** (klawisz B).
Prawy pasek: aktywna lampa — Master, jasność, ruch X/Y, szybkie kolory.

---

## 10. Ustawienia — wszystkie sekcje i parametry

**Start**
- **Konfigurator** *(4.2)* — przycisk Start robi wszystko po kolei: program, kabel DMX, kamera, kamera sceny, urządzenia (pyta, jaką lampę podłączyłeś, i dodaje ją), test światła i ruchu (pyta, czy widzisz), gesty (pokaż dłoń i palec, z podglądem), zapis, propozycja kalibracji. Każdy krok ma opis, wynik, podpowiedź i „Sprawdź ponownie”.
- **Przegląd** — ile jest gotowe (np. 6 z 9), kafelki prowadzą do tego, czego brakuje; pokaz testowy.

**Sprzęt**
- **Kabel DMX** — rodzaj interfejsu (Wirtualny, uDMX, Art-Net, Enttec Pro, Open DMX), port, IP i universe, Połącz, „Mrugnij wszystkimi”.
- **Urządzenia** — lista z adresem, **Edytuj**, **Kanały**, **Kalibruj**, **Duplikuj**, Usuń, „Mrugnij”; **Ustaw adresy po kolei**; biblioteka urządzeń z filtrem. **Edytuj** otwiera wszystkie parametry:
  nazwa, adres DMX, rodzaj, montaż · pozycja X/Y/Z, obrót podstawy · zakres pan i tilt, odwróć pan/tilt, 16 bit pan/tilt · kąt wiązki, kolory RGB, migawka otwarta, zakres strobo.
- **Kamery** — rola każdej kamery (główna / sceny / nie używaj), kamera IP/telefon, lustro, podgląd.

**Kalibracja**
- **Kalibracja lamp** — przycisk **Kalibruj** przy każdym urządzeniu, „Kalibruj wszystkie po kolei”, „Wszystkie na środek”.
- **Kalibracja dłoni** — zasięg palca (6 s), wypróbuj, kursor dłoni do sterowania programem.
- **Światło na osobę** — miejsca na scenie, dokładność, test „światło za mną”.
- **Scena** — szerokość, głębokość, wysokość konstrukcji, wysokość celu, mapa podłogi z kamery.

**Sterowanie**
- **Gesty i śledzenie** — tryb, czym sterują gesty i śledzenie, celowanie palcem, zakres ruchu (pan/tilt), czułość dłoni, nadążanie, lustro kamery, zasięg dłoni.
- **Ruch i płynność** — profile (Błyskawicznie, Szybko, Płynnie, Kinowo), płynność ruchu, płynność jasności/koloru, silniki lampy, test ruchu.
- **Przyciski i MIDI** — klawisz/pad/pokrętło → akcja (naciśnij, przytrzymaj, pokrętło), stałe skróty.
- **Dym i lasery** — moc dymu, dym automatycznie, co ile, na jak długo, „Dym 3 s”; lasery uzbrojone (po starcie zawsze wyłączone).

**Inne**
- **Ogólne** — język, master, tempo efektów, zapisz ustawienia, przewodnik, pokaz testowy.
- **Wygląd i start** *(nowe)* — wielkość interfejsu (90–125%), animacje (pełne/ograniczone), zakładka po uruchomieniu (w tym „ostatnio używana”), podpowiedzi na ekranie, obraz kamery w zakładce Dłoń, przewodnik przy następnym starcie.
- **Kopia zapasowa** *(nowe)* — pobierz kopię ustawień (plik .json), wczytaj kopię z pliku (działa na żywo, bez restartu; obecne ustawienia zostają jako „poprzednie”), przywróć poprzednie.
- **Diagnostyka** *(nowe)* — stan kamery, rozpoznawania dłoni, kabla DMX, urządzeń (adresy), kamery sceny, połączenia i laserów, z podpowiedzią, co zrobić; **Test systemu** (lampy mrugną, wynik: wszystko działa / ile do sprawdzenia); **Kopiuj raport** (tekst do wysłania komuś, kto pomaga).
- **Zaawansowane** — test pojedynczych kanałów DMX, podgląd wyjścia DMX.

---

## 11. Instalacja, paczka, aktualizacja

- **Na tym komputerze**: `run.bat` (sam tworzy środowisko przy pierwszym starcie).
- **Na innym komputerze**: `pakuj.bat` → plik `dist/Lumo-<data>.zip` → na drugim komputerze rozpakuj
  i uruchom `instaluj.bat` (znajdzie albo zainstaluje Pythona, zainstaluje pakiety — także bez
  internetu, jeśli paczka ma pakiety — i zrobi skrót **Lumo** na pulpicie i w menu Start).
- **Przeniesienie ustawień**: Ustawienia → Kopia zapasowa → Pobierz plik, a na drugim komputerze
  Wczytaj kopię z pliku. Pokazy (`shows`) i własne efekty (`presets.json`) skopiuj razem z nimi.
- **Po aktualizacji plików**: zamknij okno serwera, uruchom `run.bat`, w przeglądarce Ctrl+F5.

---

## 11b. Biblioteka i identyfikacja lamp (4.5)

`fixturelib/model.py` — `SpotlyFixtureDefinition` → `Mode` → `Channel` (`ChannelType`) → `Capability` (min, max, nazwa, znaczenie: open/strobe/color/gobo/sound/auto/reset…). `to_engine_spec()` zamienia wybrany tryb na role silnika DMX (`pan`, `dimmer`, `zoom`, `reset`…); rola sterowana przez silnik (pan, speed, koło kolorów) jest tylko na pierwszym kanale, kolejne dostają `other`.
`adapters.py` — QLC+ (presety i grupy), OFL (capabilities, fine-aliasy), GDTF (DMXMode/LogicalChannel/FTRDM), stara biblioteka.
`search.py` — normalizacja i fuzzy (tokeny, prefiksy, SequenceMatcher, „11ch” jako filtr, bonus za źródło).
`matcher.py` — punktacja (liczba kanałów +25, pan/tilt +15, jasność +10, kolor/gobo +10, tekst +20, RDM +40/+60) i plan sprawdzania kanałów.
`service.py` — indeks offline, aktualizacja OFL w tle, moje profile i aliasy (`my_fixtures.json`).
`rdm.py` — pakiety RDM i opis urządzeń; `manual.py` — PDF, tabela kanałów, link do produktu.
Silnik: `Fixture.caps` i `Fixture.defaults` (zapisywane w config.json), wartości domyślne nigdy na reset/lamp/laser.
Frontend: `library.js` (Start, Biblioteka, Kalibracja, adresy, edytor profilu), `simple.js` (Mikser → Proste), `holohand.js` (hologram dłoni), `library.css`.

## 12. Jak testowałem

- **Osobny serwer testowy** na porcie 8011 (kopia plików w folderze tymczasowym, wirtualny DMX przez
  Art-Net na 127.0.0.1, bez kamery) — żeby nie ruszać Twojego kabla i Twojej konfiguracji.
- **Testy w przeglądarce** (automatycznie, na tym serwerze):
  - pulpit: suwak 0→255, FLASH (255 przy wciśnięciu, powrót po puszczeniu), ŚRODEK = 128, grupa rusza lampy, a dym pomija;
  - ustawienia: zapis każdego parametru urządzenia, wszystkie 17 sekcji się otwiera, duplikowanie, adresy po kolei (usuwa nałożenie), kopia: eksport → import na żywo → przywrócenie;
  - muzyka: wczytanie utworu (tempo 124 BPM wykryte jako 124,1), auto-show, zapis pokazu → lista pokazów → otwarcie na osi czasu, własny efekt → lista → Zagraj/Zatrzymaj, kopiuj/wklej/cofnij na osi czasu;
  - diagnostyka i test systemu; przewodnik (17 kroków); brak błędów w konsoli; wersja włoska bez polskich słów.
- **Testy Pythona**: kalibracja na osobę (błąd 0,66°), gesty na sztucznych pozach, efekty z wygaszaniem kicków, analiza utworu, zapis konfiguracji z uszkodzonym wpisem.
- **Czego nie da się sprawdzić bez sprzętu**: prawdziwa lampa w ruchu, dym, kontroler MIDI, gesty na żywo przy kamerze 30 fps, instalacja na czystym komputerze.

---

## 13. Historia wersji w skrócie

| wersja | co doszło |
|---|---|
| 1 | sterowanie głowicą dłonią, DMX, konfiguracja lampy |
| 2 | scena 3D, gesty 3D, własne gesty, autopilot, reflektor na osobę, edytor pokazu, instalator |
| 2.1 | konfiguracja krok po kroku, światło na osobę, przyciski i MIDI, podłącz i działa |
| 3 | zakładki na górze, oś czasu jak After Effects, auto-show, kanały urządzenia, dym, sceny świateł, przewodnik |
| 3.1 | pulpit z sekcją na urządzenie, modele 3D dymu/PAR/strobo, bezpieczny zapis |
| 4 | nazwa Lumo, logo, ekran ładowania, jasny wygląd, Ustawienia jak w aplikacji z edytorem urządzeń i przyciskami Kalibruj, nowa oś czasu |
| 4.1 | **foldery** w Muzyce i Mikserze, Zapisane pokazy, Moje efekty, Zaawansowane (muzyka), Wygląd i start, Kopia zapasowa, Diagnostyka, Duplikuj, Ustaw adresy po kolei |
| 4.2 | **Konfigurator** jednym kliknięciem; wybór Gesty/Ręcznie wyłącza reflektor na osobę; start zawsze w trybie Gesty |
| 4.3 | lampy z QLC+ („czy to ta lampa?”), wykrywanie QLC+, Oddaj / Przejmij kabel |
| 4.4 | „Kabel i lampa” — doktor, który sprawdza i sam naprawia kabel oraz lampy; pełne ramki 512 kanałów; niezależne suwaki powtórzonych kanałów w mikserze |
| 4.5 | hologram dłoni 3D z kartą głębi, wybór kamery do gestów, płynniejsze gesty; biblioteka lamp (QLC+ / OFL / GDTF / moje), wyszukiwarka, sprawdzanie profilu kanałami, kalibracja nieznanej lampy, adresy, edytor profilu, Mikser → Proste, RDM, testy |
| 4.6 | nazwa Lumo, logo, preloader, animacje, instalator Lumo-Setup.exe, gesty z uzbrajaniem i cofaniem, ustawienia gestów, kierunek ↔ ↕, kalibracja na mnie (kciuk w górę/dół), włącznik urządzeń |
| 4.7 | automatyczna kalibracja na osobie (jasność sylwetki), styl „Uderzenia”, tylko białe, lasery w bit na szybkich fragmentach, klocki Błysk/Laser w bit, prostszy układ bez dubli |
| 4.8 | nowy wygląd, mapa połączeń 1-2-3, blackout gasi wszystko, laser jak lampa, styl Automatyczny, reflektor ręczny i z osi czasu |

## 14. Ograniczenia i pomysły na dalej

- Lampy DMX nie mówią, czym są (brak RDM w tych kablach) — model wybierasz z biblioteki, a kanały sprawdzasz w oknie „Kanały”.
- Jakość gestów zależy od kamery: 30 fps i dobre światło dają najszybszą reakcję.
- Pomysły: tryb ciemny jako opcja, zmiana nazwy pokazu na liście, eksport pokazów do jednego pliku, wiele universe DMX.
