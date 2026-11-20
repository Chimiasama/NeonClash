(function (NB) {
  'use strict';

  function buildKeywordStrip(cardDef, compact = false) {
    if (!cardDef || !cardDef.keywords || cardDef.keywords.length === 0) return null;
    const strip = document.createElement('div');
    strip.className = 'kw-strip';
    cardDef.keywords.forEach(kwId => {
      const kw = NB.Cards.KEYWORDS[kwId];
      if (!kw) return;
      const chip = document.createElement('span');
      chip.className = 'kw-chip';
      chip.style.color = kw.color;
      chip.textContent = compact ? `${kw.icon}${kw.short}` : `${kw.icon} ${kw.short}`;
      strip.appendChild(chip);
    });
    return strip;
  }

  function renderAll() {
    const state = NB.State.get();
    if (!state) return;

    const boss = state.boss || NB.Campaign.NODES[0];
    document.getElementById('turn-badge').textContent = 'T' + state.turn;
    document.getElementById('enemy-name-label').textContent = boss.fullTitle;

    document.getElementById('enemy-hp-text').textContent = `${state.enemy.hp}/${state.enemy.maxHp} HP`;
    document.getElementById('enemy-ram-text').textContent = `${state.enemy.ram} RAM`;
    document.getElementById('enemy-deck-text').textContent = `D:${state.enemy.deck.length} M:${state.enemy.hand.length}`;
    document.getElementById('enemy-hp-bar').style.width = `${(state.enemy.hp / state.enemy.maxHp) * 100}%`;

    document.getElementById('player-hp-text').textContent = `${state.player.hp}/${state.player.maxHp} HP`;
    document.getElementById('player-ram-text').textContent = `${state.player.ram} RAM`;
    document.getElementById('player-deck-text').textContent = `DECK: ${state.player.deck.length} · DESC: ${state.player.discard.length}`;
    document.getElementById('player-hp-bar').style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;

    const summonInd = document.getElementById('player-summon-text');
    if (state.player.summonedThisTurn) {
      summonInd.textContent = 'UNIDADE: 0/1';
      summonInd.classList.remove('avail');
    } else {
      summonInd.textContent = 'UNIDADE: 1/1';
      summonInd.classList.add('avail');
    }

    renderPhaseStripAndButtons(state);
    renderBoard(state, 'enemy');
    renderBoard(state, 'player');
    renderHand(state);

    if (state.phase === 'PLAYER_DEFENSE') {
      requestAnimationFrame(() => {
        NB.Physics.drawDefenseLasers('enemy', state.defenseMap);
        if (state.enemyOverclock) {
          NB.Physics.drawEnemyOverclockLink(state.enemyOverclock.slots[0], state.enemyOverclock.slots[1]);
        }
      });
    } else if (state.phase === 'PLAYER_OVERCLOCK') {
      if (state.overclockUnits.length === 2) {
        requestAnimationFrame(() => NB.Physics.drawOverclockLink(state.overclockUnits[0], state.overclockUnits[1]));
      } else {
        NB.Physics.clearLasers();
      }
    }
  }

  function renderPhaseStripAndButtons(state) {
    const strip = document.getElementById('phase-strip');
    const lbl = document.getElementById('phase-label');
    const hint = document.getElementById('phase-hint');
    const btnP = document.getElementById('btn-primary-action');
    const btnS = document.getElementById('btn-secondary-action');
    const ocBar = document.getElementById('overclock-bar');
    const btnOc = document.getElementById('btn-overclock');
    const bossName = state.boss ? state.boss.name : 'VEX';

    strip.className = 'phase-strip';
    btnP.className = 'btn-primary chamfer-sm';
    btnP.disabled = false;
    btnS.style.display = 'none';
    ocBar.classList.remove('visible');

    const readyUnits = state.player.field.filter(u => u && !u.booting && !u.attacked);
    const readyCount = readyUnits.length;

    if (state.phase === 'PLAYER_MAIN') {
      lbl.textContent = 'FASE PRINCIPAL';
      hint.textContent = state.selectedHandUid
        ? 'Toque de novo na carta ou em EXECUTAR'
        : 'Baixe 1 Unidade (+2 RAM) ou use Exploits';
      if (readyCount > 0) {
        btnP.textContent = 'ATACAR';
        btnP.classList.add('amber');
      } else {
        btnP.textContent = 'ENCERRAR';
      }
    } else if (state.phase === 'SELECT_TARGET') {
      strip.classList.add('mode-target');
      lbl.textContent = 'ESCOLHER ALVO';
      hint.textContent = state.pendingExploit.targetSide === 'player'
        ? 'Toque numa Unidade ALIADA destacada'
        : 'Toque numa Unidade INIMIGA destacada';
      btnP.textContent = 'AGUARDANDO';
      btnP.disabled = true;
      btnS.style.display = 'block';
      btnS.textContent = 'CANCELAR';
    } else if (state.phase === 'PLAYER_ATTACK') {
      strip.classList.add('mode-attack');
      lbl.textContent = 'FASE DE ATAQUE';
      const n = state.selectedAttackers.length;
      hint.textContent = n > 0
        ? `${n} atacante(s) selecionado(s)`
        : 'Toque nas unidades prontas ou use OVERCLOCK';
      btnP.textContent = n > 0 ? `CONFIRMAR (${n})` : 'ENCERRAR';
      if (n > 0) btnP.classList.add('amber');
      btnS.style.display = 'block';
      btnS.textContent = 'VOLTAR';

      ocBar.classList.add('visible');
      const canOverclock = state.player.ram >= NB.Cards.OVERCLOCK_COST && readyCount >= 2;
      btnOc.disabled = !canOverclock;
      btnOc.textContent = `⚡ OVERCLOCK (${NB.Cards.OVERCLOCK_COST} RAM)`;
    } else if (state.phase === 'PLAYER_OVERCLOCK') {
      strip.classList.add('mode-overclock');
      lbl.textContent = 'OVERCLOCK · UNITE';
      const sel = state.overclockUnits;
      if (sel.length === 2) {
        const totalAtk = (state.player.field[sel[0]]?.atk || 0) + (state.player.field[sel[1]]?.atk || 0);
        const first = state.player.field[sel[0]];
        const second = state.player.field[sel[1]];
        hint.textContent = NB.Combat.overclockSynergy(first, second)
          ? `${totalAtk} ATK · +1 de sinergia contra bloqueador`
          : `Conectadas! Golpe combinado ${totalAtk} ATK + Perfuração`;
        btnP.textContent = `DISPARAR (${totalAtk})`;
        btnP.classList.add('ram-surge');
        btnP.disabled = false;
      } else {
        hint.textContent = `Toque em 2 unidades prontas (${sel.length}/2)`;
        btnP.textContent = `UNIDADES (${sel.length}/2)`;
        btnP.disabled = true;
      }
      btnS.style.display = 'block';
      btnS.textContent = 'CANCELAR';
    } else if (state.phase === 'PLAYER_DEFENSE') {
      strip.classList.add('mode-defense');
      if (state.enemyOverclock) {
        lbl.textContent = `⚡ OVERCLOCK ${state.enemyOverclock.combinedAtk} ATK`;
        hint.textContent = state.activeDefenderSlot !== null
          ? 'Toque numa unidade ligada do chefe para amortecer'
          : 'Ataque combinado com Perfuração! Bloqueie ou confirme';
      } else {
        lbl.textContent = 'FASE DE DEFESA';
        if (state.activeDefenderSlot !== null) {
          hint.textContent = 'Agora toque no atacante INIMIGO para bloquear';
        } else if (!state.player.field.some(Boolean)) {
          hint.textContent = 'Sem unidades para bloquear — confirme';
        } else {
          hint.textContent = 'Toque sua unidade e depois o atacante inimigo';
        }
      }
      btnP.textContent = 'CONFIRMAR DEFESA';
      btnP.classList.add('magenta');
    } else if (state.phase === 'ENEMY_TURN' || state.phase === 'COMBAT_ANIM') {
      strip.classList.add('mode-defense');
      lbl.textContent = state.phase === 'COMBAT_ANIM' ? 'COMBATE' : `TURNO DE ${bossName}`;
      hint.textContent = state.phase === 'COMBAT_ANIM' ? 'Resolvendo impactos...' : 'Oponente executando protocolo...';
      btnP.textContent = 'AGUARDE';
      btnP.disabled = true;
    } else if (state.phase === 'GAME_OVER') {
      lbl.textContent = 'FIM DE JOGO';
      hint.textContent = state.winner === 'player' ? `${bossName} desconectado` : 'Kairo desconectado';
      btnP.disabled = true;
    }
  }

  function renderBoard(state, side) {
    const CARD_DB = NB.Cards.CARD_DB;
    for (let i = 0; i < 3; i++) {
      const slotEl = NB.State.getSlotEl(side, i);
      const unit = state[side].field[i];
      slotEl.innerHTML = '';
      slotEl.classList.remove('highlight-deploy');

      if (!unit) {
        const empty = document.createElement('div');
        empty.className = 'slot-empty-tag';
        empty.textContent = `SLOT 0${i + 1}`;
        slotEl.appendChild(empty);

        if (
          side === 'player' &&
          state.phase === 'PLAYER_MAIN' &&
          state.selectedHandUid &&
          !state.player.summonedThisTurn
        ) {
          const hItem = state.player.hand.find(c => c.uid === state.selectedHandUid);
          if (hItem && CARD_DB[hItem.cardId].kind === 'unit') {
            slotEl.classList.add('highlight-deploy');
          }
        }
        continue;
      }

      const def = CARD_DB[unit.cardId];
      const cardEl = document.createElement('div');
      cardEl.className = 'field-card chamfer-sm' + (side === 'enemy' ? ' enemy-side' : '');

      const isEnemyOcMember = Boolean(
        side === 'enemy' &&
        state.phase === 'PLAYER_DEFENSE' &&
        state.enemyOverclock &&
        state.enemyOverclock.slots.includes(i)
      );

      if (NB.Cards.hasKeyword(def, 'FIREWALL')) cardEl.classList.add('firewall-aura');
      if (unit.booting) cardEl.classList.add('booting');
      if (
        side === 'player' &&
        !unit.booting &&
        !unit.attacked &&
        (state.phase === 'PLAYER_MAIN' || state.phase === 'PLAYER_ATTACK' || state.phase === 'PLAYER_OVERCLOCK')
      ) {
        cardEl.classList.add('ready-glow');
      }
      if (side === 'player' && state.selectedAttackers.includes(i)) {
        cardEl.classList.add('selected-attacker');
      }
      if (side === 'player' && state.phase === 'PLAYER_OVERCLOCK' && state.overclockUnits.includes(i)) {
        cardEl.classList.add('overclock-linked');
      }
      if (side === 'enemy' && state.phase === 'PLAYER_DEFENSE' && (state.enemyAttackers.includes(i) || isEnemyOcMember)) {
        cardEl.classList.add('enemy-attacking');
        if (state.activeDefenderSlot !== null) cardEl.classList.add('targetable');
      }
      if (side === 'player' && state.phase === 'PLAYER_DEFENSE') {
        if (state.activeDefenderSlot === i) cardEl.classList.add('selected-blocker');
        if (Object.values(state.defenseMap).includes(i)) cardEl.classList.add('is-blocking');
      }
      if (state.phase === 'SELECT_TARGET' && state.pendingExploit && state.pendingExploit.targetSide === side) {
        cardEl.classList.add('targetable');
      }

      const artWrap = document.createElement('div');
      artWrap.className = 'card-art-wrap';
      artWrap.appendChild(NB.Sprites.createArtMarkup(def.id, def.img, def.name));

      const sheen = document.createElement('div');
      sheen.className = 'holo-sheen';
      artWrap.appendChild(sheen);

      const hdr = document.createElement('div');
      hdr.className = 'field-card-header';
      const nm = document.createElement('span');
      nm.className = 'field-card-name';
      nm.textContent = def.name;
      hdr.appendChild(nm);
      const affinity = NB.Cards.AFFINITIES[unit.affinity];
      if (affinity) {
        const mark = document.createElement('span');
        mark.className = 'field-affinity';
        mark.style.color = affinity.color;
        mark.textContent = affinity.icon;
        mark.title = affinity.name;
        hdr.appendChild(mark);
      }
      artWrap.appendChild(hdr);

      let ribText = '';
      let ribCls = '';
      if (side === 'player' && state.phase === 'PLAYER_OVERCLOCK' && state.overclockUnits.includes(i)) {
        ribText = `UNITE #${state.overclockUnits.indexOf(i) + 1}`; ribCls = 'oc';
      } else if (side === 'player' && state.selectedAttackers.includes(i)) {
        ribText = 'ATACAR'; ribCls = 'atk';
      } else if (isEnemyOcMember) {
        const primarySlot = state.enemyOverclock.slots[0];
        ribText = state.defenseMap[primarySlot] !== undefined ? 'UNITE BLOQ.' : `⚡ UNITE ${state.enemyOverclock.combinedAtk}`;
        ribCls = state.defenseMap[primarySlot] !== undefined ? 'blk' : 'atk';
      } else if (side === 'enemy' && state.phase === 'PLAYER_DEFENSE' && state.enemyAttackers.includes(i)) {
        ribText = state.defenseMap[i] !== undefined ? 'BLOQUEADO' : 'ATACANDO';
        ribCls = state.defenseMap[i] !== undefined ? 'blk' : 'atk';
      } else if (side === 'player' && state.phase === 'PLAYER_DEFENSE' && state.activeDefenderSlot === i) {
        ribText = 'SELECIONADO'; ribCls = 'zd';
      } else if (side === 'player' && state.phase === 'PLAYER_DEFENSE' && Object.values(state.defenseMap).includes(i)) {
        ribText = 'BLOQUEANDO'; ribCls = 'blk';
      } else if (unit.booting) {
        ribText = 'BOOTING'; ribCls = 'boot';
      } else if (NB.Cards.hasKeyword(def, 'ZERO_DAY') && unit.justEntered) {
        ribText = 'ZERO-DAY'; ribCls = 'zd';
      } else if (unit.attacked) {
        ribText = 'EXAUSTO'; ribCls = 'done';
      }

      if (ribText) {
        const rib = document.createElement('div');
        rib.className = 'state-ribbon ' + ribCls;
        rib.textContent = ribText;
        artWrap.appendChild(rib);
      }

      const kwStrip = buildKeywordStrip(def, false);
      if (kwStrip) artWrap.appendChild(kwStrip);

      cardEl.appendChild(artWrap);

      const stats = document.createElement('div');
      stats.className = 'field-card-stats tabular';
      const atkCls = unit.atk > unit.baseAtk
        ? 'stat-box atk buffed'
        : (unit.atk < unit.baseAtk ? 'stat-box atk debuffed' : 'stat-box atk');
      const defCls = unit.def < unit.maxDef
        ? 'stat-box def damaged'
        : (unit.def > def.def ? 'stat-box def buffed' : 'stat-box def');
      stats.innerHTML = `
        <div class="${atkCls}"><span class="lbl">A</span>${unit.atk}</div>
        <div class="${defCls}"><span class="lbl">D</span>${unit.def}</div>
      `;
      cardEl.appendChild(stats);
      slotEl.appendChild(cardEl);
    }
  }

  function renderHand(state) {
    const CARD_DB = NB.Cards.CARD_DB;
    const zone = document.getElementById('hand-zone');
    zone.innerHTML = '';

    if (state.player.hand.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'hand-empty';
      empty.textContent = 'MÃO VAZIA';
      zone.appendChild(empty);
      return;
    }

    state.player.hand.forEach(item => {
      const card = CARD_DB[item.cardId];
      const canPlay = state.phase === 'PLAYER_MAIN' && NB.State.canPlayHandCard('player', item).ok;
      const isSelected = state.selectedHandUid === item.uid;

      const el = document.createElement('div');
      el.className = 'hand-card chamfer-sm' +
        (card.kind === 'exploit' ? ' type-exploit' : '') +
        (!canPlay && !isSelected ? ' unplayable' : '') +
        (isSelected ? ' selected' : '') +
        (state.lastDrawnUid === item.uid ? ' anim-draw' : '');

      const artWrap = document.createElement('div');
      artWrap.className = 'card-art-wrap';
      artWrap.appendChild(NB.Sprites.createArtMarkup(card.id, card.img, card.name));

      const sheen = document.createElement('div');
      sheen.className = 'holo-sheen';
      artWrap.appendChild(sheen);

      const badge = document.createElement('div');
      badge.className = 'hand-card-badge tabular ' + (card.kind === 'unit' ? 'ram-gain' : 'ram-cost');
      badge.textContent = card.kind === 'unit' ? `+${card.ramGain}R` : `-${card.cost}R`;
      artWrap.appendChild(badge);

      const kwStrip = buildKeywordStrip(card, true);
      if (kwStrip) artWrap.appendChild(kwStrip);

      el.appendChild(artWrap);

      if (isSelected && canPlay) {
        const cue = document.createElement('div');
        cue.className = 'tap-again-cue';
        cue.textContent = 'TOQUE P/ USAR';
        el.appendChild(cue);
      }

      const footer = document.createElement('div');
      footer.className = 'hand-card-footer';
      const nm = document.createElement('div');
      nm.className = 'hand-card-name';
      nm.textContent = card.name;
      const nums = document.createElement('div');
      nums.className = 'hand-card-nums tabular';
      if (card.kind === 'unit') {
        nums.innerHTML = `<span class="a">${card.atk}</span>/<span class="d">${card.def}</span> <span>${NB.Cards.AFFINITIES[NB.Save.getAffinity(card.id)]?.icon || ''}</span>`;
      } else {
        nums.innerHTML = `<span class="e">EXPLOIT</span>`;
      }
      footer.appendChild(nm);
      footer.appendChild(nums);
      el.appendChild(footer);

      el.addEventListener('click', () => NB.Input.onTapHandCard(item.uid));
      zone.appendChild(el);
    });

    state.lastDrawnUid = null;
  }

  function renderVisorKeywords(card) {
    const kwBox = document.getElementById('visor-keywords');
    kwBox.innerHTML = '';
    if (!card.keywords || card.keywords.length === 0) {
      kwBox.style.display = 'none';
      return;
    }
    kwBox.style.display = 'flex';
    card.keywords.forEach(kwId => {
      const kw = NB.Cards.KEYWORDS[kwId];
      if (!kw) return;
      const tag = document.createElement('span');
      tag.className = 'visor-kw-tag';
      tag.style.color = kw.color;
      tag.textContent = `${kw.icon} ${kw.tag}`;
      kwBox.appendChild(tag);
    });
  }

  function renderEnemyAvatar(boss) {
    const target = boss || NB.Campaign.NODES[0];
    const box = document.getElementById('enemy-avatar-box');
    box.innerHTML = '';
    box.style.borderColor = target.accent || 'var(--magenta)';
    box.appendChild(NB.Sprites.createArtMarkup(target.id, target.avatar, target.fullTitle, target.fallbackArt));
  }

  /* Tela Inicial — Estatísticas do Save */
  function renderTitleStats() {
    const save = NB.Save.get();
    const el = document.getElementById('title-progress-strip');
    if (el) {
      el.innerHTML = `
        <span>NÓS INVADIDOS: ${save.defeatedBosses.length}/4</span>
        <span>CARTAS: ${save.unlockedCards.length}/${Object.keys(NB.Cards.CARD_DB).length}</span>
        <span>PISTAS: ${save.clues.length}/4</span>
      `;
    }
  }

  /* Modal Dossiê do Alvo */
  function openDossier(bossId) {
    const boss = NB.Campaign.getNodeById(bossId);
    NB.Audio.setScene(boss.id);
    document.getElementById('dossier-node-code').textContent = `${boss.nodeCode} · ${boss.hp} HP`;
    document.getElementById('dossier-title').textContent = boss.fullTitle;
    document.getElementById('dossier-archetype').textContent = boss.archetype;

    const avBox = document.getElementById('dossier-avatar');
    avBox.innerHTML = '';
    avBox.style.borderColor = boss.accent;
    avBox.appendChild(NB.Sprites.createArtMarkup(boss.id, boss.avatar, boss.fullTitle));

    const dlgBox = document.getElementById('dossier-dialogue');
    dlgBox.innerHTML = '';
    boss.dossierDialogue.forEach(line => {
      const div = document.createElement('div');
      div.className = 'dialogue-turn';
      const isKairo = line.speaker === 'KAIRO';
      div.innerHTML = `
        <span class="dialogue-speaker ${isKairo ? 'kairo' : 'target'}">${line.speaker}</span>
        "${line.text}"
      `;
      dlgBox.appendChild(div);
    });

    const rewardPreview = (boss.rewardCards || [])
      .map(cid => NB.Cards.CARD_DB[cid]?.name)
      .filter(Boolean)
      .join(' + ');
    const cleared = NB.Save.isNodeDefeated(boss.id);
    document.getElementById('dossier-reward-line').textContent = cleared
      ? `Recompensas já extraídas (${rewardPreview})`
      : `Vitória: ${rewardPreview} · pista · ${NB.CityData.campaignCredits(boss)} créditos`;

    const launchBtn = document.getElementById('btn-dossier-duel');
    launchBtn.dataset.bossId = boss.id;

    document.querySelector('.city-panel').inert = true;
    document.getElementById('dossier-modal').classList.add('open');
    document.querySelector('.dossier-content').scrollTop = 0;
    document.getElementById('btn-dossier-back').focus();
  }

  /* Tela Pós-Duelo / Extração de Dados Concluída */
  function showGameOverModal(winner, state, campaignResult) {
    const modal = document.getElementById('gameover-modal');
    const panel = document.getElementById('gameover-panel');
    const kicker = document.getElementById('go-kicker');
    const title = document.getElementById('go-title');
    const clueBox = document.getElementById('go-clue-box');
    const rewardWrap = document.getElementById('go-rewards-wrap');
    const rewardGrid = document.getElementById('go-rewards-grid');
    const nextNodeBanner = document.getElementById('go-next-node');
    const primaryBtn = document.getElementById('btn-go-primary');
    const secondaryBtn = document.getElementById('btn-go-secondary');
    const boss = state.boss || NB.Campaign.NODES[0];

    panel.classList.remove('victory', 'defeat');
    clueBox.style.display = 'none';
    rewardWrap.style.display = 'none';
    nextNodeBanner.style.display = 'none';

    if (winner === 'player' && state.mode === 'campaign') {
      panel.classList.add('victory');
      kicker.textContent = `${boss.nodeCode} INVADIDO · ${boss.name} DERROTADO${campaignResult?.isFirstClear ? ` · +${NB.CityData.campaignCredits(boss)} CRÉDITOS` : ''}`;
      kicker.style.color = 'var(--ram)';
      title.textContent = 'EXTRAÇÃO DE DADOS CONCLUÍDA';
      title.style.color = 'var(--ram)';

      clueBox.style.display = 'flex';
      document.getElementById('go-clue-title').textContent = boss.clueTitle;
      document.getElementById('go-clue-text').textContent = boss.clueText;

      // Exibe as 2 cartas de recompensa desbloqueadas
      rewardWrap.style.display = 'flex';
      const isNew = campaignResult && campaignResult.newlyUnlockedCards.length > 0;
      document.getElementById('go-rewards-label').textContent = isNew
        ? 'NOVAS CARTAS DESBLOQUEADAS NO BANCO DE DADOS (MEU DECK):'
        : 'CARTAS DESTE NÓ (DISPONÍVEIS EM MEU DECK):';

      rewardGrid.innerHTML = '';
      (boss.rewardCards || []).forEach(cid => {
        const card = NB.Cards.CARD_DB[cid];
        if (!card) return;
        const tile = document.createElement('div');
        tile.className = 'reward-card-tile chamfer-sm';
        const thumb = document.createElement('div');
        thumb.className = 'reward-thumb';
        thumb.appendChild(NB.Sprites.createArtMarkup(card.id, card.img, card.name));
        const info = document.createElement('div');
        info.className = 'reward-info';
        const statStr = card.kind === 'unit' ? `ATK ${card.atk} / DEF ${card.def}` : `EXPLOIT · ${card.cost} RAM`;
        info.innerHTML = `<div class="reward-name">${card.name}</div><div class="reward-sub">${statStr}</div>`;
        tile.appendChild(thumb);
        tile.appendChild(info);
        rewardGrid.appendChild(tile);
      });

      if (campaignResult && campaignResult.nextNodeUnlocked) {
        nextNodeBanner.style.display = 'block';
        nextNodeBanner.textContent = `PISTA RECEBIDA · RASTREIE NA ANTENA COMUNITÁRIA`;
      } else if (boss.id === 'archon') {
        nextNodeBanner.style.display = 'block';
        nextNodeBanner.textContent = 'CAMPANHA CONCLUÍDA · TODOS OS 4 NÓS DOMINADOS!';
      }

      primaryBtn.textContent = 'VOLTAR À CIDADE';
      primaryBtn.dataset.action = 'netmap';
      secondaryBtn.textContent = 'REVANCHE';
      secondaryBtn.dataset.action = 'rematch';
    } else if (state.mode === 'arena') {
      const won = winner === 'player';
      panel.classList.add(won ? 'victory' : 'defeat');
      kicker.textContent = 'RINGUE BAIXA TENSÃO';
      kicker.style.color = won ? 'var(--ram)' : 'var(--magenta)';
      title.textContent = won ? `VITÓRIA · +${state.payout} CRÉDITOS` : (state.stake ? 'DERROTA · APOSTA PERDIDA' : 'DERROTA NO TREINO');
      title.style.color = kicker.style.color;
      primaryBtn.textContent = 'VOLTAR À CIDADE';
      primaryBtn.dataset.action = 'netmap';
      secondaryBtn.textContent = 'TELA INICIAL';
      secondaryBtn.dataset.action = 'title';
    } else if (winner === 'player') {
      panel.classList.add('victory');
      kicker.textContent = `DUELO RÁPIDO · ${boss.name} DERROTADO`;
      kicker.style.color = 'var(--ram)';
      title.textContent = 'VITÓRIA!';
      title.style.color = 'var(--ram)';
      primaryBtn.textContent = 'NOVO DUELO RÁPIDO';
      primaryBtn.dataset.action = 'quick';
      secondaryBtn.textContent = 'TELA INICIAL';
      secondaryBtn.dataset.action = 'title';
    } else {
      panel.classList.add('defeat');
      kicker.textContent = `CONEXÃO PERDIDA CONTRA ${boss.name}`;
      kicker.style.color = 'var(--magenta)';
      title.textContent = 'DERROTA';
      title.style.color = 'var(--magenta)';
      clueBox.style.display = 'flex';
      document.getElementById('go-clue-title').textContent = 'SINAL INTERROMPIDO';
      document.getElementById('go-clue-text').textContent = `${boss.name} derrubou sua integridade. Ajuste o uso de RAM, Overclock e bloqueios e invada novamente.`;
      primaryBtn.textContent = 'TENTAR NOVAMENTE';
      primaryBtn.dataset.action = 'rematch';
      secondaryBtn.textContent = state.mode === 'campaign' ? 'VOLTAR À CIDADE' : 'TELA INICIAL';
      secondaryBtn.dataset.action = state.mode === 'campaign' ? 'netmap' : 'title';
    }

    document.getElementById('stat-turns').textContent = state.turn;
    document.getElementById('stat-dmg').textContent = state.stats.damageDealt;
    document.getElementById('stat-kills').textContent = state.stats.enemyUnitsDestroyed;
    document.getElementById('stat-exploits').textContent = state.stats.exploitsUsed;

    modal.classList.add('open');
  }

  function renderVolumeControls() {
    document.querySelectorAll('[data-audio-channel]').forEach(input => {
      const value = NB.Audio.volumes[input.dataset.audioChannel];
      input.value = value;
      input.setAttribute('aria-valuetext', `${value}%`);
      document.getElementById(`${input.id}-value`).textContent = `${value}%`;
    });
  }

  /* Modal de Configurações & Resetar Save */
  function renderSettingsModal() {
    const save = NB.Save.get();
    document.getElementById('settings-bosses').textContent = `${save.defeatedBosses.length}/4`;
    document.getElementById('settings-cards').textContent = `${save.unlockedCards.length}/${Object.keys(NB.Cards.CARD_DB).length}`;
    document.getElementById('settings-clues').textContent = `${save.clues.length}/4`;
    const resetBtn = document.getElementById('btn-reset-save');
    resetBtn.dataset.confirm = '0';
    resetBtn.textContent = 'RESETAR SAVE';
    resetBtn.classList.remove('confirming');
    renderVolumeControls();
    updateSoundButtons();
  }

  function openVisorForHand(item) {
    const state = NB.State.get();
    const card = NB.Cards.CARD_DB[item.cardId];
    const check = NB.State.canPlayHandCard('player', item);
    const layer = document.getElementById('visor-layer');
    const vCard = document.getElementById('visor-card');

    vCard.classList.remove('exploit-theme', 'enemy-theme');
    if (card.kind === 'exploit') vCard.classList.add('exploit-theme');

    document.getElementById('visor-type').textContent =
      card.kind === 'unit' ? `UNIDADE · ${NB.Cards.affinityLabel(NB.Save.getAffinity(card.id))}` : 'EXPLOIT · AÇÃO';
    document.getElementById('visor-title').textContent = card.name.toUpperCase();

    const artBox = document.getElementById('visor-art');
    artBox.innerHTML = '';
    artBox.appendChild(NB.Sprites.createArtMarkup(card.id, card.img, card.name));

    const statsEl = document.getElementById('visor-stats');
    if (card.kind === 'unit') {
      statsEl.innerHTML = `
        <span style="color:var(--amber)">ATK ${card.atk}</span>
        <span style="color:var(--cyan)">DEF ${card.def}</span>
        <span style="color:var(--ram)">+${card.ramGain} RAM</span>
      `;
    } else {
      statsEl.innerHTML = `
        <span style="color:var(--amber)">CUSTO: ${card.cost} RAM</span>
        <span style="color:var(--ram)">SUA RAM: ${state.player.ram}</span>
      `;
    }

    renderVisorKeywords(card);
    document.getElementById('visor-desc').textContent = card.desc + NB.Cards.describeAffinity(NB.Save.getAffinity(card.id));

    const warnEl = document.getElementById('visor-warning');
    if (!check.ok) {
      warnEl.style.display = 'block';
      warnEl.textContent = check.reason;
    } else {
      warnEl.style.display = 'none';
    }

    const actionsEl = document.getElementById('visor-actions');
    actionsEl.classList.remove('single-col');
    const execBtn = document.getElementById('btn-visor-exec');
    execBtn.style.display = 'block';
    execBtn.disabled = !check.ok;
    execBtn.textContent = card.kind === 'unit' ? 'EXECUTAR (+' + card.ramGain + ' RAM)' : 'EXECUTAR (-' + card.cost + ' RAM)';
    document.getElementById('btn-visor-cancel').style.display = 'block';

    layer.classList.add('open');
  }

  function openVisorForField(side, slotIdx) {
    const state = NB.State.get();
    const u = state[side].field[slotIdx];
    if (!u) return;
    const card = NB.Cards.CARD_DB[u.cardId];
    const layer = document.getElementById('visor-layer');
    const vCard = document.getElementById('visor-card');

    vCard.classList.remove('exploit-theme', 'enemy-theme');
    if (side === 'enemy') vCard.classList.add('enemy-theme');

    document.getElementById('visor-type').textContent =
      (side === 'enemy' ? 'UNIDADE INIMIGA' : 'SUA UNIDADE') +
      (u.booting ? ' · BOOTING' : ' · ATIVA') + ` · ${NB.Cards.affinityLabel(u.affinity)}`;
    document.getElementById('visor-title').textContent = card.name.toUpperCase();

    const artBox = document.getElementById('visor-art');
    artBox.innerHTML = '';
    artBox.appendChild(NB.Sprites.createArtMarkup(card.id, card.img, card.name));

    document.getElementById('visor-stats').innerHTML = `
      <span style="color:var(--amber)">ATK ${u.atk}</span>
      <span style="color:${side === 'enemy' ? '#FF77A8' : 'var(--cyan)'}">DEF ${u.def}/${u.maxDef}</span>
      <span style="color:${u.booting ? 'var(--amber)' : 'var(--ram)'}">${u.booting ? 'BOOTING' : 'PRONTO'}</span>
    `;
    renderVisorKeywords(card);
    document.getElementById('visor-desc').textContent = card.desc + NB.Cards.describeAffinity(u.affinity);
    document.getElementById('visor-warning').style.display = 'none';

    const actionsEl = document.getElementById('visor-actions');
    actionsEl.classList.add('single-col');
    document.getElementById('btn-visor-exec').style.display = 'none';
    document.getElementById('btn-visor-cancel').style.display = 'block';

    layer.classList.add('open');
  }

  function closeVisor() {
    document.getElementById('visor-layer').classList.remove('open');
  }

  function renderPngModal() {
    const list = document.getElementById('png-list');
    list.innerHTML = '';
    NB.Cards.ASSET_LIST.forEach(item => {
      const st = NB.Sprites.assetStatus[item.id] === 'loaded' ? 'loaded' : 'fallback';
      const row = document.createElement('div');
      row.className = 'png-row';
      row.innerHTML = `
        <div>
          <div class="png-path">${item.path}</div>
          <span class="png-card-label">${item.label}</span>
        </div>
        <span class="png-status ${st}">${st === 'loaded' ? 'ARTE LOCAL' : 'CANVAS'}</span>
      `;
      list.appendChild(row);
    });
  }

  function refreshPngModalIfOpen() {
    if (document.getElementById('png-modal').classList.contains('open')) {
      renderPngModal();
    }
  }

  function updateSoundButtons() {
    const on = NB.Audio.isEnabled();
    const label = on ? 'SOM: ON' : 'SOM: OFF';
    ['btn-sound', 'btn-settings-sound', 'btn-title-sound'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.textContent = label;
      btn.classList.toggle('active-sound', on);
      btn.classList.toggle('muted-sound', !on);
    });
  }

  NB.UI = {
    renderAll,
    renderEnemyAvatar,
    renderTitleStats,
    openDossier,
    showGameOverModal,
    renderSettingsModal,
    renderVolumeControls,
    openVisorForHand,
    openVisorForField,
    closeVisor,
    renderPngModal,
    refreshPngModalIfOpen,
    updateSoundButtons
  };
})(window.NB = window.NB || {});
