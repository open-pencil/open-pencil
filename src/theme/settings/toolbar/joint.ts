/**
 * The joint above a row in Settings › Toolbar: a box's divider between rows that share a flyout,
 * the gap between boxes, or nothing at the ends. The link toggle sits in the grips' column,
 * between the grips of the two rows it links.
 */
export default {
  slots: {
    root: 'relative flex items-center gap-2 px-2',
    grip: 'flex w-6 shrink-0 justify-center',
    toggle: 'z-10 size-5 bg-panel',
    line: 'pointer-events-none absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent'
  },
  variants: {
    kind: {
      inside: { root: 'h-px bg-border' },
      between: { root: 'h-2' },
      end: { root: 'h-0' }
    },
    /** An unlinked joint offers its toggle only while the list is in use. */
    linked: {
      false: {
        toggle:
          'opacity-0 group-hover/list:opacity-100 group-focus-within/list:opacity-100 [@media(hover:none)]:opacity-100'
      }
    }
  }
}
