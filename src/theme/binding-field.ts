const bindingFieldTheme = {
  slots: {
    root: 'min-w-0',
    pill: 'flex min-w-0 flex-1 items-center overflow-hidden rounded-sm px-1 text-component outline-none',
    pillLabel: 'min-w-0 flex-1 truncate text-[11px] font-medium',
    trigger:
      'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-muted outline-none transition-colors hover:text-surface focus-visible:border-panel-focus data-[open]:bg-hover data-[open]:text-component disabled:opacity-0 data-[disabled]:opacity-0',
    pickerContent:
      'z-[100] w-56 overflow-hidden rounded-lg border border-border bg-panel text-surface shadow-xl',
    pickerSearch:
      'h-6 w-full border-0 border-b border-border bg-transparent px-2 text-[11px] text-surface outline-none placeholder:text-muted focus:border-panel-focus',
    pickerViewport: 'max-h-48 overflow-y-auto p-1',
    pickerItem:
      'flex h-6 cursor-pointer items-center gap-2 rounded px-2 text-[11px] text-surface outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover',
    pickerItemIcon: 'size-3 shrink-0 text-component',
    pickerItemLabel: 'min-w-0 flex-1 truncate',
    pickerItemIndicator: 'flex size-3 shrink-0 items-center justify-center text-component',
    pickerEmpty: 'px-2 py-3 text-center text-[11px] text-muted',
    pickerFooter: 'border-t border-border p-1',
    pickerAction:
      'flex h-6 w-full cursor-pointer items-center gap-2 rounded border-0 bg-transparent px-2 text-left text-[11px] text-muted outline-none hover:bg-hover hover:text-surface focus-visible:border-panel-focus',
    createForm: 'flex items-center gap-1.5 p-1',
    createInput:
      'h-6 min-w-0 flex-1 rounded border border-transparent bg-panel-field px-2 text-[11px] text-surface outline-none placeholder:text-muted focus:border-panel-focus',
    createSubmit:
      'h-6 shrink-0 rounded border border-transparent bg-panel-field px-2 text-[11px] text-surface outline-none hover:bg-panel-field-hover focus-visible:border-panel-focus disabled:cursor-not-allowed disabled:opacity-50'
  },
  variants: {
    state: {
      unbound: {},
      bound: {
        trigger: 'text-component opacity-100'
      },
      mixed: {}
    },
    open: {
      true: {
        trigger: 'bg-hover text-component opacity-100'
      },
      false: {}
    },
    disabled: {
      true: {
        pill: 'text-muted opacity-60',
        trigger: 'pointer-events-none opacity-0'
      },
      false: {}
    },
    derived: {
      true: {
        pill: 'text-muted'
      },
      false: {}
    }
  },
  defaultVariants: {
    state: 'unbound' as const,
    open: false,
    disabled: false,
    derived: false
  }
}

export type BindingFieldTheme = typeof bindingFieldTheme
export default bindingFieldTheme
