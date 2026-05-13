/**
 * Configuration loader for DevPilot agent.
 * Reads from environment variables with sensible defaults.
 */

const DEFAULTS = {
  GITLAB_URL: 'https://gitlab.com',
  GITLAB_TOKEN: '',
  GITLAB_PROJECT_ID: '',
  GOOGLE_CLOUD_PROJECT: '',
  GOOGLE_CLOUD_LOCATION: 'us-central1',
  LOG_LEVEL: 'info',
  MAX_PLAN_STEPS: 10,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};

export function loadConfig(env = process.env) {
  const config = {};
  for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
    config[key] = env[key] ?? defaultVal;
  }
  config.MAX_PLAN_STEPS = Number(config.MAX_PLAN_STEPS);
  config.RETRY_ATTEMPTS = Number(config.RETRY_ATTEMPTS);
  config.RETRY_DELAY_MS = Number(config.RETRY_DELAY_MS);
  return Object.freeze(config);
}

export function validateConfig(config) {
  const missing = [];
  if (!config.GITLAB_TOKEN) missing.push('GITLAB_TOKEN');
  if (!config.GITLAB_PROJECT_ID) missing.push('GITLAB_PROJECT_ID');
  if (!config.GOOGLE_CLOUD_PROJECT) missing.push('GOOGLE_CLOUD_PROJECT');
  return { valid: missing.length === 0, missing };
}
