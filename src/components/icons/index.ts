import type { Component } from 'vue'
import IconCircle from '~icons/lucide/circle'
import IconColumns from '~icons/lucide/columns-3'
import IconComponentSet from '~icons/lucide/component'
import IconComponent from '~icons/lucide/diamond'
import IconFrame from '~icons/lucide/frame'
import IconGrid from '~icons/lucide/grid-3x3'
import IconGroup from '~icons/lucide/group'
import IconHand from '~icons/lucide/hand'
import IconImage from '~icons/lucide/image'
import IconSection from '~icons/lucide/layout-grid'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconMinus from '~icons/lucide/minus'
import IconMousePointer from '~icons/lucide/mouse-pointer'
import IconPenTool from '~icons/lucide/pen-tool'
import IconPencil from '~icons/lucide/pencil'
import IconRows from '~icons/lucide/rows-3'
import IconShapes from '~icons/lucide/shapes'
import IconSmile from '~icons/lucide/smile'
import IconSpline from '~icons/lucide/spline'
import IconSquare from '~icons/lucide/square'
import IconSlot from '~icons/lucide/square-dashed'
import IconMask from '~icons/lucide/squares-intersect'
import IconStar from '~icons/lucide/star'
import IconStickyNote from '~icons/lucide/sticky-note'
import IconTriangle from '~icons/lucide/triangle'
import IconType from '~icons/lucide/type'

import type { Tool } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { readIcon } from '@open-pencil/scene-graph/icons'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'
import type { LayerOutline } from '@open-pencil/vue/primitives/LayerTree'

import { outlineIcon } from './outlines'
import { SHAPE_KIND_ICONS } from './shapes'

export const toolIcons: Record<Tool, Component> = {
  SELECT: IconMousePointer,
  FRAME: IconFrame,
  SECTION: IconSection,
  RECTANGLE: IconSquare,
  ELLIPSE: IconCircle,
  LINE: IconMinus,
  POLYGON: IconTriangle,
  STAR: IconStar,
  PEN: IconPenTool,
  PENCIL: IconPencil,
  TEXT: IconType,
  STICKY: IconStickyNote,
  SHAPE_WITH_TEXT: IconShapes,
  CONNECTOR: IconSpline,
  HAND: IconHand,
  COMMENT: IconMessageCircle
}

export const NODE_ICONS: Partial<Record<string, typeof IconSquare>> = {
  SECTION: IconSection,
  ELLIPSE: IconCircle,
  FRAME: IconFrame,
  GROUP: IconGroup,
  COMPONENT: IconComponent,
  COMPONENT_SET: IconComponentSet,
  INSTANCE: IconComponent,
  LINE: IconMinus,
  TEXT: IconType,
  VECTOR: IconPenTool,
  RECTANGLE: IconSquare,
  STICKY: IconStickyNote,
  CONNECTOR: IconSpline
}

export const AUTO_LAYOUT_ICONS: Partial<Record<string, typeof IconSquare>> = {
  VERTICAL: IconRows,
  HORIZONTAL: IconColumns,
  GRID: IconGrid
}

export const COMPONENT_TYPES = new Set(['COMPONENT', 'COMPONENT_SET', 'INSTANCE'])

export { IconFrame, IconSquare }

/**
 * The glyph for a layer: its kind, or a slot or icon frame. A component keeps its own glyph, a
 * shape with text shows its kind, a layer that masks shows the mask glyph, and a layer row's shape
 * or vector shows its own outline, or the image glyph when it shows an image, as in Figma.
 */
export function nodeIcon(node: {
  type: string
  layoutMode: string
  slot?: boolean
  icon?: boolean
  shapeWithTextType?: ShapeWithTextType
  outline?: LayerOutline
  image?: boolean
  mask?: boolean
}) {
  if (node.slot) return IconSlot
  // Figma marks any masking layer, frames and text too, but marks images on shapes only.
  if (node.mask) return IconMask
  if (node.type === 'SHAPE_WITH_TEXT' && node.shapeWithTextType) {
    return SHAPE_KIND_ICONS[node.shapeWithTextType]
  }
  if (node.outline) {
    if (node.image) return IconImage
    const icon = outlineIcon(node.outline)
    if (icon) return icon
  }
  if (node.icon && node.type === 'FRAME') return IconSmile
  if (node.type === 'FRAME' && node.layoutMode !== 'NONE')
    return AUTO_LAYOUT_ICONS[node.layoutMode] ?? IconFrame
  return NODE_ICONS[node.type] ?? IconSquare
}

/** `nodeIcon` for a scene node, which carries slot and icon identity in its data. */
export function sceneNodeIcon(node: SceneNode) {
  return nodeIcon({ ...node, slot: !!slotPropertyId(node), icon: !!readIcon(node) })
}
