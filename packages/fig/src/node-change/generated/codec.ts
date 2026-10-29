import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { KiwiNodeChange, SceneNodeToKiwiContext } from '../export/context'

/**
 * How one type of generated frame is read from and written to its `.fig` record. Its sublayers
 * live on the frame's record as `nodeGenerationData` and `derivedImmutableFrameData` entries, so
 * the reader builds them from it and the writer puts them back; the document reader and the
 * exporter ask the type's codec instead of testing for the type.
 */
export interface GeneratedFrameCodec {
  /** Gives a frame read from its record the sublayers the record describes. */
  read(graph: SceneGraph, frame: SceneNode, record: NodeChange, blobs: Uint8Array[]): void
  /**
   * Points the frame at the layers its record names by GUID, as a connector's ends do. The reader
   * calls it once every layer of the pass exists; `layerOf` gives the layer a record became.
   */
  link?(
    graph: SceneGraph,
    frame: SceneNode,
    record: NodeChange,
    layerOf: (sourceId: string) => string | undefined
  ): void
  /** The frame's own record, with its sublayers written on it as Figma stores them. */
  write(context: SceneNodeToKiwiContext, frame: SceneNode, nc: KiwiNodeChange): KiwiNodeChange
}
