import type { Definition, Field, Schema } from './schema'
import { error, quote } from './util'

export function findDefinition(schema: Schema, name: string): Definition | null {
  return schema.definitions.find((definition) => definition.name === name) ?? null
}

export function findField(schema: Schema, definitionName: string, fieldName: string): Field | null {
  return (
    findDefinition(schema, definitionName)?.fields.find((field) => field.name === fieldName) ?? null
  )
}

export function expectFieldNumber(
  schema: Schema,
  definitionName: string,
  fieldName: string,
  expectedValue: number
): void {
  const field = findField(schema, definitionName, fieldName)
  if (!field) {
    throw new Error(`Missing field ${definitionName}.${fieldName}`)
  }
  if (field.value !== expectedValue) {
    throw new Error(
      `Expected ${definitionName}.${fieldName} to use field ${expectedValue}, got ${field.value}`
    )
  }
}

export function expectEnumValue(
  schema: Schema,
  enumName: string,
  memberName: string,
  expectedValue: number
): void {
  const definition = findDefinition(schema, enumName)
  if (!definition) {
    throw new Error(`Missing enum ${enumName}`)
  }
  if (definition.kind !== 'ENUM') {
    throw new Error(`${enumName} is a ${definition.kind}, not an enum`)
  }
  const field = definition.fields.find((candidate) => candidate.name === memberName)
  if (!field) {
    throw new Error(`Missing enum member ${enumName}.${memberName}`)
  }
  if (field.value !== expectedValue) {
    throw new Error(
      `Expected ${enumName}.${memberName} to use value ${expectedValue}, got ${field.value}`
    )
  }
}

export function validateSchema(schema: Schema): void {
  for (const definition of schema.definitions) {
    validateUniqueFieldNames(definition)
    if (definition.kind === 'ENUM') validateUniqueEnumValues(definition)
  }
}

function validateUniqueFieldNames(definition: Definition): void {
  const fieldsByName = new Set<string>()
  for (const field of definition.fields) {
    if (fieldsByName.has(field.name)) {
      error(
        `The field ${quote(field.name)} is defined twice in ${quote(definition.name)}`,
        field.line,
        field.column
      )
    }
    fieldsByName.add(field.name)
  }
}

function validateUniqueEnumValues(definition: Definition): void {
  const fieldsByValue = new Set<number>()
  for (const field of definition.fields) {
    if (fieldsByValue.has(field.value)) {
      error(
        `The enum value ${field.value} is used twice in ${quote(definition.name)}`,
        field.line,
        field.column
      )
    }
    fieldsByValue.add(field.value)
  }
}
