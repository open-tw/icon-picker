import { describe, expect, it, vi } from 'vitest';
import { createIconRegistry, kebabCodec, pascalCodec, prefixedCodec } from '../src/index.js';
import { makeProvider } from './fixtures.js';

describe('codecs', () => {
  it('prefixedCodec round-trips and rejects malformed values', () => {
    const c = prefixedCodec();
    expect(c.parse('lucide:chart-bar')).toBe('lucide:chart-bar');
    expect(c.parse(' lucide:chart-bar ')).toBe('lucide:chart-bar');
    expect(c.parse('chart-bar')).toBeNull();
    expect(c.parse('Lucide:ChartBar')).toBeNull();
    expect(c.format('lucide:chart-bar')).toBe('lucide:chart-bar');
  });

  it('kebabCodec maps bare names and refuses other prefixes', () => {
    const c = kebabCodec({ prefix: 'lucide' });
    expect(c.parse('chart-bar')).toBe('lucide:chart-bar');
    expect(c.parse('lucide:chart-bar')).toBe('lucide:chart-bar');
    expect(c.format('lucide:chart-bar')).toBe('chart-bar');
    expect(() => c.format('other:chart-bar')).toThrow(/single icon library/);
  });

  it('pascalCodec uses the lookup table (no string rules)', () => {
    const names = { ChartBar: 'chart-bar', ArrowUp10: 'arrow-up-1-0', BarChart: 'chart-bar' };
    const c = pascalCodec({ prefix: 'lucide', names });
    expect(c.parse('ArrowUp10')).toBe('lucide:arrow-up-1-0');
    expect(c.parse('ChartBarIcon')).toBe('lucide:chart-bar');
    expect(c.parse('LucideChartBar')).toBe('lucide:chart-bar');
    expect(c.parse('BarChart')).toBe('lucide:chart-bar');
    expect(c.parse('NotAnIcon')).toBeNull();
    expect(c.parse('constructor')).toBeNull();
    expect(c.format('lucide:arrow-up-1-0')).toBe('ArrowUp10');
  });
});

describe('createIconRegistry', () => {
  it('batches resolve() calls in the same tick into one loadIcons()', async () => {
    const p = makeProvider();
    const registry = createIconRegistry({ providers: [p] });
    const [a, b, c] = await Promise.all([
      registry.resolve('test:user'),
      registry.resolve('test:star'),
      registry.resolve('test:user'),
    ]);
    expect(p.loadIcons).toHaveBeenCalledTimes(1);
    expect(p.loadIcons.mock.calls[0]![0].sort()).toEqual(['star', 'user']);
    expect(a?.id).toBe('test:user');
    expect(b?.id).toBe('test:star');
    expect(c).toBe(a);
    expect(registry.getCached('test:user')).toBe(a);
  });

  it('applies aliases and caches misses', async () => {
    const p = makeProvider();
    const registry = createIconRegistry({ providers: [p] });
    expect((await registry.resolve('test:home'))?.name).toBe('house');
    expect(registry.getCached('test:home')?.name).toBe('house');
    expect(await registry.resolve('test:nope')).toBeNull();
    expect(await registry.resolve('test:nope')).toBeNull();
    expect(await registry.resolve('unknown:x' as const)).toBeNull();
    expect(p.loadIcons).toHaveBeenCalledTimes(2);
  });

  it('resolveMany returns a map keyed by the requested ids', async () => {
    const registry = createIconRegistry({ providers: [makeProvider()] });
    const map = await registry.resolveMany(['test:user', 'test:home', 'test:missing']);
    expect([...map.keys()]).toEqual(['test:user', 'test:home']);
  });

  it('retries after a failed load and reports the error', async () => {
    const p = makeProvider();
    p.loadIcons.mockRejectedValueOnce(new Error('network'));
    const onError = vi.fn();
    const registry = createIconRegistry({ providers: [p], onError });
    expect(await registry.resolve('test:user')).toBeNull();
    expect(onError).toHaveBeenCalledOnce();
    expect((await registry.resolve('test:user'))?.id).toBe('test:user');
  });

  it('parse / format go through the codec and report invalid values once', () => {
    const onInvalidValue = vi.fn();
    const registry = createIconRegistry({ providers: [makeProvider()], codec: kebabCodec({ prefix: 'test' }), onInvalidValue });
    expect(registry.parse('home')).toBe('test:house');
    expect(registry.format('test:house')).toBe('house');
    expect(registry.parse(null)).toBeNull();
    expect(registry.parse('Bad Value')).toBeNull();
    expect(registry.parse('Bad Value')).toBeNull();
    expect(onInvalidValue).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown prefixes and duplicate providers', () => {
    const registry = createIconRegistry({ providers: [makeProvider()] });
    expect(registry.parse('other:user')).toBeNull();
    expect(() => createIconRegistry({ providers: [makeProvider(), makeProvider()] })).toThrow(/duplicate/);
  });
});
