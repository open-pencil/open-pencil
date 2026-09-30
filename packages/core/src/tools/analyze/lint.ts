import * as v from 'valibot'

import type { FigmaAPI } from '#core/figma-api'
import {
  allRules,
  applyLintFixes,
  createLinter,
  graphFixTarget,
  presets,
  safeFixes,
  type LintFixRequest,
  type LintMessage,
  type LintResult
} from '#core/lint'
import { defineTool } from '#core/tools/schema'

import { analysisLimitInput } from './input'

const lintScopeInput = {
  ids: v.optional(
    v.pipe(
      v.array(v.string()),
      v.description('Layers to check, with their descendants (default: the current page)')
    )
  ),
  preset: v.optional(
    v.pipe(
      v.picklist(Object.keys(presets)),
      v.description(
        'Rule preset: recommended (default), strict, or accessibility (contrast, touch targets, text size)'
      )
    ),
    'recommended'
  ),
  rules: v.optional(
    v.pipe(
      v.array(v.picklist(Object.keys(allRules))),
      v.description('Check only these rules of the preset')
    )
  )
}

type LintScope = v.InferOutput<v.ObjectSchema<typeof lintScopeInput, undefined>>

function runLint(figma: FigmaAPI, scope: LintScope): LintResult {
  const roots = scope.ids?.length ? scope.ids : [figma.currentPage.id]
  return createLinter({ preset: scope.preset, rules: scope.rules }).lintGraph(figma.graph, roots)
}

function summarize(result: LintResult) {
  return { errors: result.errorCount, warnings: result.warningCount, info: result.infoCount }
}

function describeMessage(message: LintMessage) {
  return {
    rule: message.ruleId,
    severity: message.severity,
    message: message.message,
    node_id: message.nodeId,
    node_name: message.nodeName,
    path: message.nodePath.join(' / '),
    suggest: message.suggest,
    fix: message.fix,
    suggestions: message.suggestions
  }
}

export const lint = defineTool({
  name: 'lint',
  description:
    'Check the design for accessibility and consistency issues: low text contrast, small touch targets and text, ' +
    'off-scale spacing and radius, colors that match a variable but are not bound, and structure hygiene. ' +
    'Findings are sorted by severity. A `fix` is safe to apply with lint_fix; `suggestions` change values and need judgment.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({ ...lintScopeInput, limit: analysisLimitInput }),
  execute: (figma, args) => {
    const result = runLint(figma, args)
    const rank = { error: 0, warning: 1, info: 2 }
    const messages = result.messages.toSorted((a, b) => rank[a.severity] - rank[b.severity])
    return {
      ...summarize(result),
      fixable: safeFixes(result.messages).length,
      issues: messages.slice(0, args.limit).map(describeMessage),
      ...(messages.length > args.limit ? { truncated: messages.length - args.limit } : {})
    }
  }
})

export const lintFix = defineTool({
  name: 'lint_fix',
  description:
    'Apply lint fixes: bind colors to the variable they match and round geometry to whole pixels. ' +
    'With suggestions: true, also apply each finding’s first suggestion (snap radius and spacing to the scale, ' +
    'raise text to the minimum size). Returns what was applied and what remains.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    ...lintScopeInput,
    suggestions: v.optional(
      v.pipe(v.boolean(), v.description('Also apply the first suggestion of each finding')),
      false
    )
  }),
  execute: (figma, args) => {
    const requests: LintFixRequest[] = runLint(figma, args).messages.flatMap((message) => {
      const fix = message.fix ?? (args.suggestions ? message.suggestions?.[0] : undefined)
      return fix ? [{ nodeId: message.nodeId, fix }] : []
    })
    const applied = applyLintFixes(graphFixTarget(figma.graph), requests)
    return { applied, remaining: summarize(runLint(figma, args)) }
  }
})
