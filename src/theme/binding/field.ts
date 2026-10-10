const bindingFieldTheme = {
  slots: {
    root: 'min-w-0',
    // A tint of the text colour reads as a chip on the field in both themes.
    pill: 'flex h-[18px] min-w-0 flex-1 items-center overflow-hidden rounded-sm bg-surface/10 px-1 text-surface outline-none',
    pillLabel: 'min-w-0 flex-1 truncate text-[11px] font-medium',
    trigger:
      'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-muted outline-none transition-colors hover:text-surface focus-visible:border-panel-focus data-[open]:bg-hover data-[open]:text-surface disabled:opacity-0 data-[disabled]:opacity-0',
    createForm: 'flex items-center gap-1.5 p-1',
    createInput:
      'h-6 min-w-0 flex-1 rounded border border-transparent bg-panel-field px-2 text-[11px] text-surface outline-none placeholder:text-muted focus:border-panel-focus'
  },
  variants: {
    state: {
      unbound: {},
      bound: {
        trigger: 'text-surface opacity-100'
      },
      unresolved: { trigger: 'text-error opacity-100', pill: 'bg-error-bg text-error' },
      mixed: {}
    },
    open: {
      true: {
        trigger: 'bg-hover text-surface opacity-100'
      },
      false: {}
    },
    disabled: {
      true: {
        pill: 'bg-surface/5 text-muted opacity-60',
        trigger: 'pointer-events-none opacity-0'
      },
      false: {}
    },
    derived: {
      true: {
        pill: 'bg-surface/5 text-muted'
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
