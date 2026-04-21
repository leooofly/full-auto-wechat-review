'use strict';

const DISTRIBUTION_ROLE_PATTERN = /(分发|传播)/;
const PLACEHOLDER_PATTERNS = [
  /^3 to 5 concrete findings with numbers$/i,
  /^Detailed analysis in natural language\.$/i,
  /^1 to 3 concrete risks or recommendations$/i,
  /^Chart title$/i,
  /^用具体数字写 3 到 5 条.+发现$/,
  /^写完整的.+分析.+$/,
  /^写 1 到 3 条.+风险或建议$/,
  /^建议图表标题$/,
];

function normalizeExpertResult(result) {
  return {
    role: result && typeof result.role === 'string' ? result.role.trim() : '',
    findings: Array.isArray(result && result.findings)
      ? result.findings.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    details: result && typeof result.details === 'string' ? result.details.trim() : '',
    risks: Array.isArray(result && result.risks)
      ? result.risks.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    charts: Array.isArray(result && result.charts) ? result.charts : [],
  };
}

function normalizeExpertResultsDocument(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeExpertResult);
  }

  if (parsed && Array.isArray(parsed.expertResults)) {
    return parsed.expertResults.map(normalizeExpertResult);
  }

  throw new Error('expertResults must be an array or an object with an expertResults array.');
}

function validateExpertResultsDocument(parsed) {
  const expertResults = normalizeExpertResultsDocument(parsed);
  const errors = [];
  const roleSet = new Set();
  let totalRisks = 0;

  for (const [index, result] of expertResults.entries()) {
    const label = `expertResults[${index}]`;

    if (!result.role) {
      errors.push(`${label}.role is required.`);
      continue;
    }

    roleSet.add(classifyRole(result.role));

    if (result.findings.length === 0) {
      errors.push(`${label} (${result.role}) must include at least one finding.`);
    }

    if (!result.details) {
      errors.push(`${label} (${result.role}) must include non-empty details.`);
    }

    if (containsPlaceholderContent(result)) {
      errors.push(`${label} (${result.role}) still contains template placeholder text.`);
    }

    totalRisks += result.risks.length;
  }

  if (expertResults.length !== 3) {
    errors.push(`Expected exactly 3 expert results, received ${expertResults.length}.`);
  }

  const requiredRoles = ['growth', 'content', 'distribution'];
  for (const role of requiredRoles) {
    if (!roleSet.has(role)) {
      errors.push(`Missing required expert role category: ${role}.`);
    }
  }

  if (totalRisks === 0) {
    errors.push('At least one risk or recommendation is required across the 3 expert results.');
  }

  return {
    expertResults,
    errors,
    isValid: errors.length === 0,
  };
}

function classifyRole(role) {
  if (role.includes('增长')) {
    return 'growth';
  }
  if (role.includes('内容')) {
    return 'content';
  }
  if (DISTRIBUTION_ROLE_PATTERN.test(role)) {
    return 'distribution';
  }
  return `other:${role}`;
}

function containsPlaceholderContent(result) {
  const textValues = [
    result.details,
    ...result.findings,
    ...result.risks,
    ...result.charts.map((chart) => (chart && typeof chart.title === 'string' ? chart.title.trim() : '')),
  ].filter(Boolean);

  return textValues.some((value) => PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value)));
}

module.exports = {
  normalizeExpertResult,
  normalizeExpertResultsDocument,
  validateExpertResultsDocument,
};
