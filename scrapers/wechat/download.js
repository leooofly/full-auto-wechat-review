'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DOWNLOAD_DIR = path.join(os.homedir(), '.wechat-review', 'downloads');

async function downloadData(page, token) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const articlesPath = await downloadArticles(page, token);
  const usersPath = await downloadUsers(page, token);

  return { articlesPath, usersPath };
}

async function downloadArticles(page, token) {
  console.log('[download] Opening content analysis page...');

  await page.goto(
    `https://mp.weixin.qq.com/misc/appmsganalysis?action=report&type=daily_v2&token=${token}&lang=zh_CN`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(3000);

  await selectDateRange(page, 30);
  const articlesPath = await triggerDownload(page, 'articles', '内容分析');

  console.log(`[download] Content analysis downloaded: ${articlesPath}`);
  return articlesPath;
}

async function downloadUsers(page, token) {
  console.log('[download] Opening user analysis page...');

  await page.goto(
    `https://mp.weixin.qq.com/misc/useranalysis?token=${token}&lang=zh_CN`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(3000);

  await selectDateRange(page, 30);
  const usersPath = await triggerDownload(page, 'users', '用户分析');

  console.log(`[download] User analysis downloaded: ${usersPath}`);
  return usersPath;
}

async function selectDateRange(page, days) {
  const labels = days === 30
    ? ['最近 30 天', '最近30天']
    : [`最近 ${days} 天`, `最近${days}天`];

  for (const label of labels) {
    const locator = page.getByText(label, { exact: false }).first();
    if (await locator.count()) {
      try {
        await locator.click({ timeout: 2000 });
        await page.waitForTimeout(1000);
        console.log(`[download] Selected date range: ${label}`);
        return true;
      } catch {
        // Ignore and try the next variant.
      }
    }
  }

  console.log('[download] Date range was not changed automatically. You can select it manually in the page if needed.');
  return false;
}

async function triggerDownload(page, prefix, pageLabel) {
  const timestamp = Date.now();
  const filename = `${prefix}_${timestamp}.xls`;
  const savePath = path.join(DOWNLOAD_DIR, filename);

  const client = await page.context().newCDPSession(page);
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR,
  });

  const button = await findExportButton(page);
  if (button) {
    console.log(`[download] Found export button on ${pageLabel}, trying automatic export...`);
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await button.click();
    const download = await downloadPromise;
    await download.saveAs(savePath);
    return savePath;
  }

  console.log(`[download] Could not find export button automatically on ${pageLabel}.`);
  console.log(`[download] Please use the open browser to confirm the date range and click "导出" or "下载" manually for ${pageLabel}.`);
  console.log('[download] Waiting for the browser download event...');

  const manualDownload = await page.waitForEvent('download', { timeout: 180_000 });
  await manualDownload.saveAs(savePath);
  return savePath;
}

async function findExportButton(page) {
  const candidates = [
    () => page.getByRole('button', { name: /导出数据|导出|下载/ }).first(),
    () => page.getByRole('link', { name: /导出数据|导出|下载/ }).first(),
    () => page.getByText('导出数据', { exact: false }).first(),
    () => page.getByText('导出', { exact: false }).first(),
    () => page.getByText('下载', { exact: false }).first(),
  ];

  for (const build of candidates) {
    const locator = build();
    if (await locator.count()) {
      try {
        if (await locator.isVisible()) {
          return locator;
        }
      } catch {
        // Ignore and keep searching.
      }
    }
  }

  return null;
}

function getLatestFiles() {
  if (!fs.existsSync(DOWNLOAD_DIR)) return null;

  const files = fs.readdirSync(DOWNLOAD_DIR);

  const getLatest = (prefix) => {
    const matched = files
      .filter(f => f.startsWith(prefix) && (f.endsWith('.xls') || f.endsWith('.xlsx')))
      .sort()
      .reverse();
    return matched.length > 0 ? path.join(DOWNLOAD_DIR, matched[0]) : null;
  };

  const articlesPath = getLatest('articles');
  const usersPath = getLatest('users');

  if (articlesPath && usersPath) {
    return { articlesPath, usersPath };
  }
  return null;
}

module.exports = { downloadData, getLatestFiles };
