/**
 * DevPilot — AI DevOps Agent entry point.
 *
 * Exports the pipeline-based Agent framework and the
 * GitLab MR review agent for automated code review.
 */

import { Agent } from './agent.js';
import { Pipeline } from './pipeline.js';
import { loadConfig, validateConfig } from './utils/config.js';
import {
  echoHandler,
  transformHandler,
  cloudStatusHandler,
  batchHandler,
  geminiHandler,
  gitlabTriageHandler,
  BUILTIN_HANDLERS,
} from './handlers.js';

// Review agent components
import { createPlan, validatePlan, prioritizePlan } from './agent/planner.js';
import { executeStep, executePlan, summarizeResults } from './agent/executor.js';
import { createGitLabClient } from './gitlab/client.js';
import { createVertexReviewer, heuristicReview } from './cloud/vertex.js';
import { createGeminiClient } from './cloud/gemini.js';

export {
  Agent,
  Pipeline,
  loadConfig,
  validateConfig,
  echoHandler,
  transformHandler,
  cloudStatusHandler,
  batchHandler,
  geminiHandler,
  gitlabTriageHandler,
  BUILTIN_HANDLERS,
};

export {
  createPlan,
  validatePlan,
  prioritizePlan,
  executeStep,
  executePlan,
  summarizeResults,
  createGitLabClient,
  createVertexReviewer,
  heuristicReview,
  createGeminiClient,
};

export { runAgent } from './review.js';

export default Agent;
