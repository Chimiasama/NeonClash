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
      challenge: options.challenge || null,
      boss,
      turn: 1,
      phase: 'PLAYER_MAIN',
      winner: null,
      player: {
        hp: playerMaxHp,
        maxHp: playerMaxHp,
        ram: 0,
        deck: options.challenge ? shuffle(options.challenge.deck.map(cardId => ({ uid: uidCounter++, cardId }))) : buildPlayerDeck(),
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

  function getMatchAffinity(cardId, side) {
    return side === 'player' && !state?.challenge
      ? NB.Save.getAffinity(cardId) : NB.Cards.CARD_DB[cardId].affinity || null;
  }

  function createFieldUnit(cardId, uid, side = 'enemy') {
    const def = NB.Cards.CARD_DB[cardId];
    const isZeroDay = NB.Cards.hasKeyword(def, 'ZERO_DAY');
    return {
      uid,
      cardId,
      affinity: getMatchAffinity(cardId, side),
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
    if (!NB.CardEffects.legalSlots(state, card, side).length) {
      return { ok: false, reason: 'Não há Unidades inimigas para atingir.' };
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
    const unit = createFieldUnit(card.id, item.uid, side);
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

    if (card.onDeploy) {
      NB.CardEffects.resolve(card, card.onDeploy, side, slot);
      NB.UI.renderAll();
    }
    unit.justEntered = false;
    checkWinCondition();
    return true;
  }

  function executeExploit(side, handUid, targetSlot = null) {
    const actor = state[side];
    const index = actor.hand.findIndex(item => item.uid === handUid);
    if (index === -1) return false;
    const item = actor.hand[index];
    const card = NB.Cards.CARD_DB[item.cardId];
    if (card.kind !== 'exploit' || !canPlayHandCard(side, item).ok ||
        !NB.CardEffects.legalSlots(state, card, side).includes(targetSlot)) return false;
    actor.ram -= card.cost;
    actor.hand.splice(index, 1);

    if (side === 'player') {
      state.stats.exploitsUsed++;
      NB.Physics.vibrateExploit();
      NB.Dialogue.setDialogue(NB.Dialogue.pickLine('playerExploit'));
    }

    NB.Audio.playLaser();
    NB.CardEffects.resolve(card, card.effects, side, targetSlot);
    actor.discard.push(item);
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
      } else if (state.challenge) {
        state.challengeRewards = NB.Save.recordChallengeVictory(state.challenge.id);
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

    if (state.mode !== 'quick') NB.CityLife.advance(40, 8);
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
    getMatchAffinity,
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
