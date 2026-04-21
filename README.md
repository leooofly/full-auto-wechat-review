# wechat-review

This repository is the shared source codebase for two separate skills.
It is not the single end-user skill package to install directly.

A reporting skill project for:
- WeChat Official Accounts
- Xiaohongshu creator accounts

It supports:
- browser-assisted export
- parsing backend files
- data cleaning and validation
- fixed 3-expert methodology
- draft and final HTML report generation

## Release Strategy

This repository now maintains:
- one shared source codebase
- two separate distributable skill packages

Build them with:

```bash
npm run build-release-packages
```

Generated package folders:
- `release/wechat-review-skill`
- `release/xiaohongshu-review-skill`

These are the packages you should zip and upload separately.
End users should install one or both of those generated packages, not this mixed source repository as a single skill.

## Important Product Boundary

This project is meant to run inside host Agents such as Codex, Claude Code, and OpenClaw.

Use this split:

- Local scripts:
  - export
  - parse
  - clean
  - generate `expertPrompts_*`
  - generate `report_draft_*`
- Host Agent:
  - execute the 3 built-in expert prompts with the host model
  - write `expertResults_*`
  - run `scripts/generate_final.js`

Do not require end users to configure a second model API for this skill.

## Fixed Methodology

Always keep these 3 roles:

1. `增长分析师`
2. `内容策略师`
3. `分发分析师`

The prompt definitions live in:
- `analysis/casting.js`
- `analysis/analyze.js`

## Install

```bash
npm install
```

## Common Commands

Prepare WeChat data:

```bash
node scripts/run.js --platform wechat
```

Prepare WeChat data for an exact range:

```bash
node scripts/run.js --platform wechat --date-from 2026-04-13 --date-to 2026-04-19
```

Prepare Xiaohongshu data:

```bash
node scripts/run.js --platform xiaohongshu
```

Analyze cache only:

```bash
node scripts/run.js --platform wechat --analyze-only
node scripts/run.js --platform xiaohongshu --analyze-only
```

Validate expert results:

```bash
node scripts/validate_expert_results.js --file C:\path\to\expertResults.json
```

Generate final report:

```bash
node scripts/generate_final.js --platform wechat --clean-data C:\path\to\cleanData.json --expert-results C:\path\to\expertResults.json
```

Run tests:

```bash
npm test
```

## Agent Host Workflow

This is the correct end-to-end workflow:

1. Run `node scripts/run.js ...`
2. Get:
   - `cleanData_*`
   - `qualityReport_*`
   - `expertPrompts_*`
   - `report_draft_*`
3. Read the newest `expertPrompts_*.json`
4. Execute all 3 expert prompts with the host Agent model
5. Save one `expertResults_*.json`
6. Validate it with `scripts/validate_expert_results.js`
7. Run `scripts/generate_final.js`
8. Deliver `report_final.html` and `report_final.json`

## Output Files

- `cleanData_*.json`
- `qualityReport_*.json`
- `expertPrompts_*.json`
- `expertResults_*.json`
- `report_draft_*.html`
- `report_draft_*.json`
- `report_final.html`
- `report_final.json`

`report_draft_*` is not the final report.
If `核心发现` and `风险与建议` are still empty, the host Agent has not finished the skill workflow.

## Validation Rules For expertResults

The final step will reject invalid expert results.
The `expertResults` file must satisfy all of these:

- exactly 3 expert entries
- includes growth, content, and distribution roles
- each expert has at least 1 finding
- each expert has non-empty `details`
- the whole file contains at least 1 risk item

Use:
- `templates/expert-results.template.json`

as the shape reference.

## Storage

WeChat:
- session: `~/.wechat-review/session.json`
- downloads: `~/.wechat-review/downloads/`
- reports: `~/.wechat-review/reports/`

Xiaohongshu:
- session: `~/.xiaohongshu-review/session.json`
- downloads: `~/.xiaohongshu-review/downloads/`
- reports: `~/.xiaohongshu-review/reports/`

## Collaboration Principle

This project does not chase brittle full-unmanned automation.

Use automation where it is stable.
Allow one manual assist only when a platform UI change blocks export.
Never disguise an incomplete draft as a finished final report.
