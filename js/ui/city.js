(function (NB) {
  'use strict';

  const { districts, stock, traces, sparringBoss, wagerBoss } = NB.CityData;
  const $ = id => document.getElementById(id);
  const symbols = ['▲', '●', '◆', '■'];
  let job = null;
  let view = 'district';

  function access(district) {
    const boss = NB.Campaign.NODES.find(node => node.id === district?.id);
    if (!boss || boss.index === 0 || NB.Save.isNodeDefeated(boss.id)) return null;
    const previous = NB.Campaign.NODES[boss.index - 1];
    if (!NB.Save.isNodeUnlocked(boss.index)) return `Vença ${previous.name} para abrir este local.`;
    if (!NB.Save.get().city.traced.includes(previous.id)) return `Rastreie a pista de ${previous.name} na Antena Comunitária.`;
    return null;
  }

  function districtAtPosition() {
    return districts.find(district => district.id === NB.Save.get().city.district) || districts[3];
  }

  function move(id) {
    if (!districts.some(district => district.id === id)) return;
    NB.Save.get().city.district = id;
    NB.Save.save();
    view = 'district';
    job = null;
    render();
  }

  function render() {
    const save = NB.Save.get();
    const district = districtAtPosition();
    $('city-credits').textContent = `${save.city.credits} créditos`;
    $('city-name').textContent = district.name;
    $('city-npc').textContent = view === 'journal' ? 'Arquivo de Kairo' : district.npc;
    const cleared = NB.Save.isNodeDefeated(district.id);
    const lines = {
      kira: 'Você tem os meus registros. Quando a Vértice ligar de novo, meu canal vai estar fora do ar.',
      cipher: 'Me mandaram proteger a cidade. Leia o que encontrei no cofre e decida quem eu protegi.',
      vex: 'Eu vendia segredos. Agora fico por aqui para ouvir o que vão contar sobre mim.',
      archon: 'A Operação Eclipse vazou. No alto da Torre, o letreiro da Vértice se apaga.'
    };
    $('city-line').textContent = view === 'journal' ? 'Pistas extraídas e rastros confirmados na Antena.' : (cleared ? lines[district.id] : district.line);
    $('city-journal').setAttribute('aria-pressed', view === 'journal');
    const marker = $('city-marker');
    marker.style.left = `${district.x}%`;
    marker.style.top = `${district.y}%`;
    for (const pin of $('city-map').querySelectorAll('button')) {
      const place = districts.find(item => item.id === pin.dataset.district);
      const locked = Boolean(access(place));
      pin.classList.toggle('city-locked', locked);
      pin.classList.toggle('city-cleared', NB.Save.isNodeDefeated(place.id));
      if (place.id === district.id) pin.setAttribute('aria-current', 'location');
      else pin.removeAttribute('aria-current');
      pin.setAttribute('aria-label', place.name + (locked ? ' · bloqueado' : ''));
    }

    const content = $('city-content');
    content.replaceChildren();
    if (view === 'journal') {
      renderJournal(content, save);
    } else if (district.id === 'market') {
      renderMarket(content, save);
    } else if (district.id === 'relay') {
      renderRelay(content, save);
    } else if (district.id === 'arena') {
      renderArena(content, save);
    } else {
      const requirement = access(district);
      if (requirement) {
        addText(content, requirement, 'city-notice');
      } else {
        addButton(content, cleared ? 'Abrir dossiê · revanche' : 'Abrir dossiê', () => NB.UI.openDossier(district.id), false, 'city-primary');
      }
    }
  }

  function addText(parent, text, className = '') {
    const item = document.createElement('p');
    item.className = className;
    item.textContent = text;
    parent.append(item);
  }

  function addButton(parent, label, action, disabled = false, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', () => {
      NB.Audio.playSelect();
      action();
    });
    parent.append(button);
    return button;
  }

  function announce(message) {
    $('city-feedback').textContent = message;
  }

  function renderJournal(content, save) {
    if (!save.clues.length) addText(content, 'Nenhuma pista ainda. Kira está na Estação Fantasma.');
    for (const clue of save.clues) {
      const entry = document.createElement('article');
      addText(entry, clue.title, 'city-clue-title');
      addText(entry, clue.text);
      if (save.city.traced.includes(clue.bossId)) addText(entry, traces[clue.bossId], 'city-notice');
      content.append(entry);
    }
  }

  function renderMarket(content, save) {
    for (const { id, price } of stock) {
      const card = NB.Cards.CARD_DB[id];
      const owned = save.unlockedCards.includes(id);
      const row = document.createElement('div');
      row.className = 'city-sale';
      const art = document.createElement('img');
      art.src = card.img;
      art.alt = '';
      art.width = 42;
      art.height = 42;
      row.append(art);
      const details = document.createElement('div');
      addText(details, card.name, 'city-clue-title');
      addText(details, `${card.atk} ATK · ${card.def} DEF · +${card.ramGain} RAM`);
      if (card.keywords.length) addText(details, card.keywords.map(keyword => NB.Cards.KEYWORDS[keyword].tag).join(' · '));
      row.append(details);
      addButton(row, owned ? 'Adquirida' : `Comprar · ${price}`, () => {
        if (save.city.credits < price || save.unlockedCards.includes(id)) return;
        save.city.credits -= price;
        save.unlockedCards.push(id);
        NB.Save.save();
        render();
        announce(`${card.name} disponível em Meu Deck.`);
      }, owned || save.city.credits < price);
      content.append(row);
    }
  }

  function renderRelay(content, save) {
    const lead = save.clues.find(clue => traces[clue.bossId] && !save.city.traced.includes(clue.bossId));
    if (!job) {
      if (lead) {
        addButton(content, 'Rastrear pista', () => startJob(lead.bossId), false, 'city-primary');
      }
      addButton(content, 'Trabalho de hacker · +20 créditos', () => startJob(null));
      return;
    }
    addText(content, job.lead ? 'Rastreamento de pista' : 'Reparo de pacotes · +20 créditos', 'city-clue-title');
    addText(content, 'Toque nos símbolos na ordem exibida.');
    const sequence = document.createElement('div');
    sequence.className = 'city-sequence';
    job.sequence.forEach((symbol, index) => {
      const item = document.createElement('span');
      item.textContent = symbol;
      item.className = index < job.index ? 'city-done' : index === job.index ? 'city-next' : '';
      sequence.append(item);
    });
    content.append(sequence);
    const controls = document.createElement('div');
    controls.className = 'city-symbols';
    for (const symbol of symbols) {
      addButton(controls, symbol, () => selectSymbol(symbol));
    }
    content.append(controls);
  }

  function startJob(lead) {
    job = { lead, index: 0, sequence: Array.from({ length: 4 }, () => symbols[Math.floor(Math.random() * symbols.length)]) };
    announce('');
    render();
    $('city-content').querySelector('.city-symbols button').focus();
  }

  function selectSymbol(symbol) {
    const jobFocus = symbols.indexOf(symbol);
    if (symbol !== job.sequence[job.index]) {
      job.index = 0;
      announce('Sequência reiniciada. Comece pelo primeiro símbolo.');
    } else {
      job.index++;
      announce(`Pacote ${job.index} de 4 confirmado.`);
    }

    if (job.index === job.sequence.length) {
      const save = NB.Save.get();
      if (job.lead) {
        save.city.traced.push(job.lead);
        announce(traces[job.lead]);
      } else {
        save.city.credits += 20;
        announce('Trabalho concluído. Você recebeu 20 créditos.');
      }
      job = null;
      NB.Save.save();
    }
    render();
    const buttons = $('city-content').querySelectorAll('.city-symbols button');
    (buttons[jobFocus] || $('city-content').querySelector('button'))?.focus();
  }

  function renderArena(content, save) {
    const stakeUnlocked = NB.Save.isNodeDefeated('kira');
    addButton(content, 'Desafio de rua · vitória paga 15', () => startArena(0));
    addButton(content, 'Apostar 25 · vitória paga 60', () => startArena(25), !stakeUnlocked || save.city.credits < 25);
    if (!stakeUnlocked) addText(content, 'A mesa de apostas abre após vencer Kira.', 'city-notice');
    else if (save.city.credits < 25) addText(content, 'Você precisa de 25 créditos para apostar.', 'city-notice');
    else addText(content, 'Na mesa de apostas, sair do duelo encerra a partida e perde a entrada.');
  }

  function startArena(stake) {
    const save = NB.Save.get();
    if (stake && (!NB.Save.isNodeDefeated('kira') || save.city.credits < stake)) return;
    save.city.credits -= stake;
    NB.Save.save();
    NB.Input.startMatch({ mode: 'arena', boss: stake ? wagerBoss : sparringBoss, stake, autoSound: false });
  }

  function finishArena(state, winner) {
    const payout = winner === 'player' ? (state.stake ? 60 : 15) : 0;
    state.payout = payout;
    NB.Save.get().city.credits += payout;
    NB.Save.save();
  }

  function resetView() {
    view = 'district';
    job = null;
    announce('');
    render();
  }

  function open() {
    resetView();
    $('netmap-modal').classList.add('open');
    document.querySelector('.city-panel').inert = false;
    $('game-ui').inert = true;
    $('city-map').querySelector('[aria-current]')?.focus();
  }

  function bindEvents() {
    for (const district of districts) {
      const pin = addButton($('city-map'), '', () => { announce(''); move(district.id); }, false, 'city-pin');
      pin.dataset.district = district.id;
      pin.style.left = `${district.x}%`;
      pin.style.top = `${district.y}%`;
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = district.icon;
      const label = document.createElement('span');
      label.textContent = district.short;
      pin.append(icon, label);
    }
    $('city-journal').addEventListener('click', () => {
      view = view === 'journal' ? 'district' : 'journal';
      job = null;
      announce('');
      render();
    });
  }

  NB.City = { open, resetView, bindEvents, finishArena, access };
})(window.NB = window.NB || {});
