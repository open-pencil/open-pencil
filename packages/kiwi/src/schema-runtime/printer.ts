import type { Definition, Field, Schema } from './schema'

/** The schema as Kiwi's text format writes it, which `parseSchema` reads back unchanged. */
export function prettyPrintSchema(schema: Schema): string {
  const blocks = schema.definitions.map(printDefinition)
  if (schema.package !== null) blocks.unshift(`package ${schema.package};\n`)
  return blocks.join('\n')
}

/** `message Paint {`, one line per field, then `}`. */
function printDefinition(definition: Definition): string {
  const lines = [
    `${definition.kind.toLowerCase()} ${definition.name} {`,
    ...definition.fields.map((field) => `  ${printField(definition, field)};`),
    '}'
  ]
  return `${lines.join('\n')}\n`
}

/**
 * An enum member is `NAME = 1`, a struct field `float x`, a message field `Color color = 1`;
 * any of them may end in `[deprecated]`.
 */
function printField(definition: Definition, field: Field): string {
  let text = definition.kind === 'ENUM' ? field.name : `${typeName(field)} ${field.name}`
  if (definition.kind !== 'STRUCT') text += ` = ${field.value}`
  if (field.isDeprecated) text += ' [deprecated]'
  return text
}

function typeName(field: Field): string {
  return field.isArray ? `${field.type}[]` : `${field.type}`
}
