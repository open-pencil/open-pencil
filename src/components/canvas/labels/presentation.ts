import { canvasLabelForeground } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'
import type { Color, SceneNode } from '@open-pencil/scene-graph'
import type { CanvasLabelKind } from '@open-pencil/vue'

export interface CanvasLabelPresentation {
  background: Color
  foreground: 'dark' | 'light'
}

const DEFAULT_LABEL_BACKGROUND: Color = { r: 0.37, g: 0.37, b: 0.37, a: 1 }

/** Figma renames a frame or component name in a white field, a section title on its own fill. */
const NAME_FIELD: CanvasLabelPresentation = {
  background: { r: 1, g: 1, b: 1, a: 1 },
  foreground: 'dark'
}

export function canvasLabelPresentation(
  editor: Editor,
  node: SceneNode | null,
  kind: CanvasLabelKind | undefined
): CanvasLabelPresentation {
  if (kind && kind !== 'section-title') return NAME_FIELD
  const fill = node?.fills[0]
  const background =
    node && fill?.visible
      ? (editor.renderer?.resolveFillColor(fill, 0, node, editor.graph) ?? fill.color)
      : DEFAULT_LABEL_BACKGROUND
  const foreground = canvasLabelForeground(background, editor.state.pageColor)
  return { background, foreground: foreground.r === 0 ? 'dark' : 'light' }
}
