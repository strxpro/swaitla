/* Lumo — "Kabel i lampa": one click checks the USB-DMX cable and the lamps, repairs what it can
 * and tells, in plain words, what to do with the cable and on the lamp's own display.
 * It also runs by itself: shortly after start and whenever the DMX link drops.
 */
(() => {
  const PH = window.PH;
  const { S, send, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  PH.addI18n({
    pl: {
      'dd.title': 'Kabel i lampa', 'dd.sub': 'Sprawdzam kabel USB‑DMX, połączenie i lampy. Co się da — naprawiam sam, resztę opisuję krok po kroku.',
      'dd.run': 'Sprawdź i napraw', 'dd.again': 'Sprawdź jeszcze raz', 'dd.running': 'Sprawdzam…',
      'dd.allOk': 'Wszystko działa — kabel wysyła dane do lamp.', 'dd.someWarn': 'Działa, ale są rzeczy do poprawienia.', 'dd.someErr': 'Coś blokuje światło — zobacz czerwone punkty.',
      'dd.fixedN': 'Naprawiłem sam: {n}', 'dd.fix': 'Napraw', 'dd.blink': 'Mrugnij lampą', 'dd.white': 'Zapal na biało', 'dd.off': 'Zgaś',
      'dd.cable.ok': 'Kabel podłączony: {name} (numer S/N {serial})', 'dd.cable.warn': 'Kabel widoczny jako port {port}, ale bez sterownika FTDI — działa wolniej.',
      'dd.cable.err': 'Nie widzę kabla USB‑DMX. Wyjmij go i włóż ponownie, najlepiej do innego gniazda USB (bez rozgałęźnika).',
      'dd.rival.ok': 'Żaden inny program nie trzyma kabla.', 'dd.rival.err': 'Otwarty jest {names} — kabel może mieć tylko jeden program naraz. Kliknij „Napraw”, żeby go zamknąć.',
      'dd.released.fixed': 'Kabel był oddany innemu programowi — przejąłem go z powrotem.', 'dd.released.warn': 'Kabel jest oddany innemu programowi.', 'dd.released.err': 'Nie udało się przejąć kabla.',
      'dd.mode.ok': 'Tryb kabla: Open DMX (tak samo jak w QLC+).', 'dd.mode.fixed': 'Kabel był ustawiony jako „{was}” — przełączyłem na Open DMX.', 'dd.mode.warn': 'Kabel ustawiony jako „{was}”, a powinien być Open DMX.',
      'dd.link.ok': 'Połączenie otwarte: {status}', 'dd.link.fixed': 'Połączenie było zerwane — połączyłem ponownie.',
      'dd.link.err': 'Nie mogę otworzyć kabla: {why}. Wyjmij kabel z USB, odczekaj 5 s i włóż z powrotem.',
      'dd.busy.err': 'Kabel jest zajęty przez inny program (np. QLC+ albo drugie okno Lumo). Kliknij „Napraw” — zamknę QLC+ i przejmę kabel. Jeśli nie pomoże: wyjmij kabel z USB na 5 s.',
      'dd.send.ok': 'Dane płyną do lamp: {hz} ramek na sekundę.', 'dd.send.err': 'Kabel przyjmuje dane, ale ich nie wysyła ({hz} Hz). Wyjmij i włóż kabel USB.',
      'dd.frames.ok': 'Pełne ramki 512 kanałów (jak w QLC+).', 'dd.frames.fixed': 'Włączyłem pełne ramki 512 kanałów — część lamp nie reaguje na krótkie.', 'dd.frames.warn': 'Włączone krótkie ramki — część lamp ich nie rozumie.',
      'dd.lamps.ok': 'Urządzenia na scenie: {n}', 'dd.lamps.err': 'Nie ma żadnej lampy — dodaj ją w Urządzeniach albo wczytaj z QLC+.',
      'dd.blackout.fixed': 'Był włączony Blackout — wyłączyłem.', 'dd.blackout.warn': 'Włączony Blackout — lampy są wygaszone.',
      'dd.master.fixed': 'Suwak Master był na zerze — ustawiłem 100%.', 'dd.master.warn': 'Suwak Master na zerze.',
      'dd.dark.warn': 'Jasność wszystkich lamp jest na 0 — dlatego nic nie świeci. Kliknij „Zapal na biało”.',
      'dd.overlap.err': 'Adresy lamp nachodzą na siebie: {list}',
      'dd.lampT': 'Co ustawić na lampie', 'dd.lampS': 'Lampa nie wie, że ma słuchać Lumo — ustaw to na jej wyświetlaczu (przyciski MENU / UP / DOWN / ENTER).',
      'dd.l1': 'Kabel DMX (XLR) z przejściówki do gniazda <b>DMX IN</b> lampy, nie do OUT.',
      'dd.l2': 'Adres startowy: <b>{code}</b> (czasem wyświetla się jako <b>{code2}</b>). Lampa zajmuje kanały {a}–{e}.',
      'dd.l3': 'Tryb kanałów: <b>{n}CH</b> (menu „CH”, „Mode” albo „Show”).',
      'dd.l4': 'Tryb pracy: <b>DMX</b> — nie „Sound”, „Auto”, „Slave” ani „Master”. W tych trybach lampa ignoruje sterowanie.',
      'dd.l5': 'Po zmianie kliknij „Mrugnij lampą” — lampa powinna błysnąć 2 s.',
      'dd.ledT': 'Diody na kablu', 'dd.led': 'USB = kabel ma prąd. OUT/IN nie w każdym kablu świeci w trybie Open DMX. Sprawdź: jeśli w QLC+ dioda OUT też nie świeci, a lampa działa — dioda po prostu nie jest wskaźnikiem. Liczy się to, czy lampa mruga po „Mrugnij lampą”.',
      'dd.snT': 'Co to jest S/N?', 'dd.sn': 'S/N to numer seryjny kabla (Twój: {s}). Gdy w QLC+ widzisz pusty „(S/N: )”, kabel jest właśnie zajęty przez Lumo — to nie błąd. Żeby użyć QLC+, kliknij w Lumo „Oddaj kabel”.',
      'dd.auto': 'Kabel DMX: {r}', 'dd.autoLink': 'Zobacz „Kabel i lampa”', 'dd.autoFixed': 'Naprawiłem połączenie z lampą ({n})',
      'dd.nothing': 'Brak lamp — najpierw dodaj urządzenie.',
    },
    it: {
      'dd.title': 'Cavo e luce', 'dd.sub': 'Controllo il cavo USB‑DMX, la connessione e le luci. Quello che posso lo riparo da solo, il resto lo spiego passo per passo.',
      'dd.run': 'Controlla e ripara', 'dd.again': 'Controlla di nuovo', 'dd.running': 'Controllo…',
      'dd.allOk': 'Tutto funziona — il cavo invia i dati alle luci.', 'dd.someWarn': 'Funziona, ma c’è qualcosa da sistemare.', 'dd.someErr': 'Qualcosa blocca la luce — guarda i punti rossi.',
      'dd.fixedN': 'Riparato da solo: {n}', 'dd.fix': 'Ripara', 'dd.blink': 'Fai lampeggiare', 'dd.white': 'Accendi bianco', 'dd.off': 'Spegni',
      'dd.cable.ok': 'Cavo collegato: {name} (numero S/N {serial})', 'dd.cable.warn': 'Cavo visto come porta {port}, ma senza driver FTDI — più lento.',
      'dd.cable.err': 'Non vedo il cavo USB‑DMX. Staccalo e ricollegalo, meglio in un’altra porta USB (senza hub).',
      'dd.rival.ok': 'Nessun altro programma tiene il cavo.', 'dd.rival.err': 'È aperto {names} — il cavo può averlo un solo programma. Clicca „Ripara” per chiuderlo.',
      'dd.released.fixed': 'Il cavo era ceduto a un altro programma — l’ho ripreso.', 'dd.released.warn': 'Il cavo è ceduto a un altro programma.', 'dd.released.err': 'Non riesco a riprendere il cavo.',
      'dd.mode.ok': 'Modalità cavo: Open DMX (come in QLC+).', 'dd.mode.fixed': 'Il cavo era impostato come „{was}” — passato a Open DMX.', 'dd.mode.warn': 'Il cavo è impostato come „{was}”, dovrebbe essere Open DMX.',
      'dd.link.ok': 'Connessione aperta: {status}', 'dd.link.fixed': 'La connessione era caduta — ricollegata.',
      'dd.link.err': 'Non riesco ad aprire il cavo: {why}. Stacca il cavo USB, aspetta 5 s e ricollegalo.',
      'dd.busy.err': 'Il cavo è occupato da un altro programma (es. QLC+ o un’altra finestra di Lumo). Clicca „Ripara” — chiudo QLC+ e riprendo il cavo. Se non basta: stacca il cavo USB per 5 s.',
      'dd.send.ok': 'I dati arrivano alle luci: {hz} frame al secondo.', 'dd.send.err': 'Il cavo accetta i dati ma non li invia ({hz} Hz). Stacca e ricollega il cavo USB.',
      'dd.frames.ok': 'Frame completi da 512 canali (come in QLC+).', 'dd.frames.fixed': 'Attivati i frame completi da 512 canali — alcune luci ignorano quelli corti.', 'dd.frames.warn': 'Frame corti attivi — alcune luci non li capiscono.',
      'dd.lamps.ok': 'Dispositivi sul palco: {n}', 'dd.lamps.err': 'Nessuna luce — aggiungila in Dispositivi o caricala da QLC+.',
      'dd.blackout.fixed': 'Il Blackout era attivo — spento.', 'dd.blackout.warn': 'Blackout attivo — le luci sono spente.',
      'dd.master.fixed': 'Il Master era a zero — messo al 100%.', 'dd.master.warn': 'Master a zero.',
      'dd.dark.warn': 'La luminosità di tutte le luci è a 0 — per questo non si accende niente. Clicca „Accendi bianco”.',
      'dd.overlap.err': 'Gli indirizzi delle luci si sovrappongono: {list}',
      'dd.lampT': 'Cosa impostare sulla luce', 'dd.lampS': 'La luce non sa di dover ascoltare Lumo — impostalo sul suo display (tasti MENU / UP / DOWN / ENTER).',
      'dd.l1': 'Cavo DMX (XLR) dall’adattatore alla presa <b>DMX IN</b> della luce, non OUT.',
      'dd.l2': 'Indirizzo iniziale: <b>{code}</b> (a volte appare come <b>{code2}</b>). La luce usa i canali {a}–{e}.',
      'dd.l3': 'Modalità canali: <b>{n}CH</b> (menu „CH”, „Mode” o „Show”).',
      'dd.l4': 'Modalità: <b>DMX</b> — non „Sound”, „Auto”, „Slave” o „Master”. In queste modalità la luce ignora i comandi.',
      'dd.l5': 'Dopo la modifica clicca „Fai lampeggiare” — la luce deve lampeggiare per 2 s.',
      'dd.ledT': 'Le spie sul cavo', 'dd.led': 'USB = il cavo è alimentato. OUT/IN non si accendono su tutti i cavi in modalità Open DMX. Prova: se anche in QLC+ la spia OUT resta spenta ma la luce funziona, la spia non è un indicatore. Conta solo se la luce lampeggia dopo „Fai lampeggiare”.',
      'dd.snT': 'Cos’è S/N?', 'dd.sn': 'S/N è il numero di serie del cavo (il tuo: {s}). Se in QLC+ vedi „(S/N: )” vuoto, il cavo è occupato da Lumo — non è un errore. Per usare QLC+, clicca in Lumo „Cedi il cavo”.',
      'dd.auto': 'Cavo DMX: {r}', 'dd.autoLink': 'Apri „Cavo e luce”', 'dd.autoFixed': 'Connessione con la luce riparata ({n})',
      'dd.nothing': 'Nessuna luce — aggiungi prima un dispositivo.',
    },
  });

  const DD = { last: null, busy: false, waiters: [] };
  const DOT = { ok: 'ok', fixed: 'ok', warn: 'warn', err: 'err' };

  PH.onDoctor = (m) => {
    DD.last = m; DD.busy = false;
    const w = DD.waiters; DD.waiters = [];
    for (const fn of w) fn(m);
    render();
  };
  PH.doctor = (fix = true) => new Promise((resolve) => {
    DD.waiters.push(resolve);
    if (!DD.busy) { DD.busy = true; render(); send({ type: 'dmx_doctor', fix }); }
    setTimeout(() => { if (DD.waiters.includes(resolve)) { DD.waiters = DD.waiters.filter((x) => x !== resolve); DD.busy = false; render(); resolve(null); } }, 15000);
  });

  const blink = () => send({ type: 'fx_start', id: 'doctor-blink', kind: 'blink', params: { speed: 4 }, targets: 'all', duration: 2 });
  const white = () => {
    for (const f of PH.fixtures().filter((x) => !['smoke', 'laser'].includes(x.type))) {
      send({ type: 'set_many', id: f.id, values: { dimmer: 255, strobe: 0, red: 255, green: 255, blue: 255 } });
    }
  };
  const off = () => { for (const f of PH.fixtures()) send({ type: 'set', id: f.id, param: 'dimmer', value: 0 }); };

  function runFix(fx) {
    if (!fx) return;
    if (fx.type === 'open_setup') { PH.setTab('setup'); if (PH.setupGo) PH.setupGo(fx.pane); return; }
    if (fx.type === 'doctor_light') { white(); setTimeout(() => PH.doctor(false), 600); return; }
    send(fx);
    setTimeout(() => PH.doctor(true), fx.type === 'kill_rival' ? 3500 : 1500);
  }

  function render() {
    const box = $('#st-doctor'); if (!box) return;
    const m = DD.last;
    const head = `<div class="dd-h"><span class="dd-ic">${ic('plug')}</span><div><b>${esc(t('dd.title'))}</b><p>${esc(t('dd.sub'))}</p></div>
      <span class="grow"></span>
      <button class="btn primary" data-dd="run" ${DD.busy ? 'disabled' : ''}>${ic(DD.busy ? 'refresh' : 'sparkle')}<span>${esc(t(DD.busy ? 'dd.running' : m ? 'dd.again' : 'dd.run'))}</span></button></div>`;
    let body = '';
    if (m) {
      const sum = m.result === 'ok' ? 'dd.allOk' : m.result === 'warn' ? 'dd.someWarn' : 'dd.someErr';
      body += `<div class="st-status ${m.result === 'ok' ? 'ok' : 'warn'}">${ic(m.result === 'ok' ? 'check' : 'warn')} <span>${esc(t(sum))}${m.fixed ? ` · ${esc(t('dd.fixedN', { n: m.fixed }))}` : ''}</span></div>`;
      body += `<div class="dd-list">${m.checks.map((c, i) => `<div class="diag-row dd-row ${DOT[c.state]}"><i></i>
        <span class="v">${esc(t(c.key, c.params))}</span>
        ${c.fix && c.state !== 'ok' && c.state !== 'fixed' ? `<button class="btn" data-fix="${i}">${ic('refresh')}<span>${esc(t(c.fix.type === 'doctor_light' ? 'dd.white' : 'dd.fix'))}</span></button>` : '<span></span>'}</div>`).join('')}</div>`;
      body += `<div class="dd-test"><button class="btn primary" data-dd="blink">${ic('sun')}<span>${esc(t('dd.blink'))}</span></button>
        <button class="btn" data-dd="white">${ic('lamp')}<span>${esc(t('dd.white'))}</span></button>
        <button class="btn" data-dd="off">${ic('moon')}<span>${esc(t('dd.off'))}</span></button></div>`;
      const lamps = m.lamps || [];
      body += `<div class="dd-cols"><section class="dd-card"><h4>${ic('lamp')} ${esc(t('dd.lampT'))}</h4><p class="muted">${esc(t('dd.lampS'))}</p>
        ${lamps.length ? lamps.map((l) => `<div class="dd-lamp"><b>${esc(l.name)}</b>${l.model && l.model !== l.name ? `<small>${esc(l.model)}</small>` : ''}<ol>
          <li>${t('dd.l1')}</li><li>${t('dd.l2', { code: l.code, code2: l.code2, a: l.address, e: l.end })}</li>
          <li>${t('dd.l3', { n: l.channels })}</li><li>${t('dd.l4')}</li><li>${t('dd.l5')}</li></ol></div>`).join('') : `<p>${esc(t('dd.nothing'))}</p>`}
        </section>
        <section class="dd-card"><h4>${ic('usb')} ${esc(t('dd.ledT'))}</h4><p>${esc(t('dd.led'))}</p>
          <h4>${ic('help')} ${esc(t('dd.snT'))}</h4><p>${esc(t('dd.sn', { s: serial(m) }))}</p></section></div>`;
    }
    box.innerHTML = `<section class="dd">${head}${body}</section>`;
    $('[data-dd="run"]', box).onclick = () => PH.doctor(true);
    const b = $('[data-dd="blink"]', box); if (b) b.onclick = blink;
    const w = $('[data-dd="white"]', box); if (w) w.onclick = white;
    const o = $('[data-dd="off"]', box); if (o) o.onclick = off;
    for (const el of $$('[data-fix]', box)) el.onclick = () => runFix(m.checks[Number(el.dataset.fix)].fix);
  }
  const serial = (m) => { const c = m.checks.find((x) => x.id === 'cable'); return (c && c.params.serial) || '—'; };

  /* ---- runs by itself: once after start, and when the DMX link drops */
  let downSince = 0, lastAuto = 0, first = true;
  PH.onState.push((st) => {
    if (!st.dmx) return;
    if (DD.lang !== PH.lang) { DD.lang = PH.lang; render(); }
    const now = Date.now();
    if (first && S.connected) {
      first = false;
      setTimeout(() => PH.doctor(true).then((m) => report(m, false)), 3500);
    }
    const phys = st.dmx.config && st.dmx.config.backend !== 'sim';
    const down = phys && !st.dmx.ok && !st.dmx.released && st.dmx.state !== 'connecting';
    downSince = down ? (downSince || now) : 0;
    if (down && now - downSince > 6000 && now - lastAuto > 30000) {
      lastAuto = now;
      PH.doctor(true).then((m) => report(m, true));
    }
  });
  function report(m, loud) {
    if (!m) return;
    if (m.fixed) PH.toast(t('dd.autoFixed', { n: m.fixed }), 'ok');
    if (m.result === 'err' || (loud && m.result !== 'ok')) {
      const bad = m.checks.find((c) => c.state === 'err') || m.checks.find((c) => c.state === 'warn');
      if (bad) PH.toast(t('dd.auto', { r: t(bad.key, bad.params) }), 'warn');
    }
  }

  // Settings → DMX: render when the pane is shown
  const mo = new MutationObserver(() => { const box = $('#st-doctor'); if (box && box.offsetParent && !box.firstChild) render(); });
  const pane = $('[data-step="dmx"]');
  if (pane) mo.observe(pane, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  render();
})();
