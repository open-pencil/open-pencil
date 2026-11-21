import type { LayerWriter } from '#design-json/layers'
import { addMainComponents } from '#design-json/references/components'
import { addImages } from '#design-json/references/images'
import { addSharedStyles } from '#design-json/references/styles'
import { addVariables } from '#design-json/references/variables'
import type { DesignJSON } from '#design-json/types'

/**
 * Fills in what the layers reference by the IDs they hold. Main components and shared styles
 * come first, since their layers reference variables and images of their own.
 */
export function addReferences(document: DesignJSON, writer: LayerWriter) {
  const references = { document, writer }
  addMainComponents(references)
  addSharedStyles(references)
  addVariables(references)
  addImages(references)
}
