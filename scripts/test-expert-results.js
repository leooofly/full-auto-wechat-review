'use strict';

const { validateExpertResultsDocument } = require('../analysis/expert-results');

run();

function run() {
  console.log('Testing expert result validation...');

  const valid = validateExpertResultsDocument({
    expertResults: [
      {
        role: '增长分析师',
        findings: ['净增粉丝 23，主要集中在 4 月 17 日和 4 月 18 日。'],
        details: '增长主要由单篇爆款文章带动，后续需要验证可复制性。',
        risks: ['增粉过于依赖单篇内容峰值。'],
        charts: [],
      },
      {
        role: '内容策略师',
        findings: ['头部文章贡献了大部分阅读。'],
        details: '内容结构偏头部驱动，选题分布还不够均衡。',
        risks: [],
        charts: [],
      },
      {
        role: '分发分析师',
        findings: ['聊天会话仍然是主分发渠道。'],
        details: '私域分发强，公域承接还弱。',
        risks: ['渠道结构过于集中。'],
        charts: [],
      },
    ],
  });

  assert(valid.isValid, 'Valid expert results should pass validation');

  const invalid = validateExpertResultsDocument({
    expertResults: [
      { role: '增长分析师', findings: [], details: '', risks: [], charts: [] },
      { role: '内容策略师', findings: [], details: '', risks: [], charts: [] },
      { role: '分发分析师', findings: [], details: '', risks: [], charts: [] },
    ],
  });

  assert(!invalid.isValid, 'Placeholder expert results should fail validation');
  assert(invalid.errors.length > 0, 'Invalid expert results should produce errors');

  const templateLike = validateExpertResultsDocument({
    expertResults: [
      {
        role: '增长分析师',
        findings: ['用具体数字写 3 到 5 条增长发现'],
        details: '写完整的增长分析，说明增长驱动、波峰波谷、流失和建议。',
        risks: ['写 1 到 3 条增长风险或建议'],
        charts: [{ type: 'line', title: '建议图表标题', fields: ['date', 'newUser'] }],
      },
      {
        role: '内容策略师',
        findings: ['用具体数字写 3 到 5 条内容发现'],
        details: '写完整的内容分析，说明选题、标题、内容表现和节奏。',
        risks: ['写 1 到 3 条内容风险或建议'],
        charts: [{ type: 'bar', title: '建议图表标题', fields: ['title', 'readers'] }],
      },
      {
        role: '分发分析师',
        findings: ['用具体数字写 3 到 5 条分发发现'],
        details: '写完整的分发分析，说明渠道贡献、分享扩散和传播路径。',
        risks: ['写 1 到 3 条分发风险或建议'],
        charts: [{ type: 'pie', title: '建议图表标题', fields: ['channel', 'readers'] }],
      },
    ],
  });

  assert(!templateLike.isValid, 'Template placeholder content should fail validation');

  console.log('Expert result validation tests passed.');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
