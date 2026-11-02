/** The value field: an input holding pills and operators, with the result at its end. */
export default {
  slots: {
    root: 'relative flex h-auto min-h-7 cursor-text items-end gap-1.5 py-[3px] focus-within:border-panel-focus focus-within:ring-1 focus-within:ring-accent/25 data-[invalid]:border-error data-[invalid]:focus-within:border-error',
    /** What the field holds, such as CSS, muted at its start. */
    prefix: 'shrink-0 self-start leading-5 text-muted',
    editor: 'flex min-w-0 flex-1 *:min-w-0 *:flex-1',
    /** Buttons over the field's top right corner, which the text's first line keeps clear. */
    actions: 'absolute top-[3px] right-2 flex h-5 items-center'
  }
} as const
