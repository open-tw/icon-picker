export type {
  A11yProps,
  CategoryItem,
  IconData,
  IconId,
  IconMeta,
  IconPicker,
  IconPickerFeatures,
  IconPickerMessages,
  IconPickerOptions,
  IconPickerState,
  IconPickerStatus,
  IconProvider,
  IconRegistry,
  IconValueCodec,
  KeyboardEventLike,
  MoveDirection,
  RecentsStorage,
  SearchField,
  Updater,
} from './types.js';
export { createIconRegistry, type IconRegistryOptions } from './registry.js';
export { createIconPicker, defaultState } from './picker.js';
export { prefixedCodec, kebabCodec, pascalCodec, type PascalCodecOptions } from './codecs.js';
export { searchIcons, normalizeQuery } from './search.js';
export { defaultMessages, messagesZhTW } from './messages.js';
export { functionalUpdate, humanizeName, isIconId, splitIconId, toIconId, toPascalCase } from './utils.js';
