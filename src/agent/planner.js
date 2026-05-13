/**
 * DevPilot Agent — Task Planner
 *
 * Analyzes a merge request diff and generates an ordered list
 * of review tasks for the executor to perform.
 */

const REVIEW_CATEGORIES = ['security', 'performance', 'correctness', 'style', 'maintainability'];

/**
 * Create a review plan from a diff and optional context.
 * Returns an array of { id, category, file, lineStart, lineEnd, prompt } tasks.
 *
 * @param {object} diff — parsed diff entries [{ file, hunks: [{ lines }] }]
 * @param {object} [options]
 * @param {number} [options.maxSteps] — cap on total tasks (default from config)
 * @returns {Array<object>} plan steps
 */
export function createPlan(diff, options = {}) {
  const maxSteps = options.maxSteps ?? 10;
  const plan = [];
  let id = 1;

  for (const entry of diff) {
    if (plan.length >= maxSteps) break;

    // Each file with changes gets a correctness review
    plan.push({
      id: id++,
      category: 'correctness',
      file: entry.file,
      lineStart: entry.hunks?.[0]?.oldStart ?? 1,
      lineEnd: entry.hunks?.at(-1)?.oldStart + (entry.hunks?.at(-1)?.oldLines ?? 0) ?? 1,
      prompt: `Review ${entry.file} for correctness issues`,
    });

    // Large files also get performance + security reviews
    const totalLines = entry.hunks?.reduce((sum, h) => sum + (h.newLines ?? 0), 0) ?? 0;
    if (totalLines > 50 && plan.length < maxSteps) {
      plan.push({
        id: id++,
        category: 'performance',
        file: entry.file,
        lineStart: entry.hunks?.[0]?.oldStart ?? 1,
        lineEnd: entry.hunks?.at(-1)?.oldStart + (entry.hunks?.at(-1)?.oldLines ?? 0) ?? 1,
        prompt: `Analyze ${entry.file} for performance concerns (${totalLines} lines changed)`,
      });
    }

    if (plan.length < maxSteps && entry.file.match(/\.(sql|env|ya?ml)$/i)) {
      plan.push({
        id: id++,
        category: 'security',
        file: entry.file,
        lineStart: 1,
        lineEnd: 1,
        prompt: `Security review for ${entry.file} — sensitive file type`,
      });
    }
  }

  return plan;
}

/**
 * Validate a plan has the right shape.
 * @param {Array} plan
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlan(plan) {
  const errors = [];
  if (!Array.isArray(plan)) {
    return { valid: false, errors: ['Plan must be an array'] };
  }
  for (const step of plan) {
    if (!step.id) errors.push(`Step missing id`);
    if (!REVIEW_CATEGORIES.includes(step.category)) {
      errors.push(`Step ${step.id} has invalid category: ${step.category}`);
    }
    if (!step.file) errors.push(`Step ${step.id} missing file`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Sort plan by priority: security > correctness > performance > others.
 * @param {Array} plan
 * @returns {Array} sorted plan
 */
export function prioritizePlan(plan) {
  const priority = { security: 0, correctness: 1, performance: 2, style: 3, maintainability: 4 };
  return [...plan].sort((a, b) => (priority[a.category] ?? 5) - (priority[b.category] ?? 5));
}
