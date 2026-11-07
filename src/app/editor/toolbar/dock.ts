import {
  TOOLBAR_ALIGNS,
  TOOLBAR_SIDES,
  type ToolbarAlign,
  type ToolbarSide
} from '@open-pencil/vue/primitives/Toolbar'

/** Where the desktop toolbar floats over the canvas: an edge, and a place along it. */
export interface ToolbarDock {
  side: ToolbarSide
  align: ToolbarAlign
}

/** Figma's place for it: centered along the bottom edge. */
export const DEFAULT_TOOLBAR_DOCK: Readonly<ToolbarDock> = { side: 'bottom', align: 'center' }

export function isToolbarSide(value: unknown): value is ToolbarSide {
  return TOOLBAR_SIDES.some((side) => side === value)
}

export function isToolbarAlign(value: unknown): value is ToolbarAlign {
  return TOOLBAR_ALIGNS.some((align) => align === value)
}
