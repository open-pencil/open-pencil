import { dirname, resolve } from 'node:path'

import ts from 'typescript'

const configPath = resolve(import.meta.dir, '../tsconfig.json')
const config = ts.readConfigFile(configPath, ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath))
const entries = [
  { entry: './export', source: 'export/index.ts', declaration: 'export.d.ts' },
  {
    entry: './export/storybook/mapping',
    source: 'export/storybook/mapping/index.ts',
    declaration: 'export/storybook/mapping/index.d.ts'
  }
].map(({ entry, source, declaration }) => ({
  entry,
  source: resolve(import.meta.dir, '../src', source),
  declaration: resolve(import.meta.dir, '../dist', declaration)
}))
const program = ts.createProgram(
  entries.flatMap(({ source, declaration }) => [source, declaration]),
  {
    ...parsed.options,
    noEmit: true,
    types: []
  }
)
const checker = program.getTypeChecker()

function exportsOf(path: string): string[] {
  const source = program.getSourceFile(path)
  const symbol = source && checker.getSymbolAtLocation(source)
  if (!symbol) throw new Error(`Could not read the module exports of ${path}`)
  return checker.getExportsOfModule(symbol).map((exported) => exported.name)
}

for (const { entry, source, declaration } of entries) {
  const declarations = exportsOf(declaration)
  const missing = exportsOf(source).filter((name) => !declarations.includes(name))
  if (missing.length > 0)
    throw new Error(`Built ${entry} declarations omit public exports: ${missing.join(', ')}.`)
}
