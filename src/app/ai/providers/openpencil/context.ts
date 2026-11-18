import type { ServiceCatalog } from '@open-pencil/cloud/contract'

import { cloudAIClient, cloudAIIdentity } from '@/app/cloud/integration'

/** How long a workspace's catalog answers context lookups before it is asked for again. */
const CATALOG_TTL_MS = 10 * 60 * 1000

const catalogs = new Map<string, { at: number; catalog: Promise<ServiceCatalog | null> }>()

function workspaceCatalog(workspaceId: string): Promise<ServiceCatalog | null> {
  const key = `${cloudAIIdentity.value}\n${workspaceId}`
  const cached = catalogs.get(key)
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.catalog
  const client = cloudAIClient(workspaceId)
  const entry: { at: number; catalog: Promise<ServiceCatalog | null> } = {
    at: Date.now(),
    catalog: Promise.resolve(null)
  }
  entry.catalog = client
    ? client.catalog().catch(() => {
        // A failed read is asked for again next time rather than kept, unless a newer read
        // already took its place.
        if (catalogs.get(key) === entry) catalogs.delete(key)
        return null
      })
    : Promise.resolve(null)
  catalogs.set(key, entry)
  return entry.catalog
}

/**
 * The context window of a model on Cloud's AI service, from the catalog of the workspace that
 * pays, so the chat compacts a Cloud conversation before it outgrows the model.
 */
export async function cloudContextWindow(
  workspaceId: string,
  modelID: string
): Promise<number | undefined> {
  const catalog = await workspaceCatalog(workspaceId)
  return catalog?.models.find((model) => model.id === modelID)?.contextTokens
}
