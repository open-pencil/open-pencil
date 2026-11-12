import { focusStyles } from '../focus/styles'

/** The metrics dashboard: a bar like Cloud's console, then cards on a grid. */
export const metricsDashboardTheme = {
  slots: {
    page: 'chart-theme flex h-full min-h-0 flex-col overflow-hidden bg-canvas text-surface',
    bar: 'flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel px-4',
    barHost: 'truncate text-2xs text-muted max-sm:hidden',
    barMeta: 'truncate text-2xs text-muted max-sm:hidden',
    barEnd: 'ms-auto flex items-center gap-2',
    main: 'min-w-0 flex-1 overflow-y-auto',
    inner:
      'mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 transition-opacity md:px-6 data-[loading=true]:opacity-60',
    tiles: 'grid grid-cols-2 gap-4 lg:grid-cols-4',
    row: 'grid gap-4 lg:grid-cols-2',
    usage: 'flex flex-col gap-4',
    breakdown: 'grid gap-6 md:grid-cols-2',
    sectionLabel: 'mb-2 text-2xs font-medium text-muted',
    section: 'flex flex-col gap-4',
    sectionHeading: 'mt-2 text-2xs font-semibold tracking-wide text-muted uppercase'
  }
} as const

/** A bordered panel with a title, an optional note, and its chart or list. */
export const metricsCardTheme = {
  slots: {
    root: 'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-panel p-4',
    header: 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1',
    titleGroup: 'flex min-w-64 flex-1 flex-col gap-0.5',
    title: 'text-xs font-semibold',
    note: 'text-2xs text-muted',
    aside: 'shrink-0 text-2xs text-muted tabular-nums'
  }
} as const

/** A headline number above a word-sized trend. */
export const metricsTileTheme = {
  slots: {
    root: 'flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-panel p-4',
    label: 'text-2xs text-muted',
    value: 'text-2xl font-semibold tabular-nums',
    detail: 'flex flex-wrap items-center gap-x-1 text-2xs text-muted tabular-nums',
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
    time: 'shrink-0 text-2xs text-muted tabular-nums',
    more: 'mt-2',
    status:
      'shrink-0 rounded px-1.5 py-px text-3xs font-medium data-[confirmed=false]:bg-panel-field data-[confirmed=false]:text-muted data-[confirmed=true]:bg-success/10 data-[confirmed=true]:text-success'
  }
} as const

/** The busiest networks as a compact table: AS number, operator, share, and pings. */
export const metricsNetworksTheme = {
  slots: {
    table: 'w-full table-fixed text-xs',
    row: 'h-9 border-b border-border last:border-b-0 [&>th]:h-7 [&>th]:text-2xs [&>th]:font-normal [&>th]:text-muted',
    asn: 'w-16 text-start text-muted tabular-nums',
    name: 'truncate pe-3 text-start font-medium',
    number: 'w-16 text-end tabular-nums'
  }
} as const

/** Presets as rows beside a month calendar; the trigger shows the preset and its days. */
export const metricsRangePickerTheme = {
  slots: {
    triggerSpan: 'text-muted tabular-nums max-sm:hidden',
    body: 'flex max-sm:flex-col',
    presets:
      'flex w-40 flex-col gap-0.5 border-e border-border p-1.5 max-sm:w-auto max-sm:border-e-0 max-sm:border-b',
    preset: [
      'flex h-7 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-xs hover:bg-hover data-[selected=true]:font-semibold',
      focusStyles.ring
    ],
    calendar: 'p-3'
  }
} as const

/** Day 1, 7, and 30 above the retention curve; a day without data yet is a quiet dash. */
export const metricsRetentionTheme = {
  slots: {
    root: 'flex flex-col gap-3',
    stats: 'grid grid-cols-3 gap-4',
    stat: 'flex flex-col gap-0.5',
    statLabel: 'text-2xs text-muted',
    statValue:
      'flex h-7 items-center text-lg font-semibold tabular-nums data-[empty=true]:text-xs data-[empty=true]:font-normal data-[empty=true]:text-muted'
  }
} as const

/**
 * The report inbox: reports listed on the left, the one chosen read and triaged on the right, like
 * a mail client. Below `md` one pane shows at a time.
 */
export const metricsInboxTheme = {
  slots: {
    root: 'grid h-[calc(100dvh-9rem)] min-h-[28rem] overflow-hidden rounded-lg border border-border bg-panel md:grid-cols-[minmax(17rem,22rem)_1fr]',
    listPane: 'flex min-h-0 flex-col border-border md:border-e data-[hidden=true]:max-md:hidden',
    toolbar: 'flex flex-col gap-2 border-b border-border p-3',
    list: 'min-h-0 flex-1 overflow-y-auto outline-none',
    item: 'flex w-full cursor-pointer items-start gap-3 border-b border-border px-3 py-2.5 text-start hover:bg-hover/50 data-[selected=true]:bg-hover data-[selected=true]:shadow-[inset_2px_0_0_var(--color-accent)]',
    itemIcon: 'mt-0.5 size-4 shrink-0 text-muted',
    itemBody: 'flex min-w-0 flex-1 flex-col gap-0.5',
    itemTitle: 'truncate text-xs font-medium text-surface',
    itemMeta: 'flex min-w-0 items-center gap-1.5 text-2xs text-muted',
    itemSender: 'truncate',
    statusDot:
      'size-1.5 shrink-0 rounded-full data-[status=open]:bg-warning data-[status=replied]:bg-success data-[status=closed]:bg-muted',
    listEmpty: 'flex flex-1 items-center justify-center p-6',
    detailPane: 'flex min-h-0 flex-col data-[hidden=true]:max-md:hidden'
  }
} as const

/**
 * One report as an issue tracker shows one: a header with what it is and what to do with it, the
 * evidence in the main column, and facts about the sender and their build in a properties column.
 */
export const metricsReportTheme = {
  slots: {
    header: 'flex shrink-0 items-start gap-3 border-b border-border px-5 py-3',
    headerIcon: 'mt-1 size-4 shrink-0 data-[kind=error]:text-error data-[kind=problem]:text-muted',
    headerText: 'flex min-w-0 flex-1 flex-col gap-0.5',
    title: 'line-clamp-2 text-sm font-semibold text-surface',
    subtitle: 'text-2xs text-muted',
    actions: 'flex shrink-0 items-center gap-1',
    body: 'min-h-0 flex-1 overflow-y-auto',
    columns: 'grid gap-0 lg:grid-cols-[1fr_15rem]',
    main: 'flex min-w-0 flex-col gap-6 px-5 py-5',
    aside: 'flex flex-col gap-4 border-border px-5 py-5 lg:border-s max-lg:border-t',
    section: 'flex flex-col gap-2',
    sectionTitle: 'flex items-center gap-2 text-2xs font-medium text-muted',
    message: 'text-sm leading-relaxed whitespace-pre-wrap text-surface',
    properties: 'grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2.5 text-2xs',
    propertyLabel: 'text-muted',
    propertyValue: 'min-w-0 break-words text-surface',
    mono: 'font-mono',
    links: 'flex flex-col gap-1.5 text-2xs',
    link: 'inline-flex w-fit items-center gap-1 text-primary underline-offset-2 hover:underline',
    document: 'flex items-center gap-4 rounded-md border border-border p-3',
    thumbnail: 'h-20 w-32 shrink-0 rounded border border-border bg-canvas object-contain',
    documentText: 'flex min-w-0 flex-1 flex-col gap-0.5 text-xs',
    documentActions: 'flex shrink-0 items-center gap-1',
    note: 'text-2xs text-muted',
    alert: 'mx-5 mt-4'
  }
} as const

/** An error report's exception: what was thrown, then its frames with the app's own leading. */
export const metricsExceptionTheme = {
  slots: {
    root: 'flex flex-col gap-2',
    head: 'flex items-start gap-3',
    heading: 'flex min-w-0 flex-1 flex-col gap-0.5',
    cause: 'text-2xs font-medium text-muted',
    type: 'text-sm font-semibold text-surface',
    message: 'text-sm break-words text-surface',
    tags: 'flex flex-wrap items-center gap-1.5 pt-1',
    tag: 'rounded border border-border px-1.5 py-px text-2xs text-muted',
    unhandled: 'rounded bg-error/10 px-1.5 py-px text-2xs font-medium text-error',
    frames: 'flex flex-col overflow-hidden rounded-md border border-border',
    frame:
      'relative flex flex-col gap-0.5 border-b border-border px-3 py-2 last:border-b-0 data-[threw=true]:bg-error/5',
    threw: 'absolute inset-y-0 inset-s-0 w-0.5 bg-error',
    function: 'font-mono text-xs font-semibold break-all text-surface',
    path: 'font-mono text-2xs break-all text-muted',
    file: 'text-surface',
    library: 'flex flex-col border-b border-border bg-hover/50 last:border-b-0',
    libraryFrame: 'flex flex-wrap gap-x-2 px-3 py-1 font-mono text-2xs text-muted',
    folded:
      'flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-start text-2xs text-muted hover:text-surface',
    footer: 'text-2xs text-muted'
  }
} as const

/** What the app recorded before a report: when, how serious, what, and what it noted. */
export const metricsStepsTheme = {
  slots: {
    title: 'text-2xs font-medium text-muted',
    root: 'flex flex-col overflow-hidden rounded-md border border-border',
    step: 'border-b border-border last:border-b-0 data-[level=error]:bg-error/5 data-[level=warning]:bg-warning/5',
    row: 'grid w-full cursor-pointer grid-cols-[4.5rem_1rem_minmax(0,1fr)_auto] items-baseline gap-x-2 px-3 py-1.5 text-start font-mono text-2xs hover:bg-hover/50 disabled:cursor-default disabled:hover:bg-transparent',
    when: 'text-muted tabular-nums',
    level: 'text-muted data-[level=error]:text-error data-[level=warning]:text-warning',
    name: 'truncate text-surface',
    category: 'font-sans text-3xs text-muted',
    attributes:
      'grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1 px-3 pb-2 ps-[6.5rem] font-mono text-2xs',
    attributeKey: 'truncate text-muted',
    attributeValue: 'break-all text-surface',
    empty: 'text-2xs text-muted'
  }
} as const
