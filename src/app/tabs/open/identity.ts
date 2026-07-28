import type { DocumentSourceIdentity } from '@/app/document/io/types'

type IdentitySource = {
  getSourceIdentity: () => DocumentSourceIdentity
}

type IdentifiedTab = {
  store: IdentitySource
}

export function hasFileIdentity(identity: DocumentSourceIdentity): boolean {
  return !!(identity.handle || identity.path)
}

async function handlesMatch(
  first: FileSystemFileHandle | null,
  second: FileSystemFileHandle | null
): Promise<boolean> {
  if (!first || !second) return false
  if (first === second) return true
  try {
    return await first.isSameEntry(second)
  } catch {
    return false
  }
}

export async function fileIdentitiesMatch(
  first: DocumentSourceIdentity,
  second: DocumentSourceIdentity
): Promise<boolean> {
  if (first.path && second.path && first.path === second.path) return true
  return handlesMatch(first.handle, second.handle)
}

export async function findTabByFileIdentity<T extends IdentifiedTab>(
  tabs: readonly T[],
  identity: DocumentSourceIdentity
): Promise<T | null> {
  if (!hasFileIdentity(identity)) return null
  for (const tab of tabs) {
    const storedIdentity = tab.store.getSourceIdentity()
    if (
      (await fileIdentitiesMatch(storedIdentity, identity)) &&
      tab.store.getSourceIdentity() === storedIdentity
    ) {
      return tab
    }
  }
  return null
}
