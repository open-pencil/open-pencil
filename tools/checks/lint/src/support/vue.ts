import type {
  AttributeNode,
  DirectiveNode,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode
} from '@vue/compiler-core'
import { parse as parseVueSfc } from 'vue/compiler-sfc'

export type VueTemplateNode =
  | RootNode
  | TemplateChildNode
  | AttributeNode
  | DirectiveNode
  | SimpleExpressionNode

function vueSfcDescriptor(source: string, filename: string) {
  return parseVueSfc(source, { filename }).descriptor
}

function vueTemplateAst(source: string, filename: string): RootNode | null {
  return vueSfcDescriptor(source, filename).template?.ast ?? null
}

function isVueSourceFile(file: string): boolean {
  return (
    file.endsWith('.vue') &&
    (file.startsWith('src/') ||
      file.includes('/src/') ||
      file.startsWith('packages/vue/src/') ||
      file.includes('/packages/vue/src/'))
  )
}

function sourceLineCount(source: string): number {
  const normalized = source.endsWith('\n') ? source.slice(0, -1) : source
  return normalized.split('\n').length
}

const VUE_ELEMENT_NODE = 1
const VUE_SIMPLE_EXPRESSION_NODE = 4
const VUE_INTERPOLATION_NODE = 5
const VUE_ATTRIBUTE_NODE = 6
const VUE_DIRECTIVE_NODE = 7

function walkVueTemplateAst(node: VueTemplateNode, visitor: (node: VueTemplateNode) => void): void {
  visitor(node)
  if ('props' in node) {
    for (const prop of node.props ?? []) walkVueTemplateAst(prop, visitor)
  }
  if ('children' in node) {
    for (const child of node.children ?? []) {
      if (typeof child !== 'string' && typeof child !== 'symbol') {
        walkVueTemplateAst(child, visitor)
      }
    }
  }
  if (node.type === VUE_INTERPOLATION_NODE && node.content) {
    walkVueTemplateAst(node.content, visitor)
  }
  if (node.type === VUE_DIRECTIVE_NODE) {
    if (node.arg && typeof node.arg !== 'string' && typeof node.arg !== 'symbol') {
      walkVueTemplateAst(node.arg, visitor)
    }
    if (node.exp) walkVueTemplateAst(node.exp, visitor)
  }
}

interface ExpressionAstNode {
  type?: string
  callee?: ExpressionAstNode
  name?: string
  loc?: unknown
  [key: string]: unknown
}

function walkExpressionAst(
  node: ExpressionAstNode | null | undefined,
  visitor: (node: ExpressionAstNode) => void
): void {
  if (!node || typeof node !== 'object') return
  visitor(node)
  for (const value of Object.values(node)) {
    if (!value || value === node.loc) continue
    if (Array.isArray(value)) {
      for (const item of value) walkExpressionAst(item as ExpressionAstNode, visitor)
      continue
    }
    if (typeof value === 'object') walkExpressionAst(value as ExpressionAstNode, visitor)
  }
}

function isUIHelperName(name: string): boolean {
  const prefix = 'use'
  const suffix = 'UI'
  if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false
  const firstDomainChar = name.at(prefix.length)
  return firstDomainChar !== undefined && firstDomainChar === firstDomainChar.toUpperCase()
}

function hasExpressionCall(
  expression: VueTemplateNode | null | undefined,
  predicate: (name: string) => boolean
): boolean {
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE || !expression.ast) return false
  let found = false
  walkExpressionAst(expression.ast as ExpressionAstNode, (node) => {
    if (found || node.type !== 'CallExpression') return
    if (node.callee?.type === 'Identifier' && node.callee.name && predicate(node.callee.name)) {
      found = true
    }
  })
  return found
}

function hasUIHelperCall(expression: VueTemplateNode): boolean {
  return hasExpressionCall(expression, isUIHelperName)
}

function isStaticVueAttribute(node: VueTemplateNode, name: string): node is AttributeNode {
  return node.type === VUE_ATTRIBUTE_NODE && node.name === name
}

function isVueBindDirective(node: VueTemplateNode, name: string): node is DirectiveNode {
  return (
    node.type === VUE_DIRECTIVE_NODE &&
    node.name === 'bind' &&
    node.arg?.type === VUE_SIMPLE_EXPRESSION_NODE &&
    node.arg.content === name
  )
}

function isBoundStringLiteral(node: VueTemplateNode, name: string): boolean {
  if (!isVueBindDirective(node, name)) return false
  const expression = node.exp
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE) return false
  const ast = expression.ast as ExpressionAstNode | undefined
  if (!ast) return false
  if (ast.type === 'StringLiteral' || (ast.type === 'Literal' && typeof ast.value === 'string')) {
    return true
  }
  return (
    ast.type === 'TemplateLiteral' && Array.isArray(ast.expressions) && ast.expressions.length === 0
  )
}

export {
  VUE_DIRECTIVE_NODE,
  VUE_ELEMENT_NODE,
  hasExpressionCall,
  hasUIHelperCall,
  isBoundStringLiteral,
  isStaticVueAttribute,
  isVueBindDirective,
  isVueSourceFile,
  sourceLineCount,
  vueSfcDescriptor,
  vueTemplateAst,
  walkVueTemplateAst
}
