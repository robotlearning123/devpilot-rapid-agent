import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
// MR review client (from PR #6)
import { createGitLabClient } from '../src/gitlab/client.js';
// Issue triage utilities (from this branch)
import { fetchIssues, classifyIssue, triageIssues } from '../src/utils/gitlab.js';
import { gitlabTriageHandler } from '../src/handlers.js';

// --- Mock helpers ---

function arrayMockFetch(responses) {
  let callIndex = 0;
  return async (url, opts) => {
    const response = responses[callIndex++] ?? { ok: true, json: async () => [] };
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      json: async () => response.data ?? response,
    };
  };
}

function simpleMockFetch(data, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
  });
}

// --- createGitLabClient (MR review) ---

describe('createGitLabClient', () => {
  const config = {
    GITLAB_URL: 'https://gitlab.example.com',
    GITLAB_TOKEN: 'test-token',
    GITLAB_PROJECT_ID: '42',
  };

  it('lists open merge requests', async () => {
    const fetch = arrayMockFetch([{ data: [{ iid: 1, title: 'Test MR' }] }]);
    const client = createGitLabClient(config, fetch);
    const mrs = await client.listOpenMRs();
    assert.equal(mrs.length, 1);
    assert.equal(mrs[0].iid, 1);
  });

  it('fetches MR diff and parses hunks', async () => {
    const fetch = arrayMockFetch([{
      data: {
        changes: [{
          old_path: 'src/app.js',
          diff: '@@ -10,3 +10,4 @@\n+new line\n',
        }],
      },
    }]);
    const client = createGitLabClient(config, fetch);
    const diff = await client.getMRDiff(1);
    assert.equal(diff.length, 1);
    assert.equal(diff[0].file, 'src/app.js');
    assert.equal(diff[0].hunks.length, 1);
    assert.equal(diff[0].hunks[0].oldStart, 10);
  });

  it('posts a comment to an MR', async () => {
    let capturedBody;
    const fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ id: 1 }) };
    };
    const client = createGitLabClient(config, fetch);
    await client.postComment(1, '## Review Results');
    assert.equal(capturedBody.body, '## Review Results');
  });

  it('throws on API errors', async () => {
    const fetch = async () => ({ ok: false, status: 401, statusText: 'Unauthorized' });
    const client = createGitLabClient(config, fetch);
    await assert.rejects(() => client.listOpenMRs(), /401/);
  });

  it('throws on getMRDiff API errors', async () => {
    const fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found' });
    const client = createGitLabClient(config, fetch);
    await assert.rejects(() => client.getMRDiff(99), /404/);
  });

  it('throws on postComment API errors', async () => {
    const fetch = async () => ({ ok: false, status: 403, statusText: 'Forbidden' });
    const client = createGitLabClient(config, fetch);
    await assert.rejects(() => client.postComment(1, 'comment'), /403/);
  });

  it('handles null changes array in getMRDiff', async () => {
    const fetch = arrayMockFetch([{ data: {} }]);
    const client = createGitLabClient(config, fetch);
    const diff = await client.getMRDiff(1);
    assert.deepEqual(diff, []);
  });

  it('falls back to new_path when old_path is missing', async () => {
    const fetch = arrayMockFetch([{
      data: {
        changes: [{ new_path: 'src/new.js', diff: '@@ -1 +1 @@\n-old\n+new\n' }],
      },
    }]);
    const client = createGitLabClient(config, fetch);
    const diff = await client.getMRDiff(1);
    assert.equal(diff[0].file, 'src/new.js');
  });

  it('falls back to unknown when both old_path and new_path are missing', async () => {
    const fetch = arrayMockFetch([{
      data: {
        changes: [{ diff: '@@ -1 +1 @@\n-old\n+new\n' }],
      },
    }]);
    const client = createGitLabClient(config, fetch);
    const diff = await client.getMRDiff(1);
    assert.equal(diff[0].file, 'unknown');
  });

  it('handles null diff string in change', async () => {
    const fetch = arrayMockFetch([{
      data: {
        changes: [{ old_path: 'src/app.js' }],
      },
    }]);
    const client = createGitLabClient(config, fetch);
    const diff = await client.getMRDiff(1);
    assert.equal(diff[0].hunks.length, 0);
  });

  it('parses hunks with missing line counts (defaults to 1)', async () => {
    const fetch = arrayMockFetch([{
      data: {
        changes: [{ old_path: 'a.txt', diff: '@@ -5 +10 @@\n+line\n' }],
      },
    }]);
    const client = createGitLabClient(config, fetch);
    const diff = await client.getMRDiff(1);
    assert.equal(diff[0].hunks[0].oldStart, 5);
    assert.equal(diff[0].hunks[0].oldLines, 1);
    assert.equal(diff[0].hunks[0].newStart, 10);
    assert.equal(diff[0].hunks[0].newLines, 1);
  });
});

// --- fetchIssues (issue triage) ---

const baseConfig = {
  GITLAB_URL: 'https://gitlab.example.com',
  GITLAB_TOKEN: 'test-token-123',
  GITLAB_PROJECT_ID: '42',
};

describe('fetchIssues', () => {
  it('fetches issues from the GitLab API', async () => {
    const issues = [
      { iid: 1, title: 'Bug: crash on login', labels: ['bug'], state: 'opened' },
      { iid: 2, title: 'Feature: dark mode', labels: ['feature'], state: 'opened' },
    ];
    const result = await fetchIssues(baseConfig, {}, simpleMockFetch(issues));
    assert.equal(result.length, 2);
    assert.equal(result[0].iid, 1);
  });

  it('throws when GITLAB_TOKEN is missing', async () => {
    await assert.rejects(
      () => fetchIssues({ ...baseConfig, GITLAB_TOKEN: '' }, {}, simpleMockFetch([])),
      /GITLAB_TOKEN and GITLAB_PROJECT_ID are required/
    );
  });

  it('throws when GITLAB_PROJECT_ID is missing', async () => {
    await assert.rejects(
      () => fetchIssues({ ...baseConfig, GITLAB_PROJECT_ID: '' }, {}, simpleMockFetch([])),
      /GITLAB_TOKEN and GITLAB_PROJECT_ID are required/
    );
  });

  it('throws when GITLAB_URL is missing', async () => {
    await assert.rejects(
      () => fetchIssues({ ...baseConfig, GITLAB_URL: '' }, {}, simpleMockFetch([])),
      /GITLAB_URL is required/
    );
  });

  it('throws on non-OK HTTP response', async () => {
    await assert.rejects(
      () => fetchIssues(baseConfig, {}, simpleMockFetch({ message: 'Unauthorized' }, 401)),
      /GitLab API 401/
    );
  });
});

// --- classifyIssue ---

describe('classifyIssue', () => {
  it('classifies a bug from labels', () => {
    const result = classifyIssue({ title: 'Something broke', labels: ['bug'] });
    assert.equal(result.category, 'bug');
    assert.equal(result.priority, 'medium');
  });

  it('classifies a feature from title prefix', () => {
    const result = classifyIssue({ title: 'feat: add export button', labels: [] });
    assert.equal(result.category, 'feature');
  });

  it('classifies docs from labels', () => {
    const result = classifyIssue({ title: 'Update readme', labels: ['documentation'] });
    assert.equal(result.category, 'docs');
  });

  it('classifies enhancement from labels', () => {
    const result = classifyIssue({ title: 'Improve performance', labels: ['enhancement'] });
    assert.equal(result.category, 'enhancement');
  });

  it('defaults to needs-triage for unknown issues', () => {
    const result = classifyIssue({ title: 'Random thing', labels: [] });
    assert.equal(result.category, 'needs-triage');
  });

  it('detects critical priority', () => {
    const result = classifyIssue({ title: 'System down', labels: ['bug', 'critical'] });
    assert.equal(result.priority, 'critical');
  });

  it('detects high priority from p1 label', () => {
    const result = classifyIssue({ title: 'Important fix', labels: ['bug', 'p1'] });
    assert.equal(result.priority, 'high');
  });

  it('detects low priority', () => {
    const result = classifyIssue({ title: 'Minor typo', labels: ['low'] });
    assert.equal(result.priority, 'low');
  });

  it('detects bug from title keywords', () => {
    const result = classifyIssue({ title: 'Error: page not loading', labels: [] });
    assert.equal(result.category, 'bug');
  });
});

// --- triageIssues ---

describe('triageIssues', () => {
  it('produces a triage report with categories and priorities', () => {
    const issues = [
      { iid: 1, title: 'Bug: crash', labels: ['bug', 'critical'], state: 'opened' },
      { iid: 2, title: 'Feature: export', labels: ['feature'], state: 'opened' },
      { iid: 3, title: 'Docs update', labels: ['docs'], state: 'closed' },
    ];
    const report = triageIssues(issues);
    assert.equal(report.total, 3);
    assert.equal(report.categories.bug, 1);
    assert.equal(report.categories.feature, 1);
    assert.equal(report.categories.docs, 1);
    assert.equal(report.priorities.critical, 1);
    assert.ok(report.timestamp > 0);
  });

  it('throws when input is not an array', () => {
    assert.throws(() => triageIssues('not-array'), /must be an array/);
  });

  it('handles empty array', () => {
    const report = triageIssues([]);
    assert.equal(report.total, 0);
    assert.deepEqual(report.categories, {});
    assert.deepEqual(report.items, []);
  });
});

// --- gitlabTriageHandler ---

describe('gitlabTriageHandler', () => {
  const ctx = {
    config: baseConfig,
    fetch: simpleMockFetch([
      { iid: 1, title: 'Bug: crash on login', labels: ['bug', 'critical'], state: 'opened' },
      { iid: 2, title: 'Feature: dark mode', labels: ['feature'], state: 'opened' },
      { iid: 3, title: 'Update docs', labels: ['docs'], state: 'opened' },
    ]),
  };

  it('returns null for non-gitlab-triage tasks', async () => {
    assert.equal(await gitlabTriageHandler({ type: 'echo' }, ctx), null);
  });

  it('lists issues from GitLab API', async () => {
    const result = await gitlabTriageHandler(
      { type: 'gitlab-triage', payload: { operation: 'list' } },
      ctx
    );
    assert.equal(result.operation, 'list');
    assert.equal(result.total, 3);
    assert.equal(result.issues[0].iid, 1);
  });

  it('triages fetched issues when no issues provided', async () => {
    const result = await gitlabTriageHandler(
      { type: 'gitlab-triage', payload: { operation: 'triage' } },
      ctx
    );
    assert.equal(result.total, 3);
    assert.equal(result.categories.bug, 1);
    assert.equal(result.categories.feature, 1);
    assert.equal(result.categories.docs, 1);
    assert.equal(result.priorities.critical, 1);
  });

  it('triages inline issues without API call', async () => {
    const inlineCtx = { config: baseConfig, fetch: simpleMockFetch([]) };
    const result = await gitlabTriageHandler(
      {
        type: 'gitlab-triage',
        payload: {
          operation: 'triage',
          issues: [
            { iid: 10, title: 'Crash bug', labels: ['bug'], state: 'opened' },
          ],
        },
      },
      inlineCtx
    );
    assert.equal(result.total, 1);
    assert.equal(result.items[0].category, 'bug');
  });

  it('classifies a single issue', async () => {
    const result = await gitlabTriageHandler(
      {
        type: 'gitlab-triage',
        payload: {
          operation: 'classify',
          issue: { title: 'Error: crash on startup', labels: ['bug', 'p1'] },
        },
      },
      ctx
    );
    assert.equal(result.operation, 'classify');
    assert.equal(result.category, 'bug');
    assert.equal(result.priority, 'high');
  });

  it('throws on unknown operation', async () => {
    await assert.rejects(
      () => gitlabTriageHandler({ type: 'gitlab-triage', payload: { operation: 'delete' } }, ctx),
      /must be one of/,
    );
  });

  it('throws on classify without issue payload', async () => {
    await assert.rejects(
      () => gitlabTriageHandler({ type: 'gitlab-triage', payload: { operation: 'classify' } }, ctx),
      /requires payload.issue/
    );
  });
});
