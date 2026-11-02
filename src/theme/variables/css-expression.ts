export default {
  slots: {
    /** The field and buttons, in the value grid's columns under the value's. */
    field: 'min-w-0',
    error: 'text-[10px] text-error',
    /** Where the browser computes the preview, out of sight. */
    probe: 'pointer-events-none invisible absolute size-0 overflow-hidden'
  }
} as const
