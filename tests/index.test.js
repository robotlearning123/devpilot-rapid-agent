import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { runAgent } from '../src/review.js';

describe('runAgent', () => {
  it('throws on missing required config', async () => {
    await assert.rejects(
      () => runAgent({}),
      /Missing configuration/,
    );
  });

  it('runs end-to-end with mocked deps', async () => {
    const gitlab = {
      getMRDiff: async () => [
        { file: 'src/app.js', hunks: [{ oldStart: 1, oldLines: 5, newStart: 1, newLines: 7 }] },
      ],
      postComment: async () => ({ id: 1 }),
    };
    const reviewer = {
      review: async () => 'No issues found in heuristic review',
    };

    const result = await runAgent(
      {
        GITLAB_TOKEN: 'tok',
        GITLAB_PROJECT_ID: '1',
        GOOGLE_CLOUD_PROJECT: 'proj',
        MR_IID: 42,
        DRY_RUN: true,
      },
      { gitlab, reviewer },
    );

    assert.equal(result.reviewed, 1);
    assert.equal(result.results.total, 1);
    assert.equal(result.results.passed, 1);
    assert.equal(result.results.failed, 0);
  });

  it('posts comment when findings exist (not dry-run)', async () => {
    let commentPosted = false;
    const gitlab = {
      getMRDiff: async () => [
        { file: 'config.yml', hunks: [{ oldStart: 1, oldLines: 5, newStart: 1, newLines: 7 }] },
      ],
      postComment: async () => { commentPosted = true; return { id: 1 }; },
    };
    const reviewer = {
      review: async () => 'Contains TODO marker',
    };

    await runAgent(
      {
        GITLAB_TOKEN: 'tok',
        GITLAB_PROJECT_ID: '1',
        GOOGLE_CLOUD_PROJECT: 'proj',
        MR_IID: 7,
      },
      { gitlab, reviewer },
    );

    assert.ok(commentPosted, 'Should post comment when findings exist');
  });
});
