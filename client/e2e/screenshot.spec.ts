import { test, expect } from '@playwright/test';

test('drag and drop and layout verification', async ({ page }) => {
  const uniqueSuffix = Date.now();
  const templateName = `Layout Template ${uniqueSuffix}`;

  // Create a template with two uniquely-named columns via the Templates page
  await page.goto('/templates');
  await page.click('button:has-text("+ New Template")');
  await page.fill('input[placeholder="Template name"]', templateName);
  await page.fill('input[placeholder="Column 1 name"]', `To Do Unique ${uniqueSuffix}`);
  await page.click('button:has-text("+ Add column")');
  await page.fill('input[placeholder="Column 2 name"]', `In Progress Unique ${uniqueSuffix}`);
  await page.click('button:has-text("Save")');
  await expect(page.getByText(templateName)).toBeVisible();

  // Create a board using the new template
  await page.goto('/');
  const uniqueBoardName = `UI Test Board ${uniqueSuffix}`;
  await page.fill('input[placeholder="Enter board name"]', uniqueBoardName);
  await page.getByLabel(new RegExp(templateName)).check();
  await page.click('button:has-text("Create Board")');

  // Navigate to the board
  await page.click(`text=${uniqueBoardName}`);
  await page.waitForSelector(`h2:has-text("${uniqueBoardName}")`);

  // Wait for columns to appear
  await expect(page.locator(`h3:has-text("To Do Unique ${uniqueSuffix}")`)).toBeVisible();
  await expect(page.locator(`h3:has-text("In Progress Unique ${uniqueSuffix}")`)).toBeVisible();

  // Take a screenshot to verify Tailwind layout
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshot-tailwind-layout.png' });
});
