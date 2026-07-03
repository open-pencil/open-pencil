import { ByteBuffer } from './bb'
import { Schema, Field, Definition, DefinitionKind } from './schema'

let types: (string | null)[] = ['bool', 'byte', 'int', 'uint', 'float', 'string', 'int64', 'uint64']
let kinds: DefinitionKind[] = ['ENUM', 'STRUCT', 'MESSAGE']

export function decodeBinarySchema(buffer: Uint8Array | ByteBuffer): Schema {
  let bb = buffer instanceof ByteBuffer ? buffer : new ByteBuffer(buffer)
  let definitionCount = bb.readVarUint()
  let definitions: Definition[] = []

  // Read in the schema
  for (let i = 0; i < definitionCount; i++) {
    let definitionName = bb.readString()
    let kind = bb.readByte()
    let fieldCount = bb.readVarUint()
    let fields: Field[] = []

    for (let j = 0; j < fieldCount; j++) {
      let fieldName = bb.readString()
      let type = bb.readVarInt()
      let isArray = !!(bb.readByte() & 1)
      let value = bb.readVarUint()

      fields.push({
        name: fieldName,
        line: 0,
        column: 0,
        type: kinds[kind] === 'ENUM' ? null : (type as any),
        isArray: isArray,
        isDeprecated: false,
        value: value
      })
    }

    definitions.push({
      name: definitionName,
      line: 0,
      column: 0,
      kind: kinds[kind],
      fields: fields
    })
  }

  // Bind type names afterwards
  for (let i = 0; i < definitionCount; i++) {
    let fields = definitions[i].fields
    for (let j = 0; j < fields.length; j++) {
      let field = fields[j]
      let type = field.type as any as number | null

      if (type !== null && type < 0) {
        if (~type >= types.length) {
          throw new Error('Invalid type ' + type)
        }
        field.type = types[~type]
      } else {
        if (type !== null && type >= definitions.length) {
          throw new Error('Invalid type ' + type)
        }
        field.type = type === null ? null : definitions[type].name
      }
    }
  }

  return {
    package: null,
    definitions: definitions
  }
}

export function encodeBinarySchema(schema: Schema): Uint8Array {
  let bb = new ByteBuffer()
  let definitions = schema.definitions
  let definitionIndex: { [name: string]: number } = {}

  bb.writeVarUint(definitions.length)

  for (let i = 0; i < definitions.length; i++) {
    definitionIndex[definitions[i].name] = i
  }

  for (let i = 0; i < definitions.length; i++) {
    let definition = definitions[i]

    bb.writeString(definition.name)
    bb.writeByte(kinds.indexOf(definition.kind))
    bb.writeVarUint(definition.fields.length)

    for (let j = 0; j < definition.fields.length; j++) {
      let field = definition.fields[j]
      let type = types.indexOf(field.type)

      bb.writeString(field.name)
      bb.writeVarInt(type === -1 ? definitionIndex[field.type!] : ~type)
      bb.writeByte(field.isArray ? 1 : 0)
      bb.writeVarUint(field.value)
    }
  }

  return bb.toUint8Array()
}
