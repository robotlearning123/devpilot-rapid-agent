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
    for (const handler of this._handlers) {
      const result = await handler(task, ctx);
      if (result !== null && result !== undefined) {
        return result;
      }
    }
    throw new Error(`No handler matched task type: ${task.type}`);
  }
}
