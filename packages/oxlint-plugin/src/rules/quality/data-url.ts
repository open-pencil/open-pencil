import { staticMemberName } from '#oxlint-plugin/support/ast'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

/** The start of a data URL, bare or inside CSS `url()`. */
const DATA_URL_START = /^(?:url\(["']?)?data:/i
const ENCODERS = new Set(['fromUint8Array', 'encodeURIComponent'])

function isEncoderCall(node: ESTree.Expression): boolean {
  return node.type === 'CallExpression' && node.callee.type === 'Identifier'
    ? ENCODERS.has(node.callee.name)
    : false
}

/** Require the shared data URL helpers over hand-built or hand-parsed data URLs. */
export const noHandRolledDataURLRule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow building data URLs from encoded bytes or markup, and matching their prefix; use the @open-pencil/scene-graph/images helpers.'
    },
    messages: {
      handRolled:
        'Use imageDataURL or svgDataURL to build a data URL and parseDataURL to read one (@open-pencil/scene-graph/images).'
    }
  },
  createOnce(context) {
    return {
      TemplateLiteral(node) {
        const start = node.quasis[0]?.value.cooked ?? ''
        if (DATA_URL_START.test(start) && node.expressions.some(isEncoderCall))
          context.report({ node, messageId: 'handRolled' })
      },
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression' || staticMemberName(callee) !== 'startsWith') return
        const [prefix] = node.arguments
        if (prefix?.type === 'Literal' && typeof prefix.value === 'string')
          if (/^data:[a-z]+\//i.test(prefix.value))
            context.report({ node, messageId: 'handRolled' })
      }
    }
  }
})
