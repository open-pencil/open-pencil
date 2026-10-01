import { tv } from 'tailwind-variants'

export const designCheck = tv({
  slots: {
    root: 'flex min-h-0 flex-1 flex-col',
    toolbar: 'flex shrink-0 flex-col gap-2 border-b border-border px-3 pt-2 pb-2',
    toolbarRow: 'flex min-w-0 items-center gap-1',
    filters: 'flex min-w-0 flex-1 items-center gap-0.5',
    filter:
      'flex h-6 cursor-pointer items-center gap-1 rounded px-1.5 text-[11px] text-surface tabular-nums outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus data-[state=off]:text-muted data-[state=off]:[&_svg]:opacity-50',
    list: 'scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-2',
    status: 'px-3 py-2 text-[11px] text-muted',
    // Group slots override the matching AppCollapsible slots.
    group: 'group/issue border-b border-border/60 last:border-b-0',
    groupHeader: 'group/header relative h-8 gap-0 pr-2 pl-1.5',
    groupTrigger:
      'h-7 cursor-pointer gap-1.5 rounded pr-1 text-[11px] focus-visible:ring-1 focus-visible:ring-panel-focus',
    chevron: 'size-3 text-muted',
    groupLabel: 'flex min-w-0 flex-1 items-center gap-1.5',
    groupTitle: 'block min-w-0 truncate font-semibold',
    groupCount:
      'ml-auto shrink-0 pr-1 text-muted tabular-nums group-focus-within/header:invisible group-hover/header:invisible group-data-[menu-open]/issue:invisible',
    groupActions:
      'invisible absolute inset-y-0 right-1.5 flex items-center gap-0.5 group-focus-within/header:visible group-hover/header:visible group-data-[menu-open]/issue:visible',
    rows: 'pb-1',
    rowItem: 'group/row relative',
    row: 'flex h-7 w-full cursor-default items-center gap-2 pr-2 pl-7 text-left text-[11px] text-surface outline-none hover:bg-hover focus-visible:bg-hover data-[selected]:bg-panel-selected-muted data-[missing]:text-muted',
    rowIcon: 'size-3 shrink-0 text-muted',
    rowName: 'min-w-0 flex-1 truncate',
    rowTag: 'shrink-0 text-[10px] text-muted',
    rowDetail: 'flex max-w-[50%] min-w-0 shrink items-center gap-1.5 text-muted tabular-nums',
    rowDetailText: 'truncate',
    rowAction:
      'absolute top-1/2 right-1.5 hidden h-5 -translate-y-1/2 cursor-pointer items-center rounded bg-panel px-1.5 text-accent shadow-[0_0_0_1px_var(--color-border)] outline-none group-focus-within/row:flex group-hover/row:flex hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus',
    contrastSwatch:
      'flex h-3.5 shrink-0 items-center rounded-[3px] px-[3px] text-[9px] leading-none font-semibold shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]',
    swatch: 'size-2.5 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]',
    more: 'mb-1 ml-6'
  }
})

export const severityIcon = tv({
  base: 'size-3 shrink-0',
  variants: {
    severity: {
      error: 'text-issue-error',
      warning: 'text-issue-warning',
      info: 'text-issue-info'
    }
  }
})

/** The Layers panel mark: a severity icon on a layer, a dot on a collapsed layer holding issues. */
export const layerIssueMark = tv({
  slots: {
    root: 'flex size-4 shrink-0 items-center justify-center',
    dot: 'size-1.5 rounded-full'
  },
  variants: {
    severity: {
      error: { dot: 'bg-issue-error' },
      warning: { dot: 'bg-issue-warning' },
      info: { dot: 'bg-issue-info' }
    }
  }
})

/** The page list badge: the count of errors and warnings, in the most severe color. */
export const pageIssueBadge = tv({
  base: 'flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full px-1 text-[9px] leading-none font-semibold tabular-nums',
  variants: {
    severity: {
      error: 'bg-issue-error text-white',
      warning: 'bg-issue-warning text-black'
    }
  }
})

export const issueTooltip = tv({
  slots: {
    content:
      'pointer-events-none z-50 w-64 rounded-lg bg-panel py-1.5 text-[11px] text-surface shadow-[0_0_0_1px_var(--color-border),0_8px_30px_rgb(0_0_0/0.35)]',
    header: 'flex items-center gap-1.5 px-2.5 pt-0.5 pb-1 font-semibold',
    headerIcon: 'size-3 shrink-0 text-muted',
    headerText: 'min-w-0 truncate',
    item: 'flex items-start gap-1.5 px-2.5 py-1',
    itemIcon: 'mt-px',
    itemBody: 'min-w-0 flex-1',
    itemTitle: 'truncate',
    itemDetail: 'truncate text-muted tabular-nums',
    more: 'px-2.5 py-1 pl-7 text-muted',
    hint: 'mt-1 border-t border-border px-2.5 pt-1.5 text-muted'
  }
})
