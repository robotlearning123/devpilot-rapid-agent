import { describe, it, assert } from 'vitest';
import { createPlan, validatePlan, prioritizePlan } from '../src/agent/planner.js';

const sampleDiff = [
  {
    file: 'src/app.js',
    hunks: [{ oldStart: 10, oldLines: 30, newStart: 10, newLines: 35 }],
  },
  {
    file: 'config/database.yml',
    hunks: [{ oldStart: 1, oldLines: 5, newStart: 1, newLines: 7 }],
  },
  {
    file: 'src/large-module.js',
    hunks: [
      { oldStart: 1, oldLines: 25, newStart: 1, newLines: 30 },
      { oldStart: 50, oldLines: 30, newStart: 55, newLines: 35 },
    ],
  },
];

describe('createPlan', () => {
  it('creates a correctness task per file', () => {
    const plan = createPlan(sampleDiff);
    const correctnessTasks = plan.filter((s) => s.category === 'correctness');
    assert.equal(correctnessTasks.length, 3);
  });

  it('adds security review for sensitive file types', () => {
    const plan = createPlan(sampleDiff);
    const securityTasks = plan.filter((s) => s.category === 'security');
    assert.ok(securityTasks.length >= 1);
    assert.equal(securityTasks[0].file, 'config/database.yml');
  });

  it('adds performance review for large diffs', () => {
    const plan = createPlan(sampleDiff);
    const perfTasks = plan.filter((s) => s.category === 'performance');
    assert.ok(perfTasks.length >= 1, 'Large files should get performance review');
  });

  it('respects maxSteps limit', () => {
    const plan = createPlan(sampleDiff, { maxSteps: 2 });
    assert.ok(plan.length <= 2);
  });

  it('assigns sequential IDs', () => {
    const plan = createPlan(sampleDiff);
    const ids = plan.map((s) => s.id);
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i] > ids[i - 1], `ID ${ids[i]} should be > ${ids[i - 1]}`);
    }
  });
});

describe('validatePlan', () => {
  it('accepts a valid plan', () => {
    const plan = createPlan(sampleDiff);
    const result = validatePlan(plan);
    assert.equal(result.valid, true);
  });

  it('rejects non-array input', () => {
    const result = validatePlan('not a plan');
    assert.equal(result.valid, false);
  });

  it('catches invalid categories', () => {
    const badPlan = [{ id: 1, category: 'typo', file: 'a.js', prompt: 'x' }];
    const result = validatePlan(badPlan);
    assert.equal(result.valid, false);
  });
});

describe('prioritizePlan', () => {
  it('sorts security before correctness', () => {
    const plan = createPlan(sampleDiff);
    const sorted = prioritizePlan(plan);
    const firstCategory = sorted[0].category;
    assert.equal(firstCategory, 'security');
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan(sampleDiff);
    const original = [...plan];
    prioritizePlan(plan);
    assert.deepEqual(plan.map((s) => s.id), original.map((s) => s.id));
  });
});
