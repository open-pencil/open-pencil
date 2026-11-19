/** A room's state as one line: a dot that is green while others are here, and the words. */
export default {
  slots: {
    root: 'group mb-3 flex items-start gap-2 text-xs leading-snug text-surface',
    dot: 'mt-1 size-2 shrink-0 rounded-full bg-muted group-data-[status=live]:bg-success group-data-[status=connecting]:animate-pulse group-data-[status=looking]:animate-pulse group-data-[status=receiving]:animate-pulse group-data-[status=unreachable]:bg-warning motion-reduce:animate-none'
  }
} as const
