'use strict';

const XLSX = require('xlsx');
const cheerio = require('cheerio');
const fs = require('fs');

/**
 * 解析图文分析 Excel（真正的 .xls/.xlsx）
 * 
 * 文件结构：单 sheet "New Sheet1"，3 个子表通过空列分隔并排：
 *   子表1 (col 1-3)：渠道阅读趋势 — 日期 | 渠道 | 阅读人数
 *   子表2 (col 5-9)：互动趋势   — 日期 | 分享人数 | 跳转阅读原文人数 | 微信收藏人数 | 发表篇数
 *   子表3 (col 11-15)：单篇来源明细 — 传播渠道 | 发表日期 | 内容标题 | 阅读人数 | 阅读人数占比
 * 
 * @param {string} filePath
 * @returns {{ dailyReadByChannel: Array, dailyInteraction: Array, articles: Array }}
 */
function parseArticles(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']);

  const cell = (r, c) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const v = ws[addr];
    return v ? v.v : null;
  };

  // ── 子表1：渠道阅读趋势（col 1=日期, 2=渠道, 3=阅读人数）──
  // 数据从 row 3 开始（row 0-1 是标题/空，row 2 是表头）
  const dailyReadByChannel = [];
  for (let r = 3; r <= range.e.r; r++) {
    const date = cell(r, 1);
    const channel = cell(r, 2);
    const readers = cell(r, 3);
    if (date == null || channel == null) continue;
    dailyReadByChannel.push({
      date: String(date),
      channel: String(channel),
      readers: toInt(readers),
    });
  }

  // ── 子表2：互动趋势（col 5=日期, 6=分享, 7=跳转原文, 8=收藏, 9=发表篇数）──
  const dailyInteraction = [];
  for (let r = 3; r <= range.e.r; r++) {
    const date = cell(r, 5);
    if (date == null) continue;
    dailyInteraction.push({
      date: String(date),
      shares: toInt(cell(r, 6)),
      readOriginal: toInt(cell(r, 7)),
      favorites: toInt(cell(r, 8)),
      published: toInt(cell(r, 9)),
    });
  }

  // ── 子表3：单篇来源明细（col 11=传播渠道, 12=发表日期, 13=标题, 14=阅读人数, 15=占比）──
  const rawArticles = [];
  for (let r = 3; r <= range.e.r; r++) {
    const channelVal = cell(r, 11);
    if (channelVal == null) continue;
    rawArticles.push({
      channel: String(channelVal),
      pubDate: formatDate(String(cell(r, 12))),
      title: String(cell(r, 13)),
      readers: toInt(cell(r, 14)),
      readRatio: toFloat(cell(r, 15)),
    });
  }

  // 去重：只取 传播渠道 === '全部' 的行，得到文章级汇总
  const articles = rawArticles.filter(a => a.channel === '全部').map(a => ({
    pubDate: a.pubDate,
    title: a.title,
    readers: a.readers,
    readRatio: a.readRatio,
  }));

  // 同时保留按渠道拆分的明细（分析时可能用到）
  const articlesByChannel = rawArticles.filter(a => a.channel !== '全部');

  console.log(`[parser] 渠道阅读趋势: ${dailyReadByChannel.length} 行`);
  console.log(`[parser] 互动趋势: ${dailyInteraction.length} 行`);
  console.log(`[parser] 文章明细(全部): ${articles.length} 篇`);
  console.log(`[parser] 文章渠道明细: ${articlesByChannel.length} 行`);

  return { dailyReadByChannel, dailyInteraction, articles, articlesByChannel };
}

/**
 * 解析用户分析 Excel（HTML 伪装成 .xls）
 * 
 * 文件是 HTML table，结构：
 *   表头行: 时间 | 新关注人数 | 取消关注人数 | 净增关注人数 | 累积关注人数
 *   数据行: 2026-03-15 | 0 | 0 | 0 | 328
 * 
 * @param {string} filePath
 * @returns {{ dailyUsers: Array }}
 */
function parseUsers(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);

  const dailyUsers = [];

  // 找到数据表格中的所有行
  const rows = $('table.tb tr');

  // 跳过前2行（标题行 + header 行），但 header 可能跨了2个 tr（rowspan=2）
  // 实际结构：row 0 = 大标题, row 1 = header(rowspan=2), row 2 = 空行(rowspan续), row 3+ = 数据
  let dataStarted = false;

  rows.each((i, row) => {
    const cells = $(row).find('th, td');
    if (cells.length < 5) return;

    const firstCell = $(cells[0]).text().trim();

    // 数据行的第一个 cell 是日期格式 YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(firstCell)) {
      dataStarted = true;
      dailyUsers.push({
        date: firstCell,
        newUser: toInt($(cells[1]).text().trim()),
        cancelUser: toInt($(cells[2]).text().trim()),
        netUser: toInt($(cells[3]).text().trim()),
        totalUser: toInt($(cells[4]).text().trim()),
      });
    }
  });

  console.log(`[parser] 用户数据: ${dailyUsers.length} 天`);

  return { dailyUsers };
}

// ── 工具函数 ──

function toInt(v) {
  if (v == null) return 0;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

function toFloat(v) {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

/**
 * 将 YYYYMMDD 格式转为 YYYY-MM-DD
 */
function formatDate(raw) {
  if (!raw || raw.length < 8) return raw;
  // 已经是 YYYY-MM-DD 格式
  if (raw.includes('-')) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

module.exports = { parseArticles, parseUsers };
