(function (NB) {
  'use strict';

  /* Controlador de Entrada Touch, Navegação entre Telas, Campanha, Overclock e Save */
  function hideAllScreens() {
    NB.City.cancelJob();
    ['title-modal', 'netmap-modal', 'dossier-modal', 'gameover-modal', 'settings-modal', 'deck-modal', 'card-inspector-modal'].forEach(id => {
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

  function openNetMap() {
    hideAllScreens();
    NB.UI.closeVisor();
    NB.Physics.clearLasers();
    NB.Physics.cancelUiTransitions();
    NB.State.cancelPending();
    NB.Audio.setScene('city');
    NB.City.open();
  }

  function startMatch(options = {}) {
    const mode = options.mode || 'campaign';
    const boss = options.boss || (mode === 'quick' ? NB.Campaign.getRandomBoss() : NB.Campaign.NODES[0]);

    if (options.autoSound !== false) NB.Audio.activateOnEntry();

    hideAllScreens();
    document.getElementById('game-ui').inert = false;
    NB.Audio.setScene(boss.id, true);
    NB.State.reset({ mode, boss, stake: options.stake });
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
    NB.Physics.showToast(`CONEXÃO: ${boss.name} · TURNO 1`, 'var(--cyan)');
  }

  function startPlayerTurn() {
    if (NB.State.checkWinCondition()) return;
    const state = NB.State.get();
    state.turn++;
    state.phase = 'PLAYER_MAIN';
    state.player.summonedThisTurn = false;
    state.selectedAttackers = [];
    state.overclockUnits = [];
    state.enemyOverclock = null;
    state.selectedHandUid = null;
    state.pendingExploit = null;
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
    state.pendingExploit = null;
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
    const validSlots = [];
    state[targetSide].field.forEach((u, idx) => { if (u) validSlots.push(idx); });

    if (validSlots.length === 1) {
      state.selectedHandUid = null;
      NB.State.executeExploit('player', item.uid, validSlots[0]);
    } else if (validSlots.length > 1) {
      state.phase = 'SELECT_TARGET';
      state.pendingExploit = { uid: item.uid, cardId: card.id, targetSide };
      state.selectedHandUid = null;
      NB.Physics.showToast('SELECIONE O ALVO NO CAMPO', 'var(--ram)');
      NB.UI.renderAll();
    }
  }

  function onTapBoardSlot(side, slotIdx) {
    const state = NB.State.get();
    const unit = state[side].field[slotIdx];

    if (state.phase === 'SELECT_TARGET' && state.pendingExploit) {
      if (side === state.pendingExploit.targetSide && unit) {
        const { uid } = state.pendingExploit;
        state.pendingExploit = null;
        state.phase = 'PLAYER_MAIN';
        NB.State.executeExploit('player', uid, slotIdx);
      }
      return;
    }

    if (state.phase === 'PLAYER_OVERCLOCK') {
      if (side === 'player' && unit) {
        if (unit.booting || unit.attacked) {
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
        if (unit.attacked) return;
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
        const existingEnemy = Object.keys(state.defenseMap).find(k => state.defenseMap[k] === slotIdx);
        if (state.activeDefenderSlot === slotIdx) {
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
          for (const k of Object.keys(state.defenseMap)) {
            if (state.defenseMap[k] === state.activeDefenderSlot) {
              delete state.defenseMap[k];
            }
          }
          state.defenseMap[targetEnemyKey] = state.activeDefenderSlot;
          state.activeDefenderSlot = null;
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

  // True tells the Android activity that the game handled Back.
  function handleBack() {
    const isOpen = id => document.getElementById(id).classList.contains('open');
    const closeButtons = [
      ['card-inspector-modal', 'btn-insp-close'],
      ['png-modal', 'btn-png-close'],
      ['settings-modal', 'btn-settings-close'],
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
        if (u && !u.booting && !u.attacked) readySlots.push(idx);
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
        const hasReady = state.player.field.some(u => u && !u.booting && !u.attacked);
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

    // A WebView inicia a abertura automaticamente. No navegador, use uma interação.
    document.getElementById('title-modal').addEventListener('click', (event) => {
      if (!event.target.closest('button')) NB.Audio.activateOnEntry();
    });
    // Navegação Tela Inicial
    document.getElementById('btn-start-campaign').addEventListener('click', () => {
      NB.Audio.activateOnEntry();
      NB.Audio.playSelect();
      NB.Physics.vibrateCard();
      openNetMap();
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
      else if (action === 'rematch') startMatch({ mode: state.mode, boss: state.boss, autoSound: false });
    };
    document.getElementById('btn-go-primary').addEventListener('click', (e) => {
      NB.Audio.playSelect();
      handlePostDuelAction(e.currentTarget.dataset.action);
    });
    document.getElementById('btn-go-secondary').addEventListener('click', (e) => {
      NB.Audio.playSelect();
      handlePostDuelAction(e.currentTarget.dataset.action);
    });

    // Botão Menu/Mapa no topo durante o duelo
    document.getElementById('btn-top-menu').addEventListener('click', () => {
      NB.Audio.playSelect();
      const state = NB.State.get();
      if (state.mode === 'arena' && state.stake && !state.winner && !window.confirm(`Sair encerra o duelo e perde ${state.stake} créditos. Sair mesmo assim?`)) return;
      if (state && (state.mode === 'campaign' || state.mode === 'arena')) openNetMap();
      else openTitleScreen();
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
