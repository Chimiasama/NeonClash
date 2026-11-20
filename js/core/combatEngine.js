(function (NB) {
  'use strict';

  /* Motor de Combate:
     - Choques simultâneos (ATK vs DEF), destruição com partículas
     - Palavras-chave [FIREWALL], [VÍRUS] (-2 ATK) e [DRENO] (rouba 1 RAM)
     - OVERCLOCK (Unite Attack): 2 unidades prontas + 3 RAM -> ataque combinado com PERFURAÇÃO */
  async function resolveCombatSequence(attackerSide, attackerSlots, blockMap) {
    const state = NB.State.get();
    state.phase = 'COMBAT_ANIM';
    const defenderSide = attackerSide === 'player' ? 'enemy' : 'player';
    NB.UI.renderAll();
    NB.Physics.drawDefenseLasers(attackerSide, blockMap);

    for (const atkSlot of attackerSlots) {
      if (NB.State.checkWinCondition()) return;
      const attacker = state[attackerSide].field[atkSlot];
      if (!attacker) continue;

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

        const atkDmg = attacker.atk;
        const defDmg = defender.atk;
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
          NB.Physics.spawnFloatText(defSlotEl, `-${atkDmg}`, '#FFB800');
        }
        if (atkSlotEl) {
          NB.Physics.spawnFloatText(atkSlotEl, `-${defDmg}`, '#FF0055');
        }

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
          if (defSlotEl) NB.Physics.spawnFloatText(defSlotEl, 'DESTRUÍDO!', '#FF0055');
        }
        if (attacker.def <= 0) {
          NB.State.destroyUnit(attackerSide, atkSlot, defenderSide === 'player');
          if (atkSlotEl) NB.Physics.spawnFloatText(atkSlotEl, 'DESTRUÍDO!', '#FF0055');
        } else {
          attacker.attacked = true;
        }
        NB.UI.renderAll();
      } else {
        // Ataque direto ao HP do hacker!
        NB.State.applyDirectDamage(defenderSide, attacker.atk, attackerSide === 'player');
        attacker.attacked = true;

        // [DRENO]: Ao causar dano direto ao HP do hacker inimigo, rouba 1 RAM dele
        if (attacker.atk > 0 && NB.Cards.hasKeyword(attacker, 'DRENO')) {
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
  async function executeOverclockAttack() {
    const state = NB.State.get();
    if (state.phase !== 'PLAYER_OVERCLOCK' || state.overclockUnits.length !== 2) return;
    if (state.player.ram < NB.Cards.OVERCLOCK_COST) return;

    const [slotA, slotB] = state.overclockUnits;
    const unitA = state.player.field[slotA];
    const unitB = state.player.field[slotB];
    if (!unitA || !unitB) return;

    // Deduz 3 RAM
    state.player.ram -= NB.Cards.OVERCLOCK_COST;
    state.overclockUnits = [];
    state.phase = 'COMBAT_ANIM';

    const combinedAtk = unitA.atk + unitB.atk;
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
    NB.Physics.spawnFloatText(playerHud, `-${NB.Cards.OVERCLOCK_COST} RAM`, '#39FF14');
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
    const blockerSlot = NB.AI.pickOverclockBlocker(combinedAtk);
    const enemyPanel = document.getElementById('enemy-panel');

    if (blockerSlot !== -1) {
      const blocker = state.enemy.field[blockerSlot];
      const blockerSlotEl = NB.State.getSlotEl('enemy', blockerSlot);
      NB.Physics.fireLaserBeam(slotElA, blockerSlotEl, '#39FF14', 8);
      NB.Physics.fireLaserBeam(slotElB, blockerSlotEl, '#00F0FF', 8);

      if (!(await NB.State.wait(220))) return;

      const blockerDefBefore = blocker.def;
      const overflowDmg = Math.max(0, combinedAtk - blockerDefBefore);

      blocker.def -= combinedAtk;
      // Contra-ataque do bloqueador atinge a unidade líder (unitA)
      const counterDmg = blocker.atk;
      unitA.def -= counterDmg;

      NB.Audio.playClash();
      NB.Physics.shakeScreen(true);
      NB.Physics.vibrateDamage();

      if (blockerSlotEl) {
        const bCard = blockerSlotEl.querySelector('.field-card');
        if (bCard) bCard.classList.add('anim-hit');
        NB.Physics.spawnFloatText(blockerSlotEl, `-${combinedAtk}`, '#39FF14');
      }
      if (slotElA && counterDmg > 0) {
        NB.Physics.spawnFloatText(slotElA, `-${counterDmg}`, '#FF0055');
      }

      if (hasVirus && blocker.def > 0) {
        NB.State.applyVirusDebuff('enemy', blockerSlot);
      }
      if (counterDmg > 0 && NB.Cards.hasKeyword(blocker, 'VIRUS') && unitA.def > 0) {
        NB.State.applyVirusDebuff('player', slotA);
      }

      NB.UI.renderAll();
      if (!(await NB.State.wait(360))) return;

      if (blocker.def <= 0) {
        NB.State.destroyUnit('enemy', blockerSlot, true);
        if (blockerSlotEl) NB.Physics.spawnFloatText(blockerSlotEl, 'DESTRUÍDO!', '#FF0055');
      }
      if (unitA.def <= 0) {
        NB.State.destroyUnit('player', slotA, false);
        if (slotElA) NB.Physics.spawnFloatText(slotElA, 'DESTRUÍDO!', '#FF0055');
      } else {
        unitA.attacked = true;
      }
      unitB.attacked = true;
      NB.UI.renderAll();

      // PERFURAÇÃO: dano excedente atravessa direto para o HP de VEX!
      if (overflowDmg > 0 && !NB.State.checkWinCondition()) {
        if (!(await NB.State.wait(240))) return;
        NB.Audio.playLaser();
        NB.Physics.fireLaserBeam(blockerSlotEl, enemyPanel, '#FFB800', 9);
        NB.Physics.showToast(`PERFURAÇÃO! -${overflowDmg} HP DIRETO`, 'var(--amber)');
        NB.State.applyDirectDamage('enemy', overflowDmg, true, 'PERFURAÇÃO ');
        if (hasDreno) {
          NB.State.applyRamDrain('player', 1);
          NB.UI.renderAll();
        }
      }
    } else {
      // Sem bloqueio: impacto direto combinado no HP de VEX!
      NB.Physics.fireLaserBeam(slotElA, enemyPanel, '#39FF14', 9);
      NB.Physics.fireLaserBeam(slotElB, enemyPanel, '#00F0FF', 9);
      if (!(await NB.State.wait(240))) return;

      NB.State.applyDirectDamage('enemy', combinedAtk, true, 'OVERCLOCK ');
      if (hasDreno) {
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
    const stillReady = state.player.field.some(u => u && !u.booting && !u.attacked);
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
    if (state.selectedAttackers.length === 0) {
      NB.AI.startEnemyTurn();
      return;
    }
    const attackers = [...state.selectedAttackers];
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

    if (blocker) {
      const defSlotEl = NB.State.getSlotEl('player', defSlot);
      NB.Physics.fireLaserBeam(slotElA, defSlotEl, '#FF0055', 8);
      NB.Physics.fireLaserBeam(slotElB, defSlotEl, '#FFB800', 8);
      if (!(await NB.State.wait(220))) return;

      const blockerDefBefore = blocker.def;
      const overflowDmg = Math.max(0, combinedAtk - blockerDefBefore);
      blocker.def -= combinedAtk;
      const counterDmg = blocker.atk;
      unitA.def -= counterDmg;

      NB.Audio.playClash();
      NB.Physics.shakeScreen(true);
      NB.Physics.vibrateDamage();

      if (defSlotEl) NB.Physics.spawnFloatText(defSlotEl, `-${combinedAtk}`, '#FF0055');
      if (slotElA && counterDmg > 0) NB.Physics.spawnFloatText(slotElA, `-${counterDmg}`, '#FFB800');

      if (hasVirus && blocker.def > 0) NB.State.applyVirusDebuff('player', defSlot);
      if (counterDmg > 0 && NB.Cards.hasKeyword(blocker, 'VIRUS') && unitA.def > 0) {
        NB.State.applyVirusDebuff('enemy', slotA);
      }

      NB.UI.renderAll();
      if (!(await NB.State.wait(360))) return;

      if (blocker.def <= 0) {
        NB.State.destroyUnit('player', defSlot, false);
        if (defSlotEl) NB.Physics.spawnFloatText(defSlotEl, 'DESTRUÍDO!', '#FF0055');
      }
      if (unitA.def <= 0) {
        NB.State.destroyUnit('enemy', slotA, true);
        if (slotElA) NB.Physics.spawnFloatText(slotElA, 'DESTRUÍDO!', '#FF0055');
      } else {
        unitA.attacked = true;
      }
      unitB.attacked = true;
      NB.UI.renderAll();

      if (overflowDmg > 0 && !NB.State.checkWinCondition()) {
        if (!(await NB.State.wait(240))) return;
        NB.Audio.playLaser();
        NB.Physics.fireLaserBeam(defSlotEl, playerHud, '#FFB800', 9);
        NB.Physics.showToast(`PERFURAÇÃO INIMIGA! -${overflowDmg} HP`, 'var(--magenta)');
        NB.State.applyDirectDamage('player', overflowDmg, false, 'PERFURAÇÃO ');
        if (hasDreno) {
          NB.State.applyRamDrain('enemy', 1);
          NB.UI.renderAll();
        }
      }
    } else {
      NB.Physics.fireLaserBeam(slotElA, playerHud, '#FF0055', 9);
      NB.Physics.fireLaserBeam(slotElB, playerHud, '#FFB800', 9);
      if (!(await NB.State.wait(240))) return;
      NB.State.applyDirectDamage('player', combinedAtk, false, 'OVERCLOCK ');
      if (hasDreno) {
        NB.State.applyRamDrain('enemy', 1);
        NB.UI.renderAll();
      }
      unitA.attacked = true;
      unitB.attacked = true;
    }

    NB.Physics.clearLasers();
    await NB.State.wait(360);
  }

  async function confirmPlayerDefense() {
    const state = NB.State.get();
    if (state.phase !== 'PLAYER_DEFENSE') return;

    const usedDefenders = new Set(Object.values(state.defenseMap));
    const freePlayerSlots = [];
    state.player.field.forEach((u, idx) => {
      if (u && !usedDefenders.has(idx)) freePlayerSlots.push(idx);
    });

    const unblockedEnemyFirewall = state.enemyAttackers.find(eSlot => {
      const eu = state.enemy.field[eSlot];
      return eu && NB.Cards.hasKeyword(eu, 'FIREWALL') && state.defenseMap[eSlot] === undefined;
    });

    if (unblockedEnemyFirewall !== undefined && freePlayerSlots.length > 0) {
      NB.Physics.showToast('🛡 BLOQUEIE O FIREWALL INIMIGO PRIMEIRO!', 'var(--amber)');
      NB.Physics.vibrateCard();
      return;
    }

    const unblockedEnemies = state.enemyAttackers.filter(eSlot => state.defenseMap[eSlot] === undefined);
    const idlePlayerFirewalls = freePlayerSlots.filter(pSlot => NB.Cards.hasKeyword(state.player.field[pSlot], 'FIREWALL'));
    if (unblockedEnemies.length > 0 && idlePlayerFirewalls.length > 0) {
      idlePlayerFirewalls.forEach((pSlot, i) => {
        if (unblockedEnemies[i] !== undefined) {
          state.defenseMap[unblockedEnemies[i]] = pSlot;
        }
      });
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
    resolveCombatSequence,
    executeOverclockAttack,
    confirmPlayerAttack,
    confirmPlayerDefense
  };
})(window.NB = window.NB || {});
