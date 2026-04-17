'use strict';

/**
 * Phase 1: 数据清洗与校验
 * 
 * 合并 articles + users 数据，按日期对齐，计算衍生指标。
 * 
 * @param {{ dailyReadByChannel, dailyInteraction, articles, articlesByChannel }} articlesData
 * @param {{ dailyUsers }} usersData
 * @returns {{ cleanData: object, qualityReport: object }}
 */
function cleanAndValidate(articlesData, usersData) {
  const issues = [];
  const warnings = [];

  const { dailyReadByChannel, dailyInteraction, articles, articlesByChannel } = articlesData;
  const { dailyUsers } = usersData;

  // ── 1. 提取每日总阅读（渠道=全部）──
  const dailyTotalRead = {};
  const dailyChannelRead = {};
  for (const row of dailyReadByChannel) {
    if (row.channel === '全部') {
      dailyTotalRead[row.date] = row.readers;
    } else {
      if (!dailyChannelRead[row.date]) dailyChannelRead[row.date] = {};
      dailyChannelRead[row.date][row.channel] = row.readers;
    }
  }

  // ── 2. 互动数据索引 ──
  const interactionByDate = {};
  for (const row of dailyInteraction) {
    interactionByDate[row.date] = row;
  }

  // ── 3. 用户数据索引 ──
  const usersByDate = {};
  for (const row of dailyUsers) {
    usersByDate[row.date] = row;
  }

  // ── 4. 收集所有日期并排序 ──
  const allDates = new Set([
    ...Object.keys(dailyTotalRead),
    ...Object.keys(interactionByDate),
    ...Object.keys(usersByDate),
  ]);
  const sortedDates = [...allDates].sort();

  // ── 5. 日期连续性检查 ──
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays > 1) {
      issues.push(`日期不连续: ${sortedDates[i - 1]} → ${sortedDates[i]} (缺 ${diffDays - 1} 天)`);
    }
  }

  // ── 6. 合并数据 + 校验 + 衍生指标 ──
  const dailyMerged = [];
  for (const date of sortedDates) {
    const totalRead = dailyTotalRead[date];
    const interaction = interactionByDate[date];
    const user = usersByDate[date];
    const channels = dailyChannelRead[date] || {};

    // 缺失值检查
    if (totalRead == null) warnings.push(`${date}: 缺少阅读数据`);
    if (!interaction) warnings.push(`${date}: 缺少互动数据`);
    if (!user) warnings.push(`${date}: 缺少用户数据`);

    const readers = totalRead ?? 0;
    const shares = interaction ? interaction.shares : 0;
    const readOriginal = interaction ? interaction.readOriginal : 0;
    const favorites = interaction ? interaction.favorites : 0;
    const published = interaction ? interaction.published : 0;
    const newUser = user ? user.newUser : 0;
    const cancelUser = user ? user.cancelUser : 0;
    const netUser = user ? user.netUser : 0;
    const totalUser = user ? user.totalUser : 0;

    // 合理性检查
    if (readers < 0) issues.push(`${date}: 阅读人数为负 (${readers})`);
    if (cancelUser < 0) issues.push(`${date}: 取关人数为负 (${cancelUser})`);
    if (totalUser > 0 && cancelUser > totalUser) {
      issues.push(`${date}: 取关 (${cancelUser}) 大于总粉丝 (${totalUser})`);
    }
    if (netUser !== newUser - cancelUser) {
      warnings.push(`${date}: 净增 (${netUser}) ≠ 新增-取关 (${newUser}-${cancelUser}=${newUser - cancelUser})`);
    }

    // 衍生指标
    const openRate = totalUser > 0 ? readers / totalUser : 0;         // 日打开率估算
    const shareRate = readers > 0 ? shares / readers : 0;             // 转发率
    const favoriteRate = readers > 0 ? favorites / readers : 0;       // 收藏率
    const churnRate = newUser > 0 ? cancelUser / newUser : 0;         // 流失率

    dailyMerged.push({
      date,
      readers,
      channels,
      shares,
      readOriginal,
      favorites,
      published,
      newUser,
      cancelUser,
      netUser,
      totalUser,
      // 衍生指标
      openRate: round4(openRate),
      shareRate: round4(shareRate),
      favoriteRate: round4(favoriteRate),
      churnRate: round4(churnRate),
    });
  }

  // ── 7. 文章数据校验 ──
  const articlesCleaned = articles.map(a => ({
    ...a,
    title: a.title.trim(),
  }));

  // 检查文章日期是否在数据范围内
  const dateRange = { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] };
  for (const article of articlesCleaned) {
    if (article.pubDate < dateRange.start || article.pubDate > dateRange.end) {
      warnings.push(`文章 "${article.title.substring(0, 20)}..." 发表日期 ${article.pubDate} 在数据范围外`);
    }
  }

  // ── 8. 汇总统计 ──
  const summary = {
    dateRange,
    totalDays: sortedDates.length,
    totalReaders: dailyMerged.reduce((s, d) => s + d.readers, 0),
    totalShares: dailyMerged.reduce((s, d) => s + d.shares, 0),
    totalFavorites: dailyMerged.reduce((s, d) => s + d.favorites, 0),
    totalNewUsers: dailyMerged.reduce((s, d) => s + d.newUser, 0),
    totalCancelUsers: dailyMerged.reduce((s, d) => s + d.cancelUser, 0),
    netGrowth: dailyMerged.length > 0
      ? (dailyMerged[dailyMerged.length - 1].totalUser - dailyMerged[0].totalUser)
      : 0,
    startFollowers: dailyMerged.length > 0 ? dailyMerged[0].totalUser : 0,
    endFollowers: dailyMerged.length > 0 ? dailyMerged[dailyMerged.length - 1].totalUser : 0,
    totalArticles: articlesCleaned.length,
    totalPublishDays: dailyMerged.filter(d => d.published > 0).length,
    avgDailyReaders: dailyMerged.length > 0
      ? Math.round(dailyMerged.reduce((s, d) => s + d.readers, 0) / dailyMerged.length)
      : 0,
    avgShareRate: dailyMerged.length > 0
      ? round4(dailyMerged.reduce((s, d) => s + d.shareRate, 0) / dailyMerged.length)
      : 0,
  };

  // ── 9. 构建渠道汇总 ──
  const channelTotals = {};
  for (const d of dailyMerged) {
    for (const [ch, count] of Object.entries(d.channels)) {
      channelTotals[ch] = (channelTotals[ch] || 0) + count;
    }
  }

  const cleanData = {
    dailyMerged,
    articles: articlesCleaned,
    articlesByChannel: articlesByChannel || [],
    channelTotals,
    summary,
  };

  const qualityReport = {
    issues,     // 严重问题
    warnings,   // 警告
    issueCount: issues.length,
    warningCount: warnings.length,
    coverage: {
      readDays: Object.keys(dailyTotalRead).length,
      interactionDays: Object.keys(interactionByDate).length,
      userDays: Object.keys(usersByDate).length,
    },
  };

  console.log(`[clean] 合并 ${dailyMerged.length} 天数据，${articlesCleaned.length} 篇文章`);
  console.log(`[clean] 质量报告: ${issues.length} 个问题, ${warnings.length} 个警告`);

  return { cleanData, qualityReport };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

module.exports = { cleanAndValidate };
