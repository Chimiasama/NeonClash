(function (NB) {
  'use strict';

  /* Tela de Coleção e Editor de Baralho ("BANCO DE DADOS") + Inspetor em Tela Cheia */
  let draftDeck = [];
  let currentFilter = 'all';
  let searchWords = [];
  let inspectedCardId = null;
  let inspectorOriginId = null;
  let returnTarget = 'title';

  function getAllCardDefs() {
    return Object.values(NB.Cards.CARD_DB);
  }

  function getUnlockedSet() {
    return new Set(NB.Save.get().unlockedCards);
  }

  function countCopies(cardId) {
    let n = 0;
    for (let i = 0; i < draftDeck.length; i++) {
      if (draftDeck[i] === cardId) n++;
    }
    return n;
  }

  function getUnlockSourceText(cardId) {
    const nodes = NB.Campaign ? NB.Campaign.NODES : [];
    for (const node of nodes) {
      if (Array.isArray(node.rewardCards) && node.rewardCards.includes(cardId)) {
        return `Derrote ${node.name} (${node.nodeCode}) para desbloquear esta carta.`;
      }
    }
    if (NB.CityData.stock.some(item => item.id === cardId)) return 'Disponível na Feira do Viaduto.';
    const scene = Object.values(NB.Story.sceneById).find(item => item.reward?.card === cardId);
    if (scene) return `Conclua a rota pacifista: ${scene.title}.`;
    const resident = NB.CityAtlas.residents.find(person => NB.CityAtlas.residentDuels[person.id]?.card === cardId);
    if (resident) {
      const place = NB.CityData.districts.find(district => district.id === resident.location);
      return `Vença ${resident.name} em ${place.name}.`;
    }
    const challenge = NB.Challenges.find(entry => entry.cards.includes(cardId));
    if (challenge) return `Vença ${challenge.name} no Ringue Baixa Tensão.`;
    return 'Avance na campanha para desbloquear esta carta.';
  }

  function getDeckBreakdown() {
    let units = 0;
    let exploits = 0;
    draftDeck.forEach(cid => {
      const def = NB.Cards.CARD_DB[cid];
      if (!def) return;
      if (def.kind === 'unit') units++;
      else exploits++;
    });
    return { total: draftDeck.length, units, exploits };
  }

  function renderStatusBar() {
    const { total, units, exploits } = getDeckBreakdown();
    const max = NB.Cards.DECK_SIZE;
    const isValid = total === max;
    const slot = document.getElementById('deck-slot');
    slot.value = NB.Save.get().deckSlot;
    slot.disabled = !isValid;

    const countEl = document.getElementById('deck-count-badge');
    countEl.textContent = `${total}/${max} CARTAS`;
    countEl.classList.toggle('incomplete', !isValid);

    const saveBadge = document.getElementById('deck-save-state');
    if (isValid) {
      saveBadge.textContent = 'SALVO ✓';
      saveBadge.className = 'deck-save-state saved';
    } else {
      saveBadge.textContent = `FALTAM ${max - total}`;
      saveBadge.className = 'deck-save-state unsaved';
    }

    document.getElementById('deck-dist-units').textContent = `UNIDADES: ${units}`;
    document.getElementById('deck-dist-exploits').textContent = `EXPLOITS: ${exploits}`;

    const uPct = (units / max) * 100;
    const ePct = (exploits / max) * 100;
    document.getElementById('deck-fill-units').style.width = `${uPct}%`;
    document.getElementById('deck-fill-exploits').style.width = `${ePct}%`;

    const hintEl = document.getElementById('deck-footer-hint');
    if (isValid) {
      hintEl.textContent = 'Toque em uma carta para ver a arte e os detalhes.';
    } else {
      hintEl.innerHTML = `Adicione mais <strong style="color:var(--amber)">${max - total} carta(s)</strong> ou toque em <strong>AUTO-COMPLETAR</strong> para salvar.`;
    }
  }

  function renderFilterTabs() {
    const unlockedSet = getUnlockedSet();
    const allCards = getAllCardDefs();
    const totalUnlocked = allCards.filter(c => unlockedSet.has(c.id)).length;
    document.getElementById('deck-unlocked-sub').textContent = `BANCO DE DADOS · ${totalUnlocked}/${allCards.length} DESBLOQUEADAS`;

    document.querySelectorAll('.deck-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === currentFilter);
    });
  }

  function normalizeSearch(value) {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  }

  function getFilteredCards() {
    return getAllCardDefs().filter(card => {
      if ((currentFilter === 'unit' || currentFilter === 'exploit') && card.kind !== currentFilter) return false;
      if (currentFilter === 'indeck' && countCopies(card.id) === 0) return false;
      if (searchWords.length === 0) return true;
      const affinity = card.kind === 'unit' ? NB.Cards.affinityLabel(NB.Save.getAffinity(card.id)) : '';
      const keywords = card.keywords.map(id => NB.Cards.KEYWORDS[id]?.tag);
      const text = normalizeSearch([card.name, card.subtitle, card.desc, affinity, ...keywords].join(' '));
      return searchWords.every(word => text.includes(word));
    });
  }

  function renderGrid() {
    const grid = document.getElementById('collection-grid');
    grid.innerHTML = '';

    const unlockedSet = getUnlockedSet();
    const filtered = getFilteredCards();
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.gridColumn = '1 / -1';
      empty.className = 'story-box';
      empty.style.textAlign = 'center';
      empty.textContent = searchWords.length ? 'Nenhuma carta corresponde à busca.'
        : 'Nenhuma carta neste filtro.';
      grid.appendChild(empty);
      return;
    }

    filtered.forEach(card => {
      const isUnlocked = unlockedSet.has(card.id);
      const copies = countCopies(card.id);

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.dataset.cardId = card.id;
      tile.setAttribute('aria-haspopup', 'dialog');
      tile.setAttribute('aria-label', card.name + (isUnlocked ? '' : ' · bloqueada'));
      tile.className = 'col-card chamfer-sm' +
        (card.kind === 'exploit' ? ' type-exploit' : '') +
        (!isUnlocked ? ' locked' : '') +
        (isUnlocked && copies === 1 ? ' in-deck' : '') +
        (isUnlocked && copies >= 2 ? ' max-copies' : '');

      const artBox = document.createElement('div');
      artBox.className = 'col-card-art';
      artBox.appendChild(NB.Sprites.createArtMarkup(card.id, card.img, card.name));

      if (isUnlocked) {
        const ramTag = document.createElement('span');
        ramTag.className = 'col-ram-tag tabular ' + (card.kind === 'unit' ? 'gain' : 'cost');
        ramTag.textContent = card.kind === 'unit' ? `+${card.ramGain}R` : `-${card.cost}R`;
        artBox.appendChild(ramTag);

        const copyBadge = document.createElement('span');
        copyBadge.className = 'col-copy-badge tabular' +
          (copies === 1 ? ' has-one' : (copies >= 2 ? ' has-two' : ''));
        copyBadge.textContent = `${copies}/${NB.Cards.MAX_COPIES}`;
        artBox.appendChild(copyBadge);

        if (card.keywords && card.keywords.length > 0) {
          const kwStrip = document.createElement('div');
          kwStrip.className = 'kw-strip';
          card.keywords.forEach(kwId => {
            const kw = NB.Cards.KEYWORDS[kwId];
            if (!kw) return;
            const chip = document.createElement('span');
            chip.className = 'kw-chip';
            chip.style.color = kw.color;
            chip.textContent = `${kw.icon}${kw.short}`;
            kwStrip.appendChild(chip);
          });
          artBox.appendChild(kwStrip);
        }
      } else {
        const cipher = document.createElement('div');
        cipher.className = 'locked-cipher-overlay';
        cipher.innerHTML = `
          <span class="locked-cipher-icon">🔒</span>
          <span class="locked-cipher-label">BLOQUEADA</span>

        `;
        artBox.appendChild(cipher);
      }

      const foot = document.createElement('div');
      foot.className = 'col-card-foot';
      if (isUnlocked) {
        const statHtml = card.kind === 'unit'
          ? `<span style="color:var(--amber)">A:${card.atk}</span><span style="color:var(--cyan)">D:${card.def} ${NB.Cards.AFFINITIES[NB.Save.getAffinity(card.id)]?.icon || ''}</span>`
          : `<span style="color:var(--amber)">EXPLOIT</span><span style="color:var(--text-muted)">${card.cost} RAM</span>`;
        foot.innerHTML = `
          <div class="col-card-name">${card.name}</div>
          <div class="col-card-meta tabular">${statHtml}</div>
        `;
      } else {
        foot.innerHTML = `
          <div class="col-card-name" style="color:var(--text-muted)">${card.name}</div>
          <div class="col-card-meta tabular"><span style="color:var(--magenta)">BLOQUEADA</span></div>
        `;
      }

      tile.appendChild(artBox);
      tile.appendChild(foot);

      tile.addEventListener('click', () => {
        NB.Audio.playSelect();
        NB.Physics.vibrateCard();
        openInspector(card.id);
      });

      grid.appendChild(tile);
    });
  }

  function renderAll() {
    renderFilterTabs();
    renderStatusBar();
    renderGrid();
    if (inspectedCardId) renderInspector();
  }

  /* Inspetor em Tela Cheia */
  function openInspector(cardId) {
    if (!NB.Cards.CARD_DB[cardId]) return;
    inspectorOriginId = cardId;
    inspectedCardId = cardId;
    renderInspector();
    document.getElementById('deck-modal').inert = true;
    document.getElementById('card-inspector-modal').classList.add('open');
    document.getElementById('inspector-panel').scrollTop = 0;
    document.getElementById('btn-insp-close').focus();
  }

  function closeInspector() {
    if (!inspectedCardId) return;
    inspectedCardId = null;
    document.getElementById('card-inspector-modal').classList.remove('open');
    document.getElementById('deck-modal').inert = false;
    const origin = document.querySelector(`[data-card-id="${inspectorOriginId}"]`);
    (origin || document.querySelector('.deck-filter-btn.active'))?.focus();
    inspectorOriginId = null;
  }

  function stepInspector(delta) {
    if (!inspectedCardId) return;
    const cards = getFilteredCards();
    if (!cards.length) return;
    const current = cards.findIndex(card => card.id === inspectedCardId);
    const next = current < 0 ? (delta > 0 ? 0 : cards.length - 1)
      : (current + delta + cards.length) % cards.length;
    inspectedCardId = cards[next].id;
    NB.Audio.playSelect();
    renderInspector();
    document.getElementById('inspector-panel').scrollTop = 0;
  }

  function renderInspector() {
    const card = NB.Cards.CARD_DB[inspectedCardId];
    if (!card) return;

    const panel = document.getElementById('inspector-panel');
    panel.classList.toggle('exploit-theme', card.kind === 'exploit');

    document.getElementById('insp-subtitle').textContent =
      (card.kind === 'unit' ? `UNIDADE · ${NB.Cards.affinityLabel(NB.Save.getAffinity(card.id))} · ` : 'EXPLOIT · ') + card.subtitle.toUpperCase();
    document.getElementById('insp-name').textContent = card.name.toUpperCase();

    const artStage = document.getElementById('insp-art-stage');
    artStage.innerHTML = '';
    artStage.appendChild(NB.Sprites.createArtMarkup(card.id, card.img, card.name));
    const isUnlocked = getUnlockedSet().has(card.id);
    const unlockNote = document.getElementById('insp-unlock-note');
    unlockNote.hidden = isUnlocked;
    unlockNote.textContent = isUnlocked ? '' : getUnlockSourceText(card.id);
    document.querySelector('.inspector-deck-controls').hidden = !isUnlocked;
    const canStep = getFilteredCards().some(item => item.id !== card.id);
    document.getElementById('btn-insp-prev').disabled = !canStep;
    document.getElementById('btn-insp-next').disabled = !canStep;

    document.getElementById('insp-lore').textContent = `"${card.lore || card.subtitle}"`;

    const statsEl = document.getElementById('insp-stats');
    if (card.kind === 'unit') {
      statsEl.innerHTML = `
        <span style="color:var(--amber)">ATK ${card.atk}</span>
        <span style="color:var(--cyan)">DEF ${card.def}</span>
        <span style="color:var(--ram)">+${card.ramGain} RAM</span>
      `;
    } else {
      statsEl.innerHTML = `
        <span style="color:var(--amber)">CUSTO: ${card.cost} RAM</span>
        <span style="color:var(--cyan)">TIPO: EXPLOIT</span>
      `;
    }

    const kwBox = document.getElementById('insp-keywords');
    kwBox.innerHTML = '';
    if (card.keywords && card.keywords.length > 0) {
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
    } else {
      kwBox.style.display = 'none';
    }

    document.getElementById('insp-desc').textContent = card.desc + NB.Cards.describeAffinity(NB.Save.getAffinity(card.id));

    const copies = countCopies(card.id);
    const total = draftDeck.length;
    const maxCopies = NB.Cards.MAX_COPIES;
    const maxDeck = NB.Cards.DECK_SIZE;

    document.getElementById('insp-copy-count').textContent = `CÓPIAS NO DECK: ${copies}/${maxCopies}`;
    document.getElementById('insp-deck-total').textContent = `BARALHO: ${total}/${maxDeck}`;
    document.getElementById('insp-deck-total').style.color = total === maxDeck ? 'var(--ram)' : 'var(--amber)';

    const btnAdd = document.getElementById('btn-insp-add');
    const btnRem = document.getElementById('btn-insp-remove');

    btnAdd.disabled = copies >= maxCopies || total >= maxDeck;
    if (copies >= maxCopies) {
      btnAdd.textContent = 'LIMITE 2/2';
    } else if (total >= maxDeck) {
      btnAdd.textContent = 'DECK CHEIO (20/20)';
    } else {
      btnAdd.textContent = '+ ADICIONAR';
    }

    btnRem.disabled = copies <= 0;
    btnRem.textContent = '- REMOVER';
  }

  function addCard(cardId) {
    if (!getUnlockedSet().has(cardId)) return;
    if (countCopies(cardId) >= NB.Cards.MAX_COPIES) {
      NB.Physics.showToast('LIMITE MÁXIMO DE 2 CÓPIAS POR CARTA', 'var(--amber)');
      return;
    }
    if (draftDeck.length >= NB.Cards.DECK_SIZE) {
      NB.Physics.showToast('BARALHO CHEIO (20/20) · REMOVA UMA CARTA ANTES', 'var(--amber)');
      return;
    }
    draftDeck.push(cardId);
    NB.Audio.playSelect();
    NB.Physics.vibrateCard();

    if (draftDeck.length === NB.Cards.DECK_SIZE) {
      NB.Save.saveCustomDeck(draftDeck);
      NB.Physics.showToast('BARALHO 20/20 SALVO NO SISTEMA', 'var(--ram)');
    }
    renderAll();
  }

  function removeCard(cardId) {
    const idx = draftDeck.lastIndexOf(cardId);
    if (idx === -1) return;
    draftDeck.splice(idx, 1);
    NB.Audio.playSelect();
    NB.Physics.vibrateCard();
    renderAll();
  }

  function autoComplete() {
    const unlocked = NB.Save.get().unlockedCards;
    const wasFull = draftDeck.length >= NB.Cards.DECK_SIZE;
    draftDeck = wasFull
      ? NB.Save.buildBalancedDeck(unlocked, [])
      : NB.Save.buildBalancedDeck(unlocked, draftDeck);

    NB.Save.saveCustomDeck(draftDeck);
    NB.Audio.playSummon();
    NB.Physics.vibrateExploit();
    NB.Physics.showToast(
      wasFull ? 'DECK EQUILIBRADO GERADO E SALVO (20/20)' : 'AUTO-COMPLETADO E SALVO (20/20)',
      'var(--ram)'
    );
    renderAll();
  }

  function open(origin = 'title') {
    returnTarget = origin;
    draftDeck = NB.Save.getActiveDeck();
    currentFilter = 'all';
    searchWords = [];
    document.getElementById('deck-search').value = '';
    inspectedCardId = null;

    ['title-modal', 'netmap-modal', 'dossier-modal', 'settings-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });

    renderAll();
    document.getElementById('deck-modal').classList.add('open');
  }

  function close() {
    closeInspector();
    if (draftDeck.length === NB.Cards.DECK_SIZE) {
      NB.Save.saveCustomDeck(draftDeck);
    } else {
      NB.Physics.showToast('DECK INCOMPLETO (<20) · MANTIDO ÚLTIMO DECK SALVO', 'var(--amber)');
    }
    document.getElementById('deck-modal').classList.remove('open');

    if (returnTarget === 'netmap') {
      NB.Input.openNetMap();
    } else {
      NB.Input.openTitleScreen();
    }
  }

  function bindEvents() {
    document.getElementById('deck-search').addEventListener('input', event => {
      searchWords = normalizeSearch(event.target.value).trim().split(/\s+/).filter(Boolean);
      renderGrid();
    });

    document.getElementById('deck-slot').addEventListener('change', event => {
      if (NB.Save.selectDeckSlot(Number(event.target.value))) {
        draftDeck = NB.Save.getActiveDeck();
        renderAll();
      }
    });

    document.getElementById('btn-deck-close').addEventListener('click', () => {
      NB.Audio.playSelect();
      close();
    });

    document.getElementById('btn-deck-autocomplete').addEventListener('click', () => {
      autoComplete();
    });

    document.querySelectorAll('.deck-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        NB.Audio.playSelect();
        renderAll();
      });
    });

    document.getElementById('btn-insp-close').addEventListener('click', () => {
      NB.Audio.playSelect();
      closeInspector();
    });
    document.getElementById('btn-insp-prev').addEventListener('click', () => stepInspector(-1));
    document.getElementById('btn-insp-next').addEventListener('click', () => stepInspector(1));
    document.getElementById('btn-insp-add').addEventListener('click', () => {
      if (inspectedCardId) addCard(inspectedCardId);
    });
    document.getElementById('btn-insp-remove').addEventListener('click', () => {
      if (inspectedCardId) removeCard(inspectedCardId);
    });
    document.getElementById('card-inspector-modal').addEventListener('keydown', event => {
      if (event.key === 'Escape') closeInspector();
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        stepInspector(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    document.getElementById('card-inspector-modal').addEventListener('click', (e) => {
      if (e.target.id === 'card-inspector-modal') closeInspector();
    });
  }

  NB.DeckBuilder = {
    open,
    close,
    renderAll,
    addCard,
    removeCard,
    autoComplete,
    openInspector,
    closeInspector,
    bindEvents
  };
})(window.NB = window.NB || {});
