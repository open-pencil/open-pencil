import { resolveVariable } from '#lint/support/scope.ts'
import { defineRule } from '@oxlint/plugins'
import type { ESTree, SourceCode } from '@oxlint/plugins'

/** Methods that always return a new array, so deduplicating their result needs no type check. */
const ARRAY_RETURNING_METHODS = new Set([
  'concat',
  'filter',
  'flat',
  'flatMap',
  'map',
  'slice',
  'split',
  'toReversed',
  'toSorted',
  'toSpliced'
])

function propertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string')
    return node.property.value
  return null
}

/** A global such as `Set` or `Boolean` that no local binding shadows. */
function isGlobal(sourceCode: SourceCode, node: ESTree.Node, name: string): boolean {
  if (node.type !== 'Identifier' || node.name !== name) return false
  const variable = resolveVariable(sourceCode, node)
  return variable === null || variable.defs.length === 0
}

/** An expression that is an array without type information: a literal or an array method's result. */
function isArrayExpression(node: ESTree.Node | undefined): boolean {
  if (node?.type === 'ArrayExpression') return true
  if (node?.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return false
  const name = propertyName(node.callee)
  return name !== null && ARRAY_RETURNING_METHODS.has(name)
}

/** `new Set(array)` over an array, the first half of a deduplicating round trip. */
function isSetOfArray(sourceCode: SourceCode, node: ESTree.Node | undefined): boolean {
  return (
    node?.type === 'NewExpression' &&
    node.arguments.length === 1 &&
    isGlobal(sourceCode, node.callee, 'Set') &&
    isArrayExpression(node.arguments[0])
  )
}

/** Require es-toolkit's `uniq` and `compact` over their hand-written equivalents. */
export const preferEsToolkitRule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer es-toolkit uniq and compact over Set round trips and filter(Boolean) on arrays.'
    },
    messages: {
      uniq: 'Use uniq from es-toolkit instead of a Set round trip to deduplicate an array.',
      compact: 'Use compact from es-toolkit instead of filter(Boolean); it also narrows the type.'
    }
  },
  createOnce(context) {
    return {
      ArrayExpression(node) {
        const [only] = node.elements
        if (
          node.elements.length === 1 &&
          only?.type === 'SpreadElement' &&
          isSetOfArray(context.sourceCode, only.argument)
        )
          context.report({ node, messageId: 'uniq' })
      },
      CallExpression(node) {
        const { sourceCode } = context
        if (node.callee.type !== 'MemberExpression') return
        const name = propertyName(node.callee)
        const [argument] = node.arguments
        if (
          name === 'from' &&
          isGlobal(sourceCode, node.callee.object, 'Array') &&
          node.arguments.length === 1 &&
          isSetOfArray(sourceCode, argument)
        ) {
          context.report({ node, messageId: 'uniq' })
          return
        }
        if (name === 'filter' && node.arguments.length === 1 && argument)
          if (isGlobal(sourceCode, argument, 'Boolean'))
            context.report({ node, messageId: 'compact' })
      }
    }
  }
})
