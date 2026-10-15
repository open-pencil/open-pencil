import * as v from 'valibot'

export const DOCUMENT_HEAD_SCHEMA = 1
/** Retained-version chain carried by the head; bounds history growth per document. */
export const HEAD_HISTORY_LIMIT = 10

/**
 * The per-document commit point and the only mutable object of the versioned layout. Readers
 * resolve head, then manifest, then body, so the worst a reader sees is the previous committed
 * version. `history` is newest-first and doubles as the retention chain for garbage collection
 * and fork detection.
 */
export type DocumentHead = {
  schema: typeof DOCUMENT_HEAD_SCHEMA
  stateId: string
  history: string[]
}

const DocumentHeadJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    schema: v.literal(DOCUMENT_HEAD_SCHEMA),
    stateId: v.pipe(v.string(), v.nonEmpty()),
    history: v.fallback(v.array(v.unknown()), [])
  })
)

export function serializeDocumentHead(head: DocumentHead): string {
  return JSON.stringify(head)
}

/**
 * The next head keeps the previous commit's chain: writers read the current head and prepend,
 * so a lone writer never drops history. A head race can still lose entries; that is a fork,
 * detected by the listing, and the lost manifests become orphans for garbage collection.
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
  const parsed = v.safeParse(DocumentHeadJSON, new TextDecoder().decode(bytes))
  if (!parsed.success) return null
  return {
    schema: DOCUMENT_HEAD_SCHEMA,
    stateId: parsed.output.stateId,
    history: parsed.output.history
      .filter((entry): entry is string => typeof entry === 'string')
      .slice(0, HEAD_HISTORY_LIMIT)
  }
}
