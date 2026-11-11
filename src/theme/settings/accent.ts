import { focusStyles } from '../focus/styles'

/** Accent color swatches in Settings › General › Appearance. */
export default {
  slots: {
    root: 'flex shrink-0 items-center gap-2',
    presets: 'flex items-center gap-2',
    // The chosen swatch is ringed, so focus is an outline clear of that ring.
    swatch: [
      'size-5 shrink-0 cursor-pointer rounded-full border border-black/15 p-0 ring-offset-2 ring-offset-panel transition-shadow data-[state=checked]:ring-2 data-[state=checked]:ring-surface',
      focusStyles.outline
    ],
    custom: [
      'size-5 shrink-0 cursor-pointer rounded-full border border-black/15 p-0 ring-offset-2 ring-offset-panel transition-shadow data-[active=true]:ring-2 data-[active=true]:ring-surface data-[active=false]:bg-[conic-gradient(from_180deg,#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)]',
      focusStyles.outline
    ]
  }
}
