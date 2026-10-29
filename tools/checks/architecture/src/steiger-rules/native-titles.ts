import ts from 'typescript'
import { parse as parseVueSfc } from 'vue/compiler-sfc'

import { createTextRule, type Rule } from './support.ts'

const VUE_ATTRIBUTE_NODE = 6
const VUE_DIRECTIVE_NODE = 7

type VueTemplateNode = {
  type?: number
  name?: string
  tag?: string
  arg?: { content?: string }
  props?: VueTemplateNode[]
  children?: VueTemplateNode[]
  loc?: { start?: { line?: number; column?: number } }
}

function propName(prop: VueTemplateNode) {
  if (prop.type === VUE_ATTRIBUTE_NODE) return prop.name ?? null
  if (prop.type === VUE_DIRECTIVE_NODE && prop.name === 'bind') return prop.arg?.content ?? null
  return null
}

/**
 * Components the file imports from vccs. A vccs chart takes `title` as its accessible name,
 * which it renders as the chart's `aria-label`, not as a native tooltip.
 */
function chartComponents(sourceRel: string, scripts: string[]): Set<string> {
  const names = new Set<string>()
  for (const script of scripts) {
    const source = ts.createSourceFile(sourceRel, script, ts.ScriptTarget.Latest, true)
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue
      if (statement.moduleSpecifier.text !== 'vccs') continue
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      for (const element of bindings.elements) names.add(element.name.text)
    }
  }
  return names
}

export interface NativeTitle {
  line?: number
  column?: number
}

/** `title` attributes and bindings in an app or SDK Vue template, except on vccs charts. */
export function nativeTitles(sourceRel: string, content: string): NativeTitle[] {
  if (
    !sourceRel.endsWith('.vue') ||
    (!sourceRel.startsWith('src/') && !sourceRel.startsWith('packages/vue/src/'))
  ) {
    return []
  }
  const { descriptor } = parseVueSfc(content, { filename: sourceRel })
  const template = descriptor.template?.ast
  if (!template) return []
  const charts = chartComponents(sourceRel, [
    descriptor.script?.content ?? '',
    descriptor.scriptSetup?.content ?? ''
  ])

  const found: NativeTitle[] = []
  const visit = (node: VueTemplateNode) => {
    if (!node.tag || !charts.has(node.tag)) {
      for (const prop of node.props ?? []) {
        if (propName(prop) !== 'title') continue
        found.push({ line: prop.loc?.start?.line, column: prop.loc?.start?.column })
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(template as VueTemplateNode)
  return found
}

export const noNativeTitleAttributesInVue: Rule = createTextRule(
  'open-pencil/no-native-title-attributes-in-vue',
  (sourceRel, content) =>
    nativeTitles(sourceRel, content).map((position) => ({
      message: 'Use Tip/Reka tooltip patterns instead of native title attributes.',
      ...position
    }))
)
