/* Lumo — icon set (single-stroke, 24 px grid) and hand-pose drawings for the gesture list.
 * ic('name')  → inline <svg>;   pose('point') → small SVG of the hand pose (fingers extended / folded).
 */
'use strict';
const ICON_PATHS = {
  scene: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3ZM3 7.5 12 12l9-4.5M12 12v9',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v7.5c0 4.1-2.9 7.5-6.6 7.5-2.3 0-3.9-1-5.3-3L3.9 14a1.6 1.6 0 0 1 2.4-2L8 13.6',
  mixer: 'M6 3v18M12 3v18M18 3v18M3.5 13h5v3h-5zM9.5 7h5v3h-5zM15.5 15h5v3h-5z',
  camera: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5zM15 10.5l6-3.5v10l-6-3.5',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  setup: 'M4 6h10M4 12h6M4 18h10M19.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM15.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM19.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  spot: 'M9 3h6l-1 5h-4zM10 8l-5 12M14 8l5 12M5 20h14',
  auto: 'M4 16c2-6 4-9 6-9s3 10 5 10 3-5 5-7M4 20h16',
  check: 'm5 12.5 4.5 4.5L19 7',
  warn: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5v.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5v.5',
  play: 'M7 5v14l12-7z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M6 6h12v12H6z',
  save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  wave: 'M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3-3 5-1',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  flame: 'M12 22c4 0 7-2.7 7-6.8 0-4.2-3.6-6.4-4.4-10.2-2.1 1.8-2.6 4-2.6 5.5C10.5 9 9.7 7.6 9.7 6 7.1 8 5 11.2 5 15.2 5 19.3 8 22 12 22Z',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  magnet: 'M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3zM6 7h4M14 7h4',
  drum: 'M4 8c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8M2 3l7 6M22 3l-7 6',
  rec: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
  lamp: 'M8 3h8v4H8zM7 7h10l-1.5 6h-7zM10 13l-3 8M14 13l3 8',
  smoke: 'M7 18a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.7-1A4.5 4.5 0 0 1 17 18zM6 21h12',
  person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 20a7 7 0 0 1 14 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 13.5a7 7 0 0 1 4 6.5',
  keys: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M17 14H7',
  midi: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM7.5 12h.01M16.5 12h.01M9 8h.01M15 8h.01M12 7h.01M9.5 17h5',
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1.2-1.6-1.2-2.8 0-.9.8-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3ZM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  dark: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
  blackout: 'M4 4h16v16H4z',
  next: 'M5 5l9 7-9 7zM18 5v14',
  drop: 'M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z',
  gobo: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8v8M8 12h8M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6',
  diamond: 'M12 3l9 9-9 9-9-9z',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  arrows: 'M7 7l-4 5 4 5M17 7l4 5-4 5M3 12h18',
  twohands: 'M5 13V7a1.3 1.3 0 0 1 2.6 0v5M7.6 7V5.3a1.3 1.3 0 0 1 2.6 0V12M19 13V7a1.3 1.3 0 0 0-2.6 0v5M16.4 7V5.3a1.3 1.3 0 0 0-2.6 0V12M5 13c0 4 1.8 7 4.5 7M19 13c0 4-1.8 7-4.5 7',
  cursor: 'M5 3l14 7-6 2-2 6z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 6 6 6-6 6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  crosshair: 'M12 2v5M12 17v5M2 12h5M17 12h5M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  laser: 'M3 20 21 4M3 20l6-1M3 20l1-6M14 4h6v6',
  par: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bar: 'M3 9h18v6H3zM6.5 12h.01M10 12h.01M14 12h.01M17.5 12h.01',
  derby: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 4v4M12 16v4M4 12h4M16 12h4',
  gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-6',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.7v.4M12 16.8v.2',
  layers: 'M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5l10 5 10-5',
  channels: 'M4 20V10M9 20V4M14 20v-7M19 20V8M2 20h20',
  usb: 'M12 2v14M9 5l3-3 3 3M12 12l-4-2V8M12 14l4-2V9M10 20a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
};
function ic(name, cls = '') {
  const d = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}

/* ---- hand poses: palm + fingers (extended = long, folded = short hook), thumb out / in / pinch */
const POSES = {
  point: { f: [1, 0, 0, 0], th: 'in' }, dimmer: { f: [1, 1, 1, 1], th: 'out' }, crossfade: { f: [1, 1, 1, 1], th: 'in', narrow: true },
  strobe: { f: [0, 0, 0, 0], th: 'in' }, color: { f: [2, 1, 1, 1], th: 'pinch' }, spin: { f: [1, 1, 0, 0], th: 'in', spread: 1.6 },
  full: { f: [0, 0, 0, 0], th: 'up' },
};
function poseSVG(name) {
  const two = { master: ['dimmer', 'dimmer'], strobe_all: ['strobe', 'strobe'], color_all: ['color', 'color'], aim_two: ['point', 'point'] }[name];
  if (two) return `<svg class="pose two" viewBox="0 0 48 30"><g transform="translate(0 0) scale(1)">${poseBody(POSES[two[0]], true)}</g><g transform="translate(48 0) scale(-1 1)">${poseBody(POSES[two[1]], true)}</g></svg>`;
  const p = POSES[name];
  return p ? `<svg class="pose" viewBox="0 0 24 30">${poseBody(p)}</svg>` : '';
}
function poseBody(p, small = false) {
  const s = small ? 0.78 : 1, ox = small ? 1 : 0;
  const X = (x) => (ox + x * s).toFixed(1), Y = (y) => (2 + y * s).toFixed(1), R = (r) => (r * s).toFixed(2);
  const narrow = p.narrow ? 0.55 : 1;
  const base = [[9.2, 14.2], [11.6, 13.6], [14, 13.8], [16.2, 14.6]].map(([x, y]) => [12.7 + (x - 12.7) * narrow, y]);
  const len = [9.5, 10.5, 9.8, 8], spread = p.spread || (p.narrow ? 0.2 : 1);
  let d = `M${X(7.4)} ${Y(15.5)}L${X(7.4)} ${Y(23.5)}Q${X(7.6)} ${Y(27)} ${X(11)} ${Y(27)}L${X(14.6)} ${Y(27)}Q${X(17.6)} ${Y(27)} ${X(17.6)} ${Y(23.5)}L${X(17.6)} ${Y(15.5)}`;
  base.forEach(([bx, by], i) => {
    const ang = (i - 1.5) * 0.1 * spread;
    if (p.f[i] === 1) {                              // extended finger: long line
      d += `M${X(bx)} ${Y(by)}L${X(bx + Math.sin(ang) * len[i])} ${Y(by - Math.cos(ang) * len[i])}`;
    } else if (p.f[i] === 2) {                       // index curled into the OK ring
      d += `M${X(bx)} ${Y(by)}Q${X(bx - 0.6)} ${Y(by - 6)} ${X(bx - 3.4)} ${Y(by - 5)}`;
    } else {                                         // folded finger: a knuckle on top of the fist
      d += `M${X(bx - 1.15)} ${Y(by + 0.4)}A${R(1.2)} ${R(1.25)} 0 0 1 ${X(bx + 1.15)} ${Y(by + 0.4)}`;
    }
  });
  if (p.th === 'out') d += `M${X(7.4)} ${Y(20)}L${X(3)} ${Y(14.5)}`;
  else if (p.th === 'up') d += `M${X(7.4)} ${Y(17)}L${X(7)} ${Y(5.5)}`;
  else if (p.th === 'pinch') d += `M${X(7.4)} ${Y(19)}Q${X(3.6)} ${Y(13)} ${X(5.8)} ${Y(9.2)}`;
  else d += `M${X(7.4)} ${Y(20.5)}L${X(11.4)} ${Y(18.6)}`;
  return `<path d="${d}"/>`;
}
