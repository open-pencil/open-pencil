import { tv } from 'tailwind-variants'

import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

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
    group: 'border-b border-border/60 last:border-b-0',
    groupHeader: 'group/header relative flex h-8 items-center pr-2 pl-1.5',
    groupTrigger:
      'group/trigger flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded pr-1 text-left text-[11px] text-surface outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    chevron:
      'size-3 shrink-0 text-muted transition-transform group-data-[state=open]/trigger:rotate-90 motion-reduce:transition-none',
    groupTitle: 'min-w-0 truncate font-semibold',
    groupCount:
      'ml-auto shrink-0 pr-1 text-muted tabular-nums group-focus-within/header:invisible group-hover/header:invisible group-has-[[data-pinned]]/header:invisible',
    groupActions:
      'invisible absolute inset-y-0 right-1.5 flex items-center gap-0.5 group-focus-within/header:visible group-hover/header:visible data-[pinned]:visible',
    textAction:
      'flex h-6 cursor-pointer items-center rounded px-1.5 text-[11px] text-accent outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus',
    groupBody: collapsibleContentMotion,
    rows: 'pb-1',
    row: 'group/row relative flex h-7 w-full cursor-default items-center gap-2 pr-2 pl-7 text-left text-[11px] text-surface outline-none hover:bg-hover focus-visible:bg-hover data-[selected]:bg-panel-selected-muted data-[missing]:text-muted',
    rowIcon: 'size-3 shrink-0 text-muted',
    rowName: 'min-w-0 flex-1 truncate',
    rowTag: 'shrink-0 text-[10px] text-muted',
    rowDetail: 'flex max-w-[50%] min-w-0 shrink items-center gap-1.5 text-muted tabular-nums',
    rowDetailText: 'truncate',
    rowAction:
      'absolute top-1/2 right-1.5 hidden h-5 -translate-y-1/2 cursor-pointer items-center rounded bg-panel px-1.5 text-[11px] text-accent shadow-[0_0_0_1px_var(--color-border)] outline-none group-hover/row:flex group-focus-within/row:flex hover:bg-hover focus-visible:flex focus-visible:ring-1 focus-visible:ring-panel-focus',
    contrastSwatch:
      'flex h-3.5 shrink-0 items-center rounded-[3px] px-[3px] text-[9px] leading-none font-semibold shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]',
    swatch: 'size-2.5 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]',
    more: 'flex h-7 w-full cursor-pointer items-center pl-7 text-left text-[11px] text-accent outline-none hover:bg-hover focus-visible:bg-hover'
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
