import { describe, it, assert } from 'vitest';
import { executeStep, executePlan, summarizeResults } from '../src/agent/executor.js';

describe('executeStep', () => {
  it('returns result on successful review', async () => {
    const step = { id: 1, category: 'correctness', file: 'a.js', prompt: 'review a.js' };
    const reviewer = async () => 'No issues found';
    const result = await executeStep(step, reviewer);
    assert.equal(result.ok, true);
    assert.equal(result.result, 'No issues found');
    assert.equal(result.stepId, 1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const reviewer = async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return 'ok';
    };
    const step = { id: 2, category: 'security', file: 'b.sql', prompt: 'review' };
    const result = await executeStep(step, reviewer, { retryAttempts: 3, retryDelayMs: 10 });
    assert.equal(result.ok, true);
    assert.ok(calls >= 2);
  });

  it('returns error after all retries exhausted', async () => {
    const reviewer = async () => { throw new Error('persistent'); };
    const step = { id: 3, category: 'performance', file: 'c.js', prompt: 'review' };
    const result = await executeStep(step, reviewer, { retryAttempts: 2, retryDelayMs: 10 });
    assert.equal(result.ok, false);
    assert.ok(result.result.includes('persistent'));
  });
});

describe('executePlan', () => {
  it('executes all steps in order', async () => {
    const plan = [
      { id: 1, category: 'correctness', file: 'a.js', prompt: 'p1' },
      { id: 2, category: 'security', file: 'b.sql', prompt: 'p2' },
    ];
    const reviewer = async (prompt) => `result: ${prompt}`;
    const results = await executePlan(plan, reviewer);
    assert.equal(results.length, 2);
    assert.equal(results[0].stepId, 1);
    assert.equal(results[1].stepId, 2);
  });
});

describe('summarizeResults', () => {
  it('counts passed and failed correctly', () => {
    const results = [
      { ok: true, result: 'good', category: 'security', file: 'a.js' },
      { ok: false, result: 'error', category: 'correctness', file: 'b.js' },
      { ok: true, result: 'fine', category: 'performance', file: 'c.js' },
    ];
    const summary = summarizeResults(results);
    assert.equal(summary.total, 3);
    assert.equal(summary.passed, 2);
    assert.equal(summary.failed, 1);
    assert.equal(summary.findings.length, 2);
  });

  it('excludes failed results from findings', () => {
    const results = [
      { ok: false, result: 'bad', category: 'correctness', file: 'a.js' },
    ];
    const summary = summarizeResults(results);
    assert.equal(summary.findings.length, 0);
  });
});
