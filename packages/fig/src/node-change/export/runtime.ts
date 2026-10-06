import type { SceneNode } from '@open-pencil/scene-graph'

import type { ShapedText } from '../derived-text/build'

/** Engine services the `.fig` writer needs but cannot provide without a text shaper. */
export interface FigNodeChangeExportRuntime {
  /** Lay the node's text out at its width as the renderer draws it, or `null` when it cannot. */
  shapeText(node: SceneNode): ShapedText | null
}

export const EMPTY_EXPORT_RUNTIME: FigNodeChangeExportRuntime = {
  shapeText: () => null
}
