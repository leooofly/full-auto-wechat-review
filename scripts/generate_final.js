'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { synthesize } = require('../analysis/synthesize.js');

const HOME_DIR = os.homedir();
const args = process.argv.slice(2);
const platform = readArgValue(args, '--platform') || 'wechat';
const reportsDir = path.join(
  HOME_DIR,
  platform === 'xiaohongshu' ? '.xiaohongshu-review' : '.wechat-review',
  'reports'
);

const cleanDataFile = readArgValue(args, '--clean-data') || process.env.CLEAN_DATA_FILE || getLatestReportFile('cleanData_');
const expertResultsFile = readArgValue(args, '--expert-results') || process.env.EXPERT_RESULTS_FILE || getLatestReportFile('expertResults_');

if (!cleanDataFile) {
  throw new Error(`No cleanData file found in ${reportsDir}. Pass --clean-data explicitly if needed.`);
}

if (!expertResultsFile) {
  throw new Error(`No expertResults file found in ${reportsDir}. Pass --expert-results explicitly if needed.`);
}

const cleanData = loadJson(cleanDataFile, 'cleanData file');
const expertResults = loadExpertResults(expertResultsFile);
const { report } = synthesize({ expertResults }, cleanData);

const reportJson = JSON.stringify(report);
const template = fs.readFileSync(path.resolve(__dirname, '../templates/report.html'), 'utf8');
const html = template.replace('/*__REPORT_JSON__*/null', reportJson);

if (html.includes('/*__REPORT_JSON__*/null')) {
  throw new Error('JSON injection failed');
}

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, 'report_final.html'), html, 'utf8');
fs.writeFileSync(path.join(reportsDir, 'report_final.json'), JSON.stringify(report, null, 2), 'utf8');

console.log('Final report generated successfully');
console.log('Using cleanData:', cleanDataFile);
console.log('Using expertResults:', expertResultsFile);
console.log('Saved to:', path.join(reportsDir, 'report_final.html'));

function getLatestReportFile(prefix) {
  if (!fs.existsSync(reportsDir)) {
    return null;
  }

  const candidates = fs.readdirSync(reportsDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort()
    .reverse();

  return candidates.length > 0 ? path.join(reportsDir, candidates[0]) : null;
}

function loadJson(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath || 'not provided'}`);
  }

  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(content);
}

function loadExpertResults(filePath) {
  const parsed = loadJson(filePath, 'expertResults file');
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.expertResults)) {
    return parsed.expertResults;
  }

  throw new Error(`Unsupported expert results format: ${filePath}`);
}

function readArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0 || index === argv.length - 1) {
    return null;
  }
  return argv[index + 1];
}
