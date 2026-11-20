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
  let workshopCardId = null;
  let destination = null;

  function access(district) {
    if (NB.Story.active()) return NB.Story.matchAccess(district?.id);
    const boss = NB.Campaign.NODES.find(node => node.id === district?.id);
    if (!boss || boss.index === 0 || NB.Save.isNodeDefeated(boss.id)) return null;
    const previous = NB.Campaign.NODES[boss.index - 1];
    if (!NB.Save.isNodeUnlocked(boss.index)) return `Vença ${previous.name} para abrir este local.`;
    if (!NB.Save.get().city.traced.includes(previous.id)) return `Rastreie a pista de ${previous.name} na Antena Comunitária.`;
    return null;
  }

  function districtAtPosition() {
    return districts.find(district => district.id === NB.Save.get().city.district) || districts.find(district => district.id === 'kira');
  }

  function selectDestination(id) {
    cancelJob();
    announce('');
    destination = id === districtAtPosition().id ? null : id;
    view = destination ? 'travel' : 'district';
    if (!destination) {
      const district = districtAtPosition();
      NB.Audio.setScene(district.music || district.id);
    }
    render();
    if (destination) $('city-name').scrollIntoView({ block: 'start' });
  }

  function move(mode) {
    if (!NB.CityLife.travel(destination, mode)) return;
    destination = null;
    view = 'district';
    const district = districtAtPosition();
    NB.Audio.setScene(district.music || district.id);
    render();
    announce(NB.CityLife.takeNotice() || `Você chegou ao destino. ${district.name}.`);
    $('city-name').scrollIntoView({ block: 'nearest' });
  }

  function render() {
    const save = NB.Save.get();
    const district = districtAtPosition();
    const life = save.city.life;
    const maxEnergy = NB.CityLife.maxEnergy(life);
    const hour = Math.floor(life.minute % 1440 / 60);
    $('city-credits').textContent = `${save.city.credits} créditos`;
    $('city-clock').textContent = `${NB.CityLife.clock(life.minute)} · ${hour >= 19 || hour < 6 ? 'Noite' : 'Dia'}`;
    $('city-energy').max = maxEnergy;
    $('city-energy').value = life.energy;
    $('city-energy-label').textContent = `Energia ${life.energy}/${maxEnergy}`;
    $('city-awake').textContent = `Limite de vigília em ${duration(Math.max(0, NB.CityLife.maxAwake(life) - life.awake))}`;
    $('city-bag').setAttribute('aria-pressed', view === 'bag');
    $('city-story').setAttribute('aria-pressed', view === 'story');
    $('city-atlas').setAttribute('aria-pressed', view === 'atlas');
    $('city-name').textContent = district.name;
    const portrait = $('city-portrait');
    portrait.hidden = view !== 'district' || !district.portrait;
    const scene = $('city-scene');
    scene.hidden = view !== 'district' || !district.scene;
    if (!scene.hidden && scene.getAttribute('src') !== district.scene) scene.src = district.scene;
    document.querySelector('.city-dialogue').hidden = !['district', 'journal'].includes(view);
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
    if (view === 'story') {
      $('city-name').textContent = 'Investigação';
      NB.StoryUI.journal(content, district, selectDestination);
    } else if (view === 'atlas') {
      $('city-name').textContent = 'Bairros de Baixa Luz';
      renderAtlas(content, district);
    } else if (view === 'travel') {
      renderTravel(content, save);
    } else if (view === 'bag') {
      renderBag(content, save.city.life);
    } else if (view === 'journal') {
      if (NB.Story.active()) NB.StoryUI.journal(content, district, selectDestination);
      else renderJournal(content, save);
    } else if (district.id === 'home' || district.id === 'pension') {
      renderRest(content, save.city, district.rest);
    } else if (district.id === 'kiosk' || district.id === 'garage') {
      renderSupplies(content, save.city, district.id);
    } else if (district.id === 'market') {
      renderMarket(content, save);
    } else if (district.id === 'relay') {
      renderRelay(content, save);
    } else if (district.id === 'arena') {
      renderArena(content, save);
    } else if (!district.atlasOnly) {
      if (district.rest) renderRest(content, save.city, district.rest);
      const requirement = access(district);
      if (requirement) {
        addText(content, requirement, 'city-notice');
      } else {
        addButton(content, cleared ? 'Abrir dossiê · revanche' : 'Abrir dossiê', () => NB.UI.openDossier(district.id), false, 'city-primary');
      }
    }
    if (view === 'district') {
      NB.StoryUI.local(content, district);
      renderContactServices(content, district.id);
      renderResidents(content, district.id);
    }
  }

  function renderAtlas(content, district) {
    for (const area of NB.CityAtlas.neighborhoods) {
      const group = document.createElement('details');
      group.className = 'city-residents';
      group.open = area.locations.includes(district.id);
      const heading = document.createElement('summary');
      heading.textContent = area.name;
      group.append(heading);
      for (const id of area.locations) {
        const place = districts.find(item => item.id === id);
        addButton(group, place.name, () => selectDestination(id));
      }
      content.append(group);
    }
  }

  function renderContactServices(content, location) {
    const favors = NB.Save.get().city.life.favors;
    if (location === 'garage' && !favors.includes('hillPath')) {
      addButton(content, 'Aprender com Aline o atalho de bicicleta', () => {
        if (!NB.CityLife.helpContact('hillPath')) return;
        refreshStory('Aline mostrou o atalho entre as Oficinas e o Morro.');
      });
    }
    if (location === 'pump' && !favors.includes('pumpRelay')) {
      addButton(content, 'Ajudar Maíra na bomba · 30 min · +16 créditos', () => {
        if (!NB.CityLife.helpContact('pumpRelay')) return;
        refreshStory('A bomba voltou a funcionar. A travessia para o Cais reabriu.');
      });
    } else if (location === 'pump') {
      addText(content, 'A balsa para o Cais está aberta das 7h às 18h.');
    }
  }

  function renderResidents(content, location) {
    const people = NB.CityAtlas.residents.filter(person => person.location === location);
    if (!people.length) return;
    const group = document.createElement('details');
    group.className = 'city-residents';
    const heading = document.createElement('summary');
    heading.textContent = 'Pessoas neste local';
    group.append(heading);
    for (const person of people) {
      addText(group, person.name, 'city-clue-title');
      addText(group, person.line);
    }
    content.append(group);
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

  function duration(minutes) {
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  }

  function renderTravel(content, save) {
    const place = districts.find(item => item.id === destination);
    const life = save.city.life;
    $('city-name').textContent = `Ir para ${place.name}`;
    for (const route of NB.CityLife.routes(destination)) {
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addButton(row, route.name, () => move(route.id), !route.available);
      if (route.needsVehicle) {
        addText(row, 'Disponível na Garagem da Íris.');
      } else {
        addText(row, `${duration(route.minutes)} · ${route.fare ? `${route.fare} créditos` : 'Grátis'} · −${route.energy} energia`);
        addText(row, `Chegada: ${NB.CityLife.clock(life.minute + route.minutes)}`);
        if (route.note) addText(row, route.note);
        if (route.willCollapse) addText(row, place.id === 'home'
          ? 'Você vai dormir em casa ao chegar.'
          : 'Você vai precisar dormir ao chegar. Risco de assalto na rua.', 'city-notice');
      }
      content.append(row);
    }
    addButton(content, 'Cancelar viagem', () => {
      resetView();
      $('city-map').querySelector('[aria-current]')?.focus();
    });
  }

  function renderRest(content, state, bedId) {
    const bed = NB.CityLife.beds[bedId];
    addButton(content, `Dormir · ${duration(bed.minutes)} · ${bed.price ? `${bed.price} créditos` : 'Grátis'}`, () => {
      if (NB.CityLife.sleep(bedId)) {
        render();
        announce('Você descansou e recuperou toda a energia.');
      }
    }, state.credits < bed.price);
    if (bedId === 'home') addButton(content, 'Esperar 1 hora', () => {
      NB.CityLife.advance(60, 3);
      render();
      announce(NB.CityLife.takeNotice() || 'Uma hora se passou.');
    });
  }

  function renderBag(content, life) {
    $('city-name').textContent = 'Mochila';
    addText(content, `${NB.CityLife.bagCount(life)}/${NB.CityLife.bagLimit} itens`, 'city-clue-title');
    addText(content, `Acordado há ${duration(life.awake)} de ${duration(NB.CityLife.maxAwake(life))}. Consumíveis recuperam energia. Dormir reinicia o tempo acordado.`);
    for (const [id, item] of Object.entries(NB.CityLife.items)) {
      const quantity = life.inventory[id];
      if (!quantity) continue;
      addButton(content, `Usar ${item.name} (${quantity}) · +${item.energy} de energia`, () => {
        if (!NB.CityLife.use(id)) return;
        render();
        announce(`${item.name} usado.`);
      }, life.energy >= NB.CityLife.maxEnergy(life));
    }
    if (!NB.CityLife.bagCount(life)) addText(content, 'Mochila vazia.');
    if (life.implant) addText(content, 'Implante de vigília instalado.');
  }

  function renderSupplies(content, state, districtId) {
    const life = state.life;
    const goods = districtId === 'kiosk'
      ? Object.entries(NB.CityLife.items).map(([id, item]) => ({ id, ...item, detail: `+${item.energy} de energia`, owned: false }))
      : [
        ...['bike', 'motorbike'].map(id => ({ id, ...NB.CityLife.transport[id], owned: life.vehicles.includes(id) })),
        { id: 'implant', name: 'Implante de vigília', price: NB.CityLife.implantPrice, owned: life.implant,
          detail: '+20 de energia máxima · +4 h acordado' }
      ];
    for (const item of goods) {
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addText(row, item.name, 'city-clue-title');
      if (item.detail) addText(row, item.detail);
      addButton(row, item.owned ? 'Adquirido' : `Comprar · ${item.price} créditos`, () => {
        if (!NB.CityLife.buy(item.id)) return;
        render();
        announce(`${item.name} adquirido.`);
      }, item.owned || state.credits < item.price || (districtId === 'kiosk' && NB.CityLife.bagCount(life) >= NB.CityLife.bagLimit));
      content.append(row);
    }
    if (districtId === 'kiosk') {
      const shift = NB.CityLife.nightShift();
      addText(content, 'Turno de atendimento entre 19h e 2h. Último início à 1h.');
      addButton(content, shift.done ? 'Turno já concluído' : 'Trabalhar no quiosque · 1 h · +14 créditos', () => {
        if (!NB.CityLife.workNightShift()) return;
        render();
        announce(['Turno concluído. +14 créditos.', NB.CityLife.takeNotice()].filter(Boolean).join(' '));
      }, !shift.open || shift.done);
    }
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
      addText(details, card.kind === 'unit'
        ? `${card.atk} ATK · ${card.def} DEF · +${card.ramGain} RAM · ${NB.Cards.affinityLabel(NB.Save.getAffinity(id))}`
        : `Exploit · ${card.cost} RAM`);
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
    renderWorkshop(content, save);
  }

  function renderWorkshop(content, save) {
    const workshop = document.createElement('section');
    workshop.className = 'city-workshop';
    addText(workshop, 'Oficina da Lume', 'city-clue-title');
    addText(workshop, NB.Cards.AFFINITY_CYCLE + '. Vantagem dá +1 de dano contra unidades em choques. Duas afinidades diferentes dão +1 ao Overclock contra um bloqueador.');
    const units = save.unlockedCards.map(id => NB.Cards.CARD_DB[id]).filter(card => card?.kind === 'unit');
    if (!units.length) return;
    const cards = document.createElement('select');
    const affinities = document.createElement('select');
    cards.setAttribute('aria-label', 'Unidade para recalibrar');
    affinities.setAttribute('aria-label', 'Nova afinidade');
    units.forEach(card => cards.add(new Option(card.name, card.id)));
    if (units.some(card => card.id === workshopCardId)) cards.value = workshopCardId;
    const current = document.createElement('p');
    const confirm = addButton(workshop, 'Recalibrar · 15 créditos', () => {
      const id = cards.value;
      const type = affinities.value === 'neutral' ? null : affinities.value;
      if (NB.Save.recalibrate(id, type)) {
        announce(`${NB.Cards.CARD_DB[id].name} agora usa afinidade ${NB.Cards.affinityLabel(type)}.`);
        render();
        document.querySelector('.city-workshop select')?.focus();
      }
    });
    function updateOptions() {
      const id = cards.value;
      const base = NB.Cards.CARD_DB[id].affinity || null;
      const now = NB.Save.getAffinity(id);
      current.textContent = `Afinidade atual · ${NB.Cards.affinityLabel(now)}`;
      affinities.replaceChildren();
      affinities.add(new Option('Escolha a afinidade', ''));
      affinities.options[0].disabled = true;
      for (const type of [null, ...Object.keys(NB.Cards.AFFINITIES)]) {
        if (type === now || (type === null && base !== null)) continue;
        const cost = type === base ? ' · restaurar grátis' : '';
        affinities.add(new Option(NB.Cards.affinityLabel(type) + cost, type || 'neutral'));
      }
      affinities.value = '';
      updatePrice();
    }
    function updatePrice() {
      const base = NB.Cards.CARD_DB[cards.value].affinity || null;
      const selected = affinities.value === 'neutral' ? null : affinities.value;
      const restoring = selected === base;
      confirm.disabled = !affinities.value || (!restoring && save.city.credits < NB.Save.recalibrationPrice);
      confirm.textContent = restoring ? 'Restaurar afinidade' : `Recalibrar · ${NB.Save.recalibrationPrice} créditos`;
    }
    cards.addEventListener('change', () => { workshopCardId = cards.value; updateOptions(); });
    affinities.addEventListener('change', updatePrice);
    workshop.insertBefore(cards, confirm);
    workshop.insertBefore(current, confirm);
    workshop.insertBefore(affinities, confirm);
    updateOptions();
    content.append(workshop);
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
      NB.CityLife.advance(45, 8);
      const notice = NB.CityLife.takeNotice();
      announce(`Tempo esgotado. Nenhum crédito recebido.${notice ? ' ' + notice : ''}`);
      render();
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
      NB.CityLife.advance(45, 8);
      const notice = NB.CityLife.takeNotice();
      if (notice) announce(`${$('city-feedback').textContent} ${notice}`);
    }
    render();
    const buttons = $('city-content').querySelectorAll('.city-symbols button');
    (buttons[jobFocus] || $('city-content').querySelector('button'))?.focus();
  }

  function renderArena(content, save) {
    const challenges = document.createElement('details');
    challenges.className = 'city-residents';
    const label = document.createElement('summary');
    label.textContent = 'Desafios de arquétipo';
    challenges.append(label);
    for (const challenge of NB.Challenges) {
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addText(row, challenge.goal);
      addText(row, save.challengeWins.includes(challenge.id) ? 'Recompensas coletadas.' :
        `Primeira vitória · ${challenge.cards.map(id => NB.Cards.CARD_DB[id].name).join(' + ')}`);
      addButton(row, challenge.name, () => {
        NB.Input.startMatch({ mode: 'challenge', boss: NB.Campaign.getNodeById(challenge.opponent), challenge });
      });
      challenges.append(row);
    }
    addText(challenges, 'Decks emprestados de 20 cartas. Cada duelo consome tempo e energia da cidade.');
    content.append(challenges);
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
    destination = null;
    cancelJob();
    announce('');
    render();
  }

  function open() {
    resetView();
    $('netmap-modal').classList.add('open');
    announce(NB.CityLife.takeNotice());
    document.querySelector('.city-panel').inert = false;
    $('game-ui').inert = true;
    $('city-map').querySelector('[aria-current]')?.focus();
  }

  function bindEvents() {
    for (const district of districts.filter(place => !place.atlasOnly)) {
      const pin = addButton($('city-map'), '', () => selectDestination(district.id), false, 'city-pin');
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
    $('city-journal').addEventListener('click', toggleJournal);
    for (const [id, target] of [['city-bag', 'bag'], ['city-atlas', 'atlas'], ['city-story', 'story']]) {
      $(id).addEventListener('click', () => {
        view = view === target ? 'district' : target;
        destination = null;
        cancelJob();
        announce('');
        render();
        if (view !== 'district') $('city-name').scrollIntoView({ block: 'start' });
      });
    }
  }

  function toggleJournal() {
    const district = districtAtPosition();
    view = view === 'journal' ? 'district' : 'journal';
    NB.Audio.setScene(view === 'journal' ? 'city' : district.music || district.id);
    cancelJob();
    announce('');
    render();
  }

  function handleBack() {
    if (view === 'journal') {
      toggleJournal();
      $('city-journal').focus();
      return true;
    }
    if (!job && view === 'district') return false;
    resetView();
    $('city-content').querySelector('button')?.focus();
    return true;
  }

  function refreshStory(message) {
    render();
    announce([message, NB.CityLife.takeNotice()].filter(Boolean).join(' '));
    $('city-content').querySelector('button')?.focus();
  }

  NB.City = { refreshStory, open, resetView, bindEvents, finishArena, access, cancelJob, handleBack };
})(window.NB = window.NB || {});
