/**
 * Payload validation utilities for pipeline handlers.
 * Provides reusable validators to ensure task payloads conform to expected shapes.
 */

/**
 * Validate that a value is present and of the expected type.
 * @param {*} value - The value to check
 * @param {string} name - Human-readable field name for error messages
 * @param {'string'|'number'|'object'|'array'|'boolean'} expectedType
 * @throws {Error} Descriptive error if validation fails
 */
export function assertType(value, name, expectedType) {
  if (value === undefined || value === null) {
    throw new Error(`Missing required field: ${name}`);
  }
  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      throw new Error(`Field "${name}" must be an array, got ${typeof value}`);
    }
    return;
  }
  if (expectedType === 'object') {
    if (Array.isArray(value) || typeof value !== 'object') {
      throw new Error(`Field "${name}" must be a plain object, got ${Array.isArray(value) ? 'array' : typeof value}`);
    }
    return;
  }
  if (typeof value !== expectedType) {
    throw new Error(`Field "${name}" must be ${expectedType}, got ${typeof value}`);
  }
}

/**
 * Validate that a value is one of the allowed choices.
 * @param {*} value - The value to check
 * @param {string} name - Human-readable field name
 * @param {Array} allowed - Allowed values
 * @throws {Error} If value is not in the allowed set
 */
export function assertEnum(value, name, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`Field "${name}" must be one of [${allowed.join(', ')}], got "${value}"`);
  }
}

/**
 * Validate payload is a non-null object.
 * @param {*} payload - The task payload
 * @param {string} handlerName - Handler name for error context
 * @throws {Error} If payload is missing or not an object
 */
export function assertPayloadObject(payload, handlerName) {
  if (payload === undefined || payload === null) {
    throw new Error(`${handlerName} requires a payload object`);
  }
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${handlerName} payload must be a plain object`);
  }
}
