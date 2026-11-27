import { focusStyles } from '@open-pencil/theme'

/** The presenter's window: the slide on show, the next one, notes, a timer, and every slide. */
const presenterTheme = {
  slots: {
    root: 'flex h-dvh flex-col bg-canvas text-surface',
    header: 'flex shrink-0 items-center gap-3 border-b border-border bg-panel px-3 py-2',
    title: 'min-w-0 flex-1 truncate text-xs font-semibold',
    meta: 'shrink-0 text-xs text-muted tabular-nums',
    timer: 'shrink-0 font-mono text-sm tabular-nums',
    body: 'grid min-h-0 flex-1 grid-cols-[2fr_1fr] gap-3 p-3',
    stage: 'flex min-h-0 flex-col gap-2',
    current: 'flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black',
    image: 'size-full object-contain',
    controls: 'flex shrink-0 items-center justify-center gap-2',
    side: 'flex min-h-0 flex-col gap-3',
    label: 'text-2xs font-semibold text-muted',
    next: 'flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black text-xs text-muted',
    notesHeader: 'flex items-center gap-1',
    notes: 'min-h-0 flex-1 overflow-y-auto rounded-lg bg-panel p-3 whitespace-pre-wrap',
    empty: 'text-muted',
    strip: 'flex shrink-0 gap-2 overflow-x-auto border-t border-border bg-panel p-2',
    thumb: [
      'relative aspect-video h-16 shrink-0 overflow-hidden rounded border border-border bg-black',
      focusStyles.ring
    ],
    thumbNumber: 'absolute inset-s-1 bottom-0.5 text-3xs text-white drop-shadow',
    message: 'flex flex-1 items-center justify-center text-sm text-muted'
  },
  variants: {
    current: {
      true: { thumb: 'border-accent ring-1 ring-accent' }
    }
  }
}

export default presenterTheme
