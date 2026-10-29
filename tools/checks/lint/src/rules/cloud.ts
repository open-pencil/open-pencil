import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

/** Names that hold Cloud credentials: secrets, tokens, cookies, authorization values, room keys. */
/** Names that end in a credential noun: `accessToken` and `authSecret`, not `tokenCount`. */
const SECRET_NAME = /(?:secret|token|authorization|cookie|room_?key|private_?key)s?$/i
/** A secret or token written into a URL's query string. */
const QUERY_SECRET_TEXT = /[?&](?:secret|token)=/
const QUERY_SECRET_NAMES = new Set(['secret', 'token'])
const QUERY_METHODS = new Set(['set', 'append'])
const CONSOLE_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug'])

function memberName(node: ESTree.MemberExpression): string | null {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string')
    return node.property.value
  return null
}

function isStringLiteral(node: ESTree.Node | undefined): boolean {
  if (node?.type === 'Literal') return typeof node.value === 'string'
  return node?.type === 'TemplateLiteral' && node.expressions.length === 0
}

/** The name a logged value is read through: `token`, `session.token`, `headers['cookie']`. */
function valueName(node: ESTree.Node): string | null {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression') return memberName(node)
  return null
}

function propertyKeyName(property: ESTree.ObjectProperty): string | null {
  if (!property.computed && property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'Literal' && typeof property.key.value === 'string')
    return property.key.value
  return null
}

/**
 * The names a logged value is built from: identifiers, members, and object keys, through
 * templates, concatenation, objects, arrays, and spreads.
 */
function loggedNames(node: ESTree.Node | null): string[] {
  if (!node) return []
  switch (node.type) {
    case 'TemplateLiteral':
      return node.expressions.flatMap(loggedNames)
    case 'BinaryExpression':
      return [...loggedNames(node.left), ...loggedNames(node.right)]
    case 'SpreadElement':
      return loggedNames(node.argument)
    case 'ArrayExpression':
      return node.elements.flatMap(loggedNames)
    case 'ObjectExpression':
      return node.properties.flatMap((property) =>
        property.type === 'SpreadElement'
          ? loggedNames(property.argument)
          : [propertyKeyName(property) ?? [], loggedNames(property.value)].flat()
      )
    default: {
      const name = valueName(node)
      return name === null ? [] : [name]
    }
  }
}

/** Cloud APIs answer with typed JSON or a constant body, never HTML assembled from values. */
export const noCloudDynamicHTMLRule = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow HTML responses built from values in the Cloud server.' },
    messages: {
      dynamic:
        'Return typed JSON or a constant HTML body; never build an HTML response from values.'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression' || memberName(callee) !== 'html') return
        if (!isStringLiteral(node.arguments[0])) context.report({ node, messageId: 'dynamic' })
      }
    }
  }
})

/** Capability secrets travel in URL fragments or request bodies, which never reach access logs. */
export const noCloudSecretInQueryRule = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow putting Cloud secrets or tokens in URL query strings.' },
    messages: {
      query:
        'Put capability secrets in the URL fragment or the request body, never the query string.'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression') return
        const method = memberName(callee)
        if (!method || !QUERY_METHODS.has(method)) return
        const target = callee.object
        if (target.type !== 'MemberExpression' || memberName(target) !== 'searchParams') return
        const [key] = node.arguments
        if (
          key?.type === 'Literal' &&
          typeof key.value === 'string' &&
          QUERY_SECRET_NAMES.has(key.value)
        )
          context.report({ node, messageId: 'query' })
      },
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'URLSearchParams') return
        const [init] = node.arguments
        if (init?.type !== 'ObjectExpression') return
        const named = init.properties.some((property) => {
          if (property.type === 'SpreadElement') return false
          const name = propertyKeyName(property)
          return name !== null && QUERY_SECRET_NAMES.has(name)
        })
        if (named) context.report({ node, messageId: 'query' })
      },
      TemplateLiteral(node) {
        if (node.quasis.some((quasi) => QUERY_SECRET_TEXT.test(quasi.value.raw)))
          context.report({ node, messageId: 'query' })
      }
    }
  }
})

/** Logs outlive sessions and leave the machine; credentials never go into them. */
export const noCloudSecretLoggingRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow logging Cloud secrets, tokens, cookies, or authorization values.'
    },
    messages: {
      logged: 'Do not log secrets, tokens, cookies, room keys, or authorization values.'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression') return
        if (callee.object.type !== 'Identifier' || callee.object.name !== 'console') return
        const method = memberName(callee)
        if (!method || !CONSOLE_METHODS.has(method)) return
        const leaks = node.arguments.some((argument) =>
          loggedNames(argument).some((name) => SECRET_NAME.test(name))
        )
        if (leaks) context.report({ node, messageId: 'logged' })
      }
    }
  }
})
