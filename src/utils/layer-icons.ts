import IconCircle from '~icons/lucide/circle'
import IconColumns from '~icons/lucide/columns-3'
import IconComponentSet from '~icons/lucide/component'
import IconComponent from '~icons/lucide/diamond'
import IconFrame from '~icons/lucide/frame'
import IconGrid from '~icons/lucide/grid-3x3'
import IconGroup from '~icons/lucide/group'
import IconSection from '~icons/lucide/layout-grid'
import IconMinus from '~icons/lucide/minus'
import IconPenTool from '~icons/lucide/pen-tool'
import IconRows from '~icons/lucide/rows-3'
import IconSquare from '~icons/lucide/square'
import IconType from '~icons/lucide/type'

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

export function nodeIcon(node: { type: string; layoutMode: string }) {
  if (node.type === 'FRAME' && node.layoutMode !== 'NONE')
    return AUTO_LAYOUT_ICONS[node.layoutMode] ?? IconFrame
  return NODE_ICONS[node.type] ?? IconSquare
}
