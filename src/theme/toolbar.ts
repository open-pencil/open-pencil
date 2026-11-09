const toolbarTheme = {
  slots: {
    /** The desktop toolbar's position over the canvas. */
    dock: 'absolute z-10 flex',
    bar: 'flex min-h-0 min-w-0 gap-0.5 rounded-xl bg-panel p-1 shadow-(--floating-bar-shadow) *:shrink-0',
    button:
      'flex size-8 cursor-pointer items-center justify-center border-none bg-transparent text-muted transition-colors outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    icon: 'size-4',
    flyoutGroup: 'flex items-center',
    flyoutTrigger:
      'flex cursor-pointer items-center justify-center border-none bg-transparent text-muted transition-colors outline-none data-[state=open]:bg-hover data-[state=open]:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus',
    flyoutTriggerIcon: 'size-2.5',
    flyoutContent: '',
    flyoutItem: '',
    flyoutItemIndicator: 'flex size-3.5 shrink-0 items-center justify-center',
    flyoutItemIcon: 'size-3.5',
    flyoutItemLabel: 'flex-1',
    navigationAction:
      'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-panel text-muted shadow-sm outline-none select-none focus-visible:ring-1 focus-visible:ring-panel-focus disabled:pointer-events-none',
    navigationIcon: 'size-3.5',
    action:
      'flex size-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted transition-colors outline-none select-none active:bg-hover active:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus',
    actionIcon: 'size-4'
  },
  variants: {
    /** The canvas edge the toolbar is docked to; left and right stack the tools. */
    side: {
      // Top and left keep clear of the rulers.
      top: {
        dock: 'top-8 max-w-[calc(100%-3rem)] items-center',
        bar: 'overflow-x-auto [scrollbar-width:none]',
        flyoutTrigger: 'h-8 w-3'
      },
      bottom: {
        dock: 'bottom-4 max-w-[calc(100%-3rem)] items-center',
        bar: 'overflow-x-auto [scrollbar-width:none]',
        flyoutTrigger: 'h-8 w-3'
      },
      left: {
        dock: 'inset-s-8 max-h-[calc(100%-3rem)] flex-col',
        bar: 'flex-col overflow-y-auto [scrollbar-width:none]',
        flyoutGroup: 'flex-col',
        flyoutTrigger: 'h-3 w-8'
      },
      right: {
        dock: 'inset-e-4 max-h-[calc(100%-3rem)] flex-col',
        bar: 'flex-col overflow-y-auto [scrollbar-width:none]',
        flyoutGroup: 'flex-col',
        flyoutTrigger: 'h-3 w-8'
      }
    },
    /** Where along its edge the toolbar sits, on the axis the dock's `data-orientation` names. */
    align: {
      start: { dock: 'data-[orientation=horizontal]:inset-s-8 data-[orientation=vertical]:top-8' },
      center: {
        dock: 'data-[orientation=horizontal]:inset-s-1/2 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:top-1/2 data-[orientation=vertical]:-translate-y-1/2'
      },
      end: { dock: 'data-[orientation=horizontal]:inset-e-4 data-[orientation=vertical]:bottom-4' }
    },
    active: {
      true: {
        button: 'bg-accent text-on-accent'
      },
      false: {}
    },
    mobile: {
      true: {
        button: 'rounded-md select-none',
        flyoutTrigger: 'rounded-md select-none active:bg-hover active:text-surface'
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
    side: 'bottom' as const,
    align: 'center' as const,
    active: false,
    mobile: false,
    disabled: false
  }
}

export type ToolbarTheme = typeof toolbarTheme
export default toolbarTheme
