import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { ShapedText } from '@open-pencil/fig/node-change'
import type { SceneNode } from '@open-pencil/scene-graph'

import { shapeText } from '#core/canvas/text/shape'
import { fontManager } from '#core/text/font/manager'

/** How many shaping calls share each provider made for them; the last one to finish deletes it. */
const shaperProviderUsers = new Map<TypefaceFontProvider, number>()

/**
 * Run `use` with text shaped as the canvas lays it out. Unless the attached font provider belongs
 * to this CanvasKit, the loaded fonts are registered in one made for shaping, which calls that
 * overlap share and the last of them deletes.
 */
export async function withTextShaper<T>(
  canvasKit: CanvasKit,
  use: (shape: (node: SceneNode) => ShapedText | null) => Promise<T>
): Promise<T> {
  const attached = fontManager.providerFor(canvasKit)
  const provider = attached ?? canvasKit.TypefaceFontProvider.Make()
  if (!attached) fontManager.attachProvider(canvasKit, provider)
  const shared = !attached || shaperProviderUsers.has(provider)
  if (shared) shaperProviderUsers.set(provider, (shaperProviderUsers.get(provider) ?? 0) + 1)
  try {
    return await use((node) => shapeText(canvasKit, provider, node))
  } finally {
    if (shared) {
      const users = (shaperProviderUsers.get(provider) ?? 1) - 1
      if (users > 0) {
        shaperProviderUsers.set(provider, users)
      } else {
        shaperProviderUsers.delete(provider)
        fontManager.detachProvider(provider)
        provider.delete()
      }
    }
  }
}
