(function (NB) {
  'use strict';

  // Estimates for a contested board. These weights are independent of tactical AI scoring.
  const version = '0.4';
  const weights = Object.freeze({ atk: 1, def: 0.75, ram: 0.9, card: 2.5 });
  const effectValue = {
    atk: effect => Math.abs(effect.value) * weights.atk,
    def: effect => effect.value * weights.def,
    ram: effect => effect.value * weights.ram,
    drain: effect => effect.value * 2 * 0.65,
    direct: effect => effect.value * 1.6,
    heal: effect => effect.value * 0.6 * 0.65,
    hpShield: effect => effect.value * 0.6 * 0.65,
    repair: effect => effect.value * 0.55 * 0.65,
    damage: effect => effect.value * 0.9 + (effect.value >= 2 ? 0.6 : 0.25),
    draw: effect => effect.value * weights.card * 0.9,
    recycle: effect => weights.card * (effect.order === 'latest' ? 0.7 : 0.6),
    scan: () => weights.card * 1.25 * 0.9,
    discardDamage: effect => Math.min(effect.cap, 2) * 1.6,
    affinity: () => 0.5,
    destroy: () => 6,
    banish: () => 6.5,
    counterFormation: () => 1.2,
    overclockCoupler: () => 0.35
  };

  function effects(card) {
    return [...(card.effects || []), ...(card.onDeploy || []), ...(card.onAttack || [])]
      .reduce((total, effect) => {
        const targets = effect.target === 'allies' || effect.target === 'enemies' ? 1.5 : 1;
        const condition = effect.resonance ? 0.45 : effect.mixed ? 0.55 : 1;
        const availability = card.targetAffinities ? 0.8 : effect.target === 'selected' ? 0.8 : 1;
        return total + effectValue[effect.type](effect) * targets * condition * availability;
      }, 0);
  }

  function evaluate(card) {
    const round = value => Math.round(value * 100) / 100;
    const unit = card.kind === 'unit';
    const has = keyword => unit && NB.Cards.hasKeyword(card, keyword);
    const base = unit ? weights.atk * card.atk + weights.def * card.def + weights.ram * card.ramGain
      : -weights.ram * card.cost - weights.card;
    const traits = (has('ZERO_DAY') ? card.atk * 0.4 : 0) + (has('FIREWALL') ? 1.2 : 0) +
      (has('VIRUS') ? 0.9 : 0) + (has('DRENO') ? 0.8 : 0) + (has('VIGILANCE') ? 1.2 : 0) -
      (has('ATTACK_ONLY') ? 0.5 : 0) + Math.max(0, (card.blockLimit || 1) - 1) * 0.8;
    const overclock = (card.overclock?.counterReduction || 0) * 0.75 * 0.45 +
      (card.overclock?.partnerBlock ? 0.6 : 0) + (card.overclock?.refund || 0) * weights.ram * 0.45;
    const bonuses = effects(card) + traits + overclock + (card.ability === 'PING_1' ? 1.6 : 0);
    return Object.freeze({ base: round(base), bonuses: round(bonuses), total: round(base + bonuses) });
  }

  const byId = Object.freeze(Object.fromEntries(Object.values(NB.Cards.CARD_DB).map(card => [card.id, evaluate(card)])));
  NB.CardPower = Object.freeze({ version, weights, byId });
})(window.NB = window.NB || {});
