const placeholderTheme = {
  slots: {
    root: 'flex min-h-0 w-full items-center justify-center text-center',
    content: 'flex max-w-sm flex-col items-center',
    icon: 'mb-3 flex size-10 items-center justify-center rounded-full bg-panel-field text-muted',
    label: 'text-xs font-medium text-surface',
    description: 'mt-1 text-xs leading-relaxed text-muted',
    action: 'mt-4 flex w-full items-center justify-center gap-2'
  },
  variants: {
    fill: {
      true: { root: 'flex-1' },
      false: {}
    },
    size: {
      compact: {
        root: 'px-3 py-4',
        content: 'max-w-xs',
        icon: 'mb-2 size-8',
        label: 'font-normal text-muted',
        description: 'text-[11px]',
        action: 'mt-3'
      },
      panel: { root: 'p-6' },
      page: { root: 'p-8' }
    }
  },
  defaultVariants: {
    fill: true,
    size: 'panel' as const
  }
} as const

export type PlaceholderTheme = typeof placeholderTheme
export default placeholderTheme
