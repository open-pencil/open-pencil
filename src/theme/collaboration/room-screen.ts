import { tv } from 'tailwind-variants'

/** The screen a room tab shows instead of its canvas while the room's document is on its way. */
export const roomScreen = tv({
  slots: {
    root: 'absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-canvas p-4',
    card: 'flex w-full max-w-sm flex-col gap-3 rounded-lg border border-border bg-panel p-5 shadow-sm',
    icon: 'size-5 text-muted',
    spinner: 'size-5 animate-spin text-muted motion-reduce:animate-none',
    title: 'text-sm font-semibold text-surface',
    body: 'text-xs leading-relaxed text-muted',
    steps: 'flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-surface',
    hint: 'text-[11px] leading-relaxed text-muted',
    actions: 'mt-1 flex flex-wrap items-center gap-2',
    link: 'text-xs text-accent underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none'
  }
})

/** A note across the top of the canvas, such as after leaving a room. */
export const roomNotice = tv({
  slots: {
    root: 'absolute top-3 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-panel px-3 py-2 shadow-sm',
    icon: 'size-4 shrink-0 text-muted',
    content: 'flex min-w-0 flex-col',
    title: 'text-xs font-medium text-surface',
    description: 'text-[11px] text-muted'
  }
})
