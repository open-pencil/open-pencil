import ts from 'typescript'

import { createTextRule, type Rule } from './support.ts'

export function isCrossPackageReexportShim(sourceRel: string, content: string): boolean {
  if (!/^packages\/[^/]+\/src\/.*\.[cm]?tsx?$/u.test(sourceRel)) return false
  const source = ts.createSourceFile(sourceRel, content, ts.ScriptTarget.Latest, false)
  if (source.statements.length === 0) return false
  return source.statements.every(
    (statement) =>
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('@open-pencil/')
  )
}

export const noCrossPackageReexportShims: Rule = createTextRule(
  'open-pencil/no-cross-package-reexport-shims',
  (sourceRel, content) =>
    isCrossPackageReexportShim(sourceRel, content)
      ? [
          {
            message:
              'Remove this cross-package re-export shim and import the owning package directly.'
          }
        ]
      : []
)
