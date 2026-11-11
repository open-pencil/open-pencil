/**
 * How a control shows keyboard focus. A field shows it on its own border (`panelFieldBase`), so
 * rows of fields stay aligned; every other control takes `ring`, a 1px ring in the focus colour
 * that hugs it without changing its size. Content regions that cannot draw outside themselves,
 * such as a tab's panel, take `ringInset`, and slider thumbs take the stronger `thumb`. A control
 * whose ring marks a selection, such as a chosen swatch, takes `outline`, drawn clear of that ring
 * so focus and selection show together.
 *
 * The rings hide the browser outline with `outline-hidden`, not `outline-none`: forced-colors
 * modes drop box shadows, and there the transparent outline is drawn instead.
 */
export const focusStyles = {
  ring: 'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-panel-focus',
  ringInset:
    'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-panel-focus',
  thumb: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-panel-focus',
  outline:
    'focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-panel-focus'
} as const
