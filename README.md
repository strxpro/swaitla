# Lumo — światło sterowane dłonią

## Uruchomienie na innym komputerze (Windows 10 / 11)

1. Zainstaluj **Git** (git-scm.com) i otwórz wiersz poleceń w folderze, w którym ma być Lumo.
2. Pobierz program:
   `git clone -b lumo-5 https://github.com/strxpro/swaitla.git Lumo`
3. Wejdź do folderu `Lumo` i kliknij dwukrotnie **`run.bat`**. Za pierwszym razem sam:
   - znajdzie Pythona 3.10+, a jeśli go nie ma, zaproponuje instalację;
   - zainstaluje pakiety (kilka minut, potrzebny internet);
   - zrobi skróty na pulpicie;
   - otworzy Lumo w przeglądarce.

Aktualizacja: w folderze `Lumo` wpisz `git pull` i znów uruchom `run.bat`. Jeśli działa jeszcze stara
wersja, `run.bat` sam ją zamknie i uruchomi nową. Twoje lampy są w `config.json`. Klucz AudD
(opcjonalny) zapisuje się tylko lokalnie w `audd_key.txt` i nigdy nie trafia do gita.

## Wersja 5 — zakładka „Pokaz”: AI słucha muzyki i prowadzi światła

**Jeden przycisk.** Pokaz → wybierz źródło dźwięku (wyjście miksera, wejście liniowe, mikrofon) → **Start pokazu**.
Lumo łapie rytm, rozpoznaje, co gra, i sam układa światła. Zakładka otwiera się jako pierwsza.

- **Idealnie w rytm.** Nowy detektor bitu działa w AudioWorklet, więc nie zwalnia, gdy okno jest w tle.
  Tempo liczy z autokorelacji uderzeń, fazę z „grzebienia” ostatnich 8 bitów i łagodnej pętli PLL.
  Przewiduje **następny** bit, zamiast reagować z opóźnieniem. Serwer ma własny zegar bitów
  (`rhythm.py`): efekty odpalają się na przewidzianym bicie, wcześniej o opóźnienie lamp.
  Wszystkie efekty z `beats` zaczynają cykl na tej samej kresce taktowej. Wykrywa też „raz” w takcie.
- **Synchronizacja** (Pokaz → Synchronizacja): światła błyskają na każdy bit. Suwakiem ±ms ustawiasz,
  żeby błysk i stopa perkusji były w tym samym momencie. Jedna wartość obowiązuje dla grania na żywo
  i dla osi czasu.
- **Części utworu**: intro, zwrotka, refren, narastanie, **drop** (wykrywany już na pierwszym kicku),
  wyciszenie, cisza. Widać je na mapie utworu pod tytułem.
- **AI (offline, za darmo)**: model Google **YAMNet** (`models/yamnet.tflite`, MediaPipe) co sekundę
  rozpoznaje gatunek (elektronika, rock, pop, hip-hop/R&B, filmowa/klasyczna, jazz, folk, latino,
  świąteczna, ambient), nastrój, wokal, instrumenty i oklaski. Zauważa też, że zaczął się nowy utwór.
- **Tytuł utworu (opcja, internet)**: Pokaz → Rozpoznawanie utworu → klucz **AudD**
  (darmowy na dashboard.audd.io). Przy nowym utworze Lumo wysyła 8 s dźwięku do api.audd.io i pokazuje
  wykonawcę, tytuł i gatunek z Apple Music. Klucz zostaje na tym komputerze i nie trafia do kopii ustawień.
- **Reżyser AI** (`director.py`): 7 stylów (**Auto AI**, Kino, Koncert, Klub, Chill, Elegancja, Rave),
  23 „wyglądy” (np. Ballyhoo, Krzyżowy ogień, Premiera, Zorza, Burza, Złota godzina, Pościg w bit, Stutter).
  Paletę kolorów dobiera do gatunku i nastroju. Co frazę zmienia wygląd, a nowy wygląd **morfuje** ze
  starego. W **narastaniu** wiązki wspinają się, kolory przechodzą w biel, a błyski przyspieszają.
  Na **dropie** daje blinder i (w klubie / koncercie / rave) strobo. W **wyciszeniu** przechodzi
  w filmowy wygląd. Suwaki: płynność przejść (cięcia ↔ długie morfingi) i energia. Do tego
  „Następny wygląd”, „Zatrzymaj wygląd” oraz szybkie akcje: Blinder, Strobo (przytrzymaj),
  Blackout, Dym, Reflektor.
- **Nowe efekty** (też w Muzyka → Efekty i na osi czasu):
  - ruch: ballyhoo, krzyżowy ogień, reflektory premiery, na publiczność, lustro, wznoszenie,
    morfing kształtów;
  - kolor: morfing kolorów (przez OKLab, bez szarości po drodze), dwie strony, świt, zorza, noir,
    świece, policja, do bieli;
  - jasność: blinder, pościg w bit, schody, stutter, riser, błyskawice, gwiazdy, stałe światło.

  Każdy efekt może płynnie przejść z poprzedniego (`morph` / `morph_beats`).
- **Kalibracja świateł w minutę na lampę**: Pokaz → Kalibracja świateł albo Ustawienia → Start →
  „Szybka kalibracja wszystkich świateł”. Dla każdej lampy kreator:
  1. Prosi o potwierdzenie, że to ta lampa (mruga).
  2. Prosi o naprowadzenie światła na **środek parkietu** (pole + strzałki). Wokół tego punktu
     toczy się pokaz.
  3. Sprawdza kierunki **w prawo** i **w górę** („Nie, w drugą stronę” poprawia sam).
  4. Sprawdza kolory.
- **Wygląd „Lux”** (`static/lux.css`): ciepła, spokojna baza, jeden głęboki fiolet, eleganckie tytuły
  (Fraunces). W górnym pasku jest mniej przycisków, stan połączeń to same kropki, a panel suwaków
  znika tam, gdzie przeszkadzał (Pokaz, Muzyka).

Pliki: `rhythm.py` (zegar bitów), `director.py` (reżyser), `musicai.py` (AI i tytuł),
`static/beatcore.js` + `static/beatworklet.js` (detektor bitu), `static/live.js` (zakładka Pokaz),
`static/lux.css`.

Uwaga: tor audio i AI przetestowano na syntetycznych utworach (100, 126, 128 i 174 BPM). Bardzo
szybkie DnB (174) bywa prowadzone w połowie tempa (87). Przed imprezą zrób próbę z prawdziwym
wejściem z miksera i lampami, a potem ustaw Synchronizację.

## Pokaz na żywo i wiele lamp

- W **Muzyka → Autopilot** wybierz wejście miksera i kliknij **Start pokazu na żywo**.
  Tryb Auto dobiera styl do energii muzyki i wykrywanego BPM. Ciche fragmenty
  łagodnie przygaszają światła i zwalniają ruch, a cisza lub utrata danych audio
  wygasza automatyczne efekty. Przy powrocie sygnału jasność płynnie wraca.
- Szybsze fragmenty wykorzystują naprzemienne lampy, pojedynczy pościg i pary
  symetryczne. Ruch zachowuje fazę przy zmianie BPM. Tempo jest szacowane z
  regularnych uderzeń; po przerwie detektor zbiera je ponownie.
- W **Konfiguracja** na mapie połączeń użyj **Dodaj kopię wybranej lampy**.
  Kopia dostaje pierwszy wolny zakres DMX; przy braku miejsca pojawi się błąd.
  Ustaw ten sam adres i tryb kanałów na fizycznej lampie — zwykły DMX nie
  programuje automatycznie jej panelu. Nowa lampa dołącza do efektów dla wszystkich.
- **Shift + klik** na lampach zaznacza grupę. **Gesty → zaznaczone światła**
  uruchamia wspólne sterowanie tą grupą; **Gesty → wszystkie światła** obejmuje
  całą instalację. Pusta grupa niczego nie steruje. Lasery i dymiarki są pomijane.
  Układ, zaznaczenie i zakres gestów zapisują się automatycznie.

Analiza na żywo działa w otwartym panelu przeglądarki z dostępem do wejścia audio.
Testy programowe obejmują ciszę, utratę sygnału, BPM, grupy i adresowanie;
rzeczywiste oprawy i tor audio wymagają próby na docelowej instalacji.

Testy: `python -m unittest discover -s tests -v` oraz `node --test tests/test_live_audio.cjs`.

(dawniej PHOTON/HAND)

Lokalna aplikacja (FastAPI + WebSocket + HTML5 Canvas) do sterowania wirtualnymi i fizycznymi
ruchomymi głowami DMX za pomocą MediaPipe Hands (21 punktów dłoni) oraz trackerów OpenCV (CSRT/KCF).

```
┌──────────────┐  frames  ┌─────────────────────┐ perception ┌───────────────────┐  40 Hz  ┌───────────────┐
│ VideoSource  │ ───────▶ │ VisionProcessor     │ ─────────▶ │ InteractionCtrl   │ ──────▶ │ DMXEngine     │──▶ SIM / Art-Net /
│ (USB/IP/RTSP)│  thread  │ MediaPipe / CSRT    │   thread   │ gest → parametry  │         │ smoothing     │    Enttec / OpenDMX
└──────────────┘          └─────────┬───────────┘            └───────────────────┘         └──────┬────────┘
                                    │ JPEG + JSON (30 Hz)          ▲ komendy JSON                 │ state
                                    ▼                              │                              ▼
                              ┌────────────────────── Browser (index.html / app.js) ─────────────────────┐
                              │ HUD canvas · wirtualna scena · fadery (motorized) · XY pad · koło barw   │
                              └───────────────────────────────────────────────────────────────────────────┘
```

## Pliki

| plik | rola |
|---|---|
| `main.py` | serwer FastAPI, WebSocket `/ws`, CLI, zapis konfiguracji |
| `vision.py` | menedżer wideo (przełączanie źródeł w locie), MediaPipe Hand Landmarker, klasyfikator gestów, tracker OpenCV, wątek przetwarzania |
| `interaction.py` | mapowanie gestów / trackera na parametry DMX (strefy, dwell-select, crossfade, strobe) |
| `dmx_controller.py` | klasa `Fixture`, silnik DMX 40 Hz, backendy: symulacja, Art-Net, ENTTEC Pro, FTDI Open DMX |
| `stage.py` | model sceny 3D: mapa kamera→podłoga (homografia), kinematyka głowic (IK/FK), solver pozycji |
| `calibration.py` | auto-kalibracja pozycji lampy kamerą |
| `tracking.py` | śledzenie osoby / przedmiotu z automatycznym odnajdywaniem + druga kamera sceny |
| `spotlight.py` | reflektor na osobę (wszystkie lampy, białe koło, automatyczne szukanie) |
| `devices.py` | plug & play: rozpoznawanie kabli USB-DMX i kamer |
| `static/keys.js`, `static/tracklist.js`, `static/fx.js`, `static/icons.js` | przyciski / MIDI · lista osób · animacje · ikony |
| `static/setup.js`, `static/gestures2.js` | konfiguracja krok po kroku · kreator własnych gestów |
| `effects.py` | 35 efektów (ruch, kolor, jasność, gobo) zsynchronizowanych z BPM + własne efekty (`presets.json`) |
| `static/music.js`, `static/stagecam.js` | edytor muzyki i pokazów · zakładka „Kamera sceny” |
| `make_package.py`, `pakuj.bat`, `instaluj.bat`, `odinstaluj.bat` | paczka instalacyjna na inny komputer |
| `static/index.html`, `static/app.js`, `static/style.css`, `static/ui.css` | panel webowy (bez Node/npm); `ui.css` = wygląd wersji 4 |
| `static/desk.js` | Mikser — pulpit z sekcją na każde urządzenie |
| `static/stage3d.js`, `static/vendor/` | widok 3D (three.js r170 dołączony lokalnie, działa offline) |
| `config.json` | tworzony przyciskiem **SAVE CONFIG** (oprawy, kalibracja, źródło) |
| `models/hand_landmarker.task` | model MediaPipe – pobierany automatycznie przy pierwszym starcie |

## Wersja 2 — co gdzie jest

Po lewej panel z zakładkami (każda ma krótki opis), u góry tytuł strony i jedno zdanie, do czego służy, oraz dwa szybkie przełączniki:
**🔦 Reflektor na osobę** i **🤖 Autopilot**.

| zakładka | do czego |
|---|---|
| Scena 3D | lampy w 3D. Klik = wybierz, **Ctrl+klik = zaznacz kilka** (niebieski pierścień), „Zaznacz wszystkie”. ✦ przy nazwie = na lampie działa efekt |
| Dłoń | gesty / śledzenie osoby / ręcznie, lista gestów i **Moje gesty** (+ Utwórz gest) |
| Mikser | suwaki kanałów, kolor, koło kolorów i gobo wybranej lampy |
| Kamera sceny | druga kamera: kto gdzie stoi, oznaczanie osób, świecenie na nie |
| Muzyka i pokazy | **Autopilot i styl**, na żywo z miksera, pad efektów, edytor pokazu |
| Konfiguracja | **krok po kroku**: kabel DMX → lampy → kalibracja lamp → kamera → **kalibracja dłoni** → **prędkość i płynność** → scena → gotowe (+ zaawansowane: test kanałów, monitor DMX) |

### Konfiguracja krok po kroku
- Każdy krok ma opis, stan na żywo i jeden wyraźny przycisk; zielony ✓ = gotowe, pomarańczowy = warto sprawdzić.
- **Kalibracja lamp**: „Kalibruj wszystkie po kolei” uruchamia kreator dla każdej ruchomej głowy jedna po drugiej.
- **Kalibracja dłoni**: Start → przez 6 s dotknij palcem czterech rogów swojego zasięgu. Mały ruch dłoni obejmuje potem całą scenę.
- **Prędkość i płynność**: profile Błyskawicznie / Szybko / Płynnie / Kinowo albo suwaki (płynność ruchu, jasności, kanał prędkości silników lampy, czułość dłoni).

### Gesty
- Gest „Wskaż” nie myli się już z pięścią: palce są oceniane po kątach stawów w 3D (celowanie palcem w kamerę działa), pięść musi być wyraźna.
- **+ Utwórz gest**: 1) rodzaj — ✋ poza, ↔ poza + ruch, 🙌 dwie dłonie, 2) nagranie z podglądem kamery: odliczanie 3 s i **trzymanie pozy 5 s**, 3) działanie, 4) nazwa.
- **Poza + ruch**: trzymasz pozę i przesuwasz dłoń — lewo/prawo i góra/dół sterują wybranymi rzeczami (jasność, ruch lampy w poziomie / pionie, kolor, strobo, master, tempo efektów).
- **Dwie dłonie**: każda dłoń swoją pozę, akcja dopiero gdy obie razem.
- Akcje: blackout, pełna jasność, wygaś, flash, strobo, środek, następna lampa, kolor, efekt (także własne), stop efektów, reflektor na osobę, autopilot (ze stylem).

### Autopilot, style i kolory
- Style: 🌙 Spokojny, ⚡ Dynamiczny, 💃 Taneczny, 🔥 Rave. Paleta kolorów (do 8, gotowe zestawy: Neon, Ciepłe, Zimne, Tęcza, Klub, Biel).
- Autopilot działa z muzyką na żywo albo z utworu na osi czasu: co frazę zmienia ruch, kolor i jasność, w stylu tanecznym / rave błyska na każdy bit, na dropie strobo.
- „Czasem reflektor na osobę” — w spokojniejszych momentach wszystkie lampy na chwilę świecą białym kołem na osobę.
- ✨ Auto-show na osi czasu też używa wybranego stylu i palety.

### Reflektor na osobę
Wszystkie lampy: białe światło, gobo otwarte (ostre koło), pełna jasność, bez strobo — i jadą za osobą. Osoba z kamery sceny (albo kamera główna przechodzi w śledzenie i sama łapie osobę; zgubioną szuka ponownie). Wyłączenie przywraca poprzedni tryb.

### Edytor pokazu
- **🥁 Na każdy kick** = jedna klatka „Kicki”: każdy kick błyska i **gaśnie do zera przed następnym** (suwak „Jasność między kickami”, zanik krótki/długi). Efekty jasności idą prosto na wyjście, bez wygładzania — bez opóźnienia.
- Każda klatka: **Wejście / Wyjście** (w bitach) i **Krzywa** (łagodnie, równo, powoli→szybko, szybko→powoli) — np. dwie klatki „Pozycja” z wejściem = płynny przejazd światła.
- Odtwarzanie od środka klatki startuje efekt we właściwym miejscu. **Sync światła ± ms** przesuwa światło względem dźwięku.
- Klatka może grać na wszystkich lampach, jednej albo **zaznaczonych**; pad efektów też („Efekty na: wszystkie / zaznaczone”).

## Wersja 2.1 — nowości

- **Wygląd „konsola”**: czcionki IBM Plex + Barlow, własne ikony (bez emoji), pasek sygnału *Kamera → Wizja → DMX → Lampy* z liczbami na żywo (fps, ms, Hz) i animowanym przepływem, przyciski-klawisze z diodą (Reflektor, Autopilot), animacje kliknięć, przejść i komunikatów.
- **Konfiguracja krok po kroku** (11 kroków z osią postępu): kabel DMX → **Urządzenia** (biblioteka: głowice, PAR, belki, strobo, dym, lasery — klik = dodaj) → **Kalibracja urządzeń** (głowice: kreator; reszta: test światła, kolorów, strobo, ruchu, dymu) → **Kamery** (każdej kamerze rola: główna / sceny / nieużywana) → kalibracja dłoni → **Światło na osobę** → prędkość → scena → **Przyciski i MIDI** → gotowe.
- **Światło na osobę (kalibracja śledzenia)**: stań w miejscu na scenie, strzałkami (na ekranie albo klawiaturze, Shift = dokładnie) naprowadź światło na siebie i potwierdź przyciskiem, **Enter** albo **kciukiem w górę przez 1 s**. Zrób to w 4–6 miejscach (cztery rogi + środek) dla każdej lampy. Program dopasowuje dokładne przejście kamera → pan/tilt dla każdej lampy osobno i pokazuje dokładność w stopniach; śledzenie osoby (kamera główna albo kamera sceny) używa tego od razu.
- **Kreator lampy — „Nie działa”**: przy sprawdzaniu kierunku można kliknąć w polu testowym (lampa celuje w punkt) i wybrać naprawę: odwrócone lewo/prawo, odwrócona góra/dół, zamienione osie (pan ↔ tilt), ponowne ustawienie rogów, lampa się nie rusza.
- **Śledzenie**: w widoku Dłoń → Śledzenie po prawej lista wykrytych osób ze **zdjęciami na żywo**, numerami i oznaczeniem „ŚLEDZĘ”; osoby, które wyszły z kadru, zostają wyszarzone ze zdjęciem.
- **Przyciski i MIDI**: dowolny klawisz albo przycisk / pokrętło kontrolera MIDI → blackout, flash, strobo (także „przytrzymaj”), kolor, efekt, autopilot ze stylem, reflektor, master / jasność / tempo z pokrętła. „Dodaj przycisk” → naciśnij klawisz → wybierz akcję.
- **Plug & play**: podłączenie kabla USB-DMX (FTDI Open DMX, ENTTEC Pro, uDMX) jest rozpoznawane i łączone automatycznie; nowa kamera pokazuje komunikat z nazwą. (Same lampy DMX nie mówią, czym są — dodaje się je z biblioteki i sprawdza testem.)
- **Szkielet dłoni**: przy rozpoznaniu gestu fala z dłoni, kości świecą w kolorze gestu, przy celowaniu ślad za palcem.

## Wersja 4.8 — nowy wygląd, mapa połączeń, mądrzejsza muzyka

- **Nowy wygląd „Lumo 5”** (`static/theme.css`): szklany pasek, zakładki-pigułki z gradientem, większe przyciski i karty, w trybie prostym bez zbędnych opisów.
- **Mapa połączeń** (Ustawienia → Start i Moje lampy): Komputer → Kabel DMX → urządzenia 1, 2, 3… w kolejności adresów, płynący sygnał, kolor i jasność każdej lampy na żywo, konflikty na czerwono, kamera; klik = urządzenie mruga i zostaje wybrane; włącznik na każdym.
- **Blackout gasi wszystko**: także lampy bez kanału jasności (same RGB), programy/auto, dym i lasery; głowy zostają tam, gdzie celują. Master przyciemnia też lampy bez kanału jasności.
- **Laser jak lampa** (Mikser → Proste): Uzbrój, Włącz/Wyłącz, kolory (czerwony, zielony, żółty = oba), programy lasera; kolor i świecenie lasera widać na dolnym pasku, w 3D i na mapie.
- **Styl „Automatyczny”** (domyślny autopilota): czyta energię muzyki — cicho = spokojnie z płynnym wygaszaniem i powolnym przejściem ruchu, głośniej = dynamicznie, szybko i głośno = taniec / rave / uderzenia na zmianę, drop = uderzenia; pilnuje, żeby nie powtarzać ciągle tych samych efektów.
- **Reflektor na osobę**: „Śledź osobę” albo „Ustaw ręcznie” (klikasz/przeciągasz na obrazie, gdzie stoi osoba); na osi czasu klocek „Reflektor na osobę” włącza go w pokazie.
- Testy: 35.

## Wersja 4.7 — lampy same Cię znajdują, muzyka w bit

- **Kalibracja na mnie — automatyczna**: kamera mierzy jasność Twojej sylwetki; lampa przeszukuje siatkę pozycji wokół miejsca, gdzie Cię widzi, potem dokładniej; gdy sylwetka wyraźnie rozbłyśnie — zapis i następna lampa. „Szybko — tylko środek” (1 miejsce, mapowanie przesuwane o poprawkę) albo „Dokładnie — 3 miejsca” (wszystkie lampy w jednym miejscu, potem przechodzisz). Kciuk w górę / w dół działa dalej; gdy światła na Tobie nie widać — przejście w tryb ręczny.
- **Muzyka**: nowy styl „Uderzenia” (światło zapala się na każde uderzenie i gaśnie), przełącznik „Tylko białe światło”, „Lasery na szybkie fragmenty” (od 135 BPM, mocny bit albo drop — pulsują w bit, tylko gdy lasery są uzbrojone).
- **Oś czasu / auto-show**: klocki „Błysk w bit”, „Laser w bit” (dokładnie na wykrytych bitach utworu), „Laser włączony”; w auto-show opcje: tylko białe, błysk na każde uderzenie, lasery w bit na szybkich fragmentach.
- **Prościej (tryb prosty)**: Ustawienia = Start, Interfejs DMX, Moje lampy (z „Znajdź model lampy” i „Nie znam modelu”), Konfiguracja / Kalibracja, Kamery, Diagnostyka; Mikser bez zdublowanego „Kolor i pozycja”; Muzyka bez „Moje efekty” / „Zaawansowane”. „Pokaż wszystkie ustawienia” przywraca resztę.
- Testy: 32 (`tests/test_music.py`, automatyczne szukanie w `tests/test_gestures.py`).

## Wersja 4.6 — Lumo

- **Nowa nazwa: Lumo**, nowe logo (lampa, wiązka, plama światła), nowy ekran ładowania (pierścień postępu, animowane litery), płynne animacje w całej aplikacji.
- **Instalator `Lumo-Setup.exe`** (`python make_package.py` → `dist/`): normalne okno instalacji — powitanie, wybór folderu, skróty, postęp z dziennikiem, koniec; Python przez winget, pakiety, wpis w „Aplikacje i funkcje” (odinstalowanie z ustawień Windows). Ustawienia z poprzedniej instalacji zostają.
- **Gesty bez mieszania się**: gest działa dopiero po ~0,3 s trzymania, zmiany z ostatnich 0,25 s przed zmianą gestu są cofane, jasność zmienia się **od obecnej wartości** (bez skoku do wysokości dłoni).
- **Kliknij gest** na liście: włącz/wyłącz, siła (0,2–3×), co steruje (jasność, master, zoom, focus, prędkość, strobo, biały, obrót, pan, tilt, kolor, tempo efektów).
- **Kierunek** w widoku Dłoń: „↔” odwraca lewo/prawo, „↕” góra/dół — dla wybranej lampy.
- **Kalibracja na mnie**: lampa sama znajduje Twoją sylwetkę; kciuk w górę 3 s = zapisz, kciuk w dół = popraw palcem; 3 miejsca na lampę, lampa po lampie. Lasery nigdy nie są celowane w ludzi.
- **Włącz / wyłącz urządzenie** (ikona zasilania na dolnym pasku i przełącznik w „Moje lampy”) — wyłączone dostaje zera i nie reaguje na gesty ani efekty.
- Widok Dłoń: mniej przycisków (rzadkie w „Więcej”).
- **Dodatki do gestów**: w oknie gestu „Dodatkowo — łącz akcje i efekty” (kilka efektów, flash, strobo, dym, kolor, blackout, sceny świateł…), tryb „tylko gdy trzymam gest” albo „raz”, przycisk „Wypróbuj”; „Steruje: — nic” = gest tylko odpala dodatki. Własne (nagrane) gesty też mają dodatki (kliknij gest na liście „Moje gesty”).
- **Adres startowy** do zmiany od ręki: pole z − / + przy każdym urządzeniu w „Moje lampy” i w Mikser → Proste (np. laser, który zaczyna się od innego kanału).
- Testy: 27 (`tests/test_gestures.py` — uzbrajanie, cofanie, ustawienia gestów, odwracanie, włącznik, kalibracja na mnie).

## Wersja 4.5 — każda lampa DMX + hologram dłoni

**Gesty i dłoń**
- Dłoń jako **hologram 3D**: szklane kości, świecące stawy, przezroczysta dłoń z siatką, linie skanowania; bliższe kości są grubsze i jaśniejsze.
- Karta 3D w rogu: prawdziwe współrzędne dłoni (MediaPipe world), obracasz ją przeciąganiem; pokazuje **odległość od kamery**, gest, palce.
- Jasne tło zamiast czarnego (gradient + perspektywiczna siatka), jasne etykiety i ikony lamp.
- **Wybór kamery do gestów** prosto w widoku Dłoń („Kamera do gestów” + „Szukaj kamer…”).
- Płynniej: filtr 1€ także na współrzędnych 3D, dłoń nie znika przy 1–2 zgubionych klatkach, wygładzanie w przeglądarce dopasowane do rzeczywistego FPS kamery.
- Ostrzeżenie, gdy kamera daje < 15 kl/s (np. Iriun w ciemności ~8 kl/s) — z podpowiedzią co zrobić.
- Lista gestów bez zbędnego tekstu (opis tylko przy aktywnym geście i w dymku).

**Biblioteka i identyfikacja lamp** (`fixturelib/`)
- Wspólny model `SpotlyFixtureDefinition` (tryby, kanały z `ChannelType`, zakresy/capabilities, fizyka, źródło, pewność).
- Adaptery: **QLC+ .qxf** (1730 profili z instalacji QLC+ — offline od razu), **Open Fixture Library** (lista ~650 lamp pobierana w tle raz w tygodniu, pojedyncza lampa pobierana przy pierwszym użyciu i zapamiętywana), **GDTF** (import pliku .gdtf), stara biblioteka Lumo, **moje profile**.
- Indeks w `cache/library_index.json`, przebudowa w tle — start nie czeka na internet.
- Wyszukiwarka odporna na literówki, spacje, myślniki („MH-3” = „mh 3”), „30 W” = „30W”, „11ch” jako filtr; aliasy zapisywane lokalnie.
- **„Nie jestem pewien — sprawdźmy (30 s)”**: gdy kilka profili ma tyle samo kanałów, Lumo podnosi po kolei kanały, które je rozróżniają, i pyta, co zrobiła lampa.
- **Kalibracja krok po kroku** (Ustawienia → Konfiguracja / Kalibracja): adres, liczba kanałów (+ test pomocniczy), potem każdy kanał: suwak 0–255, −/+, „Co robi ten kanał?” (16 dużych przycisków), „Automatycznie sprawdź kanał” (0–192, nigdy więcej), na bieżąco „92% pasuje: …” z przyciskiem Zastosuj; na końcu **Zapisz jako moje urządzenie** („Learn this fixture”).
- Bezpieczeństwo: nic nie jest stosowane bez kliknięcia; sondowanie maks. 192; kanały reset / lamp control / laser nigdy nie dostają automatycznej wartości (także w silniku DMX).
- **Instrukcja PDF** (tekst czytany bez dodatkowych bibliotek) → wykryta tabela kanałów → podgląd → kalibracja z uzupełnionymi funkcjami. **Zdjęcie tabeli** — Lumo nie ma OCR/AI, więc zdjęcie stoi obok edytora. **Link do produktu** — nazwa ze strony, wyszukiwanie, linki do PDF.
- **RDM**: pełna architektura (pakiety, DEVICE_INFO, etykiety, osobowości, dopasowanie po ID producenta/modelu), ale kabel Open DMX jest jednokierunkowy — Lumo mówi to wprost zamiast udawać.
- **Adresy DMX** w „Moje lampy”: pasek zajętości, zakresy, „KONFLIKT DMX” i **Znajdź wolny adres**; **Edytuj profil** (CH / funkcja / domyślnie / zakresy, przeciąganie wierszy).
- **Mikser → Proste**: kontrolki tworzone z profilu (XY, kolor, biały, jasność, strobo, gobo, koło kolorów, zoom/focus, pryzmat, SOUND/AUTO, LASER domyślnie wyłączony). Pełny pulpit to teraz „Zaawansowane / RAW DMX”.
- **Ustawienia → Start**: sześć dużych kafelków (Interfejs DMX, Moje lampy, Biblioteka, Konfiguracja/Kalibracja, Język, Diagnostyka).
- Testy: `.venv\Scripts\python -m unittest discover -s tests -v` (19 testów).

## Wersja 4.4 — kabel i lampa działają same

- **Ustawienia → Kabel DMX → „Kabel i lampa”**: jeden przycisk „Sprawdź i napraw”. Sprawdza kabel USB‑DMX (nazwa i numer S/N),
  inne programy (QLC+), tryb kabla (Open DMX), połączenie, czy dane naprawdę wychodzą z kabla, ramki, Blackout, Master, jasność
  i adresy lamp. Co się da — naprawia sam; resztę opisuje zdaniem z przyciskiem „Napraw”.
- Doktor uruchamia się sam 3 s po starcie i zawsze, gdy połączenie z kablem padnie na dłużej niż 6 s.
- Dla każdej lampy instrukcja, co ustawić na jej wyświetlaczu (gniazdo DMX IN, adres A012/d012, tryb 11CH, tryb DMX zamiast Sound/Auto).
- **Pełne ramki 512 kanałów** jak w QLC+ (wcześniej krótkie ramki — części lamp to nie odpowiadało). Krótkie ramki można włączyć komendą `short_frames`.
- Kabel D2XX: czekanie na koniec ramki bez obciążania procesora, większy margines przed kolejnym BREAK, wykrycie „kabel przyjmuje, ale nie wysyła”.
- **Mikser**: powtórzone funkcje (np. 4 silniki wiązek i 2× RGBW w Dragonfly) oraz biały LED mają teraz osobne suwaki — ruszenie jednego nie przesuwa innych.
  Taki suwak pokazuje „ręcznie”; dwuklik oddaje kanał z powrotem automatyce, „Zeruj pulpit” zdejmuje wszystkie.
- Port zajęty przez inny program pokazuje się jako „zajęty (QLC+?)”, a nie „nie obsługuje 250 kbaud”.

## Wersja 4.3 — lampy z QLC+ i wspólny kabel

- **Lampy z QLC+**: Lumo czyta Twoje pokazy QLC+ (ostatnio otwierane pliki `.qxw`) i proponuje: „Znalazłem w QLC+: Little Dragonfly 21CH, adres 1 — czy to ta?”. Jednym kliknięciem dodaje lampę, a złą lampę na tych samych kanałach zamienia. Działa w Konfiguratorze (krok Urządzenia) i w Ustawienia → Urządzenia → **Wczytaj z QLC+**. Zbiorczy „RAW” (np. 1–37 = dwie lampy) jest dzielony na lampy; niepewne dopasowania są oznaczone „do sprawdzenia”.
- **QLC+ i Lumo naraz**: kabel USB-DMX może mieć tylko jeden program. Lumo wykrywa otwarty QLC+ (i inne: Freestyler, DMXControl, MagicQ…) i pokazuje pasek z przyciskami **Oddaj kabel QLC+** / **Przejmij kabel**. Po oddaniu kabla w QLC+ włącz wyjście (Wejście/Wyjście → Universe 1 → DMX USB). Puste „(S/N: )” w QLC+ znaczy, że kabel ma w tej chwili Lumo.
- Diagnostyka pokazuje, czy inny program do świateł jest otwarty.


- **Ustawienia → Konfigurator → Start**: jedno kliknięcie i program po kolei: sprawdza wersję, znajduje i łączy kabel DMX, sprawdza lub ustawia kamerę, wyłącza niedziałającą kamerę sceny, pyta, jaką lampę podłączyłeś (i pod jakim adresem) i ją dodaje, mruga lampami i pyta, czy mrugnęły, rusza głowicami i pyta, czy się ruszyły, włącza Gesty i prosi o pokazanie dłoni i palca (z podglądem kamery), zapisuje ustawienia i proponuje kalibrację. Przy każdym kroku: co robi, co znalazł, co zrobić, gdy coś nie działa, i przycisk „Sprawdź ponownie”.
- Wybranie **Gesty** albo **Ręcznie** (albo „Zwolnij”) wyłącza reflektor na osobę — wcześniej reflektor co chwilę wymuszał śledzenie. Program zawsze startuje w trybie Gesty.
- Gdy nikogo nie ma w kadrze, reflektor szuka osoby rzadziej (mniejsze obciążenie komputera).


- **Foldery**: Muzyka i Mikser mają listę folderów po lewej — jeden folder otwarty, program pamięta ostatni.
  - Muzyka: Autopilot i styl · Muzyka na żywo · Efekty · Oś czasu · **Zapisane pokazy** (otwórz / usuń) · **Moje efekty** (zagraj / zmień / usuń / nowy) · **Zaawansowane** (przesunięcie światła, tempo BPM z wystukiwaniem, tempo efektów, czułość bitu, przyciąganie klatek, auto-show).
  - Mikser: **Pulpit** (cała szerokość) · **Sceny świateł** · **Kolor i pozycja** (duży pad ruchu i koło barw).
- **Ustawienia → Wygląd i start**: wielkość interfejsu, animacje, zakładka po uruchomieniu, podpowiedzi, obraz kamery, przewodnik przy starcie.
- **Ustawienia → Kopia zapasowa**: pobierz wszystkie ustawienia do pliku, wczytaj z pliku na żywo (bez restartu), przywróć poprzednie.
- **Ustawienia → Diagnostyka**: stan każdej części z podpowiedzią, Test systemu, Kopiuj raport.
- **Urządzenia**: Duplikuj, Ustaw adresy po kolei.
- Pełny opis budowy programu: **`ROZPISKA.md`**.

## Wersja 4 — Lumo

- **Nowa nazwa i logo**: program nazywa się **Lumo** (fioletowo-turkusowy kafelek z lampą i snopem światła). Skrót na pulpicie po instalacji: „Lumo” (instalator usuwa stary skrót „PHOTON HAND”).
- **Ekran ładowania**: logo, pasek postępu i co się dzieje (łączenie, wczytywanie lamp). Gdy program nie odpowiada, pokazuje podpowiedź.
- **Nowy wygląd** (jasny, prosty, jak w Canvie): białe karty, jeden fioletowy kolor przewodni, czcionka Figtree, wszystkie napisy normalną pisownią (bez WIELKICH LITER), krótkie opisy przy każdej opcji. Wszystkie style są w `static/ui.css`.
- **Ustawienia jak w aplikacji**: menu po lewej w grupach — *Start* (Przegląd), *Sprzęt* (Kabel DMX, Urządzenia, Kamery), *Kalibracja* (lamp, dłoni, światło na osobę, scena), *Sterowanie* (Gesty i śledzenie, Ruch i płynność, Przyciski i MIDI, Dym i lasery), *Inne* (Ogólne, Zaawansowane). Przy każdej sekcji kropka: zielona = gotowe, pomarańczowa = warto sprawdzić.
  - **Przegląd**: ile jest gotowe (np. 6 z 9) i kafelki prowadzące prosto do brakujących rzeczy.
  - **Urządzenia → Edytuj**: wszystkie parametry urządzenia w jednym miejscu (nazwa, adres, rodzaj, montaż, pozycja X/Y/Z, obrót, zakres pan/tilt, odwrócenie, 16 bit, kąt wiązki, RGB, migawka, zakres strobo). Zmiana zapisuje się od razu.
  - **Osobny przycisk „Kalibruj”** przy każdym urządzeniu (w Urządzeniach, w Kalibracji lamp i w Scenie 3D), plus „Kalibruj wszystkie po kolei”.
  - **Gesty i śledzenie**: tryb, czym sterują gesty i śledzenie, celowanie palcem, zakres ruchu, czułość dłoni, nadążanie za szybkim ruchem, lustro kamery.
  - **Ogólne**: język, master, tempo wszystkich efektów, zapis, przewodnik, pokaz testowy.
- **Oś czasu**: większe ścieżki, zaokrąglone klatki z nazwą i uchwytem do zmiany długości, głowica z dymkiem czasu, pod spodem pasek przewijania i suwak powiększenia.
- **Mikser (pulpit)**: ten sam układ co w 3.1 (sekcja na urządzenie, podpisany suwak na każdy kanał, FLASH, widok Wszystkie / jedno urządzenie, Kompakt), ale w jasnym, czytelnym stylu.
- Brak obrazu z kamery: spokojny ekran „Brak obrazu” zamiast czerwonego „NO SIGNAL”.

## Wersja 3 / 3.1 — nowości

- **Wygląd „scena”** (w wersji 4 zastąpiony jasnym stylem): ciemny grafit ze szczotkowanym wykończeniem, boki i podłokietnik z drewna orzechowego, drewniane gałki suwaków, wyświetlacze LCD i klawisze z diodami. Tekstury są generowane w przeglądarce (nic nie jest pobierane). Zakładki na górze pośrodku.
- **Mikser = pulpit oświetleniowy**: każde urządzenie ma własną sekcję (podpis na taśmie, adres DMX, dioda w kolorze lampy), a każdy kanał DMX swój suwak z nazwą i opisem („PAN — obrót”, „STROBO — migawka”…). Pod suwakiem **FLASH** (pełna wartość, dopóki trzymasz), przy pan/tilt **ŚRODEK**, przy dymie **TRZYMAJ** i **DYM 3 s**. Suwaki same jadą za efektami, gestami i śledzeniem.
  - Klawisze na górze: **Wszystkie** (cały pulpit) albo jedno urządzenie (duże suwaki, urządzenie staje się aktywne).
  - Sekcja **Wszystkie lampy** rusza naraz jasnością, strobo, kolorem, pan/tilt i prędkością wszystkich lamp (dym i lasery pomija).
  - **Kompakt** (węższe kanały; włącza się sam, gdy pulpit się nie mieści) i **Panel boczny** (sceny świateł, pad pan/tilt, koło kolorów). Kółko myszy nad pulpitem przewija go w bok, nad suwakiem zmienia wartość.
- **Ustawienia** zamiast „Konfiguracji”, z przewodnikiem (przycisk **?** u góry): podświetla elementy i mówi, co robią i jak ich używać.
- **Kanały urządzenia**: przy dodawaniu urządzenia od razu otwiera się okno kanałów — funkcje ustawione automatycznie z biblioteki albo typowego układu, suwak testowy przy każdym kanale steruje prawdziwym kanałem DMX.
- **Muzyka jak w After Effects**: zaznaczanie ramką, Shift/Ctrl + klik, **Ctrl+C / X / V / D / A / Z / Y**, strzałki = przesuń o bit, Alt + przeciągnij = kopia. **Auto-show** ma okno opcji: styl, wyłączane kolory i efekty, błysk na każdym kicku, strobo na dropach, energia, rozłożenie na lampy. Długości cykli są zawsze muzyczne (¼…16 bitów).
- **Dym**: sterowanie mocą, „Dym 3 s”, przytrzymanie, automat co N minut; w scenie 3D maszyna dymna ma własny model i puszcza prawdziwą mgłę. PAR-y, strobo i belki mają własne obudowy.
- **Sceny świateł** (Mikser): zapisz obecny wygląd lamp i przywróć go z płynnym przejściem.
- **Bezpieczeństwo zapisu**: uszkodzony wpis urządzenia w `config.json` nie jest już kasowany przy zapisie; usunięte urządzenie znika też z zaznaczenia.
- **Kamery**: brakująca kamera (np. kamera sceny ustawiona na nieistniejący numer) jest sprawdzana rzadko (co 30 s), żeby nie przycinać głównej kamery; po podłączeniu nowej kamery program łączy się od razu.

## Instalacja na innym komputerze

1. Na tym komputerze uruchom **`pakuj.bat`** i wybierz:
   - **1** = czysta instalacja (bez Twoich lamp i pokazów), albo **2** = z Twoimi ustawieniami, własnymi efektami, pokazami i utworami,
   - **Tryb offline: T** = dołącza wszystkie pakiety Pythona (ok. +150 MB), więc drugi komputer nie potrzebuje internetu.
2. W folderze `dist` pojawi się `Lumo-<data>.zip` — skopiuj go (pendrive, dysk w chmurze, e-mail).
3. Na drugim komputerze: rozpakuj ZIP i kliknij dwukrotnie **`instaluj.bat`**. Instalator:
   - znajdzie Pythona 3.10+ (jeśli go nie ma, zaproponuje instalację przez `winget` albo otworzy python.org),
   - utworzy środowisko `.venv` i zainstaluje pakiety (z folderu `wheels` albo z internetu),
   - doda skrót **Lumo** na pulpicie i w menu Start.
4. Uruchamiaj ze skrótu. Kabel DMX FTDI: Windows zwykle sam instaluje sterownik; jeśli nie — sterownik „CDM” z ftdichip.com.

`odinstaluj.bat` usuwa skróty i `.venv` (ustawienia i pokazy zostają w folderze).

## Instalacja (ręcznie, dla programistów)

Wymagany Python **3.10+** (przetestowane na 3.14 z mediapipe 1.0.1 i opencv-contrib 5.0).

```bash
python -m venv .venv
.venv\Scripts\activate            # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python main.py --open
```

Albo na Windows po prostu `run.bat` (sam tworzy `.venv` i instaluje zależności przy pierwszym uruchomieniu).

> Instaluj tylko `opencv-contrib-python` (nie razem z `opencv-python`), bo trackery CSRT/KCF są w module contrib.
> Przy pierwszym starcie potrzebny jest internet, żeby pobrać model dłoni (~7.8 MB) do `models/`.

### Opcje uruchomienia

```bash
python main.py --source 0                                   # kamera USB
python main.py --source 1                                   # Iriun Webcam / DroidCam (wirtualna kamera)
python main.py --source http://192.168.1.20:8080/video      # IP Webcam (Android) / MJPEG
python main.py --source rtsp://user:pass@192.168.1.30/stream
python main.py --mode track --no-mirror
python main.py --host 0.0.0.0                               # panel dostępny z tabletu w LAN
```

Źródło kamery zmienisz też **w locie** w panelu (INPUT · ENGINE → CONNECT, SCAN wykrywa indeksy 0–5).

## Tryby

**GESTURE (MediaPipe Hands)**

| gest | wykrywanie | akcja |
|---|---|---|
| ☝ POINT | wyprostowany tylko wskazujący | czubek palca (pkt 8) = celownik; przytrzymanie 0.6 s na ikonie oprawy → wybór; poza ikonami → Pan/Tilt |
| ✋ OPEN PALM | 4 palce wyprostowane, dłoń wewnętrzną stroną do kamery | wysokość środka dłoni → Dimmer (góra 100 %, dół 0 %) |
| 🤚 BLADE | 4 palce wyprostowane, dłoń krawędzią (wąska dłoń) | pozycja X → crossfade jasności między kolejnymi głowicami |
| ✊ FIST | palce zgięte | stopień zaciśnięcia → strobe (lekko = wolne pulsowanie, ciasno = ~25 Hz); po otwarciu dłoni wraca poprzednia wartość |
| 👌 OK / PINCH | kciuk + wskazujący złączone, pozostałe wyprostowane | przechył dłoni (±70°) → HUE koła barw → RGB |

Gesty są odporne na skalę i obrót, bo wszystkie odległości są dzielone przez długość dłoni.
Klasyfikacja ma debounce (3 klatki), a landmarki są wygładzane (EMA).
Przełącznik **GESTURE → ACTIVE / ALL** decyduje, czy gesty sterują aktywną oprawą, czy wszystkimi.

**TRACK (OpenCV CSRT → KCF → MIL)**: przeciągnij myszą prostokąt wokół osoby lub obiektu (w dowolnym trybie działa też Shift+przeciąganie).
Środek zaznaczenia steruje Pan/Tilt aktywnej oprawy albo wszystkich (**TRACK → ALL**). Prawy klik zwalnia cel.

**MANUAL**: kliknij albo przeciągnij na obrazie, żeby skierować aktywną oprawę. Resztą sterujesz faderami.

Skróty klawiszowe: `G`/`T`/`M` przełączają tryb, `1`–`9` wybierają oprawę, `B` włącza blackout, `H` robi home wszystkich opraw.

## Konsola

- **Hardware link stepper** (górny pasek): `1 VIDEO SOURCE`, `2 VISION ENGINE`, `3 DMX INTERFACE` i `4 FIXTURE LINK`.
  Każdy węzeł ma 3 stany:
  - czerwony `✕` = OFFLINE / NO SIGNAL,
  - bursztynowe skaczące kropki = SYNCING (linia do kolejnego węzła animuje pakiety),
  - zielony `●` = ONLINE, z telemetrią na żywo (np. `1280x720 @ 30 FPS`, `ART-NET 2.0.0.10 · U0 @ 40Hz`).

  Kliknięcie węzła otwiera popover:
  - VIDEO: wybór kamery 0–5, SCAN, URL IP/RTSP, mirror.
  - VISION: tryb, zakres gestów i trackera, wygładzanie.
  - DMX: VIRTUAL / ART-NET / ENTTEC PRO / OPEN DMX, lista portów COM, IP i universe. Przełączanie działa w locie, bez restartu.
  - FIXTURE: wybór oprawy, dodanie, edycja, zapis konfiguracji.
- **FIXTURE / fadery**: grupy POSITION (PAN, FINE, TILT, FINE 16-bit), INTENSITY (DIMMER, STROBE), COLOR (R, G, B), do tego XY pad, koło barw i szybkie kolory.
  Fadery są „zmotoryzowane”: ruch gestem przesuwa suwaki, a suwak pod myszą nie jest nadpisywany przez serwer.
  Dwuklik na torze fadera przełącza 0 / max, kółko myszy zmienia wartość o 1, a z Shift o 10.
- **BLACKOUT** (duży, czerwony, klawisz `B`), **HOME 127/127** (aktywna oprawa), **HOME ALL**, **ZERO ALL** (reset parametrów).
- **PLAYBACK · SUBMASTERS**: dimmer każdej oprawy oraz GRAND MASTER.
- **DMX OUT**: aktualne wartości kanałów, podświetlone kanały aktywnej oprawy i ostrzeżenia o nakładających się adresach.
- **SAVE CONFIG** (popover FIXTURE) zapisuje oprawy, źródło wideo i wybrany interfejs DMX do `config.json`.

## Podłączenie fizycznego DMX

Szczegóły są w docstringu `dmx_controller.py`. W skrócie:

```bash
python main.py --dmx artnet --artnet-ip 2.0.0.10 --universe 0     # węzeł Art-Net (lub broadcast x.x.x.255)
python main.py --dmx enttec --dmx-port COM4                       # ENTTEC DMX USB Pro i klony
python main.py --dmx opendmx --dmx-port COM5                      # FTDI Open DMX (wymaga sterownika VCP)
```

Możesz też ustawić na stałe `ENABLE_PHYSICAL_DMX = True` i `DMX_BACKEND` w `dmx_controller.py`
albo użyć zmiennych środowiskowych (`DMX_ENABLE=1`, `DMX_BACKEND`, `DMX_PORT`, `ARTNET_IP`, `ARTNET_UNIVERSE`).

Zasady bezpieczeństwa:
- **Lasery** zawsze startują zablokowane (przycisk „Lasery: OFF” na dole).
- Gdy włączony jest **BLACKOUT**, na środku ekranu widać czerwony pasek — klik albo klawisz `B` go wyłącza.
- Przy zamknięciu serwera wysyłana jest ramka z dimmerami = 0 (`BLACKOUT_ON_EXIT`).

Dopasowanie oprawy (tryb kanałów z instrukcji głowicy). Najłatwiej przez **EDIT** w panelu. W `config.json` wygląda to tak:

```json
{ "name": "Beam 230", "address": 1,
  "channels": ["pan","pan_fine","tilt","tilt_fine","speed","dimmer","shutter","red","green","blue","white"],
  "shutter_open": 10, "strobe_min": 16, "strobe_max": 131,
  "pos": [-2.0, 5.0, -2.5], "mount": "hang", "yaw": 0,
  "pan_deg": 540, "tilt_deg": 270, "invert_pan": false, "invert_tilt": false, "beam_deg": 14 }
```

## Scena 3D, pozycje lamp i kalibracja kamerą

- Układ osi (widok od publiczności): **X** to lewo(-) / prawo(+), **Y** to wysokość, **Z** to tył(-) / przód(+). Przód sceny jest od strony kamery.
- Pozycję lampy ustawiasz w **EDIT / + ADD**:
  - siatka 3×3 (TYŁ L … PRZÓD P) albo klik na planie sceny,
  - WISZĄCA (truss) albo STOJĄCA (podłoga),
  - wysokość i obrót bazy (w którą stronę patrzy wyświetlacz lampy).
- Aplikacja liczy Pan/Tilt **odwrotną kinematyką**. Każda lampa, niezależnie od miejsca montażu, trafia w ten sam punkt podłogi wskazany palcem, kliknięciem albo trackerem.
- W trybie TRACK światło celuje w stopy osoby plus wysokość `AIM` (domyślnie 1.2 m, czyli tors).
- **KALIBRUJ PODŁOGĘ**: kliknij na obrazie 4 rogi sceny w kolejności PRZÓD-LEWO, PRZÓD-PRAWO, TYŁ-PRAWO, TYŁ-LEWO.
  - Na wideo pojawi się siatka 1 m w perspektywie.
  - W 3D pojawi się przerywany obrys tego, co widzi kamera.
  - Prawy klik na przycisku resetuje mapę.
- **AUTO-KALIBRACJA KAMERĄ** (EDIT istniejącej lampy): kamera sama wyznacza X/Y/Z i obrót lampy.
  - Wymaga prawdziwej lampy i skalibrowanej podłogi.
  - Lampa miga po siatce 3×3 punktów, a program szuka plamy światła na obrazie i dopasowuje pozycję.
  - Błąd dopasowania musi być poniżej 0.6 m, inaczej pozycja nie zostanie zmieniona.
- Widok 3D:
  - LPM obraca, PPM przesuwa, kółko przybliża.
  - Klik na lampę ją wybiera, dwuklik otwiera EDIT.
  - Shift+klik na podłogę celuje aktywną lampą, a Shift+Alt+klik celuje wszystkimi.
  - Kolor wiązki to wartości RGB lampy, a jasność = dimmer × grand master × strobe (× blackout). To samo trafia do DMX.

## Kamera z telefonu

- **Iriun Webcam / DroidCam** (aplikacja na telefonie + klient na PC): telefon widać w Windows jako zwykłą kamerę. W popoverze `1 · VIDEO SOURCE` wybierz CAM 1 lub CAM 2 (albo użyj SCAN).
- **IP Webcam (Android)**: w aplikacji wybierz „Uruchom serwer” i przepisz adres `http://IP:8080`. W popoverze wpisz `http://IP:8080/video` i kliknij CONNECT. DroidCam bez klienta PC: `http://IP:4747/video`.
- Telefon i komputer muszą być w tej samej sieci Wi-Fi.
- Ustaw telefon stabilnie (statyw) przodem do sceny. Po każdym przestawieniu powtórz KALIBRUJ PODŁOGĘ.

## Protokół WebSocket (dla integracji)

Serwer → klient: binarne ramki JPEG i JSON `{"type":"state", fixtures, active_id, blackout, grand_master, dmx, video, vision, interaction}` z częstotliwością ~30 Hz.
Klient → serwer: `set`, `set_many`, `position`, `select`, `blackout`, `grand_master`, `zero`, `home`, `mode`, `source`, `mirror`,
`track_roi`, `track_clear`, `scope`, `follow_all`, `smoothing`, `add_fixture`, `update_fixture`, `remove_fixture`, `save`, `scan_cameras`
(pełna lista w `handle_message()` w `main.py`).

## Muzyka i efekty (zakładka „Muzyka”)

- **Na żywo — kabel z miksera**: wyjście miksera (REC / BOOTH / AUX) do wejścia liniowego komputera. Wybierz wejście, kliknij Start. Aplikacja wykrywa bity (stopa 40–160 Hz), liczy BPM i wykrywa dropy.
- **Reakcje na bit**: flash, zmiana koloru, skok pozycji, strobe na dropie — działają dla wejścia na żywo i dla utworu z osi czasu.
- **Pad efektów**: Ruch (koło, ósemka, wahadło, fala, losowo), Kolor (tęcza, dwa kolory, kolor stały), Jasność (puls, flash, strobe, rozjaśnianie, wygaszanie). Suwaki Tempo i Zasięg.
- **Oś czasu**: wczytaj MP3 / WAV / FLAC → aplikacja sama wyznacza BPM i bity. Wybierz efekt z listy i kliknij na osi, żeby dodać klatkę kluczową (przyciąga do bitu). Przeciągnij klatkę = przesuń, prawy brzeg = długość, Delete = usuń, Spacja = start / pauza, kółko myszy = zoom.
- **✨ Auto-show z bitów**: układa pokaz automatycznie — spokojne części = puls i stały kolor, groove = wahadło i tęcza, głośne = koło i zmiana kolorów, drop = strobe.
- **Zapis**: pokazy trafiają do `shows/*.json`, utwory do `shows/audio/`. Lista zapisanych: Otwórz / Usuń.

Silnik efektów działa w pętli DMX (40 Hz, `effects.py`), więc efekty są zsynchronizowane z wyjściem i po zatrzymaniu przywracają poprzednie wartości lampy.

### Edytor osi czasu — szybkie klatki kluczowe

- Pod falą utworu są pomarańczowe znaczniki **▼ = pojedyncze kicki** (stopa). BPM i siatka bitów wyrównują się do nich automatycznie.
- **🧲 Magnes**: klikasz na oś, a klatka sama przykleja się do najbliższego kicka, bitu albo taktu (widać linię „KICK / BIT / TAKT”). **Alt** = bez magnesu.
- **● Wstaw (K)**: w trakcie odtwarzania naciskaj **K** w rytm — klatki lądują dokładnie na kickach, które właśnie zagrały.
- **🥁 Na każdy kick**: wstawia wybrany efekt (np. Flash) na każdym kicku na widocznym fragmencie; siła flasha zależy od siły kicka.
- Klatka: przeciągnij = przesuń, prawy brzeg = długość, dwuklik = duplikuj, prawy klik = usuń. **Ctrl+Z** cofnij, **Ctrl+C / Ctrl+V** kopiuj / wklej w miejscu głowicy, **Ctrl+D** duplikuj, strzałki = przesuń o bit.
- Panel klatki: długość w bitach (¼…32), **Rytm** (1 cykl = N bitów → efekt idzie równo z muzyką), zasięg, kolory, które lampy.
- Efekty: Ruch (koło, ósemka, wahadło, fala, kwadrat, trójkąt, spirala, odbicia, wachlarz, losowo, pozycja), Kolor (tęcza, pościg, dwa kolory, przejście, ogień, ocean, kolor stały), Jasność (flash, puls, oddech, miganie, serce, iskry, narastanie, strobe, rozjaśnij, wygaś, ciemność), Gobo (gobo, drżenie, obrót).

### Własne efekty (Kreator efektu)

„**+ Własny efekt**” (pad albo oś czasu): **narysuj ruch myszką**, ułóż **sekwencję kolorów**, zaznacz **wzór 16 kroków** jasności (klik = 100 % → 50 % → 0 %), wybierz gobo i tempo w bitach. „▶ Podgląd na lampach” pokazuje efekt na żywo. Zapisane efekty (`presets.json`) są w padzie, na osi czasu (tor „Moje efekty”) i w gestach własnych.

## Śledzenie osoby (zakładka Dłoń → Śledzenie)

- **👤 Śledź osobę** — program sam wybiera osobę w kadrze; albo **kliknij osobę** (przerywane ramki = wykryte osoby), albo przeciągnij prostokąt wokół przedmiotu.
- Gdy osoba zniknie (zasłonięta, wyjdzie z kadru), światło **przewiduje ruch** przez chwilę, potem program **sam jej szuka** (po sylwetce i kolorach ubrania) i łapie ją z powrotem — status „ZGUBIONY — SZUKAM” → „ODNALEZIONY ✓”.

## Kamera sceny (druga kamera)

Zakładka **Kamera sceny**: wybierz drugą kamerę (CAM 1…5 albo adres telefonu przez Wi-Fi). Każda osoba dostaje numer i kolor, jest na **mapie sceny z góry** i jako postać w widoku 3D.
- **Kliknij osobę** = światło na nią (🎯), wpisz jej nazwę (np. „Wokalista”) — po wyjściu i powrocie na scenę program ją rozpozna.
- **Przeciągnij prostokąt** = oznacz przedmiot (konsola DJ, perkusja).
- **Kalibruj podłogę** = kliknij 4 rogi sceny na obrazie tej kamery (przód-lewo, przód-prawo, tył-prawo, tył-lewo) — wtedy pozycje na mapie są w metrach.
- „Pobierz dokładniejsze wykrywanie (≈4 MB)” — model AI (MediaPipe EfficientDet) zamiast wbudowanego wykrywania; lepiej widzi ludzi z daleka i siedzących.
- Źródłem może być też plik wideo (ścieżka do .mp4 / .avi) — przydaje się do prób bez ludzi.

## Tomshine Mini LED Spot (9CH / 11CH)

Profil w bibliotece („Mini LED Spot Moving Head 9CH / 11CH”): pan 540°, tilt 230°, migawka otwarta = 10 (8–15), strobe 16–131, koło kolorów 8 kolorów (0–139, tęcza 140–255), gobo 0–63 / drżenie 64–127 / obrót 128–255, auto zawsze 0 (0–59 = DMX), reset nigdy nie wysyłany.
W Mikserze pod kołem barw są przyciski kolorów koła i gobo tej lampy; kolor wybrany gestem, efektem albo kołem barw sam trafia na najbliższy kolor koła.
Na lampie: `A001` (adres 1), `CHnd` = 9CH, ewentualnie `rPan` / `rtIL` gdy ruch jest odwrócony.

## Kabel FTDI (Open DMX)

Open DMX jest sterowany przez natywny sterownik FTDI (D2XX, pakiet `ftd2xx`), a gdy go brak — przez port COM.
**Kabla może używać tylko jeden program naraz**: jeśli testujesz w QLC+, przełącz tę aplikację na „Wirtualny” (albo ją zamknij) i odwrotnie.
