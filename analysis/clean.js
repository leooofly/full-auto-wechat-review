'use strict';

const { getPlatformTerms } = require('./terms');

function cleanAndValidate(parsedData) {
  const issues = [];
  const warnings = [];

  const terms = {
    ...getPlatformTerms(parsedData.platform),
    ...(parsedData.meta || {}),
  };

  const dailyMetrics = indexByDate(parsedData.dailyMetrics || []);
  const audienceMetrics = indexByDate(parsedData.audienceMetrics || []);
  const allDates = [...new Set([
    ...Object.keys(dailyMetrics),
    ...Object.keys(audienceMetrics),
  ])].sort();

  for (let index = 1; index < allDates.length; index++) {
    const previous = new Date(allDates[index - 1]);
    const current = new Date(allDates[index]);
    const diffDays = (current - previous) / (1000 * 60 * 60 * 24);
    if (diffDays > 1) {
      issues.push(`日期不连续: ${allDates[index - 1]} -> ${allDates[index]} (缺 ${diffDays - 1} 天)`);
    }
  }

  const dailyMerged = allDates.map((date) => {
    const metric = dailyMetrics[date] || {};
    const audience = audienceMetrics[date] || {};

    if (!dailyMetrics[date]) warnings.push(`${date}: 缺少内容指标数据`);
    if (!audienceMetrics[date]) warnings.push(`${date}: 缺少用户指标数据`);

    const readers = toSafeNumber(metric.readers);
    const shares = toSafeNumber(metric.shares);
    const favorites = toSafeNumber(metric.favorites);
    const published = toSafeNumber(metric.published);
    const newUser = toSafeNumber(audience.newUser);
    const cancelUser = toSafeNumber(audience.cancelUser);
    const netUser = toSafeNumber(audience.netUser);
    const totalUser = audience.totalUser == null || audience.totalUser === ''
      ? null
      : toSafeNumber(audience.totalUser);

    if (readers < 0) issues.push(`${date}: ${terms.readersShortLabel}为负 (${readers})`);
    if (cancelUser < 0) issues.push(`${date}: 取关为负 (${cancelUser})`);
    if (totalUser != null && totalUser > 0 && cancelUser > totalUser) {
      issues.push(`${date}: 取关 (${cancelUser}) 大于总${terms.audienceLabel} (${totalUser})`);
    }
    if (audienceMetrics[date] && netUser !== newUser - cancelUser) {
      warnings.push(`${date}: 净增 (${netUser}) ≠ 新增-取关 (${newUser}-${cancelUser}=${newUser - cancelUser})`);
    }

    const openRate = totalUser > 0 ? readers / totalUser : 0;
    const shareRate = readers > 0 ? shares / readers : 0;
    const favoriteRate = readers > 0 ? favorites / readers : 0;
    const churnRate = newUser > 0 ? cancelUser / newUser : 0;

    return {
      date,
      readers,
      shares,
      favorites,
      published,
      newUser,
      cancelUser,
      netUser,
      totalUser,
      channels: metric.channels || {},
      extra: mergeExtra(metric.extra, audience.extra),
      openRate: round4(openRate),
      shareRate: round4(shareRate),
      favoriteRate: round4(favoriteRate),
      churnRate: round4(churnRate),
    };
  });

  const contentItems = (parsedData.contentItems || []).map((item) => ({
    pubDate: normalizeDate(item.pubDate),
    title: String(item.title || '').trim(),
    readers: toSafeNumber(item.readers),
    readRatio: normalizeRatio(item.readRatio),
    extra: item.extra || {},
  })).filter((item) => item.title);

  const dateRange = {
    start: allDates[0] || null,
    end: allDates[allDates.length - 1] || null,
  };

  for (const item of contentItems) {
    if (dateRange.start && item.pubDate && (item.pubDate < dateRange.start || item.pubDate > dateRange.end)) {
      warnings.push(`${terms.contentLabel} "${item.title.slice(0, 20)}..." 的日期 ${item.pubDate} 在数据范围外`);
    }
  }

  const channelTotals = {};
  for (const day of dailyMerged) {
    for (const [channel, count] of Object.entries(day.channels || {})) {
      channelTotals[channel] = (channelTotals[channel] || 0) + toSafeNumber(count);
    }
  }

  const knownTotalUsers = dailyMerged.filter((row) => row.totalUser != null);
  const hasTotalUsers = knownTotalUsers.length >= 2;
  const derivedNetGrowth = sumBy(dailyMerged, 'netUser');

  const summary = {
    platform: parsedData.platform,
    dateRange,
    totalDays: dailyMerged.length,
    totalReaders: sumBy(dailyMerged, 'readers'),
    totalShares: sumBy(dailyMerged, 'shares'),
    totalFavorites: sumBy(dailyMerged, 'favorites'),
    totalNewUsers: sumBy(dailyMerged, 'newUser'),
    totalCancelUsers: sumBy(dailyMerged, 'cancelUser'),
    netGrowth: hasTotalUsers
      ? knownTotalUsers[knownTotalUsers.length - 1].totalUser - knownTotalUsers[0].totalUser
      : derivedNetGrowth,
    startFollowers: hasTotalUsers ? knownTotalUsers[0].totalUser : null,
    endFollowers: hasTotalUsers ? knownTotalUsers[knownTotalUsers.length - 1].totalUser : null,
    totalArticles: contentItems.length,
    totalPublishDays: dailyMerged.filter((day) => day.published > 0).length,
    avgDailyReaders: dailyMerged.length > 0
      ? Math.round(sumBy(dailyMerged, 'readers') / dailyMerged.length)
      : 0,
    avgShareRate: dailyMerged.length > 0
      ? round4(sumBy(dailyMerged, 'shareRate') / dailyMerged.length)
      : 0,
  };

  const cleanData = {
    platform: parsedData.platform,
    meta: {
      ...terms,
      fieldMapping: parsedData.meta && parsedData.meta.fieldMapping ? parsedData.meta.fieldMapping : {},
      sourceFiles: parsedData.meta && parsedData.meta.sourceFiles ? parsedData.meta.sourceFiles : {},
      hasChannelBreakdown: Object.keys(channelTotals).length > 0,
    },
    dailyMerged,
    articles: contentItems,
    articlesByChannel: parsedData.contentBreakdown || [],
    channelTotals,
    summary,
  };

  const qualityReport = {
    issues,
    warnings,
    issueCount: issues.length,
    warningCount: warnings.length,
    coverage: {
      contentDays: Object.keys(dailyMetrics).length,
      audienceDays: Object.keys(audienceMetrics).length,
      contentItems: contentItems.length,
    },
  };

  console.log(`[clean] 平台 ${terms.platformName} 合并 ${dailyMerged.length} 天数据，${contentItems.length} 篇内容`);
  console.log(`[clean] 质量报告: ${issues.length} 个问题, ${warnings.length} 个警告`);

  return { cleanData, qualityReport };
}

function indexByDate(rows) {
  return Object.fromEntries(
    rows
      .filter((row) => row && row.date)
      .map((row) => [normalizeDate(row.date), row])
  );
}

function normalizeDate(value) {
  const stringValue = String(value || '').trim();
  if (!stringValue) return '';
  return stringValue.replace(/\//g, '-').slice(0, 10);
}

function normalizeRatio(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric > 1 ? round4(numeric / 100) : round4(numeric);
}

function toSafeNumber(value) {
  const numeric = Number(value || 0);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + toSafeNumber(row[key]), 0);
}

function mergeExtra(...extras) {
  return extras.reduce((result, extra) => {
    if (!extra) return result;
    return { ...result, ...extra };
  }, {});
}

module.exports = { cleanAndValidate };
