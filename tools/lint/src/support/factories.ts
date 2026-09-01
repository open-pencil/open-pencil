import type { TSESTree } from '@typescript-eslint/utils'

import { importSource, normalizedFilename } from './context.ts'
import type { RuleDefinition, RuleListener } from './types.ts'

interface ProgramFilenameRuleOptions {
  description: string
  check(file: string): string | false
}

interface ImportSourceRuleOptions {
  description: string
  applies?: (file: string) => boolean
  includeExports?: boolean
  check(source: string, file: string): string | false
}

type ImportSourceNode =
  | TSESTree.ImportDeclaration
  | TSESTree.ExportAllDeclaration
  | TSESTree.ExportNamedDeclaration

export function createProgramFilenameRule({
  description,
  check
}: ProgramFilenameRuleOptions): RuleDefinition {
  return {
    meta: { type: 'suggestion', docs: { description }, schema: [] },
    create(context) {
      const message = check(normalizedFilename(context))
      if (!message) return {}
      return { Program: (node) => context.report({ node, message }) }
    }
  }
}

export function createImportSourceRule({
  description,
  applies = () => true,
  includeExports = false,
  check
}: ImportSourceRuleOptions): RuleDefinition {
  return {
    meta: { type: 'problem', docs: { description }, schema: [] },
    create(context) {
      const file = normalizedFilename(context)
      if (!applies(file)) return {}
      const inspect = (node: ImportSourceNode) => {
        const source = importSource(node)
        if (!source) return
        const message = check(source, file)
        if (message) context.report({ node, message })
      }
      const visitors: RuleListener = { ImportDeclaration: inspect }
      if (includeExports) {
        visitors.ExportNamedDeclaration = inspect
        visitors.ExportAllDeclaration = inspect
      }
      return visitors
    }
  }
}
