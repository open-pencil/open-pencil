import { ByteBuffer } from '../schema-runtime/bb'
import type { Definition, Field, Schema } from '../schema-runtime/schema'

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

type DefinitionMap = Map<string, Definition>
interface ScanContext {
  definitions: DefinitionMap
  fields: Map<string, Map<number, Field>>
}

function fieldMap(definition: Definition): Map<number, Field> {
  return new Map(definition.fields.map((field) => [field.value, field]))
}

function cachedFieldMap(context: ScanContext, definition: Definition): Map<number, Field> {
  let fields = context.fields.get(definition.name)
  if (!fields) {
    fields = fieldMap(definition)
    context.fields.set(definition.name, fields)
  }
  return fields
}

function skipSingleValue(bb: ByteBuffer, field: Field, context: ScanContext): void {
  switch (field.type) {
    case 'bool':
    case 'byte':
      bb.readByte()
      return
    case 'int':
      bb.readVarInt()
      return
    case 'uint':
      bb.readVarUint()
      return
    case 'float':
      bb.readVarFloat()
      return
    case 'string':
      bb.skipString()
      return
    case 'int64':
      bb.readVarInt64()
      return
    case 'uint64':
      bb.readVarUint64()
      return
  }

  const definition = field.type ? context.definitions.get(field.type) : undefined
  if (!definition) throw new Error(`Invalid Kiwi field type: ${String(field.type)}`)
  if (definition.kind === 'ENUM') {
    bb.readVarUint()
    return
  }
  skipDefinition(bb, definition, context)
}

function skipFieldValue(bb: ByteBuffer, field: Field, context: ScanContext): void {
  if (!field.isArray) {
    skipSingleValue(bb, field, context)
    return
  }
  if (field.type === 'byte') {
    bb.skipByteArray()
    return
  }
  let length = bb.readVarUint()
  while (length-- > 0) skipSingleValue(bb, field, context)
}

function skipDefinition(bb: ByteBuffer, definition: Definition, context: ScanContext): void {
  if (definition.kind === 'STRUCT') {
    for (const field of definition.fields) skipFieldValue(bb, field, context)
    return
  }

  const fields = cachedFieldMap(context, definition)
  for (;;) {
    const fieldId = bb.readVarUint()
    if (fieldId === 0) return
    const field = fields.get(fieldId)
    if (!field) throw new Error(`Invalid field ${fieldId} in Kiwi ${definition.name}`)
    skipFieldValue(bb, field, context)
  }
}

function enumName(bb: ByteBuffer, field: Field, context: ScanContext): string | null {
  const value = bb.readVarUint()
  const definition = field.type ? context.definitions.get(field.type) : undefined
  return definition?.kind === 'ENUM'
    ? (definition.fields.find((candidate) => candidate.value === value)?.name ?? null)
    : null
}

function scanNodeChange(
  bb: ByteBuffer,
  definition: Definition,
  context: ScanContext
): PageCandidate | null {
  const fields = cachedFieldMap(context, definition)
  let sourceSessionId: number | null = null
  let sourceLocalId: number | null = null
  let parentSessionId: number | null = null
  let parentLocalId: number | null = null
  let positionOffset: number | null = null
  let phase: string | null = null
  let type: string | null = null
  let name: string | null = null
  let internalOnly = false

  for (;;) {
    const fieldId = bb.readVarUint()
    if (fieldId === 0) break
    const field = fields.get(fieldId)
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
        phase = enumName(bb, field, context)
        break
      case 'type':
        type = enumName(bb, field, context)
        break
      case 'name':
        if (type === 'DOCUMENT' || type === 'CANVAS') name = bb.readString()
        else bb.skipString()
        break
      case 'internalOnly':
        internalOnly = !!bb.readByte()
        break
      default:
        skipFieldValue(bb, field, context)
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
 * Scans decoded Kiwi bytes without materializing NodeChange objects. Kiwi messages are not
 * length-prefixed, so every value is visited, but only document/page fields are allocated.
 */
export function extractFigPageManifest(schema: Schema, data: Uint8Array): FigPageManifestEntry[] {
  const definitions: DefinitionMap = new Map(
    schema.definitions.map((definition) => [definition.name, definition])
  )
  const context: ScanContext = { definitions, fields: new Map() }
  const message = definitions.get('Message')
  const nodeChange = definitions.get('NodeChange')
  if (message?.kind !== 'MESSAGE' || nodeChange?.kind !== 'MESSAGE') {
    return []
  }

  const bb = new ByteBuffer(data)
  const messageFields = cachedFieldMap(context, message)
  const candidates: PageCandidate[] = []
  for (;;) {
    const fieldId = bb.readVarUint()
    if (fieldId === 0) break
    const field = messageFields.get(fieldId)
    if (!field) throw new Error(`Invalid field ${fieldId} in Kiwi Message`)
    if (field.name !== 'nodeChanges' || !field.isArray) {
      skipFieldValue(bb, field, context)
      continue
    }

    let length = bb.readVarUint()
    while (length-- > 0) {
      const candidate = scanNodeChange(bb, nodeChange, context)
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
