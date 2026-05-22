import type { Canvas, Paint } from 'canvaskit-wasm'

import type {
  GradientFill,
  ImageFill,
  SceneNode,
  SceneGraph,
  Fill,
  GradientTransform
} from '#core/scene-graph'

import type { SkiaRenderer } from './renderer'
import { ShaderCacheEntry } from './renderer/shader-cache-entry'

export function drawNodeFill(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  fill?: Fill,
  isFirstDrawnFill = true
): void {
  const dimsValid = hasValidDimensions(node.width, node.height)
  const lineValid = hasValidLineDimensions(node.width, node.height)

  switch (node.type) {
    case 'VECTOR': {
      const fg = r.getFillGeometry(node)
      if (fg) {
        for (const p of fg) canvas.drawPath(p, r.fillPaint)
      } else {
        const vps = r.getVectorPaths(node)
        if (vps) {
          for (const vp of vps) canvas.drawPath(vp, r.fillPaint)
        }
      }
      break
    }
    case 'ELLIPSE': {
      const fg = r.getFillGeometry(node)
      if (fg) {
        for (const p of fg) canvas.drawPath(p, r.fillPaint)
      } else if (node.arcData) {
        r.drawArc(canvas, node, r.fillPaint)
      } else if (dimsValid) {
        canvas.drawOval(rect, r.fillPaint)
      }
      break
    }
    case 'TEXT':
      r.renderText(canvas, node, fill, isFirstDrawnFill)
      break
    case 'LINE':
      if (lineValid) {
        canvas.drawLine(0, 0, node.width, node.height, r.fillPaint)
      }
      break
    case 'POLYGON':
    case 'STAR': {
      if (!dimsValid) break
      const path = r.makePolygonPath(node)
      canvas.drawPath(path, r.fillPaint)
      path.delete()
      break
    }
    default:
      if (dimsValid) {
        if (hasRadius) {
          canvas.drawRRect(r.makeRRect(node), r.fillPaint)
        } else {
          canvas.drawRect(rect, r.fillPaint)
        }
      }
  }
}

export function applyFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph,
  fillIndex = 0
): boolean {
  r.fillPaint.setShader(null)

  if (fill.type === 'SOLID') {
    const c = r.resolveFillColor(fill, fillIndex, node, graph)
    r.fillPaint.setColor(r.ck.Color4f(c.r, c.g, c.b, c.a))
    return true
  }

  if (fill.type.startsWith('GRADIENT')) {
    return r.applyGradientFill(fill as GradientFill, node, graph)
  }

  if (fill.type === 'IMAGE') {
    return r.applyImageFill(fill, node, graph)
  }

  return false
}

function makeGradientLocalMatrix(
  r: SkiaRenderer,
  width: number,
  height: number,
  transform: GradientTransform
) {
  return r.ck.Matrix.multiply(r.ck.Matrix.scaled(width, height), [
    transform.m00,
    transform.m01,
    transform.m02,
    transform.m10,
    transform.m11,
    transform.m12,
    0,
    0,
    1
  ])
}

export function linearGradientEndpoints(
  width: number,
  height: number,
  transform: NonNullable<GradientFill['gradientTransform']>
) {
  return {
    start: {
      x: (transform.m00 + transform.m02) * width,
      y: (transform.m10 + transform.m12) * height
    },
    end: { x: transform.m02 * width, y: transform.m12 * height }
  }
}

/**
 * Compute a numeric cache key from gradient inputs using FNV-1a hash.
 * Avoids string interpolation entirely — operates on numeric values,
 * producing a single number with zero intermediate string allocations.
 * This eliminates the ~6-8 string allocations per call that the previous
 * array+join implementation created even on cache hits.
 */
function gradientShaderKey(
  fill: GradientFill,
  node: SceneNode,
  colors: Float32Array[],
  positions: number[]
): number {
  // FNV-1a offset basis
  let hash = 2166136261

  // Mix gradient type as a numeric code (avoids string hashing)
  // GRADIENT_LINEAR=0, GRADIENT_RADIAL=1, GRADIENT_DIAMOND=2, GRADIENT_ANGULAR=3
  let typeCode = 3 // default: GRADIENT_ANGULAR
  if (fill.type === 'GRADIENT_LINEAR') typeCode = 0
  else if (fill.type === 'GRADIENT_RADIAL') typeCode = 1
  else if (fill.type === 'GRADIENT_DIAMOND') typeCode = 2
  hash ^= typeCode
  hash = Math.imul(hash, 16777619) >>> 0

  // Mix node dimensions
  hash ^= floatToUint32(node.width)
  hash = Math.imul(hash, 16777619) >>> 0
  hash ^= floatToUint32(node.height)
  hash = Math.imul(hash, 16777619) >>> 0

  // Mix gradient transform
  const t = fill.gradientTransform
  hash ^= floatToUint32(t.m00)
  hash = Math.imul(hash, 16777619) >>> 0
  hash ^= floatToUint32(t.m01)
  hash = Math.imul(hash, 16777619) >>> 0
  hash ^= floatToUint32(t.m02)
  hash = Math.imul(hash, 16777619) >>> 0
  hash ^= floatToUint32(t.m10)
  hash = Math.imul(hash, 16777619) >>> 0
  hash ^= floatToUint32(t.m11)
  hash = Math.imul(hash, 16777619) >>> 0
  hash ^= floatToUint32(t.m12)
  hash = Math.imul(hash, 16777619) >>> 0
  // Mix gradient stops (positions + colors)
  // Explicitly hash stop count first to differentiate gradients with
  // identical leading stops but different total counts (defense-in-depth
  // against the implicit iteration-count mixing).
  const stops = fill.gradientStops
  hash ^= stops.length
  hash = Math.imul(hash, 16777619) >>> 0
  for (let i = 0; i < stops.length; i++) {
    hash ^= floatToUint32(positions[i])
    hash = Math.imul(hash, 16777619) >>> 0
    if (colors[i]) {
      hash ^= floatToUint32(colors[i][0])
      hash = Math.imul(hash, 16777619) >>> 0
      hash ^= floatToUint32(colors[i][1])
      hash = Math.imul(hash, 16777619) >>> 0
      hash ^= floatToUint32(colors[i][2])
      hash = Math.imul(hash, 16777619) >>> 0
      hash ^= floatToUint32(colors[i][3])
      hash = Math.imul(hash, 16777619) >>> 0
    }
  }

  return hash
}

function gradientShaderSignature(
  fill: GradientFill,
  node: SceneNode,
  colors: Float32Array[],
  positions: number[]
): string {
  let signature = `${fill.type}|${node.width}|${node.height}|`
  const t = fill.gradientTransform
  signature += `${t.m00},${t.m01},${t.m02},${t.m10},${t.m11},${t.m12}|`
  signature += `${positions.length}|`
  for (let i = 0; i < positions.length; i++) {
    const color = colors[i]
    signature += `${positions[i]}:${color[0]},${color[1]},${color[2]},${color[3]}|`
  }
  return signature
}

/**
 * Module-level reusable buffer for floatToUint32 — avoids allocating
 * a Float64Array + DataView on every call. Safe because JS is single-threaded
 * in the rendering context and floatToUint32 is synchronous.
 */
const _f64 = new Float64Array(1)
const _f64View = new DataView(_f64.buffer)

/**
 * Convert a float to a Uint32 for hash mixing.
 * Uses DataView to get the bit representation, ensuring that
 * different float values (including NaN variants) produce different hashes.
 * XOR upper and lower 32 bits of the IEEE 754 double for mixing.
 */
function floatToUint32(value: number): number {
  _f64[0] = value
  return (_f64View.getUint32(0) ^ _f64View.getUint32(4)) >>> 0
}

/** Create a gradient shader from fill parameters. Returns null for unrecognized types. */
function createGradientShader(
  r: SkiaRenderer,
  fill: GradientFill,
  w: number,
  h: number,
  t: GradientTransform,
  colors: Float32Array[],
  positions: number[]
): ReturnType<typeof r.ck.Shader.MakeLinearGradient> | null {
  if (fill.type === 'GRADIENT_LINEAR') {
    const startX = t.m02 * w
    const startY = t.m12 * h
    const endX = (t.m00 + t.m02) * w
    const endY = (t.m10 + t.m12) * h
    return r.ck.Shader.MakeLinearGradient(
      [startX, startY],
      [endX, endY],
      colors,
      positions,
      r.ck.TileMode.Clamp
    )
  }
  if (fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_DIAMOND') {
    const localMatrix = makeGradientLocalMatrix(r, w, h, t)
    return r.ck.Shader.MakeRadialGradient(
      [0.5, 0.5],
      0.5,
      colors,
      positions,
      r.ck.TileMode.Clamp,
      localMatrix
    )
  }
  // GRADIENT_ANGULAR — only remaining type in GradientFill union
  const localMatrix = makeGradientLocalMatrix(r, w, h, t)
  return r.ck.Shader.MakeSweepGradient(
    0.5,
    0.5,
    colors,
    positions,
    r.ck.TileMode.Clamp,
    localMatrix
  )
}

export function applyGradientFill(
  r: SkiaRenderer,
  fill: GradientFill,
  node: SceneNode,
  graph: SceneGraph
): boolean {
  const stops = fill.gradientStops
  if (stops.length === 0) return false
  const t = fill.gradientTransform
  const colors = stops.map((s, index) => {
    const resolved = r.resolveFillColorInfo(
      {
        ...fill,
        type: 'SOLID',
        color: s.color,
        opacity: s.color.a,
        visible: true
      },
      index,
      node,
      graph
    )
    const c = resolved.color
    return r.ck.Color4f(c.r, c.g, c.b, c.a)
  })
  const positions = stops.map((s) => s.position)

  const w = node.width
  const h = node.height

  if (!hasValidDimensions(w, h)) return false

  if (
    !Number.isFinite(t.m00) ||
    !Number.isFinite(t.m01) ||
    !Number.isFinite(t.m02) ||
    !Number.isFinite(t.m10) ||
    !Number.isFinite(t.m11) ||
    !Number.isFinite(t.m12)
  ) {
    return false
  }

  // Check shader cache before creating a new shader.
  // Defer signature computation to avoid string allocation on
  // cache misses where the key hasn't been seen before (no bucket).
  const key = gradientShaderKey(fill, node, colors, positions)
  let signature: string | undefined
  const cachedBucket = r.shaderCache.get(key)
  if (cachedBucket) {
    signature = gradientShaderSignature(fill, node, colors, positions)
    const cached = cachedBucket.find((entry) => entry.signature === signature)
    if (cached) {
      r.fillPaint.setShader(cached.shader)
      return true
    }
  }

  const shader = createGradientShader(r, fill, w, h, t, colors, positions)

  if (shader) {
    // On cache miss (no bucket), signature was never computed — compute now.
    // On miss-with-bucket, signature was already computed in the cache check block above.
    const entrySignature = signature ?? gradientShaderSignature(fill, node, colors, positions)
    const nextEntry = new ShaderCacheEntry(entrySignature, shader)
    if (cachedBucket) {
      cachedBucket.push(nextEntry)
      // Cap bucket size to prevent unbounded growth from hash collisions
      // or repeated variants under the same key. If the bucket exceeds
      // the limit, evict the oldest entry (first in array) and free
      // its native shader resource.
      const MAX_BUCKET_SIZE = 8
      if (cachedBucket.length > MAX_BUCKET_SIZE) {
        const evicted = cachedBucket.shift()
        if (evicted) evicted.delete()
      }
      // Re-set with same reference — LRUMap skips destroyValue when
      // oldValue === value, which is correct here since we only
      // mutated the array (added an entry, possibly evicted one).
      r.shaderCache.set(key, cachedBucket)
    } else {
      r.shaderCache.set(key, [nextEntry])
    }
    r.fillPaint.setShader(shader)
    return true
  }
  return false
}

export function hasValidDimensions(w: number, h: number): boolean {
  return Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0
}

export function hasValidLineDimensions(w: number, h: number): boolean {
  return Number.isFinite(w) && Number.isFinite(h) && (w !== 0 || h !== 0)
}

export function applyImageFill(
  r: SkiaRenderer,
  fill: ImageFill,
  node: SceneNode,
  graph: SceneGraph
): boolean {
  const hash = fill.imageHash
  if (!hash) return false
  let img = r.imageCache.get(hash)
  if (!img) {
    const data = graph.images.get(hash)
    if (!data) return false
    const decoded = r.ck.MakeImageFromEncoded(data) ?? undefined
    if (!decoded) return false
    img = decoded.makeCopyWithDefaultMipmaps()
    decoded.delete()
    r.imageCache.set(hash, img)
  }

  const imgW = img.width()
  const imgH = img.height()
  if (!hasValidDimensions(imgW, imgH)) return false
  const scaleMode = fill.imageScaleMode

  if (scaleMode === 'TILE') {
    const shader = img.makeShaderCubic(r.ck.TileMode.Repeat, r.ck.TileMode.Repeat, 1 / 3, 1 / 3)
    r.fillPaint.setShader(shader)
    r.imageFillShader = shader
    return true
  }

  let sx: number, sy: number, sw: number, sh: number
  if (scaleMode === 'CROP' && fill.imageTransform) {
    const t = fill.imageTransform
    sx = t.m02 * imgW
    sy = t.m12 * imgH
    sw = t.m00 * imgW
    sh = t.m11 * imgH
  } else if (scaleMode === 'FIT') {
    const scale = Math.min(node.width / imgW, node.height / imgH)
    sw = imgW
    sh = imgH
    sx = -(node.width / scale - imgW) / 2
    sy = -(node.height / scale - imgH) / 2
  } else {
    const scale = Math.max(node.width / imgW, node.height / imgH)
    sw = node.width / scale
    sh = node.height / scale
    sx = (imgW - sw) / 2
    sy = (imgH - sh) / 2
  }

  if (!hasValidDimensions(sw, sh) || !hasValidDimensions(node.width, node.height)) return false

  const shader = img.makeShaderOptions(
    r.ck.TileMode.Clamp,
    r.ck.TileMode.Clamp,
    r.ck.FilterMode.Linear,
    r.ck.MipmapMode.Linear,
    r.ck.Matrix.multiply(
      r.ck.Matrix.scaled(node.width / sw, node.height / sh),
      r.ck.Matrix.translated(-sx, -sy)
    )
  )
  r.fillPaint.setShader(shader)
  r.imageFillShader = shader
  return true
}

export function makeArcPath(r: SkiaRenderer, node: SceneNode) {
  const arc = node.arcData
  if (!arc) return null
  if (!hasValidDimensions(node.width, node.height)) return null
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2
  const innerRx = rx * arc.innerRadius
  const innerRy = ry * arc.innerRadius

  const startDeg = arc.startingAngle * (180 / Math.PI)
  const endDeg = arc.endingAngle * (180 / Math.PI)
  const sweepDeg = endDeg - startDeg

  const path = new r.ck.Path()
  const oval = r.ck.LTRBRect(0, 0, node.width, node.height)

  if (arc.innerRadius > 0) {
    path.addArc(oval, startDeg, sweepDeg)
    const innerOval = r.ck.LTRBRect(cx - innerRx, cy - innerRy, cx + innerRx, cy + innerRy)
    const innerPath = new r.ck.Path()
    innerPath.addArc(innerOval, startDeg + sweepDeg, -sweepDeg)
    path.addPath(innerPath)
    path.close()
    innerPath.delete()
    return path
  }

  const isFullCircle = Math.abs(sweepDeg) >= 359.99
  if (isFullCircle) {
    path.addOval(oval)
  } else {
    path.moveTo(cx, cy)
    path.addArc(oval, startDeg, sweepDeg)
    path.close()
  }
  return path
}

export function drawArc(r: SkiaRenderer, canvas: Canvas, node: SceneNode, paint: Paint): void {
  const path = makeArcPath(r, node)
  if (!path) return
  canvas.drawPath(path, paint)
  path.delete()
}
