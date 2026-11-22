(function (NB) {
  'use strict';

  const { districts, stock, traces, sparringBoss, wagerBoss } = NB.CityData;
  const $ = id => document.getElementById(id);
  const symbols = ['▲', '●', '◆', '■'];
  const errorPenaltyMs = 2000;
  let job = null;
  let jobTimer = null;
  let view = 'district';
  let travelOrigin = 'map';
  const residentDuels = {
    10: { hp: 10, credits: 5, expansionCard: 'unit_52', deck: ['unit_01', 'unit_02', 'unit_37', 'unit_24', 'exploit_19'] },
    33: { hp: 14, credits: 7, expansionCard: 'unit_53', card: 'unit_21', deck: sparringBoss.deckList },
    39: { hp: 22, credits: 12, expansionCard: 'unit_54', card: 'unit_23', deck: wagerBoss.deckList, canOverclock: true },
    ...NB.CityAtlas.residentDuels
  };
  const aline = NB.CityAtlas.residents.find(person => person.id === 44);
  const serviceIcons = {
    cards: 'M4 3h16v18H4z M4 8l4-2 3 2 3-2 6 2 M10 15l2-4 2 4-2 4z',
    items: 'M12 4a8 8 0 1 0 8 8l-4-1-1-3-3-1z M10 12a2 2 0 1 0 2 2 M7 10h.01 M10 18h.01 M16 15h.01',
    vehicles: 'M8 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M24 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M4 17l4-8 5 8H4m9 0 4-9 3 9 M15 5h3l2 3 M6 8h5',
    implant: 'M4 20h9l5-5-2-6-3 1-1 5H8L4 20z M16 9l3-4 3 2-3 4 M19 5l-2-2-3 2 M9 17h2',
    cyberdecks: 'M3 5h18v13H3z M7 9h6v5H7z M16 9h2m-2 4h2 M6 21h12',
    upgrades: 'M7 15l5-5 5 5 M7 9l5-5 5 5 M5 20h14',
    workshop: 'M13 6a5 5 0 0 0 5 6l-8 8a2 2 0 0 1-3-3l8-8m-2-3 4 2 2-2-2-4a5 5 0 0 1 5 7l-4 3',
    initiative: 'M5 6h14m-4-3 4 3-4 3 M19 18H5m4-3-4 3 4 3 M12 9v6',
    jobs: 'M3 8h18v12H3z M8 8V4h8v4 M3 13h18 M10 13v3h4v-3'
  };
  const markerTypes = {
    clue: { icon: '◆', label: 'Pista ativa' },
    duel: { icon: '⚔', label: 'Duelo disponível' },
    secret: { icon: '✦', label: 'Atalho ou favor disponível' }
  };
  const characterUpgrades = ['cyberdecks', 'initiative', 'implant'];
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
    const tradeMission = Object.entries(NB.CityCommerce.merchants).some(([kind, merchant]) =>
      merchant.location === place.id && save.city.life.commerce.seen.includes(kind) &&
      !save.city.life.commerce.discounts.includes(kind));
    const hasDuel = tradeMission || place.id === 'arena' || encounter?.location === place.id ||
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
  let missionTab = 'main';
  const routePactLog = [
    { location: 'terminal', contact: 'Mara', task: 'Anotar o relato sobre as cobranças nas rotas.' },
    { location: 'ringArchive', contact: 'Leila', task: 'Conferir o caderno de cobranças.' },
    { location: 'depots', contact: 'Sinal', task: 'Vencer o duelo para entrar no acordo.' },
    { location: 'pump', contact: 'Maíra', task: 'Ajudar na bomba e receber o Módulo de Rota Cega no capítulo 3 ou depois.' }
  ];
  const pactReward = 'Abordagens opcionais. Você pode recusar ou abandonar sem pagar.';
  const maskReward = 'Módulo de Rota Cega. Ative na Mochila para impedir novas abordagens durante viagens.';


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
    if (view !== 'travel') travelOrigin = view;
    destination = id === districtAtPosition().id ? null : id;
    view = destination ? 'travel' : 'district';
    if (!destination) {
      const district = districtAtPosition();
      NB.Audio.setScene(district.music || district.id);
    }
    render();
    scrollCityTop();
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
    scrollCityTop();
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
    const mandatory = NB.CityLife.requiredTravelChallenge();
    const showMap = !mandatory && ['map', 'atlas'].includes(view);
    $('city-map-tab').setAttribute('aria-pressed', view === 'map');
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
    $('city-map-view').hidden = !showMap;
    $('city-current-location').textContent = `Ver local atual · ${district.name}`;
    $('city-neighborhood-picker').hidden = view !== 'atlas';
    document.querySelector('.city-detail').hidden = showMap;
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
    for (const panel of [$('city-map'), $('city-map-legend'), document.querySelector('.city-nav')]) {
      panel.inert = Boolean(mandatory);
    }
    if (mandatory) {
      if (view === 'district') NB.StoryUI.local(content, district, true);
      $('city-name').textContent = 'Abordagem no caminho';
      renderTravelChallenge(content, mandatory);
      return;
    }
    if (view === 'story') {
      $('city-name').textContent = 'Investigação';
      renderMissionLog(content, district, save);
    } else if (showMap) {
      return;
    } else if (view === 'travel') {
      renderTravel(content, save);
    } else if (view === 'bag') {
      renderBag(content, save.city.life);
    } else if (view === 'journal') {
      if (NB.Story.active()) renderMissionLog(content, district, save);
      else renderJournal(content, save);
    } else if (view.startsWith('shop-')) {
      const category = view.slice(5);
      if (characterUpgrades.includes(category)) {
        addButton(content, 'Voltar às melhorias', () => openShop('upgrades'));
      } else addButton(content, 'Voltar aos serviços', resetView);
      if (category === 'upgrades') {
        const services = shopServices('Melhorias da Kairo');
        shopButton(services, 'Ver cyberdecks', 'cyberdecks', 'Cyberdecks');
        if (district.id === 'market') shopButton(services, 'Ver itens de iniciativa', 'initiative', 'Iniciativa');
        else if (district.id === 'garage') shopButton(services, 'Ver implante', 'implant', 'Implantes');
        content.append(services);
      } else if (category === 'cards') renderMarket(content, save);
      else if (category === 'cyberdecks') renderCyberdecks(content, save.city);
      else if (category === 'initiative') renderInitiativeShop(content, save.city);
      else if (category === 'workshop') renderWorkshop(content, save);
      else renderSupplies(content, save.city, category);
    } else if (district.id === 'home' || district.id === 'pension') {
      renderRest(content, save.city, district.rest);
    } else if (['market', 'kiosk', 'garage'].includes(district.id)) {
      const services = shopServices('Serviços da loja');
      if (district.id === 'market') {
        shopButton(services, 'Ver cartas à venda', 'cards', 'Cartas');
        shopButton(services, 'Ver consumíveis', 'items', 'Consumíveis');
        shopButton(services, 'Ver melhorias', 'upgrades', 'Melhorias');
        shopButton(services, 'Melhorar cartas', 'workshop', 'Oficina de cartas');
      } else if (district.id === 'garage') {
        shopButton(services, 'Ver veículos', 'vehicles', 'Veículos');
        shopButton(services, 'Ver melhorias', 'upgrades', 'Melhorias');
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
      if (NB.Story.pendingDuel(district.id)) {
        serviceButton(content, 'Duelar pela investigação', () => NB.Input.startStoryDuel(district.id),
          district.npc.split(' · ')[0], { portrait: district.portrait });
      } else if (requirement) {
        addText(content, requirement, 'city-notice');
      } else {
        const label = cleared ? 'Abrir dossiê · revanche' : 'Abrir dossiê';
        serviceButton(content, label, () => NB.UI.openDossier(district.id), district.npc.split(' · ')[0], { portrait: district.portrait });
      }
    }
    if (view === 'district') {
      renderCommerce(content, district.id);
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
    return routePactLog[life.routePact]?.location;
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
        refreshStory(next[step] || `Prêmio recebido: ${maskReward}`);
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
    const prize = residentDuels[aline.id].expansionCard;
    if (!NB.Save.get().unlockedCards.includes(prize)) addText(choices, `Prêmio especial · ${NB.Cards.CARD_DB[prize].name}`);
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
      const extra = duel.expansionCard && !NB.Save.get().unlockedCards.includes(duel.expansionCard)
        ? NB.Cards.CARD_DB[duel.expansionCard].name : '';
      const row = document.createElement('div');
      row.className = 'city-local-duel';
      serviceButton(row, `Desafiar ${person.name}`, () => startResidentDuel(person), person.name, { portrait: person.portrait });
      addText(row, `${duel.hp} HP · +${duel.credits} créditos por vitória${card && firstWin ? ` · primeira vitória: ${card.name}` : ''}`);
      if (extra) addText(row, `Prêmio especial · ${extra}`);
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
    kira: 'Estação de passagem, passe de ônibus e ponto de partida do Correio Expresso.',
    terminal: 'Terminal de ônibus com passe de viagem, entregas e bicos de registros.',
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
    if (NB.Story.pendingDuel(place.id)) addText(content, '◆ Ao chegar: duelar pela investigação', 'city-active-destination');
    const schedule = NB.Story.unavailableSchedule(place.id);
    if (schedule) addText(content, schedule, 'city-notice');
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
    addButton(content, 'Cancelar viagem', cancelTravel);
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
    const ticket = NB.CityCommerce.activePass();
    if (ticket) addText(content, `Passe de ônibus · ${ticket.trips} viagens · expira em ${duration(ticket.until - life.minute)}.`);
    if (life.commerce.navigator) addText(content, 'Scanner de rota · −5 pontos percentuais de abordagens de ônibus ou bicicleta antes da fadiga.');
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

  function shopServices(label) {
    const services = document.createElement('div');
    services.className = 'city-service-grid';
    services.setAttribute('role', 'group');
    services.setAttribute('aria-label', label);
    return services;
  }

  function openShop(category) {
    view = `shop-${category}`;
    announce('');
    render();
    $('city-content').querySelector('button')?.focus();
  }

  function shopButton(content, label, category, text) {
    serviceButton(content, label, () => openShop(category), text, { icon: category });
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

  function renderMissionLog(content, district, save) {
    const tabs = document.createElement('div');
    tabs.className = 'city-mission-tabs';
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Categorias de missões');
    for (const [id, label] of [['main', 'Missão principal'], ['side', 'Missões secundárias']]) {
      const tab = addButton(tabs, label, () => {
        missionTab = id;
        render();
        $('city-content').querySelector('.city-mission-tabs [aria-pressed="true"]')?.focus();
      });
      tab.setAttribute('aria-pressed', String(missionTab === id));
    }
    content.append(tabs);
    if (missionTab === 'main') NB.StoryUI.journal(content, district, selectDestination);
    else renderSideMissions(content, district, save.city.life);
  }

  function renderSideMissions(content, district, life) {
    const locationName = id => districts.find(place => place.id === id).name;
    function entry(title, status) {
      const section = document.createElement('section');
      section.className = 'city-mission-entry';
      addText(section, title, 'city-clue-title');
      addText(section, status);
      content.append(section);
      return section;
    }
    function next(section, { location, contact, task }) {
      addText(section, `Próximo passo · ${locationName(location)} · ${contact}: ${task}`);
      addButton(section, location === district.id ? 'Ver ações deste local' : `Ir para ${locationName(location)}`,
        () => selectDestination(location));
    }
    function reward(section, label) {
      addText(section, `Prêmio recebido · ${label}`, 'city-clue-title');
    }

    for (const [kind, merchant] of Object.entries(NB.CityCommerce.merchants)) {
      if (!life.commerce.seen.includes(kind)) continue;
      const done = life.commerce.discounts.includes(kind);
      const section = entry(merchant.mission, done ? 'Concluída' : 'Em andamento');
      if (done) reward(section, `15 créditos e 10% de desconto com ${merchant.name}.`);
      else next(section, { location: merchant.location, contact: merchant.name, task: 'Vencer a escolta do depósito.' });
    }

    const pact = entry('Acordo das Rotas', life.routePact === 4 ? 'Concluída' : life.routePact ? 'Em andamento' : 'Disponível');
    for (const step of routePactLog.slice(0, life.routePact)) {
      addText(pact, `✓ ${locationName(step.location)} · ${step.contact}`);
    }
    if (life.routePact >= 3) reward(pact, pactReward);
    if (life.routePact === 4) reward(pact, `${maskReward} Estado: ${life.routeMask ? 'ativo' : 'desativado'}.`);
    else next(pact, routePactLog[life.routePact]);

    const shortcut = life.favors.includes('hillPath');
    const aline = entry('Atalho da Aline', shortcut ? 'Concluída · Garagem da Íris · Aline'
      : life.vehicles.includes('bike') ? 'Disponível' : 'Requer bicicleta');
    if (shortcut) reward(aline, 'Viagens de bicicleta entre Oficinas e Morro gastam menos tempo e energia.');
    else next(aline, { location: 'garage', contact: 'Aline',
      task: life.vehicles.includes('bike') ? 'Conversar sobre o atalho e vencer o duelo.' : 'Comprar a bicicleta para liberar a conversa.' });

    const unlockedFerry = life.favors.includes('pumpRelay');
    const pump = entry('Travessia da Ressaca', unlockedFerry ? 'Concluída · Casa de Bombas · Maíra' : 'Disponível');
    if (unlockedFerry) reward(pump, '16 créditos e acesso à balsa do Canal ao Cais.');
    else next(pump, { location: 'pump', contact: 'Maíra', task: 'Ajudar a religar a bomba.' });

    const delivery = entry('Correio Expresso', life.activeDelivery ? 'Entrega em andamento' : 'Trabalho recorrente');
    if (life.lastDelivery) reward(delivery, `${life.lastDelivery.credits} créditos na última entrega · ${locationName(life.lastDelivery.targetId)}.`);
    if (life.activeDelivery) next(delivery, { location: life.activeDelivery.targetId, contact: 'Destinatário', task: 'Entregar o pacote.' });
    else next(delivery, { location: 'kira', contact: 'Despacho', task: 'Aceitar uma entrega na Estação ou em outra central.' });
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
      if (NB.Story.get().chapter < chapter || save.city.life.commerce.lost === id) continue;
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
      addText(details, [card.kind === 'unit' ? 'Unidade' : 'Exploit', NB.Cards.rarityLabel(card.rarity)].filter(Boolean).join(' · '));
      if (owned) {
        addText(details, card.kind === 'unit'
          ? `${card.atk} ATK · ${card.def} DEF · +${card.ramGain} RAM · ${NB.Cards.affinityLabel(NB.Save.getAffinity(id))}`
          : `${card.cost} RAM`);
      }
      row.append(details);
      addButton(row, owned ? 'Adquirida' : `Comprar · ${price}`, () => {
        if (save.city.credits < price || save.unlockedCards.includes(id)) return;
        save.city.credits -= price;
        NB.Save.unlockCard(id);
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
    const units = save.unlockedCards.map(id => NB.Cards.CARD_DB[id]).filter(card => card?.kind === 'unit');
    const slots = document.createElement('div');
    slots.className = 'workshop-slots';
    const input = addButton(slots, '', () => togglePicker(picker.hidden), !units.length);
    const arrow = document.createElement('span');
    arrow.className = 'workshop-arrow';
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    slots.append(arrow);
    const output = addButton(slots, '', () => togglePreview(preview.hidden), true);
    input.setAttribute('aria-controls', 'workshop-picker');
    output.setAttribute('aria-controls', 'workshop-preview');

    const picker = document.createElement('div');
    picker.id = 'workshop-picker';
    picker.className = 'workshop-grid';
    for (const card of units) {
      const tile = addButton(picker, card.name, () => {
        selected = card;
        togglePicker(false);
        updateOptions();
        affinities.focus();
      });
      tile.dataset.cardId = card.id;
      const art = document.createElement('span');
      art.className = 'workshop-art';
      art.append(NB.Sprites.createArtMarkup(card.id, card.img, ''));
      tile.prepend(art);
    }

    const editor = document.createElement('div');
    editor.className = 'workshop-editor';
    const affinities = document.createElement('select');
    affinities.setAttribute('aria-label', 'Nova afinidade');
    affinities.addEventListener('change', () => {
      updateResult();
      togglePreview(false);
    });
    const preview = document.createElement('div');
    preview.id = 'workshop-preview';
    preview.className = 'workshop-preview';
    preview.tabIndex = -1;
    editor.append(affinities, preview);
    workshop.append(slots, picker, editor);
    const confirm = addButton(workshop, 'Confirmar modificação', () => {
      if (!selected || !affinities.value || !NB.Save.recalibrate(selected.id, selectedType())) return;
      announce(`${selected.name} agora usa afinidade ${NB.Cards.affinityLabel(NB.Save.getAffinity(selected.id))}. Disponível em Meu Deck.`);
      $('city-credits').textContent = `${save.city.credits} créditos`;
      updateOptions();
      input.focus();
    }, true, 'city-primary');
    content.append(workshop);

    let selected = null;
    drawSlot(input, 'Entrada', 'Escolher carta', null, 'Escolher carta da coleção');
    drawSlot(output, 'Saída', 'Prévia da modificação', null, 'Ver carta modificada');
    togglePicker(false);
    togglePreview(false);
    editor.hidden = true;
    if (!units.length) addText(workshop, 'Nenhuma unidade disponível para modificar.');

    function drawSlot(button, title, label, card, accessibleName) {
      button.classList.add('workshop-slot');
      button.setAttribute('aria-label', accessibleName);
      button.replaceChildren();
      const heading = document.createElement('span');
      heading.className = 'workshop-slot-label';
      heading.textContent = title;
      button.append(heading);
      const art = document.createElement('span');
      art.className = 'workshop-art';
      if (card) art.append(NB.Sprites.createArtMarkup(card.id, card.img, ''));
      else art.textContent = button === input ? '+' : '◇';
      button.append(art);
      const caption = document.createElement('span');
      caption.className = 'workshop-slot-caption';
      caption.textContent = label;
      button.append(caption);
    }

    function togglePicker(open) {
      picker.hidden = !open;
      input.setAttribute('aria-expanded', String(open));
      if (open) {
        togglePreview(false);
        picker.querySelector('button')?.focus();
      }
    }

    function togglePreview(open) {
      if (open) togglePicker(false);
      preview.hidden = !open;
      output.setAttribute('aria-expanded', String(open));
      if (open) preview.focus();
    }

    function selectedType() {
      return affinities.value === 'neutral' ? null : affinities.value;
    }

    function updateOptions() {
      const current = NB.Save.getAffinity(selected.id);
      const original = selected.affinity || null;
      editor.hidden = false;
      drawSlot(input, 'Entrada', `${selected.name} · Afinidade atual · ${NB.Cards.affinityLabel(current)}`, selected, 'Escolher carta da coleção');
      affinities.replaceChildren(new Option('Escolha a afinidade', '', true, true));
      affinities.options[0].disabled = true;
      for (const type of [null, ...Object.keys(NB.Cards.AFFINITIES)]) {
        if (type === current || (type === null && original !== null)) continue;
        affinities.add(new Option(NB.Cards.affinityLabel(type) + (type === original ? ' · restaurar grátis' : ''), type || 'neutral'));
      }
      updateResult();
      togglePreview(false);
    }

    function updateResult() {
      const proposed = Boolean(affinities.value);
      const type = selectedType();
      const restoring = type === (selected.affinity || null);
      output.disabled = !proposed;
      confirm.disabled = !proposed || (!restoring && save.city.credits < NB.Save.recalibrationPrice);
      confirm.textContent = !proposed ? 'Confirmar modificação' :
        restoring ? 'Restaurar afinidade · grátis' : `Recalibrar · ${NB.Save.recalibrationPrice} créditos`;
      drawSlot(output, 'Saída', proposed ? `${selected.name} · ${NB.Cards.affinityLabel(type)}` : 'Prévia da modificação',
        proposed ? selected : null, 'Ver carta modificada');
      preview.replaceChildren();
      if (!proposed) return;

      const current = NB.Save.getAffinity(selected.id);
      const advantage = id => NB.Cards.AFFINITIES[NB.Cards.AFFINITIES[id]?.beats]?.name;
      const gains = type ? `Agora ela dará +1 de dano contra ${advantage(type)} nos choques.` : 'Neutra, ela deixa de explorar vantagens de afinidade.';
      const tradeoff = current ? ` Ela abre mão do bônus contra ${advantage(current)}.` : '';
      const synergy = type ? ' Para ganhar o bônus de Overclock contra um bloqueador, junte com outra afinidade.' : ' Com afinidade neutra, ela não ativa o bônus de dupla no Overclock.';
      addText(preview, `${selected.atk} ATK · ${selected.def} DEF · +${selected.ramGain} RAM`, 'city-clue-title');
      addText(preview, selected.desc);
      addText(preview, `Lume — ${gains}${tradeoff}${synergy} O ATK e a DEF de base ficam iguais.`);
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
    renderCardWager(content);
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

  function renderCommerce(content, district) {
    const save = NB.Save.get();
    const commerce = NB.CityCommerce;
    if (['kira', 'terminal'].includes(district)) {
      const ticket = commerce.activePass();
      const { price, trips } = commerce.pass;
      addButton(content, ticket ? `Passe ativo · ${ticket.trips} viagens` : `Comprar passe de ônibus · ${price} créditos`, () => {
        if (commerce.buyPass()) refreshStory('Passe válido por 48 horas ou seis viagens. Cada embarque custa 1 crédito.');
      }, Boolean(ticket) || save.city.credits < price);
      addText(content, `Passe · até ${trips} embarques em 48 horas por 1 crédito cada.`);
    }
    const offer = commerce.offer();
    if (offer) {
      const section = document.createElement('section');
      section.className = 'city-story-section';
      addText(section, commerce.merchants[offer.kind].name, 'city-clue-title');
      if (save.city.life.commerce.discounts.includes(offer.kind)) addText(section, 'Desconto de confiança · 10%.');
      for (const id of offer.stock) {
        const item = offer.kind === 'cards' ? NB.Cards.CARD_DB[id] :
          id === 'navigator' ? commerce.navigator : NB.CityLife.cyberdecks[id];
        const amount = commerce.price(offer.kind, id);
        const details = id === 'navigator' ? ' · reduz abordagens de ônibus e bicicleta' :
          offer.kind === 'gear' ? ` · +${item.ram} RAM inicial${id === 'tram' ? ' · primeiro Overclock custa 1 RAM a menos' : ''}` :
            item.rarity === 'rare' ? ' · rara' : '';
        addButton(section, `Comprar ${item.name}${details} · ${amount} créditos`, () => {
          if (commerce.buyOffer(id)) refreshStory(`${item.name} adquirido.`);
        }, save.city.credits < amount);
      }
      if (!offer.stock.length) addText(section, 'Estoque esgotado.');
      addButton(section, 'Dispensar oferta', () => {
        save.city.life.commerce.offer = null;
        NB.Save.save();
        refreshStory('O vendedor seguiu viagem.');
      });
      content.prepend(section);
    }
    for (const [kind, contact] of Object.entries(commerce.merchants)) {
      if (!commerce.missionAvailable(kind)) continue;
      addText(content, `${contact.name} pediu ajuda para recuperar sua mercadoria. Vença a escolta para receber 15 créditos e desconto. Derrota ou abandono custa até 3 créditos.`, 'city-notice');
      addButton(content, contact.mission + ' · duelar', () => {
        if (!commerce.missionAvailable(kind)) return;
        NB.Input.startMatch({ mode: 'arena', boss: {
          ...wagerBoss, ...NB.CityLife.travelDeck(kind === 'cards' ? 1 : 2),
          hp: kind === 'cards' ? 15 : 17, name: 'Escolta do depósito',
          fullTitle: 'Escolta do depósito // Contrabando', commerceMission: kind
        } });
      });
    }
  }

  function renderCardWager(content) {
    const terms = NB.CityCommerce.wager();
    const lost = NB.Save.get().city.life.commerce.lost;
    if (lost) addText(content, `Risco está com ${NB.Cards.CARD_DB[lost].name}.`);
    if (!terms) return;
    const row = document.createElement('section');
    row.className = 'city-story-section';
    const prize = NB.Cards.CARD_DB[terms.prize].name;
    addText(row, `Aposta de Risco · prêmio: ${prize}`, 'city-clue-title');
    const start = stake => {
      if (!NB.CityCommerce.beginWager(stake)) return;
      NB.Input.startMatch({ mode: 'arena', boss: { ...wagerBoss, cardWager: true } });
    };
    if (terms.fee) {
      addButton(row, `Disputar recuperação · ${terms.fee} créditos`, () => start(null), NB.Save.get().city.credits < terms.fee);
    } else {
      addText(row, 'Na derrota ou abandono, você perde acesso às duas cópias dessa carta. Há uma aposta por dia.');
      for (const id of terms.stakes) {
        const name = NB.Cards.CARD_DB[id].name;
        addButton(row, `Apostar ${name}`, () => {
          row.replaceChildren();
          addText(row, `Colocar ${name} em jogo contra ${prize}?`);
          addButton(row, 'Confirmar aposta em carta', () => start(id));
          addButton(row, 'Cancelar aposta', () => refreshStory(''));
        });
      }
    }
    content.append(row);
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
          ...NB.CityLife.travelDeck(NB.Story.get().chapter, encounter.period === 'night'),
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
      const missionAction = content.querySelector('.city-story-section button');
      missionAction?.focus();
    });
    content.append(offer);
  }

  function finishArena(state, winner) {
    const save = NB.Save.get();
    if (state.boss.cardWager || state.boss.commerceMission) {
      const won = winner === 'player';
      state.payout = state.boss.commerceMission && won ? 15 : 0;
      state.commerceResult = state.boss.cardWager ? NB.CityCommerce.finishWager(won) :
        NB.CityCommerce.finishMission(state.boss.commerceMission, won);
      return;
    }
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
      if (duel.card && NB.Save.unlockCard(duel.card)) state.residentReward = duel.card;
    }
    if (winner === 'player' && duel?.expansionCard && NB.Save.unlockCard(duel.expansionCard)) {
      state.expansionReward = duel.expansionCard;
    }
    save.city.credits += payout;
    NB.Save.save();
  }

  function scrollCityTop() {
    document.querySelector('.city-scroll').scrollTop = 0;
  }

  function showView(next) {
    view = next;
    destination = null;
    cancelJob();
    announce('');
    render();
    scrollCityTop();
  }

  function cancelTravel() {
    const pin = $('city-map').querySelector(`[data-district="${destination}"]`);
    showView(travelOrigin);
    if (['map', 'atlas'].includes(view)) {
      (pin?.hidden ? $('city-current-location') : pin)?.focus({ preventScroll: true });
    }
  }

  function resetView() {
    showView('district');
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
    else $('city-map-tab').focus({ preventScroll: true });
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
      render();
    });
    $('city-map-tab').addEventListener('click', () => showView('map'));
    $('city-current-location').addEventListener('click', () => selectDestination(districtAtPosition().id));
    $('city-journal').addEventListener('click', toggleJournal);
    for (const [id, target] of [['city-bag', 'bag'], ['city-atlas', 'atlas'], ['city-story', 'story']]) {
      $(id).addEventListener('click', () => {
        showView(view === target ? 'district' : target);
      });
    }
  }

  function toggleJournal() {
    const district = districtAtPosition();
    const next = view === 'journal' ? 'district' : 'journal';
    NB.Audio.setScene(next === 'journal' ? 'city' : district.music || district.id);
    showView(next);
  }

  function handleBack() {
    if (NB.CityLife.requiredTravelChallenge()) return false;
    if (view === 'travel') {
      cancelTravel();
      return true;
    }
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
    if (view === 'shop-workshop') {
      const expanded = $('city-content').querySelector('.workshop-slot[aria-expanded="true"]');
      if (expanded) {
        expanded.click();
        expanded.focus();
        return true;
      }
    }
    if (view.startsWith('shop-') && characterUpgrades.includes(view.slice(5))) {
      openShop('upgrades');
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
