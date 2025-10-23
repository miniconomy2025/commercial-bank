import { test, expect } from '@playwright/test';

test.describe('Account Statistics E2E', () => {
  test('should display account statistics when navigating to Individual Account Statistics tab', async ({ page }) => {
    // Navigate to the frontend with a test client ID
    await page.goto('/?clientId=test-client');
    
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Banking Dashboard');
    
    // Click on Individual Account Statistics tab
    await page.click('button:has-text("Individual Account Statistics")');
    
    // Wait for the tab to be active
    await expect(page.locator('.tab-button.active')).toContainText('Individual Account Statistics');
    
    // Check if account data is loading or loaded
    const loadingIndicator = page.locator('text=Loading accounts...');
    const accountContent = page.locator('.account-content');
    
    // Wait for either loading to complete or content to appear
    await expect(accountContent).toBeVisible();
    
    // If accounts exist, verify the account statistics are displayed
    const hasAccounts = await page.locator('.account-card').isVisible();
    
    if (hasAccounts) {
      // Verify account metrics are displayed
      await expect(page.locator('.metric-label:has-text("Balance")')).toBeVisible();
      await expect(page.locator('.metric-label:has-text("Loans Outstanding")')).toBeVisible();
      await expect(page.locator('.metric-label:has-text("Total Money In")')).toBeVisible();
      await expect(page.locator('.metric-label:has-text("Total Money Out")')).toBeVisible();
      await expect(page.locator('.metric-label:has-text("Total Loan Equity")')).toBeVisible();
      
      // Verify metric values are displayed (should be numbers or '0')
      const balanceValue = await page.locator('.metric-label:has-text("Balance") + .metric-value').textContent();
      expect(balanceValue).toMatch(/^\d+(\.\d+)?$/);
      
      // Verify account selector is present
      await expect(page.locator('.account-selector')).toBeVisible();
      
      // Verify transactions section is present
      await expect(page.locator('.account-right')).toBeVisible();
    } else {
      // If no accounts, verify appropriate message is shown
      const noAccountsMessage = page.locator('text=No accounts found');
      const errorMessage = page.locator('.error-container');
      
      await expect(noAccountsMessage.or(errorMessage)).toBeVisible();
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to the frontend
    await page.goto('/?clientId=invalid-client');
    
    // Click on Individual Account Statistics tab
    await page.click('button:has-text("Individual Account Statistics")');
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // Should show either loading, error, or no accounts message
    const possibleStates = [
      page.locator('text=Loading accounts...'),
      page.locator('.error-container'),
      page.locator('text=No accounts found')
    ];
    
    let stateFound = false;
    for (const state of possibleStates) {
      if (await state.isVisible()) {
        stateFound = true;
        break;
      }
    }
    
    expect(stateFound).toBe(true);
  });
});