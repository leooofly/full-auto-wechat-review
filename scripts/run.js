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
  const expectedDays = readPositiveIntArg(args, '--expect-days');
  const dateFrom = readDateArg(args, '--date-from');
  const dateTo = readDateArg(args, '--date-to');

  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    throw new Error('Use --date-from and --date-to together when requesting an exact backend export range.');
  }

  const platform = getPlatform(platformId);
  const reportsDir = path.join(platform.profileDir, 'reports');
  const downloadOptions = { expectedDays, dateFrom, dateTo };
  const shouldForceFreshDownload = hasRequestedRange(downloadOptions);

  console.log('========================================');
  console.log(`  ${platform.id} review data pipeline`);
  console.log('========================================\n');

  let files;
  if (!analyzeOnly) {
    files = shouldForceFreshDownload ? null : platform.getLatestFiles();

    if (files) {
      console.log('[run] Found cached files:');
      printFiles(files);
    } else {
      console.log('[run] No cache found, starting browser-assisted download...');
      const loginResult = await platform.login();
      try {
        files = await platform.downloadData(loginResult.page, loginResult.token, downloadOptions);
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
  validateRequestedRange(cleanData, downloadOptions);

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

  console.log('\n[run] Generating draft report...');
  const draftResults = {
    expertResults: prompts.map((prompt) => ({
      role: prompt.role,
      findings: [],
      details: '',
      risks: [],
      charts: [],
    })),
  };
  const { report: draftReport } = synthesize(draftResults, cleanData);
  const htmlTemplate = fs.readFileSync(path.join(__dirname, '..', 'templates', 'report.html'), 'utf-8');
  const draftHtml = htmlTemplate.replace('/*__REPORT_JSON__*/null', JSON.stringify(draftReport));

  const draftHtmlPath = path.join(reportsDir, `report_draft_${timestamp}.html`);
  fs.writeFileSync(draftHtmlPath, draftHtml);

  const draftJsonPath = path.join(reportsDir, `report_draft_${timestamp}.json`);
  fs.writeFileSync(draftJsonPath, JSON.stringify(draftReport, null, 2));

  console.log('\n[run] Draft analysis finished successfully.');
  console.log(`[run] Date range: ${cleanData.summary.dateRange.start} -> ${cleanData.summary.dateRange.end}`);
  console.log(`[run] Contents: ${cleanData.summary.totalArticles}`);
  console.log(`[run] Audience: ${cleanData.summary.startFollowers} -> ${cleanData.summary.endFollowers} (net ${cleanData.summary.netGrowth})`);
  console.log(`[run] Readers: ${cleanData.summary.totalReaders}`);
  console.log('[run] Draft outputs:');
  console.log(`  cleanData: ${cleanDataPath}`);
  console.log(`  qualityReport: ${qualityPath}`);
  console.log(`  expertPrompts: ${promptsPath}`);
  console.log(`  draftReportHtml: ${draftHtmlPath}`);
  console.log(`  draftReportJson: ${draftJsonPath}`);

  console.log('[run] This script stops at draft + expertPrompts on purpose.');
  console.log('[run] In Codex / Claude Code / OpenClaw, the host Agent should execute the 3 expert prompts with its own model.');
  console.log('[run] Use templates/expert-results.template.json as the shape reference.');
  console.log('[run] Save the structured results as expertResults_*.json, validate them with scripts/validate_expert_results.js, then call scripts/generate_final.js.');
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

function readPositiveIntArg(args, name) {
  const value = readArgValue(args, name);
  if (value == null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${name}: ${value}`);
  }
  return parsed;
}

function readDateArg(args, name) {
  const value = readArgValue(args, name);
  if (value == null) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid value for ${name}: ${value}. Expected YYYY-MM-DD.`);
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date for ${name}: ${value}`);
  }

  return value;
}

function validateRequestedRange(cleanData, options) {
  const summary = cleanData.summary || {};
  const actualDays = Number(summary.totalDays);
  const actualRange = summary.dateRange || {};

  if (options.expectedDays && actualDays !== options.expectedDays) {
    throw new Error(
      `Exported data covers ${actualDays} days, but --expect-days=${options.expectedDays} was requested. ` +
      'Please export the correct backend date range first, then rerun the analysis.'
    );
  }

  if (options.dateFrom && actualRange.start !== options.dateFrom) {
    throw new Error(
      `Exported data starts at ${actualRange.start}, but --date-from=${options.dateFrom} was requested. ` +
      'Please export the correct backend date range first, then rerun the analysis.'
    );
  }

  if (options.dateTo && actualRange.end !== options.dateTo) {
    throw new Error(
      `Exported data ends at ${actualRange.end}, but --date-to=${options.dateTo} was requested. ` +
      'Please export the correct backend date range first, then rerun the analysis.'
    );
  }
}

function hasRequestedRange(options) {
  return Boolean(options && (options.dateFrom || options.dateTo || options.expectedDays));
}

main().catch((error) => {
  console.error('[run] Fatal error:', error);
  process.exit(1);
});
