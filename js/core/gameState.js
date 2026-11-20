(function (NB) {
  'use strict';

  let uidCounter = 1;
  let matchGen = 0;
  let state = null;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* Monta baralho ativo de 20 cartas do jogador (personalizado e salvo no localStorage) */
  function buildPlayerDeck() {
    const activeIds = NB.Save
      ? NB.Save.getActiveDeck()
      : Object.keys(NB.Cards.CARD_DB).slice(0, NB.Cards.DECK_SIZE);
    return shuffle(activeIds.map(cardId => ({ uid: uidCounter++, cardId })));
  }

  /* Monta baralho temático de 20 cartas do chefe atual */
  function buildBossDeck(boss) {
    const list = (boss && Array.isArray(boss.deckList) && boss.deckList.length > 0)
      ? boss.deckList
      : Object.keys(NB.Cards.CARD_DB);
    return shuffle(list.map(cardId => ({ uid: uidCounter++, cardId })));
  }

  function createInitialState(options = {}) {
    const mode = options.mode || 'campaign';
    const boss = options.boss || (NB.Campaign ? NB.Campaign.NODES[0] : null);
    const playerMaxHp = NB.Cards.MAX_HP;
    const enemyMaxHp = (boss && boss.hp) ? boss.hp : NB.Cards.MAX_HP;

    return {
      mode,
      stake: options.stake || 0,
      boss,
      turn: 1,
      phase: 'PLAYER_MAIN',
      winner: null,
      player: {
        hp: playerMaxHp,
        maxHp: playerMaxHp,
        ram: 0,
        deck: buildPlayerDeck(),
        hand: [],
        discard: [],
        field: [null, null, null],
        summonedThisTurn: false
      },
      enemy: {
        hp: enemyMaxHp,
        maxHp: enemyMaxHp,
        ram: 0,
        deck: buildBossDeck(boss),
        hand: [],
        discard: [],
        field: [null, null, null],
        summonedThisTurn: false
      },
      selectedHandUid: null,
      inspectFieldCard: null,
      pendingExploit: null,
      selectedAttackers: [],
      overclockUnits: [],
      enemyAttackers: [],
      enemyOverclock: null, // { slots: [a, b], combinedAtk } quando Archon ativa Overclock
      defenseMap: {},
      activeDefenderSlot: null,
      lastDrawnUid: null,
      stats: {
        damageDealt: 0,
        enemyUnitsDestroyed: 0,
        exploitsUsed: 0
      }
    };
  }

  function get() {
    return state;
  }

  function reset(options = {}) {
    matchGen++;
    state = createInitialState(options);
    return state;
  }

  function wait(ms) {
    const gen = matchGen;
    return new Promise(resolve => {
      setTimeout(() => resolve(gen === matchGen), ms);
    });
  }

  function getSlotEl(side, idx) {
    return document.querySelector(`.slot[data-side="${side}"][data-slot="${idx}"]`);
  }

  function drawCard(side, silent = false) {
    const actor = state[side];
    if (actor.deck.length === 0) {
      if (actor.discard.length === 0) return null;
      actor.deck = shuffle(actor.discard.splice(0));
      if (side === 'player') NB.Physics.showToast('RECOMPILANDO BARALHO', 'var(--cyan)');
    }
    const card = actor.deck.pop();
    if (actor.hand.length >= NB.Cards.MAX_HAND) {
      actor.discard.push(card);
      if (side === 'player' && !silent) NB.Physics.showToast('MÃO CHEIA · CARTA DESCARTADA', 'var(--amber)');
      return null;
    }
    actor.hand.push(card);
    if (side === 'player' && !silent) {
      state.lastDrawnUid = card.uid;
      NB.Audio.playDraw();
    }
    return card;
  }

  function createFieldUnit(cardId, uid) {
    const def = NB.Cards.CARD_DB[cardId];
    const isZeroDay = NB.Cards.hasKeyword(def, 'ZERO_DAY');
    return {
      uid,
      cardId,
      atk: def.atk,
      baseAtk: def.atk,
      def: def.def,
      maxDef: def.def,
      booting: !isZeroDay,
      attacked: false,
      justEntered: true
    };
  }

  function canPlayHandCard(side, handItem) {
    const actor = state[side];
    const opp = state[side === 'player' ? 'enemy' : 'player'];
    const card = NB.Cards.CARD_DB[handItem.cardId];
    if (card.kind === 'unit') {
      if (actor.summonedThisTurn) return { ok: false, reason: 'Limite de 1 Unidade por turno já usado.' };
      const freeSlot = actor.field.findIndex(u => u === null);
      if (freeSlot === -1) return { ok: false, reason: 'Todos os 3 slots de Unidade estão ocupados.' };
      return { ok: true };
    }
    if (actor.ram < card.cost) {
      return { ok: false, reason: `RAM insuficiente (precisa ${card.cost} RAM, você tem ${actor.ram}).` };
    }
    if (card.targetType === 'ally_unit' && !actor.field.some(Boolean)) {
      return { ok: false, reason: 'Precisa de pelo menos 1 Unidade aliada em campo.' };
    }
    if (card.targetType === 'enemy_unit' && !opp.field.some(Boolean)) {
      return { ok: false, reason: 'Não há nenhuma Unidade inimiga no campo.' };
    }
    if (card.id === 'exploit_05' && !opp.field.some(Boolean)) {
      return { ok: false, reason: 'Não há Unidades inimigas para atingir com a Bomba EMP.' };
    }
    return { ok: true };
  }

  function applyVirusDebuff(targetSide, targetSlot) {
    const unit = state[targetSide].field[targetSlot];
    if (!unit || unit.def <= 0) return;
    unit.atk = Math.max(0, unit.atk - 2);
    NB.Audio.playVirus();
    const slotEl = getSlotEl(targetSide, targetSlot);
    if (slotEl) {
      const c = NB.Physics.getElCenterInShell(slotEl);
      NB.Physics.spawnBurst(c.x, c.y, '#39FF14', 12);
      NB.Physics.spawnFloatText(slotEl, '☣ -2 ATK', '#39FF14', 18);
    }
  }

  function applyRamDrain(thiefSide, amount = 1) {
    const victimSide = thiefSide === 'player' ? 'enemy' : 'player';
    const stolen = Math.min(state[victimSide].ram, amount);
    if (stolen <= 0) return 0;

    state[victimSide].ram -= stolen;
    state[thiefSide].ram += stolen;
    NB.Audio.playDrain();

    const thiefEl = document.getElementById(thiefSide === 'player' ? 'player-hud' : 'enemy-panel');
    const victimEl = document.getElementById(victimSide === 'player' ? 'player-hud' : 'enemy-panel');
    NB.Physics.fireLaserBeam(victimEl, thiefEl, '#E879F9', 5);
    NB.Physics.spawnFloatText(thiefEl, `⟐ +${stolen} RAM`, '#E879F9', -14);
    NB.Physics.spawnFloatText(victimEl, `-${stolen} RAM`, '#E879F9', 16);
    return stolen;
  }

  function deployUnit(side, handUid, forcedSlot = -1) {
    const actor = state[side];
    const oppSide = side === 'player' ? 'enemy' : 'player';
    const idx = actor.hand.findIndex(c => c.uid === handUid);
    if (idx === -1) return false;
    const item = actor.hand[idx];
    const card = NB.Cards.CARD_DB[item.cardId];
    const slot = forcedSlot >= 0 && actor.field[forcedSlot] === null
      ? forcedSlot
      : actor.field.findIndex(u => u === null);
    if (slot === -1) return false;

    actor.hand.splice(idx, 1);
    const unit = createFieldUnit(card.id, item.uid);
    actor.field[slot] = unit;
    actor.summonedThisTurn = true;
    actor.ram += card.ramGain;

    NB.Audio.playSummon();
    if (side === 'player') NB.Physics.vibrateCard();
    NB.UI.renderAll();

    const slotEl = getSlotEl(side, slot);
    const cardEl = slotEl && slotEl.querySelector('.field-card');
    if (cardEl) cardEl.classList.add('anim-summon');
    if (slotEl) {
      const c = NB.Physics.getElCenterInShell(slotEl);
      NB.Physics.spawnBurst(c.x, c.y, side === 'player' ? '#00F0FF' : '#FF0055', 16);
      NB.Physics.spawnFloatText(slotEl, `+${card.ramGain} RAM`, '#39FF14');
    }

    if (card.ability === 'PING_1') {
      const oppPanel = document.getElementById(oppSide === 'enemy' ? 'enemy-panel' : 'player-hud');
      NB.Physics.fireLaserBeam(slotEl, oppPanel, '#C084FC', 4);
      applyDirectDamage(oppSide, 1, side === 'player');
    }

    if (side === 'player') {
      if (card.atk >= 5 || NB.Cards.hasKeyword(card, 'ZERO_DAY')) {
        NB.Dialogue.setDialogue(NB.Dialogue.pickLine('playerSummonStrong'));
      }
    } else {
      NB.Dialogue.setDialogue(NB.Dialogue.pickLine('summon'));
    }

    unit.justEntered = false;
    checkWinCondition();
    return true;
  }

  function executeExploit(side, handUid, targetSlot = null) {
    const actor = state[side];
    const oppSide = side === 'player' ? 'enemy' : 'player';
    const opp = state[oppSide];
    const idx = actor.hand.findIndex(c => c.uid === handUid);
    if (idx === -1) return false;
    const item = actor.hand[idx];
    const card = NB.Cards.CARD_DB[item.cardId];

    if (actor.ram < card.cost) return false;
    actor.ram -= card.cost;
    actor.hand.splice(idx, 1);
    actor.discard.push(item);

    const casterEl = document.getElementById(side === 'player' ? 'player-hud' : 'enemy-panel');
    const oppPanelEl = document.getElementById(oppSide === 'enemy' ? 'enemy-panel' : 'player-hud');

    if (side === 'player') {
      state.stats.exploitsUsed++;
      NB.Physics.vibrateExploit();
      NB.Dialogue.setDialogue(NB.Dialogue.pickLine('playerExploit'));
    }

    NB.Audio.playLaser();

    if (card.id === 'exploit_01') {
      const u = actor.field[targetSlot];
      if (u) {
        u.atk += 3;
        const slotEl = getSlotEl(side, targetSlot);
        if (slotEl) {
          NB.Physics.fireLaserBeam(casterEl, slotEl, '#FFB800', 6);
          NB.Physics.spawnFloatText(slotEl, '+3 ATK', '#FFB800');
        }
      }
    } else if (card.id === 'exploit_02') {
      NB.Physics.fireLaserBeam(casterEl, oppPanelEl, '#FF0055', 7);
      applyDirectDamage(oppSide, 3, side === 'player');
    } else if (card.id === 'exploit_03') {
      const target = opp.field[targetSlot];
      if (target) {
        const slotEl = getSlotEl(oppSide, targetSlot);
        NB.Physics.fireLaserBeam(casterEl, slotEl, '#FF0055', 9);
        NB.Physics.shakeScreen(true);
        destroyUnit(oppSide, targetSlot, side === 'player');
        if (slotEl) NB.Physics.spawnFloatText(slotEl, 'ELIMINADO!', '#FF0055');
      }
    } else if (card.id === 'exploit_04') {
      const healed = Math.min(actor.maxHp - actor.hp, 4);
      actor.hp = Math.min(actor.maxHp, actor.hp + 4);
      const p = NB.Physics.getElCenterInShell(casterEl);
      NB.Physics.spawnBurst(p.x, p.y, '#39FF14', 20);
      NB.Physics.spawnShockwave(p.x, p.y, '#39FF14', 60);
      NB.Physics.spawnFloatText(casterEl, `+${healed > 0 ? healed : 4} HP`, '#39FF14');
      actor.field.forEach((u, sIdx) => {
        if (u) {
          u.def += 2;
          u.maxDef += 2;
          const slotEl = getSlotEl(side, sIdx);
          if (slotEl) {
            NB.Physics.fireLaserBeam(casterEl, slotEl, '#39FF14', 4);
            NB.Physics.spawnFloatText(slotEl, '+2 DEF', '#00F0FF');
          }
        }
      });
    } else if (card.id === 'exploit_05') {
      NB.Physics.shakeScreen(true);
      opp.field.forEach((u, sIdx) => {
        if (!u) return;
        const slotEl = getSlotEl(oppSide, sIdx);
        NB.Physics.fireLaserBeam(casterEl, slotEl, '#FFB800', 6);
        u.def -= 2;
        u.atk = Math.max(0, u.atk - 2);
        if (slotEl) NB.Physics.spawnFloatText(slotEl, '-2 DEF / -2 ATK', '#FFB800');
        if (u.def <= 0) destroyUnit(oppSide, sIdx, side === 'player');
      });
    } else if (card.id === 'exploit_06') {
      NB.Physics.fireLaserBeam(casterEl, oppPanelEl, '#E879F9', 7);
      applyDirectDamage(oppSide, 2, side === 'player');
      applyRamDrain(side, 2);
      drawCard(side, false);
    }

    NB.UI.renderAll();
    checkWinCondition();
    return true;
  }

  function applyDirectDamage(targetSide, amount, countedForPlayer, labelPrefix = '') {
    if (amount <= 0) return;
    const target = state[targetSide];
    target.hp = Math.max(0, target.hp - amount);
    if (countedForPlayer) state.stats.damageDealt += amount;

    NB.Audio.playDamage();
    NB.Physics.shakeScreen(amount >= 4);
    if (targetSide === 'player' || amount >= 4) {
      NB.Physics.vibrateDamage();
    }

    const panel = document.getElementById(targetSide === 'enemy' ? 'enemy-panel' : 'player-hud');
    if (panel) {
      panel.classList.remove('hit-flash');
      void panel.offsetWidth;
      panel.classList.add('hit-flash');
      const c = NB.Physics.getElCenterInShell(panel);
      NB.Physics.spawnBurst(c.x, c.y, '#FF0055', amount >= 4 ? 30 : 20);
      NB.Physics.spawnShockwave(c.x, c.y, '#FF0055', amount >= 4 ? 76 : 48);
      NB.Physics.spawnFloatText(panel, `${labelPrefix}-${amount} HP`, '#FF0055');
    }

    if (targetSide === 'enemy') {
      NB.Dialogue.setDialogue(target.hp <= 7 ? NB.Dialogue.pickLine('critical') : NB.Dialogue.pickLine('hit'));
    } else if (target.hp <= 7) {
      NB.Dialogue.setDialogue(NB.Dialogue.pickLine('playerCritical'));
    }
    NB.UI.renderAll();
  }

  function destroyUnit(side, slotIdx, countedAsPlayerKill) {
    const u = state[side].field[slotIdx];
    if (!u) return;
    state[side].discard.push({ uid: u.uid, cardId: u.cardId });
    state[side].field[slotIdx] = null;
    if (countedAsPlayerKill && side === 'enemy') {
      state.stats.enemyUnitsDestroyed++;
    }
    if (side === 'player') {
      NB.Dialogue.setDialogue(NB.Dialogue.pickLine('destroyPlayer'));
    }
    NB.Audio.playDestroy();
    NB.Physics.vibrateDestroy();
    const slotEl = getSlotEl(side, slotIdx);
    if (slotEl) {
      const c = NB.Physics.getElCenterInShell(slotEl);
      const col = side === 'enemy' ? '#FF0055' : '#00F0FF';
      NB.Physics.spawnBurst(c.x, c.y, col, 32);
      NB.Physics.spawnShockwave(c.x, c.y, col, 68);
    }
  }

  function checkWinCondition() {
    if (state.phase === 'GAME_OVER') return true;
    if (state.enemy.hp <= 0) {
      triggerGameOver('player');
      return true;
    }
    if (state.player.hp <= 0) {
      triggerGameOver('enemy');
      return true;
    }
    return false;
  }

  function triggerGameOver(winner) {
    state.phase = 'GAME_OVER';
    state.winner = winner;
    NB.UI.closeVisor();
    NB.Physics.clearLasers();
    NB.UI.renderAll();

    let campaignResult = null;
    if (state.mode === 'arena') NB.City.finishArena(state, winner);
    if (winner === 'player') {
      if (state.mode === 'campaign' && state.boss) {
        campaignResult = NB.Save.recordBossVictory(state.boss);
      } else {
        NB.Save.recordQuickDuelWin();
      }
      NB.Audio.playVictory();
      NB.Physics.vibrateOverclock();
    } else {
      NB.Save.recordMatchLoss();
      NB.Audio.playDefeat();
      NB.Physics.vibrateDamage();
    }

    NB.UI.showGameOverModal(winner, state, campaignResult);
  }

  NB.State = {
    get,
    reset,
    cancelPending() { matchGen++; },
    wait,
    getSlotEl,
    drawCard,
    createFieldUnit,
    canPlayHandCard,
    applyVirusDebuff,
    applyRamDrain,
    deployUnit,
    executeExploit,
    applyDirectDamage,
    destroyUnit,
    checkWinCondition,
    triggerGameOver
  };
})(window.NB = window.NB || {});
