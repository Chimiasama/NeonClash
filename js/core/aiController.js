(function (NB) {
  'use strict';

  /* Controlador de IA tática — adapta estilo por chefe (Kira, Cipher, Vex e Archon com Overclock) */
  function computeAiBlocks(playerAttackers) {
    const state = NB.State.get();
    const blocks = {};
    const availableDefenders = state.enemy.field
      .map((u, idx) => u ? { idx, u, isFirewall: NB.Cards.hasKeyword(u, 'FIREWALL') } : null)
      .filter(Boolean);

    const sortedAtks = [...playerAttackers].sort((a, b) => {
      const uA = state.player.field[a];
      const uB = state.player.field[b];
      const fwA = NB.Cards.hasKeyword(uA, 'FIREWALL') ? 1 : 0;
      const fwB = NB.Cards.hasKeyword(uB, 'FIREWALL') ? 1 : 0;
      if (fwB !== fwA) return fwB - fwA;
      return (uB?.atk || 0) - (uA?.atk || 0);
    });

    const totalIncoming = sortedAtks.reduce((acc, s) => acc + (state.player.field[s]?.atk || 0), 0);
    const mustBlockLethal = totalIncoming >= state.enemy.hp;

    for (const pSlot of sortedAtks) {
      const atkU = state.player.field[pSlot];
      if (!atkU || availableDefenders.length === 0) continue;

      const attackerIsFirewall = NB.Cards.hasKeyword(atkU, 'FIREWALL');
      let pickIdx = availableDefenders.findIndex(d => d.isFirewall);

      if (pickIdx === -1) {
        pickIdx = availableDefenders.findIndex(d => d.u.atk >= atkU.def && d.u.def > atkU.atk);
      }
      if (pickIdx === -1 && (atkU.atk >= 4 || mustBlockLethal || attackerIsFirewall || NB.Cards.hasKeyword(atkU, 'DRENO'))) {
        pickIdx = availableDefenders.findIndex(d => d.u.def > atkU.atk || d.u.atk >= atkU.def);
      }
      if (pickIdx === -1 && (mustBlockLethal || attackerIsFirewall)) {
        pickIdx = 0;
      }

      if (pickIdx !== -1) {
        const chosen = availableDefenders.splice(pickIdx, 1)[0];
        blocks[pSlot] = chosen.idx;
      }
    }
    return blocks;
  }

  function pickOverclockBlocker(combinedAtk) {
    const state = NB.State.get();
    const defenders = state.enemy.field
      .map((u, idx) => u ? { idx, u, isFirewall: NB.Cards.hasKeyword(u, 'FIREWALL') } : null)
      .filter(Boolean);
    if (defenders.length === 0) return -1;

    const fw = defenders.find(d => d.isFirewall);
    if (fw) return fw.idx;

    if (combinedAtk >= state.enemy.hp || combinedAtk >= 6) {
      defenders.sort((a, b) => b.u.def - a.u.def);
      return defenders[0].idx;
    }

    return -1;
  }

  function pickBestAiExploit() {
    const state = NB.State.get();
    const CARD_DB = NB.Cards.CARD_DB;
    const boss = state.boss;
    const readyCount = state.enemy.field.filter(u => u && !u.booting && !u.attacked).length;

    // Archon guarda 3 RAM se tiver 2 unidades prontas para usar Overclock!
    const reserveRamForOverclock = Boolean(boss && boss.canOverclock && readyCount >= 2 && state.enemy.ram >= 3 && state.enemy.ram <= 4);

    const handExploits = state.enemy.hand
      .map(item => ({ item, def: CARD_DB[item.cardId] }))
      .filter(x => x.def.kind === 'exploit' && state.enemy.ram >= x.def.cost);

    if (handExploits.length === 0) return null;

    const spike = handExploits.find(x => x.def.id === 'exploit_02');
    if (spike && state.player.hp <= 3) {
      return { uid: spike.item.uid, cardId: spike.def.id, targetSlot: null };
    }
    const siphon = handExploits.find(x => x.def.id === 'exploit_06');
    if (siphon && state.player.hp <= 2) {
      return { uid: siphon.item.uid, cardId: siphon.def.id, targetSlot: null };
    }

    if (reserveRamForOverclock) return null;

    const emp = handExploits.find(x => x.def.id === 'exploit_05');
    if (emp && state.player.field.filter(Boolean).length >= 2) {
      return { uid: emp.item.uid, cardId: emp.def.id, targetSlot: null };
    }

    const kill = handExploits.find(x => x.def.id === 'exploit_03');
    if (kill) {
      let bestTarget = -1;
      let bestVal = 0;
      state.player.field.forEach((u, idx) => {
        if (u) {
          const v = u.atk + u.def + (NB.Cards.hasKeyword(u, 'FIREWALL') ? 3 : 0);
          if (v > bestVal) { bestVal = v; bestTarget = idx; }
        }
      });
      if (bestTarget !== -1 && bestVal >= 7) {
        return { uid: kill.item.uid, cardId: kill.def.id, targetSlot: bestTarget };
      }
    }

    if (siphon) {
      return { uid: siphon.item.uid, cardId: siphon.def.id, targetSlot: null };
    }

    const patch = handExploits.find(x => x.def.id === 'exploit_04');
    if (patch && (state.enemy.hp <= state.enemy.maxHp - 5 || state.enemy.field.filter(Boolean).length >= 2)) {
      return { uid: patch.item.uid, cardId: patch.def.id, targetSlot: null };
    }

    const oc = handExploits.find(x => x.def.id === 'exploit_01');
    if (oc) {
      const readyIdx = state.enemy.field.findIndex(u => u && !u.booting);
      const anyIdx = state.enemy.field.findIndex(Boolean);
      const target = readyIdx !== -1 ? readyIdx : anyIdx;
      if (target !== -1) {
        return { uid: oc.item.uid, cardId: oc.def.id, targetSlot: target };
      }
    }

    if (spike) {
      return { uid: spike.item.uid, cardId: spike.def.id, targetSlot: null };
    }

    return null;
  }

  async function startEnemyTurn() {
    if (NB.State.checkWinCondition()) return;
    const state = NB.State.get();
    const CARD_DB = NB.Cards.CARD_DB;
    const boss = state.boss;
    const bossName = boss ? boss.name : 'VEX';

    state.phase = 'ENEMY_TURN';
    state.selectedHandUid = null;
    state.pendingExploit = null;
    state.overclockUnits = [];
    state.enemyOverclock = null;
    NB.UI.closeVisor();

    state.enemy.summonedThisTurn = false;
    state.enemy.field.forEach(u => {
      if (u) {
        u.booting = false;
        u.attacked = false;
      }
    });

    NB.State.drawCard('enemy');
    NB.UI.renderAll();
    NB.Physics.showToast(`TURNO DE ${bossName}`, 'var(--magenta)');
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
            let s = x.def.atk * 1.4 + x.def.def;
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
      if (u && !u.booting && !u.attacked && u.atk > 0) readyEnemySlots.push(idx);
    });

    if (boss && boss.canOverclock && state.enemy.ram >= NB.Cards.OVERCLOCK_COST && readyEnemySlots.length >= 2) {
      const sorted = [...readyEnemySlots].sort((a, b) => state.enemy.field[b].atk - state.enemy.field[a].atk);
      const slotA = sorted[0];
      const slotB = sorted[1];
      const combinedAtk = state.enemy.field[slotA].atk + state.enemy.field[slotB].atk;

      state.enemy.ram -= NB.Cards.OVERCLOCK_COST;
      state.enemyOverclock = { slots: [slotA, slotB], combinedAtk };
      state.enemyAttackers = [slotA]; // slotA representa o ataque combinado para bloqueio
      state.defenseMap = {};
      state.activeDefenderSlot = null;

      // Pré-conecta Firewall do jogador se existir
      const pFw = state.player.field.findIndex(u => u && NB.Cards.hasKeyword(u, 'FIREWALL'));
      if (pFw !== -1) state.defenseMap[slotA] = pFw;

      state.phase = 'PLAYER_DEFENSE';
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
    const playerStrongestAtk = Math.max(0, ...state.player.field.filter(Boolean).map(u => u.atk));
    const totalAiAtk = readyEnemySlots.reduce((sum, idx) => sum + state.enemy.field[idx].atk, 0);

    for (const idx of readyEnemySlots) {
      const u = state.enemy.field[idx];
      const noPlayerUnits = !state.player.field.some(Boolean);
      const aggressive = boss && boss.id === 'kira';
      if (noPlayerUnits || totalAiAtk >= state.player.hp || aggressive || u.def > playerStrongestAtk || u.atk >= 3 || Math.random() < 0.65) {
        chosenAttackers.push(idx);
      }
    }

    if (chosenAttackers.length === 0) {
      NB.Input.startPlayerTurn();
      return;
    }

    state.enemyAttackers = chosenAttackers;
    state.defenseMap = {};
    state.activeDefenderSlot = null;

    const playerFirewalls = [];
    state.player.field.forEach((u, idx) => {
      if (u && NB.Cards.hasKeyword(u, 'FIREWALL')) playerFirewalls.push(idx);
    });
    playerFirewalls.forEach((pSlot, i) => {
      if (chosenAttackers[i] !== undefined) {
        state.defenseMap[chosenAttackers[i]] = pSlot;
      }
    });

    state.phase = 'PLAYER_DEFENSE';
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
