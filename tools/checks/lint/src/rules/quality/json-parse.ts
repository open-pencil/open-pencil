import { resolveVariable } from '#lint/support/scope.ts'
import { defineRule } from '@oxlint/plugins'
import type { ESTree, SourceCode } from '@oxlint/plugins'

type Assertion = Extract<ESTree.Node, { type: 'TSAsExpression' | 'TSTypeAssertion' }>

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self'])

function propertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string')
    return node.property.value
  return null
}

/** The global `JSON`, directly or through `globalThis`, that no local binding shadows. */
function isGlobalJSON(sourceCode: SourceCode, node: ESTree.Expression): boolean {
  if (node.type === 'Identifier') {
    if (node.name !== 'JSON') return false
    const variable = resolveVariable(sourceCode, node)
    return variable === null || variable.defs.length === 0
  }
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    GLOBAL_OBJECTS.has(node.object.name) &&
    propertyName(node) === 'JSON'
  )
}

function isJSONParseCall(sourceCode: SourceCode, node: ESTree.Expression): boolean {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return false
  return propertyName(node.callee) === 'parse' && isGlobalJSON(sourceCode, node.callee.object)
}

/** `response.json()`, `Bun.file(path).json()` and the like: a parse with no schema. */
function isJSONMethodCall(node: ESTree.Expression): boolean {
  return (
    node.type === 'CallExpression' &&
    node.arguments.length === 0 &&
    node.callee.type === 'MemberExpression' &&
    propertyName(node.callee) === 'json'
  )
}

/**
 * Strip parentheses, `await`, and the assertions layered on the parsed value
 * (`as unknown as Foo`).
 */
function assertedExpression(node: Assertion): ESTree.Expression {
  let current: ESTree.Expression = node.expression
  while (
    current.type === 'ParenthesizedExpression' ||
    current.type === 'AwaitExpression' ||
    current.type === 'TSAsExpression' ||
    current.type === 'TSTypeAssertion' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSNonNullExpression'
  ) {
    current = current.type === 'AwaitExpression' ? current.argument : current.expression
  }
  return current
}

/** `unknown`, or `Promise<unknown>` for an un-awaited `.json()`. */
function isUnknownType(type: ESTree.TSType): boolean {
  let current = type
  while (current.type === 'TSParenthesizedType') current = current.typeAnnotation
  if (
    current.type === 'TSTypeReference' &&
    current.typeName.type === 'Identifier' &&
    current.typeName.name === 'Promise' &&
    current.typeArguments?.params.length === 1
  ) {
    const [argument] = current.typeArguments.params
    return argument !== undefined && isUnknownType(argument)
  }
  return current.type === 'TSUnknownKeyword'
}

/** Require a schema, not a type assertion, to give `JSON.parse` output a shape. */
export const noUnvalidatedJSONParseRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow type assertions on JSON.parse and `.json()` results other than `as unknown`.'
    },
    messages: {
      unvalidated:
        'Validate parsed JSON instead of asserting its type: v.safeParse(v.pipe(v.string(), v.parseJson(), Schema), text) (for a Response, read `await response.text()`), or assert only `as unknown` and narrow.'
    }
  },
  createOnce(context) {
    function check(node: Assertion): void {
      if (isUnknownType(node.typeAnnotation)) return
      const parsed = assertedExpression(node)
      if (isJSONParseCall(context.sourceCode, parsed) || isJSONMethodCall(parsed))
        context.report({ node, messageId: 'unvalidated' })
    }
    return {
      TSAsExpression: check,
      TSTypeAssertion: check
    }
  }
})
