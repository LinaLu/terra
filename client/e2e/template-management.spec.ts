import { test, expect } from '@playwright/test';

test('create a template, use it for a board, and verify columns are immutable', async ({ page }) => {
  const uniqueSuffix = Date.now();
  const templateName = `E2E Template ${uniqueSuffix}`;

  // Create a template with two columns
  await page.goto('/templates');
  await page.click('button:has-text("+ New Template")');
  await page.fill('input[placeholder="Template name"]', templateName);
  await page.fill('input[placeholder="Column 1 name"]', 'Alpha');
  await page.click('button:has-text("+ Add column")');
  await page.fill('input[placeholder="Column 2 name"]', 'Beta');
  await page.click('button:has-text("Save")');
  // Scope to this template's own list row: "Alpha, Beta" is not a unique
  // string once other templates (or earlier runs) also have columns named
  // Alpha/Beta, so a page-wide getByText match is ambiguous.
  const templateRow = page.locator('li').filter({ hasText: templateName });
  await expect(templateRow).toBeVisible();
  await expect(templateRow.getByText('Alpha, Beta')).toBeVisible();

  // Use it to create a board
  await page.goto('/');
  const boardName = `Template Board ${uniqueSuffix}`;
  await page.fill('input[placeholder="Enter board name"]', boardName);
  await page.getByLabel(new RegExp(templateName)).check();
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: boardName }).last().click();

  await expect(page.getByRole('heading', { name: 'Join ' + boardName })).toBeVisible();
  await page.fill('input[placeholder="Your name"]', 'Template Tester');
  await page.click('button:has-text("Join Board")');

  // Columns match the template
  await expect(page.getByRole('heading', { name: 'Alpha' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Beta' })).toBeVisible();

  // No way to add, rename, or delete a column exists on the board page
  await expect(page.getByRole('button', { name: '+ Add a column' })).toHaveCount(0);
  await expect(page.getByTitle('Rename column')).toHaveCount(0);
  await expect(page.getByTitle('Delete column')).toHaveCount(0);
});
