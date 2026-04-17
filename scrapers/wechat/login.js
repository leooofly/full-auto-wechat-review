'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSION_DIR = path.join(os.homedir(), '.wechat-review');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

/**
 * 微信公众号后台登录
 * - Playwright 启动 Chromium（headless: false，需扫码）
 * - 反检测 UserAgent
 * - Session 持久化
 * 
 * @returns {{ browser: Browser, page: Page, token: string }}
 */
async function login() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  // 尝试复用已有 session
  let storageState = null;
  if (fs.existsSync(SESSION_FILE)) {
    try {
      storageState = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      console.log('[login] 检测到已保存的 session，尝试复用...');
    } catch {
      console.log('[login] session 文件损坏，将重新登录');
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

  // 反检测：覆盖 navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  // 导航到公众号后台
  await page.goto('https://mp.weixin.qq.com/', { waitUntil: 'domcontentloaded' });

  // 检查是否已登录（session 有效）
  const isLoggedIn = await checkLoginState(page);

  if (!isLoggedIn) {
    console.log('[login] 需要扫码登录，请用微信扫描二维码...');

    // 等待扫码完成 — 检测跳转到后台首页
    await page.waitForURL('**/cgi-bin/home?*', { timeout: 120_000 });
    console.log('[login] 扫码登录成功！');
  } else {
    console.log('[login] Session 有效，已自动登录');
  }

  // 提取 token
  const token = extractToken(page.url());
  if (!token) {
    throw new Error('无法从 URL 提取 token，登录可能失败');
  }
  console.log(`[login] token: ${token}`);

  // 保存 session
  const newState = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(newState, null, 2));
  console.log('[login] Session 已保存');

  return { browser, page, token };
}

/**
 * 检查当前页面是否已处于登录状态
 */
async function checkLoginState(page) {
  try {
    // 等待短暂时间，看是否自动跳转到后台
    await page.waitForURL('**/cgi-bin/home?*', { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 URL 中提取 token 参数
 */
function extractToken(url) {
  const match = url.match(/token=(\d+)/);
  return match ? match[1] : null;
}

module.exports = { login };
