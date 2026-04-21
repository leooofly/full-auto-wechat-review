'use strict';

const { normalizeExpertResult } = require('./expert-results');

function prepareExpertPrompts(castingResult) {
  const { experts } = castingResult;

  const prompts = experts.map((expert) => ({
    role: expert.role,
    anchor: expert.anchor,
    focusAreas: expert.focusAreas,
    prompt: expert.prompt,
  }));

  console.log(`[analyze] Prepared ${prompts.length} expert prompts`);
  for (const prompt of prompts) {
    console.log(`  -> ${prompt.role}: ${prompt.prompt.length} chars`);
  }

  return { prompts, parseResult };
}

function parseResult(rawResponse) {
  let parsed = tryParseJson(rawResponse);

  if (!parsed) {
    const blockMatch = String(rawResponse || '').match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    parsed = blockMatch ? tryParseJson(blockMatch[1].trim()) : null;
  }

  if (!parsed) {
    const braceMatch = String(rawResponse || '').match(/\{[\s\S]*\}/);
    parsed = braceMatch ? tryParseJson(braceMatch[0]) : null;
  }

  if (parsed) {
    return normalizeExpertResult(parsed);
  }

  return {
    role: 'Unknown expert',
    findings: [],
    details: String(rawResponse || ''),
    risks: [],
    charts: [],
  };
}

function collectResults(expertResults) {
  const normalized = expertResults.map(normalizeExpertResult);

  console.log(`[analyze] Collected ${normalized.length} expert results`);
  for (const result of normalized) {
    console.log(`  -> ${result.role}: ${result.findings.length} findings, ${result.risks.length} risks`);
  }

  return { expertResults: normalized };
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

module.exports = { prepareExpertPrompts, parseResult, collectResults };
