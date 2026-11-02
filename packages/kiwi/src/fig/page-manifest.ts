import { ByteBuffer } from '../schema-runtime/bb'
import type { CompiledDefinition, CompiledSchema } from '../schema-runtime/interpreter'

export interface FigPageManifestEntry {
  sourceId: string
  name: string
  position: string | null
  internalOnly: boolean
}

interface PageCandidate extends FigPageManifestEntry {
  parentId: string | null
  phase: string | null
  type: string | null
}

function enumName(bb: ByteBuffer, definition: CompiledDefinition | null): string | null {
  const value = bb.readVarUint()
  return definition?.kind === 'ENUM' ? (definition.names[value] ?? null) : null
}

function scanNodeChange(
  bb: ByteBuffer,
  schema: CompiledSchema,
  nodeChange: CompiledDefinition
): PageCandidate | null {
  let sourceSessionId: number | null = null
  let sourceLocalId: number | null = null
  let parentSessionId: number | null = null
  let parentLocalId: number | null = null
  let positionOffset: number | null = null
  let phase: string | null = null
  let type: string | null = null
  let name: string | null = null
  let internalOnly = false

  for (let fieldId = bb.readVarUint(); fieldId !== 0; fieldId = bb.readVarUint()) {
    const field = nodeChange.byId[fieldId]
    if (!field) throw new Error(`Invalid field ${fieldId} in Kiwi NodeChange`)
    switch (field.name) {
      case 'guid':
        sourceSessionId = bb.readVarUint()
        sourceLocalId = bb.readVarUint()
        break
      case 'parentIndex':
        parentSessionId = bb.readVarUint()
        parentLocalId = bb.readVarUint()
        positionOffset = bb.offset
        bb.skipString()
        break
      case 'phase':
        phase = enumName(bb, field.definition)
        break
      case 'type':
        type = enumName(bb, field.definition)
        break
      case 'name':
        if (type === 'DOCUMENT' || type === 'CANVAS') name = bb.readString()
        else bb.skipString()
        break
      case 'internalOnly':
        internalOnly = !!bb.readByte()
        break
      default:
        schema.skip(field, bb)
    }
  }

  if (
    (type !== 'DOCUMENT' && type !== 'CANVAS') ||
    sourceSessionId === null ||
    sourceLocalId === null
  ) {
    return null
  }
  let position: string | null = null
  if (positionOffset !== null) {
    const endOffset = bb.offset
    bb.offset = positionOffset
    position = bb.readString()
    bb.offset = endOffset
  }
  const parentId =
    parentSessionId === null || parentLocalId === null
      ? null
      : `${parentSessionId}:${parentLocalId}`
  return {
    sourceId: `${sourceSessionId}:${sourceLocalId}`,
    parentId,
    position,
    phase,
    type,
    name: name ?? 'Page',
    internalOnly
  }
}

/**
 * Scans encoded Kiwi bytes without materializing NodeChange objects. Kiwi messages are not
 * length-prefixed, so every value is visited, but only document/page fields are allocated.
 */
export function extractFigPageManifest(
  schema: CompiledSchema,
  data: Uint8Array
): FigPageManifestEntry[] {
  const message = schema.definition('Message')
  const nodeChange = schema.definition('NodeChange')
  if (message.kind !== 'MESSAGE' || nodeChange.kind !== 'MESSAGE') return []

  const bb = new ByteBuffer(data)
  const candidates: PageCandidate[] = []
  for (let fieldId = bb.readVarUint(); fieldId !== 0; fieldId = bb.readVarUint()) {
    const field = message.byId[fieldId]
    if (!field) throw new Error(`Invalid field ${fieldId} in Kiwi Message`)
    if (field.name !== 'nodeChanges' || !field.isArray) {
      schema.skip(field, bb)
      continue
    }
    for (let length = bb.readVarUint(); length > 0; length--) {
      const candidate = scanNodeChange(bb, schema, nodeChange)
      if (candidate) candidates.push(candidate)
    }
    break
  }

  const documentId = candidates.find(
    (candidate) => candidate.type === 'DOCUMENT' && candidate.phase !== 'REMOVED'
  )?.sourceId
  return candidates
    .filter(
      (candidate) =>
        candidate.type === 'CANVAS' &&
        candidate.phase !== 'REMOVED' &&
        (!documentId || candidate.parentId === documentId)
    )
    .sort((a, b) => {
      const aPosition = a.position ?? ''
      const bPosition = b.position ?? ''
      if (aPosition < bPosition) return -1
      if (aPosition > bPosition) return 1
      return 0
    })
    .map(({ sourceId, name, position, internalOnly }) => ({
      sourceId,
      name,
      position,
      internalOnly
    }))
}
