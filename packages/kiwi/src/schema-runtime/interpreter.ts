import { ByteBuffer } from './bb'
import { nativeTypes } from './parser'
import type { Definition, Field, Schema } from './schema'
import { error, quote } from './util'

type RuntimeEnum = { [name: string]: string | number }
type RuntimeValue =
  | boolean
  | number
  | string
  | bigint
  | Uint8Array
  | RuntimeMessage
  | RuntimeValue[]
export type RuntimeMessage = { [name: string]: RuntimeValue }
type DecodeFunction = (bb: ByteBuffer | Uint8Array) => RuntimeMessage
type EncodeFunction = (message: RuntimeMessage, bb?: ByteBuffer) => Uint8Array | undefined
type RuntimeEntry =
  | typeof ByteBuffer
  | RuntimeEnum
  | RuntimeValue
  | DecodeFunction
  | EncodeFunction
  | undefined
export type RuntimeCodec = {
  ByteBuffer: typeof ByteBuffer
  encodeMessage?: EncodeFunction
  decodeMessage?: DecodeFunction
  encodePaint?: EncodeFunction
  encodeNodeChange?: EncodeFunction
  [name: string]: RuntimeEntry
}
type Definitions = { [name: string]: Definition }

function asDecodeFunction(value: unknown): DecodeFunction {
  return value as DecodeFunction
}
function asEncodeFunction(value: unknown): EncodeFunction {
  return value as EncodeFunction
}
function asRuntimeEnum(value: unknown): RuntimeEnum {
  return value as RuntimeEnum
}

function hasDefinition(definitions: Definitions, name: string): boolean {
  return Object.hasOwn(definitions, name)
}

function validateFieldTypes(definitions: Definitions): void {
  let definitionList = Object.values(definitions)
  for (let i = 0; i < definitionList.length; i++) {
    let definition = definitionList[i]
    if (definition.kind === 'ENUM') continue
    for (let j = 0; j < definition.fields.length; j++) {
      let field = definition.fields[j]
      let type = field.type
      if (type === null) {
        error('Invalid type null for field ' + quote(field.name), field.line, field.column)
      }
      if (!nativeTypes.includes(type) && !hasDefinition(definitions, type)) {
        error(
          'Invalid type ' + quote(type) + ' for field ' + quote(field.name),
          field.line,
          field.column
        )
      }
    }
  }
}

// Interprets a schema field-by-field instead of generating and `eval`-ing a
// per-schema decoder/encoder (as `compileSchemaJS` + `new Function` do). A
// `new Function(...)`-built codec is indistinguishable from `eval` to a CSP:
// embedders that run under `script-src` without `unsafe-eval` (e.g. a
// sandboxed plugin host) cannot call `compileSchema` at all otherwise. This
// walk produces byte-identical output to the generated code — same field
// order, same tag/no-tag rules for MESSAGE vs STRUCT, same deprecated-field
// skip behavior — so it is a drop-in replacement, not a new format.
function readField(
  self: RuntimeCodec,
  definitions: Definitions,
  type: string,
  bb: ByteBuffer
): RuntimeValue {
  switch (type) {
    case 'bool':
      return !!bb.readByte()
    case 'byte':
      return bb.readByte()
    case 'int':
      return bb.readVarInt()
    case 'uint':
      return bb.readVarUint()
    case 'float':
      return bb.readVarFloat()
    case 'string':
      return bb.readString()
    case 'int64':
      return bb.readVarInt64()
    case 'uint64':
      return bb.readVarUint64()
    default: {
      let definition = definitions[type]
      if (!definition) error('Invalid type ' + quote(type), 0, 0)
      if (definition.kind === 'ENUM') return asRuntimeEnum(self[definition.name])[bb.readVarUint()]
      return asDecodeFunction(self['decode' + definition.name])(bb)
    }
  }
}

function writeField(
  self: RuntimeCodec,
  definitions: Definitions,
  type: string,
  value: RuntimeValue,
  bb: ByteBuffer
): void {
  switch (type) {
    case 'bool':
    case 'byte':
      bb.writeByte(value as number)
      return
    case 'int':
      bb.writeVarInt(value as number)
      return
    case 'uint':
      bb.writeVarUint(value as number)
      return
    case 'float':
      bb.writeVarFloat(value as number)
      return
    case 'string':
      bb.writeString(value as string)
      return
    case 'int64':
      bb.writeVarInt64(value as bigint | string)
      return
    case 'uint64':
      bb.writeVarUint64(value as bigint | string)
      return
    default: {
      let definition = definitions[type]
      if (!definition) error('Invalid type ' + quote(type), 0, 0)
      if (definition.kind === 'ENUM') {
        let encoded = asRuntimeEnum(self[definition.name])[value as string]
        if (encoded === undefined) {
          throw new Error(
            'Invalid value ' + JSON.stringify(value) + ' for enum ' + quote(definition.name)
          )
        }
        bb.writeVarUint(encoded as number)
      } else {
        asEncodeFunction(self['encode' + definition.name])(value as RuntimeMessage, bb)
      }
    }
  }
}

function readInto(
  self: RuntimeCodec,
  definitions: Definitions,
  field: Field,
  bb: ByteBuffer,
  result: RuntimeMessage
): void {
  let type = field.type
  if (type === null)
    error('Invalid type null for field ' + quote(field.name), field.line, field.column)

  if (field.isArray) {
    if (field.isDeprecated) {
      if (type === 'byte') bb.readByteArray()
      else {
        let length = bb.readVarUint()
        while (length-- > 0) readField(self, definitions, type, bb)
      }
      return
    }
    if (type === 'byte') {
      result[field.name] = bb.readByteArray()
      return
    }
    let length = bb.readVarUint()
    let values: RuntimeValue[] = Array.from({ length })
    result[field.name] = values
    for (let i = 0; i < length; i++) values[i] = readField(self, definitions, type, bb)
    return
  }

  if (field.isDeprecated) {
    readField(self, definitions, type, bb)
    return
  }

  result[field.name] = readField(self, definitions, type, bb)
}

function writeFrom(
  self: RuntimeCodec,
  definitions: Definitions,
  field: Field,
  value: RuntimeValue,
  bb: ByteBuffer
): void {
  let type = field.type
  if (type === null)
    error('Invalid type null for field ' + quote(field.name), field.line, field.column)

  if (field.isArray) {
    if (type === 'byte') {
      bb.writeByteArray(value as Uint8Array)
      return
    }
    let values = value as RuntimeValue[]
    bb.writeVarUint(values.length)
    for (let i = 0; i < values.length; i++) writeField(self, definitions, type, values[i], bb)
    return
  }

  writeField(self, definitions, type, value, bb)
}

function interpretDecode(self: RuntimeCodec, definitions: Definitions, definition: Definition) {
  let fieldsById = new Map<number, Field>()
  for (let i = 0; i < definition.fields.length; i++)
    fieldsById.set(definition.fields[i].value, definition.fields[i])
  return function (bb: ByteBuffer | Uint8Array): RuntimeMessage {
    let buffer = bb instanceof self.ByteBuffer ? bb : new self.ByteBuffer(bb)
    let result: RuntimeMessage = {}

    if (definition.kind === 'MESSAGE') {
      while (true) {
        const id = buffer.readVarUint()
        if (id === 0) return result
        const field = fieldsById.get(id)
        if (!field) throw new Error('Attempted to parse invalid message')
        readInto(self, definitions, field, buffer, result)
      }
    } else {
      for (let i = 0; i < definition.fields.length; i++) {
        readInto(self, definitions, definition.fields[i], buffer, result)
      }
      return result
    }
  }
}

function interpretEncode(self: RuntimeCodec, definitions: Definitions, definition: Definition) {
  return function (message: RuntimeMessage, bb?: ByteBuffer): Uint8Array | undefined {
    let isTopLevel = !bb
    let buffer = bb || new self.ByteBuffer()

    for (let i = 0; i < definition.fields.length; i++) {
      let field = definition.fields[i]
      if (field.isDeprecated) continue
      let value = message[field.name]
      if (value != null) {
        if (definition.kind === 'MESSAGE') buffer.writeVarUint(field.value)
        writeFrom(self, definitions, field, value, buffer)
      } else if (definition.kind === 'STRUCT') {
        throw new Error('Missing required field ' + quote(field.name))
      }
    }

    if (definition.kind === 'MESSAGE') buffer.writeVarUint(0)
    if (isTopLevel) return buffer.toUint8Array()
    return undefined
  }
}

export function compileSchemaRuntime(schema: Schema): RuntimeCodec {
  let definitions: Definitions = Object.create(null) as Definitions
  for (let i = 0; i < schema.definitions.length; i++) {
    definitions[schema.definitions[i].name] = schema.definitions[i]
  }

  validateFieldTypes(definitions)

  let result: RuntimeCodec = {
    ByteBuffer: ByteBuffer
  }

  for (let i = 0; i < schema.definitions.length; i++) {
    let definition = schema.definitions[i]

    switch (definition.kind) {
      case 'ENUM': {
        let value: RuntimeEnum = {}
        for (let j = 0; j < definition.fields.length; j++) {
          let field = definition.fields[j]
          value[field.name] = field.value
          value[field.value] = field.name
        }
        result[definition.name] = value
        break
      }

      case 'STRUCT':
      case 'MESSAGE': {
        result['decode' + definition.name] = interpretDecode(result, definitions, definition)
        result['encode' + definition.name] = interpretEncode(result, definitions, definition)
        break
      }

      default: {
        error(
          'Invalid definition kind ' + quote(definition.kind),
          definition.line,
          definition.column
        )
        break
      }
    }
  }

  return result
}
