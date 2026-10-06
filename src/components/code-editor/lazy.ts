/** Loads CodeMirror and the viewer; the module is cached, so calling it again is free. */
export function loadCodeViewer() {
  return import('@/components/code-editor/CodeViewer.vue')
}

/** Mirrors `codeViewerTheme`: 10.5px text at a 1.55 line height, 6px padding, 16rem at most. */
const LINE_HEIGHT = 10.5 * 1.55
const PADDING_Y = 12
const BORDER_Y = 2
const MAX_HEIGHT = 256

/**
 * The height the viewer takes for `code` before line wrapping, so a collapsible measuring its
 * content while CodeMirror loads or lays out its lines opens to the right height.
 */
export function codeViewerHeight(code: string): number {
  const lines = code.split('\n').length
  return Math.min(lines * LINE_HEIGHT + PADDING_Y, MAX_HEIGHT) + BORDER_Y
}
