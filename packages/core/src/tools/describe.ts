import { colorDistance, colorToHex } from '../color'

import { defineTool } from './schema'

import type { Color } from '../types'
import type { SceneGraph, SceneNode } from '../scene-graph'

const NAME_ROLE_PATTERNS: { pattern: RegExp; role: string }[] = [
  { pattern: /^button$/i, role: 'button' },
  { pattern: /^btn[-_\s]/i, role: 'button' },
  { pattern: /[-_\s]btn$/i, role: 'button' },
  { pattern: /^cta$/i, role: 'button' },
  { pattern: /^icon[-_]?button$/i, role: 'button' },
  { pattern: /^link$/i, role: 'link' },
  { pattern: /^text[-_]?link$/i, role: 'link' },
  { pattern: /^input$/i, role: 'textbox' },
  { pattern: /^text[-_]?field$/i, role: 'textbox' },
  { pattern: /^search$/i, role: 'searchbox' },
  { pattern: /^checkbox$/i, role: 'checkbox' },
  { pattern: /^toggle$/i, role: 'switch' },
  { pattern: /^switch$/i, role: 'switch' },
  { pattern: /^radio$/i, role: 'radio' },
  { pattern: /^select$/i, role: 'combobox' },
  { pattern: /^dropdown$/i, role: 'combobox' },
  { pattern: /^slider$/i, role: 'slider' },
  { pattern: /^tab$/i, role: 'tab' },
  { pattern: /^tabs$/i, role: 'tablist' },
  { pattern: /^nav(bar|igation)?$/i, role: 'navigation' },
  { pattern: /^header$/i, role: 'banner' },
  { pattern: /^footer$/i, role: 'contentinfo' },
  { pattern: /^sidebar$/i, role: 'complementary' },
  { pattern: /^modal$/i, role: 'dialog' },
  { pattern: /^dialog$/i, role: 'dialog' },
  { pattern: /^tooltip$/i, role: 'tooltip' },
  { pattern: /^card$/i, role: 'article' },
  { pattern: /^avatar$/i, role: 'img' },
  { pattern: /^badge$/i, role: 'status' },
  { pattern: /^toast$/i, role: 'alert' },
  { pattern: /^alert$/i, role: 'alert' },
  { pattern: /^list$/i, role: 'list' },
  { pattern: /^menu$/i, role: 'menu' },
  { pattern: /^breadcrumb/i, role: 'navigation' },
  { pattern: /^progress$/i, role: 'progressbar' },
  { pattern: /^spinner$/i, role: 'progressbar' },
  { pattern: /^divider$/i, role: 'separator' },
  { pattern: /^separator$/i, role: 'separator' },
]

function detectRoleFromName(name: string): string | null {
  const base = (name.split(/[/,=]/)[0] ?? name).trim()
  for (const { pattern, role } of NAME_ROLE_PATTERNS) {
    if (pattern.test(base)) return role
  }
  return null
}

function headingLevel(fontSize: number): number | null {
  if (fontSize >= 32) return 1
  if (fontSize >= 24) return 2
  if (fontSize >= 20) return 3
  if (fontSize >= 18) return 4
  return null
}

function looksLikeSeparator(node: SceneNode): boolean {
  if (node.width <= 2 && node.height > 10) return true
  if (node.height <= 2 && node.width > 10) return true
  const ratio = Math.max(node.width, node.height) / Math.max(1, Math.min(node.width, node.height))
  return ratio > 10 && Math.min(node.width, node.height) <= 4
}

const BUTTON_MAX_WIDTH = 200
const BUTTON_MAX_HEIGHT = 50
const BUTTON_MIN_HEIGHT = 28
const BUTTON_MIN_RADIUS = 2

function looksLikeButton(node: SceneNode): boolean {
  if (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE') return false
  if (node.width > BUTTON_MAX_WIDTH || node.height > BUTTON_MAX_HEIGHT || node.height < BUTTON_MIN_HEIGHT) return false
  if (node.fills.length === 0 && node.strokes.length === 0) return false
  if (node.cornerRadius < BUTTON_MIN_RADIUS) return false
  return node.childIds.length > 0
}

function describeVisual(node: SceneNode): string {
  const parts: string[] = []
  const fill = node.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (fill) parts.push(`${colorToHex(fill.color)} fill`)
  if (node.strokes.length > 0 && node.strokes[0]?.visible) parts.push('bordered')
  if (node.cornerRadius > 0) parts.push('rounded')
  if (node.clipsContent) parts.push('clipped')
  for (const e of node.effects) {
    if (!e.visible) continue
    if (e.type === 'DROP_SHADOW') parts.push('drop shadow')
    else if (e.type === 'INNER_SHADOW') parts.push('inner shadow')
    else if (e.type === 'LAYER_BLUR' || e.type === 'FOREGROUND_BLUR') parts.push('blurred')
    else parts.push('backdrop blur')
  }
  return parts.join(', ') || 'no visual styles'
}

function describeLayout(node: SceneNode): string | null {
  if (node.layoutMode === 'NONE') return null
  const dir = node.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical'
  const parts = [dir]
  if (node.itemSpacing > 0) parts.push(`${node.itemSpacing}px gap`)
  const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
  const allSame = pad.every((p) => p === pad[0])
  const first = pad[0]
  if (allSame && first > 0) parts.push(`${first}px padding`)
  else if (pad.some((p) => p > 0)) parts.push(`padding ${pad.join('/')}`)
  if (node.layoutWrap === 'WRAP') parts.push('wrap')
  return parts.join(', ')
}

const MIN_FILL_OPACITY = 0.15
const MIN_STROKE_OPACITY = 0.20
const LOW_CONTRAST_THRESHOLD = 15

interface DescribeIssue {
  message: string
  suggestion?: string
}

function findAncestorBackground(node: SceneNode, graph: SceneGraph): Color | null {
  let current = node.parentId ? graph.getNode(node.parentId) : null
  while (current) {
    const solidFill = current.fills.find((f) => f.visible && f.type === 'SOLID' && f.opacity > 0.5)
    if (solidFill) return solidFill.color
    current = current.parentId ? graph.getNode(current.parentId) : null
  }
  return null
}

function detectStructuralIssues(node: SceneNode, gridSize: number, issues: DescribeIssue[]): void {
  if (node.x % 1 !== 0 || node.y % 1 !== 0) {
    issues.push({
      message: `Subpixel position (${node.x}, ${node.y})`,
      suggestion: `(${Math.round(node.x)}, ${Math.round(node.y)})`
    })
  }
  const isContainer = node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (isContainer && node.fills.length === 0 && node.childIds.length === 0) {
    issues.push({ message: 'Empty frame with no fill' })
  }
  const isShape = node.type === 'RECTANGLE' || node.type === 'ELLIPSE' ||
    node.type === 'STAR' || node.type === 'POLYGON' || node.type === 'LINE'
  const hasVisibleFill = node.fills.some((f) => f.visible)
  const hasVisibleStroke = node.strokes.some((s) => s.visible)
  if (isShape && !hasVisibleFill && !hasVisibleStroke) {
    issues.push({
      message: `${node.type} "${node.name}" has no fill and no stroke — invisible`,
      suggestion: 'Add bg="#hex" or stroke="#hex"'
    })
  }
  const ICON_MAX_SIZE = 48
  const looksLikeIcon = isContainer &&
    node.width <= ICON_MAX_SIZE && node.height <= ICON_MAX_SIZE &&
    node.childIds.length > 0
  if (looksLikeIcon && !hasVisibleFill && !hasVisibleStroke) {
    const hasVisibleChild = node.childIds.some((id) => {
      const c = graph.getNode(id)
      return c && c.visible && (c.fills.some((f) => f.visible) || c.strokes.some((s) => s.visible) || c.type === 'TEXT')
    })
    if (!hasVisibleChild) {
      issues.push({
        message: `Icon-sized frame "${node.name}" (${node.width}×${node.height}) has no visible content`,
        suggestion: 'Add bg="#hex" or stroke="#hex" to the icon or its children'
      })
    }
  }
  if (looksLikeButton(node) && node.width < 44) {
    issues.push({ message: `Touch target too small (${node.width}×${node.height})`, suggestion: 'Min 44×44' })
  }
  if (node.itemSpacing > 0 && node.itemSpacing % gridSize !== 0) {
    const nearest = Math.round(node.itemSpacing / gridSize) * gridSize
    issues.push({ message: `Gap ${node.itemSpacing} not on ${gridSize}px grid`, suggestion: `${nearest}` })
  }
}

function detectVisibilityIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  for (const fill of node.fills) {
    if (!fill.visible || fill.type !== 'SOLID') continue
    if (fill.opacity < MIN_FILL_OPACITY) {
      issues.push({
        message: `Near-invisible fill ${colorToHex(fill.color)} at ${Math.round(fill.opacity * 100)}% opacity`,
        suggestion: `Increase to at least ${Math.round(MIN_FILL_OPACITY * 100)}%`
      })
    }
  }
  for (const stroke of node.strokes) {
    if (!stroke.visible || stroke.opacity >= MIN_STROKE_OPACITY) continue
    issues.push({
      message: `Near-invisible stroke at ${Math.round(stroke.opacity * 100)}% opacity`,
      suggestion: `Increase to at least ${Math.round(MIN_STROKE_OPACITY * 100)}%`
    })
  }
  if (node.type !== 'TEXT' || !node.parentId) return
  const textFill = node.fills.find((f) => f.visible && f.type === 'SOLID')
  if (!textFill) return
  const parentBg = findAncestorBackground(node, graph)
  if (!parentBg) return
  const dist = colorDistance(textFill.color, parentBg)
  if (dist < LOW_CONTRAST_THRESHOLD) {
    issues.push({
      message: `Low contrast: text ${colorToHex(textFill.color)} on ${colorToHex(parentBg)} (distance ${Math.round(dist)})`,
      suggestion: 'Increase color difference between text and background'
    })
  }
}

const DARK_BG_LUMINANCE = 0.35
const DEFAULT_TEXT_LUMINANCE = 0.0

function rgbLuminance(c: Color): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

function detectLayoutIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  const isContainer = node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (!isContainer) return

  const isAutoLayout = node.layoutMode !== 'NONE'
  const isRow = node.layoutMode === 'HORIZONTAL'
  const children = node.childIds
    .map((id) => graph.getNode(id))
    .filter((c): c is SceneNode => c != null && c.visible && c.layoutPositioning !== 'ABSOLUTE')

  if (isAutoLayout) {
    const primarySizing = node.primaryAxisSizing
    const primaryDim = isRow ? node.width : node.height
    const pad = isRow
      ? node.paddingLeft + node.paddingRight
      : node.paddingTop + node.paddingBottom
    const spacing = children.length > 1 ? (children.length - 1) * node.itemSpacing : 0
    const available = primaryDim - pad - spacing

    // grow inside HUG parent — grow has no effect
    if (primarySizing === 'HUG') {
      for (const child of children) {
        if (child.layoutGrow > 0) {
          issues.push({
            message: `"${child.name}" has grow=${child.layoutGrow} but parent "${node.name}" is HUG on ${isRow ? 'horizontal' : 'vertical'} axis`,
            suggestion: `Set parent to fixed size, or remove grow from "${child.name}"`
          })
        }
      }
    }

    // Children overflow parent on primary axis (compare actual computed sizes)
    if (primarySizing === 'FIXED' && !node.clipsContent) {
      let totalChildren = 0
      for (const child of children) {
        totalChildren += isRow ? child.width : child.height
      }
      if (totalChildren > available + 1) {
        issues.push({
          message: `Children total ${Math.round(totalChildren)}px exceeds available ${Math.round(available)}px on ${isRow ? 'horizontal' : 'vertical'} axis`,
          suggestion: 'Use grow/fill for flexible sizing, reduce child sizes, or set overflow="hidden"'
        })
      }
    }

    // HUG container where ALL children use fill → collapses
    const crossHug = node.counterAxisSizing === 'HUG'
    if (primarySizing === 'HUG' && children.length > 0) {
      const allGrow = children.every((c) => c.layoutGrow > 0)
      if (allGrow) {
        issues.push({
          message: `"${node.name}" is HUG but all children use grow — no child provides a concrete size`,
          suggestion: 'Give at least one child a fixed size, or set parent to fixed size'
        })
      }
    }
    if (crossHug && children.length > 0) {
      const allStretch = children.every(
        (c) => c.layoutAlignSelf === 'STRETCH' || (node.counterAxisAlign === 'STRETCH' && c.layoutAlignSelf === 'AUTO')
      )
      const noConcreteChild = children.every((c) => {
        const dim = isRow ? c.height : c.width
        return dim <= 0
      })
      if (allStretch && noConcreteChild) {
        issues.push({
          message: `"${node.name}" is HUG on cross axis but all children stretch — no child provides a concrete size`,
          suggestion: 'Give at least one child a fixed cross-axis size, or set parent cross-axis to fixed'
        })
      }
    }
  }

  // Text without any fill = invisible
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || child.type !== 'TEXT' || !child.visible) continue
    const textFill = child.fills.find((f) => f.visible && f.type === 'SOLID')
    if (!textFill) {
      issues.push({
        message: `"${child.name || child.characters?.slice(0, 20) || 'Text'}" has no color — invisible`,
        suggestion: 'Add color="#hex" to the Text element'
      })
      continue
    }
    const textLum = rgbLuminance(textFill.color)
    if (textLum > DARK_BG_LUMINANCE) continue
    const bg = findAncestorBackground(child, graph)
    if (!bg) continue
    if (rgbLuminance(bg) < DARK_BG_LUMINANCE) {
      issues.push({
        message: `"${child.name || child.characters?.slice(0, 20) || 'Text'}" is dark text (${colorToHex(textFill.color)}) on dark background (${colorToHex(bg)})`,
        suggestion: 'Set an explicit light color on the text'
      })
    }
  }

  // Child with fixed size larger than parent (direct overflow)
  if (isAutoLayout && !node.clipsContent) {
    const crossPad = isRow
      ? node.paddingTop + node.paddingBottom
      : node.paddingLeft + node.paddingRight
    const crossAvailable = (isRow ? node.height : node.width) - crossPad
    for (const child of children) {
      const childCross = isRow ? child.height : child.width
      if (childCross > crossAvailable + 1 && child.layoutAlignSelf !== 'STRETCH') {
        issues.push({
          message: `"${child.name}" is ${Math.round(childCross)}px on cross axis but parent has ${Math.round(crossAvailable)}px available`,
          suggestion: 'Reduce child size, use fill sizing, or set overflow="hidden" on parent'
        })
      }
    }
  }
}

const RADIUS_TOLERANCE = 2

function detectRadiusIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (node.cornerRadius <= 0 || node.layoutMode === 'NONE') return

  const minPad = Math.min(node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft)
  if (minPad <= 0) return
  const expectedInner = Math.max(0, node.cornerRadius - minPad)

  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible || child.cornerRadius <= 0) continue
    if (child.layoutPositioning === 'ABSOLUTE') continue
    if (child.cornerRadius > node.cornerRadius + RADIUS_TOLERANCE) {
      issues.push({
        message: `"${child.name}" radius ${child.cornerRadius} exceeds parent "${node.name}" radius ${node.cornerRadius}`,
        suggestion: `Use rounded={${expectedInner}} (parent ${node.cornerRadius} − padding ${minPad})`
      })
    } else if (child.cornerRadius > expectedInner + RADIUS_TOLERANCE && expectedInner < node.cornerRadius) {
      issues.push({
        message: `"${child.name}" radius ${child.cornerRadius} should be ${expectedInner} (parent ${node.cornerRadius} − padding ${minPad})`,
        suggestion: `Use rounded={${expectedInner}}`
      })
    }
  }
}

const UPPERCASE_MAX_SIZE = 13

function detectTypographyIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || child.type !== 'TEXT' || !child.visible) continue
    const text = child.characters ?? child.text ?? ''

    // Uppercase body text — should only be used on small labels/overlines
    if (text === text.toUpperCase() && text.length > 1 && /[A-ZА-ЯЁ]/.test(text) && child.fontSize > UPPERCASE_MAX_SIZE) {
      issues.push({
        message: `"${text.slice(0, 30)}" is uppercase at ${child.fontSize}px — uppercase is for small labels (≤${UPPERCASE_MAX_SIZE}px)`,
        suggestion: `Reduce size to ≤${UPPERCASE_MAX_SIZE}px or use mixed case`
      })
    }
  }
}

function detectIssues(node: SceneNode, gridSize: number, graph: SceneGraph): DescribeIssue[] {
  const issues: DescribeIssue[] = []
  detectStructuralIssues(node, gridSize, issues)
  detectVisibilityIssues(node, graph, issues)
  detectLayoutIssues(node, graph, issues)
  detectRadiusIssues(node, graph, issues)
  detectTypographyIssues(node, graph, issues)
  return issues
}

function detectRole(node: SceneNode): string {
  const nameDetected = detectRoleFromName(node.name)
  if (nameDetected) return nameDetected
  if (node.type === 'TEXT') {
    const level = headingLevel(node.fontSize)
    return level ? `heading(${level})` : 'StaticText'
  }
  if (looksLikeSeparator(node)) return 'separator'
  if (looksLikeButton(node)) return 'button'
  return 'generic'
}

function describeChild(node: SceneNode): { role: string; name: string; summary: string; id: string } {
  const role = detectRole(node)
  let summary = ''
  if (node.type === 'TEXT') {
    const text = node.text.slice(0, 60)
    summary = `"${text}" ${node.fontSize}px ${node.fontFamily}`
    if (node.fontWeight >= 700) summary += ' bold'
    else if (node.fontWeight >= 500) summary += ' medium'
    const textColor = node.fills.find((f) => f.type === 'SOLID' && f.visible)
    if (textColor) summary += `, ${colorToHex(textColor.color)}`
  } else {
    summary = `${node.width}×${node.height}`
    const fill = node.fills.find((f) => f.type === 'SOLID' && f.visible)
    if (fill) summary += `, ${colorToHex(fill.color)}`
    if (node.cornerRadius > 0) summary += ', rounded'
  }
  return { role, name: node.name, summary, id: node.id }
}

export const describe = defineTool({
  name: 'describe',
  description:
    'Semantic description of a node: role, visual style, layout, children summary, and design issues.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    grid: { type: 'number', description: 'Grid size for alignment checks (default: 8)' }
  },
  execute: (figma, args) => {
    const gridSize = args.grid ?? 8
    const raw = figma.graph.getNode(args.id)
    if (!raw) return { error: `Node "${args.id}" not found` }

    const role = detectRole(raw)
    const visual = describeVisual(raw)
    const layout = describeLayout(raw)
    const issues = detectIssues(raw, gridSize, figma.graph)

    const children: { role: string; name: string; summary: string; id: string }[] = []
    for (const childId of raw.childIds) {
      const child = figma.graph.getNode(childId)
      if (!child || !child.visible) continue
      children.push(describeChild(child))
    }

    const result: Record<string, unknown> = {
      id: raw.id,
      name: raw.name,
      type: raw.type,
      role,
      size: `${raw.width}×${raw.height}`,
      visual,
    }
    if (layout) result.layout = layout
    if (children.length > 0) result.children = children
    if (issues.length > 0) result.issues = issues

    return result
  }
})
