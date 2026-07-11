import type { LocalCanvasMeta } from '@/app/cloud/local-store'
import type { CloudCanvas } from '@/app/cloud/types'

/** Patch home-tile rows from fresh local metas (keeps blob thumbnail URLs). */
export function applyLocalMetaToCanvases(
  list: CloudCanvas[],
  metas: LocalCanvasMeta[]
): CloudCanvas[] {
  const byId = new Map(metas.map((m) => [m.id, m]))
  let changed = false
  const next = list.map((canvas) => {
    const meta = byId.get(canvas.id)
    if (!meta) return canvas
    if (
      meta.syncStatus === canvas.syncStatus &&
      meta.name === canvas.name &&
      meta.updatedAt === canvas.updatedAt
    ) {
      return canvas
    }
    changed = true
    return {
      ...canvas,
      name: meta.name,
      updatedAt: meta.updatedAt,
      syncStatus: meta.syncStatus
    }
  })
  return changed ? next : list
}
