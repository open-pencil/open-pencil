export default {
  slots: {
    root: 'flex min-h-0 flex-1 overflow-hidden',
    list: 'flex min-w-0 flex-1 flex-col overflow-auto',
    inspector: 'flex shrink-0 flex-col gap-4 overflow-y-auto p-4',
    output: 'flex shrink-0 flex-col border-t border-border',
    header:
      'sticky top-0 z-10 grid items-center gap-3 border-b border-border bg-panel px-4 py-2 text-[11px] font-medium text-muted',
    group: 'px-4 pt-3 pb-1 text-[11px] font-semibold text-muted',
    row: 'grid cursor-pointer items-center gap-3 px-4 py-1.5 text-xs text-surface outline-none transition-colors duration-100 hover:bg-hover data-[highlighted]:bg-hover data-[state=checked]:bg-hover data-[state=checked]:ring-1 data-[state=checked]:ring-accent/40 data-[state=checked]:ring-inset motion-reduce:transition-none',
    name: 'flex min-w-0 flex-col truncate',
    cssName: 'truncate font-mono text-[11px] text-muted',
    value:
      'flex min-w-0 animate-in items-center gap-1.5 truncate font-mono text-[11px] fade-in duration-150 motion-reduce:animate-none',
    expression: 'truncate font-mono text-[11px] text-accent',
    modeHeader: 'flex min-w-0 flex-col gap-0.5',
    modeCondition: 'truncate font-mono text-[10px] font-normal text-muted/80',
    section: 'flex flex-col gap-2',
    sectionTitle: 'text-[11px] font-semibold text-muted',
    field: 'flex flex-col gap-1',
    label: 'text-[11px] text-muted',
    hint: 'text-[10px] text-muted',
    backBar:
      'flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5 text-xs text-surface'
  },
  variants: {
    /** Beside the token list on desktop; the whole panel, behind a back button, on mobile. */
    layout: {
      side: { inspector: 'w-72 border-l border-border', output: 'h-56' },
      full: { inspector: 'min-h-0 w-full flex-1', output: 'min-h-0 flex-1 border-t-0' }
    }
  },
  defaultVariants: { layout: 'side' }
} as const
