'use strict';

/**
 * Phase 3: 分析执行
 * 
 * 生成每个专家的分析 prompt，供 Cola 的 LLM 调用。
 * 实际的 LLM 调用由 Cola 的 session_spawn 机制完成。
 * 这个文件只负责：
 *   1. 组装最终 prompt（角色定义 + 数据 + 任务）
 *   2. 提供结果解析函数
 * 
 * @param {{ experts: Array }} castingResult
 * @param {object} cleanData
 * @returns {{ prompts: Array<{ role, prompt }>, parseResult: Function }}
 */
function prepareExpertPrompts(castingResult, cleanData) {
  const { experts } = castingResult;

  const prompts = experts.map(expert => ({
    role: expert.role,
    anchor: expert.anchor,
    focusAreas: expert.focusAreas,
    prompt: expert.prompt,
  }));

  console.log(`[analyze] 已准备 ${prompts.length} 个专家 prompt`);
  for (const p of prompts) {
    console.log(`  → ${p.role}: ${p.prompt.length} 字符`);
  }

  return { prompts, parseResult };
}

/**
 * 解析 LLM 返回的专家分析结果
 * 
 * LLM 应返回 JSON 格式的分析结果。
 * 这个函数负责提取并校验。
 * 
 * @param {string} rawResponse - LLM 的原始响应文本
 * @returns {object} 结构化的专家分析结果
 */
function parseResult(rawResponse) {
  // 尝试提取 JSON 块
  let json = null;

  // 方法1：直接解析
  try {
    json = JSON.parse(rawResponse);
  } catch {
    // 方法2：从 markdown code block 中提取
    const match = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (match) {
      try {
        json = JSON.parse(match[1].trim());
      } catch {
        // 方法3：找最外层的 { }
        const braceMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try {
            json = JSON.parse(braceMatch[0]);
          } catch {
            // 放弃，返回原始文本
          }
        }
      }
    }
  }

  if (json) {
    // 校验必要字段
    return {
      role: json.role || '未知专家',
      findings: Array.isArray(json.findings) ? json.findings : [],
      details: json.details || '',
      risks: Array.isArray(json.risks) ? json.risks : [],
      charts: Array.isArray(json.charts) ? json.charts : [],
    };
  }

  // 无法解析为 JSON，包装为纯文本结果
  return {
    role: '未知专家',
    findings: [],
    details: rawResponse,
    risks: [],
    charts: [],
  };
}

/**
 * 汇总所有专家结果
 * 
 * @param {Array<object>} expertResults - 每位专家的结构化分析结果
 * @returns {{ expertResults: Array }}
 */
function collectResults(expertResults) {
  // 校验并规范化
  const normalized = expertResults.map(result => ({
    role: result.role,
    findings: result.findings || [],
    details: result.details || '',
    risks: result.risks || [],
    charts: result.charts || [],
  }));

  console.log(`[analyze] 已收集 ${normalized.length} 位专家的分析结果`);
  for (const r of normalized) {
    console.log(`  → ${r.role}: ${r.findings.length} 条发现, ${r.risks.length} 条风险`);
  }

  return { expertResults: normalized };
}

module.exports = { prepareExpertPrompts, parseResult, collectResults };
