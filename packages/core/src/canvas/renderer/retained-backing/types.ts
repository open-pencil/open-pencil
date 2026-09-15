import type { Image as CKImage, Surface } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

export interface RenderContentVersion {
  pageId: string | null
  sceneVersion: number
  positionPreviewVersion: number
  fontGeneration: number
}

export interface SceneBackingGeometry {
  /** Viewport translation at rasterization, before adding integer-device-pixel overscan. */
  anchorPanX: number
  anchorPanY: number
  marginDeviceX: number
  marginDeviceY: number
  panX: number
  panY: number
  zoom: number
  width: number
  height: number
  dpr: number
  worldX: number
  worldY: number
  worldWidth: number
  worldHeight: number
}

export interface SceneBacking extends RenderContentVersion, SceneBackingGeometry {
  image: CKImage
}

export interface SceneBackingBuild extends RenderContentVersion, SceneBackingGeometry {
  surface: Surface
  graph: SceneGraph
  childIds: string[]
  index: number
  startedAt: number
}
