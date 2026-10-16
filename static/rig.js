/* Lumo — Moje światła: the whole rig in one simple window.
 *
 * List:   every light group (lamps that share one DMX address = one entry, "×3" in the name),
 *         the DMX address map with clashes in red and what to do about them, and per group:
 *         Mrugnij (blink it), Kanały (what is on which channel + test sliders), Rozpoznaj kanały
 *         (step by step, for lamps without a manual), Nie świeci? (shutter search), rename, address, remove.
 * Add:    1 what kind of light → 2 which model (library search) or "I don't know" (channel count)
 *         → 3 address, how many lamps share it, where it stands → 4 blink + check the channels.
 * Uses PH (app.js), ic (icons.js), PH.openChannels (chedit.js), PH.quickTest (library.js),
 * PH.openLightCal (live.js).  Server: rig_add, lib_search, update_fixture, remove_fixture.
 */
'use strict';
(() => {
  const PH = window.PH;
  const { S, send, t, esc, toast } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'rg.title': 'Moje światła', 'rg.sub': 'Jedna pozycja = lampy z tym samym adresem DMX. Trzy identyczne lampy na adresie 1 to jedna pozycja „×3”.',
      'rg.add': 'Dodaj światło', 'rg.reset': 'Zacznij od nowa', 'rg.resetQ': 'Usunąć WSZYSTKIE lampy i zacząć od nowa? (Poprzednie ustawienia zostaną w Kopia zapasowa → Przywróć poprzednie.)',
      'rg.resetDone': 'Usunięto wszystkie lampy — możesz dodać je od nowa', 'rg.empty': 'Nie masz jeszcze żadnych świateł. Kliknij „Dodaj światło” — przeprowadzę Cię krok po kroku.',
      'rg.map': 'Adresy DMX', 'rg.ch': '{n} kan.', 'rg.addr': 'adres', 'rg.blink': 'Mrugnij', 'rg.channels': 'Kanały', 'rg.detect': 'Rozpoznaj kanały',
      'rg.nolight': 'Nie świeci?', 'rg.calib': 'Kalibruj', 'rg.laser': 'Ustaw laser',
      'lz.title': 'Ustaw laser: {n}', 'lz.lead': 'Tani laser ma na 1. kanale tryb: wyłączony / auto / dźwięk / DMX. Sprawdzam po kolei — kliknij „Świeci ładnie!”, gdy laser rysuje wzory. Nie kieruj lasera w oczy.',
      'lz.arm': 'Na czas testu laser zostanie uzbrojony. Nie kieruj go w oczy ludzi. Kontynuować?', 'lz.try': 'Próba {i} z {n}', 'lz.lit': 'Świeci ładnie!', 'lz.again': 'Jeszcze raz',
      'lz.none': 'Żadna wartość nie zapaliła lasera. Sprawdź: tryb DMX na wyświetlaczu lasera (np. d001 / A001), adres, kabel (DMX IN), kluczyk / przełącznik na laserze.',
      'lz.saved': 'Zapamiętane — laser świeci (kanał 1 = {v}). W pokazie pulsuje w rytm, gdy lasery są uzbrojone.', 'lz.skip': 'Zamknij', 'rg.del': 'Usuń', 'rg.delQ': 'Usunąć „{n}”?', 'rg.addrNote': 'Zmieniłeś adres — ustaw ten sam na wyświetlaczu lampy.',
      'rg.clash': 'Konflikt: „{a}” i „{b}” używają tych samych kanałów ({r}).', 'rg.clashSame': 'To ten sam model — jeśli to identyczne lampy z tym samym adresem, zostaw jedną pozycję i dopisz w nazwie „×2”.',
      'rg.clashDiff': 'To różne lampy — jedna musi mieć inny adres (tutaj i na wyświetlaczu lampy).', 'rg.moveFree': 'Przenieś „{n}” na wolny adres {a}', 'rg.keepOne': 'Usuń duplikat „{n}”',
      'rg.ok': 'Adresy bez konfliktów', 'rg.back': 'Wstecz', 'rg.next': 'Dalej', 'rg.close': 'Gotowe',
      'rg.s1': 'Krok 1 z 3 — co to za światło?', 'rg.s2': 'Krok 2 z 3 — jaki model?', 'rg.s3': 'Krok 3 z 3 — adres i miejsce',
      'ty.moving_head': 'Głowica ruchoma', 'ty.moving_headS': 'rusza się, obraca, koło kolorów / gobo', 'ty.par': 'Zwykłe światło / PAR', 'ty.parS': 'świeci w kolorach, nie rusza się',
      'ty.bar': 'Belka LED', 'ty.barS': 'listwa z kilkoma lampkami', 'ty.laser': 'Laser', 'ty.laserS': 'wiązki laserowe', 'ty.derby': 'Efekt / inne', 'ty.derbyS': 'derby, kula, „pająk”, efekt świetlny',
      'ty.strobe': 'Stroboskop', 'ty.strobeS': 'mocne białe błyski',
      'rg.search': 'Wpisz nazwę z naklejki lampy (np. „mini led spot”, „par 18x3w”)', 'rg.searching': 'Szukam…', 'rg.noRes': 'Nic nie znalazłem — spróbuj krótszą nazwę albo kliknij „Nie znam modelu”.',
      'rg.unknown': 'Nie znam modelu — ustawię kanały sam', 'rg.mode': 'Ile kanałów ma ustawione lampa? (na wyświetlaczu np. „9CH”, „11CH”)', 'rg.count': 'Liczba kanałów',
      'rg.countHint': 'Nie wiesz? Zostaw — potem w „Rozpoznaj kanały” Lumo sprawdzi je po kolei.', 'rg.address': 'Adres DMX (jak na wyświetlaczu lampy, np. d001 = 1)',
      'rg.free': 'pierwszy wolny: {a}', 'rg.lamps': 'Ile lamp ma ten adres?', 'rg.name': 'Nazwa', 'rg.where': 'Gdzie stoi? (patrząc z sali)', 'rg.left': 'Lewa strona', 'rg.center': 'Środek',
      'rg.right': 'Prawa strona', 'rg.front': 'Z przodu', 'rg.mount': 'Jak jest zamocowana?', 'rg.hang': 'Wisi (głową w dół)', 'rg.floor': 'Stoi (podstawą w dół)', 'rg.height': 'Wysokość',
      'rg.doAdd': 'Dodaj światło', 'rg.added': 'Dodano „{n}” — adres {a}, {c} kanałów', 'rg.addedS': 'Teraz sprawdź, czy wszystko się zgadza:',
      'rg.replT': 'Zmień model: {n}', 'rg.doRepl': 'Zmień model', 'rg.replaced': 'Zmieniono model „{n}” — adres {a}, {c} kanałów',
      'cx.edit': 'Ustawienia lampy…', 'cx.blink': 'Mrugnij', 'cx.channels': 'Kanały…', 'cx.detect': 'Rozpoznaj kanały krok po kroku', 'cx.nolight': 'Nie świeci? Znajdź ustawienie',
      'cx.cal': 'Kalibruj kierunki', 'cx.laser': 'Ustaw laser…', 'cx.dup': 'Dodaj jeszcze jedną taką samą', 'cx.model': 'Zmień model…', 'cx.off': 'Wyłącz tę lampę', 'cx.on': 'Włącz tę lampę',
      'cx.del': 'Usuń', 'cx.add': 'Dodaj światło…', 'cx.rig': 'Moje światła…', 'cx.aim': 'Celuj wszystkimi głowicami tutaj', 'cx.vFoh': 'Widok z sali', 'cx.vTop': 'Widok z góry', 'cx.vSide': 'Widok z boku',
      'rg.t1': '1. Mrugnij — czy to ta lampa?', 'rg.t2': '2. Kanały — poruszaj suwakami i zobacz, co robi lampa', 'rg.t3': '3. Rozpoznaj kanały krok po kroku (lampa bez instrukcji)',
      'rg.pick': 'Wybierz', 'rg.defMode': 'tryb domyślny — liczbę kanałów sprawdzisz po dodaniu',
      'rg.another': 'Dodaj kolejne światło', 'rg.toList': 'Wróć do listy', 'rg.side.left': 'lewe', 'rg.side.right': 'prawe', 'rg.side.center': 'środek', 'rg.side.front': 'przód',
      'rg.nm.moving_head': 'Głowice', 'rg.nm.par': 'Lampy PAR', 'rg.nm.bar': 'Belka LED', 'rg.nm.laser': 'Laser', 'rg.nm.derby': 'Efekt', 'rg.nm.strobe': 'Stroboskop',
    },
    it: {
      'rg.title': 'Le mie luci', 'rg.sub': 'Una voce = luci con lo stesso indirizzo DMX. Tre luci uguali sull’indirizzo 1 sono una voce „×3”.',
      'rg.add': 'Aggiungi luce', 'rg.reset': 'Ricomincia da capo', 'rg.resetQ': 'Eliminare TUTTE le luci e ricominciare? (Le impostazioni precedenti restano in Backup → Ripristina.)',
      'rg.resetDone': 'Tutte le luci eliminate — puoi aggiungerle di nuovo', 'rg.empty': 'Non hai ancora luci. Clicca „Aggiungi luce” — ti guido passo passo.',
      'rg.map': 'Indirizzi DMX', 'rg.ch': '{n} can.', 'rg.addr': 'indirizzo', 'rg.blink': 'Lampeggia', 'rg.channels': 'Canali', 'rg.detect': 'Riconosci i canali',
      'rg.nolight': 'Non si accende?', 'rg.laser': 'Imposta laser',
      'lz.title': 'Imposta laser: {n}', 'lz.lead': 'Il laser economico ha sul canale 1 la modalità: spento / auto / suono / DMX. Provo uno dopo l’altro — clicca „Si accende bene!” quando disegna figure. Mai negli occhi.',
      'lz.arm': 'Per il test il laser verrà armato. Non puntarlo negli occhi. Continuare?', 'lz.try': 'Prova {i} di {n}', 'lz.lit': 'Si accende bene!', 'lz.again': 'Ancora',
      'lz.none': 'Nessun valore ha acceso il laser. Controlla: modalità DMX sul display, indirizzo, cavo (DMX IN), chiave / interruttore del laser.',
      'lz.saved': 'Memorizzato — il laser si accende (canale 1 = {v}). Nello show pulsa a tempo quando i laser sono armati.', 'lz.skip': 'Chiudi', 'rg.calib': 'Calibra', 'rg.del': 'Elimina', 'rg.delQ': 'Eliminare „{n}”?', 'rg.addrNote': 'Hai cambiato l’indirizzo — imposta lo stesso sul display della luce.',
      'rg.clash': 'Conflitto: „{a}” e „{b}” usano gli stessi canali ({r}).', 'rg.clashSame': 'Stesso modello — se sono luci uguali con lo stesso indirizzo, tieni una voce e scrivi „×2” nel nome.',
      'rg.clashDiff': 'Luci diverse — una deve avere un altro indirizzo (qui e sul display).', 'rg.moveFree': 'Sposta „{n}” sull’indirizzo libero {a}', 'rg.keepOne': 'Elimina il doppione „{n}”',
      'rg.ok': 'Indirizzi senza conflitti', 'rg.back': 'Indietro', 'rg.next': 'Avanti', 'rg.close': 'Fatto',
      'rg.s1': 'Passo 1 di 3 — che luce è?', 'rg.s2': 'Passo 2 di 3 — quale modello?', 'rg.s3': 'Passo 3 di 3 — indirizzo e posizione',
      'ty.moving_head': 'Testa mobile', 'ty.moving_headS': 'si muove, ruota, ruota colori / gobo', 'ty.par': 'Luce semplice / PAR', 'ty.parS': 'colori, non si muove',
      'ty.bar': 'Barra LED', 'ty.barS': 'più lampade in fila', 'ty.laser': 'Laser', 'ty.laserS': 'raggi laser', 'ty.derby': 'Effetto / altro', 'ty.derbyS': 'derby, sfera, „ragno”',
      'ty.strobe': 'Strobo', 'ty.strobeS': 'lampi bianchi forti',
      'rg.search': 'Scrivi il nome dall’etichetta (es. „mini led spot”, „par 18x3w”)', 'rg.searching': 'Cerco…', 'rg.noRes': 'Niente trovato — prova un nome più corto o „Non conosco il modello”.',
      'rg.unknown': 'Non conosco il modello — imposto i canali io', 'rg.mode': 'Quanti canali ha impostato la luce? (sul display es. „9CH”, „11CH”)', 'rg.count': 'Numero di canali',
      'rg.countHint': 'Non lo sai? Lascia così — poi „Riconosci i canali” li prova uno a uno.', 'rg.address': 'Indirizzo DMX (come sul display, es. d001 = 1)',
      'rg.free': 'primo libero: {a}', 'rg.lamps': 'Quante luci hanno questo indirizzo?', 'rg.name': 'Nome', 'rg.where': 'Dove sta? (guardando dalla sala)', 'rg.left': 'Sinistra', 'rg.center': 'Centro',
      'rg.right': 'Destra', 'rg.front': 'Davanti', 'rg.mount': 'Come è montata?', 'rg.hang': 'Appesa (testa in giù)', 'rg.floor': 'In piedi (base in basso)', 'rg.height': 'Altezza',
      'rg.doAdd': 'Aggiungi luce', 'rg.added': '„{n}” aggiunta — indirizzo {a}, {c} canali', 'rg.addedS': 'Ora controlla che tutto sia giusto:',
      'rg.replT': 'Cambia modello: {n}', 'rg.doRepl': 'Cambia modello', 'rg.replaced': 'Modello di „{n}” cambiato — indirizzo {a}, {c} canali',
      'cx.edit': 'Impostazioni luce…', 'cx.blink': 'Lampeggia', 'cx.channels': 'Canali…', 'cx.detect': 'Riconosci i canali passo passo', 'cx.nolight': 'Non si accende? Trova l’impostazione',
      'cx.cal': 'Calibra le direzioni', 'cx.laser': 'Imposta laser…', 'cx.dup': 'Aggiungi un’altra uguale', 'cx.model': 'Cambia modello…', 'cx.off': 'Spegni questa luce', 'cx.on': 'Accendi questa luce',
      'cx.del': 'Elimina', 'cx.add': 'Aggiungi luce…', 'cx.rig': 'Le mie luci…', 'cx.aim': 'Punta tutte le teste qui', 'cx.vFoh': 'Vista dalla sala', 'cx.vTop': 'Vista dall’alto', 'cx.vSide': 'Vista di lato',
      'rg.t1': '1. Lampeggia — è questa luce?', 'rg.t2': '2. Canali — muovi i cursori e guarda cosa fa', 'rg.t3': '3. Riconosci i canali passo passo (senza manuale)',
      'rg.pick': 'Scegli', 'rg.defMode': 'modalità predefinita — i canali li controlli dopo',
      'rg.another': 'Aggiungi un’altra luce', 'rg.toList': 'Torna alla lista', 'rg.side.left': 'sinistra', 'rg.side.right': 'destra', 'rg.side.center': 'centro', 'rg.side.front': 'davanti',
      'rg.nm.moving_head': 'Teste', 'rg.nm.par': 'PAR', 'rg.nm.bar': 'Barra LED', 'rg.nm.laser': 'Laser', 'rg.nm.derby': 'Effetto', 'rg.nm.strobe': 'Strobo',
    },
  });

  const TYPES = [['moving_head', 'lamp'], ['par', 'par'], ['bar', 'bar'], ['laser', 'laser'], ['derby', 'derby'], ['strobe', 'bolt']];
  const TY_IC = Object.fromEntries(TYPES);
  const DEF_N = { moving_head: 11, par: 7, bar: 8, laser: 8, derby: 6, strobe: 2 };
  // a typical layout for a channel count: a starting point, checked with the sliders afterwards
  const TYPICAL = {
    moving_head: { 9: ['pan', 'tilt', 'cwheel', 'gobo', 'shutter', 'dimmer', 'speed', 'macro', 'none'],
      11: ['pan', 'pan_fine', 'tilt', 'tilt_fine', 'cwheel', 'gobo', 'shutter', 'dimmer', 'speed', 'macro', 'none'],
      14: ['pan', 'pan_fine', 'tilt', 'tilt_fine', 'speed', 'dimmer', 'shutter', 'red', 'green', 'blue', 'white', 'cwheel', 'macro', 'none'] },
    par: { 3: ['red', 'green', 'blue'], 4: ['red', 'green', 'blue', 'white'], 5: ['dimmer', 'red', 'green', 'blue', 'shutter'],
      6: ['dimmer', 'red', 'green', 'blue', 'white', 'shutter'], 7: ['dimmer', 'red', 'green', 'blue', 'white', 'shutter', 'macro'],
      8: ['dimmer', 'red', 'green', 'blue', 'white', 'shutter', 'macro', 'speed'] },
    strobe: { 1: ['dimmer'], 2: ['dimmer', 'shutter'] },
    // cheap RG / RGB lasers: CH1 = mode (off / auto / sound / DMX), then pattern / colour; the rest stays 0
    laser: { 1: ['macro'], 2: ['macro', 'laser'], 3: ['macro', 'laser_r', 'laser_g'], 4: ['macro', 'laser_r', 'laser_g', 'speed'] },
  };
  const layout = (ty, n) => (TYPICAL[ty] && TYPICAL[ty][n])
    || (ty === 'laser' ? ['macro', 'laser_r', 'laser_g', 'speed', 'spin'].concat(Array(Math.max(0, n - 5)).fill('none')).slice(0, n) : null)
    || (TYPICAL.par[n] && ty !== 'moving_head' ? TYPICAL.par[n] : Array.from({ length: n }, () => 'none'));
  const pad3 = (n) => String(n).padStart(3, '0');
  const R = { view: 'list', ftype: null, lib: null, mode: null, n: 0, results: [], q: '', address: 1, count: 1, name: '', side: 'left', mount: 'hang', height: 2.5, nameEdited: false, newId: null };

  /* ---------------------------------------------------------------- helpers */
  const lights = () => (S.st ? S.st.fixtures : []);
  function clashes(fx) {
    const out = [];
    const on = fx.filter((f) => f.enabled !== false);
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      const a = on[i], b = on[j], a1 = a.address, a2 = a.address + a.footprint - 1, b1 = b.address, b2 = b.address + b.footprint - 1;
      if (a1 <= b2 && b1 <= a2) out.push([a, b, `${Math.max(a1, b1)}–${Math.min(a2, b2)}`]);
    }
    return out;
  }
  function freeAddr(n, skipId) {
    const used = lights().filter((f) => f.id !== skipId).map((f) => [f.address, f.address + f.footprint - 1]);
    for (let a = 1; a + n - 1 <= 512; a++) if (!used.some(([x, y]) => a <= y && x <= a + n - 1)) return a;
    return 1;
  }
  function autoName() {
    const base = t('rg.nm.' + R.ftype), side = t('rg.side.' + R.side);
    return `${base} ${side}${R.count > 1 ? ` ×${R.count}` : ''}`.slice(0, 24);
  }
  function placePos() {
    const sg = (S.st && S.st.stage) || { width: 10, depth: 8 }, w = sg.width / 2, d = sg.depth / 2;
    const same = lights().filter((f) => (R.side === 'left' ? f.pos[0] < -w / 3 : R.side === 'right' ? f.pos[0] > w / 3 : Math.abs(f.pos[0]) <= w / 3)).length;
    const x = R.side === 'left' ? -w + 0.8 + same * 0.7 : R.side === 'right' ? w - 0.8 - same * 0.7 : (same % 2 ? 1 : -1) * Math.ceil(same / 2) * 0.8;
    const z = R.side === 'front' ? d - 0.8 : -d + 1;
    return [Math.round(x * 10) / 10, R.height, Math.round(z * 10) / 10];
  }
  function blink(f) {
    let k = 0;
    const tick = () => {
      send({ type: 'set_many', id: f.id, values: k % 2 ? { dimmer: 0 } : { dimmer: 255, red: 255, green: 255, blue: 255, strobe: 0 } });
      if (++k < 8) setTimeout(tick, 350); else send({ type: 'set_many', id: f.id, values: { dimmer: 200 } });
    };
    tick();
  }

  /* ---------------------------------------------------------------- window */
  function dlg() {
    let d = $('#rig-dlg');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'rig-dlg'; d.className = 'lux-dlg rig-dlg';
      document.body.appendChild(d);
      d.addEventListener('close', () => { laserEnd(); R.view = 'list'; });   // a laser test never stays on
    }
    return d;
  }
  function open(view, opts) {
    R.view = view || 'list';
    R.replace = null;
    if (opts && opts.replace != null) {                      // "Zmień model": the same lamp, its address and name stay
      const f = lights().find((x) => x.id === opts.replace);
      if (f) { resetAdd(); Object.assign(R, { replace: f.id, address: f.address, name: f.name, nameEdited: true }); }
    }
    const d = dlg();
    if (!d.open) d.showModal();
    render();
  }
  PH.openRig = open;

  function render() {
    const d = dlg(); if (!d.open) return;
    const head = (title, sub) => `<div class="ld-h"><b>${esc(title)}</b><button class="x" data-close>${ic('close')}</button></div>${sub ? `<p class="ld-lead">${esc(sub)}</p>` : ''}`;
    let html = '';
    if (R.view === 'list') html = head(t('rg.title'), t('rg.sub')) + listHtml();
    else if (R.view === 'type') html = head(R.replace != null ? t('rg.replT', { n: R.name }) : t('rg.s1'), R.replace != null ? t('rg.s1') : '') + `<div class="rg-types">${TYPES.map(([k, icn]) => `<button class="rg-type" data-ty="${k}">${ic(icn)}<b>${esc(t('ty.' + k))}</b><small>${esc(t('ty.' + k + 'S'))}</small></button>`).join('')}</div>
      <div class="ld-f"><button class="btn" data-go="list">${esc(t('rg.back'))}</button></div>`;
    else if (R.view === 'model') html = head(t('rg.s2')) + `<label class="hp-q rg-q">${ic('target')}<input type="search" id="rg-q" autocomplete="off" placeholder="${esc(t('rg.search'))}" value="${esc(R.q)}"></label>
      <div class="rg-res" id="rg-res"></div>
      <button class="rg-unknown" id="rg-unknown">${ic('channels')}<span>${esc(t('rg.unknown'))}</span>${ic('chevron')}</button>
      <div class="ld-f"><button class="btn" data-go="type">${esc(t('rg.back'))}</button></div>`;
    else if (R.view === 'place') html = head(t('rg.s3')) + placeHtml();
    else if (R.view === 'laser') {
      const f = lights().find((x) => x.id === LZ.id);
      html = head(t('lz.title', { n: f ? f.name : '' }), t('lz.lead'))
        + `<div class="cal-try"><b id="lz-n"></b><span class="mono" id="lz-v"></span></div>
          <p class="ld-warn" id="lz-none" hidden>${esc(t('lz.none'))}</p>
          <div class="ld-f"><button class="btn" id="lz-skip">${esc(t('lz.skip'))}</button><button class="btn" id="lz-again" hidden>${esc(t('lz.again'))}</button>
            <span class="grow"></span><button class="btn primary" id="lz-lit">${esc(t('lz.lit'))}</button></div>`;
    }
    else if (R.view === 'added') {
      const f = lights().find((x) => x.id === R.newId);
      html = head(t(R.replaced ? 'rg.replaced' : 'rg.added', { n: f ? f.name : R.name, a: pad3(f ? f.address : R.address), c: f ? f.footprint : R.n }), t('rg.addedS'))
        + `<div class="rg-checks"><button class="rg-check" data-a="blink">${ic('sun')}<span>${esc(t('rg.t1'))}</span></button>
          <button class="rg-check" data-a="channels">${ic('channels')}<span>${esc(t('rg.t2'))}</span></button>
          <button class="rg-check" data-a="detect">${ic('sparkle')}<span>${esc(t('rg.t3'))}</span></button></div>
          <div class="ld-f"><button class="btn" data-go="list">${esc(t('rg.toList'))}</button><button class="btn primary" data-go="type">${ic('plus')}<span>${esc(t('rg.another'))}</span></button></div>`;
    }
    d.innerHTML = html;
    for (const b of $$('[data-close]', d)) b.onclick = () => d.close();
    if (R.view === 'laser') laserRun(d);
    for (const b of $$('[data-go]', d)) b.onclick = () => { R.view = b.dataset.go; if (R.view === 'type') resetAdd(); render(); };
    bind(d);
  }
  function resetAdd() {
    const keep = R.replace != null ? { name: R.name, nameEdited: true } : { name: '', nameEdited: false };   // "Zmień model" keeps the name
    Object.assign(R, { ftype: null, lib: null, mode: null, n: 0, results: [], q: '', count: 1, side: 'left', mount: 'hang', height: 2.5, newId: null }, keep);
  }

  /* ---------------------------------------------------------------- list */
  function listHtml() {
    const fx = lights(), cl = clashes(fx);
    if (!fx.length) return `<p class="rg-empty">${esc(t('rg.empty'))}</p><div class="ld-f"><button class="btn primary" data-act="add">${ic('plus')}<span>${esc(t('rg.add'))}</span></button></div>`;
    const top = Math.max(48, Math.ceil((Math.max(...fx.map((f) => f.address + f.footprint - 1)) + 8) / 16) * 16);
    const bad = new Set(cl.flatMap(([a, b]) => [a.id, b.id]));
    const map = `<div class="rg-map"><div class="rg-map-h"><b>${esc(t('rg.map'))}</b><span>1 – ${top}</span></div><div class="rg-bar">${fx.map((f) => `<i class="${bad.has(f.id) ? 'bad' : ''}" style="left:${(f.address - 1) / top * 100}%;width:${f.footprint / top * 100}%" title="${esc(f.name)} · ${f.address}–${f.address + f.footprint - 1}"></i>`).join('')}</div></div>`;
    const clashHtml = cl.length ? cl.map(([a, b, r]) => {
      const same = a.model && a.model === b.model && a.footprint === b.footprint;
      const mover = a.address >= b.address ? a : b, keep = mover === a ? b : a;
      return `<div class="rg-clash">${ic('warn')}<div><b>${esc(t('rg.clash', { a: a.name, b: b.name, r }))}</b><p>${esc(t(same ? 'rg.clashSame' : 'rg.clashDiff'))}</p>
        <div class="rg-clash-b">${same ? `<button class="btn" data-del="${mover.id}">${esc(t('rg.keepOne', { n: mover.name }))}</button>` : ''}
        <button class="btn" data-free="${mover.id}">${esc(t('rg.moveFree', { n: mover.name, a: freeAddr(mover.footprint, mover.id) }))}</button></div></div></div>`;
    }).join('') : `<p class="rg-ok">${ic('check')}${esc(t('rg.ok'))}</p>`;
    const cards = fx.slice().sort((a, b) => a.address - b.address).map((f) => `<div class="rg-card${bad.has(f.id) ? ' bad' : ''}">
        <span class="rg-ic">${ic(TY_IC[f.type] || 'lamp')}</span>
        <div class="rg-main"><input class="rg-name" data-name="${f.id}" value="${esc(f.name)}" maxlength="24" spellcheck="false">
          <small>${esc(f.model || t('ty.' + (f.type || 'par')))} · ${esc(t('rg.ch', { n: f.footprint }))}</small></div>
        <label class="rg-addr"><small>${esc(t('rg.addr'))}</small><input type="number" min="1" max="${513 - f.footprint}" value="${f.address}" data-addr="${f.id}"><span>–${pad3(f.address + f.footprint - 1)}</span></label>
        <div class="rg-acts">
          <button class="btn" data-blink="${f.id}">${ic('sun')}<span>${esc(t('rg.blink'))}</span></button>
          <button class="btn" data-chan="${f.id}">${ic('channels')}<span>${esc(t('rg.channels'))}</span></button>
          <button class="btn" data-detect="${f.id}">${ic('sparkle')}<span>${esc(t('rg.detect'))}</span></button>
          ${f.type !== 'laser' ? `<button class="btn" data-nolight="${f.id}">${ic('warn')}<span>${esc(t('rg.nolight'))}</span></button>`
            : `<button class="btn" data-laser="${f.id}">${ic('laser')}<span>${esc(t('rg.laser'))}</span></button>`}
          <button class="btn danger-t" data-del="${f.id}" title="${esc(t('rg.del'))}">${ic('trash')}</button>
        </div></div>`).join('');
    return `${map}${clashHtml}<div class="rg-list">${cards}</div>
      <div class="ld-f"><button class="btn danger-t" data-act="reset">${esc(t('rg.reset'))}</button><span class="grow"></span>
        <button class="btn" data-close>${esc(t('rg.close'))}</button><button class="btn primary" data-act="add">${ic('plus')}<span>${esc(t('rg.add'))}</span></button></div>`;
  }

  /* ---------------------------------------------------------------- right-click menus (3-D scene, the lamp bar) */
  let menuEl = null;
  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove(); menuEl = null;
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', menuKey, true);
    window.removeEventListener('blur', closeMenu); window.removeEventListener('resize', closeMenu);
  }
  const outside = (e) => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); };
  const menuKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } };
  // items: '-' | {head, sub} | {icon, label, fn, danger?}
  function menu(x, y, items) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu'; menuEl.setAttribute('role', 'menu');
    menuEl.innerHTML = items.map((it, i) => (it === '-' ? '<hr>'
      : it.head ? `<div class="ctx-h"><b>${esc(it.head)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</div>`
        : `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}">${ic(it.icon)}<span>${esc(it.label)}</span></button>`)).join('');
    document.body.appendChild(menuEl);
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
    menuEl.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    for (const b of $$('[data-i]', menuEl)) b.onclick = () => { const it = items[Number(b.dataset.i)]; closeMenu(); it.fn(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', menuKey, true);
    window.addEventListener('blur', closeMenu); window.addEventListener('resize', closeMenu);
    const first = $('[data-i]', menuEl); if (first) first.focus({ preventScroll: true });
  }
  function lampMenu(x, y, id) {
    const f = lights().find((l) => l.id === id); if (!f) return;
    const on = f.enabled !== false, laser = f.type === 'laser', head = f.type === 'moving_head' || f.type === 'derby';
    const items = [
      { head: f.name, sub: `DMX ${pad3(f.address)}–${pad3(f.address + f.footprint - 1)} · ${f.model || t('ty.' + (f.type || 'par'))}` },
      { icon: 'edit', label: t('cx.edit'), fn: () => { send({ type: 'select', id }); if (PH.editDevice) PH.editDevice(id); else PH.openFixtureDialog(f); } },
      { icon: 'sun', label: t('cx.blink'), fn: () => blink(f) },
      { icon: 'channels', label: t('cx.channels'), fn: () => PH.openChannels && PH.openChannels(f) },
      { icon: 'sparkle', label: t('cx.detect'), fn: () => { PH.setTab('setup'); if (PH.quickTest) PH.quickTest(id); } },
      laser ? { icon: 'laser', label: t('cx.laser'), fn: () => { open(); laserStart(id); } }
        : { icon: 'warn', label: t('cx.nolight'), fn: () => PH.openLightCal && PH.openLightCal(id, 'shutter') },
      ...(head ? [{ icon: 'target', label: t('cx.cal'), fn: () => PH.openLightCal && PH.openLightCal(id) }] : []),
      '-',
      { icon: 'copy', label: t('cx.dup'), fn: () => { send({ type: 'duplicate_fixture', id }); send({ type: 'save' }); } },
      { icon: 'layers', label: t('cx.model'), fn: () => open('type', { replace: id }) },
      { icon: 'blackout', label: t(on ? 'cx.off' : 'cx.on'), fn: () => { send({ type: 'update_fixture', id, enabled: !on }); send({ type: 'save' }); } },
      '-',
      { icon: 'trash', label: t('cx.del'), danger: true, fn: () => { if (confirm(t('rg.delQ', { n: f.name }))) send({ type: 'remove_fixture', id }); } },
    ];
    menu(x, y, items);
  }
  function stageMenu(x, y, extra) {
    menu(x, y, [
      { icon: 'plus', label: t('cx.add'), fn: () => open('type') },
      { icon: 'lamp', label: t('cx.rig'), fn: () => open() },
      ...(extra && extra.length ? ['-', ...extra] : []),
    ]);
  }
  PH.lampMenu = lampMenu; PH.stageMenu = stageMenu; PH.closeMenu = closeMenu; PH.ctxMenu = menu;
  PH.blinkLamp = (id) => { const f = lights().find((l) => l.id === id); if (f) blink(f); };

  /* ---------------------------------------------------------------- laser: find the CH1 value at which it shines */
  const LZ = { id: null, timer: null, armed: false, orig: null, saved: false };
  function laserStart(id) {
    const f = lights().find((x) => x.id === id); if (!f) return;
    LZ.armed = !!(S.st && S.st.lasers_enabled);
    if (!LZ.armed && !confirm(t('lz.arm'))) return;
    Object.assign(LZ, { id, orig: f.laser_mode ?? null, saved: false });
    if (!LZ.armed) send({ type: 'lasers', value: true });
    send({ type: 'fx_start', kind: 'laser_on', id: 'rg-laser', targets: [id], params: {} });
    R.view = 'laser'; render();
  }
  function laserEnd() {
    clearInterval(LZ.timer); LZ.timer = null;
    if (LZ.id == null) return;
    send({ type: 'fx_stop', id: 'rg-laser' });
    if (!LZ.saved) send({ type: 'update_fixture', id: LZ.id, laser_mode: LZ.orig });
    if (!LZ.armed) send({ type: 'lasers', value: false });
    LZ.id = null;
  }
  function laserRun(d) {
    clearInterval(LZ.timer);
    const tries = [...new Set([LZ.orig ?? 255, 255, 224, 192, 160, 128, 96, 64, 32])];
    let k = -1, at = 0;
    const step = () => {
      k++;
      if (k >= tries.length) {
        clearInterval(LZ.timer); LZ.timer = null;
        send({ type: 'update_fixture', id: LZ.id, laser_mode: LZ.orig });
        $('#lz-none', d).hidden = false; $('#lz-again', d).hidden = false; $('#lz-lit', d).hidden = true;
        return;
      }
      at = performance.now();
      send({ type: 'update_fixture', id: LZ.id, laser_mode: tries[k] });
      PH.setText($('#lz-n', d), t('lz.try', { i: k + 1, n: tries.length }));
      PH.setText($('#lz-v', d), `CH1 = ${tries[k]}`);
    };
    step();
    LZ.timer = setInterval(step, 2200);
    $('#lz-lit', d).onclick = () => {
      clearInterval(LZ.timer); LZ.timer = null;
      const v = performance.now() - at < 600 && k > 0 ? tries[k - 1] : tries[k];   // a click right after a change meant the one before
      send({ type: 'update_fixture', id: LZ.id, laser_mode: v });
      LZ.saved = true;
      toast(t('lz.saved', { v }));
      laserEnd(); R.view = 'list'; render();
    };
    $('#lz-again', d).onclick = () => render();
    $('#lz-skip', d).onclick = () => { laserEnd(); R.view = 'list'; render(); };
  }

  /* ---------------------------------------------------------------- add: step 3 */
  function placeHtml() {
    const n = R.lib ? (R.mode ? R.mode[1] : 12) : R.n;
    if (!R.nameEdited) R.name = autoName();
    const tile = (k, v, cur) => `<button class="rg-tile${cur === v ? ' on' : ''}" data-${k}="${v}">${esc(t('rg.' + v))}</button>`;
    return `<div class="rg-form">
      ${R.lib ? `<p class="rg-chosen">${ic('check')}<b>${esc(R.lib.model)}</b> · ${R.mode ? `${esc(R.mode[0])} (${n} ${esc(t('rg.ch', { n: '' }).trim())})` : esc(t('rg.defMode'))}</p>`
        : `<label class="ld-field"><span>${esc(t('rg.mode'))}</span><span class="row"><input type="number" id="rg-n" min="1" max="48" value="${R.n}" style="max-width:110px"><small>${esc(t('rg.countHint'))}</small></span></label>`}
      <label class="ld-field"><span>${esc(t('rg.address'))}</span><span class="row"><input type="number" id="rg-a" min="1" max="512" value="${R.address}" style="max-width:110px"><small id="rg-free">${esc(t('rg.free', { a: freeAddr(n, R.replace) }))}</small></span></label>
      ${R.replace != null ? '' : `<label class="ld-field"><span>${esc(t('rg.lamps'))}</span><span class="row rg-count">${[1, 2, 3, 4, 5, 6].map((c) => `<button class="rg-tile${R.count === c ? ' on' : ''}" data-count="${c}">${c}</button>`).join('')}</span></label>
      <div class="ld-field"><span>${esc(t('rg.where'))}</span><span class="row rg-tiles">${tile('side', 'left', R.side)}${tile('side', 'center', R.side)}${tile('side', 'right', R.side)}${tile('side', 'front', R.side)}</span></div>
      ${R.ftype === 'moving_head' || R.ftype === 'derby' ? `<div class="ld-field"><span>${esc(t('rg.mount'))}</span><span class="row rg-tiles">${tile('mount', 'hang', R.mount)}${tile('mount', 'floor', R.mount)}</span></div>` : ''}
      <label class="ld-field"><span>${esc(t('rg.height'))} <b class="mono" id="rg-h-v">${R.height.toFixed(1)} m</b></span><input type="range" id="rg-h" min="0" max="6" step="0.1" value="${R.height}"></label>`}
      <label class="ld-field"><span>${esc(t('rg.name'))}</span><input id="rg-name" maxlength="24" value="${esc(R.name)}"></label>
    </div>
    <div class="ld-f"><button class="btn" data-go="model">${esc(t('rg.back'))}</button><button class="btn primary" id="rg-add">${ic(R.replace != null ? 'refresh' : 'plus')}<span>${esc(t(R.replace != null ? 'rg.doRepl' : 'rg.doAdd'))}</span></button></div>`;
  }

  /* ---------------------------------------------------------------- events */
  function bind(d) {
    for (const b of $$('[data-act="add"]', d)) b.onclick = () => { resetAdd(); R.view = 'type'; render(); };
    const reset = $('[data-act="reset"]', d);
    if (reset) reset.onclick = () => {
      if (!confirm(t('rg.resetQ'))) return;
      for (const f of lights()) send({ type: 'remove_fixture', id: f.id });
      toast(t('rg.resetDone'), 'warn');
    };
    for (const b of $$('[data-blink]', d)) b.onclick = () => { const f = lights().find((x) => x.id === Number(b.dataset.blink)); if (f) blink(f); };
    for (const b of $$('[data-chan]', d)) b.onclick = () => { const f = lights().find((x) => x.id === Number(b.dataset.chan)); if (f && PH.openChannels) PH.openChannels(f); };
    for (const b of $$('[data-detect]', d)) b.onclick = () => { const id = Number(b.dataset.detect); d.close(); PH.setTab('setup'); if (PH.quickTest) PH.quickTest(id); };
    for (const b of $$('[data-nolight]', d)) b.onclick = () => { const id = Number(b.dataset.nolight); d.close(); if (PH.openLightCal) PH.openLightCal(id, 'shutter'); };
    for (const b of $$('[data-laser]', d)) b.onclick = () => laserStart(Number(b.dataset.laser));
    for (const b of $$('[data-del]', d)) b.onclick = () => {
      const f = lights().find((x) => x.id === Number(b.dataset.del));
      if (f && confirm(t('rg.delQ', { n: f.name }))) send({ type: 'remove_fixture', id: f.id });
    };
    for (const b of $$('[data-free]', d)) b.onclick = () => {
      const f = lights().find((x) => x.id === Number(b.dataset.free)); if (!f) return;
      send({ type: 'update_fixture', id: f.id, address: freeAddr(f.footprint, f.id) }); toast(t('rg.addrNote'), 'warn');
    };
    for (const el of $$('[data-name]', d)) el.onchange = () => { const v = el.value.trim(); if (v) send({ type: 'update_fixture', id: Number(el.dataset.name), name: v.slice(0, 24) }); };
    for (const el of $$('[data-addr]', d)) el.onchange = () => {
      const v = Math.max(1, Math.min(512, Number(el.value) || 1));
      send({ type: 'update_fixture', id: Number(el.dataset.addr), address: v }); toast(t('rg.addrNote'), 'warn');
    };
    for (const b of $$('[data-ty]', d)) b.onclick = () => { R.ftype = b.dataset.ty; R.n = DEF_N[R.ftype] || 8; R.view = 'model'; R.q = ''; search(''); render(); };
    const q = $('#rg-q', d);
    if (q) {
      let timer = null;
      q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => search(q.value), 250); };
      setTimeout(() => q.focus(), 60);
      showResults();
    }
    const unk = $('#rg-unknown', d);
    if (unk) unk.onclick = () => { R.lib = null; R.mode = null; if (R.replace == null) R.address = freeAddr(R.n); R.view = 'place'; render(); };
    // step 3
    const nIn = $('#rg-n', d); if (nIn) nIn.onchange = () => { R.n = Math.max(1, Math.min(48, Number(nIn.value) || 1)); if (R.replace == null) R.address = freeAddr(R.n); render(); };
    const aIn = $('#rg-a', d); if (aIn) aIn.onchange = () => { R.address = Math.max(1, Math.min(512, Number(aIn.value) || 1)); };
    for (const b of $$('[data-count]', d)) b.onclick = () => { R.count = Number(b.dataset.count); render(); };
    for (const b of $$('[data-side]', d)) b.onclick = () => { R.side = b.dataset.side; if (R.side === 'front' && R.ftype !== 'moving_head') R.height = 0.3; render(); };
    for (const b of $$('[data-mount]', d)) b.onclick = () => { R.mount = b.dataset.mount; render(); };
    const h = $('#rg-h', d); if (h) h.oninput = () => { R.height = Number(h.value); $('#rg-h-v').textContent = `${R.height.toFixed(1)} m`; };
    const nm = $('#rg-name', d); if (nm) nm.oninput = () => { R.name = nm.value; R.nameEdited = true; };
    const add = $('#rg-add', d);
    if (add) add.onclick = () => {
      const msg = { type: 'rig_add', name: (R.name || autoName()).trim().slice(0, 24), address: R.address, ftype: R.ftype,
        mount: R.ftype === 'moving_head' || R.ftype === 'derby' ? R.mount : 'floor', pos: placePos() };
      if (R.lib) Object.assign(msg, { lib_id: R.lib.id, mode: R.mode ? R.mode[0] : undefined });
      else msg.channels = layout(R.ftype, R.n);
      if (R.replace != null) { msg.replace = R.replace; delete msg.pos; delete msg.mount; }   // the lamp stays where it is
      send(msg);
      add.disabled = true;
    };
    for (const b of $$('[data-a]', d)) b.onclick = () => {
      const f = lights().find((x) => x.id === R.newId); if (!f) return;
      if (b.dataset.a === 'blink') blink(f);
      else if (b.dataset.a === 'channels' && PH.openChannels) PH.openChannels(f);
      else if (b.dataset.a === 'detect') { d.close(); PH.setTab('setup'); if (PH.quickTest) PH.quickTest(f.id); }
    };
  }

  /* ---------------------------------------------------------------- library search */
  function search(q) {
    R.q = q; R.searching = true;
    send({ type: 'lib_search', q, category: q ? '' : (R.ftype === 'par' ? 'par' : R.ftype || '') });
    showResults();
  }
  PH.LIB_LISTENERS.push((m) => {
    if (m.op !== 'search' || R.view !== 'model' || (m.q || '') !== R.q) return;
    R.searching = false;
    R.results = (m.results || []).slice(0, 24);
    showResults();
  });
  function showResults() {
    const box = $('#rg-res'); if (!box) return;
    if (R.searching && !R.results.length) { box.innerHTML = `<p class="rg-empty">${esc(t('rg.searching'))}</p>`; return; }
    if (!R.results.length) { box.innerHTML = `<p class="rg-empty">${esc(t('rg.noRes'))}</p>`; return; }
    box.innerHTML = R.results.map((r, i) => `<div class="rg-hit"><span class="rg-ic">${ic(TY_IC[r.category] || 'lamp')}</span>
        <div class="rg-main"><b>${esc(r.model)}</b><small>${esc(r.manufacturer || '')}</small></div>
        <div class="rg-modes">${(r.modes || []).length ? r.modes.map((md, j) => `<button class="btn" data-pick="${i}:${j}">${esc(md[0])} · ${md[1]} ${esc(t('rg.ch', { n: '' }).trim())}</button>`).join('')
          : `<button class="btn" data-pick="${i}:-1">${esc(t('rg.pick'))}</button>`}</div></div>`).join('');
    for (const b of $$('[data-pick]', box)) b.onclick = () => {
      const [i, j] = b.dataset.pick.split(':').map(Number), r = R.results[i];
      R.lib = r; R.mode = j >= 0 ? r.modes[j] : null;            // no modes yet (online library): the default one
      if (!R.ftype || R.ftype === 'derby') R.ftype = TY_IC[r.category] ? r.category : R.ftype;
      if (R.replace == null) R.address = freeAddr(R.mode ? R.mode[1] : 12);
      R.view = 'place'; render();
    };
  }

  /* ---------------------------------------------------------------- server answers + live list */
  PH.onRig = (m) => {
    if (m.op !== 'added') return;
    R.newId = m.id; R.view = 'added'; R.replaced = !!m.replaced; R.replace = null;
    render();
    const f = lights().find((x) => x.id === m.id); if (f) blink(f);
    else setTimeout(() => { const g = lights().find((x) => x.id === m.id); if (g) blink(g); }, 400);
  };
  let sig = '';
  PH.onState.push((st) => {
    const d = $('#rig-dlg'); if (!d || !d.open || R.view !== 'list') return;
    if (d.contains(document.activeElement) && document.activeElement.matches('input')) return;   // do not rebuild while typing
    const s = JSON.stringify([st.fixtures.map((f) => [f.id, f.name, f.address, f.footprint, f.type, f.model, f.enabled]), PH.lang]);
    if (s !== sig) { sig = s; render(); }
  });
})();
