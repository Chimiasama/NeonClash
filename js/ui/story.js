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

  function image(frame, source) {
    const art = document.createElement('img');
    art.alt = '';
    art.decoding = 'async';
    art.draggable = false;
    if (frame) art.addEventListener('load', () => { frame.dataset.galleryArt = source; });
    art.src = source;
    return art;
  }

  function portrait(meta) {
    const person = NB.StoryData.comicPortraits[meta.speaker];
    if (!person) return null;
    const figure = document.createElement('figure');
    figure.className = 'comic-speaker';
    figure.dataset.expression = meta.expression || 'default';
    const alternate = person.variants?.[meta.expression];
    if (alternate || person.art) {
      const art = image(null, alternate || person.art);
      if (alternate && person.art) art.addEventListener('error', () => { art.src = person.art; }, { once: true });
      figure.append(art);
    } else {
      text(figure, person.name.split(' ').map(part => part[0]).join('').slice(0, 2), 'span');
    }
    text(figure, person.name, 'figcaption');
    return figure;
  }

  function interaction(panel, stage, meta, complete) {
    const control = document.createElement('div');
    control.className = 'comic-interaction';
    control.dataset.interaction = meta.type;
    if (meta.pos) control.dataset.pos = meta.pos;
    if (meta.type === 'tune') {
      const label = text(control, meta.label, 'label');
      const tuning = document.createElement('input');
      tuning.type = 'range';
      tuning.min = 0;
      tuning.max = 100;
      tuning.value = 30;
      label.append(tuning);
      text(control, `Faixa do sinal · ${meta.target - 3}–${meta.target + 3}`);
      const frequency = text(control, 'Frequência · 30', 'output');
      tuning.addEventListener('input', () => {
        frequency.textContent = `Frequência · ${tuning.value}`;
        if (Math.abs(Number(tuning.value) - meta.target) <= 3) complete();
      });
      panel.append(control);
      return;
    }

    button(control, meta.label, complete);
    if (meta.type === 'wipe' && stage) {
      let start;
      stage.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        event.preventDefault();
        start = { x: event.clientX, y: event.clientY };
        stage.setPointerCapture(event.pointerId);
      });
      stage.addEventListener('pointermove', event => {
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 24) {
          start = null;
          complete();
        }
      });
      const stop = () => { start = null; };
      stage.addEventListener('pointerup', stop);
      stage.addEventListener('pointercancel', stop);
      control.classList.add('comic-wipe');
      text(control, 'Deslize sobre o quadro ou toque para limpar.');
    }
    (stage || panel).append(control);
  }

  function createPanel(frame, index) {
    const panel = document.createElement('article');
    panel.className = 'comic-panel';
    panel.dataset.beat = index;
    panel.dataset.mood = frame.mood || 'neutral';
    panel.dataset.camera = frame.camera || 'wide';
    panel.dataset.focus = frame.focus || 'center';
    panel.dataset.speaker = frame.speaker || '';
    panel.dataset.bubble = frame.bubbleType || 'narration';
    if (panel.dataset.bubble === 'narration' && !frame.title && frame.line.length < 165) panel.dataset.captionStart = '';
    let stage;
    if (frame.art) {
      stage = document.createElement('div');
      stage.className = 'comic-art';
      const art = image(stage, frame.art);
      art.dataset.comicRole = 'art';
      stage.append(art);
      panel.append(stage);
    }
    if (frame.sfxVisual) {
      const effect = text(stage || panel, frame.sfxVisual.text, 'span');
      effect.className = `comic-sfx comic-sfx--${frame.sfxVisual.style}`;
      effect.dataset.pos = frame.sfxVisual.pos;
      effect.setAttribute('aria-hidden', 'true');
    }
    const caption = document.createElement('div');
    caption.className = 'comic-caption';
    const actor = portrait(frame);
    if (actor) caption.append(actor);
    const bubble = document.createElement('div');
    bubble.className = `comic-bubble comic-bubble--${frame.bubbleType || 'narration'}`;
    if (frame.title) text(bubble, frame.title, 'h3').dataset.comicRole = 'title';
    text(bubble, frame.line).dataset.comicRole = 'line';
    caption.append(bubble);
    panel.append(caption);
    return [panel, stage];
  }

  function comic(strip, frames, cursor, options) {
    const moved = strip.dataset.cursor !== String(cursor);
    strip.dataset.cursor = cursor;
    strip.dataset.mood = frames[cursor].mood || 'neutral';
    for (const panel of Array.from(strip.children)) {
      if (+panel.dataset.beat > cursor) panel.remove();
      else {
        panel.classList.add('comic-panel--past');
        panel.classList.remove('comic-panel--active');
        panel.querySelectorAll('[data-comic-role]').forEach(node => node.removeAttribute('id'));
        if (+panel.dataset.beat !== cursor) panel.querySelector('.comic-interaction')?.remove();
      }
    }
    for (let index = 0; index <= cursor; index++) {
      if (strip.children[index]) continue;
      const [panel, stage] = createPanel(frames[index], index);
      if (index < cursor) panel.classList.add('comic-panel--past');
      else if (options.locked) {
        panel.classList.add('comic-panel--locked');
        interaction(panel, stage, frames[index].interact, () => {
          if (!panel.classList.contains('comic-panel--locked')) return;
          panel.classList.remove('comic-panel--locked');
          panel.querySelector('.comic-interaction')?.remove();
          NB.Audio.playComicCue(frames[index].sfxVisual?.sound || 'beep');
          panel.dataset.interactedAt = performance.now();
          options.unlock();
        });
      }
      strip.append(panel);
    }
    const active = strip.children[cursor];
    if (!options.locked) {
      active.classList.remove('comic-panel--locked');
      active.querySelector('.comic-interaction')?.remove();
    }
    active.classList.remove('comic-panel--past');
    active.classList.add('comic-panel--active');
    active.querySelectorAll('[data-comic-role]').forEach(node => {
      const id = options.ids[node.dataset.comicRole];
      if (id) node.id = id;
    });
    if (moved) {
      if (!options.locked && frames[cursor].sfxVisual) NB.Audio.playComicCue(frames[cursor].sfxVisual.sound);
      requestAnimationFrame(() => {
        if (!active.isConnected) return;
        const top = active.offsetTop - Math.max(0, (strip.clientHeight - active.offsetHeight) / 2);
        strip.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches || cursor === 0 ? 'auto' : 'smooth' });
      });
    }
  }

  function resetComic(strip) {
    strip.replaceChildren();
    delete strip.dataset.cursor;
    strip.scrollTop = 0;
  }

  function readingLocked() {
    const { scene, cursor, replay, visited } = reading;
    return Boolean(!replay && scene.beats?.[cursor]?.interact &&
      cursor >= visited && !NB.Story.get().comicDone[scene.id]?.includes(cursor));
  }

  function open(id, replay = false) {
    const scene = NB.Story.sceneById[id];
    if (!scene || (replay ? !NB.Story.has(scene.grants) : !NB.Story.available(scene))) return;
    if (!replay && scene.location !== NB.Save.get().city.district) return;
    const lines = NB.Story.getLines(scene);
    const cursor = replay ? 0 : Math.min(NB.Story.get().read[id] ?? 0, lines.length - 1);
    const location = NB.CityData.districts.find(item => item.id === scene.location);
    const art = location.scene || location.portrait;
    const frames = lines.map((line, index) => {
      const baseline = { line, art: index === 0 ? art : null };
      const beat = scene.beats?.[index];
      if (scene.chapter >= 2) return { ...baseline, ...(beat ? { art, ...beat } : {}) };
      const speaker = Object.keys(NB.StoryData.comicPortraits).find(key => line.startsWith(NB.StoryData.comicPortraits[key].name + ' —'));
      const camera = ['wide', 'zoom-in', 'pan-left', 'focus-detail'][index % 4];
      return { ...baseline, art, camera, speaker, bubbleType: speaker ? 'speech' : 'narration', ...beat };
    });
    reading = { scene, replay, lines, frames, cursor, visited: cursor, origin: document.activeElement };
    resetComic($('story-comic'));
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
    if (readingLocked()) return;
    const { scene } = reading;
    const energyBefore = NB.Save.get().city.life.energy;
    if (!NB.Story.finish(scene.id, selected)) return;
    const reaction = scene.choices?.find(option => option.id === selected)?.reaction;
    const reward = scene.reward && `+ ${scene.reward.credits} créditos e ${NB.Cards.CARD_DB[scene.reward.card].name}.`;
    const recovered = scene.id === 'archonPrep' ? NB.Save.get().city.life.energy - energyBefore : 0;
    close();
    NB.City.refreshStory([reaction || (scene.evidence ? 'Prova registrada no diário.' : 'Investigação atualizada.'), reward,
      recovered ? `Kira abriu o caminho. +${recovered} de energia.` : ''].filter(Boolean).join(' '));
    if (scene.followup) open(scene.followup);
  }

  function renderPage() {
    const { scene, lines, cursor } = reading;
    $('story-chapter').textContent = NB.Story.chapters[scene.chapter];
    $('story-title').textContent = scene.title;
    $('story-page').textContent = `${cursor + 1} / ${lines.length}`;
    const locked = readingLocked();
    comic($('story-comic'), reading.frames, cursor, {
      ids: { line: 'story-line', art: 'story-art' }, locked,
      unlock: () => {
        const done = NB.Story.get().comicDone;
        (done[scene.id] ||= []).push(cursor);
        NB.Save.save();
        renderPage();
        $('story-options').lastElementChild?.focus({ preventScroll: true });
      }
    });
    const options = $('story-options');
    options.replaceChildren();
    if (!reading.replay && cursor === lines.length - 1 && scene.aside && NB.Story.get().nairTruthEarly === false) {
      if (reading.heardAside) text(options, scene.aside.reply);
      else button(options, scene.aside.label, () => {
        reading.heardAside = true;
        renderPage();
        options.lastElementChild?.focus();
      });
    }
    if (cursor > 0) button(options, 'Anterior', () => step(-1)).className = 'story-prev';
    if (cursor < lines.length - 1) {
      button(options, 'Continuar', () => step(1)).classList.add('story-primary');
    } else if (scene.choices && !reading.replay) {
      for (const option of scene.choices) {
        const reward = NB.Story.sceneById[option.finale]?.reward;
        if (reward) text(options, `Rota pacifista · 3 etapas · ${reward.credits} créditos + ${NB.Cards.CARD_DB[reward.card].name}`).className = 'city-notice';
        button(options, option.label, () => finish(option.id));
      }
    } else {
      button(options, reading.replay ? 'Concluir leitura' : 'Registrar e sair', () => finish()).classList.add('story-primary');
    }
    if (locked) options.querySelectorAll('button:not(.story-prev)').forEach(control => { control.disabled = true; });
  }

  function step(delta) {
    if (!reading || (delta > 0 && readingLocked())) return;
    const next = reading.cursor + delta;
    if (next < 0 || next >= reading.lines.length) return;
    reading.cursor = next;
    reading.visited = Math.max(reading.visited, next);
    if (!reading.replay) NB.Story.remember(reading.scene.id, reading.cursor);
    renderPage();
    $('story-options').lastElementChild?.focus({ preventScroll: true });
  }

  function local(content, place) {
    if (!NB.Story.active()) return;
    const scenes = NB.Story.getScenes(place.id);
    const duel = NB.Story.pendingDuel(place.id);
    const aftermath = NB.Story.aftermath(place.id);
    const warning = place.id === 'archon' && NB.Story.archonWarning();
    if (!scenes.length && !duel && !aftermath && !warning) return;
    const section = document.createElement('section');
    section.className = 'city-story-section';
    text(section, NB.Story.chapters[NB.Story.get().chapter], 'h4');
    if (warning) text(section, warning).className = 'city-notice';
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
    const warning = NB.Story.archonWarning();
    if (warning) text(content, warning).className = 'city-notice';
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

  const { prologue } = NB.StoryData;
  let prologuePage = 0;

  function renderPrologue() {
    const frames = prologue.map(([art, title, line], index) => ({
      art: `./src/assets/${art}.webp`, title, line, ...NB.StoryData.prologueBeats[index]
    }));
    comic($('prologue-comic'), frames, prologuePage, {
      ids: { art: 'prologue-art', title: 'prologue-title', line: 'prologue-text' }
    });
    $('prologue-page').textContent = `${prologuePage + 1} / ${prologue.length}`;
    $('prologue-prev').disabled = prologuePage === 0;
    const last = prologuePage === prologue.length - 1;
    $('prologue-next').disabled = last;
    $('prologue-enter').hidden = !last;
    $('prologue-skip').hidden = last;
  }

  function openPrologue() {
    prologuePage = NB.Story.get().prologueFrame;
    resetComic($('prologue-comic'));
    $('title-modal').inert = true;
    $('prologue-modal').classList.add('open');
    renderPrologue();
    $('prologue-modal').querySelector('.prologue-panel').scrollTop = 0;
    $('prologue-close').focus();
  }

  function closePrologue() {
    $('prologue-modal').classList.remove('open');
    $('title-modal').inert = false;
    $('btn-start-campaign').focus();
  }

  function finishPrologue() {
    NB.Save.get().prologueSeen = true;
    if (NB.Story.active()) NB.Save.save();
    else NB.Story.start();
    closePrologue();
    NB.Input.openNetMap();
  }

  function bindEvents() {
    const stepPrologue = delta => {
      const next = prologuePage + delta;
      if (next < 0 || next >= prologue.length) return;
      prologuePage = next;
      NB.Story.get().prologueFrame = next;
      NB.Save.save();
      renderPrologue();
      if (!$('prologue-enter').hidden) $('prologue-enter').focus();
    };
    $('prologue-prev').addEventListener('click', () => stepPrologue(-1));
    $('prologue-next').addEventListener('click', () => stepPrologue(1));
    for (const [id, forward] of [['prologue-comic', () => stepPrologue(1)], ['story-comic', () => step(1)]]) {
      $(id).addEventListener('click', event => {
        const active = event.target.closest('.comic-panel--active');
        if (!active || event.target.closest('button,input,label,.comic-interaction') ||
            performance.now() - Number(active.dataset.interactedAt) < 350 || window.getSelection()?.toString()) return;
        forward();
      });
    }
    $('prologue-close').addEventListener('click', closePrologue);
    $('prologue-skip').addEventListener('click', finishPrologue);
    $('prologue-enter').addEventListener('click', finishPrologue);
    $('prologue-modal').addEventListener('keydown', event => {
      if (event.key === 'Escape') closePrologue();
    });
    $('btn-story-close').addEventListener('click', close);
    $('story-modal').addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });
  }

  NB.StoryUI = { local, journal, bindEvents, prologue, openPrologue };
})(window.NB = window.NB || {});
