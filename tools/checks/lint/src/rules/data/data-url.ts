import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

/**
 * The start of a data URL, bare or inside CSS `url()`, after the ASCII spaces URLs and CSS ignore.
 * A data URL's type follows `data:` directly, so a log line such as `data: …` is not one.
 */
const DATA_URL_START =
  /^[\t\n\f\r ]*(?:url\([\t\n\f\r ]*(?:["'][\t\n\f\r ]*)?)?data:(?![\t\n\f\r ])/i
const ENCODERS = new Set(['fromUint8Array', 'encodeURIComponent'])

function isEncoderCall(node: ESTree.Node): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    ENCODERS.has(node.callee.name)
  )
}

function startsDataURL(node: ESTree.Node): boolean {
  if (node.type === 'Literal')
    return typeof node.value === 'string' && DATA_URL_START.test(node.value)
  if (node.type === 'TemplateLiteral')
    return DATA_URL_START.test(node.quasis[0]?.value.cooked ?? '')
  return node.type === 'BinaryExpression' && node.operator === '+' && startsDataURL(node.left)
}

/** Whether a `+` chain that starts a data URL appends encoded bytes or markup. */
function concatenatesEncoder(node: ESTree.BinaryExpression): boolean {
  if (isEncoderCall(node.right)) return true
  return node.left.type === 'BinaryExpression' && node.left.operator === '+'
    ? concatenatesEncoder(node.left)
    : false
}

/**
 * Require the scene graph's data URL helpers over the forms that build or match a data URL by
 * hand: a template or `+` chain that starts one and encodes bytes or markup into it, and a
 * `startsWith` on a typed data URL prefix. A data URL put together from text already encoded
 * elsewhere is not caught.
 */
export const noHandRolledDataURLRule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow building data URLs from encoded bytes or markup and matching their prefix; use the @open-pencil/scene-graph/images helpers.'
    },
    messages: {
      handRolled:
        'Use imageDataURL or svgDataURL to build a data URL and parseDataURL to read one (@open-pencil/scene-graph/images).'
    }
  },
  createOnce(context) {
    return {
      TemplateLiteral(node) {
        if (startsDataURL(node) && node.expressions.some(isEncoderCall))
          context.report({ node, messageId: 'handRolled' })
      },
      BinaryExpression(node) {
        // Only the outermost `+` of a chain, so a chain reports once.
        if (node.parent.type === 'BinaryExpression' && node.parent.operator === '+') return
        if (node.operator === '+' && startsDataURL(node) && concatenatesEncoder(node))
          context.report({ node, messageId: 'handRolled' })
      },
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return
        if (callee.property.name !== 'startsWith') return
        const [prefix] = node.arguments
        if (prefix?.type !== 'Literal' || typeof prefix.value !== 'string') return
        if (/^data:[a-z]+\//i.test(prefix.value)) context.report({ node, messageId: 'handRolled' })
      }
    }
  }
})
