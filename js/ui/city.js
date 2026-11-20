(function (NB) {
  'use strict';

  const { districts, stock, traces, sparringBoss, wagerBoss } = NB.CityData;
  const $ = id => document.getElementById(id);
  const symbols = ['▲', '●', '◆', '■'];
  const previewMs = 3500;
  const workMs = 12000;
  const errorPenaltyMs = 2000;
  let job = null;
  let jobTimer = null;
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
    const district = districts.find(item => item.id === id);
    if (!district) return;
    NB.Save.get().city.district = id;
    NB.Save.save();
    view = 'district';
    cancelJob();
    NB.Audio.setScene(district.music || district.id);
    render();
  }

  function render() {
    const save = NB.Save.get();
    const district = districtAtPosition();
    $('city-credits').textContent = `${save.city.credits} créditos`;
    $('city-name').textContent = district.name;
    const portrait = $('city-portrait');
    portrait.hidden = view === 'journal';
    if (!portrait.hidden && portrait.getAttribute('src') !== district.portrait) portrait.src = district.portrait;
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
      addText(content, 'Memorize 6 símbolos em 3,5 s. Você tem 12 s para repetir a sequência. Cada erro custa 2 s.');
      return;
    }

    addText(content, job.lead ? 'Rastreamento de pista' : 'Reparo de pacotes · +20 créditos', 'city-clue-title');
    addText(content, job.lead ? 'Toque nos símbolos na ordem exibida.' :
      (job.revealing ? 'Memorize a sequência.' : 'Repita a sequência de memória.'));
    if (!job.lead) {
      const clock = document.createElement('p');
      clock.id = 'city-job-clock';
      clock.setAttribute('role', 'timer');
      content.append(clock);
      updateClock();
    }

    const sequence = document.createElement('div');
    sequence.className = 'city-sequence';
    job.sequence.forEach((symbol, index) => {
      const item = document.createElement('span');
      const done = index < job.index;
      item.textContent = job.lead || job.revealing || done ? symbol : '·';
      item.className = done ? 'city-done' : index === job.index ? 'city-next' : '';
      sequence.append(item);
    });
    content.append(sequence);
    const controls = document.createElement('div');
    controls.className = 'city-symbols';
    for (const symbol of symbols) {
      addButton(controls, symbol, () => selectSymbol(symbol), job.revealing);
    }
    content.append(controls);
  }

  function updateClock() {
    const clock = $('city-job-clock');
    if (!clock || !job) return;
    const deadline = job.revealing ? job.revealUntil : job.deadline;
    const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    clock.textContent = job.revealing ? `Memorização · ${seconds} s` : `Tempo de envio · ${seconds} s`;
    clock.classList.toggle('city-notice', !job.revealing && seconds <= 4);
  }

  function tickJob() {
    const now = performance.now();
    if (now >= job.deadline) {
      cancelJob();
      render();
      announce('Tempo esgotado. Nenhum crédito recebido.');
      $('city-content').querySelector('button')?.focus();
    } else if (job.revealing && now >= job.revealUntil) {
      job.revealing = false;
      render();
      announce('Sequência oculta. Toque nos símbolos.');
      $('city-content').querySelector('.city-symbols button')?.focus();
    } else {
      updateClock();
    }
  }

  function cancelJob() {
    clearInterval(jobTimer);
    jobTimer = null;
    job = null;
  }

  function startJob(lead) {
    const revealUntil = performance.now() + previewMs;
    job = {
      lead,
      index: 0,
      revealing: !lead,
      revealUntil,
      deadline: revealUntil + workMs,
      sequence: Array.from({ length: lead ? 4 : 6 }, () => symbols[Math.floor(Math.random() * symbols.length)])
    };
    announce('');
    render();
    if (lead) {
      $('city-content').querySelector('.city-symbols button').focus();
    } else {
      $('city-content').querySelector('.city-sequence').scrollIntoView({ block: 'nearest' });
      jobTimer = setInterval(tickJob, 100);
    }
  }

  function selectSymbol(symbol) {
    if (!job || job.revealing) return;
    if (!job.lead && performance.now() >= job.deadline) {
      tickJob();
      return;
    }
    const jobFocus = symbols.indexOf(symbol);
    if (symbol !== job.sequence[job.index]) {
      job.index = 0;
      if (!job.lead) {
        job.deadline -= errorPenaltyMs;
        if (performance.now() >= job.deadline) {
          tickJob();
          return;
        }
      }
      announce(job.lead ? 'Sequência reiniciada. Comece pelo primeiro símbolo.' :
        'Símbolo incorreto. Volte ao primeiro pacote. Penalidade de 2 s.');
    } else {
      job.index++;
      announce(`Pacote ${job.index} de ${job.sequence.length} confirmado.`);
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
      cancelJob();
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
    cancelJob();
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
      const district = districtAtPosition();
      view = view === 'journal' ? 'district' : 'journal';
      NB.Audio.setScene(view === 'journal' ? 'city' : district.music || district.id);
      cancelJob();
      announce('');
      render();
    });
  }

  NB.City = { open, resetView, bindEvents, finishArena, access, cancelJob };
})(window.NB = window.NB || {});
