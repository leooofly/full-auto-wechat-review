'use strict';

const { getPlatformTerms } = require('./terms');

function castExperts(cleanData, qualityReport) {
  const terms = {
    ...getPlatformTerms(cleanData.platform),
    ...(cleanData.meta || {}),
  };

  const dataContext = buildDataContext(cleanData);
  const experts = [
    buildGrowthAnalyst(dataContext, cleanData.summary, qualityReport, terms),
    buildContentStrategist(dataContext, cleanData.summary, qualityReport, terms),
    buildDistributionAnalyst(dataContext, cleanData.summary, qualityReport, terms),
  ];

  console.log(`[casting] 已生成 ${experts.length} 位专家 prompt`);
  return { experts };
}

function buildDataContext(cleanData) {
  const { dailyMerged, articles, channelTotals, summary } = cleanData;

  const growthTrend = dailyMerged.map((day) => ({
    date: day.date,
    totalUser: day.totalUser,
    newUser: day.newUser,
    cancelUser: day.cancelUser,
    readers: day.readers,
    shares: day.shares,
    favorites: day.favorites,
    published: day.published,
    openRate: day.openRate,
    shareRate: day.shareRate,
    extra: day.extra || {},
  }));

  const articleRank = [...articles]
    .sort((left, right) => right.readers - left.readers)
    .map((article, index) => ({
      rank: index + 1,
      title: article.title,
      pubDate: article.pubDate,
      readers: article.readers,
      readRatio: article.readRatio,
      extra: article.extra || {},
    }));

  return {
    summary,
    growthTrend: JSON.stringify(growthTrend, null, 2),
    articleRank: JSON.stringify(articleRank, null, 2),
    channelTotals: JSON.stringify(channelTotals, null, 2),
  };
}

function buildGrowthAnalyst(ctx, summary, qr, terms) {
  return {
    role: '增长分析师',
    anchor: 'Andrew Chen（增长黑客、网络效应专家）',
    focusAreas: [`${terms.audienceLabel}增长趋势`, '获客来源归因', '留存与流失', '增长率分解'],
    prompt: `# 角色定义

你是一位资深的增长分析师，思维方式类似 Andrew Chen。你正在分析 ${terms.platformName} 的运营数据。

# 分析对象

${terms.platformName}${terms.accountLabel}最近 30 天数据（${summary.dateRange.start} 至 ${summary.dateRange.end}）。

# 核心指标概览

- 起始${terms.audienceLabel}: ${summary.startFollowers}，结束${terms.audienceLabel}: ${summary.endFollowers}
- 净增${terms.audienceLabel}: ${summary.netGrowth}
- 新增总量: ${summary.totalNewUsers}，取关总量: ${summary.totalCancelUsers}
- 总${terms.readerLabel}: ${summary.totalReaders}，日均 ${summary.avgDailyReaders}
- 发布${terms.contentLabelPlural}: ${summary.totalArticles}，发布天数: ${summary.totalPublishDays}

# 数据质量说明

${qr.issueCount > 0 ? `严重问题: ${qr.issues.join('; ')}` : '无严重数据质量问题'}
${qr.warningCount > 0 ? `警告: ${qr.warnings.slice(0, 5).join('; ')}` : ''}

# 每日数据

\`\`\`json
${ctx.growthTrend}
\`\`\`

# 分析任务

请从增长角度进行分析，输出：

1. 3-5 条带具体数字的核心发现
2. 详细分析：增长驱动、获客、流失、停滞期
3. 当前增长模式的风险
4. 建议可视化图表

请以 JSON 输出：
\`\`\`json
{
  "role": "增长分析师",
  "findings": ["发现1", "发现2"],
  "details": "详细分析",
  "risks": ["风险1"],
  "charts": [{"type": "line", "title": "图表标题", "fields": ["date", "readers"]}]
}
\`\`\``,
  };
}

function buildContentStrategist(ctx, summary, qr, terms) {
  return {
    role: '内容策略师',
    anchor: 'Ann Handley（内容营销专家）',
    focusAreas: [`${terms.contentLabel}表现`, '选题效果', '标题吸引力', '内容节奏'],
    prompt: `# 角色定义

你是一位资深的内容策略师，正在分析 ${terms.platformName}${terms.accountLabel}最近 30 天的 ${terms.contentLabel}表现。

# 核心指标概览

- 发布${terms.contentLabelPlural}: ${summary.totalArticles}
- 总${terms.readerLabel}: ${summary.totalReaders}
- 总分享: ${summary.totalShares}
- 总收藏: ${summary.totalFavorites}
- 当前${terms.audienceLabel}: ${summary.endFollowers}

# ${terms.contentLabel}排名

\`\`\`json
${ctx.articleRank}
\`\`\`

# 每日互动与发布节奏

\`\`\`json
${ctx.growthTrend}
\`\`\`

# 分析任务

请从内容策略角度输出：

1. 3-5 条带数字的核心发现
2. 详细分析：选题、标题、节奏、互动质量
3. 内容策略风险
4. 建议可视化图表

JSON 输出格式同上。`,
  };
}

function buildDistributionAnalyst(ctx, summary, qr, terms) {
  const hasChannels = Object.keys(JSON.parse(ctx.channelTotals || '{}')).length > 0;

  return {
    role: '分发分析师',
    anchor: 'Jonah Berger（传播研究者）',
    focusAreas: [terms.channelLabel, '分享裂变', '收藏率', '传播路径'],
    prompt: `# 角色定义

你是一位资深的分发分析师，正在分析 ${terms.platformName}${terms.accountLabel}最近 30 天的传播与分发情况。

# 核心指标概览

- 总${terms.readerLabel}: ${summary.totalReaders}
- 总分享: ${summary.totalShares}
- 总收藏: ${summary.totalFavorites}
- 平均分享率: ${(summary.avgShareRate * 100).toFixed(2)}%

# ${terms.channelLabel}数据

\`\`\`json
${ctx.channelTotals}
\`\`\`

# 每日表现

\`\`\`json
${ctx.growthTrend}
\`\`\`

# ${terms.contentLabel}排名

\`\`\`json
${ctx.articleRank}
\`\`\`

# 分析任务

请从分发角度输出：

1. 3-5 条带数字的核心发现
2. 详细分析：${hasChannels ? `${terms.channelLabel}贡献、分享扩散、推荐/搜索潜力` : '分享、收藏、内容扩散能力'}
3. 分发层面的风险
4. 建议可视化图表

JSON 输出格式同上。`,
  };
}

module.exports = { castExperts };
