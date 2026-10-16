import { dirname, resolve } from 'node:path'

import ts from 'typescript'

const configPath = resolve(import.meta.dir, '../tsconfig.json')
const config = ts.readConfigFile(configPath, ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath))
const sourcePath = resolve(import.meta.dir, '../src/export/index.ts')
const declarationPath = resolve(import.meta.dir, '../dist/export.d.ts')
const program = ts.createProgram([sourcePath, declarationPath], {
  ...parsed.options,
  noEmit: true,
  types: []
})
const checker = program.getTypeChecker()

function exportsOf(path: string): string[] {
  const source = program.getSourceFile(path)
  const symbol = source && checker.getSymbolAtLocation(source)
  if (!symbol) throw new Error(`Could not read the module exports of ${path}`)
  return checker.getExportsOfModule(symbol).map((exported) => exported.name)
}

const declarations = exportsOf(declarationPath)
const missing = exportsOf(sourcePath).filter((name) => !declarations.includes(name))
if (missing.length > 0)
  throw new Error(`Built ./export declarations omit public exports: ${missing.join(', ')}.`)
