(function (NB) {
  'use strict';

  const $ = id => document.getElementById(id);
  let reading = null;

  function text(parent, label, tag = 'p') {
    const element = document.createElement(tag);
    element.textContent = label;
    parent.append(element);
    return element;
  }

  function button(parent, label, action) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', action);
    parent.append(element);
    return element;
  }

  function open(id, replay = false) {
    const scene = NB.Story.sceneById[id];
    if (!scene || (replay ? !NB.Story.has(scene.grants) : !NB.Story.available(scene))) return;
    if (!replay && scene.location !== NB.Save.get().city.district) return;
    const lines = NB.Story.getLines(scene);
    reading = { scene, replay, lines, cursor: replay ? 0 : (NB.Story.get().read[id] ?? 0), origin: document.activeElement };
    document.querySelector('.city-panel').inert = true;
    $('story-modal').classList.add('open');
    renderPage();
    $('btn-story-close').focus();
  }

  function close() {
    if (!reading) return;
    const origin = reading.origin;
    reading = null;
    $('story-modal').classList.remove('open');
    document.querySelector('.city-panel').inert = false;
    if (origin?.isConnected) origin.focus();
  }

  function finish(selected) {
    if (reading.replay) {
      close();
      return;
    }
    const { scene } = reading;
    if (!NB.Story.finish(scene.id, selected)) return;
    const reaction = scene.choices?.find(option => option.id === selected)?.reaction;
    close();
    NB.City.refreshStory(reaction || (scene.evidence ? 'Prova registrada no diário.' : 'Investigação atualizada.'));
  }

  function renderPage() {
    const { scene, lines, cursor } = reading;
    $('story-chapter').textContent = NB.Story.chapters[scene.chapter];
    $('story-title').textContent = scene.title;
    $('story-line').textContent = lines[cursor];
    $('story-page').textContent = `${cursor + 1} / ${lines.length}`;
    const art = $('story-art');
    const location = NB.CityData.districts.find(item => item.id === scene.location);
    const source = location.scene || location.portrait;
    art.hidden = !source || cursor !== 0;
    if (!art.hidden && art.getAttribute('src') !== source) art.src = source;
    const options = $('story-options');
    options.replaceChildren();
    if (cursor > 0) button(options, 'Anterior', () => step(-1));
    if (cursor < lines.length - 1) {
      button(options, 'Continuar', () => step(1)).classList.add('story-primary');
    } else if (scene.choices && !reading.replay) {
      scene.choices.forEach(option => button(options, option.label, () => finish(option.id)));
    } else {
      button(options, reading.replay ? 'Concluir leitura' : 'Registrar e sair', () => finish()).classList.add('story-primary');
    }
    $('story-modal').querySelector('.story-reading').scrollTop = 0;
  }

  function step(delta) {
    reading.cursor += delta;
    if (!reading.replay) NB.Story.remember(reading.scene.id, reading.cursor);
    renderPage();
    $('story-options').lastElementChild?.focus();
  }

  function local(content, place) {
    if (!NB.Story.active()) return;
    const scenes = NB.Story.getScenes(place.id);
    const duel = NB.Story.pendingDuel(place.id);
    const aftermath = NB.Story.aftermath(place.id);
    if (!scenes.length && !duel && !aftermath) return;
    const section = document.createElement('section');
    section.className = 'city-story-section';
    text(section, NB.Story.chapters[NB.Story.get().chapter], 'h4');
    if (aftermath) text(section, aftermath);
    scenes.forEach(scene => button(section, scene.title, () => open(scene.id)).classList.add('city-investigate'));
    if (duel?.[1].route && NB.Story.choice(duel[1].deal) !== duel[1].route) {
      button(section, duel[1].label, () => {
        NB.Story.alternate(duel[0]);
        NB.City.refreshStory('Rota alternativa registrada no diário.');
      });
    }
    content.prepend(section);
  }

  function journal(content, district, travel) {
    if (!NB.Story.active()) {
      text(content, 'A cidade que ficou fora do mapa', 'h4');
      text(content, 'Volte à Casa de Kairo. Dona Nair guardou os comprovantes do prédio e espera que você examine o leitor da porta.');
      button(content, 'Começar investigação', () => {
        NB.Story.start();
        NB.City.refreshStory('Primeiro passo · Casa de Kairo.');
      }).classList.add('city-investigate');
      return;
    }

    const story = NB.Story.get();
    text(content, NB.Story.chapters[story.chapter], 'h4');
    const current = NB.Story.getScenes();
    for (const scene of current) {
      const location = NB.CityData.districts.find(place => place.id === scene.location);
      text(content, `${scene.title} · ${location.name}`);
      if (scene.location === district.id) button(content, scene.title, () => open(scene.id));
      else button(content, `Ir para ${location.name}`, () => travel(location.id));
    }
    if (!current.length) {
      const duel = NB.Story.pendingDuel();
      if (duel) {
        const place = NB.CityData.districts.find(item => item.id === duel[0]);
        text(content, `Dispute a prova em ${place.name}.`);
        if (place.id === district.id) button(content, 'Abrir dossiê da investigação', () => NB.UI.openDossier(place.id));
        else button(content, `Ir para ${place.name}`, () => travel(place.id));
      } else if (NB.Story.has('epilogue')) {
        text(content, 'Campanha concluída. Baixa Luz continua aberta para revisitas.');
      }
    }
    if (story.evidence.length) {
      text(content, 'Provas reunidas', 'h4');
      for (const id of story.evidence) {
        const scene = NB.Story.sceneById[id];
        const item = document.createElement('article');
        text(item, scene.title, 'h5');
        text(item, scene.evidence);
        button(item, 'Reler cena', () => open(id, true));
        content.append(item);
      }
    }
  }

  const prologue = [
    ['prologo-oficina', 'As casas que ficaram acesas',
      'Kairo cresceu no Viaduto. Durante as enchentes, ela instalou baterias para manter geladeiras de remédios e rádios ligados. A Vértice contratou sua equipe depois que a água baixou. Com salário e peças novas, dava para atender mais casas.'],
    ['prologo-estacao', 'A noite em que o rádio calou',
      'Meses depois, Kairo descobriu que medidores que ela tinha assinado pararam de pedir manutenção. Ela marcou um encontro na Estação Fantasma para comparar os registros. Homens com lanternas chegaram antes do contato. Nina chamou pelo rádio até Kairo perder o sinal.'],
    ['prologo-casa', 'A chave ainda serve',
      'Dois dias depois, seu cartão já não abre a própria casa. A chave antiga abre. Dona Nair guardou as faturas que a Vértice diz nunca ter emitido. Kairo quer descobrir quem tirou aquelas casas do cadastro e reparar o estrago que sua assinatura ajudou a fazer.']
  ];
  let prologuePage = 0;

  function renderPrologue() {
    const [art, title, line] = prologue[prologuePage];
    $('prologue-art').src = `./src/assets/${art}.webp`;
    $('prologue-title').textContent = title;
    $('prologue-text').textContent = line;
    $('prologue-page').textContent = `${prologuePage + 1} / ${prologue.length}`;
    $('prologue-prev').disabled = prologuePage === 0;
    $('prologue-next').disabled = prologuePage === prologue.length - 1;
  }

  function bindEvents() {
    $('prologue-prev').addEventListener('click', () => { prologuePage--; renderPrologue(); });
    $('prologue-next').addEventListener('click', () => { prologuePage++; renderPrologue(); });
    renderPrologue();
    $('btn-story-close').addEventListener('click', close);
    $('story-modal').addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });
  }

  NB.StoryUI = { local, journal, bindEvents, prologue };
})(window.NB = window.NB || {});
