/** Where the library is saved, on the start page: a pill that turns green while storage syncs it. */
const libraryStatusTheme = {
  slots: {
    root: 'inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
    icon: 'size-3.5 shrink-0',
    label: 'min-w-0 truncate'
  },
  variants: {
    state: {
      local: { root: 'border-border text-muted' },
      synced: { root: 'border-success/40 bg-success/10 text-success' },
      syncing: {
        root: 'border-accent/40 bg-accent/10 text-accent',
        icon: 'animate-spin motion-reduce:animate-none'
      },
      offline: { root: 'border-warning-action/40 bg-warning-action/10 text-warning-action' },
      error: { root: 'border-error/40 bg-error/10 text-error' },
      conflict: { root: 'border-warning-action/40 bg-warning-action/10 text-warning-action' }
    }
  },
  defaultVariants: { state: 'local' as const }
}

export type LibraryStatusTheme = typeof libraryStatusTheme
export default libraryStatusTheme
