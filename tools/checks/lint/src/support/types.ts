import type { Rule as OxlintRule } from '@oxlint/plugins'
import type { TSESLint, TSESTree } from '@typescript-eslint/utils'

/** The `SourceCode` members rules actually call, so tests can provide a small double. */
export type RuleSourceCode = Pick<
  TSESLint.SourceCode,
  'getAllComments' | 'getScope' | 'getText' | 'text'
>

export interface RuleContext {
  filename?: string
  physicalFilename?: string
  options: readonly unknown[]
  sourceCode: RuleSourceCode
  getFilename?: () => string
  report(descriptor: { node: TSESTree.Node | TSESTree.Comment; message: string }): void
}

export type RuleListener = TSESLint.RuleListener

/** Rules are either the repo's own definition shape or an oxlint `defineRule()` result. */
export type PluginRule = RuleDefinition | OxlintRule

export interface RuleDefinition {
  meta: {
    docs: { description: string }
    schema?: readonly unknown[]
    type?: 'problem' | 'suggestion' | 'layout'
    [key: string]: unknown
  }
  create(context: RuleContext): RuleListener
}
