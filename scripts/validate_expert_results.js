'use strict';

const fs = require('fs');
const path = require('path');
const { validateExpertResultsDocument } = require('../analysis/expert-results');

const args = process.argv.slice(2);
const target = readArgValue(args, '--file');

if (!target) {
  throw new Error('Usage: node scripts/validate_expert_results.js --file <expertResults.json>');
}

const filePath = path.resolve(process.cwd(), target);
if (!fs.existsSync(filePath)) {
  throw new Error(`File does not exist: ${filePath}`);
}

const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
const validation = validateExpertResultsDocument(parsed);

if (!validation.isValid) {
  console.error('expertResults validation failed:');
  for (const error of validation.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`expertResults validation passed: ${filePath}`);

function readArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0 || index === argv.length - 1) {
    return null;
  }
  return argv[index + 1];
}
