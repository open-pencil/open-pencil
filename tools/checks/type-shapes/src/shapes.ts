import { compact } from 'es-toolkit/array'
import ts from 'typescript'

/** Where a shape is written: a named type, or an inline intersection named after its parts. */
export interface ShapeLocation {
  file: string
  line: number
  name: string
}

function entityNameText(name: ts.EntityName): string {
  return ts.isIdentifier(name) ? name.text : `${entityNameText(name.left)}.${name.right.text}`
}

function literalText(node: ts.LiteralTypeNode) {
  const literal = node.literal
  if (ts.isStringLiteral(literal)) return `string:${literal.text}`
  if (ts.isNumericLiteral(literal)) return `number:${literal.text}`
  if (literal.kind === ts.SyntaxKind.TrueKeyword) return 'boolean:true'
  if (literal.kind === ts.SyntaxKind.FalseKeyword) return 'boolean:false'
  return ts.SyntaxKind[literal.kind]
}

function typeText(node: ts.TypeNode | undefined): string {
  if (!node) return 'unknown'
  if (ts.isTypeReferenceNode(node)) {
    return `ref:${entityNameText(node.typeName)}<${(node.typeArguments ?? []).map(typeText).join(',')}>`
  }
  if (ts.isArrayTypeNode(node)) return `array<${typeText(node.elementType)}>`
  if (ts.isUnionTypeNode(node)) return `union<${node.types.map(typeText).sort().join('|')}>`
  if (ts.isIntersectionTypeNode(node)) {
    return `intersection<${node.types.map(typeText).sort().join('&')}>`
  }
  if (ts.isTypeLiteralNode(node)) return `object{${membersText(node.members)}}`
  if (ts.isParenthesizedTypeNode(node)) return typeText(node.type)
  if (ts.isLiteralTypeNode(node)) return `literal:${literalText(node)}`
  return ts.SyntaxKind[node.kind]
}

function keyText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text
  return null
}

function memberText(member: ts.TypeElement): string | null {
  if (ts.isPropertySignature(member) && member.name) {
    const key = keyText(member.name)
    if (!key) return null
    return `prop:${key}${member.questionToken ? '?' : ''}:${typeText(member.type)}`
  }
  if (ts.isMethodSignature(member)) {
    const key = keyText(member.name)
    if (!key) return null
    const parameters = member.parameters.map((parameter) => typeText(parameter.type)).join(',')
    return `method:${key}${member.questionToken ? '?' : ''}(${parameters}):${typeText(member.type)}`
  }
  if (ts.isIndexSignatureDeclaration(member)) {
    return `index:${member.parameters.map((param) => typeText(param.type)).join(',')}:${typeText(member.type)}`
  }
  return null
}

function membersText(members: ts.NodeArray<ts.TypeElement>) {
  return members
    .map(memberText)
    .filter((member): member is string => member !== null)
    .sort()
    .join(';')
}

/** An intersection that adds members of its own to a named type, such as `Node & { y: number }`. */
function extendsInline(node: ts.IntersectionTypeNode): boolean {
  return (
    node.types.some(ts.isTypeLiteralNode) && node.types.some((part) => !ts.isTypeLiteralNode(part))
  )
}

/** The package a path belongs to, within which an inline intersection must not repeat. */
function packageOf(path: string): string {
  const [root, name] = path.split(/[\\/]/)
  return root === 'packages' && name ? `packages/${name}` : (root ?? path)
}

function collectShape(
  node: ts.Node,
  source: ts.SourceFile,
  named: boolean
): { name: string; shape: string } | null {
  if (!named && !ts.isIntersectionTypeNode(node) && !ts.isTypeAliasDeclaration(node)) return null
  if (ts.isInterfaceDeclaration(node)) {
    const shape = membersText(node.members)
    // A shape of fewer than two members is too small to be worth a shared name.
    return compact(shape.split(';')).length >= 2 ? { name: node.name.text, shape } : null
  }
  if (ts.isTypeAliasDeclaration(node)) {
    if (ts.isTypeLiteralNode(node.type)) {
      if (!named) return null
      const shape = membersText(node.type.members)
      return compact(shape.split(';')).length >= 2 ? { name: node.name.text, shape } : null
    }
    if (ts.isIntersectionTypeNode(node.type) && extendsInline(node.type)) {
      return { name: node.name.text, shape: `${packageOf(source.fileName)}:${typeText(node.type)}` }
    }
    return null
  }
  // Any size counts here: written twice, even `{ y: number }` on a type deserves a name.
  if (ts.isIntersectionTypeNode(node) && extendsInline(node)) {
    // An alias's own intersection is collected under its name above.
    if (ts.isTypeAliasDeclaration(node.parent)) return null
    return {
      name: node.getText(source).replace(/\s+/g, ' '),
      shape: `${packageOf(source.fileName)}:${typeText(node)}`
    }
  }
  return null
}

/**
 * Shapes written more than once, each with every place it is written: named object shapes
 * across the sources marked `named`, and an inline intersection, such as `Node & { y: number }`,
 * within a package, in any source.
 */
export function duplicateShapes(
  sources: Iterable<readonly [path: string, text: string, named: boolean]>
): ShapeLocation[][] {
  const shapes = new Map<string, ShapeLocation[]>()
  for (const [path, text, named] of sources) {
    const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind)
    const visit = (node: ts.Node) => {
      const collected = collectShape(node, source, named)
      if (collected) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source))
        const locations = shapes.get(collected.shape) ?? []
        locations.push({ file: path, line: position.line + 1, name: collected.name })
        shapes.set(collected.shape, locations)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return [...shapes.values()].filter((locations) => locations.length > 1)
}
