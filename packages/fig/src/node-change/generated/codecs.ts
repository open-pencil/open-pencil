import type { NodeType } from '@open-pencil/scene-graph'

import type { GeneratedFrameCodec } from './codec'
import { CONNECTOR_CODEC } from './connector'
import { STICKY_CODEC } from './sticky'

/** Each generated frame type's codec; a type without one is written as a plain frame. */
const GENERATED_FRAME_CODECS: Partial<Record<NodeType, GeneratedFrameCodec>> = {
  STICKY: STICKY_CODEC,
  CONNECTOR: CONNECTOR_CODEC
}

export function generatedFrameCodec(type: NodeType): GeneratedFrameCodec | undefined {
  return GENERATED_FRAME_CODECS[type]
}

export type { GeneratedFrameCodec } from './codec'
