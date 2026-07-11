import type { LocalCanvasMeta } from '@/app/cloud/local-store'
import type { CloudCanvas } from '@/app/cloud/types'

/** Patch home-tile rows from fresh local metas (keeps blob thumbnail URLs). */
export function applyLocalMetaToCanvases(
  list: CloudCanvas[],
  metas: LocalCanvasMeta[]
): CloudCanvas[] {
  const byId = new Map(metas.map((m) => [m.id, m]))
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
    return {
      ...canvas,
      name: meta.name,
      updatedAt: meta.updatedAt,
      syncStatus: meta.syncStatus
    }
  })
  // keep the original array identity when nothing changed (control-flow
  // analysis can't see closure mutations, so no flag variable here)
  return next.some((canvas, i) => canvas !== list[i]) ? next : list
}
