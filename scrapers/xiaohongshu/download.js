'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DOWNLOAD_DIR = path.join(os.homedir(), '.xiaohongshu-review', 'downloads');
const HOME_URL = 'https://creator.xiaohongshu.com/';

const REPORT_SPECS = [
  {
    key: 'overview-watch',
    pageLabel: '账号概览-观看数据',
    parentNav: '数据看板',
    leftNav: '账号概览',
    topTabs: ['笔记数据'],
    subTab: '观看数据',
  },
  {
    key: 'overview-interaction',
    pageLabel: '账号概览-互动数据',
    parentNav: '数据看板',
    leftNav: '账号概览',
    topTabs: ['笔记数据'],
    subTab: '互动数据',
  },
  {
    key: 'overview-growth',
    pageLabel: '账号概览-涨粉数据',
    parentNav: '数据看板',
    leftNav: '账号概览',
    topTabs: ['笔记数据'],
    subTab: '涨粉数据',
  },
  {
    key: 'overview-publish',
    pageLabel: '账号概览-发布数据',
    parentNav: '数据看板',
    leftNav: '账号概览',
    topTabs: ['笔记数据'],
    subTab: '发布数据',
  },
  {
    key: 'notes',
    pageLabel: '内容分析-笔记数据',
    parentNav: '数据看板',
    leftNav: '内容分析',
    topTabs: ['笔记数据'],
  },
];

async function downloadData(page) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const result = {};
  for (const spec of REPORT_SPECS) {
    result[toResultKey(spec.key)] = await downloadReport(page, spec);
  }

  return result;
}

async function downloadReport(page, spec) {
  console.log(`[xhs-download] Opening ${spec.pageLabel} page...`);
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  await enterDashboardFromHome(page);
  await selectSideNav(page, spec.parentNav, spec.leftNav);
  await selectTopTabs(page, spec.topTabs || []);
  if (spec.subTab) {
    await selectSubTab(page, spec.subTab);
  }
  await selectDateRange(page, 30);

  const savePath = path.join(DOWNLOAD_DIR, `${spec.key}_${Date.now()}.xlsx`);
  const client = await page.context().newCDPSession(page);
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR,
  });

  const button = await findExportButton(page);
  if (button) {
    console.log(`[xhs-download] Found export button on ${spec.pageLabel}, trying automatic export...`);
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await button.click();
    const download = await downloadPromise;
    await download.saveAs(savePath);
    return savePath;
  }

  console.log(`[xhs-download] Could not find export button automatically on ${spec.pageLabel}.`);
  console.log(`[xhs-download] Please confirm tab/date range and click "导出数据" manually for ${spec.pageLabel}.`);
  const manualDownload = await page.waitForEvent('download', { timeout: 300_000 });
  await manualDownload.saveAs(savePath);
  return savePath;
}

async function selectSideNav(page, parentLabel, label) {
  if (parentLabel) {
    const parentLocator = await findTextLocator(page, parentLabel);
    if (parentLocator) {
      try {
        await parentLocator.click({ timeout: 2500 });
        await page.waitForTimeout(600);
      } catch {
        // Ignore and continue to child selector.
      }
    }
  }

  const locator = await findTextLocator(page, label);
  if (locator) {
    try {
      await locator.click({ timeout: 3000 });
      await page.waitForTimeout(1200);
      return true;
    } catch {
      // fall through
    }
  }

  console.log(`[xhs-download] Could not switch left nav automatically: ${label}`);
  return false;
}

async function selectTopTabs(page, labels) {
  for (const label of labels) {
    const locator = await findTextLocator(page, label);
    if (locator) {
      try {
        await locator.click({ timeout: 2000 });
        await page.waitForTimeout(800);
      } catch {
        console.log(`[xhs-download] Top tab did not switch automatically: ${label}`);
      }
    }
  }
}

async function selectSubTab(page, label) {
  const locator = await findTextLocator(page, label);
  if (locator) {
      try {
        await locator.click({ timeout: 2500 });
        await page.waitForTimeout(1000);
      return true;
    } catch {
      // fall through
    }
  }

  console.log(`[xhs-download] Could not switch sub-tab automatically: ${label}`);
  return false;
}

async function enterDashboardFromHome(page) {
  const candidates = [
    () => page.getByText('查看详情', { exact: true }).first(),
    () => page.getByText('查看详情', { exact: false }).first(),
    () => page.getByRole('link', { name: /查看详情/ }).first(),
    () => page.getByRole('button', { name: /查看详情/ }).first(),
  ];

  for (const build of candidates) {
    const locator = build();
    try {
      if (await locator.count() && await locator.isVisible()) {
        await locator.click({ timeout: 3000 });
        await page.waitForTimeout(1500);
        console.log('[xhs-download] Entered dashboard from home shortcut');
        return true;
      }
    } catch {
      // Ignore and continue.
    }
  }

  console.log('[xhs-download] Could not enter dashboard from home shortcut automatically.');
  return false;
}

async function selectDateRange(page, days) {
  const labels = [
    `近${days}日`,
    `近 ${days} 日`,
    `最近${days}天`,
    `最近 ${days} 天`,
  ];

  for (const label of labels) {
    const locator = await findTextLocator(page, label);
    if (locator) {
      try {
        await locator.click({ timeout: 1500 });
        await page.waitForTimeout(800);
        return true;
      } catch {
        // Ignore and continue.
      }
    }
  }

  console.log('[xhs-download] Date range was not changed automatically. You can select it manually if needed.');
  return false;
}

async function findExportButton(page) {
  const candidates = [
    () => page.getByRole('button', { name: /导出数据|导出|下载/ }).first(),
    () => page.getByRole('link', { name: /导出数据|导出|下载/ }).first(),
    () => page.getByText('导出数据', { exact: false }).first(),
    () => page.getByText('导出', { exact: false }).first(),
  ];

  for (const build of candidates) {
    const locator = build();
    if (await locator.count()) {
      try {
        if (await locator.isVisible()) {
          return locator;
        }
      } catch {
        // Ignore and continue.
      }
    }
  }

  return null;
}

async function findTextLocator(page, label) {
  const escaped = escapeRegex(label);
  const candidates = [
    page.getByText(label, { exact: true }).first(),
    page.getByText(label, { exact: false }).first(),
    page.getByText(new RegExp(escaped)).first(),
    page.locator(`text=${label}`).first(),
  ];

  for (const locator of candidates) {
    try {
      if (await locator.count() && await locator.isVisible()) {
        return locator;
      }
    } catch {
      // Ignore and continue.
    }
  }

  return null;
}

function getLatestFiles() {
  if (!fs.existsSync(DOWNLOAD_DIR)) return null;

  const files = fs.readdirSync(DOWNLOAD_DIR);
  const getLatest = (prefix) => {
    const matched = files
      .filter((name) => name.startsWith(prefix) && /\.(xls|xlsx|csv|html?)$/i.test(name))
      .sort()
      .reverse();
    return matched.length > 0 ? path.join(DOWNLOAD_DIR, matched[0]) : null;
  };

  const result = {};
  for (const spec of REPORT_SPECS) {
    const file = getLatest(spec.key);
    if (!file) {
      return null;
    }
    result[toResultKey(spec.key)] = file;
  }

  return result;
}

function toResultKey(key) {
  return `${camelize(key)}Path`;
}

function camelize(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { downloadData, getLatestFiles, REPORT_SPECS };
