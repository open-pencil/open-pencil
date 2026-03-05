import IconCircle from '~icons/lucide/circle'
import IconFrame from '~icons/lucide/frame'
import IconHand from '~icons/lucide/hand'
import IconLayoutGrid from '~icons/lucide/layout-grid'
import IconMinus from '~icons/lucide/minus'
import IconMousePointer from '~icons/lucide/mouse-pointer'
import IconPenTool from '~icons/lucide/pen-tool'
import IconSquare from '~icons/lucide/square'
import IconStar from '~icons/lucide/star'
import IconTriangle from '~icons/lucide/triangle'
import IconType from '~icons/lucide/type'

import type { Component } from 'vue'
import type { Tool } from '@/stores/editor'

export const toolIcons: Record<Tool, Component> = {
  SELECT: IconMousePointer,
  FRAME: IconFrame,
  SECTION: IconLayoutGrid,
  RECTANGLE: IconSquare,
  ELLIPSE: IconCircle,
  LINE: IconMinus,
  POLYGON: IconTriangle,
  STAR: IconStar,
  PEN: IconPenTool,
  TEXT: IconType,
  HAND: IconHand
}
