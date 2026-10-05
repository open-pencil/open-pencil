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

/** Methods that return an iterator, whose `filter` is not an array's and takes no `compact`. */
const ITERATOR_RETURNING_METHODS = new Set(['entries', 'keys', 'matchAll', 'values'])

/** Calls that serialize their callback into a browser page, away from the module's imports. */
const SERIALIZED_CALLBACK_METHODS = new Set([
  '$$eval',
  '$eval',
  'addInitScript',
  'evaluate',
  'evaluateHandle',
  'waitForFunction'
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
  if (!node) return false
  return node.type === 'ArrayExpression' || isMethodCall(node, ARRAY_RETURNING_METHODS)
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

function isMethodCall(node: ESTree.Node, methods: ReadonlySet<string>): boolean {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return false
  const name = propertyName(node.callee)
  return name !== null && methods.has(name)
}

/**
 * Code inside a callback that Playwright serializes into the page, such as `page.evaluate`,
 * where an es-toolkit import does not exist.
 */
function insideSerializedCallback(node: ESTree.Node): boolean {
  for (let current: ESTree.Node | null = node; current; current = current.parent) {
    const { parent } = current
    const isCallback =
      (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') &&
      parent?.type === 'CallExpression' &&
      parent.arguments.includes(current)
    if (isCallback && isMethodCall(parent, SERIALIZED_CALLBACK_METHODS)) return true
  }
  return false
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
          isSetOfArray(context.sourceCode, only.argument) &&
          !insideSerializedCallback(node)
        )
          context.report({ node, messageId: 'uniq' })
      },
      CallExpression(node) {
        const { sourceCode } = context
        if (node.callee.type !== 'MemberExpression' || insideSerializedCallback(node)) return
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
        if (
          name === 'filter' &&
          node.arguments.length === 1 &&
          argument &&
          isGlobal(sourceCode, argument, 'Boolean') &&
          !isMethodCall(node.callee.object, ITERATOR_RETURNING_METHODS)
        )
          context.report({ node, messageId: 'compact' })
      }
    }
  }
})
