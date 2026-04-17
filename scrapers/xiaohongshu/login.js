'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSION_DIR = path.join(os.homedir(), '.xiaohongshu-review');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');
const CREATOR_HOME = 'https://creator.xiaohongshu.com/';

async function login() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });

  let storageState = null;
  if (fs.existsSync(SESSION_FILE)) {
    try {
      storageState = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      console.log('[xhs-login] Found saved session, trying to reuse it...');
    } catch {
      console.log('[xhs-login] Saved session is invalid, falling back to interactive login');
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
    viewport: { width: 1440, height: 900 },
    ...(storageState ? { storageState } : {}),
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  await page.goto(CREATOR_HOME, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  if (!(await checkLoginState(page))) {
    console.log('[xhs-login] Waiting for creator platform login confirmation...');
    await waitForLoginSuccess(page, 180_000);
  } else {
    console.log('[xhs-login] Session is valid, already logged in');
  }

  const state = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
  console.log('[xhs-login] Session saved');

  return { browser, page };
}

async function checkLoginState(page) {
  const url = page.url();
  if (!url.includes('creator.xiaohongshu.com')) return false;
  if (url.includes('/login')) return false;

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const looksLikeLoginPage = /短信登录|发送验证码|验证码登录|手机号登录/.test(bodyText);
  return !looksLikeLoginPage;
}

async function waitForLoginSuccess(page, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await checkLoginState(page)) {
      return true;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Xiaohongshu login timed out. Final URL: ${page.url()}`);
}

module.exports = { login };
