const toolbarTheme = {
  slots: {
    button:
      'flex size-8 cursor-pointer items-center justify-center border-none bg-transparent text-muted transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent',
    icon: 'size-4',
    flyoutGroup: 'flex items-center',
    flyoutTrigger:
      'flex h-8 w-3 cursor-pointer items-center justify-center border-none bg-transparent text-muted transition-colors outline-none data-[state=open]:bg-hover data-[state=open]:text-surface focus-visible:ring-1 focus-visible:ring-accent',
    flyoutTriggerIcon: 'size-2.5',
    flyoutContent: '',
    flyoutItem: '',
    flyoutItemIndicator: 'flex size-3.5 shrink-0 items-center justify-center',
    flyoutItemIcon: 'size-3.5',
    flyoutItemLabel: 'flex-1',
    navigationAction:
      'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-panel text-muted shadow-sm outline-none select-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none',
    navigationIcon: 'size-3.5',
    action:
      'flex size-8 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-muted transition-colors outline-none select-none active:bg-hover active:text-surface focus-visible:ring-1 focus-visible:ring-accent',
    actionIcon: 'size-4'
  },
  variants: {
    active: {
      true: {
        button: 'bg-accent text-white'
      },
      false: {}
    },
    mobile: {
      true: {
        button: 'rounded-[6px] select-none',
        flyoutTrigger: 'rounded-[6px] select-none active:bg-hover active:text-surface'
      },
      false: {
        button: 'rounded-lg',
        flyoutTrigger: 'rounded-lg hover:bg-hover hover:text-surface'
      }
    },
    disabled: {
      true: {
        navigationAction: 'pointer-events-none'
      },
      false: {}
    }
  },
  compoundVariants: [
    {
      active: false,
      mobile: true,
      class: {
        button: 'active:bg-hover'
      }
    },
    {
      active: false,
      mobile: false,
      class: {
        button: 'hover:bg-hover hover:text-surface'
      }
    }
  ],
  defaultVariants: {
    active: false,
    mobile: false,
    disabled: false
  }
}

export type ToolbarTheme = typeof toolbarTheme
export default toolbarTheme
