import { tv } from 'tailwind-variants'

/** A room's state as one line: a dot that is green while others are here, and the words. */
export const roomStatus = tv({
  slots: {
    root: 'group mb-3 flex items-center gap-1.5 text-xs text-surface',
    dot: 'size-2 shrink-0 rounded-full bg-muted group-data-[status=live]:bg-success group-data-[status=joining]:animate-pulse motion-reduce:animate-none'
  }
})
