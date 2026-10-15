// Beat tracker (static/beatcore.js): silence, tempo, phase prediction, drops, levels and the PCM for the AI.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { BeatCore } = require(path.join(__dirname, '../static/beatcore.js'));

const SR = 44100;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; }

// parts: [[seconds, {kick, hat, clap}]] - a kick on every beat, hats on the off-beat, claps on 2 and 4
function track(bpm, parts, gain = 0.8) {
  const total = parts.reduce((a, [s]) => a + s, 0);
  const x = new Float32Array(Math.round(total * SR));
  const beat = 60 / bpm, rnd = rng(7);
  let t0 = 0;
  for (const [secs, p] of parts) {
    for (let b = Math.ceil(t0 / beat - 1e-9); b * beat < t0 + secs - 1e-9; b++) {
      const at = Math.round(b * beat * SR);
      if (p.kick) for (let i = 0; i < 0.25 * SR && at + i < x.length; i++) {
        const tt = i / SR, f = 50 + 110 * Math.exp(-tt * 25);
        x[at + i] += gain * Math.sin(2 * Math.PI * (50 * tt + 110 * (1 - Math.exp(-tt * 25)) / 25)) * Math.exp(-tt * 7) * (f > 0 ? 1 : 0);
      }
      if (p.hat) { const h = Math.round((b + 0.5) * beat * SR); for (let i = 0; i < 1800 && h + i < x.length; i++) x[h + i] += gain * 0.2 * rnd() * Math.exp(-i / SR * 60); }
      if (p.clap && b % 2 === 1) for (let i = 0; i < 6000 && at + i < x.length; i++) x[at + i] += gain * 0.3 * rnd() * Math.exp(-i / SR * 25);
    }
    t0 += secs;
  }
  return x;
}
function run(x) {
  const ev = [];
  const core = new BeatCore(SR, (e) => ev.push({ t: core.frame / core.fps, ...e }));
  for (let i = 0; i < x.length; i += 2048) core.process(x.subarray(i, Math.min(x.length, i + 2048)));
  return ev;
}

test('silence sends levels but no beats, no grid, no onsets', () => {
  const ev = run(new Float32Array(SR * 5));
  assert.equal(ev.filter((e) => ['beat', 'grid', 'onset'].includes(e.type)).length, 0);
  const lv = ev.filter((e) => e.type === 'level');
  assert.ok(lv.length > 80);
  assert.ok(lv.every((e) => e.abs < 0.001));
});

test('locks onto 120 BPM and predicts the next beat within a few milliseconds', () => {
  const ev = run(track(120, [[20, { kick: true, hat: true, clap: true }]]));
  const grids = ev.filter((e) => e.type === 'grid' && e.t > 8);
  assert.ok(grids.length > 20);
  for (const g of grids) assert.ok(Math.abs(g.bpm - 120) < 1.5, String(g.bpm));
  // predicted beat time (t + nextIn) lands on the real grid (every 0.5 s); the onset detector adds ~10-20 ms
  const errs = grids.map((g) => { const tb = g.t + g.nextIn; return (tb - Math.round(tb / 0.5) * 0.5) * 1000; });
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
  assert.ok(Math.abs(mean) < 25, `mean ${mean}`);
  assert.ok(errs.every((e) => Math.abs(e - mean) < 12), JSON.stringify(errs.map(Math.round)));
});

test('a drop is called on its first kick after a part without bass', () => {
  const ev = run(track(128, [[12, { kick: true, hat: true, clap: true }], [7.5, { hat: true, clap: true }], [8, { kick: true, hat: true, clap: true }]]));
  const drops = ev.filter((e) => e.type === 'section' && e.changed && e.name === 'drop');
  const second = drops.find((e) => e.t > 15);
  assert.ok(second, JSON.stringify(ev.filter((e) => e.type === 'section' && e.changed).map((e) => [e.t.toFixed(2), e.name])));
  const kick = Math.ceil(19.5 / (60 / 128)) * (60 / 128);                        // first kick of the drop: 19.69 s
  assert.ok(second.t >= kick && second.t < kick + 0.06, `${second.t} vs ${kick}`);
});

test('beats stop in silence (the server clock free-runs), the grid lets go after 4 s', () => {
  const ev = run(track(124, [[12, { kick: true, hat: true }], [6, {}]]));
  const beats = ev.filter((e) => e.type === 'beat');
  assert.ok(beats.some((b) => b.t > 11 && b.t < 12.1));
  assert.ok(!beats.some((b) => b.t > 12.8), 'no invented beats in the silence');
  const off = ev.find((e) => e.type === 'grid_off');
  assert.ok(off && off.t > 15.5 && off.t < 16.5, String(off && off.t));
});

test('louder music reads louder, and the AI gets 16 kHz PCM', () => {
  const loud = run(track(120, [[4, { kick: true, hat: true }]], 0.9));
  const quiet = run(track(120, [[4, { kick: true, hat: true }]], 0.05));
  const absMax = (ev) => Math.max(...ev.filter((e) => e.type === 'level').map((e) => e.abs));
  assert.ok(absMax(loud) > absMax(quiet) * 8);
  const pcm = loud.filter((e) => e.type === 'pcm');
  const n = pcm.reduce((a, e) => a + e.data.length, 0);
  assert.ok(Math.abs(n - 4 * 16000) <= 8000, String(n));                         // whole 0.5 s chunks
  assert.ok(pcm.every((e) => e.data instanceof Int16Array));
});
