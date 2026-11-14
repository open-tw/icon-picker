/**
 * Compiled with babel-plugin-react-compiler by the test setup (files named *.compiled.tsx).
 * The compiler memoises JSX on the identity of `picker`; this verifies the adapter's return value
 * changes identity when the picker updates, so nothing goes stale.
 */
import type { IconPicker, IconRegistry } from '@open-tw/icon-picker-core';
import { useIconPicker } from '../../src/index.js';

function Results({ picker }: { picker: IconPicker }) {
  const icons = picker.getFilteredIcons();
  return (
    <ul data-testid="results">
      {icons.map(icon => (
        <li key={icon.id}>{icon.name}</li>
      ))}
    </ul>
  );
}

export function CompiledField({ registry }: { registry: IconRegistry }) {
  const picker = useIconPicker({ registry, columns: 4 });
  const { open, query } = picker.getState();
  return (
    <div>
      <button type="button" data-testid="toggle" onClick={picker.toggle} />
      {open && (
        <>
          <input data-testid="search" value={query} onChange={e => picker.setQuery(e.target.value)} />
          <span data-testid="status">{picker.getAnnouncement()}</span>
          <Results picker={picker} />
        </>
      )}
    </div>
  );
}
