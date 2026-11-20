(function (NB) {
  'use strict';

  const tracks = NB.MusicTracks;
  const preferenceKey = 'neon_breach_sound';
  const volumeKey = 'neon_breach_volume';
  const channelGain = { music: 0.28, sfx: 0.55 };
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

  /* Mixer e síntese em Web Audio. */
  const SoundEngine = {
    ctx: null,
    enabled: false,
    scene: 'title',
    battle: false,
    preference: null,
    volumes: { music: 100, sfx: 100 },
    nextBeat: 0,
    musicTimer: null,
    step: 0,
    masterGain: null,
    musicGain: null,
    trackGain: null,
    sfxGain: null,
    sfxCompressor: null,
    noiseBuffer: null,
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
      this.musicGain.gain.value = this.volumes.music / 100 * channelGain.music;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.volumes.sfx / 100 * channelGain.sfx;
      this.sfxGain.connect(this.masterGain);

      this.sfxCompressor = this.ctx.createDynamicsCompressor();
      this.sfxCompressor.threshold.value = -15;
      this.sfxCompressor.ratio.value = 3;
      this.sfxCompressor.attack.value = 0.003;
      this.sfxCompressor.release.value = 0.09;
      this.sfxCompressor.connect(this.sfxGain);

      const sampleRate = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
      const noise = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
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

    restorePreference() {
      try {
        const stored = window.localStorage.getItem(preferenceKey);
        if (stored === 'on' || stored === 'off') this.preference = stored === 'on';
        const volumes = JSON.parse(window.localStorage.getItem(volumeKey));
        for (const channel of Object.keys(channelGain)) {
          if (Number.isFinite(volumes?.[channel])) this.volumes[channel] = this.normalizeVolume(volumes[channel]);
        }
      } catch (_) {}
    },

    normalizeVolume(value) {
      return Math.min(100, Math.max(0, Math.round(value)));
    },

    setVolume(channel, value) {
      if (!Object.hasOwn(channelGain, channel) || !Number.isFinite(value)) return;
      this.volumes[channel] = this.normalizeVolume(value);
      const bus = channel === 'music' ? this.musicGain : this.sfxGain;
      if (bus) {
        const now = this.ctx.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setTargetAtTime(this.volumes[channel] / 100 * channelGain[channel], now, 0.015);
      }
      try {
        window.localStorage.setItem(volumeKey, JSON.stringify(this.volumes));
      } catch (_) {}
    },

    activateOnEntry() {
      if (this.preference !== false && !this.enabled) this.setEnabled(true);
    },

    toggle() {
      this.preference = !this.enabled;
      try {
        window.localStorage.setItem(preferenceKey, this.preference ? 'on' : 'off');
      } catch (_) {}
      this.setEnabled(this.preference);
      if (this.enabled) this.playSelect();
    },

    /* Opcional: reproduz arquivo salvo em ./audio/<nome>.ogg|.mp3 se existir */
    playCustomFile(relativePath, volume = 0.6) {
      if (!this.enabled || !this.ctx) return;
      try {
        if (!this.audioCache[relativePath]) {
          this.audioCache[relativePath] = new Audio(relativePath);
        }
        const snd = this.audioCache[relativePath].cloneNode();
        snd.volume = volume;
        const source = this.ctx.createMediaElementSource(snd);
        source.connect(this.sfxCompressor);
        const disconnect = () => source.disconnect();
        snd.addEventListener('ended', disconnect, { once: true });
        snd.play().catch(disconnect);
      } catch (_) {}
    },

    setScene(scene, battle = false) {
      this.battle = battle;
      if (!Object.hasOwn(tracks, scene)) scene = 'city';
      if (scene === this.scene) return;
      this.scene = scene;
      this.stopMusic();
      this.step = 0;
      if (this.enabled) this.startMusic();
    },

    startMusic() {
      if (!this.ctx || this.musicTimer) return;
      const now = this.ctx.currentTime;
      this.trackGain = this.ctx.createGain();
      this.trackGain.gain.setValueAtTime(0.001, now);
      this.trackGain.gain.linearRampToValueAtTime(1, now + 0.14);
      this.trackGain.connect(this.musicGain);

      const track = tracks[this.scene];
      const interval = 60 / track.bpm / 4;
      this.nextBeat = now + 0.04;
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
      const step = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const root = track.roots[bar % track.roots.length];
      const battle = this.battle;
      if (track.kick.includes(step) || (battle && step % 4 === 0)) {
        this.musicNote(time, 'sine', 128, 40, 0.23, battle ? 0.80 : 0.54);
      }
      if (track.snare.includes(step)) {
        this.playNoise(time, 0.12, battle ? 0.28 : 0.16, 1000, this.trackGain);
        this.musicNote(time, 'triangle', 173, 103, 0.08, 0.08, 900);
      }
      if (track.hats.includes(step) || (battle && step % 4 === 3)) {
        const accent = step % 4 === 2;
        this.playNoise(time, accent ? 0.09 : 0.035, accent ? 0.11 : 0.042, 5800, this.trackGain);
      }

      const bass = track.bass[step];
      if (bass >= 0) {
        const pitch = frequency(root + bass);
        this.musicNote(time, 'sawtooth', pitch, pitch, interval * 1.35, battle ? 0.3 : 0.22, track.color);
        if (battle && step % 2 === 0) this.musicNote(time, 'sine', pitch / 2, pitch / 2, interval, 0.14);
      }
      if (step === 0) {
        for (const offset of track.pad) {
          const pitch = frequency(root + offset);
          this.musicNote(time, 'triangle', pitch, pitch, interval * 14, battle ? 0.039 : 0.062, track.color * 1.2);
        }
      }
      const motif = track.motif[step];
      if (motif >= 0 && (battle || bar % 4 !== 2)) {
        const pitch = frequency(root + motif);
        this.musicNote(time, track.lead, pitch, pitch, interval * 2, 0.10, track.color * 2);
        if (track.echo && !battle) {
          this.musicNote(time + interval * 3, 'sine', pitch, pitch, interval * 2, 0.045, track.color * 2);
        }
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
      envelope.connect(this.trackGain);
      osc.start(time);
      osc.stop(time + duration);
    },

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      const gain = this.trackGain;
      if (gain) {
        const now = this.ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.035);
        window.setTimeout(() => gain.disconnect(), 220);
        this.trackGain = null;
      }
    },

    playNoise(startTime, duration, volume, highpassFreq, dest) {
      if (!this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.value = highpassFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(volume, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      src.connect(flt);
      flt.connect(g);
      g.connect(dest);
      src.start(startTime, 0, duration);
    },

    playEffect(name) {
      if (!this.enabled || !this.ctx || this.volumes.sfx === 0) return;
      const now = this.ctx.currentTime;
      for (const voice of NB.SoundEffects[name]) this.playEffectVoice(voice, now);
    },

    playEffectVoice(voice, now) {
      const { wave, from, to, length, level, cutoff, modulation, attack = 0.004, delay = 0 } = voice;
      const time = now + delay;
      const envelope = this.ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(level, time + attack);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + length);
      envelope.connect(this.sfxCompressor);

      if (wave === 'noise') {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 0.8;
        filter.frequency.setValueAtTime(from, time);
        filter.frequency.exponentialRampToValueAtTime(to, time + length);
        source.connect(filter).connect(envelope);
        source.start(time, 0, length);
        return;
      }

      const carrier = this.ctx.createOscillator();
      carrier.type = wave;
      carrier.frequency.setValueAtTime(from, time);
      carrier.frequency.exponentialRampToValueAtTime(to, time + length * 0.75);
      if (cutoff) {
        const filter = this.ctx.createBiquadFilter();
        filter.frequency.value = cutoff;
        carrier.connect(filter).connect(envelope);
      } else {
        carrier.connect(envelope);
      }
      if (modulation) {
        const modulator = this.ctx.createOscillator();
        modulator.frequency.value = modulation;
        const depth = this.ctx.createGain();
        depth.gain.setValueAtTime(from * 0.7, time);
        depth.gain.exponentialRampToValueAtTime(2, time + length);
        modulator.connect(depth).connect(carrier.frequency);
        modulator.start(time);
        modulator.stop(time + length);
      }
      carrier.start(time);
      carrier.stop(time + length);
    },

    playSelect() { this.playEffect('select'); },
    playDraw() { this.playEffect('draw'); },
    playSummon() { this.playEffect('summon'); },
    playExploit() { this.playEffect('exploit'); },
    playAttack() { this.playEffect('attack'); },
    playClash() { this.playEffect('clash'); },
    playDamage() { this.playEffect('damage'); },
    playDestroy() { this.playEffect('destroy'); },
    playVictory() { this.playEffect('victory'); },
    playDefeat() { this.playEffect('defeat'); },
    playOverclock() { this.playEffect('overclock'); },
    playLaser() { this.playEffect('laser'); },
    playVirus() { this.playEffect('virus'); },
    playDrain() { this.playEffect('drain'); }
  };

  NB.Audio = SoundEngine;
})(window.NB = window.NB || {});
