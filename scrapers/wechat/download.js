'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DOWNLOAD_DIR = path.join(os.homedir(), '.wechat-review', 'downloads');

async function downloadData(page, token, options = {}) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const articlesPath = await downloadArticles(page, token, options);
  const usersPath = await downloadUsers(page, token, options);

  return { articlesPath, usersPath };
}

async function downloadArticles(page, token, options) {
  console.log('[download] Opening content analysis page...');

  await page.goto(
    `https://mp.weixin.qq.com/misc/appmsganalysis?action=report&type=daily_v2&token=${token}&lang=zh_CN`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(3000);

  const dateRangeStatus = await applyDateRange(page, options);
  const articlesPath = await triggerDownload(page, 'articles', '内容分析', {
    requireManualConfirmation: dateRangeStatus.requireManualConfirmation,
    expectedRange: getExpectedRange(options),
    token,
  });

  console.log(`[download] Content analysis downloaded: ${articlesPath}`);
  return articlesPath;
}

async function downloadUsers(page, token, options) {
  console.log('[download] Opening user analysis page...');

  await page.goto(
    `https://mp.weixin.qq.com/misc/useranalysis?token=${token}&lang=zh_CN`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(3000);

  const dateRangeStatus = await applyDateRange(page, options);
  const usersPath = await triggerDownload(page, 'users', '用户分析', {
    requireManualConfirmation: dateRangeStatus.requireManualConfirmation,
    expectedRange: getExpectedRange(options),
    token,
  });

  console.log(`[download] User analysis downloaded: ${usersPath}`);
  return usersPath;
}

async function applyDateRange(page, options) {
  if (options && options.dateFrom && options.dateTo) {
    const applied = await selectExactDateRange(page, options.dateFrom, options.dateTo);
    if (applied) {
      return { requireManualConfirmation: false };
    }

    console.log(
      `[download] Exact date range ${options.dateFrom} -> ${options.dateTo} was not applied automatically. ` +
      'Please confirm it manually in the open browser before exporting.'
    );
    return { requireManualConfirmation: true };
  }

  const presetDays = options && options.expectedDays ? options.expectedDays : 30;
  const applied = await selectPresetDateRange(page, presetDays);
  return { requireManualConfirmation: !applied };
}

async function selectPresetDateRange(page, days) {
  const labels = days === 30
    ? ['最近 30 天', '最近30天']
    : [`最近 ${days} 天`, `最近${days}天`];

  for (const label of labels) {
    const locator = page.getByText(label, { exact: false }).first();
    if (await locator.count()) {
      try {
        await locator.click({ timeout: 2000 });
        await page.waitForTimeout(1000);
        console.log(`[download] Selected preset date range: ${label}`);
        return true;
      } catch {
        // Ignore and try the next variant.
      }
    }
  }

  console.log('[download] Date range was not changed automatically. You can select it manually in the page if needed.');
  return false;
}

async function selectExactDateRange(page, dateFrom, dateTo) {
  const dataRefreshPromise = waitForRangeDataRefresh(page, dateFrom, dateTo);
  const picker = await openDateRangePicker(page);
  if (!picker) {
    console.log('[download] Could not open the WeChat date range picker automatically.');
    return false;
  }

  const applied = await pickRangeFromCalendar(page, picker, dateFrom, dateTo);
  if (!applied) {
    console.log('[download] Calendar date picking did not stick.');
    return false;
  }

  const pickerClosed = await closeDateRangePicker(page, picker);
  if (!pickerClosed) {
    console.log('[download] Date picker did not close after range selection.');
    return false;
  }

  const refreshed = await dataRefreshPromise;
  if (refreshed) {
    console.log(`[download] Range data refresh confirmed for ${dateFrom} -> ${dateTo}.`);
  } else {
    console.log(`[download] Did not observe a confirmed range refresh for ${dateFrom} -> ${dateTo}; continuing with UI verification only.`);
  }

  const verified = await verifyDateRange(page, dateFrom, dateTo);
  if (verified) {
    console.log(`[download] Selected exact date range: ${dateFrom} -> ${dateTo}`);
    return true;
  }

  console.log(`[download] Date field did not verify as ${dateFrom} -> ${dateTo}.`);
  return false;
}

async function verifyDateRange(page, expectedStart, expectedEnd) {
  try {
    const inputs = page.locator('input.weui-desktop-form__input');
    const startValue = normalizeWhitespace(await inputs.nth(0).inputValue());
    const endValue = normalizeWhitespace(await inputs.nth(1).inputValue());
    return startValue === expectedStart && endValue === expectedEnd;
  } catch {
    return false;
  }
}

async function findDateRangeField(page) {
  const selectors = [
    'input[placeholder*="日期"]',
    'input[placeholder*="时间"]',
    'input[name*="date"]',
    'input[id*="date"]',
    'input[class*="date"]',
    'input',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < Math.min(count, 12); index += 1) {
      const candidate = locator.nth(index);
      try {
        if (!await candidate.isVisible()) {
          continue;
        }

        const placeholder = normalizeWhitespace(await candidate.getAttribute('placeholder'));
        const value = normalizeWhitespace(await candidate.inputValue());
        const hintText = `${placeholder} ${value}`;
        if (
          /日期|时间|date/i.test(hintText) ||
          /\d{4}-\d{2}-\d{2}\s*(至|-)\s*\d{4}-\d{2}-\d{2}/.test(hintText)
        ) {
          return candidate;
        }
      } catch {
        // Ignore and continue searching.
      }
    }
  }

  return null;
}

async function openDateRangePicker(page) {
  const field = await findDateRangeField(page);
  if (!field) {
    return null;
  }

  try {
    await field.click({ timeout: 3000 });
  } catch {
    return null;
  }

  const picker = page.locator('dl.weui-desktop-picker__date-range.weui-desktop-picker__focus').first();
  try {
    await picker.waitFor({ state: 'visible', timeout: 3000 });
    return picker;
  } catch {
    return null;
  }
}

async function pickRangeFromCalendar(page, picker, dateFrom, dateTo) {
  const from = parseLocalDateParts(dateFrom);
  const to = parseLocalDateParts(dateTo);
  if (!from || !to) {
    return false;
  }

  const sameMonthRange = from.year === to.year && from.month === to.month;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const visibleMonths = await getVisiblePickerMonths(picker);
    if (isTargetRangeVisible(visibleMonths, from, to, sameMonthRange)) {
      break;
    }

    const direction = chooseMonthDirection(visibleMonths, from, to, sameMonthRange);
    if (!direction) {
      break;
    }

    const moved = await movePickerMonth(page, picker, direction);
    if (!moved) {
      break;
    }
  }

  const panels = picker.locator('div.weui-desktop-picker__panel.weui-desktop-picker__panel_day');
  const leftPanel = panels.nth(0);
  const rightPanel = panels.nth(1);

  const leftMonth = await getPanelMonth(leftPanel);
  const rightMonth = await getPanelMonth(rightPanel);
  if (sameMonthRange) {
    const panel = matchesMonth(leftMonth, from) ? leftPanel : matchesMonth(rightMonth, from) ? rightPanel : null;
    if (!panel) {
      return false;
    }

    const startSelected = await clickCalendarDay(panel, from.day);
    if (!startSelected) {
      return false;
    }

    const endSelected = await clickCalendarDay(panel, to.day);
    if (!endSelected) {
      return false;
    }
  } else {
    if (!matchesMonth(leftMonth, from) || !matchesMonth(rightMonth, to)) {
      return false;
    }

    const startSelected = await clickCalendarDay(leftPanel, from.day);
    if (!startSelected) {
      return false;
    }

    const endSelected = await clickCalendarDay(rightPanel, to.day);
    if (!endSelected) {
      return false;
    }
  }

  await page.waitForTimeout(800);
  return true;
}

async function closeDateRangePicker(page, picker) {
  if (!await isPickerVisible(picker)) {
    return true;
  }

  const strategies = [
    () => clickOutsidePicker(page, picker, 'bottom-right'),
    () => clickOutsidePicker(page, picker, 'right'),
    () => clickOutsidePicker(page, picker, 'below'),
    async () => {
      await page.keyboard.press('Escape');
    },
  ];

  for (const strategy of strategies) {
    try {
      await strategy();
      await page.waitForTimeout(400);
      if (!await isPickerVisible(picker)) {
        console.log('[download] Date picker closed after range selection.');
        return true;
      }
    } catch {
      // Ignore and continue.
    }
  }

  console.log('[download] Date picker is still visible after automatic close attempts.');
  return false;
}

async function clickOutsidePicker(page, picker, mode) {
  const overlayBoxes = await picker.locator('dd').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }));
  const box = mergeBoxes(overlayBoxes) || await picker.boundingBox();
  if (!box) {
    throw new Error('Date picker has no bounding box');
  }

  const viewport = page.viewportSize() || { width: 1440, height: 900 };
  let x = box.x + box.width + 40;
  let y = box.y + box.height + 40;

  if (mode === 'right') {
    x = box.x + box.width + 60;
    y = box.y + Math.min(box.height / 2, 160);
  } else if (mode === 'below') {
    x = box.x + Math.min(box.width / 2, 300);
    y = box.y + box.height + 50;
  }

  x = Math.max(20, Math.min(Math.round(x), viewport.width - 20));
  y = Math.max(20, Math.min(Math.round(y), viewport.height - 20));

  await page.mouse.click(x, y);
}

async function isPickerVisible(picker) {
  try {
    return await picker.isVisible();
  } catch {
    return false;
  }
}

async function getVisiblePickerMonths(picker) {
  const panels = picker.locator('div.weui-desktop-picker__panel.weui-desktop-picker__panel_day');
  return {
    left: await getPanelMonth(panels.nth(0)),
    right: await getPanelMonth(panels.nth(1)),
  };
}

async function getPanelMonth(panel) {
  try {
    const labels = await panel.locator('span.weui-desktop-picker__panel__label').allInnerTexts();
    const year = Number.parseInt(String(labels[0] || '').replace(/[^\d]/g, ''), 10);
    const month = Number.parseInt(String(labels[1] || '').replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return null;
    }
    return { year, month };
  } catch {
    return null;
  }
}

async function movePickerMonth(page, picker, direction) {
  const buttonSelector = direction === 'backward'
    ? 'button.weui-desktop-btn__icon.weui-desktop-btn__icon__left'
    : 'button.weui-desktop-btn__icon.weui-desktop-btn__icon__right';
  const button = picker.locator(buttonSelector).first();

  try {
    await button.click({ timeout: 3000 });
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function clickCalendarDay(panel, day) {
  let targetIndex = -1;
  try {
    const anchors = await panel.locator('a').evaluateAll((nodes) => nodes.map((node, index) => ({
      index,
      text: String(node.textContent || '').replace(/\s+/g, ' ').trim(),
      className: String(node.className || ''),
    })));

    targetIndex = anchors.findIndex((anchor) => {
      if (anchor.text !== String(day)) {
        return false;
      }
      if (anchor.className.includes('weui-desktop-picker__faded')) {
        return false;
      }
      if (anchor.className.includes('weui-desktop-picker__disabled')) {
        return false;
      }
      return true;
    });
  } catch {
    return false;
  }

  if (targetIndex < 0) {
    return false;
  }

  try {
    await panel.locator('a').nth(targetIndex).click({ timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function waitForRangeDataRefresh(page, dateFrom, dateTo) {
  try {
    await page.waitForResponse((response) => {
      const url = response.url();
      return response.status() === 200 &&
        url.includes(`begin_date=${dateFrom}`) &&
        url.includes(`end_date=${dateTo}`);
    }, { timeout: 8000 });
    await page.waitForTimeout(600);
    return true;
  } catch {
    return false;
  }
}

function chooseMonthDirection(visibleMonths, from, to, sameMonthRange = false) {
  const left = visibleMonths.left;
  const right = visibleMonths.right;
  if (!left || !right) {
    return null;
  }

  const leftValue = left.year * 12 + left.month;
  const rightValue = right.year * 12 + right.month;
  const fromValue = from.year * 12 + from.month;
  const toValue = to.year * 12 + to.month;

  if (sameMonthRange) {
    if (fromValue < leftValue) {
      return 'backward';
    }
    if (fromValue > rightValue) {
      return 'forward';
    }
    return null;
  }

  if (fromValue < leftValue || toValue < rightValue) {
    return 'backward';
  }
  if (fromValue > leftValue || toValue > rightValue) {
    return 'forward';
  }
  return null;
}

function isTargetRangeVisible(visibleMonths, from, to, sameMonthRange = false) {
  if (!visibleMonths.left || !visibleMonths.right) {
    return false;
  }

  if (sameMonthRange) {
    return matchesMonth(visibleMonths.left, from) || matchesMonth(visibleMonths.right, from);
  }

  return matchesMonth(visibleMonths.left, from) && matchesMonth(visibleMonths.right, to);
}

function matchesMonth(panelMonth, target) {
  return Boolean(
    panelMonth &&
    target &&
    panelMonth.year === target.year &&
    panelMonth.month === target.month
  );
}

function parseLocalDateParts(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10),
  };
}

async function triggerDownload(page, prefix, pageLabel, options = {}) {
  const timestamp = Date.now();
  const filename = `${prefix}_${timestamp}.xls`;
  const savePath = path.join(DOWNLOAD_DIR, filename);

  const client = await page.context().newCDPSession(page);
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR,
  });

  const exportTarget = await resolveExportTarget(page, options);
  if (exportTarget && (!options.requireManualConfirmation || exportTarget.mode === 'direct')) {
    console.log(`[download] Found export target on ${pageLabel}, trying automatic export...`);
    const downloadPromise = page.waitForEvent('download', { timeout: 12_000 });
    if (exportTarget.mode === 'direct') {
      console.log(`[download] Triggering direct export URL on ${pageLabel}: ${exportTarget.url}`);
      await startDownloadFromUrl(page, exportTarget.url);
    } else {
      await exportTarget.button.click({ timeout: 5_000 });
    }
    console.log(`[download] Waiting for download event on ${pageLabel}...`);
    const download = await downloadPromise;
    console.log(`[download] Download event received on ${pageLabel}.`);
    await download.saveAs(savePath);
    return savePath;
  }

  if (options.requireManualConfirmation) {
    console.log(`[download] Waiting for manual confirmation on ${pageLabel} because the exact date range was not verified.`);
  } else {
    console.log(`[download] Could not find export button automatically on ${pageLabel}.`);
  }
  console.log(`[download] Please use the open browser to confirm the date range and click "导出" or "下载" manually for ${pageLabel}.`);
  console.log('[download] Waiting for the browser download event...');

  const manualDownload = await page.waitForEvent('download', { timeout: 180_000 });
  await manualDownload.saveAs(savePath);
  return savePath;
}

async function findExportButton(page) {
  const candidates = [
    () => page.locator('a[href*="download_summary_tendency"]').first(),
    () => page.locator('a[href*="download=1"]').first(),
    () => page.getByRole('button', { name: /导出数据|下载表格|导出|下载/ }).first(),
    () => page.getByRole('link', { name: /导出数据|下载表格|导出|下载/ }).first(),
    () => page.getByText('导出数据', { exact: false }).first(),
    () => page.getByText('下载表格', { exact: false }).first(),
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

async function resolveExportTarget(page, options) {
  const button = await findExportButton(page);
  if (!button) {
    return null;
  }

  if (!options.expectedRange) {
    return { mode: 'click', button };
  }

  const href = await readLocatorHref(button);
  if (!href) {
    return { mode: 'click', button };
  }

  const exportUrl = normalizeExportUrl(href, page.url());
  if (!exportUrl) {
    return { mode: 'click', button };
  }

  if (matchesExpectedRange(exportUrl, options.expectedRange)) {
    return { mode: 'click', button };
  }

  const correctedUrl = buildCorrectedExportUrl(exportUrl, options.expectedRange, options.token);
  if (!correctedUrl) {
    return { mode: 'click', button };
  }

  console.log(
    `[download] Export href was stale (${exportUrl.searchParams.get('begin_date')} -> ${exportUrl.searchParams.get('end_date')}); ` +
    `using corrected range ${options.expectedRange.start} -> ${options.expectedRange.end}.`
  );
  return { mode: 'direct', url: correctedUrl.href, button };
}

async function readLocatorHref(locator) {
  try {
    const href = await locator.getAttribute('href');
    if (href) {
      return href;
    }
  } catch {
    // Ignore and continue.
  }

  try {
    return await locator.evaluate((node) => {
      if (!node || typeof node.closest !== 'function') {
        return null;
      }
      const anchor = node.closest('a');
      return anchor ? anchor.getAttribute('href') : null;
    });
  } catch {
    return null;
  }
}

function normalizeExportUrl(href, pageUrl) {
  try {
    return new URL(href, pageUrl);
  } catch {
    return null;
  }
}

function matchesExpectedRange(url, expectedRange) {
  return url.searchParams.get('begin_date') === expectedRange.start &&
    url.searchParams.get('end_date') === expectedRange.end;
}

function buildCorrectedExportUrl(baseUrl, expectedRange, token) {
  try {
    const corrected = new URL(baseUrl.href);
    const beginTimestampSeed = corrected.searchParams.get('begin_timestamp');
    const endTimestampSeed = corrected.searchParams.get('end_timestamp');
    corrected.searchParams.set('download', '1');
    corrected.searchParams.set('begin_date', expectedRange.start);
    corrected.searchParams.set('end_date', expectedRange.end);
    if (corrected.searchParams.has('begin_timestamp')) {
      corrected.searchParams.set(
        'begin_timestamp',
        String(rewriteTimestampDate(beginTimestampSeed, expectedRange.start, endTimestampSeed))
      );
    }
    if (corrected.searchParams.has('end_timestamp')) {
      corrected.searchParams.set(
        'end_timestamp',
        String(rewriteTimestampDate(endTimestampSeed, expectedRange.end, beginTimestampSeed))
      );
    }
    if (token && !corrected.searchParams.get('token')) {
      corrected.searchParams.set('token', token);
    }
    if (!corrected.searchParams.get('lang')) {
      corrected.searchParams.set('lang', 'zh_CN');
    }
    return corrected;
  } catch {
    return null;
  }
}

async function startDownloadFromUrl(page, url) {
  await page.evaluate((downloadUrl) => {
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, url);
}

function rewriteTimestampDate(originalSeconds, targetDate, fallbackSeconds) {
  let original = Number.parseInt(originalSeconds, 10);
  if (!Number.isFinite(original)) {
    original = Number.parseInt(fallbackSeconds, 10);
  }
  if (!Number.isFinite(original)) {
    original = Math.floor(Date.now() / 1000);
  }

  const base = new Date(original * 1000);
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    throw new Error(`Invalid target date: ${targetDate}`);
  }

  target.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
  return Math.floor(target.getTime() / 1000);
}

function getExpectedRange(options) {
  if (options && options.dateFrom && options.dateTo) {
    return {
      start: options.dateFrom,
      end: options.dateTo,
    };
  }
  return null;
}

function getLatestFiles() {
  if (!fs.existsSync(DOWNLOAD_DIR)) return null;

  const files = fs.readdirSync(DOWNLOAD_DIR);

  const getLatest = (prefix) => {
    const matched = files
      .filter((file) => file.startsWith(prefix) && (file.endsWith('.xls') || file.endsWith('.xlsx')))
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

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function mergeBoxes(boxes) {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return null;
  }

  const valid = boxes.filter((box) => box && box.width > 0 && box.height > 0);
  if (valid.length === 0) {
    return null;
  }

  const left = Math.min(...valid.map((box) => box.x));
  const top = Math.min(...valid.map((box) => box.y));
  const right = Math.max(...valid.map((box) => box.x + box.width));
  const bottom = Math.max(...valid.map((box) => box.y + box.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

module.exports = { downloadData, getLatestFiles };
