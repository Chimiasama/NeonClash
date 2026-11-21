(function (NB) {
  'use strict';

  const { districts, stock, traces, sparringBoss, wagerBoss } = NB.CityData;
  const $ = id => document.getElementById(id);
  const symbols = ['▲', '●', '◆', '■'];
  const errorPenaltyMs = 2000;
  let job = null;
  let jobTimer = null;
  let view = 'district';
  const residentDuels = {
    10: { hp: 10, credits: 5, deck: ['unit_01', 'unit_02', 'unit_08', 'unit_09', 'exploit_01'] },
    33: { hp: 14, credits: 7, card: 'unit_21', deck: sparringBoss.deckList },
    39: { hp: 22, credits: 12, card: 'unit_23', deck: wagerBoss.deckList, canOverclock: true },
    ...NB.CityAtlas.residentDuels
  };
  const aline = NB.CityAtlas.residents.find(person => person.id === 44);
  const serviceIcons = {
    cards: 'M4 3h16v18H4z M4 8l4-2 3 2 3-2 6 2 M10 15l2-4 2 4-2 4z',
    items: 'M12 4a8 8 0 1 0 8 8l-4-1-1-3-3-1z M10 12a2 2 0 1 0 2 2 M7 10h.01 M10 18h.01 M16 15h.01',
    vehicles: 'M8 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M24 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M4 17l4-8 5 8H4m9 0 4-9 3 9 M15 5h3l2 3 M6 8h5',
    implant: 'M4 20h9l5-5-2-6-3 1-1 5H8L4 20z M16 9l3-4 3 2-3 4 M19 5l-2-2-3 2 M9 17h2',
    cyberdecks: 'M3 5h18v13H3z M7 9h6v5H7z M16 9h2m-2 4h2 M6 21h12',
    workshop: 'M13 6a5 5 0 0 0 5 6l-8 8a2 2 0 0 1-3-3l8-8m-2-3 4 2 2-2-2-4a5 5 0 0 1 5 7l-4 3',
    initiative: 'M5 6h14m-4-3 4 3-4 3 M19 18H5m4-3-4 3 4 3 M12 9v6',
    jobs: 'M3 8h18v12H3z M8 8V4h8v4 M3 13h18 M10 13v3h4v-3'
  };
  const markerTypes = {
    clue: { icon: '◆', label: 'Pista ativa' },
    duel: { icon: '⚔', label: 'Duelo disponível' },
    secret: { icon: '✦', label: 'Atalho ou favor disponível' }
  };
  let mapFilter = 'all';
  let neighborhoodFilter = 'all';

  function urbanEncounter(save) {
    const minute = save.city.life.minute;
    const hour = Math.floor(minute % 1440 / 60);
    const period = hour >= 6 && hour < 19 ? 'day' : 'night';
    const day = Math.floor((minute - 360) / 1440);
    const key = `${period}:${day}`;
    const roster = NB.CityAtlas.encounters[period];
    const roll = Math.imul(day + (period === 'day' ? 1 : 17), 2654435761) >>> 0;
    return save.city.encounterWins.includes(key) ? null : { ...roster[roll % roster.length], key, period };
  }

  function locationMarkers(place, save, clueLocations, encounter) {
    const hasDuel = place.id === 'arena' || encounter?.location === place.id ||
      (NB.Campaign.NODES.some(boss => boss.id === place.id) && !access(place)) ||
      NB.CityAtlas.residents.some(person => person.location === place.id && residentDuels[person.id]);
    const hasSecret = place.id === routePactDestination(save.city.life) || (place.id === 'garage' && save.city.life.vehicles.includes('bike') && !save.city.life.favors.includes('hillPath')) ||
      (place.id === 'pump' && !save.city.life.favors.includes('pumpRelay'));
    return [clueLocations.has(place.id) && 'clue', hasDuel && 'duel', hasSecret && 'secret'].filter(Boolean);
  }

  function applyMarkers(button, types) {
    button.dataset.markers = types.join(' ');
    const badges = document.createElement('span');
    badges.className = 'city-map-badges';
    badges.setAttribute('aria-hidden', 'true');
    if (types.length) button.setAttribute('aria-description', types.map(type => markerTypes[type].label).join(' · '));
    else button.removeAttribute('aria-description');
    for (const type of types) {
      const badge = document.createElement('span');
      badge.className = `city-badge-${type}`;
      badge.title = markerTypes[type].label;
      badge.textContent = markerTypes[type].icon;
      badges.append(badge);
    }
    const previous = button.querySelector('.city-map-badges');
    if (previous) previous.replaceWith(badges);
    else button.append(badges);
  }

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
    $('city-name').scrollIntoView({ block: 'start' });
  }

  function move(mode) {
    if (!NB.CityLife.travel(destination, mode)) return;
    destination = null;
    view = 'district';
    const district = districtAtPosition();
    NB.Audio.setScene(district.music || district.id);
    render();
    const notice = NB.CityLife.takeNotice();
    const challenge = NB.CityLife.getTravelChallenge();
    announce([`Destino alcançado: ${district.name}.`, notice,
      challenge && `${challenge.name} ofereceu um duelo no trajeto.`].filter(Boolean).join(' '));
    $('city-feedback').scrollIntoView({ block: 'center' });
    if (challenge && !challenge.optional) document.querySelector('.city-travel-challenge button')?.focus();
  }

  let streetRestOrigin = null;

  function showStreetRest() {
    const event = NB.Save.get().city.life.streetRestEvent;
    const modal = $('street-rest-modal');
    const cityPanel = document.querySelector('.city-panel');
    if (!event || !$('netmap-modal').classList.contains('open') || modal.classList.contains('open') ||
        cityPanel.inert) return;
    const illustration = NB.CityLife.streetRestArt[event.robbed ? 'robbed' : 'safe'];
    const art = $('street-rest-art');
    art.alt = illustration.description;
    art.src = illustration.source;
    $('street-rest-title').textContent = event.robbed ? 'Assalto no beco' : 'Descanso no beco';
    const hours = NB.CityLife.streetRest.minutes / 60;
    const credits = event.creditsLost === 1 ? '1 crédito' : `${event.creditsLost} créditos`;
    $('street-rest-message').textContent = event.robbed
      ? `Kairo dormiu na rua por ${hours} horas. Ela foi assaltada e perdeu ${credits}.`
      : `Kairo dormiu na rua por ${hours} horas. Ninguém mexeu com ela.`;
    streetRestOrigin = document.activeElement;
    cityPanel.inert = true;
    modal.classList.add('open');
    $('street-rest-close').focus();
  }

  function closeStreetRest() {
    $('street-rest-modal').classList.remove('open');
    NB.CityLife.acknowledgeStreetRest();
    document.querySelector('.city-panel').inert = false;
    const target = streetRestOrigin?.isConnected && streetRestOrigin !== document.body
      ? streetRestOrigin : $('city-map-tab');
    target.focus({ preventScroll: true });
    streetRestOrigin = null;
  }

  function render() {
    queueMicrotask(showStreetRest);
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
    $('city-map-tab').setAttribute('aria-pressed', view === 'district');
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
    const clueLocations = new Set(NB.Story.getScenes().map(scene => scene.location));
    const pending = NB.Story.pendingDuel();
    if (pending) clueLocations.add(pending[0]);
    const encounter = urbanEncounter(save);
    const markers = new Map(districts.map(place => [place.id, locationMarkers(place, save, clueLocations, encounter)]));
    const marker = $('city-marker');
    const [x, y] = NB.CityAtlas.mapPins[district.id];
    marker.style.left = `${x}%`;
    marker.style.top = `${y}%`;
    $('city-neighborhood-picker').hidden = view !== 'atlas';
    document.querySelector('.city-detail').hidden = view === 'atlas';
    const area = view === 'atlas' && NB.CityAtlas.neighborhoods.find(item => item.id === neighborhoodFilter);
    const objectives = [...clueLocations].map(id => districts.find(place => place.id === id).name);
    $('city-map-objectives').textContent = objectives.length ? `◆ Destino da investigação · ${objectives.join(' · ')}` : '';
    for (const filter of $('city-map-legend').querySelectorAll('button')) {
      filter.setAttribute('aria-pressed', String(filter.dataset.mapFilter === mapFilter));
    }
    for (const pin of $('city-map').querySelectorAll('button')) {
      const place = districts.find(item => item.id === pin.dataset.district);
      const types = markers.get(place.id);
      applyMarkers(pin, types);
      pin.classList.toggle('city-pin-labeled', types.includes('clue') || place.id === destination ||
        place.id === district.id || Boolean(area));
      pin.hidden = (mapFilter !== 'all' && !types.includes(mapFilter)) || Boolean(area && !area.locations.includes(place.id));
      const locked = Boolean(access(place));
      pin.classList.toggle('city-locked', locked);
      pin.classList.toggle('city-pin-selected', place.id === destination);
      pin.classList.toggle('city-cleared', NB.Save.isNodeDefeated(place.id));
      if (place.id === district.id) pin.setAttribute('aria-current', 'location');
      else pin.removeAttribute('aria-current');
      pin.setAttribute('aria-label', place.name + (locked ? ' · bloqueado' : ''));
    }

    if (!$('city-map').querySelector('button:not([hidden])')) $('city-map-objectives').textContent = 'Nenhum local corresponde aos filtros.';
    const content = $('city-content');
    content.replaceChildren();
    const mandatory = NB.CityLife.requiredTravelChallenge();
    for (const panel of [$('city-map'), $('city-map-legend'), document.querySelector('.city-nav')]) {
      panel.inert = Boolean(mandatory);
    }
    if (mandatory) {
      $('city-name').textContent = 'Abordagem no caminho';
      renderTravelChallenge(content, mandatory);
      return;
    }
    if (view === 'story') {
      $('city-name').textContent = 'Investigação';
      NB.StoryUI.journal(content, district, selectDestination);
    } else if (view === 'atlas') {
      return;
    } else if (view === 'travel') {
      renderTravel(content, save);
    } else if (view === 'bag') {
      renderBag(content, save.city.life);
    } else if (view === 'journal') {
      if (NB.Story.active()) NB.StoryUI.journal(content, district, selectDestination);
      else renderJournal(content, save);
    } else if (view.startsWith('shop-')) {
      const category = view.slice(5);
      addButton(content, 'Voltar aos serviços', resetView);
      if (category === 'cards') renderMarket(content, save);
      else if (category === 'cyberdecks') renderCyberdecks(content, save.city);
      else if (category === 'initiative') renderInitiativeShop(content, save.city);
      else if (category === 'workshop') renderWorkshop(content, save);
      else renderSupplies(content, save.city, category);
    } else if (district.id === 'home' || district.id === 'pension') {
      renderRest(content, save.city, district.rest);
    } else if (['market', 'kiosk', 'garage'].includes(district.id)) {
      const services = document.createElement('div');
      services.className = 'city-service-grid';
      services.setAttribute('role', 'group');
      services.setAttribute('aria-label', 'Serviços da loja');
      if (district.id === 'market') {
        shopButton(services, 'Ver cartas à venda', 'cards', 'Cartas');
        shopButton(services, 'Ver consumíveis', 'items', 'Consumíveis');
        shopButton(services, 'Ver cyberdecks', 'cyberdecks', 'Cyberdecks');
        shopButton(services, 'Melhorar cartas', 'workshop', 'Melhorar cartas');
        shopButton(services, 'Ver itens de iniciativa', 'initiative', 'Iniciativa');
      } else if (district.id === 'garage') {
        shopButton(services, 'Ver veículos', 'vehicles', 'Veículos');
        shopButton(services, 'Ver implante', 'implant', 'Implantes');
        shopButton(services, 'Ver cyberdecks', 'cyberdecks', 'Cyberdecks');
      } else {
        shopButton(services, 'Ver consumíveis', 'items', 'Consumíveis');
      }
      content.append(services);
      if (district.id === 'kiosk') renderKioskShift(content, services);
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
        const label = cleared ? 'Abrir dossiê · revanche' : 'Abrir dossiê';
        serviceButton(content, label, () => NB.UI.openDossier(district.id), district.npc.split(' · ')[0], { portrait: district.portrait });
      }
    }
    if (view === 'district') {
      const challenge = NB.CityLife.getTravelChallenge();
      if (challenge) renderTravelChallenge(content, challenge);
      NB.StoryUI.local(content, district);
      renderContactServices(content, district.id);
      renderRoutePact(content, district.id, life);
      renderJobs(content, district.id, life);
      if (encounter?.location === district.id) renderEncounter(content, encounter);
      if (district.id !== 'arena') renderLocalDuels(content, district.id);
    }
  }

  function demandText(status) {
    if (!status.available) return 'Demanda esgotada por hoje';
    return status.count === 2 ? '3ª execução · recompensa pela metade' : `${status.count + 1}ª execução · recompensa integral`;
  }

  function renderJobs(content, location, life) {
    const { jobs } = NB.CityAtlas;
    const delivery = life.activeDelivery;
    const dispatch = jobs.delivery.locations.includes(location);
    if (delivery || dispatch) {
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addText(row, 'Correio Expresso · Delivery Clandestino', 'city-clue-title');
      if (delivery) {
        const place = districts.find(item => item.id === delivery.targetId);
        const elapsed = life.minute - delivery.startMinute;
        addText(row, `Destino: ${place.name} · Prazo sem multa: ${8 * delivery.distance} min · Decorridos: ${elapsed} min`);
        addButton(row, `Ir para ${place.name} (entrega)`, () => selectDestination(place.id));
        addButton(row, 'Cancelar entrega', () => {
          if (NB.CityLife.cancelDelivery()) refreshStory('Entrega cancelada.');
        });
      } else {
        const status = NB.CityLife.demand('delivery');
        addText(row, demandText(status));
        serviceButton(row, 'Iniciar Correio Expresso', () => {
          if (NB.CityLife.startDelivery()) refreshStory('Entrega aceita. Consulte o destino do pacote.');
        }, 'Correio Expresso', { icon: 'jobs' }, !status.available);
      }
      content.append(row);
    }

    for (const [id, job] of Object.entries(jobs)) {
      if (id === 'delivery' || !job.locations.includes(location)) continue;
      const quote = NB.CityLife.jobQuote(id);
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addText(row, `${job.minutes} min · −${job.energy} energia · +${quote.pay} créditos`);
      addText(row, demandText(quote));
      if (job.hours) addText(row, `Horário de início: ${job.hours[0]}h às ${job.hours[1]}h (limite exclusivo).`);
      if (id === 'drones') addText(row, NB.CityLife.bagCount(life) < NB.CityLife.bagLimit
        ? 'Inclui café ou energético.' : 'Mochila cheia. A compensação em créditos está incluída.');
      serviceButton(row, job.name, () => {
        const result = NB.CityLife.work(id);
        if (!result) return;
        const item = result.item ? ` · ${NB.CityLife.items[result.item].name} na mochila` : '';
        refreshStory(`${job.name}: +${result.credits} créditos${item}.`);
      }, job.name, { icon: 'jobs' }, !quote.open || !quote.available);
      content.append(row);
    }
  }

  function routePactDestination(life) {
    return ['terminal', 'ringArchive', 'depots', 'pump'][life.routePact];
  }

  function renderRoutePact(content, location, life) {
    const step = life.routePact;
    if (location !== routePactDestination(life)) return;
    const section = document.createElement('section');
    section.className = 'city-local-duels';
    section.setAttribute('aria-label', 'Acordo das Rotas');
    addText(section, 'Acordo das Rotas', 'city-clue-title');

    const mediator = NB.CityAtlas.residents.find(person => person.id === 45);
    const speakers = [
      ['Mara', './avatars/mara.webp', 'Os duelistas começaram a cobrar passagem depois que tiraram os vigias das estações. Leila guardou o caderno de quem travou quais linhas.'],
      ['Leila', './avatars/leila.webp', 'Aqui estão as cobranças. Sinal tenta fazer valer um acordo de passagem no Depósito. Leva o caderno pra ela.'],
      [mediator.name, mediator.portrait, 'Quem cobra diz que está protegendo a rua. Me enfrenta na frente deles e eu consigo pôr teu nome no acordo. Daí a escolha de duelar fica contigo.'],
      ['Maíra', './avatars/maira.webp', 'Posso configurar o filtro da balsa para usar o acordo de Sinal. Se você equipar o módulo, deixa de aparecer na lista de quem pode ser abordada.']
    ];
    const [name, portrait, line] = speakers[step];
    addContactDialogue(section, name, portrait, line);

    if (step === 2) {
      serviceButton(section, 'Duelar com Sinal', () => {
        NB.Input.startMatch({ mode: 'arena', boss: {
          ...wagerBoss, name: mediator.name, fullTitle: 'Sinal // Acordo das Rotas', avatar: mediator.portrait,
          hp: 18, canOverclock: false, routeMediator: true, lines: { start: [line] }
        } });
      }, mediator.name, { portrait: mediator.portrait });
    } else {
      const labels = ['Anotar o relato de Mara', 'Buscar Sinal com o registro de Leila', 'Receber Módulo de Rota Cega'];
      addButton(section, labels[step === 3 ? 2 : step], () => {
        if (!NB.CityLife.advanceRoutePact(step)) return;
        const next = ['Leila está no Arquivo do Ringue.', 'Procure Sinal no Depósito de Peças.'];
        refreshStory(next[step] || 'Módulo de Rota Cega recebido. Equipe-o na Mochila.');
      }, step === 3 && (NB.Story.get().chapter < 2 || !life.favors.includes('pumpRelay')));
      if (step === 3) addText(section, 'Disponível a partir do capítulo 3, depois de ajudar Maíra na bomba.');
    }
    content.append(section);
  }

  function addContactDialogue(parent, name, portrait, line) {
    const dialogue = document.createElement('div');
    dialogue.className = 'city-dialogue';
    const image = document.createElement('img');
    image.src = portrait;
    image.alt = '';
    image.width = image.height = 52;
    dialogue.append(image);
    addText(dialogue, `${name} — ${line}`);
    parent.append(dialogue);
  }

  function renderAline(content, life) {
    const choices = document.createElement('details');
    choices.className = 'city-contact';
    const summary = document.createElement('summary');
    decorateService(summary, 'Aline', { portrait: aline.portrait });
    choices.append(summary);
    addButton(choices, 'Desafiar Aline', () => startResidentDuel(aline));
    if (life.vehicles.includes('bike')) {
      const learned = life.favors.includes('hillPath');
      const lesson = document.createElement('details');
      const topic = document.createElement('summary');
      topic.textContent = learned ? 'Rever a dica da Aline' : 'Aprender com Aline o atalho de bicicleta';
      lesson.append(topic);
      const intro = 'Vi que você comprou uma bicicleta. Conheço uma passagem que poupa tempo e perna. Se me vencer num duelo, eu te mostro por onde entrar.';
      addContactDialogue(lesson, aline.name, aline.portrait, learned ? NB.CityLife.hillPathLesson : intro);
      if (!learned) addButton(lesson, 'Duelar com Aline pelo atalho', () => startResidentDuel(aline, intro, true));
      choices.append(lesson);
    }
    content.append(choices);
  }

  function renderContactServices(content, location) {
    const life = NB.Save.get().city.life;
    const { favors } = life;
    if (location === 'garage') renderAline(content, life);
    if (location === 'pump' && !favors.includes('pumpRelay')) {
      serviceButton(content, 'Ajudar Maíra na bomba · 30 min · +16 créditos', () => {
        if (!NB.CityLife.helpContact('pumpRelay')) return;
        refreshStory('A bomba voltou a funcionar. A travessia para o Cais reabriu.');
      }, 'Maíra', { portrait: './avatars/maira.webp' });
    } else if (location === 'pump') {
      addText(content, 'A balsa para o Cais está aberta das 7h às 18h.');
    }
  }

  function startResidentDuel(person, line = person.line, teachesShortcut = false) {
    const duel = residentDuels[person.id];
    NB.Input.startMatch({
      mode: 'arena',
      boss: {
        ...sparringBoss, name: person.name, fullTitle: `${person.name} // Duelo de bairro`, avatar: person.portrait,
        hp: duel.hp, deckList: duel.deck.length === 20 ? duel.deck : Array.from({ length: 20 }, (_, index) => duel.deck[index % duel.deck.length]),
        canOverclock: Boolean(duel.canOverclock), lines: { start: [line] },
        residentId: person.id, teachesShortcut
      }
    });
  }

  function renderLocalDuels(content, location) {
    const opponents = NB.CityAtlas.residents.filter(person => person.location === location &&
      residentDuels[person.id] && person !== aline);
    if (!opponents.length) return;
    const section = document.createElement('section');
    section.className = 'city-local-duels';
    const heading = document.createElement('h4');
    heading.textContent = 'Duelos locais';
    section.append(heading);
    for (const person of opponents) {
      const duel = residentDuels[person.id];
      const card = NB.Cards.CARD_DB[duel.card];
      const firstWin = !NB.Save.get().city.residentWins.includes(person.id);
      const row = document.createElement('div');
      row.className = 'city-local-duel';
      serviceButton(row, `Desafiar ${person.name}`, () => startResidentDuel(person), person.name, { portrait: person.portrait });
      addText(row, `${duel.hp} HP · +${duel.credits} créditos por vitória${card && firstWin ? ` · primeira vitória: ${card.name}` : ''}`);
      section.append(row);
    }
    content.append(section);
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

  const destinationServices = {
    market: 'Cartas, consumíveis, cyberdecks e itens de iniciativa na banca da Lume.',
    kiosk: 'Café, energéticos e um turno de atendimento noturno.',
    garage: 'Bicicleta, moto, cyberdecks e implante de vigília à venda.',
    relay: 'Trabalhos de sinal na Antena Comunitária.',
    arena: 'Duelos de treino, apostas e desafios de arquétipo conforme a aventura.',
    kira: 'Estação de passagem e ponto de partida do Correio Expresso.',
    terminal: 'Terminal de ônibus com entregas e bicos de registros.',
    depots: 'Depósito de peças com entregas, triagem de sucata e duelos locais.',
    docks: 'Subestação no Cais com entregas e ronda de carga.',
    ferry: 'Embarque para a travessia da Ressaca.',
    pump: 'Casa de Bombas do Canal e acesso à travessia.',
    ringArchive: 'Arquivo dos recibos de entrada e apostas do Ringue.',
    cipher: 'Posto de segurança e manutenção da Muralha.',
    archive: 'Corredor de acesso para a equipe de manutenção.',
    theatre: 'Teatro com salas de ensaio e bastidores.',
    clinic: 'Clínica comunitária e atendimento do Morro.',
    morroKitchen: 'Cozinha do bairro e ponto de trabalho noturno.',
    archon: 'Sede da concessionária Vértice.',
    registry: 'Balcão de cadastros, protocolos e entregas.',
    square: 'Praça do Centro e ponto de encontro do jornal de bairro.'
  };

  function renderTravel(content, save) {
    const place = districts.find(item => item.id === destination);
    const life = save.city.life;
    const { streetRest, beds } = NB.CityLife;
    $('city-name').textContent = `Ir para ${place.name}`;
    if (destinationServices[place.id]) addText(content, destinationServices[place.id]);
    if (place.rest) {
      const bed = beds[place.rest];
      addText(content, `Descanso · ${duration(bed.minutes)} · ${bed.price ? `${bed.price} créditos` : 'Grátis'} · recupera toda a energia.`);
    }
    for (const scene of NB.Story.getScenes(place.id)) addText(content, `◆ Ao chegar: ${scene.title}`, 'city-active-destination');
    if (NB.Story.pendingDuel(place.id)) addText(content, '◆ Ao chegar: abrir o dossiê da investigação', 'city-active-destination');
    if (place.id === 'archon' && NB.Story.archonWarning()) addText(content, NB.Story.archonWarning(), 'city-notice');
    addText(content, `Energia atual: ${life.energy}. Os custos abaixo só são cobrados ao escolher um transporte.`);
    for (const route of NB.CityLife.routes(destination)) {
      const row = document.createElement('div');
      row.className = 'city-life-row city-route';
      addButton(row, route.name, () => move(route.id), !route.available);
      if (route.needsVehicle) {
        addText(row, 'Disponível na Garagem da Íris.');
      } else {
        addText(row, `${duration(route.minutes)} · ${route.fare ? `${route.fare} créditos` : 'Grátis'} · −${route.energy} energia`);
        addText(row, `Chegada: ${NB.CityLife.clock(life.minute + route.minutes)} · Energia ao chegar: ${route.energyAfter}/${NB.CityLife.maxEnergy(life)}`);
        if (route.encounterChance) addText(row, `Chance de desafio: ${route.encounterChance}%`);
        if (route.note) addText(row, route.note);
        if (route.willCollapse) addText(row, place.id === 'home'
          ? `Você vai dormir em casa ao chegar: ${duration(beds.home.minutes)} grátis e energia cheia.`
          : `Você vai precisar dormir ao chegar. São ${duration(streetRest.minutes)} na rua. Ao acordar, terá ${streetRest.energy} de energia e há ${streetRest.robberyChance}% de risco de perder ${streetRest.creditsLost}% dos créditos restantes após a passagem.`, 'city-notice');
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
    if (life.routePact === 4) {
      addText(content, 'Módulo de Rota Cega · evita abordagens no trajeto enquanto equipado.');
      addButton(content, life.routeMask ? 'Desativar Rota Cega' : 'Ativar Rota Cega', () => {
        if (NB.CityLife.setRouteMask(!life.routeMask)) render();
      });
    }
    if (life.ownedInitiative.length) {
      addText(content, 'Iniciativa do duelo', 'city-clue-title');
      const active = NB.CityLife.initiativeItems[life.activeInitiative];
      addText(content, active ? `${active.name} ativo · ${initiativeDescription(active)}` : 'Ordem inicial por sorteio.');
      for (const id of life.ownedInitiative) {
        const item = NB.CityLife.initiativeItems[id];
        const selected = life.activeInitiative === id;
        addButton(content, `${selected ? 'Desativar' : 'Ativar'} ${item.name}`, () => {
          if (NB.CityLife.equipInitiative(selected ? null : id)) render();
        });
      }
    }
    addText(content, 'Cyberdeck equipado', 'city-clue-title');
    for (const id of life.ownedDecks) {
      const deck = NB.CityLife.cyberdecks[id];
      const equipped = id === life.equippedDeck;
      addButton(content, `${equipped ? 'Equipado' : 'Equipar'} · ${deck.name} · +${deck.ram} RAM inicial`, () => {
        if (NB.CityLife.equipCyberdeck(id)) render();
      }, equipped);
    }
  }

  function decorateService(control, text, { icon, portrait }) {
    control.classList.add('city-service');
    const span = document.createElement('span');
    span.textContent = text;
    if (portrait) {
      const image = document.createElement('img');
      image.src = portrait;
      image.alt = '';
      control.replaceChildren(image, span);
    } else {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', icon === 'vehicles' ? '-1 0 26 24' : '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', serviceIcons[icon]);
      svg.append(path);
      control.replaceChildren(svg, span);
    }
  }

  function serviceButton(parent, label, action, text, artwork, disabled = false) {
    const control = addButton(parent, label, action, disabled);
    control.setAttribute('aria-label', label);
    decorateService(control, text, artwork);
    return control;
  }

  function shopButton(content, label, category, text) {
    serviceButton(content, label, () => {
      view = `shop-${category}`;
      announce('');
      render();
      $('city-content').querySelector('button')?.focus();
    }, text, { icon: category });
  }

  function initiativeDescription(item) {
    return item.side === 'player' ? 'Kairo começa o duelo.' : 'O adversário começa o duelo.';
  }

  function renderInitiativeShop(content, state) {
    for (const [id, item] of Object.entries(NB.CityLife.initiativeItems)) {
      const owned = state.life.ownedInitiative.includes(id);
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addText(row, item.name, 'city-clue-title');
      addText(row, initiativeDescription(item));
      addButton(row, owned ? 'Adquirido' : `Comprar · ${item.price} créditos`, () => {
        if (NB.CityLife.buy(id)) refreshStory(`${item.name} adquirido. Ative-o na Mochila.`);
      }, owned || state.credits < item.price);
      content.append(row);
    }
  }

  function renderCyberdecks(content, state) {
    for (const [id, deck] of Object.entries(NB.CityLife.cyberdecks)) {
      if (deck.shop !== state.district) continue;
      const owned = state.life.ownedDecks.includes(id);
      const available = NB.Story.get().chapter >= deck.chapter;
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addText(row, `${deck.name} · +${deck.ram} RAM inicial`, 'city-clue-title');
      if (!available) addText(row, `Disponível a partir do capítulo ${deck.chapter + 1}.`);
      addButton(row, owned ? 'Adquirido' : `Comprar · ${deck.price} créditos`, () => {
        if (NB.CityLife.buy(id)) refreshStory(`${deck.name} adquirido e equipado.`);
      }, owned || !available || state.credits < deck.price);
      content.append(row);
    }
  }

  function renderSupplies(content, state, category) {
    const life = state.life;
    const sellsConsumables = category === 'items';
    if (sellsConsumables && NB.Story.get().nairTruthEarly === true) addText(content, 'Rede de Dona Nair · 20% de desconto em consumíveis.', 'city-notice');
    const goods = sellsConsumables
      ? Object.entries(NB.CityLife.items).map(([id, item]) => ({ id, ...item, price: NB.CityLife.consumablePrice(id), detail: `+${item.energy} de energia`, owned: false }))
      : category === 'vehicles'
        ? ['bike', 'motorbike'].map(id => ({ id, ...NB.CityLife.transport[id], owned: life.vehicles.includes(id) }))
        : [{ id: 'implant', name: 'Implante de vigília', price: NB.CityLife.implantPrice, owned: life.implant,
          detail: '+20 de energia máxima · +4 h acordado' }];
    for (const item of goods) {
      const row = document.createElement('div');
      row.className = 'city-life-row';
      addText(row, item.name, 'city-clue-title');
      if (item.detail) addText(row, item.detail);
      addButton(row, item.owned ? 'Adquirido' : `Comprar · ${item.price} créditos`, () => {
        if (!NB.CityLife.buy(item.id)) return;
        render();
        announce(`${item.name} adquirido.`);
      }, item.owned || state.credits < item.price || (sellsConsumables && NB.CityLife.bagCount(life) >= NB.CityLife.bagLimit));
      content.append(row);
    }
  }

  function renderKioskShift(content, services) {
    const shift = NB.CityLife.nightShift();
    addText(content, 'Turno de atendimento entre 19h e 2h. Último início à 1h.');
    serviceButton(services, shift.done ? 'Turno já concluído' : 'Trabalhar no quiosque · 1 h · +14 créditos', () => {
      if (!NB.CityLife.workNightShift()) return;
      render();
      announce(['Turno concluído. +14 créditos.', NB.CityLife.takeNotice()].filter(Boolean).join(' '));
    }, 'Trabalho', { icon: 'jobs' }, !shift.open || shift.done);
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
    for (const { id, price, chapter = 0 } of stock) {
      if (NB.Story.get().chapter < chapter) continue;
      const card = NB.Cards.CARD_DB[id];
      const owned = save.unlockedCards.includes(id);
      const row = document.createElement('div');
      row.className = 'city-sale';
      const art = document.createElement('div');
      art.className = 'city-sale-art';
      art.append(NB.Sprites.createArtMarkup(card.id, card.img, ''));
      row.append(art);
      const details = document.createElement('div');
      addText(details, card.name, 'city-clue-title');
      addText(details, card.kind === 'unit' ? 'Unidade' : 'Exploit');
      if (owned) {
        addText(details, card.kind === 'unit'
          ? `${card.atk} ATK · ${card.def} DEF · +${card.ramGain} RAM · ${NB.Cards.affinityLabel(NB.Save.getAffinity(id))}`
          : `${card.cost} RAM`);
      }
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

  function renderWorkshop(content, save) {
    const workshop = document.createElement('section');
    workshop.className = 'city-workshop';
    addText(workshop, 'Oficina da Lume', 'city-clue-title');
    addText(workshop, NB.Cards.AFFINITY_CYCLE + '. Vantagem dá +1 de dano contra unidades em choques. Duas afinidades diferentes dão +1 ao Overclock contra um bloqueador.');
    const units = save.unlockedCards.map(id => NB.Cards.CARD_DB[id]).filter(card => card?.kind === 'unit');
    if (!units.length) return;

    const grid = document.createElement('div');
    grid.className = 'workshop-grid';
    const editor = document.createElement('div');
    editor.className = 'workshop-editor';
    editor.hidden = true;
    workshop.append(grid, editor);
    content.append(workshop);

    for (const card of units) {
      const tile = addButton(grid, card.name, () => selectCard(card, tile));
      tile.dataset.cardId = card.id;
      tile.setAttribute('aria-pressed', 'false');
      tile.prepend(NB.Sprites.createArtMarkup(card.id, card.img, ''));
    }

    function selectCard(card, tile) {
      for (const button of grid.children) button.setAttribute('aria-pressed', button === tile);
      editor.hidden = false;
      editor.replaceChildren();
      addText(editor, `${card.name} · ${card.atk} ATK / ${card.def} DEF`, 'city-clue-title');
      const current = document.createElement('p');
      const affinities = document.createElement('select');
      affinities.setAttribute('aria-label', 'Nova afinidade');
      const advice = document.createElement('p');
      advice.setAttribute('aria-live', 'polite');
      editor.append(current, affinities, advice);
      const confirm = addButton(editor, '', () => {
        const type = selectedType();
        if (!affinities.value || !NB.Save.recalibrate(card.id, type)) return;
        announce(`${card.name} agora usa afinidade ${NB.Cards.affinityLabel(type)}.`);
        $('city-credits').textContent = `${save.city.credits} créditos`;
        updateOptions();
        affinities.focus();
      });
      const base = card.affinity || null;
      const selectedType = () => affinities.value === 'neutral' ? null : affinities.value;

      function updateOptions() {
        const now = NB.Save.getAffinity(card.id);
        current.textContent = `Afinidade atual · ${NB.Cards.affinityLabel(now)}`;
        affinities.replaceChildren(new Option('Escolha a afinidade', '', true, true));
        affinities.options[0].disabled = true;
        for (const type of [null, ...Object.keys(NB.Cards.AFFINITIES)]) {
          if (type === now || (type === null && base !== null)) continue;
          affinities.add(new Option(NB.Cards.affinityLabel(type) + (type === base ? ' · restaurar grátis' : ''), type || 'neutral'));
        }
        updatePrice();
      }

      function updatePrice() {
        const type = selectedType();
        const now = NB.Save.getAffinity(card.id);
        const restoring = type === base;
        confirm.disabled = !affinities.value || (!restoring && save.city.credits < NB.Save.recalibrationPrice);
        confirm.textContent = restoring ? 'Restaurar afinidade' : `Recalibrar · ${NB.Save.recalibrationPrice} créditos`;
        if (!affinities.value) {
          advice.textContent = 'Lume — Escolhe uma afinidade que complemente a outra unidade que você quer levar pro Overclock.';
          return;
        }
        const advantage = id => NB.Cards.AFFINITIES[NB.Cards.AFFINITIES[id]?.beats]?.name;
        const gains = type ? `Agora ela dará +1 de dano contra ${advantage(type)} nos choques.` : 'Neutra, ela deixa de explorar vantagens de afinidade.';
        const tradeoff = now ? ` Ela abre mão do bônus contra ${advantage(now)}.` : '';
        const synergy = type ? ' Para ganhar o bônus de Overclock contra um bloqueador, junte com outra afinidade.' : ' Com afinidade neutra, ela não ativa o bônus de dupla no Overclock.';
        advice.textContent = `Lume — ${gains}${tradeoff}${synergy} O ATK e a DEF de base ficam iguais.`;
      }

      affinities.addEventListener('change', updatePrice);
      updateOptions();
      affinities.focus();
    }
  }

  function renderRelay(content, save) {
    const lead = save.clues.find(clue => traces[clue.bossId] && !save.city.traced.includes(clue.bossId));
    if (!job) {
      if (lead) {
        addButton(content, 'Rastrear pista', () => startJob(lead.bossId), false, 'city-primary');
      }
      for (const [id, mode] of Object.entries(NB.CityLife.relayModes)) {
        const status = NB.CityLife.demand(id, mode.pay);
        const row = document.createElement('div');
        row.className = 'city-life-row';
        serviceButton(row, mode.name, () => startJob(null, id), mode.name, { icon: 'jobs' }, !status.available);
        addText(row, `${mode.symbols} símbolos · ${(mode.previewMs / 1000).toLocaleString('pt-BR')} s para memorizar · 12 s para enviar`);
        addText(row, `${mode.minutes} min · −${mode.energy} energia · +${status.pay} créditos · ${demandText(status)}`);
        content.append(row);
      }
      addText(content, 'Cada erro reinicia a sequência e custa 2 s.');
      return;
    }

    addText(content, job.lead ? 'Rastreamento de pista' : NB.CityLife.relayModes[job.modeId].name, 'city-clue-title');
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
      NB.CityLife.finishSignal(job.modeId, false);
      cancelJob();
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

  function startJob(lead, modeId) {
    const mode = NB.CityLife.relayModes[modeId];
    if (!lead && (!mode || !NB.CityLife.demand(modeId).available)) return;
    const revealUntil = performance.now() + (mode?.previewMs || 0);
    job = {
      lead, modeId,
      index: 0,
      revealing: !lead,
      revealUntil,
      deadline: revealUntil + (mode?.inputMs || 0),
      sequence: Array.from({ length: lead ? 4 : mode.symbols }, () => symbols[Math.floor(Math.random() * symbols.length)])
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
        NB.CityLife.advance(45, 8);
      } else {
        const credits = NB.CityLife.finishSignal(job.modeId, true);
        announce(`Trabalho concluído. Você recebeu ${credits} créditos.`);
      }
      cancelJob();
      const notice = NB.CityLife.takeNotice();
      if (notice) announce(`${$('city-feedback').textContent} ${notice}`);
    }
    render();
    const buttons = $('city-content').querySelectorAll('.city-symbols button');
    (buttons[jobFocus] || $('city-content').querySelector('button'))?.focus();
  }

  function renderArena(content, save) {
    const stakeUnlocked = NB.Save.isNodeDefeated('kira');
    const ring = document.createElement('div');
    ring.className = 'city-service-grid';
    const portrait = { portrait: sparringBoss.avatar };
    serviceButton(ring, 'Desafio de rua · vitória paga 15', () => startArena(0), 'Risco · Treino', portrait);
    serviceButton(ring, 'Apostar 25 · vitória paga 60', () => startArena(25), 'Risco · Aposta', portrait,
      !stakeUnlocked || save.city.credits < 25);
    content.append(ring);
    if (!stakeUnlocked) addText(content, 'A mesa de apostas abre após vencer Kira.', 'city-notice');
    else if (save.city.credits < 25) addText(content, 'Você precisa de 25 créditos para apostar.', 'city-notice');
    else addText(content, 'Na mesa de apostas, sair do duelo encerra a partida e perde a entrada.');
    renderLocalDuels(content, 'arena');
    const challenges = document.createElement('section');
    challenges.className = 'city-local-duels';
    const label = document.createElement('h4');
    label.textContent = 'Desafios de arquétipo';
    challenges.append(label);
    const unlocked = NB.Challenges.filter(challenge => NB.Save.isArchetypeUnlocked(challenge.opponent));
    if (!unlocked.length) addText(challenges, 'Novos desafios aparecem conforme você resolve encontros na aventura.');
    for (const challenge of unlocked) {
      const row = document.createElement('div');
      row.className = 'city-local-duel';
      addText(row, challenge.goal);
      addText(row, save.challengeWins.includes(challenge.id) ? 'Recompensas coletadas.' :
        `Primeira vitória · ${challenge.cards.map(id => NB.Cards.CARD_DB[id].name).join(' + ')}`);
      const boss = NB.Campaign.getNodeById(challenge.opponent);
      serviceButton(row, challenge.name, () => {
        NB.Input.startMatch({ mode: 'challenge', boss, challenge });
      }, challenge.name, { portrait: boss.avatar });
      challenges.append(row);
    }
    addText(challenges, 'Decks emprestados de 20 cartas. Cada duelo consome tempo e energia da cidade.');
    content.append(challenges);
  }

  function startArena(stake) {
    const save = NB.Save.get();
    if (stake && (!NB.Save.isNodeDefeated('kira') || save.city.credits < stake)) return;
    save.city.credits -= stake;
    NB.Save.save();
    NB.Input.startMatch({ mode: 'arena', boss: stake ? wagerBoss : sparringBoss, stake, autoSound: false });
  }

  function renderEncounter(content, encounter) {
    serviceButton(content, `Desafiar ${encounter.name} · encontro urbano`, () => {
      NB.Input.startMatch({
        mode: 'arena',
        boss: {
          ...(encounter.period === 'night' ? wagerBoss : sparringBoss),
          hp: encounter.hp, name: encounter.name, fullTitle: `${encounter.name} // Encontro urbano`,
          avatar: encounter.portrait, encounterKey: encounter.key, encounterReward: encounter.credits
        }
      });
    }, encounter.name, { portrait: encounter.portrait });
  }

  function renderTravelChallenge(content, challenge) {
    const offer = document.createElement('section');
    offer.className = 'city-local-duels city-travel-challenge';
    offer.setAttribute('aria-label', 'Desafio de viagem');
    addText(offer, `${challenge.name} abordou Kairo no trajeto.`, 'city-clue-title');
    addText(offer, `${challenge.label} · ${challenge.hp} HP · vitória paga ${challenge.reward} créditos`);
    serviceButton(offer, `Aceitar desafio de ${challenge.name}`, () => {
      if (!NB.CityLife.getTravelChallenge()) return;
      NB.Input.startMatch({ mode: 'arena', boss: {
        ...sparringBoss, name: challenge.name, fullTitle: `${challenge.name} // Desafio de viagem`,
        avatar: challenge.portrait, hp: challenge.hp, canOverclock: Boolean(challenge.canOverclock),
        deckList: Array.from({ length: 20 }, (_, index) => challenge.deck[index % challenge.deck.length]),
        travelReward: challenge.reward
      } });
    }, challenge.name, { portrait: challenge.portrait });
    const fee = NB.CityLife.travelWithdrawalFee();
    if (!challenge.optional) addText(offer, 'Resolva a abordagem para recuperar acesso à cidade.');
    const actionLabel = challenge.optional ? 'Recusar desafio' : `Desistir · perder ${fee} créditos`;
    addButton(offer, actionLabel, () => {
      const paid = NB.CityLife.settleTravelChallenge(true);
      if (paid === null) return;
      render();
      announce(paid ? `Você desistiu do desafio e perdeu ${paid} créditos.` : 'Você deixou a abordagem sem duelar.');
    });
    content.append(offer);
  }

  function finishArena(state, winner) {
    const save = NB.Save.get();
    if (state.boss.travelReward) {
      const reward = NB.CityLife.finishTravelChallenge(winner === 'player');
      state.payout = reward.credits;
      state.travelBonus = reward.bonus;
      return;
    }
    if (winner === 'player' && state.boss.routeMediator && NB.CityLife.advanceRoutePact(2)) {
      state.routePactWon = true;
    }
    if (winner === 'player' && state.boss.teachesShortcut && NB.CityLife.learnHillPath()) state.hillPathLearned = true;
    const residentId = state.boss.residentId;
    const duel = residentDuels[residentId];
    const encounter = state.boss.encounterKey;
    const payout = winner === 'player'
      ? (state.boss.routeMediator ? 12 : encounter ? state.boss.encounterReward : duel ? duel.credits : state.stake ? 60 : 15) : 0;
    if (winner === 'player' && encounter) save.city.encounterWins = [...save.city.encounterWins, encounter].slice(-4);
    state.payout = payout;
    if (winner === 'player' && duel && !save.city.residentWins.includes(residentId)) {
      save.city.residentWins.push(residentId);
      if (duel.card && !save.unlockedCards.includes(duel.card)) {
        save.unlockedCards.push(duel.card);
        state.residentReward = duel.card;
      }
    }
    save.city.credits += payout;
    NB.Save.save();
  }

  function resetView() {
    view = 'district';
    destination = null;
    cancelJob();
    announce('');
    render();
  }

  function open(message = '') {
    resetView();
    $('netmap-modal').classList.add('open');
    announce([message, NB.CityLife.takeNotice()].filter(Boolean).join(' '));
    document.querySelector('.city-panel').inert = false;
    $('game-ui').inert = true;
    document.querySelector('.city-scroll').scrollTop = 0;
    if (message) $('city-feedback').scrollIntoView({ block: 'center' });
    if (NB.CityLife.requiredTravelChallenge()) document.querySelector('.city-travel-challenge button')?.focus();
    else $('city-map').querySelector('[aria-current]')?.focus({ preventScroll: true });
  }

  function bindEvents() {
    $('street-rest-close').addEventListener('click', closeStreetRest);
    for (const district of districts) {
      const pin = addButton($('city-map'), '', () => selectDestination(district.id), false, 'city-pin');
      pin.dataset.district = district.id;
      const [x, y, glyph, category] = NB.CityAtlas.mapPins[district.id];
      pin.style.left = `${x}%`;
      pin.style.top = `${y}%`;
      pin.dataset.category = category;
      const icon = document.createElement('span');
      icon.className = 'city-place-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = glyph;
      const label = document.createElement('span');
      label.className = 'city-place-label';
      label.textContent = district.short || NB.CityAtlas.shortNames[district.id];
      pin.append(icon, label);
    }
    const neighborhood = $('city-neighborhood');
    neighborhood.add(new Option('Todos os bairros', 'all'));
    for (const area of NB.CityAtlas.neighborhoods) neighborhood.add(new Option(area.name, area.id));
    neighborhood.addEventListener('change', () => {
      neighborhoodFilter = neighborhood.value;
      render();
    });
    $('city-map-legend').addEventListener('click', event => {
      const filter = event.target.closest('[data-map-filter]');
      if (!filter) return;
      mapFilter = filter.dataset.mapFilter;
      view = view === 'atlas' ? 'atlas' : 'district';
      destination = null;
      cancelJob();
      announce('');
      render();
    });
    $('city-map-tab').addEventListener('click', () => {
      resetView();
      $('city-map-legend').scrollIntoView({ block: 'start' });
    });
    $('city-journal').addEventListener('click', toggleJournal);
    for (const [id, target] of [['city-bag', 'bag'], ['city-atlas', 'atlas'], ['city-story', 'story']]) {
      $(id).addEventListener('click', () => {
        view = view === target ? 'district' : target;
        destination = null;
        cancelJob();
        announce('');
        render();
        if (view === 'atlas') $('city-neighborhood-picker').scrollIntoView({ block: 'nearest' });
        else if (view !== 'district') $('city-name').scrollIntoView({ block: 'start' });
      });
    }
  }

  function toggleJournal() {
    const district = districtAtPosition();
    view = view === 'journal' ? 'district' : 'journal';
    destination = null;
    NB.Audio.setScene(view === 'journal' ? 'city' : district.music || district.id);
    cancelJob();
    announce('');
    render();
    if (view === 'journal') $('city-name').scrollIntoView({ block: 'start' });
  }

  function handleBack() {
    if (NB.CityLife.requiredTravelChallenge()) return false;
    if (view === 'journal') {
      toggleJournal();
      $('city-journal').focus();
      return true;
    }
    const collection = document.querySelector('.city-contact[open] details[open], .city-contact[open]');
    if (view === 'district' && collection) {
      collection.open = false;
      collection.querySelector('summary').focus();
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

  NB.City = { showStreetRest, refreshStory, open, resetView, bindEvents, finishArena, access, cancelJob, handleBack };
})(window.NB = window.NB || {});
