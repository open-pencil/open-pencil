import { drain, writtenLayers, type References } from '#design-json/references/context'
import { stringsIn, toJSONObject } from '#design-json/values'

/** The variables the written layers name, then those their values alias, with their collections. */
export function addVariables(references: References) {
  const pending = [...stringsIn(writtenLayers(references))]
  drain(pending, (id) => addVariable(references, id, pending))
}

function addVariable(references: References, id: string, pending: string[]) {
  const { document, writer } = references
  if (id in document.variables) return
  const variable = writer.graph.variables.get(id)
  if (!variable) return
  const written = toJSONObject(variable, writer.options.bytes)
  document.variables[id] = written
  for (const aliased of stringsIn(written.valuesByMode)) pending.push(aliased)
  addVariableCollection(references, variable.collectionId)
}

function addVariableCollection(references: References, id: string) {
  const { document, writer } = references
  if (id in document.variableCollections) return
  const collection = writer.graph.variableCollections.get(id)
  if (!collection) return
  document.variableCollections[id] = toJSONObject(collection, writer.options.bytes)
}
