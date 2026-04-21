'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');

const { parseFiles: parseWechatFiles } = require('../scrapers/wechat/parser');
const { parseFiles: parseXhsFiles } = require('../scrapers/xiaohongshu/parser');
const { cleanAndValidate } = require('../analysis/clean');
const { castExperts } = require('../analysis/casting');
const { prepareExpertPrompts, parseResult } = require('../analysis/analyze');
const { synthesize } = require('../analysis/synthesize');

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-review-test-'));

runWechatTests();
runXiaohongshuTests();
console.log('\nAll parser and analysis tests passed.');

function runWechatTests() {
  console.log('Testing WeChat pipeline...');
  const fixtureDir = path.join(TEMP_DIR, 'wechat');
  fs.mkdirSync(fixtureDir, { recursive: true });

  const articlesPath = path.join(fixtureDir, 'articles_fixture.xlsx');
  const usersPath = path.join(fixtureDir, 'users_fixture.xls');
  writeWechatArticlesFixture(articlesPath);
  writeWechatUsersFixture(usersPath);

  const parsed = parseWechatFiles({ articlesPath, usersPath });
  assert(parsed.platform === 'wechat', 'WeChat parser should set platform');
  assert(parsed.dailyMetrics.length === 3, 'WeChat daily metrics should have 3 rows');
  assert(parsed.audienceMetrics.length === 3, 'WeChat audience metrics should have 3 rows');
  assert(parsed.contentItems.length === 2, 'WeChat content items should dedupe 全部 rows');
  assert(parsed.contentBreakdown.length === 2, 'WeChat should preserve per-channel rows');

  const { cleanData, qualityReport } = cleanAndValidate(parsed);
  assert(cleanData.meta.platformName === '微信公众号', 'WeChat terms should be injected');
  assert(cleanData.dailyMerged.length === 3, 'Cleaned WeChat data should have 3 days');
  assert(cleanData.summary.totalArticles === 2, 'WeChat summary should count 2 articles');

  const { experts } = castExperts(cleanData, qualityReport);
  assert(experts.length === 3, 'WeChat should create 3 experts');

  const { prompts } = prepareExpertPrompts({ experts }, cleanData);
  assert(prompts.length === 3, 'WeChat should create 3 prompts');
  assert(prompts[0].prompt.includes('微信公众号'), 'WeChat prompt should mention platform');

  const parsedResult = parseResult(JSON.stringify({
    role: '测试专家',
    findings: ['发现1'],
    details: '细节',
    risks: ['风险1'],
    charts: [],
  }));
  assert(parsedResult.findings.length === 1, 'parseResult should parse JSON payload');

  const { report } = synthesize({ expertResults: prompts.map(toMockResult) }, cleanData);
  assert(report.meta.platformName === '微信公众号', 'WeChat report should keep platform metadata');
  assert(report.articleTable.length === 2, 'WeChat report should render article table');
}

function runXiaohongshuTests() {
  console.log('Testing Xiaohongshu pipeline...');
  const fixtureDir = path.join(TEMP_DIR, 'xiaohongshu');
  fs.mkdirSync(fixtureDir, { recursive: true });

  const overviewWatchPath = path.join(fixtureDir, 'overview-watch_fixture.xlsx');
  const overviewInteractionPath = path.join(fixtureDir, 'overview-interaction_fixture.xlsx');
  const overviewGrowthPath = path.join(fixtureDir, 'overview-growth_fixture.xlsx');
  const overviewPublishPath = path.join(fixtureDir, 'overview-publish_fixture.xlsx');
  const notesPath = path.join(fixtureDir, 'notes_fixture.xlsx');
  writeXhsWatchFixture(overviewWatchPath);
  writeXhsInteractionFixture(overviewInteractionPath);
  writeXhsGrowthFixture(overviewGrowthPath);
  writeXhsPublishFixture(overviewPublishPath);
  writeXhsNotesFixture(notesPath);

  const parsed = parseXhsFiles({
    overviewWatchPath,
    overviewInteractionPath,
    overviewGrowthPath,
    overviewPublishPath,
    notesPath,
  });
  assert(parsed.platform === 'xiaohongshu', 'XHS parser should set platform');
  assert(parsed.dailyMetrics.length === 3, 'XHS daily metrics should have 3 rows');
  assert(parsed.audienceMetrics.length === 3, 'XHS audience metrics should have 3 rows');
  assert(parsed.contentItems.length === 2, 'XHS content items should have 2 notes');
  assert(parsed.contentItems[0].extra.likes > 0, 'XHS note extra metrics should be preserved');
  assert(parsed.dailyMetrics[0].published === 1, 'XHS publish tab should populate published count');
  assert(parsed.audienceMetrics[1].newUser === 1, 'XHS growth tab should populate audience metrics');

  const { cleanData, qualityReport } = cleanAndValidate(parsed);
  assert(cleanData.meta.platformName === '小红书', 'XHS terms should be injected');
  assert(cleanData.meta.hasChannelBreakdown === false, 'XHS should not require channel breakdown');
  assert(cleanData.dailyMerged[0].channels && Object.keys(cleanData.dailyMerged[0].channels).length === 0, 'XHS channels should be empty objects');

  const { experts } = castExperts(cleanData, qualityReport);
  const { prompts } = prepareExpertPrompts({ experts }, cleanData);
  assert(prompts.every((prompt) => prompt.prompt.includes('小红书')), 'XHS prompts should mention platform');

  const { report } = synthesize({ expertResults: prompts.map(toMockResult) }, cleanData);
  assert(report.meta.platformName === '小红书', 'XHS report should keep platform metadata');
  assert(report.meta.hasChannelBreakdown === false, 'XHS report should note missing channel data');
  assert(report.articleTable.length === 2, 'XHS report should render note table');
}

function toMockResult(prompt) {
  return {
    role: prompt.role,
    findings: ['最近 30 天表现稳定'],
    details: '这里是详细分析。',
    risks: ['需要继续观察趋势'],
    charts: [],
  };
}

function writeWechatArticlesFixture(filePath) {
  const all = '\u5168\u90E8';
  const chat = '\u804A\u5929\u4F1A\u8BDD';
  const moments = '\u670B\u53CB\u5708';
  const articleOne = '\u7B2C\u4E00\u7BC7\u6587\u7AE0';
  const articleTwo = '\u7B2C\u4E8C\u7BC7\u6587\u7AE0';
  const rows = [];
  rows[0] = [];
  rows[1] = [];
  rows[2] = ['', '\u65E5\u671F', '\u6E20\u9053', '\u9605\u8BFB\u4EBA\u6570', '', '\u65E5\u671F', '\u5206\u4EAB\u4EBA\u6570', '\u8BFB\u539F\u6587\u4EBA\u6570', '\u5FAE\u4FE1\u6536\u85CF\u4EBA\u6570', '\u53D1\u8868\u7BC7\u6570', '', '\u4F20\u64AD\u6E20\u9053', '\u53D1\u8868\u65E5\u671F', '\u5185\u5BB9\u6807\u9898', '\u9605\u8BFB\u4EBA\u6570', '\u9605\u8BFB\u5360\u6BD4'];
  rows[3] = ['', '2026-04-01', all, 100, '', '2026-04-01', 6, 2, 3, 1, '', all, '20260401', articleOne, 100, 0.5];
  rows[4] = ['', '2026-04-01', chat, 30, '', '2026-04-02', 8, 3, 2, 1, '', chat, '20260401', articleOne, 30, 0.3];
  rows[5] = ['', '2026-04-02', all, 200, '', '2026-04-03', 9, 1, 4, 0, '', all, '20260402', articleTwo, 200, 0.7];
  rows[6] = ['', '2026-04-02', moments, 80, '', '', '', '', '', '', '', moments, '20260402', articleTwo, 80, 0.4];
  rows[7] = ['', '2026-04-03', all, 150];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'New Sheet1');
  XLSX.writeFile(wb, filePath);
}

function writeWechatUsersFixture(filePath) {
  const html = `
    <table class="tb">
      <tr><th>标题</th></tr>
      <tr><th>时间</th><th>新关注人数</th><th>取消关注人数</th><th>净增关注人数</th><th>累计关注人数</th></tr>
      <tr><td>2026-04-01</td><td>10</td><td>2</td><td>8</td><td>100</td></tr>
      <tr><td>2026-04-02</td><td>12</td><td>1</td><td>11</td><td>111</td></tr>
      <tr><td>2026-04-03</td><td>5</td><td>0</td><td>5</td><td>116</td></tr>
    </table>`;
  fs.writeFileSync(filePath, html, 'utf8');
}

function writeXhsWatchFixture(filePath) {
  writeWorkbook(filePath, [
    [
      ['指标', '数值'],
      ['曝光', 3900],
      ['观看', 55],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 1200],
      ['2026年04月02日', 1800],
      ['2026年04月03日', 900],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 18],
      ['2026年04月02日', 26],
      ['2026年04月03日', 11],
    ],
  ], ['账号整体观看数据', '曝光趋势', '观看趋势']);
}

function writeXhsInteractionFixture(filePath) {
  writeWorkbook(filePath, [
    [
      ['指标', '数值'],
      ['点赞', 310],
      ['评论', 45],
      ['收藏', 60],
      ['分享', 40],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 100],
      ['2026年04月02日', 140],
      ['2026年04月03日', 70],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 15],
      ['2026年04月02日', 21],
      ['2026年04月03日', 9],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 20],
      ['2026年04月02日', 30],
      ['2026年04月03日', 10],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 12],
      ['2026年04月02日', 20],
      ['2026年04月03日', 8],
    ],
  ], ['账号整体互动数据', '点赞趋势', '评论趋势', '收藏趋势', '分享趋势']);
}

function writeXhsGrowthFixture(filePath) {
  writeWorkbook(filePath, [
    [
      ['指标', '数值'],
      ['净涨粉', 2],
      ['新增关注', 3],
      ['取消关注', 1],
      ['主页访客', 6],
      ['主页转粉率(%)', 20],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 2],
      ['2026年04月02日', 1],
      ['2026年04月03日', -1],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 2],
      ['2026年04月02日', 1],
      ['2026年04月03日', 0],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 0],
      ['2026年04月02日', 0],
      ['2026年04月03日', 1],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 3],
      ['2026年04月02日', 2],
      ['2026年04月03日', 1],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 12],
      ['2026年04月02日', 20],
      ['2026年04月03日', 0],
    ],
  ], ['账号整体涨粉数据', '净涨粉趋势', '新增关注趋势', '取消关注趋势', '主页访客趋势', '主页转粉率趋势']);
}

function writeXhsPublishFixture(filePath) {
  writeWorkbook(filePath, [
    [
      ['指标', '数值'],
      ['总发布', 2],
      ['发布视频', 0],
      ['发布图文', 2],
    ],
    [
      ['日期', '数值'],
      ['2026年04月01日', 1],
      ['2026年04月02日', 1],
      ['2026年04月03日', 0],
    ],
  ], ['账号整体发布数据', '总发布趋势']);
}

function writeXhsNotesFixture(filePath) {
  writeWorkbook(filePath, [[
    ['发布时间', '笔记标题', '曝光', '分享', '收藏', '点赞', '评论', '曝光占比', '笔记ID'],
    ['2026-04-01', '第一条笔记', 1200, 12, 20, 100, 15, '40%', 'note-1'],
    ['2026-04-02', '第二条笔记', 1800, 20, 30, 140, 21, '60%', 'note-2'],
  ]]);
}

function writeWorkbook(filePath, sheets, names) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((rows, index) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, names ? names[index] : `Sheet${index + 1}`);
  });
  XLSX.writeFile(wb, filePath);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
