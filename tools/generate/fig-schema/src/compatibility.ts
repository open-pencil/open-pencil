import { isEqual } from 'es-toolkit'

import type { Definition, Field, Schema } from '@open-pencil/kiwi/schema-runtime'

/** What a definition's field is written as: its type, and for enums and messages its number. */
function signature(definition: Definition, field: Field): string {
  const type = definition.kind === 'ENUM' ? '' : `${field.type}${field.isArray ? '[]' : ''} `
  return definition.kind === 'STRUCT' ? type : `${type}= ${field.value}`
}

/**
 * How `next` would break what `current` writes: a definition or field it drops, a definition
 * whose kind changed, a field whose type or number changed, and a struct whose fields changed,
 * since a struct's layout is its field list. Additions are not listed; they break nothing.
 */
export function incompatibleChanges(current: Schema, next: Schema): string[] {
  const nextDefinitions = new Map(
    next.definitions.map((definition) => [definition.name, definition])
  )
  return current.definitions.flatMap((definition) => {
    const updated = nextDefinitions.get(definition.name)
    if (!updated) return [`${definition.name} was removed`]
    if (updated.kind !== definition.kind)
      return [`${definition.name} changed from ${definition.kind} to ${updated.kind}`]
    if (definition.kind === 'STRUCT') {
      const fields = (item: Definition) =>
        item.fields.map((field) => `${signature(item, field)}${field.name}`)
      return isEqual(fields(updated), fields(definition))
        ? []
        : [`${definition.name} changed its struct fields`]
    }
    const fields = new Map(updated.fields.map((field) => [field.name, field]))
    return definition.fields.flatMap((field) => {
      const changed = fields.get(field.name)
      const name = `${definition.name}.${field.name}`
      if (!changed) return [`${name} was removed`]
      const before = signature(definition, field)
      const after = signature(updated, changed)
      return before === after ? [] : [`${name} changed from ${before} to ${after}`]
    })
  })
}

/** The definitions and fields `next` adds to `current`, by definition. */
export function additions(
  current: Schema,
  next: Schema
): { definitions: string[]; fields: string[] } {
  const known = new Map(current.definitions.map((definition) => [definition.name, definition]))
  const definitions: string[] = []
  const fields: string[] = []
  for (const definition of next.definitions) {
    const existing = known.get(definition.name)
    if (!existing) {
      definitions.push(definition.name)
      continue
    }
    const names = new Set(existing.fields.map((field) => field.name))
    for (const field of definition.fields)
      if (!names.has(field.name)) fields.push(`${definition.name}.${field.name}`)
  }
  return { definitions, fields }
}
