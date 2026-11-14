// @vitest-environment happy-dom
import { pascalCodec } from '@open-tw/icon-picker-core';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createRef, version as reactVersion } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Icon, IconRegistryProvider, useIcon } from '../src/index.js';
import { makeRegistry } from './helpers.js';

afterEach(cleanup);

const flush = () => act(() => new Promise<void>(r => setTimeout(r, 0)));

describe(`<Icon /> (React ${reactVersion})`, () => {
  it('renders a fallback box, then the svg', async () => {
    const { registry } = makeRegistry();
    const { container } = render(
      <IconRegistryProvider value={registry}>
        <Icon id="t:star" size={16} />
      </IconRegistryProvider>,
    );
    const placeholder = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(placeholder.style.width).toBe('16px');
    await flush();
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-icon')).toBe('t:star');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.innerHTML).toBe('<path d="star"></path>');
  });

  it('renders cached icons on the first render', async () => {
    const { registry } = makeRegistry();
    await registry.resolve('t:star');
    const { container } = render(<Icon id="t:star" registry={registry} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('accepts a stored value through the codec, title and strokeWidth', async () => {
    const { registry } = makeRegistry({ codec: pascalCodec({ prefix: 't', names: { ChartBar: 'chart-bar' } }) });
    render(
      <IconRegistryProvider value={registry}>
        <Icon value="ChartBar" title="Revenue" strokeWidth={1.5} className="x" />
      </IconRegistryProvider>,
    );
    await flush();
    const svg = screen.getByRole('img', { name: 'Revenue' });
    expect(svg.getAttribute('stroke-width')).toBe('1.5');
    expect(svg.getAttribute('class')).toBe('x');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it('forwards refs to the svg element', async () => {
    const { registry } = makeRegistry();
    const ref = createRef<SVGSVGElement>();
    render(<Icon id="t:star" registry={registry} ref={ref} />);
    await flush();
    expect(ref.current?.tagName.toLowerCase()).toBe('svg');
  });

  it('shows the fallback for unknown values', async () => {
    const { registry } = makeRegistry();
    render(<Icon value="nope" registry={registry} fallback={<i data-testid="fb" />} />);
    await flush();
    expect(screen.getByTestId('fb')).toBeTruthy();
  });

  it('throws a helpful error without a registry', () => {
    expect(() => {
      const err = console.error;
      console.error = () => {};
      try {
        render(<Icon id="t:star" />);
      } finally {
        console.error = err;
      }
    }).toThrow(/IconRegistryProvider/);
  });
});

describe(`useIcon (React ${reactVersion})`, () => {
  it('never returns data for a previous id', async () => {
    const { registry } = makeRegistry();
    const seen: (string | undefined)[][] = [];
    function Probe({ id }: { id: `t:${string}` }) {
      const data = useIcon(id, registry);
      seen.push([id, data?.id]);
      return null;
    }
    const { rerender } = render(<Probe id="t:star" />);
    await flush();
    rerender(<Probe id="t:heart" />);
    await flush();
    for (const [id, dataId] of seen) if (dataId) expect(dataId).toBe(id);
    expect(seen[seen.length - 1]).toEqual(['t:heart', 't:heart']);
  });
});
