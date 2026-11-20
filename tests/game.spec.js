import { expect, test } from '@playwright/test';

async function walkTo(page, pin) {
  await pin.click();
  const walking = page.getByRole('button', { name: 'A pé', exact: true });
  if (await walking.isVisible()) await walking.click();
}

test('earns credits, buys a card, and keeps the purchase after reloading', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.clock.install();
  await page.getByRole('button', { name: 'Trabalho de hacker' }).click();

  const symbols = await page.locator('.city-sequence span').allTextContents();
  expect(symbols).toHaveLength(6);
  await expect(page.locator('.city-sequence')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: symbols[0], exact: true })).toBeDisabled();
  await page.clock.fastForward(3500);
  await expect(page.locator('.city-sequence span')).toHaveText(Array(6).fill('·'));
  for (const symbol of symbols) {
    await page.getByRole('button', { name: symbol, exact: true }).click();
  }
  await expect(page.locator('#city-credits')).toHaveText('55 créditos');
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  await page.getByRole('button', { name: 'Comprar · 45' }).click();
  await expect(page.locator('#city-credits')).toHaveText('10 créditos');

  await page.reload();
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await expect(page.getByRole('heading', { name: 'Feira do Viaduto' })).toBeVisible();
  await expect(page.locator('#city-credits')).toHaveText('10 créditos');
  await expect(page.getByRole('button', { name: 'Adquirida' })).toBeDisabled();
});

test('penalizes wrong symbols and ends a paid job when time runs out', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.clock.install();
  const start = page.getByRole('button', { name: 'Trabalho de hacker' });
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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

  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  expect(await back()).toBe(false);
  await page.locator('#city-journal').click();
  expect(await back()).toBe(true);
  await expect(page.locator('#city-journal')).toHaveAttribute('aria-pressed', 'false');

  await walkTo(page, page.getByRole('button', { name: 'Antena Comunitária' }));
  await page.getByRole('button', { name: 'Trabalho de hacker' }).click();
  expect(await back()).toBe(true);
  await expect(page.getByRole('button', { name: 'Trabalho de hacker' })).toBeVisible();

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

  await expect(music).toHaveValue('100');
  await expect(effects).toHaveValue('100');
  await music.fill('0');
  await expect(music).toHaveAttribute('aria-valuetext', '0%');
  await expect.poll(() => gain('musicGain')).toBeLessThan(0.001);
  await expect.poll(() => gain('sfxGain')).toBeCloseTo(0.55, 2);
  await effects.fill('63');
  await expect(effects).toHaveAttribute('aria-valuetext', '63%');
  await expect.poll(() => gain('sfxGain')).toBeCloseTo(0.3465, 2);
  await expect.poll(() => gain('musicGain')).toBeLessThan(0.001);

  await page.reload();
  await page.locator('#btn-title-settings').click();
  await expect(music).toHaveValue('0');
  await expect(effects).toHaveValue('63');
  await page.locator('#btn-settings-sound').click();
  await expect.poll(() => gain('sfxGain')).toBeCloseTo(0.3465, 2);
  await expect.poll(() => gain('musicGain')).toBeLessThan(0.001);
});

test('renders the redesigned effects through the effects bus only', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-title-sound').click();
  const results = await page.evaluate(async () => {
    const audio = NB.Audio;
    audio.stopMusic();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await walkTo(page, page.getByRole('button', { name: 'Feira do Viaduto' }));
  const units = page.getByRole('combobox', { name: 'Unidade para recalibrar' });
  const affinities = page.getByRole('combobox', { name: 'Nova afinidade' });
  const recalibrate = page.getByRole('button', { name: 'Recalibrar · 15 créditos' });
  await units.selectOption('unit_03');
  await expect(recalibrate).toBeDisabled();
  await affinities.selectOption('sombra');
  await recalibrate.click();
  await expect(page.locator('#city-credits')).toHaveText('20 créditos');
  await expect(page.locator('.city-workshop')).toContainText('Afinidade atual · ◆ Sombra');
  await page.reload();
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await units.selectOption('unit_03');
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await walkTo(page, page.getByRole('button', { name: 'Quiosque 24h' }));
  await page.getByRole('button', { name: 'Comprar · 4 créditos', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
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
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await expect(page.getByRole('heading', { name: 'Feira do Viaduto' })).toBeVisible();
  await expect(page.locator('#city-credits')).toHaveText('87 créditos');
  await expect(page.locator('#city-clock')).toHaveText('Dia 1 · 08:00 · Dia');
  await expect(page.locator('#city-energy')).toHaveAttribute('value', '100');
  expect(await page.evaluate(() => NB.Save.get())).toMatchObject({
    defeatedBosses: ['kira'],
    clues: [{ bossId: 'kira', title: 'Pista salva' }],
    affinities: { unit_03: 'pulso' },
    city: { traced: ['kira'], life: { inventory: { coffee: 0, energyDrink: 0, synthetic: 0 } } }
  });
});
