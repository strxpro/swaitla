/* Lumo — AudioWorklet: the beat tracker runs on the audio thread (never throttled in a background tab).
 * beatcore.js is added to the same worklet scope first (it sets globalThis.BeatCore).
 * Events go to the page through the port; PCM buffers are transferred, not copied.
 */
'use strict';

class LumoBeat extends AudioWorkletProcessor {
  constructor() {
    super();
    this.core = new globalThis.BeatCore(sampleRate, (e) => {
      e.at = currentTime;                              // the page subtracts how long the message travelled
      if (e.type === 'pcm') this.port.postMessage(e, [e.data.buffer]);
      else this.port.postMessage(e);
    });
    this.mono = new Float32Array(128);
    this.port.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.cmd === 'reset') this.core.reset();
      if (m.cmd === 'pcm') this.core.pcmOn = !!m.on;
    };
  }

  process(inputs) {
    const inp = inputs[0];
    if (inp && inp.length) {
      let x = inp[0];
      if (inp.length > 1) {                            // stereo mixer out: mix to mono
        if (this.mono.length !== x.length) this.mono = new Float32Array(x.length);
        const k = 1 / inp.length;
        for (let i = 0; i < x.length; i++) {
          let s = 0;
          for (let c = 0; c < inp.length; c++) s += inp[c][i];
          this.mono[i] = s * k;
        }
        x = this.mono;
      }
      this.core.process(x);
    }
    return true;
  }
}
registerProcessor('lumo-beat', LumoBeat);
