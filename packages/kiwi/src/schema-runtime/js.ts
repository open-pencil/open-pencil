import { ByteBuffer } from './bb'
import { Schema, Definition } from './schema'
import { error, quote } from './util'

function compileDecode(
  definition: Definition,
  definitions: { [name: string]: Definition }
): string {
  let lines: string[] = []
  let indent = '  '

  lines.push('function (bb) {')
  lines.push('  var result = {};')
  lines.push('  if (!(bb instanceof this.ByteBuffer)) {')
  lines.push('    bb = new this.ByteBuffer(bb);')
  lines.push('  }')
  lines.push('')

  if (definition.kind === 'MESSAGE') {
    lines.push('  while (true) {')
    lines.push('    switch (bb.readVarUint()) {')
    lines.push('      case 0:')
    lines.push('        return result;')
    lines.push('')
    indent = '        '
  }

  for (let i = 0; i < definition.fields.length; i++) {
    let field = definition.fields[i]
    let code: string

    switch (field.type) {
      case 'bool': {
        code = '!!bb.readByte()'
        break
      }

      case 'byte': {
        code = 'bb.readByte()' // only used if not array
        break
      }

      case 'int': {
        code = 'bb.readVarInt()'
        break
      }

      case 'uint': {
        code = 'bb.readVarUint()'
        break
      }

      case 'float': {
        code = 'bb.readVarFloat()'
        break
      }

      case 'string': {
        code = 'bb.readString()'
        break
      }

      case 'int64': {
        code = 'bb.readVarInt64()'
        break
      }

      case 'uint64': {
        code = 'bb.readVarUint64()'
        break
      }

      default: {
        let type = definitions[field.type!]
        if (!type) {
          error(
            'Invalid type ' + quote(field.type!) + ' for field ' + quote(field.name),
            field.line,
            field.column
          )
        } else if (type.kind === 'ENUM') {
          code = 'this[' + quote(type.name) + '][bb.readVarUint()]'
        } else {
          code = 'this[' + quote('decode' + type.name) + '](bb)'
        }
      }
    }

    if (definition.kind === 'MESSAGE') {
      lines.push('      case ' + field.value + ':')
    }

    if (field.isArray) {
      if (field.isDeprecated) {
        if (field.type === 'byte') {
          lines.push(indent + 'bb.readByteArray();')
        } else {
          lines.push(indent + 'var length = bb.readVarUint();')
          lines.push(indent + 'while (length-- > 0) ' + code + ';')
        }
      } else {
        if (field.type === 'byte') {
          lines.push(indent + 'result[' + quote(field.name) + '] = bb.readByteArray();')
        } else {
          lines.push(indent + 'var length = bb.readVarUint();')
          lines.push(indent + 'var values = result[' + quote(field.name) + '] = Array(length);')
          lines.push(indent + 'for (var i = 0; i < length; i++) values[i] = ' + code + ';')
        }
      }
    } else {
      if (field.isDeprecated) {
        lines.push(indent + code + ';')
      } else {
        lines.push(indent + 'result[' + quote(field.name) + '] = ' + code + ';')
      }
    }

    if (definition.kind === 'MESSAGE') {
      lines.push('        break;')
      lines.push('')
    }
  }

  if (definition.kind === 'MESSAGE') {
    lines.push('      default:')
    lines.push('        throw new Error("Attempted to parse invalid message");')
    lines.push('    }')
    lines.push('  }')
  } else {
    lines.push('  return result;')
  }

  lines.push('}')

  return lines.join('\n')
}

function compileEncode(
  definition: Definition,
  definitions: { [name: string]: Definition }
): string {
  let lines: string[] = []

  lines.push('function (message, bb) {')
  lines.push('  var isTopLevel = !bb;')
  lines.push('  if (isTopLevel) bb = new this.ByteBuffer();')

  for (let j = 0; j < definition.fields.length; j++) {
    let field = definition.fields[j]
    let code: string

    if (field.isDeprecated) {
      continue
    }

    switch (field.type) {
      case 'bool': {
        code = 'bb.writeByte(value);'
        break
      }

      case 'byte': {
        code = 'bb.writeByte(value);' // only used if not array
        break
      }

      case 'int': {
        code = 'bb.writeVarInt(value);'
        break
      }

      case 'uint': {
        code = 'bb.writeVarUint(value);'
        break
      }

      case 'float': {
        code = 'bb.writeVarFloat(value);'
        break
      }

      case 'string': {
        code = 'bb.writeString(value);'
        break
      }

      case 'int64': {
        code = 'bb.writeVarInt64(value);'
        break
      }

      case 'uint64': {
        code = 'bb.writeVarUint64(value);'
        break
      }

      default: {
        let type = definitions[field.type!]
        if (!type) {
          throw new Error('Invalid type ' + quote(field.type!) + ' for field ' + quote(field.name))
        } else if (type.kind === 'ENUM') {
          code =
            'var encoded = this[' +
            quote(type.name) +
            '][value]; ' +
            'if (encoded === void 0) throw new Error("Invalid value " + JSON.stringify(value) + ' +
            quote(' for enum ' + quote(type.name)) +
            '); ' +
            'bb.writeVarUint(encoded);'
        } else {
          code = 'this[' + quote('encode' + type.name) + '](value, bb);'
        }
      }
    }

    lines.push('')
    lines.push('  var value = message[' + quote(field.name) + '];')
    lines.push('  if (value != null) {') // Comparing with null using "!=" also checks for undefined

    if (definition.kind === 'MESSAGE') {
      lines.push('    bb.writeVarUint(' + field.value + ');')
    }

    if (field.isArray) {
      if (field.type === 'byte') {
        lines.push('    bb.writeByteArray(value);')
      } else {
        lines.push('    var values = value, n = values.length;')
        lines.push('    bb.writeVarUint(n);')
        lines.push('    for (var i = 0; i < n; i++) {')
        lines.push('      value = values[i];')
        lines.push('      ' + code)
        lines.push('    }')
      }
    } else {
      lines.push('    ' + code)
    }

    if (definition.kind === 'STRUCT') {
      lines.push('  } else {')
      lines.push(
        '    throw new Error(' + quote('Missing required field ' + quote(field.name)) + ');'
      )
    }

    lines.push('  }')
  }

  // A field id of zero is reserved to indicate the end of the message
  if (definition.kind === 'MESSAGE') {
    lines.push('  bb.writeVarUint(0);')
  }

  lines.push('')
  lines.push('  if (isTopLevel) return bb.toUint8Array();')
  lines.push('}')

  return lines.join('\n')
}

export function compileSchemaJS(schema: Schema): string {
  let definitions: { [name: string]: Definition } = {}
  let name = schema.package
  let js: string[] = []

  if (name !== null) {
    js.push('var ' + name + ' = exports || ' + name + ' || {}, exports;')
  } else {
    js.push('var exports = exports || {};')
    name = 'exports'
  }

  js.push(name + '.ByteBuffer = ' + name + '.ByteBuffer || require("kiwi-schema").ByteBuffer;')

  for (let i = 0; i < schema.definitions.length; i++) {
    let definition = schema.definitions[i]
    definitions[definition.name] = definition
  }

  for (let i = 0; i < schema.definitions.length; i++) {
    let definition = schema.definitions[i]

    switch (definition.kind) {
      case 'ENUM': {
        let value: any = {}
        for (let j = 0; j < definition.fields.length; j++) {
          let field = definition.fields[j]
          value[field.name] = field.value
          value[field.value] = field.name
        }
        js.push(name + '[' + quote(definition.name) + '] = ' + JSON.stringify(value, null, 2) + ';')
        break
      }

      case 'STRUCT':
      case 'MESSAGE': {
        js.push('')
        js.push(
          name +
            '[' +
            quote('decode' + definition.name) +
            '] = ' +
            compileDecode(definition, definitions) +
            ';'
        )
        js.push('')
        js.push(
          name +
            '[' +
            quote('encode' + definition.name) +
            '] = ' +
            compileEncode(definition, definitions) +
            ';'
        )
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

  js.push('')
  return js.join('\n')
}

export function compileSchema(schema: Schema): any {
  let result = {
    ByteBuffer: ByteBuffer
  }
  new Function('exports', compileSchemaJS(schema))(result)
  return result
}
