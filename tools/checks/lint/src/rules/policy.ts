import { normalizedFilename } from '#lint/support/context.ts'
import { createProgramFilenameRule } from '#lint/support/factories.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import {
  VUE_SIMPLE_EXPRESSION_NODE,
  type ExpressionAstNode,
  type VueTemplateNode,
  vueTemplateAst,
  walkExpressionAst,
  walkVueTemplateAst
} from '#lint/support/vue.ts'
import type { TSESTree } from '@typescript-eslint/utils'

function isObjectKeyIdentifier(node: TSESTree.Identifier): boolean {
  const parent = node.parent
  return (
    (parent?.type === 'Property' || parent?.type === 'TSPropertySignature') &&
    parent.key === node &&
    !parent.computed &&
    (parent.type !== 'Property' || parent.value !== node)
  )
}

function isExternalMemberIdentifier(node: TSESTree.Identifier): boolean {
  const parent = node.parent
  return (
    parent?.type === 'MemberExpression' &&
    parent.property === node &&
    !parent.computed &&
    parent.object.type !== 'ThisExpression'
  )
}

function isIgnoredAcronymIdentifier(
  node: TSESTree.Identifier,
  ignoredImports: ReadonlySet<string>
): boolean {
  if (isObjectKeyIdentifier(node) || isExternalMemberIdentifier(node)) return true
  const parent = node.parent
  if (parent?.type === 'ImportSpecifier' && parent.imported === node) {
    return (
      parent.parent?.source?.type !== 'Literal' || ignoredImports.has(parent.parent.source.value)
    )
  }
  return parent?.type === 'ImportDefaultSpecifier' || parent?.type === 'ImportNamespaceSpecifier'
}

const noMixedCaseAcronymIdentifiers = {
  meta: {
    docs: {
      description: 'Require canonical uppercase casing for acronyms in first-party identifiers'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.includes('/tools/checks/lint/')) return {}
    const canonicalAcronym =
      /(?:Acp|Ai|Api|Cli|Cors|Css|Html|Ime|Json|Jsx|Mcp|Pdf|Png|Rgb|Rpc|Rtl|Svg|Ui|Url|Uri|Xml)/g
    const ignoredImports = new Set([
      '@agentclientprotocol/sdk',
      '@realfavicongenerator/generate-favicon',
      '@tauri-apps/plugin-clipboard-manager',
      '@tauri-apps/plugin-opener',
      '@vueuse/core',
      'culori',
      'reka-ui'
    ])
    const upstreamIdentifiers = new Set([
      'convertToHsb',
      'convertToHsl',
      'convertToRgb',
      'formatCss',
      'formatRgb',
      'McpServer',
      'ndJsonStream',
      'openUrl',
      'useObjectUrl',
      'useUrlSearchParams',
      'writeHtml'
    ])

    return {
      Identifier(node) {
        if (upstreamIdentifiers.has(node.name)) return
        const mixedCaseAcronym = [...node.name.matchAll(canonicalAcronym)].find((match) => {
          const end = (match.index ?? 0) + match[0].length
          return end === node.name.length || /[A-Z0-9_$]/.test(node.name[end] ?? '')
        })
        if (!mixedCaseAcronym) return
        if (isIgnoredAcronymIdentifier(node, ignoredImports)) return
        context.report({
          node,
          message: `Use canonical uppercase acronym casing in "${node.name}".`
        })
      }
    }
  }
} satisfies RuleDefinition

const noFlatKiwiModules = createProgramFilenameRule({
  description: 'Disallow flat top-level Kiwi modules — group code under Kiwi subdomains',
  check(file) {
    const marker = '/packages/core/src/kiwi/'
    const start = file.indexOf(marker)
    if (start === -1) return false

    const relativePath = file.slice(start + marker.length)
    if (relativePath.includes('/') || relativePath === 'index.ts') return false

    return 'Move Kiwi modules under binary/, fig/, node-change/, instance-overrides/, or kiwi-schema/ instead of adding flat top-level files.'
  }
})

const noConditionalObjectSpreads = {
  meta: {
    docs: {
      description: 'Require explicit branches instead of complex conditional object spreads'
    }
  },
  create(context) {
    return {
      SpreadElement(node) {
        if (node.parent?.type !== 'ObjectExpression') return
        if (node.argument?.type !== 'ConditionalExpression') return
        const branchSizes = [node.argument.consequent, node.argument.alternate]
          .filter((branch) => branch.type === 'ObjectExpression')
          .map((branch) => branch.properties.length)
        const conditionalSpreadCount = node.parent.properties.filter(
          (property) =>
            property.type === 'SpreadElement' && property.argument.type === 'ConditionalExpression'
        ).length
        if (conditionalSpreadCount < 2 && branchSizes.every((size) => size < 2)) return
        context.report({
          node,
          message:
            'Extract conditional object construction into an explicit branch or named domain projection.'
        })
      }
    }
  }
} satisfies RuleDefinition

/** A key when it is fixed (`key`, `'key'`, `` `key` ``), not one read from a variable. */
function fixedKey(key: TSESTree.Node, computed: boolean): string | null {
  if (key.type === 'Identifier') return computed ? null : key.name
  if (key.type === 'Literal') return typeof key.value === 'string' ? key.value : null
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? null
  }
  return null
}

const CORE_PROFILE = ['/packages/core/src/editor/views/', '/packages/core/src/editor/state/']

/** The app's own services, as opposed to its views and components. */
function isAppService(file: string): boolean {
  return file.includes('/src/app/') && !file.includes('/packages/')
}

/** Front ends: the Vue SDK, the app's views and components, and the docs site's theme. */
function isFrontEnd(file: string): boolean {
  return (
    file.includes('/packages/vue/src/') ||
    (!file.includes('/packages/') && file.includes('/src/') && !isAppService(file)) ||
    file.includes('/packages/docs/.vitepress/theme/')
  )
}

/**
 * What the editor profile resolves from, and the code that may read each: Core's views and state
 * own them all, the read-only module applies the restrictions, the app, as the host, sets them,
 * and the document's kind is the graph's own field, which formats save; front ends read the
 * profile instead.
 */
const PROFILE_INPUTS: Record<string, (file: string) => boolean> = {
  canvasView: (file) => CORE_PROFILE.some((owner) => file.includes(owner)),
  hostRestrictions: (file) =>
    CORE_PROFILE.some((owner) => file.includes(owner)) ||
    file.includes('/packages/core/src/editor/read-only/') ||
    isAppService(file),
  documentKind: (file) => !isFrontEnd(file)
}

/** The fixed key a template member expression reads (`a.key`, `a['key']`), or null. */
function templateMemberKey(node: ExpressionAstNode): string | null {
  if (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') return null
  const key = node.property as ExpressionAstNode | undefined
  if (node.computed !== true && key?.type === 'Identifier') return key.name ?? null
  if (key?.type === 'StringLiteral' && typeof key.value === 'string') return key.value
  return null
}

/** The profile inputs a Vue template expression reads. */
function templateProfileInputs(expression: VueTemplateNode, inputs: Set<string>): string[] {
  if (expression.type !== VUE_SIMPLE_EXPRESSION_NODE || !expression.ast) return []
  const found: string[] = []
  walkExpressionAst(expression.ast as ExpressionAstNode, (node) => {
    const key = templateMemberKey(node)
    if (key && inputs.has(key)) found.push(key)
  })
  return found
}

function profileInputMessage(input: string): string {
  return `Read how the editor behaves from resolveEditorProfile instead of its ${input}.`
}

/**
 * The editor behaves by the profile its canvas view resolves to, narrowed by the host's
 * restrictions, so other code reads the profile's values, never those inputs: checks of the view
 * and of read-only are how each came to branch at every place the editor behaves differently.
 */
const noEditorProfileInputs: RuleDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow reading the editor profile's inputs (canvas view, restrictions) outside their owners — read resolveEditorProfile instead"
    },
    schema: []
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/src/') && !file.includes('/packages/docs/.vitepress/theme/')) return {}
    const inputs = new Set(
      Object.keys(PROFILE_INPUTS).filter((input) => !PROFILE_INPUTS[input]?.(file))
    )
    if (inputs.size === 0) return {}
    const report = (node: TSESTree.Node, input: string | null) => {
      if (input && inputs.has(input)) context.report({ node, message: profileInputMessage(input) })
    }
    return {
      Program(node) {
        if (!file.endsWith('.vue')) return
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        const read = new Set<string>()
        walkVueTemplateAst(template, (templateNode) => {
          for (const input of templateProfileInputs(templateNode, inputs)) read.add(input)
        })
        for (const input of read) report(node, input)
      },
      MemberExpression(node) {
        report(node, fixedKey(node.property, node.computed))
      },
      Property(node) {
        if (node.parent.type === 'ObjectPattern') report(node, fixedKey(node.key, node.computed))
      }
    }
  }
}

export {
  noEditorProfileInputs,
  noMixedCaseAcronymIdentifiers,
  noFlatKiwiModules,
  noConditionalObjectSpreads
}
