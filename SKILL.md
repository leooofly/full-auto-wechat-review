# WeChat Review - 微信与小红书数据分析
支持微信公众号与小红书后台数据的浏览器辅助抓取、解析、清洗、多专家分析和 HTML 报告输出。适用于需要复盘公众号或小红书账号数据、生成增长/内容/分发分析、或把后台导出文件转成结构化报告的场景。优先采用“自动优先、人工兜底”的人机协作流程，而不是强行全自动。

## Commands

### `review` - 完整流程

执行：

1. 检查对应平台缓存目录
2. 如无缓存，打开浏览器辅助登录并尝试自动下载
3. 自动解析原始导出文件
4. 清洗与校验数据
5. 生成 3 位专家的分析 Prompt
6. 输出 JSON 与 HTML 报告

微信公众号：

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js
```

小红书：

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js --platform xiaohongshu
```

### `scrape` - 仅抓取

微信公众号：

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js --scrape-only
```

小红书：

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js --platform xiaohongshu --scrape-only
```

### `analyze` - 仅分析缓存

微信公众号：

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js --analyze-only
```

小红书：

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js --platform xiaohongshu --analyze-only
```

## Data Sources

### 微信公众号

- `articles_*.xls/.xlsx`
- `users_*.xls/.xlsx`

### 小红书 v1

- `overview-watch_*.xls/.xlsx/.csv/.html`
- `overview-interaction_*.xls/.xlsx/.csv/.html`
- `overview-growth_*.xls/.xlsx/.csv/.html`
- `overview-publish_*.xls/.xlsx/.csv/.html`
- `notes_*.xls/.xlsx/.csv/.html`

默认将这三类文件映射为：

- `overview-watch_*` -> 观看数据
- `overview-interaction_*` -> 互动数据
- `overview-growth_*` -> 涨粉数据
- `overview-publish_*` -> 发布数据
- `notes_*` -> 笔记明细
- `users_*` -> 粉丝/用户变化

## Analysis Method

统一保留 3 位专家视角：

- 增长分析师：看粉丝增长、获客、流失、停滞期
- 内容策略师：看选题、标题、内容表现、节奏
- 分发分析师：看渠道/来源、分享、收藏、传播潜力

平台差异优先在解析层和指标映射层处理，后续分析与报告尽量复用。

## Collaboration Rules

- 默认先尝试自动登录、自动选日期、自动点击导出
- 如果后台结构变化导致自动操作失败，提示人工点击一次导出
- 不要为了追求“全自动”而牺牲稳定性
- 对小红书缺少来源拆分的情况允许降级，继续生成完整报告

## Output

微信公众号输出目录：

- `~/.wechat-review/reports/`

小红书输出目录：

- `~/.xiaohongshu-review/reports/`

典型产物：

- `cleanData_*.json`
- `qualityReport_*.json`
- `expertPrompts_*.json`
- `report_*.html`
- `report_*.json`
