import { tv } from 'tailwind-variants'

export const chatProfileTheme = tv({
  slots: {
    trigger:
      'min-w-0 max-w-full gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-[10px] text-muted',
    triggerIcon: 'size-3 shrink-0',
    triggerValue: 'min-w-0 truncate',
    triggerChevron: 'size-2.5 shrink-0',
    content: 'w-72 max-w-[calc(100vw-1rem)] overflow-hidden',
    viewport: 'max-h-72 p-1',
    header: 'px-2 pt-1.5 pb-2',
    headerLabel: 'text-[9px] font-medium tracking-wide text-muted uppercase',
    headerDescription: 'mt-0.5 text-[9px] leading-3 text-muted',
    item: 'grid h-auto min-h-11 grid-cols-[14px_minmax(0,1fr)_auto] gap-2 rounded px-2 py-1.5',
    indicator: 'flex size-3.5 shrink-0 items-center justify-center text-accent',
    indicatorIcon: 'size-3',
    text: 'min-w-0',
    name: 'block truncate text-[11px] leading-4 font-medium',
    metadata: 'block truncate text-[9px] leading-3 text-muted',
    capability: 'size-3 shrink-0 text-muted',
    footer:
      'mt-1 flex w-full cursor-pointer items-center gap-1.5 border-t border-border px-2 py-1.5 text-left text-[10px] text-muted hover:bg-hover hover:text-surface',
    footerIcon: 'size-3 shrink-0'
  }
})
