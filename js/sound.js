// Звуки синтезируются на лету (Web Audio), без файлов.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.lastBoom = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }

  burst(dur, freq, vol) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.3), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  tone(freq, dur, vol, type = 'sine', slideTo) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  play(name) {
    if (!this.ctx || !this.on) return;
    switch (name) {
      case 'shot': this.burst(0.16, 2200, 0.35); this.tone(150, 0.12, 0.25, 'square', 55); break;
      case 'explode': {
        const now = performance.now();
        if (now - this.lastBoom < 60) return;
        this.lastBoom = now;
        this.burst(0.8, 700, 0.8); this.tone(75, 0.6, 0.55, 'sine', 28); break;
      }
      case 'dead': this.burst(1.2, 500, 1); this.tone(55, 0.9, 0.7, 'sine', 22); break;
      case 'hit': this.tone(260, 0.09, 0.2, 'square', 120); this.burst(0.08, 3000, 0.2); break;
      case 'brick': this.burst(0.12, 1100, 0.25); break;
      case 'mine': this.tone(950, 0.05, 0.12, 'square'); break;
      case 'pickup': this.tone(660, 0.08, 0.2, 'triangle'); setTimeout(() => this.tone(990, 0.12, 0.2, 'triangle'), 70); break;
      case 'crush': this.burst(0.2, 400, 0.25); break;
      case 'beep': this.tone(520, 0.12, 0.2, 'square'); break;
      case 'go': this.tone(880, 0.25, 0.25, 'square'); break;
    }
  }
}
