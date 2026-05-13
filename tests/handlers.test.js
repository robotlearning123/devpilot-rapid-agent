import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { echoHandler, transformHandler, cloudStatusHandler, batchHandler, geminiHandler, gitlabTriageHandler } from '../src/handlers.js';

describe('echoHandler', () => {
  it('returns payload with timestamp for echo tasks', () => {
    const result = echoHandler({ type: 'echo', payload: 'hello' }, {});
    assert.equal(result.output, 'hello');
    assert.ok(result.timestamp > 0);
  });

  it('returns null for non-echo tasks', () => {
    assert.equal(echoHandler({ type: 'other' }, {}), null);
  });

  it('throws when payload is missing', () => {
    assert.throws(
      () => echoHandler({ type: 'echo' }, {}),
      /Missing required field: payload/,
    );
  });

  it('throws when payload is not a string', () => {
    assert.throws(
      () => echoHandler({ type: 'echo', payload: 42 }, {}),
      /must be string, got number/,
    );
  });

  it('throws when payload is null', () => {
    assert.throws(
      () => echoHandler({ type: 'echo', payload: null }, {}),
      /Missing required field: payload/,
    );
  });
});

describe('transformHandler', () => {
  it('converts to uppercase', () => {
    assert.deepEqual(transformHandler({ type: 'transform', payload: { input: 'abc', operation: 'upper' } }, {}), { output: 'ABC' });
  });

  it('converts to lowercase', () => {
    assert.deepEqual(transformHandler({ type: 'transform', payload: { input: 'ABC', operation: 'lower' } }, {}), { output: 'abc' });
  });

  it('reverses a string', () => {
    assert.deepEqual(transformHandler({ type: 'transform', payload: { input: 'abc', operation: 'reverse' } }, {}), { output: 'cba' });
  });

  it('returns string length', () => {
    assert.deepEqual(transformHandler({ type: 'transform', payload: { input: 'hello', operation: 'length' } }, {}), { output: 5 });
  });

  it('throws on unknown operation', () => {
    assert.throws(
      () => transformHandler({ type: 'transform', payload: { input: 'x', operation: 'explode' } }, {}),
      /must be one of/,
    );
  });

  it('returns null for non-transform tasks', () => {
    assert.equal(transformHandler({ type: 'echo' }, {}), null);
  });

  it('throws when payload is missing', () => {
    assert.throws(
      () => transformHandler({ type: 'transform' }, {}),
      /transform requires a payload object/,
    );
  });

  it('throws when payload is null', () => {
    assert.throws(
      () => transformHandler({ type: 'transform', payload: null }, {}),
      /transform requires a payload object/,
    );
  });

  it('throws when input is missing', () => {
    assert.throws(
      () => transformHandler({ type: 'transform', payload: { operation: 'upper' } }, {}),
      /Missing required field: input/,
    );
  });

  it('throws when input is not a string', () => {
    assert.throws(
      () => transformHandler({ type: 'transform', payload: { input: 123, operation: 'upper' } }, {}),
      /must be string, got number/,
    );
  });

  it('throws when operation is missing', () => {
    assert.throws(
      () => transformHandler({ type: 'transform', payload: { input: 'x' } }, {}),
      /must be one of/,
    );
  });
});

describe('cloudStatusHandler', () => {
  it('reports configured when project ID is set', () => {
    const result = cloudStatusHandler({ type: 'cloud-status' }, { config: { GOOGLE_CLOUD_PROJECT: 'my-proj', GOOGLE_CLOUD_LOCATION: 'us-east1' } });
    assert.equal(result.configured, true);
    assert.equal(result.projectId, 'my-proj');
  });

  it('reports unconfigured when project ID is empty', () => {
    const result = cloudStatusHandler({ type: 'cloud-status' }, { config: { GOOGLE_CLOUD_PROJECT: '', GOOGLE_CLOUD_LOCATION: 'us-central1' } });
    assert.equal(result.configured, false);
    assert.equal(result.projectId, null);
  });

  it('returns null for non-cloud-status tasks', () => {
    assert.equal(cloudStatusHandler({ type: 'echo' }, { config: {} }), null);
  });
});

describe('batchHandler', () => {
  it('processes array of items', () => {
    const result = batchHandler({ type: 'batch', payload: { items: ['a', 'b', 'c'] } }, {});
    assert.equal(result.total, 3);
    assert.deepEqual(result.results[0], { index: 0, value: 'a' });
  });

  it('throws when items is not an array', () => {
    assert.throws(
      () => batchHandler({ type: 'batch', payload: { items: 'not-array' } }, {}),
      /must be an array/,
    );
  });

  it('returns null for non-batch tasks', () => {
    assert.equal(batchHandler({ type: 'echo' }, {}), null);
  });

  it('throws when payload is missing', () => {
    assert.throws(
      () => batchHandler({ type: 'batch' }, {}),
      /batch requires a payload object/,
    );
  });

  it('throws when payload is null', () => {
    assert.throws(
      () => batchHandler({ type: 'batch', payload: null }, {}),
      /batch requires a payload object/,
    );
  });

  it('throws when items is missing', () => {
    assert.throws(
      () => batchHandler({ type: 'batch', payload: {} }, {}),
      /Missing required field: items/,
    );
  });
});

describe('geminiHandler', () => {
  it('returns null for non-gemini tasks', () => {
    assert.equal(geminiHandler({ type: 'echo' }, { config: {} }), null);
  });

  it('falls back to heuristic generate when no credentials', async () => {
    const result = await geminiHandler(
      { type: 'gemini', payload: { action: 'generate', prompt: 'Review code with eval() usage' } },
      { config: {} },
    );
    assert.ok(result.output.includes('eval()'));
    assert.equal(result.action, 'generate');
  });

  it('falls back to heuristic review when no credentials', async () => {
    const result = await geminiHandler(
      { type: 'gemini', payload: { action: 'review', prompt: 'Code with password = "x"' } },
      { config: {} },
    );
    assert.ok(result.output.includes('credential'));
    assert.equal(result.action, 'review');
  });

  it('uses mock fetch when credentials provided via deps', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'AI review' }] } }] }),
    });
    const result = await geminiHandler(
      { type: 'gemini', payload: { action: 'generate', prompt: 'test' } },
      { config: { GEMINI_API_KEY: 'k' }, deps: { fetch: mockFetch } },
    );
    assert.equal(result.output, 'AI review');
  });

  it('routes chat action with messages', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'chat reply' }] } }] }),
    });
    const result = await geminiHandler(
      { type: 'gemini', payload: { action: 'chat', messages: [{ role: 'user', text: 'hi' }] } },
      { config: { GEMINI_API_KEY: 'k' }, deps: { fetch: mockFetch } },
    );
    assert.equal(result.output, 'chat reply');
    assert.equal(result.action, 'chat');
  });

  it('defaults to generate when action is omitted', async () => {
    const result = await geminiHandler(
      { type: 'gemini', payload: { prompt: 'eval(input)' } },
      { config: {} },
    );
    assert.equal(result.action, 'generate');
    assert.ok(result.output.includes('eval()'));
  });

  it('throws when payload is missing', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini' }, { config: {} }),
      /gemini requires a payload object/,
    );
  });

  it('throws when payload is null', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini', payload: null }, { config: {} }),
      /gemini requires a payload object/,
    );
  });

  it('throws when action is invalid', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini', payload: { action: 'explode', prompt: 'x' } }, { config: {} }),
      /must be one of/,
    );
  });

  it('throws when prompt is missing for generate action', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini', payload: { action: 'generate' } }, { config: {} }),
      /Missing required field: prompt/,
    );
  });

  it('throws when prompt is not a string for generate', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini', payload: { action: 'generate', prompt: 42 } }, { config: {} }),
      /must be string, got number/,
    );
  });

  it('throws when messages is missing for chat action', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini', payload: { action: 'chat' } }, { config: {} }),
      /Missing required field: messages/,
    );
  });

  it('throws when messages is not an array for chat', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini', payload: { action: 'chat', messages: 'bad' } }, { config: {} }),
      /must be an array/,
    );
  });

  it('throws when prompt is missing for review action', () => {
    assert.throws(
      () => geminiHandler({ type: 'gemini', payload: { action: 'review' } }, { config: {} }),
      /Missing required field: prompt/,
    );
  });
});

describe('gitlabTriageHandler', () => {
  it('returns null for non-gitlab-triage tasks', async () => {
    assert.equal(await gitlabTriageHandler({ type: 'echo' }, {}), null);
  });

  it('throws when payload is missing', async () => {
    await assert.rejects(
      () => gitlabTriageHandler({ type: 'gitlab-triage' }, {}),
      /gitlab-triage requires a payload object/,
    );
  });

  it('throws when payload is null', async () => {
    await assert.rejects(
      () => gitlabTriageHandler({ type: 'gitlab-triage', payload: null }, {}),
      /gitlab-triage requires a payload object/,
    );
  });

  it('throws when operation is missing', async () => {
    await assert.rejects(
      () => gitlabTriageHandler({ type: 'gitlab-triage', payload: {} }, {}),
      /must be one of/,
    );
  });

  it('throws when operation is invalid', async () => {
    await assert.rejects(
      () => gitlabTriageHandler({ type: 'gitlab-triage', payload: { operation: 'delete' } }, {}),
      /must be one of/,
    );
  });

  it('classifies an issue', async () => {
    const result = await gitlabTriageHandler(
      { type: 'gitlab-triage', payload: { operation: 'classify', issue: { title: 'Bug: crash on login', labels: ['bug'], state: 'opened' } } },
      {},
    );
    assert.equal(result.operation, 'classify');
    assert.equal(result.category, 'bug');
  });

  it('throws when classify is called without issue', async () => {
    await assert.rejects(
      () => gitlabTriageHandler({ type: 'gitlab-triage', payload: { operation: 'classify' } }, {}),
      /gitlab-triage classify requires payload.issue/,
    );
  });

  it('lists issues via fetch', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ([{ iid: 1, title: 'Test issue', state: 'opened' }]),
    });
    const result = await gitlabTriageHandler(
      { type: 'gitlab-triage', payload: { operation: 'list' } },
      { config: { GITLAB_URL: 'https://gitlab.com', GITLAB_TOKEN: 'tok', GITLAB_PROJECT_ID: '1' }, fetch: mockFetch },
    );
    assert.equal(result.operation, 'list');
    assert.equal(result.total, 1);
  });

  it('triages provided issues', async () => {
    const issues = [
      { iid: 1, title: 'Feature request', labels: ['feature'], state: 'opened' },
    ];
    const result = await gitlabTriageHandler(
      { type: 'gitlab-triage', payload: { operation: 'triage', issues } },
      {},
    );
    assert.equal(result.total, 1);
    assert.equal(result.items[0].category, 'feature');
  });
});
