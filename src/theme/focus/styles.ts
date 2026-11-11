/**
 * How a control shows keyboard focus. A field shows it on its own border (`panelFieldBase`), so
 * rows of fields stay aligned; every other control takes `ring`, a 1px ring in the focus colour
 * that hugs it without changing its size. Content regions that cannot draw outside themselves,
 * such as a tab's panel, take `ringInset`, and slider thumbs take the stronger `thumb`.
 * Controls whose ring also marks a selection, such as accent swatches and comment pins, keep their
 * own ring so focus and selection stay apart.
 */
export const focusStyles = {
  ring: 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
  ringInset:
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-panel-focus',
  thumb: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-focus'
} as const
