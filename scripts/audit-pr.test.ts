import { describe, expect, test } from 'bun:test';

import { advisoryIds, parseArgs } from './audit-pr';

describe('advisoryIds', () => {
  test('collects GHSA IDs across packages, deduplicated and sorted', () => {
    const json = JSON.stringify({
      undici: [
        { url: 'https://github.com/advisories/GHSA-xjj6-f33q-929c' },
        { url: 'https://github.com/advisories/GHSA-2m5v-pch6-74hx' },
      ],
      'fast-uri': [{ url: 'https://github.com/advisories/GHSA-xjj6-f33q-929c' }],
    });
    expect(advisoryIds(json)).toEqual(['GHSA-2m5v-pch6-74hx', 'GHSA-xjj6-f33q-929c']);
  });

  test('returns nothing for a clean tree', () => {
    expect(advisoryIds('{}')).toEqual([]);
  });

  test('throws on output that is not an audit report', () => {
    expect(() => advisoryIds('')).toThrow();
    expect(() => advisoryIds('[]')).toThrow('Unexpected bun audit output');
    expect(() => advisoryIds('{"undici":{}}')).toThrow('Unexpected bun audit output');
  });

  test('throws on an advisory without a GHSA URL rather than skipping it', () => {
    expect(() => advisoryIds('{"undici":[{"url":"https://example.com"}]}')).toThrow(
      'Advisory without a GHSA URL'
    );
  });
});

describe('parseArgs', () => {
  test('splits --base from forwarded flags', () => {
    expect(
      parseArgs(['--ignore', 'GHSA-a', '--base', 'origin/main', '--ignore', 'GHSA-b'])
    ).toEqual({
      base: 'origin/main',
      forwarded: ['--ignore', 'GHSA-a', '--ignore', 'GHSA-b'],
    });
  });

  test('requires --base with a value', () => {
    expect(() => parseArgs([])).toThrow('Missing --base');
    expect(() => parseArgs(['--base'])).toThrow('Missing --base');
  });
});
