'use strict';

const fs = require('fs');
const path = require('path');
const { getPlatform } = require('../platforms');
const { cleanAndValidate } = require('../analysis/clean');
const { castExperts } = require('../analysis/casting');
const { prepareExpertPrompts } = require('../analysis/analyze');
const { synthesize } = require('../analysis/synthesize');

async function main() {
  const args = process.argv.slice(2);
  const scrapeOnly = args.includes('--scrape-only');
  const analyzeOnly = args.includes('--analyze-only');
  const platformId = readArgValue(args, '--platform') || 'wechat';
  const platform = getPlatform(platformId);
  const reportsDir = path.join(platform.profileDir, 'reports');

  console.log('========================================');
  console.log(`  ${platform.id} review data pipeline`);
  console.log('========================================\n');

  let files;
  if (!analyzeOnly) {
    files = platform.getLatestFiles();

    if (files) {
      console.log('[run] Found cached files:');
      printFiles(files);
    } else {
      console.log('[run] No cache found, starting browser-assisted download...');
      const loginResult = await platform.login();
      try {
        files = await platform.downloadData(loginResult.page, loginResult.token);
      } finally {
        await loginResult.browser.close();
      }
    }

    if (scrapeOnly) {
      console.log('\n[run] Download finished in --scrape-only mode.');
      return;
    }
  } else {
    files = platform.getLatestFiles();
    if (!files) {
      throw new Error(`No cached files found for platform ${platformId}. Run without --analyze-only first.`);
    }
    console.log('[run] Using cached files:');
    printFiles(files);
  }

  console.log('\n[run] Parsing raw files...');
  const parsedData = platform.parseFiles(files);

  console.log('\n[run] Cleaning and validating...');
  const { cleanData, qualityReport } = cleanAndValidate(parsedData);

  console.log('\n[run] Building expert prompts...');
  const castingResult = castExperts(cleanData, qualityReport);
  const { prompts } = prepareExpertPrompts(castingResult, cleanData);

  fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const cleanDataPath = path.join(reportsDir, `cleanData_${timestamp}.json`);
  fs.writeFileSync(cleanDataPath, JSON.stringify(cleanData, null, 2));

  const qualityPath = path.join(reportsDir, `qualityReport_${timestamp}.json`);
  fs.writeFileSync(qualityPath, JSON.stringify(qualityReport, null, 2));

  const promptsPath = path.join(reportsDir, `expertPrompts_${timestamp}.json`);
  fs.writeFileSync(promptsPath, JSON.stringify(prompts, null, 2));

  const placeholderResults = {
    expertResults: prompts.map((prompt) => ({
      role: prompt.role,
      findings: [],
      details: '',
      risks: [],
      charts: [],
    })),
  };

  console.log('\n[run] Generating initial report...');
  const { report } = synthesize(placeholderResults, cleanData);
  const htmlTemplate = fs.readFileSync(path.join(__dirname, '..', 'templates', 'report.html'), 'utf-8');
  const htmlReport = htmlTemplate.replace('/*__REPORT_JSON__*/null', JSON.stringify(report));

  const htmlPath = path.join(reportsDir, `report_${timestamp}.html`);
  fs.writeFileSync(htmlPath, htmlReport);

  const reportJsonPath = path.join(reportsDir, `report_${timestamp}.json`);
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));

  console.log('\n[run] Finished successfully.');
  console.log(`[run] Date range: ${cleanData.summary.dateRange.start} -> ${cleanData.summary.dateRange.end}`);
  console.log(`[run] Contents: ${cleanData.summary.totalArticles}`);
  console.log(`[run] Audience: ${cleanData.summary.startFollowers} -> ${cleanData.summary.endFollowers} (net ${cleanData.summary.netGrowth})`);
  console.log(`[run] Readers: ${cleanData.summary.totalReaders}`);
  console.log(`[run] Outputs:`);
  console.log(`  cleanData: ${cleanDataPath}`);
  console.log(`  qualityReport: ${qualityPath}`);
  console.log(`  expertPrompts: ${promptsPath}`);
  console.log(`  reportHtml: ${htmlPath}`);
  console.log(`  reportJson: ${reportJsonPath}`);
}

function readArgValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function printFiles(files) {
  for (const [key, value] of Object.entries(files)) {
    console.log(`  ${key}: ${value}`);
  }
}

main().catch((error) => {
  console.error('[run] Fatal error:', error);
  process.exit(1);
});
