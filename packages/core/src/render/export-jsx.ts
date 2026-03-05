import { colorToHex } from '../color'
import { DEFAULT_FONT_FAMILY } from '../constants'
import {
  pxToSpacing,
  colorToTwClass,
  fontSizeToTw,
  fontWeightToTw,
  borderRadiusToTw,
  opacityToTw
} from './tailwind'

import type { SceneGraph, SceneNode, Fill, Stroke, Effect, NodeType, Color } from '../scene-graph'

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
  const hex = colorToHex(color)
  if (opacity < 1)
    return (
      hex +
      Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0')
    )
  return hex
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

function collectProps(node: SceneNode, graph: SceneGraph): [string, unknown][] {
  const props: [string, unknown][] = []

  if (node.name && node.name !== node.type) {
    props.push(['name', node.name])
  }

  if (node.layoutMode !== 'NONE') {
    props.push(['flex', node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'])
  }

  const isAutoLayout = node.layoutMode !== 'NONE'
  const parent = node.parentId ? graph.getNode(node.parentId) : null
  const parentIsAutoLayout = parent ? parent.layoutMode !== 'NONE' : false

  if (isAutoLayout) {
    const primaryAxis = node.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
    const crossAxis = node.layoutMode === 'HORIZONTAL' ? 'height' : 'width'

    if (node.primaryAxisSizing === 'HUG') {
      /* hug is default with flex, omit */
    } else if (node.primaryAxisSizing === 'FILL') {
      props.push([primaryAxis === 'width' ? 'w' : 'h', 'fill'])
    } else {
      props.push([primaryAxis === 'width' ? 'w' : 'h', node[primaryAxis]])
    }

    if (node.counterAxisSizing === 'HUG') {
      /* hug is default, omit */
    } else if (node.counterAxisSizing === 'FILL') {
      props.push([crossAxis === 'width' ? 'w' : 'h', 'fill'])
    } else {
      props.push([crossAxis === 'width' ? 'w' : 'h', node[crossAxis]])
    }
  } else {
    if (node.width > 0) props.push(['w', node.width])
    if (node.height > 0) props.push(['h', node.height])
  }

  if (parentIsAutoLayout && node.layoutGrow > 0) {
    props.push(['grow', node.layoutGrow])
  }

  if (isAutoLayout && node.itemSpacing > 0) {
    props.push(['gap', node.itemSpacing])
  }

  if (isAutoLayout && node.layoutWrap === 'WRAP') {
    props.push(['wrap', true])
    if (node.counterAxisSpacing > 0) {
      props.push(['rowGap', node.counterAxisSpacing])
    }
  }

  if (isAutoLayout) {
    if (node.primaryAxisAlign === 'CENTER') props.push(['justify', 'center'])
    else if (node.primaryAxisAlign === 'MAX') props.push(['justify', 'end'])
    else if (node.primaryAxisAlign === 'SPACE_BETWEEN') props.push(['justify', 'between'])

    if (node.counterAxisAlign === 'CENTER') props.push(['items', 'center'])
    else if (node.counterAxisAlign === 'MAX') props.push(['items', 'end'])
    else if (node.counterAxisAlign === 'STRETCH') props.push(['items', 'stretch'])
  }

  if (isAutoLayout) {
    const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = node
    if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
      if (pt === pr && pr === pb && pb === pl) {
        props.push(['p', pt])
      } else if (pt === pb && pl === pr) {
        props.push(['py', pt])
        props.push(['px', pl])
      } else {
        if (pt > 0) props.push(['pt', pt])
        if (pr > 0) props.push(['pr', pr])
        if (pb > 0) props.push(['pb', pb])
        if (pl > 0) props.push(['pl', pl])
      }
    }
  }

  const bg = solidFillColor(node.fills)
  if (bg) props.push(['bg', bg])

  const stroke = solidStroke(node.strokes)
  if (stroke) {
    props.push(['stroke', stroke.color])
    if (stroke.weight !== 1) props.push(['strokeWidth', stroke.weight])
  }

  if (node.cornerRadius > 0) {
    if (node.independentCorners) {
      const {
        topLeftRadius: tl,
        topRightRadius: tr,
        bottomRightRadius: br,
        bottomLeftRadius: bl
      } = node
      if (tl === tr && tr === br && br === bl) {
        props.push(['rounded', tl])
      } else {
        if (tl > 0) props.push(['roundedTL', tl])
        if (tr > 0) props.push(['roundedTR', tr])
        if (br > 0) props.push(['roundedBR', br])
        if (bl > 0) props.push(['roundedBL', bl])
      }
    } else {
      props.push(['rounded', node.cornerRadius])
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
    if (node.fontFamily && node.fontFamily !== DEFAULT_FONT_FAMILY) props.push(['font', node.fontFamily])
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

function collectTailwindClasses(node: SceneNode, graph: SceneGraph): string[] {
  const classes: string[] = []
  const isAutoLayout = node.layoutMode !== 'NONE'

  if (isAutoLayout) {
    classes.push('flex')
    if (node.layoutMode === 'VERTICAL') classes.push('flex-col')
  }

  const parent = node.parentId ? graph.getNode(node.parentId) : null
  const parentIsAutoLayout = parent ? parent.layoutMode !== 'NONE' : false

  if (isAutoLayout) {
    const primaryAxis = node.layoutMode === 'HORIZONTAL' ? 'width' : 'height'
    const crossAxis = node.layoutMode === 'HORIZONTAL' ? 'height' : 'width'
    const wProp = primaryAxis === 'width' ? 'w' : 'h'
    const hProp = crossAxis === 'width' ? 'w' : 'h'

    if (node.primaryAxisSizing === 'FILL') {
      classes.push(`${wProp}-full`)
    } else if (node.primaryAxisSizing !== 'HUG') {
      classes.push(`${wProp}-${pxToSpacing(node[primaryAxis])}`)
    }

    if (node.counterAxisSizing === 'FILL') {
      classes.push(`${hProp}-full`)
    } else if (node.counterAxisSizing !== 'HUG') {
      classes.push(`${hProp}-${pxToSpacing(node[crossAxis])}`)
    }
  } else {
    if (node.width > 0) classes.push(`w-${pxToSpacing(node.width)}`)
    if (node.height > 0) classes.push(`h-${pxToSpacing(node.height)}`)
  }

  if (parentIsAutoLayout && node.layoutGrow > 0) {
    classes.push('grow')
  }

  if (isAutoLayout && node.itemSpacing > 0) {
    classes.push(`gap-${pxToSpacing(node.itemSpacing)}`)
  }

  if (isAutoLayout && node.layoutWrap === 'WRAP') {
    classes.push('flex-wrap')
    if (node.counterAxisSpacing > 0) {
      classes.push(`gap-y-${pxToSpacing(node.counterAxisSpacing)}`)
    }
  }

  if (isAutoLayout) {
    if (node.primaryAxisAlign === 'CENTER') classes.push('justify-center')
    else if (node.primaryAxisAlign === 'MAX') classes.push('justify-end')
    else if (node.primaryAxisAlign === 'SPACE_BETWEEN') classes.push('justify-between')

    if (node.counterAxisAlign === 'CENTER') classes.push('items-center')
    else if (node.counterAxisAlign === 'MAX') classes.push('items-end')
    else if (node.counterAxisAlign === 'STRETCH') classes.push('items-stretch')
  }

  if (isAutoLayout) {
    const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = node
    if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
      if (pt === pr && pr === pb && pb === pl) {
        classes.push(`p-${pxToSpacing(pt)}`)
      } else if (pt === pb && pl === pr) {
        classes.push(`py-${pxToSpacing(pt)}`)
        classes.push(`px-${pxToSpacing(pl)}`)
      } else {
        if (pt > 0) classes.push(`pt-${pxToSpacing(pt)}`)
        if (pr > 0) classes.push(`pr-${pxToSpacing(pr)}`)
        if (pb > 0) classes.push(`pb-${pxToSpacing(pb)}`)
        if (pl > 0) classes.push(`pl-${pxToSpacing(pl)}`)
      }
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

  if (node.cornerRadius > 0) {
    if (node.independentCorners) {
      const {
        topLeftRadius: tl,
        topRightRadius: tr,
        bottomRightRadius: br,
        bottomLeftRadius: bl
      } = node
      if (tl === tr && tr === br && br === bl) {
        const r = borderRadiusToTw(tl)
        classes.push(r ? `rounded-${r}` : 'rounded')
      } else {
        if (tl > 0) {
          const r = borderRadiusToTw(tl)
          classes.push(r ? `rounded-tl-${r}` : 'rounded-tl')
        }
        if (tr > 0) {
          const r = borderRadiusToTw(tr)
          classes.push(r ? `rounded-tr-${r}` : 'rounded-tr')
        }
        if (br > 0) {
          const r = borderRadiusToTw(br)
          classes.push(r ? `rounded-br-${r}` : 'rounded-br')
        }
        if (bl > 0) {
          const r = borderRadiusToTw(bl)
          classes.push(r ? `rounded-bl-${r}` : 'rounded-bl')
        }
      }
    } else {
      const r = borderRadiusToTw(node.cornerRadius)
      classes.push(r ? `rounded-${r}` : 'rounded')
    }
  }

  if (node.opacity < 1) classes.push(`opacity-${opacityToTw(node.opacity)}`)
  if (node.rotation !== 0) classes.push(`rotate-${Math.round(node.rotation)}`)
  if (node.clipsContent) classes.push('overflow-hidden')

  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW') {
      classes.push('shadow')
    } else if (effect.type === 'LAYER_BLUR') {
      classes.push(`blur-[${effect.radius}px]`)
    } else if (effect.type === 'BACKGROUND_BLUR') {
      classes.push(`backdrop-blur-[${effect.radius}px]`)
    }
  }

  if (node.type === 'TEXT') {
    classes.push(`text-${fontSizeToTw(node.fontSize)}`)
    if (node.fontFamily && node.fontFamily !== DEFAULT_FONT_FAMILY) {
      classes.push(`font-['${node.fontFamily.replace(/\s+/g, '_')}']`)
    }
    if (node.fontWeight !== 400) {
      classes.push(`font-${fontWeightToTw(node.fontWeight)}`)
    }
    if (node.textAlignHorizontal !== 'LEFT') {
      classes.push(`text-${node.textAlignHorizontal.toLowerCase()}`)
    }
    const textColor = solidFillColor(node.fills)
    if (textColor) classes.push(`text-${colorToTwClass(textColor)}`)
  }

  return classes
}

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
  const isText = node.type === 'TEXT'

  if (isText) {
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

  if (children.length === 0) {
    return `${prefix}${opening} />`
  }

  const childJSX = children
    .filter((c) => c.visible)
    .map((c) => nodeToJSX(c, graph, indent + 1, format))
    .filter(Boolean)

  if (childJSX.length === 0) {
    return `${prefix}${opening} />`
  }

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
