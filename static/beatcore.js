/* Lumo — beat tracker core.  Runs inside the AudioWorklet (beatworklet.js) on the audio
 * thread, so it never stalls when the window is in the background; the tests load it in Node.
 *
 * Pipeline (all at 100 frames per second, 10 ms hops):
 *   3 band filters (kick < 150 Hz, body 300–3000 Hz, hats > 5 kHz) → band energies
 *   → onset strength (rise of the log energy, every band) → 8 s history
 *   tempo:  autocorrelation of the onset strength × a 120 BPM prior, with the double
 *           period added (Ellis 2007), parabolic peak, held steady unless a new tempo lasts
 *   phase:  comb of the last 8 beats over the onsets → where the beats sit; a soft
 *           phase-locked loop moves the predicted next beat, never jumps on one odd hit
 *   bar:    the beat with the strongest kick and the weakest snare is "one"
 *   parts:  per beat the bass, highs, loudness and onset density → intro / verse / chorus /
 *           build / drop / breakdown / quiet
 *   AI:     16 kHz mono PCM every half second for the music model on the server
 *
 * Events (callback): grid, beat, onset, level, section, silence, pcm.
 */
(() => {                     // own scope: loaded as a page script too (fallback), next to app.js
'use strict';

function biquad(type, f0, q, sr) {
  const w0 = 2 * Math.PI * f0 / sr, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * q);
  let b0, b1, b2;
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
  else if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }                                  // band-pass, 0 dB peak
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, z1: 0, z2: 0 };
}
function run(f, x) {                                                   // transposed direct form II
  const y = f.b0 * x + f.z1;
  f.z1 = f.b1 * x - f.a1 * y + f.z2;
  f.z2 = f.b2 * x - f.a2 * y;
  return y;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Ring {
  constructor(n) { this.a = new Float32Array(n); this.n = n; this.i = 0; this.count = 0; }
  push(v) { this.a[this.i] = v; this.i = (this.i + 1) % this.n; this.count++; }
  ago(k) { return k < 0 || k >= this.n || k >= this.count ? 0 : this.a[(this.i - 1 - k + 2 * this.n) % this.n]; }
  agoF(k) {                                                             // fractional, linear interpolation
    const k0 = Math.floor(k), f = k - k0;
    return this.ago(k0) * (1 - f) + this.ago(k0 + 1) * f;
  }
}

const SECTION_MIN = { intro: 8, verse: 4, chorus: 4, build: 4, drop: 1, breakdown: 4, quiet: 2 };

class BeatCore {
  constructor(sampleRate, emit) {
    this.sr = sampleRate;
    this.emit = emit || (() => {});
    this.hop = Math.round(sampleRate / 100);
    this.fps = sampleRate / this.hop;
    this.lpL = biquad('lowpass', 150, 0.71, sampleRate);
    this.hpM = biquad('highpass', 300, 0.71, sampleRate);
    this.lpM = biquad('lowpass', 3000, 0.71, sampleRate);
    this.hpH = biquad('highpass', 5000, 0.71, sampleRate);
    this.H = Math.round(8 * this.fps);
    this.odf = new Ring(this.H);           // onset strength (all bands)
    this.kick = new Ring(this.H);          // onset strength of the kick band
    this.snare = new Ring(this.H);         // onset strength of the body band
    this.tempoBins = null;
    // AI resampler (one-pole low-pass at 7 kHz + linear interpolation to 16 kHz)
    this.rsStep = sampleRate / 16000;
    this.rsA = 1 - Math.exp(-2 * Math.PI * 7000 / sampleRate);
    this.pcmOn = true;
    this.reset();
  }

  reset() {
    this.acc = [0, 0, 0, 0]; this.accN = 0;
    this.prevLog = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    this.peak = 1e-4;                      // AGC: slowly falling loudness peak
    this.frame = 0;
    this.odf.count = this.kick.count = this.snare.count = 0;
    this.bpm = null; this.period = 0; this.conf = 0; this.cand = null; this.candN = 0;
    this.nextBeat = null; this.beatNo = 0; this.bad = 0; this.lastGrid = -1e9;
    this.bassAt = [0, 0, 0, 0]; this.snareAt = [0, 0, 0, 0]; this.one = 0; this.oneVotes = 0;
    this.kTh = 0; this.kAvg = 0; this.kVar = 0; this.lastOnset = -1e9; this.dropWatch = 0;
    this.silentFrames = 0; this.silent = true;
    this.beatAcc = { low: 0, high: 0, rms: 0, onsets: 0, n: 0 };
    this.sec = { name: '', beats: 0, lows: [], lowRef: 1e-6, rmsRef: 1e-6, high: [], dens: [], rmsS: 0, lowS: 0, prevName: '' };
    this.rsPhase = 0; this.rsY = 0; this.rsPrev = 0; this.pcm = new Int16Array(8000); this.pcmN = 0;
    this.levelMax = { low: 1e-6, mid: 1e-6, high: 1e-6 };
  }

  /* ---------------------------------------------------------------- samples in */
  process(x) {
    for (let i = 0; i < x.length; i++) {
      const s = x[i];
      const l = run(this.lpL, s), m = run(this.lpM, run(this.hpM, s)), h = run(this.hpH, s);
      this.acc[0] += l * l; this.acc[1] += m * m; this.acc[2] += h * h; this.acc[3] += s * s;
      if (++this.accN >= this.hop) this._frame();
      if (this.pcmOn) this._resample(s);
    }
  }

  _resample(s) {
    this.rsY += this.rsA * (s - this.rsY);
    this.rsPhase += 1;
    while (this.rsPhase >= this.rsStep) {
      this.rsPhase -= this.rsStep;
      const f = 1 - this.rsPhase;                      // interpolate between the previous and this sample
      const v = this.rsPrev + (this.rsY - this.rsPrev) * clamp(f, 0, 1);
      this.pcm[this.pcmN++] = clamp(Math.round(v * 32767), -32768, 32767);
      if (this.pcmN === this.pcm.length) {
        this.emit({ type: 'pcm', data: this.pcm });
        this.pcm = new Int16Array(8000); this.pcmN = 0;
      }
    }
    this.rsPrev = this.rsY;
  }

  /* ---------------------------------------------------------------- 10 ms frame */
  _frame() {
    const n = this.accN;
    const eL = this.acc[0] / n, eM = this.acc[1] / n, eH = this.acc[2] / n, eA = this.acc[3] / n;
    this.acc[0] = this.acc[1] = this.acc[2] = this.acc[3] = 0; this.accN = 0;
    this.frame++;
    const rms = Math.sqrt(eA);
    this.peak = Math.max(eA, this.peak * 0.99985, 1e-6);   // ≈ 70 s to fall to 1/e
    const silentNow = rms < 0.0025;
    this.silentFrames = silentNow ? this.silentFrames + 1 : 0;
    // onset strength per band: rise of the log energy against the last 3 frames
    const bands = [eL, eM, eH], on = [0, 0, 0];
    for (let b = 0; b < 3; b++) {
      const c = Math.log1p(200 * bands[b] / this.peak);
      const p = this.prevLog[b], ref = (p[0] + p[1] + p[2]) / 3;
      on[b] = Math.max(0, c - ref);
      p.shift(); p.push(c);
    }
    const o = silentNow ? 0 : on[0] + 0.6 * on[1] + 0.4 * on[2];
    this.odf.push(o); this.kick.push(silentNow ? 0 : on[0]); this.snare.push(silentNow ? 0 : on[1]);
    // per-beat accumulators for the song parts
    const ba = this.beatAcc;
    ba.low += eL; ba.high += eH; ba.rms += eA; ba.n++;
    if (this._kickDetect(on[0], silentNow)) this.dropWatch = 3;       // the hit may only start inside this frame
    if (this.dropWatch > 0) { this.dropWatch--; this._fastDrop(eL); }
    if (this.frame % 5 === 0) this._levels(eL, eM, eH, rms);
    if (this.frame % 50 === 0) this._tempo();
    if (this.bpm && this.frame % 10 === 0) this._phase();
    this._clock();
    if (this.silentFrames === Math.round(1.5 * this.fps)) this.emit({ type: 'silence' });
    if (this.silentFrames === Math.round(4 * this.fps)) {
      this.bpm = null; this.nextBeat = null; this.conf = 0; this.cand = null;
      this.emit({ type: 'grid_off' });
      this._setSection('quiet', 0, true);
    }
    this.silent = this.silentFrames > 0.5 * this.fps;
  }

  _levels(eL, eM, eH, rms) {
    const lm = this.levelMax;
    lm.low = Math.max(eL, lm.low * 0.995); lm.mid = Math.max(eM, lm.mid * 0.995); lm.high = Math.max(eH, lm.high * 0.995);
    this.emit({ type: 'level', rms: clamp(Math.sqrt(rms * rms / this.peak), 0, 1), abs: rms,
      low: clamp(Math.sqrt(eL / lm.low), 0, 1), mid: clamp(Math.sqrt(eM / lm.mid), 0, 1), high: clamp(Math.sqrt(eH / lm.high), 0, 1) });
  }

  _kickDetect(k, silentNow) {
    // adaptive threshold: mean + 2 σ of the kick-band onsets over ~1.5 s
    const a = 1 / 150;
    this.kAvg += (k - this.kAvg) * a;
    this.kVar += ((k - this.kAvg) ** 2 - this.kVar) * a;
    const th = this.kAvg + 2 * Math.sqrt(this.kVar) + 0.05;
    if (!silentNow && k > th && this.frame - this.lastOnset > 0.12 * this.fps) {
      this.lastOnset = this.frame;
      this.beatAcc.onsets++;
      this.emit({ type: 'onset', strength: clamp((k - th) / (th + 0.2) + 0.4, 0, 1) });
      return true;
    }
    return false;
  }

  _fastDrop(eL) {
    // the first kick after a part without bass: call the drop on this very hit, not a beat later
    const s = this.sec;
    if (!['build', 'breakdown', 'quiet', 'intro'].includes(s.name) || s.beats < 4 || s.lows.length < 4) return;
    const before = avg(s.lows.slice(-4));
    if (eL > 6 * before + 1e-7 && eL > 0.5 * s.lowRef) {
      s.lowS = Math.max(s.lowS, s.lowRef * 0.7);
      this.dropWatch = 0;
      this._setSection('drop', 1);
    }
  }

  /* ---------------------------------------------------------------- tempo */
  _acf(lag, N) {
    let s = 0;
    for (let n = 0; n < N - lag; n++) s += this.odf.ago(n) * this.odf.ago(n + lag);
    return s / (N - lag);
  }

  _tempo() {
    const N = Math.min(this.odf.count, Math.round(6 * this.fps));
    if (N < 3 * this.fps || this.silentFrames > this.fps) return;
    const fps = this.fps, lo = Math.floor(fps * 60 / 200), hi = Math.ceil(fps * 60 / 60);
    let mean = 0;
    for (let n = 0; n < N; n++) mean += this.odf.ago(n);
    mean /= N;
    if (mean < 1e-4) return;
    const r = new Float32Array(2 * hi + 3);
    for (let lag = lo; lag <= 2 * hi + 2 && lag < N - fps; lag++) r[lag] = this._acf(lag, N) - mean * mean;
    const tau0 = fps * 60 / 120, score = new Float32Array(hi + 2);
    let best = -1, bestS = -Infinity, sum = 0, cnt = 0;
    for (let lag = lo; lag <= hi; lag++) {
      const w = Math.exp(-0.5 * (Math.log2(lag / tau0) / 1.0) ** 2);
      const s = w * (r[lag] + 0.5 * r[2 * lag] + 0.25 * r[2 * lag - 1] + 0.25 * r[2 * lag + 1]);
      score[lag] = s; sum += s; cnt++;
      if (s > bestS) { bestS = s; best = lag; }
    }
    if (best <= lo || best >= hi || bestS <= 0) return;
    const y0 = score[best - 1], y1 = score[best], y2 = score[best + 1];
    const d = (y0 - 2 * y1 + y2) !== 0 ? 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) : 0;
    const lag = best + clamp(d, -0.5, 0.5);
    let bpm = 60 * fps / lag;
    const conf = clamp((bestS - sum / cnt) / (bestS + 1e-9), 0, 1);
    if (conf < 0.15) { this.conf *= 0.8; return; }
    if (this.bpm) {
      const ratio = bpm / this.bpm;
      // half / double of what we already follow: stay unless it lasts a long time
      for (const k of [2, 0.5, 1.5, 2 / 3]) if (Math.abs(ratio - k) < 0.04 * k) { bpm = this.bpm * Math.round(ratio / k * 1000) / 1000 * k; }
      // a new tempo only while the kick drum plays (snare rolls of a build-up, a pad in a breakdown
      // never move it) and only when it lasts 2.5 s
      const kickOn = this.frame - this.lastOnset < 2 * fps;
      if (Math.abs(bpm / this.bpm - 1) < 0.04) {
        if (kickOn) this.bpm = this.bpm * 0.85 + bpm * 0.15;
        this.cand = null; this.candN = 0;
      } else if (!kickOn) {
        this.cand = null; this.candN = 0;
      } else if (this.cand && Math.abs(bpm / this.cand - 1) < 0.02) {
        if (++this.candN >= (Math.abs(bpm / this.bpm - 2) < 0.1 || Math.abs(bpm / this.bpm - 0.5) < 0.05 ? 8 : 5)) {
          this.bpm = bpm; this.cand = null; this.candN = 0; this.nextBeat = null;
        }
      } else { this.cand = bpm; this.candN = 1; }
    } else {
      if (this.cand && Math.abs(bpm / this.cand - 1) < 0.04) { this.bpm = (bpm + this.cand) / 2; this.cand = null; }
      else this.cand = bpm;
    }
    this.conf = this.conf * 0.6 + conf * 0.4;
    if (this.bpm) {                                         // the phase loop fine-tunes the period around the estimate
      const P0 = 60 * fps / this.bpm;
      if (!this.period || Math.abs(this.period / P0 - 1) > 0.015) this.period = P0;
    }
  }

  /* ---------------------------------------------------------------- phase (comb over the last beats) */
  _phase() {
    const P = this.period;
    if (!P) return;
    const steps = Math.ceil(P * 2), sc = this._comb || (this._comb = new Float32Array(512));
    let bj = 0, sumS = 0;
    for (let j = 0; j < steps; j++) {
      const phi = j / 2;
      let s = 0, w = 1;
      for (let k = 0; k < 8; k++) {
        const ago = phi + k * P;
        if (ago + 1 >= this.odf.count) break;
        s += w * (this.odf.agoF(ago) + 0.5 * this.kick.agoF(ago));
        w *= 0.85;
      }
      sc[j] = s; sumS += s;
      if (s > sc[bj]) bj = j;
    }
    const bestS = sc[bj];
    // no clear pulse (a pad, a breakdown without drums): keep the beat running as it was
    if (bestS <= 0 || bestS < 1.8 * sumS / steps) return;
    const y0 = sc[(bj - 1 + steps) % steps], y2 = sc[(bj + 1) % steps], den = y0 - 2 * bestS + y2;
    const best = (bj + (den < 0 ? clamp(0.5 * (y0 - y2) / den, -0.5, 0.5) : 0)) / 2;   // sub-frame peak
    let nb = this.frame - best + P;                         // next beat after the last one the comb found
    while (nb < this.frame) nb += P;
    if (this.nextBeat === null) { this.nextBeat = nb; this.bad = 0; return; }
    let err = nb - this.nextBeat;
    err -= Math.round(err / P) * P;                          // -P/2 .. P/2
    if (Math.abs(err) < 0.22 * P) {
      this.nextBeat += 0.3 * err;
      const P0 = 60 * this.fps / this.bpm;                   // the tempo follows a lasting drift a little
      this.period = clamp(this.period + 0.02 * err, P0 * 0.985, P0 * 1.015);
      this.bad = 0;
    } else if (this.frame - this.lastOnset < 1.5 * this.fps) {
      // far off for 0.6 s while the kick drum plays: the music moved (or we sat on the off-beat) - follow it.
      // Without a kick (snare rolls of a build-up) the beat is held: rolls must not push it half a beat.
      const same = this.bad && Math.abs(err - this.badErr) < 0.12 * P;
      this.bad = same || !this.bad ? this.bad + 1 : 1;
      this.badErr = err;
      if (this.bad >= 6) { this.nextBeat += err; this.bad = 0; }
    }
  }

  /* ---------------------------------------------------------------- the clock: beats, bar, grid */
  _clock() {
    if (!this.bpm || this.nextBeat === null || this.silent) return;
    const P = this.period;
    if (this.frame >= this.nextBeat) {
      this.nextBeat += P;
      this.beatNo++;
      this._barVote();
      const inBar = ((this.beatNo - this.one) % 4 + 4) % 4;
      this.emit({ type: 'beat', index: this.beatNo, inBar, bpm: 60 * this.fps / P, conf: this.conf });
      this._beatParts(inBar);
      this._grid(true);
    } else if (this.frame - this.lastGrid >= 0.25 * this.fps) this._grid(false);
  }

  _grid() {
    this.lastGrid = this.frame;
    if (this.conf < 0.12) return;
    const inBar = (((this.beatNo + 1) - this.one) % 4 + 4) % 4;
    this.emit({ type: 'grid', bpm: Math.round(6000 * this.fps / this.period) / 100, nextIn: (this.nextBeat - this.frame) / this.fps,
      beatInBar: inBar, conf: Math.round(this.conf * 100) / 100 });
  }

  _barVote() {
    // strongest kick and weakest snare on "one": the beat that just passed (its hits are all in now)
    const P = Math.round(this.period);
    let bass = 0, sn = 0;
    for (let k = P - 5; k <= P + 5; k++) { bass = Math.max(bass, this.kick.ago(k)); sn = Math.max(sn, this.snare.ago(k)); }
    const pos = ((this.beatNo - 1) % 4 + 4) % 4;
    this.bassAt[pos] = this.bassAt[pos] * 0.9 + bass * 0.1;
    this.snareAt[pos] = this.snareAt[pos] * 0.9 + sn * 0.1;
    if (this.beatNo % 4 !== 0) return;
    const sc = [0, 1, 2, 3].map((k) => this.bassAt[k] - 0.6 * this.snareAt[k] + 0.3 * this.snareAt[(k + 1) % 4]);
    let best = this.one;
    for (let k = 0; k < 4; k++) if (sc[k] > sc[best] * 1.15 + 1e-6) best = k;
    if (best !== this.one) { if (++this.oneVotes >= 4) { this.one = best; this.oneVotes = 0; } }
    else this.oneVotes = 0;
  }

  /* ---------------------------------------------------------------- song parts */
  _beatParts(inBar) {
    const ba = this.beatAcc, s = this.sec;
    if (!ba.n) return;
    const low = ba.low / ba.n, high = ba.high / ba.n, rms = Math.sqrt(ba.rms / ba.n), dens = ba.onsets;
    this.beatAcc = { low: 0, high: 0, rms: 0, onsets: 0, n: 0 };
    s.beats++;
    const lowBefore = s.lows.length >= 4 ? avg(s.lows.slice(-5, -1)) : null;
    s.lows.push(low); if (s.lows.length > 8) s.lows.shift();
    s.lowS = s.lowS ? s.lowS * 0.6 + low * 0.4 : low;              // ~2 beats
    s.rmsS = s.rmsS ? s.rmsS * 0.6 + rms * 0.4 : rms;
    s.lowRef = Math.max(s.lowS, s.lowRef * 0.995);                  // loudest bass of the last ~minute
    s.rmsRef = Math.max(s.rmsS, s.rmsRef * 0.995);
    s.high.push(high); if (s.high.length > 8) s.high.shift();
    s.dens.push(dens + this._density()); if (s.dens.length > 8) s.dens.shift();
    const energy = clamp(s.rmsS / s.rmsRef, 0, 1);
    const bass = Math.min(s.lowS, avg(s.lows.slice(-2))) / s.lowRef;   // two beats without bass are enough
    const rising = s.high.length >= 8 && (avg(s.high.slice(4)) > avg(s.high.slice(0, 4)) * 1.25
      || avg(s.dens.slice(4)) > avg(s.dens.slice(0, 4)) + 0.75);
    // the bass comes back hard after a part without it (an intro, a breakdown, a build-up) = the drop
    const slam = lowBefore !== null && low > 4 * lowBefore + 1e-7 && low > 0.5 * s.lowRef;
    let want;
    if (energy < 0.08) want = 'quiet';
    else if (s.name === 'drop' && s.beats < 16) want = 'drop';                // a drop lasts at least 4 bars
    else if (bass < 0.3 && rising) want = 'build';
    else if (bass < 0.3) want = s.name === 'build' && s.beats < 32 ? 'build' : 'breakdown';
    else if (slam && energy > 0.45 && ['build', 'breakdown', 'quiet', 'intro'].includes(s.name)) want = 'drop';
    else if (energy > 0.72 && bass > 0.6) want = 'chorus';
    else if (s.name === 'quiet' || s.name === '' || (s.name === 'intro' && s.beats < 16 && energy < 0.6)) want = 'intro';
    else want = 'verse';
    // parts change on the bar line (a drop at once), never faster than their minimum length
    if (want !== s.name && (want === 'drop' || (inBar === 0 && s.beats >= (SECTION_MIN[s.name] || 0)))) this._setSection(want, energy);
    else if (s.beats % 4 === 0) this.emit({ type: 'section', name: s.name, energy: Math.round(energy * 100) / 100, beats: s.beats });
  }

  _density() {                                                      // onsets in the body band during this beat
    const P = Math.round(this.period) || 50;
    let c = 0, prev = 0;
    for (let k = P; k >= 0; k--) { const v = this.snare.ago(k); if (v > 0.35 && prev <= 0.35) c++; prev = v; }
    return c / 2;
  }

  _setSection(name, energy, force) {
    const s = this.sec;
    if (s.name === name && !force) return;
    s.prevName = s.name; s.name = name; s.beats = 0;
    this.emit({ type: 'section', name, energy: Math.round((energy || 0) * 100) / 100, beats: 0, changed: true });
  }
}
function avg(a) { return a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0; }

if (typeof module !== 'undefined') module.exports = { BeatCore };
else globalThis.BeatCore = BeatCore;
})();
