export const panelFieldBase =
  'h-6 min-w-0 rounded border border-transparent bg-panel-field text-surface outline-none hover:bg-panel-field-hover focus:border-panel-focus focus:bg-panel-field-hover focus-visible:border-panel-focus focus-within:border-panel-focus focus-within:bg-panel-field-hover disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60'

export const panelFieldState = {
  idle: '',
  mixed: 'text-muted placeholder:text-muted',
  bound: 'text-surface',
  invalid: 'border-error focus:border-error focus-visible:border-error'
} as const
