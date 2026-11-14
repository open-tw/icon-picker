// @vitest-environment happy-dom
// React 19 only (the React 18 compat run excludes this file; React 18 would need react-compiler-runtime).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CompiledField } from './fixtures/field.compiled.js';
import { makeRegistry } from './helpers.js';

afterEach(cleanup);

describe('React Compiler', () => {
  it('the fixture really is compiled', () => {
    // Compiled components read and write the memo cache slots `$[n]`.
    expect(CompiledField.toString()).toMatch(/\$\[\d+\] = /);
  });

  it('memoised children update when the picker changes', async () => {
    const { registry } = makeRegistry();
    render(<CompiledField registry={registry} />);
    fireEvent.click(screen.getByTestId('toggle'));
    await act(() => new Promise<void>(r => setTimeout(r, 0)));
    expect(screen.getByTestId('status').textContent).toBe('8 icons found');
    expect(screen.getByTestId('results').children).toHaveLength(8);

    fireEvent.change(screen.getByTestId('search'), { target: { value: 'chart' } });
    expect(screen.getByTestId('results').children).toHaveLength(2);
    expect(screen.getByTestId('status').textContent).toBe('2 icons found');
  });
});
