import { parse as parseVueSfc } from 'vue/compiler-sfc'

import { createTextRule } from './support.ts'

const VUE_DIRECTIVE_NODE = 7

type UnknownRecord = Record<string, unknown>
type ExpressionNode = UnknownRecord & { type: string }
type VueTemplateNode = {
  type?: number
  name?: string
  tag?: string
  arg?: { content?: string }
  exp?: { ast?: unknown }
  props?: VueTemplateNode[]
  children?: VueTemplateNode[]
  loc?: { start?: { line?: number; column?: number } }
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function isExpressionNode(value: unknown): value is ExpressionNode {
  return isUnknownRecord(value) && 'type' in value && typeof value.type === 'string'
}

function staticClassValues(node: unknown): string[] {
  if (!isExpressionNode(node)) return []
  if (node.type === 'StringLiteral' && typeof node.value === 'string') return [node.value]
  if (
    node.type === 'TemplateLiteral' &&
    Array.isArray(node.expressions) &&
    node.expressions.length === 0
  ) {
    const quasis = Array.isArray(node.quasis) ? node.quasis : []
    return quasis.flatMap((quasi) => {
      if (!isExpressionNode(quasi) || !isUnknownRecord(quasi.value)) return []
      return typeof quasi.value.cooked === 'string' ? [quasi.value.cooked] : []
    })
  }
  if (node.type === 'ArrayExpression' && Array.isArray(node.elements)) {
    return node.elements.flatMap(staticClassValues)
  }
  return []
}

function propertyClassName(property: ExpressionNode): string | null {
  if (property.type !== 'ObjectProperty' || !isExpressionNode(property.key)) return null
  return property.key.type === 'StringLiteral' && typeof property.key.value === 'string'
    ? property.key.value
    : null
}

function hasDynamicClass(node: unknown, visited = new Set<ExpressionNode>()): boolean {
  if (!isExpressionNode(node) || visited.has(node)) return false
  visited.add(node)

  if (node.type === 'ConditionalExpression') {
    const classes = [...staticClassValues(node.consequent), ...staticClassValues(node.alternate)]
    if (classes.some((value) => value.trim().length > 0)) return true
  }

  if (node.type === 'ObjectExpression' && Array.isArray(node.properties)) {
    for (const property of node.properties) {
      if (!isExpressionNode(property)) continue
      if (propertyClassName(property)?.trim()) return true
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue
    if (Array.isArray(value)) {
      if (value.some((child) => hasDynamicClass(child, visited))) return true
    } else if (hasDynamicClass(value, visited)) {
      return true
    }
  }
  return false
}

function walkVueTemplateAst(node: VueTemplateNode, visitor: (node: VueTemplateNode) => void) {
  visitor(node)
  for (const prop of node.props ?? []) walkVueTemplateAst(prop, visitor)
  for (const child of node.children ?? []) walkVueTemplateAst(child, visitor)
}

export function dynamicClassDiagnostics(sourceRel: string, content: string) {
  if (!sourceRel.startsWith('src/components/') || !sourceRel.endsWith('.vue')) return []

  const template = parseVueSfc(content, { filename: sourceRel }).descriptor.template?.ast
  if (!template) return []

  const diagnostics: Array<{ message: string; line?: number; column?: number }> = []
  walkVueTemplateAst(template as VueTemplateNode, (node) => {
    if (
      node.type !== VUE_DIRECTIVE_NODE ||
      node.name !== 'bind' ||
      node.arg?.content !== 'class' ||
      !hasDynamicClass(node.exp?.ast)
    ) {
      return
    }
    const line = node.loc?.start?.line
    diagnostics.push({
      message:
        'Move visual-state Tailwind classes into a typed src/theme/** Tailwind Variants theme and bind semantic data-* state.',
      line,
      column: node.loc?.start?.column
    })
  })
  return diagnostics
}

function containsUiHookCall(node: unknown, visited = new Set<ExpressionNode>()): boolean {
  if (!isExpressionNode(node) || visited.has(node)) return false
  visited.add(node)
  if (
    node.type === 'CallExpression' &&
    isExpressionNode(node.callee) &&
    node.callee.type === 'Identifier' &&
    typeof node.callee.name === 'string' &&
    /^use[A-Z][A-Za-z0-9]*UI$/.test(node.callee.name)
  ) {
    return true
  }
  return Object.entries(node).some(([key, value]) => {
    if (key === 'loc' || key === 'start' || key === 'end') return false
    return Array.isArray(value)
      ? value.some((child) => containsUiHookCall(child, visited))
      : containsUiHookCall(value, visited)
  })
}

export function vueTemplateGuardrailDiagnostics(sourceRel: string, content: string) {
  if (!sourceRel.startsWith('src/components/') || !sourceRel.endsWith('.vue')) return []
  const template = parseVueSfc(content, { filename: sourceRel }).descriptor.template?.ast
  if (!template) return []
  const diagnostics: Array<{ message: string; line?: number; column?: number }> = []
  walkVueTemplateAst(template as VueTemplateNode, (node) => {
    if (node.type === 1 && node.tag === 'svg') {
      diagnostics.push({
        message: 'Use an Iconify/Lucide component instead of raw SVG in app components.',
        line: node.loc?.start?.line,
        column: node.loc?.start?.column
      })
    }
    if (node.type === VUE_DIRECTIVE_NODE && containsUiHookCall(node.exp?.ast)) {
      diagnostics.push({
        message: 'Resolve use*UI() hooks once in script setup, not inside template expressions.',
        line: node.loc?.start?.line,
        column: node.loc?.start?.column
      })
    }
  })
  return diagnostics
}

export const noVueTemplateUiHooksOrSvg = createTextRule(
  'open-pencil/no-vue-template-ui-hooks-or-svg',
  vueTemplateGuardrailDiagnostics
)

export const noDynamicTailwindStateClasses = createTextRule(
  'open-pencil/no-dynamic-tailwind-state-classes',
  dynamicClassDiagnostics
)
