import { colorDistance, colorToHex } from '../color'
import { CONTAINER_TYPES, findAncestorBackground, looksLikeButton } from './describe-shared'

import { detectLayoutIssues } from './describe-layout-issues'

import type { SceneGraph, SceneNode } from '../scene-graph'

const MIN_FILL_OPACITY = 0.15
const MIN_STROKE_OPACITY = 0.20
const LOW_CONTRAST_THRESHOLD = 15
const SHAPE_TYPES = new Set(['RECTANGLE', 'ELLIPSE', 'STAR', 'POLYGON', 'LINE'])
const ICON_MAX_SIZE = 48

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface DescribeIssue {
  severity?: IssueSeverity
  message: string
  suggestion?: string
}

function checkEmptyIcon(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return
  if (node.width > ICON_MAX_SIZE || node.height > ICON_MAX_SIZE || node.childIds.length === 0) return
  if (node.fills.some((f) => f.visible) || node.strokes.some((s) => s.visible)) return

  const hasVisibleChild = node.childIds.some((id) => {
    const c = graph.getNode(id)
    return c?.visible && (c.fills.some((f) => f.visible) || c.strokes.some((s) => s.visible) || c.type === 'TEXT')
  })
  if (!hasVisibleChild) {
    issues.push({
      message: `Icon-sized frame "${node.name}" (${node.width}×${node.height}) has no visible content`,
      suggestion: 'Add bg="#hex" or stroke="#hex"'
    })
  }
}

function detectStructuralIssues(node: SceneNode, gridSize: number, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (node.x % 1 !== 0 || node.y % 1 !== 0) {
    issues.push({
      message: `Subpixel position (${node.x}, ${node.y})`,
      suggestion: `(${Math.round(node.x)}, ${Math.round(node.y)})`
    })
  }
  if (CONTAINER_TYPES.has(node.type) && node.fills.length === 0 && node.childIds.length === 0) {
    issues.push({ message: 'Empty frame with no fill' })
  }
  const hasVisibleFill = node.fills.some((f) => f.visible)
  const hasVisibleStroke = node.strokes.some((s) => s.visible)
  if (SHAPE_TYPES.has(node.type) && !hasVisibleFill && !hasVisibleStroke) {
    issues.push({
      message: `${node.type} "${node.name}" has no fill and no stroke — invisible`,
      suggestion: 'Add bg="#hex" or stroke="#hex"'
    })
  }
  checkEmptyIcon(node, graph, issues)
  if (looksLikeButton(node) && node.width < 44) {
    issues.push({ message: `Touch target too small (${node.width}×${node.height})`, suggestion: 'Min 44×44' })
  }
  if (node.itemSpacing > 0 && node.itemSpacing % gridSize !== 0) {
    const nearest = Math.round(node.itemSpacing / gridSize) * gridSize
    issues.push({ message: `Gap ${node.itemSpacing} not on ${gridSize}px grid`, suggestion: `${nearest}` })
  }

  checkStrokeMismatch(node, issues)
  checkRoundedWithoutClip(node, graph, issues)
  checkExcessiveNesting(node, graph, issues)
  checkSameFillAsParent(node, graph, issues)
  checkImagePlaceholder(node, graph, issues)
}

function checkStrokeMismatch(node: SceneNode, issues: DescribeIssue[]): void {
  const hasStrokeColor = node.strokes.some((s) => s.visible)
  const hasStrokeWeight = node.strokes.some((s) => s.weight > 0)
  if (hasStrokeColor && !hasStrokeWeight) {
    issues.push({ message: `"${node.name}" has stroke color but zero weight`, suggestion: 'Set strokeWidth={1} or remove stroke' })
  }
  if (!hasStrokeColor && hasStrokeWeight && node.strokes.length > 0) {
    issues.push({ message: `"${node.name}" has stroke weight but no visible stroke`, suggestion: 'Add stroke="#hex" or remove strokeWidth' })
  }
}

function checkRoundedWithoutClip(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return
  if (node.cornerRadius <= 0 || node.clipsContent) return
  const minDim = Math.min(node.width, node.height)
  if (node.cornerRadius < minDim / 2 - 1) return
  const hasImageChild = node.childIds.some((id) => {
    const c = graph.getNode(id)
    return c?.visible && c.fills.some((f) => f.visible && f.type === 'IMAGE')
  })
  if (hasImageChild) {
    issues.push({
      message: `"${node.name}" is circular/pill but not clipping — image children will overflow rounded corners`,
      suggestion: 'Add overflow="hidden"'
    })
  }
}

function checkExcessiveNesting(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return
  let depth = 0
  let current: SceneNode | undefined = node as SceneNode | undefined
  while (current && CONTAINER_TYPES.has(current.type) && current.childIds.length === 1) {
    const child = graph.getNode(current.childIds[0])
    if (!child || !CONTAINER_TYPES.has(child.type)) break
    if (current.fills.some((f) => f.visible) || current.cornerRadius > 0) break
    depth++
    current = child
  }
  if (depth >= 3) {
    issues.push({
      message: `${depth} levels of single-child wrapper frames starting at "${node.name}"`,
      suggestion: 'Flatten — apply styles directly to the inner content'
    })
  }
}

function checkSameFillAsParent(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (node.type === 'TEXT') return
  if (!node.parentId) return
  const nodeFill = node.fills.find((f) => f.visible && f.type === 'SOLID')
  if (!nodeFill) return
  const parent = graph.getNode(node.parentId)
  if (!parent) return
  const parentFill = parent.fills.find((f) => f.visible && f.type === 'SOLID')
  if (!parentFill) return
  if (colorDistance(nodeFill.color, parentFill.color) < 3) {
    issues.push({
      message: `"${node.name}" fill ${colorToHex(nodeFill.color)} matches parent "${parent.name}" — invisible border`,
      suggestion: 'Use a different fill color or remove fill'
    })
  }
}

function checkImagePlaceholder(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return
  if (!node.clipsContent) return
  if (!/poster|avatar|image|thumb|photo|cover|banner/i.test(node.name)) return
  const hasImage = node.fills.some((f) => f.visible && f.type === 'IMAGE')
  if (hasImage) return
  const childHasImage = node.childIds.some((id) => {
    const c = graph.getNode(id)
    return c?.visible && c.fills.some((f) => f.visible && f.type === 'IMAGE')
  })
  if (!childHasImage && !node.fills.some((f) => f.visible)) {
    issues.push({
      message: `"${node.name}" looks like an image container but has no image or placeholder fill`,
      suggestion: 'Add bg="#hex" as placeholder color'
    })
  }
}

function checkNestedText(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (node.type !== 'TEXT') return
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (child?.type === 'TEXT') {
      issues.push({
        message: `Nested Text "${child.text.slice(0, 20)}" inside "${node.text.slice(0, 20)}" — causes overflow`,
        suggestion: 'Split into separate <Text> elements in a flex="row" wrapper'
      })
    }
  }
}

function checkZeroPaddingContainer(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return
  if (node.layoutMode === 'NONE') return
  if (node.childIds.length < 3) return
  const allPad = node.paddingTop + node.paddingRight + node.paddingBottom + node.paddingLeft
  if (allPad > 0) return
  const hasTextChild = node.childIds.some((id) => {
    const c = graph.getNode(id)
    return c?.type === 'TEXT' && c.visible
  })
  const hasFill = node.fills.some((f) => f.visible)
  if (hasTextChild && hasFill) {
    issues.push({
      message: `"${node.name}" has text content with fill but no padding`,
      suggestion: 'Add p={16} or px={16} py={12}'
    })
  }
}

function checkButtonWithoutPadding(node: SceneNode, _graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!looksLikeButton(node)) return
  if (node.layoutMode === 'NONE') return
  const hPad = node.paddingLeft + node.paddingRight
  if (hPad === 0 && node.childIds.length > 0) {
    issues.push({
      message: `Button "${node.name}" has no horizontal padding`,
      suggestion: 'Add px={16} or px={12}'
    })
  }
}

function checkFlexContainerWithoutAlignment(node: SceneNode, _graph: SceneGraph, issues: DescribeIssue[]): void {
  if (!CONTAINER_TYPES.has(node.type)) return
  if (node.layoutMode === 'NONE') return
  if (node.childIds.length === 0) return
  const isRow = node.layoutMode === 'HORIZONTAL'
  if (isRow && node.counterAxisAlign === 'MIN' && node.height > 60) {
    const pad = node.paddingTop + node.paddingBottom
    const contentH = node.height - pad
    if (contentH > 50 && node.childIds.length <= 5) {
      const maxChildH = node.childIds.reduce((max, id) => {
        const c = _graph.getNode(id)
        return c?.visible ? Math.max(max, c.height) : max
      }, 0)
      if (maxChildH > 0 && maxChildH < contentH * 0.6) {
        issues.push({
          message: `"${node.name}" row children top-aligned with large empty space below`,
          suggestion: 'Add items="center" to vertically center content'
        })
      }
    }
  }
}

function detectVisibilityIssues(node: SceneNode, graph: SceneGraph, issues: DescribeIssue[]): void {
  for (const fill of node.fills) {
    if (!fill.visible || fill.type !== 'SOLID') continue
    if (fill.opacity < MIN_FILL_OPACITY) {
      issues.push({
        message: `Near-invisible fill ${colorToHex(fill.color)} at ${Math.round(fill.opacity * 100)}%`,
        suggestion: `Increase to ≥${Math.round(MIN_FILL_OPACITY * 100)}%`
      })
    }
  }
  for (const stroke of node.strokes) {
    if (!stroke.visible || stroke.opacity >= MIN_STROKE_OPACITY) continue
    issues.push({
      message: `Near-invisible stroke at ${Math.round(stroke.opacity * 100)}%`,
      suggestion: `Increase to ≥${Math.round(MIN_STROKE_OPACITY * 100)}%`
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
      suggestion: 'Increase color difference'
    })
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
    if (!child?.visible || child.cornerRadius <= 0 || child.layoutPositioning === 'ABSOLUTE') continue
    if (child.cornerRadius > node.cornerRadius + RADIUS_TOLERANCE) {
      issues.push({
        message: `"${child.name}" radius ${child.cornerRadius} > parent ${node.cornerRadius}`,
        suggestion: `Use rounded={${expectedInner}}`
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
    if (child?.type !== 'TEXT' || !child.visible) continue
    const text = child.text
    if (text === text.toUpperCase() && text.length > 1 && /[A-ZА-ЯЁ]/.test(text) && child.fontSize > UPPERCASE_MAX_SIZE) {
      issues.push({
        message: `"${text.slice(0, 30)}" is uppercase at ${child.fontSize}px — only for small labels ≤${UPPERCASE_MAX_SIZE}px`,
        suggestion: `Reduce size or use mixed case`
      })
    }
  }
}

const SPACING_GRID = 4

function detectSpacingIssues(node: SceneNode, graph: SceneGraph, gridSize: number, issues: DescribeIssue[]): void {
  if (node.layoutMode === 'NONE') return
  const children = node.childIds
    .map((id) => graph.getNode(id))
    .filter((c): c is SceneNode => c?.visible === true && c.layoutPositioning !== 'ABSOLUTE')

  const minPad = Math.min(node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft)
  if (node.itemSpacing > 0 && minPad > 0 && node.itemSpacing > minPad * 2) {
    issues.push({
      message: `Gap ${node.itemSpacing} >> padding ${minPad} in "${node.name}"`,
      suggestion: 'Gap should usually be ≤ padding'
    })
  }

  const spacingValues = [node.itemSpacing, node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
    .filter((v) => v > 0)
  for (const v of spacingValues) {
    if (v % SPACING_GRID !== 0) {
      issues.push({
        message: `Spacing ${v} in "${node.name}" off ${SPACING_GRID}px grid`,
        suggestion: `Use ${Math.round(v / SPACING_GRID) * SPACING_GRID}`
      })
      break
    }
  }

  const flexChildren = children.filter((c) => c.layoutMode !== 'NONE')
  if (flexChildren.length >= 3) {
    const paddings = flexChildren.map((c) => c.paddingTop + c.paddingRight + c.paddingBottom + c.paddingLeft)
    const gaps = flexChildren.map((c) => c.itemSpacing)
    if (new Set(paddings).size > 2) {
      issues.push({
        message: `Inconsistent padding across siblings in "${node.name}" (${[...new Set(paddings)].join(', ')})`,
        suggestion: 'Use same padding for similar containers'
      })
    }
    const uniqueGaps = new Set(gaps.filter((g) => g > 0))
    if (uniqueGaps.size > 2) {
      issues.push({
        message: `Inconsistent gaps across siblings in "${node.name}" (${[...uniqueGaps].join(', ')})`,
        suggestion: 'Use same gap for similar containers'
      })
    }
  }
}

const ERROR_PATTERNS = [
  /overflow/i, /invisible/i, /no color/i, /collapses/i, /no fill and no stroke/i,
  /dark on dark/i, /Touch target too small/i, /Nested Text/i
]
const INFO_PATTERNS = [
  /children named/i, /uppercase at/i, /fill.*matches parent/i,
  /radius.*should be/i, /width while siblings/i, /height while siblings/i,
  /icon.*width/i
]

function classifySeverity(message: string): IssueSeverity {
  if (ERROR_PATTERNS.some((p) => p.test(message))) return 'error'
  if (INFO_PATTERNS.some((p) => p.test(message))) return 'info'
  return 'warning'
}

export function detectIssues(node: SceneNode, gridSize: number, graph: SceneGraph): DescribeIssue[] {
  const issues: DescribeIssue[] = []
  detectStructuralIssues(node, gridSize, graph, issues)
  detectVisibilityIssues(node, graph, issues)
  detectLayoutIssues(node, graph, issues)
  detectRadiusIssues(node, graph, issues)
  detectTypographyIssues(node, graph, issues)
  detectSpacingIssues(node, graph, gridSize, issues)
  checkNestedText(node, graph, issues)
  checkZeroPaddingContainer(node, graph, issues)
  checkButtonWithoutPadding(node, graph, issues)
  checkFlexContainerWithoutAlignment(node, graph, issues)
  for (const issue of issues) {
    issue.severity = classifySeverity(issue.message)
  }
  return issues
}
