/**
 * Figma's navigation bar: square buttons that show a light square on hover and turn blue for the
 * active view or the open menu. One button is blue at a time: while the menu is open, the active
 * view steps back to a white icon.
 */
const navigationRailTheme = {
  slots: {
    root: 'flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2',
    item: 'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[5px] text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=open]:bg-panel-selected-muted data-[state=open]:text-primary',
    icon: 'size-4',
    separator: 'my-1 h-px w-6 shrink-0 bg-border'
  },
  variants: {
    active: {
      true: {
        item: 'bg-panel-selected-muted text-primary hover:bg-panel-selected-muted hover:text-primary'
      }
    },
    // The active view while the main menu is open: still marked, but no longer blue.
    standby: {
      true: { item: 'text-surface' }
    },
    // The main menu shows the mark at full strength, as Figma shows its logo in white.
    mark: {
      true: { item: 'text-surface', icon: 'size-6' }
    }
  },
  defaultVariants: {
    active: false,
    standby: false,
    mark: false
  }
}

export default navigationRailTheme
