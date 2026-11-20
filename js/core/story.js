(function (NB) {
  'use strict';

  const { chapters, scenes } = NB.StoryData;
  const sceneById = Object.fromEntries(scenes.map(scene => [scene.id, scene]));
  const duels = {
    kira: { chapter: 1, deal: 'kiraDeal', route: 'delivery', label: 'Seguir a cadeia de Beto e Leila' },
    cipher: { chapter: 3, deal: 'cipherDeal', route: 'supervised', label: 'Pedir a extração isolada a Raquel' },
    vex: { chapter: 4, deal: 'vexDeal', route: 'witness', label: 'Preparar a entrega com Cris e Bia' },
    archon: { chapter: 5, deal: 'archonDeal' }
  };

  function normalize(raw, prologueSeen = false) {
    const flags = [...new Set((Array.isArray(raw?.flags) ? raw.flags : []).filter(id => scenes.some(scene => scene.grants === id)))];
    if ((flags.includes('vexAlt') || Number.isInteger(raw?.read?.vexAlt)) && !flags.includes('vexStub')) flags.push('vexStub');
    if (flags.includes('archonDeal') && !flags.includes('archonReady')) flags.push('archonReady');
    const read = Object.fromEntries(Object.entries(raw?.read || {}).filter(([id, cursor]) =>
      Object.hasOwn(sceneById, id) && Number.isInteger(cursor) && cursor >= 0 && cursor < sceneById[id].lines.length + (id === 'epilogue' ? 2 : 0)));
    const choices = Object.fromEntries(Object.entries(raw?.choices || {}).filter(([id, value]) =>
      Object.hasOwn(sceneById, id) && sceneById[id].choices?.some(choice => choice.id === value)));
    const evidence = [...new Set((Array.isArray(raw?.evidence) ? raw.evidence : []).filter(id =>
      Object.hasOwn(sceneById, id) && sceneById[id].evidence && flags.includes(sceneById[id].grants)))];
    const chapter = Number.isInteger(raw?.chapter) ? Math.min(chapters.length - 1, Math.max(0, raw.chapter)) : 0;
    return { started: raw?.started === true || prologueSeen, chapter, flags, choices, read, evidence };
  }

  const get = () => NB.Save.get().story;
  const active = () => get().started;
  const won = id => NB.Save.isNodeDefeated(id);
  const has = id => get().flags.includes(id);
  const choice = id => get().choices[id];

  function start() {
    if (!active()) {
      get().started = true;
      NB.Save.save();
    }
  }

  const conditions = {
    maraWindow: () => {
      const hour = Math.floor(NB.Save.get().city.life.minute % 1440 / 60);
      return hour >= 6 && hour < 19;
    },
    kiraDelivery: () => choice('kiraDeal') === duels.kira.route && !won('kira'),
    kiraResolution: () => won('kira'),
    cipherAlternative: () => choice('cipherDeal') === duels.cipher.route && !won('cipher'),
    cipherResolution: () => won('cipher'),
    vexAlternative: () => choice('vexDeal') === duels.vex.route && !won('vex'),
    vexResolution: () => won('vex'),
    archonWon: () => won('archon')
  };

  function available(scene) {
    return Boolean(active() && scene && scene.chapter === get().chapter &&
      !has(scene.grants) && scene.requires.every(has) &&
      (!scene.when || conditions[scene.when]()));
  }

  function getScenes(location) {
    return scenes.filter(scene => (!location || scene.location === location) && available(scene));
  }

  function getLines(scene) {
    if (scene.id !== 'epilogue') return scene.lines;
    const ending = sceneById.ending.choices.find(option => option.id === choice('ending'));
    return [
      scene.lines[0],
      ending?.reaction || 'O destino das cópias está registrado no diário.',
      choice('tellingNair') === 'tell'
        ? 'Dona Nair abre a página em que Kairo explicou a assinatura e põe o protocolo novo ao lado.'
        : 'Kairo volta ao espaço em branco no caderno de Dona Nair e termina a explicação que tinha prometido.',
      ...scene.lines.slice(1)
    ];
  }

  function finish(id, selected) {
    const scene = sceneById[id];
    if (!available(scene) || (scene.choices && !scene.choices.some(option => option.id === selected))) return false;
    const story = get();
    if ((story.read[id] ?? 0) !== getLines(scene).length - 1) return false;
    if (scene.choices) story.choices[id] = selected;
    story.flags.push(scene.grants);
    if (scene.evidence) story.evidence.push(id);
    if (scene.reward) NB.Save.applyInvestigationReward(scene.reward);
    if (scene.next) story.chapter++;
    if (scene.minutes) NB.CityLife.advance(scene.minutes, 4);
    else NB.Save.save();
    return true;
  }

  function remember(id, cursor) {
    if (!available(sceneById[id])) return;
    get().read[id] = cursor;
    NB.Save.save();
  }

  function matchAccess(id) {
    const gate = duels[id];
    if (!gate || !active()) return null;
    return has(gate.deal) ? null : 'A investigação ainda não chegou a este duelo. Veja o próximo passo no diário.';
  }

  function pendingDuel(location) {
    return Object.entries(duels).find(([id, gate]) => (!location || id === location) &&
      active() && gate.chapter === get().chapter && has(gate.deal) && !won(id) && (!gate.route || choice(gate.deal) !== gate.route));
  }

  function alternate(id) {
    const gate = duels[id];
    if (!gate?.route || pendingDuel(id)?.[0] !== id) return;
    get().choices[gate.deal] = gate.route;
    NB.Save.save();
  }

  function aftermath(location) {
    const ending = choice('ending');
    if (!ending) return '';
    if (location === 'square') {
      if (ending === 'publish') return 'A primeira edição da Isa circula na praça. As provas estão disponíveis com os dados pessoais protegidos.';
      if (ending === 'council') return 'Isa fixou no balcão a data em que o conselho deve responder pela guarda dos documentos.';
      return 'Isa reúne as solicitações pendentes para publicar uma edição sobre os endereços que continuam fora do relatório.';
    }
    if (location === 'clinic') return ending === 'settle'
      ? 'Ada confere a bateria reserva. Os endereços sem regularização continuam dependendo dela.'
      : 'A linha da Clínica está funcionando durante a transição. Ada entrega aos vizinhos a próxima escala de atendimento.';
    if (location === 'relay') return ending === 'publish'
      ? 'Nina procura voluntários para manter o canal após a publicação.'
      : 'Nina guarda uma cópia para o próximo plantão e mantém livre o canal de emergência.';
    return '';
  }

  NB.Story = { normalize, get, start, active, matchAccess, pendingDuel, alternate, getScenes, available, finish,
    remember, getLines, aftermath, archonWarning: () => active() && get().chapter === 5 && has('protocol') && !won('archon') ? NB.StoryData.archonWarning : '', has, choice, sceneById, chapters };
})(window.NB = window.NB || {});
