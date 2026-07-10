import { getLocalCanvasStore } from '@/app/cloud/local-store'

/** Keep at most this much cached fig data on device (metas/thumbs are tiny and stay). */
export const FIG_CACHE_BUDGET_BYTES = 500 * 1024 * 1024

/**
 * Evict least-recently-opened fig blobs until the cache fits the budget.
 * Only fully synced, non-tombstoned, not-currently-open canvases qualify —
 * evicting never loses data, it just forces a re-download on next open.
 * Returns the number of evicted figs.
 */
export async function evictLocalFigCache(
  excludeIds: ReadonlySet<string> = new Set(),
  budgetBytes = FIG_CACHE_BUDGET_BYTES
): Promise<number> {
  const local = getLocalCanvasStore()
  const metas = await local.listMetas(true)

  let totalBytes = 0
  const candidates: { id: string; size: number; lastUsed: string }[] = []
  for (const m of metas) {
    if (!m.hasFig) continue
    let size = m.figSize
    if (size == null) {
      // Legacy row from before size tracking — measure once and persist
      const fig = await local.readFig(m.id)
      size = fig?.byteLength ?? 0
      await local.updateMeta(m.id, { figSize: size })
    }
    totalBytes += size
    if (m.tombstoned || m.syncStatus !== 'synced' || excludeIds.has(m.id)) continue
    candidates.push({
      id: m.id,
      size,
      lastUsed: m.lastOpenedAt ?? m.lastSyncedAt ?? m.updatedAt
    })
  }

  if (totalBytes <= budgetBytes) return 0

  candidates.sort((a, b) => a.lastUsed.localeCompare(b.lastUsed))
  let evicted = 0
  for (const candidate of candidates) {
    if (totalBytes <= budgetBytes) break
    await local.clearFig(candidate.id)
    totalBytes -= candidate.size
    evicted += 1
  }
  if (evicted > 0) console.warn(`[Cloud] Evicted ${evicted} cached fig(s) to fit cache budget`)
  return evicted
}
