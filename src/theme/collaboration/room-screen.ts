import { tv } from 'tailwind-variants'

/**
 * The room tab's screen while its document is on the way, centred like the app's other empty
 * states (`AppPlaceholder`) over the whole tab.
 */
export const roomScreen = tv({
  slots: {
    root: 'absolute inset-0 z-20 flex overflow-y-auto bg-canvas',
    title: 'text-sm font-semibold',
    description: 'mt-1.5 text-balance',
    spinner: 'size-5 animate-spin motion-reduce:animate-none',
    steps:
      'mx-auto flex w-fit list-disc flex-col gap-1 pl-4 text-left text-xs leading-relaxed text-muted',
    othersWaiting: 'mt-3 text-xs text-muted',
    actions: 'flex flex-col items-center gap-3',
    buttons: 'flex items-center justify-center gap-2',
    footnote: 'flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted',
    link: 'text-accent underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none'
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
