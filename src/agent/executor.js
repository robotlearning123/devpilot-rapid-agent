/**
 * DevPilot Agent — Executor
 *
 * Executes a review plan by sending tasks to the AI reviewer
 * and collecting results.
 */

/**
 * Execute a single plan step against an AI reviewer function.
 *
 * @param {object} step — a plan step { id, category, file, prompt }
 * @param {Function} reviewer — async (prompt) => string
 * @param {object} [options]
 * @param {number} [options.retryAttempts]
 * @param {number} [options.retryDelayMs]
 * @returns {Promise<{ stepId: number, category: string, file: string, result: string, ok: boolean }>}
 */
export async function executeStep(step, reviewer, options = {}) {
  const retryAttempts = options.retryAttempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 1000;
  let lastError;

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      const result = await reviewer(step.prompt);
      return {
        stepId: step.id,
        category: step.category,
        file: step.file,
        result,
        ok: true,
      };
    } catch (err) {
      lastError = err;
      if (attempt < retryAttempts - 1) {
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  return {
    stepId: step.id,
    category: step.category,
    file: step.file,
    result: `Error: ${lastError?.message ?? 'unknown'}`,
    ok: false,
  };
}

/**
 * Execute all steps in a plan sequentially.
 *
 * @param {Array<object>} plan — ordered plan steps
 * @param {Function} reviewer — async (prompt) => string
 * @param {object} [options]
 * @returns {Promise<Array<object>>} results for each step
 */
export async function executePlan(plan, reviewer, options = {}) {
  const results = [];
  for (const step of plan) {
    const result = await executeStep(step, reviewer, options);
    results.push(result);
  }
  return results;
}

/**
 * Summarize execution results into a review report.
 *
 * @param {Array<object>} results — execution results
 * @returns {{ total: number, passed: number, failed: number, findings: string[] }}
 */
export function summarizeResults(results) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const findings = results
    .filter((r) => r.ok && r.result?.trim())
    .map((r) => `[${r.category}] ${r.file}: ${r.result}`);

  return { total: results.length, passed, failed, findings };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
