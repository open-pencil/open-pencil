import type { DocumentSourceIdentity } from '@/app/document/io/types'
import type { EditorStore } from '@/app/editor/session'
import { fileIdentitiesMatch, hasFileIdentity } from '@/app/tabs/open/identity'

type PendingOpen = {
  completion: Promise<undefined>
  identity: DocumentSourceIdentity
  store: EditorStore
}

export function createFileOpenCoordinator() {
  const pending: PendingOpen[] = []
  let decisionTail = Promise.resolve()

  async function decide<T>(operation: () => Promise<T>): Promise<T> {
    const previous = decisionTail
    let release: () => void = () => undefined
    decisionTail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  async function findPending(identity: DocumentSourceIdentity): Promise<PendingOpen | null> {
    if (!hasFileIdentity(identity)) return null
    for (const candidate of pending) {
      if (await fileIdentitiesMatch(candidate.identity, identity)) return candidate
    }
    return null
  }

  function add(entry: PendingOpen) {
    pending.push(entry)
  }

  function remove(entry: PendingOpen) {
    const index = pending.indexOf(entry)
    if (index !== -1) pending.splice(index, 1)
  }

  return { add, decide, findPending, remove }
}
