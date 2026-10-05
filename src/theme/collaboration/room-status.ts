import { tv } from 'tailwind-variants'

/** A room's state as one line: a dot that is green while others are here, and the words. */
export const roomStatus = tv({
  slots: {
    root: 'group mb-3 flex items-start gap-2 text-xs leading-snug text-surface',
    dot: 'mt-1 size-2 shrink-0 rounded-full bg-muted group-data-[status=live]:bg-success group-data-[status=joining]:animate-pulse motion-reduce:animate-none'
  }
})
