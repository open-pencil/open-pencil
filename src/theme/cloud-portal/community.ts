/**
 * The community gallery's pages: a bar that stays at the top, a grid of files whose previews lead,
 * and a file's page with its preview beside what it is and how to open it.
 */
export default {
  slots: {
    page: 'flex h-full min-h-0 flex-col overflow-y-auto bg-canvas text-surface',
    bar: 'sticky top-0 z-10 border-b border-border bg-canvas/85 backdrop-blur',
    barInner: 'mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-8',
    brand:
      'flex items-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent',
    mark: 'size-7 rounded-md',
    barDivider: 'h-4 w-px bg-border',
    barSection: 'text-sm text-muted hover:text-surface',
    barActions: 'ms-auto flex items-center gap-2',
    main: 'mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pt-10 pb-20 sm:px-8',
    hero: 'flex flex-col gap-2',
    title: 'text-3xl font-semibold tracking-tight text-balance',
    description: 'max-w-xl text-sm text-pretty text-muted',
    toolbar: 'flex flex-wrap items-center justify-between gap-3',
    search: 'w-full sm:w-56',
    count: 'text-xs text-muted tabular-nums',
    grid: 'grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3',
    card: 'group flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-canvas',
    cardFrame:
      'relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-panel-secondary shadow-[0_0_0_1px_var(--color-border)] transition-[box-shadow,translate] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_0_1px_var(--color-border),0_12px_32px_-12px_rgb(0_0_0/0.45)]',
    cardImage:
      'size-full object-contain p-5 opacity-0 transition-[opacity,scale] duration-300 group-hover:scale-[1.03] data-[loaded]:opacity-100',
    badges: 'pointer-events-none absolute inset-x-2 top-2 flex justify-end gap-1',
    badge:
      'rounded-md bg-black/60 px-1.5 py-0.5 text-2xs font-medium text-white tabular-nums backdrop-blur',
    cardBody: 'flex items-start gap-2.5',
    publisherMark: 'mt-0.5 size-5 shrink-0 rounded',
    cardText: 'flex min-w-0 flex-col gap-0.5',
    cardTitle: 'truncate text-sm font-medium group-hover:underline group-hover:underline-offset-2',
    cardMeta: 'truncate text-xs text-muted',
    empty: 'py-16',
    crumbs: 'flex min-w-0 items-center gap-1.5 text-sm text-muted',
    crumbLink: 'hover:text-surface',
    crumbCurrent: 'truncate text-surface',
    document: 'grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]',
    preview:
      'relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-panel-secondary shadow-[0_0_0_1px_var(--color-border)]',
    previewImage:
      'size-full object-contain p-8 opacity-0 transition-opacity duration-300 data-[loaded]:opacity-100',
    aside: 'flex flex-col gap-6 lg:sticky lg:top-20',
    heading: 'flex flex-col gap-3',
    documentTitle: 'text-2xl font-semibold tracking-tight text-balance',
    publisher: 'flex items-center gap-2 text-sm text-muted',
    actions: 'flex flex-col gap-2',
    actionIcon: 'size-4',
    desktopAction: 'max-sm:hidden',
    note: 'text-xs text-pretty text-muted',
    details: 'grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-border py-4 text-sm',
    detailTerm: 'text-muted',
    detailValue: 'text-end',
    versions: 'flex flex-col gap-1',
    sectionTitle: 'text-sm font-medium',
    version:
      'group/version grid grid-cols-[auto_1fr_auto] items-baseline gap-x-2.5 gap-y-0.5 rounded-lg px-2.5 py-2 text-start outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:bg-panel-selected-muted',
    versionDot:
      'size-2 self-center rounded-full border border-muted group-data-[state=checked]/version:border-accent group-data-[state=checked]/version:bg-accent',
    versionName: 'text-sm font-medium',
    versionDate: 'text-xs text-muted tabular-nums',
    versionNotes: 'col-start-2 col-end-4 text-xs text-pretty text-muted',
    more: 'flex flex-col gap-4 border-t border-border pt-10'
  }
} as const
