import { layersIn, type LayerWriter } from '#design-json/layers'
import type { DesignJSON, DesignJSONLayer } from '#design-json/types'

/** The document being filled in, and the writer its layers were written with. */
export interface References {
  document: DesignJSON
  writer: LayerWriter
}

/** Visits each item in the queue, including those a visit adds to it. */
export function drain<T>(queue: T[], visit: (item: T) => void) {
  for (let item = queue.pop(); item !== undefined; item = queue.pop()) visit(item)
}

/** Every layer written so far: those asked for, then main components, then shared styles. */
export function writtenLayers(references: References): DesignJSONLayer[] {
  const { layers, components, styles } = references.document
  return [...layersIn([...layers, ...Object.values(components), ...Object.values(styles)])]
}
