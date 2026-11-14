import componentNames from '../generated/component-names.js';

/**
 * lucide-react component name → Lucide icon name, e.g. `ChartBar` → `chart-bar`, `ArrowUp10` → `arrow-up-1-0`.
 * Includes renamed (deprecated) names. Use with `pascalCodec({ prefix: 'lucide', names: lucideComponentNames })`.
 *
 * Kept in a separate entry point so apps that store `prefix:name` don't ship the table.
 */
export const lucideComponentNames: Readonly<Record<string, string>> = componentNames;
