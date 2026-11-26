import { isEqual, keyBy } from 'es-toolkit'

import type { Definition, Field, Schema } from '@open-pencil/kiwi/schema-runtime'

/**
 * How `next` would break files `current` reads and writes, one message per change. Additions are
 * not listed; they break nothing.
 */
export function incompatibleChanges(current: Schema, next: Schema): string[] {
  const nextByName = keyBy(next.definitions, (definition) => definition.name)
  return current.definitions.flatMap((definition) =>
    definitionChanges(definition, nextByName[definition.name])
  )
}

/** The definitions and fields `next` adds to `current`. */
export function additions(
  current: Schema,
  next: Schema
): { definitions: string[]; fields: string[] } {
  const currentByName = keyBy(current.definitions, (definition) => definition.name)
  const definitions: string[] = []
  const fields: string[] = []
  for (const definition of next.definitions) {
    const existing = currentByName[definition.name]
    if (!existing) {
      definitions.push(definition.name)
      continue
    }
    const known = new Set(existing.fields.map((field) => field.name))
    for (const field of definition.fields) {
      if (!known.has(field.name)) fields.push(`${definition.name}.${field.name}`)
    }
  }
  return { definitions, fields }
}

function definitionChanges(before: Definition, after: Definition | undefined): string[] {
  if (!after) return [`${before.name} was removed`]
  if (after.kind !== before.kind) {
    return [`${before.name} changed from ${before.kind} to ${after.kind}`]
  }
  switch (before.kind) {
    case 'STRUCT':
      return structChanges(before, after)
    case 'MESSAGE':
      return fieldChanges(before, after)
    case 'ENUM':
      return [...fieldChanges(before, after), ...enumValueChanges(before, after)]
  }
}

/** A struct is encoded as its fields in order, so any change to that list breaks it. */
function structChanges(before: Definition, after: Definition): string[] {
  const layout = (definition: Definition) =>
    definition.fields.map((field) => `${typeName(field)} ${field.name}`)
  return isEqual(layout(before), layout(after)) ? [] : [`${before.name} changed its struct fields`]
}

/** Every existing enum member or message field must keep its number, and its type. */
function fieldChanges(before: Definition, after: Definition): string[] {
  const afterByName = keyBy(after.fields, (field) => field.name)
  return before.fields.flatMap((field) => {
    const name = `${before.name}.${field.name}`
    const updated = afterByName[field.name]
    if (!updated) return [`${name} was removed`]
    const was = signature(before, field)
    const now = signature(after, updated)
    return was === now ? [] : [`${name} changed from ${was} to ${now}`]
  })
}

/**
 * Kiwi lets enum members share a value, and a shared value decodes as the last of them, so every
 * value must keep the name it decodes as: a new alias or a reordering would rename it.
 */
function enumValueChanges(before: Definition, after: Definition): string[] {
  const was = decodedNames(before)
  const now = decodedNames(after)
  return [...was].flatMap(([value, name]) => {
    const renamed = now.get(value)
    return renamed === undefined || renamed === name
      ? []
      : [`${before.name} ${value} would read as ${renamed} instead of ${name}`]
  })
}

/** Each enum value and the member it decodes as; later members overwrite earlier ones. */
function decodedNames(definition: Definition): Map<number, string> {
  return new Map(definition.fields.map((field) => [field.value, field.name]))
}

/** `= 1` for an enum member, `Color[] = 1` for a message field. */
function signature(definition: Definition, field: Field): string {
  return definition.kind === 'ENUM' ? `= ${field.value}` : `${typeName(field)} = ${field.value}`
}

function typeName(field: Field): string {
  return field.isArray ? `${field.type}[]` : `${field.type}`
}
