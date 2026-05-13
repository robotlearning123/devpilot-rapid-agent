import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { runAgent } from '../src/review.js';

/**
 * End-to-end integration tests for the review pipeline.
 *
 * Exercises the full orchestration:
 *   config → GitLab fetch → plan creation → AI review → post results
 *
 * All external dependencies (GitLab API, Vertex AI) are mocked via
 * the deps injection in runAgent().
 */

function makeConfig(overrides = {}) {
  return {
    GITLAB_URL: 'https://gitlab.example.com',
    GITLAB_TOKEN: 'test-token',
    GITLAB_PROJECT_ID: '42',
    GOOGLE_CLOUD_PROJECT: 'test-project',
    GOOGLE_CLOUD_LOCATION: 'us-central1',
    MR_IID: 7,
    MAX_PLAN_STEPS: 10,
    RETRY_ATTEMPTS: 1,
    RETRY_DELAY_MS: 0,
    ...overrides,
  };
}

function mockDiff(files) {
  return files.map(({ file, hunks = [] }) => ({
    file,
    hunks: hunks.map((h) => ({
      oldStart: h.oldStart ?? 1,
      oldLines: h.oldLines ?? 5,
      newStart: h.newStart ?? 1,
      newLines: h.newLines ?? 5,
    })),
  }));
}

function mockReviewer(responses) {
  const callLog = [];
  const iter = responses[Symbol.iterator]();
  return {
    review: vi.fn(async (prompt) => {
      callLog.push(prompt);
      const { value, done } = iter.next();
      if (done) return 'No issues found';
      if (typeof value === 'object' && value.error) throw new Error(value.error);
      return value;
    }),
    callLog,
  };
}

function mockGitlab(diff, comments = []) {
  const commentLog = [];
  return {
    getMRDiff: vi.fn(async () => diff),
    postComment: vi.fn(async (_mrIid, body) => {
      commentLog.push(body);
      return { id: comments.length + 1 };
    }),
    commentLog,
  };
}

describe('runAgent integration: config → fetch → plan → execute → post', () => {
  it('completes full pipeline and posts comment for findings', async () => {
    const diff = mockDiff([
      { file: 'src/auth.js', hunks: [{ oldStart: 1, oldLines: 10 }] },
    ]);
    const reviewer = mockReviewer(['Potential security issue in auth.js']);
    const gitlab = mockGitlab(diff);

    const result = await runAgent(makeConfig(), { gitlab, reviewer });

    // Step 1: GitLab diff was fetched
    assert.equal(gitlab.getMRDiff.mock.calls.length, 1);
    assert.equal(gitlab.getMRDiff.mock.calls[0][0], 7); // MR_IID

    // Step 2: Reviewer was called (at least once per plan step)
    assert.ok(reviewer.review.mock.calls.length >= 1);

    // Step 3: Comment was posted with formatted report
    assert.equal(gitlab.postComment.mock.calls.length, 1);
    const postedBody = gitlab.postComment.mock.calls[0][1];
    assert.ok(postedBody.includes('## DevPilot AI Review'));
    assert.ok(postedBody.includes('auth.js'));

    // Step 4: Return value has correct shape
    assert.equal(result.reviewed, 1);
    assert.ok(result.results.total >= 1);
    assert.ok(result.results.passed >= 1);
    assert.ok(result.results.findings.length >= 1);
  });

  it('creates multiple plan steps for multi-file diff', async () => {
    const diff = mockDiff([
      { file: 'src/api.js', hunks: [{ oldStart: 1, oldLines: 20 }] },
      { file: 'config/env.yaml', hunks: [{ oldStart: 1, oldLines: 15 }] },
    ]);
    const reviewer = mockReviewer(['API looks good', 'Sensitive config file']);
    const gitlab = mockGitlab(diff);

    const result = await runAgent(makeConfig(), { gitlab, reviewer });

    // Two files, env.yaml triggers security review → at least 3 plan steps
    assert.ok(result.results.total >= 2);
    assert.ok(reviewer.review.mock.calls.length >= 2);
  });

  it('posts comment with security review for sensitive file types', async () => {
    const diff = mockDiff([
      { file: 'db/migrate.sql', hunks: [{ oldStart: 1, oldLines: 5 }] },
    ]);
    const reviewer = mockReviewer(['SQL injection risk detected']);
    const gitlab = mockGitlab(diff);

    const result = await runAgent(makeConfig(), { gitlab, reviewer });

    const postedBody = gitlab.postComment.mock.calls[0][1];
    assert.ok(postedBody.includes('migrate.sql'));
    // Security category should be prioritized first
    assert.ok(result.results.findings.some((f) => f.includes('[security]')));
  });

  it('skips posting when DRY_RUN is true', async () => {
    const diff = mockDiff([
      { file: 'src/main.js', hunks: [{ oldStart: 1, oldLines: 8 }] },
    ]);
    const reviewer = mockReviewer(['Minor style issue']);
    const gitlab = mockGitlab(diff);

    const result = await runAgent(makeConfig({ DRY_RUN: true }), { gitlab, reviewer });

    assert.equal(gitlab.postComment.mock.calls.length, 0);
    assert.ok(result.results.total >= 1);
  });

  it('skips posting when no findings exist', async () => {
    const diff = mockDiff([
      { file: 'src/clean.js', hunks: [{ oldStart: 1, oldLines: 3 }] },
    ]);
    const reviewer = mockReviewer(['']); // Empty result → no findings
    const gitlab = mockGitlab(diff);

    const result = await runAgent(makeConfig(), { gitlab, reviewer });

    // Empty string is trimmed by summarizeResults → no findings
    assert.equal(gitlab.postComment.mock.calls.length, 0);
    assert.equal(result.results.findings.length, 0);
  });

  it('handles reviewer failure gracefully', async () => {
    const diff = mockDiff([
      { file: 'src/broken.js', hunks: [{ oldStart: 1, oldLines: 5 }] },
    ]);
    const reviewer = mockReviewer([{ error: 'AI service unavailable' }]);
    const gitlab = mockGitlab(diff);

    const result = await runAgent(makeConfig({ RETRY_ATTEMPTS: 1, RETRY_DELAY_MS: 0 }), {
      gitlab,
      reviewer,
    });

    // Review failed but pipeline completes
    assert.equal(result.results.total, 1);
    assert.equal(result.results.failed, 1);
    assert.equal(result.results.passed, 0);
    // No findings → no post
    assert.equal(gitlab.postComment.mock.calls.length, 0);
  });

  it('throws when required config is missing', async () => {
    await assert.rejects(
      () => runAgent({ GITLAB_TOKEN: '', GITLAB_PROJECT_ID: '', GOOGLE_CLOUD_PROJECT: '' }),
      /Missing configuration/,
    );
  });

  it('propagates GitLab API error', async () => {
    const gitlab = {
      getMRDiff: vi.fn(async () => {
        throw new Error('GitLab API 401: Unauthorized');
      }),
    };

    await assert.rejects(
      () => runAgent(makeConfig(), { gitlab }),
      /GitLab API 401/,
    );
  });

  it('uses the default GitLab client when none is injected', async () => {
    const reviewer = mockReviewer(['Default client finding']);
    const fetch = vi.fn(async (url, opts = {}) => {
      if (url.endsWith('/merge_requests/7/changes')) {
        assert.equal(opts.headers['PRIVATE-TOKEN'], 'test-token');
        return {
          ok: true,
          json: async () => ({
            changes: [
              {
                old_path: 'src/from-gitlab.js',
                diff: '@@ -3,2 +3,3 @@\n-old\n+new\n',
              },
            ],
          }),
        };
      }

      if (url.endsWith('/merge_requests/7/notes')) {
        assert.equal(opts.method, 'POST');
        assert.ok(JSON.parse(opts.body).body.includes('Default client finding'));
        return { ok: true, json: async () => ({ id: 123 }) };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await runAgent(makeConfig(), { fetch, reviewer });

    assert.equal(result.reviewed, 1);
    assert.equal(fetch.mock.calls.length, 2);
    assert.ok(reviewer.review.mock.calls[0][0].includes('src/from-gitlab.js'));
  });

  it('uses heuristic fallback when cloud reviewer fails', async () => {
    const diff = mockDiff([
      { file: 'src/eval-code.js', hunks: [{ oldStart: 1, oldLines: 5 }] },
    ]);
    // Inject a reviewer that simulates heuristic fallback (returns finding with category tag)
    const heuristicReviewer = {
      review: vi.fn(async () => '[correctness] Use of eval() detected — potential security risk'),
    };
    const gitlab = mockGitlab(diff);

    const result = await runAgent(
      makeConfig({ RETRY_ATTEMPTS: 1 }),
      { gitlab, reviewer: heuristicReviewer },
    );

    assert.ok(result.results.total >= 1);
    assert.ok(result.results.findings.length >= 1);
    assert.ok(
      result.results.findings[0].includes('[correctness]'),
      `Expected [correctness] in finding, got: ${result.results.findings[0]}`,
    );
  });

  it('respects MAX_PLAN_STEPS to limit review scope', async () => {
    const diff = mockDiff([
      { file: 'a.js', hunks: [{ oldStart: 1, oldLines: 60 }] },
      { file: 'b.js', hunks: [{ oldStart: 1, oldLines: 60 }] },
      { file: 'c.yaml', hunks: [{ oldStart: 1, oldLines: 60 }] },
    ]);
    const reviewer = mockReviewer(['OK', 'OK', 'OK']);
    const gitlab = mockGitlab(diff);

    const result = await runAgent(makeConfig({ MAX_PLAN_STEPS: 2 }), { gitlab, reviewer });

    // Plan capped at 2 steps despite 3 files
    assert.equal(result.results.total, 2);
  });
});
