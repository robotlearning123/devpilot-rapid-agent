import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, validateConfig } from '../src/utils/config.js';

describe('loadConfig', () => {
  it('returns defaults when no env vars are set', () => {
    const cfg = loadConfig({});
    assert.equal(cfg.GITLAB_URL, 'https://gitlab.com');
    assert.equal(cfg.GITLAB_TOKEN, '');
    assert.equal(cfg.GOOGLE_CLOUD_LOCATION, 'us-central1');
    assert.equal(cfg.LOG_LEVEL, 'info');
    assert.equal(cfg.MAX_PLAN_STEPS, 10);
    assert.equal(cfg.RETRY_ATTEMPTS, 3);
    assert.equal(cfg.RETRY_DELAY_MS, 1000);
  });

  it('overrides defaults with provided env vars', () => {
    const cfg = loadConfig({
      GITLAB_TOKEN: 'glpat-abc123',
      GITLAB_PROJECT_ID: '42',
      GOOGLE_CLOUD_PROJECT: 'my-gcp-project',
      GOOGLE_CLOUD_LOCATION: 'europe-west1',
    });
    assert.equal(cfg.GITLAB_TOKEN, 'glpat-abc123');
    assert.equal(cfg.GITLAB_PROJECT_ID, '42');
    assert.equal(cfg.GOOGLE_CLOUD_PROJECT, 'my-gcp-project');
    assert.equal(cfg.GOOGLE_CLOUD_LOCATION, 'europe-west1');
  });

  it('coerces numeric fields to Number type', () => {
    const cfg = loadConfig({
      MAX_PLAN_STEPS: '20',
      RETRY_ATTEMPTS: '5',
      RETRY_DELAY_MS: '2000',
    });
    assert.equal(typeof cfg.MAX_PLAN_STEPS, 'number');
    assert.equal(cfg.MAX_PLAN_STEPS, 20);
    assert.equal(typeof cfg.RETRY_ATTEMPTS, 'number');
    assert.equal(cfg.RETRY_DELAY_MS, 2000);
  });

  it('returns a frozen object (immutable)', () => {
    const cfg = loadConfig({});
    assert.throws(() => { cfg.GITLAB_URL = 'modified'; }, /Cannot assign/);
  });
});

describe('validateConfig', () => {
  it('reports valid when all required fields are present', () => {
    const cfg = loadConfig({
      GITLAB_TOKEN: 'tok',
      GITLAB_PROJECT_ID: '1',
      GOOGLE_CLOUD_PROJECT: 'proj',
    });
    const result = validateConfig(cfg);
    assert.equal(result.valid, true);
    assert.deepEqual(result.missing, []);
  });

  it('reports all missing required fields', () => {
    const cfg = loadConfig({});
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
    assert.ok(result.missing.includes('GITLAB_TOKEN'));
    assert.ok(result.missing.includes('GITLAB_PROJECT_ID'));
    assert.ok(result.missing.includes('GOOGLE_CLOUD_PROJECT'));
  });

  it('reports partial missing when some required fields are empty', () => {
    const cfg = loadConfig({ GITLAB_TOKEN: 'tok' });
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
    assert.equal(result.missing.length, 2);
    assert.ok(!result.missing.includes('GITLAB_TOKEN'));
  });
});
