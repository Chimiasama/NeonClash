(function (NB) {
  'use strict';

  const $ = id => document.getElementById(id);
  const artNodes = 'img[src], [data-gallery-art]';
  const catalog = new Map();
  const scenery = {
    home: 'O quarto de Kairo no Viaduto. A chave antiga ainda abre a porta do prédio.',
    pension: 'A pensão de Cris no Canal do Jatobá. Os quartos servem de descanso para quem está longe de casa.',
    kiosk: 'O balcão de Jota, com café para quem espera o último ônibus ou precisa esticar o turno.',
    garage: 'A bancada de Íris, onde bicicletas, motos e implantes passam pelas mesmas ferramentas.',
    pump: 'A estação que mantém a água do Canal sob controle. Maíra acompanha o nível e cuida das bombas.',
    terminal: 'O ponto de partida das linhas da Estação Velha. Mara anota os desvios da rua num caderno.',
    ringArchive: 'O arquivo de Leila, onde os recibos do Ringue são guardados em ordem de chegada.',
    depots: 'O depósito de Giba reúne máquinas desmontadas, componentes usados e etiquetas de série.',
    archive: 'O corredor reservado à equipe de manutenção da Muralha Setorial.',
    theatre: 'O teatro do Espelho visto de onde trabalham as pessoas que montam o espetáculo.',
    clinic: 'A Clínica do Morro, onde Ada organiza as baterias de reserva por endereço.',
    morroKitchen: 'A cozinha do Morro das Casas, onde Cléo prepara a comida da vizinhança.',
    docks: 'O posto de Renan na Subestação do Cais, com painéis para os pedidos e os registros de operação.',
    ferry: 'A travessia da Ressaca. Sol acompanha o nível da água para decidir quando a balsa pode sair.',
    registry: 'O Balcão Cívico, onde Nalva recebe pedidos de cadastro e entrega números de protocolo.',
    square: 'O ponto de encontro do Centro Cívico. Isa conversa ali com quem acompanha as notícias do bairro.'
  };
  let origin = null;
  let selected = null;
  let observer;

  function setupCatalog() {
    function add(source, title, description, category) {
      if (source) catalog.set(source, { source, title, description, category });
    }
    add('./src/assets/baixa-luz-cover.webp', 'Baixa Luz sob a chuva',
      'Arte de abertura. Os trilhos elevados e as luzes do Viaduto marcam a entrada de Baixa Luz.', 'scenes');
    add('./src/assets/baixa-luz-map.webp', 'Mapa de Baixa Luz',
      'Vista dos bairros que Kairo percorre para encontrar contatos, seguir pistas e disputar duelos.', 'scenes');
    add('./src/assets/kairo-token.webp', 'Kairo no mapa',
      'O retrato que marca a posição de Kairo durante os deslocamentos pela cidade.', 'people');
    for (const [art, title, line] of NB.StoryUI.prologue) {
      add(`./src/assets/${art}.webp`, title, line, 'scenes');
    }
    for (const district of NB.CityData.districts) {
      add(district.scene, district.name, scenery[district.id] || `${district.name}, ponto de encontro com ${district.npc.split(' · ')[0]}.`, 'scenes');
      add(district.portrait, district.npc, `Retrato de personagem em ${district.name}.`, 'people');
    }
    for (const scene of NB.StoryData.scenes) {
      for (const beat of scene.beats || []) {
        if (beat.art && !catalog.has(beat.art)) add(beat.art, beat.artTitle || scene.title, 'Quadro da investigação de Kairo.', 'scenes');
      }
    }
    for (const person of Object.values(NB.StoryData.comicPortraits)) {
      for (const source of Object.values(person.variants || {})) {
        add(source, person.name, 'Retrato usado na webcomic de Baixa Luz.', 'people');
      }
    }
    for (const card of Object.values(NB.Cards.CARD_DB)) {
      add(card.img, card.name, [card.lore, card.desc].filter(Boolean).join(' '), 'cards');
      catalog.get(card.img).card = card;
    }
  }

  function sourceOf(element) {
    if (element.closest('#gallery-modal, .col-card.locked') || element.matches('.comic-art img')) return null;
    return element.dataset.galleryArt || element.getAttribute('src');
  }

  function watch(element) {
    observer.unobserve(element);
    if (catalog.has(sourceOf(element))) observer.observe(element);
  }

  function eachArt(node, callback) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(artNodes)) callback(node);
    node.querySelectorAll(artNodes).forEach(callback);
  }

  function bindDiscovery() {
    const ratio = 0.5;
    observer = new IntersectionObserver(entries => {
      if (document.visibilityState === 'hidden') return;
      const seen = new Set(NB.Save.get().seenArt);
      const initialSize = seen.size;
      for (const entry of entries) {
        const node = entry.target;
        if (!entry.isIntersecting || entry.intersectionRatio < ratio || !node.isConnected ||
            node.closest('[inert]') || node.checkVisibility?.({ visibilityProperty: true }) === false) continue;
        if (node instanceof HTMLImageElement && (!node.naturalWidth || node.currentSrc !== node.src)) continue;
        const source = sourceOf(node);
        if (catalog.has(source)) seen.add(source);
      }
      if (seen.size !== initialSize) {
        NB.Save.get().seenArt = [...seen];
        NB.Save.save();
      }
    }, { threshold: ratio });

    document.querySelectorAll(artNodes).forEach(watch);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') watch(record.target);
        else {
          record.removedNodes.forEach(node => eachArt(node, art => observer.unobserve(art)));
          record.addedNodes.forEach(node => eachArt(node, watch));
        }
      }
    }).observe(document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'data-gallery-art']
    });
    document.addEventListener('load', event => {
      if (event.target instanceof HTMLImageElement) watch(event.target);
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') document.querySelectorAll(artNodes).forEach(watch);
    });
  }

  function image(entry) {
    const art = document.createElement('img');
    art.src = entry.source;
    art.alt = '';
    return art;
  }

  function renderList(focusTarget = $('gallery-filter')) {
    selected = null;
    $('gallery-detail').hidden = true;
    $('gallery-library').hidden = false;
    const filter = $('gallery-filter').value;
    const entries = NB.Save.get().seenArt.map(source => catalog.get(source)).filter(Boolean);
    const items = filter === 'all' ? entries : entries.filter(entry => entry.category === filter);
    const grid = $('gallery-grid');
    grid.replaceChildren();
    $('gallery-empty').hidden = items.length > 0;
    $('gallery-empty').textContent = entries.length ? 'Nenhuma arte vista nesta categoria.' : 'As artes que você vir durante o jogo aparecerão aqui.';
    for (const entry of items) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.dataset.art = entry.source;
      const title = document.createElement('span');
      title.textContent = entry.title;
      const thumb = image(entry);
      thumb.loading = 'lazy';
      tile.append(thumb, title);
      tile.addEventListener('click', () => showArt(entry));
      grid.append(tile);
    }
    if (focusTarget instanceof HTMLElement) focusTarget.focus();
    else [...grid.children].find(tile => tile.dataset.art === focusTarget)?.focus();
  }

  function showArt(entry) {
    selected = entry;
    $('gallery-library').hidden = true;
    $('gallery-detail').hidden = false;
    $('gallery-art-title').textContent = entry.title;
    $('gallery-description').textContent = entry.description;
    const artwork = entry.card
      ? NB.Sprites.createArtMarkup(entry.card.id, entry.source, entry.title)
      : image(entry);
    $('gallery-full-art').replaceChildren(artwork);
    $('gallery-detail').scrollTop = 0;
    $('gallery-back').focus();
  }

  function open(event) {
    origin = event.currentTarget;
    origin.closest('.full-modal').inert = true;
    $('gallery-modal').classList.add('open');
    $('gallery-filter').value = 'all';
    renderList();
  }

  function close() {
    $('gallery-modal').classList.remove('open');
    if (!origin) return;
    origin.closest('.full-modal').inert = false;
    origin.focus();
    selected = null;
    origin = null;
  }

  function handleBack() {
    if (!$('gallery-modal').classList.contains('open')) return false;
    if (selected) renderList(selected.source);
    else close();
    return true;
  }

  function bindEvents() {
    setupCatalog();
    bindDiscovery();
    $('btn-title-gallery').addEventListener('click', open);
    $('gallery-close').addEventListener('click', close);
    $('gallery-back').addEventListener('click', handleBack);
    $('gallery-filter').addEventListener('change', () => renderList());
    $('gallery-modal').addEventListener('keydown', event => {
      if (event.key === 'Escape') handleBack();
    });
  }

  NB.Gallery = { bindEvents, handleBack };
})(window.NB = window.NB || {});
