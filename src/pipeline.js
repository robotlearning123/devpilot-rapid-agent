/**
 * Middleware pipeline for sequential handler dispatch.
 * Handlers are tried in order; first non-null result wins.
 */

export class Pipeline {
  constructor(handlers = []) {
    this._handlers = [...handlers];
  }

  get length() {
    return this._handlers.length;
  }

  use(handler) {
    if (typeof handler !== 'function') throw new Error('Handler must be a function');
    this._handlers.push(handler);
    return this;
  }

  async process(task, ctx) {
    if (!task || typeof task !== 'object') {
      throw new Error('Task must be a non-null object');
    }
    if (typeof task.type !== 'string' || task.type.length === 0) {
      throw new Error('Task must have a non-empty string "type" field');
    }
    for (const handler of this._handlers) {
      const result = await handler(task, ctx);
      if (result !== null && result !== undefined) {
        return result;
      }
    }
    throw new Error(`No handler matched task type: ${task.type}`);
  }
}
