import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Pipeline } from '../src/pipeline.js';

describe('Pipeline', () => {
  it('processes task through matching handler', async () => {
    const pipeline = new Pipeline();
    pipeline.use((task, _ctx) => task.type === 'greet' ? { msg: `Hello ${task.name}` } : null);
    const result = await pipeline.process({ type: 'greet', name: 'World' }, {});
    assert.deepEqual(result, { msg: 'Hello World' });
  });

  it('throws when no handler matches', async () => {
    const pipeline = new Pipeline();
    pipeline.use((task) => task.type === 'skip' ? { ok: true } : null);
    await assert.rejects(
      () => pipeline.process({ type: 'unknown' }, {}),
      /No handler matched/
    );
  });

  it('chains multiple handlers in order', async () => {
    const pipeline = new Pipeline();
    const order = [];
    pipeline.use((task, _ctx) => { order.push(1); return null; });
    pipeline.use((task, _ctx) => { order.push(2); return null; });
    pipeline.use((task, _ctx) => { order.push(3); return { done: true }; });
    await pipeline.process({ type: 'test' }, {});
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('rejects non-function handlers', () => {
    const pipeline = new Pipeline();
    assert.throws(() => pipeline.use('not-a-function'), /must be a function/);
  });

  it('reports handler count via length', () => {
    const pipeline = new Pipeline();
    assert.equal(pipeline.length, 0);
    pipeline.use(() => null);
    pipeline.use(() => null);
    assert.equal(pipeline.length, 2);
  });
});
