'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSION_DIR = path.join(os.homedir(), '.wechat-review');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

async function login() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  let storageState = null;
  if (fs.existsSync(SESSION_FILE)) {
    try {
      storageState = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      console.log('[login] Found saved session, trying to reuse it...');
    } catch {
      console.log('[login] Saved session is invalid, falling back to QR login');
    }
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const context = await browser.newContext({
    userAgent,
    viewport: { width: 1440, height: 900 },
    ...(storageState ? { storageState } : {}),
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  await page.goto('https://mp.weixin.qq.com/', { waitUntil: 'domcontentloaded' });
  console.log(`[login] Current URL: ${page.url()}`);

  const isLoggedIn = await checkLoginState(page);

  if (!isLoggedIn) {
    console.log('[login] Waiting for QR login confirmation...');
    await waitForLoginSuccess(page, 120_000);
    console.log(`[login] Login detected, current URL: ${page.url()}`);
  } else {
    console.log('[login] Session is valid, already logged in');
  }

  const token = extractToken(page.url());
  if (!token) {
    throw new Error(`Could not extract token after login. Current URL: ${page.url()}`);
  }
  console.log(`[login] token: ${token}`);

  const newState = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(newState, null, 2));
  console.log('[login] Session saved');

  return { browser, page, token };
}

async function checkLoginState(page) {
  return hasBackendToken(page.url());
}

async function waitForLoginSuccess(page, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const currentUrl = page.url();
    if (hasBackendToken(currentUrl)) {
      return extractToken(currentUrl);
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Login timed out. Final URL: ${page.url()}`);
}

function hasBackendToken(url) {
  return typeof url === 'string'
    && url.includes('mp.weixin.qq.com')
    && url.includes('/cgi-bin/')
    && /token=\d+/.test(url);
}

function extractToken(url) {
  const match = url.match(/token=(\d+)/);
  return match ? match[1] : null;
}

module.exports = { login };
