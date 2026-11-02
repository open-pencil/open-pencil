import { resolveEditorProfile, type Editor } from '@lawha/core'
import { canvasLabelForeground, outlineColorInMode } from '@lawha/core/canvas'
import type { SceneNode } from '@lawha/scene-graph'
import { figJamSectionTitleColors } from '@lawha/scene-graph/figjam'
import type { Color } from '@lawha/scene-graph/primitives'
import type { CanvasLabelKind } from '@lawha/vue/canvas/labels'

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
  // A board draws the title on the section's outline colour, as FigJam does.
  const figJam =
    node && resolveEditorProfile(editor.state).sectionTitles === 'outline'
      ? figJamSectionTitleColors(node, (stroke, index) =>
          outlineColorInMode(editor.graph, node, stroke, index)
        )
      : null
  if (figJam) {
    const outline = node?.strokes[figJam.strokeIndex]
    const background =
      (node &&
        outline &&
        editor.renderer?.resolveStrokeColor(outline, figJam.strokeIndex, node, editor.graph)) ||
      figJam.background
    // Opaque, as the pill it edits is.
    return { background: { ...background, a: 1 }, foreground: figJam.lightText ? 'light' : 'dark' }
  }
  const fill = node?.fills[0]
  const background =
    node && fill?.visible
      ? (editor.renderer?.resolveFillColor(fill, 0, node, editor.graph) ?? fill.color)
      : DEFAULT_LABEL_BACKGROUND
  const foreground = canvasLabelForeground(background, editor.state.pageColor)
  return { background, foreground: foreground.r === 0 ? 'dark' : 'light' }
}
