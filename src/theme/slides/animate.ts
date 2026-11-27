/** The Animate tab of a deck: a slide's transition, and the steps of its build. */
const animateTheme = {
  slots: {
    root: 'flex min-h-0 flex-1 flex-col overflow-y-auto',
    pick: 'px-3 py-6 text-center text-2xs text-muted',
    empty: 'text-2xs text-muted',
    steps: '-mx-1.5 flex flex-col',
    // A step's row, as an effect's; the selected layer's row is filled as a selected layer's is.
    // The step Play is animating lights up, so the build can be followed in the list.
    step: 'group/step relative rounded px-1.5 transition-colors data-dragging:opacity-50 data-selected:bg-accent/15 data-playing:bg-accent/25',
    drop: 'pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent',
    styleIcon: 'size-3 text-muted group-data-playing/step:text-accent',
    stepLabel:
      'flex h-6 min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-start text-xs',
    stepNumber: 'w-3 shrink-0 text-end text-3xs text-muted tabular-nums',
    stepName: 'min-w-0 shrink truncate text-surface',
    stepSummary: 'shrink-0 truncate text-muted',
    chain: 'flex size-6 shrink-0 items-center justify-center text-muted',
    remove:
      'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:bg-hover hover:text-surface'
  }
}

export default animateTheme
