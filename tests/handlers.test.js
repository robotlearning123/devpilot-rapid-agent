import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { echoHandler, transformHandler, cloudStatusHandler, batchHandler, geminiHandler } from '../src/handlers.js';

describe('echoHandler', () => {
  it('returns payload with timestamp for echo tasks', () => {
    const result = echoHandler({ type: 'echo', payload: 'hello' }, {});
    assert.equal(result.output, 'hello');
    assert.ok(result.timestamp > 0);
  });

  it('returns null for non-echo tasks', () => {
    assert.equal(echoHandler({ type: 'other' }, {}), null);
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
      /Unknown transform/
    );
  });

  it('returns null for non-transform tasks', () => {
    assert.equal(transformHandler({ type: 'echo' }, {}), null);
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
      /must be an array/
    );
  });

  it('returns null for non-batch tasks', () => {
    assert.equal(batchHandler({ type: 'echo' }, {}), null);
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
});
