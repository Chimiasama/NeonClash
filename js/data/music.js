(function (NB) {
  'use strict';

  // MIDI roots and semitone offsets. Drum positions are steps in a 16-step bar.
  NB.MusicTracks = {
    title: { // Suspense: subgrave, semitons e ataques espaçados.
      bpm: 82, roots: [35, 35, 31, 36], pad: [0, 7, 13], color: 380,
      bass: [0, -1, -1, -1, -1, -1, 12, -1, 0, -1, -1, -1, -1, -1, 1, -1],
      motif: [-1, -1, 19, -1, -1, -1, 13, -1, -1, -1, 12, -1, -1, -1, -1, -1],
      kick: [0, 10], snare: [12], hats: [3, 7, 15], lead: 'triangle'
    },
    city: { // Investigação: pulso contido e pequenos ecos.
      bpm: 96, roots: [38, 38, 34, 37], pad: [0, 3, 7, 13], color: 460,
      bass: [0, -1, -1, 0, -1, -1, 7, -1, 0, -1, -1, 0, -1, 10, -1, -1],
      motif: [-1, 19, -1, -1, -1, 15, -1, 13, -1, -1, -1, 15, -1, -1, -1, -1],
      kick: [0, 7, 10], snare: [4, 12], hats: [2, 6, 9, 14], lead: 'triangle', echo: true
    },
    market: { // Lume: balanço irregular, notas de passagem e timbre abafado.
      bpm: 103, roots: [33, 33, 36, 34], pad: [0, 3, 10], color: 530,
      bass: [0, -1, -1, 7, -1, 0, -1, -1, 0, -1, 10, -1, -1, 0, 6, -1],
      motif: [-1, -1, 15, -1, 18, -1, -1, 19, -1, -1, 15, -1, -1, 13, -1, -1],
      kick: [0, 6, 11], snare: [4, 13], hats: [2, 7, 10, 14], lead: 'triangle'
    },
    relay: { // Nina: cliques de rádio e um motivo curto que retorna em eco.
      bpm: 109, roots: [41, 41, 40, 38], pad: [0, 5, 13], color: 370,
      bass: [0, -1, 0, -1, -1, 12, -1, -1, 0, -1, -1, 0, -1, -1, 1, -1],
      motif: [24, -1, -1, 25, -1, -1, 19, -1, -1, -1, 22, -1, -1, -1, 24, -1],
      kick: [0, 8], snare: [5, 12], hats: [3, 7, 11, 15], lead: 'sine', echo: true
    },
    risco: { // Ringue: batida quebrada, percussão seca e riff grave.
      bpm: 133, roots: [35, 35, 33, 36], pad: [0, 6, 10], color: 590,
      bass: [0, 0, -1, 0, -1, 6, 0, -1, 0, -1, 0, 10, -1, 6, 0, -1],
      motif: [-1, -1, 12, -1, -1, -1, 18, -1, 12, -1, -1, -1, 19, -1, -1, -1],
      kick: [0, 3, 8, 11, 14], snare: [4, 12], hats: [2, 5, 7, 10, 13, 15], lead: 'sawtooth'
    },
    kira: { // Kira: baixo ágil e frases sincopadas.
      bpm: 146, roots: [40, 40, 36, 41], pad: [0, 3, 13], color: 660,
      bass: [0, -1, 0, 12, -1, 0, 7, -1, 0, 0, -1, 12, -1, 0, 1, -1],
      motif: [-1, 19, -1, 22, -1, -1, 25, -1, 24, -1, 19, -1, -1, 22, -1, 18],
      kick: [0, 4, 8, 12], snare: [4, 12], hats: [2, 5, 6, 10, 13, 14, 15], lead: 'triangle'
    },
    cipher: { // Cipher: marcha industrial e intervalos rígidos.
      bpm: 118, roots: [37, 37, 36, 33], pad: [0, 7, 13], color: 490,
      bass: [0, 0, -1, -1, 0, 0, -1, -1, 0, 0, -1, -1, 0, -1, 7, -1],
      motif: [12, -1, -1, -1, 13, -1, -1, -1, 12, -1, -1, -1, 19, -1, -1, -1],
      kick: [0, 4, 8, 12], snare: [4, 12, 15], hats: [2, 6, 10, 14], lead: 'sawtooth'
    },
    vex: { // Vex: baixo furtivo, frase cromática e ecos longos.
      bpm: 111, roots: [34, 38, 33, 34], pad: [0, 3, 6, 10], color: 420,
      bass: [0, -1, -1, 6, -1, -1, 0, -1, 0, -1, 10, -1, -1, 1, -1, -1],
      motif: [-1, -1, 22, 21, -1, -1, 18, -1, -1, 15, -1, -1, 13, -1, -1, -1],
      kick: [0, 6, 10], snare: [5, 12], hats: [2, 7, 11, 14], lead: 'sine', echo: true
    },
    archon: { // Archon: ostinato de chefe e acordes tensos no grave.
      bpm: 136, roots: [31, 32, 29, 33], pad: [0, 6, 13], color: 600,
      bass: [0, 0, -1, 0, 0, -1, 0, 0, 0, -1, 6, 0, 0, -1, 1, 0],
      motif: [19, -1, -1, 18, -1, 13, -1, -1, 19, -1, -1, 18, -1, 24, -1, 13],
      kick: [0, 4, 7, 8, 12, 15], snare: [4, 12], hats: [2, 6, 9, 10, 14, 15], lead: 'sawtooth'
    }
  };
})(window.NB = window.NB || {});
