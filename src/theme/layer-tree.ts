import { focusStyles } from '@open-pencil/theme'

const layerTreeTheme = {
  slots: {
    // No padding here: scrolled names would show through it beside the buttons pinned to the edge.
    viewport: 'h-full overflow-auto text-2xs',
    row: 'group/row relative flex w-full cursor-pointer items-center gap-1 rounded border-none bg-panel text-start text-2xs text-surface hover:bg-hover',
    // Everything before the buttons, indented by depth. The indent is here and not on the row,
    // since a sticky part stays inside its row's padding and the buttons must reach the edge.
    content: 'flex h-full min-w-0 flex-1 items-center gap-1',
    disclosure:
      'flex w-4 shrink-0 cursor-pointer items-center justify-center text-current transition-transform',
    disclosurePlaceholder: 'w-4 shrink-0',
    icon: 'size-3 shrink-0',
    label: 'flex min-w-0 flex-1 items-center gap-1.5',
    name: 'min-w-0 truncate',
    modeBadge:
      'relative flex shrink-0 items-center overflow-hidden rounded-full border border-current/40 px-1.5 text-3xs leading-3.5',
    modeFull: 'flex w-max shrink-0 items-center whitespace-nowrap',
    moreModes: 'shrink-0 ps-1 opacity-70',
    // The issue mark and buttons stay at the panel's edge however far the rows scroll sideways.
    // While they show, they sit on the row's own background so a long name runs under them.
    trailing: 'sticky inset-e-0 flex shrink-0 items-center gap-1 pe-1',
    actions: 'flex shrink-0 items-center gap-0.5',
    action: [
      'flex size-4 items-center justify-center rounded text-current hover:bg-white/15',
      focusStyles.ring
    ],
    actionIcon: 'size-3',
    dropIndicator: 'pointer-events-none absolute bg-accent',
    renameRow: 'group/row relative flex w-full items-center pe-1 text-2xs text-surface',
    renameIcon: 'size-3 shrink-0 opacity-70',
    renameInput:
      'min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-2xs text-surface outline-none'
  },
  variants: {
    selected: {
      true: { row: 'bg-panel-selected text-on-accent hover:bg-panel-selected' },
      false: { row: 'bg-panel text-surface hover:bg-hover' }
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
      false: {}
    },
    component: {
      true: { icon: 'text-component opacity-100' },
      false: { icon: 'opacity-70' }
    },
    slot: {
      true: { icon: 'text-slot opacity-100', label: 'text-slot' },
      false: {}
    },
    expanded: {
      // Mirrored, the chevron points left and turns the other way to point down when open.
      true: { disclosure: 'rotate-90 rtl:-rotate-90' },
      false: { disclosure: 'rotate-0' }
    },
    compactModes: {
      true: { modeFull: 'invisible absolute inset-e-0 top-0' },
      false: {}
    },
    trailingShown: {
      true: { trailing: 'bg-inherit' },
      false: { trailing: 'group-focus-within/row:bg-inherit group-hover/row:bg-inherit' }
    },
    actionsVisible: {
      true: {},
      false: {
        actions:
          'pointer-events-none absolute inset-e-1 opacity-0 group-hover/row:pointer-events-auto group-hover/row:static group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:static group-focus-within/row:opacity-100'
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
      focused: true,
      class: { icon: 'text-on-accent opacity-100' }
    },
    {
      selected: true,
      focused: false,
      class: { row: 'bg-panel-selected-muted text-surface hover:bg-panel-selected-muted' }
    },
    // A hidden layer dims while its name still reads at 4.5:1. Once selected, fading the row would
    // fade its highlight too, so only the icon dims.
    { visible: false, selected: false, class: { row: 'opacity-65' } },
    { visible: false, selected: true, class: { icon: 'opacity-50' } }
  ],
  defaultVariants: {
    selected: false,
    focused: false,
    dragging: false,
    visible: true,
    component: false,
    slot: false,
    expanded: false,
    actionsVisible: true,
    trailingShown: true,
    actionActive: false,
    childDropTarget: false,
    compactModes: false
  }
}

export type LayerTreeTheme = typeof layerTreeTheme
export default layerTreeTheme
