/**
 * DevPilot — Review Orchestrator
 *
 * Orchestrates the full MR review loop:
 *   1. Load + validate config
 *   2. Connect to GitLab
 *   3. Fetch open MR diffs
 *   4. Create review plans
 *   5. Execute reviews via Vertex AI
 *   6. Post results back to GitLab
 */

import { loadConfig, validateConfig } from './utils/config.js';
import { createPlan, prioritizePlan } from './agent/planner.js';
import { executePlan, summarizeResults } from './agent/executor.js';
import { createGitLabClient } from './gitlab/client.js';
import { createVertexReviewer } from './cloud/vertex.js';

/**
 * Run the DevPilot review agent against a single merge request.
 *
 * @param {object} [overrides] — override config values
 * @param {object} [deps] — injectable dependencies for testing
 * @returns {Promise<{ reviewed: number, results: object }>}
 */
export async function runAgent(overrides = {}, deps = {}) {
  const config = loadConfig(overrides);
  const validation = validateConfig(config);

  if (!validation.valid) {
    throw new Error(`Missing configuration: ${validation.missing.join(', ')}`);
  }

  const gitlab = deps.gitlab ?? createGitLabClient(config, deps.fetch);
  const reviewer = deps.reviewer ?? createVertexReviewer(config, deps);

  // Get merge requests to review
  const mrIid = overrides.MR_IID;
  const diff = await gitlab.getMRDiff(mrIid);

  // Plan and execute review
  const plan = prioritizePlan(createPlan(diff, { maxSteps: config.MAX_PLAN_STEPS }));
  const results = await executePlan(plan, reviewer.review.bind(reviewer), {
    retryAttempts: config.RETRY_ATTEMPTS,
    retryDelayMs: config.RETRY_DELAY_MS,
  });

  // Summarize and post results
  const summary = summarizeResults(results);

  if (summary.findings.length > 0 && !overrides.DRY_RUN) {
    const report = formatReport(summary);
    await gitlab.postComment(mrIid, report);
  }

  return { reviewed: diff.length, results: summary };
}

/**
 * Format review results as a markdown comment for GitLab.
 */
function formatReport(summary) {
  const lines = [
    '## DevPilot AI Review',
    '',
    `Reviewed ${summary.total} aspects — ${summary.passed} passed, ${summary.failed} failed`,
    '',
    '### Findings',
    '',
  ];
  for (const f of summary.findings) {
    lines.push(`- ${f}`);
  }
  return lines.join('\n');
}
