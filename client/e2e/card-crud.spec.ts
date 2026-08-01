import { test, expect } from '@playwright/test';

test('card CRUD operations: create, update, delete', async ({ page }) => {
  // 1. Go to homepage
  await page.goto('/');

  // Unique per run: a static name would collide with a board (and joined
  // "Test Author" user) left behind by a previous suite run against the
  // same persistent database, leaving the Join Board modal stuck open and
  // blocking every click below.
  const boardName = `CRUD Test Board ${Date.now()}`;

  // 2. Create a new board using the "Basic Retro" template (Went Well / To Improve / Action Items)
  await page.fill('input[placeholder="Enter board name"]', boardName);
  await page.getByLabel(/Basic Retro/).check();
  await page.click('button:has-text("Create Board")');

  // Click on the newly created board in the board list
  await page.getByRole('link', { name: boardName }).last().click();

  // Handle Join Board modal
  await expect(page.getByRole('heading', { name: 'Join ' + boardName })).toBeVisible({ timeout: 10000 });
  await page.fill('input[placeholder="Your name"]', 'Test Author');
  await page.click('button:has-text("Join Board")');

  // Wait for board page heading
  await expect(page.getByRole('heading', { name: boardName, exact: true })).toBeVisible({ timeout: 10000 });

  // Template already provided the "Went Well" column
  await expect(page.getByRole('heading', { name: 'Went Well' })).toBeVisible();

  // 3. Create a new card in the first column
  // Scoped to div.flex-1 (the column's own root element) rather than a bare
  // `div:has(h3)`, which also matches the outer flex wrapper around all
  // columns once the board has more than one column (template boards do).
  const firstColumn = page.locator('div.flex-1', { has: page.locator('h3', { hasText: 'Went Well' }) }).first();
  await firstColumn.getByRole('button', { name: '+ Add a card' }).click();
  await firstColumn.locator('textarea[placeholder="What\'s on your mind?"]').fill('Test card content');
  await firstColumn.getByRole('button', { name: 'Add card' }).click();

  // Verify card is created
  await expect(page.locator('p', { hasText: /^Test card content$/ })).toBeVisible();
  await expect(page.locator('span', { hasText: /^Test Author/ })).toBeVisible();

  // 4. Update the card
  await page.locator('button', { hasText: 'Edit' }).first().click();

  const editArea = page.locator('textarea').nth(0);
  await editArea.fill('Updated card content');
  await page.locator('button', { hasText: 'Save' }).first().click();

  // Verify card is updated
  await expect(page.locator('p', { hasText: /^Updated card content$/ })).toBeVisible();
  await expect(page.locator('p', { hasText: /^Test card content$/ })).not.toBeVisible();

  // 5. Delete the card
  page.once('dialog', dialog => dialog.accept());

  await page.locator('button', { hasText: 'Delete' }).first().click();

  // Verify card is deleted
  await expect(page.locator('p', { hasText: /^Updated card content$/ })).not.toBeVisible();
});
