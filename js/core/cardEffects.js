(function (NB) {
  'use strict';

  const opposing = side => side === 'player' ? 'enemy' : 'player';
  const selectedSide = (card, side) => card.targetType === 'enemy_unit' ? opposing(side) : side;
  const indexed = field => field.flatMap((unit, slot) => unit ? [{ unit, slot }] : []);

  function targets(state, card, effect, side, slot, selectedSlot = slot) {
    if (effect.target === 'self') {
      const unit = state[side].field[slot];
      return unit ? [{ unit, slot, side }] : [];
    }
    if (effect.target === 'selected') {
      const targetSide = selectedSide(card, side);
      const unit = state[targetSide].field[selectedSlot];
      return unit ? [{ unit, slot: selectedSlot, side: targetSide }] : [];
    }
    if (effect.target === 'strongestEnemy') {
      const enemy = opposing(side);
      const strongest = indexed(state[enemy].field).sort((a, b) => b.unit.atk - a.unit.atk)[0];
      return strongest ? [{ ...strongest, side: enemy }] : [];
    }
    if (effect.target === 'allies' || effect.target === 'enemies') {
      const targetSide = effect.target === 'allies' ? side : opposing(side);
      return indexed(state[targetSide].field).map(target => ({ ...target, side: targetSide }));
    }
    return [];
  }

  const isModifier = effect => (effect.type === 'atk' || effect.type === 'def') && effect.value > 0;
  const alreadyModified = (card, unit) => unit?.appliedModifiers?.includes(card.id) ?? false;

  function targetSlots(state, card, side) {
    return indexed(state[selectedSide(card, side)].field)
      .filter(({ unit }) => !card.targetAffinities || card.targetAffinities.includes(unit.affinity));
  }

  function hasModifiedTarget(state, card, side) {
    return (card.targetType === 'ally_unit' || card.targetType === 'enemy_unit') &&
      targetSlots(state, card, side).some(({ unit }) => alreadyModified(card, unit));
  }

  function legalSlots(state, card, side) {
    if (card.targetType === 'ally_unit' || card.targetType === 'enemy_unit') {
      return targetSlots(state, card, side).filter(({ unit }) => !alreadyModified(card, unit)).map(target => target.slot);
    }
    return !card.requiresEnemy || state[opposing(side)].field.some(Boolean) ? [null] : [];
  }

  const actorPanel = side => document.getElementById(side === 'player' ? 'player-hud' : 'enemy-panel');

  const unitDamage = (effect, unit) => effect.value +
    (effect.type === 'woundedDamage' && unit.def < unit.maxDef ? effect.bonus : 0);

  function adjustUnit(type, unit, value) {
    if (type === 'atk' && NB.Cards.hasKeyword(unit, 'GUARD_ONLY')) return 'SEM ATK';
    if ((type === 'def' || type === 'repair') && NB.Cards.hasKeyword(unit, 'ATTACK_ONLY')) return 'SEM DEF';
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
    if (type === 'blockLock') {
      unit.blockLock = true;
      return 'SEM BLOQUEIO';
    }
    if (type === 'affinity') {
      unit.affinity = NB.Cards.AFFINITIES[unit.affinity]?.beats || 'pulso';
      return NB.Cards.affinityLabel(unit.affinity);
    }
    return type === 'banish' ? 'FORA DA PARTIDA!' : 'ELIMINADO!';
  }

  function resonates(field, unit) {
    return Boolean(unit?.affinity && field.some(other => other && other !== unit && other.affinity === unit.affinity));
  }

  function attackPower(unit, field) {
    const effects = NB.Cards.CARD_DB[unit.cardId]?.onAttack || [];
    return effects.reduce((attack, effect) => attack +
      (effect.type === 'atk' && (!effect.resonance || resonates(field, unit)) ? effect.value : 0), unit.atk);
  }

  function recyclable(actor, effect) {
    return actor.discard.map((item, index) => ({ item, index })).filter(({ item }) =>
      (!effect.cardId || item.cardId === effect.cardId) &&
      (!effect.kind || NB.Cards.CARD_DB[item.cardId].kind === effect.kind));
  }

  function scanBonus(actor, side, effect) {
    const top = actor.deck.at(-1);
    return Number(Boolean(top && NB.State.getMatchAffinity(top.cardId, side) === effect.affinity));
  }

  const discardDamage = (actor, effect) => Math.min(effect.cap, Math.floor(actor.discard.length / effect.divisor));

  function resolve(card, effects, side, slot = null, selectedSlot = slot) {
    const state = NB.State.get();
    const actor = state[side];
    const enemy = opposing(side);
    const caster = actorPanel(side);
    const modified = new Set();
    for (const effect of effects) {
      const { type, value } = effect;
      if (effect.resonance && !resonates(actor.field, actor.field[slot])) continue;
      if (type === 'direct' || type === 'discardDamage') {
        const damage = type === 'direct' ? value : discardDamage(actor, effect);
        if (damage > 0) {
          NB.Physics.fireLaserBeam(caster, actorPanel(enemy), card.accent, 7);
          NB.State.applyDirectDamage(enemy, damage, side === 'player', card.name);
        }
      } else if (type === 'recycle') {
        const options = recyclable(actor, effect);
        if (!options.length || actor.hand.length >= NB.Cards.MAX_HAND) continue;
        const pick = effect.order === 'latest' ? options.at(-1) : options[Math.floor(Math.random() * options.length)];
        actor.hand.push(...actor.discard.splice(pick.index, 1));
        if (side === 'player') NB.Audio.playDraw();
      } else if (type === 'scan') {
        const top = actor.deck.at(-1);
        const bonus = scanBonus(actor, side, effect);
        NB.State.drawCard(side);
        if (bonus) NB.State.drawCard(side);
        if (top && side === 'player') NB.Physics.showToast(`VARREDURA · ${NB.Cards.CARD_DB[top.cardId].name}${bonus ? ' · COMPRA EXTRA' : ''}`, 'var(--cyan)');
      } else if (type === 'overclockCoupler') {
        actor.overclockCoupler = true;
      } else if (type === 'counterFormation') {
        actor.counterFormation = true;
      } else if (type === 'shieldBreak') {
        const removed = Math.min(value, state[enemy].hpShield);
        state[enemy].hpShield -= removed;
        if (removed) NB.State.reportImpact(enemy, actorPanel(enemy), `−${removed} ESCUDO`, card.name);
      } else if (type === 'hpShield') {
        const gained = Math.max(0, value - actor.hpShield);
        actor.hpShield = Math.max(actor.hpShield, value);
        if (gained) NB.State.reportImpact(side, caster, `+${gained} ESCUDO`, card.name, '#83e8f5');
      } else if (type === 'heal') {
        const healed = Math.min(value, actor.maxHp - actor.hp);
        actor.hp += healed;
        if (healed) NB.State.reportImpact(side, caster, `+${healed} HP`, card.name, '#9dffb6');
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
        for (const target of targets(state, card, effect, side, slot, selectedSlot)) {
          const appliesModifier = isModifier(effect);
          if (appliesModifier && alreadyModified(card, target.unit)) continue;
          const before = type === 'atk' ? target.unit.atk : target.unit.def;
          const node = NB.State.getSlotEl(target.side, target.slot);
          const damage = type === 'damage' || type === 'woundedDamage';
          const label = adjustUnit(damage ? 'damage' : type, target.unit,
            damage ? unitDamage(effect, target.unit) : value);
          const gone = damage && target.unit.def <= 0;
          const detail = [card.name, type === 'woundedDamage' && before < target.unit.maxDef ? 'Alvo avariado' : '',
            gone ? 'Destruída' : ''].filter(Boolean).join(' · ');
          NB.State.reportImpact(target.side, node, damage ? `−${Math.min(before, before - target.unit.def)} DEF` : label, detail, card.accent);
          if (appliesModifier && (type === 'atk' ? target.unit.atk : target.unit.def) > before) modified.add(target.unit);
          if (type === 'banish' || type === 'destroy' || gone) {
            NB.State.destroyUnit(target.side, target.slot, side === 'player' && target.side !== side, type === 'banish');
          }
          if (node) {
            NB.Physics.fireLaserBeam(caster, node, card.accent, 5);
          }
        }
      }
    }
    for (const unit of modified) (unit.appliedModifiers ??= []).push(card.id);
  }

  function score(state, card, side, slot) {
    const actor = state[side];
    const opponent = state[opposing(side)];
    const handRoom = NB.Cards.MAX_HAND - actor.hand.length + 1;
    const drawn = actor.deck.length + actor.discard.length;
    return (card.effects || card.onDeploy || []).reduce((sum, effect) => {
      const { type, value } = effect;
      if (effect.resonance && !resonates(actor.field, card)) return sum;
      if (effect.target === 'self') return sum + value;
      if (type === 'recycle') return sum + (handRoom > 0 && recyclable(actor, effect).length ? 3 : 0);
      if (type === 'scan') return sum + Math.min(1 + scanBonus(actor, side, effect), handRoom, drawn) * 2;
      if (type === 'direct' || type === 'discardDamage') {
        const damage = type === 'direct' ? value : discardDamage(actor, effect);
        return sum + (damage >= opponent.hp ? 100 : damage * 1.3);
      }
      if (type === 'overclockCoupler') {
        const ready = actor.field.filter(unit => NB.Combat.canAttack(unit, actor.field));
        return sum + (!actor.overclockCoupler && (side === 'player' || state.boss?.canOverclock) &&
          actor.ram >= card.cost + NB.Combat.overclockCost(actor) &&
          ready.some(unit => unit.affinity) && ready.some(unit => !unit.affinity) &&
          opponent.field.some(unit => NB.Combat.canBlock(unit, opponent)) ? 1 : 0);
      }
      if (type === 'counterFormation') {
        const candidates = actor.field.filter(unit => NB.Combat.canAttack(unit, actor.field) &&
          NB.Combat.canBlock(unit, actor) && !NB.Cards.hasKeyword(unit, 'VIGILANCE'));
        return sum + (!actor.counterFormation && opponent.field.some(Boolean) ? candidates.length * 1.5 : 0);
      }
      if (type === 'shieldBreak') return sum + Math.min(value, opponent.hpShield) * 0.8;
      if (type === 'hpShield') return sum + (opponent.field.some(Boolean) ? Math.max(0, value - actor.hpShield) : 0);
      if (type === 'heal') return sum + Math.min(value, actor.maxHp - actor.hp) * 0.8;
      if (type === 'drain') return sum + Math.min(value, opponent.ram) * 1.4;
      if (type === 'draw') return sum + Math.min(value, NB.Cards.MAX_HAND - actor.hand.length + 1,
        actor.deck.length + actor.discard.length) * 2;
      return targets(state, card, effect, side, slot).reduce((total, { unit }) => {
        if (isModifier(effect) && alreadyModified(card, unit)) return total;
        if (type === 'destroy' || type === 'banish') return total + 2 + (unit.atk + unit.def) * 0.6;
        if (type === 'damage' || type === 'woundedDamage') {
          const damage = unitDamage(effect, unit);
          return total + Math.min(damage, unit.def) + (damage >= unit.def ? 3 : 0);
        }
        if (type === 'blockLock') return total + (NB.Combat.canBlock(unit, opponent) ? 1.5 + unit.def * 0.45 : 0);
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

  NB.CardEffects = { legalSlots, hasModifiedTarget, alreadyModified, resolve, score, attackPower };
})(window.NB = window.NB || {});
