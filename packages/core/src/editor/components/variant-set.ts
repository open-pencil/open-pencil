import {
  createComponentPropertyId,
  type SceneGraph,
  type SceneNode,
  type Stroke
} from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import { copyStrokes } from '@open-pencil/scene-graph/copy'
import { deriveVariantProperties } from '@open-pencil/scene-graph/variant-properties'

/**
 * How a new component set looks. Figma's Combine as variants command (`canvas`) pads the variants
 * by 20 and outlines the set with a dashed purple stroke; its plugin API (`script`) wraps them
 * exactly, with no fill or stroke.
 */
export type VariantSetStyle = 'canvas' | 'script'

/** Space around the variants of a set made on the canvas. */
export const VARIANT_SET_PADDING = 20
const CANVAS_STROKE: Stroke = {
  type: 'SOLID',
  color: { r: 138 / 255, g: 56 / 255, b: 245 / 255, a: 1 },
  opacity: 1,
  visible: true,
  weight: 1,
  align: 'INSIDE',
  dashPattern: [10, 5]
}

/** Name, place, and look of a set made from `components` under `parentId`, as Figma makes it. */
export function variantSetProps(
  graph: SceneGraph,
  components: readonly SceneNode[],
  parentId: string,
  style: VariantSetStyle
): Partial<SceneNode> {
  const bounds = getAxisAlignedBoundsInParent(components, parentId, graph)
  const padding = style === 'canvas' ? VARIANT_SET_PADDING : 0
  return {
    name: components[0]?.name.split('/')[0]?.trim() || 'Component Set',
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
    fills: [],
    strokes: style === 'canvas' ? copyStrokes([CANVAS_STROKE]) : [],
    cornerRadius: style === 'canvas' ? 5 : 0
  }
}

/**
 * Turns variant names into the set's variant properties, as Figma does: slash paths such as
 * `Button/Primary`, else `Property=Value` pairs such as `State=On, Size=Large`.
 */
export function applyVariantProperties(
  graph: SceneGraph,
  components: readonly SceneNode[],
  setId: string
): void {
  const derived = deriveVariantProperties([...components], createComponentPropertyId)
  if (!derived) return
  for (const [nodeId, changes] of derived.variants) graph.updateNode(nodeId, changes)
  graph.updateNode(setId, { componentPropertyDefinitions: derived.definitions })
}
