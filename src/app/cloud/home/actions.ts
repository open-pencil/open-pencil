import { getActiveCloudAdapter } from '@/app/cloud/active'
import { createCanvasId } from '@/app/cloud/id'
import { getLocalCanvasStore } from '@/app/cloud/local-store'
import {
  enqueueDeleteCanvas,
  enqueuePutCanvas,
  enqueuePutThumb,
  kickSyncEngine
} from '@/app/cloud/sync'
import type { CloudStorageAdapter } from '@/app/cloud/types'
import { nextUniqueCloudName } from '@/app/cloud/unique-name'
import { downloadBlob } from '@/app/document/io/browser'

function requireAdapter(): CloudStorageAdapter {
  const adapter = getActiveCloudAdapter()
  if (!adapter) throw new Error('Cloud storage is not configured')
  return adapter
}

/** Local fig bytes when cached, otherwise fetch from the cloud. */
async function readFigOrFetch(id: string): Promise<Uint8Array> {
  const local = getLocalCanvasStore()
  const meta = await local.getMeta(id)
  let fig = meta?.hasFig ? await local.readFig(id) : null
  if (!fig || fig.byteLength === 0) fig = await requireAdapter().getCanvas(id)
  return fig
}

export async function renameCloudCanvas(id: string, name: string): Promise<void> {
  const adapter = requireAdapter()
  const trimmed = name.trim() || 'Untitled'
  const fig = await readFigOrFetch(id)
  const meta = await getLocalCanvasStore().writeCanvas({
    id,
    providerId: adapter.id,
    name: trimmed,
    figBytes: fig,
    syncStatus: 'pending'
  })
  await enqueuePutCanvas(id, meta.revision)
  void kickSyncEngine()
}

export async function duplicateCloudCanvas(id: string): Promise<void> {
  const adapter = requireAdapter()
  const local = getLocalCanvasStore()
  const source = await local.getMeta(id)
  const fig = await readFigOrFetch(id)
  const thumb = await local.readThumb(id)

  const newId = createCanvasId()
  const taken = (await local.listMetas(false)).map((m) => m.name)
  const name = nextUniqueCloudName(source?.name ?? 'Untitled', taken)
  const meta = await local.writeCanvas({
    id: newId,
    providerId: adapter.id,
    name,
    figBytes: fig,
    thumbBytes: thumb,
    syncStatus: 'pending'
  })
  await enqueuePutCanvas(newId, meta.revision)
  if (thumb) await enqueuePutThumb(newId, meta.revision)
  void kickSyncEngine()
}

export async function downloadCloudCanvas(id: string, name: string): Promise<void> {
  const fig = await readFigOrFetch(id)
  downloadBlob(new Uint8Array(fig), `${name || 'Untitled'}.fig`, 'application/octet-stream')
}

export async function deleteCloudCanvas(id: string): Promise<void> {
  requireAdapter()
  await getLocalCanvasStore().tombstone(id)
  await enqueueDeleteCanvas(id)
  void kickSyncEngine()
}
