import { toRaw, type FunctionalComponent } from 'vue'

import { nodeOutlinePath } from '@open-pencil/core/io/formats/svg'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import { validateVectorNetwork } from '@open-pencil/scene-graph/vector-network'
import type { LayerOutline } from '@open-pencil/vue/primitives/LayerTree'

import { maskIcon } from './mask'

/** The layer row's icon slot (`size-3` in the layer tree theme), so the outline draws at 1:1. */
const SLOT = 12
/** Figma draws a layer's row outline 9 px across, inside a 10 px square, stroked 1 px. */
const SHAPE = 9
const STROKE = 1
/** Figma shows its generic vector glyph once vertices and segments together reach this many. */
const MAX_VECTOR_ELEMENTS = 129

const round = (value: number) => Math.round(value * 10_000) / 10_000

/** A vector Figma draws as its outline: something to draw, not too much, and no broken indices. */
function drawsVector(outline: LayerOutline): boolean {
  const network = outline.vectorNetwork
  if (!network || network.segments.length === 0) return false
  if (network.vertices.length + network.segments.length >= MAX_VECTOR_ELEMENTS) return false
  return validateVectorNetwork(network).length === 0
}

/**
 * A shape layer's outline as icon markup, as Figma draws its layer row
 * (`generateObjectsPanelIcon`): turned and reflected as the layer is, with the layer's box
 * fitted to the icon and centred, and never filled. Null when Figma keeps the generic glyph.
 */
export function outlineIconSVG(outline: LayerOutline): string | null {
  if (outline.type === 'VECTOR' && !drawsVector(outline)) return null
  const path = nodeOutlinePath(outline)
  if (!path) return null

  // Figma fits the layer's turned box, not the outline, so a turned shape keeps its size.
  const { width, height } = outline
  const placement = getNodeLocalMatrix({ ...outline, x: 0, y: 0 })
  const corners = Matrix.mapPoints(placement, [0, 0, width, 0, width, height, 0, height])
  const xs = corners.filter((_, index) => index % 2 === 0)
  const ys = corners.filter((_, index) => index % 2 === 1)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const boxWidth = Math.max(...xs) - minX
  const boxHeight = Math.max(...ys) - minY
  const extent = Math.max(boxWidth, boxHeight)
  if (!(extent > 0)) return null

  const scale = SHAPE / extent
  const [a, c, e, b, d, f] = Matrix.multiply(
    Matrix.translated(
      (SLOT - boxWidth * scale) / 2 - minX * scale,
      (SLOT - boxHeight * scale) / 2 - minY * scale
    ),
    Matrix.scaled(scale, scale),
    placement
  ).map(round)
  // The path stays in the layer's box, so arcs and rounded corners need no re-deriving; the
  // stroke keeps its width however far the box is scaled down.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SLOT} ${SLOT}"><path d="${path}" transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})" fill="none" stroke="black" stroke-width="${STROKE}" vector-effect="non-scaling-stroke"/></svg>`
}

/** Each outline's icon, built once: the row replaces its outline when the layer changes. */
const icons = new WeakMap<LayerOutline, FunctionalComponent | null>()

/** A shape layer's own outline as an icon component. */
export function outlineIcon(outline: LayerOutline): FunctionalComponent | null {
  const raw = toRaw(outline)
  let icon = icons.get(raw)
  if (icon === undefined) {
    const svg = outlineIconSVG(raw)
    icon = svg ? maskIcon(svg) : null
    icons.set(raw, icon)
  }
  return icon
}
