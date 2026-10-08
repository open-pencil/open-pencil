import type { ByteBuffer } from './bb'
import type { Definition, Field, Schema } from './schema'
import { error, quote } from './util'

/**
 * Moves a buffer past encoded values without building them, so a reader can find where each
 * value lies in a large message and copy the bytes of the ones it does not change.
 */
export interface SchemaSkipper {
  definition(name: string): Definition
  /** A definition's fields by their IDs, built once per definition. */
  fieldsById(name: string): ReadonlyMap<number, Field>
  /** Past one value of a field, its array included. */
  skipField(field: Field, bb: ByteBuffer): void
  /** Past one value of a type: a native type, an enum, a struct or a message. */
  skipValue(type: string, bb: ByteBuffer): void
}

export function createSchemaSkipper(schema: Schema): SchemaSkipper {
  const definitions = new Map(schema.definitions.map((definition) => [definition.name, definition]))
  const fieldsById = new Map<string, Map<number, Field>>()
  const definition = (name: string): Definition => {
    const found = definitions.get(name)
    if (!found) error('Invalid type ' + quote(name), 0, 0)
    return found
  }
  const messageFields = (found: Definition): Map<number, Field> => {
    let fields = fieldsById.get(found.name)
    if (!fields) {
      fields = new Map(found.fields.map((field) => [field.value, field]))
      fieldsById.set(found.name, fields)
    }
    return fields
  }

  const skipValue = (type: string, bb: ByteBuffer): void => {
    switch (type) {
      case 'bool':
      case 'byte':
        bb.readByte()
        return
      case 'int':
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
      case 'uint64':
        bb.readVarUint64()
        return
    }
    const found = definition(type)
    if (found.kind === 'ENUM') {
      bb.readVarUint()
      return
    }
    if (found.kind === 'STRUCT') {
      for (const field of found.fields) skipField(field, bb)
      return
    }
    const fields = messageFields(found)
    for (let id = bb.readVarUint(); id !== 0; id = bb.readVarUint()) {
      const field = fields.get(id)
      if (!field) throw new Error('Attempted to parse invalid message')
      skipField(field, bb)
    }
  }

  const skipField = (field: Field, bb: ByteBuffer): void => {
    const type = field.type
    if (type === null)
      error('Invalid type null for field ' + quote(field.name), field.line, field.column)
    if (!field.isArray) {
      skipValue(type, bb)
      return
    }
    if (type === 'byte') {
      bb.skipByteArray()
      return
    }
    for (let length = bb.readVarUint(); length > 0; length--) skipValue(type, bb)
  }

  return {
    definition,
    fieldsById: (name) => messageFields(definition(name)),
    skipField,
    skipValue
  }
}
