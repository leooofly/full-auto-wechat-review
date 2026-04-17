# WeChat Review

一个支持 `微信公众号` 和 `小红书` 的数据分析 skill。

它延续这个项目原本的人机协作思路：

- 能自动的步骤尽量自动完成
- 平台后台 UI 变化时，允许人工点一次导出继续流程
- 把脆弱环节留给人确认，把稳定环节交给脚本处理

## 当前支持

### 微信公众号

- 登录微信公众号后台
- 抓取内容分析与用户分析导出
- 解析 `articles_*.xls/.xlsx` 与 `users_*.xls/.xlsx`
- 生成结构化数据、专家 Prompt 和 HTML 报告

### 小红书 v1

- 登录小红书创作者后台
- 抓取或接入五类导出：`overview-watch_*`、`overview-interaction_*`、`overview-growth_*`、`overview-publish_*`、`notes_*`
- 解析账号概览四个 tab 与内容分析笔记明细
- 复用原有增长 / 内容 / 分发三视角分析与报告输出

## 安装

```bash
npm install
```

## 常用命令

微信公众号完整流程：

```bash
node scripts/run.js
```

微信公众号仅抓取：

```bash
node scripts/run.js --scrape-only
```

微信公众号仅分析缓存：

```bash
node scripts/run.js --analyze-only
```

小红书完整流程：

```bash
node scripts/run.js --platform xiaohongshu
```

小红书仅抓取：

```bash
node scripts/run.js --platform xiaohongshu --scrape-only
```

小红书仅分析缓存：

```bash
node scripts/run.js --platform xiaohongshu --analyze-only
```

运行测试：

```bash
npm test
```

## 目录约定

微信公众号：

- Session: `~/.wechat-review/session.json`
- 下载缓存: `~/.wechat-review/downloads/`
- 报告输出: `~/.wechat-review/reports/`

小红书：

- Session: `~/.xiaohongshu-review/session.json`
- 下载缓存: `~/.xiaohongshu-review/downloads/`
- 报告输出: `~/.xiaohongshu-review/reports/`

## 小红书导出文件约定

小红书 v1 默认识别以下前缀的最近文件：

- `overview-watch_*.xls/.xlsx/.csv/.html`
- `overview-interaction_*.xls/.xlsx/.csv/.html`
- `overview-growth_*.xls/.xlsx/.csv/.html`
- `overview-publish_*.xls/.xlsx/.csv/.html`
- `notes_*.xls/.xlsx/.csv/.html`

其中：

- `overview-watch_*` 用于观看数据
- `overview-interaction_*` 用于互动数据
- `overview-growth_*` 用于涨粉数据
- `overview-publish_*` 用于发布数据
- `notes_*` 用于笔记明细

如果自动下载因后台结构变化失败，可以手动导出这五类文件放到缓存目录，再运行 `--analyze-only`。

## 输出产物

- `cleanData_*.json`
- `qualityReport_*.json`
- `expertPrompts_*.json`
- `report_*.html`
- `report_*.json`
- `report_final.html`

## 工作方式说明

这个项目不追求“纯无人值守”。

原因很简单：微信后台和小红书后台都可能调整页面结构、按钮文案和导出入口。相比脆弱的全自动化，“登录和导出允许人工确认一次，后续分析自动完成”的流程更稳，也更适合真实运营场景。

## 发布说明

- `node_modules/` 已排除，不建议提交
- `reports/*.html` 和 `reports/*.json` 为分析产物，不建议公开提交
- `scripts/test-parser.js` 现在使用临时合成 fixture，不再依赖本机缓存

## 免责声明

该项目依赖平台后台当前页面结构与导出能力。

如果未来平台调整后台入口、按钮文案或导出机制，自动化部分可能需要小幅维护。当前实现已经尽量把高风险步骤设计成“可人工接管”的协作流程，以降低失效概率。
