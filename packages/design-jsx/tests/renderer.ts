import { createDesignJSXRenderer } from '#design-jsx/index'

/** A renderer without icons, artwork, vectors, or layout, for props that depend on none of them. */
export function createPlainRenderer() {
  return createDesignJSXRenderer<never>({
    icon: () => Promise.resolve(null),
    svg: () => null,
    createArtwork: () => {
      throw new Error('No artwork in these tests')
    },
    layout: () => {
      // These props do not depend on layout.
    },
    vectorBounds: () => {
      throw new Error('No vectors in these tests')
    }
  })
}
