import { test, expect } from '@playwright/test';

test('card CRUD operations: create, update, delete', async ({ page }) => {
  // 1. Go to homepage
  await page.goto('/');

  // 2. Create a new board
  await page.fill('input[placeholder="Enter board name"]', 'CRUD Test Board');
  await page.click('button:has-text("Create Board")');

  // Click on the newly created board in the board list
  await page.getByRole('link', { name: 'CRUD Test Board' }).last().click();

  // Handle Join Board modal
  await expect(page.getByRole('heading', { name: 'Join CRUD Test Board' })).toBeVisible({ timeout: 10000 });
  await page.fill('input[placeholder="Your name"]', 'Test Author');
  await page.click('button:has-text("Join Board")');

  // Wait for board page heading
  await expect(page.getByRole('heading', { name: 'CRUD Test Board', exact: true })).toBeVisible({ timeout: 10000 });

  // Create a new column before adding cards since boards start empty
  await page.getByRole('button', { name: '+ Add a column' }).click();
  await page.getByPlaceholder('Column name').fill('Good');
  await page.getByRole('button', { name: 'Add column' }).click();
  await expect(page.getByRole('heading', { name: 'Good' })).toBeVisible();

  // 3. Create a new card in the first column
  const firstColumn = page.locator('div', { has: page.locator('h3', { hasText: 'Good' }) }).first();
  await firstColumn.getByRole('button', { name: '+ Add a card' }).click();
  await firstColumn.locator('textarea[placeholder="What\'s on your mind?"]').fill('Test card content');
  await firstColumn.getByRole('button', { name: 'Add card' }).click();

  // Verify card is created
  await expect(page.locator('p', { hasText: /^Test card content$/ })).toBeVisible();
  await expect(page.locator('span', { hasText: /^Test Author/ })).toBeVisible();

  console.log(await page.content());

  // 4. Update the card
  await page.locator('button', { hasText: 'Edit' }).first().click();
  
  // Fill in the new content
  const editArea = page.locator('textarea').nth(0);
  await editArea.fill('Updated card content');
  await page.locator('button', { hasText: 'Save' }).first().click();

  // Verify card is updated
  await expect(page.locator('p', { hasText: /^Updated card content$/ })).toBeVisible();
  await expect(page.locator('p', { hasText: /^Test card content$/ })).not.toBeVisible();

  // 5. Delete the card
  // Handle the confirmation dialog automatically
  page.once('dialog', dialog => dialog.accept());
  
  await page.locator('button', { hasText: 'Delete' }).first().click();

  // Verify card is deleted
  await expect(page.locator('p', { hasText: /^Updated card content$/ })).not.toBeVisible();
});
