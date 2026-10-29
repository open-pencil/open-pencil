import ts from 'typescript'

function declares(statement: ts.Statement, name: string): boolean {
  if (ts.isFunctionDeclaration(statement)) return statement.name?.text === name
  if (!ts.isVariableStatement(statement)) return false
  return statement.declarationList.declarations.some(
    (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
  )
}

/**
 * The top-level declarations of `names` in a TypeScript module, as written, each with the comment
 * before it and exported. Throws when the module no longer declares one, so a release that
 * moves or renames one fails the generator instead of being copied wrongly.
 */
export function extractDeclarations(source: string, path: string, names: string[]): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  return names.map((name) => {
    const statement = file.statements.find((candidate) => declares(candidate, name))
    if (!statement) throw new Error(`${path} no longer declares ${name}`)
    const comment = source.slice(statement.getFullStart(), statement.getStart(file)).trim()
    const text = statement.getText(file)
    const exported = ts
      .getModifiers(statement as ts.HasModifiers)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    const declaration = exported ? text : `export ${text}`
    return comment ? `${comment}\n${declaration}` : declaration
  })
}

/** Whether a module imports anything, which a module copied whole must not. */
export function hasImports(source: string, path: string): boolean {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false)
  return file.statements.some(ts.isImportDeclaration)
}
