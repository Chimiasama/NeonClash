import { expect, test } from '@playwright/test';

async function walkTo(page, pin) {
  await pin.click();
  const walking = page.getByRole('button', { name: 'A pé', exact: true });
  if (await walking.isVisible()) await walking.click();
}

async function enterCity(page, { legacy = false } = {}) {
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Comprar · 45' }).click();
  await expect(page.locator('#city-credits')).toHaveText('12 créditos');

  await page.reload();
  await enterCity(page);
  await expect(page.getByRole('heading', { name: 'Feira do Viaduto' })).toBeVisible();
  await expect(page.locator('#city-credits')).toHaveText('12 créditos');
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

test('previews locked cards without making them available to edit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Meu Deck/i }).click();
  await page.getByRole('button', { name: 'Bastion-Core · bloqueada' }).click();
  const inspector = page.getByRole('dialog', { name: 'BASTION-CORE' });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText(/Derrote CIPHER/);
  await expect(inspector.locator('.inspector-deck-controls')).toBeHidden();
  await inspector.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByRole('button', { name: 'Bastion-Core · bloqueada' })).toBeFocused();
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

  await walkTo(page, page.getByRole('button', { name: 'Estação Fantasma' }));
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
    state.pendingExploit = { targetSide: 'enemy', cardId: 'exploit_03' };
    NB.UI.renderAll();
  });
  expect(await back()).toBe(true);
  expect(await page.evaluate(() => NB.State.get().pendingExploit)).toBeNull();

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
  await page.getByText('Melhorar cartas', { exact: true }).click();
  await units.click();
  await expect(recalibrate).toBeDisabled();
  await affinities.selectOption('sombra');
  await expect(page.locator('.workshop-editor')).toContainText('dará +1 de dano contra Pulso');
  await recalibrate.click();
  await expect(page.locator('#city-credits')).toHaveText('20 créditos');
  await expect(page.locator('.city-workshop')).toContainText('Afinidade atual · ◆ Sombra');
  await page.reload();
  await enterCity(page);
  await page.getByText('Melhorar cartas', { exact: true }).click();
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
  await page.getByRole('button', { name: 'Comprar · 30' }).click();
  await expect(page.locator('#city-credits')).toHaveText('5 créditos');

  const outcome = await page.evaluate(async () => {
    NB.Input.startMatch({ mode: 'quick' });
    NB.State.wait = async () => true;
    const state = NB.State.get();
    const make = (id, uid) => ({ ...NB.State.createFieldUnit(id, uid), atk: 4, def: 14 });
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
  await page.getByRole('button', { name: 'Ônibus', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Casa de Kairo' })).toBeVisible();
  await expect(page.locator('#city-credits')).toHaveText('31 créditos');
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 08:17 · Dia');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '96');
  await page.getByRole('button', { name: 'Dormir · 8 h · Grátis' }).click();
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 16:17 · Dia');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
});

test('stores supplies and vehicles, restores the backpack and uses its contents', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Quiosque 24h' }));
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
  await page.getByRole('button', { name: 'Comprar · 100 créditos' }).click();
  await page.getByRole('button', { name: 'Comprar · 450 créditos' }).click();
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
  await expect(page.locator('#city-credits')).toHaveText('40 créditos');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '60');
  await page.getByRole('button', { name: 'Dormir · 7 h · 12 créditos' }).click();
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
  await expect(page.locator('#city-credits')).toHaveText('28 créditos');
  await walkTo(page, page.getByRole('button', { name: 'Hotel Espelho · bloqueado' }));
  await page.getByRole('button', { name: 'Dormir · 5 h · 26 créditos' }).click();
  await expect(page.locator('#city-credits')).toHaveText('2 créditos');
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

test('visits ten neighborhoods with residents and travel-backed locations', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await page.getByRole('button', { name: 'Bairros', exact: true }).click();
  await expect(page.locator('#city-content > details')).toHaveCount(10);
  await page.getByText('Morro das Casas', { exact: true }).click();
  await walkTo(page, page.getByRole('button', { name: 'Clínica do Morro', exact: true }));
  await expect(page.getByRole('heading', { name: 'Clínica do Morro' })).toBeVisible();
  await page.locator('#city-scene').evaluate(image => image.decode());
  await page.getByText('Pessoas neste local', { exact: true }).click();
  await expect(page.locator('#city-content')).toContainText('Omar');
  const roster = await page.evaluate(() => NB.CityAtlas.residents.reduce((counts, npc) => {
    counts[npc.role] = (counts[npc.role] || 0) + 1;
    return counts;
  }, {}));
  expect(roster).toEqual({ central: 12, contato: 28, morador: 60 });
});

test('resumes the prologue after reload and earns Kira’s proof by doing a favor', async ({ page }) => {
  test.setTimeout(90000);
  const investigation = () => page.getByRole('button', { name: 'Investigação', exact: true }).click();
  const read = async (title, last = 'Registrar e sair') => {
    await page.getByRole('button', { name: title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    const next = dialog.getByRole('button', { name: 'Continuar', exact: true });
    while (await next.isVisible()) await next.click();
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
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  await read('Conferir o recibo anonimizado com Beto');
  await walkTo(page, page.locator('[data-district="ringArchive"]'));
  await read('Cruzar o código do terminal com Leila');
  await walkTo(page, page.locator('[data-district="kira"]'));
  const beforeReward = await page.evaluate(() => NB.Save.get().city.credits);
  await read('Entregar o dossiê auditado a Kira');
  expect(await page.evaluate(() => NB.Save.get().city.credits)).toBe(beforeReward + 35);
  expect(await page.evaluate(() => NB.Save.get().unlockedCards)).toContain('exploit_15');
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
      aftermath: NB.Story.aftermath('square'), choice: NB.Story.choice('ending'),
      repeat: NB.Story.finish('epilogue') };
  });
  expect(result).toMatchObject({ complete: true, evidence: 15, choice: 'council', repeat: false });
  expect(result.aftermath).toContain('conselho');
});

test('opens ferry and bicycle shortcuts through local contacts', async ({ page }) => {
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
    city.district = 'garage';
    city.life.vehicles.push('bike');
    const long = NB.CityLife.routes('clinic').find(route => route.id === 'bike').minutes;
    NB.CityLife.helpContact('hillPath');
    const shortcut = NB.CityLife.routes('clinic').find(route => route.id === 'bike').minutes;
    return { before, helped, duplicate, ready, closed, long, shortcut, credits: city.credits };
  });
  expect(result).toMatchObject({ before: false, helped: true, duplicate: false, ready: true, closed: false, credits: 51 });
  expect(result.shortcut).toBeLessThan(result.long);
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
  await page.getByText('Desafios de arquétipo', { exact: true }).click();
  await page.getByRole('button', { name: 'Turno da Estação' }).click();

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
  await expect(page.locator('#defense-preview')).toHaveText('Sua posição 1 DEF 5→1 · Inimigo 2 DEF 5→3');
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

test('shows the illustrated prologue only when starting the adventure', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  const prologue = page.getByRole('dialog', { name: 'Prólogo de Kairo' });
  await expect(prologue).toBeHidden();
  await page.locator('#btn-start-campaign').click();
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
  await page.locator('#btn-start-campaign').click();
  await expect(prologue).toBeHidden();
  await expect(page.locator('#city-story')).toHaveClass('city-investigate');
  await page.locator('#city-story').click();
  await expect(page.getByRole('button', { name: 'Ir para Casa de Kairo' })).toBeVisible();
});

test('resumes suspended audio on a regular gesture and respects an explicit mute', async ({ page }) => {
  await page.goto('/?android=1');
  await page.locator('#btn-start-campaign').click();
  await page.getByRole('button', { name: 'Próximo quadro' }).click();
  await expect.poll(() => page.evaluate(() => NB.Audio.ctx.state)).toBe('running');
  await page.evaluate(() => NB.Audio.ctx.suspend());
  await page.getByRole('button', { name: 'Quadro anterior' }).click();
  await expect.poll(() => page.evaluate(() => NB.Audio.ctx.state)).toBe('running');
  await page.locator('#prologue-close').click();
  await page.locator('#btn-title-sound').click();
  await page.reload();
  await page.locator('#btn-start-campaign').click();
  await page.getByRole('button', { name: 'Próximo quadro' }).click();
  await page.locator('#prologue-close').click();
  await expect(page.locator('#btn-title-sound')).toHaveText('SOM: OFF');
  expect(await page.evaluate(() => NB.Audio.ctx)).toBeNull();
});

test('talks to residents and earns a card from a neighborhood duel', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  await walkTo(page, page.getByRole('button', { name: 'Ringue Baixa Tensão', exact: true }));
  await page.getByText('Pessoas neste local', { exact: true }).click();
  const talk = page.getByRole('button', { name: 'Falar com Tuca' });
  await talk.click();
  await expect(page.getByText('Pode testar seu baralho comigo.', { exact: false })).toBeVisible();
  await talk.click();
  await expect(page.getByText('olha quanta RAM sobra', { exact: false })).toBeVisible();
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

test('archives only displayed artwork and reopens full art with its description after reload', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  const before = () => page.evaluate(() => NB.Save.get().seenArt);
  await expect.poll(before).toContain('./src/assets/baixa-luz-cover.webp');
  expect(await before()).not.toContain('./src/assets/prologo-oficina.webp');
  await page.locator('#btn-start-campaign').click();
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
  await page.locator('#btn-city-gallery').click();
  await gallery.getByLabel('Categoria').selectOption('scenes');
  await expect(gallery.getByRole('button', { name: 'Mapa de Baixa Luz' })).toBeVisible();
  await expect(gallery.getByRole('button', { name: /Kira · contrabandista/ })).toHaveCount(0);
  await gallery.getByLabel('Categoria').selectOption('cards');
  await expect(gallery.locator('#gallery-empty')).toHaveText('Nenhuma arte vista nesta categoria.');
});

test('counts card images in view without archiving offscreen or locked collection previews', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await page.locator('#btn-title-deck').click();
  const seen = source => page.evaluate(file => NB.Save.get().seenArt.includes(file), source);
  await expect.poll(() => seen('./cards/unit_01.webp')).toBe(true);
  expect(await seen('./cards/exploit_11.webp')).toBe(false);
  await page.getByRole('searchbox', { name: 'Buscar cartas' }).fill('Ponte Dupla');
  await expect(page.getByRole('button', { name: 'Ponte Dupla · bloqueada' })).toBeVisible();
  expect(await seen('./cards/exploit_11.webp')).toBe(false);
  await page.getByRole('button', { name: 'Ponte Dupla · bloqueada' }).click();
  await expect.poll(() => seen('./cards/exploit_11.webp')).toBe(true);
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
  await page.getByRole('button', { name: 'Moto', exact: true }).click();
  await expect(page.locator('#city-feedback')).toContainText('bônus de velocidade: +7');
  await expect(page.locator('#city-credits')).toHaveText(`${35 + 6 + 2 * listing.distance + 7} créditos`);
  expect(await page.evaluate(() => NB.Save.get().city.life.activeDelivery)).toBeNull();
});

test('shows and filters story, duel and undiscovered-contact badges on both city surfaces', async ({ page }) => {
  await page.goto('/');
  await enterCity(page);
  const home = page.locator('[data-district="home"]');
  const arena = page.locator('[data-district="arena"]');
  const filter = page.getByRole('group', { name: 'Filtros e legenda do mapa' });
  await expect(home).toHaveAttribute('data-markers', 'clue secret');
  await expect(arena).toHaveAttribute('data-markers', 'duel secret');
  await expect(page.locator('[data-district="kira"]')).not.toHaveAttribute('data-markers', /duel/);
  await filter.getByRole('button', { name: 'Pistas' }).click();
  await expect(home).toBeVisible();
  await expect(arena).toBeHidden();
  await page.getByRole('button', { name: 'Bairros', exact: true }).click();
  await expect(page.locator('[data-atlas-place="home"]')).toHaveAttribute('data-markers', 'clue secret');
  await expect(page.locator('[data-atlas-place="arena"]')).toHaveCount(0);
  await filter.getByRole('button', { name: 'Duelos' }).click();
  await expect(page.locator('[data-atlas-place="arena"]')).toBeVisible();
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await filter.getByRole('button', { name: 'Segredos' }).click();
  await expect(home).toBeVisible();
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
