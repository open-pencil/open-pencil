/** The Cloud console: a bar with the server and account, sections in a sidebar. */
export default {
  slots: {
    page: 'flex h-full min-h-0 flex-col overflow-hidden bg-canvas text-surface',
    bar: 'flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel px-4',
    barHome:
      'flex items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none',
    barTitle: 'text-xs font-semibold whitespace-nowrap',
    barHost: 'truncate text-[11px] text-muted max-sm:hidden',
    barEnd: 'ml-auto flex items-center gap-2',
    console: 'flex min-h-0 flex-1 max-md:flex-col',
    // Narrow screens turn the section list into one row above the page that scrolls without a
    // scrollbar, fades where it hides sections, and has a chevron toward them, as the editor's
    // menu bar does.
    navFrame:
      'flex shrink-0 bg-panel max-md:items-center max-md:border-b max-md:border-border max-md:pr-1',
    nav: 'scrollbar-none max-md:h-auto max-md:w-auto max-md:min-w-0 max-md:flex-1 max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:p-1 data-overflow-end:mask-r-from-[calc(100%-2rem)] data-overflow-start:mask-l-from-[calc(100%-2rem)]',
    navScroll:
      'flex h-6 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-hover hover:text-surface data-start:order-first md:hidden',
    navGroup: 'max-md:flex-row max-md:items-center max-md:border-t-0 max-md:p-0',
    navHeader: 'max-md:hidden',
    navItems: 'max-md:flex-row',
    navItem: 'max-md:w-auto max-md:shrink-0',
    main: 'min-w-0 flex-1 overflow-y-auto',
    mainInner: 'flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-6',
    pageTitle: 'text-base font-semibold',
    pageDescription: 'mt-0.5 text-xs text-muted'
  }
} as const
