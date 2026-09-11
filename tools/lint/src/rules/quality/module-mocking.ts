import { resolveVariable } from '#lint/support/scope.ts'
import { defineRule } from '@oxlint/plugins'
import type { ESTree, SourceCode } from '@oxlint/plugins'

const moduleMockMethods = new Set(['doMock', 'mock', 'module', 'unstable_mockModule'])

function importedName(node: ESTree.Node): string | null {
  if (node.type !== 'ImportSpecifier') return null
  return node.imported.type === 'Identifier' ? node.imported.name : node.imported.value
}

function isTestFrameworkObject(
  sourceCode: SourceCode,
  expression: ESTree.Expression
): expression is ESTree.IdentifierReference {
  if (expression.type !== 'Identifier') return false
  const globalNames = new Set(['jest', 'mock', 'vi'])
  if (globalNames.has(expression.name) && sourceCode.isGlobalReference(expression)) return true

  const variable = resolveVariable(sourceCode, expression)
  if (variable === null || variable.defs.length === 0) return globalNames.has(expression.name)
  return variable.defs.some((definition) => {
    if (definition.type !== 'ImportBinding' || definition.parent?.type !== 'ImportDeclaration') {
      return false
    }
    const source = definition.parent.source.value
    const name = importedName(definition.node)
    return (
      (source === 'vitest' && name === 'vi') ||
      (source === '@jest/globals' && name === 'jest') ||
      (source === 'bun:test' && name === 'mock')
    )
  })
}

function moduleMockCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  if (!('property' in callee) || !('object' in callee) || !('computed' in callee)) return false
  if (!isTestFrameworkObject(sourceCode, callee.object)) return false
  const property = callee.property
  let method: string | null = null
  if (callee.computed && property.type === 'Literal' && typeof property.value === 'string') {
    method = property.value
  } else if (!callee.computed && property.type === 'Identifier') {
    method = property.name
  }
  return method !== null && moduleMockMethods.has(method)
}

/** Ban test framework module mocking in favor of real dependency seams. */
export const noModuleMockingRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Bun, Vitest, and Jest module mocking; tests must replace dependencies through real interfaces.'
    },
    messages: {
      moduleMock:
        'Replace module registry mocking with dependency injection through a real interface, service layer, or faithful test implementation. Bun mock.restore() does not undo mock.module().'
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Super' || node.callee.type === 'V8IntrinsicExpression') return
        if (moduleMockCall(context.sourceCode, node.callee)) {
          context.report({ node, messageId: 'moduleMock' })
        }
      }
    }
  }
})
