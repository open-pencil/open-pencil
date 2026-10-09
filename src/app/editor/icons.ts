import type { Component } from 'vue'
import IconCircle from '~icons/lucide/circle'
import IconColumns from '~icons/lucide/columns-3'
import IconComponentSet from '~icons/lucide/component'
import IconComponent from '~icons/lucide/diamond'
import IconFrame from '~icons/lucide/frame'
import IconGrid from '~icons/lucide/grid-3x3'
import IconGroup from '~icons/lucide/group'
import IconHand from '~icons/lucide/hand'
import IconSection from '~icons/lucide/layout-grid'
import IconMinus from '~icons/lucide/minus'
import IconMousePointer from '~icons/lucide/mouse-pointer'
import IconPenTool from '~icons/lucide/pen-tool'
import IconRows from '~icons/lucide/rows-3'
import IconSmile from '~icons/lucide/smile'
import IconSquare from '~icons/lucide/square'
import IconSlot from '~icons/lucide/square-dashed'
import IconStar from '~icons/lucide/star'
import IconTriangle from '~icons/lucide/triangle'
import IconType from '~icons/lucide/type'

import { readIcon, slotPropertyId, type SceneNode } from '@open-pencil/scene-graph'

import type { Tool } from '@/app/editor/session'

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
  TEXT: IconType,
  HAND: IconHand
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
  RECTANGLE: IconSquare
}

export const AUTO_LAYOUT_ICONS: Partial<Record<string, typeof IconSquare>> = {
  VERTICAL: IconRows,
  HORIZONTAL: IconColumns,
  GRID: IconGrid
}

export const COMPONENT_TYPES = new Set(['COMPONENT', 'COMPONENT_SET', 'INSTANCE'])

export { IconFrame, IconSquare }

/** The glyph for a layer: its kind, or a slot or icon frame. A component keeps its own glyph. */
export function nodeIcon(node: {
  type: string
  layoutMode: string
  slot?: boolean
  icon?: boolean
}) {
  if (node.slot) return IconSlot
  if (node.icon && node.type === 'FRAME') return IconSmile
  if (node.type === 'FRAME' && node.layoutMode !== 'NONE')
    return AUTO_LAYOUT_ICONS[node.layoutMode] ?? IconFrame
  return NODE_ICONS[node.type] ?? IconSquare
}

/** `nodeIcon` for a scene node, which carries slot and icon identity in its data. */
export function sceneNodeIcon(node: SceneNode) {
  return nodeIcon({ ...node, slot: !!slotPropertyId(node), icon: !!readIcon(node) })
}
