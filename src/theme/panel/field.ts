export const panelFieldBase =
  'h-control min-w-0 rounded-panel border border-transparent bg-panel-field text-surface outline-none hover:bg-panel-field-hover focus:border-panel-focus focus:bg-panel-field-hover focus-visible:border-panel-focus focus-within:border-panel-focus focus-within:bg-panel-field-hover disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60'

export const panelFieldState = {
  idle: '',
  mixed: 'text-muted placeholder:text-muted',
  bound: 'text-component',
  invalid: 'border-danger focus:border-danger focus-visible:border-danger'
} as const

export const panelIconButtonBase =
  'flex size-control shrink-0 cursor-pointer items-center justify-center rounded-panel border border-transparent bg-transparent text-muted outline-none hover:bg-hover hover:text-surface focus-visible:border-panel-focus disabled:cursor-not-allowed disabled:opacity-50'
