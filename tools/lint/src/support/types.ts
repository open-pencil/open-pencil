import type { TSESLint, TSESTree } from '@typescript-eslint/utils'

export interface RuleContext {
  filename?: string
  physicalFilename?: string
  options: readonly unknown[]
  sourceCode: TSESLint.SourceCode
  getFilename?: () => string
  report(descriptor: { node: TSESTree.Node | TSESTree.Comment; message: string }): void
}

export type RuleListener = TSESLint.RuleListener

export interface RuleDefinition {
  meta: {
    docs: { description: string }
    schema?: readonly unknown[]
    type?: 'problem' | 'suggestion' | 'layout'
    [key: string]: unknown
  }
  create(context: RuleContext): RuleListener
}
