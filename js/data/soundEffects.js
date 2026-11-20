(function (NB) {
  'use strict';

  // Patches combine filtered noise with short oscillator sweeps and metallic FM.
  NB.SoundEffects = {
    select: [
      { wave: 'noise', from: 2200, to: 1250, length: 0.024, level: 0.24 },
      { wave: 'sine', from: 360, to: 235, length: 0.045, level: 0.10, modulation: 670 }
    ],
    draw: [
      { wave: 'noise', from: 1400, to: 720, length: 0.07, level: 0.30, attack: 0.016 },
      { wave: 'noise', from: 2800, to: 1500, length: 0.025, level: 0.17, delay: 0.05 }
    ],
    summon: [
      { wave: 'sawtooth', from: 51, to: 107, length: 0.22, level: 0.28, cutoff: 540, attack: 0.07 },
      { wave: 'noise', from: 430, to: 1850, length: 0.13, level: 0.32, attack: 0.06 },
      { wave: 'sine', from: 105, to: 46, length: 0.19, level: 0.32, delay: 0.12 },
      { wave: 'noise', from: 2600, to: 670, length: 0.06, level: 0.25, delay: 0.12 }
    ],
    exploit: [
      { wave: 'noise', from: 700, to: 3100, length: 0.12, level: 0.38, attack: 0.04 },
      { wave: 'sine', from: 425, to: 245, length: 0.09, level: 0.20, modulation: 880, delay: 0.07 },
      { wave: 'noise', from: 1800, to: 600, length: 0.065, level: 0.29, delay: 0.13 }
    ],
    attack: [
      { wave: 'noise', from: 380, to: 1650, length: 0.105, level: 0.46, attack: 0.045 },
      { wave: 'sawtooth', from: 73, to: 137, length: 0.10, level: 0.16, cutoff: 570, attack: 0.04 }
    ],
    clash: [
      { wave: 'noise', from: 1960, to: 490, length: 0.13, level: 0.51 },
      { wave: 'sine', from: 110, to: 43, length: 0.19, level: 0.46 },
      { wave: 'sine', from: 580, to: 290, length: 0.095, level: 0.15, modulation: 956 }
    ],
    damage: [
      { wave: 'noise', from: 670, to: 220, length: 0.11, level: 0.41 },
      { wave: 'sine', from: 86, to: 39, length: 0.20, level: 0.47 }
    ],
    destroy: [
      { wave: 'noise', from: 1700, to: 340, length: 0.25, level: 0.57 },
      { wave: 'sine', from: 95, to: 36, length: 0.29, level: 0.47 },
      { wave: 'noise', from: 2100, to: 430, length: 0.14, level: 0.33, delay: 0.075 },
      { wave: 'noise', from: 1400, to: 530, length: 0.07, level: 0.19, delay: 0.18 }
    ],
    victory: [
      { wave: 'noise', from: 550, to: 2100, length: 0.18, level: 0.34, attack: 0.07 },
      { wave: 'sawtooth', from: 98, to: 98, length: 0.52, level: 0.23, cutoff: 730, delay: 0.12, attack: 0.05 },
      { wave: 'triangle', from: 147, to: 147, length: 0.49, level: 0.18, delay: 0.12, attack: 0.08 },
      { wave: 'sine', from: 196, to: 196, length: 0.41, level: 0.14, delay: 0.16, modulation: 73 }
    ],
    defeat: [
      { wave: 'noise', from: 1050, to: 240, length: 0.31, level: 0.35 },
      { wave: 'sawtooth', from: 118, to: 49, length: 0.43, level: 0.34, cutoff: 390, attack: 0.025 },
      { wave: 'sine', from: 131, to: 52, length: 0.38, level: 0.23, delay: 0.065, modulation: 98 }
    ],
    overclock: [
      { wave: 'sawtooth', from: 46, to: 310, length: 0.37, level: 0.34, cutoff: 1050, attack: 0.19 },
      { wave: 'noise', from: 410, to: 3600, length: 0.37, level: 0.45, attack: 0.22 },
      { wave: 'sine', from: 144, to: 35, length: 0.31, level: 0.53, delay: 0.34 },
      { wave: 'noise', from: 2600, to: 460, length: 0.22, level: 0.52, delay: 0.34 }
    ],
    laser: [
      { wave: 'sine', from: 980, to: 270, length: 0.14, level: 0.22, modulation: 1230 },
      { wave: 'noise', from: 3500, to: 710, length: 0.12, level: 0.32 }
    ],
    virus: [
      { wave: 'sine', from: 395, to: 280, length: 0.045, level: 0.20, modulation: 601 },
      { wave: 'noise', from: 2200, to: 740, length: 0.035, level: 0.34, delay: 0.03 },
      { wave: 'sine', from: 292, to: 195, length: 0.045, level: 0.20, modulation: 587, delay: 0.065 },
      { wave: 'noise', from: 1250, to: 510, length: 0.082, level: 0.23, delay: 0.10 }
    ],
    drain: [
      { wave: 'noise', from: 1800, to: 270, length: 0.21, level: 0.36, attack: 0.045 },
      { wave: 'sawtooth', from: 165, to: 61, length: 0.23, level: 0.26, cutoff: 510, attack: 0.03 },
      { wave: 'sine', from: 104, to: 62, length: 0.11, level: 0.18, delay: 0.11 }
    ]
  };
})(window.NB = window.NB || {});
