import { colorToHex } from '#core/color'
import type { SceneNode } from '#core/scene-graph'

export function describeVisual(node: SceneNode): string {
  const parts: string[] = []
  const fill = node.fills.find((candidate) => candidate.type === 'SOLID' && candidate.visible)
  if (fill) parts.push(`${colorToHex(fill.color)} fill`)
  if (node.strokes.length > 0 && node.strokes[0]?.visible) parts.push('bordered')
  if (node.cornerRadius > 0) parts.push('rounded')
  if (node.clipsContent) parts.push('clipped')
  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW') parts.push('drop shadow')
    else if (effect.type === 'INNER_SHADOW') parts.push('inner shadow')
    else if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
      parts.push('blurred')
    else parts.push('backdrop blur')
  }
  return parts.join(', ') || 'no visual styles'
}

const JUSTIFY_LABELS: Record<string, string> = {
  MIN: 'start',
  CENTER: 'center',
  MAX: 'end',
  SPACE_BETWEEN: 'between'
}

const ITEMS_LABELS: Record<string, string> = {
  MIN: 'start',
  CENTER: 'center',
  MAX: 'end',
  STRETCH: 'stretch',
  BASELINE: 'baseline'
}

export function describeLayout(node: SceneNode): string | null {
  if (node.layoutMode === 'NONE') return null
  const direction = node.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical'
  const parts = [direction]
  if (node.primaryAxisAlign !== 'MIN') {
    parts.push(`justify=${JUSTIFY_LABELS[node.primaryAxisAlign] ?? node.primaryAxisAlign}`)
  }
  if (node.counterAxisAlign !== 'MIN') {
    parts.push(`items=${ITEMS_LABELS[node.counterAxisAlign] ?? node.counterAxisAlign}`)
  }
  if (node.itemSpacing > 0) parts.push(`${node.itemSpacing}px gap`)
  const padding = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
  const allSame = padding.every((value) => value === padding[0])
  const first = padding[0]
  if (allSame && first > 0) parts.push(`${first}px padding`)
  else if (padding.some((value) => value > 0)) parts.push(`padding ${padding.join('/')}`)
  if (node.primaryAxisSizing !== 'FIXED') parts.push(`${node.primaryAxisSizing.toLowerCase()} main`)
  if (node.counterAxisSizing !== 'FIXED') {
    parts.push(`${node.counterAxisSizing.toLowerCase()} cross`)
  }
  if (node.layoutWrap === 'WRAP') parts.push('wrap')
  return parts.join(', ')
}

export function summarizeContainer(node: SceneNode): string {
  const parts = [`${node.width}×${node.height}`]
  const fill = node.fills.find((candidate) => candidate.type === 'SOLID' && candidate.visible)
  if (fill) parts.push(colorToHex(fill.color))
  if (node.cornerRadius > 0) parts.push('rounded')
  const layout = describeLayout(node)
  if (layout) parts.push(layout)
  return parts.join(', ')
}

export function summarizeText(node: SceneNode): string {
  const text = node.text.slice(0, 60)
  let summary = `"${text}" ${node.fontSize}px ${node.fontFamily}`
  if (node.fontWeight >= 700) summary += ' bold'
  else if (node.fontWeight >= 500) summary += ' medium'
  const textColor = node.fills.find((fill) => fill.type === 'SOLID' && fill.visible)
  if (textColor) summary += `, ${colorToHex(textColor.color)}`
  if (node.textAutoResize === 'HEIGHT') summary += ', wraps'
  else if (node.textAutoResize === 'NONE') summary += ', fixed-size'
  if (node.maxLines !== null && node.maxLines > 0) summary += `, max ${node.maxLines} lines`
  return summary
}
