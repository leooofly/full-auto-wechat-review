'use strict';

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { getPlatformTerms } = require('../../analysis/terms');

const HEADER_ALIASES = {
  date: ['日期', '时间', '统计时间', '发布时间', '发布日期'],
  title: ['标题', '笔记标题', '内容标题', '笔记'],
  readers: ['曝光', '总曝光', '观看', '观看数', '观看量', '阅读', '阅读量', '浏览量'],
  shares: ['分享', '分享量', '分享次数'],
  favorites: ['收藏', '收藏量', '收藏次数'],
  likes: ['点赞', '点赞量', '点赞次数'],
  comments: ['评论', '评论量', '评论次数'],
  published: ['发布数', '发布篇数', '笔记数', '发文数'],
  newUser: ['新增粉丝', '新增关注', '新粉丝', '新增关注数'],
  cancelUser: ['取消关注', '取消关注数', '流失粉丝数', '流失粉丝'],
  netUser: ['净涨粉', '净增粉丝', '净增关注', '净增'],
  totalUser: ['总粉丝数', '累计粉丝', '总粉丝', '粉丝总数', '关注总数'],
  homepageVisitors: ['主页访客', '主页访客数'],
  fansConversionRate: ['主页转粉率', '主页转粉率%'],
  noteId: ['笔记id', '笔记ID', '作品id', '作品ID'],
  readRatio: ['阅读占比', '曝光占比', '流量占比'],
};

function parseFiles(files) {
  const watch = parseWatchOverview(files.overviewWatchPath);
  const interaction = parseInteractionOverview(files.overviewInteractionPath);
  const growth = parseGrowthOverview(files.overviewGrowthPath);
  const publish = parsePublishOverview(files.overviewPublishPath);

  const notes = parseNotes(files.notesPath);
  const terms = getPlatformTerms('xiaohongshu');

  return {
    platform: 'xiaohongshu',
    meta: {
      ...terms,
      sourceFiles: {
        overviewWatch: files.overviewWatchPath,
        overviewInteraction: files.overviewInteractionPath,
        overviewGrowth: files.overviewGrowthPath,
        overviewPublish: files.overviewPublishPath,
        notes: files.notesPath,
      },
      hasChannelBreakdown: false,
      fieldMapping: {
        readers: watch.readerField || notes.readerField || '曝光/观看/阅读',
        shares: '分享',
        favorites: '收藏',
        published: '发布数/笔记数',
        newUser: '新增关注',
        cancelUser: '取消关注',
        netUser: '净涨粉',
        totalUser: '总粉丝数',
      },
    },
    dailyMetrics: mergeDailyMetrics(watch.rows, interaction.rows, publish.rows),
    audienceMetrics: growth.rows,
    contentItems: notes.notes,
    contentBreakdown: [],
  };
}

function parseWatchOverview(filePath) {
  const workbook = XLSX.readFile(filePath);
  const exposureTrend = readTrendSheet(workbook, ['曝光趋势']);
  const watchTrend = readTrendSheet(workbook, ['观看趋势']);
  const coverClickTrend = readTrendSheet(workbook, ['封面点击率趋势']);
  const avgWatchDurationTrend = readTrendSheet(workbook, ['平均观看时长趋势']);
  const totalWatchDurationTrend = readTrendSheet(workbook, ['观看总时长趋势', '总观看时长趋势']);
  const finishRateTrend = readTrendSheet(workbook, ['视频完播率趋势', '总完播率趋势']);

  const dates = collectDates(exposureTrend, watchTrend, coverClickTrend, avgWatchDurationTrend, totalWatchDurationTrend, finishRateTrend);
  const rows = dates.map((date) => ({
    date,
    readers: getTrendValue(exposureTrend, date),
    shares: undefined,
    favorites: undefined,
    published: undefined,
    channels: {},
    extra: compactObject({
      watchCount: getTrendValue(watchTrend, date),
      coverClickRate: normalizePercentOrNumber(getTrendValue(coverClickTrend, date)),
      avgWatchDuration: getTrendValue(avgWatchDurationTrend, date),
      totalWatchDuration: getTrendValue(totalWatchDurationTrend, date),
      finishRate: normalizePercentOrNumber(getTrendValue(finishRateTrend, date)),
    }),
  }));

  return { rows, readerField: '曝光' };
}

function parseInteractionOverview(filePath) {
  const workbook = XLSX.readFile(filePath);
  const likesTrend = readTrendSheet(workbook, ['点赞趋势']);
  const commentsTrend = readTrendSheet(workbook, ['评论趋势']);
  const favoritesTrend = readTrendSheet(workbook, ['收藏趋势']);
  const sharesTrend = readTrendSheet(workbook, ['分享趋势']);
  const dates = collectDates(likesTrend, commentsTrend, favoritesTrend, sharesTrend);

  const rows = dates.map((date) => ({
    date,
    readers: undefined,
    shares: getTrendValue(sharesTrend, date),
    favorites: getTrendValue(favoritesTrend, date),
    published: undefined,
    channels: {},
    extra: compactObject({
      likes: getTrendValue(likesTrend, date),
      comments: getTrendValue(commentsTrend, date),
    }),
  }));

  return { rows };
}

function parseGrowthOverview(filePath) {
  const workbook = XLSX.readFile(filePath);
  const netGrowthTrend = readTrendSheet(workbook, ['净涨粉趋势', '净增粉丝趋势']);
  const newFollowTrend = readTrendSheet(workbook, ['新增关注趋势', '新增粉丝趋势']);
  const cancelFollowTrend = readTrendSheet(workbook, ['取消关注趋势', '流失粉丝趋势']);
  const homepageVisitorsTrend = readTrendSheet(workbook, ['主页访客趋势']);
  const conversionTrend = readTrendSheet(workbook, ['主页转粉率趋势']);
  const dates = collectDates(netGrowthTrend, newFollowTrend, cancelFollowTrend, homepageVisitorsTrend, conversionTrend);

  const rows = dates.map((date) => ({
    date,
    newUser: getTrendValue(newFollowTrend, date),
    cancelUser: getTrendValue(cancelFollowTrend, date),
    netUser: getTrendValue(netGrowthTrend, date),
    totalUser: null,
    extra: compactObject({
      homepageVisitors: getTrendValue(homepageVisitorsTrend, date),
      fansConversionRate: normalizePercentOrNumber(getTrendValue(conversionTrend, date)),
    }),
  }));

  return { rows };
}

function parsePublishOverview(filePath) {
  const workbook = XLSX.readFile(filePath);
  const totalPublishTrend = readTrendSheet(workbook, ['总发布趋势']);
  const dates = collectDates(totalPublishTrend);

  const rows = dates.map((date) => ({
    date,
    readers: undefined,
    shares: undefined,
    favorites: undefined,
    published: getTrendValue(totalPublishTrend, date),
    channels: {},
    extra: {},
  }));

  return { rows };
}

function parseNotes(filePath) {
  const tables = readTabularFile(filePath);
  const table = findBestTable(tables, ['title']);
  if (!table) {
    throw new Error(`Could not parse Xiaohongshu notes file: ${filePath}`);
  }

  const notes = table.rows.map((row) => ({
    pubDate: normalizeDate(pickValue(row, 'date')),
    title: String(pickValue(row, 'title') || '').trim(),
    readers: toNumber(pickValue(row, 'readers')),
    readRatio: toRatio(pickValue(row, 'readRatio')),
    extra: compactObject({
      noteId: pickValue(row, 'noteId'),
      likes: toNumber(pickValue(row, 'likes')),
      comments: toNumber(pickValue(row, 'comments')),
      favorites: toNumber(pickValue(row, 'favorites')),
      shares: toNumber(pickValue(row, 'shares')),
    }),
  })).filter((row) => row.title);

  const readerField = table.mapping.readers != null ? table.headers[table.mapping.readers] : null;
  return { notes, readerField };
}

function mergeDailyMetrics(...groups) {
  const byDate = {};

  for (const rows of groups) {
    for (const row of rows) {
      if (!byDate[row.date]) {
        byDate[row.date] = {
          date: row.date,
          readers: 0,
          shares: 0,
          favorites: 0,
          published: 0,
          channels: {},
          extra: {},
        };
      }

      if (row.readers != null) byDate[row.date].readers = row.readers;
      if (row.shares != null) byDate[row.date].shares = row.shares;
      if (row.favorites != null) byDate[row.date].favorites = row.favorites;
      if (row.published != null) byDate[row.date].published = row.published;
      byDate[row.date].extra = { ...byDate[row.date].extra, ...(row.extra || {}) };
    }
  }

  return Object.values(byDate).sort((left, right) => left.date.localeCompare(right.date));
}

function readTrendSheet(workbook, candidateNames) {
  const sheetName = workbook.SheetNames.find((name) =>
    candidateNames.some((candidate) => name.includes(candidate))
  );
  if (!sheetName) return {};

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
  });

  const trend = {};
  for (let index = 1; index < rows.length; index++) {
    const [dateRaw, valueRaw] = rows[index];
    const date = normalizeChineseDate(dateRaw);
    if (!date) continue;
    trend[date] = toNumber(valueRaw);
  }

  return trend;
}

function collectDates(...maps) {
  return [...new Set(maps.flatMap((map) => Object.keys(map || {})))].sort();
}

function getTrendValue(trend, date) {
  if (!trend || !(date in trend)) return 0;
  return trend[date];
}

function readTabularFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath);
  const rawText = raw.toString('utf8');

  if (ext === '.html' || /<table[\s>]/i.test(rawText)) {
    return parseHtmlTables(rawText);
  }

  const workbook = XLSX.read(raw, { type: 'buffer' });
  return workbook.SheetNames.map((sheetName) => toParsedTable(workbook.Sheets[sheetName]));
}

function parseHtmlTables(html) {
  const $ = cheerio.load(html);
  const tables = [];

  $('table').each((_, tableNode) => {
    const rows = [];
    $(tableNode).find('tr').each((__, rowNode) => {
      const cells = [];
      $(rowNode).find('th, td').each((___, cellNode) => {
        cells.push($(cellNode).text().trim());
      });
      if (cells.some(Boolean)) {
        rows.push(cells);
      }
    });

    if (rows.length > 0) {
      tables.push(parseMatrix(rows));
    }
  });

  return tables;
}

function toParsedTable(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  }).map((row) => row.map((cell) => String(cell).trim()));

  return parseMatrix(matrix);
}

function parseMatrix(matrix) {
  const headerInfo = findHeaderRow(matrix);
  if (!headerInfo) {
    return { headers: [], mapping: {}, rows: [] };
  }

  const { rowIndex, headers, mapping } = headerInfo;
  const rows = [];

  for (let index = rowIndex + 1; index < matrix.length; index++) {
    const sourceRow = matrix[index];
    if (!sourceRow || sourceRow.every((cell) => !String(cell || '').trim())) {
      continue;
    }

    const row = {};
    for (const [key, columnIndex] of Object.entries(mapping)) {
      row[key] = sourceRow[columnIndex];
    }
    rows.push(row);
  }

  return { headers, mapping, rows };
}

function findHeaderRow(matrix) {
  let best = null;

  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 12); rowIndex++) {
    const row = matrix[rowIndex] || [];
    const mapping = {};

    row.forEach((cell, columnIndex) => {
      const normalized = normalizeHeader(cell);
      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.some((alias) => normalized.includes(normalizeHeader(alias)))) {
          mapping[key] = columnIndex;
          break;
        }
      }
    });

    const score = Object.keys(mapping).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { rowIndex, headers: row, mapping, score };
    }
  }

  return best;
}

function findBestTable(tables, requiredKeys) {
  let best = null;

  for (const table of tables) {
    if (!table || !table.mapping) continue;
    if (!requiredKeys.every((key) => key in table.mapping)) continue;

    const score = Object.keys(table.mapping).length + table.rows.length / 1000;
    if (!best || score > best.score) {
      best = { ...table, score };
    }
  }

  return best;
}

function pickValue(row, key) {
  return row ? row[key] : undefined;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）:：_/\\-]/g, '');
}

function normalizeDate(value) {
  const stringValue = String(value || '').trim();
  if (!stringValue) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(stringValue)) return stringValue.replace(/\//g, '-');
  if (/^\d{8}$/.test(stringValue)) {
    return `${stringValue.slice(0, 4)}-${stringValue.slice(4, 6)}-${stringValue.slice(6, 8)}`;
  }

  const numeric = Number(stringValue);
  if (!Number.isNaN(numeric) && numeric > 30000 && numeric < 70000) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const date = new Date(stringValue);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return stringValue;
}

function normalizeChineseDate(value) {
  const stringValue = String(value || '').trim();
  if (!stringValue) return '';
  const match = stringValue.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  }
  return normalizeDate(stringValue);
}

function toNumber(value) {
  if (value == null || value === '') return 0;
  const normalized = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  const numeric = Number(normalized);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function normalizePercentOrNumber(value) {
  if (value == null || value === '') return null;
  const stringValue = String(value).trim();
  if (stringValue.includes('%')) {
    return toNumber(stringValue) / 100;
  }
  const numeric = Number(stringValue);
  return Number.isNaN(numeric) ? null : numeric;
}

function toRatio(value) {
  if (value == null || value === '') return null;
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  if (stringValue.includes('%')) {
    return toNumber(stringValue) / 100;
  }
  const numeric = Number(stringValue);
  if (Number.isNaN(numeric)) return null;
  return numeric > 1 ? numeric / 100 : numeric;
}

function compactObject(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value != null && value !== '' && value !== 0)
  );
}

module.exports = {
  parseFiles,
};
