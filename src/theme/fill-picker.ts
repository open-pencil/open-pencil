import { focusStyles } from '@open-pencil/theme'

const fillPickerTheme = {
  slots: {
    tab: [
      'flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 text-muted transition-colors',
      focusStyles.ring
    ],
    barStop: [
      'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-sm border-2 border-white/60 shadow-sm data-[dragging]:cursor-grabbing',
      focusStyles.ring
    ],
    listStop: 'flex items-center gap-1 py-0.5',
    adjustment: 'flex h-7 items-center gap-2',
    adjustmentLabel: 'w-20 shrink-0 truncate text-xs text-surface',
    adjustmentSlider: 'relative mx-1.75 flex h-3.5 flex-1 touch-none items-center select-none',
    adjustmentTrack:
      'absolute inset-y-0 -inset-x-1.75 rounded-full border border-border bg-panel-secondary',
    adjustmentRange: 'absolute inset-y-0 rounded-full bg-accent',
    adjustmentOrigin: 'absolute top-1/2 left-1/2 size-1 -translate-1/2 rounded-full bg-white',
    adjustmentThumb: [
      'relative block size-3.5 rounded-full bg-white shadow-sm after:absolute after:inset-1 after:rounded-full',
      focusStyles.ringStrong
    ]
  },
  variants: {
    active: {
      true: {
        tab: 'bg-hover text-surface',
        barStop: 'border-white',
        listStop: 'rounded bg-hover/50'
      },
      false: {
        tab: 'hover:bg-hover hover:text-surface'
      }
    },
    dragging: {
      true: { barStop: 'cursor-grabbing' },
      false: {}
    },
    adjusted: {
      true: { adjustmentThumb: 'after:bg-accent' },
      false: {}
    }
  },
  defaultVariants: {
    active: false,
    dragging: false,
    adjusted: false
  }
}

export type FillPickerTheme = typeof fillPickerTheme
export default fillPickerTheme
