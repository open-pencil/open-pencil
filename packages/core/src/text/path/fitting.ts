import type { DerivedTextGlyph, TextPathData } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { sampleTextPath } from './sampling'

/**
 * Node-local box that maps the layout path onto the glyph baselines.
 *
 * `SceneNode.textPathBox` is ~4% too small (import maps the path onto the node's
 * ORIGINAL Figma box, not its own normalizedSize space), so a path sampled from
 * it sits ~30px off the lettering. This recovers the box that lands the path ON
 * the glyphs, for display (the selection overlay) without disturbing the
 * import/reflow use of textPathBox.
 *
 * It fits from `box0` (the node's current textPathBox) so the box **aspect ratio
 * is preserved** — after a non-uniform resize textPathBox is an oval, and the
 * overlay must oval with it (using normalizedSize would force a circle). Only a
 * uniform scale (about box0's centre) + translation are fit — a 3-DOF similarity
 * that corrects the ~4% and repositions without over-fitting the arc. Returns
 * null with no glyphs, a degenerate box, or an unsampleable path.
 */
const fittedBoxCache = new WeakMap<object, { box0: Rect; result: Rect | null }>()

export function fitTextPathBoxToGlyphs(
  data: TextPathData,
  box0: Rect,
  glyphs: readonly Pick<DerivedTextGlyph, 'x' | 'y'>[] | null | undefined
): Rect | null {
  if (!glyphs?.length) return null
  // The selection overlay calls this every repaint (pan/zoom) with the node's
  // stable textPathBox/glyphs references, but the 8-iteration fit is unchanged
  // until resize/reflow produces new objects. Memoize on the glyphs array (the
  // WeakMap entry drops when that array is replaced) and re-check box0 identity.
  const memo = fittedBoxCache.get(glyphs)
  if (memo && memo.box0 === box0) return memo.result
  const result = computeFittedBox(data, box0, glyphs)
  fittedBoxCache.set(glyphs, { box0, result })
  return result
}

function computeFittedBox(
  data: TextPathData,
  box0: Rect,
  glyphs: readonly Pick<DerivedTextGlyph, 'x' | 'y'>[]
): Rect | null {
  const bw = box0.width
  const bh = box0.height
  if (!(bw > 0) || !(bh > 0)) return null
  const ref = sampleTextPath(data, box0)
  if (!ref) return null

  const cx0 = box0.x + bw / 2
  const cy0 = box0.y + bh / 2
  let c = 1
  let tx = 0
  let ty = 0
  for (let iter = 0; iter < 8; iter++) {
    // Least-squares uniform-scale + translation over the current correspondence:
    // a transformed ref point is P = centre + c·(ref − centre) + t, so minimising
    // |g − P|² gives c = cov(a,b)/var(a), t = mean(b) − c·mean(a).
    let saa = 0
    let sab = 0
    let sax = 0
    let say = 0
    let sbx = 0
    let sby = 0
    for (const g of glyphs) {
      let bestD = Infinity
      let ai = 0
      let aj = 0
      for (let i = 0; i < ref.xs.length; i++) {
        const px = cx0 + c * (ref.xs[i] - cx0) + tx
        const py = cy0 + c * (ref.ys[i] - cy0) + ty
        const d = (px - g.x) ** 2 + (py - g.y) ** 2
        if (d < bestD) {
          bestD = d
          ai = ref.xs[i] - cx0
          aj = ref.ys[i] - cy0
        }
      }
      const bx = g.x - cx0
      const by = g.y - cy0
      saa += ai * ai + aj * aj
      sab += ai * bx + aj * by
      sax += ai
      say += aj
      sbx += bx
      sby += by
    }
    const n = glyphs.length
    const aBarX = sax / n
    const aBarY = say / n
    const bBarX = sbx / n
    const bBarY = sby / n
    const varA = saa - n * (aBarX * aBarX + aBarY * aBarY)
    const covAB = sab - n * (aBarX * bBarX + aBarY * bBarY)
    // Clamp before deriving translation so a degenerate fit can't pair an
    // unbounded scale's tx/ty with the clamped scale and shift the box.
    const fittedC = varA > 1e-6 ? covAB / varA : c
    const newC = Math.min(Math.max(fittedC, 0.5), 2)
    const newTx = bBarX - newC * aBarX
    const newTy = bBarY - newC * aBarY
    const converged =
      Math.abs(newC - c) < 1e-4 && Math.abs(newTx - tx) < 0.05 && Math.abs(newTy - ty) < 0.05
    c = newC
    tx = newTx
    ty = newTy
    if (converged) break
  }
  return {
    x: cx0 - (bw * c) / 2 + tx,
    y: cy0 - (bh * c) / 2 + ty,
    width: bw * c,
    height: bh * c
  }
}
