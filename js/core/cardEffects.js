(function (NB) {
  'use strict';

  const opposing = side => side === 'player' ? 'enemy' : 'player';
  const selectedSide = (card, side) => card.targetType === 'enemy_unit' ? opposing(side) : side;
  const indexed = field => field.flatMap((unit, slot) => unit ? [{ unit, slot }] : []);

  function targets(state, card, effect, side, slot) {
    if (effect.target === 'selected') {
      const targetSide = selectedSide(card, side);
      const unit = state[targetSide].field[slot];
      return unit ? [{ unit, slot, side: targetSide }] : [];
    }
    if (effect.target === 'allies' || effect.target === 'enemies') {
      const targetSide = effect.target === 'allies' ? side : opposing(side);
      return indexed(state[targetSide].field).map(target => ({ ...target, side: targetSide }));
    }
    return [];
  }

  function legalSlots(state, card, side) {
    if (card.targetType === 'ally_unit' || card.targetType === 'enemy_unit') {
      return indexed(state[selectedSide(card, side)].field).map(target => target.slot);
    }
    return !card.requiresEnemy || state[opposing(side)].field.some(Boolean) ? [null] : [];
  }

  const actorPanel = side => document.getElementById(side === 'player' ? 'player-hud' : 'enemy-panel');

  function adjustUnit(type, unit, value) {
    if (type === 'atk') {
      const before = unit.atk;
      unit.atk = Math.max(0, before + value);
      return `${unit.atk - before >= 0 ? '+' : ''}${unit.atk - before} ATK`;
    }
    if (type === 'def') {
      unit.def += value;
      unit.maxDef += value;
      return `+${value} DEF`;
    }
    if (type === 'repair') {
      const gain = Math.min(value, Math.max(0, unit.maxDef - unit.def));
      unit.def += gain;
      return `+${gain} DEF`;
    }
    if (type === 'damage') {
      unit.def -= value;
      return `-${value} DEF`;
    }
    if (type === 'affinity') {
      unit.affinity = NB.Cards.AFFINITIES[unit.affinity]?.beats || 'pulso';
      return NB.Cards.affinityLabel(unit.affinity);
    }
    return 'ELIMINADO!';
  }

  function resolve(card, effects, side, slot = null) {
    const state = NB.State.get();
    const actor = state[side];
    const enemy = opposing(side);
    const caster = actorPanel(side);
    for (const effect of effects) {
      const { type, value } = effect;
      if (type === 'direct') {
        NB.Physics.fireLaserBeam(caster, actorPanel(enemy), card.accent, 7);
        NB.State.applyDirectDamage(enemy, value, side === 'player');
      } else if (type === 'heal') {
        const healed = Math.min(value, actor.maxHp - actor.hp);
        actor.hp += healed;
        if (healed) NB.Physics.spawnFloatText(caster, `+${healed} HP`, '#39FF14');
      } else if (type === 'drain') {
        NB.State.applyRamDrain(side, value);
      } else if (type === 'draw') {
        for (let i = 0; i < value; i++) NB.State.drawCard(side);
      } else if (type === 'ram') {
        const unit = actor.field[slot];
        if (effect.mixed && !actor.field.some(other => other && other !== unit && NB.Combat.overclockSynergy(unit, other))) continue;
        actor.ram += value;
        const node = NB.State.getSlotEl(side, slot);
        if (node) NB.Physics.spawnFloatText(node, `+${value} RAM · SINERGIA`, '#39FF14');
      } else {
        for (const target of targets(state, card, effect, side, slot)) {
          const node = NB.State.getSlotEl(target.side, target.slot);
          const label = adjustUnit(type, target.unit, value);
          if (type === 'destroy' || target.unit.def <= 0) NB.State.destroyUnit(target.side, target.slot, side === 'player' && target.side !== side);
          if (node) {
            NB.Physics.fireLaserBeam(caster, node, card.accent, 5);
            NB.Physics.spawnFloatText(node, label, card.accent);
          }
        }
      }
    }
  }

  function score(state, card, side, slot) {
    const actor = state[side];
    const opponent = state[opposing(side)];
    return card.effects.reduce((sum, effect) => {
      const { type, value } = effect;
      if (type === 'direct') return sum + (value >= opponent.hp ? 100 : value * 1.3);
      if (type === 'heal') return sum + Math.min(value, actor.maxHp - actor.hp) * 0.8;
      if (type === 'drain') return sum + Math.min(value, opponent.ram) * 1.4;
      if (type === 'draw') return sum + Math.min(value, NB.Cards.MAX_HAND - actor.hand.length + 1,
        actor.deck.length + actor.discard.length) * 2;
      return targets(state, card, effect, side, slot).reduce((total, { unit }) => {
        if (type === 'destroy') return total + 2 + (unit.atk + unit.def) * 0.6;
        if (type === 'damage') return total + Math.min(value, unit.def) + (value >= unit.def ? 3 : 0);
        if (type === 'repair') return total + Math.min(value, Math.max(0, unit.maxDef - unit.def));
        if (type === 'atk') return total + (value > 0 ? value * (unit.booting ? 0.7 : 1.3) : Math.min(-value, unit.atk));
        if (type === 'def') return total + value * 0.8;
        if (type === 'affinity') {
          const next = NB.Cards.AFFINITIES[unit.affinity]?.beats || 'pulso';
          const advantage = indexed(opponent.field).reduce((count, target) =>
            count + NB.Combat.affinityBonus({ ...unit, affinity: next }, target.unit) -
            NB.Combat.affinityBonus(unit, target.unit), 0);
          return total + advantage;
        }
        return total;
      }, sum);
    }, 0);
  }

  NB.CardEffects = { legalSlots, resolve, score };
})(window.NB = window.NB || {});
