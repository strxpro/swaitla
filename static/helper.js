/* Lumo — Pomocnik: answers to the usual problems, each with buttons that do the fix.
 * Offline, no account: type what is wrong ("lampa nie świeci", "saksofon", "laser") and pick an answer.
 * Optional AI chat: with a free Google Gemini key (or a Claude key) any question is answered about this
 * rig (the server sends the lights, channels and show state along); buttons under the answer do the fix.
 * Opened from the "Pomoc" button in the top bar.  Uses PH (app.js), ic (icons.js).
 */
'use strict';
(() => {
  const PH = window.PH;
  const { S, send, t, esc, toast } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const L = () => (PH.lang === 'it' ? 1 : 0);

  PH.addI18n({
    pl: { 'hp.btn': 'Pomoc', 'hp.title': 'Pomocnik', 'hp.ask': 'Napisz, co nie działa albo czego szukasz…', 'hp.back': 'Wszystkie tematy', 'hp.none': 'Nic nie pasuje — spróbuj innymi słowami albo wybierz temat z listy.', 'hp.which': 'Która lampa?',
      'ai.askAi': 'Zapytaj AI', 'ai.askHint': 'Napisz pytanie i naciśnij Enter — odpowie AI', 'ai.think': 'Myślę…', 'ai.new': 'Nowa rozmowa', 'ai.topics': 'Gotowe tematy',
      'ai.offTitle': 'Pomocnik AI — odpowie na każde pytanie o Twoje światła', 'ai.offSub': 'Darmowy klucz Google (2 minuty, raz). Działa przez internet; tematy poniżej działają też bez niego.',
      'ai.on': 'Włącz', 'ai.s1': 'Otwórz stronę Google AI Studio i zaloguj się kontem Google:', 'ai.s2': 'Kliknij „Create API key”, potem „Copy key” (klucz zaczyna się od AQ. albo AIza).', 'ai.s3': 'Wklej go tutaj:',
      'ai.claude': 'Masz klucz Claude (sk-ant-…)? Też go tu wklej.', 'ai.saveKey': 'Zapisz klucz', 'ai.paste': 'Wklej klucz (AQ.… / AIza… / sk-ant-…)', 'ai.keyOn': 'AI włączone ({p}, klucz {k})', 'ai.remove': 'Usuń klucz',
      'ai.installing': 'Instaluję moduł Claude (raz, ok. minuty)…', 'ai.saved': 'Pomocnik AI włączony',
      'ai.e.no_key': 'Najpierw wklej klucz AI.', 'ai.e.bad_key': 'Klucz nie działa — sprawdź, czy skopiowałeś cały (bez spacji).', 'ai.e.limit': 'Za dużo pytań naraz (darmowy limit) — spróbuj za minutę.',
      'ai.e.offline': 'Brak internetu — pomocnik AI go potrzebuje. Gotowe tematy działają bez internetu.', 'ai.e.no_module': 'Nie udało się zainstalować modułu Claude (potrzebny internet).', 'ai.e.no_credit': 'Na koncie Claude brak środków.',
      'ai.e.refused': 'AI nie odpowiedziało na to pytanie — spróbuj zapytać inaczej.', 'ai.e.other': 'Coś poszło nie tak po stronie AI — spróbuj jeszcze raz.', 'ai.e.server': 'Serwer AI jest teraz przeciążony — spróbuj za chwilę.', 'ai.e.empty': 'Napisz pytanie.',
      'ai.a.rig': 'Moje światła', 'ai.a.add': 'Dodaj światło', 'ai.a.cal': 'Kalibracja świateł', 'ai.a.sync': 'Synchronizacja', 'ai.a.manual': 'Reflektor ręczny', 'ai.a.scenes': 'Sceny', 'ai.a.moments': 'Momenty', 'ai.a.show': 'Pokaz', 'ai.a.dmx': 'Kabel DMX', 'ai.a.midi': 'Przyciski i MIDI',
      'ai.a.help': 'Gotowe tematy', 'ai.a.scene': 'Scena 3D', 'ai.a.mixer': 'Światła (suwaki)', 'ai.a.music': 'Muzyka', 'ai.a.hand': 'Dłoń', 'ai.a.stagecam': 'Kamera sceny', 'ai.a.setup': 'Ustawienia',
      'ai.open': 'Otwórz: {x}', 'ai.where': 'Pokaż, gdzie: {x}', 'ai.here': 'Tutaj', 'ai.done': 'Zrobione ✓',
      'ai.w.start': 'przycisk „Zacznij pokaz”', 'ai.w.styles': 'style pokazu', 'ai.w.moments': 'Momenty', 'ai.w.scenes': 'Sceny', 'ai.w.manual': 'Reflektor ręczny', 'ai.w.sync': 'Synchronizacja',
      'ai.w.blackout': 'Blackout', 'ai.w.lasers': 'przycisk laserów', 'ai.w.master': 'Jasność ogólna', 'ai.w.lamps': 'pasek z lampami', 'ai.w.status': 'stan kabla', 'ai.w.help': 'Pomoc',
      'ai.d.moment': 'Zrób: moment „{x}”', 'ai.d.style': 'Zrób: styl „{x}”', 'ai.d.start': 'Zrób: zacznij pokaz', 'ai.d.stop': 'Zrób: zatrzymaj pokaz', 'ai.d.intensity': 'Zrób: intensywność {x}%',
      'ai.d.master': 'Zrób: jasność ogólna {x}%', 'ai.d.bon': 'Zrób: blackout (wszystko gaśnie)', 'ai.d.boff': 'Zrób: wyłącz blackout', 'ai.d.lon': 'Zrób: uzbrój lasery', 'ai.d.loff': 'Zrób: wyłącz lasery',
      'ai.d.scene': 'Zrób: włącz scenę „{x}”', 'ai.d.release': 'Zrób: puść wszystkie lampy', 'ai.d.blink': 'Mrugnij: {x}', 'ai.d.rename': 'Zrób: zmień nazwę „{x}” na „{y}”', 'ai.d.address': 'Zrób: {x} → adres {y}',
      'ai.d.enable': 'Zrób: włącz lampę {x}', 'ai.d.disable': 'Zrób: wyłącz lampę {x}', 'ai.d.channels': 'Zrób: ustaw kanały lampy {x}', 'ai.d.type': 'Zrób: {x} → rodzaj „{y}”', 'ai.d.lasersQ': 'Uzbroić lasery? Nie kieruj ich w oczy ludzi.',
      'ai.d.fx': 'Zrób: efekt „{x}” → {y}', 'ai.a.effects': 'Efekty', 'ai.a.fix': 'Popraw celowanie', 'ai.w.effects': 'Efekty', 'ai.w.fix': 'Popraw celowanie',
      'ai.d.noScene': 'Nie ma sceny „{x}”.', 'ai.d.noLamp': 'Nie ma takiej lampy.', 'ai.by': 'odpowiada: {x}',
      'ai.keys': 'Klucze AI — pytam po kolei; gdy jeden jest zajęty albo skończy mu się darmowy limit, odpowiada następny:', 'ai.more': '+ Dodaj kolejny darmowy klucz', 'ai.cancel': 'Anuluj',
      'ai.free': 'Darmowe klucze (wystarczy jeden, kilka = pewniej):', 'ai.pGemini': 'Google Gemini — konto Google, „Create API key” → „Copy key”', 'ai.pGroq': 'Groq — bardzo szybki, logowanie kontem Google, „Create API Key”',
      'ai.pRouter': 'OpenRouter — darmowe modele, „Create Key”', 'ai.pCerebras': 'Cerebras — „API Keys” → „Generate”', 'ai.paste2': 'Wklej tutaj klucz (rodzaj rozpoznam sam):' },
    it: { 'hp.btn': 'Aiuto', 'hp.title': 'Assistente', 'hp.ask': 'Scrivi cosa non va o cosa cerchi…', 'hp.back': 'Tutti gli argomenti', 'hp.none': 'Niente di adatto — prova con altre parole o scegli un argomento.', 'hp.which': 'Quale luce?',
      'ai.askAi': 'Chiedi all’AI', 'ai.askHint': 'Scrivi la domanda e premi Invio — risponde l’AI', 'ai.think': 'Sto pensando…', 'ai.new': 'Nuova conversazione', 'ai.topics': 'Argomenti pronti',
      'ai.offTitle': 'Assistente AI — risponde a ogni domanda sulle tue luci', 'ai.offSub': 'Chiave Google gratuita (2 minuti, una volta). Serve internet; gli argomenti sotto funzionano anche senza.',
      'ai.on': 'Attiva', 'ai.s1': 'Apri Google AI Studio e accedi con l’account Google:', 'ai.s2': 'Clicca „Create API key”, poi „Copy key” (la chiave inizia con AQ. o AIza).', 'ai.s3': 'Incollala qui:',
      'ai.claude': 'Hai una chiave Claude (sk-ant-…)? Incollala qui.', 'ai.saveKey': 'Salva la chiave', 'ai.paste': 'Incolla la chiave (AQ.… / AIza… / sk-ant-…)', 'ai.keyOn': 'AI attiva ({p}, chiave {k})', 'ai.remove': 'Rimuovi la chiave',
      'ai.installing': 'Installo il modulo Claude (una volta, circa un minuto)…', 'ai.saved': 'Assistente AI attivo',
      'ai.e.no_key': 'Prima incolla la chiave AI.', 'ai.e.bad_key': 'La chiave non funziona — controlla di averla copiata tutta.', 'ai.e.limit': 'Troppe domande (limite gratuito) — riprova tra un minuto.',
      'ai.e.offline': 'Niente internet — l’assistente AI ne ha bisogno. Gli argomenti pronti funzionano senza.', 'ai.e.no_module': 'Impossibile installare il modulo Claude (serve internet).', 'ai.e.no_credit': 'Nessun credito sull’account Claude.',
      'ai.e.refused': 'L’AI non ha risposto — prova a chiedere in un altro modo.', 'ai.e.other': 'Qualcosa non è andato — riprova.', 'ai.e.server': 'Il server AI è occupato — riprova tra poco.', 'ai.e.empty': 'Scrivi una domanda.',
      'ai.a.rig': 'Le mie luci', 'ai.a.add': 'Aggiungi luce', 'ai.a.cal': 'Calibrazione luci', 'ai.a.sync': 'Sincronizzazione', 'ai.a.manual': 'Occhio di bue', 'ai.a.scenes': 'Scene', 'ai.a.moments': 'Momenti', 'ai.a.show': 'Show', 'ai.a.dmx': 'Cavo DMX', 'ai.a.midi': 'Tasti e MIDI',
      'ai.a.help': 'Argomenti pronti', 'ai.a.scene': 'Scena 3D', 'ai.a.mixer': 'Luci (cursori)', 'ai.a.music': 'Musica', 'ai.a.hand': 'Mano', 'ai.a.stagecam': 'Camera del palco', 'ai.a.setup': 'Impostazioni',
      'ai.open': 'Apri: {x}', 'ai.where': 'Mostra dove: {x}', 'ai.here': 'Qui', 'ai.done': 'Fatto ✓',
      'ai.w.start': 'pulsante „Avvia lo show”', 'ai.w.styles': 'stili dello show', 'ai.w.moments': 'Momenti', 'ai.w.scenes': 'Scene', 'ai.w.manual': 'Occhio di bue', 'ai.w.sync': 'Sincronizzazione',
      'ai.w.blackout': 'Blackout', 'ai.w.lasers': 'pulsante dei laser', 'ai.w.master': 'Luminosità generale', 'ai.w.lamps': 'barra delle luci', 'ai.w.status': 'stato del cavo', 'ai.w.help': 'Aiuto',
      'ai.d.moment': 'Fai: momento „{x}”', 'ai.d.style': 'Fai: stile „{x}”', 'ai.d.start': 'Fai: avvia lo show', 'ai.d.stop': 'Fai: ferma lo show', 'ai.d.intensity': 'Fai: intensità {x}%',
      'ai.d.master': 'Fai: luminosità generale {x}%', 'ai.d.bon': 'Fai: blackout', 'ai.d.boff': 'Fai: togli il blackout', 'ai.d.lon': 'Fai: arma i laser', 'ai.d.loff': 'Fai: spegni i laser',
      'ai.d.scene': 'Fai: scena „{x}”', 'ai.d.release': 'Fai: rilascia tutte le luci', 'ai.d.blink': 'Lampeggia: {x}', 'ai.d.rename': 'Fai: rinomina „{x}” in „{y}”', 'ai.d.address': 'Fai: {x} → indirizzo {y}',
      'ai.d.enable': 'Fai: accendi {x}', 'ai.d.disable': 'Fai: spegni {x}', 'ai.d.channels': 'Fai: imposta i canali di {x}', 'ai.d.type': 'Fai: {x} → tipo „{y}”', 'ai.d.lasersQ': 'Armare i laser? Non puntarli negli occhi.',
      'ai.d.fx': 'Fai: effetto „{x}” → {y}', 'ai.a.effects': 'Effetti', 'ai.a.fix': 'Correggi la mira', 'ai.w.effects': 'Effetti', 'ai.w.fix': 'Correggi la mira',
      'ai.d.noScene': 'Non esiste la scena „{x}”.', 'ai.d.noLamp': 'Questa luce non esiste.', 'ai.by': 'risponde: {x}',
      'ai.keys': 'Chiavi AI — le provo in ordine; se una è occupata o finisce il limite gratuito, risponde la successiva:', 'ai.more': '+ Aggiungi un’altra chiave gratuita', 'ai.cancel': 'Annulla',
      'ai.free': 'Chiavi gratuite (ne basta una, più chiavi = più sicuro):', 'ai.pGemini': 'Google Gemini — account Google, „Create API key” → „Copy key”', 'ai.pGroq': 'Groq — velocissimo, accesso con Google, „Create API Key”',
      'ai.pRouter': 'OpenRouter — modelli gratuiti, „Create Key”', 'ai.pCerebras': 'Cerebras — „API Keys” → „Generate”', 'ai.paste2': 'Incolla qui la chiave (il tipo lo riconosco da solo):' },
  });

  const go = (pane) => () => { close(); PH.setTab('setup'); if (PH.setupGo) PH.setupGo(pane); };
  const toShow = (sel) => () => { close(); PH.setTab('show'); setTimeout(() => { const el = $(sel); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); };
  const perLamp = (fn) => () => {
    const st = S.st; if (!st) return [];
    return st.fixtures.filter((f) => f.type !== 'smoke' && f.type !== 'laser').map((f) => [f.name, () => { close(); fn(f); }]);
  };
  // [id, icon, [title pl, it], [words], [html pl, it], actions: [[label pl, it], fn] | lamp list builder]
  const TOPICS = [
    ['party', 'sparkle', ['Plan na imprezę — co robić krok po kroku', 'Piano per la festa — cosa fare passo passo'], 'impreza plan wesele jutro zachowywać automat piosenki scenariusz festa piano',
      ['<ol><li><b>Przed gośćmi (30 min):</b> podłącz kabel USB-DMX, włącz lampy, uruchom Lumo (run.bat). Zrób listę „Co dalej?” na ekranie Pokaz.</li><li><b>Sceny na specjalne momenty:</b> ustaw reflektorem ręcznym np. „Saksofonista” (róż), „Pierwszy taniec” (ciepła biel), „Tort” (bursztyn) i zapisz każdą jako scenę.</li><li><b>Momenty</b> (ekran Pokaz) — jedno kliknięcie na każdą część wieczoru: <b>Kolacja</b> (ciepło, spokojnie, bez laserów) → <b>Pierwszy taniec</b> (kinowo) → <b>Parkiet</b> (AI dopasuje się do muzyki) → <b>Szaleństwo</b> (klubowo, lasery w refrenach) → <b>Tort / toast</b> (ciepłe białe) → <b>Wyciszenie</b> na koniec.</li><li><b>Saksofonista:</b> scena „Saksofonista” + w Reflektorze ręcznym „Ruch wokół osoby: delikatny” i „Obracające się gobo”.</li><li><b>Solo / przemowa:</b> kliknij scenę — te lampy zostają na osobie, reszta gra dalej. Potem „Puść wszystko”.</li><li><b>Awaria:</b> Blackout (klawisz B) gasi wszystko od razu. Dym włączasz przyciskiem na maszynie.</li></ol>',
       '<ol><li><b>Prima degli ospiti (30 min):</b> collega il cavo USB-DMX, accendi le luci, avvia Lumo (run.bat). Segui „E adesso?” nella scheda Show.</li><li><b>Scene per i momenti speciali:</b> con l’occhio di bue manuale prepara „Sassofonista” (rosa), „Primo ballo” (bianco caldo), „Torta” (ambra) e salva ognuna come scena.</li><li><b>Momenti</b> (scheda Show) — un clic per ogni parte della serata: <b>Cena</b> → <b>Primo ballo</b> → <b>Pista</b> → <b>Scatenati</b> → <b>Torta / brindisi</b> → <b>Chiusura</b>.</li><li><b>Sassofonista:</b> scena „Sassofonista” + nell’occhio di bue „Movimento intorno alla persona: leggero” e „Gobo che ruota”.</li><li><b>Assolo / discorso:</b> clicca la scena — quelle luci restano sulla persona, il resto continua. Poi „Rilascia tutto”.</li><li><b>Emergenza:</b> Blackout (tasto B) spegne tutto subito.</li></ol>'],
      [[['Momenty imprezy', 'Momenti della festa'], toShow('#sh-moments')], [['Otwórz ekran Pokaz', 'Apri lo Show'], toShow('#sh-steps')]]],
    ['nolight', 'sun', ['Lampa się rusza, ale nie świeci', 'La luce si muove ma non si accende'], 'nie świeci ciemna rusza nie daje światła migawka shutter dimmer buio',
      ['<p>Najczęstsza przyczyna w tanich głowicach: lampa świeci dopiero przy konkretnej wartości kanału <b>migawki (shutter)</b> albo <b>jasności</b>. Lumo sprawdzi to za Ciebie — wybierz lampę, a potem kliknij „Teraz świeci!”, gdy zaświeci.</p><p>Jeśli nic nie pomoże: zły układ kanałów (inny tryb, np. 9CH zamiast 11CH) — wtedy „Rozpoznaj kanały”.</p>',
       '<p>Causa più comune nelle teste economiche: la luce si accende solo con un valore preciso dello <b>shutter</b> o della <b>luminosità</b>. Lumo lo cerca per te — scegli la luce e clicca „Ora si accende!”.</p><p>Se non aiuta: canali diversi (altra modalità, es. 9CH invece di 11CH) — usa „Riconosci i canali”.</p>'],
      perLamp((f) => PH.openLightCal && PH.openLightCal(f.id, 'shutter'))],
    ['dead', 'plug', ['Lampa w ogóle nie reaguje', 'La luce non reagisce affatto'], 'nie reaguje nie działa nic martwa kabel adres dmx tryb nie widzę kabla non funziona',
      ['<ol><li>Na wyświetlaczu lampy ustaw tryb <b>DMX</b> (nie Sound, Auto, Master ani Slave) i <b>adres</b> taki jak w Lumo (np. <b>d001</b> albo <b>A001</b>).</li><li>Kabel: komputer → wejście <b>DMX IN</b> pierwszej lampy → jej <b>DMX OUT</b> → <b>IN</b> następnej (łańcuch). Na końcu łańcucha warto dać terminator 120 Ω.</li><li>W Lumo status u góry powinien pokazać „Wszystko działa”. Jeśli „Kabel DMX niepodłączony” — włóż kabel bez rozgałęźnika USB.</li><li>Mrugnij lampą w kalibracji — zobaczysz, która to.</li></ol>',
       '<ol><li>Sul display imposta la modalità <b>DMX</b> (non Sound/Auto/Master/Slave) e l’<b>indirizzo</b> come in Lumo (es. <b>d001</b>).</li><li>Cavo: computer → <b>DMX IN</b> della prima luce → <b>DMX OUT</b> → <b>IN</b> della successiva. In fondo un terminatore 120 Ω.</li><li>In alto lo stato deve dire „Tutto funziona”. Se „Cavo DMX non collegato” — collega il cavo senza hub USB.</li><li>Fai lampeggiare la luce nella calibrazione.</li></ol>'],
      [[['Moje światła (mrugnij, adresy)', 'Le mie luci (lampeggia, indirizzi)'], () => { close(); PH.openRig(); }], [['Sprawdź kabel', 'Controlla il cavo'], go('dmx')], [['Kalibracja świateł', 'Calibrazione luci'], () => { close(); if (PH.openLightCal) PH.openLightCal(); }]]],
    ['channels', 'channels', ['Nie znam kanałów lampy (z AliExpress, bez instrukcji)', 'Non conosco i canali della luce (senza manuale)'], 'kanały kanał instrukcja aliexpress chiny książeczka tryb 9ch 11ch nie znam modelu canali manuale',
      ['<ol><li>Najpierw <b>Biblioteka</b>: wpisz nazwę z naklejki lampy (Lumo ma ok. 2400 profili offline).</li><li>Brak modelu? Na wyświetlaczu lampy sprawdź tryb kanałów (np. <b>9CH</b>, <b>11CH</b>) — to liczba kanałów.</li><li>„Rozpoznaj kanały krok po kroku”: Lumo podnosi kanały po kolei, a Ty klikasz, co robi lampa (ruch, kolor, jasność, migawka…). Na końcu zapisz jako swoje urządzenie.</li><li>Często tabela kanałów jest na zdjęciach produktu na AliExpress albo na open-fixture-library.org.</li></ol>',
       '<ol><li>Prima la <b>Libreria</b>: scrivi il nome dall’etichetta (circa 2400 profili offline).</li><li>Nessun modello? Sul display guarda la modalità (es. <b>9CH</b>, <b>11CH</b>).</li><li>„Riconosci i canali passo passo”: Lumo alza un canale alla volta e tu clicchi cosa fa la luce. Alla fine salva come tuo dispositivo.</li><li>Spesso la tabella dei canali è nelle foto del prodotto o su open-fixture-library.org.</li></ol>'],
      [[['Moje światła → Kanały / Rozpoznaj kanały', 'Le mie luci → Canali / Riconosci'], () => { close(); PH.openRig(); }], [['Dodaj światło (szukaj modelu)', 'Aggiungi luce (cerca modello)'], () => { close(); PH.openRig('type'); }]]],
    ['same', 'layers', ['Kilka lamp ma ten sam adres', 'Più luci con lo stesso indirizzo'], 'ten sam adres kanał grupa kilka lamp 3 lampy kopia stesso indirizzo gruppo',
      ['<p>Lampy z <b>tym samym adresem i tym samym modelem</b> robią dokładnie to samo — w Lumo dodaj je <b>raz</b>, jako jedną lampę (np. „Prawe głowice ×3”).</p><p><b>Różne modele na tym samym adresie</b> to błąd — Lumo pokaże „konflikt adresu”. Ustaw im różne adresy na wyświetlaczach.</p><p>Chcesz efekty „po kolei” (fale, pościgi, wachlarze)? Daj każdej lampie inny adres, np. 1, 12, 23 dla lamp 11-kanałowych.</p><p><b>Na imprezę wystarczy:</b> prawe takie same głowice na jednym adresie (np. 1), lewe na drugim (np. 12) — strony wtedy grają osobno (np. lewa–prawa na zmianę), a lampy w grupie zawsze idealnie razem. Osobne adresy dla każdej głowicy = jeszcze więcej efektów, ale więcej ustawiania.</p>',
       '<p>Luci con <b>stesso indirizzo e stesso modello</b> fanno lo stesso — in Lumo aggiungile <b>una volta</b> (es. „Teste destra ×3”).</p><p><b>Modelli diversi sullo stesso indirizzo</b> sono un errore — Lumo mostra „conflitto”.</p><p>Per effetti in sequenza dai a ogni luce un indirizzo diverso, es. 1, 12, 23.</p>'],
      [[['Moje światła i adresy', 'Le mie luci e indirizzi'], () => { close(); PH.openRig(); }]]],
    ['group', 'layers', ['Sterowanie kilkoma lampami naraz', 'Comandare più luci insieme'], 'razem kilka grupa zaznacz wszystkie naraz jednocześnie insieme gruppo',
      ['<ol><li><b>Na dole ekranu</b> każda lampa ma swój przycisk: klik = jedna lampa, <b>Ctrl + klik</b> = dodaj kolejne (kilka naraz), „Wszystkie” = cała sala.</li><li>Zaznaczone lampy słuchają razem: gestów dłoni, suwaków w zakładce <b>Światła</b>, kolorów i efektów.</li><li><b>Reflektor ręczny</b>: przyciski lamp na górze (np. „Wszystkie głowice”) — kliknięcie na planie celuje wszystkimi naraz.</li><li>Pokaz AI zawsze steruje wszystkimi lampami razem, a fale i pościgi gra „po kolei” między lampami z <b>różnymi adresami</b>.</li><li>Prawy przycisk na lampie (na dole albo w scenie 3D) = jej menu: mrugnij, kanały, dodaj taką samą, zmień model…</li></ol>',
       '<ol><li><b>In basso</b> ogni luce ha il suo pulsante: clic = una luce, <b>Ctrl + clic</b> = aggiungi altre, „Tutte” = tutta la sala.</li><li>Le luci selezionate seguono insieme gesti, cursori in <b>Luci</b>, colori ed effetti.</li><li><b>Occhio di bue</b>: i pulsanti delle luci in alto — un clic sulla pianta punta con tutte.</li><li>Lo show AI comanda sempre tutte le luci; onde e inseguimenti passano tra luci con <b>indirizzi diversi</b>.</li><li>Tasto destro su una luce (in basso o nella scena 3D) = il suo menu.</li></ol>'],
      [[['Pokaż pasek z lampami', 'Mostra la barra delle luci'], () => { close(); setTimeout(() => { const el = $('#fx-chips'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 100); }], [['Reflektor ręczny', 'Occhio di bue'], toShow('#sh-manual')]]],
    ['fxlight', 'derby', ['Lampy efektowe: kula, derby, kilka głowic w jednej, z laserem', 'Luci effetto: sfera, derby, più teste, con laser'], 'kula derby efekt obrót obraca kręci wielogłowicowa 4 głowice pająk spider laser led tęcza rainbow sfera ruota',
      ['<ol><li><b>Moje światła → Dodaj światło</b> → „Efekt / inne” → szukaj modelu albo „Nie znam modelu” (liczba kanałów z wyświetlacza, np. 21CH).</li><li><b>Kanały</b>: przesuwaj suwaki i patrz, co robi lampa, a potem wybierz funkcję z listy: <b>Obrót ciągły</b> (silnik kręci), <b>Wiązki / soczewki</b> (pochylenie soczewek), <b>Dodatkowe strobo</b>, <b>Laser</b>, kolory, jasność. Albo <b>Rozpoznaj kanały</b> — krok po kroku.</li><li><b>Kilka głowic w jednej lampie</b> (np. 4 głowice): daj ten sam rodzaj każdej głowicy — np. 4 × „Pochylenie” albo 4 × „Czerwony” — wtedy ruszają się i świecą razem, idealnie zgrane.</li><li>W pokazie: obrót przyspiesza z energią muzyki i zmienia kierunek w żywych stylach, soczewki falują w rytm, dodatkowe strobo błyska na mocny takt, laser tylko gdy uzbrojony.</li><li>Nie wiesz, co jest na którym kanale? Napisz w czacie AI, co robi każdy kanał (np. „kanał 3 kręci, 5 kolor”) — AI ustawi kanały jednym kliknięciem.</li></ol>',
       '<ol><li><b>Le mie luci → Aggiungi luce</b> → „Effetto / altro” → cerca il modello o „Non conosco il modello” (numero di canali dal display).</li><li><b>Canali</b>: muovi i cursori e scegli la funzione: <b>Rotazione continua</b>, <b>Fasci / lenti</b>, <b>Strobo extra</b>, <b>Laser</b>, colori, luminosità. Oppure <b>Riconosci i canali</b> passo passo.</li><li><b>Più teste in una luce</b>: dai la stessa funzione a ogni testa — si muovono e si accendono insieme.</li><li>Nello show: la rotazione segue l’energia della musica e cambia verso negli stili vivaci, le lenti ondeggiano a tempo, lo strobo extra lampeggia sul battere, il laser solo se armato.</li><li>Non sai cosa fa ogni canale? Scrivilo nella chat AI — l’AI imposta i canali con un clic.</li></ol>'],
      [[['Moje światła', 'Le mie luci'], () => { close(); PH.openRig(); }], [['Dodaj światło', 'Aggiungi luce'], () => { close(); PH.openRig('type'); }]]],
    ['solo', 'spot', ['Saksofonista / solista / przemowa — światło na osobę', 'Sassofonista / assolo — luce sulla persona'], 'saksofon saksofonista solo solista przemowa osoba reflektor kolor róż sax persona',
      ['<ol><li>Pokaz → <b>Reflektor ręczny</b>.</li><li>Raz na początku: <b>Rozstaw lampy</b> — przeciągnij je tam, gdzie wiszą (lewo / środek / prawo), i ustaw wysokość.</li><li><b>Celuj</b>: kliknij na planie miejsce, gdzie stoi saksofonista. Wybierz kolor (np. różowy).</li><li><b>Zapisz jako scenę</b> „Saksofonista”. Na imprezie kliknij ją w Scenach — te lampy zostaną na nim, a reszta dalej gra w rytm.</li><li>Koniec solo: <b>Puść wszystko</b>.</li></ol>',
       '<ol><li>Show → <b>Occhio di bue manuale</b>.</li><li>Una volta: <b>Posiziona le luci</b> dove sono appese e imposta l’altezza.</li><li><b>Punta</b>: clicca dove sta il sassofonista. Scegli il colore (es. rosa).</li><li><b>Salva come scena</b> „Sassofonista”. Alla festa cliccala — quelle luci restano su di lui, il resto continua.</li><li>Fine assolo: <b>Rilascia tutto</b>.</li></ol>'],
      [[['Otwórz reflektor ręczny', 'Apri l’occhio di bue'], toShow('#sh-manual')]]],
    ['music', 'music', ['Światła nie reagują na muzykę', 'Le luci non seguono la musica'], 'muzyka rytm bit nie reaguje mikrofon wejście audio start bpm automat musica ritmo',
      ['<ol><li>Pokaz → wybierz <b>źródło dźwięku</b> (wyjście miksera do wejścia liniowego albo mikrofon) → <b>Start pokazu</b>. Przeglądarka zapyta o dostęp — zezwól.</li><li>Gdy liczba BPM pokazuje „w rytmie”, światła grają w bit.</li><li>Błysk nie równo z bitem? <b>Synchronizacja</b>.</li><li>Za cicho? Podgłośnij wyjście miksera albo przysuń mikrofon.</li></ol>',
       '<ol><li>Show → scegli la <b>sorgente audio</b> → <b>Avvia lo show</b> e consenti l’accesso.</li><li>Quando i BPM dicono „a tempo”, le luci seguono il beat.</li><li>Lampo non a tempo? <b>Sincronizzazione</b>.</li></ol>'],
      [[['Otwórz Pokaz', 'Apri lo Show'], toShow('#sh-steps')], [['Synchronizacja', 'Sincronizzazione'], () => { close(); if (PH.openSync) PH.openSync(); }]]],
    ['laser', 'laser', ['Laser nie świeci', 'Il laser non si accende'], 'laser lasery nie świeci zablokowane uzbrój laser',
      ['<p>Lasery są w Lumo <b>zablokowane</b> dla bezpieczeństwa. Odblokuj je przyciskiem <b>„Lasery wyłączone”</b> na dole (zmieni się na „uzbrojone”). W pokazie lasery pulsują w szybkich fragmentach i na dropach (opcja „Lasery w szybkich fragmentach”).</p><p>Laser też musi być w trybie DMX i mieć swój adres. Tani laser ma na 1. kanale „tryb” (wyłączony / auto / dźwięk / DMX) — w <b>Moje światła → Ustaw laser</b> Lumo sprawdzi po kolei wartości, a Ty klikniesz, gdy laser ładnie świeci. Nigdy nie kieruj lasera w oczy ludzi.</p>',
       '<p>I laser sono <b>bloccati</b> per sicurezza. Sbloccali con il pulsante <b>„Laser spenti”</b> in basso. Nello show pulsano nelle parti veloci.</p><p>Anche il laser deve essere in modalità DMX con il suo indirizzo. Il canale 1 è la „modalità”: in <b>Le mie luci → Imposta laser</b> Lumo prova i valori e tu clicchi quando si accende bene. Mai negli occhi.</p>'],
      [[['Ustaw laser (Moje światła)', 'Imposta laser (Le mie luci)'], () => { close(); PH.openRig(); }], [['Uzbrój lasery', 'Arma i laser'], () => { if (confirm(PH.lang === 'it' ? 'Armare i laser? Non puntarli negli occhi.' : 'Uzbroić lasery? Nie kieruj ich w oczy.')) send({ type: 'lasers', value: true }); }]]],
    ['console', 'mixer', ['Pulpit DMX-192 (ten z suwakami) a komputer', 'Console DMX-192 e computer'], 'pulpit dmx-192 suwaki konsola mikser sterownik podłączyć do komputera console slider',
      ['<p>Na jednym przewodzie DMX może nadawać <b>tylko jedno urządzenie</b> — albo pulpit, albo komputer. Zwykły kabel USB-DMX (Open DMX) tylko wysyła, więc Lumo <b>nie odczyta</b> suwaków pulpitu.</p><ul><li><b>Najprościej:</b> lampy steruje Lumo, a pulpit trzymaj jako zapas (w razie awarii przełóż kabel do pulpitu).</li><li><b>Suwaki do Lumo:</b> mały kontroler <b>MIDI</b> z USB (np. Akai LPD8, Korg nanoKONTROL) — Lumo ma przypisywanie suwaków i przycisków (Ustawienia → Przyciski i MIDI).</li><li>Odczyt pulpitu DMX wymaga interfejsu z wejściem DMX (np. ENTTEC DMX USB Pro).</li></ul>',
       '<p>Su un cavo DMX può trasmettere <b>un solo dispositivo</b>. Il cavo USB-DMX semplice solo trasmette, quindi Lumo <b>non legge</b> i fader della console.</p><ul><li><b>Più semplice:</b> le luci le guida Lumo, la console resta di riserva.</li><li><b>Fader per Lumo:</b> un piccolo controller <b>MIDI</b> USB (Impostazioni → Tasti e MIDI).</li><li>Per leggere la console serve un’interfaccia con ingresso DMX (es. ENTTEC DMX USB Pro).</li></ul>'],
      [[['Przyciski i MIDI', 'Tasti e MIDI'], go('keys')]]],
    ['place', 'scene', ['Gdzie stoją lampy (scena 3D)', 'Dove sono le luci (scena 3D)'], 'scena 3d pozycja gdzie stoją wysokość statyw słup wisząca stojąca posizione',
      ['<p>Lumo musi wiedzieć, gdzie stoją lampy, żeby celować w osobę. Najprościej w Pokaz → Reflektor ręczny → <b>Rozstaw lampy</b>: przeciągnij każdą lampę na planie (patrząc z sali: lewo, środek, prawo) i ustaw wysokość oraz to, czy wisi, czy stoi. Potem <b>Kalibracja świateł</b> sprawdzi kierunki.</p>',
       '<p>Lumo deve sapere dove sono le luci per puntare la persona. Show → Occhio di bue → <b>Posiziona le luci</b>: trascina ogni luce e imposta altezza e montaggio. Poi la <b>Calibrazione</b> controlla le direzioni.</p>'],
      [[['Rozstaw lampy', 'Posiziona le luci'], toShow('#sh-manual')], [['Kalibracja świateł', 'Calibrazione luci'], () => { close(); if (PH.openLightCal) PH.openLightCal(); }]]],
    ['tour', 'help', ['Pokaż mi, co jest na ekranie', 'Mostrami cosa c’è sullo schermo'], 'przewodnik ekran co to jest gdzie jest pomoc tour guida',
      ['<p>Krótki przewodnik podświetla po kolei przyciski i mówi, do czego służą.</p>', '<p>Una breve guida evidenzia i pulsanti e spiega a cosa servono.</p>'],
      [[['Uruchom przewodnik', 'Avvia la guida'], () => { close(); const b = $('#tour-btn'); if (b) b.click(); }]]],
  ];

  let panel = null;
  function open(topic) {
    if (!panel) {
      panel = document.createElement('aside');
      panel.className = 'hp-panel';
      panel.innerHTML = `<div class="hp-h"><b></b><button class="hp-x" aria-label="close">${ic('close')}</button></div>
        <label class="hp-q">${ic('help')}<input type="search" id="hp-q" autocomplete="off"></label><div class="hp-body" id="hp-body"></div>`;
      document.body.appendChild(panel);
      $('.hp-x', panel).onclick = close;
      $('#hp-q', panel).oninput = () => { if (!AI.chat.length) list($('#hp-q').value); };
      $('#hp-q', panel).onkeydown = (e) => { if (e.key === 'Enter' && AI.on && e.target.value.trim()) { e.preventDefault(); ask(e.target.value); } };
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('on')) close(); });
    }
    PH.setText($('.hp-h b', panel), t('hp.title'));
    $('#hp-q', panel).placeholder = t('hp.ask');
    panel.classList.add('on');
    if (topic) show(topic); else { if (AI.chat.length) chatView(); else list($('#hp-q', panel).value); setTimeout(() => $('#hp-q', panel).focus(), 50); }
    aiState();
  }
  function close() { if (panel) panel.classList.remove('on'); }
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  function list(q) {
    const words = norm(q || '').split(/\s+/).filter((w) => w.length > 2);
    const scored = TOPICS.map((tp) => {
      const hay = norm(`${tp[2].join(' ')} ${tp[3]} ${tp[4][L()].replace(/<[^>]+>/g, ' ')}`);
      return [tp, words.reduce((s, w) => s + (hay.includes(w) ? (norm(tp[3]).includes(w) ? 3 : 1) : 0), 0)];
    }).filter(([, s]) => !words.length || s > 0).sort((a, b) => b[1] - a[1]);
    const body = $('#hp-body');
    body.innerHTML = aiCard(q) + (scored.length ? scored.map(([tp]) => `<button class="hp-topic" data-tp="${tp[0]}">${ic(tp[1])}<span>${esc(tp[2][L()])}</span>${ic('chevron')}</button>`).join('')
      : `<p class="hp-none">${esc(t('hp.none'))}</p>`);
    for (const b of $$('[data-tp]', body)) b.onclick = () => show(b.dataset.tp);
    aiWire(body);
  }
  function show(id) {
    const tp = TOPICS.find((x) => x[0] === id); if (!tp) return;
    const acts = typeof tp[5] === 'function' ? tp[5]().map(([name, fn]) => [[name, name], fn]) : tp[5];
    const body = $('#hp-body');
    body.innerHTML = `<button class="hp-back">${ic('chevron')}<span>${esc(t('hp.back'))}</span></button>
      <h3>${esc(tp[2][L()])}</h3><div class="hp-text">${tp[4][L()]}</div>
      ${typeof tp[5] === 'function' ? `<b class="hp-which">${esc(t('hp.which'))}</b>` : ''}
      <div class="hp-acts">${acts.map(([lab], i) => `<button class="btn${i === 0 ? ' primary' : ''}" data-a="${i}">${esc(lab[L()])}</button>`).join('')}</div>`;
    $('.hp-back', body).onclick = () => list($('#hp-q').value);
    for (const b of $$('[data-a]', body)) b.onclick = () => acts[Number(b.dataset.a)][1]();
  }

  /* ---------------------------------------------------------------- AI chat */
  const AI = { on: false, provider: null, masked: '', installing: false, setup: false, chat: [], busy: false, seq: 0, keys: [] };
  // [[go:…]] - pages
  const GO = {
    rig: () => PH.openRig(), add: () => PH.openRig('type'), cal: () => PH.openLightCal && PH.openLightCal(),
    sync: () => PH.openSync && PH.openSync(), manual: toShow('#sh-manual'), scenes: toShow('#sh-scenes'),
    moments: toShow('#sh-moments'), show: toShow('#sh-steps'), help: () => { AI.chat = []; open(); },
    effects: toShow('#sh-fx'), fix: () => { close(); PH.setTab('show'); setTimeout(() => { const d = $('#mn-fix'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); d.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 200); },
    scene: () => { close(); PH.setTab('scene'); }, mixer: () => { close(); PH.setTab('mixer'); }, music: () => { close(); PH.setTab('music'); },
    hand: () => { close(); PH.setTab('hand'); }, stagecam: () => { close(); PH.setTab('stagecam'); }, setup: go('home'),
  };
  const PANES = ['home', 'wizard', 'overview', 'dmx', 'lamps', 'library', 'dmxcal', 'camera', 'lampcal', 'hand', 'track', 'stage',
    'control', 'speed', 'keys', 'effects', 'general', 'ui', 'backup', 'diag', 'adv'];
  // [[show:…]] - point at a button: [tab or null, selector]
  const WHERE = {
    start: ['show', '#sh-start'], styles: ['show', '#sh-cards'], moments: ['show', '#sh-moments'], scenes: ['show', '#sh-scenes'],
    manual: ['show', '#sh-manual'], sync: ['show', '#sh-sync'], blackout: [null, '#blackout'], lasers: [null, '#lasers'],
    master: [null, '#gm'], lamps: [null, '#fx-chips'], status: [null, '#status-pill'], help: [null, '#help-btn'],
    effects: ['show', '#sh-fx'], fix: ['show', '#mn-fix'],
  };
  const ROLES = ['pan', 'pan_fine', 'tilt', 'tilt_fine', 'dimmer', 'shutter', 'strobe', 'red', 'green', 'blue', 'white', 'cwheel', 'gobo', 'speed',
    'spin', 'beam', 'laser', 'laser_r', 'laser_g', 'strip', 'strip_speed', 'macro', 'aux1', 'aux2', 'none'];
  const TYPES = ['moving_head', 'par', 'bar', 'derby', 'strobe', 'laser'];
  const lamp = (id) => (S.st ? S.st.fixtures.find((f) => f.id === Number(id)) : null);
  const pct = (v) => Math.max(0, Math.min(100, Math.round(Number(v))));
  function spot(sel) {                                        // a ring that pulses around the button for a few seconds
    const el = $(sel); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      const ring = document.createElement('div');
      ring.className = 'ai-spot';
      Object.assign(ring.style, { left: `${r.left - 8}px`, top: `${r.top - 8}px`, width: `${r.width + 16}px`, height: `${r.height + 16}px` });
      ring.innerHTML = `<b>${esc(t('ai.here'))}</b>`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 6500);
    }, 450);
  }
  // one tag → {label, run, primary?, note?} or null (anything unknown is dropped)
  function action(a) {
    const [verb, ...rest] = String(a).split(':'); const arg = rest.join(':');
    if (verb === 'go') {
      if (GO[arg]) return { label: t('ai.open', { x: t('ai.a.' + arg) }), run: () => { close(); GO[arg](); } };
      const pane = arg.startsWith('setup/') ? arg.slice(6) : '';
      if (PANES.includes(pane)) {
        const k = `st.${pane}.n`, lab = t(k);
        return { label: t('ai.open', { x: `${t('ai.a.setup')} → ${lab === k ? pane : lab}` }), run: go(pane) };
      }
      return null;
    }
    if (verb === 'show') {
      const w = WHERE[arg]; if (!w) return null;
      return { label: t('ai.where', { x: t('ai.w.' + arg) }), run: () => { close(); if (w[0]) PH.setTab(w[0]); setTimeout(() => spot(w[1]), 150); } };
    }
    if (verb !== 'do') return null;
    const [k, ...vv] = arg.split('='); const v = vv.join('=').trim();
    const r = change(k, v);
    if (r && k !== 'blink') r.once = true;                 // a setting is done once, then its button greys out
    return r;
  }
  function change(k, v) {
    const [id, val] = v.split('|').map((x) => (x || '').trim());
    const sendFx = (fid, kw) => send({ type: 'update_fixture', id: Number(fid), ...kw });
    switch (k) {
      case 'moment': {
        if (!['dinner', 'first', 'floor', 'party', 'cake', 'calm'].includes(v)) return null;
        return { primary: true, label: t('ai.d.moment', { x: t('mo.' + v) }), run: () => PH.playMoment && PH.playMoment(v) };
      }
      case 'style': {
        if (!['auto', 'cinema', 'concert', 'club', 'chill', 'elegant', 'rave'].includes(v)) return null;
        return { primary: true, label: t('ai.d.style', { x: t('fl.' + v) }), run: () => send({ type: 'director', flavor: v }) };
      }
      case 'show':
        if (v === 'start') return { primary: true, label: t('ai.d.start'), run: () => (PH.showStart ? PH.showStart() : send({ type: 'show_start' })) };
        return v === 'stop' ? { label: t('ai.d.stop'), run: () => send({ type: 'show_stop' }) } : null;
      case 'intensity': return Number.isFinite(Number(v)) ? { label: t('ai.d.intensity', { x: pct(v) }), run: () => send({ type: 'director', intensity: pct(v) / 100 }) } : null;
      case 'master': return Number.isFinite(Number(v)) ? { label: t('ai.d.master', { x: pct(v) }), run: () => send({ type: 'grand_master', value: Math.round(pct(v) * 2.55) }) } : null;
      case 'blackout': return v === 'on' || v === 'off' ? { label: t(v === 'on' ? 'ai.d.bon' : 'ai.d.boff'), run: () => send({ type: 'blackout', value: v === 'on' }) } : null;
      case 'lasers':
        if (v === 'off') return { label: t('ai.d.loff'), run: () => send({ type: 'lasers', value: false }) };
        return v === 'on' ? { label: t('ai.d.lon'), run: () => { if (confirm(t('ai.d.lasersQ'))) send({ type: 'lasers', value: true }); } } : null;
      case 'scene': {
        const lk = ((S.st && S.st.looks) || []).find((x) => x.name.toLowerCase() === v.toLowerCase());
        return { label: t('ai.d.scene', { x: v }), run: () => (lk ? send({ type: 'look_recall', id: lk.id, keep_show: true, hold: 86400 }) : toast(t('ai.d.noScene', { x: v }), 'warn')) };
      }
      case 'release': return { label: t('ai.d.release'), run: () => send({ type: 'release' }) };
      case 'fx': {
        const [kind, list] = v.split('|').map((x) => (x || '').trim());
        if (!(PH.FX_KINDS || []).includes(kind)) return null;
        const ids = list && list !== 'all' ? list.split(',').map(Number).filter((n) => lamp(n)) : [];
        const names = ids.length ? ids.map((n) => lamp(n).name).join(', ') : t('mf.all');
        return { primary: true, label: t('ai.d.fx', { x: t('mf.' + kind), y: names }), run: () => PH.playFx && PH.playFx(kind, ids) };
      }
      case 'blink': { const f = lamp(v); return f ? { label: t('ai.d.blink', { x: f.name }), run: () => PH.blinkLamp && PH.blinkLamp(f.id) } : null; }
      case 'rename': { const f = lamp(id); return f && val ? { label: t('ai.d.rename', { x: f.name, y: val.slice(0, 24) }), run: () => sendFx(f.id, { name: val.slice(0, 24) }) } : null; }
      case 'address': {
        const f = lamp(id), a = Number(val);
        return f && a >= 1 && a <= 512 ? { label: t('ai.d.address', { x: f.name, y: String(a).padStart(3, '0') }), run: () => sendFx(f.id, { address: a }) } : null;
      }
      case 'enable': {
        const f = lamp(id); if (!f || (val !== 'on' && val !== 'off')) return null;
        return { label: t(val === 'on' ? 'ai.d.enable' : 'ai.d.disable', { x: f.name }), run: () => sendFx(f.id, { enabled: val === 'on' }) };
      }
      case 'type': { const f = lamp(id); return f && TYPES.includes(val) ? { label: t('ai.d.type', { x: f.name, y: val }), run: () => sendFx(f.id, { type: val }) } : null; }
      case 'channels': {
        const f = lamp(id); if (!f) return null;
        const roles = val.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
        if (!roles.length || roles.length > 64 || roles.some((r) => !ROLES.includes(r))) return null;
        return {
          label: t('ai.d.channels', { x: f.name }),
          note: roles.map((r, i) => `${i + 1}:${r}`).join(' · ') + (roles.length !== f.footprint ? `  (${f.footprint} → ${roles.length})` : ''),
          run: () => sendFx(f.id, { channels: roles, pan_16bit: roles.includes('pan_fine'), tilt_16bit: roles.includes('tilt_fine'),
            has_rgb: roles.some((r) => ['red', 'green', 'blue'].includes(r)) }),
        };
      }
      default: return null;
    }
  }
  const onList = () => panel && panel.classList.contains('on') && !AI.chat.length && !$('.hp-text', panel);
  async function aiState() {
    try {
      const r = await fetch('/api/assistant');
      const was = AI.on;
      Object.assign(AI, await r.json());
      if (onList() && was !== AI.on) list($('#hp-q').value);
    } catch (e) { /* server restarting */ }
  }
  function aiCard(q) {
    const qq = (q || '').trim();
    const keys = AI.keys || [];
    if (AI.on && !AI.setup) {
      return `<div class="ai-card on">${qq ? `<button class="btn primary ai-go" data-ai-ask>${ic('sparkle')}<span>${esc(t('ai.askAi'))}: „${esc(qq.slice(0, 60))}”</span></button>`
        : `<small class="ai-hint">${ic('sparkle')}<span>${esc(t('ai.askHint'))}</span></small>`}
        <div class="ai-keys"><small>${esc(t('ai.keys'))}${AI.installing ? ' · ' + esc(t('ai.installing')) : ''}</small>
          <div class="ai-klist">${keys.map((k) => `<span class="ai-k"><b>${esc(k.name)}</b><small>${esc(k.masked)}</small><button title="${esc(t('ai.remove'))}" data-ai-rm="${k.i}">${ic('close')}</button></span>`).join('')}</div>
          <button class="lnk" data-ai-setup>${esc(t('ai.more'))}</button></div></div>
        <b class="hp-sec">${esc(t('ai.topics'))}</b>`;
    }
    if (!AI.setup) {
      return `<button class="ai-card off" data-ai-setup>${ic('sparkle')}<span><b>${esc(t('ai.offTitle'))}</b><small>${esc(t('ai.offSub'))}</small></span><em>${esc(t('ai.on'))}</em></button>`;
    }
    const link = (url, txt) => `<a href="https://${url}" target="_blank" rel="noopener">${esc(url)}</a> — ${esc(txt)}`;
    return `<div class="ai-card set"><b>${ic('sparkle')}<span>${esc(t('ai.offTitle'))}</span></b>
      <small class="ai-free">${esc(t('ai.free'))}</small>
      <ol><li>${link('aistudio.google.com/apikey', t('ai.pGemini'))}</li><li>${link('console.groq.com/keys', t('ai.pGroq'))}</li>
        <li>${link('openrouter.ai/keys', t('ai.pRouter'))}</li><li>${link('cloud.cerebras.ai', t('ai.pCerebras'))}</li></ol>
      <small>${esc(t('ai.paste2'))}</small>
      <div class="ai-key"><input type="password" id="ai-key" autocomplete="off" spellcheck="false" placeholder="${esc(t('ai.paste'))}"><button class="btn primary" data-ai-save>${esc(t('ai.saveKey'))}</button></div>
      <small>${esc(t('ai.claude'))}${AI.on ? ` · <button class="lnk" data-ai-cancel>${esc(t('ai.cancel'))}</button>` : ''}</small></div>`;
  }
  function aiWire(body) {
    const b = $('[data-ai-setup]', body);
    if (b) b.onclick = () => { AI.setup = true; list($('#hp-q').value); setTimeout(() => { const k = $('#ai-key'); if (k) k.focus(); }, 30); };
    const s = $('[data-ai-save]', body);
    if (s) s.onclick = () => { const v = $('#ai-key').value.trim(); if (v) send({ type: 'ai_key', key: v }); };
    const k = $('#ai-key', body); if (k) k.onkeydown = (e) => { if (e.key === 'Enter') s.click(); };
    for (const x of $$('[data-ai-rm]', body)) x.onclick = () => send({ type: 'ai_key', remove: Number(x.dataset.aiRm) });
    const c = $('[data-ai-cancel]', body); if (c) c.onclick = () => { AI.setup = false; list($('#hp-q').value); };
    const a = $('[data-ai-ask]', body); if (a) a.onclick = () => ask($('#hp-q').value);
  }
  function ask(q) {
    q = (q || '').trim(); if (!q || AI.busy) return;
    const history = AI.chat.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    AI.chat.push({ role: 'user', text: q });
    AI.busy = true; AI.seq += 1;
    send({ type: 'ai_ask', q, history, id: AI.seq });
    $('#hp-q').value = '';
    chatView();
  }
  // plain text from the model → safe HTML: **bold**, lists, paragraphs
  const BULLET = /^(?:[-*•]|\d+[.)])\s+/;
  function fmt(text) {
    const out = []; let tag = null;
    for (const raw of String(text).split('\n')) {
      const r = raw.trim(), m = BULLET.test(r);
      const line = esc(m ? r.replace(BULLET, '') : r).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:!?)]|$)/g, '$1<i>$2</i>');
      const want = m ? (/^\d/.test(r) ? 'ol' : 'ul') : null;
      if (tag && tag !== want) { out.push(`</${tag}>`); tag = null; }
      if (want && !tag) { out.push(`<${want}>`); tag = want; }
      if (want) out.push(`<li>${line}</li>`); else if (line) out.push(`<p>${line}</p>`);
    }
    if (tag) out.push(`</${tag}>`);
    return out.join('');
  }
  function chatView() {
    const body = $('#hp-body'); if (!body) return;
    body.innerHTML = `<div class="ai-top"><button class="hp-back" data-ai-topics>${ic('chevron')}<span>${esc(t('ai.topics'))}</span></button>
        <button class="lnk" data-ai-new>${esc(t('ai.new'))}</button></div>
      <div class="ai-chat">${AI.chat.map((m, mi) => {
        if (m.role === 'user') return `<div class="ai-msg me">${esc(m.text)}</div>`;
        if (m.error) return `<div class="ai-msg bot err"><p>${esc(t('ai.e.' + m.error))}</p></div>`;
        const acts = (m.actions || []).map(action).filter(Boolean);
        return `<div class="ai-msg bot">${fmt(m.text)}
          ${acts.length ? `<div class="ai-acts">${acts.map((a, j) => `<button class="btn${a.primary || j === 0 ? ' primary' : ''}" data-act="${mi}:${j}">${esc(a.label)}</button>${a.note ? `<small class="ai-note mono">${esc(a.note)}</small>` : ''}`).join('')}</div>` : ''}
          ${m.provider ? `<small class="ai-by">${esc(t('ai.by', { x: m.provider }))}</small>` : ''}</div>`;
      }).join('')}
      ${AI.busy ? `<div class="ai-msg bot think"><i></i><i></i><i></i><span>${esc(t('ai.think'))}</span></div>` : ''}</div>`;
    $('[data-ai-topics]', body).onclick = () => { if (!AI.busy) AI.chat = []; if (!AI.chat.length) list(''); };
    $('[data-ai-new]', body).onclick = () => { if (!AI.busy) { AI.chat = []; list(''); } };
    for (const b of $$('[data-act]', body)) b.onclick = () => {
      const [mi, j] = b.dataset.act.split(':').map(Number);
      const a = (AI.chat[mi].actions || []).map(action).filter(Boolean)[j]; if (!a) return;
      a.run();
      if (a.once) { b.disabled = true; toast(t('ai.done')); }
    };
    body.scrollTop = body.scrollHeight;
  }
  PH.onAiHelp = (m) => {
    if (m.op === 'key') {
      Object.assign(AI, { on: m.on, provider: m.provider, masked: m.masked, installing: m.installing, keys: m.keys || [], setup: false });
      if (m.on) toast(t('ai.saved'));
      if (onList()) list($('#hp-q').value);
      if (m.installing) setTimeout(aiState, 30000);
    } else if (m.op === 'error') {
      toast(t('ai.e.' + (m.error || 'other')), 'err');
    } else if (m.op === 'answer' && m.id === AI.seq) {
      AI.busy = false;
      AI.chat.push(m.error ? { role: 'assistant', error: m.error } : { role: 'assistant', text: m.text, actions: m.actions || [], provider: m.provider });
      if (panel && panel.classList.contains('on')) chatView();
    }
  };

  // the button in the top bar, next to the status
  const btn = document.createElement('button');
  btn.className = 'help-btn'; btn.id = 'help-btn';
  btn.innerHTML = `${ic('help')}<span></span>`;
  const pill = $('#status-pill') || $('#chain');
  pill.parentNode.insertBefore(btn, pill.nextSibling);
  btn.onclick = () => (panel && panel.classList.contains('on') ? close() : open());
  const label = () => PH.setText($('span', btn), t('hp.btn'));
  label();
  PH.onState.push(() => { if (btn.dataset.lang !== PH.lang) { btn.dataset.lang = PH.lang; label(); if (panel && panel.classList.contains('on')) list($('#hp-q').value); } });
  PH.openHelp = open;
})();
