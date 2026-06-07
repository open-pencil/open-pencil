import ts from 'typescript'

const roots = [
  'src',
  'packages/core/src',
  'packages/vue/src',
  'packages/cli/src',
  'packages/mcp/src',
  'tests',
  'scripts',
  'tools'
]

type ShapeLocation = { file: string; line: number; name: string }

const files: string[] = []
for (const root of roots) {
  for await (const path of new Bun.Glob('**/*.{ts,tsx}').scan(root)) {
    if (path.endsWith('.d.ts')) continue
    files.push(`${root}/${path}`)
  }
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

function collectShape(node: ts.Node): { name: string; shape: string } | null {
  if (ts.isInterfaceDeclaration(node))
    return { name: node.name.text, shape: membersText(node.members) }
  if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
    return { name: node.name.text, shape: membersText(node.type.members) }
  }
  return null
}

const shapes = new Map<string, ShapeLocation[]>()

for (const file of files) {
  const source = await Bun.file(file).text()
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)

  function visit(node: ts.Node) {
    const collected = collectShape(node)
    if (collected) {
      const memberCount = collected.shape.split(';').filter(Boolean).length
      if (memberCount >= 2) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const locations = shapes.get(collected.shape) ?? []
        locations.push({ file, line: position.line + 1, name: collected.name })
        shapes.set(collected.shape, locations)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

let duplicates = 0
for (const locations of shapes.values()) {
  if (locations.length < 2) continue
  duplicates++
  console.error('\nDuplicate object type shape:')
  for (const location of locations) {
    console.error(`  ${location.file}:${location.line} ${location.name}`)
  }
}

if (duplicates > 0) {
  console.error(`\nFound ${duplicates} duplicate object type shape${duplicates === 1 ? '' : 's'}.`)
  process.exit(1)
}

console.log('No duplicate object type shapes found.')
