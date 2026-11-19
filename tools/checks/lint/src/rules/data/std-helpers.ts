import { normalizedFilename } from '#lint/support/context.ts'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

/** Where the helpers live, and tests, which may spell out what they check. */
function exempt(file: string): boolean {
  return file.includes('/packages/std/') || file.includes('/tests/')
}

function isErrorCheck(node: ESTree.Node): node is ESTree.BinaryExpression {
  return (
    node.type === 'BinaryExpression' &&
    node.operator === 'instanceof' &&
    node.right.type === 'Identifier' &&
    node.right.name === 'Error'
  )
}

function isStringOf(node: ESTree.Node, text: (node: ESTree.Node) => string, value: string) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'String' &&
    node.arguments.length === 1 &&
    text(node.arguments[0]) === value
  )
}

function isMember(node: ESTree.Node, name: string): node is ESTree.MemberExpression {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === name
  )
}

function isNumber(node: ESTree.Node | undefined, value: number): boolean {
  return node?.type === 'Literal' && node.value === value
}

/**
 * Require the shared helpers over writing them inline: `errorMessage`, `toError`, and
 * `isAbortError` from `@open-pencil/std/errors`, and `bytesToHex` from `@noble/hashes/utils.js`.
 */
export const noHandRolledStdHelpers = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow inline copies of errorMessage, toError, isAbortError, and bytesToHex; import the shared helpers.'
    },
    messages: {
      errorMessage: 'Use errorMessage(error) from @open-pencil/std/errors.',
      toError: 'Use toError(error) from @open-pencil/std/errors.',
      isAbortError: 'Use isAbortError(error) from @open-pencil/std/errors.',
      bytesToHex: 'Use bytesToHex(bytes) from @noble/hashes/utils.js.'
    }
  },
  create(context) {
    if (exempt(normalizedFilename(context))) return {}
    const text = (node: ESTree.Node) => context.sourceCode.getText(node)
    return {
      ConditionalExpression(node) {
        if (!isErrorCheck(node.test)) return
        const value = text(node.test.left)
        const { consequent, alternate } = node
        if (isMember(consequent, 'message') && text(consequent.object) === value) {
          if (isStringOf(alternate, text, value))
            context.report({ node, messageId: 'errorMessage' })
          return
        }
        if (
          text(consequent) === value &&
          alternate.type === 'NewExpression' &&
          alternate.callee.type === 'Identifier' &&
          alternate.callee.name === 'Error' &&
          alternate.arguments.length === 1 &&
          isStringOf(alternate.arguments[0], text, value)
        ) {
          context.report({ node, messageId: 'toError' })
        }
      },
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') return
        const sides = [node.left, node.right]
        const named = sides.some((side) => isMember(side, 'name'))
        const abort = sides.some((side) => side.type === 'Literal' && side.value === 'AbortError')
        if (named && abort) context.report({ node, messageId: 'isAbortError' })
      },
      CallExpression(node) {
        if (!isMember(node.callee, 'padStart') || !isNumber(node.arguments[0], 2)) return
        const padded = node.callee.object
        if (padded.type !== 'CallExpression' || !isMember(padded.callee, 'toString')) return
        if (isNumber(padded.arguments[0], 16)) context.report({ node, messageId: 'bytesToHex' })
      }
    }
  }
})
