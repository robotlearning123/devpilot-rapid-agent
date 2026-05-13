import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { assertType, assertEnum, assertPayloadObject } from '../src/utils/validate.js';

describe('assertType', () => {
  it('passes for valid string', () => {
    assert.doesNotThrow(() => assertType('hello', 'field', 'string'));
  });

  it('throws for null', () => {
    assert.throws(() => assertType(null, 'field', 'string'), /Missing required field: field/);
  });

  it('throws for undefined', () => {
    assert.throws(() => assertType(undefined, 'field', 'string'), /Missing required field: field/);
  });

  it('throws for wrong type', () => {
    assert.throws(() => assertType(42, 'field', 'string'), /must be string, got number/);
  });

  it('passes for valid number', () => {
    assert.doesNotThrow(() => assertType(42, 'count', 'number'));
  });

  it('passes for valid boolean', () => {
    assert.doesNotThrow(() => assertType(true, 'flag', 'boolean'));
  });

  it('passes for valid array', () => {
    assert.doesNotThrow(() => assertType([1, 2], 'items', 'array'));
  });

  it('throws when expecting array but got object', () => {
    assert.throws(() => assertType({}, 'items', 'array'), /must be an array, got object/);
  });

  it('passes for valid object', () => {
    assert.doesNotThrow(() => assertType({}, 'data', 'object'));
  });

  it('throws when expecting object but got array', () => {
    assert.throws(() => assertType([], 'data', 'object'), /must be a plain object, got array/);
  });

  it('throws when expecting object but got string', () => {
    assert.throws(() => assertType('x', 'data', 'object'), /must be a plain object, got string/);
  });
});

describe('assertEnum', () => {
  it('passes for valid enum value', () => {
    assert.doesNotThrow(() => assertEnum('upper', 'op', ['upper', 'lower']));
  });

  it('throws for invalid enum value', () => {
    assert.throws(
      () => assertEnum('explode', 'op', ['upper', 'lower']),
      /must be one of \[upper, lower\], got "explode"/,
    );
  });

  it('accepts numeric enum values', () => {
    assert.doesNotThrow(() => assertEnum(1, 'code', [0, 1, 2]));
  });
});

describe('assertPayloadObject', () => {
  it('passes for valid object', () => {
    assert.doesNotThrow(() => assertPayloadObject({ key: 'val' }, 'test'));
  });

  it('throws for null payload', () => {
    assert.throws(() => assertPayloadObject(null, 'myhandler'), /myhandler requires a payload object/);
  });

  it('throws for undefined payload', () => {
    assert.throws(() => assertPayloadObject(undefined, 'myhandler'), /myhandler requires a payload object/);
  });

  it('throws for array payload', () => {
    assert.throws(() => assertPayloadObject([], 'myhandler'), /myhandler payload must be a plain object/);
  });

  it('throws for string payload', () => {
    assert.throws(() => assertPayloadObject('hello', 'myhandler'), /myhandler payload must be a plain object/);
  });
});
