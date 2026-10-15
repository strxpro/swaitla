/* Lumo — the simple face of the app (simple mode, on by default).
 *
 * Top bar: five plain tabs (Pokaz, Światła, Scena, Dłoń, Ustawienia), the rest under "Więcej";
 * one status in words instead of four icons ("Wszystko działa" / "Kabel DMX niepodłączony" …),
 * a click on it goes straight to the fix.  The fader rail only on the stage and the hand view.
 * Advanced mode (Ustawienia → Start → "Tryb prosty" off) shows everything as before.
 */
'use strict';
(() => {
  const PH = window.PH;
  const { S, t, esc } = PH;
  const $ = (s, r = document) => r.querySelector(s);

  PH.addI18n({
    pl: {
      'tab.mixer': 'Światła', 'tab.more': 'Więcej', 'more.music': 'Efekty i oś czasu', 'more.musicS': 'ręczne efekty, pokaz do utworu z pliku',
      'more.stagecam': 'Kamera sceny', 'more.stagecamS': 'druga kamera: kto gdzie stoi', 'more.all': 'Pokaż wszystkie zakładki', 'more.allS': 'tryb zaawansowany',
      'ss.ok': 'Wszystko działa', 'ss.sim': 'Bez kabla — podgląd', 'ss.cable': 'Kabel DMX niepodłączony', 'ss.lamps': 'Dodaj lampy',
      'ss.cam': 'Kamera nie działa', 'ss.bo': 'Blackout — światła zgaszone', 'ss.show': 'Pokaz · {b} BPM',
      'ss.okT': 'Kabel, lampy i program działają', 'ss.fixT': 'Kliknij, żeby to naprawić',
      'dock.master': 'Jasność',
    },
    it: {
      'tab.mixer': 'Luci', 'tab.more': 'Altro', 'more.music': 'Effetti e timeline', 'more.musicS': 'effetti manuali, show su un brano da file',
      'more.stagecam': 'Camera palco', 'more.stagecamS': 'seconda camera: chi è dove', 'more.all': 'Mostra tutte le schede', 'more.allS': 'modalità avanzata',
      'ss.ok': 'Tutto funziona', 'ss.sim': 'Senza cavo — anteprima', 'ss.cable': 'Cavo DMX non collegato', 'ss.lamps': 'Aggiungi luci',
      'ss.cam': 'La camera non funziona', 'ss.bo': 'Blackout — luci spente', 'ss.show': 'Show · {b} BPM',
      'ss.okT': 'Cavo, luci e programma funzionano', 'ss.fixT': 'Clicca per sistemarlo',
      'dock.master': 'Luminosità',
    },
  });

  /* ---------------------------------------------------------------- "Więcej" (tabs the simple mode hides) */
  const tabs = $('#tabs');
  const more = document.createElement('div');
  more.className = 'tab-more';
  more.innerHTML = `<button class="tab-more-b" id="tab-more" aria-haspopup="menu">${ic('plus')}<span></span></button><div class="tab-menu" id="tab-menu" role="menu" hidden></div>`;
  tabs.appendChild(more);
  const menu = $('#tab-menu');
  function fillMenu() {
    PH.setText($('#tab-more span'), t('tab.more'));
    const item = (go, icon, key) => `<button role="menuitem" data-go="${go}">${ic(icon)}<span><b>${esc(t(key))}</b><small>${esc(t(key + 'S'))}</small></span></button>`;
    menu.innerHTML = item('music', 'music', 'more.music') + item('stagecam', 'camera', 'more.stagecam') + '<hr>' + item('all', 'layers', 'more.all');
    for (const b of menu.querySelectorAll('[data-go]')) b.onclick = () => {
      menu.hidden = true;
      if (b.dataset.go === 'all') { PH.setSimple(false); return; }
      PH.setTab(b.dataset.go);
    };
  }
  $('#tab-more').onclick = (e) => { e.stopPropagation(); fillMenu(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', (e) => { if (!menu.hidden && !more.contains(e.target)) menu.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });

  /* ---------------------------------------------------------------- one status in words */
  const pill = document.createElement('button');
  pill.className = 'status-pill';
  pill.id = 'status-pill';
  pill.innerHTML = '<i></i><span></span>';
  const chain = $('#chain');
  chain.parentNode.insertBefore(pill, chain);
  let fix = null;
  pill.onclick = () => {
    if (fix === 'blackout') PH.send({ type: 'blackout', value: false });
    else if (fix) { PH.setTab('setup'); if (PH.setupGo) PH.setupGo(fix); }
  };
  function status(st) {
    const d = st.dmx, lights = st.fixtures.filter((f) => f.type !== 'smoke');
    const clk = (st.effects && st.effects.clock) || {}, ap = (st.effects && st.effects.autopilot) || {};
    if (st.blackout) return ['warn', t('ss.bo'), 'blackout'];
    if (!lights.length) return ['warn', t('ss.lamps'), 'lamps'];
    if (d.config.backend !== 'sim' && d.state !== 'online' && !d.released) return ['warn', t('ss.cable'), 'dmx'];
    if (S.tab === 'hand' && st.video.state !== 'online') return ['warn', t('ss.cam'), 'camera'];
    if (ap.on && ap.mood === 'ai' && clk.locked) return ['live', t('ss.show', { b: Math.round(clk.bpm) }), null];
    if (d.config.backend === 'sim') return ['info', t('ss.sim'), 'dmx'];
    return ['ok', t('ss.ok'), null];
  }
  PH.onState.push((st) => {
    const [cls, text, go] = status(st);
    fix = go;
    const c = `status-pill ${cls}`;
    if (pill.className !== c) pill.className = c;
    PH.setText($('span', pill), text);
    pill.title = t(go ? 'ss.fixT' : 'ss.okT');
    const m = $('.dock .master span'); if (m) PH.setText(m, t('dock.master'));
  });
  PH.setText($('#tabs [data-tab="mixer"] span'), t('tab.mixer'));
  fillMenu();
})();
