/**
 * The community gallery's pages: a header with the server's mark, a grid of files whose previews
 * lead, and a file's page with its preview beside what it is and how to open it.
 */
export default {
  slots: {
    page: 'flex h-full min-h-0 flex-col overflow-y-auto bg-canvas text-surface',
    header: 'mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pt-8 sm:px-8',
    mark: 'size-8 rounded-lg',
    headerTitle: 'text-sm font-semibold',
    headerLink: 'ms-auto text-sm text-muted hover:text-surface hover:underline',
    main: 'mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pt-10 pb-16 sm:px-8',
    intro: 'flex flex-col gap-2',
    title: 'text-2xl font-semibold text-balance',
    description: 'max-w-xl text-sm text-pretty text-muted',
    grid: 'grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3',
    card: 'group flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent',
    cardPreview:
      'aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-panel transition-colors group-hover:border-accent/60',
    previewImage: 'size-full object-contain',
    cardText: 'flex flex-col gap-0.5',
    cardTitle: 'truncate text-sm font-medium',
    cardMeta: 'text-xs text-muted',
    back: 'inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-surface',
    document: 'grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]',
    documentPreview: 'aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-panel',
    aside: 'flex flex-col gap-6',
    actions: 'flex flex-col gap-2',
    desktopAction: 'max-sm:hidden',
    note: 'text-xs text-pretty text-muted',
    versions: 'flex flex-col gap-2',
    versionsTitle: 'text-sm font-medium',
    version:
      'flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2 text-start outline-none hover:bg-panel focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent/5',
    versionName: 'text-sm',
    versionMeta: 'text-xs text-pretty text-muted'
  }
} as const
