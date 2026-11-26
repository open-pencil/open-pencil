import type { CanvasKit, TypefaceFontProvider } from '@open-pencil/canvaskit'
import type { ColorProfile, SceneNode } from '@open-pencil/scene-graph'

import type { FontResolutionSettled } from '#core/text/resolver'

import type { TextPreparationCache } from './preparation/cache'

export interface FontReadinessRenderer {
  textPreparationCache?: TextPreparationCache
  ck?: CanvasKit
  fontProvider?: TypefaceFontProvider | null
  fontsLoaded?: boolean
  onFontResolutionSettled?: FontResolutionSettled
  trackFontDemand?: (node: SceneNode, key: string) => void
}

export interface TextRenderer extends FontReadinessRenderer {
  ck: CanvasKit
  /** The space the document's colors are in; sRGB where text is only measured. */
  documentColorSpace?: ColorProfile
  fontProvider: TypefaceFontProvider | null
  fontsLoaded: boolean
}
