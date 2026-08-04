export const DOCUMENT_HEAD_SCHEMA = 1
/** Retained-version chain carried by the head; bounds history growth per document. */
export const HEAD_HISTORY_LIMIT = 10

/**
 * The per-document commit point. The ONLY mutable object in the versioned
 * layout: readers resolve head → manifest → body, so the worst a reader sees
 * is the previous committed version. `history` is newest-first and doubles as
 * the retention chain for garbage collection and fork recovery.
 */
export type DocumentHead = {
  schema: typeof DOCUMENT_HEAD_SCHEMA
  stateId: string
  history: string[]
}

export function serializeDocumentHead(head: DocumentHead): string {
  return JSON.stringify(head)
}

/**
 * A next head that retains the previous commit's chain: writers read the
 * current head and prepend, so a lone writer never drops history. A head race
 * can still lose entries — that is a fork, detected elsewhere, and the lost
 * manifests become GC-eligible orphans after the safety window.
 */
export function nextDocumentHead(stateId: string, previous: DocumentHead | null): DocumentHead {
  return {
    schema: DOCUMENT_HEAD_SCHEMA,
    stateId,
    history: [stateId, ...(previous?.history ?? [])].slice(0, HEAD_HISTORY_LIMIT)
  }
}

export function parseDocumentHead(bytes: Uint8Array | null): DocumentHead | null {
  if (!bytes) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      schema?: unknown
      stateId?: unknown
      history?: unknown
    }
    if (parsed.schema !== DOCUMENT_HEAD_SCHEMA) return null
    if (typeof parsed.stateId !== 'string' || !parsed.stateId) return null
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter((entry): entry is string => typeof entry === 'string')
      : []
    return {
      schema: DOCUMENT_HEAD_SCHEMA,
      stateId: parsed.stateId,
      history: history.slice(0, HEAD_HISTORY_LIMIT)
    }
  } catch {
    return null
  }
}
