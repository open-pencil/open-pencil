const panelGridTheme = {
  base: [
    'flex min-w-0 items-end gap-1.5',
    '[&>[data-slot=fields]]:grid [&>[data-slot=fields]]:min-w-0 [&>[data-slot=fields]]:flex-1 [&>[data-slot=fields]]:items-end [&>[data-slot=fields]]:gap-1.5',
    '[&>[data-slot=actions]]:flex [&>[data-slot=actions]]:h-6 [&>[data-slot=actions]]:min-w-[26px] [&>[data-slot=actions]]:shrink-0 [&>[data-slot=actions]]:items-center [&>[data-slot=actions]]:justify-end [&>[data-slot=actions]]:gap-0.5',
    '[&>[data-slot=actions]_[data-slot=icon-button]]:size-6 [&>[data-slot=actions]_[data-slot=icon-button]]:rounded'
  ],
  variants: {
    columns: {
      1: '[&>[data-slot=fields]]:grid-cols-1',
      2: '[&>[data-slot=fields]]:grid-cols-2',
      3: '[&>[data-slot=fields]]:grid-cols-3'
    },
    distribution: {
      equal: '',
      'wide-first': '[&>[data-slot=fields]]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]'
    }
  },
  defaultVariants: {
    columns: 1 as const,
    distribution: 'equal' as const
  }
}

export type PanelGridTheme = typeof panelGridTheme
export default panelGridTheme
