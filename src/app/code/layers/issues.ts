import type { CodeSource } from '@/app/code/templates'
import { issueDetail, ruleTitle, type DesignCheckMessages } from '@/app/editor/design-check/format'
import type { DesignIssue } from '@/app/editor/design-check/issues'

/** A design issue on a layer, shown on the code that produces the layer. */
export interface LayerIssue {
  nodeId: string
  severity: 'error' | 'warning' | 'info'
  message: string
  /** Attribute names that carry the offending value, most specific first. */
  props: readonly string[]
}

const PADDING_PROPS: Record<string, readonly string[]> = {
  itemSpacing: ['gap'],
  paddingTop: ['pt', 'py', 'p'],
  paddingRight: ['pr', 'px', 'p'],
  paddingBottom: ['pb', 'py', 'p'],
  paddingLeft: ['pl', 'px', 'p']
}

function stringData(issue: DesignIssue, key: string): string | undefined {
  const value = issue.data?.[key]
  return typeof value === 'string' ? value : undefined
}

/** The Design JSX props the exporter writes for the value a rule reports. */
function designJSXProps(issue: DesignIssue): readonly string[] {
  switch (issue.ruleId) {
    case 'color-contrast':
      return ['color']
    case 'min-text-size':
      return ['size']
    case 'touch-target-size':
      return ['w', 'h']
    case 'consistent-radius':
      return ['rounded']
    case 'consistent-spacing':
      return PADDING_PROPS[stringData(issue, 'property') ?? ''] ?? []
    case 'no-hardcoded-colors':
      return stringData(issue, 'paint') === 'stroke' ? ['stroke'] : ['bg', 'color']
    case 'effect-style-required':
      return ['shadow', 'blur']
    default:
      return []
  }
}

/** Tailwind carries every visual value in `className`; names come from `data-name`. */
function tailwindProps(issue: DesignIssue): readonly string[] {
  return issue.ruleId === 'no-default-names' ? ['data-name'] : ['className']
}

/**
 * Errors and warnings as code issues, matching the canvas markers: suggestions stay in the
 * Check panel so the editor does not underline most of a generated document.
 */
export function codeLayerIssues(
  issues: readonly DesignIssue[],
  source: CodeSource,
  messages: DesignCheckMessages
): LayerIssue[] {
  if (source === 'html-css') return []
  return issues
    .filter((issue) => issue.severity !== 'info')
    .map((issue) => {
      const detail = issueDetail(issue, messages)
      const title = ruleTitle(issue.ruleId, messages)
      return {
        nodeId: issue.nodeId,
        severity: issue.severity,
        message: detail ? `${title} · ${detail}` : title,
        props: source === 'tailwind-jsx' ? tailwindProps(issue) : designJSXProps(issue)
      }
    })
}
