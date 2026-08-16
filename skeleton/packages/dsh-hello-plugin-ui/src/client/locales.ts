/** Copy dictionaries for the skeleton tab. */

export const zh = {
  tab: '示例',
  loading: '正在读取…',
  error: '暂时无法读取。',
  retry: '重试',
  empty: '暂无数据。',
  refresh: '刷新',
} satisfies Record<string, string>

export type HelloLocaleKey = keyof typeof zh

export const en: Record<HelloLocaleKey, string> = {
  tab: 'Hello',
  loading: 'Loading…',
  error: 'Unable to load.',
  retry: 'Retry',
  empty: 'No data.',
  refresh: 'Refresh',
}
