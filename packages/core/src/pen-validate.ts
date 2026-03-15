// TODO: buildVarResolver always uses first (Light) mode values.
// Files with theme overrides (e.g. Dark) will report false color mismatches.
import { parseColor, colorToCSS } from './color'

import {
  isVarRef,
  mapLayoutMode,
  mapJustifyContent,
  mapAlignItems,
  mapTextAlign,
  mapTextAlignVertical,
  mapFontWeight,
  mapNodeType,
  parseSize
} from './pen-convert'

import type { Color } from './types'
import type { PenNode } from './pen-convert'
import type { SceneGraph, SceneNode } from './scene-graph'

export interface ValidationIssue {
  nodeId: string
  nodeName: string
  field: string
  expected: unknown
  got: unknown
  severity: 'error' | 'warning'
}

interface VarResolver {
  resolveColor(ref: string): Color
  resolveNumber(ref: string): number
  resolveString(ref: string): string
}

function buildVarResolver(
  variables: Record<string, { type: string; value: unknown }>
): VarResolver {
  function getDefault(name: string): string | number | undefined {
    const def = variables[name] as { type: string; value: unknown } | undefined
    if (!def) return undefined
    if (Array.isArray(def.value)) {
      const arr = def.value as Array<{ value: string | number }>
      return arr.length > 0 ? arr[0].value : undefined
    }
    return def.value as string | number
  }

  return {
    resolveColor(ref: string) {
      const val = getDefault(ref.replace(/^\$/, ''))
      if (typeof val === 'string') return parseColor(val)
      return { r: 0, g: 0, b: 0, a: 1 }
    },
    resolveNumber(ref: string) {
      const val = getDefault(ref.replace(/^\$/, ''))
      return typeof val === 'number' ? val : 0
    },
    resolveString(ref: string) {
      const val = getDefault(ref.replace(/^\$/, ''))
      return typeof val === 'string' ? val : String(val)
    }
  }
}

function colorsClose(a: Color, b: Color, tolerance = 0.02): boolean {
  return (
    Math.abs(a.r - b.r) < tolerance &&
    Math.abs(a.g - b.g) < tolerance &&
    Math.abs(a.b - b.b) < tolerance &&
    Math.abs(a.a - b.a) < tolerance
  )
}

function issue(
  nodeId: string, nodeName: string, field: string,
  expected: unknown, got: unknown, severity: 'error' | 'warning' = 'error'
): ValidationIssue {
  return { nodeId, nodeName: nodeName || nodeId, field, expected, got, severity }
}

function validateBasicProps(
  pen: PenNode, node: SceneNode, name: string, issues: ValidationIssue[]
): void {
  const expectedType = mapNodeType(pen)
  if (node.type !== expectedType) issues.push(issue(pen.id, name, 'type', expectedType, node.type))
  if (pen.name && node.name !== pen.name) issues.push(issue(pen.id, name, 'name', pen.name, node.name))
  if (pen.x !== undefined && Math.abs(node.x - pen.x) > 0.5) issues.push(issue(pen.id, name, 'x', pen.x, node.x))
  if (pen.y !== undefined && Math.abs(node.y - pen.y) > 0.5) issues.push(issue(pen.id, name, 'y', pen.y, node.y))
  if (pen.enabled !== undefined && node.visible !== pen.enabled) issues.push(issue(pen.id, name, 'visible', pen.enabled, node.visible))
  if (pen.clip !== undefined && node.clipsContent !== pen.clip) issues.push(issue(pen.id, name, 'clipsContent', pen.clip, node.clipsContent))
  if (pen.opacity !== undefined && Math.abs(node.opacity - pen.opacity) > 0.01) issues.push(issue(pen.id, name, 'opacity', pen.opacity, node.opacity))
}

function validateNode(
  pen: PenNode,
  graph: SceneGraph,
  vars: VarResolver,
  issues: ValidationIssue[]
): void {
  if (pen.type === 'prompt') return

  const node = graph.getNode(pen.id)
  if (!node) {
    issues.push(issue(pen.id, pen.name ?? pen.type, 'existence', 'node exists', 'missing'))
    return
  }

  const name = pen.name ?? pen.type

  validateBasicProps(pen, node, name, issues)
  validateSize(pen, node, name, issues)
  validateFill(pen, node, name, vars, issues)
  validateStroke(pen, node, name, vars, issues)
  validateCornerRadius(pen, node, name, vars, issues)
  validateLayout(pen, node, name, issues)
  validatePadding(pen, node, name, issues)
  validateText(pen, node, name, vars, issues)

  if (pen.children) {
    const penChildCount = pen.children.filter((c) => c.type !== 'prompt').length
    if (node.childIds.length !== penChildCount) {
      issues.push(issue(pen.id, name, 'children.length', penChildCount, node.childIds.length, 'warning'))
    }
    for (const child of pen.children) {
      validateNode(child, graph, vars, issues)
    }
  }
}

function validateSize(
  pen: PenNode, node: SceneNode, name: string, issues: ValidationIssue[]
): void {
  if (pen.width !== undefined) {
    const parsed = parseSize(pen.width, 100)
    if (typeof pen.width === 'number' && Math.abs(node.width - pen.width) > 0.5) {
      issues.push(issue(pen.id, name, 'width', pen.width, node.width))
    }
    if (typeof pen.width === 'string') {
      if (parsed.sizing === 'FILL' && node.layoutGrow < 1) {
        issues.push(issue(pen.id, name, 'width.sizing', 'FILL (layoutGrow≥1)', `layoutGrow=${node.layoutGrow}`))
      }
    }
  }
  if (pen.height !== undefined && typeof pen.height === 'number') {
    if (Math.abs(node.height - pen.height) > 0.5) {
      issues.push(issue(pen.id, name, 'height', pen.height, node.height))
    }
  }
}

function validateFill(
  pen: PenNode, node: SceneNode, name: string,
  vars: VarResolver, issues: ValidationIssue[]
): void {
  if (pen.fill === undefined) return

  if (typeof pen.fill === 'string') {
    if (node.fills.length === 0) {
      issues.push(issue(pen.id, name, 'fills', 'has fill', 'no fills'))
      return
    }
    const expected = isVarRef(pen.fill) ? vars.resolveColor(pen.fill) : parseColor(pen.fill)
    const got = node.fills[0].color
    if (!colorsClose(expected, got)) {
      issues.push(issue(pen.id, name, 'fill.color', colorToCSS(expected), colorToCSS(got)))
    }
  } else if (typeof pen.fill === 'object' && !Array.isArray(pen.fill)) {
    if (node.fills.length === 0) {
      issues.push(issue(pen.id, name, 'fills', 'has fill', 'no fills'))
      return
    }
    if (pen.fill.enabled === false && node.fills[0].visible) {
      issues.push(issue(pen.id, name, 'fill.visible', false, node.fills[0].visible))
    }
  }
}

function validateStrokeColor(
  pen: PenNode, node: SceneNode, name: string,
  vars: VarResolver, issues: ValidationIssue[]
): void {
  if (!pen.stroke?.fill) return
  if (node.strokes.length === 0) {
    issues.push(issue(pen.id, name, 'strokes', 'has stroke', 'no strokes'))
    return
  }
  const expected = isVarRef(pen.stroke.fill) ? vars.resolveColor(pen.stroke.fill) : parseColor(pen.stroke.fill)
  if (!colorsClose(expected, node.strokes[0].color)) {
    issues.push(issue(pen.id, name, 'stroke.color', colorToCSS(expected), colorToCSS(node.strokes[0].color)))
  }
  const expectedAlign = pen.stroke.align === 'center' ? 'CENTER' : (pen.stroke.align === 'outside' ? 'OUTSIDE' : 'INSIDE')
  if (node.strokes[0].align !== expectedAlign) {
    issues.push(issue(pen.id, name, 'stroke.align', expectedAlign, node.strokes[0].align))
  }
}

function validateStrokeWeights(
  pen: PenNode, node: SceneNode, name: string, issues: ValidationIssue[]
): void {
  if (!pen.stroke) return
  if (typeof pen.stroke.thickness === 'object') {
    if (!node.independentStrokeWeights) {
      issues.push(issue(pen.id, name, 'independentStrokeWeights', true, false))
    }
    const t = pen.stroke.thickness
    if (t.top !== undefined && node.borderTopWeight !== t.top) issues.push(issue(pen.id, name, 'borderTopWeight', t.top, node.borderTopWeight))
    if (t.right !== undefined && node.borderRightWeight !== t.right) issues.push(issue(pen.id, name, 'borderRightWeight', t.right, node.borderRightWeight))
    if (t.bottom !== undefined && node.borderBottomWeight !== t.bottom) issues.push(issue(pen.id, name, 'borderBottomWeight', t.bottom, node.borderBottomWeight))
    if (t.left !== undefined && node.borderLeftWeight !== t.left) issues.push(issue(pen.id, name, 'borderLeftWeight', t.left, node.borderLeftWeight))
  } else if (typeof pen.stroke.thickness === 'number' && pen.stroke.fill && node.strokes.length > 0) {
    if (node.strokes[0].weight !== pen.stroke.thickness) {
      issues.push(issue(pen.id, name, 'stroke.weight', pen.stroke.thickness, node.strokes[0].weight))
    }
  }
}

function validateStroke(
  pen: PenNode, node: SceneNode, name: string,
  vars: VarResolver, issues: ValidationIssue[]
): void {
  if (!pen.stroke) return
  validateStrokeColor(pen, node, name, vars, issues)
  validateStrokeWeights(pen, node, name, issues)
}

function validateCornerRadius(
  pen: PenNode, node: SceneNode, name: string,
  vars: VarResolver, issues: ValidationIssue[]
): void {
  if (pen.cornerRadius === undefined) return

  if (typeof pen.cornerRadius === 'number') {
    if (node.cornerRadius !== pen.cornerRadius) {
      issues.push(issue(pen.id, name, 'cornerRadius', pen.cornerRadius, node.cornerRadius))
    }
  } else if (typeof pen.cornerRadius === 'string' && isVarRef(pen.cornerRadius)) {
    const expected = vars.resolveNumber(pen.cornerRadius)
    if (node.cornerRadius !== expected) {
      issues.push(issue(pen.id, name, 'cornerRadius', `${pen.cornerRadius}→${expected}`, node.cornerRadius))
    }
  } else if (Array.isArray(pen.cornerRadius)) {
    if (!node.independentCorners) {
      issues.push(issue(pen.id, name, 'independentCorners', true, false))
    }
  }
}

function validateLayout(
  pen: PenNode, node: SceneNode, name: string, issues: ValidationIssue[]
): void {
  const expected = mapLayoutMode(pen)
  if (node.layoutMode !== expected) {
    issues.push(issue(pen.id, name, 'layoutMode', expected, node.layoutMode))
  }

  if (pen.gap !== undefined && node.itemSpacing !== pen.gap) {
    issues.push(issue(pen.id, name, 'itemSpacing', pen.gap, node.itemSpacing))
  }

  if (pen.justifyContent) {
    const exp = mapJustifyContent(pen.justifyContent)
    if (node.primaryAxisAlign !== exp) {
      issues.push(issue(pen.id, name, 'primaryAxisAlign', exp, node.primaryAxisAlign))
    }
  }

  if (pen.alignItems) {
    const exp = mapAlignItems(pen.alignItems)
    if (node.counterAxisAlign !== exp) {
      issues.push(issue(pen.id, name, 'counterAxisAlign', exp, node.counterAxisAlign))
    }
  }
}

function validatePadding(
  pen: PenNode, node: SceneNode, name: string, issues: ValidationIssue[]
): void {
  if (pen.padding === undefined) return

  let top: number, right: number, bottom: number, left: number
  if (typeof pen.padding === 'number') {
    top = right = bottom = left = pen.padding
  } else if (pen.padding.length === 2) {
    top = bottom = pen.padding[0]
    right = left = pen.padding[1]
  } else {
    top = pen.padding[0]; right = pen.padding[1]
    bottom = pen.padding[2]; left = pen.padding[3]
  }

  if (node.paddingTop !== top) issues.push(issue(pen.id, name, 'paddingTop', top, node.paddingTop))
  if (node.paddingRight !== right) issues.push(issue(pen.id, name, 'paddingRight', right, node.paddingRight))
  if (node.paddingBottom !== bottom) issues.push(issue(pen.id, name, 'paddingBottom', bottom, node.paddingBottom))
  if (node.paddingLeft !== left) issues.push(issue(pen.id, name, 'paddingLeft', left, node.paddingLeft))
}

function validateText(
  pen: PenNode, node: SceneNode, name: string,
  vars: VarResolver, issues: ValidationIssue[]
): void {
  if (pen.type !== 'text') return

  if (pen.content !== undefined && node.text !== pen.content) {
    issues.push(issue(pen.id, name, 'text', pen.content, node.text))
  }

  if (pen.fontFamily) {
    const expected = isVarRef(pen.fontFamily) ? vars.resolveString(pen.fontFamily) : pen.fontFamily
    if (node.fontFamily !== expected) {
      issues.push(issue(pen.id, name, 'fontFamily', expected, node.fontFamily))
    }
  }

  if (pen.fontSize !== undefined && node.fontSize !== pen.fontSize) {
    issues.push(issue(pen.id, name, 'fontSize', pen.fontSize, node.fontSize))
  }

  if (pen.fontWeight !== undefined) {
    const expected = mapFontWeight(pen.fontWeight)
    if (node.fontWeight !== expected) {
      issues.push(issue(pen.id, name, 'fontWeight', expected, node.fontWeight))
    }
  }

  if (pen.textAlign) {
    const expected = mapTextAlign(pen.textAlign)
    if (node.textAlignHorizontal !== expected) {
      issues.push(issue(pen.id, name, 'textAlignHorizontal', expected, node.textAlignHorizontal))
    }
  }

  if (pen.textAlignVertical) {
    const expected = mapTextAlignVertical(pen.textAlignVertical)
    if (node.textAlignVertical !== expected) {
      issues.push(issue(pen.id, name, 'textAlignVertical', expected, node.textAlignVertical))
    }
  }

  if (pen.textGrowth === 'fixed-width' && node.textAutoResize !== 'HEIGHT') {
    issues.push(issue(pen.id, name, 'textAutoResize', 'HEIGHT', node.textAutoResize))
  }
}

export interface PenValidationResult {
  total: number
  errors: number
  warnings: number
  issues: ValidationIssue[]
}

export function validatePenImport(
  penJson: string,
  graph: SceneGraph
): PenValidationResult {
  const doc = JSON.parse(penJson)
  const vars = buildVarResolver(doc.variables ?? {})
  const issues: ValidationIssue[] = []

  for (const child of doc.children) {
    validateNode(child, graph, vars, issues)
  }

  return {
    total: issues.length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    issues
  }
}

export function formatValidationResult(result: PenValidationResult): string {
  if (result.total === 0) return '✓ All properties validated — no issues found.'

  const lines: string[] = []
  lines.push(`Found ${result.errors} errors, ${result.warnings} warnings:\n`)

  for (const i of result.issues) {
    const icon = i.severity === 'error' ? '✗' : '⚠'
    lines.push(`  ${icon} [${i.nodeId}] "${i.nodeName}" → ${i.field}`)
    lines.push(`      expected: ${JSON.stringify(i.expected)}`)
    lines.push(`      got:      ${JSON.stringify(i.got)}`)
  }

  return lines.join('\n')
}
