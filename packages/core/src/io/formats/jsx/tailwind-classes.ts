import { DEFAULT_FONT_FAMILY } from '#core/constants'
import {
  pxToSpacing,
  colorToTwClass,
  fontSizeToTw,
  fontWeightToTw,
  borderRadiusToTw,
  opacityToTw
} from '#core/design-jsx/tailwind'
import { resolveNodeTextDirection } from '#core/text/direction'
import {
  collectCornerRadii,
  collectPadding,
  emitPadding,
  formatTailwindAngle,
  formatTailwindFontFamily,
  formatTailwindShadow,
  formatTrack,
  getNodeContext,
  solidFillColor,
  solidStroke
} from './helpers'

import type { GridTrack, SceneGraph, SceneNode } from '#core/scene-graph'

function twRounded(prefix: string, px: number): string {
  const r = borderRadiusToTw(px)
  return r ? `${prefix}-${r}` : prefix
}

function gridTemplateTw(tracks: GridTrack[]): string {
  const allEqual1Fr = tracks.every((t) => t.sizing === 'FR' && t.value === 1)
  if (allEqual1Fr) return String(tracks.length)
  return `[${tracks.map(formatTrack).join('_')}]`
}

function collectTwGridClasses(node: SceneNode, classes: string[]): void {
  classes.push('grid')
  if (node.gridTemplateColumns.length > 0)
    classes.push(`grid-cols-${gridTemplateTw(node.gridTemplateColumns)}`)
  if (node.gridTemplateRows.length > 0)
    classes.push(`grid-rows-${gridTemplateTw(node.gridTemplateRows)}`)
  if (node.width > 0) classes.push(`w-${pxToSpacing(node.width)}`)
  if (node.gridTemplateRows.length > 0 && node.height > 0)
    classes.push(`h-${pxToSpacing(node.height)}`)
  if (node.gridColumnGap > 0) classes.push(`gap-x-${pxToSpacing(node.gridColumnGap)}`)
  if (node.gridRowGap > 0) classes.push(`gap-y-${pxToSpacing(node.gridRowGap)}`)
}

function collectTwFlexSizingClasses(node: SceneNode, classes: string[]): void {
  classes.push('flex')
  if (node.layoutDirection === 'RTL') classes.push('[direction:rtl]')
  if (node.layoutMode === 'VERTICAL') classes.push('flex-col')

  const primaryAxis = node.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
  const crossAxis = node.layoutMode === 'HORIZONTAL' ? 'height' : 'width'
  const wProp = primaryAxis === 'width' ? 'w' : 'h'
  const hProp = crossAxis === 'width' ? 'w' : 'h'

  if (node.primaryAxisSizing === 'FILL') classes.push(`${wProp}-full`)
  else if (node.primaryAxisSizing !== 'HUG')
    classes.push(`${wProp}-${pxToSpacing(node[primaryAxis])}`)

  if (node.counterAxisSizing === 'FILL') classes.push(`${hProp}-full`)
  else if (node.counterAxisSizing !== 'HUG')
    classes.push(`${hProp}-${pxToSpacing(node[crossAxis])}`)
}

function collectTwGridPositionClasses(node: SceneNode, classes: string[]): void {
  if (!node.gridPosition) return
  const pos = node.gridPosition
  if (pos.column > 0) classes.push(`col-start-${pos.column}`)
  if (pos.row > 0) classes.push(`row-start-${pos.row}`)
  if (pos.columnSpan > 1) classes.push(`col-span-${pos.columnSpan}`)
  if (pos.rowSpan > 1) classes.push(`row-span-${pos.rowSpan}`)
}

function collectTwFlexAlignmentClasses(node: SceneNode, classes: string[]): void {
  if (node.itemSpacing > 0) classes.push(`gap-${pxToSpacing(node.itemSpacing)}`)

  if (node.layoutWrap === 'WRAP') {
    classes.push('flex-wrap')
    if (node.counterAxisSpacing > 0) classes.push(`gap-y-${pxToSpacing(node.counterAxisSpacing)}`)
  }

  if (node.primaryAxisAlign === 'CENTER') classes.push('justify-center')
  else if (node.primaryAxisAlign === 'MAX') classes.push('justify-end')
  else if (node.primaryAxisAlign === 'SPACE_BETWEEN') classes.push('justify-between')

  if (node.counterAxisAlign === 'CENTER') classes.push('items-center')
  else if (node.counterAxisAlign === 'MAX') classes.push('items-end')
  else if (node.counterAxisAlign === 'STRETCH') classes.push('items-stretch')
}

function collectTwPaddingClasses(node: SceneNode, classes: string[]): void {
  const pad = collectPadding(node)
  if (!pad) return
  classes.push(
    ...emitPadding(
      pad,
      (v) => `p-${pxToSpacing(v)}`,
      (y, x) => [`py-${pxToSpacing(y)}`, `px-${pxToSpacing(x)}`],
      ({ pt, pr, pb, pl }) => {
        const r: string[] = []
        if (pt > 0) r.push(`pt-${pxToSpacing(pt)}`)
        if (pr > 0) r.push(`pr-${pxToSpacing(pr)}`)
        if (pb > 0) r.push(`pb-${pxToSpacing(pb)}`)
        if (pl > 0) r.push(`pl-${pxToSpacing(pl)}`)
        return r
      }
    )
  )
}

function collectTwCornerRadiiClasses(node: SceneNode, classes: string[]): void {
  const corners = collectCornerRadii(node)
  if (!corners) return
  const { tl, tr, br, bl } = corners
  if (tl === tr && tr === br && br === bl) {
    classes.push(twRounded('rounded', tl))
  } else {
    if (tl > 0) classes.push(twRounded('rounded-tl', tl))
    if (tr > 0) classes.push(twRounded('rounded-tr', tr))
    if (br > 0) classes.push(twRounded('rounded-br', br))
    if (bl > 0) classes.push(twRounded('rounded-bl', bl))
  }
}

function collectTwAppearanceClasses(node: SceneNode, classes: string[]): void {
  const bg = solidFillColor(node.fills)
  if (bg && node.type !== 'TEXT') classes.push(`bg-${colorToTwClass(bg)}`)

  const stroke = solidStroke(node.strokes)
  if (stroke) {
    if (stroke.weight !== 1) classes.push(`border-${pxToSpacing(stroke.weight)}`)
    else classes.push('border')
    classes.push(`border-${colorToTwClass(stroke.color)}`)
  }

  collectTwCornerRadiiClasses(node, classes)

  if (node.opacity < 1) classes.push(`opacity-${opacityToTw(node.opacity)}`)
  if (node.rotation !== 0) classes.push(`rotate-${formatTailwindAngle(node.rotation)}`)
  if (node.clipsContent) classes.push('overflow-hidden')

  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      const shadow = formatTailwindShadow(effect)
      if (shadow) classes.push(`shadow-[${shadow}]`)
    } else if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR') {
      classes.push(`blur-[${effect.radius}px]`)
    } else {
      classes.push(`backdrop-blur-[${effect.radius}px]`)
    }
  }
}

function collectTwTextClasses(node: SceneNode, classes: string[]): void {
  classes.push(`text-${fontSizeToTw(node.fontSize)}`)
  if (resolveNodeTextDirection(node) === 'RTL') classes.push('[direction:rtl]')
  if (node.fontFamily && node.fontFamily !== DEFAULT_FONT_FAMILY) {
    classes.push(`font-${formatTailwindFontFamily(node.fontFamily)}`)
  }
  if (node.fontWeight !== 400) classes.push(`font-${fontWeightToTw(node.fontWeight)}`)
  if (node.textAlignHorizontal !== 'LEFT') {
    classes.push(`text-${node.textAlignHorizontal.toLowerCase()}`)
  }
  const textColor = solidFillColor(node.fills)
  if (textColor) classes.push(`text-${colorToTwClass(textColor)}`)
}

export function collectTailwindClasses(node: SceneNode, graph: SceneGraph): string[] {
  const classes: string[] = []
  const ctx = getNodeContext(node, graph)

  if (ctx.isGrid) collectTwGridClasses(node, classes)
  else if (ctx.isFlex) collectTwFlexSizingClasses(node, classes)
  else {
    if (node.width > 0) classes.push(`w-${pxToSpacing(node.width)}`)
    if (node.height > 0) classes.push(`h-${pxToSpacing(node.height)}`)
  }

  if (ctx.parentIsAutoLayout && node.layoutGrow > 0) classes.push('grow')
  if (ctx.parentIsGrid) collectTwGridPositionClasses(node, classes)
  if (ctx.isFlex) collectTwFlexAlignmentClasses(node, classes)
  if (ctx.isAutoLayout) collectTwPaddingClasses(node, classes)
  collectTwAppearanceClasses(node, classes)
  if (node.type === 'TEXT') collectTwTextClasses(node, classes)

  return classes
}

