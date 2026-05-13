/**
 * DevPilot Agent — orchestrates task execution through a middleware pipeline.
 */

import { Pipeline } from './pipeline.js';
import { loadConfig } from './utils/config.js';
import { BUILTIN_HANDLERS } from './handlers.js';

export class Agent {
  constructor(options = {}) {
    this.config = loadConfig(options.env);
    this.pipeline = new Pipeline();
    this._stats = { submitted: 0, succeeded: 0, failed: 0 };
    this._ctx = { config: this.config };

    const handlers = options.handlers || BUILTIN_HANDLERS;
    for (const h of handlers) {
      this.pipeline.use(h);
    }
  }

  async run(task) {
    if (!task || typeof task.type !== 'string') {
      throw new Error('Task must have a string "type" field');
    }
    this._stats.submitted++;
    try {
      const result = await this.pipeline.process(task, this._ctx);
      this._stats.succeeded++;
      return result;
    } catch (err) {
      this._stats.failed++;
      throw err;
    }
  }

  get stats() {
    return { ...this._stats };
  }

  use(handler) {
    this.pipeline.use(handler);
    return this;
  }
}
