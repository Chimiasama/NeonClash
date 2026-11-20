(function (NB) {
  'use strict';

  const tracks = {
    city: {
      bpm: 116,
      chords: [[38, 50, 53, 57, 60], [34, 46, 50, 53, 57], [41, 53, 57, 60, 64], [36, 48, 52, 55, 62]],
      bass: [0, -1, 0, 1, -1, 0, 3, -1, 0, -1, 0, 1, -1, 1, 3, -1],
      lead: [1, -1, 2, -1, 3, -1, 4, -1, -1, 3, -1, 2, 4, -1, 3, 2]
    },
    duel: {
      bpm: 142,
      chords: [[40, 52, 55, 59, 62], [40, 52, 55, 59, 65], [36, 48, 52, 55, 59], [38, 50, 53, 57, 60]],
      bass: [-1, 0, 0, 1, -1, 0, 0, 3, -1, 0, 0, 1, -1, 1, 0, 0],
      lead: [-1, -1, 3, -1, -1, 4, -1, 2, -1, -1, 3, 3, -1, 4, -1, 2]
    }
  };
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

  /* Motor de Áudio: Sintetizador Synthwave/Chiptune 100% Web Audio API
     + helper playCustomFile() para usar arquivos futuros na pasta ./audio/ */
  const SoundEngine = {
    ctx: null,
    enabled: false,
    scene: 'city',
    chosen: false,
    nextBeat: 0,
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
        this.step = 0;
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        if (this.masterGain) this.masterGain.gain.value = 0.7;
        this.startMusic();
      } else {
        if (this.masterGain) this.masterGain.gain.value = 0;
        this.stopMusic();
      }
      if (NB.UI && NB.UI.updateSoundButtons) NB.UI.updateSoundButtons();
    },

    activateOnEntry() {
      if (!this.chosen) this.setEnabled(true);
    },

    toggle() {
      this.chosen = true;
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

    setScene(scene) {
      if (scene === this.scene) return;
      this.scene = scene;
      this.stopMusic();
      this.step = 0;
      if (this.enabled) this.startMusic();
    },

    startMusic() {
      if (!this.ctx || this.musicTimer) return;
      const track = tracks[this.scene];
      const interval = 60 / track.bpm / 4;
      this.nextBeat = this.ctx.currentTime + 0.04;
      this.musicTimer = setInterval(() => {
        if (!this.enabled || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        this.nextBeat = Math.max(this.nextBeat, now + 0.01);
        while (this.nextBeat < now + 0.11) {
          this.playBeat(track, this.nextBeat, interval);
          this.nextBeat += interval;
          this.step++;
        }
      }, 25);
    },

    playBeat(track, time, interval) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const chord = track.chords[bar % track.chords.length];
      const duel = this.scene === 'duel';
      if (s % 4 === 0) this.musicNote(time, 'sine', 145, 43, 0.18, duel ? 0.72 : 0.58);
      if (s % 8 === 4) this.playNoise(time, 0.13, 0.28, 1250, this.musicGain);
      if (s % 2 === 0 || duel) this.playNoise(time, s % 4 === 2 ? 0.075 : 0.027, s % 4 === 2 ? 0.17 : 0.046, 6200, this.musicGain);

      const bass = track.bass[s];
      if (bass >= 0) {
        const note = frequency(chord[bass]);
        this.musicNote(time, 'sawtooth', note, note, interval * 0.95, 0.29, duel ? 650 : 430);
      }
      if (s === 0 || s === 8) {
        for (const pitch of chord.slice(1)) {
          const note = frequency(pitch);
          this.musicNote(time, 'triangle', note, note, interval * 7.5, duel ? 0.035 : 0.055, 1600);
        }
      }
      const lead = track.lead[s];
      if (lead >= 0) {
        const note = frequency(chord[lead] + (duel ? 24 : 12));
        this.musicNote(time, duel ? 'square' : 'triangle', note, note, interval * 1.55, 0.085, 2200);
        if (!duel) this.musicNote(time + interval * 3, 'triangle', note, note, interval * 1.15, 0.028, 1600);
      }
    },

    musicNote(time, type, frequency, end, duration, volume, cutoff) {
      const osc = this.ctx.createOscillator();
      const envelope = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, time);
      if (end !== frequency) osc.frequency.exponentialRampToValueAtTime(end, time + duration * 0.65);
      envelope.gain.setValueAtTime(0.001, time);
      envelope.gain.exponentialRampToValueAtTime(volume, time + 0.009);
      envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
      if (cutoff) {
        const filter = this.ctx.createBiquadFilter();
        filter.frequency.value = cutoff;
        osc.connect(filter).connect(envelope);
      } else {
        osc.connect(envelope);
      }
      envelope.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + duration);
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
