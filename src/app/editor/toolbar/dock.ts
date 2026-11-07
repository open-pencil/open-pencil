import type { ViewportInsets } from '@open-pencil/core'
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

/** Room the toolbar takes at the canvas edge it floats over, as Figma keeps for its own. */
const TOOLBAR_CHROME = 50

/**
 * The floating UI over each canvas edge that zooming to fit keeps clear of: the toolbar on its
 * edge, or nothing while it is away.
 */
export function toolbarChrome(side: ToolbarSide | null): ViewportInsets {
  const chrome = { left: 0, right: 0, top: 0, bottom: 0 }
  if (side) chrome[side] = TOOLBAR_CHROME
  return chrome
}
