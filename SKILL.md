# WeChat Review Skill

This file documents the shared source repository, not the final end-user installation package.
The actual installable outputs are two separate generated skills:
- `release/wechat-review-skill`
- `release/xiaohongshu-review-skill`

This skill prepares and finalizes operation reports for:
- WeChat Official Accounts
- Xiaohongshu creator accounts

This repository now acts as the shared source for two separate release packages:
- `release/wechat-review-skill`
- `release/xiaohongshu-review-skill`

Build them with:

```bash
npm run build-release-packages
```

This is a skill for host Agents such as Codex, Claude Code, and OpenClaw.
It is not just a local Node script tool.

## Product Boundary

Split responsibilities on purpose:

- Local scripts handle stable data work:
  - browser-assisted export
  - parsing
  - cleaning
  - draft report generation
  - expert prompt generation
- The host Agent handles AI work:
  - execute the 3 built-in expert prompts with the host model
  - write `expertResults_*.json`
  - call `scripts/generate_final.js`

Do not require end users to configure a second model API just for this skill.

## Fixed SOP

Do not replace the built-in methodology with random experts.
Always keep these 3 roles:

1. `增长分析师`
2. `内容策略师`
3. `分发分析师`

The skill already defines those prompts in code.
Your job as the host Agent is to execute them and write structured results.

## Output Contract

The local script must produce:

- `cleanData_*.json`
- `qualityReport_*.json`
- `expertPrompts_*.json`
- `report_draft_*.html`
- `report_draft_*.json`

The host Agent must then produce:

- `expertResults_*.json`
- `report_final.html`
- `report_final.json`

`report_draft_*` is never the final deliverable.
If `核心发现` and `风险与建议` are still empty, the workflow is incomplete.

## Required Workflow

When the user asks for a WeChat or Xiaohongshu review report, complete the workflow in this order:

1. Run `node scripts/run.js ...` with the correct platform and date options.
2. Find the newest `expertPrompts_*.json` in the platform reports directory.
3. Read the 3 expert prompts from that JSON file.
4. Use the host Agent model to execute all 3 prompts yourself in this session.
5. Convert the 3 outputs into one structured `expertResults_*.json` file.
6. Validate it with `node scripts/validate_expert_results.js --file <path>`.
7. Run `node scripts/generate_final.js --platform ... --clean-data ... --expert-results ...`.
8. Return the final report path to the user.

Do not stop at draft unless the user explicitly asks for draft only.

## Expert Result Format

Use the structure below for each of the 3 experts:

```json
{
  "role": "增长分析师",
  "findings": ["3 to 5 concrete findings with numbers"],
  "details": "Detailed analysis in natural language.",
  "risks": ["1 to 3 concrete risks or recommendations"],
  "charts": [
    {
      "type": "line",
      "title": "Chart title",
      "fields": ["date", "newUser"]
    }
  ]
}
```

Use `templates/expert-results.template.json` as the shape reference.

## Quality Rules

Before generating the final report, make sure:

- there are exactly 3 expert results
- the 3 role categories are present:
  - growth
  - content
  - distribution
- each expert has at least 1 finding
- each expert has non-empty `details`
- there is at least 1 risk item across the whole file

If the validation fails, do not generate `report_final.*`.

## Date Range Rule

The report range must match the exported backend data exactly.

- `--analyze-only` reuses cached files
- if the user asks for last week, last 7 days, or last 30 days, make sure the exported files match that range
- for WeChat, prefer `--date-from` and `--date-to` when the user gives an exact period

## Collaboration Rule

Default to realistic automation:

- automate login, navigation, date selection, and export when stable
- allow one manual assist only when the platform UI changes and automation is blocked
- never package an empty final report as success

## Common Commands

WeChat full prep:

```bash
node scripts/run.js --platform wechat
```

WeChat exact range:

```bash
node scripts/run.js --platform wechat --date-from 2026-04-13 --date-to 2026-04-19
```

Xiaohongshu full prep:

```bash
node scripts/run.js --platform xiaohongshu
```

Validate expert results:

```bash
node scripts/validate_expert_results.js --file C:\path\to\expertResults.json
```

Generate final report:

```bash
node scripts/generate_final.js --platform wechat --clean-data C:\path\to\cleanData.json --expert-results C:\path\to\expertResults.json
```
