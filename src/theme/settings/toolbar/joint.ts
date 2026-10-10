/**
 * Where two rows meet in Settings › Toolbar, and where a dragged row lands: a box's divider
 * between rows that share a flyout, the gap between boxes, or nothing at the ends.
 */
export default {
  slots: {
    root: 'relative',
    line: 'pointer-events-none absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent'
  },
  variants: {
    kind: {
      inside: { root: 'h-px bg-border' },
      between: { root: 'h-2' },
      end: { root: 'h-0' }
    }
  }
}
