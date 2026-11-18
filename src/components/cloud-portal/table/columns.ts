import type { PortalColumnRole } from '@/app/cloud-portal/list'
import type { TableColumnMeta } from '@/components/ui/table/columns'
import { PORTAL_COLUMN_HIDING, PORTAL_COLUMN_WIDTHS } from '@/theme/cloud-portal/columns'

// Every role has a width and a place in the hiding order.
const WIDTHS: Record<PortalColumnRole, string> = PORTAL_COLUMN_WIDTHS
const HIDING: Record<PortalColumnRole, string> = PORTAL_COLUMN_HIDING

const isRole = (value: unknown): value is PortalColumnRole =>
  typeof value === 'string' && value in WIDTHS

/** A console column's classes, from the role its `meta` (`PortalColumnMeta`) gives it. */
export function portalColumnMeta(meta: unknown): TableColumnMeta {
  if (typeof meta !== 'object' || meta === null || !('role' in meta) || !isRole(meta.role)) {
    return {}
  }
  const always = 'always' in meta && meta.always === true
  const width = WIDTHS[meta.role]
  return {
    class: always ? width : `${HIDING[meta.role]} ${width}`.trim(),
    actions: meta.role === 'actions'
  }
}
