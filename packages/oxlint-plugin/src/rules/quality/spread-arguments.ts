import { staticMemberName } from '#oxlint-plugin/support/ast'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

/** Calls that take their items as arguments. */
const ARRAY_METHODS = new Set(['push', 'unshift', 'splice'])
const MATH_METHODS = new Set(['max', 'min'])
const STRING_METHODS = new Set(['fromCharCode', 'fromCodePoint'])

/** Whether spreading `argument` passes a fixed number of items: an array literal without spreads. */
function isFixedLength(argument: ESTree.Expression): boolean {
  return (
    argument.type === 'ArrayExpression' &&
    argument.elements.every((element) => element?.type !== 'SpreadElement')
  )
}

function isObject(node: ESTree.Expression | ESTree.Super, name: string): boolean {
  return node.type === 'Identifier' && node.name === name
}

/** Which kind of call `callee` is, when it takes a list as arguments. */
function spreadTarget(
  callee: ESTree.Expression | ESTree.Super
): 'array' | 'math' | 'string' | null {
  if (callee.type !== 'MemberExpression') return null
  const name = staticMemberName(callee)
  if (name === null) return null
  if (ARRAY_METHODS.has(name)) return 'array'
  if (MATH_METHODS.has(name) && isObject(callee.object, 'Math')) return 'math'
  if (STRING_METHODS.has(name) && isObject(callee.object, 'String')) return 'string'
  return null
}

/**
 * Disallow spreading a list into a call's arguments, where engines cap how many a call takes:
 * Chrome throws past about 120,000. An array literal without spreads of its own may still be spread.
 */
export const noSpreadArgumentsRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow spreading arrays into push, unshift, splice, Math.max/min, or String.fromCharCode/fromCodePoint.'
    },
    messages: {
      array:
        'Spreading a list into this call throws past about 120,000 items in Chrome; add the items in a loop.',
      math: 'Spreading a list into Math.max or Math.min throws past about 120,000 items in Chrome; fold it in a loop.',
      string:
        'Spreading codes into String.fromCharCode or fromCodePoint throws on long input; decode with TextDecoder, js-base64, or in chunks.'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const target = spreadTarget(node.callee)
        if (target === null) return
        for (const argument of node.arguments) {
          if (argument.type === 'SpreadElement' && !isFixedLength(argument.argument)) {
            context.report({ node: argument, messageId: target })
          }
        }
      }
    }
  }
})
