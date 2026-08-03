import { getLocalCanvasStore } from '@/app/storage/local-store'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'

/** Keep at most this much cached fig data on device (metas/thumbs are tiny and stay). */
export const FIG_CACHE_BUDGET_BYTES = 500 * 1024 * 1024

/**
 * Evict least-recently-opened fig blobs until the cache fits the budget.
 *
 * The safety rule is: **only evict a blob the remote provably has.** That means
 * the confirmed body identity equals the current one — not merely
 * `syncStatus === 'synced'`, which a metadata-only put can set without any body
 * ever reaching the remote. Getting this wrong deletes the user's only copy, so
 * the check is deliberately conservative: a row whose body identity is unknown
 * (a legacy row, or one never confirmed) is kept, at worst wasting cache space.
 *
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
    // Tombstoned bytes are awaiting a remote delete, not competing for the live
    // budget. Counting them let deleted documents permanently squeeze live ones.
    if (m.tombstoned) continue
    totalBytes += size
    if (m.syncStatus !== 'synced' || excludeIds.has(m.id)) continue
    // Never drop bytes the remote has not confirmed as exactly these bytes.
    if (!bodyIsConfirmed(m)) continue
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
  if (evicted > 0) console.warn(`[Storage] Evicted ${evicted} cached fig(s) to fit cache budget`)
  return evicted
}
