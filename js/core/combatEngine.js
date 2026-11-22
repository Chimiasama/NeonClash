(function (NB) {
  'use strict';

  function canAttack(unit, field) {
    return Boolean(unit && !unit.booting && !unit.attacked &&
      !NB.Cards.hasKeyword(unit, 'GUARD_ONLY') && NB.CardEffects.attackPower(unit, field) > 0);
  }

  function canBlock(unit, actor) {
    return Boolean(unit && unit.def > 0 && !unit.blockLock && !NB.Cards.hasKeyword(unit, 'ATTACK_ONLY') &&
      (!unit.attacked || unit.overclockGuard || actor.counterFormation || NB.Cards.hasKeyword(unit, 'VIGILANCE')));
  }

  function blockLimit(unit) {
    return NB.Cards.CARD_DB[unit?.cardId]?.blockLimit ?? 1;
  }

  function blocksAssigned(blockMap, slot) {
    return Object.values(blockMap).filter(value => value === slot).length;
  }

  function hasBlockRoom(unit, actor, blockMap, slot) {
    return canBlock(unit, actor) && blocksAssigned(blockMap, slot) < blockLimit(unit);
  }

  function legalBlocks(attackers, map, actor) {
    const legal = {};
    for (const attacker of attackers) {
      const slot = map[attacker];
      if (hasBlockRoom(actor.field[slot], actor, legal, slot)) legal[attacker] = slot;
    }
    return legal;
  }

  function clashAffinity(attacker, defender, field) {
    return {
      attack: affinityBonus({ ...attacker, atk: NB.CardEffects.attackPower(attacker, field) }, defender),
      counter: affinityBonus(defender, attacker)
    };
  }

  function affinityBonus(attacker, defender) {
    return Number(attacker.atk > 0 && Boolean(defender.affinity)
      && NB.Cards.AFFINITIES[attacker.affinity]?.beats === defender.affinity);
  }

  function overclockSynergy(first, second) {
    return Number(Boolean(first.affinity && second.affinity && first.affinity !== second.affinity));
  }

  function overclockDamage(base, first, second, blocked, coupled = false) {
    if (!blocked) return base + 1;
    const neutralPair = Boolean(first.affinity) !== Boolean(second.affinity);
    return base + (coupled && neutralPair ? 1 : overclockSynergy(first, second));
  }

  function overclockCounterTarget(leader, partner) {
    return NB.Cards.CARD_DB[partner.cardId].overclock?.escort ? partner : leader;
  }

  function overclockCounter(leader, blocker) {
    return Math.max(0, blocker.atk - (NB.Cards.CARD_DB[leader.cardId].overclock?.counterReduction || 0));
  }

  function finishOverclockBonus(actor, leader, partner, destroyedBlocker) {
    if (NB.Cards.CARD_DB[partner.cardId].overclock?.partnerBlock) partner.overclockGuard = true;
    const refund = NB.Cards.CARD_DB[leader.cardId].overclock?.refund;
    if (destroyedBlocker && refund && !actor.overclockRefunded) {
      actor.ram += refund;
      actor.overclockRefunded = true;
      NB.Physics.showToast(`RECUPERADOR · +${refund} RAM`, 'var(--ram)');
    }
  }

  function clashDamage(attacker, defender, attackingField) {
    const atk = attackingField ? NB.CardEffects.attackPower(attacker, attackingField) : attacker.atk;
    return atk + affinityBonus({ ...attacker, atk }, defender);
  }

  function reportDefenseHit(side, node, damage, hpBefore, reasons = []) {
    if (damage <= 0) return;
    const detail = [...reasons, damage >= hpBefore ? 'Destruída' : ''].filter(Boolean).join(' · ');
    NB.State.reportImpact(side, node, `−${Math.min(hpBefore, damage)} DEF`, detail);
  }

  const affinityCause = (unit, bonus) => bonus ? `+1 ${NB.Cards.AFFINITIES[unit.affinity].name}` : '';

  /* Motor de Combate:
     - Choques simultâneos (ATK vs DEF), destruição com partículas
     - Palavras-chave [FIREWALL], [VÍRUS] (-2 ATK) e [DRENO] (rouba 1 RAM)
     - OVERCLOCK (Unite Attack): 2 unidades prontas + 3 RAM -> ataque combinado com PERFURAÇÃO */
  async function resolveCombatSequence(attackerSide, attackerSlots, blockMap) {
    const state = NB.State.get();
    state.phase = 'COMBAT_ANIM';
    const defenderSide = attackerSide === 'player' ? 'enemy' : 'player';
    NB.UI.renderAll();
    blockMap = legalBlocks(attackerSlots, blockMap, state[defenderSide]);
    NB.Physics.drawDefenseLasers(attackerSide, blockMap);

    for (const atkSlot of attackerSlots) {
      if (NB.State.checkWinCondition()) return;
      const attacker = state[attackerSide].field[atkSlot];
      if (!canAttack(attacker, state[attackerSide].field)) continue;

      const defSlot = blockMap[atkSlot];
      const defender = defSlot !== undefined ? state[defenderSide].field[defSlot] : null;
      const atkEl = NB.State.getSlotEl(attackerSide, atkSlot)?.querySelector('.field-card');

      NB.Audio.playAttack();
      if (atkEl) {
        atkEl.classList.add(attackerSide === 'player' ? 'anim-lunge-up' : 'anim-lunge-down');
      }
      if (!(await NB.State.wait(220))) return;

      if (defender) {
        const defEl = NB.State.getSlotEl(defenderSide, defSlot)?.querySelector('.field-card');
        if (defEl) defEl.classList.add('anim-hit');
        if (atkEl) atkEl.classList.add('anim-hit');

        const attack = NB.CardEffects.attackPower(attacker, state[attackerSide].field);
        const atkDmg = clashDamage(attacker, defender, state[attackerSide].field);
        const atkBonus = atkDmg - attack;
        const defBonus = affinityBonus(defender, attacker);
        const defDmg = clashDamage(defender, attacker);
        defender.def -= atkDmg;
        attacker.def -= defDmg;

        NB.Audio.playClash();
        const heavyHit = atkDmg >= 4 || defDmg >= 4;
        NB.Physics.shakeScreen(heavyHit);
        if (heavyHit) NB.Physics.vibrateDamage();

        const defSlotEl = NB.State.getSlotEl(defenderSide, defSlot);
        const atkSlotEl = NB.State.getSlotEl(attackerSide, atkSlot);
        if (defSlotEl) {
          const p = NB.Physics.getElCenterInShell(defSlotEl);
          NB.Physics.spawnBurst(p.x, p.y, '#FFB800', heavyHit ? 26 : 18);
        }
        reportDefenseHit(defenderSide, defSlotEl, atkDmg, defender.def + atkDmg,
          [affinityCause(attacker, atkBonus), attack > attacker.atk ? `+${attack - attacker.atk} Ressonância` : '']);
        reportDefenseHit(attackerSide, atkSlotEl, defDmg, attacker.def + defDmg, [affinityCause(defender, defBonus)]);

        // [VÍRUS]: Ao causar dano a unidade inimiga, reduz permanentemente o ATK dela em -2
        if (atkDmg > 0 && NB.Cards.hasKeyword(attacker, 'VIRUS') && defender.def > 0) {
          NB.State.applyVirusDebuff(defenderSide, defSlot);
        }
        if (defDmg > 0 && NB.Cards.hasKeyword(defender, 'VIRUS') && attacker.def > 0) {
          NB.State.applyVirusDebuff(attackerSide, atkSlot);
        }

        NB.UI.renderAll();
        if (!(await NB.State.wait(340))) return;

        if (defender.def <= 0) {
          NB.State.destroyUnit(defenderSide, defSlot, attackerSide === 'player');
        }
        if (attacker.def <= 0) {
          NB.State.destroyUnit(attackerSide, atkSlot, defenderSide === 'player');
        } else {
          attacker.attacked = true;
        }
        NB.UI.renderAll();
      } else {
        // Ataque direto ao HP do hacker!
        const attack = NB.CardEffects.attackPower(attacker, state[attackerSide].field);
        const hpDamage = NB.State.applyDirectDamage(defenderSide, attack, attackerSide === 'player',
          attack > attacker.atk ? `+${attack - attacker.atk} Ressonância` : '');
        attacker.attacked = true;

        // [DRENO]: Ao causar dano direto ao HP do hacker inimigo, rouba 1 RAM dele
        if (hpDamage > 0 && NB.Cards.hasKeyword(attacker, 'DRENO')) {
          NB.State.applyRamDrain(attackerSide, 1);
          NB.UI.renderAll();
        }

        if (NB.State.checkWinCondition()) return;
      }

      if (!(await NB.State.wait(320))) return;
    }

    NB.Physics.clearLasers();
  }

  /* OVERCLOCK (Unite Attack):
     - Gasta 3 RAM
     - Soma o ATK de 2 unidades prontas em um ataque combinado único
     - Possui PERFURAÇÃO: dano excedente à DEF do bloqueador vai direto no HP do hacker inimigo */
  function overclockCost(actor) {
    return NB.Cards.OVERCLOCK_COST - (actor.overclockDiscount || 0);
  }

  async function executeOverclockAttack() {
    const state = NB.State.get();
    if (state.phase !== 'PLAYER_OVERCLOCK' || state.overclockUnits.length !== 2) return;
    const cost = overclockCost(state.player);
    if (state.player.ram < cost) return;

    const [slotA, slotB] = state.overclockUnits;
    const unitA = state.player.field[slotA];
    const unitB = state.player.field[slotB];
    if (slotA === slotB || !canAttack(unitA, state.player.field) || !canAttack(unitB, state.player.field)) return;

    state.player.ram -= cost;
    state.player.overclockDiscount = 0;
    const coupled = state.player.overclockCoupler;
    state.player.overclockCoupler = false;
    state.overclockUnits = [];
    state.phase = 'COMBAT_ANIM';

    const combinedAtk = [unitA, unitB].reduce((sum, unit) => sum + NB.CardEffects.attackPower(unit, state.player.field), 0);
    const hasVirus = NB.Cards.hasKeyword(unitA, 'VIRUS') || NB.Cards.hasKeyword(unitB, 'VIRUS');
    const hasDreno = NB.Cards.hasKeyword(unitA, 'DRENO') || NB.Cards.hasKeyword(unitB, 'DRENO');

    NB.Audio.playOverclock();
    NB.Physics.vibrateOverclock();
    NB.Physics.shakeScreen(true);
    NB.Physics.showToast(`⚡ OVERCLOCK! ATK COMBINADO: ${combinedAtk}`, 'var(--ram)');
    NB.UI.renderAll();

    const slotElA = NB.State.getSlotEl('player', slotA);
    const slotElB = NB.State.getSlotEl('player', slotB);
    const playerHud = document.getElementById('player-hud');
    NB.Physics.spawnFloatText(playerHud, `-${cost} RAM`, '#39FF14');
    NB.Physics.drawOverclockLink(slotA, slotB);

    if (slotElA && slotElB) {
      const pA = NB.Physics.getElCenterInShell(slotElA);
      const pB = NB.Physics.getElCenterInShell(slotElB);
      NB.Physics.spawnBurst(pA.x, pA.y, '#39FF14', 22);
      NB.Physics.spawnBurst(pB.x, pB.y, '#00F0FF', 22);
      NB.Physics.spawnShockwave((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, '#39FF14', 82);
    }

    if (!(await NB.State.wait(440))) return;

    // Investida sincronizada das duas unidades
    const cardElA = slotElA?.querySelector('.field-card');
    const cardElB = slotElB?.querySelector('.field-card');
    if (cardElA) cardElA.classList.add('anim-unite-lunge');
    if (cardElB) cardElB.classList.add('anim-unite-lunge');

    // IA escolhe se bloqueia o Overclock (prioriza [FIREWALL] obrigatoriamente)
    const directDamage = overclockDamage(combinedAtk, unitA, unitB, false);
    const blockerSlot = NB.AI.pickOverclockBlocker(combinedAtk, directDamage);
    const enemyPanel = document.getElementById('enemy-panel');

    if (blockerSlot !== -1) {
      const blocker = state.enemy.field[blockerSlot];
      const blockerSlotEl = NB.State.getSlotEl('enemy', blockerSlot);
      NB.Physics.fireLaserBeam(slotElA, blockerSlotEl, '#39FF14', 8);
      NB.Physics.fireLaserBeam(slotElB, blockerSlotEl, '#00F0FF', 8);

      if (!(await NB.State.wait(220))) return;

      const blockerDefBefore = blocker.def;
      const damage = overclockDamage(combinedAtk, unitA, unitB, true, coupled);
      const synergy = damage > combinedAtk;
      const overflowDmg = Math.max(0, damage - blockerDefBefore);

      blocker.def -= damage;
      // Contra-ataque do bloqueador atinge a unidade líder (unitA)
      const counterTarget = overclockCounterTarget(unitA, unitB);
      const escorted = counterTarget === unitB;
      const counterSlot = escorted ? slotB : slotA;
      const counterEl = escorted ? slotElB : slotElA;
      const counterDmg = overclockCounter(counterTarget, blocker);
      counterTarget.def -= counterDmg;

      NB.Audio.playClash();
      NB.Physics.shakeScreen(true);
      NB.Physics.vibrateDamage();

      reportDefenseHit('enemy', blockerSlotEl, damage, blockerDefBefore, [synergy ? '+1 Sinergia' : 'Overclock']);
      if (escorted) NB.Physics.fireLaserBeam(blockerSlotEl, counterEl, '#70e9ed', 4);
      reportDefenseHit('player', counterEl, counterDmg, counterTarget.def + counterDmg,
        [escorted ? 'Escolta protegeu a líder' : blocker.atk > counterDmg ? 'Âncora reduziu o contra-ataque' : 'Contra-ataque']);

      if (hasVirus && blocker.def > 0) NB.State.applyVirusDebuff('enemy', blockerSlot);
      if (counterDmg > 0 && NB.Cards.hasKeyword(blocker, 'VIRUS') && counterTarget.def > 0) {
        NB.State.applyVirusDebuff('player', counterSlot);
      }

      NB.UI.renderAll();
      if (!(await NB.State.wait(360))) return;

      finishOverclockBonus(state.player, unitA, unitB, blocker.def <= 0);
      if (blocker.def <= 0) {
        NB.State.destroyUnit('enemy', blockerSlot, true);
      }
      if (unitA.def <= 0) {
        NB.State.destroyUnit('player', slotA, false);
      } else {
        unitA.attacked = true;
      }
      if (unitB.def <= 0 || NB.Cards.hasKeyword(unitB, 'ATTACK_ONLY')) {
        if (NB.Cards.hasKeyword(unitB, 'ATTACK_ONLY')) {
          NB.State.reportImpact('player', slotElB, 'DESTRUÍDA', 'Só Ataque');
        }
        NB.State.destroyUnit('player', slotB, false);
      } else {
        unitB.attacked = true;
      }
      NB.UI.renderAll();

      // PERFURAÇÃO: dano excedente atravessa direto para o HP de VEX!
      if (overflowDmg > 0 && !NB.State.checkWinCondition()) {
        if (!(await NB.State.wait(240))) return;
        NB.Audio.playLaser();
        NB.Physics.fireLaserBeam(blockerSlotEl, enemyPanel, '#FFB800', 9);
        const hpDamage = NB.State.applyDirectDamage('enemy', overflowDmg, true, synergy ? 'Perfuração · +1 Sinergia' : 'Perfuração');
        if (hasDreno && hpDamage > 0) {
          NB.State.applyRamDrain('player', 1);
          NB.UI.renderAll();
        }
      }
    } else {
      // Sem bloqueio: impacto direto combinado no HP de VEX!
      NB.Physics.fireLaserBeam(slotElA, enemyPanel, '#39FF14', 9);
      NB.Physics.fireLaserBeam(slotElB, enemyPanel, '#00F0FF', 9);
      if (!(await NB.State.wait(240))) return;

      finishOverclockBonus(state.player, unitA, unitB, false);
      const hpDamage = NB.State.applyDirectDamage('enemy', directDamage, true, '+1 Overclock sem bloqueio');
      if (hasDreno && hpDamage > 0) {
        NB.State.applyRamDrain('player', 1);
        NB.UI.renderAll();
      }
      unitA.attacked = true;
      unitB.attacked = true;
    }

    NB.Physics.clearLasers();
    if (NB.State.checkWinCondition()) return;
    if (!(await NB.State.wait(420))) return;

    // Se ainda sobrar uma 3ª unidade pronta no campo, permite continuar na Fase de Ataque
    const stillReady = state.player.field.some(u => canAttack(u, state.player.field));
    if (stillReady) {
      state.phase = 'PLAYER_ATTACK';
      state.selectedAttackers = [];
      NB.UI.renderAll();
    } else {
      NB.AI.startEnemyTurn();
    }
  }

  async function confirmPlayerAttack() {
    const state = NB.State.get();
    if (state.phase !== 'PLAYER_ATTACK') return;
    const attackers = [...new Set(state.selectedAttackers)].filter(slot => canAttack(state.player.field[slot], state.player.field));
    if (attackers.length === 0) {
      NB.AI.startEnemyTurn();
      return;
    }
    state.selectedAttackers = [];
    const aiBlocks = NB.AI.computeAiBlocks(attackers);
    const bossName = state.boss ? state.boss.name : 'INIMIGO';

    if (Object.keys(aiBlocks).length > 0) {
      NB.Physics.showToast(`${bossName} INTERCEPTOU O ATAQUE!`, 'var(--magenta)');
      if (!(await NB.State.wait(420))) return;
    }

    await resolveCombatSequence('player', attackers, aiBlocks);
    if (state.phase === 'GAME_OVER') return;
    NB.AI.startEnemyTurn();
  }

  async function resolveEnemyOverclockDefense(enemyOverclock, blockMap) {
    const state = NB.State.get();
    state.phase = 'COMBAT_ANIM';
    const [slotA, slotB] = enemyOverclock.slots;
    const unitA = state.enemy.field[slotA];
    const unitB = state.enemy.field[slotB];
    const combinedAtk = enemyOverclock.combinedAtk;
    const coupled = state.enemy.overclockCoupler;
    state.enemy.overclockCoupler = false;

    if (!unitA || !unitB) return;

    const slotElA = NB.State.getSlotEl('enemy', slotA);
    const slotElB = NB.State.getSlotEl('enemy', slotB);
    const playerHud = document.getElementById('player-hud');

    const cardElA = slotElA?.querySelector('.field-card');
    const cardElB = slotElB?.querySelector('.field-card');
    if (cardElA) cardElA.classList.add('anim-lunge-down');
    if (cardElB) cardElB.classList.add('anim-lunge-down');

    const hasVirus = NB.Cards.hasKeyword(unitA, 'VIRUS') || NB.Cards.hasKeyword(unitB, 'VIRUS');
    const hasDreno = NB.Cards.hasKeyword(unitA, 'DRENO') || NB.Cards.hasKeyword(unitB, 'DRENO');

    const defSlot = blockMap[slotA];
    const blocker = defSlot !== undefined ? state.player.field[defSlot] : null;

    if (canBlock(blocker, state.player)) {
      const defSlotEl = NB.State.getSlotEl('player', defSlot);
      NB.Physics.fireLaserBeam(slotElA, defSlotEl, '#FF0055', 8);
      NB.Physics.fireLaserBeam(slotElB, defSlotEl, '#FFB800', 8);
      if (!(await NB.State.wait(220))) return;

      const blockerDefBefore = blocker.def;
      const damage = overclockDamage(combinedAtk, unitA, unitB, true, coupled);
      const synergy = damage > combinedAtk;
      const overflowDmg = Math.max(0, damage - blockerDefBefore);
      blocker.def -= damage;
      const counterTarget = overclockCounterTarget(unitA, unitB);
      const escorted = counterTarget === unitB;
      const counterSlot = escorted ? slotB : slotA;
      const counterEl = escorted ? slotElB : slotElA;
      const counterDmg = overclockCounter(counterTarget, blocker);
      counterTarget.def -= counterDmg;

      NB.Audio.playClash();
      NB.Physics.shakeScreen(true);
      NB.Physics.vibrateDamage();

      reportDefenseHit('player', defSlotEl, damage, blockerDefBefore, [synergy ? '+1 Sinergia' : 'Overclock']);
      if (escorted) NB.Physics.fireLaserBeam(defSlotEl, counterEl, '#70e9ed', 4);
      reportDefenseHit('enemy', counterEl, counterDmg, counterTarget.def + counterDmg,
        [escorted ? 'Escolta protegeu a líder' : blocker.atk > counterDmg ? 'Âncora reduziu o contra-ataque' : 'Contra-ataque']);

      if (hasVirus && blocker.def > 0) NB.State.applyVirusDebuff('player', defSlot);
      if (counterDmg > 0 && NB.Cards.hasKeyword(blocker, 'VIRUS') && counterTarget.def > 0) {
        NB.State.applyVirusDebuff('enemy', counterSlot);
      }

      NB.UI.renderAll();
      if (!(await NB.State.wait(360))) return;

      finishOverclockBonus(state.enemy, unitA, unitB, blocker.def <= 0);
      if (blocker.def <= 0) {
        NB.State.destroyUnit('player', defSlot, false);
      }
      if (unitA.def <= 0) {
        NB.State.destroyUnit('enemy', slotA, true);
      } else {
        unitA.attacked = true;
      }
      if (unitB.def <= 0 || NB.Cards.hasKeyword(unitB, 'ATTACK_ONLY')) {
        if (NB.Cards.hasKeyword(unitB, 'ATTACK_ONLY')) {
          NB.State.reportImpact('enemy', slotElB, 'DESTRUÍDA', 'Só Ataque');
        }
        NB.State.destroyUnit('enemy', slotB, true);
      } else {
        unitB.attacked = true;
      }
      NB.UI.renderAll();

      if (overflowDmg > 0 && !NB.State.checkWinCondition()) {
        if (!(await NB.State.wait(240))) return;
        NB.Audio.playLaser();
        NB.Physics.fireLaserBeam(defSlotEl, playerHud, '#FFB800', 9);
        const hpDamage = NB.State.applyDirectDamage('player', overflowDmg, false, synergy ? 'Perfuração · +1 Sinergia' : 'Perfuração');
        if (hasDreno && hpDamage > 0) {
          NB.State.applyRamDrain('enemy', 1);
          NB.UI.renderAll();
        }
      }
    } else {
      finishOverclockBonus(state.enemy, unitA, unitB, false);
      NB.Physics.fireLaserBeam(slotElA, playerHud, '#FF0055', 9);
      NB.Physics.fireLaserBeam(slotElB, playerHud, '#FFB800', 9);
      if (!(await NB.State.wait(240))) return;
      const hpDamage = NB.State.applyDirectDamage('player', overclockDamage(combinedAtk, unitA, unitB, false), false, '+1 Overclock sem bloqueio');
      if (hasDreno && hpDamage > 0) {
        NB.State.applyRamDrain('enemy', 1);
        NB.UI.renderAll();
      }
      unitA.attacked = true;
      unitB.attacked = true;
    }

    NB.Physics.clearLasers();
    await NB.State.wait(360);
  }

  function preparePlayerDefense(attackers) {
    const state = NB.State.get();
    state.enemyAttackers = attackers;
    state.defenseDeclined = false;
    state.defenseMap = {};
    state.activeDefenderSlot = null;
    const eligible = state.player.field.flatMap((unit, slot) => canBlock(unit, state.player) ? [slot] : []);
    const firewalls = eligible.filter(slot => NB.Cards.hasKeyword(state.player.field[slot], 'FIREWALL'));
    attackers.forEach((attacker, index) => {
      if (firewalls[index] !== undefined) state.defenseMap[attacker] = firewalls[index];
    });
    if (eligible.length === 1 && !firewalls.length) {
      if (attackers.length === 1) state.defenseMap[attackers[0]] = eligible[0];
      else state.activeDefenderSlot = eligible[0];
    }
    assignFirewallBlocks(state);
    state.phase = 'PLAYER_DEFENSE';
  }

  function assignFirewallBlocks(state) {
    if (state.defenseDeclined) return;
    for (const attacker of state.enemyAttackers) {
      if (state.defenseMap[attacker] !== undefined) continue;
      const slot = state.player.field.findIndex((unit, index) => NB.Cards.hasKeyword(unit, 'FIREWALL') &&
        hasBlockRoom(unit, state.player, state.defenseMap, index));
      if (slot !== -1) state.defenseMap[attacker] = slot;
    }
  }

  async function confirmPlayerDefense() {
    const state = NB.State.get();
    if (state.phase !== 'PLAYER_DEFENSE') return;

    state.defenseMap = legalBlocks(state.enemyAttackers, state.defenseMap, state.player);
    const hasFreeDefender = state.player.field.some((unit, slot) =>
      hasBlockRoom(unit, state.player, state.defenseMap, slot));

    const unblockedEnemyFirewall = state.enemyAttackers.find(eSlot => {
      const eu = state.enemy.field[eSlot];
      return eu && NB.Cards.hasKeyword(eu, 'FIREWALL') && state.defenseMap[eSlot] === undefined;
    });

    if (unblockedEnemyFirewall !== undefined && hasFreeDefender) {
      NB.Physics.showToast('🛡 BLOQUEIE O FIREWALL INIMIGO PRIMEIRO!', 'var(--amber)');
      NB.Physics.vibrateCard();
      return;
    }

    const marked = Object.keys(state.defenseMap).length;
    assignFirewallBlocks(state);
    if (Object.keys(state.defenseMap).length > marked) {
      NB.Physics.showToast('🛡 SEU FIREWALL INTERCEPTOU O ATAQUE!', 'var(--cyan)');
      NB.Physics.drawDefenseLasers('enemy', state.defenseMap);
      if (!(await NB.State.wait(360))) return;
    }

    const attackers = [...state.enemyAttackers];
    const blockMap = { ...state.defenseMap };
    const enemyOc = state.enemyOverclock;
    state.enemyAttackers = [];
    state.defenseMap = {};
    state.enemyOverclock = null;
    state.activeDefenderSlot = null;

    if (enemyOc) {
      await resolveEnemyOverclockDefense(enemyOc, blockMap);
    } else {
      await resolveCombatSequence('enemy', attackers, blockMap);
    }

    if (state.phase === 'GAME_OVER') return;
    NB.Input.startPlayerTurn();
  }

  NB.Combat = {
    canAttack,
    canBlock,
    blockLimit,
    hasBlockRoom,
    clashAffinity,
    affinityBonus,
    clashDamage,
    overclockSynergy,
    overclockDamage,
    overclockCost,
    overclockCounter,
    overclockCounterTarget,
    resolveCombatSequence,
    executeOverclockAttack,
    confirmPlayerAttack,
    preparePlayerDefense,
    confirmPlayerDefense
  };
})(window.NB = window.NB || {});
