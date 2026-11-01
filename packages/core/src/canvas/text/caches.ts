import type { Image, Path } from 'canvaskit-wasm'

import type { ResourceCache } from '#core/cache/resource'
import type { SavedDecorationCache } from '#core/text/decorations'

import { createDerivedGlyphPathCache, createGlyphSilhouetteCache } from './derived'
import { createEmojiImageCache } from './emoji'

/** What saved text keeps between draws: glyph outlines, their silhouettes, decorations, and emoji. */
export interface TextCaches {
  /** Path-text glyph silhouettes (stroke-and-union, font units) keyed by blob hash + relative weight. */
  readonly glyphSilhouettes: ResourceCache<string, Path>
  readonly derivedGlyphPaths: ResourceCache<Uint8Array, Path>
  readonly derivedDecorations: SavedDecorationCache
  /** Images of the emoji saved text draws, by what drew them and the emoji. */
  readonly emojiImages: ResourceCache<string, Image | null>
}

export function createTextCaches(): TextCaches {
  return {
    glyphSilhouettes: createGlyphSilhouetteCache(),
    derivedGlyphPaths: createDerivedGlyphPathCache(),
    derivedDecorations: new WeakMap(),
    emojiImages: createEmojiImageCache()
  }
}
