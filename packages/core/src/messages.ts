import type { IconPickerMessages } from './types.js';
import { humanizeName } from './utils.js';

export const defaultMessages: IconPickerMessages = {
  searchLabel: 'Search icons',
  gridLabel: 'Icons',
  loading: 'Loading icons…',
  error: 'Failed to load icons',
  noResults: 'No icons found',
  results: count => (count === 1 ? '1 icon found' : `${count} icons found`),
  iconLabel: icon => icon.label ?? humanizeName(icon.name),
};

export const messagesZhTW: IconPickerMessages = {
  searchLabel: '搜尋 icon',
  gridLabel: 'Icon 列表',
  loading: '正在載入 icon…',
  error: 'Icon 載入失敗',
  noResults: '找不到符合的 icon',
  results: count => `找到 ${count} 個 icon`,
  iconLabel: icon => icon.label ?? humanizeName(icon.name),
};
