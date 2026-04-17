'use strict';

/**
 * Phase 2: 多专家选角
 * 
 * 基于公众号数据场景，生成3位专家的完整分析 prompt。
 * 每位专家有独立的角色定义、关注维度、分析方法和具体任务。
 * 
 * @param {{ dailyMerged, articles, channelTotals, summary }} cleanData
 * @param {object} qualityReport
 * @returns {{ experts: Array<{ role, anchor, prompt, focusAreas }> }}
 */
function castExperts(cleanData, qualityReport) {
  const { dailyMerged, articles, articlesByChannel, channelTotals, summary } = cleanData;

  // 为每位专家准备针对性的数据摘要
  const dataContext = buildDataContext(cleanData);

  const experts = [
    buildGrowthAnalyst(dataContext, summary, qualityReport),
    buildContentStrategist(dataContext, summary, qualityReport),
    buildDistributionAnalyst(dataContext, summary, qualityReport),
  ];

  console.log(`[casting] 已生成 ${experts.length} 位专家 prompt`);
  for (const e of experts) {
    console.log(`  → ${e.role} (锚定: ${e.anchor})`);
  }

  return { experts };
}

/**
 * 构建数据上下文（各专家共用）
 */
function buildDataContext(cleanData) {
  const { dailyMerged, articles, channelTotals, summary } = cleanData;

  // 用户增长趋势（简化版，取关键节点）
  const growthTrend = dailyMerged.map(d => ({
    date: d.date,
    totalUser: d.totalUser,
    newUser: d.newUser,
    cancelUser: d.cancelUser,
    readers: d.readers,
    shares: d.shares,
    favorites: d.favorites,
    published: d.published,
    openRate: d.openRate,
    shareRate: d.shareRate,
  }));

  // 文章排名（按阅读人数降序）
  const articleRank = [...articles]
    .sort((a, b) => b.readers - a.readers)
    .map((a, i) => ({
      rank: i + 1,
      title: a.title,
      pubDate: a.pubDate,
      readers: a.readers,
      readRatio: a.readRatio,
    }));

  return {
    summary,
    growthTrend: JSON.stringify(growthTrend, null, 2),
    articleRank: JSON.stringify(articleRank, null, 2),
    channelTotals: JSON.stringify(channelTotals, null, 2),
    dailyMergedJson: JSON.stringify(dailyMerged, null, 2),
  };
}

/**
 * 专家1：增长分析师
 */
function buildGrowthAnalyst(ctx, summary, qr) {
  return {
    role: '增长分析师',
    anchor: 'Andrew Chen（增长黑客、网络效应专家）',
    focusAreas: ['粉丝增长趋势', '获客来源归因', '留存与流失', '增长率分解'],
    prompt: `# 角色定义

你是一位资深的增长分析师，思维方式类似 Andrew Chen（a]6z 合伙人、增长黑客领域权威、网络效应研究者）。你擅长从数据中发现增长杠杆，识别增长拐点，做增长率分解和来源归因。

# 分析对象

微信公众号最近30天数据（${summary.dateRange.start} 至 ${summary.dateRange.end}）。

# 核心指标概览

- 起始粉丝: ${summary.startFollowers}，结束粉丝: ${summary.endFollowers}
- 净增关注: ${summary.netGrowth}（增长率 ${((summary.netGrowth / Math.max(summary.startFollowers, 1)) * 100).toFixed(2)}%）
- 新增总量: ${summary.totalNewUsers}，取关总量: ${summary.totalCancelUsers}
- 总阅读人次: ${summary.totalReaders}，日均: ${summary.avgDailyReaders}
- 发表文章: ${summary.totalArticles} 篇，发表天数: ${summary.totalPublishDays} 天

# 数据质量说明

${qr.issueCount > 0 ? '严重问题: ' + qr.issues.join('; ') : '无严重数据质量问题'}
${qr.warningCount > 0 ? '警告: ' + qr.warnings.slice(0, 5).join('; ') + (qr.warnings.length > 5 ? ` ...及另外 ${qr.warnings.length - 5} 条` : '') : ''}

# 每日数据

\`\`\`json
${ctx.growthTrend}
\`\`\`

# 分析任务

请从增长角度深度分析，输出以下内容：

1. **核心发现**（findings）：3-5条，每条必须带具体数字，例如"3月18日新增24人，是30天内最高峰，占期间总新增的XX%"
2. **详细分析**（details）：
   - 增长率分解：哪些天驱动了增长？增长与发文的关联性？
   - 获客分析：新关注主要集中在哪些日期？与发文/内容类型的关系？
   - 流失分析：取关规律？流失率（取关/新增）走势？
   - 粉丝生命周期：净增趋势，是否有停滞期？
3. **风险**（risks）：当前增长模式的隐患
4. **图表建议**（charts）：建议哪些可视化（类型、标题、涉及字段）

请以 JSON 格式输出：
\`\`\`json
{
  "role": "增长分析师",
  "findings": ["发现1（带数字）", "发现2", ...],
  "details": "详细分析段落...",
  "risks": ["风险1", "风险2", ...],
  "charts": [{"type": "line|bar|pie", "title": "图表标题", "fields": ["字段1", "字段2"]}]
}
\`\`\``,
  };
}

/**
 * 专家2：内容策略师
 */
function buildContentStrategist(ctx, summary, qr) {
  return {
    role: '内容策略师',
    anchor: 'Ann Handley（内容营销专家、《Everybody Writes》作者）',
    focusAreas: ['单篇阅读表现', '选题效果', '标题打开率', '内容类型分布', '发文节奏'],
    prompt: `# 角色定义

你是一位资深内容策略师，思维方式类似 Ann Handley（内容营销领域权威、MarketingProfs 首席内容官、《Everybody Writes》作者）。你擅长从内容表现数据中判断选题质量、标题吸引力、发文节奏和内容策略的有效性。

# 分析对象

微信公众号最近30天数据（${summary.dateRange.start} 至 ${summary.dateRange.end}）。

# 核心指标概览

- 发表文章: ${summary.totalArticles} 篇，覆盖 ${summary.totalPublishDays} 个发布日
- 总阅读: ${summary.totalReaders}，总分享: ${summary.totalShares}
- 总收藏: ${summary.totalFavorites}
- 当前粉丝: ${summary.endFollowers}
- 日均阅读: ${summary.avgDailyReaders}

# 文章排名（按阅读人数降序）

\`\`\`json
${ctx.articleRank}
\`\`\`

# 每日互动与发文数据

\`\`\`json
${ctx.growthTrend}
\`\`\`

# 分析任务

请从内容策略角度深度分析，输出以下内容：

1. **核心发现**（findings）：3-5条，每条带具体数字
   - 哪篇文章表现最好？为什么（从标题、选题推断）？
   - 阅读量的分布是否头部集中？top3占总阅读的比例？
   - 发文频率与阅读量的关系？
2. **详细分析**（details）：
   - 选题分析：从标题推断内容类型/话题，哪类话题读者更买账？
   - 标题分析：高阅读文章的标题有什么共性？（情绪、具体性、争议性）
   - 发文节奏：发文日期分布，是否有最佳发文日？
   - 阅读衰减：发表后阅读量的衰减曲线（从排名推断）
   - 互动质量：分享率、收藏率在什么水平？哪些文章互动率高？
3. **风险**（risks）：内容策略上的隐患
4. **图表建议**（charts）：建议可视化

请以 JSON 格式输出：
\`\`\`json
{
  "role": "内容策略师",
  "findings": ["发现1（带数字）", ...],
  "details": "详细分析段落...",
  "risks": ["风险1", ...],
  "charts": [{"type": "line|bar|pie", "title": "图表标题", "fields": ["字段1"]}]
}
\`\`\``,
  };
}

/**
 * 专家3：传播分析师
 */
function buildDistributionAnalyst(ctx, summary, qr) {
  return {
    role: '传播分析师',
    anchor: 'Jonah Berger（病毒传播研究者、《疯传》作者）',
    focusAreas: ['渠道分布', '转发裂变率', '收藏率', '传播路径', '渠道归因'],
    prompt: `# 角色定义

你是一位传播分析师，思维方式类似 Jonah Berger（沃顿商学院教授、病毒传播研究权威、《疯传 Contagious》作者）。你擅长分析内容的传播路径、渠道效率、裂变系数，理解什么让内容在社交网络中流动。

# 分析对象

微信公众号最近30天数据（${summary.dateRange.start} 至 ${summary.dateRange.end}）。

# 核心指标概览

- 总阅读: ${summary.totalReaders}，总分享: ${summary.totalShares}
- 总收藏: ${summary.totalFavorites}
- 平均转发率: ${(summary.avgShareRate * 100).toFixed(2)}%
- 当前粉丝: ${summary.endFollowers}

# 渠道阅读汇总（30天合计）

\`\`\`json
${ctx.channelTotals}
\`\`\`

# 每日渠道+互动数据

\`\`\`json
${ctx.growthTrend}
\`\`\`

# 文章排名

\`\`\`json
${ctx.articleRank}
\`\`\`

# 分析任务

请从传播角度深度分析，输出以下内容：

1. **核心发现**（findings）：3-5条，每条带具体数字
   - 各渠道占比分布？哪个渠道贡献最大阅读？
   - 聊天会话（私聊转发）vs 朋友圈 vs 推荐 的比例说明什么？
   - 搜一搜流量占比？是否有 SEO 潜力？
   - 转发率在行业中的水平？哪些内容最容易被传播？
2. **详细分析**（details）：
   - 渠道归因：各渠道的阅读贡献与趋势
   - 传播路径：公众号消息（推送打开）→ 聊天会话（被转发）→ 朋友圈（二次传播）的漏斗
   - 裂变系数估算：分享人数 / 阅读人数 × 平均二次阅读
   - 推荐流量分析：推荐渠道的比重与趋势（微信算法分发的指标）
   - 搜一搜流量：搜索带来的长尾价值
3. **风险**（risks）：传播层面的隐患
4. **图表建议**（charts）：建议可视化

请以 JSON 格式输出：
\`\`\`json
{
  "role": "传播分析师",
  "findings": ["发现1（带数字）", ...],
  "details": "详细分析段落...",
  "risks": ["风险1", ...],
  "charts": [{"type": "line|bar|pie", "title": "图表标题", "fields": ["字段1"]}]
}
\`\`\``,
  };
}

module.exports = { castExperts };
