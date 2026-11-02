import { ByteBuffer } from './bb'
import type { Definition, DefinitionKind, Field, Schema } from './schema'
import { error, quote } from './util'

export type RuntimeValue =
  | boolean
  | number
  | string
  | bigint
  | Uint8Array
  | RuntimeMessage
  | RuntimeValue[]
export type RuntimeMessage = { [name: string]: RuntimeValue }
type RuntimeEnum = { [name: string]: string | number }
type DecodeFunction = (bb: ByteBuffer | Uint8Array) => RuntimeMessage
type EncodeFunction = (message: RuntimeMessage, bb?: ByteBuffer) => Uint8Array | undefined
type RuntimeEntry =
  | typeof ByteBuffer
  | CompiledSchema
  | RuntimeEnum
  | RuntimeValue
  | DecodeFunction
  | EncodeFunction
  | undefined
export type RuntimeCodec = {
  ByteBuffer: typeof ByteBuffer
  /** The tables the codec reads with, for scanners that pick single fields out of a message. */
  schema: CompiledSchema
  encodeMessage?: EncodeFunction
  decodeMessage?: DecodeFunction
  encodePaint?: EncodeFunction
  encodeNodeChange?: EncodeFunction
  [name: string]: RuntimeEntry
}

/**
 * Message types decoded as headers: only the named fields are read, and the rest stay in the
 * message bytes until `decodeWhole` reads the message in full. A large message of many such
 * messages then holds a little of each rather than every value of every one.
 */
export type HeaderFields = Readonly<Record<string, readonly string[]>>

/** What a field holds: a native type, or an enum, struct, or message of the schema. */
export const TYPE = {
  BOOL: 0,
  BYTE: 1,
  INT: 2,
  UINT: 3,
  FLOAT: 4,
  STRING: 5,
  INT64: 6,
  UINT64: 7,
  ENUM: 8,
  STRUCT: 9,
  MESSAGE: 10
} as const
export type TypeCode = (typeof TYPE)[keyof typeof TYPE]

const NATIVE_TYPES: ReadonlyMap<string, TypeCode> = new Map([
  ['bool', TYPE.BOOL],
  ['byte', TYPE.BYTE],
  ['int', TYPE.INT],
  ['uint', TYPE.UINT],
  ['float', TYPE.FLOAT],
  ['string', TYPE.STRING],
  ['int64', TYPE.INT64],
  ['uint64', TYPE.UINT64]
])

const KIND_TYPES: Readonly<Record<DefinitionKind, TypeCode>> = {
  ENUM: TYPE.ENUM,
  STRUCT: TYPE.STRUCT,
  MESSAGE: TYPE.MESSAGE
}

/** A field resolved once: its type as a number, and the definition behind it. */
export interface CompiledField {
  readonly name: string
  readonly id: number
  readonly isArray: boolean
  readonly isDeprecated: boolean
  readonly type: TypeCode
  /** The definition an enum, struct, or message field holds; null for a native type. */
  readonly definition: CompiledDefinition | null
  /** Whether a header of the owning message keeps this field. */
  readonly kept: boolean
}

export interface CompiledDefinition {
  readonly name: string
  readonly kind: DefinitionKind
  readonly fields: readonly CompiledField[]
  /** A message's fields by ID, with a hole at every ID the definition does not use. */
  readonly byId: ReadonlyArray<CompiledField | undefined>
  /** An enum's member names by value. */
  readonly names: ReadonlyArray<string | undefined>
  /** An enum's values by member name. */
  readonly values: ReadonlyMap<string, number>
  /** Whether messages of this definition decode as headers. */
  readonly header: boolean
}

/**
 * A schema's definitions resolved into tables, and the one reader, skipper, and writer that
 * every codec and scanner shares; nothing is looked up by name while a message is read.
 */
export interface CompiledSchema {
  readonly definitions: readonly CompiledDefinition[]
  /** A definition by name; throws for one the schema lacks. */
  definition(name: string): CompiledDefinition
  /** One field's value, its array included; its shape follows the schema at run time. */
  read(field: CompiledField, bb: ByteBuffer): unknown
  /** Past one field's value, its array included. */
  skip(field: CompiledField, bb: ByteBuffer): void
  /** One field's value, its array included; a message field writes its own end marker. */
  write(field: CompiledField, value: RuntimeValue, bb: ByteBuffer): void
  /** A struct or message read in full, or as a header where the definition is one. */
  decode(definition: CompiledDefinition, bb: ByteBuffer): RuntimeMessage
  /** A struct or message written in full. */
  encode(definition: CompiledDefinition, message: RuntimeMessage, bb: ByteBuffer): void
}

/**
 * What a header needs to be read whole: the bytes it came from, where it starts in them, and
 * the decoder that reads every field. They are hidden properties of the header, so each costs a
 * slot on the object; neither spread nor `structuredClone` copies them.
 */
const HEADER_BYTES = Symbol('header bytes')
const HEADER_START = Symbol('header start')
const HEADER_WHOLE = Symbol('header whole decoder')

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

function invalidMessage(): never {
  throw new Error('Attempted to parse invalid message')
}

function compileDefinitions(schema: Schema, headers?: HeaderFields): CompiledDefinition[] {
  const byName = new Map<string, Definition>()
  for (const definition of schema.definitions) byName.set(definition.name, definition)
  const compiled = new Map<string, CompiledDefinition>()
  const definitions = schema.definitions.map((definition): CompiledDefinition => {
    const fields: CompiledField[] = []
    const byId: (CompiledField | undefined)[] = []
    const names: (string | undefined)[] = []
    const values = new Map<string, number>()
    if (definition.kind === 'ENUM')
      for (const field of definition.fields) {
        names[field.value] = field.name
        values.set(field.name, field.value)
      }
    const kept = headers?.[definition.name]
    const result: CompiledDefinition = {
      name: definition.name,
      kind: definition.kind,
      fields,
      byId,
      names,
      values,
      header: definition.kind === 'MESSAGE' && kept !== undefined
    }
    compiled.set(definition.name, result)
    return result
  })
  schema.definitions.forEach((definition, index) => {
    if (definition.kind === 'ENUM') return
    const target = definitions[index]
    const fields = target.fields as CompiledField[]
    const byId = target.byId as (CompiledField | undefined)[]
    const kept = headers?.[definition.name]
    for (const field of definition.fields) {
      const compiledField = compileField(field, kept, byName, compiled)
      fields.push(compiledField)
      byId[field.value] = compiledField
    }
  })
  return definitions
}

function compileField(
  field: Field,
  kept: readonly string[] | undefined,
  byName: ReadonlyMap<string, Definition>,
  compiled: ReadonlyMap<string, CompiledDefinition>
): CompiledField {
  const type = field.type
  if (type === null)
    error('Invalid type null for field ' + quote(field.name), field.line, field.column)
  const native = NATIVE_TYPES.get(type)
  const definition = native === undefined ? byName.get(type) : undefined
  if (native === undefined && !definition)
    error(
      'Invalid type ' + quote(type) + ' for field ' + quote(field.name),
      field.line,
      field.column
    )
  return {
    name: field.name,
    id: field.value,
    isArray: field.isArray,
    isDeprecated: field.isDeprecated,
    type: native ?? KIND_TYPES[(definition as Definition).kind],
    definition: definition ? (compiled.get(definition.name) ?? null) : null,
    kept: kept === undefined || kept.includes(field.name)
  }
}

export function compileSchemaTables(schema: Schema, headers?: HeaderFields): CompiledSchema {
  const definitions = compileDefinitions(schema, headers)
  const byName = new Map(definitions.map((definition) => [definition.name, definition]))
  /**
   * How many whole decodes are running. A message type can nest itself, as instance overrides
   * are records too, and a message read whole is read whole all the way down.
   */
  let wholeDepth = 0
  const wholeDecoders = new WeakMap<CompiledDefinition, (bb: ByteBuffer) => RuntimeMessage>()

  const definition = (name: string): CompiledDefinition => {
    const found = byName.get(name)
    if (!found) error('Invalid type ' + quote(name), 0, 0)
    return found
  }

  const readValue = (field: CompiledField, bb: ByteBuffer): RuntimeValue => {
    switch (field.type) {
      case TYPE.BOOL:
        return !!bb.readByte()
      case TYPE.BYTE:
        return bb.readByte()
      case TYPE.INT:
        return bb.readVarInt()
      case TYPE.UINT:
        return bb.readVarUint()
      case TYPE.FLOAT:
        return bb.readVarFloat()
      case TYPE.STRING:
        return bb.readString()
      case TYPE.INT64:
        return bb.readVarInt64()
      case TYPE.UINT64:
        return bb.readVarUint64()
      case TYPE.ENUM:
        return (field.definition as CompiledDefinition).names[bb.readVarUint()] as RuntimeValue
      default:
        return decode(field.definition as CompiledDefinition, bb)
    }
  }

  const read = (field: CompiledField, bb: ByteBuffer): RuntimeValue => {
    if (!field.isArray) return readValue(field, bb)
    if (field.type === TYPE.BYTE) return bb.readByteArray()
    const length = bb.readVarUint()
    const values: RuntimeValue[] = Array.from({ length })
    for (let i = 0; i < length; i++) values[i] = readValue(field, bb)
    return values
  }

  const skipValue = (field: CompiledField, bb: ByteBuffer): void => {
    switch (field.type) {
      case TYPE.BOOL:
      case TYPE.BYTE:
        bb.readByte()
        return
      case TYPE.INT:
      case TYPE.UINT:
      case TYPE.ENUM:
        bb.readVarUint()
        return
      case TYPE.FLOAT:
        bb.readVarFloat()
        return
      case TYPE.STRING:
        bb.skipString()
        return
      case TYPE.INT64:
      case TYPE.UINT64:
        bb.readVarUint64()
        return
      case TYPE.STRUCT:
        for (const inner of (field.definition as CompiledDefinition).fields) skip(inner, bb)
        return
      default: {
        const byId = (field.definition as CompiledDefinition).byId
        for (let id = bb.readVarUint(); id !== 0; id = bb.readVarUint())
          skip(byId[id] ?? invalidMessage(), bb)
      }
    }
  }

  const skip = (field: CompiledField, bb: ByteBuffer): void => {
    if (!field.isArray) {
      skipValue(field, bb)
      return
    }
    if (field.type === TYPE.BYTE) {
      bb.skipByteArray()
      return
    }
    for (let length = bb.readVarUint(); length > 0; length--) skipValue(field, bb)
  }

  const readInto = (field: CompiledField, bb: ByteBuffer, result: RuntimeMessage): void => {
    if (field.isDeprecated) skip(field, bb)
    else result[field.name] = read(field, bb)
  }

  const decode = (target: CompiledDefinition, bb: ByteBuffer): RuntimeMessage => {
    const result: RuntimeMessage = {}
    if (target.kind === 'STRUCT') {
      for (const field of target.fields) readInto(field, bb, result)
      return result
    }
    const asHeader = target.header && wholeDepth === 0
    if (asHeader) {
      hide(result, HEADER_BYTES, bb.bytes)
      hide(result, HEADER_START, bb.offset)
      hide(result, HEADER_WHOLE, wholeDecoder(target))
    }
    const byId = target.byId
    for (let id = bb.readVarUint(); id !== 0; id = bb.readVarUint()) {
      const field = byId[id] ?? invalidMessage()
      if (asHeader && !field.kept) skip(field, bb)
      else readInto(field, bb, result)
    }
    return result
  }

  const wholeDecoder = (target: CompiledDefinition): ((bb: ByteBuffer) => RuntimeMessage) => {
    let whole = wholeDecoders.get(target)
    if (!whole) {
      whole = (bb) => {
        wholeDepth++
        try {
          return decode(target, bb)
        } finally {
          wholeDepth--
        }
      }
      wholeDecoders.set(target, whole)
    }
    return whole
  }

  const writeValue = (field: CompiledField, value: RuntimeValue, bb: ByteBuffer): void => {
    switch (field.type) {
      case TYPE.BOOL:
      case TYPE.BYTE:
        bb.writeByte(value as number)
        return
      case TYPE.INT:
        bb.writeVarInt(value as number)
        return
      case TYPE.UINT:
        bb.writeVarUint(value as number)
        return
      case TYPE.FLOAT:
        bb.writeVarFloat(value as number)
        return
      case TYPE.STRING:
        bb.writeString(value as string)
        return
      case TYPE.INT64:
        bb.writeVarInt64(value as bigint | string)
        return
      case TYPE.UINT64:
        bb.writeVarUint64(value as bigint | string)
        return
      case TYPE.ENUM: {
        const target = field.definition as CompiledDefinition
        const encoded = target.values.get(value as string)
        if (encoded === undefined)
          throw new Error(
            'Invalid value ' + JSON.stringify(value) + ' for enum ' + quote(target.name)
          )
        bb.writeVarUint(encoded)
        return
      }
      default:
        encode(field.definition as CompiledDefinition, value as RuntimeMessage, bb)
    }
  }

  const write = (field: CompiledField, value: RuntimeValue, bb: ByteBuffer): void => {
    if (!field.isArray) {
      writeValue(field, value, bb)
      return
    }
    if (field.type === TYPE.BYTE) {
      bb.writeByteArray(value as Uint8Array)
      return
    }
    const values = value as RuntimeValue[]
    bb.writeVarUint(values.length)
    for (const item of values) writeValue(field, item, bb)
  }

  const encode = (target: CompiledDefinition, message: RuntimeMessage, bb: ByteBuffer): void => {
    const isMessage = target.kind === 'MESSAGE'
    for (const field of target.fields) {
      if (field.isDeprecated) continue
      const value = message[field.name]
      if (value != null) {
        if (isMessage) bb.writeVarUint(field.id)
        write(field, value, bb)
      } else if (!isMessage) {
        throw new Error('Missing required field ' + quote(field.name))
      }
    }
    if (isMessage) bb.writeVarUint(0)
  }

  return { definitions, definition, read, skip, write, decode, encode }
}

/**
 * Interprets a schema through its compiled tables instead of generating and `eval`-ing a
 * per-schema decoder/encoder (as `compileSchemaJS` + `new Function` do). A `new Function(...)`-
 * built codec is indistinguishable from `eval` to a CSP: embedders that run under `script-src`
 * without `unsafe-eval` (e.g. a sandboxed plugin host) cannot call `compileSchema` at all
 * otherwise. The tables produce byte-identical output to the generated code: same field order,
 * same tag/no-tag rules for MESSAGE vs STRUCT, same deprecated-field skip behavior.
 */
export function compileSchemaRuntime(schema: Schema, headers?: HeaderFields): RuntimeCodec {
  const compiled = compileSchemaTables(schema, headers)
  const codec: RuntimeCodec = { ByteBuffer, schema: compiled }
  for (const definition of compiled.definitions) {
    if (definition.kind === 'ENUM') {
      const value: RuntimeEnum = {}
      for (const [name, member] of definition.values) {
        value[name] = member
        value[member] = name
      }
      codec[definition.name] = value
      continue
    }
    codec['decode' + definition.name] = (bb: ByteBuffer | Uint8Array): RuntimeMessage =>
      compiled.decode(definition, bb instanceof codec.ByteBuffer ? bb : new codec.ByteBuffer(bb))
    codec['encode' + definition.name] = (
      message: RuntimeMessage,
      bb?: ByteBuffer
    ): Uint8Array | undefined => {
      const buffer = bb ?? new codec.ByteBuffer()
      compiled.encode(definition, message, buffer)
      return bb ? undefined : buffer.toUint8Array()
    }
  }
  return codec
}
