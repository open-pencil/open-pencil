export default {
  slots: {
    root: 'flex shrink-0 flex-col border-t border-border',
    title: 'text-2xs font-semibold text-muted',
    // The title folds the stylesheet away, leaving the list the height it gave up.
    toggle:
      'flex cursor-pointer items-center gap-1 rounded outline-none hover:text-surface focus-visible:text-surface',
    chevron:
      'size-3 shrink-0 transition-transform motion-reduce:transition-none data-[open]:rotate-90'
  },
  variants: {
    /** Under the token list on desktop; the whole panel, behind a back button, on mobile. */
    layout: {
      side: { root: 'h-56' },
      full: { root: 'min-h-0 flex-1 border-t-0' }
    },
    folded: { true: { root: 'h-auto' }, false: {} }
  },
  defaultVariants: { layout: 'side', folded: false }
} as const
