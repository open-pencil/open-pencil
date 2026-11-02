/** The collection, token, and selection inspectors beside or over the token list. */
export default {
  slots: {
    root: 'flex shrink-0 flex-col gap-4 overflow-y-auto p-4',
    section: 'flex flex-col gap-2',
    title: 'text-[11px] font-semibold text-muted',
    label: 'text-[11px] text-muted',
    hint: 'text-[10px] text-muted',
    error: 'text-[10px] text-error',
    /** One mode's value, under the mode's name when there are several. */
    value: 'flex flex-col gap-1',
    /** The fixed `--` in front of a CSS name the user types. */
    prefix: 'font-mono text-xs text-muted',
    /** A scope's checkbox and name, only as wide as they are, so a click beside them toggles nothing. */
    scope: 'flex w-fit items-center gap-2 text-xs text-surface',
    /** A mode's value control beside the button that points it at a variable. */
    valueRow: 'flex items-center gap-1 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1',
    valueControl: 'flex min-h-7 min-w-0 items-center gap-1.5',
    /** One mode in the collection inspector: its name, when it applies, and the CSS it writes. */
    mode: 'flex flex-col gap-1.5 border-b border-border pb-3 last:border-b-0 last:pb-0',
    /** The CSS a mode is written under, wrapped rather than cut so it reads in full. */
    modeCSS: 'font-mono text-[11px] break-all text-muted'
  },
  variants: {
    /** Beside the token list on desktop; the whole panel, behind a back button, on mobile. */
    layout: {
      side: { root: 'w-72 border-l border-border @6xl/tokens:w-80' },
      full: { root: 'min-h-0 w-full flex-1' }
    }
  },
  defaultVariants: { layout: 'side' }
} as const
