import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

/** The prefixes a provider ID's kind is spelled with, which only `providerKind` reads. */
const KIND_PREFIXES = new Set(['acp:', 'harness:'])
/** IDs whose comparison stands for a kind: Pi is the one Harness provider. */
const KIND_IDS = new Set(['harness:pi'])
const KIND_ID_CONSTANTS = new Set(['HARNESS_PROVIDER_ID'])

function namesKind(node: ESTree.Node): boolean {
  if (node.type === 'Literal') return typeof node.value === 'string' && KIND_IDS.has(node.value)
  return node.type === 'Identifier' && KIND_ID_CONSTANTS.has(node.name)
}

/**
 * Require `providerKind` from `@open-pencil/core/constants` over reading a provider ID's kind by
 * hand: a `startsWith('acp:')` or `startsWith('harness:')`, or an equality with Pi's ID. Using a
 * provider ID as a value, such as a map key or a default, is not caught.
 */
export const noProviderIdChecks = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow reading a provider ID's kind from its prefix; use providerKind from @open-pencil/core/constants."
    },
    messages: {
      byHand:
        "Use providerKind(providerID) === 'acp' | 'harness' | 'api' (@open-pencil/core/constants) instead of reading the ID."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return
        if (callee.property.name !== 'startsWith') return
        const [prefix] = node.arguments
        if (prefix?.type !== 'Literal' || typeof prefix.value !== 'string') return
        if (KIND_PREFIXES.has(prefix.value)) context.report({ node, messageId: 'byHand' })
      },
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return
        if (namesKind(node.left) || namesKind(node.right))
          context.report({ node, messageId: 'byHand' })
      }
    }
  }
})
