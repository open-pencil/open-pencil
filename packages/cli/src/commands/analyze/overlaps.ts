import { defineCommand } from 'citty'

import type { AnalyzeOverlapsResult } from '@open-pencil/core/rpc'
import {
  VALID_OVERLAP_CATEGORIES,
  VALID_OVERLAP_SCOPES,
  VALID_OVERLAP_SEVERITIES,
  parseOverlapCategories,
  parseOverlapScope,
  parseOverlapSeverity
} from '@open-pencil/core/tools'

import { bold, fail, fmtList, fmtSummary, kv } from '#cli/format'
import { loadRpcData } from '#cli/rpc-data'

function validateScope(scope: string): string | undefined {
  const normalized = scope.toLowerCase()
  return (VALID_OVERLAP_SCOPES as readonly string[]).includes(normalized)
    ? undefined
    : `Invalid scope "${scope}". Must be one of: ${[...VALID_OVERLAP_SCOPES].join(', ')}`
}

function validateSeverity(severity: string): string | undefined {
  const normalized = severity.toLowerCase()
  return (VALID_OVERLAP_SEVERITIES as readonly string[]).includes(normalized)
    ? undefined
    : `Invalid severity "${severity}". Must be one of: ${[...VALID_OVERLAP_SEVERITIES].join(', ')}`
}

function validateMinRatio(minRatio: number | undefined): string | undefined {
  if (minRatio === undefined) return undefined
  if (Number.isNaN(minRatio) || minRatio < 0 || minRatio > 1) {
    return '--min-ratio must be a number between 0.0 and 1.0'
  }
  return undefined
}

function validateLimit(limit: string): string | undefined {
  const value = Number(limit)
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return '--limit must be a positive integer'
  }
  return undefined
}

function validateMinArea(minArea: string): string | undefined {
  const value = Number(minArea)
  if (!Number.isFinite(value) || value < 0) {
    return '--min-area must be a non-negative number'
  }
  return undefined
}

function validateCategory(category: string): string | undefined {
  const values = category
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0)
  if (values.length === 0) return undefined
  const validCount = (parseOverlapCategories(category) ?? []).length
  if (validCount === 0) {
    return `Invalid categories: ${values.join(', ')}. Must be one or more of: ${[...VALID_OVERLAP_CATEGORIES].join(', ')}`
  }
  const invalid = values.filter((c) => !(VALID_OVERLAP_CATEGORIES as readonly string[]).includes(c))
  if (invalid.length > 0) {
    return `Invalid categor${invalid.length === 1 ? 'y' : 'ies'}: ${invalid.join(', ')}. Must be one or more of: ${[...VALID_OVERLAP_CATEGORIES].join(', ')}`
  }
  return undefined
}

function collectValidationError(args: {
  scope: string
  severity: string
  category?: string
  limit: string
  'min-area'?: string
  'min-ratio'?: string
}): string | undefined {
  return (
    validateScope(args.scope) ??
    validateSeverity(args.severity) ??
    validateLimit(args.limit) ??
    (args.category ? validateCategory(args.category) : undefined) ??
    (args['min-area'] !== undefined ? validateMinArea(args['min-area']) : undefined) ??
    validateMinRatio(args['min-ratio'] ? Number(args['min-ratio']) : undefined)
  )
}

function buildRpcArgs(args: {
  scope: string
  severity: string
  category?: string
  limit: string
  'min-area'?: string
  'min-ratio'?: string
  'include-hidden'?: boolean
  'include-locked'?: boolean
  'include-absolute'?: boolean
  page?: string
  'page-id'?: string
  type?: string
}): { rpcArgs: Record<string, unknown>; error?: string } {
  const error = collectValidationError(args)
  if (error) return { rpcArgs: {}, error }

  const minAreaRaw = args['min-area']
  const minArea = minAreaRaw ? Number(minAreaRaw) : undefined
  const minRatio = args['min-ratio'] ? Number(args['min-ratio']) : undefined

  const rpcArgs: Record<string, unknown> = {
    scope: parseOverlapScope(args.scope) ?? 'all',
    severity: parseOverlapSeverity(args.severity) ?? 'info',
    limit: Number(args.limit)
  }
  if (args.category) rpcArgs.category = args.category
  if (minArea !== undefined) rpcArgs.min_area = minArea
  if (minRatio !== undefined) rpcArgs.min_ratio = minRatio
  if (args['include-hidden']) rpcArgs.include_hidden = true
  if (args['include-locked']) rpcArgs.include_locked = true
  if (args['include-absolute']) rpcArgs.include_absolute = true
  if (args.page) rpcArgs.page = args.page
  if (args['page-id']) rpcArgs.page_id = args['page-id']
  if (args.type) rpcArgs.type = args.type

  return { rpcArgs }
}

export default defineCommand({
  meta: { description: 'Detect visual overlaps and layout overflows' },
  args: {
    file: {
      type: 'positional',
      description: '.fig file path (omit to connect to running app)',
      required: false
    },
    scope: {
      type: 'string',
      description:
        'Which pairs to inspect: all, same-parent, cross-parent, top-level, inside-parent',
      default: 'all'
    },
    category: {
      type: 'string',
      description: 'Comma-separated categories: sibling-overlap, parent-overflow, overlay'
    },
    severity: {
      type: 'string',
      description: 'Minimum severity to include: critical, major, minor, info',
      default: 'info'
    },
    'min-area': {
      type: 'string',
      description: 'Minimum overlap area in square pixels'
    },
    'min-ratio': {
      type: 'string',
      description: 'Minimum overlap ratio relative to the smaller node, 0.0–1.0'
    },
    'include-hidden': {
      type: 'boolean',
      description: 'Include hidden nodes in the analysis'
    },
    'include-locked': {
      type: 'boolean',
      description: 'Include locked nodes in the analysis'
    },
    'include-absolute': {
      type: 'boolean',
      description: 'Include absolutely-positioned nodes in the analysis'
    },
    page: {
      type: 'string',
      description: 'Limit analysis to nodes on the named page'
    },
    'page-id': {
      type: 'string',
      description: 'Limit analysis to nodes on the page with this stable ID'
    },
    'document-id': {
      type: 'string',
      description: 'Target OpenPencil document/tab ID when connected to the running app',
      required: false
    },
    type: {
      type: 'string',
      description: 'Comma-separated node types to analyze, e.g. FRAME,TEXT'
    },
    limit: {
      type: 'string',
      description: 'Maximum overlap findings to show',
      default: '100'
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const { rpcArgs, error } = buildRpcArgs(args)
    if (error) {
      console.error(fail(error))
      process.exit(1)
    }

    const data = await loadRpcData<AnalyzeOverlapsResult>(
      args.file,
      'analyze_overlaps',
      rpcArgs,
      args
    )

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    if (data.summary.overlapCount === 0) {
      console.log(kv('status', 'No overlaps found'))
      console.log(fmtSummary({ 'analyzed nodes': data.summary.analyzedNodes }))
      return
    }

    const showing = data.overlaps.length
    const total = data.summary.overlapCount
    const header =
      showing === total
        ? `  Overlaps — ${total} found`
        : `  Overlaps — ${total} found (${showing} shown)`

    console.log('')
    console.log(bold(header))
    console.log('')

    console.log(
      fmtList(
        data.overlaps.map((overlap) => ({
          header: `[${overlap.severity}] ${overlap.category}`,
          details: {
            message: overlap.message,
            area: `${overlap.area}px`,
            ratio: `${(overlap.ratio * 100).toFixed(1)}%`,
            a: `${overlap.nodeA.type} "${overlap.nodeA.name}" (${overlap.nodeA.id})`,
            b: `${overlap.nodeB.type} "${overlap.nodeB.name}" (${overlap.nodeB.id})`,
            suggestion: overlap.suggestion
          }
        }))
      )
    )

    console.log('')
    console.log(
      fmtSummary({
        'analyzed nodes': data.summary.analyzedNodes,
        'total nodes': data.summary.totalNodes
      })
    )
    console.log(
      kv(
        'by category',
        Object.entries(data.summary.byCategory)
          .filter(([, count]) => count > 0)
          .map(([k, count]) => `${k}: ${count}`)
          .join(', ') || 'none'
      )
    )
    console.log(
      kv(
        'by severity',
        Object.entries(data.summary.bySeverity)
          .filter(([, count]) => count > 0)
          .map(([k, count]) => `${k}: ${count}`)
          .join(', ') || 'none'
      )
    )
    console.log('')
  }
})
