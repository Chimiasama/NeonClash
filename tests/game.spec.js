import { expect, test } from '@playwright/test';

test('earns credits, buys a card, and keeps the purchase after reloading', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await page.getByRole('button', { name: 'Antena Comunitária' }).click();
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
  await page.getByRole('button', { name: 'Feira do Viaduto' }).click();
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
  await page.getByRole('button', { name: 'Antena Comunitária' }).click();
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
  await page.getByRole('button', { name: 'Antena Comunitária' }).click();
  await page.getByRole('button', { name: 'Rastrear pista' }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);

  const symbols = await page.locator('.city-sequence span').allTextContents();
  expect(symbols).toHaveLength(4);
  for (const symbol of symbols) {
    await page.getByRole('button', { name: symbol, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Muralha Setorial', exact: true }).click();
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
    await page.locator(`[data-district="${district}"]`).click();
    await expect(portrait).toHaveAttribute('src', `./avatars/${filename}`);
    await expect.poll(() => portrait.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  }
});

test('starts a campaign duel, deploys a unit, and advances the turn', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await page.getByRole('button', { name: 'Muralha Setorial · bloqueado' }).click();
  await expect(page.getByText('Vença KIRA para abrir este local.')).toBeVisible();
  await page.getByRole('button', { name: 'Estação Fantasma' }).click();
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
    await page.locator(`[data-district="${district}"]`).click();
    await expect.poll(readScene).toBe(theme);
  }

  await page.locator('[data-district="kira"]').click();
  await page.getByRole('button', { name: 'Abrir dossiê' }).click();
  await page.getByRole('button', { name: 'Conectar e duelar' }).click();
  await expect.poll(readScene).toBe('kira');
  expect(await page.evaluate(() => NB.Audio.battle)).toBe(true);

  await page.locator('#btn-sound').click();
  await page.reload();
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  expect(await page.evaluate(() => NB.Audio.enabled)).toBe(false);
});
