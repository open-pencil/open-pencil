export default {
  slots: {
    root: 'group relative min-w-0',
    // The context menu's trigger: it fills the root, so a right-click anywhere on the entry opens it.
    surface: '',
    trigger:
      'min-w-0 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50',
    preview:
      'flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field transition-colors group-hover:border-panel-focus',
    image: 'size-full object-contain transition-transform duration-200 group-hover:scale-[1.015]',
    fallback: 'size-8 text-muted/40',
    icon: 'size-4 shrink-0 text-primary',
    kind: 'size-3.5 shrink-0',
    body: 'min-w-0 flex-1',
    title: 'flex min-w-0 items-center gap-1.5',
    name: 'block min-w-0 truncate text-xs font-medium',
    status: 'flex shrink-0 items-center gap-1 text-muted',
    metadata: 'mt-0.5 block truncate text-[10px] text-muted',
    trailingMetadata: 'hidden shrink-0 text-[10px] text-muted sm:inline',
    actions: 'flex shrink-0 items-center gap-1',
    // Over an icon button: shown on hover, focus, and while open; always on touch screens.
    menuTrigger:
      'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100'
  },
  variants: {
    kind: {
      design: { kind: 'text-primary' },
      board: { kind: 'text-board', icon: 'text-board' }
    },
    view: {
      grid: {
        body: 'mt-2 block',
        trailingMetadata: 'hidden sm:hidden',
        menuTrigger: 'absolute top-2 right-2 bg-panel/90 shadow-sm'
      },
      list: {
        surface: 'flex items-center border-b border-border group-last:border-b-0 hover:bg-hover',
        trigger: 'flex min-h-14 items-center gap-3 px-3 py-2 sm:min-h-0 sm:px-4 sm:py-3',
        metadata: 'sm:hidden',
        menuTrigger: 'mr-2 sm:mr-3'
      }
    }
  },
  defaultVariants: { view: 'grid' }
} as const
