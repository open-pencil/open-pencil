import { resolveVariable } from '#lint/support/scope.ts'
import { defineRule } from '@oxlint/plugins'
import type { ESTree, SourceCode } from '@oxlint/plugins'

const BASE64_ENCODINGS = new Set(['base64', 'base64url'])
const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self'])

function isBase64Encoding(node: ESTree.Node | undefined): boolean {
  return (
    node?.type === 'Literal' && typeof node.value === 'string' && BASE64_ENCODINGS.has(node.value)
  )
}

/** `atob` or `btoa` that no local binding shadows. */
function isGlobalBase64Function(sourceCode: SourceCode, node: ESTree.IdentifierReference): boolean {
  if (node.name !== 'atob' && node.name !== 'btoa') return false
  const variable = resolveVariable(sourceCode, node)
  return variable === null || variable.defs.length === 0
}

function propertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string')
    return node.property.value
  return null
}

/** Require js-base64 instead of the platform's string-based or Node-only Base64 conversions. */
export const noHandRolledBase64Rule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow atob, btoa, and Buffer Base64 conversions; use js-base64.'
    },
    messages: {
      handRolled:
        'Use js-base64: fromUint8Array/toUint8Array for bytes, encode/decode for text, and isValid before decoding untrusted input.'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type === 'Identifier') {
          if (isGlobalBase64Function(context.sourceCode, callee))
            context.report({ node, messageId: 'handRolled' })
          return
        }
        if (callee.type !== 'MemberExpression') return
        const name = propertyName(callee)
        const onGlobal =
          callee.object.type === 'Identifier' && GLOBAL_OBJECTS.has(callee.object.name)
        const bufferFrom =
          name === 'from' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Buffer' &&
          isBase64Encoding(node.arguments[1])
        const toBase64String = name === 'toString' && isBase64Encoding(node.arguments[0])
        if ((onGlobal && (name === 'atob' || name === 'btoa')) || bufferFrom || toBase64String)
          context.report({ node, messageId: 'handRolled' })
      }
    }
  }
})
