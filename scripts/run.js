'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { getLatestFiles, downloadData } = require('../scrapers/wechat/download');
const { parseArticles, parseUsers } = require('../scrapers/wechat/parser');
const { cleanAndValidate } = require('../analysis/clean');
const { castExperts } = require('../analysis/casting');
const { prepareExpertPrompts, parseResult, collectResults } = require('../analysis/analyze');
const { synthesize } = require('../analysis/synthesize');

const REPORTS_DIR = path.join(os.homedir(), '.wechat-review', 'reports');

async function main() {
  const args = process.argv.slice(2);
  const scrapeOnly = args.includes('--scrape-only');
  const analyzeOnly = args.includes('--analyze-only');

  console.log('╔══════════════════════════════════════╗');
  console.log('║     WeChat Review — 公众号数据分析    ║');
  console.log('╚══════════════════════════════════════╝\n');

  // ── Step 1: 获取数据文件 ──
  let files = null;

  if (!analyzeOnly) {
    // 检查缓存
    files = getLatestFiles();

    if (files) {
      console.log('[run] 发现缓存数据:');
      console.log(`  articles: ${files.articlesPath}`);
      console.log(`  users: ${files.usersPath}`);
    } else {
      console.log('[run] 未发现缓存，启动浏览器抓取...');
      const { login } = require('../scrapers/wechat/login');
      const { browser, page, token } = await login();
      try {
        files = await downloadData(page, token);
      } finally {
        await browser.close();
      }
    }

    if (scrapeOnly) {
      console.log('\n[run] 抓取完成（--scrape-only 模式）');
      return;
    }
  } else {
    files = getLatestFiles();
    if (!files) {
      console.error('[run] 错误: 没有缓存数据。请先运行抓取（去掉 --analyze-only）');
      process.exit(1);
    }
    console.log('[run] 使用缓存数据:');
    console.log(`  articles: ${files.articlesPath}`);
    console.log(`  users: ${files.usersPath}`);
  }

  // ── Step 2: 解析 Excel ──
  console.log('\n[run] 解析数据文件...');
  const articlesData = parseArticles(files.articlesPath);
  const usersData = parseUsers(files.usersPath);

  // ── Step 3: 数据清洗 ──
  console.log('\n[run] 数据清洗与校验...');
  const { cleanData, qualityReport } = cleanAndValidate(articlesData, usersData);

  // ── Step 4: 专家选角 ──
  console.log('\n[run] 多专家选角...');
  const castingResult = castExperts(cleanData, qualityReport);

  // ── Step 5: 生成专家 Prompt ──
  console.log('\n[run] 生成专家分析 Prompt...');
  const { prompts } = prepareExpertPrompts(castingResult, cleanData);

  // ── Step 6: 保存中间结果 ──
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // 保存清洗后的数据
  const cleanDataPath = path.join(REPORTS_DIR, `cleanData_${timestamp}.json`);
  fs.writeFileSync(cleanDataPath, JSON.stringify(cleanData, null, 2));
  console.log(`\n[run] 清洗数据已保存: ${cleanDataPath}`);

  // 保存质量报告
  const qrPath = path.join(REPORTS_DIR, `qualityReport_${timestamp}.json`);
  fs.writeFileSync(qrPath, JSON.stringify(qualityReport, null, 2));
  console.log(`[run] 质量报告已保存: ${qrPath}`);

  // 保存专家 prompt（供 Cola LLM 调用）
  const promptsPath = path.join(REPORTS_DIR, `expertPrompts_${timestamp}.json`);
  fs.writeFileSync(promptsPath, JSON.stringify(prompts, null, 2));
  console.log(`[run] 专家 Prompt 已保存: ${promptsPath}`);

  // ── Step 7: 生成初始报告（不含专家分析结果）──
  // 专家分析需要 Cola 的 LLM 执行 prompt 后回填
  console.log('\n[run] 生成初始报告框架...');
  const placeholderResults = { expertResults: prompts.map(p => ({
    role: p.role,
    findings: [],
    details: '',
    risks: [],
    charts: [],
  }))};

  const { report } = synthesize(placeholderResults, cleanData);

  // 生成 HTML 报告
  const htmlTemplate = fs.readFileSync(
    path.join(__dirname, '..', 'templates', 'report.html'),
    'utf-8'
  );
  const htmlReport = htmlTemplate.replace(
    '/*__REPORT_JSON__*/null',
    JSON.stringify(report)
  );

  const htmlPath = path.join(REPORTS_DIR, `report_${timestamp}.html`);
  fs.writeFileSync(htmlPath, htmlReport);
  console.log(`[run] HTML 报告已保存: ${htmlPath}`);

  // 保存报告 JSON
  const reportJsonPath = path.join(REPORTS_DIR, `report_${timestamp}.json`);
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
  console.log(`[run] 报告 JSON 已保存: ${reportJsonPath}`);

  // ── 总结 ──
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║            运行完成！                 ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n📊 数据概览:`);
  console.log(`  日期范围: ${cleanData.summary.dateRange.start} → ${cleanData.summary.dateRange.end}`);
  console.log(`  总天数: ${cleanData.summary.totalDays}`);
  console.log(`  文章数: ${cleanData.summary.totalArticles}`);
  console.log(`  粉丝: ${cleanData.summary.startFollowers} → ${cleanData.summary.endFollowers} (净增 ${cleanData.summary.netGrowth})`);
  console.log(`  总阅读: ${cleanData.summary.totalReaders}`);
  console.log(`\n📁 输出文件:`);
  console.log(`  清洗数据: ${cleanDataPath}`);
  console.log(`  质量报告: ${qrPath}`);
  console.log(`  专家Prompt: ${promptsPath}`);
  console.log(`  HTML报告: ${htmlPath}`);
  console.log(`  报告JSON: ${reportJsonPath}`);
  console.log(`\n💡 下一步:`);
  console.log(`  1. 将 expertPrompts 中的 prompt 发送给 LLM 执行`);
  console.log(`  2. 收集专家分析结果，回填到报告中`);
  console.log(`  3. 用浏览器打开 HTML 报告查看`);
}

main().catch(err => {
  console.error('[run] 致命错误:', err);
  process.exit(1);
});
