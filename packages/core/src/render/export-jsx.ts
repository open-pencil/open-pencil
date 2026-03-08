import { colorToHex8, colorToCSSCompact } from '../color'
import { DEFAULT_FONT_FAMILY } from '../constants'
import {
  pxToSpacing,
  colorToTwClass,
  fontSizeToTw,
  fontWeightToTw,
  borderRadiusToTw,
  opacityToTw
} from './tailwind'

import type {
  SceneGraph,
  SceneNode,
  Fill,
  Stroke,
  Effect,
  NodeType,
  Color,
  GridTrack
} from '../scene-graph'

export type JSXFormat = 'openpencil' | 'tailwind'

const NODE_TYPE_TO_TAG: Partial<Record<NodeType, string>> = {
  FRAME: 'Frame',
  RECTANGLE: 'Rectangle',
  ROUNDED_RECTANGLE: 'Rectangle',
  ELLIPSE: 'Ellipse',
  TEXT: 'Text',
  LINE: 'Line',
  STAR: 'Star',
  POLYGON: 'Polygon',
  VECTOR: 'Vector',
  GROUP: 'Group',
  SECTION: 'Section',
  COMPONENT: 'Component',
  COMPONENT_SET: 'Frame',
  INSTANCE: 'Frame'
}

const NODE_TYPE_TO_TW_TAG: Partial<Record<NodeType, string>> = {
  FRAME: 'div',
  RECTANGLE: 'div',
  ROUNDED_RECTANGLE: 'div',
  ELLIPSE: 'div',
  TEXT: 'p',
  LINE: 'div',
  STAR: 'div',
  POLYGON: 'div',
  VECTOR: 'div',
  GROUP: 'div',
  SECTION: 'section',
  COMPONENT: 'div',
  COMPONENT_SET: 'div',
  INSTANCE: 'div'
}

function formatColor(color: Color, opacity = 1): string {
  return colorToHex8(color, opacity)
}

function solidFillColor(fills: Fill[]): string | null {
  const visible = fills.filter((f) => f.visible && f.type === 'SOLID')
  if (visible.length !== 1) return null
  return formatColor(visible[0].color, visible[0].opacity)
}

function solidStroke(strokes: Stroke[]): { color: string; weight: number } | null {
  const visible = strokes.filter((s) => s.visible)
  if (visible.length !== 1) return null
  return {
    color: formatColor(visible[0].color, visible[0].opacity),
    weight: visible[0].weight
  }
}

function formatShadow(e: Effect): string | null {
  if (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') return null
  return `${e.offset.x} ${e.offset.y} ${e.radius} ${formatColor(e.color, e.color.a)}`
}

function formatTailwindShadow(e: Effect): string | null {
  if (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') return null
  const color = colorToCSSCompact(e.color)
  const inset = e.type === 'INNER_SHADOW' ? 'inset_' : ''
  const spread = e.spread !== 0 ? `_${e.spread}px` : ''
  return `${inset}${e.offset.x}px_${e.offset.y}px_${e.radius}px${spread}_${color}`
}

function formatTailwindAngle(degrees: number): string {
  const rounded = Number(degrees.toFixed(2))
  const integer = Math.round(rounded)
  const named = new Set([0, 1, 2, 3, 6, 12, 45, 90, 180])
  if (rounded === integer && named.has(integer)) return String(integer)
  return `[${rounded}deg]`
}

function formatTailwindFontFamily(fontFamily: string): string {
  const escaped = fontFamily.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `['${escaped}']`
}

const JSX_ENTITY: Record<string, string> = {
  '{': '&#123;',
  '}': '&#125;',
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;'
}

function escapeJSXText(text: string): string {
  return text.replace(/[{}<>&]/g, (c) => JSX_ENTITY[c]!)
}

function formatProp(key: string, value: unknown): string {
  if (typeof value === 'string') return `${key}="${value}"`
  if (typeof value === 'number') return `${key}={${value}}`
  if (typeof value === 'boolean') return value ? key : `${key}={false}`
  return `${key}={${JSON.stringify(value)}}`
}

function getNodeContext(node: SceneNode, graph: SceneGraph) {
  const parent = node.parentId ? graph.getNode(node.parentId) : null
  return {
    isAutoLayout: node.layoutMode !== 'NONE',
    isGrid: node.layoutMode === 'GRID',
    isFlex: node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL',
    parentIsAutoLayout: parent ? parent.layoutMode !== 'NONE' : false,
    parentIsGrid: parent ? parent.layoutMode === 'GRID' : false
  }
}

type PaddingEdges = { pt: number; pr: number; pb: number; pl: number }

function collectPadding(node: SceneNode): PaddingEdges | null {
  const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = node
  if (pt === 0 && pr === 0 && pb === 0 && pl === 0) return null
  return { pt, pr, pb, pl }
}

function emitPadding<T>(
  edges: PaddingEdges,
  uniform: (v: number) => T,
  symmetric: (y: number, x: number) => T[],
  individual: (edges: PaddingEdges) => T[]
): T[] {
  const { pt, pr, pb, pl } = edges
  if (pt === pr && pr === pb && pb === pl) return [uniform(pt)]
  if (pt === pb && pl === pr) return symmetric(pt, pl)
  return individual(edges)
}

interface CornerRadii {
  tl: number
  tr: number
  br: number
  bl: number
}

function collectCornerRadii(node: SceneNode): CornerRadii | null {
  if (node.cornerRadius <= 0) return null
  if (node.independentCorners) {
    return {
      tl: node.topLeftRadius,
      tr: node.topRightRadius,
      br: node.bottomRightRadius,
      bl: node.bottomLeftRadius
    }
  }
  const r = node.cornerRadius
  return { tl: r, tr: r, br: r, bl: r }
}

function formatTrack(t: GridTrack): string {
  if (t.sizing === 'FR') return `${t.value}fr`
  if (t.sizing === 'FIXED') return `${t.value}px`
  return 'auto'
}

function formatTracks(tracks: GridTrack[]): string {
  return tracks.map(formatTrack).join(' ')
}

// --- OpenPencil format ---

function collectProps(node: SceneNode, graph: SceneGraph): [string, unknown][] {
  const props: [string, unknown][] = []
  const { isAutoLayout, isGrid, isFlex, parentIsAutoLayout, parentIsGrid } = getNodeContext(
    node,
    graph
  )

  if (node.name && node.name !== node.type) {
    props.push(['name', node.name])
  }

  if (isGrid) {
    props.push(['grid', true])
    if (node.gridTemplateColumns.length > 0)
      props.push(['columns', formatTracks(node.gridTemplateColumns)])
    if (node.gridTemplateRows.length > 0)
      props.push(['rows', formatTracks(node.gridTemplateRows)])
    if (node.width > 0) props.push(['w', node.width])
    if (node.height > 0) props.push(['h', node.height])
    if (node.gridColumnGap > 0) props.push(['columnGap', node.gridColumnGap])
    if (node.gridRowGap > 0) props.push(['rowGap', node.gridRowGap])
  } else if (isFlex) {
    props.push(['flex', node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'])
    const primaryAxis = node.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
    const crossAxis = node.layoutMode === 'HORIZONTAL' ? 'height' : 'width'

    if (node.primaryAxisSizing === 'FILL')
      props.push([primaryAxis === 'width' ? 'w' : 'h', 'fill'])
    else if (node.primaryAxisSizing !== 'HUG')
      props.push([primaryAxis === 'width' ? 'w' : 'h', node[primaryAxis]])

    if (node.counterAxisSizing === 'FILL')
      props.push([crossAxis === 'width' ? 'w' : 'h', 'fill'])
    else if (node.counterAxisSizing !== 'HUG')
      props.push([crossAxis === 'width' ? 'w' : 'h', node[crossAxis]])
  } else {
    if (node.width > 0) props.push(['w', node.width])
    if (node.height > 0) props.push(['h', node.height])
  }

  if (parentIsAutoLayout && node.layoutGrow > 0) props.push(['grow', node.layoutGrow])

  if (parentIsGrid && node.gridPosition) {
    const pos = node.gridPosition
    if (pos.column > 0) props.push(['colStart', pos.column])
    if (pos.row > 0) props.push(['rowStart', pos.row])
    if (pos.columnSpan > 1) props.push(['colSpan', pos.columnSpan])
    if (pos.rowSpan > 1) props.push(['rowSpan', pos.rowSpan])
  }

  if (isFlex && node.itemSpacing > 0) props.push(['gap', node.itemSpacing])

  if (isFlex && node.layoutWrap === 'WRAP') {
    props.push(['wrap', true])
    if (node.counterAxisSpacing > 0) props.push(['rowGap', node.counterAxisSpacing])
  }

  if (isFlex) {
    if (node.primaryAxisAlign === 'CENTER') props.push(['justify', 'center'])
    else if (node.primaryAxisAlign === 'MAX') props.push(['justify', 'end'])
    else if (node.primaryAxisAlign === 'SPACE_BETWEEN') props.push(['justify', 'between'])

    if (node.counterAxisAlign === 'CENTER') props.push(['items', 'center'])
    else if (node.counterAxisAlign === 'MAX') props.push(['items', 'end'])
    else if (node.counterAxisAlign === 'STRETCH') props.push(['items', 'stretch'])
  }

  if (isAutoLayout) {
    const pad = collectPadding(node)
    if (pad) {
      props.push(
        ...emitPadding(
          pad,
          (v) => ['p', v] as [string, unknown],
          (y, x) => [['py', y], ['px', x]] as [string, unknown][],
          ({ pt, pr, pb, pl }) => {
            const r: [string, unknown][] = []
            if (pt > 0) r.push(['pt', pt])
            if (pr > 0) r.push(['pr', pr])
            if (pb > 0) r.push(['pb', pb])
            if (pl > 0) r.push(['pl', pl])
            return r
          }
        )
      )
    }
  }

  const bg = solidFillColor(node.fills)
  if (bg) props.push(['bg', bg])

  const stroke = solidStroke(node.strokes)
  if (stroke) {
    props.push(['stroke', stroke.color])
    if (stroke.weight !== 1) props.push(['strokeWidth', stroke.weight])
  }

  const corners = collectCornerRadii(node)
  if (corners) {
    const { tl, tr, br, bl } = corners
    if (tl === tr && tr === br && br === bl) {
      props.push(['rounded', tl])
    } else {
      if (tl > 0) props.push(['roundedTL', tl])
      if (tr > 0) props.push(['roundedTR', tr])
      if (br > 0) props.push(['roundedBR', br])
      if (bl > 0) props.push(['roundedBL', bl])
    }
  }

  if (node.cornerSmoothing > 0) props.push(['cornerSmoothing', node.cornerSmoothing])
  if (node.opacity < 1) props.push(['opacity', Math.round(node.opacity * 100) / 100])
  if (node.rotation !== 0) props.push(['rotate', Math.round(node.rotation * 100) / 100])
  if (node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
    props.push(['blendMode', node.blendMode.toLowerCase()])
  }
  if (node.clipsContent) props.push(['overflow', 'hidden'])

  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      const shadow = formatShadow(effect)
      if (shadow) props.push(['shadow', shadow])
    } else if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
      props.push(['blur', effect.radius])
    }
  }

  if (node.type === 'TEXT') {
    if (node.fontSize !== 14) props.push(['size', node.fontSize])
    if (node.fontFamily && node.fontFamily !== DEFAULT_FONT_FAMILY)
      props.push(['font', node.fontFamily])
    if (node.fontWeight !== 400) {
      if (node.fontWeight === 700) props.push(['weight', 'bold'])
      else if (node.fontWeight === 500) props.push(['weight', 'medium'])
      else props.push(['weight', node.fontWeight])
    }
    if (node.textAlignHorizontal !== 'LEFT') {
      props.push(['textAlign', node.textAlignHorizontal.toLowerCase()])
    }
    const textColor = solidFillColor(node.fills)
    if (textColor) {
      const bgIdx = props.findIndex(([k]) => k === 'bg')
      if (bgIdx !== -1) props.splice(bgIdx, 1)
      props.push(['color', textColor])
    }
  }

  if (node.type === 'STAR') {
    if (node.pointCount !== 5) props.push(['points', node.pointCount])
    if (node.starInnerRadius !== 0.382) props.push(['innerRadius', node.starInnerRadius])
  }
  if (node.type === 'POLYGON' && node.pointCount !== 3) {
    props.push(['points', node.pointCount])
  }

  return props
}

// --- Tailwind CSS v4 format ---

function twRounded(prefix: string, px: number): string {
  const r = borderRadiusToTw(px)
  return r ? `${prefix}-${r}` : prefix
}

function gridTemplateTw(tracks: GridTrack[]): string {
  const allEqual1Fr = tracks.every((t) => t.sizing === 'FR' && t.value === 1)
  if (allEqual1Fr) return String(tracks.length)
  return `[${tracks.map(formatTrack).join('_')}]`
}

function collectTailwindClasses(node: SceneNode, graph: SceneGraph): string[] {
  const classes: string[] = []
  const { isAutoLayout, isGrid, isFlex, parentIsAutoLayout, parentIsGrid } = getNodeContext(
    node,
    graph
  )

  if (isGrid) {
    classes.push('grid')
    if (node.gridTemplateColumns.length > 0)
      classes.push(`grid-cols-${gridTemplateTw(node.gridTemplateColumns)}`)
    if (node.gridTemplateRows.length > 0)
      classes.push(`grid-rows-${gridTemplateTw(node.gridTemplateRows)}`)
    if (node.width > 0) classes.push(`w-${pxToSpacing(node.width)}`)
    if (node.height > 0) classes.push(`h-${pxToSpacing(node.height)}`)
    if (node.gridColumnGap > 0) classes.push(`gap-x-${pxToSpacing(node.gridColumnGap)}`)
    if (node.gridRowGap > 0) classes.push(`gap-y-${pxToSpacing(node.gridRowGap)}`)
  } else if (isFlex) {
    classes.push('flex')
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
  } else {
    if (node.width > 0) classes.push(`w-${pxToSpacing(node.width)}`)
    if (node.height > 0) classes.push(`h-${pxToSpacing(node.height)}`)
  }

  if (parentIsAutoLayout && node.layoutGrow > 0) classes.push('grow')

  if (parentIsGrid && node.gridPosition) {
    const pos = node.gridPosition
    if (pos.column > 0) classes.push(`col-start-${pos.column}`)
    if (pos.row > 0) classes.push(`row-start-${pos.row}`)
    if (pos.columnSpan > 1) classes.push(`col-span-${pos.columnSpan}`)
    if (pos.rowSpan > 1) classes.push(`row-span-${pos.rowSpan}`)
  }

  if (isFlex && node.itemSpacing > 0) classes.push(`gap-${pxToSpacing(node.itemSpacing)}`)

  if (isFlex && node.layoutWrap === 'WRAP') {
    classes.push('flex-wrap')
    if (node.counterAxisSpacing > 0) classes.push(`gap-y-${pxToSpacing(node.counterAxisSpacing)}`)
  }

  if (isFlex) {
    if (node.primaryAxisAlign === 'CENTER') classes.push('justify-center')
    else if (node.primaryAxisAlign === 'MAX') classes.push('justify-end')
    else if (node.primaryAxisAlign === 'SPACE_BETWEEN') classes.push('justify-between')

    if (node.counterAxisAlign === 'CENTER') classes.push('items-center')
    else if (node.counterAxisAlign === 'MAX') classes.push('items-end')
    else if (node.counterAxisAlign === 'STRETCH') classes.push('items-stretch')
  }

  if (isAutoLayout) {
    const pad = collectPadding(node)
    if (pad) {
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
  }

  const bg = solidFillColor(node.fills)
  if (bg && node.type !== 'TEXT') classes.push(`bg-${colorToTwClass(bg)}`)

  const stroke = solidStroke(node.strokes)
  if (stroke) {
    if (stroke.weight !== 1) classes.push(`border-${pxToSpacing(stroke.weight)}`)
    else classes.push('border')
    classes.push(`border-${colorToTwClass(stroke.color)}`)
  }

  const corners = collectCornerRadii(node)
  if (corners) {
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
    } else if (effect.type === 'BACKGROUND_BLUR') {
      classes.push(`backdrop-blur-[${effect.radius}px]`)
    }
  }

  if (node.type === 'TEXT') {
    classes.push(`text-${fontSizeToTw(node.fontSize)}`)
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

  return classes
}

// --- JSX rendering ---

function nodeToJSX(node: SceneNode, graph: SceneGraph, indent: number, format: JSXFormat): string {
  const tagMap = format === 'tailwind' ? NODE_TYPE_TO_TW_TAG : NODE_TYPE_TO_TAG
  const tag = tagMap[node.type]
  if (!tag) return ''

  const prefix = '  '.repeat(indent)
  let attrsStr: string

  if (format === 'tailwind') {
    const classes = collectTailwindClasses(node, graph)
    const nameAttr = node.name && node.name !== node.type ? ` data-name="${node.name}"` : ''
    const classAttr = classes.length > 0 ? ` className="${classes.join(' ')}"` : ''
    attrsStr = `${nameAttr}${classAttr}`.trim()
  } else {
    const props = collectProps(node, graph)
    attrsStr = props.map(([k, v]) => formatProp(k, v)).join(' ')
  }

  const opening = attrsStr ? `<${tag} ${attrsStr}` : `<${tag}`
  const children = graph.getChildren(node.id)

  if (node.type === 'TEXT') {
    const text = node.text
    if (!text) return `${prefix}${opening} />`
    const escaped = escapeJSXText(text)
    if (!escaped.includes('\n')) {
      return `${prefix}${opening}>${escaped}</${tag}>`
    }
    return [
      `${prefix}${opening}>`,
      ...escaped.split('\n').map((l) => `${prefix}  ${l}`),
      `${prefix}</${tag}>`
    ].join('\n')
  }

  if (children.length === 0) return `${prefix}${opening} />`

  const childJSX = children
    .filter((c) => c.visible)
    .map((c) => nodeToJSX(c, graph, indent + 1, format))
    .filter(Boolean)

  if (childJSX.length === 0) return `${prefix}${opening} />`

  return [`${prefix}${opening}>`, ...childJSX, `${prefix}</${tag}>`].join('\n')
}

export function sceneNodeToJSX(
  nodeId: string,
  graph: SceneGraph,
  format: JSXFormat = 'openpencil'
): string {
  const node = graph.getNode(nodeId)
  if (!node) return ''
  return nodeToJSX(node, graph, 0, format)
}

export function selectionToJSX(
  nodeIds: string[],
  graph: SceneGraph,
  format: JSXFormat = 'openpencil'
): string {
  return nodeIds
    .map((id) => sceneNodeToJSX(id, graph, format))
    .filter(Boolean)
    .join('\n\n')
}
