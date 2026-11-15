import type { ESTree } from '@oxlint/plugins'

/** The member a fixed property access names: `object.name` or `object['name']`. */
export function staticMemberName(node: ESTree.MemberExpression): string | null {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string')
    return node.property.value
  return null
}
