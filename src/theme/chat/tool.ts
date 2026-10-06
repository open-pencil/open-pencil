import { tv } from 'tailwind-variants'

export const chatToolTheme = tv({
  slots: {
    root: 'rounded-lg border border-border bg-canvas',
    trigger:
      'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent',
    status:
      'flex size-4 shrink-0 items-center justify-center rounded-full data-[state=done]:bg-green-500/20 data-[state=done]:text-green-400 data-[state=error]:bg-red-500/20 data-[state=error]:text-red-400 data-[state=pending]:bg-accent/20 data-[state=pending]:text-accent',
    statusIcon: 'size-3',
    name: 'shrink-0 text-[11px] font-medium text-surface',
    summary: 'min-w-0 flex-1 truncate font-mono text-[10px] text-muted',
    chevron:
      'ml-auto size-3 shrink-0 text-muted transition-transform motion-reduce:transition-none [[data-state=open]>&]:rotate-180',
    body: 'space-y-2 border-t border-border px-2 py-2 text-[10px]',
    nodes: 'flex flex-wrap gap-1',
    node: 'inline-flex max-w-40 cursor-pointer items-center gap-1 rounded border border-border bg-input px-1.5 py-0.5 text-[10px] text-surface hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-50 disabled:hover:border-border disabled:hover:text-surface',
    nodeIcon: 'size-3 shrink-0 text-muted',
    nodeLabel: 'truncate',
    image:
      'max-h-56 w-auto max-w-full rounded border border-border bg-[repeating-conic-gradient(var(--color-hover)_0_25%,transparent_0_50%)] bg-size-[12px_12px] object-contain',
    compare:
      'relative w-full max-w-full overflow-hidden rounded border border-border bg-input select-none data-[mode=highlight]:[&>img:first-child]:opacity-40',
    compareImage: 'absolute inset-0 size-full object-contain',
    // `cqw` is the split's width, so each side draws the whole image and its panel crops it.
    compareSplit: '@container absolute inset-0',
    comparePanel: 'relative h-full overflow-hidden',
    compareBefore: 'absolute inset-y-0 left-0 h-full w-[100cqw] max-w-none object-contain',
    compareAfter: 'absolute inset-y-0 right-0 h-full w-[100cqw] max-w-none object-contain',
    compareDivider: 'bg-accent shadow-[0_0_0_1px_rgb(0_0_0/0.25)]',
    compareLabel:
      'pointer-events-none absolute top-1 rounded bg-black/55 px-1 py-px text-[9px] font-medium text-white',
    group: 'rounded-lg border border-dashed border-border',
    groupTrigger:
      'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-muted hover:bg-hover hover:text-surface',
    groupIcon: 'size-3.5 shrink-0 text-accent',
    groupNames: 'min-w-0 flex-1 truncate',
    groupFailed: 'bg-red-500/20 text-red-400',
    groupItems: 'space-y-1.5 px-1.5 pb-1.5'
  }
})
