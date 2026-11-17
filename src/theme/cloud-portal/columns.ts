/** Each role's width and look, the same in every console table. */
export const PORTAL_COLUMN_WIDTHS = {
  subject: 'w-1/4',
  text: 'w-1/3',
  tag: 'w-36',
  date: 'w-36 whitespace-nowrap text-muted',
  count: 'w-24 text-end tabular-nums',
  actions: 'w-px whitespace-nowrap text-end'
} as const

/**
 * When a narrow table leaves a column out, in one order for every table: words that need room go
 * first, then dates and numbers, then subjects and tags. A row's own column, which has no role, and
 * its actions stay.
 */
export const PORTAL_COLUMN_HIDING = {
  subject: 'hidden @xl/table:table-cell',
  text: 'hidden @3xl/table:table-cell',
  tag: 'hidden @xl/table:table-cell',
  date: 'hidden @2xl/table:table-cell',
  count: 'hidden @2xl/table:table-cell',
  actions: ''
} as const
