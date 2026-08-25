import { describe, test, expect } from 'bun:test';
import { sleep, errorMessage } from './async';

describe('sleep', () => {
  test('resolves after roughly the requested delay', async () => {
    const start = Date.now();
    await sleep(30);
    // Timer granularity varies; assert the floor with a small tolerance.
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });

  test('resolves to undefined', async () => {
    expect(await sleep(1)).toBeUndefined();
  });

  test('a zero delay still yields to the event loop', async () => {
    const order: string[] = [];
    const pending = sleep(0).then(() => order.push('after'));
    order.push('sync');
    await pending;
    expect(order).toEqual(['sync', 'after']);
  });
});

describe('errorMessage', () => {
  test('returns the message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  test('returns the message of an Error subclass', () => {
    class ApiError extends Error {}
    expect(errorMessage(new ApiError('rate limited'))).toBe('rate limited');
  });

  test('stringifies non-Error throws', () => {
    // `catch` binds unknown, and code does throw plain values.
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });

  test('stringifies an object without throwing', () => {
    expect(typeof errorMessage({ code: 500 })).toBe('string');
  });
});
