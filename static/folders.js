/* Lumo — foldery.
 *
 * Big pages (Muzyka, Mikser) are split into folders: a list on the left, one folder open on the
 * right, the last open folder is remembered. Also applies the interface preferences from
 * Ustawienia → Wygląd i start (start tab), which have to run once everything is loaded.
 */
(() => {
  const PH = window.PH;
  const { t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; };

  PH.addI18n({
    pl: {
      'f.music.auto': 'Autopilot i styl', 'f.music.auto.s': 'światła same grają do muzyki',
      'f.music.auto.d': 'Włącz autopilota, wybierz styl i kolory — lampy same dopasują ruch, kolor i jasność do muzyki.',
      'f.music.live': 'Muzyka na żywo', 'f.music.live.s': 'dźwięk z miksera, bity',
      'f.music.live.d': 'Wejście audio z miksera: program słyszy bity, liczy tempo i reaguje światłem na każdy bit.',
      'f.music.fx': 'Efekty', 'f.music.fx.s': 'kliknij, żeby zagrały',
      'f.music.fx.d': 'Wszystkie efekty w jednym miejscu. Kliknij, żeby włączyć albo wyłączyć; pod spodem wybierasz lampy, tempo i zasięg.',
      'f.music.timeline': 'Oś czasu', 'f.music.timeline.s': 'pokaz ułożony do utworu',
      'f.music.timeline.d': 'Wczytaj utwór, ułóż klatki efektów w rytm i zapisz pokaz.',
      'f.music.shows': 'Zapisane pokazy', 'f.music.shows.s': 'otwórz albo usuń',
      'f.music.shows.d': 'Twoje pokazy razem z utworami. Otwórz, żeby grać albo zmieniać na osi czasu.',
      'f.music.mine': 'Moje efekty', 'f.music.mine.s': 'twoje własne efekty',
      'f.music.mine.d': 'Efekty, które zrobiłeś sam (ruch rysowany, warstwy, kolory). Zagraj, zmień albo usuń.',
      'f.music.adv': 'Zaawansowane', 'f.music.adv.s': 'tempo, synchronizacja, bit',
      'f.music.adv.d': 'Dokładne ustawienia muzyki: przesunięcie światła względem dźwięku, tempo, czułość bitu i przyciąganie klatek.',
      'f.mixer.desk': 'Zaawansowane / RAW DMX', 'f.mixer.desk.s': 'suwak na każdy kanał 0–255',
      'f.mixer.simple': 'Proste', 'f.mixer.simple.s': 'najważniejsze kontrolki lampy', 'f.mixer.simple.d': '',
      'f.mixer.desk.d': '',
      'f.mixer.looks': 'Sceny świateł', 'f.mixer.looks.s': 'zapisz i przywróć wygląd',
      'f.mixer.looks.d': 'Ustaw lampy tak, jak chcesz, i zapisz jako scenę. Kliknięcie sceny przywraca ją z płynnym przejściem.',
      'f.mixer.color': 'Kolor i pozycja', 'f.mixer.color.s': 'koło barw, ruch, gobo',
      'f.mixer.color.d': 'Kolor, kierunek i gobo wybranej lampy: kliknij albo przeciągnij.',
    },
    it: {
      'f.music.auto': 'Autopilota e stile', 'f.music.auto.s': 'le luci suonano da sole',
      'f.music.auto.d': 'Accendi l’autopilota, scegli stile e colori — le luci adattano da sole movimento, colore e luminosità alla musica.',
      'f.music.live': 'Musica dal vivo', 'f.music.live.s': 'suono dal mixer, beat',
      'f.music.live.d': 'Ingresso audio dal mixer: il programma sente i beat, calcola il tempo e reagisce con la luce a ogni beat.',
      'f.music.fx': 'Effetti', 'f.music.fx.s': 'clicca per farli partire',
      'f.music.fx.d': 'Tutti gli effetti in un posto. Clicca per accendere o spegnere; sotto scegli luci, tempo e ampiezza.',
      'f.music.timeline': 'Timeline', 'f.music.timeline.s': 'show sul brano',
      'f.music.timeline.d': 'Carica un brano, metti i keyframe degli effetti a ritmo e salva lo show.',
      'f.music.shows': 'Show salvati', 'f.music.shows.s': 'apri o elimina',
      'f.music.shows.d': 'I tuoi show con i brani. Apri per suonarli o modificarli nella timeline.',
      'f.music.mine': 'I miei effetti', 'f.music.mine.s': 'i tuoi effetti',
      'f.music.mine.d': 'Gli effetti creati da te (movimento disegnato, livelli, colori). Suona, modifica o elimina.',
      'f.music.adv': 'Avanzate', 'f.music.adv.s': 'tempo, sincronizzazione, beat',
      'f.music.adv.d': 'Impostazioni precise della musica: ritardo luce/suono, tempo, sensibilità del beat e aggancio dei keyframe.',
      'f.mixer.desk': 'Avanzato / RAW DMX', 'f.mixer.desk.s': 'un fader per canale 0–255',
      'f.mixer.simple': 'Semplice', 'f.mixer.simple.s': 'i comandi principali della luce', 'f.mixer.simple.d': '',
      'f.mixer.desk.d': '',
      'f.mixer.looks': 'Scene luci', 'f.mixer.looks.s': 'salva e richiama',
      'f.mixer.looks.d': 'Imposta le luci come vuoi e salvale come scena. Un clic sulla scena la richiama con una transizione morbida.',
      'f.mixer.color': 'Colore e posizione', 'f.mixer.color.s': 'ruota colori, movimento, gobo',
      'f.mixer.color.d': 'Colore, direzione e gobo della luce scelta: clicca o trascina.',
    },
  });

  const DEF = {
    music: [['auto', 'auto'], ['live', 'wave'], ['fx', 'sparkle'], ['timeline', 'film'], ['shows', 'save'], ['mine', 'layers'], ['adv', 'setup']],
    mixer: [['simple', 'sun'], ['desk', 'mixer'], ['looks', 'sparkle'], ['color', 'palette']],
  };
  const FO = {};
  // simple mode: the same things are not offered twice (colour & position = Mikser → Proste, own effects / advanced = rarely used)
  const SIMPLE_HIDE = { mixer: ['color'], music: ['mine', 'adv'] };
  const list = (page) => DEF[page].filter(([id]) => !(PH.simple && (SIMPLE_HIDE[page] || []).includes(id)));
  function render(page) {
    const nav = $(`#fold-${page}`); if (!nav) return;
    nav.innerHTML = list(page).map(([id, icon]) => `<button class="step-item${FO[page] === id ? ' on' : ''}" data-f="${id}">
        <span class="num">${ic(icon)}</span><span><b>${esc(t(`f.${page}.${id}`))}</b><small>${esc(t(`f.${page}.${id}.s`))}</small></span></button>`).join('');
    for (const b of $$('[data-f]', nav)) b.onclick = () => go(page, b.dataset.f);
  }
  function go(page, id) {
    if (!DEF[page] || !list(page).some(([x]) => x === id)) id = list(page)[0][0];
    FO[page] = id; ls(`ph_fold_${page}`, id);
    const root = $(`.tab-page[data-page="${page}"]`); if (!root) return;
    for (const p of $$('.fold-pane', root)) p.classList.toggle('on', p.dataset.f === id);
    for (const b of $$(`#fold-${page} [data-f]`)) b.classList.toggle('on', b.dataset.f === id);
    const main = $('.fold-main', root); if (main) main.scrollTop = 0;
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));    // canvases re-fit to the new size
    for (const fn of PH.onFold) { try { fn(page, id); } catch (e) { console.error(e); } }
  }
  PH.onFold = PH.onFold || [];
  PH.foldGo = go;
  PH.foldOf = (page) => FO[page];
  PH.foldRender = () => { for (const page of Object.keys(DEF)) { render(page); go(page, FO[page]); } };
  for (const page of Object.keys(DEF)) { FO[page] = ls(`ph_fold_${page}`) || DEF[page][0][0]; render(page); }
  // first show after the other modules had a chance to hook PH.onFold
  setTimeout(() => { for (const page of Object.keys(DEF)) go(page, FO[page]); }, 0);
  let lang = PH.lang;
  PH.onState.push(() => { if (PH.lang !== lang) { lang = PH.lang; for (const p of Object.keys(DEF)) render(p); } });

  // camera picture under the hand skeleton (Ustawienia → Wygląd i start)
  if (ls('ph_showcam') === '1') { const c = $('#show-cam'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } }
  // start tab (Ustawienia → Wygląd i start): a fixed tab or the one used last time
  const start = ls('ph_start_tab') || 'last';
  const tab = start === 'last' ? ls('ph_tab') : start;
  if (tab && tab !== 'scene' && $(`#tabs button[data-tab="${tab}"]`)) setTimeout(() => PH.setTab(tab), 50);
})();
