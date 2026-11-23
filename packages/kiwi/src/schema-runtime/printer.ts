import type { Schema } from './schema'

/** The schema as Kiwi's text format writes it, which `parseSchema` reads back unchanged. */
export function prettyPrintSchema(schema: Schema): string {
  const blocks = schema.definitions.map((definition) => {
    const fields = definition.fields.map((field) => {
      const declaration =
        definition.kind === 'ENUM'
          ? field.name
          : `${field.type}${field.isArray ? '[]' : ''} ${field.name}`
      const value = definition.kind === 'STRUCT' ? '' : ` = ${field.value}`
      return `  ${declaration}${value}${field.isDeprecated ? ' [deprecated]' : ''};\n`
    })
    return `${definition.kind.toLowerCase()} ${definition.name} {\n${fields.join('')}}\n`
  })
  const header = schema.package === null ? [] : [`package ${schema.package};\n`]
  return [...header, ...blocks].join('\n')
}
