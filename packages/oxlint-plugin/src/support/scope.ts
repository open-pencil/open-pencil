import type { ESTree, Scope, SourceCode, Variable } from '@oxlint/plugins'

/** Resolve an identifier to its binding by walking lexical scopes upward. */
export function resolveVariable(
  sourceCode: SourceCode,
  identifier: Extract<ESTree.Node, { type: 'Identifier' }>
): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier)
  while (scope !== null) {
    const variable = scope.set.get(identifier.name)
    if (variable !== undefined) return variable
    scope = scope.upper
  }
  return null
}

/** The value a `const` binding is declared with, when it is one; `null` for any other binding. */
export function constInitializer(variable: Variable): ESTree.Expression | null {
  for (const definition of variable.defs) {
    if (
      definition.type === 'Variable' &&
      definition.node.type === 'VariableDeclarator' &&
      definition.node.id.type === 'Identifier' &&
      definition.node.init !== null &&
      definition.node.parent.type === 'VariableDeclaration' &&
      definition.node.parent.kind === 'const'
    ) {
      return definition.node.init
    }
  }
  return null
}
