import { twirl } from 'twirlwind'

import { colorToCSSCompact } from '#core/color'
import { DEFAULT_FONT_FAMILY } from '#core/constants'
import type { GridTrack, SceneGraph, SceneNode } from '#core/scene-graph'
import { resolveNodeTextDirection } from '#core/text/direction'

import { formatTrack, getNodeContext, solidFillColor, solidStroke } from './helpers'

function px(v: number): string {
  return `${v}px`
}

function gridTemplateTw(tracks: GridTrack[]): string {
  const allEqual1Fr = tracks.every((t) => t.sizing === 'FR' && t.value === 1)
  if (allEqual1Fr) return String(tracks.length)
  return `[${tracks.map(formatTrack).join('_')}]`
}

function collectGridClasses(node: SceneNode): string[] {
  const classes = ['grid']
  if (node.gridTemplateColumns.length > 0)
    classes.push(`grid-cols-${gridTemplateTw(node.gridTemplateColumns)}`)
  if (node.gridTemplateRows.length > 0)
    classes.push(`grid-rows-${gridTemplateTw(node.gridTemplateRows)}`)
  return classes
}

function collectGridPositionClasses(node: SceneNode): string[] {
  if (!node.gridPosition) return []
  const classes: string[] = []
  const pos = node.gridPosition
  if (pos.column > 0) classes.push(`col-start-${pos.column}`)
  if (pos.row > 0) classes.push(`row-start-${pos.row}`)
  if (pos.columnSpan > 1) classes.push(`col-span-${pos.columnSpan}`)
  if (pos.rowSpan > 1) classes.push(`row-span-${pos.rowSpan}`)
  return classes
}

const JUSTIFY_MAP: Record<string, string> = {
  CENTER: 'center',
  MAX: 'flex-end',
  SPACE_BETWEEN: 'space-between'
}

const ALIGN_MAP: Record<string, string> = {
  CENTER: 'center',
  MAX: 'flex-end',
  STRETCH: 'stretch'
}

function applyFlexStyle(style: Record<string, string>, node: SceneNode): void {
  style.display = 'flex'
  if (node.layoutMode === 'VERTICAL') style.flexDirection = 'column'
  if (node.layoutWrap === 'WRAP') style.flexWrap = 'wrap'
  if (node.itemSpacing > 0) style.gap = px(node.itemSpacing)
  if (node.layoutWrap === 'WRAP' && node.counterAxisSpacing > 0)
    style.rowGap = px(node.counterAxisSpacing)
  if (JUSTIFY_MAP[node.primaryAxisAlign]) style.justifyContent = JUSTIFY_MAP[node.primaryAxisAlign]
  if (ALIGN_MAP[node.counterAxisAlign]) style.alignItems = ALIGN_MAP[node.counterAxisAlign]
}

function applyFlexSizing(style: Record<string, string>, node: SceneNode): void {
  const primaryAxis = node.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
  const crossAxis = node.layoutMode === 'HORIZONTAL' ? 'height' : 'width'
  if (node.primaryAxisSizing === 'FILL') style[primaryAxis] = '100%'
  else if (node.primaryAxisSizing !== 'HUG') style[primaryAxis] = px(node[primaryAxis])
  if (node.counterAxisSizing === 'FILL') style[crossAxis] = '100%'
  else if (node.counterAxisSizing !== 'HUG') style[crossAxis] = px(node[crossAxis])
}

function applyPadding(style: Record<string, string>, node: SceneNode): void {
  const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = node
  if (pt === 0 && pr === 0 && pb === 0 && pl === 0) return
  if (pt === pr && pr === pb && pb === pl) style.padding = px(pt)
  else if (pt === pb && pl === pr) style.padding = `${px(pt)} ${px(pl)}`
  else style.padding = `${px(pt)} ${px(pr)} ${px(pb)} ${px(pl)}`
}

function applyLayoutStyle(
  style: Record<string, string>,
  node: SceneNode,
  graph: SceneGraph
): void {
  const ctx = getNodeContext(node, graph)

  if (ctx.isGrid) {
    style.display = 'grid'
    if (node.gridColumnGap > 0) style.columnGap = px(node.gridColumnGap)
    if (node.gridRowGap > 0) style.rowGap = px(node.gridRowGap)
    if (node.width > 0) style.width = px(node.width)
    if (node.gridTemplateRows.length > 0 && node.height > 0) style.height = px(node.height)
  } else if (ctx.isFlex) {
    applyFlexStyle(style, node)
    applyFlexSizing(style, node)
  } else {
    if (node.width > 0) style.width = px(node.width)
    if (node.height > 0) style.height = px(node.height)
  }

  if (ctx.parentIsAutoLayout && node.layoutGrow > 0) style.flexGrow = '1'
  if (ctx.isAutoLayout) applyPadding(style, node)
}

function applyAppearanceStyle(style: Record<string, string>, node: SceneNode): void {
  const bg = solidFillColor(node.fills)
  if (bg && node.type !== 'TEXT') style.backgroundColor = bg

  const stroke = solidStroke(node.strokes)
  if (stroke) {
    style.borderWidth = px(stroke.weight)
    style.borderColor = stroke.color
    style.borderStyle = 'solid'
  }

  if (node.cornerRadius > 0) {
    if (node.independentCorners) {
      style.borderRadius = `${px(node.topLeftRadius)} ${px(node.topRightRadius)} ${px(node.bottomRightRadius)} ${px(node.bottomLeftRadius)}`
    } else {
      style.borderRadius = node.cornerRadius >= 9999 ? '9999px' : px(node.cornerRadius)
    }
  }

  if (node.opacity < 1) style.opacity = String(node.opacity)
  if (node.rotation !== 0) style.transform = `rotate(${node.rotation}deg)`
  if (node.clipsContent) style.overflow = 'hidden'

  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : ''
      const spread = effect.spread !== 0 ? ` ${px(effect.spread)}` : ''
      const color = colorToCSSCompact(effect.color)
      style.boxShadow = `${inset}${px(effect.offset.x)} ${px(effect.offset.y)} ${px(effect.radius)}${spread} ${color}`
    } else if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR') {
      style.filter = `blur(${px(effect.radius)})`
    } else {
      style.backdropFilter = `blur(${px(effect.radius)})`
    }
  }
}

function applyTextStyle(style: Record<string, string>, node: SceneNode): void {
  if (node.type !== 'TEXT') return
  style.fontSize = px(node.fontSize)
  if (node.fontFamily && node.fontFamily !== DEFAULT_FONT_FAMILY)
    style.fontFamily = node.fontFamily
  if (node.fontWeight !== 400) style.fontWeight = String(node.fontWeight)
  if (node.textAlignHorizontal !== 'LEFT')
    style.textAlign = node.textAlignHorizontal.toLowerCase()
  const textColor = solidFillColor(node.fills)
  if (textColor) style.color = textColor
}

function nodeToStyle(node: SceneNode, graph: SceneGraph): Record<string, string> {
  const style: Record<string, string> = {}
  applyLayoutStyle(style, node, graph)
  applyAppearanceStyle(style, node)
  applyTextStyle(style, node)
  return style
}

export function collectTailwindClasses(node: SceneNode, graph: SceneGraph): string[] {
  const style = nodeToStyle(node, graph)
  const ctx = getNodeContext(node, graph)

  const extraClasses: string[] = []

  if (ctx.isGrid) extraClasses.push(...collectGridClasses(node))
  if (ctx.parentIsGrid) extraClasses.push(...collectGridPositionClasses(node))
  if (node.layoutDirection === 'RTL') extraClasses.push('[direction:rtl]')
  if (node.type === 'TEXT' && resolveNodeTextDirection(node) === 'RTL')
    extraClasses.push('[direction:rtl]')

  const twirlClasses = twirl(style)
  const combined = twirlClasses ? twirlClasses.split(' ') : []

  if (style.display === 'grid') {
    const filtered = combined.filter((c) => c !== 'grid')
    return [...extraClasses, ...filtered]
  }

  return [...extraClasses, ...combined]
}
