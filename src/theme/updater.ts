import { tv } from 'tailwind-variants'

export const updatePromptTheme = tv({
  slots: {
    root: 'flex h-full flex-col bg-panel text-surface select-none',
    main: 'flex min-h-0 flex-1 gap-4 px-5 pt-5 pb-4',
    icon: 'size-14 shrink-0',
    content: 'flex min-w-0 flex-1 flex-col',
    alert: 'mb-3',
    title: 'text-sm font-semibold text-surface',
    subtitle: 'mt-0.5 text-xs text-muted',
    notesHeader: 'mt-4 mb-1.5 flex items-baseline justify-between gap-3',
    notesLabel: 'text-xs font-semibold text-surface',
    notes:
      'min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-input px-3.5 py-3 select-text',
    empty: 'text-xs text-muted',
    spinner: 'size-4 text-muted',
    footer: 'flex min-h-14 shrink-0 items-center gap-2 border-t border-border px-5 py-3',
    progress: 'flex-1',
    actions: 'ms-auto flex items-center gap-2'
  }
})

/** AppPlaceholder overrides for the states without a release: a large app icon over the title. */
export const updateStatusUI = {
  icon: 'mb-3 size-16 rounded-none bg-transparent',
  label: 'text-sm font-semibold',
  body: 'mt-4 flex flex-col items-center gap-2 text-xs text-muted',
  content: 'max-w-sm'
}
