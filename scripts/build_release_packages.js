'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');

const PACKAGE_DEFS = [
  {
    platform: 'wechat',
    packageDirName: 'wechat-review-skill',
    packageName: 'wechat-review-skill',
    title: 'WeChat Review Skill',
    shortTitle: '微信公众号数据复盘 Skill',
    sourceProfileDir: '.wechat-review',
    reportObject: '微信公众号',
    outputObject: '文章',
    scraperDir: 'wechat',
    readme: `# WeChat Review Skill

An agent-hosted skill package for WeChat Official Account reporting.

This package is fixed to the WeChat workflow only.

## What It Does

- browser-assisted WeChat export
- exact date-range support for WeChat backend export
- parse content analysis and user analysis files
- generate \`cleanData_*\`, \`qualityReport_*\`, \`expertPrompts_*\`
- generate \`report_draft_*\`
- let the host Agent execute the built-in 3-expert methodology
- validate \`expertResults_*\`
- generate \`report_final.html/json\`

## Commands

\`\`\`bash
npm install
node scripts/run.js
node scripts/run.js --date-from 2026-04-14 --date-to 2026-04-20
node scripts/run.js --scrape-only
node scripts/run.js --analyze-only
node scripts/validate_expert_results.js --file C:\\path\\to\\expertResults.json
node scripts/generate_final.js --clean-data C:\\path\\to\\cleanData.json --expert-results C:\\path\\to\\expertResults.json
\`\`\`

## Output Location

- session: \`~/.wechat-review/session.json\`
- downloads: \`~/.wechat-review/downloads/\`
- reports: \`~/.wechat-review/reports/\`

## Host Agent Requirement

The local script stops at draft + expert prompts on purpose.
The host Agent must:

1. read the newest \`expertPrompts_*.json\`
2. execute the 3 built-in experts with the host model
3. write \`expertResults_*.json\`
4. validate it
5. call \`scripts/generate_final.js\`
`,
    skill: `# WeChat Review Skill

Use this package only for WeChat Official Account data review.

This skill is fixed to one platform:
- platform: \`wechat\`
- profile dir: \`~/.wechat-review\`

## Workflow

1. Run \`node scripts/run.js\` or \`node scripts/run.js --date-from ... --date-to ...\`
2. Wait for the script to generate:
   - \`cleanData_*.json\`
   - \`qualityReport_*.json\`
   - \`expertPrompts_*.json\`
   - \`report_draft_*.html/json\`
3. Read the newest \`expertPrompts_*.json\`
4. Execute the 3 fixed experts with the host Agent model:
   - \`增长分析师\`
   - \`内容策略师\`
   - \`分发分析师\`
5. Save one structured \`expertResults_*.json\`
6. Validate it with \`node scripts/validate_expert_results.js --file <path>\`
7. Generate the final report with \`node scripts/generate_final.js --clean-data <path> --expert-results <path>\`

Do not stop at draft unless the user explicitly asks for draft only.

## Important

- do not ask the user to configure a second model API
- the host Agent must use its own model to execute expert prompts
- do not package an empty final report as success
`,
  },
  {
    platform: 'xiaohongshu',
    packageDirName: 'xiaohongshu-review-skill',
    packageName: 'xiaohongshu-review-skill',
    title: 'Xiaohongshu Review Skill',
    shortTitle: '小红书数据复盘 Skill',
    sourceProfileDir: '.xiaohongshu-review',
    reportObject: '小红书',
    outputObject: '笔记',
    scraperDir: 'xiaohongshu',
    readme: `# Xiaohongshu Review Skill

An agent-hosted skill package for Xiaohongshu creator account reporting.

This package is fixed to the Xiaohongshu workflow only.

## What It Does

- browser-assisted Xiaohongshu export
- parse watch / interaction / growth / publish / notes files
- generate \`cleanData_*\`, \`qualityReport_*\`, \`expertPrompts_*\`
- generate \`report_draft_*\`
- let the host Agent execute the built-in 3-expert methodology
- validate \`expertResults_*\`
- generate \`report_final.html/json\`

## Commands

\`\`\`bash
npm install
node scripts/run.js
node scripts/run.js --scrape-only
node scripts/run.js --analyze-only
node scripts/validate_expert_results.js --file C:\\path\\to\\expertResults.json
node scripts/generate_final.js --clean-data C:\\path\\to\\cleanData.json --expert-results C:\\path\\to\\expertResults.json
\`\`\`

## Output Location

- session: \`~/.xiaohongshu-review/session.json\`
- downloads: \`~/.xiaohongshu-review/downloads/\`
- reports: \`~/.xiaohongshu-review/reports/\`

## Host Agent Requirement

The local script stops at draft + expert prompts on purpose.
The host Agent must:

1. read the newest \`expertPrompts_*.json\`
2. execute the 3 built-in experts with the host model
3. write \`expertResults_*.json\`
4. validate it
5. call \`scripts/generate_final.js\`
`,
    skill: `# Xiaohongshu Review Skill

Use this package only for Xiaohongshu creator account data review.

This skill is fixed to one platform:
- platform: \`xiaohongshu\`
- profile dir: \`~/.xiaohongshu-review\`

## Workflow

1. Run \`node scripts/run.js\`
2. Wait for the script to generate:
   - \`cleanData_*.json\`
   - \`qualityReport_*.json\`
   - \`expertPrompts_*.json\`
   - \`report_draft_*.html/json\`
3. Read the newest \`expertPrompts_*.json\`
4. Execute the 3 fixed experts with the host Agent model:
   - \`增长分析师\`
   - \`内容策略师\`
   - \`分发分析师\`
5. Save one structured \`expertResults_*.json\`
6. Validate it with \`node scripts/validate_expert_results.js --file <path>\`
7. Generate the final report with \`node scripts/generate_final.js --clean-data <path> --expert-results <path>\`

Do not stop at draft unless the user explicitly asks for draft only.

## Important

- do not ask the user to configure a second model API
- the host Agent must use its own model to execute expert prompts
- do not package an empty final report as success
`,
  },
];

buildAll();

function buildAll() {
  fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(RELEASE_DIR, { recursive: true });

  for (const definition of PACKAGE_DEFS) {
    buildPackage(definition);
  }

  console.log(`Built ${PACKAGE_DEFS.length} release packages in ${RELEASE_DIR}`);
}

function buildPackage(definition) {
  const targetDir = path.join(RELEASE_DIR, definition.packageDirName);
  fs.mkdirSync(targetDir, { recursive: true });

  copyDir(path.join(ROOT_DIR, 'analysis'), path.join(targetDir, 'analysis'));
  copyDir(path.join(ROOT_DIR, 'templates'), path.join(targetDir, 'templates'));
  copyDir(path.join(ROOT_DIR, 'scrapers', definition.scraperDir), path.join(targetDir, 'scrapers', definition.scraperDir));

  fs.mkdirSync(path.join(targetDir, 'platforms'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'reports', '.gitkeep'), '');

  fs.copyFileSync(path.join(ROOT_DIR, '.gitignore'), path.join(targetDir, '.gitignore'));
  fs.copyFileSync(path.join(ROOT_DIR, 'package-lock.json'), path.join(targetDir, 'package-lock.json'));

  writeFile(path.join(targetDir, 'README.md'), definition.readme);
  writeFile(path.join(targetDir, 'SKILL.md'), definition.skill);
  writeFile(path.join(targetDir, 'package.json'), buildPackageJson(definition));
  writeFile(path.join(targetDir, 'platforms', 'index.js'), buildPlatformIndex(definition));

  fs.mkdirSync(path.join(targetDir, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'validate_expert_results.js'), path.join(targetDir, 'scripts', 'validate_expert_results.js'));
  fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'test-expert-results.js'), path.join(targetDir, 'scripts', 'test-expert-results.js'));

  writeFile(
    path.join(targetDir, 'scripts', 'run.js'),
    customizePlatformDefault(path.join(ROOT_DIR, 'scripts', 'run.js'), definition.platform)
  );
  writeFile(
    path.join(targetDir, 'scripts', 'generate_final.js'),
    customizePlatformDefault(path.join(ROOT_DIR, 'scripts', 'generate_final.js'), definition.platform)
  );
}

function buildPackageJson(definition) {
  const json = {
    name: definition.packageName,
    version: '1.0.0',
    description: definition.shortTitle,
    main: 'scripts/run.js',
    scripts: {
      test: 'node scripts/test-expert-results.js',
      start: 'node scripts/run.js',
      scrape: 'node scripts/run.js --scrape-only',
      analyze: 'node scripts/run.js --analyze-only',
      'validate-expert-results': 'node scripts/validate_expert_results.js',
      'generate-final': 'node scripts/generate_final.js',
    },
    dependencies: {
      playwright: '^1.52.0',
      xlsx: '^0.18.5',
      cheerio: '^1.0.0',
      chalk: '^4.1.2',
    },
    license: 'MIT',
  };

  return `${JSON.stringify(json, null, 2)}\n`;
}

function buildPlatformIndex(definition) {
  const scraper = definition.scraperDir;
  const platform = definition.platform;

  return `'use strict';

const path = require('path');
const os = require('os');

const download = require('../scrapers/${scraper}/download');
const login = require('../scrapers/${scraper}/login');
const parser = require('../scrapers/${scraper}/parser');

const platform = {
  id: '${platform}',
  profileDir: path.join(os.homedir(), '.${platform}-review'),
  getLatestFiles: download.getLatestFiles,
  login: login.login,
  downloadData: download.downloadData,
  parseFiles: parser.parseFiles,
};

function getPlatform(platformId) {
  if (platformId && platformId !== '${platform}') {
    throw new Error(\`Unsupported platform for this package: \${platformId}\`);
  }
  return platform;
}

module.exports = { platforms: { ${platform}: platform }, getPlatform };
`;
}

function customizePlatformDefault(filePath, platform) {
  const source = fs.readFileSync(filePath, 'utf8');
  return source.replace(
    "readArgValue(args, '--platform') || 'wechat'",
    `readArgValue(args, '--platform') || '${platform}'`
  );
}

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
