export default {
  slots: {
    root: 'flex shrink-0 flex-col border-t border-border',
    title: 'text-[11px] font-semibold text-muted'
  },
  variants: {
    /** Under the token list on desktop; the whole panel, behind a back button, on mobile. */
    layout: {
      side: { root: 'h-56' },
      full: { root: 'min-h-0 flex-1 border-t-0' }
    }
  },
  defaultVariants: { layout: 'side' }
} as const
