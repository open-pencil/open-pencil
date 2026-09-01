import { parse as parseVueSfc } from 'vue/compiler-sfc'

function vueSfcDescriptor(source, filename) {
  return parseVueSfc(source, { filename }).descriptor
}

function vueTemplateAst(source, filename) {
  return vueSfcDescriptor(source, filename).template?.ast ?? null
}

function isVueSourceFile(file) {
  return (
    file.endsWith('.vue') &&
    (file.startsWith('src/') ||
      file.includes('/src/') ||
      file.startsWith('packages/vue/src/') ||
      file.includes('/packages/vue/src/'))
  )
}

function sourceLineCount(source) {
  const normalized = source.endsWith('\n') ? source.slice(0, -1) : source
  return normalized.split('\n').length
}

const VUE_ELEMENT_NODE = 1
const VUE_SIMPLE_EXPRESSION_NODE = 4
const VUE_INTERPOLATION_NODE = 5
const VUE_ATTRIBUTE_NODE = 6
const VUE_DIRECTIVE_NODE = 7

function walkVueTemplateAst(node, visitor) {
  visitor(node)
  for (const prop of node.props ?? []) walkVueTemplateAst(prop, visitor)
  for (const child of node.children ?? []) walkVueTemplateAst(child, visitor)
  if (node.type === VUE_INTERPOLATION_NODE && node.content) {
    walkVueTemplateAst(node.content, visitor)
  }
  if (node.type === VUE_DIRECTIVE_NODE) {
    if (node.arg) walkVueTemplateAst(node.arg, visitor)
    if (node.exp) walkVueTemplateAst(node.exp, visitor)
  }
}

function walkExpressionAst(node, visitor) {
  if (!node || typeof node !== 'object') return
  visitor(node)
  for (const value of Object.values(node)) {
    if (!value || value === node.loc) continue
    if (Array.isArray(value)) {
      for (const item of value) walkExpressionAst(item, visitor)
      continue
    }
    walkExpressionAst(value, visitor)
  }
}

function isUiHelperName(name) {
  const prefix = 'use'
  const suffix = 'UI'
  if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false
  const firstDomainChar = name.at(prefix.length)
  return firstDomainChar !== undefined && firstDomainChar === firstDomainChar.toUpperCase()
}

function hasExpressionCall(expression, predicate) {
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE || !expression.ast) return false
  let found = false
  walkExpressionAst(expression.ast, (node) => {
    if (found || node.type !== 'CallExpression') return
    if (node.callee?.type === 'Identifier' && predicate(node.callee.name)) found = true
  })
  return found
}

function hasUiHelperCall(expression) {
  return hasExpressionCall(expression, isUiHelperName)
}

function isStaticVueAttribute(node, name) {
  return node.type === VUE_ATTRIBUTE_NODE && node.name === name
}

function isVueBindDirective(node, name) {
  return node.type === VUE_DIRECTIVE_NODE && node.name === 'bind' && node.arg?.content === name
}

function isBoundStringLiteral(node, name) {
  if (!isVueBindDirective(node, name)) return false
  const expression = node.exp
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE) return false
  const ast = expression.ast
  if (!ast) return false
  if (ast.type === 'StringLiteral' || (ast.type === 'Literal' && typeof ast.value === 'string')) {
    return true
  }
  return ast.type === 'TemplateLiteral' && ast.expressions?.length === 0
}

export {
  VUE_DIRECTIVE_NODE,
  VUE_ELEMENT_NODE,
  hasExpressionCall,
  hasUiHelperCall,
  isBoundStringLiteral,
  isStaticVueAttribute,
  isVueBindDirective,
  isVueSourceFile,
  sourceLineCount,
  vueSfcDescriptor,
  vueTemplateAst,
  walkVueTemplateAst
}
