'use strict';

const { getPlatformTerms } = require('./terms');

function synthesize(analysisResults, cleanData) {
  const terms = {
    ...getPlatformTerms(cleanData.platform),
    ...(cleanData.meta || {}),
  };
  const expertResults = Array.isArray(analysisResults.expertResults)
    ? analysisResults.expertResults
    : [];
  const { dailyMerged, articles, channelTotals, summary } = cleanData;

  const sections = {
    overview: {
      title: generateOverviewTitle(summary, terms),
      kpis: buildKPIs(summary, dailyMerged, terms),
    },
    content: {
      title: generateContentTitle(articles, terms),
      findings: [],
      details: '',
    },
    growth: {
      title: generateGrowthTitle(summary, terms),
      findings: [],
      details: '',
    },
    distribution: {
      title: generateDistributionTitle(channelTotals, terms),
      findings: [],
      details: '',
    },
    risksAndOpportunities: {
      title: '风险与建议',
      risks: [],
      opportunities: [],
    },
  };

  for (const result of expertResults) {
    if (isGrowthRole(result.role)) {
      sections.growth.findings.push(...(result.findings || []));
      sections.growth.details = result.details || '';
    } else if (isContentRole(result.role)) {
      sections.content.findings.push(...(result.findings || []));
      sections.content.details = result.details || '';
    } else if (isDistributionRole(result.role)) {
      sections.distribution.findings.push(...(result.findings || []));
      sections.distribution.details = result.details || '';
    } else {
      sections.distribution.findings.push(...(result.findings || []));
      if (!sections.distribution.details) {
        sections.distribution.details = result.details || '';
      }
    }

    sections.risksAndOpportunities.risks.push(
      ...(result.risks || []).map((risk) => ({ source: result.role, text: risk }))
    );
  }

  const articleTable = [...articles]
    .sort((left, right) => right.readers - left.readers)
    .map((article, index) => ({
      rank: index + 1,
      title: article.title,
      pubDate: article.pubDate,
      readers: article.readers,
      readRatio: article.readRatio == null ? '—' : `${(article.readRatio * 100).toFixed(1)}%`,
      extra: article.extra || {},
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    platform: cleanData.platform,
    meta: {
      ...terms,
      hasChannelBreakdown: Object.keys(channelTotals).length > 0,
    },
    dateRange: summary.dateRange,
    sections,
    articleTable,
    charts: buildChartData(dailyMerged, channelTotals, articles, terms),
    crossCheck: crossValidate(expertResults, terms),
    rawExpertResults: expertResults,
  };

  console.log(`[synthesize] 报告已生成: ${articleTable.length} 条${terms.contentLabel}数据`);
  return { report };
}

function buildKPIs(summary, dailyMerged, terms) {
  const middle = Math.floor(dailyMerged.length / 2);
  const firstHalf = dailyMerged.slice(0, middle);
  const secondHalf = dailyMerged.slice(middle);
  const firstReaders = sumBy(firstHalf, 'readers');
  const secondReaders = sumBy(secondHalf, 'readers');
  const readersTrend = firstReaders > 0
    ? ((secondReaders - firstReaders) / firstReaders * 100).toFixed(1)
    : '0.0';

  return [
    {
      label: `${terms.audienceLabel}净增`,
      value: summary.netGrowth,
      sub: summary.startFollowers != null && summary.endFollowers != null
        ? `${summary.startFollowers} -> ${summary.endFollowers}`
        : '当前仅基于净涨粉趋势汇总',
      trend: summary.netGrowth > 0 ? 'up' : summary.netGrowth < 0 ? 'down' : 'flat',
    },
    {
      label: `总${terms.readerLabel}`,
      value: summary.totalReaders,
      sub: `日均 ${summary.avgDailyReaders}`,
      trendValue: `${readersTrend}%`,
      trend: Number(readersTrend) >= 0 ? 'up' : 'down',
    },
    {
      label: '总分享',
      value: summary.totalShares,
      sub: `平均分享率 ${(summary.avgShareRate * 100).toFixed(2)}%`,
      trend: summary.avgShareRate > 0.02 ? 'up' : 'down',
    },
    {
      label: '总收藏',
      value: summary.totalFavorites,
      sub: `${summary.totalArticles} 条${terms.contentLabel}`,
      trend: 'neutral',
    },
    {
      label: `${terms.contentLabel}数`,
      value: summary.totalArticles,
      sub: `${summary.totalPublishDays} 天发布`,
      trend: 'neutral',
    },
    {
      label: `${terms.audienceLabel}流失率`,
      value: summary.totalNewUsers > 0
        ? `${((summary.totalCancelUsers / summary.totalNewUsers) * 100).toFixed(1)}%`
        : '0%',
      sub: `新增 ${summary.totalNewUsers} / 取关 ${summary.totalCancelUsers}`,
      trend: summary.totalCancelUsers / Math.max(summary.totalNewUsers, 1) > 0.3 ? 'warning' : 'ok',
    },
  ];
}

function generateOverviewTitle(summary, terms) {
  if (summary.startFollowers == null || summary.endFollowers == null) {
    if (summary.netGrowth > 0) return `${terms.platformName}${terms.audienceLabel}处于增长状态，近 30 天净增 ${summary.netGrowth}`;
    if (summary.netGrowth < 0) return `${terms.platformName}${terms.audienceLabel}出现流失，近 30 天净减 ${Math.abs(summary.netGrowth)}`;
    return `${terms.platformName}${terms.audienceLabel}整体平稳，近 30 天净增接近 0`;
  }

  const growthRate = ((summary.netGrowth / Math.max(summary.startFollowers, 1)) * 100).toFixed(1);
  if (Number(growthRate) > 10) return `${terms.platformName}${terms.audienceLabel}增长强劲，近 30 天增长 ${growthRate}%`;
  if (Number(growthRate) > 3) return `${terms.platformName}${terms.audienceLabel}稳步增长，近 30 天净增 ${summary.netGrowth}`;
  if (Number(growthRate) > 0) return `${terms.platformName}${terms.audienceLabel}缓慢增长，当前仍有提速空间`;
  if (Number(growthRate) === 0) return `${terms.platformName}${terms.audienceLabel}增长停滞，近 30 天净增为 0`;
  return `${terms.platformName}${terms.audienceLabel}出现流失，近 30 天净减 ${Math.abs(summary.netGrowth)}`;
}

function generateContentTitle(articles, terms) {
  if (articles.length === 0) return `本期暂无${terms.contentLabel}`;
  const topReaders = Math.max(...articles.map((article) => article.readers));
  const avgReaders = Math.round(sumBy(articles, 'readers') / articles.length);
  return `${articles.length} 条${terms.contentLabel}，平均${terms.readerLabel} ${avgReaders}，最高 ${topReaders}`;
}

function generateGrowthTitle(summary, terms) {
  if (summary.netGrowth <= 0) return `${terms.audienceLabel}增长承压，新增转化仍需优化`;
  return `近 30 天净增 ${summary.netGrowth} ${terms.audienceLabel}（新增 ${summary.totalNewUsers} / 取关 ${summary.totalCancelUsers}）`;
}

function generateDistributionTitle(channelTotals, terms) {
  const entries = Object.entries(channelTotals).sort((left, right) => right[1] - left[1]);
  if (entries.length === 0) {
    return `当前缺少${terms.channelLabel}拆分，重点观察分享与收藏带来的二次传播`;
  }
  return `主要${terms.channelLabel}: ${entries[0][0]}`;
}

function crossValidate(expertResults, terms) {
  const checks = [];
  const growth = expertResults.find((result) => isGrowthRole(result.role));
  const content = expertResults.find((result) => isContentRole(result.role));
  const distribution = expertResults.find((result) => isDistributionRole(result.role));

  if (growth && content) {
    checks.push({
      type: 'cross-reference',
      note: `验证${terms.audienceLabel}增长高峰是否与高表现${terms.contentLabel}发布时间一致。`,
    });
  }

  if (content && distribution) {
    checks.push({
      type: 'cross-reference',
      note: `验证高表现${terms.contentLabel}是否同时带来更强的分享、收藏与二次分发。`,
    });
  }

  return checks;
}

function buildChartData(dailyMerged, channelTotals, articles, terms) {
  return {
    readerTrend: {
      type: 'line',
      title: `每日${terms.readerLabel}与${terms.audienceLabel}趋势`,
      labels: dailyMerged.map((day) => day.date),
      datasets: [
        { label: terms.readerLabel, data: dailyMerged.map((day) => day.readers), yAxisID: 'y1' },
        { label: `累计${terms.audienceLabel}`, data: dailyMerged.map((day) => day.totalUser), yAxisID: 'y2' },
      ],
    },
    userFlow: {
      type: 'bar',
      title: `每日新增${terms.audienceLabel} vs 取关`,
      labels: dailyMerged.map((day) => day.date),
      datasets: [
        { label: `新增${terms.audienceLabel}`, data: dailyMerged.map((day) => day.newUser) },
        { label: '取关', data: dailyMerged.map((day) => -day.cancelUser) },
      ],
    },
    channelPie: {
      type: 'pie',
      title: `${terms.channelLabel}分布`,
      labels: Object.keys(channelTotals),
      data: Object.values(channelTotals),
    },
    articleBar: {
      type: 'bar',
      title: `${terms.contentLabel}表现排名`,
      labels: [...articles]
        .sort((left, right) => right.readers - left.readers)
        .map((article) => article.title.length > 20 ? `${article.title.slice(0, 20)}...` : article.title),
      data: [...articles]
        .sort((left, right) => right.readers - left.readers)
        .map((article) => article.readers),
    },
    interactionTrend: {
      type: 'line',
      title: '每日分享与收藏',
      labels: dailyMerged.map((day) => day.date),
      datasets: [
        { label: '分享', data: dailyMerged.map((day) => day.shares) },
        { label: '收藏', data: dailyMerged.map((day) => day.favorites) },
      ],
    },
  };
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function isGrowthRole(role) {
  return String(role || '').includes('增长');
}

function isContentRole(role) {
  return String(role || '').includes('内容');
}

function isDistributionRole(role) {
  const value = String(role || '');
  return value.includes('分发') || value.includes('传播');
}

module.exports = { synthesize };
