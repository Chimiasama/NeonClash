(function (NB) {
  'use strict';

  /* Motor de Áudio: Sintetizador Synthwave/Chiptune 100% Web Audio API
     + helper playCustomFile() para usar arquivos futuros na pasta ./audio/ */
  const SoundEngine = {
    ctx: null,
    enabled: false,
    musicTimer: null,
    step: 0,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    audioCache: {},

    isEnabled() {
      return this.enabled;
    },

    init() {
      if (this.ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.masterGain);
    },

    setEnabled(on) {
      this.enabled = on;
      if (on) {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        this.startMusic();
      } else {
        this.stopMusic();
      }
      if (NB.UI && NB.UI.updateSoundButtons) NB.UI.updateSoundButtons();
    },

    toggle() {
      this.setEnabled(!this.enabled);
      if (this.enabled) this.playSelect();
    },

    /* Opcional: reproduz arquivo salvo em ./audio/<nome>.ogg|.mp3 se existir */
    playCustomFile(relativePath, volume = 0.6) {
      if (!this.enabled) return;
      try {
        if (!this.audioCache[relativePath]) {
          this.audioCache[relativePath] = new Audio(relativePath);
        }
        const snd = this.audioCache[relativePath].cloneNode();
        snd.volume = volume;
        snd.play().catch(() => {});
      } catch (_) {}
    },

    startMusic() {
      if (!this.ctx || this.musicTimer) return;
      const bassPattern = [
        73.42, 73.42, 0, 73.42, 87.31, 0, 73.42, 65.41,
        58.27, 58.27, 0, 58.27, 65.41, 0, 82.41, 98.00
      ];
      const arpPattern = [
        293.66, 0, 349.23, 0, 440.00, 0, 523.25, 0,
        293.66, 0, 440.00, 349.23, 329.63, 0, 261.63, 0
      ];
      const stepMs = 134; // ~112 BPM em semicolcheias
      this.musicTimer = setInterval(() => {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        const s = this.step % 16;

        if (s % 4 === 0) {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(128, now);
          osc.frequency.exponentialRampToValueAtTime(36, now + 0.11);
          g.gain.setValueAtTime(0.45, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
          osc.connect(g);
          g.connect(this.musicGain);
          osc.start(now);
          osc.stop(now + 0.14);
        }

        if (s % 2 === 1) {
          this.playNoise(now, 0.03, 0.08, 6000, this.musicGain);
        }

        const bf = bassPattern[s];
        if (bf > 0) {
          const osc = this.ctx.createOscillator();
          const flt = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(bf, now);
          flt.type = 'lowpass';
          flt.frequency.setValueAtTime(420, now);
          flt.frequency.exponentialRampToValueAtTime(160, now + 0.12);
          g.gain.setValueAtTime(0.24, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(flt);
          flt.connect(g);
          g.connect(this.musicGain);
          osc.start(now);
          osc.stop(now + 0.13);
        }

        const af = arpPattern[s];
        if (af > 0 && Math.floor(this.step / 16) % 2 === 1) {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(af, now);
          g.gain.setValueAtTime(0.07, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(g);
          g.connect(this.musicGain);
          osc.start(now);
          osc.stop(now + 0.11);
        }

        this.step++;
      }, stepMs);
    },

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    },

    playNoise(startTime, duration, volume, highpassFreq, dest) {
      if (!this.ctx) return;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.value = highpassFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(volume, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      src.connect(flt);
      flt.connect(g);
      g.connect(dest || this.sfxGain);
      src.start(startTime);
    },

    tone(freq1, freq2, dur, type, vol, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq1, now);
      if (freq2 !== freq1) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), now + dur);
      }
      g.gain.setValueAtTime(vol || 0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + dur + 0.01);
    },

    playSelect() {
      this.tone(680, 960, 0.06, 'triangle', 0.18);
    },
    playDraw() {
      this.tone(360, 820, 0.09, 'triangle', 0.16);
    },
    playSummon() {
      this.tone(140, 280, 0.14, 'sawtooth', 0.22);
      this.tone(440, 660, 0.12, 'square', 0.15, 0.06);
      this.tone(880, 1180, 0.14, 'triangle', 0.14, 0.12);
    },
    playExploit() {
      this.tone(1100, 260, 0.18, 'sawtooth', 0.22);
      this.tone(520, 1480, 0.16, 'square', 0.14, 0.05);
    },
    playAttack() {
      this.tone(240, 620, 0.12, 'sawtooth', 0.2);
    },
    playClash() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.playNoise(now, 0.16, 0.34, 900);
      this.tone(190, 55, 0.18, 'sawtooth', 0.28);
    },
    playDamage() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.playNoise(now, 0.14, 0.25, 400);
      this.tone(150, 42, 0.24, 'square', 0.3);
    },
    playDestroy() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.playNoise(now, 0.24, 0.3, 600);
      this.tone(340, 48, 0.26, 'sawtooth', 0.22);
      this.tone(220, 35, 0.24, 'square', 0.18, 0.06);
    },
    playVictory() {
      [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => {
        this.tone(n, n * 1.01, 0.22, 'square', 0.16, i * 0.1);
      });
    },
    playDefeat() {
      [349.23, 311.13, 261.63, 174.61].forEach((n, i) => {
        this.tone(n, n * 0.96, 0.26, 'sawtooth', 0.18, i * 0.13);
      });
    },
    playOverclock() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.tone(180, 980, 0.26, 'sawtooth', 0.26, 0);
      this.tone(360, 1440, 0.24, 'square', 0.2, 0.06);
      this.tone(110, 48, 0.3, 'sawtooth', 0.3, 0.2);
      this.playNoise(now + 0.2, 0.22, 0.36, 700);
    },
    playLaser() {
      this.tone(1420, 260, 0.2, 'sawtooth', 0.24);
      this.tone(860, 180, 0.18, 'triangle', 0.16, 0.03);
    },
    playVirus() {
      this.tone(520, 180, 0.14, 'square', 0.16);
      this.tone(310, 120, 0.15, 'sawtooth', 0.15, 0.07);
    },
    playDrain() {
      this.tone(320, 920, 0.16, 'triangle', 0.18);
      this.tone(640, 1280, 0.14, 'sine', 0.16, 0.08);
    }
  };

  NB.Audio = SoundEngine;
})(window.NB = window.NB || {});
