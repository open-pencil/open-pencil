const pageListTheme = {
  slots: {
    panel: 'flex min-h-0 flex-1 flex-col',
    header: 'flex shrink-0 items-center justify-between px-3 py-1.5',
    title: 'text-[11px] font-semibold text-surface',
    add: 'cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    body: 'min-h-0 flex-1 overflow-hidden',
    viewport: 'scrollbar-thin h-full overflow-x-hidden overflow-y-auto px-1 pb-1',
    row: 'relative cursor-grab active:cursor-grabbing',
    dropIndicator: 'pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent',
    renameRow: 'flex w-full items-center gap-1.5 rounded px-2 py-1.5',
    icon: 'size-3 shrink-0 opacity-70',
    renameInput:
      'min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-[11px] text-surface outline-none',
    divider: 'my-1 flex cursor-pointer items-center px-2',
    dividerLine: 'h-px flex-1 bg-border',
    item: 'flex w-full cursor-pointer items-center gap-1.5 rounded border-none px-2 py-1.5 text-left text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    label: 'truncate'
  },
  variants: {
    active: {
      true: { item: 'bg-hover text-surface' },
      false: { item: 'bg-transparent text-muted hover:bg-hover hover:text-surface' }
    },
    dragging: {
      true: { row: 'opacity-60' },
      false: {}
    },
    dropPosition: {
      before: { dropIndicator: 'top-0' },
      after: { dropIndicator: 'bottom-0' }
    }
  },
  defaultVariants: {
    active: false,
    dragging: false
  }
}

export type PageListTheme = typeof pageListTheme
export default pageListTheme
