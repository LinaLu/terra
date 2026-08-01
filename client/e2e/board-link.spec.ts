import { test, expect } from '@playwright/test';

test('generated share link opens the board instead of showing "expired or invalid"', async ({ page }) => {
  await page.goto('/');

  const boardName = `Share Link Board ${Date.now()}`;
  await page.fill('input[placeholder="Enter board name"]', boardName);
  await page.getByLabel(/Basic Retro/).check();
  await page.click('button:has-text("Create Board")');

  const boardRow = page.locator('li').filter({ has: page.getByRole('link', { name: boardName }) });
  await boardRow.getByRole('button', { name: 'Generate link' }).click();

  const shareUrl = await boardRow.locator('code').textContent();
  const shareLink = new URL(shareUrl!.trim());

  await page.goto(shareLink.pathname);

  await expect(page.getByRole('heading', { name: boardName, exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('You are viewing this board via a shared link.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This link has expired or is invalid' })).toHaveCount(0);
});
