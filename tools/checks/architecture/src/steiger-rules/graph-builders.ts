import { compact } from 'es-toolkit'
import ts from 'typescript'
import { parse as parseVueSfc } from 'vue/compiler-sfc'

import { createTextRule, type Rule } from './support.ts'

/** Packages that hold the app, CLI, MCP server, and UI rather than a document format. */
const FRONT_END_SOURCES = /^(src|packages\/(cli|mcp|vue|harness)\/src)\//u

/** Entry points that build layers from authored content without laying them out. */
function isGraphBuilder(specifier: string, name: string): boolean {
  if (specifier === '@open-pencil/dom-css' || specifier === '@open-pencil/dom-css/browser') {
    return name.endsWith('ToSceneGraph')
  }
  if (specifier === '@open-pencil/pen') return name === 'parsePenFile' || name === 'readPenFile'
  if (specifier === '@open-pencil/design-jsx') {
    return ['renderTree', 'renderJSX', 'renderRoots', 'createDesignJSXRenderer'].includes(name)
  }
  return false
}

/** The source's script with the line it starts on: a Vue file's script blocks, or the file. */
function scriptsOf(sourceRel: string, content: string): Array<{ text: string; line: number }> {
  if (!sourceRel.endsWith('.vue')) return [{ text: content, line: 1 }]
  const { script, scriptSetup } = parseVueSfc(content, { filename: sourceRel }).descriptor
  return compact([script, scriptSetup]).map((block) => ({
    text: block.content,
    line: block.loc.start.line
  }))
}

export interface GraphBuilderImport {
  specifier: string
  name: string
  line: number
}

/** Named imports a front end makes of format packages' graph builders. */
export function graphBuilderImports(sourceRel: string, content: string): GraphBuilderImport[] {
  if (!FRONT_END_SOURCES.test(sourceRel) || !/\.([cm]?tsx?|vue)$/u.test(sourceRel)) return []
  const found: GraphBuilderImport[] = []
  for (const script of scriptsOf(sourceRel, content)) {
    const source = ts.createSourceFile(sourceRel, script.text, ts.ScriptTarget.Latest, true)
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue
      const specifier = statement.moduleSpecifier.text
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      for (const element of bindings.elements) {
        const name = (element.propertyName ?? element.name).text
        if (element.isTypeOnly || !isGraphBuilder(specifier, name)) continue
        const { line } = source.getLineAndCharacterOfPosition(element.getStart(source))
        found.push({ specifier, name, line: script.line + line })
      }
    }
  }
  return found
}

export const noGraphBuildersInFrontEnds: Rule = createTextRule(
  'open-pencil/no-graph-builders-in-front-ends',
  (sourceRel, content) =>
    graphBuilderImports(sourceRel, content).map(({ specifier, name, line }) => ({
      message: `Build layers from authored content through Core, which lays them out: \`${name}\` from \`${specifier}\` skips that. Use IO \`readDocument\`, \`readHTMLDocument\`, \`sceneGraphFromStyledHTML\` from \`@open-pencil/core/io/formats/html/layers\`, or \`@open-pencil/core/design-jsx\`.`,
      line,
      column: 0
    }))
)
