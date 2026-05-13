/**
 * GitLab MCP client — wraps GitLab REST API calls used during issue triage.
 * Designed for testability: pass a custom `fetch` in options to avoid real HTTP.
 */

const GITLAB_API_VERSION = 'v4';

function buildBaseUrl(gitlabUrl) {
  return `${gitlabUrl.replace(/\/+$/, '')}/api/${GITLAB_API_VERSION}`;
}

/**
 * Fetch issues from a GitLab project.
 * @param {object} config - Must include GITLAB_URL, GITLAB_TOKEN, GITLAB_PROJECT_ID
 * @param {object} [params] - Query params (state, labels, per_page, etc.)
 * @param {function} [fetchFn] - Injectable fetch for testing
 * @returns {Promise<Array>} Array of issue objects
 */
export async function fetchIssues(config, params = {}, fetchFn = fetch) {
  const { GITLAB_URL, GITLAB_TOKEN, GITLAB_PROJECT_ID } = config;
  if (!GITLAB_TOKEN || !GITLAB_PROJECT_ID) {
    throw new Error('GITLAB_TOKEN and GITLAB_PROJECT_ID are required for issue triage');
  }

  const base = buildBaseUrl(GITLAB_URL);
  const query = new URLSearchParams({ per_page: '20', ...params });
  const url = `${base}/projects/${encodeURIComponent(GITLAB_PROJECT_ID)}/issues?${query}`;

  const resp = await fetchFn(url, {
    headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
  });
  if (!resp.ok) {
    throw new Error(`GitLab API ${resp.status}: ${resp.statusText}`);
  }
  return resp.json();
}

/**
 * Classify an issue into a triage category based on its labels and title.
 * @param {object} issue - A GitLab issue object
 * @returns {object} { category, priority, confidence }
 */
export function classifyIssue(issue) {
  const labels = (issue.labels || []).map((l) => String(l).toLowerCase());
  const title = (issue.title || '').toLowerCase();

  // Category detection
  let category = 'needs-triage';
  if (labels.includes('bug') || title.includes('error') || title.includes('crash') || title.includes('fail')) {
    category = 'bug';
  } else if (labels.includes('feature') || title.startsWith('feat') || title.includes('request')) {
    category = 'feature';
  } else if (labels.includes('documentation') || labels.includes('docs') || title.includes('readme')) {
    category = 'docs';
  } else if (labels.includes('enhancement') || labels.includes('improvement')) {
    category = 'enhancement';
  }

  // Priority detection
  let priority = 'medium';
  if (labels.includes('critical') || labels.includes('blocker') || labels.includes('p0')) {
    priority = 'critical';
  } else if (labels.includes('high') || labels.includes('urgent') || labels.includes('p1')) {
    priority = 'high';
  } else if (labels.includes('low') || labels.includes('p3')) {
    priority = 'low';
  }

  // Confidence score (how many signals matched)
  const signals = labels.length > 0 ? 0.8 : 0.5;

  return { category, priority, confidence: signals };
}

/**
 * Run full triage on a batch of issues.
 * @param {Array} issues - Array of GitLab issue objects
 * @returns {object} Triage report: { total, categories, priorities, items }
 */
export function triageIssues(issues) {
  if (!Array.isArray(issues)) throw new Error('issues must be an array');

  const items = issues.map((issue) => ({
    id: issue.iid ?? issue.id,
    title: issue.title,
    labels: issue.labels || [],
    state: issue.state,
    ...classifyIssue(issue),
  }));

  const categories = {};
  const priorities = {};
  for (const item of items) {
    categories[item.category] = (categories[item.category] || 0) + 1;
    priorities[item.priority] = (priorities[item.priority] || 0) + 1;
  }

  return {
    total: items.length,
    categories,
    priorities,
    items,
    timestamp: Date.now(),
  };
}
