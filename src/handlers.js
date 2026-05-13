/**
 * Built-in handlers for the DevPilot agent pipeline.
 * Each handler: (task, ctx) => result | null
 * Return null to pass to the next handler; return a value to complete.
 */

export function echoHandler(task, _ctx) {
  if (task.type !== 'echo') return null;
  return { output: task.payload, timestamp: Date.now() };
}

export function transformHandler(task, _ctx) {
  if (task.type !== 'transform') return null;
  const { input, operation } = task.payload || {};
  switch (operation) {
    case 'upper':
      return { output: String(input).toUpperCase() };
    case 'lower':
      return { output: String(input).toLowerCase() };
    case 'reverse':
      return { output: String(input).split('').reverse().join('') };
    case 'length':
      return { output: String(input).length };
    default:
      throw new Error(`Unknown transform operation: ${operation}`);
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
  const { items } = task.payload || {};
  if (!Array.isArray(items)) throw new Error('batch payload.items must be an array');
  return {
    total: items.length,
    results: items.map((item, idx) => ({ index: idx, value: item })),
  };
}

export const BUILTIN_HANDLERS = [echoHandler, transformHandler, cloudStatusHandler, batchHandler];
