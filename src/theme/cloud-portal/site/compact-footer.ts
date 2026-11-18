/** A self-hosted site's footer: the operator's links on one line, what it runs on the other. */
export default {
  slots: {
    root: 'mt-auto border-t border-border/60',
    inner:
      'mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6',
    line: 'flex flex-wrap items-center gap-x-4 gap-y-1 text-sm',
    operator: 'font-medium text-surface',
    poweredBy: 'flex items-center gap-1.5',
    poweredMark: 'size-3.5'
  }
} as const
