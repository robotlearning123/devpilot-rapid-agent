import { describe, it, assert } from 'vitest';
import { createVertexReviewer, heuristicReview } from '../src/cloud/vertex.js';

describe('heuristicReview', () => {
  it('detects hardcoded credentials', () => {
    const result = heuristicReview('Review file with password = "secret123"');
    assert.ok(result.includes('credential'));
  });

  it('detects eval() usage', () => {
    const result = heuristicReview('Code using eval(input) for parsing');
    assert.ok(result.includes('eval()'));
  });

  it('detects TODO/FIXME markers', () => {
    const result = heuristicReview('Function with TODO: refactor this later');
    assert.ok(result.includes('TODO'));
  });

  it('detects console.log statements', () => {
    const result = heuristicReview('Code with console.log("debug")');
    assert.ok(result.includes('console.log'));
  });

  it('detects empty catch blocks', () => {
    const result = heuristicReview('try { x() } catch () {}');
    assert.ok(result.includes('Empty catch'));
  });

  it('returns clean result for good code', () => {
    const result = heuristicReview('Review well-written module with clean code');
    assert.ok(result.includes('No issues'));
  });
});

describe('createVertexReviewer', () => {
  it('falls back to heuristic when no cloud project configured', async () => {
    const reviewer = createVertexReviewer({ GOOGLE_CLOUD_PROJECT: '', GOOGLE_CLOUD_LOCATION: 'us-central1' });
    const result = await reviewer.review('Check for password in config');
    assert.ok(result.includes('credential') || result.includes('No issues'));
  });

  it('attempts Vertex AI call when project is configured', async () => {
    let fetchCalled = false;
    const mockFetch = async (url) => {
      fetchCalled = true;
      return {
        ok: true,
        json: async () => ({ predictions: [{ content: 'AI review result' }] }),
      };
    };

    const reviewer = createVertexReviewer(
      { GOOGLE_CLOUD_PROJECT: 'test-project', GOOGLE_CLOUD_LOCATION: 'us-central1' },
      { fetch: mockFetch },
    );
    const result = await reviewer.review('Review this code');
    assert.ok(fetchCalled);
    assert.equal(result, 'AI review result');
  });

  it('falls back to heuristic on Vertex AI error', async () => {
    const mockFetch = async () => ({ ok: false, status: 403, statusText: 'Forbidden' });
    const reviewer = createVertexReviewer(
      { GOOGLE_CLOUD_PROJECT: 'test-project', GOOGLE_CLOUD_LOCATION: 'us-central1' },
      { fetch: mockFetch },
    );
    const result = await reviewer.review('Review code with eval() call');
    assert.ok(result.includes('eval()'));
  });

  it('returns fallback when predictions array is empty', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({ predictions: [] }),
    });
    const reviewer = createVertexReviewer(
      { GOOGLE_CLOUD_PROJECT: 'test-project', GOOGLE_CLOUD_LOCATION: 'us-central1' },
      { fetch: mockFetch },
    );
    const result = await reviewer.review('Review this code');
    assert.equal(result, 'No review generated');
  });

  it('returns fallback when predictions is null', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({ predictions: null }),
    });
    const reviewer = createVertexReviewer(
      { GOOGLE_CLOUD_PROJECT: 'test-project', GOOGLE_CLOUD_LOCATION: 'us-central1' },
      { fetch: mockFetch },
    );
    const result = await reviewer.review('Review this code');
    assert.equal(result, 'No review generated');
  });
});
