import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      window.realInitiativeRoll = window.NB.CityLife.rollInitiative;
      window.NB.CityLife.rollInitiative = () => 'player';
    }, { once: true });
  });
});

async function walkTo(page, pin, encounterRoll = 0.99) {
  await pin.click();
  const walking = page.getByRole('button', { name: 'A pé', exact: true });
  if (!await walking.isVisible()) return;
  const originalRandom = await page.evaluateHandle(() => Math.random);
  await page.evaluate(roll => { Math.random = () => roll; }, encounterRoll);
  try {
    await walking.click();
  } finally {
    await page.evaluate(random => { Math.random = random; }, originalRandom);
    await originalRandom.dispose();
  }
}

async function openAdventure(page, starter = 'Equilibrado') {
  await page.locator('#btn-start-campaign').click();
  const resume = page.getByRole('button', { name: 'Continuar do save' });
  if (await resume.isVisible()) await resume.click();
  const select = page.getByRole('dialog', { name: 'Escolha seu deck inicial' });
  if (await select.isVisible()) await select.getByRole('button', { name: `Escolher ${starter}`, exact: true }).click();
}

async function enterCity(page, { legacy = false } = {}) {
  await openAdventure(page);
  const skip = page.getByRole('button', { name: 'Pular prólogo' });
  if (await skip.isVisible()) await skip.click();
  if (legacy) await page.evaluate(() => {
    NB.Save.get().story.started = false;
    NB.City.resetView();
  });
}

test('earns credits, buys a card, and keeps the purchase after reloading', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.clock.install();
  await page.getByRole('button', { name: 'Sinal Criptografado' }).click();

  const symbols = await page.locator('.city-sequence span').allTextContents();
  expect(symbols).toHaveLength(6);
  await expect(page.locator('.city-sequence')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: symbols[0], exact: true })).toBeDisabled();
  await page.clock.fastForward(3500);
  await expect(page.locator('.city-sequence span')).toHaveText(Array(6).fill('·'));
  for (const symbol of symbols) {
    await page.getByRole('button', { name: symbol, exact: true }).click();
  }
  await expect(page.locator('#city-credits')).toHaveText('57 créditos');
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  await page.getByRole('button', { name: 'Ver cartas à venda' }).click();
  await page.getByRole('button', { name: 'Comprar · 45' }).click();
  await expect(page.locator('#city-credits')).toHaveText('12 créditos');

  await page.reload();
  await enterCity(page);
  await expect(page.getByRole('heading', { name: 'Feira do Viaduto' })).toBeVisible();
  await expect(page.locator('#city-credits')).toHaveText('12 créditos');
  await expect(page.getByRole('button', { name: 'Adquirida' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver cartas à venda' }).click();
  await expect(page.getByRole('button', { name: 'Adquirida' })).toBeDisabled();
});

test('penalizes wrong symbols and ends a paid job when time runs out', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.clock.install();
  const start = page.getByRole('button', { name: 'Sinal Criptografado' });
  await start.click();
  const firstSymbol = await page.locator('.city-sequence span').first().textContent();
  await page.clock.fastForward(3600);
  const wrong = ['▲', '●', '◆', '■'].find(symbol => symbol !== firstSymbol);
  await page.getByRole('button', { name: wrong, exact: true }).click();
  await expect(page.locator('#city-feedback')).toContainText('Penalidade de 2 s');
  await expect(page.getByRole('timer')).toHaveText(/Tempo de envio · (9|10) s/);
  await page.clock.fastForward(10000);
  await expect(page.locator('#city-feedback')).toContainText('Tempo esgotado');
  await expect(page.locator('#city-credits')).toHaveText('35 créditos');
  await expect(start).toBeEnabled();
});

test('keeps campaign clues untimed and unlocks the next district', async ({ page }) => {
  await page.goto('/');
  await enterCity(page, { legacy: true });
  await page.evaluate(() => NB.Save.recordBossVictory(NB.Campaign.getNodeById('kira')));
  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.getByRole('button', { name: 'Rastrear pista' }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);

  const symbols = await page.locator('.city-sequence span').allTextContents();
  expect(symbols).toHaveLength(4);
  for (const symbol of symbols) {
    await page.getByRole('button', { name: symbol, exact: true }).click();
  }
  await walkTo(page, page.getByRole('button', { name: 'Muralha Setorial', exact: true }));
  await expect(page.getByRole('button', { name: 'Abrir dossiê' })).toBeEnabled();
});

test('loads a distinct portrait at each city location', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  const expected = {
    market: 'lume.png', relay: 'nina.png', arena: 'risco.webp', kira: 'kira.png',
    cipher: 'cipher.png', vex: 'vex.png', archon: 'archon.png',
  };
  const portrait = page.locator('#city-portrait');
  for (const [district, filename] of Object.entries(expected)) {
    await walkTo(page, page.locator(`[data-district="${district}"]`));
    await expect(portrait).toHaveAttribute('src', `./avatars/${filename}`);
    await expect.poll(() => portrait.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  }
});

test('starts a campaign duel, deploys a unit, and advances the turn', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await enterCity(page, { legacy: true });
  await walkTo(page, page.getByRole('button', { name: 'Muralha Setorial · bloqueado' }));
  await expect(page.getByText('Vença KIRA para abrir este local.')).toBeVisible();
  await walkTo(page, page.getByRole('button', { name: 'Estação Fantasma' }));
  await page.getByRole('button', { name: 'Abrir dossiê' }).click();

  // Seed the opening hand so this test always exercises a unit and a turn change.
  await page.evaluate(() => { Math.random = () => 0.43; });
  await page.getByRole('button', { name: 'Conectar e duelar' }).click();
  const unitIndex = await page.evaluate(() => NB.State.get().player.hand
    .findIndex(card => NB.Cards.CARD_DB[card.cardId].kind === 'unit'));
  expect(unitIndex).toBeGreaterThanOrEqual(0);
  await page.locator('.hand-card').nth(unitIndex).click();
  await page.getByRole('button', { name: 'Executar' }).click();
  await expect(page.locator('.player-slot .field-card')).toHaveCount(1);
  await expect(page.locator('#player-ram-text')).toContainText(/[23] RAM/);
  const primary = page.locator('#btn-primary-action');
  await primary.click();

  if (await page.evaluate(() => NB.State.get().phase) === 'PLAYER_ATTACK') {
    await page.locator('.player-slot:has(.field-card)').click();
    await primary.click();
  }

  await page.waitForFunction(() => ['PLAYER_DEFENSE', 'PLAYER_MAIN'].includes(NB.State.get().phase));
  if (await page.evaluate(() => NB.State.get().phase) === 'PLAYER_DEFENSE') {
    await primary.click();
  }

  await expect(page.locator('#turn-badge')).toHaveText('T2');
  expect(errors).toEqual([]);
});

test('plays distinct music themes and keeps the player’s mute preference', async ({ page }) => {
  await page.goto('/');
  const readScene = () => page.evaluate(() => NB.Audio.scene);
  await expect.poll(readScene).toBe('title');
  await page.locator('#btn-title-sound').click();
  await page.waitForFunction(() => NB.Audio.ctx.state === 'running' && NB.Audio.step > 0);

  await page.evaluate(() => {
    const analyser = NB.Audio.ctx.createAnalyser();
    NB.Audio.musicGain.connect(analyser);
    window.musicIsAudible = () => {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return samples.some(sample => Math.abs(sample) > 0.001);
    };
  });
  await page.waitForFunction(() => window.musicIsAudible());
  await enterCity(page, { legacy: true });
  await expect.poll(readScene).toBe('city');

  const themes = {
    market: 'market', relay: 'relay', arena: 'risco', kira: 'kira',
    cipher: 'cipher', vex: 'vex', archon: 'archon'
  };
  for (const [district, theme] of Object.entries(themes)) {
    await walkTo(page, page.locator(`[data-district="${district}"]`));
    await expect.poll(readScene).toBe(theme);
  }

  await walkTo(page, page.locator('[data-district="kira"]'));
  await page.getByRole('button', { name: 'Abrir dossiê' }).click();
  await page.getByRole('button', { name: 'Conectar e duelar' }).click();
  await expect.poll(readScene).toBe('kira');
  expect(await page.evaluate(() => NB.Audio.battle)).toBe(true);

  await page.locator('#btn-sound').click();
  await page.reload();
  await enterCity(page, { legacy: true });
  expect(await page.evaluate(() => NB.Audio.enabled)).toBe(false);
});

test('opens and navigates the enlarged card inspector above the deck', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await page.getByRole('button', { name: /Meu Deck/i }).click();
  const card = page.getByRole('button', { name: 'Kuroi-01', exact: true });
  await card.click();

  const inspector = page.getByRole('dialog', { name: 'KUROI-01' });
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('#insp-stats')).toContainText('ATK');
  const art = inspector.getByRole('img', { name: 'Kuroi-01' });
  await expect(art).toHaveAttribute('src', './cards/unit_01.webp');
  await expect.poll(() => art.evaluate(image => image.naturalWidth)).toBeGreaterThan(400);

  await inspector.getByRole('button', { name: 'Próxima carta' }).click();
  await expect(page.getByRole('dialog', { name: 'SPIDEY-DRONE' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card).toBeFocused();
});

test('shows each deck copy in a square, separate tile and keeps the same art frame in combat', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await page.getByRole('button', { name: /Meu Deck/i }).click();
  const tiles = page.locator('#collection-grid .col-card');
  const catalogCount = await page.evaluate(() => Object.keys(NB.Cards.CARD_DB).length);
  for (const [filter, count] of [['all', catalogCount], ['unit'], ['exploit'], ['indeck', 20]]) {
    await page.locator(`.deck-filter-btn[data-filter="${filter}"]`).click();
    if (count) await expect(tiles).toHaveCount(count);
    const frames = await tiles.evaluateAll(cards => cards.map(card => {
      const { x, y, width, height } = card.getBoundingClientRect();
      const art = card.querySelector('.col-card-art').getBoundingClientRect();
      return { x, y, width, height, artWidth: art.width, artHeight: art.height };
    }));
    expect(frames.length).toBeGreaterThan(0);
    for (const [index, frame] of frames.entries()) {
      expect(frame.artHeight).toBeCloseTo(frame.artWidth, 0);
      expect(frame.height).toBeCloseTo(frames[0].height, 0);
      for (const other of frames.slice(index + 1)) {
        expect(frame.x < other.x + other.width && frame.x + frame.width > other.x &&
          frame.y < other.y + other.height && frame.y + frame.height > other.y).toBe(false);
      }
    }
  }
  const aegis = page.getByRole('button', { name: /^Aegis-Wall · cópia/ }).first();
  await aegis.click();
  const inspector = page.locator('#insp-art-stage');
  await expect(inspector.locator('img[src="./cards/unit_03.webp"]')).toBeVisible();
  const frame = await inspector.boundingBox();
  expect(frame.width).toBeCloseTo(frame.height, 0);
  await page.keyboard.press('Escape');
  await expect(aegis).toBeFocused();

  await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    NB.UI.openVisorForHand({ cardId: 'unit_03' });
  });
  const visor = page.locator('#visor-art');
  await expect(visor.locator('img[src="./cards/unit_03.webp"]')).toBeVisible();
  await expect.poll(async () => (await visor.boundingBox()).width).toBeCloseTo(frame.width, 0);
  const combatFrame = await visor.boundingBox();
  expect(combatFrame.height).toBeCloseTo(frame.height, 0);
});

test('keeps locked stats secret on direct taps and when browsing the inspector', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Meu Deck/i }).click();
  const lockedCard = page.getByRole('button', { name: 'Bastion-Core · bloqueada' });
  await expect(lockedCard.locator('.col-card-art img').first()).toHaveCSS('filter', 'grayscale(1)');
  await lockedCard.click();
  await expect(page.locator('#card-inspector-modal')).toBeHidden();
  await expect(page.locator('#toast-banner')).toContainText('Obtenha esta carta');
  await page.getByRole('button', { name: 'Kuroi-01', exact: true }).click();
  const inspector = page.locator('#card-inspector-modal');
  const names = await page.evaluate(() => NB.Save.get().unlockedCards.map(id => NB.Cards.CARD_DB[id].name.toUpperCase()));
  for (const _ of names) {
    expect(names).toContain(await inspector.locator('#insp-name').textContent());
    await inspector.getByRole('button', { name: 'Próxima carta' }).click();
  }
});

test('Back unwinds the inspector, deck, city overlays and dossier one at a time', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 450 });
  await page.goto('/');
  const back = () => page.evaluate(() => NB.Input.handleBack());

  expect(await back()).toBe(false);
  await page.locator('#btn-title-deck').click();
  await page.getByRole('button', { name: 'Kuroi-01', exact: true }).click();
  expect(await back()).toBe(true);
  await expect(page.locator('#card-inspector-modal')).toBeHidden();
  await expect(page.locator('#deck-modal')).toBeVisible();
  expect(await back()).toBe(true);
  await expect(page.locator('#title-modal')).toBeVisible();

  await page.locator('#btn-title-settings').click();
  const reset = page.locator('#btn-reset-save');
  await reset.click();
  await expect(reset).toHaveAttribute('data-confirm', '1');
  expect(await back()).toBe(true);
  await expect(reset).toHaveAttribute('data-confirm', '0');
  await expect(page.locator('#settings-modal')).toBeVisible();
  expect(await back()).toBe(true);
  await expect(page.locator('#settings-modal')).toBeHidden();

  await enterCity(page, { legacy: true });
  expect(await back()).toBe(false);
  await page.locator('#city-journal').click();
  expect(await back()).toBe(true);
  await expect(page.locator('#city-journal')).toHaveAttribute('aria-pressed', 'false');

  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.getByRole('button', { name: 'Sinal Criptografado' }).click();
  expect(await back()).toBe(true);
  await expect(page.getByRole('button', { name: 'Sinal Criptografado' })).toBeVisible();

  await page.evaluate(() => { NB.Save.get().city.life.routePact = 3; });
  await walkTo(page, page.getByRole('button', { name: 'Estação Fantasma' }), 0);
  await page.getByRole('button', { name: 'Abrir dossiê' }).click();
  const dossier = page.getByRole('dialog', { name: 'Dossiê do Alvo' });
  await expect(dossier.getByRole('button', { name: 'VOLTAR', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(dossier.getByRole('button', { name: 'Conectar e duelar' })).toBeInViewport({ ratio: 1 });
  await dossier.getByRole('button', { name: 'VOLTAR', exact: true }).click();
  await expect(dossier).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Estação Fantasma' })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir dossiê' }).click();
  expect(await back()).toBe(true);
  await expect(dossier).toBeHidden();
  await expect(page.getByRole('button', { name: 'Abrir dossiê' })).toBeFocused();
  expect(await back()).toBe(false);
});

test('Back clears combat selections before allowing an exit prompt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Duelo rápido' }).click();
  const back = () => page.evaluate(() => NB.Input.handleBack());
  expect(await back()).toBe(false);
  await page.locator('.hand-card').first().click();
  await expect(page.locator('#visor-layer')).toBeVisible();
  expect(await back()).toBe(true);
  await expect(page.locator('#visor-layer')).toBeHidden();
  expect(await page.evaluate(() => NB.State.get().selectedHandUid)).toBeNull();

  await page.evaluate(() => {
    const state = NB.State.get();
    state.phase = 'PLAYER_OVERCLOCK';
    state.overclockUnits = [0];
    NB.UI.renderAll();
  });
  expect(await back()).toBe(true);
  expect(await page.evaluate(() => NB.State.get().phase)).toBe('PLAYER_ATTACK');
  expect(await back()).toBe(true);
  expect(await page.evaluate(() => NB.State.get().phase)).toBe('PLAYER_MAIN');

  await page.evaluate(() => {
    const state = NB.State.get();
    state.phase = 'SELECT_TARGET';
    state.pendingTarget = { targetSide: 'enemy', cardId: 'exploit_03' };
    NB.UI.renderAll();
  });
  expect(await back()).toBe(true);
  expect(await page.evaluate(() => NB.State.get().pendingTarget)).toBeNull();

  await page.evaluate(() => {
    const state = NB.State.get();
    state.phase = 'PLAYER_DEFENSE';
    state.activeDefenderSlot = 0;
    state.defenseMap = { 0: 1 };
    NB.UI.renderAll();
  });
  expect(await back()).toBe(true);
  expect(await page.evaluate(() => NB.State.get().activeDefenderSlot)).toBeNull();
  expect(await back()).toBe(true);
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({});
  expect(await back()).toBe(false);
  expect(await page.evaluate(() => NB.State.get().turn)).toBe(1);
});

test('adjusts music and effects independently and restores their levels', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-title-sound').click();
  await page.locator('#btn-title-settings').click();
  const music = page.getByRole('slider', { name: 'Música', exact: true });
  const effects = page.getByRole('slider', { name: 'Efeitos sonoros' });
  const gain = (channel) => page.evaluate(key => NB.Audio[key].gain.value, channel);

  await expect(music).toHaveValue('70');
  await expect(effects).toHaveValue('70');
  await music.fill('0');
  await expect(music).toHaveAttribute('aria-valuetext', '0%');
  await expect.poll(() => gain('musicGain')).toBeLessThan(0.001);
  await expect.poll(() => gain('sfxGain')).toBeCloseTo(1.155, 2);
  await effects.fill('63');
  await expect(effects).toHaveAttribute('aria-valuetext', '63%');
  await expect.poll(() => gain('sfxGain')).toBeCloseTo(1.0395, 2);
  await expect.poll(() => gain('musicGain')).toBeLessThan(0.001);

  await page.reload();
  await page.locator('#btn-title-settings').click();
  await expect(music).toHaveValue('0');
  await expect(effects).toHaveValue('63');
  await expect(page.locator('#btn-settings-sound')).toHaveText('SOM: ON');
  await expect.poll(() => gain('sfxGain')).toBeCloseTo(1.0395, 2);
  await expect.poll(() => gain('musicGain')).toBeLessThan(0.001);
});

test('renders the redesigned effects through the effects bus only', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-title-sound').click();
  const results = await page.evaluate(async () => {
    const audio = Object.create(NB.Audio);
    const patches = Object.entries(NB.SoundEffects);
    const ctx = new OfflineAudioContext(2, 48000 * patches.length, 48000);
    audio.ctx = ctx;
    audio.sfxCompressor = ctx.createDynamicsCompressor();
    const split = ctx.createChannelMerger(2);
    audio.sfxCompressor.connect(split, 0, 0);
    audio.musicGain = ctx.createGain();
    audio.musicGain.connect(split, 0, 1);
    split.connect(ctx.destination);

    patches.forEach(([, voices], second) => {
      for (const voice of voices) audio.playEffectVoice(voice, second);
    });
    const buffer = await ctx.startRendering();
    const effects = buffer.getChannelData(0);
    const music = buffer.getChannelData(1);
    const peak = samples => samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
    return {
      patches: Object.fromEntries(patches.map(([effect], second) =>
        [effect, peak(effects.subarray(second * 48000, (second + 1) * 48000))])),
      musicPeak: peak(music)
    };
  });
  expect(Object.keys(results.patches)).toHaveLength(14);
  for (const [effect, peak] of Object.entries(results.patches)) {
    expect(peak, `${effect} should be audible`).toBeGreaterThan(0.035);
  }
  expect(results.musicPeak).toBe(0);
});

test('recalibrates a unit at the workshop, preserves the choice, and restores it for free', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  const units = page.locator('.workshop-grid [data-card-id="unit_03"]');
  const affinities = page.getByRole('combobox', { name: 'Nova afinidade' });
  const recalibrate = page.getByRole('button', { name: 'Recalibrar · 15 créditos' });
  await page.getByRole('button', { name: 'Melhorar cartas' }).click();
  await expect(units).toBeHidden();
  await page.getByRole('button', { name: 'Escolher carta da coleção' }).click();
  await units.click();
  await expect(page.getByRole('button', { name: 'Confirmar modificação' })).toBeDisabled();
  const preview = page.getByRole('button', { name: 'Ver carta modificada' });
  await expect(preview).toBeDisabled();
  await affinities.selectOption('sombra');
  await expect(preview).toContainText('Aegis-Wall · ◆ Sombra');
  await expect(page.locator('#workshop-preview')).toBeHidden();
  await preview.click();
  await expect(page.locator('#workshop-preview')).toBeVisible();
  await expect(page.locator('#workshop-preview')).toContainText('dará +1 de dano contra Pulso');
  expect(await page.evaluate(() => NB.Save.getAffinity('unit_03'))).toBe('malha');
  await expect(page.locator('#city-credits')).toHaveText('35 créditos');
  await recalibrate.click();
  await expect(page.locator('#city-credits')).toHaveText('20 créditos');
  await expect(page.locator('.city-workshop')).toContainText('Afinidade atual · ◆ Sombra');
  await page.reload();
  await enterCity(page);
  await page.getByRole('button', { name: 'Melhorar cartas' }).click();
  await expect(units).toBeHidden();
  await page.getByRole('button', { name: 'Escolher carta da coleção' }).click();
  await units.click();
  await expect(page.locator('.city-workshop')).toContainText('Afinidade atual · ◆ Sombra');
  expect(await page.evaluate(() => NB.State.createFieldUnit('unit_03', 1, 'player').affinity)).toBe('sombra');
  expect(await page.evaluate(() => NB.State.createFieldUnit('unit_03', 1, 'enemy').affinity)).toBe('malha');
  await affinities.selectOption('malha');
  await page.getByRole('button', { name: 'Restaurar afinidade' }).click();
  await expect(page.locator('#city-credits')).toHaveText('20 créditos');
  await expect(page.locator('.city-workshop')).toContainText('Afinidade atual · ■ Malha');
});

test('applies affinity in a clash and a mixed Overclock, and recompiles a unit in battle', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  await page.getByRole('button', { name: 'Ver cartas à venda' }).click();
  await page.getByRole('button', { name: 'Comprar · 30' }).click();
  await expect(page.locator('#city-credits')).toHaveText('5 créditos');

  const outcome = await page.evaluate(async () => {
    NB.Input.startMatch({ mode: 'quick' });
    NB.State.wait = async () => true;
    const state = NB.State.get();
    const make = (id, uid) => ({ ...NB.State.createFieldUnit(id, uid), atk: 4, def: 14, booting: false });
    state.player.field[0] = make('unit_05', 97); // Pulso
    state.enemy.field[0] = make('unit_03', 98); // Malha
    await NB.Combat.resolveCombatSequence('player', [0], { 0: 0 });
    const clash = [state.player.field[0].def, state.enemy.field[0].def];

    state.player.hand.push({ cardId: 'exploit_07', uid: 99 });
    state.player.ram = 4;
    const invalidCast = NB.State.executeExploit('player', 99, 2);
    const ramAfterInvalidCast = state.player.ram;
    NB.State.executeExploit('player', 99, 0);
    const afterCast = state.player.field[0].affinity;
    const ramAfterCast = state.player.ram;
    NB.Input.startPlayerTurn();
    state.player.field[1] = make('unit_04', 100); // Sombra
    state.enemy.field[0].def = 8;
    state.enemy.hand = [];
    state.enemy.deck = [];
    state.phase = 'PLAYER_OVERCLOCK';
    state.overclockUnits = [0, 1];
    await NB.Combat.executeOverclockAttack();
    return {
      clash, invalidCast, ramAfterInvalidCast, ramAfterCast, afterCast,
      overflow: state.stats.damageDealt,
      oneAffinity: NB.Combat.overclockSynergy({ affinity: 'malha' }, { affinity: 'malha' }),
      neutral: NB.Combat.affinityBonus({ atk: 4, affinity: 'pulso' }, { affinity: null })
    };
  });
  expect(outcome).toEqual({
    clash: [10, 9], invalidCast: false, ramAfterInvalidCast: 4, ramAfterCast: 3,
    afterCast: 'malha', overflow: 1, oneAffinity: 0, neutral: 0
  });
});

test('quotes travel without charging, then spends time, energy and only the chosen fare', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 08:00 · Dia');
  const home = page.getByRole('button', { name: 'Casa de Kairo' });
  await home.click();
  await expect(page.getByRole('heading', { name: 'Ir para Casa de Kairo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bicicleta', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar viagem' }).click();
  await expect(page.locator('#city-credits')).toHaveText('35 créditos');
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 08:00 · Dia');

  await home.click();
  await page.evaluate(() => { Math.random = () => 0.99; });
  await page.getByRole('button', { name: 'Ônibus', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Casa de Kairo' })).toBeVisible();
  await expect(page.locator('#city-credits')).toHaveText('31 créditos');
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 08:17 · Dia');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '96');
  await page.getByRole('button', { name: 'Dormir · 8 h · Grátis' }).click();
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 16:17 · Dia');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
});

test('previews hotel services and rolls lasting travel offers by vehicle, fatigue and story progress', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.locator('[data-district="vex"]').click();
  await expect(page.locator('#city-content')).toContainText('Descanso · 5 h · 26 créditos');
  const chances = await page.evaluate(() => {
    const save = NB.Save.get();
    save.city.life.vehicles = ['bike', 'motorbike'];
    const getChances = () => NB.CityLife.routes('vex').map(route => route.encounterChance);
    const rested = getChances();
    save.city.life.energy = 21;
    const tired = getChances();
    save.city.life.energy = 1;
    const collapsed = getChances();
    save.city.life.energy = 100;
    const roll = Math.random;
    Math.random = () => 0.20;
    NB.CityLife.travel('vex', 'bus');
    const bus = NB.CityLife.getTravelChallenge();
    NB.CityLife.travel('kira', 'bike');
    const rookie = NB.CityLife.getTravelChallenge();
    const blocked = !NB.CityLife.travel('vex', 'bus');
    const withdrawal = NB.CityLife.settleTravelChallenge(true);
    save.story.chapter = 4;
    Math.random = () => 0.04;
    NB.CityLife.travel('vex', 'motorbike');
    Math.random = roll;
    return { rested, tired, collapsed, bus, rookie, blocked, withdrawal, late: NB.CityLife.getTravelChallenge() };
  });
  expect(chances).toMatchObject({
    rested: [35, 25, 15, 5], tired: [70, 50, 30, 10], collapsed: [0, 0, 0, 0],
    bus: null, rookie: { hp: 10, reward: 5 }, blocked: true, withdrawal: 3, late: { hp: 22, reward: 21 }
  });
  await page.reload();
  await enterCity(page);
  const offer = page.getByRole('region', { name: 'Desafio de viagem' });
  await expect(offer).toContainText('Elite · 22 HP · vitória paga 21 créditos');
  await expect(offer.getByRole('button', { name: 'Desistir · perder 9 créditos' })).toBeVisible();
  await expect(page.locator('.city-nav')).toHaveJSProperty('inert', true);
  const credits = await page.evaluate(() => NB.Save.get().city.credits);
  await offer.getByRole('button', { name: /Aceitar desafio/ }).click();
  await page.evaluate(() => {
    Math.random = () => 0.2;
    NB.State.get().enemy.hp = 0;
    NB.State.checkWinCondition();
  });
  await expect(page.locator('#gameover-modal')).toContainText('VITÓRIA · +21 CRÉDITOS');
  await expect(page.locator('#go-clue-text')).toHaveText('Energético guardado na Mochila.');
  expect(await page.evaluate(() => NB.Save.get().city.life.inventory.energyDrink)).toBe(1);
  expect(await page.evaluate(() => [NB.Save.get().city.credits, NB.CityLife.getTravelChallenge()])).toEqual([credits + 21, null]);

  await page.getByRole('button', { name: 'Voltar à cidade' }).click();
  await walkTo(page, page.locator('[data-district="kira"]'), 0);
  await offer.getByRole('button', { name: /Aceitar desafio/ }).click();
  await page.getByRole('button', { name: 'Sair do duelo' }).click();
  const abandon = page.getByRole('alertdialog');
  await expect(abandon).toContainText('Você perde 9 créditos.');
  await abandon.getByRole('button', { name: 'Abandonar duelo', exact: true }).click();
  expect(await page.evaluate(() => [NB.Save.get().city.credits, NB.CityLife.getTravelChallenge()])).toEqual([credits + 12, null]);
});

test('pays travel credits once and awards only unowned cards or a fitting bonus', async ({ page }) => {
  await page.goto('/');
  const rewards = await page.evaluate(() => {
    const save = NB.Save.get();
    const battle = (roll, win = true) => {
      save.city.life.travelChallenge = { name: 'Nexo', destination: save.city.district, tier: 0 };
      Math.random = () => roll;
      return NB.CityLife.finishTravelChallenge(win);
    };
    const first = battle(0.01);
    const replay = NB.CityLife.finishTravelChallenge(true);
    const second = battle(0.01);
    const common = battle(0.1);
    const creditsOnly = battle(0.6);
    const loss = battle(0.01, false);
    save.city.life.inventory.energyDrink = NB.CityLife.bagLimit;
    const full = battle(0.2);
    return { first, second, common, creditsOnly, loss, full, replay };
  });
  expect(rewards).toEqual({
    first: { credits: 5, bonus: { type: 'card', id: 'unit_22' } },
    second: { credits: 5, bonus: { type: 'card', id: 'unit_23' } },
    common: { credits: 5, bonus: { type: 'card', id: 'unit_07' } },
    creditsOnly: { credits: 5, bonus: null },
    loss: { credits: 0, bonus: null },
    full: { credits: 9, bonus: { type: 'credits', amount: 4 } },
    replay: { credits: 0, bonus: null }
  });
  await page.reload();
  expect(await page.evaluate(() => NB.Save.get().unlockedCards)).toEqual(expect.arrayContaining(['unit_22', 'unit_23', 'unit_07']));
});

test('wins the route pact, equips a suppression module and buys starting RAM', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  const go = async id => walkTo(page, page.locator(`[data-district="${id}"]`));
  await go('terminal');
  await page.getByRole('button', { name: 'Anotar o relato de Mara' }).click();
  await go('ringArchive');
  await page.getByRole('button', { name: 'Buscar Sinal com o registro de Leila' }).click();
  await go('depots');
  await page.getByRole('button', { name: 'Duelar com Sinal' }).click();
  await expect(page.locator('#enemy-avatar-box img[src="./avatars/sinal.webp"]')).toBeVisible();
  await page.evaluate(() => {
    NB.State.get().enemy.hp = 0;
    NB.State.checkWinCondition();
  });
  await expect(page.locator('#go-clue-title')).toHaveText('ACORDO DAS ROTAS');
  await page.getByRole('button', { name: 'Voltar à cidade' }).click();
  await walkTo(page, page.locator('[data-district="pump"]'), 0);
  const offer = page.getByRole('region', { name: 'Desafio de viagem' });
  await expect(offer.getByRole('button', { name: 'Recusar desafio' })).toBeVisible();
  const before = await page.evaluate(() => NB.Save.get().city.credits);
  await offer.getByRole('button', { name: 'Recusar desafio' }).click();
  expect(await page.evaluate(() => NB.Save.get().city.credits)).toBe(before);
  const module = page.getByRole('button', { name: 'Receber Módulo de Rota Cega' });
  await expect(module).toBeDisabled();
  await page.evaluate(() => {
    NB.Story.get().chapter = 2;
    NB.Save.get().city.life.energy = 100;
    NB.City.resetView();
  });
  await page.getByRole('button', { name: /Ajudar Maíra na bomba/ }).click();
  await module.click();
  await page.locator('#city-bag').click();
  await page.getByRole('button', { name: 'Ativar Rota Cega' }).click();
  await page.locator('#city-story').click();
  await page.getByRole('button', { name: 'Missões secundárias' }).click();
  const pact = page.locator('.city-mission-entry').filter({ hasText: 'Acordo das Rotas' });
  await expect(pact).toContainText('Você pode recusar ou abandonar sem pagar.');
  await expect(pact).toContainText('Módulo de Rota Cega');
  await expect(pact).toContainText('Casa de Bombas · Maíra');
  await page.reload();
  await enterCity(page);
  expect(await page.evaluate(() => NB.CityLife.routes('market').every(route => route.encounterChance === 0))).toBe(true);
  await walkTo(page, page.locator('[data-district="market"]'), 0);
  await expect(offer).toHaveCount(0);

  await page.evaluate(() => { NB.Save.get().city.credits = 100; });
  await expect(page.getByRole('button', { name: 'Ver cyberdecks' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver melhorias' }).click();
  const upgrades = page.getByRole('group', { name: 'Melhorias da Kairo' });
  await expect(upgrades.getByRole('button', { name: 'Ver itens de iniciativa' })).toBeVisible();
  await upgrades.getByRole('button', { name: 'Ver cyberdecks' }).click();
  await page.getByRole('button', { name: 'Voltar às melhorias' }).click();
  await upgrades.getByRole('button', { name: 'Ver cyberdecks' }).click();
  await page.getByRole('button', { name: 'Comprar · 85 créditos' }).click();
  await expect(page.getByRole('button', { name: 'Adquirido' })).toBeDisabled();
  await page.reload();
  const ram = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    return { equipped: NB.Save.get().city.life.equippedDeck, ram: NB.State.get().player.ram };
  });
  expect(ram).toEqual({ equipped: 'relay', ram: 1 });
  await page.evaluate(() => NB.Input.openNetMap());
  await page.locator('#city-bag').click();
  await page.getByRole('button', { name: 'Desativar Rota Cega' }).click();
  expect(await page.evaluate(() => NB.CityLife.routes('terminal').find(route => route.id === 'walk').encounterChance)).toBe(35);
  await page.getByRole('button', { name: /Equipar · Terminal de Campo/ }).click();
  expect(await page.evaluate(() => NB.Save.get().city.life.equippedDeck)).toBe('stock');
});

test('rolls either side for initiative and equips only one permanent starter item', async ({ page }) => {
  await page.goto('/');
  const opening = await page.evaluate(() => {
    NB.CityLife.rollInitiative = window.realInitiativeRoll;
    const original = Math.random;
    Math.random = () => 0.49;
    NB.Input.startMatch({ mode: 'quick' });
    const playerPhase = NB.State.get().phase;
    Math.random = () => 0.50;
    NB.Input.startMatch({ mode: 'quick' });
    Math.random = original;
    const state = NB.State.get();
    const result = { playerPhase, enemyPhase: state.phase, turn: state.turn, hands: [state.player.hand.length, state.enemy.hand.length] };
    NB.Input.openTitleScreen();
    return result;
  });
  expect(opening).toEqual({ playerPhase: 'PLAYER_MAIN', enemyPhase: 'ENEMY_TURN', turn: 1, hands: [4, 4] });

  await enterCity(page);
  await page.evaluate(() => { NB.Save.get().city.credits = 120; });
  await walkTo(page, page.locator('[data-district="market"]'));
  await page.getByRole('button', { name: 'Ver melhorias' }).click();
  await page.getByRole('button', { name: 'Ver itens de iniciativa' }).click();
  await page.getByRole('button', { name: 'Comprar · 65 créditos' }).click();
  await page.getByRole('button', { name: 'Comprar · 45 créditos' }).click();
  await page.locator('#city-bag').click();
  await page.getByRole('button', { name: 'Ativar Pulso de Partida' }).click();
  expect(await page.evaluate(() => {
    NB.CityLife.rollInitiative = () => 'enemy';
    return NB.CityLife.duelInitiative();
  })).toBe('player');
  await page.getByRole('button', { name: 'Ativar Relé de Espera' }).click();
  await expect(page.getByRole('button', { name: 'Desativar Pulso de Partida' })).toHaveCount(0);
  await page.reload();
  await enterCity(page);
  const enemyOpening = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    state.enemy.hand = [];
    return { phase: state.phase, item: NB.Save.get().city.life.activeInitiative };
  });
  expect(enemyOpening).toEqual({ phase: 'ENEMY_TURN', item: 'deferredSignal' });
  await expect.poll(() => page.evaluate(() => [NB.State.get().phase, NB.State.get().turn, NB.State.get().player.hand.length]))
    .toEqual(['PLAYER_MAIN', 1, 5]);

  await page.evaluate(() => NB.Input.openNetMap());
  await page.locator('#city-bag').click();
  await page.getByRole('button', { name: 'Desativar Relé de Espera' }).click();
  expect(await page.evaluate(() => NB.Save.get().city.life.activeInitiative)).toBeNull();
  await expect(page.locator('#city-content')).toContainText('Ordem inicial por sorteio.');
});

test('stores supplies and vehicles, restores the backpack and uses its contents', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Quiosque 24h' }));
  await page.getByRole('button', { name: 'Ver consumíveis' }).click();
  await page.getByRole('button', { name: 'Comprar · 4 créditos', exact: true }).click();
  await page.reload();
  await enterCity(page);
  await expect(page.getByRole('heading', { name: 'Quiosque 24h' })).toBeVisible();
  await page.getByRole('button', { name: 'Mochila', exact: true }).click();
  await expect(page.getByRole('button', { name: /Usar Café/ })).toBeEnabled();
  await page.getByRole('button', { name: /Usar Café/ }).click();
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
  await expect(page.getByText('Mochila vazia.')).toBeVisible();

  await page.evaluate(() => { NB.Save.get().city.credits = 800; });
  await walkTo(page, page.getByRole('button', { name: 'Garagem da Íris' }));
  await page.getByRole('button', { name: 'Ver veículos' }).click();
  await page.getByRole('button', { name: 'Comprar · 100 créditos' }).click();
  await page.getByRole('button', { name: 'Comprar · 450 créditos' }).click();
  await page.getByRole('button', { name: 'Voltar aos serviços' }).click();
  await page.getByRole('button', { name: 'Ver melhorias' }).click();
  await page.getByRole('button', { name: 'Ver implante' }).click();
  await page.getByRole('button', { name: 'Comprar · 130 créditos' }).click();
  await expect(page.locator('#city-energy')).toHaveAttribute('max', '120');
  await page.getByRole('button', { name: 'Casa de Kairo' }).click();
  await expect(page.getByRole('button', { name: 'Bicicleta', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Moto', exact: true })).toBeEnabled();
});

test('warns of exhaustion, resolves a street robbery and offers paid rest', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => {
    Math.random = () => 0.1;
    Object.assign(NB.Save.get().city, { credits: 100 });
    Object.assign(NB.Save.get().city.life, { energy: 100, awake: 940 });
  });
  await page.getByRole('button', { name: 'Pensão do Canal' }).click();
  await expect(page.getByText(/Você vai precisar dormir ao chegar/).first()).toBeVisible();
  await page.getByRole('button', { name: 'A pé', exact: true }).click();
  await expect(page.locator('#city-feedback')).toContainText('Perdeu 60 créditos');
  const rest = page.getByRole('dialog', { name: 'Assalto no beco' });
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('Ela foi assaltada e perdeu 60 créditos.');
  await expect(rest.locator('img')).toHaveAttribute('src', './src/assets/comic/assalto-no-beco.webp');
  await expect.poll(() => page.evaluate(() => NB.Save.get().seenArt)).toContain('./src/assets/comic/assalto-no-beco.webp');
  await rest.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('#city-credits')).toHaveText('40 créditos');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '60');
  await page.getByRole('button', { name: 'Dormir · 7 h · 12 créditos' }).click();
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
  await expect(page.locator('#city-credits')).toHaveText('28 créditos');
  await walkTo(page, page.getByRole('button', { name: 'Hotel Espelho · bloqueado' }));
  await page.getByRole('button', { name: 'Dormir · 5 h · 26 créditos' }).click();
  await expect(page.locator('#city-credits')).toHaveText('2 créditos');
});

test('shows a quiet street rest and waits for acknowledgement across reload', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => { NB.Save.get().city.life.energy = 1; });
  await walkTo(page, page.locator('[data-district="pension"]'), 0.99);
  const rest = page.getByRole('dialog', { name: 'Descanso no beco' });
  await expect(rest).toContainText('Kairo dormiu na rua por 5 horas. Ninguém mexeu com ela.');
  await expect(rest.locator('img')).toHaveAttribute('src', './src/assets/comic/descanso-no-beco.webp');
  expect(await page.evaluate(() => NB.Save.get().city.credits)).toBe(35);
  await page.reload();
  await enterCity(page);
  await expect(rest).toBeVisible();
  expect(await page.evaluate(() => NB.Input.handleBack())).toBe(true);
  await expect(rest).toBeHidden();
  await page.reload();
  await enterCity(page);
  await expect(rest).toBeHidden();
});

test('opens the kiosk job only in its night window and prevents duplicate pay', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  const kiosk = page.getByRole('button', { name: 'Quiosque 24h' });
  await walkTo(page, kiosk);
  const job = page.getByRole('button', { name: /Trabalhar no quiosque/ });
  await expect(job).toBeDisabled();
  await page.evaluate(() => { NB.Save.get().city.life.minute = 1190; });
  await kiosk.click();
  await expect(job).toBeEnabled();
  await job.click();
  await expect(page.locator('#city-credits')).toHaveText('49 créditos');
  await expect(page.getByRole('button', { name: 'Turno já concluído' })).toBeDisabled();
});

test('adds the city clock and backpack to existing saves without losing progress', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('neon_breach_save_v1', JSON.stringify({
      city: { credits: 87, district: 'market', traced: ['kira'] },
      defeatedBosses: ['kira'],
      clues: [{ bossId: 'kira', title: 'Pista salva', text: 'Texto anterior.' }],
      unlockedCards: ['unit_21'],
      affinities: { unit_03: 'pulso' },
      wins: 1
    }));
  });
  await page.goto('/');
  await enterCity(page);
  await expect(page.getByRole('heading', { name: 'Feira do Viaduto' })).toBeVisible();
  await expect(page.locator('#city-credits')).toHaveText('87 créditos');
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 08:00 · Dia');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
  expect(await page.evaluate(() => NB.Save.get())).toMatchObject({
    defeatedBosses: ['kira'],
    clues: [{ bossId: 'kira', title: 'Pista salva' }],
    affinities: { unit_03: 'pulso' },
    story: { started: true, chapter: 0 },
    city: { traced: ['kira'], life: { inventory: { coffee: 0, energyDrink: 0, synthetic: 0 } } }
  });
});

test('filters the illustrated map by neighborhood and visits its locations directly', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await enterCity(page);
  const map = page.locator('#city-map');
  await expect(map).toBeInViewport({ ratio: 0.95 });
  await expect(map.getByRole('button', { name: 'Quiosque 24h' }).locator('.city-place-icon')).toHaveText('☕');
  await expect(map.getByRole('button', { name: 'Casa de Kairo' }).locator('.city-place-icon')).toHaveText('⌂');
  await page.getByRole('button', { name: 'Bairros', exact: true }).click();
  const neighborhood = page.getByRole('combobox', { name: 'Bairro no mapa' });
  await expect(neighborhood.locator('option')).toHaveCount(11);
  await neighborhood.selectOption({ label: 'Morro das Casas' });
  await expect(map.getByRole('button')).toHaveCount(2);
  await walkTo(page, map.getByRole('button', { name: 'Clínica do Morro', exact: true }));
  await expect(page.getByRole('heading', { name: 'Clínica do Morro' })).toBeVisible();
  await page.locator('#city-scene').evaluate(image => image.decode());
  await expect(page.locator('#city-npc')).toContainText('Ada');
  await expect(page.getByText('Pessoas neste local', { exact: true })).toHaveCount(0);
});

test('resumes the prologue after reload and earns Kira’s proof by doing a favor', async ({ page }) => {
  test.setTimeout(90000);
  const investigation = () => page.getByRole('button', { name: 'Investigação', exact: true }).click();
  const read = async (title, last = 'Registrar e sair') => {
    await page.getByRole('button', { name: title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    const next = dialog.getByRole('button', { name: 'Continuar', exact: true });
    while (await next.isVisible()) {
      const tap = dialog.getByRole('button', { name: /Testar a chave no leitor|Limpar o recibo molhado/ });
      if (await tap.isVisible()) await tap.click();
      const tuning = dialog.getByRole('slider');
      if (await tuning.isVisible()) await tuning.fill('64');
      await next.click();
    }
    await dialog.getByRole('button', { name: last, exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  await page.goto('/');
  await enterCity(page);
  await expect(page.locator('[data-district="home"]')).toHaveAttribute('data-markers', /clue/);
  await walkTo(page, page.locator('[data-district="home"]'));
  await read('Testar o leitor e a chave');
  const title = 'Ler as faturas com Dona Nair';
  await page.getByRole('button', { name: title }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(dialog.locator('#story-page')).toContainText('2 /');
  await page.reload();
  await enterCity(page);
  await page.getByRole('button', { name: title }).click();
  await expect(dialog.locator('#story-page')).toContainText('2 /');
  await dialog.getByRole('button', { name: 'VOLTAR', exact: true }).click();
  await read(title);

  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await read('Levar a cópia do recibo à Antena');
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  await read('Conferir a nota do lote na Feira');
  await walkTo(page, page.getByRole('button', { name: /Estação Fantasma/ }));
  await expect(page.getByText('A investigação ainda não chegou a este duelo.', { exact: false })).toBeVisible();
  await read('Conferir a entrada com Severino');
  await read('Ouvir Kira sobre a rota vendida', 'Aceitar o favor de conferir o recibo na Feira');
  await expect(page.locator('#city-content').getByRole('button', { name: /duelar pela investigação|abrir dossiê/i })).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(NB.Story.matchAccess('kira')))).toBe(true);
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  await read('Conferir o recibo anonimizado com Beto');
  await walkTo(page, page.locator('[data-district="ringArchive"]'));
  await read('Cruzar o código do terminal com Leila');
  await walkTo(page, page.locator('[data-district="kira"]'));
  const beforeReward = await page.evaluate(() => NB.Save.get().city.credits);
  await read('Entregar o dossiê auditado a Kira');
  expect(await page.evaluate(() => NB.Save.get().city.credits)).toBe(beforeReward + 35);
  expect(await page.evaluate(() => NB.Save.get().unlockedCards)).toContain('exploit_15');
  expect(await page.evaluate(() => JSON.parse(localStorage.neon_breach_save_v1).story.allies)).toEqual({
    kira: true, cipher: false, vex: false
  });
  await investigation();
  await expect(page.locator('#city-content')).toContainText('Quem pagou duas vezes');
  await expect(page.locator('#city-content')).toContainText('O dossiê auditado comprova');
  expect(await page.evaluate(() => NB.Save.isNodeDefeated('kira'))).toBe(false);
});

test('unwinds the complete investigation with alternative routes and a recorded final choice', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    NB.Story.start();
    function finish(id, choice) {
      const scene = NB.Story.sceneById[id];
      NB.Story.remember(id, NB.Story.getLines(scene).length - 1);
      if (!NB.Story.finish(id, choice)) throw new Error(`Blocked at ${id}`);
    }
    finish('keys');
    finish('nair');
    finish('firstSignal');
    finish('invoice');
    finish('mara');
    finish('kiraDeal', 'duel');
    NB.Save.recordBossVictory(NB.Campaign.getNodeById('kira'));
    finish('kiraProof');
    finish('ringLedger');
    finish('iris');
    finish('ada');
    finish('tellingNair', 'tell');
    finish('pass');
    finish('cipherDeal', 'supervised');
    finish('cipherAlt');
    finish('cipherToken');
    finish('cipherPeace');
    finish('meridianoRadio');
    finish('cris');
    finish('vexDeal', 'witness');
    finish('vexStub');
    finish('vexAlt');
    finish('vexPeace');
    finish('renan');
    finish('reserve');
    finish('press');
    finish('registry');
    if (NB.Story.available(NB.Story.sceneById.archonDeal)) throw new Error('Archon open before the warning');
    finish('archonPrep');
    finish('archonDeal');
    if (NB.Story.available(NB.Story.sceneById.ending)) throw new Error('Ending open before Archon duel');
    NB.Save.recordBossVictory(NB.Campaign.getNodeById('archon'));
    finish('ending', 'council');
    finish('epilogue');
    return { complete: NB.Story.has('epilogue'), evidence: NB.Story.get().evidence.length,
      aftermath: NB.Story.aftermath('square'), choice: NB.Story.choice('ending'), allies: NB.Story.get().allies,
      repeat: NB.Story.finish('epilogue') };
  });
  expect(result).toMatchObject({ complete: true, evidence: 16, choice: 'council', repeat: false, allies: { kira: false, cipher: true, vex: true } });
  expect(result.aftermath).toContain('conselho');
});

test('opens the ferry shortcut through Maíra', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const city = NB.Save.get().city;
    city.district = 'pump';
    const before = NB.CityLife.routes('ferry').some(route => route.id === 'ferry');
    const helped = NB.CityLife.helpContact('pumpRelay');
    const duplicate = NB.CityLife.helpContact('pumpRelay');
    const ready = NB.CityLife.routes('ferry').find(route => route.id === 'ferry').available;
    city.life.minute = 1200;
    const closed = NB.CityLife.routes('ferry').find(route => route.id === 'ferry').available;
    return { before, helped, duplicate, ready, closed, credits: city.credits };
  });
  expect(result).toEqual({ before: false, helped: true, duplicate: false, ready: true, closed: false, credits: 51 });
});

test('learns the bicycle shortcut from Aline only after buying the bike and winning her duel', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => { NB.Save.get().city.credits = 150; });
  await walkTo(page, page.locator('[data-district="garage"]'));
  const lesson = page.getByText('Aprender com Aline o atalho de bicicleta', { exact: true });
  const aline = page.locator('.city-contact > summary').filter({ hasText: 'Aline' });
  await expect(aline.locator('img')).toHaveAttribute('src', './avatars/aline.webp');
  await aline.click();
  await expect(page.getByRole('button', { name: 'Desafiar Aline', exact: true })).toBeVisible();
  await expect(lesson).toHaveCount(0);
  const services = page.getByRole('group', { name: 'Serviços da loja' });
  for (const name of ['Ver veículos', 'Ver melhorias']) {
    await expect(services.getByRole('button', { name }).locator('svg')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Ver melhorias' }).click();
  const upgrades = page.getByRole('group', { name: 'Melhorias da Kairo' });
  for (const name of ['Ver implante', 'Ver cyberdecks']) {
    await expect(upgrades.getByRole('button', { name }).locator('svg')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Voltar aos serviços' }).click();
  await page.getByRole('button', { name: 'Ver veículos' }).click();
  await page.getByRole('button', { name: 'Comprar · 100 créditos' }).click();
  await page.getByRole('button', { name: 'Voltar aos serviços' }).click();
  await aline.click();
  await lesson.click();
  await expect(page.getByRole('button', { name: 'Desafiar Aline', exact: true })).toBeVisible();
  await expect(page.locator('.city-contact')).toContainText('Se me vencer num duelo');
  const quote = () => page.evaluate(() => NB.CityLife.routes('clinic').find(route => route.id === 'bike'));
  const before = await quote();
  const duel = page.getByRole('button', { name: 'Duelar com Aline pelo atalho' });
  await duel.click();
  await page.evaluate(() => {
    NB.State.get().player.hp = 0;
    NB.State.checkWinCondition();
  });
  await page.getByRole('button', { name: 'Voltar à cidade' }).click();
  expect((await quote()).minutes).toBe(before.minutes);
  await aline.click();
  await lesson.click();
  await duel.click();
  await page.evaluate(() => {
    NB.State.get().enemy.hp = 0;
    NB.State.checkWinCondition();
  });
  await expect(page.locator('#go-clue-title')).toHaveText('ATALHO DA ALINE');
  await expect(page.locator('#go-clue-text')).toContainText('entre o Pátio das Oficinas e o Morro das Casas');
  await expect(page.locator('#go-clue-text')).toContainText('menos tempo e chega com mais energia');
  await expect(page.locator('#go-clue-text')).toContainText('Ferro de Pulso');

  await page.reload();
  await enterCity(page);
  const after = await quote();
  expect(after.minutes).toBeLessThan(before.minutes);
  expect(after.energy).toBeLessThan(before.energy);
  await aline.click();
  await page.getByText('Rever a dica da Aline', { exact: true }).click();
  await expect(page.locator('.city-contact')).toContainText('Funciona nos dois sentidos');
});


test('searches collection without accents and keeps three deck slots separate across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await page.locator('#btn-title-deck').click();
  const search = page.getByRole('searchbox', { name: 'Buscar cartas' });
  const deckSlot = page.getByRole('combobox', { name: 'Deck ativo' });
  await search.fill('ceramica reparo');
  await expect(page.locator('#collection-grid button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Cerâmica de Reparo · bloqueada' })).toBeVisible();
  await page.getByRole('button', { name: 'UNID.', exact: true }).click();
  await expect(page.locator('#collection-grid button')).toHaveCount(0);
  const firstDeck = await page.evaluate(() => NB.Save.getActiveDeck());

  await deckSlot.selectOption('1');
  const secondDeck = await page.evaluate(() => {
    const deck = NB.Save.getActiveDeck().reverse();
    NB.Save.saveCustomDeck(deck);
    return deck;
  });
  expect(secondDeck).not.toEqual(firstDeck);
  await deckSlot.selectOption('2');
  await deckSlot.selectOption('1');
  await page.reload();
  await page.locator('#btn-title-deck').click();
  await expect(deckSlot).toHaveValue('1');
  expect(await page.evaluate(() => NB.Save.getActiveDeck())).toEqual(secondDeck);
  await deckSlot.selectOption('0');
  expect(await page.evaluate(() => NB.Save.getActiveDeck())).toEqual(firstDeck);
});

test('loans an archetype deck and unlocks its reward cards once', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Ringue Baixa Tensão', exact: true }));
  await expect(page.getByRole('heading', { name: 'Desafios de arquétipo' })).toBeVisible();
  const challenge = page.getByRole('button', { name: 'Turno da Estação' });
  await expect(challenge).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Frequência Cruzada' })).toHaveCount(0);
  await page.evaluate(() => {
    NB.Story.get().flags.push('kiraProof');
    NB.Input.openNetMap();
  });
  await challenge.click();

  const result = await page.evaluate(() => {
    const state = NB.State.get();
    const activeDeck = NB.Save.getActiveDeck();
    const loanDeck = [...state.player.hand, ...state.player.deck].map(item => item.cardId);
    const quality = NB.Challenges.every(challenge => challenge.deck.length === 20 &&
      new Set(challenge.deck).size === 10 && challenge.deck.every(id => NB.Cards.CARD_DB[id]));
    state.enemy.hp = 0;
    NB.State.checkWinCondition();
    NB.State.checkWinCondition();
    const progress = NB.Save.get();
    return {
      mode: state.mode, quality, matches: progress.matches,
      loanCount: loanDeck.filter(id => id === 'unit_24').length,
      activeDeckUnchanged: JSON.stringify(activeDeck) === JSON.stringify(NB.Save.getActiveDeck()),
      wins: progress.challengeWins, rewards: state.challengeRewards,
      unlocked: progress.unlockedCards.filter(id => ['unit_24', 'exploit_08'].includes(id))
    };
  });
  expect(result).toEqual({
    mode: 'challenge', quality: true, matches: 1, loanCount: 2, activeDeckUnchanged: true,
    wins: ['infiltration'], rewards: ['unit_24', 'exploit_08'], unlocked: ['unit_24', 'exploit_08']
  });
});

test('hides late archetypes until the encounter or a completed adventure restarted as New Game Plus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Novo Jogo+', { exact: true })).toBeHidden();
  const initial = await page.evaluate(() => {
    const challenge = NB.Challenges.find(entry => entry.opponent === 'archon');
    NB.Input.startMatch({ mode: 'challenge', challenge, boss: NB.Campaign.getNodeById('archon') });
    return {
      matches: Array.from({ length: 20 }, () => NB.Campaign.getRandomBoss().id),
      rewards: NB.Save.recordChallengeVictory(challenge.id),
      started: NB.Save.startNewGamePlus()
    };
  });
  expect(new Set(initial.matches)).toEqual(new Set(['kira']));
  expect(initial.rewards).toEqual([]);
  expect(initial.started).toBe(false);
  await page.evaluate(() => {
    const save = NB.Save.get();
    save.defeatedBosses.push('cipher', 'archon');
    save.story.flags.push('vexProof');
    save.city.credits = 200;
    save.challengeWins.push('armor');
    save.seenArt.push('saved-art');
    save.unlockedCards.push('unit_25');
    NB.UI.renderTitleStats();
  });
  expect(await page.evaluate(() => ['kira', 'cipher', 'vex', 'archon'].map(NB.Save.isArchetypeUnlocked)))
    .toEqual([false, true, true, false]);
  await expect(page.getByText('Novo Jogo+', { exact: true })).toBeHidden();
  await page.evaluate(() => {
    NB.Story.get().flags.push('epilogue');
    NB.UI.renderTitleStats();
  });
  await page.getByText('Novo Jogo+', { exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar Novo Jogo+' }).click();
  await expect(page.locator('#prologue-modal')).toBeVisible();
  await page.reload();
  const progress = await page.evaluate(() => ({
    ...NB.Save.get(),
    archonChallenge: NB.Save.isArchetypeUnlocked('archon')
  }));
  expect(progress).toMatchObject({
    newGamePlus: true, archonChallenge: true, prologueSeen: false, defeatedBosses: [],
    challengeWins: ['armor'], story: { chapter: 0, flags: [] }, city: { credits: 35 }
  });
  expect(progress.unlockedCards).toContain('unit_25');
  expect(progress.seenArt).toContain('saved-art');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Ringue Baixa Tensão', exact: true }));
  await page.getByRole('button', { name: 'Frequência Cruzada' }).click();
  expect(await page.evaluate(() => [NB.State.get().mode, NB.State.get().boss.id])).toEqual(['challenge', 'archon']);
});

test('exhausts attacking units on both sides and rejects them as manual or automatic blockers', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    NB.Input.startMatch({ mode: 'quick' });
    NB.State.wait = async () => true;
    const state = NB.State.get();
    state.player.field[0] = NB.State.createFieldUnit('unit_03', 901, 'player');
    state.enemy.field[0] = NB.State.createFieldUnit('unit_04', 902, 'enemy');
    state.player.field[0].booting = false;
    state.enemy.field[0].booting = false;
    await NB.Combat.resolveCombatSequence('player', [0], {});
    state.enemyAttackers = [0];
    state.defenseMap = {};
    state.phase = 'PLAYER_DEFENSE';
    NB.UI.renderAll();
  });
  await expect(page.locator('.player-slot .field-card')).toContainText('SEM BLOQUEIO');
  await page.locator('.player-slot:has(.field-card)').click();
  expect(await page.evaluate(() => NB.State.get().activeDefenderSlot)).toBeNull();
  const result = await page.evaluate(async () => {
    const state = NB.State.get();
    const previousHp = state.player.hp;
    state.defenseMap[0] = 0;
    await NB.Combat.confirmPlayerDefense();
    return {
      playerDamage: previousHp - state.player.hp,
      enemyBlocked: NB.Combat.canBlock(state.enemy.field[0], state.enemy),
      aiBlocks: NB.AI.computeAiBlocks([0]),
      playerReady: NB.Combat.canBlock(state.player.field[0], state.player)
    };
  });
  expect(result).toMatchObject({ enemyBlocked: false, aiBlocks: {}, playerReady: true });
  expect(result.playerDamage).toBeGreaterThan(0);
});

test('marks the only legal block, toggles it in one tap and leaves a choice against two attacks', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    state.player.field = [
      { ...NB.State.createFieldUnit('unit_04', 971, 'player'), attacked: true },
      NB.State.createFieldUnit('unit_01', 972, 'player'), null
    ];
    state.enemy.field[0] = NB.State.createFieldUnit('unit_04', 973, 'enemy');
    NB.Combat.preparePlayerDefense([0]);
    NB.UI.renderAll();
  });
  const exhausted = page.locator('.player-slot').nth(0);
  const defender = page.locator('.player-slot').nth(1);
  await expect(exhausted).toContainText('SEM BLOQUEIO');
  await expect(defender).toContainText('BLOQUEANDO');
  await defender.click();
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({});
  await defender.click();
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({ 0: 1 });

  await page.evaluate(() => {
    const state = NB.State.get();
    state.enemy.field[1] = NB.State.createFieldUnit('unit_05', 974, 'enemy');
    NB.Combat.preparePlayerDefense([0, 1]);
    NB.UI.renderAll();
  });
  await expect(defender).toContainText('SELECIONADO');
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({});
  await page.locator('.enemy-slot').nth(1).click();
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({ 1: 1 });

  await page.evaluate(() => {
    const state = NB.State.get();
    state.player.field[0].attacked = false;
    NB.Combat.preparePlayerDefense([0]);
    NB.UI.renderAll();
  });
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({});
  await exhausted.click();
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({ 0: 0 });

  const hpBefore = await page.evaluate(() => {
    const state = NB.State.get();
    state.player.field = [NB.State.createFieldUnit('unit_03', 975, 'player'), null, null];
    NB.Combat.preparePlayerDefense([0]);
    NB.State.wait = async () => true;
    NB.UI.renderAll();
    return state.player.hp;
  });
  await exhausted.click();
  await page.getByRole('button', { name: 'Confirmar defesa' }).click();
  await expect.poll(() => page.evaluate(() => NB.State.get().player.hp)).toBeLessThan(hpBefore);
});

test('supports vigilance, specialized units and temporary protection exploits', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    const player = state.player;
    const units = ['unit_32', 'unit_33', 'unit_34'].map((id, i) => NB.State.createFieldUnit(id, 950 + i, 'player'));
    player.field = units;
    for (const unit of units) unit.booting = false;
    const [vigilant, striker, guard] = units;
    const roles = units.map(unit => [NB.Combat.canAttack(unit, units), NB.Combat.canBlock(unit, player)]);
    vigilant.attacked = true;
    const vigilance = NB.Combat.canBlock(vigilant, player);
    const tired = NB.State.createFieldUnit('unit_03', 960, 'player');
    tired.attacked = true;
    player.field = [tired, striker, guard];
    striker.attacked = true;
    const cast = id => {
      const card = NB.Cards.CARD_DB[id];
      NB.CardEffects.resolve(card, card.effects, 'player');
    };
    cast('exploit_17');
    const formation = [NB.Combat.canBlock(tired, player), NB.Combat.canBlock(striker, player)];
    cast('exploit_18');
    cast('exploit_18');
    const shield = player.hpShield;
    const hp = player.hp;
    NB.State.applyDirectDamage('player', 5, false);
    const damage = hp - player.hp;
    cast('exploit_18');
    NB.Input.startPlayerTurn();
    return { roles, vigilance, formation, shield, damage, expired: !player.hpShield && !player.counterFormation };
  });
  expect(result).toEqual({
    roles: [[true, true], [true, false], [false, true]], vigilance: true,
    formation: [true, false], shield: 4, damage: 1, expired: true
  });
});

test('limits repair, protects RAM on invalid targets and previews affinity damage', async ({ page }) => {
  await page.goto('/');
  const repair = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    const defender = NB.State.createFieldUnit('unit_03', 901);
    const attacker = NB.State.createFieldUnit('unit_05', 902, 'enemy');
    Object.assign(defender, { atk: 2, def: 4, maxDef: 5 });
    Object.assign(attacker, { atk: 3, def: 5 });
    state.player.field[0] = defender;
    state.enemy.field[1] = attacker;
    state.player.hand.push({ cardId: 'exploit_09', uid: 903 });
    state.player.ram = 4;
    const invalid = NB.State.executeExploit('player', 903, 2);
    const unspent = state.player.ram;
    const valid = NB.State.executeExploit('player', 903, 0);
    state.phase = 'PLAYER_DEFENSE';
    state.enemyAttackers = [1];
    state.defenseMap = { 1: 0 };
    NB.UI.renderAll();
    return { invalid, unspent, valid, def: defender.def, ram: state.player.ram };
  });
  expect(repair).toEqual({ invalid: false, unspent: 4, valid: true, def: 5, ram: 3 });
  await expect(page.locator('#defense-preview')).toHaveText('Sua posição 1 DEF 5→1 · Inimigo 2 DEF 5→3 · +1 Pulso (ataque)');
});

test('rejects a repeat modifier without spending the card and lets Kairo pick another unit', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    state.player.ram = 12;
    state.player.field = [NB.State.createFieldUnit('unit_01', 981, 'player'),
      NB.State.createFieldUnit('unit_01', 982, 'player'), null];
    state.player.hand = [{ cardId: 'exploit_01', uid: 983 }, { cardId: 'exploit_01', uid: 984 }];
    NB.UI.renderAll();
  });
  const playChip = async () => {
    await page.locator('.hand-card').filter({ hasText: 'Chip Overclock' }).first().click();
    await page.getByRole('button', { name: 'Executar' }).click();
  };
  const first = page.locator('.player-slot').nth(0);
  const second = page.locator('.player-slot').nth(1);
  await playChip();
  await first.click();
  await expect(first.locator('.field-modifier-mark')).toHaveAttribute('title', 'Chip Overclock');
  const spent = await page.evaluate(() => NB.State.get().player.ram);
  await playChip();
  await first.click();
  await expect(page.locator('#toast-banner')).toContainText('JÁ TEM ESSE MODIFICADOR');
  expect(await page.evaluate(() => {
    const state = NB.State.get();
    return [state.phase, state.player.ram, state.player.hand.length, state.player.field[0].atk];
  })).toEqual(['SELECT_TARGET', spent, 1, 7]);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => NB.State.get().player.hand.length)).toBe(1);
  await playChip();
  await second.click();
  expect(await page.evaluate(() => NB.State.get().player.field.slice(0, 2).map(unit => unit.atk))).toEqual([7, 7]);
  await first.click();
  await expect(page.locator('#visor-desc')).toContainText('Modificadores aplicados: Chip Overclock');
});

test('keeps group buffs unique per unit while repeatable healing still works', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    const player = state.player;
    player.hp = 10;
    player.ram = 20;
    player.field[0] = NB.State.createFieldUnit('unit_01', 990, 'player');
    player.hand = [991, 992, 993].map(uid => ({ cardId: 'exploit_04', uid }));
    NB.State.executeExploit('player', 991);
    player.field[1] = NB.State.createFieldUnit('unit_01', 994, 'player');
    NB.State.executeExploit('player', 992);
    NB.State.executeExploit('player', 993);
    return [player.hp, player.field[0].def, player.field[1].def, player.field[0].appliedModifiers];
  });
  expect(result).toEqual([20, 6, 6, ['exploit_04']]);
});

test('marks affinity on attack targets and on real blocking lines', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    state.player.field[0] = { ...NB.State.createFieldUnit('unit_05', 901, 'player'), booting: false };
    state.enemy.field[0] = NB.State.createFieldUnit('unit_03', 902, 'enemy');
    state.enemy.field[1] = NB.State.createFieldUnit('unit_05', 903, 'enemy');
    state.phase = 'PLAYER_ATTACK';
    NB.UI.renderAll();
  });
  await page.locator('.player-slot').first().click();
  await expect(page.locator('.enemy-slot').nth(0).locator('.affinity-attack-bonus')).toHaveText('+1');
  await expect(page.locator('.enemy-slot').nth(1).locator('.affinity-attack-bonus')).toHaveCount(0);
  await page.evaluate(() => {
    const state = NB.State.get();
    [state.player.field[0], state.enemy.field[0]] = [state.enemy.field[0], state.player.field[0]];
    NB.Combat.preparePlayerDefense([0]);
    NB.UI.renderAll();
  });
  await expect(page.locator('#laser-svg .affinity-line-bonus')).toHaveAttribute('aria-label', '+1 de afinidade no ataque');
});

test('assigns several attacks to a wall and spends its defense in order', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    state.player.field[0] = NB.State.createFieldUnit('unit_35', 910, 'player');
    for (let slot = 0; slot < 3; slot++) {
      state.enemy.field[slot] = { ...NB.State.createFieldUnit('unit_01', 920 + slot, 'enemy'), atk: 3, booting: false };
    }
    NB.Combat.preparePlayerDefense([0, 1, 2]);
    NB.UI.renderAll();
  });
  for (const slot of [0, 1, 2]) await page.locator('.enemy-slot').nth(slot).click();
  expect(await page.evaluate(() => NB.State.get().defenseMap)).toEqual({ 0: 0, 1: 0 });
  await expect(page.locator('#defense-preview')).toContainText('Ataque 2 segue para o HP se a muralha cair.');
  const outcome = await page.evaluate(async () => {
    const state = NB.State.get();
    NB.State.wait = async () => true;
    const hp = state.player.hp;
    await NB.Combat.confirmPlayerDefense();
    const broken = [state.player.field[0], hp - state.player.hp];
    state.player.field[0] = NB.State.createFieldUnit('unit_36', 911, 'player');
    const nextHp = state.player.hp;
    for (const unit of state.enemy.field) unit.attacked = false;
    NB.Combat.preparePlayerDefense([0, 1, 2]);
    const links = { ...state.defenseMap };
    await NB.Combat.confirmPlayerDefense();
    const colossus = [state.player.field[0].def, nextHp - state.player.hp];
    state.enemy.field = [NB.State.createFieldUnit('unit_36', 950, 'enemy'), null, null];
    state.player.field = [0, 1, 2].map(index => NB.State.createFieldUnit('unit_04', 960 + index, 'player'));
    return { broken, links, colossus, ai: NB.AI.computeAiBlocks([0, 1, 2]) };
  });
  expect(outcome).toEqual({ broken: [null, 6], links: { 0: 0, 1: 0, 2: 0 }, colossus: [3, 0], ai: { 0: 0, 1: 0, 2: 0 } });
});

test('finishes a draw exploit before putting it into the discard pile', async ({ page }) => {
  await page.goto('/');
  const piles = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const { player } = NB.State.get();
    player.ram = 2;
    player.hand = [{ cardId: 'exploit_08', uid: 90 }];
    player.deck = [];
    player.discard = [{ cardId: 'unit_01', uid: 91 }];
    NB.State.executeExploit('player', 90);
    return { hand: player.hand.map(item => item.uid), discard: player.discard.map(item => item.uid) };
  });
  expect(piles).toEqual({ hand: [91], discard: [90] });
});

test('offers three balanced starter decks and remembers the chosen collection across sessions', async ({ page }) => {
  await page.goto('/');
  await openAdventure(page, 'Caça a Brechas');
  await expect(page.getByRole('dialog', { name: 'Prólogo de Kairo' })).toBeVisible();
  const deck = await page.evaluate(() => {
    const save = NB.Save.get();
    const options = Object.values(NB.Cards.STARTER_DECKS).map(recipe =>
      recipe.cards ? recipe.cards.flatMap(id => [id, id]) : NB.Save.buildBalancedDeck(NB.Cards.STARTER_CARD_IDS));
    return {
      selected: save.starterDeck,
      hasShadows: save.unlockedCards.includes('unit_38'),
      hasOtherStarter: save.unlockedCards.includes('unit_37'),
      decks: options.map(cards => [
        cards.length, cards.filter(id => NB.Cards.CARD_DB[id].kind === 'unit').length,
        Math.max(...cards.map(id => cards.filter(other => other === id).length))
      ])
    };
  });
  expect(deck).toEqual({ selected: 'breach', hasShadows: true, hasOtherStarter: false, decks: [
    [20, 14, 2], [20, 14, 2], [20, 14, 2]
  ] });
  await page.reload();
  await openAdventure(page);
  await expect(page.locator('#starter-modal')).toBeHidden();
  await expect(page.locator('#prologue-modal')).toBeVisible();
  expect(await page.evaluate(() => NB.Save.getActiveDeck().filter(id => id === 'unit_38').length)).toBe(2);
});

test('selects an enemy for entry damage and lets direct unit damage remove a blocker', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    state.player.hand = [{ cardId: 'unit_37', uid: 701 }, { cardId: 'exploit_19', uid: 702 }];
    state.player.ram = 3;
    state.enemy.field = [
      NB.State.createFieldUnit('unit_03', 703, 'enemy'),
      NB.State.createFieldUnit('unit_37', 704, 'enemy'),
      null
    ];
    NB.UI.renderAll();
  });
  await page.locator('.hand-card').filter({ hasText: 'Sonda de Bancada' }).click();
  await page.getByRole('button', { name: 'Executar' }).click();
  await expect(page.getByRole('button', { name: 'Pular efeito' })).toBeVisible();
  await page.locator('.enemy-slot').nth(1).click();
  expect(await page.evaluate(() => NB.State.get().enemy.field.slice(0, 2).map(unit => unit.def))).toEqual([7, 1]);
  await page.locator('.hand-card').filter({ hasText: 'Curto de Placa' }).click();
  await page.getByRole('button', { name: 'Executar' }).click();
  await page.locator('.enemy-slot').nth(1).click();
  expect(await page.evaluate(() => {
    const state = NB.State.get();
    return [state.enemy.field[1], state.enemy.hp === state.enemy.maxHp, state.player.field[0].cardId];
  })).toEqual([null, true, 'unit_37']);
});

test('shows the illustrated prologue only when starting the adventure', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  const prologue = page.getByRole('dialog', { name: 'Prólogo de Kairo' });
  await expect(prologue).toBeHidden();
  await openAdventure(page);
  await expect(prologue).toBeVisible();
  const art = page.locator('#prologue-art');
  await expect.poll(() => art.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#prologue-text')).toContainText('Durante as enchentes');
  await page.getByRole('button', { name: 'Próximo quadro' }).click();
  await expect(page.locator('#prologue-text')).toContainText('Nina chamou pelo rádio');
  await page.getByRole('button', { name: 'Próximo quadro' }).click();
  await expect(page.locator('#prologue-text')).toContainText('sua assinatura ajudou a fazer');
  await page.getByRole('button', { name: 'Entrar em Baixa Luz' }).click();
  await page.reload();
  await openAdventure(page);
  await expect(prologue).toBeHidden();
  await expect(page.locator('#city-story')).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('#city-map [data-district="home"] .city-badge-clue')).toHaveCSS('animation-name', 'city-clue-pulse');
  const missionPin = page.locator('#city-map [data-district="home"] .city-place-icon');
  const haloAnimation = () => missionPin.evaluate(icon => getComputedStyle(icon, '::before').animationName);
  await expect.poll(haloAnimation).toBe('city-mission-halo');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(haloAnimation).toBe('none');
  await expect.poll(() => missionPin.evaluate(icon => getComputedStyle(icon, '::before').borderWidth)).toBe('2px');
  await page.locator('#city-story').click();
  await expect(page.getByRole('button', { name: 'Ir para Casa de Kairo' })).toBeVisible();
});

test('resumes suspended audio on a regular gesture and respects an explicit mute', async ({ page }) => {
  await page.goto('/?android=1');
  await openAdventure(page);
  await page.getByRole('button', { name: 'Próximo quadro' }).click();
  await expect.poll(() => page.evaluate(() => NB.Audio.ctx.state)).toBe('running');
  await page.evaluate(() => NB.Audio.ctx.suspend());
  await page.getByRole('button', { name: 'Quadro anterior' }).click();
  await expect.poll(() => page.evaluate(() => NB.Audio.ctx.state)).toBe('running');
  await page.locator('#prologue-close').click();
  await page.locator('#btn-title-sound').click();
  await page.reload();
  await openAdventure(page);
  await page.getByRole('button', { name: 'Próximo quadro' }).click();
  await page.locator('#prologue-close').click();
  await expect(page.locator('#btn-title-sound')).toHaveText('SOM: OFF');
  expect(await page.evaluate(() => NB.Audio.ctx)).toBeNull();
});

test('starts a neighborhood duel directly and preserves its card reward', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Ringue Baixa Tensão', exact: true }));
  await expect(page.getByRole('button', { name: 'Falar com Tuca' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Desafiar Dora' })).toBeVisible();
  await page.getByRole('button', { name: 'Desafiar Tuca' }).click();
  await page.evaluate(() => {
    NB.State.get().enemy.hp = 0;
    NB.State.checkWinCondition();
  });
  await expect(page.locator('#gameover-modal')).toContainText('VITÓRIA · +7 CRÉDITOS');
  await expect(page.locator('#go-clue-title')).toHaveText('CARTA CONQUISTADA');
  await page.reload();
  expect(await page.evaluate(() => NB.Save.get().city.residentWins)).toEqual([33]);
  expect(await page.evaluate(() => NB.Save.get().unlockedCards)).toContain('unit_21');
});

test('shows a distinct combat portrait for each neighborhood and urban duel opponent', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  const opponents = [
    ['Damião', 'kiosk', 'damiao'], ['Tuca', 'arena', 'tuca'], ['Dora', 'arena', 'dora'],
    ['Giba', 'depots', 'giba'], ['Aline', 'garage', 'aline'], ['Nanda', 'docks', 'nanda'],
    ['Nexo', 'terminal', 'nexo', 5 * 1440 + 8 * 60],
    ['Vagalume', 'square', 'vagalume', 8 * 60], ['Maré', 'ferry', 'mare', 2 * 1440 + 8 * 60],
    ['Rebite', 'depots', 'rebite', 4 * 1440 + 20 * 60],
    ['Sombra Curta', 'morroKitchen', 'sombra-curta', 20 * 60],
    ['Contraluz', 'theatre', 'contraluz', 2 * 1440 + 20 * 60]
  ];
  for (const [name, district, filename, minute] of opponents) {
    await page.evaluate(({ district, minute }) => {
      const save = NB.Save.get();
      save.city.district = district;
      save.city.life.minute = minute ?? 8 * 60;
      NB.Input.openNetMap();
    }, { district, minute });
    if (name === 'Aline') {
      const contact = page.locator('.city-contact > summary');
      await expect(contact.locator('img')).toHaveAttribute('src', './avatars/aline.webp');
      await contact.click();
    }
    const fight = page.getByRole('button', { name: `Desafiar ${name}${minute ? ' · encontro urbano' : ''}`, exact: true });
    if (name !== 'Aline') await expect(fight.locator('img')).toHaveAttribute('src', `./avatars/${filename}.webp`);
    await fight.click();
    const path = `./avatars/${filename}.webp`;
    const portrait = page.locator(`#enemy-avatar-box img[src="${path}"]`);
    await expect(portrait).toBeVisible();
    await expect.poll(() => portrait.evaluate(img => img.naturalWidth)).toBe(320);
    await expect.poll(() => page.evaluate(path => NB.Save.get().seenArt.includes(path), path)).toBe(true);
  }
});

test('archives only displayed artwork and reopens full art with its description after reload', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  const before = () => page.evaluate(() => NB.Save.get().seenArt);
  await expect.poll(before).toContain('./src/assets/baixa-luz-cover.webp');
  expect(await before()).not.toContain('./src/assets/prologo-oficina.webp');
  await openAdventure(page);
  await expect.poll(before).toContain('./src/assets/prologo-oficina.webp');
  expect(await before()).not.toContain('./src/assets/prologo-estacao.webp');
  expect(await before()).not.toContain('./avatars/kira.png');
  await page.getByRole('button', { name: 'Próximo quadro' }).click();
  await expect.poll(before).toContain('./src/assets/prologo-estacao.webp');

  await page.reload();
  await page.locator('#btn-title-gallery').click();
  const gallery = page.getByRole('dialog', { name: 'Galeria' });
  await expect(gallery.getByRole('button', { name: 'A chave ainda serve' })).toHaveCount(0);
  await gallery.getByRole('button', { name: 'A noite em que o rádio calou' }).click();
  await expect(gallery.locator('#gallery-description')).toContainText('Nina chamou pelo rádio');
  const full = gallery.locator('#gallery-full-art img');
  await expect(full).toHaveAttribute('src', './src/assets/prologo-estacao.webp');
  await expect(full).toHaveCSS('object-fit', 'contain');

  expect(await page.evaluate(() => NB.Input.handleBack())).toBe(true);
  await expect(gallery.locator('#gallery-grid')).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'A noite em que o rádio calou' })).toBeFocused();
  expect(await page.evaluate(() => NB.Input.handleBack())).toBe(true);
  await expect(gallery).toBeHidden();
  await expect(page.locator('#btn-title-gallery')).toBeFocused();
  await enterCity(page);
  await expect.poll(before).toContain('./src/assets/baixa-luz-map.webp');
  await expect(page.getByRole('navigation', { name: 'Navegação da cidade' }).getByRole('button', { name: 'Galeria' })).toHaveCount(0);
  await page.locator('#btn-netmap-settings').click();
  await page.getByRole('button', { name: 'Voltar ao início' }).click();
  await page.locator('#btn-title-gallery').click();
  await gallery.getByLabel('Categoria').selectOption('scenes');
  await expect(gallery.getByRole('button', { name: 'Mapa de Baixa Luz' })).toBeVisible();
  await expect(gallery.getByRole('button', { name: /Kira · contrabandista/ })).toHaveCount(0);
  await gallery.getByLabel('Categoria').selectOption('cards');
  await expect(gallery.getByRole('region', { name: 'Cenas e locais' })).toHaveCount(0);
  await expect(gallery.getByRole('region', { name: 'Cartas' }).getByRole('button', { name: 'Aegis-Wall' })).toBeVisible();
});

test('offers starter cards immediately and keeps each kind of artwork in its own gallery section', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-title-gallery').click();
  const gallery = page.getByRole('dialog', { name: 'Galeria' });
  const cards = gallery.getByRole('region', { name: 'Cartas', exact: true });
  const count = await page.evaluate(() => NB.Cards.STARTER_CARD_IDS.length);
  await expect(cards.getByRole('button')).toHaveCount(count);
  await cards.getByRole('button', { name: 'Aegis-Wall' }).click();
  await expect(gallery.locator('#gallery-full-art img[src="./cards/unit_03.webp"]')).toBeVisible();
  await gallery.getByRole('button', { name: 'Voltar à galeria' }).click();
  await expect(cards.getByRole('button', { name: 'Aegis-Wall' })).toBeFocused();
  await gallery.getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.evaluate(() => NB.Input.startMatch({ mode: 'quick' }));
  await expect.poll(() => page.evaluate(() => NB.Save.get().seenArt)).toContain('./avatars/kira.png');
  await page.reload();
  await page.locator('#btn-title-gallery').click();
  await expect(gallery.getByRole('region', { name: 'Retratos' }).getByRole('button', { name: /Kira/ })).toBeVisible();
  await expect(gallery.getByRole('region', { name: 'Cenas e locais' }).getByRole('button', { name: 'Baixa Luz sob a chuva' })).toBeVisible();
  await expect(cards.getByRole('button')).toHaveCount(count);
});

test('counts card images in view without archiving offscreen or locked collection previews', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await page.locator('#btn-title-deck').click();
  const seen = source => page.evaluate(file => NB.Save.get().seenArt.includes(file), source);
  await expect.poll(() => seen('./cards/unit_01.webp')).toBe(true);
  expect(await seen('./cards/exploit_18.webp')).toBe(false);
  await page.getByRole('searchbox', { name: 'Buscar cartas' }).fill('Escudo de Emergência');
  await expect(page.getByRole('button', { name: 'Escudo de Emergência · bloqueada' })).toBeVisible();
  expect(await seen('./cards/exploit_18.webp')).toBe(false);
  await page.getByRole('button', { name: 'Escudo de Emergência · bloqueada' }).click();
  await expect(page.locator('#card-inspector-modal')).toBeHidden();
  expect(await seen('./cards/exploit_18.webp')).toBe(false);
  await page.evaluate(() => {
    NB.Save.get().unlockedCards.push('exploit_18');
    NB.Save.save();
    NB.DeckBuilder.renderAll();
  });
  await page.getByRole('button', { name: 'Escudo de Emergência', exact: true }).click();
  await expect.poll(() => seen('./cards/exploit_18.webp')).toBe(true);
  await page.locator('#btn-insp-close').click();
  await page.locator('#btn-deck-close').click();
  await page.locator('#btn-title-gallery').click();
  const thumbnail = page.getByRole('button', { name: 'Escudo de Emergência', exact: true }).locator('img');
  await expect.poll(() => thumbnail.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
});

test('keeps city navigation in place when reading investigation or district details', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await enterCity(page);
  const nav = page.getByRole('navigation', { name: 'Navegação da cidade' });
  const expectedPosition = await nav.boundingBox();
  expect(await nav.getByRole('button', { name: 'Investigação' }).evaluate(button => button.scrollWidth <= button.clientWidth)).toBe(true);
  await nav.getByRole('button', { name: 'Investigação' }).click();
  await expect(page.getByRole('button', { name: 'Ir para Casa de Kairo' })).toBeInViewport();
  expect(await nav.boundingBox()).toEqual(expectedPosition);
  await nav.getByRole('button', { name: 'Mapa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Estação Fantasma' })).toBeInViewport();
  expect(await nav.boundingBox()).toEqual(expectedPosition);
});

test('cancels or abandons a city duel and charges no additional fee on a stake', async ({ page }) => {
  await page.goto('/');
  await enterCity(page, { legacy: true });
  await page.getByRole('button', { name: 'Abrir dossiê' }).click();
  await page.getByRole('button', { name: 'Conectar e duelar' }).click();
  await page.getByRole('button', { name: 'Sair do duelo', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Abandonar duelo?' });
  await expect(dialog).toContainText('Você perde 3 créditos.');
  expect(await page.evaluate(() => NB.Input.handleBack())).toBe(true);
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => NB.Save.get().city.credits)).toBe(35);
  await page.getByRole('button', { name: 'Sair do duelo', exact: true }).click();
  await dialog.getByRole('button', { name: 'Abandonar duelo', exact: true }).click();
  await expect(page.locator('#city-feedback')).toContainText('Você abandonou o duelo e perdeu 3 créditos.');
  await expect(page.locator('#city-credits')).toHaveText('32 créditos');
  expect(await page.evaluate(() => [NB.Save.get().matches, NB.Save.get().wins])).toEqual([1, 0]);

  await page.evaluate(() => NB.Save.recordBossVictory(NB.Campaign.getNodeById('kira')));
  await walkTo(page, page.getByRole('button', { name: 'Ringue Baixa Tensão', exact: true }));
  const beforeStake = await page.evaluate(() => NB.Save.get().city.credits);
  await page.getByRole('button', { name: 'Apostar 25 · vitória paga 60' }).click();
  await page.getByRole('button', { name: 'Sair do duelo', exact: true }).click();
  await expect(dialog).toContainText('A aposta de 25 créditos fica com o Ringue.');
  await dialog.getByRole('button', { name: 'Abandonar duelo', exact: true }).click();
  await expect(page.locator('#city-credits')).toHaveText(`${beforeStake - 25} créditos`);
});

test('warns before a trip that drains the last energy and sleeps at the destination', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => {
    Math.random = () => 0.9;
    NB.Save.get().city.life.energy = 4;
  });
  await page.getByRole('button', { name: 'Casa de Kairo', exact: true }).click();
  const bus = page.locator('.city-life-row').filter({ has: page.getByRole('button', { name: 'Ônibus', exact: true }) });
  await expect(bus).toContainText('Energia ao chegar: 0/100');
  await expect(bus).toContainText('Você vai dormir em casa ao chegar');
  await bus.getByRole('button').click();
  await expect(page.locator('#city-feedback')).toContainText('Destino alcançado: Casa de Kairo. Você chegou no limite e dormiu em casa.');
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 16:17 · Dia');
  await expect(page.locator('#city-credits')).toHaveText('31 créditos');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
});

test('returns to the title after abandoning a quick duel at no cost', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Duelo rápido' }).click();
  await page.getByRole('button', { name: 'Sair do duelo' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Nenhum crédito será cobrado.');
  await dialog.getByRole('button', { name: 'Abandonar duelo', exact: true }).click();
  await expect(page.locator('#title-modal')).toBeVisible();
  expect(await page.evaluate(() => [NB.Save.get().city.credits, NB.Save.get().matches])).toEqual([35, 1]);
  await page.getByRole('button', { name: 'Duelo rápido' }).click();
  await page.getByRole('button', { name: 'Sair do duelo' }).click();
  await page.evaluate(() => {
    NB.State.get().enemy.hp = 0;
    NB.State.checkWinCondition();
  });
  await expect(dialog).toBeHidden();
  await expect(page.locator('#gameover-modal')).toBeVisible();
  expect(await page.evaluate(() => [NB.Save.get().matches, NB.Save.get().wins])).toEqual([2, 1]);
});

test('resonates on deployment and uses attack resonance without changing printed ATK', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    NB.Input.startMatch({ mode: 'quick' });
    NB.State.wait = async () => true;
    const state = NB.State.get();
    const { player, enemy } = state;
    const unit = (id, uid) => NB.State.createFieldUnit(id, uid, 'player');
    player.field = [unit('unit_03', 901), null, null];
    player.hand = [{ cardId: 'unit_28', uid: 902 }];
    NB.State.deployUnit('player', 902, 1);
    const charged = player.field[1].def;
    player.field = [unit('unit_05', 903), unit('unit_30', 904), null];
    player.field[1].booting = false;
    enemy.field = [null, null, null];
    const before = enemy.hp;
    await NB.Combat.resolveCombatSequence('player', [1], {});
    const power = NB.CardEffects.attackPower(player.field[1], [player.field[1]]);
    return [charged, before - enemy.hp, player.field[1].atk, power];
  });
  expect(result).toEqual([5, 4, 3, 3]);
});

test('recycles only eligible discarded cards and varredura draws extra on a matching top', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const { player } = NB.State.get();
    player.ram = 10;
    player.hand = [{ cardId: 'exploit_12', uid: 900 }, { cardId: 'exploit_13', uid: 901 }];
    player.discard = [{ cardId: 'unit_08', uid: 902 }, { cardId: 'unit_03', uid: 903 }, { cardId: 'exploit_01', uid: 904 }];
    player.deck = [{ cardId: 'unit_04', uid: 905 }, { cardId: 'unit_05', uid: 906 }];
    NB.State.executeExploit('player', 900);
    const recycled = player.hand.some(item => item.uid === 903) && !player.discard.some(item => item.uid === 903);
    NB.State.executeExploit('player', 901);
    const drawn = player.hand.map(item => item.uid);
    player.hand = [{ cardId: 'exploit_13', uid: 907 }];
    player.deck = [{ cardId: 'unit_05', uid: 908 }, { cardId: 'unit_04', uid: 909 }];
    NB.State.executeExploit('player', 907);
    return { recycled, drawn, nonmatch: player.hand.map(item => item.uid), remaining: player.deck.length };
  });
  expect(result).toEqual({ recycled: true, drawn: [903, 906, 905], nonmatch: [909], remaining: 1 });
});

test('offers accessible standard and encrypted signals with independent rewards and costs', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.clock.install();
  const before = await page.evaluate(() => ({ ...NB.Save.get().city.life }));
  for (const [name, length, reveal] of [['Sinal Padrão', 4, 4000], ['Sinal Criptografado', 6, 3500]]) {
    await page.getByRole('button', { name, exact: true }).click();
    const symbols = await page.locator('.city-sequence span').allTextContents();
    expect(symbols).toHaveLength(length);
    await page.clock.fastForward(reveal);
    await expect(page.locator('.city-sequence span')).toHaveText(Array(length).fill('·'));
    for (const symbol of symbols) await page.getByRole('button', { name: symbol, exact: true }).click();
  }
  const after = await page.evaluate(() => NB.Save.get().city);
  expect([after.credits, after.life.minute - before.minute, before.energy - after.life.energy]).toEqual([69, 75, 13]);
  expect(after.life.dailyJobCounts).toEqual({ signal: 1, encrypted: 1 });
});

test('persists daily demand, halves the third job payout, and resets after sleeping or midnight', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => { NB.Save.get().city.district = 'depots'; NB.City.resetView(); });
  const task = page.getByRole('button', { name: 'Triagem de Sucata', exact: true });
  await task.click();
  await task.click();
  await expect(page.getByText(/3ª execução · recompensa pela metade/)).toBeVisible();
  await page.reload();
  await enterCity(page);
  await task.click();
  await expect(page.locator('#city-credits')).toHaveText('67 créditos');
  await expect(task).toBeDisabled();
  await expect(task.locator('..')).toContainText('Demanda esgotada por hoje');
  const reset = await page.evaluate(() => {
    const { city } = NB.Save.get();
    city.district = 'home';
    NB.CityLife.sleep('home');
    const slept = NB.CityLife.demand('scrap').count;
    city.district = 'depots';
    NB.CityLife.work('scrap');
    NB.CityLife.advance(1440 - city.life.minute % 1440, 0);
    return [slept, NB.CityLife.demand('scrap').count];
  });
  expect(reset).toEqual([0, 0]);
});

test('persists one Correio Expresso package and awards the speed bonus after ordinary travel', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => { Math.random = () => 0; NB.Save.get().city.life.vehicles.push('motorbike'); });
  await page.getByRole('button', { name: 'Iniciar Correio Expresso' }).click();
  const listing = await page.evaluate(() => {
    const { activeDelivery } = NB.Save.get().city.life;
    const place = NB.CityData.districts.find(location => location.id === activeDelivery.targetId);
    return { ...activeDelivery, name: place.name };
  });
  expect(listing.distance).toBeGreaterThanOrEqual(4);
  await page.reload();
  await enterCity(page);
  await expect(page.getByRole('button', { name: 'Iniciar Correio Expresso' })).toHaveCount(0);
  await page.getByRole('button', { name: `Ir para ${listing.name} (entrega)` }).click();
  await page.evaluate(() => { Math.random = () => 0.99; });
  await page.getByRole('button', { name: 'Moto', exact: true }).click();
  await expect(page.locator('#city-feedback')).toContainText('bônus de velocidade: +7');
  await expect(page.locator('#city-credits')).toHaveText(`${35 + 6 + 2 * listing.distance + 7} créditos`);
  expect(await page.evaluate(() => NB.Save.get().city.life.activeDelivery)).toBeNull();
});

test('keeps a main objective visible when a delivery ends at its location', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => {
    const save = NB.Save.get();
    save.story = NB.Story.normalize({ started: true, chapter: 1, flags: ['invoice'] });
    save.city.district = 'kira';
    save.city.life.activeDelivery = { startMinute: save.city.life.minute, targetId: 'terminal', distance: 6 };
    NB.Input.openNetMap();
  });
  await walkTo(page, page.getByRole('button', { name: 'Ir para Terminal da Estação (entrega)' }), 0);
  await expect(page.locator('#city-feedback')).toContainText('Entrega concluída');
  const objective = page.getByRole('button', { name: 'Ler o itinerário de Mara' });
  await expect(objective).toBeDisabled();
  await expect(page.locator('.city-story-section')).toContainText('Resolva a abordagem');
  await page.getByRole('button', { name: /Desistir · perder/ }).click();
  await expect(objective).toBeEnabled();
  await expect(objective).toBeFocused();
  await objective.click();
  await expect(page.getByRole('dialog', { name: 'Ler o itinerário de Mara' })).toBeVisible();
  await page.locator('#btn-story-close').click();

  await page.locator('#city-story').click();
  await expect(page.locator('#city-content')).toContainText('Terminal da Estação · Mara');
  await page.getByRole('button', { name: 'Missões secundárias' }).click();
  await expect(page.locator('.city-mission-entry').filter({ hasText: 'Correio Expresso' })).toContainText('na última entrega · Terminal da Estação');
  await expect(page.locator('.city-mission-entry').filter({ hasText: 'Acordo das Rotas' })).toContainText('Terminal da Estação · Mara');

  await page.evaluate(() => {
    NB.Save.get().city.life.minute = 20 * 60;
    NB.City.resetView();
  });
  await expect(page.locator('.city-story-section')).toContainText('Mara está no Terminal das 6h às 19h');
  await expect(objective).toHaveCount(0);
});

test('filters pins by story, duels and actionable secrets on the same map', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  const home = page.locator('[data-district="home"]');
  const arena = page.locator('[data-district="arena"]');
  const pump = page.locator('[data-district="pump"]');
  const filter = page.getByRole('group', { name: 'Filtros e legenda do mapa' });
  await expect(home).toHaveAttribute('data-markers', 'clue');
  await expect(arena).toHaveAttribute('data-markers', 'duel');
  await expect(pump).toHaveAttribute('data-markers', 'secret');
  await filter.getByRole('button', { name: 'Pistas' }).click();
  await expect(home).toBeVisible();
  await expect(arena).toBeHidden();
  await page.getByRole('button', { name: 'Bairros', exact: true }).click();
  const neighborhood = page.getByRole('combobox', { name: 'Bairro no mapa' });
  await neighborhood.selectOption('viaduto');
  await expect(home).toBeVisible();
  await neighborhood.selectOption('tensao');
  await filter.getByRole('button', { name: 'Duelos' }).click();
  await expect(arena).toBeVisible();
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await filter.getByRole('button', { name: 'Segredos' }).click();
  await expect(pump).toBeVisible();
  await expect(home).toBeHidden();
  await filter.getByRole('button', { name: 'Pistas' }).click();
  await home.click();
  await expect(page.locator('#city-content')).toContainText('Ao chegar: Testar o leitor e a chave');
});

test('migrates an open legacy favor and shows the Archon warning before unlocking the confrontation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('neon_breach_save_v1', JSON.stringify({
      prologueSeen: true, city: { district: 'vex', credits: 35 },
      story: { started: true, chapter: 4, flags: ['vexDeal', 'vexAlt'], choices: { vexDeal: 'witness' } }
    }));
  });
  await page.goto('/');
  await enterCity(page);
  await expect(page.getByRole('button', { name: 'Apresentar a conferência testemunhada a Vex' })).toBeVisible();
  expect(await page.evaluate(() => NB.Story.has('vexStub'))).toBe(true);
  await page.evaluate(() => {
    const save = NB.Save.get();
    save.city.district = 'archon';
    save.story.chapter = 5;
    save.story.flags.push('protocol');
    NB.City.resetView();
  });
  await expect(page.locator('#city-content')).toContainText('duelo obrigatório');
  await expect(page.getByRole('button', { name: 'Confrontar Archon com os documentos' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Investigação', exact: true }).click();
  await expect(page.locator('#city-content')).toContainText('baralho de 20 cartas');
  await page.getByRole('button', { name: 'Confirmar preparação para a Torre' }).click();
  await page.getByRole('button', { name: 'Registrar e sair' }).click();
  await expect(page.getByRole('button', { name: 'Confrontar Archon com os documentos' })).toBeVisible();
});

test('applies the three pacifist card effects and validates the tracker affinity', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const state = NB.State.get();
    state.player.ram = 6;
    const create = (id, uid, side) => NB.State.createFieldUnit(id, uid, side);
    state.player.field = [create('unit_03', 800, 'player'), create('unit_08', 801, 'player'), null];
    state.enemy.field = [create('unit_01', 802, 'enemy'), create('unit_07', 803, 'enemy'), null];
    state.player.hand = [{ cardId: 'exploit_15', uid: 804 }, { cardId: 'exploit_16', uid: 805 }, { cardId: 'unit_31', uid: 806 }];
    state.player.field[0].def -= 4;
    const before = [state.player.field[0].def, state.player.field[0].maxDef, state.player.field[1].atk, state.enemy.field[1].atk];
    const wrongAffinity = NB.State.executeExploit('player', 804, 0);
    const tracker = NB.State.executeExploit('player', 804, 1);
    const filter = NB.State.executeExploit('player', 805, 0);
    const audit = NB.State.deployUnit('player', 806, 2);
    return {
      wrongAffinity, tracker, filter, audit,
      delta: [state.player.field[0].def - before[0], state.player.field[0].maxDef - before[1],
        state.player.field[1].atk - before[2], state.enemy.field[1].atk - before[3]]
    };
  });
  expect(result).toEqual({ wrongAffinity: false, tracker: true, filter: true, audit: true, delta: [4, 1, 1, -1] });
});

test('opens the Meridiano interception immediately after the Muralha proof', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neon_breach_save_v1', JSON.stringify({
    prologueSeen: true, defeatedBosses: ['cipher'], city: { district: 'cipher' },
    story: { started: true, chapter: 3, flags: ['cipherDeal'] }
  })));
  await page.goto('/');
  await enterCity(page);
  await page.getByRole('button', { name: 'Registrar as duas versões da ordem' }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar e sair' }).click();
  const call = page.getByRole('dialog', { name: 'Interceptação de Rádio' });
  await expect(call).toBeVisible();
  await call.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(call).toContainText('Holding Meridiano');
  expect(await page.evaluate(() => NB.Story.get().chapter)).toBe(3);
  for (let pageNumber = 0; pageNumber < 2; pageNumber++) {
    await call.getByRole('button', { name: 'Continuar', exact: true }).click();
  }
  await call.getByRole('button', { name: 'Registrar e sair' }).click();
  await expect(page.locator('[data-district="pension"]')).toHaveAttribute('data-markers', /clue/);
});

test('gives Kira only one recovery and starts the final Eclipse battle at 18 HP with Cipher', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neon_breach_save_v1', JSON.stringify({
    prologueSeen: true, city: { district: 'archon', life: { energy: 75 } },
    story: { started: true, chapter: 5, flags: ['protocol'], allies: { kira: true, cipher: true, vex: false } }
  })));
  await page.goto('/');
  await enterCity(page);
  await page.getByRole('button', { name: 'Confirmar preparação para a Torre' }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.locator('#story-line')).toContainText('Os drones');
  await page.getByRole('button', { name: 'Registrar e sair' }).click();
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '85');
  await page.getByRole('button', { name: 'Confrontar Archon com os documentos' }).click();
  const confrontation = page.getByRole('dialog', { name: 'Confrontar Archon com os documentos' });
  const next = confrontation.getByRole('button', { name: 'Continuar', exact: true });
  while (await next.isVisible()) await next.click();
  await confrontation.getByRole('button', { name: 'Conectar e duelar' }).click();
  await expect(page.locator('#dossier-modal')).toBeHidden();
  await expect(page.locator('#enemy-hp-text')).toHaveText('18/18 HP');
  await expect(page.locator('#enemy-interference')).toHaveText('Interferência de Cipher: Firewall primário desativado');
  const comparison = await page.evaluate(() => {
    const boss = NB.Campaign.getNodeById('archon');
    NB.Save.get().newGamePlus = true;
    NB.Input.startMatch({ mode: 'quick', boss });
    const quick = NB.State.get().enemy.hp;
    NB.Story.get().allies.cipher = false;
    NB.Input.startMatch({ mode: 'campaign', boss });
    return [quick, NB.State.get().enemy.hp, NB.Save.get().city.life.energy];
  });
  expect(comparison).toEqual([20, 20, 85]);
});

test('applies Nair solidarity at the counter and preserves Helena’s evidence across each ending', async ({ page }) => {
  await page.goto('/');
  const outcomes = await page.evaluate(() => {
    const save = NB.Save.get();
    save.story = NB.Story.normalize({
      started: true, chapter: 2, flags: ['outages', 'vexProof'], evidence: ['vexPeace']
    });
    NB.Story.remember('tellingNair', 1);
    NB.Story.finish('tellingNair', 'tell');
    const discounts = [];
    for (const place of ['market', 'kiosk']) {
      save.city.district = place;
      const before = save.city.credits;
      NB.CityLife.buy('energyDrink');
      discounts.push(before - save.city.credits);
    }
    const endings = ['publish', 'council', 'settle'].map(id => {
      save.story.choices.ending = id;
      return NB.Story.getLines(NB.Story.sceneById.epilogue).find(line => line.includes('Holding Meridiano'));
    });
    return { discounts, endings, nairTruthEarly: save.story.nairTruthEarly, vex: save.story.allies.vex };
  });
  expect(outcomes).toMatchObject({ discounts: [7, 7], nairTruthEarly: true, vex: true });
  expect(outcomes.endings.every(line => line.includes('Helena'))).toBe(true);
  expect(new Set(outcomes.endings).size).toBe(3);

  for (const [location, chapter, flag, scene, reply] of [
    ['vex', 4, 'reservation', 'Negociar acesso à ordem original', 'Perguntar quanto vale uma testemunha'],
    ['archon', 5, 'archonReady', 'Confrontar Archon com os documentos', 'Perguntar quanto vale uma rua no balanço']
  ]) {
    await page.evaluate(({ location, chapter, flag }) => {
      const save = NB.Save.get();
      save.city.district = location;
      save.story = NB.Story.normalize({ started: true, chapter, flags: [flag], choices: { tellingNair: 'check' } });
      NB.Input.openNetMap();
    }, { location, chapter, flag });
    await page.getByRole('button', { name: scene, exact: true }).click();
    const reader = page.getByRole('dialog', { name: scene });
    const next = reader.getByRole('button', { name: 'Continuar', exact: true });
    while (await next.isVisible()) await next.click();
    const aside = reader.getByRole('button', { name: reply });
    await expect(aside).toBeVisible();
    await aside.click();
    await expect(reader.locator('#story-options').getByText(/^Kairo —/)).toBeVisible();
    await reader.getByRole('button', { name: 'VOLTAR', exact: true }).click();
  }
});

test('shows and archives the speaker portrait in early and late investigation scenes', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  for (const [id, name, filename] of [['guard', 'Severino', 'severino'], ['renan', 'Renan', 'renan']]) {
    const title = await page.evaluate(({ id, name }) => {
      const scene = NB.Story.sceneById[id];
      const index = scene.lines.findIndex(line => line.startsWith(name + ' —'));
      const save = NB.Save.get();
      save.story = NB.Story.normalize({ started: true, chapter: scene.chapter, flags: scene.requires, read: { [id]: index } });
      save.city.district = scene.location;
      NB.Input.openNetMap();
      return scene.title;
    }, { id, name });
    await page.getByRole('button', { name: title, exact: true }).click();
    const path = `./avatars/${filename}.webp`;
    const portrait = page.locator(`#story-comic .comic-panel--active .comic-speaker img[src="${path}"]`);
    await expect(portrait).toBeVisible();
    await expect.poll(() => portrait.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(path => NB.Save.get().seenArt.includes(path), path)).toBe(true);
    await page.locator('#btn-story-close').click();
  }
});

test('reveals and saves comic beats with tactile key, wipe and radio controls', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await openAdventure(page);
  await page.locator('#prologue-comic .comic-panel--active').click();
  await expect(page.locator('#prologue-page')).toHaveText('2 / 3');
  await expect(page.locator('#prologue-comic .comic-panel--past')).toHaveCount(1);
  await expect(page.locator('#prologue-comic .comic-sfx')).toHaveCount(0);
  await page.reload();
  await openAdventure(page);
  await expect(page.locator('#prologue-page')).toHaveText('2 / 3');
  await page.getByRole('button', { name: 'Pular prólogo' }).click();
  await walkTo(page, page.locator('[data-district="home"]'));
  await page.getByRole('button', { name: 'Testar o leitor e a chave' }).click();
  const next = page.getByRole('button', { name: 'Continuar', exact: true });
  await expect(next).toBeDisabled();
  await expect(page.locator('#story-art')).toHaveAttribute('src', './src/assets/comic/leitor-da-porta.webp');
  await expect.poll(() => page.evaluate(() => NB.Save.get().seenArt)).toContain('./src/assets/comic/leitor-da-porta.webp');
  await page.getByRole('button', { name: 'Testar a chave no leitor' }).tap();
  await expect(page.locator('.comic-panel--active .comic-sfx')).toHaveText('BIP-BIP');
  await expect(next).toBeEnabled();
  await expect(page.locator('#story-line')).toBeVisible();
  await next.click();
  await expect(page.locator('#story-comic .comic-panel--past')).toHaveCount(1);
  await page.getByRole('button', { name: 'Registrar e sair' }).click();

  await page.getByRole('button', { name: 'Ler as faturas com Dona Nair' }).click();
  for (let i = 0; i < 3; i++) await next.click();
  await expect(page.locator('#story-comic .comic-panel--past')).toHaveCount(3);
  await expect(next).toBeDisabled();
  const receipt = page.locator('#story-comic .comic-panel--active .comic-art');
  await expect(page.locator('#story-art')).toHaveAttribute('src', './src/assets/comic/recibo-molhado.webp');
  await receipt.scrollIntoViewIfNeeded();
  const box = await receipt.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 24);
  await page.mouse.down();
  await page.mouse.move(box.x + 58, box.y + 24, { steps: 4 });
  await page.mouse.up();
  await expect(next).toBeEnabled();
  await page.reload();
  await enterCity(page);
  await page.getByRole('button', { name: 'Ler as faturas com Dona Nair' }).click();
  await expect(page.locator('#story-page')).toContainText('4 /');
  await expect(next).toBeEnabled();
  while (await next.isVisible()) await next.click();
  await page.getByRole('button', { name: 'Registrar e sair' }).click();

  await walkTo(page, page.locator('[data-district="relay"]'));
  await page.getByRole('button', { name: 'Levar a cópia do recibo à Antena' }).click();
  await expect(next).toBeDisabled();
  await expect(page.locator('#story-art')).toHaveAttribute('src', './src/assets/comic/radio-da-antena.webp');
  await page.getByRole('slider', { name: 'Sintonizar o rádio de Nina' }).fill('64');
  await expect(next).toBeEnabled();
});

test('shows both sides of the duel history and keeps removed cards out of recycling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto('/');
  await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick' });
    const { player, enemy } = NB.State.get();
    player.ram = 10;
    player.hand = [{ cardId: 'unit_01', uid: 901 }, { cardId: 'exploit_03', uid: 902 }];
    enemy.hand = [{ cardId: 'unit_03', uid: 903 }];
    NB.State.deployUnit('player', 901, 0);
    NB.State.deployUnit('enemy', 903, 0);
    NB.State.executeExploit('player', 902, 0);
    enemy.field[1] = NB.State.createFieldUnit('unit_04', 904, 'enemy');
    NB.State.destroyUnit('enemy', 1, true);
    enemy.deck = [{ cardId: 'unit_02', uid: 905 }];
    NB.UI.renderAll();
  });

  await page.locator('#btn-duel-log').click();
  const log = page.getByRole('dialog', { name: 'Histórico do duelo' });
  const cards = log.locator('#duel-log-grid');
  await expect(cards.getByRole('button')).toHaveText(['Kill-Switch · T1', 'Kuroi-01 · T1']);
  await log.getByRole('button', { name: 'Descarte (1)', exact: true }).click();
  await expect(cards.getByRole('button')).toHaveText(['Kill-Switch']);

  await log.getByRole('button', { name: 'Adversário', exact: true }).click();
  await expect(cards.getByRole('button')).toHaveText(['Ghost-Runner']);
  await log.getByRole('button', { name: 'Usadas (1)', exact: true }).click();
  await expect(cards.getByRole('button')).toHaveText(['Aegis-Wall · T1']);
  await log.getByRole('button', { name: 'Removidas (1)', exact: true }).click();
  await cards.getByRole('button', { name: 'Aegis-Wall', exact: true }).click();
  await expect(log.getByRole('heading', { name: 'Aegis-Wall' })).toBeVisible();
  await expect(log.locator('#duel-log-stats')).toContainText('7 DEF');
  await log.getByRole('button', { name: 'Voltar às cartas' }).click();
  await expect(cards.getByRole('button', { name: 'Aegis-Wall', exact: true })).toBeFocused();
  await log.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(log).toBeHidden();

  const drawn = await page.evaluate(() => {
    const cards = Array.from({ length: 3 }, () => NB.State.drawCard('enemy')?.cardId ?? null);
    NB.State.get().enemy.hp = 0;
    NB.State.checkWinCondition();
    return cards;
  });
  expect(drawn).toEqual(['unit_02', 'unit_04', null]);
  await page.locator('#btn-result-log').click();
  await log.getByRole('button', { name: 'Adversário', exact: true }).click();
  await log.getByRole('button', { name: 'Removidas (1)', exact: true }).click();
  await expect(cards.getByRole('button')).toHaveText(['Aegis-Wall']);
});

for (const [id, decision, proof, alternative] of [
  ['kira', 'Disputar a cópia em duelo', 'Registrar a prova da Estação', 'Seguir a cadeia de Beto e Leila'],
  ['cipher', 'Disputar o acesso no terminal', 'Registrar as duas versões da ordem', 'Pedir a extração isolada a Raquel'],
  ['vex', 'Disputar a entrega em duelo', 'Ler a ordem original com Vex', 'Preparar a entrega com Cris e Bia']
]) {
  test(`starts ${id}'s story duel from the decision and keeps the route after abandoning`, async ({ page }) => {
    await page.goto('/');
    await enterCity(page);
    const title = await page.evaluate(id => {
      const scene = NB.Story.sceneById[id + 'Deal'];
      const save = NB.Save.get();
      save.city.district = id;
      save.story = NB.Story.normalize({ started: true, chapter: scene.chapter, flags: scene.requires });
      NB.Input.openNetMap();
      return scene.title;
    }, id);
    await page.getByRole('button', { name: title, exact: true }).click();
    const scene = page.getByRole('dialog', { name: title });
    const next = scene.getByRole('button', { name: 'Continuar', exact: true });
    while (await next.isVisible()) await next.click();
    await scene.getByRole('button', { name: decision, exact: true }).click();
    await expect(page.locator('#netmap-modal')).toBeHidden();
    await expect(page.locator('#dossier-modal')).toBeHidden();
    expect(await page.evaluate(() => [NB.State.get().mode, NB.State.get().boss.id])).toEqual(['campaign', id]);

    await page.getByRole('button', { name: 'Sair do duelo' }).click();
    await page.getByRole('button', { name: 'Abandonar duelo', exact: true }).click();
    await page.reload();
    await enterCity(page);
    await expect(page.getByRole('button', { name: alternative, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: title, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: proof, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Duelar pela investigação', exact: true }).click();
    expect(await page.evaluate(() => NB.State.get().boss.id)).toBe(id);
    await page.evaluate(() => {
      NB.State.get().enemy.hp = 0;
      NB.State.checkWinCondition();
    });
    await page.locator('#btn-go-primary').click();
    await expect(page.getByRole('button', { name: proof, exact: true })).toBeVisible();
  });
}

test('builds progressively different encounter decks and gates late card purchases', async ({ page }) => {
  await page.goto('/');
  const decks = await page.evaluate(() => [0, 2, 5].map(chapter => NB.CityLife.travelDeck(chapter, true)));
  expect(decks.map(deck => deck.deckList.length)).toEqual([20, 20, 20]);
  expect(decks.map(deck => deck.canOverclock)).toEqual([false, false, true]);
  expect(decks[0].deckList).not.toEqual(decks[1].deckList);
  expect(decks[2].deckList).toContain('unit_13');

  await enterCity(page);
  await page.evaluate(() => {
    NB.Save.get().city.district = 'market';
    NB.Input.openNetMap();
  });
  await page.getByRole('button', { name: 'Ver cartas à venda' }).click();
  await expect(page.getByText('Malware-Rex', { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    NB.Story.get().chapter = 5;
    NB.City.resetView();
  });
  await page.getByRole('button', { name: 'Ver cartas à venda' }).click();
  await expect(page.getByText('Malware-Rex', { exact: true })).toBeVisible();
});

test('offers a tougher optional travel opponent to an equipped late-game deck', async ({ page }) => {
  await page.goto('/');
  const encounter = await page.evaluate(() => {
    const save = NB.Save.get();
    const units = ['unit_07', 'unit_10', 'unit_14'];
    save.story.chapter = 5;
    save.city.district = 'kira';
    save.city.life.routePact = 3;
    save.city.life.ownedDecks.push('backbone');
    save.city.life.equippedDeck = 'backbone';
    save.unlockedCards.push(...units);
    save.customDeck = NB.Save.buildBalancedDeck(save.unlockedCards, units.flatMap(id => [id, id]));
    const random = Math.random;
    Math.random = () => 0;
    try {
      NB.CityLife.travel('market', 'walk');
    } finally {
      Math.random = random;
    }
    return NB.CityLife.getTravelChallenge();
  });
  expect(encounter).toMatchObject({ label: 'Elite · Especialista', hp: 24, reward: 28, optional: true });
  await page.reload();
  expect(await page.evaluate(() => NB.CityLife.getTravelChallenge()?.label)).toBe('Elite · Especialista');
  expect(await page.evaluate(() => NB.CityLife.requiredTravelChallenge())).toBeNull();
});

test('adds one damage to unblocked Overclock for both sides without stacking affinity', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    NB.State.wait = async () => true;
    NB.AI.startEnemyTurn = () => {};
    const run = async (side, affinity, blocked) => {
      const target = side === 'player' ? 'enemy' : 'player';
      NB.State.reset({ mode: 'quick', boss: NB.Campaign.NODES[0], openingSide: 'player' });
      const state = NB.State.get();
      const unit = id => ({ ...NB.State.createFieldUnit(id, 1, side), atk: 4, def: 12, booting: false });
      state[side].field = [{ ...unit('unit_01'), affinity: 'pulso' }, { ...unit('unit_01'), affinity }, null];
      state[target].field = [blocked ? { ...unit('unit_03'), atk: 0, def: 5 } : null, null, null];
      const hp = state[target].hp;
      if (side === 'player') {
        state.player.ram = 3;
        state.phase = 'PLAYER_OVERCLOCK';
        state.overclockUnits = [0, 1];
        await NB.Combat.executeOverclockAttack();
      } else {
        state.enemyOverclock = { slots: [0, 1], combinedAtk: 8 };
        NB.Combat.preparePlayerDefense([0]);
        await NB.Combat.confirmPlayerDefense();
      }
      return hp - state[target].hp;
    };
    return [
      await run('player', 'sombra', false), await run('enemy', 'pulso', false),
      await run('player', 'pulso', true), await run('enemy', 'sombra', true)
    ];
  });
  expect(result).toEqual([9, 9, 3, 4]);
});

test('resolves rare Overclock roles and registers power for the entire catalog', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    NB.State.wait = async () => true;
    NB.AI.startEnemyTurn = () => {};
    NB.State.reset({ mode: 'quick', boss: NB.Campaign.NODES[0], openingSide: 'player' });
    const state = NB.State.get();
    const play = async (leader, partner, blockerDef) => {
      const unit = (id, uid) => ({ ...NB.State.createFieldUnit(id, uid, 'player'), booting: false });
      state.player.field = [unit(leader, 1), unit(partner, 2), null];
      state.enemy.field = blockerDef ? [{ ...unit('unit_03', 3), atk: 4, def: blockerDef }, null, null] : [null, null, null];
      state.player.ram = 3;
      state.overclockUnits = [0, 1];
      state.phase = 'PLAYER_OVERCLOCK';
      await NB.Combat.executeOverclockAttack();
    };
    await play('unit_39', 'unit_40', 10);
    const shieldAndGuard = [state.player.field[0].def, NB.Combat.canBlock(state.player.field[1], state.player)];
    NB.Input.startPlayerTurn();
    const cleared = state.player.field[1].overclockGuard;
    await play('unit_41', 'unit_40', 5);
    const refund = state.player.ram;
    await play('unit_41', 'unit_40', 5);
    const secondRefund = state.player.ram;
    state.player.ram = 4;
    state.player.hand = [{ cardId: 'exploit_20', uid: 20 }];
    const cast = NB.State.executeExploit('player', 20);
    await play('unit_39', 'unit_37', 5);
    const consumedAndDestroyed = !state.player.overclockCoupler && !state.enemy.field[0];
    const values = Object.keys(NB.Cards.CARD_DB).every(id => Number.isFinite(NB.CardPower.byId[id]?.total));
    return { shieldAndGuard, cleared, refund, secondRefund, cast, consumedAndDestroyed, values };
  });
  expect(result).toEqual({
    shieldAndGuard: [3, true], cleared: false, refund: 1, secondRefund: 0, cast: true,
    consumedAndDestroyed: true, values: true
  });
});

test('charges the bus pass fare, uses a trip, and restores the ordinary fare on expiration', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const save = NB.Save.get();
    save.city.district = 'kira';
    const before = save.city.credits;
    NB.CityCommerce.buyPass();
    const random = Math.random;
    Math.random = () => 0.99;
    try {
      NB.CityLife.travel('market', 'bus');
    } finally {
      Math.random = random;
    }
    const charged = before - save.city.credits;
    const pass = NB.CityCommerce.activePass();
    save.city.life.minute = pass.until;
    return [charged, pass.trips, NB.CityLife.routes('kira').find(route => route.id === 'bus').fare];
  });
  expect(result).toEqual([13, 5, 4]);
});

test('replaces a travel duel with a persistent merchant and grants the mission discount once', async ({ page }) => {
  await page.goto('/');
  const offer = await page.evaluate(() => {
    const save = NB.Save.get();
    save.city.district = 'kira';
    save.story.chapter = 3;
    save.city.credits = 200;
    const rolls = [0, 0.94];
    const random = Math.random;
    Math.random = () => rolls.shift() ?? 0;
    try {
      NB.CityLife.travel('garage', 'walk');
    } finally {
      Math.random = random;
    }
    return [NB.CityCommerce.offer(), NB.CityLife.getTravelChallenge()];
  });
  expect(offer[0]).toMatchObject({ kind: 'gear', destination: 'garage' });
  expect(offer[0].stock).toContain('tram');
  expect(offer[1]).toBeNull();
  await page.reload();
  const outcome = await page.evaluate(() => {
    const save = NB.Save.get();
    const initial = NB.CityCommerce.price('gear', 'tram');
    const fee = NB.CityCommerce.finishMission('gear', false);
    const victory = NB.CityCommerce.finishMission('gear', true);
    const repeat = NB.CityCommerce.finishMission('gear', true);
    const discounted = NB.CityCommerce.price('gear', 'tram');
    const purchased = NB.CityCommerce.buyOffer('tram');
    NB.State.reset({ mode: 'quick', openingSide: 'player' });
    const { player } = NB.State.get();
    return [initial, fee, victory, repeat, discounted, purchased, player.ram, NB.Combat.overclockCost(player), save.city.credits];
  });
  expect(outcome).toEqual([155, expect.stringContaining('3 créditos'), expect.stringContaining('10%'), '', 140, true, 1, 2, 72]);
});

test('settles a reloaded card wager as a loss and lets Risco return the same card once', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const save = NB.Save.get();
    save.city.district = 'arena';
    save.defeatedBosses.push('kira');
    save.unlockedCards.push('unit_33');
    save.customDeck = NB.Save.buildBalancedDeck(save.unlockedCards, ['unit_33', 'unit_33']);
    NB.Input.openNetMap();
  });
  await page.getByRole('button', { name: 'Apostar Estilhaço de Pulso' }).click();
  await page.getByRole('button', { name: 'Confirmar aposta em carta' }).click();
  await expect(page.locator('#netmap-modal')).toBeHidden();
  await page.reload();
  const outcome = await page.evaluate(() => {
    const save = NB.Save.get();
    const lost = save.city.life.commerce.lost;
    const hasLost = save.unlockedCards.includes(lost) || NB.Save.getActiveDeck().includes(lost);
    save.city.life.minute += 1440;
    const random = Math.random;
    Math.random = () => 0;
    let proposal;
    try {
      proposal = NB.CityCommerce.wager();
    } finally {
      Math.random = random;
    }
    const accepted = NB.CityCommerce.beginWager(null);
    const recovered = NB.CityCommerce.finishWager(true);
    const duplicate = NB.CityCommerce.finishWager(true);
    return { lost, hasLost, proposal, accepted, recovered, duplicate, count: save.unlockedCards.filter(id => id === lost).length };
  });
  expect(outcome).toEqual({
    lost: 'unit_33', hasLost: false, proposal: { prize: 'unit_33', stakes: [], fee: 12 },
    accepted: true, recovered: expect.stringContaining('Estilhaço de Pulso'), duplicate: '', count: 1
  });
});

test('redirects all of the Overclock counterattack to the escort on either side', async ({ page }) => {
  await page.goto('/');
  const outcome = await page.evaluate(async () => {
    NB.State.wait = async () => true;
    NB.AI.startEnemyTurn = () => {};
    const results = [];
    for (const side of ['player', 'enemy']) {
      NB.Input.startMatch({ mode: 'quick', boss: NB.Campaign.NODES[0] });
      const state = NB.State.get();
      const other = side === 'player' ? 'enemy' : 'player';
      const made = (id, uid) => ({ ...NB.State.createFieldUnit(id, uid, side), booting: false });
      const leader = { ...made('unit_07', 1), def: 2 };
      state[side].field = [leader, made('unit_42', 2), null];
      state[other].field = [{ ...made('unit_03', 3), atk: 5, def: 5 }, null, null];
      const hp = state[other].hp;
      if (side === 'player') {
        state.player.ram = 3;
        state.overclockUnits = [0, 1];
        state.phase = 'PLAYER_OVERCLOCK';
        await NB.Combat.executeOverclockAttack();
      } else {
        state.enemyOverclock = { slots: [0, 1], combinedAtk: 7 };
        NB.Combat.preparePlayerDefense([0]);
        await NB.Combat.confirmPlayerDefense();
      }
      results.push([leader.def, state[side].field[1], hp - state[other].hp,
        state[side].impacts.some(event => event.detail.includes('Escolta protegeu a líder'))]);
    }
    return results;
  });
  expect(outcome).toEqual([[2, null, 3, true], [2, null, 3, true]]);
});

test('keeps combat bonuses readable and archives them in the effects history', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(async () => {
    NB.Input.startMatch({ mode: 'quick', boss: NB.Campaign.NODES[0] });
    NB.State.wait = async () => true;
    const state = NB.State.get();
    state.player.field[0] = { ...NB.State.createFieldUnit('unit_04', 1, 'player'), booting: false };
    state.enemy.field[0] = { ...NB.State.createFieldUnit('unit_05', 2, 'enemy'), def: 8 };
    await NB.Combat.resolveCombatSequence('player', [0], { 0: 0 });
    state.phase = 'PLAYER_MAIN';
    NB.UI.renderAll();
  });
  const impact = page.locator('.float-impact').filter({ hasText: '+1 Sombra' });
  await page.clock.fastForward(1800);
  await expect(impact).toContainText('−4 DEF');
  await page.clock.fastForward(1300);
  await expect(impact).toHaveCount(0);
  await page.locator('#btn-duel-log').click();
  await page.getByRole('button', { name: 'Adversário', exact: true }).click();
  await page.getByRole('button', { name: /Efeitos/ }).click();
  await expect(page.locator('#duel-log-grid')).toContainText('−4 DEF · +1 Sombra');
});

test('applies the expansion effects and assigns a finite power value to all eighty cards', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    NB.Input.startMatch({ mode: 'quick', boss: NB.Campaign.NODES[0] });
    const { player, enemy } = NB.State.get();
    const target = NB.State.createFieldUnit('unit_03', 12, 'enemy');
    enemy.field[0] = target;
    player.ram = 12;
    player.hand = ['exploit_21', 'exploit_22', 'exploit_22', 'exploit_23'].map((cardId, uid) => ({ cardId, uid }));
    NB.State.executeExploit('player', 0, 0);
    const wasLocked = !NB.Combat.canBlock(target, enemy);
    NB.State.executeExploit('player', 1, 0);
    const firstDamage = target.def;
    NB.State.executeExploit('player', 2, 0);
    enemy.hpShield = 4;
    const hp = enemy.hp;
    NB.State.executeExploit('player', 3);
    return [wasLocked, firstDamage, target.def, hp - enemy.hp, enemy.hpShield,
      Object.values(NB.CardPower.byId).filter(value => Number.isFinite(value.total)).length];
  });
  expect(result).toEqual([true, 5, 1, 2, 0, 80]);
});

test('continues an existing adventure or resets it only after confirmation', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.evaluate(() => {
    const save = NB.Save.get();
    save.city.credits = 94;
    save.city.district = 'market';
    save.unlockedCards.push('unit_43');
    save.defeatedBosses.push('kira');
    NB.Save.save();
    NB.Input.openTitleScreen();
  });
  const start = page.locator('#btn-start-campaign');
  await start.click();
  await page.getByRole('button', { name: 'Recomeçar do zero' }).click();
  const warning = page.getByRole('dialog', { name: 'Recomeçar do zero?' });
  await expect(warning).toContainText('Todo o progresso será apagado');
  await warning.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Continuar do save' }).click();
  await expect(page.locator('#city-credits')).toContainText('94 créditos');
  await page.evaluate(() => NB.Input.openTitleScreen());
  await start.click();
  await page.getByRole('button', { name: 'Recomeçar do zero' }).click();
  await warning.getByRole('button', { name: 'Apagar progresso e recomeçar' }).click();
  await expect(page.getByRole('dialog', { name: 'Escolha seu deck inicial' })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.neon_breach_save_v1));
  expect(saved).toMatchObject({ starterDeck: null, prologueSeen: false, defeatedBosses: [], city: { credits: 35, district: 'kira' } });
  expect(saved.unlockedCards).not.toContain('unit_43');
  await page.getByRole('button', { name: 'Escolher Equilibrado' }).click();
  await expect(page.getByRole('dialog', { name: 'Prólogo de Kairo' })).toBeVisible();
});
