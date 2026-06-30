import type { OverlapCategory, OverlapScope, OverlapSeverity } from './index'

export const VALID_OVERLAP_SCOPES: readonly OverlapScope[] = [
  'all',
  'same-parent',
  'cross-parent',
  'top-level',
  'inside-parent'
]

export const VALID_OVERLAP_CATEGORIES: readonly OverlapCategory[] = [
  'sibling-overlap',
  'parent-overflow',
  'overlay'
]

export const VALID_OVERLAP_SEVERITIES: readonly OverlapSeverity[] = [
  'critical',
  'major',
  'minor',
  'info'
]

export function parseOverlapScope(raw: string | undefined): OverlapScope | undefined {
  if (!raw) return undefined
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return undefined
  return VALID_OVERLAP_SCOPES.find((scope) => scope === normalized)
}

export function parseOverlapCategories(raw: string | undefined): OverlapCategory[] | undefined {
  if (!raw) return undefined
  const values = raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0)
  if (values.length === 0) return undefined
  const categories = values.filter((v): v is OverlapCategory =>
    VALID_OVERLAP_CATEGORIES.includes(v as OverlapCategory)
  )
  return categories.length > 0 ? categories : undefined
}

export function parseOverlapSeverity(raw: string | undefined): OverlapSeverity | undefined {
  if (!raw) return undefined
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return undefined
  return VALID_OVERLAP_SEVERITIES.find((severity) => severity === normalized)
}
