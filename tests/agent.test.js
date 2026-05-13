import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Agent } from '../src/agent.js';

describe('Agent', () => {
  it('runs an echo task through the pipeline', async () => {
    const agent = new Agent({ env: {} });
    const result = await agent.run({ type: 'echo', payload: 'test' });
    assert.equal(result.output, 'test');
  });

  it('runs a transform task', async () => {
    const agent = new Agent({ env: {} });
    const result = await agent.run({ type: 'transform', payload: { input: 'hello', operation: 'upper' } });
    assert.equal(result.output, 'HELLO');
  });

  it('tracks stats across multiple tasks', async () => {
    const agent = new Agent({ env: {} });
    await agent.run({ type: 'echo', payload: 'a' });
    await agent.run({ type: 'echo', payload: 'b' });
    assert.deepEqual(agent.stats, { submitted: 2, succeeded: 2, failed: 0 });
  });

  it('increments failed count on error', async () => {
    const agent = new Agent({ env: {} });
    await assert.rejects(() => agent.run({ type: 'unknown' }));
    assert.equal(agent.stats.failed, 1);
  });

  it('rejects tasks without a type field', async () => {
    const agent = new Agent({ env: {} });
    await assert.rejects(() => agent.run({}), /must have a string "type" field/);
  });

  it('allows adding custom handlers via use()', async () => {
    const agent = new Agent({ env: {} });
    agent.use((task, _ctx) => task.type === 'custom' ? { custom: true } : null);
    const result = await agent.run({ type: 'custom' });
    assert.deepEqual(result, { custom: true });
  });
});
