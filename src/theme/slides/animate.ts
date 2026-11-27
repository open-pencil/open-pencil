import { focusStyles } from '@open-pencil/theme'

/** The Animate tab of a deck: a slide's transition, and the steps of its build. */
const animateTheme = {
  slots: {
    root: 'flex min-h-0 flex-1 flex-col overflow-y-auto',
    pick: 'px-3 py-6 text-center text-2xs text-muted',
    fields: 'flex flex-col gap-1.5',
    empty: 'text-2xs text-muted',
    steps: 'flex flex-col gap-1',
    step: [
      'flex w-full items-center gap-2 rounded px-1.5 py-1 text-start text-xs hover:bg-hover aria-pressed:bg-accent/15',
      focusStyles.ring
    ],
    stepNumber: 'w-4 shrink-0 text-end text-3xs text-muted tabular-nums',
    stepName: 'min-w-0 flex-1 truncate',
    stepSummary: 'shrink-0 text-2xs text-muted',
    editor: 'mt-2 flex flex-col gap-1.5',
    actions: 'flex items-center justify-end gap-1'
  }
}

export default animateTheme
