// @vitest-environment happy-dom
import { kebabCodec, type IconPicker, type IconPickerOptions, type IconPickerState, type IconRegistry, type RecentsStorage } from '@open-tw/icon-picker-core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, memo, useState, version as reactVersion } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icon, IconRegistryProvider, useIconPicker } from '../src/index.js';
import { makeRegistry } from './helpers.js';

afterEach(cleanup);

const flush = () => act(() => new Promise<void>(r => setTimeout(r, 0)));

interface FieldProps extends Partial<IconPickerOptions> {
  registry: IconRegistry;
}

/** Minimal field following the usage example in the design doc. */
function Field({ registry, ...options }: FieldProps) {
  const picker = useIconPicker({ registry, columns: 4, ...options });
  const { open, query } = picker.getState();
  const value = picker.getValue();
  return (
    <IconRegistryProvider value={registry}>
      <button type="button" data-testid="trigger" onClick={picker.toggle}>
        {value ? <Icon value={value} /> : <Icon id="t:image" />}
        <span data-testid="value">{String(value)}</span>
      </button>
      <button type="button" data-testid="clear" onClick={picker.clear} />
      {open && (
        <div>
          <input
            data-testid="search"
            value={query}
            onChange={e => picker.setQuery(e.target.value)}
            onKeyDown={picker.handleKeyDown}
            {...picker.getSearchA11y()}
          />
          <div {...picker.getGridA11y()}>
            {picker.getFilteredIcons().map(icon => (
              <button key={icon.id} type="button" onClick={() => picker.select(icon.id)} {...picker.getItemA11y(icon)}>
                <Icon id={icon.id} />
              </button>
            ))}
          </div>
          <div data-testid="status">{picker.getAnnouncement()}</div>
        </div>
      )}
    </IconRegistryProvider>
  );
}

async function openField(props: Omit<FieldProps, 'registry'> = {}, registry = makeRegistry().registry) {
  const onChange = vi.fn();
  const utils = render(<Field registry={registry} onChange={onChange} {...props} />);
  fireEvent.click(screen.getByTestId('trigger'));
  await flush();
  return { ...utils, onChange, registry };
}

describe(`useIconPicker (React ${reactVersion})`, () => {
  it('opens, lazy-loads, searches and selects via keyboard', async () => {
    const { onChange } = await openField();
    expect(screen.getByTestId('status').textContent).toBe('8 icons found');
    expect(screen.getAllByRole('option')).toHaveLength(8);

    const search = screen.getByRole('combobox');
    fireEvent.change(search, { target: { value: 'user' } });
    expect(screen.getAllByRole('option').map(o => o.getAttribute('aria-label'))).toEqual(['User', 'Users']);

    fireEvent.keyDown(search, { key: 'ArrowRight' });
    expect(search.getAttribute('aria-activedescendant')).toBe(screen.getByLabelText('Users').id);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('t:users');
    expect(screen.queryByRole('combobox')).toBeNull(); // closed
    expect(screen.getByTestId('value').textContent).toBe('t:users'); // uncontrolled value re-rendered
  });

  it('re-renders for value changes that do not touch picker state (clear, closeOnSelect: false)', async () => {
    await openField({ closeOnSelect: false });
    fireEvent.click(screen.getByLabelText('Star'));
    expect(screen.getByLabelText('Star').getAttribute('data-current')).toBe('true');
    fireEvent.click(screen.getByTestId('clear'));
    expect(screen.getByTestId('value').textContent).toBe('null');
    expect(screen.getByLabelText('Star').hasAttribute('data-current')).toBe(false);
  });

  it('works as a controlled value with a codec', async () => {
    const { registry } = makeRegistry({ codec: kebabCodec({ prefix: 't' }) });
    function Controlled() {
      const [value, setValue] = useState<string | null>('star');
      return (
        <>
          <Field registry={registry} value={value} onChange={setValue} closeOnSelect={false} />
          <output data-testid="db">{String(value)}</output>
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByTestId('trigger'));
    await flush();
    expect(screen.getByLabelText('Star').getAttribute('data-current')).toBe('true');
    // Opening puts keyboard focus on the current value.
    expect(screen.getByLabelText('Star').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByLabelText('Heart'));
    expect(screen.getByTestId('db').textContent).toBe('heart');
    expect(screen.getByLabelText('Heart').getAttribute('data-current')).toBe('true');
  });

  it('supports partially controlled state (e.g. query synced to the URL)', async () => {
    const { registry } = makeRegistry();
    function UrlSynced() {
      const [query, setQuery] = useState('chart');
      return (
        <>
          <Field
            registry={registry}
            state={{ query }}
            onStateChange={updater => {
              const next = typeof updater === 'function' ? updater({} as IconPickerState) : updater;
              setQuery(next.query);
            }}
          />
          <output data-testid="url">{query}</output>
        </>
      );
    }
    render(<UrlSynced />);
    fireEvent.click(screen.getByTestId('trigger'));
    await flush();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'house' } });
    expect(screen.getByTestId('url').textContent).toBe('house');
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('keeps method identities stable but changes the instance identity on updates', async () => {
    const seen: IconPicker[] = [];
    const { registry } = makeRegistry();
    function Probe() {
      const picker = useIconPicker({ registry });
      seen.push(picker);
      return <button type="button" onClick={picker.open} data-testid="open" />;
    }
    render(<Probe />);
    fireEvent.click(screen.getByTestId('open'));
    await flush();
    const first = seen[0]!;
    const last = seen[seen.length - 1]!;
    expect(last).not.toBe(first);
    expect(last.toggle).toBe(first.toggle);
    expect(last.getState().status).toBe('ready');
  });

  it('updates memo() children that receive the picker', async () => {
    const { registry } = makeRegistry();
    const Count = memo(function Count({ picker }: { picker: IconPicker }) {
      return <output data-testid="count">{picker.getFilteredIcons().length}</output>;
    });
    function Parent() {
      const picker = useIconPicker({ registry });
      return (
        <>
          <button type="button" data-testid="open" onClick={picker.open} />
          <input data-testid="q" onChange={e => picker.setQuery(e.target.value)} />
          <Count picker={picker} />
        </>
      );
    }
    render(<Parent />);
    fireEvent.click(screen.getByTestId('open'));
    await flush();
    expect(screen.getByTestId('count').textContent).toBe('8');
    fireEvent.change(screen.getByTestId('q'), { target: { value: 'chart' } });
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('works under StrictMode and calling setOptions during render never warns', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage: RecentsStorage = { get: vi.fn(() => ['t:heart' as const]), set: vi.fn() };
    const { registry } = makeRegistry();
    render(
      <StrictMode>
        <Field registry={registry} features={{ recents: { storage } }} />
      </StrictMode>,
    );
    fireEvent.click(screen.getByTestId('trigger'));
    await flush();
    fireEvent.click(screen.getByLabelText('Star'));
    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenLastCalledWith(['t:star', 't:heart']);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('generates distinct a11y ids per instance from useId', async () => {
    const { registry } = makeRegistry();
    render(
      <>
        <Field registry={registry} />
        <Field registry={registry} />
      </>,
    );
    for (const t of screen.getAllByTestId('trigger')) fireEvent.click(t);
    await flush();
    const [a, b] = screen.getAllByRole('listbox');
    expect(a!.id).not.toBe(b!.id);
    expect(a!.id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
