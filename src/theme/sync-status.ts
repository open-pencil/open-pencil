/**
 * Sync status chip.
 *
 * Only `degraded` and `failing` carry an alarm colour, and both mean *you asked
 * for sync and are not getting it*. `local` is deliberately grey: a permanent
 * orange dot for a configuration the user chose is alarm fatigue, and it trains
 * people to ignore the colour that signals a real failure.
 */
const syncStatusTheme = {
  slots: {
    chip: 'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] leading-none text-muted',
    // Fixed 10px slot so the dot and the spinner occupy the same footprint and
    // the label does not shift when one replaces the other.
    indicator: 'flex size-2.5 shrink-0 items-center justify-center',
    dot: 'size-1.5 rounded-full',
    // Ambient, not attention-seeking: same colour as the surrounding text, and
    // slower than Tailwind's 1s default so it reads as background activity.
    spinner: 'size-2.5 animate-spin [animation-duration:1.6s] text-muted',
    label: 'truncate'
  },
  variants: {
    indicator: {
      local: { dot: 'bg-muted/60' },
      synced: { dot: 'bg-[var(--color-success)]' },
      // No dot: `syncing` is only reported once the spinner is on screen, so
      // the spinner occupies the indicator slot for the whole of this state.
      syncing: {},
      degraded: { dot: 'bg-[var(--color-warning-action)]' },
      failing: { dot: 'bg-[var(--color-error)]' }
    },
    actionable: {
      true: { chip: 'cursor-pointer hover:bg-hover hover:text-surface' },
      false: { chip: 'cursor-default' }
    }
  },
  defaultVariants: {
    indicator: 'local' as const,
    actionable: false
  }
}

export type SyncStatusTheme = typeof syncStatusTheme
export default syncStatusTheme
