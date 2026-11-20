import { expect, test } from '@playwright/test';

test('earns credits, buys a card, and keeps the purchase after reloading', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar na cidade' }).click();
  await page.getByRole('button', { name: 'Antena Comunitária' }).click();
  await page.getByRole('button', { name: 'Trabalho de hacker' }).click();

  const symbols = await page.locator('.city-sequence span').allTextContents();
  expect(symbols).toHaveLength(4);
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
