import { normalizedFilename, staticPropertyName } from '#lint/support/context.ts'
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

/** The key a member expression reads when it is fixed (`a.key`, `a['key']`, ``a[`key`]``), not `a[key]`. */
function memberName(node: TSESTree.MemberExpression): string | null {
  const key = node.property
  if (!node.computed || key.type === 'Literal') return staticPropertyName(key)
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? null
  }
  return null
}

/** The fixed key a template member expression reads (`a.key`, `a['key']`), or null. */
function templateMemberKey(node: ExpressionAstNode): string | null {
  if (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') return null
  const key = node.property as ExpressionAstNode | undefined
  if (node.computed !== true && key?.type === 'Identifier') return key.name ?? null
  if (key?.type === 'StringLiteral' && typeof key.value === 'string') return key.value
  return null
}

/** Whether a Vue template expression reads `canvasView` from anything. */
function templateReadsCanvasView(expression: VueTemplateNode): boolean {
  if (expression.type !== VUE_SIMPLE_EXPRESSION_NODE || !expression.ast) return false
  let found = false
  walkExpressionAst(expression.ast as ExpressionAstNode, (node) => {
    if (templateMemberKey(node) === 'canvasView') found = true
  })
  return found
}

const CANVAS_VIEW_MESSAGE =
  "Read the canvas's behaviour from resolveEditorProfile instead of reading which view it shows."

/**
 * A canvas behaves by the profile its view resolves to, so code outside Core's editor views and
 * state reads the profile's values, never the view: checks of the view's id are how preview came to
 * branch at every place it behaves differently.
 */
const noCanvasViewChecks: RuleDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow reading the canvas view outside core editor views and state — read resolveEditorProfile instead'
    },
    schema: []
  },
  create(context) {
    const file = normalizedFilename(context)
    const checked = file.includes('/src/') || file.includes('/packages/docs/.vitepress/theme/')
    const owner =
      file.includes('/packages/core/src/editor/views/') ||
      file.includes('/packages/core/src/editor/state/')
    if (!checked || owner) return {}
    return {
      Program(node) {
        if (!file.endsWith('.vue')) return
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let reads = false
        walkVueTemplateAst(template, (templateNode) => {
          reads ||= templateReadsCanvasView(templateNode)
        })
        if (reads) context.report({ node, message: CANVAS_VIEW_MESSAGE })
      },
      MemberExpression(node) {
        if (memberName(node) === 'canvasView')
          context.report({ node, message: CANVAS_VIEW_MESSAGE })
      },
      Property(node) {
        if (node.parent.type !== 'ObjectPattern' || node.computed) return
        if (staticPropertyName(node.key) === 'canvasView') {
          context.report({ node, message: CANVAS_VIEW_MESSAGE })
        }
      }
    }
  }
}

export {
  noCanvasViewChecks,
  noMixedCaseAcronymIdentifiers,
  noFlatKiwiModules,
  noConditionalObjectSpreads
}
