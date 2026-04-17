# WeChat Review

一个用于微信公众号后台数据抓取、解析和多专家视角分析的 skill。

## 能力

- 登录微信公众号后台并下载图文分析、用户分析数据
- 解析 `articles_*.xls` 和 `users_*.xls`
- 清洗并校验 30 天左右的数据
- 生成增长分析师、内容策略师、传播分析师三类专家 prompt
- 输出结构化 JSON 和 HTML 报告

## 安装

```bash
npm install
```

## 用法

完整流程：

```bash
node scripts/run.js
```

仅抓取：

```bash
node scripts/run.js --scrape-only
```

仅分析本地最近一次缓存：

```bash
node scripts/run.js --analyze-only
```

运行解析链路测试：

```bash
npm test
```

或：

```bash
node scripts/test-parser.js
```

## 本地数据目录

- Session: `~/.wechat-review/session.json`
- 下载缓存: `~/.wechat-review/downloads/`
- 报告输出: `~/.wechat-review/reports/`

## 发布说明

- `node_modules/` 已排除，不建议提交
- `reports/*.html` 和 `reports/*.json` 为分析产物，不建议公开提交
- `scripts/test-parser.js` 会自动读取本机最新缓存数据，不再依赖固定文件名
- `scripts/generate_final.js` 会默认读取 `~/.wechat-review/reports/` 下最新的 `cleanData_*.json`
