import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

const ACRONYMS =
  /(?:Acp|Ai|Api|Cli|Cors|Css|Html|Ime|Json|Jsx|Mcp|Pdf|Png|Rgb|Rpc|Rtl|Svg|Ui|Url|Uri|Xml)/g

type AcronymOptions = {
  /** Packages whose exported names keep their own casing where they are imported. */
  ignoredImports?: string[]
  /** Upstream names used without importing them by name, such as members and callbacks. */
  ignoredIdentifiers?: string[]
}

function isObjectKey(node: ESTree.Node): boolean {
  const { parent } = node
  return (
    (parent?.type === 'Property' || parent?.type === 'TSPropertySignature') &&
    parent.key === node &&
    !parent.computed &&
    (parent.type !== 'Property' || parent.value !== node)
  )
}

function isExternalMember(node: ESTree.Node): boolean {
  const { parent } = node
  return (
    parent?.type === 'MemberExpression' &&
    parent.property === node &&
    !parent.computed &&
    parent.object.type !== 'ThisExpression'
  )
}

/** Names another package chose: imported by name from an ignored package, or under any default or namespace import. */
function isUpstreamImport(node: ESTree.Node, ignoredImports: ReadonlySet<string>): boolean {
  const { parent } = node
  if (parent?.type === 'ImportSpecifier' && parent.imported === node) {
    const declaration = parent.parent
    return declaration.type !== 'ImportDeclaration' || ignoredImports.has(declaration.source.value)
  }
  return parent?.type === 'ImportDefaultSpecifier' || parent?.type === 'ImportNamespaceSpecifier'
}

const noMixedCaseAcronymIdentifiers = defineRule({
  meta: {
    docs: {
      description: 'Require canonical uppercase casing for acronyms in first-party identifiers'
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignoredImports: { type: 'array', items: { type: 'string' } },
          ignoredIdentifiers: { type: 'array', items: { type: 'string' } }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options: AcronymOptions = (context.options[0] as AcronymOptions | undefined) ?? {}
    const ignoredImports = new Set(options.ignoredImports)
    const ignoredIdentifiers = new Set(options.ignoredIdentifiers)

    return {
      Identifier(node) {
        if (ignoredIdentifiers.has(node.name)) return
        const mixedCase = [...node.name.matchAll(ACRONYMS)].some((match) => {
          const end = match.index + match[0].length
          return end === node.name.length || /[A-Z0-9_$]/.test(node.name[end] ?? '')
        })
        if (!mixedCase) return
        if (isObjectKey(node) || isExternalMember(node) || isUpstreamImport(node, ignoredImports)) {
          return
        }
        context.report({
          node,
          message: `Use canonical uppercase acronym casing in "${node.name}".`
        })
      }
    }
  }
})

export { noMixedCaseAcronymIdentifiers }
