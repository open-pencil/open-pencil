import { Schema, Definition, Field, DefinitionKind } from './schema'
import { error, quote } from './util'

export let nativeTypes = ['bool', 'byte', 'float', 'int', 'int64', 'string', 'uint', 'uint64']

// These are special names on the object returned by compileSchema()
export let reservedNames = ['ByteBuffer', 'package']

let regex = /((?:-|\b)\d+\b|[=;{}]|\[\]|\[deprecated\]|\b[A-Za-z_][A-Za-z0-9_]*\b|\/\/.*|\s+)/g
let identifier = /^[A-Za-z_][A-Za-z0-9_]*$/
let whitespace = /^\/\/.*|\s+$/
let equals = /^=$/
let endOfFile = /^$/
let semicolon = /^;$/
let integer = /^-?\d+$/
let leftBrace = /^\{$/
let rightBrace = /^\}$/
let arrayToken = /^\[\]$/
let enumKeyword = /^enum$/
let structKeyword = /^struct$/
let messageKeyword = /^message$/
let packageKeyword = /^package$/
let deprecatedToken = /^\[deprecated\]$/

interface Token {
  text: string
  line: number
  column: number
}

function tokenize(text: string): Token[] {
  let parts = text.split(regex)
  let tokens = []
  let column = 0
  let line = 0

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i]

    // Keep non-whitespace tokens
    if (i & 1) {
      if (!whitespace.test(part)) {
        tokens.push({
          text: part,
          line: line + 1,
          column: column + 1
        })
      }
    }

    // Detect syntax errors
    else if (part !== '') {
      error('Syntax error ' + quote(part), line + 1, column + 1)
    }

    // Keep track of the line and column counts
    let lines = part.split('\n')
    if (lines.length > 1) column = 0
    line += lines.length - 1
    column += lines[lines.length - 1].length
  }

  // End-of-file token
  tokens.push({
    text: '',
    line: line,
    column: column
  })

  return tokens
}

function parse(tokens: Token[]): Schema {
  function current(): Token {
    return tokens[index]
  }

  function eat(test: RegExp): boolean {
    if (test.test(current().text)) {
      index++
      return true
    }
    return false
  }

  function expect(test: RegExp, expected: string): void {
    if (!eat(test)) {
      let token = current()
      error('Expected ' + expected + ' but found ' + quote(token.text), token.line, token.column)
    }
  }

  function unexpectedToken(): never {
    let token = current()
    error('Unexpected token ' + quote(token.text), token.line, token.column)
  }

  let definitions: Definition[] = []
  let packageText = null
  let index = 0

  if (eat(packageKeyword)) {
    packageText = current().text
    expect(identifier, 'identifier')
    expect(semicolon, '";"')
  }

  while (index < tokens.length && !eat(endOfFile)) {
    let fields: Field[] = []
    let kind: DefinitionKind

    if (eat(enumKeyword)) kind = 'ENUM'
    else if (eat(structKeyword)) kind = 'STRUCT'
    else if (eat(messageKeyword)) kind = 'MESSAGE'
    else unexpectedToken()

    // All definitions start off the same
    let name = current()
    expect(identifier, 'identifier')
    expect(leftBrace, '"{"')

    // Parse fields
    while (!eat(rightBrace)) {
      let type: string | null = null
      let isArray = false
      let isDeprecated = false

      // Enums don't have types
      if (kind !== 'ENUM') {
        type = current().text
        expect(identifier, 'identifier')
        isArray = eat(arrayToken)
      }

      let field = current()
      expect(identifier, 'identifier')

      // Structs don't have explicit values
      let value: Token | null = null
      if (kind !== 'STRUCT') {
        expect(equals, '"="')
        value = current()
        expect(integer, 'integer')

        if ((+value.text | 0) + '' !== value.text) {
          error('Invalid integer ' + quote(value.text), value.line, value.column)
        }
      }

      let deprecated = current()
      if (eat(deprecatedToken)) {
        if (kind !== 'MESSAGE') {
          error('Cannot deprecate this field', deprecated.line, deprecated.column)
        }

        isDeprecated = true
      }

      expect(semicolon, '";"')

      fields.push({
        name: field.text,
        line: field.line,
        column: field.column,
        type: type,
        isArray: isArray,
        isDeprecated: isDeprecated,
        value: value !== null ? +value.text | 0 : fields.length + 1
      })
    }

    definitions.push({
      name: name.text,
      line: name.line,
      column: name.column,
      kind: kind,
      fields: fields
    })
  }

  return {
    package: packageText,
    definitions: definitions
  }
}

function verify(root: Schema): void {
  let definedTypes = nativeTypes.slice()
  let definitions: { [name: string]: Definition } = {}

  // Define definitions
  for (let i = 0; i < root.definitions.length; i++) {
    let definition = root.definitions[i]
    if (definedTypes.includes(definition.name)) {
      error(
        'The type ' + quote(definition.name) + ' is defined twice',
        definition.line,
        definition.column
      )
    }
    if (reservedNames.includes(definition.name)) {
      error(
        'The type name ' + quote(definition.name) + ' is reserved',
        definition.line,
        definition.column
      )
    }
    definedTypes.push(definition.name)
    definitions[definition.name] = definition
  }

  // Check fields
  for (let i = 0; i < root.definitions.length; i++) {
    let definition = root.definitions[i]
    let fields = definition.fields

    if (definition.kind === 'ENUM' || fields.length === 0) {
      continue
    }

    // Check types
    for (let j = 0; j < fields.length; j++) {
      let field = fields[j]
      if (!definedTypes.includes(field.type!)) {
        error(
          'The type ' + quote(field.type!) + ' is not defined for field ' + quote(field.name),
          field.line,
          field.column
        )
      }
    }

    // Check values
    let values: number[] = []
    for (let j = 0; j < fields.length; j++) {
      let field = fields[j]
      if (values.includes(field.value)) {
        error('The id for field ' + quote(field.name) + ' is used twice', field.line, field.column)
      }
      if (field.value <= 0) {
        error(
          'The id for field ' + quote(field.name) + ' must be positive',
          field.line,
          field.column
        )
      }
      // Figma schema uses sparse field IDs (up to 435), so skip sequential check
      values.push(field.value)
    }
  }

  // Check that structs don't contain themselves
  let state: { [name: string]: number } = {}
  let check = (name: string): boolean => {
    let definition = definitions[name]
    if (definition && definition.kind === 'STRUCT') {
      if (state[name] === 1) {
        error(
          'Recursive nesting of ' + quote(name) + ' is not allowed',
          definition.line,
          definition.column
        )
      }
      if (state[name] !== 2 && definition) {
        state[name] = 1
        let fields = definition.fields
        for (let i = 0; i < fields.length; i++) {
          let field = fields[i]
          if (!field.isArray) {
            check(field.type!)
          }
        }
        state[name] = 2
      }
    }
    return true
  }
  for (let i = 0; i < root.definitions.length; i++) {
    check(root.definitions[i].name)
  }
}

export function parseSchema(text: string): Schema {
  let schema = parse(tokenize(text))
  verify(schema)
  return schema
}
