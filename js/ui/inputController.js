(function (NB) {
  'use strict';

  /* Controlador de Entrada Touch, Navegação entre Telas, Campanha, Overclock e Save */
  function hideAllScreens() {
    NB.DuelLog.close();
    NB.City.cancelJob();
    ['title-modal', 'netmap-modal', 'starter-modal', 'prologue-modal', 'abandon-modal', 'street-rest-modal', 'story-modal', 'dossier-modal', 'gameover-modal', 'settings-modal', 'deck-modal', 'card-inspector-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
  }

  function openTitleScreen() {
    hideAllScreens();
    NB.UI.closeVisor();
    NB.Physics.clearLasers();
    NB.Physics.cancelUiTransitions();
    NB.State.cancelPending();
    document.getElementById('game-ui').inert = true;
    NB.Audio.setScene('title');
    NB.UI.renderTitleStats();
    document.getElementById('title-modal').classList.add('open');
  }

  function openNetMap(message = '') {
    hideAllScreens();
    NB.UI.closeVisor();
    NB.Physics.clearLasers();
    NB.Physics.cancelUiTransitions();
    NB.State.cancelPending();
    NB.Audio.setScene('city');
    NB.City.open(message);
  }

  function closeStarterChoice() {
    document.getElementById('starter-modal').classList.remove('open');
    document.getElementById('title-modal').inert = false;
    document.getElementById('btn-start-campaign').focus();
  }

  function openStarterChoice() {
    const options = document.getElementById('starter-options');
    options.replaceChildren();
    for (const [id, recipe] of Object.entries(NB.Cards.STARTER_DECKS)) {
      const row = document.createElement('section');
      const title = document.createElement('h3');
      title.textContent = recipe.name;
      const description = document.createElement('p');
      description.textContent = recipe.description + ' 14 unidades · 6 Exploits.';
      const choose = document.createElement('button');
      choose.type = 'button';
      choose.className = 'hud-btn';
      choose.textContent = `Escolher ${recipe.name}`;
      choose.addEventListener('click', () => {
        if (!NB.Save.chooseStarterDeck(id)) return;
        closeStarterChoice();
        NB.StoryUI.openPrologue();
      });
      row.append(title, description, choose);
      options.append(row);
    }
    document.getElementById('title-modal').inert = true;
    document.getElementById('starter-modal').classList.add('open');
    options.querySelector('button')?.focus();
  }

  function startMatch(options = {}) {
    const mode = options.mode || 'campaign';
    const boss = options.boss || (mode === 'quick' ? NB.Campaign.getRandomBoss() : NB.Campaign.NODES[0]);
    if (mode === 'challenge') {
      const challenge = NB.Challenges.find(entry => entry.id === options.challenge?.id);
      if (!challenge || challenge.opponent !== boss.id || !NB.Save.isArchetypeUnlocked(boss.id)) return;
      options = { ...options, challenge };
    }
    if (mode === 'quick' && boss.id === 'archon' && !NB.Save.isArchetypeUnlocked(boss.id)) return;

    if (mode === 'campaign' && boss.id === 'archon' && NB.Story.finalBattle() && !NB.Story.get().kiraSupportUsed && NB.Story.get().allies.kira) {
      NB.Story.applyKiraSupport();
      NB.Save.save();
    }

    if (options.autoSound !== false) NB.Audio.activateOnEntry();

    hideAllScreens();
    document.getElementById('game-ui').inert = false;
    NB.Audio.setScene(boss.id, true);
    const openingSide = NB.CityLife.duelInitiative();
    NB.State.reset({ mode, boss, stake: options.stake, challenge: options.challenge, openingSide });
    NB.UI.closeVisor();
    NB.Physics.clearLasers();
    NB.UI.renderEnemyAvatar(boss);

    for (let i = 0; i < 3; i++) {
      NB.State.drawCard('player', true);
      NB.State.drawCard('enemy', true);
    }
    NB.State.drawCard('enemy', true);
    NB.State.drawCard('player', false);

    NB.Dialogue.setDialogue(NB.Dialogue.pickLine('start'));
    NB.UI.renderAll();
    NB.Physics.playMatchHudEntrance(boss.accent || '#FF0055');
    if (openingSide === 'enemy') NB.AI.startEnemyTurn({ opening: true });
    else NB.Physics.showToast('KAIRO COMEÇA · TURNO 1', 'var(--cyan)');
  }

  function startPlayerTurn() {
    if (NB.State.checkWinCondition()) return;
    const state = NB.State.get();
    if (!state.openingPlayerTurnPending) state.turn++;
    state.openingPlayerTurnPending = false;
    state.phase = 'PLAYER_MAIN';
    state.player.summonedThisTurn = false;
    state.selectedAttackers = [];
    state.overclockUnits = [];
    state.enemyOverclock = null;
    state.selectedHandUid = null;
    state.pendingTarget = null;
    state.player.counterFormation = false;
    state.player.hpShield = 0;
    state.player.field.forEach(u => {
      if (u) {
        u.booting = false;
        u.attacked = false;
      }
    });

    NB.State.drawCard('player');
    NB.UI.renderAll();
    NB.Physics.showToast(`SEU TURNO · T${state.turn}`, 'var(--cyan)');
  }

  function cancelTargetMode() {
    const state = NB.State.get();
    state.phase = 'PLAYER_MAIN';
    state.pendingTarget = null;
    NB.UI.renderAll();
  }

  function onTapHandCard(uid) {
    const state = NB.State.get();
    if (state.phase !== 'PLAYER_MAIN' && state.phase !== 'SELECT_TARGET') return;
    if (state.phase === 'SELECT_TARGET') {
      cancelTargetMode();
    }

    const item = state.player.hand.find(c => c.uid === uid);
    if (!item) return;

    if (state.selectedHandUid === uid) {
      attemptExecuteSelectedCard();
      return;
    }

    state.selectedHandUid = uid;
    state.inspectFieldCard = null;
    NB.Audio.playSelect();
    NB.Physics.vibrateCard();
    NB.UI.renderAll();
    NB.UI.openVisorForHand(item);
  }

  function attemptExecuteSelectedCard() {
    const state = NB.State.get();
    if (state.phase !== 'PLAYER_MAIN' || !state.selectedHandUid) return;
    const item = state.player.hand.find(c => c.uid === state.selectedHandUid);
    if (!item) return;

    const check = NB.State.canPlayHandCard('player', item);
    if (!check.ok) {
      NB.Physics.showToast(check.reason.toUpperCase(), 'var(--amber)');
      return;
    }

    const card = NB.Cards.CARD_DB[item.cardId];
    NB.UI.closeVisor();

    if (card.kind === 'unit') {
      state.selectedHandUid = null;
      NB.State.deployUnit('player', item.uid);
      return;
    }

    if (card.targetType === 'none') {
      state.selectedHandUid = null;
      NB.State.executeExploit('player', item.uid, null);
      return;
    }

    const targetSide = card.targetType === 'ally_unit' ? 'player' : 'enemy';
    const validSlots = NB.CardEffects.legalSlots(state, card, 'player');

    if (validSlots.length === 1 && !NB.CardEffects.hasModifiedTarget(state, card, 'player')) {
      state.selectedHandUid = null;
      NB.State.executeExploit('player', item.uid, validSlots[0]);
    } else if (validSlots.length) {
      state.phase = 'SELECT_TARGET';
      state.pendingTarget = { uid: item.uid, cardId: card.id, targetSide, validSlots };
      state.selectedHandUid = null;
      NB.Physics.showToast('SELECIONE O ALVO NO CAMPO', 'var(--ram)');
      NB.UI.renderAll();
    }
  }

  function onTapBoardSlot(side, slotIdx) {
    const state = NB.State.get();
    const unit = state[side].field[slotIdx];

    if (state.phase === 'SELECT_TARGET' && state.pendingTarget) {
      const pending = state.pendingTarget;
      if (side === pending.targetSide && unit) {
        const card = NB.Cards.CARD_DB[pending.cardId];
        if (NB.CardEffects.alreadyModified(card, unit)) {
          NB.Physics.showToast('ESTA UNIDADE JÁ TEM ESSE MODIFICADOR', 'var(--amber)');
          return;
        }
        if (pending.validSlots.includes(slotIdx)) {
          if (pending.kind === 'deploy') {
            NB.State.resolveDeployTarget(slotIdx);
            return;
          }
          state.pendingTarget = null;
          state.phase = 'PLAYER_MAIN';
          NB.State.executeExploit('player', pending.uid, slotIdx);
        }
      }
      return;
    }

    if (state.phase === 'PLAYER_OVERCLOCK') {
      if (side === 'player' && unit) {
        if (!NB.Combat.canAttack(unit, state.player.field)) {
          NB.Physics.showToast('APENAS UNIDADES PRONTAS PODEM USAR OVERCLOCK', 'var(--amber)');
          return;
        }
        const pos = state.overclockUnits.indexOf(slotIdx);
        if (pos !== -1) state.overclockUnits.splice(pos, 1);
        else if (state.overclockUnits.length < 2) state.overclockUnits.push(slotIdx);
        else state.overclockUnits[1] = slotIdx;

        NB.Audio.playSelect();
        NB.Physics.vibrateCard();
        NB.UI.renderAll();
      } else if (side === 'enemy' && unit) {
        NB.UI.openVisorForField('enemy', slotIdx);
      }
      return;
    }

    if (state.phase === 'PLAYER_ATTACK') {
      if (side === 'player' && unit) {
        if (unit.booting) {
          NB.Physics.showToast('UNIDADE EM BOOTING (AGUARDE PRÓX. TURNO)', 'var(--amber)');
          return;
        }
        if (!NB.Combat.canAttack(unit, state.player.field)) {
          NB.Physics.showToast('ESTA UNIDADE NÃO PODE ATACAR', 'var(--amber)');
          return;
        }
        const pos = state.selectedAttackers.indexOf(slotIdx);
        if (pos === -1) state.selectedAttackers.push(slotIdx);
        else state.selectedAttackers.splice(pos, 1);
        NB.Audio.playSelect();
        NB.Physics.vibrateCard();
        NB.UI.renderAll();
      } else if (side === 'enemy' && unit) {
        NB.UI.openVisorForField('enemy', slotIdx);
      }
      return;
    }

    if (state.phase === 'PLAYER_DEFENSE') {
      if (side === 'player' && unit) {
        if (!NB.Combat.canBlock(unit, state.player)) {
          NB.Physics.showToast('ESTA UNIDADE NÃO PODE BLOQUEAR', 'var(--amber)');
          return;
        }
        const existingEnemy = Object.keys(state.defenseMap).find(k => state.defenseMap[k] === slotIdx);
        if (state.enemyAttackers.length === 1) {
          const attacker = state.enemyAttackers[0];
          state.defenseDeclined = state.defenseMap[attacker] === slotIdx;
          if (state.defenseDeclined) delete state.defenseMap[attacker];
          else state.defenseMap[attacker] = slotIdx;
          state.activeDefenderSlot = null;
        } else if (NB.Combat.blockLimit(unit) > 1) {
          state.activeDefenderSlot = state.activeDefenderSlot === slotIdx ? null : slotIdx;
        } else if (state.activeDefenderSlot === slotIdx) {
          if (existingEnemy !== undefined) delete state.defenseMap[existingEnemy];
          state.activeDefenderSlot = null;
        } else {
          if (existingEnemy !== undefined) delete state.defenseMap[existingEnemy];
          state.activeDefenderSlot = slotIdx;
        }
        NB.Audio.playSelect();
        NB.Physics.vibrateCard();
        NB.UI.renderAll();
        return;
      }

      const isEnemyOcTarget = Boolean(state.enemyOverclock && state.enemyOverclock.slots.includes(slotIdx));
      const targetEnemyKey = isEnemyOcTarget ? state.enemyOverclock.slots[0] : slotIdx;

      if (side === 'enemy' && unit && (state.enemyAttackers.includes(slotIdx) || isEnemyOcTarget)) {
        if (state.activeDefenderSlot !== null) {
          const defenderSlot = state.activeDefenderSlot;
          const defender = state.player.field[defenderSlot];
          if (NB.Combat.blockLimit(defender) > 1) {
            if (state.defenseMap[targetEnemyKey] === defenderSlot) {
              delete state.defenseMap[targetEnemyKey];
            } else if (NB.Combat.hasBlockRoom(defender, state.player, state.defenseMap, defenderSlot)) {
              state.defenseMap[targetEnemyKey] = defenderSlot;
            } else {
              NB.Physics.showToast('LIMITE DE BLOQUEIOS ATINGIDO', 'var(--amber)');
              return;
            }
          } else {
            for (const key of Object.keys(state.defenseMap)) {
              if (state.defenseMap[key] === defenderSlot) delete state.defenseMap[key];
            }
            state.defenseMap[targetEnemyKey] = defenderSlot;
            state.activeDefenderSlot = null;
          }
          NB.Audio.playSelect();
          NB.Physics.vibrateCard();
          NB.UI.renderAll();
        } else if (state.defenseMap[targetEnemyKey] !== undefined) {
          delete state.defenseMap[targetEnemyKey];
          NB.Audio.playSelect();
          NB.UI.renderAll();
        } else {
          NB.Physics.showToast('TOQUE PRIMEIRO NA SUA UNIDADE PARA BLOQUEAR', 'var(--cyan)');
        }
        return;
      }
    }

    if (state.phase === 'PLAYER_MAIN') {
      if (unit) {
        state.selectedHandUid = null;
        NB.Audio.playSelect();
        NB.UI.renderAll();
        NB.UI.openVisorForField(side, slotIdx);
      } else if (side === 'player' && state.selectedHandUid) {
        const item = state.player.hand.find(c => c.uid === state.selectedHandUid);
        if (item && NB.Cards.CARD_DB[item.cardId].kind === 'unit') {
          const check = NB.State.canPlayHandCard('player', item);
          if (check.ok) {
            NB.UI.closeVisor();
            state.selectedHandUid = null;
            NB.State.deployUnit('player', item.uid, slotIdx);
          } else {
            NB.Physics.showToast(check.reason.toUpperCase(), 'var(--amber)');
          }
        }
      }
    }
  }

  const abandonFee = 3;
  function abandonmentCost(state) {
    if (state.boss?.travelReward) return NB.CityLife.travelWithdrawalFee();
    return state.mode === 'quick' || state.stake ? 0 : Math.min(abandonFee, NB.Save.get().city.credits);
  }

  function requestAbandon() {
    const state = NB.State.get();
    if (state.phase === 'GAME_OVER') return;
    const fee = abandonmentCost(state);
    const cost = state.stake ? `A aposta de ${state.stake} créditos fica com o Ringue.` :
      fee ? `Você perde ${fee} ${fee === 1 ? 'crédito' : 'créditos'}.` : 'Nenhum crédito será cobrado.';
    document.getElementById('abandon-cost').textContent = `O duelo termina como derrota. ${cost}`;
    document.getElementById('game-ui').inert = true;
    document.getElementById('abandon-modal').classList.add('open');
    document.getElementById('abandon-cancel').focus();
  }

  function closeAbandon() {
    const modal = document.getElementById('abandon-modal');
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    document.getElementById('game-ui').inert = false;
    const finished = NB.State.get().phase === 'GAME_OVER';
    document.getElementById(finished ? 'btn-go-primary' : 'btn-top-menu').focus();
  }

  function confirmAbandon() {
    if (!document.getElementById('abandon-modal').classList.contains('open')) return;
    const state = NB.State.get();
    if (state.phase === 'GAME_OVER') {
      closeAbandon();
      return;
    }
    const fee = abandonmentCost(state);
    state.phase = 'GAME_OVER';
    state.winner = 'enemy';
    if (state.boss?.travelReward) NB.CityLife.settleTravelChallenge(true);
    else NB.Save.get().city.credits -= fee;
    NB.Save.recordMatchLoss();
    if (state.mode === 'quick') openTitleScreen();
    else {
      const lost = state.stake || fee;
      openNetMap(lost ? `Você abandonou o duelo e perdeu ${lost} ${lost === 1 ? 'crédito' : 'créditos'}.` :
        'Você abandonou o duelo.');
    }
  }

  // True tells the Android activity that the game handled Back.
  function handleBack() {
    if (NB.Gallery.handleBack() || NB.DuelLog.handleBack()) return true;
    const isOpen = id => document.getElementById(id).classList.contains('open');
    const closeButtons = [
      ['abandon-modal', 'abandon-cancel'],
      ['street-rest-modal', 'street-rest-close'],
      ['starter-modal', 'starter-close'],
      ['prologue-modal', 'prologue-close'],
      ['card-inspector-modal', 'btn-insp-close'],
      ['png-modal', 'btn-png-close'],
      ['settings-modal', 'btn-settings-close'],
      ['story-modal', 'btn-story-close'],
      ['dossier-modal', 'btn-dossier-back'],
      ['deck-modal', 'btn-deck-close']
    ];
    for (const [modal, button] of closeButtons) {
      if (isOpen(modal)) {
        if (modal === 'settings-modal' && document.getElementById('btn-reset-save').dataset.confirm === '1') {
          NB.UI.renderSettingsModal();
        } else {
          document.getElementById(button).click();
        }
        return true;
      }
    }

    if (isOpen('title-modal')) return false;
    if (isOpen('netmap-modal')) return NB.City.handleBack();

    const state = NB.State.get();
    if (isOpen('gameover-modal')) {
      if (state.mode === 'quick') openTitleScreen();
      else openNetMap();
      return true;
    }
    if (isOpen('visor-layer')) {
      document.getElementById('btn-visor-close').click();
      return true;
    }
    if (!state) return false;

    if (['PLAYER_ATTACK', 'PLAYER_OVERCLOCK', 'SELECT_TARGET'].includes(state.phase)) {
      document.getElementById('btn-secondary-action').click();
      return true;
    }
    if (state.phase === 'PLAYER_DEFENSE' &&
        (state.activeDefenderSlot !== null || Object.keys(state.defenseMap).length > 0)) {
      if (state.activeDefenderSlot !== null) state.activeDefenderSlot = null;
      else state.defenseMap = {};
      NB.UI.renderAll();
      return true;
    }
    return false;
  }

  function bindEvents() {
    document.querySelectorAll('.slot').forEach(slotEl => {
      slotEl.addEventListener('click', () => {
        onTapBoardSlot(slotEl.dataset.side, Number(slotEl.dataset.slot));
      });
    });

    // OVERCLOCK (3 RAM)
    document.getElementById('btn-overclock').addEventListener('click', () => {
      const state = NB.State.get();
      if (!state || state.phase !== 'PLAYER_ATTACK') return;
      const readySlots = [];
      state.player.field.forEach((u, idx) => {
        if (NB.Combat.canAttack(u, state.player.field)) readySlots.push(idx);
      });
      if (state.player.ram < NB.Cards.OVERCLOCK_COST || readySlots.length < 2) return;

      state.phase = 'PLAYER_OVERCLOCK';
      state.selectedAttackers = [];
      state.overclockUnits = [];
      NB.Audio.playSelect();
      NB.Physics.vibrateCard();
      NB.Physics.showToast('TOQUE EM 2 UNIDADES PRONTAS', 'var(--ram)');
      NB.UI.renderAll();
    });

    // Ações de Fase
    document.getElementById('btn-primary-action').addEventListener('click', () => {
      const state = NB.State.get();
      if (!state) return;
      if (state.phase === 'PLAYER_MAIN') {
        NB.UI.closeVisor();
        state.selectedHandUid = null;
        const hasReady = state.player.field.some(u => NB.Combat.canAttack(u, state.player.field));
        if (hasReady) {
          state.phase = 'PLAYER_ATTACK';
          state.selectedAttackers = [];
          NB.Audio.playSelect();
          NB.UI.renderAll();
        } else {
          NB.Audio.playSelect();
          NB.AI.startEnemyTurn();
        }
      } else if (state.phase === 'PLAYER_ATTACK') {
        NB.Combat.confirmPlayerAttack();
      } else if (state.phase === 'PLAYER_OVERCLOCK') {
        NB.Combat.executeOverclockAttack();
      } else if (state.phase === 'PLAYER_DEFENSE') {
        NB.Combat.confirmPlayerDefense();
      }
    });

    document.getElementById('btn-secondary-action').addEventListener('click', () => {
      const state = NB.State.get();
      if (!state) return;
      NB.Audio.playSelect();
      if (state.phase === 'PLAYER_ATTACK') {
        state.phase = 'PLAYER_MAIN';
        state.selectedAttackers = [];
        NB.UI.renderAll();
      } else if (state.phase === 'PLAYER_OVERCLOCK') {
        state.phase = 'PLAYER_ATTACK';
        state.overclockUnits = [];
        NB.Physics.clearLasers();
        NB.UI.renderAll();
      } else if (state.phase === 'SELECT_TARGET') {
        cancelTargetMode();
      }
    });

    // Visor Tático
    document.getElementById('btn-visor-exec').addEventListener('click', () => attemptExecuteSelectedCard());
    const dismissVisor = () => {
      const state = NB.State.get();
      if (state) {
        state.selectedHandUid = null;
        state.inspectFieldCard = null;
      }
      NB.UI.closeVisor();
      NB.UI.renderAll();
    };
    document.getElementById('btn-visor-close').addEventListener('click', dismissVisor);
    document.getElementById('btn-visor-cancel').addEventListener('click', dismissVisor);
    document.getElementById('visor-layer').addEventListener('click', (e) => {
      if (e.target.id === 'visor-layer') dismissVisor();
    });

    document.addEventListener('click', event => {
      if (event.isTrusted && !event.target.closest('#btn-title-sound, #btn-sound, #btn-settings-sound')) {
        NB.Audio.activateOnEntry(true);
      }
    }, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && NB.Audio.enabled) NB.Audio.resume();
    });
    // Navegação Tela Inicial
    document.getElementById('starter-close').addEventListener('click', closeStarterChoice);
    document.getElementById('btn-start-campaign').addEventListener('click', () => {
      NB.Audio.activateOnEntry();
      NB.Audio.playSelect();
      NB.Physics.vibrateCard();
      const progress = NB.Save.get();
      if (progress.prologueSeen) openNetMap();
      else if (!progress.starterDeck) openStarterChoice();
      else NB.StoryUI.openPrologue();
    });
    document.getElementById('btn-new-game-plus').addEventListener('click', () => {
      if (!NB.Save.startNewGamePlus()) return;
      NB.City.resetView();
      NB.UI.renderTitleStats();
      NB.StoryUI.openPrologue();
    });
    document.getElementById('btn-quick-duel').addEventListener('click', () => {
      NB.Physics.vibrateCard();
      startMatch({ mode: 'quick', boss: NB.Campaign.getRandomBoss() });
    });
    document.getElementById('btn-title-deck').addEventListener('click', () => {
      NB.Audio.playSelect();
      NB.Physics.vibrateCard();
      NB.DeckBuilder.open('title');
    });

    // Navegação Mapa da Net
    document.getElementById('btn-netmap-deck').addEventListener('click', () => {
      NB.Audio.playSelect();
      NB.Physics.vibrateCard();
      NB.City.cancelJob();
      NB.DeckBuilder.open('netmap');
    });
    document.getElementById('btn-netmap-back').addEventListener('click', () => {
      NB.Audio.playSelect();
      openTitleScreen();
    });
    // Dossiê do Alvo
    document.getElementById('btn-dossier-back').addEventListener('click', () => {
      NB.Audio.playSelect();
      document.getElementById('dossier-modal').classList.remove('open');
      document.querySelector('.city-panel').inert = false;
      document.querySelector('#city-content button')?.focus();
    });
    document.getElementById('btn-dossier-duel').addEventListener('click', (e) => {
      const bossId = e.currentTarget.dataset.bossId;
      if (NB.City.access(NB.CityData.districts.find(district => district.id === bossId))) return;
      const boss = NB.Campaign.getNodeById(bossId);
      NB.Physics.vibrateExploit();
      startMatch({ mode: 'campaign', boss });
    });

    // Pós-Duelo / Extração de Dados
    const handlePostDuelAction = (action) => {
      const state = NB.State.get();
      if (action === 'netmap') openNetMap();
      else if (action === 'title') openTitleScreen();
      else if (action === 'quick') startMatch({ mode: 'quick', boss: NB.Campaign.getRandomBoss(), autoSound: false });
      else if (action === 'rematch') startMatch({ mode: state.mode, boss: state.boss, challenge: state.challenge, autoSound: false });
    };
    document.getElementById('btn-go-primary').addEventListener('click', (e) => {
      NB.Audio.playSelect();
      handlePostDuelAction(e.currentTarget.dataset.action);
    });
    document.getElementById('btn-go-secondary').addEventListener('click', (e) => {
      NB.Audio.playSelect();
      handlePostDuelAction(e.currentTarget.dataset.action);
    });

    document.getElementById('btn-top-menu').addEventListener('click', requestAbandon);
    document.getElementById('abandon-cancel').addEventListener('click', closeAbandon);
    document.getElementById('abandon-confirm').addEventListener('click', confirmAbandon);
    document.getElementById('abandon-modal').addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAbandon();
    });

    // Áudio
    document.getElementById('btn-title-sound').addEventListener('click', () => NB.Audio.toggle());
    document.getElementById('btn-sound').addEventListener('click', () => NB.Audio.toggle());
    document.getElementById('btn-settings-sound').addEventListener('click', () => NB.Audio.toggle());

    document.querySelectorAll('[data-audio-channel]').forEach(input => {
      input.addEventListener('input', () => {
        NB.Audio.setVolume(input.dataset.audioChannel, input.valueAsNumber);
        NB.UI.renderVolumeControls();
      });
    });
    document.getElementById('volume-sfx').addEventListener('change', () => NB.Audio.playSelect());

    // Configurações & Resetar Save
    const openSettings = () => {
      document.getElementById('btn-netmap-back').hidden = !document.getElementById('netmap-modal').classList.contains('open');
      NB.Audio.playSelect();
      NB.UI.renderSettingsModal();
      document.getElementById('settings-modal').classList.add('open');
    };
    document.getElementById('btn-title-settings').addEventListener('click', openSettings);
    document.getElementById('btn-netmap-settings').addEventListener('click', openSettings);
    document.getElementById('btn-settings-close').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('open');
    });
    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') {
        document.getElementById('settings-modal').classList.remove('open');
      }
    });

    document.getElementById('btn-reset-save').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.textContent = 'CONFIRMAR RESET?';
        btn.classList.add('confirming');
        NB.Physics.vibrateCard();
        return;
      }
      NB.Save.resetSave();
      NB.Audio.playDestroy();
      NB.Physics.vibrateDamage();
      NB.UI.renderSettingsModal();
      NB.UI.renderTitleStats();
      NB.City.resetView();
      NB.Physics.showToast('SAVE RESETADO COM SUCESSO', 'var(--amber)');
    });

    // Modal PNG
    const openPng = () => {
      NB.UI.renderPngModal();
      document.getElementById('png-modal').classList.add('open');
    };
    document.getElementById('btn-png-modal').addEventListener('click', openPng);
    document.getElementById('btn-png-close').addEventListener('click', () => {
      document.getElementById('png-modal').classList.remove('open');
    });
    document.getElementById('png-modal').addEventListener('click', (e) => {
      if (e.target.id === 'png-modal') {
        document.getElementById('png-modal').classList.remove('open');
      }
    });

    if (NB.DeckBuilder && NB.DeckBuilder.bindEvents) {
      NB.DeckBuilder.bindEvents();
    }

    window.addEventListener('resize', () => {
      NB.Physics.resize();
      const state = NB.State.get();
      if (!state) return;
      if (state.phase === 'PLAYER_DEFENSE') {
        NB.Physics.drawDefenseLasers('enemy', state.defenseMap);
        if (state.enemyOverclock) {
          NB.Physics.drawEnemyOverclockLink(state.enemyOverclock.slots[0], state.enemyOverclock.slots[1]);
        }
      } else if (state.phase === 'PLAYER_OVERCLOCK' && state.overclockUnits.length === 2) {
        NB.Physics.drawOverclockLink(state.overclockUnits[0], state.overclockUnits[1]);
      }
    });
  }

  NB.Input = {
    bindEvents,
    handleBack,
    closeAbandon,
    openTitleScreen,
    openNetMap,
    startMatch,
    startPlayerTurn,
    onTapHandCard,
    onTapBoardSlot,
    attemptExecuteSelectedCard,
    cancelTargetMode
  };
})(window.NB = window.NB || {});
