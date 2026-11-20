(function (NB) {
  'use strict';

  /* Falas reativas dinâmicas do oponente atual (Kira, Cipher, Vex ou Archon) */
  function pickLine(key) {
    const state = NB.State && NB.State.get ? NB.State.get() : null;
    const boss = state && state.boss ? state.boss : (NB.Campaign ? NB.Campaign.NODES[2] : null);
    const map = boss && boss.lines ? boss.lines : null;
    if (!map) return '"Iniciando invasão..."';

    // Mapeia chaves antigas (vexHit -> hit, vexCritical -> critical, etc.)
    const alias = {
      vexHit: 'hit',
      vexCritical: 'critical',
      vexAttack: 'attack',
      vexDestroyPlayer: 'destroyPlayer',
      vexSummon: 'summon'
    };
    const resolvedKey = alias[key] || key;
    const list = map[resolvedKey] || map.start || ['"Conexão estabelecida."'];
    return list[Math.floor(Math.random() * list.length)];
  }

  function setDialogue(text) {
    const el = document.getElementById('enemy-dialogue');
    if (el) el.textContent = text;
  }

  NB.Dialogue = {
    pickLine,
    setDialogue
  };
})(window.NB = window.NB || {});
