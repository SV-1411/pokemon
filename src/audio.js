// Sound: WebAudio-synthesized SFX + generative chiptune BGM, and the official
// Pokémon cries streamed from the PokéAPI cries archive.
const CRY_URL = (id) => `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

class AudioEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmTrack = null;
    this.cryEl = null;
    // AudioContext needs a user gesture
    const unlock = () => {
      this.init();
      removeEventListener('keydown', unlock);
      removeEventListener('mousedown', unlock);
    };
    addEventListener('keydown', unlock);
    addEventListener('mousedown', unlock);
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    if (this.pendingBgm) this.bgm(this.pendingBgm);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) { this.stopBgm(); this.cryEl?.pause(); }
    else if (this.lastTrack) this.bgm(this.lastTrack);
    return this.enabled;
  }

  // one enveloped oscillator note
  note(freq, t0, dur, { type = 'square', vol = 0.12, slide = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(t0, dur, vol = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.master);
    src.start(t0);
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---------- SFX ----------
  menu() { this.note(880, this.now(), 0.05, { vol: 0.05 }); }
  encounter() {
    const t = this.now();
    [660, 587, 660, 587, 660, 880].forEach((f, i) => this.note(f, t + i * 0.07, 0.07, { vol: 0.1 }));
  }
  hit(eff = 1) {
    const t = this.now();
    this.noise(t, 0.12, 0.14);
    this.note(eff >= 2 ? 200 : 150, t, 0.18, { type: 'sawtooth', vol: eff >= 2 ? 0.2 : 0.12, slide: -80 });
    if (eff >= 2) this.note(95, t + 0.05, 0.25, { type: 'sawtooth', vol: 0.18, slide: -40 });
  }
  faint() {
    const t = this.now();
    this.note(440, t, 0.5, { type: 'square', vol: 0.14, slide: -380 });
  }
  throwBall() { this.note(300, this.now(), 0.22, { vol: 0.1, slide: 500 }); }
  ballShake() { this.note(140, this.now(), 0.09, { type: 'triangle', vol: 0.16 }); }
  catchClick() {
    const t = this.now();
    this.note(523, t, 0.09, { vol: 0.14 });
    this.note(392, t + 0.1, 0.3, { vol: 0.14 });
  }
  breakout() { this.noise(this.now(), 0.25, 0.18); }
  levelup() {
    const t = this.now();
    [523, 659, 784, 1047].forEach((f, i) => this.note(f, t + i * 0.09, 0.12, { vol: 0.12 }));
  }
  heal() {
    const t = this.now();
    [784, 988, 784, 988, 1175].forEach((f, i) => this.note(f, t + i * 0.12, 0.14, { type: 'triangle', vol: 0.12 }));
  }
  caught() {
    const t = this.now();
    [392, 523, 659, 784, 659, 784].forEach((f, i) => this.note(f, t + i * 0.1, 0.13, { vol: 0.12 }));
  }

  // official cry from the PokéAPI cries archive
  cry(id) {
    if (!this.enabled) return;
    try {
      this.cryEl?.pause();
      this.cryEl = new window.Audio(CRY_URL(id));
      this.cryEl.volume = 0.4;
      this.cryEl.play().catch(() => {});
    } catch { /* ignore */ }
  }

  // ---------- generative chiptune BGM ----------
  // step arrays: [lead, bass] semitone offsets (null = rest), 8th notes
  static TRACKS = {
    world: {
      bpm: 112, base: 392, // G4 major pentatonic stroll
      lead: [0, 4, 7, 4, 9, 7, 4, 0, 2, 4, 7, 9, 7, 4, 2, 0],
      bass: [-24, null, -17, null, -19, null, -12, null, -24, null, -17, null, -19, null, -12, null],
    },
    battle: {
      bpm: 152, base: 330, // E minor urgency
      lead: [0, 0, 3, 0, 5, 3, 0, -2, 0, 0, 3, 5, 7, 5, 3, 0],
      bass: [-24, -24, null, -24, -21, null, -19, null, -24, -24, null, -24, -17, null, -19, null],
    },
  };
  bgm(name) {
    this.lastTrack = name;
    if (!this.ctx) { this.pendingBgm = name; return; }
    if (!this.enabled) return;
    this.stopBgm(false);
    const tr = AudioEngine.TRACKS[name];
    if (!tr) return;
    this.bgmTrack = name;
    const stepDur = 60 / tr.bpm / 2;
    let next = this.now() + 0.05;
    this.bgmStep = 0;
    const semi = (s) => tr.base * Math.pow(2, s / 12);
    this.bgmTimer = setInterval(() => {
      if (!this.enabled) return;
      while (next < this.now() + 0.3) {
        const i = this.bgmStep % 16;
        if (tr.lead[i] !== null) this.note(semi(tr.lead[i]), next, stepDur * 0.9, { type: 'square', vol: 0.025 });
        if (tr.bass[i] !== null) this.note(semi(tr.bass[i]), next, stepDur * 0.95, { type: 'triangle', vol: 0.05 });
        next += stepDur;
        this.bgmStep++;
      }
    }, 120);
  }
  stopBgm(clearTrack = true) {
    clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    if (clearTrack) this.bgmTrack = null;
  }
}

export const SFX = new AudioEngine();
