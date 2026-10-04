import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  allRules,
  applyLintFixes,
  createLinter,
  graphFixTarget,
  presets,
  safeFixes,
  type LintMessage
} from '@open-pencil/core/lint'

import { bold, dim, fail, fmtList, ok, printError } from '#cli/format'
import { loadDocument, populateWholeDocument } from '#cli/headless'

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
    fix: {
      type: 'boolean',
      default: false,
      description: 'Apply safe fixes (bind matching color variables, round to whole pixels)'
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Where --fix writes the fixed document (.fig)'
    },
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

    if (args.fix && !args.output) {
      printError('--fix needs --output: the fixed document is written as a new .fig file.')
      process.exit(1)
    }

    const graph = await loadDocument(args.file)
    // Lazily imported pages hold layers too; lint the whole document, not only what was read.
    populateWholeDocument(graph)
    const rules = args.rule ? (Array.isArray(args.rule) ? args.rule : [args.rule]) : undefined
    const linter = createLinter({ preset: args.preset, rules })
    let result = linter.lintGraph(graph)

    if (args.fix && args.output) {
      const applied = applyLintFixes(graphFixTarget(graph), safeFixes(result.messages))
      computeAllLayouts(graph)
      const output = resolve(args.output)
      const written = await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', graph)
      await writeFile(output, written.data as Uint8Array)
      if (!args.json) console.log(ok(`Applied ${applied} fixes → ${output}`))
      result = linter.lintGraph(graph)
    }

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
