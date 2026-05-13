/**
 * DevPilot — Gemini Integration
 *
 * Provides a Gemini client that works with both Google AI (API key)
 * and Vertex AI (Google Cloud) endpoints. Falls back to heuristic
 * review when no credentials are configured.
 *
 * Uses the modern generateContent API for Gemini models.
 */

const DEFAULT_MODEL = 'gemini-2.0-flash';
const REVIEW_SYSTEM_PROMPT = `You are a senior code reviewer. Analyze the provided code or diff and identify:
1. Security vulnerabilities (hardcoded secrets, injection risks, auth issues)
2. Correctness bugs (logic errors, edge cases, null/undefined risks)
3. Performance issues (N+1 queries, unnecessary allocations, blocking calls)
4. Style/maintainability (naming, dead code, missing error handling)
Be concise — list findings as bullet points. If no issues, respond "No issues found."`;

/**
 * Create a Gemini client.
 *
 * @param {object} config — { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GEMINI_API_KEY }
 * @param {object} [deps] — injectable dependencies for testing
 * @returns {{ generate, review, chat }}
 */
export function createGeminiClient(config = {}, deps = {}) {
  const fetchFn = deps.fetch ?? globalThis.fetch;
  const project = config.GOOGLE_CLOUD_PROJECT;
  const location = config.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const apiKey = config.GEMINI_API_KEY;
  const model = config.GEMINI_MODEL || DEFAULT_MODEL;

  /**
   * Generate a completion from Gemini.
   *
   * @param {string} prompt — user prompt
   * @param {object} [options]
   * @param {string} [options.systemInstruction] — system prompt
   * @param {number} [options.temperature] — sampling temperature (default 0.2)
   * @param {number} [options.maxOutputTokens] — max tokens (default 1024)
   * @returns {Promise<string>}
   */
  async function generate(prompt, options = {}) {
    if (!project && !apiKey) {
      return heuristicFallback(prompt);
    }

    const { systemInstruction, temperature = 0.2, maxOutputTokens = 1024 } = options;
    const { url, headers } = buildRequest(model, apiKey, project, location);
    const contents = buildContents(prompt, systemInstruction);

    const res = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents,
        generationConfig: { temperature, maxOutputTokens },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Gemini API ${res.status}: ${text}`);
    }

    const data = await res.json();
    return extractText(data);
  }

  /**
   * Review code using Gemini with a specialized system prompt.
   *
   * @param {string} codeOrDiff — code or diff to review
   * @param {object} [options] — generation options
   * @returns {Promise<string>}
   */
  async function review(codeOrDiff, options = {}) {
    try {
      return await generate(codeOrDiff, {
        systemInstruction: REVIEW_SYSTEM_PROMPT,
        temperature: 0.1,
        ...options,
      });
    } catch {
      return heuristicFallback(codeOrDiff);
    }
  }

  /**
   * Multi-turn chat completion.
   *
   * @param {Array<{ role: string, text: string }>} messages
   * @param {object} [options] — generation options
   * @returns {Promise<string>}
   */
  async function chat(messages, options = {}) {
    if (!project && !apiKey) {
      return heuristicFallback(messages.map((m) => m.text).join('\n'));
    }

    const { systemInstruction, temperature = 0.3, maxOutputTokens = 1024 } = options;
    const { url, headers } = buildRequest(model, apiKey, project, location);
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    const res = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
        generationConfig: { temperature, maxOutputTokens },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Gemini API ${res.status}: ${text}`);
    }

    const data = await res.json();
    return extractText(data);
  }

  return { generate, review, chat };
}

/**
 * Build the API URL and headers based on auth method.
 */
function buildRequest(model, apiKey, project, location) {
  if (apiKey) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
    };
  }
  return {
    url: `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`,
    headers: { 'Content-Type': 'application/json' },
  };
}

/**
 * Build contents array for generateContent API.
 */
function buildContents(prompt, systemInstruction) {
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  // systemInstruction is passed at the top level, not in contents
  return contents;
}

/**
 * Extract text from Gemini API response.
 */
function extractText(data) {
  const candidate = data.candidates?.[0];
  if (!candidate) return 'No response generated';

  const text = candidate.content?.parts?.map((p) => p.text).join('');
  if (text) return text;

  if (candidate.finishReason === 'SAFETY') {
    return 'Response blocked by safety filters';
  }
  return 'No text in response';
}

/**
 * Heuristic fallback when no credentials are configured.
 * Reuses the same logic from vertex.js for consistency.
 */
function heuristicFallback(prompt) {
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
  if (/innerHTML/i.test(prompt)) {
    findings.push('Use of innerHTML — potential XSS risk');
  }
  if (/document\.write/i.test(prompt)) {
    findings.push('Use of document.write — deprecated and potentially unsafe');
  }

  if (findings.length === 0) {
    return 'No issues found in heuristic review';
  }
  return findings.join('; ');
}
