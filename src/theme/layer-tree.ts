const layerTreeTheme = {
  slots: {
    viewport: 'scrollbar-thin h-full overflow-y-auto px-1',
    row: 'group/row relative flex w-full cursor-pointer items-center gap-1 rounded border-none bg-transparent py-1.5 pr-1 text-left text-[11px] text-surface hover:bg-hover',
    disclosure:
      'flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface',
    disclosurePlaceholder: 'w-4 shrink-0',
    icon: 'size-3 shrink-0',
    label: 'min-w-0 flex-1 truncate',
    actions: 'flex shrink-0 items-center gap-0.5',
    action:
      'flex size-4 items-center justify-center rounded text-current outline-none hover:bg-white/15 focus-visible:ring-1 focus-visible:ring-panel-focus',
    actionIcon: 'size-3',
    dropIndicator: 'pointer-events-none absolute bg-accent',
    renameRow: 'flex w-full items-center gap-1 py-1',
    renameIcon: 'size-3 shrink-0 opacity-70',
    renameInput:
      'min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-[11px] text-surface outline-none'
  },
  variants: {
    selected: {
      true: { row: 'bg-panel-selected text-surface hover:bg-panel-selected' },
      false: { row: 'bg-transparent text-surface hover:bg-hover' }
    },
    focused: {
      true: {},
      false: {}
    },
    dragging: {
      true: { row: 'opacity-30' },
      false: {}
    },
    visible: {
      true: {},
      false: { row: 'opacity-50' }
    },
    component: {
      true: { icon: 'text-component opacity-100' },
      false: { icon: 'opacity-70' }
    },
    expanded: {
      true: { disclosure: 'rotate-90' },
      false: { disclosure: 'rotate-0' }
    },
    actionsVisible: {
      true: {},
      false: {
        actions: 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100'
      }
    },
    actionActive: {
      true: { actionIcon: 'opacity-100' },
      false: {
        actionIcon: 'opacity-0 group-hover/row:opacity-70 group-focus-within/row:opacity-70'
      }
    },
    childDropTarget: {
      true: {
        row: 'bg-accent/15 text-surface'
      },
      false: {}
    },
    dropPosition: {
      child: {
        dropIndicator: 'inset-y-1 rounded border border-accent bg-accent/10'
      },
      above: { dropIndicator: 'top-0 h-0.5' },
      below: { dropIndicator: 'bottom-0 h-0.5' }
    }
  },
  compoundVariants: [
    {
      selected: true,
      focused: false,
      class: { row: 'bg-panel-selected-muted text-surface hover:bg-panel-selected-muted' }
    }
  ],
  defaultVariants: {
    selected: false,
    focused: false,
    dragging: false,
    visible: true,
    component: false,
    expanded: false,
    actionsVisible: true,
    actionActive: false,
    childDropTarget: false
  }
}

export type LayerTreeTheme = typeof layerTreeTheme
export default layerTreeTheme
