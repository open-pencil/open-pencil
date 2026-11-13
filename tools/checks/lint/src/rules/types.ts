import type { RuleDefinition } from '#lint/support/types.ts'
import type { TSESTree } from '@typescript-eslint/utils'

function isRecordStringUnknownType(node: TSESTree.TypeNode): boolean {
  if (node.type !== 'TSTypeReference') return false
  if (node.typeName.type !== 'Identifier' || node.typeName.name !== 'Record') return false
  const [key, value] = node.typeArguments?.params ?? []
  return key?.type === 'TSStringKeyword' && value?.type === 'TSUnknownKeyword'
}

const noLocalJsonObjectAliases = {
  meta: {
    docs: {
      description: 'Disallow local JsonObject aliases — import the shared type instead'
    }
  },
  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (node.id?.name !== 'JsonObject') return
        if (!isRecordStringUnknownType(node.typeAnnotation)) return
        context.report({
          node,
          message:
            'Import JsonObject from @open-pencil/scene-graph/primitives instead of declaring a local alias.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noInlineNamedTypes = {
  meta: {
    docs: {
      description: 'Disallow inline type literals that duplicate a named type'
    },
    schema: [
      {
        type: 'object',
        additionalProperties: {
          type: 'string'
        }
      }
    ]
  },
  create(context) {
    const typesOption = context.options[0]
    if (!typesOption || typeof typesOption !== 'object') return {}

    const shapeToName = new Map<string, string>()
    for (const [name, shape] of Object.entries(typesOption)) {
      if (typeof shape === 'string') shapeToName.set(shape, name)
    }

    return {
      TSTypeLiteral(node) {
        const props = node.members?.filter(
          (member) => member.type === 'TSPropertySignature' && member.key?.type === 'Identifier'
        )
        if (!props || props.length < 2) return

        const shape = props
          .map((member) => {
            if (member.type !== 'TSPropertySignature' || member.key.type !== 'Identifier') {
              return ''
            }
            const typeNode = member.typeAnnotation?.typeAnnotation
            let typeName = 'unknown'
            if (typeNode) {
              switch (typeNode.type) {
                case 'TSNumberKeyword':
                  typeName = 'number'
                  break
                case 'TSStringKeyword':
                  typeName = 'string'
                  break
                case 'TSBooleanKeyword':
                  typeName = 'boolean'
                  break
              }
            }
            return `${member.key.name}:${typeName}`
          })
          .sort()
          .join(',')

        const namedType = shapeToName.get(shape)
        if (namedType) {
          context.report({
            node,
            message: `Use '${namedType}' instead of inline type literal. Import from '@open-pencil/core'.`
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export { noLocalJsonObjectAliases, noInlineNamedTypes }
