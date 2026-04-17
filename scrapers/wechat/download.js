'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DOWNLOAD_DIR = path.join(os.homedir(), '.wechat-review', 'downloads');

/**
 * 下载公众号后台的图文分析和用户分析 Excel
 *
 * @param {import('playwright').Page} page - 已登录的页面
 * @param {string} token - 登录 token
 * @returns {{ articlesPath: string, usersPath: string }}
 */
async function downloadData(page, token) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const articlesPath = await downloadArticles(page, token);
  const usersPath = await downloadUsers(page, token);

  return { articlesPath, usersPath };
}

/**
 * 下载图文分析数据（内容分析 → 图文分析）
 */
async function downloadArticles(page, token) {
  console.log('[download] 导航到图文分析页面...');

  // 导航到内容分析 → 图文分析
  const articlesUrl = `https://mp.weixin.qq.com/cgi-bin/misrepairpage?action=page&token=${token}&lang=zh_CN&pluginid=luopan&f=json&ajax=1&random=${Math.random()}`;

  // 直接导航到图文分析页
  await page.goto(
    `https://mp.weixin.qq.com/misc/pluginpage?action=index&id=luopan&token=${token}&lang=zh_CN`,
    { waitUntil: 'networkidle' }
  );

  // 等待页面完全加载
  await page.waitForTimeout(2000);

  // 查找并点击"图文分析" tab（如果需要）
  try {
    const graphTab = await page.locator('text=图文分析').first();
    if (await graphTab.isVisible()) {
      await graphTab.click();
      await page.waitForTimeout(1500);
    }
  } catch {
    console.log('[download] 已在图文分析页面');
  }

  // 选择30天范围
  await selectDateRange(page, 30);

  // 点击导出按钮并等待下载
  const articlesPath = await triggerDownload(page, 'articles');

  console.log(`[download] 图文数据已下载: ${articlesPath}`);
  return articlesPath;
}

/**
 * 下载用户分析数据
 */
async function downloadUsers(page, token) {
  console.log('[download] 导航到用户分析页面...');

  await page.goto(
    `https://mp.weixin.qq.com/misc/pluginpage?action=index&id=finder_user&token=${token}&lang=zh_CN`,
    { waitUntil: 'networkidle' }
  );

  await page.waitForTimeout(2000);

  // 选择30天范围
  await selectDateRange(page, 30);

  // 导出
  const usersPath = await triggerDownload(page, 'users');

  console.log(`[download] 用户数据已下载: ${usersPath}`);
  return usersPath;
}

/**
 * 选择日期范围
 */
async function selectDateRange(page, days) {
  try {
    // 查找"最近30天"之类的选项
    const rangeBtn = await page.locator(`text=最近${days}天`).first();
    if (await rangeBtn.isVisible()) {
      await rangeBtn.click();
      await page.waitForTimeout(1000);
      return;
    }
  } catch {
    // 无预设按钮，手动设置日期范围
  }

  // 尝试查找日期范围选择器
  try {
    const dateRange = await page.locator('.weui-desktop-picker__wrp, .date-range-picker, [class*="date"]').first();
    if (await dateRange.isVisible()) {
      await dateRange.click();
      await page.waitForTimeout(500);

      // 点击30天选项
      const option30 = await page.locator('text=30天, text=30 天, text=最近30天').first();
      if (await option30.isVisible()) {
        await option30.click();
        await page.waitForTimeout(1000);
      }
    }
  } catch {
    console.log('[download] 无法设置日期范围，使用默认范围');
  }
}

/**
 * 触发导出下载
 */
async function triggerDownload(page, prefix) {
  const timestamp = Date.now();
  const filename = `${prefix}_${timestamp}.xls`;
  const savePath = path.join(DOWNLOAD_DIR, filename);

  // 设置下载路径
  const client = await page.context().newCDPSession(page);
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR,
  });

  // 查找并点击导出/下载按钮
  const exportBtn = await page.locator(
    'text=导出数据, text=导出, text=下载, button:has-text("导出"), a:has-text("导出")'
  ).first();

  if (await exportBtn.isVisible()) {
    // 监听下载事件
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await exportBtn.click();

    const download = await downloadPromise;
    await download.saveAs(savePath);

    return savePath;
  }

  throw new Error(`找不到导出按钮，无法下载 ${prefix} 数据`);
}

/**
 * 获取最新的缓存文件
 */
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
