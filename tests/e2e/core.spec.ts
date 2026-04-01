import { _electron as electron, ElectronApplication, Page } from 'playwright-core';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  delete process.env.ELECTRON_RUN_AS_NODE; // Fix execution bugs internally
  // Launch the application from the root build folder.
  const appPath = path.resolve(__dirname, '../..');
  electronApp = await electron.launch({ 
    args: [appPath],
    env: { ...process.env, CI: 'true' },
    timeout: 60000 
  });

  // Wait for the main window - skip the splash screen (which may be the firstWindow)
  // We identify it because it has a specific title or we wait for a certain duration
  const windows = await electronApp.windows();
  if (windows.length > 1) {
    // If multiple windows exist, pick the one that is NOT the splash (if possible)
    // Or just pick the last one opened which is usually the main window
    window = windows[windows.length - 1];
  } else {
    window = await electronApp.firstWindow();
  }
  
  // Ensure we wait for the page to be ready
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test.describe('Core Download Functionality Checks', () => {
  test('Validates input URL gracefully handles errors (Vibe-coded silent fail check)', async () => {
    // Look for URL input placeholder or explicitly labeled input
    const urlInput = window
      .locator('input[placeholder*="Paste video"], input[type="url"], input')
      .first();
    await urlInput.fill('https://www.youtube.com/watch?v=nonexistent_broken_id');

    // A human pass/smart agent clicks Download or presses Enter
    const downloadBtn = window.locator('button', { hasText: /download|analyze|fetch/i }).first();
    await downloadBtn.click();

    // Verify it doesn't fail silently. It should show an error message or toast somewhere.
    // yt-dlp will return 'Video unavailable' so we expect an error banner.
    const errorToast = window.locator('text=/unavailable|error|failed/i');
    await expect(errorToast).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Security & API Boundary Checks', () => {
  test('Rejects arbitrary Command Injection via malicious string', async () => {
    // Testing the BOLA / Injection handling
    const urlInput = window
      .locator('input[placeholder*="Paste video"], input[type="url"], input')
      .first();
    // Providing an option param to see if the UI safely escapes it
    await urlInput.fill('-o malicious_file.sh');

    const downloadBtn = window.locator('button', { hasText: /download|analyze|fetch/i }).first();
    await downloadBtn.click();

    // The system should correctly throw an error about the URL being invalid instead of allowing options execution
    const errorText = window.locator('text=/look like a valid URL|error/i');
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });
});

