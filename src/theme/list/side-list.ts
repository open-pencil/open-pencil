import { tv } from 'tailwind-variants'

/** A side list of places, drawn like the editor's Pages panel: headings, 24px rows, hover selection. */
export const sideList = tv({
  slots: {
    root: 'flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-panel pb-2',
    group: 'flex flex-col',
    header: 'flex h-8 shrink-0 items-center justify-between pr-1.5 pl-3',
    title: 'text-[11px] font-semibold text-surface',
    items: 'flex flex-col px-1 pb-1',
    item: 'group flex h-6 w-full cursor-pointer items-center gap-1.5 rounded border-none bg-transparent px-2 text-left text-[11px] text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus data-[active=true]:bg-hover data-[active=true]:text-surface',
    icon: 'size-3 shrink-0 opacity-70',
    label: 'min-w-0 flex-1 truncate',
    trailing: 'flex shrink-0 items-center gap-1.5 text-[10px] text-muted tabular-nums',
    attention: 'size-3 text-warning-text'
  }
})
