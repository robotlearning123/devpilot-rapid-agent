/**
 * Built-in handlers for the DevPilot agent pipeline.
 * Each handler: (task, ctx) => result | null
 * Return null to pass to the next handler; return a value to complete.
 */

import { createGeminiClient } from './cloud/gemini.js';
import { fetchIssues, triageIssues } from './utils/gitlab.js';
import { assertType, assertEnum, assertPayloadObject } from './utils/validate.js';

export function echoHandler(task, _ctx) {
  if (task.type !== 'echo') return null;
  assertType(task.payload, 'payload', 'string');
  return { output: task.payload, timestamp: Date.now() };
}

export function transformHandler(task, _ctx) {
  if (task.type !== 'transform') return null;
  assertPayloadObject(task.payload, 'transform');
  const { input, operation } = task.payload;
  assertType(input, 'input', 'string');
  assertEnum(operation, 'operation', ['upper', 'lower', 'reverse', 'length']);
  switch (operation) {
    case 'upper':
      return { output: String(input).toUpperCase() };
    case 'lower':
      return { output: String(input).toLowerCase() };
    case 'reverse':
      return { output: String(input).split('').reverse().join('') };
    case 'length':
      return { output: String(input).length };
  }
}

export function cloudStatusHandler(task, ctx) {
  if (task.type !== 'cloud-status') return null;
  return {
    configured: Boolean(ctx.config.GOOGLE_CLOUD_PROJECT),
    projectId: ctx.config.GOOGLE_CLOUD_PROJECT || null,
    region: ctx.config.GOOGLE_CLOUD_LOCATION,
    timestamp: Date.now(),
  };
}

export function batchHandler(task, _ctx) {
  if (task.type !== 'batch') return null;
  assertPayloadObject(task.payload, 'batch');
  const { items } = task.payload;
  assertType(items, 'items', 'array');
  return {
    total: items.length,
    results: items.map((item, idx) => ({ index: idx, value: item })),
  };
}

/**
 * Gemini handler — routes AI tasks to the Gemini client.
 *
 * Task shape: { type: 'gemini', payload: { action, prompt, messages, options } }
 * Actions: 'generate' | 'review' | 'chat'
 */
export function geminiHandler(task, ctx) {
  if (task.type !== 'gemini') return null;
  assertPayloadObject(task.payload, 'gemini');
  const { action: rawAction, prompt, messages, options } = task.payload;
  const action = rawAction || 'generate';
  assertEnum(action, 'action', ['generate', 'review', 'chat']);
  if (action === 'chat') {
    assertType(messages, 'messages', 'array');
  } else {
    assertType(prompt, 'prompt', 'string');
  }
  const client = createGeminiClient(ctx.config, ctx.deps);

  switch (action) {
    case 'review':
      return client.review(prompt, options).then((output) => ({ output, action }));
    case 'chat':
      return client.chat(messages, options).then((output) => ({ output, action }));
    default:
      return client.generate(prompt, options).then((output) => ({ output, action }));
  }
}

export async function gitlabTriageHandler(task, ctx) {
  if (task.type !== 'gitlab-triage') return null;
  assertPayloadObject(task.payload, 'gitlab-triage');
  const { operation } = task.payload;
  assertEnum(operation, 'operation', ['list', 'triage', 'classify']);

  switch (operation) {
    case 'list': {
      const issues = await fetchIssues(ctx.config, task.payload?.params, ctx.fetch);
      return { operation: 'list', total: issues.length, issues };
    }
    case 'triage': {
      const issues = task.payload?.issues
        ? task.payload.issues
        : await fetchIssues(ctx.config, task.payload?.params, ctx.fetch);
      return triageIssues(issues);
    }
    case 'classify': {
      const { issue } = task.payload;
      if (!issue) throw new Error('gitlab-triage classify requires payload.issue');
      const { classifyIssue } = await import('./utils/gitlab.js');
      return { operation: 'classify', ...classifyIssue(issue) };
    }
  }
}

export const BUILTIN_HANDLERS = [
  echoHandler,
  transformHandler,
  cloudStatusHandler,
  batchHandler,
  geminiHandler,
  gitlabTriageHandler,
];
