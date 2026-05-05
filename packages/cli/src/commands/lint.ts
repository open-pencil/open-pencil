import { defineCommand } from 'citty'

import { allRules, createLinter, presets, type LintMessage } from '@open-pencil/core/lint'

import { bold, dim, fail, fmtList, ok } from '#cli/format'
import { loadDocument } from '#cli/headless'

function formatSeverity(severity: LintMessage['severity']) {
  if (severity === 'error') return fail('error')
  if (severity === 'warning') return fail('warn')
  return ok('info')
}

function formatMessage(message: LintMessage) {
  return {
    header: `${formatSeverity(message.severity)} ${bold(message.ruleId)} ${dim(message.nodePath.join(' / '))}`,
    details: {
      message: message.message,
      node: `${message.nodeName} (${message.nodeId})`,
      suggest: message.suggest
    }
  }
}

export default defineCommand({
  meta: {
    name: 'lint',
    description: 'Lint design documents for consistency, structure, and accessibility issues'
  },
  args: {
    file: {
      type: 'positional',
      required: true,
      description: 'Design document to lint (.fig, .pen)'
    },
    preset: {
      type: 'string',
      default: 'recommended',
      description: 'Preset: recommended, strict, accessibility'
    },
    rule: { type: 'string', description: 'Run specific rule(s) only (repeatable)' },
    json: { type: 'boolean', default: false, description: 'Output as JSON' },
    'list-rules': { type: 'boolean', default: false, description: 'List rules and exit' }
  },
  async run({ args }) {
    if (args['list-rules']) {
      console.log('')
      console.log(bold('Available rules'))
      console.log('')
      console.log(
        fmtList(
          Object.entries(allRules).map(([id, rule]) => ({
            header: bold(id),
            details: { category: rule.meta.category, description: rule.meta.description }
          }))
        )
      )
      console.log('')
      console.log(bold(`Presets: ${Object.keys(presets).join(', ')}`))
      console.log('')
      return
    }

    const graph = await loadDocument(args.file)
    const rules = args.rule ? (Array.isArray(args.rule) ? args.rule : [args.rule]) : undefined
    const result = createLinter({ preset: args.preset, rules }).lintGraph(graph)

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else if (result.messages.length === 0) {
      console.log(ok('No lint issues found.'))
    } else {
      console.log('')
      console.log(
        bold(
          `Lint issues: ${result.errorCount} errors, ${result.warningCount} warnings, ${result.infoCount} info`
        )
      )
      console.log('')
      console.log(fmtList(result.messages.map(formatMessage)))
      console.log('')
    }

    if (result.errorCount > 0) process.exit(1)
  }
})
