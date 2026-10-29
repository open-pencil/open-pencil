/** The metrics dashboard: a bar like Cloud's console, then cards on a grid. */
export const metricsDashboardTheme = {
  slots: {
    page: 'chart-theme flex h-full min-h-0 flex-col overflow-hidden bg-canvas text-surface',
    bar: 'flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel px-4',
    barTitle: 'text-xs font-semibold whitespace-nowrap',
    barHost: 'truncate text-[11px] text-muted max-sm:hidden',
    barMeta: 'truncate text-[11px] text-muted max-sm:hidden',
    barEnd: 'ml-auto flex items-center gap-2',
    main: 'min-w-0 flex-1 overflow-y-auto',
    inner:
      'mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 transition-opacity md:px-6 data-[loading=true]:opacity-60',
    tiles: 'grid grid-cols-2 gap-4 lg:grid-cols-4',
    row: 'grid gap-4 lg:grid-cols-2',
    usage: 'flex flex-col gap-4',
    breakdown: 'grid gap-6 md:grid-cols-2',
    sectionLabel: 'mb-2 text-[11px] font-medium text-muted',
    section: 'flex flex-col gap-4',
    sectionHeading: 'mt-2 text-[11px] font-semibold tracking-wide text-muted uppercase'
  }
} as const

/** A bordered panel with a title, an optional note, and its chart or list. */
export const metricsCardTheme = {
  slots: {
    root: 'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-panel p-4',
    header: 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1',
    titleGroup: 'flex min-w-64 flex-1 flex-col gap-0.5',
    title: 'text-xs font-semibold',
    note: 'text-[11px] text-muted',
    aside: 'shrink-0 text-[11px] text-muted tabular-nums'
  }
} as const

/** A headline number above a word-sized trend. */
export const metricsTileTheme = {
  slots: {
    root: 'flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-panel p-4',
    label: 'text-[11px] text-muted',
    value: 'text-2xl font-semibold tabular-nums',
    detail: 'flex flex-wrap items-center gap-x-1 text-[11px] text-muted tabular-nums',
    change: 'font-medium data-[direction=up]:text-success data-[direction=down]:text-error',
    trend: 'mt-2 h-8'
  }
} as const

/** Recent sign-ups, drawn like the Cloud console's lists. */
export const metricsWaitlistTheme = {
  slots: {
    list: 'flex flex-col',
    row: 'flex min-h-9 items-center gap-3 border-b border-border py-1.5 text-xs last:border-b-0',
    domain: 'min-w-0 flex-1 truncate font-medium',
    time: 'shrink-0 text-[11px] text-muted tabular-nums',
    more: 'mt-2',
    status:
      'shrink-0 rounded px-1.5 py-px text-[10px] font-medium data-[confirmed=false]:bg-panel-field data-[confirmed=false]:text-muted data-[confirmed=true]:bg-success/10 data-[confirmed=true]:text-success'
  }
} as const

/** Presets as rows beside a month calendar; the trigger shows the preset and its days. */
export const metricsRangePickerTheme = {
  slots: {
    triggerSpan: 'text-muted tabular-nums max-sm:hidden',
    body: 'flex max-sm:flex-col',
    presets:
      'flex w-40 flex-col gap-0.5 border-r border-border p-1.5 max-sm:w-auto max-sm:border-r-0 max-sm:border-b',
    preset:
      'flex h-7 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-xs outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus data-[selected=true]:font-semibold',
    calendar: 'p-3'
  }
} as const

/** Day 1, 7, and 30 above the retention curve; a day without data yet is a quiet dash. */
export const metricsRetentionTheme = {
  slots: {
    root: 'flex flex-col gap-3',
    stats: 'grid grid-cols-3 gap-4',
    stat: 'flex flex-col gap-0.5',
    statLabel: 'text-[11px] text-muted',
    statValue:
      'flex h-7 items-center text-lg font-semibold tabular-nums data-[empty=true]:text-xs data-[empty=true]:font-normal data-[empty=true]:text-muted'
  }
} as const
