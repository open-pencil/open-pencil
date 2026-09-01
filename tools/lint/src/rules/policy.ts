import type { TSESTree } from '@typescript-eslint/utils'

import { createProgramFilenameRule } from '../support/factories.ts'
import type { RuleDefinition } from '../support/types.ts'

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
    const file = context.physicalFilename ?? context.filename ?? ''
    if (file.includes('/tools/lint/')) return {}
    const canonicalAcronym =
      /(?:Acp|Ai|Api|Cli|Cors|Css|Html|Ime|Json|Jsx|Mcp|Pdf|Png|Rgb|Rpc|Rtl|Svg|Ui|Url|Uri|Xml)/g
    const ignoredImports = new Set([
      '@agentclientprotocol/sdk',
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

export { noMixedCaseAcronymIdentifiers, noFlatKiwiModules, noConditionalObjectSpreads }
