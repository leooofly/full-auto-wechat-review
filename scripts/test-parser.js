'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { parseArticles, parseUsers } = require('../scrapers/wechat/parser');
const { cleanAndValidate } = require('../analysis/clean');
const { castExperts } = require('../analysis/casting');
const { prepareExpertPrompts } = require('../analysis/analyze');

const DOWNLOAD_DIR = path.join(os.homedir(), '.wechat-review', 'downloads');

function findLatestFixture(prefix) {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    return null;
  }

  const candidates = fs.readdirSync(DOWNLOAD_DIR)
    .filter(name => name.startsWith(prefix) && (name.endsWith('.xls') || name.endsWith('.xlsx')))
    .sort()
    .reverse();

  return candidates.length > 0 ? path.join(DOWNLOAD_DIR, candidates[0]) : null;
}

function requireFixture(prefix) {
  const filePath = findLatestFixture(prefix);
  if (filePath) {
    return filePath;
  }

  console.error(`  ❌ 未找到 ${prefix} 测试数据。请先运行抓取流程，或把 ${prefix}_*.xls 放到 ${DOWNLOAD_DIR}`);
  process.exit(1);
}

console.log('═══════════════════════════════════════');
console.log('  Parser + Analysis Pipeline Test');
console.log('═══════════════════════════════════════\n');

// ── Test 1: parseArticles ──
console.log('▶ Test 1: parseArticles');
const articlesPath = requireFixture('articles');
const articlesData = parseArticles(articlesPath);

console.log(`  渠道阅读趋势行数: ${articlesData.dailyReadByChannel.length}`);
console.log(`  互动趋势行数: ${articlesData.dailyInteraction.length}`);
console.log(`  文章(去重后): ${articlesData.articles.length} 篇`);
console.log(`  文章渠道明细: ${articlesData.articlesByChannel.length} 行`);

// 校验渠道阅读趋势
const channels = [...new Set(articlesData.dailyReadByChannel.map(r => r.channel))];
console.log(`  渠道列表: ${channels.join(', ')}`);
assert(channels.includes('全部'), '应包含"全部"渠道');
assert(channels.includes('聊天会话'), '应包含"聊天会话"渠道');

// 校验每日8个渠道
const dates = [...new Set(articlesData.dailyReadByChannel.map(r => r.date))];
console.log(`  日期数: ${dates.length}`);
assert(dates.length === 30, `应有30天数据，实际 ${dates.length}`);

// 校验"全部"行数 = 日期数
const totalRows = articlesData.dailyReadByChannel.filter(r => r.channel === '全部');
assert(totalRows.length === 30, `"全部"行数应=30，实际 ${totalRows.length}`);

// 校验互动趋势
assert(articlesData.dailyInteraction.length === 30, `互动趋势应=30行，实际 ${articlesData.dailyInteraction.length}`);

// 校验文章去重
console.log(`  Top 3 文章:`);
const sorted = [...articlesData.articles].sort((a, b) => b.readers - a.readers);
for (let i = 0; i < Math.min(3, sorted.length); i++) {
  console.log(`    ${i + 1}. [${sorted[i].pubDate}] ${sorted[i].title.substring(0, 40)}... (${sorted[i].readers}阅读)`);
}

// 检查去重：文章标题不应重复
const titleSet = new Set(articlesData.articles.map(a => a.title));
assert(titleSet.size === articlesData.articles.length, `文章标题有重复! unique=${titleSet.size}, total=${articlesData.articles.length}`);

// 检查日期格式
for (const a of articlesData.articles) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(a.pubDate), `文章日期格式错误: ${a.pubDate}`);
}

console.log('  ✅ parseArticles 通过\n');

// ── Test 2: parseUsers ──
console.log('▶ Test 2: parseUsers');
const usersPath = requireFixture('users');
const usersData = parseUsers(usersPath);

console.log(`  用户数据天数: ${usersData.dailyUsers.length}`);
assert(usersData.dailyUsers.length > 0, '应有用户数据');

// 检查字段完整性
const firstUser = usersData.dailyUsers[0];
console.log(`  首日数据: ${JSON.stringify(firstUser)}`);
assert(firstUser.date !== undefined, '应有 date');
assert(firstUser.newUser !== undefined, '应有 newUser');
assert(firstUser.cancelUser !== undefined, '应有 cancelUser');
assert(firstUser.netUser !== undefined, '应有 netUser');
assert(firstUser.totalUser !== undefined, '应有 totalUser');

// 检查累积粉丝合理性
const lastUser = usersData.dailyUsers[usersData.dailyUsers.length - 1];
console.log(`  末日数据: ${JSON.stringify(lastUser)}`);
assert(lastUser.totalUser >= firstUser.totalUser - 10, '累积粉丝应大致递增');

console.log('  ✅ parseUsers 通过\n');

// ── Test 3: cleanAndValidate ──
console.log('▶ Test 3: cleanAndValidate');
const { cleanData, qualityReport } = cleanAndValidate(articlesData, usersData);

console.log(`  合并天数: ${cleanData.dailyMerged.length}`);
console.log(`  文章数: ${cleanData.articles.length}`);
console.log(`  渠道汇总: ${JSON.stringify(cleanData.channelTotals)}`);
console.log(`  汇总: ${JSON.stringify(cleanData.summary)}`);
console.log(`  质量问题: ${qualityReport.issueCount}, 警告: ${qualityReport.warningCount}`);

if (qualityReport.issues.length > 0) {
  console.log(`  问题: ${qualityReport.issues.join('\n    ')}`);
}

// 检查衍生指标
const sampleDay = cleanData.dailyMerged.find(d => d.readers > 0);
if (sampleDay) {
  console.log(`  样本日(${sampleDay.date}): 阅读=${sampleDay.readers}, 打开率=${sampleDay.openRate}, 转发率=${sampleDay.shareRate}`);
  assert(sampleDay.openRate >= 0 && sampleDay.openRate <= 1, '打开率应在0-1之间');
}

console.log('  ✅ cleanAndValidate 通过\n');

// ── Test 4: castExperts ──
console.log('▶ Test 4: castExperts');
const { experts } = castExperts(cleanData, qualityReport);

assert(experts.length === 3, `应有3个专家，实际 ${experts.length}`);
for (const e of experts) {
  console.log(`  ${e.role} (${e.anchor}): prompt ${e.prompt.length} 字符`);
  assert(e.prompt.length > 500, `${e.role} prompt 太短`);
  assert(e.prompt.includes('json'), `${e.role} prompt 应包含 JSON 输出格式说明`);
}

console.log('  ✅ castExperts 通过\n');

// ── Test 5: prepareExpertPrompts ──
console.log('▶ Test 5: prepareExpertPrompts');
const { prompts, parseResult } = prepareExpertPrompts({ experts }, cleanData);

assert(prompts.length === 3, `应有3个 prompt`);
for (const p of prompts) {
  console.log(`  ${p.role}: ${p.prompt.length} 字符`);
}

// 测试 parseResult
const mockLLMResponse = JSON.stringify({
  role: '测试专家',
  findings: ['发现1', '发现2'],
  details: '详细分析...',
  risks: ['风险1'],
  charts: [{ type: 'line', title: '趋势图', fields: ['date', 'readers'] }],
});
const parsed = parseResult(mockLLMResponse);
assert(parsed.findings.length === 2, 'parseResult 应正确解析 findings');
assert(parsed.risks.length === 1, 'parseResult 应正确解析 risks');

// 测试从 markdown code block 解析
const markdownResponse = '```json\n' + mockLLMResponse + '\n```';
const parsedMd = parseResult(markdownResponse);
assert(parsedMd.findings.length === 2, 'parseResult 应能从 markdown 中提取');

console.log('  ✅ prepareExpertPrompts 通过\n');

// ══════════════════════════
console.log('═══════════════════════════════════════');
console.log('  全部测试通过 ✅');
console.log('═══════════════════════════════════════');

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ 断言失败: ${message}`);
    process.exit(1);
  }
}
