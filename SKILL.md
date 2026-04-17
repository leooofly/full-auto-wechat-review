# WeChat Review — 公众号数据分析

微信公众号后台数据的自动抓取、解析与多专家深度分析。

## Commands

### `review` — 一键全流程
完整执行：检查缓存 → 抓取（如需）→ 解析 → 清洗 → 多专家分析 → 生成报告。

**触发词**: `review 公众号`, `分析公众号数据`, `公众号报告`

**执行步骤**:
1. 检查 `~/.wechat-review/downloads/` 是否有缓存的 Excel 文件
2. 如果没有，触发浏览器登录微信后台 + 下载数据
3. 解析 articles（渠道阅读、互动趋势、单篇明细）和 users（用户增长）
4. 数据清洗与校验，生成质量报告
5. 多专家选角：增长分析师 / 内容策略师 / 传播分析师
6. 每位专家独立分析（通过 LLM 执行专家 prompt）
7. 综合所有专家发现，生成结构化报告

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js
```

需要 Claude 执行专家分析时，将 `analysis/analyze.js` 生成的 prompt 交给 LLM，收集结果后传给 `analysis/synthesize.js` 生成最终报告。

### `scrape` — 只抓取数据
登录微信后台，下载最近30天的图文分析和用户分析 Excel。

**触发词**: `抓取公众号数据`, `下载公众号报表`

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js --scrape-only
```

- 需要扫码登录（headless: false）
- Session 持久化到 `~/.wechat-review/session.json`
- 下载文件存到 `~/.wechat-review/downloads/`

### `analyze` — 只分析已有数据
跳过抓取，直接使用最新的缓存文件进行分析。

**触发词**: `分析已有数据`, `重新分析公众号`

```bash
cd D:\AI\skills\wechat-review && node scripts/run.js --analyze-only
```

## 数据源

### 文章数据（articles_*.xls）
真正的 .xls 文件，单 sheet 内含3个并排子表：
- **渠道阅读趋势**：每日8渠道（公众号消息、聊天会话、朋友圈、公众号主页、其他、推荐、搜一搜、全部）的阅读人数
- **互动趋势**：每日分享/原文点击/收藏/发表篇数
- **单篇来源明细**：每篇文章按渠道拆行，取"传播渠道=全部"去重得到文章级汇总

### 用户数据（users_*.xls）
HTML 伪装成 .xls，用 cheerio 解析。包含：
- 新关注人数、取消关注人数、净增关注人数、累积关注人数（按日）

## 分析方法论

**多专家选角机制**：基于数据特征选择3位虚拟专家，各自独立分析后交叉综合。

| 专家 | 锚定人物 | 关注维度 |
|------|----------|----------|
| 增长分析师 | Andrew Chen | 粉丝增长、获客来源、留存/流失 |
| 内容策略师 | Ann Handley | 选题效果、标题打开率、内容排名 |
| 传播分析师 | Jonah Berger | 渠道分布、转发裂变、传播路径 |

## 依赖

```bash
npm install  # playwright, xlsx, cheerio, chalk
```

## 输出

- 结构化 JSON 数据（cleanData, expertResults, report）
- HTML 可视化报告（Chart.js 图表 + KPI 卡片）
- 存放于 `~/.wechat-review/reports/`
