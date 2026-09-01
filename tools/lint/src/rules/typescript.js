function typeParameterNodes(node) {
  return node?.typeParameters?.params ?? node?.typeArguments?.params ?? []
}

function isRecordStringUnknownType(node) {
  if (node?.type !== 'TSTypeReference') return false
  if (node.typeName?.type !== 'Identifier' || node.typeName.name !== 'Record') return false
  const params = typeParameterNodes(node)
  return params[0]?.type === 'TSStringKeyword' && params[1]?.type === 'TSUnknownKeyword'
}

function hasAstChild(node, predicate, seen = new WeakSet()) {
  if (!node || typeof node !== 'object') return false
  if (seen.has(node)) return false
  seen.add(node)
  if (predicate(node)) return true

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') continue
    if (Array.isArray(value)) {
      if (value.some((child) => hasAstChild(child, predicate, seen))) return true
    } else if (value && typeof value === 'object' && hasAstChild(value, predicate, seen)) {
      return true
    }
  }
  return false
}

function containsRecordStringUnknownType(node) {
  if (isRecordStringUnknownType(node)) return true
  if (node?.type === 'TSArrayType') return isRecordStringUnknownType(node.elementType)
  if (node?.type === 'TSUnionType')
    return node.types?.some(containsRecordStringUnknownType) ?? false
  return false
}

function isUnknownArrayType(node) {
  return node?.type === 'TSArrayType' && node.elementType?.type === 'TSUnknownKeyword'
}

function hasInlineUnknownArrayProperty(node) {
  if (node?.type !== 'TSTypeLiteral') return false
  return (node.members ?? []).some((member) => {
    const typeNode = member.typeAnnotation?.typeAnnotation
    return isUnknownArrayType(typeNode)
  })
}

function containsInlineUnknownObjectType(node) {
  return hasAstChild(node, hasInlineUnknownArrayProperty)
}

const noBroadUnknownTypeAssertions = {
  meta: {
    docs: {
      description:
        'Disallow broad unknown object type assertions. Add a named domain type or a type guard instead.'
    }
  },
  create(context) {
    function check(node) {
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
}

function typeNameText(node) {
  if (!node) return 'unknown'
  if (node.type === 'Identifier') return node.name
  if (node.type === 'TSQualifiedName')
    return `${typeNameText(node.left)}.${typeNameText(node.right)}`
  return node.type
}

function canonicalType(node) {
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
      return `literal:${node.literal?.value ?? node.literal?.type}`
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
    case 'TSParenthesizedType':
      return canonicalType(node.typeAnnotation)
    case 'TSFunctionType':
      return 'function'
    default:
      return node.type
  }
}

function propertyKeyName(key) {
  if (key?.type === 'Identifier') return key.name
  if (key?.type === 'Literal') return String(key.value)
  return null
}

function canonicalMember(member) {
  if (member.type === 'TSIndexSignature') {
    const param = member.parameters?.[0]
    const keyType = param?.typeAnnotation?.typeAnnotation
    return `index:${canonicalType(keyType)}:${canonicalType(member.typeAnnotation?.typeAnnotation)}`
  }
  if (member.type !== 'TSPropertySignature') return null
  const name = propertyKeyName(member.key)
  if (!name) return null
  const optional = member.optional ? '?' : ''
  return `prop:${name}${optional}:${canonicalType(member.typeAnnotation?.typeAnnotation)}`
}

function canonicalMembers(members) {
  return (members ?? []).map(canonicalMember).filter(Boolean).sort().join(';')
}

function namedTypeShape(node) {
  if (node.type === 'TSInterfaceDeclaration') return canonicalMembers(node.body?.body)
  if (node.type === 'TSTypeAliasDeclaration' && node.typeAnnotation?.type === 'TSTypeLiteral') {
    return canonicalMembers(node.typeAnnotation.members)
  }
  return null
}

const noDuplicateTypeShapes = {
  meta: {
    docs: {
      description: 'Disallow duplicate local object type/interface shapes in one file'
    }
  },
  create(context) {
    const seen = new Map()
    return {
      'TSInterfaceDeclaration, TSTypeAliasDeclaration'(node) {
        const shape = namedTypeShape(node)
        if (!shape) return
        const memberCount = shape ? shape.split(';').filter(Boolean).length : 0
        if (memberCount < 2) return
        const first = seen.get(shape)
        if (!first) {
          seen.set(shape, node)
          return
        }
        context.report({
          node,
          message:
            'Duplicate object type shape. Reuse the existing named type instead of redeclaring the same members.'
        })
      }
    }
  }
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
}

const noImportTypeAnnotations = {
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
}

export {
  noBroadUnknownTypeAssertions,
  noDuplicateTypeShapes,
  noLocalJsonObjectAliases,
  noImportTypeAnnotations
}
