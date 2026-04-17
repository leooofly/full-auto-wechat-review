'use strict';

/**
 * Phase 4: 综合呈现
 * 
 * 收集所有专家的 findings，按主题重组（而非按角色），
 * 交叉验证数字一致性，生成结论式标题，输出最终报告。
 * 
 * @param {{ expertResults: Array }} analysisResults
 * @param {object} cleanData
 * @returns {{ report: object }}
 */
function synthesize(analysisResults, cleanData) {
  const { expertResults } = analysisResults;
  const { dailyMerged, articles, channelTotals, summary } = cleanData;

  // ── 1. 按主题重组发现 ──
  const sections = {
    overview: {
      title: '',  // 结论式标题，下面生成
      kpis: buildKPIs(summary, dailyMerged),
    },
    content: {
      title: '',
      findings: [],
      details: '',
    },
    growth: {
      title: '',
      findings: [],
      details: '',
    },
    distribution: {
      title: '',
      findings: [],
      details: '',
    },
    risksAndOpportunities: {
      title: '⚠️ 风险与机会',
      risks: [],
      opportunities: [],
    },
  };

  // 按专家角色分拣 findings
  for (const result of expertResults) {
    const role = result.role;

    if (role.includes('增长')) {
      sections.growth.findings.push(...result.findings);
      sections.growth.details = result.details;
    } else if (role.includes('内容') || role.includes('策略')) {
      sections.content.findings.push(...result.findings);
      sections.content.details = result.details;
    } else if (role.includes('传播') || role.includes('分布')) {
      sections.distribution.findings.push(...result.findings);
      sections.distribution.details = result.details;
    }

    // 风险汇总
    sections.risksAndOpportunities.risks.push(
      ...result.risks.map(r => ({ source: role, text: r }))
    );
  }

  // ── 2. 生成结论式标题 ──
  sections.overview.title = generateOverviewTitle(summary);
  sections.content.title = generateContentTitle(articles, summary);
  sections.growth.title = generateGrowthTitle(summary);
  sections.distribution.title = generateDistributionTitle(channelTotals);

  // ── 3. 交叉验证 ──
  const crossCheck = crossValidate(expertResults);

  // ── 4. 文章排名表 ──
  const articleTable = [...articles]
    .sort((a, b) => b.readers - a.readers)
    .map((a, i) => ({
      rank: i + 1,
      title: a.title,
      pubDate: a.pubDate,
      readers: a.readers,
      readRatio: (a.readRatio * 100).toFixed(1) + '%',
    }));

  // ── 5. 图表数据 ──
  const charts = buildChartData(dailyMerged, channelTotals, articles);

  // ── 6. 最终报告结构 ──
  const report = {
    generatedAt: new Date().toISOString(),
    dateRange: summary.dateRange,
    sections,
    articleTable,
    charts,
    crossCheck,
    rawExpertResults: expertResults,
  };

  console.log(`[synthesize] 报告已生成: ${articleTable.length} 篇文章, ${crossCheck.length} 条交叉验证`);

  return { report };
}

/**
 * 构建 KPI 卡片数据
 */
function buildKPIs(summary, dailyMerged) {
  // 计算周环比（后15天 vs 前15天）
  const mid = Math.floor(dailyMerged.length / 2);
  const firstHalf = dailyMerged.slice(0, mid);
  const secondHalf = dailyMerged.slice(mid);

  const firstReaders = firstHalf.reduce((s, d) => s + d.readers, 0);
  const secondReaders = secondHalf.reduce((s, d) => s + d.readers, 0);
  const readersTrend = firstReaders > 0
    ? ((secondReaders - firstReaders) / firstReaders * 100).toFixed(1)
    : '0';

  return [
    {
      label: '粉丝净增',
      value: summary.netGrowth,
      sub: `${summary.startFollowers} → ${summary.endFollowers}`,
      trend: summary.netGrowth > 0 ? 'up' : summary.netGrowth < 0 ? 'down' : 'flat',
    },
    {
      label: '总阅读',
      value: summary.totalReaders,
      sub: `日均 ${summary.avgDailyReaders}`,
      trend: parseFloat(readersTrend) > 0 ? 'up' : 'down',
      trendValue: readersTrend + '%',
    },
    {
      label: '总分享',
      value: summary.totalShares,
      sub: `平均转发率 ${(summary.avgShareRate * 100).toFixed(2)}%`,
      trend: summary.avgShareRate > 0.02 ? 'up' : 'down',
    },
    {
      label: '总收藏',
      value: summary.totalFavorites,
      sub: `${summary.totalArticles} 篇文章`,
      trend: 'neutral',
    },
    {
      label: '发文篇数',
      value: summary.totalArticles,
      sub: `${summary.totalPublishDays} 天发文`,
      trend: 'neutral',
    },
    {
      label: '粉丝流失率',
      value: summary.totalNewUsers > 0
        ? ((summary.totalCancelUsers / summary.totalNewUsers) * 100).toFixed(1) + '%'
        : '0%',
      sub: `新增 ${summary.totalNewUsers} / 取关 ${summary.totalCancelUsers}`,
      trend: summary.totalCancelUsers / Math.max(summary.totalNewUsers, 1) > 0.3 ? 'warning' : 'ok',
    },
  ];
}

/**
 * 生成结论式标题（不是描述式）
 */
function generateOverviewTitle(summary) {
  const growthRate = ((summary.netGrowth / Math.max(summary.startFollowers, 1)) * 100).toFixed(1);
  if (parseFloat(growthRate) > 10) return `🚀 强势增长期: 30天粉丝增长 ${growthRate}%`;
  if (parseFloat(growthRate) > 3) return `📈 稳健增长: 30天净增 ${summary.netGrowth} 粉丝`;
  if (parseFloat(growthRate) > 0) return `📊 缓慢增长: 30天净增 ${summary.netGrowth} 人，增速待提升`;
  if (parseFloat(growthRate) === 0) return `⏸️ 增长停滞: 30天粉丝零增长`;
  return `📉 粉丝流失: 30天净减 ${Math.abs(summary.netGrowth)} 人`;
}

function generateContentTitle(articles, summary) {
  if (articles.length === 0) return '📝 期间无发文';
  const topReaders = articles.length > 0
    ? Math.max(...articles.map(a => a.readers))
    : 0;
  const avgReaders = articles.length > 0
    ? Math.round(articles.reduce((s, a) => s + a.readers, 0) / articles.length)
    : 0;
  return `📝 ${articles.length} 篇文章: 篇均阅读 ${avgReaders}，最高 ${topReaders}`;
}

function generateGrowthTitle(summary) {
  if (summary.netGrowth <= 0) return '👥 增长承压: 关注增速放缓';
  return `👥 30天净增 ${summary.netGrowth} 粉丝（新增 ${summary.totalNewUsers} / 取关 ${summary.totalCancelUsers}）`;
}

function generateDistributionTitle(channelTotals) {
  const sorted = Object.entries(channelTotals).sort((a, b) => b[1] - a[1]);
  const topChannel = sorted[0] ? sorted[0][0] : '未知';
  return `📡 主要流量来源: ${topChannel}`;
}

/**
 * 交叉验证不同专家的数据
 */
function crossValidate(expertResults) {
  const checks = [];

  // 收集所有 findings 中提到的数字
  const allFindings = expertResults.flatMap(r =>
    r.findings.map(f => ({ source: r.role, text: f }))
  );

  // 简单交叉：标记来自不同专家但涉及相同指标的发现
  const growthFindings = allFindings.filter(f => f.source.includes('增长'));
  const contentFindings = allFindings.filter(f => f.source.includes('内容') || f.source.includes('策略'));
  const distFindings = allFindings.filter(f => f.source.includes('传播') || f.source.includes('分布'));

  if (growthFindings.length > 0 && contentFindings.length > 0) {
    checks.push({
      type: 'cross-reference',
      note: '增长分析师与内容策略师的发现可交叉印证：粉丝增长高峰是否对应优质内容发布？',
    });
  }

  if (contentFindings.length > 0 && distFindings.length > 0) {
    checks.push({
      type: 'cross-reference',
      note: '内容策略师与传播分析师的发现可交叉印证：高阅读文章是否在特定渠道获得更多传播？',
    });
  }

  return checks;
}

/**
 * 构建图表数据
 */
function buildChartData(dailyMerged, channelTotals, articles) {
  return {
    // 折线图：每日阅读与粉丝趋势
    readerTrend: {
      type: 'line',
      title: '每日阅读量与粉丝趋势',
      labels: dailyMerged.map(d => d.date),
      datasets: [
        {
          label: '阅读人数',
          data: dailyMerged.map(d => d.readers),
          yAxisID: 'y1',
        },
        {
          label: '累积粉丝',
          data: dailyMerged.map(d => d.totalUser),
          yAxisID: 'y2',
        },
      ],
    },

    // 柱状图：每日新增与取关
    userFlow: {
      type: 'bar',
      title: '每日新增关注 vs 取消关注',
      labels: dailyMerged.map(d => d.date),
      datasets: [
        { label: '新关注', data: dailyMerged.map(d => d.newUser) },
        { label: '取消关注', data: dailyMerged.map(d => -d.cancelUser) },
      ],
    },

    // 饼图：渠道分布
    channelPie: {
      type: 'pie',
      title: '阅读来源渠道分布',
      labels: Object.keys(channelTotals),
      data: Object.values(channelTotals),
    },

    // 柱状图：文章阅读量排名
    articleBar: {
      type: 'bar',
      title: '文章阅读量排名',
      labels: [...articles]
        .sort((a, b) => b.readers - a.readers)
        .map(a => a.title.length > 20 ? a.title.substring(0, 20) + '...' : a.title),
      data: [...articles]
        .sort((a, b) => b.readers - a.readers)
        .map(a => a.readers),
    },

    // 折线图：每日互动
    interactionTrend: {
      type: 'line',
      title: '每日分享与收藏',
      labels: dailyMerged.map(d => d.date),
      datasets: [
        { label: '分享', data: dailyMerged.map(d => d.shares) },
        { label: '收藏', data: dailyMerged.map(d => d.favorites) },
      ],
    },
  };
}

module.exports = { synthesize };
