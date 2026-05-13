/**
 * DevPilot — Google Cloud Vertex AI Integration
 *
 * Uses Vertex AI to generate code review feedback.
 * Designed to work without paid APIs — falls back to
 * local heuristic review when no credentials are available.
 */

/**
 * Create a Vertex AI reviewer.
 *
 * @param {object} config — { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION }
 * @param {object} [deps] — injectable dependencies for testing
 * @returns {{ review: (prompt: string) => Promise<string> }}
 */
export function createVertexReviewer(config, deps = {}) {
  const { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION } = config;
  const fetchFn = deps.fetch ?? globalThis.fetch;

  /**
   * Send a review prompt to Vertex AI and get feedback.
   * Falls back to heuristic review if cloud is unavailable.
   *
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async function review(prompt) {
    if (!GOOGLE_CLOUD_PROJECT) {
      return heuristicReview(prompt);
    }

    try {
      return await callVertexAI(prompt);
    } catch {
      return heuristicReview(prompt);
    }
  }

  /**
   * Call Vertex AI predict endpoint.
   */
  async function callVertexAI(prompt) {
    const endpoint = `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}/publishers/google/models/gemini-1.5-flash:predict`;

    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ content: prompt }],
        parameters: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Vertex AI ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data.predictions?.[0]?.content ?? 'No review generated';
  }

  return { review };
}

/**
 * Local heuristic review — used as fallback when cloud is unavailable.
 * Detects common code issues without AI.
 */
export function heuristicReview(prompt) {
  const findings = [];

  if (/password|secret|api[_-]?key/i.test(prompt)) {
    findings.push('Potential hardcoded credential detected');
  }
  if (/eval\s*\(/i.test(prompt)) {
    findings.push('Use of eval() detected — potential security risk');
  }
  if (/TODO|FIXME|HACK/i.test(prompt)) {
    findings.push('Contains TODO/FIXME marker — consider resolving before merge');
  }
  if (/console\.log/i.test(prompt)) {
    findings.push('Contains console.log — remove before production');
  }
  if (/catch\s*\(\s*\)/i.test(prompt)) {
    findings.push('Empty catch block — errors may be silently swallowed');
  }

  if (findings.length === 0) {
    return 'No issues found in heuristic review';
  }
  return findings.join('; ');
}
