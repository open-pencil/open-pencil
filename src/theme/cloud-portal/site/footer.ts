/** The official site's footer: the product's line, link columns, and the copyright row. */
export default {
  slots: {
    root: 'mt-auto border-t border-border/60',
    inner:
      'mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-8 gap-y-10 px-4 pt-12 pb-8 sm:px-6 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]',
    about: 'col-span-2 flex flex-col gap-3 md:col-span-1',
    tagline: 'max-w-xs text-sm text-pretty text-muted',
    column: 'flex flex-col gap-3',
    columnTitle: 'text-xs font-semibold text-surface',
    columnLinks: 'flex flex-col gap-2',
    bottom:
      'col-span-full flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted',
    bottomEnd: 'flex items-center gap-4 whitespace-nowrap'
  }
} as const
