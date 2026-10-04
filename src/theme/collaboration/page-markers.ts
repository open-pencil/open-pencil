import { tv } from 'tailwind-variants'

/** Who works on a page: a dot per person, a sparkle per agent, then "+N". */
export const pageMarkers = tv({
  slots: {
    root: 'flex shrink-0 items-center gap-1',
    person: 'size-2 rounded-full',
    agent: 'size-3',
    overflow: 'text-[9px] leading-none text-muted'
  }
})
