import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { createShapeWithText, shapeWithTextFrameFields } from '@open-pencil/scene-graph/generated'
import {
  isShapeWithTextType,
  SHAPE_WITH_TEXT_TYPES,
  type ShapeWithTextType
} from '@open-pencil/scene-graph/shape-with-text'

import type { InterfaceTheme } from '#core/constants'
import { newLayerDefaults } from '#core/editor/shapes/defaults'

import type { NodeProxyInternals, ProxyThis } from './accessor-utils'
import { graph, prepareFollowedFieldEdit, raw, updateNode } from './accessor-utils'

/** `value` as a kind for `node`, refused in the words Figma's plugin API refuses it with. */
function checkedShapeType(node: SceneNode, value: unknown): ShapeWithTextType {
  if (node.type !== 'SHAPE_WITH_TEXT') {
    throw new Error('in set_shapeType: Only a shape with text has a shape type')
  }
  if (!isShapeWithTextType(value)) {
    const expected = SHAPE_WITH_TEXT_TYPES.map((kind) => `'${kind}'`).join(' | ')
    throw new Error(
      `in set_shapeType: Property "shapeType" failed validation: Invalid enum value. Expected ${expected}, received '${String(value)}'`
    )
  }
  return value
}

/**
 * A new, empty shape with text on the API's current page, as FigJam's plugin API creates it: an
 * ellipse 176 px square, painted as the shape tool paints a new shape. Measured in FigJam.
 */
export function newShapeWithText(api: {
  graph: SceneGraph
  currentPageId: string
  theme: InterfaceTheme
}): SceneNode {
  return createShapeWithText(api.graph, api.currentPageId, {
    ...newLayerDefaults('SHAPE_WITH_TEXT', api.theme),
    shapeWithTextType: 'ELLIPSE'
  })
}

/** `shapeType`, a shape with text's FigJam kind; other layers have none. */
export function installShapeWithTextAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    shapeType: {
      get(this: ProxyThis): ShapeWithTextType | undefined {
        const node = raw(this, internals)
        return node.type === 'SHAPE_WITH_TEXT' ? node.shapeWithTextType : undefined
      },
      set(this: ProxyThis, value: unknown) {
        const node = raw(this, internals)
        const kind = checkedShapeType(node, value)
        prepareFollowedFieldEdit(graph(this, internals), node, 'shapeType', 'shape-type')
        // The new kind lays the label out in its own area, as FigJam's shape switcher does.
        updateNode(this, internals, {
          shapeWithTextType: kind,
          ...shapeWithTextFrameFields(kind, node.width, node.height)
        })
      }
    }
  })
}
