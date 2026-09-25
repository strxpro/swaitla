const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function input() {
  const text = fs.readFileSync(path.join(__dirname, '../static/music.js'), 'utf8');
  const messages = [];
  const context = vm.createContext({
    Float32Array, Uint8Array, AudioContext: null,
    send: (m) => messages.push(m),
    $: () => ({ value: 1.35 }),
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
  });
  vm.runInContext(text.slice(text.indexOf('const MU ='), text.indexOf('function muDraw()')) + '\nglobalThis.live = MU;', context);
  const mu = context.live;
  mu.running = true;
  mu.ctx = { sampleRate: 48000 };
  mu.buf = new Uint8Array(512);
  mu.wave = new Float32Array(1024);
  let loudness = 0;
  mu.an = {
    fftSize: 1024,
    getByteFrequencyData: (buf) => buf.fill(loudness ? 230 : 0),
    getFloatTimeDomainData: (wave) => wave.fill(loudness),
  };
  return { mu, messages, tick(t, level) { loudness = level; context.muTick(t); } };
}

test('silence sends continuous zero levels without inventing beats', () => {
  const { messages, tick } = input();
  for (let t = 10; t <= 2000; t += 10) tick(t, 0);
  assert.equal(messages.filter((m) => m.type === 'beat').length, 0);
  const levels = messages.filter((m) => m.type === 'audio_level');
  assert.equal(levels.length, 20);
  assert.ok(levels.every((m) => m.level === 0));
});

test('regular kicks lock onto 120 BPM and silence clears stale tempo', () => {
  const { mu, messages, tick } = input();
  for (let t = 10; t <= 12000; t += 10) tick(t, t % 500 < 40 ? 0.2 : 0);
  assert.ok(Math.abs(mu.bpm - 120) < 2, String(mu.bpm));
  assert.ok(messages.some((m) => m.type === 'beat' && m.source === 'live'));
  for (let t = 12010; t <= 15000; t += 10) tick(t, 0);
  assert.equal(mu.bpm, null);
  assert.equal(mu.confidence, 0);
});

test('quieter passages report less energy than loud passages', () => {
  const { messages, tick } = input();
  tick(100, 0.4);
  tick(200, 0.04);
  const levels = messages.filter((m) => m.type === 'audio_level');
  assert.ok(levels[0].level > levels[1].level * 5);
});
