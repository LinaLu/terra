import { test, expect } from '@playwright/test';

test.describe('Dynamic Columns', () => {
  test('user can add a custom column to a board', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Create a new board
    const boardName = 'Test Board ' + Date.now();
    await page.getByPlaceholder('Enter board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();

    // Click the board link to go to the board page
    await page.getByRole('link', { name: boardName }).click();

    // Verify we are on the board page
    await expect(page.getByRole('heading', { name: boardName })).toBeVisible();

    // Check default columns are not present
    await expect(page.getByRole('heading', { name: 'Good' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bad' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Actions' })).not.toBeVisible();

    // Add a new custom column
    await page.getByRole('button', { name: '+ Add a column' }).click();
    await page.getByPlaceholder('Column name').fill('Questions');
    await page.getByRole('button', { name: 'Add column' }).click();

    // Verify the new column appears
    await expect(page.getByRole('heading', { name: 'Questions' })).toBeVisible();
    
    // In our DOM structure, we can have nested divs, so filtering by 'div' might match parents too.
    // Instead, we will look for the specific elements and use first()
    const addCardButton = page.getByRole('button', { name: '+ Add a card' }).first();
    await addCardButton.click();
    
    // We can just rely on the inputs that become visible. Since we clicked the 4th column's add button, 
    // there is only one "What's on your mind?" input visible.
    const cardInput = page.getByPlaceholder('What\'s on your mind?').first();
    await cardInput.fill('Is this working?');
    
    const authorInput = page.getByPlaceholder('Your name').first();
    await authorInput.fill('E2E Tester');
    
    const submitCardButton = page.getByRole('button', { name: 'Add card' }).first();
    await submitCardButton.click();
    
    // Verify the card is added
    await expect(page.getByText('Is this working?')).toBeVisible();
    await expect(page.getByText('E2E Tester')).toBeVisible();
  });
});
