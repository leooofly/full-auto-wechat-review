'use strict';

const XLSX = require('xlsx');
const cheerio = require('cheerio');
const fs = require('fs');
const { getPlatformTerms } = require('../../analysis/terms');

function parseFiles(files) {
  const articlesData = parseArticles(files.articlesPath);
  const usersData = parseUsers(files.usersPath);
  const terms = getPlatformTerms('wechat');

  return {
    platform: 'wechat',
    meta: {
      ...terms,
      sourceFiles: {
        articles: files.articlesPath,
        users: files.usersPath,
      },
      hasChannelBreakdown: true,
      fieldMapping: {
        readers: '文章阅读人数',
        shares: '分享人数',
        favorites: '微信收藏人数',
        published: '发表篇数',
        newUser: '新关注人数',
        cancelUser: '取消关注人数',
        netUser: '净增关注人数',
        totalUser: '累计关注人数',
      },
    },
    dailyMetrics: buildDailyMetrics(articlesData),
    audienceMetrics: usersData.dailyUsers.map((row) => ({
      date: row.date,
      newUser: row.newUser,
      cancelUser: row.cancelUser,
      netUser: row.netUser,
      totalUser: row.totalUser,
      extra: {},
    })),
    contentItems: articlesData.articles.map((article) => ({
      pubDate: article.pubDate,
      title: article.title,
      readers: article.readers,
      readRatio: article.readRatio,
      extra: {},
    })),
    contentBreakdown: articlesData.articlesByChannel.map((article) => ({
      channel: article.channel,
      pubDate: article.pubDate,
      title: article.title,
      readers: article.readers,
      readRatio: article.readRatio,
    })),
  };
}

function buildDailyMetrics(articlesData) {
  const totalReadersByDate = {};
  const channelReadersByDate = {};

  for (const row of articlesData.dailyReadByChannel) {
    if (row.channel === '全部') {
      totalReadersByDate[row.date] = row.readers;
      continue;
    }

    if (!channelReadersByDate[row.date]) {
      channelReadersByDate[row.date] = {};
    }
    channelReadersByDate[row.date][row.channel] = row.readers;
  }

  const interactionByDate = {};
  for (const row of articlesData.dailyInteraction) {
    interactionByDate[row.date] = row;
  }

  const dates = [...new Set([
    ...Object.keys(totalReadersByDate),
    ...Object.keys(channelReadersByDate),
    ...Object.keys(interactionByDate),
  ])].sort();

  return dates.map((date) => {
    const interaction = interactionByDate[date] || {};
    return {
      date,
      readers: totalReadersByDate[date] || 0,
      shares: interaction.shares || 0,
      favorites: interaction.favorites || 0,
      published: interaction.published || 0,
      channels: channelReadersByDate[date] || {},
      extra: {
        readOriginal: interaction.readOriginal || 0,
      },
    };
  });
}

function parseArticles(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']);

  const cell = (r, c) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const value = ws[addr];
    return value ? value.v : null;
  };

  const dailyReadByChannel = [];
  for (let rowIndex = 3; rowIndex <= range.e.r; rowIndex++) {
    const date = cell(rowIndex, 1);
    const channel = cell(rowIndex, 2);
    const readers = cell(rowIndex, 3);
    if (date == null || channel == null || String(date).trim() === '' || String(channel).trim() === '') continue;
    dailyReadByChannel.push({
      date: String(date),
      channel: String(channel),
      readers: toInt(readers),
    });
  }

  const dailyInteraction = [];
  for (let rowIndex = 3; rowIndex <= range.e.r; rowIndex++) {
    const date = cell(rowIndex, 5);
    if (date == null || String(date).trim() === '') continue;
    dailyInteraction.push({
      date: String(date),
      shares: toInt(cell(rowIndex, 6)),
      readOriginal: toInt(cell(rowIndex, 7)),
      favorites: toInt(cell(rowIndex, 8)),
      published: toInt(cell(rowIndex, 9)),
    });
  }

  const rawArticles = [];
  for (let rowIndex = 3; rowIndex <= range.e.r; rowIndex++) {
    const channelValue = cell(rowIndex, 11);
    if (channelValue == null || String(channelValue).trim() === '') continue;
    rawArticles.push({
      channel: String(channelValue),
      pubDate: formatDate(String(cell(rowIndex, 12))),
      title: String(cell(rowIndex, 13)),
      readers: toInt(cell(rowIndex, 14)),
      readRatio: toFloat(cell(rowIndex, 15)),
    });
  }

  const articles = rawArticles
    .filter((article) => article.channel === '全部')
    .map((article) => ({
      pubDate: article.pubDate,
      title: article.title,
      readers: article.readers,
      readRatio: article.readRatio,
    }));

  const articlesByChannel = rawArticles.filter((article) => article.channel !== '全部');

  console.log(`[wechat-parser] 渠道阅读趋势: ${dailyReadByChannel.length} 行`);
  console.log(`[wechat-parser] 互动趋势: ${dailyInteraction.length} 行`);
  console.log(`[wechat-parser] 文章明细(全部): ${articles.length} 篇`);

  return { dailyReadByChannel, dailyInteraction, articles, articlesByChannel };
}

function parseUsers(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);

  const dailyUsers = [];
  const rows = $('table.tb tr');

  rows.each((_, row) => {
    const cells = $(row).find('th, td');
    if (cells.length < 5) return;

    const firstCell = $(cells[0]).text().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(firstCell)) {
      dailyUsers.push({
        date: firstCell,
        newUser: toInt($(cells[1]).text().trim()),
        cancelUser: toInt($(cells[2]).text().trim()),
        netUser: toInt($(cells[3]).text().trim()),
        totalUser: toInt($(cells[4]).text().trim()),
      });
    }
  });

  console.log(`[wechat-parser] 用户数据: ${dailyUsers.length} 天`);
  return { dailyUsers };
}

function toInt(value) {
  if (value == null) return 0;
  const numeric = parseInt(String(value), 10);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function toFloat(value) {
  if (value == null) return 0;
  const numeric = parseFloat(String(value));
  return Number.isNaN(numeric) ? 0 : numeric;
}

function formatDate(raw) {
  if (!raw || raw.length < 8) return raw;
  if (raw.includes('-')) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

module.exports = { parseFiles, parseArticles, parseUsers };
