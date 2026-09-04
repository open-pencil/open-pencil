import type { SceneNode, Vector } from '@open-pencil/scene-graph'

import type { ImageAttachmentMediaType } from '@/app/ai/attachment/image/types'

export interface AttachmentBase {
  id: string
  messageId: string
  kind: 'image' | 'node'
  name: string
  preview: Blob
}

export interface ImagePresentation extends AttachmentBase {
  kind: 'image'
  mediaType: ImageAttachmentMediaType
  originalSize: Vector
}

export interface NodePresentation extends AttachmentBase {
  kind: 'node'
  nodeId: string
  nodeType: SceneNode['type']
  originalSize: Vector
}

export type AttachmentPresentation = ImagePresentation | NodePresentation
