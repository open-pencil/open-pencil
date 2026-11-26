/**
 * How a control shows keyboard focus. A field shows it on its own border (`panelFieldBase`), so
 * rows of fields stay aligned; every other control takes `ring`, a 1px ring in the focus colour
 * that hugs it without changing its size. Content regions that cannot draw outside themselves,
 * such as a tab's panel, take `ringInset`. Small round controls take `ringStrong`, a 2px ring:
 * slider thumbs, and swatches, whose selection ring turns the focus colour while focused rather
 * than gaining a second ring.
 *
 * The rings hide the browser outline with `outline-hidden`, not `outline-none`: forced-colors
 * modes drop box shadows, and there the transparent outline is drawn instead.
 */
export const focusStyles = {
  ring: 'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-panel-focus',
  ringInset:
    'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-panel-focus',
  ringStrong: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-panel-focus'
} as const
