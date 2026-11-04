import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'
import { compact } from 'es-toolkit/array'

type TypeNode = ESTree.TSType

function typeParameterNodes(node: ESTree.TSTypeReference): TypeNode[] {
  return node.typeArguments?.params ?? []
}

function isRecordStringUnknownType(node: TypeNode | null | undefined): boolean {
  if (node?.type !== 'TSTypeReference') return false
  if (node.typeName.type !== 'Identifier' || node.typeName.name !== 'Record') return false
  const params = typeParameterNodes(node)
  return params[0]?.type === 'TSStringKeyword' && params[1]?.type === 'TSUnknownKeyword'
}

function hasASTChild(
  node: unknown,
  predicate: (node: TypeNode) => boolean,
  seen = new WeakSet<object>()
): boolean {
  if (!node || typeof node !== 'object') return false
  if (seen.has(node)) return false
  seen.add(node)
  if (predicate(node as TypeNode)) return true

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') continue
    if (Array.isArray(value)) {
      if (value.some((child) => hasASTChild(child, predicate, seen))) return true
    } else if (value && typeof value === 'object' && hasASTChild(value, predicate, seen)) {
      return true
    }
  }
  return false
}

function containsRecordStringUnknownType(node: TypeNode | null | undefined): boolean {
  if (isRecordStringUnknownType(node)) return true
  if (node?.type === 'TSArrayType') return isRecordStringUnknownType(node.elementType)
  if (node?.type === 'TSUnionType') return node.types.some(containsRecordStringUnknownType)
  return false
}

function isUnknownArrayType(node: TypeNode | null | undefined): boolean {
  return node?.type === 'TSArrayType' && node.elementType.type === 'TSUnknownKeyword'
}

function hasInlineUnknownArrayProperty(node: TypeNode): boolean {
  if (node.type !== 'TSTypeLiteral') return false
  return node.members.some((member) => {
    if (member.type !== 'TSPropertySignature') return false
    const typeNode = member.typeAnnotation?.typeAnnotation
    return isUnknownArrayType(typeNode)
  })
}

function containsInlineUnknownObjectType(node: TypeNode): boolean {
  return hasASTChild(node, hasInlineUnknownArrayProperty)
}

const noBroadUnknownTypeAssertions = defineRule({
  meta: {
    docs: {
      description:
        'Disallow broad unknown object type assertions. Add a named domain type or a type guard instead.'
    }
  },
  create(context) {
    function check(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) {
      if (containsRecordStringUnknownType(node.typeAnnotation)) {
        context.report({
          node,
          message:
            'Do not cast to Record<string, unknown>. Add a named domain type or a type guard.'
        })
        return
      }
      if (containsInlineUnknownObjectType(node.typeAnnotation)) {
        context.report({
          node,
          message: 'Do not cast to an inline unknown object shape. Add a named domain type.'
        })
      }
    }

    return {
      TSAsExpression: check,
      TSTypeAssertion: check
    }
  }
})

function typeNameText(node: ESTree.TSTypeName | null | undefined): string {
  if (!node) return 'unknown'
  if (node.type === 'Identifier') return node.name
  if (node.type === 'TSQualifiedName')
    return `${typeNameText(node.left)}.${typeNameText(node.right)}`
  return node.type
}

function parameterType(parameter: ESTree.ParamPattern): string {
  return canonicalType(
    'typeAnnotation' in parameter ? parameter.typeAnnotation?.typeAnnotation : null
  )
}

function canonicalType(node: TypeNode | null | undefined): string {
  if (!node) return 'unknown'
  switch (node.type) {
    case 'TSStringKeyword':
      return 'string'
    case 'TSNumberKeyword':
      return 'number'
    case 'TSBooleanKeyword':
      return 'boolean'
    case 'TSUnknownKeyword':
      return 'unknown'
    case 'TSNullKeyword':
      return 'null'
    case 'TSUndefinedKeyword':
      return 'undefined'
    case 'TSLiteralType':
      return `literal:${'value' in node.literal ? node.literal.value : node.literal.type}`
    case 'TSArrayType':
      return `array<${canonicalType(node.elementType)}>`
    case 'TSTypeReference': {
      const params = typeParameterNodes(node).map(canonicalType).join(',')
      return `ref:${typeNameText(node.typeName)}<${params}>`
    }
    case 'TSUnionType':
      return `union<${node.types.map(canonicalType).sort().join('|')}>`
    case 'TSTypeLiteral':
      return `object{${canonicalMembers(node.members)}}`
    case 'TSFunctionType': {
      const parameters = node.params.map(parameterType).join(',')
      return `function<${parameters}=>${canonicalType(node.returnType.typeAnnotation)}>`
    }
    default:
      return node.type
  }
}

function propertyKeyName(key: ESTree.PropertyKey): string | null {
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal') return String(key.value)
  return null
}

function canonicalMember(member: ESTree.TSSignature): string | null {
  if (member.type === 'TSIndexSignature') {
    const keyType = member.parameters[0]?.typeAnnotation.typeAnnotation
    return `index:${canonicalType(keyType)}:${canonicalType(member.typeAnnotation.typeAnnotation)}`
  }
  if (member.type !== 'TSPropertySignature') return null
  const name = propertyKeyName(member.key)
  if (!name) return null
  const optional = member.optional ? '?' : ''
  return `prop:${name}${optional}:${canonicalType(member.typeAnnotation?.typeAnnotation)}`
}

function canonicalMembers(members: readonly ESTree.TSSignature[] | undefined): string {
  return compact((members ?? []).map(canonicalMember))
    .sort()
    .join(';')
}

function namedTypeShape(
  node: ESTree.TSInterfaceDeclaration | ESTree.TSTypeAliasDeclaration
): string | null {
  if (node.type === 'TSInterfaceDeclaration') return canonicalMembers(node.body.body)
  if (node.typeAnnotation.type === 'TSTypeLiteral') {
    return canonicalMembers(node.typeAnnotation.members)
  }
  return null
}

const noDuplicateTypeShapes = defineRule({
  meta: {
    docs: {
      description: 'Disallow duplicate local object type/interface shapes in one file'
    }
  },
  create(context) {
    const seen = new Set<string>()
    function check(node: ESTree.TSInterfaceDeclaration | ESTree.TSTypeAliasDeclaration) {
      const shape = namedTypeShape(node)
      if (!shape || compact(shape.split(';')).length < 2) return
      if (!seen.has(shape)) {
        seen.add(shape)
        return
      }
      context.report({
        node,
        message:
          'Duplicate object type shape. Reuse the existing named type instead of redeclaring the same members.'
      })
    }
    return { TSInterfaceDeclaration: check, TSTypeAliasDeclaration: check }
  }
})

const noImportTypeAnnotations = defineRule({
  meta: {
    docs: {
      description: 'Disallow inline import() type annotations — use top-level import type instead'
    }
  },
  create(context) {
    return {
      TSImportType(node) {
        context.report({
          node,
          message:
            'Use a top-level import type instead of an inline import() type annotation. Dynamic imports are only for runtime lazy loading.'
        })
      }
    }
  }
})

function isUnknownKeyword(node: { type: string } | null | undefined): boolean {
  return node?.type === 'TSUnknownKeyword'
}

/** The type asserted first in `value as unknown as T`, `<unknown>value as T`, and the like. */
function innerAssertion(node: ESTree.TSAsExpression): { type: string } | null | undefined {
  const inner = node.expression
  return 'typeAnnotation' in inner ? inner.typeAnnotation : undefined
}

const noBroadDoubleCast = defineRule({
  meta: {
    docs: {
      description: 'Disallow broad `as unknown as` casts'
    }
  },
  create(context) {
    return {
      TSAsExpression(node) {
        if (!isUnknownKeyword(innerAssertion(node))) return
        context.report({
          node,
          message: 'Avoid `as unknown as ...`; model the value with a precise type or helper.'
        })
      }
    }
  }
})

const noUnknownRecordDoubleCast = defineRule({
  meta: {
    docs: {
      description: 'Disallow `as unknown as Record<string, unknown>` broad object casts'
    }
  },
  create(context) {
    return {
      TSAsExpression(node) {
        if (!isUnknownKeyword(innerAssertion(node))) return
        if (!isRecordStringUnknownType(node.typeAnnotation)) return
        context.report({
          node,
          message:
            'Avoid `as unknown as Record<string, unknown>`; use a precise type or direct public API.'
        })
      }
    }
  }
})

const noFunctionType = defineRule({
  meta: {
    docs: {
      description: 'Disallow the broad Function type; use an explicit callable signature'
    }
  },
  create(context) {
    return {
      TSTypeReference(node) {
        if (node.typeName.type !== 'Identifier' || node.typeName.name !== 'Function') return
        context.report({
          node,
          message: 'Use an explicit function signature instead of the broad Function type.'
        })
      }
    }
  }
})

const noTsSuppressionComments = defineRule({
  meta: {
    docs: {
      description: 'Disallow TypeScript suppression comments; fix types instead'
    }
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (!/@ts-(?:ignore|expect-error|nocheck)\b/.test(comment.value)) continue
          context.report({
            node: comment,
            message:
              'Do not use TypeScript suppression comments; fix the type or add a typed helper.'
          })
        }
      }
    }
  }
})

export {
  noBroadDoubleCast,
  noBroadUnknownTypeAssertions,
  noDuplicateTypeShapes,
  noFunctionType,
  noImportTypeAnnotations,
  noTsSuppressionComments,
  noUnknownRecordDoubleCast
}
