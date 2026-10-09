import { ByteBuffer } from './bb'
import { nativeTypes } from './parser'
import type { Definition, Field, Schema } from './schema'
import { createSchemaSkipper, type SchemaSkipper } from './skip'
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

/**
 * Message types decoded as headers: only the named fields are read, and the rest stay in the
 * message bytes until `decodeWhole` reads the message in full. A large message of many such
 * messages then holds a little of each rather than every value of every one.
 */
export type HeaderFields = Readonly<Record<string, readonly string[]>>

/**
 * What a header needs to be read whole: the bytes it came from, where it starts in them, and
 * the decoder that reads every field. They are hidden properties of the header, so each costs a
 * slot on the object; neither spread nor `structuredClone` copies them.
 */
const HEADER_BYTES = Symbol('header bytes')
const HEADER_START = Symbol('header start')
const HEADER_WHOLE = Symbol('header whole decoder')

/**
 * How many whole decodes are running. A message type can nest itself, as instance overrides
 * are records too, and a message read whole is read whole all the way down.
 */
let wholeDepth = 0

/**
 * A header read again in full from the bytes it came from, as a new message the caller owns,
 * or undefined for a message that was decoded whole.
 */
export function decodeWhole(message: object): RuntimeMessage | undefined {
  const bytes: unknown = Reflect.get(message, HEADER_BYTES)
  const start: unknown = Reflect.get(message, HEADER_START)
  const whole: unknown = Reflect.get(message, HEADER_WHOLE)
  if (!(bytes instanceof Uint8Array) || typeof start !== 'number' || typeof whole !== 'function')
    return undefined
  const buffer = new ByteBuffer(bytes)
  buffer.offset = start
  return (whole as (bb: ByteBuffer) => RuntimeMessage)(buffer)
}

function hide(message: RuntimeMessage, key: symbol, value: unknown): void {
  Reflect.defineProperty(message, key, { value, enumerable: false })
}

interface HeaderDecoding {
  keep: ReadonlySet<string>
  skipper: SchemaSkipper
  /** Reads the message in full, for `decodeWhole`. */
  whole: (bb: ByteBuffer) => RuntimeMessage
}

function wholeDecoder(
  decode: (bb: ByteBuffer) => RuntimeMessage
): (bb: ByteBuffer) => RuntimeMessage {
  return (bb) => {
    wholeDepth++
    try {
      return decode(bb)
    } finally {
      wholeDepth--
    }
  }
}

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

function interpretDecode(
  self: RuntimeCodec,
  definitions: Definitions,
  definition: Definition,
  header?: HeaderDecoding
) {
  let fieldsById = new Map<number, Field>()
  for (let i = 0; i < definition.fields.length; i++)
    fieldsById.set(definition.fields[i].value, definition.fields[i])
  return function (bb: ByteBuffer | Uint8Array): RuntimeMessage {
    let buffer = bb instanceof self.ByteBuffer ? bb : new self.ByteBuffer(bb)
    let result: RuntimeMessage = {}

    if (definition.kind === 'MESSAGE') {
      const asHeader = header && wholeDepth === 0 ? header : undefined
      if (asHeader) {
        hide(result, HEADER_BYTES, buffer.bytes)
        hide(result, HEADER_START, buffer.offset)
        hide(result, HEADER_WHOLE, asHeader.whole)
      }
      while (true) {
        const id = buffer.readVarUint()
        if (id === 0) return result
        const field = fieldsById.get(id)
        if (!field) throw new Error('Attempted to parse invalid message')
        if (asHeader && !asHeader.keep.has(field.name)) asHeader.skipper.skipField(field, buffer)
        else readInto(self, definitions, field, buffer, result)
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

export function compileSchemaRuntime(schema: Schema, headers?: HeaderFields): RuntimeCodec {
  let definitions: Definitions = Object.create(null) as Definitions
  for (let i = 0; i < schema.definitions.length; i++) {
    definitions[schema.definitions[i].name] = schema.definitions[i]
  }

  validateFieldTypes(definitions)

  let result: RuntimeCodec = {
    ByteBuffer: ByteBuffer
  }
  let skipper: SchemaSkipper | undefined

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
        const keep = definition.kind === 'MESSAGE' ? headers?.[definition.name] : undefined
        const header: HeaderDecoding | undefined = keep && {
          keep: new Set(keep),
          skipper: (skipper ??= createSchemaSkipper(schema)),
          whole: wholeDecoder(interpretDecode(result, definitions, definition))
        }
        result['decode' + definition.name] = interpretDecode(
          result,
          definitions,
          definition,
          header
        )
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
