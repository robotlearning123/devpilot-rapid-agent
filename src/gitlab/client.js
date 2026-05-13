/**
 * DevPilot — GitLab API Client
 *
 * Fetches merge request diffs and posts review comments
 * via the GitLab REST API v4.
 */

/**
 * Create a GitLab client bound to a project.
 *
 * @param {object} config — { GITLAB_URL, GITLAB_TOKEN, GITLAB_PROJECT_ID }
 * @param {object} [fetchFn] — injectable fetch for testing
 * @returns {{ getMRDiff, postComment, listOpenMRs }}
 */
export function createGitLabClient(config, fetchFn = globalThis.fetch) {
  const { GITLAB_URL, GITLAB_TOKEN, GITLAB_PROJECT_ID } = config;
  const baseUrl = `${GITLAB_URL}/api/v4/projects/${encodeURIComponent(GITLAB_PROJECT_ID)}`;

  function headers() {
    return {
      'PRIVATE-TOKEN': GITLAB_TOKEN,
      'Content-Type': 'application/json',
    };
  }

  /**
   * List open merge requests for the project.
   * @returns {Promise<Array<{ iid: number, title: string, web_url: string }>>}
   */
  async function listOpenMRs() {
    const res = await fetchFn(`${baseUrl}/merge_requests?state=opened&per_page=20`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`GitLab API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  /**
   * Fetch the diff for a specific merge request.
   * @param {number} mrIid
   * @returns {Promise<Array<{ file: string, hunks: Array }>>}
   */
  async function getMRDiff(mrIid) {
    const res = await fetchFn(`${baseUrl}/merge_requests/${mrIid}/changes`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`GitLab API ${res.status}: ${res.statusText}`);
    const data = await res.json();

    return (data.changes ?? []).map((change) => ({
      file: change.old_path ?? change.new_path ?? 'unknown',
      hunks: parseHunks(change.diff ?? ''),
    }));
  }

  /**
   * Post a review comment on a merge request.
   * @param {number} mrIid
   * @param {string} body — markdown comment body
   * @returns {Promise<object>}
   */
  async function postComment(mrIid, body) {
    const res = await fetchFn(`${baseUrl}/merge_requests/${mrIid}/notes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error(`GitLab API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  return { listOpenMRs, getMRDiff, postComment };
}

/**
 * Naive hunks parser from unified diff text.
 * Returns [{ oldStart, oldLines, newStart, newLines }]
 */
function parseHunks(diffText) {
  const hunks = [];
  const hunkRegex = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/g;
  let match;
  while ((match = hunkRegex.exec(diffText)) !== null) {
    hunks.push({
      oldStart: Number(match[1]),
      oldLines: Number(match[2] ?? 1),
      newStart: Number(match[3]),
      newLines: Number(match[4] ?? 1),
    });
  }
  return hunks;
}
