(function (NB) {
  'use strict';

  const attackingPower = (unit, field) => unit ? NB.CardEffects.attackPower(unit, field) : 0;

  /* Controlador de IA tática — adapta estilo por chefe (Kira, Cipher, Vex e Archon com Overclock) */
  function computeAiBlocks(playerAttackers) {
    const state = NB.State.get();
    const blocks = {};
    const availableDefenders = state.enemy.field
      .map((u, idx) => NB.Combat.canBlock(u, state.enemy) ? { idx, u, isFirewall: NB.Cards.hasKeyword(u, 'FIREWALL') } : null)
      .filter(Boolean);

    const sortedAtks = [...playerAttackers].sort((a, b) => {
      const uA = state.player.field[a];
      const uB = state.player.field[b];
      const fwA = NB.Cards.hasKeyword(uA, 'FIREWALL') ? 1 : 0;
      const fwB = NB.Cards.hasKeyword(uB, 'FIREWALL') ? 1 : 0;
      if (fwB !== fwA) return fwB - fwA;
      return attackingPower(uB, state.player.field) - attackingPower(uA, state.player.field);
    });

    const totalIncoming = sortedAtks.reduce((acc, s) => acc + attackingPower(state.player.field[s], state.player.field), 0);
    const mustBlockLethal = totalIncoming >= state.enemy.hp;

    for (const pSlot of sortedAtks) {
      const atkU = state.player.field[pSlot];
      if (!atkU || availableDefenders.length === 0) continue;

      const attackerIsFirewall = NB.Cards.hasKeyword(atkU, 'FIREWALL');
      const survives = d => d.u.def > NB.Combat.clashDamage(atkU, d.u, state.player.field);
      const destroys = d => d.u.atk + NB.Combat.affinityBonus(d.u, atkU) >= atkU.def;
      let pickIdx = availableDefenders.findIndex(d => d.isFirewall);

      if (pickIdx === -1) {
        pickIdx = availableDefenders.findIndex(d => destroys(d) && survives(d));
      }
      if (pickIdx === -1 && (attackingPower(atkU, state.player.field) >= 4 || mustBlockLethal || attackerIsFirewall || NB.Cards.hasKeyword(atkU, 'DRENO'))) {
        pickIdx = availableDefenders.findIndex(d => survives(d) || destroys(d));
      }
      if (pickIdx === -1 && (mustBlockLethal || attackerIsFirewall)) {
        pickIdx = 0;
      }

      if (pickIdx !== -1) {
        const chosen = availableDefenders[pickIdx];
        blocks[pSlot] = chosen.idx;
        if (!NB.Combat.hasBlockRoom(chosen.u, state.enemy, blocks, chosen.idx)) availableDefenders.splice(pickIdx, 1);
      }
    }
    return blocks;
  }

  function pickOverclockBlocker(combinedAtk, directDamage) {
    const state = NB.State.get();
    const defenders = state.enemy.field
      .map((u, idx) => NB.Combat.canBlock(u, state.enemy) ? { idx, u, isFirewall: NB.Cards.hasKeyword(u, 'FIREWALL') } : null)
      .filter(Boolean);
    if (defenders.length === 0) return -1;

    const fw = defenders.find(d => d.isFirewall);
    if (fw) return fw.idx;

    if (directDamage >= state.enemy.hp || combinedAtk >= 6) {
      defenders.sort((a, b) => b.u.def - a.u.def);
      return defenders[0].idx;
    }

    return -1;
  }

  function pickBestAiExploit() {
    const state = NB.State.get();
    const { enemy, boss } = state;
    const readyCount = enemy.field.filter(unit => NB.Combat.canAttack(unit, enemy.field)).length;
    const reserve = boss?.canOverclock && readyCount >= 2 && enemy.ram >= NB.Cards.OVERCLOCK_COST;
    let best = null;
    let bestScore = 0;
    for (const item of enemy.hand) {
      const card = NB.Cards.CARD_DB[item.cardId];
      if (card.kind !== 'exploit' || !NB.State.canPlayHandCard('enemy', item).ok) continue;
      for (const targetSlot of NB.CardEffects.legalSlots(state, card, 'enemy')) {
        const score = NB.CardEffects.score(state, card, 'enemy', targetSlot);
        if (reserve && score < 100 && enemy.ram - card.cost < NB.Cards.OVERCLOCK_COST) continue;
        const net = score - card.cost * 0.65;
        if (net <= bestScore) continue;
        bestScore = net;
        best = { uid: item.uid, cardId: card.id, targetSlot };
      }
    }
    return best;
  }

  async function startEnemyTurn({ opening = false } = {}) {
    if (NB.State.checkWinCondition()) return;
    const state = NB.State.get();
    const CARD_DB = NB.Cards.CARD_DB;
    const boss = state.boss;
    const bossName = boss ? boss.name : 'VEX';

    state.phase = 'ENEMY_TURN';
    state.selectedHandUid = null;
    state.pendingTarget = null;
    state.overclockUnits = [];
    state.enemyOverclock = null;
    NB.UI.closeVisor();

    state.enemy.summonedThisTurn = false;
    state.enemy.counterFormation = false;
    state.enemy.overclockCoupler = false;
    state.enemy.overclockRefunded = false;
    state.enemy.hpShield = 0;
    state.enemy.field.forEach(u => {
      if (u) {
        u.booting = false;
        u.attacked = false;
        u.overclockGuard = false;
      }
    });

    if (!opening) NB.State.drawCard('enemy');
    NB.UI.renderAll();
    NB.Physics.showToast(opening ? `${bossName} COMEÇA · TURNO 1` : `TURNO DE ${bossName}`, 'var(--magenta)');
    if (!(await NB.State.wait(680))) return;

    // 1) IA baixa Unidade priorizando arquétipo do chefe
    const freeSlot = state.enemy.field.findIndex(u => u === null);
    if (freeSlot !== -1 && !state.enemy.summonedThisTurn) {
      const unitsInHand = state.enemy.hand
        .map(item => ({ item, def: CARD_DB[item.cardId] }))
        .filter(x => x.def.kind === 'unit');

      if (unitsInHand.length > 0) {
        unitsInHand.sort((a, b) => {
          const score = (x) => {
            const effects = x.def.targetType === 'enemy_unit'
              ? Math.max(0, ...NB.CardEffects.legalSlots(state, x.def, 'enemy')
                .map(slot => NB.CardEffects.score(state, x.def, 'enemy', slot)))
              : NB.CardEffects.score(state, x.def, 'enemy', freeSlot);
            let s = attackingPower(x.def, state.enemy.field) * 1.4 + x.def.def + effects;
            if (NB.Cards.hasKeyword(x.def, 'ZERO_DAY')) s += (boss && boss.id === 'kira' ? 5.5 : 3.5);
            if (NB.Cards.hasKeyword(x.def, 'FIREWALL')) s += (boss && boss.id === 'cipher' ? 5.0 : (state.enemy.hp <= 12 ? 4.2 : 1.5));
            if (NB.Cards.hasKeyword(x.def, 'VIRUS')) s += (boss && boss.id === 'vex' ? 4.2 : 2.4);
            if (NB.Cards.hasKeyword(x.def, 'DRENO')) s += (boss && boss.id === 'vex' ? 4.0 : 2.2);
            if (x.def.ability === 'EXTRA_RAM') s += (boss && boss.canOverclock ? 3.5 : 2.2);
            if (x.def.ability === 'PING_1') s += 2.0;
            return s;
          };
          return score(b) - score(a);
        });
        NB.State.deployUnit('enemy', unitsInHand[0].item.uid, freeSlot);
        if (NB.State.checkWinCondition()) return;
        if (!(await NB.State.wait(680))) return;
      }
    }

    // 2) IA dispara Exploits
    let safety = 0;
    while (safety++ < 4) {
      if (NB.State.checkWinCondition()) return;
      const playableExploit = pickBestAiExploit();
      if (!playableExploit) break;

      NB.Physics.showToast(`${bossName} USOU ${CARD_DB[playableExploit.cardId].name.toUpperCase()}!`, 'var(--magenta)');
      if (!(await NB.State.wait(450))) return;
      NB.State.executeExploit('enemy', playableExploit.uid, playableExploit.targetSlot);
      if (NB.State.checkWinCondition()) return;
      if (!(await NB.State.wait(620))) return;
    }

    // 3) Verifica se ARCHON ativa OVERCLOCK (Unite Attack inimigo com Perfuração!)
    const readyEnemySlots = [];
    state.enemy.field.forEach((u, idx) => {
      if (NB.Combat.canAttack(u, state.enemy.field)) readyEnemySlots.push(idx);
    });

    if (boss && boss.canOverclock && state.enemy.ram >= NB.Cards.OVERCLOCK_COST && readyEnemySlots.length >= 2) {
      const sorted = [...readyEnemySlots].sort((a, b) => attackingPower(state.enemy.field[b], state.enemy.field) - attackingPower(state.enemy.field[a], state.enemy.field));
      const slotA = sorted[0];
      const slotB = sorted[1];
      const combinedAtk = attackingPower(state.enemy.field[slotA], state.enemy.field) + attackingPower(state.enemy.field[slotB], state.enemy.field);

      state.enemy.ram -= NB.Cards.OVERCLOCK_COST;
      state.enemyOverclock = { slots: [slotA, slotB], combinedAtk };
      NB.Combat.preparePlayerDefense([slotA]);
      NB.Dialogue.setDialogue(NB.Dialogue.pickLine('overclock'));
      NB.Audio.playOverclock();
      NB.Physics.vibrateOverclock();
      NB.Physics.shakeScreen(true);
      NB.Physics.showToast(`⚡ ${bossName} ATIVOU OVERCLOCK (${combinedAtk} ATK)!`, 'var(--magenta)');
      NB.UI.renderAll();
      return;
    }

    // 4) Ataque normal
    const chosenAttackers = [];
    const playerDefenders = state.player.field.filter(u => NB.Combat.canBlock(u, state.player));
    const playerStrongestAtk = Math.max(0, ...playerDefenders.map(u => u.atk));
    const totalAiAtk = readyEnemySlots.reduce((sum, idx) => sum + attackingPower(state.enemy.field[idx], state.enemy.field), 0);

    for (const idx of readyEnemySlots) {
      const u = state.enemy.field[idx];
      const noPlayerDefenders = playerDefenders.length === 0;
      const aggressive = boss && boss.id === 'kira';
      if (noPlayerDefenders || totalAiAtk >= state.player.hp || aggressive || u.def > playerStrongestAtk || attackingPower(u, state.enemy.field) >= 3 || Math.random() < 0.65) {
        chosenAttackers.push(idx);
      }
    }

    if (chosenAttackers.length === 0) {
      NB.Input.startPlayerTurn();
      return;
    }

    NB.Combat.preparePlayerDefense(chosenAttackers);
    NB.Dialogue.setDialogue(NB.Dialogue.pickLine('attack'));
    NB.Audio.playAttack();
    NB.Physics.showToast('FASE DE DEFESA!', 'var(--magenta)');
    NB.UI.renderAll();
  }

  NB.AI = {
    computeAiBlocks,
    pickOverclockBlocker,
    pickBestAiExploit,
    startEnemyTurn
  };
})(window.NB = window.NB || {});
