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

  it('adds security review for .sql and .env files', () => {
    const diff = [
      { file: 'migrations/setup.sql', hunks: [{ oldStart: 1, oldLines: 5, newLines: 10 }] },
      { file: '.env', hunks: [{ oldStart: 1, oldLines: 2, newLines: 3 }] },
    ];
    const plan = createPlan(diff);
    const sec = plan.filter((s) => s.category === 'security');
    assert.equal(sec.length, 2);
  });

  it('adds performance review for large diffs', () => {
    const plan = createPlan(sampleDiff);
    const perfTasks = plan.filter((s) => s.category === 'performance');
    assert.ok(perfTasks.length >= 1, 'Large files should get performance review');
  });

  it('does not add performance review for small diffs', () => {
    const diff = [{ file: 'tiny.js', hunks: [{ oldStart: 1, oldLines: 5, newLines: 5 }] }];
    const plan = createPlan(diff);
    const perf = plan.filter((s) => s.category === 'performance');
    assert.equal(perf.length, 0);
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

  it('handles entries without hunks (null)', () => {
    const diff = [{ file: 'no-hunks.js' }];
    const plan = createPlan(diff);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].category, 'correctness');
    assert.equal(plan[0].lineStart, 1);
    assert.equal(plan[0].lineEnd, 1);
  });

  it('handles hunks with missing newLines', () => {
    const diff = [
      {
        file: 'partial.js',
        hunks: [{ oldStart: 5, oldLines: 10 }],
      },
    ];
    const plan = createPlan(diff);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].category, 'correctness');
  });

  it('uses default line bounds for large diffs with partial hunk metadata', () => {
    const diff = [
      {
        file: 'src/generated.js',
        hunks: [{ newLines: 75 }],
      },
    ];
    const plan = createPlan(diff);
    const performanceTask = plan.find((step) => step.category === 'performance');
    assert.equal(plan[0].lineStart, 1);
    assert.equal(plan[0].lineEnd, 1);
    assert.equal(performanceTask.lineStart, 1);
    assert.equal(performanceTask.lineEnd, 1);
  });

  it('handles empty diff array', () => {
    const plan = createPlan([]);
    assert.equal(plan.length, 0);
  });

  it('stops adding tasks once maxSteps is reached mid-file', () => {
    const bigDiff = Array.from({ length: 20 }, (_, i) => ({
      file: `file${i}.js`,
      hunks: [{ oldStart: 1, oldLines: 5, newLines: 5 }],
    }));
    const plan = createPlan(bigDiff, { maxSteps: 3 });
    assert.equal(plan.length, 3);
  });

  it('skips performance review when maxSteps already reached by correctness task', () => {
    const diff = [
      {
        file: 'big.js',
        hunks: [{ oldStart: 1, oldLines: 25, newStart: 1, newLines: 60 }],
      },
    ];
    const plan = createPlan(diff, { maxSteps: 1 });
    assert.equal(plan.length, 1);
    assert.equal(plan[0].category, 'correctness');
    const perf = plan.filter((s) => s.category === 'performance');
    assert.equal(perf.length, 0);
  });

  it('handles entry with empty hunks array for line bounds', () => {
    const diff = [{ file: 'empty-hunks.js', hunks: [] }];
    const plan = createPlan(diff);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].lineStart, 1);
    assert.equal(plan[0].lineEnd, 1);
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

  it('catches missing id', () => {
    const badPlan = [{ category: 'security', file: 'a.js', prompt: 'x' }];
    const result = validatePlan(badPlan);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('missing id')));
  });

  it('catches missing file', () => {
    const badPlan = [{ id: 1, category: 'security', prompt: 'x' }];
    const result = validatePlan(badPlan);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('missing file')));
  });

  it('collects multiple errors at once', () => {
    const badPlan = [{ category: 'typo' }];
    const result = validatePlan(badPlan);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 2, 'Should have multiple errors');
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

  it('sorts unknown categories to the end', () => {
    const plan = [
      { id: 1, category: 'maintainability', file: 'a.js' },
      { id: 2, category: 'unknown', file: 'b.js' },
      { id: 3, category: 'security', file: 'c.js' },
    ];
    const sorted = prioritizePlan(plan);
    assert.equal(sorted[0].category, 'security');
    assert.equal(sorted[sorted.length - 1].category, 'unknown');
  });

  it('handles empty plan', () => {
    const sorted = prioritizePlan([]);
    assert.deepEqual(sorted, []);
  });

  it('sorts by priority order: security > correctness > performance', () => {
    const plan = [
      { id: 1, category: 'performance', file: 'a.js' },
      { id: 2, category: 'correctness', file: 'b.js' },
      { id: 3, category: 'security', file: 'c.js' },
    ];
    const sorted = prioritizePlan(plan);
    assert.equal(sorted[0].category, 'security');
    assert.equal(sorted[1].category, 'correctness');
    assert.equal(sorted[2].category, 'performance');
  });
});
