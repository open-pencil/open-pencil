import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export interface RunA11yScanOptions {
  include?: string[]
  exclude?: string[]
  disableRules?: string[]
}

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>
type AxeViolation = AxeResults['violations'][number]

function formatTarget(target: string | string[]) {
  return Array.isArray(target) ? target.join(' >> ') : target
}

function formatNodeTargets(node: AxeViolation['nodes'][number]) {
  return node.target.map((target) => formatTarget(target)).join(' | ')
}

function formatViolations(violations: AxeViolation[]) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${formatNodeTargets(node)}`)
        .join('\n')
      return [
        `${violation.impact ?? 'unknown'}: ${violation.id}`,
        `  ${violation.help}`,
        `  ${violation.helpUrl}`,
        nodes ? `  Nodes:\n${nodes}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

export async function runA11yScan(page: Page, options: RunA11yScanOptions = {}) {
  let builder = new AxeBuilder({ page })

  for (const selector of options.include ?? []) {
    builder = builder.include(selector)
  }

  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector)
  }

  if ((options.disableRules?.length ?? 0) > 0) {
    builder = builder.disableRules(options.disableRules ?? [])
  }

  return builder.analyze()
}

export function expectNoCriticalViolations(results: AxeResults) {
  const blockingViolations = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  )
  const warnOnlyViolations = results.violations.filter(
    (violation) => violation.impact === 'moderate' || violation.impact === 'minor'
  )

  if (warnOnlyViolations.length > 0) {
    console.warn(`[axe] moderate/minor violations\n${formatViolations(warnOnlyViolations)}`)
  }

  expect(
    blockingViolations,
    blockingViolations.length === 0
      ? undefined
      : `Expected no critical/serious axe violations.\n\n${formatViolations(blockingViolations)}`
  ).toHaveLength(0)
}
